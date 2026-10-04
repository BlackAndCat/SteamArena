// 原点车诊断回归：宽工作台可出战的构筑，在原点 5×4 限制内越界时必须逐件说明；只在内存运行。
'use strict';

const assert = require('node:assert/strict');
const evolve = require('./evolve');

async function main() {
  const { SA } = evolve.loadGame(), spec = evolve.previewStageSpec(SA, 1, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(spec.grid)), { cols: 5, rows: 4 });
  const legal = evolve.minimalVehicle(SA, spec), cells = [];
  // 将合法车整体向左移一个大格，保留模块和连接：完整工作台正常，原点范围发生越界。
  SA.V.each(legal, (cell, r, c, layer) => cells.push([layer === 'side' ? 1 : 0, r, c - 2, cell.id, cell.mt || 1, cell.lv || 0]));
  const originVehicle = { name: '推土机诊断夹具', cells }, original = JSON.stringify(originVehicle);
  const wide = SA.V.fromCells(originVehicle.name, cells);
  assert.equal(SA.V.stats(wide).canDeploy, true, '完整工作台中的夹具应正常出战');
  wide.lim = { ...spec.grid };
  const stats = SA.V.stats(wide);
  assert.equal(stats.canDeploy, false, '原点范围必须拒绝越界夹具');
  assert(stats.issues.length > 0);
  const options = { scope: { type: 'route-after', origin: { chapter: 1, stage: 4 }, count: 1 },
    originVehicle, workers: 1, games: 1 };
  function verify(error) {
    assert(error.message.includes('上一关不能出战：原点车「推土机诊断夹具」'));
    assert(error.message.includes('校验范围 5列×4层'));
    assert(!error.message.includes('车间里红色闪烁'), '关卡范围诊断不能宣称宽工作台会标红');
    assert(!error.message.includes('推进战役'), '关卡范围诊断不能引导作者推进玩家战役');
    for (const problem of stats.problems) assert(error.message.includes(problem.replace('（车间里红色闪烁）', '')));
    for (const issue of stats.issues) {
      const name = SA.MODULES[wide[issue.layer][issue.r][issue.c].id].name;
      const reason = issue.reason === SA.Config.text('vehicle_bd09be8e512a') ? '超出本关进化可用范围' : issue.reason;
      assert(error.message.includes(`${issue.layer === 'side' ? '侧挂层' : '主体层'}·${name}·子格第 ${issue.c + 1} 列、第 ${issue.r + 1} 行：${reason}`));
    }
    return true;
  }
  assert.throws(() => evolve.run(options), verify);
  await assert.rejects(evolve.runAsync(options), verify);
  assert.equal(JSON.stringify(originVehicle), original, '诊断不得改写原点输入');
  assert.deepEqual(JSON.parse(JSON.stringify(evolve.previewStageSpec(SA, 1, 4).grid)), { cols: 5, rows: 4 });
  console.log('原点车诊断专项通过：完整工作台合法、5×4 原点拒绝、同步与并行原因/模块/格位齐全、输入和范围不变');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
