'use strict';

// 序章插关回归：实物奖励、关卡推进和旧手工车 / 报告 / 收藏均不能错位。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const evolve = require('./evolve');

function run() {
  const { SA, context } = evolve.loadGame(), memory = new Map();
  assert.deepStrictEqual(Array.from(SA.CAMPAIGN[0].stages, s => s.spec.reward), ['tank_s', 'plate', 'bucket']);
  const vehicle = SA.Camp.stage(0, 1).vehicle;
  assert(evolve.legalVehicle(SA, vehicle, evolve.stageSpec(SA, 0, 1)), '甲片关原始车不合法');
  assert(SA.V.stats(vehicle).byId.plate, '甲片关没有装甲片');
  SA.S.reset();
  const before = SA.S.invCount('plate');
  SA.Camp.win();
  assert.strictEqual(SA.S.d.camp.st, 1);
  assert.strictEqual(SA.Camp.current().spec.reward, 'plate');
  SA.Camp.win();
  assert.strictEqual(SA.S.invCount('plate'), before + 1, '已有甲片解锁时没有发放实物');
  assert.strictEqual(SA.Camp.current().spec.reward, 'bucket');
  SA.Camp.backfill(); SA.Camp.backfill();
  assert.strictEqual(SA.S.invCount('plate'), before + 1, '读档补解锁重复发放甲片');
  SA.Camp.win();
  assert.strictEqual(SA.S.d.camp.ch, 1);

  const bucket = evolve.minimalVehicle(SA, evolve.stageSpec(SA, 0, 2), 'bucket');
  const oldSpec = { chapter: 0, stage: 1, rewardModule: 'bucket' };
  const rec = { name: '原铲斗收藏', spec: oldSpec, cells: SA.StageCars.cellsOf(bucket), code: SA.V.encode(bucket), style: 'rush' };
  const oldReport = { chapters: [{ chapter: 0, stages: [{ spec: oldSpec, selected: rec, top: [rec] }] }], candidates: [rec], selectionFailures: [{ chapter: 0, stage: 1 }] };
  const migrated = SA.Camp.migrateEvolutionReport(oldReport);
  assert.strictEqual(migrated.chapters[0].stages[0].spec.stage, 2);
  assert.strictEqual(migrated.candidates[0].spec.stage, 2);
  assert.strictEqual(migrated.selectionFailures[0].stage, 2);
  assert.strictEqual(oldReport.candidates[0].spec.stage, 1, '迁移污染历史报告');
  assert.strictEqual(SA.Camp.migrateEvolutionReport(migrated), migrated, '报告迁移不幂等');

  Object.assign(context, { crypto, TextEncoder, Event, dispatchEvent() {}, localStorage: {
    getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/evolve-arena.js'), 'utf8'), context);
  const arena = SA.EvolveArena;
  memory.set(arena.KEY, JSON.stringify({ version: 1, records: [{ id: 'legacy-bucket', record: rec, favorite: true, manual: true, parentKey: arena.key(rec) }] }));
  const favorite = arena.read()[0];
  assert.strictEqual(favorite.record.spec.stage, 2);
  assert.strictEqual(favorite.parentKey, arena.key(favorite.record));
  assert.strictEqual(JSON.stringify(favorite.record.cells), JSON.stringify(rec.cells), '迁移改变收藏构筑');
  arena.update(favorite.id, { participate: true });
  assert.strictEqual(arena.read()[0].record.spec.stage, 2, '再次读取导致重复顺延');
  assert.strictEqual(arena.merge(oldReport).candidates.length, 1, '旧收藏和旧报告合并后重复');

  // 模拟旧文件助手已按旧编号覆盖新第二关，再让规则层恢复模板并迁移记录。
  const manual = SA.StageCars.makeRecord(0, 1, SA.CAMPAIGN[0].stages[2], bucket, { name: '旧手工铲斗车' });
  delete SA.__STAGE_CARS_FILE_RECORDS;
  delete SA.STAGE_CARS.campaignLayout;
  SA.STAGE_CARS.records = { '0:1': manual };
  SA.StageCars.applyToCampaign();
  SA.StageCars.applyLocal(null);
  assert.strictEqual(SA.Camp.stage(0, 1).name, '补丁号');
  assert.strictEqual(SA.StageCars.get(0, 1), null);
  assert.strictEqual(SA.StageCars.get(0, 2).name, '旧手工铲斗车');
  assert.strictEqual(SA.StageCars.get(0, 2).id, '0:2');
  assert(SA.StageCars.targetKeys().includes('0:2'));
  return { stages: 3, rewardOnce: true, budget: SA.V.stats(vehicle).value, reportMigration: true, favoriteMigration: true, manualMigration: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
