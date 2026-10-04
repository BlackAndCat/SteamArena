/* 手动选择席位回归：进化擂台定向生成时，勾着「手动选择」（stage-cars.json 的 locked）的关卡车每代占一个固定席位，
   成绩单独记在报告的 stage.manual，不混进进化候选和选车；勾掉后不留席位。不写正式配置。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const { SA } = evolve.loadGame();
  const stageFile = path.join(__dirname, '../config/stage-cars.json'), before = fs.readFileSync(stageFile);
  const actual = evolve.stageFor(SA, 0, 1), spec = evolve.previewStageSpec(SA, 0, 1);
  assert(actual?.vehicle && actual.source === 'manual', '序章第 2 关应有手工关卡车');
  // 勾掉「手动选择」就不留席位；勾着时按关卡车自己的性格固定评分
  assert.strictEqual(evolve.pinnedStageCar(SA, { ...actual, locked: false }, spec), null);
  const pinned = evolve.pinnedStageCar(SA, { ...actual, locked: true }, spec);
  assert(pinned && pinned.arenaStyle === (actual.style || 'wander'));
  const json = value => JSON.stringify(value);   // 游戏跑在 VM 里，数组不同源，按内容比
  assert.strictEqual(json(SA.StageCars.cellsOf(pinned)), json(SA.StageCars.cellsOf(actual.vehicle)), '席位上的车不是关卡车原样');

  const keep = { ...config.population };
  let report;
  try {
    config.population.size = 4; config.population.generations = 1;
    report = await evolve.runAsync({ scope: { chapter: 0, stage: 1 }, games: 1, workers: 2, seed: 515151, pinStageCars: true, gpu: false });
  } finally { Object.assign(config.population, keep); }
  const stage = report.chapters[0].stages[0], manual = stage.manual;
  if (actual.locked === false) {
    assert.strictEqual(manual, undefined, '勾掉手动选择后不该留席位');
    return { pinned: false, skipped: '正式配置里 0:1 没勾手动选择，只验证了不留席位' };
  }
  assert(manual?.pinned, '报告里缺少手动选择关卡车的成绩');
  assert.strictEqual(json(manual.cells), json(SA.StageCars.cellsOf(actual.vehicle)));
  assert.strictEqual(manual.style, actual.style || 'wander', '席位没有用关卡车自己的性格');
  assert(Number.isFinite(manual.strength) && Number.isFinite(manual.winRate) && manual.games === config.evaluation.anchorCount * 2, '席位成绩不完整');
  // 有上一关就和上一关车复测，口径同选车
  assert.strictEqual(manual.evidence.previousGames, config.evaluation.finalDuelGames * 2);
  assert(Array.isArray(manual.evidence.failed) && manual.evidence.target.length === 2);
  // 不混进进化候选：候选列表和选出的车里都没有它
  const key = JSON.stringify(manual.cells);
  assert(!stage.top.some(rec => JSON.stringify(rec.cells) === key), '关卡车混进了进化候选');
  assert(!report.candidates.some(rec => JSON.stringify(rec.cells) === key), '关卡车混进了报告候选');
  assert.strictEqual(stage.count, 4, '候选数应按整个种群（含固定席位）算');
  assert(before.equals(fs.readFileSync(stageFile)), '生成改了正式关卡配置');
  return { pinned: true, strength: Math.round(manual.strength), previousWinRate: manual.evidence.previousWinRate, failed: manual.evidence.failed };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
