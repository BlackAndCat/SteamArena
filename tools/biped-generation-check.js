/* 双足生成回归：只生成内存中的诊断车，验证挂位、必带件、预算和种子，不写正式关卡。 */
'use strict';

const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame();
  // 第二章诊断池显式开放新件；正式战役的模块池与奖励不因此变化。
  const ids = ['leg_spring', 'leg_booster', 'knight_shield', 'knight_fist', 'knight_hammer',
    'knight_sword', 'knight_cannon', 'knight_gun', 'mech_helm'];
  const base = { chapter: 2, stage: 0, name: '双足挂件诊断', mat: 2, allowedMaterials: [2],
    grid: { cols: 8, rows: 6 }, budget: 5000,
    availableMods: ['biped', 'track', 'quad', 'helmet', 'boiler_s', 'cannon_s', ...ids] };
  const result = [];
  for (const id of ids) {
    const spec = { ...base, requiredModules: [id] };
    const car = evolve.minimalVehicle(SA, spec, id);
    assert(car, `${id} 必带件未能生成合法保底车`);
    assert(evolve.legalVehicle(SA, car, spec), `${id} 保底车未满足正式装配与预算约束`);
    assert(SA.V.countIds(car)[id], `${id} 在构筑中丢失`);
    assert(SA.V.countIds(car).biped, `${id} 没有使用双足底盘`);
    const noBiped = { ...spec, availableMods: spec.availableMods.filter(mod => mod !== 'biped') };
    assert.strictEqual(evolve.minimalVehicle(SA, noBiped, id), null, '模块池缺双足时不能偷偷补底盘');
    assert.strictEqual(evolve.randomVehicle(SA, noBiped, new evolve.RNG(20261006), id), null,
      '随机生成不能把专属件装到履带或四足');
    // 额外强制侧挂件与普通奖励同车时，递归构筑基车也必须预留双足。
    const extra = { ...base, requiredModules: ['cannon_s'] };
    const withExtra = evolve.minimalVehicle(SA, extra, id);
    assert(withExtra && evolve.legalVehicle(SA, withExtra, extra), `${id} 与普通奖励不能生成合法车`);
    assert(SA.V.countIds(withExtra).biped && SA.V.countIds(withExtra)[id], `${id} 额外必带件丢失`);
    result.push({ id, value: SA.V.stats(car).value });
  }
  const both = { ...base, requiredModules: ['leg_spring', 'leg_booster'] };
  const first = evolve.requiredVehicle(SA, both, new evolve.RNG(20261005));
  const again = evolve.requiredVehicle(SA, both, new evolve.RNG(20261005));
  assert(first && again, '同车必须能装两种腿件');
  assert(evolve.legalVehicle(SA, first, both), '两件腿件的构筑不合法');
  assert.strictEqual(JSON.stringify(first), JSON.stringify(again), '同种子生成腿件车不可复现');
  const knightRewards = { ...base, requiredModules: ['cannon_s', 'knight_shield', 'mech_helm'] };
  const knightCar = evolve.requiredVehicle(SA, knightRewards, new evolve.RNG(20261006));
  assert(knightCar && evolve.legalVehicle(SA, knightCar, knightRewards), '通用奖励与骑士套件必须共用合法双足车');
  assert(SA.V.countIds(knightCar).biped, '多奖励车必须沿用完整清单的双足要求');
  const poor = { ...base, budget: 1, requiredModules: ['leg_spring'] };
  assert.strictEqual(evolve.minimalVehicle(SA, poor), null, '腿件保底不能绕过预算');
  return { modules: result, pairedLegParts: true, deterministic: true };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
