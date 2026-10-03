'use strict';

// 非序章生成回归：逐关检查奖励保底与全部标尺，再走真实 worker、跨代、Boss 筛选和报告路径。
// 关卡布局 4 起只有做出来的关参加；还没有关的章节跳过。
// 这里只验证生成能力；胜率、地形和奖励效果是否达标另列，不把小样本结果当作平衡定稿。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');
const rules = require('./evolve-stage-rules.json');

async function run() {
  const { SA } = evolve.loadGame(), before = { ...config.population };
  const stageFile = path.join(__dirname, '../config/stage-cars.json'), original = fs.readFileSync(stageFile);
  const results = [], references = [];
  let anchors = 0, stages = 0, evaluations = 0;
  // 这四种奖励曾因侧挂支撑或炮口遮挡导致标尺为 null；其余关卡一并防回归。
  for (let chapter = 1; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      const spec = evolve.stageSpec(SA, chapter, stage);
      const minimum = evolve.minimalVehicle(SA, spec, spec.rewardModule);
      assert(minimum && evolve.legalVehicle(SA, minimum, spec), `${chapter}:${stage} 奖励保底车非法`);
      assert(!spec.rewardModule || SA.V.countIds(minimum)[spec.rewardModule], `${chapter}:${stage} 保底丢失奖励`);
      const opponents = evolve.campaignOpponents(SA, chapter, stage);
      assert.strictEqual(opponents.length, config.evaluation.anchorCount);
      for (const opponent of opponents) assert(evolve.legalVehicle(SA, opponent, spec), `${chapter}:${stage} 标尺非法`);
      if (spec.rewardModule) assert(SA.V.countIds(opponents[1])[spec.rewardModule], `${chapter}:${stage} 奖励标尺被普通车替代`);
      for (let seed = 1; seed <= 5; seed++) {
        const vehicle = evolve.randomVehicle(SA, spec, new evolve.RNG(seed), spec.rewardModule);
        assert(vehicle && evolve.legalVehicle(SA, vehicle, spec), `${chapter}:${stage} 随机候选失败，种子 ${seed}`);
        assert(!spec.rewardModule || SA.V.countIds(vehicle)[spec.rewardModule], `${chapter}:${stage} 随机候选丢失奖励`);
      }
      anchors += opponents.length; stages++;
    }
  }
  try {
    Object.assign(config.population, { size: 4, generations: 2 });
    for (let chapter = 1; chapter < SA.CAMPAIGN.length; chapter++) {
      if (!SA.CAMPAIGN[chapter].stages.length) continue;
      const report = await evolve.runAsync({ scope: { chapter }, seed: 20260929, games: 1, workers: 2, references });
      assert.strictEqual(report.status, 'complete');
      assert.strictEqual(report.chapters.length, 1);
      assert.strictEqual(report.chapters[0].chapter, chapter);
      assert.strictEqual(report.chapters[0].stages.length, SA.CAMPAIGN[chapter].stages.length);
      assert.strictEqual(report.telemetry.completedSteps, report.telemetry.totalSteps);
      for (const stage of report.chapters[0].stages) {
        assert(stage.selected, `${chapter}:${stage.spec.stage} 没有生成可供审阅的入选车`);
        for (const condition of ['construction', 'modulePool', 'budget', 'reward'])
          assert.strictEqual(stage.selection.hardConditions[condition], true, `${chapter}:${stage.spec.stage} ${condition} 失败`);
        references.push(stage.selected);
      }
      for (const rec of report.candidates) {
        assert(rec.spec.chapter === chapter, '混入所选章节以外的候选');
        const spec = evolve.stageSpec(SA, chapter, rec.spec.stage), vehicle = SA.V.fromCells(rec.name, rec.cells);
        assert(evolve.legalVehicle(SA, vehicle, spec));
        assert(!spec.rewardModule || SA.V.countIds(vehicle)[spec.rewardModule]);
        for (const value of [rec.winRate, rec.strength, rec.performance, rec.fitness]) assert(Number.isFinite(value));
      }
      evaluations += report.telemetry.completedCandidates;
      results.push({ chapter, stages: report.chapters[0].stages.length, candidates: report.candidates.length,
        balanceFailures: report.selectionFailures.map(row => ({ stage: row.stage, failed: row.failed })) });
    }
    // 仅在内存中制造不可能预算：第三关预检失败时，不得先花时间跑完前两关。
    const broken = rules.find(row => row.chapter === 1 && row.stage === 2), budget = broken.budget, events = [];
    try {
      broken.budget = 100;
      await assert.rejects(evolve.runAsync({ scope: { chapter: 1 }, workers: 2, games: 1, onProgress: event => events.push(event) }), /伦敦东区.*第 3 关.*合法标尺车.*£100/);
      assert.strictEqual(events.length, 0, '构筑预检没有在评估开始前失败');
    } finally { broken.budget = budget; }
  } finally { Object.assign(config.population, before); }
  assert(original.equals(fs.readFileSync(stageFile)), '测试改变了手工关卡文件');
  return { chapters: results.length, stages, anchors, evaluations, preflight: true, formalUnchanged: true, results };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
