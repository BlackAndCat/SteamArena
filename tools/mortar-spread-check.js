/* 两种臼炮的数值散布与实射边界回归。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

function run() {
  // 战斗脚本会在加载时捕获随机源；固定序列保证偏弹边界检查可复现。
  const nativeRandom = Math.random;
  let seed = 20261003;
  const fixedRandom = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let game, api;
  try {
    Math.random = fixedRandom;
    game = loadGame();
    game.SA.BattleView = { create(value) { api = value; return null; } };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), game.context);
  } finally { Math.random = nativeRandom; }
  const { SA, context } = game;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'module-editor-schema.js'), 'utf8'), context);
  assert(!SA.validateModuleOverrides('mortar', { spreadMin: 13 }).ok, '工作台允许下限高于上限');
  assert(SA.validateModuleOverrides('mortar', { spreadMin: 4, spread: 10 }).ok, '工作台拒绝合法散布区间');
  SA.go = () => {};
  SA.S.reset();
  const car = (id, accessory = false) => {
    const v = SA.V.create('散布检查');
    for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
    v.body[8][2] = SA.newCell('boiler', 6);
    v.body[7][2] = SA.newCell('helmet', 6);
    v.body[7][4] = SA.newCell(id, 6);
    if (accessory) v.body[6][0] = SA.newCell('rangefinder', 6);
    return v;
  };
  const start = (id, accessory = false) => {
    SA.S.d.vehicle = car(id, accessory);
    const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: car('mg'), terrain: 'flat', boss: true });
    B.headless = true;
    return { B, w: B.p.weapons.find(w => w.cell.id === id) };
  };
  const near = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  for (const id of ['mortar', 'mortar_s']) {
    const { B, w } = start(id);
    near(w.m.spreadMin, 3); near(w.m.spread, 12);
    const raw = api.spreadDeg(B.p, B.e, w, 0);
    assert(raw >= 3 && raw <= 12 && raw > 0, `${id} 默认散布不在区间内`);
    B.p.jolt = 100;
    near(api.spreadDeg(B.p, B.e, w, 0), 12);
    B.p.jolt = 0;
    B.p.aimShrink = 1;
    near(api.spreadDeg(B.p, B.e, w, 1), 3);
    B.p.prism = true;
    near(api.spreadDeg(B.p, B.e, w, 1), 0);
    B.p.prism = false;
    // 作者改上下限后，同一计算同时控制预览扇区和实际 launch 偏角。
    w.m = { ...w.m, spreadMin: 5, spread: 8 };
    near(api.spreadDeg(B.p, B.e, w, 0), 8);
    near(api.spreadDeg(B.p, B.e, w, 1), 5);
    const base = 55, half = api.spreadDeg(B.p, B.e, w, 0);
    const low = api.launch(B.p, w, base, -half), high = api.launch(B.p, w, base, half);
    assert(Math.abs(low.vy - high.vy) > 1 && low.vx !== high.vx, `${id} 实际弹道未随散布变化`);
    const fired = [];
    let wildAtEdge = false;
    for (let i = 0; i < 20; i++) {
      const shotState = start(id);
      if (i >= 10) shotState.w.m = { ...shotState.w.m, wild: 1 };
      const muzzle = api.muzzle(shotState.B.p, shotState.w);
      const point = [muzzle[0] + 220, muzzle[1] + 30];
      const aim = api.aimAngle(shotState.B.p, shotState.w, ...point);
      assert(aim.reach && !aim.over && !aim.behind, `${id} 实射夹具不在射界内`);
      shotState.B.aim = point;
      shotState.B.p.elev[shotState.w.key] = aim.a;
      shotState.B.p.lastSel = shotState.B.p.sel;
      shotState.B.p.release = true;
      const spreadAtFire = api.spreadDeg(shotState.B.p, shotState.B.e, shotState.w);
      api.step(1 / 60);
      const shot = shotState.B.shots.find(q => q.from === shotState.B.p);
      assert(shot, `${id} 未产生实射炮弹`);
      const actual = Math.atan2(-(shot.vy - shot.g / 60), shot.vx) * 180 / Math.PI;
      const center = api.barrel(shotState.B.p, shotState.w);
      assert(actual >= shotState.w.m.elev[0] - 1e-8 && actual <= shotState.w.m.elev[1] + 1e-8, `${id} 实射散布越出射界`);
      assert(Math.abs(actual - center) <= spreadAtFire + 1e-8, `${id} 实射偏角超出预览扇区：${JSON.stringify({ actual, center, spreadAtFire, aim: aim.a, wild: shotState.w.m.wild })}`);
      if (i >= 10 && Math.abs(actual - center) >= spreadAtFire - 1e-8) wildAtEdge = true;
      fired.push(actual);
    }
    assert(new Set(fired.map(x => x.toFixed(4))).size > 1, `${id} 多发实射仍无随机散布`);
    assert(wildAtEdge, `${id} 偏弹夹具未覆盖散布上限`);
    const assisted = start(id, true);
    near(assisted.w.m.spreadMin, 3 * 0.85);
    near(assisted.w.m.spread, 12 * 0.85);
  }
  const direct = start('cannon');
  assert(!('spreadMin' in direct.w.m) && api.spreadDeg(direct.B.p, direct.B.e, direct.w, 0) > 0, '直射散布被更改');
  const giant = start('cannon_giant');
  near(api.spreadDeg(giant.B.p, giant.B.e, giant.w, 0), 0);
  return { mortars: 2, auxiliary: true, direct: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
