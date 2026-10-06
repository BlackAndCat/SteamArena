/* 双足类别、腿件摆放与承重、骑士上下文属性的最小规则回归。 */
'use strict';
const assert = require('assert');
const { loadGame } = require('./evolve');

function run() {
  const { SA } = loadGame();
  const stats = v => SA.V.stats(v, { deferHeat: true });
  const biped = look => {
    const v = SA.V.create('双足数据检查');
    v.body[8][6] = SA.newCell('biped', 3);
    if (look) { v.body[8][6].look = look; SA.fixCell(v.body[8][6]); }
    v.body[6][6] = SA.newCell('boiler_s', 3);
    v.body[7][7] = SA.newCell('helmet', 3);
    return v;
  };
  // 新件借现有画法占位；卡片和属性行初始化均不得因缺少专用画法而崩溃。
  const newIds = ['leg_spring', 'leg_booster', 'knight_shield', 'knight_fist', 'knight_hammer', 'knight_sword', 'knight_cannon', 'knight_gun', 'mech_helm'];   // 2026-10-05：helmet_wide 与 Opus 的 mech_helm 重复，已删；新件改用专用画法
  for (const id of newIds) {
    assert.doesNotThrow(() => SA.SPR.moduleCanvas(id, 1, 2), `${id} 卡片初始化`);
    assert.doesNotThrow(() => SA.UI.statLine(id, 2), `${id} 属性行初始化`);
  }
  // 同一材料换腿型才改变专精；晶枝保持标准，各类系数只应用一次。
  for (const [look, kind] of [[null, 'standard'], ['crystal', 'standard'], ['stilt', 'light'], ['blade', 'light'], ['panto', 'light'], ['bellows', 'light'], ['skirt', 'heavy'], ['mail', 'heavy'], ['steamman', 'heavy'], ['templar', 'heavy']]) {
    const v = biped(look), s = stats(v), rule = SA.K.BIPED_CLASSES[kind], cell = v.body[8][6];
    assert.strictEqual(s.bipedClass, kind);
    assert.strictEqual(s.speed, 90 * rule.speed);
    assert.strictEqual(s.load, SA.uniqueRule(cell)?.load ?? Math.round(SA.mod(cell).load * rule.load));
    assert.strictEqual(s.evade, rule.evade);
    assert.strictEqual(s.speedBoost, 1.4);
    assert.strictEqual(SA.V.bipedParts(v).jumpHeight, rule.jumpHeight);
  }
  const v = biped(), before = stats(v);
  assert(SA.V.place(v, 'leg_spring', 11, 6).ok);
  assert(SA.V.place(v, 'leg_booster', 8, 6).ok);
  const after = stats(v);
  assert.strictEqual(after.loadKg, before.loadKg);
  // 腿件免承重但不免质心：按所有存活部件的实际质量独立计算中心。
  let mass = 0, mx = 0, my = 0;
  SA.V.each(v, (cell, r, c) => { const w = SA.weightOf(cell), f = SA.fp(cell.id); mass += w; mx += w * (c + f.w / 2); my += w * (r + f.h / 2); });
  assert.strictEqual(after.center, mx / mass);
  assert.strictEqual(after.comHeight, Math.max(0, (9 - my / mass) / 2));
  assert.notStrictEqual(after.center, before.center);
  assert.strictEqual(after.weight - before.weight, SA.weightOf(v.side[11][6]) + SA.weightOf(v.side[8][6]));
  assert.strictEqual(after.speed, before.speed * 1.12);
  assert(!SA.V.canPlace(v, 'leg_spring', 11, 7).ok);
  assert(!SA.V.canPlace(v, 'plate', 11, 7).ok);
  assert(!SA.V.issues(v).some(x => x.layer === 'side'));
  v.side[8][6].hp = 0;
  assert.strictEqual(stats(v).speed, before.speed);
  v.side[11][6].hp = 0;
  assert.strictEqual(SA.V.bipedParts(v).spring.length, 0);
  v.side[11][6].hp = 10; v.body[8][6].bipedZones = { hip: 1, leg: 0 };
  assert.strictEqual(SA.V.bipedParts(v).spring.length, 0);

  // 骑士覆盖拼接车体并允许伸出边缘；普通侧炮保持单块装甲规则。
  const rider = biped();
  assert(SA.V.canPlace(rider, 'knight_fist', 5, 6).ok);
  assert(!SA.V.canPlace(rider, 'side_cannon', 6, 6).ok);
  // 机甲头盔下面才是肩膀（用户 2026-10-05）：手臂不能和头盔同一行或更高，头盔也不能压到已有手臂上面
  // 手臂 3 行高、不能伸进胯行（第 8 行起），所以头盔在第 4 行时手臂正好挂在第 5～7 行（头、胸、腰）
  const helmed = biped(); helmed.body[5][6] = SA.newCell('plate', 3); helmed.body[4][6] = SA.newCell('mech_helm', 3);
  assert(!SA.V.canPlace(helmed, 'knight_fist', 4, 7).ok, '手臂不能和头盔并排');
  assert(!SA.V.canPlace(helmed, 'knight_fist', 3, 6).ok, '手臂不能盖住头盔');
  assert(SA.V.canPlace(helmed, 'knight_fist', 5, 7).ok, '头盔下面可以装手臂');
  const armed = biped(); armed.side[5][7] = SA.newCell('knight_fist', 3);
  assert(!SA.V.canPlace(armed, 'mech_helm', 5, 5).ok, '头盔不能压在已有手臂那一行');
  helmed.side[4][7] = SA.newCell('knight_fist', 3);
  assert(SA.V.issues(helmed).some(x => x.layer === 'side' && x.r === 4 && x.c === 7), '旧车里高过头盔的手臂要标红');
  rider.side[5][6] = SA.newCell('knight_fist', 3);
  assert(!SA.V.issues(rider).some(x => x.layer === 'side'));
  assert(Number.isFinite(stats(rider).dps));
  const track = SA.V.create(); track.body[10][6] = SA.newCell('track', 3); track.body[8][6] = SA.newCell('boiler', 3);
  assert(!SA.V.canPlace(track, 'leg_spring', 9, 6).ok);
  assert(SA.V.canPlace(track, 'knight_cannon', 7, 6).ok);
  assert.strictEqual(stats(track).speedBoost, SA.K.SPEED_BOOST);
  for (const id of ['knight_fist', 'knight_hammer', 'knight_sword', 'knight_cannon', 'knight_gun', 'knight_shield']) {
    const cell = SA.newCell(id, 3), key = id === 'knight_shield' ? 'hp' : id.includes('cannon') || id.includes('gun') ? 'dmg' : 'punch';
    const base = SA.mod(cell)[key];
    assert.strictEqual(SA.modForVehicle(cell, track)[key], base);
    assert.strictEqual(SA.modForVehicle(cell, rider)[key], Math.round(base * 1.4 * 10) / 10);
    assert.strictEqual(SA.mod(cell)[key], base);
  }
  // 库存 hp 是基础；统计与参战副本按受损比例放大，复制副本不得二次加成。
  const shield = biped(); shield.side[5][6] = SA.newCell('knight_shield', 3);
  const cell = shield.side[5][6], canonical = SA.V.maxHp(cell);
  cell.hp = canonical / 2;
  const expected = SA.V.maxHp(cell, shield);
  assert.strictEqual(expected, Math.round(canonical * 1.4));
  const copy = SA.V.battleCopy(shield), copy2 = SA.V.battleCopy(copy);
  assert.strictEqual(copy.side[5][6].hp, expected / 2);
  assert.strictEqual(copy.side[5][6].max, expected);
  assert.strictEqual(copy2.side[5][6].max, expected);
  assert.strictEqual(copy2.side[5][6].hp, copy.side[5][6].hp);
  assert.strictEqual(stats(shield).maxHp, stats(copy).maxHp);
  assert.strictEqual(SA.fp('mech_helm').w, 2);   // 机甲头盔（Opus，2026-10-05）：2×1、无骑士加成、比单人舱重
  assert.strictEqual(SA.modForVehicle(SA.newCell('mech_helm', 2), rider).hp, SA.mod('mech_helm', 2).hp);
  assert(SA.weightOf(SA.newCell('mech_helm')) > SA.weightOf(SA.newCell('helmet')));
  // 半血盾连续出战、结算四轮不损伤时不能逐次回血；维修仍按基础耐久计费并修满。
  SA.S.reset();
  SA.S.d.vehicle = shield;
  const originalHp = cell.hp, repairCost = SA.S.repairCost(cell);
  for (let round = 0; round < 4; round++) {
    const battleVehicle = SA.V.battleCopy(shield);
    SA.S.settleBattle({ mode: 'test', opts: {}, playerVehicle: battleVehicle });
    assert.strictEqual(cell.hp, originalHp);
    assert.strictEqual(SA.S.repairCost(cell), repairCost);
  }
  const damaged = SA.V.battleCopy(shield);
  damaged.side[5][6].hp = damaged.side[5][6].max / 4;
  SA.S.settleBattle({ mode: 'test', opts: {}, playerVehicle: damaged });
  assert.strictEqual(cell.hp, canonical / 4);
  assert(SA.S.repairCost(cell) > repairCost);
  SA.S.repairCells([cell]);
  assert.strictEqual(cell.hp, canonical);
  assert.strictEqual(SA.S.repairCost(cell), 0);
  // 普通模块携带赛季倍耐久时维持历史直接回写路径。
  const ordinary = shield.body[7][7], enhanced = SA.V.battleCopy(shield, 2);
  enhanced.body[7][7].hp = 123;
  SA.S.settleBattle({ mode: 'test', opts: {}, playerVehicle: enhanced });
  assert.strictEqual(ordinary.hp, 123);
  return { ok: true, classes: 10, knightModules: 6, settlement: true };
}
if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
