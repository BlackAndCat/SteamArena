/* 非序章生成回归：第一章后四关的奖励车与标尺合法，worker 报告严格区分入选和诊断。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const { SA } = evolve.loadGame(), before = { ...config.population };
  const stageFile = path.join(__dirname, '../config/stage-cars.json'), original = fs.readFileSync(stageFile);
  let anchors = 0;
  for (let stage = 3; stage <= 6; stage++) {
    const spec = evolve.previewStageSpec(SA, 1, stage);
    const candidate = evolve.minimalVehicle(SA, spec);
    assert(candidate && evolve.legalVehicle(SA, candidate, spec), `1:${stage} 多奖励保底构筑非法`);
    assert(spec.requiredModules.every(id => SA.V.countIds(candidate)[id]), `1:${stage} 保底丢奖励`);
    const opponents = evolve.campaignOpponents(SA, 1, stage, spec);
    assert.strictEqual(opponents.length, config.evaluation.anchorCount);
    for (const opponent of opponents) assert(evolve.legalVehicle(SA, opponent, spec), `1:${stage} 标尺非法`);
    anchors += opponents.length;
  }
  try {
    Object.assign(config.population, { size: 4, generations: 1, maxExtraGenerations: 0 });
    // 第三关原始测距仪侧挂坐标错误，只修本次内存副本并记录修正。
    const origin = structuredClone(JSON.parse(original).records['1:2']);
    const finder = origin.cells.find(cell => cell[3] === 'rangefinder' && cell[1] === 6 && cell[2] === 6);
    assert(finder, '原点修正对象不存在');
    finder[0] = 1; finder[2] = 7;
    const report = await evolve.runAsync({ scope: { type: 'route-after', origin: { chapter: 1, stage: 2 }, count: 1 },
      originVehicle: origin, seed: 20261003, games: 1, workers: 2 });
    assert(['complete', 'failed'].includes(report.status));
    assert.strictEqual(report.chapters.length, 1);
    assert.strictEqual(report.chapters[0].stages.length, 1);
    const stage = report.chapters[0].stages[0];
    assert.strictEqual(stage.spec.stage, 3);
    assert(stage.top.length > 0, '失败时也必须保留前八名诊断候选');
    for (const rec of stage.top) {
      const vehicle = SA.V.fromCells(rec.name, rec.cells); vehicle.lim = { ...stage.spec.grid };
      assert(evolve.legalVehicle(SA, vehicle, stage.spec), '候选违反奖励、材料、模块或预算约束');
    }
    if (report.status === 'complete') {
      assert(stage.selected && stage.selection.previousWinRate >= 0.6 && stage.selection.previousWinRate <= 0.75);
      assert.strictEqual(stage.selection.previousGames, 120);
    } else {
      assert.strictEqual(stage.selected, null, '失败路线不能拿诊断候选推进');
      assert(report.selectionFailures.some(row => row.chapter === 1 && row.stage === 3));
    }
    return { stages: 4, anchors, workerStage: true, diagnosticPreserved: true, originPatch: 'side(6,6)→side(6,7)' };
  } finally {
    Object.assign(config.population, before);
    assert(original.equals(fs.readFileSync(stageFile)), '测试改变了手工关卡文件');
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
