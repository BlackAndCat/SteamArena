// 发行包作者内容专项检查：用本次真实保存稿比对运行时剧情、聊天与模块来源。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const settingsPath = path.join(root, 'tools/out/publish-settings.json');
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '')) : {};
// 可用“node tools/author-content-check.js <发行目录> <文案来源> <开发目录>”覆盖本机设置。
const packageRoot = path.resolve(process.argv[2] || path.join(root, 'tools/out/release'));
const sourceText = path.resolve(process.argv[3] || settings.textSource || path.join(root, 'text/steam-arena/zh-CN.json'));
const sourceRoot = path.resolve(process.argv[4] || settings.sourceRoot || root);
const packagedText = path.join(packageRoot, 'text/steam-arena/zh-CN.json');
const packagedModules = path.join(packageRoot, 'js/modules.js');
assert.deepEqual(fs.readFileSync(packagedText), fs.readFileSync(sourceText), '发行文案必须逐字来自作者保存稿');
assert.deepEqual(fs.readFileSync(packagedModules), fs.readFileSync(path.join(sourceRoot, 'js/modules.js')),
  '模块数据必须逐字来自当前设计稿');
assert.deepEqual(fs.readFileSync(path.join(packageRoot, 'js/stage-cars.js')),
  fs.readFileSync(path.join(sourceRoot, 'js/stage-cars.js')), '关卡车必须逐字来自当前设计稿');

const document = JSON.parse(fs.readFileSync(sourceText, 'utf8').replace(/^\uFEFF/, ''));
const values = document.values;
assert(values && typeof values === 'object' && !Array.isArray(values), '作者保存稿缺少 values');
assert(Array.isArray(document.removedElements), '作者保存稿缺少 removedElements');
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
  assert.deepEqual(plain(context.SA.YardChat.read(scope).groups), savedRows(values[key]), `${scope} 闲谈未按作者稿呈现`);
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
const emptyChatKey = chatKeys[0] || 'home:chat:pool:global';
const originalChat = values[emptyChatKey];
values[emptyChatKey] = '';
assert.deepEqual(plain(context.SA.YardChat.read(emptyChatKey.slice('home:chat:pool:'.length)).groups), [],
  '空字符串闲谈不能回退默认池');
if (originalChat === undefined) delete values[emptyChatKey];
else values[emptyChatKey] = originalChat;

console.log(`作者内容检查通过：${Object.keys(values).length} 项覆盖、${storyKeys.length} 个剧情、`
  + `${chatKeys.length} 个闲谈池、${document.removedElements.length} 个隐藏元素；模块逐字一致`);
