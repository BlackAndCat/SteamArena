// 工作台纯会话回归：目标隔离、导入原子性、给定四件分享码。
// 只在内存加载游戏规则，不写正式关卡配置。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');
const Workbench = require('./workbench-session');

const { SA, context } = loadGame();
const code = 'SA2.eyJuIjoi5L+d5bqV5YCZ6YCJwrcyLTTCt+WPmOW8gjkwNzM5IiwiYiI6W1s4LDMsNF0sWzksMiwxNl0sWzksNSwyMF0sWzEwLDIsMF1dLCJzIjpbXSwiYSI6MiwicHYiOjIsIm1zIjpbXX0=';
const session = Workbench.create();
const A = { kind: 'stage', id: '1,4' }, B = { kind: 'stage', id: '1,5' };
const original = SA.V.clone(SA.Camp.stage(0, 0).vehicle);
session.select(A, original);
const imported = Workbench.parseVehicle(code, '保底候选', SA);
assert.strictEqual(Object.values(SA.V.countIds(imported)).reduce((a, b) => a + b, 0), 4);
assert.strictEqual(SA.V.stats(imported).canDeploy, true);
session.replace(imported);
const unfinished = Workbench.parseVehicle('[[0,3,4,"track"]]', '半成品', SA);
assert.strictEqual(SA.V.countIds(unfinished).track, 1);
assert.strictEqual(SA.V.stats(unfinished).canDeploy, false, '半成品允许导入继续编辑');
const rejectSave = SA.StageCars.validate({ cells: SA.StageCars.cellsOf(unfinished) }, 0, 0, unfinished);
assert.strictEqual(rejectSave.ok, false, '正式关卡仍拒绝未能出战的草稿');
for (const bad of ['', 'SA2.bad', '{', '[[0,0,0,"不存在的模块"]]', '[[0,0,0,"track"],[0,0,0,"boiler"]]']) {
  assert.throws(() => session.replace(Workbench.parseVehicle(bad, '', SA)));
  assert.strictEqual(session.vehicle(), imported, '坏码不得更换当前车');
}
const savedA = SA.V.clone(session.requireTarget(A));
session.select(B, original);
assert.throws(() => session.requireTarget(A), /目标已改变/);
assert.strictEqual(SA.V.countIds(savedA).cannon_m, 1, 'A 的快照不受切关影响');
session.select({ kind: 'candidate', id: 'arena-1' }, imported);
assert.throws(() => session.requireTarget(A), /目标已改变/);
assert.strictEqual(session.requireTarget({ kind: 'candidate', id: 'arena-1' }), imported);
// 后台父页不加载 Camp；旧布局候选仍须靠纯 StageCars 规则迁移后读取。
const oldCandidate = { version: 1, campaignLayout: 1, records: [{ id: 'old',
  record: { name: '旧候选', spec: { chapter: 0, stage: 1 }, cells: [] },
  parentKey: JSON.stringify([0, 1, []]), favorite: true }] };
context.localStorage.getItem = key => key === 'steam_arena_evolve_arena_v1' ? JSON.stringify(oldCandidate) : null;
SA.Camp = undefined;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/evolve-arena.js'), 'utf8'), context, { filename: 'js/evolve-arena.js' });
const migrated = SA.EvolveArena.get('old');
assert.strictEqual(migrated.record.spec.stage, 2);
assert.strictEqual(JSON.parse(migrated.parentKey)[1], 2);
console.log('工作台会话目标与四件导入检查通过');
