/* 真实战斗的贴地混合精度抽样；只在独立 VM 中替换 settle 算术。 */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const evolve = require('./evolve');
const { installSettleF32 } = require('./evolve-settle-f32-reference');

const ROOT = path.resolve(__dirname, '..');
const TEMP = 'Z:\\AI\\CodexTemp';
const DEFAULT_OUTPUT = path.join(TEMP, 'evolve-precision-sampling-20261004.json');
const HASH = value => crypto.createHash('sha256').update(value).digest('hex');
const SOURCE = file => fs.readFileSync(path.join(ROOT, file));
const FIXTURE_DIR = path.join(TEMP, 'evolve-20261003-final-v3');

// 这些记录只用于重建合法样本车，不写回手工关卡或生成路线。
function vehicles(SA) {
  const original = JSON.parse(execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`,
    'show', 'HEAD:config/stage-cars.json'], { cwd: ROOT, encoding: 'utf8' })).records['1:2'];
  assert.strictEqual(original?.cells?.length, 11);
  const cells = structuredClone(original.cells);
  const range = cells.find(row => row[0] === 0 && row[1] === 6 && row[2] === 6 && row[3] === 'rangefinder');
  assert(range, '第三关测距仪原位置变化');
  range[0] = 1; range[2] = 7;
  const signature = HASH(JSON.stringify({ name: original.name, style: original.style, cells }));
  assert.strictEqual(signature, '3df4fd5a9be4860c9f79affe89f9b67b7f5ac19416ac4ed3532fe129370e2f83');
  const origin = SA.V.fromCells(original.name, cells);
  origin.lim = { ...evolve.previewStageSpec(SA, 1, 2).grid };
  const result = { origin: { id: 'origin-1-3', vehicle: origin, style: original.style || 'wander',
    source: 'HEAD:config/stage-cars.json，测距仪 [0,6,6]→[1,6,7]', signature } };
  for (const [key, seed, stage] of [['direct', 20261003, 3], ['mortar', 20261003, 4], ['biped', 20261004, 5]]) {
    const file = path.join(FIXTURE_DIR, `new-baseline-${seed}.json`);
    const raw = fs.readFileSync(file);
    const row = JSON.parse(raw).report.chapters.flatMap(chapter => chapter.stages)
      .find(item => item.spec.chapter === 1 && item.spec.stage === stage);
    assert(row?.selected?.cells, `第 ${stage + 1} 关入选车缺失`);
    const vehicle = SA.V.fromCells(row.selected.name, row.selected.cells);
    vehicle.lim = { ...row.spec.grid };
    result[key] = { id: `route-1-${stage + 1}-${seed}`, vehicle,
      style: row.selected.style || 'wander', source: file, signature: HASH(raw) };
  }
  const quad = SA.V.fromAscii('四足蜈蚣夹具', [
    '........', '........', '..C.....', '..K.....', '..OW....', 'Q.Q.....',
  ]);
  result.quad = { id: 'quad-stress', vehicle: quad, style: 'rush',
    source: 'tools/stress-test.js:chassisFixtures', signature: HASH(SOURCE('tools/stress-test.js')) };
  for (const row of Object.values(result))
    assert(SA.V.stats(row.vehicle, { deferHeat: true }).canDeploy, `${row.id} 不可出战`);
  return result;
}

function scenes() {
  return [
    { id: 'chapter-1-4-boundary', a: 'direct', b: 'origin', terrain: 'flat' },
    { id: 'chapter-1-5-reward', a: 'mortar', b: 'direct', terrain: 'flat' },
    { id: 'chapter-1-6-reward', a: 'biped', b: 'mortar', terrain: 'hills' },
    { id: 'quad-versus-biped-mine', a: 'quad', b: 'biped', terrain: 'mine' },
  ];
}

function battle(SA, cars, scene, index, seed) {
  const swap = index % 2 === 1, p = cars[swap ? scene.b : scene.a], e = cars[swap ? scene.a : scene.b];
  const result = SA.Battle.simulate({ p: p.vehicle, e: e.vehicle, pAim: 0.8, eAim: 0.8,
    pStyle: p.style, eStyle: e.style, terrain: scene.terrain, seed });
  const winner = result.winner === 'draw' ? 'draw' :
    result.winner === (swap ? 'e' : 'p') ? 'a' : 'b';
  return winner;
}

function score(winner) { return winner === 'a' ? 1 : winner === 'draw' ? 0.5 : 0; }
function summary(rows) {
  assert(rows.length > 0, '胜率统计需要至少一局');
  const wins = rows.filter(value => value === 'a').length;
  const draws = rows.filter(value => value === 'draw').length;
  const losses = rows.length - wins - draws;
  const values = rows.map(score), rate = values.reduce((a, b) => a + b, 0) / rows.length;
  const variance = values.reduce((a, b) => a + (b - rate) ** 2, 0) / Math.max(1, rows.length - 1);
  // 得分被限制在 [0,1]，Hoeffding 区间在全胜、全败时仍保留不确定性。
  const radius = Math.sqrt(Math.log(40) / (2 * rows.length));
  return { games: rows.length, wins, draws, losses, rate,
    se: Math.sqrt(variance / rows.length), ci95: [Math.max(0, rate - radius), Math.min(1, rate + radius)],
    ciMethod: 'Hoeffding 双侧至少 95%；胜平负得分范围 [0,1]' };
}

function paired(a, b) {
  assert.strictEqual(a.length, b.length);
  const diffs = a.map((winner, i) => score(b[i]) - score(winner));
  const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
  const variance = diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, diffs.length - 1);
  const se = Math.sqrt(variance / diffs.length);
  const changedWinner = a.filter((winner, i) => winner !== b[i]).length;
  // 零分歧不意味着两种精度等价；精确单侧上界限制未观察到的改变概率。
  const zeroChangeUpper = changedWinner === 0 ? 1 - Math.pow(0.05, 1 / a.length) : null;
  return { games: a.length, changedWinner: a.filter((winner, i) => winner !== b[i]).length,
    changedWinnerRate: changedWinner / a.length, changedWinnerRateUpper95: zeroChangeUpper,
    signedRateDifferenceF32MinusF64: mean, pairedSe: se,
    pairedCi95: changedWinner === 0 ? null : [mean - 1.96 * se, mean + 1.96 * se],
    signedBiasConservative95: changedWinner === 0 ? [-zeroChangeUpper, zeroChangeUpper] : null,
    ciNote: changedWinner === 0 ? '零分歧：正态配对区间无效；单侧精确 95% 分歧率上界及保守偏差界，不证明等价。' :
      '配对差的正态近似区间；离散结果或少量分歧时覆盖率可能不足。' };
}

function statsCheck() {
  const losses = summary(Array(32).fill('b'));
  const wins = summary(Array(32).fill('a'));
  assert(losses.ci95[1] > 0 && wins.ci95[0] < 1);
  const same = paired(Array(32).fill('a'), Array(32).fill('a'));
  assert.strictEqual(same.pairedCi95, null);
  assert(same.changedWinnerRateUpper95 > 0 && same.signedBiasConservative95[1] > 0);
  const different = paired(['a', 'b'], ['b', 'b']);
  assert(different.pairedCi95 && different.changedWinnerRateUpper95 === null);
  console.log(JSON.stringify({ valid: true, kind: 'pure-statistics', zeroChangeUpper: same.changedWinnerRateUpper95 }));
}

function blocks(rows, referenceRate, sizes) {
  return sizes.filter(size => rows.length >= size).map(size => {
    const rates = [];
    for (let start = 0; start + size <= rows.length; start += size)
      rates.push(summary(rows.slice(start, start + size)).rate);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    return { gamesPerBlock: size, blocks: rates.length, rates,
      variance: rates.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rates.length - 1),
      rmseAgainstSampledF64Reference: Math.sqrt(rates.reduce((a, b) => a + (b - referenceRate) ** 2, 0) / rates.length) };
  });
}

function tasks(mode, seedOffset = 0) {
  const calibrate = mode === 'calibrate', half = mode === 'half';
  const pairedN = calibrate ? 32 : half ? 512 : 1024;
  const independentF64N = calibrate ? 0 : half ? 1024 : 2048;
  const independentF32N = calibrate ? 0 : half ? 2048 : 4096;
  const out = [], size = calibrate ? 16 : 64;
  scenes().forEach((scene, sceneIndex) => {
    for (const [pool, precision, count] of [
      ['paired', 'f64', pairedN], ['paired', 'f32', pairedN],
      ['reference', 'f64', independentF64N], ['independent', 'f32', independentF32N],
      ['control', 'f64', calibrate ? 0 : half ? 512 : 1024],
    ]) for (let start = 0; start < count; start += size)
      out.push({ sceneIndex, pool, precision, start, count: Math.min(size, count - start),
        seedStart: (pool === 'paired' ? 31000000 : pool === 'reference' ? 71000000 : 61000000) +
          sceneIndex * 100000 + seedOffset });
  });
  // 交错两种精度与场景，减轻先后运行的 JIT 热机偏倚。
  const order = { 'paired-f64': 0, 'paired-f32': 1, 'reference-f64': 2,
    'independent-f32': 3, 'control-f64': 4 };
  return out.sort((a, b) => a.start - b.start || a.sceneIndex - b.sceneIndex ||
    order[`${a.pool}-${a.precision}`] - order[`${b.pool}-${b.precision}`]);
}

function workerMain() {
  const f64 = evolve.loadGame(), f32 = evolve.loadGame();
  installSettleF32(f32.context);
  const cars64 = vehicles(f64.SA), cars32 = vehicles(f32.SA), scenarioList = scenes();
  parentPort.on('message', task => {
    try {
      const start = performance.now(), game = task.precision === 'f32' ? f32 : f64;
      const cars = task.precision === 'f32' ? cars32 : cars64;
      const scene = scenarioList[task.sceneIndex], rows = [];
      for (let i = task.start; i < task.start + task.count; i++)
        rows.push(battle(game.SA, cars, scene, i, task.seedStart + i));
      parentPort.postMessage({ task, rows, workerTaskWallMs: performance.now() - start });
    } catch (error) { parentPort.postMessage({ task, error: error.stack || error.message }); }
  });
  parentPort.postMessage({ ready: true });
}

async function run(mode, options = {}) {
  assert(['calibrate', 'half', 'full', 'validate'].includes(mode));
  const seedOffset = options.seedOffset || 0, output = options.output || DEFAULT_OUTPUT;
  const timeoutMs = options.timeoutMs || 200000;
  assert(Number.isSafeInteger(seedOffset) && seedOffset >= 0 && seedOffset < 10000000,
    'seed-offset 应为 0～9999999 的整数');
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'timeout-ms 应为正整数');
  const started = performance.now(), queue = mode === 'validate' ? [] : tasks(mode, seedOffset);
  const all = queue.slice(), maxWorkers = Math.min(14, Math.max(1, queue.length));
  const results = new Map();
  let next = 0, done = 0, ready = 0, summedWorkerTaskWallMs = 0;
  const workers = [];
  let watchdog;
  try {
    await new Promise((resolve, reject) => {
      watchdog = setTimeout(() => reject(new Error(`抽样超过 ${timeoutMs} 毫秒硬限，结果不完整`)), timeoutMs);
      for (let index = 0; index < (mode === 'validate' ? 1 : maxWorkers); index++) {
        const worker = new Worker(__filename, { workerData: { kind: 'sample' } });
        workers.push(worker);
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0 && done < all.length) reject(new Error(`worker 退出：${code}`)); });
        worker.on('message', data => {
          if (data.ready) {
            ready++;
            if (mode === 'validate') { if (ready === workers.length) resolve(); }
            else worker.postMessage(queue[next++]);
            return;
          }
          if (data.error) { reject(new Error(data.error)); return; }
          summedWorkerTaskWallMs += data.workerTaskWallMs;
          results.set(`${data.task.sceneIndex}/${data.task.pool}/${data.task.precision}/${data.task.start}`, data);
          done++;
          if (next < queue.length) worker.postMessage(queue[next++]);
          if (done === all.length) resolve();
        });
      }
    });
  } catch (error) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ kind: 'settle-f32-mixed-precision-sampling', mode,
      status: 'incomplete', error: error.message, completedPackets: done, totalPackets: all.length,
      completedBattles: [...results.values()].reduce((n, row) => n + row.rows.length, 0),
      wallMs: performance.now() - started, summedWorkerTaskWallMs,
      parameters: { seedOffset, output, timeoutMs } }));
    throw error;
  } finally {
    clearTimeout(watchdog);
    await Promise.all(workers.map(worker => worker.terminate()));
  }
  const sourceHashes = Object.fromEntries(['js/battle.js', 'js/modules.js', 'js/vehicle.js',
    'tools/evolve-settle-f32-reference.js', 'tools/evolve-precision-sampling-check.js']
    .map(file => [file, HASH(SOURCE(file))]));
  const report = { kind: 'settle-f32-mixed-precision-sampling', mode,
    note: '仅贴地 settle 采点之后的算术逐步 f32；采点及其余真实战斗仍为 f64。该理想 f32 混合模型与真实 GPU WGSL 结果并非逐值一致，不能代表 GPU 整局。并行 worker 任务墙钟累加不是进程 CPU 耗时或独立吞吐。置信区间为近似值，独立 f64 参考也有采样不确定性。',
    sourceHashes, wallMs: performance.now() - started, summedWorkerTaskWallMs, workers: workers.length,
    parameters: { seedOffset, output, timeoutMs },
    packetGames: mode === 'calibrate' ? 16 : 64, totalBattles: all.reduce((n, row) => n + row.count, 0),
    scenarios: [] };
  if (mode === 'validate') {
    console.log(JSON.stringify({ valid: true, sourceHashes, workerStartupMs: report.wallMs }));
    return;
  }
  const baseCars = vehicles(evolve.loadGame().SA);
  for (const [sceneIndex, scene] of scenes().entries()) {
    const pools = {};
    for (const [pool, precision] of [['paired', 'f64'], ['paired', 'f32'], ['reference', 'f64'],
      ['independent', 'f32'], ['control', 'f64']]) {
      const packets = all.filter(task => task.sceneIndex === sceneIndex && task.pool === pool && task.precision === precision)
        .map(task => results.get(`${sceneIndex}/${pool}/${precision}/${task.start}`));
      pools[`${pool}-${precision}`] = packets.flatMap(packet => packet.rows);
    }
    const a = baseCars[scene.a], b = baseCars[scene.b];
    const entry = { ...scene, vehicles: [a, b].map(car => ({ id: car.id, name: car.vehicle.name,
      style: car.style, source: car.source, signature: car.signature })),
      seeds: { paired: [31000000 + seedOffset + sceneIndex * 100000,
          31000000 + seedOffset + sceneIndex * 100000 + pools['paired-f64'].length - 1],
        independent: [61000000 + seedOffset + sceneIndex * 100000,
          61000000 + seedOffset + sceneIndex * 100000 + pools['independent-f32'].length - 1],
        f64Reference: mode === 'calibrate' ? null : [71000000 + seedOffset + sceneIndex * 100000,
          71000000 + seedOffset + sceneIndex * 100000 + pools['reference-f64'].length - 1] },
      outcomes: pools,
      paired: { f64: summary(pools['paired-f64']), f32: summary(pools['paired-f32']),
        comparison: paired(pools['paired-f64'], pools['paired-f32']),
        workerTaskWallMs: Object.fromEntries(['f64', 'f32'].map(precision => [precision,
          all.filter(task => task.sceneIndex === sceneIndex && task.pool === 'paired' && task.precision === precision)
            .reduce((sum, task) => sum + results.get(`${sceneIndex}/paired/${precision}/${task.start}`).workerTaskWallMs, 0)])) } };
    if (mode === 'full' || mode === 'half') {
      const prefixSizes = mode === 'half' ? [128, 512, 1024, 2048] : [128, 512, 1024, 4096];
      entry.independent = { f64Reference: summary(pools['reference-f64']),
        f32Prefixes: prefixSizes.map(size => ({ size, ...summary(pools['independent-f32'].slice(0, size)) })),
        sameSeedControl: paired(pools['control-f64'], pools['independent-f32'].slice(0, pools['control-f64'].length)),
        blocks: blocks(pools['independent-f32'], summary(pools['reference-f64']).rate, prefixSizes),
        note: '每个分块的 RMSE 是相对含采样误差的 f64 参考值；只有一块的尺度不能证明波动已稳定。' };
      entry.expansionWorkerTaskWallMs = Object.fromEntries([['paired', 'f64'], ['paired', 'f32'], ['reference', 'f64'],
        ['independent', 'f32'], ['control', 'f64']].map(([pool, precision]) =>
        [`${pool}-${precision}`, all.filter(task => task.sceneIndex === sceneIndex && task.pool === pool && task.precision === precision)
          .reduce((sum, task) => sum + results.get(`${sceneIndex}/${pool}/${precision}/${task.start}`).workerTaskWallMs, 0)]));
      entry.independent.prefixWorkerTaskWallMs = Object.fromEntries(prefixSizes.map(size =>
        [size, all.filter(task => task.sceneIndex === sceneIndex && task.pool === 'independent' &&
          task.precision === 'f32' && task.start < size)
          .reduce((sum, task) => sum + results.get(`${sceneIndex}/independent/f32/${task.start}`).workerTaskWallMs, 0)]));
    }
    report.scenarios.push(entry);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ reportFile: output, mode, battles: report.totalBattles,
    wallMs: report.wallMs, summedWorkerTaskWallMs: report.summedWorkerTaskWallMs,
    scenarios: report.scenarios.map(row => ({ id: row.id, paired: row.paired })) }));
}

function cliOptions() {
  const value = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  return { seedOffset: value('seed-offset') == null ? 0 : Number(value('seed-offset')),
    output: value('output') || DEFAULT_OUTPUT,
    timeoutMs: value('timeout-ms') == null ? 200000 : Number(value('timeout-ms')) };
}

if (!isMainThread) workerMain();
else if (process.argv.includes('--stats-check')) statsCheck();
else run(process.argv.includes('--full') ? 'full' : process.argv.includes('--half') ? 'half' :
  process.argv.includes('--validate-only') ? 'validate' : 'calibrate', cliOptions())
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
