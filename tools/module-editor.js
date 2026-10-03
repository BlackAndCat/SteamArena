(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const schema = SA.MODULE_EDITOR_SCHEMA?.fields || {};
  const ids = (SA.MODULE_ORDER || Object.keys(SA.MODULES)).filter(id => SA.MODULES[id]);
  let selected = '', controls = new Map(), touched = new Set(), saving = false, ready = false;
  const at = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const copy = value => JSON.parse(JSON.stringify(value));
  function put(obj, path, value) {
    const keys = path.split('.');
    let target = obj;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    const field = keys.at(-1);
    if (Object.getOwnPropertyDescriptor(target, field)?.get)
      Object.defineProperty(target, field, { value, writable: true, configurable: true, enumerable: true });
    else target[field] = value;
  }
  function notice(message, kind = '') {
    $('notice').textContent = message;
    $('notice').className = 'notice ' + kind;
  }

  function categoryName(cat) { return SA.CAT?.[cat]?.name || cat || '其他'; }
  function filterList() {
    const q = $('search').value.trim().toLocaleLowerCase(), cat = $('category').value;
    $('module-list').replaceChildren();
    for (const id of ids) {
      const mod = SA.MODULES[id];
      if ((cat && mod.cat !== cat) || (q && !(id + ' ' + mod.name).toLocaleLowerCase().includes(q))) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'module-item' + (id === selected ? ' selected' : '');
      button.append(SA.SPR.moduleCanvas(id, 1, 1));
      const name = document.createElement('span');
      const strong = document.createElement('b'); strong.textContent = mod.name;
      const small = document.createElement('small'); small.textContent = `${categoryName(mod.cat)} · ${id}`;
      name.append(strong, small); button.append(name);
      button.onclick = () => select(id);
      $('module-list').append(button);
    }
    if (!$('module-list').children.length) $('module-list').textContent = '没有匹配模块。';
  }
  function inputFor(info, value) {
    const input = document.createElement(info.type === 'enum' || info.options || info.enum ? 'select' : info.type === 'string' && (info.multiline || info.label === '说明') ? 'textarea' : 'input');
    if (input.tagName === 'SELECT') {
      for (const option of info.options || info.enum || []) {
        const item = document.createElement('option');
        item.value = typeof option === 'object' ? option.value : option;
        item.textContent = typeof option === 'object' ? option.label : option;
        input.append(item);
      }
      input.value = value;
    } else if (info.type === 'boolean') {
      input.type = 'checkbox'; input.checked = !!value;
    } else {
      if (info.type === 'number' || info.type === 'integer') {
        input.type = 'number'; input.step = info.integer || info.type === 'integer' ? '1' : info.step || 'any';
        if (info.min !== undefined) input.min = info.min;
        if (info.max !== undefined) input.max = info.max;
      }
      if (info.maxLength) input.maxLength = info.maxLength;
      input.value = value ?? '';
    }
    return input;
  }
  function fieldControl(path, info, value) {
    const wrap = document.createElement('label'); wrap.className = 'field' + (path === 'desc' || info.type === 'array' ? ' wide' : '');
    const title = document.createElement('span');
    const name = document.createElement('b'); name.textContent = info.label || path;
    const code = document.createElement('code'); code.textContent = path;
    title.append(name, code); wrap.append(title);
    if (info.type === 'array') {
      const list = document.createElement('div'); list.className = 'array-items'; wrap.append(list);
      const values = copy(value);
      const itemInfo = { type: info.itemType || 'number', min: info.itemMin, max: info.itemMax, enum: info.itemEnum, maxLength: info.itemMaxLength };
      const redraw = () => {
        list.replaceChildren();
        values.forEach((item, i) => {
          const row = document.createElement('div'); row.className = 'array-row';
          const editor = inputFor(itemInfo, item); editor.setAttribute('aria-label', `${info.label} 第 ${i + 1} 项`);
          editor.addEventListener('input', () => { values[i] = readInput(editor, itemInfo); touched.add(path); updateDirty(); });
          editor.addEventListener('change', () => { values[i] = readInput(editor, itemInfo); touched.add(path); updateDirty(); });
          row.append(editor);
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn'; remove.textContent = '删除';
          remove.onclick = () => { values.splice(i, 1); redraw(); touched.add(path); updateDirty(); };
          row.append(remove); list.append(row);
        });
      };
      redraw();
      const add = document.createElement('button'); add.type = 'button'; add.className = 'btn'; add.textContent = '增加一项';
      add.onclick = () => { values.push(itemInfo.type === 'string' ? '' : 0); redraw(); touched.add(path); updateDirty(); };
      wrap.append(add);
      controls.set(path, () => values);
    } else {
      const input = inputFor(info, value); wrap.append(input);
      input.addEventListener('input', () => { touched.add(path); updateDirty(); });
      input.addEventListener('change', () => { touched.add(path); updateDirty(); });
      controls.set(path, () => readInput(input, info));
    }
    return wrap;
  }
  function readInput(input, info) {
    if (info.type === 'boolean') return input.checked;
    if (info.type === 'number' || info.type === 'integer') return input.value === '' ? NaN : Number(input.value);
    return input.value;
  }
  function select(id) {
    if (id === selected) return;
    if (selected && changed() && !confirm('当前模块有未保存的修改。确定放弃并切换模块吗？')) return;
    selected = id; controls = new Map(); touched = new Set();
    sessionStorage.setItem('module-editor-selected', id);
    const mod = SA.MODULES[id], hero = $('hero'); hero.replaceChildren(SA.SPR.moduleCanvas(id, 1, 1));
    const info = document.createElement('div'), heading = document.createElement('h2'), meta = document.createElement('small');
    heading.textContent = mod.name; meta.textContent = `${categoryName(mod.cat)} · ID: ${id}（只读）`;
    info.append(heading, meta); hero.append(info);
    const groups = new Map();
    for (const [path, field] of Object.entries(schema)) {
      const value = at(mod, path);
      if (value === undefined) continue;
      const group = field.group || '其他玩法属性';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(fieldControl(path, field, value));
    }
    $('fields').replaceChildren();
    for (const [name, fields] of groups) {
      const section = document.createElement('section'); section.className = 'group';
      const heading = document.createElement('h3'); heading.textContent = name;
      const grid = document.createElement('div'); grid.className = 'fields'; grid.append(...fields);
      section.append(heading, grid); $('fields').append(section);
    }
    filterList(); updateDirty();
  }
  function changes() {
    const result = {};
    for (const path of touched) {
      const read = controls.get(path);
      if (read && !same(read(), at(SA.MODULES[selected], path))) put(result, path, read());
    }
    return result;
  }
  function changed() {
    return !!selected && [...touched].some(path => controls.has(path) && !same(controls.get(path)(), at(SA.MODULES[selected], path)));
  }
  function updateDirty() {
    $('dirty').textContent = changed() ? '有未保存的修改' : '与已加载版本一致';
    $('save').disabled = saving || !ready || !changed();
  }
  async function save() {
    if (saving || !ready || !selected || !changed()) return;
    const id = selected, edits = changes(), valid = SA.validateModuleOverrides(id, edits);
    if (!valid.ok) { notice((valid.errors || []).join('\n') || '属性校验未通过。', 'bad'); return; }
    saving = true; updateDirty();
    try {
      const response = await fetch('/__modules/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, changes: edits }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || `保存失败（HTTP ${response.status}）`);
      // 服务端成功后再更新内存和浏览器展示；失败时控件内容可直接重试。
      for (const path of touched) {
        const read = controls.get(path);
        if (read) put(SA.MODULES[id], path, read());
      }
      if (Object.hasOwn(edits, 'desc')) delete SA.MODULES[id].descTemplate;
      SA.Config.clear('modules');
      touched.clear();
      notice(`${SA.MODULES[id].name} 已保存到 config/modules.json。重新打开的游戏页面会使用新属性。`, 'ok');
      $('hero').querySelector('h2').textContent = SA.MODULES[id].name;
      filterList();
    } catch (error) {
      notice(error.message || String(error), 'bad');
    } finally { saving = false; updateDirty(); }
  }
  async function init() {
    if (!Object.keys(schema).length || !SA.validateModuleOverrides) {
      notice('模块字段规则尚未加载，无法编辑。', 'bad'); $('save').disabled = true; return;
    }
    $('category').append(new Option('全部类别', ''));
    for (const cat of new Set(ids.map(id => SA.MODULES[id].cat))) $('category').append(new Option(categoryName(cat), cat));
    $('search').oninput = filterList; $('category').onchange = filterList; $('save').onclick = save;
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault(); event.stopImmediatePropagation(); save();
      }
    }, true);
    window.addEventListener('beforeunload', event => { if (changed() && !saving) { event.preventDefault(); event.returnValue = ''; } });
    // 地图可用 URL 精确定位模块；普通打开仍沿用上次在工作台选中的模块。
    const requested = new URLSearchParams(location.search).get('module');
    select(ids.includes(requested) ? requested : sessionStorage.getItem('module-editor-selected') || ids[0]);
    try {
      const response = await fetch('/__modules/status', { cache: 'no-store' });
      if (!response.ok || !(await response.json()).ok) throw new Error('本机模块保存服务不可用。');
      ready = true; updateDirty();
      notice('本地写入服务已连接；一键保存会直接更新 config/modules.json。', 'ok');
    } catch (error) { notice(error.message || String(error), 'bad'); }
  }
  init();
})();
