// 无头 Edge 打开 tools/audio-prep.html，跑 SA.AudioPrep.exportAll()，把处理好的 WAV 写进 audio/。
// 用法：先开 python tools/serve.py 5190，再 node tools/audio-export.mjs [端口]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = process.argv[2] || '5190';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 400);
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sa-audio-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let id = 0; const pending = new Map();
try {
  let wsUrl = null;
  for (let i = 0; i < 50 && !wsUrl; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); wsUrl = l.find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(200); }
  const ws = new WebSocket(wsUrl); await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:${site}/tools/audio-prep.html` });
  await sleep(2500);
  const r = await send('Runtime.evaluate', { expression: 'SA.AudioPrep.exportAll()', awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails || !r.result?.result?.value) { console.log('FAIL', JSON.stringify(r).slice(0, 600)); process.exitCode = 1; }
  else {
    const { files, report } = r.result.result.value, dir = join(root, 'audio');
    mkdirSync(dir, { recursive: true });
    let total = 0;
    for (const [f, data] of Object.entries(files)) { const buf = Buffer.from(data, 'base64'); writeFileSync(join(dir, f), buf); total += buf.length; }
    for (const x of report) console.log(`${x.name}#${x.i}  ${x.dur}s（原 ${x.srcDur}s）  ${x.rms} dBFS  ${x.kb} KB  ← ${x.src}`);
    console.log(`共 ${Object.keys(files).length} 个文件，${(total / 1024).toFixed(0)} KB → audio/`);
  }
  ws.close();
} finally { edge.kill(); }
