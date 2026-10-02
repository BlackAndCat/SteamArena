// 预检只列当前来源或显式导入文档与正式文件的差异；所有差异默认不勾选。
(() => {
  const $ = id => document.getElementById(id);
  const entries = new Map();
  const sources = [];
  let formal = null;
  const now = () => new Date().toISOString();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const status = message => { $('status').textContent = message; };

  function source(kind, url, exportedAt) {
    const item = { kind, url, exportedAt };
    if (!sources.some(row => same(row, item))) sources.push(item);
    $('sources').textContent = sources.map(row => `${row.kind} · ${row.url} · ${row.exportedAt}`).join('\n');
  }

  function addEntry(type, key, next, previous) {
    const id = `${type}:${key}`;
    if (same(next, previous)) { entries.delete(id); return; }
    entries.set(id, { type, key, next, previous });
  }

  function importBundle(data, current = false) {
    if (data?.version !== 1 || data.kind !== 'steam-arena-author-bundle' ||
        !data.source || data.stageCars?.campaignLayout !== 2 || !data.stageCars?.records ||
        !data.text?.values || !Array.isArray(data.text.removedElements))
      throw new Error('作者包格式不合法');
    source(current ? 'current-origin' : 'author-bundle', data.source.url, data.source.exportedAt);
    if (data.stageCars.present !== false)
      for (const [key, record] of Object.entries(data.stageCars.records))
        addEntry('stage', key, record, formal.stageCars.records[key]);
    if (data.text.present !== false) importText(data.text, false);
    render();
  }

  function importText(data, standalone = true) {
    if (data?.version !== 1 || data.game !== 'steam-arena' || data.locale !== 'zh-CN' ||
        !data.values || typeof data.values !== 'object' || Array.isArray(data.values) ||
        data.removedElements != null && !Array.isArray(data.removedElements))
      throw new Error('页面文字 JSON 格式不合法');
    if (standalone) source('text-export', data.__fileName || '导入的页面文字 JSON', now());
    for (const [key, value] of Object.entries(data.values))
      addEntry('text', key, value, formal.text.values?.[key]);
    // 旧版文字 JSON 没有隐藏清单时只带入文字；显式空数组才表示要恢复所有隐藏元素。
    if (Array.isArray(data.removedElements)) {
      const original = new Set(formal.text.removedElements || []);
      const desired = new Set(data.removedElements);
      for (const path of new Set([...original, ...desired]))
        addEntry('removed', path, desired.has(path), original.has(path));
    }
    render();
  }

  function render() {
    const root = $('diffs');
    root.replaceChildren();
    if (!entries.size) { root.textContent = '当前没有待选择差异。'; return; }
    for (const [id, item] of entries) {
      const row = document.createElement('label'); row.className = 'row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.id = id;
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${{ stage: '关卡', text: '文本', removed: '隐藏元素' }[item.type]} · ${item.key}`;
      const before = document.createElement('small');
      before.textContent = `正式：${JSON.stringify(item.previous) ?? '（无）'}`;
      const after = document.createElement('pre'); after.textContent = `待归档：${JSON.stringify(item.next, null, 2)}`;
      content.append(title, document.createElement('br'), before, after);
      row.append(checkbox, content); root.append(row);
    }
  }

  async function loadFormal() {
    const response = await fetch('/__publish/state', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '正式文件读取失败');
    formal = data;
  }

  $('export').onclick = () => {
    try { const bundle = SAAuthorContent.download(); source('current-origin', bundle.source.url, bundle.source.exportedAt); status('已导出当前来源作者包；本机草稿仍保留。'); }
    catch (error) { status(`导出失败：${error.message}`); }
  };
  $('import').onchange = async event => {
    try {
      for (const file of event.target.files) {
        const data = JSON.parse(await file.text());
        if (data.kind === 'steam-arena-author-bundle') importBundle(data);
        else importText({ ...data, __fileName: file.name });
      }
      status(`已读取 ${event.target.files.length} 份文件；请逐项勾选。`);
    } catch (error) { status(`导入失败：${error.message}`); }
    event.target.value = '';
  };
  $('archive').onclick = async () => {
    if (!formal) { status('正式文件尚未读取完成。'); return; }
    const request = { version: 1, sources: [...sources], stageRecords: {}, textValues: {}, removedElements: {} };
    for (const box of $('diffs').querySelectorAll('input:checked')) {
      const item = entries.get(box.dataset.id);
      if (item.type === 'stage') request.stageRecords[item.key] = item.next;
      if (item.type === 'text') request.textValues[item.key] = item.next;
      if (item.type === 'removed') request.removedElements[item.key] = item.next;
    }
    if (!request.sources.length) source('formal-files', location.href, now());
    request.sources = [...sources];
    try {
      const response = await fetch('/__publish/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '归档失败');
      status(`已归档；回执 tools/out/publish-preflight.json\n${JSON.stringify(data.receipt.files, null, 2)}`);
      await loadFormal(); entries.clear(); render();
    } catch (error) { status(`归档失败：${error.message}`); }
  };

  if (location.protocol === 'file:') {
    $('archive').disabled = true; $('import').disabled = true;
    status('文件直开模式只能导出作者包；请用 python tools/serve.py 打开此页归档。');
  } else loadFormal().then(() => {
    const current = SAAuthorContent.collect();
    importBundle(current, true);
    status('已核对当前来源草稿和正式文件。其他来源请导入作者包。');
  }).catch(error => status(`读取失败：${error.message}`));
})();
