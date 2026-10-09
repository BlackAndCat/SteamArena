/* 出征预热验收：线程运行正式 Worker 脚本，完整比较计划、缓存失效与实时战斗隔离。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const root = path.resolve(__dirname, '..');

if (!isMainThread) {
  // Node 仅提供 Worker 传输与 importScripts；运行时桩和全部规则仍取正式浏览器脚本。
  const context = vm.createContext(vm.constants?.DONT_CONTEXTIFY);
  Object.assign(context, { console, performance, URL, setTimeout, clearTimeout, Uint8ClampedArray,
    self: context, postMessage: value => parentPort.postMessage(value),
    importScripts: (...names) => names.forEach(name => vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context, { filename: name })) });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/route-worker.js'), 'utf8'), context);
  parentPort.on('message', data => context.onmessage({ data }));
} else {
  const { runtime } = require('./route-check');
  const { fixtures } = require('./route-difficulty-check');
  const plain = value => JSON.parse(JSON.stringify(value));
  const workers = new Set();
  const workerErrors = [];
  /** 使用真实独立线程仿浏览器 Worker 接口，主线程的 SA 对象没有被共享。 */
  class BrowserWorker {
    constructor() {
      BrowserWorker.last = this;
      this.worker = new Worker(__filename); workers.add(this.worker);
      this.worker.on('message', data => { if (!data.ok) workerErrors.push(data.error); this.onmessage?.({ data }); });
      this.worker.on('error', error => this.onerror?.(error));
    }
    postMessage(value) { this.worker.postMessage(plain(value)); }
    terminate() { workers.delete(this.worker); this.worker.terminate(); }
  }
  async function run() {
    const rt = runtime(), { SA, context } = rt;
    const player = fixtures(SA).upgraded;
    SA.S.d.vehicle = player;
    SA.S.d.route = { routeRuns: { r2: 2 }, firstRoute: 'r2', dda: {} };
    const begin = performance.now(), expected = plain(SA.Route.prepare('r2', { vehicle: player }));
    const coldMs = performance.now() - begin;
    context.Worker = BrowserWorker;
    context.document.currentScript = { src: 'http://localhost:5173/js/route.js' };
    vm.runInContext(fs.readFileSync(path.join(root, 'js/route.js'), 'utf8'), context);
    const live = SA.Battle.startState({ mode: 'route', vehicle: player,
      routeData: SA.Route.prepare('r2', { vehicle: player, difficulty: false }) });
    const writes = rt.writes();
    const started = performance.now(), pending = SA.Route.preload('r2');
    assert.strictEqual(SA.Route.preparationStatus('r2'), 'pending');
    assert.strictEqual(SA.Route.preload('r2'), pending, '重复输入没有复用任务');
    // 主线程在预热期间仍推进实时战斗；预热完成不能恢复或覆盖这些最新帧。
    live.keys.right = true;
    for (let i = 0; i < 20; i++) rt.api().step(1 / 60);
    assert(live.t > 0, '主线程没有继续推进战斗');
    const before = JSON.stringify(live);
    assert(await pending, 'Worker 预热失败：' + workerErrors.join('；'));
    const workerMs = performance.now() - started;
    assert.strictEqual(JSON.stringify(live), before, '预热改变了实时战斗');
    assert.strictEqual(rt.writes(), writes, '预热写入存档');
    assert.strictEqual(SA.Route.preparationStatus('r2'), 'ready');
    const listBegin = performance.now();
    for (let i = 0; i < 30; i++) SA.Route.list();
    const listMs = (performance.now() - listBegin) / 30;
    const hotBegin = performance.now(), hot = SA.Route.prepare('r2', { vehicle: player });
    const hotMs = performance.now() - hotBegin;
    assert.deepStrictEqual(plain(hot), expected, '后台与同步的完整计划不一致');
    hot.encounters[0].name = '测试修改副本';
    assert.deepStrictEqual(plain(SA.Route.prepare('r2', { vehicle: player })), expected, '调用者污染缓存');
    // 所有仿真输入变化均不得命中原计划；恢复原输入后仍可精确命中。
    const cold = () => assert.strictEqual(SA.Route.preparationStatus('r2'), 'cold');
    player.name += '换车'; cold(); player.name = player.name.slice(0, -2);
    SA.S.d.route.routeRuns.r2++; cold(); SA.S.d.route.routeRuns.r2--;
    SA.S.d.route.dda.r2 = { 0: 0.85 }; cold(); delete SA.S.d.route.dda.r2;
    const module = SA.MODULES.mg_s, damage = module.dmg;
    module.dmg++; cold(); module.dmg = damage;
    const configured = SA.Route.getConfig(); configured.fuel.idleKw *= 2;
    const original = SA.Route.getConfig(); assert(SA.Route.configure(configured).ok); cold(); SA.Route.configure(original);
    SA.ROUTES.r2.len++; cold(); SA.ROUTES.r2.len--;
    const stage = Object.values(SA.StageCars.data.records)[0], aim = stage.aim;
    stage.aim = 0.123; cold(); if (aim === undefined) delete stage.aim; else stage.aim = aim;
    assert.strictEqual(SA.Route.preparationStatus('r2'), 'ready');
    // 新车请求在运行中再次过期时，应结束旧任务，只让最新请求进入缓存。
    const first = SA.Route.preload('r2', { seed: 81, runIndex: 1 });
    const oldWorker = BrowserWorker.last;
    const second = SA.Route.preload('r2', { seed: 82, runIndex: 1 });
    oldWorker.onerror(new Error('已终止旧任务的延迟错误'));
    assert.strictEqual(await first, false); assert(await second);
    assert.strictEqual(SA.Route.preparationStatus('r2', { seed: 81, runIndex: 1 }), 'cold');
    // 第四趟驾驶员校准和成熟路线两场决斗也必须逐字段一致，不能仅比较候选车 ID。
    for (const runIndex of [4, 5]) {
      if (runIndex === 5) SA.S.d.vehicle = fixtures(SA).middle;
      const options = { runIndex, vehicle: SA.S.d.vehicle };
      const reference = plain(SA.Route.prepare('r2', options));
      assert(await SA.Route.preload('r2', options));
      assert.deepStrictEqual(plain(SA.Route.prepare('r2', options)), reference, '第 ' + runIndex + ' 趟完整计划不一致');
    }
    assert.strictEqual(await SA.Route.preload('r2', { runIndex: 0 }), false, '非法任务应结束为失败');
    assert(await SA.Route.preload('r2', { runIndex: 1 }), '单任务错误不应禁用其他合法预热');
    const fallback = plain(SA.Route.prepare('r2', { runIndex: 1 }));
    context.Worker = class { constructor() { throw new Error('模拟浏览器不支持 Worker'); } };
    vm.runInContext(fs.readFileSync(path.join(root, 'js/route.js'), 'utf8'), context);
    assert.strictEqual(await SA.Route.preload('r2', { runIndex: 1 }), false);
    assert.deepStrictEqual(plain(SA.Route.prepare('r2', { runIndex: 1 })), fallback, 'Worker 失败改变同步回退');
    console.log(JSON.stringify({ completePlanEqual: true, liveBattleUnchanged: true, noSaveWrites: true,
      invalidation: ['vehicle', 'routeRuns', 'dda', 'modules', 'fuel', 'route', 'stageCars'], comparedRuns: [3, 4, 5], staleTaskCancelled: true,
      staleErrorIgnored: true, failedTaskRecovered: true, workerUnavailableFallback: true,
      coldMs: +coldMs.toFixed(2), hotMs: +hotMs.toFixed(2), workerMs: +workerMs.toFixed(2), listMs: +listMs.toFixed(2) }));
  }
  run().catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => { for (const worker of workers) worker.terminate(); });
}
