// 进化候选的 WebGPU 可行性基准。
//
// 这不是战斗模拟器：它把“候选已经完成战斗后，按统计字段做数值预筛”的
// 纯算术部分批量搬到 GPU，专门回答 GPU 能否覆盖调度瓶颈。碰撞、遮挡、AI、
// 热量和结束条件仍然属于分支密集的 battle.js，不能用这个页面冒充已 GPU 化。
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const WORKGROUP = 64;
  const SHADER = /* wgsl */`
struct Params { count: u32, _pad0: u32, _pad1: u32, _pad2: u32 }
@group(0) @binding(0) var<storage, read> features: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> scores: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

fn clampScore(value: f32) -> f32 { return clamp(value, 0.0, 100.0); }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= params.count) { return; }
  let a = features[index * 2u];
  let b = features[index * 2u + 1u];
  // 与 scoreCpu 完全相同的候选预筛权重；结果不是战斗表现分。
  let score = 40.0 + a.x * 1.7 + a.y * 0.03 + a.z * 0.01 + a.w * 0.15
    + b.z * 0.08 + b.w * 0.9 + b.y * 0.6 - b.x * 1.1;
  scores[index] = clampScore(score);
}`;

  // 固定种子输入：八个字段分别代表候选统计的可批量近似特征。
  function inputOf(count, seed = 0x9e3779b9) {
    const out = new Float32Array(count * 8);
    let x = seed >>> 0;
    for (let i = 0; i < out.length; i++) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      out[i] = (x / 0x100000000) * 100;
    }
    return out;
  }

  function scoreCpu(features) {
    const out = new Float32Array(features.length / 8);
    for (let i = 0, j = 0; i < out.length; i++, j += 8) {
      const value = 40 + features[j] * 1.7 + features[j + 1] * 0.03 + features[j + 2] * 0.01 + features[j + 3] * 0.15
        + features[j + 6] * 0.08 + features[j + 7] * 0.9 + features[j + 5] * 0.6 - features[j + 4] * 1.1;
      out[i] = Math.max(0, Math.min(100, value));
    }
    return out;
  }

  function adapterLabel(adapter) {
    const info = adapter?.info || {};
    return [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' / ') || 'WebGPU adapter（浏览器未提供名称）';
  }

  async function getDevice() {
    if (!navigator.gpu) return { adapter: null, device: null, error: '当前浏览器没有 navigator.gpu。请在支持 WebGPU 的浏览器中用 localhost 打开。' };
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { adapter: null, device: null, error: '浏览器未返回 WebGPU adapter。' };
    try { return { adapter, device: await adapter.requestDevice(), error: null }; }
    catch (error) { return { adapter, device: null, error: `requestDevice 失败：${error.message}` }; }
  }

  async function gpuScore(device, features, repeat = 1) {
    const count = features.length / 8;
    const input = device.createBuffer({ size: features.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readback = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(input, 0, features);
    device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
    const module = device.createShaderModule({ code: SHADER });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }, { binding: 2, resource: { buffer: params } },
    ] });
    // 先预热一次，排除 shader 编译和第一次分配的抖动。
    for (let warm = 0; warm < 1; warm++) {
      const command = device.createCommandEncoder(), pass = command.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP)); pass.end();
      command.copyBufferToBuffer(output, 0, readback, 0, count * 4); device.queue.submit([command.finish()]);
      await device.queue.onSubmittedWorkDone(); await readback.mapAsync(GPUMapMode.READ); readback.unmap();
    }
    let submitMs = 0, totalMs = 0, result = null;
    for (let n = 0; n < repeat; n++) {
      const start = performance.now(), command = device.createCommandEncoder(), pass = command.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP)); pass.end();
      const submitted = performance.now();
      device.queue.submit([command.finish()]);
      await device.queue.onSubmittedWorkDone();
      const done = performance.now(); submitMs += done - submitted;
      const copy = device.createCommandEncoder(); copy.copyBufferToBuffer(output, 0, readback, 0, count * 4); device.queue.submit([copy.finish()]);
      await readback.mapAsync(GPUMapMode.READ); result = new Float32Array(readback.getMappedRange().slice(0)); readback.unmap();
      totalMs += performance.now() - start;
    }
    input.destroy(); output.destroy(); readback.destroy(); params.destroy();
    return { result, submitMs: submitMs / repeat, totalMs: totalMs / repeat };
  }

  function compare(cpu, gpu) {
    let maxError = 0;
    for (let i = 0; i < cpu.length; i++) maxError = Math.max(maxError, Math.abs(cpu[i] - gpu[i]));
    return { maxError, ok: maxError <= 0.001 };
  }

  async function run() {
    const max = Math.max(1, Number($('size').value) || 16384);
    const repeat = Math.max(1, Math.min(5, Number($('repeat').value) || 3));
    $('status').textContent = '正在申请 WebGPU adapter……';
    const { adapter, device, error } = await getDevice();
    if (!device) return { available: false, error };
    const rows = [];
    for (const count of [4096, 16384, 65536, 262144, 1048576].filter(value => value <= max)) {
      const features = inputOf(count), cpuStart = performance.now(), cpu = scoreCpu(features), cpuMs = performance.now() - cpuStart;
      const gpu = await gpuScore(device, features, repeat), check = compare(cpu, gpu.result);
      rows.push({ count, cpuMs, gpuSubmitMs: gpu.submitMs, gpuTotalMs: gpu.totalMs, speedupWithReadback: cpuMs / gpu.totalMs, maxError: check.maxError, consistent: check.ok });
      if (!check.ok) break;
    }
    device.destroy();
    return { available: true, adapter: adapterLabel(adapter), rows, note: '仅测候选数值预筛算式；GPU 含回读时间，不能代表 battle.js 物理循环收益。' };
  }

  let last = {};
  function render(result) {
    last = result || {};
    $('status').innerHTML = result.available === false ? `<span class="bad">GPU 不可用：</span>${result.error}` : `<span class="ok">GPU 可用：</span>${result.adapter}<br><span class="muted">${result.note}</span>`;
    $('results').querySelector('tbody').innerHTML = (result.rows || []).map(row => `<tr><td>${row.count.toLocaleString()}</td><td>${row.cpuMs.toFixed(2)} ms</td><td>${row.gpuSubmitMs.toFixed(2)} ms</td><td>${row.gpuTotalMs.toFixed(2)} ms</td><td>${row.speedupWithReadback.toFixed(2)}×</td><td>${row.maxError.toExponential(2)}</td><td class="${row.consistent ? 'ok' : 'bad'}">${row.consistent ? '通过' : '失败'}</td></tr>`).join('');
    $('json').textContent = JSON.stringify(result, null, 2);
  }
  $('run').onclick = () => run().then(render).catch(error => render({ available: false, error: error.stack || error.message }));
  $('copy').onclick = () => navigator.clipboard?.writeText(JSON.stringify(last, null, 2));
})();
