/* 出征制作专项：奖励、独立物资币种、旧档迁移与重复结算；使用正式规则，不修改关卡配置。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { runtime } = require('./route-check');

function run() {
  const rt = runtime(), { SA, context } = rt, S = SA.S;
  const money0 = S.d.money;
  assert.strictEqual(S.d.route.materials, 0);
  assert.strictEqual(S.d.route.defeatedEnemies, 0);
  assert.strictEqual(S.isRouteMode(), false);
  const shop0 = SA.Camp.has('shop');
  S.setPlayMode('route');
  assert(SA.Camp.has('shop') && SA.Camp.has('garage'));
  const result = (runId, enemiesCleared, how = 'recall') => ({ mode: 'route', route: 'r1', runId, how,
    dist: 3000, enemiesCleared, metal: 7, cargo: ['supply', 'relic', 'refugee'] });
  const first = SA.Route.settle(result('craft-1', 1));
  assert.strictEqual(S.invCount('radiator'), 0);
  assert.strictEqual(first.materials, 195);
  assert.strictEqual(S.d.route.refugees, 1);
  const second = SA.Route.settle(result('craft-2', 1));
  assert.strictEqual(S.invCount('radiator'), 1);
  assert.strictEqual(second.items[0].id, 'radiator');
  assert.strictEqual(S.d.route.defeatedEnemies, 2);
  assert(S.craftable('radiator'));
  // 奖品沿正式库存取件接口可装，材料等级是黄铜。
  const reward = S.takeStock('radiator', 1);
  assert.strictEqual(reward.id, 'radiator');
  S.addInv('radiator', 1, 1, reward);
  const snapshot = JSON.stringify(S.d), writes0 = rt.writes();
  SA.Route.settle(second);
  SA.Route.settle(result('craft-2', 1));
  assert.strictEqual(JSON.stringify(S.d), snapshot);
  assert.strictEqual(rt.writes(), writes0);
  SA.Route.settle(result('craft-3', 1));
  assert.strictEqual(S.invCount('radiator'), 1);
  assert.strictEqual(S.d.route.defeatedEnemies, 3);
  assert.strictEqual(S.d.money, money0);
  assert.strictEqual(S.buy('radiator'), false);
  // 数量非法、未解锁和余额不足均不扣款、不写档、不入库。
  for (const n of [0, -1, 1.5, NaN, Infinity]) assert.strictEqual(S.craft('radiator', n).ok, false);
  assert.strictEqual(S.craft('helmet').ok, false);
  const funds = S.d.route.materials;
  S.d.route.materials = 0;
  assert.strictEqual(S.craft('radiator').ok, false);
  S.d.route.materials = funds;
  const beforeCraft = S.invCount('radiator'), beforeWrite = rt.writes();
  S.d.route.materials = S.craftPrice('radiator') * 2;
  const crafted = S.craft('radiator', 2);
  assert(crafted.ok); assert.strictEqual(crafted.balance, 0);
  assert.strictEqual(S.invCount('radiator'), beforeCraft + 2);
  assert.strictEqual(rt.writes(), beforeWrite + 1);
  assert.strictEqual(S.d.money, money0);
  S.setPlayMode('campaign');
  assert.strictEqual(SA.Camp.has('shop'), shop0);
  assert.strictEqual(S.craftable('radiator'), false);
  S.d.camp.feat.push('shop');
  const basic = [...SA.Camp.shopMods()].find(id => S.buyable(id));
  S.d.money = SA.buyPrice(basic);
  assert(S.buy(basic)); assert.strictEqual(S.d.money, 0);
  // 保留规则由 Battle.cargoResult 先执行；结算只接收到已带回的货物，损毁金属减半。
  const wreck = SA.Route.settle(result('craft-wreck', 0, 'wrecked'));
  assert.strictEqual(wreck.metalKept, 3);
  assert.strictEqual(wreck.materials, 175);
  assert.strictEqual(SA.Route.settle(result('craft-hot', 0, 'overheated')).metalKept, 7);
  assert.strictEqual(SA.Route.settle(result('craft-recall', 0)).metalKept, 7);
  // 旧档没有新字段时全部从零开始；重载最近结果不重复结算。
  const old = JSON.parse(JSON.stringify(S.d));
  delete old.playMode; delete old.route.materials; delete old.route.defeatedEnemies; delete old.route.radiatorRewardClaimed;
  old.route.runs = 20;
  let saved = JSON.stringify(old);
  context.localStorage = { getItem() { return saved; }, setItem(key, value) { saved = value; } };
  S.load();
  assert.strictEqual(S.d.route.materials, 0); assert.strictEqual(S.d.route.defeatedEnemies, 0);
  assert.strictEqual(S.isRouteMode(), false);
  S.setPlayMode('route'); S.save(); S.load(); assert(S.isRouteMode());
  const restored = JSON.stringify(S.d);
  // 重新加载路线模块清空内存去重集合，真实验证持久的最近结算身份。
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/route.js'), 'utf8'), context, { filename: 'js/route.js' });
  SA.Route.settle(result('craft-recall', 4));
  assert.strictEqual(JSON.stringify(S.d), restored);
  return { rewardOnce: true, craftingAtomic: true, currencySeparated: true, legacyDefaults: true, reloadIdempotent: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
