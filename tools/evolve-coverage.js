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
      if (SA.CAMPAIGN[chapter].stages[stage].unfinished) continue;   // 跳过去先做后面的关时留下的占位空关
      const spec = stageSpec(SA, chapter, stage);
      if (spec.availableMods.includes(id)) return spec;
    }
  }
  return null;
}

function specsFor(SA, id) {
  const out = [];
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      if (SA.CAMPAIGN[chapter].stages[stage].unfinished) continue;   // 跳过去先做后面的关时留下的占位空关
      const spec = stageSpec(SA, chapter, stage);
      if (spec.availableMods.includes(id)) out.push(spec);
    }
  }
  return out;
}

function inspectModule(SA, id) {
  const specs = specsFor(SA, id);
  if (!specs.length) return { module: id, found: false, specs: 0, reason: '没有解锁档位' };
  for (const spec of specs) for (let attempt = 0; attempt < 80; attempt++) {
      const rng = new RNG(9000 + attempt * 97 + id.length + spec.chapter * 101 + spec.stage);
      const vehicle = randomVehicle(SA, spec, rng, id) || minimalVehicle(SA, spec, id);
      if (!vehicle) continue;
      const count = SA.V.countIds(vehicle)[id] || 0;
      const stats = SA.V.stats(vehicle);
      if (count > 0 && stats.canDeploy) {
        return { module: id, found: true, chapter: spec.chapter, stage: spec.stage, count, canDeploy: true, value: stats.value, code: SA.V.encode(vehicle) };
      }
    }
  return { module: id, found: false, chapter: specs[0].chapter, stage: specs[0].stage, reason: '全部解锁档位的固定种子候选都未同时满足放置与出战条件' };
}

function run() {
  const { SA } = loadGame();
  const rows = Object.keys(SA.MODULES).filter(id => !SA.MODULES[id].retired).sort().map(id => inspectModule(SA, id));
  // 关卡布局 4 删掉后面的关以后，不少模块暂时没有解锁档位：单独列出，不算生成失败
  const untiered = rows.filter(row => row.specs === 0).map(row => row.module);
  return { rules: SA.RULES_VERSION || null, modules: rows, total: rows.length, found: rows.filter(row => row.found).length, missing: rows.filter(row => !row.found).map(row => row.module), untiered };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));

module.exports = { firstSpec, specsFor, inspectModule, run };
