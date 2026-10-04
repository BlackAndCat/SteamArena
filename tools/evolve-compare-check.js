/* 对照报告回归：路线失败和未生成关卡不能被误计为达标或零违规。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const evolve = require('./evolve');
const compare = require('./evolve-compare');

function run() {
  const { SA } = evolve.loadGame(), vehicle = SA.S.starterVehicle();
  const cells = SA.StageCars.cellsOf(vehicle);
  const top = ['甲', '乙', '丙'].map(name => ({ name, cells }));
  const report = { chapters: [{ stages: [{ spec: { chapter: 1, stage: 3 }, selected: null, top,
    selection: { failed: ['target'], verified: [
      { name: '甲', failed: [], previousGames: 120 },
      { name: '乙', failed: [], previousGames: 120 },
      { name: '丙', failed: [], previousGames: 6 },
    ] } }] }] };
  const result = compare.compareRun(SA, report, { origin: { vehicle, style: 'wander' }, policies: {} });
  assert.deepStrictEqual(result.stages.map(row => row.status), ['failed', 'not_run', 'not_run', 'not_run']);
  assert.strictEqual(result.stages[0].qualifiedDiversity.candidates, 2, '6局候选误计为120局合格候选');
  assert.strictEqual(result.stages[0].qualifiedDiversity.clusters, 1, '重复形态误计为多个簇');
  assert.strictEqual(result.stages[0].qualifiedClustersAtLeast3, false);
  assert.strictEqual(result.selectedSimilarPairs, null, '未完成路线误称六组配对零相似');
  assert.strictEqual(result.selectedSimilarPairsAtMost2, null);
  for (const row of result.stages.slice(1))
    assert(!Object.hasOwn(row, 'rewardMissing') && !Object.hasOwn(row, 'budgetViolation'), '未到达关卡误报零违规');
  const countReport = { chapters: [{ stages: [{ spec: { chapter: 1, stage: 3, terrain: 'flat' }, count: 24,
    top: [{ styleTrials: Array(11).fill({}), opponentCount: 6, games: 72, previousGames: 12 }],
    generationMetrics: [{ validationGames: 0 }, { validationGames: 960 }],
    originComparison: { games: 12 } }] }] };
  const counts = compare.battleCounts(countReport, { games: 6 }, true);
  assert.deepStrictEqual([counts.searchGames, counts.validationGames, counts.originGames, counts.totalKnownGames],
    [5088, 960, 12, 6060], '搜索、独立验收或原点对战计数重复/遗漏');
  const fixtureIndex = process.argv.indexOf('--origin-fixture');
  if (fixtureIndex >= 0) {
    const fixturePath = process.argv[fixtureIndex + 1];
    assert(fixturePath, '缺少第三关 fixture 路径');
    const valid = compare.origin(SA, fixturePath);
    assert.strictEqual(valid.vehicle.name, '煤灰寡妇');
    const altered = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    altered.cells.push([0, 7, 7, 'plate', 1, 0]);
    const { signature, ...payload } = altered;
    altered.signature = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-origin-check-'));
    try {
      const file = path.join(temporary, 'wrong-origin.json');
      fs.writeFileSync(file, JSON.stringify(altered));
      assert.throws(() => compare.origin(SA, file), /其他改动/, '签名正确但多装甲的 12 件原点必须拒绝');
    } finally { fs.rmSync(temporary, { recursive: true }); }
  }
  return { statuses: result.stages.map(row => row.status), qualifiedCandidates: 2,
    unrunPairMetric: null, battleCountsVerified: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
