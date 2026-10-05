/* 锁定手工车入口回归：原记录仍保留，但非法车不能作为进化入选车推进路线。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 4);
  const valid = evolve.minimalVehicle(SA, spec);
  assert(valid && evolve.legalVehicle(SA, valid, spec), '缺少合法的多奖励手工车夹具');
  const base = { name: '手工测试车', cells: SA.StageCars.cellsOf(valid), style: 'wander' };
  const inspect = (record, reference = null, stageSpec = spec) => {
    const failures = [];
    const stage = evolve.lockedStageReport({ spec: stageSpec, records: [record], archive: {} }, failures, SA, reference, 91234);
    return { stage, failures };
  };
  assert(inspect(base).stage.selected, '合法锁定车不应被无故删除');

  // 必带列表有两项，遗漏第二件同样应拒绝，不能只检查旧 rewardModule。
  const noCondenser = { ...base, cells: base.cells.filter(cell => cell[3] !== 'condenser') };
  const missing = inspect(noCondenser);
  assert.strictEqual(missing.stage.selected, null);
  assert(missing.stage.selection.failed.includes('reward'));
  assert.deepStrictEqual(missing.stage.top[0].cells, noCondenser.cells, '诊断记录不得丢失原车');
  assert.strictEqual(missing.failures.length, 1);

  const future = { ...base, cells: base.cells.map(cell => cell[3] === 'mortar_s' ? [cell[0], cell[1], cell[2], 'rocket_rack', cell[4], cell[5]] : cell) };
  const premature = inspect(future);
  assert.strictEqual(premature.stage.selected, null);
  assert(premature.stage.selection.failed.includes('modulePool'), '未来件绕过锁定入口');
  const steel = { ...base, cells: base.cells.map(cell => [cell[0], cell[1], cell[2], cell[3], 3, cell[5]]) };
  const material = inspect(steel);
  assert.strictEqual(material.stage.selected, null);
  assert(material.stage.selection.failed.includes('materials'), '钢材提前绕过锁定入口');

  // 有前关时仍须独立对战；固定败率低于60%，锁定身份不豁免难度门槛。
  const prior = SA.V.clone(valid); prior.name = '前关入选';
  SA.Battle.simulate = options => ({ winner: options.seed % 20 < 10 ? 'p' : 'e', t: 30, reason: '驾驶舱',
    pDealt: 10, eDealt: 10, events: { p: {}, e: {} }, metrics: {} });
  const weak = inspect(base, { vehicle: prior, style: 'wander' });
  assert.strictEqual(weak.stage.selected, null);
  assert.strictEqual(weak.stage.selection.previousGames, 120);
  assert(weak.stage.selection.failed.includes('target'));

  // 机械合法的手工车即使不符预算、缺奖励，也要产生对局诊断；资格判断仍不准放行。
  const diagnostic = inspect(noCondenser, { vehicle: prior, style: 'wander' }, { ...spec, budget: 1 });
  assert.strictEqual(diagnostic.stage.selection.previousGames, 120, '生成硬门槛不应阻止合法手工车的实战诊断');
  assert(Number.isFinite(diagnostic.stage.selection.previousWinRate));
  assert.strictEqual(diagnostic.stage.selection.hardConditions.budget, false);
  assert.strictEqual(diagnostic.stage.selection.hardConditions.reward, false);
  assert.strictEqual(diagnostic.stage.selected, null, '诊断对局不能豁免入选硬门槛');

  // 锅炉缺失的机械非法车仍不能模拟，即使已有前关参考车。
  const noBoiler = { ...base, cells: base.cells.filter(cell => cell[3] !== 'boiler') };
  const broken = inspect(noBoiler, { vehicle: prior, style: 'wander' });
  assert.strictEqual(broken.stage.selection.hardConditions.construction, false);
  assert.strictEqual(broken.stage.selection.previousGames, 0);
  assert.strictEqual(broken.stage.selected, null);
  return { rewardGuard: true, futureGuard: true, materialGuard: true, previousGuard: true, manualDiagnostics: true, invalidSimulationGuard: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
