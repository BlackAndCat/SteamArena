/* 并行复测的零战斗协议检查：候选顺序、双向局数和最终选车共用同步逻辑。 */
'use strict';

const assert = require('node:assert/strict');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
  const base = evolve.minimalVehicle(SA, spec);
  assert(base && evolve.legalVehicle(SA, base, spec));
  const scored = [0, 1, 2].map(index => {
    const vehicle = SA.V.clone(base);
    vehicle.name = `协议候选${index}`;
    return { vehicle, style: ['wander', 'kite', 'turtle'][index], strength: 900 + index * 100,
      performance: 50 + index, efficiency: { total: 20 }, previousWinRate: 0.65 };
  });
  const reference = { vehicle: SA.V.clone(base), style: 'counter' }, seed = 20261004;
  const results = [
    { wins: 72, draws: 0, n: 120, winRate: 0.6, time: 17.5, performance: 63.25,
      sample: { winner: 'p', t: 13.5, events: { p: { fire: 3 } } } },
    { wins: 90, draws: 0, n: 120, winRate: 0.75, time: 20.25, performance: 70.5,
      sample: { winner: 'draw', t: 18.25, events: { p: { fire: 5 } } } },
    { wins: 96, draws: 0, n: 120, winRate: 0.8, time: 16.75, performance: 77.25,
      sample: { winner: 'e', t: 11.75, events: { p: { fire: 2 } } } },
  ];
  const byName = new Map([[scored[2].vehicle.name, results[0]], [scored[1].vehicle.name, results[1]], [scored[0].vehicle.name, results[2]]]);
  const batches = [], cache = evolve.createDuelCache(SA);
  const pool = { async evaluate(batch) { batches.push(batch); return batch.map(task => byName.get(task.candidate.name)); } };
  const parallel = await evolve.selectStageCandidateAsync(SA, scored, spec, reference, '协议规则', seed, [], pool, cache);
  const tasks = batches[0];
  assert.equal(tasks.length, 3);
  tasks.forEach((task, index) => {
    assert.equal(task.kind, 'duel');
    assert.equal(task.games, config.evaluation.finalDuelGames);
    assert.equal(task.seed, seed + 100000000 + index * 100003);
    assert.equal(task.candidate, scored[2 - index].vehicle);
    assert.equal(task.spec.style, scored[2 - index].style);
    assert.equal(task.spec.referenceStyle, 'counter');
  });
  const first = tasks[0], cached = cache.get(cache.key(first.candidate, first.opponent, first.spec, first.seed, first.games));
  assert.deepStrictEqual(cached, results[0], '异步回填必须保存完整对局聚合与样本');
  const serialDecision = evolve.selectStageCandidate(SA, scored, spec, reference, '协议规则', seed, [], null, results);
  assert.deepStrictEqual(parallel, serialDecision);
  assert.equal(parallel.verified.filter(row => row.targetPass).length, 2);
  // 同一批复测直接命中；换种子全失效，单车换性格仅重新提交该车。
  const repeated = await evolve.selectStageCandidateAsync(SA, scored, spec, reference, '协议规则', seed, [], pool, cache);
  assert.deepStrictEqual(repeated, parallel);
  assert.equal(batches.length, 1);
  await evolve.selectStageCandidateAsync(SA, scored, spec, reference, '协议规则', seed + 1, [], pool, cache);
  assert.equal(batches[1].length, 3);
  const changedStyle = scored.map((item, index) => index ? item : { ...item, style: 'rush' });
  await evolve.selectStageCandidateAsync(SA, changedStyle, spec, reference, '协议规则', seed + 1, [], pool, cache);
  assert.equal(batches[2].length, 1);
  assert.equal(batches[2][0].candidate.name, scored[0].vehicle.name);
  assert.deepStrictEqual({ hits: cache.summary().hits, misses: cache.summary().misses }, { hits: 6, misses: 7 });
  assert.throws(() => evolve.selectStageCandidate(SA, scored, spec, reference, '协议规则', seed, [], null,
    results.map((row, index) => index ? row : { ...row, n: 119 })), /场次不完整/);
  return { candidates: tasks.length, gamesPerCandidate: config.evaluation.finalDuelGames * 2,
    cache: { hits: cache.summary().hits, misses: cache.summary().misses },
    selected: parallel.selected?.vehicle.name || null };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { run };
