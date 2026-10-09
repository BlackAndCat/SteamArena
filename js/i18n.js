// 配置式多语言入口：在文本管理器及业务脚本之前加载，不改变玩法数据与存档格式。
// 中文继续读取原配置；其他语言仅覆盖显示字符串，新增语言只需登记配置和语言包。
(function () {
  const SA = window.SA;
  const read = SA.Config.get.bind(SA.Config);
  const manifest = read('i18n');
  const languages = manifest.locales;
  const find = id => languages.find(language => language.id === id);
  let remembered;
  try { remembered = localStorage.getItem(manifest.storageKey); }
  catch { /* 浏览器禁止存储时仍可用网址中的 lang 保留当前语言。 */ }
  const url = new URL(location.href);
  const language = find(url.searchParams.get('lang')) || find(remembered) || find(manifest.defaultLocale);
  const pack = language.file ? read(language.file) : null;
  const localized = new Map();

  // 旧页面少量未提取的文字由文本管理器扫描接入；只匹配整句及显式模板。
  // 不对玩家自定义名称做词语替换，模板中的动态部分（如章节名）完整保留。
  function translate(value) {
    if (!pack || typeof value !== 'string') return value;
    if (Object.hasOwn(pack.literals || {}, value)) return pack.literals[value];
    for (const template of pack.templates || []) {
      const indices = [];
      const source = template.source.split(/(\{\{\d+\}\})/).map(part => {
        if (/^\{\{\d+\}\}$/.test(part)) { indices.push(part.slice(2, -2)); return '(.*?)'; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      const match = new RegExp('^' + source + '$', 's').exec(value);
      if (match) return template.value.replace(/\{\{(\d+)\}\}/g, (_, index) => match[indices.indexOf(index) + 1]);
    }
    return value;
  }

  // JSON Pointer 只允许覆盖已存在的字符串；不新增字段、不写数字或机制枚举。
  // 键中的斜线和波浪号分别以 ~1 / ~0 转义，数组下标沿用配置中的顺序。
  function overlay(data, translations) {
    for (const [pointer, value] of Object.entries(translations || {})) {
      if (typeof value !== 'string' || !pointer.startsWith('/')) continue;
      const keys = pointer.slice(1).split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
      if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) continue;
      let target = data;
      for (const key of keys.slice(0, -1)) target = target?.[key];
      const last = keys[keys.length - 1];
      if (target && Object.hasOwn(target, last) && typeof target[last] === 'string') target[last] = value;
    }
    return data;
  }

  // 所有既有 Config.text/get 调用共用此入口。复制语言视图，避免污染中文源对象。
  // 同一份源配置返回同一份语言视图，保持模块表与文本编辑器原有的引用关系。
  SA.Config.get = function (name) {
    const base = read(name);
    if (!pack || !['ui', 'text'].includes(name) && !pack.configs?.[name]) return base;
    const cached = localized.get(name);
    if (cached?.base === base) return cached.data;
    let data = JSON.parse(JSON.stringify(base));
    if (name === 'ui') data.messages = { ...data.messages, ...pack.messages };
    else if (name === 'text') {
      data = { ...data, ...pack.text, values: { ...data.values, ...pack.text?.values }, locale: language.id };
    } else overlay(data, pack.configs[name]);
    localized.set(name, { base, data });
    return data;
  };

  // 旧存档及后台规划器仍保留原始车辆名；仅翻译模板中的显示参数，不改存档或对象身份。
  const format = SA.Config.text.bind(SA.Config);
  SA.Config.text = (key, ...args) => format(key, ...args.map(value => translate(value)));

  // 旧画面以中文角色名查头像；角色脚本加载后补齐别名，保留原头像与画面行为。
  // 显示名仍来自当前语言，中文别名只作为内部查表入口，不更改角色设计。
  const bindCastAliases = () => {
    if (!SA.Coal?.byName) return;
    const source = read('ui').messages, display = SA.Config.get('ui').messages;
    for (const [key, name] of Object.entries(source)) {
      if (SA.Coal.byName[display[key]]) SA.Coal.byName[name] = SA.Coal.byName[display[key]];
    }
    document.removeEventListener('load', bindCastAliases, true);
  };
  document.addEventListener('load', bindCastAliases, true);

  // 一次写入整份当前语言包；英文编辑不会回写中文 ui.json / text.json。
  // 保存完成才更新内存快照，网络失败时保留原快照供文本编辑器重试。
  async function saveDocuments(text, ui) {
    const next = { ...pack };
    if (text) next.text = text;
    if (ui) next.messages = ui.messages;
    const response = await fetch('/__config/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: language.file, data: next }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    Object.assign(pack, next);
    return result;
  }

  // 重新加载统一更新启动时已缓存的名称、剧情与画布文字。
  // 语言偏好用独立键保存；不保存、重置或迁移游戏进度，战斗中拒绝刷新。
  function setLocale(id) {
    const next = find(id);
    if (!next || next.id === language.id || SA.current === 'battle') return false;
    if (SA.Text?.hasPending?.() && !window.confirm(language.pendingWarning)) return false;
    try { localStorage.setItem(manifest.storageKey, next.id); }
    catch { /* 无本地存储时由网址参数保留选择。 */ }
    const destination = new URL(location.href);
    destination.searchParams.set('lang', next.id);
    location.assign(destination.href);
    return true;
  }

  // 旗帜入口显示当前语言；展开后由玩家明确选择，不再把下一种语言显示成当前状态。
  // 旗帜 SVG 从配置生成图片，避免 Windows 将国旗表情显示成字母，也无需外部资源。
  function mount() {
    const picker = document.createElement('div');
    picker.id = 'sa-language-picker';
    picker.setAttribute('data-sa-text-mirror', '1');
    picker.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));z-index:10000';
    const flag = option => {
      const image = document.createElement('img');
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(option.flag);
      image.alt = '';
      image.width = 30; image.height = 20;
      image.style.cssText = 'object-fit:contain;vertical-align:middle';
      return image;
    };
    const button = document.createElement('button');
    button.id = 'sa-language-switch';
    button.type = 'button';
    button.className = 'btn small';
    button.title = `${language.label} · ${language.switchTitle}`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'sa-language-menu');
    button.append(flag(language), document.createTextNode(' ▾'));
    const menu = document.createElement('div');
    menu.id = 'sa-language-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', language.switchTitle);
    menu.style.cssText = 'position:absolute;left:0;top:calc(100% + 4px);min-width:160px;padding:6px;background:#202631;border:1px solid #bfa163';
    const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
    const options = languages.map(option => {
      const item = document.createElement('button');
      const selected = option.id === language.id;
      item.type = 'button';
      item.className = 'btn small';
      item.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;margin:2px 0;text-align:left';
      item.setAttribute('aria-pressed', String(selected));
      item.append(flag(option), document.createTextNode(option.label + (selected ? ' ✓' : '')));
      item.addEventListener('click', () => {
        if (selected || setLocale(option.id)) { close(); button.focus(); }
      });
      menu.append(item);
      return item;
    });
    button.addEventListener('click', () => {
      if (button.disabled) return;
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) options[languages.indexOf(language)].focus();
    });
    // 点击外部或按 Esc 收起；键盘在选择器内操作时不触发标题页的开始游戏快捷键。
    document.addEventListener('pointerdown', event => { if (!picker.contains(event.target)) close(); });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) { event.stopImmediatePropagation(); close(); button.focus(); return; }
      if (picker.contains(event.target) && ['Enter', ' '].includes(event.key)) event.stopImmediatePropagation();
    }, true);
    const update = () => { button.disabled = SA.current === 'battle'; if (button.disabled) close(); };
    update();
    new MutationObserver(update).observe(document.getElementById('screen') || document.body, { childList: true, subtree: true });
    picker.append(button, menu);
    document.body.append(picker);
  }

  SA.I18n = {
    locale: language.id,
    file: () => language.file ? `config/${language.file}.json` : 'config/text.json',
    translated: () => !!pack,
    translate,
    sourceText: key => read('ui').messages[key], // 旧数据协议仍使用源语言标签，显示文案独立翻译。
    setLocale,
    toggle: () => setLocale(languages[(languages.indexOf(language) + 1) % languages.length].id),
    saveDocuments,
  };
  document.documentElement.lang = language.id;
  document.title = SA.Config.text('page_title');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
