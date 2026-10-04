/* 端部装甲损毁回归：罚速在同一场战斗内解除，避免缓存停留在开局值。 */
'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./evolve');

function run(SA) {
  // 只保留一块履带前端装甲，使其被击毁时罚速必然从 0.7 恢复到 1。
  const armored = SA.V.fromCells('端部装甲车', [
    [0, 7, 2, 'plate', 1, 0], [0, 7, 3, 'plate', 1, 0], [0, 7, 4, 'plate', 1, 0],
    [0, 7, 5, 'armor', 1, 0], [0, 8, 2, 'tank_s', 1, 0], [0, 8, 3, 'boiler', 1, 0],
    [0, 8, 6, 'plate', 1, 0], [0, 9, 2, 'helmet', 1, 0], [0, 9, 5, 'cannon_m', 2, 0],
    [0, 10, 2, 'track', 1, 0], [0, 10, 4, 'track', 1, 0], [0, 10, 6, 'plate', 1, 0],
  ]);
  const opponent = SA.V.fromCells('臼炮车', [
    [0, 6, 5, 'mortar', 1, 0], [0, 6, 7, 'mortar_s', 1, 0], [0, 8, 3, 'cockpit_pair', 1, 0],
    [0, 8, 4, 'boiler', 1, 0], [0, 8, 6, 'tank_tall', 1, 0], [0, 9, 2, 'tank_s', 1, 0],
    [0, 10, 3, 'track', 1, 0],
  ]);
  assert(SA.V.stats(armored).canDeploy && SA.V.stats(opponent).canDeploy);
  assert.equal(SA.V.armorSpeedFactor(armored), 0.7);

  // 记录正式 refresh 所见的因子；不暴露战斗内部状态，也不改动伤害过程。
  const originalFactor = SA.V.armorSpeedFactor, factors = [];
  SA.V.armorSpeedFactor = vehicle => {
    const factor = originalFactor(vehicle);
    factors.push(factor);
    return factor;
  };
  let result;
  try {
    result = SA.Battle.simulate({ p: armored, e: opponent, pStyle: 'wander', eStyle: 'wander',
      terrain: 'flat', bounds: SA.CAMPAIGN[1].bounds, seed: 20261098 });
  } finally { SA.V.armorSpeedFactor = originalFactor; }
  const front = result.state.p.cells.find(cell => cell.id === 'plate' && cell.r === 10 && cell.c === 15);
  assert.equal(front?.hp, 0, '固定战斗必须击毁唯一的端部装甲');
  assert(factors.includes(0.7) && factors.includes(1), '损毁后必须刷新并解除装甲罚速');
  return { from: 0.7, to: 1, seed: 20261098 };
}

if (require.main === module) {
  const result = run(loadGame().SA);
  console.log(`端部装甲损毁后罚速由 ${result.from} 恢复至 ${result.to}：通过`);
}
module.exports = run;
