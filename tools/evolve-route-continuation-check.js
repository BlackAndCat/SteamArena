/* 路线继续回归：强制两关都未达标，核验同步和 worker 仍跑完、候选保留且不冒充入选。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evolve = require('./evolve');
const config = require('./evolve-config');

function checkRoute(report) {
  const stages = report.chapters.flatMap(chapter => chapter.stages);
  assert.equal(report.status, 'complete', '未达标不应中断路线');
  assert.deepEqual(stages.map(stage => [stage.spec.chapter, stage.spec.stage]), [[0, 2], [1, 0]]);
  assert.equal(report.selectionFailures.length, 2, '没有列出全部未达标关');
  for (const stage of stages) {
    assert.equal(stage.selected, null, '临时参考不能冒充合格车');
    assert(stage.top.length > 0 && stage.provisional, '未达标候选必须保留');
    assert(stage.top.includes(stage.provisional), '临时参考必须来自本关诊断候选');
    assert(stage.selection.failed.includes('target'), '报告丢失未达标条件');
    assert.equal(stage.selection.previousGames, 120);
  }
  assert.equal(stages[1].selection.previousName, stages[0].provisional.name);
  assert.equal(stages[1].selection.previousStyle, stages[0].provisional.style);
  assert.equal(stages[1].selection.previousProvisional, true, '后续关没有标记未达标临时对手');
}

async function run() {
  const population = { ...config.population }, difficulty = { ...config.difficulty };
  const stageFile = path.join(__dirname, '../config/stage-cars.json'), original = fs.readFileSync(stageFile);
  try {
    Object.assign(config.population, { size: 4, generations: 1, maxExtraGenerations: 0 });
    // 120 局换边复测的胜率不可能落在此窄区间，用内存配置稳定触发未达标，不依赖实战平衡。
    Object.assign(config.difficulty, { min: 0.601, max: 0.602 });
    const options = { scope: { type: 'route-after', origin: { chapter: 0, stage: 1 }, count: 2 },
      seed: 1234, games: 1, workers: 2, gpu: false };
    checkRoute(evolve.run(options));
    const events = [], report = await evolve.runAsync({ ...options, onProgress: event => events.push(event) });
    checkRoute(report);
    assert.equal(events.filter(event => event.phase === 'stage-end').length, 2);
    assert.equal(events.at(-1).phase, 'complete');
    assert.equal(report.telemetry.completedStages, 2);
    assert.equal(report.telemetry.completedSteps, report.telemetry.totalSteps);
    return { sync: true, worker: true, stages: 2, unqualified: 2, provisionalReference: true };
  } finally {
    Object.assign(config.population, population);
    Object.assign(config.difficulty, difficulty);
    assert(original.equals(fs.readFileSync(stageFile)), '模拟改动了正式关卡车');
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
