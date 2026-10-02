/* 院子聊天数据与调度的隔离回归；复制正式配置到内存，不修改源文件。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configured = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/text.json'), 'utf8'));
const values = new Map(Object.entries(configured.values)), channels = [];
for (const key of values.keys()) if (key.startsWith('home:chat:pool:') && key !== 'home:chat:pool:default') values.delete(key);
values.set('home:chat:settings', JSON.stringify({ intervalSec: 3.3, bubbleSec: 3.3, replySec: 3.3 }));
let saveOk = true, loaded = 0;
class Channel {
  constructor(name) { this.name = name; channels.push(this); }
  postMessage(value) { channels.filter(peer => peer !== this && peer.name === this.name).forEach(peer => peer.onmessage?.({ data: value })); }
  close() { channels.splice(channels.indexOf(this), 1); }
}
const text = {
  ready: Promise.resolve(),
  get: (key, fallback = '') => values.get(key) ?? fallback,
  set: (key, value) => values.set(key, value),
  remove: key => values.delete(key),
  save: async () => ({ ok: saveOk, document: saveOk ? { version: 1, game: 'steam-arena', locale: 'zh-CN', values: Object.fromEntries(values), removedElements: [] } : undefined }),
  load: async () => { loaded++; },
};
const SA = { Text: text, Config: { get: () => configured }, S: { d: { camp: { ch: 0, st: 0 } } }, CAMPAIGN: [{ stages: [{ name: '一关' }, { name: '二关' }] }, { stages: [{ name: '三关' }] }],
  Camp: { current: () => ({ name: '当前敌手' }) } };
const context = vm.createContext({ window: { SA }, SA, BroadcastChannel: Channel });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/yard-chat.js'), 'utf8'), context);
const chat = SA.YardChat;
const plain = value => JSON.parse(JSON.stringify(value));
const group = (id, weight = 1, cooldownSec = 0, lines = [{ who: 'tom', text: id, action: 'talk' }]) =>
  ({ id, name: id, weight, cooldownSec, weather: 'any', lines });

async function run() {
  assert.strictEqual(chat.currentScope(), 'stage:0:0');
  assert.strictEqual(chat.read('stage:0:0').source, 'default');
  const defaultGroups = JSON.parse(configured.values['home:chat:pool:default']);
  assert.deepStrictEqual(plain(chat.read('global').groups), defaultGroups);
  // 对照配置中各天气可播组的顺序，不把具体台词重复写进检查器。
  for (const [weatherIndex, weather] of ['sun', 'rain', 'night'].entries()) {
    const expected = defaultGroups.filter(item => item.weather === 'any' || item.weather === weather)
      .map(item => item.lines[0].text.replaceAll('{关卡名}', '当前敌手'));
    const player = chat.createPlayer('global');
    const played = expected.map((_, i) => player.step(1000 + weatherIndex * 1000 + i * 3.4, weather).line.text);
    assert.deepStrictEqual(played, expected, `${weather} 默认台词没有保持旧院子的实际播放顺序`);
  }
  chat.write('global', [group('global')]);
  assert.strictEqual(chat.read('stage:0:0').source, 'global');
  chat.write('chapter:0', [group('chapter')]);
  assert.strictEqual(chat.read('stage:0:0').source, 'chapter:0');
  chat.write('stage:0:0', [group('stage')]);
  assert.strictEqual(chat.read('stage:0:0').groups[0].id, 'stage');
  chat.inherit('stage:0:0');
  assert.strictEqual(chat.read('stage:0:0').source, 'chapter:0');
  assert.throws(() => chat.write('stage:0:0', [group('same'), group('same')]), /重复/);
  assert.throws(() => chat.validateGroups([group('same'), group('same')]), /重复/);
  assert.strictEqual(chat.validateGroups([group('copy')])[0].id, 'copy');
  assert.throws(() => chat.setSettings({ bubbleSec: -1 }), /气泡/);
  assert.throws(() => chat.validateSettings({ intervalSec: 3, replySec: 1, bubbleSec: -1 }), /气泡/);
  assert.strictEqual(chat.validateSettings({ intervalSec: 3, replySec: 1, bubbleSec: 0.5 }).replySec, 1);
  chat.setSettings({ intervalSec: 3, replySec: 1, bubbleSec: 0.5 });
  chat.write('stage:0:0', [group('exchange', 1, 0, [
    { who: 'tom', text: '第一句', action: 'talk' }, { who: 'tim', text: '第二句', action: 'yelp' },
  ])]);
  let player = chat.createPlayer('stage:0:0');
  assert.strictEqual(player.step(100, 'sun').line.text, '第一句');
  assert.strictEqual(player.step(100.6, 'sun').expired, true, '气泡应独立到期');
  player.force('rel', '<b>当前提示</b>');
  assert.strictEqual(player.step(100.7, 'sun').line.trustedHtml, true, '点击提示应抢先显示');
  assert.strictEqual(player.step(101.8, 'sun').line.text, '第二句', '点击提示后成套对答仍应继续');
  chat.write('stage:0:0', [group('a', 1, 0), group('b', 2, 0)]);
  player = chat.createPlayer('stage:0:0');
  const picks = [];
  for (let i = 0; i < 12; i++) picks.push(player.step(200 + i * 3.1, 'sun').line.text);
  assert.strictEqual(picks.filter(id => id === 'a').length, 4, '平滑权重比例应为 1:2');
  assert.strictEqual(picks.filter(id => id === 'b').length, 8);
  chat.write('stage:0:0', [group('cool', 1, 20), group('free', 1, 0)]);
  player = chat.createPlayer('stage:0:0');
  assert.strictEqual(player.step(300, 'sun').line.text, 'cool');
  assert.strictEqual(player.step(303.1, 'sun').line.text, 'free');
  assert.strictEqual(chat.createPlayer('stage:0:0').step(304, 'sun').line.text, 'free', '重建院子仍遵守单组冷却');
  chat.write('stage:0:0', [group('dynamic', 1, 0, [{ who: 'tom', text: '准备打「{关卡名}」', action: 'talk' }])]);
  assert.strictEqual(chat.createPlayer('stage:0:0').step(400, 'sun').line.text, '准备打「当前敌手」');
  assert.strictEqual(chat.read('stage:0:0').groups[0].lines[0].text, '准备打「{关卡名}」', '保存的必须是模板');
  assert.strictEqual((await chat.save()).ok, true);
  assert.strictEqual(loaded, 1, '成功保存应通知游戏重读');
  saveOk = false;
  assert.strictEqual((await chat.save()).ok, false);
  assert.strictEqual(loaded, 1, '失败不能通知游戏覆盖草稿');
  assert.deepStrictEqual(plain(chat.settings()), { intervalSec: 3, replySec: 1, bubbleSec: 0.5 });
  return { defaultOrder: true, inheritance: true, exchange: true, weightedRoundRobin: true, cooldown: true,
    bubbleExpiry: true, priorityTip: true, template: true, saveNotice: true };
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
