/* 本轮授权的视觉回归：唯一双足的精灵选择与缓存、重复打开车间的帧循环。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');

/** 补足无画面 Canvas 的像素缓冲；绘制选择和缓存仍全部执行生产代码。 */
function runtime() {
  const game = loadGame(), doc = game.context.document, create = doc.createElement;
  doc.createElement = tag => {
    const el = create(tag);
    if (tag === 'canvas') {
      const get = el.getContext;
      el.getContext = () => { const g = get(); g.createImageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }); return g; };
    }
    return el;
  };
  return game;
}
/** 在正式绘制器入口记录腿型，验证数据传递与不同外观之间的缓存隔离。 */
function bipeds() {
  const { SA, context } = runtime(), observed = [];
  const original = SA.LEGLAB.bipedArt;
  SA.LEGLAB.bipedArt = (pen, x, y, opts, part) => { observed.push(opts.legs); return original(pen, x, y, opts, part); };
  const g = context.document.createElement('canvas').getContext('2d');
  const main = ['mk2', 'heron', 'gren', 'knight', 'clock', 'dragon'];
  for (let mt = 1; mt <= 6; mt++) {
    SA.SPR.drawModule(g, 'biped', 0, 0, { mt });
    assert.strictEqual(observed.at(-1), main[mt - 1]);
  }
  for (const variant of SA.LEG_VARIANTS.filter(x => x.id === 'biped')) {
    const cell = { ...SA.newCell('biped', variant.mt), look: variant.look, unique: variant.key };
    const v = SA.V.create('唯一双足绘制'); v.body[SA.V.chassisRow('biped')][6] = cell;
    SA.SPR.renderVehicle(v, { t: 0 });
    assert.strictEqual(observed.at(-1), variant.look, `${variant.key} 没有选择专属腿型`);
    const count = observed.length;
    SA.SPR.renderVehicle(v, { t: 0 });
    assert.strictEqual(observed.length, count, '相同外观未复用精灵缓存');
  }
  SA.SPR.setMatPass(null);
  SA.SPR.drawModule(g, 'biped', 0, 0, { mt: 2, look: 'unknown' });
  assert.strictEqual(observed.at(-1), 'heron', '未知外观没有回到材料六档');
  return { main: 6, unique: 9, cache: true };
}

/** 用真实车间入口与可计数的 rAF 队列，检查重开、运行和离开时的循环数。 */
function editor() {
  const { SA, context } = runtime(), frames = new Map(); let id = 0;
  context.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  context.cancelAnimationFrame = key => frames.delete(key);
  context.ResizeObserver = class { observe() {} disconnect() {} };
  SA.go = page => { SA.current = page; };
  SA.S.reset();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/editor.js'), 'utf8'), context);
  const tick = () => { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(); };
  for (let i = 0; i < 5; i++) SA.Editor.open();
  assert.strictEqual(frames.size, 1, '初始化回调已叠加');
  tick();
  for (let i = 0; i < 5; i++) { SA.Editor.open(); tick(); assert.strictEqual(frames.size, 1, '车间绘制循环叠加'); }
  SA.current = 'arena'; tick();
  assert.strictEqual(frames.size, 0, '离开车间后仍继续绘制');
  return { repeatedOpens: 10, activeChains: 1, leaveStops: true };
}
function run() { return { bipeds: bipeds(), editor: editor() }; }
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
