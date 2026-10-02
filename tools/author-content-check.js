// 发行包作者内容专项检查：用本次真实保存稿比对运行时剧情、聊天与模块来源。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
// 所有运行文件和正式文案来自同一 sourceRoot 的当前保存稿。
const packageRoot = path.resolve(process.argv[2] || path.join(root, 'tools/out/release'));
const sourceRoot = path.resolve(process.argv[3] || root);
const sourceText = path.join(sourceRoot, 'text/steam-arena/zh-CN.json');
const packagedText = path.join(packageRoot, 'text/steam-arena/zh-CN.json');
const packagedModules = path.join(packageRoot, 'js/modules.js');
assert.deepEqual(fs.readFileSync(packagedText), fs.readFileSync(sourceText), '发行文案必须逐字来自作者保存稿');
assert.deepEqual(fs.readFileSync(packagedModules), fs.readFileSync(path.join(sourceRoot, 'js/modules.js')),
  '模块数据必须逐字来自当前设计稿');
assert.deepEqual(fs.readFileSync(path.join(packageRoot, 'js/stage-cars.js')),
  fs.readFileSync(path.join(sourceRoot, 'js/stage-cars.js')), '关卡车必须逐字来自当前设计稿');

const document = JSON.parse(fs.readFileSync(sourceText, 'utf8').replace(/^\uFEFF/, ''));
const values = document.values;
assert.equal(document.version, 1, '作者保存稿版本无效');
assert.equal(document.game, 'steam-arena', '作者保存稿游戏标识无效');
assert.equal(document.locale, 'zh-CN', '作者保存稿语言无效');
assert(values && typeof values === 'object' && !Array.isArray(values), '作者保存稿缺少 values');
assert(Array.isArray(document.removedElements), '作者保存稿缺少 removedElements');
for (const [key, value] of Object.entries(values)) {
  assert(key && typeof value === 'string', `作者保存稿记录无效：${key}`);
}
for (const path of document.removedElements) {
  assert(typeof path === 'string' && path, '作者保存稿隐藏元素路径无效');
}
const storyKeys = Object.keys(values).filter(key => key.startsWith('story:'));
const chatKeys = Object.keys(values).filter(key => key.startsWith('home:chat:pool:'));

const context = { SA: { RELEASE: true, LEG_VARIANTS: [] } };
context.window = context;
vm.runInNewContext(fs.readFileSync(path.join(packageRoot, 'js/content.js'), 'utf8'), context);
const storySource = fs.readFileSync(path.join(packageRoot, 'js/story.js'), 'utf8');
vm.runInNewContext(storySource.slice(0, storySource.indexOf('SA.Story =')), context);
context.SA.Text = {
  has: key => Object.hasOwn(values, key),
  get: (key, fallback = '') => Object.hasOwn(values, key) ? values[key] : fallback,
};
const managerSource = fs.readFileSync(path.join(packageRoot, 'js/text-manager.js'), 'utf8');
vm.runInNewContext(managerSource.slice(managerSource.indexOf('SA.StoryData =')), context);
vm.runInNewContext(fs.readFileSync(path.join(packageRoot, 'js/yard-chat.js'), 'utf8'), context);

const plain = value => JSON.parse(JSON.stringify(value));
const savedRows = raw => raw === '' ? [] : JSON.parse(raw);
// 每个真实作者剧情场景都应完整覆盖默认稿；开场非空时另验首句、末句。
for (const key of storyKeys) {
  const id = key.slice('story:'.length);
  assert.deepEqual(plain(context.SA.StoryData.get(id)), savedRows(values[key]), `${id} 未按作者稿呈现`);
}
if (Object.hasOwn(values, 'story:opening')) {
  const rows = savedRows(values['story:opening']);
  const actual = context.SA.StoryData.get('opening');
  assert.equal(actual[0]?.text, rows[0]?.text, '开场首句应来自作者稿');
  assert.equal(actual.at(-1)?.text, rows.at(-1)?.text, '开场末句应来自作者稿');
}
for (const key of chatKeys) {
  const scope = key.slice('home:chat:pool:'.length);
  const rows = savedRows(values[key]);
  assert(Array.isArray(rows), `${key} 必须是聊天数组`);
  assert.deepEqual(plain(context.SA.YardChat.read(scope).groups), rows, `${scope} 闲谈未按作者稿呈现`);
}
if (Object.hasOwn(values, 'home:chat:settings')) {
  const settings = JSON.parse(values['home:chat:settings']);
  assert.deepEqual(plain(context.SA.YardChat.settings()), settings, '整体聊天设置未按作者稿呈现');
}

// 缺键才能回退默认；空字符串和 [] 都是作者显式清空，测试后恢复内存快照。
const missing = context.SA.StoryData.list().find(id => !Object.hasOwn(values, `story:${id}`));
if (missing) {
  const key = `story:${missing}`;
  const fallback = plain(context.SA.StoryData.get(missing));
  values[key] = '';
  assert.deepEqual(plain(context.SA.StoryData.get(missing)), [], '空字符串剧情不能回退默认稿');
  delete values[key];
  assert.deepEqual(plain(context.SA.StoryData.get(missing)), fallback, '缺键剧情应回退默认稿');
}
const emptyChatKey = 'home:chat:pool:global';
const originalChat = values[emptyChatKey];
values[emptyChatKey] = '';
assert.deepEqual(plain(context.SA.YardChat.read('global').groups), [],
  '空字符串闲谈不能回退默认池');
values[emptyChatKey] = '[]';
assert.deepEqual(plain(context.SA.YardChat.read('global').groups), [],
  '显式空数组闲谈不能回退默认池');
delete values[emptyChatKey];
assert(context.SA.YardChat.read('global').groups.length > 0,
  '未覆盖闲谈应使用默认池');
if (originalChat !== undefined) values[emptyChatKey] = originalChat;

console.log(`作者内容检查通过：${Object.keys(values).length} 项覆盖、${storyKeys.length} 个剧情、`
  + `${chatKeys.length} 个闲谈池、${document.removedElements.length} 个隐藏元素；模块逐字一致`);
