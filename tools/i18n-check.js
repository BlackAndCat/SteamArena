// 多语言回归：校验真实配置和运行时入口，重点覆盖回退、占位符、存档隔离与英文保存。
// 无浏览器依赖；用最小 DOM / HTTP 宿主执行生产 config.js 和 i18n.js。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const load = name => JSON.parse(fs.readFileSync(path.join(root, 'config', name + '.json'), 'utf8'));
const manifest = load('i18n'), english = load('lang-en'), chinese = load('ui');
const stableKeys = ['ui_08b2f31aa1ca', 'ui_72db466848ad', 'ui_a29e2c245294', 'ui_ce25ea0e33e7'];
const placeholders = value => [...value.matchAll(/\{\{\d+\}\}|\{[^{}]+\}/g)].map(match => match[0]).sort();

// 每个界面键均有英文，保留机制误抽取的 CSS 类名及全部模板占位符。
for (const [key, value] of Object.entries(chinese.messages)) {
  assert.equal(typeof english.messages[key], 'string', `英文缺键：${key}`);
  assert.deepEqual(placeholders(english.messages[key]), placeholders(value), `占位符不一致：${key}`);
  if (stableKeys.includes(key)) assert.equal(english.messages[key], value, `类名被翻译：${key}`);
  else assert.ok(!/[\u3400-\u9fff]/u.test(english.messages[key]), `英文残留中文：${key}`);
}

function start({ href = 'https://example.test/', stored, blocked = false, documents = {} } = {}) {
  const fixtures = Object.fromEntries(['i18n', 'lang-en', 'ui', 'text', 'modules', 'content', 'rules', 'routes', 'stage-cars'].map(name => [name, load(name)]));
  Object.assign(fixtures, documents);
  const before = JSON.stringify(fixtures);
  const saved = new Map([['steam_arena_save_v2', '{"money":1234,"wins":2}']]);
  if (stored) saved.set(manifest.storageKey, stored);
  const elements = [], events = new Map(), requests = [];
  const document = {
    currentScript: { src: 'https://example.test/js/config.js', hasAttribute: () => true },
    readyState: 'complete', documentElement: {}, title: '',
    body: { append: element => elements.push(element) },
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener(type, callback) { this[type] = callback; } }),
    addEventListener(type, callback) { events.set(type, callback); },
    removeEventListener(type) { events.delete(type); },
  };
  const location = Object.assign(new URL(href), { assign(destination) { this.destination = destination; } });
  const context = vm.createContext({
    document, location, URL, console,
    localStorage: {
      getItem(key) { if (blocked) throw new Error('存储被禁用'); return saved.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error('存储被禁用'); saved.set(key, value); },
    },
    XMLHttpRequest: class {
      open(method, url) { this.name = new URL(url).pathname.split('/').pop().replace(/\.json$/, ''); }
      setRequestHeader() {}
      send() { this.status = 200; this.responseText = JSON.stringify(fixtures[this.name]); }
    },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    fetch: async (url, options) => {
      requests.push({ url, ...options, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ revision: '测试版本' }) };
    },
    confirm: () => true,
  });
  context.window = context;
  for (const file of ['js/config.js', 'js/i18n.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return { context, fixtures, before, saved, elements, events, requests };
}

async function check() {
  const zh = start();
  assert.equal(zh.context.SA.I18n.locale, 'zh-CN');
  assert.equal(zh.context.SA.Config.text('page_title'), chinese.messages.page_title);
  assert.equal(zh.elements[0].textContent, 'English');
  assert.equal(start({ stored: 'unknown' }).context.SA.I18n.locale, 'zh-CN');
  assert.equal(start({ stored: 'en' }).context.SA.I18n.locale, 'en');
  assert.equal(start({ href: 'https://example.test/?lang=zh-CN', stored: 'en' }).context.SA.I18n.locale, 'zh-CN');

  const en = start({ href: 'https://example.test/?lang=en&test=1#keep' });
  const SA = en.context.SA;
  assert.equal(en.context.document.documentElement.lang, 'en');
  assert.equal(en.context.document.title, english.messages.page_title);
  assert.equal(en.elements[0].textContent, '简体中文');
  assert.equal(SA.Config.text('camp_reward_item', 'Gear', 2), english.messages.camp_reward_item.replace('{{0}}', 'Gear').replace('{{1}}', '2'));
  assert.equal(SA.Config.get('text').locale, 'en');
  assert.equal(SA.Config.get('ui'), SA.Config.get('ui'), '重复读取应保持语言视图的引用');
  assert.equal(SA.I18n.translate('开始游戏'), 'Start Game');
  assert.equal(SA.I18n.translate('继续存档 · Prologue'), 'Continue save · Prologue');
  assert.equal(SA.I18n.translate('玩家起的名字'), '玩家起的名字', '整句词典不能误改玩家自定义名称');
  assert.equal(JSON.stringify(en.fixtures), en.before, '中文配置不应被原地修改');
  for (const name of ['modules', 'content', 'rules', 'routes', 'stage-cars']) {
    const original = en.fixtures[name], translated = SA.Config.get(name);
    for (const [pointer, value] of Object.entries(english.configs[name])) {
      const leaf = pointer.slice(1).split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce((object, key) => object?.[key], original);
      assert.equal(typeof leaf, 'string', `翻译路径不存在或不是字符串：${name}${pointer}`);
      assert.deepEqual(placeholders(value), placeholders(leaf), `数据占位符变化：${name}${pointer}`);
    }
    // 非翻译路径的叶值、数组长度和对象键必须完全相同，数值与 ID 不随语言改变。
    function compare(a, b, pointer = '') {
      if (a && typeof a === 'object') {
        assert.deepEqual(Object.keys(b), Object.keys(a), `结构变化：${name}${pointer}`);
        for (const key of Object.keys(a)) compare(a[key], b[key], pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'));
      } else assert.equal(b, english.configs?.[name]?.[pointer] ?? a, `非文案变化：${name}${pointer}`);
    }
    compare(original, translated);
  }

  const incomplete = structuredClone(english);
  delete incomplete.messages.page_title;
  const fallback = start({ href: 'https://example.test/?lang=en', documents: { 'lang-en': incomplete } });
  assert.equal(fallback.context.SA.Config.text('page_title'), chinese.messages.page_title, '缺译时回退中文');

  // 旧角色名仍可找到同一头像，内容文件驾驶员的英译也与显示名一致。
  const cast = {};
  SA.Coal = { byName: { [SA.Config.text('home_d095d42ab435')]: cast } };
  en.events.get('load')();
  assert.equal(SA.Coal.byName[chinese.messages.home_d095d42ab435], cast);

  // 现有战斗代码按短语识别终止原因，英译不能改变失败类型。
  assert.ok(SA.Config.text('battle_39f68a635696').includes(SA.Config.text('battle_fe1b451306a3')));
  assert.ok(SA.Config.text('battle_605a242d802d').includes(SA.Config.text('battle_327b54d04f71')));

  SA.current = 'battle';
  assert.equal(SA.I18n.toggle(), false, '战斗中不可切换刷新');
  assert.equal(en.context.location.destination, undefined);
  SA.current = 'home';
  SA.Text = { hasPending: () => true };
  en.context.confirm = () => false;
  assert.equal(SA.I18n.toggle(), false, '取消放弃草稿时保留当前语言');
  SA.Text.hasPending = () => false;
  const gameSave = en.saved.get('steam_arena_save_v2');
  assert.equal(SA.I18n.toggle(), true);
  assert.equal(en.saved.get('steam_arena_save_v2'), gameSave);
  assert.equal(en.saved.get(manifest.storageKey), 'zh-CN');
  const destination = new URL(en.context.location.destination);
  assert.equal(destination.searchParams.get('lang'), 'zh-CN');
  assert.equal(destination.searchParams.get('test'), '1');
  assert.equal(destination.hash, '#keep');
  const privateMode = start({ blocked: true });
  assert.equal(privateMode.context.SA.I18n.setLocale('en'), true);
  assert.equal(new URL(privateMode.context.location.destination).searchParams.get('lang'), 'en');

  const text = structuredClone(SA.Config.get('text'));
  text.values['story:opening'] = '[{"text":"An English edit"}]';
  await SA.I18n.saveDocuments(text, SA.Config.get('ui'));
  assert.equal(en.requests.length, 1);
  assert.equal(en.requests[0].url, '/__config/save');
  assert.equal(en.requests[0].body.name, 'lang-en', '英文保存必须隔离中文文件');
  assert.equal(en.requests[0].body.data.text.values['story:opening'], text.values['story:opening']);
  assert.equal(en.requests[0].body.data.configs.modules['/MODULES/cockpit/name'], english.configs.modules['/MODULES/cockpit/name']);
  assert.equal(JSON.stringify(en.fixtures), en.before, '保存也不能改动中文源对象');

  // 评价显示使用英文，存储继续使用原协议标签，旧记录和校准工具无需迁移。
  const battleSource = fs.readFileSync(path.join(root, 'js/battle.js'), 'utf8');
  const recording = battleSource.slice(battleSource.indexOf('  function recordHumanBattle(input) {'), battleSource.indexOf('  // ---------- 无画面模拟'));
  vm.runInContext(recording + '\nthis.recordForTest = recordHumanBattle;', en.context);
  const recordId = en.context.recordForTest({ events: {}, metrics: {}, time: 1 });
  assert.ok(recordId);
  assert.equal(SA.HUMAN_BATTLES.feedback(recordId, SA.Config.text('battle_21c3183d825b')), true);
  assert.equal(JSON.parse(SA.HUMAN_BATTLES.exportJson()).records[0].feedback, chinese.messages.battle_21c3183d825b);
  assert.equal(SA.HUMAN_BATTLES.feedback(recordId, 'illegal'), false);

  // 执行真实文本管理器，证明同时编辑 UI 与剧情后只写英文包，失败后草稿仍可重试。
  // 此处不启动 DOM 作者工具，沿用既有文本回归脚本的无界面初始化方式。
  function startText(host) {
    Object.assign(host.context.document, { body: null, head: null, readyState: 'loading' });
    vm.runInContext(fs.readFileSync(path.join(root, 'js/text-manager.js'), 'utf8'), host.context, { filename: 'js/text-manager.js' });
    host.context.SA.Text.init({ locale: 'zh-CN', toolbar: false });
    return host.context.SA.Text.ready;
  }
  const editing = start({ href: 'https://example.test/?lang=en' });
  await startText(editing);
  const textApi = editing.context.SA.Text;
  textApi.register('missing.title', '开始游戏');
  assert.equal(textApi.get('missing.title'), 'Start Game');
  textApi.set('story:opening', '[{"text":"Saved English story"}]');
  textApi.set('ui:camp_reward_item', 'Edited reward: {{0}} ×{{1}}');
  assert.equal(textApi.hasPending(), true);
  assert.equal((await textApi.save()).ok, true);
  assert.equal(textApi.hasPending(), false);
  const written = editing.requests[0].body;
  assert.equal(written.name, 'lang-en');
  assert.equal(written.data.text.locale, 'en', 'main.js 的旧中文参数不能覆盖当前语言');
  assert.equal(written.data.messages.camp_reward_item, 'Edited reward: {{0}} ×{{1}}');
  assert.equal(JSON.stringify(editing.fixtures), editing.before);
  const refreshed = start({ href: 'https://example.test/?lang=en', documents: { 'lang-en': written.data } });
  await startText(refreshed);
  assert.equal(refreshed.context.SA.Text.get('story:opening'), '[{"text":"Saved English story"}]');
  assert.equal(refreshed.context.SA.Config.text('camp_reward_item', 'Gear', 2), 'Edited reward: Gear ×2');
  const healthyFetch = editing.context.fetch;
  editing.context.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: '模拟写入失败' }) });
  textApi.set('probe', 'Retry this edit');
  assert.equal((await textApi.save()).ok, false);
  assert.equal(textApi.hasPending(), true);
  assert.equal(textApi.get('probe'), 'Retry this edit');
  editing.context.fetch = healthyFetch;
  assert.equal((await textApi.save()).ok, true);
  assert.equal(textApi.hasPending(), false);
  console.log(`多语言检查通过：${Object.keys(chinese.messages).length} 个界面键，配置结构、回退、切换、存档隔离与英文保存。`);
}
check().catch(error => { console.error(error); process.exitCode = 1; });
