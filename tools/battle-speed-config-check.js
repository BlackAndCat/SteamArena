// 调速仅开发可见；拖动预览，提交时合并最新正式模块配置，失败不写本机偏好。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../js/battle-view.js'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/ui.json'), 'utf8')).messages;
assert(source.includes('!SA.RELEASE ? speedSlider() : null'), '发行版仍可见调速滑块');
assert(!source.includes('steam_arena_speed_v1'), '仍在读取旧浏览器速度偏好');
const block = source.slice(source.indexOf('  // 整场战斗共用正式模块配置中的速度'), source.indexOf('  function holdBtn('));

function makeHarness(fail = false) {
  const nodes = [], calls = [], toasts = [], K = { GAME_SPEED: 0.75 }, B = { speed: 0.75 };
  const cache = { K: { GAME_SPEED: 0.75 } };
  const h = (tag, props, ...children) => {
    const node = { tag, props, children, textContent: children.filter(child => typeof child === 'string').join(''),
      value: props.value, disabled: false, blur() {} };
    nodes.push(node);
    return node;
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    assert.strictEqual(url, '/__battle-speed/save');
    return fail ? { ok: false, status: 500, json: async () => ({ error: '模拟磁盘失败' }) }
      : { ok: true, json: async () => ({ ok: true, gameSpeed: JSON.parse(options.body).gameSpeed, file: 'config/modules.json' }) };
  };
  const SA = { Config: { text: (key, ...args) => ui[key].replace(/{{(\d+)}}/g, (_, i) => String(args[+i])),
    get: name => { assert.strictEqual(name, 'modules'); return cache; } },
    UI: { toast: message => toasts.push(message) } };
  const context = vm.createContext({ SA, K, T: { GAME_SPEED_MIN: 0.3, GAME_SPEED_MAX: 1.5, GAME_SPEED_STEP: 0.05 },
    B, h, fetch, localStorage: { getItem() { throw new Error('禁读旧速度偏好'); }, setItem() { throw new Error('禁写本机偏好'); } } });
  const functions = vm.runInContext(`${block}\n({ gameSpeed, speedSlider })`, context);
  return { ...functions, nodes, calls, toasts, K, B, cache };
}

async function run() {
  const ok = makeHarness();
  assert.strictEqual(ok.gameSpeed(), 0.75);
  const label = ok.speedSlider();
  const range = ok.nodes.find(node => node.tag === 'input');
  const status = label.children.at(-1);
  range.value = '1.1'; range.props.oninput();
  assert.strictEqual(ok.B.speed, 1.1, '拖动没有立即预览');
  assert.strictEqual(ok.calls.length, 0, '拖动时过早落盘');
  await range.props.onchange();
  assert.deepStrictEqual(ok.calls.map(call => call.url), ['/__battle-speed/save']);
  const payload = JSON.parse(ok.calls[0].options.body);
  assert.deepStrictEqual(payload, { gameSpeed: 1.1 });
  assert.strictEqual(ok.K.GAME_SPEED, 1.1);
  assert.strictEqual(ok.cache.K.GAME_SPEED, 1.1);
  assert.strictEqual(status.textContent, ui.battle_view_speed_saved);

  const failed = makeHarness(true);
  const failedLabel = failed.speedSlider();
  const failedRange = failed.nodes.find(node => node.tag === 'input');
  failedRange.value = '1.2'; failedRange.props.oninput();
  await failedRange.props.onchange();
  assert.strictEqual(failed.K.GAME_SPEED, 0.75);
  assert.strictEqual(failed.B.speed, 0.75, '失败后应恢复正式速度');
  assert.strictEqual(failed.cache.K.GAME_SPEED, 0.75);
  assert.strictEqual(failedLabel.children.at(-1).textContent, ui.battle_view_speed_save_failed);
  assert.match(failed.toasts[0], /模拟磁盘失败/);
  console.log('开发调速正式配置保存、失败反馈及发行隐藏：通过');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
