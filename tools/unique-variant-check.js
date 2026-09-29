/*
 * 唯一缴获与腿部变体回归。运行：node tools/unique-variant-check.js。
 * 走正式 battle 结束回调和 settleBattle，避免手造结算漏掉首次奖励逻辑。
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tools/evolve'));

/** 建立无画面战斗，保留生产规则的开始、结束和结算链。 */
function runtime() {
  const { SA, context } = loadGame();
  let api, result;
  SA.BattleView = { create(value) {
    api = value;
    return {
      start: opts => api.startState(opts), gameSpeed: () => 1, teardown() {}, emit() {},
      presentResult(data) { result = data; },
    };
  } };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  function play(entry, outcome, rewardKey = null) {
    result = null;
    entry.start();
    const B = SA.Battle.debug.B;
    if (rewardKey) SA.V.each(B.e.v, cell => {
      if (cell.unique === rewardKey) cell.hp = 0;
    });
    if (outcome === 'draw') { B.draw = '回归夹具平手'; B.ending = SA.K.BATTLE.ENDING_TIME; }
    else api.kill(outcome === 'win' ? B.e : B.p, '回归夹具判负');
    for (let i = 0; i < 600 && !B.done; i++) api.step(1 / 60);
    assert(result, '战斗没有生成正式结算结果');
    return { result, settlement: SA.S.settleBattle(result) };
  }
  return { SA, context, play };
}

/** 将 VM 中的对象转为本进程对象，避免跨 realm 的原型影响深比较。 */
const plain = value => JSON.parse(JSON.stringify(value));
const stock = SA => SA.S.d.stockCells || [];
const copies = (SA, key) => stock(SA).filter(cell => cell.unique === key);

/** 统一检查 18 种数据、奖励车配置及纯外观的数值约束。 */
function checkCatalog(SA) {
  assert.strictEqual(SA.LEG_VARIANTS.length, 18, '腿部变体必须有 18 种');
  assert.strictEqual(new Set(SA.LEG_VARIANTS.map(x => x.key)).size, 18, '腿部变体 key 重复');
  assert.strictEqual(SA.LEG_VARIANTS.filter(x => x.id === 'quad').length, 9, '四足变体应有 9 种');
  assert.strictEqual(SA.LEG_VARIANTS.filter(x => x.id === 'biped').length, 9, '双足变体应有 9 种');
  for (const variant of SA.LEG_VARIANTS) {
    assert(variant.look && variant.name && variant.mt && variant.chapter, `${variant.key} 缺少外观或来源`);
    const side = SA.SIDE_ENCOUNTERS.find(x => x.reward?.key === variant.key);
    assert(side, `${variant.key} 没有专属遭遇战`);
    assert.strictEqual(side.reward.id, variant.id, `${variant.key} 奖励模块不一致`);
    assert.strictEqual(side.reward.look, variant.look, `${variant.key} 奖励外观不一致`);
    assert(side.reward.unique && side.reward.guaranteed, `${variant.key} 未设置保底唯一奖励`);
    const base = SA.newCell(variant.id, variant.mt);
    const decorated = { ...base, look: variant.look, unique: variant.key };
    assert.strictEqual(SA.V.maxHp(decorated), SA.V.maxHp(base), `${variant.key} 改变了耐久`);
    assert.strictEqual(SA.cellValue(decorated), SA.cellValue(base), `${variant.key} 改变了价值`);
  }
  for (const side of SA.SIDE_ENCOUNTERS) {
    SA.S.d.camp.ch = Math.max(1, side.chapter || 1);
    const entry = SA.Camp.sideEntries().find(x => x.id === side.id);
    assert(entry, `${side.id} 没有生成遭遇战`);
    assert.strictEqual(SA.V.issues(entry.vehicle).length, 0, `${side.id} 敌车构筑不合法`);
    let mounted = false;
    SA.V.each(entry.vehicle, cell => { if (cell.id === side.reward.id && cell.unique === side.reward.key) mounted = true; });
    assert(mounted, `${side.id} 的敌车没有装上带奖励身份的模块`);
    if (side.reward.id === 'quad' || side.reward.id === 'biped') {
      const plainVehicle = SA.V.clone(entry.vehicle);
      SA.V.each(plainVehicle, cell => { delete cell.unique; delete cell.look; });
      const variantStats = SA.V.stats(entry.vehicle), plainStats = SA.V.stats(plainVehicle);
      for (const field of ['speed', 'accel', 'brake', 'drive', 'weight', 'load', 'hp', 'maxHp', 'rating'])
        assert.strictEqual(variantStats[field], plainStats[field], `${side.id} 外观改变了数值 ${field}`);
    }
  }
  for (const id of ['dock_patrol', 'factory_escort']) {
    const side = SA.SIDE_ENCOUNTERS.find(x => x.id === id);
    assert(side, `旧支线 ${id} 丢失`);
    assert.strictEqual(side.reward.key, `side:${id}`, `旧支线 ${id} 缺少独立奖励 key`);
    const entry = SA.Camp.sideEntries().find(x => x.id === id);
    if (entry) {
      let mounted = false;
      SA.V.each(entry.vehicle, cell => { if (cell.id === side.reward.id) mounted = true; });
      assert(mounted, `${id} 的敌车没有实际装上奖励模块`);
    }
  }
}

/** 普通模块不能因历史唯一账本或旧支线奖励而被锁在商店外。 */
function checkOrdinaryModules(SA) {
  SA.S.reset();
  SA.S.d.camp.feat.push('shop');
  for (const id of ['periscope', 'armor_heavy']) {
    if (!SA.S.d.camp.mods.includes(id)) SA.S.d.camp.mods.push(id);
    SA.S.d.uniqueClaims[id] = { mt: 2, source: 'legacy' };
    assert(!SA.uniqueRule(id), `${id} 被整类标成唯一件`);
    assert.strictEqual(SA.S.buyable(id), true, `${id} 无法从商店购买`);
    SA.S.d.money = 100000;
    assert.strictEqual(SA.S.buy(id), true, `${id} 购买失败`);
  }
}

/** 保底奖励须在首次胜利发放，失败和平手不发，重打不重复。 */
function checkSideRewards(SA, play) {
  let checked = 0;
  for (const side of SA.SIDE_ENCOUNTERS) {
    if (!side.reward) continue;
    SA.S.reset();
    SA.S.d.camp.ch = Math.max(1, side.chapter || 1);
    const first = SA.S.arenaEntries('side').find(x => x.key === side.id);
    assert(first && !first.replay, `${side.id} 首战入口不可用`);
    const key = side.reward.key;
    play(first, 'loss');
    assert.strictEqual(copies(SA, key).length, 0, `${side.id} 失败发奖`);
    play(SA.S.arenaEntries('side').find(x => x.key === side.id), 'draw');
    assert.strictEqual(copies(SA, key).length, 0, `${side.id} 平手发奖`);
    const { result } = play(SA.S.arenaEntries('side').find(x => x.key === side.id), 'win', key);
    assert.strictEqual(result.replay, false, `${side.id} 首胜被标为重打`);
    assert.strictEqual(copies(SA, key).length, 1, `${side.id} 首胜没有自动发保底件`);
    const item = copies(SA, key)[0];
    assert.strictEqual(item.id, side.reward.id, `${side.id} 入库模块错误`);
    assert.strictEqual(item.mt, side.reward.mt, `${side.id} 入库材料错误`);
    if (side.reward.look) assert.strictEqual(item.look, side.reward.look, `${side.id} 入库外观丢失`);
    const before = plain(SA.S.d);
    const replay = SA.S.arenaEntries('side').find(x => x.key === side.id);
    assert(replay.replay, `${side.id} 没有变为重打`);
    play(replay, 'win');
    const after = plain(SA.S.d);
    delete before.news; delete after.news;
    assert.deepStrictEqual(after, before, `${side.id} 重打重复发奖或修改进度`);
    for (const outcome of ['loss', 'draw']) {
      const replayBefore = plain(SA.S.d);
      play(SA.S.arenaEntries('side').find(x => x.key === side.id), outcome);
      const replayAfter = plain(SA.S.d);
      delete replayBefore.news; delete replayAfter.news;
      assert.deepStrictEqual(replayAfter, replayBefore, `${side.id} 重打 ${outcome} 修改了存档`);
    }
    checked++;
  }
  return checked;
}

/** 从旧存档迁移时按支线完成记录补发一次，重复读取保持幂等。 */
function checkLegacyBackfill(SA, context) {
  SA.S.reset();
  SA.S.d.camp.sideWins.dock_patrol = { at: 1 };
  SA.S.d.camp.sideWins.factory_escort = { at: 1 };
  SA.S.d.stockCells = [];
  let saved = JSON.stringify(SA.S.d);
  context.localStorage.getItem = () => saved;
  context.localStorage.setItem = (key, value) => { saved = value; };
  SA.S.load(); SA.Camp.backfill(); SA.S.save();
  for (const key of ['side:dock_patrol', 'side:factory_escort'])
    assert.strictEqual(copies(SA, key).length, 1, `${key} 旧档未补发`);
  SA.S.load(); SA.Camp.backfill(); SA.S.save();
  for (const key of ['side:dock_patrol', 'side:factory_escort'])
    assert.strictEqual(copies(SA, key).length, 1, `${key} 旧档重复补发`);
}

/** 蓝图没有指定唯一实物时必须拒绝组装，不能用普通同类库存顶替。 */
function checkBlueprintBlock(SA) {
  SA.S.reset();
  const base = SA.LEG_VARIANTS.find(x => x.id === 'quad');
  const target = SA.V.fromCells('唯一件蓝图测试', [[0, 10, 4, 'quad', base.mt, 0,
    { unique: base.key, look: base.look }]]);
  const bp = SA.V.layout(target);
  const before = plain(SA.S.d);
  const p = SA.S.Blueprints.plan(bp);
  assert(p.blocked.length, '未持有的唯一件没有阻止蓝图组装');
  assert.strictEqual(SA.S.Blueprints.applyPlan(p), false, '被阻止的蓝图仍可应用');
  assert.deepStrictEqual(plain(SA.S.d), before, '被阻止的蓝图修改了存档');
}

/** 旧档唯一件纠正材料时必须同步聚合库存，避免原材料留下可重复领取的普通件。 */
function checkStockMaterialMigration(SA, context) {
  SA.S.reset();
  SA.S.d.inv = { quad: 1 };
  SA.S.d.stockCells = [{ ...SA.newCell('quad', 1), unique: 'quad:centaur', look: 'centaur' }];
  let saved = JSON.stringify(SA.S.d);
  context.localStorage.getItem = () => saved;
  context.localStorage.setItem = (key, value) => { saved = value; };
  SA.S.load(); SA.S.save(); SA.S.load();
  assert.strictEqual(SA.S.d.inv.quad, undefined, '材料纠正后旧库存键仍有残留');
  assert.strictEqual(SA.S.d.inv['quad@5'], 1, '材料纠正后新库存数量错误');
  const cell = SA.S.takeStock('quad', 5, 'quad:centaur');
  assert(cell && cell.mt === 5, '纠正材料后的唯一件无法取出');
  assert.strictEqual(SA.S.invCount('quad'), 0, '唯一件取出后还有残留或非法数量');
  assert.strictEqual(SA.S.d.stockCells.length, 0, '唯一件取出后实例仍在库存');
}

/** 同材质变体按 key 取件，安装拆回与分享蓝图继续保留身份。 */
function checkIdentityLifecycle(SA) {
  SA.S.reset();
  const variants = SA.LEG_VARIANTS.filter(x => x.id === 'quad' && x.mt === 3);
  assert(variants.length >= 2, '需要两种同材质四足变体');
  for (const x of variants.slice(0, 2)) assert(SA.Camp.claimReward({ ...x, unique: true }), `${x.key} 首次缴获失败`);
  const [a, b] = variants;
  assert.strictEqual(SA.S.stockOptions('quad', 3).length, 2, '同材质变体库存没有并存');
  assert.strictEqual(SA.S.sellStock('quad', 3), 0, '未指定身份的合并行误卖了唯一件');
  SA.S.addInv('quad', 1, 3);
  assert(SA.S.sellStock('quad', 3) > 0, '合并行无法出售普通件');
  assert.strictEqual(SA.S.stockOptions('quad', 3).length, 2, '出售普通件影响了唯一库存');
  const selected = SA.S.takeStock('quad', 3, b.key);
  assert.strictEqual(selected.unique, b.key, '按 key 取出了另一种变体');
  assert.strictEqual(SA.S.stockOptions('quad', 3)[0].unique, a.key, '精确取件影响另一件');
  SA.S.addInv('quad', 1, 3, selected);
  const vehicle = SA.V.create('库存身份测试');
  SA.S.installStock(vehicle, 'quad', 10, 4, 3, 'body', null, [], b.key);
  assert.strictEqual(vehicle.body[10][4].unique, b.key, '安装后唯一身份丢失');
  assert.strictEqual(vehicle.body[10][4].look, b.look, '安装后外观丢失');
  const code = SA.V.encode(vehicle), decoded = SA.V.decode(code);
  assert(decoded, '带变体的分享码无法解码');
  assert.strictEqual(decoded.body[10][4].unique, b.key, '分享码丢失唯一身份');
  assert.strictEqual(decoded.body[10][4].look, b.look, '分享码丢失外观');
  const bp = SA.V.layout(decoded);
  assert.strictEqual(SA.V.fromLayout('蓝图往返', bp).body[10][4].unique, b.key, '蓝图丢失唯一身份');
  SA.S.d.vehicle = vehicle;
  const removed = SA.S.removeVehicleCell('body', 10, 4);
  assert(removed.ok, '拆下变体失败');
  assert.strictEqual(SA.S.stockOptions('quad', 3).filter(x => x.unique === b.key).length, 1, '拆下后未按身份入库');
  const p = SA.S.Blueprints.plan(bp);
  assert.strictEqual(p.blocked.length, 0, '已持有唯一件的蓝图被误挡');
  assert.notStrictEqual(SA.S.Blueprints.applyPlan(p), false, '已持有唯一件的蓝图无法应用');
  assert.strictEqual(SA.S.d.vehicle.body[10][4].unique, b.key, '蓝图应用后身份丢失');
  assert.strictEqual(SA.S.d.vehicle.body[10][4].look, b.look, '蓝图应用后外观丢失');
  const epic = SA.S.d.vehicle.body[10][4];
  const mt = epic.mt;
  const changed = SA.S.upgradeMaterial(epic, { to: mt + 1, mat: SA.MATS[mt + 1] || SA.MATS[mt] });
  assert.strictEqual(changed, false, '唯一件允许升级材料');
  assert.strictEqual(epic.mt, mt, '拒绝升级后材料仍被改变');
  assert(SA.S.sellStock('quad', 3, a.key) > 0, '明确指定身份后无法出售唯一件');
  assert(!SA.S.stockOptions('quad', 3).some(x => x.unique === a.key), '指定出售后唯一实例仍在库存');
}

function run() {
  const { SA, context, play } = runtime();
  SA.S.reset();
  checkCatalog(SA);
  checkOrdinaryModules(SA);
  const sideRewards = checkSideRewards(SA, play);
  checkLegacyBackfill(SA, context);
  checkStockMaterialMigration(SA, context);
  checkBlueprintBlock(SA);
  checkIdentityLifecycle(SA);
  return { variants: SA.LEG_VARIANTS.length, sideRewards, ordinaryBuyable: true, legacyBackfill: true, stockMaterialMigration: true, blueprintBlock: true, identityLifecycle: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
