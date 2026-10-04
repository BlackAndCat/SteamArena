/* 首关同步与 worker 回归：固定种子下生成、筛选证据一致，正式数据不被预演改写。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function run() {
  const before = { ...config.population };
  const files = ['config/content.json', 'config/stage-cars.json', 'tools/evolve-preview.json'];
  const originals = files.map(file => fs.readFileSync(path.join(__dirname, '..', file)));
  try {
    Object.assign(config.population, { size: 4, generations: 1, maxExtraGenerations: 0 });
    const options = { seed: 20260929, games: 1, chapters: 1, firstStageOnly: true };
    const sync = evolve.run(options), async = await evolve.runAsync({ ...options, workers: 2 });
    for (const report of [sync, async]) {
      assert.strictEqual(report.chapters.length, 1);
      assert.strictEqual(report.chapters[0].stages.length, 1);
      assert(report.candidates.every(item => item.spec.chapter === 0 && item.spec.stage === 0), '混入其他关卡候选');
    }
    assert.strictEqual(async.status, sync.status, '同步与 worker 结果状态不一致');
    assert.strictEqual(JSON.stringify(async.chapters[0].stages[0]), JSON.stringify(sync.chapters[0].stages[0]),
      '同步与 worker 首关完整证据不一致');
    assert.strictEqual(async.rules, sync.rules, '同步与 worker 规则指纹不一致');
    for (let i = 0; i < files.length; i++)
      assert(originals[i].equals(fs.readFileSync(path.join(__dirname, '..', files[i]))), `预演覆盖了 ${files[i]}`);
    return { stages: 1, identicalAcrossWorkers: true, sourceFilesUnchanged: true };
  } finally { Object.assign(config.population, before); }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
