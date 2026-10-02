// 页面文案保存路由回归：HTTP 即使留有旧文件句柄，也只能写本机服务。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

async function checkHttpSave() {
  const { SA, context } = evolve.loadGame();
  const memory = new Map();
  let handleReads = 0, pickerCalls = 0, fileWrites = 0, posts = 0, failed = false;
  const handle = {
    async queryPermission() { return 'granted'; },
    async getFile() { return { text: async () => JSON.stringify({ values: { probe: '错误文件' } }) }; },
    async createWritable() { fileWrites++; throw new Error('不应写入旧文件句柄'); },
  };
  context.location.protocol = 'http:';
  context.location.pathname = '/index.html';
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  context.indexedDB = { open() { handleReads++; return { result: handle }; } };
  context.showSaveFilePicker = async () => { pickerCalls++; return handle; };
  context.fetch = async (url, options) => {
    if (!options?.method) return { ok: true, json: async () => ({ values: { probe: '正式原稿' } }) };
    assert.strictEqual(url, '/__text/save');
    posts++;
    return failed ? { ok: false, status: 500, json: async () => ({ error: '模拟写入失败' }) }
      : { ok: true, json: async () => ({ revision: String(posts) }) };
  };
  context.document.readyState = 'loading';
  context.document.body = null;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/text-manager.js'), 'utf8'), context);
  SA.Text.init();
  await SA.Text.ready;
  assert.strictEqual(SA.Text.get('probe'), '正式原稿');
  SA.Text.set('probe', '正式新稿');
  assert.strictEqual((await SA.Text.save()).ok, true);
  assert.strictEqual(posts, 1);
  assert.strictEqual(handleReads, 0);
  assert.strictEqual(pickerCalls, 0);
  assert.strictEqual(fileWrites, 0);
  failed = true;
  SA.Text.set('probe', '失败草稿');
  assert.strictEqual((await SA.Text.save()).ok, false);
  assert.strictEqual(posts, 2);
  assert.strictEqual(JSON.parse(memory.get('sa-text-steam-arena-zh-CN')).dirty, true);
  assert.strictEqual(SA.Text.get('probe'), '失败草稿');
  assert.strictEqual(fileWrites, 0);
  console.log('HTTP 正式保存、旧句柄隔离、接口失败保留草稿：通过');
}

checkHttpSave().catch(error => { console.error(error); process.exitCode = 1; });
