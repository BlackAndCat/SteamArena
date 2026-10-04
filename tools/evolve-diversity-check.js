/* 形态去重与有限动态调节回归：材料、改装、平移及镜像不制造假多样性。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame();
  const source = [['track', 8, 2], ['helmet', 6, 2], ['boiler_s', 6, 5], ['cannon', 4, 3]];
  function vehicle(parts, material = 1, level = 0) {
    const v = SA.V.create('形态夹具');
    for (const [id, r, c] of parts) {
      const cell = SA.newCell(id, material); cell.lv = level;
      v.body[r][c] = cell;
    }
    return v;
  }
  const base = vehicle(source), shifted = vehicle(source.map(([id, r, c]) => [id, r - 1, c + 1]));
  const width = Math.max(...source.map(([id, , c]) => c + SA.fp(id).w));
  const mirrored = vehicle(source.map(([id, r, c]) => [id, r, width - c - SA.fp(id).w]));
  const upgraded = vehicle(source, 2, 2);
  const biped = vehicle(source.map(([id, r, c]) => [id === 'track' ? 'biped' : id, r, c]));
  const rearranged = vehicle(source.map(([id, r, c]) => id === 'cannon' ? [id, 2, 8] : [id, r, c]));
  assert.strictEqual(evolve.shapeSimilarity(SA, base, shifted), 1, '平移被误认成新形态');
  assert.strictEqual(evolve.shapeSimilarity(SA, base, mirrored), 1, '左右镜像被误认成新形态');
  assert.strictEqual(evolve.shapeSimilarity(SA, base, upgraded), 1, '换材或改装被误认成新形态');
  assert.strictEqual(evolve.shapeSimilarity(SA, base, biped), 0, '底盘变化没有分簇');
  assert(evolve.shapeSimilarity(SA, base, rearranged) < 0.85, '明显布局变化没有分簇');
  const clusters = evolve.shapeClusters(SA, [base, shifted, mirrored, upgraded, biped, rearranged]);
  assert.strictEqual(clusters.length, 3, '形态簇数量错误');

  for (const rate of [0.6, 0.75]) assert.strictEqual(evolve.difficultyDistance(rate), 0, '区间边界被拒绝');
  assert(evolve.difficultyDistance(0.59) > 0 && evolve.difficultyDistance(0.76) > 0, '过弱或过强未计入偏离');
  let state = {};
  const concentrated = { clusterCount: 4, population: 24, largestClusterShare: 0.7, duplicateRatio: 0.6 };
  for (let i = 0; i < 8; i++) state = evolve.adaptiveSettings(concentrated, state);
  assert(state.freshRate <= 0.5 && state.freshRate > 0.2, '随机新车比例超出动态上限');
  assert(state.mutations <= 3 && state.mutations > 1, '结构变异次数超出动态上限');
  const healthy = { clusterCount: 20, population: 24, largestClusterShare: 0.15, duplicateRatio: 0.05 };
  state = evolve.adaptiveSettings(healthy, state);
  state = evolve.adaptiveSettings(healthy, state);
  assert(state.freshRate < 0.5 || state.mutations < 3, '连续两代恢复正常后没有回退');
  return { clusters: clusters.length, mirrored: true, boundedAdjustment: true, difficultyBounds: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
