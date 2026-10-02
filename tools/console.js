// 蒸汽竞技场 · 后台：把分散在各页的工作台、剧情、院子闲聊、视觉样机和游戏调试收进一个页面。
// 新界面直接调用后台维护的数据接口：
//   关卡车：嵌在「关卡 › 拼装」里的 console-garage.html（游戏车间编辑器 + 隔离设计存档 + SA.Camp.dev.saveStageCar）
//   剧情：SA.StoryData　院子闲聊：SA.YardChat　共用文本文件：SA.Text
// 还没重做的工作台（进化擂台、数值自测、模块属性）原样嵌在框里用。
// 这里只做界面和流程；数据规则、校验和写文件都走原接口。
(() => {
  'use strict';
  const PREF_KEY = 'steam_arena_console_v1';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* 隐私模式：只在本页记住 */ } };
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- DOM 小工具：文字一律走 textContent ----------
  function el(tag, props, ...kids) {
    const idm = /#([\w-]+)/.exec(tag);
    const [name, ...cls] = tag.replace(/#[\w-]+/, '').split('.');
    const n = document.createElement(name || 'div');
    if (idm) n.id = idm[1];
    if (cls.length) n.className = cls.join(' ');
    let value;
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = `${n.className} ${v}`.trim();
      else if (k === 'text') n.textContent = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k === 'value') value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') n[k] = !!v;
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    if (value !== undefined) n.value = value;
    return n;
  }
  const ICONS = {
    up: '<path d="M8 4l5 6H3z"/>',
    down: '<path d="M8 12L3 6h10z"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    plus: '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    play: '<path d="M5 3l8 5-8 5z"/>',
    ext: '<path d="M9 3h4v4M13 3L7 9M11 9v4H3V5h4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    reload: '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 3v3h-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    chev: '<path d="M3 5l5 6 5-6z"/>',
    left: '<path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    right: '<path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function icon(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name];   // 图标是本文件里固定的字符串
    return s;
  }
  const miniBtn = (name, title, onClick, cls = '') => el(`button.mini-btn${cls ? '.' + cls : ''}`, { type: 'button', title, 'aria-label': title, on: { click: onClick } }, icon(name));

  // 自动长高的多行输入框
  function autoGrow(t) { const fit = () => { t.style.height = 'auto'; t.style.height = `${Math.max(30, t.scrollHeight + 2)}px`; }; t.addEventListener('input', fit); requestAnimationFrame(fit); return t; }

  // 两步确认的危险按钮：第一次点变红，3 秒内再点才执行
  function armedButton(label, armedLabel, onFire, cls = 'btn sm danger') {
    let timer = 0;
    const b = el('button', { type: 'button', class: cls, text: label });
    b.addEventListener('click', () => {
      if (b.classList.contains('armed')) { clearTimeout(timer); b.classList.remove('armed'); b.textContent = label; onFire(); return; }
      b.classList.add('armed'); b.textContent = armedLabel;
      timer = setTimeout(() => { b.classList.remove('armed'); b.textContent = label; }, 3000);
    });
    return b;
  }

  let toastTimer = 0;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg; t.className = `toast ${kind}`; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'bad' ? 7000 : kind === 'warn' ? 5000 : 3200);
  }

  // ---------- 还没重做的工作台、视觉页 ----------
  const TOOLS = {
    'stage-editor': { name: '关卡车工作台（旧版）', url: 'stage-editor.html', old: true, desc: '旧版关卡车工作台；拼装已经搬进「关卡」，这里留着备用' },
    'config-editor': { name: '正式配置编辑', url: 'config-editor.html', desc: '直接读取并保存 config 目录里的正式 JSON' },
    evolve: { name: '进化擂台', url: 'evolve.html', old: true, desc: '关卡车进化生成器：选关、强度 × 表现散点、分类网格、候选库' },
    selftest: { name: '数值自测', url: 'evolve.html#selftest', old: true, desc: 'AI 对 AI 批量对打：战役检验、对战矩阵、模块性价比' },
    modules: { name: '模块属性', url: 'module-editor.html', old: true, desc: '改模块的文字与玩法属性，保存到模块数据' },
    'yard-legacy': { name: '院子聊天（旧版）', url: 'yard-chat-editor.html', old: true, desc: '旧版院子聊天工作台' },
    current: { name: '当前开发', url: 'current.html', desc: '正在开发、等你确认的东西' },
    candidates: { name: '模块造型 · 全部进度', url: 'module-candidates.html', desc: '全部模块的定稿、候选和占位' },
    spritesheet: { name: '精灵表', url: 'spritesheet.html', desc: '全部模块按材料排成表' },
    style: { name: '美术风格参考', url: 'style-guide.html', desc: '风格速查与全部模块的实物' },
    audit: { name: '视觉审计', url: 'visual-audit.html', desc: '画面自动检查' },
  };

  const NAV = [
    { items: [{ id: 'home', name: '总览', path: 'home' }] },
    { group: '战役', items: [
      { id: 'stage', name: '关卡', path: 'stage', tag: 'new' },
      { id: 'config-editor', name: '正式配置', path: 'open/config-editor', tag: 'new' },
      { id: 'evolve', name: '进化擂台', path: 'open/evolve', tag: 'old' },
      { id: 'selftest', name: '数值自测', path: 'open/selftest', tag: 'old' },
    ] },
    { group: '剧情与对话', items: [
      { id: 'story', name: '剧情', path: 'story', tag: 'new' },
      { id: 'chat', name: '院子闲聊', path: 'chat', tag: 'new' },
      { id: 'text', name: '页面文字', path: 'game/text' },
    ] },
    { group: '模块', items: [{ id: 'modules', name: '模块属性', path: 'open/modules', tag: 'old' }] },
    { group: '视觉', items: [
      { id: 'current', name: '当前开发', path: 'open/current' },
      { id: 'candidates', name: '模块造型 · 全部进度', path: 'open/candidates' },
      { id: 'labs', name: '样机目录', path: 'labs', tag: 'new' },
      { id: 'spritesheet', name: '精灵表', path: 'open/spritesheet' },
      { id: 'style', name: '美术风格参考', path: 'open/style' },
    ] },
    { group: '游戏与调试', items: [{ id: 'game', name: '游戏', path: 'game', tag: 'new' }] },
  ];

  // ---------- 战役数据 ----------
  const STYLE = { wander: '游走', rush: '冲锋', kite: '放风筝', turtle: '龟缩', rookie: '新手', roam: '游走' };
  const chShort = (ch) => ch.name.split(' · ')[0];
  const chPlace = (ch) => ch.name.split(' · ')[1] || ch.place || '';
  const validKey = (k) => /^\d+,\d+$/.test(k || '') && !!SA.CAMPAIGN[+k.split(',')[0]]?.stages[+k.split(',')[1]];
  const recordOf = (ci, si) => SA.STAGE_CARS?.records?.[`${ci}:${si}`] || null;
  function stageData(ci, si) {
    const ch = SA.CAMPAIGN[ci], base = ch && ch.stages[si];
    if (!base) return null;
    let m;
    try { m = SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base, source: 'original' }; } catch (e) { m = { ...base, source: 'original' }; }
    let v = m.vehicle;
    if (!v) try { v = SA.V.fromAscii(m.name, m.rows || [], m.sides || [], m.mt || 1, m.elite || [], m.subs || []); } catch (e) { v = null; }
    const rec = recordOf(ci, si);
    if (v && rec?.vehicleName) v.name = rec.vehicleName;   // 车名和关卡名分开存（规则层在游戏页里打的补丁，这里照着读）
    return { ...m, ci, si, key: `${ci},${si}`, code: `${ci}-${si + 1}`, chapter: ch, vehicle: v };
  }
  const stageLabel = (key) => {
    const [ci, si] = key.split(',').map(Number), st = SA.CAMPAIGN[ci]?.stages[si];
    return st ? `${ci}-${si + 1} ${st.name}` : key;
  };
  const allStages = () => SA.CAMPAIGN.flatMap((ch, ci) => ch.stages.map((_, si) => `${ci},${si}`));
  const carJson = (v) => { try { return v ? JSON.stringify(SA.StageCars.cellsOf(v)) : ''; } catch (e) { return ''; } };

  // 手工关卡车存在浏览器本机、或别的页面刚保存时，本页跟着换成新记录
  const LOCAL_CARS = 'steam_arena_stage_cars_local_v1';
  function applyStageCars(records) {
    if (!SA.STAGE_CARS || !SA.StageCars || !records) return;
    SA.STAGE_CARS.records = { ...(SA.STAGE_CARS.records || {}), ...records };
    try { SA.StageCars.applyToCampaign(); } catch (e) { console.warn(e); }
  }
  function applyLocalCars() {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_CARS) || 'null');
      if (local && local.records && (local.campaignLayout || 1) === SA.CAMPAIGN_LAYOUT) applyStageCars(local.records);
    } catch (e) { /* 本机没有手工车 */ }
  }

  // ---------- 剧情场景 ----------
  const OUTCOME = { win: '胜利', lose: '失败' };
  function sceneLabel(id) {
    if (id === 'opening') return '开场';
    if (id === 'tutorial.intro') return '第一关教程 · 开场白';
    let m = /^tutorial\.parts\.(\d+)$/.exec(id);
    if (m) { const p = SA.STORY.tutorial.parts[+m[1]]; return `第一关教程 · 讲解${p ? p.label : m[1]}`; }
    m = /^stage\.(\d+,\d+)\.(win|lose)$/.exec(id);
    if (m) return `${stageLabel(m[1])} · ${OUTCOME[m[2]]}`;
    m = /^(before|after)\.(.+)$/.exec(id);
    if (m) return `${m[2] === 'current' ? '非战役对战' : stageLabel(m[2])} · ${m[1] === 'before' ? '战前' : '战后'}`;
    m = /^feat\.(.+)$/.exec(id);
    if (m) return `功能开放 · ${SA.FEATURES[m[1]] || m[1]}`;
    return id;
  }
  const sceneEdited = (id) => sceneLines(id).length > 0;
  const sceneLines = (id) => { try { return SA.StoryData.get(id); } catch (e) { return []; } };

  // ---------- 院子闲聊 ----------
  const CHAT_WHO = { rel: '远房亲戚', tom: '铁匠 老汤姆', tim: '学徒 小提米' };
  const ACTIONS = { talk: '说话', yelp: '惊叫', sleep: '打盹', jolt: '惊醒' };
  const WEATHER = { any: '任何天气', rain: '雨天', night: '夜里' };
  function scopeName(scope) {
    if (scope === 'global') return '全局默认';
    if (scope === 'default') return '内置默认';
    const p = scope.split(':').map(Number), ch = SA.CAMPAIGN[p[1]];
    if (!ch) return scope;
    return scope.startsWith('chapter:') ? ch.name : `${p[1]}-${p[2] + 1} ${ch.stages[p[2]]?.name || ''}`;
  }
  const scopeOwn = (scope) => !!SA.Text.get(`home:chat:pool:${scope}`, '');
  const chatDrafts = new Map();   // scope → { groups, source, dirty, mode }
  function chatDraft(scope) {
    if (!chatDrafts.has(scope)) {
      const d = SA.YardChat.read(scope);
      chatDrafts.set(scope, { groups: clone(d.groups), source: d.source, dirty: false, mode: 'write' });
    }
    return chatDrafts.get(scope);
  }
  let settingsDraft = null, clickDraft = null;

  // ---------- 关卡草稿：拼装台上的车 + 关卡资料（文字、奖励、解锁、锁定） ----------
  const stageDrafts = new Map();   // key → { fields, cells, base, dirtyCar, dirtyFields, arenaId, test }
  function fieldsFrom(st) {
    const rec = recordOf(st.ci, st.si);
    return {
      name: st.name || '', vehicleName: rec?.vehicleName || st.vehicle?.name || st.name || '', pilot: st.pilot || '',
      style: st.style || 'wander', aim: st.aim ?? 0.8, terrain: st.terrain || 'flat', boss: !!st.boss, prize: st.prize || 0,
      rewardMoney: st.rewardMoney !== false, victoryRepairFree: st.victoryRepairFree === true,
      blurb: st.blurb || '', weakness: st.weakness || '',
      unlock: clone(st.unlock || null), rewardItems: clone(st.rewardItems || []), lootText: JSON.stringify(st.uniqueLoot || [], null, 2),
      locked: rec ? rec.locked !== false : true,
    };
  }
  function stageDraft(key) {
    if (!stageDrafts.has(key)) {
      const [ci, si] = key.split(',').map(Number), st = stageData(ci, si);
      stageDrafts.set(key, { fields: fieldsFrom(st), cells: null, base: carJson(st.vehicle), dirtyCar: false, dirtyFields: false, arenaId: null, test: null });
    }
    return stageDrafts.get(key);
  }
  const stageDirty = (key) => { const d = stageDrafts.get(key); return !!(d && (d.dirtyCar || d.dirtyFields)); };
  const dirtyStages = () => [...stageDrafts.entries()].filter(([, d]) => d.dirtyCar || d.dirtyFields).map(([k]) => k);
  let liveCarState = null;   // 拼装页签开着时，工具条上的「改了」提示跟着刷新
  function touchFields(key) { stageDraft(key).dirtyFields = true; refreshStatus(); markTree(); liveCarState?.(); }

  // 资料 → 保存用的 meta：字段和旧工作台（tools/stage-editor.js readFields）一致，先在这里查一遍、说人话
  function buildMeta(d) {
    const f = d.fields;
    if (!f.vehicleName.trim()) throw new Error('车名不能为空');
    const rewardItems = (f.rewardItems || []).map((it, i) => {
      const id = it.id, count = Number(it.count), mt = Number(it.mt);
      if (!SA.MODULES[id] || SA.MODULES[id].retired) throw new Error(`第 ${i + 1} 项固定奖励还没选物品`);
      if (!Number.isSafeInteger(count) || count < 1) throw new Error(`第 ${i + 1} 项固定奖励的数量要是正整数`);
      if (!Number.isInteger(mt) || !SA.MATS[mt] || mt < SA.minMt(id) || mt > SA.maxMt(id)) throw new Error(`第 ${i + 1} 项固定奖励的材料不适用于「${SA.MODULES[id].name}」`);
      return { id, count, mt };
    });
    let uniqueLoot;
    try { uniqueLoot = f.lootText.trim() ? JSON.parse(f.lootText) : []; } catch (e) { throw new Error(`可缴获唯一件不是有效的 JSON：${e.message}`); }
    let unlock = f.unlock ? clone(f.unlock) : null;
    if (unlock) {
      unlock.mods = (unlock.mods || []).filter((id) => SA.MODULES[id]);
      unlock.feat = (unlock.feat || []).filter((x) => SA.FEATURES[x]);
      if (!unlock.mat) delete unlock.mat; else unlock.mat = Math.max(1, Math.min(SA.MAT_MAX, Number(unlock.mat)));
      if (!unlock.grid || !unlock.grid.cols || !unlock.grid.rows) delete unlock.grid;
      else unlock.grid = { cols: Math.max(1, Math.min(8, Number(unlock.grid.cols))), rows: Math.max(1, Math.min(6, Number(unlock.grid.rows))) };
      if (!unlock.note || !String(unlock.note).trim()) delete unlock.note;
    }
    return {
      name: f.name.trim(), vehicleName: f.vehicleName.trim(), pilot: f.pilot.trim(), style: f.style, aim: Number(f.aim), terrain: f.terrain, boss: !!f.boss,
      prize: Number(f.prize) || 0, unlock, uniqueLoot, rewardItems, rewardMoney: !!f.rewardMoney, victoryRepairFree: !!f.victoryRepairFree,
      blurb: f.blurb, weakness: f.weakness, locked: f.locked !== false,
    };
  }

  // ---------- 拼装台：整个后台只开一个 console-garage.html，切关、切页签都不重新载入 ----------
  const garage = { layer: null, frame: null, ready: null, key: null, slot: null, ro: null, poll: 0 };
  const garageApi = () => { try { return garage.frame?.contentWindow?.Garage || null; } catch (e) { return null; } };
  function ensureGarage() {
    if (garage.ready) return garage.ready;
    if (!garage.layer) {
      garage.frame = el('iframe', { src: 'console-garage.html', title: '拼装台' });
      garage.layer = el('div#garage-layer', null, garage.frame);
      hideGarage();
      $('#main').append(garage.layer);
    } else garage.frame.src = 'console-garage.html';
    garage.key = null;
    garage.ready = new Promise((resolve, reject) => {
      const t0 = Date.now();
      const poll = () => {
        const G = garageApi();
        if (G && G.ready) resolve(G);
        else if (Date.now() - t0 > 30000) reject(new Error('拼装台加载超时'));
        else setTimeout(poll, 120);
      };
      poll();
    });
    garage.ready.catch(() => { garage.ready = null; });
    return garage.ready;
  }
  // 不显示时也保留真实大小（挪到画面外），免得车间在 0 尺寸里排版
  function hideGarage() {
    if (!garage.layer) return;
    Object.assign(garage.layer.style, { left: '-12000px', top: '0px', width: '1000px', height: '720px', visibility: 'hidden' });
  }
  function placeGarage() {
    if (!garage.layer) return;
    if (!garage.slot || !garage.slot.isConnected || !garageApi()) { hideGarage(); return; }
    const m = $('#main').getBoundingClientRect(), r = garage.slot.getBoundingClientRect();
    Object.assign(garage.layer.style, { left: `${r.left - m.left}px`, top: `${r.top - m.top}px`, width: `${r.width}px`, height: `${r.height}px`, visibility: 'visible' });
  }
  window.addEventListener('resize', placeGarage);
  // 把拼装台上那一关的现状记进它的草稿
  function captureGarage() {
    const G = garageApi();
    if (!G || !garage.key) return;
    const d = stageDraft(garage.key), now = G.cellsJson();
    d.dirtyCar = !!now && now !== d.base;
    d.cells = d.dirtyCar ? now : null;
  }
  async function garageOpen(key) {
    const G = await ensureGarage();
    if (garage.key === key) return G;
    captureGarage();
    const [ci, si] = key.split(',').map(Number), d = stageDraft(key);
    G.open(ci, si, d.cells ? JSON.parse(d.cells) : null, d.fields.vehicleName);
    garage.key = key;
    if (!d.cells) d.base = G.cellsJson();   // 以拼装台读到的样子为准，免得两边排列不同误报改动
    return G;
  }
  // 车间铭牌上改了车名：记进草稿，工具条上的车名跟着变
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'garage-name' || !garage.key) return;
    const d = stageDraft(garage.key);
    d.fields.vehicleName = String(e.data.name || '');
    touchFields(garage.key);
    const input = $('.build-bar .name');
    if (input && input.value !== d.fields.vehicleName) input.value = d.fields.vehicleName;
  });

  // ---------- 保存：关卡车走规则层的保存接口，剧情和闲聊写共用文本文件；Ctrl+S 一次存完 ----------
  const textDirty = { story: new Set(), chat: new Set(), settings: false, tips: new Set() };
  const isTextDirty = () => !!(textDirty.story.size || textDirty.chat.size || textDirty.settings || textDirty.tips.size);
  const isDirty = () => isTextDirty() || dirtyStages().length > 0;
  function setStatus(state, detail) {
    const s = $('#status');
    if (!s) return;
    s.dataset.state = state;
    const label = { clean: '已保存', dirty: '有改动 · Ctrl+S 保存', saving: '正在保存…', error: '保存失败 · 点此重试' }[state];
    s.replaceChildren(el('i'), label);
    const n = dirtyStages().length;
    const parts = [n && `${n} 关的关卡车或资料`, textDirty.story.size && `${textDirty.story.size} 幕剧情`, textDirty.chat.size && `${textDirty.chat.size} 个闲聊范围`,
      textDirty.settings && '闲聊节奏', textDirty.tips.size && '点击人物对话'].filter(Boolean);
    s.title = detail || (parts.length ? `待保存：${parts.join('、')}` : '全部已保存');
  }
  const refreshStatus = () => setStatus(isDirty() ? 'dirty' : 'clean');
  function markTree() {
    document.querySelectorAll('.st-item[data-key]').forEach((b) => {
      const dot = b.querySelector('.dot'), on = stageDirty(b.dataset.key);
      if (on && !dot) b.querySelector('.marks')?.prepend(el('span.dot', { title: '未保存' }));
      if (!on && dot) dot.remove();
    });
  }
  async function saveStage(key) {
    const d = stageDraft(key), meta = buildMeta(d);
    const G = await garageOpen(key);
    const res = await G.save(meta);
    applyStageCars({ [res.record.id]: res.record });
    stageDrafts.delete(key);
    stageDraft(key).base = G.cellsJson();
    return res;
  }
  function stageNotice(res) {
    const warn = res.warnings?.length ? `\n提醒：${res.warnings.join('；')}` : '';
    if (res.filePersisted) return `已写进 js/stage-cars.js，开着的游戏页也换上了。${warn}`;
    if (res.persisted) return `只存到了本机浏览器，尚未写入正式配置；请用 python tools/serve.py 打开后台并重试保存。${warn}`;
    return `只在当前页面生效，关掉就没了：浏览器不让存本机。${warn}`;
  }
  let saving = false;
  async function saveAll() {
    if (saving) return;
    captureGarage();
    if (!isDirty()) { toast('没有需要保存的改动'); refreshStatus(); return; }
    saving = true; setStatus('saving');
    const done = [], fails = [];
    let soft = false;
    try {
      for (const key of dirtyStages()) {
        try {
          const res = await saveStage(key);
          done.push(`${stageLabel(key)}：${stageNotice(res)}`);
          if (!res.filePersisted || res.warnings?.length) soft = true;
        } catch (e) { fails.push(`${stageLabel(key)} 没保存：${e.message || e}`); }
      }
      if (isTextDirty()) {
        let staged = false;
        try {
          // 先全部校验，免得一个范围出错时别的已经进入待写配置。
          for (const scope of textDirty.chat) { const c = chatDrafts.get(scope); if (c && c.mode !== 'inherit') SA.YardChat.validateGroups(c.groups); }
          if (textDirty.settings) SA.YardChat.validateSettings(settingsDraft);
          for (const scope of textDirty.chat) {
            const c = chatDrafts.get(scope);
            if (!c) continue;
            if (c.mode === 'inherit') SA.YardChat.inherit(scope); else SA.YardChat.write(scope, c.groups);
            staged = true;
          }
          if (textDirty.settings) { SA.YardChat.setSettings(settingsDraft); staged = true; }
          for (const who of textDirty.tips) { SA.Text.set(`home:tip:${who}`, clickDraft[who]); staged = true; }
          const result = await SA.YardChat.save();   // 写共用文本文件，并通知开着的游戏页
          if (!result || !result.ok) throw result?.error || new Error('配置写入没有成功');
          else {
            for (const scope of textDirty.chat) chatDrafts.delete(scope);
            textDirty.story.clear(); textDirty.chat.clear(); textDirty.settings = false; textDirty.tips.clear();
            done.push(`剧情和闲聊：已写进 ${SA.Text.file()}`);
          }
        } catch (e) {
          fails.push(`剧情和闲聊：${staged ? '配置未写入，修改仍在本页' : '没保存，改动还在页面上'}——${e.message || e}`);
        }
      }
    } finally { saving = false; }
    if (fails.length) { setStatus(isDirty() ? 'error' : 'clean', fails.join('\n')); toast([...fails, ...done].join('\n'), 'bad'); }
    else { refreshStatus(); toast(done.join('\n') || '已保存', soft ? 'warn' : ''); }
    route(true);
  }

  // ---------- 剧情脚本编辑 ----------
  // 每次编辑经 SA.StoryData.set 校验并留在本页，点击保存才写入正式配置。
  // 右边：表情窗（这一句说话人的表情 + 说话动作，点小图换表情）、对话框预览、完整重放（tools/story-player.html，游戏自己的对话框）
  function scriptEditor(id) {
    const cast = Object.entries(SA.STORY.cast || {});
    const nameOf = (who) => (SA.STORY.cast[who] && SA.STORY.cast[who].name) || '旁白';
    const SCENES = { sleep: '睡觉', roof: '掀屋顶', roll: '滚进来', car: '战车' };
    const EXPRS = SA.Story.exprs();
    const exprName = (k) => (EXPRS.find(([x]) => x === k) || EXPRS[0])[1];
    let lines = sceneLines(id).map((l) => ({ ...l }));
    let sel = 0, err = '', typing = 0;
    const root = el('div.script');
    const main = el('div.script-main'), side = el('div.vn');
    root.append(main, side);

    function commit() {
      const empty = lines.findIndex((l) => !l.text.trim());
      if (empty >= 0) { err = `第 ${empty + 1} 句还是空的，写完才能保存`; showErr(); return; }
      try {
        SA.StoryData.set(id, lines.map((l) => ({ text: l.text, who: l.who || undefined, expr: (l.who && l.expr) || undefined, ...(id === 'opening' ? { scene: l.scene || undefined } : {}) })));
        err = ''; textDirty.story.add(id); refreshStatus();
      } catch (e) { err = e.message || String(e); }
      showErr();
    }
    const errBox = el('div.err', { role: 'status', 'aria-live': 'polite' });
    function showErr() { errBox.textContent = err; }

    function row(l, i) {
      const who = el('select', { 'aria-label': `第 ${i + 1} 句说话人`, on: { change: (e) => { l.who = e.target.value; if (!l.who) l.expr = undefined; sel = i; commit(); render(); } } },
        el('option', { value: '', text: '旁白' }), cast.map(([k, c]) => el('option', { value: k, text: c.name })));
      who.value = l.who || '';
      const kids = [who];
      if (l.who) {
        const ex = el('select.expr', { 'aria-label': `第 ${i + 1} 句表情`, on: { change: (e) => { setExpr(i, e.target.value); } } },
          EXPRS.map(([k, n]) => el('option', { value: k, text: `表情 · ${n}` })));
        ex.value = l.expr || 'normal';
        kids.push(ex);
      }
      if (id === 'opening') {
        const sc = el('select', { 'aria-label': `第 ${i + 1} 句分镜`, on: { change: (e) => { l.scene = e.target.value; commit(); } } },
          el('option', { value: '', text: '沿用上一格' }), Object.entries(SCENES).map(([k, v]) => el('option', { value: k, text: `分镜 · ${v}` })));
        sc.value = l.scene || '';
        kids.push(sc);
      }
      const text = autoGrow(el('textarea', { rows: 1, 'aria-label': `第 ${i + 1} 句台词`, value: l.text,
        on: { input: (e) => { l.text = e.target.value; if (sel === i) renderPreview(); clearTimeout(typing); typing = setTimeout(commit, 400); },
          change: () => { clearTimeout(typing); commit(); }, focus: () => select(i) } }));
      const move = (d) => { const j = i + d; if (j < 0 || j >= lines.length) return; [lines[i], lines[j]] = [lines[j], lines[i]]; sel = j; commit(); render(); };
      return el(`div.line${i === sel ? '.sel' : ''}`, { on: { click: () => select(i) } },
        el('div.n', { text: i + 1 }), el('div.who', null, kids), text,
        el('div.tools', null, miniBtn('up', '上移', () => move(-1)), miniBtn('down', '下移', () => move(1)),
          miniBtn('x', '删掉这一句', () => { lines.splice(i, 1); sel = Math.min(sel, lines.length - 1); commit(); render(); }, 'del')));
    }
    // 改表情：normal 不写进数据
    function setExpr(i, k) {
      const l = lines[i];
      if (!l || !l.who) return;
      l.expr = k === 'normal' ? undefined : k;
      commit();
      const pick = main.querySelectorAll('.line')[i]?.querySelector('select.expr');
      if (pick) pick.value = l.expr || 'normal';
      if (i === sel) renderPreview();
    }
    function select(i) {
      if (sel === i) return;
      sel = i;
      main.querySelectorAll('.line').forEach((n, k) => n.classList.toggle('sel', k === i));
      renderPreview();
    }
    function add(who) {
      lines.push({ text: '', who: who || undefined });
      sel = lines.length - 1; render();
      const t = main.querySelectorAll('.line textarea'); t[t.length - 1]?.focus();
    }

    function render() {
      const head = el('div.script-head', null,
        el('h3', { text: sceneLabel(id) }), el('code', { text: id }),
        sceneEdited(id) ? el('span.chip.edited', { text: '有台词' }) : el('span.chip', { text: '空场景' }),
        el('span.grow'),
        armedButton('清空场景', '再点一次清空', () => { SA.Text.set(`story:${id}`, '[]'); textDirty.story.add(id); refreshStatus(); lines = []; sel = 0; render(); toast('场景已清空，保存后生效'); }, 'btn sm ghost'));
      const list = lines.length ? lines.map(row) : [el('div.empty', null, el('b', { text: '这一幕还没有台词' }), '加一句试试。战前 / 战后为空时，游戏里就不插入剧情。')];
      const foot = el('div.script-foot', null,
        cast.map(([k, c]) => el('button.btn.sm', { type: 'button', on: { click: () => add(k) } }, icon('plus'), c.name)),
        el('button.btn.sm', { type: 'button', on: { click: () => add('') } }, icon('plus'), '旁白'));
      main.replaceChildren(head, ...list, foot, errBox);
      renderPreview();
    }

    // 头像：用游戏同一套碳球头像（js/story.js），按这一句的表情画
    function face(who, expr, size = 96) {
      if (!who || !SA.STORY.cast[who]) return null;
      const c = el('canvas', { width: 96, height: 96, style: `width:${size}px;height:${size}px` });
      try { c.getContext('2d').drawImage(SA.Story.portrait(false, false, who, expr || 'normal'), 0, 0); } catch (e) { return null; }
      return c;
    }
    // 表情窗：大图循环演「说话（身子一弹一弹）→ 停下眨眼」，下面是这个人能用的全部表情，点一下就换
    let anim = 0;
    function exprWindow(l) {
      cancelAnimationFrame(anim);
      if (!l) return null;
      if (!l.who) return el('div.xw.narr', null, el('div.xw-h', null, el('b', { text: '旁白' }), el('span', { text: '冷色字、铁灰框；不显示也不改动任何头像' })));
      const big = el('canvas.xw-big', { width: 96, height: 96 }), g = big.getContext('2d');
      const state = el('span.xw-state');
      const t0 = performance.now();
      const tick = (now) => {
        if (!big.isConnected) return;
        const t = (now - t0) / 1000, k = t % 2.8, talking = k < 1.6;
        const bob = talking && Math.floor(t * 9) % 2 === 0, blink = !talking && k > 2.2 && k < 2.32;
        g.clearRect(0, 0, 96, 96);
        g.drawImage(SA.Story.portrait(bob, blink, l.who, l.expr || 'normal'), 0, 0);
        const txt = talking ? '说话中' : '停顿 · 眨眼';
        if (state.textContent !== txt) state.textContent = txt;
        anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
      const cur = l.expr || 'normal';
      const grid = el('div.xw-grid', null, EXPRS.map(([k, n]) => el(`button.xw-pick${k === cur ? '.on' : ''}`, { type: 'button', title: `换成「${n}」`, 'aria-pressed': String(k === cur), on: { click: () => setExpr(sel, k) } },
        face(l.who, k, 48), el('span', { text: n }))));
      return el('div.xw', null,
        el('div.xw-h', null, el('b', { text: nameOf(l.who) }), el('span', { text: `第 ${sel + 1} 句 · ${exprName(cur)}` })),
        el('div.xw-stage', null, big, state),
        grid);
    }
    function renderPreview() {
      const l = lines[sel];
      const box = l ? (l.who && SA.STORY.cast[l.who]
        ? el('div.vn-box', null, face(l.who, l.expr) || el('div'), el('div', null, el('span.vn-name', { text: nameOf(l.who) }), el('div.vn-text', { text: l.text || '（空）' })))
        : el('div.vn-box.narr', null, el('div.vn-text.vn-narr', { text: l.text || '（空）' })))
        : el('div.vn-box', null, el('div.vn-text.vn-narr', { text: '没有台词' }));
      const ctrl = el('div.vn-ctrl', null,
        el('button.btn.sm', { type: 'button', disabled: !lines.length, title: '用游戏里的对话框把这一段从第一句演到最后一句', on: { click: () => replay(0) } }, icon('play'), '完整重放'),
        el('button.btn.sm.ghost', { type: 'button', disabled: !lines.length || sel <= 0, on: { click: () => replay(sel) } }, '从这句播'),
        el('span.grow'),
        el('button.btn.sm.ghost', { type: 'button', disabled: sel <= 0, title: '上一句', 'aria-label': '上一句', on: { click: () => { select(Math.max(0, sel - 1)); } } }, icon('left')),
        el('span', { text: lines.length ? `${sel + 1} / ${lines.length}` : '' }),
        el('button.btn.sm.ghost', { type: 'button', disabled: sel >= lines.length - 1, title: '下一句', 'aria-label': '下一句', on: { click: () => { select(Math.min(lines.length - 1, sel + 1)); } } }, icon('right')));
      side.replaceChildren(el('div.vn-ctrl', { text: '表情与说话动作' }), exprWindow(l), el('div.vn-ctrl', { text: '对话框预览（游戏里的样子）' }), box, ctrl);
    }
    // 完整重放：弹出试播窗，用游戏自己的对话框演编辑中的台词（不用先保存）；开场带分镜动画，教程按战斗里的位置
    function replay(from) {
      const rows = lines.filter((l) => l.text.trim()).map((l) => ({ text: l.text, who: l.who || undefined, expr: (l.who && l.expr) || undefined, scene: l.scene || undefined }));
      if (!rows.length) { toast('这一幕还没有台词', 'warn'); return; }
      const start = lines.slice(0, from).filter((l) => l.text.trim()).length;
      document.querySelector('.sp-ov')?.remove();
      const frame = el('iframe', { src: 'story-player.html', title: '剧情试播' });
      const go = (k) => { try { frame.contentWindow.StoryPlayer.play({ id, rows, from: k }); frame.focus(); } catch (e) { toast(`试播窗没能打开：${e.message || e}`, 'bad'); } };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
      const close = () => { window.removeEventListener('keydown', onKey, true); ov.remove(); };
      const ov = el('div.sp-ov', { role: 'dialog', 'aria-label': '剧情试播' },
        el('div.sp-win', null,
          el('div.sp-bar', null, el('b', { text: `试播 · ${sceneLabel(id)}` }), el('span.muted', { text: '点画面 / 空格翻页' }), el('span.grow'),
            el('button.btn.sm', { type: 'button', on: { click: () => go(0) } }, icon('reload'), '从头重放'),
            el('button.btn.sm.ghost', { type: 'button', on: { click: close } }, icon('x'), '关闭')),
          frame));
      ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
      frame.addEventListener('load', () => go(start), { once: true });
      window.addEventListener('keydown', onKey, true);
      document.body.append(ov);
    }
    render();
    return root;
  }

  // ---------- 院子闲聊编辑 ----------
  function chatEditor(scope, { stageName } = {}) {
    const root = el('div', { style: 'display:grid;gap:12px' });
    const preview = el('div.chat-preview');
    function render() {
      const d = chatDraft(scope);
      const inherited = d.mode === 'inherit' || d.source !== scope;
      const parent = scope.startsWith('stage:') ? `chapter:${scope.split(':')[1]}` : scope.startsWith('chapter:') ? 'global' : null;
      const src = el('div.source', null,
        d.mode === 'inherit' ? el('span.chip.edited', { text: '保存后改回继承上一级' })
          : d.source === scope ? el('span.chip.manual', { text: '本范围单独编排' })
            : el('span.chip', { text: `沿用 · ${scopeName(d.source)}` }),
        el('span.muted', { text: inherited ? '这里显示的是上一级的闲聊；一改就变成这一范围自己的。' : '游戏里先用本关，再用本章，最后用全局。' }),
        el('span.grow'),
        parent && d.mode !== 'inherit' && d.source === scope ? el('button.btn.sm.ghost', { type: 'button', on: { click: () => { d.mode = 'inherit'; d.groups = clone(SA.YardChat.read(parent).groups); d.dirty = true; textDirty.chat.add(scope); refreshStatus(); render(); } } }, '恢复继承上一级') : null);
      const groups = d.groups.map((g, gi) => groupCard(d, g, gi));
      const add = el('button.btn', { type: 'button', on: { click: () => {
        touch(d);
        d.groups.push({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: '新闲聊', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'rel', text: '……', action: 'talk' }] });
        render();
      } } }, icon('plus'), '新增一组');
      root.replaceChildren(src, ...(groups.length ? groups : [el('div.empty', null, el('b', { text: '这一范围还没有闲聊' }))]), el('div.row', null, add));
      renderBubble(d.groups[0]?.lines[0]);
    }
    function touch(d) {
      if (d.mode === 'inherit') d.mode = 'write';
      d.source = scope; d.dirty = true; textDirty.chat.add(scope); refreshStatus();
    }
    function groupCard(d, g, gi) {
      const upd = (fn) => (e) => { touch(d); fn(e); };
      const weather = el('select', { 'aria-label': '天气', on: { change: upd((e) => { g.weather = e.target.value; }) } }, Object.entries(WEATHER).map(([k, v]) => el('option', { value: k, text: v })));
      weather.value = g.weather || 'any';
      const moveG = (dd) => { const j = gi + dd; if (j < 0 || j >= d.groups.length) return; touch(d); [d.groups[gi], d.groups[j]] = [d.groups[j], d.groups[gi]]; render(); };
      const head = el('div.group-h', null,
        el('label.field', null, '名称', el('input', { value: g.name, on: { input: upd((e) => { g.name = e.target.value; }) } })),
        el('label.field', null, '权重', el('input', { type: 'number', min: 0, step: 0.5, value: g.weight, on: { input: upd((e) => { g.weight = Number(e.target.value); }) } })),
        el('label.field', null, '冷却（秒）', el('input', { type: 'number', min: 0, step: 1, value: g.cooldownSec, on: { input: upd((e) => { g.cooldownSec = Number(e.target.value); }) } })),
        el('label.field', null, '天气', weather),
        el('div.tools', { style: 'display:flex;gap:2px' }, miniBtn('up', '这一组上移', () => moveG(-1)), miniBtn('down', '这一组下移', () => moveG(1)),
          miniBtn('x', '删掉这一组', () => { touch(d); d.groups.splice(gi, 1); render(); }, 'del')));
      const body = el('div.group-b', null, g.lines.map((l, li) => {
        const who = el('select', { 'aria-label': '说话人', on: { change: upd((e) => { l.who = e.target.value; renderBubble(l); }) } }, Object.entries(CHAT_WHO).map(([k, v]) => el('option', { value: k, text: v })));
        who.value = l.who;
        const act = el('select', { 'aria-label': '动作', on: { change: upd((e) => { l.action = e.target.value; }) } },
          Object.entries(ACTIONS).map(([k, v]) => el('option', { value: k, text: v })), ACTIONS[l.action] ? null : el('option', { value: l.action, text: l.action }));
        act.value = l.action || 'talk';
        const moveL = (dd) => { const j = li + dd; if (j < 0 || j >= g.lines.length) return; touch(d); [g.lines[li], g.lines[j]] = [g.lines[j], g.lines[li]]; render(); };
        return el('div.cline', null, who, act,
          el('input', { value: l.text, 'aria-label': '台词', on: { input: upd((e) => { l.text = e.target.value; renderBubble(l); }), focus: () => renderBubble(l) } }),
          el('div', { style: 'display:flex;gap:2px' }, miniBtn('up', '上移', () => moveL(-1)), miniBtn('down', '下移', () => moveL(1)),
            miniBtn('x', '删掉这一句', () => { if (g.lines.length <= 1) { toast('每组至少要有一句'); return; } touch(d); g.lines.splice(li, 1); render(); }, 'del')));
      }), el('div.row', null, el('button.btn.sm.ghost', { type: 'button', on: { click: () => { touch(d); g.lines.push({ who: 'tom', text: '……', action: 'talk' }); render(); } } }, icon('plus'), '加一句（对答）')));
      return el('div.group', null, head, body);
    }
    const bubbleCache = new Map();
    function renderBubble(l) {
      if (!l) { preview.replaceChildren(); return; }
      const name = CHAT_WHO[l.who];
      if (!bubbleCache.has(l.who)) {
        try { bubbleCache.set(l.who, SA.Coal.draw(SA.Coal.byName[name], { size: 'sprite', expr: 'normal', look: 1 })); } catch (e) { bubbleCache.set(l.who, null); }
      }
      const src = bubbleCache.get(l.who), c = el('canvas', { width: src ? src.width : 1, height: src ? src.height : 1 });
      if (src) c.getContext('2d').drawImage(src, 0, 0);
      const text = (l.text || '').replaceAll('{关卡名}', stageName || '（关卡名）');
      preview.replaceChildren(el('div.vn-ctrl', { text: '气泡预览' }), el('div.who-line', null, c, el('div', null, el('div.muted', { style: 'font-size:12px', text: name }), el('span.bubble', { text: text || '（空）' }))));
    }
    render();
    return el('div.chat-wrap', null, root, el('div.chat-side', null, preview));
  }

  // ---------- 外框 ----------
  const lastBuild = (s) => (s ? String(s).split('+').pop().trim() : '—');
  function buildShell() {
    const gear = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    gear.setAttribute('viewBox', '0 0 24 24'); gear.setAttribute('aria-hidden', 'true');
    gear.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>';
    const top = el('header.top', null,
      el('a.brand', { href: '#/home' }, gear, '蒸汽竞技场', el('small', { text: '后台' })),
      el('button.search', { type: 'button', on: { click: openPalette } }, el('span', { text: '搜索关卡、剧情、闲聊、样机、模块…' }), el('kbd', { text: 'Ctrl K' })),
      el('div.spacer'),
      el('button.status#status', { type: 'button', on: { click: () => saveAll() } }));
    const side = el('nav.side#nav', { 'aria-label': '后台导航' },
      NAV.map((g) => el('div.nav-group', null, g.group ? el('h4', { text: g.group }) : null,
        g.items.map((it) => el('a.nav-item', { href: `#/${it.path}`, dataset: { nav: it.id } }, it.name,
          it.tag ? el(`span.tag${it.tag === 'new' ? '.new' : ''}`, { text: it.tag === 'new' ? '新' : '旧版' }) : null)))),
      el('div.side-foot', { title: `后台 ${SA.BUILD_SYS || ''}\n视觉 ${SA.BUILD_VIS || ''}` }, '最近一次构建',
        el('span.mono', { text: `视觉 · ${lastBuild(SA.BUILD_VIS)}` }), el('span.mono', { text: `后台 · ${lastBuild(SA.BUILD_SYS)}` })));
    $('#app').replaceChildren(top, side, el('main.main#main', null, el('div.view-root#view-root')));
    refreshStatus();
  }

  // ---------- 路由 ----------
  function parse() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [view, ...rest] = raw.split('/');
    return { view: view || 'home', rest };
  }
  const go = (path) => { location.hash = `#/${path}`; };
  let cleanup = null;
  function route(keep) {
    const { view, rest } = parse();
    const fn = VIEWS[view] || VIEWS.home;
    if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
    const m = $('#view-root');
    const keepScroll = keep ? [...m.querySelectorAll('[data-keep-scroll]')].map((n) => n.scrollTop) : null;
    m.replaceChildren();
    fn(rest, m);
    if (keepScroll) m.querySelectorAll('[data-keep-scroll]').forEach((n, i) => { n.scrollTop = keepScroll[i] || 0; });
    const navId = view === 'open' ? rest[0] : view === 'lab' ? 'labs' : view === 'game' && rest[0] === 'text' ? 'text' : view;
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('on', a.dataset.nav === navId));
    if (view !== 'home') { prefs.last = location.hash; prefs.lastLabel = document.title.replace(' · 后台', ''); savePrefs(); }
  }
  const setTitle = (t) => { document.title = `${t} · 后台`; };
  // 视图切换时要收尾的事（解绑按键、收起拼装台……）串在一起，路由换页时一并执行
  const onLeave = (fn) => { const prev = cleanup; cleanup = () => { fn(); if (prev) prev(); }; };

  // ---------- 视图 ----------
  const VIEWS = {};

  VIEWS.home = (rest, m) => {
    setTitle('总览');
    const stages = allStages(), manual = Object.keys(SA.STAGE_CARS?.records || {}).length;
    const scenes = SA.StoryData.list(), edited = scenes.filter(sceneEdited).length;
    const scopes = ['global', ...SA.CAMPAIGN.flatMap((ch, ci) => [`chapter:${ci}`, ...ch.stages.map((_, si) => `stage:${ci}:${si}`)])];
    const ownChat = scopes.filter(scopeOwn).length;
    const cur = SA.LABS?.ITEMS.find((x) => x.id === 'current');
    const card = (path, title, big, p, meta) => el('a.card', { href: `#/${path}` }, el('h3', { text: title }), big != null ? el('div.big', { text: big }) : null, p ? el('p', { text: p }) : null, meta ? el('div.meta', { text: meta }) : null);
    const toolCard = (id) => { const t = TOOLS[id]; return el('a.card', { href: `#/open/${id}` }, el('h3', null, t.name, t.old ? el('span.chip', { text: '旧版' }) : null), el('p', { text: t.desc })); };
    const last = prefs.last && !/^#\/?(home)?$/.test(prefs.last) ? el('a.continue', { href: prefs.last }, el('span', { text: '接着上次：' }), el('b', { text: prefs.lastLabel || prefs.last })) : null;
    m.append(el('div.view', null, el('div.home', null,
      el('div.home-head', null, el('h1', { text: '后台' }),
        el('p.lede', { text: '关卡车、剧情、院子闲聊、视觉样机和游戏调试都在这里。按 Ctrl+K 搜任何一关、一幕剧情、一个样机；改完按 Ctrl+S 一次存好。标「新」的是重做过的界面，标「旧版」的先原样嵌着用。' })),
      last,
      el('div.section-h', null, el('h2', { text: '常用' })),
      el('div.cards', null,
        card('stage', '关卡', `${stages.length} 关`, '一关一个工作区：拼装关卡车、改文字和奖励、测强度、写剧情和闲聊。', `${manual} 辆手工关卡车`),
        card('story', '剧情', `${scenes.length} 幕`, '开场、教程、每关战前战后、功能开放。改完看对话框预览。', `${edited} 幕改过`),
        card('chat', '院子闲聊', `${ownChat} 个范围`, '全局、每章、每关的闲聊和多人对答。', '单独编排的范围'),
        cur ? card('open/current', '当前开发', null, cur.desc, `${cur.ver} · ${cur.date}`) : null,
        card('game', '游戏', null, '嵌着的游戏，加上一排调试按钮：全部解锁、加钱、跳章、清档、页面文字编辑、试驾场。', null)),
      el('div.section-h', null, el('h2', { text: '还没重做的工作台' }), el('span', { text: '先嵌在后台里用，接下来逐个换成新界面' })),
      el('div.cards', null, ['publish-preflight', 'evolve', 'selftest', 'modules'].map(toolCard)),
      el('div.section-h', null, el('h2', { text: '视觉' })),
      el('div.cards', null, card('labs', '样机目录', `${SA.LABS?.ITEMS.length || 0} 个`, '全部视觉样机，按类别和状态筛选。', null), ['candidates', 'spritesheet', 'style'].map(toolCard)))));
  };

  // 关卡工作区：左边章节树，中间这一关（拼装 / 文字与奖励 / 强度 / 剧情 / 院子闲聊），右边关卡信息
  VIEWS.stage = (rest, m) => {
    const key = validKey(rest[0]) ? rest[0] : validKey(prefs.stageKey) ? prefs.stageKey : '0,0';
    const TABS = { build: '拼装', text: '文字与奖励', test: '强度', story: '剧情', chat: '院子闲聊' };
    const tab = TABS[rest[1]] ? rest[1] : TABS[prefs.stageTab] ? prefs.stageTab : 'build';
    prefs.stageKey = key; prefs.stageTab = tab; savePrefs();
    const [ci, si] = key.split(',').map(Number);
    const st = stageData(ci, si), d = stageDraft(key), f = d.fields;
    setTitle(`${st.code} ${f.name || st.name}`);
    const keys = allStages(), idx = keys.indexOf(key);
    const goStage = (k, t = tab) => go(`stage/${k}/${t}`);

    // 左：章节树
    prefs.closed = prefs.closed || {};
    const filter = el('input', { type: 'text', placeholder: '筛选：关名、车手、编号', 'aria-label': '筛选关卡', value: prefs.stageFilter || '' });
    const list = el('div.list', { 'data-keep-scroll': '' });
    function renderTree() {
      const q = filter.value.trim().toLowerCase();
      list.replaceChildren(...SA.CAMPAIGN.map((ch, c) => {
        const items = ch.stages.map((_, s) => {
          const sd = stageData(c, s), rec = recordOf(c, s);
          if (q && !`${sd.code} ${sd.name} ${sd.pilot || ''}`.toLowerCase().includes(q)) return null;
          return el(`button.st-item${sd.key === key ? '.on' : ''}`, { type: 'button', dataset: { key: sd.key }, title: `${sd.code} ${sd.name} · ${sd.pilot || ''}`, on: { click: () => goStage(sd.key) } },
            el('span.code', { text: sd.code }), el('span.nm', null, sd.name, el('small', { text: sd.pilot || '' })),
            el('span.marks', null, stageDirty(sd.key) ? el('span.dot', { title: '未保存' }) : null, sd.boss ? el('span.mark', { text: '★', title: 'Boss' }) : null,
              rec ? el('span.pip.manual', { title: '手工关卡车' }) : null, rec && rec.locked !== false ? el('span.pip.locked', { title: '已锁定' }) : null));
        }).filter(Boolean);
        if (!items.length) return null;
        const closed = !q && prefs.closed[c] && c !== ci;
        const h = el(`button.ch-h${closed ? '.closed' : ''}`, { type: 'button', title: ch.name, dataset: { short: chShort(ch) }, on: { click: () => { prefs.closed[c] = !closed; savePrefs(); renderTree(); } } }, icon('chev'), `${chShort(ch)} · ${chPlace(ch)}`);
        return el('div', null, h, closed ? null : items);
      }).filter(Boolean));
    }
    filter.addEventListener('input', () => { prefs.stageFilter = filter.value; savePrefs(); renderTree(); });
    renderTree();
    const tree = el('aside.tree', null, el('div.filter', null, filter), list);

    // 中：这一关
    const rec = recordOf(ci, si);
    const head = el('div.stage-head', null,
      el('div.code', { text: st.code }),
      el('div', { style: 'min-width:0' }, el('h2', { text: f.name || st.name }),
        el('div.who', null, f.pilot || '无名车手', f.boss ? el('span.chip.boss', { text: '★ Boss' }) : null,
          rec ? el('span.chip.manual', { text: '手工关卡车' }) : el('span.chip', { text: '原始数据' }),
          f.locked ? el('span.chip.locked', { text: '锁定' }) : el('span.chip', { text: '进化器可改' }),
          stageDirty(key) ? el('span.chip.edited', { text: '有改动没保存' }) : null)),
      el('div.acts', null,
        el('button.btn.sm', { type: 'button', disabled: idx <= 0, title: '上一关（[）', on: { click: () => goStage(keys[idx - 1]) } }, icon('left'), '上一关'),
        el('button.btn.sm', { type: 'button', disabled: idx >= keys.length - 1, title: '下一关（]）', on: { click: () => goStage(keys[idx + 1]) } }, '下一关', icon('right')),
        el('button.btn.sm.primary', { type: 'button', title: '保存全部改动（Ctrl+S）', on: { click: () => saveAll() } }, '保存')));
    const sceneIds = new Set(SA.StoryData.list());
    const storySlots = [['before', `before.${key}`, '战前'], ['win', `stage.${key}.win`, '胜利'], ['lose', `stage.${key}.lose`, '失败'], ['after', `after.${key}`, '战后']];
    const storyCount = storySlots.filter(([, id]) => sceneIds.has(id) && sceneLines(id).length).length;
    const chatScope = `stage:${ci}:${si}`;
    const tabs = el('div.tabs', { role: 'tablist' }, Object.entries(TABS).map(([k, v]) => el(`button.tab${k === tab ? '.on' : ''}`, { type: 'button', role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', on: { click: () => goStage(key, k) } }, v,
      k === 'story' ? el('span.count', { text: storyCount ? `${storyCount} 幕` : '' }) : k === 'chat' ? el('span.count', { text: scopeOwn(chatScope) ? '本关' : '继承' }) : null)));
    const body = el('div.stage-body', { 'data-keep-scroll': '' });

    if (tab === 'build') buildTab(body, key, st, d);
    else if (tab === 'text') textTab(body, key, d);
    else if (tab === 'test') testTab(body, key, st, d);
    else if (tab === 'story') {
      const slot = storySlots.find(([k, id]) => k === prefs.storySlot && sceneIds.has(id)) || storySlots.find(([, id]) => sceneIds.has(id));
      const slots = el('div.slots', null, storySlots.map(([k, id, name]) => {
        const ok = sceneIds.has(id), n = ok ? sceneLines(id).length : 0;
        return el(`button.slot${slot && slot[0] === k ? '.on' : ''}${ok ? '' : '.off'}`, { type: 'button', disabled: !ok, title: ok ? id : '这一关还没有专属的胜负台词，需要后台开放这个场景',
          on: { click: () => { prefs.storySlot = k; savePrefs(); route(true); } } },
          el('b', null, name, ok && sceneEdited(id) ? el('span.chip.edited', { text: '已改' }) : null, textDirty.story.has(id) ? el('span.dot', { title: '未保存' }) : null),
          el('span', { text: ok ? (n ? `${n} 句` : '空 · 不插入剧情') : '未开放' }));
      }));
      body.append(slots, slot ? scriptEditor(slot[1]) : el('div.empty', { text: '没有可编辑的场景' }));
    } else body.append(chatEditor(chatScope, { stageName: f.name || st.name }));
    const center = el('section.stage', null, head, tabs, body);

    // 右：关卡信息（拼装页签时收起，让拼装台宽一点）
    const terrain = SA.TERRAINS[f.terrain || 'flat'] || SA.TERRAINS.flat;
    const kv = (pairs) => el('dl.kv', null, pairs.filter(([, v]) => v != null && v !== '').flatMap(([k, v]) => [el('dt', { text: k }), el('dd', null, v)]));
    const rewards = [...(f.rewardItems || []).filter((r) => SA.MODULES[r.id]).map((r) => `${SA.MODULES[r.id].name} × ${r.count}`),
      ...(st.uniqueLoot || []).map((r) => `唯一 · ${SA.MODULES[r.id]?.name || r.id}`), ...Object.entries(st.drop || {}).map(([k, n]) => `${SA.INGOTS?.[k]?.name || k} × ${n}`)];
    const info = el('aside.info', null,
      el('div', null, el('h3', { text: '关卡' }), kv([['章节', `${chShort(st.chapter)} · ${chPlace(st.chapter)}`], ['地形', terrain.name], ['性格', STYLE[f.style] || '游走'], ['枪法', String(f.aim)],
        ['奖金', f.rewardMoney ? `£${f.prize}` : '不发'], ['材料', SA.MATS?.[st.mt || 1]?.name], ['类型', f.boss ? 'Boss' : '普通']])),
      el('div', null, el('h3', { text: '地形' }), el('div.prose', { text: terrain.desc || '' })),
      rewards.length ? el('div', null, el('h3', { text: '固定奖励' }), el('div.reward-list', null, rewards.map((t) => el('span.chip', { text: t })))) : null,
      el('div', null, el('h3', { text: '简介' }), el('div.prose', { text: f.blurb || '（空）' })),
      st.spec?.lesson ? el('div', null, el('h3', { text: '设计意图' }), el('div.prose', { text: st.spec.lesson })) : null);

    m.append(el(`div.ws${tab === 'build' ? '.wide' : ''}`, null, tree, center, info));
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '[' && idx > 0) goStage(keys[idx - 1]);
      if (e.key === ']' && idx < keys.length - 1) goStage(keys[idx + 1]);
    };
    document.addEventListener('keydown', onKey);
    onLeave(() => document.removeEventListener('keydown', onKey));
    requestAnimationFrame(() => list.querySelector('.st-item.on')?.scrollIntoView({ block: 'nearest' }));
  };

  // 拼装页签：上面一条工具条，下面是游戏车间（拼装台）
  function buildTab(body, key, st, d) {
    body.classList.add('build');
    const f = d.fields;
    const slot = el('div.garage-slot', null, el('div.loading', { text: '正在把车推上拼装台……' }));
    // 只在有改动时亮出来；干净的时候不占地方
    const carState = el('span.chip.edited', { hidden: true });
    const showCarState = () => {
      carState.textContent = d.dirtyCar && d.dirtyFields ? '车和资料都改了' : d.dirtyCar ? '车改了' : d.dirtyFields ? '资料改了' : '';
      carState.hidden = !carState.textContent;
    };
    const withGarage = (fn) => async () => { try { const G = await garageOpen(key); await fn(G); } catch (e) { toast(e.message || String(e), 'bad'); } };
    const changed = (msg) => { captureGarage(); refreshStatus(); markTree(); showCarState(); toast(msg); };

    const name = el('input.name', { type: 'text', 'aria-label': '车名', placeholder: '车名', value: f.vehicleName,
      on: { input: (e) => { f.vehicleName = e.target.value; touchFields(key); garageApi()?.setName(e.target.value); showCarState(); } } });
    const lock = el('input', { type: 'checkbox', checked: f.locked, on: { change: (e) => { f.locked = e.target.checked; touchFields(key); showCarState(); } } });
    const panel = el('div.build-panel', { hidden: true });
    const cand = el('select', { 'aria-label': '进化候选车', title: '进化擂台里挑出来的候选车', style: 'width:150px' }, el('option', { value: '', text: '进化候选车…' }));
    const togglePanel = () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        const ta = el('textarea', { rows: 3, class: 'mono', placeholder: 'SA2.… 分享码，或 [[层,行,列,id,材料,改装等级],…] 模块清单' });
        panel.replaceChildren(el('label.field', null, '粘贴分享码或模块清单', ta), el('div.row', null,
          el('button.btn.sm.primary', { type: 'button', on: { click: withGarage((G) => { G.importText(ta.value, f.vehicleName); panel.hidden = true; changed('已换上导入的车，记得保存'); requestAnimationFrame(placeGarage); }) } }, '换上这台车'),
          el('button.btn.sm.ghost', { type: 'button', on: { click: () => { panel.hidden = true; requestAnimationFrame(placeGarage); } } }, '取消')));
        ta.focus();
      }
      requestAnimationFrame(placeGarage);
    };
    const sep = () => el('span.bar-sep');
    const bar = el('div.build-bar', null,
      el('label.field.inline', null, '车名', name),
      el('label.check', { title: '锁定后进化生成器不会改这辆车' }, lock, '锁定'),
      sep(),
      el('button.btn.sm', { type: 'button', title: '粘贴分享码或模块清单，换上那台车', on: { click: togglePanel } }, '导入…'),
      cand,
      el('button.btn.sm', { type: 'button', on: { click: withGarage((G) => { if (cand.value === '') { toast('先在左边的下拉里选一辆候选车'); return; } G.useCandidate(Number(cand.value)); changed('已拿候选车作底稿，记得保存'); }) } }, '用作底稿'),
      sep(),
      el('button.btn.sm', { type: 'button', title: '用拼装台上这台车去游戏的试驾场打一场', on: { click: withGarage((G) => { G.drivePick({ name: f.name, terrain: f.terrain, style: f.style }); go('game/drive'); }) } }, '试驾'),
      el('button.btn.sm', { type: 'button', title: '交给进化生成器当种子，正式关卡不变', on: { click: withGarage((G) => { d.arenaId = G.saveArena(d.arenaId, { name: f.name, style: f.style, terrain: f.terrain }); toast('已存到进化擂台（正式关卡没动）'); }) } }, '存到进化擂台'),
      el('span.grow'), carState,
      armedButton('放弃改动', '再点一次放弃', () => {
        stageDrafts.delete(key);
        const G = garageApi();
        if (G && garage.key === key) { G.open(st.ci, st.si); stageDraft(key).base = G.cellsJson(); }
        refreshStatus(); route(true);
      }, 'btn sm ghost'));
    body.append(bar, panel, slot);
    showCarState();
    liveCarState = showCarState;

    garage.slot = slot;
    ensureGarage().then(async (G) => {
      await garageOpen(key);
      if (!slot.isConnected) return;
      slot.replaceChildren();
      placeGarage();
      G.candidates().forEach((c) => cand.append(el('option', { value: c.i, text: c.from ? `${c.name} · ${c.from}` : c.name })));
      if (garage.ro) garage.ro.disconnect();
      garage.ro = new ResizeObserver(placeGarage);
      garage.ro.observe(slot);
      // 每秒看一眼拼装台：车动过就标上「没保存」，顺便对齐位置（工具条换行时拼装台跟着挪）
      clearInterval(garage.poll);
      garage.poll = setInterval(() => {
        if (!slot.isConnected) { clearInterval(garage.poll); return; }
        const was = d.dirtyCar;
        captureGarage();
        if (was !== d.dirtyCar) { refreshStatus(); markTree(); showCarState(); }
        placeGarage();
      }, 1000);
    }).catch((e) => { if (slot.isConnected) slot.replaceChildren(el('div.loading', { text: `拼装台没能打开：${e.message || e}` })); });
    onLeave(() => {
      clearInterval(garage.poll);
      captureGarage();
      garage.slot = null;
      liveCarState = null;
      if (garage.ro) { garage.ro.disconnect(); garage.ro = null; }
      hideGarage();
    });
  }

  // 文字与奖励页签：关卡资料、出战海报、过关奖励、解锁
  function textTab(body, key, d) {
    const f = d.fields;
    const upd = (fn) => (e) => { fn(e); touchFields(key); };
    const text = (label, k, opts = {}) => el('label.field', { class: opts.wide ? 'wide' : null }, label,
      opts.area ? autoGrow(el('textarea', { rows: opts.rows || 2, value: f[k], on: { input: upd((e) => { f[k] = e.target.value; }) } }))
        : el('input', { type: opts.type || 'text', value: f[k], min: opts.min, max: opts.max, step: opts.step, on: { input: upd((e) => { f[k] = opts.type === 'number' ? Number(e.target.value) : e.target.value; }) } }));
    const select = (label, k, entries) => {
      const s = el('select', { on: { change: upd((e) => { f[k] = e.target.value; }) } }, entries.map(([v, t]) => el('option', { value: v, text: t })));
      s.value = f[k];
      return el('label.field', null, label, s);
    };
    const check = (label, k) => el('label.check', null, el('input', { type: 'checkbox', checked: f[k], on: { change: upd((e) => { f[k] = e.target.checked; }) } }), label);
    const styles = Object.entries({ wander: '游走', rush: '冲锋', kite: '放风筝', turtle: '龟缩' });
    if (STYLE[f.style] && !styles.some(([k]) => k === f.style)) styles.push([f.style, STYLE[f.style]]);

    const basic = el('div.fs', null, el('h3', { text: '关卡' }), el('div.fgrid', null,
      text('关卡名', 'name'), text('车名', 'vehicleName'), text('车手', 'pilot'),
      select('性格（AI）', 'style', styles), text('枪法（0～1）', 'aim', { type: 'number', min: 0, max: 1, step: 0.05 }),
      select('地形', 'terrain', Object.entries(SA.TERRAINS).map(([k, t]) => [k, t.name || k])),
      el('div.row', { style: 'gap:16px' }, check('Boss', 'boss'), check('锁定（进化器不改）', 'locked'))));
    const poster = el('div.fs', null, el('h3', { text: '出战海报' }), el('div.fgrid', null,
      text('对手简介', 'blurb', { area: true, wide: true, rows: 3 }), text('弱点（线人手写）', 'weakness', { area: true, wide: true })));

    // 固定奖励：一行一件，材料按物品能用的范围列
    const items = el('div', { style: 'display:grid;gap:8px' });
    const modIds = [...new Set((SA.MODULE_ORDER || []).concat(Object.keys(SA.MODULES)))].filter((id) => SA.MODULES[id] && !SA.MODULES[id].retired);
    function renderItems() {
      items.replaceChildren(...f.rewardItems.map((it, i) => {
        const mod = el('select', { on: { change: upd((e) => { it.id = e.target.value; if (it.id) it.mt = Math.min(Math.max(Number(it.mt) || 1, SA.minMt(it.id)), SA.maxMt(it.id)); renderItems(); }) } },
          el('option', { value: '', text: '选物品…' }), modIds.map((id) => el('option', { value: id, text: SA.MODULES[id].name })));
        mod.value = it.id || '';
        const mats = el('select', { on: { change: upd((e) => { it.mt = Number(e.target.value); }) } },
          SA.MATS.map((mat, mt) => (mat && (!SA.MODULES[it.id] || (mt >= SA.minMt(it.id) && mt <= SA.maxMt(it.id))) ? el('option', { value: mt, text: mat.name }) : null)));
        mats.value = String(it.mt ?? 1);
        return el('div.ritem', null, el('label.field', null, '物品', mod),
          el('label.field', null, '数量', el('input', { type: 'number', min: 1, step: 1, value: it.count ?? 1, on: { input: upd((e) => { it.count = Number(e.target.value); }) } })),
          el('label.field', null, '材料', mats), miniBtn('x', '删掉这一项', () => { f.rewardItems.splice(i, 1); touchFields(key); renderItems(); }, 'del'));
      }));
    }
    renderItems();
    const prize = el('input', { type: 'number', min: 0, step: 10, value: f.prize, disabled: !f.rewardMoney, on: { input: upd((e) => { f.prize = Number(e.target.value); }) } });
    const reward = el('div.fs', null, el('h3', { text: '过关奖励' }),
      el('div.row', { style: 'gap:16px;align-items:end' },
        el('label.check', null, el('input', { type: 'checkbox', checked: f.rewardMoney, on: { change: upd((e) => { f.rewardMoney = e.target.checked; prize.disabled = !e.target.checked; }) } }), '发奖金'),
        el('label.field', { style: 'width:140px' }, '奖金（£）', prize), check('打赢免修理费', 'victoryRepairFree')),
      el('div.muted', { style: 'font-size:12px', text: '固定奖励：首次通关一定发，和缴获分开算' }), items,
      el('div.row', null, el('button.btn.sm', { type: 'button', on: { click: () => { f.rewardItems.push({ id: '', count: 1, mt: 1 }); touchFields(key); renderItems(); } } }, icon('plus'), '加一项')));

    // 解锁：模块、功能、材料上限、改装台大小、过关提示
    const U = () => (f.unlock = f.unlock || { mods: [], feat: [] });
    const chips = el('div.reward-list');
    const picker = el('div.picker', { hidden: true });
    // 模块图自带行内尺寸，去掉后按这里的样式缩放
    const modPic = (id) => { try { const c = SA.SPR.moduleCanvas(id, 1, 1); c.removeAttribute('style'); c.setAttribute('aria-hidden', 'true'); return c; } catch (e) { return null; } };
    function renderChips() {
      const ids = f.unlock?.mods || [];
      chips.replaceChildren(...(ids.length ? ids.map((id) => el('span.chip', null, modPic(id), SA.MODULES[id]?.name || id)) : [el('span.muted', { style: 'font-size:12.5px', text: '不解锁模块' })]));
    }
    function renderPicker() {
      const on = new Set(f.unlock?.mods || []);
      picker.replaceChildren(...modIds.map((id) => {
        const box = el('input', { type: 'checkbox', checked: on.has(id) });
        const card = el(`label.pick${on.has(id) ? '.on' : ''}`, { title: SA.MODULES[id].desc || '' }, box, modPic(id), SA.MODULES[id].name);
        box.addEventListener('change', () => {
          const u = U(); u.mods = u.mods || [];
          if (box.checked) { if (!u.mods.includes(id)) u.mods.push(id); } else u.mods = u.mods.filter((x) => x !== id);
          card.classList.toggle('on', box.checked); touchFields(key); renderChips();
        });
        return card;
      }));
    }
    renderChips();
    const feats = el('div.feats', null, Object.entries(SA.FEATURES).map(([k, v]) => el('label.check', null,
      el('input', { type: 'checkbox', checked: (f.unlock?.feat || []).includes(k), on: { change: (e) => {
        const u = U(); u.feat = u.feat || [];
        if (e.target.checked) { if (!u.feat.includes(k)) u.feat.push(k); } else u.feat = u.feat.filter((x) => x !== k);
        touchFields(key);
      } } }), v)));
    const mat = el('select', { on: { change: (e) => { const u = U(); if (e.target.value) u.mat = Number(e.target.value); else delete u.mat; touchFields(key); } } },
      el('option', { value: '', text: '不变' }), SA.MATS.map((m2, mt) => (m2 ? el('option', { value: mt, text: m2.name }) : null)));
    mat.value = f.unlock?.mat ? String(f.unlock.mat) : '';
    const gridIn = (k, max) => el('input', { type: 'number', min: 1, max, step: 1, placeholder: '—', 'aria-label': k === 'cols' ? '列' : '层', value: f.unlock?.grid?.[k] ?? '',
      on: { input: (e) => {
        const u = U(), v = e.target.value ? Number(e.target.value) : null;
        u.grid = { ...(u.grid || {}), [k]: v };
        if (!u.grid.cols && !u.grid.rows) delete u.grid;
        touchFields(key);
      } } });
    const note = autoGrow(el('textarea', { rows: 2, value: f.unlock?.note || '', on: { input: (e) => { U().note = e.target.value; touchFields(key); } } }));
    const unlock = el('div.fs', null, el('h3', { text: '解锁' }),
      el('div.row', null, el('span.muted', { style: 'font-size:12px', text: '解锁模块' }), el('span.grow'),
        el('button.btn.sm', { type: 'button', on: { click: () => { picker.hidden = !picker.hidden; if (!picker.hidden) renderPicker(); } } }, '选择模块…')),
      chips, picker,
      el('div.muted', { style: 'font-size:12px', text: '开放功能' }), feats,
      el('div.fgrid', null, el('label.field', null, '材料上限', mat),
        el('label.field', null, '改装台（列 × 层）', el('div.row', { style: 'flex-wrap:nowrap;gap:6px' }, gridIn('cols', 8), '×', gridIn('rows', 6)))),
      el('label.field', null, '过关提示（解锁弹窗里的那段话）', note));
    const loot = el('details.fs', null, el('summary', { text: '高级：可缴获的唯一件（JSON）' }),
      autoGrow(el('textarea', { rows: 4, class: 'mono', value: f.lootText, on: { input: upd((e) => { f.lootText = e.target.value; }) } })));
    body.append(el('div.note', { text: '这里的改动和拼装台上的车一起保存：按右上角「保存」或 Ctrl+S。' }), el('div.form', null, basic, poster, reward, unlock, loot));
  }

  // 强度页签：车的性能单 + 和前面几关对打的胜率（判定区间照旧工作台）
  function testTab(body, key, st, d) {
    const f = d.fields;
    const sheet = el('div', { style: 'display:grid;gap:12px' }, el('div.muted', { text: '正在读拼装台上的车……' }));
    const games = el('input', { type: 'number', min: 1, max: 200, step: 1, value: prefs.testGames || 20, style: 'width:80px', 'aria-label': '每对局数' });
    const result = el('div');
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    function show(r) {
      if (!r) { result.replaceChildren(el('div.note', { text: '还没测。对手是开局车和前面最近的几关，每对双方各当一次玩家。' })); return; }
      const boss = !!f.boss, reward = !!(f.unlock?.mods?.length || st.spec?.reward);
      const range = boss ? [0.45, 0.65] : reward ? [0.4, 0.7] : [0.35, 0.8], soft = boss ? [0.3, 0.78] : [0.2, 0.9];
      const level = r.rate >= range[0] && r.rate <= range[1] ? 'ok' : r.rate >= soft[0] && r.rate <= soft[1] ? 'warn' : 'bad';
      result.replaceChildren(el(`div.note.${level}`, null,
        el('b', { text: level === 'ok' ? '在目标范围内' : level === 'warn' ? '接近目标，建议多测几局' : '偏离目标，需要调' }),
        `：这台车胜率 ${pct(r.rate)}（95% 区间 ${pct(r.lo)}～${pct(r.hi)}），共 ${r.total} 局，平均 ${r.avg.toFixed(1)} 秒；`,
        `目标 ${Math.round(range[0] * 100)}～${Math.round(range[1] * 100)}%（${boss ? 'Boss' : reward ? '带奖励模块' : '普通关'}）。对手：开局车和前面最近的 ${Math.max(0, r.refs - 1)} 关。`));
    }
    show(d.test);
    const run = el('button.btn.primary', { type: 'button', on: { click: async () => {
      run.disabled = true; run.textContent = '测试中…';
      try {
        prefs.testGames = Math.max(1, Math.min(200, Number(games.value) || 20)); savePrefs();
        const G = await garageOpen(key);
        await new Promise((r) => setTimeout(r, 40));   // 先让按钮变成「测试中」再开始算（算的时候页面会停一下）
        d.test = G.test(prefs.testGames, { aim: Number(f.aim), style: f.style, terrain: f.terrain, boss: !!f.boss });
        show(d.test);
      } catch (e) { toast(`测试失败：${e.message || e}`, 'bad'); }
      finally { run.disabled = false; run.textContent = '开始测试'; }
    } } }, '开始测试');
    body.append(el('div.fs', null, el('h3', { text: '对打测试' }),
      el('div.row', null, el('label.field', { style: 'grid-auto-flow:column;align-items:center;gap:6px' }, '每对局数', games), run,
        el('span.muted', { style: 'font-size:12px', text: '测的是拼装台上现在这台车（含没保存的改动），性格、枪法、地形用「文字与奖励」里的' })), result), sheet);
    garageOpen(key).then((G) => {
      if (!sheet.isConnected) return;
      const s = G.stats();
      if (!s) { sheet.replaceChildren(el('div.muted', { text: '拼装台上没有车' })); return; }
      const stat = (label, val) => el('div.stat', null, el('span', { text: label }), el('b', { text: val }));
      const dist = (arr) => { const c = new Map(); arr.forEach((v) => c.set(v, (c.get(v) || 0) + 1)); return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}×${n}`).join('、') || '无'; };
      sheet.replaceChildren(el('div.block-h', null, el('h3', { text: '性能单' })),
        el('div.stats', null, stat('评分', Math.round(s.rating)), stat('价值', `£${Math.round(s.value)}`), stat('重量', Math.round(s.weight)),
          stat('动力 需/供', `${s.demand}/${s.supply}`), stat('水量', Math.round(s.water)), stat('烧干', s.overheat == null ? '不会' : `${Math.round(s.overheat)} 秒`), stat('秒伤', s.dps.toFixed(1))),
        el(`div.note.${s.canDeploy ? 'ok' : 'bad'}`, { text: s.canDeploy ? '可以出战' : `不能出战：${s.problems.join('；')}` }),
        el('div.note', { style: 'white-space:pre-wrap', text: `穿深分布：${dist(s.pen)}\n装甲厚度分布：${dist(s.thick)}` }));
    }).catch((e) => { if (sheet.isConnected) sheet.replaceChildren(el('div.muted', { text: `拼装台没能打开：${e.message || e}` })); });
  }

  // 剧情总表：左边全部场景，右边脚本编辑
  VIEWS.story = (rest, m) => {
    const ids = SA.StoryData.list();
    const want = rest.join('/');
    const id = ids.includes(want) ? want : ids.includes(prefs.storyId) ? prefs.storyId : 'opening';
    prefs.storyId = id; savePrefs();
    setTitle(`剧情 · ${sceneLabel(id)}`);
    const groups = [
      ['开场与教程', ids.filter((x) => x === 'opening' || x.startsWith('tutorial.'))],
      ...SA.CAMPAIGN.map((ch, ci) => [`${chShort(ch)} · ${chPlace(ch)}`, ch.stages.flatMap((_, si) => ['before', 'win', 'lose', 'after'].map((p) => (p === 'before' || p === 'after' ? `${p}.${ci},${si}` : `stage.${ci},${si}.${p}`)).filter((x) => ids.includes(x)))]),
      ['功能开放', ids.filter((x) => x.startsWith('feat.'))],
      ['非战役对战', ids.filter((x) => x.endsWith('.current'))],
    ];
    const filter = el('input', { type: 'text', placeholder: '筛选剧情', 'aria-label': '筛选剧情', value: prefs.storyFilter || '' });
    const list = el('div');
    function renderIndex() {
      const q = filter.value.trim();
      list.replaceChildren(...groups.map(([name, gids]) => {
        const items = gids.filter((x) => !q || sceneLabel(x).includes(q) || x.includes(q)).map((x) => {
          const n = sceneLines(x).length;
          return el(`button.idx-item${x === id ? '.on' : ''}`, { type: 'button', on: { click: () => go(`story/${x}`) } },
            el('span', { text: sceneLabel(x) }), textDirty.story.has(x) ? el('span.dot', { title: '未保存' }) : null,
            sceneEdited(x) ? el('span.chip.edited', { text: '已改' }) : null, el('small', { text: n ? `${n} 句` : '空' }));
        });
        return items.length ? el('div', null, el('div.idx-h', { text: name }), items) : null;
      }).filter(Boolean));
    }
    filter.addEventListener('input', () => { prefs.storyFilter = filter.value; savePrefs(); renderIndex(); });
    renderIndex();
    m.append(el('div.split', null, el('aside.index', { 'data-keep-scroll': '' }, el('div.filter', null, filter), list),
      el('section.pane', { 'data-keep-scroll': '' }, scriptEditor(id))));
    requestAnimationFrame(() => list.querySelector('.idx-item.on')?.scrollIntoView({ block: 'nearest' }));
  };

  // 院子闲聊总表：左边范围，右边编排；最上面是整体节奏和点击人物对话
  VIEWS.chat = (rest, m) => {
    const scopes = ['global', ...SA.CAMPAIGN.flatMap((ch, ci) => [`chapter:${ci}`, ...ch.stages.map((_, si) => `stage:${ci}:${si}`)])];
    const want = rest[0];
    const scope = want === 'settings' || scopes.includes(want) ? want : (scopes.includes(prefs.chatScope) || prefs.chatScope === 'settings' ? prefs.chatScope : 'settings');
    prefs.chatScope = scope; savePrefs();
    setTitle(`院子闲聊 · ${scope === 'settings' ? '整体设置' : scopeName(scope)}`);
    const item = (s, label, indent) => el(`button.idx-item${s === scope ? '.on' : ''}`, { type: 'button', style: indent ? 'padding-left:22px' : '', on: { click: () => go(`chat/${s}`) } },
      el('span', { text: label }), textDirty.chat.has(s) ? el('span.dot', { title: '未保存' }) : null, s !== 'settings' && scopeOwn(s) ? el('span.chip.manual', { text: '单独' }) : null);
    const index = el('aside.index', { 'data-keep-scroll': '' },
      el('div.idx-h', { text: '设置' }), item('settings', '整体节奏 · 点击人物对话'),
      el('div.idx-h', { text: '闲聊范围' }), item('global', '全局默认'),
      SA.CAMPAIGN.map((ch, ci) => [item(`chapter:${ci}`, `${chShort(ch)} · ${chPlace(ch)}`), ch.stages.map((st, si) => item(`stage:${ci}:${si}`, `${ci}-${si + 1} ${st.name}`, true))]));
    const pane = el('section.pane', { 'data-keep-scroll': '' });
    if (scope === 'settings') {
      settingsDraft = settingsDraft || clone(SA.YardChat.settings());
      clickDraft = clickDraft || { ...SA.YardChat.clickTips() };
      const num = (k, label) => el('label.field', null, label, el('input', { type: 'number', min: 0, step: 0.1, value: settingsDraft[k], on: { input: (e) => { settingsDraft[k] = Number(e.target.value); textDirty.settings = true; refreshStatus(); } } }));
      pane.append(el('div.pane-h', null, el('h2', { text: '整体节奏' })),
        el('div.chat-top', null, num('intervalSec', '两组闲聊之间（秒）'), num('replySec', '对答两句之间（秒）'), num('bubbleSec', '气泡停留（秒）')),
        el('div.pane-h', null, el('h2', { text: '点击人物对话' }), el('span.muted', { text: '所有章节共用；一行一句' })),
        el('div.chat-top', null, Object.entries(CHAT_WHO).map(([who, name]) => el('label.field', null, name,
          autoGrow(el('textarea', { rows: 3, value: clickDraft[who] || '', on: { input: (e) => { clickDraft[who] = e.target.value; textDirty.tips.add(who); refreshStatus(); } } }))))));
    } else {
      const stageName = scope.startsWith('stage:') ? SA.CAMPAIGN[+scope.split(':')[1]]?.stages[+scope.split(':')[2]]?.name : null;
      pane.append(el('div.pane-h', null, el('h2', { text: scopeName(scope) }), el('span.muted', { text: '{关卡名} 会换成当时的关卡名' })), chatEditor(scope, { stageName }));
    }
    m.append(el('div.split', null, index, pane));
    requestAnimationFrame(() => index.querySelector('.idx-item.on')?.scrollIntoView({ block: 'nearest' }));
  };

  // 嵌入页：还没重做的工作台、视觉页
  function frameView(m, { title, url, chips = [], back, actions = [] }) {
    setTitle(title);
    const frame = el('iframe', { src: url, title });
    m.append(el('div.frame-bar.on-wood', null,
      back ? el('a.btn.sm.ghost', { href: `#/${back[0]}` }, icon('left'), back[1]) : null,
      el('h2', { text: title }), chips, el('span.grow'), actions,
      el('button.btn.sm.ghost', { type: 'button', title: '重新载入这一页', on: { click: () => { frame.src = url; } } }, icon('reload'), '刷新'),
      el('a.btn.sm', { href: url, target: '_blank', rel: 'noopener' }, '新标签打开', icon('ext'))),
    el('div.frame-wrap', null, frame));
    return frame;
  }
  VIEWS.open = (rest, m) => {
    const t = TOOLS[rest[0]];
    if (!t) { VIEWS.home([], m); return; }
    let url = t.url;
    if (rest[0] === 'stage-editor' && validKey(rest[1])) url += `?stage=${encodeURIComponent(rest[1])}`;
    frameView(m, { title: t.name, url, actions: [], chips: t.old ? [el('span.chip', { text: '旧版 · 接下来重做' })] : [] });
  };

  // 样机目录：从 tools/labs.js 读登记表
  VIEWS.labs = (rest, m) => {
    setTitle('样机目录');
    const L = SA.LABS;
    if (!L) { m.append(el('div.empty', { text: '没读到样机登记表 tools/labs.js' })); return; }
    const group = rest[0] && (rest[0] === 'all' || L.GROUPS.some((g) => g.id === rest[0])) ? rest[0] : (prefs.labGroup || 'all');
    prefs.labGroup = group; prefs.labStatus = prefs.labStatus || {}; savePrefs();
    const statusOn = (s) => prefs.labStatus[s] !== false;
    const seg = el('div.seg', null, [['all', '全部'], ...L.GROUPS.map((g) => [g.id, g.name])].map(([id, name]) => el(`button${id === group ? '.on' : ''}`, { type: 'button', on: { click: () => go(`labs/${id}`) } }, name)));
    const stats = el('div.row', null, Object.entries(L.STATUS).map(([k, s]) => el('label.st', { style: 'cursor:pointer' },
      el('input', { type: 'checkbox', checked: statusOn(k), on: { change: (e) => { prefs.labStatus[k] = e.target.checked; savePrefs(); route(true); } } }),
      el('i', { style: `background:${s.color}` }), s.name)));
    const items = L.ITEMS.filter((it) => (group === 'all' || it.group === group) && statusOn(it.status));
    const grid = el('div.lab-grid', null, items.map((it) => {
      const s = L.STATUS[it.status] || {};
      return el('button.lab', { type: 'button', on: { click: () => go(`lab/${it.id}`) } },
        el('h3', { text: it.name }),
        el('div.meta', null, el('span.st', null, el('i', { style: `background:${s.color || 'var(--line)'}` }), s.name || it.status), el('span.mono', { text: it.ver }), el('span', { text: it.date })),
        el('p', { text: it.desc || '' }));
    }));
    m.append(el('div.view', null, el('div.labs', null,
      el('div.labs-head', null, el('div.pane-h', null, el('h2', { text: '样机目录' }), el('span.muted', { text: `${items.length} / ${L.ITEMS.length}` })),
        el('div.lab-filters', null, seg, el('span.grow'), stats)),
      items.length ? grid : el('div.empty', { text: '这个筛选下没有样机' }))));
  };
  VIEWS.lab = (rest, m) => {
    const it = SA.LABS?.ITEMS.find((x) => x.id === rest[0]);
    if (!it) { VIEWS.labs([], m); return; }
    const s = SA.LABS.STATUS[it.status] || {};
    frameView(m, { title: it.name, url: it.url, back: ['labs', '样机目录'], chips: [el('span.chip', { text: `${it.ver} · ${s.name || it.status}` })] });
  };

  // 游戏：嵌着的游戏 + 一排调试按钮（原来藏在游戏里的开发者面板）；drive = 拼装台「试驾」送来的车
  VIEWS.game = (rest, m) => {
    const textMode = rest[0] === 'text', drive = rest[0] === 'drive';
    setTitle(textMode ? '页面文字' : drive ? '试驾' : '游戏');
    const url = drive ? '../index.html#sandbox=evolve' : '../index.html';
    const frame = el('iframe', { src: url, title: '游戏' });
    const G = () => { try { return frame.contentWindow && frame.contentWindow.SA; } catch (e) { return null; } };
    const call = (label, fn, reload) => () => {
      const S = G();
      if (!S || !S.dev) { toast('游戏还没载入完', 'bad'); return; }
      try { fn(S); toast(label); if (reload) frame.contentWindow.location.reload(); } catch (e) { toast(`${label}失败：${e.message || e}`, 'bad'); }
    };
    const chSel = el('select', { 'aria-label': '跳到的章节' }, SA.CAMPAIGN.map((ch, i) => el('option', { value: i, text: ch.name })));
    frame.addEventListener('load', () => { if (textMode) setTimeout(() => { try { G()?.Text?.enterEdit(); } catch (e) { /* 页面还没就绪 */ } }, 600); });
    const backToStage = drive && prefs.stageKey ? el('a.btn.sm.ghost', { href: `#/stage/${prefs.stageKey}/build` }, icon('left'), '回拼装台') : null;
    m.append(el('div.frame-bar.on-wood', null,
      backToStage,
      el('h2', { text: textMode ? '页面文字' : drive ? '试驾 · 拼装台上的车' : '游戏' }),
      el('button.btn.sm.ghost', { type: 'button', on: { click: () => frame.contentWindow.location.reload() } }, icon('reload'), '刷新'),
      el('a.btn.sm.ghost', { href: url, target: '_blank', rel: 'noopener' }, '新标签打开', icon('ext')),
      el('span.sep'),
      el('button.btn.sm', { type: 'button', on: { click: call('已全部解锁、+£10000、锭各 +5', (S) => { S.dev.unlockAll(); S.dev.money(10000); S.dev.ingots(5); }, true) } }, '一键全部解锁'),
      el('button.btn.sm', { type: 'button', on: { click: call('+£1000', (S) => S.dev.money(1000)) } }, '+£1000'),
      el('button.btn.sm', { type: 'button', on: { click: call('乌兹钢锭、以太结晶各 +3', (S) => S.dev.ingots(3)) } }, '锭 +3'),
      chSel, el('button.btn.sm', { type: 'button', on: { click: () => call(`跳到${SA.CAMPAIGN[+chSel.value].name}`, (S) => S.dev.goto(+chSel.value), true)() } }, '跳到这一章'),
      el('button.btn.sm', { type: 'button', on: { click: call('已换成简陋初始车，原车零件在库存里', (S) => { S.dev.resetVehicle(); S.UI?.refresh?.(); }) } }, '换成简陋初始车'),
      armedButton('清空存档', '再点一次清空', () => call('存档已清空', (S) => S.reset(), true)()),
      el('span.sep'),
      el('button.btn.sm', { type: 'button', on: { click: () => { try { G().Text.toggle(); } catch (e) { toast('游戏还没载入完', 'bad'); } } } }, '页面文字编辑'),
      el('button.btn.sm', { type: 'button', on: { click: call('试驾场', (S) => S.CampUI.sandbox()) } }, '试驾场'),
      el('button.btn.sm.ghost', { type: 'button', on: { click: call('开发者面板', (S) => S.CampUI.devPanel()) } }, '开发者面板')),
    el('div.frame-wrap', null, frame));
  };

  // ---------- 搜索面板（Ctrl+K） ----------
  let palItems = null;
  function buildPalette() {
    const items = [];
    const add = (group, label, path, extra = '', run) => items.push({ group, label, path, extra, run, hay: `${label} ${extra}`.toLowerCase() });
    NAV.forEach((g) => g.items.forEach((it) => add('页面', it.name, it.path, g.group || '')));
    add('操作', '保存全部改动', null, 'Ctrl+S save', () => saveAll());
    allStages().forEach((k) => {
      const [ci, si] = k.split(',').map(Number), st = stageData(ci, si);
      add('关卡', `${st.code} ${st.name}`, `stage/${k}`, `${st.pilot || ''} ${chShort(st.chapter)} ${st.vehicle?.name || ''}`);
    });
    SA.StoryData.list().forEach((id) => add('剧情', sceneLabel(id), `story/${id}`, id));
    add('院子闲聊', '整体节奏 · 点击人物对话', 'chat/settings', '设置');
    ['global', ...SA.CAMPAIGN.flatMap((ch, ci) => [`chapter:${ci}`, ...ch.stages.map((_, si) => `stage:${ci}:${si}`)])].forEach((s) => add('院子闲聊', scopeName(s), `chat/${s}`, s));
    (SA.LABS?.ITEMS || []).forEach((it) => add('样机', it.name, `lab/${it.id}`, `${it.ver} ${it.id}`));
    Object.entries(SA.MODULES).filter(([, mod]) => !mod.retired && mod.name).forEach(([id, mod]) => add('模块', mod.name, 'open/modules', id));
    add('旧版', '关卡车工作台（旧版）', 'open/stage-editor', 'stage editor 关卡车拼装');
    return items;
  }
  function openPalette() {
    palItems = palItems || buildPalette();
    const box = $('#palette');
    const input = el('input', { type: 'text', placeholder: '搜关卡、剧情、闲聊、样机、模块……', 'aria-label': '搜索' });
    const list = el('div.pal-list', { role: 'listbox' });
    let hits = [], cur = 0;
    function score(it, q) {
      if (!q) return 1;
      const i = it.hay.indexOf(q);
      if (i >= 0) return 1000 - i - (it.label.toLowerCase().startsWith(q) ? 0 : 50);
      let p = 0;   // 按顺序出现的字也算命中（「煤寡」能找到「煤灰寡妇」）
      for (const ch of q) { p = it.hay.indexOf(ch, p); if (p < 0) return 0; p++; }
      return 100 - p / 10;
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      hits = palItems.map((it, i) => ({ it, s: score(it, q), i })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 80).map((x) => x.it);
      if (!q) hits = palItems.filter((it) => it.group === '页面' || it.group === '操作');
      cur = Math.min(cur, Math.max(0, hits.length - 1));
      let lastGroup = '';
      list.replaceChildren(...hits.flatMap((it, i) => {
        const out = [];
        if (it.group !== lastGroup) { out.push(el('div.pal-h', { text: it.group })); lastGroup = it.group; }
        out.push(el(`button.pal-item${i === cur ? '.on' : ''}`, { type: 'button', role: 'option', on: { click: () => pick(it), mousemove: () => { if (cur !== i) { cur = i; mark(); } } } },
          el('span', { text: it.label }), el('small', { text: it.group === '页面' ? it.extra : '' })));
        return out;
      }));
      if (!hits.length) list.append(el('div.empty', { text: '没找到' }));
    }
    function mark() { list.querySelectorAll('.pal-item').forEach((n, i) => n.classList.toggle('on', i === cur)); list.querySelectorAll('.pal-item')[cur]?.scrollIntoView({ block: 'nearest' }); }
    function close() { box.hidden = true; box.replaceChildren(); }
    function pick(it) { close(); if (it.run) it.run(); else go(it.path); }
    input.addEventListener('input', () => { cur = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(hits.length - 1, cur + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hits[cur]) pick(hits[cur]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    box.replaceChildren(el('div.pal', { role: 'dialog', 'aria-label': '搜索' }, input, list,
      el('div.pal-foot', null, el('span', null, el('kbd.kbd', { text: '↑↓' }), ' 选择'), el('span', null, el('kbd.kbd', { text: 'Enter' }), ' 打开'), el('span', null, el('kbd.kbd', { text: 'Esc' }), ' 关闭'))));
    box.onclick = (e) => { if (e.target === box) close(); };
    box.hidden = false;
    render();
    input.focus();
  }

  // ---------- 启动 ----------
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); if ($('#palette').hidden) openPalette(); }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); document.activeElement?.blur?.(); saveAll(); }
  });
  window.addEventListener('beforeunload', (e) => { captureGarage(); if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  // 关卡车在别的页面（旧工作台、另一个后台标签）保存后，本页的章节树和关卡资料跟着换
  try {
    const channel = new BroadcastChannel('steam-arena-stage-cars');
    channel.onmessage = (e) => {
      const p = e.data?.type === 'replace' && e.data.payload;
      if (!p?.records || (p.campaignLayout || 1) !== SA.CAMPAIGN_LAYOUT) return;
      applyStageCars(p.records);
      palItems = null;
      if (!saving && parse().view === 'stage') route(true);
    };
  } catch (e) { /* 不支持频道的浏览器只在本页更新 */ }

  async function boot() {
    if (SA.PX?.init) SA.PX.init();   // 游戏里的像素木纹桌面（--px-desk）
    applyLocalCars();
    buildShell();
    $('#view-root').append(el('div.empty', { text: '正在读取文本文件……' }));
    SA.Text.init({ game: 'steam-arena', locale: 'zh-CN', toolbar: false });
    await SA.Text.ready;
    window.addEventListener('hashchange', () => route());
    route();
  }
  boot().catch((e) => {
    console.error(e);
    $('#view-root')?.replaceChildren(el('div.empty', null, el('b', { text: '后台没能启动' }), e && e.message ? e.message : String(e)));
  });
})();
