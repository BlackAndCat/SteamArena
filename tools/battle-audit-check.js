/* 战斗数值回归：经正式逐帧入口验证耐久、实伤、辅助件和持续伤害。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

/** 装入正式规则层，并截获战斗画面公开的规则入口。 */
function runtime() {
  const { SA, context } = evolve.loadGame();
  const memory = new Map();
  context.localStorage = { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  let api, result;
  SA.BattleView = { create(value) {
    api = value;
    return { gameSpeed: () => 1, tick() {}, emit() {}, teardown() {}, presentResult(value) { result = value; } };
  } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  SA.S.reset();
  return { SA, api: () => api, result: () => result };
}

/** 建造静止的有效车辆，测试格之间互不重叠。 */
function car(SA, { biped = false, weapon = 'cannon', aid = null, mat = 6 } = {}) {
  const v = SA.V.create('数值检查车');
  if (biped) v.body[SA.V.chassisRow('biped')][6] = SA.newCell('biped', mat);
  else for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', mat);
  v.body[8][4] = SA.newCell('boiler', mat);
  v.body[8][8] = SA.newCell('water', mat);
  v.body[7][4] = SA.newCell('helmet', mat);
  if (weapon) v.body[6][4] = SA.newCell(weapon, mat);
  if (aid) v.body[7][3] = SA.newCell(aid, mat);
  assert(SA.V.stats(v).canDeploy, `数值检查车不能出战：${JSON.stringify(SA.V.issues(v))}`);
  return v;
}

/** 关闭车辆移动和对方开火，用正式 startState 建立受击状态。 */
function start(rt, player, enemy, mode = 'campaign') {
  const { SA } = rt;
  SA.S.d.vehicle = player;
  const B = SA.Battle.startState({ mode, enemyVehicle: enemy, terrain: 'flat', boss: true });
  B.p.speed = B.e.speed = 0;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  return B;
}

/** 查找开战后因左右对齐而移动的模块锚点。 */
function locate(SA, side, id, index = 0) {
  const found = [];
  SA.V.each(side.v, (cell, r, c, layer) => { if (cell.id === id && layer === 'body') found.push([r, c]); });
  assert(found[index], `找不到 ${id} #${index}`);
  return found[index];
}

/** 汇总含已毁模块在内的非负剩余耐久。 */
function health(SA, vehicle) {
  let sum = 0;
  SA.V.each(vehicle, cell => { sum += Math.max(0, cell.hp); });
  return sum;
}

/** 在模块内部放入静止且穿甲确定的炮弹，下一帧由正式碰撞和伤害链结算。 */
function hit(rt, B, from, to, r, c, damage, { y = 0, splash = null } = {}) {
  const [x, cy] = rt.api().modCenter(to, 'body', r, c);
  const before = to.v.body[r][c].hp, dealt = from.dealt, taken = to.taken;
  B.shots.push({ x, y: cy + y, vx: 0, vy: 0, g: 0, delay: 0, from, to, side: false,
    weapon: splash ? { splash } : {}, weaponCell: { id: 'cannon' }, dmg: damage, big: false });
  rt.api().step(1 / 60);
  return { before, after: to.v.body[r][c].hp, dealt: from.dealt - dealt, taken: to.taken - taken };
}

/** 双足残血及髋腿分区不得因初始化、刷新、战后结算而回升。 */
function biped(rt) {
  const { SA } = rt, player = car(SA, { biped: true, weapon: null });
  const row = SA.V.chassisRow('biped'), cell = player.body[row][6];
  cell.hp = 10;
  const B = start(rt, player, car(SA, { weapon: null }), 'campaign');
  const [br, bc] = locate(SA, B.p, 'biped');
  const first = hit(rt, B, B.e, B.p, br, bc, 1, { y: 25 });
  assert.strictEqual(first.after, 9, '双足 10 HP 受 1 点伤害应为 9');
  assert.strictEqual(first.dealt, 1);
  const leg = B.p.bipedLegHp, hip = B.p.bipedHipHp;
  hit(rt, B, B.e, B.p, br, bc, leg + 50, { y: 25 });
  assert(B.p.bipedLegHp >= 0 && B.p.bipedHipHp === hip, '腿区超伤不能扣到髋区');
  const before = B.p.v.body[br][bc].hp;
  hit(rt, B, B.e, B.p, br, bc, 1, { y: -25 });
  assert(B.p.v.body[br][bc].hp < before, '腿区毁后髋区仍应受伤');
  assert(B.p.bipedLegHp === 0 && B.p.bipedHipHp >= 0);
  const second = B.p.v.body[br][bc].hp;
  hit(rt, B, B.e, B.p, br, bc, 1, { y: -25 });
  assert.strictEqual(B.p.v.body[br][bc].hp, second - 1, '重复刷新不得复活双足');
  B.e.dead = true; B.e.reason = '检查结束'; B.ending = 0.001;
  rt.api().step(1 / 60);
  const result = rt.result();
  assert(result && result.playerVehicle.body[row][6].hp <= before, '正式战斗结算丢失残血');
  SA.S.settleBattle(result);
  assert(SA.S.d.vehicle.body[row][6].hp <= before, '存档结算把双足耐久回满');
  const persisted = SA.S.d.vehicle.body[row][6].hp;
  const hipVehicle = car(SA, { biped: true, weapon: null });
  hipVehicle.body[row][6].hp = 10;
  const H = start(rt, hipVehicle, car(SA, { weapon: null }));
  const [hr, hc] = locate(SA, H.p, 'biped');
  hit(rt, H, H.e, H.p, hr, hc, 50, { y: -25 });
  assert.strictEqual(H.p.bipedHipHp, 0, '髋区超伤没有封顶');
  assert.strictEqual(H.p.bipedLegHp, 5, '髋区超伤跨区扣到腿');
  assert.strictEqual(H.p.v.body[hr][hc].hp, 5);
  return { initial: 10, first: first.after, persisted, hipOverkill: H.p.v.body[hr][hc].hp };
}

/** 用真实命中校验伤害账本、溅射、爆炸及超时判胜。 */
function accounting(rt) {
  const { SA } = rt, player = car(SA, { weapon: null }), enemy = car(SA, { weapon: null });
  const B = start(rt, player, enemy);
  const [wr, wc] = locate(SA, B.e, 'water');
  B.e.v.body[wr][wc].hp = 1; // 正式入战会把敌车补满，夹具在入战后设残血。
  const one = hit(rt, B, B.p, B.e, wr, wc, 257);
  assert.strictEqual(one.before, 1, '数值夹具的目标耐久应为 1');
  assert.strictEqual(one.dealt, 1, '257 伤害击中 1 HP 只能记 1');
  assert.strictEqual(one.taken, 1);
  const [boilerR, boilerC] = locate(SA, B.e, 'boiler');
  const splashCell = B.e.v.body[boilerR][boilerC];
  const beforeSplash = health(SA, B.e.v), dealtBeforeSplash = B.p.dealt;
  const [cockpitR, cockpitC] = locate(SA, B.e, 'helmet');
  const splash = hit(rt, B, B.p, B.e, cockpitR, cockpitC, 10, { splash: { r: 120, k: 1 } });
  assert(Math.abs(splash.dealt - (beforeSplash - health(SA, B.e.v))) < 1e-7, '溅射计分必须等于实际耐久损失');
  assert(Math.abs(B.p.dealt - dealtBeforeSplash - splash.dealt) < 1e-7);
  splashCell.hp = 1;
  const beforeBoom = health(SA, B.e.v);
  const explosion = hit(rt, B, B.p, B.e, boilerR, boilerC, 257);
  assert(Math.abs(explosion.dealt - (beforeBoom - health(SA, B.e.v))) < 1e-7, '爆炸计分必须等于实际耐久损失');
  return { overkill: one.dealt, splash: splash.dealt, explosion: explosion.dealt };
}

/** 双方满耐久相同且都存活时，一点实伤不能凭超额炮弹逆转百点实伤。 */
function timeout(rt) {
  const { SA } = rt, player = car(SA), enemy = car(SA);
  player.body[8][8].hp = 100;
  const B = start(rt, player, enemy);
  assert.strictEqual(B.p.startHp, B.e.startHp, '超时夹具双方最大耐久不等');
  const [pr, pc] = locate(SA, B.p, 'water'), [er, ec] = locate(SA, B.e, 'water');
  B.e.v.body[er][ec].hp = 1;
  hit(rt, B, B.p, B.e, er, ec, 257);
  hit(rt, B, B.e, B.p, pr, pc, 100);
  assert(!B.p.dead && !B.e.dead, '超时夹具在计分前结束');
  assert.strictEqual(B.p.dealt, 1);
  assert.strictEqual(B.e.dealt, 100);
  B.t = SA.K.BATTLE_TIME - 1 / 120;
  rt.api().step(1 / 60);
  assert(B.timeout && B.timeout.e > B.timeout.p && B.p.dead, '超额伤害逆转超时裁定');
  return { playerDealt: B.p.dealt, enemyDealt: B.e.dealt, score: B.timeout };
}

/** 单件与双件辅助模块均按纸面倍率生效，损坏后立即失效。 */
function auxiliaries(rt) {
  const { SA } = rt, rows = [];
  for (const aid of ['autoloader', 'rangefinder']) for (const count of [1, 2]) {
    const player = car(SA, { aid, mat: 4 });
    if (count === 2) player.body[6][3] = SA.newCell(aid, 4);
    const B = start(rt, player, car(SA));
    const gun = B.p.weapons.find(w => w.cell.id === 'cannon');
    const key = aid === 'autoloader' ? 'reload' : 'spread';
    const expected = SA.mod(gun.cell)[key] * 0.85 ** count;
    assert(Math.abs(gun.m[key] - expected) < 1e-9, `${aid} ${count} 件重复计算`);
    assert.strictEqual(SA.V.stats(player).aux[key], 0.85 ** count);
    const paper = SA.V.stats(player), salvo = gun.m.dmg / gun.m.reload * paper.power;
    assert.strictEqual(paper.blocked.length, 0, '辅助倍率夹具遮挡了炮口');
    assert(Math.abs(paper.salvoDps - salvo) < 1e-9, '纸面装填输出与战斗倍率不一致');
    assert(Math.abs(paper.dps - salvo * Math.max(0.4, 0.95 - gun.m.spread * 0.03 + paper.acc)) < 1e-9, '纸面散布输出与战斗倍率不一致');
    const [ar, ac] = locate(SA, B.p, aid);
    const aidCell = B.p.v.body[ar][ac];
    hit(rt, B, B.e, B.p, ar, ac, aidCell.hp);
    const after = B.p.weapons.find(w => w.cell.id === 'cannon').m[key];
    assert(Math.abs(after - SA.mod(gun.cell)[key] * (count === 2 ? 0.85 : 1)) < 1e-9, `${aid} 毁后未失效`);
    rows.push([aid, count]);
  }
  const gyro = car(SA, { aid: 'gyroscope' });
  assert(Math.abs(SA.V.stats(gyro).sway - SA.mod('track', 6).sway * SA.mod('gyroscope', 6).swayMul) < 1e-9, '纸面晃动倍率重复应用');
  return rows;
}

/** T4/T6 喷火器用实际发射炮弹验证持续伤害按材料放大。 */
function flamer(rt) {
  const { SA } = rt, rows = [];
  for (const mt of [4, 6]) {
    const B = start(rt, car(SA, { weapon: 'flamer', mat: mt }), car(SA, { weapon: null }));
    const w = B.p.weapons.find(item => item.cell.id === 'flamer');
    B.e.x -= 260; B.e.pivX -= 260;
    B.p.timers[w.key] = 0;
    B.p.elev[w.key] = w.m.rest;
    B.p.focus = 1; B.keys.fire = true;
    const [targetR, targetC] = locate(SA, B.e, 'helmet');
    B.aim = rt.api().modCenter(B.e, 'body', targetR, targetC);
    for (let i = 0; i < 120 && !B.p.events.fire; i++) { B.p.focus = 1; rt.api().step(1 / 60); }
    const shot = B.shots.find(item => item.from === B.p && item.weaponCell.id === 'flamer');
    assert(shot, `T${mt} 喷火器未发射`);
    const expected = 4 * SA.MATS[mt].mul * w.m.reload;
    assert(Math.abs(shot.dmg - expected) < 1e-9, `T${mt} 持续伤害未按材料放大`);
    rows.push({ mt, shot: shot.dmg });
  }
  return rows;
}

/** 汇总各项真实战斗断言，供命令行和 evolve-check 调用。 */
function run(section) {
  const cases = { biped, accounting, timeout, auxiliaries, flamer };
  if (section) return cases[section](runtime());
  return Object.fromEntries(Object.entries(cases).map(([name, check]) => [name, check(runtime())]));
}
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
