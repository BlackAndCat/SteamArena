/* 旧 Boss 诊断只补报告，不能改动搜索阶段保存的候选和筛选证据。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
  const vehicle = evolve.minimalVehicle(SA, spec);
  const selected = { name: vehicle.name, cells: SA.StageCars.cellsOf(vehicle), style: 'wander' };
  const origin = structuredClone(SA.STAGE_CARS.records['1:2']);
  const finder = origin.cells.find(cell => cell[3] === 'rangefinder' && cell[1] === 6 && cell[2] === 6);
  assert(finder, '测试原点测距仪位置已改变');
  finder[0] = 1; finder[2] = 7;
  const stage = { spec, selected, selection: { selected: true, previousWinRate: 0.65 },
    top: [{ name: vehicle.name, cells: selected.cells }], generationMetrics: [{ generation: 0, clusterCount: 3 }],
    originComparison: { games: 120, wins: 78, draws: 0, winRate: 0.65 } };
  const report = { seed: 20261003, rules: evolve.ruleFingerprint(SA),
    scope: { type: 'route-after', origin: { chapter: 1, stage: 2 } }, chapters: [{ chapter: 1, stages: [stage] }] };
  const before = JSON.stringify(report);
  const enriched = evolve.enrichBossDiagnostics(report, { originVehicle: origin, snapshotHash: 'frozen-test-hash' });
  assert.strictEqual(JSON.stringify(report), before, '后处理修改了原始报告');
  assert.notStrictEqual(enriched, report, '后处理未返回独立报告');
  const result = enriched.chapters[0].stages[0];
  for (const key of ['selected', 'selection', 'top', 'generationMetrics'])
    assert.deepStrictEqual(result[key], structuredClone(stage[key]), `${key} 被诊断后处理改动`);
  assert.strictEqual(result.legacyBossDiagnostic.available, true, '没有复用原点诊断');
  assert.strictEqual(result.legacyBossDiagnostic.source, '已记录的原点对战');
  assert.strictEqual(result.legacyBossDiagnostic.candidateWinRate, 0.65);
  assert.strictEqual(enriched.bossDiagnosticsEnrichment.generatedSnapshotHash, 'frozen-test-hash');
  assert(enriched.bossDiagnosticsEnrichment.version, '补充版本未记录');
  return { unchangedSelectionEvidence: true, reusedOriginGames: 120,
    enrichmentVersion: enriched.bossDiagnosticsEnrichment.version };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
