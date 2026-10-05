/* 用户关卡记录权威回归：只改隔离 loadGame 的内存记录，不写任何作者配置。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const rules = require('./evolve-stage-rules.json');
const fs = require('fs');
const vm = require('vm');

function run() {
  const { SA } = evolve.loadGame();
  const record = SA.StageCars.get(1, 5), previous = SA.StageCars.get(1, 4);
  SA.CAMPAIGN[1].stages[5].spec = { ...SA.CAMPAIGN[1].stages[5].spec, reward: 'biped' };
  const entries = () => [evolve.stageSpec(SA, 1, 5), evolve.previewStageSpec(SA, 1, 5)];
  const check = expected => {
    for (const spec of entries()) {
      assert.deepStrictEqual(spec.requiredModules, expected);
      assert.strictEqual(spec.rewardModule, expected[0] || null, '旧 spec.reward 不能覆盖作者奖励或明确清空');
      assert.deepStrictEqual(spec.availableMods, spec.allowedModules);
      assert.strictEqual(spec.budget, 830, '奖金不能覆盖逐关预算');
      assert.strictEqual(spec.mat, 2, '玩家胜后材料权限不能覆盖敌车材料');
      assert.deepStrictEqual({ ...spec.grid }, { cols: 5, rows: 4 }, '玩家胜后网格不能覆盖敌车网格');
    }
  };
  // 当前作者真实独角兽只奖励 spike；旧双足预设不能从本关或历史累计重新注入。
  check(['spike']);
  const entry = SA.CAMPAIGN_MAP.chapters[1].stages[5], oldRewards = entry.rewardModules;
  delete entry.rewardModules;
  check(['spike']);
  entry.rewardModules = oldRewards;
  for (const stage of [0, 1]) {
    const spec = evolve.stageSpec(SA, 0, stage), vehicle = evolve.minimalVehicle(SA, spec);
    assert(vehicle && evolve.legalVehicle(SA, vehicle, spec), '完整开局池不能破坏首两关保底装配');
  }
  // 直接运行真实候选元数据函数，避免为验证奖励字段而额外启动路线对局。
  const source = fs.readFileSync(require.resolve('./evolve'), 'utf8');
  const context = { manualWorkbenchVehicle: (_SA, vehicle) => vehicle };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function manualCandidateRecord('), source.indexOf('// 关卡作者的手工车')), context);
  const candidateSpec = evolve.stageSpec(SA, 1, 5);
  const candidate = context.manualCandidateRecord(SA, evolve.stageFor(SA, 1, 5), candidateSpec, '测试指纹');
  assert.strictEqual(candidate.spec.rewardModule, 'spike');
  assert.deepStrictEqual(candidate.spec.requiredModules, ['spike']);
  for (const spec of [...entries(), evolve.previewStageSpec(SA, 1, 6)]) {
    assert(spec.allowedModules.includes('spike'));
    assert(!spec.allowedModules.includes('biped') && !spec.allowedModules.includes('pressure_chamber'));
  }
  record.source = 'original';
  check(['spike']);
  record.unlock = { mods: [], mat: SA.MAT_MAX, grid: { cols: 8, rows: 6 } };
  record.rewardItems = [];
  record.prize = 999999;
  check([]);
  const emptyCandidate = context.manualCandidateRecord(SA, evolve.stageFor(SA, 1, 5), evolve.stageSpec(SA, 1, 5), '测试指纹');
  assert.strictEqual(emptyCandidate.spec.rewardModule, null);
  assert.deepStrictEqual(emptyCandidate.spec.requiredModules, []);
  delete record.unlock;
  delete record.rewardItems;
  check([]);
  record.unlock = { mods: ['spike', 'missing_module'] };
  record.rewardItems = [{ id: 'spike', quantity: 2 }, { id: 'cannon', quantity: 1 }, { id: 'missing_module' }, null];
  record.uniqueLoot = [{ id: 'biped', mt: 2 }];
  check(['spike', 'cannon']);
  for (const spec of entries()) {
    assert(!spec.requiredModules.includes('biped') && !spec.allowedModules.includes('biped'));
    assert.strictEqual(spec.uniqueLoot[0].id, 'biped', '唯一掉落仍保留原记录');
  }
  // 历史解锁新增和移除要即时反映，不借旧规则里的 addMods 填回已删除奖励。
  previous.unlock = { mods: ['pressure_chamber'] };
  for (const spec of entries()) assert(spec.allowedModules.includes('pressure_chamber'));
  previous.unlock = null;
  previous.rewardItems = [];
  for (const spec of [...entries(), evolve.previewStageSpec(SA, 1, 6)]) assert(!spec.allowedModules.includes('pressure_chamber'));
  SA.CAMPAIGN[0].unlock = { mods: ['boss_lens'] };
  for (const spec of entries()) assert(spec.allowedModules.includes('boss_lens'));
  SA.CAMPAIGN[0].unlock.mods = [];
  for (const spec of entries()) assert(!spec.allowedModules.includes('boss_lens'));
  // 没有显式记录时保留本关预设 stageMods；它不向后累计，显式记录又会屏蔽该预设。
  const get = SA.StageCars.get;
  SA.StageCars.get = (chapter, stage) => chapter === 1 && stage === 2 ? null : get(chapter, stage);
  assert(evolve.previewStageSpec(SA, 1, 2).allowedModules.includes('boss_lens'));
  assert(!evolve.previewStageSpec(SA, 1, 3).allowedModules.includes('boss_lens'));
  SA.StageCars.get = get;
  assert(!evolve.previewStageSpec(SA, 1, 2).allowedModules.includes('boss_lens'));
  assert.deepStrictEqual(evolve.previewStageSpec(SA, 1, 6).requiredModules, ['cockpit_pair', 'mortar']);
  // 奖励与材料限制仍硬校验；候选合法性检查不因来源权威而豁免预算、网格或材料。
  const spec = evolve.previewStageSpec(SA, 1, 6), vehicle = evolve.minimalVehicle(SA, spec);
  assert(vehicle && evolve.legalVehicle(SA, vehicle, spec));
  assert(!evolve.constructionConditions(SA, vehicle, { ...spec, budget: 0 }).budget);
  assert(!evolve.constructionConditions(SA, vehicle, { ...spec, allowedMaterials: [] }).materials);
  assert(!evolve.constructionConditions(SA, vehicle, { ...spec, grid: { cols: 1, rows: 1 } }).grid);
  record.unlock = { mods: [] };
  const highMaterialModule = Object.keys(SA.MODULES).find(id => !SA.MODULES[id].retired && SA.minMt(id) > 2);
  assert(highMaterialModule, '缺少高材料限制的测试模块');
  record.rewardItems = [{ id: highMaterialModule }];
  assert.throws(() => evolve.previewStageSpec(SA, 1, 5), /最低材料超过上限/);
  assert.throws(() => evolve.stageSpec(SA, 1, 5), /最低材料超过上限/);
  assert.strictEqual(rules.find(row => row.chapter === 1 && row.stage === 5).budget, 830);
  return { authoritativeRecords: true, emptyRewards: true, historicalUnlocks: true, provisionalPresets: true,
    rewardAndUniqueLoot: true, unchangedConstraints: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
