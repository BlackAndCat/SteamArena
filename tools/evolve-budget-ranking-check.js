/* 预算评分专项回归：指数罚、参考胜率罚、负分候选及合法预算升级共用真实生成接口。 */
'use strict';
const assert = require('assert');
const evolve = require('./evolve');
const config = require('./evolve-config');

function run() {
  const item = (cost, rate = 0.6, strength = 1700) => ({ strength, performance: 60, previousWinRate: rate,
    efficiency: evolve.efficiencyScore({ value: cost, count: 5 }, { budget: 1000 }) });
  assert.deepStrictEqual(config.ranking, { efficiencyWeight: 0.1, strengthWeight: 0.9 });
  const penalties = [0, 0.2, 0.4, 0.6, 0.8, 1].map(gap => evolve.rankingScore(item(1000 * (1 - gap))).budgetPenalty);
  for (let i = 1; i < penalties.length; i++) {
    assert(penalties[i] > penalties[i - 1], '预算缺口增大却未增加罚分');
    if (i > 1) assert(penalties[i] - penalties[i - 1] > penalties[i - 1] - penalties[i - 2], '预算罚没有指数加速');
  }
  assert.strictEqual(evolve.rankingScore(item(1000, 0.45)).previousWinRatePenalty, 0);
  assert(Math.abs(evolve.rankingScore(item(1000, 0.44)).previousWinRatePenalty - 2) < 1e-10);
  assert.strictEqual(evolve.rankingScore(item(1000, 0)).previousWinRatePenalty, 90);
  for (const rate of [null, undefined, NaN]) assert.strictEqual(evolve.rankingScore(item(1000, rate)).previousWinRatePenalty, 0);
  assert(evolve.compareFitness(item(990, 0.5), item(100, 0.6)) < 0, '目标距离抢在扣后分之前抵消预算罚');
  assert(evolve.fitness(item(100, 0, 300)) < 0, '负综合分被截断');

  const { SA } = evolve.loadGame();
  const modules = ['track', 'helmet', 'boiler_s', 'tank_s', 'mg_s', 'plate', 'bucket', 'tank_tall',
    'cannon_s', 'armor', 'boiler', 'water', 'mg', 'cannon_m', 'mortar_s', 'biped', 'cockpit_pair',
    'mortar', 'cockpit', 'spike', 'quad', 'mg_heavy', 'steamjet', 'radiator'];
  const spec = { chapter: 2, stage: 1, name: '走锭机预算回归', budget: 2375, grid: { cols: 5, rows: 3 },
    mat: 2, allowedMaterials: [1, 2], rewardModule: 'radiator', requiredModules: ['radiator', 'biped'],
    allowedModules: modules, availableMods: modules, populationSize: 8 };
  const seeds = [11, 12, 14, 17, 20, 25], utilization = [];
  for (const seed of seeds) {
    const vehicle = evolve.requiredVehicle(SA, spec, new evolve.RNG(seed));
    assert(vehicle, `旧失败种子 ${seed} 未生成`);
    const original = JSON.stringify(vehicle), upgraded = evolve.approachBudget(SA, vehicle, spec);
    assert.strictEqual(JSON.stringify(vehicle), original, '升级修改原车');
    assert(evolve.legalVehicle(SA, upgraded, spec), '升级违反预算、奖励或解锁');
    const before = SA.V.stats(vehicle).value, after = SA.V.stats(upgraded).value;
    assert(after > before, '新变体没有改善预算使用');
    assert(after <= spec.budget, '预算软目标绕过硬上限');
    utilization.push({ seed, before, after });
  }
  // 低预算有空间的构筑应实际达到软目标；紧网格只要求达到合法可达值。
  const reachableSpec = { ...spec, budget: 1000 };
  const reachable = evolve.approachBudget(SA, evolve.requiredVehicle(SA, reachableSpec, new evolve.RNG(11)), reachableSpec);
  assert(SA.V.stats(reachable).value >= 900 && SA.V.stats(reachable).value <= 1000, '有可行升级却未接近预算');
  const seed = evolve.requiredVehicle(SA, spec, new evolve.RNG(11)), snapshot = JSON.stringify(seed);
  const population = evolve.initialPopulation(SA, spec, [], new evolve.RNG(31), [seed], seed);
  assert(population.includes(seed) && JSON.stringify(seed) === snapshot, '初代种子或手工车被升级');
  assert(population.filter(vehicle => vehicle !== seed).every(vehicle => SA.V.stats(vehicle).value > SA.V.stats(seed).value), '初代新车未接入预算升级');
  const scored = population.map((vehicle, index) => ({ ...item(SA.V.stats(vehicle).value), vehicle, style: 'wander', strength: 1700 - index,
    efficiency: evolve.efficiencyScore(SA.V.stats(vehicle), spec) })).sort(evolve.compareFitness);
  const snapshots = scored.map(row => JSON.stringify(row.vehicle));
  const next = evolve.nextPopulation(SA, spec, scored, [seed], new evolve.RNG(32), { freshRate: 0.5, mutations: 1 }, seed);
  assert(next.population.includes(seed), '下一代没有保留手工车');
  assert(scored.every((row, i) => JSON.stringify(row.vehicle) === snapshots[i]), '下一代修改种子或精英原件');
  assert(next.population.every(vehicle => evolve.legalVehicle(SA, vehicle, spec)), '下一代构筑非法');

  // 最终复测可以改变快速胜率：低于 45% 的罚必须使用复测值，仍保留最好的负分诊断车。
  const make = (name, strength, rate) => ({ ...item(0, rate, strength), vehicle: Object.assign(SA.V.clone(seed), { name }), style: 'wander' });
  const first = make('训练高分复测零胜', 1700, 0.6), second = make('训练低分复测四成', 1300, 0);
  let upgradedCell = false;
  SA.V.each(second.vehicle, cell => { if (!upgradedCell) { cell.lv = 1; upgradedCell = true; } });
  const result = evolve.selectStageCandidate(SA, [first, second], spec, { vehicle: seed }, '预算回归', 19, [], null,
    [{ n: 120, winRate: 0, wins: 0, draws: 0 }, { n: 120, winRate: 0.4, wins: 48, draws: 0 }]);
  assert.strictEqual(result.selected, null, '未达60%-75%仍正式选车');
  assert.strictEqual(result.fallback.vehicle.name, second.vehicle.name, '复测罚分未决定最好的诊断候选');
  assert(evolve.fitness(result.fallback) < 0 && result.candidateCount === 2, '负分候选被全过滤');
  first.stats = SA.V.stats(first.vehicle); second.stats = SA.V.stats(second.vehicle);
  const generated = { scored: [first, second], selection: result, archive: { buckets: {}, toxic: [], odd: [] } };
  const report = evolve.completedStage(SA, spec, generated, null, [], '预算回归', 19);
  const actualReference = generated.scored[report.selection.provisionalIndex];
  assert.strictEqual(JSON.stringify(SA.StageCars.cellsOf(actualReference.vehicle)), JSON.stringify(report.provisional.cells),
    '复测重排后报告诊断车与实际下一关参考编码不一致');
  assert.strictEqual(report.top[0].ranking.total, evolve.fitness(actualReference), '最终报告仍使用快速胜率评分');
  // 正式达标分支也必须同步评分数组索引，不能只修未达标诊断车。
  const qualified = evolve.selectStageCandidate(SA, [first, second], spec, { vehicle: seed }, '预算回归', 20, [], null,
    [{ n: 120, winRate: 0.65, wins: 78, draws: 0 }, { n: 120, winRate: 0.65, wins: 78, draws: 0 }]);
  assert(qualified.selected, '目标区间内候选没有正式入选');
  const qualifiedGeneration = { scored: [second, first], selection: qualified, archive: { buckets: {}, toxic: [], odd: [] } };
  const qualifiedReport = evolve.completedStage(SA, spec, qualifiedGeneration, null, [], '预算回归', 20);
  assert.strictEqual(JSON.stringify(SA.StageCars.cellsOf(qualifiedGeneration.scored[qualifiedReport.selection.selectedIndex].vehicle)),
    JSON.stringify(qualifiedReport.selected.cells), '复测重排后报告入选车与实际下一关参考编码不一致');
  return { exponentialPenalty: true, previousWinRateBoundary: true, negativeCandidatesRetained: true, utilization,
    originalsPreserved: true, finalValidationRanking: true };
}
if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
