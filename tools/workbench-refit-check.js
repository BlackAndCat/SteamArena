/* 工作台完整种子回归：使用真实车辆规则验证专项改造不会在导出、回读或关卡记录中丢失。
 * 仅在内存中构造测试车辆，不读写玩家存档或正式关卡配置。
 */
'use strict';
const assert = require('assert/strict');
const { loadGame } = require('./evolve.js');
const Workbench = require('./workbench-session.js');
const { SA } = loadGame();

// 分别覆盖无改造旧车、只有 refit 的腿与供冷件，以及唯一身份和改造同时存在的部件。
const cases = [
  ['普通旧车', [[0, 8, 6, 'biped', 3, 0]]],
  ['唯一旧腿', [[0, 8, 6, 'biped', 4, 0, { look: 'mail', unique: 'biped:mail' }]]],
  ...[1, 2, 3].map(refit => ['普通腿改造 ' + refit, [[0, 8, 6, 'biped', 3, 0, { refit }]]]),
  ['唯一腿与机组改造', [
    [0, 8, 6, 'biped', 4, 0, { look: 'mail', unique: 'biped:mail', refit: 3 }],
    [0, 6, 6, 'boiler_s', 3, 1, { refit: 2 }],
    [0, 6, 3, 'water', 3, 0, { refit: 1 }],
  ]],
];

// 经真实 fromCells 规范化后的 cells 是比较基准，允许引擎补齐标准外观，但不允许改造等级丢失。
for (const [name, cells] of cases) {
  const vehicle = SA.V.fromCells(name, cells);
  const expected = JSON.stringify(SA.StageCars.cellsOf(vehicle));
  assert.equal(SA.StageCars.cellsOf(vehicle).length, cells.length, name + '：测试部件必须完整装入');
  const exported = Workbench.exportVehicle(vehicle, SA);
  assert.equal(JSON.stringify(JSON.parse(exported).cells), expected, name + '：完整种子与关卡出口不一致');
  const restored = Workbench.parseVehicle(exported, '', SA);
  assert.equal(JSON.stringify(SA.StageCars.cellsOf(restored)), expected, name + '：回读改变了部件数据');
  for (const cell of cells) {
    if (!cell[6]?.refit) continue;
    const actual = JSON.parse(exported).cells.find(item => item[0] === cell[0] && item[1] === cell[1] && item[2] === cell[2]);
    assert.equal(actual?.[6]?.refit, cell[6].refit, name + '：专项改造等级未保留');
  }
}
console.log('工作台专项改造完整种子检查通过：' + cases.length + ' 组，无正式配置写入。');
