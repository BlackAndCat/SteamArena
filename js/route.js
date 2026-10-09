// 出征公开入口与配置校验：预计节点与真实监控分开；不经竞技场结算，不写玩家存档。
window.SA = window.SA || {};
SA.Route = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  let config = copy(SA.Config.get('routes'));
  const pickupKinds = ['coal', 'water', 'supply', 'refugee', 'relic'];
  const propKinds = ['crate', 'barricade', 'ruinDoor'];

  /** 编辑器和运行入口共用有限字段校验；正式 JSON 禁止塞入自造车辆绕过现有关卡记录。 */
  function validateConfig(value) {
    const errors = [], number = (v, min = 0) => typeof v === 'number' && Number.isFinite(v) && v > min;
    const text = v => typeof v === 'string' && !!v.trim();
    const error = (ok, message) => { if (!ok) errors.push(message); };
    if (!value || typeof value !== 'object') return { ok: false, errors: ['配置必须是对象'] };
    error(value.version === 1, '配置 version 必须为 1');
    for (const key of ['capacityPerKw', 'kgPerKj', 'idleKw']) error(number(value.fuel?.[key]), 'fuel.' + key + ' 必须是有限正数');
    if (!Array.isArray(value.routes) || !value.routes.length) return { ok: false, errors: [...errors, 'routes 必须是非空数组'] };
    const ids = new Set();
    value.routes.forEach((r, i) => {
      const prefix = '路线[' + i + ']';
      if (!r || typeof r !== 'object') { errors.push(prefix + ' 必须是对象'); return; }
      error(text(r.id) && !ids.has(r.id), prefix + ' id 必须非空且唯一'); ids.add(r.id);
      error(text(r.name), prefix + ' name 不能为空');
      error(Number.isInteger(r.len) && r.len > 0 && r.len <= 1000000, prefix + ' len 必须是 1～1000000 的整数');
      const coord = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= r.len;
      error(coord(r.end?.x), prefix + ' end.x 必须在路线范围内');
      if (r.end?.bonus !== undefined) error(Number.isFinite(r.end.bonus) && r.end.bonus >= 0, prefix + ' end.bonus 必须非负');
      for (const key of ['hills', 'mud', 'props', 'pickups', 'encounters']) {
        error(Array.isArray(r[key]), prefix + ' ' + key + ' 必须是数组');
      }
      for (const h of Array.isArray(r.hills) ? r.hills : []) error(h && coord(h.x) && number(h.w) && Number.isFinite(h.h) && h.h >= 0, prefix + ' 土坡坐标/宽高非法');
      for (const m of Array.isArray(r.mud) ? r.mud : []) error(Array.isArray(m) && m.length === 2 && coord(m[0]) && coord(m[1]) && m[0] < m[1], prefix + ' 泥地区间非法');
      for (const p of Array.isArray(r.props) ? r.props : []) error(p && propKinds.includes(p.kind) && coord(p.x) && number(p.w) && number(p.h) && number(p.hp), prefix + ' 障碍种类/坐标/尺寸/耐久非法');
      for (const p of Array.isArray(r.pickups) ? r.pickups : []) {
        if (!p || typeof p !== 'object') { errors.push(prefix + ' 拾取物必须是对象'); continue; }
        error(pickupKinds.includes(p.kind) && coord(p.x), prefix + ' 拾取物种类/坐标非法');
        if (p.n !== undefined) error(Number.isInteger(p.n) && p.n > 0, prefix + ' 拾取物 n 必须是正整数');
        if (p.amount !== undefined) error(number(p.amount), prefix + ' 拾取物 amount 必须为有限正数');
        if (p.kind === 'coal') error(number(p.amount) && p.amount <= 1, prefix + ' 煤补给 amount 必须为 (0,1] 的容量比例');
        if (p.module !== undefined) error(p.kind === 'relic' && !!SA.MODULES[p.module], prefix + ' 遗迹模块不存在');
        if (p.gate !== undefined) error(coord(p.gate) && Array.isArray(r.props) && r.props.some(prop => prop?.kind === 'ruinDoor' && prop.x === p.gate), prefix + ' 遗迹门引用不存在');
      }
      let last = -1;
      for (const e of Array.isArray(r.encounters) ? r.encounters : []) {
        if (!e || typeof e !== 'object') { errors.push(prefix + ' 遭遇必须是对象'); continue; }
        error(coord(e.at) && e.at > last && e.at <= r.end?.x, prefix + ' 遭遇触发点必须递增且不晚于终点'); last = e.at;
        error(coord(e.guard) && coord(e.leash) && e.at <= e.guard && e.guard <= e.leash, prefix + ' 遭遇 guard/leash 范围非法');
        error(text(e.name), prefix + ' 遭遇名称不能为空');
        if (e.style !== undefined) error(SA.AI_STYLES.some(style => style.id === e.style), prefix + ' 遭遇性格不存在');
        if (e.charge !== undefined) error(typeof e.charge === 'boolean', prefix + ' charge 必须是布尔值');
        const match = /^(\d+):(\d+)$/.exec(e.car || '');
        let vehicle = null;
        try { if (match) vehicle = SA.StageCars.vehicle(SA.StageCars.get(+match[1], +match[2]), e.name); } catch { /* 保留为清楚的校验错误。 */ }
        error(!Object.prototype.hasOwnProperty.call(e, 'vehicle') && !!vehicle, prefix + ' 遭遇必须引用真实关卡车：' + (e.car || '未填'));
      }
    });
    return { ok: errors.length === 0, errors };
  }

  /** 成功只替换当前页面的后续路线；已经出发的局持有自己的副本，失败则完全不变。 */
  function configure(value) {
    const checked = validateConfig(value);
    if (!checked.ok) return checked;
    config = copy(value);
    SA.ROUTES = Object.fromEntries(config.routes.map(def => [def.id, copy(def)]));
    return checked;
  }

  /** 每次出发重新读取真实关卡车，并复制地形、节点、燃煤参数；测试路线可携带独立车辆夹具。 */
  function prepare(route) {
    const def = typeof route === 'string' ? SA.ROUTES[route] : route;
    if (!def || !Number.isFinite(def.len) || def.len <= 0 || !def.end) throw new Error('找不到有效出征路线');
    const out = copy(def);
    out.fuel = copy(def.fuel || config.fuel);
    out.encounters = (out.encounters || []).map(enc => {
      if (enc.vehicle) return enc;
      const match = /^(\d+):(\d+)$/.exec(enc.car || '');
      if (!match) throw new Error('遭遇缺少关卡车引用：' + enc.name);
      const stage = SA.StageCars.get(+match[1], +match[2]);
      const vehicle = SA.StageCars.vehicle(stage, enc.name);
      if (!vehicle) throw new Error('遭遇关卡车尚未配置：' + enc.car);
      return { ...enc, vehicle, aim: enc.aim ?? stage.aim, statMultipliers: enc.statMultipliers ?? stage.statMultipliers };
    });
    return out;
  }

  /** 按满水起步、现有驱动功率和装甲限速估计巡航速度；不计加速、坡泥、战斗和停车。 */
  function plan({ route = 'r1', vehicle } = {}) {
    if (!vehicle) throw new Error('缺少预计用车辆');
    const def = prepare(route), stats = SA.V.stats(vehicle);
    const drive = SA.Phys.driveKw(stats.weight, stats.speed);
    const speed = stats.speed * (drive ? Math.min(stats.speedBoost, Math.max(0, stats.supply - stats.equip) / drive) : 0) * stats.armorSpeedFactor;
    if (!(speed > 0)) throw new Error('该车辆没有可用行驶速度');
    const nodes = [], totals = { coalCapacityFraction: 0, waterLitres: 0, waterFillNodes: 0 }, add = (id, x, type, label, details) => nodes.push({ id, x, eta: x / speed, type, label, details });
    for (const [i, p] of (def.props || []).entries()) add('prop-' + i, p.x, 'prop', p.kind, { ...p });
    for (const [i, p] of (def.pickups || []).entries()) {
      // coal/water 的分类数字是补给节点数；比例和升数另列，不能把煤堆数量当成 kg。
      totals[p.kind] = (totals[p.kind] || 0) + (['coal', 'water'].includes(p.kind) ? 1 : p.n || 1);
      if (p.kind === 'coal') totals.coalCapacityFraction += p.amount;
      if (p.kind === 'water') { if (p.amount === undefined) totals.waterFillNodes++; else totals.waterLitres += p.amount; }
      add('pickup-' + i, p.x, 'pickup', p.kind, { ...p, planned: true, requires: p.kind === 'coal' ? '慢行' : p.kind === 'water' ? '停车' : '领取尚未实现' });
    }
    for (const [i, e] of def.encounters.entries()) {
      add('encounter-' + i, e.at, 'encounter', e.name, { car: e.car, guard: e.guard, leash: e.leash });
      add('wreck-' + i, e.guard, 'conditional', '击败敌车后的物资', { kind: 'supply', conditional: true, encounterIndex: i, requires: '击败敌车；领取尚未实现' });
    }
    totals.conditionalSupply = def.encounters.length;
    add('depot', def.end.x, 'depot', '终点站台', { bonus: def.end.bonus || 0, planned: true, requires: '抵达；奖励结算尚未实现' });
    nodes.sort((a, b) => a.x - b.x);
    return { route: def.id, vehicleName: vehicle.name, speed, coalMax: stats.supply * def.fuel.capacityPerKw,
      heatLimit: 120, totalEnemies: def.encounters.length, totals, nodes, durationEstimate: def.end.x / speed };
  }

  /** 返回数据副本供黑板呈现，调用者不能通过改列表污染正式路线。 */
  function list() { return Object.values(SA.ROUTES).map(copy); }
  /** 使用正式当前车辆出发，不写存档；界面通过 route-end 和 result 获取真实终止原因。 */
  function start(id) {
    const vehicle = SA.S.d?.vehicle;
    if (!vehicle || !SA.V.stats(vehicle).canDeploy) throw new Error('当前车辆不能出征');
    return SA.Battle.start({ mode: 'route', routeData: prepare(id) });
  }
  /** 固定种子运行真实规则；预算耗尽只报告未完成，监控中的 node 不代表取得了奖励。 */
  function simulate({ route = 'r1', vehicle, seed = 1, maxTime = 600 } = {}) {
    if (!vehicle || !SA.V.stats(vehicle).canDeploy) throw new Error('模拟车辆不能出征');
    if (!Number.isFinite(maxTime) || maxTime <= 0) throw new Error('模拟时限必须是正数');
    return SA.Battle.route.simulate({ routeData: prepare(route), vehicle, seed, maxTime });
  }

  /**
   * 出征回来入档（玩法见 docs/expedition-fun.md §5）：金属和终点站台的物资换成钱（被打爆只捡回一半金属），
   * 记下每条路线走到的最远处（下次路上插「上次到这」的旗子）。车由院子的伙计免费修好，出征不带回战损。
   * 同一趟（runId）只结一次；返回补上 money / metalKept / bonus / bestBefore / best 的结果，清点黑板照着画。
   */
  const settledRuns = new Set();
  function settle(r) {
    const d = SA.S.d;
    if (!r || r.mode !== 'route' || !d || !r.runId || settledRuns.has(r.runId)) return r;
    settledRuns.add(r.runId);
    const eco = config.economy || { metal: 5, supply: 40 }, def = SA.ROUTES[r.route];
    const metalKept = r.how === 'wrecked' ? Math.floor((r.metal || 0) / 2) : r.metal || 0;
    const bonus = r.how === 'depot' && def && def.end ? (def.end.bonus || 0) * eco.supply : 0;
    const money = metalKept * eco.metal + bonus;
    const rec = d.route || (d.route = { best: {}, runs: 0, metal: 0 });
    rec.best = rec.best || {};
    const bestBefore = rec.best[r.route] || 0;
    rec.best[r.route] = Math.max(bestBefore, Math.round(r.dist || 0));
    rec.runs = (rec.runs || 0) + 1; rec.metal = (rec.metal || 0) + metalKept;
    d.money += money;
    SA.S.save();
    return Object.assign(r, { money, metalKept, bonus, bestBefore, best: rec.best[r.route], settled: true });
  }
  /** 这条路线以前走到的最远处（px），没走过是 0 */
  const best = (id) => (SA.S.d && SA.S.d.route && SA.S.d.route.best && SA.S.d.route.best[id]) || 0;

  const initial = validateConfig(config);
  if (!initial.ok) throw new Error('出征配置非法：' + initial.errors.join('；'));
  // 本轮只落地煤水补给，完整货物与正式收益结算仍由后续阶段实现。
  return { list, start, simulate, plan, settle, best, getConfig: () => copy(config), validateConfig, configure,
    recall: () => SA.Battle.route.recall(), result: () => SA.Battle.route.result() };
})();
