/* K8 全战役预演入口：异步 worker 评估、分段进度和检查点，不替换 js/content.js。 */
'use strict';
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');
const storage = require('./evolve-storage');
const progress = require('./evolve-progress');

function markdown(report) {
  const rows = [];
  for (const chapter of report.chapters || []) for (const stage of chapter.stages || []) rows.push(`|${chapter.chapter + 1}|${stage.spec.name}|${stage.selected?.name || '未选出'}|${stage.spec.terrain}|${stage.archive?.toxic || 0}|${stage.archive?.odd || 0}|${stage.selection?.failed?.join(',') || '—'}|`);
  const stages = report.chapters?.flatMap(ch => ch.stages || []) || [];
  const toxic = stages.reduce((n, s) => n + (s.archive?.toxic || 0), 0), odd = stages.reduce((n, s) => n + (s.archive?.odd || 0), 0);
  const reasons = {};
  for (const item of report.selectionFailures || []) for (const reason of item.failed || []) reasons[reason] = (reasons[reason] || 0) + 1;
  const telemetry = report.telemetry || {};
  const elapsed = Number.isFinite(telemetry.elapsedMs) ? `${(telemetry.elapsedMs / 60000).toFixed(2)} 分钟` : '未知';
  const throughput = Number.isFinite(telemetry.completedCandidates) && telemetry.elapsedMs > 0 ? `${(telemetry.completedCandidates / (telemetry.elapsedMs / 1000)).toFixed(2)} 候选/秒` : '未知';
  const cache = report.cache || {};
  return ['# K8 全战役进化预演', '', `参数：seed=${report.seed}，章节=${report.chapters?.length || 0}，候选=${report.candidates?.length || 0}；population.size=${report.config.population.size}、generations=${report.config.population.generations}、quickGames=${report.config.evaluation.quickGames}、archiveGames=${report.config.evaluation.archiveGames}。`, `状态：${report.status || 'complete'}（running / interrupted 表示尚未生成完整报告）。`, '', '## 运行数据', '', `- worker：${telemetry.workerCount || '未知'}；候选评估：${telemetry.completedCandidates || 0}；阶段：${telemetry.completedStages || 0}；耗时：${elapsed}；吞吐：${throughput}。`, `- 对局缓存：命中 ${cache.hits || 0}、未命中 ${cache.misses || 0}、命中率 ${Number.isFinite(cache.hitRate) ? (cache.hitRate * 100).toFixed(1) : '0.0'}%，淘汰 ${cache.evictions || 0}。`, '- 分段日志：`tools/evolve-progress/evolve-progress.jsonl`；实时检查点：`tools/evolve-progress/evolve-live.json`。', '', '|章节|关卡|选车|地形|毒瘤|奇特|未达标|', '|---:|---|---|---|---:|---:|---|', ...rows, '', '## 统计', '', `- 选关失败记录：${report.selectionFailures?.length || 0}；毒瘤候选累计 ${toxic}，奇特构筑累计 ${odd}。`, `- 未达标原因计数：${Object.entries(reasons).map(([key, value]) => `${key}=${value}`).join('，') || '无'}。`, '- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。'].join('\n');
}

function write(report) {
  const json = JSON.stringify(report, null, 2); let file;
  try { file = storage.writeReport(report).file; }
  catch (error) {
    if (!['EACCES', 'EPERM'].includes(error.code)) throw error;
    file = path.join(__dirname, 'evolve-preview.json'); fs.writeFileSync(file, json, 'utf8');
    console.error(`保存 tools/out 报告没有权限（${error.code}），已保留备用报告：${file}`);
  }
  const md = path.join(__dirname, 'evolve-prerun.md'); fs.writeFileSync(md, markdown(report), 'utf8'); return { file, md };
}

async function main() {
  const original = { size: config.population.size, generations: config.population.generations, quickGames: config.evaluation.quickGames, archiveGames: config.evaluation.archiveGames };
  config.population.size = Number(process.argv[2] || 8); config.population.generations = Number(process.argv[3] || 2); config.evaluation.quickGames = Number(process.argv[4] || 2); config.evaluation.archiveGames = Number(process.argv[5] || 2);
  const workers = Number(process.argv[6] || 4); if (!Number.isInteger(workers) || workers < 1) throw new Error(`workers 必须是正整数：${process.argv[6]}`);
  let sink;
  try { sink = progress.create(); }
  catch (error) {
    if (!['EACCES', 'EPERM'].includes(error.code)) throw error;
    const fallbackDirectory = path.join(__dirname, 'evolve-progress'); sink = progress.create({ directory: fallbackDirectory });
    console.error(`tools/out 无法写入（${error.code}），进度日志改写到：${fallbackDirectory}`);
  }
  let stop = false; const stopHandler = () => { stop = true; console.error('[进化] 收到中断信号，将在当前批次结束后停止。'); };
  process.on('SIGINT', stopHandler); process.on('SIGTERM', stopHandler);
  let report;
  try { report = await evolve.runAsync({ chapters: 6, games: config.evaluation.quickGames, seed: 20260927, strict: false, workers, onProgress: sink.onProgress, onCheckpoint: sink.onCheckpoint, shouldStop: () => stop }); }
  finally { process.off('SIGINT', stopHandler); process.off('SIGTERM', stopHandler); Object.assign(config.population, { size: original.size, generations: original.generations }); Object.assign(config.evaluation, { quickGames: original.quickGames, archiveGames: original.archiveGames }); }
  report.config = { ...report.config, population: { ...report.config.population, size: Number(process.argv[2] || 8), generations: Number(process.argv[3] || 2) }, evaluation: { ...report.config.evaluation, quickGames: Number(process.argv[4] || 2), archiveGames: Number(process.argv[5] || 2) } };
  const output = write(report); console.log(JSON.stringify({ ...output, status: report.status, chapters: report.chapters.length, stages: report.chapters.reduce((n, c) => n + c.stages.length, 0), candidates: report.candidates.length, selectionFailures: report.selectionFailures.length }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { markdown, write, main };
