// 首页异步加载回归：验证配置并发、缓存复用、发行版本参数和脚本执行先后。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');
const bootstrapSource = fs.readFileSync(path.join(ROOT, 'js/bootstrap.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const names = ['rules', 'ui', 'text', 'modules', 'content', 'stage-cars', 'routes'];
const scripts = [...html.matchAll(/<script src="([^"]+)" type="application\/x-sa-script"><\/script>/g)].map(match => match[1]);

// 保留配置后的完整脚本清单；引导器本身在清单之后独立异步启动。
assert(scripts.length > 30);
assert.strictEqual(scripts[0], 'js/text-manager.js');
assert.strictEqual(scripts.at(-1), 'js/main.js');
assert(html.includes('<script src="js/config.js" data-sa-preload></script>'));
assert(html.includes('<script src="js/bootstrap.js" async></script>'));

// 入口早到和晚到都需初始化；不派发伪造 DOM 事件影响其他模块。
function checkMain(readyState) {
  let starts = 0, listener;
  const SA = { Text: { init() {} }, PX: { init() {} }, S: { load() {} },
    Camp: { backfill() {} }, Story: { title() { starts++; } } };
  const page = { readyState, body: { dataset: {} }, addEventListener() {},
    querySelector: () => ({ addEventListener() {} }) };
  const host = { SA, addEventListener(event, callback, options) {
    assert.strictEqual(event, 'DOMContentLoaded');
    assert.strictEqual(options.once, true);
    listener = callback;
  } };
  vm.runInNewContext(mainSource, { window: host, SA, document: page,
    location: { hash: '' }, console: { info() {} } });
  if (readyState === 'loading') { assert.strictEqual(starts, 0); listener(); }
  else assert.strictEqual(listener, undefined);
  assert.strictEqual(starts, 1);
}

async function check(release, failedName = null) {
  const pending = [], downloaded = [], executed = [], failures = [];
  const data = Object.fromEntries(names.map(name => [name, name === 'ui' ? { messages: { page_title: '测试标题' } } : { name }]));
  const entries = scripts.map(src => ({ src: 'https://example.test/' + src, getAttribute: () => src }));
  class Request {
    open(method, url, async) {
      assert.strictEqual(method, 'GET');
      assert.strictEqual(async, true, '首页不得退回同步配置 GET');
      this.url = new URL(url);
    }
    setRequestHeader(key, value) { assert(!release); assert.strictEqual(key, 'Cache-Control'); assert.strictEqual(value, 'no-cache'); }
    send() { pending.push(this); }
  }
  const page = {
    currentScript: { src: 'https://example.test/js/config.js', hasAttribute: () => true },
    title: '', querySelectorAll: () => entries,
    createElement: tag => ({ tag }),
    head: { append(element) {
      if (element.tag === 'link') { downloaded.push(element.href); return; }
      assert.strictEqual(pending.length, 7);
      assert.strictEqual(element.async, false);
      executed.push(element.src);
      setImmediate(element.onload);
    } },
  };
  const host = { SA: { RELEASE: release, RELEASE_VERSION: '加载检查 1' } };
  const context = vm.createContext({ window: host, SA: host.SA, document: page,
    location: { href: 'https://example.test/index.html', protocol: 'https:', hostname: 'example.test' },
    URL, Map, XMLHttpRequest: Request, localStorage: { getItem: () => null } });
  vm.runInContext(configSource, context);
  assert.strictEqual(pending.length, 0, '配置脚本自身不能提前同步读取标题');
  host.SA.Config.fail = message => failures.push(message);
  const done = vm.runInContext(bootstrapSource, context);
  assert.strictEqual(pending.length, 7, '必须在等待任一响应前发起全部配置请求');
  assert.strictEqual(downloaded.length, scripts.length);
  assert.strictEqual(executed.length, 0, '配置就绪前不得执行游戏脚本');
  for (const request of [...pending].reverse()) {
    const name = path.basename(request.url.pathname, '.json');
    assert.strictEqual(request.url.searchParams.get('v'), release ? '加载检查 1' : null);
    request.status = name === failedName ? 503 : 200;
    request.responseText = JSON.stringify(data[name]);
    request.onload();
  }
  await done;
  if (failedName) {
    assert.strictEqual(executed.length, 0);
    assert(failures[0].includes('HTTP 503'));
    return;
  }
  assert.deepStrictEqual(executed, entries.map(entry => entry.src));
  assert.strictEqual(page.title, '测试标题');
  for (const name of names) assert.deepStrictEqual(JSON.parse(JSON.stringify(host.SA.Config.get(name))), data[name]);
  assert.strictEqual(pending.length, 7, '缓存命中不能产生额外 GET');
}

(async () => {
  checkMain('loading');
  checkMain('complete');
  await check(false);
  await check(true);
  await check(false, 'routes');
  console.log('首页配置并发、原序脚本执行、缓存命中、发行版本和失败阻断：通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
