"""用隔离浏览器与内存端点验证院子聊天工作台，避免写入正式文案。"""
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
    """静态文件取自仓库，页面管理保存仅写入本进程内存。"""

    store = {'version': 1, 'game': 'steam-arena', 'locale': 'zh-CN', 'values': {}, 'removedElements': []}
    saves = 0
    fail = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith('/__text/load'):
            self.reply(Handler.store)
        elif self.path.startswith('/tools/yard-chat-editor.html'):
            html = (ROOT / 'tools/yard-chat-editor.html').read_text(encoding='utf-8')
            html = html.replace('<script src="yard-chat-editor.js"></script>',
                '<script>window.showSaveFilePicker=undefined;</script><script src="yard-chat-editor.js"></script>')
            self.reply_html(html)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/__text/save':
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers['Content-Length']))
        if Handler.fail:
            self.send_error(503, 'test save failure')
            return
        Handler.store = json.loads(body)
        Handler.saves += 1
        self.reply({'revision': str(Handler.saves)})

    def reply(self, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def reply_html(self, html):
        body = html.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def run():
    """验证默认继承、编排、切换草稿、快捷保存、刷新及失败保留。"""
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='yard-chat-editor-', ignore_cleanup_errors=True) as profile:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        debug_port = 19000 + (server.server_port % 20000)
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu',
            f'--remote-debugging-port={debug_port}', '--remote-allow-origins=*',
            f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(60):
                try:
                    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json', timeout=1))
                    page = next(item for item in pages if item.get('type') == 'page')
                    break
                except Exception:
                    time.sleep(.1)
            else:
                raise RuntimeError('隔离 Chrome 启动失败')
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
                detail = evaluate("JSON.stringify({url:location.href,ready:document.readyState,notice:document.querySelector('#notice')?.textContent,scope:document.querySelector('#scope')?.value})")
                raise AssertionError(f'等待失败：{expression}；页面状态：{detail}')

            url = f'http://127.0.0.1:{server.server_port}/tools/yard-chat-editor.html?scope=stage:0:0'
            try:
                cdp.call('Page.navigate', {'url': url})
            except (TimeoutError, ConnectionResetError):
                # 首次导航可能重置 CDP 连接，页面仍会加载，重新连接当前页。
                time.sleep(1)
                pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json', timeout=3))
                page = next(item for item in pages if item.get('type') == 'page')
                cdp = CDP(page['webSocketDebuggerUrl'])
            until("document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert evaluate("document.querySelector('#scope').value==='stage:0:0'"), '初始关卡未定位'
            assert evaluate("document.querySelector('#source').textContent.includes('内置默认')"), '默认聊天继承未显示'
            evaluate("document.querySelector('#add-group').click()")
            evaluate("(()=>{const t=document.querySelector('.group:last-child textarea');t.value='第一句';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("document.querySelector('.group:last-child [data-action=line-add]').click()")
            evaluate("(()=>{const t=document.querySelector('.group:last-child .line:last-child textarea');t.value='第二句';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("document.querySelector('.group:last-child [data-action=line-up][data-line=\"1\"]').click()")
            evaluate("(()=>{const t=document.querySelector('#interval');t.value='8';t.dispatchEvent(new Event('input'));return true})()")
            evaluate("(()=>{const s=document.querySelector('#scope');s.value='chapter:0';s.dispatchEvent(new Event('change'));return true})()")
            assert evaluate("document.querySelector('#dirty').textContent.includes('1 个聊天范围')"), '切范围丢失草稿'
            evaluate("document.querySelector('#add-group').click()")
            evaluate("(()=>{const s=document.querySelector('#scope');s.value='stage:0:0';s.dispatchEvent(new Event('change'));return true})()")
            assert evaluate("[...document.querySelectorAll('.group:last-child textarea')].map(x=>x.value).join(',')==='第二句,第一句'"), '对答排序未保留'
            evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}))")
            until("document.querySelector('#notice')?.textContent.includes('保存失败')")
            assert Handler.saves == 0, '其他范围无效时发生了部分保存'
            evaluate("(()=>{const s=document.querySelector('#scope');s.value='chapter:0';s.dispatchEvent(new Event('change'));return true})()")
            evaluate("(()=>{const t=document.querySelector('.group:last-child textarea');t.value='章节聊天';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("(()=>{const s=document.querySelector('#scope');s.value='stage:0:0';s.dispatchEvent(new Event('change'));return true})()")
            evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}))")
            until("document.querySelector('#notice')?.textContent.includes('已保存')")
            assert Handler.saves == 1, 'Ctrl+S 未一次保存'
            values = Handler.store['values']
            group = json.loads(values['home:chat:pool:stage:0:0'])[-1]
            assert [line['text'] for line in group['lines']] == ['第二句', '第一句'], '对答排序保存错误'
            assert json.loads(values['home:chat:pool:chapter:0'])[-1]['lines'][0]['text'] == '章节聊天', '章节草稿未一并保存'
            assert json.loads(values['home:chat:settings'])['intervalSec'] == 8, '整体间隔保存错误'
            cdp.call('Page.navigate', {'url': url})
            until("document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert evaluate("document.querySelector('.group:last-child textarea').value==='第二句'"), '刷新未恢复保存的版本'
            evaluate("localStorage.setItem('steam_arena_save_v2',JSON.stringify({camp:{ch:0,st:0}}))")
            cdp.call('Page.navigate', {'url': url.split('?')[0]})
            until("document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert evaluate("document.querySelector('#scope').value==='stage:0:0'"), '独立打开未定位当前存档关卡'
            evaluate("document.querySelector('#inherit').click()")
            evaluate("document.querySelector('#save').click()")
            until("document.querySelector('#notice')?.textContent.includes('已保存')")
            assert Handler.store['values'].get('home:chat:pool:stage:0:0') == '', '恢复继承未清除关卡覆盖'
            Handler.fail = True
            evaluate("document.querySelector('#add-group').click()")
            evaluate("(()=>{const t=document.querySelector('.group:last-child textarea');t.value='失败草稿';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("document.querySelector('#save').click()")
            until("document.querySelector('#notice')?.textContent.includes('保存失败')")
            assert evaluate("document.querySelector('#dirty').textContent.includes('待保存')"), '失败后未保留草稿'
            print('院子聊天工作台：当前关卡、对答排序、多范围预校验、Ctrl+S、刷新、继承和失败草稿通过')
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    run()
