/* 侧挂保底构筑回归：使用真实关卡规格和出战校验，不放宽奖励、预算或网格。 */
'use strict';

const assert = require('assert');
const evolve = require('./evolve');

function run() {
  const { SA } = evolve.loadGame();
  const rows = [];
  for (const [chapter, stage, id] of [[1, 1, 'periscope'], [1, 2, 'side_cannon'], [1, 2, 'boss_lens']]) {
    const spec = evolve.stageSpec(SA, chapter, stage);
    const vehicle = evolve.minimalVehicle(SA, spec, id);
    assert(vehicle, `${id} 保底车未生成`);
    const conditions = evolve.constructionConditions(SA, vehicle, spec);
    assert(Object.values(conditions).every(Boolean), `${id} 保底车未满足正式约束：${JSON.stringify(conditions)}`);
    const side = [];
    SA.V.each(vehicle, (cell, r, c, layer) => { if (layer === 'side') side.push({ id: cell.id, r, c }); });
    assert(side.some(cell => cell.id === id), `${id} 未装车`);
    for (const cell of side) assert(SA.V.sideHost(vehicle, cell.id, cell.r, cell.c), `${cell.id} 缺少合法宿主`);
    for (const required of spec.requiredModules || []) assert(SA.V.countIds(vehicle)[required], `${id} 丢失必带件 ${required}`);
    rows.push({ id, value: SA.V.stats(vehicle).value, required: spec.requiredModules, side: side.map(cell => cell.id) });
  }
  return rows;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
