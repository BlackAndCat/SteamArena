/* 冲锋 AI 回归：用正式战斗逐帧更新检查接敌和贴身再冲撞。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 固定冲锋判定的随机结果，同时保留战斗的真实逐帧物理。 */
function runtime() {
  const original = Math.random;
  Math.random = () => 0.99;
  try {
    const { SA, context } = loadGame();
    let api;
    SA.BattleView = { create(value) { api = value; return null; } };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
    SA.go = () => {};
    SA.S.reset();
    return { SA, api };
  } finally { Math.random = original; }
}

/** 用真实铲斗及可选机枪区分纯近战与混合武装。 */
function car(SA, ranged = false) {
  const v = SA.V.create('冲锋检查车');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][4] = SA.newCell('boiler', 6);
  v.body[7][4] = SA.newCell('helmet', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[8][14] = SA.newCell('bucket', 6);
  if (ranged) v.body[6][8] = SA.newCell('mg_s', 6);
  return v;
}

function scene(rt, side, ranged = false) {
  const { SA } = rt;
  SA.S.d.vehicle = car(SA, ranged && side === 'p');
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: car(SA, ranged && side === 'e'), terrain: 'flat', boss: true, style: 'rush' });
  B.headless = true;
  B.p.isAI = side === 'p';
  B.p.style = side === 'p' ? 'rush' : null;
  B.e.style = side === 'e' ? 'rush' : null;
  // 非检查一侧静止，避免相向冲锋替待测车辆完成接触。
  if (side === 'e') B.p.speed = 0;
  else B.e.speed = 0;
  return B;
}

/** 周期到期且真实接触尚未发生时，应继续向对手开动。 */
function approach(rt, side) {
  const B = scene(rt, side), s = B[side], fwd = side === 'p' ? 1 : -1;
  s.charge = true; s.moveT = 0;
  assert.strictEqual(B.contact, false);
  rt.api.step(1 / 60);
  assert.strictEqual(s.charge, true, `${side} 接触前提前退出冲锋`);
  assert.strictEqual(s.dir, fwd, `${side} 接触前没有前压`);
  return { dir: s.dir, charge: s.charge };
}

/** 真正接触后只短暂撤步，再回头撞向静止目标。 */
function repeat(rt, side) {
  const B = scene(rt, side), s = B[side], target = B[side === 'p' ? 'e' : 'p'];
  const p = rt.api.modBox(B.p, 8, 14, 'bucket'), e = rt.api.modBox(B.e, 8, 14, 'bucket');
  const shift = p.x1 - e.x0;
  B.e.x += shift; B.e.pivX += shift;
  s.charge = true; s.moveT = 1;
  rt.api.step(1 / 60);
  assert(B.contact, `${side} 夹具没有发生真实接触`);
  const firstHits = s.events.ram, firstDamage = target.taken;
  assert(firstHits > 0 && firstDamage > 0, `${side} 首次接触没有撞击伤害`);
  s.moveT = 0;
  rt.api.step(1 / 60);
  const fwd = side === 'p' ? 1 : -1;
  assert.strictEqual(s.charge, false, `${side} 接触后没有进入短撤步`);
  assert.strictEqual(s.dir, -fwd, `${side} 短撤步方向错误`);
  assert(s.moveT <= rt.SA.K.BATTLE.AI_CONTACT_MOVE_TIME, `${side} 撤步时长超过接触短窗`);
  let resumed = false;
  for (let i = 0; i < 30; i++) {
    rt.api.step(1 / 60);
    if (s.charge && s.dir === fwd) { resumed = true; break; }
  }
  assert(resumed, `${side} 短撤步后没有再次前压`);
  for (let i = 0; i < 480 && !B.done && s.events.ram < firstHits + 1; i++) rt.api.step(1 / 60);
  assert(s.events.ram > firstHits && target.taken > firstDamage, `${side} 再次前压没有造成第二次真实撞击伤害`);
  return { firstHits, totalHits: s.events.ram, damage: target.taken };
}

/** 混合武装撞上目标后先游走开火，再结束火力段重新撞击。 */
function mixed(rt, side) {
  const B = scene(rt, side, true), s = B[side], target = B[side === 'p' ? 'e' : 'p'];
  const p = rt.api.modBox(B.p, 8, 14, 'bucket'), e = rt.api.modBox(B.e, 8, 14, 'bucket');
  const shift = p.x1 - e.x0;
  B.e.x += shift; B.e.pivX += shift;
  s.charge = true; s.moveT = 1;
  rt.api.step(1 / 60);
  assert(B.contact && s.events.ram > 0 && target.taken > 0, `${side} 混合武装没有首轮真实撞击`);
  const firstHits = s.events.ram, firstFire = s.events.fire;
  s.moveT = 0;
  rt.api.step(1 / 60);
  assert.strictEqual(s.charge, false, `${side} 混合武装接触后没有进入火力段`);
  assert(s.moveT > rt.SA.K.BATTLE.AI_CONTACT_MOVE_TIME, `${side} 混合武装的游走火力段被缩成短撤步`);
  let firedDuringFire = false, recharged = false, secondImpactDamage = 0;
  for (let i = 0; i < 2400 && !B.done && s.events.ram < firstHits + 1; i++) {
    const hits = s.events.ram, beforeDamage = target.taken;
    rt.api.step(1 / 60);
    firedDuringFire ||= !s.charge && s.events.fire > firstFire;
    recharged ||= s.charge;
    if (s.events.ram > hits) secondImpactDamage = target.taken - beforeDamage;
  }
  assert(firedDuringFire, `${side} 混合武装游走期间没有实际开火`);
  assert(recharged && s.events.ram > firstHits && secondImpactDamage > 0, `${side} 混合武装火力段结束后没有再次造成撞击伤害：${JSON.stringify({ t: B.t, done: B.done, charge: s.charge, moveT: s.moveT, dir: s.dir, ram: s.events.ram, fire: s.events.fire, x: s.x, targetX: target.x, contact: B.contact, targetDead: target.dead, secondImpactDamage })}`);
  return { firstHits, totalHits: s.events.ram, shots: s.events.fire - firstFire, secondImpactDamage };
}

/** 最后一门远程武器真实损毁后，剩余近战件切换为短撤步循环。 */
function losesGun(rt, side) {
  const B = scene(rt, side, true), s = B[side];
  assert(s.weapons.some(w => w.cell.id === 'mg_s'), `${side} 混合武装夹具缺少机枪`);
  s.charge = false; s.moveT = 3;
  rt.SA.Battle.debug.damage(side, 6, 8, 'body', 100000);
  assert.strictEqual(s.weapons.length, 0, `${side} 机枪损毁后仍被当作远程武器`);
  rt.api.step(1 / 60);
  assert.strictEqual(s.dir, side === 'p' ? -1 : 1, `${side} 失去机枪后未转为近战短撤步`);
  assert(s.moveT <= rt.SA.K.BATTLE.AI_CONTACT_MOVE_TIME, `${side} 失去机枪后沿用过长火力段`);
  return { dir: s.dir, moveT: s.moveT };
}

/** 其他性格及失去近战能力的冲锋车仍按原目标位置移动。 */
function otherStyles(rt) {
  for (const [style, noMelee] of [['wander', false], ['rush', true]]) {
    const B = scene(rt, 'e');
    B.e.style = style;
    if (noMelee) B.e.rams = 0;
    B.e.moveT = 1; B.e.charge = false; B.e.goalX = B.e.x;
    rt.api.step(1 / 60);
    assert.strictEqual(B.e.dir, 0, `${style} 非近战分支未保持原有目标位置行为`);
  }
  return true;
}

function run() {
  const rt = runtime();
  return { left: { approach: approach(rt, 'p'), repeat: repeat(rt, 'p'), mixed: mixed(rt, 'p'), losesGun: losesGun(rt, 'p') }, right: { approach: approach(rt, 'e'), repeat: repeat(rt, 'e'), mixed: mixed(rt, 'e'), losesGun: losesGun(rt, 'e') }, otherStyles: otherStyles(rt) };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
