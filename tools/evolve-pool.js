/* 常驻进化计算池：每个 worker 只加载一次规则，分担候选评分与独立复测任务。 */
'use strict';
const path = require('path');
const { Worker } = require('worker_threads');

function createEvaluationPool(workerCount, options = {}) {
  if (!Number.isInteger(workerCount) || workerCount < 1) throw new Error('worker 数量必须是正整数');
  const workers = [], queue = [], batches = new Set();
  let nextId = 0, closed = false, failure = null, closing = null;
  const startedAt = Date.now();
  const scheduling = { submittedTasks: 0, completedTasks: 0, peakBusyWorkers: 0, taskOccupiedMs: 0, taskKinds: {}, peakBusyByKind: {} };
  const thermalCounters = { cpuForecastCalls: 0, cacheHits: 0, gpuCacheHits: 0, cpuCacheHits: 0 };
  function stop(error) {
    if (error && !failure) failure = error;
    closed = true;
    for (const batch of batches) batch.reject(failure || new Error('评估池已关闭'));
    batches.clear(); queue.length = 0;
    if (!closing) closing = Promise.all(workers.map(slot => slot.worker.terminate())).then(() => undefined);
    return closing;
  }
  function dispatch() {
    if (closed) return;
    for (const slot of workers) {
      if (slot.pending || !queue.length) continue;
      slot.pending = queue.shift();
      slot.dispatchedAt = Date.now();
      scheduling.peakBusyWorkers = Math.max(scheduling.peakBusyWorkers, workers.filter(item => item.pending).length);
      const kind = slot.pending.task.kind || 'evaluate';
      const busyOfKind = workers.filter(item => item.pending && (item.pending.task.kind || 'evaluate') === kind).length;
      scheduling.peakBusyByKind[kind] = Math.max(scheduling.peakBusyByKind[kind] || 0, busyOfKind);
      try { slot.worker.postMessage({ ...slot.pending.task, kind: slot.pending.task.kind || 'evaluate', id: slot.pending.id }); }
      catch (error) { stop(error); return; }
    }
  }
  for (let i = 0; i < workerCount; i++) {
    let worker;
    try { worker = new Worker(path.join(__dirname, 'evolve-worker.js')); }
    catch (error) { stop(error); throw error; }
    const slot = { worker, pending: null }; workers.push(slot);
    worker.on('message', message => {
      if (closed) return;
      const job = slot.pending;
      if (!job || message.id !== job.id) { stop(new Error('评估 worker 返回了不匹配的任务')); return; }
      if (message.error) { stop(new Error(message.error)); return; }
      scheduling.completedTasks++;
      // 占用时间包含消息传输和 worker 运算，用于调度利用率，不当作 CPU 自耗时。
      scheduling.taskOccupiedMs += Date.now() - slot.dispatchedAt;
      for (const key of Object.keys(thermalCounters)) thermalCounters[key] += message.thermalCounters?.[key] || 0;
      slot.pending = null; job.batch.results[job.index] = message.result;
      if (--job.batch.remaining === 0) { batches.delete(job.batch); job.batch.resolve(job.batch.results); }
      dispatch();
    });
    worker.on('error', error => stop(error));
    worker.on('exit', code => { if (!closed) stop(new Error(`评估 worker 意外退出（${code}）`)); });
  }
  function evaluateRaw(tasks) {
      if (closed) return Promise.reject(failure || new Error('评估池已关闭'));
      if (!tasks.length) return Promise.resolve([]);
      return new Promise((resolve, reject) => {
        const batch = { resolve, reject, remaining: tasks.length, results: new Array(tasks.length) };
        batches.add(batch); tasks.forEach((task, index) => {
          scheduling.submittedTasks++;
          const kind = task.kind || 'evaluate';
          scheduling.taskKinds[kind] = (scheduling.taskKinds[kind] || 0) + 1;
          queue.push({ task, index, batch, id: nextId++ });
        }); dispatch();
      });
  }
  return {
    async evaluate(tasks) {
      if (options.splitFinalDuels === false || !tasks.some(task => task.kind === 'duel')) return evaluateRaw(tasks);
      const expanded = [], groups = tasks.map(task => {
        if (task.kind !== 'duel') { expanded.push(task); return { single: expanded.length - 1 }; }
        const parts = [];
        // 8 个种子对为一包：60 对拆成 7×8＋4，每包最多 16 局。
        for (let start = 0; start < task.games; start += 8) {
          parts.push(expanded.length);
          expanded.push({ ...task, kind: 'duel-part', start, count: Math.min(8, task.games - start) });
        }
        return { parts, games: task.games };
      });
      const rows = await evaluateRaw(expanded);
      const { reduceDuelRows } = require('./evolve');
      return groups.map(group => group.single != null ? rows[group.single] :
        reduceDuelRows(group.parts.flatMap(index => rows[index]), group.games));
    },
    close() { return stop(); },
    thermalSummary() { return { ...thermalCounters }; },
    schedulingSummary() {
      const elapsedMs = Date.now() - startedAt;
      return { ...scheduling, taskKinds: { ...scheduling.taskKinds }, peakBusyByKind: { ...scheduling.peakBusyByKind }, elapsedMs,
        occupancyRatio: scheduling.taskOccupiedMs / Math.max(1, elapsedMs * workerCount) };
    },
  };
}
module.exports = { createEvaluationPool };
