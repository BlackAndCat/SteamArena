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
    pause = False
    request_ready = threading.Event()
    release = threading.Event()

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
        if Handler.pause:
            Handler.request_ready.set()
            if not Handler.release.wait(10):
                self.send_error(504, 'test save timeout')
                return
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
            original_rel = evaluate("document.querySelector('[data-person=rel]').value")
            original_tim = evaluate("document.querySelector('[data-person=tim]').value")
            click_line = '老汤姆说：\n「铜管」与 <齿轮> 都在。'
            evaluate(f"(()=>{{const t=document.querySelector('[data-person=tom]');t.value={json.dumps(click_line, ensure_ascii=False)};t.dispatchEvent(new Event('input',{{bubbles:true}}));return true}})()")
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
            assert values['home:tip:tom'] == click_line, '点击对话的多行中文、引号或尖括号丢失'
            assert 'home:tip:rel' not in values and 'home:tip:tim' not in values, '未编辑人物被保存覆盖'
            cdp.call('Page.navigate', {'url': url})
            until("document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert evaluate("document.querySelector('.group:last-child textarea').value==='第二句'"), '刷新未恢复保存的版本'
            assert evaluate("document.querySelector('[data-person=tom]').value") == click_line, '刷新未恢复点击对话'
            assert evaluate("document.querySelector('[data-person=rel]').value") == original_rel, '其他人物的默认对话被覆盖'
            assert evaluate("document.querySelector('[data-person=tim]').value") == original_tim, '其他人物的默认对话被覆盖'
            pool_before = {key: value for key, value in Handler.store['values'].items() if key.startswith('home:chat:')}
            evaluate("(()=>{const t=document.querySelector('[data-person=rel]');t.value='瑞尔：只改我这一句。';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("(()=>{const t=document.querySelector('[data-person=tim]');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("document.querySelector('#save').click()")
            until("document.querySelector('#notice')?.textContent.includes('已保存')")
            assert Handler.store['values']['home:tip:rel'] == '瑞尔：只改我这一句。', '第二个人物点击对话未保存'
            assert Handler.store['values']['home:tip:tim'] == '', '显式清空的人物对话被默认文案覆盖'
            assert Handler.store['values']['home:tip:tom'] == click_line, '保存其他人物时覆盖了老汤姆文案'
            assert {key: value for key, value in Handler.store['values'].items() if key.startswith('home:chat:')} == pool_before, '只保存点击对话时改动了自动闲谈池'
            cdp.call('Page.navigate', {'url': url})
            until("document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert evaluate("document.querySelector('[data-person=tim]').value") == '', '刷新后显式空对话丢失'
            Handler.request_ready.clear()
            Handler.release.clear()
            Handler.pause = True
            evaluate("(()=>{const t=document.querySelector('[data-person=tom]');t.value='等待写入的旧句';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#save').click();return true})()")
            assert Handler.request_ready.wait(5), '未收到延迟保存请求'
            evaluate("(()=>{const t=document.querySelector('[data-person=tom]');t.value='等待期间的新句';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            Handler.pause = False
            Handler.release.set()
            until("document.querySelector('#notice')?.textContent.includes('仍有后续修改待保存')")
            assert Handler.store['values']['home:tip:tom'] == '等待写入的旧句', '首次延迟保存应写入提交时的文本'
            assert evaluate("document.querySelector('#dirty').textContent.includes('待保存')"), '保存期间新编辑的脏标记丢失'
            evaluate("document.querySelector('#save').click()")
            until("document.querySelector('#notice')?.textContent.includes('已保存。')")
            assert Handler.store['values']['home:tip:tom'] == '等待期间的新句', '第二次保存未写入最新文本'
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
            until("document.querySelector('#notice')?.textContent.includes('本机草稿已保存')")
            assert evaluate("document.querySelector('#dirty').textContent.includes('待保存')"), '失败后未保留草稿'

            # 直接双击文件启动时，隔离 profile 中的本机草稿须跨编辑页与游戏页共享。
            def file_tab(file_path):
                request = urllib.request.Request(f'http://127.0.0.1:{debug_port}/json/new?{file_path.as_uri()}', method='PUT')
                page = json.load(urllib.request.urlopen(request, timeout=5))
                return CDP(page['webSocketDebuggerUrl'])

            def file_eval(tab, expression):
                result = tab.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
                if 'exceptionDetails' in result:
                    raise AssertionError(result['exceptionDetails'])
                return result.get('result', {}).get('value')

            def file_until(tab, expression):
                for _ in range(80):
                    if file_eval(tab, expression):
                        return
                    time.sleep(.1)
                raise AssertionError(f'文件页面等待失败：{expression}')

            editor_file = ROOT / 'tools/yard-chat-editor.html'
            game_file = ROOT / 'index.html'
            local_line = '本地文件：<铜管>\n「台词」'
            file_editor = file_tab(editor_file)
            file_until(file_editor, "document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            file_eval(file_editor, f"(()=>{{const t=document.querySelector('[data-person=tom]');t.value={json.dumps(local_line, ensure_ascii=False)};t.dispatchEvent(new Event('input',{{bubbles:true}}));return true}})()")
            # 自动化不操作系统文件选择器；禁用后文件写入应明确报错，本机草稿仍可恢复。
            file_eval(file_editor, "window.showSaveFilePicker=undefined;document.querySelector('#save').click()")
            file_until(file_editor, "document.querySelector('#notice')?.textContent.includes('文本文件尚未写入')")
            refreshed_editor = file_tab(editor_file)
            file_until(refreshed_editor, "document.querySelector('#notice')?.textContent.includes('Ctrl+S')")
            assert file_eval(refreshed_editor, "document.querySelector('[data-person=tom]').value") == local_line, 'file:// 刷新编辑页丢失本机草稿'

            def click_file_tom(tab):
                file_until(tab, '!!window.SA?.Home && !!SA.YardChat && !!document.querySelector("#modal")')
                file_eval(tab, "document.querySelector('.title')?.remove();document.querySelector('#modal').hidden=true;SA.Home.open('sun')")
                point = file_eval(tab, "(()=>{const e=[...document.querySelectorAll('.home-stage > .ab.px-hot')].filter(x=>!x.classList.contains('home-vane'))[1],cv=e.querySelector('canvas'),a=cv.getContext('2d').getImageData(0,0,56,56).data;let best=1e9,pixel=null;for(let y=12;y<49;y++)for(let x=18;x<38;x++){if(a[(y*56+x)*4+3]<20)continue;const score=(x-28)**2+(y-26)**2;if(score<best){best=score;pixel=[x,y]}}const r=cv.getBoundingClientRect(),x=Math.floor(r.left+(pixel[0]+.5)*r.width/56),y=Math.floor(r.top+(pixel[1]+.5)*r.height/56);return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()")
                assert point['hit'], 'file:// 老汤姆人物被遮挡'
                for event in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                    tab.call('Input.dispatchMouseEvent', {'type': event, 'x': point['x'], 'y': point['y'],
                        'button': 'left' if event != 'mouseMoved' else 'none',
                        'buttons': 1 if event == 'mousePressed' else 0,
                        'clickCount': 1 if event != 'mouseMoved' else 0})
                assert file_eval(tab, "!document.querySelector('#modal').hidden"), 'file:// 点击人物未出现对话框'
                assert file_eval(tab, "document.querySelector('#modal .panel-body').textContent") == local_line, 'file:// 点击人物未读取编辑原文'
                assert not file_eval(tab, "!!document.querySelector('#modal .panel-body img')"), 'file:// 点击对话被当作 HTML 执行'

            file_game = file_tab(game_file)
            click_file_tom(file_game)
            file_game.call('Page.navigate', {'url': game_file.as_uri()})
            click_file_tom(file_game)
            print('院子聊天工作台：三人物点击对话、空值、多范围闲谈、延迟保存竞态、刷新、继承、失败草稿及 file:// 跨页真实点击通过')
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    run()
