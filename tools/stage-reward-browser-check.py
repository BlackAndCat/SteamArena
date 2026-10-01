"""用隔离浏览器验证工作台奖励行的录入、保存与刷新。"""
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
        # 隔离浏览器关页时可能主动断开资源请求。
        try:
            super().handle()
        except ConnectionResetError:
            pass


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(result['exceptionDetails'])
    return result['result'].get('value')


def wait_until(cdp, expression):
    for _ in range(100):
        if evaluate(cdp, expression):
            return
        time.sleep(.1)
    raise RuntimeError(f'页面未准备好：{expression}')


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='stage-reward-', ignore_cleanup_errors=True) as profile:
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
            url = f'http://127.0.0.1:{server.server_port}/tools/stage-editor.html'
            cdp.call('Page.navigate', {'url': url})
            wait_until(cdp, '!!document.querySelector(`#stage-list button[data-ci="0"][data-si="1"]`)')
            result = evaluate(cdp, '''(async()=>{
              const $=id=>document.getElementById(id), rows=()=>[...document.querySelectorAll('#reward-items .reward-row')];
              document.querySelector('#stage-list button[data-ci="0"][data-si="1"]').click();
              document.querySelector('[data-tab="reward"]').click();
              rows().forEach(row=>row.querySelector('button').click());
              for(const item of [{id:'plate',count:'3',mt:'1'},{id:'tank_s',count:'2',mt:'1'}]){
                $('add-reward-item').click();const row=rows().at(-1);
                row.querySelector('.reward-id').value=item.id;
                row.querySelector('.reward-count').value=item.count;
                row.querySelector('.reward-mt').value=item.mt;
              }
              const first=rows()[0].querySelector('.reward-count');
              first.value='0';$('save').click();await new Promise(r=>setTimeout(r,0));
              if(!$('stage-toast').textContent.includes('数量必须是正整数'))throw new Error('零数量未被拒绝');
              first.value='1.5';$('save').click();await new Promise(r=>setTimeout(r,0));
              if(!$('stage-toast').textContent.includes('数量必须是正整数'))throw new Error('小数数量未被拒绝');
              first.value='3';
              const firstId=rows()[0].querySelector('.reward-id'),firstMt=rows()[0].querySelector('.reward-mt');
              firstId.value='';$('save').click();await new Promise(r=>setTimeout(r,0));
              if(!$('stage-toast').textContent.includes('未选择有效物品'))throw new Error('无效物品未被拒绝');
              firstId.value='plate';firstMt.value='';$('save').click();await new Promise(r=>setTimeout(r,0));
              if(!$('stage-toast').textContent.includes('材料不适用于该物品'))throw new Error('无效材料未被拒绝');
              firstMt.value='1';
              const prize=$('prize').value;
              $('reward-money').checked=false;$('reward-money').dispatchEvent(new Event('change'));
              if(!$('prize').disabled||$('prize').value!==prize)throw new Error('关闭金币时奖金未保留并禁用');
              $('reward-money').checked=true;$('reward-money').dispatchEvent(new Event('change'));
              if($('prize').disabled||$('prize').value!==prize)throw new Error('开启金币时奖金未恢复编辑');
              $('reward-money').checked=false;$('reward-money').dispatchEvent(new Event('change'));
              $('victory-repair-free').checked=true;
              $('save').click();
              for(let i=0;i<100&&!SA.STAGE_CARS.records['0:1'];i++)await new Promise(r=>setTimeout(r,50));
              const record=SA.STAGE_CARS.records['0:1'];
              return {items:record?.rewardItems,money:record?.rewardMoney,repair:record?.victoryRepairFree,
                stored:!!localStorage.getItem('steam_arena_stage_cars_local_v1'),prizePreserved:record?.prize===Number(prize),
                prizeDisabled:$('prize').disabled};
            })()''')
            assert result == {'items': [{'id': 'plate', 'count': 3, 'mt': 1}, {'id': 'tank_s', 'count': 2, 'mt': 1}],
                'money': False, 'repair': True, 'stored': True, 'prizePreserved': True, 'prizeDisabled': True}, result
            cdp.call('Page.navigate', {'url': url})
            wait_until(cdp, '!!document.querySelector(`#stage-list button[data-ci="0"][data-si="1"]`)')
            restored = evaluate(cdp, '''(()=>{
              document.querySelector('#stage-list button[data-ci="0"][data-si="1"]').click();
              return {items:[...document.querySelectorAll('#reward-items .reward-row')].map(row=>({
                id:row.querySelector('.reward-id').value,count:row.querySelector('.reward-count').value,
                mt:row.querySelector('.reward-mt').value})),money:document.getElementById('reward-money').checked,
                repair:document.getElementById('victory-repair-free').checked,
                prizeDisabled:document.getElementById('prize').disabled};
            })()''')
            assert restored == {'items': [{'id': 'plate', 'count': '3', 'mt': '1'}, {'id': 'tank_s', 'count': '2', 'mt': '1'}],
                'money': False, 'repair': True, 'prizeDisabled': True}, restored
            cleared = evaluate(cdp, '''(async()=>{
              document.querySelectorAll('#reward-items .reward-row button').forEach(button=>button.click());
              document.getElementById('save').click();
              for(let i=0;i<100&&SA.STAGE_CARS.records['0:1'].rewardItems.length;i++)await new Promise(r=>setTimeout(r,50));
              return SA.STAGE_CARS.records['0:1'].rewardItems;
            })()''')
            assert cleared == [], cleared
            return {'saved': result, 'restored': restored, 'cleared': cleared}
        finally:
            browser.terminate()
            browser.wait(timeout=10)
            server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
