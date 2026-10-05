// 双足真实战斗回归：夹具走状态更新与实弹命中路径，不依赖画面。
'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./evolve');
function run() {
  const { SA } = loadGame(); SA.S.load(); SA.go = () => {};
  function vehicle(spring = true, weapon = null, look = null) {
    const v = SA.V.create('双足战斗检查');
    v.body[8][6] = SA.newCell('biped', 3);
    if (look) { v.body[8][6].look = look; SA.fixCell(v.body[8][6]); }
    v.body[6][6] = SA.newCell('boiler_s', 3); v.body[7][7] = SA.newCell('helmet', 3);
    if (spring) v.side[11][6] = SA.newCell('leg_spring', 3);
    if (weapon) v.side[5][6] = SA.newCell(weapon, 3);
    return v;
  }
  function state(v = vehicle(), enemy = v, style = 'wander') {
    SA.S.d.vehicle = v;
    const B = SA.Battle.startState({ enemyVehicle: enemy, enemyName: '回归目标', terrain: 'flat', style });
    B.ending = 999; return B;
  }
  const tick = seconds => SA.Battle.debug.step(seconds);
  const anchor = (s, id) => { let out; SA.V.each(s.v, (cell, r, c, layer) => { if (cell.id === id) out = { cell, r, c, layer }; }); return out; };
  function bullet(B, s, x, y, side = false) {
    const other = s === B.p ? B.e : B.p;
    B.shots.push({ x, y, vx: 0, vy: 0, g: 0, from: other, to: s, side, dmg: 10,
      weaponCell: { id: 'mg_s' }, weapon: {}, originX: x, originY: y });
  }
  // 同一姿态偏移必须同时作用于炮口、模块中心和受击拾取，不能只保证坐标不是 NaN。
  {
    const B = state(vehicle(true, 'knight_gun')), gun = anchor(B.p, 'knight_gun');
    const baseMuzzle = SA.Battle.debug.muzzle(), baseCenter = SA.Battle.debug.cellCenter('p', gun.r, gun.c, 'side');
    for (const [crouch, height] of [[1, 0], [0, 42], [.5, 18]]) {
      B.p.crouch = crouch; B.p.airHeight = height;
      const delta = 24 * crouch - height, muzzle = SA.Battle.debug.muzzle();
      const center = SA.Battle.debug.cellCenter('p', gun.r, gun.c, 'side');
      assert(Math.abs(muzzle[1] - baseMuzzle[1] - delta) < 1e-9, '蹲跳炮口位移必须等于真实姿态位移');
      assert(Math.abs(center[1] - baseCenter[1] - delta) < 1e-9, '蹲跳模块中心必须与炮口同移');
      const hit = SA.Battle.debug.targetAt('p', center[0], center[1]);
      assert(hit && hit.layer === 'side' && hit.r === gun.r && hit.c === gun.c, '位移后的模块中心必须命中同一骑士件');
    }
  }
  // 头部平射真实脱靶；压缩后的腿与腿件仍通过同一实弹路径受击。
  {
    const B = state(); B.e.dead = true;
    const head = anchor(B.p, 'helmet'), [x, y] = SA.Battle.debug.cellCenter('p', head.r, head.c);
    B.keys.crouch = true; B.keys.right = true; tick(0.3);
    assert.equal(B.p.crouch, 1); assert.equal(B.p.vx, 0);
    const hp = head.cell.hp; bullet(B, B.p, x, y); tick(1 / 60); assert.equal(head.cell.hp, hp, '下蹲后头顶实弹应脱靶');
    const leg = anchor(B.p, 'leg_spring'), [lx, ly] = SA.Battle.debug.cellCenter('p', leg.r, leg.c, 'side');
    const old = leg.cell.hp; bullet(B, B.p, lx, ly, true); tick(1 / 60); assert(leg.cell.hp < old, '缩小腿件命中区后仍可真实击中');
    const hip = B.p.bipedHipHp, legHp = B.p.bipedLegHp, coveredHp = leg.cell.hp;
    bullet(B, B.p, lx, ly); tick(1 / 60);
    assert(leg.cell.hp < coveredHp, '普通车体弹也必须先打存活腿件');
    assert.equal(B.p.bipedHipHp, hip); assert.equal(B.p.bipedLegHp, legHp, '腿件存活时不能绕过外层伤腿');
    SA.Battle.debug.damage('p', leg.r, leg.c, 'side', 100000);
    bullet(B, B.p, lx, ly); tick(1 / 60);
    assert.equal(B.p.bipedHipHp, hip); assert(B.p.bipedLegHp < legHp, '腿件损毁后车体弹落到腿区');
    const exposedHp = B.p.bipedLegHp;
    bullet(B, B.p, lx, ly, true); tick(1 / 60);
    assert(B.p.bipedLegHp < exposedHp, '腿件损毁后侧挂弹也落到腿区');
    // 压缩腿区底沿保持在地面，原来腿区的高度不能全算受击。
    assert.equal(SA.Battle.debug.targetAt('p', lx, 649), null);
    B.keys.crouch = false; B.keys.right = false; tick(0.3); assert.equal(B.p.crouch, 0);
  }
  // 每一种门禁单独走公开的战斗判定；蓄力中毁件走真实刷新路径取消。
  {
    let B = state(vehicle(false)); assert.equal(SA.Battle.debug.canJump(), false);
    B = state(); B.e.dead = true; B.keys.crouch = true; tick(.3); assert.equal(SA.Battle.debug.canJump(), false);
    B.keys.crouch = false; tick(.3);
    for (const [key, value] of [['balance', '失衡'], ['bipedHipDead', true], ['bipedLegDead', true], ['loadKg', B.p.load + 1]]) {
      const old = B.p[key]; B.p[key] = value; assert.equal(SA.Battle.debug.canJump(), false, key); B.p[key] = old;
    }
    B.keys.jump = true; tick(.05);
    const spring = anchor(B.p, 'leg_spring'); SA.Battle.debug.damage('p', spring.r, spring.c, 'side', 100000); tick(.2);
    assert.equal(B.p.airHeight, 0); assert.equal(B.p.events.jump || 0, 0);
  }
  // 腾空实射、腿胯分区和着地；一直按住跳不能连跳，冷却内重按也无效。
  {
    const B = state(vehicle(true, 'knight_gun')); B.e.dir = 0;
    const w = B.p.weapons[0]; assert(w && Number.isFinite(w.m.rest));
    B.keys.jump = true; tick(.2); assert(B.p.airHeight > 0); assert(B.p.jumpCooldown > 0);
    const startWater = B.p.water; assert.equal(startWater, 0, '无水箱仍能供汽跳跃');
    const muzzle = SA.Battle.debug.muzzle(); assert(muzzle.every(Number.isFinite));
    B.aim = SA.Battle.debug.cellCenter('e', 7, anchor(B.e, 'helmet').c); B.keys.fire = true;
    tick(.05); assert(B.p.events.fire > 0, '空中骑士机枪应开火');
    assert(B.shots.every(sh => [sh.x, sh.y, sh.vx, sh.vy].every(Number.isFinite)));
    const leg = anchor(B.p, 'leg_spring'), [x, y] = SA.Battle.debug.cellCenter('p', leg.r, leg.c, 'side');
    const hip = B.p.bipedHipHp, legHp = B.p.bipedLegHp, coveredHp = leg.cell.hp;
    bullet(B, B.p, x, y); tick(1 / 60);
    assert(leg.cell.hp < coveredHp, '空中收腿时普通车体弹先打腿件');
    assert.equal(B.p.bipedHipHp, hip); assert.equal(B.p.bipedLegHp, legHp);
    SA.Battle.debug.damage('p', leg.r, leg.c, 'side', 100000);
    const exposed = SA.Battle.debug.cellCenter('p', leg.r, leg.c, 'side');
    bullet(B, B.p, exposed[0], exposed[1]); tick(1 / 60);
    assert.equal(B.p.bipedHipHp, hip); assert(B.p.bipedLegHp < legHp, '空中腿件被毁后命中仍归腿');
    B.keys.fire = false; tick(1); assert.equal(B.p.airHeight, 0); assert.equal(B.p.tuck, 0); assert(B.p.events.land > 0);
    assert.equal(B.p.events.jump, 1); B.keys.jump = false; tick(1 / 60); B.keys.jump = true; tick(.2); assert.equal(B.p.events.jump, 1);
  }
  // 强制跪地禁止跳与移动；蹲射和冲锋AI使用真实动作状态。
  {
    let B = state(); B.e.dead = true; const a = anchor(B.p, 'biped');
    // 在已确认的腿区落一发足量实弹，验证腿毁而胯仍活。
    const spring = anchor(B.p, 'leg_spring'), [x, y] = SA.Battle.debug.cellCenter('p', spring.r, spring.c, 'side');
    bullet(B, B.p, x, y); B.shots.at(-1).dmg = 100000; tick(1 / 60);
    assert(spring.cell.hp <= 0 && !B.p.bipedLegDead, '第一发只击毁腿件，不穿透伤腿');
    bullet(B, B.p, x, y); B.shots.at(-1).dmg = 100000; tick(.3);
    assert(B.p.bipedLegDead && !B.p.bipedHipDead); assert.equal(B.p.crouch, 1); assert.equal(SA.Battle.debug.canJump(), false);
    B = state(vehicle(), vehicle(true, 'knight_gun'), 'turtle'); B.e.x -= 320; B.e.homeX = B.e.x; B.e.goalX = B.e.x; B.e.moveT = 100; tick(.4);
    assert(B.e.crouch > 0, '炮台AI蹲射');
    B = state(vehicle(), vehicle(true, 'knight_gun'), 'rush'); B.e.x -= 120; tick(.4); assert((B.e.events.jump || 0) > 0, '冲锋AI跳近');
  }
  // 避弹AI读取来弹真实轨迹：低弹起跳，躯干弹下蹲，不抽额外随机数。
  for (const low of [true, false]) {
    const B = state(vehicle(), vehicle(), 'evade');
    const a = anchor(B.e, low ? 'leg_spring' : 'helmet');
    const [x, y] = SA.Battle.debug.cellCenter('e', a.r, a.c, a.layer);
    B.e.goalX = B.e.x; B.e.moveT = 100;
    B.shots.push({ x: x - 120, y, vx: 200, vy: 0, g: 0, delay: 0, from: B.p, to: B.e, side: false,
      dmg: 1, weapon: {}, weaponCell: { id: 'mg_s' }, originX: x - 120, originY: y });
    tick(.5);
    assert(low ? B.e.events.jump > 0 : B.e.crouch > 0, low ? '低弹避让应跳' : '躯干避让应蹲');
  }
  // 高抛来弹即使将落在躯干上，也不能让双足蹲在落点或起跳接弹。
  for (const weapon of [{ arc: 'high' }, { indirect: true }]) {
    const B = state(vehicle(), vehicle(), 'evade'), a = anchor(B.e, 'helmet');
    const [x, y] = SA.Battle.debug.cellCenter('e', a.r, a.c, a.layer);
    B.e.goalX = B.e.x; B.e.moveT = 100;
    B.shots.push({ x: x - 120, y, vx: 200, vy: -36, g: 120, delay: 0, from: B.p, to: B.e, side: false,
      dmg: 1, weapon, weaponCell: { id: 'mortar_s' }, originX: x - 120, originY: y });
    tick(.3);
    assert.equal(B.e.events.jump || 0, 0, '高抛弹不触发跳跃避让');
    assert.equal(B.e.crouch, 0, '高抛弹不触发下蹲避让');
    assert.equal(Math.abs(B.e.dir), 1, '高抛弹应采取横向规避');
  }
  // 相同装载下轻腿跳得更高、重腿更低，材料小幅增益不改变专精顺序。
  {
    const peaks = [];
    for (const look of ['stilt', null, 'skirt']) {
      const B = state(vehicle(true, null, look)); B.e.dead = true;
      B.p.dryLoadKg = B.p.load * .5; B.keys.jump = true; tick(.2); peaks.push(B.p.jumpPeak);
    }
    assert(peaks[0] > peaks[1] && peaks[1] > peaks[2]);
  }
  // 骑士炮枪真实发射与近战共享冷却，不能叠加自带踢击。
  for (const id of ['knight_cannon', 'knight_gun']) {
    const B = state(vehicle(true, id)); const w = B.p.weapons[0];
    assert([w.m.reload, w.m.spread, w.m.slew, w.m.v, w.m.g, w.m.rest].every(Number.isFinite), id);
    B.aim = SA.Battle.debug.cellCenter('e', 7, anchor(B.e, 'helmet').c); B.keys.fire = true; B.p.release = true; tick(.2);
    assert(B.p.events.fire > 0, id + '未实射'); assert(Number.isFinite(B.p.heat));
  }
  {
    const v = vehicle(false, 'knight_fist'); v.side[5][7] = SA.newCell('knight_sword', 3);
    const B = state(v); const ph = anchor(B.p, 'helmet'), eh = anchor(B.e, 'helmet');
    B.e.x -= SA.Battle.debug.cellCenter('e', eh.r, eh.c)[0] - SA.Battle.debug.cellCenter('p', ph.r, ph.c)[0] - 24; B.e.isAI = false; B.p.dir = 0; B.e.dir = 0; tick(.1);
    assert.equal(B.p.events.kick, 0); assert(B.p.knightCooldown > 0, '近战骑士应发起共享窗口');
    assert.equal(Object.values(B.p.punch).filter(value => value > 0).length, 1, '同窗口只攻击一次');
  }
  const v = vehicle(true, 'knight_gun'), options = { p: v, e: v, pStyle: 'rush', eStyle: 'evade', seed: 713, telemetry: true };
  const first = SA.Battle.simulate(options), again = SA.Battle.simulate(options);
  assert.deepEqual(first, again, '同种子双足动作应完全复现');
  assert(first.telemetry.seconds > 0 && first.telemetry.p.distance >= 0 && first.telemetry.p.speedIntegral >= 0);
  return { ok: true, crouch: true, jump: true, knight: true, deterministic: true };
}
if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
