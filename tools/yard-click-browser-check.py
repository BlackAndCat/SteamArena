"""在隔离 Chrome 中用真实指针检查院子人物对话框与遮挡。"""
import http.server
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

sys.dont_write_bytecode = True
from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    """只提供本仓库静态文件，不接入用户浏览器或存档。"""

    def do_GET(self):
        if self.path.startswith('/__text/load'):
            body = json.dumps({'version': 1, 'game': 'steam-arena', 'locale': 'zh-CN',
                'values': {}, 'removedElements': []}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_args):
        pass


def run():
    """检查室外和室内各人物点击、关闭重开、编辑后的即时文本与 HTML 安全性。"""
    baseline = '--baseline' in sys.argv
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='yard-click-', ignore_cleanup_errors=True) as profile:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = 19000 + server.server_port % 20000
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--window-size=1600,900',
            f'--remote-debugging-port={port}', '--remote-allow-origins=*',
            f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(60):
                try:
                    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1))
                    page = next(item for item in pages if item.get('type') == 'page')
                    break
                except Exception:
                    time.sleep(.1)
            else:
                raise RuntimeError('隔离 Chrome 启动失败')
            cdp = CDP(page['webSocketDebuggerUrl'])
            try:
                cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            except (TimeoutError, ConnectionResetError):
                time.sleep(1)
                pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=3))
                page = next(item for item in pages if item.get('type') == 'page')
                cdp = CDP(page['webSocketDebuggerUrl'])

            def evaluate(expression):
                result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
                if 'exceptionDetails' in result:
                    raise AssertionError(result['exceptionDetails'])
                return result.get('result', {}).get('value')

            def until(expression):
                for _ in range(80):
                    if evaluate(expression):
                        return
                    time.sleep(.1)
                raise AssertionError(f'等待失败：{expression}')

            def pointer(x, y):
                for event in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                    cdp.call('Input.dispatchMouseEvent', {'type': event, 'x': x, 'y': y,
                        'button': 'left' if event != 'mouseMoved' else 'none',
                        'buttons': 1 if event == 'mousePressed' else 0,
                        'clickCount': 1 if event != 'mouseMoved' else 0})

            until('!!window.SA?.Home && !!SA.YardChat && !!document.querySelector("#modal")')
            evaluate("document.querySelector('.title')?.remove(); document.querySelector('#modal').hidden=true; SA.Home.open('sun')")
            for weather in ('sun', 'rain', 'night'):
                evaluate(f"SA.Home.open('{weather}')")
                for index, key, name in ((0, 'rel', '远房亲戚'), (1, 'tom', '铁匠 老汤姆'), (2, 'tim', '学徒 小提米')):
                    probe = evaluate("(()=>{const e=[...document.querySelectorAll('.home-stage > .ab.px-hot')].filter(x=>!x.classList.contains('home-vane'))[" + str(index) + "];const r=e.getBoundingClientRect(),cv=e.querySelector('canvas');let x=Math.floor(r.left+r.width/2),y=Math.floor(r.top+r.height/2),pixel=null;if(cv){const a=cv.getContext('2d').getImageData(0,0,56,56).data;let best=1e9;for(let py=12;py<49;py++)for(let px=18;px<38;px++){if(a[(py*56+px)*4+3]<20)continue;const score=(px-28)**2+(py-26)**2;if(score<best){best=score;pixel=[px,py]}}if(pixel){const cr=cv.getBoundingClientRect();x=Math.floor(cr.left+(pixel[0]+.5)*cr.width/56);y=Math.floor(cr.top+(pixel[1]+.5)*cr.height/56)}}const t=document.elementFromPoint(x,y);return {x,y,pixel,hit:e===t||e.contains(t),target:t?.className,tag:t?.tagName,outer:t?.outerHTML?.slice(0,240),actor:e.className,rect:[r.left,r.top,r.width,r.height]}})()")
                    pointer(probe['x'], probe['y'])
                    visible = evaluate("!document.querySelector('#modal').hidden")
                    if baseline:
                        print(f"旧版 {weather}/{key}: 命中={probe['hit']}，目标={probe['target']} {probe['tag']} {probe['outer']}，矩形={probe['rect']}，点=({probe['x']},{probe['y']})，对话框={visible}")
                        evaluate("SA.UI.closeModal()") if visible else None
                        continue
                    if weather == 'sun' or (weather, key) in (('rain', 'rel'), ('night', 'tim')):
                        assert probe['pixel'] is not None, f'{weather}/{key} 未找到可见人物像素'
                    assert probe['hit'], f'{weather}/{key} 中心被遮挡：{probe}'
                    assert visible, f'{weather}/{key} 点击未打开对话框'
                    title = evaluate("document.querySelector('#modal h2')?.textContent")
                    body = evaluate("document.querySelector('#modal .panel-body')?.textContent")
                    assert title == name, f'{weather}/{key} 人物标题错误：{title}'
                    expected = evaluate(f"SA.YardChat.clickTips().{key}")
                    assert body == expected, f'{weather}/{key} 台词未取最新值：{body}'
                    evaluate("document.querySelector('#modal .dialog-actions button').click()")
                    assert not evaluate("!document.querySelector('#modal').hidden"), f'{weather}/{key} 未关闭'
                    pointer(probe['x'], probe['y'])
                    assert evaluate("!document.querySelector('#modal').hidden"), f'{weather}/{key} 关闭后不能再次点击'
                    evaluate("document.querySelector('#modal .dialog-actions button').click()")
            if baseline:
                return
            evaluate("SA.Home.open('sun'); SA.Text.set('home:tip:tom', '<img src=x onerror=alert(1)>即时台词')")
            probe = evaluate("(()=>{const r=[...document.querySelectorAll('.home-stage > .ab.px-hot')].filter(x=>!x.classList.contains('home-vane'))[1].getBoundingClientRect();return {x:Math.floor(r.left+r.width/2),y:Math.floor(r.top+r.height/2)}})()")
            pointer(probe['x'], probe['y'])
            assert evaluate("document.querySelector('#modal .panel-body')?.textContent === '<img src=x onerror=alert(1)>即时台词'"), '编辑后点击未即时读取文本'
            assert evaluate("document.querySelector('#modal .panel-body img') === null"), '台词被解释成 HTML'
            print('院子点击：三人物晴天、雨天、夜里真实点击、关闭、即时编辑和 HTML 安全性通过')
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    run()
