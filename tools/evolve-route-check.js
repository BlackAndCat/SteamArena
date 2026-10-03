// 路线生成专项：两关跨章父本链、未创建计划关和严格范围校验；只在内存运行。
'use strict';

const assert = require('node:assert/strict');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function main() {
  config.population.size = 4;
  config.population.generations = 1;
  const { SA } = evolve.loadGame();
  assert.equal(JSON.stringify(evolve.routeAfter(SA, { chapter: 0, stage: 1 }, 2).map(row => [row.chapter, row.stage])), '[[0,2],[1,0]]');
  assert.throws(() => evolve.routeAfter(SA, { chapter: 5, stage: 4 }, 2), /最多可选 1 关/);

  const report = await evolve.runAsync({ scope: { type: 'route-after', origin: { chapter: 0, stage: 1 }, count: 2 },
    games: 1, workers: 1, seed: 1234 });
  const rows = report.chapters.flatMap(ch => ch.stages.map(stage => ({ chapter: ch.chapter, stage })));
  assert.deepEqual(rows.map(row => [row.chapter, row.stage.spec.stage]), [[0, 2], [1, 0]]);
  for (const { stage } of rows) {
    assert(stage.top.length > 0 && stage.selected, '每个目标都应生成并选出候选');
    assert(stage.originComparison && stage.originComparison.games > 0, '每个目标都应独立与原点车换边对打');
    assert.deepEqual(stage.originComparison.origin, { chapter: 0, stage: 1 });
  }

  const future = evolve.previewStageSpec(SA, 1, 3);
  assert.equal(evolve.stageFor(SA, 1, 3), null);
  assert.equal(future.budget, evolve.stageSpec(SA, 1, 2).budget);
  assert.equal(JSON.stringify(future.previewRuleSource), '{"chapter":1,"stage":2}');
  assert(future.availableMods.length > evolve.stageSpec(SA, 1, 2).availableMods.length);
  console.log('路线生成专项通过：跨章 2 关、原点对比、未创建关临时规则、越界拒绝');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
