/* 进化生成器的并行 worker：各自加载规则并串行模拟，避免跨线程共享可变战斗状态。 */
'use strict';

const { parentPort } = require('worker_threads');
const evolve = require('./evolve');
const config = require('./evolve-config');

const { SA } = evolve.loadGame();

parentPort.on('message', task => {
  try {
    // 主线程传入 f32 近似或已认证预测，并保留来源；未命中仍执行原 CPU 精确路径。
    if (task.thermalPredictions) SA.V.installThermalPredictions(task.thermalPredictions);
    if (task.kind === 'ready') { parentPort.postMessage({ id: task.id, result: true }); return; }
    if (task.kind === 'evaluate') {
      config.performance = task.performance;
      const before = SA.V.thermalSummary();
      const result = evolve.evaluateCandidate(SA, task.vehicle, task.opponents, task.spec, task.seed, task.games);
      const after = SA.V.thermalSummary();
      parentPort.postMessage({ id: task.id, result, thermalCounters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) });
      return;
    }
    if (task.kind === 'duel') {
      // 供对照测试保留旧整包任务；正式最终复测在 pool 拆分为 duel-part。
      const before = SA.V.thermalSummary();
      const result = evolve.duel(SA, task.candidate, task.opponent, task.spec, task.seed, task.games);
      const after = SA.V.thermalSummary();
      parentPort.postMessage({ id: task.id, result, thermalCounters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) });
      return;
    }
    if (task.kind === 'duel-part') {
      const before = SA.V.thermalSummary();
      const result = evolve.duelRows(SA, task.candidate, task.opponent, task.spec, task.seed, task.start, task.count);
      const after = SA.V.thermalSummary();
      parentPort.postMessage({ id: task.id, result, thermalCounters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) });
      return;
    }
    const p = SA.V.decode(task.p), e = SA.V.decode(task.e);
    if (!p || !e) throw new Error('worker 无法解码候选车');
    const result = SA.Battle.simulate({ ...task.options, p, e });
    parentPort.postMessage({ id: task.id, result });
  } catch (error) {
    parentPort.postMessage({ id: task.id, error: error.message });
  }
});
