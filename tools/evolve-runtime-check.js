/* 无画面运行环境差分：同一份规则在原 VM 和优化 VM 中必须给出完全相同的车辆与逐局结果。 */
'use strict';
const assert = require('assert');
const vm = require('vm');
const evolve = require('./evolve');

/** 覆盖全部章节、地形和四种蓝图；比较完整战斗摘要，包括伤害、事件和模块效果。 */
function run(full = false) {
  const old = evolve.loadGame({ contextify: true }), current = evolve.loadGame();
  const oldSA = old.SA, SA = current.SA;
  assert.notStrictEqual(SA, oldSA, '不同运行环境不能共享游戏状态');
  assert(vm.runInContext('window === globalThis && SA === window.SA', current.context), '浏览器全局别名不一致');
  assert.strictEqual(evolve.ruleFingerprint(SA), evolve.ruleFingerprint(oldSA), '运行环境不能修改规则指纹');
  const rows = [];
  let vehicleChecks = 0;
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      const a = evolve.stageFor(oldSA, chapter, stage), b = evolve.stageFor(SA, chapter, stage);
      assert.strictEqual(JSON.stringify(oldSA.V.stats(a.vehicle)), JSON.stringify(SA.V.stats(b.vehicle)), '车辆统计发生变化');
      vehicleChecks++;
      const players = full ? SA.OFFICIAL_BLUEPRINTS : [SA.OFFICIAL_BLUEPRINTS[(chapter + stage) % SA.OFFICIAL_BLUEPRINTS.length]];
      for (const player of players) {
        const make = api => api.V.fromAscii(player.name, player.rows, player.sides || [], player.mt || 1, player.elite || [], player.subs || []);
        rows.push({ oldPlayer: make(oldSA), player: make(SA), oldEnemy: a.vehicle, enemy: b.vehicle,
          options: { seed: 20260929 + rows.length * 101, terrain: b.terrain || 'flat', pStyle: player.style || 'wander', eStyle: b.style || 'wander', eBoss: !!b.boss } });
      }
    }
  }
  const before = performance.now();
  const expected = rows.map(row => oldSA.Battle.simulate({ ...row.options, p: row.oldPlayer, e: row.oldEnemy }));
  const oldMs = performance.now() - before, after = performance.now();
  rows.forEach((row, i) => assert.strictEqual(JSON.stringify(SA.Battle.simulate({ ...row.options, p: row.player, e: row.enemy })), JSON.stringify(expected[i]), `第 ${i + 1} 局完整摘要变化`));
  const currentMs = performance.now() - after;
  // 同时检查随机生成和变异没有因运行环境变化而改变 RNG 消耗顺序。
  const oldSpec = evolve.stageSpec(oldSA, 2, 0), spec = evolve.stageSpec(SA, 2, 0);
  const oldRng = new evolve.RNG(91), rng = new evolve.RNG(91);
  const oldVehicle = evolve.randomVehicle(oldSA, oldSpec, oldRng), vehicle = evolve.randomVehicle(SA, spec, rng);
  assert.strictEqual(JSON.stringify(oldVehicle), JSON.stringify(vehicle), '随机车辆发生变化');
  for (let i = 0; i < 12; i++) assert.strictEqual(JSON.stringify(evolve.mutate(oldSA, oldVehicle, oldSpec, oldRng)), JSON.stringify(evolve.mutate(SA, vehicle, spec, rng)), '变异结果发生变化');
  return { nativeGlobals: !!vm.constants?.DONT_CONTEXTIFY, games: rows.length, vehicleChecks, mutations: 12, identical: true, oldMs, currentMs };
}
if (require.main === module) console.log(JSON.stringify(run(process.argv.includes('--full')), null, 2));
module.exports = { run };
