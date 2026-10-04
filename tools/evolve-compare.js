/* 进化新旧对照：用冻结的战斗代码复测相邻关，并独立统计构筑形态。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEEDS = [20261003, 20261004, 20261005];
const REQUIRED = { 3: ['cannon'], 4: ['mortar_s', 'condenser'], 5: ['biped', 'pressure_chamber'], 6: ['cockpit_pair', 'mortar'] };

// 比较完整占格与模块数量，位置平移和左右镜像不会制造新形态。
function shape(SA, vehicle) {
  const occupied = [], count = new Map(), chassis = new Set();
  SA.V.each(vehicle, (cell, r, c) => {
    const fp = SA.fp(cell.id);
    for (let dr = 0; dr < fp.h; dr++) for (let dc = 0; dc < fp.w; dc++) occupied.push([r + dr, c + dc]);
    count.set(cell.id, (count.get(cell.id) || 0) + 1);
    if (SA.MODULES[cell.id]?.layer === 'chassis') chassis.add(cell.id);
  });
  const r0 = Math.min(...occupied.map(point => point[0])), c0 = Math.min(...occupied.map(point => point[1]));
  const cells = new Set(occupied.map(([r, c]) => `${r - r0},${c - c0}`));
  const width = Math.max(...occupied.map(point => point[1])) - c0;
  const mirror = new Set(occupied.map(([r, c]) => `${r - r0},${width - (c - c0)}`));
  return { cells, mirror, count, chassis: [...chassis].sort().join('+') };
}

// 集合交并比用于比较占格轮廓，空集合约定相似度为零。
function jaccard(a, b) {
  let intersection = 0;
  for (const key of a) if (b.has(key)) intersection++;
  return (intersection / (a.size + b.size - intersection || 1));
}

// 底盘必须相同；其余相似度由轮廓与模块数量各占一半。
function similarity(a, b) {
  if (a.chassis !== b.chassis) return 0;
  const occupied = Math.max(jaccard(a.cells, b.cells), jaccard(a.cells, b.mirror));
  let overlap = 0, total = 0;
  for (const id of new Set([...a.count.keys(), ...b.count.keys()])) {
    overlap += Math.min(a.count.get(id) || 0, b.count.get(id) || 0);
    total += Math.max(a.count.get(id) || 0, b.count.get(id) || 0);
  }
  return 0.5 * occupied + 0.5 * (overlap / (total || 1));
}

// 按首次出现的代表构筑聚类，记录最大簇和重复候选比例。
function diversity(SA, records) {
  const clusters = [];
  for (const record of records) {
    if (!record?.cells) continue;
    const item = shape(SA, SA.V.fromCells(record.name || '候选', record.cells));
    const group = clusters.find(group => similarity(group.shape, item) >= 0.85);
    if (group) group.count++;
    else clusters.push({ shape: item, count: 1 });
  }
  const count = clusters.reduce((sum, group) => sum + group.count, 0);
  return { candidates: count, clusters: clusters.length, largestShare: count ? Math.max(...clusters.map(group => group.count)) / count : null,
    repeatShare: count ? (count - clusters.length) / count : null };
}

// 两个方向各60局；显式使用双方最终性格，验证种子与搜索阶段分离。
function duel(SA, a, b, spec, seed) {
  let wins = 0, draws = 0;
  for (let i = 0; i < 60; i++) {
    const common = { pAim: 0.8, eAim: 0.8, terrain: spec.terrain, bounds: spec.bounds };
    const forward = SA.Battle.simulate({ ...common, p: a.vehicle, e: b.vehicle, pStyle: a.style, eStyle: b.style, seed: seed + i * 2 });
    const reverse = SA.Battle.simulate({ ...common, p: b.vehicle, e: a.vehicle, pStyle: b.style, eStyle: a.style, seed: seed + i * 2 + 1 });
    for (const winner of [forward.winner, reverse.winner === 'p' ? 'e' : reverse.winner === 'e' ? 'p' : reverse.winner]) {
      if (winner === 'p') wins++;
      else if (winner === 'draw') draws++;
    }
  }
  return { games: 120, wins, draws, winRate: (wins + draws * 0.5) / 120 };
}

// 读取独立运行保存的完整报告，兼容直接保存的原始报告。
function loadReport(dir, kind, seed) {
  const file = path.join(dir, `${kind}-${seed}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// 第三关只使用显式冻结副本；逐字段校验唯一侧挂修正，防止混入后续手工改车。
function origin(SA, fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const { signature, ...payload } = fixture;
  assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'), signature, '第三关 fixture 签名不符');
  const sourceBytes = fs.readFileSync(fixture.source.path);
  assert.strictEqual(crypto.createHash('sha256').update(sourceBytes).digest('hex'), fixture.source.fileSha256, '第三关原始记录文件已变化');
  const record = JSON.parse(sourceBytes).records['1:2'];
  assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex'), fixture.source.recordSha256, '第三关原始记录已变化');
  assert.deepStrictEqual(fixture.patch, { module: 'rangefinder', from: [0, 6, 6], to: [1, 6, 7], changedCellCount: 1 });
  assert.strictEqual(record.cells.length, 11, '第三关原点必须是 11 件车');
  const expected = structuredClone(record.cells);
  const index = expected.findIndex(cell => cell[3] === 'rangefinder' && cell[0] === 0 && cell[1] === 6 && cell[2] === 6);
  assert(index >= 0, '第三关原点测距仪不存在');
  expected[index][0] = 1; expected[index][2] = 7;
  assert.deepStrictEqual(fixture.cells, expected, '第三关 fixture 除测距仪侧挂外还有其他改动');
  assert.strictEqual(fixture.name, record.name);
  assert.strictEqual(fixture.style, record.style);
  assert.strictEqual(fixture.recordAim, record.aim);
  assert.strictEqual(fixture.battleAim, 0.8);
  assert.deepStrictEqual(fixture.lim, { cols: 5, rows: 3 });
  const vehicle = SA.V.fromCells(fixture.name, fixture.cells);
  assert(SA.V.stats(vehicle).canDeploy, '修正后的第三关原点不能出战');
  return { vehicle, style: fixture.style, signature };
}

// 路线一旦没有合格入选车，后续关卡标记受阻，绝不拿诊断候选补位。
function compareRun(SA, report, source) {
  const rows = new Map(report.chapters.flatMap(chapter => chapter.stages).filter(stage => stage.spec.chapter === 1 && stage.spec.stage >= 3 && stage.spec.stage <= 6)
    .map(stage => [stage.spec.stage, stage]));
  const result = [], selectedShapes = [], first = source.origin;
  let previous = first, blocked = false;
  for (const stage of [3, 4, 5, 6]) {
    const row = rows.get(stage), selected = row?.selected;
    if (!row || blocked) { result.push({ stage, status: 'not_run', selected: false,
      reason: '前一关未入选，路线已停止' }); blocked = true; continue; }
    // 合格候选簇只统计完成120局复测且通过全部硬条件的前八候选。
    const qualified = row.selection?.verified && (row.top || []).filter((candidate, index) => {
      const evidence = row.selection.verified[index];
      return evidence?.name === candidate.name && evidence.failed?.length === 0 && evidence.previousGames === 120;
    });
    const qualifiedDiversity = qualified ? diversity(SA, qualified) : null;
    const rowResult = { stage, status: selected ? 'completed' : 'failed', selected: !!selected,
      topDiversity: diversity(SA, row.top || []), qualifiedDiversity,
      qualifiedClustersAtLeast3: qualifiedDiversity ? qualifiedDiversity.clusters >= 3 : null,
      modules: selected?.cells?.map(cell => cell[3]) || [], cost: selected?.stats?.value ?? null,
      selectionFailures: row.selection?.failed || [], diversityWarning: row.selection?.warning || null,
      generationMetrics: row.generationMetrics || [] };
    if (!selected) { blocked = true; result.push(rowResult); continue; }
    const current = { vehicle: SA.V.fromCells(selected.name || '入选', selected.cells), style: selected.style || 'wander' };
    selectedShapes.push(shape(SA, current.vehicle));
    const actualSpec = { terrain: row.spec.terrain, bounds: row.spec.bounds };
    rowResult.adjacent = duel(SA, current, previous, actualSpec, 90000000 + report.seed * 7 + stage * 1009);
    if (source.modern) {
      const selection = row.selection;
      const replay = duel(SA, current, previous, actualSpec, selection.validationSeed);
      assert.deepStrictEqual([replay.games, replay.wins, replay.draws, replay.winRate],
        [selection.previousGames, selection.previousWins, selection.previousDraws, selection.previousWinRate],
        `第 ${stage + 1} 关独立种子复测与筛选报告不一致`);
      rowResult.selectionReplay = replay;
    }
    rowResult.rewardMissing = (REQUIRED[stage] || []).filter(id => !rowResult.modules.includes(id));
    rowResult.budgetViolation = rowResult.cost > 830;
    const policy = source.policies[stage];
    rowResult.moduleViolation = rowResult.modules.filter(id => !policy.allowedModules.includes(id));
    rowResult.materialViolation = selected.cells.filter(cell => !policy.allowedMaterials.includes(cell[4]));
    previous = current;
    result.push(rowResult);
  }
  let similarPairs = 0;
  for (let i = 0; i < selectedShapes.length; i++) for (let j = i + 1; j < selectedShapes.length; j++)
    if (similarity(selectedShapes[i], selectedShapes[j]) >= 0.85) similarPairs++;
  const completed = result.length === 4 && !blocked;
  return { stages: result, selectedSimilarPairs: completed ? similarPairs : null,
    selectedSimilarPairsAtMost2: completed ? similarPairs <= 2 : null, completed };
}

// 冻结报告没有逐场流水；候选搜索次数按固定调用链与每关实际代数复算。
// 新算法的验证局数直接取每代 validationGames，避免把前八名再重复计入。
function battleCounts(report, input, modern) {
  const stages = report.chapters.flatMap(chapter => chapter.stages).filter(stage => stage.spec.chapter === 1 && stage.spec.stage >= 3 && stage.spec.stage <= 6);
  const rows = stages.map(stage => {
    const sample = stage.top?.[0], population = stage.count;
    assert(sample && Number.isInteger(population) && population > 0, '报告缺少候选评估计数证据');
    const generations = modern ? stage.generationMetrics?.length : input.population?.generations;
    assert(Number.isInteger(generations) && generations > 0, '报告缺少实际代数');
    const styles = sample.styleTrials?.length, opponents = sample.opponentCount;
    assert(Number.isInteger(styles) && Number.isInteger(opponents) && opponents > 0, '报告缺少样式/对手计数');
    assert.strictEqual(sample.games, opponents * input.games * 2, '候选常规对局数与冻结参数不符');
    if (modern) assert.strictEqual(sample.previousGames, input.games * 2, '前关训练对局数与冻结参数不符');
    const terrainGames = stage.spec.terrain === 'flat' ? 0 : opponents * Math.min(2, input.games) * 2;
    const perCandidate = styles * 2 + sample.games + (modern ? sample.previousGames : 0) + terrainGames;
    const candidates = population * generations, searchGames = candidates * perCandidate;
    const validationGames = modern ? stage.generationMetrics.reduce((sum, row) => sum + (row.validationGames || 0), 0) : null;
    const originGames = stage.originComparison?.games || 0;
    return { stage: stage.spec.stage, candidates, generations, perCandidate, searchGames, validationGames, originGames,
      totalKnownGames: modern ? searchGames + validationGames + originGames : null };
  });
  const sum = key => rows.reduce((total, row) => total + (row[key] || 0), 0);
  return { stages: rows, searchGames: sum('searchGames'), validationGames: modern ? sum('validationGames') : null,
    originGames: sum('originGames'), totalKnownGames: modern ? sum('totalKnownGames') : null,
    limitation: modern ? null : '旧筛选额外对局存在缓存与分支，报告未保存完整调用流水，无法精确复算总局数' };
}

// 命令行参数只用于定位输入和输出，文件由调用者显式指定。
function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

// 战斗代码固定取旧快照；两侧规则违规均按新逐关规格判定。
function main() {
  const oldDir = argument('--old-dir'), newDir = argument('--new-dir'), output = argument('--output'), fixturePath = argument('--origin-fixture');
  if (!oldDir || !newDir || !output || !fixturePath) throw new Error('用法：node tools/evolve-compare.js --old-dir 旧快照目录 --new-dir 新报告目录 --origin-fixture 第三关副本.json --output 机器报告.json');
  // 旧新必须加载同一游戏规则；只允许生成器与筛选实现不同。
  for (const file of ['js/battle.js', 'js/modules.js', 'js/vehicle.js', 'js/content.js', 'js/state.js', 'js/camp.js', 'config/stage-cars.json'])
    assert(fs.readFileSync(path.join(oldDir, file)).equals(fs.readFileSync(path.join(newDir, file))), `旧新游戏规则不一致：${file}`);
  const old = require(path.join(path.resolve(oldDir), 'tools/evolve'));
  const { SA } = old.loadGame();
  // 解锁与预算从新算法冻结快照读取，避免运行期间工作区被编辑后改变对照判据。
  const current = require(path.join(path.resolve(newDir), 'tools/evolve'));
  const { SA: currentGame } = current.loadGame();
  const oldRules = old.ruleFingerprint(SA), newRules = current.ruleFingerprint(currentGame);
  const policies = Object.fromEntries([3, 4, 5, 6].map(stage => [stage, current.previewStageSpec(currentGame, 1, stage)]));
  const fixedOrigin = origin(SA, path.resolve(fixturePath));
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const fixtureFileSha256 = crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex');
  const runnerSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(newDir, 'run-new-baseline.js'))).digest('hex');
  const entries = SEEDS.map(seed => {
    const common = { origin: fixedOrigin, policies };
    const oldInput = loadReport(oldDir, 'old-baseline', seed), newInput = loadReport(newDir, 'new-enriched', seed);
    assert.strictEqual(oldInput.seed, seed);
    assert.strictEqual(newInput.seed, seed);
    for (const run of [oldInput, newInput]) {
      assert.strictEqual(run.input.games, 6, '常规评估局数不是 6');
      assert.strictEqual(run.input.population.size, 24, '初始种群不是 24 辆');
      assert.strictEqual(run.input.population.generations, 4, '基础代数不是 4');
      assert.deepStrictEqual(run.input.scope, { type: 'route-after', origin: { chapter: 1, stage: 2 }, count: 4 });
    }
    assert.strictEqual(oldInput.input?.originFixture, fixedOrigin.signature, `旧报告 ${seed} 原点签名不符`);
    assert.strictEqual(newInput.report?.originFixture?.signature, fixedOrigin.signature, `新报告 ${seed} 原点签名不符`);
    assert.deepStrictEqual(newInput.input?.originFixture, newInput.report.originFixture, `新报告 ${seed} 输入来源与报告不符`);
    const actualOrigin = newInput.input.originFixture;
    assert.strictEqual(actualOrigin.fixtureFileSha256, fixtureFileSha256, `新报告 ${seed} fixture 文件哈希不符`);
    assert.strictEqual(actualOrigin.runnerSha256, runnerSha256, `新报告 ${seed} 原始运行器哈希不符`);
    assert.strictEqual(actualOrigin.sourceFileSha256, fixture.source.fileSha256);
    assert.strictEqual(actualOrigin.sourceRecordSha256, fixture.source.recordSha256);
    for (const key of ['patch', 'name', 'cells', 'style', 'recordAim', 'battleAim', 'lim'])
      assert.deepStrictEqual(actualOrigin[key], fixture[key], `新报告 ${seed} 第三关输入 ${key} 不符`);
    assert.strictEqual((oldInput.report || oldInput).rules, oldRules, `旧报告 ${seed} 与旧冻结战斗规则不符`);
    assert.strictEqual((newInput.report || newInput).rules, newRules, `新报告 ${seed} 与新冻结规则不符`);
    return { seed, oldSourceHash: oldInput.sourceHash || null, newSourceHash: newInput.sourceHash || null,
      oldElapsedMs: oldInput.elapsedMs ?? null, newElapsedMs: newInput.elapsedMs ?? null,
      old: { ...compareRun(SA, oldInput.report || oldInput, common),
        battleCounts: battleCounts(oldInput.report || oldInput, oldInput.input, false) },
      current: { ...compareRun(SA, newInput.report || newInput, { ...common, modern: true }),
        battleCounts: battleCounts(newInput.report || newInput, newInput.input, true) } };
  });
  assert.strictEqual(new Set(entries.map(row => row.newSourceHash)).size, 1, '三个新报告并非同一冻结源码');
  assert.strictEqual(new Set(entries.map(row => row.oldSourceHash)).size, 1, '三个旧报告并非同一冻结源码');
  const result = { kind: 'evolve-ab-comparison', validationGamesPerStage: 120,
    originFixture: { path: path.resolve(fixturePath), signature: fixedOrigin.signature, fileSha256: fixtureFileSha256 },
    source: path.resolve(oldDir), entries };
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ output, seeds: SEEDS, completedOld: entries.filter(row => row.old.completed).length,
    completedNew: entries.filter(row => row.current.completed).length }));
}

if (require.main === module) main();
module.exports = { shape, similarity, diversity, duel, origin, compareRun, battleCounts };
