// 发行包内容专项检查：正式配置逐字节一致，剧情、闲谈和关卡车可由配置读取。
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { install: installConfig } = require('./config-node');
const evolve = require('./evolve');

const root = path.resolve(__dirname, '..');
const packageRoot = path.resolve(process.argv[2] || path.join(root, 'tools/out/release'));
const sourceRoot = path.resolve(process.argv[3] || root);
const configNames = fs.readdirSync(path.join(sourceRoot, 'config')).filter(name => name.endsWith('.json')).sort();
assert(configNames.length > 0, '正式配置目录为空');
for (const name of configNames)
  assert.deepEqual(fs.readFileSync(path.join(packageRoot, 'config', name)),
    fs.readFileSync(path.join(sourceRoot, 'config', name)), `${name} 未逐字节进入发行包`);
assert.deepEqual(fs.readFileSync(path.join(packageRoot, 'js/stage-cars.js')),
  fs.readFileSync(path.join(sourceRoot, 'js/stage-cars.js')), '关卡车入口未逐字节进入发行包');

const context = { SA: { RELEASE: true } };
context.window = context;
installConfig(context, packageRoot);
const text = context.SA.Config.get('text');
assert(text.values && typeof text.values === 'object' && Array.isArray(text.removedElements));
const game = evolve.loadGame().SA;
context.SA.CAMPAIGN = game.CAMPAIGN;
context.SA.Text = { get: (key, fallback = '') => Object.hasOwn(text.values, key) ? text.values[key] : fallback };
const storySource = fs.readFileSync(path.join(packageRoot, 'js/story.js'), 'utf8');
vm.runInNewContext(storySource.slice(0, storySource.indexOf('SA.Story =')), context);
const managerSource = fs.readFileSync(path.join(packageRoot, 'js/text-manager.js'), 'utf8');
vm.runInNewContext(managerSource.slice(managerSource.indexOf('SA.StoryData =')), context);
vm.runInNewContext(fs.readFileSync(path.join(packageRoot, 'js/yard-chat.js'), 'utf8'), context);
const plain = value => JSON.parse(JSON.stringify(value));
for (const [key, raw] of Object.entries(text.values)) {
  if (key.startsWith('story:')) {
    const id = key.slice(6);
    if (context.SA.StoryData.list().includes(id)) {
      const expected = JSON.parse(raw).map(line => typeof line === 'string'
        ? { text: line, ...((id.startsWith('stage.') || id.startsWith('feat.')) ? { who: 'uncle' } : {}) } : line);
      assert.deepEqual(plain(context.SA.StoryData.get(id)), expected, `${id} 未按正式配置呈现`);
    }
  }
  if (key.startsWith('home:chat:pool:')) {
    const scope = key.slice('home:chat:pool:'.length);
    if (scope !== 'default')
      assert.deepEqual(plain(context.SA.YardChat.read(scope).groups), JSON.parse(raw), `${scope} 闲谈未按正式配置呈现`);
  }
}
assert.deepEqual(plain(context.SA.YardChat.settings()), JSON.parse(text.values['home:chat:settings']));
for (let ci = 0; ci < context.SA.CAMPAIGN.length; ci++) {
  for (let si = 0; si < context.SA.CAMPAIGN[ci].stages.length; si++) {
    if (context.SA.CAMPAIGN[ci].stages[si].unfinished) continue;   // 跳过去先做后面的关时留下的占位空关
    const stage = evolve.stageFor(game, ci, si);
    assert(stage?.vehicle || stage?.rows, `关卡 ${ci},${si} 缺少有效车辆`);
  }
}
console.log(`作者内容检查通过：${configNames.length} 份配置逐字节一致，剧情、闲谈与关卡车可读`);
