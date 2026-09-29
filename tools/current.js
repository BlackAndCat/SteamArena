// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：大型锅炉 boiler_l、大水箱 water_l（都是 3×3 = 72×72）。用户：都是方形，剪影上很难做出大创意，要在内部造型上做出想法。
// 每种各 6 个，每个换一种内部构造（剖面、炉膛、管束、水窗、液位机构……）；热度 / 水量做成动画。T1 原画 + 游戏的材质层换色。
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

  // ================= 共用：火、水、砖 =================
  // 炉火：暗炉膛里一排跳动的火舌，高度跟热度走（heat 0～1）；底下一层红炭
  function flames(x0, y0, w, h, t, heat) {
    R(x0, y0, w, h, P.dark[0]);
    for (let u = 0; u < w; u++) {
      const hg = h * (0.3 + 0.5 * heat) * (0.55 + 0.45 * Math.sin(u * 1.3 + t * 0.35) * Math.sin(u * 0.4 - t * 0.2));
      if (hg <= 0) continue;
      R(x0 + u, y0 + h - hg, 1, hg, P.fire[1]); R(x0 + u, y0 + h - hg * 0.6, 1, hg * 0.6, P.fire[2]); R(x0 + u, y0 + h - hg * 0.25, 1, hg * 0.25, P.fire[3]);
    }
    R(x0, y0 + h - 2, w, 2, P.fire[0]); for (let u = 1; u < w; u += 3) px(x0 + u, y0 + h - 2, P.fire[1]);
  }
  // 砖砌炉座：一层层错缝的红砖
  function bricks(x0, y0, w, h) {
    R(x0, y0, w, h, P.rust[0]);
    for (let r = 0; r * 4 < h; r++) for (let u = (r % 2) * 4 - 4; u < w; u += 8) { const bx = Math.max(x0, x0 + u + 1), bw = Math.min(x0 + w, x0 + u + 8) - bx; if (bw > 0) { R(bx, y0 + r * 4 + 1, bw, 3, P.rust[1]); R(bx, y0 + r * 4 + 1, bw, 1, P.rust[2]); } }
  }
  // 水：玻璃背景 + 水位（lv 0～1）+ 水面波纹 + 往上冒的气泡
  function water(x0, y0, w, h, lv, t, o = {}) {
    R(x0, y0, w, h, P.glass[0]);
    const top = y0 + h * (1 - lv);
    R(x0, top, w, y0 + h - top, P.water[1]); R(x0, top + 2, w, Math.max(0, y0 + h - top - 2), P.water[1]);
    for (let u = 0; u < w; u++) px(x0 + u, top + (Math.sin(u * 0.8 + t * 0.2) > 0.3 ? 0 : 1), P.water[2]);
    R(x0, top, 1, y0 + h - top, P.water[2]);
    if (o.bubbles !== false) for (let k = 0; k < Math.max(2, w / 6); k++) { const p = saw(t + k * 23, 70), by = y0 + h - 2 - p * (y0 + h - top - 3); if (by > top + 1) px(x0 + 2 + ((k * 7) % Math.max(1, w - 4)), by, P.water[3]); }
  }
  const valve = (x, y, t, per = 140, off = 0) => { R(x - 1, y, 3, 4, P.brass[1]); R(x - 2, y, 5, 1, P.brass[3]); if (saw(t + off, per) < 0.18) puff(x, y - 1, t * 2, 3, 7); };
  const doorG = (cx, cy, r, t, heat) => { disc(cx, cy, r + 1, P.iron[0]); disc(cx, cy, r, P.iron[2]); disc(cx - 1, cy - 1, r - 1.5, P.iron[3]); for (let k = -1; k <= 1; k++) R(cx - r * 0.55, cy + k * 2.4 - 0.5, r * 1.1, 1, heat > 0.2 ? P.fire[heat > 0.6 && Math.sin(t * 0.4 + k) > 0 ? 3 : 2] : P.dark[0]); px(cx + r - 2, cy, P.brass[3]); };


  // ================= v2（用户选定方向后细化）=================
  // 煤球小工的铲煤动作：一个循环 60 格——铲（刃在煤堆里）→ 抬 → 扬（刃到入煤口，一块煤飞进去）→ 回
  const SHOVEL = { pile: [6, 63], mouth: [17, 34] };
  function shovelPose(t) {
    const p = saw(t, 60), P0 = SHOVEL.pile, P1 = SHOVEL.mouth, lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const ease = (k) => k * k * (3 - 2 * k);
    const blade = p < 0.3 ? P0 : p < 0.55 ? lerp(P0, P1, ease((p - 0.3) / 0.25)) : p < 0.68 ? P1 : lerp(P1, P0, ease((p - 0.68) / 0.32));
    return { p, blade, loaded: p > 0.18 && p < 0.6, lump: p >= 0.58 && p < 0.72 ? (p - 0.58) / 0.14 : -1, lean: p < 0.3 ? -1 : p < 0.68 ? 1 : 0 };
  }
  const BOILER2 = [
    { key: 'E2', name: '链条炉排 · 入煤口 + 小工', ref: '维多利亚工厂锅炉的机械加煤机 + 司炉工',
      idea: '（v2）左下一堆煤，一个煤球小工拿着亮闪闪的铲子一直在铲：铲一锹、抬起来、扬进左边的入煤口（一块煤飞进去），再回去铲。入煤口下面就是一直往右走的链条炉排：煤块从入煤口落下，被带进炉膛烧红，烧成灰掉进右下的灰坑。压力表和水位管挪到右侧立柱上，炉膛全部露出来；上面是锅炉筒和安全阀。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        box(x, y + 2, 72, 68, IRON);
        htube(x + 11, y + 6, 48, 18, IRONL); disc(x + 11, y + 15, 9, P.iron[2]); disc(x + 59, y + 15, 9, P.iron[1]); for (let u = 17; u < 56; u += 8) R(x + u, y + 6, 1, 18, P.iron[2]);
        valve(x + 24, y + 2, t); valve(x + 46, y + 2, t, 140, 70);
        // 右侧立柱：压力表 + 水位玻璃管
        box(x + 62, y + 26, 9, 34, IRONL); gauge(x + 66.5, y + 32, 3.6, 0.3 + 0.5 * heat);
        R(x + 65, y + 38, 3, 14, P.glass[0]); R(x + 65, y + 44 - heat * 3, 3, 8 + heat * 3, P.water[1]); R(x + 64, y + 37, 5, 1, P.brass[2]); R(x + 64, y + 52, 5, 1, P.brass[2]);
        // 炉膛（入煤口右边一直到立柱）
        R(x + 22, y + 28, 39, 26, P.dark[0]); flames(x + 26, y + 32, 34, 18, t, heat);
        R(x + 21, y + 27, 41, 1, P.iron[0]); R(x + 21, y + 28, 1, 22, P.iron[3]);
        // 入煤口：一只斜口煤斗 + 上沿黄铜口唇，斗里堆着煤
        poly([[x + 9, y + 30], [x + 25, y + 30], [x + 22, y + 46], [x + 13, y + 46]], IRON);
        R(x + 9, y + 29, 16, 2, P.brass[1]); R(x + 9, y + 29, 16, 1, P.brass[3]);
        for (const [a, b] of [[14, 34], [17, 33], [20, 34], [15, 37], [18, 38], [16, 41], [19, 42]]) { R(x + a, y + b, 2, 2, P.dark[1]); px(x + a, y + b, P.dark[3]); }
        // 链条炉排：从煤斗下面一直走到灰坑，煤块从黑 → 红 → 灰
        R(x + 10, y + 50, 52, 6, P.dark[1]);
        const sh = (t * 0.5) % 4;
        for (let u = 0; u < 52; u += 4) { const xx = x + 10 + ((u + sh) % 52), k = (xx - x - 10) / 52; R(xx, y + 54, 3, 2, P.iron[3]); const c = k < 0.22 ? P.dark[2] : k < 0.8 ? P.fire[heat > 0.5 && Math.sin(t * 0.3 + u) > 0 ? 3 : 2] : P.steam[0]; R(xx, y + 51, 3, 3, c); }
        gear(x + 11, y + 56, 3, 7, t * 0.12, IRONL); gear(x + 60, y + 56, 3, 7, t * 0.12, IRONL);
        R(x + 54, y + 60, 16, 8, P.dark[1]); R(x + 56, y + 63, 11, 4, P.steam[0]); if (saw(t, 30) < 0.5) px(x + 60, y + 58 + saw(t, 30) * 8, P.steam[1]);   // 灰坑
        // 地上的煤堆
        for (const [a, b, r] of [[5, 66, 4], [9, 67, 3.4], [2.5, 68, 2.6], [7, 63, 2.4]]) disc(x + a, y + b, r, P.dark[1]);
        for (const [a, b] of [[4, 64], [7, 65], [3, 67], [10, 66], [6, 62]]) px(x + a, y + b, P.dark[3]);
        R(x + 1, y + 68, 22, 2, P.iron[1]);
      },
      // 小工画在材质层之后（煤球的颜色不被材料换掉）：游戏同款煤球小人 + 两只小手 + 木柄 + 闪亮的铲刃
      over(x, y, o, mini) {
        const t = o.t || 0, S = shovelPose(t), bx = x + S.blade[0], by = y + S.blade[1], cx = x + 12 + S.lean * 0.6, cy = y + 58;
        const hand = [cx + (S.lean >= 0 ? 3 : -2), cy + 1];
        line(hand[0], hand[1], bx, by, 1, P.leather[1]); px(Math.round((hand[0] + bx) / 2), Math.round((hand[1] + by) / 2), P.leather[2]);
        R(bx - 1.5, by - 1, 4, 2, P.iron[4]); px(bx - 1, by - 1, P.white); if (Math.sin(t * 0.5) > 0.3) px(bx + 1, by - 1, P.white);   // 闪亮的铲刃
        if (S.loaded) R(bx - 1, by - 2, 2, 1, P.dark[1]);
        if (S.lump >= 0) { const k = S.lump, lx = x + SHOVEL.mouth[0] + k * 1, ly = y + SHOVEL.mouth[1] - Math.sin(k * Math.PI) * 5 + k * 3; R(lx, ly, 2, 2, P.dark[1]); }
        if (mini) g.drawImage(mini, Math.round(cx - 5), Math.round(cy - 6 + (S.p > 0.3 && S.p < 0.6 ? -1 : 0)));
        px(hand[0], hand[1], P.black); px(hand[0] - (S.lean >= 0 ? 4 : -4), hand[1] + 1, P.black);   // 两只小手
      } },
  ];
  const TANKS2 = [
    { key: 'AEF', name: '拼装水柜 · 舷窗 + 浮球 + 蒸汽泵 + 角铁', ref: '布雷斯韦特分片钢水柜 + 舷窗 + 浮球液位机构 + 给水泵 + 包角铁',
      idea: '（v2：A + E + F 合一）九块带菱形压筋的钢板拼成水柜，四边一圈角铁、四个角各一块三角包角板（铆钉加固）；正中一扇大舷窗看得见水位和气泡；右侧浮球室的观察缝里浮球随水位升降，一根竖杆 + 横杆把它连到舷窗上方的半圆刻度盘，指针同步摆；右下角一台小蒸汽给水泵的活塞来回推。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        // 分片钢板
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const bx = x + 3 + i * 20, by = y + 3 + j * 20; box(bx, by, 20, 20, IRONL);
          line(bx + 10, by + 3, bx + 17, by + 10, 1, P.iron[4]); line(bx + 17, by + 10, bx + 10, by + 17, 1, P.iron[2]); line(bx + 10, by + 17, bx + 3, by + 10, 1, P.iron[2]); line(bx + 3, by + 10, bx + 10, by + 3, 1, P.iron[4]);
        }
        // 角铁：四边一圈 + 四角三角包角板
        const edge = (ax, ay, w, h) => { R(ax, ay, w, h, P.iron[0]); R(ax + 1, ay + 1, w - 2, h - 2, P.iron[1]); R(ax + 1, ay + 1, w - 2, 1, P.iron[3]); };
        edge(x + 1, y + 1, 62, 4); edge(x + 1, y + 59, 62, 4); edge(x + 1, y + 1, 4, 62); edge(x + 59, y + 1, 4, 62);
        for (let u = 8; u < 58; u += 6) { px(x + u, y + 3, P.iron[4]); px(x + u, y + 61, P.iron[4]); px(x + 3, y + u, P.iron[4]); px(x + 61, y + u, P.iron[4]); }
        for (const [cx, cy, sx, sy] of [[5, 5, 1, 1], [59, 5, -1, 1], [5, 59, 1, -1], [59, 59, -1, -1]]) { poly([[x + cx, y + cy], [x + cx + sx * 9, y + cy], [x + cx, y + cy + sy * 9]], IRON); px(x + cx + sx * 2, y + cy + sy * 2, P.iron[4]); px(x + cx + sx * 5, y + cy + sy * 2, P.iron[4]); px(x + cx + sx * 2, y + cy + sy * 5, P.iron[4]); }
        // 大舷窗
        ball(x + 32, y + 34, 14, BRASS); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; px(x + 32 + Math.cos(a) * 12.4, y + 34 + Math.sin(a) * 12.4, P.brass[0]); }
        g.save(); g.beginPath(); g.arc(x + 32, y + 34, 10.5, 0, TAU); g.clip(); water(x + 21, y + 23, 22, 22, lv, t); g.restore();
        px(x + 26, y + 28, P.glass[3]); px(x + 27, y + 27, P.glass[3]);
        // 右侧浮球室 + 连杆 + 刻度盘
        R(x + 63, y + 6, 8, 52, P.iron[0]); R(x + 64, y + 7, 6, 50, P.iron[2]); water(x + 65, y + 9, 4, 46, lv, t, { bubbles: false });
        const fy = y + 9 + 46 * (1 - lv) - 1.5; disc(x + 67, fy, 2.4, P.brass[1]); px(x + 66, fy - 1, P.brass[3]);
        line(x + 67, y + 13, x + 67, fy - 2, 1, P.brass[2]); line(x + 32, y + 13, x + 67, y + 13, 1, P.brass[0]); line(x + 32, y + 12, x + 67, y + 12, 1, P.brass[2]);
        g.save(); g.beginPath(); g.rect(x + 20, y + 3, 24, 11); g.clip(); disc(x + 32, y + 14, 9, P.brass[0]); disc(x + 32, y + 14, 7.5, P.steam[2]); g.restore();
        for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; px(x + 32 + Math.cos(a) * 6, y + 14 + Math.sin(a) * 6, k < 1 ? P.fire[1] : P.dark[1]); }
        const na = Math.PI + lv * Math.PI; line(x + 32, y + 14, x + 32 + Math.cos(na) * 5.5, y + 14 + Math.sin(na) * 5.5, 1, P.dark[0]); disc(x + 32, y + 14, 1.3, P.brass[2]);
        // 右下蒸汽给水泵 + 底座
        R(x + 1, y + 64, 70, 8, P.iron[1]); R(x + 1, y + 64, 70, 1, P.iron[3]);
        const s = Math.sin(t * 0.2) * 3;
        box(x + 46, y + 62, 12, 9, IRONL); R(x + 58, y + 65, 5 + s, 2, P.iron[4]); R(x + 62 + s, y + 63, 2, 6, P.brass[1]);
        gauge(x + 50, y + 60, 2.6, 0.4 + 0.2 * Math.sin(t * 0.2)); htube(x + 40, y + 66, 6, 3, IRONL);
      } },
  ];

  const MODS = [
    { id: 'boiler_l', name: '大型锅炉 · 链条炉排 v2', w: 3, h: 3, rule: '3×3 能源 · 入煤口 + 煤堆 + 司炉小工（画在材质层之后）+ 链条炉排把煤送进炉膛 · 压力表挪到右侧立柱', SET: BOILER2 },
    { id: 'water_l', name: '大水箱 · A + E + F 合一', w: 3, h: 3, rule: '3×3 冷却 · 分片拼装钢板 + 角铁 / 包角板 + 大舷窗 + 浮球液位 + 蒸汽给水泵 · 青色只用在水上', SET: TANKS2 },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, mini) { g = ctx; if (e.over) e.over(x, y, o, mini); }
  return { MODS, figure, over };
})();
