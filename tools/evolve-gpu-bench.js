/**
 * 独立 CPU／硬件 WebGPU 轨迹递推基准。只测同一数值核，不代表完整 Battle 加速。
 * 由外层进程监督 90 秒；结果与 Chrome 日志写入 Z:\AI\CodexTemp 的独立目录。
 */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_LIMIT_MS = 90000;
const chrome = [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe')]
  .find(file => fs.existsSync(file));
const defaultPage = path.join(__dirname, 'evolve-gpu-bench-page.html');

function remaining(deadline) {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new Error('90 秒硬时限已到');
  return ms;
}

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function devtoolsPort(profile, browser, deadline, launchError) {
  const file = path.join(profile, 'DevToolsActivePort');
  while (remaining(deadline)) {
    if (launchError()) throw new Error(`Chrome 启动失败：${launchError().message}`);
    try {
      const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].trim();
      if (firstLine) {
        const port = Number(firstLine);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DevTools 端口文件内容无效');
        return port;
      }
    } catch (error) {
      // Chrome 刚创建文件时可能被暂时占用；只在既有 deadline 内重试。
      if (!['ENOENT', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
    }
    if (browser.exitCode != null) throw new Error(`Chrome 提前退出：${browser.exitCode}`);
    await wait(Math.min(200, remaining(deadline)));
  }
}

async function target(port, deadline) {
  while (remaining(deadline)) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(remaining(deadline)) });
      const rows = await response.json();
      const selected = rows.find(row => row.type === 'page' && row.url.startsWith('http://127.0.0.1:'));
      if (selected) return selected;
    } catch (_) {}
    await wait(Math.min(200, remaining(deadline)));
  }
}

async function browserResult(info, deadline) {
  const ws = new WebSocket(info.webSocketDebuggerUrl), pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('DevTools 连接超时')); }, remaining(deadline));
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
    // CPU 同步核可暂时阻塞页面线程；外层 90 秒看门狗仍可结束整个任务。
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`DevTools ${method} 超时`)); }, remaining(deadline));
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
      await wait(Math.min(300, remaining(deadline)));
    }
  } finally { ws.close(); }
}

function cleanProfile(runDir, profile) {
  const root = path.resolve(runDir) + path.sep;
  if (!path.resolve(profile).startsWith(root)) throw new Error('拒绝清理隔离目录以外的浏览器配置');
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (_) {}
}

async function childMain(runDir, deadline, sustained, pagePath, tracePath) {
  const start = Date.now(), profile = path.join(runDir, 'profile');
  const page = fs.readFileSync(pagePath);
  const trace = tracePath ? fs.readFileSync(tracePath) : null;
  const server = http.createServer((request, response) => {
    const isTrace = request.url?.split('?')[0] === '/trace.json';
    response.writeHead(isTrace && !trace ? 404 : 200,
      { 'Content-Type': isTrace ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(isTrace ? trace || '无 trace' : page);
  });
  let browser = null;
  try {
    if (!chrome) throw new Error('未找到 Chrome');
    const port = await listen(server);
    const stdout = fs.openSync(path.join(runDir, 'chrome.stdout.log'), 'w');
    const stderr = fs.openSync(path.join(runDir, 'chrome.stderr.log'), 'w');
    try {
      // 保留 Chrome 自身沙箱与 GPU；不加入软件适配器或关闭 GPU 的启动参数。
      browser = spawn(chrome, ['--headless=new', '--no-first-run', `--user-data-dir=${profile}`,
        '--remote-debugging-port=0', `http://127.0.0.1:${port}/${sustained ? '?sustained=1' : ''}`],
      { windowsHide: true, stdio: ['ignore', stdout, stderr] });
    } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    fs.writeFileSync(path.join(runDir, 'chrome.pid'), String(browser.pid));
    let launchError = null;
    browser.on('error', error => { launchError = error; });
    const devtools = await devtoolsPort(profile, browser, deadline, () => launchError);
    const pageInfo = await target(devtools, deadline), browserStartupMs = Date.now() - start;
    const result = await browserResult(pageInfo, deadline);
    result.browserStartupMs = browserStartupMs;
    result.processWallMs = Date.now() - start;
    if (pagePath === defaultPage) {
      result.gpuColdToTaskDoneMs = result.gpuTaskDoneEpochMs - start;
      result.gpuColdTimingNote = '从本基准子进程启动至全部 GPU 工作结束的实测墙钟；CPU 对照随后运行，未计入此值';
    } else if (Number.isFinite(result.gpuTaskDoneEpochMs)) {
      result.taskColdToDoneMs = result.gpuTaskDoneEpochMs - start;
      result.taskColdTimingNote = '自基准子进程启动到测试页完成；包含页面内交错执行的 CPU 对照，不能作为纯 GPU 冷启动时间';
    }
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'ok') process.exitCode = 1;
  } catch (error) {
    const result = { kind: 'evolve-gpu-numeric-benchmark', status: 'error', error: String(error.message || error),
      processWallMs: Date.now() - start };
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    process.exitCode = 1;
  } finally {
    if (browser && browser.exitCode == null) {
      browser.kill();
      await Promise.race([new Promise(resolve => browser.once('exit', resolve)), wait(1500)]);
    }
    if (server.listening) await new Promise(resolve => server.close(resolve));
    cleanProfile(runDir, profile);
  }
}

function stopOwnChrome(runDir) {
  const file = path.join(runDir, 'chrome.pid');
  if (!fs.existsSync(file)) return;
  const pid = Number(fs.readFileSync(file, 'utf8'));
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 3000 });
  else { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
}

async function parentMain() {
  const sustained = process.argv.includes('--sustained');
  const pageOption = process.argv.find(value => value.startsWith('--page='));
  const traceOption = process.argv.find(value => value.startsWith('--trace='));
  const pagePath = pageOption ? pageOption.slice('--page='.length) : defaultPage;
  const tracePath = traceOption?.slice('--trace='.length) || null;
  if (!path.isAbsolute(pagePath) || !fs.existsSync(pagePath)) throw new Error('--page 必须是现有 HTML 绝对路径');
  if (tracePath && (!pageOption || !path.isAbsolute(tracePath) || !fs.existsSync(tracePath)))
    throw new Error('--trace 需要 --page，且必须是现有 JSON 绝对路径');
  const timeoutOption = process.argv.find(value => value.startsWith('--timeout-ms='));
  const limitMs = timeoutOption ? Number(timeoutOption.slice('--timeout-ms='.length)) : sustained ? 75000 : DEFAULT_LIMIT_MS;
  if (!Number.isInteger(limitMs) || limitMs < 1000 || limitMs > DEFAULT_LIMIT_MS)
    throw new Error('--timeout-ms 必须在 1000～90000 之间');
  const outputRoot = 'Z:\\AI\\CodexTemp';
  fs.mkdirSync(outputRoot, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(outputRoot, 'evolve-gpu-bench-'));
  const start = Date.now(), deadline = start + limitMs;
  const stdout = fs.openSync(path.join(runDir, 'worker.stdout.log'), 'w');
  const stderr = fs.openSync(path.join(runDir, 'worker.stderr.log'), 'w');
  let worker;
  try { worker = spawn(process.execPath, [__filename, '--child', runDir, String(deadline), sustained ? '1' : '0', pagePath, tracePath || ''],
    { windowsHide: true, stdio: ['ignore', stdout, stderr] }); }
  finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stopOwnChrome(runDir);
    worker.kill();
  }, limitMs);
  await new Promise(resolve => worker.once('close', resolve));
  clearTimeout(timer);
  if (timedOut) cleanProfile(runDir, path.join(runDir, 'profile'));
  const file = path.join(runDir, 'result.json');
  const result = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) :
    { kind: 'evolve-gpu-numeric-benchmark', status: timedOut ? 'timeout' : 'error', error: timedOut ? `${limitMs} 毫秒硬时限已到` : '子进程未写入结果' };
  result.supervisorWallMs = Date.now() - start;
  result.supervisorLimitMs = limitMs;
  if (Number.isFinite(result.gpuTaskDoneEpochMs)) {
    if (pagePath === defaultPage) result.gpuColdFromSupervisorMs = result.gpuTaskDoneEpochMs - start;
    else result.taskDoneFromSupervisorMs = result.gpuTaskDoneEpochMs - start;
  }
  if (Number.isFinite(result.totalCpuWorkloadMs) && Number.isFinite(result.totalGpuWorkloadMs)) {
    result.conservativeGpuUpperBoundMs = result.supervisorWallMs - result.totalCpuWorkloadMs;
    result.unattributedHarnessAndColdMs = result.supervisorWallMs - result.totalCpuWorkloadMs - result.totalGpuWorkloadMs;
    result.overheadNote = '未归因部分同时含浏览器启动、WebGPU冷准备、输入生成、校验、IPC和清理；不能全算作GPU启动';
  }
  result.runDir = runDir;
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, runDir, supervisorWallMs: result.supervisorWallMs,
    executionStatus: result.executionStatus, eligibility: result.eligibility,
    adapter: result.adapter, totalStateSteps: result.totalStateSteps,
    totalCpuWorkloadMs: result.totalCpuWorkloadMs, totalGpuWorkloadMs: result.totalGpuWorkloadMs,
    gpuColdFromSupervisorMs: result.gpuColdFromSupervisorMs,
    conservativeGpuUpperBoundMs: result.conservativeGpuUpperBoundMs,
    error: result.error || result.validationFailure || null }, null, 2));
  if (result.status !== 'ok') process.exitCode = 1;
}

if (process.argv[2] === '--child') childMain(process.argv[3], Number(process.argv[4]), process.argv[5] === '1', process.argv[6], process.argv[7]).catch(error => {
  console.error(error.stack || error); process.exitCode = 1;
});
else parentMain().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
