/*
 * 关卡车资料保存回归：晚期原始车若已有构筑问题，改名字和驾驶员仍可保存；
 * 对模块清单的非法修改必须继续被拦截。仅在独立 VM 中运行，不写项目关卡文件。
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

async function run() {
  const { SA, context } = loadGame();
  // 无界面夹具要载入真实像素 UI 依赖，才能覆盖退出关卡车设计模式的完整路径。
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-px.js'), 'utf8'), context, { filename: 'js/ui-px.js' });
  context.document.documentElement.style.setProperty = () => {};
  context.location.protocol = 'file:'; // 回归只写虚拟浏览器存档，不发文件保存请求。
  SA.S.reset();
  const ci = SA.CAMPAIGN.length - 1, si = SA.CAMPAIGN[ci].stages.length - 1;
  const original = SA.Camp.stage(ci, si);
  const baseline = SA.StageCars.makeRecord(ci, si, original, original.vehicle);
  assert(!SA.StageCars.validate(baseline, ci, si, original.vehicle).ok, '末关原始车应能复现已有构筑问题');

  SA.Camp.dev.designMode();
  SA.S.d.vehicle = SA.V.clone(original.vehicle);
  SA.S.d.vehicle.name = '独立车名回归';
  const saved = await SA.Camp.dev.saveStageCar(ci, si, { name: '末关资料回归', vehicleName: '独立车名回归', pilot: '测试驾驶员' });
  assert.strictEqual(saved.record.name, '末关资料回归');
  assert.strictEqual(saved.record.vehicleName, '独立车名回归');
  assert.strictEqual(saved.record.pilot, '测试驾驶员');
  assert(saved.warnings.some(x => x.includes('沿用原关卡车已有问题')));
  assert.strictEqual(JSON.stringify(saved.record.cells), JSON.stringify(baseline.cells));
  assert.strictEqual(SA.Camp.stage(ci, si).name, '末关资料回归');
  assert.strictEqual(SA.Camp.stage(ci, si).vehicle.name, '独立车名回归');
  assert.strictEqual(SA.Camp.dev.loadStageCar(ci, si).vehicle.name, '独立车名回归');
  // 固定物品奖励记录应保留多个条目和数量；空数组明确清除原关卡奖励。
  const rewardBase = SA.Camp.stage(0, 1);
  const rewardItems = [{ id: 'plate', count: 3, mt: 1 }, { id: 'tank_s', count: 2, mt: 1 }];
  const rewardRecord = SA.StageCars.makeRecord(0, 1, rewardBase, rewardBase.vehicle,
    { rewardItems, rewardMoney: false, victoryRepairFree: true });
  assert.strictEqual(JSON.stringify(rewardRecord.rewardItems), JSON.stringify(rewardItems));
  assert.strictEqual(rewardRecord.rewardMoney, false);
  assert.strictEqual(rewardRecord.victoryRepairFree, true);
  SA.STAGE_CARS.records['0:1'] = rewardRecord;
  assert.strictEqual(JSON.stringify(SA.StageCars.merge(rewardBase, 0, 1).rewardItems), JSON.stringify(rewardItems));
  assert.strictEqual(SA.StageCars.merge(rewardBase, 0, 1).rewardMoney, false);
  assert.strictEqual(SA.StageCars.merge(rewardBase, 0, 1).victoryRepairFree, true);
  const cleared = SA.StageCars.makeRecord(0, 1, rewardBase, rewardBase.vehicle, { rewardItems: [] });
  SA.STAGE_CARS.records['0:1'] = cleared;
  assert.strictEqual(SA.StageCars.merge(rewardBase, 0, 1).rewardItems.length, 0);
  const legacyRewardBase = SA.Camp.stage(0, 0);
  const legacyRewardRecord = SA.StageCars.makeRecord(0, 0, legacyRewardBase, legacyRewardBase.vehicle);
  delete legacyRewardRecord.rewardItems;
  delete legacyRewardRecord.rewardMoney;
  delete legacyRewardRecord.victoryRepairFree;
  SA.STAGE_CARS.records['0:0'] = legacyRewardRecord;
  assert.strictEqual(JSON.stringify(SA.StageCars.merge(legacyRewardBase, 0, 0).rewardItems), JSON.stringify(legacyRewardBase.rewardItems));
  assert.strictEqual(SA.StageCars.merge(legacyRewardBase, 0, 0).rewardMoney, legacyRewardBase.rewardMoney);
  assert.strictEqual(SA.StageCars.merge(legacyRewardBase, 0, 0).victoryRepairFree, legacyRewardBase.victoryRepairFree);
  SA.STAGE_CARS.records['0:1'] = rewardRecord;
  SA.S.reset();
  SA.S.d.camp.ch = 0; SA.S.d.camp.st = 1;
  const plateKey = SA.invKey('plate', 1), tankKey = SA.invKey('tank_s', 1);
  const plateBefore = SA.S.d.inv[plateKey] || 0, tankBefore = SA.S.d.inv[tankKey] || 0;
  SA.Camp.win();
  assert.strictEqual(SA.S.d.inv[plateKey], plateBefore + 3);
  assert.strictEqual(SA.S.d.inv[tankKey], tankBefore + 2);
  SA.S.settleBattle({ mode: 'campaign', replay: true, win: true, enemyName: '重打关卡车' });
  assert.strictEqual(SA.S.d.inv[plateKey], plateBefore + 3);
  assert.strictEqual(SA.S.d.inv[tankKey], tankBefore + 2);
  SA.STAGE_CARS.records['0:1'] = rewardRecord;
  const battleStart = SA.Battle.start;
  let battleOptions = null;
  SA.Battle.start = options => { battleOptions = options; };
  SA.S.d.camp.ch = ci; SA.S.d.camp.st = si;
  const entry = SA.S.arenaEntries('camp').find(item => item.key === `${ci},${si}`);
  assert.strictEqual(entry.name, '末关资料回归');
  assert(entry.title.includes('末关资料回归'));
  entry.start();
  assert.strictEqual(battleOptions.enemyName, '独立车名回归');

  // 没有新字段的旧手工记录仍用关卡标题作为敌车名。
  const legacy = SA.StageCars.makeRecord(0, 0, SA.Camp.stage(0, 0), SA.Camp.stage(0, 0).vehicle, { name: '旧版关卡名' });
  delete legacy.vehicleName;
  SA.STAGE_CARS.records['0:0'] = legacy;
  SA.StageCars.applyToCampaign();
  SA.S.d.camp.ch = 0; SA.S.d.camp.st = 0;
  const oldEntry = SA.S.arenaEntries('camp').find(item => item.key === '0,0');
  assert.strictEqual(oldEntry.name, '旧版关卡名');
  oldEntry.start();
  assert.strictEqual(battleOptions.enemyName, '旧版关卡名');
  SA.Battle.start = battleStart;

  const changed = SA.V.clone(SA.Camp.stage(ci, si).vehicle);
  let downgraded = false;
  SA.V.each(changed, cell => {
    if (!downgraded && cell.mt > 1) { cell.mt--; downgraded = true; }
  });
  assert(downgraded, '末关没有可降级材料，无法验证模块清单防线');
  const changedRecord = SA.StageCars.makeRecord(ci, si, SA.Camp.stage(ci, si), changed);
  const changedCheck = SA.StageCars.validate(changedRecord, ci, si, changed);
  assert.strictEqual(JSON.stringify(changedCheck.errors), JSON.stringify(SA.StageCars.validate(baseline, ci, si, original.vehicle).errors));
  assert.notStrictEqual(JSON.stringify(changedRecord.cells), JSON.stringify(baseline.cells));
  SA.S.d.vehicle = changed;
  await assert.rejects(SA.Camp.dev.saveStageCar(ci, si, { name: '不能保存的材料改动' }), /关卡车不能保存/);
  assert.strictEqual(SA.Camp.stage(ci, si).name, '末关资料回归');

  SA.S.d.vehicle = SA.V.create('非法新构筑');
  await assert.rejects(SA.Camp.dev.saveStageCar(ci, si, { name: '不能保存的车' }), /关卡车不能保存/);
  assert.strictEqual(SA.Camp.stage(ci, si).name, '末关资料回归');
  SA.Camp.dev.exitDesign();
  return { chapter: ci, stage: si, metadataSaved: true, sameErrorsChangedCellsRejected: true, invalidConstructionRejected: true };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { run };
