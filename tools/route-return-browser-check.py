"""隔离 Chrome 验证真实返航耗时、首帧像素与持续动画；旧 home 仅以内存覆盖。"""
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
window.returnProbe={errors:[],longtasks:[],runs:[]};
addEventListener('error',e=>returnProbe.errors.push(e.message||'资源错误'),true);
addEventListener('unhandledrejection',e=>returnProbe.errors.push(String(e.reason)));
new PerformanceObserver(list=>returnProbe.longtasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask'});
"""
SETUP = """
(()=>{const p=returnProbe, now=()=>performance.now();p.animationTimes=[];
  const rgba=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s='';for(let i=0;i<d.length;i+=8192)s+=String.fromCharCode(...d.subarray(i,i+8192));return {w:c.width,h:c.height,rgba:btoa(s)}};
  const wrap=(obj,key,tag,adjust)=>{const old=obj[key];obj[key]=function(...args){
    if(adjust)adjust(args);const label=tag==='render'?(args[1]?.key==='home'?'homeRender':args[1]?.key==='route-tally'?'tallyRender':'battleRender'):tag;const at=now();try{const out=old.apply(this,args);
      if(p.active&&['hero','carShadow','base'].includes(tag))p.canvases[tag]=tag==='carShadow'?out.c:out;
      return out;
    }finally{if(p.active){const m=p.active.parts[label]||(p.active.parts[label]={count:0,ms:0});m.count++;m.ms+=now()-at}}}};
  SA.HomeScene.weather=()=> 'fog';
  wrap(SA.SPR,'renderVehicle','render',args=>{if(p.active&&args[1]?.key==='home')args[1]={...args[1],t:7.5}});
  wrap(SA.HomeScene,'hero','hero');wrap(SA.HomeScene,'carShadow','carShadow');wrap(SA.HomeScene,'base','base');
  wrap(SA.Home,'open','homeOpen');wrap(SA.Home,'board','homeBoard');wrap(SA.ExpeditionUI,'render','tally');
  const after=SA.ExpeditionUI.afterRoute;
  SA.ExpeditionUI.afterRoute=function(r){const a=p.active;a.afterAt=now();
    // 固定合法结算载荷仅留在隔离档案，用真实 runId 验证物资、累计赠品和重复结算保护。
    Object.assign(r,{metal:2,enemiesCleared:1,cargo:[{kind:'supply'}]});
    const out=after.call(this,r);a.afterMs=now()-a.afterAt;
    a.how=r.how;a.settled=r.settled;a.materials=SA.S.d.route.materials;a.radiators=SA.S.invCount('radiator',1);a.items=r.items;a.info=document.querySelector('.ar-tally').innerText;
    SA.Route.settle(r);a.once=a.materials===SA.S.d.route.materials&&a.radiators===SA.S.invCount('radiator',1);
    a.initialParts=JSON.parse(JSON.stringify(a.parts));p.active=null;
    const board=document.querySelector('.yard-board');a.boardDuration=getComputedStyle(board).transitionDuration;
    const stable=()=>{if(board.classList.contains('down')&&board.getAnimations().every(x=>x.playState==='finished')){
      a.stableAt=now();a.pixels=Object.fromEntries(Object.entries(p.canvases).map(([k,c])=>[k,rgba(c)]));a.done=true;
    }else requestAnimationFrame(stable)};
    requestAnimationFrame(()=>requestAnimationFrame(()=>{a.presentedAt=now();requestAnimationFrame(stable)}));return out};
  const timeout=setTimeout;window.setTimeout=function(fn,delay,...args){if(p.active&&[500,1100].includes(delay)&&new Error().stack.includes('battle-view.js')){p.active.endAt=now();p.active.plannedDelayMs=delay}return timeout(fn,delay,...args)};
  const raf=requestAnimationFrame;window.requestAnimationFrame=function(fn){if(p.active&&String(fn).includes('afterRoute')&&new Error().stack.includes('battle-view.js')){p.active.endAt=now();p.active.plannedDelayMs=0}return raf(fn)};
  const render=SA.SPR.renderVehicle;SA.SPR.renderVehicle=function(...args){if(!p.active&&args[1]?.key==='home'){p.animationCalls=(p.animationCalls||0)+1;p.animationTimes.push(args[1].t)}return render.apply(this,args)};
})()
"""


def run_case(baseline=None, vehicle='starter', weather='fog', baseline_view=None, ending='recall'):
    """真实结束事件的定格等待、结算 CPU 和既有黑板动画分别计时，隔离材料和赠品入库。"""
    old_home = pathlib.Path(baseline).read_bytes() if baseline else None
    old_view = pathlib.Path(baseline_view).read_bytes() if baseline_view else None
    class Handler(NoCache):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)
        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            body = old_home if path == '/js/home.js' else None
            if path == '/js/battle-view.js':
                body = old_view
            if path.startswith('/__text/load'):
                body = b'{"version":1,"game":"steam-arena","locale":"zh-CN","values":{},"removedElements":[]}'
            if body is None:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript' if path == '/js/home.js' else 'application/json')
            self.end_headers()
            self.wfile.write(body)
        def do_POST(self):
            self.send_error(405)
        def log_message(self, *_args):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='route-return-', ignore_cleanup_errors=True) as profile:
        port = 19000 + server.server_port % 20000
        browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--window-size=1440,1000',
            f'--remote-debugging-port={port}', '--remote-allow-origins=*', f'--user-data-dir={profile}',
            '--no-first-run', '--no-default-browser-check'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cdp = None
        try:
            for _ in range(60):
                try:
                    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1))
                    page = next(p for p in pages if p.get('type') == 'page')
                    break
                except Exception:
                    time.sleep(.1)
            else:
                raise AssertionError('隔离 Chrome 启动失败')
            cdp = CDP(page['webSocketDebuggerUrl'])
            cdp.sock.settimeout(60)
            cdp.call('Page.enable')
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': PROBE})
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            def ev(expr):
                r = cdp.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                assert 'exceptionDetails' not in r, r
                return r.get('result', {}).get('value')
            def wait(expr):
                for _ in range(600):
                    if ev(expr):
                        return
                    time.sleep(.05)
                raise AssertionError(expr+' '+str(ev("({current:SA.current,text:document.body.innerText.slice(-600)})")))
            def click(selector):
                point = ev("(()=>{const e=document.querySelector("+json.dumps(selector)+");e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()")
                assert point.pop('hit'), (selector, point)
                for kind in ('mousePressed', 'mouseReleased'):
                    cdp.call('Input.dispatchMouseEvent', {'type': kind, **point, 'button': 'left', 'clickCount': 1})
            wait("!!document.querySelector('.title-route')")
            ev("SA.S.d.vehicle=SA.S.starterVehicle();Object.assign(SA.S.d.route,{materials:0,defeatedEnemies:0,radiatorRewardClaimed:false});document.querySelector('.title-route').click();void 0")
            wait("!!document.querySelector('.yard-board')&&!document.querySelector('.title-screen,.title.out')")
            if vehicle == 'large':
                ev("(()=>{const cars=SA.OPPONENTS.map((_,i)=>SA.S.opponent(i).vehicle).filter(v=>SA.V.stats(v).canDeploy);const size=v=>v.body.flat().filter(Boolean).length;cars.sort((a,b)=>size(b)-size(a));SA.S.d.vehicle=cars[0];return {name:cars[0].name,size:size(cars[0])}})()")
            ev(SETUP)
            ev('SA.HomeScene.weather=()=>'+json.dumps(weather))
            for index in range(2):
                ev("window.returnBattle=SA.Route.start('r1',{difficulty:false,seed:42});void 0")
                wait("SA.current==='battle'")
                time.sleep(.3)
                finish = 'SA.Route.recall()' if ending == 'recall' else 'returnBattle.route.coal=0'
                ev(f"returnProbe.animationCalls=0;returnProbe.animationTimes=[];returnProbe.canvases={{}};returnProbe.active={{kind:{json.dumps('cold' if index == 0 else 'warm')},parts:{{}},recallAt:performance.now()}};returnProbe.runs.push(returnProbe.active);{finish};void 0")
                wait(f'returnProbe.runs[{index}].done')
                assert ev("!!document.querySelector('.ar-tally')&&SA.current==='arena'"), '结算黑板未显示'
                time.sleep(.45)
                assert ev('returnProbe.animationTimes.length>=2&&new Set(returnProbe.animationTimes).size>=2'), '车图动态时钟或重绘停止'
                ev(f"returnProbe.runs[{index}].animationPixelsChanged=document.querySelector('.home-car canvas').toDataURL()!==returnProbe.canvases.hero.toDataURL();void 0")
                # 原结算面板底部按钮在部分窗口被裁切，Esc 是已有真实返院操作，不改布局。
                cdp.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
                cdp.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
                wait("SA.current==='home'&&!document.querySelector('.yard-board')")
            click('.home-car')
            wait("SA.current==='garage'")
            result = ev('({...returnProbe,canvases:undefined})')
            assert not result['errors'], result['errors']
            for run in result['runs']:
                run['vehicle'] = ev('SA.S.d.vehicle.name')
                run['weather'] = weather
                run['eventToAfterMs'] = run['afterAt'] - run['endAt']
                run['afterToPresentedMs'] = run['presentedAt'] - run['afterAt']
                run['eventToPresentedMs'] = run['presentedAt'] - run['endAt']
                run['eventToStableUsableMs'] = run['stableAt'] - run['endAt']
                run['longtasks'] = [e for e in result['longtasks'] if e['start'] < run['afterAt'] + run['afterMs'] and e['start'] + e['ms'] > run['afterAt']]
                assert run['settled'] and run['once'] and '制作物资' in run['info'], run['info']
                assert run['how'] == ending
                assert run['boardDuration'] == '0.5s', '黑板动画时长变化'
            assert result['runs'][0]['materials'] == 50 and result['runs'][1]['materials'] == 100
            assert result['runs'][1]['radiators'] == result['runs'][0]['radiators'] + 1, '第二辆敌车赠品未入库'
            return result['runs']
        finally:
            if cdp:
                cdp.close()
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-home', type=pathlib.Path, help='先前 home 源码路径；不执行 Git、不改源文件')
    parser.add_argument('--baseline-view', type=pathlib.Path, help='先前 battle-view 源码；仅内存覆写相同环境')
    parser.add_argument('--baseline-only', action='store_true')
    parser.add_argument('--vehicle', choices=['starter', 'large'], default='starter', help='初始车或既有合法对手中模块最多的车')
    parser.add_argument('--weather', choices=['sun', 'fog', 'rain', 'night'], default='fog')
    parser.add_argument('--ending', choices=['recall', 'stranded'], default='recall', help='主动返航或耗尽煤炭，由实际 RAF 判定结束')
    args = parser.parse_args()
    before = run_case(args.baseline_home, args.vehicle, args.weather, args.baseline_view, args.ending) if args.baseline_home else None
    after = None if args.baseline_only else run_case(None, args.vehicle, args.weather, ending=args.ending)
    if before and after:
        for old, new in zip(before, after):
            assert old['pixels'] == new['pixels'], '固定时间的车图、天气底图或车影 RGBA 变化'
            assert old['initialParts']['homeRender']['count'] == 3 and new['initialParts']['homeRender']['count'] == 1
            assert old['initialParts']['tallyRender']['count'] == new['initialParts']['tallyRender']['count'] == 1
    for name, results in [('旧版', before), ('新版', after)]:
        if results:
            for run in results:
                run.pop('pixels')
                run.pop('parts')
                print(json.dumps({'version': name, **run}, ensure_ascii=False), flush=True)
