"""隔离副本验证工作台交接、忙碌保留及刷新不重复生成。"""
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


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(str(result['exceptionDetails']))
    return result['result'].get('value')


def wait(cdp, expression, tries=150):
    for _ in range(tries):
        if evaluate(cdp, expression):
            return
        time.sleep(.2)
    raise AssertionError(f'等待页面状态超时：{expression}')


def request(port, endpoint, data=None):
    url = f'http://127.0.0.1:{port}/__evolve/{endpoint}'
    payload = None if data is None else json.dumps(data).encode('utf-8')
    with urllib.request.urlopen(urllib.request.Request(url, payload, {'Content-Type': 'application/json'} if payload else {}), timeout=30) as response:
        return json.load(response)


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
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        debug = port + 10000 if port < 55000 else port - 10000
        server = subprocess.Popen([sys.executable, str(target / 'tools' / 'serve.py'), str(port)], cwd=target,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                                    '--remote-allow-origins=*', f'--remote-debugging-port={debug}',
                                    f'--user-data-dir={target / "chrome"}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            url = f'http://127.0.0.1:{port}/tools/console.html'
            cdp.call('Page.navigate', {'url': url + '#/open/evolve'})
            frame_ready = '!!document.querySelector(".frame-wrap iframe")?.contentWindow?.document?.querySelector("#run-chapter option")'
            wait(cdp, frame_ready)
            evaluate(cdp, 'location.hash="#/stage/0,2/build"')
            button = '[...document.querySelectorAll(".build-bar button")].find(x=>x.textContent.includes("生成本关候选"))'
            wait(cdp, f'!!document.querySelector("#garage-layer iframe")?.contentWindow?.Garage?.ready && !!{button}')
            # 铭牌只改工作台草稿，不保存；交接必须读取此刻 iframe 的 live 车辆。
            evaluate(cdp, '(()=>{const n=document.querySelector(".build-bar input.name");n.value="未保存原点车";n.dispatchEvent(new Event("input",{bubbles:true}));return true})()')
            live_car = json.loads(evaluate(cdp, 'JSON.stringify(document.querySelector("#garage-layer iframe").contentWindow.Garage.info())'))
            assert live_car['name'] == '未保存原点车'
            busy = request(port, 'run', {'scope': {'chapter': 0, 'stage': 0}, 'population': 24,
                                         'generations': 4, 'games': 6, 'workers': 1, 'seed': 3456})
            evaluate(cdp, f'{button}.click()')
            wait(cdp, 'location.hash==="#/open/evolve" && !!JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")||"null")?.waiting')
            handoff_record = json.loads(evaluate(cdp, 'sessionStorage.getItem("steam_arena_evolve_handoff")'))
            assert handoff_record['originVehicle'] == {'name': live_car['name'], 'cells': live_car['cells']}
            assert not evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).running || false')
            assert request(port, 'job')['id'] == busy['id']
            request(port, 'stop', {})
            wait(cdp, '!!document.querySelector(".frame-wrap iframe")?.contentWindow?.document?.querySelector("#generate:not([disabled])")')
            evaluate(cdp, 'document.querySelector(".frame-wrap iframe").contentWindow.document.querySelector("#generate").click()')
            wait(cdp, '!!JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")||"null")?.jobId')
            job_id = evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId')
            assert json.loads(evaluate(cdp, 'sessionStorage.getItem("steam_arena_evolve_handoff")'))['request']['originVehicle'] == {'name': live_car['name'], 'cells': live_car['cells']}
            # 控制台之前已经开过进化页；重载同一嵌入页不能再次 POST。
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            assert evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId') == job_id
            assert request(port, 'job')['id'] == job_id
            # 模拟刷新后恢复了属于任务 A 的请求，而当前服务运行任务 B。
            evaluate(cdp, '(()=>{let h=JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff"));h.jobId="other-job";sessionStorage.setItem("steam_arena_evolve_handoff",JSON.stringify(h));return true})()')
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            for _ in range(300):
                if request(port, 'job')['status'] != 'running':
                    break
                time.sleep(.2)
            else:
                raise AssertionError('隔离任务未结束')
            wait(cdp, 'document.querySelector(".frame-wrap iframe")?.contentWindow?.document?.querySelector("#picks")?.textContent.includes("未保存原点车")')
            assert evaluate(cdp, 'document.querySelector(".frame-wrap iframe").contentWindow.document.querySelector("#picks").textContent.includes("对原点车胜率")')
            wait(cdp, 'document.querySelector(".frame-wrap iframe")?.contentWindow?.document?.querySelector("#generate:not([disabled])")?.textContent==="启动待生成"')
            assert evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId') == 'other-job'
            assert request(port, 'job')['id'] == job_id
            # 已接受任务完成后刷新，只读取结果；不能再 POST 一次。
            evaluate(cdp, f'(()=>{{let h=JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff"));h.jobId="{job_id}";sessionStorage.setItem("steam_arena_evolve_handoff",JSON.stringify(h));return true}})()')
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            wait(cdp, '!sessionStorage.getItem("steam_arena_evolve_handoff")')
            assert request(port, 'job')['id'] == job_id
            # 接受后失败和取消也只能显式重试，刷新不得重复 POST。
            failed_record = json.loads(json.dumps({key: value for key, value in handoff_record.items() if key in ('chapter', 'stage', 'originVehicle')}))
            failed_record['originVehicle']['cells'].append([0, 0, 0, 'invalid-module', 1, 0])
            evaluate(cdp, f'sessionStorage.setItem("steam_arena_evolve_handoff", {json.dumps(json.dumps(failed_record))})')
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, '!!JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")||"null")?.jobId')
            failed_id = evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId')
            wait(cdp, f'document.querySelector(".frame-wrap iframe")?.contentWindow?.document?.querySelector("#generation-status")?.textContent.includes("生成失败")')
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            time.sleep(.5)
            assert request(port, 'job')['id'] == failed_id
            assert evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId') == failed_id
            cancel_record = {key: value for key, value in handoff_record.items() if key in ('chapter', 'stage', 'originVehicle')}
            evaluate(cdp, f'sessionStorage.setItem("steam_arena_evolve_handoff", {json.dumps(json.dumps(cancel_record))})')
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, '!!JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")||"null")?.jobId')
            cancelled_id = evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId')
            request(port, 'stop', {})
            evaluate(cdp, 'document.querySelector(".frame-bar button[title*=重新载入]").click()')
            wait(cdp, frame_ready)
            time.sleep(.5)
            assert request(port, 'job')['id'] == cancelled_id
            assert evaluate(cdp, 'JSON.parse(sessionStorage.getItem("steam_arena_evolve_handoff")).jobId') == cancelled_id
            cdp.close()
            return {'busyJob': busy['id'], 'handoffJob': job_id, 'refreshDidNotRestart': True,
                    'differentJobKeptPending': True, 'terminalRefreshDidNotRestart': True,
                    'failedRefreshDidNotRestart': True, 'cancelledRefreshDidNotRestart': True}
        finally:
            browser.terminate()
            server.terminate()
            browser.wait(timeout=10)
            server.wait(timeout=10)


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
