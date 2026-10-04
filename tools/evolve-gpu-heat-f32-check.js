/**
 * 直接 f32 WebGPU 热预测与当前游戏热循环的硬件差分诊断。
 * 用法：node tools/evolve-gpu-heat-f32-check.js；整次运行有 30 秒看门狗。
 * 步数不一致逐项报告，不以容差掩盖；f32 结果不属于认证结果。
 */
'use strict';

const evolve = require('./evolve');
const { createGpuHeatRuntime, currentHeatRuleSHA256 } = require('./evolve-gpu-heat');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const staticOnly = process.argv.includes('--static');
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9)
  || 'Z:\\AI\\CodexTemp\\evolve-gpu-hybrid-heat-20261004.json';

const watchdog = setTimeout(() => {
  console.error('f32 热核差分测试超过 30 秒');
  process.exit(124);
}, 30000);

function fixtures(SA) {
  const base = { water: 0, shaftKw: 1, heatKw: 100, weaponKw: 0, cool: 0,
    dryCool: 0, waterSave: 1, capacity: 50, idleHeat: SA.K.IDLE_HEAT,
    dissipate: SA.K.DISSIPATE, coolFull: SA.K.COOL_FULL };
  const rows = [
    { label: '正常积热', input: base },
    { label: '水量耗尽', input: { ...base, water: 0.8, cool: 200, heatKw: 180 } },
    { label: '持续稳定', input: { ...base, water: 1000, cool: 200, heatKw: 180 } },
    { label: '首步过热', input: { ...base, heatKw: 20000 } },
    { label: '小于 1 的热容量', input: { ...base, capacity: 0.5, heatKw: 400 } },
  ];
  // 利用真实热循环二分首次过热临界值，专门观察 f32 舍入导致的边界偏移。
  for (const target of [1, 2, 30, 300, 600]) {
    let lo = 0, hi = 20000;
    for (let i = 0; i < 45; i++) {
      const mid = (lo + hi) / 2;
      const steps = cpuSteps(SA, { ...base, heatKw: mid });
      if (steps > 0 && steps <= target) hi = mid;
      else lo = mid;
    }
    for (const scale of [1 - 1e-7, 1, 1 + 1e-7])
      rows.push({ label: `临界 ${target} 步 × ${scale}`, input: { ...base, heatKw: hi * scale } });
  }
  let state = 20261004;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  for (let i = 0; i < 256; i++) rows.push({ label: `随机 ${i}`, input: {
    ...base, water: random() * 150, heatKw: random() * 500,
    weaponKw: random() * 200, cool: random() * 400,
    dryCool: random() * 100, capacity: 0.5 + random() * 300,
    waterSave: 0.2 + random() * 5,
  } });
  return rows;
}

function cpuSteps(SA, input) {
  return cpuForecast(SA, input).steps;
}

/** 直接调用现行游戏方程；0 步表示完整 600 步后仍未过热（时间 Infinity）。 */
function cpuForecast(SA, input) {
  let heat = 0, water = input.water;
  for (let step = 1; step <= 600; step++) {
    const next = SA.Phys.thermalStep(heat, water, 0.5, {
      shaftKw: input.shaftKw, heatKw: input.heatKw, weaponKw: input.weaponKw,
      cool: input.cool, dryCool: input.dryCool, waterSave: input.waterSave,
      capacity: input.capacity,
    });
    heat = next.heat; water = next.water;
    if (heat >= 100 * input.capacity) return { steps: step, time: step * 0.5, heat, water };
  }
  return { steps: 0, time: 'Infinity', heat, water };
}

/** 无设备静态回归：引用 predict 真正使用的装包函数，禁用初始化以避免启动 GPU。 */
function packingRegression(input) {
  let source = fs.readFileSync(path.join(__dirname, 'evolve-gpu-heat-page.html'), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.equal(source.split('const ready = initialize();').length, 2, '初始化锚点必须唯一');
  assert.equal(source.split('window.HeatKernel = { ready, predict };').length, 2, '接口锚点必须唯一');
  source = source.replace('const ready = initialize();', 'const ready = Promise.resolve();')
    .replace('window.HeatKernel = { ready, predict };', 'window.HeatKernel = { ready, predict, packInputs };');
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context);
  // 0.1 的最近 f32 位于原 double 上方；若误用 bounds.x，这条会失败。
  const value = 0.1, row = { ...input, heatKw: value }, near = Math.fround(value);
  assert.ok(near > value, '回归夹具必须覆盖向上舍入');
  const f32 = context.window.HeatKernel.packInputs([row], 'f32');
  const certified = context.window.HeatKernel.packInputs([row], 'certified');
  assert.equal(f32.unsupported.length, 0);
  assert.equal(f32.packed[4], near);
  assert.equal(f32.packed[5], near);
  assert.ok(certified.packed[4] < value && certified.packed[5] > value);
  return { value, near, f32: Array.from(f32.packed.slice(4, 6)),
    certified: Array.from(certified.packed.slice(4, 6)) };
}

function saveReport(report) {
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ status: report.status, mode: report.mode, count: report.count,
    exact: report.exact, mismatches: report.mismatches?.length, fallback: report.fallback?.length, output }));
}

async function main() {
  const { SA } = evolve.loadGame();
  const rows = fixtures(SA);
  const packing = packingRegression(rows[0].input);
  const cpu = rows.map(row => ({ label: row.label, ...cpuForecast(SA, row.input) }));
  assert.ok(cpu[1].water < rows[1].input.water, '真实 oracle 必须覆盖耗水');
  assert.equal(cpu[2].time, 'Infinity', '稳定夹具必须完整走完 600 步');
  assert.equal(cpu[4].time, 'Infinity', '容量 0.5 的夹具必须按真实被动散热完整运行');
  const invalid = [-1, Infinity, NaN].map(water => ({ ...rows[0].input, water }));
  const wrongRule = await createGpuHeatRuntime({ precision: 'f32', expectedRuleVersion: 'wrong' });
  const guard = await wrongRule.predict([rows[0].input]);
  if (wrongRule.available || guard.steps[0] !== -1) throw new Error('规则指纹不符时未回退');
  await wrongRule.close();
  if (staticOnly) {
    saveReport({ status: 'ok', mode: 'static', rule: currentHeatRuleSHA256(), count: rows.length,
      packing, cpu, ruleGuard: guard.telemetry });
    return;
  }

  const runtime = await createGpuHeatRuntime({ precision: 'f32' });
  try {
    if (!runtime.available) throw new Error(`硬件 GPU 不可用：${runtime.reason}`);
    // 同一 runtime 分两批及一次较大批，验证持久复用和缓冲区增长。
    const first = await runtime.predict(rows.slice(0, 20).map(row => row.input));
    const second = await runtime.predict(rows.slice(20).map(row => row.input));
    const invalidResult = await runtime.predict(invalid);
    if (invalidResult.steps.length !== invalid.length || invalidResult.steps.some(step => step !== -1))
      throw new Error('非法输入未回退 CPU');
    const steps = first.steps.concat(second.steps);
    if (steps.length !== rows.length || steps.some(step => !Number.isInteger(step) || step < -1 || step > 600))
      throw new Error('GPU 步数数组无效');
    if ([first, second].some(batch => batch.telemetry.precision !== 'f32' ||
        batch.telemetry.approximate !== true || batch.telemetry.certified !== 0))
      throw new Error('f32 遥测错误地声明为认证结果');
    const mismatches = [], fallback = [];
    for (let i = 0; i < rows.length; i++) {
      if (steps[i] === -1) fallback.push(rows[i].label);
      else {
        if (steps[i] !== cpu[i].steps) mismatches.push({ label: rows[i].label, gpu: steps[i],
          cpu: cpu[i], input: rows[i].input });
      }
    }
    saveReport({ status: 'ok', mode: 'hardware-f32', rule: currentHeatRuleSHA256(), count: rows.length,
      exact: rows.length - fallback.length - mismatches.length,
      packing, cpu, gpuSteps: steps, mismatches, fallback, invalid: invalidResult.telemetry,
      batches: [first.telemetry, second.telemetry].map(({ reasonCodes, ...rest }) => rest) });
  } finally { await runtime.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(() => clearTimeout(watchdog));
