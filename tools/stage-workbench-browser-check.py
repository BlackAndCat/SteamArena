"""隔离 Chrome 检查新版控制台拼装台：模块、搜索、画布和切关草稿。"""
import http.server
import json
import pathlib
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request

from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent
CODE = 'SA2.eyJuIjoi5L+d5bqV5YCZ6YCJwrcyLTTCt+WPmOW8gjkwNzM5IiwiYiI6W1s4LDMsNF0sWzksMiwxNl0sWzksNSwyMF0sWzEwLDIsMF1dLCJzIjpbXSwiYSI6MiwicHYiOjIsIm1zIjpbXX0='


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        self.send_response(403)
        self.end_headers()

    def log_message(self, *_args):
        pass


class Server(http.server.ThreadingHTTPServer):
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
    server = Server(('127.0.0.1', 0), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='stage-workbench-') as directory:
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
            cdp.call('Page.enable', {})
            cdp.call('Runtime.enable', {})
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source':
                'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));'})
            results = {}
            for width, height in ((1280, 800), (1920, 1080)):
                cdp.call('Emulation.setDeviceMetricsOverride', {
                    'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False})
                url = f'http://127.0.0.1:{server.server_port}/tools/console.html#/stage/1,4/build'
                cdp.call('Page.navigate', {'url': url})
                frame = 'document.querySelector("#garage-layer iframe")'
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,4" && '
                          f'!!{frame}.contentDocument.querySelector(".garage-search input")')
                time.sleep(.25)
                before = evaluate(cdp, f'''(()=>{{
                  const w={frame}.contentWindow, d={frame}.contentDocument;
                  const canvas=d.querySelector('.ed-stage canvas'), rect=canvas.getBoundingClientRect();
                  const rows=[...d.querySelectorAll('.panel-list .mrow')];
                  const ids=[...new Set(rows.map(row=>w.SA.parseKey(row.dataset.pageKey.replace(/^inventory:/,'')).id))];
                  const search=d.querySelector('.garage-search input');
                  search.value='mg_heavy';search.dispatchEvent(new Event('input',{{bubbles:true}}));
                  const found=[...d.querySelectorAll('.panel-list .mrow:not([hidden])')]
                    .map(row=>w.SA.parseKey(row.dataset.pageKey.replace(/^inventory:/,'')).id);
                  search.value='';search.dispatchEvent(new Event('input',{{bubbles:true}}));
                  return {{width:rect.width,height:rect.height,ids:ids.length,
                    expected:Object.values(w.SA.MODULES).filter(m=>!m.retired).length,found,
                    errors:[...__errors,...(w.__errors||[])]}};
                }})()''')
                assert before['width'] > 300 and before['height'] > 200, before
                assert before['ids'] == before['expected'], before
                assert before['found'] and set(before['found']) == {'mg_heavy'}, before
                assert not before['errors'], before
                result = evaluate(cdp, f'''(()=>{{
                  const w={frame}.contentWindow;
                  w.Garage.importText({json.dumps(CODE)},'四件回归车');
                  const s=w.Garage.stats();
                  return {{count:w.Garage.info().cells.length,canDeploy:s.canDeploy}};
                }})()''')
                assert result == {'count': 4, 'canDeploy': True}, result
                evaluate(cdp, '(location.hash="#/stage/1,3/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,3"')
                evaluate(cdp, '(location.hash="#/stage/1,4/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,4"')
                time.sleep(.3)
                returned = evaluate(cdp, f'''(()=>{{const w={frame}.contentWindow;
                  return {{count:w.Garage.info().cells.length,errors:[...__errors,...(w.__errors||[])]}};}})()''')
                assert returned == {'count': 4, 'errors': []}, returned
                # 走编辑器原有右键拆卸入口，验证 SA.S.save 事件把普通改装同步成父页草稿。
                edited = evaluate(cdp, f'''(()=>{{
                  const w={frame}.contentWindow,d={frame}.contentDocument;
                  const cv=d.querySelector('.ed-stage canvas'),rc=cv.getBoundingClientRect();
                  const C=w.SA.K.CELL,px=w.SA.SPR.PADX,W=w.SA.K.COLS*C+px*2,H=w.SA.K.ROWS*C+12;
                  d.dispatchEvent(new KeyboardEvent('keydown',{{key:'Escape',bubbles:true}}));
                  let point=null;
                  for(let r=0;r<w.SA.K.ROWS && !point;r++)for(let c=0;c<w.SA.K.COLS;c++){{
                    const x=rc.left+(px+(c+.5)*C)/W*rc.width;
                    const y=rc.top+((r+.5)*C)/H*rc.height;
                    cv.dispatchEvent(new MouseEvent('contextmenu',{{bubbles:true,cancelable:true,button:2,clientX:x,clientY:y}}));
                    if(w.Garage.info().cells.length<4){{point=[x,y];break;}}
                  }}
                  return {{before:4,after:w.Garage.info().cells.length,point}};
                }})()''')
                assert edited['after'] == 3, edited
                wait(cdp, 'document.querySelector("#status")?.dataset.state === "dirty"')
                evaluate(cdp, '(location.hash="#/stage/1,3/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,3"')
                evaluate(cdp, '(location.hash="#/stage/1,4/build",true)')
                wait(cdp, f'{frame}?.contentWindow?.Garage?.info()?.target?.id === "1,4"')
                assert evaluate(cdp, f'{frame}.contentWindow.Garage.info().cells.length') == 3, edited
                results[f'{width}x{height}'] = {'modules': before['ids'], 'canvas': [before['width'], before['height']],
                    'imported': result, 'returned': returned['count'], 'afterEditorRemove': edited['after']}
            cdp.close()
            return results
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
