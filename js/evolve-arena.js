// 进化擂台的本机候选库：与正式关卡、设计存档和临时运行报告分别保存。
// 收藏保存原始构筑，手工编辑后清除旧战绩；只有重新实测才能恢复分数。
(() => {
  'use strict';
  const KEY = 'steam_arena_evolve_arena_v1', LIMIT = 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  function read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('进化擂台候选库格式不正确，请先导出备份');
    if ((data.campaignLayout || 1) < SA.CAMPAIGN_LAYOUT) for (const row of data.records) {
      const sp = row.record?.spec;
      if (sp) sp.stage = SA.Camp.migrateStageIndex(sp.chapter, sp.stage, data.campaignLayout);
      if (row.parentKey) {
        const parent = JSON.parse(row.parentKey);
        parent[1] = SA.Camp.migrateStageIndex(parent[0], parent[1], data.campaignLayout);
        row.parentKey = JSON.stringify(parent);
      }
    }
    return data.records;
  }
  function write(records) {
    const raw = JSON.stringify({ version: 1, campaignLayout: SA.CAMPAIGN_LAYOUT, records });
    if (new TextEncoder().encode(raw).length > LIMIT) throw new Error('进化擂台候选库已超过 1 MB，请先取消不需要的收藏');
    localStorage.setItem(KEY, raw);
    window.dispatchEvent(new Event('evolve-arena-change'));
  }
  // 分享码不包含材料和改装等级，因此用完整模块清单识别同一台车。
  function key(rec) {
    const cells = rec.cells?.map(row => [...row]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify([rec.spec?.chapter, rec.spec?.stage, cells || rec.code]);
  }
  function find(rec) { const k = key(rec); return read().find(row => key(row.record) === k); }
  function get(id) { return read().find(row => row.id === id) || null; }
  // 收藏与手工草稿可以继续保留；按当前关卡定义检查奖励，不能借旧报告规格绕过要求。
  function missingReward(rec) {
    const sp = rec.spec || {}, stage = SA.CAMPAIGN[sp.chapter]?.stages[sp.stage];
    const reward = stage ? stage.spec?.reward : sp.rewardModule;
    return reward && !rec.cells?.some(cell => cell[3] === reward) ? reward : null;
  }
  function remember(rec, changes = {}) {
    const records = read(), existing = records.find(row => key(row.record) === key(rec));
    const row = existing || { id: crypto.randomUUID(), record: clone(rec), favorite: false, manual: false, participate: true, parentKey: key(rec) };
    Object.assign(row, changes, { updatedAt: new Date().toISOString() });
    if (!existing) records.push(row);
    // 仅清理没有收藏也没有手工保存的跳转草稿；受保护的车绝不滚动删除。
    const drafts = records.filter(item => !item.favorite && !item.manual).slice(-20);
    write(records.filter(item => item.favorite || item.manual || drafts.includes(item)));
    return row;
  }
  function update(id, changes) {
    const records = read(), row = records.find(item => item.id === id);
    if (!row) throw new Error('候选车已不存在，请从报告重新打开');
    Object.assign(row, changes, { updatedAt: new Date().toISOString() });
    write(records); return row;
  }
  function saveEdited(id, vehicle, meta) {
    const stats = SA.V.stats(vehicle);
    if (!stats.canDeploy) throw new Error((stats.problems || ['车辆不能出战']).join('；'));
    const cells = [];
    SA.V.each(vehicle, (cell, r, c, layer) => cells.push([layer === 'side' ? 1 : 0, r, c, cell.id, cell.mt || 1, cell.lv || 0]));
    const original = id ? get(id) : null;
    if (id && !original) throw new Error('候选车已不存在，请从报告重新打开');
    const spec = original?.record.spec || { chapter: meta.chapter, stage: meta.stage, terrain: meta.terrain || 'flat' };
    const name = meta.name || vehicle.name;
    const record = { name, cells, code: SA.V.encode({ ...vehicle, name }), spec, style: meta.style || 'wander',
      chassis: cells.map(row => row[3]).find(part => SA.MODULES[part]?.layer === 'chassis') || 'track',
      archiveClass: 'normal', needsEvaluation: true,
      stats: { value: stats.value, count: stats.count, hp: stats.hp, dps: stats.dps, rating: stats.rating, water: stats.water, cool: stats.cool } };
    const editedAt = new Date().toISOString();
    return original ? update(id, { record, manual: true, participate: true, editedAt }) : remember(record, { manual: true, editedAt });
  }
  // 历史报告保持只读；展示时加入收藏，并用手工版本替换它的原始候选。
  function merge(report) {
    const result = clone(SA.Camp.migrateEvolutionReport(report)), protectedRows = read().filter(row => row.favorite || row.manual);
    result.candidates ||= []; result.chapters ||= [];
    for (const row of protectedRows) {
      const sp = row.record.spec;
      if (!Number.isInteger(sp?.chapter) || !Number.isInteger(sp?.stage)) continue;
      const matches = rec => key(rec) === key(row.record) || (row.manual && key(rec) === row.parentKey);
      const measuredStage = result.chapters.find(ch => ch.chapter === sp.chapter)?.stages.find(item => item.spec?.stage === sp.stage);
      const measuredAt = measuredStage?.generatedAt || result.generatedAt;
      const measured = result.candidates.find(rec => key(rec) === key(row.record) && rec.rules && !rec.needsEvaluation &&
        (!row.manual || (rec.style === row.record.style && rec.evaluationStyle === row.record.style &&
          Date.parse(measuredAt || '') >= Date.parse(row.editedAt || row.updatedAt))));
      // 新报告确实测过同一构筑时可展示新战绩，原车的模块仍来自独立候选库。
      const record = { ...row.record, ...(measured || {}), name: row.record.name, cells: row.record.cells, code: row.record.code,
        style: row.record.style, needsEvaluation: measured ? false : row.record.needsEvaluation,
        arenaId: row.id, favorite: row.favorite, manual: row.manual, participate: row.participate };
      result.candidates = result.candidates.filter(rec => !matches(rec)); result.candidates.push(record);
      let ch = result.chapters.find(item => item.chapter === sp.chapter);
      if (!ch) { ch = { chapter: sp.chapter, name: SA.CAMPAIGN[sp.chapter]?.name, stages: [] }; result.chapters.push(ch); }
      let stage = ch.stages.find((item, index) => (item.spec?.stage ?? index) === sp.stage);
      if (!stage) { stage = { spec: { ...sp, name: SA.CAMPAIGN[sp.chapter]?.stages[sp.stage]?.name }, top: [], selected: null }; ch.stages.push(stage); }
      stage.top = (stage.top || []).filter(rec => !matches(rec)); stage.top.push(record);
      if (stage.selected && matches(stage.selected)) {
        const edited = key(stage.selected) !== key(record);
        const missing = missingReward(record);
        stage.selected = missing ? null : record;
        if (missing || edited || record.needsEvaluation) {
          const failed = missing ? ['reward'] : ['manualReview'];
          stage.selection = { failed, status: missing ? '缺少奖励件，保留原车待修改' : '手工修改后待重新模拟' };
          result.selectionFailures = (result.selectionFailures || []).filter(item => item.chapter !== sp.chapter || item.stage !== sp.stage);
          result.selectionFailures.push({ chapter: sp.chapter, stage: sp.stage, name: stage.spec.name, failed });
        }
      }
      ch.stages.sort((a, b) => a.spec.stage - b.spec.stage);
    }
    result.chapters.sort((a, b) => a.chapter - b.chapter);
    return result;
  }
  SA.EvolveArena = { KEY, read, key, find, get, missingReward, remember, update, saveEdited, merge };
})();
