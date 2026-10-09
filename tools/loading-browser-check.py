"""用隔离 Chrome 和临时 HTTP 服务验证真实首页加载，不读取用户存档。"""
import argparse
import http.server
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

sys.dont_write_bytecode = True
from html5_game_mcp import CDP
from serve import NoCache

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIGS = {'rules', 'ui', 'text', 'modules', 'content', 'stage-cars', 'routes'}
INSTRUMENT = """
window.loadingProbe={requests:[],errors:[],titleAt:null};
const originalOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,async=true,...rest){
  loadingProbe.requests.push({method,url:String(url),async});
  return originalOpen.call(this,method,url,async,...rest);
};
addEventListener('error',event=>loadingProbe.errors.push(event.message||'资源错误：'+event.target?.src),true);
addEventListener('unhandledrejection',event=>loadingProbe.errors.push(String(event.reason)));
new MutationObserver(()=>{
  if(loadingProbe.titleAt===null&&document.querySelector('.title-go')) loadingProbe.titleAt=performance.now();
}).observe(document,{childList:true,subtree:true});
"""


def run_case(name, directory, baseline_ref=None, controlled=False):
    """每个场景独立浏览器档案；旧入口通过内存覆写，不改工作区源码。"""
    overrides = {}
    if baseline_ref:
        for relative in ['index.html', 'js/config.js', 'js/main.js']:
            overrides['/' + relative] = subprocess.check_output(
                ['git', '-c', f'safe.directory={ROOT.as_posix()}', 'show', baseline_ref + ':' + relative], cwd=ROOT)
    if controlled:
        # 受控模型仅隔离 Z 盘读取波动；旧、新入口采用同一份内存资源和每请求 40ms 延迟。
        memory = {'/index.html': (directory / 'index.html').read_bytes()}
        for pattern in ['js/*.js', 'config/*.json', 'css/*.css']:
            for file in directory.glob(pattern):
                memory['/' + file.relative_to(directory).as_posix()] = file.read_bytes()
        overrides = {**memory, **overrides}
    requests = []

    class Handler(NoCache):
        """仅提供只读文件并记录网络请求次数，作者配置不写回磁盘。"""
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def do_GET(self):
            if controlled:
                time.sleep(.04)
            relative = urllib.parse.urlsplit(self.path).path
            requests.append(relative)
            body = overrides.get('/index.html' if relative == '/' else relative)
            if relative.startswith('/__text/load'):
                body = b'{"version":1,"game":"steam-arena","locale":"zh-CN","values":{},"removedElements":[]}'
            if body is None:
                super().do_GET()
                return
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type('/index.html' if relative == '/' else relative) + '; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass

        def do_POST(self):
            # 验收使用生产静态服务与缓存头，但不开放任何作者写接口。
            self.send_error(405)

    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='loading-check-', ignore_cleanup_errors=True) as profile:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = 19000 + server.server_port % 20000
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
            cdp.call('Page.enable')
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': INSTRUMENT})
            try:
                cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            except (TimeoutError, ConnectionResetError):
                # 首次导航偶尔结束旧 CDP 连接；重新连接原隔离页，不重新导航或重复插桩。
                cdp.close()
                cdp = CDP(page['webSocketDebuggerUrl'])

            def evaluate(expression):
                """一次 CDP 求值取得 JSON，避免持续消费无法终止的事件流。"""
                result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
                if 'exceptionDetails' in result:
                    raise AssertionError(result['exceptionDetails'])
                return result.get('result', {}).get('value')

            for _ in range(150):
                if evaluate("!!document.querySelector('.title-go')"):
                    break
                time.sleep(.1)
            else:
                raise AssertionError(evaluate('JSON.stringify(window.loadingProbe)'))
            metrics = evaluate("""(()=>({
                title:document.title,titleAt:loadingProbe.titleAt,errors:loadingProbe.errors,
                requests:loadingProbe.requests,release:SA.RELEASE,
                domContentLoaded:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
                domInteractive:performance.getEntriesByType('navigation')[0].domInteractive,
                resources:performance.getEntriesByType('resource').filter(e=>/\\/(config|js)\\//.test(e.name))
                  .map(e=>({path:new URL(e.name).pathname,start:e.startTime,end:e.responseEnd,initiator:e.initiatorType}))
            }))()""")
            configs = [item for item in metrics['resources'] if item['path'].startswith('/config/')]
            config_gets = [item for item in metrics['requests'] if item['method'] == 'GET' and '/config/' in item['url']]
            assert len(config_gets) == 7 and {pathlib.PurePosixPath(item['url'].split('?')[0]).stem for item in config_gets} == CONFIGS
            assert all(item['async'] == (not baseline_ref) for item in config_gets), config_gets
            assert not metrics['errors'], metrics['errors']
            script_counts = {path: requests.count(path) for path in requests if path.startswith('/js/')}
            assert all(count == 1 for count in script_counts.values()), script_counts
            overlap = sum(1 for i, item in enumerate(configs) for other in configs[i+1:]
                if max(item['start'], other['start']) < min(item['end'], other['end']))
            result = {'case': name, 'title': metrics['title'], 'titleReadyMs': round(metrics['titleAt'], 1),
                'model': '内存资源＋40ms请求延迟' if controlled else '真实磁盘＋项目NoCache服务',
                'domInteractiveMs': round(metrics['domInteractive'], 1),
                'domContentLoadedMs': round(metrics['domContentLoaded'], 1),
                'release': metrics['release'], 'configAsync': not baseline_ref,
                'configSpanMs': round(max(item['end'] for item in configs)-min(item['start'] for item in configs), 1),
                'overlappingConfigPairs': overlap, 'scriptFiles': len(script_counts),
                'duplicateScriptRequests': 0, 'errors': metrics['errors'], 'configTiming': configs}
            print(json.dumps(result, ensure_ascii=False), flush=True)
            if metrics['release']:
                # Worker 完成可能超过单次 CDP 超时，先启动再轮询结果，不阻塞求值连接。
                evaluate("window.workerProbe={id:Object.keys(SA.ROUTES)[0],done:false};SA.Route.preload(workerProbe.id).then(ok=>{workerProbe.ok=ok;workerProbe.done=true})")
                for _ in range(600):
                    if evaluate('workerProbe.done'):
                        break
                    time.sleep(.1)
                else:
                    raise AssertionError('发行包 Worker 预热超时')
                worker = evaluate('({ok:workerProbe.ok,status:SA.Route.preparationStatus(workerProbe.id),id:workerProbe.id})')
                assert worker['ok'] is True and worker['status'] == 'ready', worker
                print(json.dumps({'case': name, 'worker': worker}, ensure_ascii=False), flush=True)
            return result
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release-root', type=pathlib.Path, required=True)
    parser.add_argument('--release-only', action='store_true', help='只复验发行启动和 Worker 预热')
    parser.add_argument('--controlled', action='store_true', help='对比内存资源与固定40ms延迟模型')
    parser.add_argument('--baseline-ref', help='可选旧同步加载版本 Git 引用；默认仅验当前版本，不猜测历史提交')
    args = parser.parse_args()
    if not args.release_only:
        if args.baseline_ref:
            run_case('原加载方案', ROOT, baseline_ref=args.baseline_ref, controlled=args.controlled)
        run_case('新加载方案', ROOT, controlled=args.controlled)
    if not args.controlled:
        assert run_case('发行包', args.release_root)['release'] is True
