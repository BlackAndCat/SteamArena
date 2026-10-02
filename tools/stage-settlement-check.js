'use strict';

// 关卡经济回归：从正式出战入口取得战斗结果，使用真实结算和战后修理按钮。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

function runtime() {
  const { SA, context } = loadGame();
  let battleApi, result;
  SA.BattleView = { create(api) {
    battleApi = api;
    return { start: opts => api.startState(opts), gameSpeed: () => 1, teardown() {}, emit() {}, presentResult(value) { result = value; } };
  } };
  SA.go = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);

  // 仅替换 DOM 容器和绘图；按钮事件、结算、付款与修复都执行正式代码。
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.events = {}; this.style = {}; this.classList = { add() {}, remove() {} }; }
    append(...children) { this.children.push(...children); }
    addEventListener(type, fn) { this.events[type] = fn; }
    setAttribute() {}
    focus() {}
    remove() {}
    set innerHTML(value) { this.children = []; }
    get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent || '').join(''); }
    set textContent(value) { this.children = [String(value)]; }
  }
  const modal = new Element(), toast = new Element();
  context.Node = Element;
  context.document.createElement = tag => new Element(tag);
  context.document.createTextNode = text => String(text);
  context.document.querySelector = selector => selector === '#modal' ? modal : selector === '#toast' ? toast : new Element();
  context.document.body = new Element('body');
  SA.SPR.moduleCanvas = () => new Element('canvas');
  SA.PX = { init() {}, gear: () => new Element(), RAMP: { brass: [] }, ui: {
    btn: () => new Element('button'), counter: () => new Element(), plate: () => new Element(), tag: () => new Element(),
    num: () => new Element(), img: () => new Element(),
  } };
  SA.nav = () => {};
  SA.Story = null; SA.StoryDev = null;
  SA.Camp.unlockDialog = (_unlock, next) => next();
  SA.Camp.salvageDialog = (_survivors, next) => next();
  SA.Camp.introIfNew = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8'), context);

  function play(entry, outcome) {
    result = null;
    entry.start();
    const battle = SA.Battle.debug.B;
    SA.V.each(battle.p.v, cell => { cell.hp = Math.max(1, cell.hp - 2); });
    if (outcome === 'draw') { battle.draw = '测试平手'; battle.ending = SA.K.BATTLE.ENDING_TIME; }
    else if (outcome === 'retreat') battleApi.retreat();
    else battleApi.kill(outcome === 'win' ? battle.e : battle.p, '测试判负');
    for (let i = 0; i < 600 && !battle.done; i++) battleApi.step(1 / 60);
    assert(result, '战斗没有产生结果');
    return result;
  }
  function button(label) {
    const visit = item => item instanceof Element && (item.tag === 'button' && item.textContent.includes(label) ? item : item.children.map(visit).find(Boolean));
    return visit(modal);
  }
  return { SA, play, modal, toast, button };
}

function run() {
  const { SA, play, modal, toast, button } = runtime();
  for (let index = 0; index < 3; index++) {
    const stage = SA.Camp.stage(0, index);
    assert.strictEqual(stage.rewardMoney, false, `序章 ${index + 1} 关发金币`);
    assert.strictEqual(stage.victoryRepairFree, true, `序章 ${index + 1} 关收费修理`);
    assert.strictEqual(stage.repairFree, true, `序章 ${index + 1} 关未开启全结果免修`);
  }
  // 从正式关卡入口覆盖胜、负、平、撤退；旧伤也修满，蓝图库中的另一辆车保持原样。
  for (let index = 0; index < 3; index++) for (const outcome of ['win', 'loss', 'draw', 'retreat']) {
    SA.S.reset();
    SA.S.d.camp.st = index;
    let oldDamage = false;
    SA.V.each(SA.S.d.vehicle, cell => { if (!oldDamage) { cell.hp -= 5; oldDamage = true; } });
    assert(oldDamage, '参赛车没有可制造旧伤的部件');
    SA.S.Blueprints.save('另一辆车');
    const parked = JSON.stringify(SA.S.Blueprints.mine()), moneyBefore = SA.S.d.money;
    const active = SA.S.arenaEntries('camp').find(row => row.key === `0,${index}`);
    assert(active, `缺少序章 ${index + 1} 关出战入口`);
    const battleResult = play(active, outcome);
    assert.strictEqual(battleResult.opts.repairFree, true, `${index}:${outcome} 未传全结果免修配置`);
    SA.UI.afterBattle(battleResult);
    SA.V.each(SA.S.d.vehicle, cell => assert.strictEqual(cell.hp, SA.V.maxHp(cell), `${index}:${outcome} 留下修理账单`));
    assert.strictEqual(SA.S.d.money, moneyBefore, `${index}:${outcome} 扣除了金币`);
    assert.strictEqual(JSON.stringify(SA.S.Blueprints.mine()), parked, `${index}:${outcome} 误修另一辆车`);
    assert(modal.textContent.includes('本场参赛车已免费修复'), `${index}:${outcome} 未显示已免修`);
    assert(!button('全部修理 £') && !button('免费全部修理'), `${index}:${outcome} 仍显示战后修理按钮`);
  }
  SA.S.reset();
  SA.S.d.camp.st = 1;
  SA.V.each(SA.S.d.vehicle, cell => { cell.hp = Math.max(1, cell.hp - 7); });
  const replayMoney = SA.S.d.money;
  const replayEntry = SA.S.arenaEntries('camp').find(row => row.key === '0,0' && row.replay);
  assert(replayEntry, '缺少首关重打入口');
  const freeReplay = play(replayEntry, 'win');
  SA.UI.afterBattle(freeReplay);
  SA.V.each(SA.S.d.vehicle, cell => assert.strictEqual(cell.hp, SA.V.maxHp(cell), '免费关重打未修复旧伤'));
  assert.strictEqual(SA.S.d.money, replayMoney, '免费关重打扣款');
  assert(modal.textContent.includes('本场参赛车已免费修复') && !button('全部修理 £'), '免费关重打界面未显示免修');
  // 正式记录必须包含结算字段；显式修改时以该记录为准。
  const record = SA.StageCars.get(0, 0);
  assert(record, '缺少序章第一关的手工记录');
  // 正式关卡记录必须完整保存结算字段；测试显式编辑后恢复原配置。
  assert.strictEqual(typeof record.rewardMoney, 'boolean');
  assert.strictEqual(typeof record.victoryRepairFree, 'boolean');
  const savedRewardMoney = record.rewardMoney, savedRepairFree = record.victoryRepairFree;
  record.repairFree = false; // 以下继续覆盖普通关现有胜利免修与付款按钮，不改正式配置文件。
  record.rewardMoney = true; record.victoryRepairFree = false;
  assert.strictEqual(SA.Camp.stage(0, 0).rewardMoney, true, '手工记录未开启金币');
  assert.strictEqual(SA.Camp.stage(0, 0).victoryRepairFree, false, '手工记录未关闭免费修理');
  record.rewardMoney = savedRewardMoney; record.victoryRepairFree = savedRepairFree;
  assert.strictEqual(SA.Camp.stage(0, 0).rewardMoney, savedRewardMoney, '正式金币设置未恢复');
  assert.strictEqual(SA.Camp.stage(0, 0).victoryRepairFree, savedRepairFree, '正式修理设置未恢复');
  for (const key of SA.StageCars.targetKeys()) {
    const [ci, si] = key.split(':').map(Number), settled = SA.Camp.stage(ci, si);
    assert.strictEqual(typeof settled.rewardMoney, 'boolean', `${key} 缺少金币规则`);
    assert.strictEqual(typeof settled.victoryRepairFree, 'boolean', `${key} 缺少修理规则`);
  }
  assert.strictEqual(SA.Camp.stage(1, 0).rewardMoney, true, '普通关应发金币');
  assert.strictEqual(SA.Camp.stage(1, 0).victoryRepairFree, false, '普通关应收费修理');

  SA.S.reset();
  let entry = SA.S.arenaEntries('camp').find(row => row.next);
  assert.strictEqual(entry.prize, 0, '出战海报仍显示序章奖金');
  let money = SA.S.d.money;
  let result = play(entry, 'draw');
  const draw = SA.S.settleBattle(result);
  assert.strictEqual(SA.S.d.money, money, '关闭金币时平局仍获得出场费');
  assert(!draw.lines.some(line => line.includes('出场费')), '平局文案仍显示出场费');

  SA.S.reset();
  entry = SA.S.arenaEntries('camp').find(row => row.next);
  money = SA.S.d.money;
  result = play(entry, 'win');
  SA.UI.afterBattle(result);
  assert.strictEqual(SA.S.d.money, money, '序章胜利仍获得奖金');
  assert(button('免费全部修理'), '免费修理按钮未显示');
  assert(modal.textContent.includes('免费修理') && modal.textContent.includes('修理 免费'), '免费修理明细或净收支未显示');
  button('免费全部修理').events.click();
  assert.strictEqual(SA.S.d.money, money, '免费修理扣除了金币');
  assert(toast.textContent.includes('免费修好'), '修理提示没有显示免费');
  SA.V.each(SA.S.d.vehicle, cell => assert.strictEqual(cell.hp, SA.V.maxHp(cell), '免费修理未修复损伤'));

  // 显式开启金币、关闭免费修理，复用原序章奖金和原付款流程。
  SA.S.reset();
  entry = SA.S.arenaEntries('camp').find(row => row.next);
  assert.strictEqual(entry.prize, 0);
  // 出战列表创建后再改工作台记录，开战必须读取最新设置并固定到战斗结果。
  record.rewardMoney = true; record.victoryRepairFree = false;
  const originalPrize = SA.Camp.stage(0, 0).prize;
  money = SA.S.d.money;
  result = play(entry, 'win');
  assert.strictEqual(result.opts.rewardMoney, true);
  assert.strictEqual(result.opts.victoryRepairFree, false);
  assert.strictEqual(result.prize, originalPrize);
  SA.UI.afterBattle(result);
  assert.strictEqual(SA.S.d.money, money + originalPrize, '开启金币后未发原奖金');
  let paidCost = 0;
  SA.V.each(SA.S.d.vehicle, cell => { if (cell.hp < SA.V.maxHp(cell)) paidCost += SA.S.repairCost(cell); });
  assert(paidCost > 0 && button('全部修理 £'), '收费修理入口未显示');
  button('全部修理 £').events.click();
  assert.strictEqual(SA.S.d.money, money + originalPrize - paidCost, '收费修理扣款不符');
  SA.V.each(SA.S.d.vehicle, cell => assert.strictEqual(cell.hp, SA.V.maxHp(cell), '收费修理未修复损伤'));

  // 败北不享受免费修理；重打不结算奖金或战损。
  SA.S.reset();
  record.rewardMoney = savedRewardMoney; record.victoryRepairFree = savedRepairFree;
  result = play(SA.S.arenaEntries('camp').find(row => row.next), 'loss');
  SA.UI.afterBattle(result);
  assert(!button('免费全部修理'), '败北误用免费修理');
  SA.S.reset(); SA.Camp.win();
  money = SA.S.d.money;
  result = play(SA.S.arenaEntries('camp').find(row => row.replay), 'win');
  SA.UI.afterBattle(result);
  assert.strictEqual(SA.S.d.money, money, '重打发放了奖金');
  assert(!button('全部修理'), '重打留下战损');
  record.repairFree = true;
  return { prologue: 3, fullRepairOutcomes: 12, freeReplay: true, draw: true, freeRepair: true, paidRepair: true, loss: true, replay: true };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
