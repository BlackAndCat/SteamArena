// 后台「关卡」工作区里的拼装台（tools/console.html 把这一页嵌在拼装页签里）。
// 只放游戏的车间编辑器，跑在隔离的设计存档里（SA.Camp.dev.designMode）：不写正式存档。
// 校验、保存、模拟都走后台接口（SA.StageCars / SA.Camp.dev / SA.Battle / SA.EvolveArena），
// 父页面通过 window.Garage 调用；这里只做「把哪一关的车放上拼装台」和把结果交回去。
(() => {
  'use strict';
  const PICKS = 'steam_arena_evolve_picks';
  let cur = null, opened = false;

  // 工具页没有游戏主入口：车间里的导航按钮不跳页
  if (!SA.go) SA.go = (name) => { SA.current = name; document.body.dataset.screen = name; if (SA.Camp?.syncLim) SA.Camp.syncLim(); };
  if (!SA.nav) SA.nav = () => {};
  try { SA.S.load(); SA.Camp.backfill(); } catch (e) { console.warn('拼装台没有正式存档，用原始关卡数据', e); }
  SA.PX.init();
  SA.Camp.dev.designMode();

  const stageAt = (ci, si) => SA.CAMPAIGN[ci]?.stages?.[si] || null;
  function actualStage(ci, si) {
    const base = stageAt(ci, si);
    if (!base) return null;
    const out = SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base };
    out.vehicle = out.vehicle || SA.V.fromAscii(out.name, out.rows, out.sides || [], out.mt || 1, out.elite || [], out.subs || []);
    return out;
  }
  const car = () => SA.S.d.vehicle;
  const cellsOf = (v) => SA.StageCars.cellsOf(v);

  function put(v) {
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
    cur = { ci, si };
    const v = cells ? SA.V.fromCells(name || st.vehicle.name || st.name, cells) : SA.V.clone(st.vehicle);
    v.name = name || st.stageCar?.vehicleName || st.vehicle.name || st.name;
    put(v);
    return info();
  }
  const info = () => ({ ci: cur?.ci, si: cur?.si, name: car()?.name || '', cells: car() ? cellsOf(car()) : [] });
  const cellsJson = () => (car() ? JSON.stringify(cellsOf(car())) : '');
  const setName = (name) => { if (car()) car().name = name; const plate = document.querySelector('.plate-name'); if (plate && plate.value !== name) plate.value = name; };

  // 保存：先按工作台的老规矩校验，再交给规则层写本机存档、广播正式游戏页、同步 js/stage-cars.js
  async function save(meta) {
    if (!cur) throw new Error('拼装台还没打开这一关');
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

  function stats() {
    const v = car();
    if (!v) return null;
    const s = SA.V.stats(v), pen = [], thick = [];
    SA.V.each(v, (cell) => { const m = SA.mod(cell); if (m.penetration) pen.push(m.penetration); if (m.armor) thick.push(m.armor); });
    return JSON.parse(JSON.stringify({ rating: s.rating, value: s.value, weight: s.weight, demand: s.demand, supply: s.supply, water: s.water,
      overheat: Number.isFinite(s.overheat) ? s.overheat : null, dps: s.dps, canDeploy: !!s.canDeploy, problems: s.problems || [], pen, thick }));
  }

  // 导入：SA1 / SA2 分享码，或 [[层,行,列,id,材料,改装等级],…] 模块清单
  function importText(text, name) {
    const t = String(text || '').trim();
    if (!t) throw new Error('导入内容是空的');
    let v;
    if (t.startsWith('SA1.') || t.startsWith('SA2.')) v = SA.V.decode(t);
    else {
      const json = JSON.parse(t), cells = Array.isArray(json) ? json : json.cells;
      if (!Array.isArray(cells)) throw new Error('需要分享码或 cells 模块清单');
      v = SA.V.fromCells(name || '导入关卡车', cells);
    }
    if (name) v.name = name;
    put(v);
    return info();
  }
  function picks() { try { return JSON.parse(localStorage.getItem(PICKS)) || []; } catch (e) { return []; } }
  const candidates = () => picks().map((p, i) => ({ i, name: p.name || `候选 ${i + 1}`, from: p.from || '' }));
  function useCandidate(i) {
    const p = picks()[i];
    if (!p) throw new Error('候选车不存在，去进化擂台重新选一辆');
    put(p.cells ? SA.V.fromCells(p.name || car().name, p.cells) : SA.V.decode(p.code));
    return info();
  }

  // 强度：拿开局车和前面最近 4 关的车各打 games 局（双方各当一次玩家），算胜率和 95% 区间；
  // 做法照搬关卡车工作台（tools/stage-editor.js 的 testVehicle），只是从后台页面调用
  function test(games, f) {
    if (!cur) throw new Error('拼装台还没打开这一关');
    const v = car(), { ci, si } = cur, bounds = SA.CAMPAIGN[ci].bounds;
    const n = Math.max(1, Math.min(200, Math.round(games) || 20));
    const refs = [SA.V.fromAscii('开局参考车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || [])];
    for (let c = 0; c <= ci; c++) for (let s = 0; s < SA.CAMPAIGN[c].stages.length; s++) if (c < ci || s < si) refs.push(actualStage(c, s).vehicle);
    const counts = { p: 0, e: 0, draw: 0 };
    let wins = 0, total = 0, time = 0;
    refs.slice(-4).forEach((ref, ri) => {
      for (let i = 0; i < n; i++) {
        const seed = 0x5eed + ci * 10000 + si * 1000 + ri * 100 + i;
        const a = SA.Battle.simulate({ p: ref, e: v, pAim: 0.8, eAim: f.aim, pStyle: 'wander', eStyle: f.style, terrain: f.terrain, bounds, eBoss: f.boss, seed });
        const b = SA.Battle.simulate({ p: v, e: ref, pAim: f.aim, eAim: 0.8, pStyle: f.style, eStyle: 'wander', terrain: f.terrain, bounds, seed: seed + 1 });
        for (const [r, side] of [[a, 'e'], [b, 'p']]) { const w = r.winner || 'draw'; counts[w] = (counts[w] || 0) + 1; if (w === side) wins++; total++; time += r.t || 0; }
      }
    });
    const rate = total ? wins / total : 0, z = 1.96, den = 1 + z * z / total, centre = rate + z * z / (2 * total);
    const spread = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total);
    return { rate, lo: (centre - spread) / den, hi: (centre + spread) / den, total, avg: time / Math.max(1, total), counts, refs: Math.min(4, refs.length) };
  }

  // 存到进化擂台：不改正式关卡，只把这台车交给进化生成器当种子
  function saveArena(arenaId, f) {
    if (!cur) throw new Error('拼装台还没打开这一关');
    const row = SA.EvolveArena.saveEdited(arenaId || null, car(), { chapter: cur.ci, stage: cur.si, name: car().name?.trim() || f.name, style: f.style, terrain: f.terrain });
    return row.id;
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
    if (e.target.matches?.('.plate-name') && window.parent !== window) window.parent.postMessage({ type: 'garage-name', name: e.target.value }, location.origin);
  });

  window.Garage = { ready: true, open, info, cellsJson, setName, save, stats, importText, candidates, useCandidate, test, saveArena, drivePick };
  if (window.parent !== window) window.parent.postMessage({ type: 'garage-ready' }, location.origin);
})();
