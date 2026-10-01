/* 四种间接高抛炮的近距射界回归：正式战斗初始化、瞄准求解和实射出膛共用同一套物理。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 收集战斗向画面层提供的正式接口，不增加测试专用生产出口。 */
function runtime() {
  const { SA, context } = loadGame();
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  SA.S.reset();
  return { SA, api };
}

/** 用可出战车辆分别装载四种武器，避免悬空或供能问题干扰射界检查。 */
function vehicle(SA, id) {
  const v = SA.V.create(`近距高抛检查 ${id}`);
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[id === 'mortar_s' ? 7 : 6][4] = SA.newCell(id, 6);
  v.body[8][2] = SA.newCell('boiler', 6);
  if (id !== 'cannon_giant') v.body[8][4] = SA.newCell('boiler', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][10] = SA.newCell('boiler', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[7][2] = SA.newCell('helmet', 6);
  assert(SA.V.stats(v).canDeploy, `${id} 夹具不可出战`);
  return v;
}

/** 前方近点从炮口外 1.1px 起可达，坡地两侧均落在同一目标高度。 */
function nearArcs(SA, api, id) {
  const v = vehicle(SA, id);
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, terrain: 'flat', boss: true });
  B.headless = true;
  let cases = 0, maxError = 0;
  for (const [side, dir] of [[B.p, 1], [B.e, -1]]) {
    const gun = side.weapons.find(w => w.cell.id === id);
    assert(gun && gun.m.indirect && gun.m.elev[1] === 90, `${id} 未启用 90° 高抛射界`);
    const maxSlope = SA.K.BATTLE.SETTLE_TILT_MAX;
    for (const slope of [-maxSlope, -0.15, 0, 0.15, maxSlope]) {
      side.kw = slope;
      const upper = gun.m.elev[1] - (dir === 1 ? -1 : 1) * Math.atan(slope) * 180 / Math.PI;
      const mouth = api.muzzle(side, gun, upper);
      for (const distance of [1.1, 20, 48, 90]) {
        const point = [mouth[0] + dir * distance, mouth[1]];
        const aim = api.aimAngle(side, gun, ...point);
        assert(aim.reach && !aim.over && !aim.behind, `${id} ${dir} ${slope} ${distance}px 前方近点不可达`);
        const shot = api.launch(side, gun, aim.a, 0);
        assert(shot.vx * dir > 0, `${id} 近点弹道向后发射`);
        const time = (point[0] - shot.x) / shot.vx;
        const landing = shot.y + shot.vy * time + shot.g * time * time / 2;
        const error = Math.abs(landing - point[1]);
        assert(error < 1, `${id} ${distance}px 落点偏差 ${error}px`);
        assert(Math.abs(Math.atan2(-shot.vy, shot.vx * dir) * 180 / Math.PI) <= 90.001, `${id} 世界仰角越界`);
        maxError = Math.max(maxError, error);
        cases++;
      }
    }
    side.kw = 0;
    const mouth = api.muzzle(side, gun);
    assert(api.aimAngle(side, gun, mouth[0] - dir * 20, mouth[1]).behind, `${id} 炮口后方误判可射`);
    assert(!api.aimAngle(side, gun, mouth[0] + dir * 1600, mouth[1]).reach, `${id} 超远目标误判可射`);
  }
  return { cases, maxError };
}

/** 前方 90px 目标逐帧开火，确保近距射界能进入真实发射路径。 */
function firing(SA, api, id) {
  const v = vehicle(SA, id);
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, terrain: 'flat', boss: true });
  B.headless = true;
  B.e.speed = 0;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  const gun = B.p.weapons.find(w => w.cell.id === id);
  const mouth = api.muzzle(B.p, gun);
  const point = [mouth[0] + 90, mouth[1]];
  B.aim = point;
  B.keys.fire = true;
  B.p.prism = true;
  B.p.focus = 1;
  B.p.lastSel = B.p.sel;
  B.p.timers[gun.key] = 0;
  B.p.elev[gun.key] = gun.m.elev[0];
  assert(api.aimAngle(B.p, gun, ...point).reach, `${id} 前方近目标不可达`);
  for (let i = 0; i < 600 && !B.p.events.fire; i++) {
    B.aim = point;
    B.p.focus = 1;
    api.step(1 / 60);
  }
  assert(B.p.events.fire > 0, `${id} 转炮后未实际开火`);
  assert(B.shots.some(shot => shot.from === B.p && shot.vx > 0 && shot.vy < 0), `${id} 未向前上方出膛`);
  return B.t;
}

/** 小臼炮贴近前沿，射击旧 82° 上限打不到的敌车，验证实际弹丸扣血。 */
function nearHit(SA, api) {
  const id = 'mortar_s';
  const v = vehicle(SA, id);
  v.body[7][4] = null;
  v.body[7][12] = SA.newCell(id, 6);
  assert(SA.V.stats(v).canDeploy, '近距命中夹具不可出战');
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, terrain: 'flat', boss: true });
  B.headless = true;
  B.p.speed = B.e.speed = 0;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  const gun = B.p.weapons.find(w => w.cell.id === id);
  const enemyGun = B.e.weapons.find(w => w.cell.id === id);
  const mouth = api.muzzle(B.p, gun);
  const original = api.modCenter(B.e, 'body', enemyGun.r, enemyGun.c);
  const shift = mouth[0] + 90 - original[0];
  B.e.x += shift;
  B.e.pivX += shift;
  const target = api.modCenter(B.e, 'body', enemyGun.r, enemyGun.c);
  const current = api.aimAngle(B.p, gun, ...target);
  const oldGun = { ...gun, m: { ...gun.m, elev: [gun.m.elev[0], 82] } };
  const old = api.aimAngle(B.p, oldGun, ...target);
  assert(current.reach && !current.over && (old.over === 'high' || !old.reach), '命中点未处于新扩展的射界');
  const before = enemyGun.cell.hp;
  B.aim = target;
  B.keys.fire = true;
  B.p.prism = true;
  B.p.focus = 1;
  B.p.lastSel = B.p.sel;
  B.p.timers[gun.key] = 0;
  for (let i = 0; i < 600 && enemyGun.cell.hp === before; i++) {
    B.aim = api.modCenter(B.e, 'body', enemyGun.r, enemyGun.c);
    B.p.focus = 1;
    api.step(1 / 60);
  }
  assert(B.p.events.fire > 0 && B.p.events.highHit > 0 && enemyGun.cell.hp < before, '小臼炮近距实弹未击伤目标模块');
  return { old, new: current, fire: B.p.events.fire, highHit: B.p.events.highHit, damage: before - enemyGun.cell.hp };
}

/** 即使目标在新射界内，供汽归零仍不得绕过原有开火门槛。 */
function noPower(SA, api, id) {
  const v = vehicle(SA, id);
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, terrain: 'flat', boss: true });
  B.headless = true;
  const gun = B.p.weapons.find(w => w.cell.id === id);
  const mouth = api.muzzle(B.p, gun);
  B.aim = [mouth[0] + 90, mouth[1]];
  B.keys.fire = true;
  B.p.focus = 1;
  B.p.lastSel = B.p.sel;
  B.p.timers[gun.key] = 0;
  B.p.supply = 0;
  B.p.store = 0;
  for (let i = 0; i < 120; i++) api.step(1 / 60);
  assert.strictEqual(B.p.events.fire, 0, `${id} 断汽后仍开火`);
}

function run() {
  const { SA, api } = runtime();
  const result = {};
  for (const id of ['cannon_giant', 'mortar', 'mortar_s', 'rocket_rack']) {
    result[id] = { near: nearArcs(SA, api, id), firedAt: firing(SA, api, id) };
    noPower(SA, api, id);
  }
  result.nearHit = nearHit(SA, api);
  return result;
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
