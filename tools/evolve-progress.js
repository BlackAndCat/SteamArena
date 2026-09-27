'use strict';

/**
 * K8 长跑预演的进度记录器：只记录阶段事件，不保存逐局或逐帧数据。
 * JSONL 日志固定 2 MiB 上限，最近检查点固定 20 MiB 上限并原子覆盖。
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_OUT = path.join(__dirname, 'out');
const LOG_LIMIT = 2 * 1024 * 1024;
const CHECKPOINT_LIMIT = 20 * 1024 * 1024;

function atomicWrite(filename, content) {
  const temporary = `${filename}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  try { fs.renameSync(temporary, filename); }
  catch (error) { try { fs.unlinkSync(temporary); } catch (_) { /* 保留原错误 */ } throw error; }
}

function chineseProgress(event) {
  const chapter = Number.isInteger(event.chapter) ? ` 第${event.chapter + 1}章` : '';
  const stage = Number.isInteger(event.stage) ? ` 第${event.stage + 1}关` : '';
  const generation = Number.isInteger(event.generation) ? ` 第${event.generation + 1}代` : '';
  const count = Number.isFinite(event.completed) && Number.isFinite(event.total) ? ` ${event.completed}/${event.total}` : '';
  return `[进化] ${event.phase || 'progress'}${chapter}${stage}${generation}${count}`;
}

function create(options = {}) {
  const directory = path.resolve(options.directory || DEFAULT_OUT);
  fs.mkdirSync(directory, { recursive: true });
  const logFile = path.join(directory, 'evolve-progress.jsonl'), liveFile = path.join(directory, 'evolve-live.json');
  fs.writeFileSync(logFile, '', 'utf8');
  let logBytes = 0, truncated = false;
  function onProgress(event) {
    if (!event || typeof event !== 'object') return;
    const line = `${JSON.stringify(event)}\n`, bytes = Buffer.byteLength(line, 'utf8');
    if (!truncated && logBytes + bytes > LOG_LIMIT) {
      const marker = `${JSON.stringify({ phase: 'truncated', truncated: true, limitBytes: LOG_LIMIT, elapsedMs: event.elapsedMs })}\n`;
      if (logBytes + Buffer.byteLength(marker, 'utf8') <= LOG_LIMIT) fs.appendFileSync(logFile, marker, 'utf8');
      truncated = true;
    } else if (!truncated) { fs.appendFileSync(logFile, line, 'utf8'); logBytes += bytes; }
    console.log(chineseProgress(event));
  }
  function onCheckpoint(report) {
    const content = JSON.stringify(report, null, 2), bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > CHECKPOINT_LIMIT) throw new Error(`进化检查点超过上限：${bytes} > ${CHECKPOINT_LIMIT} 字节`);
    atomicWrite(liveFile, content);
  }
  return { onProgress, onCheckpoint, files: { logFile, liveFile }, get truncated() { return truncated; } };
}

module.exports = { DEFAULT_OUT, LOG_LIMIT, CHECKPOINT_LIMIT, create };
