/*
 * 双足后台验收总入口：数据、战斗、生成器专项，以及现存六关履带回归。
 * 旧快照只读，比较相同固定种子的实际战斗结算；不比较新增诊断字段。
 * 用法：node tools/biped-check.js [旧快照目录]
 */
'use strict';
const assert = require('assert');
const path = require('path');
const evolve = require('./evolve');

/** 提取原有稳定结算字段，排除不影响战斗的新统计接口。 */
function outcome(result) {
  return JSON.parse(JSON.stringify({ winner: result.winner, t: result.t, reason: result.reason,
    pDealt: result.pDealt, eDealt: result.eDealt, events: result.events, effectStats: result.effectStats }));
}

/** 现存六关只含履带，规则新增后同种子结算必须保持原样。 */
function campaignRegression(source) {
  const fixture = require('./biped-baseline-fixtures.json');
  const oldEvolve = source ? require(path.join(source, 'tools/evolve.js')) : null;
  const old = oldEvolve ? oldEvolve.loadGame().SA : null, current = evolve.loadGame().SA;
  const cases = [];
  for (const chapter of [0, 1]) for (const stage of [0, 1, 2]) {
    const record = fixture.vehicles.find(row => row.chapter === chapter && row.stage === stage);
    assert(record?.cells, `旧关卡构筑夹具缺失：${chapter}:${stage}`);
    for (const seed of [20261005, 20261006]) for (const swapped of [false, true]) {
      const duel = SA => {
        const entry = { ...record, vehicle: SA.V.fromCells('固定旧关卡车', record.cells) };
        const starter = SA.V.fromCells('固定旧开局车', fixture.starterCells);
        return SA.Battle.simulate({ p: swapped ? entry.vehicle : starter, e: swapped ? starter : entry.vehicle,
          pStyle: swapped ? entry.style : 'rush', eStyle: swapped ? 'rush' : entry.style,
          pAim: 0.8, eAim: 0.8, seed, terrain: entry.terrain || 'flat', bounds: entry.bounds,
          pStatMultipliers: swapped ? entry.statMultipliers : undefined,
          eStatMultipliers: swapped ? undefined : entry.statMultipliers });
      };
      const stored = fixture.cases.find(row => row.chapter === chapter && row.stage === stage && row.seed === seed && row.swapped === swapped);
      assert(stored, '固定旧结算夹具缺失');
      const expected = oldEvolve ? outcome(duel(old)) : stored.expected, actual = outcome(duel(current));
      assert.deepStrictEqual(actual, expected, `履带回归变化：章节${chapter}关${stage}种子${seed}换边${swapped}`);
      cases.push({ chapter, stage, seed, swapped, winner: actual.winner, seconds: actual.t });
    }
  }
  return { games: cases.length, cases };
}

/** 专项脚本各自拥有规则断言，本入口只负责组合与旧关卡结果对照。 */
function run(source) {
  const data = require('./biped-data-check').run();
  const refit = require('./knight-refit-check').run();
  const battle = require('./biped-battle-check').run();
  const generation = require('./biped-generation-check').run();
  const regression = campaignRegression(source ? path.resolve(source) : undefined);
  return { data, refit, battle, generation, regression };
}
if (require.main === module) console.log(JSON.stringify(run(process.argv[2]), null, 2));
module.exports = { run, campaignRegression, outcome };
