"""隔离副本验证进化擂台的关卡车流程（2026-10-04 起只剩一种保存）：
勾掉 / 勾上「手动选择」只改这一关记录的 locked；重跑这关时手动选择的关卡车占席位并记成绩；
刷新不重复生成；点卡片展开候选，「换上这辆」把车交给后台关卡工作台当没保存的草稿。
原先测的「生成本关候选」交接已随按钮删除。"""
import json
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parents[1]
FRAME = 'document.querySelector(".frame-wrap iframe")'
DOC = f'{FRAME}?.contentWindow?.document'
CARD = DOC + '?.querySelector(\'.pk[data-stage="0,2"]\')'


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(str(result['exceptionDetails']))
    return result['result'].get('value')


def wait(cdp, expression, tries=300):
    for _ in range(tries):
        try:
            if evaluate(cdp, expression):
                return
        except RuntimeError:
            pass
        time.sleep(.2)
    raise AssertionError(f'等待页面状态超时：{expression}')


def request(port, endpoint, data=None):
    url = f'http://127.0.0.1:{port}/__evolve/{endpoint}'
    payload = None if data is None else json.dumps(data).encode('utf-8')
    with urllib.request.urlopen(urllib.request.Request(url, payload, {'Content-Type': 'application/json'} if payload else {}), timeout=30) as response:
        return json.load(response)


def sorted_cells(cells):
    return sorted(json.dumps(cell) for cell in cells)


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='evolve-route-browser-', ignore_cleanup_errors=True) as directory:
        target = pathlib.Path(directory)
        # 服务和 Chrome 只接触隔离副本；正式 config 与 tools/out 不会被写入。
        for name in ('js', 'config', 'tools'):
            shutil.copytree(ROOT / name, target / name, ignore=shutil.ignore_patterns('out', '__pycache__', '*.pyc'))
        settings = target / 'tools' / 'evolve-config.js'
        settings.write_text(settings.read_text(encoding='utf-8').replace('size: 24,', 'size: 4,')
                            .replace('generations: 4,', 'generations: 1,').replace('quickGames: 6,', 'quickGames: 1,'), encoding='utf-8')
        # Windows 上默认监听队列只有 5，后台首屏的并发请求会被拒；只在副本里调大（同 stage-workbench-browser-check.py）
        serve = target / 'tools' / 'serve.py'
        serve.write_text(serve.read_text(encoding='utf-8').replace(
            "http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache)",
            "type('QueuedServer', (http.server.ThreadingHTTPServer,), {'request_queue_size': 64})(('127.0.0.1', port), NoCache)"), encoding='utf-8')
        stage_file = target / 'config' / 'stage-cars.json'
        records = lambda: json.loads(stage_file.read_text(encoding='utf-8'))['records']
        original = records()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        debug = port + 10000 if port < 55000 else port - 10000
        server = subprocess.Popen([sys.executable, str(serve), str(port)], cwd=target,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                                    '--remote-allow-origins=*', f'--remote-debugging-port={debug}',
                                    f'--user-data-dir={target / "chrome"}', '--window-size=1440,900'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug}/json', timeout=1))
                    page = next(item for item in pages if item.get('type') == 'page')
                    break
                except (OSError, StopIteration):
                    time.sleep(.1)
            else:
                raise AssertionError('隔离浏览器未启动')
            cdp = CDP(page['webSocketDebuggerUrl'])
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{port}/tools/console.html#/open/evolve'})
            frame_ready = f'!!{DOC}?.querySelector("#run-chapter option") && !!{CARD}?.querySelector(".pin input") && !{DOC}.querySelector("#generate").disabled'
            wait(cdp, frame_ready)
            assert original['0:2'].get('locked') is not False, '夹具：0:2 应勾着手动选择'
            assert evaluate(cdp, f'{CARD}.querySelector(".pin input").checked')

            # 1. 勾掉 / 勾上「手动选择」：只改 0:2 的 locked，别的关和别的字段原样
            evaluate(cdp, f'{CARD}.querySelector(".pin input").click()')
            for _ in range(100):
                if records()['0:2'].get('locked') is False:
                    break
                time.sleep(.1)
            else:
                raise AssertionError('勾掉手动选择没有写进关卡配置')
            changed = records()
            assert {k: v for k, v in changed['0:2'].items() if k != 'locked'} == {k: v for k, v in original['0:2'].items() if k != 'locked'}
            assert all(changed[key] == original[key] for key in original if key != '0:2'), '改到了别的关'
            wait(cdp, f'!{CARD}.querySelector(".pin input").checked && {CARD}.querySelector(".verdict").textContent !== "待重新模拟"')
            evaluate(cdp, f'{CARD}.querySelector(".pin input").click()')
            for _ in range(100):
                if records()['0:2'].get('locked') is True:
                    break
                time.sleep(.1)
            else:
                raise AssertionError('重新勾上手动选择没有写进关卡配置')
            wait(cdp, f'{CARD}.querySelector(".pin input").checked')

            # 2. 卡片上「重跑」只设好范围；开跑后手动选择的关卡车占席位、成绩记在报告和卡片上
            evaluate(cdp, f'{CARD}.querySelector(".aim").click()')
            assert evaluate(cdp, f'{DOC}.querySelector("#run-chapter").value + "," + {DOC}.querySelector("#run-stage").value') == '0,2'
            evaluate(cdp, f'{DOC}.querySelector("#generate").click()')
            wait(cdp, f'{DOC}.querySelector("#generation-status").textContent.startsWith("生成完成")', tries=1500)
            job_id = request(port, 'job')['id']
            name = original['0:2'].get('vehicleName') or original['0:2']['name']
            wait(cdp, f'{CARD}?.querySelector(".who")?.textContent.includes({json.dumps(name)}) && /\\d/.test({CARD}.querySelector(".pk-num b").textContent)')
            report = json.loads(max((target / 'tools' / 'out').glob('evolve-*.json'), key=lambda p: p.stat().st_mtime).read_text(encoding='utf-8'))
            stage = next(s for ch in report['chapters'] if ch['chapter'] == 0 for s in ch['stages'] if s['spec']['stage'] == 2)
            assert stage['manual']['pinned'] and sorted_cells(stage['manual']['cells']) == sorted_cells(original['0:2']['cells'])
            assert stage['manual']['evidence']['previousGames'] > 0, '没有和上一关车复测'

            # 3. 刷新嵌入页只读结果，不再发起生成
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            time.sleep(.5)
            assert request(port, 'job')['id'] == job_id

            # 4. 点卡片展开候选；「换上这辆」把车交给关卡工作台当草稿（没保存，关卡配置不变）
            evaluate(cdp, f'{CARD}.querySelector(".pk-nums").dispatchEvent(new ({FRAME}.contentWindow.MouseEvent)("click", {{ bubbles: true }}))')
            wait(cdp, f'!!{DOC}.querySelector("#grid .cand:not(.stagecar) .cand-btns .btn.primary")')
            assert evaluate(cdp, f'{DOC}.querySelector("#grid .cand.stagecar .nm").textContent') == name, '展开的候选第一张不是关卡车'
            pick = evaluate(cdp, f'{DOC}.querySelector("#grid .cand:not(.stagecar) .nm").textContent')
            evaluate(cdp, f'{DOC}.querySelector("#grid .cand:not(.stagecar) .cand-btns .btn.primary").click()')
            garage = 'document.querySelector("#garage-layer iframe")?.contentWindow?.Garage'
            wait(cdp, f'location.hash === "#/stage/0,2/build" && {garage}?.info()?.target?.id === "0,2" && document.querySelector(".build-bar .chip.edited")?.textContent.includes("车改了")')
            cells = evaluate(cdp, f'JSON.stringify({garage}.info().cells)')
            expected = next(rec for rec in stage['top'] if rec['name'] == pick)
            assert sorted_cells(json.loads(cells)) == sorted_cells(expected['cells']), '换上的不是点的那辆'
            assert not evaluate(cdp, '!!sessionStorage.getItem("steam_arena_stage_swap")'), '交接没用掉'
            bar = evaluate(cdp, '[...document.querySelectorAll(".build-bar button, .build-bar a")].map(b => b.textContent).join("|")')
            assert '存到进化擂台' not in bar and '生成本关候选' not in bar, '拼装工具条上还有旧的保存方式'
            assert records()['0:2']['cells'] == original['0:2']['cells'], '没点保存就改了关卡车'
            cdp.close()
            return {'pinToggle': True, 'pinnedSeat': stage['manual']['name'], 'job': job_id, 'refreshDidNotRestart': True,
                    'drawer': True, 'swapDraft': pick, 'formalUnchanged': True}
        finally:
            browser.terminate()
            server.terminate()
            browser.wait(timeout=10)
            server.wait(timeout=10)


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
