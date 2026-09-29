/*
 * 从实际车辆统计采集热量预测输入，供浏览器 WebGPU 差分与计时。
 * 只在检查用 VM 中挂钩，不修改 vehicle.js，不把 GPU 结果用于选关。
 * 用法：node tools/gpu-heat-fixture.js [输出路径]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evolve = require('./evolve');

function collect() {
  const { SA, context } = evolve.loadGame(), inputs = new Map();
  const original = fs.readFileSync(path.join(__dirname, '../js/vehicle.js'), 'utf8');
  // 原函数原样保留并临时导出；仅把 stats 的调用转给收集器，CPU 基准仍执行原函数。
  const source = original.replace('function stats(v) {', 'SA.heatReference = overheatTime;\n  function stats(v) {')
    .replace('s.overheat = overheatTime(', 's.overheat = SA.captureHeat(');
  if (!source.includes('s.overheat = SA.captureHeat(') || !source.includes('SA.heatReference = overheatTime;')) throw new Error('热量预测入口已变更，请更新采集器');
  SA.captureHeat = (...args) => {
    inputs.set(JSON.stringify(args), args);
    return SA.heatReference(...args);
  };
  vm.runInContext(source, context, { filename: 'js/vehicle.js' });
  for (let ch = 0; ch < SA.CAMPAIGN.length; ch++) {
    for (let st = 0; st < SA.CAMPAIGN[ch].stages.length; st++) SA.V.stats(evolve.stageFor(SA, ch, st).vehicle);
  }
  // 历史已筛选车覆盖不同材料、改装和模块组合；按当前规则重新计算，不沿用旧统计。
  const preview = JSON.parse(fs.readFileSync(path.join(__dirname, 'evolve-preview.json'), 'utf8'));
  for (const row of preview.candidates || []) if (row.cells) SA.V.stats(SA.V.fromCells(row.name, row.cells));
  const real = [...inputs.values()].map(args => ({ args, expected: finiteTime(SA.heatReference(...args)) }));
  const boundary = [];
  // 临界时刻两侧仅差 1e-9：检查上传到 f32 后合并的值是否改变半秒步进的首次过热时刻。
  for (const steps of [1, 2, 3, 9, 100, 101, 199, 599, 600]) {
    for (const offset of [-1e-9, 0, 1e-9]) {
      const gen = SA.K.HEAT_MAX / (steps * 0.5) - SA.K.IDLE_HEAT + SA.K.DISSIPATE + offset;
      const args = [gen, 0, 0, 0, 0, 1];
      boundary.push({ args, expected: finiteTime(SA.heatReference(...args)) });
    }
  }
  // 冷却、水耗尽和干散热也会触发分支；包含精确零、常量邻域与 GPU 范围外输入。
  for (const water of [0, 1e-35, 1, 100, 1e7]) for (const cool of [0, 1, 30, 60, 100]) {
    for (const offset of [-1e-9, 0, 1e-9]) {
      const args = [30 + offset, cool, water, 2, 4, 0.8];
      boundary.push({ args, expected: finiteTime(SA.heatReference(...args)) });
    }
  }
  const rng = new evolve.RNG(20260929), random = [];
  for (let i = 0; i < 8192; i++) {
    const args = [rng.next() * 200, rng.next() * 150, rng.next() * 2000, rng.next() * 10, rng.next() * 30, 0.2 + rng.next() * 0.8];
    // 每八项中的一项无水、一项无冷却，覆盖直接累积以及水量截断。
    if (i % 8 === 0) args[2] = 0;
    if (i % 8 === 1) args[1] = 0;
    random.push({ args, expected: finiteTime(SA.heatReference(...args)) });
  }
  const constants = Object.fromEntries(['IDLE_HEAT', 'DISSIPATE', 'HEAT_MAX', 'WATER_PER_HEAT', 'COOL_FULL'].map(key => [key, SA.K[key]]));
  return { version: 2, rules: evolve.ruleFingerprint(SA), constants, reference: SA.heatReference.toString(), coolRate: SA.coolRate.toString(), real, boundary, random };
}

// WGSL 无穷大不作为业务值：300 表示预测窗口结束仍未过热，所有有限结果均小于 300。
function finiteTime(value) { return Number.isFinite(value) ? value : 300; }
if (require.main === module) {
  const fixture = collect(), file = path.resolve(process.argv[2] || path.join(__dirname, 'out/gpu-heat-fixture.json'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(fixture));
  console.log(JSON.stringify({ file, rules: fixture.rules, real: fixture.real.length, boundary: fixture.boundary.length, random: fixture.random.length }));
}
module.exports = { collect };
