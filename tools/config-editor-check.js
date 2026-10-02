// 正式配置编辑器只通过服务写同名 JSON；失败时保留输入供重试。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run() {
  const names = fs.readdirSync(path.join(__dirname, '../config')).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5));
  const files = new Map(names.map(name => [name, JSON.parse(fs.readFileSync(path.join(__dirname, `../config/${name}.json`), 'utf8'))]));
  const elements = Object.fromEntries(['name', 'source', 'save', 'status'].map(id => [id, {
    value: '', textContent: '', className: '', disabled: false, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; }, add(option) { this.options ||= []; this.options.push(option); }
  }]));
  let writes = 0, fail = false;
  const fetch = async (url, options = {}) => {
    if (url === '/__config/list') return { ok: true, json: async () => ({ names }) };
    if (url.startsWith('../config/')) {
      const name = decodeURIComponent(url.slice('../config/'.length, -5));
      return { ok: true, json: async () => files.get(name) };
    }
    assert.strictEqual(url, '/__config/save');
    assert.strictEqual(options.method, 'POST');
    writes++;
    if (fail) return { ok: false, status: 500, json: async () => ({ error: '模拟失败' }) };
    const payload = JSON.parse(options.body);
    files.set(payload.name, payload.data);
    return { ok: true, json: async () => ({ file: `config/${payload.name}.json` }) };
  };
  const context = vm.createContext({ console, fetch, Option: function Option(label, value) { this.label = label; this.value = value; },
    document: { querySelector: selector => elements[selector.slice(1)], addEventListener() {} }, confirm: () => true });
  context.SA = { Config: { replace(name, data) { assert.strictEqual(name, names[0]); assert.deepStrictEqual(data, files.get(name)); } } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'config-editor.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(elements.name.options.length, names.length);
  const current = names[0];
  const changed = { ...files.get(current), editorProbe: '测试保存' };
  elements.source.value = JSON.stringify(changed);
  elements.source.listeners.input();
  await elements.save.listeners.click();
  assert.strictEqual(files.get(current).editorProbe, '测试保存');
  fail = true;
  elements.source.value = JSON.stringify({ ...changed, editorProbe: '失败保留' });
  elements.source.listeners.input();
  await elements.save.listeners.click();
  assert.strictEqual(files.get(current).editorProbe, '测试保存');
  assert.strictEqual(JSON.parse(elements.source.value).editorProbe, '失败保留');
  assert.match(elements.status.textContent, /写入失败/);
  assert.strictEqual(writes, 2);
  console.log('配置目录加载、正式保存与失败重试：通过');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
