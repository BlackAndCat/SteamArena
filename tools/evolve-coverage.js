/*
 * 当前模块表的生成覆盖检查。
 *
 * 这个脚本不是第二个生成器，而是逐件调用 tools/evolve.js 的真实候选路径，
 * 检查每个未退役模块能否在自己的解锁档位进入一台可出战车辆。它只输出摘要，
 * 不修改战役数据，也不把实验候选写入仓库。
 */
'use strict';

const { loadGame, stageSpec, RNG, randomVehicle, minimalVehicle } = require('./evolve');

function firstSpec(SA, id) {
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      const spec = stageSpec(SA, chapter, stage);
      if (spec.availableMods.includes(id)) return spec;
    }
  }
  return null;
}

function inspectModule(SA, id) {
  const spec = firstSpec(SA, id);
  if (!spec) return { module: id, found: false, reason: '没有解锁档位' };
  for (let attempt = 0; attempt < 80; attempt++) {
    const rng = new RNG(9000 + attempt * 97 + id.length);
    const vehicle = randomVehicle(SA, spec, rng, id) || minimalVehicle(SA, spec, id);
    if (!vehicle) continue;
    const count = SA.V.countIds(vehicle)[id] || 0;
    const stats = SA.V.stats(vehicle);
    if (count > 0 && stats.canDeploy) {
      return { module: id, found: true, chapter: spec.chapter, stage: spec.stage, count, canDeploy: true, value: stats.value, code: SA.V.encode(vehicle) };
    }
  }
  return { module: id, found: false, chapter: spec.chapter, stage: spec.stage, reason: '80 个固定种子候选都未同时满足放置与出战条件' };
}

function run() {
  const { SA } = loadGame();
  const rows = Object.keys(SA.MODULES).filter(id => !SA.MODULES[id].retired).sort().map(id => inspectModule(SA, id));
  return { rules: SA.RULES_VERSION || null, modules: rows, total: rows.length, found: rows.filter(row => row.found).length, missing: rows.filter(row => !row.found).map(row => row.module) };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));

module.exports = { firstSpec, inspectModule, run };
