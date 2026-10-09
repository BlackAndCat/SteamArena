/* 端部装甲损毁回归：罚速在同一场战斗内解除，避免缓存停留在开局值。 */
'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./evolve');

function run(SA) {
  // 只保留一块履带前端装甲，使其被真实伤害击毁时罚速必然从 0.7 恢复到 1。
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
  let front;
  try {
    // 固定损毁目标，不依赖 AI 投降前是否偶然打中端甲；仍走正式伤害、销毁和刷新路径。
    SA.go = () => {};
    SA.S.reset(); SA.S.d.vehicle = armored;
    SA.Battle.startState({ mode: 'friendly', enemyVehicle: opponent, enemyName: '检查目标',
      terrain: 'flat', bounds: SA.CAMPAIGN[1].bounds });
    SA.V.each(SA.Battle.debug.B.p.v, (cell, r, c) => { if (cell.id === 'plate' && r === 10 && c === 15) front = cell; });
    assert(front, '检查车缺少唯一的端部装甲');
    SA.Battle.debug.damage('p', 10, 15, 'body', 1000);
    assert.equal(SA.Battle.debug.B.p.armorSpeedFactor, 1);
  } finally { SA.V.armorSpeedFactor = originalFactor; }
  assert.equal(front?.hp, 0, '真实伤害必须击毁唯一的端部装甲');
  assert(factors.includes(0.7) && factors.includes(1), '损毁后必须刷新并解除装甲罚速');
  return { from: 0.7, to: 1 };
}

if (require.main === module) {
  const result = run(loadGame().SA);
  console.log(`端部装甲损毁后罚速由 ${result.from} 恢复至 ${result.to}：通过`);
}
module.exports = run;
