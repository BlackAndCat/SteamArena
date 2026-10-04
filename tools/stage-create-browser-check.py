"""隔离浏览器验证两个新关草稿的槽位、车辆及定向保存互不串写。"""
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


ROOT = pathlib.Path(__file__).resolve().parents[1]
CODE = 'SA2.eyJuIjoi5L+d5bqV5YCZ6YCJwrcyLTTCt+WPmOW8gjkwNzM5IiwiYiI6W1s4LDMsNF0sWzksMiwxNl0sWzksNSwyMF0sWzEwLDIsMF1dLCJzIjpbXSwiYSI6MiwicHYiOjIsIm1zIjpbXX0='


class IsolatedHandler(serve.NoCache):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        file = path.split('?')[0]
        if file == '/config/content.json':
            return serve.CONTENT_FILE
        if file == '/config/stage-cars.json':
            return serve.STAGE_CARS_FILE
        return super().translate_path(path)

    def log_message(self, *_args):
        pass


class Server(serve.http.server.ThreadingHTTPServer):
    request_queue_size = 64


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
    with tempfile.TemporaryDirectory(prefix='stage-create-', ignore_cleanup_errors=True) as directory:
        files = {}
        for key, source in {'content': 'config/content.json', 'cars': 'config/stage-cars.json',
                            'rules': 'tools/evolve-stage-rules.json'}.items():
            files[key] = pathlib.Path(directory, key + '.json')
            files[key].write_bytes((ROOT / source).read_bytes())
        original = tuple(path.read_bytes() for path in files.values())
        with patch.object(serve, 'CONTENT_FILE', str(files['content'])), \
                patch.object(serve, 'STAGE_CARS_FILE', str(files['cars'])), \
                patch.object(serve, 'STAGE_RULES_FILE', str(files['rules'])):
            server = Server(('127.0.0.1', 0), IsolatedHandler)
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
                        page = next(row for row in pages if row.get('type') == 'page')
                        break
                    except Exception:
                        time.sleep(.1)
                else:
                    raise AssertionError('隔离 Chrome 启动失败')
                cdp = CDP(page['webSocketDebuggerUrl'])
                url = f'http://127.0.0.1:{server.server_port}/tools/console.html'
                cdp.call('Page.navigate', {'url': url + '#/stage/1,4/build'})
                wait(cdp, '!!document.querySelector("aside.tree .st-add[data-slot=\'1,5\']")')
                evaluate(cdp, 'document.querySelector("aside.tree .st-add[data-slot=\'1,5\']").click()')
                frame = 'document.querySelector("#garage-layer iframe")'
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,5"')
                first = evaluate(cdp, f'''(()=>{{const G={frame}.contentWindow.Garage;
                  G.importText({json.dumps(CODE)},'草稿甲');
                  const name=document.querySelector('.build-bar input.name');
                  name.value='草稿甲';name.dispatchEvent(new Event('input',{{bubbles:true}}));
                  return G.info().cells;}})()''')
                assert len(first) == 4
                evaluate(cdp, '(location.hash="#/stage/1,4/build",true)')
                wait(cdp, '!!document.querySelector("aside.tree .st-add[data-slot=\'1,6\']")')
                evaluate(cdp, 'document.querySelector("aside.tree .st-add[data-slot=\'1,6\']").click()')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,6"')
                second = evaluate(cdp, f'''(()=>{{const G={frame}.contentWindow.Garage;
                  G.importText(JSON.stringify({{cells:{json.dumps(first[:3])}}}),'草稿乙');
                  const name=document.querySelector('.build-bar input.name');
                  name.value='草稿乙';name.dispatchEvent(new Event('input',{{bubbles:true}}));
                  return G.info().cells;}})()''')
                assert len(second) == 3 and second != first
                assert tuple(path.read_bytes() for path in files.values()) == original
                evaluate(cdp, '(location.hash="#/stage/1,5/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,5"')
                assert evaluate(cdp, f'{frame}.contentWindow.Garage.info().cells.length') == 4
                assert evaluate(cdp, f'{frame}.contentWindow.Garage.info().name') == '草稿甲'
                evaluate(cdp, '(location.hash="#/stage/1,6/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,6"')
                assert evaluate(cdp, f'{frame}.contentWindow.Garage.info().cells.length') == 3
                assert evaluate(cdp, f'{frame}.contentWindow.Garage.info().name') == '草稿乙'
                evaluate(cdp, '(location.hash="#/stage/1,5/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,5"')
                evaluate(cdp, f'''(()=>{{const w={frame}.contentWindow,original=w.fetch.bind(w);
                  w.fetch=(url,options)=>{{if(url!=='/__stage-cars/create')return original(url,options);
                    w.__submitted=JSON.parse(options.body);
                    return original(url,options).then(response=>new Promise(resolve=>{{w.__release=()=>resolve(response);}}));
                  }};
                }})()''')
                # 一次保存：甲车完整可登记，乙车少了底盘校验失败；页面不能重载丢掉乙草稿。
                evaluate(cdp, 'document.querySelector("#status").click()')
                wait(cdp, f'!!{frame}?.contentWindow?.__release')
                assert evaluate(cdp, f'{frame}.contentWindow.__submitted.record.vehicleName') == '草稿甲'
                # 请求提交 A 后、响应抵达前，继续编辑同一关为 B。
                evaluate(cdp, '''(()=>{const name=document.querySelector('.build-bar input.name');
                  name.value='草稿甲B';name.dispatchEvent(new Event('input',{bubbles:true}));})()''')
                evaluate(cdp, f'{frame}.contentWindow.__release()')
                for _ in range(200):
                    if '1:5' in json.loads(files['cars'].read_text(encoding='utf-8'))['records']:
                        break
                    time.sleep(.1)
                else:
                    raise AssertionError('甲关没有写入隔离配置')
                wait(cdp, 'document.querySelector("#status")?.dataset.state === "error"')
                time.sleep(.5)
                records = json.loads(files['cars'].read_text(encoding='utf-8'))['records']
                assert '1:5' in records and '1:6' not in records, records.keys()
                assert records['1:5']['vehicleName'] == '草稿甲'
                assert evaluate(cdp, '!!ConsoleNewStage.get(1,6)')
                assert not evaluate(cdp, '!!ConsoleNewStage.get(1,5)')
                assert evaluate(cdp, 'document.querySelector(".build-bar input.name")?.value') == '草稿甲B'
                # 再次保存必须走已存在关卡的更新协议，而非重复创建。
                evaluate(cdp, 'document.querySelector("#status").click()')
                for _ in range(200):
                    records = json.loads(files['cars'].read_text(encoding='utf-8'))['records']
                    if records['1:5']['vehicleName'] == '草稿甲B':
                        break
                    time.sleep(.1)
                else:
                    detail = evaluate(cdp, '''JSON.stringify({status:document.querySelector('#status')?.title,
                      toast:document.querySelector('#toast')?.textContent,hash:location.hash,
                      current:document.querySelector('#garage-layer iframe')?.contentWindow?.Garage?.info()?.target})''')
                    raise AssertionError(f'飞行期间的新修改未能作为既有关保存：{detail}')
                assert '1:6' not in records and evaluate(cdp, '!!ConsoleNewStage.get(1,6)')
                # 进化报告使用的候选路由只写同一候选 ID，不能落到关卡保存接口。
                candidate_id = evaluate(cdp, f'''(()=>{{const G={frame}.contentWindow.Garage;
                  const cells=G.info().cells,vehicle=SA.V.fromCells('候选甲',cells);
                  return SA.EvolveArena.remember({{name:'候选甲',cells,code:SA.V.encode(vehicle),
                    spec:{{chapter:1,stage:5,terrain:'flat'}},style:'rush'}},{{favorite:true}}).id;
                }})()''')
                stage_bytes = files['cars'].read_bytes()
                evaluate(cdp, f'(location.hash="#/candidate/{candidate_id}/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === {json.dumps(candidate_id)}')
                candidate = evaluate(cdp, f'''(()=>{{const G={frame}.contentWindow.Garage;
                  G.setName('候选改');
                  const row=G.saveCandidate({json.dumps(candidate_id)});
                  return {{id:row.id,name:row.record.name,favorite:row.favorite,
                    style:row.record.style,needsEvaluation:row.record.needsEvaluation}};
                }})()''')
                assert candidate == {'id': candidate_id, 'name': '候选改', 'favorite': True,
                                     'style': 'rush', 'needsEvaluation': True}, candidate
                assert files['cars'].read_bytes() == stage_bytes
                cdp.close()
                return {'drafts': ['1:5', '1:6'], 'cars': [len(first), len(second)],
                        'saved': '1:5', 'resavedName': records['1:5']['vehicleName'], 'candidate': candidate}
            finally:
                browser.terminate()
                browser.wait(timeout=10)
                server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
