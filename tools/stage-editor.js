// 关卡车工作台：只调用规则层接口，工具页面本身不改变游戏界面文件。
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { ci: 0, si: 0, vehicle: null, base: null, record: null, tests: {} };
  let arenaId = null;
  const styles = { wander: '游走', rush: '冲锋', kite: '放风筝', turtle: '龟缩' };
  const targetKeys = (SA.StageCars && SA.StageCars.targetKeys()) || ['0:0', '0:1', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2'];
  const [chapterCount] = [3];
  let assemblyOpen = false;
  let shopObserver = null;
  let toastTimer = null;
  const RECENT_MODULES_KEY = 'steam_arena_stage_recent_modules_v1';
  const RECENT_MODULES_LIMIT = 12;
  let recentModules = loadRecentModules();
  let moduleTools = null;
  let updatingModuleTools = false;
  const searchExpandedGroups = new Set();

  // 只在工具页给原车间图标附加库存键；图片和原生点击、拖拽处理均保持不变。
  const moduleCanvas = SA.SPR.moduleCanvas;
  SA.SPR.moduleCanvas = (id, scale = 1, mt = 1) => {
    const canvas = moduleCanvas(id, scale, mt);
    canvas.dataset.stockKey = SA.invKey(id, mt);
    return canvas;
  };
  // 通过摆放校验并实际扣取库存后才记为“使用”，浏览、失败摆放和拆卸不污染历史。
  const installStock = SA.S.installStock;
  SA.S.installStock = (...args) => {
    const result = installStock(...args);
    if (assemblyOpen && SA.Camp.isDesignMode()) {
      const key = SA.invKey(args[1], args[4]);
      recentModules = [key, ...loadRecentModules().filter(item => item !== key)].slice(0, RECENT_MODULES_LIMIT);
      try { localStorage.setItem(RECENT_MODULES_KEY, JSON.stringify(recentModules)); }
      catch (error) { showToast('模块已装上，但浏览器未能保存最近使用记录。', 'warn'); }
    }
    return result;
  };

  // 最近使用属于本机工具偏好，独立于正式 / 设计存档，换车和重开游戏都不会清空。
  function loadRecentModules() {
    try {
      const keys = JSON.parse(localStorage.getItem(RECENT_MODULES_KEY)) || [];
      if (!Array.isArray(keys)) return [];
      return [...new Set(keys)].filter(key => {
        if (typeof key !== 'string') return false;
        const { id, mt } = SA.parseKey(key);
        return SA.MODULES[id] && !SA.MODULES[id].retired && SA.MATS[mt];
      }).slice(0, RECENT_MODULES_LIMIT);
    } catch (error) { return []; }
  }
  function stockKeyOf(row) { return row?.querySelector('canvas[data-stock-key]')?.dataset.stockKey; }
  function moduleGroup(cat) { return document.querySelector(`.assembly-screen .panel-list .grp.cat-${cat}`); }

  // 搜索时临时展开折叠分类，清空搜索或离开车间后还原原有折叠习惯。
  function restoreModuleGroups() {
    const cats = [...searchExpandedGroups]; searchExpandedGroups.clear();
    for (const cat of cats) {
      const group = moduleGroup(cat);
      if (group && !group.classList.contains('folded')) group.click();
    }
  }
  function filterModules(list) {
    const terms = $('stage-module-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) {
      for (const cat of Object.keys(SA.CAT)) {
        const group = moduleGroup(cat);
        if (group?.classList.contains('folded')) {
          searchExpandedGroups.add(cat);
          group.click();
          // 折叠分类的点击会让原车间重绘清单，必须拿到重绘后的列表再继续筛选。
          list = document.querySelector('.assembly-screen .panel-list');
        }
      }
    } else {
      restoreModuleGroups();
      list = document.querySelector('.assembly-screen .panel-list');
    }
    if (!list) return null;
    let group = null, matches = 0, visible = false, total = 0;
    for (const item of list.children) {
      if (item.classList.contains('grp')) {
        if (group) group.hidden = terms.length > 0 && matches === 0;
        group = item; matches = 0;
      } else if (item.classList.contains('mrow')) {
        const { id, mt } = SA.parseKey(stockKeyOf(item)), mod = SA.MODULES[id];
        const text = [id, mod?.name, SA.CAT[mod?.cat]?.name, SA.MATS[mt]?.name, SA.MATS[mt]?.rank].join(' ').toLowerCase();
        visible = terms.every(term => text.includes(term));
        item.hidden = !visible;
        if (visible) { matches++; total++; }
      } else if (item.classList.contains('mdetail')) item.hidden = !visible;
    }
    if (group) group.hidden = terms.length > 0 && matches === 0;
    const empty = $('stage-search-empty');
    if (empty) empty.hidden = !terms.length || total > 0;
    return list;
  }

  // 快捷栏仍选中原车间的库存项，沿用材料、层位、连续安装和摆放校验。
  function selectRecentModule(key) {
    $('stage-module-search').value = '';
    updateWorkshopModules(true);
    const { id } = SA.parseKey(key), group = moduleGroup(SA.MODULES[id].cat);
    if (group?.classList.contains('folded')) group.click();
    const row = [...document.querySelectorAll('.assembly-screen .panel-list .mrow')].find(item => stockKeyOf(item) === key);
    if (row && !row.classList.contains('sel')) row.click();
  }
  function renderRecentModules(list) {
    const selected = stockKeyOf(list.querySelector('.mrow.sel'));
    const items = recentModules.map(key => {
      const { id, mt } = SA.parseKey(key), name = SA.MODULES[id].name, material = SA.MATS[mt].name;
      const picture = SA.SPR.moduleCanvas(id, 1, mt); picture.setAttribute('aria-hidden', 'true');
      return SA.h('button', { type: 'button', class: `stage-recent-module ${selected === key ? 'selected' : ''}`,
        title: `${name} · ${material}：点击后在车上安装`, 'aria-label': `最近使用：${name} · ${material}`,
        'aria-pressed': String(selected === key), disabled: !(SA.S.d.inv[key] > 0), onclick: () => selectRecentModule(key) },
        picture, SA.h('b', {}, name), SA.h('span', { class: 'muted' }, material));
    });
    $('stage-recent-list').replaceChildren(...items);
    $('stage-recent-empty').hidden = items.length > 0;
  }
  function updateWorkshopModules(resetScroll = false) {
    if (updatingModuleTools) return;
    const tools = document.querySelector('.assembly-screen .panel-tools'), list = document.querySelector('.assembly-screen .panel-list');
    if (!tools || !list) return;
    updatingModuleTools = true;
    try {
      // 原车间重画库存时重新筛选；暂时断开观察，避免筛选自己的 DOM 变化形成循环。
      if (shopObserver) shopObserver.disconnect();
      hideShopControl();
      if (!moduleTools) {
        moduleTools = SA.h('div', { class: 'stage-module-tools' },
          SA.h('input', { id: 'stage-module-search', type: 'search', placeholder: '搜索模块名称 / 类别 / 材料', 'aria-label': '搜索模块',
            oninput: () => updateWorkshopModules(true) }),
          SA.h('div', { id: 'stage-search-empty', class: 'stage-search-empty muted' }, '没有匹配的模块'),
          SA.h('div', { class: 'muted' }, '最近使用'),
          SA.h('div', { id: 'stage-recent-list', class: 'stage-recent-list', role: 'group', 'aria-label': '最近使用的模块' }),
          SA.h('div', { id: 'stage-recent-empty', class: 'muted' }, '装上模块后显示在这里'));
      }
      if (tools.nextElementSibling !== moduleTools) tools.after(moduleTools);
      moduleTools.hidden = !list.querySelector('.grp');
      let currentList = list;
      if (!moduleTools.hidden) currentList = filterModules(currentList) || currentList;
      renderRecentModules(currentList);
      if (resetScroll) currentList.scrollTop = 0;
      // 只观察库存清单；工具条由本函数维护，避免 hideShopControl 触发自循环。
      if (shopObserver) shopObserver.observe(currentList, { childList: true });
    } finally {
      updatingModuleTools = false;
    }
  }
  window.addEventListener('storage', event => {
    if (event.key !== RECENT_MODULES_KEY) return;
    recentModules = loadRecentModules();
    if (assemblyOpen) updateWorkshopModules();
  });

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])); }
  // 工作台反馈采用非阻塞气泡；保存时不能用 alert 卡住车间和拖拽操作。
  function showToast(message, level = 'ok') {
    const toast = $('stage-toast');
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.className = `stage-toast ${level}`;
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, level === 'bad' ? 6000 : 4500);
  }
  function stageAt(ci, si) { return SA.CAMPAIGN[ci]?.stages?.[si] || null; }
  function actualStage(ci, si) {
    const base = stageAt(ci, si);
    if (!base) return null;
    const out = SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base, source: 'original', locked: false };
    out.vehicle = out.vehicle || SA.V.fromAscii(out.name, out.rows, out.sides || [], out.mt || 1, out.elite || [], out.subs || []);
    return out;
  }
  function cellsOf(v) { return SA.StageCars.cellsOf(v); }

  // 工作台的拼装页直接复用游戏车间编辑器；它操作的是 designMode 隔离存档。
  function currentVehicle() {
    if (assemblyOpen && SA.S?.d?.vehicle) state.vehicle = SA.S.d.vehicle;
    return state.vehicle;
  }
  function syncAssemblyVehicle() { return currentVehicle(); }
  function setWorkingVehicle(vehicle) {
    if (!vehicle) return;
    if (assemblyOpen && SA.S?.d) {
      vehicle.lim = { cols: 8, rows: 6 };
      SA.S.d.vehicle = vehicle;
      SA.Camp.syncLim();
      state.vehicle = SA.S.d.vehicle;
      if (SA.Editor?.refresh) SA.Editor.refresh();
    } else state.vehicle = vehicle;
    renderPreview(state.vehicle); renderStats(state.vehicle);
  }
  function setTab(tab) {
    document.querySelectorAll('[data-tab-panel]').forEach(panel => { panel.hidden = panel.dataset.tabPanel !== tab; });
    document.querySelectorAll('.tab-button').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    if (tab !== 'assembly') { const vehicle = syncAssemblyVehicle(); renderPreview(vehicle); renderStats(vehicle); }
  }
  function ensureEditorNavigation() {
    if (!SA.go) SA.go = name => { SA.current = name; document.body.dataset.screen = name; if (SA.Camp?.syncLim) SA.Camp.syncLim(); };
    if (!SA.nav) SA.nav = name => { if (name === 'garage' && !assemblyOpen) openAssembly(); };
  }
  function hideShopControl() {
    // 设计存档已经把全部模块放进库存；把正常车间里的商店开关 / 提示收掉，避免误以为还要购买。
    const tools = document.querySelector('.assembly-screen .ed-panel .panel-tools');
    if (tools) [...tools.children]
      .filter(child => child.classList.contains('panel-row') && (child.querySelector('.switch') || /商店/.test(child.textContent || '')))
      .forEach(child => child.remove());
    const navSub = document.querySelector('.assembly-screen .nav-plate.on .sub');
    if (navSub && /商店/.test(navSub.textContent || '')) navSub.textContent = '改装 · 全模块';
  }
  function openAssembly() {
    if (assemblyOpen) { setTab('assembly'); return; }
    ensureEditorNavigation();
    try {
      if (!SA.Editor) throw new Error('车间编辑器没有加载');
      assemblyOpen = true;
      SA.Camp.dev.designMode();
      // 沿用当前底稿，包含尚未保存的导入车和上次退出拼装时的改动。
      setWorkingVehicle(SA.V.clone(state.vehicle));
      $('assembly-empty').hidden = true; $('assembly-screen').hidden = false;
      $('assembly-title').innerHTML = $('title').innerHTML;
      setTab('assembly');
      SA.Editor.open();
      shopObserver = new MutationObserver(() => updateWorkshopModules());
      updateWorkshopModules();
      syncAssemblyVehicle();
    } catch (error) {
      assemblyOpen = false;
      if (SA.Camp.isDesignMode()) SA.Camp.dev.exitDesign();
      showToast(`无法打开拼装车间：${error.message}`, 'bad');
    }
  }
  function exitAssembly() {
    if (!assemblyOpen && !SA.Camp.isDesignMode()) return;
    // 先留下设计草稿，再恢复正式存档；退出车间后仍可编辑奖励或保存这台车。
    const vehicle = SA.V.clone(syncAssemblyVehicle());
    SA.current = 'stage-editor'; document.body.dataset.screen = 'stage-editor';
    if (shopObserver) { shopObserver.disconnect(); shopObserver = null; }
    restoreModuleGroups();
    if (SA.Camp.isDesignMode()) SA.Camp.dev.exitDesign();
    assemblyOpen = false;
    $('assembly-screen').hidden = true; $('assembly-empty').hidden = false;
    $('screen').replaceChildren();
    state.vehicle = vehicle;
    renderPreview(vehicle); renderStats(vehicle);
    setTab('overview');
  }

  function unlockModuleIds() { return $('unlock-mods').value.split(',').map(x => x.trim()).filter(Boolean); }
  function renderUnlockSummary() {
    const ids = unlockModuleIds(), names = ids.map(id => SA.MODULES[id]?.name || id);
    $('unlock-mods-summary').innerHTML = names.length ? names.map(name => `<span class="chip">${esc(name)}</span>`).join('') : '<span class="muted">未选择模块</span>';
  }
  function renderModulePicker() {
    const selected = new Set(unlockModuleIds()), grid = $('module-picker-grid'); grid.innerHTML = '';
    const ids = [...new Set((SA.MODULE_ORDER || []).concat(Object.keys(SA.MODULES || {})))].filter(id => SA.MODULES[id] && !SA.MODULES[id].retired);
    ids.forEach(id => {
      const m = SA.MODULES[id], card = document.createElement('label');
      card.className = `module-card ${selected.has(id) ? 'selected' : ''}`;
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = id; checkbox.checked = selected.has(id);
      checkbox.addEventListener('change', () => card.classList.toggle('selected', checkbox.checked));
      const pic = SA.SPR.moduleCanvas(id, 1, 1); pic.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'module-name'; name.textContent = m.name;
      const desc = document.createElement('span'); desc.className = 'module-desc'; desc.textContent = m.desc || '暂无说明';
      card.append(checkbox, pic, name, desc); grid.append(card);
    });
  }
  function openModulePicker() { renderModulePicker(); $('module-picker').hidden = false; }
  function closeModulePicker() { $('module-picker').hidden = true; }
  function confirmModulePicker() {
    const ids = [...$('module-picker-grid').querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    $('unlock-mods').value = ids.join(','); renderUnlockSummary(); closeModulePicker();
  }

  function renderList() {
    let candidateNames = [];
    try { candidateNames = (JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []).map(x => String(x.from || x.name || '')); } catch (error) { candidateNames = []; }
    $('stage-list').innerHTML = targetKeys.map(key => {
      const [ci, si] = key.split(':').map(Number), base = stageAt(ci, si), rec = SA.StageCars.get(ci, si), selected = ci === state.ci && si === state.si;
      if (!base) return '';
      const evolved = !rec && candidateNames.some(name => name.includes(base.name));
      const source = rec ? `<span class="tag manual">手工</span>${rec.locked !== false ? '<span class="tag locked">锁定</span>' : '<span class="tag">可进化</span>'}` : `<span class="tag">原始</span>${evolved ? '<span class="tag">进化候选</span>' : ''}`;
      return `<button data-ci="${ci}" data-si="${si}" class="${selected ? 'selected' : ''}">${esc(ci === 0 ? `序章 ${si + 1}` : `第 ${ci} 章 ${si + 1}`)} · ${esc(rec?.name || base.name)}${source}</button>`;
    }).join('');
    $('stage-list').querySelectorAll('button').forEach(button => button.onclick = () => selectStage(+button.dataset.ci, +button.dataset.si));
  }

  function renderTerrain() {
    $('terrain').innerHTML = Object.keys(SA.TERRAINS).map(id => `<option value="${esc(id)}">${esc(SA.TERRAINS[id].name || id)}</option>`).join('');
  }

  function readFields() {
    let unlock = state.record?.unlock || state.base?.unlock || null;
    const mods = $('unlock-mods').value.split(',').map(x => x.trim()).filter(Boolean);
    const feat = $('unlock-feat').value.split(',').map(x => x.trim()).filter(Boolean);
    const unlockMatText = $('unlock-mat').value.trim();
    const unlockMat = unlockMatText ? +unlockMatText : NaN;
    const gridText = $('unlock-grid').value.trim().toLowerCase().replace(/[×*]/g, 'x');
    const gridMatch = gridText.match(/^(\d+)x(\d+)$/);
    const grid = gridMatch ? { cols: +gridMatch[1], rows: +gridMatch[2] } : undefined;
    if (mods.length || feat.length || Number.isFinite(unlockMat) || grid || unlock) unlock = { ...(unlock || {}), mods, feat };
    if (unlock && Number.isFinite(unlockMat)) unlock.mat = Math.max(1, Math.min(SA.MAT_MAX, unlockMat));
    if (unlock && grid) unlock.grid = { cols: Math.max(1, Math.min(8, grid.cols)), rows: Math.max(1, Math.min(6, grid.rows)) };
    let uniqueLoot = state.record?.uniqueLoot || state.base?.uniqueLoot || [];
    try { uniqueLoot = $('loot').value.trim() ? JSON.parse($('loot').value) : []; } catch (error) { throw new Error(`可缴获件不是有效 JSON：${error.message}`); }
    return {
      name: $('name').value.trim(), pilot: $('pilot').value.trim(), style: $('style').value,
      aim: +$('aim').value, terrain: $('terrain').value, boss: $('boss').checked, prize: +$('prize').value,
      unlock, uniqueLoot, blurb: $('blurb').value, weakness: $('weakness').value,
      locked: state.record ? state.record.locked !== false : true,
    };
  }

  function fillFields(stage) {
    const rec = SA.StageCars.get(state.ci, state.si), base = stageAt(state.ci, state.si);
    state.record = rec;
    $('name').value = stage.name || '';
    $('pilot').value = stage.pilot || '';
    $('style').value = stage.style || 'wander';
    $('aim').value = stage.aim ?? 0.8;
    $('terrain').value = stage.terrain || 'flat';
    $('boss').checked = !!stage.boss;
    $('prize').value = stage.prize || 0;
    $('unlock-mods').value = (stage.unlock?.mods || []).join(',');
    $('unlock-feat').value = (stage.unlock?.feat || []).join(',');
    $('unlock-mat').value = stage.unlock?.mat ?? '';
    $('unlock-grid').value = stage.unlock?.grid ? `${stage.unlock.grid.cols}x${stage.unlock.grid.rows}` : '';
    $('loot').value = JSON.stringify(stage.uniqueLoot || [], null, 2);
    $('blurb').value = stage.blurb || '';
    $('weakness').value = stage.weakness || '';
    renderUnlockSummary();
    const heading = `<h2>${esc(stage.name)} <span class="tag">${stage.source === 'manual' ? '手工' : '原始'}</span>${stage.locked ? '<span class="tag locked">锁定</span>' : ''}</h2><div class="muted">${esc(SA.CAMPAIGN[state.ci].name)} · ${esc(stage.pilot || '')}</div>`;
    $('title').innerHTML = heading;
    $('assembly-title').innerHTML = heading;
    $('title-fields').innerHTML = heading;
    state.base = base;
  }

  function renderPreview(v) {
    const box = $('preview'); box.innerHTML = '';
    if (v) box.appendChild(SA.UI.vehiclePreview(v, 2));
  }

  function weaknessList(v, stats) {
    const out = [];
    const cockpit = [], armor = [], all = [];
    SA.V.each(v, (cell, r, c) => { all.push({ r, c }); if (SA.isCockpit(cell.id)) cockpit.push({ r, c }); if (SA.mod(cell).armor) armor.push({ r, c, a: SA.mod(cell).armor }); });
    if (!cockpit.length) out.push('没有驾驶舱');
    if (cockpit.some(x => !armor.some(a => Math.abs(a.r - x.r) <= 2 && Math.abs(a.c - x.c) <= 2))) out.push('驾驶舱附近缺少装甲，可能暴露');
    const top = SA.V.stats(v).height;
    if (top && !armor.some(x => x.r <= 2)) out.push('顶部没有装甲，容易被高抛火力命中');
    const waterSeconds = stats.heatDps > 0 ? stats.water / stats.heatDps : Infinity;
    if (waterSeconds < 20) out.push(`水量只够约 ${Math.max(0, Math.round(waterSeconds))} 秒武器产热`);
    const xs = all.map(x => x.c), min = Math.min(...xs), max = Math.max(...xs);
    if (Number.isFinite(min) && !armor.some(x => x.c <= min + 1)) out.push('左侧没有装甲覆盖');
    if (Number.isFinite(max) && !armor.some(x => x.c >= max - 1)) out.push('右侧没有装甲覆盖');
    return out;
  }

  function distribution(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => `${value}×${count}`).join('、') || '无';
  }

  function renderStats(v) {
    const box = $('stats'); box.innerHTML = '';
    if (!v) return;
    const s = SA.V.stats(v), pen = [], thick = [];
    SA.V.each(v, cell => { const m = SA.mod(cell); if (m.penetration) pen.push(m.penetration); if (m.armor) thick.push(m.armor); });
    const values = [['评分', s.rating], ['价值', s.value], ['重量', Math.round(s.weight)], ['动力消耗 / 供给', `${s.demand}/${s.supply}`], ['水量', Math.round(s.water)], ['烧干时间', Number.isFinite(s.overheat) ? `${Math.round(s.overheat)} 秒` : '无限'], ['秒伤', s.dps.toFixed(1)], ['穿深分布', distribution(pen)], ['装甲厚度分布', distribution(thick)]];
    box.innerHTML = values.map(([key, value]) => `<div class="stat"><span class="muted">${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
    const weak = weaknessList(v, s);
    $('warnings').innerHTML = `<div class="notice ${s.canDeploy ? 'ok' : 'bad'}">${s.canDeploy ? '可以出战' : `不能出战：${esc(s.problems.join('；'))}`}</div>${weak.length ? `<div class="notice">自动弱点：${weak.map(esc).join('；')}</div>` : ''}`;
  }

  function renderProgress() {
    const rows = targetKeys.map(key => {
      const [ci, si] = key.split(':').map(Number), st = actualStage(ci, si); if (!st) return '';
      const rating = st.vehicle ? SA.V.stats(st.vehicle).rating : 0;
      const target = st.boss ? 'Boss 45～65%' : st.spec?.targetStrength ? `${st.spec.targetStrength[0]}～${st.spec.targetStrength[1]}` : '普通 35～80%';
      const test = state.tests[key] ? `${Math.round(state.tests[key].rate * 100)}%` : '—';
      return `<tr><td>${ci === 0 ? `序章 ${si + 1}` : `第 ${ci} 章 ${si + 1}`}</td><td>${esc(st.name)}</td><td>${rating}</td><td>${esc(target)}</td><td>${test}</td></tr>`;
    }).join('');
    $('progress').innerHTML = `<table><thead><tr><th>关</th><th>车</th><th>评分</th><th>目标强度</th><th>实测胜率</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCandidateList() {
    let picks = [];
    try { picks = JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []; } catch (error) { picks = []; }
    $('candidate').innerHTML = '<option value="">进化报告候选车</option>' + picks.map((p, i) => `<option value="${i}">${esc(p.name || `候选 ${i + 1}`)}${p.from ? ` · ${esc(p.from)}` : ''}</option>`).join('');
  }

  function selectStage(ci, si) {
    if (assemblyOpen) exitAssembly();
    arenaId = null; $('arena-notice').hidden = true;
    for (const id of ['save', 'unlock', 'relock']) $(id).disabled = !targetKeys.includes(`${ci}:${si}`);
    state.ci = ci; state.si = si;
    const st = actualStage(ci, si); state.vehicle = st.vehicle;
    fillFields(st); renderPreview(state.vehicle); renderStats(state.vehicle); renderList(); renderProgress(); renderCandidateList();
    $('test-result').textContent = '尚未测试。';
    // 选中左侧关卡后直接打开右侧车间，避免用户还要再按一次“开始 / 继续拼装”。
    openAssembly();
  }

  // 保存后只刷新工作台数据；拼装页保持打开，避免用户每保存一次就被踢回概览。
  function refreshAfterSave(result) {
    state.record = result.record;
    const vehicle = syncAssemblyVehicle();
    const stage = actualStage(state.ci, state.si);
    stage.vehicle = vehicle;
    fillFields(stage);
    state.vehicle = vehicle;
    renderList(); renderPreview(vehicle); renderStats(vehicle); renderProgress();
  }

  function parseImport(value) {
    const text = value.trim();
    if (!text) throw new Error('导入内容为空');
    if (text.startsWith('SA1.') || text.startsWith('SA2.')) return SA.V.decode(text);
    const json = JSON.parse(text), cells = Array.isArray(json) ? json : json.cells;
    if (!Array.isArray(cells)) throw new Error('需要分享码或 cells 模块清单');
    return SA.V.fromCells($('name').value || '导入关卡车', cells);
  }

  async function saveRecord(lockValue) {
    // 保存按钮可以在任意页签按下；如果用户刚退出车间，先自动恢复隔离设计存档。
    if (!assemblyOpen) openAssembly();
    if (!assemblyOpen || !SA.Camp?.dev?.saveStageCar) throw new Error('车间尚未打开，无法保存关卡车');
    const vehicle = syncAssemblyVehicle(), meta = readFields(); if (lockValue !== undefined) meta.locked = lockValue;
    const preview = SA.StageCars.makeRecord(state.ci, state.si, state.base, vehicle, meta);
    const check = SA.StageCars.validate(preview, state.ci, state.si, vehicle);
    if (!check.ok) throw new Error(check.errors.join('；'));

    // 统一走规则层保存接口：先写浏览器本机存档并广播给正式游戏页，再尽力同步 js/stage-cars.js。
    const result = await SA.Camp.dev.saveStageCar(state.ci, state.si, meta);
    if (!result || !result.record) throw new Error('保存接口没有返回关卡车记录');
    const records = { ...(SA.STAGE_CARS.records || {}), [result.record.id]: result.record };
    SA.STAGE_CARS.records = records;
    if (SA.StageCars.applyToCampaign) SA.StageCars.applyToCampaign();
    return { ...result, check };
  }

  function saveNotice(result, action) {
    const warning = result.check?.warnings?.length ? `\n警告：${result.check.warnings.join('；')}` : '';
    if (result.filePersisted) return `已${action}，同时写入 js/stage-cars.js；正式游戏已立即应用，无需重启。${warning}`;
    if (result.localPersisted || result.channelSent) return `已${action}到本机存档，正式游戏已立即应用，无需启动写入服务或重启。${warning}`;
    return `已${action}到当前页面，但浏览器禁止本机存档；保持正式游戏页面打开即可看到本次修改，关闭页面后不会保留。${warning}`;
  }

  function testVehicle() {
    const vehicle = syncAssemblyVehicle();
    if (!vehicle) throw new Error('请先准备一台关卡车');
    const games = Math.max(1, Math.min(200, +$('games').value || 20)), refs = [SA.V.fromAscii('开局参考车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || [])];
    for (let ci = 0; ci <= state.ci; ci++) for (let si = 0; si < SA.CAMPAIGN[ci].stages.length; si++) if (ci < state.ci || si < state.si) refs.push(actualStage(ci, si).vehicle);
    const rows = [], counts = { p: 0, e: 0, draw: 0, timeout: 0 }; let wins = 0, total = 0, time = 0;
    refs.slice(-4).forEach((ref, ri) => { for (let i = 0; i < games; i++) {
      const seed = 0x5eed + state.ci * 10000 + state.si * 1000 + ri * 100 + i;
      const a = SA.Battle.simulate({ p: ref, e: vehicle, pAim: 0.8, eAim: +$('aim').value, pStyle: 'wander', eStyle: $('style').value, terrain: $('terrain').value, eBoss: $('boss').checked, seed });
      const b = SA.Battle.simulate({ p: vehicle, e: ref, pAim: +$('aim').value, eAim: 0.8, pStyle: $('style').value, eStyle: 'wander', terrain: $('terrain').value, seed: seed + 1 });
      for (const [result, candidateSide] of [[a, 'e'], [b, 'p']]) { const winner = result.winner || 'draw'; counts[winner] = (counts[winner] || 0) + 1; if (winner === candidateSide) wins++; total++; time += result.t || 0; }
    } });
    const rate = total ? wins / total : 0, z = 1.96, den = 1 + z * z / total, centre = rate + z * z / (2 * total), spread = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total);
    const lo = (centre - spread) / den, hi = (centre + spread) / den;
    state.tests[`${state.ci}:${state.si}`] = { rate, lo, hi, total };
    const boss = $('boss').checked, reward = !!(state.record?.unlock?.mods?.length || state.base?.spec?.reward);
    const range = boss ? [0.45, 0.65] : reward ? [0.4, 0.7] : [0.35, 0.8];
    const soft = boss ? [0.3, 0.78] : [0.2, 0.9];
    const level = rate >= range[0] && rate <= range[1] ? 'ok' : rate >= soft[0] && rate <= soft[1] ? 'warn' : 'bad';
    const label = level === 'ok' ? '绿色：目标范围内' : level === 'warn' ? '黄色：接近目标，建议扩大样本' : '红色：偏离目标，需要复核';
    $('test-result').className = `notice ${level}`;
    $('test-result').innerHTML = `${label}：候选车胜率 <b>${(rate * 100).toFixed(1)}%</b>（95% ${(lo * 100).toFixed(1)}%～${(hi * 100).toFixed(1)}%），平均用时 ${(time / Math.max(1, total)).toFixed(1)} 秒；结局 p/e/平 ${counts.p || 0}/${counts.e || 0}/${counts.draw || 0}。表现分 ${(rate * 100).toFixed(1)}。`;
    renderProgress();
  }

  document.querySelectorAll('.tab-button').forEach(button => button.onclick = () => setTab(button.dataset.tab));
  $('assembly-open').onclick = openAssembly;
  $('assembly-exit').onclick = exitAssembly;
  $('open-modules').onclick = openModulePicker;
  $('module-picker-cancel').onclick = closeModulePicker;
  $('module-picker-confirm').onclick = confirmModulePicker;
  $('save').onclick = async () => { try { const result = await saveRecord(); refreshAfterSave(result); showToast(saveNotice(result, '保存并锁定'), result.persisted ? 'ok' : 'warn'); } catch (error) { showToast(`保存失败：${error.message}`, 'bad'); } };
  // 擂台保存不经过 saveStageCar，不广播正式关卡变化，也不写 stage-cars.js。
  $('save-arena').onclick = () => {
    try {
      // 擂台使用拼装车间里的车名；关卡文字页的名称继续服务于正式关卡。
      const vehicle = syncAssemblyVehicle();
      const row = SA.EvolveArena.saveEdited(arenaId, vehicle, { chapter: state.ci, stage: state.si,
        name: vehicle.name?.trim() || $('name').value.trim(), style: $('style').value, terrain: $('terrain').value });
      arenaId = row.id;
      $('arena-notice').hidden = false;
      $('arena-notice').textContent = '已保存到进化擂台 · 手工修改 · 待重新模拟。返回报告即可查看，后续生成会使用符合该关规则的构筑作种子。';
      showToast('已保存到进化擂台，正式关卡未改动。');
    } catch (error) { showToast(`擂台保存失败：${error.message}`, 'bad'); }
  };
  $('unlock').onclick = async () => { try { const result = await saveRecord(false); refreshAfterSave(result); showToast(saveNotice(result, '保存并解锁'), result.persisted ? 'ok' : 'warn'); } catch (error) { showToast(`解锁保存失败：${error.message}`, 'bad'); } };
  $('relock').onclick = async () => { try { const result = await saveRecord(true); refreshAfterSave(result); showToast(saveNotice(result, '保存并重新锁定'), result.persisted ? 'ok' : 'warn'); } catch (error) { showToast(`重新锁定失败：${error.message}`, 'bad'); } };
  $('import').onclick = () => { $('import-box').hidden = false; $('import-value').focus(); };
  $('import-cancel').onclick = () => { $('import-box').hidden = true; $('import-value').value = ''; };
  $('import-confirm').onclick = () => {
    const value = $('import-value').value;
    if (!value.trim()) { showToast('请先粘贴 SA2 分享码或完整模块清单', 'warn'); return; }
    try {
      setWorkingVehicle(parseImport(value));
      $('import-box').hidden = true;
      $('import-value').value = '';
    } catch (error) { showToast(error.message, 'bad'); }
  };
  $('candidate-import').onclick = () => {
    const raw = $('candidate').value;
    if (!raw) { showToast('请先选择一辆进化报告候选车', 'warn'); return; }
    const i = Number(raw); if (!Number.isInteger(i)) { showToast('候选车编号无效', 'bad'); return; }
    let picks = []; try { picks = JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []; } catch (error) { showToast(`候选车列表读取失败：${error.message}`, 'bad'); return; }
    const p = picks[i]; if (!p) { showToast('候选车不存在，请重新打开进化报告', 'warn'); return; }
    try { setWorkingVehicle(p.cells ? SA.V.fromCells($('name').value || p.name, p.cells) : SA.V.decode(p.code)); }
    catch (error) { showToast(`候选车导入失败：${error.message}`, 'bad'); }
  };
  $('test').onclick = () => { try { testVehicle(); } catch (error) { $('test-result').className = 'notice bad'; $('test-result').textContent = `测试失败：${error.message}`; } };
  $('drive').onclick = () => {
    const vehicle = syncAssemblyVehicle();
    if (!vehicle) { showToast('请先选择一关并打开车间', 'warn'); return; }
    localStorage.setItem('steam_arena_evolve_picks', JSON.stringify([{ name: $('name').value || '手工关卡车', cells: cellsOf(vehicle), terrain: $('terrain').value, style: $('style').value, from: `关卡车工作台 · ${$('name').value}` }]));
    const opened = window.open('../index.html#sandbox=evolve', '_blank', 'noopener');
    // 某些内置浏览器会拦截脚本新标签；同页跳转仍然能进入现有试驾场。
    if (!opened) window.location.href = '../index.html#sandbox=evolve';
  };
  renderTerrain();
  try { SA.S.load(); SA.Camp.backfill(); } catch (error) { console.warn('工具页没有正式存档，继续使用原始关卡数据', error); }
  const requestedArena = new URLSearchParams(location.search).get('arena');
  try {
    const row = requestedArena && SA.EvolveArena.get(requestedArena);
    if (requestedArena && !row) throw new Error('找不到这台擂台候选，请从进化报告重新打开');
    const sp = row?.record.spec;
    selectStage(sp?.chapter ?? 0, sp?.stage ?? 0);
    if (row) {
      arenaId = row.id;
      const rec = row.record;
      setWorkingVehicle(rec.cells ? SA.V.fromCells(rec.name, rec.cells) : SA.V.decode(rec.code));
      $('name').value = rec.name || $('name').value; $('style').value = rec.style || 'wander';
      $('arena-notice').hidden = false;
      $('arena-notice').textContent = `正在修改擂台候选：${rec.name || '候选车'}。使用“保存到进化擂台”保存构筑、名称和性格；关卡奖励与文字由正式关卡保存处理。`;
      // 后续章节可在擂台编辑，但正式工作台的写入范围仍遵守原有约定。
      const supported = targetKeys.includes(`${state.ci}:${state.si}`);
      for (const id of ['save', 'unlock', 'relock']) $(id).disabled = !supported;
    }
  } catch (error) { selectStage(0, 0); showToast(error.message, 'bad'); }
})();
