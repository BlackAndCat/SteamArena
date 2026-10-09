// 隔离真实 Chrome：旧版与惰性版逐像素比较，验证首帧、移动视野和缓存复用。
// 原算法取指定 Git 基线，HTTP 仅提供内存页面，不读写用户存档或作者配置。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFile, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--baseline-ref'),
  '用法：node tools/terrain-loading-check.js [--baseline-ref <Git引用>]');
// 默认跟随当前提交，避免后续已授权的视觉更新被旧图案基线误判；显式引用用于历史回归。
const baseline = args.length ? args[1] : 'HEAD';
const original = execFileSync('git', ['show', `${baseline}:js/terrain-art.js`], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, 'js/terrain-art.js'), 'utf8');
const palette = fs.readFileSync(path.join(root, 'js/palette.js'), 'utf8');

// 在浏览器里保留两个独立的算法闭包；所有 Canvas 和 ImageData 都由真实浏览器创建。
function check(originalSource, currentSource, paletteSource) {
  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  (0, eval)(paletteSource);
  (0, eval)(originalSource);
  const before = SA.TerrainArt.profileTiles;
  (0, eval)(currentSource);
  const after = SA.TerrainArt.profileTiles;
  const create = document.createElement.bind(document);
  let canvases = 0;
  document.createElement = (...args) => { if (args[0] === 'canvas') canvases++; return create(...args); };
  const results = [];
  // 极小末块与跨块桥梁、填方、路堑同时覆盖；长路线包含两侧 PAD 和真实高度规模。
  for (const [len, height, top] of [[3840, 240, 75], [23560, 840, 575]]) {
    const ground = Float32Array.from({ length: len + 1 }, (_, x) => top + Math.sin(x / 87) * 18);
    const options = {
      bridge: [{ x0: 1190, x1: 1410, water: top + 35 }],
      fill: [{ x0: 2420, x1: 2650, natural: x => top + 50 + Math.sin(x / 60) * 6 }],
      cut: [{ x0: 2490, x1: 2800, depth: 45 }],
    };
    canvases = 0;
    let started = performance.now();
    const expected = before(ground, len, height, options);
    const eagerMs = performance.now() - started;
    ensure(canvases === expected.length, '原版应立即创建所有 Canvas');
    canvases = 0;
    started = performance.now();
    const tiles = after(ground, len, height, { ...options, lazy: true });
    const metadataMs = performance.now() - started;
    ensure(canvases === 0 && tiles.length === expected.length && Array.isArray(tiles), '元数据阶段不得生成像素');
    const pad = 1280;
    for (const tile of tiles) tile.x -= pad;
    ensure(canvases === 0, 'PAD 平移不得触发 Canvas getter');
    const seen = new Set();
    const draw = (cameraX, cameraWidth) => {
      const first = performance.now();
      for (const tile of tiles) {
        const width = tile.width == null ? tile.c.width : tile.width;
        const center = tile.x + width / 2;
        if (center + width / 2 > cameraX - 8 && center - width / 2 < cameraX + cameraWidth + 8) {
          ensure(tile.c.width === width, '实际 Canvas 宽度与可见判定必须一致');
          seen.add(tile);
        }
      }
      return performance.now() - first;
    };
    const firstFrameMs = draw(0, 1280), firstFrameTiles = canvases;
    ensure(firstFrameTiles === seen.size && firstFrameTiles < tiles.length, '首帧只能物化可见块');
    draw(0, 1280);
    ensure(canvases === firstFrameTiles, '同一镜头重绘不得重复生成');
    if (len > 13000) {
      draw(10240, 1280);
      ensure(canvases === seen.size && canvases > firstFrameTiles && canvases < tiles.length, '移动后只增加新视野块');
    }
    for (let i = 0; i < tiles.length; i++) {
      const a = expected[i].c, b = tiles[i].c;
      ensure(b === tiles[i].c && a.width === b.width && a.height === b.height, '块尺寸和缓存应保持一致');
      const rgbaA = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
      const rgbaB = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
      for (let pixel = 0; pixel < rgbaA.length; pixel++) {
        ensure(rgbaA[pixel] === rgbaB[pixel], `逐像素不一致：块 ${i}，通道 ${pixel}`);
      }
    }
    ensure(canvases === tiles.length, '全图访问后每块应只创建一次');
    // 默认调用仍立即生成，并与旧版保持相同像素；只在小用例再覆盖一次，避免重复长图分配。
    if (len === 3840) {
      canvases = 0;
      const defaults = after(ground, len, height, options);
      ensure(canvases === defaults.length, '未指定 lazy 时应保持立即生成');
      for (let i = 0; i < defaults.length; i++) {
        ensure(defaults[i].c.toDataURL() === expected[i].c.toDataURL(), '默认版像素应保持一致');
      }
    }
    results.push({ len, height, tiles: tiles.length, firstFrameTiles, eagerMs, metadataMs, firstFrameMs, rgbaEqual: true });
  }
  return results;
}

(async () => {
  const payload = JSON.stringify([original, current, palette]).replace(/</g, '\\u003c');
  const html = `<html><body><pre id="result"></pre><script>try { document.getElementById('result').textContent=JSON.stringify({ok:true,results:(${check})(...${payload})}); } catch(error) { document.getElementById('result').textContent=JSON.stringify({ok:false,error:String(error.stack)}); }</script></body></html>`;
  const server = http.createServer((_request, response) => { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'terrain-loading-check-'));
  try {
    const stdout = await new Promise((resolve, reject) => execFile('C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, '--dump-dom', `http://127.0.0.1:${server.address().port}/`,
    ], { timeout: 90000, maxBuffer: 1024 * 1024 }, (error, output) => error ? reject(error) : resolve(output)));
    const match = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert(match, 'Chrome 未返回检查结果');
    const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    assert(result.ok, result.error);
    console.log(JSON.stringify({ baseline, ...result }, null, 2));
  } finally {
    await new Promise(resolve => server.close(resolve));
    // 只清理本次创建且位于系统临时目录内的隔离档案。
    assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
