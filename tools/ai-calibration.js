/*
 * 真人对局摘要协议与代理 AI 校准工具。
 *
 * 该文件只处理摘要数据，不参与战斗结算，也不修改任何战斗参数。浏览器端
 * 可以把本文件的核心函数复制到开发工具中使用；Node 端则提供 JSON 导入、
 * 导出和统计命令。每条记录都只保存一局的聚合指标，不保存逐帧数据。
 */
'use strict';

const fs = typeof require === 'function' ? require('fs') : null;

const VERSION = 1;
const STORAGE_KEY = 'steam_arena_human_battles_v1';
const MAX_RECORDS = 200;
const MAX_BYTES = 1024 * 1024;

function utf8Bytes(text) {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return unescape(encodeURIComponent(text)).length;
}

const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** 将战斗结束回调中的数据压缩为稳定的真人对局摘要。 */
function createSummary(input = {}) {
  const p = input.player || input.p || {};
  const events = p.events || {};
  const metrics = p.metrics || input.metrics || {};
  const shots = number(events.fire || input.shots);
  const hits = number(events.hit || input.hits);
  const charged = number(events.chargedHit || input.chargedHits);
  const maxHeat = number(events.maxHeat || input.maxHeat);
  const minWater = number(events.minWater || input.minWater);
  const duration = number(input.time || input.t);
  return {
    version: VERSION,
    id: String(input.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    at: input.at || new Date().toISOString(),
    stage: input.stage == null ? null : String(input.stage),
    terrain: input.terrain || 'flat',
    outcome: input.outcome || input.winner || 'draw',
    time: duration,
    hitRate: number(input.hitRate, shots ? hits / shots : 0),
    chargedRate: number(input.chargedRate, shots ? charged / shots : 0),
    shots,
    hits,
    chargedHits: charged,
    closeRate: number(input.closeRate, metrics.nearTime && duration ? metrics.nearTime / duration : 0),
    farRate: number(input.farRate, metrics.farTime && duration ? metrics.farTime / duration : 0),
    noEngageRate: number(input.noEngageRate, metrics.noEngageTime && duration ? metrics.noEngageTime / duration : 0),
    maxHeat,
    minWater,
    damageDealt: number(input.damageDealt || input.pDealt),
    damageTaken: number(input.damageTaken || input.pTaken),
    feedback: input.feedback || null,
  };
}

function cleanRecords(records) {
  const list = Array.isArray(records) ? records.map(createSummary) : [];
  list.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const kept = list.slice(-MAX_RECORDS);
  while (utf8Bytes(JSON.stringify(kept)) > MAX_BYTES && kept.length) kept.shift();
  return kept;
}

/** 读写 localStorage 的小适配器；Node 端传入 Map 或普通对象即可测试。 */
function loadStorage(storage) {
  try {
    const raw = storage && typeof storage.getItem === 'function' ? storage.getItem(STORAGE_KEY) : storage && storage[STORAGE_KEY];
    const parsed = raw ? JSON.parse(raw) : [];
    return cleanRecords(parsed.records || parsed);
  } catch (_) { return []; }
}

function saveStorage(storage, records) {
  const payload = JSON.stringify({ version: VERSION, records: cleanRecords(records) });
  if (storage && typeof storage.setItem === 'function') storage.setItem(STORAGE_KEY, payload);
  else if (storage) storage[STORAGE_KEY] = payload;
  return payload;
}

function appendRecord(storage, record) {
  const records = loadStorage(storage);
  records.push(createSummary(record));
  saveStorage(storage, records);
  return records[records.length - 1];
}

function aggregate(records) {
  const rows = cleanRecords(records);
  const avg = key => rows.length ? rows.reduce((sum, row) => sum + number(row[key]), 0) / rows.length : 0;
  const outcomes = rows.reduce((all, row) => { const k = row.outcome || 'draw'; all[k] = (all[k] || 0) + 1; return all; }, {});
  return {
    count: rows.length, outcomes,
    hitRate: avg('hitRate'), chargedRate: avg('chargedRate'), closeRate: avg('closeRate'),
    farRate: avg('farRate'), noEngageRate: avg('noEngageRate'), time: avg('time'),
    maxHeat: avg('maxHeat'), minWater: avg('minWater'), damageDealt: avg('damageDealt'),
    damageTaken: avg('damageTaken'), feedback: rows.reduce((all, row) => { if (row.feedback) all[row.feedback] = (all[row.feedback] || 0) + 1; return all; }, {}),
  };
}

/** 比较真人与代理的摘要分布，输出调参方向；不直接写入游戏配置。 */
function calibrate(humanRecords, aiRecords = []) {
  const human = aggregate(humanRecords);
  const ai = aggregate(aiRecords);
  const delta = key => human[key] - ai[key];
  const aim = Math.max(0.2, Math.min(0.99, 0.8 + delta('hitRate') * 0.8));
  const retargetFactor = Math.max(0.5, Math.min(1.5, 1 - delta('time') / 120));
  const heatHoldHigh = Math.max(55, Math.min(90, 72 + (human.maxHeat - ai.maxHeat) * 0.25));
  const heatHoldLow = Math.max(30, Math.min(65, 45 + (human.maxHeat - ai.maxHeat) * 0.15));
  return {
    sampleCount: { human: human.count, ai: ai.count },
    human,
    ai,
    difference: { hitRate: delta('hitRate'), chargedRate: delta('chargedRate'), closeRate: delta('closeRate'), time: delta('time'), maxHeat: delta('maxHeat') },
    aiProfile: { aim, retargetFactor, heatHoldHigh, heatHoldLow },
    suggestions: {
      aim: delta('hitRate') > 0.05 ? '提高代理瞄准能力' : delta('hitRate') < -0.05 ? '降低代理瞄准能力' : '瞄准命中率接近',
      engagement: delta('closeRate') > 0.1 ? '代理需要更积极接近' : delta('closeRate') < -0.1 ? '代理需要增加交战距离' : '交战距离接近',
      pacing: Math.abs(delta('time')) > 8 ? (delta('time') > 0 ? '真人对局更长，检查代理开火节奏' : '代理对局更长，检查其反应和开火节奏') : '对局时长接近',
      heat: Math.abs(delta('maxHeat')) > 10 ? (delta('maxHeat') > 0 ? '真人热量更高，检查代理热量控制' : '代理热量更高，检查其热量控制') : '热量峰值接近',
      note: 'aiProfile 可传给 SA.Battle.simulate 复测；工具只输出校准建议，不直接改写战斗规则或持久化配置。',
    },
  };
}

/** 固定摘要夹具：相同样本校准后差异必须为零，防止导入/归一化破坏统计。 */
function selfCheck() {
  const fixture = cleanRecords(Array.from({ length: 12 }, (_, i) => ({ at: `2026-09-26T00:${String(i).padStart(2, '0')}:00Z`, outcome: 'p', time: 40 + i % 3, shots: 10, hits: 6, chargedHits: 2, closeRate: 0.4, maxHeat: 55 })));
  const result = calibrate(fixture, fixture);
  const maxDifference = Math.max(...Object.values(result.difference).map(value => Math.abs(value)));
  if (maxDifference !== 0) throw new Error(`AI 校准自测差异不为零：${maxDifference}`);
  return { pass: true, records: fixture.length, maxDifference, aiProfile: result.aiProfile };
}

function readJson(path) { if (!fs) throw new Error('浏览器端不能直接读取文件，请先通过文件选择器传入 JSON'); return JSON.parse(fs.readFileSync(path, 'utf8')); }
function recordsFromJson(value) { return cleanRecords(value.records || value); }
function writeJson(path, value) { if (!fs) throw new Error('浏览器端不能直接写文件，请把返回的 JSON 交给下载器'); fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

function main(argv) {
  const args = argv.slice(2);
  const index = flag => args.indexOf(flag);
  const fileAt = flag => { const i = index(flag); return i >= 0 ? args[i + 1] : null; };
  const input = fileAt('--stats') || fileAt('--calibrate') || fileAt('--merge') || fileAt('--import') || fileAt('--export');
  if (args.includes('--self-check')) { console.log(JSON.stringify(selfCheck(), null, 2)); return; }
  if (!input) throw new Error('用法：node tools/ai-calibration.js --stats input.json；--calibrate 真人.json --ai 代理.json；--import input.json --out normalized.json；--export input.json --out export.json；--merge a.json b.json --out merged.json；--self-check');
  let rows = recordsFromJson(readJson(input));
  if (index('--merge') >= 0) rows = cleanRecords(rows.concat(recordsFromJson(readJson(args[index('--merge') + 2]))));
  if (index('--stats') >= 0) console.log(JSON.stringify(aggregate(rows), null, 2));
  if (index('--calibrate') >= 0) {
    const aiFile = fileAt('--ai');
    if (!aiFile) throw new Error('--calibrate 需要 --ai 代理对局摘要 JSON');
    const result = calibrate(rows, recordsFromJson(readJson(aiFile)));
    const out = fileAt('--out');
    if (out) writeJson(out, result); else console.log(JSON.stringify(result, null, 2));
  }
  if (index('--merge') >= 0) { const out = fileAt('--out'); if (!out) throw new Error('--merge 需要 --out'); writeJson(out, { version: VERSION, records: rows }); }
  if (index('--import') >= 0 || index('--export') >= 0) {
    const out = fileAt('--out');
    if (!out) throw new Error('--import / --export 需要 --out');
    writeJson(out, { version: VERSION, records: rows });
  }
}

if (typeof require === 'function' && require.main === module) {
  try { main(process.argv); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

const api = { VERSION, STORAGE_KEY, MAX_RECORDS, MAX_BYTES, createSummary, cleanRecords, loadStorage, saveStorage, appendRecord, aggregate, calibrate, selfCheck, recordsFromJson };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.SA_HUMAN_CALIBRATION = api;
