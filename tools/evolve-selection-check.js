/* 选关回归：独立一百二十局复测相邻强度区间，并绑定双方最终 AI 性格。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
  const base = evolve.minimalVehicle(SA, spec);
  assert(base && evolve.legalVehicle(SA, base, spec), '缺少合法的奖励车测试构筑');
  const prior = SA.V.clone(base); prior.name = '前关入选车'; prior.testRate = 0;
  const reference = { vehicle: prior, style: 'turtle' };
  const calls = [];

  // 每轮两次换位共取连续的一百二十个种子，按20个种子为周期给出精确胜率。
  SA.Battle.simulate = options => {
    calls.push(options);
    const candidateIsP = !!options.p.testRate, candidate = candidateIsP ? options.p : options.e;
    const candidateWins = options.seed % 20 < candidate.testRate / 5;
    const winner = candidateWins ? (candidateIsP ? 'p' : 'e') : (candidateIsP ? 'e' : 'p');
    return { winner, t: 30, reason: '驾驶舱', pDealt: 10, eDealt: 10,
      events: { p: { fire: 1, hit: 1 }, e: { fire: 1, hit: 1 } }, metrics: {} };
  };
  const make = rate => {
    const vehicle = SA.V.clone(base); vehicle.name = `候选-${rate}`; vehicle.testRate = rate;
    return { vehicle, style: 'rush', performance: 60, strength: 1100, previousWinRate: rate / 100,
      efficiency: evolve.efficiencyScore(SA.V.stats(vehicle), spec), terrainDelta: 0 };
  };
  const choose = (rate, seed) => evolve.selectStageCandidate(SA, [make(rate)], spec, reference, 'check', seed);
  for (const rate of [60, 75]) {
    calls.length = 0;
    const result = choose(rate, 11000 + rate);
    assert(result.selected, `${rate}% 合格边界被拒绝`);
    assert.strictEqual(result.evidence.previousWinRate, rate / 100);
    assert.strictEqual(result.evidence.previousGames, 120, '复测没有进行双方各60局');
    assert.strictEqual(calls.length, 120);
    assert(calls.every(call => call.p.testRate ? call.pStyle === 'rush' && call.eStyle === 'turtle' :
      call.pStyle === 'turtle' && call.eStyle === 'rush'), '复测未使用双方绑定性格');
  }
  for (const rate of [50, 80]) {
    const result = choose(rate, 11000 + rate);
    assert.strictEqual(result.selected, null, `${rate}% 候选违反目标区间仍被入选`);
    assert(result.fallback, '未达标候选没有保留给后续模拟作临时参考');
    assert.strictEqual(result.evidence.targetPass, false, '诊断证据未记录强度失败');
    assert(result.evidence.failed.includes('target'));
  }
  const noReward = make(65);
  SA.V.each(noReward.vehicle, (cell, r, c, layer) => { if (cell.id === 'cannon') noReward.vehicle[layer][r][c] = null; });
  assert.strictEqual(evolve.selectStageCandidate(SA, [noReward], spec, reference, 'check', 12000).selected, null,
    '缺少本关奖励件仍被入选');
  return { boundaryAccepted: true, tooWeakRejected: true, tooStrongRejected: true, games: 120, stylesBound: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
