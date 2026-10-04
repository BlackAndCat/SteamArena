/* 最终复测分包回归：固定种子、120 局和首局样本必须与旧整包完全一致。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const { createEvaluationPool } = require('./evolve-pool');

async function run() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
  const candidate = evolve.minimalVehicle(SA, spec);
  const opponent = evolve.requiredVehicle(SA, spec, new evolve.RNG(42));
  assert(candidate && opponent && evolve.legalVehicle(SA, candidate, spec) && evolve.legalVehicle(SA, opponent, spec));
  const task = { kind: 'duel', candidate, opponent,
    spec: { ...spec, style: 'wander', referenceStyle: 'kite' }, seed: 20261004, games: 60 };
  const oldPool = createEvaluationPool(14, { splitFinalDuels: false });
  const splitPool = createEvaluationPool(14);
  try {
    const [old] = await oldPool.evaluate([task]);
    const [split] = await splitPool.evaluate([task]);
    assert.strictEqual(old.n, 120);
    assert.deepStrictEqual(split, old, '分包结果、浮点均值或首局 sample 与整包不同');
    const synchronous = evolve.duel(SA, candidate, opponent, task.spec, task.seed, task.games);
    assert.strictEqual(JSON.stringify(synchronous), JSON.stringify(old), '同步 duel 与 worker 不同');
    assert.strictEqual(split.sample.seed, task.seed);
    return { valid: true, games: split.n, packets: 8,
      wins: split.wins, draws: split.draws, winRate: split.winRate,
      sampleSeed: split.sample.seed, exactResultAndSample: true };
  } finally { await oldPool.close(); await splitPool.close(); }
}

function validateOnly() {
  // 此检查不模拟战斗，只核对 60 对种子拆分覆盖一次且顺序连续。
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 3);
  const candidate = evolve.minimalVehicle(SA, spec);
  const opponent = evolve.requiredVehicle(SA, spec, new evolve.RNG(42));
  assert(candidate && opponent && evolve.legalVehicle(SA, candidate, spec) && evolve.legalVehicle(SA, opponent, spec));
  const pairs = [];
  for (let start = 0; start < 60; start += 8)
    for (let i = start; i < Math.min(60, start + 8); i++) pairs.push(i);
  assert.deepStrictEqual(pairs, Array.from({ length: 60 }, (_, i) => i));
  // 假战斗只返回随种子变化的记录，验证左右角色、种子与浮点归约顺序，不运行负载。
  const calls = [], fakeSA = { Battle: { simulate(options) {
    calls.push(options);
    return { winner: options.seed % 3 === 0 ? 'draw' : options.seed % 2 ? 'e' : 'p',
      t: 0.1 + options.seed % 17 / 7, pDealt: 1, eDealt: 2 };
  } } };
  const seed = 20261004;
  const wholeRows = evolve.duelRows(fakeSA, candidate, opponent, spec, seed, 0, 60);
  assert.deepStrictEqual(calls.map(call => call.seed), Array.from({ length: 120 }, (_, i) => seed + i));
  for (let i = 0; i < calls.length; i++) {
    assert.strictEqual(calls[i].p, i % 2 ? opponent : candidate);
    assert.strictEqual(calls[i].e, i % 2 ? candidate : opponent);
  }
  const splitRows = [];
  for (let start = 0; start < 60; start += 8)
    splitRows.push(...evolve.duelRows(fakeSA, candidate, opponent, spec, seed, start, Math.min(8, 60 - start)));
  assert.deepStrictEqual(splitRows, wholeRows);
  assert.deepStrictEqual(evolve.reduceDuelRows(splitRows, 60), evolve.reduceDuelRows(wholeRows, 60));
  assert.throws(() => evolve.reduceDuelRows(splitRows.slice(1), 60), /数量不符/);
  console.log(JSON.stringify({ valid: true, pairs: pairs.length, packets: 8, syntheticRows: 120, exactReduction: true }));
}

if (process.argv.includes('--validate-only')) validateOnly();
else run().then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
