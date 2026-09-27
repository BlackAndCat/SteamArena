/*
 * K8 全战役预演入口。
 *
 * 预演临时缩小种群和评估局数，仍然调用正式 evolve.run 的解锁、规格、评分和选关
 * 路径；它只写运行报告，不替换 js/content.js，也不生成候选库。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');
const storage = require('./evolve-storage');

function markdown(report) {
  const rows = [];
  for (const chapter of report.chapters) {
    for (const stage of chapter.stages) {
      const failed = stage.selection?.failed?.join(',') || '—';
      rows.push(`|${chapter.chapter + 1}|${stage.spec.name}|${stage.selected?.name || '未选出'}|${stage.spec.terrain}|${stage.archive.toxic}|${stage.archive.odd}|${failed}|`);
    }
  }
  const failures = report.selectionFailures.length;
  const toxic = report.chapters.flatMap(ch => ch.stages).reduce((sum, row) => sum + row.archive.toxic, 0);
  const odd = report.chapters.flatMap(ch => ch.stages).reduce((sum, row) => sum + row.archive.odd, 0);
  return [
    '# K8 全战役进化预演', '',
    `参数：seed=${report.seed}，章节=${report.chapters.length}，候选=${report.candidates.length}；population.size=${report.config.population.size}、generations=${report.config.population.generations}、quickGames=${report.config.evaluation.quickGames}、archiveGames=${report.config.evaluation.archiveGames}。`,
    '', '|章节|关卡|选车|地形|毒瘤|奇特|未达标|', '|---:|---|---|---|---:|---:|---|', ...rows, '',
    '## 统计', '', `- 选关失败记录：${failures}；毒瘤候选累计 ${toxic}，奇特构筑累计 ${odd}。`,
    '- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。',
  ].join('\n');
}

function write(report) {
  const json = JSON.stringify(report, null, 2);
  let file;
  try { file = storage.writeReport(report).file; }
  catch (error) {
    file = path.join(__dirname, 'evolve-preview.json');
    fs.writeFileSync(file, json, 'utf8');
  }
  const md = path.join(__dirname, 'evolve-prerun.md');
  try { fs.writeFileSync(md, markdown(report), 'utf8'); } catch (_) { /* 报告 JSON 已保存 */ }
  return { file, md };
}

function main() {
  const original = {
    size: config.population.size,
    generations: config.population.generations,
    quickGames: config.evaluation.quickGames,
    archiveGames: config.evaluation.archiveGames,
  };
  config.population.size = Number(process.argv[2] || 8);
  config.population.generations = Number(process.argv[3] || 2);
  config.evaluation.quickGames = Number(process.argv[4] || 2);
  config.evaluation.archiveGames = Number(process.argv[5] || 2);
  let report;
  try { report = evolve.run({ chapters: 6, games: config.evaluation.quickGames, seed: 20260927, strict: false }); }
  finally {
    config.population.size = original.size;
    config.population.generations = original.generations;
    config.evaluation.quickGames = original.quickGames;
    config.evaluation.archiveGames = original.archiveGames;
  }
  // run() 返回的 config 与全局对象同一引用，复制预演参数避免报告被恢复值覆盖。
  report.config = { ...report.config, population: { ...report.config.population, size: Number(process.argv[2] || 8), generations: Number(process.argv[3] || 2) }, evaluation: { ...report.config.evaluation, quickGames: Number(process.argv[4] || 2), archiveGames: Number(process.argv[5] || 2) } };
  const output = write(report);
  console.log(JSON.stringify({ ...output, chapters: report.chapters.length, stages: report.chapters.reduce((n, c) => n + c.stages.length, 0), candidates: report.candidates.length, selectionFailures: report.selectionFailures.length }, null, 2));
}

if (require.main === module) main();

