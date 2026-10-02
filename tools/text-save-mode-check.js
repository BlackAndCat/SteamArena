// 正式文本配置回归：页面只读配置，HTTP 落盘失败时仅保留本页内存供重试。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/text.json'), 'utf8'));
  assert(source.values && typeof source.values === 'object');
  assert(Array.isArray(source.removedElements));
  assert(Array.isArray(JSON.parse(source.values['story:opening'])));
  assert(source.values['story:opening'] && source.values['story:feat.season']);
  assert(source.values['home:chat:pool:default']);
  assert.strictEqual(source.values['home:chat:pool:global'], '[]', '作者的显式空池必须保留');

  let postCount = 0, fail = false, localWrites = 0, pickerCalls = 0, saved, savedUi;
  const ui = { version: 1, messages: { 'test.dynamic': '测试 {{0}}' } };
  const context = vm.createContext({ console, Promise, Map, Set, WeakMap, WeakSet, JSON,
    document: { readyState: 'loading', body: null, head: null, addEventListener() {} },
    localStorage: { getItem() { throw new Error('文本不能读本机草稿'); }, setItem() { localWrites++; } },
    showSaveFilePicker() { pickerCalls++; throw new Error('不能打开文件选择器'); },
    fetch: async (url, options) => {
      assert.strictEqual(options.method, 'POST');
      postCount++;
      if (fail) return { ok: false, status: 500, json: async () => ({ error: '模拟写入失败' }) };
      if (url === '/__text/save') saved = JSON.parse(options.body);
      else if (url === '/__config/save') {
        const payload = JSON.parse(options.body);
        assert.strictEqual(payload.name, 'ui');
        savedUi = payload.data;
      } else throw new Error(`意外保存接口：${url}`);
      return { ok: true, json: async () => ({ revision: String(postCount) }) };
    }
  });
  context.window = context;
  context.SA = { RELEASE: false, Config: { get: name => name === 'text' ? source : ui,
    text: (key, ...args) => ui.messages[key].replace(/{{(\d+)}}/g, (_, i) => String(args[+i])) } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/text-manager.js'), 'utf8'), context);
  context.SA.Text.init({ toolbar: false });
  await context.SA.Text.ready;
  assert.strictEqual(context.SA.Text.get('story:opening'), source.values['story:opening']);
  context.SA.CAMPAIGN = [{ stages: [{}, {}, {}] }];
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/story.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/yard-chat.js'), 'utf8'), context);
  assert.strictEqual(context.SA.StoryData.get('opening')[0].text, JSON.parse(source.values['story:opening'])[0].text);
  assert.strictEqual(context.SA.STORY.tutorial.parts.length, source.storyMeta.tutorialParts.length);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.SA.YardChat.read('global').groups)), JSON.parse(source.values['home:chat:pool:global']));
  context.SA.YardChat.inherit('global');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.SA.YardChat.read('global').groups)), JSON.parse(source.values['home:chat:pool:default']), '移除全局池后应继承配置默认池');
  context.SA.YardChat.write('global', []);
  assert.strictEqual(context.SA.YardChat.read('global').groups.length, 0, '显式空池必须可恢复');
  context.SA.StoryData.set('opening', [{ text: '刷新后仍能读到正式剧情', scene: 'sleep' }]);
  context.SA.Text.set('probe', '落盘测试');
  assert((await context.SA.Text.save()).ok);
  assert.strictEqual(saved.values.probe, '落盘测试');
  assert.strictEqual(JSON.parse(saved.values['story:opening'])[0].text, '刷新后仍能读到正式剧情');
  assert.deepStrictEqual(saved.storyMeta, source.storyMeta);
  fail = true;
  context.SA.Text.set('probe', '失败后重试');
  assert.strictEqual((await context.SA.Text.save()).ok, false);
  assert.strictEqual(context.SA.Text.get('probe'), '失败后重试');
  assert.strictEqual(localWrites, 0);
  assert.strictEqual(pickerCalls, 0);
  fail = false;
  assert((await context.SA.Text.save()).ok);
  assert.strictEqual(saved.values.probe, '失败后重试');
  context.SA.Text.registerUi('test.dynamic', '测试 张三', ui.messages['test.dynamic'], ['张三']);
  context.SA.Text.set('ui:test.dynamic', '你好，{{0}}');
  assert((await context.SA.Text.save()).ok);
  assert.strictEqual(savedUi.messages['test.dynamic'], '你好，{{0}}', 'UI 编辑必须写回完整模板');
  const refreshed = vm.createContext({ console, Promise, Map, Set, WeakMap, WeakSet, JSON,
    document: { readyState: 'loading', body: null, head: null, addEventListener() {} } });
  refreshed.window = refreshed;
  refreshed.SA = { RELEASE: false, Config: { get: () => saved }, CAMPAIGN: context.SA.CAMPAIGN };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/text-manager.js'), 'utf8'), refreshed);
  refreshed.SA.Text.init({ toolbar: false });
  await refreshed.SA.Text.ready;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/story.js'), 'utf8'), refreshed);
  assert.strictEqual(refreshed.SA.StoryData.get('opening')[0].text, '刷新后仍能读到正式剧情');
  console.log('作者文案迁移、唯一配置读取、HTTP 写入与失败重试：通过');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
