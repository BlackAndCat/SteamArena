"""用隔离配置和浏览器验证控制台两个新关入口及保存刷新。"""
import json
import pathlib
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request
from unittest.mock import patch

import serve
from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parents[1]
# 关卡工作台第一章的「＋ 补上 / 新建 1-4」行
ADD_SLOT = 'aside.tree .st-add[data-slot="1,3"]'


class IsolatedHandler(serve.NoCache):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        if path.split('?')[0] == '/config/content.json':
            return serve.CONTENT_FILE
        if path.split('?')[0] == '/config/stage-cars.json':
            return serve.STAGE_CARS_FILE
        return super().translate_path(path)

    def log_message(self, *_args):
        pass


class Server(serve.http.server.ThreadingHTTPServer):
    # 默认监听队列只有 5：Windows 上 Chrome 一次开的连接多于 5 时会被直接拒绝，后台首屏的同步配置请求随之失败
    request_queue_size = 64


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(result['exceptionDetails'])
    return result['result']['value']


def wait(cdp, expression, tries=120):
    for _ in range(tries):
        if evaluate(cdp, expression):
            return
        time.sleep(.1)
    raise AssertionError(f'等待页面状态超时：{expression}')


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='stage-create-') as directory:
        content_file = pathlib.Path(directory, 'content.json')
        cars_file = pathlib.Path(directory, 'stage-cars.json')
        rules_file = pathlib.Path(directory, 'evolve-stage-rules.json')
        content_file.write_bytes((ROOT / 'config/content.json').read_bytes())
        cars_file.write_bytes((ROOT / 'config/stage-cars.json').read_bytes())
        rules_file.write_bytes((ROOT / 'tools/evolve-stage-rules.json').read_bytes())
        before = (content_file.read_bytes(), cars_file.read_bytes())
        # 新建关卡同时写逐关预算表，也换成临时副本
        with patch.object(serve, 'CONTENT_FILE', str(content_file)), patch.object(serve, 'STAGE_CARS_FILE', str(cars_file)), \
                patch.object(serve, 'STAGE_RULES_FILE', str(rules_file)):
            server = Server(('127.0.0.1', 0), IsolatedHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                '--remote-allow-origins=*', f'--remote-debugging-port={19000 + server.server_port % 20000}',
                f'--user-data-dir={directory}/chrome'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                port = 19000 + server.server_port % 20000
                for _ in range(60):
                    try:
                        page = next(item for item in json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1)) if item.get('type') == 'page')
                        break
                    except Exception:
                        time.sleep(.1)
                else:
                    raise AssertionError('隔离浏览器未启动')
                cdp = CDP(page['webSocketDebuggerUrl'])
                url = f'http://127.0.0.1:{server.server_port}/tools/console.html'
                cdp.call('Page.navigate', {'url': url + '#/stage/1,2/build'})
                wait(cdp, f'!!document.querySelector({json.dumps(ADD_SLOT)}) && !!window.SA?.CAMPAIGN')
                evaluate(cdp, f'(document.querySelector({json.dumps(ADD_SLOT)}).click(), true)')
                wait(cdp, 'location.hash.includes("stage/1,3") && !!ConsoleNewStage.get(1,3)')
                first = evaluate(cdp, 'JSON.stringify(ConsoleNewStage.get(1,3), (k,v) => k === "vehicle" ? undefined : v)')
                assert (content_file.read_bytes(), cars_file.read_bytes()) == before
                assert evaluate(cdp, '!!document.querySelector("#garage-layer iframe")')
                # 重载丢弃首个未保存草稿，确认新增本身不会落盘。
                cdp.call('Page.navigate', {'url': url + '?mapcheck=1#/map'})
                wait(cdp, "!!document.querySelector(\".mnode[data-id='1-6']\")")
                evaluate(cdp, "(document.querySelector(\".mnode[data-id='1-6']\").dispatchEvent(new PointerEvent('pointerenter', {bubbles:true})), true)")
                wait(cdp, '!!document.querySelector(".mcard:not([hidden]) button.mc-car.none")')
                evaluate(cdp, '(document.querySelector(".mcard button.mc-car.none").click(), true)')
                wait(cdp, 'location.hash.includes("stage/1,5") && !!ConsoleNewStage.get(1,5)')
                second = evaluate(cdp, 'JSON.stringify(ConsoleNewStage.get(1,5), (k,v) => k === "vehicle" ? undefined : v)')
                assert (content_file.read_bytes(), cars_file.read_bytes()) == before
                # 默认值照设计稿同一位置：1-4 大铁壶「平地 · 龟缩」，1-6 独角兽「平地 · 冲锋」；考题拆成赛前介绍和线人手写
                first_draft, second_draft = json.loads(first), json.loads(second)
                assert (first_draft['name'], first_draft['terrain'], first_draft['style']) == ('大铁壶', 'flat', 'turtle'), first
                assert (second_draft['name'], second_draft['terrain'], second_draft['style']) == ('独角兽', 'flat', 'rush'), second
                assert all(d['blurb'] and d['weakness'] and d['spec']['lesson'] and d['prize'] > 0 and 0 < d['aim'] < 1 for d in (first_draft, second_draft))
                wait(cdp, '!!document.querySelector("#garage-layer iframe")?.contentWindow?.Garage?.ready')
                evaluate(cdp, '(document.querySelector("button#status").click(), true)')
                for _ in range(300):
                    if '1:5' in json.loads(cars_file.read_text(encoding='utf-8'))['records']:
                        break
                    time.sleep(.1)
                else:
                    detail = evaluate(cdp, 'JSON.stringify({hash:location.hash,status:document.querySelector("#status")?.title,toast:document.querySelector(".toast")?.textContent,garage:!!document.querySelector("#garage-layer iframe")?.contentWindow?.Garage})')
                    raise AssertionError(f'地图入口保存未写入隔离配置：{detail}')
                try:
                    wait(cdp, '!!window.SA?.CAMPAIGN?.[1]?.stages?.[5]?.vehicle')
                except AssertionError:
                    detail = evaluate(cdp, 'JSON.stringify({hash:location.hash,stage:SA.CAMPAIGN[1]?.stages[5],error:window.SA_CONFIG_ERROR,status:document.querySelector("#status")?.title,toast:document.querySelector("#toast")?.textContent,app:document.querySelector("#app")?.textContent.slice(0,80)})')
                    raise AssertionError(f'刷新后未载入新关：{detail}')
                assert evaluate(cdp, '!!SA.CAMPAIGN[1].stages[3]?.unfinished && !!SA.CAMPAIGN[1].stages[4]?.unfinished'), evaluate(cdp, 'JSON.stringify(SA.CAMPAIGN[1].stages.map(s=>({ref:s.stageRef,unfinished:s.unfinished})))')
                wait(cdp, '!!document.querySelector("#garage-layer iframe")?.contentWindow?.SA?.Camp')
                assert evaluate(cdp, 'document.querySelector("#garage-layer iframe").contentWindow.SA.Camp.frontier().ch === 1 && document.querySelector("#garage-layer iframe").contentWindow.SA.Camp.frontier().st === 3')
                # 同一页保留两个草稿，一次保存应按原编号分别建立两关。
                cdp.call('Page.navigate', {'url': url + '?multicheck=1#/stage/1,2/build'})
                wait(cdp, f'!!document.querySelector({json.dumps(ADD_SLOT)}) && !!window.SA?.CAMPAIGN')
                evaluate(cdp, f'(document.querySelector({json.dumps(ADD_SLOT)}).click(), true)')
                wait(cdp, 'location.hash.includes("stage/1,3") && !!ConsoleNewStage.get(1,3)')
                evaluate(cdp, '(location.hash="#/map", true)')
                wait(cdp, "!!document.querySelector(\".mnode[data-id='1-7']\")")
                evaluate(cdp, "(document.querySelector(\".mnode[data-id='1-7']\").dispatchEvent(new PointerEvent('pointerenter', {bubbles:true})), true)")
                wait(cdp, '!!document.querySelector(".mcard:not([hidden]) button.mc-car.none")')
                evaluate(cdp, '(document.querySelector(".mcard button.mc-car.none").click(), true)')
                wait(cdp, 'location.hash.includes("stage/1,6") && !!ConsoleNewStage.get(1,6)')
                evaluate(cdp, '(document.querySelector("button#status").click(), true)')
                for _ in range(300):
                    records = json.loads(cars_file.read_text(encoding='utf-8'))['records']
                    if '1:3' in records and '1:6' in records:
                        break
                    time.sleep(.1)
                else:
                    detail = evaluate(cdp, 'JSON.stringify({hash:location.hash,status:document.querySelector("#status")?.title,toast:document.querySelector("#toast")?.textContent,drafts:[...(window.ConsoleNewStage ? [[1,3],[1,6]].map(([c,s]) => !!ConsoleNewStage.get(c,s)) : [])]})')
                    raise AssertionError(f'连续草稿保存未完整写入隔离配置：{detail}')
                wait(cdp, '!!window.SA?.CAMPAIGN?.[1]?.stages?.[6]?.vehicle')
                assert evaluate(cdp, 'SA.CAMPAIGN[1].stages[3].vehicle && SA.CAMPAIGN[1].stages[4].unfinished && SA.CAMPAIGN[1].stages[5].vehicle && SA.CAMPAIGN[1].stages[6].vehicle')
                cdp.call('Page.navigate', {'url': url.replace('/tools/console.html', '/index.html') + '?gapcheck=1'})
                wait(cdp, '!!window.SA?.S?.arenaEntries && !!window.SA?.Camp?.frontier')
                assert evaluate(cdp, 'SA.Camp.stage(1,4) === null && SA.Camp.frontier().ch === 1 && SA.Camp.frontier().st === 4')
                assert evaluate(cdp, '!SA.S.arenaEntries("camp").some(x => x.key === "1,4")')
                cdp.call('Page.navigate', {'url': url.replace('console.html', 'sim.html') + '?embedded=1&gapcheck=1'})
                try:
                    wait(cdp, '!!document.querySelector("#run-camp") && !!window.SA?.CAMPAIGN')
                except AssertionError:
                    raise AssertionError('模拟页未载入：' + evaluate(cdp, 'JSON.stringify({url:location.href,title:document.title,body:document.body?.textContent.slice(0,160),config:window.SA_CONFIG_ERROR,sa:!!window.SA})'))
                evaluate(cdp, '(document.querySelector("#games").value=2, document.querySelector("#run-camp").click(), true)')
                wait(cdp, 'document.querySelector("#out h2")?.textContent === "战役关卡检验"', tries=600)
                assert evaluate(cdp, 'document.querySelector("#out table").rows.length === 10 && !/NaN|Infinity/.test(document.querySelector("#out").textContent)'), evaluate(cdp, 'JSON.stringify({rows:document.querySelector("#out table").rows.length,text:document.querySelector("#out").textContent.slice(0,500)})')
                cdp.close()
                rules = json.loads(rules_file.read_text(encoding='utf-8'))
                assert [(r['chapter'], r['stage']) for r in rules][-3:] == [(1, 3), (1, 5), (1, 6)], rules
                assert json.loads(cars_file.read_text(encoding='utf-8'))['records']['1:5']['spec']['lesson']
                return {'workbenchDefault': json.loads(first)['name'], 'mapDefault': json.loads(second)['name'], 'savedSlots': ['1:5', '1:3', '1:6'],
                        'budgets': {f"{r['chapter']}:{r['stage']}": r['budget'] for r in rules[-3:]}}
            finally:
                browser.terminate()
                browser.wait(timeout=10)
                server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
