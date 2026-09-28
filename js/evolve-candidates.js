// 进化筛选车目录接口：把离线报告整理成工作台可以直接消费的章节时间线。
//
// 这里刻意不创建 DOM，也不写入存档或关卡数据。界面层只需要调用
// SA.EvolveCandidates.load() / normalizeReport()，就能取得每一关筛选出的完整
// 模块清单、分数、筛选证据和可还原车辆；这样报告格式变化时只改这一处。
(function exposeEvolveCandidates(root) {
  'use strict';

  const SA = root.SA = root.SA || {};
  const VERSION = '2026-09-27-selected-view-v1';
  const DEFAULT_URL = '../tools/evolve-preview.json';

  // 报告来自文件或网络，先做结构化复制，避免调用方意外改写报告对象。
  function copy(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(copy);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  }

  function integer(value, fallback) {
    return Number.isInteger(value) ? value : fallback;
  }

  function chapterName(chapter, index) {
    return chapter?.name || SA.CAMPAIGN?.[index]?.name || `第 ${index + 1} 章`;
  }

  function stageName(spec, chapterIndex, stageIndex) {
    return spec?.name || SA.CAMPAIGN?.[chapterIndex]?.stages?.[stageIndex]?.name || `第 ${chapterIndex + 1} 章第 ${stageIndex + 1} 关`;
  }

  // 将 [层, 行, 列, 模块 id, 材料, 改装等级] 聚合成构筑摘要。
  // 坐标仍保留在 cells 中，摘要只用于工作台的列表和详情，不参与规则判断。
  function moduleSummary(cells) {
    const groups = new Map();
    for (const cell of Array.isArray(cells) ? cells : []) {
      if (!Array.isArray(cell) || typeof cell[3] !== 'string') continue;
      const [layer, row, col, id] = cell;
      const mt = Number.isFinite(+cell[4]) ? +cell[4] : 1;
      const lv = Number.isFinite(+cell[5]) ? +cell[5] : 0;
      const key = `${layer === 1 ? 'side' : 'body'}:${id}`;
      const item = groups.get(key) || { id, layer: layer === 1 ? 'side' : 'body', count: 0, maxMaterial: 1, maxLevel: 0, cells: [] };
      item.count++;
      item.maxMaterial = Math.max(item.maxMaterial, mt);
      item.maxLevel = Math.max(item.maxLevel, lv);
      item.cells.push({ row, col, material: mt, level: lv });
      groups.set(key, item);
    }
    return [...groups.values()].sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id));
  }

  function normalizeRecord(record, spec) {
    if (!record || typeof record !== 'object') return null;
    const out = copy(record);
    out.spec = copy(spec || record.spec || {});
    out.cells = Array.isArray(record.cells) ? copy(record.cells) : null;
    out.moduleSummary = moduleSummary(out.cells);
    out.moduleCount = out.moduleSummary.reduce((sum, item) => sum + item.count, 0);
    return out;
  }

  function normalizeStage(chapter, chapterIndex, rawStage, stageIndex) {
    const stage = rawStage && typeof rawStage === 'object' ? rawStage : {};
    const spec = copy(stage.spec || {});
    const selected = normalizeRecord(stage.selected, spec);
    return {
      chapter: chapterIndex,
      chapterName: chapterName(chapter, chapterIndex),
      stage: stageIndex,
      stageName: stageName(spec, chapterIndex, stageIndex),
      terrain: spec.terrain || null,
      boss: !!spec.boss,
      rewardModule: spec.rewardModule || null,
      spec,
      selected,
      selection: copy(stage.selection || null),
      candidateCount: Number.isFinite(+stage.count) ? +stage.count : (stage.top?.length || 0),
      top: Array.isArray(stage.top) ? stage.top.map(record => normalizeRecord(record, spec)) : [],
      archive: copy(stage.archive || null),
    };
  }

  // 生成“章节 → 关卡 → 筛选车”的稳定顺序；没有 selected 的关卡也保留，
  // 这样界面能明确显示筛选失败，而不是把章节节奏悄悄压缩掉。
  function normalizeReport(report) {
    if (!report || typeof report !== 'object') throw new TypeError('进化报告必须是对象');
    const rawChapters = Array.isArray(report.chapters) ? report.chapters : [];
    const chapters = rawChapters.map((chapter, chapterIndex) => {
      const ci = integer(chapter?.chapter, chapterIndex);
      const rawStages = Array.isArray(chapter?.stages) ? chapter.stages : [];
      return {
        chapter: ci,
        name: chapterName(chapter, ci),
        stages: rawStages.map((stage, stageIndex) => normalizeStage(chapter, ci, stage, stageIndex)),
      };
    });
    const stages = chapters.flatMap(chapter => chapter.stages);
    return {
      version: VERSION,
      status: report.status || 'complete',
      generatedAt: report.generatedAt || null,
      seed: report.seed ?? null,
      rules: report.rules || null,
      config: copy(report.config || null),
      chapters,
      stages,
      source: report,
    };
  }

  function find(report, chapter, stage) {
    const view = report?.version === VERSION && Array.isArray(report.stages) ? report : normalizeReport(report);
    return view.stages.find(item => item.chapter === chapter && item.stage === stage) || null;
  }

  // 优先使用 cells 还原材料和改装等级；旧报告只有分享码时才退回 decode。
  function vehicle(record, name) {
    if (!record) return null;
    try {
      if (Array.isArray(record.cells) && typeof SA.V?.fromCells === 'function') return SA.V.fromCells(name || record.name || '进化筛选车', record.cells);
      if (record.code && typeof SA.V?.decode === 'function') return SA.V.decode(record.code);
    } catch (_) { /* 报告可能来自旧规则；目录仍可显示原始数据和失败原因。 */ }
    return null;
  }

  async function load(url = DEFAULT_URL) {
    if (typeof fetch !== 'function') throw new Error('当前环境没有 fetch，无法读取进化报告');
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取进化报告失败：HTTP ${response.status}`);
    return normalizeReport(await response.json());
  }

  const api = { VERSION, DEFAULT_URL, copy, moduleSummary, normalizeRecord, normalizeReport, find, vehicle, load };
  SA.EvolveCandidates = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
