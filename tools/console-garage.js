// 后台「关卡」工作区里的拼装台（tools/console.html 把这一页嵌在拼装页签里）。
// 只放游戏的车间编辑器，跑在隔离的设计存档里（SA.Camp.dev.designMode）：不写正式存档。
// 校验、保存、模拟都走后台接口（SA.StageCars / SA.Camp.dev / SA.Battle / SA.EvolveArena），
// 父页面通过 window.Garage 调用；这里只做「把哪一关的车放上拼装台」和把结果交回去。
(() => {
  'use strict';
  const PICKS = 'steam_arena_evolve_picks';
  const session = SA.WorkbenchSession.create();
  const current = () => session.current();
  let opened = false;
  let budgetCatalog = null;
  const budgetDrafts = new Map(), budgetMessages = new Map();

  /** 独立重读预算，不重开车辆、不覆盖拼装草稿。 */
  async function reloadBudget() {
    try {
      const response = await fetch('/__evolve/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('预算目录暂不可用');
      budgetCatalog = await response.json();
    } catch (error) { budgetCatalog = null; }
    if (opened) SA.Editor.refresh();
  }

  /** 保存只改预算；并发冲突显示最新上限，保留输入，等待用户再次明确保存。 */
  async function saveBudget(at, expectedBudget, value) {
    const key = `${at.ci}:${at.si}`, budget = value.trim() === '' ? NaN : Number(value);
    if (!Number.isSafeInteger(budget) || budget < 1) {
      budgetMessages.set(key, '预算上限必须是正整数');
      SA.Editor.refresh(); return;
    }
    try {
      const response = await fetch('/__evolve/budget/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter: at.ci, stage: at.si, budget, expectedBudget }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await reloadBudget();
        throw new Error(response.status === 409 ? `${result.error}；最新上限 ${result.budget == null ? '未配置' : `£${result.budget}`}，确认后再次保存` : result.error || `预算保存失败（HTTP ${response.status}）`);
      }
      budgetDrafts.delete(key); budgetMessages.set(key, '预算已保存，车辆和奖励未改变');
      await reloadBudget();
      try { const channel = new BroadcastChannel('steam-arena-evolve-budget'); channel.postMessage({ chapter: at.ci, stage: at.si }); channel.close(); } catch (error) { /* 不支持频道时，当前工作台仍已刷新。 */ }
    } catch (error) { budgetMessages.set(key, error.message); SA.Editor.refresh(); }
  }

  /** 预算只读生成器目录；本次造价来自实时 stats，超限不改变保存或手工进化资格。 */
  function budgetSummary(value) {
    const at = current(), limit = budgetCatalog?.budgets?.find(row => row.chapter === at?.ci && row.stage === at?.si)?.budget ??
      budgetCatalog?.chapters.find(ch => ch.chapter === at?.ci)?.stages.find(row => row.stage === at?.si)?.budget;
    const known = Number.isFinite(limit) && limit >= 0, used = Number.isFinite(value) ? value : null;
    const exceeded = known && used != null && used > limit, money = n => Number(n.toFixed(2));
    const key = `${at?.ci}:${at?.si}`;
    const input = SA.h('input', { type: 'number', min: 1, step: 1, value: budgetDrafts.get(key) ?? (known ? String(limit) : ''),
      'aria-label': '本关预算上限', oninput: event => budgetDrafts.set(key, event.target.value) });
    return SA.h('div', { class: `garage-budget${exceeded ? ' over-budget' : ''}` },
      SA.h('b', {}, `已用预算 ${used == null ? '未记录' : `£${money(used)}`} / 预算上限 ${known ? `£${money(limit)}` : budgetCatalog ? '未配置' : '暂不可用'}`),
      exceeded ? SA.h('div', {}, `超出 £${money(used - limit)}，仅提示，仍可参与进化`) : null,
      SA.h('div', { class: 'garage-budget-edit' }, input, SA.h('button', { type: 'button', disabled: !budgetCatalog || !Number.isInteger(at?.ci) || !Number.isInteger(at?.si),
        onclick: () => saveBudget(at, known ? limit : null, input.value) }, '保存预算')),
      budgetMessages.has(key) ? SA.h('div', { class: 'px-small' }, budgetMessages.get(key)) : null);
  }

  // 工具页没有游戏主入口：车间里的导航按钮不跳页
  if (!SA.go) SA.go = (name) => { SA.current = name; document.body.dataset.screen = name; if (SA.Camp?.syncLim) SA.Camp.syncLim(); };
  if (!SA.nav) SA.nav = () => {};
  try { SA.S.load(); SA.Camp.backfill(); } catch (e) { console.warn('拼装台没有正式存档，用原始关卡数据', e); }
  SA.PX.init();
  SA.Camp.dev.designMode();

  const stageAt = (ci, si) => parent.ConsoleNewStage?.get(ci, si) || SA.CAMPAIGN[ci]?.stages?.[si] || null;
  function actualStage(ci, si) {
    const base = stageAt(ci, si);
    if (!base || base.unfinished) return null;
    const out = base.newDraft ? { ...base } : SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base };
    out.vehicle = out.vehicle || SA.V.fromAscii(out.name, out.rows, out.sides || [], out.mt || 1, out.elite || [], out.subs || []);
    return out;
  }
  const car = () => session.vehicle();
  const cellsOf = (v) => SA.StageCars.cellsOf(v);

  // 手工关卡车始终使用完整工作区：编辑、出战及手工进化席位不套用玩家扩建进度。
  // 诊断只修改副本，保留原车的模块坐标；结构、连接和动力等出战规则仍照常检查。
  function diagnostics(v = car()) {
    if (!v) return null;
    const grid = { cols: 8, rows: 6 }, copy = SA.V.clone(v);
    copy.lim = grid;
    const stats = SA.V.stats(copy);
    const issues = (stats.issues || []).map((issue) => {
      const cell = copy[issue.layer][issue.r][issue.c], size = SA.fp(cell.id);
      return { ...issue, id: cell.id, name: SA.MODULES[cell.id].name, w: size.w, h: size.h };
    });
    return { grid, vehicle: copy, stats, issues };
  }
  // 仅此隔离工具页安装性能单回调；普通玩家工作台保持原计算与预览规则。
  SA.WorkbenchDiagnostics = (v) => {
    const result = diagnostics(v), { grid, stats: s, issues } = result, h = SA.h;
    // 性能单与画布共用最大范围，不再把自动生成候选的关卡规格显示为手工车限制。
    const problemText = reason => reason.replace('（车间里红色闪烁）', '');
    const issueText = issue => issue.reason === SA.Config.text('vehicle_bd09be8e512a')
      ? '超出工作台可用范围' : issue.reason;
    const badModules = new Set(issues.map(issue => `${issue.layer},${issue.r},${issue.c}`)).size;
    const compactText = s.canDeploy ? `进化出战校验通过（${grid.cols}列×${grid.rows}层）`
      : `进化校验未通过：${badModules ? `${badModules} 个模块摆放违规；` : ''}${s.problems.length} 项原因，详见左侧性能单`;
    const summary = h('div', { class: 'garage-diagnostics', role: 'status' },
      h('b', { class: s.canDeploy ? '' : 'px-prob' },
        `进化出战校验：${s.canDeploy ? '通过' : '不能出战'}（${s.problems.length} 项原因）`),
      budgetSummary(s.value),
      h('div', {}, `编辑与出战范围：${grid.cols}列×${grid.rows}层（已全部开放）`),
      h('div', { class: 'px-small' }, (() => {
        const region = SA.V.region(result.vehicle);
        return `可用子格：第 ${region.c0 + 1}～${region.c1 + 1} 列，第 ${region.r0 + 1}～${SA.K.ROWS} 行（从左上角 1 起算）`;
      })()),
      s.problems.map(reason => h('div', { class: 'px-prob' }, problemText(reason))),
      issues.map(issue => h('div', { class: 'px-prob' },
        `${issue.layer === 'side' ? '侧挂层' : '主体层'}·${issue.name}·子格第${issue.c + 1}列、第${issue.r + 1}行（从左上角1起算）：${issueText(issue)}；占 ${issue.w}×${issue.h} 子格`)),
      h('div', { class: 'px-small' }, '试驾场作为敌车能作战，不代表通过进化出战校验。'),
      h('b', {}, '机械性能（红色数值表示异常；警告不一定禁止出战）'));
    // 原因已在上方完整列出，机械性能区域只补充不禁止出战的警告。
    return { ...result, summary, compactText, displayStats: { ...s,
      problems: [],
      warnings: s.warnings.map(warning => `机械性能警告：${warning}`) } };
  };

  function put(v, target) {
    if (!v) throw new Error('车辆数据无效，原车未更换');
    if (target) session.select(target, v); else session.replace(v);
    v.lim = { cols: 8, rows: 6 };
    SA.S.d.vehicle = v;
    SA.S.d.camp.grid = { cols: 8, rows: 6 };
    SA.Camp.syncLim();
    if (!opened) { SA.Editor.open(); opened = true; } else SA.Editor.refresh ? SA.Editor.refresh() : SA.Editor.open();
    tidyCatalog();
  }

  // 把某一关的车放上拼装台；cells / name 是父页面暂存的草稿（没保存的改动）
  function open(ci, si, cells, name) {
    const st = actualStage(ci, si);
    if (!st) throw new Error('找不到这一关');
    const v = cells ? SA.V.fromCells(name || st.vehicle.name || st.name, cells) : SA.V.clone(st.vehicle);
    v.name = name || st.stageCar?.vehicleName || st.vehicle.name || st.name;
    put(v, { kind: 'stage', ci, si, id: `${ci},${si}` });
    return info();
  }
  // 会话身份跟着车辆走；父页只接收当前目标的编辑通知。
  const info = () => ({ target: current(), ci: current()?.ci, si: current()?.si, name: car()?.name || '', cells: car() ? cellsOf(car()) : [] });
  const cellsJson = () => (car() ? JSON.stringify(cellsOf(car())) : '');
  // 只读导出拼装台当前车辆（包含未保存的编辑）；完整 cells 保留材料、等级及变体，不写关卡数据。
  function shareCode() {
    const v = car();
    if (!v) throw new Error('拼装台还没有车辆');
    return SA.WorkbenchSession.exportVehicle(v, SA);
  }
  const setName = (name) => { if (car()) car().name = name; const plate = document.querySelector('.plate-name'); if (plate && plate.value !== name) plate.value = name; };

  // 保存：校验当前目标后交给规则层写正式 config/stage-cars.json，并广播更新。
  // 调用方写明要存哪一关；拼装台上不是这一关就拒绝，绝不把资料存到别的关上
  const sameStage = (at) => !!at && session.matches({ kind: 'stage', id: `${at.ci},${at.si}` });
  async function save(meta, at) {
    const cur = current();
    if (cur?.kind !== 'stage') throw new Error('拼装台还没打开这一关');
    if (!sameStage(at)) throw new Error('拼装台上不是要保存的这一关，请再保存一次');
    if (!meta || !meta.vehicleName) throw new Error('车名不能为空');
    const v = car();
    v.name = meta.vehicleName;
    const st = actualStage(cur.ci, cur.si);
    const preview = SA.StageCars.makeRecord(cur.ci, cur.si, st, v, meta);
    const check = SA.Camp.dev.checkStageCar(cur.ci, cur.si, preview, v);
    if (!check.ok) throw new Error(check.errors.join('；'));
    const result = await SA.Camp.dev.saveStageCar(cur.ci, cur.si, meta);
    if (!result || !result.record) throw new Error('保存接口没有返回关卡车记录');
    return JSON.parse(JSON.stringify({ record: result.record, warnings: check.warnings || [], filePersisted: !!result.filePersisted,
      localPersisted: !!result.localPersisted, channelSent: !!result.channelSent, persisted: !!result.persisted }));
  }
  // 新关卡沿用同一套拼装校验，只在保存成功后请求服务登记该编号。
  async function saveNew(meta, at) {
    const cur = current();
    if (!sameStage(at)) throw new Error('拼装台上不是要保存的这一关，请再保存一次');
    if (cur?.kind !== 'stage' || !stageAt(cur.ci, cur.si)?.newDraft) throw new Error('新关卡草稿不存在');
    if (!meta?.vehicleName) throw new Error('车名不能为空');
    const v = car(), st = actualStage(cur.ci, cur.si);
    v.name = meta.vehicleName;
    const record = SA.StageCars.makeRecord(cur.ci, cur.si, st, v, meta);
    // 草稿里按设计稿填好的考点和强度目标一起登记（makeRecord 只沿用已有记录的字段）
    if (st.spec) record.spec = JSON.parse(JSON.stringify(st.spec));
    const check = SA.StageCars.validate(record, cur.ci, cur.si, v);
    if (!check.ok) throw new Error(check.errors.join('；'));
    const response = await fetch('/__stage-cars/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbenchVersion: 1, target: { kind: 'stage', id: record.id }, record }) });
    const saved = await response.json();
    if (!response.ok || !saved.ok) throw new Error(saved.error || `新关卡保存失败（HTTP ${response.status}）`);
    // 子页也须立刻承认新关已登记；同页的后续修改应走普通关卡保存，而非再次请求创建。
    const stages = SA.CAMPAIGN[cur.ci].stages;
    for (let index = stages.length; index <= cur.si; index++) stages.push({ stageRef: `${cur.ci}:${index}`, unfinished: true });
    stages[cur.si] = { stageRef: record.id };
    if (!SA.STAGE_CARS.targets.includes(record.id)) SA.STAGE_CARS.targets.push(record.id);
    SA.STAGE_CARS.records[record.id] = record;
    SA.StageCars.applyToCampaign();
    // 新建还改变 content 章节结构；其他控制台收到后需完整重载。
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('steam-arena-stage-cars');
      channel.postMessage({ type: 'created', id: record.id });
      channel.close();
    }
    return { record, warnings: check.warnings, filePersisted: true };
  }

  // 候选车有独立身份和存储；保存时必须仍是打开的同一条候选记录。
  function openCandidate(id, cells, name) {
    const row = SA.EvolveArena.get(id);
    if (!row) throw new Error('候选车已不存在，请从进化报告重新打开');
    const rec = row.record || {};
    const v = cells ? SA.V.fromCells(name || rec.name, cells)
      : Array.isArray(rec.cells) ? SA.V.fromCells(rec.name, rec.cells) : SA.V.decode(rec.code);
    if (!v) throw new Error('候选车构筑无法读取');
    v.name = name || rec.name || v.name;
    put(v, { kind: 'candidate', id, ci: rec.spec?.chapter, si: rec.spec?.stage });
    return info();
  }
  function saveCandidate(id) {
    session.requireTarget({ kind: 'candidate', id });
    const row = SA.EvolveArena.get(id);
    if (!row) throw new Error('候选车已不存在，请从进化报告重新打开');
    const rec = row.record || {}, sp = rec.spec || {};
    return SA.EvolveArena.saveEdited(id, car(), { chapter: sp.chapter, stage: sp.stage,
      name: car().name, style: rec.style, terrain: sp.terrain });
  }

  function stats() {
    const v = car();
    if (!v) return null;
    const check = diagnostics(v), s = check.stats, pen = [], thick = [];
    SA.V.each(v, (cell) => { const m = SA.mod(cell); if (m.penetration) pen.push(m.penetration); if (m.armor) thick.push(m.armor); });
    return JSON.parse(JSON.stringify({ rating: s.rating, value: s.value, weight: s.weight, demand: s.demand, supply: s.supply, water: s.water,
      overheat: Number.isFinite(s.overheat) ? s.overheat : null, dps: s.dps, canDeploy: check.grid ? !!s.canDeploy : null,
      grid: check.grid, problems: s.problems || [], warnings: s.warnings || [], issues: check.issues, pen, thick }));
  }

  // 导入：SA1 / SA2 分享码，或 [[层,行,列,id,材料,改装等级],…] 模块清单
  function importText(text, name) {
    const v = SA.WorkbenchSession.parseVehicle(text, name, SA);
    put(v);
    return info();
  }
  // 正式候选库是唯一候选来源；PICKS 只用于试驾场的一次性交接。
  const candidates = () => SA.EvolveArena.read().map((p) => ({ id: p.id, name: p.record?.name || '未命名候选', from: p.record?.spec?.name || '' }));
  function useCandidate(id) {
    const p = SA.EvolveArena.get(id), rec = p?.record;
    if (!rec) throw new Error('候选车不存在，去进化擂台重新选一辆');
    const v = rec.cells ? SA.WorkbenchSession.parseVehicle(JSON.stringify({ cells: rec.cells }), rec.name, SA)
      : SA.WorkbenchSession.parseVehicle(rec.code, rec.name, SA);
    put(v);
    return info();
  }

  // 强度：拿开局车和前面最近 4 关的车各打 games 局（双方各当一次玩家），算胜率和 95% 区间；
  // 对参考车双向模拟，由后台页面调用。
  function test(games, f) {
    const cur = current();
    if (cur?.kind !== 'stage') throw new Error('拼装台还没打开这一关');
    const v = car(), { ci, si } = cur, bounds = SA.CAMPAIGN[ci].bounds;
    const n = Math.max(1, Math.min(200, Math.round(games) || 20));
    const refs = [{ vehicle: SA.V.fromAscii('开局参考车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []) }];
    for (let c = 0; c <= ci; c++) for (let s = 0; s < SA.CAMPAIGN[c].stages.length; s++) if (c < ci || s < si) {
      const previous = actualStage(c, s);
      if (previous?.vehicle) refs.push(previous);
    }
    const counts = { p: 0, e: 0, draw: 0 };
    let wins = 0, total = 0, time = 0;
    refs.slice(-4).forEach((ref, ri) => {
      for (let i = 0; i < n; i++) {
        const seed = 0x5eed + ci * 10000 + si * 1000 + ri * 100 + i;
        const a = SA.Battle.simulate({ p: ref.vehicle, e: v, pStatMultipliers: ref.statMultipliers, eStatMultipliers: f.statMultipliers, pAim: 0.8, eAim: f.aim, pStyle: 'wander', eStyle: f.style, terrain: f.terrain, bounds, eBoss: f.boss, seed });
        const b = SA.Battle.simulate({ p: v, e: ref.vehicle, pStatMultipliers: f.statMultipliers, eStatMultipliers: ref.statMultipliers, pAim: f.aim, eAim: 0.8, pStyle: f.style, eStyle: 'wander', terrain: f.terrain, bounds, seed: seed + 1 });
        for (const [r, side] of [[a, 'e'], [b, 'p']]) { const w = r.winner || 'draw'; counts[w] = (counts[w] || 0) + 1; if (w === side) wins++; total++; time += r.t || 0; }
      }
    });
    const rate = total ? wins / total : 0, z = 1.96, den = 1 + z * z / total, centre = rate + z * z / (2 * total);
    const spread = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total);
    return { rate, lo: (centre - spread) / den, hi: (centre + spread) / den, total, avg: time / Math.max(1, total), counts, refs: Math.min(4, refs.length) };
  }

  // 试驾：把这台车交给游戏的试驾场（来源「进化报告」）
  function drivePick(f) {
    localStorage.setItem(PICKS, JSON.stringify([{ name: car().name || '手工关卡车', cells: cellsOf(car()), terrain: f.terrain, style: f.style, from: `后台 · ${f.name}` }]));
  }

  // ---------- 车间清单：设计存档里全部模块都在库存，去掉商店开关，加一个搜索框 ----------
  let observer = null, search = null;
  const keyOf = (row) => row?.dataset.pageKey?.replace(/^inventory:/, '');
  function tidyCatalog() {
    const tools = document.querySelector('.assembly-screen .panel-tools'), list = document.querySelector('.assembly-screen .panel-list');
    if (!tools || !list) return;
    if (observer) observer.disconnect();
    [...tools.children].filter((c) => c.classList.contains('panel-row') && (c.querySelector('.switch') || /商店/.test(c.textContent || ''))).forEach((c) => c.remove());
    if (!search) {
      const input = document.createElement('input');
      input.type = 'search'; input.placeholder = '搜模块：名称 / 类别 / 材料'; input.setAttribute('aria-label', '搜索模块');
      const none = document.createElement('div'); none.className = 'none'; none.textContent = '没有匹配的模块'; none.hidden = true;
      search = document.createElement('div'); search.className = 'garage-search'; search.append(input, none);
      input.addEventListener('input', () => { filter(); const l = document.querySelector('.assembly-screen .panel-list'); if (l) l.scrollTop = 0; });
    }
    if (tools.nextElementSibling !== search) tools.after(search);
    filter();
    observer = new MutationObserver(() => tidyCatalog());
    observer.observe(list, { childList: true });
  }
  function filter() {
    const list = document.querySelector('.assembly-screen .panel-list');
    if (!list || !search) return;
    const terms = search.querySelector('input').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of list.querySelectorAll('.mrow')) {
      const { id, mt } = SA.parseKey(keyOf(row) || ''), mod = SA.MODULES[id];
      const text = [id, mod?.name, SA.CAT[mod?.cat]?.name, SA.MATS[mt]?.name].join(' ').toLowerCase();
      row.hidden = !terms.every((t) => text.includes(t));
      if (!row.hidden) shown++;
    }
    search.querySelector('.none').hidden = !terms.length || shown > 0;
  }
  // 车间铭牌上改车名时告诉父页面
  document.addEventListener('input', (e) => {
    if (e.target.matches?.('.plate-name') && window.parent !== window) window.parent.postMessage({ type: 'garage-name', target: current(), name: e.target.value }, location.origin);
  });

  // Editor 每次改动都经 SA.S.save；只在该设计存档成功写入后告知父页。
  window.addEventListener('sa-design-save', () => {
    if (current() && window.parent !== window) window.parent.postMessage({ type: 'garage-change', target: current() }, location.origin);
  });

  window.Garage = { ready: true, open, openCandidate, info, cellsJson, shareCode, setName, save, saveNew, saveCandidate, stats, importText, candidates, useCandidate, test, drivePick, reloadBudget };
  // 一次加载只读预算目录，完成后刷新性能单；之后编辑仍使用这一份缓存。
  reloadBudget();
  try { const channel = new BroadcastChannel('steam-arena-evolve-budget'); channel.onmessage = () => reloadBudget(); }
  catch (error) { /* 当前页面仍可读取和保存预算。 */ }
  if (window.parent !== window) window.parent.postMessage({ type: 'garage-ready' }, location.origin);
})();
