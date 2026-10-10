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
  s.vx = side === 'p' ? 60 : -60; // 首撞必须有真实来速，静止贴身不再产生伤害。
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
  assert(s.events.ram > firstHits && target.taken > firstDamage, `${side} 再次前压没有造成第二次真实撞击伤害：${JSON.stringify({ t: B.t, ram: s.events.ram, vx: s.vx, targetVx: target.vx, charge: s.charge, x: s.x, targetX: target.x, contact: B.contact, ramContact: B.ramContact, cooldown: B.ramCd, done: B.done, dead: s.dead, reason: s.reason, targetDead: target.dead, targetReason: target.reason, rams: s.rams })}`);
  return { firstHits, totalHits: s.events.ram, damage: target.taken };
}

/** 混合武装撞上目标后先游走开火，再结束火力段重新撞击。 */
function mixed(rt, side) {
  const B = scene(rt, side, true), s = B[side], target = B[side === 'p' ? 'e' : 'p'];
  const p = rt.api.modBox(B.p, 8, 14, 'bucket'), e = rt.api.modBox(B.e, 8, 14, 'bucket');
  const shift = p.x1 - e.x0;
  B.e.x += shift; B.e.pivX += shift;
  s.charge = true; s.moveT = 1;
  s.vx = side === 'p' ? 60 : -60; // 混合武装同样以真实冲撞开始火力段。
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

/** 游走仍按目标位置移动；失去近战的冲锋车改为主动进入近距炮战。 */
function otherStyles(rt) {
  const B = scene(rt, 'e');
  B.e.style = 'wander'; B.e.moveT = 1; B.e.charge = false; B.e.goalX = B.e.x;
  rt.api.step(1 / 60);
  assert.strictEqual(B.e.dir, 0, 'wander 未保持原有目标位置行为');
  const rush = scene(rt, 'e');
  rush.e.style = 'rush'; rush.e.rams = 0; rush.e.moveT = 1; rush.e.charge = false; rush.e.goalX = rush.e.x;
  rt.api.step(1 / 60);
  assert.strictEqual(rush.e.dir, -1, '失去近战后没有接近至近距炮战');
  assert.strictEqual(rush.e.charge, false, '失去近战后仍触发近战冲锋');
  return true;
}

/** 有动力但双方都没有炮和近战件时，仍使用默认门限快速判平，不能无限拖战。 */
function noAttackDraw(rt) {
  const B = scene(rt, 'p');
  for (const side of ['p', 'e']) rt.SA.Battle.debug.damage(side, 8, 14, 'body', 100000);
  for (let i = 0; i < 180 && !B.draw; i++) rt.api.step(1 / 60);
  assert(B.draw && B.t < rt.SA.K.BATTLE.DRAW_HOLD_TIME + 0.1, '双方彻底失去攻击能力后没有默认快速判平');
  return { t: B.t, hold: rt.SA.K.BATTLE.DRAW_HOLD_TIME };
}

function run() {
  const rt = runtime();
  return { left: { approach: approach(rt, 'p'), repeat: repeat(rt, 'p'), mixed: mixed(rt, 'p'), losesGun: losesGun(rt, 'p') }, right: { approach: approach(rt, 'e'), repeat: repeat(rt, 'e'), mixed: mixed(rt, 'e'), losesGun: losesGun(rt, 'e') }, otherStyles: otherStyles(rt), noAttackDraw: noAttackDraw(rt) };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
