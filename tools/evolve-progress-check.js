'use strict';

// 用真实 worker 事件验证整章、跨代、种子扩容和中途停止的总步数，不写任何报告文件。
const assert = require('assert');
const evolve = require('./evolve');
const config = require('./evolve-config');

/** 进度必须从零开始、总数固定且只增不减；只有所有工作结束才能计满。 */
function checkEvents(events, total, complete) {
  assert.strictEqual(events[0].completedSteps, 0);
  events.forEach((event, i) => {
    assert.strictEqual(event.totalSteps, total, '运行中总步数变化');
    assert(event.completedSteps >= (events[i - 1]?.completedSteps || 0), '跨阶段进度回退');
    assert(event.completedSteps <= total, '完成步数超出总数');
  });
  assert.strictEqual(events.at(-1).phase, complete ? 'complete' : 'interrupted');
  if (complete) assert.strictEqual(events.at(-1).completedSteps, total);
  else assert(events.at(-1).completedSteps < total, '停止后错误标记已完成');
}

async function run() {
  const before = { ...config.population }, { SA } = evolve.loadGame();
  try {
    Object.assign(config.population, { size: 4, generations: 2 });
    const spec = evolve.stageSpec(SA, 0, 1), seeds = [], keys = new Set();
    for (let i = 1; seeds.length < 5 && i < 100; i++) {
      const vehicle = evolve.randomVehicle(SA, spec, new evolve.RNG(i), 'plate');
      const cells = SA.StageCars.cellsOf(vehicle), key = JSON.stringify(cells);
      if (!keys.has(key)) { seeds.push({ spec, name: `进度种子${i}`, cells }); keys.add(key); }
    }
    assert.strictEqual(seeds.length, 5);
    const invalid = { spec, name: '非法种子', cells: [[0, 0, 0, 'missing_module', 1, 0]] };
    const events = [];
    const report = await evolve.runAsync({ scope: { chapter: 0 }, workers: 2, games: 1, seed: 774411,
      seeds: [...seeds, seeds[0], invalid], onProgress: event => events.push(event) });
    // 第二关合法种子扩容到 5 台，重复 / 无效种子不多算；三关各有整理、筛选两步。
    checkEvents(events, (4 + 5 + 4) * 2 + 3 * 2, true);
    assert.strictEqual(report.telemetry.completedCandidates, 26);
    assert.strictEqual(report.telemetry.completedSteps, 32);
    assert.strictEqual(report.seedWarnings.length, 1);
    assert.strictEqual(events.filter(e => e.phase === 'selection-end').length, 3);
    assert.strictEqual(events.filter(e => e.phase === 'generation-start').length, 6);

    let stop = false;
    const interrupted = [];
    await evolve.runAsync({ scope: { chapter: 0, stage: 0 }, workers: 2, games: 1, seed: 774411,
      shouldStop: () => stop, onProgress: event => { interrupted.push(event); if (event.phase === 'generation-end') stop = true; } });
    checkEvents(interrupted, 10, false);
    return { completedSteps: 32, candidates: 26, expandedSeeds: true, monotonic: true, stoppedIncomplete: true };
  } finally { Object.assign(config.population, before); }
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
