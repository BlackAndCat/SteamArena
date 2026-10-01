// 在隔离的 DOM 与 IndexedDB 模型中运行真实工作台脚本，不写正式模块数据。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const original = fs.readFileSync(path.join(__dirname, 'module-editor.js'), 'utf8');
const source = original.replace(/  init\(\);\s*\}\)\(\);\s*$/, `  globalThis.__check = {
    storedHandle, init, save,
    edit(path, value, fileHandle) {
      selected = 'track'; handle = fileHandle; ready = true;
      controls = new Map([[path, () => value]]); touched = new Set([path]);
      updateDirty();
    },
    select,
    currentHandle() { return handle; },
    setReady(value) { ready = value; },
    state() { return { ready, service }; },
    moduleValue(path) { return SA.MODULES.track[path]; },
  };
})();`);
assert.notEqual(source, original, '测试入口应挂接真实工作台脚本');

const moduleSource = 'SA.MODULES = {};\nSA.MODULE_DEFAULTS = {};\n// MODULE_EDITOR_OVERRIDES_START\nSA.MODULE_OVERRIDES = {};\n// MODULE_EDITOR_OVERRIDES_END\n';
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ store = {}, failPut = false, failGet = false, serviceOk = false, permission = 'granted', permissionReply = 'granted', pickerAbort = false } = {}) {
  const elements = new Map(), listeners = new Map();
  const counts = { picker: 0, requestPermission: 0, write: 0, reload: 0 };
  let fileText = moduleSource;
  const fileHandle = {
    async queryPermission() { return permission; },
    async requestPermission() { counts.requestPermission++; return permissionReply; },
    async getFile() { return { name: 'modules.js', text: async () => fileText }; },
    async createWritable() {
      return { async write(text) { fileText = text; counts.write++; }, async close() {} };
    },
  };
  function element(tagName = 'DIV') {
    return {
      tagName, children: [], value: '', textContent: '', className: '', disabled: false,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener() {}, setAttribute() {},
      querySelector(selector) {
        const wanted = selector.toUpperCase();
        for (const child of this.children) {
          if (child.tagName === wanted) return child;
          const nested = child.querySelector?.(selector);
          if (nested) return nested;
        }
        return null;
      },
    };
  }
  const db = {
    transaction(_name, mode) {
      const tx = {
        objectStore() {
          return {
            get() {
              const req = { result: store.handle || null };
              queueMicrotask(() => {
                if (failGet) tx.onabort();
                else { req.onsuccess(); queueMicrotask(() => tx.oncomplete()); }
              });
              return req;
            },
            put(value) {
              const req = {};
              queueMicrotask(() => {
                req.onsuccess();
                queueMicrotask(() => {
                  if (failPut) tx.onabort();
                  else { store.handle = value; tx.oncomplete(); }
                });
              });
              return req;
            },
          };
        },
      };
      assert.ok(mode === 'readonly' || mode === 'readwrite');
      return tx;
    },
    close() {},
  };
  const context = {
    SA: {
      MODULE_EDITOR_SCHEMA: { fields: { name: { type: 'string', label: '名称' }, desc: { type: 'string', label: '说明' }, hp: { type: 'number', label: '耐久' } } },
      MODULE_ORDER: ['track', 'boiler'], MODULES: { track: { name: '旧名称', get desc() { return '默认说明'; }, cat: 'track', hp: 100 }, boiler: { name: '锅炉', cat: 'power', hp: 50 } },
      MODULE_DEFAULTS: { track: { name: '旧名称', desc: '默认说明', hp: 100 }, boiler: { name: '锅炉', hp: 50 } }, MODULE_OVERRIDES: {},
      SPR: { moduleCanvas: () => element('CANVAS') },
      validateModuleOverrides: () => ({ ok: true }),
    },
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      createElement(name) { return element(name.toUpperCase()); },
    },
    Option: function Option(text, value) { return { text, value }; },
    window: {
      showOpenFilePicker() {
        counts.picker++;
        if (pickerAbort) return Promise.reject(Object.assign(new Error('取消选择'), { name: 'AbortError' }));
        return Promise.resolve([fileHandle]);
      },
      addEventListener(name, listener) { listeners.set(name, listener); },
    },
    indexedDB: {
      open() {
        const req = { result: db };
        queueMicrotask(() => req.onsuccess());
        return req;
      },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch: async () => {
      if (serviceOk) return { ok: true, json: async () => ({ ok: true }) };
      throw new Error('隔离静态模式无写入服务');
    },
    location: { reload() { counts.reload++; } },
    confirm: () => true,
  };
  vm.runInNewContext(source, context, { filename: 'module-editor.js' });
  return { api: context.__check, elements, listeners, counts, fileHandle, store, fileText: () => fileText };
}

async function checkTransactionOrder() {
  let request, transaction;
  const db = {
    transaction() {
      transaction = { objectStore: () => ({ put: () => (request = {}) }) };
      return transaction;
    }, close() {},
  };
  const context = {
    SA: { MODULES: {}, MODULE_ORDER: [] },
    indexedDB: { open() { const req = { result: db }; queueMicrotask(() => req.onsuccess()); return req; } },
  };
  vm.runInNewContext(source, context, { filename: 'module-editor.js' });
  let settled = false;
  const saving = context.__check.storedHandle({ name: 'modules.js' }).then(() => { settled = true; });
  await tick(); request.onsuccess(); await tick();
  assert.equal(settled, false, '请求成功时事务尚未提交');
  transaction.oncomplete(); await saving;
  assert.equal(settled, true);
  const failed = context.__check.storedHandle({ name: 'modules.js' });
  await tick(); request.onsuccess(); transaction.onerror();
  await assert.rejects(failed, /文件授权记录写入失败/);
}

async function checkSaveAndShortcut() {
  const store = {};
  const first = harness({ store, permission: 'prompt' });
  await first.api.init();
  first.api.edit('name', '新名称', null);
  await first.api.save();
  assert.equal(first.counts.picker, 1);
  assert.equal(first.counts.write, 1);
  assert.equal(first.counts.reload, 1);
  assert.equal(store.handle, first.fileHandle);

  const next = harness({ store });
  await next.api.init();
  assert.equal(next.api.currentHandle(), first.fileHandle);
  next.api.edit('name', '另一名称', first.fileHandle);
  const event = { ctrlKey: true, metaKey: false, code: 'KeyS', target: { tagName: 'INPUT' }, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  next.listeners.get('keydown')(event);
  await tick(); await tick();
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(next.counts.picker, 0, '恢复句柄后不应重新选择文件');
  assert.equal(first.counts.requestPermission, 2, '权限为 prompt 时应复用句柄并再次申请权限');

  const mac = harness();
  await mac.api.init();
  mac.api.edit('name', '再改名称', mac.fileHandle);
  const macEvent = { ctrlKey: false, metaKey: true, code: 'KeyS', target: { tagName: 'TEXTAREA' }, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  mac.listeners.get('keydown')(macEvent);
  await tick(); await tick();
  assert.equal(macEvent.prevented, true);
  assert.equal(mac.counts.write, 1);
  assert.equal(mac.counts.picker, 0);

  const empty = harness();
  await empty.api.init();
  await empty.api.save();
  assert.equal(empty.counts.picker, 0, '无改动时不应要求选择文件');
}

async function checkFailureAndDeduplication() {
  const failed = harness({ failPut: true });
  await failed.api.init();
  failed.api.edit('name', '失败后仍保留', failed.fileHandle);
  await failed.api.save();
  assert.equal(failed.counts.write, 1);
  assert.equal(failed.counts.reload, 0, '句柄记录失败时不得刷新');
  assert.equal(failed.api.currentHandle(), failed.fileHandle);
  assert.match(failed.elements.get('notice').textContent, /本次已保存.*未能记住文件/);
  assert.match(failed.elements.get('dirty').textContent, /与已加载版本一致/);
  failed.api.select('boiler');
  failed.api.select('track');
  failed.api.edit('hp', 120, failed.fileHandle);
  await failed.api.save();
  assert.match(failed.fileText(), /"name": "失败后仍保留"/);
  assert.match(failed.fileText(), /"hp": 120/);
  assert.equal(failed.counts.picker, 0, '授权记忆失败后当前页仍应复用内存句柄');

  const getter = harness({ failPut: true });
  await getter.api.init();
  getter.api.edit('desc', '说明已保存', getter.fileHandle);
  await getter.api.save();
  assert.equal(getter.api.moduleValue('desc'), '说明已保存');
  getter.api.select('boiler'); getter.api.select('track');
  getter.api.edit('hp', 130, getter.fileHandle);
  await getter.api.save();
  assert.match(getter.fileText(), /"desc": "说明已保存"/);
  assert.match(getter.fileText(), /"hp": 130/);

  const pending = harness();
  await pending.api.init();
  pending.api.edit('name', '快速连存', null);
  const saveA = pending.api.save(), saveB = pending.api.save();
  await Promise.all([saveA, saveB]);
  assert.equal(pending.counts.picker, 1);
  assert.equal(pending.counts.write, 1, '连续保存只写一次');

  const denied = harness({ permission: 'prompt', permissionReply: 'denied' });
  await denied.api.init();
  denied.api.edit('name', '仍在草稿', denied.fileHandle);
  await denied.api.save();
  assert.equal(denied.counts.requestPermission, 1);
  assert.equal(denied.counts.write, 0);
  assert.equal(denied.counts.reload, 0);
  assert.match(denied.elements.get('dirty').textContent, /未保存/);
  assert.match(denied.elements.get('notice').textContent, /未获得文件写入权限/);

  const canceled = harness({ pickerAbort: true });
  await canceled.api.init();
  canceled.api.edit('name', '取消后草稿', null);
  await canceled.api.save();
  assert.equal(canceled.counts.picker, 1);
  assert.equal(canceled.counts.write, 0);
  assert.equal(canceled.counts.reload, 0);
  assert.match(canceled.elements.get('dirty').textContent, /未保存/);
  assert.match(canceled.elements.get('notice').textContent, /已取消选择文件/);

  const initializing = harness({ failGet: true, serviceOk: true });
  const initialization = initializing.api.init();
  initializing.api.edit('name', '尚未就绪', null);
  initializing.api.setReady(false);
  const early = { ctrlKey: true, metaKey: false, code: 'KeyS', preventDefault() {}, stopImmediatePropagation() {} };
  initializing.listeners.get('keydown')(early);
  assert.equal(initializing.counts.picker, 0, '初始化未完成时快捷键不得要求选文件');
  await initialization;
  assert.equal(initializing.api.state().ready, true);
  assert.equal(initializing.api.state().service, true);
  assert.match(initializing.elements.get('notice').textContent, /本地写入服务已连接/);
}

Promise.resolve().then(checkTransactionOrder).then(checkSaveAndShortcut).then(checkFailureAndDeduplication)
  .then(() => process.stdout.write('模块工作台保存与快捷键隔离回归通过。\n'))
  .catch(error => { console.error(error); process.exitCode = 1; });
