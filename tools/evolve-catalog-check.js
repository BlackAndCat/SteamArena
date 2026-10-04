/* 生成目录回归：远期缺配置关不挡住已有路线，也不能绕过实际生成校验。 */
'use strict';

const assert = require('node:assert/strict');
const evolve = require('./evolve');
const service = require('./evolve-service');
const config = require('./evolve-config');

async function run() {
  const catalog = service.catalog();
  assert(catalog.defaults && Array.isArray(catalog.chapters) && Array.isArray(catalog.unavailableStages));
  assert.equal(catalog.defaults.workers, config.defaultWorkers);
  const firstChapter = catalog.chapters.find(row => row.chapter === 1);
  const origin = firstChapter?.stages.find(row => row.stage === 2);
  assert(origin?.hasVehicle, '第一章第三关原点车必须留在可选目录');
  assert.equal(origin.maxAfter, 4, '后续数量上限不得跨过第三章缺配置关');
  assert(catalog.unavailableStages.some(row => row.chapter === 2 && row.stage === 0));
  assert(!catalog.chapters.some(row => row.chapter === 2), '缺配置远期关不能作为可生成选项');
  for (const chapter of catalog.chapters) for (const stage of chapter.stages) {
    assert(Number.isFinite(stage.budget) && Array.isArray(stage.modules), '可选关必须有真实生成规格');
    assert.deepEqual(Object.keys(stage).sort(), ['budget', 'hasVehicle', 'maxAfter', 'modules', 'name', 'previewRuleSource', 'stage', 'status'].sort());
  }

  // 目录只隔离有标记的缺配置错误；其他规格错误必须继续暴露。
  const originalPreview = evolve.previewStageSpec, unexpected = new Error('其他规格错误');
  evolve.previewStageSpec = () => { throw unexpected; };
  try { assert.throws(() => service.catalog(), error => error === unexpected); }
  finally { evolve.previewStageSpec = originalPreview; }

  const settings = { population: config.population.size, generations: config.population.generations };
  const request = { population: 4, generations: 1, games: 1, workers: 1, seed: 20261004 };
  const stop = new Error('目标关已开始');
  const { SA } = evolve.loadGame(), sourceSpec = evolve.previewStageSpec(SA, 1, 6);
  const vehicle = evolve.minimalVehicle(SA, sourceSpec), cells = [];
  assert(vehicle && evolve.legalVehicle(SA, vehicle, sourceSpec));
  SA.V.each(vehicle, (cell, r, c, layer) => cells.push([layer === 'side' ? 1 : 0, r, c, cell.id, cell.mt || 1, cell.lv || 0]));
  try {
    await assert.rejects(service.generate({ ...request, scope: { chapter: 1 } }, event => {
      if (event.phase === 'stage-start') throw stop;
    }), error => error === stop);
    await assert.rejects(service.generate({ ...request, scope: { chapter: 2, stage: 0 },
      originVehicle: { name: '测试原点', cells } }), error => error.code === 'EVOLVE_STAGE_CONFIG_MISSING');
  } finally {
    config.population.size = settings.population;
    config.population.generations = settings.generations;
  }
  return { selectableChapters: catalog.chapters.length, unavailableStages: catalog.unavailableStages.length,
    firstChapterMaxAfter: origin.maxAfter };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { run };
