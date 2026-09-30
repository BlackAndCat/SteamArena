// 可复用的 HTML5 文本管理包。
//
// 设计目标：
// 1. 运行时编辑 DOM 文本、按钮文案和 title/aria-label 等属性；
// 2. 同一个 key 可以绑定多个位置，修改后即时联动；
// 3. 开发服务器将覆盖值保存到 text/<game>/<locale>.json，静态部署则保存到 localStorage；
// 4. 不直接改写散落在业务 JS 里的字符串，避免正则替换破坏模板和逻辑。
//
// 最小接入示例：
//   SA.Text.init({ game: 'my-game', locale: 'zh-CN' });
//   SA.Text.bindText(button, 'ui.start', '开始游戏');
//   SA.Text.bindAttr(icon, 'title', 'ui.start.tip', '开始游戏');
// 页面中没有显式绑定的普通 DOM 文本也能在编辑模式下临时编辑；编辑器会为它生成稳定的页面路径 key。
window.SA = window.SA || {};

SA.Text = (() => {
  const config = {
    game: 'steam-arena',
    locale: 'zh-CN',
    loadUrl: '/__text/load',
    saveUrl: '/__text/save',
  };
  const values = Object.create(null);
  const defaults = Object.create(null);
  const keyEntries = new Map();
  const allEntries = new Set();
  const autoEntries = new Set();
  const manualBindings = new WeakMap();
  const listeners = new Set();
  let editing = false;
  let dirty = false;
  let started = false;
  let loaded = false;
  let scanTimer = 0;
  let observer = null;
  let activeEntry = null;
  let toolbar = null;
  let editorInput = null;
  let editorBox = null;
  let statusEl = null;
  let saves = Promise.resolve(); // 同页的连续保存按顺序写入，防止旧请求覆盖新稿。
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });

  const storageKey = () => `sa-text-${config.game}-${config.locale}`;
  const fileName = () => `text/${config.game}/${config.locale}.json`;
  const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 240;
  const isUiElement = el => el && el.closest && el.closest('#sa-text-manager');

  function notify(key) {
    listeners.forEach(fn => {
      try { fn(key, get(key)); } catch (e) { console.error('SA.Text.onChange 回调失败', e); }
    });
  }

  function addEntry(entry) {
    allEntries.add(entry);
    if (!keyEntries.has(entry.key)) keyEntries.set(entry.key, new Set());
    keyEntries.get(entry.key).add(entry);
    if (entry.auto) autoEntries.add(entry);
    return entry;
  }

  function removeAutoEntries() {
    autoEntries.forEach(entry => {
      allEntries.delete(entry);
      const set = keyEntries.get(entry.key);
      if (set) {
        set.delete(entry);
        if (!set.size) keyEntries.delete(entry.key);
      }
    });
    autoEntries.clear();
  }

  function register(key, fallback = '', meta = {}) {
    if (!safeKey(key)) throw new Error('SA.Text.register 需要非空且不超过 240 字符的 key');
    if (!(key in defaults)) defaults[key] = String(fallback == null ? '' : fallback);
    if (!keyEntries.has(key)) addEntry({ key, kind: 'value', explicit: true, ...meta });
    return get(key, fallback);
  }

  function get(key, fallback = '') {
    if (key in values) return values[key];
    return key in defaults ? defaults[key] : String(fallback == null ? '' : fallback);
  }

  function set(key, value, options = {}) {
    if (!safeKey(key)) throw new Error('SA.Text.set 需要非空且不超过 240 字符的 key');
    const next = String(value == null ? '' : value);
    if (!(key in defaults)) defaults[key] = next;
    if (values[key] === next && key in values) return next;
    values[key] = next;
    dirty = true;
    applyKey(key);
    persistLocal();
    if (!options.silent) notify(key);
    updateToolbar();
    return next;
  }

  function applyEntry(entry) {
    if (!entry || !entry.target || !entry.target.isConnected) return;
    const value = get(entry.key, entry.fallback);
    if (entry.kind === 'attr') {
      if (entry.target.getAttribute(entry.attr) !== value) entry.target.setAttribute(entry.attr, value);
      return;
    }
    const nodes = directTextNodes(entry.target);
    const node = nodes[entry.nodeIndex || 0];
    if (!node) return;
    const prefix = entry.prefix || '';
    const suffix = entry.suffix || '';
    const next = `${prefix}${value}${suffix}`;
    if (node.data !== next) node.data = next;
  }

  function applyKey(key) {
    const setOfEntries = keyEntries.get(key);
    if (setOfEntries) setOfEntries.forEach(applyEntry);
  }

  function directTextNodes(el) {
    return Array.from(el.childNodes || []).filter(node =>
      node.nodeType === Node.TEXT_NODE && node.data.trim());
  }

  function stableClasses(el) {
    const transient = new Set(['on', 'open', 'show', 'active', 'sel', 'bad', 'folded', 'hidden', 'drag']);
    return Array.from(el.classList || []).filter(name => !transient.has(name)).slice(0, 2);
  }

  // 自动 key 不读取文案本身，所以修改后 key 不会漂移；正式接入仍建议使用 bindText 的语义 key。
  function elementPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      const classes = stableClasses(node);
      if (classes.length) part += `.${classes.join('.')}`;
      if (!node.id && node.parentElement) {
        const same = Array.from(node.parentElement.children).filter(child => child.tagName === node.tagName);
        part += `:n${Math.max(1, same.indexOf(node) + 1)}`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join('/');
  }

  function textKey(el, index) {
    return `dom:${elementPath(el)}::text:${index}`;
  }

  function attrKey(el, attr) {
    return `dom:${elementPath(el)}::attr:${attr}`;
  }

  function editableAttributes(el) {
    return ['title', 'aria-label', 'alt', 'placeholder'].filter(attr => {
      const value = el.getAttribute && el.getAttribute(attr);
      return value != null && String(value).trim();
    });
  }

  function scan(root = document.body) {
    if (!root || !document.body) return;
    removeAutoEntries();
    const elements = root === document.body ? [root, ...root.querySelectorAll('*')] : [root, ...root.querySelectorAll('*')];
    elements.forEach(el => {
      if (el === document.body || isUiElement(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;
      const nodes = directTextNodes(el);
      if (nodes.length) {
        el.dataset.saTextEditable = '1';
        nodes.forEach((node, index) => {
          const key = el.dataset.textKey && index === 0 ? el.dataset.textKey : textKey(el, index);
          const raw = node.data;
          const prefix = (raw.match(/^\s*/) || [''])[0];
          const suffix = (raw.match(/\s*$/) || [''])[0];
          // 扫描得到的绑定每次重绘都重新建立；显式 bindText 保留自己的语义 key。
          addEntry({ key, kind: 'text', target: el, nodeIndex: index, fallback: raw.trim(), prefix, suffix, auto: true });
          if (key in values) applyKey(key);
        });
      }
      editableAttributes(el).forEach(attr => {
        const key = attr === 'title' && el.dataset.textKey ? `${el.dataset.textKey}.${attr}` : attrKey(el, attr);
        el.dataset.saTextEditable = '1';
        addEntry({ key, kind: 'attr', attr, target: el, fallback: el.getAttribute(attr), auto: true });
        if (key in values) applyKey(key);
      });
    });
    applyAll();
  }

  function applyAll() {
    allEntries.forEach(applyEntry);
  }

  function bindText(el, key, fallback = '') {
    if (!el || !safeKey(key)) throw new Error('SA.Text.bindText 需要元素和合法 key');
    el.dataset.textKey = key;
    register(key, fallback);
    const nodes = directTextNodes(el);
    if (!nodes.length && !el.children.length) el.append(document.createTextNode(String(fallback)));
    const nextNodes = directTextNodes(el);
    nextNodes.forEach((node, index) => addEntry({ key: index === 0 ? key : `${key}.${index}`, kind: 'text', target: el, nodeIndex: index, fallback: node.data.trim(), prefix: (node.data.match(/^\s*/) || [''])[0], suffix: (node.data.match(/\s*$/) || [''])[0], explicit: true }));
    el.dataset.saTextEditable = '1';
    applyKey(key);
    return el;
  }

  function bindAttr(el, attr, key, fallback = '') {
    if (!el || !safeKey(key)) throw new Error('SA.Text.bindAttr 需要元素和合法 key');
    if (!manualBindings.has(el)) manualBindings.set(el, new Map());
    manualBindings.get(el).set(attr, key);
    register(key, fallback);
    addEntry({ key, kind: 'attr', attr, target: el, fallback: String(fallback), explicit: true });
    el.dataset.saTextEditable = '1';
    applyKey(key);
    return el;
  }

  function canvas(key, fallback) {
    register(key, fallback);
    return get(key, fallback);
  }

  // Canvas 文字没有 DOM 节点，绘制时通过这个辅助函数读取覆盖值即可参与同一套编辑数据。
  function draw(ctx, key, x, y, fallback = '', options = {}) {
    const text = canvas(key, fallback);
    if (!ctx || typeof ctx.fillText !== 'function') return text;
    ctx.save();
    Object.entries(options || {}).forEach(([name, value]) => {
      if (name in ctx) ctx[name] = value;
    });
    ctx.fillText(text, x, y);
    ctx.restore();
    return text;
  }

  function findEntry(target, preferAttribute = false) {
    let node = target && target.nodeType === Node.ELEMENT_NODE ? target : target && target.parentElement;
    while (node && node !== document.body) {
      const direct = directTextNodes(node);
      const attributeEntry = () => {
        for (const attr of editableAttributes(node)) {
          const key = attr === 'title' && node.dataset.textKey ? `${node.dataset.textKey}.${attr}` : attrKey(node, attr);
          const setOfEntries = keyEntries.get(key);
          if (setOfEntries && setOfEntries.size) return Array.from(setOfEntries)[0];
        }
        return null;
      };
      if (preferAttribute) {
        const entry = attributeEntry();
        if (entry) return entry;
      }
      if (direct.length) {
        const key = node.dataset.textKey || textKey(node, 0);
        const setOfEntries = keyEntries.get(key);
        if (setOfEntries && setOfEntries.size) return Array.from(setOfEntries)[0];
      }
      if (!preferAttribute) {
        const entry = attributeEntry();
        if (entry) return entry;
      }
      const child = node.querySelector && node.querySelector('[data-sa-text-editable]');
      if (child && directTextNodes(child).length) {
        const key = child.dataset.textKey || textKey(child, 0);
        const setOfEntries = keyEntries.get(key);
        if (setOfEntries && setOfEntries.size) return Array.from(setOfEntries)[0];
      }
      node = node.parentElement;
    }
    return null;
  }

  function createToolbar() {
    if (toolbar || !document.body) return;
    toolbar = document.createElement('section');
    toolbar.id = 'sa-text-manager';
    toolbar.dataset.saTextUi = '1';
    const makeButton = (action, label) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.textAction = action; button.textContent = label;
      return button;
    };
    const head = document.createElement('div'); head.className = 'sa-text-head';
    const title = document.createElement('b'); title.textContent = '文本管理';
    const status = document.createElement('span'); status.className = 'sa-text-status';
    head.append(title, status);
    const actions = document.createElement('div'); actions.className = 'sa-text-actions';
    actions.append(makeButton('toggle', '开启编辑'), makeButton('save', '保存'), makeButton('export', '导出 JSON'), makeButton('reset', '清除覆盖'));
    actions.querySelector('[data-text-action="save"]').disabled = true;
    editorBox = document.createElement('div'); editorBox.className = 'sa-text-editor'; editorBox.hidden = true;
    const label = document.createElement('label'); label.textContent = '当前文案';
    editorInput = document.createElement('textarea'); editorInput.rows = 2;
    const keyHint = document.createElement('small');
    label.append(editorInput); editorBox.append(label, keyHint);
    toolbar.append(head, actions, editorBox);
    document.body.append(toolbar);
    statusEl = status;
    toolbar.addEventListener('click', event => {
      const action = event.target.closest('[data-text-action]');
      if (!action) return;
      event.preventDefault();
      const name = action.dataset.textAction;
      if (name === 'toggle') toggle();
      if (name === 'save') save();
      if (name === 'export') exportJson();
      if (name === 'reset') reset();
    });
    editorInput.addEventListener('input', () => {
      if (activeEntry) set(activeEntry.key, editorInput.value);
    });
    updateToolbar();
  }

  function openEditor(entry) {
    activeEntry = entry;
    editorBox.hidden = false;
    editorInput.value = get(entry.key, entry.fallback);
    editorBox.querySelector('small').textContent = `${entry.key}${entry.kind === 'attr' ? `（${entry.attr}）` : ''}`;
    editorInput.focus();
    editorInput.select();
  }

  function onPointerDown(event) {
    if (!editing || isUiElement(event.target)) return;
    const entry = findEntry(event.target, event.altKey || event.shiftKey);
    if (!entry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor(entry);
  }

  function onClick(event) {
    if (!editing || isUiElement(event.target)) return;
    const entry = findEntry(event.target, event.altKey || event.shiftKey);
    if (!entry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor(entry);
  }

  function toggle(force) {
    editing = force == null ? !editing : !!force;
    document.body.classList.toggle('sa-text-editing', editing);
    if (!editing) {
      activeEntry = null;
      if (editorBox) editorBox.hidden = true;
    }
    updateToolbar();
    return editing;
  }

  function enterEdit() { return toggle(true); }
  function exitEdit() { return toggle(false); }

  function updateToolbar(message) {
    if (!toolbar) return;
    const toggleButton = toolbar.querySelector('[data-text-action="toggle"]');
    const saveButton = toolbar.querySelector('[data-text-action="save"]');
    toggleButton.textContent = editing ? '完成编辑' : '开启编辑';
    saveButton.disabled = !dirty;
    statusEl.textContent = message || (dirty ? '有未保存修改' : (loaded ? '已同步' : '正在加载…'));
  }

  function persistLocal() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({ version: 1, game: config.game, locale: config.locale, dirty, values }));
    } catch (e) {
      updateToolbar('浏览器存储不可用');
    }
  }

  async function load() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(storageKey()) || 'null'); } catch (e) { local = null; }
    if (local && local.values && typeof local.values === 'object') Object.assign(values, local.values);
    dirty = !!(local && local.dirty);
    let serverLoaded = false;
    try {
      const query = `?game=${encodeURIComponent(config.game)}&locale=${encodeURIComponent(config.locale)}`;
      const response = await fetch(`${config.loadUrl}${query}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (!dirty && data.values && typeof data.values === 'object') {
          Object.keys(values).forEach(key => delete values[key]);
          Object.assign(values, data.values);
        }
        serverLoaded = true;
      }
    } catch (e) {
      // file:// 或静态托管环境没有 API 时，继续使用 localStorage，不阻塞游戏启动。
    }
    loaded = true;
    if (serverLoaded && !dirty) persistLocal();
    if (readyResolve) readyResolve(api);
    updateToolbar(serverLoaded ? null : (dirty ? '本地草稿，保存后可写入文件' : '本地模式：请使用 localhost 保存文件'));
    scan();
  }

  function save() { saves = saves.then(saveNow, saveNow); return saves; }

  async function saveNow() {
    if (!dirty) return { ok: true, local: true };
    persistLocal();
    const payload = { version: 1, game: config.game, locale: config.locale, values: { ...values } };
    try {
      const response = await fetch(config.saveUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      // 请求期间若继续编辑，保留新草稿的未保存标记，避免旧响应误报全部已同步。
      dirty = Object.keys(values).some(key => values[key] !== payload.values[key]) ||
        Object.keys(payload.values).some(key => !(key in values));
      persistLocal();
      updateToolbar(dirty ? '部分修改仍待保存' : `已写入 ${fileName()}`);
      return { ok: true, file: fileName(), revision: data.revision, pending: dirty };
    } catch (error) {
      updateToolbar('本地已保存；请用 tools/serve.py 后再点保存写入文件');
      return { ok: false, error };
    }
  }

  function exportJson() {
    const payload = JSON.stringify({ version: 1, game: config.game, locale: config.locale, values: { ...values } }, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }));
    link.download = `${config.game}-${config.locale}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    updateToolbar('已导出 JSON；可放入 text/<game>/<locale>.json');
  }

  function reset() {
    Object.keys(values).forEach(key => delete values[key]);
    dirty = true;
    persistLocal();
    applyAll();
    notify('*');
    updateToolbar('已恢复默认文案，点击保存写入文件');
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function boot() {
    createToolbar();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    observer = new MutationObserver(() => {
      if (scanTimer) return;
      scanTimer = requestAnimationFrame(() => { scanTimer = 0; scan(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
  }

  function init(options = {}) {
    Object.assign(config, options);
    if (started) return api;
    started = true;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
    load();
    return api;
  }

  const api = {
    init, ready, get, t: get, set, register, bindText, bindAttr, canvas, draw,
    enterEdit, exitEdit, toggle, save, export: exportJson, reset, onChange,
    isEditing: () => editing,
    file: fileName,
    refresh: () => scan(),
  };

  return api;
})();

// 剧情数据接口：编辑前等待 SA.Text.ready；所有覆盖值沿用同一份文本文件与本地草稿。
SA.StoryData = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const story = () => SA.STORY;

  // 场景 ID 来自现有剧情、战役关卡及通用对战槽，避免读取任意对象属性路径。
  function list() {
    const ids = ['opening', 'tutorial.intro', 'before.current', 'after.current'];
    (story().tutorial?.parts || []).forEach((_, i) => ids.push(`tutorial.parts.${i}`));
    for (const key of Object.keys(story().stage || {})) {
      if (!/^\d+,\d+$/.test(key)) continue;
      for (const outcome of ['win', 'lose']) if (story().stage[key][outcome]) ids.push(`stage.${key}.${outcome}`);
    }
    for (const id of Object.keys(story().feat || {})) ids.push(`feat.${id}`);
    (SA.CAMPAIGN || []).forEach((chapter, ci) => chapter.stages.forEach((_, si) => {
      ids.push(`before.${ci},${si}`, `after.${ci},${si}`);
    }));
    return ids;
  }

  function valid(id) {
    if (typeof id !== 'string' || !list().includes(id)) throw new Error(`无效剧情场景：${id}`);
  }

  // 默认台词按调用时的 SA.STORY 生成；stage/feat 的纯字符串由远房亲戚讲述。
  function defaults(id) {
    if (id === 'opening') return story().opening;
    if (id === 'tutorial.intro') return [].concat(story().tutorial.intro);
    if (id.startsWith('tutorial.parts.')) return story().tutorial.parts[Number(id.slice(15))].lines;
    if (id.startsWith('stage.')) {
      const match = /^stage\.(\d+,\d+)\.(win|lose)$/.exec(id);
      return story().stage[match[1]][match[2]];
    }
    if (id.startsWith('feat.')) return story().feat[id.slice(5)];
    const insert = /^(before|after)\.(.+)$/.exec(id);
    if (insert) return (story()[insert[1]] || {})[insert[2]] || [];
    return [];
  }

  function normalize(id, lines) {
    const speaker = id.startsWith('stage.') || id.startsWith('feat.') ? 'uncle' : null;
    return lines.map(line => typeof line === 'string' ? { text: line, ...(speaker ? { who: speaker } : {}) } : clone(line));
  }

  // get 始终返回新对象；未编辑的场景从当前默认数据读取，不修改 SA.STORY。
  function get(id) {
    valid(id);
    const raw = SA.Text.get(`story:${id}`, '');
    return raw ? clone(JSON.parse(raw)) : normalize(id, defaults(id));
  }

  // set 接受字符串或 {text,who?,scene?}；省略元数据时沿用该位置原有值。
  function set(id, lines) {
    valid(id);
    if (!Array.isArray(lines) || lines.length > 100) throw new Error('剧情必须是至多 100 行的数组');
    const old = get(id);
    const next = lines.map((line, i) => {
      if (typeof line !== 'string' && (!line || typeof line !== 'object' || Array.isArray(line))) throw new Error(`第 ${i + 1} 行格式无效`);
      const item = typeof line === 'string' ? { text: line } : line;
      if (Object.keys(item).some(key => !['text', 'who', 'scene'].includes(key))) throw new Error(`第 ${i + 1} 行包含非法字段`);
      if (typeof item.text !== 'string' || !item.text.trim()) throw new Error(`第 ${i + 1} 行文本不能为空`);
      const row = { text: item.text };
      for (const key of ['who', 'scene']) {
        const value = Object.hasOwn(item, key) ? item[key] : old[i]?.[key];
        if (value !== undefined) {
          if (typeof value !== 'string' || !value.trim()) throw new Error(`第 ${i + 1} 行 ${key} 无效`);
          if (key === 'who' && !Object.hasOwn(story().cast || {}, value)) throw new Error(`未知剧情角色：${value}`);
          if (key === 'scene' && !['sleep', 'roof', 'roll', 'car'].includes(value)) throw new Error(`未知开场分镜：${value}`);
          row[key] = value;
        }
      }
      return row;
    });
    const encoded = JSON.stringify(next);
    if (encoded.length > 10000) throw new Error('剧情场景超过 10000 字符的保存上限');
    SA.Text.set(`story:${id}`, encoded);
    return clone(next);
  }

  // 战役按“章,关”保存；其他对战共用 current 插入点。是否提示与展示由画面层决定。
  function point(phase, key = 'current') {
    if (phase !== 'before' && phase !== 'after') throw new Error('剧情插入点必须是 before 或 after');
    if (typeof key !== 'string' || (key !== 'current' && !/^\d+,\d+$/.test(key))) throw new Error('剧情插入点关卡无效');
    const id = `${phase}.${key}`;
    valid(id);
    return id;
  }

  async function save() { await SA.Text.ready; return SA.Text.save(); }
  return { list, get, set, save, point };
})();
