/* 鱼叉专项：真实命中、质量守恒牵引和单驾驶员混合武装 AI 回归。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

/** 留有充足动力的混合武装，驾驶舱只有一件，确保不能依赖副驾驶发射。 */
function vehicle(SA) {
  const v = SA.V.create('鱼叉检查');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  for (const c of [2, 4, 10]) v.body[8][c] = SA.newCell('boiler', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[7][2] = SA.newCell('helmet', 6);
  v.body[7][8] = SA.newCell('armor', 6);
  v.body[6][8] = SA.newCell('cannon_s', 6);
  v.body[7][12] = SA.newCell('harpoon', 6);
  assert(SA.V.stats(v).canDeploy, '鱼叉夹具不能出战');
  return v;
}

/** 用正式弹道命中建立绳索，随后冻结敌方操作以量测纯牵引。 */
function scene(SA) {
  SA.S.d.vehicle = vehicle(SA);
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(SA), terrain: 'flat', boss: true });
  B.headless = true; B.e.speed = 0; B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  B.e.x -= 180; B.e.pivX -= 180;
  const w = B.p.weapons.find(x => x.cell.id === 'harpoon'), ew = B.e.weapons.find(x => x.cell.id === 'harpoon');
  B.p.sel = 'harpoon'; B.p.lastSel = 'harpoon'; B.p.prism = true;
  w.m = { ...w.m, wild: 0 };
  B.aim = SA.Battle.debug.cellCenter('e', ew.r, ew.c); B.keys.fire = true;
  for (let i = 0; i < 180 && !B.p.tether; i++) { B.p.focus = 1; SA.Battle.debug.step(1 / 60); }
  assert(B.p.tether, '真实鱼叉未连接');
  B.keys.fire = false; B.p.vx = B.e.vx = 0;
  return B;
}

/** 双朝向、同重和异重的真命中后牵引，含无动力目标、断绳和自主驾驶抵抗。 */
function pull(SA) {
  const cases = [];
  for (const mirror of [false, true]) for (const ratio of [1, 4]) {
    const B = scene(SA), hook = mirror ? B.e : B.p, target = mirror ? B.p : B.e;
    if (mirror) {
      const gun = hook.weapons.find(w => w.cell.id === 'harpoon');
      const victim = target.weapons.find(w => w.cell.id === 'harpoon');
      hook.tether = { ...B.p.tether, target, cell: gun.cell, r: victim.r, c: victim.c };
      B.p.tether = null;
    }
    hook.speed = target.speed = 0;
    target.supply = target.power = target.driveAvailableKw = 0;
    target.dryKg *= ratio; target.mass = (target.dryKg + target.water) / 1000;
    const before = [hook.x, target.x], dir = Math.sign(target.x - hook.x);
    SA.Battle.debug.step(0.5);
    assert(dir * (target.x - before[1]) < 0, '鱼叉把目标向外推或未能拖动');
    const closure = Math.abs(before[1] - before[0]) - Math.abs(target.x - hook.x);
    assert(closure > 0, '连接后距离没有缩短');
    assert(Math.abs(hook.mass * hook.tetherPullVx + target.mass * target.tetherPullVx) < 0.1, '收绳速度没有按质量守恒分摊');
    if (ratio > 1) assert(Math.abs(target.tetherPullVx) < Math.abs(hook.tetherPullVx), '重车速度分摊比轻车大');
    cases.push({ mirror, ratio, targetTravel: Math.abs(target.x - before[1]), closure });
  }
  // 每种无效条件均推进真实更新，不能只验证画面读取时隐藏绳索。
  for (const invalid of ['timeout', 'distance', 'weapon', 'target', 'death']) {
    const B = scene(SA), t = B.p.tether;
    if (invalid === 'timeout') t.time = 0;
    if (invalid === 'distance') B.e.x += 2000;
    if (invalid === 'weapon') t.cell.hp = 0;
    if (invalid === 'target') B.e.v[t.layer][t.r][t.c].hp = 0;
    if (invalid === 'death') B.e.dead = true;
    SA.Battle.debug.step(1 / 60);
    assert.strictEqual(B.p.tether, null, `${invalid} 没有断绳`);
    assert.strictEqual(B.p.tetherPullVx, 0, `${invalid} 断绳后仍施加收绳速度`);
  }
  // 同样的外向自主驾驶，有绳时速度必须被抵消；不要求牵引压过所有发动机。
  const speeds = [];
  for (const connected of [false, true]) {
    const B = scene(SA); if (!connected) B.p.tether = null;
    B.p.spool = 0; B.p.spoolDir = -1; B.p.vx = -30; B.keys.left = true;
    SA.Battle.debug.step(0.5); speeds.push(B.p.vx);
  }
  assert(speeds[1] > speeds[0], '外向驾驶没有受到收绳抵抗');
  return { cases, invalidations: 5, resistingSpeeds: speeds };
}

/** 固定种子完整对局同时验收控制武器和主炮，重复运行必须逐字段一致。 */
function ai(SA, api) {
  const cases = [];
  for (const style of ['sniper', 'rush', 'wander']) {
    const opts = { p: vehicle(SA), e: vehicle(SA), pStyle: style, eStyle: 'turtle', seed: style === 'wander' ? 20261005 : 20261006 };
    const first = SA.Battle.simulate(opts), second = SA.Battle.simulate(opts);
    assert.strictEqual(JSON.stringify(first), JSON.stringify(second), `${style} 同种子不能复现`);
    assert(first.effectStats.p.harpoon.fire > 0 && first.effectStats.p.harpoon.tether > 0, `${style} 没有主动连接鱼叉`);
    assert(first.effectStats.p.cannon_s.fire > 0, `${style} 鱼叉占住主控位导致主炮不开火`);
    cases.push({ style, fire: first.effectStats.p.harpoon.fire, tether: first.effectStats.p.harpoon.tether, cannon: first.effectStats.p.cannon_s.fire });
  }
  // 已连接立即切回主炮，装填完也不能重发；普通人操在未按扳机时保持静默。
  let B = scene(SA);
  B.p.isAI = true; B.p.style = 'sniper'; B.p.timers[B.p.weapons.find(w => w.cell.id === 'harpoon').key] = 0;
  const hooked = B.p.effects.harpoon.fire;
  for (let i = 0; i < 120 && !B.p.effects.cannon_s.fire; i++) SA.Battle.debug.step(1 / 60);
  assert(B.p.effects.cannon_s.fire > 0, '连接后主炮没有继续发射');
  assert.strictEqual(B.p.effects.harpoon.fire, hooked, '有效连接期间浪费鱼叉发射');
  B = scene(SA); B.p.tether = null;
  B.p.sel = 'cannon_s'; B.p.lastSel = B.p.sel;
  const fired = B.p.events.fire; SA.Battle.debug.step(0.5);
  assert.strictEqual(B.p.events.fire, fired, '真人未扣扳机却被自动开火');
  // 全部目标放到鱼叉的后方；不能让无射界鱼叉抢占主炮。
  B.p.isAI = true; B.p.style = 'sniper'; B.p.retarget = 0;
  B.e.x = B.p.x - 600; B.e.pivX = B.e.x;
  for (const w of B.p.weapons) B.p.timers[w.key] = 0;
  SA.Battle.debug.step(1 / 60);
  assert.notStrictEqual(B.p.sel, 'harpoon', '无射界鱼叉抢占武器选择');
  // 远处仍可被正式弹道命中，但超出绳索长度不能获得控制价值。
  B = scene(SA); B.p.tether = null; B.p.isAI = true; B.p.style = 'sniper'; B.p.retarget = 0;
  B.e.x = B.p.x + 800; B.p.sel = 'cannon_s'; B.p.lastSel = B.p.sel;
  for (const w of B.p.weapons) B.p.timers[w.key] = 0;
  const gun = B.p.weapons.find(w => w.cell.id === 'harpoon'), victim = B.e.weapons.find(w => w.cell.id === 'harpoon');
  const point = api.modCenter(B.e, 'body', victim.r, victim.c), aim = api.aimAngle(B.p, gun, ...point);
  assert(aim.reach && !aim.over && !aim.behind && api.predict(B.p, B.e, gun, aim.a, false).hit, '超绳距负例没有可达弹道');
  SA.Battle.debug.step(1 / 60);
  assert.notStrictEqual(B.p.sel, 'harpoon', '超出绳索距离的鱼叉抢占主炮');
  return cases;
}

/** 恒定负荷夹具只固定距离和热状态，动力预算及断绳仍逐帧执行正式规则。 */
function stress(SA, api, load, { mass = 1, mt = 1, dt = 0.1, seconds = 1, threshold = 100 } = {}) {
  const B = scene(SA), s = B.p, t = s.tether, positions = [B.p.x, B.e.x];
  t.cell.mt = mt; t.time = 100; t.breakThreshold = threshold;
  s.dryKg *= mass; s.water = 0; s.heatRate = 0; s.speed = 60; s.storeMax = 0;
  s.supply = s.equip + SA.Phys.driveKw(s.dryKg, s.speed) + load;
  s.spool = 0; s.spoolDir = -1; B.keys.left = true;
  for (let i = 0; i < Math.round(seconds / dt) && s.tether; i++) {
    B.p.x = positions[0]; B.e.x = positions[1]; api.step(dt);
  }
  return { broken: !s.tether, hazard: t.overload || 0, threshold: t.breakThreshold, strength: SA.mod(t.cell).tetherStrength, spare: s.driveAvailableKw - s.driveKw };
}

/** 材料、富余动力和持续时间独立决定超载；质量不额外触发断裂。 */
function overload(SA, api) {
  const base = SA.mod('harpoon', 1).tetherStrength;
  assert(Number.isFinite(base) && base > 0, '鱼叉未配置抗拉动力上限');
  const strengths = Array.from({ length: SA.MAT_MAX }, (_, i) => SA.mod('harpoon', i + 1).tetherStrength);
  assert(strengths.every((x, i) => i === 0 || x > strengths[i - 1]), '材料没有提高抗拉上限');
  const safe = stress(SA, api, base, { threshold: null, seconds: 2 });
  assert(!safe.broken && safe.hazard === 0 && safe.threshold === null, '未超载绳索断裂、累积危险或抽取阈值');
  const sampled = stress(SA, api, base * 2, { threshold: null, seconds: 0.1 });
  assert(Math.abs(sampled.threshold - Math.log(2)) < 1e-8, '首次超载未用固定随机数抽指数阈值');
  const high = stress(SA, api, base * 2), heavy = stress(SA, api, base * 2, { mass: 4 });
  assert(Math.abs(high.hazard - 1) < 1e-8, '同质量更高富余动力没有累计超载');
  assert(Math.abs(high.hazard - heavy.hazard) < 1e-8, '相同富余动力被质量独立放大');
  const fine = stress(SA, api, base * 2, { dt: 0.05 });
  assert(Math.abs(fine.hazard - high.hazard) < 1e-8, '危险度不按 dt 积分');
  const short = stress(SA, api, base * 2, { threshold: 0.75, seconds: 0.5 });
  const long = stress(SA, api, base * 2, { threshold: 0.75, seconds: 1 });
  const stronger = stress(SA, api, base * 3, { threshold: 0.75, seconds: 0.5 });
  assert(!short.broken && long.broken && stronger.broken, '更大超载或更久持续没有提高断裂危险');
  const material = stress(SA, api, base * 2, { mt: SA.MAT_MAX, threshold: 0.1 });
  assert(!material.broken && material.hazard === 0, '高材料上限没有抵抗相同负荷');
  return { strengths, safe, sampled, high, heavy, fine, short, long, stronger, material };
}

function run() {
  const { SA, context } = evolve.loadGame();
  // 捕获已有画面接口只读弹道，不新增生产调试接口或遥测。
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  // battle 闭包加载时捕获固定随机源；完整对局另用正式 seed，宿主随机源立即恢复。
  const previousRandom = Math.random;
  try {
    Math.random = () => 0.5;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  } finally { Math.random = previousRandom; }
  SA.go = () => {}; SA.S.reset();
  return { ai: ai(SA, api), pull: pull(SA), overload: overload(SA, api) };
}
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
