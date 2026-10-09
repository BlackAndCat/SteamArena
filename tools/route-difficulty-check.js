/* 出征难度验收：固定车型与独立的 20 个种子，全部调用正式逐帧模拟，不接玩家真实存档。 */
'use strict';
const assert = require('assert');
const { runtime } = require('./route-check');

/** 固定成长路径：原型机、小水罐、竖水罐配铁制小机枪，以及普通铁制锅炉/水箱构筑。 */
function fixtures(SA) {
  const starter = SA.S.starterVehicle();
  const cooled = SA.V.clone(starter);
  cooled.name = '教学小水罐';
  cooled.body[9][7] = SA.newCell('tank_s', 1);
  const upgraded = SA.V.clone(cooled);
  upgraded.name = '首次决斗检查车';
  upgraded.body[9][7] = null;
  upgraded.body[8][6] = upgraded.body[8][7];
  upgraded.body[8][7] = SA.newCell('tank_tall', 1);
  upgraded.body[8][8] = SA.newCell('mg_s', 2);
  const middle = SA.V.create('中期铁制检查车');
  for (const c of [4, 6, 8, 10]) middle.body[10][c] = SA.newCell('track', 2);
  middle.body[8][4] = SA.newCell('boiler', 2);
  middle.body[8][8] = SA.newCell('water', 2);
  middle.body[7][4] = SA.newCell('helmet', 2);
  middle.body[6][8] = SA.newCell('mg', 2);
  for (const vehicle of [starter, cooled, upgraded, middle])
    assert(SA.V.stats(vehicle).canDeploy, vehicle.name + '：' + JSON.stringify(SA.V.issues(vehicle)));
  return { starter, cooled, upgraded, middle };
}

/** 每秒样本可以连续处于高峰；只数跨越阈值的次数，避免把十秒高峰冒充十轮节奏。 */
function crossings(samples, predicate) {
  let count = 0, previous = samples.length ? predicate(samples[0]) : false;
  for (const sample of samples.slice(1)) {
    const current = predicate(sample);
    if (current && !previous) count++;
    previous = current;
  }
  return count;
}

/** 固定种子不允许输出非有限数；也不把超时预算用完伪装成到站或过热。 */
function finite(value) {
  if (typeof value === 'number') assert(Number.isFinite(value), '出现非有限数值');
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}

/** 一份简短的逐种子实况，报告终止原因、进度和真正发生过的战斗/拾取/强度循环。 */
function summarize(sim, seed) {
  finite(sim);
  const events = sim.events || [], samples = sim.samples || [];
  return { seed, how: sim.reason, cause: sim.result?.cause || null, time: sim.time, dist: sim.dist,
    pickups: events.filter(e => e.type === 'pickup').length,
    broken: sim.result?.broken || 0,
    duels: events.filter(e => e.type === 'encounter-start').length,
    cleared: sim.cleared.length,
    peaks: crossings(samples, s => s.I >= 0.7),
    rests: crossings(samples, s => s.I < 0.3),
    hp: sim.state.hp };
}

/** 种子 1001～1020 留作验收，不能拿同一批种子的输赢回填选敌评分。 */
function batch(SA, vehicle, runIndex, count = 20) {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const seed = 1000 + i;
    rows.push(summarize(SA.Route.simulate({ route: 'r2', vehicle, runIndex, seed, maxTime: 600 }), seed));
  }
  const mean = key => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  return { runIndex, vehicle: vehicle.name, seeds: rows.length,
    arrived: rows.filter(r => r.how === 'depot').length,
    overheated: rows.filter(r => r.cause === 'overheat').length,
    combatDeaths: rows.filter(r => r.how === 'wrecked').length,
    duelWins: rows.filter(r => r.cleared > 0).length,
    // 山顶以实际进入该场的局数为分母；整趟到站率继续单独验收，不能混为同一指标。
    duelRates: Array.from({ length: Math.max(...rows.map(r => r.duels)) }, (_, index) => {
      const reached = rows.filter(r => r.duels > index).length;
      const wins = rows.filter(r => r.cleared > index).length;
      return { encounter: index + 1, reached, wins, winRate: wins / reached };
    }),
    averageTime: mean('time'), averageDistance: mean('dist'), rows };
}

/** 过热必须走真实结束及入档链：所有货物/金属保留，而且结算不能重复领取。 */
function overheatCheck(rt, vehicle) {
  const { SA } = rt;
  const B = SA.Battle.startState({ mode: 'route', vehicle,
    routeData: SA.Route.prepare('r2', { vehicle, runIndex: 1, seed: 71 }) });
  B.route.cargo = ['supply', 'supply', 'spoils', 'refugee', 'relic'];
  B.route.metal = 7;
  B.p.heat = B.p.heatMax;
  rt.api().step(1 / 60);
  const r = SA.Route.result();
  assert.strictEqual(r.how, 'overheated');
  assert.strictEqual(r.cause, 'overheat');
  assert.deepStrictEqual(Array.from(r.cargo), ['supply', 'supply', 'spoils', 'refugee', 'relic']);
  assert.strictEqual(r.lost.length, 0);
  const before = SA.S.d.money, materialsBefore = SA.S.d.route.materials, paid = SA.Route.settle(r);
  assert.strictEqual(paid.metalKept, 7, '过热仍扣除金属');
  const economy = SA.Route.getConfig().economy;
  assert.strictEqual(paid.goods, 2 * economy.supply + economy.relic, '过热带回的物资/遗迹没有全额折价');
  assert.strictEqual(paid.money, 0, '出征仍增加金币');
  assert.strictEqual(paid.materials, paid.goods + 7 * economy.metal, '过热结算遗漏了制作物资');
  assert.strictEqual(SA.S.d.money, before);
  assert.strictEqual(SA.S.d.route.materials, materialsBefore + paid.materials);
  const after = SA.S.d.route.materials;
  SA.Route.settle(r);
  assert.strictEqual(SA.S.d.route.materials, after, '同局物资重复领取');
  assert.strictEqual(SA.S.d.money, before);
  return { how: r.how, metalKept: paid.metalKept, cargo: Array.from(r.cargo) };
}

/** 模拟/预计/候选选车均须隔离存档、当前战斗与随机源，输入车型也不能被模拟战损污染。 */
function isolationCheck(rt, vehicle) {
  const { SA } = rt, input = JSON.stringify(vehicle), saved = JSON.stringify(SA.S.d);
  const current = rt.api().getState(), writes = rt.writes(), calls = rt.randomCalls();
  const args = { route: 'r2', vehicle, runIndex: 3, seed: 1017, maxTime: 12 };
  const first = SA.Route.simulate(args), second = SA.Route.simulate(args);
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second), '同趟数同车同种子不可复现');
  assert.strictEqual(JSON.stringify(vehicle), input, '候选评分损伤了玩家输入车');
  assert.strictEqual(JSON.stringify(SA.S.d), saved, '模拟改动存档');
  assert.strictEqual(rt.writes(), writes, '模拟写入存档');
  assert.strictEqual(rt.api().getState(), current, '选敌或模拟覆盖当前战斗');
  assert.strictEqual(rt.randomCalls(), calls, '固定种子消耗页面随机源');
  return true;
}

/** 结构检查先于概率验收，确保教学豁免、首敌无甲和正式出发计数确实在运行链上。 */
function planningCheck(rt, cars) {
  const { SA } = rt;
  assert.strictEqual(SA.Route.list()[0].id, 'r2', '正式入口未默认选择已校准的r2');
  const plans = [1, 2, 3, 4, 5].map(runIndex => SA.Route.prepare('r2', {
    vehicle: runIndex < 3 ? cars.starter : runIndex === 5 ? cars.middle : cars.upgraded, runIndex, seed: 53 }));
  assert.deepStrictEqual(plans.map(p => p.encounters.length), [0, 0, 1, 1, 2]);
  for (const plan of plans.slice(0, 2)) {
    const count = plan.mobs.reduce((sum, m) => sum + (m.n || 1), 0);
    assert(count >= 2 && count <= 3, '教学趟不是两三个小兵');
    assert(plan.mobs.every(m => m.kind === 'soldier'), '教学趟混入了其他小机械');
    assert(plan.pickups.every(p => ['supply', 'coal'].includes(p.kind)), '教学趟混入其他拾取教学');
  }
  const enemy = plans[2].encounters[0].vehicle;
  // 履带本体自带基础防护并非安装甲片；检查专用防御件，不能把正常底盘误判为带甲车。
  SA.V.each(enemy, cell => assert(!SA.mod(cell).armor || SA.mod(cell).cat === 'mobility', '首场决斗敌车带装甲'));
  const departures = SA.S.d.route?.departures || 0;
  const oldRuns = SA.S.d.route?.routeRuns?.r2 || 0;
  const B = SA.Route.start('r2', { seed: 17 });
  assert.strictEqual(SA.S.d.route.departures, departures + 1, '出发次数没有在出发时入档');
  assert.strictEqual(B.opts.routeData.difficulty.runIndex, oldRuns + 1);
  assert.strictEqual(SA.S.d.route.routeRuns.r2, oldRuns + 1);
  return plans.map(p => ({ runIndex: p.difficulty.runIndex, power: p.difficulty.powerScore,
    encounters: p.encounters.map(e => ({ name: e.name, targetWinRate: e.targetWinRate })) }));
}

/** 结算夹具只喂实际出口约定，分别核对连败、打断、健康通过、系数上下限和重置。 */
function adaptationCheck(rt) {
  const { SA } = rt;
  SA.S.reset();
  let serial = 0;
  const value = () => SA.S.d.route.dda.r2?.[1] ?? 1;
  const finish = (how, cause, passed = false, hp = 0.8) => SA.Route.settle({
    mode: 'route', route: 'r2', runId: 'dda-check-' + ++serial, how, cause,
    dist: 8000, metal: 0, cargo: [], difficulty: { runIndex: 5, segmentCount: 4 },
    segments: [{ index: 1, passed, hp }] });
  finish('wrecked', 'combat');
  assert.strictEqual(value(), 1, '一次失败就触发降压');
  finish('wrecked', 'combat');
  assert(Math.abs(value() - 0.85) < 1e-10, '连续两次失败没有降低15%预算');
  finish('wrecked', 'combat');
  finish('overheated', 'overheat');
  finish('wrecked', 'combat');
  assert(Math.abs(value() - 0.85) < 1e-10, '过热被算作失败或未打断连败');
  finish('recall', 'recall');
  finish('stranded', 'coal');
  assert(Math.abs(value() - 0.85) < 1e-10, '主动返航未打断连败');
  finish('stranded', 'coal');
  assert(Math.abs(value() - 0.85 * 0.85) < 1e-10, '缺煤两次没有触发分段降压');
  for (let i = 0; i < 12; i++) finish('wrecked', 'combat');
  assert.strictEqual(value(), 0.6, '连续失败突破最低系数');
  finish('depot', 'depot', true, 0.7);
  finish('depot', 'depot', true, 0.9);
  assert.strictEqual(value(), 0.6, '耐久恰好70%被算作轻松通过');
  finish('depot', 'depot', true, 0.9);
  assert(Math.abs(value() - 0.66) < 1e-10, '两次健康通过没有提高10%预算');
  for (let i = 0; i < 30; i++) finish('depot', 'depot', true, 0.9);
  assert.strictEqual(value(), 1.3, '健康通过突破最高系数');
  SA.S.reset();
  assert.strictEqual(Object.keys(SA.S.d.route.dda).length, 0, '重置仍保留旧难度');
  return true;
}

/** 连败辅助只减少供给，不能借重新匹配把决斗车变强，抵消已给玩家的帮助。 */
function quantityOnlyCheck(SA, vehicle) {
  const options = { vehicle, runIndex: 3, seed: 53 };
  const normal = SA.Route.prepare('r2', { ...options, dda: {} });
  const assisted = SA.Route.prepare('r2', { ...options, dda: { 0: 0.6, 1: 0.6, 2: 0.6, 3: 0.6 } });
  assert.strictEqual(JSON.stringify(normal.encounters), JSON.stringify(assisted.encounters), '降低小兵预算却重新匹配了不同决斗车');
  assert.strictEqual(JSON.stringify(normal.mobs), JSON.stringify(assisted.mobs), 'DDA改写了小机械定义');
  assert.strictEqual(normal.difficulty.powerScore, assisted.difficulty.powerScore);
  const first = SA.Battle.route.simulate({ routeData: normal, vehicle, seed: 53, maxTime: 2 });
  const second = SA.Battle.route.simulate({ routeData: assisted, vehicle, seed: 53, maxTime: 2 });
  const a = first.samples.at(-1), b = second.samples.at(-1);
  assert(b.budget < a.budget, '降压未实际进入导演预算');
  return true;
}

/** 旧存档按现有 runs/best 迁移；换一条路线从第三档起步，返回原路线保留其累计趟数。 */
function historyCheck(rt, vehicle) {
  const { SA, context } = rt, previousStorage = context.localStorage;
  const old = JSON.parse(JSON.stringify(SA.S.d));
  old.route = { runs: 5, best: { r1: 6000 }, metal: 23, refugees: 2 };
  try {
    context.localStorage = { getItem: () => JSON.stringify(old), setItem() {}, removeItem() {} };
    SA.S.load();
    assert.strictEqual(SA.S.d.route.departures, 5);
    assert.strictEqual(SA.S.d.route.routeRuns.r1, 5);
    assert.strictEqual(SA.Route.best('r1'), 6000);
    assert.strictEqual(SA.S.d.route.metal, 23);
    assert.strictEqual(SA.S.d.route.refugees, 2);
    assert(SA.S.d.route.dda && SA.S.d.route.streaks);
    const oldPlan = SA.Route.prepare('r1', { vehicle, seed: 47 });
    const newPlan = SA.Route.prepare('r2', { vehicle, seed: 47 });
    assert.strictEqual(oldPlan.difficulty.runIndex, 6);
    assert.strictEqual(newPlan.difficulty.runIndex, 3, '新路线没有从第三档回落开局');
    assert.strictEqual(newPlan.encounters.length, 1);
    SA.S.d.vehicle = vehicle;
    SA.Route.start('r2', { seed: 47 });
    assert.strictEqual(SA.S.d.route.routeRuns.r2, 1);
    assert.strictEqual(SA.Route.prepare('r2', { vehicle, seed: 47 }).difficulty.runIndex, 4);
    assert.strictEqual(SA.Route.prepare('r1', { vehicle, seed: 47 }).difficulty.runIndex, 6);
  } finally {
    context.localStorage = previousStorage;
    SA.S.reset();
  }
  return true;
}

/** 正式开局接同一自动驾驶员，按相同 dt 推进；应与无画面模拟共享真实规则和种子。 */
function liveSeedCheck(rt, vehicle) {
  const { SA } = rt;
  SA.S.d.vehicle = vehicle;
  const options = { vehicle, runIndex: 1, seed: 793, maxTime: 8 };
  const expected = SA.Route.simulate({ route: 'r2', ...options });
  const B = SA.Route.start('r2', options);
  B.p.isAI = true;
  for (let i = 0; i < 240 && !B.done; i++) rt.api().step(1 / 30);
  assert.strictEqual(JSON.stringify(B.route.samples), JSON.stringify(expected.samples), '正式局与无画面同种子样本不一致');
  assert.strictEqual(JSON.stringify(B.route.events), JSON.stringify(expected.events), '正式局与无画面同种子事件不一致');
  SA.Route.recall();
  const calls = rt.randomCalls();
  rt.api().rnd(0, 1);
  assert.strictEqual(rt.randomCalls(), calls + 1, '离开正式出征后未恢复原随机源');
  SA.S.reset();
  return true;
}

/** 发布构建隐藏开发模拟入口后，正式出征仍能评分和选车。 */
function releaseCheck() {
  const { SA } = runtime({ release: true });
  assert.strictEqual(SA.Battle.simulate, undefined);
  assert.strictEqual(typeof SA.Battle.scoreDuel, 'function');
  const plan = SA.Route.prepare('r2', { vehicle: fixtures(SA).upgraded, runIndex: 3, seed: 31 });
  assert.strictEqual(plan.encounters.length, 1);
  assert(Number.isFinite(plan.encounters[0].measuredWinRate));
  return true;
}

/** 新的数值入口沿用原配置事务：坏预算或怪组必须拒绝，不能静默夹成别的玩法。 */
function configCheck(SA) {
  const original = SA.Route.getConfig(), frozen = JSON.stringify(original);
  const edits = [
    c => { c.difficulty.baseBudget = NaN; },
    c => { c.difficulty.baseBudget = -1; },
    c => { c.difficulty.segmentCount = 0; },
    c => { c.difficulty.segmentCount = 1.5; },
    c => { c.difficulty.driveWasteHeat = -1; },
    c => { c.routes.find(r => r.id === 'r2').firstDuelAt = Infinity; },
    c => { c.routes.find(r => r.id === 'r2').firstDuelAt = 23040; },
    c => { c.routes.find(r => r.id === 'r2').mobs[0].kind = 'missing'; },
    c => { c.routes.find(r => r.id === 'r2').mobs[0].n = 0; },
    c => { c.routes.find(r => r.id === 'r2').mobs[0].n = NaN; },
    c => { c.routes.find(r => r.id === 'r2').mobs[0].minRun = -1; },
    c => { c.routes.find(r => r.id === 'r2').mobs[0].price = 0; },
    c => { c.routes.find(r => r.id === 'r2').encounters[0].aim = NaN; },
    c => { c.routes.find(r => r.id === 'r2').encounters[0].aim = 1.1; }
  ];
  for (const edit of edits) {
    const invalid = JSON.parse(frozen);
    edit(invalid);
    assert(!SA.Route.configure(invalid).ok, '非法难度配置被接受');
    assert.strictEqual(JSON.stringify(SA.Route.getConfig()), frozen, '校验失败仍覆盖了配置');
  }
  return true;
}

/** 出征 AI 热控必须能真实降温并恢复射击，不能持续踩油门把自己锁在永久停火状态。 */
function heatControlCheck(rt, vehicle) {
  const { SA } = rt;
  const def = { id: 'heat-check', len: 4000, hills: [], mud: [], props: [], pickups: [], mobs: [],
    fuel: SA.Route.getConfig().fuel, end: { x: 3900 },
    difficulty: { ...SA.Route.getConfig().difficulty, runIndex: 5, powerScore: 2, seed: 73, dda: {} },
    encounters: [{ at: 100, guard: 750, leash: 1300, name: '热控陪练', style: 'balanced', aim: 0.3,
      vehicle: SA.S.starterVehicle() }] };
  const B = SA.Battle.startState({ mode: 'route', headless: true, vehicle, routeData: def });
  B.p.heat = B.p.heatMax * 0.83;
  B.p.vx = 120;
  const heat = B.p.heat, fire = B.p.events.fire;
  let stopped = false, cooled = false;
  for (let i = 0; i < 900 && !B.done; i++) {
    rt.api().step(1 / 30);
    stopped ||= !!B.p.hold && B.p.dir === 0;
    cooled ||= B.p.heat < heat * 0.8;
    if (stopped && cooled && B.p.events.fire > fire) break;
  }
  assert(stopped, '过热停火时自动驾驶仍持续加热');
  assert(cooled, '热控时未实际冷却');
  assert(B.p.events.fire > fire, '降温后未恢复开火');
  return true;
}

/** 独立成长案例：真实打赢两辆敌车并结算领奖，库存实例挂到合法装甲上；不替换原概率验收车。 */
function growthCheck(rt, cars) {
  const { SA } = rt;
  SA.S.reset(); SA.S.setPlayMode('route');
  const victories = [];
  for (const runIndex of [3, 4]) {
    const sim = SA.Route.simulate({ route: 'r2', vehicle: cars.upgraded, runIndex, seed: 1001, maxTime: 600 });
    assert(sim.result && sim.result.enemiesCleared === 1, '成长案例未真实击败敌车');
    // headless 的固定 simulation 身份不用于正式记账；为两次独立测试结算赋各自身份。
    const paid = SA.Route.settle({ ...sim.result, runId: 'growth-check-' + runIndex });
    victories.push({ runIndex, how: sim.reason, enemiesCleared: paid.enemiesCleared });
  }
  assert.strictEqual(SA.S.d.route.defeatedEnemies, 2);
  assert.strictEqual(SA.S.invCount('radiator'), 1);
  assert(SA.S.craftable('radiator'));
  // 原中期车没有侧挂宿主；两辆对照车均加同一块黄铜装甲，只比较获赠散热器的作用。
  const baseline = SA.V.clone(cars.middle);
  assert(SA.V.place(baseline, 'armor', 4, 8, 1).ok);
  const grown = SA.V.clone(baseline);
  grown.name = '两敌胜利后散热器成长车';
  assert(SA.V.canPlace(grown, 'radiator', 4, 8).ok);
  SA.S.installStock(grown, 'radiator', 4, 8, 1, 'side', null, []);
  assert.strictEqual(SA.S.invCount('radiator'), 0);
  assert.strictEqual(grown.side[4][8].id, 'radiator');
  assert(SA.V.stats(grown).canDeploy, JSON.stringify(SA.V.issues(grown)));
  assert(SA.V.stats(grown).dryCool > SA.V.stats(baseline).dryCool);
  const options = { runIndex: 5, seed: 1001, maxTime: 60 };
  const basePlan = SA.Route.prepare('r2', { ...options, vehicle: baseline });
  const grownPlan = SA.Route.prepare('r2', { ...options, vehicle: grown });
  assert.strictEqual(grownPlan.encounters.length, 2);
  // 用相同正式地图隔离散热器效果，避免选敌差异混入冷却比较。
  const baseSim = SA.Battle.route.simulate({ routeData: basePlan, vehicle: baseline, ...options });
  const grownSim = SA.Battle.route.simulate({ routeData: basePlan, vehicle: grown, ...options });
  finite(baseSim); finite(grownSim);
  const baseTemperature = baseSim.samples.at(-1).temperature, grownTemperature = grownSim.samples.at(-1).temperature;
  assert(grownTemperature < baseTemperature, '合法装上的散热器未在正式步进降低温度');
  SA.S.reset();
  return { victories, legalStockInstall: true, baseline: { how: baseSim.reason, temperature: baseTemperature },
    radiator: { how: grownSim.reason, temperature: grownTemperature }, power: grownPlan.difficulty.powerScore };
}

/** 默认命令严格验收；--probe 仅在调参时打印真实样本，不能作为通过报告。 */
function run({ probe = false, count = 20 } = {}) {
  const rt = runtime(), { SA } = rt, cars = fixtures(SA);
  const checks = { overheat: overheatCheck(rt, cars.starter), isolation: isolationCheck(rt, cars.upgraded) };
  if (!probe) {
    checks.planning = planningCheck(rt, cars);
    checks.adaptation = adaptationCheck(rt);
    checks.quantityOnly = quantityOnlyCheck(SA, cars.upgraded);
    checks.history = historyCheck(rt, cars.upgraded);
    checks.liveSeed = liveSeedCheck(rt, cars.starter);
    checks.release = releaseCheck();
    checks.config = configCheck(SA);
    checks.heatControl = heatControlCheck(rt, cars.middle);
    checks.growth = growthCheck(rt, cars);
  }
  const reports = [];
  for (const [runIndex, vehicle] of [[1, cars.starter], [2, cars.cooled], [3, cars.upgraded], [4, cars.upgraded], [5, cars.middle]]) {
    const report = batch(SA, vehicle, runIndex, count);
    reports.push(report);
    const { rows, ...metrics } = report;
    console.log(JSON.stringify({ ...metrics, minTime: Math.min(...rows.map(r => r.time)),
      maxTime: Math.max(...rows.map(r => r.time)), minPeaks: Math.min(...rows.map(r => r.peaks)),
      minRests: Math.min(...rows.map(r => r.rests)), ...(probe ? { rows } : {}) }));
  }
  if (!probe) {
    const [one, two, three, four, five] = reports;
    assert(reports.every(report => report.rows.every(row => row.how !== 'budget')), '验收存在时限内未完成的出征');
    assert.strictEqual(one.combatDeaths, 0, '首趟出现战斗致死');
    assert(one.overheated >= 16, '首趟过热结束不足80%');
    assert(one.rows.every(r => r.time >= 40 && r.time <= 80), '首趟时长不在40～80秒');
    assert(one.rows.every(r => r.pickups >= 2 && r.broken >= 1), '首趟未完成拾取/击碎教学');
    assert(two.combatDeaths <= 1, '第二趟战斗致死超过1次');
    assert(two.averageDistance >= one.averageDistance * 1.15, '小水罐未让第二趟距离提高15%');
    assert(three.rows.every(r => r.duels === 1) && four.rows.every(r => r.duels === 1), '第三、四趟存在未进入决斗的种子，不能当作已参战统计胜率');
    assert(three.duelWins >= 17 && three.duelWins <= 19, '第三趟首场决斗实际胜率不在85～95%');
    assert(four.duelWins >= 15 && four.duelWins <= 17, '第四趟决斗实际胜率不在75～85%');
    assert(five.arrived >= 10 && five.arrived <= 14, '第五趟实际到站率不在50～70%');
    assert(five.rows.every(r => r.peaks >= 2 && r.rests >= 2), '第五趟缺少至少两次真实高峰和低谷');
  }
  return { passed: !probe, checks, reports };
}

if (require.main === module) {
  const probe = process.argv.includes('--probe');
  const countArg = process.argv.find(arg => /^--count=\d+$/.test(arg));
  const count = countArg ? Number(countArg.split('=')[1]) : 20;
  if (!probe) assert.strictEqual(count, 20, '正式验收必须完整运行20个种子');
  const result = run({ probe, count });
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks }));
}
module.exports = { run, fixtures, batch, summarize, planningCheck, adaptationCheck,
  historyCheck, liveSeedCheck, quantityOnlyCheck, releaseCheck, configCheck, heatControlCheck, growthCheck };
