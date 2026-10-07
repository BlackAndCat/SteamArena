/* 工具交互专项：正式规则 + 最小 DOM，在内存中验证草稿、模拟及保存失败，不触碰配置或存档。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 最小 DOM 只承载本工具的输入和表格；不初始化游戏界面或画面战斗。 */
function element(tag = 'div') {
  const listeners = {};
  return {
    tagName: tag, children: [], value: '', disabled: false, textContent: '', className: '', width: 1000, height: 220,
    append(...items) { this.children.push(...items); if (tag === 'select' && this.value === '' && items.length) this.value = String(items[0].value); },
    replaceChildren(...items) { this.children = items; },
    addEventListener(type, action) { listeners[type] = action; },
    dispatch(type) { assert(listeners[type], `缺少事件 ${type}`); listeners[type](); },
    getContext() { return { clearRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; },
  };
}

/** 使用真实 StageCars 车作当前存档，比较读写次数与草稿经过模拟后的可保存性。 */
async function run() {
  const { SA, context } = loadGame();
  for (const file of ['js/route-data.js', 'js/route.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  assert.equal(typeof SA.Route.getConfig, 'function', '请先同步本轮核心接口');
  const vehicle = SA.StageCars.vehicle(SA.StageCars.get(0, 0), '当前存档测试车');
  const stored = JSON.stringify({ vehicle }), originalConfig = JSON.stringify(SA.Route.getConfig());
  let writes = 0, savedPayload, simulation;
  const realSimulate = SA.Route.simulate;
  SA.Route.simulate = options => { simulation = realSimulate(options); return simulation; };
  context.localStorage = { getItem(key) { assert.equal(key, 'steam_arena_save_v2'); return stored; }, setItem() { writes++; }, removeItem() { writes++; } };
  const elements = {};
  for (const id of ['route', 'vehicle', 'seed', 'budget', 'capacityPerKw', 'kgPerKj', 'idleKw', 'routeName', 'len', 'endX', 'bonus',
    'status', 'planSummary', 'planNodes', 'json', 'simulationSummary', 'events', 'samples', 'chart', 'encounters', 'pickups',
    'preview', 'save', 'simulate', 'addEncounter', 'addPickup'])
    elements[id] = element(['route', 'vehicle'].includes(id) ? 'select' : id === 'chart' ? 'canvas' : 'div');
  elements.seed.value = '1'; elements.budget.value = '200'; elements.save.disabled = true;
  context.document = { getElementById: id => elements[id], createElement: element, querySelectorAll: () => Object.values(elements) };
  context.requestAnimationFrame = action => { action(); }; context.setTimeout = action => { action(); };
  context.fetch = async (url, options) => {
    assert.equal(url, '/__config/save'); savedPayload = JSON.parse(options.body);
    return { ok: false, status: 400, json: async () => ({ error: '测试保存拒绝' }) };
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'route-tuner.js'), 'utf8'), context, { filename: 'route-tuner.js' });
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  assert(elements.vehicle.children[0].textContent.includes('当前存档车'));
  const initialRows = elements.pickups.children.length;
  elements.addPickup.dispatch('click'); assert.equal(elements.pickups.children.length, initialRows + 1);
  const newRow = elements.pickups.children.at(-1);
  newRow.children.at(-1).children[0].dispatch('click'); assert.equal(elements.pickups.children.length, initialRows);
  elements.addEncounter.dispatch('click');
  elements.encounters.children.at(-1).children.at(-1).children[0].dispatch('click');
  elements.preview.dispatch('click'); await flush();
  assert.equal(elements.save.disabled, false, elements.status.textContent);
  const preview = elements.json.textContent;
  assert.equal(preview, JSON.stringify(JSON.parse(originalConfig), null, 2));
  elements.simulate.dispatch('click'); await flush();
  assert(elements.simulationSummary.textContent.includes('实际结束原因'), elements.status.textContent);
  const cause = simulation.result?.cause || simulation.cause || simulation.reason;
  assert(elements.simulationSummary.textContent.includes(`实际结束原因：${cause}`));
  const cleared = Array.isArray(simulation.cleared) ? simulation.cleared.length : simulation.cleared;
  assert(elements.simulationSummary.textContent.includes(`清除敌人数：${cleared}`));
  assert.equal(elements.save.disabled, false, '模拟后仍可保存已预览草稿');
  assert(elements.samples.children.length > 0, '缺少真实资源样本');
  elements.save.dispatch('click'); await flush();
  assert(elements.status.textContent.includes('草稿保留'), elements.status.textContent);
  assert.equal(elements.json.textContent, preview);
  assert.equal(savedPayload.name, 'routes');
  assert.equal(JSON.stringify(savedPayload.data), originalConfig);
  assert.equal(writes, 0, '工具不应写玩家存档');
  elements.len.value = String(SA.Route.getConfig().routes[0].len + 1); elements.len.dispatch('input');
  assert.equal(elements.save.disabled, true, '修改后必须重新预览');
  assert.equal(writes, 0);
  console.log('出征工具专项通过：正式车辆/新增删除/真实模拟/失败草稿/存档零写');
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
