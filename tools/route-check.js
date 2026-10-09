/* 出征 R1 专项：正式物理步进、空敌炮弹、长坐标与持续遭遇；不接正式存档。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

/** 在正式 VM 规则中截获画面层接口和事件，以真实 step 检查后台生命周期。 */
function runtime() {
  const { SA, context } = evolve.loadGame();
  let api;
  let randomCalls = 0;
  context.Math = Object.create(Math);
  context.Math.random = () => { randomCalls++; return 0.37; };
  const events = [];
  SA.BattleView = { create(value) {
    api = value;
    return { gameSpeed: () => 1, tick() {}, emit(type, data) { events.push({ type, data }); }, teardown() {},
      start(opts) { return api.startState(opts); }, presentResult() { throw new Error('出征误入竞技场结算'); } };
  } };
  for (const file of ['js/battle.js', 'js/route-data.js', 'js/route.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  SA.go = () => {};
  SA.S.reset();
  let writes = 0;
  context.localStorage = { getItem() { return null; }, setItem() { writes++; }, removeItem() { writes++; } };
  return { SA, context, api: () => api, events, writes: () => writes, randomCalls: () => randomCalls };
}

/** 独立有效夹具：足量冷却和正式武器，不改关卡原车或玩家档。 */
function car(SA, weapon = 'mg') {
  const v = SA.V.create('出征规则检查车');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][4] = SA.newCell('boiler', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[7][4] = SA.newCell('helmet', 6);
  if (weapon) v.body[6][4] = SA.newCell(weapon, 6);
  assert(SA.V.stats(v).canDeploy, JSON.stringify(SA.V.issues(v)));
  return v;
}

/** 检查用路线允许短遭遇，但仍经正式开局、车辆初始化和伤害链。 */
function route(overrides = {}) {
  return { id: 'fixture', len: 7680, hills: [], mud: [], props: [], pickups: [], encounters: [], end: { x: 7400 }, ...overrides };
}

/** 将真实炮弹置于驾驶舱内，下一步仍由 advance、projectileDamage、damage 和 refresh 判负。 */
function destroyCockpit(rt, B, victim, attacker) {
  let cockpit;
  rt.SA.V.each(victim.v, (cell, r, c, layer) => { if (rt.SA.isCockpit(cell.id)) cockpit = { cell, r, c, layer }; });
  assert(cockpit);
  const [x, y] = rt.api().modCenter(victim, cockpit.layer, cockpit.r, cockpit.c);
  B.shots.push({ x, y, vx: 0, vy: 0, g: 0, delay: 0, from: attacker, to: victim,
    side: cockpit.layer === 'side', weapon: {}, weaponCell: { id: 'cannon' }, dmg: 1e6 });
  rt.api().step(1 / 60);
  assert(victim.dead, '驾驶舱实伤未触发死亡');
  assert(attacker.dealt > 0, '未记录真实伤害');
}

/** 输出对象不能包含 NaN/Infinity，包括长坐标镜头与模拟结果。 */
function finite(value) {
  if (typeof value === 'number') assert(Number.isFinite(value), '出现非有限数值');
  else if (value && typeof value === 'object') for (const part of Object.values(value)) finite(part);
}


/** 资源边界与配置隔离走真实步进；工程夹具只验证机制，不作为普通车平衡验收。 */
function resourceChecks(rt, player) {
  const { SA } = rt;
  const start = def => SA.Battle.startState({ mode: 'route', vehicle: player, routeData: def || route() });
  const step = seconds => { for (let i = 0; i < Math.round(seconds * 60); i++) rt.api().step(1 / 60); };
  let B = start();
  const idleBefore = B.route.coal;
  step(2);
  const idleUsed = idleBefore - B.route.coal;
  assert(Math.abs(idleUsed - 2 * 0.0015) < 1e-8, '怠速错误按满功率烧煤');
  B = start(); B.keys.right = true;
  step(2);
  const driveUsed = B.route.coalBurned;
  assert(driveUsed > idleUsed, '真实驾驶没有增加煤耗');
  B = start(); B.keys.fire = true; B.aimScreen = [1000, 340];
  step(2);
  assert(B.p.events.fire > 0 && B.route.coalBurned > idleUsed, '真实开火没有增加煤耗');

  B = start(); B.route.coal = 0;
  step(1 / 60);
  assert(B.done && B.result.how === 'stranded' && B.result.cause === 'coal' && B.t === 0, '煤归零没有立即结束');
  step(1); assert.strictEqual(B.route.events.filter(e => e.type === 'route-end').length, 1);
  B = start(); B.p.heat = B.p.heatMax;
  step(1 / 60);
  assert(B.done && B.result.cause === 'overheat' && B.t === 0, '120°C 没有立即结束');
  B = start(); B.p.water = 0; B.p.heat = 0;
  step(1);
  assert(!B.done && B.p.water === 0, '无水被单独判负');
  B = start();
  B.p.x += 7400 - rt.api().frontEdge(B.p) - 0.001;
  B.p.vx = 20; B.keys.right = true; B.route.coal = 1e-10;
  step(1 / 60);
  assert(B.done && B.result.cause === 'coal' && B.result.dist >= 7400, '同帧到站优先于缺煤');

  B = start(route({ pickups: [{ kind: 'coal', x: 200, amount: 0.15 }] }));
  B.route.coal *= 0.5; B.p.vx = 300; B.keys.right = true;
  step(1 / 60);
  assert(!B.ter.pickups[0].taken && !B.route.coalPicked, '高速仍自动拾煤');
  B = start(route({ pickups: [{ kind: 'coal', x: 200, amount: 0.15 }] }));
  B.route.coal *= 0.5;
  step(1 / 60);
  assert(B.ter.pickups[0].taken && B.route.coalPicked > 0, '慢行不能补煤');
  assert(B.route.events.some(e => e.type === 'pickup' && e.kind === 'coal' && e.amount > 0));
  B = start(route({ pickups: [{ kind: 'water', x: 200, amount: 5 }] }));
  B.p.water = 0;
  step(1 / 60);
  assert(B.p.water === 5 && B.route.waterPicked === 5, '水塔记录替代实际补水');
  B = start(route({ pickups: ['supply', 'refugee', 'relic'].map(kind => ({ kind, x: 200 })) }));
  step(1 / 60);
  assert.strictEqual(B.route.events.filter(e => e.type === 'node').length, 3);
  assert.strictEqual(B.route.events.filter(e => e.type === 'pickup').length, 0, '计划货物节点虚构实际领取');
  assert(B.ter.pickups.every(p => !p.taken));

  const config = SA.Route.getConfig();
  assert(SA.Route.validateConfig(config).ok);
  const original = JSON.stringify(config);
  for (const edit of [c => { c.fuel.kgPerKj = 0; }, c => { c.routes[0].end.x = 99999; },
    c => { c.routes[0].encounters[0].car = '99:99'; }, c => { c.routes[0].encounters[1].at = 1; },
    c => { c.routes[0].pickups[0].amount = -1; }, c => { c.routes[0].props[0].hp = NaN; },
    c => { c.routes[0].encounters[0].vehicle = player; }]) {
    const invalid = JSON.parse(original); edit(invalid);
    assert(!SA.Route.configure(invalid).ok);
    assert.strictEqual(JSON.stringify(SA.Route.getConfig()), original, '失败配置仍写入页面');
  }
  B = SA.Route.start('r1');
  const active = JSON.stringify(B.opts.routeData);
  const edited = JSON.parse(original); edited.routes[0].name = '后续配置'; edited.routes[0].encounters[0].at = 500;
  assert(SA.Route.configure(edited).ok);
  assert.strictEqual(JSON.stringify(B.opts.routeData), active, '配置污染正在远征的数据');
  assert.strictEqual(SA.Route.list()[0].name, '后续配置');
  assert(SA.Route.configure(config).ok);
  B.p.x += 600 - rt.api().frontEdge(B.p) + 1;
  step(1 / 60);
  assert(B.e && B.route.encounter.i === 0, '第一敌未在600px实际出场');
  assert(rt.api().frontEdge(B.e) <= 1120 && rt.api().frontEdge(B.e) >= 600, '第一敌仍在旧远处');
  const predicted = SA.Route.plan({ route: 'r1', vehicle: player });
  assert.strictEqual(predicted.totalEnemies, 3);
  assert.strictEqual(predicted.totals.conditionalSupply, 3);
  assert(predicted.coalMax > 0 && predicted.speed > 0 && predicted.heatLimit === 120);
  assert(predicted.nodes.every(n => Number.isFinite(n.eta) && n.eta === n.x / predicted.speed));

  // 普通起步车只能报真实结果，不要求到站或给它工程用的额外煤量。
  const starter = SA.S.starterVehicle();
  const ordinary = SA.Route.simulate({ route: 'r1', vehicle: starter, seed: 20261007, maxTime: 600 });
  finite(ordinary);
  assert(ordinary.events.some(e => e.type === 'encounter-start'), '普通起步车没有接触提前的首敌');
  assert(ordinary.samples.length > 1 && ordinary.events.every(e => e.t <= ordinary.time));
  if (ordinary.completed) assert(ordinary.result.cause && ordinary.result.resources);
  const firstEnemy = ordinary.events.find(e => e.type === 'encounter-start');
  return { idleUsed, driveUsed, firstEnemyAt: firstEnemy.t, ordinary: { reason: ordinary.reason,
    cause: ordinary.result?.cause || null, time: ordinary.time, dist: ordinary.dist,
    resources: ordinary.result?.resources || ordinary.samples[ordinary.samples.length - 1] } };
}

/** 基础速度只改一次，标准/轻/重双足仍走原类系数和正式动力预算；以实帧稳定巡航核对预计速度。 */
function speedChecks(rt) {
  const { SA } = rt, results = [];
  for (const [id, look, base] of [['track', null, 96], ['quad', null, 124], ['biped', null, 180], ['biped', 'stilt', 180], ['biped', 'skirt', 180]]) {
    const vehicle = SA.V.create('速度检查' + id + (look || ''));
    const r = SA.V.chassisRow(id);
    vehicle.body[r][6] = SA.newCell(id, 6);
    if (look) { vehicle.body[r][6].look = look; SA.fixCell(vehicle.body[r][6]); }
    vehicle.body[r - 2][6] = SA.newCell('boiler_s', 6);
    vehicle.body[r - 1][7] = SA.newCell('helmet', 6);
    assert(SA.V.stats(vehicle).canDeploy, JSON.stringify(SA.V.issues(vehicle)));
    assert.strictEqual(SA.MODULES[id].speed, base);
    const now = SA.V.stats(vehicle);
    SA.MODULES[id].speed = base / 2;
    vm.runInContext('modCache.clear()', rt.context); // 对照旧数据必须清材料缓存，不能拿旧缓存假冒两套配置。
    const old = SA.V.stats(vehicle);
    SA.MODULES[id].speed = base;
    vm.runInContext('modCache.clear()', rt.context);
    assert(Math.abs(now.speed / old.speed - 2) < 1e-8, '腿型/改装叠乘速度');
    const plan = SA.Route.plan({ route: 'r1', vehicle });
    const B = SA.Battle.startState({ mode: 'route', vehicle, routeData: route() });
    B.keys.right = true; B.p.vx = plan.speed;
    for (let i = 0; i < 60; i++) rt.api().step(1 / 60);
    assert(!B.done && Math.abs(B.p.vx - plan.speed) < 0.01, `预计与实速不一致：${id}/${look} ${plan.speed}/${B.p.vx}`);
    assert.strictEqual(B.speed, 1, '基础速度变更改变了游戏时钟');
    results.push({ id, look, base, paper: now.speed, actual: B.p.vx });
  }
  return results;
}

function run() {
  const rt = runtime(), { SA } = rt, player = car(SA);
  SA.S.d.vehicle = player;
  const saved = JSON.stringify(SA.S.d), originalRandom = rt.context.Math?.random;
  const def = SA.Route.list()[0];
  assert.strictEqual(def.len, 7680);
  def.len = 1;
  assert.strictEqual(SA.Route.list()[0].len, 7680, '路线列表泄漏可变引用');
  SA.Route.start('r1');
  let B = rt.api().getState();
  assert.strictEqual(B.e, null);
  assert.strictEqual(B.ter.len, 7680);
  assert.strictEqual(B.ter.ground.length, 7681);
  assert.strictEqual(rt.api().groundAt(3000), 604);
  assert.strictEqual(rt.api().groundAt(5200), 628);
  assert.strictEqual(rt.api().groundAt(7680), 648);
  assert.strictEqual(B.ter.props, B.ter.crates);
  assert(B.ter.props.some(p => p.x0 > 6000));

  // 无敌车时自由瞄准、按住与松手开火，正式弹道能打碎旧竞技场范围外的物件。
  const open = route({ props: [{ kind: 'barricade', x: 3100, w: 64, h: 150, hp: 1 }] });
  B = SA.Battle.startState({ mode: 'route', routeData: open, vehicle: player });
  B.p.x = 2700;
  B.keys.right = true; B.keys.fire = true; B.aimScreen = [900, 350];
  for (let i = 0; i < 60; i++) rt.api().step(1 / 60);
  assert(B.p.events.fire > 0 && B.p.x > 2700, `空敌不能开火或行驶：${JSON.stringify({ fire: B.p.events.fire, x: B.p.x, power: B.p.power, weapons: B.p.weapons.map(w => w.cell.id) })}`);
  B.keys.fire = false;
  rt.api().step(1 / 60);
  finite(B.cam); assert(B.cam.x > 1280);
  const prop = B.ter.props[0];
  B.shots.push({ x: 3100, y: prop.y0 + 10, vx: 0, vy: 0, g: 0, delay: 0, from: B.p, to: null,
    weapon: {}, weaponCell: { id: 'cannon' }, dmg: 10 });
  rt.api().step(1 / 60);
  assert(prop.dead, '自由弹未命中长坐标路障');
  assert(rt.events.some(e => e.type === 'prop' && e.data.state === 'break'));
  B.t = SA.K.BATTLE_TIME + 10;
  rt.api().step(1 / 60);
  assert(!B.done && !B.ending && !B.timeout, '路线误走竞技场超时');

  // 至少两场连续真实驾驶舱受击；保留玩家副本与资源，不重置到满状态。
  const weak = car(SA, null);
  const encounters = [0, 1, 2].map(i => ({ at: 100 + i * 1000, guard: 650 + i * 1000,
    leash: 900 + i * 1000, name: '接力敌车' + i, style: 'turtle', vehicle: weak }));
  B = SA.Battle.startState({ mode: 'route', vehicle: player, routeData: route({ encounters }) });
  const originalPlayer = B.p, water = B.p.water;
  let previousEnemy;
  B.p.heat = 5;
  for (let i = 0; i < 2; i++) {
    B.p.x = 100 + i * 1000;
    rt.api().step(1 / 60);
    assert(B.e && B.route.state === 'fight');
    const enemy = B.e;
    if (i === 1) {
      B.t = SA.K.BATTLE_TIME + 10;
      rt.api().step(1 / 60);
      assert(!B.done && !B.timeout && !B.ending, '遭遇误走竞技场超时');
    }
    enemy.x += 10000; enemy.vx = 100;
    rt.api().step(1 / 60);
    assert(enemy.x < 10000 && enemy.vx === 0, '敌车未受拴绳限位');
    if (previousEnemy) {
      let cabin;
      SA.V.each(enemy.v, (cell, r, c, layer) => { if (SA.isCockpit(cell.id)) cabin = { cell, r, c, layer }; });
      const [x, y] = rt.api().modCenter(enemy, cabin.layer, cabin.r, cabin.c), hp = cabin.cell.hp;
      // 上一场发射、目标引用已固定的旧弹，即使世界位置正好穿过新敌，也不能偷偷更换受击对象。
      B.shots.push({ x, y, vx: 0, vy: 0, g: 0, delay: 0, from: B.p, to: previousEnemy,
        side: false, weapon: {}, weaponCell: { id: 'cannon' }, dmg: 1e6 });
      rt.api().step(1 / 60);
      assert.strictEqual(cabin.cell.hp, hp, '上一场炮弹错误绑定并伤害新敌车');
    }
    B.p.tether = { target: enemy, time: 0 };
    destroyCockpit(rt, B, enemy, B.p);
    assert.strictEqual(B.e, null);
    assert.strictEqual(B.route.state, 'drive');
    assert.strictEqual(B.p, originalPlayer);
    assert.strictEqual(B.p.tether, null);
    assert(B.p.water <= water);
    assert(!B.done && !B.ending);
    previousEnemy = enemy;
  }
  assert.strictEqual(B.route.cleared.length, 2);
  assert.strictEqual(B.route.wrecks.length, 2);
  assert.strictEqual(B.ter.pickups.length, 2);
  B.p.x = 2200; rt.api().step(1 / 60);
  B.surrender = 'asked'; B.surrenderWhy = '定向投降生命周期夹具'; B.surT = 100; B.frozen = true;
  assert(SA.Battle.acceptSurrender()); rt.api().step(1 / 60);
  assert.strictEqual(B.e, null); assert.strictEqual(B.surrender, null); assert(!B.frozen);
  assert.strictEqual(B.surT, 0, '上一场投降计时污染后续遭遇');
  assert(B.route.cleared[2].surrendered);
  B.p.x = 7200; rt.api().step(1 / 60);
  assert.strictEqual(SA.Route.result().how, 'depot');
  assert(!SA.Route.recall()); rt.api().step(1 / 60);
  assert.strictEqual(rt.events.filter(e => e.type === 'route-end').length, 1);

  B = SA.Battle.startState({ mode: 'route', vehicle: player, routeData: route() });
  assert(SA.Route.recall()); assert(!SA.Route.recall());
  assert.strictEqual(SA.Route.result().how, 'recall');
  B = SA.Battle.startState({ mode: 'route', vehicle: player, routeData: route({ encounters }) });
  B.p.x = 100; rt.api().step(1 / 60);
  destroyCockpit(rt, B, B.p, B.e);
  assert.strictEqual(SA.Route.result().how, 'wrecked');
  assert(!SA.Route.recall()); rt.api().step(1 / 60);
  assert.strictEqual(rt.events.filter(e => e.type === 'route-end').length, 3);
  B = SA.Battle.startState({ mode: 'route', vehicle: player, routeData: route() });
  B.p.heat = B.p.heatMax + 10000;
  rt.api().step(1 / 60);
  assert.strictEqual(SA.Route.result().how, 'wrecked', '无敌时过热未正常结束');
  assert.strictEqual(JSON.stringify(SA.S.d), saved, '出征修改了正式存档');
  assert.strictEqual(rt.writes(), 0, '出征写入 localStorage');
  // 出征本身不写档（上面两条）；回院子的清点黑板调用 SA.Route.settle 才入档，下面单独检查
  assert.strictEqual(typeof SA.Route.settle, 'function');

  const keep = B;
  const sample = { route: route(), vehicle: player, seed: 42, maxTime: 4 };
  const calls = rt.randomCalls();
  const first = SA.Route.simulate(sample), second = SA.Route.simulate(sample);
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second), '固定种子不可复现');
  assert(!first.completed && first.reason === 'budget' && first.result === null, '预算耗尽伪造到站');
  assert.strictEqual(rt.api().getState(), keep, '模拟覆盖外部当前局');
  assert.strictEqual(rt.context.Math?.random, originalRandom, '模拟改写外部随机源');
  assert.strictEqual(rt.randomCalls(), calls, '固定种子模拟消耗了外部随机源');
  rt.api().rnd(0, 1);
  assert.strictEqual(rt.randomCalls(), calls + 1, '模拟结束未恢复引擎原随机源');
  finite(first);
  const arrived = SA.Route.simulate({ route: route({ len: 1500, end: { x: 800 } }), vehicle: player, seed: 42, maxTime: 120 });
  assert(arrived.completed && arrived.result.how === 'depot', '自动行驶未通过真实步进到站');
  const outcomes = {};
  let firstFull;
  for (let seed = 1; seed <= 20; seed++) {
    const value = SA.Route.simulate({ route: 'r1', vehicle: player, seed, maxTime: 600 });
    finite(value);
    assert(value.completed && value.result.how === 'depot', '强检查车未完成真实 r1');
    assert.strictEqual(value.cleared.length, 3, '到站前漏过遭遇');
    assert.strictEqual(new Set(value.cleared.map(enc => enc.i)).size, 3, '遭遇重复计算');
    assert(value.dist >= SA.ROUTES.r1.end.x, '未到终点却判到站');
    if (seed === 1) firstFull = value;
    outcomes[value.reason] = (outcomes[value.reason] || 0) + 1;
  }
  assert.strictEqual(JSON.stringify(SA.Route.simulate({ route: 'r1', vehicle: player, seed: 1, maxTime: 600 })),
    JSON.stringify(firstFull), '含真实遭遇的固定种子不能复现');
  assert.strictEqual(rt.writes(), 0); assert.strictEqual(JSON.stringify(SA.S.d), saved);
  const resources = resourceChecks(rt, player), speeds = speedChecks(rt);
  const duel = SA.Battle.simulate({ p: player, e: weak, terrain: 'flat', seed: 42 });
  assert(['p', 'e', 'draw'].includes(duel.winner)); finite(duel);
  // 结算（docs/expedition-fun.md §5）：金属 × 单价 + 到站时终点物资；被打爆只留一半金属；记最远距离；同一趟只结一次
  const eco = SA.Route.getConfig().economy, money0 = SA.S.d.money;
  const paid = SA.Route.settle({ mode: 'route', route: 'r1', runId: 'check-1', how: 'depot', dist: 7400, metal: 7 });
  assert.strictEqual(paid.money, 7 * eco.metal + SA.ROUTES.r1.end.bonus * eco.supply);
  assert.strictEqual(SA.S.d.money, money0 + paid.money);
  SA.Route.settle({ mode: 'route', route: 'r1', runId: 'check-1', how: 'depot', dist: 7400, metal: 7 });
  assert.strictEqual(SA.S.d.money, money0 + paid.money, '同一趟结算了两次');
  const wrecked = SA.Route.settle({ mode: 'route', route: 'r1', runId: 'check-2', how: 'wrecked', dist: 3000, metal: 7 });
  assert.strictEqual(wrecked.metalKept, 3); assert.strictEqual(wrecked.bonus, 0);
  assert.strictEqual(SA.Route.best('r1'), 7400, '最远距离被较短的一趟覆盖');
  return { longTerrain: true, emptyEnemyFire: true, encounters: 3, exits: 4, seeds: 20, outcomes, resources, speeds,
    simulationBudget: true, noSaveWrites: true, arenaWinner: duel.winner };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
