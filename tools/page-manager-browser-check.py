"""独立 Chrome 配置下验证页面版本首屏、文字画布与 F8 悬浮编辑。"""
import http.server
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request

from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = '''<!doctype html><meta charset="utf-8"><style>
.home-hint{opacity:0;pointer-events:none}.home-car:hover .home-hint{opacity:1}
</style><div id="screen"><div id="target" data-text-key="fixture:target">原文字</div>
<div class="home-car" id="car">车<div class="home-hint" id="hint">提示原文</div></div>
<div id="titled" title="原生提示">标题</div><div class="ar-title" id="art"></div></div>
<script>if(!localStorage.getItem('sa-text-fixture-zh-CN'))localStorage.setItem('sa-text-fixture-zh-CN',JSON.stringify({version:1,game:'fixture',locale:'zh-CN',dirty:false,values:{'fixture:target':'选中版本'},removedElements:[],activeVersion:{id:'chosen',at:'2026-10-01T00:00:00Z'},history:[{id:'old',at:'2026-09-30T00:00:00Z',values:{'fixture:target':'原文字'},removedElements:[]}]}));</script>
<script src="/js/text-manager.js"></script><script src="/js/palette.js"></script>
<script src="/js/ui-px.js"></script><script>window.showSaveFilePicker=undefined;SA.Text.init({game:'fixture',locale:'zh-CN',page:'fixture'});
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('art').append(SA.PX.ui.img(SA.PX.brush('原题',22,SA.PX.INK,'#b59c6c',3),2));});
function firstVisible(){if(getComputedStyle(document.body).visibility==='visible')window.firstVisibleText=document.getElementById('target').textContent;else requestAnimationFrame(firstVisible)}
requestAnimationFrame(firstVisible);</script>'''


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/fixture':
            body = HTML.encode()
            kind = 'text/html'
        elif self.path == '/__text/load?game=fixture&locale=zh-CN':
            body = json.dumps({'version': 1, 'values': {'fixture:target': '服务旧稿'}, 'removedElements': []}).encode()
            kind = 'application/json'
        elif self.path in ('/js/text-manager.js', '/js/palette.js', '/js/ui-px.js'):
            selected = os.environ.get('TEXT_MANAGER_SOURCE') if self.path == '/js/text-manager.js' else None
            body = (pathlib.Path(selected) if selected else ROOT / self.path.lstrip('/')).read_bytes()
            kind = 'text/javascript'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', kind + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass

    def do_POST(self):
        if self.path != '/__text/save':
            self.send_error(404)
            return
        # 模拟旧服务剥离历史字段；浏览器本地版本选择仍须独立可靠。
        self.rfile.read(int(self.headers['Content-Length']))
        body = b'{"revision":"old-server"}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='page-manager-', ignore_cleanup_errors=True) as profile:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = 19000 + (server.server_port % 20000)
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu',
            f'--remote-debugging-port={port}', '--remote-allow-origins=*',
            f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(50):
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
                cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/fixture'})
            except (TimeoutError, ConnectionResetError):
                # 首次导航偶尔超过 CDP 默认 8 秒；页面仍会继续加载。
                time.sleep(2)
                pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=3))
                page = next(item for item in pages if item.get('type') == 'page')
                cdp = CDP(page['webSocketDebuggerUrl'])
            for _ in range(80):
                result = cdp.call('Runtime.evaluate', {'expression': "document.readyState==='complete'&&window.SA?.Text?.isEditing()!=null", 'returnByValue': True})
                if result.get('result', {}).get('value'):
                    break
                time.sleep(.1)
            first_result = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{await SA.Text.ready;
              await new Promise(requestAnimationFrame);return window.firstVisibleText;})()''',
              'returnByValue': True, 'awaitPromise': True})
            first_text = first_result.get('result', {}).get('value')
            assert first_text == '选中版本', f'首个可见帧显示：{first_text!r}'
            result = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{
              await SA.Text.ready; await new Promise(requestAnimationFrame);
              const target=document.getElementById('target');
              const first=window.firstVisibleText;
              SA.Text.enterEdit();
              const canvas=document.querySelector('#art canvas');
              canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              const input=document.querySelector('#sa-text-manager textarea');
              const canvasValue=input.value;
              input.value='新标题三字'; input.dispatchEvent(new Event('input',{bubbles:true}));
              const changed=canvas.width;
              await SA.Text.save();
              const beforeRemove=SA.Text.versions().length;
              document.querySelector('[data-text-action="remove-text"]').click();
              await SA.Text.save();
              const removed=canvas.width;
              SA.Text.selectVersion(SA.Text.versions().find(item=>item.id==='chosen').id);
              const restored=canvas.width;
              const car=document.getElementById('car');
              car.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
              document.dispatchEvent(new KeyboardEvent('keydown',{key:'F8',bubbles:true}));
              const pinned=getComputedStyle(document.getElementById('hint')).opacity;
              document.getElementById('hint').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              const hintEditable=input.value;
              input.value='固定后编辑'; input.dispatchEvent(new Event('input',{bubbles:true}));
              const hintChanged=document.getElementById('hint').textContent;
              document.dispatchEvent(new KeyboardEvent('keydown',{key:'F8',bubbles:true}));
              const released=getComputedStyle(document.getElementById('hint')).opacity;
              const titled=document.getElementById('titled');
              titled.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
              document.dispatchEvent(new KeyboardEvent('keydown',{key:'F8',bubbles:true}));
              const mirror=document.querySelector('[data-sa-text-mirror]');
              mirror?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              const titleEditable=input.value;
              input.value='新提示'; input.dispatchEvent(new Event('input',{bubbles:true}));
              const titleChanged=titled.title;
              SA.Text.exitEdit();
              return {first,canvasValue,changed,beforeRemove,removed,restored,
                pinned,released,hintEditable,hintChanged,titleEditable,titleChanged,
                mirrorGone:!document.querySelector('[data-sa-text-mirror]'),
                active:SA.Text.versions()[0].id,versions:SA.Text.versions().length};
            })()''', 'returnByValue': True, 'awaitPromise': True})
            value = result['result']['value']
            assert value['first'] == '选中版本', value
            assert value['canvasValue'] == '原题', value
            assert value['beforeRemove'] >= 3, value
            assert value['removed'] < value['changed'] and value['restored'] != value['removed'], value
            assert value['hintEditable'] == '提示原文' and value['hintChanged'] == '固定后编辑', value
            assert value['titleEditable'] == '原生提示' and value['titleChanged'] == '新提示' and value['mirrorGone'], value
            assert value['pinned'] == '1' and value['released'] == '0', value
            cdp.call('Page.reload', {'ignoreCache': True})
            for _ in range(60):
                probe = cdp.call('Runtime.evaluate', {'expression': "document.readyState==='complete'&&!!window.SA?.Text", 'returnByValue': True})
                if probe.get('result', {}).get('value'):
                    break
                time.sleep(.1)
            reloaded_result = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{await SA.Text.ready;
              await new Promise(requestAnimationFrame);
              return {first:window.firstVisibleText,active:SA.Text.versions()[0].id,
                title:document.getElementById('titled').title};})()''',
              'returnByValue': True, 'awaitPromise': True})
            if 'exceptionDetails' in reloaded_result:
                raise RuntimeError(reloaded_result['exceptionDetails'])
            reloaded = reloaded_result['result']['value']
            assert reloaded['first'] == '选中版本' and reloaded['active'] == 'chosen', reloaded
            assert reloaded['title'] == '新提示', reloaded
            value['reload'] = reloaded
            print(json.dumps(value, ensure_ascii=False))
        finally:
            browser.terminate()
            browser.wait(timeout=5)
            server.shutdown()
            time.sleep(1)


if __name__ == '__main__':
    run()
