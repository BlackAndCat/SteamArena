/*
 * 战役重打回归：从真实关卡入口启动，经过战斗结束回调，再走存档结算。
 * 只替换画面接口；重打标记、战斗结果和进度更新都使用生产代码，避免手造结果掩盖接口漏字段。
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 捕获正式战斗结果；胜负由现有战斗接口触发，不直接调用战役通关作为结算。 */
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
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8'), context);
  SA.go = () => {};
  function play(entry, outcome) {
    result = null;
    entry.start();
    const B = SA.Battle.debug.B;
    // 每局都留下真实战斗副本损伤，确保重打结算没有把战损写回存档。
    SA.V.each(B.p.v, cell => { cell.hp = Math.max(1, cell.hp - 1); });
    if (outcome === 'draw') { B.draw = '回归夹具平手'; B.ending = SA.K.BATTLE.ENDING_TIME; }
    else api.kill(outcome === 'win' ? B.e : B.p, '回归夹具判负');
    for (let i = 0; i < 600 && !B.done; i++) api.step(1 / 60);
    assert(result, '战斗结束未生成正式结算结果');
    return { result, settlement: SA.S.settleBattle(result) };
  }
  return { SA, play };
}

/** 重打只允许更新新闻；所有进度、经济、库存、战损与统计均须保持原样。 */
function snapshot(SA) {
  const saved = JSON.parse(JSON.stringify(SA.S.d));
  delete saved.news;
  return saved;
}

function run() {
  const { SA, play } = runtime();
  const total = SA.CAMPAIGN.reduce((n, chapter) => n + chapter.stages.length, 0);
  let replayCases = 0;
  for (const scenario of [
    { name: '刚通过第一关', completed: 1 },
    { name: '已进入后续章节', completed: 7 },
    { name: '全部通关', completed: total },
    { name: '支线已完成', completed: SA.CAMPAIGN[0].stages.length, side: true },
  ]) {
    SA.S.reset();
    for (let i = 0; i < scenario.completed; i++) SA.Camp.win();
    if (scenario.side) SA.Camp.sideWin(SA.Camp.sideEntries()[0].id);
    // 未还贷款和已下注也不能被重打计息、兑现或清空。
    SA.S.d.debt = 100;
    SA.S.d.bet = { amount: 10, odds: 2 };
    const before = snapshot(SA);
    for (const outcome of ['win', 'loss', 'draw']) for (let repeat = 0; repeat < 3; repeat++) {
      const mode = scenario.side ? 'side' : 'camp';
      const entry = SA.S.arenaEntries(mode)[0];
      assert(entry.replay && !entry.lock, `${scenario.name} 没有生成可重打入口`);
      const { result, settlement } = play(entry, outcome);
      const after = snapshot(SA), label = `${scenario.name}重打 ${outcome} 第 ${repeat + 1} 次`;
      assert.deepStrictEqual(after.camp, before.camp, `${label} 改变了进度或解锁`);
      assert.deepStrictEqual(after, before, `${label} 改变了经济、库存、战损或统计`);
      assert.strictEqual(result.replay, true, `${label} 的战斗结果丢失重打标记`);
      assert.strictEqual(settlement.pre.length, 0, `${label} 发放了缴获或解锁`);
      replayCases++;
    }
  }

  // 未完成关卡仍按正常战役结算：失败 / 平手不推进，首次胜利逐关解锁并能跨章。
  for (const outcome of ['loss', 'draw']) {
    SA.S.reset();
    const before = snapshot(SA).camp;
    play(SA.S.arenaEntries('camp')[0], outcome);
    assert.deepStrictEqual(snapshot(SA).camp, before, `首次挑战 ${outcome} 推进了战役`);
  }
  SA.S.reset();
  for (let i = 0; i < SA.CAMPAIGN[0].stages.length; i++) {
    const entry = SA.S.arenaEntries('camp').find(row => row.next);
    const before = snapshot(SA);
    const { result, settlement } = play(entry, 'win');
    assert.strictEqual(result.replay, false, '首次挑战被标为重打');
    assert.strictEqual(SA.S.d.money, before.money + entry.prize, '首次通关没有发放正常奖金');
    assert.strictEqual(SA.S.d.wins, before.wins + 1, '首次通关没有记录胜利');
    assert(settlement.pre.some(item => item.kind === 'unlock'), '首次通关没有发放解锁');
    assert(SA.S.arenaEntries('camp')[i].replay, '刚通关的关卡没有变成可重打');
  }
  assert.strictEqual(SA.S.d.camp.ch, 1, '序章通关后没有进入下一章');
  assert.strictEqual(SA.S.d.camp.st, 0, '序章通关后跳过了下一章第一关');
  assert(SA.Camp.has('shop') && SA.Camp.hasMod('mg_s'), '序章通关没有解锁商店与新模块');
  const side = SA.S.arenaEntries('side')[0], beforeSide = snapshot(SA).camp;
  const { result, settlement } = play(side, 'win');
  assert.strictEqual(result.replay, false, '首次支线挑战被标为重打');
  assert(SA.S.d.camp.sideWins[side.key], '首次支线胜利没有记录完成');
  assert.strictEqual(SA.S.d.camp.ch, beforeSide.ch, '支线胜利改变了主线章节');
  assert.strictEqual(SA.S.d.camp.st, beforeSide.st, '支线胜利改变了主线关卡');
  assert(settlement.pre.some(item => item.kind === 'salvage'), '首次支线胜利没有发放缴获');
  return { replayCases, firstWins: SA.CAMPAIGN[0].stages.length, lossAndDraw: 2, sideFirstWin: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
