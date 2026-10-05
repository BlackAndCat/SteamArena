'use strict';

// 用真实 worker 事件验证整章、跨代、种子扩容和中途停止的总步数，不写任何报告文件。
const assert = require('assert');
const evolve = require('./evolve');
const config = require('./evolve-config');
const fs = require('fs');
const vm = require('vm');
const service = require('./evolve-service');
const storage = require('./evolve-storage');

/** 不启动实战，复现首关失败被服务及页面误报完成，并覆盖旧任务恢复。 */
async function checkServiceCompletion() {
  const originalRun = evolve.runAsync, originalWrite = storage.writeReport, before = { ...config.population };
  const fresh = status => ({ status, chapters: [{ chapter: 0, stages: [{ spec: { chapter: 0, stage: 1 }, selected: null,
    selection: { target: [0.6, 0.75], verified: [{ previousWinRate: 0 }, { previousWinRate: 1 / 120 }] } }] }],
    candidates: Array(8).fill({}), selectionFailures: status === 'failed' ? [{ chapter: 0, stage: 1, name: '测试关', failed: ['target'] }] : [],
    telemetry: { completedStages: 1, completedSteps: status === 'complete' ? 292 : 146, totalSteps: 292 } });
  const request = { scope: { chapter: 0, stage: 1 }, gpu: false };
  try {
    storage.writeReport = () => ({ file: 'evolve-123.json' });
    for (const status of ['complete', 'failed', 'interrupted']) {
      evolve.runAsync = async () => fresh(status);
      const result = await service.generate(request);
      assert.strictEqual(result.status, status, '服务丢失路线状态');
      assert.strictEqual(result.completedSteps, status === 'complete' ? 293 : 147);
      assert.strictEqual(result.totalSteps, 293);
      assert.deepStrictEqual(result.selectionFailures.map(row => row.failed), fresh(status).selectionFailures.map(row => row.failed));
      if (status === 'failed') assert.strictEqual(result.selectionFailures[0].bestWinRate, 1 / 120);
    }
    // 新语义：首关未达标仍完成后续关，全部运行结束与各关筛选结果分别保存。
    const warningReport = fresh('complete');
    warningReport.selectionFailures = fresh('failed').selectionFailures;
    warningReport.telemetry.completedStages = 2;
    warningReport.chapters[0].stages.push({ spec: { chapter: 0, stage: 2 }, selected: {}, selection: { previousProvisional: true } });
    warningReport.chapters[0].stages[0].provisional = { name: '临时参考', code: 'diagnostic' };
    evolve.runAsync = async () => warningReport;
    const warningResult = await service.generate({ ...request, scope: { type: 'route-after', origin: { chapter: 0, stage: 0 }, count: 2 } });
    assert.strictEqual(warningResult.status, 'complete');
    assert.strictEqual(warningResult.stages, 2);
    assert.strictEqual(warningResult.plannedStages, 2);
    assert.strictEqual(warningResult.selectionFailures.length, 1);
    storage.writeReport = () => { throw new Error('报告落盘异常'); };
    await assert.rejects(service.generate(request), /报告落盘异常/);
    const source = fs.readFileSync(require.resolve('./evolve-report.js'), 'utf8');
    const functions = source.slice(source.indexOf('  async function completedJobResult('), source.indexOf('  async function pollJob('));
    const fetched = [];
    const legacyReport = fresh('failed');
    legacyReport.chapters[0].stages.push({ spec: { chapter: 0, stage: 2 } });
    legacyReport.selectionFailures.push({ chapter: 0, stage: 2, name: '续接的旧失败', failed: ['reward'] });
    const context = { fetch: async file => { fetched.push(file); return { ok: true, json: async () => legacyReport }; },
      duration: () => '1 分', overallProgress: p => `${p.completedSteps}/${p.totalSteps}`, chapterShort: () => '序章',
      COND: { target: '对上一关胜率' }, targetText: range => range.join('～'), config: {}, Number };
    vm.createContext(context); vm.runInContext(functions, context);
    const old = { status: 'complete', result: { file: 'out/evolve-123.json', completedSteps: 147, totalSteps: 293, stages: 1, candidates: 8 },
      request: { scope: { type: 'route-after', origin: { chapter: 0, stage: 0 }, count: 2 } } };
    const recovered = await context.completedJobResult(old);
    assert.strictEqual(recovered.selectionFailures.length, 1, '不能把续接报告的其他旧失败算进本轮');
    assert.deepStrictEqual(fetched, ['out/evolve-123.json'], '只能恢复任务对应报告，不能借用当前所选报告');
    const text = context.completedJobText(old, recovered);
    assert(text.startsWith('生成失败：'), text);
    assert(text.includes('测试关') && text.includes('对上一关胜率') && text.includes('146 步') && text.includes('1 关未运行'), text);
    assert(text.includes('目标 60%～75%，当前最佳 0.8%'), text);
    assert(!text.includes('预计剩余') && text.includes('147/293'), text);
    // 终态触发局部换行样式；运行中仍保持原有单行进度，不改全站布局。
    const elements = { '#generation-status': { textContent: text }, '#stop-generation': { disabled: true },
      '#gen': { classList: { toggle() {} }, dataset: {} }, '#gen-meter': { firstElementChild: { style: {} } } };
    context.$ = selector => elements[selector];
    vm.runInContext(source.slice(source.indexOf('  function syncMeter()'), source.indexOf('  new MutationObserver(syncMeter)')), context);
    context.syncMeter();
    assert.strictEqual(elements['#gen'].dataset.end, 'failed');
    const html = fs.readFileSync(require.resolve('./evolve.html'), 'utf8');
    assert(/\.gen\[data-end="failed"\] \.gen-state[^\{]*\{[^}]*flex-basis: 100%/.test(html));
    assert(/\.gen\[data-end="warn"\] #generation-status \{[^}]*overflow: visible; white-space: normal/.test(html));
    const warningText = context.completedJobText(old, warningResult);
    assert(warningText.startsWith('模拟完成，1 关未达标（候选已保留）'), warningText);
    assert(warningText.includes('全部目标关已处理') && warningText.includes('测试关') && warningText.includes('当前最佳 0.8%'), warningText);
    assert(!warningText.includes('未运行') && !warningText.includes('生成失败') && !warningText.includes('预计剩余'), warningText);
    elements['#generation-status'].textContent = warningText;
    context.syncMeter();
    assert.strictEqual(elements['#gen'].dataset.end, 'warn');
    elements['#stop-generation'].disabled = false;
    context.syncMeter();
    assert.strictEqual(elements['#gen'].dataset.end, '', '运行中不得套用终态诊断换行');
    elements['#stop-generation'].disabled = true;
    elements['#generation-status'].textContent = '生成完成：总进度 147 / 293 步（50%）';
    context.syncMeter();
    assert.strictEqual(elements['#gen-meter'].firstElementChild.style.width, '50%', '提前达标不得把实际进度条填成 100%');
    const stopped = context.completedJobText(old, { ...recovered, status: 'interrupted' });
    assert(stopped.startsWith('已停止生成：') && stopped.includes('仍有 1 关未完成') && !stopped.includes('关未运行'), stopped);
    assert(context.completedJobText(old, { ...recovered, status: 'complete', selectionFailures: [], completedSteps: 293 }).startsWith('生成完成：'));
    const early = context.completedJobText(old, { ...recovered, status: 'complete', selectionFailures: [] });
    assert(early.includes('全部目标关已处理') && early.includes('提前达标') && early.includes('147/293'), early);
    context.fetch = async () => ({ ok: false });
    await assert.rejects(context.completedJobResult(old), /对应报告暂时无法读取/);
    return { routeStatus: true, completedWithUnmetStages: true, legacyJob: true, savedFailure: true, writeError: true };
  } finally { evolve.runAsync = originalRun; storage.writeReport = originalWrite; Object.assign(config.population, before); }
}

/** 总数是含追加代的最大计划工作量；进度从零开始且单调，达标可以提前结束。 */
function checkEvents(events, total, complete) {
  assert.strictEqual(events[0].completedSteps, 0);
  events.forEach((event, i) => {
    assert.strictEqual(event.totalSteps, total, '运行中总步数变化');
    assert(event.completedSteps >= (events[i - 1]?.completedSteps || 0), '跨阶段进度回退');
    assert(event.completedSteps <= total, '完成步数超出总数');
  });
  assert.strictEqual(events.at(-1).phase, complete ? 'complete' : 'interrupted');
  if (!complete) assert(events.at(-1).completedSteps < total, '停止后错误标记已完成');
}

async function run() {
  const before = { ...config.population }, { SA } = evolve.loadGame();
  try {
    Object.assign(config.population, { size: 4, generations: 2 });
    const spec = evolve.stageSpec(SA, 0, 1), seeds = [], keys = new Set();
    for (let i = 1; seeds.length < 5 && i < 100; i++) {
      const vehicle = evolve.randomVehicle(SA, spec, new evolve.RNG(i), 'plate');
      const cells = SA.StageCars.cellsOf(vehicle), key = JSON.stringify(cells);
      if (!keys.has(key)) { seeds.push({ spec, name: `进度种子${i}`, cells }); keys.add(key); }
    }
    assert.strictEqual(seeds.length, 5);
    const invalid = { spec, name: '非法种子', cells: [[0, 0, 0, 'missing_module', 1, 0]] };
    const events = [];
    const report = await evolve.runAsync({ scope: { chapter: 0 }, workers: 2, games: 1, seed: 774411,
      seeds: [...seeds, seeds[0], invalid], onProgress: event => events.push(event) });
    // 计划包含追加代；实际代数由独立验收和多样性共同决定，不能假定基础代结束。
    checkEvents(events, 3 * 4 * (2 + config.population.maxExtraGenerations) + 3 * 2, true);
    const candidates = events.filter(event => event.phase === 'candidate');
    const stageEnds = events.filter(event => event.phase === 'stage-end');
    const selectionEnds = events.filter(event => event.phase === 'selection-end');
    assert.strictEqual(report.telemetry.completedCandidates, candidates.length, '实测候选事件与遥测不一致');
    assert.strictEqual(report.telemetry.completedSteps, candidates.length + stageEnds.length + selectionEnds.length, '整理步骤未按实际事件计数');
    assert(report.seedWarnings.some(row => row.name === '非法种子' && row.reason.includes('无效模块')), '非法种子缺少诊断');
    assert.strictEqual(stageEnds.length, 3);
    assert.strictEqual(selectionEnds.length, 3);
    assert.strictEqual(report.telemetry.completedStages, 3);
    const generationStarts = events.filter(event => event.phase === 'generation-start');
    const generationEnds = events.filter(event => event.phase === 'generation-end');
    assert.strictEqual(generationEnds.length, generationStarts.length);
    for (const start of generationStarts) {
      const sameGeneration = event => event.chapter === start.chapter && event.stage === start.stage && event.generation === start.generation;
      const evaluated = candidates.filter(sameGeneration), end = generationEnds.find(sameGeneration);
      assert(end, '开始的代缺少结束事件');
      assert.strictEqual(evaluated.length, start.total, '本代候选数与开始事件不一致');
      assert.strictEqual(end.total, start.total);
      assert.strictEqual(end.completed, evaluated.length);
      assert.strictEqual(new Set(evaluated.map(event => event.index)).size, evaluated.length, '本代候选重复计数');
    }
    for (const stage of stageEnds) {
      const generations = generationStarts.filter(event => event.chapter === stage.chapter && event.stage === stage.stage).length;
      assert(generations >= config.population.generations && generations <= config.population.generations + config.population.maxExtraGenerations);
    }
    const extraGenerations = await require('./evolve-extra-generations-check').run();

    let stop = false;
    const interrupted = [];
    await evolve.runAsync({ scope: { chapter: 0, stage: 0 }, workers: 2, games: 1, seed: 774411,
      shouldStop: () => stop, onProgress: event => { interrupted.push(event); if (event.phase === 'generation-end') stop = true; } });
    checkEvents(interrupted, 4 * (2 + config.population.maxExtraGenerations) + 2, false);
    const completion = await checkServiceCompletion();
    const continuation = await require('./evolve-route-continuation-check').run();
    return { completedSteps: report.telemetry.completedSteps, candidates: candidates.length, generationEvents: true,
      monotonic: true, stoppedIncomplete: true, extraGenerations, completion, continuation };
  } finally { Object.assign(config.population, before); }
}
if (require.main === module) (process.argv.includes('--service-only') ? checkServiceCompletion() : run()).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run, checkServiceCompletion };
