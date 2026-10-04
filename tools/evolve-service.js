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
  const route = evolve.plannedRoute(SA);
  const rows = route.map(({ chapter, stage, entry }) => {
    let spec = null, error = null;
    try { spec = evolve.previewStageSpec(SA, chapter, stage); }
    catch (caught) {
      if (caught.code !== 'EVOLVE_STAGE_CONFIG_MISSING') throw caught;
      error = caught.message;
    }
    const actual = evolve.stageFor(SA, chapter, stage);
    return { chapter, stage, name: spec?.name || actual?.name || entry.car,
      hasVehicle: !!actual?.vehicle, spec, error };
  });
  return { defaults: { population: config.population.size, generations: config.population.generations, games: config.evaluation.quickGames, workers: config.defaultWorkers },
    chapters: SA.CAMPAIGN.map((ch, ci) => ({ chapter: ci, name: ch.name, stages: rows.flatMap((row, index) => {
      if (row.chapter !== ci || !row.spec) return [];
      // 路线只能从已配置关连续向后生成，不能跨过未配置关延伸数量上限。
      let maxAfter = 0;
      while (rows[index + maxAfter + 1]?.spec) maxAfter++;
      return [{ stage: row.stage, name: row.name, budget: row.spec.budget, status: row.spec.budgetStatus,
        previewRuleSource: row.spec.previewRuleSource || null, hasVehicle: row.hasVehicle, maxAfter,
        modules: row.spec.availableMods.map(id => SA.MODULES[id]?.name || id) }];
    }) })).filter(ch => ch.stages.length),
    unavailableStages: rows.filter(row => !row.spec).map(({ chapter, stage, name, error }) => ({ chapter, stage, name, error })) };
}

async function generate(request, emit = () => {}) {
  const startedAt = Date.now();
  config.population.size = integer(request.population, 24, 4, 96, '种群数量');
  config.population.generations = integer(request.generations, 4, 1, 20, '进化代数');
  const games = integer(request.games, 6, 1, 40, '每对局数');
  const workers = integer(request.workers, config.defaultWorkers, 1, config.maxWorkers, '并行数');
  const seed = integer(request.seed, 20260929, 1, 2147483647, '种子');
  const scope = request.scope;
  if (!scope || scope.type !== 'route-after' && (scope.type != null || !Number.isInteger(scope.chapter))) throw new Error('请选择要生成的章节');
  const { SA } = evolve.loadGame();
  if (scope.type === 'route-after') evolve.routeAfter(SA, scope.origin, scope.count);
  const seeds = request.seeds || [];
  if (!Array.isArray(seeds) || seeds.length > 128 || seeds.some(rec => !Array.isArray(rec.cells) || rec.cells.length > 256)) throw new Error('种子车数量或模块清单不合法');
  const originVehicle = request.originVehicle;
  if (originVehicle != null && (!originVehicle || typeof originVehicle !== 'object' || !Array.isArray(originVehicle.cells) || !originVehicle.cells.length || originVehicle.cells.length > 256))
    throw new Error('原点车辆模块清单不合法');
  if (scope.type === 'route-after' && !originVehicle && !evolve.stageFor(SA, scope.origin.chapter, scope.origin.stage)?.vehicle)
    throw new Error('原点没有关卡车；请先保存原点车辆');
  let base = null;
  if (request.baseReport != null && request.baseReport !== '') {
    if (typeof request.baseReport !== 'string' || !/^out\/evolve-\d+\.json$/.test(request.baseReport)) throw new Error('只能续接本工具的运行报告');
    const filename = path.join(__dirname, request.baseReport);
    if (!fs.existsSync(filename)) throw new Error('原报告已清理，请刷新报告列表后再生成');
    if (fs.statSync(filename).size > storage.REPORT_LIMIT) throw new Error('原报告超过大小限制');
    base = evolve.loadGame().SA.Camp.migrateEvolutionReport(JSON.parse(fs.readFileSync(filename, 'utf8')));
  }
  const references = (base?.chapters || []).flatMap(ch => ch.stages.map(stage => stage.selected).filter(Boolean));
  // 总步骤保留最后的报告落盘，评估和筛选结束时不会提前显示 100%。
  const fresh = await evolve.runAsync({ scope, originVehicle, games, workers, seed, seeds, references, gpu: request.gpu !== false,
    onProgress: event => emit({ type: 'progress', ...event, totalSteps: event.totalSteps + 1 }) });
  const report = mergeReports(base, fresh);
  const saved = storage.writeReport(report);
  return { file: `out/${path.basename(saved.file)}`, stages: fresh.telemetry.completedStages, candidates: fresh.candidates.length,
    seedWarnings: fresh.seedWarnings, elapsedMs: Date.now() - startedAt,
    completedSteps: fresh.telemetry.completedSteps + 1, totalSteps: fresh.telemetry.totalSteps + 1 };
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
