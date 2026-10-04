/** 自测页面记忆回归：执行真实 sim.js，使用最小 DOM 和数值夹具，不运行战斗。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const key = 'steam_arena_sim_memory_v1';
const source = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8').replace(
  '  // ---------- 界面 ----------', '  globalThis.simCheck = { runJobs };\n  // ---------- 界面 ----------');
function boot(storage, unavailable = false) {
  function h(tag, attrs = {}, ...items) {
    const node = { nodeType: 1, tagName: tag.toUpperCase(), className: attrs.class || '',
      childNodes: [], style: {}, value: attrs.value == null ? '' : String(attrs.value), checked: false,
      disabled: false, parentElement: {}, listeners: {},
      getAttribute: name => attrs[name] || '',
      append(...children) {
        this.childNodes.push(...children.flat(Infinity).filter(x => x != null).map(x => typeof x === 'object' ? x : { nodeType: 3, textContent: String(x) }));
        if (this.tagName === 'SELECT' && !this.value && this.childNodes.length) this.value = this.childNodes[0].value;
      }, replaceChildren(...children) { this.childNodes = []; this.append(...children); },
      addEventListener(event, fn) { this.listeners[event] = fn; },
      checkValidity() {
        if (this.tagName !== 'INPUT') return true;
        const n = Number(this.value), step = Number(attrs.step || 1), min = Number(attrs.min || 0);
        return this.value !== '' && Number.isFinite(n) && n >= min && n <= Number(attrs.max || Infinity) && Math.abs((n - min) / step - Math.round((n - min) / step)) < 1e-8;
      }, get options() { return this.childNodes; },
      get textContent() { return this.childNodes.map(x => x.textContent).join(' '); },
      set textContent(value) { this.childNodes = [{ nodeType: 3, textContent: String(value) }]; },
      set innerHTML(_value) { this.childNodes = []; },
    };
    node.append(...items);
    return node;
  }
  const nodes = Object.fromEntries(['out', 'bar', 'prog', 'run-camp', 'run-matrix', 'run-value', 'run-build'].map(id => [id, h('div')]));
  Object.assign(nodes, { games: h('input', { value: 50, min: 2, max: 200 }),
    aim: h('input', { value: 0.8, min: 0.2, max: 1, step: 0.05 }),
    ter: h('select', {}, h('option', { value: '' }, '自带')),
    pool: h('select', {}, ...['ref', 'boss', 'mix', 'all', 'bp'].map(value => h('option', { value }, value))),
    mine: h('input'), mat: h('select') });
  const context = { SA: { h, MODULES: { plate: { name: '甲片', hp: 10 } }, MODULE_ORDER: ['plate'],
    K: { FAST_RELOAD: 1 }, MATS: [null, { name: '木材' }, { name: '熟铁' }],
    TERRAIN_ORDER: ['flat', 'hills'], TERRAINS: { flat: { name: '平地' }, hills: { name: '丘陵' } },
    mod: () => ({ hp: 10 }), cellValue: () => 5, weightOf: () => 1000,
  }, document: { querySelector: selector => nodes[selector.slice(1)] },
  localStorage: { getItem(name) { if (unavailable) throw new Error('禁止存储'); return storage[name] || null; },
    setItem(name, value) { if (unavailable) throw new Error('禁止存储'); storage[name] = value; } },
  window: { addEventListener() {} }, performance: { now: () => 0 }, setTimeout: () => { throw new Error('不应异步运行战斗'); } };
  vm.runInNewContext(source, context);
  return { nodes, context };
}
const storage = { steam_arena_save_v2: JSON.stringify({ vehicle: { name: '存档车' } }), blueprint: '保留' };
let page = boot(storage);
assert.ok(page.nodes.out.textContent.includes('模块性价比'));
page.nodes.games.value = '100'; page.nodes.aim.value = '0.65'; page.nodes.ter.value = 'hills';
page.nodes.pool.value = 'boss'; page.nodes.mat.value = '2'; page.nodes.mine.checked = true;
page.nodes.games.listeners.change(); page.nodes['run-value'].onclick();
const original = page.nodes.out.textContent;
page = boot(storage);
assert.equal(page.nodes.games.value, '100'); assert.equal(page.nodes.aim.value, '0.65');
assert.equal(page.nodes.ter.value, 'hills'); assert.equal(page.nodes.pool.value, 'boss');
assert.equal(page.nodes.mat.value, '2'); assert.equal(page.nodes.mine.checked, true);
assert.equal(page.nodes.out.textContent, original); assert.ok(page.nodes.prog.textContent.includes('未重新运行'));
// 完成结果保存来自真实调度函数，随后未完成的新任务不会抹掉旧结果。
page.context.simCheck.runJobs([() => {}], () => { page.nodes.out.replaceChildren({ nodeType: 3, textContent: '完成结果' }); });
assert.equal(boot(storage).nodes.out.textContent, '完成结果');
let clock = 0, queued = false;
page.context.performance.now = () => (clock += 25);
page.context.setTimeout = () => { queued = true; };
page.context.simCheck.runJobs([() => {}, () => {}], () => { throw new Error('未完成时不应保存结果'); });
assert.equal(queued, true);
assert.equal(boot(storage).nodes.out.textContent, '完成结果');
const saved = JSON.parse(storage[key]); saved.settings.games = '999'; saved.settings.aim = '0.63'; saved.settings.pool = 'future';
saved.result.nodes = [{ tag: 'script', cls: '', title: '', children: ['执行注入'] }]; storage[key] = JSON.stringify(saved);
page = boot(storage);
assert.equal(page.nodes.games.value, '50'); assert.equal(page.nodes.aim.value, '0.8'); assert.equal(page.nodes.pool.value, 'ref');
assert.ok(!page.nodes.out.textContent.includes('执行注入'));
storage[key] = '{损坏'; assert.doesNotThrow(() => boot(storage)); assert.doesNotThrow(() => boot(storage, true));
assert.equal(storage.blueprint, '保留'); assert.equal(JSON.parse(storage.steam_arena_save_v2).vehicle.name, '存档车');
console.log('自测记忆通过：设置与完成结果恢复、不重跑、合法性校验、注入拒绝、损坏/禁用存储降级、游戏存档不变。');
