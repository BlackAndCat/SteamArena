/** 原点比较旧报告兼容回归：运行报告页真实选关表渲染函数，不启动浏览器或战斗。 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 最小 DOM 只保存文本；缩略图解析返回空，不涉及视觉绘制。
function element(_tag, _attrs, ...children) {
  const node = { children: [], append(...items) {
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
vm.runInNewContext(source.split(anchor)[0] + '\n globalThis.reportCheck = { st, picks };\n})();', context);
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
