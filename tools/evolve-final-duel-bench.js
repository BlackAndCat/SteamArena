/* 固定单关进化任务的三模式对照：只生成测试报告，不写正式关卡车。 */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const evolve = require('./evolve');
const config = require('./evolve-config');

const ROOT = path.resolve(__dirname, '..');
const TEMP = 'Z:\\AI\\CodexTemp';
const FIXTURE = path.join(TEMP, 'evolve-20261003-origin-fixture.json');
const SHA = value => crypto.createHash('sha256').update(value).digest('hex');
const MODE = process.argv.find(arg => arg.startsWith('--mode='))?.slice(7);
const SMOKE = process.argv.includes('--smoke');
const OUTPUT = path.join(TEMP, `evolve-final-duel-bench-${MODE}${SMOKE ? '-smoke' : ''}.json`);
const DIAGNOSTICS = OUTPUT.replace(/\.json$/, '-diagnostics.json');
const timeoutArgument = process.argv.find(arg => arg.startsWith('--timeout-ms='));
const HARD_LIMIT_MS = timeoutArgument == null ? 60000 : Number(timeoutArgument.slice(13));
assert(Number.isInteger(HARD_LIMIT_MS) && HARD_LIMIT_MS > 0 && HARD_LIMIT_MS <= 60000,
  '测试硬限必须为 1～60000 毫秒的整数');

function originFixture() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const { signature, ...payload } = fixture;
  assert.strictEqual(SHA(JSON.stringify(payload)), signature, '原点副本签名变化');
  const source = fs.readFileSync(fixture.source.path);
  assert.strictEqual(SHA(source), fixture.source.fileSha256, '原点记录文件变化');
  const record = JSON.parse(source).records['1:2'];
  assert.strictEqual(SHA(JSON.stringify(record)), fixture.source.recordSha256, '第三关原始车变化');
  assert.strictEqual(fixture.patch.changedCellCount, 1);
  return { name: fixture.name, cells: fixture.cells, style: fixture.style || 'wander', signature };
}

function reportSummary(report, mode, elapsedMs, origin) {
  const stages = report.chapters.flatMap(chapter => chapter.stages);
  // functionalHash 包含每代候选、详细前关复测、sample 和入选车，排除耗时与 GPU 遥测。
  const functional = { status: report.status, rules: report.rules, chapters: report.chapters,
    candidates: report.candidates, selectionFailures: report.selectionFailures, seedWarnings: report.seedWarnings };
  const selected = stages.map(stage => ({ chapter: stage.spec.chapter, stage: stage.spec.stage,
    name: stage.selected?.name || null, cells: stage.selected?.cells || null,
    style: stage.selected?.style || null,
    modules: stage.selected?.cells?.map(cell => cell[3]) || [],
    previousWinRate: stage.selection?.previousWinRate ?? null,
    targetPass: stage.selection?.targetPass ?? false,
    failed: stage.selection?.failed || [],
    verified: stage.selection?.verified || [] }));
  return { kind: 'evolve-final-duel-three-mode-benchmark', mode, status: report.status,
    elapsedMs, workerCount: 14, finalDuelPacketGames: mode === 'old-cpu' ? 120 : 16,
    requested: { population: SMOKE ? 4 : 24, generations: 1, maxExtraGenerations: SMOKE ? 0 : 2, quickGames: 1,
      finalDuelGamesPerCandidate: 120, seed: 20261003,
      scope: { type: 'route-after', origin: { chapter: 1, stage: 2 }, count: 1 } },
    origin: { name: origin.name, signature: origin.signature }, rules: report.rules,
    functionalHash: SHA(JSON.stringify(functional)), selected,
    finalValidationBattles: stages.reduce((sum, stage) => sum + (stage.selection?.verified?.length || 0) * 120, 0),
    constraintsViolationCount: stages.reduce((sum, stage) => sum + (stage.selection?.failed?.length || 0), 0),
    telemetry: report.telemetry, sourceHashes: Object.fromEntries(['tools/evolve.js', 'tools/evolve-pool.js',
      'tools/evolve-worker.js', 'tools/evolve-gpu-heat.js', 'js/vehicle.js', 'js/battle.js']
      .map(file => [file, SHA(fs.readFileSync(path.join(ROOT, file)))])) };
}

async function child() {
  assert(['old-cpu', 'split-cpu', 'split-gpu'].includes(MODE), '未知模式');
  const origin = originFixture();
  Object.assign(config.population, { size: SMOKE ? 4 : 24, generations: 1, maxExtraGenerations: SMOKE ? 0 : 2 });
  const started = performance.now();
  const diagnostics = { mode: MODE, smoke: SMOKE, status: 'running', phases: [], heat: null };
  let lastWrite = -Infinity;
  function record(event) {
    diagnostics.phases.push({ ...event, childElapsedMs: performance.now() - started });
    if (event.heat) diagnostics.heat = event.heat;
    // 按阶段或最多每秒两次落盘，超时后也能定位初始化、预热和复测耗时。
    const now = performance.now();
    if (event.phase !== 'candidate' || now - lastWrite >= 500) {
      fs.writeFileSync(DIAGNOSTICS, JSON.stringify(diagnostics)); lastWrite = now;
    }
  }
  record({ phase: 'child-run-start' });
  const report = await evolve.runAsync({ scope: { type: 'route-after', origin: { chapter: 1, stage: 2 }, count: 1 },
    originVehicle: origin, seed: 20261003, games: 1, workers: 14,
    gpu: MODE === 'split-gpu', splitFinalDuels: MODE !== 'old-cpu',
    onProgress: record, onDiagnostics: record,
    onCheckpoint: partial => { diagnostics.partialTelemetry = partial.telemetry; record({ phase: 'checkpoint' }); } });
  const result = reportSummary(report, MODE, performance.now() - started, origin);
  diagnostics.status = 'complete'; diagnostics.partialTelemetry = report.telemetry;
  record({ phase: 'child-run-complete' });
  result.diagnosticsFile = DIAGNOSTICS;
  fs.writeFileSync(OUTPUT, JSON.stringify(result));
  console.log(JSON.stringify({ reportFile: OUTPUT, mode: MODE, status: result.status,
    elapsedMs: result.elapsedMs, functionalHash: result.functionalHash,
    finalValidationBattles: result.finalValidationBattles, heat: result.telemetry.heat }));
}

if (process.argv.includes('--child')) child().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
else if (process.argv.includes('--validate-only')) {
  assert(['old-cpu', 'split-cpu', 'split-gpu'].includes(MODE));
  const origin = originFixture();
  console.log(JSON.stringify({ valid: true, mode: MODE, origin: origin.name, signature: origin.signature }));
} else {
  assert(['old-cpu', 'split-cpu', 'split-gpu'].includes(MODE));
  const parentStarted = performance.now();
  const childProcess = spawn(process.execPath, [__filename, `--mode=${MODE}`, '--child', ...(SMOKE ? ['--smoke'] : [])],
    { cwd: ROOT, stdio: 'inherit', windowsHide: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // 清理该测试子进程的整棵树，避免硬限后留下 GPU Chrome 宿主。
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => childProcess.kill());
    } else childProcess.kill();
    fs.writeFileSync(OUTPUT, JSON.stringify({ kind: 'evolve-final-duel-three-mode-benchmark',
      mode: MODE, smoke: SMOKE, diagnosticsFile: DIAGNOSTICS,
      status: 'incomplete', reason: `${HARD_LIMIT_MS} 毫秒硬限` }));
    console.error('测试超时，未完成的结果不能用于速度或正确性比较');
  }, HARD_LIMIT_MS);
  childProcess.on('exit', code => {
    clearTimeout(timer);
    const wallClockMs = performance.now() - parentStarted;
    if (fs.existsSync(OUTPUT)) {
      const result = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
      result.wallClockMs = wallClockMs;
      result.hardLimitMs = HARD_LIMIT_MS;
      result.wallClockScope = '含子进程启动、规则加载、GPU 宿主关闭及 worker 清理';
      fs.writeFileSync(OUTPUT, JSON.stringify(result));
    }
    console.log(JSON.stringify({ mode: MODE, wallClockMs, timedOut, reportFile: OUTPUT }));
    process.exitCode = timedOut ? 124 : code ?? 1;
  });
}
