// 工作台直接编辑 config 目录内的正式 JSON；失败时只保留本页输入供重试。
(() => {
  const name = document.querySelector('#name');
  const source = document.querySelector('#source');
  const save = document.querySelector('#save');
  const status = document.querySelector('#status');
  let current = '', loading = false, dirty = false;
  function note(message, kind = '') { status.textContent = message; status.className = kind; }
  async function json(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  async function open(next) {
    if (!next) return;
    if (dirty && !confirm('当前修改尚未保存。确定切换文件吗？')) { name.value = current; return; }
    loading = true;
    try {
      const response = await fetch(`../config/${encodeURIComponent(next)}.json`, { cache: 'no-store' });
      const data = await json(response);
      current = next; name.value = next;
      source.value = JSON.stringify(data, null, 2) + '\n';
      dirty = false; note(`已读取 config/${next}.json`);
    } catch (error) { name.value = current; note(`读取失败：${error.message}`, 'error'); }
    finally { loading = false; }
  }
  async function write() {
    if (loading || !current) return;
    let data;
    try { data = JSON.parse(source.value); }
    catch (error) { note(`JSON 格式错误：${error.message}`, 'error'); return; }
    save.disabled = true;
    note(`正在写入 config/${current}.json…`);
    try {
      const response = await fetch('/__config/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: current, data }) });
      await json(response);
      dirty = false;
      SA.Config.replace(current, data);
      note(`已写入 config/${current}.json`, 'ok');
    } catch (error) { note(`写入失败，本页内容仍可重试：${error.message}`, 'error'); }
    finally { save.disabled = false; }
  }
  source.addEventListener('input', () => { dirty = true; note('本页修改尚未写入配置'); });
  name.addEventListener('change', () => open(name.value));
  save.addEventListener('click', write);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); write(); }
  });
  fetch('/__config/list', { cache: 'no-store' }).then(json).then(data => {
    if (!Array.isArray(data.names) || !data.names.length) throw new Error('没有可编辑的配置');
    for (const entry of data.names) name.add(new Option(entry, entry));
    open(data.names[0]);
  }).catch(error => note(`配置目录读取失败：${error.message}`, 'error'));
})();
