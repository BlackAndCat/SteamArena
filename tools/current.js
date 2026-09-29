// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：驾驶舱家族重做——单人 helmet（1×1）· 双人 cockpit_pair（1×2）· 四人 cockpit（2×2）。
// 用户：要能看到舱里的小黑煤球，可以加操纵件（操纵杆、汽笛拉杆……），小驾驶舱塞不下可以不加；大驾驶舱是一个贯通的舱室，不是几个隔开的煤球。
// 通用规则：车载；T1 原画 + 游戏的材质层换色；不出格；每个造型带一点动画。
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

  // ================= 驾驶舱家族重做（2026-09-29）：看得见舱里的小黑煤球 + 操纵件 =================
  // 每个造型分三层：back（舱壳 + 被灯照亮的舱内）→ 驾驶员（页面按 seats 画游戏同款煤球小人，剪在 win 形状里）→ front（操纵杆、拉索、舵轮、栏杆、挡板，挡住驾驶员下半身）。
  // 舱内墙面用暖色的皮木色（不是金属，材质层不换色），黑煤球放上去才看得清。大驾驶舱是一个贯通的舱室，不是几个分开的圆窗。
  const arch = (cx, top, bottom, rad, col) => { const cy = top + rad; g.fillStyle = col; for (let yy = top; yy < bottom; yy++) { const dy = yy + 0.5 - cy, hw = dy < 0 ? Math.sqrt(Math.max(0, rad * rad - dy * dy)) : rad; g.fillRect(Math.round(cx - hw), yy, Math.round(hw * 2), 1); } };
  // 舱内：暖色墙板（竖缝）、顶上一道阴影、底下一截暗地板
  function room(x0, y0, w, h, o = {}) {
    R(x0, y0, w, h, P.leather[1]);
    for (let u = x0 + 3; u < x0 + w - 1; u += 5) R(u, y0 + 1, 1, h - 3, P.leather[0]);
    R(x0, y0, w, 2, P.leather[0]); R(x0, y0 + 2, w, 1, P.leather[2]);
    if (o.floor !== false) { R(x0, y0 + h - 2, w, 2, P.dark[2]); R(x0, y0 + h - 2, w, 1, P.dark[1]); }
  }
  const lamp = (x, y, t) => { R(x - 1, y - 2, 3, 1, P.brass[1]); disc(x + 0.5, y + 0.5, 1.4, P.brass[2]); px(x, y, Math.sin(t * 0.3) > -0.7 ? P.fire[3] : P.fire[2]); };
  // 操纵杆：pivot 处一个暗色枢轴，往上一根黄铜杆，顶端圆柄
  const lever = (x, y, len, ang, knob = P.brass[3]) => { const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len; line(x, y, ex, ey, 1, P.brass[1]); disc(ex + 0.5, ey + 0.5, 1.3, P.brass[0]); px(Math.floor(ex), Math.floor(ey), knob); disc(x + 0.5, y + 0.5, 1.4, P.iron[0]); };
  // 汽笛拉索：从顶上垂下的链子 + 黄铜拉环；pull = 0～1
  const cord = (x, y, len, pull) => { const e = y + len + Math.round(pull * 3); for (let yy = y; yy < e; yy += 2) px(x, yy, P.brass[1]); ring(x + 0.5, e + 1.5, 1.4, P.brass[2]); };
  const wheel = (cx, cy, r, rot, n = 6) => { ring(cx, cy, r, P.brass[0]); ring(cx, cy, r - 0.8, P.brass[2]); for (let k = 0; k < n; k++) { const a = rot + k / n * TAU; line(cx, cy, cx + Math.cos(a) * (r + 1.4), cy + Math.sin(a) * (r + 1.4), 1, P.brass[1]); px(Math.floor(cx + Math.cos(a) * (r + 1.8)), Math.floor(cy + Math.sin(a) * (r + 1.8)), P.brass[3]); } disc(cx, cy, 1.3, P.brass[3]); };
  // 实心环：画一只圆盘再把中间挖空（窄环用描边算法会变成格子）；上半圈亮、下半圈暗；clipY = 只画这条线以上
  function annulus(cx, cy, r0, r1, ramp, clipY) {
    g.save(); if (clipY != null) { g.beginPath(); g.rect(cx - r1 - 2, cy - r1 - 2, r1 * 2 + 4, clipY - (cy - r1 - 2)); g.clip(); }
    disc(cx, cy, r1, ramp[0]); disc(cx, cy, r1 - 0.8, ramp[2]);
    for (let k = 0; k < 24; k++) { const a = Math.PI * 1.05 + k / 24 * Math.PI * 0.9; px(Math.floor(cx + Math.cos(a) * (r1 - 1.2)), Math.floor(cy + Math.sin(a) * (r1 - 1.2)), ramp[3]); }
    g.globalCompositeOperation = 'destination-out'; disc(cx, cy, r0, '#000'); g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  const pullOf = (t, per, off = 0) => { const p = saw(t + off, per); return p < 0.12 ? p / 0.12 : p < 0.3 ? 1 : p < 0.4 ? 1 - (p - 0.3) / 0.1 : 0; };

  // ---------- 单人驾驶舱 helmet（1×1）：塞不下操纵件就不硬塞 ----------
  const HELMET = [
    { key: 'A', name: '大圆窗潜水盔', ref: '现役驾驶舱（潜水盔）', seats: [[12, 12]], win: { c: [12, 11, 6] },
      idea: '保留现役潜水盔的圆顶和黄铜底座，把舷窗开大（半径 6），窗里是被灯照亮的暖色舱壁，驾驶员整个坐在窗里；窗沿一圈黄铜 + 一粒玻璃反光。',
      back(x, y, o) {
        arch(x + 12, y + 1, y + 21, 10.5, P.iron[0]); arch(x + 12, y + 2, y + 20, 9.5, P.iron[2]);
        for (const [a, b] of [[5, 6], [6, 4], [8, 3], [4, 8]]) px(x + a, y + b, P.iron[3]);
        R(x + 2, y + 18, 20, 5, P.brass[0]); R(x + 3, y + 18, 18, 4, P.brass[1]); R(x + 3, y + 18, 18, 1, P.brass[3]);
        disc(x + 12, y + 11, 7.4, P.black); disc(x + 12, y + 11, 6.8, P.brass[1]);
        disc(x + 12, y + 11, 6, P.leather[1]); R(x + 6, y + 5, 12, 2, P.leather[0]); R(x + 7, y + 15, 10, 2, P.dark[2]);
        R(x + 10, y + 0, 4, 2, P.brass[1]);
      },
      front(x, y, o) { annulus(x + 12, y + 11, 5.6, 7.4, BRASS); px(x + 8, y + 7, P.glass[3]); px(x + 9, y + 6, P.glass[3]); } },
    { key: 'B', name: '玻璃罩座舱', ref: '维多利亚温室的玻璃钟罩', seats: [[12, 13]], win: { c: [12, 17, 9] },
      idea: '一块铆接底座上扣着一只半球玻璃罩，驾驶员坐在罩里（能看见后面的皮椅背），罩外一圈黄铜环、顶上一颗黄铜钮，罩边一根小拉杆。',
      back(x, y, o) {
        box(x + 1, y + 17, 22, 7, IRON); rivet(x + 3, y + 19); rivet(x + 19, y + 19);
        g.save(); g.beginPath(); g.rect(x, y, 24, 17); g.clip(); disc(x + 12, y + 17, 9, P.leather[1]); g.restore();
        R(x + 8, y + 10, 8, 7, P.leather[0]); R(x + 9, y + 10, 6, 1, P.leather[2]);
      },
      front(x, y, o) {
        annulus(x + 12, y + 17, 8, 9.6, [P.glass[0], P.glass[1], P.glass[2], P.glass[3]], y + 16);
        for (const [a, b] of [[6, 11], [7, 9], [8, 10]]) px(x + a, y + b, P.glass[3]);
        R(x + 2, y + 15, 20, 2, P.brass[1]); R(x + 2, y + 15, 20, 1, P.brass[3]); disc(x + 12, y + 7.5, 1.2, P.brass[2]);
        lever(x + 20, y + 15, 5, 0.3 * Math.sin((o.t || 0) * 0.08));
      } },
    { key: 'C', name: '方窗驾驶箱', ref: '一战装甲车的驾驶室', seats: [[12, 11]], win: { r: [4, 4, 16, 12] },
      idea: '一只铆接方箱开一扇宽窗，窗上一道遮阳眉，驾驶员坐在窗后，窗下沿露出方向盘的上半圈（随驾驶左右转一点）。',
      back(x, y, o) { box(x + 1, y + 1, 22, 22, IRON); for (const [a, b] of [[3, 19], [19, 19]]) rivet(x + a, y + b); room(x + 4, y + 4, 16, 12); lamp(x + 16, y + 6, o.t || 0); },
      front(x, y, o) {
        R(x + 3, y + 3, 18, 2, P.iron[0]); R(x + 3, y + 3, 18, 1, P.iron[3]);
        g.save(); g.beginPath(); g.rect(x, y, 24, 16); g.clip(); wheel(x + 12, y + 18, 5, 0.3 * Math.sin((o.t || 0) * 0.05), 3); g.restore();
        R(x + 3, y + 15, 18, 2, P.iron[1]); R(x + 3, y + 15, 18, 1, P.iron[4]);
      } },
    { key: 'D', name: '敞篷座舱', ref: '早期蒸汽汽车的敞篷驾驶座', seats: [[11, 10]], win: null,
      idea: '没有顶，驾驶员坐在一只铆接座盆里，头和肩露在外面，身后一块皮椅背；座盆前沿一道黄铜扶栏、一小块挡风玻璃。剪影和其他驾驶舱最不一样。',
      back(x, y, o) { R(x + 5, y + 4, 10, 10, P.leather[0]); R(x + 6, y + 4, 8, 1, P.leather[2]); R(x + 6, y + 5, 1, 8, P.leather[1]); },
      front(x, y, o) {
        poly([[x + 1, y + 13], [x + 23, y + 13], [x + 22, y + 24], [x + 2, y + 24]], IRON); rivet(x + 4, y + 17); rivet(x + 18, y + 17);
        R(x + 1, y + 12, 22, 2, P.brass[1]); R(x + 1, y + 12, 22, 1, P.brass[3]);
        line(x + 16, y + 12, x + 17, y + 5, 1, P.glass[2]); line(x + 20, y + 12, x + 21, y + 5, 1, P.glass[2]); line(x + 17, y + 5, x + 21, y + 5, 1, P.glass[3]); px(x + 18, y + 8, P.glass[3]);
      } },
  ];

  // ---------- 双人联合驾驶舱 cockpit_pair（1×2）：两个人在同一个上下贯通的舱里 ----------
  const PAIR = [
    { key: 'A', name: '双层驾驶台', ref: '维多利亚蒸汽船的双层驾驶台', seats: [[10, 19], [14, 37]], win: { r: [4, 4, 16, 38] },
      idea: '一整扇高窗里是上下两层的舱：上层一个站在格栅平台上对着传声管喊话，下层一个扳着操纵杆；舱壁上挂着两只压力表和一盏灯。',
      back(x, y, o) {
        box(x + 1, y + 1, 22, 46, IRON); room(x + 4, y + 4, 16, 38); lamp(x + 12, y + 7, o.t || 0);
        gauge(x + 17, y + 11, 2.4, 0.5); gauge(x + 7, y + 30, 2.4, 0.3 + 0.2 * Math.sin((o.t || 0) * 0.05));
        R(x + 4, y + 24, 16, 2, P.dark[2]);
        for (const yy of [44, 3]) { rivet(x + 3, y + yy - 1); rivet(x + 19, y + yy - 1); }
      },
      front(x, y, o) {
        const t = o.t || 0;
        R(x + 3, y + 24, 18, 2, P.brass[1]); for (let u = 4; u < 20; u += 3) px(x + u, y + 25, P.brass[0]);   // 格栅平台前沿
        line(x + 16, y + 4, x + 16, y + 13, 2, P.brass[1]); disc(x + 15, y + 14, 1.6, P.brass[2]); px(x + 15, y + 14, P.dark[0]);   // 传声管
        lever(x + 18, y + 41, 9, -0.5 + 0.35 * Math.sin(t * 0.07));
        R(x + 3, y + 41, 18, 2, P.iron[1]); R(x + 3, y + 41, 18, 1, P.iron[4]);
      } },
    { key: 'B', name: '高窗机车室', ref: '蒸汽机车的司机室（出檐顶棚 + 汽笛拉索 + 调节杆）', seats: [[9, 23], [14, 38]], win: { r: [5, 9, 14, 34] },
      idea: '出檐顶棚下一扇高窗：上面的人拉汽笛拉索（一拉，顶上的汽笛就冒一口汽），下面的人扳调节杆；舱壁是锅炉背板，两只表 + 一根水位玻璃管。',
      back(x, y, o) {
        box(x + 2, y + 5, 20, 42, IRON); room(x + 5, y + 9, 14, 34);
        gauge(x + 9, y + 13, 2.2, 0.55); gauge(x + 15, y + 13, 2.2, 0.4);
        R(x + 17, y + 20, 2, 9, P.glass[0]); R(x + 17, y + 24, 2, 5, P.water[1]);
      },
      front(x, y, o) {
        const t = o.t || 0, pl = pullOf(t, 90);
        R(x + 0, y + 2, 24, 4, P.iron[0]); R(x + 1, y + 2, 22, 2, P.iron[3]); R(x + 1, y + 4, 22, 1, P.brass[2]);
        R(x + 15, y + 0, 2, 2, P.brass[2]); if (pl > 0.5) puff(x + 16, y + 0, t * 3, 2, 4);
        cord(x + 15, y + 6, 12, pl);
        lever(x + 6, y + 42, 9, 0.6 + 0.3 * Math.sin(t * 0.06));
        R(x + 4, y + 42, 16, 2, P.iron[1]); R(x + 4, y + 42, 16, 1, P.iron[4]);
      } },
    { key: 'C', name: '螺旋梯舱', ref: '维多利亚铸铁螺旋楼梯 + 船用车钟', seats: [[15, 16], [9, 37]], win: { r: [3, 3, 18, 42] },
      idea: '黄铜框的高窗里一道铸铁螺旋梯把上下连起来：上面的人站在梯顶平台上，下面的人坐在车钟（发动机传令器）前，车钟的手柄来回扳。',
      back(x, y, o) {
        box(x + 1, y + 1, 22, 46, BRASS); room(x + 3, y + 3, 18, 42);
        for (let i = 0; i < 7; i++) { const yy = y + 40 - i * 3, xx = x + 5 + ((i % 4) < 2 ? i % 4 : 3 - i % 4) * 4; R(xx, yy, 7, 1, P.leather[0]); R(xx, yy + 1, 7, 1, P.dark[2]); }
        R(x + 3, y + 21, 18, 2, P.dark[2]); lamp(x + 7, y + 6, o.t || 0);
      },
      front(x, y, o) {
        const t = o.t || 0;
        R(x + 3, y + 21, 18, 1, P.brass[2]); for (let u = 4; u < 20; u += 3) R(x + u, y + 18, 1, 3, P.brass[1]);   // 平台栏杆
        R(x + 13, y + 35, 2, 8, P.brass[0]); disc(x + 14, y + 34, 3.2, P.brass[1]); disc(x + 14, y + 34, 2.3, P.steam[2]);   // 车钟
        const a = -0.8 + 0.8 * Math.sin(t * 0.05); line(x + 14, y + 34, x + 14 + Math.cos(a) * 3.5, y + 34 + Math.sin(a) * 3.5, 1, P.dark[0]);
        R(x + 3, y + 43, 18, 2, P.iron[1]);
      } },
    { key: 'D', name: '指挥塔剖面', ref: '维多利亚潜艇指挥塔的剖面',
      seats: [[11, 18], [12, 38]], win: { r: [6, 7, 12, 37] },
      idea: '圆头的铆接塔身，正面切开一道竖长的剖面：上面的人贴着一根从塔顶垂下来的潜望镜看，下面的人转着舱门手轮；塔壁上一道梯子。',
      back(x, y, o) {
        shape((u, v) => { const lx = u - x, ly = v - y; if (lx < 1 || lx > 23 || ly > 47) return false; return ly >= 12 || (lx - 12) ** 2 + (ly - 12) ** 2 <= 121; }, x, y, x + 24, y + 48, IRONL);
        room(x + 6, y + 7, 12, 37); for (let yy = 12; yy < 42; yy += 4) R(x + 7, y + yy, 3, 1, P.leather[0]);
        for (let yy = 16; yy < 46; yy += 4) { px(x + 3, y + yy, P.iron[4]); px(x + 20, y + yy, P.iron[4]); }
      },
      front(x, y, o) {
        const t = o.t || 0;
        R(x + 14, y + 1, 2, 14, P.brass[1]); R(x + 14, y + 1, 1, 14, P.brass[3]); R(x + 12, y + 14, 5, 3, P.brass[0]); R(x + 12, y + 15, 2, 1, P.glass[2]);   // 潜望镜
        wheel(x + 16.5, y + 40, 3.2, t * 0.06, 4);
        R(x + 5, y + 43, 14, 2, P.iron[1]);
      } },
  ];

  // ---------- 四人联合驾驶舱 cockpit（2×2）：一个贯通的舱室，四个人在里面各管一样 ----------
  const BIG = [
    { key: 'A', name: '机车驾驶室', ref: '蒸汽机车的司机室（锅炉背板、调节杆、汽笛拉索、换向轮）',
      seats: [[17, 25], [31, 25], [10, 32], [38, 32]], win: { r: [7, 8, 34, 30] },
      idea: '出檐顶棚、两根立柱夹着一个宽敞的司机室：后墙是锅炉背板（三只压力表、横穿的黄铜管、一盏灯），后排两人看表，前排左边扳调节杆、右边拉汽笛（顶上冒汽），中间一只换向手轮；下面一块铆接侧板挡住大家的下半身。',
      back(x, y, o) {
        box(x + 2, y + 7, 5, 40, IRON); box(x + 41, y + 7, 5, 40, IRON);
        room(x + 7, y + 8, 34, 30, { floor: false });
        R(x + 7, y + 19, 34, 2, P.brass[1]); R(x + 7, y + 19, 34, 1, P.brass[2]);
        gauge(x + 14, y + 13, 2.6, 0.5); gauge(x + 24, y + 12, 3, 0.35 + 0.2 * Math.sin((o.t || 0) * 0.04)); gauge(x + 34, y + 13, 2.6, 0.6);
        lamp(x + 38, y + 11, o.t || 0);
      },
      front(x, y, o) {
        const t = o.t || 0, pl = pullOf(t, 100);
        R(x + 0, y + 3, 48, 5, P.iron[0]); R(x + 1, y + 3, 46, 3, P.iron[3]); R(x + 1, y + 6, 46, 1, P.brass[2]);
        R(x + 35, y + 0, 3, 3, P.brass[2]); if (pl > 0.5) puff(x + 36, y + 0, t * 3, 2, 4);
        cord(x + 36, y + 8, 14, pl);
        box(x + 2, y + 37, 44, 11, IRON); for (const u of [5, 13, 33, 41]) rivet(x + u, y + 40);
        R(x + 20, y + 40, 8, 4, P.brass[1]); R(x + 21, y + 41, 6, 2, P.brass[2]);   // 车号牌
        lever(x + 14, y + 37, 9, 0.5 + 0.3 * Math.sin(t * 0.06));
        wheel(x + 24, y + 35, 3.4, t * 0.04, 5);
      } },
    { key: 'B', name: '舰桥', ref: '维多利亚蒸汽船的驾驶台（舵轮、车钟、望远镜、传声管）',
      seats: [[10, 22], [24, 18], [35, 22], [42, 25]], win: { r: [3, 9, 42, 20] },
      idea: '顶棚下一整排宽窗，后墙挂着海图和气压表；四个人：左边扳车钟（发动机传令器），中间一个站在大舵轮后面掌舵（舵轮转），右边一个举着望远镜、最右一个对着传声管；下面一道带舷窗的船舷挡板。',
      back(x, y, o) {
        R(x + 1, y + 4, 46, 26, P.iron[0]); room(x + 3, y + 9, 42, 20, { floor: false });
        R(x + 16, y + 11, 11, 7, P.steam[2]); for (const yy of [13, 15]) R(x + 17, y + yy, 9, 1, P.steam[1]); px(x + 20, y + 14, P.fire[1]);   // 海图
        gauge(x + 31, y + 13, 2.4, 0.5);
      },
      front(x, y, o) {
        const t = o.t || 0;
        R(x + 0, y + 4, 48, 5, P.brass[0]); R(x + 1, y + 4, 46, 3, P.brass[2]); R(x + 1, y + 4, 46, 1, P.brass[3]);
        box(x + 1, y + 28, 46, 20, IRON); for (const u of [8, 20, 28, 40]) { disc(x + u, y + 38, 2.4, P.brass[1]); disc(x + u, y + 38, 1.6, P.glass[1]); px(x + u - 1, y + 37, P.glass[3]); }
        g.save(); g.beginPath(); g.rect(x, y, 48, 29); g.clip(); wheel(x + 24, y + 29, 6.5, t * 0.03, 8); g.restore();
        R(x + 8, y + 23, 4, 6, P.brass[0]); disc(x + 10, y + 22, 2.8, P.brass[1]); disc(x + 10, y + 22, 2, P.steam[2]);   // 车钟
        const a = -1.6 + 0.9 * Math.sin(t * 0.05); line(x + 10, y + 22, x + 10 + Math.cos(a) * 3.4, y + 22 + Math.sin(a) * 3.4, 1, P.dark[0]);
        R(x + 37, y + 19, 4, 2, P.brass[1]); px(x + 37, y + 19, P.glass[3]);   // 望远镜
        line(x + 45, y + 9, x + 45, y + 22, 2, P.brass[1]); disc(x + 44, y + 23, 1.5, P.brass[2]);   // 传声管
      } },
    { key: 'C', name: '双层车厢', ref: '维多利亚双层有轨电车的前舱',
      seats: [[15, 16], [33, 16], [12, 35], [36, 35]], win: { r: [5, 5, 38, 36] },
      idea: '一个上下两层贯通的大舱：上层两人扶着黄铜栏杆（一个看表、一个对传声管），下层两人各扳一根高操纵杆（一推一拉），中间一根立柱上顶着一只大压力表。',
      back(x, y, o) {
        box(x + 1, y + 1, 46, 46, IRON); room(x + 5, y + 5, 38, 36);
        R(x + 5, y + 21, 38, 2, P.dark[2]); lamp(x + 24, y + 8, o.t || 0);
        gauge(x + 9, y + 11, 2.2, 0.4); line(x + 39, y + 5, x + 39, y + 12, 2, P.brass[1]); disc(x + 38, y + 13, 1.5, P.brass[2]);
      },
      front(x, y, o) {
        const t = o.t || 0;
        R(x + 5, y + 21, 38, 1, P.brass[2]); for (let u = 6; u < 43; u += 4) R(x + u, y + 17, 1, 4, P.brass[1]); R(x + 5, y + 17, 38, 1, P.brass[3]);   // 上层栏杆
        R(x + 23, y + 29, 2, 12, P.brass[0]); gauge(x + 24, y + 28, 3.6, 0.3 + 0.4 * saw(t, 120));
        lever(x + 16, y + 41, 11, 0.4 + 0.3 * Math.sin(t * 0.06)); lever(x + 32, y + 41, 11, -0.4 - 0.3 * Math.sin(t * 0.06));
        R(x + 4, y + 41, 40, 3, P.iron[1]); R(x + 4, y + 41, 40, 1, P.iron[4]);
      } },
    { key: 'D', name: '装甲指挥室', ref: '一战坦克内部（从车顶垂下的潜望镜、观察缝、刹车杆）',
      seats: [[14, 24], [34, 24], [8, 32], [40, 32]], win: { r: [4, 8, 40, 31] },
      idea: '厚铆接车壳的正面被剖开，露出一个低矮的战斗室：后墙一排观察缝透着光，车顶垂下两根潜望镜（后排两人贴着看），前排两人守着中间两根高刹车杆（一推一拉）；前面一块厚装甲挡板。',
      back(x, y, o) {
        box(x + 0, y + 2, 48, 46, IRON); for (let u = 3; u < 46; u += 5) { px(x + u, y + 4, P.iron[4]); px(x + u, y + 45, P.iron[4]); }
        room(x + 4, y + 8, 40, 31, { floor: false });
        for (const u of [9, 21, 31]) { R(x + u, y + 13, 7, 1, P.glass[2]); R(x + u, y + 12, 7, 1, P.dark[1]); }   // 观察缝
      },
      front(x, y, o) {
        const t = o.t || 0;
        for (const u of [13, 33]) { R(x + u, y + 8, 2, 9, P.iron[3]); R(x + u, y + 8, 1, 9, P.iron[4]); R(x + u - 1, y + 16, 4, 3, P.iron[1]); px(x + u, y + 17, P.glass[2]); }   // 潜望镜
        lever(x + 22, y + 39, 12, 0.2 * Math.sin(t * 0.07), P.brass[3]); lever(x + 26, y + 39, 12, -0.2 * Math.sin(t * 0.07), P.brass[3]);
        box(x + 1, y + 37, 46, 11, IRONL); for (const u of [4, 14, 24, 34, 43]) rivet(x + u, y + 40);
      } },
  ];

  const MODS = [
    { id: 'helmet', name: '驾驶舱（单人）', w: 1, h: 1, crew: true, rule: '1×1 · 一名驾驶员（煤球小人 1×1 大小）· 塞不下操纵件就不硬塞', SET: HELMET },
    { id: 'cockpit_pair', name: '联合驾驶舱（双人）', w: 1, h: 2, crew: true, rule: '1×2 · 两名驾驶员在同一个上下贯通的舱里 · 操纵杆 / 拉索 / 传声管 / 手轮', SET: PAIR },
    { id: 'cockpit', name: '联合驾驶舱（四人）', w: 2, h: 2, crew: true, rule: '2×2 · 四名驾驶员在一个贯通的舱室里（不是四个分开的圆窗），各管一样操纵件', SET: BIG },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; (e.draw || e.back)(x, y, o); }
  function front(ctx, x, y, e, o = {}) { g = ctx; if (e.front) e.front(x, y, o); }
  return { MODS, figure, front };
})();
