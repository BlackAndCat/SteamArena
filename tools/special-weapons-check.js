/* 特殊武器回归：真实战斗逐帧验收抛射、鱼叉目标坐标，以及喷射武器的材料、库存和旧档闭环。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

/** 捕获生产画面接口，所有战斗状态仍由正式 battle.js 更新。 */
function runtime() {
  const { SA, context } = evolve.loadGame();
  // 无界面夹具仍使用真实像素 UI，供材料回归的设计模式退出路径调用。
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-px.js'), 'utf8'), context, { filename: 'js/ui-px.js' });
  context.document.documentElement.style.setProperty = () => {};
  const memory = new Map();
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  SA.S.reset();
  return { SA, api };
}

/** 留有充足动力和耐久的夹具：抛射件在后排，鱼叉在前排。 */
function vehicle(SA, id) {
  const v = SA.V.create('特殊武器检查');
  for (let c = 2; c <= 12; c += 2) v.body[10][c] = SA.newCell('track', 6);
  v.body[8][2] = SA.newCell('boiler', 6);
  v.body[8][4] = SA.newCell('boiler', 6);
  v.body[8][8] = SA.newCell('water', 6);
  v.body[8][10] = SA.newCell('boiler', 6);
  v.body[8][12] = SA.newCell('armor', 6);
  v.body[7][2] = SA.newCell('helmet', 6);
  v.body[id === 'rocket_rack' ? 6 : 7][id === 'harpoon' ? 12 : 4] = SA.newCell(id, 6);
  assert(SA.V.stats(v).canDeploy, `${id} 夹具不能出战`);
  return v;
}

/** 冻结目标车，精确命中用棱镜消除随机散布；另行检查正常齐射散布仍存在。 */
function start(SA, api, id) {
  const v = vehicle(SA, id);
  SA.S.d.vehicle = v;
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: v, terrain: 'flat', boss: true });
  B.headless = true;
  B.e.speed = 0;
  B.e.aiProfile = { heatHoldHigh: -1, heatHoldLow: -2 };
  B.p.prism = true;
  if (id === 'harpoon') { B.e.x -= 180; B.e.pivX -= 180; }
  const w = B.p.weapons.find(x => x.cell.id === id), ew = B.e.weapons.find(x => x.cell.id === id);
  w.m = { ...w.m, wild: 0 };   // 精确命中夹具只去掉随机偏弹，正式模块配置不变。
  const target = api.modCenter(B.e, 'body', ew.r, ew.c);
  B.aim = target; B.keys.fire = true; B.p.focus = 1;
  B.p.timers[w.key] = 0; B.p.elev[w.key] = w.m.elev[0];
  return { B, w, ew, target };
}

/** 双朝向和坡地解析落点、首发转炮、四发延迟、高抛实伤与近远盲区。 */
function rocket(SA, api) {
  const { B, w, ew, target } = start(SA, api, 'rocket_rack');
  assert(w.m.indirect && w.m.arc === 'high' && w.m.elev[0] >= 18);
  assert(w.m.rest >= w.m.elev[0] && w.m.rest <= w.m.elev[1]);
  let cases = 0;
  for (const [s, gun, dir] of [[B.p, w, 1], [B.e, ew, -1]]) {
    for (const slope of [-0.12, 0, 0.12]) for (const dx of [300, 500, 800]) {
      s.kw = slope;
      const initial = api.muzzle(s, gun), point = [initial[0] + dir * dx, initial[1] + 30];
      const aim = api.aimAngle(s, gun, ...point);
      if (!aim.reach || aim.over) continue;
      const origin = api.muzzle(s, gun, aim.a), angle = aim.a * Math.PI / 180 - dir * Math.atan(slope);
      const t = (point[0] - origin[0]) / (dir * gun.m.v * Math.cos(angle));
      const y = origin[1] - gun.m.v * Math.sin(angle) * t + SA.K.GRAVITY * gun.m.g * t * t / 2;
      assert(Math.abs(y - point[1]) < 1, '抛射落点与移动炮口不一致');
      cases++;
    }
    s.kw = 0;
    const origin = api.muzzle(s, gun);
    assert.strictEqual(api.aimAngle(s, gun, origin[0] + dir * 20, origin[1]).over, 'high');
    assert(!api.aimAngle(s, gun, origin[0] + dir * 1600, origin[1]).reach);
  }
  assert(cases >= 14);
  B.p.prism = false;
  assert(api.spreadDeg(B.p, B.e, w, 1) > 0, '抛射架丢失原齐射散布');
  B.p.prism = true;
  B.p.elev[w.key] = w.m.elev[0];
  const aim = api.aimAngle(B.p, w, ...target), turnTime = (aim.a - w.m.elev[0]) / w.m.slew;
  api.step(1 / 60);
  assert.strictEqual(B.p.events.fire, 0, '未转炮就发射');
  let first = null;
  for (let i = 0; i < 600 && !B.p.events.highHit; i++) {
    B.aim = target; B.p.focus = 1; api.step(1 / 60);
    if (!first && B.p.events.fire) {
      first = B.t;
      const shots = B.shots.filter(sh => sh.from === B.p);
      assert.strictEqual(shots.length, 4);
      assert(shots.every(sh => sh.vx > 0 && sh.vy < 0), '四发没有向前上方出膛');
      assert(first >= turnTime - 0.05);
      B.keys.fire = false;
    }
  }
  assert(first && B.p.events.highHit > 0 && B.p.dealt > 0, '抛射未落到敌车并造成伤害');
  // 保留正常齐射散布时，所有偏弹仍在抬起的射界内；近远盲区的 AI 不得空射。
  const scattered = start(SA, api, 'rocket_rack');
  scattered.B.p.prism = false;
  scattered.B.p.lastSel = scattered.B.p.sel;
  scattered.B.p.elev[scattered.w.key] = api.aimAngle(scattered.B.p, scattered.w, ...scattered.target).a;
  for (let i = 0; i < 120 && !scattered.B.p.events.fire; i++) { scattered.B.aim = scattered.target; scattered.B.p.focus = 1; api.step(1/60); }
  const shots = scattered.B.shots.filter(sh => sh.from === scattered.B.p);
  assert.strictEqual(shots.length, 4);
  assert(shots.every(sh => sh.vx > 0 && sh.vy < 0));
  for (const [distance, direction] of [[90, -1], [1600, 1]]) {
    const scene = start(SA, api, 'rocket_rack');
    scene.B.p.isAI = true; scene.B.p.target = { layer: 'body', r: scene.ew.r, c: scene.ew.c };
    scene.B.p.retarget = 100; scene.B.p.moveT = 100; scene.B.p.charge = true;
    scene.B.p.heldT = 100; scene.B.p.lastSel = scene.B.p.sel;
    const origin = api.muzzle(scene.B.p, scene.w), point = api.modCenter(scene.B.e, 'body', scene.ew.r, scene.ew.c);
    scene.B.e.x += origin[0] + distance - point[0]; scene.B.e.pivX += origin[0] + distance - point[0];
    api.step(1/60);
    assert.strictEqual(scene.B.p.dir, direction); assert.strictEqual(scene.B.p.events.fire, 0);
  }
  const v = vehicle(SA, 'rocket_rack');
  const ai = SA.Battle.simulate({ p: v, e: v, seed: 930, pStyle: 'turtle', eStyle: 'turtle' });
  assert(ai.events.p.fire && ai.events.e.fire && ai.events.p.highHit + ai.events.e.highHit, '双向 AI 无高抛命中');
  return { trajectories: cases, firstShot: first, aiHits: [ai.events.p.highHit, ai.events.e.highHit] };
}

/** 实际鱼叉命中后，两端跟随镜像 / 位移 / 坡角；毁件、死亡、超距、超时立即隐藏。 */
function tether(SA, api) {
  const { B, w, target } = start(SA, api, 'harpoon');
  B.p.elev[w.key] = api.aimAngle(B.p, w, ...target).a;
  for (let i = 0; i < 120 && !B.p.tether; i++) { B.aim = target; B.p.focus = 1; api.step(1 / 60); }
  assert(B.p.tether, `真实鱼叉未拴住目标：${JSON.stringify({ fire: B.p.events.fire, hit: B.p.events.hit, target, muzzle: api.muzzle(B.p, w), shots: B.shots.map(sh => [sh.x, sh.y]), angle: api.barrel(B.p, w), positions: [B.p.x, B.e.x] })}`);
  const a = SA.Battle.tetherState('p');
  B.e.x += 30; B.e.pivX += 30; B.e.kw = 0.1;
  const b = api.tetherState(B.p);
  assert(b && Math.hypot(b.to[0] - a.to[0], b.to[1] - a.to[1]) > 5, '绳端没有跟随目标');
  assert.deepStrictEqual(b.to, api.modCenter(B.e, b.target.layer, b.target.r, b.target.c));
  assert.strictEqual(JSON.stringify(api.tetherState(B.p)), JSON.stringify(b), '读取接口修改状态');
  const t = B.p.tether, tc = B.e.v[t.layer][t.r][t.c];
  for (const [object, key, value] of [[tc, 'hp', 0], [w.cell, 'hp', 0], [B.e, 'dead', true], [t, 'time', 0], [B.e, 'x', B.p.x + 2000]]) {
    const old = object[key]; object[key] = value;
    assert.strictEqual(api.tetherState(B.p), null);
    object[key] = old;
  }
  B.e.tether = { ...t, cell: B.e.weapons[0].cell, target: B.p, r: w.r, c: w.c };
  assert.deepStrictEqual(api.tetherState(B.e).from, api.muzzle(B.e, B.e.weapons[0]));
  return { actualHit: true, tracking: true, invalidations: 5, mirrored: true };
}

/** 材料边界、带改装旧件、库存数量、重复读档、蓝图补购与敌车模块池。 */
function materials(SA) {
  SA.S.reset();
  const D = SA.S.d;
  D.money = 100000; D.camp.mods.push('steamjet', 'flamer'); D.camp.feat.push('shop'); D.camp.mat = 3;
  for (let mt = 1; mt <= 6; mt++) for (const id of ['steamjet', 'flamer']) {
    assert.strictEqual(SA.newCell(id, mt).id, mt < 4 ? 'steamjet' : 'flamer');
    const old = { id, mt, lv: 2, hp: Math.round(SA.mod(id, mt).hp * 1.6 / 2) };
    const ratio = old.hp / SA.V.maxHp(old);
    SA.fixCell(old);
    assert.strictEqual(old.mt, mt); assert.strictEqual(old.lv, 2);
    assert(Math.abs(old.hp / SA.V.maxHp(old) - ratio) < 0.01);
    const fixed = JSON.stringify(old); SA.fixCell(old); assert.strictEqual(JSON.stringify(old), fixed);
  }
  assert.strictEqual(SA.newCell('flamer').mt, 4, '无材料蓝图的喷火器没有从 T4 起');
  assert(!SA.S.buyable('flamer') && !SA.S.buy('flamer'));
  const steam = SA.newCell('steamjet', 3);
  assert(SA.S.matUpInfo(steam).max);
  assert.strictEqual(SA.S.upgradeMaterial(steam, { to: 4, mat: SA.MATS[4] }), false);
  const bp = SA.V.layout(vehicle(SA, 'flamer'));
  const decoded = SA.V.decode(SA.V.encode(vehicle(SA, 'flamer')));
  assert.strictEqual(SA.V.countIds(decoded).flamer, 1, '分享码把喷火器当成低档蒸汽件');
  assert(SA.S.Blueprints.plan(bp).blocked.length, '蓝图绕过喷火器材料门槛');
  D.camp.mat = 4;
  assert(SA.S.buyable('flamer') && SA.S.buy('flamer'));
  const plan = SA.S.Blueprints.plan(bp); assert(!plan.blocked.length);
  SA.S.addInv('flamer'); assert.strictEqual(SA.S.d.inv['flamer@4'], 2, '默认入库没有采用喷火器最低材料');
  SA.S.takeStock('flamer', 4);
  D.camp.mat = 3;
  // 当前库存有一件喷火器，允许复用；另一个蓝图缺件必须重新受材料门槛约束。
  bp.b.push([6, 6, 'flamer']);
  assert(SA.S.Blueprints.plan(bp).blocked.length);
  D.inv = { 'steamjet@6': 2, 'flamer@2': 3 };
  D.stockCells = [{ id: 'steamjet', mt: 6, lv: 2, hp: 100 }];
  D.vehicle.body[7][8] = { id: 'flamer', mt: 2, lv: 1, hp: 50 };
  SA.S.save(); SA.S.load();
  assert.strictEqual(SA.S.d.inv['flamer@6'], 2); assert.strictEqual(SA.S.d.inv['steamjet@2'], 3);
  assert.strictEqual(SA.S.d.stockCells[0].id, 'flamer');
  assert.strictEqual(SA.S.d.vehicle.body[7][8].id, 'steamjet');
  SA.S.save(); const saved = JSON.stringify(SA.S.d); SA.S.load(); assert.strictEqual(JSON.stringify(SA.S.d), saved);
  for (let ci = 0; ci < SA.CAMPAIGN.length; ci++) for (let si = 0; si < SA.CAMPAIGN[ci].stages.length; si++) {
    const spec = evolve.stageSpec(SA, ci, si);
    assert(!spec.availableMods.includes(spec.mat < 4 ? 'flamer' : 'steamjet'));
    SA.V.each(evolve.stageFor(SA, ci, si).vehicle, cell => {
      if (cell.id === 'steamjet') assert((cell.mt || 1) <= 3);
      if (cell.id === 'flamer') assert(cell.mt >= 4);
    });
  }
  SA.dev.designMode();
  for (let mt = 1; mt <= 6; mt++) assert(SA.S.d.inv[SA.invKey(mt < 4 ? 'flamer' : 'steamjet', mt)] == null);
  SA.dev.exitDesign();
  return { materialCases: 12, oldSave: true, blueprintGate: true, campaignPool: true };
}

function run() {
  const { SA, api } = runtime();
  return { rocket: rocket(SA, api), tether: tether(SA, api), materials: materials(SA) };
}
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
