/* 真实无画面战斗的 V8 CPU 采样器：仅供离线诊断，不改战斗规则或正式关卡车。 */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const inspector = require('inspector');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const evolve = require('./evolve');

const ROOT = path.resolve(__dirname, '..');
const TEMP = 'Z:\\AI\\CodexTemp';
const OUTPUT = path.join(TEMP, 'evolve-battle-profile-20261004');
const BUDGET_MS = 30000;
const HARD_LIMIT_MS = 45000;
const SHA = value => crypto.createHash('sha256').update(value).digest('hex');

function source(name) { return fs.readFileSync(path.isAbsolute(name) ? name : path.join(ROOT, name)); }
function sourceHash(name) { return SHA(source(name)); }

// 使用原始 11 件手工车记录，仅修正用户指定的测距仪侧挂；不读取或改写当前手工车。
function originalFixture(SA) {
  const text = execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`,
    'show', 'HEAD:config/stage-cars.json'], { cwd: ROOT, encoding: 'utf8' });
  const record = JSON.parse(text).records['1:2'];
  assert.strictEqual(record?.name, '煤灰寡妇');
  assert.strictEqual(record.cells.length, 11);
  const cells = structuredClone(record.cells);
  const rangefinder = cells.find(cell => cell[0] === 0 && cell[1] === 6 && cell[2] === 6 && cell[3] === 'rangefinder');
  assert(rangefinder, '原始测距仪位置不符');
  rangefinder[0] = 1; rangefinder[2] = 7;
  const signature = SHA(JSON.stringify({ name: record.name, style: record.style, cells }));
  assert.strictEqual(signature, '3df4fd5a9be4860c9f79affe89f9b67b7f5ac19416ac4ed3532fe129370e2f83');
  const vehicle = SA.V.fromCells(record.name, cells);
  vehicle.lim = { ...evolve.previewStageSpec(SA, 1, 2).grid };
  assert(SA.V.stats(vehicle, { deferHeat: true }).canDeploy, '第三关测试副本不能出战');
  return { id: 'origin-1-3', name: vehicle.name, style: record.style || 'wander', vehicle,
    source: 'HEAD:config/stage-cars.json，仅测距仪 [0,6,6]→[1,6,7]', signature };
}

// 固定读取已经生成过的候选；优先覆盖直射、臼炮与双足，不重新运行进化搜索。
function savedCandidate(SA, seed, stage) {
  const file = path.join(TEMP, 'evolve-20261003-final-v3', `new-baseline-${seed}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const row = data.report.chapters.flatMap(chapter => chapter.stages)
    .find(item => item.spec.chapter === 1 && item.spec.stage === stage);
  assert(row?.selected?.cells, `种子 ${seed} 第 ${stage + 1} 关没有已保存入选车`);
  const record = row.selected, vehicle = SA.V.fromCells(record.name, record.cells);
  vehicle.lim = { ...row.spec.grid };
  assert(SA.V.stats(vehicle, { deferHeat: true }).canDeploy, `候选 ${record.name} 不能出战`);
  return { id: `route-1-${stage + 1}-${seed}`, name: record.name, style: record.style || 'wander', vehicle,
    source: file, signature: sourceHash(file) };
}

// 压力测试已有的合法四足蜈蚣夹具，只在本测试进程中重建。
function quadFixture(SA) {
  const vehicle = SA.V.fromAscii('四足蜈蚣夹具', [
    '........', '........', '..C.....', '..K.....', '..OW....', 'Q.Q.....',
  ]);
  const stats = SA.V.stats(vehicle, { deferHeat: true });
  assert(stats.canDeploy && stats.byId.quad === 2 && !stats.issues.length, '四足夹具规则已变化');
  return { id: 'quad-stress', name: vehicle.name, style: 'rush', vehicle,
    source: 'tools/stress-test.js:chassisFixtures', signature: SHA(JSON.stringify(SA.StageCars.cellsOf(vehicle))) };
}

function vehicles(SA) {
  const list = [originalFixture(SA), savedCandidate(SA, 20261003, 3), savedCandidate(SA, 20261003, 4),
    savedCandidate(SA, 20261004, 5), quadFixture(SA)];
  const ids = list.map(row => Object.keys(SA.V.stats(row.vehicle, { deferHeat: true }).byId)
    .filter(id => SA.MODULES[id]?.layer === 'chassis' || SA.MODULES[id]?.dmg));
  assert(ids.some(row => row.includes('track')) && ids.some(row => row.includes('biped')) &&
    ids.some(row => row.includes('quad')) && ids.some(row => row.includes('mortar_s')),
  '采样车未覆盖履带、双足、四足和高抛');
  return list;
}

function profileSummary(profile) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
  const self = new Map(), inclusive = new Map(), samples = profile.samples || [];
  for (const id of samples) {
    self.set(id, (self.get(id) || 0) + 1);
    for (let current = id; current != null; current = parent.get(current))
      inclusive.set(current, (inclusive.get(current) || 0) + 1);
  }
  const functions = new Map();
  for (const node of profile.nodes) {
    const frame = node.callFrame || {}, key = `${frame.url}:${frame.lineNumber}:${frame.functionName}`;
    const row = functions.get(key) || { function: frame.functionName || '(anonymous)',
      url: frame.url || '', line: (frame.lineNumber || 0) + 1, selfSamples: 0, inclusiveSamples: 0 };
    row.selfSamples += self.get(node.id) || 0;
    row.inclusiveSamples += inclusive.get(node.id) || 0;
    functions.set(key, row);
  }
  const rows = [...functions.values()].map(row => ({ ...row,
    selfPct: +(row.selfSamples * 100 / Math.max(1, samples.length)).toFixed(2),
    inclusivePct: +(row.inclusiveSamples * 100 / Math.max(1, samples.length)).toFixed(2) }));
  return { samples: samples.length,
    topSelf: rows.slice().sort((a, b) => b.selfSamples - a.selfSamples).slice(0, 25),
    topInclusive: rows.slice().sort((a, b) => b.inclusiveSamples - a.inclusiveSamples).slice(0, 25),
    note: '百分比以全部采样点为分母；inclusive 沿调用栈累计，多个函数合计可超过 100%。' };
}

function post(session, method, params = {}) {
  return new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
}

async function runChild() {
  const { SA } = evolve.loadGame(), cars = vehicles(SA);
  const fingerprints = Object.fromEntries(['js/battle.js', 'js/modules.js', 'js/vehicle.js', 'tools/evolve.js',
    'tools/stress-test.js'].map(name => [name, sourceHash(name)]));
  if (process.argv.includes('--validate-only')) {
    console.log(JSON.stringify({ valid: true, cars: cars.map(({ id, name, source, signature }) => ({ id, name, source, signature })), fingerprints }));
    return;
  }
  fs.mkdirSync(OUTPUT, { recursive: true });
  const session = new inspector.Session(); session.connect();
  await post(session, 'Profiler.enable');
  await post(session, 'Profiler.start');
  const started = performance.now(), games = [];
  // 轮转配对并交替双方位置；每局使用固定种子，记录实际完成局数以便以后精确复放。
  while (games.length < 256 && performance.now() - started < BUDGET_MS) {
    const index = games.length, left = cars[index % cars.length], right = cars[(index + 1) % cars.length];
    const forward = index % 2 === 0, p = forward ? left : right, e = forward ? right : left;
    const seed = 20261003 + index, result = SA.Battle.simulate({ p: p.vehicle, e: e.vehicle,
      pAim: 0.8, eAim: 0.8, pStyle: p.style, eStyle: e.style, terrain: 'flat', seed });
    games.push({ index, seed, p: p.id, e: e.id, winner: result.winner, t: result.t,
      resultHash: SHA(JSON.stringify(result)) });
  }
  const { profile } = await post(session, 'Profiler.stop');
  session.disconnect();
  const elapsedMs = Math.round(performance.now() - started);
  assert(games.length >= 5, '未完成一轮五种车的采样对战');
  const report = { kind: 'representative-headless-battle-cpu-profile',
    limitation: '单进程真实 Battle.simulate 批次，不是完整 14 worker 进化任务；时间占比不能外推端到端收益。',
    sourceHashes: fingerprints, ruleFingerprint: evolve.ruleFingerprint(SA),
    vehicles: cars.map(({ id, name, style, source, signature }) => ({ id, name, style, source, signature })),
    battles: games.length, battleBudgetMs: BUDGET_MS, elapsedMs, games,
    resultHash: SHA(JSON.stringify(games.map(row => row.resultHash))), profile: profileSummary(profile),
    profileFile: path.join(OUTPUT, 'battle.cpuprofile') };
  fs.writeFileSync(report.profileFile, JSON.stringify(profile));
  fs.writeFileSync(path.join(OUTPUT, 'report.json'), JSON.stringify(report));
  console.log(JSON.stringify({ reportFile: path.join(OUTPUT, 'report.json'), profileFile: report.profileFile,
    battles: report.battles, elapsedMs, resultHash: report.resultHash, topSelf: report.profile.topSelf.slice(0, 10) }));
}

if (process.argv.includes('--child') || process.argv.includes('--validate-only')) {
  runChild().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
} else {
  // 外层硬限覆盖启动、战斗、采样结果处理与文件写入；超时仅结束本测试子进程。
  const child = spawn(process.execPath, [__filename, '--child'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
  const timer = setTimeout(() => { child.kill(); console.error(`采样超过 ${HARD_LIMIT_MS / 1000} 秒硬限，已终止`); }, HARD_LIMIT_MS);
  child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 124; });
}
