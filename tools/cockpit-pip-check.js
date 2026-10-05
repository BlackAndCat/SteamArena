/* 驾驶舱禁售与皮普入车剧情的专项回归检查。 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 模拟商店已开、所有模块列入作者白名单且材料已解锁，验证驾驶舱仍不能购买。 */
function cockpitPurchaseCheck() {
  const { SA } = loadGame();
  SA.S.reset();
  const cockpitIds = Object.keys(SA.MODULES).filter(id => SA.isCockpit(id));
  assert.deepStrictEqual(cockpitIds.slice().sort(), ['cockpit', 'cockpit_pair', 'helmet', 'mech_helm']);   // mech_helm：机甲头盔（2026-10-05，用户授权 Opus 新增）
  SA.Camp.has = () => true;
  SA.Camp.shopMods = () => new Set(Object.keys(SA.MODULES));
  SA.S.d.money = 100000;
  for (let mt = 1; mt <= SA.MAT_MAX; mt++) {
    SA.Camp.maxMat = () => mt;
    for (const id of cockpitIds) {
      const before = JSON.stringify({ money: SA.S.d.money, inv: SA.S.d.inv, stockCells: SA.S.d.stockCells });
      assert.strictEqual(SA.S.buyable(id), false, `${id} 在材料 ${mt} 下仍可售`);
      assert.strictEqual(SA.S.buy(id), false, `${id} 在材料 ${mt} 下购买成功`);
      assert.strictEqual(JSON.stringify({ money: SA.S.d.money, inv: SA.S.d.inv, stockCells: SA.S.d.stockCells }), before,
        `${id} 购买失败后改变了金钱或库存`);
    }
  }
  assert.strictEqual(SA.S.buyable('armor'), true, '普通装甲被误禁售');
  const armorBefore = SA.S.invCount('armor'), moneyBefore = SA.S.d.money;
  assert.strictEqual(SA.S.buy('armor'), true, '普通装甲不能购买');
  assert.strictEqual(SA.S.invCount('armor'), armorBefore + 1);
  assert.strictEqual(SA.S.d.money, moneyBefore - SA.buyPrice('armor'));

  // 蓝图缺件时也必须沿用商店可售规则；已有库存则仍可完成组装。
  const target = SA.V.clone(SA.S.d.vehicle);
  target.body[7][9] = SA.newCell('cockpit_pair');
  const blueprint = SA.V.layout(target);
  const shortPlan = SA.S.Blueprints.plan(blueprint);
  assert(shortPlan.blocked.length, '蓝图缺少双人舱却未阻止自动补买');
  const beforeApply = JSON.stringify({ money: SA.S.d.money, inv: SA.S.d.inv, vehicle: SA.S.d.vehicle });
  assert.strictEqual(SA.S.Blueprints.applyPlan(shortPlan), false, '被拒绝的蓝图仍完成组装');
  assert.strictEqual(JSON.stringify({ money: SA.S.d.money, inv: SA.S.d.inv, vehicle: SA.S.d.vehicle }), beforeApply);
  SA.S.addInv('cockpit_pair', 1, 1);
  const stockedPlan = SA.S.Blueprints.plan(blueprint);
  assert.strictEqual(stockedPlan.blocked.length, 0, '库存中的双人舱被误禁用');
  assert.strictEqual(SA.S.Blueprints.applyPlan(stockedPlan), true, '库存中的双人舱无法通过蓝图组装');
  assert.strictEqual(SA.V.countIds(SA.S.d.vehicle).cockpit_pair, 1);
  assert.strictEqual(SA.S.invCount('cockpit_pair'), 0);
  const directly = loadGame().SA;
  directly.S.reset();
  directly.S.addInv('cockpit_pair', 1, 1);
  directly.S.d.vehicle.body[9][8] = null;
  directly.S.installStock(directly.S.d.vehicle, 'cockpit_pair', 7, 9, 1, 'body', null, [], null);
  assert.strictEqual(directly.V.countIds(directly.S.d.vehicle).cockpit_pair, 1, '库存双人舱不能直接安装');
  assert.strictEqual(directly.S.invCount('cockpit_pair'), 0, '直接安装没有消耗库存');
  return { cockpitIds, materials: SA.MAT_MAX, ordinaryPurchase: true, stockedBlueprint: true, stockedInstall: true };
}

/** 在规则 VM 中加载真实剧情和导航入口，只替换画面渲染以记录路由与对话完成回调。 */
function storyHarness(storage = new Map()) {
  const { SA, context } = loadGame();
  context.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  context.document.body.dataset = {};
  context.document.querySelector = () => ({ hidden: true, addEventListener() {} });
  context.console = { ...console, info() {} };
  const loads = {}, calls = { home: 0, arena: 0, talks: [], begin: 0 };
  context.addEventListener = (name, callback) => { loads[name] = callback; };
  SA.S.load();
  SA.Camp.has = () => true;
  SA.Text = { init() {} };
  SA.PX = { init() {} };
  SA.UI.topbar = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/story.js'), 'utf8'), context);
  SA.Home = { open() { calls.home++; SA.go('home'); } };
  SA.Arena = { open() { calls.arena++; SA.go('arena'); } };
  SA.Editor = { open() { SA.go('garage'); } };
  SA.Story.talk = (rows, options) => { calls.talks.push({ rows, options }); };
  SA.Story.title = callback => { calls.start = callback; };
  SA.Story.begin = () => { calls.begin++; };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8'), context);
  return { SA, storage, calls, loads };
}

/** 检查库存不触发、双路由强制回院、在播重入、跳过后通行以及中断刷新重播。 */
function pipStoryCheck() {
  const homeFirst = storyHarness();
  homeFirst.SA.S.d.vehicle.body[7][9] = homeFirst.SA.newCell('cockpit_pair');
  homeFirst.SA.nav('home');
  assert.strictEqual(homeFirst.calls.home, 1, '首次回院子未打开院子');
  assert.strictEqual(homeFirst.calls.talks.length, 1, '首次回院子未播放剧情');
  assert.strictEqual(homeFirst.calls.arena, 0);
  const storage = new Map(), first = storyHarness(storage), { SA, calls } = first;
  SA.S.addInv('cockpit_pair', 1, 1);
  assert.strictEqual(SA.Story.pipInVehicle(), false, '仅有库存就判定皮普上车');
  SA.nav('arena');
  assert.strictEqual(calls.arena, 1, '仅有库存却被剧情阻断出战');
  SA.S.d.vehicle.body[7][9] = SA.newCell('cockpit_pair');
  SA.S.save();
  assert.strictEqual(SA.Story.pipInVehicle(), true, '装车后未判定皮普上车');
  SA.nav('arena');
  assert.strictEqual(calls.home, 1, '首次点出战未强制回院子');
  assert.strictEqual(calls.arena, 1, '首次剧情前已进入出战页');
  assert.strictEqual(calls.talks.length, 1, '首次装车未播放独立剧情');
  assert(calls.talks[0].rows.some(row => row.text.includes('第二门武器')), '剧情未说明皮普可操作第二门武器');
  assert.strictEqual(SA.Story.seen('pip_pair'), false, '剧情尚未结束就记录已看');
  SA.nav('home'); SA.nav('arena');
  assert.strictEqual(calls.talks.length, 1, '在播重复导航叠加了剧情');
  assert.strictEqual(calls.arena, 1, '在播重复导航绕进出战页');
  assert.strictEqual(SA.current, 'home', '在播重复导航离开了院子');

  // 不调用 onDone 模拟刷新中断：新页面从同一存档和剧情标记重新进入。
  const startupPending = storyHarness(new Map(storage));
  startupPending.loads.DOMContentLoaded();
  assert.strictEqual(startupPending.calls.talks.length, 0, '标题显示期间提前在幕后播放皮普剧情');
  startupPending.calls.start();
  assert.strictEqual(startupPending.calls.talks.length, 1, '点击开始后未播放中断的剧情');
  const pending = storyHarness(storage);
  assert.strictEqual(pending.SA.Story.pipInVehicle(), true);
  pending.SA.nav('home');
  assert.strictEqual(pending.calls.talks.length, 1, '中断后未重新播放剧情');
  pending.calls.talks[0].options.onDone();
  assert.strictEqual(pending.SA.Story.seen('pip_pair'), true, '跳过完成后未记录已看');
  pending.SA.nav('arena');
  assert.strictEqual(pending.calls.arena, 1, '剧情完成后仍阻止出战');
  pending.SA.S.d.vehicle.body[7][9] = null;
  assert.strictEqual(pending.SA.Story.pipInVehicle(), false, '拆下双人舱后皮普未返回院子');
  pending.SA.nav('home');
  assert.strictEqual(pending.calls.home, 2, '拆下后无法正常返回院子');
  assert.strictEqual(pending.calls.talks.length, 1, '拆下后重复播放剧情');

  // 已看过后刷新：标题关闭后正常进院子，不重复播放。
  const startup = storyHarness(new Map(storage));
  startup.loads.DOMContentLoaded();
  assert.strictEqual(startup.calls.talks.length, 0, '标题显示期间提前在幕后播放皮普剧情');
  startup.calls.start();
  assert.strictEqual(startup.calls.talks.length, 0, '已看过的剧情在启动时重播');
  return { homeFirst: true, forcedHome: true, reentryBlocked: true, pendingReplay: true, returnAfterRemoval: true };
}

/** 院子闲谈按在场人物过滤整组，不让皮普缺席时出现单句或接话。 */
function yardChatCheck() {
  const { SA, context } = loadGame();
  SA.S.reset();
  const groups = [
    { id: 'pip', name: '皮普独白', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'tim', text: '我在院子里', action: 'talk' }] },
    { id: 'mixed', name: '两人对答', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'tom', text: '皮普？', action: 'talk' }, { who: 'tim', text: '在！', action: 'talk' }] },
    { id: 'tom', name: '汤姆独白', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'tom', text: '继续工作', action: 'talk' }] },
  ];
  SA.Text = { get(key, fallback) {
    if (key === 'home:chat:pool:global') return JSON.stringify(groups);
    if (key === 'home:chat:settings') return JSON.stringify({ intervalSec: 1, bubbleSec: 1, replySec: 0.1 });
    return fallback;
  } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/yard-chat.js'), 'utf8'), context);
  const player = SA.YardChat.createPlayer('global', ['rel', 'tom']);
  for (let now = 1; now <= 5; now++) assert.strictEqual(player.step(now, 'sun').line?.text, '继续工作');
  const absent = SA.YardChat.createPlayer('global', ['rel']);
  assert.strictEqual(absent.step(10, 'sun').line, null, '无人可说时仍冒出离场人物的气泡');
  return { absentGroupsFiltered: true, remainingSpeakerKept: true };
}

function run() { return { purchase: cockpitPurchaseCheck(), story: pipStoryCheck(), yardChat: yardChatCheck() }; }

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
