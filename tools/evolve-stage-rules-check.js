/* 逐关构筑回归：真实规则校验预算、模块、近战最小车及节约评分，拒绝旧候选绕过筛选。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const rules = require('./evolve-stage-rules.json');

function run() {
  const { SA } = evolve.loadGame();
  // 每个做出来的关一行预算（占位的空关不算）
  assert.strictEqual(rules.length, SA.CAMPAIGN.reduce((n, ch) => n + ch.stages.filter(st => !st.unfinished).length, 0));
  const keys = new Set();
  // 全战役序号按每章计划关数排；中间空着的关也算步数，后台可以跳过去先做后面的关
  const planned = ch => Math.max(ch.stages.length, ch.plannedStages || 0);
  const ordinal = row => SA.CAMPAIGN.slice(0, row.chapter).reduce((n, ch) => n + planned(ch), 0) + row.stage;
  rules.forEach((row, i) => {
    const key = `${row.chapter}:${row.stage}`;
    assert(!keys.has(key), `规则重复：${key}`); keys.add(key);
    // 手工关卡可以另起车名，不能让用户保存的名称使规则表检查误报。
    if (!SA.StageCars.get(row.chapter, row.stage)) assert.strictEqual(row.name, SA.CAMPAIGN[row.chapter].stages[row.stage].name);
    assert(row.budget > 0 && Number.isFinite(row.budget));
    if (i) {
      const steps = ordinal(row) - ordinal(rules[i - 1]);
      assert(steps >= 1, `${key} 规则行没有按战役顺序排列`);
      const growth = (row.budget / rules[i - 1].budget) ** (1 / steps) - 1;
      assert(growth >= 0.15 - 2e-3 && growth <= 0.30 + 2e-3, `${key} 预算每关增幅超出 15%～30%`);
    }
    assert.strictEqual(row.status, i < 3 ? 'preview' : 'draft');
    for (const id of [...row.addMods, ...(row.stageMods || [])]) assert(SA.MODULES[id] && !SA.MODULES[id].retired, `未知模块 ${id}`);
    const spec = evolve.stageSpec(SA, row.chapter, row.stage);
    assert(!spec.rewardModule || spec.availableMods.includes(spec.rewardModule), `${key} 奖励未列入模块表`);
  });
  assert.throws(() => evolve.run({ chapters: 2 }), /仍待审阅/, '审阅稿被直接整批生成');
  const first = evolve.stageSpec(SA, 0, 0), second = evolve.stageSpec(SA, 0, 1), third = evolve.stageSpec(SA, 0, 2);
  assert.strictEqual(first.budget, 360); assert.strictEqual(second.budget, 420); assert.strictEqual(third.budget, 485);
  assert.deepStrictEqual(first.availableMods, ['track', 'helmet', 'boiler_s', 'tank_s', 'mg_s']);
  assert.deepStrictEqual(second.availableMods, [...first.availableMods, 'plate']);
  assert.deepStrictEqual(third.availableMods, [...second.availableMods, 'bucket']);
  // 旧原车 / 开局库存中添加高级件也不能污染候选模块池。
  SA.CAMP_START.mods.push('cannon_giant'); SA.CAMPAIGN[0].stages[0].subs = [[0, 0, 'cannon_giant']];
  assert.deepStrictEqual(evolve.stageSpec(SA, 0, 0).availableMods, first.availableMods);
  const gun = evolve.minimalVehicle(SA, first, 'tank_s'), ram = evolve.minimalVehicle(SA, third, 'bucket');
  assert(gun && ram, '序章最小构筑不存在');
  const gs = SA.V.stats(gun), rs = SA.V.stats(ram);
  assert.strictEqual(gs.value, 360); assert.strictEqual(gs.count, 5);
  assert.strictEqual(rs.value, 402); assert.strictEqual(rs.count, 4);
  const bare = evolve.minimalVehicle(SA, first), bs = SA.V.stats(bare);
  assert.strictEqual(bs.value, 340); assert.strictEqual(bs.count, 4);
  assert.strictEqual(bs.tanks, 0); assert.strictEqual(bs.cool, 0);
  assert(evolve.legalVehicle(SA, bare, first), '无水箱 / 冷却的四件基础车仍被拒绝');
  for (const id of ['track', 'helmet', 'boiler_s', 'mg_s']) {
    const incomplete = SA.V.clone(bare);
    SA.V.each(incomplete, (cell, r, c, layer) => { if (cell.id === id) incomplete[layer][r][c] = null; });
    assert(!evolve.legalVehicle(SA, incomplete, first), `缺少 ${id} 仍被认作完整基础车`);
  }
  assert(gs.supply >= gs.demand && rs.supply >= rs.demand, '最小车动力不足');
  assert.strictEqual(gs.byId.tank_s, 1, '强制奖励又多买了一份冷却');
  assert(rs.rams && !rs.weapons, '铲斗车被迫额外购买远程武器');
  assert.strictEqual(evolve.minimalVehicle(SA, first, 'mg'), null);
  assert.strictEqual(evolve.randomVehicle(SA, first, new evolve.RNG(1), 'cannon_m'), null);
  // 多种随机布局与全部变异操作都必须留在硬上限内；标尺车受相同限制。
  let checked = 0;
  for (const spec of [first, second, third]) {
    for (let seed = 1; seed <= 60; seed++) {
      const v = evolve.randomVehicle(SA, spec, new evolve.RNG(seed), seed % 2 ? spec.rewardModule : null);
      assert(v && evolve.legalVehicle(SA, v, spec), `种子 ${seed} 生成非法车`); checked++;
      const child = evolve.mutate(SA, v, spec, new evolve.RNG(seed + 100));
      if (child) { assert(evolve.legalVehicle(SA, child, spec)); checked++; }
    }
    for (const v of evolve.campaignOpponents(SA, spec.chapter, spec.stage)) assert(evolve.legalVehicle(SA, v, spec));
  }
  const upgraded = SA.V.clone(gun);
  SA.V.each(upgraded, cell => { if (cell.id === 'mg_s') cell.lv = 1; });
  assert(!evolve.constructionConditions(SA, upgraded, first).budget, '改装价格漏计');
  const forbidden = SA.V.clone(gun);
  SA.V.each(forbidden, cell => { if (cell.id === 'mg_s') cell.id = 'periscope'; });
  assert(!evolve.constructionConditions(SA, forbidden, first).modulePool, '最终过滤漏掉越级件');
  const item = (v, strength = 1000) => ({ vehicle: v, stats: SA.V.stats(v), strength, performance: 60, style: 'wander', terrainDelta: 0, efficiency: evolve.efficiencyScore(SA.V.stats(v), second) });
  const invalid = [item(upgraded, 1e9), item(forbidden, 1e9)];
  assert.strictEqual(evolve.selectStageCandidate(SA, invalid, first, null, 'check', 1).selected, null, '空合法池错误地回退到非法第一名');
  assert.strictEqual(evolve.selectStageCandidate(SA, [...invalid, item(gun)], first, null, 'check', 1).selected.vehicle, gun);
  // 同样的战斗成绩：单独提高价格或增加件数均降低分数；更优的真实构筑在选关、留种和存档都获益。
  const score = stats => evolve.efficiencyScore(stats, second).total;
  assert(score(gs) > score({ ...gs, value: gs.value + 20 }));
  assert(score(gs) > score({ ...gs, count: gs.count + 1 }));
  const costly = SA.V.clone(gun);
  SA.V.each(costly, cell => { if (cell.id === 'mg_s') cell.lv = 1; });
  assert(evolve.legalVehicle(SA, costly, second));
  const cheapItem = item(gun), costlyItem = item(costly), noReward = { ...second, rewardModule: null };
  assert(evolve.fitness(cheapItem) > evolve.fitness(costlyItem));
  assert.strictEqual(evolve.selectStageCandidate(SA, [costlyItem, cheapItem], noReward, null, 'check', 1).selected, cheapItem);
  evolve.archive([costlyItem, cheapItem], noReward);
  assert(cheapItem.composite > costlyItem.composite);
  // 两项先统一尺度：同为满分时分别贡献 60 / 40，不能把千分强度直接压在节约分上。
  assert.strictEqual(evolve.fitness({ strength: 300, efficiency: { total: 20 } }), 60);
  assert.strictEqual(evolve.fitness({ strength: 1700, efficiency: { total: 0 } }), 40);
  const weakerCheap = item(bare, 950), strongerCostly = item(costly, 1050);
  assert(evolve.fitness(weakerCheap) > evolve.fitness(strongerCostly), '节约权重不足以抵消小幅强度差');
  assert.strictEqual(evolve.selectStageCandidate(SA, [strongerCostly, weakerCheap], noReward, null, 'check', 1).selected, weakerCheap);
  evolve.archive([strongerCostly, weakerCheap], noReward);
  assert(weakerCheap.composite > strongerCostly.composite, '分类存档没有沿用 6:4 权重');
  // 铲斗是必需奖励，哪怕带铲斗的候选胜率和表现更低，也不能回退到枪车。
  const weakBucket = { ...item(ram, 300), performance: 10 }, strongGun = item(bare, 1700);
  assert.strictEqual(evolve.selectStageCandidate(SA, [strongGun, weakBucket], third, null, 'check', 1).selected, weakBucket);
  assert.strictEqual(evolve.selectStageCandidate(SA, [strongGun], third, null, 'check', 1).selected, null, '奖励候选为空仍选择无铲斗车');
  // 把同一批结果拆成不同标尺分组不应改变强度；小样本全胜不能压过大样本打平。
  const split = evolve.strengthFromRows([{ n: 40, winRate: 1 }, { n: 40, winRate: 0.5 }]);
  const pooled = evolve.strengthFromRows([{ n: 80, winRate: 0.75 }]);
  assert.deepStrictEqual(split, pooled, '强度依赖对局分组方式');
  assert(split.strength > 1100 && split.strength < 1300, '75% 胜率错误地撞到 1700 上限');
  const uneven = evolve.strengthFromRows([{ n: 2, winRate: 1 }, { n: 200, winRate: 0.5 }]);
  assert(uneven.strength < 1010, '没有按真实样本量计算强度');
  return { stages: rules.length, generatedScope: 3, first: { value: bs.value, count: bs.count }, firstWithReward: { value: gs.value, count: gs.count }, bucket: { value: rs.value, count: rs.count }, checked, constraints: true, savingsRank: '6:4', rewardRequired: true, draftGuard: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
