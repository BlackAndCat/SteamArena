/*
 * 仅供独立 VM 对照：settle 原接地点、地形采样与战斗其余规则保持不变，
 * 数值后半段按 WebGPU direct 核的 f32 运算顺序逐步舍入。三角函数与 FMA 的
 * 浏览器/GPU 实现仍可能不同，未逐值硬件验收前只称“理想 FP32 混合精度模型”。
 */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const f = Math.fround;
const add = (a, b) => f(f(a) + f(b));
const sub = (a, b) => f(f(a) - f(b));
const mul = (a, b) => f(f(a) * f(b));
const div = (a, b) => f(f(a) / f(b));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** 使用已采样的真实 settle 输入；可选回调只为 VM 保持原 rigid 地形查询时点。 */
function settleF32(record) {
  const pts = record.pts.map(p => ({ ...p, x: f(p.x), y: f(p.y), up: f(p.up), down: f(p.down) }));
  const rigid = record.rigid || [], n = pts.length, t = record.constants;
  assert(n > 0 && t, 'settle f32 缺少接地点或常量');
  const dt = f(record.dt), xc = f(record.xc), follow = f(record.follow);
  const kw0 = f(record.kw0 || 0), yo0 = f(record.yo0 || 0);
  const tiltMax = f(t.tiltMax), tiltResponse = f(t.tiltResponse);
  const heightResponse = f(t.heightResponse), clearance = f(t.rigidClearance), ground = f(t.ground);
  let sx = f(0), sy = f(0);
  for (const p of pts) { sx = add(sx, p.x); sy = add(sy, p.y); }
  const mx = div(sx, f(n)), my = div(sy, f(n));
  let sxy = f(0), sxx = f(0);
  for (const p of pts) {
    const dx = sub(p.x, mx), dy = sub(p.y, my);
    sxy = add(sxy, mul(dx, dy)); sxx = add(sxx, mul(dx, dx));
  }
  const slope = sxx !== 0 ? div(sxy, sxx) : f(0);
  const target = clamp(mul(slope, follow), -tiltMax, tiltMax);
  const kw = add(kw0, mul(sub(target, kw0), Math.min(f(1), mul(dt, tiltResponse))));
  record.onKw?.(kw);
  const rel = (x, y) => sub(f(y), mul(kw, sub(f(x), xc)));
  const rs = pts.map(p => rel(p.x, p.y));
  let lo = f(-1e30), hi = f(1e30), sum = f(0);
  for (let i = 0; i < n; i++) {
    lo = Math.max(lo, sub(rs[i], pts[i].down));
    hi = Math.min(hi, add(rs[i], pts[i].up));
    sum = add(sum, rs[i]);
  }
  for (const p of rigid) {
    // 地形查询仍取原始世界 x；数值拟合与 GPU 上传一致，改用 f32 的 x/y。
    const rawX = p.x, x = f(rawX);
    const rawY = record.sampleRigid ? record.sampleRigid(rawX) : p.y;
    hi = Math.min(hi, add(rel(x, f(rawY)), clearance));
  }
  const mean = div(sum, f(n));
  const want = lo <= hi ? clamp(mean, lo, hi) : hi;
  const yo = add(yo0, mul(sub(sub(want, ground), yo0), Math.min(f(1), mul(dt, heightResponse))));
  const cs = f(Math.cos(f(Math.atan(kw)))), py = add(ground, yo), gnd = {};
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.key) (gnd[p.key] = gnd[p.key] || [0, 0])[p.i] =
      clamp(mul(sub(rs[i], py), cs), -p.up, p.down);
  }
  return { kw, yo, pivX: xc, gnd };
}

/** 独立 VM 内用唯一源码锚点替换数值后半段；不写生产文件或修改全局 Math。 */
function installSettleF32(context) {
  const file = path.join(__dirname, '../js/battle.js');
  const source = fs.readFileSync(file, 'utf8');
  const begin = '    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;';
  const end = '    for (const p of pts) if (p.key) (s.gnd[p.key] = s.gnd[p.key] || [0, 0])[p.i] = clamp((p.r - py) * cs, -p.up, p.down);';
  for (const marker of [begin, end]) assert.equal(source.split(marker).length, 2, `settle f32 源码锚点变化：${marker}`);
  const first = source.indexOf(begin), last = source.indexOf(end) + end.length;
  assert(first < last, 'settle f32 数值段锚点顺序错误');
  const replacement = `    const follow = (SA.MODULES[s.chassisId] && SA.MODULES[s.chassisId].susp || { follow: 1 }).follow;
    const __f32 = window.__settleF32({ dt, xc, kw0: s.kw, yo0: s.yo, follow, pts,
      rigid: rigid.map(x => ({ x })), sampleRigid: x => groundAt(x), onKw: kw => { s.kw = kw; },
      constants: { tiltMax: T.SETTLE_TILT_MAX, tiltResponse: T.SETTLE_TILT_RESPONSE,
        heightResponse: T.SETTLE_HEIGHT_RESPONSE, rigidClearance: T.SETTLE_RIGID_CLEARANCE, ground: GROUND } });
    s.kw = __f32.kw; s.yo = __f32.yo; s.pivX = __f32.pivX; s.gnd = __f32.gnd;`;
  const altered = source.slice(0, first) + replacement + source.slice(last);
  context.__settleF32 = settleF32;
  vm.runInContext(altered, context, { filename: 'js/battle.js#settle-f32-reference' });
  return { sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    alteredSha256: crypto.createHash('sha256').update(altered).digest('hex') };
}

module.exports = { settleF32, installSettleF32 };
