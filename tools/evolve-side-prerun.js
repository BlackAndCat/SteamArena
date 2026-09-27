/*
 * 支线方案 A 独立预演。
 * 支线奖励只写入报告，不加入候选车的可用模块池，也不修改主战役生成器。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');

const ROOT = path.resolve(__dirname, '..');
const SIDE_COUNT = Math.max(1, Number(process.argv[2]) || 8);
const SEED = 2026092702;

function vehicle(SA, row) {
  return SA.V.fromAscii(row.name, row.rows, row.sides || [], row.mt || 1, row.elite || [], row.subs || []);
}

function legal(SA, v) {
  const issues = SA.V.issues(v) || [];
  const stats = SA.V.stats(v);
  return { ok: !issues.length && stats.canDeploy !== false, issues: issues.slice(0, 8), canDeploy: stats.canDeploy !== false };
}

function sideSpec(SA, side, chapter) {
  // 复用该章最后一关的解锁和预算，但移除主战役奖励，避免免费获得支线唯一件。
  const base = evolve.stageSpec(SA, Math.min(chapter, SA.CAMPAIGN.length - 1), SA.CAMPAIGN[Math.min(chapter, SA.CAMPAIGN.length - 1)].stages.length - 1);
  const availableMods = base.availableMods.filter(id => id !== side.reward?.id);
  return {
    ...base, chapter, stage: -1, name: side.name, terrain: side.terrain || 'flat',
    style: side.style || null, rewardModule: null, uniqueLoot: [], availableMods,
    target: { bossWinRate: null }, performanceMin: 0,
  };
}

function compact(result) {
  return {
    winner: result.winner, t: result.t, reason: result.reason,
    pDealt: result.pDealt, eDealt: result.eDealt,
    events: { p: result.events?.p, e: result.events?.e },
  };
}

function runSide(SA, side, index) {
  const chapter = Math.max(0, Number(side.chapter || 1) - 1);
  const spec = sideSpec(SA, side, chapter);
  const candidates = [];
  for (let i = 0; i < SIDE_COUNT; i++) {
    const rng = new evolve.RNG(SEED + index * 1000 + i * 17);
    const v = evolve.randomVehicle(SA, spec, rng) || evolve.minimalVehicle(SA, spec);
    const check = legal(SA, v);
    if (!check.ok) continue;
    candidates.push({ name: v.name || `${side.id}-${i + 1}`, code: SA.V.encode(v), legal: check, stats: SA.V.stats(v), vehicle: v });
  }
  const bossRows = SA.CAMPAIGN[chapter]?.stages || [];
  const boss = bossRows.find(row => row.boss) || bossRows[bossRows.length - 1];
  const current = bossRows[Math.min(bossRows.length - 1, 0)] || boss;
  const opponents = [boss, current].filter(Boolean).map(row => vehicle(SA, row));
  const evaluated = candidates.map((item, i) => {
    const fights = opponents.map((enemy, j) => {
      const seed = SEED + index * 10000 + i * 101 + j;
      const forward = SA.Battle.simulate({ p: item.vehicle, e: enemy, terrain: spec.terrain, pStyle: spec.style || 'wander', eStyle: 'wander', seed });
      const reverse = SA.Battle.simulate({ p: enemy, e: item.vehicle, terrain: spec.terrain, pStyle: 'wander', eStyle: spec.style || 'wander', seed: seed + 1 });
      return { opponent: j === 0 ? 'boss' : 'current', forward: compact(forward), reverse: compact(reverse) };
    });
    const scores = fights.flatMap(row => [row.forward.winner === 'p' ? 1 : row.forward.winner === 'draw' ? .5 : 0, row.reverse.winner === 'e' ? 1 : row.reverse.winner === 'draw' ? .5 : 0]);
    return { name: item.name, code: item.code, legal: item.legal, stats: { hp: item.stats.hp, dps: item.stats.dps, water: item.stats.water, cool: item.stats.cool, rating: item.stats.rating }, winRate: scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length), fights };
  });
  const ranked = evaluated.slice().sort((a, b) => b.winRate - a.winRate);
  return {
    id: side.id, name: side.name, chapter: chapter + 1, terrain: side.terrain || 'flat',
    reward: side.reward || null, rewardExcludedFromPool: !(spec.availableMods || []).includes(side.reward?.id),
    availableModuleCount: spec.availableMods.length, opponents: ['boss', 'current'],
    candidates: ranked.slice(0, SIDE_COUNT), unmet: [], note: '支线没有用户指定胜率目标，本次只做合法性和双向实战诊断。',
  };
}

function write(report) {
  const json = JSON.stringify(report, null, 2);
  let file = path.join(__dirname, 'out', 'evolve-side-20260927.json');
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, json); }
  catch (error) { file = path.join(__dirname, 'evolve-side-20260927.json'); fs.writeFileSync(file, JSON.stringify({ ...report, outputError: error.code || String(error) }, null, 2)); }
  const lines = ['# 支线方案 A 独立预演', '', `seed=${report.seed}，支线=${report.sides.length}，每支线候选上限=${report.candidateCount}`, '', '|支线|章节|地形|候选|合法|奖励未注入|', '|---|---:|---|---:|---:|---:|'];
  for (const s of report.sides) lines.push(`|${s.name}|${s.chapter}|${s.terrain}|${s.candidates.length}|${s.candidates.filter(c => c.legal.ok).length}|${s.rewardExcludedFromPool ? '是' : '否'}|`);
  lines.push('', '未设置支线胜率合格线；每个候选均与本章 Boss/当前敌车进行固定种子的双向实战。', '报告不包含逐局日志，只保留候选分享码、汇总和典型对局。');
  const md = path.join(__dirname, 'out', 'evolve-side-20260927.md');
  try { fs.writeFileSync(md, lines.join('\n')); } catch (_) { /* JSON 已写入 */ }
  return { file, md };
}

function main() {
  const { SA } = evolve.loadGame();
  const sides = (SA.SIDE_ENCOUNTERS || []).map((side, i) => runSide(SA, side, i));
  const report = { version: 1, seed: SEED, candidateCount: SIDE_COUNT, rules: evolve.ruleFingerprint(SA), sides, note: '独立支线预演，未修改 js/content.js、主战役生成器或候选库。' };
  const output = write(report);
  console.log(JSON.stringify({ ...output, sides: sides.length, candidates: sides.reduce((n, s) => n + s.candidates.length, 0) }, null, 2));
}

if (require.main === module) main();
module.exports = { sideSpec, runSide, run: main };
