/*
 * 实际 overheatTime 的 WebGPU 试验；输入由 gpu-heat-fixture.js 从车辆统计采集。
 * CPU 执行原函数，GPU 的首次过热时刻必须严格一致。计时包含打包、上传和回读。
 * 仅用于试验，不接入正式筛选。
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), WORKGROUP = 64;
  const SHADER = /* wgsl */`
struct Params {
  count: u32, idle: f32, dissipate: f32, maxHeat: f32,
  waterPerHeat: f32, coolFull: f32, _pad0: f32, _pad1: f32
}
@group(0) @binding(0) var<storage, read> inputs: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> times: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  let a = inputs[i * 2u]; // 产热、冷却、水、武器耗水
  let b = inputs[i * 2u + 1u]; // 干散热、省水倍率
  var heat = 0.0;
  var water = a.z;
  var result = 300.0;
  for (var step = 0u; step < 600u; step++) {
    heat += (a.x + params.idle - params.dissipate) * 0.5;
    water = max(0.0, water - a.w * 0.5);
    if (water > 0.0 && heat > 0.0) {
      let c = min(heat, a.y * max(0.15, min(1.0, heat / params.coolFull)) * 0.5);
      heat -= c;
      water -= c * params.waterPerHeat * b.y;
    }
    heat = max(0.0, heat - b.x * 0.5);
    heat = max(0.0, heat);
    if (heat >= params.maxHeat) { result = f32(step) * 0.5; break; }
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

  /** 复用管线与缓冲区；每次计时均重新打包、上传输入，模拟真实候选批量。 */
  function gpuKernel(device, pipeline, constants, count) {
    const input = device.createBuffer({ size: count * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readback = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const params = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const data = new Float32Array([0, constants.IDLE_HEAT, constants.DISSIPATE, constants.HEAT_MAX, constants.WATER_PER_HEAT, constants.COOL_FULL, 0, 0]);
    new Uint32Array(data.buffer)[0] = count;
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }, { binding: 2, resource: { buffer: params } },
    ] });
    return {
      async execute(features) {
        const start = performance.now();
        device.queue.writeBuffer(input, 0, new Float32Array(features));
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
        return { result, submitMs, totalMs: performance.now() - start };
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
      for (const key of ['real', 'boundary']) {
        const cases = fixture[key], input = inputOf(cases, cases.length), cpu = scoreCpu(reference, input);
        if (!compare(new Float32Array(cases.map(row => row.expected)), cpu).consistent) throw new Error('浏览器 CPU 与夹具原始结果不一致');
        const kernel = gpuKernel(device, pipeline, K, cases.length);
        try { validation[key] = compare(cpu, (await kernel.execute(input)).result); }
        finally { kernel.destroy(); }
      }
      const rows = [];
      for (const count of [24, 96, 384, 1632, 4096, 16384, 65536, 262144, 1048576].filter(n => n <= max)) {
        $('status').textContent = '正在测试 ' + count.toLocaleString() + ' 个热量预测（含上传和回读）……';
        const input = inputOf(fixture.real, count), kernel = gpuKernel(device, pipeline, K, count);
        const cpuTimes = [], gpuTimes = [], submitTimes = [];
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
          const measureGpu = async () => { gpu = await kernel.execute(input); gpuTimes.push(gpu.totalMs); submitTimes.push(gpu.submitMs); };
          for (let i = 0; i < repeat; i++) {
            if (i % 2) { await measureGpu(); measureCpu(); } else { measureCpu(); await measureGpu(); }
          }
          const cpuMs = median(cpuTimes), totalMs = median(gpuTimes);
          rows.push({ count, cpuMs, gpuSubmitMs: median(submitTimes), gpuTotalMs: totalMs, speedupWithReadback: cpuMs / totalMs, ...compare(cpu, gpu.result) });
        } finally { kernel.destroy(); }
      }
      const info = adapter.info || {};
      return { available: true, adapter: [info.vendor, info.architecture, info.device].filter(Boolean).join(' / '), rules: fixture.rules,
        repeat, setupMs, validation, eligible: validation.real.consistent && validation.boundary.consistent && rows.every(row => row.consistent), rows,
        note: '真实热量预测循环；300 表示窗口内未过热。含输入打包、上传、计算和回读，初始化另列。临界判定须严格一致；尚未接入生成器。' };
    } finally { device.destroy(); }
  }

  let last = {};
  function render(result) {
    last = result;
    $('status').textContent = result.available === false ? 'GPU 测试失败：' + result.error
      : 'GPU：' + result.adapter + '；实际车辆差异 ' + result.validation.real.mismatches + '/' + result.validation.real.count
        + '，临界输入差异 ' + result.validation.boundary.mismatches + '/' + result.validation.boundary.count + '。' + result.note;
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
