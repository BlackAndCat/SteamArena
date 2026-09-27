// 关卡车手工设计数据（由 tools/stage-editor.html 写入，请勿手工编辑已保存记录）。
window.SA = window.SA || {};
SA.STAGE_CARS = {
  "version": 1,
  "targets": [
    "0:0",
    "0:1",
    "1:0",
    "1:1",
    "1:2",
    "2:0",
    "2:1",
    "2:2"
  ],
  "records": {}
};
SA.StageCars = (() => {
  const data = SA.STAGE_CARS;
  const keyOf = (chapter, stage) => `${chapter}:${stage}`;
  const targetKeys = () => [...(data.targets || [])];
  const get = (chapter, stage) => data.records && data.records[keyOf(chapter, stage)] || null;
  const isLocked = (chapter, stage) => !!get(chapter, stage)?.locked;
  // 规则指纹只来自后台版本，不把用户的手工数据算进去。
  const ruleFingerprint = () => String(SA.RULES_VERSION || SA.BUILD_SYS || 'rules-unknown');
  function cellsOf(vehicle) {
    const cells = [];
    SA.V.each(vehicle, (cell, row, col, layer) => cells.push([layer === 'side' ? 1 : 0, row, col, cell.id, cell.mt || 1, cell.lv || 0]));
    return cells;
  }
  function vehicle(record, name) {
    if (!record) return null;
    if (Array.isArray(record.cells) && typeof SA.V.fromCells === 'function') return SA.V.fromCells(name || record.name || '手工关卡车', record.cells);
    if (record.code && typeof SA.V.decode === 'function') return SA.V.decode(record.code);
    return null;
  }
  function merge(base, chapter, stage) {
    const record = get(chapter, stage);
    if (!record) return { ...base, source: 'original', locked: false, stageCar: null };
    const out = { ...base };
    for (const field of ['name', 'pilot', 'blurb', 'weakness', 'style', 'aim', 'terrain', 'boss', 'prize', 'unlock', 'uniqueLoot']) if (record[field] !== undefined) out[field] = record[field];
    out.source = 'manual'; out.locked = record.locked !== false; out.stageCar = record; out.manualVersion = record.updatedAt || record.version || null; out.vehicle = vehicle(record, out.name);
    return out;
  }
  function applyToCampaign() {
    if (!Array.isArray(SA.CAMPAIGN)) return;
    for (const key of targetKeys()) {
      const [chapter, stage] = key.split(':').map(Number), record = get(chapter, stage), base = SA.CAMPAIGN[chapter]?.stages?.[stage];
      if (!record || !base) continue;
      const out = merge(base, chapter, stage);
      for (const field of ['name', 'pilot', 'blurb', 'weakness', 'style', 'aim', 'terrain', 'boss', 'prize', 'unlock', 'uniqueLoot']) if (out[field] !== undefined) base[field] = out[field];
      base.vehicle = out.vehicle; base.source = 'manual'; base.locked = out.locked; base.stageCar = record;
    }
  }
  function makeRecord(chapter, stage, base, vehicleValue, meta = {}) {
    const stats = SA.V.stats(vehicleValue);
    return {
      version: 1, id: keyOf(chapter, stage), cells: cellsOf(vehicleValue), code: SA.V.encode(vehicleValue),
      style: meta.style ?? base.style ?? 'wander', aim: Number.isFinite(+meta.aim) ? +meta.aim : (base.aim ?? 0.8), terrain: meta.terrain || base.terrain || 'flat', boss: meta.boss === undefined ? !!base.boss : !!meta.boss,
      prize: Number.isFinite(+meta.prize) ? +meta.prize : (base.prize || 0), unlock: meta.unlock === undefined ? (base.unlock || null) : meta.unlock, uniqueLoot: meta.uniqueLoot === undefined ? (base.uniqueLoot || []) : meta.uniqueLoot,
      name: meta.name || base.name || vehicleValue.name, pilot: meta.pilot || base.pilot || '', blurb: meta.blurb ?? base.blurb ?? '', weakness: meta.weakness ?? base.weakness ?? '',
      source: 'manual', locked: meta.locked !== false, updatedAt: new Date().toISOString(), rules: ruleFingerprint(),
      analysis: { rating: stats.rating, value: stats.value, weight: stats.weight, drive: stats.drive, water: stats.water, overheat: stats.overheat, dps: stats.dps, hp: stats.hp },
    };
  }
  function validate(record, chapter, stage, vehicleValue) {
    const out = { ok: false, warnings: [], errors: [], stats: null };
    if (!vehicleValue) { out.errors.push('没有可分析的载具'); return out; }
    const stats = SA.V.stats(vehicleValue); out.stats = stats;
    if (!stats.canDeploy) out.errors.push(...(stats.problems || ['载具不能出战']));
    if (!record || !Array.isArray(record.cells) || !record.cells.length) out.errors.push('没有模块清单');
    const allowed = new Set(SA.CAMP_START?.mods || []), base = SA.CAMPAIGN?.[chapter]?.stages?.[stage];
    if (SA.STARTER && SA.V?.fromAscii) {
      const starter = SA.V.fromAscii('开局车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
      SA.V.each(starter, cell => allowed.add(cell.id));
    }
    // 开局车的 ASCII 车体用 K 表示驾驶舱，正式模块清单使用 cockpit；两者都属于开局可用部件。
    allowed.add('cockpit');
    for (let ci = 0; ci <= chapter; ci++) {
      const ch = SA.CAMPAIGN[ci], stop = ci === chapter ? stage : ch.stages.length;
      for (let si = 0; si < stop; si++) for (const id of ch.stages[si].unlock?.mods || []) allowed.add(id);
      if (ci < chapter) for (const id of ch.unlock?.mods || []) allowed.add(id);
    }
    for (const id of record?.unlock?.mods || []) allowed.add(id);
    for (const loot of record?.uniqueLoot || []) if (loot?.id) allowed.add(loot.id);
    if (base?.spec?.reward) allowed.add(base.spec.reward);
    for (const row of base?.subs || []) if (row?.[2]) allowed.add(row[2]);
    for (const cell of record?.cells || []) if (cell && SA.MODULES[cell[3]] && !allowed.has(cell[3]) && !record.boss) out.warnings.push(`使用了该关尚未解锁的模块：${cell[3]}`);
    out.ok = out.errors.length === 0;
    return out;
  }
  applyToCampaign();
  return { data, keyOf, targetKeys, get, isLocked, merge, applyToCampaign, vehicle, cellsOf, makeRecord, validate, ruleFingerprint };
})();
