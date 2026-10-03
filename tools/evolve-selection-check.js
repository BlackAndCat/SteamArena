/* 选关标尺回归：用可控胜负隔离筛选算法，防止把当前章与上一章 Boss 混用。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');

function run() {
  // 第一章第 3 关已开放 2×2 重装甲，水箱可合法替换，保证对照分支实际跑到（关卡布局 4 只到这一关）。
  const { SA } = evolve.loadGame(), spec = evolve.stageSpec(SA, 1, 2);
  const base = evolve.minimalVehicle(SA, spec, 'water');
  assert(base, '无法构造奖励车夹具');
  // 对照会拆掉奖励水箱，显式保留一只小水罐维持冷却；不能依赖生成器错误地重复添加水箱。
  let placed = false;
  for (let r = 0; r < SA.V.CH && !placed; r++) for (let c = 0; c < SA.K.COLS && !placed; c++) {
    const fit = SA.V.canPut(base, 'tank_s', r, c);
    if (fit.ok && fit.fit) { base.body[r][c] = SA.newCell('tank_s', spec.mat); placed = true; }
  }
  assert(placed && evolve.legalVehicle(SA, base, spec), '缺少可合法替换水箱的独立冷却');
  const make = (name, power) => ({ vehicle: { ...SA.V.clone(base), name, power }, style: 'wander', performance: 60, strength: 1000, terrainDelta: 0 });
  const previous = make('上一章 Boss', 2), current = make('本章 Boss', 4), weak = make('弱候选', 1), strong = make('强候选', 3);
  const calls = [];
  // 两个方向都由车辆的确定强弱决定胜负；保留真实 duel 的种子与胜率聚合，
  // 并记录每次对局对象，检查奖励生效和同尺寸对照也引用上一章 Boss。
  SA.Battle.simulate = options => {
    calls.push(options);
    const winner = options.p.power > options.e.power ? 'p' : 'e';
    return { winner, t: 30, reason: '驾驶舱', pDealt: 10, eDealt: 10, events: { p: {}, e: {} },
      effectStats: { p: { water: { active: 4 } }, e: { water: { active: 4 } } }, metrics: {} };
  };
  const bossSpec = { ...spec, boss: true, terrain: 'flat', rewardModule: null };
  const boss = evolve.selectStageCandidate(SA, [weak, strong], bossSpec, previous, 'check', 10);
  assert.strictEqual(boss.selected.vehicle.name, strong.vehicle.name, 'Boss 门槛仍在奖励打不过上一章 Boss 的弱车');
  assert.strictEqual(boss.evidence.previousBossWinRate, 0, 'previousBossWinRate 必须表示上一章 Boss 的胜率');
  assert.strictEqual(boss.evidence.previousBossPass, true);
  const weakBoss = evolve.selectStageCandidate(SA, [weak], bossSpec, previous, 'check', 10);
  assert.strictEqual(weakBoss.evidence.previousBossPass, false, '会被上一章 Boss 击败的候选不能通过门槛');
  calls.length = 0;
  const rewardSpec = { ...spec, boss: false, chapterHasBoss: true, terrain: 'flat', rewardModule: 'water' };
  const reward = evolve.selectStageCandidate(SA, [strong], rewardSpec, current, 'check', 20, new Set(), null, previous);
  assert.strictEqual(reward.evidence.bossWinRate, 1, '普通关的强度仍须以本章 Boss 衡量');
  assert.strictEqual(reward.evidence.rewardWinRateAgainstPreviousBoss, 1, '奖励车强度下限误用了本章 Boss');
  assert.strictEqual(reward.evidence.previousBossWinRate, 0, '防碾压门槛误用了本章 Boss');
  assert.strictEqual(reward.evidence.rewardLowerBoundPass, true);
  assert.strictEqual(reward.evidence.rewardCrushGuardPass, false, '对上一章 Boss 全胜的奖励车必须暴露碾压风险');
  assert.strictEqual(reward.evidence.rewardEffectPass, true, '奖励生效证据没有被执行');
  assert.notStrictEqual(reward.evidence.rewardControl, null, '夹具必须实际执行同尺寸替换对照');
  assert(calls.slice(4).every(o => o.p.name === previous.vehicle.name || o.e.name === previous.vehicle.name), '奖励生效或替换对照误用了本章 Boss');
  return { bossDirection: true, weakBossRejected: true, chapterTarget: true, previousBossReward: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
