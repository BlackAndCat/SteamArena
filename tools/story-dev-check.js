/* 剧情开发与投降接口回归：使用真实游戏规则和文本存储，不执行视觉或用户文件写入。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');
const copy = value => JSON.parse(JSON.stringify(value));
const source = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');

/** 新档、已有档与主动换车分别验证，退库必须保留有损伤、有改装的唯一件实例。 */
function starterCheck() {
  const { SA, context } = evolve.loadGame(), memory = new Map();
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  SA.S.reset();
  const counts = copy(SA.V.countIds(SA.S.d.vehicle));
  assert.deepStrictEqual(counts, { boiler_s: 1, mg_s: 1, helmet: 1, track: 1 });
  assert(SA.V.stats(SA.S.d.vehicle).canDeploy, '四件初始车不能出战');
  SA.V.each(SA.S.d.vehicle, cell => assert.strictEqual(cell.mt || 1, 1));
  for (const id of Object.keys(counts)) assert(SA.Camp.hasMod(id), `初始模块 ${id} 未解锁`);
  const saved = SA.V.fromAscii('保留我的车', ['........', '........', '........', '...K....', '...OW...', '...Q....']);
  const unique = SA.newCell('quad', 2);
  Object.assign(unique, { unique: 'quad:skirtfort', look: 'skirtfort', lv: 1, hp: 11 });
  saved.body[10][6] = unique;
  SA.S.d.vehicle = saved;
  SA.S.d.money = 1234; SA.S.d.debt = 50; SA.S.d.camp.st = 1;
  SA.S.save(); SA.S.load();
  assert.strictEqual(SA.S.d.vehicle.name, '保留我的车', '加载已有档误换了车');
  const fields = copy(SA.S.d); delete fields.vehicle; delete fields.inv; delete fields.stockCells;
  const oldCells = []; SA.V.each(SA.S.d.vehicle, cell => oldCells.push(copy(cell)));
  assert(oldCells.some(cell => cell.unique === 'quad:skirtfort' && cell.look === 'skirtfort' && cell.hp === 11 && cell.lv === 1));
  SA.dev.resetVehicle();
  const after = copy(SA.S.d); delete after.vehicle; delete after.inv; delete after.stockCells;
  assert.deepStrictEqual(after, fields, '换车改动了其他存档字段');
  assert.strictEqual(SA.S.d.stockCells.length, oldCells.length);
  oldCells.forEach((cell, i) => assert.deepStrictEqual(copy(SA.S.d.stockCells[i]), cell, '退库丢失实例字段'));
  SA.S.load();
  assert.deepStrictEqual(copy(SA.V.countIds(SA.S.d.vehicle)), counts, '换车后刷新未保留初始车');
  let opts; SA.Battle.start = value => { opts = value; };
  SA.S.arenaEntries('camp').find(entry => entry.key === '0,0').start();
  assert.strictEqual(opts.storyKey, '0,0', '重打剧情未记录实际关卡');
  return { modules: 4, savedVehiclePreserved: true, retiredCellsPreserved: oldCells.length, storyKey: opts.storyKey };
}

/** 演出期间战斗完全停止；自然结束和跳过都只询问一次，旧画面仍可直接确认。 */
function surrenderCheck() {
  const { SA, context } = evolve.loadGame();
  let api;
  const events = [], view = { supportsSurrenderAnimation: true, gameSpeed: () => 1,
    emit: (type, data) => events.push({ type, data }), draw() {}, hudTick() {}, tick() {} };
  SA.BattleView = { create(value) { api = value; return view; } };
  vm.runInContext(source('battle.js'), context);
  SA.go = () => {};
  const enemy = SA.V.fromAscii('失去武器的敌车', ['........', '........', '........', '...K....', '...OW...', '...TT...']);
  enemy.body[4][6] = SA.newCell('plate'); enemy.body[4][6].hp = 0;
  function start() {
    events.length = 0; SA.S.reset();
    SA.Battle.startState({ mode: 'friendly', enemyVehicle: enemy, enemyName: enemy.name, terrain: 'flat' });
    SA.Battle.debug.step(1.2);
    return SA.Battle.debug.B;
  }
  const B = start();
  let state = SA.Battle.surrenderState();
  assert.strictEqual(state.phase, 'raising'); assert.strictEqual(state.crewExpression, 'sad');
  assert.strictEqual(state.anchor.r, 6, '白旗挂在了已损毁的最高部件上');
  assert.strictEqual(events.filter(event => event.type === 'surrender-start').length, 1);
  const frozen = JSON.stringify([B.t, B.p.x, B.e.x, B.p.heat, B.e.heat, B.shots, B.ending]);
  SA.Battle.debug.step(5);
  assert.strictEqual(JSON.stringify([B.t, B.p.x, B.e.x, B.p.heat, B.e.heat, B.shots, B.ending]), frozen);
  assert.strictEqual(SA.Battle.acceptSurrender(), false, '未升完旗就接受了投降');
  assert.strictEqual(SA.Battle.retreat(), false, '演出中撤退会使冻结状态无法结算');
  assert.strictEqual(SA.Battle.vent(), false, '升旗期间仍可改动战斗状态');
  state = api.advanceSurrender(1.2);
  assert.strictEqual(state.poleProgress, 1); assert.strictEqual(state.flagProgress, 0);
  state = api.advanceSurrender(2.2);
  assert.strictEqual(state.phase, 'raising'); assert(state.flagProgress > 0.9);
  assert.strictEqual(api.skipSurrenderAnimation(), true); assert.strictEqual(api.skipSurrenderAnimation(), false);
  assert.strictEqual(events.filter(event => event.type === 'surrender').length, 1);
  assert.strictEqual(SA.Battle.surrenderState().canConfirm, true);
  assert(SA.Battle.acceptSurrender()); assert(B.e.dead); assert.strictEqual(B.surrender, 'accepted');
  start(); api.advanceSurrender(3.5); api.advanceSurrender(10);
  assert.strictEqual(events.filter(event => event.type === 'surrender').length, 1);
  assert(SA.Battle.refuseSurrender()); assert.strictEqual(SA.Battle.surrenderState(), null);
  const time = SA.Battle.debug.B.t; SA.Battle.debug.step(0.1);
  assert(SA.Battle.debug.B.t > time, '拒绝投降后战斗没有恢复');
  assert.strictEqual(SA.Battle.debug.B.surrender, 'refused');
  view.supportsSurrenderAnimation = false; start();
  assert.strictEqual(SA.Battle.surrenderState().phase, 'asked', '旧画面被困在演出状态');
  assert(SA.Battle.acceptSurrender());
  return { duration: 3.5, frozen: true, skipAsksOnce: true, legacyViewCompatible: true };
}

/** 文本管理的真实客户端加载到无 DOM 的环境，HTTP 替身模拟刷新、错误与请求延迟。 */
async function textContext(memory, fetch) {
  const game = evolve.loadGame();
  Object.assign(game.context, { fetch, localStorage: { getItem: key => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value) } });
  game.context.document.readyState = 'loading'; game.context.document.body = null;
  vm.runInContext(source('text-manager.js'), game.context);
  vm.runInContext(source('story.js'), game.context);
  game.SA.Text.init(); await game.SA.Text.ready;
  return game.SA;
}

/** 验证结构化文案不污染默认剧情；文件加载、离线草稿、保存失败和连续 Ctrl+S 共用同一协议。 */
async function storyCheck() {
  const memory = new Map(); let server = { values: {} }, fail = false, release = null, posts = 0;
  const fetch = async (url, opts) => {
    if (!opts?.method) return { ok: true, json: async () => copy(server) };
    posts++;
    if (release) await release.promise;
    if (fail) return { ok: false, status: 500, json: async () => ({ error: '测试保存失败' }) };
    server = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ revision: String(posts) }) };
  };
  let SA = await textContext(memory, fetch);
  const D = SA.StoryData, original = copy(SA.STORY);
  const opening = D.get('opening'); opening[0].text = '不应污染原数据';
  assert.deepStrictEqual(copy(SA.STORY), original);
  D.set('opening', ['编辑后的醒来', ...original.opening.slice(1)]);
  assert.strictEqual(D.get('opening')[0].scene, 'sleep');
  assert.strictEqual(D.get('stage.0,0.win')[0].who, 'uncle');
  assert(D.get('tutorial.parts.0')[0].text.includes('驾驶舱'));
  const before = D.point('before', '0,0'), after = D.point('after', '0,0');
  assert.deepStrictEqual(copy(D.get(before)), []);
  D.set(before, [{ who: 'uncle', text: '战前测试：准备好了吗？' }]);
  D.set(after, ['战后测试：你收起了白旗。']);
  D.set(D.point('before'), ['普通对战也可插入剧情']);
  assert.throws(() => D.set('opening', [{ text: '错误角色', who: 'nobody' }]), /未知剧情角色/);
  assert.throws(() => D.set('opening', [{ text: '错误分镜', scene: 'bad' }]), /未知开场分镜/);
  assert.throws(() => D.set(before, ['']), /不能为空/);
  assert.throws(() => D.set(before, ['字'.repeat(10001)]), /保存上限/);
  assert.throws(() => D.set('stage.__proto__.win', ['禁止任意路径']), /无效剧情场景/);
  assert.throws(() => D.point('before', '99,99'), /无效剧情场景/);
  assert((await D.save()).ok);
  assert.strictEqual(JSON.parse(server.values[`story:${before}`])[0].text, '战前测试：准备好了吗？');
  SA = await textContext(new Map(), fetch);
  assert.strictEqual(SA.StoryData.get(after)[0].text, '战后测试：你收起了白旗。');
  D.set(after, ['保存失败仍保留本机草稿']); fail = true;
  assert.strictEqual((await D.save()).ok, false);
  SA = await textContext(memory, fetch);
  assert.strictEqual(SA.StoryData.get(after)[0].text, '保存失败仍保留本机草稿');
  fail = false; D.set(after, ['请求中的旧稿']);
  release = {}; release.promise = new Promise(resolve => { release.resolve = resolve; });
  const first = D.save(); await new Promise(resolve => setImmediate(resolve));
  D.set(after, ['请求期间的新稿']); const second = D.save();
  release.resolve(); release = null;
  assert.strictEqual((await first).pending, true, '旧请求清除了新稿的待保存标记');
  assert.strictEqual((await second).pending, false);
  assert.strictEqual(JSON.parse(server.values[`story:${after}`])[0].text, '请求期间的新稿');
  return { sceneCount: D.list().length, metadataPreserved: true, reload: true, offlineDraft: true, sequentialSaves: true };
}

async function run() { return { starter: starterCheck(), surrender: surrenderCheck(), story: await storyCheck() }; }
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error.stack || error.message); process.exitCode = 1;
});
module.exports = { run };
