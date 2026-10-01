/* 两个隔离窗口验证文件直写和本机服务保存的聊天同步，不读写正式用户数据。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
const peers = [];
let chatBroadcasts = 0;
class Channel {
  constructor(name) { this.name = name; peers.push(this); }
  postMessage(data) {
    if (this.name === 'sa-yard-chat') chatBroadcasts++;
    peers.filter(peer => peer !== this && peer.name === this.name).forEach(peer => peer.onmessage?.({ data }));
  }
  close() { peers.splice(peers.indexOf(this), 1); }
}
const group = text => [{ id: 'probe', name: '测试组', weight: 1, cooldownSec: 0, weather: 'any', lines: [{ who: 'tom', text, action: 'talk' }] }];
const flush = () => new Promise(resolve => setImmediate(resolve));

async function windowContext(fetch, options = {}) {
  const memory = new Map();
  const SA = { CAMPAIGN: [{ stages: [{}] }], S: { d: { camp: { ch: 0, st: 0 } } }, Camp: { current: () => ({ name: '本关' }) } };
  const document = { head: null, body: null, readyState: 'loading', addEventListener() {} };
  const window = { SA, ...options };
  const ctx = vm.createContext({ window, SA, document, fetch, BroadcastChannel: Channel,
    localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    location: { pathname: '/tools/yard-chat-editor.html' }, indexedDB: options.indexedDB,
    setTimeout, clearTimeout, queueMicrotask, console });
  vm.runInContext(source('text-manager.js'), ctx);
  vm.runInContext(source('yard-chat.js'), ctx);
  SA.Text.init({ toolbar: false });
  await SA.Text.ready;
  return SA;
}

async function fileMode() {
  let fileText = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN', values: {}, removedElements: [] });
  let hold = null, written = null, gets = 0;
  const handle = { name: 'zh-CN.json', queryPermission: async () => 'granted',
    getFile: async () => ({ text: async () => fileText }), createWritable: async () => ({
      write: async text => { written = text; }, close: async () => { if (hold) await hold.promise; fileText = written; },
    }) };
  const handles = new Map();
  const indexedDB = { open() {
    const request = { result: { createObjectStore() {}, close() {}, transaction() {
      const tx = { objectStore() { return {
        get(key) { const item = { result: handles.get(key) }; queueMicrotask(() => { item.onsuccess(); tx.oncomplete(); }); return item; },
        put(value, key) { const item = { result: key }; queueMicrotask(() => { handles.set(key, value); item.onsuccess(); tx.oncomplete(); }); return item; },
      }; } }; return tx;
    } } };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess(); });
    return request;
  } };
  const missing = async () => { gets++; return { ok: false, status: 404, json: async () => ({}) }; };
  const game = await windowContext(missing);
  const editor = await windowContext(missing, { indexedDB, showSaveFilePicker: async () => handle });
  editor.YardChat.write('stage:0:0', group('文件直写生效'));
  const result = await editor.YardChat.save();
  await flush();
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.document)), JSON.parse(fileText), '广播快照必须等于本次完整文件写入');
  assert.strictEqual(chatBroadcasts, 1, '单次文件保存只广播一次');
  assert.strictEqual(game.YardChat.read('stage:0:0').groups[0].lines[0].text, '文件直写生效');
  assert.strictEqual(gets, 4, '接收文件快照不能再请求不存在的服务');
  game.Text.set('local-draft', '未保存');
  editor.YardChat.write('stage:0:0', group('下一次修改'));
  await editor.YardChat.save(); await flush();
  assert.strictEqual(game.YardChat.read('stage:0:0').groups[0].lines[0].text, '文件直写生效', '接收窗口草稿不能被覆盖');
  assert.strictEqual(game.Text.get('local-draft'), '未保存');
  editor.Text.set('snapshot-probe', '写入时版本');
  hold = {}; hold.promise = new Promise(resolve => { hold.resolve = resolve; });
  const pending = editor.Text.save();
  await flush();
  editor.Text.set('snapshot-probe', '写入后版本');
  hold.resolve(); hold = null;
  const saved = await pending;
  assert.strictEqual(saved.pending, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(saved.document)), JSON.parse(fileText), '待保存新草稿不能改动本次完整文件快照');
  assert.strictEqual(saved.document.values['snapshot-probe'], '写入时版本');
  assert.strictEqual(JSON.parse(fileText).values['snapshot-probe'], '写入时版本');
  assert.strictEqual(editor.Text.get('snapshot-probe'), '写入后版本');
}

async function serviceMode() {
  let stored = null, posts = 0;
  const fetch = async (_url, options = {}) => {
    if (options.method === 'POST') { stored = JSON.parse(options.body); posts++; return { ok: true, json: async () => ({ revision: String(posts) }) }; }
    return stored ? { ok: true, json: async () => stored } : { ok: false, status: 404, json: async () => ({}) };
  };
  const game = await windowContext(fetch);
  const editor = await windowContext(fetch);
  const broadcastsBefore = chatBroadcasts;
  editor.YardChat.write('global', group('服务保存生效'));
  const result = await editor.YardChat.save();
  await flush();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(posts, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.document)), stored, '服务广播快照必须等于本次完整 POST');
  assert.strictEqual(chatBroadcasts - broadcastsBefore, 1, '单次服务保存只广播一次');
  assert.strictEqual(game.YardChat.read('stage:0:0').groups[0].lines[0].text, '服务保存生效');
}

async function run() {
  await fileMode();
  await serviceMode();
  return { fileWrite: true, missingService: true, pendingSnapshot: true, dirtyGuard: true, serviceSave: true };
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
