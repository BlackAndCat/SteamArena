'use strict';

/**
 * 进化工具的文件存储边界。
 *
 * 运行报告只用于本机复现，候选库才是可以进入仓库的精简数据。这个模块
 * 不参与搜索和战斗计算，专门把大小、保留数量和删除范围限制在 §12 规定内。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(__dirname, 'out');
const DEFAULT_CANDIDATES = path.join(__dirname, 'evolve-candidates.json');
const REPORT_LIMIT = 20 * 1024 * 1024;
const OUT_LIMIT = 100 * 1024 * 1024;
const CANDIDATE_LIMIT = 1024 * 1024;
const KEEP_REPORTS = 3;
const REPORT_NAME = /^evolve-\d+\.json$/;

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return path.resolve(directory);
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value, null, 2), 'utf8');
}

function assertSize(label, bytes, limit) {
  if (bytes > limit) throw new Error(`${label} 超过上限：${bytes} > ${limit} 字节`);
}

function ownReportFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && REPORT_NAME.test(entry.name))
    .map(entry => {
      const filename = path.join(directory, entry.name);
      const stat = fs.statSync(filename);
      return { filename, name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
}

function directoryBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .reduce((sum, entry) => sum + fs.statSync(path.join(directory, entry.name)).size, 0);
}

function safeOwnReportPath(directory, filename) {
  // 只允许删除当前目录中形如 evolve-数字.json 的文件，拒绝路径穿越和链接目标。
  if (!REPORT_NAME.test(filename)) throw new Error(`拒绝处理非本工具报告文件：${filename}`);
  const base = path.resolve(directory);
  const target = path.resolve(base, filename);
  if (path.dirname(target) !== base || path.relative(base, target).startsWith('..')) {
    throw new Error(`拒绝处理目录外文件：${filename}`);
  }
  return target;
}

/** 清理报告：保留最近三份，并在可安全删除时把自有文件总量压到 100 MB。 */
function cleanupReports(directory = DEFAULT_OUT) {
  const base = ensureDirectory(directory);
  let files = ownReportFiles(base);
  for (const old of files.slice(KEEP_REPORTS)) {
    fs.unlinkSync(safeOwnReportPath(base, old.name));
  }
  files = ownReportFiles(base);
  let total = directoryBytes(base);
  // 若历史报告仍使目录超限，只继续删除更旧的本工具报告；前三份始终保留。
  for (let i = files.length - 1; total > OUT_LIMIT && i >= KEEP_REPORTS; i--) {
    const old = files[i];
    fs.unlinkSync(safeOwnReportPath(base, old.name));
    total -= old.size;
  }
  if (total > OUT_LIMIT) throw new Error(`tools/out 总量超过上限且不能删除非本工具文件：${total} 字节`);
  return { kept: ownReportFiles(base).map(file => file.name), bytes: total };
}

function atomicWrite(filename, content) {
  const directory = path.dirname(filename);
  const temporary = path.join(directory, `.evolve-write-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(temporary, filename);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* 保留原始错误 */ }
    throw error;
  }
}

function nextReportFilename(directory) {
  let stamp = Date.now();
  let filename = `evolve-${stamp}.json`;
  while (fs.existsSync(path.join(directory, filename))) filename = `evolve-${++stamp}.json`;
  return filename;
}

/** 写入单次报告；第二参数仅供测试或显式指定目录，默认使用 tools/out。 */
function writeReport(report, destination = DEFAULT_OUT) {
  const directory = ensureDirectory(destination);
  const content = JSON.stringify(report, null, 2);
  const bytes = Buffer.byteLength(content, 'utf8');
  assertSize('进化运行报告', bytes, REPORT_LIMIT);
  const filename = nextReportFilename(directory);
  atomicWrite(safeOwnReportPath(directory, filename), content);
  const cleanup = cleanupReports(directory);
  return { file: path.join(directory, filename), bytes, ...cleanup };
}

function candidateRows(report) {
  return (report && Array.isArray(report.candidates) ? report.candidates : []).map(candidate => ({
    code: candidate.code,
    tags: {
      style: candidate.style,
      chassis: candidate.chassis,
      terrain: candidate.spec && candidate.spec.terrain,
      chapter: candidate.spec && candidate.spec.chapter,
      stage: candidate.spec && candidate.spec.stage
    },
    scores: { strength: candidate.strength, performance: candidate.performance },
    rules: candidate.rules || report.rules
  }));
}

/** 写入可入库的候选库，只输出分享码、标签、分数和规则指纹。 */
function writeCandidates(report, destination = DEFAULT_CANDIDATES) {
  const rows = candidateRows(report);
  const data = { generatedAt: report && report.generatedAt, rules: report && report.rules, candidates: rows };
  const content = JSON.stringify(data, null, 2);
  const bytes = Buffer.byteLength(content, 'utf8');
  assertSize('候选库', bytes, CANDIDATE_LIMIT);
  const filename = path.resolve(destination);
  ensureDirectory(path.dirname(filename));
  atomicWrite(filename, content);
  return { file: filename, bytes, candidates: rows.length };
}

module.exports = {
  DEFAULT_OUT,
  DEFAULT_CANDIDATES,
  REPORT_LIMIT,
  OUT_LIMIT,
  CANDIDATE_LIMIT,
  cleanupReports,
  writeReport,
  writeCandidates
};
