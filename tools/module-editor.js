(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const schema = SA.MODULE_EDITOR_SCHEMA?.fields || {};
  const ids = (SA.MODULE_ORDER || Object.keys(SA.MODULES)).filter(id => SA.MODULES[id]);
  const markerStart = '// MODULE_EDITOR_OVERRIDES_START';
  const markerEnd = '// MODULE_EDITOR_OVERRIDES_END';
  const dbName = 'steam-arena-module-editor';
  let selected = '', controls = new Map(), touched = new Set(), service = false, handle = null, saving = false, ready = false;

  const at = (obj, path) => path.split('.').reduce((v, key) => v?.[key], obj);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const copy = value => JSON.parse(JSON.stringify(value));
  function put(obj, path, value) {
    const keys = path.split('.');
    let part = obj;
    for (const key of keys.slice(0, -1)) part = part[key] ||= {};
    part[keys.at(-1)] = value;
  }
  function drop(obj, path) {
    const keys = path.split('.'), parents = [obj];
    for (const key of keys.slice(0, -1)) {
      if (!parents.at(-1)?.[key]) return;
      parents.push(parents.at(-1)[key]);
    }
    delete parents.at(-1)[keys.at(-1)];
    for (let i = keys.length - 2; i >= 0; i--) {
      if (Object.keys(parents[i + 1]).length) break;
      delete parents[i][keys[i]];
    }
  }
  function notice(message, kind = '') {
    $('notice').textContent = message;
    $('notice').className = 'notice ' + kind;
  }

  // 文件句柄只留在浏览器本机；写入前仍逐次读取并核对源文件的限定区。
  function dbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function storedHandle(next) {
    const db = await dbOpen();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', next ? 'readwrite' : 'readonly');
        const req = next ? tx.objectStore('files').put(next, 'modules') : tx.objectStore('files').get('modules');
        req.onsuccess = () => resolve(next || req.result || null);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
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
  function overrides() {
    const result = copy(SA.MODULE_OVERRIDES[selected] || {}), original = SA.MODULE_DEFAULTS[selected];
    for (const path of touched) {
      const read = controls.get(path);
      if (!read) continue;
      const value = read();
      if (same(value, at(SA.MODULES[selected], path))) continue;
      if (same(value, at(original, path))) drop(result, path);
      else put(result, path, value);
    }
    return result;
  }
  function changed() {
    if (!selected) return false;
    return [...touched].some(path => controls.has(path) && !same(controls.get(path)(), at(SA.MODULES[selected], path)));
  }
  function updateDirty() {
    const dirty = changed();
    $('dirty').textContent = dirty ? '有未保存的修改' : '与已加载版本一致';
    $('save').disabled = saving || !ready || !selected || !dirty;
  }
  function sourceRegion(source) {
    const start = source.indexOf(markerStart), end = source.indexOf(markerEnd);
    if (start < 0 || end < start || source.indexOf(markerStart, start + 1) >= 0 || source.indexOf(markerEnd, end + 1) >= 0 || !source.includes('SA.MODULES = {') || !source.includes('SA.MODULE_DEFAULTS =')) throw new Error('选中的文件不是带有模块覆盖区的本项目 js/modules.js。');
    const body = source.slice(start + markerStart.length, end).trim();
    const match = /^SA\.MODULE_OVERRIDES\s*=\s*(\{[\s\S]*\});?$/.exec(body);
    if (!match) throw new Error('模块覆盖区格式不符，已停止写入。');
    let table;
    try { table = JSON.parse(match[1]); } catch { throw new Error('模块覆盖区不是有效 JSON，已停止写入。'); }
    if (!table || Array.isArray(table) || typeof table !== 'object') throw new Error('模块覆盖区内容无效。');
    return { start, end, table };
  }
  async function fileSave(fileHandle, id, values) {
    const file = await fileHandle.getFile();
    if (file.name !== 'modules.js') throw new Error('请选择本项目的 js/modules.js。');
    const source = await file.text(), region = sourceRegion(source);
    if (Object.keys(values).length) region.table[id] = values;
    else delete region.table[id];
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const replacement = `${markerStart}${newline}SA.MODULE_OVERRIDES = ${JSON.stringify(region.table, null, 2).replace(/\n/g, newline)};${newline}`;
    const updated = source.slice(0, region.start) + replacement + source.slice(region.end);
    const stream = await fileHandle.createWritable();
    await stream.write(updated); await stream.close();
  }
  async function save() {
    if (saving || !selected || !changed()) return;
    const id = selected, values = overrides(), valid = SA.validateModuleOverrides(id, values);
    if (!valid.ok) { notice((valid.errors || []).join('\n') || '属性校验未通过。', 'bad'); return; }
    // 首次选文件必须直接发生在按钮事件中，以保留浏览器的用户激活权限。
    const pick = !service && !handle && window.showOpenFilePicker
      ? window.showOpenFilePicker({ multiple: false, types: [{ description: '模块数据', accept: { 'text/javascript': ['.js'] } }] }) : null;
    saving = true; updateDirty();
    try {
      if (service) {
        const res = await fetch('/__modules/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, overrides: values }) });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || data.message || `保存失败（HTTP ${res.status}）。`);
      } else {
        if (pick) { const files = await pick; handle = files[0]; }
        if (!handle) throw new Error('当前浏览器不支持直接写文件。请用 Chrome 或 Edge 打开工作台，或通过 tools/serve.py 启动本地服务。');
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted' && await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('未获得文件写入权限，修改尚未保存。');
        await fileSave(handle, id, values);
        try { await storedHandle(handle); } catch { /* 私密模式可保存当前文件，但不能记住句柄。 */ }
      }
      sessionStorage.setItem('module-editor-success', `${SA.MODULES[id].name} 已保存到 js/modules.js。重新打开的游戏页面会使用新属性。`);
      location.reload();
    } catch (error) {
      notice(error.name === 'AbortError' ? '已取消选择文件，修改仍留在页面。' : error.message || String(error), 'bad');
      saving = false; updateDirty();
    }
  }
  async function init() {
    if (!Object.keys(schema).length || !SA.MODULE_DEFAULTS || !SA.validateModuleOverrides) {
      notice('模块字段规则尚未加载，无法编辑。', 'bad'); $('save').disabled = true; return;
    }
    $('category').append(new Option('全部类别', ''));
    for (const cat of new Set(ids.map(id => SA.MODULES[id].cat))) $('category').append(new Option(categoryName(cat), cat));
    $('search').oninput = filterList; $('category').onchange = filterList; $('save').onclick = save;
    window.addEventListener('beforeunload', event => { if (changed() && !saving) { event.preventDefault(); event.returnValue = ''; } });
    select(sessionStorage.getItem('module-editor-selected') || ids[0]);
    const success = sessionStorage.getItem('module-editor-success'); sessionStorage.removeItem('module-editor-success');
    try { handle = await storedHandle(); } catch { /* 不支持 IndexedDB 时仍可首次选择文件。 */ }
    try {
      const response = await fetch('/__modules/status', { cache: 'no-store' });
      service = response.ok && !!(await response.json()).ok;
    } catch { service = false; }
    ready = true; updateDirty();
    if (success) notice(success, 'ok');
    else if (service) notice('本地写入服务已连接。修改后点“一键保存”即可更新 js/modules.js。', 'ok');
    else if (window.showOpenFilePicker) notice(handle ? '已记住模块文件。修改后点“一键保存”即可写入。' : '首次保存时请选择本项目的 js/modules.js；浏览器授权后即可一键保存。', 'warn');
    else notice('浏览器不支持直接写文件。请使用 Chrome 或 Edge，或通过 tools/serve.py 启动本地服务。', 'warn');
  }
  init();
})();
