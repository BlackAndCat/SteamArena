/* 预算独立保存回归：执行真实工具函数，仅使用 mock HTTP，不写作者配置、不启动浏览器。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function element(tag, attrs = {}, ...children) {
  let value = String(attrs?.value ?? '');
  const node = { tag, attrs, children: children.flat().filter(x => x != null), events: {}, disabled: !!attrs?.disabled,
    addEventListener(type, callback) { this.events[type] = callback; },
    get value() { return value; }, set value(v) { value = String(v); },
    textContent: attrs?.text || '' };
  return node;
}

async function run() {
  let currentBudget = 830, conflict = false, refreshes = 0;
  const posts = [];
  const fetch = async (url, options = {}) => {
    if (!options.method) return { ok: true, json: async () => ({ budgets: currentBudget == null ? [] : [{ chapter: 1, stage: 5, budget: currentBudget }], chapters: [] }) };
    assert.strictEqual(url, '/__evolve/budget/save');
    const payload = JSON.parse(options.body); posts.push(payload);
    if (conflict) { currentBudget = 900; return { ok: false, status: 409, json: async () => ({ error: '预算已被其他操作修改', budget: 900 }) }; }
    currentBudget = payload.budget;
    return { ok: true, status: 200, json: async () => ({ ok: true, budget: currentBudget }) };
  };
  const garage = { fetch, SA: { Editor: { refresh() { refreshes++; } }, h: element } };
  vm.createContext(garage);
  const garageSource = fs.readFileSync(require.resolve('./console-garage'), 'utf8');
  vm.runInContext('var opened = true, budgetCatalog = null; const budgetDrafts = new Map(), budgetMessages = new Map(); const current = () => ({ci:1,si:5});\n' +
    garageSource.slice(garageSource.indexOf('  async function reloadBudget('), garageSource.indexOf('  // 工具页没有')), garage);
  await garage.reloadBudget();
  await garage.saveBudget({ ci: 1, si: 5 }, 830, '830');
  assert.deepStrictEqual(posts.at(-1), { chapter: 1, stage: 5, budget: 830, expectedBudget: 830 });
  vm.runInContext("budgetDrafts.set('1:5', '1200')", garage);
  conflict = true;
  const count = posts.length;
  await garage.saveBudget({ ci: 1, si: 5 }, 830, '1200');
  assert.strictEqual(posts.length, count + 1, '冲突不得自动重试覆盖');
  assert.strictEqual(vm.runInContext("budgetDrafts.get('1:5')", garage), '1200');
  assert(vm.runInContext("budgetMessages.get('1:5')", garage).includes('最新上限 £900'));
  assert(refreshes > 0);

  // 控制台地图与资料小表单：未配置计划关独立保存，随后冲突保留输入并更新期望版本。
  conflict = false; currentBudget = null;
  const consoleContext = { fetch, el: element, garageApi: () => ({ reloadBudget() { refreshes++; } }) };
  vm.createContext(consoleContext);
  const source = fs.readFileSync(require.resolve('./console'), 'utf8');
  vm.runInContext('var budgetCatalogRequest = null;\n' + source.slice(source.indexOf('  function budgetCatalog('), source.indexOf('  try {\n    const channel = new BroadcastChannel(\'steam-arena-evolve-budget\')')), consoleContext);
  const root = consoleContext.budgetEditor(1, 5);
  await new Promise(resolve => setImmediate(resolve));
  const input = root.children[0].children[1], button = root.children[1], status = root.children[2];
  assert(status.textContent.includes('未配置') && !button.disabled);
  input.value = '830'; await button.events.click();
  assert.deepStrictEqual(posts.at(-1), { chapter: 1, stage: 5, budget: 830, expectedBudget: null });
  conflict = true; input.value = '1200';
  await button.events.click();
  assert.strictEqual(input.value, '1200');
  assert(status.textContent.includes('最新上限 £900'));
  conflict = false; await button.events.click();
  assert.strictEqual(posts.at(-1).expectedBudget, 900, '用户再保存须基于已显示的新预算');
  assert(!posts.some(row => 'record' in row || 'rewardItems' in row), '预算请求不得携带车辆或奖励');
  return { separateBudgetSave: true, unconfiguredPlan: true, conflictPreservesDraft: true, noAutomaticOverwrite: true };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
