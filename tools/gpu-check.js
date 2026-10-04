/**
 * 隔离 Chrome WebGPU 自检：只验证本机 GPU 计算通路，不改游戏规则或浏览器用户配置。
 * 普通 PowerShell 可执行 `node tools/gpu-check.js`；Codex 外层文件/进程沙箱若阻止
 * Chrome GPU 子进程，应对这一专用命令申请宿主运行，不得关闭 Chrome 自身沙箱。
 */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeoutMs = 30000;
function remaining(deadline) {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new Error('GPU 自检总时限超时');
  return ms;
}
const chrome = [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe')]
  .find(file => fs.existsSync(file));

// 数值核刻意保持很小：验证 adapter、WGSL、提交、映射读回与 CPU 结果，不冒充整场战斗加速。
const page = `<!doctype html><html><meta charset="utf-8"><pre id="result">运行中</pre><script>
(async () => {
  const out = { secureContext: isSecureContext, gpuExposed: !!navigator.gpu };
  try {
    if (!navigator.gpu) { out.status = 'webgpu_unavailable'; throw new Error('navigator.gpu 不可用'); }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) { out.status = 'no_adapter'; throw new Error('requestAdapter 返回空'); }
    out.adapter = { vendor: adapter.info?.vendor || '', architecture: adapter.info?.architecture || '',
      device: adapter.info?.device || '', description: adapter.info?.description || '' };
    out.fallback = adapter.isFallbackAdapter ?? null;
    const name = Object.values(out.adapter).join(' ').toLowerCase();
    out.softwareAdapter = out.fallback === true || /swiftshader|llvmpipe|software adapter|warp/.test(name);
    out.hardwareConfirmed = !out.softwareAdapter && /nvidia|amd|intel/.test(out.adapter.vendor.toLowerCase());
    if (out.softwareAdapter) { out.status = 'software_adapter'; throw new Error('检测到软件适配器'); }
    if (!out.hardwareConfirmed) { out.status = 'hardware_unconfirmed'; throw new Error('适配器元数据不足，不能确认硬件 GPU'); }
    const device = await adapter.requestDevice();
    const shader = device.createShaderModule({ code: '@group(0) @binding(0) var<storage, read> a: array<f32>; @group(0) @binding(1) var<storage, read_write> b: array<f32>; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { if (id.x < arrayLength(&b)) { b[id.x] = a[id.x] * 1.5 + 2.0; } }' });
    const messages = (await shader.getCompilationInfo()).messages.filter(row => row.type === 'error');
    if (messages.length) throw new Error('WGSL 编译失败：' + messages.map(row => row.message).join('; '));
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
    const values = new Float32Array(256);
    for (let i = 0; i < values.length; i++) values[i] = i * 0.25;
    const input = device.createBuffer({ size: values.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({ size: values.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readback = device.createBuffer({ size: values.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const start = performance.now();
    device.queue.writeBuffer(input, 0, values);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }] });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(4); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, values.byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    out.endToEndMs = performance.now() - start;
    const actual = new Float32Array(readback.getMappedRange());
    out.elements = actual.length; out.mismatches = 0;
    for (let i = 0; i < actual.length; i++) if (Math.abs(actual[i] - (values[i] * 1.5 + 2)) > 0.00001) out.mismatches++;
    readback.unmap(); input.destroy(); output.destroy(); readback.destroy(); device.destroy();
    out.status = out.mismatches ? 'mismatch' : 'ok';
  } catch (error) { out.status ||= 'error'; out.error = String(error?.message || error); }
  document.querySelector('#result').textContent = JSON.stringify(out);
  document.documentElement.dataset.done = 'true';
})();
</script></html>`;

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function devtoolsPort(profile, child, deadline, launchError) {
  const file = path.join(profile, 'DevToolsActivePort');
  while (remaining(deadline)) {
    if (launchError()) throw Object.assign(new Error(`Chrome 启动失败：${launchError().message}`), { code: 'BROWSER_LAUNCH_FAILED' });
    if (fs.existsSync(file)) return Number(fs.readFileSync(file, 'utf8').split(/\r?\n/)[0]);
    if (child.exitCode != null) throw new Error(`Chrome 提前退出：${child.exitCode}`);
    await delay(Math.min(200, remaining(deadline)));
  }
}

async function target(port, deadline) {
  while (remaining(deadline)) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(remaining(deadline)) });
      const rows = await response.json();
      const page = rows.find(row => row.type === 'page' && row.url.startsWith('http://127.0.0.1:'));
      if (page) return page;
    } catch (_) {}
    await delay(Math.min(200, remaining(deadline)));
  }
}

async function resultFromBrowser(targetInfo, deadline) {
  const ws = new WebSocket(targetInfo.webSocketDebuggerUrl), pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('GPU 自检总时限超时')); }, remaining(deadline));
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
  });
  let id = 0;
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data), callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    callback(message);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`DevTools ${method} 超时`)); },
      Math.min(5000, remaining(deadline)));
    pending.set(requestId, message => {
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  try {
    await call('Runtime.enable');
    while (remaining(deadline)) {
      const answer = await call('Runtime.evaluate', { returnByValue: true,
        expression: "document.documentElement.dataset.done === 'true' ? document.querySelector('#result').textContent : null" });
      if (answer.result?.value) return JSON.parse(answer.result.value);
      await delay(Math.min(200, remaining(deadline)));
    }
  } finally { ws.close(); }
}

function classify(error, stderr) {
  if (error?.code === 'BROWSER_LAUNCH_FAILED') return 'browser_launch_failed';
  if (/exit_code=-1073741790|0xC0000022/i.test(stderr)) return 'gpu_child_access_denied';
  if (/GPU process isn't usable/i.test(stderr)) return 'gpu_child_unusable';
  if (/超时/.test(String(error))) return 'timeout';
  if (/navigator\.gpu 不可用/.test(String(error))) return 'webgpu_unavailable';
  if (/requestAdapter 返回空/.test(String(error))) return 'no_adapter';
  return 'error';
}

async function main() {
  if (!chrome) throw new Error('未找到 Chrome，可安装后再运行 GPU 自检');
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-arena-gpu-check-'));
  const profile = path.join(runDir, 'profile');
  const stdoutFile = path.join(runDir, 'chrome.stdout.log'), stderrFile = path.join(runDir, 'chrome.stderr.log');
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(page);
  });
  let child = null;
  const deadline = Date.now() + timeoutMs;
  try {
    const port = await listen(server);
    const args = ['--headless=new', '--no-first-run', `--user-data-dir=${profile}`,
      '--remote-debugging-port=0', `http://127.0.0.1:${port}/`];
    const stdout = fs.openSync(stdoutFile, 'w'), stderr = fs.openSync(stderrFile, 'w');
    try { child = spawn(chrome, args, { windowsHide: true, stdio: ['ignore', stdout, stderr] }); }
    finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    let launchError = null;
    child.on('error', error => { launchError = error; });
    const devtools = await devtoolsPort(profile, child, deadline, () => launchError);
    const result = await resultFromBrowser(await target(devtools, deadline), deadline);
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    const summary = { ok: result.status === 'ok', status: result.status, adapter: result.adapter,
      fallback: result.fallback, hardwareConfirmed: result.hardwareConfirmed,
      elements: result.elements, mismatches: result.mismatches, endToEndMs: result.endToEndMs,
      error: result.error || null, logDir: runDir };
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) process.exitCode = 1;
  } catch (error) {
    await delay(100);
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';
    const summary = { ok: false, status: classify(error, stderr), error: String(error.message || error),
      chromeExitCode: child?.exitCode ?? null, logDir: runDir };
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
  } finally {
    // 仅停止本脚本启动的 Chrome；日志和隔离 profile 保留供故障对照。
    if (child && child.exitCode == null) child.kill();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
