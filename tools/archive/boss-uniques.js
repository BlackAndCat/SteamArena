// 历史存档：Boss 唯一件（圣堂压力核心 / 寡妇液压撞头 / 公爵测距棱镜 v1，各 6 种）。原「当前开发」页的绘制代码。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：三件 Boss 唯一件——圣堂压力核心 boss_core（1×1）、寡妇液压撞头 boss_ram（2×1 撞击层）、公爵测距棱镜 boss_lens（1×1）。
// 每种 6 个：A～C 是 2026-09-27 夜间候选 v1（tools/cand-late.js）按现在的画法重画，D～F 是新方向。
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



  // ================= 小工具 =================
  const bottle = (x, y, w, h, r = IRONL) => {   // 竖放的铆接气瓶：上下圆顶 + 竖缝铆钉
    vtube(x, y + w / 2, w, h - w, r);
    shape((xx, yy) => ((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y - w / 2) / (w / 2)) ** 2 <= 1 && yy <= y + w / 2 + 0.5, x, y, x + w, y + w / 2 + 1, r);
    shape((xx, yy) => ((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y - h + w / 2) / (w / 2)) ** 2 <= 1 && yy >= y + h - w / 2 - 0.5, x, y + h - w / 2 - 1, x + w, y + h, r);
  };
  const band = (x, y, w, h = 2) => { R(x, y, w, h, P.brass[1]); R(x, y, w, 1, P.brass[3]); if (h > 2) R(x, y + h - 1, w, 1, P.brass[0]); };
  const glint = (x, y, t, per = 60) => { const p = saw(t, per); if (p < 0.12) { px(x, y, P.white); px(x + 1, y - 1, P.glass[3]); } };
  const ellRing = (cx, cy, rx, ry, c, c2) => { const n = Math.ceil(Math.max(rx, ry) * 7) + 4; for (let i = 0; i < n; i++) { const a = i / n * TAU; px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c2 && Math.sin(a) > 0 ? c2 : c); } };
  const cyanPipe = (x, y, w, t) => { R(x, y, w, 4, P.water[0]); R(x, y + 1, w, 2, P.water[1]); R(x, y + 1, w, 1, P.water[2]); for (let u = 0; u < w; u++) if (saw(t * 0.6 + u * 4, 60) < 0.08) px(x + u, y + 1, P.water[3]); };   // 冷却液集管：只有这里用青色，亮点在流
  const bracket = (x, y) => { R(x, y, 5, 5, P.iron[0]); R(x + 1, y + 1, 3, 3, P.iron[2]); px(x + 1, y + 1, P.iron[4]); px(x + 3, y + 3, P.iron[1]); };


  // ================= 小工具 =================
  const RUSTR = [P.rust[0], P.rust[1], P.rust[2], P.rust[3]];
  const GLASSR = [P.glass[0], P.glass[1], P.glass[2], P.glass[3]];
  const BLK = [P.black, P.dark[0], P.dark[1], P.dark[3]];
  const pulse = (t, per = 60) => 0.5 + 0.5 * Math.sin(t / per * TAU);
  const ember = (cx, cy, r, t) => { const k = pulse(t, 50); disc(cx, cy, r + 0.6, P.fire[0]); disc(cx, cy, r, k > 0.5 ? P.fire[1] : P.fire[0]); disc(cx, cy, Math.max(0.6, r * 0.5), k > 0.3 ? P.fire[2] : P.fire[1]); if (k > 0.75) px(cx - 0.5, cy - 0.5, P.fire[3]); };
  // 哥特尖拱：x0～x1、起拱线 ys、底 yb、两段圆弧半径 r（r 越大越尖）
  const inArch = (x0, x1, ys, yb, r) => (xx, yy) => xx >= x0 && xx <= x1 && yy <= yb && (yy >= ys || ((xx - (x0 + r)) ** 2 + (yy - ys) ** 2 <= r * r && (xx - (x1 - r)) ** 2 + (yy - ys) ** 2 <= r * r));
  const arch = (x0, x1, ys, yb, r, ramp) => shape(inArch(x0, x1, ys, yb, r), x0 - 1, ys - r, x1 + 1, yb + 1, ramp);
  const cross = (cx, cy, c = P.brass[2]) => { R(cx, cy - 2, 1, 5, c); R(cx - 1, cy - 1, 3, 1, c); };
  // 红沙漏：上下两个尖对尖的三角（5-3-1-3-5 像素），s ≥ 1 时整体放大一档
  const hourglass = (cx, cy, s = 1, c = P.fire[1]) => {
    const rows = s >= 1 ? [5, 3, 1, 3, 5] : [3, 1, 3], x0 = Math.round(cx), y0 = Math.round(cy) - Math.floor(rows.length / 2);
    rows.forEach((w, i) => { R(x0 - Math.floor(w / 2), y0 + i, w, 1, c); if (w > 1) px(x0 - Math.floor(w / 2), y0 + i, P.fire[0]); });
  };
  const spectrum = (x0, y0, len, t, ang = 0) => { const cols = [P.fire[1], P.fire[3], P.gauge[2], P.water[2]], c = Math.cos(ang), s = Math.sin(ang); if (saw(t, 40) > 0.7) return; cols.forEach((col, k) => { for (let i = 0; i < len; i++) px(x0 + c * i - s * (k - 1.5) * (0.3 + i * 0.12), y0 + s * i + c * (k - 1.5) * (0.3 + i * 0.12), col); }); };

  // ================= 圣堂压力核心 boss_core（1×1，能源：动力 + 蓄压 + 储水 + 冷却，一身四用）：铁甲圣堂的哥特语言，核心一点炉火余烬 =================
  const CORE = [
    { key: 'A', name: '圣骨匣', ref: '（v1 候选 A 重画）',
      idea: '一座黄铜尖拱小龛（顶上一只小十字），龛里供着一颗铆接压力球，球心一点暗红余烬在呼吸；龛下一只压力表。「供奉起来的心脏」。',
      draw(x, y, o) {
        box(x + 2, y + 20, 20, 4, IRON);
        arch(x + 2, x + 22, y + 12, y + 20, 13, BRASS); arch(x + 4, x + 20, y + 12, y + 20, 11, [P.dark[0], P.dark[0], P.dark[1], P.dark[2]]);
        ball(x + 12, y + 13, 5, IRONL); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; px(x + 12 + Math.cos(a) * 3.8, y + 13 + Math.sin(a) * 3.8, P.iron[4]); }
        ember(x + 12, y + 13, 1.6, o.t); cross(x + 12, y + 1); gauge(x + 12, y + 21, 2.2, 0.7);
      } },
    { key: 'B', name: '玫瑰窗', ref: '（v1 候选 B 重画）',
      idea: '整格是一扇圆形玫瑰窗：黄铜窗花分出八瓣，瓣里是玻璃蓝、苔绿、水青、炉红四色「彩窗」（正好对应它的四种功能），正中一颗压力核心在呼吸；外圈一圈铜钉。最华丽、最像教堂。',
      draw(x, y, o) {
        disc(x + 12, y + 12, 11.5, P.brass[0]); disc(x + 12, y + 12, 10.5, P.brass[1]); disc(x + 12, y + 12, 9.5, P.dark[0]);
        const cols = [P.glass[1], P.gauge[1], P.water[1], P.fire[0]];
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; disc(x + 12 + Math.cos(a) * 6, y + 12 + Math.sin(a) * 6, 2.6, cols[k % 4]); px(x + 12 + Math.cos(a) * 6 - 1, y + 12 + Math.sin(a) * 6 - 1, P.white); }
        for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; line(x + 12 + Math.cos(a) * 3, y + 12 + Math.sin(a) * 3, x + 12 + Math.cos(a) * 9.5, y + 12 + Math.sin(a) * 9.5, 1, P.brass[2]); }
        ellRing(x + 12, y + 12, 3.2, 3.2, P.brass[2]); ember(x + 12, y + 12, 1.8, o.t);
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; px(x + 12 + Math.cos(a) * 10.8, y + 12 + Math.sin(a) * 10.8, P.brass[3]); }
      } },
    { key: 'C', name: '三联压力球', ref: '（v1 候选 C 重画）',
      idea: '三只小压力球排成三角，黄铜管两两相连，背后一圈带齿的黄铜光环慢慢转；每只球心一点余烬，轮流亮。读起来是「好几件东西合成的一件」，对应它一身四用。',
      draw(x, y, o) {
        gear(x + 12, y + 12, 10.5, 18, o.t * 0.01); disc(x + 12, y + 12, 8, P.dark[1]);
        const pts = [[12, 6], [6, 16], [18, 16]];
        for (let i = 0; i < 3; i++) { const [a, b] = pts[i], [c2, d2] = pts[(i + 1) % 3]; line(x + a, y + b, x + c2, y + d2, 2, P.brass[1]); }
        pts.forEach(([a, b], i) => { ball(x + a, y + b, 4, IRONL); if (Math.floor(o.t / 20) % 3 === i) ember(x + a, y + b, 1, o.t); else px(x + a, y + b, P.fire[0]); });
      } },
    { key: 'D', name: '双塔立面', ref: '新：一座缩小的哥特教堂立面（双尖塔 + 山墙 + 尖拱长窗）',
      idea: '整格是一座小教堂的正面：左右两座尖塔（塔尖一只小十字），中间山墙下一扇高高的尖拱长窗，窗里透出炉火（核心在里面呼吸），山墙上一只小圆玫瑰窗。剪影是「两座尖塔」，Boss 件一眼不同。',
      draw(x, y, o) {
        box(x + 2, y + 13, 20, 11, IRONL);
        for (const u of [2, 16]) { poly([[x + u, y + 13], [x + u + 3, y + 3], [x + u + 6, y + 13]], IRONL); cross(x + u + 3, y + 1, P.brass[3]); R(x + u + 2, y + 9, 2, 3, P.dark[0]); }
        poly([[x + 7, y + 13], [x + 12, y + 5], [x + 17, y + 13]], BRASS);
        disc(x + 12, y + 10, 1.8, P.dark[0]); px(x + 12, y + 10, P.glass[2]);
        arch(x + 9, x + 15, y + 17, y + 23, 5, [P.dark[0], P.fire[0], P.fire[0], P.fire[0]]);
        const k = pulse(o.t, 50); R(x + 11, y + 17, 2, 6, k > 0.5 ? P.fire[2] : P.fire[1]); if (k > 0.7) px(x + 11, y + 18, P.fire[3]);
        for (const u of [4, 19]) R(x + u, y + 17, 1, 5, P.dark[0]);
      } },
    { key: 'E', name: '圣杯炉', ref: '新：圣杯形的铜炉（盛着烧红的煤，升起白汽）',
      idea: '一只黄铜圣杯：台阶底座、带结的杯脚、宽口的杯身，杯口盛着一堆烧红的煤（一直在呼吸），上面升起一缕白汽。「圣堂的圣火」，最有 Boss 战利品的仪式感。',
      draw(x, y, o) {
        box(x + 4, y + 21, 16, 3, IRON); R(x + 6, y + 19, 12, 2, P.brass[0]); R(x + 6, y + 19, 12, 1, P.brass[2]);
        R(x + 10, y + 13, 4, 6, P.brass[1]); R(x + 10, y + 13, 1, 6, P.brass[3]); disc(x + 12, y + 16, 2.2, P.brass[1]); px(x + 11, y + 15, P.brass[3]);
        shape((xx, yy) => yy >= y + 5 && ((xx - x - 12) / 9) ** 2 + ((yy - y - 5) / 8.5) ** 2 <= 1, x + 2, y + 4, x + 22, y + 14, BRASS);
        R(x + 3, y + 5, 18, 1, P.brass[3]); for (const u of [6, 12, 18]) px(x + u, y + 9, P.fire[0]);
        const k = pulse(o.t, 45);
        shape((xx, yy) => yy <= y + 5 && ((xx - x - 12) / 8) ** 2 + ((yy - y - 5) / 3) ** 2 <= 1, x + 3, y + 1, x + 21, y + 6, [P.fire[0], P.fire[1], k > 0.5 ? P.fire[2] : P.fire[1], P.fire[3]]);
        for (const u of [8, 13, 16]) px(x + u, y + 4, P.dark[0]);
      },
      fx(x, y, o) { puff(x + 12, y + 1, o.t, 3, 8); } },
    { key: 'F', name: '骑士团盾徽', ref: '新：圣殿骑士的鸢尾盾（红十字）钉在一只压力鼓上',
      idea: '一只铆接压力鼓，正面钉着一面骑士团的尖底盾，盾上一个红十字；盾两边各露出一只小压力表，盾后的泄压口时不时喷一口白汽。最「铁甲圣堂」的身份标记。',
      draw(x, y, o) {
        ball(x + 12, y + 12, 11, IRONL); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; px(x + 12 + Math.cos(a) * 9.5, y + 12 + Math.sin(a) * 9.5, P.iron[4]); }
        gauge(x + 3.5, y + 7, 2.4, 0.6); gauge(x + 20.5, y + 7, 2.4, 0.4 + 0.3 * pulse(o.t));
        poly([[x + 6, y + 3], [x + 18, y + 3], [x + 18, y + 12], [x + 12, y + 22], [x + 6, y + 12]], IRONL);
        R(x + 11, y + 5, 2, 13, P.fire[0]); R(x + 8, y + 9, 8, 2, P.fire[0]); R(x + 11, y + 5, 1, 13, P.fire[1]); R(x + 8, y + 9, 8, 1, P.fire[1]);
        R(x + 6, y + 3, 12, 1, P.brass[2]);
      },
      fx(x, y, o) { if (saw(o.t, 90) < 0.35) { puff(x + 2, y + 18, o.t, 2, 5); puff(x + 22, y + 18, o.t + 20, 2, 5); } } },
  ];

  // ================= 公爵测距棱镜 boss_lens（1×1，控制：瞄准更快更稳）：「黄铜公爵」沃德豪斯——黄铜、贵族、单片眼镜；控制类用玻璃色 =================
  const LENS = [
    { key: 'A', name: '棱镜王冠', ref: '（v1 候选 A 重画）',
      idea: '一块三角玻璃棱镜嵌在带尖齿的黄铜冠座上，右边射出一小束分光（红、黄、绿、青四色，时不时闪一下）。最「棱镜」，冠座交代了「公爵」。',
      draw(x, y, o) {
        box(x + 3, y + 18, 18, 6, BRASS.map((c, i) => [P.brass[0], P.brass[0], P.brass[1], P.brass[3]][i])); for (const u of [6, 12, 18]) { disc(x + u, y + 20.5, 1, P.fire[0]); }
        for (let k = 0; k < 5; k++) poly([[x + 3 + k * 4, y + 18], [x + 5 + k * 4, y + 14], [x + 7 + k * 4, y + 18]], BRASS);
        poly([[x + 6, y + 17], [x + 12, y + 3], [x + 18, y + 17]], GLASSR); line(x + 12, y + 4, x + 15, y + 15, 1, P.glass[3]);
      },
      fx(x, y, o) { spectrum(x + 16, y + 10, 8, o.t, -0.15); } },
    { key: 'B', name: '公爵单片眼镜', ref: '（v1 候选 B 重画）',
      idea: '一只巨大的黄铜框单片眼镜立在小座上，镜片时不时闪光，一条黄铜细链从镜框垂下来绕到底座。很有角色感（一眼想到那位公爵），也最幽默。',
      draw(x, y, o) {
        box(x + 7, y + 20, 10, 4, IRON); R(x + 11, y + 15, 2, 5, P.brass[1]);
        disc(x + 12, y + 9, 7.5, P.brass[0]); disc(x + 12, y + 9, 6.6, P.brass[2]); disc(x + 12, y + 9, 5.6, P.glass[1]); disc(x + 11, y + 8, 3.5, P.glass[2]);
        px(x + 9, y + 6, P.white); px(x + 10, y + 5, P.glass[3]);
        for (let k = 0; k <= 10; k++) { const u = k / 10; if (k % 2 === 0) px(x + 18 + u * 3, y + 13 + u * 8 + Math.sin(u * Math.PI) * 2, P.brass[3]); }
      },
      fx(x, y, o) { glint(x + 9, y + 6, o.t, 55); } },
    { key: 'C', name: '光学塔', ref: '（v1 候选 C 重画）',
      idea: '一根黄铜长镜筒竖着，筒上三道镜片环（环上各一点玻璃亮），顶上一块斜放的棱镜头朝前；底座贴车体。像天文台的测距塔，精密。',
      draw(x, y, o) {
        box(x + 5, y + 20, 14, 4, IRON);
        vtube(x + 9, y + 6, 6, 15, BRASS);
        for (const v of [9, 13, 17]) { R(x + 7, y + v, 10, 2, P.brass[2]); R(x + 7, y + v, 10, 1, P.brass[3]); px(x + 16, y + v, P.glass[2]); }
        poly([[x + 7, y + 6], [x + 9, y + 1], [x + 19, y + 3], [x + 17, y + 7]], GLASSR); line(x + 9, y + 1, x + 19, y + 3, 1, P.brass[2]);
      },
      fx(x, y, o) { spectrum(x + 19, y + 4, 5, o.t + 10, 0.1); } },
    { key: 'D', name: '纹章棱镜', ref: '新：公爵家的纹章（月桂花环 + 小冠 + 红色绶带）框着一只圆镜',
      idea: '一只圆镜被一圈黄铜月桂花环围着，顶上一顶小公爵冠，底下一条红色绶带打着结；镜片上一道分光在转。像挂在公爵府大门上的纹章，Boss 身份最强。',
      draw(x, y, o) {
        for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const a = Math.PI / 2 + s * (0.4 + k * 0.33), cx = x + 12 + Math.cos(a) * 8.5, cy = y + 12 + Math.sin(a) * 8.5; R(cx - 1, cy - 1, 2, 2, k % 2 ? P.brass[1] : P.brass[2]); px(cx + s, cy, P.brass[0]); }
        disc(x + 12, y + 12, 6, P.brass[0]); disc(x + 12, y + 12, 5, P.glass[1]); disc(x + 11, y + 11, 3, P.glass[2]); px(x + 10, y + 9, P.white);
        const a = o.t * 0.05; line(x + 12 - Math.cos(a) * 4, y + 12 - Math.sin(a) * 4, x + 12 + Math.cos(a) * 4, y + 12 + Math.sin(a) * 4, 1, P.glass[3]);
        R(x + 9, y + 3, 7, 2, P.brass[1]); for (const u of [9, 12, 15]) R(x + u, y + 1, 1, 2, P.brass[3]); px(x + 12, y, P.fire[1]);
        R(x + 5, y + 20, 14, 3, P.fire[0]); R(x + 5, y + 20, 14, 1, P.fire[1]); R(x + 3, y + 21, 2, 3, P.fire[0]); R(x + 19, y + 21, 2, 3, P.fire[0]);
      } },
    { key: 'E', name: '礼帽棱镜', ref: '新：双棱镜的测距镜身，戴一顶小礼帽、夹一只单片眼镜',
      idea: '一只黄铜双棱镜镜身（两个台阶形的棱镜包 + 右边两只物镜），顶上戴一顶黑色小礼帽（红帽带），正面夹一只单片眼镜、垂一截细链。「公爵本人」被画成了一件仪器，最幽默、最好记。',
      draw(x, y, o) {
        box(x + 2, y + 12, 20, 10, BRASS); R(x + 3, y + 12, 18, 1, P.brass[3]);
        for (const u of [3, 12]) { R(x + u, y + 9, 8, 4, P.brass[1]); R(x + u, y + 9, 8, 1, P.brass[3]); }
        for (const v of [14, 18]) { R(x + 21, y + v, 3, 3, P.glass[1]); px(x + 22, y + v, P.glass[3]); }
        R(x + 5, y + 8, 12, 1, P.black); R(x + 7, y + 2, 8, 6, P.black); R(x + 7, y + 6, 8, 1, P.fire[0]); px(x + 8, y + 3, P.dark[3]);
        disc(x + 8, y + 17, 2.6, P.brass[2]); disc(x + 8, y + 17, 1.6, P.glass[2]); px(x + 7, y + 16, P.white);
        for (let k = 0; k < 4; k++) px(x + 10 + k, y + 19 + (k % 2), P.brass[3]);
        box(x + 4, y + 22, 16, 2, IRON);
      },
      fx(x, y, o) { glint(x + 7, y + 16, o.t, 60); } },
    { key: 'F', name: '旋转棱镜鼓', ref: '新：一只慢慢转的多面棱镜鼓（花饰黄铜耳架）',
      idea: '两只花饰黄铜耳架托着一只横放的多面棱镜鼓，鼓一直慢慢转，每一面转到正面时亮一下、向右射出一小束分光。「一直在找距离」的感觉最强，动起来也最漂亮。',
      draw(x, y, o) {
        box(x + 2, y + 20, 20, 4, IRON);
        for (const u of [2, 19]) { R(x + u, y + 5, 3, 15, P.brass[1]); R(x + u, y + 5, 1, 15, P.brass[3]); disc(x + u + 1.5, y + 5, 2, P.brass[2]); px(x + u + 1, y + 13, P.brass[0]); }
        const rot = o.t * 0.06, faces = 6;
        for (let k = 0; k < faces; k++) {
          const a0 = rot + k / faces * TAU, a1 = a0 + TAU / faces, y0 = Math.sin(a0) * 6, y1 = Math.sin(a1) * 6;
          if (Math.cos((a0 + a1) / 2) < 0) continue;
          const lit = Math.cos((a0 + a1) / 2) > 0.92, lo = Math.min(y0, y1), hi = Math.max(y0, y1);
          R(x + 5, y + 12 + lo, 14, Math.max(1, hi - lo), lit ? P.glass[3] : [P.glass[1], P.glass[0], P.glass[1]][k % 3]);
          R(x + 5, y + 12 + lo, 14, 1, P.brass[0]); if (!lit && hi - lo > 2) px(x + 7, y + 13 + lo, P.glass[2]);
        }
        R(x + 5, y + 5, 1, 14, P.brass[0]); R(x + 18, y + 5, 1, 14, P.brass[0]);
      },
      fx(x, y, o) { const rot = o.t * 0.06; for (let k = 0; k < 6; k++) { const a = rot + (k + 0.5) / 6 * TAU; if (Math.cos(a) > 0.92) spectrum(x + 19, y + 12, 6, 0, 0); } } },
  ];

  // ================= 寡妇液压撞头 boss_ram（2×1 = 48×24，撞击层，装在车头最前、朝右打）：撞击件一律锈钢色；黑寡妇的红沙漏记号 =================
  // o.p = 活塞打击的伸出量 0～1
  const mount = (x, y) => { R(x, y + 1, 4, 22, P.iron[0]); R(x + 1, y + 2, 2, 20, P.iron[2]); for (const v of [4, 11, 18]) px(x + 2, y + v, P.iron[4]); };
  const RAM = [
    { key: 'A', name: '沙漏液压锤', ref: '（v1 候选 A 重画）',
      idea: '一只黄铜箍的液压缸，活塞杆一伸一缩，锤头是锈钢的沙漏形（上下宽、腰细），锤面上一只红沙漏——黑寡妇的记号。',
      draw(x, y, o) {
        mount(x, y); htube(x + 3, y + 6, 20, 12, IRONL); band(x + 7, y + 6, 2, 12); band(x + 17, y + 6, 2, 12);
        const e = o.p * 12, X = x + 29 + e; R(x + 23, y + 10, 6 + e, 4, P.iron[0]); R(x + 23, y + 11, 6 + e, 1, P.iron[4]);
        poly([[X, y + 2], [X + 10, y + 2], [X + 7, y + 12], [X + 10, y + 22], [X, y + 22], [X + 3, y + 12]], RUSTR);
        hourglass(X + 5, y + 12, 1);
      } },
    { key: 'B', name: '蛛颚', ref: '（v1 候选 B 重画）',
      idea: '两片弯曲的锈钢颚像蜘蛛的螯肢，根部各一只小液压缸；平时张开，打击时猛地合上（内沿一排齿）。最凶、最像「寡妇」，剪影独一无二。',
      draw(x, y, o) {
        mount(x, y); box(x + 3, y + 4, 12, 16, IRONL); hourglass(x + 9, y + 12, 1);
        const open = (1 - o.p) * 5;
        for (const sd of [-1, 1]) {
          R(x + 14, y + 12 + sd * 5 - 2, 7, 4, P.brass[1]); R(x + 14, y + 12 + sd * 5 - 2, 7, 1, P.brass[3]);
          const P0 = [x + 20, y + 12 + sd * 5], mid = [x + 30, y + 12 + sd * (8 + open)], tip = [x + 40, y + 12 + sd * (1 + open * 0.3)];
          const outer = [], inner = [];
          for (let k = 0; k <= 8; k++) { const u = k / 8, bx = (1 - u) ** 2 * P0[0] + 2 * (1 - u) * u * mid[0] + u * u * tip[0], by = (1 - u) ** 2 * P0[1] + 2 * (1 - u) * u * mid[1] + u * u * tip[1], w = 2.5 * (1 - u) + 0.6; outer.push([bx, by + sd * w]); inner.unshift([bx, by - sd * w]); }
          poly(outer.concat(inner), RUSTR);
          for (let k = 2; k < 8; k += 2) { const u = k / 8, bx = (1 - u) ** 2 * P0[0] + 2 * (1 - u) * u * mid[0] + u * u * tip[0], by = (1 - u) ** 2 * P0[1] + 2 * (1 - u) * u * mid[1] + u * u * tip[1]; px(bx, by - sd * 3, P.rust[3]); }
        }
      } },
    { key: 'C', name: '三联活塞锤', ref: '（v1 候选 C 重画）',
      idea: '（v2：锤头改成锻工锤——竖锤身 + 朝前收尖的锤嘴）三根并排的活塞锤轮流敲出（上、中、下），气缸上一排黄铜箍。把「短周期活塞打击」直接画出来。',
      draw(x, y, o) {
        mount(x, y);
        for (let k = 0; k < 3; k++) {
          const v = y + 2 + k * 7, ph = o.act != null ? (k === o.act ? o.p : o.p * 0.25) : Math.max(0, Math.sin((o.p * 3 - k) * Math.PI)) * (o.p > 0 ? 1 : 0), e = ph * 10;
          htube(x + 3, v, 18, 6, IRONL); band(x + 8, v, 2, 6);
          R(x + 21, v + 2, 7 + e, 2, P.iron[4]);
          const X = x + 28 + e;   // 锤头 v2：一块竖着的锤身 + 朝前收尖的锤嘴（像把锻工锤），后面一道黄铜夹箍
          poly([[X, v - 1], [X + 5, v - 1], [X + 10, v + 3], [X + 5, v + 7], [X, v + 7]], RUSTR);
          R(X - 1, v + 1, 2, 4, P.brass[1]); px(X - 1, v + 1, P.brass[3]); line(X + 5, v, X + 9, v + 3, 1, P.rust[3]); px(X + 10, v + 3, P.iron[4]);
        }
        hourglass(x + 15, y + 12, 1);
      } },
    { key: 'D', name: '蛛腿夹钳', ref: '新：一根锈钢撞角，四条分节的黑色蛛腿收在它四周',
      idea: '正中一根锈钢撞角朝前，根部一只红沙漏；四条分节的黑色蛛腿（黄铜关节）上下各两条收在撞角四周，打击时蛛腿猛地往前伸直、腿尖扎向前方，像蜘蛛扑咬。',
      draw(x, y, o) {
        mount(x, y); box(x + 3, y + 7, 12, 10, IRONL);
        poly([[x + 14, y + 8], [x + 40 + o.p * 6, y + 12], [x + 14, y + 16]], RUSTR); hourglass(x + 18, y + 12, 1);
        for (const s of [-1, 1]) for (const k of [0, 1]) {
          const root = [x + 12 + k * 3, y + 12 + s * 4], kx = x + 20 + k * 6 + o.p * 4, ky = y + 12 + s * (11 - o.p * 3), tx = x + 30 + k * 7 + o.p * 10, ty = y + 12 + s * (6 - o.p * 3);
          line(root[0], root[1], kx, ky, 2, P.black); line(kx, ky, tx, ty, 2, P.dark[0]); line(kx, ky, tx, ty, 1, P.dark[2]);
          R(kx - 1, ky - 1, 2, 2, P.brass[2]); px(tx, ty, P.rust[3]);
        }
      } },
    { key: 'E', name: '寡妇面纱撞角', ref: '新：寡妇的黑面纱（铁网罩）罩着液压缸 + 胸针（红沙漏）+ 长撞角',
      idea: '液压缸外罩着一片垂下来的黑色铁网「面纱」，网上别着一只椭圆黄铜胸针，胸针里是红沙漏；缸前伸出一根长长的锈钢撞角，打击时猛地往前捅。黑色 + 黄铜 + 一点红，最有「寡妇」的哀悼感。',
      draw(x, y, o) {
        mount(x, y); htube(x + 3, y + 5, 20, 14, IRONL);
        for (let yy = 3; yy < 21; yy++) for (let xx = 3; xx < 23; xx++) if ((xx + yy) % 3 === 0 || (xx - yy + 30) % 3 === 0) { if (yy > 14 && ((xx * 7 + yy) % 5 < 2)) continue; px(x + xx, y + yy, P.black); }
        R(x + 3, y + 3, 20, 1, P.dark[2]);
        shape((xx, yy) => ((xx - x - 13) / 3.6) ** 2 + ((yy - y - 11) / 4.6) ** 2 <= 1, x + 9, y + 6, x + 17, y + 16, BRASS); hourglass(x + 13, y + 11, 0.7);
        const e = o.p * 10; R(x + 23, y + 9, 4 + e, 6, P.iron[1]); R(x + 23, y + 10, 4 + e, 1, P.iron[4]);
        poly([[x + 27 + e, y + 7], [x + 45 + e, y + 12], [x + 27 + e, y + 17]], RUSTR);
      } },
    { key: 'F', name: '纺锤腹液压头', ref: '新：黑寡妇的腹部——又大又亮的黑色储油腹（腹下红沙漏）+ 前面的液压撞头',
      idea: '后半截是一只又大又亮的黑色储油「腹」（像黑寡妇的腹部，一道高光），腹下一只大红沙漏；两根油管从腹里接到前面的液压缸，缸前一只带齿的锈钢撞头，打击时往前猛冲。整件就是一只趴着的黑寡妇，最独特。',
      draw(x, y, o) {
        mount(x, y);
        shape((xx, yy) => ((xx - x - 14) / 11) ** 2 + ((yy - y - 11) / 9.5) ** 2 <= 1, x + 3, y + 1, x + 25, y + 21, BLK);
        R(x + 8, y + 5, 6, 1, P.dark[3]); px(x + 9, y + 4, P.steam[2]); hourglass(x + 14, y + 17, 0.9);
        for (const v of [8, 14]) { line(x + 24, y + v, x + 28, y + v, 1, P.brass[2]); }
        htube(x + 27, y + 7, 8, 10, IRONL); band(x + 30, y + 7, 2, 10);
        const e = o.p * 10; R(x + 35, y + 10, 3 + e, 4, P.iron[4]);
        box(x + 38 + e, y + 5, 6, 14, RUSTR); for (let v = 6; v < 19; v += 3) R(x + 44 + e, y + v, 2, 2, P.rust[2]);
      } },
  ];

  const MODS = [
    { id: 'boss_core', name: '圣堂压力核心', w: 1, h: 1, tiers: [1, 2, 3, 4, 5, 6], SET: CORE,
      rule: '1×1 · Boss「铁甲圣堂」的战利品 · 能源：动力 + 蓄压 + 储水 + 冷却，一身四用 · 用圣堂的哥特元素（尖拱、玫瑰窗、十字、尖塔）让它一眼和普通件不同 · 核心一点炉火余烬在呼吸（只有几个像素，不算大面积发光）',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 12, label: '' }, { t: 25, label: '' }, { t: 37, label: '' }] },
    { id: 'boss_ram', name: '寡妇液压撞头', w: 2, h: 1, tiers: [5, 1, 3, 6], SET: RAM,
      rule: '2×1 撞击层 · Boss「煤灰寡妇」玛莎·布莱克的战利品（唯一件，乌兹钢档）· 冲撞 + 短周期活塞打击 · 撞击件一律锈钢色，左边法兰贴车头、往右打 · 黑寡妇的红沙漏记号 · 页面循环：待机 → 猛地打出 → 收回',
      state: (t) => { const c = t % 50; return { t, p: c < 5 ? c / 5 : c < 14 ? 1 - (c - 5) / 9 : 0 }; },
      poses: [{ p: 0, label: '收' }, { p: 0.5, label: '半伸' }, { p: 1, label: '打出' }, { p: 0.33, label: '（三联：第二根）' }] },
    { id: 'boss_lens', name: '公爵测距棱镜', w: 1, h: 1, tiers: [5, 1, 3, 6], SET: LENS,
      rule: '1×1 · Boss「黄铜公爵」沃德豪斯的战利品（唯一件，乌兹钢档）· 控制：全车瞄准更快更稳 · 公爵 = 黄铜、贵族、单片眼镜；控制类用玻璃色 · 分光（红黄绿青四色）时不时闪一下',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 14, label: '' }, { t: 28, label: '' }, { t: 42, label: '' }] },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, m) { g = ctx; if (e.fx) e.fx(x, y, o); else if (m && m.fx) m.fx(x, y, o); }
  return { MODS, figure, over, LINEUP: [] };
})();
