"""只在临时项目副本验证逐关预算保存、并发保护、本机限制和运行目录读取。"""
import copy
import http.client
import json
import pathlib
import shutil
import sys
import tempfile
import threading
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import serve
from evolve_service import EvolutionService


def check():
    """保存现有关与空计划关，仅预算表变化；非法输入和冲突保持全部文件字节。"""
    source = pathlib.Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as directory:
        root = pathlib.Path(directory)
        for folder in ('config', 'js', 'tools'):
            destination = root / folder
            destination.mkdir()
            for path in (source / folder).iterdir():
                if path.is_file() and path.suffix in ('.js', '.json'):
                    shutil.copyfile(path, destination / path.name)
        content = root / 'config/content.json'
        cars = root / 'config/stage-cars.json'
        rules = root / 'tools/evolve-stage-rules.json'
        paths = (content, cars, rules)
        snapshot = lambda: tuple(path.read_bytes() for path in paths)
        original = snapshot()
        before = json.loads(original[2])
        budget = next(row['budget'] for row in before if (row['chapter'], row['stage']) == (0, 0))
        packet = {'chapter': 0, 'stage': 0, 'budget': budget + 1, 'expectedBudget': budget}
        with patch.object(serve, 'CONTENT_FILE', str(content)), patch.object(serve, 'STAGE_CARS_FILE', str(cars)), \
                patch.object(serve, 'STAGE_RULES_FILE', str(rules)):
            server = serve.http.server.ThreadingHTTPServer(('127.0.0.1', 0), serve.NoCache)
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()

            def request(payload, origin=None, route='/__evolve/budget/save'):
                """通过实际端点校验状态码，而非绕过 POST 路由和同源限制。"""
                connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
                headers = {'Content-Type': 'application/json',
                           'Origin': origin or f'http://127.0.0.1:{server.server_port}'}
                connection.request('POST', route, json.dumps(payload), headers)
                response = connection.getresponse()
                result = response.status, json.loads(response.read())
                connection.close()
                return result

            try:
                status, result = request(packet)
                assert status == 200 and result['ok'] and result['budget'] == budget + 1, result
                after = json.loads(rules.read_text(encoding='utf-8'))
                expected = copy.deepcopy(before)
                next(row for row in expected if (row['chapter'], row['stage']) == (0, 0))['budget'] = budget + 1
                assert after == expected
                assert [list(row) for row in after] == [list(row) for row in before]
                assert snapshot()[:2] == original[:2]
                saved = snapshot()
                status, result = request(packet)
                assert status == 409 and result['budget'] == budget + 1 and snapshot() == saved
                status, result = request({**packet, 'expectedBudget': budget + 1})
                assert status == 200 and snapshot() == saved, '同预算保存不得重写文件'
                for key, values in (('chapter', [True, -1, 1.5, '0', 999]),
                                    ('stage', [False, -1, 999]),
                                    ('budget', [True, 0, -1, 1.5, '361', None, float('inf'), 10 ** 400]),
                                    ('expectedBudget', [True, 0, -1, 1.5, '360'])):
                    for value in values:
                        status, _ = request({**packet, key: value})
                        assert status == 400 and snapshot() == saved, (key, value, status)
                status, _ = request({**packet, 'name': '不得覆盖其他字段'})
                assert status == 400 and snapshot() == saved
                status, _ = request(packet, origin='https://example.com')
                assert status == 403 and snapshot() == saved
                # 第一章计划尾关即使没有登记车，也能独立调预算。
                cars_data = json.loads(cars.read_text(encoding='utf-8'))
                cars_data['records'].pop('1:6', None)
                cars_data['targets'] = [key for key in cars_data['targets'] if key != '1:6']
                cars.write_text(json.dumps(cars_data), encoding='utf-8')
                old_tail = next(row['budget'] for row in before if (row['chapter'], row['stage']) == (1, 6))
                status, _ = request({'chapter': 1, 'stage': 6, 'budget': old_tail + 1, 'expectedBudget': old_tail})
                assert status == 200
                unchanged_cars = cars.read_bytes()
                # 第二章计划空关只登记预算，不能附赠旧表模块或奖励。
                missing = {'chapter': 2, 'stage': 0, 'budget': 1200, 'expectedBudget': None}
                status, result = request({**missing, 'expectedBudget': 1200})
                assert status == 409 and result['budget'] is None
                status, _ = request(missing)
                assert status == 200
                created = json.loads(rules.read_text(encoding='utf-8'))[-1]
                assert created == {'chapter': 2, 'stage': 0, 'name': '2:0', 'budget': 1200, 'status': 'draft', 'addMods': []}
                saved = snapshot()
                status, result = request(missing)
                assert status == 409 and result['budget'] == 1200 and snapshot() == saved
                assert cars.read_bytes() == unchanged_cars and content.read_bytes() == original[0]
                # 新 Node 目录读取实际保存的表，预算不依赖车或完整生成规格。
                catalog = EvolutionService(str(root)).catalog()
                budgets = {(row['chapter'], row['stage']): row['budget'] for row in catalog['budgets']}
                assert budgets[(0, 0)] == budget + 1 and budgets[(1, 6)] == old_tail + 1 and budgets[(2, 0)] == 1200
                first = catalog['chapters'][0]['stages'][0]
                assert first['budget'] == budget + 1
            finally:
                server.shutdown()
                server.server_close()
                server_thread.join(timeout=5)
    print('逐关预算保存、字段和顺序保护、幂等、计划空关、冲突、非法输入、同源限制及运行目录更新：通过')


if __name__ == '__main__':
    check()
