/* 两个隔离页面验证正式配置保存后的广播、失败保护和并发编辑。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/text.json'), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const peers = [];
let broadcasts = 0;
class Channel {
  constructor(name) { this.name = name; peers.push(this); }
  postMessage(data) {
    if (this.name === 'sa-yard-chat') broadcasts++;
    peers.filter(peer => peer !== this && peer.name === this.name).forEach(peer => peer.onmessage?.({ data }));
  }
  close() { peers.splice(peers.indexOf(this), 1); }
}
const group = text => [{ id: 'probe', name: '测试组', weight: 1, cooldownSec: 0, weather: 'any',
  lines: [{ who: 'tom', text, action: 'talk' }] }];

async function windowContext(fetch) {
  const doc = copy(original);
  const context = vm.createContext({ console, Promise, Map, Set, WeakMap, WeakSet, JSON, fetch,
    document: { head: null, body: null, readyState: 'loading', addEventListener() {} },
    BroadcastChannel: Channel, setTimeout, clearTimeout, queueMicrotask });
  context.window = context;
  context.SA = { RELEASE: false, Config: { get: () => doc }, CAMPAIGN: [{ stages: [{}] }],
    S: { d: { camp: { ch: 0, st: 0 } } }, Camp: { current: () => ({ name: '本关' }) } };
  vm.runInContext(source('text-manager.js'), context);
  vm.runInContext(source('yard-chat.js'), context);
  context.SA.Text.init({ toolbar: false });
  await context.SA.Text.ready;
  return context.SA;
}

async function run() {
  let saved, fail = false, gate = null, posts = 0;
  const fetch = async (url, options) => {
    assert.strictEqual(url, '/__text/save');
    posts++;
    const payload = JSON.parse(options.body);
    if (gate) await gate.promise;
    if (fail) return { ok: false, status: 500, json: async () => ({ error: '模拟失败' }) };
    saved = payload;
    return { ok: true, json: async () => ({ revision: String(posts) }) };
  };
  const game = await windowContext(fetch);
  const editor = await windowContext(fetch);
  editor.YardChat.write('stage:0:0', group('正式配置生效'));
  assert((await editor.YardChat.save()).ok);
  assert.strictEqual(broadcasts, 1);
  assert.strictEqual(game.YardChat.read('stage:0:0').groups[0].lines[0].text, '正式配置生效');
  assert.deepStrictEqual(saved.values['home:chat:pool:stage:0:0'], JSON.stringify(group('正式配置生效')));

  game.Text.set('local:pending', '未保存');
  editor.YardChat.write('stage:0:0', group('第二次修改'));
  assert((await editor.YardChat.save()).ok);
  assert.strictEqual(game.YardChat.read('stage:0:0').groups[0].lines[0].text, '正式配置生效', '本页待保存修改不能被广播覆盖');

  fail = true;
  editor.YardChat.write('stage:0:0', group('失败后重试'));
  const before = broadcasts;
  assert.strictEqual((await editor.YardChat.save()).ok, false);
  assert.strictEqual(broadcasts, before, '失败不能广播未落盘数据');
  assert.strictEqual(editor.YardChat.read('stage:0:0').groups[0].lines[0].text, '失败后重试');
  fail = false;
  assert((await editor.YardChat.save()).ok);

  editor.Text.set('concurrent', '请求时');
  gate = {}; gate.promise = new Promise(resolve => { gate.resolve = resolve; });
  const pending = editor.Text.save();
  await new Promise(resolve => setImmediate(resolve));
  editor.Text.set('concurrent', '请求后');
  gate.resolve(); gate = null;
  const result = await pending;
  assert.strictEqual(result.pending, true);
  assert.strictEqual(result.document.values.concurrent, '请求时');
  assert.strictEqual(editor.Text.get('concurrent'), '请求后');
  return { broadcast: true, dirtyGuard: true, failureRetry: true, pendingSnapshot: true };
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
