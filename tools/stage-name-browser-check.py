"""在隔离浏览器中验证关卡标题和车辆铭牌分别显示。"""
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


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='stage-name-', ignore_cleanup_errors=True) as profile:
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
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            for _ in range(100):
                result = cdp.call('Runtime.evaluate', {'expression': '!!window.SA?.Arena?.open && !!SA.S?.d && !!SA.StageCars', 'returnByValue': True})
                if result.get('result', {}).get('value'):
                    break
                time.sleep(.1)
            else:
                raise RuntimeError('游戏未能启动')
            probe = cdp.call('Runtime.evaluate', {'expression': '''(()=>{
              const base=SA.Camp.stage(0,1);
              const record=SA.StageCars.makeRecord(0,1,base,base.vehicle,{name:'小试牛刀',vehicleName:'钉子号'});
              SA.STAGE_CARS.records['0:1']=record;
              SA.StageCars.applyToCampaign();
              SA.S.d.camp.ch=0; SA.S.d.camp.st=1;
              const brush=SA.PX.brush;
              SA.PX.brush=function(...args){if(args[1]===22)window.__arenaTitle=args[0];return brush.apply(this,args)};
              SA.Arena.open();
              const title=document.querySelector('.ch-row[data-page-key="arena:camp:0,1"] .nm')?.textContent;
              const opponent=document.querySelector('.ar-vs .who:last-child .nm b')?.textContent;
              const fields=[...document.querySelectorAll('.ar-dossier .f')].map(node=>node.textContent);
              const vehicle=fields.find(s=>s.startsWith('座驾'));
              const entry=SA.S.arenaEntries('camp').find(e=>e.key==='0,1');
              let battleName;
              const start=SA.Battle.start;
              SA.Battle.start=options=>{battleName=options.enemyName};
              entry.start(); SA.Battle.start=start;
              return {title,posterTitle:window.__arenaTitle,opponent,vehicle,battleName};
            })()''', 'returnByValue': True})
            if 'exceptionDetails' in probe:
                raise RuntimeError(probe['exceptionDetails'])
            value = probe['result']['value']
            assert value['title'] == '小试牛刀', value
            assert value['posterTitle'] == '钉子号', value
            assert value['opponent'] == '钉子号', value
            assert value['vehicle'] == '座驾钉子号', value
            assert value['battleName'] == '钉子号', value
            hot = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{
              SA.current='arena';
              const base=SA.Camp.stage(0,1);
              const record=SA.StageCars.makeRecord(0,1,base,base.vehicle,{name:'小试牛刀',vehicleName:'铆钉号'});
              localStorage.setItem('steam_arena_stage_cars_local_v1',JSON.stringify({version:1,campaignLayout:SA.CAMPAIGN_LAYOUT,records:{'0:1':record}}));
              const channel=new BroadcastChannel('steam-arena-stage-cars');
              channel.postMessage({type:'replace',payload:{version:1,campaignLayout:SA.CAMPAIGN_LAYOUT,records:{'0:1':record}}});
              await new Promise(resolve=>setTimeout(resolve,250)); channel.close();
              const vehicle=[...document.querySelectorAll('.ar-dossier .f')].find(node=>node.textContent.startsWith('座驾'))?.textContent;
              return {posterTitle:window.__arenaTitle,vehicle,opponent:document.querySelector('.ar-vs .who:last-child .nm b')?.textContent};
            })()''', 'returnByValue': True, 'awaitPromise': True})
            if 'exceptionDetails' in hot:
                raise RuntimeError(hot['exceptionDetails'])
            assert hot['result']['value'] == {'posterTitle': '铆钉号', 'vehicle': '座驾铆钉号', 'opponent': '铆钉号'}, hot
            value['hot'] = hot['result']['value']
            cdp.call('Page.reload', {'ignoreCache': True})
            for _ in range(100):
                ready = cdp.call('Runtime.evaluate', {'expression': '!!window.SA?.Arena?.open && !!SA.S?.d && !!SA.StageCars', 'returnByValue': True})
                if ready.get('result', {}).get('value'):
                    break
                time.sleep(.1)
            else:
                raise RuntimeError('刷新后游戏未能启动')
            reloaded = cdp.call('Runtime.evaluate', {'expression': '''(()=>{
              const brush=SA.PX.brush;
              SA.PX.brush=function(...args){if(args[1]===22)window.__arenaTitle=args[0];return brush.apply(this,args)};
              SA.S.d.camp.ch=0; SA.S.d.camp.st=1; SA.Arena.open();
              return {title:document.querySelector('.ch-row[data-page-key="arena:camp:0,1"] .nm')?.textContent,
                posterTitle:window.__arenaTitle,
                vehicle:[...document.querySelectorAll('.ar-dossier .f')].find(node=>node.textContent.startsWith('座驾'))?.textContent};
            })()''', 'returnByValue': True})
            if 'exceptionDetails' in reloaded:
                raise RuntimeError(reloaded['exceptionDetails'])
            assert reloaded['result']['value'] == {'title': '小试牛刀', 'posterTitle': '铆钉号', 'vehicle': '座驾铆钉号'}, reloaded
            value['reload'] = reloaded['result']['value']
            legacy = cdp.call('Runtime.evaluate', {'expression': '''(async()=>{
              SA.current='arena';
              const base=SA.Camp.stage(0,1);
              const record=SA.StageCars.makeRecord(0,1,base,base.vehicle,{name:'旧版关卡名'});
              delete record.vehicleName;
              const channel=new BroadcastChannel('steam-arena-stage-cars');
              channel.postMessage({type:'replace',payload:{version:1,campaignLayout:SA.CAMPAIGN_LAYOUT,records:{'0:1':record}}});
              await new Promise(resolve=>setTimeout(resolve,250)); channel.close();
              return {title:document.querySelector('.ch-row[data-page-key="arena:camp:0,1"] .nm')?.textContent,
                posterTitle:window.__arenaTitle,
                vehicle:[...document.querySelectorAll('.ar-dossier .f')].find(node=>node.textContent.startsWith('座驾'))?.textContent};
            })()''', 'returnByValue': True, 'awaitPromise': True})
            if 'exceptionDetails' in legacy:
                raise RuntimeError(legacy['exceptionDetails'])
            assert legacy['result']['value'] == {'title': '旧版关卡名', 'posterTitle': '旧版关卡名', 'vehicle': '座驾旧版关卡名'}, legacy
            value['legacy'] = legacy['result']['value']
            return value
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
