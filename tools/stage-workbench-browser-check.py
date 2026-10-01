"""用隔离 Chrome 核对关卡车工作台的全模块清单、拼装和画布尺寸。"""
import http.server
import json
import pathlib
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request

from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def handle(self):
        # 关页时 Chrome 主动断开资源请求，静默处理测试服务的连接重置。
        try:
            super().handle()
        except ConnectionResetError:
            pass


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(result['exceptionDetails'])
    return result['result']['value']


def wait_until(cdp, expression):
    for _ in range(100):
        if evaluate(cdp, expression):
            return
        time.sleep(.1)
    raise RuntimeError(f'页面未准备好：{expression}')


def measure(cdp):
    return evaluate(cdp, '''(()=>{
      const rect = selector => {
        const r = document.querySelector(selector)?.getBoundingClientRect();
        return r && {width:Math.round(r.width),height:Math.round(r.height)};
      };
      return {screen:rect('.assembly-screen'),stage:rect('.assembly-screen .ed-stage'),
        canvas:rect('.assembly-screen .ed-stage > canvas'),panel:rect('.assembly-screen .ed-panel'),
        allTab:!!document.querySelector('.assembly-screen .ed-tab[title="全部模块"]')};
    })()''')


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='stage-workbench-', ignore_cleanup_errors=True) as profile:
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
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source':
                'window.__pageErrors=[];window.addEventListener("error",event=>window.__pageErrors.push(event.message));'})
            base = f'http://127.0.0.1:{server.server_port}/tools/'
            cdp.call('Page.navigate', {'url': base + 'module-candidates.html'})
            wait_until(cdp, '!!window.SA?.ARTPLAN?.MODS')
            reference = evaluate(cdp, 'Object.keys(SA.ARTPLAN.MODS)')
            assert len(reference) == 46, len(reference)
            evaluate(cdp, '(localStorage.setItem("steam_arena_cat_v1","energy"), true)')
            results = {}
            for width, height in ((1280, 800), (1920, 1080)):
                cdp.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False})
                cdp.call('Page.navigate', {'url': base + 'stage-editor.html'})
                wait_until(cdp, '!!document.querySelector(".assembly-screen .ed-stage > canvas")')
                time.sleep(.3)
                # 先用原页面布局参数测量同一浏览器里的基线，再恢复本次布局。
                before = evaluate(cdp, '''(()=>{
                  const old=document.createElement('style'); old.id='stage-old-layout';
                  old.textContent=`body{max-width:1500px;padding:16px}.layout{grid-template-columns:250px minmax(0,1fr);gap:14px}
                    .assembly-screen{min-height:650px;height:min(780px,72vh);overflow:hidden}
                    .assembly-screen .ed{min-width:0;grid-template-columns:290px minmax(0,1fr) minmax(300px,380px);grid-template-rows:auto}
                    .assembly-screen .ed-main,.assembly-screen .ed-sheet,.assembly-screen .ed-cat{grid-column:auto;grid-row:auto}
                    .assembly-screen .ed-sheet{max-height:none}`;
                  document.head.append(old);return true;
                })()''')
                assert before
                time.sleep(.2)
                baseline = measure(cdp)
                evaluate(cdp, '(document.getElementById("stage-old-layout").remove(), true)')
                time.sleep(.2)
                after = measure(cdp)
                assert after['canvas']['width'] > baseline['canvas']['width'] * 1.25, (baseline, after)
                assert after['canvas']['height'] > baseline['canvas']['height'] * 1.25, (baseline, after)
                assert after['screen']['height'] > baseline['screen']['height'], (baseline, after)
                probe = evaluate(cdp, '''(()=>{
                  const rows=[...document.querySelectorAll('.assembly-screen .panel-list .mrow')];
                  const ids=[...new Set(rows.map(row=>SA.parseKey(row.dataset.pageKey?.replace(/^inventory:/,'')).id))];
                  return {ids,defaultAll:document.querySelector('.assembly-screen .ed-tab.on')?.title,
                    searchVisible:!document.getElementById('stage-module-search')?.hidden,
                    normalCategory:localStorage.getItem('steam_arena_cat_v1')};
                })()''')
                missing = sorted(set(reference) - set(probe['ids']))
                assert not missing, missing
                assert probe['defaultAll'] == '全部模块', probe
                assert probe['searchVisible'], probe
                assert probe['normalCategory'] == 'energy', probe
                results[f'{width}x{height}'] = {'before': baseline, 'after': after,
                    'referenceModules': len(reference), 'visibleModules': len(probe['ids'])}
                if width == 1280:
                    interaction = evaluate(cdp, '''(()=>{
                      const tab=[...document.querySelectorAll('.assembly-screen .ed-tab')]
                        .find(node=>node.title && node.title!=='全部模块');
                      tab.click();
                      const subset=new Set([...document.querySelectorAll('.assembly-screen .mrow')]
                        .map(row=>SA.parseKey(row.dataset.pageKey.replace(/^inventory:/,'')).id)).size;
                      document.querySelector('.assembly-screen .ed-tab[title="全部模块"]').click();
                      const all=new Set([...document.querySelectorAll('.assembly-screen .mrow')]
                        .map(row=>SA.parseKey(row.dataset.pageKey.replace(/^inventory:/,'')).id)).size;
                      const search=document.getElementById('stage-module-search');
                      search.value='mg_heavy';search.dispatchEvent(new Event('input',{bubbles:true}));
                      const searched=[...document.querySelectorAll('.assembly-screen .mrow:not([hidden])')]
                        .map(row=>SA.parseKey(row.dataset.pageKey.replace(/^inventory:/,'')).id);
                      search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
                      const unselectable=[];
                      for(const id of Object.keys(SA.MODULES).filter(id=>!SA.MODULES[id].retired)) {
                        const item=[...document.querySelectorAll('.assembly-screen .mrow')]
                          .find(node=>SA.parseKey(node.dataset.pageKey.replace(/^inventory:/,'')).id===id);
                        item.click();
                        if(!document.querySelector(`.assembly-screen .mrow.sel[data-page-key="${item.dataset.pageKey}"]`)) unselectable.push(id);
                      }
                      const row=[...document.querySelectorAll('.assembly-screen .mrow')]
                        .find(node=>node.dataset.pageKey==='inventory:'+SA.invKey('mg_s',1));
                      row.click();
                      const selected=!!document.querySelector(`.assembly-screen .mrow.sel[data-page-key="inventory:${SA.invKey('mg_s',1)}"]`);
                      const visible=id=>{
                        const node=document.getElementById(id),box=node?.getBoundingClientRect();
                        return !!box && box.width>0 && box.height>0;
                      };
                      const saveVisible=visible('save'),stageListVisible=visible('stage-list');
                      document.querySelector('[data-tab="fields"]').click();
                      const namesVisible=visible('name') && visible('vehicle-name');
                      document.querySelector('[data-tab="assembly"]').click();
                      const assemblyVisible=visible('assembly-screen');
                      const v=SA.S.d.vehicle, key=SA.invKey('mg_s',1), before=SA.S.d.inv[key];
                      const cv=document.querySelector('.assembly-screen .ed-stage > canvas');
                      const W=cv.width,H=cv.height,C=SA.K.CELL,P=SA.SPR.PADX,MX=5*C;
                      let c0=SA.K.COLS,c1=-1;
                      SA.V.each(v,(cell,r,c)=>{c0=Math.min(c0,c);c1=Math.max(c1,c+SA.fp(cell.id).w-1)});
                      const cx=c1<0?W/2:P+(c0+c1+1)/2*C;
                      const pan=Math.round(Math.max(-MX,Math.min(MX,W/2-cx)));
                      const rect=cv.getBoundingClientRect(); let placed=null;
                      for(let r=0;r<SA.K.ROWS && !placed;r++)for(let c=0;c<SA.K.COLS && !placed;c++) {
                        if(!SA.V.boxInRegion(v,r,c,1,1) || !SA.V.placeCheck(v,'mg_s',r,c).ok)continue;
                        const x=rect.left+(P+(c+.5)*C+pan)/W*rect.width;
                        const y=rect.top+((r+.5)*C)/H*rect.height;
                        cv.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:9,clientX:x,clientY:y,bubbles:true}));
                        if(SA.S.d.inv[key]===before-1)placed={r,c};
                      }
                      return {subset,all,searched,selected,unselectable,placed,
                        operationsVisible:saveVisible&&stageListVisible&&namesVisible&&assemblyVisible,
                        normalCategory:localStorage.getItem('steam_arena_cat_v1')};
                    })()''')
                    assert interaction['subset'] < 46 and interaction['all'] == 46, interaction
                    assert interaction['searched'] == ['mg_heavy'] * len(interaction['searched']) and interaction['searched'], interaction
                    assert interaction['selected'] and not interaction['unselectable'], interaction
                    assert interaction['placed'] and interaction['normalCategory'] == 'energy', interaction
                    assert interaction['operationsVisible'], interaction
                    results['interaction'] = interaction
            cdp.call('Page.navigate', {'url': base + 'spritesheet.html'})
            wait_until(cdp, 'document.querySelectorAll("#mt canvas").length >= 170')
            sprites = evaluate(cdp, '''(()=>{
              const canvases=[...document.querySelectorAll('#s canvas,#g canvas,#mt canvas')];
              const blank=canvases.filter(cv=>{
                const data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
                for(let i=3;i<data.length;i+=4)if(data[i])return false;
                return true;
              });
              return {total:canvases.length,blank:blank.length,errors:window.__pageErrors||[]};
            })()''')
            assert sprites['total'] >= 200 and sprites['blank'] == 0 and not sprites['errors'], sprites
            results['sprites'] = sprites
            cdp.call('Page.navigate', {'url': base + '../index.html'})
            wait_until(cdp, '!!window.SA?.Battle?.debug && !!SA.S?.d && !!SA.Camp')
            battle = evaluate(cdp, '''(()=>{
              SA.S.reset();
              SA.Story.mark('tutorial'); // 隔离存档内跳过对话，验证首关真实战斗画面和开火。
              const stage=SA.Camp.stage(0,0);
              SA.Battle.start({mode:'campaign',enemyVehicle:stage.vehicle,enemyName:stage.name,
                terrain:stage.terrain||'flat'});
              window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));
              const B=SA.Battle.debug.B;
              let target;
              SA.V.each(B.e.v,(cell,r,c)=>{if(!target&&SA.isCockpit(cell.id))target=SA.Battle.debug.cellCenter('e',r,c)});
              SA.Battle.debug.aimWorld(...target);
              B.keys.fire=true;
              SA.Battle.debug.step(8);
              return {current:SA.current,canvas:!!document.querySelector('.bt-canvas-wrap canvas'),
                playerWeapons:B.p.weapons.length,fire:B.p.events.fire||0,errors:window.__pageErrors||[]};
            })()''')
            assert battle['current'] == 'battle' and battle['canvas'] and battle['playerWeapons'] > 0, battle
            assert battle['fire'] > 0 and not battle['errors'], battle
            results['firstStage'] = battle
            return results
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
