/* settle 真实输入记录：只在独立 VM 内插入观察点，生产战斗代码和关卡车均不改动。 */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn, execFileSync } = require('child_process');
const evolve = require('./evolve');

const ROOT = path.resolve(__dirname, '..');
const TEMP = 'Z:\\AI\\CodexTemp';
const OUTPUT = path.join(TEMP, 'evolve-physics-trace-20261004.json');
const HARD_LIMIT_MS = 25000;
const SHA = value => crypto.createHash('sha256').update(value).digest('hex');

function sourceVehicle(SA, seed, stage) {
  const file = path.join(TEMP, 'evolve-20261003-final-v3', `new-baseline-${seed}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const row = data.report.chapters.flatMap(chapter => chapter.stages)
    .find(item => item.spec.chapter === 1 && item.spec.stage === stage);
  assert(row?.selected?.cells, `第 ${stage + 1} 关保存候选不存在`);
  const vehicle = SA.V.fromCells(row.selected.name, row.selected.cells);
  vehicle.lim = { ...row.spec.grid };
  assert(SA.V.stats(vehicle, { deferHeat: true }).canDeploy, `保存候选 ${vehicle.name} 非法`);
  return { id: `route-${stage + 1}-${seed}`, vehicle, style: row.selected.style || 'wander',
    source: file, sourceSha256: SHA(fs.readFileSync(file)) };
}

function originVehicle(SA) {
  const record = JSON.parse(execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`,
    'show', 'HEAD:config/stage-cars.json'], { cwd: ROOT, encoding: 'utf8' })).records['1:2'];
  assert.strictEqual(record?.cells?.length, 11);
  const cells = structuredClone(record.cells);
  const finder = cells.find(cell => cell[0] === 0 && cell[1] === 6 && cell[2] === 6 && cell[3] === 'rangefinder');
  assert(finder); finder[0] = 1; finder[2] = 7;
  const signature = SHA(JSON.stringify({ name: record.name, style: record.style, cells }));
  assert.strictEqual(signature, '3df4fd5a9be4860c9f79affe89f9b67b7f5ac19416ac4ed3532fe129370e2f83');
  const vehicle = SA.V.fromCells(record.name, cells);
  vehicle.lim = { ...evolve.previewStageSpec(SA, 1, 2).grid };
  assert(SA.V.stats(vehicle, { deferHeat: true }).canDeploy);
  return { id: 'origin-1-3', vehicle, style: record.style || 'wander',
    source: 'HEAD:config/stage-cars.json，测距仪 [0,6,6]→[1,6,7]', sourceSha256: signature };
}

function quadVehicle(SA) {
  const vehicle = SA.V.fromAscii('四足蜈蚣夹具', [
    '........', '........', '..C.....', '..K.....', '..OW....', 'Q.Q.....',
  ]);
  const stats = SA.V.stats(vehicle, { deferHeat: true });
  assert(stats.canDeploy && stats.byId.quad === 2 && !stats.issues.length);
  return { id: 'quad-stress', vehicle, style: 'rush', source: 'tools/stress-test.js:chassisFixtures',
    sourceSha256: SHA(fs.readFileSync(path.join(ROOT, 'tools/stress-test.js'))) };
}

function scenarios(SA) {
  const origin = originVehicle(SA), direct = sourceVehicle(SA, 20261003, 3),
    high = sourceVehicle(SA, 20261003, 4), biped = sourceVehicle(SA, 20261004, 5), quad = quadVehicle(SA);
  assert(SA.TERRAINS.hills?.hills?.length && SA.TERRAINS.mine?.hills?.length,
    '当前游戏缺少真实非平地地形');
  return [
    { id: 'flat-track', terrain: 'flat', seed: 20261003, p: origin, e: direct },
    { id: 'hills-biped', terrain: 'hills', seed: 20261004, p: high, e: biped },
    { id: 'mine-quad', terrain: 'mine', seed: 20261005, p: quad, e: direct },
  ];
}

function modifiedBattle(text) {
  const before = '    for (const p of pts) p.y = groundAt(p.x);';
  const after = '    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;';
  const follow = '    const follow = (SA.MODULES[s.chassisId] && SA.MODULES[s.chassisId].susp || { follow: 1 }).follow;';
  const rigid = '    for (const x of rigid) hi = Math.min(hi, rel(x, groundAt(x)) + T.SETTLE_RIGID_CLEARANCE);';
  const finish = '    for (const p of pts) if (p.key) (s.gnd[p.key] = s.gnd[p.key] || [0, 0])[p.i] = clamp((p.r - py) * cs, -p.up, p.down);';
  for (const needle of [before, after, follow, rigid, finish])
    assert.strictEqual(text.split(needle).length, 2, `settle 插桩位置变化：${needle}`);
  // 只观察已经由原逻辑采样的 pts；刚性点将原本唯一一次 groundAt 返回值同时交给记录器。
  return text.replace(follow, `${follow}\n    const __trace = window.__settleTrace?.before({ s, dt, xc, pts, rigid, follow, terrain: B.ter?.id, side: isP(s) ? 'p' : 'e',\n      constants: { tiltMax: T.SETTLE_TILT_MAX, tiltResponse: T.SETTLE_TILT_RESPONSE,\n        heightResponse: T.SETTLE_HEIGHT_RESPONSE, rigidClearance: T.SETTLE_RIGID_CLEARANCE, ground: GROUND } });`)
    .replace(rigid, '    for (const x of rigid) { const y = groundAt(x); if (__trace) window.__settleTrace.ground(__trace, x, y); hi = Math.min(hi, rel(x, y) + T.SETTLE_RIGID_CLEARANCE); }')
    .replace(finish, `${finish}\n    if (__trace) window.__settleTrace.after(__trace, s);`);
}

function recorder(SA) {
  const rows = [];
  let scene = null, callIndex = 0;
  return {
    rows,
    scene(id) { scene = id; },
    before({ s, dt, xc, pts, rigid, follow, terrain, side, constants }) {
      const modules = [];
      SA.V.each(s.v, (cell, r, c, layer) => modules.push({ layer, r, c, id: cell.id,
        mt: cell.mt || 1, lv: cell.lv || 0, hp: cell.hp }));
      const row = { source: { scene, terrain, side, vehicle: s.v.name, chassisId: s.chassisId, modules },
        callIndex: callIndex++, dt, xc, kw0: s.kw, yo0: s.yo, pivX0: s.pivX,
        gnd0: structuredClone(s.gnd), follow,
        pts: pts.map(p => ({ x: p.x, y: p.y, up: p.up, down: p.down,
          key: Object.hasOwn(p, 'key') ? p.key : null, keyPresent: Object.hasOwn(p, 'key'),
          i: Object.hasOwn(p, 'i') ? p.i : null, iPresent: Object.hasOwn(p, 'i') })),
        rigid: [], rigidX: rigid.slice(), constants, expected: null };
      rows.push(row);
      return row;
    },
    ground(row, x, y) { row.rigid.push({ x, y }); },
    after(row, s) { row.expected = { kw: s.kw, yo: s.yo, pivX: s.pivX, gnd: structuredClone(s.gnd) }; },
  };
}

function battle(SA, scene) {
  const result = SA.Battle.simulate({ p: scene.p.vehicle, e: scene.e.vehicle, pAim: 0.8, eAim: 0.8,
    pStyle: scene.p.style, eStyle: scene.e.style, terrain: scene.terrain, seed: scene.seed });
  return { id: scene.id, seed: scene.seed, terrain: scene.terrain, p: scene.p.id, e: scene.e.id,
    resultHash: SHA(JSON.stringify(result)), winner: result.winner, seconds: result.t };
}

function runChild() {
  const baseline = evolve.loadGame(), traced = evolve.loadGame();
  const text = fs.readFileSync(path.join(ROOT, 'js/battle.js'), 'utf8');
  const altered = modifiedBattle(text);
  const baselineScenes = scenarios(baseline.SA), traceScenes = scenarios(traced.SA);
  const hashes = Object.fromEntries(['js/battle.js', 'js/modules.js', 'js/vehicle.js', 'tools/stress-test.js']
    .map(file => [file, SHA(fs.readFileSync(path.join(ROOT, file)))]));
  if (process.argv.includes('--validate-only')) {
    traced.context.__settleTrace = recorder(traced.SA);
    vm.runInContext(altered, traced.context, { filename: 'js/battle.js#trace-only' });
    assert.strictEqual(typeof traced.SA.Battle.simulate, 'function');
    console.log(JSON.stringify({ valid: true, sourceHashes: hashes,
      scenarios: baselineScenes.map(({ id, terrain, seed, p, e }) => ({ id, terrain, seed, p: p.id, e: e.id })),
      insertionSha256: SHA(altered) }));
    return;
  }
  const capture = recorder(traced.SA);
  traced.context.__settleTrace = capture;
  vm.runInContext(altered, traced.context, { filename: 'js/battle.js#trace-only' });
  const originalResults = baselineScenes.map(scene => battle(baseline.SA, scene));
  const tracedResults = traceScenes.map(scene => { capture.scene(scene.id); return battle(traced.SA, scene); });
  assert.deepStrictEqual(tracedResults, originalResults, '插桩改变了真实战斗结果');
  assert(capture.rows.length && capture.rows.every(row => row.expected && row.rigid.length === row.rigidX.length));
  const report = { kind: 'settle-real-input-trace',
    note: '输入来自原规则的真实无画面对局；测试 VM 只在 settle 内读入参及输出，不修改生产脚本。',
    sourceHashes: hashes, ruleFingerprint: evolve.ruleFingerprint(baseline.SA),
    scenarios: baselineScenes.map(({ id, terrain, seed, p, e }) => ({ id, terrain, seed,
      p: { id: p.id, source: p.source, sourceSha256: p.sourceSha256 },
      e: { id: e.id, source: e.source, sourceSha256: e.sourceSha256 } })),
    results: originalResults, resultHash: SHA(JSON.stringify(originalResults.map(row => row.resultHash))),
    bench: { actualBatchSize: capture.rows.length, repeatBatchSize: 4096, rounds: 3 },
    calls: capture.rows.length, records: capture.rows };
  fs.writeFileSync(OUTPUT, JSON.stringify(report));
  console.log(JSON.stringify({ reportFile: OUTPUT, calls: report.calls, resultHash: report.resultHash,
    scenarios: report.scenarios.map(row => row.id) }));
}

if (process.argv.includes('--child') || process.argv.includes('--validate-only')) {
  try { runChild(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
} else {
  const child = spawn(process.execPath, [__filename, '--child'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
  const timer = setTimeout(() => { child.kill(); console.error(`trace 超过 ${HARD_LIMIT_MS / 1000} 秒硬限，已终止`); }, HARD_LIMIT_MS);
  child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 124; });
}
