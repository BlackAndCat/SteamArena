/*
 * P2 系统健康诊断（只读诊断工具）。
 * 规则：所有对局都调用真实 SA.Battle.simulate；本文件不复制战斗公式，也不修改游戏数值。
 * 默认只做 --self-check（少量对局）。正式运行需显式传 --run [局数]，结果写入 tools/out/，不保存逐局日志。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadGame, ruleFingerprint } = require('./evolve');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const STYLES = ['rush', 'kite', 'turtle', 'wander'];
const TERRAIN_KEYS = ['flat', 'crates', 'mud', 'hills', 'yard', 'mine'];

function clone(SA, v) { return SA.V.clone(v); }
function cells(SA, v, id) { const out = []; SA.V.each(v, (c, r, col, layer) => { if (c.id === id) out.push({ c, r, col, layer }); }); return out; }
function legal(SA, v) {
  const issues = SA.V.issues(v);
  return { ok: !issues.length, issues: issues.slice(0, 8) };
}
function buildRepresentatives(SA) {
  // 三种底盘共享同一套动力、武器，减少构筑差异带来的偏差。
  const rows = {
    track: ['........', '........', '...P....', '..KOH...', '..WAAAA.', '..TTTT..'],
    quad:  ['........', '........', '...P....', '..KOH...', '..WAAAA.', '..Q.....'],
    biped: ['........', '........', '...P....', '..KOH...', '..WAAAA.', '..B.....'],
  };
  return Object.entries(rows).flatMap(([chassis, data]) => STYLES.map(style => ({
    chassis, style, v: SA.V.fromAscii(`${chassis}-${style}`, data, [], 1, [], [[7, 7, 'helmet']]),
  })));
}
function invert(r) {
  return { ...r, winner: r.winner === 'p' ? 'e' : r.winner === 'e' ? 'p' : 'draw', pDealt: r.eDealt, eDealt: r.pDealt };
}
function duel(SA, a, b, terrain, styleA, styleB, seed) {
  const left = SA.Battle.simulate({ p: a, e: b, terrain, pStyle: styleA, eStyle: styleB, pAim: .8, eAim: .8, seed });
  const right = invert(SA.Battle.simulate({ p: b, e: a, terrain, pStyle: styleB, eStyle: styleA, pAim: .8, eAim: .8, seed }));
  return { left, right };
}
function outcome(r) { return r.winner === 'p' ? 1 : r.winner === 'e' ? 0 : .5; }
function score(r) {
  const shots = r.events?.p?.fire || 0, hits = r.events?.p?.hit || 0;
  return Math.max(0, Math.min(100, 40 + (shots ? 12 * hits / shots : 0) + Math.min(12, (r.metrics?.nearTime || 0) / Math.max(1, r.t || 1) * 12)));
}
function health(SA, games) {
  const reps = buildRepresentatives(SA), rows = [], dist = { wins: 0, losses: 0, draws: 0, timeout: 0, dry: 0, overheat: 0 };
  let seed = 910000;
  for (let i = 0; i < games; i++) {
    const a = reps[i % reps.length], b = reps[(i * 7 + 3) % reps.length], terrain = TERRAIN_KEYS[i % TERRAIN_KEYS.length];
    const d = duel(SA, a.v, b.v, terrain, a.style, b.style, seed++);
    for (const r of [d.left, d.right]) {
      const o = outcome(r); if (o === 1) dist.wins++; else if (o === 0) dist.losses++; else dist.draws++;
      if (r.reason === '超时' || r.timeout) dist.timeout++;
      const player = r.events?.p || {};
      if (Number.isFinite(player.minWater) && player.minWater <= 1e-6) dist.dry++;
      if (Number.isFinite(player.maxHeat) && player.maxHeat >= Number(SA.K.HEAT_MAX) - 1e-6) dist.overheat++;
    }
    if (rows.length < 12) rows.push({ seed: seed - 1, terrain, a: a.chassis + '/' + a.style, b: b.chassis + '/' + b.style, winner: d.left.winner, performance: score(d.left) });
  }
  const total = Math.max(1, games * 2);
  return { games, simulatedDuels: total, representatives: reps.length, terrains: TERRAIN_KEYS, styles: STYLES, distribution: dist,
    rates: { dry: dist.dry / total, timeout: dist.timeout / total, draw: dist.draws / total, overheat: dist.overheat / total },
    targets: { dry: '<0.30', timeout: '<0.10', draw: '<0.05', averageSeconds: '30-60' }, samples: rows };
}
function replaceWater(SA, base, count) {
  const v = clone(SA, base), targets = cells(SA, v, 'armor').concat(cells(SA, v, 'armor_heavy')).filter(x => x.layer === 'body');
  let replaced = 0;
  for (const t of targets.slice(0, count)) { v.body[t.r][t.col] = SA.newCell('tank_s', 1); replaced++; }
  const check = legal(SA, v);
  return { vehicle: v, requested: count, replaced, legal: check.ok, issues: check.issues };
}
function waterMarginal(SA) {
  const base = buildRepresentatives(SA)[0].v, out = [];
  for (let n = 0; n <= 4; n++) { const x = replaceWater(SA, base, n); out.push({ slots: n, replaced: x.replaced, legal: x.legal, issues: x.issues }); }
  return out;
}
function withParameter(SA, key, factor, fn) {
  const oldK = SA.K[key], oldMod = SA.mod;
  if (Object.prototype.hasOwnProperty.call(SA.K, key)) SA.K[key] = oldK * factor;
  // SA.mod 可能被缓存：返回浅副本，避免污染原模块定义。
  SA.mod = (x, mt) => { const m = { ...oldMod(x, mt) }; if (key === 'FIRE_HEAT') for (const k of ['heat', 'heatPerSec', 'heatToEnemy']) if (m[k] != null) m[k] *= factor; if (key === 'WATER_CAPACITY' && m.water) m.water *= factor; return m; };
  try { return fn(); } finally { SA.K[key] = oldK; SA.mod = oldMod; }
}
function sensitivity(SA) {
  const base = buildRepresentatives(SA)[0].v, opp = buildRepresentatives(SA)[1].v,
    keys = ['IDLE_HEAT', 'DISSIPATE', 'COOL_FULL', 'WATER_PER_HEAT', 'WATER_CAPACITY', 'FIRE_WATER', 'FIRE_HEAT', 'BATTLE_TIME'];
  const out = {};
  for (const key of keys) out[key] = [-.2, .2].map(delta => withParameter(SA, key, 1 + delta, () => {
    const r = duel(SA, base, opp, 'flat', 'wander', 'wander', 72100);
    return { factor: 1 + delta, winner: r.left.winner, t: r.left.t, pDealt: r.left.pDealt,
      minWater: r.left.events?.p?.minWater, maxHeat: r.left.events?.p?.maxHeat, reason: r.left.reason };
  }));
  return out;
}
function coolingGuard(SA) {
  const normal = SA.V.fromAscii('正常冷却车', ['........', '........', '...P....', '..KOH...', '..WWAA..', '..TTTT..'], [], 1, [], []);
  const jet = SA.V.fromAscii('蒸汽车', ['........', '........', '...P....', '..KOc...', '..WWAA..', '..TTTT..'], [], 1, [], []);
  const flame = SA.V.fromAscii('喷火车', ['........', '........', '...P....', '..KOF...', '..WWAA..', '..TTTT..'], [], 1, [], []);
  const rows = [['flamer', flame], ['steamjet', jet]].map(([id, v]) => {
    const r = SA.Battle.simulate({ p: v, e: normal, terrain: 'flat', pStyle: 'turtle', eStyle: 'turtle', seed: 25000 + id.length });
    return { weapon: id, legal: legal(SA, v), t: r.t, reason: r.reason, maxHeat: r.maxHeat, guard25s: Number(r.t || 0) >= 25 || r.reason === '超时' };
  });
  return { rows, note: '护栏要求正常冷却车连续运行至少 25 秒；仅记录诊断，不改数值。' };
}
function combinationSearch(SA) {
  const keys = ['IDLE_HEAT', 'DISSIPATE', 'COOL_FULL', 'WATER_PER_HEAT', 'WATER_CAPACITY', 'FIRE_HEAT', 'BATTLE_TIME'];
  const base = buildRepresentatives(SA)[0].v, opp = buildRepresentatives(SA)[1].v, groups = [];
  for (let i = 0; i < 30; i++) {
    const key = keys[i % keys.length], factor = 0.8 + ((i * 7) % 9) * 0.05;
    const r = withParameter(SA, key, factor, () => SA.Battle.simulate({ p: base, e: opp, terrain: TERRAIN_KEYS[i % TERRAIN_KEYS.length], pStyle: 'wander', eStyle: 'wander', seed: 48000 + i }));
    groups.push({ index: i, key, factor, winner: r.winner, t: r.t, pDealt: r.pDealt });
  }
  const validation = [];
  // 独立验证样本使用另一段种子区间，避免与 30 组搜索复用随机序列。
  for (let i = 0; i < 1000; i++) {
    const seed = 900000 + i, raw = SA.Battle.simulate({ p: base, e: opp, terrain: TERRAIN_KEYS[i % TERRAIN_KEYS.length], pStyle: 'wander', eStyle: 'wander', seed });
    const tuned = withParameter(SA, 'DISSIPATE', 1.2, () => SA.Battle.simulate({ p: base, e: opp, terrain: TERRAIN_KEYS[i % TERRAIN_KEYS.length], pStyle: 'wander', eStyle: 'wander', seed }));
    if (validation.length < 12) validation.push({ seed, raw: raw.winner, tuned: tuned.winner });
  }
  return { groups, count: groups.length, independentValidation: { games: 1000, executed: true, samples: validation } };
}
function k9(SA) {
  const bucket = SA.V.fromAscii('K9铲斗动力', ['........', '........', '...K....', '...O....', '..WOA...', '..TTT...'], [], 1, [], [[10, 10, 'bucket']]);
  const legalBucket = legal(SA, bucket), opponents = SA.OPPONENTS.slice(0, 5), rows = [];
  for (let i = 0; i < opponents.length; i++) { const s = opponents[i], e = SA.V.fromAscii(s.name, s.rows, s.sides || [], s.mt || 1, s.elite || [], s.subs || []); const r = SA.Battle.simulate({ p: bucket, e, terrain: s.terrain || 'flat', pStyle: 'rush', eStyle: s.style || 'wander', seed: 74000 + i }); rows.push({ opponent: s.name, winner: r.winner, reason: r.reason, t: r.t }); }
  return { legal: legalBucket, hasBucket: cells(SA, bucket, 'bucket').length > 0, hasBoiler: cells(SA, bucket, 'boiler').length > 0, melee: rows, note: '序章铲斗尚未解锁时为反事实诊断；正式购买需等待解锁。' };
}
function writeReport(report) {
  const name = `health-diagnostics-${Date.now()}.json`, preferred = path.join(OUT, name);
  try { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(preferred, JSON.stringify(report)); return preferred; }
  catch (error) { const fallback = path.join(__dirname, 'health-diagnostics-report.json'); fs.writeFileSync(fallback, JSON.stringify({ ...report, outputError: error.code || String(error) })); return fallback; }
}
function run(SA, games) {
  const report = { version: 1, rules: ruleFingerprint(SA), generatedAt: new Date().toISOString(), health: health(SA, games), waterMarginal: waterMarginal(SA), coolingGuard: coolingGuard(SA), sensitivity: sensitivity(SA), k9: k9(SA), combinationSearch: combinationSearch(SA), recommendation: '诊断结果不自动修改战斗数值，需用户批准后另行处理。' };
  const file = writeReport(report); return { file, bytes: fs.statSync(file).size, report };
}
function selfCheck(SA) {
  const reps = buildRepresentatives(SA), checks = reps.map(x => ({ name: x.chassis + '/' + x.style, legal: legal(SA, x.v) }));
  const sample = duel(SA, reps[0].v, reps[1].v, 'flat', reps[0].style, reps[1].style, 1);
  if (!checks.every(x => x.legal.ok)) throw new Error('代表车不合法：' + JSON.stringify(checks));
  if (!sample.left || !sample.right) throw new Error('simulate 未返回左右交换结果');
  return { ok: true, representatives: checks.length, sample: { left: sample.left.winner, right: sample.right.winner }, checks };
}
function main(argv) { const { SA } = loadGame(); if (argv[0] === '--self-check' || !argv.length) { console.log(JSON.stringify(selfCheck(SA), null, 2)); return; } if (argv[0] === '--run') { const n = Math.max(500, Number(argv[1]) || 500); const out = run(SA, n); console.log(JSON.stringify({ file: path.relative(ROOT, out.file), bytes: out.bytes, games: n }, null, 2)); return; } throw new Error('用法：node tools/health-diagnostics.js --self-check | --run [局数]'); }
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; } }
module.exports = { buildRepresentatives, health, waterMarginal, coolingGuard, sensitivity, combinationSearch, k9, run, selfCheck };
