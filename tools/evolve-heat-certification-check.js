/* 热预热认证回归：用可控 runtime 返回覆盖精度与证明检查，不启动 GPU、不执行大规模进化。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const filename = require.resolve('./evolve');
// 只在本检查的内存模块中导出局部入口，生产模块不增加测试 API。
const local = new Module(filename, module);
local.filename = filename;
local.paths = Module._nodeModulePaths(path.dirname(filename));
local._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.checkPreheater = createThermalPreheater;\n', filename);
const { loadGame, checkPreheater } = local.exports;
const runtimePath = require.resolve('./evolve-gpu-heat');
require(runtimePath);
const runtimeModule = require.cache[runtimePath], originalExports = runtimeModule.exports;

async function scenario(precision, response, expectedSource) {
  const { SA } = loadGame();
  const vehicle = SA.V.fromAscii('认证检查车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs);
  assert(SA.V.place(vehicle, 'tank_s', 9, 9, 1).ok);
  const exact = SA.V.stats(vehicle).overheat;
  const exactSteps = Number.isFinite(exact) ? exact * 2 : 0;
  SA.V.clearThermalPredictions();
  let closed = false, requestedPrecision;
  runtimeModule.exports = { createGpuHeatRuntime: async options => {
    requestedPrecision = options.precision;
    return { available: true, predict: async inputs => {
      assert.equal(inputs.length, 1);
      return response;
    }, close: async () => { closed = true; } };
  } };
  const telemetry = { startedAt: Date.now() }, task = { vehicle };
  const preheater = await checkPreheater(SA, { gpuPrecision: precision }, telemetry);
  try {
    await preheater.prepare([task]);
    assert.equal(requestedPrecision, precision);
    assert.equal(task.thermalPredictions.length, 1);
    const prediction = task.thermalPredictions[0];
    assert.equal(prediction.source, expectedSource);
    assert.equal(prediction.steps, expectedSource === 'cpu' ? exactSteps : response.steps[0]);
    assert.equal(SA.V.thermalPrediction(prediction.input).source, expectedSource);
    assert.equal(telemetry.heat.cpuFallbacks, expectedSource === 'cpu' ? 1 : 0);
    assert.equal(telemetry.heat.gpuPredictions, expectedSource === 'gpu' ? 1 : 0);
    assert.equal(telemetry.heat.certified, expectedSource === 'gpu' && precision === 'certified' ? 1 : 0);
    assert.equal(telemetry.heat.approximate, precision === 'f32');
  } finally { await preheater.close(); }
  assert(closed);
}

(async () => {
  try {
    // 用显著不同于真实预测的数值，确保错误声明时真的重算而非重标 GPU 数值。
    await scenario('certified', { steps: [599], telemetry: { precision: 'f32', approximate: true, certified: 0 } }, 'cpu');
    await scenario('certified', { steps: [599] }, 'cpu');
    await scenario('certified', { steps: [599], telemetry: { precision: 'certified', approximate: false, certified: 0 } }, 'cpu');
    await scenario('certified', { steps: [599], telemetry: { precision: 'certified', approximate: false, certified: 1 } }, 'gpu');
    await scenario('f32', { steps: [599], telemetry: { precision: 'f32', approximate: true, certified: 0 } }, 'gpu');
    console.log('热预热认证检查通过：错精度、缺证明、错计数均精确 CPU 回退；正规认证及显式 f32 预热保留。');
  } finally { runtimeModule.exports = originalExports; }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
