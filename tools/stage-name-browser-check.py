"""在隔离配置和浏览器中验证新版工作台的关卡名、车名保存与游戏显示。"""
import json
import pathlib
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
from unittest.mock import patch

import serve
from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent


class IsolatedHandler(serve.NoCache):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        if path.split('?')[0] == '/config/stage-cars.json':
            return serve.STAGE_CARS_FILE
        return super().translate_path(path)

    def log_message(self, *_args):
        pass


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(result['exceptionDetails'])
    return result['result'].get('value')


def wait(cdp, expression):
    for _ in range(200):
        try:
            if evaluate(cdp, expression):
                return
        except RuntimeError:
            pass
        time.sleep(.1)
    raise AssertionError(f'页面状态超时：{expression}')


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='stage-name-', ignore_cleanup_errors=True) as directory:
        cars = pathlib.Path(directory, 'stage-cars.json')
        cars.write_bytes((ROOT / 'config/stage-cars.json').read_bytes())
        with patch.object(serve, 'STAGE_CARS_FILE', str(cars)):
            server = serve.http.server.ThreadingHTTPServer(('127.0.0.1', 0), IsolatedHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                debug = sock.getsockname()[1]
            browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
                '--remote-allow-origins=*', f'--remote-debugging-port={debug}',
                f'--user-data-dir={directory}/chrome'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(120):
                    try:
                        pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug}/json', timeout=1))
                        page = next(item for item in pages if item.get('type') == 'page')
                        break
                    except Exception:
                        time.sleep(.1)
                else:
                    raise AssertionError('隔离 Chrome 启动失败')
                cdp = CDP(page['webSocketDebuggerUrl'])
                base = f'http://127.0.0.1:{server.server_port}'
                cdp.call('Page.navigate', {'url': base + '/tools/console.html#/stage/0,1/text'})
                wait(cdp, 'document.querySelectorAll(".stage-body .fgrid label.field input").length >= 3')
                evaluate(cdp, '''(()=>{
                  const labels=[...document.querySelectorAll('.stage-body label.field')];
                  for(const [label,value] of [['关卡名','测试关卡名'],['车名','测试车辆名']]){
                    const input=labels.find(n=>n.textContent.includes(label))?.querySelector('input');
                    if(!input)throw new Error(label+'输入框不存在');
                    input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
                  }
                  document.querySelector('.stage-head button[title^="保存全部"]')?.click();
                })()''')
                wait(cdp, 'document.querySelector("#status")?.dataset.state === "clean"')
                saved = json.loads(cars.read_text(encoding='utf-8'))['records']['0:1']
                assert (saved['name'], saved['vehicleName']) == ('测试关卡名', '测试车辆名'), saved
                # 旧浏览器快照必须不能覆盖已经写入正式配置的记录。
                evaluate(cdp, '''localStorage.setItem('steam_arena_stage_cars_local_v1',
                  JSON.stringify({version:1,records:{'0:1':{name:'旧名',vehicleName:'旧车'}}}))''')
                cdp.call('Page.navigate', {'url': base + '/index.html'})
                wait(cdp, '!!window.SA?.Arena?.open && !!SA.S?.d && !!SA.StageCars')
                result = evaluate(cdp, '''(()=>{
                  SA.S.d.camp.ch=0;SA.S.d.camp.st=1;SA.Arena.open();
                  return {name:SA.Camp.stage(0,1).name,vehicleName:SA.Camp.stage(0,1).vehicle.name,
                    title:document.querySelector('.ch-row[data-page-key="arena:camp:0,1"] .nm')?.textContent,
                    dossier:[...document.querySelectorAll('.ar-dossier .f')].find(n=>n.textContent.startsWith('座驾'))?.textContent};
                })()''')
                assert result == {'name': '测试关卡名', 'vehicleName': '测试车辆名',
                                  'title': '测试关卡名', 'dossier': '座驾测试车辆名'}, result
                cdp.close()
                return result
            finally:
                browser.terminate()
                browser.wait(timeout=10)
                server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
