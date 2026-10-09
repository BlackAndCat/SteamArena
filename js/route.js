// 出征公开入口与配置校验：规划、真实监控、出发账本和独立结算，不经竞技场结算。
window.SA = window.SA || {};
SA.Route = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  let config = copy(SA.Config.get('routes'));
  // 预热只在独立 Worker 中执行真实模拟；主线程最多保留两份完整计划，不写存档。
  const warmPlans = new Map();
  let warmWorker = null, warmTask = null, workerUnavailable = false, workerEnvironment = null;
  const workerSource = typeof document !== 'undefined' && document.currentScript?.src;
  const workerUrl = workerSource ? new URL('route-worker.js', workerSource) : null;
  // 发行脚本的版本查询串也传给 Worker 及其依赖，避免静态托管缓存混用规则版本。
  if (workerUrl) workerUrl.search = SA.RELEASE_VERSION ? '?v=' + encodeURIComponent(SA.RELEASE_VERSION) : new URL(workerSource).search;

  /** 完整输入快照也作为命中键：作者调参、换车、趟数和 DDA 改变后绝不复用旧计划。 */
  function preparationInput(route, options = {}) {
    const vehicle = options.vehicle || SA.S.d?.vehicle;
    const modules = copy(SA.Config.get('modules'));
    for (const key of ['K', 'MODULES', 'MODULE_ORDER', 'LEG_VARIANTS', 'MATS', 'INGOTS']) modules[key] = copy(SA[key]);
    const content = copy(SA.Config.get('content'));
    for (const key of Object.keys(content)) if (SA[key] !== undefined && typeof SA[key] !== 'function' && key !== 'ORDERS') content[key] = copy(SA[key]);
    return { route: typeof route === 'string' ? SA.ROUTES[route] : route,
      options: { ...options, vehicle }, record: SA.S.d?.route || {},
      configs: { modules, rules: SA.RULES || SA.Config.get('rules'), content, ui: SA.Config.get('ui'),
        'stage-cars': SA.StageCars.data, routes: config },
      starter: SA.S.starterVehicle(), rulesVersion: SA.RULES_VERSION, build: SA.BUILD_SYS };
  }

  /** 返回当前输入的准备状态；只检查缓存，不启动模拟，供加载器和自动化验收调用。 */
  function preparationStatus(id, options = {}) {
    const key = JSON.stringify(preparationInput(id, options));
    return warmPlans.has(key) ? 'ready' : warmTask?.key === key ? 'pending' : 'cold';
  }

  /** 单任务后台预热。相同输入不重复排队，输入过时立即终止；失败仍由同步入口兜底。 */
  function preload(id, options = {}) {
    if (workerUnavailable || !workerUrl || typeof Worker === 'undefined' || !SA.S.d?.vehicle) return Promise.resolve(false);
    const input = preparationInput(id, options), key = JSON.stringify(input);
    if (warmPlans.has(key)) return Promise.resolve(true);
    if (warmTask?.key === key) return warmTask.promise;
    if (warmTask) { warmWorker.terminate(); warmWorker = null; warmTask.resolve(false); warmTask = null; }
    const environment = JSON.stringify({ configs: input.configs, starter: input.starter, rulesVersion: input.rulesVersion, build: input.build });
    // 评分可跨趟复用，但依赖的模块、作者车或规则变化必须重新建立隔离运行时。
    if (warmWorker && workerEnvironment !== environment) { warmWorker.terminate(); warmWorker = null; }
    workerEnvironment = environment;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const task = warmTask = { key, promise, resolve };
    try {
      if (!warmWorker) warmWorker = new Worker(workerUrl);
      const taskWorker = warmWorker;
      taskWorker.onmessage = event => {
        if (warmTask !== task || warmWorker !== taskWorker) return;
        if (event.data.ok) {
          if (warmPlans.size >= 2) warmPlans.delete(warmPlans.keys().next().value);
          warmPlans.set(key, event.data.plan);
        }
        if (event.data.restart) { taskWorker.terminate(); warmWorker = null; }
        warmTask = null; resolve(!!event.data.ok);
      };
      taskWorker.onerror = () => {
        // 已终止旧任务的错误可能稍后送达，不能终止另一输入刚创建的新 Worker。
        if (warmTask !== task || warmWorker !== taskWorker) return;
        taskWorker.terminate(); warmWorker = null; workerUnavailable = true;
        warmTask = null; resolve(false);
      };
      taskWorker.postMessage(input);
    } catch {
      warmWorker?.terminate(); warmWorker = null; warmTask = null; workerUnavailable = true; resolve(false);
    }
    return promise;
  }
  const pickupKinds = ['coal', 'water', 'supply', 'refugee', 'relic'];
  const propKinds = ['crate', 'barricade', 'ruinDoor'];

  /** 编辑器和运行入口共用有限字段校验；正式 JSON 禁止塞入自造车辆绕过现有关卡记录。 */
  function validateConfig(value) {
    const errors = [], number = (v, min = 0) => typeof v === 'number' && Number.isFinite(v) && v > min;
    const text = v => typeof v === 'string' && !!v.trim();
    const error = (ok, message) => { if (!ok) errors.push(message); };
    if (!value || typeof value !== 'object') return { ok: false, errors: ['配置必须是对象'] };
    error(value.version === 1, '配置 version 必须为 1');
    if (value.difficulty !== undefined) {
      error(value.difficulty && typeof value.difficulty === 'object' && !Array.isArray(value.difficulty), 'difficulty 必须是对象');
      for (const key of ['baseBudget', 'driveWasteHeat', 'driveWasteHeatCap'])
        if (value.difficulty?.[key] !== undefined) error(number(value.difficulty[key]), 'difficulty.' + key + ' 必须是有限正数');
      if (value.difficulty?.segmentCount !== undefined) error(Number.isInteger(value.difficulty.segmentCount) && value.difficulty.segmentCount > 0, 'difficulty.segmentCount 必须是正整数');
    }
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
      if (r.firstDuelAt !== undefined) error(coord(r.firstDuelAt) && r.firstDuelAt <= r.end?.x, prefix + ' firstDuelAt 必须在路线内且不晚于终点');
      if (r.end?.bonus !== undefined) error(Number.isFinite(r.end.bonus) && r.end.bonus >= 0, prefix + ' end.bonus 必须非负');
      for (const key of ['hills', 'mud', 'props', 'pickups', 'encounters']) {
        error(Array.isArray(r[key]), prefix + ' ' + key + ' 必须是数组');
      }
      for (const h of Array.isArray(r.hills) ? r.hills : []) error(h && coord(h.x) && number(h.w) && Number.isFinite(h.h) && h.h >= 0, prefix + ' 土坡坐标/宽高非法');
      for (const m of Array.isArray(r.mud) ? r.mud : []) error(Array.isArray(m) && m.length === 2 && coord(m[0]) && coord(m[1]) && m[0] < m[1], prefix + ' 泥地区间非法');
      for (const p of Array.isArray(r.props) ? r.props : []) error(p && propKinds.includes(p.kind) && coord(p.x) && number(p.w) && number(p.h) && number(p.hp), prefix + ' 障碍种类/坐标/尺寸/耐久非法');
      if (r.mobs !== undefined) {
        error(Array.isArray(r.mobs), prefix + ' mobs 必须是数组');
        for (const g of Array.isArray(r.mobs) ? r.mobs : []) {
          error(g && ['soldier', 'crawler', 'sentry', 'barrel'].includes(g.kind) && coord(g.x), prefix + ' 小机械种类/坐标非法');
          if (g?.n !== undefined) error(Number.isInteger(g.n) && g.n > 0 && g.n <= 10000, prefix + ' 小机械 n 必须是 1～10000 的整数');
          if (g?.gap !== undefined) error(number(g.gap), prefix + ' 小机械 gap 必须是有限正数');
          if (g?.minRun !== undefined) error(Number.isInteger(g.minRun) && g.minRun > 0, prefix + ' 小机械 minRun 必须是正整数');
          if (g?.price !== undefined) error(number(g.price), prefix + ' 小机械 price 必须是有限正数');
          if (g?.release !== undefined) error(coord(g.release), prefix + ' 小机械 release 必须在路线范围内');
        }
      }
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
        if (e.aim !== undefined) error(Number.isFinite(e.aim) && e.aim >= 0 && e.aim <= 1, prefix + ' aim 必须是 0～1 的有限数');
        if (e.minRun !== undefined) error(Number.isInteger(e.minRun) && e.minRun > 0, prefix + ' 遭遇 minRun 必须是正整数');
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
  function prepare(route, options = {}) {
    const input = preparationInput(route, options);
    // 工具和 Worker 没有浏览器 Worker，继续走原同步算法；热命中始终交付副本。
    if (warmPlans.size) {
      const cached = warmPlans.get(JSON.stringify(input));
      if (cached) return copy(cached);
    }
    // 冷回退也遵守相同规则边界；热调模块/地形/燃煤后不能使用旧评分。
    const environment = JSON.stringify({ configs: input.configs, starter: input.starter, rulesVersion: input.rulesVersion, build: input.build });
    if (duelEnvironment !== environment) { duelCache.clear(); duelEnvironment = environment; }
    const def = typeof route === 'string' ? SA.ROUTES[route] : route;
    if (!def || !Number.isFinite(def.len) || def.len <= 0 || !def.end) throw new Error('找不到有效出征路线');
    const out = copy(def);
    if (out.mobs?.length && !SA.RouteMobs) throw new Error('路线包含小机械，但未加载 route-mobs.js');
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
    if (options.difficulty !== false) planDifficulty(out, options);
    if (out.mobs?.length && !SA.RouteMobs) throw new Error('难度规划需要小机械，但未加载 route-mobs.js');
    return out;
  }

  const duelCache = new Map();
  let duelEnvironment = null;
  /** 真实决斗评分以实际进入本场的种子作分母，先前失败另记全趟概率，不把山顶目标偷换成到站率。 */
  function scoreRouteDuel(routeData, vehicle, count) {
    const rules = copy(routeData);
    // 监控、选车评语与出发账本不影响物理；避免第二场前缀携带统计表使缓存反复膨胀和失配。
    for (const encounter of rules.encounters) for (const field of ['candidateScores', 'targetWinRate', 'measuredWinRate',
      'scoredAttempts', 'reached', 'wins', 'winRate', 'overallWinRate', 'unresolved', 'resolved']) delete encounter[field];
    delete rules.difficulty.routeRun;
    const key = 'route:' + JSON.stringify({ routeData: rules, vehicle, maxTime: 600, dt: 1 / 30 });
    let record = duelCache.get(key);
    if (!record) {
      record = { seeds: {} };
      if (duelCache.size >= 128) duelCache.delete(duelCache.keys().next().value);
      duelCache.set(key, record);
    }
    let wins = 0, reached = 0, unresolved = 0;
    const index = routeData.encounters.length - 1;
    for (let i = 1; i <= count; i++) {
      // 固定分散的训练样本，与验收的 1001～1020 完全分离；不按验收样本选车。
      const seed = 7919 * i + 17;
      let sample = record.seeds[seed];
      if (!sample) {
        const actual = SA.Battle.route.simulate({ routeData: rules, vehicle, seed, maxTime: 600, stopAfterEncounter: index + 1 });
        const entered = actual.events.some(event => event.type === 'encounter-start' && event.encounterIndex === index);
        const won = actual.cleared.length > index;
        sample = record.seeds[seed] = { reached: entered, won, unresolved: entered && !won && !actual.completed };
      }
      reached += sample.reached ? 1 : 0; wins += sample.won ? 1 : 0; unresolved += sample.unresolved ? 1 : 0;
    }
    const resolved = reached - unresolved;
    return { scoredAttempts: count, reached, resolved, unresolved, wins, winRate: resolved ? wins / resolved : 0, overallWinRate: wins / count };
  }
  /** 火力、耐久和热续航均以四件起步车归一化；升级冷却也会提高战力，而不只统计武器。 */
  function powerScore(vehicle) {
    const s = SA.V.stats(vehicle), base = SA.V.stats(SA.S.starterVehicle());
    const thermalCap = base.overheat * 4;
    return 0.4 * s.dps / Math.max(0.1, base.dps) + 0.3 * s.hp / Math.max(1, base.hp)
      + 0.3 * Math.min(thermalCap, s.overheat) / Math.max(1, base.overheat);
  }
  /** 候选评分只调用隔离的无画面战斗；缓存包含完整车辆、地形、性格与固定模拟种子。 */
  function chooseDuel(vehicle, candidates, target, terrain, unarmored, routeData, at, authoredCars) {
    // 成熟路线先比较作者已经校准的固定驾驶员，不反复从小样本全库搜索生成新组合。
    // 当玩家升级到碾压作者候选，或作者车全部过强/不可用时，才继续下方完整关卡池匹配。
    if (routeData.difficulty.runIndex >= 5) {
      const authored = [];
      for (const candidate of candidates.filter(candidate => authoredCars.has(candidate.car)).slice(0, 2)) {
        const encounter = { ...candidate, at, guard: at + 400, leash: Math.min(routeData.len, at + 1000) };
        const input = { ...routeData, difficulty: { ...routeData.difficulty, dda: {}, seed: 1 }, encounters: [...routeData.encounters, encounter] };
        authored.push({ candidate, measured: scoreRouteDuel(input, vehicle, 12) });
      }
      if (authored.some(item => item.measured.resolved > 0 && !item.measured.unresolved && item.measured.winRate > 0 && item.measured.winRate < 1)) {
        const viable = authored.filter(item => item.measured.resolved > 0 && !item.measured.unresolved);
        viable.sort((a, b) => Math.abs(a.measured.winRate - target) - Math.abs(b.measured.winRate - target)
          || (a.candidate.aim ?? 0.8) - (b.candidate.aim ?? 0.8));
        const selected = viable[0];
        return { ...copy(selected.candidate), targetWinRate: target, measuredWinRate: selected.measured.winRate, ...selected.measured,
          candidateScores: authored.map(item => ({ name: item.candidate.name, car: item.candidate.car, aim: item.candidate.aim,
            style: item.candidate.style, source: 'route', fine: true, ...item.measured })) };
      }
    }
    const scores = [], preliminary = [];
    for (const candidate of candidates) {
      let armored = false;
      SA.V.each(candidate.vehicle, cell => { const mod = SA.mod(cell); if ((mod.cat === 'structure' && (mod.armor || 0) > 0) || mod.cat === 'armor') armored = true; });
      if (unarmored && armored) continue;
      const input = { p: vehicle, e: candidate.vehicle, terrain, pAim: 0.8, pStyle: 'rush', eAim: candidate.aim ?? 0.8,
        eStyle: candidate.style, eStatMultipliers: candidate.statMultipliers, dt: 1 / 30 };
      const estimateKey = 'arena:' + JSON.stringify(input);
      let estimate = duelCache.get(estimateKey);
      if (estimate === undefined) {
        let wins = 0;
        // 竞技场单局只作辅助观察；真正的三局全池预筛使用远征规则，避免重复几十场不匹配的对打。
        wins += SA.Battle.scoreDuel({ ...input, seed: 1 }).winner === 'p' ? 1 : 0;
        estimate = wins;
        if (duelCache.size >= 128) duelCache.delete(duelCache.keys().next().value);
        duelCache.set(estimateKey, estimate);
      }
      const encounter = { ...candidate, at, guard: at + 400, leash: Math.min(routeData.len, at + 1000) };
      const routeInput = { ...routeData, difficulty: { ...routeData.difficulty, dda: {}, seed: 1 }, encounters: [...routeData.encounters, encounter] };
      preliminary.push({ candidate, input, estimate, routeInput, authored: authoredCars.has(candidate.car) });
    }
    // 先排除竞技场零胜的明显强车；仅当所有非零候选也无真实胜迹，才回退两辆最低战力候选。
    let pool = preliminary.filter(item => item.estimate > 0);
    const rating = item => SA.V.stats(item.candidate.vehicle).rating;
    if (!pool.length) pool = [...preliminary].sort((a, b) => rating(a) - rating(b)).slice(0, 2);
    for (const item of pool) item.probe = scoreRouteDuel(item.routeInput, vehicle, 3);
    if (!pool.some(item => item.probe.wins > 0)) {
      for (const item of [...preliminary].filter(item => !item.probe).sort((a, b) => rating(a) - rating(b)).slice(0, 2)) {
        item.probe = scoreRouteDuel(item.routeInput, vehicle, 3); pool.push(item);
      }
    }
    // 饱和胜率并列时优先低准度原车，保留加强驾驶员的校准空间，不硬加特定关卡 ID。
    pool.sort((a, b) => (b.probe.reached > 0) - (a.probe.reached > 0) || Math.abs(a.probe.winRate - target) - Math.abs(b.probe.winRate - target)
      || (a.candidate.aim ?? 0.8) - (b.candidate.aim ?? 0.8));
    const below = pool.find(item => item.probe.winRate <= target), above = pool.find(item => item.probe.winRate >= target);
    const fineCandidates = [...new Set([below, above].filter(Boolean))];
    for (const item of pool) if (fineCandidates.length < 2 && !fineCandidates.includes(item)) fineCandidates.push(item);
    // 保留作者已校准的代表车，不让三局粗样本将它们挤出；仍由真实胜率比较，不强制车辆 ID。
    for (const item of preliminary.filter(item => item.authored && item.estimate > 0).slice(0, 2))
      if (!fineCandidates.includes(item)) fineCandidates.push(item);
    fineCandidates.sort((a, b) => Math.abs(a.probe.winRate - target) - Math.abs(b.probe.winRate - target));
    // 第四趟的小样本曾误选驾驶员，采用完整二十局并比较两档；其余趟保留较低规划成本。
    const runIndex = routeData.difficulty.runIndex;
    const trainCount = runIndex === 4 ? 20 : runIndex < 5 ? 10 : 12;
    const compareDriverPair = runIndex === 4;
    for (const { candidate, routeInput } of fineCandidates) {
      const measured = scoreRouteDuel(routeInput, vehicle, trainCount);
      scores.push({ candidate, winRate: measured.winRate, measured });
      if (!measured.unresolved && Math.abs(measured.winRate - target) <= 0.05) break;
    }
    scores.sort((a, b) => Math.abs(a.winRate - target) - Math.abs(b.winRate - target)
      || (a.candidate.aim ?? 0.8) - (b.candidate.aim ?? 0.8));
    if (!scores.length) throw new Error('缺少无装甲决斗候选车');
    // 既有车存在档位空隙时，仅为最近一辆配置固定驾驶员档；这是候选身份，不随 DDA 更改准度。
    if (Math.abs(scores[0].winRate - target) > 0.05) {
      const bases = scores.slice(0, 1);
      for (const base of bases) {
        const originalAim = base.candidate.aim ?? 0.8;
        // 弹道命中不同部件时准度与胜率未必单调，固定取相邻两档并以真实胜率决定。
        const tiers = [0.25, 0.45, 0.65, 0.85, 1];
        const aims = originalAim <= 0.25 ? [0.65, 0.85]
          : [tiers.filter(aim => aim < originalAim).pop(), tiers.find(aim => aim > originalAim)].filter(aim => aim !== undefined);
        for (const aim of aims) {
          const pilot = { 0.25: '生手驾驶员', 0.45: '普通驾驶员', 0.65: '熟练驾驶员', 0.85: '老练驾驶员', 1: '专家驾驶员' }[aim];
          const candidate = { ...copy(base.candidate), name: base.candidate.name + ' · ' + pilot, aim, driverAim: aim };
          const encounter = { ...candidate, at, guard: at + 400, leash: Math.min(routeData.len, at + 1000) };
          const routeInput = { ...routeData, difficulty: { ...routeData.difficulty, dda: {}, seed: 1 }, encounters: [...routeData.encounters, encounter] };
          const measured = scoreRouteDuel(routeInput, vehicle, trainCount);
          scores.push({ candidate, winRate: measured.winRate, measured });
          if (!compareDriverPair && !measured.unresolved && Math.abs(measured.winRate - target) <= 0.05) break;
        }
      }
      scores.sort((a, b) => Math.abs(a.winRate - target) - Math.abs(b.winRate - target)
        || (a.candidate.aim ?? 0.8) - (b.candidate.aim ?? 0.8));
    }
    return { ...copy(scores[0].candidate), targetWinRate: target, measuredWinRate: scores[0].winRate, ...scores[0].measured,
      candidateScores: [...preliminary.map(item => ({ name: item.candidate.name, car: item.candidate.car || null, arenaWinRate: item.estimate,
        ...(item.probe || { skipped: item.estimate > 0 ? 'power-distance' : 'arena-zero' }) })),
        ...scores.map(item => ({ name: item.candidate.name, car: item.candidate.car || null, aim: item.candidate.aim, fine: true, ...item.measured }))] };
  }
  /** 冻结本趟的输入与威胁计划。教学只保留煤、物资和两三名步兵，静态作者数据不被改写。 */
  function planDifficulty(out, options) {
    const vehicle = options.vehicle || SA.S.d?.vehicle;
    if (!vehicle) throw new Error('难度规划缺少车辆');
    const rec = SA.S.d?.route, routeRun = (rec?.routeRuns?.[out.id] || 0) + 1;
    const firstRoute = rec?.firstRoute || Object.keys(rec?.routeRuns || {})[0] || out.id;
    const runIndex = options.runIndex ?? (routeRun + (firstRoute === out.id ? 0 : 2));
    if (!Number.isInteger(runIndex) || runIndex < 1) throw new Error('出发趟数必须是正整数');
    const params = { baseBudget: 24, segmentCount: 4, ...(config.difficulty || {}) };
    // 未指定种子的正式出发按路线与有效趟数派生；模拟显式传入默认 1，保持工具兼容。
    const seed = options.seed ?? [...out.id].reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0, runIndex);
    out.difficulty = { ...params, runIndex, effectiveRunIndex: runIndex, routeRun, powerScore: powerScore(vehicle), seed,
      dda: copy(options.dda || SA.S.d?.route?.dda?.[out.id] || {}), teaching: runIndex <= 2 };
    if (runIndex <= 2) {
      out.encounters = []; out.props = [];
      out.pickups = [{ kind: 'supply', x: 350 }, { kind: 'coal', x: 800, amount: 0.3 }, { kind: 'supply', x: 1150 }];
      out.mobs = [{ kind: 'soldier', x: 300, n: runIndex === 1 ? 2 : 3, gap: 90 }];
      return;
    }
    // 弱车是现有起步构筑的完整合法车辆，只有供汽、驾驶、底盘和一门炮，绝不加伤害补偿。
    const weak = { name: '废土学徒', vehicle: SA.S.starterVehicle(), aim: 0.65, style: 'balanced' };
    const candidates = [...out.encounters.filter(e => runIndex >= (e.minRun || 1))];
    const authoredCars = new Set(candidates.map(candidate => candidate.car));
    // 候选池复用全部已经存在的合法关卡记录；只读既有车，不生成或覆盖正式战役车。
    for (const [car, stage] of Object.entries(SA.StageCars.data.records || {})) {
      if (candidates.some(candidate => candidate.car === car)) continue;
      const vehicle = SA.StageCars.vehicle(stage, stage.name);
      if (!vehicle || !SA.V.stats(vehicle).canDeploy) continue;
      candidates.push({ car, name: stage.name || vehicle.name, vehicle, aim: stage.aim ?? 0.8, style: stage.style,
        statMultipliers: stage.statMultipliers });
    }
    // 原型弱车仅在没有既有合法记录时兜底；正常路线优先使用已存在的关卡候选。
    if (!candidates.length) candidates.push(weak);
    out.mobs = (out.mobs || []).filter(g => runIndex >= Math.max(g.minRun || 1, ({ soldier: 1, crawler: 3, sentry: 3, barrel: 4 }[g.kind] || 1)));
    if (!out.mobs.length) out.mobs = Array.from({ length: 8 }, (_, i) => ({ kind: i % 3 === 2 ? 'crawler' : 'soldier', x: 600 + i * 800, n: 3 }));
    // 第三趟的前奏只两名步兵，给首次决斗保留冷却水；后半程仍使用作者的成熟组与点数预算。
    if (runIndex <= 4) out.mobs = [{ kind: 'soldier', x: 1200, n: runIndex === 3 ? 2 : 3, gap: 140 }, ...out.mobs.filter(g => g.x > 8200)];
    const targets = runIndex === 3 ? [0.9] : runIndex === 4 ? [0.8] : [0.75, 0.6];
    out.encounters = [];
    targets.forEach((target, i) => {
      // 首场位置由路线作者配置；未配置的旧路线沿用 3500px，短路线仍限制在前段。
      const at = i ? out.len * 0.8 : Math.min(out.firstDuelAt ?? 3500, out.len * 0.38);
      const picked = chooseDuel(vehicle, candidates, target, null, runIndex === 3, out, at, authoredCars);
      out.encounters.push({ ...picked, at, guard: at + 400, leash: Math.min(out.len, at + 1000) });
    });
  }

  /** 按满水起步、现有驱动功率和装甲限速估计巡航速度；不计加速、坡泥、战斗和停车。 */
  function plan({ route = 'r1', vehicle, runIndex, seed = 1, dda, difficulty = true } = {}) {
    if (!vehicle) throw new Error('缺少预计用车辆');
    const def = prepare(route, { vehicle, runIndex, seed, dda, difficulty }), stats = SA.V.stats(vehicle);
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
      add('pickup-' + i, p.x, 'pickup', p.kind, { ...p, planned: true, requires: '开过去就捡' });
    }
    for (const [i, e] of def.encounters.entries()) {
      add('encounter-' + i, e.at, 'encounter', e.name, { car: e.car, guard: e.guard, leash: e.leash });
      add('wreck-' + i, e.guard, 'conditional', '击败敌车后的物资', { kind: 'supply', conditional: true, encounterIndex: i, requires: '击败敌车后开过去就捡' });
    }
    totals.conditionalSupply = def.encounters.length;
    add('depot', def.end.x, 'depot', '终点站台', { bonus: def.end.bonus || 0, planned: true, requires: '抵达；奖励结算尚未实现' });
    nodes.sort((a, b) => a.x - b.x);
    return { route: def.id, vehicleName: vehicle.name, speed, coalMax: stats.supply * def.fuel.capacityPerKw,
      heatLimit: 120, totalEnemies: def.encounters.length, difficulty: def.difficulty || null, totals, nodes, durationEstimate: def.end.x / speed };
  }

  /** 返回数据副本供黑板呈现，调用者不能通过改列表污染正式路线。 */
  function list() {
    const id = SA.S.d?.route?.firstRoute;
    // 优先当前路线，只预热一条，避免列表重绘让多路线互相取消。
    if (SA.S.d?.vehicle) preload(SA.ROUTES[id] ? id : Object.keys(SA.ROUTES)[0]);
    return Object.values(SA.ROUTES).map(copy);
  }
  /** 使用正式当前车辆出发；成功开局后登记实际出发，界面通过 route-end 和 result 获取终止原因。 */
  function start(id, options = {}) {
    const vehicle = SA.S.d?.vehicle;
    if (!vehicle || !SA.V.stats(vehicle).canDeploy) throw new Error('当前车辆不能出征');
    const routeData = prepare(id, { ...options, vehicle });
    const battle = SA.Battle.start({ mode: 'route', routeData });
    const rec = SA.S.d.route || (SA.S.d.route = { best: {}, runs: 0, metal: 0 });
    rec.departures = (rec.departures || 0) + 1;
    rec.firstRoute = rec.firstRoute || Object.keys(rec.routeRuns || {})[0] || id;
    rec.routeRuns = rec.routeRuns || {}; rec.routeRuns[id] = (rec.routeRuns[id] || 0) + 1;
    SA.S.save();
    return battle;
  }
  /** 固定种子运行真实规则；预算耗尽只报告未完成，监控中的 node 不代表取得了奖励。 */
  function simulate({ route = 'r1', vehicle, seed = 1, maxTime = 600, runIndex, dda, difficulty = true } = {}) {
    if (!vehicle || !SA.V.stats(vehicle).canDeploy) throw new Error('模拟车辆不能出征');
    if (!Number.isFinite(maxTime) || maxTime <= 0) throw new Error('模拟时限必须是正数');
    return SA.Battle.route.simulate({ routeData: prepare(route, { vehicle, seed, runIndex, dda, difficulty }), vehicle, seed, maxTime });
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
    const eco = { metal: 5, supply: 40, relic: 120, ...(config.economy || {}) }, def = SA.ROUTES[r.route];
    const metalKept = r.how === 'wrecked' ? Math.floor((r.metal || 0) / 2) : r.metal || 0;
    const bonus = r.how === 'depot' && def && def.end ? (def.end.bonus || 0) * eco.supply : 0;
    const cargo = r.cargo || [], count = (k) => cargo.filter(c => (typeof c === 'string' ? c : c.kind) === k).length;
    const goods = count('supply') * eco.supply + count('relic') * eco.relic;
    const money = metalKept * eco.metal + bonus + goods;
    const rec = d.route || (d.route = { best: {}, runs: 0, metal: 0 });
    rec.refugees = (rec.refugees || 0) + count('refugee');
    rec.best = rec.best || {};
    const bestBefore = rec.best[r.route] || 0;
    rec.best[r.route] = Math.max(bestBefore, Math.round(r.dist || 0));
    rec.runs = (rec.runs || 0) + 1; rec.metal = (rec.metal || 0) + metalKept;
    // 连续战斗失败与健康过段各用独立计数；过热和主动返航不会计入失败。
    if (r.difficulty) {
      rec.dda = rec.dda || {}; rec.streaks = rec.streaks || {};
      const table = rec.dda[r.route] || (rec.dda[r.route] = {}), streaks = rec.streaks[r.route] || (rec.streaks[r.route] = {});
      for (const segment of r.segments || []) {
        const key = segment.index, streak = streaks[key] || (streaks[key] = { failed: 0, healthy: 0 });
        if (segment.passed) {
          streak.failed = 0; streak.healthy = segment.hp > 0.7 ? streak.healthy + 1 : 0;
          if (streak.healthy >= 2) { table[key] = Math.min(1.3, (table[key] || 1) * 1.1); streak.healthy = 0; }
        } else if ((r.how === 'wrecked' && r.cause === 'combat') || (r.how === 'stranded' && r.cause === 'coal')) {
          streak.healthy = 0; streak.failed++;
          if (streak.failed >= 2) { table[key] = Math.max(0.6, (table[key] || 1) * 0.85); streak.failed = 0; }
        } else { streak.failed = 0; streak.healthy = 0; }
      }
    }
    d.money += money;
    SA.S.save();
    return Object.assign(r, { money, metalKept, bonus, goods, bestBefore, best: rec.best[r.route], settled: true });
  }
  /** 这条路线以前走到的最远处（px），没走过是 0 */
  const best = (id) => (SA.S.d && SA.S.d.route && SA.S.d.route.best && SA.S.d.route.best[id]) || 0;

  const initial = validateConfig(config);
  if (!initial.ok) throw new Error('出征配置非法：' + initial.errors.join('；'));
  return { list, start, simulate, prepare, preload, preparationStatus, powerScore, plan, settle, best, getConfig: () => copy(config), validateConfig, configure,
    recall: () => SA.Battle.route.recall(), result: () => SA.Battle.route.result() };
})();
