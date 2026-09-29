'use strict';

// 本地预览服务的进化入口：只接受有界的模拟设置和完整候选，不接受命令或任意文件路径。
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');
const storage = require('./evolve-storage');

function integer(value, fallback, min, max, label) {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}必须是 ${min}～${max} 的整数`);
  return n;
}

/** 只替换本次生成的关卡，保留其余章 / 关的完整报告与各自规则版本。 */
function mergeReports(base, fresh) {
  if (!base?.chapters) return fresh;
  const key = spec => `${spec.chapter}:${spec.stage}`;
  const replaced = new Set(fresh.chapters.flatMap(ch => ch.stages.map(stage => key(stage.spec))));
  const chapters = new Map();
  for (const report of [base, fresh]) for (const ch of report.chapters) {
    if (!chapters.has(ch.chapter)) chapters.set(ch.chapter, { chapter: ch.chapter, name: ch.name, stages: [] });
    const target = chapters.get(ch.chapter);
    for (const stage of ch.stages) {
      if (report === base && replaced.has(key(stage.spec))) continue;
      target.stages.push({ ...stage, rules: stage.rules || report.rules, generatedAt: stage.generatedAt || report.generatedAt });
    }
    target.stages.sort((a, b) => a.spec.stage - b.spec.stage);
  }
  return { ...fresh, chapters: [...chapters.values()].sort((a, b) => a.chapter - b.chapter),
    candidates: [...(base.candidates || []).filter(rec => !replaced.has(key(rec.spec))), ...fresh.candidates],
    selectionFailures: [...(base.selectionFailures || []).filter(rec => !replaced.has(key(rec))), ...fresh.selectionFailures] };
}

function catalog() {
  const { SA } = evolve.loadGame();
  return { defaults: { population: config.population.size, generations: config.population.generations, games: config.evaluation.quickGames, workers: 4 },
    chapters: SA.CAMPAIGN.map((ch, ci) => ({ chapter: ci, name: ch.name, stages: ch.stages.map((stage, si) => {
      const spec = evolve.stageSpec(SA, ci, si);
      return { stage: si, name: spec.name, budget: spec.budget, status: spec.budgetStatus, modules: spec.availableMods.map(id => SA.MODULES[id]?.name || id) };
    }) })) };
}

async function generate(request, emit = () => {}) {
  config.population.size = integer(request.population, 24, 4, 96, '种群数量');
  config.population.generations = integer(request.generations, 4, 1, 20, '进化代数');
  const games = integer(request.games, 6, 1, 40, '每对局数');
  const workers = integer(request.workers, 4, 1, 12, '并行数');
  const seed = integer(request.seed, 20260929, 1, 2147483647, '种子');
  const scope = request.scope;
  if (!scope || !Number.isInteger(scope.chapter)) throw new Error('请选择要生成的章节');
  const seeds = request.seeds || [];
  if (!Array.isArray(seeds) || seeds.length > 128 || seeds.some(rec => !Array.isArray(rec.cells) || rec.cells.length > 256)) throw new Error('种子车数量或模块清单不合法');
  let base = null;
  if (request.baseReport != null && request.baseReport !== '') {
    if (typeof request.baseReport !== 'string' || !/^out\/evolve-\d+\.json$/.test(request.baseReport)) throw new Error('只能续接本工具的运行报告');
    const filename = path.join(__dirname, request.baseReport);
    if (!fs.existsSync(filename)) throw new Error('原报告已清理，请刷新报告列表后再生成');
    if (fs.statSync(filename).size > storage.REPORT_LIMIT) throw new Error('原报告超过大小限制');
    base = evolve.loadGame().SA.Camp.migrateEvolutionReport(JSON.parse(fs.readFileSync(filename, 'utf8')));
  }
  const references = (base?.chapters || []).flatMap(ch => ch.stages.map(stage => stage.selected).filter(Boolean));
  const fresh = await evolve.runAsync({ scope, games, workers, seed, seeds, references, onProgress: event => emit({ type: 'progress', ...event }) });
  const report = mergeReports(base, fresh);
  const saved = storage.writeReport(report);
  return { file: `out/${path.basename(saved.file)}`, stages: fresh.telemetry.completedStages, candidates: fresh.candidates.length,
    seedWarnings: fresh.seedWarnings, elapsedMs: fresh.telemetry.elapsedMs };
}

async function main() {
  if (process.argv[2] === '--catalog') { console.log(JSON.stringify(catalog())); return; }
  const input = fs.readFileSync(0, 'utf8');
  if (Buffer.byteLength(input) > 2 * 1024 * 1024) throw new Error('请求体超过上限');
  const result = await generate(JSON.parse(input), event => console.log(JSON.stringify(event)));
  console.log(JSON.stringify({ type: 'complete', result }));
}
if (require.main === module) main().catch(error => { console.log(JSON.stringify({ type: 'error', error: error.message })); process.exitCode = 1; });
module.exports = { catalog, generate, mergeReports };
