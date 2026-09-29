// 历史存档：大锅炉 + 大水箱（v1～v4 的绘制代码都在这里，页面只显示 v4）。原「当前开发」页的绘制代码。这一页不复用：只放正在开发、等开发者确认的东西；
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


  // ================= v3（2026-09-29 用户：v2 锅炉太敷衍，重做）=================
  // 煤块：暗色块 + 描边 + 左上一粒反光（一眼看出是亮晶晶的煤）
  const lump = (x, y, s = 3, hot = 0) => {
    const c = hot > 0.6 ? [P.fire[1], P.fire[2], P.fire[3]] : hot > 0.2 ? [P.dark[0], P.fire[1], P.fire[2]] : [P.black, P.dark[1], P.dark[3]];
    R(x, y, s, s, c[0]); R(x, y, s - 1, s - 1, c[1]); if (s > 2) px(x + 1, y, hot > 0.2 ? c[2] : P.iron[4]); else px(x, y, c[2]);
  };
  // 滚子链：一串链节（亮的链板 + 暗的销）沿 a → b 排开，off = 走了多远
  function chainRun(ax, ay, bx, by, off, horiz = true) {
    const n = Math.round(Math.hypot(bx - ax, by - ay)), dx = (bx - ax) / n, dy = (by - ay) / n;
    for (let i = 0; i < n; i++) {
      const k = ((i + off) % 4 + 4) % 4, x0 = ax + dx * i, y0 = ay + dy * i;
      px(x0, y0, k < 2 ? P.iron[3] : P.iron[1]);
      if (horiz) px(x0, y0 + 1, k === 1 ? P.iron[0] : P.iron[2]); else px(x0 + 1, y0, k === 1 ? P.iron[0] : P.iron[2]);
    }
  }
  function shovelPose3(t) {
    const p = saw(t, 56), P0 = [6, 52], P1 = [31, 45], lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], ease = (k) => k * k * (3 - 2 * k);
    const blade = p < 0.28 ? P0 : p < 0.52 ? lerp(P0, P1, ease((p - 0.28) / 0.24)) : p < 0.66 ? P1 : lerp(P1, P0, ease((p - 0.66) / 0.34));
    return { p, blade, loaded: p > 0.15 && p < 0.58, lean: p < 0.28 ? -1 : p < 0.66 ? 1 : 0 };
  }
  const BOILER3 = [
    { key: 'E3', name: '链条炉排 · 司炉台', ref: '维多利亚工厂锅炉房：链条炉排 + 顶上的天轴齿轮传动 + 司炉工',
      idea: '（v3）背景是一整面小块铆接钢板，右边一只拱形大炉膛烧着火。司炉小工站在镂空的格栅踏板上（左下一道镂空楼梯），左边一堆带反光的煤，他一锹一锹地把煤铲到输送链上；输送链由链节和链轮组成，把煤一路送进炉膛烧红。顶上一根工字梁挂着黄铜齿轮组，一条传动链从顶上的大齿轮一直垂下来带动输送链的链轮；梁上还垂着一根长拉环。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat, run = t * 0.5;
        // 背景：小块钢板（8px 一块，交错明暗、角上铆钉）
        for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const bx = x + i * 8, by = y + j * 8; R(bx, by, 8, 8, P.iron[0]); R(bx + 1, by + 1, 7, 7, (i + j) % 2 ? P.iron[2] : P.iron[1]); R(bx + 1, by + 1, 7, 1, P.iron[3]); px(bx + 2, by + 2, P.iron[4]); px(bx + 6, by + 6, P.iron[0]); }
        // 炉膛：拱形炉口 + 火焰 + 厚铆接炉框 + 黄铜口沿
        R(x + 38, y + 26, 34, 32, P.iron[0]); R(x + 40, y + 28, 30, 28, P.iron[2]);
        g.save(); g.beginPath(); g.moveTo(x + 43, y + 55); g.lineTo(x + 43, y + 38); g.arc(x + 55, y + 38, 12, Math.PI, 0); g.lineTo(x + 67, y + 55); g.closePath(); g.clip(); flames(x + 43, y + 26, 24, 29, t, heat); g.restore();
        for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; px(x + 55 + Math.cos(a) * 12.6, y + 38 + Math.sin(a) * 12.6, P.brass[2]); px(x + 55 + Math.cos(a) * 13.4, y + 38 + Math.sin(a) * 13.4, P.brass[0]); }
        for (const [a, b] of [[40, 29], [68, 29], [40, 53], [68, 53]]) px(x + a, y + b, P.iron[4]);
        // 顶上：工字梁 + 黄铜齿轮组 + 垂下来的传动链 + 长拉环
        R(x, y + 2, 72, 5, P.iron[0]); R(x, y + 3, 72, 3, P.iron[3]); R(x, y + 4, 72, 1, P.iron[2]); for (let u = 4; u < 72; u += 8) px(x + u, y + 4, P.iron[4]);
        gear(x + 27, y + 14, 6.5, 12, t * 0.05); gear(x + 38.5, y + 10, 4, 8, -t * 0.05 * 6.5 / 4); gear(x + 47, y + 14.5, 4.5, 9, t * 0.05 * 6.5 / 4.5);
        R(x + 26, y + 6, 3, 3, P.iron[1]); R(x + 37, y + 6, 3, 2, P.iron[1]);
        for (const [cx, d] of [[22, -1], [31, 1]]) { R(x + cx - 0.5, y + 14, 3, 38, P.iron[0]); chainRun(x + cx, y + 14, x + cx, y + 52, d * run, false); }
        R(x + 8, y + 7, 1, 20, P.brass[1]); for (let yy = 9; yy < 27; yy += 3) px(x + 8, y + yy, P.brass[3]); ring(x + 8.5, y + 29.5, 2, P.brass[2]); ring(x + 8.5, y + 29.5, 1.2, P.brass[0]);
        // 输送链：头部链轮（被传动链带着）→ 上行链带着煤 → 进炉膛；下行链回来
        gear(x + 27, y + 52, 4, 9, run * 0.25, IRONL);
        R(x + 27, y + 46.5, 36, 4, P.iron[0]); R(x + 27, y + 55, 36, 4, P.iron[0]);
        chainRun(x + 27, y + 47.5, x + 62, y + 47.5, -run); chainRun(x + 27, y + 56, x + 62, y + 56, run);
        R(x + 29, y + 49.5, 14, 6, P.iron[1]); R(x + 29, y + 49.5, 14, 1, P.iron[0]);
        for (let k = 0; k < 6; k++) { const lx = x + 32 + ((k * 6 + run) % 34); if (lx > x + 66) continue; lump(lx, y + 44.5, 3, Math.max(0, (lx - x - 43) / 14) * (0.5 + heat)); }
        // 地上：镂空格栅踏板 + 左下镂空楼梯
        R(x, y + 58, 40, 4, P.iron[0]); for (let u = 1; u < 39; u += 3) { R(x + u, y + 58, 2, 1, P.iron[3]); R(x + u, y + 59, 2, 2, P.dark[0]); }
        R(x, y + 58, 40, 1, P.iron[4]);
        for (let k = 0; k < 3; k++) { const sx = x + 2 + k * 6, sy = y + 62 + k * 3.4; R(sx, sy, 7, 2, P.iron[3]); for (let u = 1; u < 7; u += 2) px(sx + u, sy + 1, P.dark[0]); }
        line(x + 1, y + 58, x + 21, y + 71, 1, P.iron[4]);
        R(x + 40, y + 58, 32, 14, P.iron[1]); R(x + 40, y + 58, 32, 1, P.iron[3]);
        box(x + 46, y + 60, 20, 10, IRON); R(x + 49, y + 63, 14, 5, P.dark[0]); R(x + 50, y + 66, 12, 2, P.steam[0]); for (let u = 51; u < 62; u += 3) px(x + u, y + 65, heat > 0.4 ? P.fire[1] : P.fire[0]); px(x + 63, y + 64, P.brass[3]);   // 灰坑门
        // 煤堆：一块块带反光的煤垒成一座小山
        for (const [a, b, s] of [[1, 55, 3], [4, 55, 3], [7, 55, 3], [10, 55, 2], [2, 52, 3], [5, 52, 3], [8, 52, 3], [3, 49, 3], [6, 49, 3], [4.5, 46.5, 2]]) lump(x + a, y + b, s);
      },
      over(x, y, o, mini) {
        const t = o.t || 0, S = shovelPose3(t), bx = x + S.blade[0], by = y + S.blade[1], cx = x + 16 + S.lean * 0.6, cy = y + 52;
        const hand = [cx + (S.lean >= 0 ? 3 : -2), cy + 1];
        line(hand[0], hand[1], bx, by, 1, P.leather[1]); px(Math.round((hand[0] + bx) / 2), Math.round((hand[1] + by) / 2), P.leather[2]);
        R(bx - 1.5, by - 1, 4, 2, P.iron[4]); px(bx - 1, by - 1, P.white); if (Math.sin(t * 0.5) > 0.3) px(bx + 1, by - 1, P.white);
        if (S.loaded) { R(bx - 1, by - 3, 3, 2, P.dark[1]); px(bx - 1, by - 3, P.white); }
        if (mini) g.drawImage(mini, Math.round(cx - 5), Math.round(cy - 6 + (S.p > 0.28 && S.p < 0.6 ? -1 : 0)));
        px(hand[0], hand[1], P.black); px(hand[0] - (S.lean >= 0 ? 4 : -4), hand[1] + 1, P.black);
      } },
  ];
  const TANKS3 = [
    { key: 'AF', name: '拼装水柜 · 中央舷窗 + 蒸汽泵 + 角铁', ref: '布雷斯韦特分片钢水柜 + 舷窗 + 给水泵 + 包角铁',
      idea: '（v3：去掉刻度盘、浮球和侧面的浮球室）九块带菱形压筋的钢板拼成水柜，四边一圈角铁、四角三角包角板；正中一扇大舷窗看得见水位和气泡；右下一台小蒸汽给水泵的活塞来回推。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const bx = x + 3 + i * 22, by = y + 3 + j * 20; box(bx, by, 22, 20, IRONL);
          line(bx + 11, by + 3, bx + 18, by + 10, 1, P.iron[4]); line(bx + 18, by + 10, bx + 11, by + 17, 1, P.iron[2]); line(bx + 11, by + 17, bx + 4, by + 10, 1, P.iron[2]); line(bx + 4, by + 10, bx + 11, by + 3, 1, P.iron[4]);
        }
        const edge = (ax, ay, w, h) => { R(ax, ay, w, h, P.iron[0]); R(ax + 1, ay + 1, w - 2, h - 2, P.iron[1]); R(ax + 1, ay + 1, w - 2, 1, P.iron[3]); };
        edge(x + 1, y + 1, 70, 4); edge(x + 1, y + 59, 70, 4); edge(x + 1, y + 1, 4, 62); edge(x + 67, y + 1, 4, 62);
        for (let u = 8; u < 66; u += 6) { px(x + u, y + 3, P.iron[4]); px(x + u, y + 61, P.iron[4]); }
        for (let u = 8; u < 58; u += 6) { px(x + 3, y + u, P.iron[4]); px(x + 69, y + u, P.iron[4]); }
        for (const [cx, cy, sx, sy] of [[5, 5, 1, 1], [67, 5, -1, 1], [5, 59, 1, -1], [67, 59, -1, -1]]) { poly([[x + cx, y + cy], [x + cx + sx * 9, y + cy], [x + cx, y + cy + sy * 9]], IRON); px(x + cx + sx * 2, y + cy + sy * 2, P.iron[4]); px(x + cx + sx * 5, y + cy + sy * 2, P.iron[4]); px(x + cx + sx * 2, y + cy + sy * 5, P.iron[4]); }
        ball(x + 36, y + 32, 16, BRASS); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; px(x + 36 + Math.cos(a) * 14.2, y + 32 + Math.sin(a) * 14.2, P.brass[0]); }
        g.save(); g.beginPath(); g.arc(x + 36, y + 32, 12.2, 0, TAU); g.clip(); water(x + 23, y + 19, 26, 26, lv, t); g.restore();
        px(x + 29, y + 25, P.glass[3]); px(x + 30, y + 24, P.glass[3]); px(x + 28, y + 26, P.glass[3]);
        R(x + 1, y + 64, 70, 8, P.iron[1]); R(x + 1, y + 64, 70, 1, P.iron[3]);
        const s = Math.sin(t * 0.2) * 3;
        box(x + 46, y + 62, 12, 9, IRONL); R(x + 58, y + 65, 5 + s, 2, P.iron[4]); R(x + 62 + s, y + 63, 2, 6, P.brass[1]);
        gauge(x + 50, y + 60, 2.6, 0.4 + 0.2 * Math.sin(t * 0.2)); htube(x + 40, y + 66, 6, 3, IRONL);
      } },
  ];

  // ================= v4（2026-09-29 用户：背景钢板照抄巨炮、炉膛占 60% 以上的红色中心、其他都是被红光衬托的剪影、煤堆变成大山）=================
  // 巨炮的背景钢板墙（sprites.js gPlateWall 原样照抄）：24px 大板 + X 加强肋 + 板边细铆钉，全用暗色，安静
  function plateWall(x0, y0, x1, y1) {
    R(x0, y0, x1 - x0, y1 - y0, P.dark[1]);
    for (let py0 = y0; py0 < y1; py0 += 24) for (let px0 = x0; px0 < x1; px0 += 24) {
      const w = Math.min(24, x1 - px0), h = Math.min(24, y1 - py0), n = Math.min(w, h);
      for (let t = 1; t < n - 1; t++) { px(px0 + t, py0 + t, P.dark[2]); px(px0 + n - 1 - t, py0 + t, P.dark[2]); }
      R(px0, py0, w, 1, P.dark[0]); R(px0, py0, 1, h, P.dark[0]);
      for (let t = 3; t < w; t += 3) px(px0 + t, py0 + 1, P.dark[3]);
      for (let t = 3; t < h; t += 3) px(px0 + 1, py0 + t, P.dark[3]);
    }
  }
  // 剪影：实心黑，朝上的边被身后的火光勾一道红边，两侧一道暗红
  function sil(test, x0, y0, x1, y1, rim = true) {
    const inn = (xx, yy) => test(xx + 0.5, yy + 0.5);
    for (let yy = Math.floor(y0); yy <= Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx <= Math.ceil(x1); xx++) {
      if (!inn(xx, yy)) continue;
      const edge = !inn(xx, yy - 1) || !inn(xx + 1, yy) || !inn(xx - 1, yy);
      px(xx, yy, rim && edge ? (!inn(xx, yy - 1) ? P.fire[1] : P.fire[0]) : P.black);
    }
  }
  const silBar = (ax, ay, bx, by, w) => { const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L; sil((x, y) => { const s = (x - ax) * ux + (y - ay) * uy, d = Math.abs((x - ax) * -uy + (y - ay) * ux); return s >= 0 && s <= L && d <= w / 2; }, Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w); };
  // 剪影链条：一串黑链节，销子被火光照出一粒红，随 off 走
  function chainSil(ax, ay, bx, by, off, horiz = true) {
    const n = Math.round(Math.hypot(bx - ax, by - ay)), dx = (bx - ax) / n, dy = (by - ay) / n;
    for (let i = 0; i <= n; i++) {
      const k = ((Math.floor(i + off)) % 4 + 4) % 4, x0 = ax + dx * i, y0 = ay + dy * i;
      if (horiz) { px(x0, y0 - 1, k < 2 ? P.black : P.fire[0]); px(x0, y0, P.black); px(x0, y0 + 1, k === 3 ? P.fire[1] : P.black); }
      else { px(x0 - 1, y0, k < 2 ? P.black : P.fire[0]); px(x0, y0, P.black); px(x0 + 1, y0, k === 3 ? P.fire[1] : P.black); }
    }
  }
  const sprocketSil = (cx, cy, r, n, rot) => sil((x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - rot; return (d <= r - 1 || (d <= r + 0.7 && Math.cos(a * n) > 0.2)) && !(d < r * 0.35); }, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2);
  // 煤山：不规则的大山（折线外形），几块大煤面 + 每块一粒亮反光；火在右边，右坡被勾红
  const HILL = [[0, 63], [0, 30], [2, 27], [5, 28], [7, 24], [10, 22], [13, 23], [15, 20], [18, 22], [20, 26], [22, 27], [24, 32], [26, 35], [27, 40], [30, 44], [30, 48], [33, 52], [34, 57], [37, 61], [38, 63]];
  const FACETS = [[6, 31, 7, 1], [15, 27, 7, 0], [11, 40, 8, 0], [21, 38, 6, 2], [4, 50, 7, 0], [17, 50, 8, 1], [27, 51, 6, 2], [9, 58, 6, 0], [24, 59, 7, 0]];
  function coalHill(x, y) {
    // 一座由大煤块垒起来的山：先铺一层阴影底，再从上往下一排排压上大块（越往下越靠前），每排最右一块被火勾红边
    const edgeX = (yy) => { for (let i = 1; i < HILL.length; i++) { const [a0, b0] = HILL[i - 1], [a1, b1] = HILL[i]; if (b1 >= yy && b0 <= yy && b1 > b0) return a0 + (a1 - a0) * (yy - b0) / (b1 - b0); } return 0; };
    const ins = inPoly(HILL.map(([a, b]) => [x + a - 1, y + b + 2]));
    for (let yy = y + 20; yy < y + 64; yy++) for (let xx = x; xx < x + 40; xx++) if (ins(xx + 0.5, yy + 0.5)) px(xx, yy, P.black);
    const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5; return v - Math.floor(v); };
    let n = 0;
    for (let r = 0; r < 6; r++) {
      const cy = 27 + r * 7, right = edgeX(cy) - 3;
      for (let cx = right; cx > -4; cx -= 8.5 + hash(n) * 1.5, n++) {
        const s = 8 + hash(n + 50) * 3, h = s / 2, rim = cx === right, j = (k) => (hash(n * 7 + k) - 0.5) * 2;
        const pts = [[cx - h + j(1), cy + j(2)], [cx - h * 0.4 + j(3), cy - h + j(4)], [cx + h * 0.5 + j(5), cy - h * 0.8], [cx + h + j(6), cy + j(7)], [cx + h * 0.4, cy + h * 0.8 + j(8)], [cx - h * 0.6, cy + h * 0.8]].map(([a, b]) => [x + a, y + b]);
        const inn = inPoly(pts), ok = (xx, yy) => inn(xx + 0.5, yy + 0.5);
        for (let yy = Math.floor(y + cy - h - 2); yy <= y + cy + h + 2; yy++) for (let xx = Math.floor(x + cx - h - 2); xx <= x + cx + h + 2; xx++) {
          if (!ok(xx, yy) || xx < x || yy >= y + 64) continue;
          const out = !ok(xx - 1, yy) || !ok(xx + 1, yy) || !ok(xx, yy - 1) || !ok(xx, yy + 1);
          const tl = !ok(xx - 2, yy) || !ok(xx, yy - 2), br = !ok(xx + 2, yy) || !ok(xx, yy + 2);
          px(xx, yy, out ? (rim && !ok(xx + 1, yy) ? P.fire[1] : P.black) : tl ? P.dark[3] : br ? (rim ? P.fire[0] : P.black) : P.dark[1]);
        }
        if (hash(n + 90) > 0.62 && x + cx - h > x) { const gx = x + cx - h * 0.4, gy = y + cy - h + 2; px(gx, gy, P.white); px(gx + 1, gy, P.iron[4]); px(gx - 1, gy + 1, P.iron[4]); }   // 少数几块沿上沿一道亮反光
      }
    }
  }
  // 铲煤（v5，更自然）：铲子长度固定，双手带着它走——插进煤山、端起来、举过身侧、往前一送把煤抛上链条，然后转身（铲子缩成一小截表示转过来）回到煤山
  const SHOVEL_KF = [[0, 35, 57, 165, 9, 0], [0.16, 34, 58, 170, 9, 1], [0.3, 36, 56, 200, 9, 0], [0.46, 39, 53, 262, 9, -1], [0.58, 42, 51, 318, 9, -1], [0.68, 42, 52, 338, 9, 0], [0.8, 39, 55, 358, 8, 0], [0.86, 37, 56, 358, 2, 0], [0.87, 37, 56, 178, 2, 0], [0.94, 36, 56, 172, 9, 0], [1, 35, 57, 165, 9, 0]];
  function shovelPose4(t) {
    const p = saw(t, 60), ease = (k) => k * k * (3 - 2 * k);
    let i = 1; while (i < SHOVEL_KF.length - 1 && SHOVEL_KF[i][0] < p) i++;
    const A = SHOVEL_KF[i - 1], B = SHOVEL_KF[i], k = ease(Math.min(1, Math.max(0, (p - A[0]) / (B[0] - A[0] || 1)))), m = (j) => A[j] + (B[j] - A[j]) * k;
    const hx = m(1), hy = m(2), ang = m(3) * Math.PI / 180, L = m(4), dx = Math.cos(ang), dy = Math.sin(ang);
    return { p, hand: [hx, hy], dir: [dx, dy], L, tip: [hx + dx * L, hy + dy * L], dy: m(5), loaded: p > 0.16 && p < 0.56 };
  }
  const TOSS_TO = [54, 43];
  const MOUTH = { cx: 40, cy: 34, r: 29, bot: 62 };   // 拱形炉口：x 11～69，y 5～62，约占画面 57%，加上踏板下漏出来的红光超过 60%
  const BOILER4 = [
    { key: 'E4', name: '链条炉排 · 炉口剪影', ref: '维多利亚锅炉房：巨大炉口的火光里，司炉工、输送链和传动链都成了剪影',
      idea: '（v4）画面正中一只巨大的拱形炉口（约占 60%），整个是红色和橙色的火；司炉小工、输送链、从顶上齿轮垂下来的传动链、长拉环都成了火光里的黑剪影，边上被火勾一道红边。左边一座不规则的煤山（和炉口对分画面），几块大煤面各带一粒反光。工人站在镂空踏板上，把煤从山上铲到输送链上，链条把煤滚进火里烧红。背景钢板照抄巨炮（大板 + X 肋，全暗色）。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat, run = t * 0.5, M = MOUTH;
        plateWall(x, y, x + 72, y + 72);
        // 炉口外框：一圈黑铁框 + 黄铜口沿
        sil((xx, yy) => { const dx = xx - (x + M.cx), dy = yy - (y + M.cy), R2 = M.r + 3; return yy <= y + M.bot + 1 && Math.abs(dx) <= R2 && (yy >= y + M.cy || dx * dx + dy * dy <= R2 * R2); }, x + 5, y + 1, x + 72, y + 64, false);
        for (let k = 0; k <= 60; k++) { const a = Math.PI + k / 60 * Math.PI; px(x + M.cx + Math.cos(a) * (M.r + 1.6), y + M.cy + Math.sin(a) * (M.r + 1.6), P.brass[1]); px(x + M.cx + Math.cos(a) * (M.r + 2.5), y + M.cy + Math.sin(a) * (M.r + 2.5), P.brass[0]); }
        R(x + M.cx - M.r - 3, y + M.cy, 2, M.bot - M.cy, P.brass[0]); R(x + M.cx - M.r - 2, y + M.cy, 1, M.bot - M.cy, P.brass[1]); R(x + M.cx + M.r + 1, y + M.cy, 2, M.bot - M.cy, P.brass[1]);
        // 炉口里：满满的火。上面暗红的炉顶，往下橙、黄，底下一床白热的炭
        g.save(); g.beginPath(); g.moveTo(x + M.cx - M.r, y + M.bot); g.lineTo(x + M.cx - M.r, y + M.cy); g.arc(x + M.cx, y + M.cy, M.r, Math.PI, 0); g.lineTo(x + M.cx + M.r, y + M.bot); g.closePath(); g.clip();
        R(x, y, 72, 64, P.fire[0]);
        const W = M.r * 2, x0 = x + M.cx - M.r, bed = y + 56, H = 50;
        for (let u = 0; u < W; u++) {
          const hg = H * (0.55 + 0.35 * heat) * (0.6 + 0.4 * Math.sin(u * 0.9 + t * 0.3) * Math.sin(u * 0.33 - t * 0.17));
          R(x0 + u, bed - hg, 1, hg, P.fire[1]); R(x0 + u, bed - hg * 0.62, 1, hg * 0.62, P.fire[2]); R(x0 + u, bed - hg * 0.28, 1, hg * 0.28, P.fire[3]);
        }
        R(x0, bed, W, 7, P.fire[2]); for (let u = 1; u < W; u += 3) R(x0 + u, bed + 1 + (u % 4), 2, 1, (u % 2) ? P.fire[3] : P.fire[1]);
        for (let k = 0; k < 7; k++) { const p = saw(t + k * 19, 60); px(x0 + 6 + ((k * 13) % (W - 12)) + Math.sin(p * 9 + k) * 2, bed - 8 - p * 38, p < 0.6 ? P.fire[3] : P.fire[2]); }   // 往上飘的火星
        g.restore();
        // 顶上：工字梁 + 黄铜齿轮组（下沿被火照亮）
        R(x, y, 72, 5, P.iron[0]); R(x, y + 1, 72, 3, P.iron[2]); R(x, y + 1, 72, 1, P.iron[3]); R(x, y + 4, 72, 1, P.dark[0]);
        gear(x + 46, y + 10, 6, 12, t * 0.05); gear(x + 35.5, y + 7, 3.8, 8, -t * 0.05 * 6 / 3.8); gear(x + 56.5, y + 8, 4.2, 9, -t * 0.05 * 6 / 4.2);
        for (const [cx, cy, r] of [[46, 10, 6], [35.5, 7, 3.8], [56.5, 8, 4.2]]) for (let k = 0; k < 7; k++) { const a = 0.2 + k * 0.4; px(x + cx + Math.cos(a) * r, y + cy + Math.sin(a) * r, P.fire[2]); }
        // 传动链：从大齿轮一直垂到输送链头部的链轮（剪影）
        chainSil(x + 41, y + 12, x + 41, y + 51, run, false); chainSil(x + 51, y + 12, x + 51, y + 51, -run, false);
        // 长拉环：梁上垂下的长杆 + 拉环（剪影）
        silBar(x + 63, y + 4, x + 63, y + 30, 1.6); sil((xx, yy) => { const d = Math.hypot(xx - (x + 63.5), yy - (y + 33.5)); return d <= 3.3 && d >= 1.7; }, x + 59, y + 29, x + 68, y + 38);
        // 输送链：链轮 + 上行链（载煤进火）+ 下行链 + 托架（剪影）
        sprocketSil(x + 46, y + 52, 5.5, 10, run * 0.2);
        chainSil(x + 46, y + 46.5, x + 69, y + 46.5, -run); chainSil(x + 46, y + 57.5, x + 69, y + 57.5, run);
        for (let k = 0; k < 5; k++) {
          const lx = x + 46 + ((k * 5.2 + run) % 26); if (lx > x + 67) continue;
          const hot = (lx - x - 50) / 14 * (0.6 + heat);
          sil((xx, yy) => xx >= lx && xx < lx + 3.5 && yy >= y + 42.5 && yy < y + 45.5 - (xx - lx > 2.5 ? 1 : 0), lx - 1, y + 41, lx + 5, y + 47, hot < 0.3);
          if (hot > 0.3) { R(lx, y + 43, 3, 2, hot > 0.8 ? P.fire[2] : P.fire[1]); if (hot > 0.8) px(lx + 1, y + 43, P.fire[3]); }
        }
        // 踏板：镂空格栅，孔里透出下面灰坑的红光
        R(x, y + 62, 72, 3, P.black); for (let u = 1; u < 71; u += 3) R(x + u, y + 63, 2, 1, u > 12 && u < 66 ? P.fire[1] : P.fire[0]);
        R(x, y + 62, 72, 1, P.dark[2]);
        // 踏板下：灰坑的红光 + 左下镂空楼梯（剪影）
        R(x, y + 65, 72, 7, P.dark[0]); R(x + 10, y + 66, 58, 5, P.fire[0]); for (let u = 12; u < 66; u += 5) R(x + u, y + 67 + (u % 2), 3, 2, heat > 0.4 ? P.fire[1] : P.fire[0]);
        for (let k = 0; k < 3; k++) { const sx = x + 18 - k * 7, sy = y + 65 + k * 2.5; R(sx, sy, 7, 2, P.black); for (let u = 1; u < 7; u += 2) px(sx + u, sy + 1, P.fire[0]); }
        line(x + 24, y + 64, x + 4, y + 72, 1, P.black);
        // 煤山（最前景）
        coalHill(x, y);
        // 司炉站台：花纹钢板踏面 + 黄铜包边 + 铆接立面 + 两条腿和一道斜撑（颜色、结构都清楚，不是剪影）
        R(x + 31, y + 61, 20, 3, P.iron[0]); R(x + 32, y + 61, 18, 2, P.iron[3]); for (let u = 33; u < 50; u += 3) px(x + u, y + 62, P.iron[4]);
        R(x + 31, y + 60, 20, 1, P.brass[2]); R(x + 31, y + 61, 20, 1, P.brass[1]);
        R(x + 32, y + 64, 18, 3, P.iron[2]); R(x + 32, y + 66, 18, 1, P.iron[0]); for (let u = 34; u < 50; u += 4) px(x + u, y + 65, P.iron[4]);
        for (const u of [33, 47]) { R(x + u, y + 67, 3, 5, P.iron[0]); R(x + u + 1, y + 67, 1, 5, P.iron[3]); }
        line(x + 36, y + 67, x + 46, y + 71, 1, P.iron[1]);
      },
      over(x, y, o, mini) {
        const t = o.t || 0, S = shovelPose4(t), [hx, hy] = S.hand, [dx, dy] = S.dir;
        const cx = x + 38 + (hx - 38) * 0.35, cy = y + 56 + S.dy;
        if (mini) g.drawImage(mini, Math.round(cx - 5), Math.round(cy - 6));
        const H = [x + hx, y + hy], tip = [H[0] + dx * S.L, H[1] + dy * S.L], base = [H[0] + dx * (S.L - 2), H[1] + dy * (S.L - 2)];
        line(H[0] - dx * 3, H[1] - dy * 3, base[0], base[1], 1, P.leather[2]);                 // 木柄
        px(H[0] - dx * 3, H[1] - dy * 3, P.black); px(H[0], H[1], P.black);                   // 两只手
        if (S.L > 4) {                                                                        // 铲头：一片亮钢，横在柄的末端
          const nx = -dy, ny = dx;
          for (const s2 of [-1, 0, 1]) { px(base[0] + nx * s2, base[1] + ny * s2, P.iron[3]); px(tip[0] + nx * s2 * 0.8, tip[1] + ny * s2 * 0.8, P.iron[4]); }
          px(tip[0], tip[1], Math.sin(t * 0.45) > 0.2 ? P.white : P.iron[4]);
          if (S.loaded) { R(tip[0] - 1 - dy, tip[1] - 2, 2, 2, P.black); px(tip[0] - dy, tip[1] - 2, P.white); }
        }
        if (S.p >= 0.56 && S.p < 0.72) {                                                      // 抛出去的一铲煤：沿弧线落到链条上
          const k = (S.p - 0.56) / 0.16, R0 = shovelPose4(0.56 * 60).tip, lx = x + R0[0] + (TOSS_TO[0] - R0[0]) * k, ly = y + R0[1] + (TOSS_TO[1] - R0[1]) * k - Math.sin(k * Math.PI) * 5;
          R(lx, ly, 2, 2, P.black); px(lx + 2, ly + 1, P.black); px(lx, ly, P.white);
        }
      } },
  ];
  const TANKS4 = [
    { key: 'AF4', name: '拼装水柜 · 大舷窗', ref: '布雷斯韦特分片钢水柜 + 大舷窗 + 给水泵 + 包角铁',
      idea: '（v4：舷窗放大到几乎占满正面；钢板上的压筋和板缝调暗，不抢舷窗）九块分片钢板拼成水柜，四边角铁、四角包角板；正中一扇大舷窗看水位和气泡；右下给水泵的活塞来回推。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        R(x + 3, y + 3, 66, 60, P.iron[2]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const bx = x + 3 + i * 22, by = y + 3 + j * 20;
          R(bx, by, 22, 1, P.iron[1]); R(bx, by, 1, 20, P.iron[1]);
          line(bx + 11, by + 4, bx + 17, by + 10, 1, P.iron[3]); line(bx + 17, by + 10, bx + 11, by + 16, 1, P.iron[1]); line(bx + 11, by + 16, bx + 5, by + 10, 1, P.iron[1]); line(bx + 5, by + 10, bx + 11, by + 4, 1, P.iron[3]);
        }
        const edge = (ax, ay, w, h) => { R(ax, ay, w, h, P.iron[0]); R(ax + 1, ay + 1, w - 2, h - 2, P.iron[1]); R(ax + 1, ay + 1, w - 2, 1, P.iron[2]); };
        edge(x + 1, y + 1, 70, 4); edge(x + 1, y + 59, 70, 4); edge(x + 1, y + 1, 4, 62); edge(x + 67, y + 1, 4, 62);
        for (let u = 8; u < 66; u += 6) { px(x + u, y + 3, P.iron[3]); px(x + u, y + 61, P.iron[3]); }
        for (let u = 8; u < 58; u += 6) { px(x + 3, y + u, P.iron[3]); px(x + 69, y + u, P.iron[3]); }
        for (const [cx, cy, sx, sy] of [[5, 5, 1, 1], [67, 5, -1, 1], [5, 59, 1, -1], [67, 59, -1, -1]]) { poly([[x + cx, y + cy], [x + cx + sx * 8, y + cy], [x + cx, y + cy + sy * 8]], IRON); px(x + cx + sx * 2, y + cy + sy * 2, P.iron[3]); }
        // 大舷窗：半径 25（v3 是 16），一圈 20 颗螺栓
        ball(x + 36, y + 32, 25, BRASS); for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; px(x + 36 + Math.cos(a) * 23, y + 32 + Math.sin(a) * 23, P.brass[0]); }
        disc(x + 36, y + 32, 21.2, P.brass[0]);
        g.save(); g.beginPath(); g.arc(x + 36, y + 32, 20.4, 0, TAU); g.clip(); water(x + 15, y + 11, 42, 42, lv, t); g.restore();
        for (const [a, b] of [[24, 19], [25, 18], [26, 17], [23, 21], [29, 16]]) px(x + a, y + b, P.glass[3]);
        R(x + 1, y + 64, 70, 8, P.iron[1]); R(x + 1, y + 64, 70, 1, P.iron[3]);
        const s = Math.sin(t * 0.2) * 3;
        box(x + 50, y + 62, 12, 9, IRONL); R(x + 62, y + 65, 3 + s, 2, P.iron[4]); R(x + 64 + s, y + 63, 2, 6, P.brass[1]);
        gauge(x + 54, y + 60, 2.6, 0.4 + 0.2 * Math.sin(t * 0.2)); htube(x + 44, y + 66, 6, 3, IRONL);
      } },
  ];
  const MODS = [
    { id: 'boiler_l', name: '大型锅炉 · 炉口剪影 v4', w: 3, h: 3, rule: '3×3 能源 · 巨大拱形炉口占画面约 60% 的红色中心 · 工人、输送链、传动链、拉环都是火光里的剪影 · 左边不规则煤山和炉口对分画面 · 背景钢板照抄巨炮', SET: BOILER4 },
    { id: 'water_l', name: '大水箱 · 大舷窗 v4', w: 3, h: 3, rule: '3×3 冷却 · 舷窗放大到几乎占满正面 · 钢板压筋调暗不抢眼 · 角铁 / 包角板 + 给水泵 · 青色只用在水上', SET: TANKS4 },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, mini) { g = ctx; if (e.over) e.over(x, y, o, mini); }
  return { MODS, figure, over };
})();
