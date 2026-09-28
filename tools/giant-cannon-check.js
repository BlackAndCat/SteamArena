/*
 * 巨炮高抛回归：使用正式战斗初始化、视图接口和逐帧更新，检查弹道、射界及开火时机。
 * 视图只被替换为接口收集器，所有物理、伤害和 AI 仍执行 js/battle.js。
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 捕获现有画面接口，避免为检查脚本向生产代码添加测试专用出口。 */
function runtime() {
  const { SA, context } = loadGame();
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  SA.S.reset();
  return { SA, api };
}

/** 巨炮后排射击夹具：炮口前方留有装甲，验证间接火力不走直射遮挡规则。 */
function vehicle(SA) {
  const v = SA.V.create('巨炮高抛检查');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[6][4] = SA.newCell('cannon_giant', 6);
  v.body[8][2] = SA.newCell('boiler', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][10] = SA.newCell('boiler', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[7][2] = SA.newCell('helmet', 6);
  assert(SA.V.stats(v).canDeploy, '巨炮夹具不能出战');
  assert(!SA.V.blockedList(v).length, '巨炮仍被当作直射武器挡住');
  return v;
}

/** 每个场景独立开局，冻结敌车的移动/开火，保留可被命中的实体。 */
function start(SA, api, v) {
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, enemyName: '高抛目标', terrain: 'flat', boss: true });
  B.headless = true;
  B.e.speed = 0;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  const w = B.p.weapons.find(item => item.cell.id === 'cannon_giant');
  const ew = B.e.weapons.find(item => item.cell.id === 'cannon_giant');
  return { B, w, ew };
}

/** 在两种朝向与上/下坡姿态下，解析落点必须与瞄准点一致，近远盲区必须被识别。 */
function trajectories(SA, api, v) {
  const { B, w, ew } = start(SA, api, v);
  let count = 0, errorMax = 0;
  for (const [s, gun, dir] of [[B.p, w, 1], [B.e, ew, -1]]) {
    for (const pitch of [-0.15, 0, 0.15]) for (const dx of [200, 400, 600]) {
      s.kw = pitch;
      s.elev[gun.key] = gun.m.rest;
      const initial = api.muzzle(s, gun), target = [initial[0] + dir * dx, initial[1] + 30];
      const aim = api.aimAngle(s, gun, ...target);
      if (!aim.reach || aim.over) continue;
      const origin = api.muzzle(s, gun, aim.a);
      const angle = aim.a * Math.PI / 180 - dir * Math.atan(pitch);
      const time = (target[0] - origin[0]) / (dir * gun.m.v * Math.cos(angle));
      const y = origin[1] - gun.m.v * Math.sin(angle) * time + SA.K.GRAVITY * gun.m.g * time * time / 2;
      const error = Math.abs(y - target[1]);
      assert(error < 1, `炮口迭代落点偏差过大：${error}px`);
      errorMax = Math.max(errorMax, error);
      count++;
    }
    s.kw = 0;
    const origin = api.muzzle(s, gun);
    const near = api.aimAngle(s, gun, origin[0] + dir * 20, origin[1]);
    const far = api.aimAngle(s, gun, origin[0] + dir * 1600, origin[1]);
    assert(near.over === 'high', '近端盲区没有限制');
    assert(!far.reach, '超过最大射程仍判定可达');
  }
  assert(count >= 10, '实际仰角未提供足够的高抛射界，请先接入 Opus 的角度配置');
  return { cases: count, errorMax };
}

/** 首发必须等到炮管到位；发射时上行，命中时从空中落到敌车。 */
function firing(SA, api, v, copilot = false) {
  if (copilot) {
    v = SA.V.clone(v);
    v.body[7][2] = null;
    v.body[6][2] = SA.newCell('cockpit_pair', 6);
    v.body[6][10] = SA.newCell('mg', 6);
  }
  const { B, w, ew } = start(SA, api, v);
  const target = api.modCenter(B.e, 'body', ew.r, ew.c);
  if (copilot) {
    B.p.sel = 'mg';
    B.p.co = { target: { layer: 'body', r: ew.r, c: ew.c }, retarget: 100, err: { x: 0, y: 0 } };
  }
  B.aim = target;
  B.keys.fire = !copilot;
  B.p.focus = 1;
  B.p.lastSel = B.p.sel;
  B.p.timers[w.key] = 0;
  B.p.elev[w.key] = w.m.elev[0];
  const wanted = api.aimAngle(B.p, w, ...target);
  assert(wanted.reach && !wanted.over, `默认交战距离不在巨炮高抛射界内：${JSON.stringify({ wanted, muzzle: api.muzzle(B.p, w), target })}`);
  const turnTime = Math.abs(wanted.a - w.m.elev[0]) / w.m.slew;
  api.step(1 / 60);
  assert.strictEqual(B.p.events.fire, 0, '巨炮在转炮首帧就开火');
  let first = null;
  for (let i = 0; i < 600 && !B.p.events.highHit; i++) {
    B.aim = target;
    B.p.focus = 1;
    api.step(1 / 60);
    const shot = B.shots.find(sh => sh.from === B.p);
    if (!first && shot) {
      first = { time: B.t, vy: shot.vy };
      B.keys.fire = false;
    }
  }
  assert(first && first.vy < 0, '未生成向上飞行的巨炮炮弹');
  assert(first.time >= turnTime - 0.05, '尚未完成转炮便发射');
  assert(B.p.events.highHit > 0 && B.p.dealt > 0, '高抛炮弹没有落到敌车并造成伤害');
  return { firstShot: first, highHits: B.p.events.highHit, damage: B.p.dealt };
}

/** AI 在近端盲区后退、超出射程前进；装填完也不会向不可达目标空射。 */
function rangeControl(SA, api, v) {
  const result = [];
  for (const [distance, direction] of [[90, -1], [1600, 1]]) {
    const { B, w, ew } = start(SA, api, v);
    B.p.isAI = true;
    B.p.target = { layer: 'body', r: ew.r, c: ew.c };
    B.p.retarget = 100;
    B.p.moveT = 100;
    B.p.charge = true;
    B.p.heldT = 100;
    B.p.lastSel = B.p.sel;
    B.p.timers[w.key] = 0;
    const muzzle = api.muzzle(B.p, w), target = api.modCenter(B.e, 'body', ew.r, ew.c);
    B.e.x += muzzle[0] + distance - target[0];
    B.e.pivX += muzzle[0] + distance - target[0];
    api.step(1 / 60);
    assert.strictEqual(B.p.dir, direction, `AI 在距离 ${distance} 时移动方向错误`);
    assert.strictEqual(B.p.events.fire, 0, 'AI 向射界外的目标空射');
    result.push({ distance, direction });
  }
  return result;
}

function run() {
  const { SA, api } = runtime();
  const giant = SA.MODULES.cannon_giant;
  assert(giant.indirect && giant.arc === 'high', '巨炮还没有改成间接高抛');
  const v = vehicle(SA);
  const ai = SA.Battle.simulate({ p: v, e: v, seed: 928, pStyle: 'turtle', eStyle: 'turtle' });
  assert(ai.events.p.fire > 0 && ai.events.e.fire > 0 && ai.events.p.highHit + ai.events.e.highHit > 0, '双向 AI 巨炮对战没有完成高抛命中');
  return { trajectories: trajectories(SA, api, v), firing: firing(SA, api, v), copilot: firing(SA, api, v, true),
    rangeControl: rangeControl(SA, api, v), ai: { fire: [ai.events.p.fire, ai.events.e.fire], highHit: [ai.events.p.highHit, ai.events.e.highHit] } };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
