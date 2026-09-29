/*
 * 实际 overheatTime 的 WebGPU 试验；输入由 gpu-heat-fixture.js 从车辆统计采集。
 * CPU 执行原函数；GPU 用向外取整的区间认证分支，不确定项交回原函数。
 * 首次过热时刻必须严格一致。计时包含打包、上传、回读和 CPU 复核。
 * 仅用于试验，不接入正式筛选。
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), WORKGROUP = 64;
  const SHADER = /* wgsl */`
struct Params {
  head: vec4<u32>, idle: vec2<f32>, dissipate: vec2<f32>, maxHeat: vec2<f32>,
  waterPerHeat: vec2<f32>, coolFull: vec2<f32>, minCool: vec2<f32>
}
@group(0) @binding(0) var<storage, read> inputs: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> times: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

// 每个 vec2 表示原 JS 双精度值的下界 / 上界。WGSL 的加减乘正确舍入，
// 除法允许 2.5 ULP 误差；跨二进制幂边界时 ULP 大小翻倍，保守外扩 8 格。
// 加减乘外扩 1 格，位转换阻断跨步骤的浮点合并。规范：w3.org/TR/WGSL/#floating-point-accuracy
// 接近次正规数时直接扩大到正规数范围，兼容设备的 flush-to-zero 行为。
fn down(v: f32, n: u32) -> f32 {
  if (abs(v) < 0x1p-120f) { return -0x1p-120f; }
  return bitcast<f32>(select(bitcast<u32>(v) - n, bitcast<u32>(v) + n, v < 0.0));
}
fn up(v: f32, n: u32) -> f32 {
  if (abs(v) < 0x1p-120f) { return 0x1p-120f; }
  return bitcast<f32>(select(bitcast<u32>(v) + n, bitcast<u32>(v) - n, v < 0.0));
}
fn zero(a: vec2<f32>) -> bool { return all(a == vec2(0.0)); }
fn add(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  if (zero(a)) { return b; }
  if (zero(b)) { return a; }
  return vec2(down(a.x + b.x, 1u), up(a.y + b.y, 1u));
}
fn sub(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  if (zero(b)) { return a; }
  if (a.x == a.y && all(a == b)) { return vec2(0.0); }
  return vec2(down(a.x - b.y, 1u), up(a.y - b.x, 1u));
}
fn mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  if (zero(a) || zero(b)) { return vec2(0.0); }
  let v = vec4(a.x * b.x, a.x * b.y, a.y * b.x, a.y * b.y);
  return vec2(down(min(min(v.x, v.y), min(v.z, v.w)), 1u), up(max(max(v.x, v.y), max(v.z, v.w)), 1u));
}
// 只在热量、水和 COOL_FULL 已确认是正数的冷却分支调用。
fn divPositive(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2(down(a.x / b.y, 8u), up(a.y / b.x, 8u));
}
// 实数冷却函数 max(0, h - cool * clamp(h/full, 0.15, 1) / 2)
// 对 h 单调不减、对 cool 单调不增；其中斜率为负的区段已被 max(0, ...) 截断。
// 分别求端点，保留 heat 与冷却量的相关性，避免直接做两个区间相减而每步放大误差。
fn cooledPoint(h: f32, cool: f32, full: f32, floorRate: f32) -> vec2<f32> {
  let rate = max(vec2(floorRate), min(vec2(1.0), divPositive(vec2(h), vec2(full))));
  return max(vec2(0.0), sub(vec2(h), mul(mul(vec2(cool), rate), vec2(0.5))));
}
fn cooledHeat(heat: vec2<f32>, cool: vec2<f32>) -> vec2<f32> {
  let low = cooledPoint(heat.x, cool.y, params.coolFull.x, params.minCool.y).x;
  let high = cooledPoint(heat.y, cool.x, params.coolFull.y, params.minCool.x).y;
  // 原 JS 的除法、乘法、减法相对实数公式会有 double 舍入误差。
  // 输入有界且非负，冷却倍率 <= 1，绝对误差 < 16u * (h + cool + 1)，u=2^-53。
  // 端点包围实数公式后再加入此界；不能仅假设浮点函数本身严格单调。
  let error = mul(add(add(vec2(heat.y), vec2(cool.y)), vec2(1.0)), vec2(0x1p-49f)).y;
  return max(vec2(0.0), vec2(down(low - error, 1u), up(high + error, 1u)));
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.head.x) { return; }
  let base = i * 6u;
  let gain = mul(sub(add(inputs[base], params.idle), params.dissipate), vec2(0.5));
  let cool = inputs[base + 1u];
  let drain = mul(inputs[base + 3u], vec2(0.5));
  let dry = mul(inputs[base + 4u], vec2(0.5));
  let save = inputs[base + 5u];
  var heat = vec2(0.0);
  var water = inputs[base + 2u];
  var result = 300.0;
  for (var step = 0u; step < 600u; step++) {
    heat = add(heat, gain);
    water = max(vec2(0.0), sub(water, drain));
    if (water.x > 0.0 && heat.x > 0.0) {
      let cooling = mul(mul(cool, max(params.minCool, min(vec2(1.0), divPositive(heat, params.coolFull)))), vec2(0.5));
      let c = min(heat, cooling);
      // 整个区间都被冷却掉时，原函数严格执行 heat - heat = 0。
      if (cooling.x >= heat.y) { heat = vec2(0.0); }
      else { heat = cooledHeat(heat, cool); }
      water = sub(water, mul(mul(c, params.waterPerHeat), save));
    } else if (water.y > 0.0 && heat.y > 0.0) {
      result = -1.0; break; // 分支不确定，回到原 CPU 函数
    }
    heat = max(vec2(0.0), sub(heat, dry));
    if (heat.x >= params.maxHeat.y) { result = f32(step) * 0.5; break; }
    if (heat.y >= params.maxHeat.x) { result = -1.0; break; }
  }
  times[i] = result;
}`;

  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const timeValue = value => Number.isFinite(value) ? value : 300;

  /** 保留原始双精度输入；若先转 f32 再跑 CPU，会漏掉上传精度损失造成的分支变化。 */
  function inputOf(rows, count) {
    const out = new Float64Array(count * 8);
    for (let i = 0; i < count; i++) out.set(rows[i % rows.length].args, i * 8);
    return out;
  }

  function scoreCpu(reference, features) {
    const out = new Float32Array(features.length / 8);
    for (let i = 0, j = 0; i < out.length; i++, j += 8) out[i] = timeValue(reference(features[j], features[j + 1], features[j + 2], features[j + 3], features[j + 4], features[j + 5]));
    return out;
  }

  /** 上传两个包围原始 double 的 f32，而不是只上传会丢失临界信息的最近值。 */
  const boundFloat = new Float32Array(1), boundBits = new Uint32Array(boundFloat.buffer);
  function putBounds(out, offset, value) {
    const nearest = Math.fround(value), f = boundFloat, bits = boundBits;
    f[0] = nearest;
    out[offset] = nearest; out[offset + 1] = nearest;
    if (nearest > value) { bits[0] += nearest > 0 ? -1 : 1; out[offset] = f[0]; }
    else if (nearest < value) { bits[0] += nearest >= 0 ? 1 : -1; out[offset + 1] = f[0]; }
  }

  /** 输入范围守卫使区间运算不会溢出；范围外仍由原函数计算，绝不静默裁剪。 */
  function packInput(features) {
    const count = features.length / 8, data = new Float32Array(count * 12), fallback = [];
    for (let i = 0; i < count; i++) {
      let supported = true;
      for (let j = 0; j < 6; j++) {
        const value = features[i * 8 + j];
        if (!Number.isFinite(value) || value < 0 || value > 1e6 || (value !== 0 && value < 1e-30)) { supported = false; break; }
      }
      if (!supported) { fallback.push(i); continue; }
      for (let j = 0; j < 6; j++) putBounds(data, i * 12 + j * 2, features[i * 8 + j]);
    }
    return { data, fallback };
  }

  /** 复用管线与缓冲区；每次计时均重新打包、上传输入，模拟真实候选批量。 */
  function gpuKernel(device, pipeline, constants, count, reference) {
    const input = device.createBuffer({ size: count * 48, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readback = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const params = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const data = new Float32Array(16);
    [constants.IDLE_HEAT, constants.DISSIPATE, constants.HEAT_MAX, constants.WATER_PER_HEAT, constants.COOL_FULL, 0.15].forEach((value, i) => {
      if (!(value >= 1e-20 && value <= 1e6)) throw new Error('当前热量常数超出 GPU 区间认证范围');
      putBounds(data, 4 + i * 2, value);
    });
    new Uint32Array(data.buffer)[0] = count;
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }, { binding: 2, resource: { buffer: params } },
    ] });
    return {
      async execute(features) {
        const start = performance.now();
        const packed = packInput(features);
        device.queue.writeBuffer(input, 0, packed.data);
        device.queue.writeBuffer(params, 0, data);
        const command = device.createCommandEncoder(), pass = command.beginComputePass();
        pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP)); pass.end();
        command.copyBufferToBuffer(output, 0, readback, 0, count * 4);
        device.queue.submit([command.finish()]);
        const submitMs = performance.now() - start;
        // 回读排在 dispatch 后；mapAsync 已等待对应拷贝，无需额外空等一轮队列。
        await readback.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readback.getMappedRange().slice(0));
        readback.unmap();
        for (const i of packed.fallback) result[i] = -1;
        let fallbackCount = 0;
        const fallbackStart = performance.now();
        for (let i = 0; i < count; i++) if (result[i] === -1) {
          const j = i * 8;
          result[i] = timeValue(reference(features[j], features[j + 1], features[j + 2], features[j + 3], features[j + 4], features[j + 5]));
          fallbackCount++;
        }
        return { result, submitMs, fallbackCount, fallbackMs: performance.now() - fallbackStart, totalMs: performance.now() - start };
      },
      destroy() { input.destroy(); output.destroy(); readback.destroy(); params.destroy(); },
    };
  }

  function compare(cpu, gpu) {
    let maxError = 0, mismatches = 0;
    const examples = [];
    for (let i = 0; i < cpu.length; i++) {
      if (cpu[i] === gpu[i]) continue;
      mismatches++; maxError = Math.max(maxError, Math.abs(cpu[i] - gpu[i]));
      if (examples.length < 5) examples.push({ index: i, cpu: cpu[i], gpu: gpu[i] });
    }
    return { count: cpu.length, maxError, mismatches, consistent: mismatches === 0, examples };
  }

  async function run() {
    const max = Math.max(1, Number($('size').value) || 16384), repeat = Math.max(1, Math.min(5, Number($('repeat').value) || 3));
    if (!navigator.gpu) throw new Error('当前浏览器没有 WebGPU，请用支持它的浏览器通过 localhost 打开。');
    const response = await fetch('out/gpu-heat-fixture.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('请先运行 node tools/gpu-heat-fixture.js 生成当前规则夹具。');
    const fixture = await response.json(), K = fixture.constants, SA = { K };
    // 夹具来自本仓库脚本；原函数与 GPU 保持独立，避免抄写 CPU 参考公式。
    SA.coolRate = new Function('SA', 'return (' + fixture.coolRate + ');')(SA);
    const reference = new Function('K', 'SA', 'return (' + fixture.reference + ');')(K, SA);
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('浏览器未返回 WebGPU adapter。');
    const device = await adapter.requestDevice(), setupStart = performance.now();
    try {
      const module = device.createShaderModule({ code: SHADER });
      const compilation = await module.getCompilationInfo();
      const errors = compilation.messages.filter(message => message.type === 'error');
      if (errors.length) throw new Error(errors.map(message => message.message).join('\n'));
      const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      const setupMs = performance.now() - setupStart, validation = {};
      for (const key of ['real', 'boundary', 'random']) {
        const cases = fixture[key], input = inputOf(cases, cases.length), cpu = scoreCpu(reference, input);
        if (!compare(new Float32Array(cases.map(row => row.expected)), cpu).consistent) throw new Error('浏览器 CPU 与夹具原始结果不一致');
        const kernel = gpuKernel(device, pipeline, K, cases.length, reference);
        try {
          const gpu = await kernel.execute(input);
          validation[key] = { ...compare(cpu, gpu.result), fallbackCount: gpu.fallbackCount };
        }
        finally { kernel.destroy(); }
      }
      const rows = [];
      for (const count of [24, 96, 384, 1632, 4096, 16384, 65536, 262144, 1048576].filter(n => n <= max)) {
        $('status').textContent = '正在测试 ' + count.toLocaleString() + ' 个热量预测（含上传和回读）……';
        const input = inputOf(fixture.real, count), kernel = gpuKernel(device, pipeline, K, count, reference);
        const cpuTimes = [], gpuTimes = [], submitTimes = [], fallbackTimes = [];
        // 小批次短于浏览器时钟分辨率；累计多次再取每批均值，避免把 CPU 耗时记成 0。
        const cpuRepeats = Math.max(1, Math.ceil(4096 / count));
        let cpu, gpu;
        try {
          // CPU / GPU 各预热两次；计时轮次交错顺序，降低固定先后次序对结果的影响。
          for (let i = 0; i < 2; i++) { scoreCpu(reference, input); await kernel.execute(input); }
          const measureCpu = () => {
            const start = performance.now();
            for (let n = 0; n < cpuRepeats; n++) cpu = scoreCpu(reference, input);
            cpuTimes.push((performance.now() - start) / cpuRepeats);
          };
          const measureGpu = async () => { gpu = await kernel.execute(input); gpuTimes.push(gpu.totalMs); submitTimes.push(gpu.submitMs); fallbackTimes.push(gpu.fallbackMs); };
          for (let i = 0; i < repeat; i++) {
            if (i % 2) { await measureGpu(); measureCpu(); } else { measureCpu(); await measureGpu(); }
          }
          const cpuMs = median(cpuTimes), totalMs = median(gpuTimes);
          rows.push({ count, cpuMs, gpuSubmitMs: median(submitTimes), gpuTotalMs: totalMs, fallbackCount: gpu.fallbackCount, fallbackMs: median(fallbackTimes), speedupWithReadback: cpuMs / totalMs, ...compare(cpu, gpu.result) });
        } finally { kernel.destroy(); }
      }
      const info = adapter.info || {};
      return { available: true, adapter: [info.vendor, info.architecture, info.device].filter(Boolean).join(' / '), rules: fixture.rules,
        repeat, setupMs, validation, eligible: Object.values(validation).every(row => row.consistent) && rows.every(row => row.consistent), rows,
        note: '真实热量预测循环；300 表示窗口内未过热。GPU 区间不确定项交回原 CPU 函数，耗时已包含打包、上传、回读及复核，初始化另列；尚未接入生成器。' };
    } finally { device.destroy(); }
  }

  let last = {};
  function render(result) {
    last = result;
    $('status').textContent = result.available === false ? 'GPU 测试失败：' + result.error
      : 'GPU：' + result.adapter + '；实际车辆差异 ' + result.validation.real.mismatches + '/' + result.validation.real.count
        + '，临界输入差异 ' + result.validation.boundary.mismatches + '/' + result.validation.boundary.count
        + '，随机输入差异 ' + result.validation.random.mismatches + '/' + result.validation.random.count + '。' + result.note;
    $('results').querySelector('tbody').innerHTML = (result.rows || []).map(row => '<tr><td>' + row.count.toLocaleString() + '</td><td>'
      + row.cpuMs.toFixed(2) + ' ms</td><td>' + row.gpuSubmitMs.toFixed(2) + ' ms</td><td>' + row.gpuTotalMs.toFixed(2)
      + ' ms</td><td>' + row.speedupWithReadback.toFixed(2) + '×</td><td>' + row.maxError.toFixed(1) + ' s</td><td class="'
      + (row.consistent ? 'ok' : 'bad') + '">' + (row.consistent ? '通过' : row.mismatches + ' 项差异') + '</td></tr>').join('');
    $('json').textContent = JSON.stringify(result, null, 2);
  }
  $('run').onclick = async () => {
    $('run').disabled = true;
    try { render(await run()); } catch (error) { render({ available: false, error: error.message }); }
    finally { $('run').disabled = false; }
  };
  $('copy').onclick = () => navigator.clipboard?.writeText(JSON.stringify(last, null, 2));
})();
