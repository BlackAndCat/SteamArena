/* 近战单次撞击与局部反震回归：在正式战斗逐帧碰撞中检查命中、分摊和门槛。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { loadGame } = require('./evolve');

/** 截取正式画面接口，所有伤害仍走 battle.js 的逐帧更新。 */
function runtime() {
  const { SA, context } = loadGame();
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  const source = process.argv.includes('--baseline') ? execFileSync('git', ['show', 'HEAD:js/battle.js'], { encoding: 'utf8' }) : fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8');
  const testSource = source.replace('  // 弹开概率：', '  window.__testRecoil = recoilDamage;\n  // 弹开概率：');
  assert.notStrictEqual(testSource, source, '反震测试入口失效');
  vm.runInContext(testSource, context);
  SA.go = () => {};
  SA.S.reset();
  return { SA, api, recoil: context.__testRecoil };
}

/** 前端撞击件对准敌方可毁的前端装甲，后排另有近、远模块用于分摊。 */
function car(SA, ram = 'bucket') {
  const v = SA.V.create('近战检查车');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][4] = SA.newCell('boiler', 6);
  v.body[7][4] = SA.newCell('helmet', 6);
  v.body[6][8] = SA.newCell('mg_s', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[8][14] = SA.newCell(ram, 6);
  return v;
}

function locate(SA, side, id, last = false) {
  const found = [];
  SA.V.each(side.v, (cell, r, c, layer) => { if (layer === 'body' && cell.id === id) found.push({ r, c, cell }); });
  return last ? found.at(-1) : found[0];
}

/** 把两件前端模块置为刚好接触，不依赖测试专用的碰撞出口。 */
function align(rt, B, target) {
  const { SA, api } = rt, ram = locate(SA, B.p, 'bucket') || locate(SA, B.p, 'piston') || locate(SA, B.p, 'boss_ram');
  const other = locate(SA, B.e, target, true);
  assert(ram && other, '接触夹具的前端模块缺失');
  const p = api.modBox(B.p, ram.r, ram.c, ram.cell.id);
  const e = api.modBox(B.e, other.r, other.c, other.cell.id);
  const move = p.x1 - e.x0;
  B.e.x += move; B.e.pivX += move;
}

function scene(rt, { dead = false, target = 'armor', ram = 'bucket', disabled = false } = {}) {
  const { SA, api } = rt;
  const p = car(SA, ram), e = car(SA, target);
  SA.S.d.vehicle = p;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: e, terrain: 'flat', boss: true });
  B.headless = true;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  if (dead) { const cell = locate(SA, B.e, target, true); SA.Battle.debug.damage('e', cell.r, cell.c, 'body', 100000); }
  if (disabled) { const cell = locate(SA, B.e, 'track', true); SA.Battle.debug.damage('e', cell.r, cell.c, 'body', 100000); }
  align(rt, B, target);
  B.p.vx = B.e.vx = 0;
  B.keys.right = true;
  return B;
}

/** 残骸挡在前沿时，真实撞击只结算一次，且近模块承受多于远模块。 */
function wreck(rt) {
  const { SA, api } = rt;
  const B = scene(rt, { dead: true, disabled: true });
  const near = locate(SA, B.e, 'armor').cell, far = locate(SA, B.e, 'boiler').cell;
  const hpN = near.hp, hpF = far.hp, taken = B.e.taken;
  B.p.vx = 200;
  api.step(1 / 60);
  const first = B.e.taken - taken;
  assert(B.p.events.ram === 1 && first > 0, '撞入残骸未结算真实撞击');
  assert(hpN - near.hp > hpF - far.hp, '残骸撞点附近未承受更多伤害');
  // 每帧恢复接触与高闭合速度，专门覆盖持续推压和数值分离抖动。
  for (let i = 0; i < 180; i++) { align(rt, B, 'armor'); B.p.vx = 30; B.e.vx = 0; api.step(1 / 60); }
  assert.strictEqual(B.p.events.ram, 1, '连续贴身重新结算撞击');
  assert.strictEqual(B.e.taken, taken + first, '持续推压仍伤害敌方全身');
  // 真实脱离后再撞，不能被连续接触锁永久禁止。
  B.e.x += 100; B.e.pivX += 100; B.p.vx = B.e.vx = 0; api.step(1 / 60);
  align(rt, B, 'armor'); B.p.vx = 200; api.step(1 / 60);
  assert.strictEqual(B.p.events.ram, 2, '脱离后的再次撞击没有伤害');
  return { first, rounds: B.p.events.ram };
}

/** 双方静止贴身并持续推进时，普通近战不再周期性扣除接触部件耐久。 */
function intact(rt) {
  const { SA, api } = rt, B = scene(rt);
  const target = locate(SA, B.e, 'armor', true).cell;
  const before = target.hp;
  for (let i = 0; i < 90; i++) { align(rt, B, 'armor'); B.p.vx = B.e.vx = 0; api.step(1 / 60); }
  assert.strictEqual(target.hp, before, '静止贴身仍造成推压伤害');
  return before - target.hp;
}

/** 没接触、没推进意图、反向、失去驱动或撞击件毁坏，都不能凭静止车身刷伤害。 */
function gates(rt) {
  const { SA, api } = rt;
  const cases = [
    B => { B.keys.right = false; },
    B => { B.keys.right = false; B.keys.left = true; },
    B => { B.e.x += 100; B.e.pivX += 100; },
    B => { const cell = locate(SA, B.p, 'track', true); SA.Battle.debug.damage('p', cell.r, cell.c, 'body', 100000); },
    B => { const cell = locate(SA, B.p, 'bucket'); SA.Battle.debug.damage('p', cell.r, cell.c, 'body', 100000); },
  ];
  for (const configure of cases) {
    const B = scene(rt, { dead: true, disabled: true });
    configure(B);
    const before = B.e.taken;
    for (let i = 0; i < 25; i++) api.step(1 / 60);
    assert.strictEqual(B.p.events.ram, 0, '禁止推压场景仍记录了近战命中');
    assert.strictEqual(B.e.taken, before, '禁止推压场景仍扣除目标耐久');
  }
  return cases.length;
}

/** 高速接触只按原撞击结算一次，不能叠加低速持续推压。 */
function fastImpact(rt) {
  const { SA, api } = rt, B = scene(rt);
  const ownRam = locate(SA, B.p, 'bucket').cell, hp = ownRam.hp, targetHp = locate(SA, B.e, 'armor', true).cell.hp;
  B.p.vx = 200; B.e.vx = 0;
  api.step(1 / 60);
  assert.strictEqual(B.p.events.ram, 1, '高速撞击与持续推压重复结算');
  assert(B.ramCd > 0, '高速撞击未启用共用冷却');
  const direct = targetHp - locate(SA, B.e, 'armor', true).cell.hp;
  const recoil = hp - ownRam.hp - B.e.dealt;
  assert(recoil >= direct * SA.K.RAM_MELEE_SELF_MIN - 1e-8 && recoil <= direct * SA.K.RAM_MELEE_SELF_MAX + 1e-8, `高速撞击反震未按实际命中损失计算：${JSON.stringify({ recoil, direct, incoming: B.e.dealt })}`);
  return B.p.events.ram;
}

/** 真实接触件承受反震，附近近战件不代受，毁坏时不溢出全车。 */
function recoilRouting(rt) {
  const { SA, recoil } = rt, B = scene(rt);
  const contact = locate(SA, B.p, 'armor'), ram = locate(SA, B.p, 'bucket');
  const hp = contact.cell.hp, ramHp = ram.cell.hp;
  recoil(B.p, { layer: 'body', r: contact.r, c: contact.c }, { ...contact, layer: 'body' }, 100);
  assert(Math.abs(hp - contact.cell.hp - 100 * SA.K.RAM_SELF) < 1e-6, '车体反震未落在真实接触件');
  assert.strictEqual(ram.cell.hp, ramHp, '车体接触却把反震转给邻近近战件');
  const before = ram.cell.hp;
  recoil(B.p, { layer: 'body', r: ram.r, c: ram.c }, { ...ram, layer: 'body' }, 100);
  assert(before - ram.cell.hp >= 100 * SA.K.RAM_MELEE_SELF_MIN && before - ram.cell.hp <= 100 * SA.K.RAM_MELEE_SELF_MAX, '近战接触反震超出既有倍率');
  ram.cell.hp = 2;
  const taken = B.p.taken;
  recoil(B.p, { layer: 'body', r: ram.r, c: ram.c }, { ...ram, layer: 'body' }, 100);
  assert(ram.cell.hp === 0 && B.p.taken - taken === 2, '接触部件毁坏后的反震溢出全车');
  return true;
}

/** 反向阵营的前沿残骸仍能被朝左冲锋的撞击件命中。 */
function mirrored(rt) {
  const { SA, api } = rt;
  const p = car(SA, 'armor'), e = car(SA, 'bucket');
  SA.S.d.vehicle = p;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: e, terrain: 'flat', boss: true });
  B.headless = true;
  const target = locate(SA, B.p, 'armor', true), ram = locate(SA, B.e, 'bucket');
  SA.Battle.debug.damage('p', target.r, target.c, 'body', 100000);
  const track = locate(SA, B.p, 'track', true);
  SA.Battle.debug.damage('p', track.r, track.c, 'body', 100000);
  const pb = api.modBox(B.p, target.r, target.c, target.cell.id), eb = api.modBox(B.e, ram.r, ram.c, ram.cell.id);
  const shift = pb.x1 - eb.x0;
  B.e.x += shift; B.e.pivX += shift;
  B.e.vx = -200; B.p.vx = 0;
  B.e.charge = true; B.e.moveT = 100;
  const taken = B.p.taken;
  api.step(1 / 60);
  assert(B.e.dir === -1 && B.e.events.ram === 1 && B.p.taken > taken, '敌方朝左推压残骸未造成伤害');
  return B.p.taken - taken;
}

/** 撞角接触双足腿部子格时，正常伤害必须进入腿区而非髋区。 */
function bipedZone(rt) {
  const { SA, api } = rt;
  const p = car(SA, 'armor');
  p.body[8][14] = null;
  p.body[10][14] = SA.newCell('bucket', 6);
  const e = SA.V.create('双足近战目标');
  e.body[SA.V.chassisRow('biped')][14] = SA.newCell('biped', 6);
  e.body[8][4] = SA.newCell('boiler', 6);
  e.body[7][4] = SA.newCell('helmet', 6);
  SA.S.d.vehicle = p;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: e, terrain: 'flat', boss: true });
  B.headless = true;
  const ram = locate(SA, B.p, 'bucket'), leg = locate(SA, B.e, 'biped');
  const pb = api.modBox(B.p, ram.r, ram.c, ram.cell.id), eb = api.modBox(B.e, leg.r, leg.c, leg.cell.id);
  const shift = pb.x1 - eb.x0;
  B.e.x += shift; B.e.pivX += shift;
  B.keys.right = true;
  B.p.vx = 200;
  const hip = B.e.bipedHipHp, before = B.e.bipedLegHp;
  api.step(1 / 60);
  assert(B.p.events.ram === 1 && B.e.bipedLegHp < before && B.e.bipedHipHp === hip, '撞击腿区却扣到髋区');
  const directLeg = before - B.e.bipedLegHp;
  // 已毁腿仍留在接触前沿：分摊应落到存活髋区和其他模块，不能再写进零耐久腿区。
  B.e.bipedLegHp = 0; B.e.bipedLegDead = true;
  leg.cell.hp = B.e.bipedHipHp;
  leg.cell.bipedZones = { hip: B.e.bipedHipHp, leg: 0, max: SA.V.maxHp(leg.cell) };
  B.e.speed = 0;
  B.ramCd = 0;
  B.e.x += 100; B.e.pivX += 100; B.p.vx = B.e.vx = 0; api.step(1 / 60);
  B.e.x -= 100; B.e.pivX -= 100; B.p.vx = 200;
  const hipLeft = B.e.bipedHipHp, boiler = locate(SA, B.e, 'boiler').cell, boilerHp = boiler.hp;
  api.step(1 / 60);
  assert(B.e.bipedLegHp === 0 && B.e.bipedHipHp < hipLeft && boiler.hp < boilerHp, '毁腿后的分摊写入死腿或漏掉其他模块');
  return { directLeg, dispersedHip: hipLeft - B.e.bipedHipHp };
}

/** 蒸汽撞锤按原 punchT 周期敲残骸，独立于车身单次撞击门禁。 */
function piston(rt) {
  const { SA, api } = rt, B = scene(rt, { dead: true, disabled: true, ram: 'piston' });
  B.keys.right = false;
  const taken = B.e.taken;
  api.step(1 / 60);
  assert(B.e.taken > taken && B.p.events.ram === 0, '撞锤没有独立敲击残骸');
  const first = B.e.taken, key = Object.keys(B.p.punchT)[0];
  assert(key && B.p.punchT[key] > 0, '撞锤没有设置原有周期');
  for (let i = 0; i < 60; i++) { align(rt, B, 'armor'); api.step(1 / 60); }
  assert.strictEqual(B.e.taken, first, '撞锤周期内重复结算');
  for (let i = 0; i < 60 && B.e.taken === first; i++) { align(rt, B, 'armor'); api.step(1 / 60); }
  assert(B.e.taken > first, `撞锤下一周期没有继续敲击：t=${B.t} cd=${B.p.punchT[key]} contact=${B.contact} dead=${B.p.dead}/${B.e.dead} reason=${B.e.reason} done=${B.done}`);
  const noSteam = scene(rt, { dead: true, disabled: true, ram: 'piston' });
  const boiler = locate(SA, noSteam.p, 'boiler');
  SA.Battle.debug.damage('p', boiler.r, boiler.c, 'body', 100000);
  const still = noSteam.e.taken;
  api.step(1 / 60);
  assert.strictEqual(noSteam.e.taken, still, '撞锤断汽后仍然敲击');
  return { first: first - taken, second: B.e.taken - first, noSteam: true };
}

/** 撞击件贴住残骸时，双足不能跨过仍有距离的正常碰撞行隔空踢击。 */
function noRemoteKick(rt) {
  const { SA, api } = rt;
  const p = SA.V.create('双足残骸接触检查');
  p.body[SA.V.chassisRow('biped')][6] = SA.newCell('biped', 6);
  p.body[8][4] = SA.newCell('boiler', 6);
  p.body[7][4] = SA.newCell('helmet', 6);
  p.body[8][14] = SA.newCell('bucket', 6);
  const e = car(SA, 'armor');
  SA.S.d.vehicle = p;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: e, terrain: 'flat', boss: true });
  B.headless = true;
  B.p.balance = '平衡';
  assert(B.p.chassisId === 'biped' && B.p.speed > 0, '双足隔空踢击夹具没有移动能力');
  const target = locate(SA, B.e, 'armor', true), ram = locate(SA, B.p, 'bucket');
  SA.Battle.debug.damage('e', target.r, target.c, 'body', 100000);
  const pb = api.modBox(B.p, ram.r, ram.c, ram.cell.id), eb = api.modBox(B.e, target.r, target.c, target.cell.id);
  const shift = pb.x1 - eb.x0;
  B.e.x += shift; B.e.pivX += shift;
  B.keys.right = true;
  api.step(1 / 60);
  assert(B.contact && B.p.events.ram === 0 && B.p.events.kick === 0, '残骸接触把远处正常行误当双足踢击目标');
  return B.p.events.kick;
}

function run() {
  const rt = runtime();
  return { intact: intact(rt), wreck: wreck(rt), gates: gates(rt), fastImpact: fastImpact(rt), recoilRouting: recoilRouting(rt), mirrored: mirrored(rt), bipedZone: bipedZone(rt), piston: piston(rt), noRemoteKick: noRemoteKick(rt) };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
