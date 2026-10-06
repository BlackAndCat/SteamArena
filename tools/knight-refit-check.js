/* 骑士专项改造的数值、逐级费用、库存及战斗副本回归；运行 node tools/knight-refit-check.js。 */
'use strict';
const assert = require('assert');
const { loadGame, createDuelCache } = require('./evolve');

function run() {
  const { SA } = loadGame();
  SA.S.load();
  const scaled = (n, level, rate, integer = false) => Math.round(n * (1 + level * rate) * (integer ? 1 : 10)) / (integer ? 1 : 10);
  const biped = () => {
    const v = SA.V.create('专项改造检查');
    v.body[8][6] = SA.newCell('biped', 3);
    v.body[6][6] = SA.newCell('boiler_s', 3);
    v.body[7][7] = SA.newCell('helmet', 3);
    return v;
  };
  // 所有适用模块逐级提升本职能力，材质和改造的单件缓存互不污染。
  for (const id of Object.keys(SA.MODULES).filter(id => SA.refitKind(id))) {
    const cell = SA.newCell(id, Math.max(3, SA.minMt(id))), base = SA.mod(cell);
    const keys = id === 'biped' ? ['load'] : base.knight === 'shield' || id === 'mech_helm' ? ['hp']
      : base.knight === 'melee' ? ['punch'] : base.knight ? ['dmg', 'dmgPerSec'] : ['supply', 'water', 'cool', 'dryCool'];
    const baseWeight = SA.weightOf(cell);
    for (let level = 1; level <= SA.K.UP_MAX; level++) {
      const moneyBefore = SA.S.d.money, cost = SA.upCost(id, level);
      assert.strictEqual(SA.refitInfo(cell, level).cost, cost);
      // 与菜单一致：支付入口扣一次，变更接口只处理模块状态。
      SA.S.payAmount(cost);
      assert(SA.S.refitCell(cell, level));
      assert.strictEqual(SA.S.d.money, moneyBefore - cost);
      for (const key of keys) if (base[key]) assert.strictEqual(SA.mod(cell)[key], scaled(base[key], level, id === 'biped' ? 0.2 : 0.15, key === 'hp' || key === 'load'), `${id}/${key}/${level}`);
      assert.strictEqual(SA.weightOf(cell), baseWeight);
      assert.strictEqual(SA.mod(id, cell.mt).hp, base.hp);
      assert.strictEqual(SA.isBipedOnly(cell), id !== 'biped');
    }
    assert(!SA.S.refitCell(cell, SA.K.UP_MAX + 1));
    assert(!SA.S.refitCell(cell, SA.K.UP_MAX));
    assert(!SA.S.refitCell(cell, 1.5));
  }
  // 普通耐久改装仍独立叠加、增重；受损盾只补新增上限，报废件不会复活。
  const shield = SA.newCell('knight_shield', 3);
  const hp = shield.hp;
  shield.hp -= 20;
  SA.S.upgradeCell(shield, 1);
  const before = SA.V.maxHp(shield), weight = SA.weightOf(shield);
  assert(SA.S.refitCell(shield, 1));
  assert.strictEqual(shield.hp, SA.V.maxHp(shield) - 20);
  assert.strictEqual(SA.V.maxHp(shield), Math.round(scaled(hp, 1, 0.15, true) * (1 + SA.upHp(shield.id))));
  assert(SA.V.maxHp(shield) > before);
  assert.strictEqual(SA.weightOf(shield), weight);
  shield.hp = 0;
  assert(SA.S.refitCell(shield, 2));
  assert.strictEqual(shield.hp, 0);
  assert(!SA.S.refitCell(SA.newCell('armor'), 1));
  // 清洗无效字段，合法改造实例拆装、材质升级及出售保留价值。
  for (const [value, expected] of [[-2, 0], [1.8, 1], [100, SA.K.UP_MAX], ['2', 0], [NaN, 0]]) {
    const cell = SA.newCell('boiler_s', 3); cell.refit = value;
    SA.fixCell(cell); assert.strictEqual(cell.refit || 0, expected);
  }
  const invalid = SA.newCell('armor'); invalid.refit = 2; SA.fixCell(invalid); assert(!('refit' in invalid));
  const stored = SA.newCell('boiler_s', 3); stored.refit = 2;
  SA.S.stashCell(stored);
  const picked = SA.S.takeStock(stored.id, 3);
  assert.strictEqual(picked.refit, 2);
  assert.strictEqual(picked.hp, SA.V.maxHp(picked));
  const refitValue = SA.cellValue(picked);
  assert.strictEqual(refitValue, SA.cellValue({ id: picked.id, mt: picked.mt }) + SA.upCost(picked.id, 1) + SA.upCost(picked.id, 2));
  SA.S.addInv(picked.id, 1, picked.mt, picked);
  assert.strictEqual(SA.S.stockOptions(picked.id, picked.mt)[0].refit, 2);
  const u = SA.S.matUpInfo(picked);
  if (u.ok) { assert(SA.S.upgradeMaterial(picked, u)); assert.strictEqual(picked.refit, 2); }
  // 蓝图多余件按原规则退回库存，专项改造继续保留，普通耐久装甲仍回收。
  const spare = SA.newCell('knight_shield', 3); spare.refit = 1; spare.lv = 2; spare.hp = SA.V.maxHp(spare);
  SA.S.d.vehicle = biped(); SA.S.d.vehicle.side[6][6] = spare;
  const bp = SA.V.layout(biped()), plan = SA.S.Blueprints.plan(bp);
  assert(SA.S.Blueprints.applyPlan(plan));
  const back = SA.S.stockOptions('knight_shield', 3).find(x => x.refit === 1);
  assert(back); assert.strictEqual(back.lv || 0, 0); assert.strictEqual(back.hp, SA.V.maxHp(back));
  // 承重与降速各应用一次，参战副本保留改造及原有耐久比例。
  const v = biped(), initial = SA.V.stats(v, { deferHeat: true });
  for (let level = 1; level <= SA.K.UP_MAX; level++) {
    v.body[8][6].refit = level;
    const st = SA.V.stats(v, { deferHeat: true });
    assert.strictEqual(st.load, scaled(initial.load, level, 0.2, true));
    assert.strictEqual(st.speed, initial.speed * (1 - level * 0.05));
  }
  const full = SA.V.fromCells('改造盾', [[0, 8, 6, 'biped', 3], [1, 6, 6, 'knight_shield', 3, 1, { refit: 2 }]]);
  const s = full.side[6][6];
  assert.strictEqual(s.hp, SA.V.maxHp(s));
  assert(SA.V.validStockCell(s));
  assert(!SA.V.validStockCell({ ...s, refit: 4 }));
  assert(!SA.V.validStockCell({ ...SA.newCell('armor'), refit: 1 }));
  s.hp /= 2;
  const battle = SA.V.battleCopy(full);
  assert.strictEqual(battle.side[6][6].refit, 2);
  assert.strictEqual(battle.side[6][6].hp / battle.side[6][6].max, 0.5);
  // 完整关卡／候选记录保留专项改造，缓存必须区分改造前后；分享码仍只分享布局。
  const restored = SA.V.fromCells('改造往返', SA.StageCars.cellsOf(full));
  assert.strictEqual(restored.side[6][6].refit, 2);
  assert.strictEqual(SA.mod(restored.side[6][6]).hp, SA.mod(s).hp);
  const plain = SA.V.clone(full); delete plain.side[6][6].refit;
  const cache = createDuelCache(SA);
  assert.notStrictEqual(cache.key(full, restored, {}, 1, 1), cache.key(plain, restored, {}, 1, 1),
    '不同改造等级不能共用对局缓存');
  // 唯一锁甲腿的6000kg基数先固定，再做承重改造；不能被腿型倍率覆盖。
  const mail = biped(); mail.body[8][6].look = 'mail';
  for (let level = 0; level <= SA.K.UP_MAX; level++) {
    mail.body[8][6].refit = level;
    assert.strictEqual(SA.V.stats(mail, { deferHeat: true }).load, 6000 * (1 + level * 0.2));
  }
  // 直接进入真实战斗状态，核对能源、冷却及武器派生值均采用同一个改造实例。
  const fighter = biped(); fighter.side[5][6] = SA.newCell('knight_cannon', 3);
  fighter.body[5][6] = SA.newCell('condenser', 3);
  SA.go = () => {};
  const combat = car => {
    SA.S.d.vehicle = car;
    return SA.Battle.startState({ enemyVehicle: SA.V.clone(car), terrain: 'flat', style: 'wander' }).p;
  };
  const combatBefore = combat(SA.V.clone(fighter));
  for (const cell of [fighter.body[6][6], fighter.body[5][6], fighter.side[5][6]]) cell.refit = 1;
  const combatAfter = combat(fighter);
  assert.strictEqual(combatAfter.supply, SA.mod(fighter.body[6][6]).supply);
  assert.strictEqual(combatAfter.cool, SA.mod(fighter.body[5][6]).cool);
  assert(combatAfter.supply > combatBefore.supply && combatAfter.cool > combatBefore.cool);
  const weapon = side => side.weapons.find(w => w.cell.id === 'knight_cannon').m;
  assert.strictEqual(weapon(combatAfter).dmg, SA.modForVehicle(fighter.side[5][6], fighter).dmg);
  assert(weapon(combatAfter).dmg > weapon(combatBefore).dmg);
  // 非双足旧车上的通用件不得在菜单对应后台接口直接改造成非法车。
  SA.S.d.vehicle = SA.V.create('非双足');
  SA.S.d.vehicle.body[6][6] = SA.newCell('boiler_s', 3);
  assert(!SA.S.refitCell(SA.S.d.vehicle.body[6][6], 1));
  console.log('骑士专项改造检查通过：数值、费用、等级、耐久、库存、承重降速及战斗副本。');
}
if (require.main === module) run();
module.exports = { run };
