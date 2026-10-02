"""在临时项目副本验证正式配置写入、旧缓存迁移与发行包字节一致性。"""
import copy
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import zipfile


SOURCE = Path(__file__).resolve().parent.parent
CONFIG_NAMES = ('content', 'modules', 'stage-cars', 'text', 'ui', 'rules')


def request(port, route, payload):
    """通过真实 HTTP 接口发请求，并把成功与失败响应都返回给调用者。"""
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    connection.request('POST', route, body, {'Content-Type': 'application/json', 'Origin': f'http://127.0.0.1:{port}'})
    response = connection.getresponse()
    result = response.status, json.loads(response.read().decode('utf-8'))
    connection.close()
    return result


def read(root, name):
    return json.loads((root / 'config' / f'{name}.json').read_text(encoding='utf-8'))


def expect_saved(port, route, payload):
    status, result = request(port, route, payload)
    assert status == 200 and result.get('ok'), (route, status, result)
    return result


def check(root, port):
    """每个保存域只改一个临时标记，并确认目标文件和相邻记录。"""
    stage_before = read(root, 'stage-cars')
    key = stage_before['targets'][0]
    stage_record = copy.deepcopy(stage_before['records'][key])
    stage_record.update(id=key, source='manual', name='临时端到端关卡')
    expect_saved(port, '/__stage-cars/save', {'record': stage_record})
    stage_after = read(root, 'stage-cars')
    assert stage_after['records'][key]['name'] == '临时端到端关卡'
    assert all(stage_after['records'][other] == stage_before['records'][other]
               for other in stage_before['targets'] if other != key)

    modules_before = read(root, 'modules')
    module_id = modules_before['MODULE_ORDER'][0]
    expect_saved(port, '/__modules/save', {'id': module_id, 'changes': {'name': '临时端到端模块'}})
    modules_after = read(root, 'modules')
    assert modules_after['MODULES'][module_id]['name'] == '临时端到端模块'
    assert all(modules_after['MODULES'][other] == modules_before['MODULES'][other]
               for other in modules_before['MODULE_ORDER'] if other != module_id)
    # 模块工作台先保存，调速随后只提交单字段；服务端锁内合并后不得丢模块作者改动。
    expect_saved(port, '/__battle-speed/save', {'gameSpeed': 1.1})
    assert read(root, 'modules')['K']['GAME_SPEED'] == 1.1
    assert read(root, 'modules')['MODULES'][module_id]['name'] == '临时端到端模块'
    before_invalid_speed = (root / 'config/modules.json').read_bytes()
    status, _ = request(port, '/__battle-speed/save', {'gameSpeed': 2.0})
    assert status == 400 and (root / 'config/modules.json').read_bytes() == before_invalid_speed

    text_before = read(root, 'text')
    values = {**text_before['values'], 'e2e:save': '临时端到端文字'}
    expect_saved(port, '/__text/save', {'game': 'steam-arena', 'locale': 'zh-CN',
                 'values': values, 'removedElements': text_before['removedElements']})
    assert read(root, 'text')['values']['e2e:save'] == '临时端到端文字'

    # UI 与通用参数均通过受限的整份配置入口写入；原有键保持不变。
    for name in ('ui', 'rules'):
        before = read(root, name)
        changed = {**before, 'e2eProbe': f'临时端到端{name}'}
        expect_saved(port, '/__config/save', {'name': name, 'data': changed})
        assert read(root, name) == changed

    # 非法请求不写盘，也不会转入浏览器 localStorage：服务没有此类回退通道。
    snapshot = {name: (root / 'config' / f'{name}.json').read_bytes() for name in CONFIG_NAMES}
    status, result = request(port, '/__config/save', {'name': '../content', 'data': {'bad': True}})
    assert status == 400 and result.get('error')
    assert all((root / 'config' / f'{name}.json').read_bytes() == snapshot[name] for name in CONFIG_NAMES)

    # 迁移只合并旧值；空隐藏列表不能擦除正式隐藏项，重复请求不再迁移。
    legacy = json.dumps({'values': {'e2e:legacy': '临时迁入'}, 'removedElements': []}, ensure_ascii=False)
    before_hidden = set(read(root, 'text')['removedElements'])
    payload = {'sa-text-steam-arena-zh-CN': legacy}
    assert expect_saved(port, '/__config/migrate', payload)['migrated']
    migrated = read(root, 'text')
    assert migrated['values']['e2e:legacy'] == '临时迁入'
    assert before_hidden <= set(migrated['removedElements'])
    # 迁入后正式保存的新稿优先；相同旧哈希不能在刷新后再次覆盖它。
    newer = {**migrated['values'], 'e2e:legacy': '正式新稿'}
    expect_saved(port, '/__text/save', {'game': 'steam-arena', 'locale': 'zh-CN',
                 'values': newer, 'removedElements': migrated['removedElements']})
    assert not expect_saved(port, '/__config/migrate', payload)['migrated']
    assert read(root, 'text')['values']['e2e:legacy'] == '正式新稿'

    # 旧归档接口只有明确的停用响应，不能成为第二条写入路径。
    before_archive = {name: (root / 'config' / f'{name}.json').read_bytes() for name in CONFIG_NAMES}
    status, _ = request(port, '/__publish/archive', {'stageRecords': {key: stage_record}})
    assert status == 410
    assert all((root / 'config' / f'{name}.json').read_bytes() == before_archive[name] for name in CONFIG_NAMES)


def package_check(root, output):
    """发行 ZIP 中的每份正式配置必须与临时项目中的原文件逐字节相同。"""
    version = 'config-save-e2e'
    command = [sys.executable, str(root / 'tools' / 'package-release.py'),
               '--source-root', str(root), '--output-root', str(output), '--version', version]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
    archive_path = output / f'release-{version}.zip'
    assert archive_path.is_file(), archive_path
    with zipfile.ZipFile(archive_path) as archive:
        for name in CONFIG_NAMES:
            relative = f'config/{name}.json'
            entries = [entry for entry in archive.namelist() if entry.endswith(relative)]
            assert len(entries) == 1, (relative, entries)
            expected = (root / relative).read_bytes()
            actual = archive.read(entries[0])
            assert hashlib.sha256(actual).digest() == hashlib.sha256(expected).digest(), relative


def main():
    with tempfile.TemporaryDirectory(prefix='sa-config-e2e-') as temporary:
        root = Path(temporary) / 'project'
        shutil.copytree(SOURCE, root, ignore=shutil.ignore_patterns('.git', '__pycache__', 'out', '.config-migration-state.json'))
        # 构包清单需要 Git 修订号；只在临时副本建立空提交，不接触真实仓库。
        subprocess.run(['git', 'init', '-q', str(root)], check=True)
        subprocess.run(['git', '-C', str(root), '-c', 'user.name=Config E2E',
                        '-c', 'user.email=config-e2e@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'test fixture'], check=True)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        server = subprocess.Popen([sys.executable, str(root / 'tools' / 'serve.py'), str(port)],
                                  cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError('临时服务提前退出')
                try:
                    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=1)
                    connection.request('GET', '/__config/list')
                    response = connection.getresponse()
                    response.read()
                    connection.close()
                    if response.status == 200:
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise TimeoutError('临时服务未启动')
            check(root, port)
            package_check(root, Path(temporary) / 'release')
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
    print('正式配置六域保存、失败不写盘、旧缓存迁移、发行包同字节：通过')


if __name__ == '__main__':
    main()
