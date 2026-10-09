/**
 * 当前热量预测的保守 WebGPU 区间核。GPU 只认证确定步数；-1 必须交给原 CPU 规则。
 * 每次进化任务持有一个独立 Node host、Chrome profile 与 WebGPU device；父进程失联时 host 自清理。
 */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork, spawn, spawnSync } = require('node:child_process');

const SUPPORTED_HEAT_RULE_SHA256 = 'f9495fd8d4933d4dcb7956ccb05e07257e1e7f5ea38cd34a828e9beace395f6c';
const chromePath = [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe')]
  .find(file => fs.existsSync(file));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 只锁定真正参与预测的原函数和600步循环，不受 stats 的缓存/包装改动影响。
function currentHeatRuleSHA256() {
  const modules = fs.readFileSync(path.join(__dirname, '../js/modules.js'), 'utf8');
  const vehicle = fs.readFileSync(path.join(__dirname, '../js/vehicle.js'), 'utf8');
  const parts = {
    temp: modules.match(/  temp: \(heat, cap\) =>[^\r\n]*/)?.[0],
    thermal: modules.match(/  thermalStep: \(heat, water, dt, p\) => \{[\s\S]*?\r?\n  \},/)?.[0],
    cool: modules.match(/SA\.coolRate = [^\r\n]*/)?.[0],
    waterPower: modules.match(/  waterCoolingPower: [\s\S]*?\r?\n[^\r\n]*,/)?.[0],
    waterEfficiency: modules.match(/  waterCoolingEfficiency: [\s\S]*?\r?\n[^\r\n]*,/)?.[0],
    waterConfig: ['WATER_FLOW', 'WATER_HEAT_PER_L', 'WATER_SOFT_LIMIT'].map(key =>
      JSON.parse(fs.readFileSync(path.join(__dirname, '../config/modules.json'), 'utf8')).K[key]),
    loop: vehicle.match(/    let heat = 0;\r?\n    for \(let t = 0; t < 300; t \+= 0\.5\) \{[\s\S]*?\r?\n    return Infinity;/)?.[0],
  };
  if (Object.values(parts).some(part => !part)) return null;
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function fallback(inputs, reason, precision = 'certified') {
  return { steps: Array(inputs.length).fill(-1), telemetry: { count: inputs.length, certified: 0,
    uncertain: inputs.length, precision, approximate: precision === 'f32', gpuDispatchReadbackMs: 0,
    measurement: '提交与读回墙钟，包含 CPU 输出复制；不是硬件内核计时', reason } };
}

function coldRuntime(reason, precision = 'certified') {
  return { available: false, reason, predict: async inputs => fallback(inputs, reason, precision), close: async () => {} };
}

function remaining(deadline) {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new Error('GPU 热量 host 超时');
  return ms;
}

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function devtoolsPort(profile, browser, deadline) {
  const file = path.join(profile, 'DevToolsActivePort');
  while (remaining(deadline)) {
    try {
      const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].trim();
      // Chrome 刚创建文件时可能尚未写入端口；只在原启动期限内等待。
      if (firstLine) {
        const port = Number(firstLine);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DevTools 端口文件内容无效');
        return port;
      }
    } catch (error) {
      if (!['ENOENT', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
    }
    if (browser.launchError) throw browser.launchError;
    if (browser.exitCode != null) throw new Error(`Chrome 提前退出：${browser.exitCode}`);
    await delay(Math.min(150, remaining(deadline)));
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
    await delay(Math.min(150, remaining(deadline)));
  }
}

async function connectDevtools(info) {
  const ws = new WebSocket(info.webSocketDebuggerUrl), pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('DevTools 连接超时')); }, 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
  });
  let id = 0;
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data), callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id); callback(message);
  });
  const call = (expression, timeoutMs = 30000) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('GPU 热量调用超时')); }, timeoutMs);
    pending.set(requestId, message => {
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text || '浏览器脚本异常'));
      else resolve(message.result?.result?.value);
    });
    ws.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  return { call, close: () => ws.close() };
}

function killOwnChrome(browser) {
  if (!browser?.pid || browser.exitCode != null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'],
    { windowsHide: true, timeout: 3000 });
  else browser.kill('SIGKILL');
}

async function heatHost() {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-arena-gpu-heat-'));
  const profile = path.join(runDir, 'profile');
  const page = fs.readFileSync(path.join(__dirname, 'evolve-gpu-heat-page.html'));
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(page);
  });
  let browser = null, devtools = null, closing = null, preserveDiagnostics = false, phase = '初始化';
  /** 失败日志只保留本次 Chrome 的输出；不收集环境变量、存档或其他进程资料。 */
  const failureReason = error => {
    preserveDiagnostics = true;
    const reason = String(error.message || error);
    let stderrTail = '';
    try {
      const log = path.join(runDir, 'chrome.stderr.log');
      const fd = fs.openSync(log, 'r');
      try {
        const size = fs.fstatSync(fd).size, buffer = Buffer.alloc(Math.min(size, 4096));
        fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, size - buffer.length));
        // 常规 Chrome 噪音不进入报告，完整 stdout/stderr 仍可在诊断目录检查。
        stderrTail = buffer.toString('utf8').split(/\r?\n/)
          .filter(line => /ERROR|FATAL|denied|sandbox|failed|failure/i.test(line)).slice(-3).join(' ')
          .replace(/https?:\/\/\S+/gi, '[网址省略]')
          .replace(/(token|password|authorization|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=[省略]')
          .slice(-600);
      } finally { fs.closeSync(fd); }
    } catch (_) {}
    try { fs.writeFileSync(path.join(runDir, 'failure.json'), JSON.stringify({
      phase, reason, pid: browser?.pid ?? null, exitCode: browser?.exitCode ?? null,
      signalCode: browser?.signalCode ?? null, stderrTail,
    }, null, 2)); } catch (_) {}
    return `${reason}；诊断目录：${runDir}${stderrTail ? `；stderr：${stderrTail}` : ''}`;
  };
  const shutdown = () => closing ||= (async () => {
    devtools?.close();
    killOwnChrome(browser);
    if (server.listening) await new Promise(resolve => server.close(resolve));
    // 成功后删除本 host 目录；失败只清理 profile，保留日志供真实服务启动问题定位。
    const root = path.resolve(os.tmpdir()) + path.sep;
    const ownDir = path.resolve(runDir);
    const cleanupDir = preserveDiagnostics ? path.resolve(profile) : ownDir;
    if (ownDir.startsWith(root) && path.dirname(ownDir) === path.resolve(os.tmpdir()) &&
        (cleanupDir === ownDir || path.dirname(cleanupDir) === ownDir)) {
      try { fs.rmSync(cleanupDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (_) {}
    }
  })();
  process.on('disconnect', () => { shutdown().finally(() => process.exit(0)); });
  process.on('message', message => {
    if (message?.kind === 'close') { shutdown().then(() => process.send?.({ kind: 'closed' })).finally(() => process.exit(0)); return; }
    if (message?.kind !== 'predict') return;
    queue = queue.then(async () => {
      const start = Date.now();
      try {
        const result = await devtools.call(`window.HeatKernel.predict(${JSON.stringify(message.inputs)}, ${JSON.stringify(message.precision)})`);
        result.telemetry.roundTripMs = Date.now() - start;
        process.send?.({ kind: 'result', id: message.id, result });
      } catch (error) {
        process.send?.({ kind: 'result', id: message.id, result: fallback(message.inputs, failureReason(error), message.precision) });
      }
    });
  });
  let queue = Promise.resolve();
  try {
    if (!chromePath) throw new Error('未找到 Chrome');
    const port = await listen(server), deadline = Date.now() + 15000;
    phase = 'Chrome 启动';
    const stdout = fs.openSync(path.join(runDir, 'chrome.stdout.log'), 'w');
    const stderr = fs.openSync(path.join(runDir, 'chrome.stderr.log'), 'w');
    try { browser = spawn(chromePath, ['--headless=new', '--no-first-run', `--user-data-dir=${profile}`,
      '--remote-debugging-port=0', `http://127.0.0.1:${port}/`],
    { windowsHide: true, stdio: ['ignore', stdout, stderr] }); }
    finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    // spawn 错误异步到达，交给已有启动期限处理，避免 host 因无人监听 error 而退出。
    browser.once('error', error => { browser.launchError = error; });
    const portCDP = await devtoolsPort(profile, browser, deadline);
    phase = 'DevTools 连接';
    devtools = await connectDevtools(await target(portCDP, deadline));
    // DevTools 页面目标可能早于页面脚本出现；在同一个启动期限内等待接口注册。
    while (remaining(deadline)) {
      if (await devtools.call('typeof window.HeatKernel !== "undefined"', remaining(deadline))) break;
      await delay(Math.min(100, remaining(deadline)));
    }
    phase = 'WebGPU 初始化';
    const ready = await devtools.call('window.HeatKernel.ready', remaining(deadline));
    if (ready?.status !== 'ok') throw new Error(ready?.error || '热量核未就绪');
    phase = 'GPU 批次计算';
    process.send?.({ kind: 'ready', available: true, adapter: ready.adapter });
  } catch (error) {
    process.send?.({ kind: 'ready', available: false, reason: failureReason(error) });
    await shutdown();
    process.exit(0);
  }
}

/** 创建一次进化任务内可复用的 GPU 热量核；任何不可认证结果都返回 -1。 */
async function createGpuHeatRuntime(options = {}) {
  const precision = options.precision || 'certified';
  if (precision !== 'certified' && precision !== 'f32') return coldRuntime('未知热量计算精度', precision);
  let fingerprint;
  try { fingerprint = currentHeatRuleSHA256(); } catch (error) { return coldRuntime(String(error.message || error), precision); }
  if (fingerprint !== SUPPORTED_HEAT_RULE_SHA256 ||
      (options.expectedRuleVersion && options.expectedRuleVersion !== fingerprint))
    return coldRuntime('当前热量规则指纹与 GPU 核不一致', precision);
  if (options.signal?.aborted) return coldRuntime('任务已取消', precision);
  const host = fork(__filename, ['--heat-host'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const pending = new Map();
  let closed = false, nextId = 0, reason = null;
  const ready = new Promise(resolve => {
    const timer = setTimeout(() => { reason = 'GPU host 启动超时'; resolve(null); host.disconnect(); }, 16000);
    host.on('message', message => {
      if (message.kind === 'ready') { clearTimeout(timer); if (!message.available) reason = message.reason; resolve(message); }
      if (message.kind === 'result') {
        const entry = pending.get(message.id);
        if (entry) { pending.delete(message.id); clearTimeout(entry.timer); entry.resolve(message.result); }
      }
    });
    host.once('exit', () => {
      clearTimeout(timer); reason ||= 'GPU host 已退出'; resolve(null);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.resolve(fallback(entry.inputs, reason, precision)); }
      pending.clear();
    });
  });
  const info = await ready;
  if (!info?.available) { if (host.connected) host.disconnect(); return coldRuntime(reason || 'GPU 不可用', precision); }
  const runtime = { available: true, adapter: info.adapter, precision,
    predict(inputs) {
      if (!Array.isArray(inputs)) return Promise.resolve(fallback([], '热量输入不是数组', precision));
      if (closed || !host.connected) return Promise.resolve(fallback(inputs, reason || 'GPU runtime 已关闭', precision));
      return new Promise(resolve => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id); reason = 'GPU 批次超时'; resolve(fallback(inputs, reason, precision));
        }, 35000);
        pending.set(id, { resolve, inputs, timer });
        try { host.send({ kind: 'predict', id, inputs, precision }); }
        catch (error) { clearTimeout(timer); pending.delete(id); resolve(fallback(inputs, String(error.message || error), precision)); }
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.resolve(fallback(entry.inputs, 'GPU runtime 已关闭', precision)); }
      pending.clear();
      if (host.connected) host.send({ kind: 'close' });
      await Promise.race([new Promise(resolve => host.once('exit', resolve)), delay(3000)]);
      if (host.connected) host.disconnect();
    },
  };
  options.signal?.addEventListener('abort', () => { runtime.close(); }, { once: true });
  return runtime;
}

if (process.argv[2] === '--heat-host') heatHost().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
else module.exports = { createGpuHeatRuntime, currentHeatRuleSHA256, SUPPORTED_HEAT_RULE_SHA256 };
