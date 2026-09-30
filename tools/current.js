// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：机甲套件核心六件——头盔驾驶舱 / 肩甲 / 背负锅炉是现有模块（驾驶舱、甲片、竖式锅炉）装在双足上的机甲外观；
// 盾臂 / 格斗臂 / 锤剑臂 / 臂炮是全新的手臂模块（别的底盘也能装）。每种 6 个，A 多为 09-25 机甲套件（tools/mech-kit.js）的草图重画。
window.SA = window.SA || {};

SA.CUR = (() => {
  const P = SA.PAL, TAU = Math.PI * 2;
  let g = null;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const px = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => {
    g.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g.fillRect(xx, yy, 1, 1);
    }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2); g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  const ring = (cx, cy, r, c) => { const n = Math.ceil(r * 7); for (let i = 0; i < n; i++) { const a = i / n * TAU; px(Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), c); } };
  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]], IRONL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]], BRASS = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]], DARK = [P.dark[0], P.dark[1], P.dark[2], P.dark[3]];
  const LEATHER = [P.black, P.leather[0], P.leather[1], P.leather[2]], WATER = [P.water[0], P.water[1], P.water[2], P.water[3]];
  const box = (x, y, w, h, r) => { R(x, y, w, h, r[0]); R(x + 1, y + 1, w - 2, h - 2, r[2]); R(x + 1, y + h - 2, w - 2, 1, r[1]); R(x + w - 2, y + 1, 1, h - 2, r[1]); R(x + 1, y + 1, w - 2, 1, r[3]); R(x + 1, y + 1, 1, h - 2, r[3]); };
  const rivet = (x, y) => { R(x, y, 2, 2, P.iron[4]); px(x + 1, y + 1, P.iron[2]); };
  // 任意形状按像素判定上色：外沿描边、左上两像素亮、右下两像素暗
  function shape(test, x0, y0, x1, y1, r = IRONL) {
    const inn = (xx, yy) => test(xx + 0.5, yy + 0.5);
    for (let yy = Math.floor(y0); yy <= Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx <= Math.ceil(x1); xx++) {
      if (!inn(xx, yy)) continue;
      if (!inn(xx - 1, yy) || !inn(xx + 1, yy) || !inn(xx, yy - 1) || !inn(xx, yy + 1)) { px(xx, yy, r[0]); continue; }
      px(xx, yy, !inn(xx - 2, yy) || !inn(xx, yy - 2) ? r[3] : !inn(xx + 2, yy) || !inn(xx, yy + 2) ? r[1] : r[2]);
    }
  }
  const inPoly = (pts) => (x, y) => { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; };
  const poly = (pts, r) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); shape(inPoly(pts), Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, r); };
  const ball = (cx, cy, rr, r) => shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr, cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1, r);
  const vtube = (x, y, w, h, r = IRONL) => { R(x, y, w, h, r[0]); R(x + 1, y, w - 2, h, r[2]); R(x + 1, y, 1, h, r[3]); if (w > 3) R(x + w - 2, y, 1, h, r[1]); };
  const htube = (x, y, w, h, r = IRONL) => { R(x, y, w, h, r[0]); R(x, y + 1, w, h - 2, r[2]); R(x, y + 1, w, 1, r[3]); if (h > 3) R(x, y + h - 2, w, 1, r[1]); };
  const lens = (x, y, w, h, glint) => { R(x, y, w, h, P.glass[0]); if (w > 2 && h > 2) R(x + 1, y + 1, w - 2, h - 2, P.glass[2]); px(x + (w > 2 ? 1 : 0), y + (h > 2 ? 1 : 0), glint ? P.white : P.glass[3]); };
  const puff = (x, y, t, n = 3, rise = 8) => { for (let k = 0; k < n; k++) { const p = ((t * 0.04 + k / n) % 1); disc(x + Math.sin(p * 6 + k) * 1.5, y - p * rise, 0.8 + p * 1.6, p < 0.5 ? P.steam[2] : P.steam[1]); } };
  // 黄铜炮弹：横放（弹壳 + 铁弹头 + 底火）/ 竖放
  const shellH = (x, y, l = 9) => { R(x, y, l - 3, 3, P.brass[1]); R(x, y, l - 3, 1, P.brass[3]); R(x, y + 2, l - 3, 1, P.brass[0]); R(x + l - 3, y, 2, 3, P.iron[3]); px(x + l - 1, y + 1, P.iron[3]); px(x + l - 3, y, P.iron[4]); px(x, y + 1, P.brass[0]); };
  const shellV = (x, y, l = 9) => { R(x, y + 3, 3, l - 3, P.brass[1]); R(x, y + 3, 1, l - 3, P.brass[3]); R(x + 2, y + 3, 1, l - 3, P.brass[0]); R(x, y + 1, 3, 2, P.iron[3]); px(x + 1, y, P.iron[3]); px(x, y + 1, P.iron[4]); px(x + 1, y + l - 1, P.brass[0]); };
  const gear = (cx, cy, r, n, rot, ramp = BRASS) => { shape((x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - rot; return d <= r - 1 || (d <= r + 0.6 && Math.cos(a * n) > 0.2); }, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2, ramp); disc(cx, cy, Math.max(0.8, r * 0.3), P.iron[0]); };
  function gauge(cx, cy, r, v = 0.6) {
    disc(cx, cy, r, P.brass[0]); disc(cx, cy, r - 1, P.steam[2]);
    const a = Math.PI * (0.75 + 1.5 * v), L = Math.max(1.5, r - 1.5);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 0.5 + Math.cos(a) * L), Math.round(cy - 0.5 + Math.sin(a) * L), 1, P.dark[0]);
  }
  const plinth = (x, y, x0, x1, top, bot = 24) => { box(x + x0, y + top, x1 - x0, bot - top, IRON); if (x1 - x0 > 8) { rivet(x + x0 + 2, y + top + 2); rivet(x + x1 - 4, y + top + 2); } };
  const saw = (t, per) => ((t % per) + per) % per / per;   // 0～1 锯齿





  // ================= 共用 =================
  const bolt = (x, y) => { px(x, y, P.iron[4]); px(x + 1, y + 1, P.iron[0]); };
  const band = (x, y, w, h = 2) => { R(x, y, w, h, P.brass[1]); R(x, y, w, 1, P.brass[3]); };
  // 沿 a → b 的一段「骨头」：两头宽度 w0 / w1 的四边形
  function quad(ax, ay, bx, by, w0, w1, ramp = IRONL) {
    const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
    poly([[ax + nx * w0, ay + ny * w0], [bx + nx * w1, by + ny * w1], [bx - nx * w1, by - ny * w1], [ax - nx * w0, ay - ny * w0]], ramp);
  }
  const STEEL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]];
  const KEEL = [P.black, P.iron[0], P.iron[1], P.iron[3]];

  // ================= 机械臂的公共骨架（新模块，2×3 子格 = 48×72；肩膀属于手臂）=================
  // 肩在 (14,12)（装到机甲上正好在胸口正中），肘在下方，手腕按姿势走。o.sw = 走路摆臂 -1～1，o.atk = 出招 0～1
  // style：'iron' 铁条臂 · 'steel' 钢臂 + 黄铜肘 · 'hyd' 大臂外挂液压缸 · 'cage' 桁架臂（镂空）
  function armFrame(x, y, style, o, wrist) {
    const sx = x + 14, sy = y + 12, ex = sx + 2 + (o.sw || 0) * 3, ey = sy + 24, [wx, wy] = wrist(ex, ey);
    if (style === 'cage') {
      for (const s of [-3.5, 3.5]) { line(sx + s * 0.3, sy + s, ex + s * 0.3, ey + s * 0.2, 2, P.iron[0]); line(sx + s * 0.3, sy + s, ex + s * 0.3, ey + s * 0.2, 1, P.iron[3]); }
      for (let k = 1; k < 4; k++) { const u = k / 4; line(sx + (ex - sx) * u - 3, sy + (ey - sy) * u - 3, sx + (ex - sx) * (u + 0.2) + 3, sy + (ey - sy) * (u + 0.2) + 3, 1, P.iron[2]); }
    } else quad(sx, sy, ex, ey, 6, 5, style === 'steel' ? STEEL : IRONL);
    if (style === 'hyd') { line(sx - 5, sy + 3, (ex + wx) / 2 - 3, (ey + wy) / 2 + 3, 3, P.iron[0]); line(sx - 5, sy + 3, sx + (ex - sx) * 0.6 - 4, sy + (ey - sy) * 0.6 + 3, 2, P.brass[1]); line(sx + (ex - sx) * 0.6 - 4, sy + (ey - sy) * 0.6 + 3, (ex + wx) / 2 - 3, (ey + wy) / 2 + 3, 1, P.iron[4]); }
    quad(ex, ey, wx, wy, 5, 6, style === 'steel' ? STEEL : IRONL);
    disc(ex, ey, style === 'steel' ? 5 : 4.2, P.brass[0]); disc(ex, ey, style === 'steel' ? 4 : 3.2, P.brass[1]); px(ex - 1, ey - 1, P.brass[3]);
    disc(sx, sy, 6.5, P.dark[1]); disc(sx, sy, 3, P.dark[0]);
    // 肩甲（不超过大臂两倍宽）
    poly([[sx - 9, sy - 1], [sx - 6, sy - 8], [sx + 5, sy - 9], [sx + 10, sy - 3], [sx + 8, sy + 3], [sx - 8, sy + 3]], style === 'steel' ? STEEL : IRONL);
    if (style === 'steel') { R(sx - 8, sy + 2, 17, 1, P.brass[2]); } else { bolt(sx - 6, sy - 4); bolt(sx + 5, sy - 5); }
    return { sx, sy, ex, ey, wx, wy, a: Math.atan2(wy - ey, wx - ex) };
  }
  const idleWrist = (o) => (ex, ey) => [ex + 12 + (o.atk || 0) * 9, ey + 14 - (o.atk || 0) * 10];   // 默认：小臂朝前下；出招时往前平伸
  // 在手腕处按小臂方向画东西：f(u, v) → 世界坐标（u 沿小臂向前，v 垂直向下）
  const along = (F) => { const c = Math.cos(F.a), s = Math.sin(F.a); return (u, v) => [F.wx + c * u - s * v, F.wy + s * u + c * v]; };
  const polyA = (at, pts, ramp) => poly(pts.map(([u, v]) => at(u, v)), ramp);
  const fist = (F, ramp = IRONL) => { const at = along(F); polyA(at, [[-2, -6], [8, -5], [9, 5], [-2, 6]], ramp); line(...at(5, -5), ...at(5, 5), 1, P.iron[1]); };

  // ================= 盾臂 arm_shield（新：机械臂 + 盾，挡正面）=================
  const SHIELD = [
    { key: 'A', name: '鸢形铁盾', ref: '（09-25 机甲套件 · 铁制盾臂重画）', style: 'iron',
      idea: '铁条手臂端着一面尖底的鸢形铁盾挡在胸前，盾上一道观察缝、中间一只黄铜盾钉、两排铆钉。出招时盾往前一顶。',
      shield(cx, cy) { poly([[cx - 11, cy - 20], [cx + 11, cy - 20], [cx + 11, cy + 14], [cx, cy + 22], [cx - 11, cy + 14]], IRONL); R(cx - 7, cy - 14, 14, 2, P.black); disc(cx, cy + 1, 4, P.brass[1]); px(cx - 1, cy, P.brass[3]); for (const v of [-17, -6, 9]) { bolt(cx - 10, cy + v); bolt(cx + 8, cy + v); } } },
    { key: 'B', name: '齿轮纹盾', ref: '（09-25 机甲套件 · 钢制盾臂重画）', style: 'steel',
      idea: '钢臂（黄铜肘）端着一面黄铜包边的尖底盾，盾心一只大齿轮纹章，下面一道黄铜竖筋。钢制的「骑士」感。',
      shield(cx, cy) { poly([[cx - 13, cy - 21], [cx + 13, cy - 21], [cx + 13, cy + 3], [cx, cy + 24], [cx - 13, cy + 3]], BRASS); poly([[cx - 11, cy - 19], [cx + 11, cy - 19], [cx + 11, cy + 2], [cx, cy + 21], [cx - 11, cy + 2]], STEEL); gear(cx, cy - 5, 6, 10, 0.2); R(cx - 1, cy + 4, 2, 12, P.brass[2]); } },
    { key: 'C', name: '塔盾', ref: '新：又高又直的长方塔盾（观察窗 + 支脚）',
      idea: '一面又高又直的长方形塔盾，几乎和躯干一样高，上面一扇带铁条的小观察窗，盾底一只可以撑地的支脚；最「挡」，正面几乎全盖住。', style: 'hyd',
      shield(cx, cy) { box(cx - 10, cy - 26, 20, 50, IRONL); R(cx - 6, cy - 20, 12, 5, P.dark[0]); for (const u of [-3, 0, 3]) R(cx + u, cy - 20, 1, 5, P.iron[3]); for (let v = -12; v < 22; v += 8) { R(cx - 9, cy + v, 18, 1, P.iron[1]); bolt(cx - 8, cy + v + 2); bolt(cx + 7, cy + v + 2); } R(cx - 2, cy + 24, 4, 5, P.iron[1]); } },
    { key: 'D', name: '锅炉门盾', ref: '新：一扇铆接锅炉门当盾（铰链 + 门闩 + 观火孔）',
      idea: '一扇厚厚的铆接锅炉门被当成了盾：左边两只大铰链、右边一根门闩、正中一只带盖的圆形观火孔，门边一圈铆钉。最蒸汽、最有「随手拿来当盾」的工业感。', style: 'iron',
      shield(cx, cy) { box(cx - 12, cy - 20, 24, 40, IRONL); for (let v = -18; v < 20; v += 4) { bolt(cx - 11, cy + v); bolt(cx + 10, cy + v); } for (const v of [-12, 10]) { R(cx - 15, cy + v, 6, 4, P.iron[0]); R(cx - 14, cy + v + 1, 4, 2, P.iron[3]); } R(cx + 6, cy - 2, 7, 3, P.brass[1]); disc(cx - 1, cy - 5, 4.5, P.iron[0]); disc(cx - 1, cy - 5, 3.2, P.dark[0]); px(cx - 2, cy - 6, P.fire[1]); R(cx - 5, cy - 9, 8, 2, P.iron[3]); } },
    { key: 'E', name: '折扇盾', ref: '新：几片钢板像折扇一样张开（平时收在小臂上）',
      idea: '五片弧形钢板叠在小臂上，挡的时候像折扇一样「唰」地张开成一面半圆盾（页面上出招时张开、平时收拢），扇骨根部一只黄铜轴。会动，最有机关感。', style: 'steel',
      shield(cx, cy, o) { const k = 0.35 + (o.atk || 0) * 0.65; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42 * k, a2 = a + 0.36 * k + 0.1; poly([[cx - 8, cy + 10], [cx - 8 + Math.cos(a) * 26, cy + 10 + Math.sin(a) * 26], [cx - 8 + Math.cos(a2) * 26, cy + 10 + Math.sin(a2) * 26]], i % 2 ? STEEL : IRONL); } disc(cx - 8, cy + 10, 3.2, P.brass[1]); px(cx - 9, cy + 9, P.brass[3]); } },
    { key: 'F', name: '百叶防盾', ref: '新：炮盾式的百叶防盾（一排斜百叶 + 射击孔）',
      idea: '一面方正的防盾，正面是一排斜着的百叶（子弹打上来往下弹），上沿一道折边、正中一只射击孔；像一战机枪手的炮盾被装到了手臂上。', style: 'hyd',
      shield(cx, cy) { box(cx - 12, cy - 20, 24, 42, IRONL); for (let v = -15; v < 19; v += 4) { R(cx - 10, cy + v, 20, 2, P.iron[1]); R(cx - 10, cy + v, 20, 1, P.iron[4]); } R(cx - 13, cy - 21, 26, 3, P.iron[0]); R(cx - 12, cy - 21, 24, 1, P.iron[3]); R(cx - 2, cy - 4, 4, 3, P.black); } },
  ].map((e) => ({ ...e, draw(x, y, o) { const F = armFrame(x, y, e.style, o, (ex, ey) => [ex + 11 + (o.atk || 0) * 5, ey + 4]); e.shield(F.wx + 4, F.wy - 4, o); } }));

  // ================= 格斗臂 arm_fist（新：贴身出拳）=================
  const FIST = [
    { key: 'A', name: '三指液压爪', ref: '（09-25 机甲套件 · 铁制格斗臂重画）', style: 'iron',
      idea: '铁条手臂末端一只三指液压爪（黄铜指节），出招时整条小臂往前平伸、三指张开抓过去。',
      hand(F, o) { const at = along(F), op = o.atk || 0; polyA(at, [[-2, -6], [3, -6], [3, 6], [-2, 6]], IRONL); for (const [f, b] of [[4, 3], [0, 4], [-4, 2]]) { const k = f + b * (1 - op) + (op * f * 0.5); line(...at(3, f * 0.8), ...at(8, f), 2, P.brass[1]); line(...at(8, f), ...at(11, k), 2, P.brass[2]); } } },
    { key: 'B', name: '护手铁拳', ref: '（09-25 机甲套件 · 钢制格斗臂重画）', style: 'steel',
      idea: '钢臂末端一只护手铁拳（一道黄铜指节箍），出招就是一记直拳。最朴素、最好认。',
      hand(F) { fist(F, STEEL); const at = along(F); line(...at(-1, -5), ...at(-1, 6), 1, P.brass[2]); } },
    { key: 'C', name: '蒸汽冲拳', ref: '新：拳头后面一只蒸汽活塞，出拳时拳头被活塞「弹」出去',
      idea: '小臂里藏着一只蒸汽活塞，拳头装在活塞杆上：出拳时手臂先前伸，拳头再被活塞猛地弹出去一截（露出亮钢活塞杆），拳后喷一口白汽。和蒸汽撞锤是一家。', style: 'hyd',
      hand(F, o) { const at = along(F), e = (o.atk || 0) * 7; line(...at(0, 0), ...at(e, 0), 2, P.iron[4]); const G = { ...F, wx: at(e, 0)[0], wy: at(e, 0)[1] }; fist(G); band(...at(-4, -6).map(Math.round), 3, 3); } ,
      fx(F, o) { if ((o.atk || 0) > 0.7) puff(...along(F)(-2, -6), o.t, 2, 5); } },
    { key: 'D', name: '指虎重拳', ref: '新：一只特大的拳头，指节上套一排黄铜指虎（带钉）',
      idea: '一只特大的铁拳（比别的拳头大一圈），四个指节上套着一排带钉的黄铜指虎；拳头大、手臂细，最有「一拳下去」的分量。', style: 'iron',
      hand(F) { const at = along(F); polyA(at, [[-2, -8], [11, -7], [12, 7], [-2, 8]], IRONL); for (let k = -6; k <= 6; k += 4) { line(...at(11, k), ...at(12, k + 2), 2, P.brass[1]); px(...at(14, k + 1), P.iron[4]); } line(...at(7, -7), ...at(7, 7), 1, P.iron[1]); } },
    { key: 'E', name: '虎钳爪', ref: '新：车间的虎钳改成手（两块钳口 + 丝杠）',
      idea: '手是一台车间虎钳：上下两块带齿的钳口，后面一根丝杠和转柄；出招时钳口「咔」地夹紧。工业味最足，一看就是「抓住就不放」。', style: 'cage',
      hand(F, o) { const at = along(F), g2 = 5 - (o.atk || 0) * 3; polyA(at, [[-2, -6], [4, -6], [4, 6], [-2, 6]], IRONL); for (const s of [-1, 1]) polyA(at, [[4, s * g2], [14, s * g2], [14, s * (g2 + 4)], [4, s * (g2 + 4)]], IRONL); for (let u = 6; u < 14; u += 2) { px(...at(u, -g2 + 0.5), P.iron[4]); px(...at(u, g2 - 0.5), P.iron[4]); } line(...at(-2, 0), ...at(-8, 0), 1, P.iron[4]); line(...at(-8, -3), ...at(-8, 3), 1, P.brass[2]); } },
    { key: 'F', name: '钳爪', ref: '新：两根弯曲的钳指（像起重机的抓钩）',
      idea: '手是两根弯曲的铁钳指，像起重机抓钩一样一张一合（出招时合拢），钳指内侧一排小齿，根部一只黄铜转轴。剪影是一只张开的钳子。', style: 'hyd',
      hand(F, o) { const at = along(F), op = 1 - (o.atk || 0); disc(...at(1, 0), 3, P.brass[1]); for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(at(2 + u * 12, s * (2 + Math.sin(u * Math.PI) * (3 + op * 4) - u * 3))); } for (let k = 1; k < pts.length; k++) line(...pts[k - 1], ...pts[k], 2, P.iron[3]); px(...pts[6], P.iron[4]); } } },
  ].map((e) => ({ ...e, draw(x, y, o) { const F = armFrame(x, y, e.style, o, idleWrist(o)); e.hand(F, o); }, fx: e.fx ? function (x, y, o) { const sx = x + 14, sy = y + 12, ex = sx + 2 + (o.sw || 0) * 3, ey = sy + 24, [wx, wy] = idleWrist(o)(ex, ey); e.fx({ wx, wy, a: Math.atan2(wy - ey, wx - ex) }, o); } : undefined }));

  // ================= 锤臂 / 剑臂 arm_blade（新：挥砍 / 砸）=================
  // o.atk：0 = 举起，1 = 劈到前下方
  const swingA = (o, lo, hi) => lo + (hi - lo) * (o.atk || 0);
  const BLADE = [
    { key: 'A', name: '蒸汽锤', ref: '（09-25 机甲套件 · 锤臂重画）', style: 'iron',
      idea: '手握一柄长柄蒸汽锤：锤头又宽又厚（两道黄铜箍），锤头背后一根小活塞；举起 → 砸下。',
      weap(F, o) { const a = swingA(o, -1.3, 0.55), c = Math.cos(a), s = Math.sin(a), at = (u, v) => [F.wx + c * u - s * v, F.wy + s * u + c * v]; line(...at(-6, 0), ...at(28, 0), 3, P.leather[1]); polyA(at, [[24, -12], [40, -13], [40, 13], [24, 12]], IRONL); for (const u of [28, 35]) line(...at(u, -12), ...at(u, 12), 1, P.brass[2]); polyA(at, [[29, -18], [33, -18], [33, -12], [29, -12]], DARK); } },
    { key: 'B', name: '宽刃大剑', ref: '（09-25 机甲套件 · 剑臂重画）', style: 'steel',
      idea: '手握一柄宽刃锻铁大剑（黄铜十字护手、皮缠柄），举起 → 横劈。',
      weap(F, o) { const a = swingA(o, -1.4, 0.35), c = Math.cos(a), s = Math.sin(a), at = (u, v) => [F.wx + c * u - s * v, F.wy + s * u + c * v]; line(...at(-7, 0), ...at(0, 0), 3, P.leather[1]); disc(...at(-8, 0), 2, P.brass[1]); polyA(at, [[4, -3.5], [44, -2], [50, 0], [44, 2], [4, 3.5]], [P.iron[0], P.iron[3], P.iron[4], P.white]); line(...at(6, 0), ...at(42, 0), 1, P.iron[2]); polyA(at, [[1, -8], [4, -8], [4, 8], [1, 8]], BRASS); } },
    { key: 'C', name: '链锤', ref: '新：短柄 + 一截铁链 + 带钉的铁球（流星锤）',
      idea: '手握一根短柄，柄头一截铁链拴着一只带钉的铁球；举起时铁球垂在后面晃，劈下时铁链甩直、铁球砸出去。最野蛮、动起来最好看。', style: 'hyd',
      weap(F, o) { const a = swingA(o, -1.6, 0.2), c = Math.cos(a), s = Math.sin(a), hx = F.wx + c * 10, hy = F.wy + s * 10; line(F.wx, F.wy, hx, hy, 3, P.leather[1]); const k = o.atk || 0, bx = hx + Math.cos(a + (1 - k) * 1.2) * 18, by = hy + Math.sin(a + (1 - k) * 1.2) * 18 + (1 - k) * 6; for (let i = 0; i <= 6; i++) { const u = i / 6; px(hx + (bx - hx) * u, hy + (by - hy) * u + Math.sin(u * Math.PI) * (1 - k) * 3, i % 2 ? P.iron[4] : P.iron[1]); } for (let j = 0; j < 8; j++) { const b = j / 8 * TAU; line(bx, by, bx + Math.cos(b) * 7, by + Math.sin(b) * 7, 1, P.iron[3]); } ball(bx, by, 4.5, IRONL); } },
    { key: 'D', name: '蒸汽圆锯', ref: '新：小臂末端一片蒸汽驱动的大圆锯（锯齿一直在转）',
      idea: '小臂末端装着一片大圆锯（外圈一圈锯齿、中间黄铜轮毂），锯片一直在转，出招时往前推过去；锯罩上沿一道铁护罩。车间的蒸汽锯改的，最「工业凶器」。', style: 'cage',
      weap(F, o) { const at = along(F), [cx, cy] = at(12, 2), r = 10, rot = o.t * 0.4; for (let k = 0; k < 20; k++) { const b = rot + k / 20 * TAU; line(cx + Math.cos(b) * (r - 1), cy + Math.sin(b) * (r - 1), cx + Math.cos(b + 0.12) * (r + 2), cy + Math.sin(b + 0.12) * (r + 2), 1, P.iron[4]); } disc(cx, cy, r, P.iron[2]); disc(cx, cy, r - 1.5, P.iron[3]); for (let k = 0; k < 4; k++) { const b = rot + k / 4 * TAU; line(cx, cy, cx + Math.cos(b) * (r - 2), cy + Math.sin(b) * (r - 2), 1, P.iron[1]); } disc(cx, cy, 3, P.brass[1]); px(cx - 1, cy - 1, P.brass[3]); polyA(at, [[0, -6], [18, -12], [22, -8], [4, -3]], IRONL); } },
    { key: 'E', name: '战斧', ref: '新：长柄战斧（半月斧刃 + 背后的尖啄）',
      idea: '手握一柄长柄战斧：一边是半月形的宽斧刃，另一边一只尖啄；举起 → 劈下。剪影是一弯新月，和锤、剑都不一样。', style: 'steel',
      weap(F, o) { const a = swingA(o, -1.35, 0.5), c = Math.cos(a), s = Math.sin(a), at = (u, v) => [F.wx + c * u - s * v, F.wy + s * u + c * v]; line(...at(-6, 0), ...at(34, 0), 2, P.leather[1]); const pts = []; for (let k = 0; k <= 8; k++) { const b = -1 + k / 8 * 2; pts.push([28 + Math.cos(b) * 3 + 9 * Math.cos(b) , Math.sin(b) * 12]); } polyA(at, [[26, -4], ...pts, [26, 4]], [P.iron[0], P.iron[2], P.iron[3], P.white]); polyA(at, [[26, -2], [26, 2], [18, -9]], IRONL); band(...at(30, -2).map(Math.round), 2, 3); } },
    { key: 'F', name: '骑兵马刀', ref: '新：一把弯弯的骑兵马刀（黄铜护手弓）',
      idea: '手握一把长长的弯马刀，刀身弯成一道弧、刃口一道亮光，护手是一只黄铜的护手弓；出招是一记由上往下的斜劈。最「骑兵」，也最轻快。', style: 'iron',
      weap(F, o) { const a = swingA(o, -1.5, 0.45), c = Math.cos(a), s = Math.sin(a), at = (u, v) => [F.wx + c * u - s * v, F.wy + s * u + c * v]; line(...at(-6, 0), ...at(0, 0), 3, P.leather[1]); for (let k = 0; k < 42; k++) { const bend = (k / 42) ** 2 * 7; line(...at(2 + k, bend - 2), ...at(2 + k, bend + 1.5 - k / 40), 1, k % 3 ? P.iron[3] : P.iron[4]); px(...at(2 + k, bend - 2), P.white); } const [ga, gb] = at(0, 0); for (let k = 0; k < 8; k++) { const b = Math.PI * (0.2 + k / 8 * 0.8); px(...at(-3 + Math.cos(b) * 4, Math.sin(b) * 5), P.brass[2]); } } },
  ].map((e) => ({ ...e, draw(x, y, o) { const F = armFrame(x, y, e.style, o, (ex, ey) => [ex + 12, ey + 8]); e.weap(F, o); } }));

  // ================= 臂炮 arm_gun（新：小臂就是一门炮）=================
  const GUN = [
    { key: 'A', name: '巨炮臂', ref: '（09-25 机甲套件 · 巨炮臂重画）', style: 'iron',
      idea: '整条小臂换成一门长管炮：粗炮身、三道黄铜箍、炮口一圈黄铜，炮身下一只供弹盒；开火时整门炮往后一坐。',
      gun(F, o) { const at = along(F), k = (o.atk || 0) * -3; polyA(at, [[-6 + k, -7], [12 + k, -7], [12 + k, 7], [-6 + k, 7]], IRONL); polyA(at, [[12 + k, -5], [36 + k, -4], [36 + k, 4], [12 + k, 5]], IRONL); polyA(at, [[35 + k, -6], [40 + k, -6], [40 + k, 6], [35 + k, 6]], BRASS); for (const u of [18, 25, 31]) line(...at(u + k, -5), ...at(u + k, 5), 1, P.brass[2]); polyA(at, [[0 + k, 7], [6 + k, 7], [6 + k, 12], [0 + k, 12]], DARK); } },
    { key: 'B', name: '双管臂炮', ref: '新：上下并排两根短炮管（像双管猎枪）',
      idea: '小臂上并排两根短粗的炮管（上下叠），中间一块黄铜夹板，炮尾一只击锤；像一把放大的双管猎枪装在胳膊上。', style: 'steel',
      gun(F, o) { const at = along(F), k = (o.atk || 0) * -2; for (const v of [-3.5, 3.5]) polyA(at, [[-2 + k, v - 3], [28 + k, v - 3], [28 + k, v + 3], [-2 + k, v + 3]], STEEL); polyA(at, [[6 + k, -7], [12 + k, -7], [12 + k, 7], [6 + k, 7]], BRASS); for (const v of [-3.5, 3.5]) px(...at(28 + k, v), P.black); line(...at(-4 + k, -6), ...at(-1 + k, -9), 2, P.iron[3]); } },
    { key: 'C', name: '转管臂炮', ref: '新：小臂上一挺手摇加特林（六根转管 + 弹鼓）',
      idea: '小臂上装着一挺转管机炮：一束六根枪管（一直在转，亮线在管束上走）、炮身上一只圆弹鼓；出招就是一阵连射。', style: 'hyd',
      gun(F, o) { const at = along(F); polyA(at, [[-4, -6], [10, -6], [10, 6], [-4, 6]], IRONL); disc(...at(3, -9), 5, P.brass[1]); disc(...at(3, -9), 3, P.brass[0]); const rot = Math.floor(o.t * ((o.atk || 0) > 0.3 ? 1.2 : 0.2)) % 3; for (let k = -2; k <= 2; k++) polyA(at, [[10, k * 2 - 1], [30, k * 2 - 1], [30, k * 2 + 0.5], [10, k * 2 + 0.5]], (k + rot) % 3 === 0 ? STEEL : IRONL); for (const u of [14, 27]) polyA(at, [[u, -6], [u + 2, -6], [u + 2, 6], [u, 6]], BRASS); } },
    { key: 'D', name: '臼炮臂', ref: '新：小臂上一门朝上的短粗臼炮（抛射）',
      idea: '小臂末端一门短粗的臼炮，炮口朝前上方翘起，炮口一圈厚黄铜箍；抛射用的，剪影是一只「大口朝上的罐子」。', style: 'cage',
      gun(F, o) { const at = along(F), [cx, cy] = at(6, -2), a = F.a - 0.9; const c = Math.cos(a), s = Math.sin(a), bt = (u, v) => [cx + c * u - s * v, cy + s * u + c * v]; polyA(bt, [[-4, -7], [14, -9], [14, 9], [-4, 7]], IRONL); polyA(bt, [[12, -10], [16, -10], [16, 10], [12, 10]], BRASS); line(...bt(15, -7), ...bt(15, 7), 1, P.black); disc(cx, cy, 3, P.brass[1]); } },
    { key: 'E', name: '喇叭口霰弹臂', ref: '新：炮口喇叭形张开的霰弹炮（老式喇叭枪放大）',
      idea: '小臂上一根炮管，炮口像喇叭一样张开（老式喇叭枪），炮身上两道黄铜箍、一只燧发机；近距离一喷一大片。剪影是一只喇叭，很好认。', style: 'iron',
      gun(F, o) { const at = along(F); polyA(at, [[-4, -5], [8, -5], [8, 5], [-4, 5]], IRONL); for (let u = 0; u < 22; u++) { const h = 3 + (u > 14 ? (u - 14) * 0.9 : 0); line(...at(8 + u, -h), ...at(8 + u, h), 1, u > 18 ? P.brass[2] : u % 6 === 0 ? P.brass[1] : P.iron[3]); } line(...at(-2, -5), ...at(2, -9), 2, P.iron[3]); } },
    { key: 'F', name: '左轮臂炮', ref: '新：小臂上一只大转轮（左轮手枪放大）+ 短炮管',
      idea: '小臂上装着一只大转轮弹巢（侧面五个弹孔，每开一炮转一格），前面一根短炮管；像一把放大的左轮装在胳膊上。', style: 'steel',
      gun(F, o) { const at = along(F), [cx, cy] = at(4, 0); disc(cx, cy, 7, P.iron[0]); disc(cx, cy, 6, P.iron[3]); const rot = Math.floor(o.t / 20) * 1.256; for (let k = 0; k < 5; k++) { const b = rot + k / 5 * TAU; disc(cx + Math.cos(b) * 3.5, cy + Math.sin(b) * 3.5, 1.2, P.brass[2]); } polyA(at, [[10, -3], [30, -3], [30, 3], [10, 3]], STEEL); polyA(at, [[28, -4], [31, -4], [31, 4], [28, 4]], BRASS); } },
  ].map((e) => ({ ...e, draw(x, y, o) { const F = armFrame(x, y, e.style, o, (ex, ey) => [ex + 13, ey + 6 - (o.atk || 0) * 2]); e.gun(F, o); },
    fx(x, y, o) { if ((o.atk || 0) < 0.8) return; const sx = x + 14, sy = y + 12, ex = sx + 2 + (o.sw || 0) * 3, ey = sy + 24, wx = ex + 13, wy = ey + 6 - (o.atk || 0) * 2, a = Math.atan2(wy - ey, wx - ex); puff(wx + Math.cos(a) * 42, wy + Math.sin(a) * 42, o.t, 3, 6); px(wx + Math.cos(a) * 40, wy + Math.sin(a) * 40, P.fire[3]); } }));

  // ================= 头盔驾驶舱（现有 1×1 驾驶舱在双足上的样子）=================
  // seat = 驾驶员（煤球）坐的位置，win = 露出驾驶员的窗（画在材质层之后，剪在窗里）
  const HELM = [
    { key: 'A', name: '圆盔目缝', ref: '（09-25 机甲套件 · 铁制头盔重画）', win: [5, 9, 14, 4], seat: [12, 12],
      idea: '一只圆顶铁盔，正面一道横目缝（驾驶员的眼睛从缝里露出来），顶上一颗铆钉、下沿一道护颈。最朴素的机甲头。',
      draw(x, y, o) { shape((xx, yy) => ((xx - x - 12) / 10) ** 2 + ((yy - y - 12) / 11) ** 2 <= 1 && yy <= y + 22, x + 1, y, x + 23, y + 23, IRONL); R(x + 3, y + 19, 18, 3, P.iron[1]); R(x + 5, y + 9, 14, 4, P.black); bolt(x + 11, y + 3); } },
    { key: 'B', name: '潜水头盔', ref: '新：黄铜潜水头盔（三只圆舷窗 + 领圈螺栓）',
      idea: '一只黄铜潜水头盔：正面一只大圆舷窗（驾驶员的脸就在窗里）、两侧各一只小舷窗，窗上一道道护栅，领圈一圈大螺栓。最「深海蒸汽朋克」，也最有角色感。', win: [7, 7, 10, 10], seat: [12, 13],
      draw(x, y, o) { ball(x + 12, y + 11, 10.5, BRASS); R(x + 2, y + 19, 20, 4, P.brass[0]); for (let u = 3; u < 21; u += 4) px(x + u, y + 20, P.brass[3]); disc(x + 12, y + 12, 5.8, P.brass[0]); disc(x + 12, y + 12, 5, P.glass[0]); R(x + 12, y + 7, 1, 10, P.brass[1]); R(x + 7, y + 12, 10, 1, P.brass[1]); disc(x + 3.5, y + 11, 2, P.glass[1]); disc(x + 20.5, y + 11, 2, P.glass[1]); } },
    { key: 'C', name: '骑士桶盔', ref: '新：中世纪骑士的平顶桶盔（十字目缝 + 透气孔）',
      idea: '一只平顶的圆桶形大盔，正面一道十字形目缝（横缝里露出驾驶员的眼睛），右下一片透气孔，顶沿一道黄铜箍。和蒸汽圣骑那套双足一眼是一家。', win: [4, 9, 16, 3], seat: [12, 11],
      draw(x, y, o) { box(x + 2, y + 2, 20, 21, IRONL); band(x + 2, y + 2, 20); R(x + 4, y + 9, 16, 3, P.black); R(x + 11, y + 6, 2, 12, P.black); for (let k = 0; k < 6; k++) px(x + 15 + (k % 3) * 2, y + 15 + Math.floor(k / 3) * 2, P.black); R(x + 2, y + 21, 20, 2, P.iron[0]); } },
    { key: 'D', name: '一战钢盔舱', ref: '新：英军布罗迪钢盔的宽帽檐盖在一只方驾驶箱上',
      idea: '一只方方的铆接驾驶箱，头顶扣着一顶宽帽檐的一战钢盔（像英军的「汤盆盔」），帽檐下一扇长观察窗，驾驶员在窗里。最一战。', win: [4, 10, 16, 6], seat: [12, 14],
      draw(x, y, o) { box(x + 3, y + 8, 18, 15, IRONL); R(x + 4, y + 10, 16, 6, P.dark[0]); shape((xx, yy) => yy <= y + 8 && ((xx - x - 12) / 11.5) ** 2 + ((yy - y - 8) / 6) ** 2 <= 1, x, y + 1, x + 24, y + 9, IRONL); R(x, y + 7, 24, 2, P.iron[1]); R(x, y + 7, 24, 1, P.iron[3]); bolt(x + 5, y + 19); bolt(x + 17, y + 19); } },
    { key: 'E', name: '独眼瞭望头', ref: '新：一只圆筒瞭望塔，正面一只大透镜「独眼」+ 顶上的潜望镜',
      idea: '一只圆筒形的瞭望头，正面一只黄铜框的大透镜像独眼（驾驶员就在透镜后面），顶上竖着一根小潜望镜，两侧一对铆接耳罩。像一台会走的测距仪。', win: [8, 9, 8, 8], seat: [12, 13],
      draw(x, y, o) { box(x + 3, y + 5, 18, 18, IRONL); for (const u of [1, 20]) box(x + u, y + 9, 3, 9, IRON); disc(x + 12, y + 13, 5.5, P.brass[0]); disc(x + 12, y + 13, 4.5, P.glass[0]); R(x + 10, y, 3, 6, P.iron[3]); R(x + 10, y, 5, 2, P.iron[1]); R(x + 14, y, 1, 2, P.glass[1]); } },
    { key: 'F', name: '尖顶盔', ref: '新：一战德军的尖顶盔（顶上一根黄铜尖刺 + 帽徽）',
      idea: '一只圆顶盔，顶上一根黄铜尖刺（一战德军的尖顶盔），正面一枚黄铜帽徽，帽徽下一道观察缝（驾驶员的眼睛）、前后一对短帽檐。一眼是「军官」。', win: [5, 13, 14, 3], seat: [12, 16],
      draw(x, y, o) { shape((xx, yy) => ((xx - x - 12) / 9.5) ** 2 + ((yy - y - 14) / 10) ** 2 <= 1 && yy <= y + 20, x + 2, y + 4, x + 22, y + 21, IRONL); poly([[x + 11, y + 5], [x + 12, y], [x + 13, y + 5]], BRASS); R(x + 10, y + 5, 4, 2, P.brass[1]); disc(x + 12, y + 9, 2, P.brass[2]); R(x + 5, y + 13, 14, 3, P.black); R(x, y + 19, 7, 2, P.iron[1]); R(x + 17, y + 19, 7, 2, P.iron[1]); R(x + 3, y + 20, 18, 3, P.iron[0]); } },
  ];

  // ================= 肩甲（现有甲片 1×1 在双足上的样子，装在胸口上角 = 肩膀）=================
  const PAULD = [
    { key: 'A', name: '叠片肩甲', ref: '新：三片弧形甲片一层压一层（中世纪的叠片肩甲）',
      idea: '三片弧形的钢甲片从上到下一层压一层，每片边上一道亮边和两颗铆钉；走路时下面两片跟着轻轻晃。最经典的肩甲。',
      draw(x, y, o) { const sw = Math.round((o.sw || 0) * 1); for (let k = 0; k < 3; k++) { const v = y + 2 + k * 6, dx = k * sw; shape((xx, yy) => yy >= v && yy <= v + 8 && ((xx - x - 12 - dx) / 11.5) ** 2 + ((yy - v - 8) / 8) ** 2 <= 1, x, v, x + 24, v + 9, k === 0 ? IRONL : IRON); bolt(x + 4 + dx, v + 4); bolt(x + 18 + dx, v + 4); } } },
    { key: 'B', name: '圆顶肩甲', ref: '新：一只圆鼓鼓的肩甲（黄铜包边 + 一圈铆钉）',
      idea: '一只圆鼓鼓的半球形肩甲扣在肩上，黄铜包边、一圈铆钉，正中一颗大铆钉。结实、厚重，像一只倒扣的锅。',
      draw(x, y, o) { shape((xx, yy) => yy <= y + 20 && ((xx - x - 12) / 11.5) ** 2 + ((yy - y - 20) / 18) ** 2 <= 1, x, y + 1, x + 24, y + 21, IRONL); R(x + 1, y + 19, 22, 3, P.brass[1]); R(x + 1, y + 19, 22, 1, P.brass[3]); for (let k = 0; k < 7; k++) { const a = Math.PI * (1.08 + k / 6 * 0.84); bolt(x + 12 + Math.cos(a) * 8, y + 20 + Math.sin(a) * 13); } disc(x + 12, y + 11, 1.6, P.iron[4]); } },
    { key: 'C', name: '护颈高肩', ref: '新：带高高护颈翻边的哥特式肩甲',
      idea: '一片大肩甲，靠脖子的一侧翻起一道高高的护颈（比肩甲高出一截），翻边上一道黄铜条；剪影是一只翘起的「领子」，护住头盔侧面。',
      draw(x, y, o) { poly([[x + 1, y + 10], [x + 23, y + 8], [x + 23, y + 22], [x + 1, y + 22]], IRONL); poly([[x + 1, y + 10], [x + 2, y + 1], [x + 7, y + 2], [x + 8, y + 10]], IRONL); R(x + 2, y + 2, 5, 1, P.brass[2]); for (let v = 13; v < 22; v += 4) R(x + 2, y + v, 20, 1, P.iron[1]); bolt(x + 19, y + 11); } },
    { key: 'D', name: '铆接盒肩', ref: '新：一只方方的铆接铁盒，上面一盏小信号灯',
      idea: '一只方正的铆接铁盒扣在肩上，四角圆钉、侧面一道加强筋，顶上一盏带护罩的小信号灯（机车前灯缩小）。最「工业车辆」的肩。',
      draw(x, y, o) { box(x + 1, y + 6, 22, 17, IRONL); for (const [a, b] of [[3, 8], [19, 8], [3, 19], [19, 19]]) bolt(x + a, y + b); R(x + 2, y + 14, 20, 1, P.iron[1]); R(x + 8, y + 2, 7, 5, P.iron[0]); disc(x + 11.5, y + 4.5, 2, P.fire[2]); px(x + 11, y + 4, P.fire[3]); R(x + 8, y + 2, 7, 1, P.iron[3]); } },
    { key: 'E', name: '弹簧挂甲', ref: '新：一块厚甲板挂在两根减震弹簧上（被打时会缩）',
      idea: '一块厚厚的弧形甲板用两根粗弹簧挂在肩上，弹簧外露（像火车的缓冲器），甲板被打时会往里一缩再弹回来；走路时甲板轻轻上下颤。',
      draw(x, y, o) { const b = Math.round(Math.sin((o.t || 0) * 0.2) * 1); box(x + 4, y + 18, 16, 5, IRON); for (const u of [7, 16]) for (let v = 9 + b; v < 18; v += 2) { R(x + u - 1, y + v, 3, 1, v % 4 ? P.iron[4] : P.iron[2]); } shape((xx, yy) => yy >= y + 2 + b && yy <= y + 10 + b && ((xx - x - 12) / 11.5) ** 2 + ((yy - y - 10 - b) / 8) ** 2 <= 1, x, y + 1, x + 24, y + 11 + b, IRONL); bolt(x + 5, y + 6 + b); bolt(x + 18, y + 6 + b); } },
    { key: 'F', name: '刺钉肩甲', ref: '新：一只圆肩甲上一排短尖钉 + 下垂的锁子甲',
      idea: '一只圆肩甲上竖着一排短短的尖钉，肩甲下沿垂下一小片锁子甲（一格格的小铁环）；最凶，和寡妇、黑龙这些「狠角色」的车配。',
      draw(x, y, o) { shape((xx, yy) => yy <= y + 16 && ((xx - x - 12) / 11) ** 2 + ((yy - y - 16) / 12) ** 2 <= 1, x + 1, y + 3, x + 23, y + 17, IRONL); for (let k = 0; k < 5; k++) { const a = Math.PI * (1.15 + k / 4 * 0.7), bx = x + 12 + Math.cos(a) * 10, by = y + 16 + Math.sin(a) * 11; poly([[bx - 1, by], [bx + Math.cos(a) * 4, by + Math.sin(a) * 4], [bx + 1, by]], IRONL); } for (let v = 17; v < 24; v += 2) for (let u = 3 + (v % 4 ? 1 : 0); u < 22; u += 2) px(x + u, y + v, P.iron[3]); } },
  ];

  // ================= 背负锅炉（现有竖式锅炉 1×2 在双足上的样子，背在躯干后面）=================
  const PACK = [
    { key: 'A', name: '立式背锅炉', ref: '新：一只立式小锅炉背在背上，烟囱从肩后伸出来',
      idea: '一只铆接的立式小锅炉背在躯干后面，两条皮背带勒着，锅炉顶上一根短烟囱越过肩膀往上冒烟，下面一扇小炉门透出火光。机甲剪影最重要的一笔：肩后的烟囱。',
      draw(x, y, o) { R(x + 6, y - 14, 5, 16, P.dark[0]); R(x + 7, y - 14, 3, 16, P.dark[2]); R(x + 5, y - 15, 7, 2, P.dark[0]); bottle5(x + 2, y + 2, 18, 42); for (const v of [10, 30]) { R(x + 18, y + v, 6, 3, P.leather[1]); R(x + 18, y + v, 6, 1, P.leather[2]); } box(x + 6, y + 30, 10, 8, DARK); }, fx(x, y, o) { puff(x + 8, y - 14, o.t, 3, 9); firebox(x + 7, y + 32, 8, 5, o.t); } },
    { key: 'B', name: '双烟囱背包', ref: '新：两根并排的细烟囱（像机车的双烟囱）',
      idea: '背上一只方形锅炉箱，顶上两根并排的细烟囱从肩后伸出、一高一低（像两只竖着的角），箱侧一只压力表；剪影最「机甲」。',
      draw(x, y, o) { for (const [u, h] of [[4, 18], [12, 12]]) { R(x + u, y - h, 5, h + 3, P.dark[0]); R(x + u + 1, y - h, 3, h + 3, P.dark[2]); R(x + u - 1, y - h - 1, 7, 2, P.dark[0]); } box(x + 1, y + 2, 21, 42, IRONL); for (let v = 8; v < 42; v += 6) { bolt(x + 3, y + v); bolt(x + 18, y + v); } gauge(x + 11, y + 14, 3.5, 0.6); box(x + 6, y + 30, 10, 8, DARK); }, fx(x, y, o) { puff(x + 6, y - 18, o.t, 2, 8); puff(x + 14, y - 12, o.t + 20, 2, 8); firebox(x + 7, y + 32, 8, 5, o.t); } },
    { key: 'C', name: '球形锅炉背包', ref: '新：一只铆接的圆球锅炉（像潜水员的背罐变大）',
      idea: '背上一只圆鼓鼓的铆接球形锅炉，一道黄铜赤道箍，球底一扇小炉门透火光，球顶一根弯烟囱往后甩；圆滚滚的剪影和方正的躯干形成对比。',
      draw(x, y, o) { for (let k = 0; k < 10; k++) { const u = k / 10; R(x + 12 - u * 8, y + 4 - u * 16, 4, 3, P.dark[k % 2 ? 0 : 2]); } ball(x + 12, y + 18, 11, IRONL); R(x + 1, y + 18, 22, 2, P.brass[1]); R(x + 1, y + 18, 22, 1, P.brass[3]); box(x + 5, y + 30, 14, 14, IRONL); box(x + 8, y + 33, 8, 7, DARK); for (const v of [8, 24]) R(x + 18, y + v, 6, 3, P.leather[1]); }, fx(x, y, o) { puff(x + 4, y - 12, o.t, 3, 8); firebox(x + 9, y + 35, 6, 4, o.t); } },
    { key: 'D', name: '安全阀锅炉', ref: '新：带杠杆安全阀、压力表、水位管的全套小锅炉',
      idea: '一只立式锅炉，身上挂满锅炉工最熟悉的零件：顶上一只杠杆安全阀（铁球配重）、侧面一只压力表、一根带玻璃的水位管；烟囱在后面。「一台完整的锅炉背在身上」。',
      draw(x, y, o) { R(x + 3, y - 10, 4, 12, P.dark[0]); R(x + 4, y - 10, 2, 12, P.dark[2]); bottle5(x + 3, y + 2, 17, 42); R(x + 11, y - 1, 3, 4, P.brass[1]); line(x + 10, y - 1, x + 22, y - 2, 1, P.iron[3]); disc(x + 21, y, 2, P.iron[0]); gauge(x + 11, y + 14, 3.2, 0.7); R(x + 16, y + 20, 3, 12, P.brass[0]); R(x + 17, y + 22, 1, 9, P.water[1]); box(x + 6, y + 32, 10, 8, DARK); }, fx(x, y, o) { puff(x + 5, y - 10, o.t, 3, 8); firebox(x + 7, y + 34, 8, 5, o.t); } },
    { key: 'E', name: '火箱背篓', ref: '新：一只敞着炉门的火箱 + 背后挂的煤篓',
      idea: '背上一只方形火箱，朝后的炉门敞着（能看见里面烧着的火），火箱外挂一只装满煤块的煤篓，烟囱从火箱顶上伸出。最「一直在烧」的样子。',
      draw(x, y, o) { R(x + 12, y - 12, 5, 16, P.dark[0]); R(x + 13, y - 12, 3, 16, P.dark[2]); box(x + 3, y + 2, 19, 30, IRONL); R(x + 3, y + 12, 8, 14, P.dark[0]); R(x + 1, y + 10, 3, 18, P.iron[1]); box(x + 3, y + 32, 18, 12, [P.leather[0], P.leather[1], P.leather[1], P.leather[2]]); for (const [a, b] of [[6, 33], [10, 32], [14, 33], [8, 35], [12, 35]]) { R(x + a, y + b, 3, 2, P.black); px(x + a, y + b, P.dark[3]); } }, fx(x, y, o) { puff(x + 14, y - 12, o.t, 3, 9); firebox(x + 4, y + 13, 6, 12, o.t); } },
    { key: 'F', name: '背负机车锅炉', ref: '新：竖着背的机车火管锅炉（烟箱门朝上 + 圆烟箱门把手）',
      idea: '一截机车锅炉竖过来背在背上：顶端是机车的圆烟箱门（带中间的门把手和一圈螺栓），烟囱从烟箱侧面伸出，锅炉身上两道黄铜箍。一看就是「把火车头背在身上」。',
      draw(x, y, o) { R(x + 16, y - 8, 5, 12, P.dark[0]); R(x + 17, y - 8, 3, 12, P.dark[2]); bottle5(x + 2, y + 6, 18, 38); disc(x + 11, y + 6, 8.5, P.iron[0]); disc(x + 11, y + 6, 7.5, P.iron[2]); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; px(x + 11 + Math.cos(a) * 6.3, y + 6 + Math.sin(a) * 6.3, P.iron[4]); } disc(x + 11, y + 6, 2, P.brass[1]); for (const v of [18, 34]) band(x + 2, y + v, 18); }, fx(x, y, o) { puff(x + 18, y - 8, o.t, 3, 9); } },
  ];
  function bottle5(x, y, w, h) { vtube(x, y + w / 2, w, h - w, IRONL); shape((xx, yy) => ((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y - w / 2) / (w / 2)) ** 2 <= 1 && yy <= y + w / 2 + 0.5, x, y, x + w, y + w / 2 + 1, IRONL); for (let v = y + w / 2 + 3; v < y + h - 2; v += 4) px(x + 3, v, P.iron[4]); }
  function firebox(x, y, w, h, t) { R(x, y, w, h, P.fire[0]); for (let u = 0; u < w; u++) { const hh = Math.max(1, Math.round(h * (0.5 + 0.4 * Math.sin(u * 1.3 + t * 0.35)))); R(x + u, y + h - hh, 1, hh, P.fire[1]); if (hh > 2) R(x + u, y + h - Math.ceil(hh / 2), 1, Math.ceil(hh / 2), P.fire[2]); } R(x, y + h - 1, w, 1, P.fire[3]); }

  const MODS = [
    { id: 'helmet', name: '头盔驾驶舱（驾驶舱 1×1 的机甲外观）', w: 1, h: 1, slot: 'head', tiers: [1, 3, 5, 6], SET: HELM,
      rule: '不是新模块：现有 1×1 驾驶舱装在双足上时换成「头盔」的样子 · 驾驶员（煤球）从窗 / 目缝里露出来 · 右边是装在双足机甲上的效果（机甲是游戏里的真双足）',
      state: (t) => ({ t, sw: Math.sin(t * 0.08) }), poses: [{ t: 0, label: '' }] },
    { id: 'plate', name: '肩甲（甲片 1×1 的机甲外观）', w: 1, h: 1, slot: 'shoulder', tiers: [1, 3, 5, 6], SET: PAULD,
      rule: '不是新模块：现有甲片装在双足躯干的上角（肩膀）时换成肩甲的样子 · 右边机甲上是装在胸口右上角',
      state: (t) => ({ t, sw: Math.sin(t * 0.08) }), poses: [{ t: 0, label: '' }] },
    { id: 'boiler_s', name: '背负锅炉（竖式锅炉 1×2 的机甲外观）', w: 1, h: 2, slot: 'back', tiers: [1, 3, 5, 6], SET: PACK,
      rule: '不是新模块：现有竖式锅炉装在双足躯干后面一列时换成背负的样子 · 烟囱从肩后伸出来，是机甲剪影最重要的一笔 · 火光、烟都画在材质层之后',
      state: (t) => ({ t, sw: Math.sin(t * 0.08) }), poses: [{ t: 0, label: '' }] },
    { id: 'arm_shield', name: '盾臂（新）', w: 2, h: 3, slot: 'arm', arm: true, tiers: [1, 3, 5, 6], SET: SHIELD,
      rule: '新模块：机械臂 + 盾，挡正面 · 2×3 子格，肩膀属于手臂（肩在胸口正中），画在车体前面 · 别的底盘也能装（最下面一张是装在履带车上），只是没有双足好看 · 页面循环：走路摆臂 → 出招（盾往前一顶 / 折扇盾张开）',
      state: (t) => { const c = t % 90; return { t, sw: Math.sin(t * 0.08), atk: c > 60 ? Math.sin((c - 60) / 30 * Math.PI) : 0 }; }, poses: [{ atk: 0, label: '平时' }, { atk: 1, label: '出招' }] },
    { id: 'arm_fist', name: '格斗臂（新）', w: 2, h: 3, slot: 'arm', arm: true, tiers: [1, 3, 5, 6], SET: FIST,
      rule: '新模块：贴身出拳（和踢击交替）· 2×3 子格，肩在胸口正中 · 别的底盘也能装 · 页面循环：走路摆臂 → 出拳',
      state: (t) => { const c = t % 70; return { t, sw: Math.sin(t * 0.08), atk: c > 50 ? Math.sin((c - 50) / 20 * Math.PI) : 0 }; }, poses: [{ atk: 0, label: '平时' }, { atk: 1, label: '出拳' }] },
    { id: 'arm_blade', name: '锤臂 / 剑臂（新）', w: 2, h: 3, slot: 'arm', arm: true, tiers: [1, 3, 5, 6], SET: BLADE,
      rule: '新模块：近战挥砍 / 砸 · 2×3 子格，武器可以伸出格子外 · 别的底盘也能装 · 页面循环：举起 → 劈下 → 收回',
      state: (t) => { const c = t % 80; return { t, sw: Math.sin(t * 0.08) * 0.4, atk: c < 40 ? 0 : c < 48 ? (c - 40) / 8 : c < 60 ? 1 : 1 - (c - 60) / 20 }; }, poses: [{ atk: 0, label: '举起' }, { atk: 1, label: '劈下' }] },
    { id: 'arm_gun', name: '臂炮（新）', w: 2, h: 3, slot: 'arm', arm: true, tiers: [1, 3, 5, 6], SET: GUN,
      rule: '新模块：小臂就是一门炮，跟着手臂抬 · 2×3 子格，炮管伸出格子外 · 别的底盘也能装 · 页面循环：走路 → 开火（后坐 + 炮口烟）',
      state: (t) => { const c = t % 60; return { t, sw: Math.sin(t * 0.08) * 0.6, atk: c > 50 ? 1 - (c - 50) / 10 : 0 }; }, poses: [{ atk: 0, label: '平时' }, { atk: 1, label: '开火' }] },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, m) {
    g = ctx; if (e.fx) e.fx(x, y, o);
    if (e.seat && SA.Coal) { const mini = SA.Coal.mini(SA.Coal.crew('你'), { st: 1 }); ctx.save(); ctx.beginPath(); ctx.rect(x + e.win[0], y + e.win[1], e.win[2], e.win[3]); ctx.clip(); ctx.drawImage(mini, x + e.seat[0] - 5, y + e.seat[1] - 6); ctx.restore(); }
  }
  return { MODS, figure, over, LINEUP: [] };
})();
