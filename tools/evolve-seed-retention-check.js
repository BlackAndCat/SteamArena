/* 人工种子回归：同形态的不同材料车均参与首代评估，但不能占满次代留种。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const original = { ...config.population };
  config.population.size = 4;
  config.population.generations = 2;
  config.population.maxExtraGenerations = 0;
  try {
    const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
    const base = evolve.minimalVehicle(SA, spec);
    const seeds = ['基础', '驾驶舱熟铁', '履带熟铁'].map((name, index) => {
      const vehicle = SA.V.clone(base); vehicle.name = `种子·${name}`;
      if (index) SA.V.each(vehicle, cell => { if (cell.id === (index === 1 ? 'helmet' : 'track')) cell.mt = 2; });
      assert(evolve.legalVehicle(SA, vehicle, spec), `${name} 种子不合法`);
      return vehicle;
    });
    const evaluated = [];
    const pool = { evaluate: async ([task]) => {
      evaluated.push(task.vehicle);
      const stats = SA.V.stats(task.vehicle);
      return [{ stats, strength: 1100, previousWinRate: 0.65, performance: 60,
        efficiency: evolve.efficiencyScore(stats, spec), style: 'wander', chassis: 'track',
        terrainDelta: 0, featureDistance: 0, rows: [] }];
    } };
    const result = await evolve.generateChapterAsync(SA, spec, [], [], new evolve.RNG(88234), 1,
      pool, null, null, { completedCandidates: 0 }, seeds);
    for (const seed of seeds) assert(evaluated.includes(seed), `${seed.name} 未参与首代评估`);
    const retention = result.generationMetrics[0].seedRetention;
    assert.strictEqual(retention.length, 3, '种子来源记录不完整');
    assert(retention.filter(row => row.retained).length <= 2, '同形态种子占用超过两个留种名额');
    assert(retention.some(row => !row.retained && row.reason), '未入选种子缺少原因');
    return { firstGenerationSeeds: 3, retained: retention.filter(row => row.retained).length,
      rejectedReasons: retention.filter(row => !row.retained).map(row => row.reason) };
  } finally { Object.assign(config.population, original); }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
