// 进化筛选车目录接口的离线夹具。
// 只验证报告整理和构筑摘要，不加载战斗规则，也不改写任何输入文件。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const API_FILE = path.join(ROOT, 'js', 'evolve-candidates.js');
const DEFAULT_REPORT = path.join(__dirname, 'evolve-preview.json');

function loadApi() {
  const code = fs.readFileSync(API_FILE, 'utf8');
  const context = { window: { SA: {} }, console };
  vm.runInNewContext(code, context, { filename: API_FILE });
  return context.window.SA.EvolveCandidates;
}

function run(file = DEFAULT_REPORT) {
  const api = loadApi();
  const report = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const view = api.normalizeReport(report);
  if (view.status !== 'complete') throw new Error(`报告状态不是 complete：${view.status}`);
  if (view.chapters.length !== 6) throw new Error(`章节数量错误：${view.chapters.length}`);
  if (view.stages.length !== 17) throw new Error(`关卡数量错误：${view.stages.length}`);

  let selected = 0, cells = 0, modules = 0;
  for (const [index, stage] of view.stages.entries()) {
    const previous = view.chapters.slice(0, stage.chapter).reduce((n, chapter) => n + chapter.stages.length, 0);
    if (stage.stage !== index - previous) throw new Error(`关卡顺序不连续：${stage.chapter}:${stage.stage}`);
    if (!stage.selected) throw new Error(`第 ${stage.chapter + 1} 章第 ${stage.stage + 1} 关没有 selected 记录`);
    if (!Array.isArray(stage.selected.cells) || !stage.selected.cells.length) throw new Error(`筛选车没有完整 cells：${stage.selected.name}`);
    const summaryCount = stage.selected.moduleSummary.reduce((sum, item) => sum + item.count, 0);
    if (summaryCount !== stage.selected.cells.length) throw new Error(`构筑摘要数量不一致：${stage.selected.name}`);
    selected++;
    cells += stage.selected.cells.length;
    modules += stage.selected.moduleSummary.length;
  }
  return { version: api.VERSION, chapters: view.chapters.length, stages: view.stages.length, selected, cells, distinctModuleGroups: modules, rules: view.rules };
}

if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv[2] || DEFAULT_REPORT), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { loadApi, run };
