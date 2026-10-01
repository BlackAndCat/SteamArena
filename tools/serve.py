# 本地预览服务器：和 `python -m http.server` 一样，但禁止浏览器缓存。
# 普通 http.server 不发缓存头，浏览器会凭经验缓存 JS，git pull 之后刷新页面可能还在跑旧代码。
# 用法（仓库根目录）：python tools/serve.py        端口默认 5173，可传参数改：python tools/serve.py 8000
import http.server
import json
import math
import os
import re
import sys
import tempfile
import threading
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from evolve_service import EvolutionService


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_ROOT = os.path.join(ROOT, 'text')
STAGE_CARS_FILE = os.path.join(ROOT, 'js', 'stage-cars.js')
MODULES_FILE = os.path.join(ROOT, 'js', 'modules.js')
MODULE_SCHEMA_FILE = os.path.join(ROOT, 'tools', 'module-editor-schema.js')
MODULE_SAVE_LOCK = threading.Lock()
SAFE_PART = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
MAX_BODY = 2 * 1024 * 1024
EVOLUTION = EvolutionService(ROOT)


def _module_json_block(source, start, end, variable):
    """只读取工作台标记包围的纯 JSON 赋值，避免解析或重写模块原表。"""
    before, found, remainder = source.partition(start)
    body, closing, after = remainder.partition(end)
    if not found or not closing or end in after or start in before:
        raise ValueError('模块工作台数据标记缺失或重复')
    matched = re.fullmatch(r'\s*' + re.escape(variable) + r'\s*=\s*(.*?)\s*;\s*', body, re.DOTALL)
    if not matched:
        raise ValueError('模块工作台数据格式不合法')
    return json.loads(matched.group(1)), before, after


def _validate_module_overrides(fields, overrides, module_id, allowed_ids):
    """按共享字段白名单校验稀疏覆盖对象，拒绝外观和原型属性。"""
    if not isinstance(overrides, dict):
        raise ValueError('模块属性必须是对象')

    def visit(items, prefix=''):
        for key, value in items.items():
            if not isinstance(key, str) or key in ('__proto__', 'constructor', 'prototype'):
                raise ValueError('模块属性名不合法')
            path = f'{prefix}.{key}' if prefix else key
            rule = fields.get(path)
            children = any(item.startswith(path + '.') for item in fields)
            if isinstance(value, dict) and children:
                if not value or path == 'kick' and module_id != 'biped':
                    raise ValueError(f'{path} 结构不合法')
                visit(value, path)
                continue
            if rule is None:
                raise ValueError(f'不可编辑的属性：{path}')
            if path == 'kick' and module_id == 'biped':
                raise ValueError('双足踢击必须填写对象属性')
            kind = rule['type']
            if kind == 'number':
                if (type(value) not in (int, float) or not math.isfinite(value)
                        or value < rule.get('min', -math.inf)
                        or value > rule.get('max', math.inf)
                        or rule.get('integer') and not float(value).is_integer()):
                    raise ValueError(f'{path} 必须是有效范围内的数字')
            elif kind == 'string':
                if (not isinstance(value, str) or len(value) > rule['maxLength']
                        or any(ord(char) < 32 and (path != 'desc' or char not in '\t\n\r') for char in value)
                        or rule.get('enum') and value not in rule['enum']
                        or rule.get('moduleId') and value not in allowed_ids):
                    raise ValueError(f'{path} 文本不合法')
            elif kind == 'boolean':
                if not isinstance(value, bool):
                    raise ValueError(f'{path} 必须是布尔值')
            elif kind == 'array':
                if (not isinstance(value, list) or len(value) < rule['minItems']
                        or len(value) > rule['maxItems']):
                    raise ValueError(f'{path} 数组不合法')
                for entry in value:
                    if rule['itemType'] == 'number':
                        if (type(entry) not in (int, float) or not math.isfinite(entry)
                                or entry < rule.get('itemMin', -math.inf)):
                            raise ValueError(f'{path} 数组不合法')
                    elif (not isinstance(entry, str) or len(entry) > rule['itemMaxLength']
                          or any(ord(char) < 32 for char in entry)
                          or rule.get('itemEnum') and entry not in rule['itemEnum']):
                        raise ValueError(f'{path} 数组不合法')
            else:
                raise ValueError(f'{path} 字段类型不合法')

    visit(overrides)
    # 只有五个模块在原表限定了材料边界；其余沿用 1～6 阶默认值。
    original_min = {'cannon': 2, 'cannon_heavy': 4, 'cannon_giant': 6, 'flamer': 4}
    original_max = {'steamjet': 3}
    if overrides.get('minMt', original_min.get(module_id, 1)) > overrides.get('maxMt', original_max.get(module_id, 6)):
        raise ValueError('最低材料阶不能超过最高材料阶')


class NoCache(http.server.SimpleHTTPRequestHandler):
    """静态预览服务器，为文本、手工关卡车和进化任务提供受限 JSON 接口。"""

    def _allow_local_write(self):
        """写接口仅接受回环客户端、本机 Host 和同源页面；无 Origin 的本机命令行仍可用。"""
        host = self.headers.get('Host', '')
        try:
            host_url = urlparse('http://' + host)
            valid_host = (len(self.headers.get_all('Host', [])) == 1
                          and host_url.hostname in ('localhost', '127.0.0.1', '::1')
                          and host_url.port == self.server.server_port
                          and host_url.netloc == host and not host_url.username
                          and not host_url.password and not host_url.path)
            origin = self.headers.get('Origin')
            valid_origin = (len(self.headers.get_all('Origin', [])) <= 1
                            and (origin is None or origin == f'http://{host}'))
        except ValueError:
            valid_host = valid_origin = False
        if self.client_address[0] not in ('127.0.0.1', '::1') or not valid_host or not valid_origin:
            self._json(403, {'error': '写入接口只能由本机同源页面访问'})
            return False
        return True

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
        if parsed.path == '/__modules/status':
            self._json(200, {'ok': True})
            return
        if parsed.path in ('/__evolve/config', '/__evolve/job'):
            try:
                self._json(200, EVOLUTION.catalog() if parsed.path.endswith('/config') else EVOLUTION.snapshot())
            except (OSError, ValueError, TimeoutError) as error:
                self._json(500, {'error': str(error)})
            return
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
        if parsed.path in ('/__text/save', '/__stage-cars/save', '/__modules/save', '/__evolve/run', '/__evolve/stop') and not self._allow_local_write():
            return
        if parsed.path == '/__modules/save':
            self._save_modules()
            return
        if parsed.path in ('/__evolve/run', '/__evolve/stop'):
            self._evolve_request(parsed.path)
            return
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
        removed_elements = payload.get('removedElements', [])
        active_version = payload.get('activeVersion')
        history = payload.get('history', [])
        path = self._text_file(game, locale)
        if not path:
            self._json(400, {'error': 'game 或 locale 不合法'})
            return
        if payload.get('version', 1) != 1 or not isinstance(values, dict) or len(values) > 10000:
            self._json(400, {'error': '文本数据格式不合法'})
            return
        # v1 文本文件允许新增元素隐藏清单；旧文件没有该字段时仍按空清单读取。
        if (not isinstance(removed_elements, list) or len(removed_elements) > 10000
                or any(not isinstance(item, str) or not item or len(item) > 2048
                       or any(ord(ch) < 32 for ch in item) for item in removed_elements)):
            self._json(400, {'error': '元素删除清单格式不合法'})
            return
        for key, value in values.items():
            if not isinstance(key, str) or not key or len(key) > 240 or '..' in key or any(ord(ch) < 32 for ch in key):
                self._json(400, {'error': '存在不合法的文本 key'})
                return
            if not isinstance(value, str) or len(value) > 10000:
                self._json(400, {'error': '文本值必须是长度不超过 10000 的字符串'})
                return
        # 旧 v1 文件可省略版本字段；新版历史逐项复用现有文案与隐藏路径边界。
        def valid_version(item):
            return isinstance(item, dict) and isinstance(item.get('id'), str) and 0 < len(item['id']) <= 80 \
                and isinstance(item.get('at'), str) and 0 < len(item['at']) <= 80

        def valid_snapshot(item):
            entries = item.get('values')
            paths = item.get('removedElements')
            return isinstance(entries, dict) and len(entries) <= 10000 \
                and all(isinstance(k, str) and 0 < len(k) <= 240 and '..' not in k
                        and not any(ord(ch) < 32 for ch in k)
                        and isinstance(v, str) and len(v) <= 10000 for k, v in entries.items()) \
                and isinstance(paths, list) and len(paths) <= 10000 \
                and all(isinstance(p, str) and 0 < len(p) <= 2048
                        and not any(ord(ch) < 32 for ch in p) for p in paths)

        if (active_version is not None and not valid_version(active_version)) or not isinstance(history, list) \
                or len(history) > 20 or any(not valid_version(item) or not valid_snapshot(item) for item in history) \
                or (history and active_version is None):
            self._json(400, {'error': '文本历史版本格式不合法'})
            return
        document = {
            'version': 1,
            'game': game,
            'locale': locale,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
            'values': values,
            'removedElements': removed_elements,
        }
        if active_version is not None:
            document['activeVersion'] = active_version
            document['history'] = history
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

    def _save_modules(self):
        """仅替换模块覆盖块中的一个 ID，保持原表、getter、注释及其他模块原样。"""
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(413, {'error': '请求体过大或为空'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(payload, dict) or set(payload) != {'id', 'overrides'}:
                raise ValueError('模块保存数据格式不合法')
            module_id = payload['id']
            if not isinstance(module_id, str):
                raise ValueError('模块 ID 不合法')
            with open(MODULE_SCHEMA_FILE, 'r', encoding='utf-8') as stream:
                schema_source = stream.read()
            schema, _, _ = _module_json_block(schema_source, '// MODULE_EDITOR_SCHEMA_START',
                                               '// MODULE_EDITOR_SCHEMA_END', 'SA.MODULE_EDITOR_SCHEMA')
            # 模块 ID 从现有顺序表取白名单；工作台不能新增、重排或重命名模块 ID。
            with MODULE_SAVE_LOCK:
                with open(MODULES_FILE, 'r', encoding='utf-8', newline='') as stream:
                    source = stream.read()
                order = re.search(r'SA\.MODULE_ORDER\s*=\s*\[(.*?)\];', source, re.DOTALL)
                allowed_ids = set(re.findall(r"'([A-Za-z0-9_]+)'", order.group(1))) if order else set()
                if module_id not in allowed_ids:
                    raise ValueError('模块 ID 不存在')
                _validate_module_overrides(schema['fields'], payload['overrides'], module_id, allowed_ids)
                records, before, after = _module_json_block(source, '// MODULE_EDITOR_OVERRIDES_START',
                                                              '// MODULE_EDITOR_OVERRIDES_END', 'SA.MODULE_OVERRIDES')
                if not isinstance(records, dict):
                    raise ValueError('模块覆盖表不合法')
                if payload['overrides']:
                    records[module_id] = payload['overrides']
                else:
                    records.pop(module_id, None)
                body = 'SA.MODULE_OVERRIDES = ' + json.dumps(records, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + ';'
                newline = '\r\n' if '\r\n' in source else '\n'
                content = before + '// MODULE_EDITOR_OVERRIDES_START' + newline + body + newline + '// MODULE_EDITOR_OVERRIDES_END' + after
                temporary = None
                try:
                    fd, temporary = tempfile.mkstemp(prefix='.modules-', suffix='.js', dir=os.path.dirname(MODULES_FILE))
                    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
                        stream.write(content)
                    os.replace(temporary, MODULES_FILE)
                finally:
                    if temporary and os.path.exists(temporary):
                        os.unlink(temporary)
        except (OSError, UnicodeDecodeError, ValueError, KeyError, TypeError) as error:
            self._json(400, {'error': str(error)})
            return
        self._json(200, {'ok': True, 'id': module_id, 'file': 'js/modules.js'})

    def _evolve_request(self, endpoint):
        """仅允许本机同源页面启动固定的模拟程序，不提供通用命令执行接口。"""
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_BODY:
                self._json(413, {'error': '请求体过大或为空'})
                return
            request = json.loads(self.rfile.read(length).decode('utf-8'))
            result = EVOLUTION.stop() if endpoint.endswith('/stop') else EVOLUTION.start(request)
            self._json(202 if result else 409, result or {'error': '已有模拟正在运行，请等待或停止当前任务'})
        except (OSError, ValueError) as error:
            self._json(400, {'error': str(error)})

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
        # 六章各三关均可由工作台保存，键仍需经过下方格式与范围双重校验。
        allowed_keys = {f'{chapter}:{stage}' for chapter in range(6) for stage in range(3)}
        for key, record in records.items():
            if not isinstance(key, str) or not re.fullmatch(r'\d{1,2}:\d{1,2}', key):
                self._json(400, {'error': '关卡键不合法'})
                return
            if key not in allowed_keys:
                self._json(400, {'error': f'{key} 不在战役六章范围内'})
                return
            if record is not None:
                if not isinstance(record, dict) or record.get('source') != 'manual' or not isinstance(record.get('cells'), list):
                    self._json(400, {'error': f'{key} 记录不合法'})
                    return
                if len(record['cells']) > 256 or len(json.dumps(record, ensure_ascii=False)) > 500000:
                    self._json(413, {'error': f'{key} 记录过大'})
                    return
        # 仍开着的旧工作台可能提交旧序章编号；校验后将铲斗关顺延，保留其构筑。
        if payload.get('campaignLayout', 1) == 1 and '0:1' in records:
            records = dict(records)
            old = records.pop('0:1')
            records['0:2'] = dict(old, id='0:2') if old else old
        data = json.dumps({'version': 1, 'campaignLayout': 2, 'targets': sorted(allowed_keys), 'records': records}, ensure_ascii=False, indent=2)
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
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
