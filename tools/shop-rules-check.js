/* 商店售卖回归：正式状态入口按战役进度、章节白名单及交易门槛判断。 */
'use strict';

const assert = require('assert');
const { loadGame } = require('./evolve');

/** 拒售必须同时挡住列表查询和直接购买，且不能扣款或改变库存。 */
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
  const C = SA.S.d.camp;

  denied(SA, 'track'); // 商店开张前，起始模块也不能购买。
  C.feat.push('shop');
  assert(SA.S.buyable('track') && SA.S.buy('track'), '起始模块未进入商店');
  denied(SA, 'mortar_s');
  C.mods.push('mortar_s');
  SA.S.addInv('mortar_s', 1);
  const owned = SA.S.invCount('mortar_s');
  assert(SA.Camp.hasMod('mortar_s') && owned > 0, '旧档夹具未保留解锁与库存');
  denied(SA, 'mortar_s'); // 旧档全解锁和已有库存都不能提前扩展商店。
  assert(SA.S.invCount('mortar_s') === owned && SA.Camp.hasMod('mortar_s'));

  C.st = 1;
  assert(SA.S.buyable('tank_s'), '已通过首关的解锁未售卖');
  denied(SA, 'bucket');
  C.st = 2;
  denied(SA, 'bucket'); // 当前尚未通过的章末关不能提前售卖。
  C.ch = 1; C.st = 0;
  assert(SA.S.buyable('bucket') && SA.S.buyable('cannon_s'), '已通过关卡或章节解锁丢失');
  denied(SA, 'mortar_s');
  C.st = 1;
  assert(SA.S.buyable('mortar_s') && SA.S.buy('mortar_s'), '当前章已通过关卡未售卖');
  C.st = 2;
  denied(SA, 'cockpit_pair'); // 驾驶舱虽已解锁，仍不能在商店购买。
  denied(SA, 'mortar');
  // 关卡布局 4：第一章只做了前三关、没有章节通关奖励；打完这三关停在章内，只开放这三关的解锁
  C.st = 3;
  assert(SA.S.buyable('mortar'), '第一章已通过关卡的解锁未售卖');
  denied(SA, 'quad');

  // 作者白名单只属于当前章；未通关关卡的 unlock 不能被误当作白名单。
  C.ch = 0; C.st = 0;
  SA.CAMPAIGN[0].shopExtras = ['mortar_s', 'flamer', 'boss_ram', 'copilot', 'missing_module', 'quad:centaur'];
  assert(SA.S.buyable('mortar_s') && SA.S.buy('mortar_s'), '当前章节白名单未开放普通模块');
  denied(SA, 'flamer'); // 材料门槛仍生效。
  for (const id of ['boss_ram', 'copilot', 'missing_module', 'quad:centaur']) denied(SA, id);
  C.mat = 4;
  assert(SA.S.buyable('flamer') && SA.S.buy('flamer'), '材料达标后白名单模块不可买');
  C.ch = 1;
  denied(SA, 'flamer');
  SA.CAMPAIGN[1].shopExtras = ['quad'];
  assert(SA.S.buyable('quad') && SA.S.buy('quad'), '本章白名单未售卖普通四足底盘');
  assert(SA.uniqueRule('quad') === null && SA.LEG_VARIANTS.some(x => x.id === 'quad'));

  C.done = true; C.mat = 6;
  assert(SA.S.buyable('mortar'), '全战役完成后遗漏已解锁模块');
  denied(SA, 'cockpit_pair'); // 全战役完成后驾驶舱仍禁售。
  denied(SA, 'cannon_giant');
  denied(SA, 'boss_ram');
  C.feat = [];
  denied(SA, 'track');
  return { progress: true, currentChapterExtras: true, oldSavePreserved: true, uniqueAndMaterialGate: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
