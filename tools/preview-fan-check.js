// 验证真实 drawFan 路径会覆盖高抛火炮的内部弹道；不启动游戏或改写关卡数据。
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/modules.json'), 'utf8'));
const mortar = config.MODULES.mortar;
const T = config.K.BATTLE;
const source = fs.readFileSync(path.join(root, 'js/battle-view.js'), 'utf8');

// 直接执行生产 drawFan；只替换画布与弹道输入，记录它交给 fill(nonzero) 的子路径。
const start = source.indexOf('  function drawFan(');
const end = source.indexOf('\n  // 当前武器组的弹道预览', start);
const pointStart = source.indexOf('  function fanPoint(');
const pointEnd = source.indexOf('\n  // 准星处的法平面', pointStart);
if (start < 0 || end < 0) throw new Error('找不到 drawFan');
const viewCode = (pointStart >= 0 ? source.slice(pointStart, pointEnd) : '') + source.slice(start, end);

function winding(poly, x, y) {
  let n = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
    if (a[1] <= y) { if (b[1] > y && cross > 0) n++; }
    else if (b[1] <= y && cross < 0) n--;
  }
  return n;
}

function check(center, sampleAngle, time, dir = 1) {
  const polys = [];
  let current = [];
  const g = {
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, beginPath() { polys.length = 0; },
    moveTo(x, y) { current = [[x, y]]; },
    lineTo(x, y) { current.push([x, y]); },
    closePath() { if (current.length >= 3) polys.push(current); current = []; },
    fill(rule) { if (rule !== 'nonzero') throw new Error(`填充规则改变：${rule}`); },
  };
  const dt = T.PREVIEW_STEP;
  const at = (angle, t) => {
    const a = angle * Math.PI / 180;
    return [dir * mortar.v * Math.cos(a) * t, -mortar.v * Math.sin(a) * t + config.K.GRAVITY * mortar.g * t * t / 2];
  };
  const fanTrace = (_ctx, jit) => {
    const angle = Math.max(mortar.elev[0], Math.min(mortar.elev[1], center + jit));
    const pts = [[0, 0, 0]];
    let prev = pts[0];
    for (let i = 1; i <= T.PREVIEW_STEPS; i++) {
      const p = at(angle, i * dt);
      if (p[1] >= 400) {
        const f = (400 - prev[1]) / (p[1] - prev[1]);
        const hit = [prev[0] + (p[0] - prev[0]) * f, 400];
        pts.push([hit[0], hit[1], (i - 1 + f) * dt]);
        return { jit, pts, end: hit, key: 'g' };
      }
      if (i % 3 === 0) pts.push([p[0], p[1], i * dt]);
      prev = p;
    }
    throw new Error('弹道未在采样时限内落地');
  };
  const context = { g, B: { e: {}, ter: null }, C: config.K.CELL, T, FAN_TAIL: 60, FAN_BUDGET: 220,
    fanTrace, fanPlane: () => ({ x: 0, y: 0, dx: 1, dy: 0 }) };
  vm.createContext(context);
  vm.runInContext(viewCode + '\nthis.drawFanForCheck = drawFan;', context);
  context.drawFanForCheck({}, { key: 'mortar' }, center, false, mortar.spread, 'white');

  // 在内部弹道上及两侧各取一点；真实散布的轨迹周围必须被预览覆盖。
  const p = at(sampleAngle, time);
  const vx = dir * mortar.v * Math.cos(sampleAngle * Math.PI / 180);
  const vy = -mortar.v * Math.sin(sampleAngle * Math.PI / 180) + config.K.GRAVITY * mortar.g * time;
  const len = Math.hypot(vx, vy);
  const normal = [-vy / len, vx / len];
  const counts = [-0.75, 0, 0.75].map(d => polys.reduce((n, poly) => n + winding(poly, p[0] + normal[0] * d, p[1] + normal[1] * d), 0));
  if (counts.some(n => n === 0)) throw new Error(`${center}° 中的 ${sampleAngle}° 弹道漏填：绕数 ${counts.join(', ')}`);
  console.log(`${dir > 0 ? '向右' : '向左'} ${center}° / ${sampleAngle}°：绕数 ${counts.join(', ')}，子路径 ${polys.length}`);
}

check(79, 79, 0.8);
check(55, 51, 0.9);
check(79, 79, 0.8, -1);

// 越界恰落在每三步采样点，或刚进入新弦即撞击时，时间戳不能重复。
const traceStart = source.indexOf('  function fanTrace(');
const traceEnd = pointStart >= 0 ? pointStart : source.indexOf('\n  // 准星处的法平面', traceStart);
if (traceStart < 0 || traceEnd < 0) throw new Error('找不到 fanTrace');
const traceCode = source.slice(traceStart, traceEnd);
for (const earlyHit of [false, true]) {
  const state = { cam: { x: 0, w: earlyHit ? 10000 : 0 } };
  const context = { T, FAN_STEP: T.PREVIEW_STEP, H: 720, B: state,
    fanLaunch: () => ({ x0: 0, y0: 0, vx: 9000, vy: 0, g: 0 }),
    fanAt: (L, t) => [L.x0 + L.vx * t, L.y0],
    fanSeg: (_ctx, x0) => earlyHit && x0 >= 225 ? [0, 'g'] : null };
  vm.createContext(context);
  vm.runInContext(traceCode + '\nthis.fanTraceForCheck = fanTrace;', context);
  const pts = context.fanTraceForCheck({}, 0).pts;
  if (pts.length !== 2 || pts[1][2] !== 3 * T.PREVIEW_STEP || !pts.every((p, i) => i === 0 || p[2] > pts[i - 1][2])) {
    throw new Error(`${earlyHit ? '弦起点碰撞' : '三步采样越界'}产生重复飞行时间`);
  }
}
console.log('三步采样越界与弦起点碰撞：时间戳严格递增');
