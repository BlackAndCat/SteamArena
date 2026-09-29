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

  // ================= 大型锅炉 boiler_l（3×3 = 72×72，能源）：炉火是唯一允许发光的；剪影是方块，创意在内部构造 =================
  const BOILER = [
    { key: 'A', name: '兰开夏双炉胆', ref: '兰开夏锅炉（1844）：一只大卧式锅炉筒里并排两根炉胆',
      idea: '正面看一只砌在砖座里的大锅炉筒：圆形的筒端一圈铆钉，下半并排两扇炉门（门缝里透出炉火，热度越高越亮），上半一只大压力表 + 两根水位玻璃管，筒顶两只安全阀轮流泄汽。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        bricks(x, y + 60, 72, 12); box(x, y + 6, 72, 56, IRON);
        ball(x + 36, y + 34, 27, IRONL); for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; px(x + 36 + Math.cos(a) * 24.5, y + 34 + Math.sin(a) * 24.5, P.iron[4]); }
        doorG(x + 25, y + 43, 7.5, t, heat); doorG(x + 47, y + 43, 7.5, t, heat);
        gauge(x + 36, y + 20, 6, 0.3 + 0.5 * heat);
        for (const u of [23, 47]) { R(x + u, y + 14, 3, 13, P.glass[0]); R(x + u, y + 20 - heat * 3, 3, 7 + heat * 3, P.water[1]); R(x + u - 1, y + 13, 5, 1, P.brass[2]); R(x + u - 1, y + 27, 5, 1, P.brass[2]); }
        valve(x + 22, y + 2, t); valve(x + 50, y + 2, t, 140, 70);
        for (const [a, b] of [[3, 9], [67, 9], [3, 56], [67, 56]]) rivet(x + a, y + b);
      } },
    { key: 'B', name: '机车锅炉剖面', ref: '蒸汽机车锅炉的教科书剖面（火箱 → 火管 → 烟箱）',
      idea: '锅炉壳从正面剖开：左边是火箱（大团炉火），中间一排排横向火管（管口发红、热气沿管往右流），右边是烟箱和排气管；顶上汽包和安全阀。一眼看懂「火怎么把水烧开」。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        box(x, y + 4, 72, 64, IRON); R(x + 2, y + 66, 68, 6, P.iron[1]);
        box(x + 4, y + 14, 20, 48, IRONL); flames(x + 7, y + 26, 14, 33, t, heat);
        R(x + 24, y + 14, 34, 42, P.steam[1]); for (let yy = 16; yy < 54; yy += 2) R(x + 24, y + yy, 34, 1, P.steam[2]);
        for (let i = 0; i < 6; i++) { const yy = y + 20 + i * 6; R(x + 24, yy, 34, 3, P.iron[1]); R(x + 24, yy + 1, 34, 1, P.dark[1]); const p = saw(t * (1 + heat) + i * 9, 40); R(x + 24 + p * 30, yy + 1, 4, 1, P.fire[heat > 0.5 ? 3 : 2]); px(x + 24, yy + 1, P.fire[3]); }
        box(x + 58, y + 14, 12, 48, IRON); R(x + 60, y + 18, 8, 40, P.dark[0]); R(x + 62, y + 10, 4, 10, P.iron[3]);
        ball(x + 36, y + 10, 6, BRASS); valve(x + 36, y + 0, t);
        gauge(x + 14, y + 9, 3.5, 0.3 + 0.5 * heat);
      } },
    { key: 'C', name: '立式火管锅炉剖面', ref: '维多利亚立式锅炉（考克兰式）的剖面',
      idea: '一只胖胖的立式锅炉筒占满中间，正面开一扇大剖面窗：里面一根根竖着的火管发着红光，火管之间是翻滚的白汽泡；底下拱形炉门里是炉火，两侧给水泵和水位管。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        R(x + 2, y + 64, 68, 8, P.iron[1]); R(x + 2, y + 64, 68, 1, P.iron[3]);
        shape((u, v) => ((u - x - 36) / 26) ** 2 + ((v - y - 13) / 11) ** 2 <= 1 && v <= y + 13.5, x + 9, y + 1, x + 63, y + 14, IRONL); vtube(x + 10, y + 13, 52, 53, IRONL); R(x + 11, y + 13, 50, 1, P.iron[3]);
        R(x + 18, y + 14, 36, 28, P.steam[1]);
        for (let u = 0; u < 6; u++) { const xx = x + 21 + u * 6; R(xx, y + 14, 2, 28, P.iron[1]); if (Math.sin(t * 0.3 + u) > -0.3) R(xx, y + 14 + ((t + u * 5) % 28), 2, 3, P.fire[heat > 0.4 ? 2 : 1]); }
        for (let k = 0; k < 8; k++) { const p = saw(t * (0.8 + heat) + k * 11, 50); px(x + 20 + k * 4.4, y + 40 - p * 25, P.steam[2]); }
        R(x + 17, y + 13, 38, 1, P.brass[2]); R(x + 17, y + 42, 38, 1, P.brass[2]);
        R(x + 26, y + 48, 20, 14, P.iron[0]); flames(x + 28, y + 50, 16, 12, t, heat);
        for (const [a, b] of [[14, 20], [57, 20], [14, 50], [57, 50]]) rivet(x + a, y + b);
        vtube(x + 2, y + 30, 6, 34, IRON); R(x + 3, y + 36, 4, 6, P.glass[1]);
        gauge(x + 65, y + 34, 4, 0.3 + 0.5 * heat); valve(x + 36, y + 0, t);
      } },
    { key: 'D', name: '水管锅炉', ref: '巴布科克-威尔科克斯水管锅炉（1867）',
      idea: '砖砌炉室的正面剖开：炉火在下面，上面一排斜着的水管（前高后低）从前集箱通到后集箱，水管里的水被烧得往上翻，最上面横着一只大汽包，汽包上一只压力表和安全阀。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        bricks(x, y + 12, 72, 60);
        R(x + 6, y + 18, 60, 48, P.dark[0]); flames(x + 8, y + 48, 56, 16, t, heat);
        for (let k = 0; k < 6; k++) { const y0 = y + 24 + k * 4; line(x + 12, y0, x + 60, y0 + 10, 2, P.iron[1]); line(x + 12, y0 - 1, x + 60, y0 + 9, 1, P.iron[3]); const p = saw(t * (0.6 + heat) + k * 13, 45); px(x + 60 - p * 48, y0 + 10 - p * 10, P.water[2]); }
        box(x + 8, y + 20, 6, 28, IRONL); box(x + 58, y + 30, 6, 26, IRONL);
        R(x + 2, y + 2, 68, 12, P.iron[0]); htube(x + 7, y + 3, 58, 11, IRONL); disc(x + 7, y + 8.5, 5, P.iron[2]); disc(x + 65, y + 8.5, 5, P.iron[1]);
        gauge(x + 24, y + 8, 3.6, 0.3 + 0.5 * heat); valve(x + 48, y - 1, t);
        R(x + 30, y + 58, 12, 8, P.iron[2]); R(x + 31, y + 60, 10, 1, P.fire[heat > 0.3 ? 2 : 0]);
      } },
    { key: 'E', name: '链条炉排', ref: '维多利亚工厂锅炉的机械加煤机（链条炉排）',
      idea: '左上一只煤斗，煤块落在一条一直往右走的链条炉排上，炉排一路走、一路烧（左边黑煤、中间红炭、右边灰烬掉进灰坑）；炉排上方是锅炉筒，筒上压力表和安全阀。整台机器在「动」。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        box(x, y + 2, 72, 68, IRON);
        htube(x + 11, y + 8, 50, 18, IRONL); disc(x + 11, y + 17, 9, P.iron[2]); disc(x + 61, y + 17, 9, P.iron[1]); for (let u = 16; u < 58; u += 9) R(x + u, y + 8, 1, 18, P.iron[2]);
        gauge(x + 36, y + 17, 5, 0.3 + 0.5 * heat); valve(x + 22, y + 2, t);
        poly([[x + 3, y + 30], [x + 19, y + 30], [x + 15, y + 42], [x + 7, y + 42]], IRON); for (let k = 0; k < 5; k++) px(x + 7 + k * 2, y + 33 + (k % 2), P.dark[0]);
        R(x + 4, y + 42, 62, 16, P.dark[0]);
        const sh = (t * 0.5) % 4;
        for (let u = 0; u < 60; u += 4) { const xx = x + 5 + ((u + sh) % 60), k = (xx - x) / 66; R(xx, y + 54, 3, 2, P.iron[3]); const c = k < 0.3 ? P.dark[2] : k < 0.75 ? P.fire[heat > 0.5 && Math.sin(t * 0.3 + u) > 0 ? 3 : 2] : P.steam[0]; R(xx, y + 51, 3, 3, c); }
        flames(x + 22, y + 44, 30, 7, t, heat);
        gear(x + 7, y + 57, 3, 7, t * 0.12, IRONL); gear(x + 63, y + 57, 3, 7, t * 0.12, IRONL);
        R(x + 54, y + 60, 14, 8, P.dark[1]); R(x + 56, y + 64, 10, 3, P.steam[0]);
      } },
    { key: 'F', name: '三联锅炉组', ref: '维多利亚船用锅炉舱（多台锅炉并联）',
      idea: '三台立式锅炉肩并肩，一根黄铜总汽管把它们串起来（管上一只大压力表），每台底下一扇小炉门各自透着火光、火光一台接一台地亮；中间那台高一点。剪影是三根柱子顶一根横管。',
      draw(x, y, o) {
        const t = o.t || 0, heat = o.heat;
        R(x + 2, y + 66, 68, 6, P.iron[1]); R(x + 2, y + 66, 68, 1, P.iron[3]);
        for (const [cx, top] of [[13, 16], [36, 10], [59, 16]]) {
          vtube(x + cx - 10, y + top, 20, 66 - top, IRONL); ball(x + cx, y + top, 10, IRONL);
          for (const yy of [top + 10, 44]) { R(x + cx - 10, y + yy, 20, 2, P.brass[1]); R(x + cx - 10, y + yy, 20, 1, P.brass[3]); }
          const on = Math.sin(t * 0.08 - cx * 0.1) > -0.2; R(x + cx - 5, y + 52, 10, 9, P.iron[0]); flames(x + cx - 4, y + 53, 8, 7, t + cx, on ? heat : heat * 0.3);
        }
        htube(x + 4, y + 4, 64, 5, BRASS); gauge(x + 36, y + 6.5, 5, 0.3 + 0.5 * heat);
        for (const u of [13, 59]) R(x + u - 1, y + 8, 3, 8, P.brass[1]);
        valve(x + 60, y - 1, t);
      } },
  ];

  // ================= 大水箱 water_l（3×3 = 72×72，冷却）：水位跟着剩水量降（water 0～1）；青色只用在水上 =================
  const hoop = (x, y, w) => { R(x, y, w, 3, P.brass[0]); R(x, y, w, 2, P.brass[1]); R(x, y, w, 1, P.brass[2]); };   // 紫铜箍（沿用小水罐的语言）
  const TANKS = [
    { key: 'A', name: '大舷窗水柜', ref: '沿用已定稿小水罐 W1 的语言（大窗 + 紫铜箍）',
      idea: '方水柜正中一扇大圆舷窗（一圈螺栓），窗里的水位跟着存量降、气泡往上冒；上下两道紫铜箍，顶上注水口，右下一只出水龙头。和小水罐一眼是一家。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        box(x + 2, y + 6, 68, 60, IRON); hoop(x + 2, y + 12, 68); hoop(x + 2, y + 58, 68);
        R(x + 28, y + 1, 16, 5, P.brass[1]); R(x + 28, y + 1, 16, 1, P.brass[3]);
        ball(x + 36, y + 36, 19, BRASS); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; px(x + 36 + Math.cos(a) * 17.2, y + 36 + Math.sin(a) * 17.2, P.brass[0]); }
        g.save(); g.beginPath(); g.arc(x + 36, y + 36, 15, 0, TAU); g.clip(); water(x + 21, y + 21, 30, 30, lv, t); g.restore();
        px(x + 28, y + 26, P.glass[3]); px(x + 29, y + 25, P.glass[3]);
        R(x + 62, y + 50, 8, 4, P.brass[1]); R(x + 67, y + 53, 3, 4, P.brass[0]); if (saw(t, 60) < 0.5) px(x + 68, y + 58 + saw(t, 60) * 8, P.water[2]);
        box(x + 4, y + 66, 64, 6, IRON);
      } },
    { key: 'B', name: '水塔', ref: '维多利亚铁路的给水塔（桁架塔身 + 水柜 + 浮标液位板）',
      idea: '上半是一只铆接水柜，下半是交叉斜撑的桁架塔身（透空），柜侧一块刻度板，一根浮标拉绳吊着指针随水位上下；一根出水管从柜底垂下来。剪影里唯一透空的一种。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        box(x + 6, y + 2, 60, 32, IRON); for (let u = 12; u < 66; u += 9) R(x + u, y + 3, 1, 30, P.iron[1]); hoop(x + 6, y + 8, 60); hoop(x + 6, y + 28, 60);
        for (const u of [9, 60]) { R(x + u, y + 34, 3, 36, P.iron[3]); R(x + u, y + 34, 1, 36, P.iron[4]); }
        for (let k = 0; k < 3; k++) { const y0 = y + 36 + k * 11; line(x + 12, y0, x + 60, y0 + 10, 1, P.iron[2]); line(x + 60, y0, x + 12, y0 + 10, 1, P.iron[2]); R(x + 10, y0, 52, 1, P.iron[3]); }
        box(x + 2, y + 68, 68, 4, IRON);
        R(x + 68, y + 4, 3, 28, P.dark[0]); for (let k = 0; k <= 4; k++) R(x + 67, y + 4 + k * 7, 2, 1, P.brass[2]);
        const py = y + 4 + (1 - lv) * 26; R(x + 66, py, 5, 2, P.fire[2]); line(x + 69, y + 1, x + 69, py, 1, P.iron[3]);
        R(x + 33, y + 34, 6, 20, P.iron[1]); R(x + 34, y + 34, 2, 20, P.iron[3]); R(x + 30, y + 54, 12, 3, P.brass[1]);
        if (lv > 0.05) { const p = saw(t, 30); R(x + 35, y + 57, 2, 3 + p * 6, P.water[2]); }
        R(x + 7, y + 3, 58, 2, P.water[saw(t, 80) < 0.5 ? 1 : 2]);
      } },
    { key: 'C', name: '分舱水柜', ref: '船舶的分舱水柜（隔板 + 各舱液位管）',
      idea: '一只大柜分成三个竖舱，每舱一根高液位玻璃管；三舱不是一起降——先用左舱、再用中舱、最后用右舱，一眼看出还剩几舱水；舱底一根总管连着三只阀。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        box(x + 2, y + 2, 68, 62, IRON);
        for (let i = 0; i < 3; i++) {
          const x0 = x + 5 + i * 22, sub = Math.max(0, Math.min(1, lv * 3 - (2 - i)));
          R(x0, y + 5, 20, 56, P.iron[2]); R(x0, y + 5, 1, 56, P.iron[3]);
          R(x0 + 6, y + 9, 8, 46, P.brass[0]); water(x0 + 7, y + 10, 6, 44, sub, t + i * 30, { bubbles: sub > 0.05 });
          for (let k = 0; k < 5; k++) R(x0 + 3, y + 10 + k * 11, 2, 1, P.iron[0]);
          if (i < 2) { R(x0 + 20, y + 4, 2, 58, P.iron[0]); R(x0 + 20, y + 4, 1, 58, P.iron[3]); }
        }
        htube(x + 2, y + 63, 68, 5, IRONL); for (const u of [15, 37, 59]) { disc(x + u, y + 65.5, 2.6, P.brass[1]); px(x + u, y + 65, P.brass[3]); }
        R(x + 4, y + 68, 64, 4, P.iron[1]);
      } },
    { key: 'D', name: '玻璃冷却槽', ref: '维多利亚的玻璃水族缸 + 浸在水里的冷却盘管',
      idea: '黄铜框的大玻璃槽（四根立柱 + 上下框），水里泡着一条紫铜冷却盘管（来回弯），盘管周围不断冒气泡；水位降下来盘管就露出水面。最「看得见里面」的一种。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        water(x + 4, y + 6, 64, 58, lv, t);
        const top = y + 6 + 58 * (1 - lv);
        for (let k = 0; k < 5; k++) { const yy = y + 14 + k * 10; line(x + 10, yy, x + 62, yy, 2, P.brass[0]); line(x + 10, yy - 1, x + 62, yy - 1, 1, P.brass[2]); const ex = k % 2 ? x + 10 : x + 62; R(ex - 1, yy - 1, 2, 11, P.brass[1]); if (yy > top) for (let b = 0; b < 3; b++) { const p = saw(t + k * 7 + b * 13, 26); px(x + 16 + b * 18 + k * 3, yy - 2 - p * 6, P.water[3]); } }
        R(x + 2, y + 2, 68, 4, P.brass[1]); R(x + 2, y + 2, 68, 1, P.brass[3]); R(x + 2, y + 64, 68, 6, P.brass[0]); R(x + 2, y + 64, 68, 2, P.brass[2]);
        for (const u of [2, 35, 67]) { R(x + u, y + 2, 3, 66, P.brass[0]); R(x + u, y + 2, 1, 66, P.brass[3]); }
        for (const u of [8, 42]) { px(x + u, y + 10, P.glass[3]); px(x + u + 1, y + 9, P.glass[3]); }
      } },
    { key: 'E', name: '浮球液位箱', ref: '维多利亚水箱的浮球阀 + 大刻度盘',
      idea: '铆接方箱正面一只大半圆刻度盘，一根黄铜杠杆从箱侧的浮球室伸过来带着指针走：浮球室的观察缝里能看到浮球随水位升降，刻度盘指针同步摆。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        box(x + 2, y + 4, 68, 64, IRON); for (const [a, b] of [[5, 7], [64, 7], [5, 62], [64, 62]]) rivet(x + a, y + b);
        R(x + 50, y + 12, 14, 48, P.iron[0]); water(x + 52, y + 14, 10, 44, lv, t, { bubbles: false });
        const fy = y + 14 + 44 * (1 - lv) - 2; disc(x + 57, fy, 3.2, P.brass[1]); disc(x + 56, fy - 1, 1.4, P.brass[3]);
        g.save(); g.beginPath(); g.rect(x, y, 72, y + 40 - y); g.clip(); ball(x + 26, y + 40, 20, BRASS); disc(x + 26, y + 40, 17.5, P.steam[2]); g.restore();
        for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; line(x + 26 + Math.cos(a) * 14, y + 40 + Math.sin(a) * 14, x + 26 + Math.cos(a) * 16.5, y + 40 + Math.sin(a) * 16.5, 1, k < 2 ? P.fire[1] : P.dark[1]); }
        const a = Math.PI + lv * Math.PI; line(x + 26, y + 40, x + 26 + Math.cos(a) * 13, y + 40 + Math.sin(a) * 13, 1, P.dark[0]); disc(x + 26, y + 40, 2, P.brass[2]);
        line(x + 26, y + 40, x + 57, fy, 1, P.brass[0]);
        R(x + 6, y + 42, 42, 2, P.brass[1]); R(x + 8, y + 50, 38, 12, P.iron[2]); R(x + 10, y + 52, 34, 1, P.iron[4]);
        R(x + 4, y + 68, 64, 4, P.iron[1]);
      } },
    { key: 'F', name: '分片拼装水柜 + 蒸汽泵', ref: '布雷斯韦特分片钢水柜（方格面板 + 法兰）+ 小型蒸汽给水泵',
      idea: '水柜由九块方格钢板用法兰螺栓拼成（每块板上一道菱形压筋，最有辨识度的工业水柜），右下角一台小蒸汽给水泵的活塞来回推；柜侧一根竖液位管。',
      draw(x, y, o) {
        const t = o.t || 0, lv = o.water;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const bx = x + 2 + i * 21, by = y + 2 + j * 21; box(bx, by, 21, 21, IRONL);
          line(bx + 10.5, by + 3, bx + 18, by + 10.5, 1, P.iron[4]); line(bx + 18, by + 10.5, bx + 10.5, by + 18, 1, P.iron[2]); line(bx + 10.5, by + 18, bx + 3, by + 10.5, 1, P.iron[2]); line(bx + 3, by + 10.5, bx + 10.5, by + 3, 1, P.iron[4]);
          for (const [a, b] of [[1, 1], [18, 1], [1, 18], [18, 18]]) px(bx + a + 0.5, by + b + 0.5, P.iron[0]);
        }
        R(x + 66, y + 4, 4, 58, P.brass[0]); water(x + 67, y + 5, 2, 56, lv, t, { bubbles: false });
        const s = Math.sin(t * 0.2) * 3;
        R(x + 44, y + 58, 26, 14, P.iron[1]); box(x + 46, y + 60, 12, 8, IRONL); R(x + 58, y + 63, 5 + s, 2, P.iron[4]); R(x + 62 + s, y + 61, 2, 6, P.brass[1]);
        gauge(x + 52, y + 56, 3, 0.4 + 0.2 * Math.sin(t * 0.2));
        R(x + 2, y + 66, 42, 6, P.iron[1]);
      } },
  ];

  const MODS = [
    { id: 'boiler_l', name: '大型锅炉', w: 3, h: 3, rule: '3×3 能源 · 炉火是唯一允许发光的 · 剪影是方块，创意在内部构造 · 热度越高火越旺（页面上热度来回变）', SET: BOILER },
    { id: 'water_l', name: '大水箱', w: 3, h: 3, rule: '3×3 冷却 · 青色只用在水上 · 水位跟着剩水量降（页面上水位慢慢降再补满）· 剪影是方块，创意在内部构造', SET: TANKS },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  return { MODS, figure };
})();
