// 蒸汽竞技场 · 后台：把分散在各页的工作台、剧情、院子闲聊、视觉样机和游戏调试收进一个页面。
// 新界面（关卡、剧情、院子闲聊、游戏与调试、样机目录）直接调用后台维护的数据接口：
//   SA.StageCars / SA.V（关卡车）、SA.StoryData（剧情）、SA.YardChat（院子闲聊）、SA.Text（共用文本文件）。
// 还没重做的工作台（关卡车拼装、模块属性、进化擂台、数值自测）原样嵌在框里用。
// 这里只做界面和流程；数据规则、校验和写文件都走原接口，不复制一份。
(() => {
  'use strict';
  const PREF_KEY = 'steam_arena_console_v1';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* 隐私模式：只在本页记住 */ } };
  const clone = (v) => JSON.parse(JSON.stringify(v));
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
    moon: '<path d="M11.5 10.5A5 5 0 0 1 5.5 4.5a5 5 0 1 0 6 6z"/>',
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
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
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'bad' ? 6000 : 2600);
  }

  // ---------- 主题 ----------
  function applyTheme() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
    const btn = $('#theme');
    if (btn) { btn.replaceChildren(icon(isDark() ? 'sun' : 'moon')); btn.title = isDark() ? '换成浅色' : '换成深色'; }
  }
  const isDark = () => (prefs.theme ? prefs.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  function toggleTheme() { prefs.theme = isDark() ? 'light' : 'dark'; savePrefs(); applyTheme(); }

  // ---------- 旧工作台和视觉页 ----------
  const TOOLS = {
    'stage-editor': { name: '关卡车拼装', url: 'stage-editor.html', old: true, desc: '拼装关卡车，改关卡文字、奖励与强度，保存手工锁定版本' },
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
      { id: 'stage-editor', name: '关卡车拼装', path: 'open/stage-editor', tag: 'old' },
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
  const STYLE = { rush: '冲锋', kite: '放风筝', turtle: '龟缩', rookie: '新手', wander: '游走', roam: '游走' };
  const chShort = (ch) => ch.name.split(' · ')[0];
  const chPlace = (ch) => ch.name.split(' · ')[1] || ch.place || '';
  const validKey = (k) => /^\d+,\d+$/.test(k || '') && !!SA.CAMPAIGN[+k.split(',')[0]]?.stages[+k.split(',')[1]];
  function stageData(ci, si) {
    const ch = SA.CAMPAIGN[ci], base = ch && ch.stages[si];
    if (!base) return null;
    let m;
    try { m = SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base, source: 'original' }; } catch (e) { m = { ...base, source: 'original' }; }
    let v = m.vehicle;
    if (!v) try { v = SA.V.fromAscii(m.name, m.rows || [], m.sides || [], m.mt || 1, m.elite || [], m.subs || []); } catch (e) { v = null; }
    return { ...m, ci, si, key: `${ci},${si}`, code: `${ci}-${si + 1}`, chapter: ch, vehicle: v };
  }
  const stageLabel = (key) => {
    const [ci, si] = key.split(',').map(Number), st = SA.CAMPAIGN[ci]?.stages[si];
    return st ? `${ci}-${si + 1} ${st.name}` : key;
  };
  const allStages = () => SA.CAMPAIGN.flatMap((ch, ci) => ch.stages.map((_, si) => `${ci},${si}`));

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
  const sceneEdited = (id) => !!SA.Text.get(`story:${id}`, '');
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

  // ---------- 保存状态：剧情和闲聊共用一份文本文件，一次写完 ----------
  const dirty = { story: new Set(), chat: new Set(), settings: false, tips: new Set() };
  const isDirty = () => !!(dirty.story.size || dirty.chat.size || dirty.settings || dirty.tips.size);
  function setStatus(state, detail) {
    const s = $('#status');
    s.dataset.state = state;
    const label = { clean: '已保存', dirty: '有改动 · Ctrl+S 保存', saving: '正在保存…', error: '保存失败 · 点此重试' }[state];
    s.replaceChildren(el('i'), label);
    s.title = detail || (state === 'dirty' ? `待保存：${[dirty.story.size && `${dirty.story.size} 个剧情场景`, dirty.chat.size && `${dirty.chat.size} 个闲聊范围`, dirty.settings && '闲聊节奏', dirty.tips.size && '点击人物对话'].filter(Boolean).join('、')}` : SA.Text.file());
  }
  const refreshStatus = () => setStatus(isDirty() ? 'dirty' : 'clean');
  let saving = false;
  async function saveAll() {
    if (saving) return;
    if (!isDirty()) { toast('没有需要保存的改动'); return; }
    saving = true; setStatus('saving');
    let staged = false;
    try {
      // 先全部校验，免得一个范围出错时别的已经进了文本草稿
      for (const scope of dirty.chat) { const d = chatDrafts.get(scope); if (d && d.mode !== 'inherit') SA.YardChat.validateGroups(d.groups); }
      if (dirty.settings) SA.YardChat.validateSettings(settingsDraft);
      for (const scope of dirty.chat) {
        const d = chatDrafts.get(scope);
        if (!d) continue;
        if (d.mode === 'inherit') SA.YardChat.inherit(scope); else SA.YardChat.write(scope, d.groups);
        staged = true;
      }
      if (dirty.settings) { SA.YardChat.setSettings(settingsDraft); staged = true; }
      for (const who of dirty.tips) { SA.Text.set(`home:tip:${who}`, clickDraft[who]); staged = true; }
      const result = await SA.YardChat.save();   // 写共用文本文件，并通知开着的游戏页
      // 支持文件选择的浏览器第一次保存要选一下文本文件（页面管理的既有做法），取消了就留着改动
      if (result && result.cancelled) {
        setStatus('dirty', '还没选文本文件');
        toast(`第一次保存要在弹出的窗口里选 ${SA.Text.file()}，以后就不用再选。这次没选成，改动还在。`, 'bad');
        return;
      }
      if (!result || !result.ok) throw result?.error || new Error('写入没有成功，草稿还在浏览器里');
      for (const scope of dirty.chat) chatDrafts.delete(scope);
      dirty.story.clear(); dirty.chat.clear(); dirty.settings = false; dirty.tips.clear();
      setStatus(result.pending ? 'dirty' : 'clean');
      toast(`已保存到 ${SA.Text.file()}`);
      route(true);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setStatus('error', msg);
      toast(staged ? `本机草稿已存，文件还没写入：${msg}` : `保存失败，改动还在页面上：${msg}`, 'bad');
    } finally { saving = false; }
  }

  // ---------- 剧情脚本编辑 ----------
  // 每改一次都交给 SA.StoryData.set（它负责校验并存进本机草稿），按保存才写进文本文件
  function scriptEditor(id) {
    const cast = Object.entries(SA.STORY.cast || {});
    const coalOf = (who) => (SA.STORY.cast[who] && (SA.STORY.cast[who].coal || SA.STORY.cast[who].name)) || null;
    const nameOf = (who) => (SA.STORY.cast[who] && SA.STORY.cast[who].name) || '旁白';
    const SCENES = { sleep: '睡觉', roof: '掀屋顶', roll: '滚进来', car: '战车' };
    let lines = sceneLines(id).map((l) => ({ ...l }));
    let sel = 0, err = '', playing = 0, typing = 0;
    const root = el('div.script');
    const main = el('div.script-main'), side = el('div.vn');
    root.append(main, side);

    function commit() {
      const empty = lines.findIndex((l) => !l.text.trim());
      if (empty >= 0) { err = `第 ${empty + 1} 句还是空的，写完才会存进草稿`; showErr(); return; }
      try {
        SA.StoryData.set(id, lines.map((l) => ({ text: l.text, who: l.who || undefined, ...(id === 'opening' ? { scene: l.scene || undefined } : {}) })));
        err = ''; dirty.story.add(id); refreshStatus();
      } catch (e) { err = e.message || String(e); }
      showErr();
    }
    const errBox = el('div.err', { role: 'status', 'aria-live': 'polite' });
    function showErr() { errBox.textContent = err; }

    function row(l, i) {
      const who = el('select', { 'aria-label': `第 ${i + 1} 句说话人`, on: { change: (e) => { l.who = e.target.value; commit(); renderPreview(); } } },
        el('option', { value: '', text: '旁白' }), cast.map(([k, c]) => el('option', { value: k, text: c.name })));
      who.value = l.who || '';
      const kids = [who];
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
        sceneEdited(id) ? el('span.chip.edited', { text: '已改' }) : el('span.chip', { text: '默认' }),
        el('span.grow'),
        armedButton('恢复默认', '再点一次恢复', () => { SA.Text.set(`story:${id}`, ''); dirty.story.add(id); refreshStatus(); lines = sceneLines(id).map((l) => ({ ...l })); sel = 0; render(); toast('已恢复默认台词，保存后生效'); }, 'btn sm ghost'));
      const list = lines.length ? lines.map(row) : [el('div.empty', null, el('b', { text: '这一幕还没有台词' }), '加一句试试。战前 / 战后为空时，游戏里就不插入剧情。')];
      const foot = el('div.script-foot', null,
        cast.map(([k, c]) => el('button.btn.sm', { type: 'button', on: { click: () => add(k) } }, icon('plus'), c.name)),
        el('button.btn.sm', { type: 'button', on: { click: () => add('') } }, icon('plus'), '旁白'));
      main.replaceChildren(head, ...list, foot, errBox);
      renderPreview();
    }

    const portraitCache = new Map();
    function portrait(who) {
      const name = coalOf(who), k = `${who}`;
      if (!name || !SA.Coal || !SA.Coal.byName[name]) return null;
      if (!portraitCache.has(k)) {
        try { portraitCache.set(k, SA.Coal.draw(SA.Coal.byName[name], { size: 'bust', expr: 'normal', cy: 62, look: who === 'smith' ? -1 : 1 })); } catch (e) { portraitCache.set(k, null); }
      }
      const src = portraitCache.get(k);
      if (!src) return null;
      const c = el('canvas', { width: src.width, height: src.height });
      c.getContext('2d').drawImage(src, 0, 0);
      return c;
    }
    function renderPreview() {
      const l = lines[sel];
      const box = l ? (l.who && SA.STORY.cast[l.who]
        ? el('div.vn-box', null, portrait(l.who) || el('div'), el('div', null, el('span.vn-name', { text: nameOf(l.who) }), el('div.vn-text', { text: l.text || '（空）' })))
        : el('div.vn-box', null, el('div.vn-text.vn-narr', { text: l.text || '（空）' })))
        : el('div.vn-box', null, el('div.vn-text.vn-narr', { text: '没有台词' }));
      const ctrl = el('div.vn-ctrl', null,
        el('button.btn.sm', { type: 'button', disabled: !lines.length, on: { click: play } }, icon('play'), playing ? '停' : '播放'),
        el('button.btn.sm.ghost', { type: 'button', disabled: sel <= 0, on: { click: () => { select(Math.max(0, sel - 1)); } } }, '上一句'),
        el('button.btn.sm.ghost', { type: 'button', disabled: sel >= lines.length - 1, on: { click: () => { select(Math.min(lines.length - 1, sel + 1)); } } }, '下一句'),
        el('span', { text: lines.length ? `${sel + 1} / ${lines.length}` : '' }));
      side.replaceChildren(el('div.vn-ctrl', { text: '对话框预览（游戏里的样子）' }), box, ctrl);
    }
    function play() {
      if (playing) { clearInterval(playing); playing = 0; renderPreview(); return; }
      sel = 0; renderPreview();
      playing = setInterval(() => {
        if (!root.isConnected || sel >= lines.length - 1) { clearInterval(playing); playing = 0; if (root.isConnected) renderPreview(); return; }
        select(sel + 1);
      }, 1800);
      renderPreview();
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
        parent && d.mode !== 'inherit' && d.source === scope ? el('button.btn.sm.ghost', { type: 'button', on: { click: () => { d.mode = 'inherit'; d.groups = clone(SA.YardChat.read(parent).groups); d.dirty = true; dirty.chat.add(scope); refreshStatus(); render(); } } }, '恢复继承上一级') : null);
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
      d.source = scope; d.dirty = true; dirty.chat.add(scope); refreshStatus();
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
  const main = () => $('#main');
  function buildShell() {
    const gear = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    gear.setAttribute('viewBox', '0 0 24 24'); gear.setAttribute('aria-hidden', 'true');
    gear.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>';
    gear.style.color = 'var(--brass)';
    const top = el('header.top', null,
      el('a.brand', { href: '#/home' }, gear, '蒸汽竞技场', el('small', { text: '后台' })),
      el('button.search', { type: 'button', on: { click: openPalette } }, el('span', { text: '搜索关卡、剧情、闲聊、样机、模块…' }), el('kbd', { text: 'Ctrl K' })),
      el('div.spacer'),
      el('button.status#status', { type: 'button', on: { click: () => saveAll() } }),
      el('button.icon-btn#theme', { type: 'button', on: { click: toggleTheme } }));
    const side = el('nav.side#nav', { 'aria-label': '后台导航' },
      NAV.map((g) => el('div.nav-group', null, g.group ? el('h4', { text: g.group }) : null,
        g.items.map((it) => el('a.nav-item', { href: `#/${it.path}`, dataset: { nav: it.id } }, it.name,
          it.tag ? el(`span.tag${it.tag === 'new' ? '.new' : ''}`, { text: it.tag === 'new' ? '新' : '旧版' }) : null)))),
      el('div.side-foot', { title: `后台 ${SA.BUILD_SYS || ''}
视觉 ${SA.BUILD_VIS || ''}` }, '最近一次构建',
        el('span.mono', { text: `视觉 · ${lastBuild(SA.BUILD_VIS)}` }), el('span.mono', { text: `后台 · ${lastBuild(SA.BUILD_SYS)}` })));
    $('#app').replaceChildren(top, side, el('main.main#main'));
    applyTheme();
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
    if (cleanup) { try { cleanup(); } catch (e) { /* 忽略 */ } cleanup = null; }
    const m = main();
    const keepScroll = keep && m.firstElementChild ? [...m.querySelectorAll('[data-keep-scroll]')].map((n) => n.scrollTop) : null;
    m.replaceChildren();
    fn(rest, m);
    if (keepScroll) m.querySelectorAll('[data-keep-scroll]').forEach((n, i) => { n.scrollTop = keepScroll[i] || 0; });
    const navId = view === 'open' ? rest[0] : view === 'lab' ? 'labs' : view === 'game' && rest[0] === 'text' ? 'text' : view;
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('on', a.dataset.nav === navId));
    if (view !== 'home') { prefs.last = location.hash; prefs.lastLabel = document.title.replace(' · 后台', ''); savePrefs(); }
  }
  const setTitle = (t) => { document.title = `${t} · 后台`; };

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
    const last = prefs.last && !/^#\/?(home)?$/.test(prefs.last) ? el('a.continue', { href: prefs.last }, el('span.muted', { text: '接着上次：' }), el('b', { text: prefs.lastLabel || prefs.last })) : null;
    m.append(el('div.view', null, el('div.home', null,
      el('div', null, el('h1', { text: '后台' }), el('p.lede', { text: '工作台、剧情、院子闲聊、视觉样机和游戏调试都在这里。按 Ctrl+K 搜任何一关、一幕剧情、一个样机。标「新」的是重做过的界面，标「旧版」的先原样嵌在框里用。' })),
      last,
      el('div.section-h', null, el('h2', { text: '常用' })),
      el('div.cards', null,
        card('stage', '关卡', `${stages.length} 关`, '一关一个工作区：车、剧情、闲聊、文字和奖励放在一起看。', `${manual} 辆手工关卡车`),
        card('story', '剧情', `${scenes.length} 幕`, '开场、教程、每关战前战后、功能开放。改完看对话框预览。', `${edited} 幕改过`),
        card('chat', '院子闲聊', `${ownChat} 个范围`, '全局、每章、每关的闲聊和多人对答。', '单独编排的范围'),
        cur ? card('open/current', '当前开发', null, cur.desc, `${cur.ver} · ${cur.date}`) : null,
        card('game', '游戏', null, '嵌着的游戏，加上一排调试按钮：全部解锁、加钱、跳章、清档、页面文字编辑、试驾场。', null)),
      el('div.section-h', null, el('h2', { text: '还没重做的工作台' }), el('span', { text: '先嵌在后台里用，下一步逐个换成新界面' })),
      el('div.cards', null, ['stage-editor', 'evolve', 'selftest', 'modules'].map(toolCard)),
      el('div.section-h', null, el('h2', { text: '视觉' })),
      el('div.cards', null, card('labs', '样机目录', `${SA.LABS?.ITEMS.length || 0} 个`, '全部视觉样机，按类别和状态筛选。', null), ['candidates', 'spritesheet', 'style'].map(toolCard)))));
  };

  // 关卡工作区：左边章节树，中间这一关，右边关卡信息
  VIEWS.stage = (rest, m) => {
    let key = validKey(rest[0]) ? rest[0] : validKey(prefs.stageKey) ? prefs.stageKey : '0,0';
    const TABS = { car: '车辆', story: '剧情', chat: '院子闲聊', text: '文字与奖励' };
    const tab = TABS[rest[1]] ? rest[1] : TABS[prefs.stageTab] ? prefs.stageTab : 'car';
    prefs.stageKey = key; prefs.stageTab = tab; savePrefs();
    const [ci, si] = key.split(',').map(Number);
    const st = stageData(ci, si);
    setTitle(`${st.code} ${st.name}`);
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
          const d = stageData(c, s), rec = SA.STAGE_CARS?.records?.[`${c}:${s}`];
          const hay = `${d.code} ${d.name} ${d.pilot || ''}`.toLowerCase();
          if (q && !hay.includes(q)) return null;
          return el(`button.st-item${d.key === key ? '.on' : ''}`, { type: 'button', title: `${d.code} ${d.name} · ${d.pilot || ''}`, on: { click: () => goStage(d.key) } },
            el('span.code', { text: d.code }), el('span.nm', null, d.name, el('small', { text: d.pilot || '' })),
            el('span.marks', null, d.boss ? el('span.mark', { text: '★', title: 'Boss' }) : null,
              rec ? el('span.pip.manual', { title: '手工关卡车' }) : null, rec && rec.locked !== false ? el('span.pip.locked', { title: '已锁定' }) : null));
        }).filter(Boolean);
        if (!items.length) return null;
        const closed = !q && prefs.closed[c] && c !== ci;
        const h = el(`button.ch-h${closed ? '.closed' : ''}`, { type: 'button', on: { click: () => { prefs.closed[c] = !closed; savePrefs(); renderTree(); } } }, icon('chev'), `${chShort(ch)} · ${chPlace(ch)}`);
        return el('div', null, h, closed ? null : items);
      }).filter(Boolean));
    }
    filter.addEventListener('input', () => { prefs.stageFilter = filter.value; savePrefs(); renderTree(); });
    renderTree();
    const tree = el('aside.tree', null, el('div.filter', null, filter), list);

    // 中：这一关
    const rec = SA.STAGE_CARS?.records?.[`${ci}:${si}`];
    const head = el('div.stage-head', null,
      el('div.code', { text: st.code }),
      el('div', { style: 'min-width:0' }, el('h2', { text: st.name }),
        el('div.who', null, st.pilot || '无名车手', st.boss ? el('span.chip.boss', { text: '★ Boss' }) : null,
          rec ? el('span.chip.manual', { text: '手工关卡车' }) : el('span.chip', { text: '原始数据' }), rec && rec.locked !== false ? el('span.chip.locked', { text: '已锁定' }) : null)),
      el('div.acts', null,
        el('button.btn.sm', { type: 'button', disabled: idx <= 0, title: '上一关（[）', on: { click: () => goStage(keys[idx - 1]) } }, icon('left'), '上一关'),
        el('button.btn.sm', { type: 'button', disabled: idx >= keys.length - 1, title: '下一关（]）', on: { click: () => goStage(keys[idx + 1]) } }, '下一关', icon('right')),
        el('a.btn.sm.primary', { href: `#/open/stage-editor/${key}` }, '在关卡车拼装里改')));
    const sceneIds = new Set(SA.StoryData.list());
    const storySlots = [['before', `before.${key}`, '战前'], ['win', `stage.${key}.win`, '胜利'], ['lose', `stage.${key}.lose`, '失败'], ['after', `after.${key}`, '战后']];
    const storyCount = storySlots.filter(([, id]) => sceneIds.has(id) && sceneLines(id).length).length;
    const chatScope = `stage:${ci}:${si}`;
    const tabs = el('div.tabs', { role: 'tablist' }, Object.entries(TABS).map(([k, v]) => el(`button.tab${k === tab ? '.on' : ''}`, { type: 'button', role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', on: { click: () => goStage(key, k) } }, v,
      k === 'story' ? el('span.count', { text: storyCount ? `${storyCount} 幕` : '' }) : k === 'chat' ? el('span.count', { text: scopeOwn(chatScope) ? '本关' : '继承' }) : null)));
    const body = el('div.stage-body', { 'data-keep-scroll': '' });

    if (tab === 'car') {
      const v = st.vehicle;
      if (!v) body.append(el('div.empty', null, el('b', { text: '这一关还没有车' }), '去关卡车拼装里拼一台。'));
      else {
        let cv = null;
        try { cv = carCanvas(v); } catch (e) { cv = null; }
        const box = el('div.car-stage', null, el('span.cap', { text: rec?.vehicleName || st.vehicleName || st.name }), cv || el('div.muted', { text: '画不出这台车' }));
        // 像素画只按整数倍放大：放得下就 2 倍，放不下 1 倍
        if (cv) {
          const fit = () => { const s = cv.width * 2 <= box.clientWidth - 32 ? 2 : 1; cv.style.width = `${cv.width * s}px`; cv.style.height = `${cv.height * s}px`; };
          const ro = new ResizeObserver(fit); ro.observe(box);
        }
        body.append(box);
        let s = null;
        try { s = SA.V.stats(v); } catch (e) { s = null; }
        if (s) {
          const stat = (label, val) => el('div.stat', null, el('span', { text: label }), el('b', { text: val }));
          body.append(el('div.stats', null, stat('评分', Math.round(s.rating || 0)), stat('价值', `£${Math.round(s.value || 0)}`), stat('耐久', Math.round(s.maxHp || s.hp || 0)),
            stat('火力', `${(s.dps || 0).toFixed(1)}/s`), stat('重量', `${((s.weight || 0) / 1000).toFixed(1)} t`), stat('速度', Math.round(s.speed || 0)), stat('零件', s.count || 0)));
        }
        const counts = new Map();
        SA.V.each(v, (cell) => { const k = `${cell.id}|${cell.mt || 1}|${cell.look || ''}`; counts.set(k, (counts.get(k) || 0) + 1); });
        const parts = [...counts.entries()].map(([k, n]) => {
          const [id, mt] = k.split('|'), mod = SA.MODULES[id];
          let thumb = null;
          try { thumb = SA.SPR.moduleCanvas(id, 1, +mt); } catch (e) { thumb = null; }
          return el('div.part', null, el('div.thumb', null, thumb), el('div', { style: 'min-width:0' }, el('b', { text: mod ? mod.name : id }), el('span', { text: `${SA.MATS?.[+mt]?.name || `T${mt}`}${n > 1 ? ` × ${n}` : ''}` })));
        });
        body.append(el('div.block-h', null, el('h3', { text: '零件' }), el('span.muted', { text: `${counts.size} 种` })), el('div.parts', null, parts));
      }
    } else if (tab === 'story') {
      const slot = storySlots.find(([k, id]) => k === prefs.storySlot && sceneIds.has(id)) || storySlots.find(([, id]) => sceneIds.has(id));
      const slots = el('div.slots', null, storySlots.map(([k, id, name]) => {
        const ok = sceneIds.has(id), n = ok ? sceneLines(id).length : 0;
        return el(`button.slot${slot && slot[0] === k ? '.on' : ''}${ok ? '' : '.off'}`, { type: 'button', disabled: !ok, title: ok ? id : '这一关还没有专属的胜负台词，需要后台开放这个场景',
          on: { click: () => { prefs.storySlot = k; savePrefs(); route(true); } } },
          el('b', null, name, ok && sceneEdited(id) ? el('span.chip.edited', { text: '已改' }) : null, dirty.story.has(id) ? el('span.dot', { title: '未保存' }) : null),
          el('span', { text: ok ? (n ? `${n} 句` : '空 · 不插入剧情') : '未开放' }));
      }));
      body.append(slots, slot ? scriptEditor(slot[1]) : el('div.empty', { text: '没有可编辑的场景' }));
    } else if (tab === 'chat') {
      body.append(chatEditor(chatScope, { stageName: st.name }));
    } else {
      const u = st.unlock || {};
      const pill = (t) => el('span.chip', { text: t });
      const unlocks = [...(u.mods || []).map((id) => SA.MODULES[id]?.name || id), ...(u.feat || []).map((f) => SA.FEATURES[f] || f),
        u.mat ? `材料 · ${SA.MATS?.[u.mat]?.name || u.mat}` : null, u.grid ? `改装台 ${u.grid.cols}×${u.grid.rows}` : null].filter(Boolean);
      const field = (label, text) => el('div', { style: 'display:grid;gap:4px' }, el('div.muted', { style: 'font-size:12px', text: label }), el('div.note', { style: 'white-space:pre-wrap', text: text || '（空）' }));
      body.append(el('div.note.warn', { text: '这一页先只读。要改文字、奖励和强度，点右上角「在关卡车拼装里改」——下一步会把这些表单搬到这里。' }),
        field('对手简介（出战海报上的话）', st.blurb), field('弱点（线人手写）', st.weakness), field('过关提示', u.note),
        el('div', { style: 'display:grid;gap:6px' }, el('div.muted', { style: 'font-size:12px', text: '解锁' }), el('div.reward-list', null, unlocks.length ? unlocks.map(pill) : pill('无'))),
        field('设计意图', st.spec?.lesson));
    }
    const center = el('section.stage', null, head, tabs, body);

    // 右：关卡信息
    const terrain = SA.TERRAINS[st.terrain || st.spec?.terrain || 'flat'] || SA.TERRAINS.flat;
    const kv = (pairs) => el('dl.kv', null, pairs.filter(([, v]) => v != null && v !== '').flatMap(([k, v]) => [el('dt', { text: k }), el('dd', null, v)]));
    const rewards = [...(st.rewardItems || []).map((r) => `${SA.MODULES[r.id]?.name || r.id} × ${r.count}`), ...(st.uniqueLoot || []).map((r) => `唯一 · ${SA.MODULES[r.id]?.name || r.id}`), ...Object.entries(st.drop || {}).map(([k, n]) => `${SA.INGOTS?.[k]?.name || k} × ${n}`)];
    const info = el('aside.info', null,
      el('div', null, el('h3', { text: '关卡' }), kv([['章节', `${chShort(st.chapter)} · ${chPlace(st.chapter)}`], ['地形', terrain.name], ['性格', STYLE[st.style] || '游走'], ['枪法', st.aim != null ? String(st.aim) : null],
        ['奖金', st.prize != null ? `£${st.prize}` : null], ['材料', SA.MATS?.[st.mt || 1]?.name], ['类型', st.boss ? 'Boss' : '普通']])),
      el('div', null, el('h3', { text: '地形' }), el('div.prose', { text: terrain.desc || '' })),
      rewards.length ? el('div', null, el('h3', { text: '固定奖励' }), el('div.reward-list', null, rewards.map((t) => el('span.chip', { text: t })))) : null,
      el('div', null, el('h3', { text: '简介' }), el('div.prose', { text: st.blurb || '（空）' })));

    m.append(el('div.ws', null, tree, center, info));
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '[' && idx > 0) goStage(keys[idx - 1]);
      if (e.key === ']' && idx < keys.length - 1) goStage(keys[idx + 1]);
    };
    document.addEventListener('keydown', onKey);
    cleanup = () => document.removeEventListener('keydown', onKey);
    requestAnimationFrame(() => list.querySelector('.st-item.on')?.scrollIntoView({ block: 'nearest' }));
  };

  function carCanvas(v) {
    const src = SA.SPR.renderVehicle(v, { key: 'console', t: 0, heat: 0.45, water: 0.8 });
    const g = src.getContext('2d'), { width: w, height: h } = src, d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const out = document.createElement('canvas');
    if (x1 < 0) { out.width = out.height = 1; return out; }
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
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
    const list = el('div', { 'data-keep-scroll': '' });
    function renderIndex() {
      const q = filter.value.trim();
      list.replaceChildren(...groups.map(([name, gids]) => {
        const items = gids.filter((x) => !q || sceneLabel(x).includes(q) || x.includes(q)).map((x) => {
          const n = sceneLines(x).length;
          return el(`button.idx-item${x === id ? '.on' : ''}`, { type: 'button', on: { click: () => go(`story/${x}`) } },
            el('span', { text: sceneLabel(x) }), dirty.story.has(x) ? el('span.dot', { title: '未保存' }) : null,
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
      el('span', { text: label }), dirty.chat.has(s) ? el('span.dot', { title: '未保存' }) : null, s !== 'settings' && scopeOwn(s) ? el('span.chip.manual', { text: '单独' }) : null);
    const index = el('aside.index', { 'data-keep-scroll': '' },
      el('div.idx-h', { text: '设置' }), item('settings', '整体节奏 · 点击人物对话'),
      el('div.idx-h', { text: '闲聊范围' }), item('global', '全局默认'),
      SA.CAMPAIGN.map((ch, ci) => [item(`chapter:${ci}`, `${chShort(ch)} · ${chPlace(ch)}`), ch.stages.map((st, si) => item(`stage:${ci}:${si}`, `${ci}-${si + 1} ${st.name}`, true))]));
    const pane = el('section.pane', { 'data-keep-scroll': '' });
    if (scope === 'settings') {
      settingsDraft = settingsDraft || clone(SA.YardChat.settings());
      clickDraft = clickDraft || { ...SA.YardChat.clickTips() };
      const num = (k, label) => el('label.field', null, label, el('input', { type: 'number', min: 0, step: 0.1, value: settingsDraft[k], on: { input: (e) => { settingsDraft[k] = Number(e.target.value); dirty.settings = true; refreshStatus(); } } }));
      pane.append(el('div.pane-h', null, el('h2', { text: '整体节奏' })),
        el('div.chat-top', null, num('intervalSec', '两组闲聊之间（秒）'), num('replySec', '对答两句之间（秒）'), num('bubbleSec', '气泡停留（秒）')),
        el('div.pane-h', null, el('h2', { text: '点击人物对话' }), el('span.muted', { text: '所有章节共用；一行一句' })),
        el('div.chat-top', null, Object.entries(CHAT_WHO).map(([who, name]) => el('label.field', null, name,
          autoGrow(el('textarea', { rows: 3, value: clickDraft[who] || '', on: { input: (e) => { clickDraft[who] = e.target.value; dirty.tips.add(who); refreshStatus(); } } }))))));
    } else {
      const stageName = scope.startsWith('stage:') ? SA.CAMPAIGN[+scope.split(':')[1]]?.stages[+scope.split(':')[2]]?.name : null;
      pane.append(el('div.pane-h', null, el('h2', { text: scopeName(scope) }), el('span.muted', { text: '{关卡名} 会换成当时的关卡名' })), chatEditor(scope, { stageName }));
    }
    m.append(el('div.split', null, index, pane));
    requestAnimationFrame(() => index.querySelector('.idx-item.on')?.scrollIntoView({ block: 'nearest' }));
  };

  // 嵌入页：旧工作台、视觉页
  function frameView(m, { title, url, chips = [], back }) {
    setTitle(title);
    const frame = el('iframe', { src: url, title });
    m.append(el('div.frame-bar', null,
      back ? el('a.btn.sm.ghost', { href: `#/${back[0]}` }, icon('left'), back[1]) : null,
      el('h2', { text: title }), chips, el('span.grow'),
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
    frameView(m, { title: t.name, url, chips: t.old ? [el('span.chip', { text: '旧版 · 下一步重做' })] : [] });
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
        el('div.meta', null, el('span.st', null, el('i', { style: `background:${s.color || 'var(--rule-2)'}` }), s.name || it.status), el('span.mono', { text: it.ver }), el('span', { text: it.date })),
        el('p', { text: it.desc || '' }));
    }));
    m.append(el('div.view', null, el('div.labs', null, el('div.pane-h', null, el('h2', { text: '样机目录' }), el('span.muted', { text: `${items.length} / ${L.ITEMS.length}` })),
      el('div.lab-filters', null, seg, el('span.grow'), stats), items.length ? grid : el('div.empty', { text: '这个筛选下没有样机' }))));
  };
  VIEWS.lab = (rest, m) => {
    const it = SA.LABS?.ITEMS.find((x) => x.id === rest[0]);
    if (!it) { VIEWS.labs([], m); return; }
    const s = SA.LABS.STATUS[it.status] || {};
    frameView(m, { title: it.name, url: it.url, back: ['labs', '样机目录'], chips: [el('span.chip', { text: `${it.ver} · ${s.name || it.status}` })] });
  };

  // 游戏：嵌着的游戏 + 一排调试按钮（原来藏在游戏里的开发者面板）
  VIEWS.game = (rest, m) => {
    const textMode = rest[0] === 'text';
    setTitle(textMode ? '页面文字' : '游戏');
    const url = '../index.html';
    const frame = el('iframe', { src: url, title: '游戏' });
    const G = () => { try { return frame.contentWindow && frame.contentWindow.SA; } catch (e) { return null; } };
    const call = (label, fn, reload) => () => {
      const S = G();
      if (!S || !S.dev) { toast('游戏还没载入完', 'bad'); return; }
      try { fn(S); toast(label); if (reload) frame.contentWindow.location.reload(); } catch (e) { toast(`${label}失败：${e.message || e}`, 'bad'); }
    };
    const chSel = el('select', { 'aria-label': '跳到的章节' }, SA.CAMPAIGN.map((ch, i) => el('option', { value: i, text: ch.name })));
    frame.addEventListener('load', () => { if (textMode) setTimeout(() => { try { G()?.Text?.enterEdit(); } catch (e) { /* 页面还没就绪 */ } }, 600); });
    m.append(el('div.frame-bar', null,
      el('h2', { text: textMode ? '页面文字' : '游戏' }),
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
    add('操作', '换深浅色', null, 'theme dark light', toggleTheme);
    allStages().forEach((k) => { const [ci, si] = k.split(',').map(Number), st = stageData(ci, si); add('关卡', `${st.code} ${st.name}`, `stage/${k}`, `${st.pilot || ''} ${chShort(st.chapter)}`); });
    SA.StoryData.list().forEach((id) => add('剧情', sceneLabel(id), `story/${id}`, id));
    add('院子闲聊', '整体节奏 · 点击人物对话', 'chat/settings', '设置');
    ['global', ...SA.CAMPAIGN.flatMap((ch, ci) => [`chapter:${ci}`, ...ch.stages.map((_, si) => `stage:${ci}:${si}`)])].forEach((s) => add('院子闲聊', scopeName(s), `chat/${s}`, s));
    (SA.LABS?.ITEMS || []).forEach((it) => add('样机', it.name, `lab/${it.id}`, `${it.ver} ${it.id}`));
    Object.entries(SA.MODULES).filter(([, mod]) => !mod.hidden && mod.name).forEach(([id, mod]) => add('模块', mod.name, 'open/modules', id));
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
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  async function boot() {
    buildShell();
    main().append(el('div.empty', { text: '正在读取文本文件……' }));
    SA.Text.init({ game: 'steam-arena', locale: 'zh-CN', toolbar: false });
    await SA.Text.ready;
    window.addEventListener('hashchange', () => route());
    route();
  }
  boot().catch((e) => {
    console.error(e);
    main().replaceChildren(el('div.empty', null, el('b', { text: '后台没能启动' }), e && e.message ? e.message : String(e)));
  });
})();
