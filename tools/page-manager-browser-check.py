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
FIRST_VISIBLE_PROBE = b'''<script>
document.addEventListener('DOMContentLoaded',()=>{
  const first=()=>{
    if(getComputedStyle(document.body).opacity!=='1')return requestAnimationFrame(first);
    const title=document.querySelector('.title-name'),sub=document.querySelector('.title-sub');
    window.__firstGameVisible={title:title?.textContent,removed:sub?getComputedStyle(sub).display==='none':false};
  };
  requestAnimationFrame(first);
},{once:true});</script>'''
HTML = '''<!doctype html><html><head><meta charset="utf-8"><style id="sa-text-startup-hide">body{opacity:0!important}</style><style>
.home-hint{opacity:0;pointer-events:none}.home-car:hover .home-hint{opacity:1}
</style></head><body><div id="screen"><div id="target" data-text-key="fixture:target">原文字</div>
<div class="home-car" id="car">车<div class="home-hint" id="hint">提示原文</div></div>
<div id="titled" title="原生提示">标题</div><div class="ar-title" id="art"></div></div>
<script>const mode=new URLSearchParams(location.search).get('mode');
const current={version:1,game:'fixture',locale:'zh-CN',dirty:false,values:{'fixture:target':'选中版本'},removedElements:[],activeVersion:{id:'chosen',at:'2026-10-01T00:00:00Z'},history:[{id:'old',at:'2026-09-30T00:00:00Z',values:{'fixture:target':'原文字'},removedElements:[]}]};
if(mode==='legacy')localStorage.setItem('sa-text-fixture-zh-CN',JSON.stringify({version:1,dirty:true,values:{'fixture:target':'旧版草稿'},removedElements:[]}));
else if(mode==='dirty')localStorage.setItem('sa-text-fixture-zh-CN',JSON.stringify({...current,dirty:true,values:{'fixture:target':'未保存编辑'}}));
else if(!localStorage.getItem('sa-text-fixture-zh-CN'))localStorage.setItem('sa-text-fixture-zh-CN',JSON.stringify(current));</script>
<script src="/js/text-manager.js"></script><script src="/js/palette.js"></script>
<script src="/js/ui-px.js"></script><script>window.showSaveFilePicker=undefined;SA.Text.init({game:'fixture',locale:'zh-CN',page:'fixture'});
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('art').append(SA.PX.ui.img(SA.PX.brush('原题',22,SA.PX.INK,'#b59c6c',3),2));});
function firstVisible(){if(getComputedStyle(document.body).opacity==='1')window.firstVisibleText=document.getElementById('target').textContent;else requestAnimationFrame(firstVisible)}
requestAnimationFrame(firstVisible);</script></body></html>'''


class Handler(http.server.BaseHTTPRequestHandler):
    game_source = {'version': 1, 'values': {}, 'removedElements': []}

    def do_GET(self):
        if self.path.startswith('/fixture'):
            body = HTML.encode()
            kind = 'text/html'
        elif self.path == '/':
            body = (ROOT / 'index.html').read_bytes().replace(b'<head>', b'<head>' + FIRST_VISIBLE_PROBE, 1)
            kind = 'text/html'
        elif self.path == '/__text/load?game=fixture&locale=zh-CN':
            # 让初始 DOM 至少有几帧处于旧服务响应等待中，暴露首屏闪烁。
            time.sleep(.3)
            body = json.dumps({'version': 1, 'values': {}, 'removedElements': []}).encode()
            kind = 'application/json'
        elif self.path == '/__text/load?game=steam-arena&locale=zh-CN':
            time.sleep(.3)
            body = json.dumps(self.game_source).encode()
            kind = 'application/json'
        elif self.path.startswith('/js/') or self.path.startswith('/css/'):
            if self.path == '/js/main.js':
                time.sleep(.3)
            selected = os.environ.get('TEXT_MANAGER_SOURCE') if self.path == '/js/text-manager.js' else None
            body = (pathlib.Path(selected) if selected else ROOT / self.path.lstrip('/')).read_bytes()
            kind = 'text/css' if self.path.startswith('/css/') else 'text/javascript'
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
              SA.Text.selectVersion('original');
              const restored=canvas.width;
              const car=document.getElementById('car');
              car.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
              document.dispatchEvent(new KeyboardEvent('keydown',{key:'F8',bubbles:true}));
              const pinned=getComputedStyle(document.getElementById('hint')).opacity;
              document.getElementById('hint').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              const hintEditable=input.value;
              input.value='固定后编辑'; input.dispatchEvent(new Event('input',{bubbles:true}));
              const hintChanged=document.getElementById('hint').textContent;
              const selectedAfterEdit=document.querySelector('[data-text-versions]').value;
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
                pinned,released,hintEditable,hintChanged,selectedAfterEdit,titleEditable,titleChanged,
                mirrorGone:!document.querySelector('[data-sa-text-mirror]'),
                active:SA.Text.versions()[0].id,versions:SA.Text.versions().length};
            })()''', 'returnByValue': True, 'awaitPromise': True})
            value = result['result']['value']
            assert value['first'] == '选中版本', value
            assert value['canvasValue'] == '原题', value
            assert value['beforeRemove'] == 2 and value['versions'] == 2, value
            assert value['removed'] < value['changed'] and value['restored'] != value['removed'], value
            assert value['hintEditable'] == '提示原文' and value['hintChanged'] == '固定后编辑', value
            assert value['selectedAfterEdit'] == 'edited', value
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
              return {first:window.firstVisibleText,selected:document.querySelector('[data-text-versions]').value,
                title:document.getElementById('titled').title};})()''',
              'returnByValue': True, 'awaitPromise': True})
            if 'exceptionDetails' in reloaded_result:
                raise RuntimeError(reloaded_result['exceptionDetails'])
            reloaded = reloaded_result['result']['value']
            assert reloaded['first'] == '选中版本' and reloaded['selected'] == 'edited', reloaded
            assert reloaded['title'] == '新提示', reloaded
            value['reload'] = reloaded
            # 旧版与现代草稿都只显示固定的两版，刷新默认选择编辑版。
            for mode, expected, count in [('legacy', '旧版草稿', 2), ('dirty', '未保存编辑', 2)]:
                cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/fixture?mode={mode}'})
                for _ in range(80):
                    probe = cdp.call('Runtime.evaluate', {'expression': "document.readyState==='complete'&&!!window.SA?.Text", 'returnByValue': True})
                    if probe.get('result', {}).get('value'):
                        break
                    time.sleep(.1)
                check = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{await SA.Text.ready;
                  await new Promise(requestAnimationFrame);
                  const select=document.querySelector('[data-text-versions]');
                  return {first:window.firstVisibleText,text:document.getElementById('target').textContent,
                    options:select.options.length,selected:select.value,active:SA.Text.versions()[0].id};})()''',
                    'returnByValue': True, 'awaitPromise': True})['result']['value']
                assert check['first'] == expected and check['text'] == expected, (mode, check)
                assert check['options'] == count and check['selected'] == 'edited', (mode, check)
                value[mode] = check
            # 使用仓库真实 index 与全部游戏脚本，先从实际标题页读取稳定 key 和移除路径。
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            for _ in range(100):
                probe = cdp.call('Runtime.evaluate', {'expression': "document.readyState==='complete'&&!!document.querySelector('.title-name')", 'returnByValue': True})
                if probe.get('result', {}).get('value'):
                    break
                time.sleep(.1)
            captured = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{await SA.Text.ready;
              SA.Text.enterEdit();
              document.querySelector('.title-name').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              const key=document.querySelector('#sa-text-manager .sa-text-editor small').textContent;
              document.querySelector('.title-sub').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
              document.querySelector('[data-text-action="remove-element"]').click();
              const draft=JSON.parse(localStorage.getItem('sa-text-steam-arena-zh-CN'));
              return {key,removed:draft.removedElements.at(-1)};})()''',
              'returnByValue': True, 'awaitPromise': True})['result']['value']
            assert captured['key'] and captured['removed'], captured
            for mode in ('clean', 'dirty'):
                expected = '真实入口已编辑' if mode == 'clean' else '真实入口草稿'
                cache = {'version': 1, 'game': 'steam-arena', 'locale': 'zh-CN',
                    'dirty': mode == 'dirty', 'values': {captured['key']: expected},
                    'removedElements': [captured['removed']]}
                Handler.game_source = {'version': 1, 'values': cache['values'] if mode == 'clean' else {},
                    'removedElements': cache['removedElements'] if mode == 'clean' else []}
                cdp.call('Runtime.evaluate', {'expression':
                    "localStorage.setItem('sa-text-steam-arena-zh-CN',JSON.stringify(" + json.dumps(cache, ensure_ascii=False) + "))"})
                cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
                for _ in range(100):
                    probe = cdp.call('Runtime.evaluate', {'expression': "document.readyState==='complete'&&!!window.SA?.Text", 'returnByValue': True})
                    if probe.get('result', {}).get('value'):
                        break
                    time.sleep(.1)
                actual = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{await SA.Text.ready;
                  await new Promise(requestAnimationFrame);
                  const select=document.querySelector('[data-text-versions]');
                  return {first:window.__firstGameVisible,title:document.querySelector('.title-name')?.textContent,
                    removed:getComputedStyle(document.querySelector('.title-sub')).display==='none',
                    options:select.options.length,selected:select.value,active:SA.Text.versions()[0].id};})()''',
                    'returnByValue': True, 'awaitPromise': True})['result']['value']
                assert actual.get('first') == {'title': expected, 'removed': True}, (mode, actual)
                assert actual['title'] == expected and actual['removed'], (mode, actual)
                assert actual['options'] == 2 and actual['selected'] == 'edited', (mode, actual)
                value['game_' + mode] = actual
            print(json.dumps(value, ensure_ascii=False))
        finally:
            browser.terminate()
            browser.wait(timeout=5)
            server.shutdown()
            time.sleep(1)


if __name__ == '__main__':
    run()
