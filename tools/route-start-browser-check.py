"""隔离 Chrome 中测量真实出征拉杆释放到地图首帧；不读写用户存档。"""
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
PROBE = """
window.routeProbe={errors:[]};
addEventListener('error',e=>routeProbe.errors.push(e.message||'资源错误'),true);
addEventListener('unhandledrejection',e=>routeProbe.errors.push(String(e.reason)));
const oldError=console.error;
console.error=(...args)=>{routeProbe.errors.push(args.map(String).join(' '));oldError(...args)};
const raf=requestAnimationFrame;
window.requestAnimationFrame=fn=>{
  const battle=fn.name==='loop'&&new Error().stack.includes('battle-view.js');
  return raf(t=>{
    const p=routeProbe, first=battle&&p.gestureAt!=null&&p.firstBattleFrameAt==null;
    const begin=performance.now();fn(t);
    if(first){p.firstFrameCallbackMs=performance.now()-begin;p.firstBattleFrameAt=performance.now();
      const b=window.routeBattle;p.runIdAtFrame=b.route.runId;p.planPendingAtFrame=b.opts.routeData.encounters.some(e=>e.pending);
      if(!p.planPendingAtFrame)p.planReadyAt=p.startWhenReadyAt||p.gestureAt;
      raf(()=>{p.presentedAt=performance.now()})}
  });
};
"""


def run_case(directory, route, run_index, preparation, baseline_ref=None):
    """每个用例独立档案和端口，旧版资源仅以内存覆写提供。"""
    overrides = {}
    previous_runs = run_index - (1 if route == 'r1' else 3)
    assert previous_runs >= 0, '非首路线的有效趟数从第3趟开始'
    if baseline_ref:
        files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', baseline_ref], cwd=ROOT).decode().splitlines()
        for relative in files:
            if relative == 'index.html' or relative.startswith(('js/', 'config/', 'css/')):
                overrides['/' + relative] = subprocess.check_output(['git', 'show', baseline_ref + ':' + relative], cwd=ROOT)

    class Handler(NoCache):
        """只读静态服务；屏蔽作者写接口及磁盘文本缓存迁移。"""
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            body = overrides.get('/index.html' if path == '/' else path)
            if path.startswith('/__text/load'):
                body = b'{"version":1,"game":"steam-arena","locale":"zh-CN","values":{},"removedElements":[]}'
            if body is None:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type('/index.html' if path == '/' else path) + '; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            self.send_error(405)

        def log_message(self, *_args):
            pass

    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    class Server(http.server.ThreadingHTTPServer):
        """关闭隔离浏览器时音效请求可中断，只屏蔽预期断连。"""
        def handle_error(self, request, client_address):
            if not isinstance(sys.exc_info()[1], ConnectionError):
                super().handle_error(request, client_address)
    with tempfile.TemporaryDirectory(prefix='route-check-', ignore_cleanup_errors=True) as profile:
        server = Server(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = 19000 + server.server_port % 20000
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--window-size=1440,1000',
            f'--remote-debugging-port={port}', '--remote-allow-origins=*', f'--user-data-dir={profile}',
            '--no-first-run', '--no-default-browser-check'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cdp = None
        try:
            for _ in range(60):
                try:
                    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1))
                    page = next(item for item in pages if item.get('type') == 'page')
                    break
                except Exception:
                    time.sleep(.1)
            else:
                raise AssertionError('隔离 Chrome 启动失败')
            cdp = CDP(page['webSocketDebuggerUrl'])
            cdp.sock.settimeout(90)  # 冷规划最坏数十秒，不能由默认 8 秒超时截断真实测量。
            cdp.call('Page.enable')
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': PROBE})
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})

            def evaluate(expression):
                result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
                assert 'exceptionDetails' not in result, result
                return result.get('result', {}).get('value')

            def wait_for(expression, seconds=90):
                deadline = time.monotonic() + seconds
                while time.monotonic() < deadline:
                    if evaluate(expression):
                        return
                    time.sleep(.05)
                raise AssertionError('等待超时：' + expression + ' ' + str(evaluate("({probe:routeProbe,title:document.title,body:document.body.innerText.slice(0,700),release:window.SA?.RELEASE})")))

            wait_for("!!document.querySelector('.title-go')")
            assert evaluate("!!document.querySelector('.title-route')"), '此包未开放出征入口，无法执行真实拉杆性能验收'
            # 合法初始车，固定首路线及已出发次数；仅修改隔离浏览器内的公开存档对象。
            evaluate(f"""(()=>{{const d=SA.S.d;d.vehicle=SA.S.starterVehicle();
              d.route={{best:{{}},runs:0,departures:{run_index-1},firstRoute:'r1',
                routeRuns:{{[{json.dumps(route)}]:{previous_runs}}},dda:{{}},streaks:{{}},metal:0}};
              SA.S.save();document.querySelector('.title-route').click()}})()""")
            wait_for("!!document.querySelector('[data-page-key=\"arena:route:" + route + "\"]')")
            evaluate("document.querySelector('[data-page-key=\"arena:route:" + route + "\"]').click()")
            wait_for("!document.querySelector('.title-screen,.title.out')")
            # 冷场景保持列表默认预热行为，区别于主动预热选中路线的 pending/ready 场景。
            if preparation != 'cold' and (baseline_ref or preparation != 'ready'):
                evaluate(f'SA.Route.preload({json.dumps(route)});void 0')
            if preparation == 'ready':
                wait_for(f'SA.Route.preparationStatus({json.dumps(route)})==="ready"')
            if preparation == 'cold' and not baseline_ref:
                evaluate("SA.S.d.vehicle.name+=' 冷缓存验收';SA.S.save()")
            evaluate("""(()=>{const p=routeProbe,rs=SA.Route.start,bs=SA.Battle.start;
              p.mainThreadSimulations=0;
              p.departuresBefore=SA.S.d.route.departures;p.battleStarts=0;
              if(SA.Battle.route.attachPlan){const f=SA.Battle.route.attachPlan;
                SA.Battle.route.attachPlan=function(id,plan){const ok=f.call(this,id,plan);if(ok){p.planReadyAt=performance.now();
                  p.attachedRunId=routeBattle.route.runId;p.attachedEncounters=routeBattle.opts.routeData.encounters.length}return ok}};
              for(const [obj,key] of [[SA.Battle,'scoreDuel'],[SA.Battle.route,'simulate']]){
                const f=obj[key];obj[key]=function(...a){p.mainThreadSimulations++;return f.apply(this,a)}}
              if(SA.Route.startWhenReady){const f=SA.Route.startWhenReady;
                SA.Route.startWhenReady=function(id,...args){p.route=id;p.status=SA.Route.preparationStatus(id);
                  p.startWhenReadyAt=performance.now();return f.call(this,id,...args).finally(()=>p.startWhenReadyMs=performance.now()-p.startWhenReadyAt)}};
              const terrain=SA.TerrainArt.profileTiles;
              SA.TerrainArt.profileTiles=function(...args){const at=performance.now();
                try{return terrain.apply(this,args)}finally{p.profileTilesMs=performance.now()-at}};
              SA.Route.start=function(id,...args){p.route=id;p.status=SA.Route.preparationStatus(id);
                const at=performance.now();try{return rs.call(this,id,...args)}finally{p.routeStartMs=performance.now()-at}};
              SA.Battle.start=function(opts){p.battleStarts++;p.battleAt=performance.now();p.runIndex=opts.routeData.difficulty.runIndex;
                const at=performance.now();try{return window.routeBattle=bs.call(this,opts)}finally{p.battleStartMs=performance.now()-at}};
              document.addEventListener('pointerup',()=>{p.gestureAt=performance.now()},{capture:true,once:true});
            })()""")
            bounds = evaluate("(()=>{const e=document.querySelector('.ar-go .px-thr canvas');e.scrollIntoView();const b=e.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+3;return {x,y,k:b.width/e.offsetWidth,hit:document.elementFromPoint(x,y)===e}})()")
            # 真正 CDP 指针事件触发 capture、拖动、释放，不能以直接调用 start 替代。
            x, y = bounds['x'], bounds['y']
            assert bounds['hit'], bounds
            cdp.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            cdp.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x+48*bounds['k'], 'y': y, 'button': 'left', 'buttons': 1})
            cdp.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x+48*bounds['k'], 'y': y, 'button': 'left', 'clickCount': 1})
            wait_for('routeProbe.presentedAt!=null')
            wait_for('routeProbe.planReadyAt!=null')
            result = evaluate("(()=>{const resources=performance.getEntriesByType('resource'),audio=resources.filter(e=>new URL(e.name).pathname.startsWith('/audio/'));return {...routeProbe,screen:SA.current,audioRequests:audio.length,audioSpanMs:audio.length?Math.max(...audio.map(e=>e.responseEnd))-Math.min(...audio.map(e=>e.startTime)):0,workerRequests:resources.filter(e=>/route-worker/.test(e.name)).length}})()")
            assert result['screen'] == 'battle' and result['runIndex'] == run_index, result
            assert not result['errors'], result['errors']
            assert result['battleStarts'] == 1 and evaluate('SA.S.d.route.departures') == result['departuresBefore'] + 1, result
            assert evaluate('routeBattle.opts.routeData.encounters.every(e=>e.vehicle&&!e.pending)'), '真实遭遇未注入'
            assert result.get('attachedRunId', result['runIdAtFrame']) == result['runIdAtFrame'], result
            assert evaluate("(()=>{const c=[...document.querySelectorAll('#screen canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];return !!c&&c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data[3]>0})()"), '地图画布为空'
            result['gestureToFirstFrameMs'] = result['firstBattleFrameAt'] - result['gestureAt']
            result['gestureToPresentedMs'] = result['presentedAt'] - result['gestureAt']
            result['gestureToPlanReadyMs'] = result['planReadyAt'] - result['gestureAt']
            result['planningMs'] = result.get('routeStartMs', 0) - result['battleStartMs'] if 'routeStartMs' in result else result['battleAt'] - result['startWhenReadyAt']
            result.update(case=preparation, ref=baseline_ref or '工作区', requestedRunIndex=run_index,
                automaticSelectedWarm=preparation == 'ready' and not bool(baseline_ref))
            print(json.dumps(result, ensure_ascii=False), flush=True)
            return result
        finally:
            if cdp:
                cdp.close()
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()
            server.server_close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    parser.add_argument('--baseline-ref', help='可选旧版 Git 引用，所有 JS/config/CSS 在内存提供')
    parser.add_argument('--route', default='r2')
    parser.add_argument('--runs', type=int, nargs='+', default=[3, 4, 5])
    parser.add_argument('--preparation', nargs='+', choices=['cold', 'pending', 'ready'], default=['cold', 'pending', 'ready'])
    args = parser.parse_args()
    for run_index in args.runs:
        for preparation in args.preparation:
            run_case(args.root, args.route, run_index, preparation, args.baseline_ref)
