/* 商店售卖回归：使用正式状态入口验证解锁、额外名单与唯一件的共同门槛。 */
'use strict';

const assert = require('assert');
const { loadGame } = require('./evolve');

/** 失败购买不得扣钱或生成库存。 */
function denied(SA, id) {
  const before = { money: SA.S.d.money, inv: JSON.stringify(SA.S.d.inv), stock: JSON.stringify(SA.S.d.stockCells) };
  assert.strictEqual(SA.S.buyable(id), false, `${id} 错误地显示可售`);
  assert.strictEqual(SA.S.buy(id), false, `${id} 错误地成交`);
  assert.strictEqual(SA.S.d.money, before.money, `${id} 拒售后仍扣钱`);
  assert.strictEqual(JSON.stringify(SA.S.d.inv), before.inv, `${id} 拒售后仍增库存`);
  assert.strictEqual(JSON.stringify(SA.S.d.stockCells), before.stock, `${id} 拒售后仍增实例库存`);
}

function run() {
  const { SA } = loadGame();
  SA.S.reset();
  SA.S.d.money = 100000;
  assert.deepStrictEqual(Array.from(SA.SHOP_EXTRAS), [], '额外售卖清单应默认为空');

  denied(SA, 'track'); // 已解锁模块也必须等商店开张。
  SA.S.d.camp.feat.push('shop');
  denied(SA, 'mortar_s'); // 普通模块未解锁时不可直接调用购买入口绕过。
  SA.S.d.camp.mods.push('mortar_s');
  assert(SA.S.buyable('mortar_s') && SA.S.buy('mortar_s'), '已解锁普通模块不能购买');
  assert.strictEqual(SA.S.invCount('mortar_s'), 1, '购买未进入库存');

  SA.S.d.camp.mods.pop();
  SA.SHOP_EXTRAS.push('mortar_s');
  assert(!SA.Camp.hasMod('mortar_s'), '额外名单不应写入战役解锁');
  assert(SA.S.buyable('mortar_s') && SA.S.buy('mortar_s'), '额外名单中的普通模块不能购买');
  assert.strictEqual(SA.S.invCount('mortar_s'), 2, '额外名单购买未进入库存');

  // 唯一件、材料、商店开放和模块注册仍由同一闸门限制。
  SA.SHOP_EXTRAS.push('boss_ram', 'flamer', 'copilot', 'missing_module', 'quad:centaur');
  denied(SA, 'boss_ram');
  denied(SA, 'flamer');
  denied(SA, 'copilot');
  denied(SA, 'missing_module');
  denied(SA, 'quad:centaur');
  SA.S.d.camp.mat = 4;
  const money = SA.S.d.money;
  assert(SA.S.buyable('flamer') && SA.S.buy('flamer'), '额外名单的普通模块在材料解锁后仍不可购买');
  assert.strictEqual(SA.S.invCount('flamer'), 1, '材料解锁后的购买未入库');
  assert.strictEqual(SA.S.d.money, money - SA.buyPrice('flamer'), '材料解锁后的购买扣款不正确');
  SA.S.d.camp.mat = 6;
  denied(SA, 'boss_ram');
  SA.S.d.camp.feat = [];
  denied(SA, 'mortar_s');
  SA.S.d.camp.feat.push('shop');

  // 腿的稀有外观是实例身份，不能封禁普通底盘整类。
  SA.SHOP_EXTRAS.push('quad');
  assert.strictEqual(SA.uniqueRule('quad'), null, '普通四足底盘被错误标成唯一件');
  assert(SA.LEG_VARIANTS.some(x => x.id === 'quad'), '缺少四足唯一外观夹具');
  assert(SA.S.buyable('quad') && SA.S.buy('quad'), '唯一外观阻止普通四足底盘购买');
  SA.SHOP_EXTRAS.length = 0;
  return { unlocked: true, extra: true, uniqueBlocked: true, baseQuadBuyable: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
