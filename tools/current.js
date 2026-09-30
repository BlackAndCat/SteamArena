// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：重做水箱 water（按档加固，保住大窗蓝水）、铲斗 bucket、撞角 spike、蒸汽撞锤 piston（都是 2×2）。
// 水箱三种加固思路 × 六档；三种撞击件各 6 种（A 是现役重画，B～F 新方向），普通 / 精英两个阶段。
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
  const RUSTR = [P.rust[0], P.rust[1], P.rust[2], P.rust[3]];
  const tierOf = (o) => Math.max(1, Math.min(6, o.mt || 1));
  const bolt = (x, y) => { px(x, y, P.iron[4]); px(x + 1, y + 1, P.iron[0]); };
  // 水体：大窗里的水（水位 lv 0～1，波纹 + 气泡），青色只在水上
  function waterBody(x0, y0, w, h, lv, t) {
    R(x0, y0, w, h, P.glass[0]);
    const lh = Math.round(h * lv), top = y0 + h - lh;
    if (lh > 0) {
      R(x0, top, w, lh, P.water[1]); R(x0, top, w, 1, P.water[3]);
      for (let i = 0; i < w; i += 7) R(x0 + ((i + Math.floor(t / 4) * 2) % (w - 2)), top + 1, 3, 1, P.water[2]);
      if (lh > 4) R(x0 + 2, top + 3, 2, lh - 5, P.water[2]);
      for (let k = 0; k < 4; k++) { const p = saw(t + k * 17, 60), by = y0 + h - 2 - p * (lh - 3); if (by > top + 1) px(x0 + 5 + k * 7, by, P.water[3]); }
    }
    px(x0 + w - 5, y0 + 3, P.glass[3]); px(x0 + w - 4, y0 + 2, P.glass[3]);
  }
  // 撞击件的车头法兰（2×2 左边贴车体）
  const flange2 = (x, y, h0 = 6, h1 = 42) => { R(x, y + h0, 6, h1 - h0, P.iron[0]); R(x + 1, y + h0 + 1, 4, h1 - h0 - 2, P.iron[2]); R(x + 1, y + h0 + 1, 1, h1 - h0 - 2, P.iron[3]); for (let v = h0 + 4; v < h1 - 2; v += 8) bolt(x + 2, y + v); };

  // ================= 水箱 water（2×2 = 48×48，冷却）：按档加固；T1 黄铜不加；越高档越结实；大窗里的蓝色水体永远是主体 =================
  // 三种加固思路，各自从 T1 画到 T6（卡片下面的材质条就是这一种的六档）
  const TANK = [
    { key: 'A', name: '箍带加固', ref: '锅炉 / 储罐的钢箍 + 拉紧螺栓 + 包角',
      idea: '外壳和大水窗不变，一档比一档多加箍带：T2 上下两道横钢箍 → T3 左右加两道竖箍（贴着窗边，不挡水） → T4 四角加三角包角板 → T5 横箍换成带拉紧螺栓的粗箍 → T6 整圈加厚法兰 + 双排螺栓。窗里的水始终是一大块蓝。',
      draw(x, y, o) {
        const T = tierOf(o);
        box(x + 19, y + 2, 10, 5, BRASS); box(x + 4, y + 6, 40, 39, IRONL); R(x + 8, y + 10, 32, 31, P.iron[0]); waterBody(x + 9, y + 11, 30, 29, o.water, o.t);
        for (const [rx, ry] of [[6, 8], [41, 8], [6, 42], [41, 42]]) bolt(x + rx, y + ry);
        if (T >= 2) for (const v of T >= 5 ? [12, 36] : [13, 37]) { const hh = T >= 5 ? 4 : 3; R(x + 3, y + v, 42, hh, P.iron[0]); R(x + 3, y + v + 1, 42, hh - 2, P.iron[3]); R(x + 3, y + v + 1, 42, 1, P.iron[4]); if (T >= 5) for (const u of [3, 42]) { R(x + u - 1, y + v - 1, 3, hh + 2, P.iron[1]); bolt(x + u, y + v + 1); } }
        if (T >= 3) for (const u of [5, 40]) { R(x + u, y + 6, 3, 39, P.iron[0]); R(x + u + 1, y + 6, 1, 39, P.iron[3]); }
        if (T >= 4) for (const [cx, cy, sx, sy] of [[4, 6, 1, 1], [44, 6, -1, 1], [4, 45, 1, -1], [44, 45, -1, -1]]) { poly([[x + cx, y + cy], [x + cx + sx * 8, y + cy], [x + cx, y + cy + sy * 8]], IRON); bolt(x + cx + sx * 2, y + cy + sy * 2); }
        if (T >= 6) { R(x + 2, y + 4, 44, 2, P.iron[0]); R(x + 2, y + 45, 44, 2, P.iron[0]); for (let u = 6; u < 44; u += 5) { bolt(x + u, y + 4); bolt(x + u, y + 45); } }
      } },
    { key: 'B', name: '护笼加固', ref: '机车水柜的护栏 + 角钢框架',
      idea: '水箱外面一档比一档多一层角钢护笼：T2 四角护角 → T3 上下两根护栏 → T4 窗两边各一根竖护条 → T5 四角加斜撑 → T6 整只角钢笼 + 窗前两根细护栏（只挡两条细线，水还是满窗的蓝）。',
      draw(x, y, o) {
        const T = tierOf(o);
        box(x + 19, y + 2, 10, 5, BRASS); box(x + 5, y + 7, 38, 37, IRONL); R(x + 9, y + 11, 30, 29, P.iron[0]); waterBody(x + 10, y + 12, 28, 27, o.water, o.t);
        const ang = (x0, y0, w, h) => { R(x0, y0, w, h, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, h - 2, P.iron[2]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); };
        if (T >= 2) for (const [u, v] of [[3, 5], [39, 5], [3, 39], [39, 39]]) { ang(x + u, y + v, 6, 3); ang(x + u + (u < 20 ? 0 : 3), y + v, 3, 6); }
        if (T >= 3) { ang(x + 3, y + 4, 42, 3); ang(x + 3, y + 43, 42, 3); }
        if (T >= 4) for (const u of [7, 38]) ang(x + u, y + 7, 3, 37);
        if (T >= 5) for (const [a, b, c2, d2] of [[4, 8, 9, 13], [44, 8, 39, 13], [4, 42, 9, 37], [44, 42, 39, 37]]) { line(x + a, y + b, x + c2, y + d2, 2, P.iron[0]); line(x + a, y + b, x + c2, y + d2, 1, P.iron[3]); }
        if (T >= 6) { for (const u of [1, 45]) ang(x + u, y + 3, 3, 44); for (const v of [20, 30]) { R(x + 10, y + v, 28, 1, P.iron[0]); px(x + 10, y + v, P.iron[4]); } for (const u of [2, 46]) for (let v = 8; v < 44; v += 6) bolt(x + u, y + v); }
      } },
    { key: 'C', name: '装甲窗框', ref: '舰船舷窗的厚装甲框（窗框一档比一档厚、铆钉一档比一档多）',
      idea: '加固都加在大水窗的框上：T2 铆接窗框 → T3 窗框外再压一圈螺栓压板 → T4 箱体两侧加装甲侧板 → T5 侧板上加竖筋 → T6 整只阶梯形装甲外壳、一圈粗螺栓头。窗只缩一点点，水还是一大块蓝。',
      draw(x, y, o) {
        const T = tierOf(o), inset = [0, 0, 0, 1, 2, 2, 3][T];
        box(x + 19, y + 2, 10, 5, BRASS); box(x + 4, y + 6, 40, 39, IRONL);
        if (T >= 4) for (const u of [2, 41]) { box(x + u, y + 8, 5, 35, IRON); if (T >= 5) for (let v = 12; v < 40; v += 6) R(x + u + 1, y + v, 3, 1, P.iron[4]); }
        if (T >= 6) { box(x + 4, y + 4, 40, 4, IRON); box(x + 4, y + 43, 40, 4, IRON); for (let u = 7; u < 43; u += 6) { disc(x + u, y + 6, 1.2, P.iron[4]); disc(x + u, y + 45, 1.2, P.iron[4]); } }
        const fx0 = x + 8 + inset, fy0 = y + 10 + inset, fw = 32 - inset * 2, fh = 31 - inset * 2;
        R(fx0, fy0, fw, fh, P.iron[0]);
        if (T >= 2) { R(fx0 - 2, fy0 - 2, fw + 4, 2, P.iron[3]); R(fx0 - 2, fy0 + fh, fw + 4, 2, P.iron[1]); R(fx0 - 2, fy0, 2, fh, P.iron[3]); R(fx0 + fw, fy0, 2, fh, P.iron[1]); for (let u = 2; u < fw; u += 5) { bolt(fx0 + u, fy0 - 2); bolt(fx0 + u, fy0 + fh); } }
        if (T >= 3) for (const [u, v] of [[-3, -3], [fw + 1, -3], [-3, fh + 1], [fw + 1, fh + 1]]) { R(fx0 + u, fy0 + v, 3, 3, P.iron[0]); px(fx0 + u + 1, fy0 + v + 1, P.iron[4]); }
        waterBody(fx0 + 1, fy0 + 1, fw - 2, fh - 2, o.water, o.t);
      } },
  ];

  // ================= 铲斗 bucket（2×2 撞击层，装在底盘正前方）：锈钢色，左边贴车头，工作面朝右 =================
  // 精英档（T5 起）每种都多一样东西：黄铜箍 / 液压缸 / 加长的齿
  const BUCKET = [
    { key: 'A', name: '推土铲', ref: '（现役重画）弧形推土板 + 刃口 + 推臂',
      idea: '一块又高又弯的推土板（竖着的弧面，内侧暗、外侧亮），下沿一道亮钢刃口，两根推臂从车头伸出来顶着它；精英档加一只倾斜液压缸和三道黄铜箍。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 14, 46);
        for (const v of [18, 40]) { line(x + 5, y + v, x + 30, y + v - 2, 4, P.iron[0]); line(x + 5, y + v, x + 30, y + v - 2, 2, P.iron[3]); }
        for (let yy = 2; yy <= 46; yy++) { const k = (yy - 2) / 44, off = Math.round(7 * Math.sin(Math.PI * k)), x0 = x + 33 - off; R(x0 - 1, y + yy, 8, 1, P.rust[0]); R(x0, y + yy, 6, 1, P.rust[1]); R(x0 + 4, y + yy, 2, 1, P.rust[2]); px(x0 + 5, y + yy, P.rust[3]); }
        R(x + 36, y + 44, 9, 3, P.iron[3]); R(x + 36, y + 44, 9, 1, P.iron[4]);
        if (st) { line(x + 6, y + 10, x + 26, y + 12, 4, P.iron[0]); line(x + 6, y + 10, x + 18, y + 11, 2, P.brass[1]); line(x + 18, y + 11, x + 26, y + 12, 1, P.iron[4]); for (const v of [12, 24, 36]) { const k = (v - 2) / 44, x0 = x + 32 - Math.round(7 * Math.sin(Math.PI * k)); R(x0, y + v, 8, 2, P.brass[1]); R(x0, y + v, 8, 1, P.brass[3]); } }
      } },
    { key: 'B', name: '挖掘斗', ref: '新：挖掘机的铲斗（C 形斗 + 一排斗齿 + 斗杆 + 液压缸）',
      idea: '一只 C 形的挖掘斗口朝前下方，斗口一排尖斗齿，斗背连着斗杆，斗杆上一只液压缸；读起来就是「挖」。精英档齿更长、斗背加一道黄铜加强筋。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 6, 40);
        line(x + 6, y + 16, x + 24, y + 12, 5, P.iron[0]); line(x + 6, y + 16, x + 24, y + 12, 3, P.iron[3]);
        line(x + 6, y + 30, x + 20, y + 20, 4, P.iron[0]); line(x + 6, y + 30, x + 14, y + 24, 2, P.brass[1]); line(x + 14, y + 24, x + 20, y + 20, 1, P.iron[4]);
        shape((xx, yy) => { const d = Math.hypot(xx - x - 30, yy - y - 24); return d <= 17 && d >= 11 && !(xx > x + 32 && yy > y + 14 && yy < y + 38); }, x + 12, y + 6, x + 48, y + 42, RUSTR);
        for (const b of [0.62, 0.86, 1.1]) { const bx = x + 30 + Math.cos(b) * 15, by = y + 24 + Math.sin(b) * 15, L = st ? 8 : 6; poly([[bx - 1, by - 2], [bx + 1, by + 2], [bx + Math.cos(b - 1.1) * L, by + Math.sin(b - 1.1) * L + 1]], IRONL); }   // 斗齿：长在斗口下唇上，朝前下方
        if (st) { for (let k = 0; k < 16; k++) { const a = Math.PI * (0.55 + k / 16 * 1.1); px(x + 30 + Math.cos(a) * 16, y + 24 + Math.sin(a) * 16, P.brass[2]); } }
      } },
    { key: 'C', name: '蒸汽铲斗', ref: '新：马里恩蒸汽挖掘机的铲斗（方斗 + 带铰链的斗底门 + 斗杆）',
      idea: '一只方方正正的铆接铁斗，斗口一排齿朝前，斗底一扇带铰链和门闩的活门（倒土用），斗背一根粗斗杆伸回车头。维多利亚工地的样子，最「蒸汽」。精英档斗身加黄铜包边和双斗杆。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 8, 42);
        line(x + 6, y + 14, x + 22, y + 16, 5, P.iron[0]); line(x + 6, y + 14, x + 22, y + 16, 3, P.iron[3]); if (st) { line(x + 6, y + 34, x + 22, y + 32, 4, P.iron[0]); line(x + 6, y + 34, x + 22, y + 32, 2, P.iron[3]); }
        box(x + 20, y + 8, 20, 32, RUSTR); for (let v = 12; v < 38; v += 5) { px(x + 22, y + v, P.rust[3]); px(x + 37, y + v, P.rust[0]); }
        R(x + 21, y + 38, 18, 2, P.iron[1]); R(x + 22, y + 39, 3, 2, P.iron[3]); R(x + 34, y + 39, 3, 2, P.iron[3]);
        for (let v = 10; v <= 36; v += 6) poly([[x + 40, y + v], [x + 46, y + v + 2], [x + 40, y + v + 4]], IRONL);
        if (st) { R(x + 20, y + 8, 20, 2, P.brass[1]); R(x + 20, y + 8, 20, 1, P.brass[3]); R(x + 38, y + 8, 2, 32, P.brass[1]); }
      } },
    { key: 'D', name: '犁铧', ref: '新：蒸汽犁的犁铧（后仰的犁壁 + 前伸的犁尖 + 底下的滑靴）',
      idea: '一块往后仰的扭曲犁壁（上宽下窄、斜着切过去），底下一只尖尖的犁尖往前探，犁尖后面一只滑靴贴地；像蒸汽犁的铧子，冲过去是把对手「翻起来」。精英档加第二道犁壁（双铧）。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 6, 44);
        const share = (dx) => { poly([[x + 14 + dx, y + 4], [x + 24 + dx, y + 4], [x + 42 + dx, y + 42], [x + 30 + dx, y + 44], [x + 20 + dx, y + 30]], RUSTR); line(x + 24 + dx, y + 5, x + 41 + dx, y + 41, 1, P.rust[3]); };
        if (st) share(-8);
        share(0);
        poly([[x + 28, y + 40], [x + 46, y + 44], [x + 30, y + 46]], IRONL); R(x + 14, y + 44, 16, 3, P.iron[1]); R(x + 14, y + 44, 16, 1, P.iron[3]);
        line(x + 6, y + 20, x + 20, y + 20, 3, P.iron[0]); line(x + 6, y + 20, x + 20, y + 20, 1, P.iron[3]);
      } },
    { key: 'E', name: '排障器', ref: '新：蒸汽机车的排障器（「牛拦」，一排斜着的铁条）',
      idea: '机车车头那种排障器：一排斜着往前伸的铁条，上面一道横梁、底下贴地一道刃，整片是镂空的（能看见后面）；冲过去是「铲开挡路的东西」。美国西部机车的标志，一眼认出。精英档横梁换黄铜、铁条加密。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        R(x + 6, y + 6, 12, 4, st ? P.brass[1] : P.iron[1]); R(x + 6, y + 6, 12, 1, st ? P.brass[3] : P.iron[3]);
        const n = st ? 8 : 6;
        for (let k = 0; k < n; k++) { const top = y + 8 + k * (34 / n); line(x + 14, top, x + 44, y + 44, 2, P.rust[1]); line(x + 14, top - 1, x + 44, y + 43, 1, P.rust[3]); }
        line(x + 12, y + 8, x + 44, y + 44, 3, P.rust[0]); R(x + 12, y + 44, 34, 3, P.iron[0]); R(x + 12, y + 44, 34, 1, P.iron[4]);
        line(x + 6, y + 30, x + 16, y + 34, 3, P.iron[0]);
      } },
    { key: 'F', name: '抓斗', ref: '新：港口起重机的蚌壳抓斗（两片弧形斗瓣，撞上去时合拢）',
      idea: '两片弧形的蚌壳斗瓣挂在一副铰链架上，平时张开，撞到东西就「咔」地合拢（页面上一开一合）；斗瓣边上一排齿。像港口吊煤的抓斗，最有「抓住」的感觉。精英档加一只合拢液压缸。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5, cl = 0.5 + 0.5 * Math.sin(o.t * 0.08); flange2(x, y, 10, 38);
        line(x + 6, y + 24, x + 22, y + 24, 5, P.iron[0]); line(x + 6, y + 24, x + 22, y + 24, 3, P.iron[3]); disc(x + 22, y + 24, 3, P.iron[1]); px(x + 21, y + 23, P.iron[4]);
        for (const s of [-1, 1]) {
          const a0 = s * (0.25 + (1 - cl) * 0.5);
          shape((xx, yy) => { const dx = xx - x - 22, dy = yy - y - 24, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx); return r >= 8 && r <= 22 && (s > 0 ? a >= a0 && a <= a0 + 0.9 : a <= a0 && a >= a0 - 0.9) && dx * Math.cos(a0) + dy * Math.sin(a0) > 7; }, x + 22, y, x + 48, y + 48, RUSTR);
          const tx = x + 22 + Math.cos(a0 + s * 0.9) * 22, ty = y + 24 + Math.sin(a0 + s * 0.9) * 22; R(tx - 1, ty - 1, 3, 3, P.iron[4]);
          const mx = x + 22 + Math.cos(a0 + s * 0.45) * 15, my = y + 24 + Math.sin(a0 + s * 0.45) * 15; line(x + 22, y + 24, mx, my, 3, P.iron[0]); line(x + 22, y + 24, mx, my, 1, P.iron[3]);   // 斗瓣的吊臂：从铰链连到瓣背
        }
        if (st) { R(x + 10, y + 14, 10, 4, P.brass[1]); R(x + 10, y + 14, 10, 1, P.brass[3]); line(x + 20, y + 16, x + 24, y + 18, 1, P.iron[4]); }
      } },
  ];

  // ================= 撞角 spike（2×2 撞击层，装在装甲或底盘正前方）：锈钢色，实心、重 =================
  const SPIKE = [
    { key: 'A', name: '锥形撞角', ref: '（现役重画）实心锥 + 底座 + 黄铜箍',
      idea: '一只又粗又长的实心锈钢锥从铆接底座里伸出来，锥身一道道锻打的暗纹，尖上一点淬硬的亮钢；底座一道黄铜箍。精英档锥上刻螺旋槽、加第二道箍。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 6, 42); box(x + 6, y + 10, 8, 28, BRASS);
        for (let i = 0; i <= 33; i++) { const hh = Math.round(13 * (1 - i / 34)), cx = x + 14 + i; R(cx, y + 24 - hh, 1, hh * 2 + 1, P.rust[0]); if (hh > 0) { R(cx, y + 25 - hh, 1, hh, P.rust[2]); R(cx, y + 25, 1, hh - 1, P.rust[1]); px(cx, y + 25 - hh, P.rust[3]); } if (i % 7 === 3 && hh > 2) R(cx, y + 25 - hh, 1, hh * 2 - 1, P.rust[1]); }
        for (let i = 29; i <= 33; i++) R(x + 14 + i, y + 24, 1, 1, P.iron[4]);
        if (st) { for (let i = 2; i <= 26; i += 5) { const hh = Math.round(13 * (1 - i / 34)); line(x + 14 + i, y + 26 - hh, x + 14 + i + Math.round(hh * 0.5), y + 23 + hh, 1, P.rust[0]); } box(x + 12, y + 8, 4, 32, BRASS); }
      } },
    { key: 'B', name: '舰艏撞角', ref: '新：铁甲舰的舰艏撞角（上面斜坡、下面平直的「鸟嘴」）',
      idea: '像铁甲舰水线下的撞角：上沿一道长长的斜坡、下沿平直，最前面是一只往前探的「鸟嘴」，整只铆满一排排铆钉，侧面一道加强筋；读起来是「船头撞过去」。精英档嘴尖包一块亮钢、加第二排铆钉。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        poly([[x + 6, y + 6], [x + 20, y + 8], [x + 46, y + 30], [x + 47, y + 34], [x + 40, y + 38], [x + 6, y + 42]], RUSTR);
        line(x + 8, y + 26, x + 42, y + 34, 1, P.rust[3]); line(x + 8, y + 27, x + 42, y + 35, 1, P.rust[0]);
        for (let u = 10; u < 40; u += 4) { const yy = y + 8 + (u - 6) * 0.62 + 3; px(x + u, yy, P.rust[3]); if (st) px(x + u, y + 38, P.rust[3]); }
        if (st) poly([[x + 40, y + 29], [x + 47, y + 32], [x + 47, y + 34], [x + 41, y + 37]], IRONL);
      } },
    { key: 'C', name: '钻矛', ref: '新（把现役精英档的螺旋槽单独做成一种）：粗螺旋钻头',
      idea: '一根锥形的钻矛，身上一圈圈斜着的螺旋刃（像巨大的钻头），根部一只齿轮箱；撞上去时钻矛在转（螺旋纹一直往前走）。精英档齿轮箱加黄铜盖、刃口加亮钢。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 8, 40); box(x + 6, y + 12, 10, 24, IRONL); if (st) { R(x + 6, y + 12, 10, 3, P.brass[1]); R(x + 6, y + 12, 10, 1, P.brass[3]); }
        const ph = (o.t * 0.4) % 6;
        for (let i = 0; i <= 31; i++) { const hh = Math.round(11 * (1 - i / 32)), cx = x + 16 + i; R(cx, y + 24 - hh, 1, hh * 2 + 1, P.rust[1]); px(cx, y + 24 - hh, P.rust[3]); px(cx, y + 24 + hh, P.rust[0]); }
        for (let k = -1; k < 7; k++) { const u0 = k * 6 + ph; for (let s = -11; s <= 11; s++) { const i = Math.round(u0 + s * 0.45); const hh = 11 * (1 - i / 32); if (i < 0 || i > 31 || Math.abs(s) > hh) continue; px(x + 16 + i, y + 24 + s, s < 0 ? (st ? P.iron[4] : P.rust[3]) : P.rust[0]); } }
      } },
    { key: 'D', name: '三叉撞角', ref: '新：三根并排的撞刺（中间长、上下短，像三叉戟）',
      idea: '一块铆接的叉座上伸出三根实心撞刺：中间一根最长，上下两根短一点、微微外张，像一把三叉戟平着伸出去；叉座一道黄铜箍。精英档三根刺尖都包亮钢、叉座加一圈螺栓。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 6, 42); box(x + 6, y + 8, 12, 32, RUSTR); R(x + 12, y + 8, 2, 32, P.brass[1]);
        for (const [v, len, tilt] of [[24, 30, 0], [13, 22, -3], [35, 22, 3]]) {
          for (let i = 0; i <= len; i++) { const hh = Math.max(0, Math.round(4 * (1 - i / (len + 1)))), cx = x + 18 + i, cy = y + v + Math.round(tilt * i / len); R(cx, cy - hh, 1, hh * 2 + 1, P.rust[1]); px(cx, cy - hh, P.rust[3]); px(cx, cy + hh, P.rust[0]); }
          if (st) { const cx = x + 18 + len, cy = y + v + tilt; R(cx - 3, cy - 1, 4, 3, P.iron[4]); }
        }
        if (st) for (const v of [10, 38]) for (let u = 8; u < 18; u += 3) px(x + u, y + v, P.iron[4]);
      } },
    { key: 'E', name: '楔形破甲锥', ref: '新：一节节叠起来的阶梯形破甲楔（越往前越窄）',
      idea: '四节厚钢板一节比一节窄地叠在一起，最前面一只硬质合金楔尖；每节之间一道焊缝和一排螺栓。剪影是一只「阶梯形的楔子」，读起来是破甲、专门啃装甲。精英档楔尖换亮钢、每节加一道筋。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        const steps = [[6, 4, 40], [16, 9, 30], [25, 13, 22], [33, 17, 14]];
        for (const [u, v, h] of steps) { box(x + u, y + v, 11, h, RUSTR); for (let k = 3; k < h - 2; k += 5) px(x + u + 2, y + v + k, P.iron[4]); if (st) R(x + u + 1, y + v + h / 2, 9, 1, P.rust[3]); }
        poly([[x + 44, y + 17], [x + 48, y + 24], [x + 44, y + 31]], st ? IRONL : RUSTR);
      } },
    { key: 'F', name: '钉锤头', ref: '新：一只满身尖钉的铁球锤头装在短粗的梁上（晨星锤）',
      idea: '一根短粗的铆接梁从车头伸出来，梁头是一只铁球，球上一圈尖钉朝四面八方；冲过去就是「砸 + 扎」。剪影是一颗带刺的球，和别的撞击件都不一样。精英档球上加一道黄铜箍、钉尖包亮钢。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 10, 38);
        box(x + 6, y + 19, 20, 10, RUSTR); for (const u of [10, 18]) R(x + u, y + 19, 2, 10, P.iron[1]);
        const C = [x + 34, y + 24];
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.3; if (Math.cos(a) < -0.6) continue; const bx = C[0] + Math.cos(a) * 8, by = C[1] + Math.sin(a) * 8, ex = C[0] + Math.cos(a) * 14, ey = C[1] + Math.sin(a) * 14; line(bx, by, ex, ey, 2, P.rust[0]); px(ex, ey, st ? P.iron[4] : P.rust[3]); }
        ball(C[0], C[1], 9, RUSTR); px(C[0] - 4, C[1] - 4, P.rust[3]);
        if (st) { R(C[0] - 9, C[1] - 1, 18, 2, P.brass[1]); R(C[0] - 9, C[1] - 1, 18, 1, P.brass[3]); }
      } },
  ];

  // ================= 蒸汽撞锤 piston（2×2 撞击层）：贴身时每 1.5 秒蒸汽活塞猛击一次；o.p = 活塞伸出 0～1 =================
  const RAMH = [
    { key: 'A', name: '单缸撞锤', ref: '（现役重画）气缸 + 活塞杆 + 锤头',
      idea: '一只黄铜箍的大气缸，一根粗活塞杆猛地推出一块铆接锤头；打击时气缸尾部喷一口白汽。精英档气缸加散热片和压力表、锤面镶钉。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 8, 40); box(x + 6, y + 12, 20, 24, IRONL); for (const u of [10, 20]) R(x + u, y + 12, 2, 24, P.brass[1]);
        if (st) { for (let v = 15; v < 34; v += 3) R(x + 7, y + v, 18, 1, P.iron[1]); gauge(x + 16, y + 10, 3, 0.7); }
        const e = 2 + o.p * 12; R(x + 26, y + 21, e, 6, P.iron[0]); R(x + 26, y + 22, e, 3, P.iron[4]);
        box(x + 26 + e, y + 8, 10, 32, RUSTR); for (const v of [12, 22, 32]) px(x + 29 + e, y + v, P.rust[3]); if (st) for (const v of [11, 19, 27, 35]) { disc(x + 32 + e, y + v, 1.3, P.iron[0]); px(x + 31 + e, y + v - 1, P.iron[4]); }
      },
      fx(x, y, o) { if (o.p > 0.5) puff(x + 8, y + 12, o.t, 3, 8); } },
    { key: 'B', name: '双缸撞锤', ref: '新：上下两只气缸一起推一块大锤面',
      idea: '上下两只并排的气缸（中间一根黄铜汇流管），两根活塞杆一起推一整块又高又厚的锤面；锤面上一道横筋。力量感最强，剪影是「两根杆 + 一面墙」。精英档锤面换成带尖的破甲面。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        for (const v of [6, 28]) { box(x + 6, y + v, 20, 14, IRONL); R(x + 10, y + v, 2, 14, P.brass[1]); R(x + 20, y + v, 2, 14, P.brass[1]); }
        R(x + 14, y + 20, 4, 8, P.brass[0]); R(x + 15, y + 20, 1, 8, P.brass[3]);
        const e = 2 + o.p * 11;
        for (const v of [11, 33]) { R(x + 26, y + v, e, 4, P.iron[0]); R(x + 26, y + v + 1, e, 2, P.iron[4]); }
        box(x + 26 + e, y + 3, 9, 42, RUSTR); R(x + 27 + e, y + 23, 7, 2, P.rust[3]);
        if (st) poly([[x + 35 + e, y + 6], [x + 41 + e, y + 24], [x + 35 + e, y + 42]], RUSTR);
      } },
    { key: 'C', name: '蒸汽锻锤', ref: '新：内史密斯蒸汽锻锤横过来（门字形机架 + 滑道里的锤头）',
      idea: '一副门字形的铸铁机架横着装在车头，机架中间一条滑道，一只沉重的锤头（带锤砧形的锤面）沿滑道被蒸汽缸推出去；机架上一只小阀门。工厂锻锤的样子，最「工业」。精英档机架加黄铜铭牌和双导柱。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        box(x + 6, y + 4, 34, 6, IRONL); box(x + 6, y + 38, 34, 6, IRONL); box(x + 6, y + 10, 8, 28, IRONL);
        if (st) { R(x + 16, y + 5, 10, 4, P.brass[1]); R(x + 17, y + 6, 8, 2, P.brass[3]); for (const v of [12, 34]) R(x + 14, y + v, 26, 2, P.iron[3]); }
        R(x + 14, y + 22, 4, 4, P.brass[1]); line(x + 14, y + 20, x + 18, y + 20, 1, P.iron[3]);
        const e = o.p * 12; R(x + 14, y + 23, 4 + e, 2, P.iron[4]);
        box(x + 18 + e, y + 13, 12, 22, RUSTR); poly([[x + 30 + e, y + 15], [x + 36 + e, y + 13], [x + 36 + e, y + 35], [x + 30 + e, y + 33]], IRONL);
      },
      fx(x, y, o) { if (o.p > 0.5) puff(x + 16, y + 20, o.t, 2, 6); } },
    { key: 'D', name: '曲柄冲杆', ref: '新：蒸汽机的曲柄连杆（飞轮 + 连杆 + 十字头推着撞杆）',
      idea: '车头一只带辐条的飞轮，一根连杆从飞轮的曲柄销连到十字头，十字头在滑道里推着撞杆一进一出，杆头是一块锈钢撞头。机构全都看得见，飞轮转一圈撞一下，动起来最好看。精英档飞轮换黄铜、加平衡块。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 4, 44);
        const a = o.p * Math.PI, C = [x + 15, y + 24], cp = [C[0] + Math.cos(Math.PI - a) * 7, C[1] - Math.sin(Math.PI - a) * 7];
        disc(C[0], C[1], 10, st ? P.brass[0] : P.iron[0]); disc(C[0], C[1], 9, st ? P.brass[1] : P.iron[2]); disc(C[0], C[1], 7, P.dark[1]);
        for (let k = 0; k < 6; k++) { const b = k / 6 * TAU + a; line(C[0], C[1], C[0] + Math.cos(b) * 8, C[1] + Math.sin(b) * 8, 1, st ? P.brass[2] : P.iron[3]); }
        if (st) { const b = Math.PI - a + Math.PI; disc(C[0] + Math.cos(b) * 5, C[1] - Math.sin(b) * 5, 2.5, P.iron[1]); }
        disc(C[0], C[1], 2, P.iron[4]);
        const xh = C[0] + 7 * Math.cos(Math.PI - a) + 14 + 6, xc = x + 26 + o.p * 12;
        R(x + 24, y + 19, 18, 1, P.iron[3]); R(x + 24, y + 29, 18, 1, P.iron[3]);
        line(cp[0], cp[1], xc, y + 24, 2, P.iron[4]); disc(cp[0], cp[1], 1.5, P.brass[2]);
        box(xc - 2, y + 20, 5, 9, IRONL); R(xc + 3, y + 23, 6, 3, P.iron[4]); box(xc + 9, y + 12, 7, 24, RUSTR);
      } },
    { key: 'E', name: '伸缩套筒锤', ref: '新：三节套筒一节套一节地伸出去（多级液压缸）',
      idea: '一只粗缸里套着一节比一节细的三节套筒，打击时三节依次伸出去、把锤头送得很远（射程最长的样子），每节套筒口一道黄铜环；平时全缩在缸里，只露锤头。精英档锤头换带尖的楔面。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 8, 40); box(x + 6, y + 12, 18, 24, IRONL); R(x + 22, y + 12, 2, 24, P.brass[1]);
        let xx = x + 24; const e = o.p * 7;
        for (const [hh, k] of [[9, 0], [7, 1], [5, 2]]) { const len = 2 + e; R(xx, y + 24 - hh, len, hh * 2, P.iron[0]); R(xx, y + 25 - hh, len, hh * 2 - 2, P.iron[3]); R(xx, y + 25 - hh, len, 1, P.iron[4]); R(xx + len - 1, y + 24 - hh, 1, hh * 2, P.brass[1]); xx += len; }
        box(xx, y + 10, 8, 28, RUSTR); if (st) poly([[xx + 8, y + 12], [xx + 13, y + 24], [xx + 8, y + 36]], RUSTR);
      } },
    { key: 'F', name: '凿岩锤', ref: '新：隧道用的凿岩机（气锤机身 + 长钎杆 + 凿尖）',
      idea: '一台隧道凿岩机横着装在车头：粗壮的气锤机身（一圈散热环 + 进气管），前面伸出一根长钎杆，杆头一只尖凿；打击时钎杆一下一下往前「突突」地凿，尖头一闪。和其它撞锤不一样的「尖」。精英档机身加黄铜进气阀和双钎。',
      draw(x, y, o) {
        const st = tierOf(o) >= 5; flange2(x, y, 10, 38);
        box(x + 6, y + 15, 18, 18, IRONL); for (let u = 9; u < 22; u += 3) { R(x + u, y + 13, 1, 22, P.iron[3]); }
        line(x + 10, y + 13, x + 10, y + 6, 2, P.iron[2]); if (st) { R(x + 8, y + 5, 5, 3, P.brass[1]); R(x + 8, y + 5, 5, 1, P.brass[3]); }
        const e = o.p * 8, rows = st ? [21, 27] : [24];
        for (const v of rows) { R(x + 24, y + v - 1, 16 + e, 3, P.iron[0]); R(x + 24, y + v, 16 + e, 1, P.iron[4]); poly([[x + 40 + e, y + v - 3], [x + 47 + e, y + v], [x + 40 + e, y + v + 3]], RUSTR); }
        R(x + 24, y + 20, 3, 8, P.iron[1]);
      },
      fx(x, y, o) { if (o.p > 0.7) { px(x + 48 + o.p * 8, y + 23, P.white); px(x + 49 + o.p * 8, y + 25, P.fire[3]); } } },
  ];

  const MODS = [
    { id: 'water', name: '水箱 · 按档加固', w: 2, h: 2, tiers: [1, 2, 3, 4, 5, 6], perTier: true, SET: TANK,
      rule: '2×2 · 开局 · 冷却 · 用户：主要是加固（加强铁箍或别的办法），让水箱更结实；黄铜的（T1）不用加；越高档越结实；但一定保住整个大窗里的蓝色水体 · 三种加固思路，下面材质条就是这一种从 T1 到 T6 的样子 · 页面上水位慢慢降再补满',
      state: (t) => ({ t, water: 1 - ((t % 400) / 400) * 0.9 }), poses: [{ water: 1, label: '满' }, { water: 0.6, label: '六成' }, { water: 0.25, label: '两成半' }, { water: 0.05, label: '快干' }] },
    { id: 'bucket', name: '铲斗', w: 2, h: 2, tiers: [1, 5], SET: BUCKET,
      rule: '2×2 撞击层 · 开局 · 装在底盘正前方（履带 / 四足 / 双足）· 撞击件一律锈钢色，左边法兰贴车头、工作面朝右 · 结实、能把对手铲退很远 · 两个阶段：普通 / 精英（T5 起多一样东西）',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 20, label: '' }, { t: 40, label: '' }, { t: 60, label: '' }] },
    { id: 'spike', name: '撞角', w: 2, h: 2, tiers: [1, 5], SET: SPIKE,
      rule: '2×2 撞击层 · 第三章 · 装在装甲或底盘正前方 · 实心、很重，伤害随撞击速度和车重暴涨 · 锈钢色，左边法兰贴车头、尖朝右 · 两个阶段：普通 / 精英',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 5, label: '' }, { t: 10, label: '' }, { t: 15, label: '' }] },
    { id: 'piston', name: '蒸汽撞锤', w: 2, h: 2, tiers: [1, 5], SET: RAMH,
      rule: '2×2 撞击层 · 第三章 · 贴身时每 1.5 秒用蒸汽活塞猛击一次 · 锈钢色锤头，左边法兰贴车头、往右打 · 页面循环：待机 → 猛地打出 → 收回 · 两个阶段：普通 / 精英',
      state: (t) => { const c = t % 40; return { t, p: c < 4 ? c / 4 : c < 14 ? 1 - (c - 4) / 10 : 0 }; },
      poses: [{ p: 0, label: '收' }, { p: 0.5, label: '半伸' }, { p: 1, label: '打出' }, { p: 1, t: 20, label: '打出（另一帧）' }] },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, m) { g = ctx; if (e.fx) e.fx(x, y, o); else if (m && m.fx) m.fx(x, y, o); }
  return { MODS, figure, over, LINEUP: [] };
})();
