/* 第一章后四关的硬约束回归：奖励、解锁、材料与预算必须同时成立。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame();
  const expected = [
    { stage: 3, required: ['cannon'], maxMat: 2, rows: 3 },
    { stage: 4, required: ['mortar_s', 'condenser'], maxMat: 2, rows: 4 },
    { stage: 5, required: ['biped', 'pressure_chamber'], maxMat: 2, rows: 4 },
    { stage: 6, required: ['cockpit_pair', 'mortar'], maxMat: 3, rows: 4 },
  ];
  const specs = expected.map(row => evolve.previewStageSpec(SA, 1, row.stage));
  for (let i = 0; i < expected.length; i++) {
    const plan = expected[i], spec = specs[i];
    assert.strictEqual(spec.budget, 830, `第 ${plan.stage + 1} 关预算错误`);
    assert.deepStrictEqual(spec.grid, { cols: 5, rows: plan.rows });
    assert.deepStrictEqual(spec.requiredModules, plan.required);
    assert(spec.requiredModules.every(id => spec.allowedModules.includes(id)), '必带件不在允许模块池');
    assert.deepStrictEqual(spec.allowedMaterials, Array.from({ length: plan.maxMat }, (_, j) => j + 1));
    assert(!spec.allowedModules.includes('rocket_rack'), '未来火箭提前进入模块池');
    const candidate = evolve.minimalVehicle(SA, spec);
    assert(candidate, `第 ${plan.stage + 1} 关找不到预算内的必带件基础车`);
    assert(evolve.legalVehicle(SA, candidate, spec), '基础候选未通过同一套出战规则');
    const ids = SA.V.countIds(candidate);
    assert(plan.required.every(id => ids[id]), '基础候选缺少多奖励模块');
    const materials = [];
    SA.V.each(candidate, cell => materials.push(cell.mt || 1));
    assert(materials.every(mat => spec.allowedMaterials.includes(mat)), '基础候选使用未来材料');
    assert(SA.V.stats(candidate).value <= 830, '基础候选超出预算');
    const rng = new evolve.RNG(7100 + plan.stage);
    const mutation = evolve.mutate(SA, candidate, spec, rng);
    if (mutation) assert(evolve.legalVehicle(SA, mutation, spec), '变异绕过硬约束');
  }

  // 第七关必须允许按件混用低阶材料，否则钢材全车升级会让双奖励预算无解。
  const final = specs[3], mixed = evolve.minimalVehicle(SA, final);
  assert(mixed && evolve.legalVehicle(SA, mixed, final));
  const mixedMats = new Set();
  SA.V.each(mixed, cell => mixedMats.add(cell.mt || 1));
  assert([...mixedMats].some(mat => mat < 3), '第七关把全车错误地强制升到钢');
  const forbidden = SA.V.clone(mixed);
  SA.V.each(forbidden, cell => { if (cell.id === 'mortar') cell.id = 'rocket_rack'; });
  assert(!evolve.constructionConditions(SA, forbidden, final).modulePool, '未来模块绕过白名单');
  const tooNew = SA.V.clone(mixed);
  SA.V.each(tooNew, cell => { cell.mt = 4; });
  assert(!evolve.legalVehicle(SA, tooNew, final), '未来材料绕过白名单');
  return { stages: expected.length, budget: 830, rewardRequired: true, unlockGuard: true, mixedMaterials: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
