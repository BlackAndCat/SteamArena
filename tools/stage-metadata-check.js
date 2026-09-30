/*
 * 关卡车资料保存回归：晚期原始车若已有构筑问题，改名字和驾驶员仍可保存；
 * 对模块清单的非法修改必须继续被拦截。仅在独立 VM 中运行，不写项目关卡文件。
 */
'use strict';

const assert = require('assert');
const { loadGame } = require('./evolve');

async function run() {
  const { SA, context } = loadGame();
  context.location.protocol = 'file:'; // 回归只写虚拟浏览器存档，不发文件保存请求。
  SA.S.reset();
  const ci = SA.CAMPAIGN.length - 1, si = SA.CAMPAIGN[ci].stages.length - 1;
  const original = SA.Camp.stage(ci, si);
  const baseline = SA.StageCars.makeRecord(ci, si, original, original.vehicle);
  assert(!SA.StageCars.validate(baseline, ci, si, original.vehicle).ok, '末关原始车应能复现已有构筑问题');

  SA.Camp.dev.designMode();
  SA.S.d.vehicle = SA.V.clone(original.vehicle);
  const saved = await SA.Camp.dev.saveStageCar(ci, si, { name: '末关资料回归', pilot: '测试驾驶员' });
  assert.strictEqual(saved.record.name, '末关资料回归');
  assert.strictEqual(saved.record.pilot, '测试驾驶员');
  assert(saved.warnings.some(x => x.includes('沿用原关卡车已有问题')));
  assert.strictEqual(JSON.stringify(saved.record.cells), JSON.stringify(baseline.cells));

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
