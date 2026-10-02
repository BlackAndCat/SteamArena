// 隔离运行真实编辑器，验证成功才更新内存、失败时保留控件改动。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const original = fs.readFileSync(path.join(__dirname, 'module-editor.js'), 'utf8');
const source = original.replace(/  init\(\);\s*\}\)\(\);\s*$/, `  globalThis.__check = {
    save,
    edit(value) { selected = 'track'; ready = true; controls = new Map([['hp', () => value]]); touched = new Set(['hp']); updateDirty(); },
    dirty: changed,
  };
})();`);
assert.notEqual(source, original);

function harness(success) {
  const elements = new Map(), requests = [], module = { name: '履带', cat: 'chassis', hp: 100 };
  const element = () => ({ textContent: '', className: '', disabled: false, value: '', replaceChildren() {}, append() {},
    querySelector() { return { textContent: '' }; } });
  const SA = { MODULE_EDITOR_SCHEMA: { fields: {} }, MODULE_ORDER: ['track'], MODULES: { track: module },
    Config: { clear() {} }, validateModuleOverrides: () => ({ ok: true }) };
  const context = { SA, document: { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element }, sessionStorage: { setItem() {} }, window: {},
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) });
      return { ok: success, status: success ? 200 : 500, json: async () => success ? { ok: true } : { error: '磁盘写入失败' } }; } };
  vm.runInNewContext(source, context, { filename: 'module-editor.js' });
  return { api: context.__check, module, requests, elements };
}

(async () => {
  const saved = harness(true);
  saved.api.edit(120);
  await saved.api.save();
  assert.deepEqual(saved.requests[0], { url: '/__modules/save', body: { id: 'track', changes: { hp: 120 } } });
  assert.equal(saved.module.hp, 120);
  assert.equal(saved.api.dirty(), false);
  const failed = harness(false);
  failed.api.edit(130);
  await failed.api.save();
  assert.equal(failed.module.hp, 100);
  assert.equal(failed.api.dirty(), true);
  assert.match(failed.elements.get('notice').textContent, /磁盘写入失败/);
  console.log('模块编辑器直写与失败保留检查通过。');
})().catch(error => { console.error(error); process.exitCode = 1; });
