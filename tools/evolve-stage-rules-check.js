/* 逐关规则回归：计划关均有显式预算，生成和变异不能越级，评分不再奖励少放件。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const rules = require('./evolve-stage-rules.json');

function run() {
  const { SA } = evolve.loadGame();
  const planned = SA.CAMPAIGN_MAP.chapters.slice(0, 2).reduce((sum, chapter) => sum + chapter.stages.length, 0);
  assert.strictEqual(rules.length, planned, '序章及第一章应逐关配置预算与模块池');
  const keys = new Set();
  for (const row of rules) {
    const key = `${row.chapter}:${row.stage}`;
    assert(!keys.has(key), `规则重复：${key}`); keys.add(key);
    assert(Number.isFinite(row.budget) && row.budget > 0, `${key} 预算无效`);
    const spec = evolve.previewStageSpec(SA, row.chapter, row.stage);
    assert.strictEqual(spec.budget, row.budget, `${key} 没有采用显式预算`);
    assert(spec.allowedModules.every(id => SA.MODULES[id] && !SA.MODULES[id].retired), `${key} 模块池包含失效件`);
  }
  assert.throws(() => evolve.run({ chapters: 2 }), /仍待审阅/, '未审阅关卡被整批正式生成');
  const first = evolve.stageSpec(SA, 0, 0), second = evolve.stageSpec(SA, 0, 1), third = evolve.stageSpec(SA, 0, 2);
  assert.deepStrictEqual([first.budget, second.budget, third.budget], [360, 420, 485]);
  assert.deepStrictEqual(first.availableMods, ['track', 'helmet', 'boiler_s', 'tank_s', 'mg_s']);
  assert.deepStrictEqual(second.availableMods, [...first.availableMods, 'plate']);
  assert.deepStrictEqual(third.availableMods, [...second.availableMods, 'bucket']);

  // 初始车、标尺和变异分别走同一套奖励、材料、预算与摆放规则。
  let generated = 0;
  for (const spec of [first, second, third]) {
    const fallback = evolve.minimalVehicle(SA, spec);
    assert(fallback && evolve.legalVehicle(SA, fallback, spec), '保底构筑未满足奖励与预算');
    for (let seed = 1; seed <= 24; seed++) {
      const vehicle = evolve.randomVehicle(SA, spec, new evolve.RNG(seed));
      assert(vehicle && evolve.legalVehicle(SA, vehicle, spec), `初始种子 ${seed} 非法`); generated++;
      const child = evolve.mutate(SA, vehicle, spec, new evolve.RNG(seed + 100));
      if (child) { assert(evolve.legalVehicle(SA, child, spec), '变异绕过硬约束'); generated++; }
    }
    for (const opponent of evolve.campaignOpponents(SA, spec.chapter, spec.stage, spec))
      assert(evolve.legalVehicle(SA, opponent, spec), '标尺车不合法');
  }
  const future = SA.V.clone(evolve.minimalVehicle(SA, first));
  SA.V.each(future, cell => { if (cell.id === 'mg_s') cell.id = 'rocket_rack'; });
  assert(!evolve.constructionConditions(SA, future, first).modulePool, '未来模块绕过筛选');

  // 两车战斗成绩相同时仍偏好低价；件数本身不再给极简车额外分数。
  const sample = SA.V.stats(evolve.minimalVehicle(SA, second));
  const score = stats => evolve.efficiencyScore(stats, second).total;
  assert(score(sample) > score({ ...sample, value: sample.value + 20 }));
  assert.strictEqual(score(sample), score({ ...sample, count: sample.count + 1 }));
  assert.strictEqual(evolve.fitness({ strength: 300, efficiency: { total: 100 } }), 20);
  assert.strictEqual(evolve.fitness({ strength: 1700, efficiency: { total: 0 } }), 80);
  const halfBudget = { value: 415, count: 5 };
  const plannedSpec = evolve.previewStageSpec(SA, 1, 6);
  assert.strictEqual(evolve.efficiencyScore(halfBudget, plannedSpec).total, 50,
    '£830预算中花费£415应得到50分节约分');
  assert.strictEqual(evolve.fitness({ strength: 300, efficiency: evolve.efficiencyScore(halfBudget, plannedSpec) }), 10,
    '50分节约分按20%权重应贡献10分');
  return { stages: rules.length, generated, budgetAndUnlock: true, ranking: '80:20', moduleCountBonus: false };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
