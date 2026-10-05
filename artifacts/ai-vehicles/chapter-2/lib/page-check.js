/* 独立页面局部验证：不启动浏览器、不写存档或正式配置，逐车检验完整草稿交接。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { loadGame } = require('../../../../tools/evolve.js');
const session = require('../../../../tools/workbench-session.js');
const ROOT = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(ROOT, 'tools/ai-designs.js'), 'utf8');
const { SA } = loadGame();
const documents = [1,2,3,4,5,6].map(n => JSON.parse(fs.readFileSync(path.join(__dirname, `../ch2-0${n}-candidates.json`), 'utf8')));
const referenceNames = Object.fromEntries([...JSON.parse(fs.readFileSync(path.join(__dirname, '../references/manual-cars.json'), 'utf8')).candidates,
  ...documents.flatMap(document => document.candidates)].map(car => [car.id,car.name]));
const storage = new Map(), nodes = new Map(), location = { href: '' }; let writeRequests = 0;
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', innerHTML: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
  return nodes.get(id);
}
const browser = {
  document: { getElementById: node }, location, window: { SA },
  sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value) },
  fetch: async (url, options) => {
    if (options?.method && options.method !== 'GET') writeRequests++;
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tools', url), 'utf8')) };
  },
};
function click(id, dataset) { node(id).listeners.click({ target: { closest: () => ({ dataset }) } }); }
async function main() {
  vm.runInNewContext(source, browser);
  await new Promise(resolve => setImmediate(resolve));
  // DOM 桩不模拟HTML初值，成功路径不能写错误文本。
  assert.equal(node('load-error').textContent, '');
  let count = 0;
  for (let index = 0; index < documents.length; index++) {
    click('stage-tabs', { stage: String(index) });
    const d = documents[index];
    // 镜片既是模块要求又是唯一身份要求，呈现只列一次中文名，不泄露内部键。
    if (index === 5) {
      assert(!node('stage-summary').textContent.includes('boss_lens'));
      assert.equal(node('stage-summary').textContent.split(SA.MODULES.boss_lens.name).length - 1,1);
    }
    for (const car of d.candidates) {
      click('candidate-grid', { id: car.id });
      if (index === 5) {
        const strategy = node('candidate-details').innerHTML.match(/<dt>战术策略<\/dt><dd>(.*?)<\/dd>/)[1];
        assert(!strategy.includes('boss_lens')); assert.equal(strategy.split(SA.MODULES.boss_lens.name).length - 1,1);
      }
      if (car.battleTests) assert(node('candidate-details').innerHTML.includes(referenceNames[car.battleTests.referenceId]));
      else assert(node('candidate-details').innerHTML.includes('正式测试进行中'));
      click('open-workbench', {});
      const payload = JSON.parse(storage.get('steam_arena_stage_swap'));
      click('stage-link', {});
      assert.deepStrictEqual(JSON.parse(storage.get('steam_arena_stage_swap')), payload);
      assert.deepStrictEqual(payload.cells, car.cells);
      assert.equal(payload.style, car.style); assert.equal(payload.aim, undefined); assert.equal(payload.name, car.name);
      // 奖励提案随本关顶层数据交接；用户未保存前仍仅是草稿，不携带解锁覆盖。
      assert.deepStrictEqual(payload.rewardPlan, d.rewardPlan);
      assert.equal(payload.unlock, undefined);
      assert.equal(payload.key, d.stageId.replace(':', ','));
      assert.equal(location.href, `console.html#/stage/${payload.key}/build`);
      const restored = session.parseVehicle(JSON.stringify({cells:payload.cells}), payload.name, SA);
      // 唯一件会补齐标准look；验证原显式字段，不把合法的标准外观补齐误判为结构改变。
      const exported = JSON.parse(session.exportVehicle(restored, SA)).cells;
      const actual = exported.map(cell => JSON.stringify([...cell.slice(0,6), cell[6]?.unique || null])).sort();
      const expected = payload.cells.map(cell => JSON.stringify([...cell.slice(0,6), cell[6]?.unique || null])).sort();
      assert.equal(JSON.stringify(actual), JSON.stringify(expected));
      for (const cell of payload.cells.filter(cell => cell[6]?.look)) {
        assert.equal(exported.find(item => item[0] === cell[0] && item[1] === cell[1] && item[2] === cell[2])[6]?.look, cell[6].look);
      }
      count++;
    }
  }
  const before = JSON.parse(storage.get('sa.aiDesignSelection.v1'));
  vm.runInNewContext(source, browser); await new Promise(resolve => setImmediate(resolve));
  assert(node('candidate-details').innerHTML.includes(before.selections[documents[before.current].stageId]));
  assert.equal(writeRequests, 0);
  console.log(JSON.stringify({ candidates: count, cellsRoundTrip: true, styles: true, targetStages: true, selectionRestored: true, writeRequests }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
