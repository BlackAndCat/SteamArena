/** 原点比较旧报告兼容回归：运行报告页真实选关表渲染函数，不启动浏览器或战斗。 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 最小 DOM 只保存文本；缩略图解析返回空，不涉及视觉绘制。
function element(_tag, _attrs, ...children) {
  const node = { attrs: _attrs, children: [], append(...items) {
    this.children.push(...items.flat(Infinity).filter(item => item != null));
  }, get textContent() {
    return this.children.map(item => typeof item === 'object' ? item.textContent : String(item)).join(' ');
  } };
  node.append(...children);
  return node;
}
const source = fs.readFileSync(path.join(__dirname, 'evolve-report.js'), 'utf8');
const anchor = '  // ---------- 散点图：';
assert.equal(source.split(anchor).length, 2, '报告页测试挂载锚点必须唯一');
const context = { SA: {
  h: element, CAMPAIGN: [{ name: '第一章 · 测试', stages: [] }],
  MODULES: {}, TERRAINS: {}, V: { fromCells: () => null, decode: () => null },
}, document: { querySelector: () => element('div', {}) },
  location: { hash: '' }, localStorage: { getItem: () => null, setItem() {} } };
// 在启动页面事件与网络读取之前暴露已有函数；生产文件不添加测试接口。
vm.runInNewContext(source.split(anchor)[0] + '\n globalThis.reportCheck = { st, picks, budgetBlock, setCatalog: value => { runCatalog = value; } };\n})();', context);
const render = report => {
  context.reportCheck.st.report = report;
  return context.reportCheck.picks().textContent;
};
const report = comparison => ({ chapters: [{ chapter: 0, stages: [{
  spec: { name: '测试关卡', stage: 3 }, selected: null,
  ...(comparison === undefined ? {} : { originComparison: comparison }),
}] }] });
const comparison = { name: '煤灰寡妇', winRate: 0.7083, games: 12, wins: 8, draws: 1 };
let text = render(report(comparison));
assert.ok(text.includes('煤灰寡妇') && text.includes('71% · 12 局'));
assert.ok(!text.includes('undefined') && !text.includes('NaN'));
text = render(report({ ...comparison, origin: { chapter: 0, stage: 2 } }));
assert.ok(text.includes('煤灰寡妇 · 第一章第 3 关'));
assert.doesNotThrow(() => render(report(undefined)));
assert.ok(render(report({ ...comparison, origin: { chapter: 0 } })).includes('煤灰寡妇'));
assert.ok(render(report({ winRate: 0.5, games: 2 })).includes('原点车'));

// 新报告的空必带数组必须屏蔽旧关卡奖励，旧报告仍保留回退兼容。
context.SA.CAMPAIGN[0].stages[3] = { spec: { reward: 'biped' } };
context.SA.MODULES.biped = { name: '旧双足奖励' };
context.SA.MODULES.spike = { name: '作者刺钉奖励' };
const emptyRewards = report(undefined);
emptyRewards.chapters[0].stages[0].spec = { name: '测试关卡', stage: 3, requiredModules: [], rewardModule: 'biped' };
assert.ok(!render(emptyRewards).includes('旧双足奖励'), '明确空奖励仍回显旧预设');
emptyRewards.chapters[0].stages[0].spec.requiredModules = ['spike'];
assert.ok(render(emptyRewards).includes('作者刺钉奖励') && !render(emptyRewards).includes('旧双足奖励'));
assert.ok(render(report(undefined)).includes('旧双足奖励'), '旧报告奖励兼容失效');

// 预算提示运行真实共用函数：当前目录覆盖历史上限，超限仅警示，零上限不能误判为未配置。
const rec = { spec: { chapter: 1, stage: 5, budget: 9999 }, stats: { value: 1287 } };
const catalog = budget => ({ chapters: [{ chapter: 1, stages: [{ stage: 5, budget }] }] });
context.reportCheck.setCatalog(catalog(830));
let budget = context.reportCheck.budgetBlock(rec);
assert.ok(budget.attrs.class.includes('bad') && budget.textContent.includes('£1287 / 预算上限 £830'));
assert.ok(budget.textContent.includes('超出 £457，仅提示，仍可参与进化'));
budget = context.reportCheck.budgetBlock({ ...rec, stats: { value: 830 } });
assert.ok(!budget.attrs.class.includes('bad') && !budget.textContent.includes('超出'));
context.reportCheck.setCatalog(catalog(0));
budget = context.reportCheck.budgetBlock({ ...rec, stats: { value: 1 } });
assert.ok(budget.attrs.class.includes('bad') && budget.textContent.includes('预算上限 £0'));
context.reportCheck.setCatalog(null);
assert.ok(context.reportCheck.budgetBlock(rec).textContent.includes('预算上限 £9999'));
assert.ok(context.reportCheck.budgetBlock({ stats: { value: 0 } }).textContent.includes('暂不可用'));
context.reportCheck.setCatalog({ chapters: [] });
assert.ok(context.reportCheck.budgetBlock({ stats: { value: 0 } }).textContent.includes('未配置'));

// 工作台直接执行自身预算块，确认实时造价变化与同一预算缓存比较，缺目录不当零预算。
const garageSource = fs.readFileSync(path.join(__dirname, 'console-garage.js'), 'utf8');
const garage = { SA: { h: element } };
vm.createContext(garage);
vm.runInContext('var budgetCatalog = null; const budgetDrafts = new Map(), budgetMessages = new Map(); const current = () => ({ci:1,si:5});\n' +
  garageSource.slice(garageSource.indexOf('  function budgetSummary('), garageSource.indexOf('  // 工具页没有')), garage);
assert.ok(garage.budgetSummary(1287).textContent.includes('暂不可用'));
garage.budgetCatalog = catalog(830);
assert.ok(garage.budgetSummary(1287).attrs.class.includes('over-budget'));
assert.ok(garage.budgetSummary(1287).textContent.includes('超出 £457'));
assert.ok(!garage.budgetSummary(830).attrs.class.includes('over-budget'));
garage.budgetCatalog = catalog(0);
assert.ok(garage.budgetSummary(1).attrs.class.includes('over-budget'));
garage.budgetCatalog = { chapters: [] };
assert.ok(garage.budgetSummary(0).textContent.includes('未配置'));
garage.budgetCatalog = { budgets: [{ chapter: 1, stage: 5, budget: 830 }], chapters: [] };
assert.ok(garage.budgetSummary(1287).textContent.includes('超出 £457'));
context.reportCheck.setCatalog({ budgets: [{ chapter: 1, stage: 5, budget: 830 }], chapters: [] });
assert.ok(context.reportCheck.budgetBlock(rec).textContent.includes('超出 £457'));

// 真实故障报告直接进入同一渲染函数；不修改历史报告。
const file = process.argv[2];
if (file) {
  const actual = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const comparisons = (actual.chapters || []).flatMap(ch => ch.stages || []).filter(s => s.originComparison);
  assert.ok(comparisons.length, '真实回归报告必须包含原点比较');
  text = render(actual);
  for (const stage of comparisons) assert.ok(text.includes(stage.originComparison.name || '原点车'));
  assert.ok(!text.includes('undefined') && !text.includes('NaN'));
  console.log(`真实报告渲染通过：${file}`);
}
console.log('原点比较渲染通过：有章关、无章关、无比较、部分章关、无车名。');
