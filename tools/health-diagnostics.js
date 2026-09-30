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
  const swap = (x) => x ? { ...x, p: x.e, e: x.p } : x;
  return { ...r, winner: r.winner === 'p' ? 'e' : r.winner === 'e' ? 'p' : 'draw', pDealt: r.eDealt, eDealt: r.pDealt, events: swap(r.events), state: swap(r.state) };
}
function duel(SA, a, b, terrain, styleA, styleB, seed) {
  const left = SA.Battle.simulate({ p: a, e: b, terrain, pStyle: styleA, eStyle: styleB, pAim: .8, eAim: .8, seed });
  const right = invert(SA.Battle.simulate({ p: b, e: a, terrain, pStyle: styleB, eStyle: styleA, pAim: .8, eAim: .8, seed }));
  return { left, right };
}
function outcome(r) { return r.winner === 'p' ? 1 : r.winner === 'e' ? 0 : .5; }
function ci95(rate, n) { const z = 1.96, den = 1 + z * z / n, mid = (rate + z * z / (2 * n)) / den, half = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * n)) / n) / den; return [Math.max(0, mid - half), Math.min(1, mid + half)]; }
function score(r) {
  const shots = r.events?.p?.fire || 0, hits = r.events?.p?.hit || 0;
  return Math.max(0, Math.min(100, 40 + (shots ? 12 * hits / shots : 0) + Math.min(12, (r.metrics?.nearTime || 0) / Math.max(1, r.t || 1) * 12)));
}
function health(SA, games) {
  const reps = buildRepresentatives(SA), rows = [], times = [], dist = { wins: 0, losses: 0, draws: 0, timeout: 0, dry: 0, waterOnly: 0, overheat: 0, avgSeconds: 0 }, target = Math.max(10, Math.ceil(games / 72));
  let seed = 910000;
  let count = 0;
  for (const a of reps) for (const terrain of TERRAIN_KEYS) for (let j = 0; j < target; j++) {
    const b = reps[(reps.indexOf(a) + 5 + j) % reps.length], d = duel(SA, a.v, b.v, terrain, a.style, b.style, seed++); count++;
    for (const r of [d.left, d.right]) {
      const o = outcome(r); if (o === 1) dist.wins++; else if (o === 0) dist.losses++; else dist.draws++; times.push(Number(r.t) || 0);
      if (r.reason === '超时' || r.timeout) dist.timeout++;
      const player = r.events?.p || {};
      if (Number.isFinite(player.minWater) && player.minWater <= 1e-6) dist.dry++;
      if (player.minWater <= 1e-6 && player.firstHeatMaxAt == null) dist.waterOnly++;
      if (player.firstHeatMaxAt != null) dist.overheat++;
      dist.avgSeconds += Number(r.t) || 0;
    }
    if (rows.length < 12) rows.push({ seed: seed - 1, terrain, a: a.chassis + '/' + a.style, b: b.chassis + '/' + b.style, winner: d.left.winner, performance: score(d.left) });
  }
  const total = Math.max(1, count * 2); dist.avgSeconds = times.reduce((s, x) => s + x, 0) / total;
  const rate = key => dist[key] / total;
  return { games: count, simulatedDuels: total, representatives: reps.length, terrains: TERRAIN_KEYS, styles: STYLES, distribution: dist,
    rates: { dry: rate('dry'), dryCI95: ci95(rate('dry'), total), timeout: rate('timeout'), timeoutCI95: ci95(rate('timeout'), total), draw: rate('draws'), drawCI95: ci95(rate('draws'), total), overheat: rate('overheat'), overheatCI95: ci95(rate('overheat'), total), averageSecondsCI95: meanCI95(times.map(t => ({ t }))) },
    targets: { dry: '<0.30', timeout: '<0.10', draw: '<0.05', averageSeconds: '30-60' }, samples: rows };
}
function rootCause(SA, games) {
  const reps = buildRepresentatives(SA), groups = {}, target = Math.max(10, Math.ceil(games / 72));
  const totals = { battles: 0, battleDraws: 0, drawBothDry: 0, drawBothDrySimultaneous: 0, drawDryHeat: 0, pFirstDry: 0, eFirstDry: 0, unknownFailureOrder: 0 };
  const add = (key, r) => { const e = r.events?.p || {}, g = groups[key] || (groups[key] = { n: 0, dry: 0, waterOnly: 0, heat: 0, draw: 0, waterFirst: 0, heatFirst: 0, simultaneousDry: 0, unknownOrder: 0, fireHeld: 0, holding: 0, venting: 0 }); g.n++; const dry = e.minWater <= 1e-6, heat = e.firstHeatMaxAt != null; g.dry += dry ? 1 : 0; g.waterOnly += dry && !heat ? 1 : 0; g.heat += heat ? 1 : 0; g.draw += r.winner === 'draw' ? 1 : 0; const wt = e.firstWaterEmptyAt, ht = e.firstHeatMaxAt; if (wt != null && ht != null) { if (wt < ht) g.waterFirst++; else if (ht < wt) g.heatFirst++; else g.simultaneousDry++; } else if (wt != null) g.waterFirst++; else if (ht != null) g.heatFirst++; else if (dry || heat) g.unknownOrder++; g.fireHeld += e.fireHeldAtFailure ? 1 : 0; g.holding += e.holdAtFailure ? 1 : 0; g.venting += e.ventAtFailure ? 1 : 0; };
  let seed = 120000;
  for (const a of reps) for (const terrain of TERRAIN_KEYS) for (let j = 0; j < target; j++) {
    const b = reps[(reps.indexOf(a) + 5 + j) % reps.length], d = duel(SA, a.v, b.v, terrain, a.style, b.style, seed++), leftEvents = d.left.events || {};
    totals.battles++;
    if (d.left.winner === 'draw') {
      totals.battleDraws++;
      const pe = leftEvents.p || {}, ee = leftEvents.e || {}, pDry = pe.failureType === 'dry' || pe.minWater <= 1e-6, eDry = ee.failureType === 'dry' || ee.minWater <= 1e-6;
      if (pDry && eDry) {
        totals.drawBothDry++;
        if (pe.failureAt != null && ee.failureAt != null && Math.abs(pe.failureAt - ee.failureAt) <= 0.1) totals.drawBothDrySimultaneous++;
        else if (pe.failureAt != null && ee.failureAt != null) { if (pe.failureAt < ee.failureAt) totals.pFirstDry++; else totals.eFirstDry++; }
      }
      if ((pe.failureType === 'dry' && ee.failureType === 'overheat') || (pe.failureType === 'overheat' && ee.failureType === 'dry')) totals.drawDryHeat++;
    }
    for (const r of [d.left, d.right]) add(`${a.chassis}/${terrain}/${a.style}`, r);
  }
  for (const g of Object.values(groups)) { for (const k of ['dry', 'waterOnly', 'heat', 'draw', 'waterFirst', 'heatFirst', 'simultaneousDry']) { g[`${k}Rate`] = g[k] / g.n; g[`${k}CI95`] = ci95(g[`${k}Rate`], g.n); } }
  return { games: target * 72, groups, totals, note: '左右交换作为独立 battle 统计；CI 按 battle 样本计算。waterOnly 表示水空但未热满；drawBothDrySimultaneous 只统计同一场平局双方在 0.1 秒内同时烧干。' };
}
function replaceWater(SA, base, count) {
  const v = clone(SA, base), targets = cells(SA, v, 'armor').concat(cells(SA, v, 'armor_heavy')).filter(x => x.layer === 'body');
  let replaced = 0;
  // 水箱必须通过真实 canPlace/place，不能直接覆盖锚点；覆盖会留下重叠占格或悬空模块，
  // 这正是旧诊断把“水箱数量”误报成非法车的原因。
  for (const t of targets) {
    if (replaced >= count) break;
    const old = v.body[t.r][t.col]; v.body[t.r][t.col] = null;
    const placed = SA.V.place(v, 'tank_s', t.r, t.col, 1);
    if (placed.ok && legal(SA, v).ok) replaced++;
    else { v.body[t.r][t.col] = old; }
  }
  // 装甲不足时继续扫描合法空位，仍然只接受 canPlace + 最终 issues 通过的构筑。
  if (replaced < count) for (let r = 0; r < SA.K.ROWS && replaced < count; r++) for (let c = 0; c < SA.K.COLS && replaced < count; c++) {
    const placed = SA.V.place(v, 'tank_s', r, c, 1);
    if (placed.ok && legal(SA, v).ok) replaced++; else if (placed.ok) v.body[r][c] = null;
  }
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
function meanCI95(rows) {
  const xs = rows.map(r => Number(r.t) || 0), n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
  if (n < 2) return [mean, mean];
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1), half = 1.96 * Math.sqrt(variance / n);
  return [Math.max(0, mean - half), mean + half];
}
function combinationSearch(SA) {
  const keys = ['IDLE_HEAT','DISSIPATE','COOL_FULL','WATER_PER_HEAT','WATER_CAPACITY','FIRE_HEAT','FIRE_WATER','BATTLE_TIME'], base = buildRepresentatives(SA)[0].v, opp = buildRepresentatives(SA)[1].v, groups = [], factors = [0.8, 0.9, 1.1, 1.2];
  const vector = i => Object.fromEntries(keys.map((k, j) => [k, factors[(i * 3 + j * 5) % factors.length]]));
  const runVec = (vec, n, offset) => { const rows = []; for (let j = 0; j < n; j++) { const simulate = () => SA.Battle.simulate({ p: base, e: opp, terrain: TERRAIN_KEYS[(offset + j) % TERRAIN_KEYS.length], pStyle: 'wander', eStyle: 'wander', seed: 48000 + offset + j }); const r = keys.reduceRight((fn, k) => () => withParameter(SA, k, vec[k], fn), simulate)(); rows.push(r); } return rows; };
  const summary = rows => { const dry = rows.filter(r => r.events?.p?.minWater <= 1e-6).length / rows.length, water = rows.filter(r => r.events?.p?.firstWaterEmptyAt != null).length / rows.length, heat = rows.filter(r => r.events?.p?.firstHeatMaxAt != null).length / rows.length, draw = rows.filter(r => r.winner === 'draw').length / rows.length, timeout = rows.filter(r => r.timeout || r.reason === '超时').length / rows.length; return { n: rows.length, dryRate: dry, dryCI95: ci95(dry, rows.length), waterEmptyRate: water, heatMaxRate: heat, drawRate: draw, drawCI95: ci95(draw, rows.length), timeoutRate: timeout, avgSeconds: rows.reduce((s,r)=>s+(r.t||0),0)/rows.length, avgSecondsCI95: meanCI95(rows) }; };
  for (let i = 0; i < 24; i++) { const factorsMap = vector(i), s = summary(runVec(factorsMap, 72, i * 1000)); groups.push({ index: i, factors: factorsMap, ...s, distance: Math.abs(s.dryRate - .2) + Math.abs(s.drawRate - .05) + Math.abs(s.timeoutRate - .1) }); }
  const top = groups.slice().sort((a,b)=>a.distance-b.distance).slice(0,3).map(g => ({ index: g.index, factors: g.factors, search: g, validation: summary(runVec(g.factors, 288, 200000 + g.index * 10000)) }));
  return { groups, count: groups.length, samplePerGroup: 72, top3: top, baseline: summary(runVec(Object.fromEntries(keys.map(k=>[k,1])), 288, 300000)), note: '24 个八参数向量共享固定种子矩阵；前三名各独立验证288局。' };
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
  const report = { version: 2, rules: ruleFingerprint(SA), generatedAt: new Date().toISOString(), health: health(SA, games), rootCause: rootCause(SA, games), waterMarginal: waterMarginal(SA), coolingGuard: coolingGuard(SA), sensitivity: sensitivity(SA), k9: k9(SA), combinationSearch: combinationSearch(SA), recommendation: '诊断结果不自动修改战斗数值，需用户批准后另行处理。' };
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
module.exports = { buildRepresentatives, health, rootCause, waterMarginal, coolingGuard, sensitivity, combinationSearch, k9, run, selfCheck };
