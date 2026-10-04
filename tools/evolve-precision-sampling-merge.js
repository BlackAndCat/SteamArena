/* 合并两批抽样报告；只对已有胜率块重算统计，不伪造第一批逐局结果。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TEMP = 'Z:\\AI\\CodexTemp';
const DEFAULT_FILES = [path.join(TEMP, 'evolve-precision-sampling-20261004.json'),
  path.join(TEMP, 'evolve-precision-sampling-replicate-20261004.json')];
const DEFAULT_OUTPUT = path.join(TEMP, 'evolve-precision-sampling-combined-20261004.json');
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const files = [option('first') || DEFAULT_FILES[0], option('second') || DEFAULT_FILES[1]];
const output = option('output') || DEFAULT_OUTPUT;

function sampleSummary(rows) {
  const games = rows.reduce((sum, row) => sum + row.games, 0);
  const wins = rows.reduce((sum, row) => sum + row.wins, 0);
  const draws = rows.reduce((sum, row) => sum + row.draws, 0);
  const losses = rows.reduce((sum, row) => sum + row.losses, 0);
  assert.strictEqual(games, wins + draws + losses);
  const rate = (wins + draws / 2) / games;
  const radius = Math.sqrt(Math.log(40) / (2 * games));
  return { games, wins, draws, losses, rate,
    ci95: [Math.max(0, rate - radius), Math.min(1, rate + radius)],
    ciMethod: 'Hoeffding 双侧至少 95%；将固定种子批次视作独立抽样' };
}

function blockStats(rates, referenceRate, size) {
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  return { gamesPerBlock: size, blocks: rates.length, rates,
    variance: rates.length > 1 ? rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1) : null,
    rmseAgainstSampledF64Reference: Math.sqrt(rates.reduce((a, b) => a + (b - referenceRate) ** 2, 0) / rates.length),
    singleBlockCaution: rates.length === 1 ? '单块没有可估计的块间波动，不能据此判断收敛。' : null };
}

function disjoint(a, b) { return a[1] < b[0] || b[1] < a[0]; }

function merge(first, second) {
  assert(first.mode === 'half' && second.mode === 'half', '仅合并两批相同 half 规模');
  assert(first.scenarios?.length === 4 && second.scenarios?.length === 4);
  for (const key of ['js/battle.js', 'js/modules.js', 'js/vehicle.js', 'tools/evolve-settle-f32-reference.js'])
    assert.strictEqual(first.sourceHashes[key], second.sourceHashes[key], `${key} 两批源码不同`);
  const result = { kind: 'settle-f32-mixed-precision-two-batch-comparison',
    note: '从两批已有的非重叠胜率块重新计算 RMSE 与方差；第一批未保存逐局序列，因此不重建逐局轨迹。f64 参考仍有采样不确定性；4096 仅一个块。',
    inputs: files.map((file, i) => ({ file, sourceHashes: [first, second][i].sourceHashes,
      parameters: [first, second][i].parameters || null })),
    totalBattles: first.totalBattles + second.totalBattles,
    wallMs: first.wallMs + second.wallMs,
    sourceHashes: Object.fromEntries(['js/battle.js', 'js/modules.js', 'js/vehicle.js',
      'tools/evolve-settle-f32-reference.js'].map(key => [key, first.sourceHashes[key]])),
    scenarios: [] };
  for (let i = 0; i < 4; i++) {
    const a = first.scenarios[i], b = second.scenarios[i];
    assert(a.id === b.id && a.a === b.a && a.b === b.b && a.terrain === b.terrain,
      `场景 ${i} 不一致`);
    assert.deepStrictEqual(a.vehicles, b.vehicles, `场景 ${a.id} 车辆或 AI 不一致`);
    for (const key of ['paired', 'independent', 'f64Reference'])
      assert(disjoint(a.seeds[key], b.seeds[key]), `${a.id} 的 ${key} 种子重叠`);
    const reference = sampleSummary([a.independent.f64Reference, b.independent.f64Reference]);
    const f32 = sampleSummary([a.independent.f32Prefixes.at(-1), b.independent.f32Prefixes.at(-1)]);
    const pairedF64 = sampleSummary([a.paired.f64, b.paired.f64]);
    const pairedF32 = sampleSummary([a.paired.f32, b.paired.f32]);
    const ca = a.paired.comparison, cb = b.paired.comparison, n = ca.games + cb.games;
    const changed = ca.changedWinner + cb.changedWinner;
    const controlA = a.independent.sameSeedControl, controlB = b.independent.sameSeedControl;
    const controlN = controlA.games + controlB.games;
    const controlChanged = controlA.changedWinner + controlB.changedWinner;
    const blocks = [128, 512, 1024, 2048].map(size => {
      const rates = [a, b].flatMap(row => row.independent.blocks.find(block => block.gamesPerBlock === size).rates);
      return blockStats(rates, reference.rate, size);
    });
    blocks.push(blockStats([f32.rate], reference.rate, 4096));
    result.scenarios.push({ id: a.id, a: a.a, b: a.b, terrain: a.terrain, vehicles: a.vehicles,
      seeds: [a.seeds, b.seeds],
      paired: { f64: pairedF64, f32: pairedF32, changedWinner: changed,
        changedWinnerRate: changed / n,
        zeroChangeUpper95: changed === 0 ? 1 - Math.pow(0.05, 1 / n) : null,
        signedRateDifferenceF32MinusF64: (ca.signedRateDifferenceF32MinusF64 * ca.games +
          cb.signedRateDifferenceF32MinusF64 * cb.games) / n,
        batchComparisons: [ca, cb],
        note: '总均值使用配对充分统计量；区间保留每批原有值，不构造未保存的逐局差序列。' },
      independent: { f64Reference: reference, f32All: f32, blocks,
        sameSeedControl: { games: controlN, changedWinner: controlChanged,
          changedWinnerRate: controlChanged / controlN,
          zeroChangeUpper95: controlChanged === 0 ? 1 - Math.pow(0.05, 1 / controlN) : null,
          signedRateDifferenceF32MinusF64: (controlA.signedRateDifferenceF32MinusF64 * controlA.games +
            controlB.signedRateDifferenceF32MinusF64 * controlB.games) / controlN,
          batchComparisons: [controlA, controlB] },
        batchPrefixResults: [a.independent.f32Prefixes, b.independent.f32Prefixes] } });
  }
  return result;
}

try {
  const reports = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  const result = merge(...reports);
  fs.writeFileSync(output, JSON.stringify(result));
  console.log(JSON.stringify({ reportFile: output, totalBattles: result.totalBattles,
    scenarios: result.scenarios.map(row => ({ id: row.id, pairedF64: row.paired.f64.rate,
      pairedF32: row.paired.f32.rate, changedWinner: row.paired.changedWinner,
      f64Reference: row.independent.f64Reference.rate, f32All: row.independent.f32All.rate,
      blocks: row.independent.blocks.map(block => ({ n: block.gamesPerBlock, count: block.blocks,
        rmse: block.rmseAgainstSampledF64Reference })) })) }));
} catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
