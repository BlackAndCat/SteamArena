// 使用车间帮助的真实页面路径，验证旧作者改字优先显示并写回同一正式文本字段。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const text = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/text.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/ui.json'), 'utf8'));
const keys = [
  'dom:main::screen:garage::div#modal/div.panel:n1/div.panel-body:n2/div.help:n1/p:n1::text:0',
  'dom:main::screen:garage::div#modal/div.panel:n1/div.panel-body:n2/div.help:n1/p:n2::text:0',
];
assert(keys.every(key => typeof text.values[key] === 'string'), '车间帮助旧作者字段不存在');

const elements = [];
function el(tag, parent = null, id = '', classes = []) {
  const item = { nodeType: 1, tagName: tag.toUpperCase(), id, parentElement: parent, children: [], childNodes: [],
    dataset: {}, isConnected: true, style: { getPropertyValue: () => '', getPropertyPriority: () => '', setProperty() {}, removeProperty() {} },
    classList: { contains: name => classes.includes(name), [Symbol.iterator]: () => classes[Symbol.iterator]() },
    getAttribute: () => null, contains: () => false,
    closest(selector) { return selector === '#screen, #modal' ? modal : null; },
    querySelectorAll: () => [],
  };
  if (parent) parent.children.push(item);
  elements.push(item);
  return item;
}
const body = el('body'); body.dataset.screen = 'garage';
const modal = el('div', body, 'modal');
const panel = el('div', modal, '', ['panel']);
el('div', panel);
const panelBody = el('div', panel, '', ['panel-body']);
const help = el('div', panelBody, '', ['help']);
const paragraphs = [el('p', help), el('p', help)];
const uiKeys = ['editor_6be0c3108d82', 'editor_8fed129fc96c'];
paragraphs.forEach((item, i) => {
  const node = { nodeType: 3, data: ui.messages[uiKeys[i]], parentNode: item };
  item.childNodes.push(node);
});
body.querySelectorAll = () => elements.slice(1);

let saved;
const context = vm.createContext({ console, Promise, Map, Set, WeakMap, WeakSet, JSON,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  document: { body, head: null, readyState: 'loading', addEventListener() {} },
  location: { pathname: '/' },
  fetch: async (url, options) => {
    assert.strictEqual(url, '/__text/save');
    saved = JSON.parse(options.body);
    return { ok: true, json: async () => ({ revision: 'test' }) };
  },
});
context.window = context;
context.SA = { RELEASE: false, Config: { get: name => name === 'text' ? text : ui,
  text: key => ui.messages[key], keyForText: rendered => uiKeys.find(key => ui.messages[key] === rendered) || null } };
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/text-manager.js'), 'utf8'), context);
uiKeys.forEach(key => context.SA.Text.registerUi(key, ui.messages[key], ui.messages[key], []));
context.SA.Text.init({ toolbar: false, page: 'main' });
context.SA.Text.ready.then(async () => {
  assert.deepStrictEqual(paragraphs.map(item => item.childNodes[0].data), keys.map(key => text.values[key]),
    '车间帮助应显示旧作者改字，而非 UI 默认模板');
  context.SA.Text.set(keys[0], '作者重新修改车间帮助');
  assert((await context.SA.Text.save()).ok);
  assert.strictEqual(saved.values[keys[0]], '作者重新修改车间帮助');
  assert.strictEqual(saved.values[keys[1]], text.values[keys[1]]);
  console.log('车间帮助旧作者改字显示及同字段保存：通过');
}).catch(error => { console.error(error); process.exitCode = 1; });
