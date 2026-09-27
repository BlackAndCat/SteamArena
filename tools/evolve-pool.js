/* 常驻候选评估池：每个 worker 只加载一次规则，并串行处理完整候选批次。 */
'use strict';
const path = require('path');
const { Worker } = require('worker_threads');

function createEvaluationPool(workerCount) {
  if (!Number.isInteger(workerCount) || workerCount < 1) throw new Error('worker 数量必须是正整数');
  const workers = [], queue = [], batches = new Set();
  let nextId = 0, closed = false, failure = null, closing = null;
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
      try { slot.worker.postMessage({ ...slot.pending.task, kind: 'evaluate', id: slot.pending.id }); }
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
      slot.pending = null; job.batch.results[job.index] = message.result;
      if (--job.batch.remaining === 0) { batches.delete(job.batch); job.batch.resolve(job.batch.results); }
      dispatch();
    });
    worker.on('error', error => stop(error));
    worker.on('exit', code => { if (!closed) stop(new Error(`评估 worker 意外退出（${code}）`)); });
  }
  return {
    evaluate(tasks) {
      if (closed) return Promise.reject(failure || new Error('评估池已关闭'));
      if (!tasks.length) return Promise.resolve([]);
      return new Promise((resolve, reject) => {
        const batch = { resolve, reject, remaining: tasks.length, results: new Array(tasks.length) };
        batches.add(batch); tasks.forEach((task, index) => queue.push({ task, index, batch, id: nextId++ })); dispatch();
      });
    },
    close() { return stop(); },
  };
}
module.exports = { createEvaluationPool };
