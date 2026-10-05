// 手工原点回归：完整工作台边缘的合法车可模拟，非法结构仍给出逐件诊断；自动候选同样使用完整车间。
'use strict';

const assert = require('node:assert/strict');
const evolve = require('./evolve');
const config = require('./evolve-config');

async function main() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(spec.grid)), { cols: 8, rows: 6 });
  const legal = evolve.minimalVehicle(SA, spec), cells = [];
  // 将合法车整体移到工作台最左边缘，保留模块和连接：手工与自动候选均可使用。
  let left = SA.K.COLS; SA.V.each(legal, (cell, r, c) => { left = Math.min(left, c); });
  SA.V.each(legal, (cell, r, c, layer) => cells.push([layer === 'side' ? 1 : 0, r, c - left, cell.id, cell.mt || 1, cell.lv || 0]));
  const originVehicle = { name: '推土机诊断夹具', cells }, original = JSON.stringify(originVehicle);
  const wide = SA.V.fromCells(originVehicle.name, cells);
  assert.equal(SA.V.stats(wide).canDeploy, true, '完整工作台中的夹具应正常出战');
  wide.lim = { ...spec.grid };
  const stats = SA.V.stats(wide);
  assert.equal(stats.canDeploy, true, '自动候选同样开放完整车间');
  assert.equal(evolve.legalVehicle(SA, wide, spec), true, '满格边缘构筑应通过自动候选规则');
  const overflow = SA.V.clone(wide); overflow.body[8][SA.K.COLS - 1] = SA.newCell('boiler');
  assert.equal(evolve.constructionConditions(SA, overflow, spec).grid, false, '模块跨越物理底图仍须拒绝');
  const options = { scope: { type: 'route-after', origin: { chapter: 1, stage: 4 }, count: 1 },
    originVehicle, workers: 1, games: 1, gpu: false };
  const before = { ...config.population };
  try {
    Object.assign(config.population, { size: 4, generations: 1, maxExtraGenerations: 0 });
    for (const report of [evolve.run(options), await evolve.runAsync(options)]) {
      const stage = report.chapters[0].stages[0];
      assert(stage.top.length > 0, '完整工作台原点必须完成实际候选模拟');
      for (const rec of stage.top) {
        const candidate = SA.V.fromCells(rec.name, rec.cells); candidate.lim = { ...stage.spec.grid };
        assert(evolve.legalVehicle(SA, candidate, stage.spec), '生成候选必须通过满格与其他规则');
      }
    }
  } finally { Object.assign(config.population, before); }
  // 移除锅炉，使真实动力结构非法；完整工作台仍须拒绝，而不能靠解除网格限制放行。
  const invalid = { name: originVehicle.name, cells: cells.filter(cell => cell[3] !== 'boiler') };
  const broken = SA.V.fromCells(invalid.name, invalid.cells), brokenStats = SA.V.stats(broken);
  assert.equal(brokenStats.canDeploy, false);
  function verify(error) {
    assert(error.message.includes('上一关不能出战：原点车「推土机诊断夹具」'));
    assert(error.message.includes('校验范围 8列×6层'));
    assert(!error.message.includes('车间里红色闪烁'), '关卡范围诊断不能宣称宽工作台会标红');
    assert(!error.message.includes('推进战役'), '关卡范围诊断不能引导作者推进玩家战役');
    for (const problem of brokenStats.problems) assert(error.message.includes(problem.replace('（车间里红色闪烁）', '')));
    for (const issue of brokenStats.issues) {
      const name = SA.MODULES[broken[issue.layer][issue.r][issue.c].id].name;
      const reason = issue.reason === SA.Config.text('vehicle_bd09be8e512a') ? '超出完整工作台可用范围' : issue.reason;
      assert(error.message.includes(`${issue.layer === 'side' ? '侧挂层' : '主体层'}·${name}·子格第 ${issue.c + 1} 列、第 ${issue.r + 1} 行：${reason}`));
    }
    return true;
  }
  assert.throws(() => evolve.run({ ...options, originVehicle: invalid }), verify);
  await assert.rejects(evolve.runAsync({ ...options, originVehicle: invalid }), verify);
  assert.equal(JSON.stringify(originVehicle), original, '诊断不得改写原点输入');
  assert.deepEqual(JSON.parse(JSON.stringify(evolve.previewStageSpec(SA, 1, 4).grid)), { cols: 8, rows: 6 });
  console.log('原点车专项通过：8×6 边缘车同步及并行模拟、非法动力拒绝、自动候选满格、物理越界拒绝与手工输入不变');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
