// 旧 file: 文本缓存转到本机服务；旧关卡缓存保留在浏览器但不再回灌。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8');
const oldStage = JSON.stringify({ records: {} });
const oldText = JSON.stringify({ values: { 'story:e2e': '旧作者台词' }, removedElements: [] });
const cache = new Map([['steam_arena_stage_cars_local_v1', oldStage], ['sa-text-steam-arena-zh-CN', oldText]]);
let redirected = '', storageWrites = 0;
const storage = { getItem: key => cache.get(key) || null, setItem: () => { storageWrites++; } };
const filePage = { currentScript: { src: 'file:///Z:/SteamArena/js/config.js' }, title: '测试页' };
const fileLocation = { href: 'file:///Z:/SteamArena/tools/console.html?ch=0#original', protocol: 'file:',
  search: '?ch=0', hash: '#original', replace: url => { redirected = url; } };
vm.runInNewContext(source, { window: { SA: {} }, document: filePage, location: fileLocation,
  localStorage: storage, URL, Map, XMLHttpRequest: class {} });
assert(redirected.startsWith('http://localhost:5173/tools/console.html?ch=0#sa-config-migrate='));

const incoming = new URL(redirected);
let requestBody, cleaned = '';
class Request {
  open(method, url, async) { assert.strictEqual(method, 'POST'); assert.strictEqual(url, '/__config/migrate'); assert.strictEqual(async, false); }
  setRequestHeader() {}
  send(body) { requestBody = JSON.parse(body); this.status = 200; this.responseText = '{"ok":true}'; }
}
const httpPage = { currentScript: { src: 'http://localhost:5173/js/config.js' }, title: '测试页' };
const httpLocation = { href: incoming.href, protocol: 'http:', hostname: 'localhost',
  hash: incoming.hash, pathname: incoming.pathname, search: incoming.search };
const httpWindow = { SA: {} };
vm.runInNewContext(source, { window: httpWindow, document: httpPage, location: httpLocation,
  localStorage: storage, history: { replaceState: (_, __, url) => { cleaned = url; } }, URL, Map, XMLHttpRequest: Request });
assert.strictEqual(requestBody['steam_arena_stage_cars_local_v1'], undefined);
assert.strictEqual(requestBody['sa-text-steam-arena-zh-CN'], oldText);
assert.strictEqual(cache.get('steam_arena_stage_cars_local_v1'), oldStage);
assert.strictEqual(cleaned, '/tools/console.html?ch=0#original');
assert.strictEqual(storageWrites, 0);

// 写入失败时保留迁移片段供重试，不能误称已同步或擦除旧作者缓存。
let cleanedAfterFailure = false;
class FailedRequest extends Request {
  send() { this.status = 500; this.responseText = '保存失败'; }
}
assert.throws(() => vm.runInNewContext(source, { window: { SA: {} },
  document: { ...httpPage, addEventListener() {} }, location: httpLocation, localStorage: storage,
  history: { replaceState() { cleanedAfterFailure = true; } }, URL, Map, XMLHttpRequest: FailedRequest,
}), /旧作者数据迁入失败/);
assert.strictEqual(cleanedAfterFailure, false);
assert.strictEqual(storageWrites, 0);

// 发行版只读本包配置，不把浏览器中的开发缓存 POST 回作者服务。
vm.runInNewContext(source, { window: { SA: { RELEASE: true } }, document: httpPage,
  location: httpLocation, localStorage: storage, URL, Map,
  XMLHttpRequest: class { constructor() { throw new Error('发行版不应迁移旧缓存'); } },
});
console.log('旧 file: 自动转 HTTP、失败保留迁移片段、发行版跳过 POST：通过');
