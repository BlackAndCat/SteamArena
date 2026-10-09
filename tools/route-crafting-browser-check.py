"""隔离 Chrome 点击真实车间制作按钮，验证出征物资与竞技场金币分流。"""
import base64
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
    """仅静态读取；文案端点使用内存空档，不接触用户存档或文案。"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith('/__text/load'):
            body = b'{"version":1,"game":"steam-arena","locale":"zh-CN","values":{},"removedElements":[]}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def do_POST(self):
        self.send_error(405)

    def log_message(self, *_args):
        pass


def run():
    """所有状态只在一次性 Chrome 档案内构造，消费操作由真实鼠标事件完成。"""
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='route-craft-', ignore_cleanup_errors=True) as profile:
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
            cdp.call('Page.enable')
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})

            def ev(expression):
                result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
                assert 'exceptionDetails' not in result, result
                return result.get('result', {}).get('value')

            def wait(expression):
                for _ in range(300):
                    if ev(expression):
                        return
                    time.sleep(.05)
                raise AssertionError(expression)

            def click(selector):
                ev("document.querySelector(" + json.dumps(selector) + ").scrollIntoView({block:'center',behavior:'instant'});void 0")
                time.sleep(.15)  # 等既有面板过渡更新命中区域，避免点击刚重建前的旧坐标。
                point = ev("(()=>{const e=document.querySelector(" + json.dumps(selector) + ");const b=e.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2,hit=document.elementFromPoint(x,y);return {x,y,hit:!!hit&&(hit===e||e.contains(hit)),blocked:hit?.outerHTML.slice(0,240)}})()")
                assert point.pop('hit'), (selector, point)
                point.pop('blocked')
                for kind in ('mousePressed', 'mouseReleased'):
                    cdp.call('Input.dispatchMouseEvent', {'type': kind, **point, 'button': 'left', 'clickCount': 1})

            wait("!!document.querySelector('.title-route')")
            # 教程已读只写一次性档案，避免新手剧情遮挡本用例的制作按钮。
            ev("['arena','garage','stats','shop'].forEach(id=>SA.Story.mark('guide:'+id));SA.S.setPlayMode('route');SA.S.d.route.materials=10000;SA.S.d.money=12345;SA.S.save();document.querySelector('.title-route').click();void 0")
            wait("!!document.querySelector('[data-page-key=\"arena:route:r1\"]')")
            wait("!document.querySelector('.title-screen,.title.out')")
            ev("SA.nav('garage');SA.Editor.focusInv('water',true);void 0")
            click('[data-page-key="inventory:water"]')
            wait("!!document.querySelector('.dock-ctx .acts button')")
            initial = ev("({balance:SA.S.d.route.materials,money:SA.S.d.money,n:SA.S.invCount('water',1),cost:SA.S.craftPrice('water'),shop:SA.Camp.has('shop'),text:document.querySelector('.panel-tools').innerText})")
            assert initial['shop'] and '制作物资' in initial['text'], initial
            click('.dock-ctx .acts button')
            after = ev("({balance:SA.S.d.route.materials,money:SA.S.d.money,n:SA.S.invCount('water',1)})")
            assert after == {'balance': initial['balance']-initial['cost'], 'money': initial['money'], 'n': initial['n']+1}, (initial, after)
            ev("SA.S.d.route.materials=0;SA.Editor.refresh();void 0")
            click('.dock-ctx .acts button')
            wait("document.body.innerText.includes('制作物资不足')")
            short = ev("({balance:SA.S.d.route.materials,money:SA.S.d.money,n:SA.S.invCount('water',1),text:document.body.innerText})")
            assert short['balance'] == 0 and short['money'] == after['money'] and short['n'] == after['n'] and '制作物资不足' in short['text'], short
            # 奖励结算沿已有渲染接口呈现，再由真实按钮进入车间。
            ev("SA.S.d.route.radiatorRewardClaimed=true;SA.ExpeditionUI.afterRoute({mode:'route',how:'recall',materials:42,items:[{id:'radiator',n:1}],cargo:[],lost:[]});void 0")
            tally = ev("document.querySelector('[data-page-key=\"route-tally-mid\"]').innerText")
            assert '本次制作物资 +42' in tally and '已解锁制作' in tally, tally
            screenshot = pathlib.Path(tempfile.gettempdir()) / 'steam-arena-route-crafting.png'
            screenshot.write_bytes(base64.b64decode(cdp.call('Page.captureScreenshot')['data']))
            click('.ar-tally-go button')
            wait("!!document.querySelector('.ed')")
            assert ev("SA.S.isRouteMode()"), '结算进车间丢失出征上下文'
            ev("SA.Editor.focusInv('radiator',true);void 0")
            assert ev("!!document.querySelector('[data-page-key=\"inventory:radiator\"]')"), '散热器制作资格未呈现'
            # 库存不足时点击改装台，实际经过 withStock 自动制作再安装。
            ev("SA.S.d.route.materials=1000;delete SA.S.d.inv.radiator;SA.Editor.refresh();void 0")
            click('[data-page-key="inventory:radiator"]')
            target = ev("""(()=>{const v=SA.S.d.vehicle,K=SA.K,C=K.CELL,P=SA.SPR.PADX,W=K.COLS*C+P*2;
              const cv=document.querySelector('.ed-stage canvas');cv.scrollIntoView({block:'center'});const b=cv.getBoundingClientRect();
              let c0=K.COLS,c1=-1;SA.V.each(v,(cell,r,c)=>{c0=Math.min(c0,c);c1=Math.max(c1,c+SA.fp(cell.id).w-1)});
              const pan=Math.round(Math.max(-5*C,Math.min(5*C,W/2-(P+(c0+c1+1)/2*C))));
              for(let r=0;r<K.ROWS;r++)for(let c=0;c<K.COLS;c++){
                const hv={r,c,fr:r+.5,fc:c+.5},sp=SA.V.editorSpot('radiator',hv,v);
                if(!sp.hits.length&&SA.V.canPut(v,'radiator',sp.r,sp.c).ok){
                  const x=b.x+(P+(c+.5)*C+pan)/W*b.width,y=b.y+(r+.5)*C/cv.height*b.height;
                  if(x>b.x&&x<b.right&&document.elementFromPoint(x,y)===cv)return {x,y};}}
              return null})()""")
            assert target, '没有可点击的散热器安装位置'
            cdp.call('Input.dispatchMouseEvent', {'type':'mouseMoved', **target})
            wait("document.querySelector('.ed-tip').innerText.includes('制作 · 82 物资')")
            route_hover = ev("document.querySelector('.ed-tip').innerText")
            assert '£' not in route_hover, route_hover
            for kind in ('mousePressed', 'mouseReleased'):
                cdp.call('Input.dispatchMouseEvent', {'type':kind, **target,'button':'left','clickCount':1})
            installed = ev("(()=>{let n=0;SA.V.each(SA.S.d.vehicle,c=>{if(c.id==='radiator')n++});return {n,balance:SA.S.d.route.materials,money:SA.S.d.money,cost:SA.S.craftPrice('radiator')}})()")
            assert installed['n']==1 and installed['balance']==1000-installed['cost'] and installed['money']==after['money'], installed
            # 真实页签选择必须持久化；模拟重载存档后默认打开也应保持所选玩法。
            ev("SA.Arena.open('route',true);SA.S.save();void 0")
            click('.ar-chalk .ch-tabs .ch-tab:first-child')
            ev("SA.S.load();SA.Arena.open(undefined,true);void 0")
            assert ev("SA.S.d.playMode==='campaign'&&!SA.S.isRouteMode()&&document.querySelector('.ar-chalk .ch-tabs .ch-tab:first-child').classList.contains('on')"), '切战役后重载恢复了出征'
            click('.ar-chalk .ch-tabs .ch-tab:last-child')
            ev("SA.S.load();SA.Arena.open(undefined,true);void 0")
            assert ev("SA.S.d.playMode==='route'&&SA.S.isRouteMode()&&document.querySelector('.ar-chalk .ch-tabs .ch-tab:last-child').classList.contains('on')"), '切出征后重载丢失上下文'
            click('.ar-chalk .ch-tabs .ch-tab:first-child')
            ev("SA.S.load();void 0")
            assert not ev("SA.S.isRouteMode()"), '切战役未恢复金币上下文'
            # 战役购买权限仅为隔离用例开放，£ 购买沿原 UI.pay 扣款。
            ev("SA.S.d.camp.feat.push('garage','shop');SA.S.d.camp.mods.push('water');SA.nav('garage');SA.Editor.focusInv('water',true);void 0")
            click('[data-page-key="inventory:water"]')
            wait("!!document.querySelector('.dock-ctx .acts button')")
            before = ev("({money:SA.S.d.money,balance:SA.S.d.route.materials,n:SA.S.invCount('water',1),label:document.querySelector('.dock-ctx .acts button').innerText})")
            assert '£' in before['label'], before
            click('.dock-ctx .acts button')
            paid = ev("({money:SA.S.d.money,balance:SA.S.d.route.materials,n:SA.S.invCount('water',1)})")
            assert paid['money'] == before['money']-initial['cost'] and paid['balance'] == before['balance'] and paid['n'] == before['n']+1, paid
            # 英文使用正式语言入口加载，验证同一缺库存提示不会回退到英镑。
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/?lang=en'})
            wait("!!document.querySelector('.title-route')")
            ev("document.querySelector('.title-route').click();void 0")
            wait("!document.querySelector('.title-screen,.title.out')")
            ev("SA.S.d.vehicle=SA.S.starterVehicle();SA.S.d.route.radiatorRewardClaimed=true;delete SA.S.d.inv.radiator;SA.nav('garage');SA.Editor.focusInv('radiator',true);void 0")
            click('[data-page-key="inventory:radiator"]')
            cdp.call('Input.dispatchMouseEvent', {'type':'mouseMoved', **target})
            wait("document.querySelector('.ed-tip').innerText.includes('Craft · 82 materials')")
            english_hover = ev("document.querySelector('.ed-tip').innerText")
            assert '£' not in english_hover, english_hover
            print(json.dumps({'route': after, 'installed':installed,'routeHover':route_hover,'englishHover':english_hover,'insufficient': {k:v for k,v in short.items() if k!='text'}, 'campaign':paid,'tally':tally,'screenshot':str(screenshot)}, ensure_ascii=False))
        finally:
            if cdp:
                cdp.close()
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    run()
