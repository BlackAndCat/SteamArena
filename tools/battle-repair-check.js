/* 战斗修复专项：真实选炮、喷射射程与自由驾驶缆绳受力；--baseline 在 VM 中重放 Git 基线。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { loadGame } = require('./evolve');
const evolve = require('./evolve');

/** 仅测试 VM 开放驾驶/受力入口，不增加正式游戏调试接口。 */
function runtime() {
  const { SA, context } = loadGame();
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  let source = process.argv.includes('--baseline') ? execFileSync('git', ['show', 'HEAD:js/battle.js'], { encoding: 'utf8' }) : fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8');
  source = source.replace('  // 弹开概率：', '  window.__forces = { drive, overloadTether, ai };\n  // 弹开概率：');
  const originalRandom = Math.random;
  try { Math.random = () => 0.5; vm.runInContext(source, context); }
  finally { Math.random = originalRandom; }
  SA.go = () => {}; SA.S.reset();
  return { SA, api, forces: context.__forces };
}

/** 相同底座保证动力与长战温度不掩盖武器选择，顶部遮挡由正式布局规则判定。 */
function car(SA, weapons = ['mg_s']) {
  const v = SA.V.create('战斗修复检查');
  for (let c = 0; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][0] = SA.newCell('boiler', 6);
  v.body[7][2] = SA.newCell('helmet', 6);
  const spots = [[7, 4], [6, 8], [7, 12]];
  weapons.forEach((id, i) => { const [r, c] = id === 'steamjet' || id === 'flamer' ? [7, 12] : spots[i]; v.body[r][c] = SA.newCell(id, id === 'steamjet' ? 3 : 6); });
  return v;
}
function scene(rt, v) {
  const { SA } = rt;
  SA.S.d.vehicle = v;
  const enemyVehicle = car(SA); enemyVehicle.body[7][12] = enemyVehicle.body[7][4]; enemyVehicle.body[7][4] = null;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle, terrain: 'flat', boss: true });
  B.headless = true; B.p.isAI = true; B.p.style = 'sniper';
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 }; B.e.speed = 0;
  return B;
}

/** 仍存活却被顶板挡住的高抛炮不能夺走可用机枪的主控位。 */
function selection(rt) {
  const { SA, api } = rt, v = car(SA, ['mortar_s', 'mg_s']);
  v.body[5][4] = SA.newCell('armor', 6);
  const B = scene(rt, v);
  SA.V.each(B.e.v, cell => { cell.hp *= 1e6; }); B.e.startHp *= 1e6;
  assert(B.p.weapons.find(w => w.cell.id === 'mortar_s').blocked, '未使用真实炮顶遮挡夹具');
  api.step(1 / 60);
  assert.strictEqual(B.p.sel, 'mg_s', '被遮挡高抛兜底使可用主炮丢失');
  for (let i = 0; i < 600 && !B.p.dead && !B.e.dead; i++) api.step(1 / 60);
  assert(B.p.effects.mg_s?.fire > 3, '恢复选炮后未持续发射机枪');
  return { selected: B.p.sel, shots: B.p.effects.mg_s.fire, seconds: B.t };
}

/** 真实炮口距离远时不喷射，混合武装用余炮；只有喷射器时迫近并在近处恢复开火。 */
function jets(rt) {
  const { SA, api } = rt;
  const result = [];
  for (const id of ['steamjet', 'flamer']) {
    let B = scene(rt, car(SA, [id, 'mg_s']));
    B.p.style = 'wander'; B.p.sel = id; B.p.lastSel = id; B.p.retarget = 10;
    const enemy = B.e.weapons[0], jet = B.p.weapons.find(w => w.cell.id === id);
    const pt = api.modCenter(B.e, 'body', enemy.r, enemy.c), a = api.aimAngle(B.p, jet, ...pt), mouth = api.muzzle(B.p, jet, a.a);
    assert(Math.hypot(pt[0] - mouth[0], pt[1] - mouth[1]) > jet.m.range, '远距喷射夹具未超过真实射程');
    api.step(1);
    assert.strictEqual(B.p.effects[id]?.fire || 0, 0, '远处喷射浪费弹药');
    assert.strictEqual(B.p.sel, 'mg_s', '远处没有切换可用余炮');
    B = scene(rt, car(SA, [id])); B.p.style = 'kite';
    api.step(1 / 60);
    assert.strictEqual(B.p.dir, 1, '仅有喷射器却没有迫近');
    assert.strictEqual(B.p.events.fire, 0, '仅有喷射器在远距空喷');
    const target = B.e.weapons[0], gun = B.p.weapons[0];
    const gp = api.muzzle(B.p, gun, 0), ep = api.modCenter(B.e, 'body', target.r, target.c);
    const shift = gp[0] + 110 - ep[0]; B.e.x += shift; B.e.pivX += shift;
    B.p.target = { layer: 'body', r: target.r, c: target.c }; B.p.retarget = 0;
    B.p.speed = 0; B.p.style = 'sniper';
    for (let i = 0; i < 90 && !B.p.events.fire; i++) api.step(1 / 60);
    assert(B.p.events.fire > 0, '喷射器进入真实近距后没有恢复开火');
    result.push({ id, nearShots: B.p.events.fire });
  }
  return result;
}

/** 约束两端位置模拟绳索拉住；自由驾驶仍走正式动力和加速度，不能把静止当作无拉力。 */
function tension(rt) {
  const { SA, api, forces } = rt;
  const samples = [];
  for (const mode of ['shared', 'closing', 'faster', 'opposed']) {
    const B = scene(rt, car(SA, ['harpoon'])), s = B.p, o = B.e;
    o.x -= 180; o.pivX -= 180;
    const gun = s.weapons[0], victim = o.weapons[0];
    s.isAI = false;
    s.tether = { layer: 'body', r: victim.r, c: victim.c, cell: gun.cell, target: o, time: 100, breakThreshold: 100 };
    gun.cell.mt = 1;
    o.mass = s.mass;
    for (const q of [s, o]) {
      q.speed = 60; q.speedMul = 1; q.accelK = q.brakeK = 1; q.power = 1; q.driveKw = 10; q.driveAvailableKw = 500; q.statMultipliers.speed = 1;
      q.spool = 0; q.water = 0; q.heat = 0; q.appliedTetherVx = 0;
    }
    s.dir = mode === 'opposed' ? -1 : 1; o.dir = 1;
    if (mode === 'faster') o.speed = 90;
    const positions = [s.x, o.x];
    for (let i = 0; i < 120; i++) {
      s.x = positions[0]; o.x = positions[1];
      s.vx = mode === 'opposed' ? 0 : mode === 'closing' ? 50 : 30; o.vx = mode === 'opposed' ? 0 : mode === 'faster' ? 50 : 30;
      s.appliedTetherVx = o.appliedTetherVx = 0;
      // 历史收绳分量也不能把同向同速的共同平移误判为自由分離。
      if (mode === 'shared') { s.tetherPullVx = s.appliedTetherVx = 20; o.tetherPullVx = o.appliedTetherVx = -20; }
      s.spoolDir = s.dir; o.spoolDir = o.dir;
      forces.drive(s, 1 / 60); forces.drive(o, 1 / 60);
      // 相背驾驶受缆约束：实际速度为零，仍保留主动向两侧驾驶产生的自由分离趋势。
      if (mode === 'opposed') s.vx = o.vx = 0;
      forces.overloadTether(s, o, 1 / 60);
    }
    const hazard = s.tether.overload || 0;
    if (mode === 'shared' || mode === 'closing') assert.strictEqual(hazard, 0, `${mode} 无真实牵拉却累计断绳危险`);
    else assert(hazard > 0, `${mode} 真实受拉未累计危险`);
    samples.push({ mode, hazard });
  }
  return samples;
}

/** 正式烟囱车长战复现热恢复渐近死锁；只增耐久以免伤亡中断热状态观察。 */
function heat(rt) {
  const { SA, api, forces } = rt, stage = evolve.stageFor(SA, 2, 0);
  const oldTime = SA.K.BATTLE_TIME;
  SA.K.BATTLE_TIME = 181;
  try {
    SA.S.d.vehicle = car(SA, []);
    const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: stage.vehicle, terrain: 'flat', boss: true, style: 'wander' });
    B.headless = true;
    for (const q of [B.p, B.e]) { SA.V.each(q.v, cell => { cell.hp *= 1e8; }); q.startHp *= 1e8; }
    let firstHold = null, fireAtHold = 0, recovered = false, maxResumeLow = 0;
    for (let i = 0; i < 180 * 60 && !B.done; i++) {
      api.step(1 / 60);
      if (B.e.hold && firstHold == null) { firstHold = B.t; fireAtHold = B.e.events.fire; }
      if (firstHold != null && B.e.events.fire > fireAtHold) recovered = true;
      if (B.e.heatResumeLow != null) { maxResumeLow = Math.max(maxResumeLow, B.e.heatResumeLow); assert(B.e.heatResumeLow < SA.K.BATTLE.AI_HEAT_HIGH, '有效恢复线没有低于停火线'); }
    }
    assert(firstHold != null, '烟囱夹具没有进入热保持');
    assert(recovered, `烟囱进入保持后直到 ${B.t.toFixed(1)} 秒仍未恢复射击，热比=${B.e.heat / B.e.heatMax}`);
    const resumeLow = B.e.heatResumeLow, water = B.e.water, shots = B.shots.length;
    // 足够强的散热可以到达旧恢复线；变化水量与热输入后必须重算，试算不得消耗真实水。
    B.e.hold = true; B.e.heat = B.e.heatMax * 0.6; B.e.heatResumeAt = 0;
    B.e.thermalIdleInput = { ...B.e.thermalIdleInput, heatKw: 0, shaftKw: 0, dryCool: 1000 };
    forces.ai(B.e, B.p, 1 / 60);
    assert.strictEqual(B.e.heatResumeLow, SA.K.BATTLE.AI_HEAT_LOW, '原恢复线可达时被无故改动');
    assert.strictEqual(B.e.water, water, '恢复门限试算扣了真实水');
    assert.strictEqual(B.shots.length, shots, '恢复门限试算产生炮弹');
    B.e.water = 0; B.e.thermalIdleInput = { ...B.e.thermalIdleInput, heatKw: 155, dryCool: 0 }; B.e.heatResumeAt = 0;
    forces.ai(B.e, B.p, 1 / 60);
    assert(B.e.hold && B.e.heatResumeLow === SA.K.BATTLE.AI_HEAT_LOW, '缺水后平衡高于停火线却强行恢复射击');
    return { firstHold, fireAtHold, totalFire: B.e.events.fire, seconds: B.t, resumeLow, maxResumeLow, recovered };
  } finally { SA.K.BATTLE_TIME = oldTime; }
}
function run() {
  const rt = runtime(), only = process.argv.find(x => x.startsWith('--case='))?.slice(7);
  const tests = { selection, jets, tension, heat }, out = {};
  for (const [name, test] of Object.entries(tests)) if (!only || only === name) out[name] = test(rt);
  return out;
}
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
