/* 首关奖励与教程回归：真实存档规则在独立 VM 中运行，不写用户存档。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');
const source = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function run() {
  const { SA, context } = loadGame(), memory = new Map();
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  SA.S.reset();
  assert.deepStrictEqual(Object.keys(SA.S.d.inv), [], '新档仍预置了装甲或机炮');
  const first = SA.Camp.stage(0, 0);
  assert.strictEqual(first.rewardItems?.[0]?.id, 'tank_s');
  assert.strictEqual(first.rewardItems[0].mt, 1);
  assert.strictEqual(first.unlock.note, SA.StageCars.get(0, 0).unlock.note, '首关备注没有沿用正式作者记录');
  const result = SA.Camp.win();
  assert(result.lines.some(line => /小水罐/.test(line)));
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '首胜未实发一只小水罐');
  assert.strictEqual(SA.S.d.camp.rewardClaims['0:0:tank_s'], true);
  SA.S.save(); SA.S.load(); SA.Camp.backfill(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '刷新后重复发首关奖励');

  // 旧玩家库存保留；补发记号保存后，重新加载仍只补一次。
  SA.S.reset();
  SA.S.d.inv = { armor: 4, mg: 1 };
  SA.S.d.camp.st = 1;
  SA.S.save(); SA.S.load(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1);
  assert.strictEqual(SA.S.d.inv.armor, 4);
  assert.strictEqual(SA.S.d.inv.mg, 1);
  SA.S.load(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '旧档补发未幂等');

  // 重打是友谊赛结算，不会调用 Camp.win() 发固定奖励。
  const beforeReplay = SA.S.d.inv.tank_s;
  SA.S.settleBattle({ mode: 'campaign', replay: true, win: true, enemyName: '小提米' });
  assert.strictEqual(SA.S.d.inv.tank_s, beforeReplay);

  vm.runInContext(source('story.js'), context, { filename: 'js/story.js' });
  const parts = SA.STORY.tutorial.parts;
  assert.deepStrictEqual(Array.from(parts, p => p.part), ['cockpit', 'track', 'boiler', 'mg']);
  const starterIds = SA.V.countIds(SA.S.starterVehicle());
  for (const id of ['helmet', 'track', 'boiler_s', 'mg_s']) assert(starterIds[id] > 0, `初始车缺教程目标 ${id}`);
  // 按页面顺序接上画面层并真正开始第一关，逐帧检查教程镜头和箭头投影。
  const frames = [], canvases = [], keys = {}, makeElement = context.document.createElement;
  context.document.createElement = tag => {
    const el = makeElement(tag);
    el.clientWidth = 1296; el.offsetHeight = 140;
    el.listeners = {};
    el.addEventListener = (type, fn) => { el.listeners[type] = fn; };
    if (tag === 'canvas') canvases.push(el);
    return el;
  };
  context.requestAnimationFrame = fn => { frames.push(fn); };
  context.addEventListener = (type, fn) => { (keys[type] ||= []).push(fn); };
  // 本检查只验证教程镜头；场景与特效绘制都用空实现保留真实画面层调用路径。
  SA.Scenes = { pick: () => ({}), back() {}, fxBack() {}, floor() {}, front() {}, fxFront() {} };
  SA.PX = { init() {}, ui: { btn: () => context.document.createElement('button') } };
  let tutorialLines, finishTutorial, marked = false;
  SA.Story = { tutorial: () => SA.STORY.tutorial, talk: (lines, opts) => { tutorialLines = lines; finishTutorial = opts.onDone; return { close() {} }; }, mark: () => { marked = true; }, emblem: () => ({ cv: context.document.createElement('canvas'), muzzles: [] }) };
  SA.go = page => { SA.current = page; };
  vm.runInContext(source('battle-view.js'), context, { filename: 'js/battle-view.js' });
  vm.runInContext(source('battle.js'), context, { filename: 'js/battle.js' });
  SA.S.d.vehicle = SA.S.starterVehicle();
  SA.Battle.start({ mode: 'campaign', enemyVehicle: first.vehicle, enemyName: first.name, terrain: first.terrain || 'flat' });
  const battle = SA.Battle.debug.B, arrows = battle.intro?.arrows || [];
  battle.hudT = 100;
  assert.deepStrictEqual(Array.from(arrows, a => a.part), ['cockpit', 'track', 'boiler', 'mg']);
  const targetId = { cockpit: 'helmet', track: 'track', boiler: 'boiler_s', mg: 'mg_s' };
  for (const arrow of arrows) {
    let own;
    SA.V.each(battle.p.v, (cell, r, c) => { if (!own && cell.id === targetId[arrow.part]) own = { r, c }; });
    assert(own, `玩家缺少 ${arrow.part}`);
    const [px, py] = SA.Battle.debug.cellCenter('p', own.r, own.c);
    assert(Math.abs(arrow.mx - px) < 1e-6 && Math.abs(arrow.my - py) < 1e-6, `${arrow.part} 箭头没有指向玩家模块`);
  }
  const canvas = canvases.find(c => c.listeners.pointermove);
  assert(canvas.width > 0 && canvas.height > 0, '首关画布未完成实际尺寸适配');
  let now = 0;
  const nextFrame = () => { const frame = frames.shift(); assert(frame, '战斗动画帧中断'); frame(now += 50); };
  let lineIndex = SA.STORY.tutorial.intro.length;
  for (const arrow of arrows) {
    const part = parts.find(p => p.part === arrow.part);
    assert(part && tutorialLines[lineIndex]?.on, `${arrow.part} 缺少教程焦点对话`);
    tutorialLines[lineIndex].on();
    assert.strictEqual(battle.intro.focus, arrow.part, `${arrow.part} 对话未切换教程焦点`);
    lineIndex += part.lines.length;
    for (let i = 0; i < 40; i++) nextFrame();
    const cam = battle.cam, dpx = canvas.width / 1280, z = cam.z * dpx;
    const playerX = (Math.min(...arrows.map(a => a.b.x0)) + Math.max(...arrows.map(a => a.b.x1))) / 2;
    const enemyX = battle.e.x + 128;
    assert(Math.abs(cam.x + cam.w / 2 - playerX) < 80 && Math.abs(cam.x + cam.w / 2 - playerX) < Math.abs(cam.x + cam.w / 2 - enemyX), `${arrow.part} 讲解镜头没有面向玩家车`);
    // 与 introDraw 一致：检查精灵中心经真实镜头和设备像素比后的落点。
    const bob = 3 + 3 * Math.sin(battle.intro.clock * 7);
    const ax = arrow.mx + arrow.ox * (arrow.reach + bob + 10);
    const ay = arrow.my + arrow.oy * (arrow.reach + bob + 10);
    const sx = (ax - cam.x) * z, sy = (ay - cam.y) * z;
    assert(sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height, `${arrow.part} 箭头投影不在视口内：${sx}, ${sy}`);
  }
  // 对话自然完成后走原开战动画；结束后的同一循环继续推进战斗。
  finishTutorial();
  assert(marked && battle.intro?.mode === 'cine', '教程结束后未进入开战动画');
  for (let i = 0; i < 110 && battle.intro; i++) nextFrame();
  assert.strictEqual(battle.intro, null, '开战动画未结束');
  const timeBefore = battle.t;
  nextFrame();
  assert(battle.t > timeBefore && !battle.done, '教程后战斗未恢复推进');
  // 从真实画布鼠标事件瞄准，再用已绑定的 Space 键输入开火。
  let enemyCell;
  SA.V.each(battle.e.v, (cell, r, c) => { if (!enemyCell && cell.hp > 0) enemyCell = { r, c }; });
  assert(enemyCell, '第一关敌车没有可瞄准部件');
  const [ex, ey] = SA.Battle.debug.cellCenter('e', enemyCell.r, enemyCell.c);
  canvas.listeners.pointermove({ clientX: (ex - battle.cam.x) * battle.cam.z / 1280 * 1000, clientY: (ey - battle.cam.y) * battle.cam.z / 720 * 600 });
  for (const onKey of keys.keydown || []) onKey({ type: 'keydown', code: 'Space', preventDefault() {} });
  const shotsBefore = battle.p.events.fire;
  for (let i = 0; i < 160 && battle.p.events.fire === shotsBefore && !battle.done; i++) nextFrame();
  assert(battle.p.events.fire > shotsBefore, '第一关恢复后按开火键没有发射弹丸');
  const editor = source('editor.js'), help = editor.slice(editor.indexOf('function openHelp() {'), editor.indexOf('// ---------- 绘制 ----------'));
  assert.strictEqual((help.match(/h\('p',/g) || []).length, 3, '车间帮助不是三条');
  // 帮助内容以正式 UI 配置为准，编辑器只保留键引用。
  const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/ui.json'), 'utf8')).messages;
  const helpLines = ['editor_6be0c3108d82', 'editor_8fed129fc96c', 'editor_997f250d05a7'].map(key => {
    assert(help.includes(key), `车间帮助未引用 ${key}`);
    return ui[key];
  }).join('\n');
  assert(/左键/.test(helpLines) && /右键/.test(helpLines) && /出战/.test(helpLines) && /按住左键稳住准星/.test(helpLines));
  return { firstReward: SA.S.d.inv.tank_s, legacyBackfillOnce: true, tutorialParts: parts.length, firstStageFired: true, helpItems: 3 };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
