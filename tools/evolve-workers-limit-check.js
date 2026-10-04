/* 并行数边界回归：只验证入口参数，故意使用无效原点阻止任何战斗或 worker 创建。 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./evolve-config');
const evolve = require('./evolve');
const service = require('./evolve-service');

async function run() {
  assert.equal(config.maxWorkers, 14);
  assert(config.defaultWorkers >= 1 && config.defaultWorkers <= 8);
  const html = fs.readFileSync(path.join(__dirname, 'evolve.html'), 'utf8');
  assert(/id="run-workers"[^>]*max="14"/.test(html), '网页并行数上限未同步');

  const invalidOrigin = { name: '无效测试原点', cells: [] };
  for (const workers of [1, 14, null, undefined, '14']) {
    await assert.rejects(evolve.runAsync({ scope: { chapter: 1, stage: 4 }, workers,
      originVehicle: invalidOrigin }), /上一关不能出战/);
  }
  for (const workers of [0, -1, 15, NaN, 1.5, '14.5', true]) {
    await assert.rejects(evolve.runAsync({ scope: { chapter: 1, stage: 4 }, workers,
      originVehicle: invalidOrigin }), /并行数必须是 1～14 的整数/);
  }

  const settings = { population: config.population.size, generations: config.population.generations };
  try {
    for (const workers of [1, 14, null, undefined])
      await assert.rejects(service.generate({ scope: null, workers }), /请选择要生成的章节/);
    for (const workers of [0, -1, 15, NaN, 1.5, '14'])
      await assert.rejects(service.generate({ scope: null, workers }), /并行数必须是 1～14 的整数/);
  } finally {
    config.population.size = settings.population;
    config.population.generations = settings.generations;
  }
  return { min: 1, max: config.maxWorkers, default: config.defaultWorkers, battles: 0 };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { run };
