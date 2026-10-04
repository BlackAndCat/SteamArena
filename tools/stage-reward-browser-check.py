"""在临时关卡配置副本中验证新版控制台奖励录入、校验、保存和刷新。"""
import json
import pathlib
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
from unittest.mock import patch

import serve
from html5_game_mcp import CDP


ROOT = pathlib.Path(__file__).resolve().parent.parent


class IsolatedHandler(serve.NoCache):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        if path.split('?')[0] == '/config/stage-cars.json':
            return serve.STAGE_CARS_FILE
        return super().translate_path(path)

    def log_message(self, *_args):
        pass


class Server(serve.http.server.ThreadingHTTPServer):
    request_queue_size = 64


def evaluate(cdp, expression):
    result = cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in result:
        raise RuntimeError(result['exceptionDetails'])
    return result['result'].get('value')


def wait(cdp, expression):
    for _ in range(200):
        try:
            if evaluate(cdp, expression):
                return
        except RuntimeError:
            pass
        time.sleep(.1)
    raise AssertionError(f'页面状态超时：{expression}')


def run():
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory(prefix='stage-reward-', ignore_cleanup_errors=True) as directory:
        cars = pathlib.Path(directory, 'stage-cars.json')
        cars.write_bytes((ROOT / 'config/stage-cars.json').read_bytes())
        with patch.object(serve, 'STAGE_CARS_FILE', str(cars)):
            server = Server(('127.0.0.1', 0), IsolatedHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                debug = sock.getsockname()[1]
            browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
                '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
                '--remote-allow-origins=*', f'--remote-debugging-port={debug}',
                f'--user-data-dir={directory}/chrome'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(120):
                    try:
                        pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{debug}/json', timeout=1))
                        page = next(item for item in pages if item.get('type') == 'page')
                        break
                    except Exception:
                        time.sleep(.1)
                else:
                    raise AssertionError('隔离 Chrome 启动失败')
                cdp = CDP(page['webSocketDebuggerUrl'])
                url = f'http://127.0.0.1:{server.server_port}/tools/console.html#/stage/0,1/text'
                cdp.call('Page.navigate', {'url': url})
                wait(cdp, '!![...document.querySelectorAll(".stage-body .fs")].find(n=>n.querySelector("h3")?.textContent==="过关奖励")')
                # 同一条奖励记录的 DOM 由新控制台即时重建，按字段标签逐次录入。
                setup = '''(()=>{
                  const box=[...document.querySelectorAll('.stage-body .fs')].find(n=>n.querySelector('h3')?.textContent==='过关奖励');
                  if(!box)throw new Error('奖励区未打开');
                  box.querySelectorAll('.ritem .mini-btn').forEach(b=>b.click());
                  const add=[...box.querySelectorAll('button')].find(b=>b.textContent.includes('加一项'));
                  const set=(node,value,event='input')=>{node.value=value;node.dispatchEvent(new Event(event,{bubbles:true}));};
                  for(const [id,count,mt] of [['plate','3','1'],['tank_s','2','1']]){
                    add.click();let row=box.querySelector('.ritem:last-child');
                    set(row.querySelector('select'),id,'change');row=box.querySelector('.ritem:last-child');
                    set(row.querySelector('input[type=number]'),count);
                    set(row.querySelectorAll('select')[1],mt,'change');
                  }
                  const checks=[...box.querySelectorAll('label.check')];
                  const money=checks.find(x=>x.textContent.includes('发奖金')).querySelector('input');
                  const repair=checks.find(x=>x.textContent.includes('打赢免修理费')).querySelector('input');
                  money.checked=false;money.dispatchEvent(new Event('change',{bubbles:true}));
                  repair.checked=true;repair.dispatchEvent(new Event('change',{bubbles:true}));
                  return {rows:box.querySelectorAll('.ritem').length,prizeDisabled:[...box.querySelectorAll('label.field')]
                    .find(x=>x.textContent.includes('奖金')).querySelector('input').disabled};
                })()'''
                initial = evaluate(cdp, setup)
                assert initial == {'rows': 2, 'prizeDisabled': True}, initial
                invalid = evaluate(cdp, '''(()=>{
                  const row=document.querySelector('.stage-body .ritem');
                  const input=row.querySelector('input[type=number]');
                  input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));
                  document.querySelector('.stage-head .btn.primary').click();return true;
                })()''')
                assert invalid
                wait(cdp, 'document.querySelector("#toast")?.textContent.includes("数量要是正整数")')
                assert json.loads(cars.read_text(encoding='utf-8'))['records']['0:1']['rewardItems'] != [
                    {'id': 'plate', 'count': 3, 'mt': 1}, {'id': 'tank_s', 'count': 2, 'mt': 1}]
                evaluate(cdp, '''(()=>{
                  const input=document.querySelector('.stage-body .ritem input[type=number]');
                  input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));
                  document.querySelector('.stage-head .btn.primary').click();return true;
                })()''')
                for _ in range(200):
                    record = json.loads(cars.read_text(encoding='utf-8'))['records']['0:1']
                    if record.get('rewardItems') == [{'id': 'plate', 'count': 3, 'mt': 1},
                                                     {'id': 'tank_s', 'count': 2, 'mt': 1}]:
                        break
                    time.sleep(.1)
                else:
                    raise AssertionError('奖励行没有写进临时配置：' + str(record.get('rewardItems')))
                assert record['rewardMoney'] is False and record['victoryRepairFree'] is True, record
                cdp.call('Page.navigate', {'url': url.replace('console.html#', 'console.html?reward-reload=1#')})
                wait(cdp, 'location.search.includes("reward-reload=1") && '
                          '!![...document.querySelectorAll(".stage-body .fs")].find(n=>n.querySelector("h3")?.textContent==="过关奖励")')
                restored = evaluate(cdp, '''(()=>{
                  const box=[...document.querySelectorAll('.stage-body .fs')].find(n=>n.querySelector('h3')?.textContent==='过关奖励');
                  return {items:[...box.querySelectorAll('.ritem')].map(row=>({id:row.querySelector('select').value,
                    count:row.querySelector('input[type=number]').value,mt:row.querySelectorAll('select')[1].value})),
                    money:[...box.querySelectorAll('label.check')].find(x=>x.textContent.includes('发奖金')).querySelector('input').checked};
                })()''')
                assert restored == {'items': [{'id': 'plate', 'count': '3', 'mt': '1'},
                                               {'id': 'tank_s', 'count': '2', 'mt': '1'}], 'money': False}, restored
                evaluate(cdp, '''(()=>{
                  while(document.querySelector('.stage-body .ritem .mini-btn'))
                    document.querySelector('.stage-body .ritem .mini-btn').click();
                  document.querySelector('.stage-head .btn.primary').click();return true;
                })()''')
                for _ in range(200):
                    if json.loads(cars.read_text(encoding='utf-8'))['records']['0:1'].get('rewardItems') == []:
                        break
                    time.sleep(.1)
                else:
                    detail = evaluate(cdp, '''JSON.stringify({hash:location.hash,toast:document.querySelector('#toast')?.textContent,
                      status:document.querySelector('#status')?.title,rows:document.querySelectorAll('.stage-body .ritem').length,
                      frame:document.querySelector('#garage-layer iframe')?.contentWindow?.Garage?.info()?.target})''')
                    raise AssertionError(f'清空奖励未保存：{detail}')
                cdp.close()
                return {'saved': record['rewardItems'], 'restored': restored['items'], 'cleared': []}
            finally:
                browser.terminate()
                browser.wait(timeout=10)
                server.shutdown()


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
