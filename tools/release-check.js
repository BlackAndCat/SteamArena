/* 发行专项回归：同一份规则在开发和发行启动顺序下分别运行。 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { install: installConfig } = require('./config-node');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE = path.resolve(process.argv[2] && process.argv[2] !== '--campaign-length'
  ? process.argv[2] : path.join(ROOT, 'tools', 'out', 'release'));
const source = (name, release) => fs.readFileSync(path.join(release ? PACKAGE : ROOT, 'js', name), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const noop = () => {};

/** 只补规则和普通剧情播放所需的浏览器对象，脚本仍逐个执行真实游戏文件。 */
function runtime(release, memory = new Map(), textDocument = null) {
  const element = (tag = 'div') => ({ style: { display: '', getPropertyValue: () => '',
    getPropertyPriority: () => '', setProperty(name, value) { this[name] = value; }, removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, [Symbol.iterator]: function* () {} },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, append: noop,
    appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, contains: () => false, getAttribute: () => null,
    getContext: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    tagName: tag.toUpperCase(), nodeType: 1, childNodes: [], children: [], dataset: {},
    textContent: '', innerHTML: '' });
  const document = { readyState: 'loading', body: element(), documentElement: element(),
    createElement: element, createTextNode: text => ({ textContent: text }),
    addEventListener: noop, removeEventListener: noop, write: noop, querySelector: () => null,
    querySelectorAll: () => [] };
  const sample = element();
  sample.id = 'release-test';
  sample.parentElement = document.body;
  document.body.children = [sample];
  document.body.querySelectorAll = () => textDocument ? [sample] : [];
  const context = vm.createContext({ console, document, addEventListener: noop, removeEventListener: noop,
    innerWidth: 1000, innerHeight: 600, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: noop, cancelAnimationFrame: noop, performance: { now: () => 0 },
    Image: function Image() {}, navigator: {}, location: { href: 'http://localhost:5173/' },
    localStorage: { getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) },
    sessionStorage: { getItem: () => null, setItem: noop },
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 } });
  context.window = context;
  context.globalThis = context;
  const config = installConfig(context, release ? PACKAGE : ROOT);
  if (textDocument) {
    const text = copy(config.get('text'));
    Object.assign(text.values, textDocument.values);
    text.removedElements = textDocument.removedElements;
    config.replace('text', text);
  }
  const files = [
    'release.js', 'text-manager.js', 'yard-chat.js', 'palette.js', 'modules.js',
    'module-art.js', 'dynamics.js', 'sprites.js', 'legs.js', 'vehicle.js', 'content.js',
    'stage-cars.js', 'state.js', 'ui.js', 'camp.js', 'camp-ui.js', 'story.js',
    'story-dev.js', 'terrain-art.js', 'battle.js',
  ];
  for (const file of files) vm.runInContext(source(file, release), context, { filename: file });
  context.SA.S.load();
  return { SA: context.SA, context, memory, sample };
}

/** 旧进度只允许重打当前发行章节，不能从其他入口进入后续章。 */
function progressCheck() {
  const dev = runtime(false);
  assert.strictEqual(dev.SA.CAMPAIGN.length, 6, '开发内容应保留六章');
  const chapterCount = runtime(true).SA.RELEASE_CHAPTERS;
  assert(Number.isInteger(chapterCount) && chapterCount >= 1 && chapterCount <= dev.SA.CAMPAIGN.length);
  if (chapterCount === dev.SA.CAMPAIGN.length) {
    assert.strictEqual(runtime(true).SA.Camp.chapterCount(), chapterCount);
    return { oldSaveReplay: '全章开放' };
  }
  dev.SA.S.d.rep = 77;
  dev.SA.S.d.camp.ch = chapterCount + 1;
  dev.SA.S.d.camp.st = 2;
  dev.SA.S.d.camp.done = false;
  dev.SA.S.d.camp.mods.push('flamer');
  dev.SA.S.d.inv.plate = 4;
  dev.SA.S.save();
  const saved = copy(dev.SA.S.d);
  const rel = runtime(true, dev.memory), { SA } = rel;
  assert.strictEqual(SA.RELEASE, true);
  assert.strictEqual(SA.CAMPAIGN.length, 6, '发行应保留完整章节数据，便于旧档兼容');
  assert.strictEqual(SA.Camp.done(), true, '后续章旧档在发行版本应视为已通关');
  assert.strictEqual(SA.S.d.camp.ch, saved.camp.ch, '发行不应回夹真实进度');
  assert.strictEqual(SA.S.d.camp.st, 2);
  assert.strictEqual(SA.S.d.camp.done, false, '发行不应改写开发版通关标志');
  assert.strictEqual(SA.S.d.rep, saved.rep);
  assert.strictEqual(SA.S.d.inv.plate, saved.inv.plate);
  assert(SA.S.d.camp.mods.includes('flamer'), '旧解锁应保留');
  const entries = SA.S.arenaEntries('camp');
  const opened = key => Number(key.split(',')[0]) < chapterCount;
  assert(entries.length > 0 && entries.every(e => opened(e.key) && e.replay && !e.next),
    '旧档只能重打已开放章节');
  const starts = [];
  SA.Battle.start = options => starts.push(options);
  for (const entry of entries) entry.start();
  assert(starts.length === entries.length && starts.every(options => opened(options.storyKey) && options.replay),
    '旧档可进入后续章或重打入口未正确标记');
  assert.strictEqual(SA.Camp.stage(chapterCount, 0), null, '直接请求后续章关卡应被拒绝');
  assert.strictEqual(SA.Camp.current(), null);
  const before = copy(SA.S.d);
  SA.Camp.win();
  assert.deepStrictEqual(copy(SA.S.d), before, '后续章旧档不能被 win 推进');
  SA.S.settleBattle({ mode: 'campaign', win: true, replay: false,
    playerVehicle: SA.V.clone(SA.S.d.vehicle), enemyName: '关闭章节', prize: 99,
    survivors: [], opts: { storyKey: `${chapterCount},0`, rewardMoney: true } });
  assert.deepStrictEqual(copy(SA.S.d), before, '伪造后续章结算不能发奖或改进度');
  for (const done of [true, false]) {
    const loaded = copy(saved);
    loaded.camp.done = done;
    rel.memory.set('steam_arena_save_v2', JSON.stringify(loaded));
    SA.S.load();
    assert(SA.S.arenaEntries('camp').every(e => opened(e.key) && e.replay && !e.next),
      `旧档 done=${done} 不应开放后续章`);
  }
  return { oldSaveReplay: entries.length };
}

/** 发行终点停在实际开放章数，原进度与资源留给开发版使用。 */
function endingCheck() {
  const { SA } = runtime(true);
  const C = SA.S.d.camp;
  const limit = SA.RELEASE_CHAPTERS;
  C.ch = limit - 1;
  C.st = SA.CAMPAIGN[limit - 1].stages.length - 1;
  C.done = false;
  C.intro = 0;
  const finalStage = SA.Camp.current();
  assert(finalStage && finalStage.ci === limit - 1);
  SA.Camp.win();
  const chapter = SA.CAMPAIGN[limit - 1], unfinished = SA.Camp.unfinished(chapter);
  if (unfinished) {
    // 关卡布局 4：开放的最后一章还没做完，打完已有的关就停在章内等后续关卡，不算通关
    assert.strictEqual(C.ch, limit - 1);
    assert.strictEqual(C.st, chapter.stages.length);
    assert.strictEqual(C.done, false);
    assert.strictEqual(SA.Camp.pending(), true);
  } else if (limit < SA.CAMPAIGN.length) {
    assert.strictEqual(C.ch, limit);
    assert.strictEqual(C.st, 0);
    assert.strictEqual(C.done, false);
  } else {
    assert.strictEqual(C.ch, limit - 1);
    assert.strictEqual(C.done, true);
  }
  assert.strictEqual(SA.Camp.done(), !unfinished);
  assert.strictEqual(SA.Camp.current(), null);
  assert.strictEqual(SA.S.arenaEntries('camp').some(e => e.next), false);
  SA.S.save();
  assert.strictEqual(runtime(false, new Map([['steam_arena_save_v2',
    JSON.stringify(copy(SA.S.d))]])).SA.Camp.done(), limit === SA.CAMPAIGN.length,
  '开发版应能正确读取发行版本存档');
  return { releaseEnd: `${C.ch},${C.st}` };
}

/** 发行移除开发 API，剧情 before/after 与文本读取仍能正常播放。 */
async function surfaceCheck() {
  const memory = new Map([['steam_arena_story_dev_v1', '1']]);
  const textDocument = { version: 1, game: 'steam-arena', locale: 'zh-CN',
    values: { 'story:before.0,0': JSON.stringify([{ text: '正式剧情' }]) },
    removedElements: ['main::global::div#release-test'] };
  const { SA, sample } = runtime(true, memory, textDocument);
  assert.strictEqual(SA.dev, undefined);
  assert.strictEqual(SA.Camp.dev, undefined);
  assert.strictEqual(SA.reset, undefined);
  assert.strictEqual(SA.Battle.debug, undefined);
  assert.strictEqual(SA.S.reset, undefined);
  assert.strictEqual(SA.S.replaceWithStarter, undefined);
  assert.strictEqual(typeof SA.S.restartGame, 'function', '发行应保留玩家重开接口');
  const savedBeforeRestart = copy(SA.S.d), storageBeforeRestart = [...memory];
  SA.Camp.isDesignMode = () => true;
  assert.strictEqual(SA.S.restartGame(), false, '设计模式不得删除正式进度');
  assert.deepStrictEqual(copy(SA.S.d), savedBeforeRestart);
  assert.deepStrictEqual([...memory], storageBeforeRestart, '设计模式拒绝后不得写入任何存储');
  SA.Camp.isDesignMode = () => false;
  for (const key of ['validateSettings', 'setSettings', 'validateGroups', 'write', 'inherit', 'save'])
    assert.strictEqual(SA.YardChat[key], undefined, `发行暴露院子编辑接口 ${key}`);
  for (const key of ['read', 'settings', 'createPlayer'])
    assert.strictEqual(typeof SA.YardChat[key], 'function', `院子普通播放接口缺失 ${key}`);
  assert.strictEqual(SA.StoryDev.enabled(), false);
  for (const key of ['setEnabled', 'editor', 'browser', 'refreshConsoleLabel'])
    assert.strictEqual(SA.StoryDev[key], undefined, `发行暴露剧情编辑接口 ${key}`);
  for (const key of ['set', 'save', 'toggle', 'enterEdit', 'exitEdit'])
    assert.strictEqual(SA.Text[key], undefined, `发行暴露文本编辑接口 ${key}`);
  assert.strictEqual(typeof SA.Text.get, 'function');
  assert.strictEqual(typeof SA.Text.init, 'function');
  assert.strictEqual(typeof SA.StoryDev.before, 'function');
  assert.strictEqual(typeof SA.StoryDev.after, 'function');
  assert.strictEqual(SA.StoryDev.enabled(), false, '旧开发者开关不应激活发行编辑流程');
  SA.Text.init({ game: 'steam-arena', locale: 'zh-CN', page: 'main' });
  await SA.Text.ready;
  assert.strictEqual(SA.Text.get('story:before.0,0'), textDocument.values['story:before.0,0']);
  assert.strictEqual(SA.StoryData.get('before.0,0')[0].text, '正式剧情');
  assert.strictEqual(sample.style.display, 'none', '静态文案中的元素显隐覆盖未生效');
  let played = 0, marked = 0, continued = 0;
  SA.Story.seen = () => false;
  SA.Story.mark = () => { marked++; };
  SA.Story.talk = (lines, options) => { assert.strictEqual(lines[0].text, '正式剧情'); played++; options.onDone(); };
  SA.StoryDev.before({ key: '0,0', replay: false }, () => continued++);
  SA.StoryDev.after({ key: '0,0', replay: true }, () => continued++);
  assert.deepStrictEqual({ played, marked, continued }, { played: 1, marked: 1, continued: 2 });
  const authored = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'config', 'text.json'), 'utf8'));
  const keys = Object.keys(authored.values);
  assert(keys.length > 0 || authored.removedElements.length > 0, '发行作者内容为空');
  const actual = runtime(true, new Map(), authored);
  actual.SA.Text.init({ game: 'steam-arena', locale: 'zh-CN', page: 'main' });
  await actual.SA.Text.ready;
  for (const key of keys) {
    assert.strictEqual(actual.SA.Text.get(key), authored.values[key], `作者文本未覆盖：${key}`);
  }
  return { normalStoryPlayback: played, authoredValues: keys.length,
    authoredRemovedElements: authored.removedElements.length };
}

/** 包目录只允许白名单运行文件，且脚本次序与网页入口一致。 */
function packageCheck() {
  const dir = PACKAGE;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(match => match[1]);
  // 每个资源链接都绑定当前文件内容；路径仍须落在发行白名单内。
  function checkedLink(ref) {
    const match = /^([^?]+)\?v=([0-9a-f]{64})$/.exec(ref);
    assert(match, `发行资源缺少内容哈希：${ref}`);
    assert(/^(?:js\/[A-Za-z0-9_-]+\.js|css\/[A-Za-z0-9_-]+\.css)$/.test(match[1]),
      `发行资源路径不在包内：${match[1]}`);
    const file = path.join(dir, match[1]);
    assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), match[2],
      `发行资源哈希与文件不一致：${match[1]}`);
    return match[1];
  }
  const scriptPaths = scripts.map(checkedLink);
  const stylePaths = styles.map(checkedLink);
  assert.strictEqual(scriptPaths[0], 'js/release.js', '发行标志必须最先载入');
  const configPaths = fs.readdirSync(path.join(dir, 'config')).filter(name => name.endsWith('.json')).map(name => `config/${name}`);
  const expected = new Set(['index.html', '.gitattributes', 'release-manifest.json',
    'js/stage-cars.js', ...configPaths, ...stylePaths, ...scriptPaths]);
  const found = [];
  function walk(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      // 发行目录可保留自身的 Git 元数据；游戏文件仍按白名单逐项检查。
      if (folder === dir && item.name === '.git') continue;
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else found.push(path.relative(dir, file).replaceAll('\\', '/'));
    }
  }
  walk(dir);
  assert.deepStrictEqual(found.sort(), [...expected].sort(), '发行目录含额外工具或缺少游戏文件');
  const { SA } = runtime(true);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'release-manifest.json'), 'utf8'));
  const gitAttributes = fs.readFileSync(path.join(dir, '.gitattributes'));
  assert(/(?:^|\r?\n)\* -text\r?\n$/.test(gitAttributes.toString('utf8')),
    '发行仓必须禁用 Git 文本转换');
  assert.strictEqual(crypto.createHash('sha256').update(gitAttributes).digest('hex'), manifest.gitAttributesSha256,
    '发行仓属性文件与清单哈希不一致');
  assert.strictEqual(manifest.releaseVersion, SA.RELEASE_VERSION);
  assert.strictEqual(manifest.chapters, SA.RELEASE_CHAPTERS);
  assert.strictEqual(SA.Camp.chapterCount(), SA.RELEASE_CHAPTERS);
  assert(scriptPaths.includes('js/stage-cars.js'), '关卡车脚本必须由首页按哈希直接加载');
  return { packageFiles: found.length, chapterCount: SA.RELEASE_CHAPTERS, version: SA.RELEASE_VERSION };
}

async function run() {
  return { ...progressCheck(), ...endingCheck(),
    ...await surfaceCheck(), ...packageCheck() };
}

if (process.argv[2] === '--campaign-length') {
  console.log(runtime(false).SA.CAMPAIGN.length);
} else {
  run().then(result => console.log(JSON.stringify(result, null, 2)),
    error => { console.error(error.stack || error); process.exitCode = 1; });
}
