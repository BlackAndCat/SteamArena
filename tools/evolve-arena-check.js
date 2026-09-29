'use strict';

// 擂台回归：真实模拟验证局部重跑、种子原样保留与胜率；隔离存储验证手工回流。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const evolve = require('./evolve');
const config = require('./evolve-config');
const { mergeReports, generate } = require('./evolve-service');

async function run() {
  const { SA, context } = evolve.loadGame(), memory = new Map();
  const stageFile = path.join(__dirname, '../js/stage-cars.js'), originalStageFile = fs.readFileSync(stageFile);
  memory.set('steam_arena_save', '正式存档哨兵');
  Object.assign(context, { crypto, TextEncoder, Event, dispatchEvent() {}, localStorage: {
    getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/evolve-arena.js'), 'utf8'), context);
  const arena = SA.EvolveArena, spec = evolve.stageSpec(SA, 0, 1);
  const vehicle = evolve.minimalVehicle(SA, spec, 'plate');
  const rec = { name: '手工甲片夹具', cells: SA.StageCars.cellsOf(vehicle), code: SA.V.encode(vehicle), spec, style: 'turtle', strength: 1200, winRate: 0.75, games: 40 };
  const saved = arena.remember(rec, { favorite: true });
  const modified = arena.saveEdited(saved.id, vehicle, { name: '擂台手工车', style: 'rush' });
  assert(modified.manual && modified.favorite && modified.participate);
  assert.strictEqual(modified.record.winRate, undefined, '手工改车错误沿用旧胜率');
  assert.strictEqual(SA.V.decode(modified.record.code).name, '擂台手工车', '分享码没有使用手工车名');
  assert.strictEqual(memory.get('steam_arena_save'), '正式存档哨兵');
  assert.strictEqual(memory.size, 2, '擂台写入了其他存档键');
  const base = { campaignLayout: SA.CAMPAIGN_LAYOUT, rules: 'old', chapters: [{ chapter: 0, stages: [{ spec, top: [rec], selected: rec }] }], candidates: [rec], selectionFailures: [] };
  const overlay = arena.merge(base);
  assert.strictEqual(overlay.candidates.length, 1);
  assert(overlay.chapters[0].stages[0].selected.manual);
  assert(overlay.chapters[0].stages[0].selected.needsEvaluation);
  assert.strictEqual(base.candidates[0].name, '手工甲片夹具', '展示合并污染原报告');
  // 未知模块不得被 fromCells 静默丢弃后当成另一台合法种子。
  const bad = { ...modified.record, name: '无效模块夹具', cells: [...rec.cells, [0, 0, 0, 'missing_module', 1, 0]] };
  const noRewardVehicle = evolve.minimalVehicle(SA, spec);
  const noReward = { ...modified.record, name: '缺少甲片夹具', cells: SA.StageCars.cellsOf(noRewardVehicle) };
  const previousConfig = { ...config.population };
  let report, later;
  try {
    config.population.size = 4; config.population.generations = 2;
    report = await evolve.runAsync({ scope: { chapter: 0, stage: 1 }, games: 1, workers: 2, seed: 112233, seeds: [modified.record, bad, noReward] });
    assert.strictEqual(report.chapters.length, 1);
    assert.strictEqual(report.chapters[0].stages.length, 1);
    assert.strictEqual(report.chapters[0].stages[0].spec.stage, 1, '单关索引被改成第一关');
    assert.strictEqual(report.seedWarnings.length, 2);
    assert(report.seedWarnings.some(row => row.name === noReward.name && row.reason.includes('缺少奖励件')));
    const measured = report.candidates.find(item => arena.key(item) === arena.key(modified.record) && item.name === modified.record.name);
    assert(measured, '手工种子在最终报告中丢失');
    assert.strictEqual(measured.style, 'rush', '手工绑定性格被覆盖');
    assert.strictEqual(JSON.stringify(measured.cells), JSON.stringify(modified.record.cells));
    for (const item of report.candidates) {
      assert(item.cells.some(cell => cell[3] === spec.rewardModule), '生成候选缺少本关奖励件');
      assert.strictEqual(item.games, config.evaluation.anchorCount * 2);
      assert.strictEqual(item.winRate, (item.wins + item.draws * 0.5) / item.games);
    }
    const renewed = arena.merge(report).candidates.find(item => item.arenaId === saved.id);
    assert(!renewed.needsEvaluation && Number.isFinite(renewed.winRate), '重新实测没有解除待测标记');
    config.population.generations = 1;
    later = await evolve.runAsync({ scope: { chapter: 1, stage: 0 }, games: 1, workers: 2, seed: 112234 });
    assert.strictEqual(later.chapters[0].chapter, 1, '指定章节却从序章重跑');
    assert.strictEqual(later.telemetry.completedStages, 1);
    const merged = mergeReports(report, later);
    assert.strictEqual(merged.chapters.length, 2);
    assert.deepStrictEqual(merged.chapters[0].stages[0].selected, report.chapters[0].stages[0].selected);
    assert.strictEqual(merged.candidates.length, report.candidates.length + later.candidates.length);
    await assert.rejects(generate({ scope: { chapter: 0, stage: 0 }, baseReport: '../js/stage-cars.js' }), /只能续接/);
    await assert.rejects(evolve.runAsync({ scope: { chapter: 99, stage: 0 } }), /生成范围/);
  } finally { Object.assign(config.population, previousConfig); }
  // 即使原报告被清理，也能从空报告恢复收藏和手工车型。
  assert.strictEqual(arena.merge({ chapters: [], candidates: [] }).candidates[0].arenaId, saved.id);
  // 原样保存缺奖励的手工车供继续修改，但展示合并不能再把它当作已选关卡车。
  arena.saveEdited(saved.id, noRewardVehicle, { name: noReward.name, style: 'rush' });
  const missingOverlay = arena.merge(base);
  assert.strictEqual(missingOverlay.chapters[0].stages[0].selected, null);
  assert.deepStrictEqual([...missingOverlay.chapters[0].stages[0].selection.failed], ['reward']);
  assert.strictEqual(arena.missingReward(missingOverlay.candidates[0]), 'plate');
  assert.strictEqual(JSON.stringify(arena.get(saved.id).record.cells), JSON.stringify(noReward.cells), '自动改写了缺奖励的手工车');
  assert(originalStageFile.equals(fs.readFileSync(stageFile)), '进化擂台改变了正式关卡文件');
  return { scope: '0:1 / 1:0', candidates: report.candidates.length + later.candidates.length, protectedSeed: true,
    manualRoundTrip: true, winRate: true, partialMerge: true, formalUnchanged: true, invalidSeedSkipped: true };
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
