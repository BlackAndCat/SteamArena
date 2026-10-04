'use strict';

const assert = require('assert');
const evolve = require('./evolve');

const { SA } = evolve.loadGame();
const spec = evolve.previewStageSpec(SA, 1, 4);
// 固定取自 seed 20261003 第四关独立复测入选车；回归不依赖重新跑进化。
const parentCells = [
  [0, 6, 6, 'cannon', 2, 0], [0, 8, 2, 'tank_tall', 1, 0],
  [0, 8, 3, 'tank_s', 1, 0], [0, 8, 4, 'boiler', 1, 0],
  [0, 8, 7, 'mg', 1, 0], [0, 9, 6, 'helmet', 1, 0], [0, 10, 6, 'track', 1, 0],
];
const parent = SA.V.fromCells('第四关固定父本', parentCells);
parent.lim = { cols: 5, rows: 3 };
const original = JSON.stringify(SA.StageCars.cellsOf(parent));
const adapted = evolve.adaptParentForStage(SA, parent, spec, new evolve.RNG(20261003));
assert(adapted, '应能在本关预算内继承实际父本并补齐两件奖励');
assert(evolve.legalVehicle(SA, adapted, spec));
assert.deepStrictEqual(spec.requiredModules, ['mortar_s', 'condenser']);
for (const id of ['cannon', 'mortar_s', 'condenser']) assert(SA.V.countIds(adapted)[id], `继承车缺少 ${id}`);
assert(SA.V.stats(adapted).value <= 830);
assert(adapted.name.includes(parent.name), '来源须指向实际父本');
assert.strictEqual(JSON.stringify(SA.StageCars.cellsOf(parent)), original, '不得改写前关入选车');
assert(SA.StageCars.cellsOf(adapted).some(cell => cell[3] === 'cannon' && cell[1] === 6 && cell[2] === 6), '应保留主炮原始布局');

// 父本携带未来件或越级材料时只能清理或降到本关允许值，不能借继承绕过白名单。
const tainted = SA.V.clone(parent);
SA.V.each(tainted, cell => {
  if (cell.id === 'mg') cell.id = 'mortar';
  if (cell.id === 'tank_s') cell.mt = 3;
});
const cleaned = evolve.adaptParentForStage(SA, tainted, spec, new evolve.RNG(20261004));
assert(cleaned && evolve.legalVehicle(SA, cleaned, spec));
assert(!SA.V.countIds(cleaned).mortar);
assert(SA.StageCars.cellsOf(cleaned).every(cell => spec.allowedMaterials.includes(cell[4])));

console.log('父本跨关适配与主炮保留检查通过');
