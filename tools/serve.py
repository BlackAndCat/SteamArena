# 本地预览服务器：和 `python -m http.server` 一样，但禁止浏览器缓存。
# 普通 http.server 不发缓存头，浏览器会凭经验缓存 JS，git pull 之后刷新页面可能还在跑旧代码。
# 用法（仓库根目录）：python tools/serve.py        端口默认 5173，可传参数改：python tools/serve.py 8000
import http.server
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_ROOT = os.path.join(ROOT, 'text')
STAGE_CARS_FILE = os.path.join(ROOT, 'js', 'stage-cars.js')
SAFE_PART = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
MAX_BODY = 2 * 1024 * 1024


class NoCache(http.server.SimpleHTTPRequestHandler):
    """静态预览服务器，并为文本管理器提供受限的 JSON 读写接口。"""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text_file(self, game, locale):
        # 文件名只由两个安全片段组成，接口不会接受任意路径，避免路径穿越覆盖项目文件。
        if not SAFE_PART.fullmatch(game or '') or not SAFE_PART.fullmatch(locale or ''):
            return None
        folder = os.path.join(TEXT_ROOT, game)
        path = os.path.abspath(os.path.join(folder, f'{locale}.json'))
        if os.path.commonpath([TEXT_ROOT, path]) != os.path.abspath(TEXT_ROOT):
            return None
        return path

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/__text/load':
            query = parse_qs(parsed.query)
            path = self._text_file(query.get('game', [''])[0], query.get('locale', [''])[0])
            if not path:
                self._json(400, {'error': 'game 或 locale 不合法'})
                return
            if not os.path.isfile(path):
                self._json(404, {'error': '文本文件尚未创建'})
                return
            try:
                with open(path, 'r', encoding='utf-8') as stream:
                    self._json(200, json.load(stream))
            except (OSError, ValueError) as error:
                self._json(500, {'error': f'读取文本文件失败：{error}'})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/__stage-cars/save':
            self._save_stage_cars()
            return
        if parsed.path != '/__text/save':
            self._json(404, {'error': '接口不存在'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(413, {'error': '请求体过大或为空'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            self._json(400, {'error': '请求不是有效 JSON'})
            return
        if not isinstance(payload, dict):
            self._json(400, {'error': 'JSON 顶层必须是对象'})
            return
        game = payload.get('game')
        locale = payload.get('locale')
        values = payload.get('values')
        path = self._text_file(game, locale)
        if not path:
            self._json(400, {'error': 'game 或 locale 不合法'})
            return
        if payload.get('version', 1) != 1 or not isinstance(values, dict) or len(values) > 10000:
            self._json(400, {'error': '文本数据格式不合法'})
            return
        for key, value in values.items():
            if not isinstance(key, str) or not key or len(key) > 240 or '..' in key or any(ord(ch) < 32 for ch in key):
                self._json(400, {'error': '存在不合法的文本 key'})
                return
            if not isinstance(value, str) or len(value) > 10000:
                self._json(400, {'error': '文本值必须是长度不超过 10000 的字符串'})
                return
        document = {
            'version': 1,
            'game': game,
            'locale': locale,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
            'values': values,
        }
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            # 同目录临时文件 + replace，避免浏览器刷新时读到半个 JSON。
            fd, temporary = tempfile.mkstemp(prefix='.text-', suffix='.json', dir=os.path.dirname(path))
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(document, stream, ensure_ascii=False, indent=2)
                stream.write('\n')
            os.replace(temporary, path)
        except OSError as error:
            try:
                if temporary:
                    os.unlink(temporary)
            except (OSError, UnboundLocalError):
                pass
            self._json(500, {'error': f'写入文本文件失败：{error}'})
            return
        self._json(200, {'ok': True, 'file': os.path.relpath(path, ROOT).replace(os.sep, '/'), 'revision': document['updatedAt']})

    def _save_stage_cars(self):
        """开发者工具的受限写接口：只接受完整记录表，并原子替换 js/stage-cars.js。"""
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(413, {'error': '请求体过大或为空'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            self._json(400, {'error': '请求不是有效 JSON'})
            return
        records = payload.get('records') if isinstance(payload, dict) else None
        if not isinstance(payload, dict) or payload.get('version', 1) != 1 or not isinstance(records, dict) or len(records) > 32:
            self._json(400, {'error': '关卡车数据格式不合法'})
            return
        allowed_keys = {'0:0', '0:1', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2'}
        for key, record in records.items():
            if not isinstance(key, str) or not re.fullmatch(r'\d{1,2}:\d{1,2}', key):
                self._json(400, {'error': '关卡键不合法'})
                return
            if key not in allowed_keys:
                self._json(400, {'error': f'{key} 不在序章至第二章范围内'})
                return
            if record is not None:
                if not isinstance(record, dict) or record.get('source') != 'manual' or not isinstance(record.get('cells'), list):
                    self._json(400, {'error': f'{key} 记录不合法'})
                    return
                if len(record['cells']) > 256 or len(json.dumps(record, ensure_ascii=False)) > 500000:
                    self._json(413, {'error': f'{key} 记录过大'})
                    return
        data = json.dumps({'version': 1, 'targets': ['0:0', '0:1', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2'], 'records': records}, ensure_ascii=False, indent=2)
        helper = r'''SA.StageCars = (() => {
  const data = SA.STAGE_CARS;
  const keyOf = (chapter, stage) => `${chapter}:${stage}`;
  const targetKeys = () => [...(data.targets || [])];
  const get = (chapter, stage) => data.records && data.records[keyOf(chapter, stage)] || null;
  const isLocked = (chapter, stage) => !!get(chapter, stage)?.locked;
  // 规则指纹只来自后台版本，不把用户的手工数据算进去。
  const ruleFingerprint = () => String(SA.RULES_VERSION || SA.BUILD_SYS || 'rules-unknown');
  function cellsOf(vehicle) {
    const cells = [];
    SA.V.each(vehicle, (cell, row, col, layer) => cells.push([layer === 'side' ? 1 : 0, row, col, cell.id, cell.mt || 1, cell.lv || 0]));
    return cells;
  }
  function vehicle(record, name) {
    if (!record) return null;
    if (Array.isArray(record.cells) && typeof SA.V.fromCells === 'function') return SA.V.fromCells(name || record.name || '手工关卡车', record.cells);
    if (record.code && typeof SA.V.decode === 'function') return SA.V.decode(record.code);
    return null;
  }
  function merge(base, chapter, stage) {
    const record = get(chapter, stage);
    if (!record) return { ...base, source: 'original', locked: false, stageCar: null };
    const out = { ...base };
    for (const field of ['name', 'pilot', 'blurb', 'weakness', 'style', 'aim', 'terrain', 'boss', 'prize', 'unlock', 'uniqueLoot']) if (record[field] !== undefined) out[field] = record[field];
    out.source = 'manual'; out.locked = record.locked !== false; out.stageCar = record; out.manualVersion = record.updatedAt || record.version || null; out.vehicle = vehicle(record, out.name);
    return out;
  }
  function applyToCampaign() {
    if (!Array.isArray(SA.CAMPAIGN)) return;
    for (const key of targetKeys()) {
      const [chapter, stage] = key.split(':').map(Number), record = get(chapter, stage), base = SA.CAMPAIGN[chapter]?.stages?.[stage];
      if (!record || !base) continue;
      const out = merge(base, chapter, stage);
      for (const field of ['name', 'pilot', 'blurb', 'weakness', 'style', 'aim', 'terrain', 'boss', 'prize', 'unlock', 'uniqueLoot']) if (out[field] !== undefined) base[field] = out[field];
      base.vehicle = out.vehicle; base.source = 'manual'; base.locked = out.locked; base.stageCar = record;
    }
  }
  function makeRecord(chapter, stage, base, vehicleValue, meta = {}) {
    const stats = SA.V.stats(vehicleValue);
    return {
      version: 1, id: keyOf(chapter, stage), cells: cellsOf(vehicleValue), code: SA.V.encode(vehicleValue),
      style: meta.style ?? base.style ?? 'wander', aim: Number.isFinite(+meta.aim) ? +meta.aim : (base.aim ?? 0.8), terrain: meta.terrain || base.terrain || 'flat', boss: meta.boss === undefined ? !!base.boss : !!meta.boss,
      prize: Number.isFinite(+meta.prize) ? +meta.prize : (base.prize || 0), unlock: meta.unlock === undefined ? (base.unlock || null) : meta.unlock, uniqueLoot: meta.uniqueLoot === undefined ? (base.uniqueLoot || []) : meta.uniqueLoot,
      name: meta.name || base.name || vehicleValue.name, pilot: meta.pilot || base.pilot || '', blurb: meta.blurb ?? base.blurb ?? '', weakness: meta.weakness ?? base.weakness ?? '',
      source: 'manual', locked: meta.locked !== false, updatedAt: new Date().toISOString(), rules: ruleFingerprint(),
      analysis: { rating: stats.rating, value: stats.value, weight: stats.weight, drive: stats.drive, water: stats.water, overheat: stats.overheat, dps: stats.dps, hp: stats.hp },
    };
  }
  function validate(record, chapter, stage, vehicleValue) {
    const out = { ok: false, warnings: [], errors: [], stats: null };
    if (!vehicleValue) { out.errors.push('没有可分析的载具'); return out; }
    const stats = SA.V.stats(vehicleValue); out.stats = stats;
    if (!stats.canDeploy) out.errors.push(...(stats.problems || ['载具不能出战']));
    if (!record || !Array.isArray(record.cells) || !record.cells.length) out.errors.push('没有模块清单');
    const allowed = new Set(SA.CAMP_START?.mods || []), base = SA.CAMPAIGN?.[chapter]?.stages?.[stage];
    if (SA.STARTER && SA.V?.fromAscii) {
      const starter = SA.V.fromAscii('开局车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
      SA.V.each(starter, cell => allowed.add(cell.id));
    }
    // 开局车的 ASCII 车体用 K 表示驾驶舱，正式模块清单使用 cockpit；两者都属于开局可用部件。
    allowed.add('cockpit');
    for (let ci = 0; ci <= chapter; ci++) {
      const ch = SA.CAMPAIGN[ci], stop = ci === chapter ? stage : ch.stages.length;
      for (let si = 0; si < stop; si++) for (const id of ch.stages[si].unlock?.mods || []) allowed.add(id);
      if (ci < chapter) for (const id of ch.unlock?.mods || []) allowed.add(id);
    }
    for (const id of record?.unlock?.mods || []) allowed.add(id);
    for (const loot of record?.uniqueLoot || []) if (loot?.id) allowed.add(loot.id);
    if (base?.spec?.reward) allowed.add(base.spec.reward);
    for (const row of base?.subs || []) if (row?.[2]) allowed.add(row[2]);
    for (const cell of record?.cells || []) if (cell && SA.MODULES[cell[3]] && !allowed.has(cell[3]) && !record.boss) out.warnings.push(`使用了该关尚未解锁的模块：${cell[3]}`);
    out.ok = out.errors.length === 0;
    return out;
  }
  applyToCampaign();
  return { data, keyOf, targetKeys, get, isLocked, merge, applyToCampaign, vehicle, cellsOf, makeRecord, validate, ruleFingerprint };
})();
'''
        content = '// 关卡车手工设计数据（由 tools/stage-editor.html 写入，请勿手工编辑已保存记录）。\nwindow.SA = window.SA || {};\nSA.STAGE_CARS = ' + data + ';\n' + helper
        try:
            fd, temporary = tempfile.mkstemp(prefix='.stage-cars-', suffix='.js', dir=os.path.dirname(STAGE_CARS_FILE))
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(content)
            os.replace(temporary, STAGE_CARS_FILE)
        except OSError as error:
            try:
                if temporary:
                    os.unlink(temporary)
            except (OSError, UnboundLocalError):
                pass
            self._json(500, {'error': f'写入关卡车失败：{error}'})
            return
        self._json(200, {'ok': True, 'file': 'js/stage-cars.js'})


if __name__ == '__main__':
    os.chdir(ROOT)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'SteamArena: http://localhost:{port}  (no-cache)')
    http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
