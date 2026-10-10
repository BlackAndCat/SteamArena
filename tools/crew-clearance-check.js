/* 驾驶员逐门装填与高抛炮顶部净空的真实规则回归。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { loadGame } = require('./evolve');
function run() {
// 战斗脚本加载时捕获随机函数；测试可固定并列进度的抽签结果。
const nativeRandom = Math.random;
let forcedRandom = 0.99;
let game;
try {
  Math.random = () => forcedRandom == null ? nativeRandom() : forcedRandom;
  game = loadGame();
} finally { Math.random = nativeRandom; }
const { SA, context } = game;
if (process.argv.includes('--baseline')) {
  try {
    Math.random = () => forcedRandom == null ? nativeRandom() : forcedRandom;
    for (const file of ['vehicle', 'battle']) vm.runInContext(execFileSync('git', ['show', `HEAD:js/${file}.js`], { encoding: 'utf8' }), context);
  } finally { Math.random = nativeRandom; }
}
// 仅在测试 VM 中开放两个画面层局部函数，验证沙漏与组装填条读到的同一状态。
const viewSource = fs.readFileSync(path.join(__dirname, '../js/battle-view.js'), 'utf8');
const testViewSource = viewSource.replace(/  return \{\r?\n    supportsSurrenderAnimation:/, '  return { reloadFrac, groupReload,\n    supportsSurrenderAnimation:');
assert.notStrictEqual(testViewSource, viewSource, '装填提示测试入口失效');
vm.runInContext(testViewSource, context);
const view = SA.BattleView.create({});

/** 用相同的供能底座构造不同驾驶员和武器数量，避免装填比较混入动力差异。 */
function vehicle(drivers, weapons) {
  const v = SA.V.create('驾驶员检查');
  for (let c = 0; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][0] = SA.newCell('boiler', 6);
  if (drivers === 4) v.body[8][2] = SA.newCell('cockpit', 6);
  else if (drivers === 2) v.body[7][2] = SA.newCell('cockpit_pair', 6);
  else v.body[7][2] = SA.newCell('helmet', 6);
  const spots = [[7, 4], [5, 6], [7, 8], [5, 10], [7, 12]];
  weapons.forEach((id, i) => { const [r, c] = spots[i]; v.body[r][c] = SA.newCell(id, 6); });
  return v;
}

/** 固定空炮计时器后推进真实战斗一帧，以实际供能折算每门炮的装填进度。 */
function rates(drivers, weapons, selected = null) {
  const v = vehicle(drivers, weapons);
  SA.go = () => {};
  SA.S.reset(); SA.S.d.vehicle = v;
  SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(1, []), terrain: 'flat', boss: true });
  const B = SA.Battle.debug.B;
  B.headless = true;
  assert(B.p.weapons.every(w => B.p.timers[w.key] === 0), '开场武器未满装');
  if (selected) B.p.sel = selected;
  B.p.weapons.forEach(w => { B.p.timers[w.key] = B.p.reloadTotals[w.key] = 10; });
  SA.Battle.debug.step(1 / 60);
  return { side: B.p, rates: B.p.weapons.map(w => ({ id: w.cell.id, rate: (10 - B.p.timers[w.key]) * 60 / B.p.power })) };
}
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

near(rates(1, ['mortar_s']).rates[0].rate, 1);
const five = rates(1, Array(5).fill('mortar_s'));
five.rates.forEach((w, i) => near(w.rate, i === 0 ? 1 : 0));
rates(2, ['mortar_s', 'mortar_s', 'mortar_s']).rates.forEach((w, i) => near(w.rate, i < 2 ? 1 : 0));
rates(4, Array(5).fill('mortar_s')).rates.forEach((w, i) => near(w.rate, i < 4 ? 1 : 0));
near(rates(2, ['mortar_s']).rates[0].rate, 1.5);
near(rates(4, ['mortar_s']).rates[0].rate, 1.5);
rates(4, ['mortar_s', 'mortar_s']).rates.forEach(w => near(w.rate, 1.5));
const dual = rates(2, ['mortar_s', 'mg']);
near(dual.rates.find(w => w.id === 'mortar_s').rate, 1);
near(dual.rates.find(w => w.id === 'mg').rate, 1);
assert(dual.side.coGroups.includes('mg'));
const grouped = rates(2, ['mortar_s', 'mg', 'mg']);
near(grouped.rates.find(w => w.id === 'mortar_s').rate, 1);
grouped.rates.filter(w => w.id === 'mg').forEach((w, i) => near(w.rate, i === 0 ? 1 : 0));
const switched = rates(2, ['mortar_s', 'mg', 'mg'], 'mg');
near(switched.rates.find(w => w.id === 'mortar_s').rate, 1);
switched.rates.filter(w => w.id === 'mg').forEach((w, i) => near(w.rate, i === 0 ? 1 : 0));

// 跨武器及随机周期按已完成百分比挑选，不能只比较剩余秒数或出厂装填时间。
const prioritised = rates(1, ['mortar_s', 'mg', 'mortar_s']).side;
const [slow, quick, varied] = prioritised.weapons;
prioritised.timers[slow.key] = 4; prioritised.reloadTotals[slow.key] = 10;   // 60%
prioritised.timers[quick.key] = 1; prioritised.reloadTotals[quick.key] = 2; // 50%
prioritised.timers[varied.key] = 3; prioritised.reloadTotals[varied.key] = 20; // 85%，周期含随机倍率
assert(SA.Battle.reloadProgress(prioritised, varied) > SA.Battle.reloadProgress(prioritised, slow));
SA.Battle.debug.step(1 / 60);
assert(prioritised.timers[varied.key] < 3, '最高真实完成百分比未优先装填');
near(prioritised.timers[slow.key], 4);
near(prioritised.timers[quick.key], 1);
// 完成的武器不占驾驶员；并列时抽签，第二名驾驶员不会重复分配同一门。
prioritised.timers[varied.key] = 0;
SA.Battle.debug.step(1 / 60);
assert(prioritised.timers[slow.key] < 4 && prioritised.timers[quick.key] === 1);
const tied = rates(2, ['mortar_s', 'mortar_s', 'mortar_s']).side;
tied.weapons.forEach(w => { tied.timers[w.key] = tied.reloadTotals[w.key] = 10; });
forcedRandom = 0;
SA.Battle.debug.step(1 / 60);
near(tied.timers[tied.weapons[0].key], 10);
assert(tied.timers[tied.weapons[1].key] < 10 && tied.timers[tied.weapons[2].key] < 10, '并列抽签未选后排两门或重复占用');
forcedRandom = 0.99;
const hudSide = rates(1, ['mortar_s', 'mortar_s']).side;
hudSide.timers[hudSide.weapons[0].key] = 0;
hudSide.timers[hudSide.weapons[1].key] = 7;
near(view.groupReload(hudSide, 'mortar_s'), 1);
assert.strictEqual(view.reloadFrac(hudSide), null, '组内有满装炮时仍显示沙漏');
hudSide.weapons[0].blocked = true;
near(view.groupReload(hudSide, 'mortar_s'), 1);
assert.strictEqual(view.reloadFrac(hudSide), null, '被挡住但满装的炮被误判为未装弹');
hudSide.timers[hudSide.weapons[0].key] = 5;
near(view.reloadFrac(hudSide), 0.5);
near(view.groupReload(hudSide, 'mortar_s'), 0.5);

// 同组五门炮开场满装，手操首轮同时开火；之后只有占到驾驶员的空炮推进。
const volleyVehicle = vehicle(1, []);
for (let c = 4; c <= 12; c += 2) volleyVehicle.side[7][c] = SA.newCell('mg', 6);
SA.S.reset(); SA.S.d.vehicle = volleyVehicle;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(1, []), terrain: 'flat', boss: true });
const volley = SA.Battle.debug.B;
volley.headless = true;
volley.aim = [500, 200];
volley.p.release = true;
SA.Battle.debug.step(1 / 60);
assert.strictEqual(volley.p.events.fire, 5, '首轮五门炮没有同时开火');
assert(volley.p.weapons.every(w => volley.p.reloadTotals[w.key] === volley.p.timers[w.key] && volley.p.timers[w.key] > 0), '齐射后未记录真实周期');
volley.keys.fire = false;
const beforeReload = volley.p.weapons.map(w => volley.p.timers[w.key]);
SA.Battle.debug.step(1 / 60);
volley.p.weapons.forEach((w, i) => assert(i === 0 ? volley.p.timers[w.key] < beforeReload[i] : volley.p.timers[w.key] === beforeReload[i]));
volley.p.timers[volley.p.weapons[0].key] = 0;
volley.p.release = true;
volley.aim = [500, 200];
SA.Battle.debug.step(1 / 60);
assert.strictEqual(volley.p.events.fire, 6, '先装好的单炮未独立开火');
assert.strictEqual(volley.p.reloadTotals[volley.p.weapons[0].key], volley.p.timers[volley.p.weapons[0].key], '重发炮未记录新周期');
assert.strictEqual(SA.V.crewPlan(volley.p.weapons, 0, volley.p.sel).loaders, 0);

// 装弹机只加速所挂的大型武器，不改变一名驾驶员同时只装一门的上限。
const assisted = vehicle(1, ['mg_heavy', 'mg_heavy']);
assisted.side[7][4] = SA.newCell('autoloader', 6);
SA.S.reset(); SA.S.d.vehicle = assisted;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(1, []), terrain: 'flat', boss: true });
const assistState = SA.Battle.debug.B;
assistState.headless = true;
assert.strictEqual(assistState.p.weapons.filter(w => w.m.reload < SA.mod('mg_heavy', 6).reload).length, 1);
assert.strictEqual(assistState.p.weapons.filter(w => w.m.reload === SA.mod('mg_heavy', 6).reload).length, 1);
assistState.p.weapons.forEach(w => { assistState.p.timers[w.key] = 10; });
SA.Battle.debug.step(1 / 60);
near((10 - assistState.p.timers[assistState.p.weapons[0].key]) * 60 / assistState.p.power, 1);
near((10 - assistState.p.timers[assistState.p.weapons[1].key]) * 60 / assistState.p.power, 0);
const originalCrewPlan = SA.V.crewPlan;
try {
  SA.V.crewPlan = (...args) => ({ ...originalCrewPlan(...args), loaders: 0 });
  assistState.p.weapons.forEach(w => { assistState.p.timers[w.key] = 10; });
  SA.Battle.debug.step(1 / 60);
  assistState.p.weapons.forEach(w => near(assistState.p.timers[w.key], 10));
} finally { SA.V.crewPlan = originalCrewPlan; }

// 驾驶舱或武器在战斗中被毁后，下一帧必须重算人数与实体炮数。
const damaged = vehicle(2, ['mortar_s', 'mg', 'mg']);
damaged.body[5][2] = SA.newCell('cockpit_pair', 6);
SA.S.reset(); SA.S.d.vehicle = damaged;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(1, []), terrain: 'flat', boss: true });
let state = SA.Battle.debug.B;
state.headless = true;
function tickRates() {
  state.p.weapons.forEach(w => { state.p.timers[w.key] = 10; });
  SA.Battle.debug.step(1 / 60);
  return state.p.weapons.map(w => ({ id: w.cell.id, rate: (10 - state.p.timers[w.key]) * 60 / state.p.power }));
}
tickRates().map(w => w.rate).sort((a, b) => a - b).forEach((rate, i) => near(rate, i === 2 ? 1.5 : 1));
let lostCockpit;
SA.V.each(state.p.v, (cell, r, c, layer) => { if (layer === 'body' && cell.id === 'cockpit_pair' && r === 5) lostCockpit = { r, c }; });
assert(lostCockpit);
SA.Battle.debug.damage('p', lostCockpit.r, lostCockpit.c, 'body', 10000);
tickRates().forEach((w, i) => near(w.rate, i < 2 ? 1 : 0));
const lostWeapon = state.p.weapons.find(w => w.cell.id === 'mg');
SA.Battle.debug.damage('p', lostWeapon.r, lostWeapon.c, lostWeapon.layer, 10000);
near(tickRates()[0].rate, 1);
assert(!state.p.weapons.some(w => w.key === lostWeapon.key), '已毁武器仍占驾驶员装填名额');

const mixed = vehicle(2, ['mortar_s', 'mg']);
const auto = SA.Battle.simulate({ p: mixed, e: mixed, terrain: 'flat', seed: 7 });
assert(auto.effectStats.p.mortar_s.fire > 0 && auto.effectStats.p.mg.fire > 0, '异种武器没有同时开火');

// 纸面持续火力与产热按同一装填倍率计算；供能差异先除去 s.power 比较。
const one = SA.V.stats(vehicle(1, ['mortar_s']));
const two = SA.V.stats(vehicle(1, ['mortar_s', 'mortar_s']));
const four = SA.V.stats(vehicle(4, ['mortar_s']));
near(two.salvoDps / two.power, one.salvoDps / one.power);
near(two.heatDps / two.power, one.heatDps / one.power);
near(four.salvoDps / four.power, 1.5 * one.salvoDps / one.power);
near(four.heatDps / four.power, 1.5 * one.heatDps / one.power);
for (const s of [one, two, four]) near(s.heatGen - s.boilerHeat, s.heatDps);
const mixStats = SA.V.stats(mixed);
const mortar = SA.mod('mortar_s', 6), mg = SA.mod('mg', 6);
near(mixStats.salvoDps / mixStats.power, mortar.dmg / mortar.reload + mg.dmg / mg.reload);
near(mixStats.heatDps / mixStats.power, mortar.heat / mortar.reload + mg.heat / mg.reload);
near(mixStats.heatGen - mixStats.boilerHeat, mixStats.heatDps);

// 两种摆放顺序都要拒绝；直接写入的旧布局同时在出战和实战标为不可发射。
const top = vehicle(1, ['mortar_s']);
assert(!SA.V.canPut(top, 'armor', 5, 4).ok);
assert(!SA.V.canPlace(top, 'armor', 5, 4).ok);
top.body[5][8] = SA.newCell('armor', 6);
assert(!SA.V.move(top, 'body', 5, 8, 5, 4).ok);
assert(top.body[5][8]?.id === 'armor' && !top.body[5][4]);
const bottom = vehicle(1, []);
bottom.body[5][4] = SA.newCell('armor', 6);
assert(!SA.V.canPut(bottom, 'mortar_s', 7, 4).ok);
assert(!SA.V.canPlace(bottom, 'mortar_s', 7, 4).ok);
bottom.body[7][4] = SA.newCell('mortar_s', 6);
assert(SA.V.issues(bottom).some(x => x.r === 7 && x.c === 4));
assert(SA.V.blockedList(bottom).some(x => x.r === 7 && x.c === 4));
SA.S.reset(); SA.S.d.vehicle = bottom;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: vehicle(1, []), terrain: 'flat', boss: true });
state = SA.Battle.debug.B;
state.headless = true;
assert(state.p.weapons.find(w => w.cell.id === 'mortar_s').blocked, '旧车炮顶遮挡仍可开火');
const blockedWeapon = state.p.weapons.find(w => w.cell.id === 'mortar_s');
state.p.timers[blockedWeapon.key] = 10;
SA.Battle.debug.step(1 / 60);
assert(state.p.timers[blockedWeapon.key] < 10, '炮顶遮挡使空炮无法装填');
let blocker;
SA.V.each(state.p.v, (cell, r, c, layer) => { if (layer === 'body' && cell.id === 'armor' && r === 5) blocker = { r, c }; });
assert(blocker);
SA.Battle.debug.damage('p', blocker.r, blocker.c, 'body', 10000);
assert(!state.p.weapons.find(w => w.cell.id === 'mortar_s').blocked, '挡物损毁后炮口未恢复');

// 当前值、出厂值及纸面统计使用同一组热量和储水数据。
for (const [id, mod] of Object.entries(SA.MODULES)) {
  const defaults = SA.MODULE_DEFAULTS[id];
  if (mod.dmg && mod.heat) near(mod.heat, defaults.heat);
  if (mod.dmg && mod.heatPerSec) near(mod.heatPerSec, defaults.heatPerSec);
  if (mod.water) near(mod.water, defaults.water);
}
return { crew: true, automaticFire: true, clearance: true, heatWater: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
