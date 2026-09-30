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
  // 车间的性能单 / 调速杆 / 换层旋钮用像素界面件（界面重建 v3），和 editor.js 一起加载
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-px.js'), 'utf8'), context);
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

/** 仅给车间交互测试装上事件分发和画布矩阵记录，保留游戏的真实入口与规则。 */
function workshopRuntime() {
  const { SA, context } = runtime(), doc = context.document, create = doc.createElement;
  const frames = new Map(), elements = [], timers = []; let frameId = 0;
  const listen = target => {
    const handlers = new Map();
    target.addEventListener = (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    };
    target.dispatch = (type, props = {}) => {
      const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0, deltaY: 0,
        ...props, currentTarget: target, target: props.target || target, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; } };
      for (const fn of handlers.get(type) || []) fn(e);
      return e;
    };
  };
  listen(doc);
  doc.documentElement.style.setProperty = () => {};
  const query = doc.querySelector;
  doc.querySelector = selector => selector === '#modal' ? { hidden: true } : query(selector);
  doc.createElement = tag => {
    const el = create(tag); elements.push(el); listen(el);
    el.setAttribute = (key, value) => { el[key] = value; };
    el.setPointerCapture = () => {};
    el.releasePointerCapture = () => {};
    if (tag === 'canvas') {
      const get = el.getContext;
      el.getContext = () => {
        if (el._pen) return el._pen;
        const pen = get(), stack = []; let matrix = [1, 0, 0, 1, 0, 0];
        const multiply = b => {
          const [a, bb, c, d, e, f] = matrix;
          matrix = [a * b[0] + c * b[1], bb * b[0] + d * b[1], a * b[2] + c * b[3],
            bb * b[2] + d * b[3], a * b[4] + c * b[5] + e, bb * b[4] + d * b[5] + f];
        };
        pen.save = () => stack.push(matrix.slice());
        pen.restore = () => { matrix = stack.pop() || [1, 0, 0, 1, 0, 0]; };
        pen.translate = (x, y) => multiply([1, 0, 0, 1, x, y]);
        pen.scale = (x, y) => multiply([x, 0, 0, y, 0, 0]);
        pen.transform = (...values) => multiply(values);
        pen.setTransform = (...values) => { matrix = values.length === 1 ?
          [values[0].a, values[0].b, values[0].c, values[0].d, values[0].e, values[0].f] : values.slice(); };
        pen.resetTransform = () => { matrix = [1, 0, 0, 1, 0, 0]; };
        el._draws = [];
        pen.drawImage = image => el._draws.push({ image, matrix: matrix.slice() });
        return (el._pen = pen);
      };
    }
    return el;
  };
  context.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  context.cancelAnimationFrame = key => frames.delete(key);
  context.setTimeout = fn => { timers.push(fn); return timers.length; };
  context.ResizeObserver = class { observe() {} disconnect() {} };
  SA.go = page => { SA.current = page; };
  SA.S.reset();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-px.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/editor.js'), 'utf8'), context);
  SA.Editor.open();
  const cv = elements.find(el => el.tagName === 'CANVAS' && el.dispatch && el._draws && el.width > 100);
  assert(cv, '没有找到车间画布');
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, right: cv.width, bottom: cv.height, width: cv.width, height: cv.height });
  const tick = () => {
    cv._draws.length = 0;
    const pending = [...frames]; frames.clear();
    for (const [, fn] of pending) fn();
    const backdrop = cv._draws.find(x => x.image && x.image.width >= cv.width && x.image.height === cv.height);   // 蓝图纸比画布左右宽（平移不露底）
    assert(backdrop, '车间没有绘制蓝图背景');
    return backdrop.matrix;
  };
  const flushTimers = () => { const pending = timers.splice(0); for (const fn of pending) fn(); };
  return { SA, doc, cv, elements, tick, flushTimers };
}

/** 通过画布已绘制的矩阵定位实际模块，验证拖拽分流、锚点和规则状态。 */
function workshopPanZoom() {
  const { SA, doc, cv, elements, tick, flushTimers } = workshopRuntime();
  const { CELL: C, ROWS } = SA.K, PADX = SA.SPR.PADX, v = SA.S.d.vehicle;
  const snapshot = () => JSON.stringify({ body: v.body, side: v.side, inv: SA.S.d.inv });
  const near = (a, b, label) => assert(Math.abs(a - b) < 0.001, `${label}：${a} ≠ ${b}`);
  const screen = (m, x, y) => ({ clientX: m[0] * x + m[2] * y + m[4], clientY: m[1] * x + m[3] * y + m[5] });
  const cell = (m, r, c) => screen(m, PADX + (c + 0.5) * C, (r + 0.5) * C);
  const pointer = (type, xy, target = cv) => target.dispatch(type, xy);
  const drag = (from, to) => { pointer('pointerdown', from); pointer('pointermove', to); pointer('pointerup', to, doc); flushTimers(); };
  const click = xy => { pointer('pointerdown', xy); pointer('pointerup', xy, doc); flushTimers(); };
  const before = snapshot(); let m = tick();
  const blank = cell(m, 4, 4);
  assert.strictEqual(SA.V.at(v, 'body', 4, 4), null, '测试起点不是空白格');

  // 空白画布纯纵向拖动没有纵向平移，也不会移动或拆卸车上模块。
  drag(blank, { clientX: blank.clientX, clientY: blank.clientY + 45 });
  let next = tick();
  near(next[4], m[4], '纵拖后横向位置'); near(next[5], m[5], '纵拖后纵向位置');
  assert.strictEqual(snapshot(), before, '纯纵向背景拖动修改了车辆或库存');
  m = next;
  drag(blank, { clientX: blank.clientX + 24, clientY: blank.clientY });
  next = tick();
  assert(next[4] > m[4] + 15, '水平拖动没有横向平移');
  near(next[5], m[5], '水平拖动后的纵向位置');
  assert.strictEqual(snapshot(), before, '水平背景拖动修改了车辆或库存');
  m = next;
  drag(blank, { clientX: blank.clientX + 36, clientY: blank.clientY + 18 });
  next = tick();
  assert(next[4] > m[4] + 20, '斜向拖动没有横向平移');
  near(next[5], m[5], '斜拖后纵向位置'); near(next[3], m[3], '斜拖后纵向缩放');
  assert.strictEqual(snapshot(), before, '背景平移修改了车辆或库存');
  m = next;
  const anchor = cell(m, 4, 5), logicalAnchor = PADX + 5.5 * C;
  const wheel = deltaY => {
    const e = cv.dispatch('wheel', { ...anchor, deltaY });
    assert(e.defaultPrevented, '车间滚轮没有阻止页面默认滚动');
    return tick();
  };
  next = wheel(-120);
  assert(next[0] > m[0], '向上滚轮没有放大蓝图');
  assert(Math.abs(next[0] * logicalAnchor + next[4] - anchor.clientX) <= 1, '缩放后鼠标横向锚点');   // 平移取整到像素，允许 1 像素误差
  near(next[5] + next[3] * ROWS * C, m[5] + m[3] * ROWS * C, '缩放后底线');
  m = next;
  next = wheel(120);
  assert(next[0] < m[0], '向下滚轮没有缩小蓝图');
  for (let i = 0; i < 30; i++) cv.dispatch('wheel', { ...anchor, deltaY: -120, preventDefault() { this.defaultPrevented = true; } });
  m = tick(); near(m[0], 3, '放大上限');   // 只用整数倍 1 / 2 / 3
  for (let i = 0; i < 60; i++) cv.dispatch('wheel', { ...anchor, deltaY: 120, preventDefault() { this.defaultPrevented = true; } });
  m = tick(); near(m[0], 1, '缩小下限');
  assert.strictEqual(snapshot(), before, '滚轮缩放修改了车辆或库存');

  // 回到适于点选的倍率，点击位置由绘制矩阵生成，不借助编辑器内部状态。
  // 缩小到底就是 1 倍（原来连续缩放时这里要滚回约 1 倍）；平移仍在，点选走的是变换后的矩阵
  m = tick();
  const src = { layer: 'body', r: 8, c: 10 }, part = v.body[src.r][src.c];
  assert(part, '起始载具缺少用于交互回归的模块');
  const source = cell(m, src.r, src.c);
  pointer('pointerdown', source);
  const duringPress = cv.dispatch('wheel', { ...source, deltaY: -120 });
  assert(duringPress.defaultPrevented, '模块按下期间滚轮没有阻止默认滚动');
  next = tick(); near(next[0], m[0], '模块按下期间的倍率');
  pointer('pointerup', source, doc); flushTimers();
  const selected = elements.filter(el => el.className === 'dock-ctx').at(-1);
  assert(selected && selected.children.length, '变换后点击模块未显示选中操作');
  const candidate = (() => {
    for (let r = 3; r < ROWS - 2; r++) for (let c = 3; c < SA.K.COLS - 2; c++) {
      if (SA.V.at(v, 'body', r, c)) continue;
      const clone = SA.V.clone(v);
      if (SA.V.move(clone, 'body', src.r, src.c, r, c).ok) return { r, c };
    }
    throw new Error('没有可用于测试的模块移动目标');
  })();
  click(cell(m, candidate.r, candidate.c));
  assert.strictEqual(v.body[src.r][src.c], null, '变换后空格点击未移走选中模块');
  assert.strictEqual(v.body[candidate.r][candidate.c], part, '模块未移到变换后的目标格');

  // 真正的模块拖拽仍可从车间拖到画布外，库存收到原件。
  const invBefore = SA.S.d.inv[SA.invKey(part.id, part.mt)] || 0;
  drag(cell(m, candidate.r, candidate.c), { clientX: cv.width + 30, clientY: cv.height / 2 });
  assert.strictEqual(v.body[candidate.r][candidate.c], null, '模块拖出画布没有拆下');
  assert.strictEqual(SA.S.d.inv[SA.invKey(part.id, part.mt)], invBefore + 1, '拖出模块没有回库存');

  // 库存按钮的真实选择事件和画布放置事件，继续检查缩放后的逆映射。
  const row = elements.filter(el => typeof el['data-page-key'] === 'string' && el['data-page-key'] === 'inventory:armor').at(-1);
  assert(row, '没有找到装甲库存按钮');
  row.dispatch('click');
  const stockBefore = SA.S.d.inv.armor;
  const armorSize = SA.fp('armor');
  const spot = (() => {
    for (let r = 0; r <= ROWS - armorSize.h; r++) for (let c = 0; c <= SA.K.COLS - armorSize.w; c++) {
      const p = screen(m, PADX + (c + armorSize.w / 2) * C, (r + armorSize.h / 2) * C);
      if (p.clientX > 0 && p.clientX < cv.width && p.clientY > 0 && p.clientY < cv.height && SA.V.placeCheck(v, 'armor', r, c).ok) return { r, c };
    }
    throw new Error('没有可用于库存放置的装甲格');
  })();
  const armorPoint = screen(m, PADX + (spot.c + armorSize.w / 2) * C, (spot.r + armorSize.h / 2) * C);
  click(armorPoint);
  assert(v.body[spot.r][spot.c] && v.body[spot.r][spot.c].id === 'armor', `变换后库存模块没有放到目标格：${JSON.stringify({ spot, armorPoint, size: [cv.width, cv.height], inv: SA.S.d.inv.armor })}`);
  assert.strictEqual(SA.S.d.inv.armor, stockBefore - 1, '放置没有扣除库存');

  // 右键先取消库存选择，再对实际模块右键拆卸。
  const cancel = doc.dispatch('contextmenu', { ...armorPoint, target: cv });
  assert(cancel.defaultPrevented, '右键未取消当前库存选择');
  const removed = doc.dispatch('contextmenu', { ...armorPoint, target: cv });
  assert(removed.defaultPrevented, '右键拆卸未阻止菜单');
  assert.strictEqual(v.body[spot.r][spot.c], null, '变换后右键没有拆下模块');
  return { pan: true, zoom: true, anchor: true, move: true, inventory: true, dragOut: true, contextMenu: true };
}
function run() { return { bipeds: bipeds(), editor: editor(), workshopPanZoom: workshopPanZoom() }; }
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
