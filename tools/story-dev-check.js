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
async function textContext(memory, fetch, capabilities = {}) {
  const game = evolve.loadGame();
  Object.assign(game.context, { fetch, localStorage: { getItem: key => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value) }, ...capabilities });
  game.context.document.readyState = 'loading'; game.context.document.body = null;
  vm.runInContext(source('text-manager.js'), game.context);
  vm.runInContext(source('story.js'), game.context);
  game.SA.Text.init(); await game.SA.Text.ready;
  return game.SA;
}

/** 模拟真实文件句柄协议与 IndexedDB，检查选择一次、自动保存、刷新及失败草稿。 */
async function directFileSaveCheck() {
  const memory = new Map(), handles = new Map();
  let content = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN', values: { 'file-probe': '文件原稿', 'file-only': '应保留' }, removedElements: [] });
  let permission = 'granted', permissionOnRequest = null, writeFails = false, release = null, pickerCalls = 0, abortNextPut = false;
  const handle = {
    name: 'zh-CN.json',
    async queryPermission() { return permission; },
    async requestPermission() { return permissionOnRequest || permission; },
    async getFile() { return { text: async () => content }; },
    async createWritable() {
      if (writeFails) throw new Error('磁盘写入失败');
      let pending;
      return { async write(text) { pending = text; }, async close() {
        if (release) await release.promise;
        content = pending;
      } };
    },
  };
  const indexedDB = { open() {
    const request = { result: { createObjectStore() {}, close() {}, transaction() {
      const tx = { objectStore() { return {
        get(key) { const item = { result: handles.get(key) }; queueMicrotask(() => { item.onsuccess(); tx.oncomplete(); }); return item; },
        put(value, key) { const item = { result: key }; queueMicrotask(() => {
          item.onsuccess();
          if (abortNextPut) { abortNextPut = false; tx.onabort(); }
          else { handles.set(key, value); tx.oncomplete(); }
        }); return item; },
      }; } }; return tx;
    } } };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess(); });
    return request;
  } };
  const capabilities = { indexedDB, showSaveFilePicker: async () => { pickerCalls++; return handle; } };
  const fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  let SA = await textContext(memory, fetch, capabilities);
  assert((await SA.Text.save()).ok);
  assert.strictEqual(JSON.parse(content).values['file-probe'], '文件原稿', '首次选择覆盖了既有文件');
  SA.Text.set('file-probe', '首次直写');
  assert((await SA.Text.save()).ok);
  assert.strictEqual(JSON.parse(content).values['file-probe'], '首次直写');
  assert.strictEqual(JSON.parse(content).values['file-only'], '应保留');
  assert.strictEqual(pickerCalls, 1);
  SA.Text.set('file-probe', '自动写入');
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.strictEqual(JSON.parse(content).values['file-probe'], '自动写入');
  assert.strictEqual(pickerCalls, 1, '后续编辑重新打开了文件选择器');
  const refreshedMemory = new Map();
  SA = await textContext(refreshedMemory, fetch, capabilities);
  assert.strictEqual(SA.Text.get('file-probe'), '自动写入', '刷新未优先读取文件句柄');
  SA.Text.set('file-probe', '旧请求');
  release = {}; release.promise = new Promise(resolve => { release.resolve = resolve; });
  const first = SA.Text.save(); await new Promise(resolve => setImmediate(resolve));
  SA.Text.set('file-probe', '新请求'); const second = SA.Text.save();
  release.resolve(); release = null;
  assert.strictEqual((await first).pending, true);
  assert.strictEqual((await second).pending, false);
  assert.strictEqual(JSON.parse(content).values['file-probe'], '新请求');
  SA.Text.reset();
  assert((await SA.Text.save()).ok);
  assert.deepStrictEqual(JSON.parse(content).values, {}, '清除覆盖没有写入空文件覆盖');
  writeFails = true; SA.Text.set('file-probe', '失败草稿');
  assert.strictEqual((await SA.Text.save()).ok, false);
  assert.strictEqual(JSON.parse(refreshedMemory.get('sa-text-steam-arena-zh-CN')).values['file-probe'], '失败草稿');
  writeFails = false; permission = 'denied';
  SA = await textContext(refreshedMemory, fetch, capabilities);
  assert.strictEqual(SA.Text.get('file-probe'), '失败草稿', '无权限时丢失草稿');
  assert.strictEqual((await SA.Text.save()).ok, false);
  assert.deepStrictEqual(JSON.parse(content).values, {}, '拒绝授权后仍写入文件');
  permission = 'prompt'; permissionOnRequest = 'granted';
  content = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN', values: { 'file-probe': '待授权文件' }, removedElements: [] });
  SA = await textContext(new Map(), fetch, capabilities);
  assert.strictEqual(SA.Text.get('file-probe'), '', '刷新时未经用户操作读取了待授权文件');
  assert((await SA.Text.save()).ok);
  assert.strictEqual(SA.Text.get('file-probe'), '待授权文件', '重新授权后空草稿覆盖了文件');
  assert.strictEqual(pickerCalls, 1, '重新授权时不应重新选择文件');
  permission = 'granted'; permissionOnRequest = null; content = '{无效 JSON';
  SA = await textContext(new Map(), fetch, capabilities);
  assert.strictEqual(SA.Text.get('file-probe'), '', '损坏文件不应覆盖本机草稿');
  SA.Text.set('file-probe', '重选后的内容');
  assert.strictEqual((await SA.Text.save()).ok, false, '损坏文件被直接覆盖');
  assert.strictEqual(content, '{无效 JSON');
  content = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN', values: {}, removedElements: [] });
  assert((await SA.Text.save()).ok);
  assert.strictEqual(JSON.parse(content).values['file-probe'], '重选后的内容');
  assert.strictEqual(pickerCalls, 3, '损坏文件未允许重新选择');
  handles.clear(); abortNextPut = true;
  SA = await textContext(new Map(), fetch, capabilities);
  SA.Text.set('file-probe', '事务中止仍写文件');
  assert((await SA.Text.save()).ok);
  assert.strictEqual(handles.size, 0, '中止的 IndexedDB 事务被误认为已经提交');
  assert.strictEqual(JSON.parse(content).values['file-probe'], '事务中止仍写文件');
  content = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN',
    values: { draft: '文件旧值', keep: '文件独有' }, removedElements: ['旧元素'] });
  SA = await textContext(new Map(), fetch, capabilities);
  SA.Text.set('draft', '草稿优先');
  assert((await SA.Text.save()).ok);
  assert.deepStrictEqual(JSON.parse(content).values, { draft: '草稿优先', keep: '文件独有' });
  assert.deepStrictEqual(JSON.parse(content).removedElements, ['旧元素']);
  handles.clear();
  SA = await textContext(new Map(), fetch, capabilities);
  SA.Text.reset(); SA.Text.set('only', '清除后的新字');
  assert((await SA.Text.save()).ok);
  assert.deepStrictEqual(JSON.parse(content).values, { only: '清除后的新字' }, '清除后编辑又复活旧文件');
  assert.deepStrictEqual(JSON.parse(content).removedElements, []);
  handles.clear(); content = '{损坏 JSON';
  const badMemory = new Map(); SA = await textContext(badMemory, fetch, capabilities);
  SA.Text.set('draft', '坏文件前草稿');
  assert.strictEqual((await SA.Text.save()).ok, false);
  assert.strictEqual(content, '{损坏 JSON', '损坏文件被覆盖');
  assert.strictEqual(JSON.parse(badMemory.get('sa-text-steam-arena-zh-CN')).dirty, true);
  handles.clear(); content = '';
  SA = await textContext(new Map(), fetch, capabilities);
  SA.Text.set('new', '空文件正常');
  assert((await SA.Text.save()).ok);
  assert.strictEqual(JSON.parse(content).values.new, '空文件正常');
  handles.clear();
  content = JSON.stringify({ version: 1, game: 'steam-arena', locale: 'zh-CN', values: { legacy: '旧 v1 文件' } });
  SA = await textContext(new Map(), fetch, capabilities);
  assert((await SA.Text.save()).ok);
  assert.strictEqual(JSON.parse(content).values.legacy, '旧 v1 文件', '缺少 removedElements 的 v1 文件被拒绝');
  handles.clear(); content = 'null';
  const nullMemory = new Map(); SA = await textContext(nullMemory, fetch, capabilities);
  SA.Text.set('draft', '非对象文件前草稿');
  assert.strictEqual((await SA.Text.save()).ok, false);
  assert.strictEqual(content, 'null', '非空 JSON null 被误当成空新文件');
  assert.strictEqual(JSON.parse(nullMemory.get('sa-text-steam-arena-zh-CN')).dirty, true);
  return { oneSelection: true, autoSave: true, reload: true, sequentialSaves: true, clearOverlays: true, failedDraft: true,
    deniedPermission: true, reauthorizedRead: true, brokenFileReselect: true, abortedHandleTransaction: true,
    existingFilePreserved: true, dirtyDraftMerged: true, resetIntentPreserved: true, badFileBlocked: true,
    emptyFileCreated: true, legacyFileAccepted: true, nonObjectBlocked: true };
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

async function run() { return { starter: starterCheck(), surrender: surrenderCheck(), story: await storyCheck(), directFile: await directFileSaveCheck() }; }
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error.stack || error.message); process.exitCode = 1;
});
module.exports = { run };
