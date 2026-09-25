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

  async function save() {
    if (!dirty) return { ok: true, local: true };
    persistLocal();
    const payload = { version: 1, game: config.game, locale: config.locale, values: { ...values } };
    try {
      const response = await fetch(config.saveUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      dirty = false;
      persistLocal();
      updateToolbar(`已写入 ${fileName()}`);
      return { ok: true, file: fileName(), revision: data.revision };
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
