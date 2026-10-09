/* 开图前段专项：共享方案、真实首次遭遇/随机流等价、加载边界整步冻结和晚消息安全。 */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { runtime } = require('./route-check');
const { fixtures } = require('./route-difficulty-check');
const copy = value => JSON.parse(JSON.stringify(value));

/** 活动战斗有相互引用；保存完整对象图及共享引用标记，只归一化每次开局生成的 runId。 */
function snapshot(B) {
  const seen = new WeakSet();
  const text = JSON.stringify(B, (key, value) => {
    if (key === 'runId') return '检查同趟';
    if (value && typeof value === 'object') { if (seen.has(value)) return '[共享引用]'; seen.add(value); }
    return value;
  });
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** 固定控制走正式自动驾驶和物理，统计 imul 调用以覆盖真实播种随机流的推进次序。 */
function equality(rt, full, opening, vehicle, { delay = 30, gate = false } = {}) {
  const { SA, context } = rt;
  let randomSteps = 0;
  context.Math.imul = (a, b) => { randomSteps++; return Math.imul(a, b); };
  const start = def => {
    randomSteps = 0;
    const B = SA.Battle.startState({ mode: 'route', routeData: def, vehicle });
    B.p.isAI = true;
    return B;
  };
  const reference = start(full), checkpoints = new Map();
  let firstTick = 0;
  for (let tick = 0; tick <= 3600; tick++) {
    if (!firstTick && reference.route.events.some(event => event.type === 'encounter-start')) firstTick = tick;
    if (tick % 120 === 0 || (firstTick && tick >= firstTick && tick <= firstTick + 30))
      checkpoints.set(tick, { state: snapshot(reference), randomSteps });
    if (firstTick && tick >= firstTick + 30) break;
    assert(!reference.done, '参考车未到首次遭遇便结束');
    rt.api().step(1 / 30);
  }
  assert(firstTick > 0 || full.encounters[0].at === 0, '没有验证到真实首次遭遇');
  const staged = start(opening);
  let attached = false, frozenFrames = 0;
  for (let tick = 0; tick <= firstTick + 30; tick++) {
    const atGate = rt.api().frontEdge(staged.p) >= opening.encounters[0].at - 600;
    if (!attached && (gate ? atGate : tick === delay)) {
      if (gate) {
        const before = snapshot(staged), beforeRandom = randomSteps;
        assert.strictEqual(SA.Battle.vent(), false, '泄压操作绕过加载暂停');
        for (let wait = 0; wait < 120; wait++) rt.api().step(1 / 30);
        assert.strictEqual(snapshot(staged), before, '等待时仍推进战斗/资源/采样');
        assert.strictEqual(randomSteps, beforeRandom, '等待时仍推进随机流');
        assert(!staged.e && !staged.done, '等待时生成了未知敌车或错误结算');
        frozenFrames = 120;
      }
      assert(SA.Battle.route.attachPlan(staged.route.runId, full)); attached = true;
    }
    if (attached && checkpoints.has(tick)) {
      assert.strictEqual(snapshot(staged), checkpoints.get(tick).state, '完整状态不一致，模拟步 ' + tick);
      assert.strictEqual(randomSteps, checkpoints.get(tick).randomSteps, '随机推进不一致，模拟步 ' + tick);
    }
    if (tick < firstTick + 30) rt.api().step(1 / 30);
  }
  assert(attached && staged.route.events.some(event => event.type === 'encounter-start'));
  return { firstEncounterTick: firstTick, comparedStates: checkpoints.size, frozenFrames };
}

/** 手动延迟消息的 Worker 工程夹具，执行正式主线程接线，不提前交付模拟结果。 */
class DelayedWorker {
  constructor() { DelayedWorker.latest = this; }
  postMessage(input) { this.input = copy(input); }
  terminate() { this.terminated = true; }
  deliver(plan) { this.onmessage({ data: { ok: true, plan: copy(plan) } }); }
  fail() { this.onmessage({ data: { ok: false, error: '模拟后台失败' } }); }
}

async function run() {
  const rt = runtime(), { SA, context } = rt;
  SA.go = name => { SA.current = name; };
  const cars = fixtures(SA), plans = [];
  for (const runIndex of [3, 4, 5]) {
    const vehicle = runIndex === 5 ? cars.middle : cars.upgraded;
    const options = { vehicle, runIndex, seed: 1007 };
    const full = SA.Route.prepare('r2', options), opening = SA.Route.prepareOpening('r2', options);
    const withoutEncounters = plan => { const value = copy(plan); delete value.encounters; return value; };
    assert.deepStrictEqual(withoutEncounters(opening), withoutEncounters(full), '共享前段字段与完整方案不一致');
    assert.deepStrictEqual(opening.encounters.map(({ pending, ...slot }) => slot), full.encounters.map(enc =>
      ({ targetWinRate: enc.targetWinRate, at: enc.at, guard: enc.guard, leash: enc.leash })));
    assert(opening.encounters.every(enc => enc.pending && !enc.vehicle && !enc.name && !enc.car));
    plans.push({ runIndex, ...equality(rt, full, opening, vehicle) });
    if (runIndex === 5) plans.push({ delayedGate: true, ...equality(rt, full, opening, vehicle, { gate: true }) });
  }
  // 合法 at=0 路线必须在 t=0 完成原本开局的生成/事件/采样，不能多推进一帧。
  const short = { ...copy(SA.ROUTES.r2), firstDuelAt: 0 };
  const shortOptions = { vehicle: cars.upgraded, runIndex: 3, seed: 1007 };
  const shortFull = SA.Route.prepare(short, shortOptions), shortOpening = SA.Route.prepareOpening(short, shortOptions);
  const baseline = SA.Battle.startState({ mode: 'route', routeData: shortFull, vehicle: cars.upgraded });
  const baselineState = snapshot(baseline);
  const shortBattle = SA.Battle.startState({ mode: 'route', routeData: shortOpening, vehicle: cars.upgraded });
  const waiting = snapshot(shortBattle);
  for (let i = 0; i < 10; i++) rt.api().step(1 / 30);
  assert.strictEqual(snapshot(shortBattle), waiting); assert(!shortBattle.e);
  assert(SA.Battle.route.attachPlan(shortBattle.route.runId, shortFull));
  assert.strictEqual(snapshot(shortBattle), baselineState, 'at=0 开局状态不同');

  context.Worker = DelayedWorker;
  context.document.currentScript = { src: 'http://localhost:5173/js/route.js' };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/route.js'), 'utf8'), context);
  SA.S.d.vehicle = cars.upgraded;
  SA.S.d.route = { firstRoute: 'r2', routeRuns: { r2: 2 }, dda: {} };
  const notifications = []; SA.UI.toast = message => notifications.push(message);
  let seed = 710;
  const launch = async () => {
    const options = { runIndex: 3, seed: ++seed, vehicle: copy(SA.S.d.vehicle) };
    const full = SA.Route.prepare('r2', options), before = rt.writes(), departures = SA.S.d.route.departures || 0;
    SA.current = 'arena';
    const B = await SA.Route.startWhenReady('r2', { ...options, isCurrent: () => SA.current === 'arena' });
    assert(B.opts.routeData.encounters.some(enc => enc.pending), '没有先显示地图');
    assert.strictEqual(rt.writes(), before + 1); assert.strictEqual(SA.S.d.route.departures, departures + 1);
    return { B, full, worker: DelayedWorker.latest, writes: rt.writes() };
  };
  let item = await launch();
  // 已开图之后车间档和计数改变不会废弃已冻结的本趟；只按活动 run 身份注入。
  const name = SA.S.d.vehicle.name; SA.S.d.vehicle.name += '未来用车';
  item.worker.deliver(item.full); await Promise.resolve();
  assert.deepStrictEqual(copy(item.B.opts.routeData.encounters), copy(item.full.encounters));
  assert.strictEqual(rt.writes(), item.writes); SA.S.d.vehicle.name = name;
  item = await launch(); item.worker.fail(); await Promise.resolve();
  assert.deepStrictEqual(copy(item.B.opts.routeData.encounters), copy(item.full.encounters), '失败回退使用了下一趟记录');
  assert.strictEqual(rt.writes(), item.writes);
  item = await launch(); SA.current = 'home'; item.worker.deliver(item.full); await Promise.resolve();
  assert(item.B.opts.routeData.encounters.some(enc => enc.pending)); assert.strictEqual(rt.writes(), item.writes);
  item = await launch(); SA.Battle.route.recall(); item.worker.deliver(item.full); await Promise.resolve();
  assert(item.B.done && item.B.result.how === 'recall'); assert.strictEqual(rt.writes(), item.writes);
  const old = await launch(), next = await launch(); old.worker.deliver(old.full); await Promise.resolve();
  assert(next.B.opts.routeData.encounters.some(enc => enc.pending));
  next.worker.deliver(next.full); await Promise.resolve();
  assert(next.B.opts.routeData.encounters.every(enc => !enc.pending)); assert.strictEqual(rt.writes(), next.writes);
  item = await launch(); const damage = SA.MODULES.mg_s.dmg; SA.MODULES.mg_s.dmg++;
  item.worker.fail(); await Promise.resolve();
  assert(item.B.done && item.B.result.how === 'recall'); assert(notifications.includes('规则已更新，请重新出发'));
  assert.strictEqual(rt.writes(), item.writes); SA.MODULES.mg_s.dmg = damage;
  console.log(JSON.stringify({ sharedOpening: true, plans, zeroAtEquivalent: true, onceOnlyWrites: true,
    originalRunFallback: true, exitedAndRecalledAndNewRunIgnoreLate: true, updatedRulesRecall: true }));
}
if (require.main === module) run().catch(error => { console.error(error.message); console.error(error.stack); process.exitCode = 1; });
module.exports = { run };
