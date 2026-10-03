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
  // 作者可调整固定奖励数量；按当前关卡明确配置精确校验发放与补档幂等。
  const plateReward = SA.Camp.stage(0, 1).rewardItems.filter(item => item.id === 'plate')
    .reduce((total, item) => total + item.count, 0);
  assert(Number.isInteger(plateReward) && plateReward > 0, '甲片关缺少有效的甲片实物奖励');
  SA.S.reset();
  const before = SA.S.invCount('plate');
  SA.Camp.win();
  assert.strictEqual(SA.S.d.camp.st, 1);
  assert.strictEqual(SA.Camp.current().spec.reward, 'plate');
  SA.Camp.win();
  assert.strictEqual(SA.S.invCount('plate'), before + plateReward, '已有甲片解锁时实物奖励数量不符');
  assert.strictEqual(SA.Camp.current().spec.reward, 'bucket');
  SA.Camp.backfill(); SA.Camp.backfill();
  assert.strictEqual(SA.S.invCount('plate'), before + plateReward, '读档补解锁重复发放甲片');
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

  // 正式关卡的最终记录和做出来的关一一对应（后台新建关卡时一起登记，占位的空关不算）；旧手工缓存只在服务端迁移一次。
  assert.strictEqual(SA.StageCars.targetKeys().length, SA.CAMPAIGN.reduce((n, ch) => n + ch.stages.filter(st => !st.unfinished).length, 0));
  assert(SA.StageCars.targetKeys().every(key => SA.STAGE_CARS.records[key]?.id === key));
  return { stages: 3, rewardOnce: true, budget: SA.V.stats(vehicle).value, reportMigration: true, favoriteMigration: true, configComplete: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
