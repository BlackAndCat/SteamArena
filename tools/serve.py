# 本地预览服务器：和 `python -m http.server` 一样，但禁止浏览器缓存。
# 普通 http.server 不发缓存头，浏览器会凭经验缓存 JS，git pull 之后刷新页面可能还在跑旧代码。
# 用法（仓库根目录）：python tools/serve.py        端口默认 5173，可传参数改：python tools/serve.py 8000
import http.server
import hashlib
import json
import math
import os
import re
import sys
import tempfile
import threading
import shutil
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from evolve_service import EvolutionService


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_ROOT = os.path.join(ROOT, 'text')
CONFIG_ROOT = os.path.join(ROOT, 'config')
STAGE_CARS_FILE = os.path.join(CONFIG_ROOT, 'stage-cars.json')
CONTENT_FILE = os.path.join(CONFIG_ROOT, 'content.json')
STAGE_RULES_FILE = os.path.join(ROOT, 'tools', 'evolve-stage-rules.json')
# 新建关卡的构筑预算：没有前一关时用首关上限，否则按战役序号每关 ×1.2（逐关表要求每关增长 15%～30%）
FIRST_STAGE_BUDGET = 360
STAGE_BUDGET_GROWTH = 1.2
MODULES_FILE = os.path.join(CONFIG_ROOT, 'modules.json')
TEXT_FILE = os.path.join(CONFIG_ROOT, 'text.json')
MIGRATION_STATE = os.path.join(ROOT, 'tools', '.config-migration-state.json')
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



def _stage_data():
    """读取单一关卡内容源。"""
    with open(STAGE_CARS_FILE, 'r', encoding='utf-8') as stream:
        return json.load(stream)


def _json_file(path):
    with open(path, 'r', encoding='utf-8') as stream:
        return json.load(stream)


def _write_json(path, data):
    _atomic_bytes(path, (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8'))


def _merge_fields(target, changes):
    """仅合并工作台指定的模块字段，保留外观及未知扩展字段。"""
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge_fields(target[key], value)
        else:
            target[key] = value


def _stage_order(key):
    ci, _, si = key.partition(':')
    return int(ci), int(si)


def _require_workbench_target(payload, record):
    """仅接受新版工作台对明确关卡目标的写入；旧页面已停用。"""
    target = payload.get('target')
    if (payload.get('workbenchVersion') != 1 or not isinstance(target, dict)
            or target.get('kind') != 'stage' or target.get('id') != record.get('id')):
        raise ValueError('旧版工作台已停用，请刷新并使用新版控制台')


def _ordinal(campaign, ci, si):
    """按每章计划关数排出的全战役序号；中间空着的关也算，预算按序号差连续增长。"""
    return sum(max(len(ch.get('stages', [])), int(ch.get('plannedStages') or 0)) for ch in campaign[:ci]) + si


def _write_rules(path, rows):
    """逐关表保持一行一关的手写格式。"""
    def line(row):
        return '{ ' + ', '.join(f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in row.items()) + ' }'
    _atomic_bytes(path, ('[\n' + ',\n'.join('  ' + line(row) for row in rows) + '\n]\n').encode('utf-8'))


def _migrate_text(current, raw):
    payload = json.loads(raw)
    if not isinstance(payload, dict) or not isinstance(payload.get('values'), dict):
        raise ValueError('旧文字缓存格式不合法')
    values = {**current.get('values', {}), **payload['values']}
    hidden = sorted(set(current.get('removedElements', [])) | set(payload.get('removedElements', [])))
    return {**current, 'values': values, 'removedElements': hidden}


def _atomic_bytes(path, content):
    """同目录临时文件替换，出错时不留下半份正式文件。"""
    temporary = None
    try:
        fd, temporary = tempfile.mkstemp(prefix='.publish-', dir=os.path.dirname(path))
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


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

    def _request_json(self):
        """所有写端点共用请求体大小与 JSON 校验。"""
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0 or length > MAX_BODY:
            raise ValueError('请求体过大或为空')
        payload = json.loads(self.rfile.read(length).decode('utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('JSON 顶层必须是对象')
        return payload

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == '/__modules/status':
                self._json(200, {'ok': True})
                return
            if parsed.path == '/__config/list':
                if not self._allow_local_write(): return
                self._json(200, {'names': sorted(name[:-5] for name in os.listdir(CONFIG_ROOT)
                                                  if name.endswith('.json') and SAFE_PART.fullmatch(name[:-5]))})
                return
            if parsed.path in ('/__evolve/config', '/__evolve/job'):
                self._json(200, EVOLUTION.catalog() if parsed.path.endswith('/config') else EVOLUTION.snapshot())
                return
            if parsed.path == '/__text/load':
                query = parse_qs(parsed.query)
                if query.get('game', [''])[0] != 'steam-arena' or query.get('locale', [''])[0] != 'zh-CN':
                    self._json(400, {'error': 'game 或 locale 不合法'})
                else: self._json(200, _json_file(TEXT_FILE))
                return
            super().do_GET()
        except (OSError, ValueError, TimeoutError) as error:
            self._json(500, {'error': str(error)})

    def do_POST(self):
        endpoint = urlparse(self.path).path
        allowed = ('/__text/save', '/__stage-cars/save', '/__stage-cars/create', '/__modules/save', '/__battle-speed/save', '/__config/save',
                   '/__config/migrate', '/__evolve/run', '/__evolve/stop', '/__publish/archive')
        if endpoint not in allowed:
            self._json(404, {'error': '接口不存在'})
            return
        if not self._allow_local_write(): return
        if endpoint == '/__publish/archive':
            self._json(410, {'error': '旧归档写入已停用；作者数据现由配置文件直接保存'})
            return
        if endpoint in ('/__evolve/run', '/__evolve/stop'):
            self._evolve_request(endpoint)
            return
        try:
            payload = self._request_json()
            if endpoint == '/__modules/save': result = self._save_modules(payload)
            elif endpoint == '/__battle-speed/save': result = self._save_battle_speed(payload)
            elif endpoint == '/__stage-cars/save': result = self._save_stage_cars(payload)
            elif endpoint == '/__stage-cars/create': result = self._create_stage_car(payload)
            elif endpoint == '/__text/save': result = self._save_text(payload)
            elif endpoint == '/__config/save': result = self._save_config(payload)
            else: result = self._migrate(payload)
            self._json(200, {'ok': True, **result})
        except (OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
            self._json(400 if isinstance(error, (ValueError, KeyError, TypeError, UnicodeError)) else 500,
                       {'error': str(error)})

    def _save_modules(self, payload):
        """直接修改当前模块记录；默认基线不参与日常保存。"""
        module_id, changes = payload.get('id'), payload.get('changes')
        with MODULE_SAVE_LOCK:
            data = _json_file(MODULES_FILE)
            if not isinstance(module_id, str) or module_id not in data.get('MODULE_ORDER', []):
                raise ValueError('模块 ID 不存在')
            with open(MODULE_SCHEMA_FILE, 'r', encoding='utf-8') as stream:
                schema_source = stream.read()
            schema, _, _ = _module_json_block(schema_source, '// MODULE_EDITOR_SCHEMA_START',
                                               '// MODULE_EDITOR_SCHEMA_END', 'SA.MODULE_EDITOR_SCHEMA')
            _validate_module_overrides(schema['fields'], changes, module_id, set(data['MODULE_ORDER']))
            current = data['MODULES'][module_id]
            _merge_fields(current, changes)
            if 'desc' in changes:
                current.pop('descTemplate', None)
            if current.get('minMt', 1) > current.get('maxMt', len(data['MATS']) - 1):
                raise ValueError('最低材料阶不能超过最高材料阶')
            if 'spreadMin' in current and current['spreadMin'] > current.get('spread', 0):
                raise ValueError('抛射散布下限不能超过上限')
            _write_json(MODULES_FILE, data)
        return {'id': module_id, 'file': 'config/modules.json'}

    def _save_battle_speed(self, payload):
        """在配置锁内只更新战斗速度，不覆盖模块工作台的其它作者改动。"""
        if set(payload) != {'gameSpeed'}:
            raise ValueError('战斗速度请求字段不合法')
        speed = payload['gameSpeed']
        if type(speed) not in (int, float) or not math.isfinite(speed):
            raise ValueError('战斗速度必须是有限数字')
        with MODULE_SAVE_LOCK:
            data = _json_file(MODULES_FILE)
            limits = data['K']['BATTLE']
            minimum, maximum, step = (limits['GAME_SPEED_MIN'], limits['GAME_SPEED_MAX'], limits['GAME_SPEED_STEP'])
            if speed < minimum or speed > maximum or abs((speed - minimum) / step - round((speed - minimum) / step)) > 1e-7:
                raise ValueError('战斗速度超出可选范围')
            data['K']['GAME_SPEED'] = speed
            _write_json(MODULES_FILE, data)
        return {'gameSpeed': speed, 'file': 'config/modules.json'}

    def _save_stage_cars(self, payload):
        """只覆盖被编辑的一关，其余十七关和顶层扩展字段原样保留。"""
        record = payload.get('record')
        if not isinstance(record, dict) or not isinstance(record.get('id'), str):
            raise ValueError('关卡记录不合法')
        _require_workbench_target(payload, record)
        key = record['id']
        with MODULE_SAVE_LOCK:
            data = _json_file(STAGE_CARS_FILE)
            if key not in data.get('targets', []): raise ValueError('关卡编号不合法')
            if record.get('source') != 'manual' or not isinstance(record.get('cells'), list) or len(record['cells']) > 256:
                raise ValueError('手工关卡记录不合法')
            if len(json.dumps(record, ensure_ascii=False, allow_nan=False)) > 500000:
                raise ValueError('关卡记录过大')
            data['records'][key] = {**data['records'][key], **record}
            for field in ('rows', 'sides', 'elite', 'subs'):
                data['records'][key].pop(field, None)
            _write_json(STAGE_CARS_FILE, data)
        return {'id': key, 'file': 'config/stage-cars.json'}

    def _create_stage_car(self, payload):
        """首次保存登记计划空位；复用已有预算且不写该文件，缺预算时补行，事务失败恢复原始字节。"""
        record = payload.get('record')
        if not isinstance(record, dict) or not isinstance(record.get('id'), str):
            raise ValueError('关卡记录不合法')
        _require_workbench_target(payload, record)
        match = re.fullmatch(r'(0|[1-9]\d*):(0|[1-9]\d*)', record['id'])
        if not match or record.get('source') != 'manual' or not isinstance(record.get('cells'), list) or not record['cells'] or len(record['cells']) > 256:
            raise ValueError('新关卡记录不合法')
        ci, si = map(int, match.groups())
        if len(json.dumps(record, ensure_ascii=False, allow_nan=False)) > 500000:
            raise ValueError('关卡记录过大')
        with MODULE_SAVE_LOCK:
            content = _json_file(CONTENT_FILE)
            cars = _json_file(STAGE_CARS_FILE)
            rules = _json_file(STAGE_RULES_FILE)
            chapters = content['CAMPAIGN']
            if ci >= len(chapters) or si >= chapters[ci].get('plannedStages', 0):
                raise ValueError('关卡编号不在现有计划内')
            stages = chapters[ci]['stages']
            if si < len(stages) and not stages[si].get('unfinished'):
                raise ValueError('该关卡已经存在，不能覆盖')
            if record['id'] in cars.get('records', {}) or record['id'] in cars.get('targets', []):
                raise ValueError('该关卡已有记录，不能覆盖')
            order = lambda row: (row['chapter'], row['stage'])
            rule = next((row for row in rules if order(row) == (ci, si)), None)
            missing_rule = rule is None
            # 预演规则可能先于正式关登记；已有预算、奖励模块和状态完整保留，连文件字节都不重写。
            if missing_rule:
                before = sorted((row for row in rules if order(row) < (ci, si)), key=order)
                if before:
                    steps = _ordinal(chapters, ci, si) - _ordinal(chapters, before[-1]['chapter'], before[-1]['stage'])
                    budget = int(round(before[-1]['budget'] * STAGE_BUDGET_GROWTH ** steps / 5) * 5)
                else:
                    budget = FIRST_STAGE_BUDGET
                name = str(record.get('name') or record['id']).strip()
                rule = {'chapter': ci, 'stage': si, 'name': name, 'budget': budget, 'status': 'draft', 'addMods': []}
            for index in range(len(stages), si + 1):
                stages.append({'stageRef': f'{ci}:{index}', 'unfinished': True})
            stages[si] = {'stageRef': record['id']}
            records = {**cars.get('records', {}), record['id']: record}
            cars['targets'] = sorted([*cars.get('targets', []), record['id']], key=_stage_order)
            cars['records'] = {key: records[key] for key in sorted(records, key=_stage_order)}
            original = {}
            for path in (CONTENT_FILE, STAGE_CARS_FILE, STAGE_RULES_FILE):
                with open(path, 'rb') as stream: original[path] = stream.read()
            written = []
            writes = [(CONTENT_FILE, lambda: _write_json(CONTENT_FILE, content)),
                      (STAGE_CARS_FILE, lambda: _write_json(STAGE_CARS_FILE, cars))]
            if missing_rule:
                writes.append((STAGE_RULES_FILE, lambda: _write_rules(STAGE_RULES_FILE, sorted([*rules, rule], key=order))))
            try:
                for path, write in writes:
                    write()
                    written.append(path)
            except Exception:
                for path in written:
                    _atomic_bytes(path, original[path])
                raise
        return {'id': record['id'], 'rule': rule, 'file': 'config/content.json + config/stage-cars.json' +
                (' + tools/evolve-stage-rules.json' if missing_rule else '')}

    def _save_text(self, payload):
        """只接受当前文本稿，不按历史版本回放覆盖新稿。"""
        if payload.get('game') != 'steam-arena' or payload.get('locale') != 'zh-CN':
            raise ValueError('game 或 locale 不合法')
        values = payload.get('values')
        hidden = payload.get('removedElements')
        if not isinstance(values, dict) or len(values) > 10000 or not isinstance(hidden, list) or len(hidden) > 10000:
            raise ValueError('文本数据格式不合法')
        if any(not isinstance(k, str) or not k or len(k) > 240 or not isinstance(v, str) or len(v) > 10000
               for k, v in values.items()): raise ValueError('文本值不合法')
        if any(not isinstance(item, str) or not item or len(item) > 2048 for item in hidden):
            raise ValueError('隐藏元素路径不合法')
        with MODULE_SAVE_LOCK:
            data = _json_file(TEXT_FILE)
            data.update(values=values, removedElements=hidden, updatedAt=datetime.now(timezone.utc).isoformat(), edited=True)
            if 'storyMeta' in payload: data['storyMeta'] = payload['storyMeta']
            _write_json(TEXT_FILE, data)
        return {'file': 'config/text.json', 'revision': data['updatedAt']}

    def _save_config(self, payload):
        """薄通用入口供新增参数编辑器写整份已存在的配置。"""
        name, data = payload.get('name'), payload.get('data')
        if not isinstance(name, str) or not SAFE_PART.fullmatch(name) or not isinstance(data, dict):
            raise ValueError('配置名称或内容不合法')
        path = os.path.join(CONFIG_ROOT, name + '.json')
        if not os.path.isfile(path): raise ValueError('配置不存在')
        with MODULE_SAVE_LOCK: _write_json(path, data)
        return {'file': 'config/' + name + '.json'}

    def _migrate(self, payload):
        """按稳定哈希只迁一次旧作者缓存，避免刷新后旧稿重新覆盖新文件。"""
        keys = ('sa-text-steam-arena-zh-CN',)
        # 历史跳转片段可能带旧关卡缓存；接收但完全忽略，避免影响正式配置。
        ignored = ('steam_arena_stage_cars_local_v1',)
        if any(key not in keys + ignored + ('__shadow', '__returnHash') for key in payload):
            raise ValueError('迁移请求包含未知数据')
        raw = {key: payload[key] for key in keys if key in payload}
        shadow = payload.get('__shadow', {})
        if not isinstance(shadow, dict) or any(key not in keys + ignored for key in shadow):
            raise ValueError('旧作者缓存来源不合法')
        if not raw: return {'migrated': False}
        if any(not isinstance(value, str) or len(value) > MAX_BODY for value in list(raw.values()) + list(shadow.values())):
            raise ValueError('旧作者数据格式不合法')
        with MODULE_SAVE_LOCK:
            seen = _json_file(MIGRATION_STATE) if os.path.isfile(MIGRATION_STATE) else {}
            if not isinstance(seen, dict): raise ValueError('迁移状态格式不合法')
            pending = {key: value for key, value in raw.items()
                       if hashlib.sha256(value.encode('utf-8')).hexdigest() not in seen.get(key, [])}
            if not pending and not shadow: return {'migrated': False}
            text_data = _migrate_text(_json_file(TEXT_FILE), pending[keys[0]]) if keys[0] in pending else None
            if text_data is not None: _write_json(TEXT_FILE, text_data)
            for source in (raw, shadow):
                for key, value in source.items():
                    hashes = seen.setdefault(key, [])
                    digest = hashlib.sha256(value.encode('utf-8')).hexdigest()
                    if digest not in hashes: hashes.append(digest)
            _write_json(MIGRATION_STATE, seen)
        return {'migrated': True, 'keys': list(pending)}

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



if __name__ == '__main__':
    os.chdir(ROOT)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'SteamArena: http://localhost:{port}  (no-cache)')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
