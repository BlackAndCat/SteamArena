"""用独立浏览器和内存保存端点检查开场编排，不触碰正式文案文件。"""
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
    """静态文件来自仓库，文字保存只写本测试进程的内存。"""

    store = {'version': 1, 'game': 'steam-arena', 'locale': 'zh-CN', 'values': {}, 'removedElements': []}
    saves = 0
    old_story = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith('/__text/load'):
            self.reply(Handler.store)
        elif self.path == '/js/story.js' and Handler.old_story is not None:
            body = Handler.old_story
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/__text/save':
            self.send_error(404)
            return
        Handler.store = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Handler.saves += 1
        self.reply({'revision': str(Handler.saves)})

    def reply(self, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def run():
    """检查标题来源、开场演出来源、键盘隔离和试播返回。"""
    old = '--old' in sys.argv
    if old:
        Handler.old_story = subprocess.check_output(['git', '-c',
            f'safe.directory={ROOT.as_posix()}', 'show', 'HEAD:js/story.js'], cwd=ROOT)
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='opening-editor-', ignore_cleanup_errors=True) as profile:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = 19000 + (server.server_port % 20000)
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu',
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
                # 首次导航连接偶尔会关闭，页面会继续加载；重新连接同一隔离页。
                time.sleep(2)
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

            until("!!document.querySelector('.title') && !!SA.Text?.isEditing")
            if old:
                assert evaluate("document.querySelector('.title [data-story-action]')===null"), '旧源码已存在标题编排入口'
                print('旧源码复现：标题页缺少开场编排入口')
                return
            evaluate('window.showSaveFilePicker=undefined')
            assert evaluate("document.querySelector('.title [data-story-action]').hidden"), '普通玩家出现编排入口'
            evaluate('SA.Text.enterEdit()')
            until("!document.querySelector('.title [data-story-action]').hidden")
            evaluate("document.querySelector('.title [data-story-action]').click()")
            until("!!document.querySelector('.sd')")
            assert not evaluate('SA.Text.isEditing()'), '编排时页面选字未暂停'
            evaluate("document.querySelector('.sd textarea').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter'}))")
            evaluate("document.querySelector('.sd textarea').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:' ',code:'Space'}))")
            assert evaluate("!!document.querySelector('.title') && !!document.querySelector('.sd')"), '编辑输入误开始游戏'
            evaluate("document.querySelector('.sd-foot .btn.primary').click()")
            until("!!document.querySelector('.vn-opening .vn-scene') && !document.querySelector('.sd')")
            assert evaluate("!!document.querySelector('.title') && !SA.Story.seen('opening')"), '标题来源试播推进了游戏'
            evaluate("document.querySelector('.vn-opening .vn-skip:not([data-story-action])').click()")
            until("!!document.querySelector('.sd') && !document.querySelector('.vn-opening')")
            evaluate("document.querySelector('.sd-foot .btn:last-child').click()")
            assert evaluate("!!document.querySelector('.title') && SA.Text.isEditing()"), '标题来源没有恢复页面模式'

            evaluate('SA.Text.exitEdit(); SA.StoryDev.setEnabled(true)')
            until("!document.querySelector('.title [data-story-action]').hidden")
            evaluate("document.querySelector('.title-go').click()")
            until("!!document.querySelector('.vn-opening')")
            evaluate('SA.Text.enterEdit()')
            evaluate("document.querySelector('.vn-opening [data-story-action]').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter'}))")
            assert evaluate("!!document.querySelector('.vn-opening') && !SA.Story.seen('opening')"), '开场编排按钮的键盘输入误跳过剧情'
            evaluate("document.querySelector('.vn-opening [data-story-action]').click()")
            until("!!document.querySelector('.sd') && !document.querySelector('.vn-opening')")
            assert not evaluate('SA.Text.isEditing()'), '从开场进入编排未暂停页面选字'
            assert not evaluate("SA.Story.seen('opening')"), '进入编排标记了开场'
            evaluate("(()=>{const t=document.querySelector('.sd textarea');t.value='开场编排隔离测试';t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
            evaluate("document.querySelector('.sd textarea').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,key:'s',code:'KeyS'}))")
            until("SA.StoryData.get('opening')[0].text==='开场编排隔离测试'")
            try:
                until('!!document.querySelector(".sd-status.ok")')
            except AssertionError:
                state = evaluate('document.querySelector(".sd-status")?.outerHTML')
                raise AssertionError(f'保存状态：{state}；POST 次数：{Handler.saves}')
            assert Handler.saves >= 1, 'Ctrl+S 没有写入隔离端点'
            evaluate("document.querySelector('.sd-foot .btn.primary').click()")
            until("!!document.querySelector('.vn-opening .vn-scene') && !document.querySelector('.sd')")
            assert not evaluate("SA.Story.seen('opening')"), '试播标记了开场'
            evaluate("document.querySelector('.vn-opening .vn-skip:not([data-story-action])').click()")
            until("!!document.querySelector('.sd') && !document.querySelector('.vn-opening')")
            evaluate("document.querySelector('.sd-foot .btn:last-child').click()")
            until("!!document.querySelector('.vn-opening') && !document.querySelector('.sd')")
            assert evaluate("SA.StoryData.get('opening')[0].text==='开场编排隔离测试' && !SA.Story.seen('opening') && SA.Text.isEditing()"), '返回开场没有使用新内容、恢复页面模式或误触发首战'
            print('开场编排隔离浏览器检查通过')
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    run()
