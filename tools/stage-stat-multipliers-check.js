/* 关卡整车倍率回归：使用真实战斗入口和独立内存关卡，不写用户配置。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');
/** 在独立运行时中验证倍率、伤害数字与原车隔离。 */
function run() {
  const { SA, context } = loadGame();
  let api;
  SA.BattleView = { create(value) { api = value; return null; } };
  // 仅测试插入局部函数入口与初始化快照，避免为自动检查扩充正式战斗接口。
  const source = fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8');
  const instrumented = source.replace('  function damage(def, att, imp, dmg) {',
    '  window.__statsTest = { damage, distributeDamage, drive, refresh };\n  function damage(def, att, imp, dmg) {')
    .replace(/    return s;\r?\n  }/, '    window.__sideSnapshots.push({ hp: s.startHp, stats: { ...s.statMultipliers } });\n    return s;\n  }');
  assert.notStrictEqual(instrumented, source);
  context.__sideSnapshots = [];
  vm.runInContext(instrumented, context);
  SA.go = () => {};
  SA.S.reset();
  const original = SA.Camp.stage(0, 0).vehicle;
  const originalJson = JSON.stringify(original), modulesJson = JSON.stringify(SA.MODULES);
  const playerJson = JSON.stringify(SA.S.d.vehicle);
  const multipliers = { hp: 1.2, damage: 1.1, speed: 1.1, brake: 1.1 };
  const start = (stats) => SA.Battle.startState({ mode: 'friendly', enemyVehicle: original, terrain: 'flat', statMultipliers: stats });
  const find = (side, id) => {
    let found;
    SA.V.each(side.v, (cell, r, c, layer) => { if (!found && (!id || cell.id === id)) found = { cell, r, c, layer }; });
    assert(found); return found;
  };
  const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
  let B = start(multipliers);
  const baseline = SA.V.stats(original).maxHp;
  let scaled = 0;
  SA.V.each(original, cell => { scaled += Math.max(1, Math.round(SA.V.maxHp(cell) * 1.2)); });
  assert.strictEqual(B.e.startHp, scaled);
  assert.strictEqual(start(multipliers).e.startHp, scaled, '连续开战不得叠乘');
  B = start(multipliers);
  const p = find(B.p), hp = p.cell.hp;
  close(context.__statsTest.damage(B.p, B.e, p, 10), 11);
  close(hp - p.cell.hp, 11);
  close(B.p.taken, 11); close(B.e.dealt, 11);
  // 正数微伤仍扣血记账，显示为零时不发 text；保留原随机数消耗以稳定既有模拟种子。
  B.texts = [];
  context.__statsTest.damage(B.p, null, p, 0.1);
  assert(!B.texts.some(t => t.str === '0'));
  close(B.p.taken, 11.1);
  // 全车分摊倍率只乘一次，返回实际伤害；自伤的空来源不再次应用输出倍率。
  B = start(multipliers);
  close(context.__statsTest.distributeDamage(B.p, B.e, find(B.p), 10), 11);
  close(context.__statsTest.damage(B.e, null, find(B.e), 10), 10);
  // 双足腿区损毁后仍可打髋区；命中空腿区的实际零扣血不产生零数字。
  const biped = SA.V.create('双足倍率检查');
  biped.body[8][4] = SA.newCell('biped', 1);
  B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: biped, terrain: 'flat', statMultipliers: multipliers });
  const leg = find(B.e, 'biped');
  close(B.e.bipedHipHp + B.e.bipedLegHp, leg.cell.max);
  context.__statsTest.damage(B.e, null, { ...leg, zone: 'leg' }, 100000);
  B.texts = [];
  assert.strictEqual(context.__statsTest.damage(B.e, B.p, { ...leg, zone: 'leg' }, 5), 0);
  assert(!B.texts.some(t => t.str === '0'));
  // 制动倍率涵盖普通和打滑分支；等倍率的最高速度不修改起步加速度。
  for (const velocity of [10, 2000]) {
    const normal = start({}), enhanced = start({ brake: 1.1 });
    normal.e.vx = enhanced.e.vx = velocity; normal.e.dir = enhanced.e.dir = 0;
    context.__statsTest.drive(normal.e, 0.001); context.__statsTest.drive(enhanced.e, 0.001);
    close(velocity - enhanced.e.vx, (velocity - normal.e.vx) * 1.1);
  }
  // 最高速度倍率只改速度上限：低速加速相同，超过原上限时仍可向新上限加速。
  {
    const normal = start({}), enhanced = start({ speed: 1.1 });
    for (const state of [normal, enhanced]) { state.e.vx = 10; state.e.dir = 1; }
    context.__statsTest.drive(normal.e, 0.001); context.__statsTest.drive(enhanced.e, 0.001);
    close(normal.e.vx, enhanced.e.vx);
    const top = normal.e.speed * normal.e.speedMul;
    for (const state of [normal, enhanced]) { state.e.vx = top * 1.05; state.e.dir = 1; }
    context.__statsTest.drive(normal.e, 0.001); context.__statsTest.drive(enhanced.e, 0.001);
    assert(enhanced.e.vx > normal.e.vx, '新最高速度上限未生效');
  }
  // 模拟双方都允许接收关卡倍率；正反对打只给关卡车所在的一侧。
  for (const side of ['p', 'e']) {
    context.__sideSnapshots.length = 0;
    SA.Battle.simulate({ p: original, e: original, [`${side}StatMultipliers`]: multipliers, seed: 42, dt: 0.1 });
    const rows = context.__sideSnapshots;
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[side === 'p' ? 0 : 1].hp, scaled);
    assert.strictEqual(rows[side === 'p' ? 1 : 0].hp, baseline);
  }
  assert.strictEqual(JSON.stringify(original), originalJson, '关卡模板不能被污染');
  assert.strictEqual(JSON.stringify(SA.MODULES), modulesJson, '共享模块不能被污染');
  assert.strictEqual(JSON.stringify(SA.S.d.vehicle), playerJson, '玩家原车不能被污染');
  const simulation = { p: original, e: original, seed: 123, dt: 0.1 };
  assert.strictEqual(JSON.stringify(SA.Battle.simulate(simulation)), JSON.stringify(SA.Battle.simulate({ ...simulation, pStatMultipliers: {}, eStatMultipliers: {} })), '缺省倍率必须保持模拟结果');
  const stage = SA.Camp.stage(0, 0);
  const record = SA.StageCars.makeRecord(0, 0, stage, original, { statMultipliers: multipliers });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(record.statMultipliers)), multipliers);
  for (const damage of [0, -1, NaN, Infinity, 0.00001, 101]) assert.throws(() => SA.StageCars.statMultipliers({ damage }));
  assert.strictEqual(SA.StageCars.statMultipliers().damage, 1);
  assert.strictEqual(SA.StageCars.statMultipliers(null).damage, 1);
  assert.strictEqual(SA.StageCars.statMultipliers({ hp: 0.0001 }).hp, 0.0001);
  return { multipliers: true, mirroredSimulation: true, noZeroText: true, sourceIsolation: true };
}
if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
