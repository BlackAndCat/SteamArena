/*
 * 双足路线的真实战斗诊断：固定构筑种子、战斗种子和换边顺序。
 * 后续章节尚未配置正式生成规格，故使用明示材料上限的诊断夹具；
 * 共同预算是上限，不保证随机候选花费相等，也不把结果当作总体平衡结论。
 * 用法：node tools/biped-benchmark.js --source <快照目录> --out <JSON路径>
 * 重测相同构筑：增加 --fixtures <基线JSON>；--pairs 默认每组8对。
 * --fund 尝试现有预算填充器；预算利用率不足与实际价差仍如实记录。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** 仅在独立 VM 的模拟循环插入观测，不修改磁盘源码或消费随机数。 */
function loadObservedGame(evolve, source) {
  const filename = path.join(source, 'js/battle.js');
  const original = fs.readFileSync(filename, 'utf8');
  const anchor = 'while (!B.done && B.t < K.BATTLE_TIME + 10) step(dt);';
  if (!original.includes(anchor)) throw new Error('模拟循环已变化，请更新只读观测锚点');
  const observed = original.replace(anchor, `
      const measured = { seconds: 0, p: { distance: 0, speedIntegral: 0 }, e: { distance: 0, speedIntegral: 0 } };
      while (!B.done && B.t < K.BATTLE_TIME + 10) {
        const px = B.p.x, ex = B.e.x;
        step(dt);
        measured.seconds += dt;
        measured.p.distance += Math.abs(B.p.x - px);
        measured.e.distance += Math.abs(B.e.x - ex);
        measured.p.speedIntegral += Math.abs(B.p.vx) * dt;
        measured.e.speedIntegral += Math.abs(B.e.vx) * dt;
      }
      if (B.result) B.result.telemetry = measured;
  `);
  const read = fs.readFileSync;
  try {
    fs.readFileSync = function (file, ...args) {
      return path.resolve(String(file)) === path.resolve(filename) ? observed : read.call(fs, file, ...args);
    };
    return { ...evolve.loadGame(), battleHash: crypto.createHash('sha256').update(original).digest('hex') };
  } finally { fs.readFileSync = read; }
}

/** 每章末预算来自现有逐关表；模块池按材料过滤，章节解锁未完成时不能冒称正式配置。 */
function diagnosticSpec(SA, rules, chapter) {
  const rows = rules.filter(row => row.chapter === chapter);
  const mat = chapter + 1;
  const mods = Object.keys(SA.MODULES).filter(id => !SA.MODULES[id].retired && SA.minMt(id) <= mat);
  return { chapter, stage: rows[rows.length - 1].stage, budget: rows[rows.length - 1].budget,
    mat, allowedMaterials: Array.from({ length: mat }, (_, i) => i + 1),
    grid: SA.V.fullGrid(), availableMods: mods, allowedModules: mods, requiredModules: [], terrain: 'flat' };
}

/** 有限次数抽样；只接受正式构筑校验通过且只含指定底盘的载具。 */
function candidate(SA, evolve, spec, chassis, seed, fund) {
  const rng = new evolve.RNG(seed);
  const filtered = { ...spec, availableMods: spec.availableMods.filter(id => SA.MODULES[id].layer !== 'chassis' || id === chassis) };
  let best = null, value = -1;
  for (let i = 0; i < 12; i++) {
    const v = evolve.randomVehicle(SA, filtered, rng, chassis);
    if (!v || !evolve.legalVehicle(SA, v, filtered)) continue;
    const stats = SA.V.stats(v, { deferHeat: true });
    if (stats.value > value) { best = v; value = stats.value; }
  }
  if (!best) best = evolve.minimalVehicle(SA, filtered, chassis);
  if (best && fund) best = evolve.approachBudget(SA, best, filtered, rng);
  if (!best || !evolve.legalVehicle(SA, best, filtered)) throw new Error(`章节${spec.chapter} ${chassis} 没有合法候选`);
  return best;
}

/** 时间加权平均真实速度，并保留命中事件口径；穿透等可使事件率超过单弹概率。 */
function aggregate(rows, chassis) {
  let wins = 0, draws = 0, seconds = 0, distance = 0, speed = 0, received = 0, enemyShots = 0;
  for (const row of rows) {
    const side = row.pChassis === chassis ? 'p' : 'e', enemy = side === 'p' ? 'e' : 'p';
    wins += row.result.winner === (side === 'p' ? 'p' : 'e') ? 1 : 0;
    draws += row.result.winner === 'draw' ? 1 : 0;
    const t = row.result.telemetry;
    if (!t || !Number.isFinite(t[side].distance)) throw new Error('观测数据缺失或非有限数');
    seconds += t.seconds; distance += t[side].distance; speed += t[side].speedIntegral;
    received += row.result.events[enemy].hit; enemyShots += row.result.events[enemy].fire;
  }
  return { games: rows.length, wins, draws, winRate: (wins + draws / 2) / rows.length,
    seconds, meanRealSpeed: speed / seconds, meanPositionSpeed: distance / seconds,
    receivedHitEvents: received, enemyShotEvents: enemyShots, receivedHitEventRate: enemyShots ? received / enemyShots : null };
}

/** 所有原始战斗与构筑一起落盘，后续阶段可复用原构筑避免抽样漂移。 */
function run({ source = path.resolve(__dirname, '..'), pairs = 8, seed = 20261005, fixtures = null, fund = false } = {}) {
  const evolve = require(path.join(source, 'tools/evolve.js'));
  const { SA, battleHash } = loadObservedGame(evolve, source);
  const rules = require(path.join(source, 'tools/evolve-stage-rules.json'));
  const saved = fixtures ? JSON.parse(fs.readFileSync(fixtures, 'utf8')) : null;
  const groups = [];
  for (const chapter of [1, 2, 3, 4, 5]) {
    const spec = diagnosticSpec(SA, rules, chapter);
    for (const enemy of ['track', 'quad']) {
      const vehicles = [], battles = [];
      for (let i = 0; i < pairs; i++) {
        const vehicleSeed = seed + chapter * 10000 + (enemy === 'quad' ? 5000 : 0) + i * 10;
        const before = saved?.groups.find(g => g.chapter === chapter && g.enemy === enemy)?.vehicles[i];
        // 保留完整模拟输入；分享码/导入会归一化唯一件材料，不能拿来复原统计样本。
        const restore = row => { const v = SA.V.clone(row.vehicle); v.lim = { ...spec.grid }; return v; };
        const p = before ? restore(before.biped) : candidate(SA, evolve, spec, 'biped', vehicleSeed, fund);
        const e = before ? restore(before.enemy) : candidate(SA, evolve, spec, enemy, vehicleSeed + 1, fund);
        const describe = v => { const s = SA.V.stats(v, { deferHeat: true }); return { code: SA.V.encode(v), value: s.value,
          vehicle: SA.V.clone(v), cells: SA.StageCars.cellsOf(v), budgetUtilization: s.value / spec.budget, weight: s.weight, loadKg: s.loadKg, capacity: s.load, legal: evolve.legalVehicle(SA, v, spec) }; };
        const record = { seed: vehicleSeed, biped: describe(p), enemy: describe(e) };
        record.priceGap = Math.abs(record.biped.value - record.enemy.value) / Math.max(record.biped.value, record.enemy.value);
        record.matchedPrice = record.priceGap <= 0.05;
        record.fullBudget = Math.min(record.biped.budgetUtilization, record.enemy.budgetUtilization) >= 0.9;
        if (!record.biped.legal || !record.enemy.legal) throw new Error('复用构筑不再合法');
        vehicles.push(record);
        for (const swapped of [false, true]) {
          const result = SA.Battle.simulate({ p: swapped ? e : p, e: swapped ? p : e, seed: vehicleSeed + 2,
            terrain: spec.terrain, pStyle: 'rush', eStyle: 'rush', pAim: 0.8, eAim: 0.8 });
          battles.push({ seed: vehicleSeed + 2, swapped, pChassis: swapped ? enemy : 'biped', result });
        }
      }
      groups.push({ chapter, enemy, spec, vehicles, battles, biped: aggregate(battles, 'biped'), opponent: aggregate(battles, enemy) });
      console.log(`章节${chapter} 双足/${enemy} ${pairs * 2}场：${(groups.at(-1).biped.winRate * 100).toFixed(1)}%`);
    }
  }
  return { version: 1, seed, pairs, fund, source: path.resolve(source), battleHash,
    scope: '同预算上限、诊断材料池、有限随机候选、平地冲锋AI；花费不保证相等；不是总体平衡或第五章满配结论',
    hitMetric: '对手 events.hit / 对手 events.fire，包含穿透等多次命中事件，不是独立单弹命中概率', groups };
}

if (require.main === module) {
  const args = process.argv.slice(2), arg = key => args[args.indexOf(key) + 1];
  if (args.includes('--help')) {
    console.log('双足真实战斗诊断：node tools/biped-benchmark.js [--source 快照目录] [--fixtures 基线JSON] [--pairs 1～32] [--fund] [--out JSON路径]\n默认每组8对，五章各对履带/四足并换边；--fund预算填充较慢。');
    process.exit(0);
  }
  const options = {};
  options.fund = args.includes('--fund');
  for (const key of ['source', 'fixtures']) if (args.includes(`--${key}`)) options[key] = path.resolve(arg(`--${key}`));
  if (args.includes('--pairs')) options.pairs = Number(arg('--pairs'));
  if (!Number.isInteger(options.pairs ?? 8) || (options.pairs ?? 8) < 1 || (options.pairs ?? 8) > 32) throw new Error('每组样本对数必须为1～32');
  const result = run(options);
  const out = args.includes('--out') ? path.resolve(arg('--out')) : path.resolve('tools/out/biped-benchmark.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(`统计已保存：${out}`);
}
module.exports = { run, loadObservedGame, diagnosticSpec, aggregate };
