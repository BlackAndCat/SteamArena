// 院子聊天工作台：各范围草稿暂存在本页，按一次保存才写入共用文本文件。
(() => {
  const $ = id => document.getElementById(id);
  const drafts = new Map();
  const params = new URLSearchParams(location.search);
  let currentScope = '';
  let settingsDraft;
  let settingsDirty = false;
  let saving = false;

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function note(message, kind = '') {
    $('notice').textContent = message;
    $('notice').className = `notice ${kind}`;
  }
  function pending() { return settingsDirty || [...drafts.values()].some(d => d.dirty); }
  function showDirty() {
    const count = [...drafts.values()].filter(d => d.dirty).length;
    $('dirty').textContent = pending() ? `待保存：${count} 个聊天范围${settingsDirty ? '及整体节奏' : ''}` : '全部已保存';
  }
  function parentScope(scope) {
    if (scope.startsWith('stage:')) return `chapter:${scope.split(':')[1]}`;
    return scope.startsWith('chapter:') ? 'global' : null;
  }
  function scopeName(scope) {
    if (scope === 'global') return '全局默认';
    if (scope === 'default') return '内置默认聊天';
    const parts = scope.split(':').map(Number);
    const chapter = SA.CAMPAIGN[parts[1]];
    return scope.startsWith('chapter:') ? chapter.name : `${chapter.name} · 第 ${parts[2] + 1} 关 · ${chapter.stages[parts[2]].name}`;
  }
  function validScope(scope) { return [...$('scope').options].some(option => option.value === scope); }
  // 独立打开工具页时读取当前存档位置；开发者面板传入的 scope 仍优先。
  function savedScope() {
    try {
      const camp = JSON.parse(localStorage.getItem('steam_arena_save_v2'))?.camp;
      const ci = camp?.ch, si = camp?.st;
      if (Number.isInteger(ci) && SA.CAMPAIGN[ci])
        return Number.isInteger(si) && SA.CAMPAIGN[ci].stages[si] ? `stage:${ci}:${si}` : `chapter:${ci}`;
    } catch (_) { /* 尚无存档时显示全局默认。 */ }
    return SA.YardChat.currentScope();
  }
  function ensureDraft(scope) {
    if (!drafts.has(scope)) {
      const data = SA.YardChat.read(scope);
      drafts.set(scope, { groups: copy(data.groups), source: data.source, dirty: false, mode: 'write' });
    }
    return drafts.get(scope);
  }
  function markGroupDirty() {
    const draft = ensureDraft(currentScope);
    draft.dirty = true;
    draft.mode = 'write';
    showDirty();
  }
  function element(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, action, group, line) {
    const node = element('button', { type: 'button', class: 'btn', 'data-action': action, 'data-group': group });
    if (line !== undefined) node.dataset.line = line;
    node.textContent = label;
    return node;
  }
  function field(label, node) {
    const wrap = element('label', { class: 'field' });
    wrap.append(label, node);
    return wrap;
  }
  function input(value, name, group, line, type = 'text') {
    const node = element('input', { type, 'data-field': name, 'data-group': group });
    if (line !== undefined) node.dataset.line = line;
    if (type === 'number') { node.min = '0'; node.step = '0.1'; }
    node.value = value ?? '';
    return node;
  }
  function select(value, name, choices, group, line) {
    const node = element('select', { 'data-field': name, 'data-group': group });
    if (line !== undefined) node.dataset.line = line;
    for (const [key, label] of choices) node.add(new Option(label, key));
    node.value = value;
    return node;
  }
  function render() {
    const draft = ensureDraft(currentScope);
    $('scope').value = currentScope;
    const inherited = draft.mode === 'inherit' || draft.source !== currentScope;
    $('source').textContent = inherited ? `继承自：${scopeName(draft.source || 'global')}${draft.mode === 'inherit' ? '（待保存）' : ''}` : '本范围专用内容';
    $('inherit').disabled = currentScope === 'global';
    const target = $('groups');
    target.replaceChildren();
    draft.groups.forEach((group, index) => {
      const card = element('article', { class: 'group' });
      const head = element('div', { class: 'group-head' });
      head.append(element('h3', {}, `第 ${index + 1} 组 · ${group.lines.length > 1 ? '成套对答' : '单句'}`));
      const actions = element('div', { class: 'group-actions' });
      actions.append(button('上移', 'group-up', index), button('下移', 'group-down', index), button('删除组', 'group-delete', index));
      head.append(actions);
      const fields = element('div', { class: 'group-fields' });
      fields.append(
        field('名称', input(group.name, 'name', index)),
        field('出现权重', input(group.weight, 'weight', index, undefined, 'number')),
        field('独立冷却（秒）', input(group.cooldownSec, 'cooldownSec', index, undefined, 'number')),
        field('出现条件', select(group.weather, 'weather', [['any', '不限'], ['rain', '下雨'], ['night', '夜晚']], index))
      );
      const lines = element('div', { class: 'lines' });
      group.lines.forEach((line, lineIndex) => {
        const row = element('div', { class: 'line' });
        const who = select(line.who, 'who', [['rel', '瑞尔'], ['tom', '老汤姆'], ['tim', '小提米']], index, lineIndex);
        const text = element('textarea', { 'data-field': 'text', 'data-group': index, 'data-line': lineIndex, 'aria-label': `第 ${index + 1} 组第 ${lineIndex + 1} 句` });
        text.value = line.text;
        const tag = element('span', { class: 'muted' }, `第 ${lineIndex + 1} 句`);
        const tools = element('div', { class: 'line-actions' });
        tools.append(button('上移', 'line-up', index, lineIndex), button('下移', 'line-down', index, lineIndex), button('删除', 'line-delete', index, lineIndex));
        row.append(who, text, tag, tools);
        lines.append(row);
      });
      card.append(head, fields, lines, button('追加一句对答', 'line-add', index));
      target.append(card);
    });
    if (!draft.groups.length) target.append(element('p', { class: 'muted' }, '这个范围还没有聊天。可新增聊天，也可恢复继承上一级。'));
    showDirty();
  }
  function move(items, from, to) {
    if (to < 0 || to >= items.length) return false;
    [items[from], items[to]] = [items[to], items[from]];
    return true;
  }
  function editStructure(action, gi, li) {
    const groups = ensureDraft(currentScope).groups;
    const group = groups[gi];
    let changed = true;
    if (action === 'group-up') changed = move(groups, gi, gi - 1);
    else if (action === 'group-down') changed = move(groups, gi, gi + 1);
    else if (action === 'group-delete') groups.splice(gi, 1);
    else if (action === 'line-add') group.lines.push({ who: group.lines.at(-1)?.who === 'tom' ? 'tim' : 'tom', text: '', action: 'talk' });
    else if (action === 'line-up') changed = move(group.lines, li, li - 1);
    else if (action === 'line-down') changed = move(group.lines, li, li + 1);
    else if (action === 'line-delete') {
      if (group.lines.length === 1) { note('每组至少保留一句；如需移除，请删除整组。', 'bad'); return; }
      group.lines.splice(li, 1);
    }
    if (changed) { markGroupDirty(); render(); }
  }
  async function save() {
    if (saving) return;
    saving = true;
    $('save').disabled = true;
    note('正在保存聊天与整体节奏……');
    try {
      const changed = [...drafts.entries()].filter(([, draft]) => draft.dirty);
      // 先校验全部草稿，避免某个范围无效时其它范围已进入文本管理器的自动保存队列。
      for (const [, draft] of changed) if (draft.mode !== 'inherit') SA.YardChat.validateGroups(draft.groups);
      if (settingsDirty) SA.YardChat.validateSettings(settingsDraft);
      for (const [scope, draft] of changed) {
        if (draft.mode === 'inherit') SA.YardChat.inherit(scope);
        else SA.YardChat.write(scope, draft.groups);
      }
      if (settingsDirty) SA.YardChat.setSettings(settingsDraft);
      const result = await SA.YardChat.save();
      if (!result?.ok) throw result?.error || new Error('写入未成功，草稿仍保留在浏览器');
      for (const [scope, draft] of changed) {
        const saved = SA.YardChat.read(scope);
        draft.source = saved.source;
        draft.groups = copy(saved.groups);
        draft.mode = 'write';
        draft.dirty = false;
      }
      settingsDirty = false;
      render();
      note('已保存。游戏中的院子聊天会自动更新。', 'ok');
    } catch (error) {
      note(`保存失败；草稿仍在本页，可以修改后重试：${error.message || error}`, 'bad');
    } finally {
      saving = false;
      $('save').disabled = false;
      showDirty();
    }
  }
  async function boot() {
    SA.Text.init({ game: 'steam-arena', locale: 'zh-CN', toolbar: false });
    await SA.Text.ready;
    const scopes = $('scope');
    scopes.add(new Option('全局默认', 'global'));
    SA.CAMPAIGN.forEach((chapter, ci) => {
      scopes.add(new Option(chapter.name, `chapter:${ci}`));
      chapter.stages.forEach((stage, si) => scopes.add(new Option(`　${chapter.name} · 第 ${si + 1} 关 · ${stage.name}`, `stage:${ci}:${si}`)));
    });
    const requested = params.get('scope');
    currentScope = requested && validScope(requested) ? requested : savedScope();
    if (!validScope(currentScope)) currentScope = 'global';
    settingsDraft = copy(SA.YardChat.settings());
    $('interval').value = settingsDraft.intervalSec;
    $('reply').value = settingsDraft.replySec;
    $('bubble').value = settingsDraft.bubbleSec;
    render();
    note('修改后可按 Ctrl+S 或点击一键保存。', 'ok');
    scopes.addEventListener('change', () => { currentScope = scopes.value; render(); });
    for (const [id, key] of [['interval', 'intervalSec'], ['reply', 'replySec'], ['bubble', 'bubbleSec']]) {
      $(id).addEventListener('input', event => { settingsDraft[key] = event.target.value === '' ? NaN : Number(event.target.value); settingsDirty = true; showDirty(); });
    }
    $('groups').addEventListener('input', event => {
      const node = event.target;
      const group = ensureDraft(currentScope).groups[Number(node.dataset.group)];
      if (!group) return;
      const field = node.dataset.field;
      const owner = node.dataset.line === undefined ? group : group.lines[Number(node.dataset.line)];
      if (!owner || !field) return;
      owner[field] = node.type === 'number' ? (node.value === '' ? NaN : Number(node.value)) : node.value;
      markGroupDirty();
    });
    $('groups').addEventListener('change', event => {
      if (event.target.tagName === 'SELECT') event.target.dispatchEvent(new Event('input', { bubbles: true }));
    });
    $('groups').addEventListener('click', event => {
      const node = event.target.closest('[data-action]');
      if (node) editStructure(node.dataset.action, Number(node.dataset.group), Number(node.dataset.line));
    });
    $('add-group').addEventListener('click', () => {
      ensureDraft(currentScope).groups.push({ id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: '新聊天', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'tom', text: '', action: 'talk' }] });
      markGroupDirty();
      render();
    });
    $('inherit').addEventListener('click', () => {
      const parent = parentScope(currentScope);
      if (!parent) return;
      const inherited = SA.YardChat.read(parent);
      drafts.set(currentScope, { groups: copy(inherited.groups), source: inherited.source, dirty: true, mode: 'inherit' });
      render();
      note('已在本页恢复继承预览；保存后生效。');
    });
    $('save').addEventListener('click', save);
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', event => { if (pending()) { event.preventDefault(); event.returnValue = ''; } });
  }
  boot().catch(error => note(`无法读取院子聊天：${error.message || error}`, 'bad'));
})();
