/* 首关预演回归：缩小范围不能改变同种子第一关结果，也不能覆盖战役或手工设计。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');
const config = require('./evolve-config');

/** 用小种群比较原整章入口、首关同步入口和 worker 入口的完整选关证据。 */
async function run() {
  const before = { ...config.population };
  const files = ['js/content.js', 'js/stage-cars.js', 'tools/evolve-preview.json'];
  const originals = files.map(file => fs.readFileSync(path.join(__dirname, '..', file)));
  try {
    Object.assign(config.population, { size: 4, generations: 1 });
    const options = { seed: 20260929, games: 1, chapters: 1 };
    const chapter = evolve.run(options), first = evolve.run({ ...options, firstStageOnly: true });
    const parallel = await evolve.runAsync({ ...options, firstStageOnly: true, workers: 2 });
    assert.strictEqual(chapter.chapters[0].stages.length, 2, '原整章预演范围发生变化');
    for (const report of [first, parallel]) {
      assert.strictEqual(report.chapters.length, 1, '首关预演多生成了章节');
      assert.strictEqual(report.chapters[0].stages.length, 1, '首关预演多生成了关卡');
      assert.strictEqual(JSON.stringify(report.chapters[0].stages[0]), JSON.stringify(chapter.chapters[0].stages[0]), '首关车辆或完整筛选证据发生变化');
      assert(report.candidates.every(item => item.spec.chapter === 0 && item.spec.stage === 0), '混入其他关卡候选');
      assert.strictEqual(report.rules, chapter.rules, '缩小预演范围不应改变规则指纹');
    }
    for (let i = 0; i < files.length; i++) assert(originals[i].equals(fs.readFileSync(path.join(__dirname, '..', files[i]))), `预演覆盖了 ${files[i]}`);
    return { stages: 1, identicalToChapter: true, identicalAcrossWorkers: true, sourceFilesUnchanged: true };
  } finally { Object.assign(config.population, before); }
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
