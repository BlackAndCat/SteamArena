/* 续代回归：训练合格但独立验收失败时继续搜索，最多只追加两代。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const original = { ...config.population };
  config.population.size = 4;
  config.population.generations = 1;
  config.population.maxExtraGenerations = 2;
  try {
    const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
    const pool = { evaluate: async ([task]) => {
      const stats = SA.V.stats(task.vehicle);
      return [{ stats, strength: 1100, previousWinRate: 0.65, performance: 60,
        efficiency: evolve.efficiencyScore(stats, spec), style: 'wander', chassis: 'track',
        terrainDelta: 0, featureDistance: 0, rows: [] }];
    } };
    const evaluate = async verify => evolve.generateChapterAsync(SA, spec, [], [], new evolve.RNG(81234), 1,
      pool, null, null, { completedCandidates: 0 }, [], verify);
    const failure = () => ({ selected: null, verified: [{ previousGames: 120 }], diversity: { clusterCount: 0 } });
    const success = scored => ({ selected: scored[0], verified: [{ previousGames: 120 }], diversity: { clusterCount: 3 } });

    let calls = 0;
    const recovered = await evaluate(scored => ++calls === 1 ? failure() : success(scored));
    assert.strictEqual(calls, 2, '首代独立验收失败后没有追加一代');
    assert.strictEqual(recovered.generationMetrics.length, 2);
    assert(recovered.selection.selected, '追加一代通过后没有保留入选车');
    assert.deepStrictEqual(recovered.generationMetrics.map(row => row.validationQualified), [false, true]);
    assert.deepStrictEqual(recovered.generationMetrics.map(row => row.validationGames), [120, 120]);

    calls = 0;
    const exhausted = await evaluate(() => { calls++; return failure(); });
    assert.strictEqual(calls, 3, '失败时未严格限制为基础代加两代');
    assert.strictEqual(exhausted.generationMetrics.length, 3);
    assert.strictEqual(exhausted.selection.selected, null, '用未通过候选冒充合格车');

    calls = 0;
    const sparseSuccess = scored => ({ selected: scored[0], verified: [{ previousGames: 120 }], diversity: { clusterCount: 1 } });
    const preserved = await evaluate(scored => ++calls === 1 ? sparseSuccess(scored) : failure());
    assert.strictEqual(calls, 3, '多样性不足应继续用完最多两代');
    assert(preserved.selection.selected, '后续两代失败时丢失先前已合格车');
    assert.strictEqual(preserved.selection.diversity.clusterCount, 1);
    return { recoveredAfterExtraGeneration: true, cappedAtThree: true, preservedQualifiedSparse: true };
  } finally { Object.assign(config.population, original); }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
