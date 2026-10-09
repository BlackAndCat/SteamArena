"""在隔离 Chrome 中调用游戏真实渲染器，导出指定 JSON 每辆车的原始 PNG。"""
import base64
import http.server
import hashlib
import importlib.util
import json
import pathlib
import sys
import threading
import time

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('visual_shot', ROOT / 'tools/visual-shot.py')
shot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shot)


class Handler(http.server.SimpleHTTPRequestHandler):
    """只提供静态 GET，拒绝任何配置写入。"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        self.send_response(403)
        self.end_headers()

    def log_message(self, *_args):
        pass


def main():
    # 联系图可复用已经核验的真实 PNG，避免重新渲染或覆盖先前批次图片及指纹清单。
    contact_only = '--contact-only' in sys.argv
    if contact_only:
        sys.argv.remove('--contact-only')
    inputs = [pathlib.Path(item) for item in sys.argv[1].split(',')]
    documents = [json.loads(item.read_text(encoding='utf-8')) for item in inputs]
    # 章名由输入stageId确定，第三章复用同一真实渲染流程；不重新输出已完成章节的原图。
    chapter_names = {2: '第二章', 3: '第三章', 4: '第四章', 5: '第五章'}
    chapter_label = '、'.join(dict.fromkeys(chapter_names.get(int(document['stageId'].split(':')[0]),
        '第' + document['stageId'].split(':')[0] + '章') for document in documents))
    data = {'candidates': [car for document in documents for car in document['candidates']]}
    labels = {car['id']: {'budgetLimit': document.get('spec', {}).get('budget'),
                          'recommended': car['id'] == document.get('temporaryReferenceId')}
              for document in documents for car in document['candidates']}
    recommended_only = len(sys.argv) > 4 and sys.argv[4] == 'recommended'
    if recommended_only:
        data['candidates'] = [car for car in data['candidates'] if labels[car['id']]['recommended']]
    elif len(sys.argv) > 4:
        # 单车定向修订只重渲染该 ID，其余候选图片与记录保留。
        data['candidates'] = [car for car in data['candidates'] if car['id'] == sys.argv[4]]
    output = pathlib.Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    process, cdp = shot.launch()
    results = []
    rendered_images = []
    try:
        cdp.call('Page.enable')
        cdp.call('Runtime.enable')
        cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/tools/console.html'})
        for _ in range(200):
            try:
                if shot.evaluate(cdp, '!!window.SA?.SPR?.renderVehicle && !!SA.V?.fromCells'):
                    break
            except Exception:
                pass
            time.sleep(.1)
        else:
            raise RuntimeError('游戏渲染器加载超时')
        for car in data['candidates']:
            filename = output / (car['id'].replace(':', '-') + '.png')
            if contact_only:
                rendered = {'png': 'data:image/png;base64,' + base64.b64encode(filename.read_bytes()).decode('ascii')}
            else:
                expression = '''(() => { const item = %s;
                const v = SA.V.fromCells(item.name, item.cells);
                v.lim = {cols:8,rows:6};
                const canvas = SA.SPR.renderVehicle(v,{key:item.id,t:0,heat:.45,water:.8});
                return {png:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};
                })()''' % json.dumps(car, ensure_ascii=False)
                rendered = shot.evaluate(cdp, expression)
            rendered_images.append({'id': car['id'], 'name': car['name'], 'png': rendered['png'],
                                    'budget': car.get('budget'), 'validation': car.get('validation'),
                                    'tests': car.get('battleTests'), **labels[car['id']]})
            if not contact_only:
                filename.write_bytes(base64.b64decode(rendered['png'].split(',')[1]))
                cells = json.dumps(car['cells'], ensure_ascii=False, separators=(',', ':')).encode('utf-8')
                results.append({'id': car['id'], 'out': str(filename), 'width': rendered['width'], 'height': rendered['height'],
                                'cellsFingerprint': hashlib.sha256(cells).hexdigest(),
                                'pngFingerprint': hashlib.sha256(filename.read_bytes()).hexdigest()})
        # 联系图只排版真实原图，既不改变车辆渲染也不美化画面。
        if len(sys.argv) > 3 and sys.argv[3]:
            expression = '''(async () => { const items = %s, cols = 3, width = 440, height = 372;
              const canvas = document.createElement('canvas'); canvas.width = cols*width;
              canvas.height = Math.ceil(items.length/cols)*height+64; const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#e8dcb5';ctx.fillRect(0,0,canvas.width,canvas.height);
              ctx.imageSmoothingEnabled = false;ctx.font = '16px sans-serif';
              ctx.fillStyle='#34210f';ctx.fillText('AI生成 · '+%s+' · '+items.length+'台'+
                (items.every(item=>item.recommended)?'推荐参考车':'候选'),8,22);
              ctx.font='14px sans-serif';ctx.fillText('真实游戏渲染 · 测试局数见卡片 · 胜率=(胜+0.5×平)/总局数 · 双方瞄准0.8 · 各车目标见卡片',8,44);
              for(let i=0;i<items.length;i++) { const item=items[i], img=new Image();
                img.src=item.png;await img.decode();const x=i%%cols*width,y=Math.floor(i/cols)*height+64;
                ctx.drawImage(img,x,y+70);ctx.fillStyle='#34210f';ctx.font='16px sans-serif';
                ctx.fillText(item.id+' '+item.name,x+8,y+21,width-16);
                const checks=item.validation, legal=checks&&Object.values(checks).every(v=>v===true);
                const b=item.tests, rate=b?.winRate, target=b?.target;
                const status=!b?'待测':rate>target[1]?'超目标':rate>=target[0]?'达标':rate<.45?'偏弱':'未达目标';
                ctx.font='14px sans-serif';
                ctx.fillText((legal?'硬合法':'校验待记录')+' · £'+item.budget+'/'+item.budgetLimit+
                  ' · '+(b?b.games+'局 '+(rate*100).toFixed(2)+'%%':'待测'),x+8,y+43,width-16);
                ctx.fillText(status+(target?' · 目标'+(target[0]*100)+'%%—'+(target[1]*100)+'%%':'')+
                  (item.recommended?' · 本批推荐参考':''),x+8,y+62,width-16);
                if(item.recommended){ctx.strokeStyle='#af6815';ctx.lineWidth=3;ctx.strokeRect(x+2,y+2,width-4,height-4);}
              } return canvas.toDataURL('image/png');})()''' % (json.dumps(rendered_images, ensure_ascii=False), json.dumps(chapter_label, ensure_ascii=False))
            png = shot.evaluate(cdp, expression)
            pathlib.Path(sys.argv[3]).write_bytes(base64.b64decode(png.split(',')[1]))
    finally:
        cdp.close()
        process.terminate()
        server.shutdown()
    manifest = output / ((inputs[0].stem if len(inputs) == 1 else 'all-candidates') +
                         ('-recommended' if recommended_only else '') + '-render.json')
    if not contact_only:
        # 定向改一台时保留其他车的真实图片指纹记录，避免单车渲染覆盖整关清单。
        if len(sys.argv) > 4 and not recommended_only and manifest.exists():
            prior = json.loads(manifest.read_text(encoding='utf-8'))
            replaced = {item['id'] for item in results}
            results = [item for item in prior if item['id'] not in replaced] + results
            results.sort(key=lambda item: item['id'])
        manifest.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
