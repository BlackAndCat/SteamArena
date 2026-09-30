// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：鱼叉 harpoon、蒸汽喷射器 steamjet（只做 T1～T3）、喷火器 flamer（只做 T4～T6）、火箭架 rocket_rack。
// 每种 6 个：A～C 是 2026-09-27 夜间候选 v1（tools/cand-mid.js）按现在的画法重画，D～F 是新方向。转动部分按游戏的耳轴 / 炮口几何画；特效（汽、火、烟）画在材质层之后。
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


  // ================= 转动炮组 + 特效小工具 =================
  // 转动：先在离屏按「水平」画好（支点落在 (60,50)），再绕支点转到仰角 a（度，向上为正）贴回来；最近邻，保持像素风（和游戏 sprites.js turn 一样）
  const layer = document.createElement('canvas'); layer.width = 140; layer.height = 100;
  function turn(px0, py0, a, fn) {
    const main = g, lg = layer.getContext('2d'); lg.clearRect(0, 0, 140, 100); g = lg; fn(60, 50); g = main;
    main.save(); main.imageSmoothingEnabled = false; main.translate(Math.round(px0), Math.round(py0)); main.rotate(-(a || 0) * Math.PI / 180); main.drawImage(layer, -60, -50); main.restore();
  }
  // 炮组上 (u, v) 点（沿炮管 u、垂直 v，向下为正）在世界里的位置
  const at = (px0, py0, a, u, v = 0) => { const r = (a || 0) * Math.PI / 180; return [px0 + Math.cos(r) * u + Math.sin(r) * v, py0 - Math.sin(r) * u + Math.cos(r) * v]; };
  const ROPE = [P.leather[0], P.leather[1], P.leather[2]];
  // 下垂的绳子：两点之间一条抛物线，每隔 2 像素一个亮点（麻绳的捻纹）
  function rope(x0, y0, x1, y1, sag = 4) {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const k = i / n, xx = x0 + (x1 - x0) * k, yy = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag; px(xx, yy, i % 3 ? ROPE[1] : ROPE[2]); }
  }
  // 鱼叉头：叉尖在 X0 + 8，两道倒钩往后翻
  function barbHead(X0, Y) {
    R(X0 - 2, Y - 1, 4, 2, P.iron[3]); R(X0 - 2, Y - 1, 4, 1, P.iron[4]);
    poly([[X0 + 1, Y - 3.5], [X0 + 8.5, Y], [X0 + 1, Y + 3.5]], IRONL);
    line(X0 + 1, Y - 3, X0 - 2, Y - 5, 1, P.iron[3]); line(X0 + 1, Y + 3, X0 - 2, Y + 5, 1, P.iron[2]);
  }
  // 红色警示带（饱和色，材质层不换）
  const warn = (x, y, w, h) => { R(x, y, w, h, P.fire[0]); for (let u = 0; u < w; u += 3) R(x + u, y, 1, h, P.fire[1]); R(x, y, w, 1, P.fire[1]); };
  // 喷口火焰：从 (x,y) 沿角度 a 喷出的锥形火（材质层之后画）
  function flameJet(x, y, a, len, t) {
    const r = a * Math.PI / 180, cx = Math.cos(r), cy = -Math.sin(r);
    for (let i = 0; i < len; i++) {
      const w = 1 + i * 0.28, k = i / len, jit = Math.sin(i * 0.9 + t * 0.7) * (0.6 + k * 1.6);
      for (let s = -w; s <= w; s += 1) {
        const e = Math.abs(s) / w, col = k > 0.85 ? (e < 0.5 ? P.fire[1] : P.fire[0]) : e < 0.35 ? (k < 0.35 ? P.white : P.fire[3]) : e < 0.7 ? P.fire[2] : P.fire[1];
        if (k > 0.7 && ((i * 7 + Math.round(s) * 3 + t) % 5 === 0)) continue;
        px(x + cx * i - cy * (s + jit), y + cy * i + cx * (s + jit), col);
      }
    }
  }
  // 引燃小火苗：2～3 像素，一直在跳
  const pilot = (x, y, t) => { px(x, y, P.fire[t % 3 === 0 ? 3 : 2]); px(x + 1, y - (t % 2), P.fire[2]); if (t % 4 < 2) px(x, y - 1, P.fire[1]); };
  // 喷汽：一串往外扩的白汽团（材质层之后画）；strong = 正在喷
  function steamJet(x, y, a, len, t, strong) {
    const r = a * Math.PI / 180, cx = Math.cos(r), cy = -Math.sin(r), n = strong ? 9 : 2;
    for (let k = 0; k < n; k++) {
      const p = saw(t * (strong ? 2.2 : 0.8) + k * (100 / n), 100), d = p * (strong ? len : 8), rr = 0.8 + p * (strong ? 4.2 : 1.6), wob = Math.sin(k * 2.1 + t * 0.2) * p * 3;
      disc(x + cx * d - cy * wob, y + cy * d + cx * wob - (strong ? 0 : p * 3), rr, p < 0.35 ? P.white : p < 0.75 ? P.steam[2] : P.steam[1]);
    }
  }
  // 车载炮座（2×1）：贴车体的矮底座 + 两片耳轴板（没有三脚架 / 立柱）
  const cradle = (x, y, x0 = 10, w = 18) => { box(x + x0, y + 18, w, 6, IRON); R(x + x0 + 1, y + 18, w - 2, 1, P.iron[3]); for (const u of [3, w - 5]) R(x + x0 + u, y + 10, 3, 8, P.iron[1]); };
  const pin = (x, y) => { disc(x, y, 2.4, P.brass[0]); disc(x, y, 1.5, P.brass[2]); px(x - 1, y - 1, P.brass[3]); };
  const flange = (X, Y, h) => { R(X, Y - h / 2 - 1, 2, h + 2, P.iron[0]); R(X, Y - h / 2 - 1, 1, h + 2, P.iron[4]); };

  // ================= 鱼叉 harpoon（2×1 = 48×24；耳轴 (18,13)，叉尖离耳轴 34）=================
  // o：t、a（仰角）、k（后坐 0～1）、out（已射出：叉不在炮口，绳子绷直伸出去）
  const HARPOON = [
    { key: 'A', name: '捕鲸炮', ref: '（v1 候选 A 重画）斯文·福因的捕鲸炮：短粗炮管 + 露在炮口外的倒钩叉 + 后面一只盘绳桶',
      idea: '短粗的铸铁炮管，炮口插着一支带倒钩的鱼叉（叉杆上一只滑环拴绳）；炮座后面一只木桶，桶里盘着一圈圈麻绳，绳子从桶口垂下来再挂到叉杆上。射出去后绳子从桶里一路被拽走。',
      draw(x, y, o) {
        const d = o.k * 5;
        box(x + 1, y + 11, 10, 13, [P.leather[0], P.leather[1], P.leather[2], P.leather[2]]); for (const v of [13, 21]) R(x + 1, y + v, 10, 2, P.iron[3]);
        R(x + 2, y + 11, 8, 2, P.leather[0]); for (let u = 2; u < 10; u += 2) px(x + u, y + 11, ROPE[2]);
        cradle(x, y, 12, 14);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          R(X - 9 - d, Y - 4, 25, 8, P.iron[0]); R(X - 9 - d, Y - 3, 25, 6, P.iron[2]); R(X - 9 - d, Y - 3, 25, 1, P.iron[3]); R(X - 9 - d, Y + 2, 25, 1, P.iron[1]);
          R(X + 12 - d, Y - 5, 4, 10, P.iron[0]); R(X + 13 - d, Y - 4, 2, 8, P.iron[3]); disc(X - 9 - d, Y, 3, P.iron[1]);
          if (!o.out) { R(X + 16 - d, Y - 1, 12, 2, P.iron[4]); R(X + 16 - d, Y, 12, 1, P.iron[2]); R(X + 19 - d, Y - 2, 2, 4, P.brass[2]); barbHead(X + 26 - d, Y); }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 16 : 20, 1);
        o.out ? line(x + 6, y + 11, rx, ry, 1, ROPE[1]) : rope(x + 6, y + 11, rx, ry, 5);
        if (o.out) { const [ex, ey] = at(x + 18, y + 13, o.a, 60, 0); line(rx, ry, ex, ey, 1, ROPE[2]); }
      } },
    { key: 'B', name: '板簧弩炮', ref: '（v1 候选 B 重画）大弩 → 弓臂换成马车的叠层板簧，工业味压过中世纪味',
      idea: '一副竖着的叠层钢板簧当弓臂（三片钢板用箍扎在一起），弓弦拉到叉尾；鱼叉躺在导轨上；炮座后面一只黄铜绞盘收绳。射出后弓臂弹直、弦拉到最前。',
      draw(x, y, o) {
        box(x + 1, y + 12, 9, 12, IRON); disc(x + 5.5, y + 12, 4.5, P.brass[0]); disc(x + 5.5, y + 12, 3.6, P.brass[1]); for (let k = -2; k <= 2; k += 2) R(x + 2, y + 12 + k, 7, 1, ROPE[1]); disc(x + 5.5, y + 12, 1.2, P.brass[3]);
        cradle(x, y, 11, 16);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          R(X - 12, Y + 1, 34, 3, P.iron[0]); R(X - 12, Y + 1, 34, 1, P.iron[3]); R(X - 12, Y + 2, 34, 1, P.iron[1]);
          const bend = o.out ? 1 : 4;
          for (let lf = 0; lf < 3; lf++) for (let i = -11 + lf; i <= 11 - lf; i++) { const bx = X + 16 + lf - Math.round(i * i / 121 * bend * 2); px(bx, Y + i, lf === 0 ? P.iron[4] : P.iron[2]); px(bx + 1, Y + i, P.iron[0]); }
          for (const v of [-5, 5]) R(X + 15, Y + v - 1, 4, 2, P.brass[1]);
          const nock = o.out ? X + 15 : X - 2;
          line(X + 16 - bend * 2, Y - 11, nock, Y, 1, P.steam[1]); line(X + 16 - bend * 2, Y + 11, nock, Y, 1, P.steam[1]);
          if (!o.out) { R(X - 2, Y - 1, 28, 2, P.iron[4]); R(X - 2, Y, 28, 1, P.iron[2]); barbHead(X + 26, Y); }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 20 : 0, 0);
        o.out ? (line(x + 6, y + 8, rx, ry, 1, ROPE[1]), line(rx, ry, ...at(x + 18, y + 13, o.a, 60, 0), 1, ROPE[2])) : rope(x + 6, y + 8, rx, ry, 2);
      } },
    { key: 'C', name: '绞盘鱼叉', ref: '（v1 候选 C 重画）占半个模块的黄铜绞盘 + 短炮管',
      idea: '左半边是一只大黄铜绞盘（两片轮缘 + 缠满的麻绳 + 一只小齿轮带着），右边一根短炮管射出带钩爪的鱼叉。收绳时绞盘转，绳圈的亮纹往上走。「收绳」这件事最显眼。',
      draw(x, y, o) {
        box(x + 1, y + 5, 20, 19, IRON);
        R(x + 3, y + 7, 16, 15, P.leather[0]); for (let v = 8; v < 21; v += 2) R(x + 4, y + v, 14, 1, (v / 2 + Math.floor(o.t / 3)) % 3 ? ROPE[1] : ROPE[2]);
        for (const u of [2, 17]) { R(x + u, y + 5, 3, 18, P.brass[0]); R(x + u, y + 6, 2, 16, P.brass[2]); R(x + u, y + 6, 1, 16, P.brass[3]); }
        gear(x + 10, y + 3.5, 3, 8, o.t * 0.15);
        cradle(x, y, 16, 12);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          const d = o.k * 5; htube(X - 3 - d, Y - 3, 22, 6, IRONL); R(X + 6 - d, Y - 4, 2, 8, P.brass[1]); R(X + 17 - d, Y - 4, 3, 8, P.iron[0]); R(X + 18 - d, Y - 3, 1, 6, P.iron[3]);
          if (!o.out) { R(X + 20 - d, Y - 1, 6, 2, P.iron[4]); for (const s of [-1, 1]) { line(X + 26 - d, Y, X + 33 - d, Y + s * 4, 1, P.iron[3]); line(X + 33 - d, Y + s * 4, X + 31 - d, Y + s * 5, 1, P.iron[4]); } R(X + 26 - d, Y - 1, 8, 2, P.iron[4]); }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 20 : 22, 0);
        o.out ? (line(x + 12, y + 8, rx, ry, 1, ROPE[1]), line(rx, ry, ...at(x + 18, y + 13, o.a, 60, 0), 1, ROPE[2])) : rope(x + 12, y + 8, rx, ry, 1);
      } },
    { key: 'D', name: '蒸汽鱼叉枪', ref: '新：气动 / 蒸汽鱼叉枪（维多利亚的捕鲸枪 + 蒸汽储气缸）',
      idea: '一根细长的炮管，下面并着一根更粗的蒸汽缸（黄铜阀 + 小压力表）；炮座底下横着一只绳轴，绳子顺着炮管下沿一路拴到叉尾。发射时炮尾喷一口白汽，平时阀门口丝丝冒汽。',
      draw(x, y, o) {
        box(x + 2, y + 16, 12, 8, IRON); disc(x + 8, y + 17, 5, P.iron[0]); disc(x + 8, y + 17, 4, P.leather[0]); for (let k = -3; k <= 3; k += 2) R(x + 5, y + 17 + k, 7, 1, ROPE[k % 4 ? 1 : 2]); disc(x + 8, y + 17, 1.3, P.brass[2]);
        cradle(x, y, 13, 14);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          const d = o.k * 4;
          htube(X - 12 - d, Y + 1, 22, 6, IRONL); R(X - 13 - d, Y, 2, 8, P.iron[0]); R(X + 9 - d, Y, 2, 8, P.iron[0]);
          htube(X - 10 - d, Y - 4, 34, 4, IRONL); R(X + 22 - d, Y - 5, 2, 6, P.iron[0]);
          R(X - 4 - d, Y - 7, 3, 3, P.brass[1]); R(X - 5 - d, Y - 8, 5, 1, P.brass[2]); gauge(X + 3 - d, Y - 6, 2.4, 0.3 + 0.4 * (o.out ? 0.2 : 0.8));
          if (!o.out) { R(X + 24 - d, Y - 3, 3, 2, P.iron[4]); barbHead(X + 26 - d, Y - 2); }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 22 : 24, 0);
        o.out ? (line(x + 8, y + 12, rx, ry, 1, ROPE[1]), line(rx, ry, ...at(x + 18, y + 13, o.a, 60, -2), 1, ROPE[2])) : rope(x + 8, y + 12, rx, ry, 1);
      },
      fx(x, y, o) { const [vx, vy] = at(x + 18, y + 13, o.a, -3, -9); steamJet(vx, vy, o.a + 90, 6, o.t, false); if (o.k > 0.3) { const [bx, by] = at(x + 18, y + 13, o.a, -12, -2); steamJet(bx, by, o.a + 180, 12, o.t, true); } } },
    { key: 'E', name: '链锚抓钩', ref: '新：船锚 + 抓钩（链条代替麻绳）',
      idea: '粗口径的短炮管里塞着一只四爪抓钩（像小船锚），拴的不是麻绳而是铁链；炮座左边一只锚链箱，链条从箱口的导链管里一节节拽出去。剪影在炮口是一朵张开的爪子。',
      draw(x, y, o) {
        box(x + 1, y + 9, 11, 15, IRON); R(x + 3, y + 11, 7, 3, P.dark[0]); R(x + 8, y + 7, 5, 4, P.iron[1]); R(x + 8, y + 7, 5, 1, P.iron[3]);
        cradle(x, y, 12, 16);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          const d = o.k * 5; htube(X - 7 - d, Y - 4, 28, 8, IRONL); R(X + 18 - d, Y - 5, 3, 10, P.iron[0]); R(X + 19 - d, Y - 4, 1, 8, P.iron[4]); R(X - 3 - d, Y - 4, 2, 8, P.brass[1]);
          if (!o.out) { R(X + 21 - d, Y - 1, 6, 2, P.iron[3]); disc(X + 27 - d, Y, 1.5, P.iron[4]); for (const s of [-1, -0.35, 0.35, 1]) { line(X + 27 - d, Y, X + 32 - d, Y + s * 5, 1, P.iron[3]); line(X + 32 - d, Y + s * 5, X + 30 - d, Y + s * 6.5, 1, P.iron[4]); } }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 21 : 22, 0), ex = o.out ? at(x + 18, y + 13, o.a, 60, 0) : [rx, ry];
        const cx0 = x + 10, cy0 = y + 8, n = Math.round(Math.hypot(ex[0] - cx0, ex[1] - cy0) / 2);
        for (let i = 0; i <= n; i++) { const k = i / n, xx = cx0 + (ex[0] - cx0) * k, yy = cy0 + (ex[1] - cy0) * k + (o.out ? 0 : Math.sin(k * Math.PI) * 3); px(xx, yy, (i + Math.floor(o.t / 2)) % 2 ? P.iron[4] : P.iron[1]); px(xx, yy + 1, P.iron[0]); }
      } },
    { key: 'F', name: '绞缆盘 + 滑轨', ref: '新：帆船甲板的绞缆盘（竖着的腰鼓 + 插杆）+ 弹簧滑轨发射',
      idea: '炮座左边立着一只绞缆盘（腰鼓形的立轴，顶上插着几根推杆），缆绳一圈圈绕在鼓腰上；右边是一副开放的双轨滑道，鱼叉坐在弹簧滑块上，旁边一根上膛杠杆。整件最「船」。',
      draw(x, y, o) {
        for (let v = 0; v < 16; v++) { const w = 10 - Math.round(Math.sin(v / 15 * Math.PI) * 3); R(x + 6 - w / 2, y + 7 + v, w, 1, v < 2 || v > 13 ? P.brass[1] : v % 2 ? ROPE[1] : ROPE[2]); px(x + 6 - w / 2, y + 7 + v, P.brass[0]); }
        R(x + 1, y + 5, 10, 2, P.brass[2]); R(x + 1, y + 5, 10, 1, P.brass[3]); const sp = Math.floor(o.t / 4) % 2; for (const u of sp ? [0, 5, 10] : [2, 8]) R(x + u, y + 3, 2, 2, P.iron[3]);
        R(x + 1, y + 22, 11, 2, P.iron[0]);
        cradle(x, y, 13, 14);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          for (const v of [-3, 2]) { R(X - 10, Y + v, 34, 2, P.iron[0]); R(X - 10, Y + v, 34, 1, P.iron[3]); }
          for (let u = -8; u < 24; u += 6) R(X + u, Y - 3, 1, 7, P.iron[1]);
          const sled = o.out ? 16 : 0; R(X - 6 + sled, Y - 2, 5, 4, P.brass[1]); R(X - 6 + sled, Y - 2, 5, 1, P.brass[3]);
          for (let u = -9; u < -6 + sled; u += 2) px(X + u, Y - (u % 4 ? 1 : 0), P.iron[4]);
          line(X - 3, Y + 4, X - 8 + (o.out ? 8 : 0), Y + 9, 1, P.iron[3]); disc(X - 8 + (o.out ? 8 : 0), Y + 9, 1, P.brass[2]);
          if (!o.out) { R(X - 1, Y - 1, 27, 2, P.iron[4]); barbHead(X + 26, Y); }
        });
        pin(x + 18, y + 13);
        const [rx, ry] = at(x + 18, y + 13, o.a, o.out ? 24 : 1, 0);
        o.out ? (line(x + 9, y + 12, rx, ry, 1, ROPE[1]), line(rx, ry, ...at(x + 18, y + 13, o.a, 60, 0), 1, ROPE[2])) : rope(x + 9, y + 12, rx, ry, 1);
      } },
  ];

  // ================= 蒸汽喷射器 steamjet（2×1；喷口离耳轴 30）：只做 T1 黄铜～T3 钢的早期蒸汽武器 =================
  // 语义：蒸汽白 + 压力表 + 阀门；绝不出现火和红色。o.on = 正在喷
  const STEAM = [
    { key: 'A', name: '扇形喷汽阀', ref: '（v1 候选 A 重画）截止阀 + 手轮 + 压扁的扇形喷嘴',
      idea: '炮座上一只球形截止阀，阀顶一只黄铜手轮（喷的时候转）；直管两道法兰，末端是压扁的扇形喷嘴，喷出一片扇形白汽。',
      draw(x, y, o) {
        cradle(x, y, 8, 20); ball(x + 12, y + 17, 4.5, IRONL); R(x + 7, y + 16, 10, 3, P.iron[1]);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 2, 32, 4, BRASS); flange(X + 2, Y, 4); flange(X + 14, Y, 4);
          poly([[X + 23, Y - 2], [X + 30, Y - 5], [X + 31, Y - 5], [X + 31, Y + 5], [X + 30, Y + 5], [X + 23, Y + 2]], BRASS); R(X + 30, Y - 5, 1, 10, P.dark[0]);
          R(X - 3, Y - 7, 1, 5, P.iron[2]); gear(X - 2.5, Y - 8, 3.5, 6, o.on ? o.t * 0.3 : 0.2);
        });
        pin(x + 18, y + 13); gauge(x + 5, y + 19, 2.6, o.on ? 0.3 : 0.75);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 31, 0); steamJet(mx, my, o.a, 30, o.t, o.on); if (o.on) { const [m2, n2] = at(x + 18, y + 13, o.a, 31, -3); steamJet(m2, n2, o.a + 10, 24, o.t + 30, true); const [m3, n3] = at(x + 18, y + 13, o.a, 31, 3); steamJet(m3, n3, o.a - 10, 24, o.t + 60, true); } } },
    { key: 'B', name: '汽笛喇叭', ref: '（v1 候选 B 重画）轮船汽笛：直管 + 大喇叭口 + 管根的汽笛筒',
      idea: '一根直管接一只大黄铜喇叭口，管根上立着一只带排气槽的汽笛筒和一根拉绳；喷的时候汽笛顶冒白汽、喇叭口喷出一大团。像船上的汽笛，「嘟——」。',
      draw(x, y, o) {
        cradle(x, y, 10, 16);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 2, 26, 4, IRONL); flange(X + 4, Y, 4);
          for (let u = 0; u < 12; u++) { const h = 2 + Math.round(u * u / 26); R(X + 18 + u, Y - h, 1, h * 2, u === 11 ? P.brass[3] : P.brass[u % 3 ? 1 : 2]); px(X + 18 + u, Y - h, P.brass[0]); px(X + 18 + u, Y + h - 1, P.brass[0]); }
          R(X + 28, Y - 6, 2, 12, P.dark[0]); R(X + 29, Y - 6, 1, 12, P.brass[3]);
          vtube(X - 4, Y - 10, 5, 8, BRASS); R(X - 5, Y - 11, 7, 2, P.brass[2]); R(X - 3, Y - 7, 3, 1, P.dark[0]);
          line(X - 1, Y - 6, X + 4, Y + 1 + (o.on ? 2 : 0), 1, P.iron[3]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); steamJet(mx, my, o.a, 32, o.t, o.on); if (o.on) { const [wx, wy] = at(x + 18, y + 13, o.a, -2, -12); steamJet(wx, wy, o.a + 90, 8, o.t, true); } } },
    { key: 'C', name: '多孔喷头', ref: '（v1 候选 C 重画）淋浴莲蓬一样的圆喷头 + 大压力表',
      idea: '管子末端一只打满小孔的圆喷头（莲蓬头），喷的时候一整片白汽往前铺开；炮座正面一只大压力表，指针跟着喷 / 不喷摆。剪影在喷口是一只圆盘。',
      draw(x, y, o) {
        cradle(x, y, 10, 18); gauge(x + 7, y + 17, 5, o.on ? 0.25 : 0.8); disc(x + 7, y + 17, 1, P.brass[2]);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 6, Y - 2, 28, 4, IRONL); flange(X + 8, Y, 4);
          poly([[X + 22, Y - 2], [X + 26, Y - 7], [X + 27, Y - 7], [X + 27, Y + 7], [X + 26, Y + 7], [X + 22, Y + 2]], BRASS);
          R(X + 27, Y - 7, 3, 14, P.brass[0]); R(X + 28, Y - 6, 1, 12, P.brass[2]); for (let v = -5; v <= 5; v += 2) px(X + 29, Y + v, P.dark[0]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { for (const v of [-5, -1.5, 1.5, 5]) { const [mx, my] = at(x + 18, y + 13, o.a, 30, v); steamJet(mx, my, o.a + v * 1.4, 26, o.t + v * 17, o.on && true); if (!o.on) break; } } },
    { key: 'D', name: '消防泵喷枪', ref: '新：维多利亚蒸汽消防车（黄铜子弹形空气室 + 皮水带 + 长锥形枪头）',
      idea: '炮座后面立着一只高高的黄铜子弹形空气室（维多利亚消防车最标志的零件），一根皮水带绕个弯接到转动的枪身；枪身是一根又长又细的锥形黄铜枪头。最黄铜、最有 T1 味道。',
      draw(x, y, o) {
        vtube(x + 2, y + 8, 9, 16, BRASS); ball(x + 6.5, y + 8, 4.5, BRASS); R(x + 2, y + 13, 9, 1, P.brass[0]); R(x + 2, y + 19, 9, 1, P.brass[0]); px(x + 5, y + 5, P.brass[3]);
        cradle(x, y, 12, 14);
        const [hx, hy] = at(x + 18, y + 13, o.a, -7, 2);
        for (let k = 0; k <= 12; k++) { const u = k / 12, xx = x + 11 + (hx - x - 11) * u, yy = y + 16 + (hy - y - 16) * u + Math.sin(u * Math.PI) * 4; R(xx, yy, 2, 2, P.leather[k % 3 ? 0 : 1]); }
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 2, 12, 5, IRONL); R(X + 1, Y - 3, 2, 6, P.brass[1]);
          for (let u = 0; u < 27; u++) { const h = 2 - Math.floor(u / 14); R(X + 3 + u, Y - h, 1, h * 2 + 1, u % 9 === 0 ? P.brass[0] : P.brass[2]); px(X + 3 + u, Y - h, P.brass[3]); }
          R(X + 29, Y - 1, 2, 3, P.brass[0]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 31, 0); steamJet(mx, my, o.a, 34, o.t, o.on); } },
    { key: 'E', name: '机车汽缸', ref: '新：蒸汽机车的汽缸（大缸体 + 缸盖螺栓 + 排水阀喷汽）',
      idea: '转动的是一整只机车汽缸：粗大的缸体、两端一圈缸盖螺栓、后面伸出活塞杆，底下三只排水阀；前端一根短喷管。喷的时候喷管和排水阀一起往外喷白汽（机车起步时那一下）。剪影最胖。',
      draw(x, y, o) {
        cradle(x, y, 10, 18);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          const d = o.on ? Math.round(Math.sin(o.t * 0.8) * 2) : 0;
          R(X - 18 + d, Y - 1, 8, 2, P.iron[4]); R(X - 19 + d, Y - 2, 2, 4, P.iron[2]);
          box(X - 11, Y - 6, 22, 12, IRONL); for (const u of [-11, 9]) { R(X + u, Y - 7, 2, 14, P.iron[0]); for (let v = -5; v <= 5; v += 3) px(X + u + 1, Y + v, P.iron[4]); }
          R(X - 7, Y - 6, 14, 1, P.iron[4]); for (const u of [-6, 0, 6]) { R(X + u, Y + 6, 2, 2, P.brass[1]); }
          htube(X + 11, Y - 2, 16, 4, IRONL); R(X + 26, Y - 3, 3, 6, P.iron[0]); R(X + 27, Y - 2, 1, 4, P.iron[4]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); steamJet(mx, my, o.a, 30, o.t, o.on); if (o.on) for (const u of [-5, 1, 7]) { const [cx, cy] = at(x + 18, y + 13, o.a, u, 8); steamJet(cx, cy, o.a - 90 + u * 3, 8, o.t + u * 11, true); } } },
    { key: 'F', name: '吉法尔注射器', ref: '新：吉法尔蒸汽注射器（一串套在一起的锥管 + 溢流窗 + 进汽管）',
      idea: '转动的是一只吉法尔注射器：一节收口锥、中间一道看得见的溢流窗、再一节扩口锥，上面一根进汽弯管带小阀、下面一根溢流管；喷的时候溢流窗里一闪一闪地冒汽。像科学仪器，最「维多利亚工程」。',
      draw(x, y, o) {
        cradle(x, y, 10, 18);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          for (let u = 0; u < 14; u++) { const h = 5 - Math.floor(u / 4); R(X - 8 + u, Y - h, 1, h * 2, u % 2 ? P.brass[1] : P.brass[2]); px(X - 8 + u, Y - h, P.brass[3]); px(X - 8 + u, Y + h - 1, P.brass[0]); }
          R(X + 6, Y - 3, 5, 6, P.dark[0]); R(X + 7, Y - 1, 3, 2, o.on && o.t % 4 < 2 ? P.white : P.steam[1]); R(X + 6, Y - 4, 5, 1, P.brass[0]); R(X + 6, Y + 3, 5, 1, P.brass[0]);
          for (let u = 0; u < 16; u++) { const h = 1 + Math.floor(u / 5); R(X + 11 + u, Y - h, 1, h * 2, u % 2 ? P.brass[1] : P.brass[2]); px(X + 11 + u, Y - h, P.brass[3]); }
          R(X + 27, Y - 5, 3, 10, P.brass[0]); R(X + 28, Y - 4, 1, 8, P.brass[3]);
          R(X - 5, Y - 10, 2, 6, P.iron[3]); R(X - 5, Y - 10, 8, 2, P.iron[3]); R(X + 1, Y - 12, 3, 3, P.brass[1]);
          R(X + 8, Y + 4, 2, 5, P.iron[2]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); steamJet(mx, my, o.a, 32, o.t, o.on); if (o.on) { const [ox2, oy2] = at(x + 18, y + 13, o.a, 9, 9); steamJet(ox2, oy2, o.a - 90, 5, o.t, false); } } },
  ];

  // ================= 喷火器 flamer（2×1；喷口离耳轴 30）：只做 T4 镀镍～T6 以太合金的后期装置 =================
  // 语义：燃料罐（红警示带）+ 引燃小火苗；o.on = 正在喷
  const FLAME = [
    { key: 'A', name: '双罐喷枪', ref: '（v1 候选 A 重画）一战的背负式喷火器搬到车上：两只燃料罐 + 软管 + 喷枪',
      idea: '炮座左边立着两只圆顶燃料罐（腰上红色警示带），一根软管绕到喷枪；喷枪细长，枪口一簇引燃火苗一直在跳，喷的时候喷出一道火舌。',
      draw(x, y, o) {
        for (const u of [1, 7]) { vtube(x + u, y + 7, 6, 17, IRONL); ball(x + u + 3, y + 7, 3, IRONL); warn(x + u, y + 14, 6, 3); }
        cradle(x, y, 12, 16);
        const [hx, hy] = at(x + 18, y + 13, o.a, -6, 2);
        for (let k = 0; k <= 10; k++) { const u = k / 10; R(x + 12 + (hx - x - 12) * u, y + 20 + (hy - y - 20) * u + Math.sin(u * Math.PI) * 3, 2, 2, P.dark[k % 2 ? 1 : 2]); }
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 7, Y - 3, 12, 6, IRONL); htube(X + 5, Y - 2, 22, 5, IRONL); for (const u of [10, 16, 22]) R(X + u, Y - 3, 1, 6, P.iron[0]);
          R(X + 27, Y - 3, 3, 6, P.iron[0]); R(X + 28, Y - 2, 1, 4, P.iron[4]); R(X - 3, Y + 3, 2, 4, P.iron[1]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); o.on ? flameJet(mx, my, o.a, 40, o.t) : pilot(Math.round(mx), Math.round(my) - 1, o.t); } },
    { key: 'B', name: '喷火塔', ref: '（v1 候选 B 重画）一座小炮塔，顶上压一只燃料球，粗喷管套散热环',
      idea: '矮炮塔上压着一只带红带的燃料球，塔前伸出一根粗喷管，管上一圈圈散热环；读起来像一门「火炮」，更重、更有威胁。',
      draw(x, y, o) {
        R(x + 6, y + 18, 26, 6, P.iron[0]); R(x + 7, y + 18, 24, 1, P.iron[3]);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          shape((xx, yy) => (xx - X) ** 2 / 110 + (yy - Y - 2) ** 2 / 50 <= 1 && yy <= Y + 5, X - 11, Y - 6, X + 11, Y + 6, IRONL);
          ball(X - 2, Y - 8, 5, IRONL); warn(X - 7, Y - 9, 10, 2);
          htube(X + 9, Y - 3, 18, 6, IRONL); for (let u = 11; u < 25; u += 3) { R(X + u, Y - 4, 2, 8, P.iron[1]); R(X + u, Y - 4, 1, 8, P.iron[4]); }
          R(X + 27, Y - 2, 3, 4, P.iron[0]);
        });
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); o.on ? flameJet(mx, my, o.a, 42, o.t) : pilot(Math.round(mx), Math.round(my) - 1, o.t); } },
    { key: 'C', name: '龙首喷口', ref: '（v1 候选 C 重画）喷管末端一只张嘴的龙首',
      idea: '喷管末端是一只张着嘴的龙首（上颚、下颚、一只眼、两根后掠的角），火从龙嘴里喷出；炮座下面卧着一只横放的燃料罐。维多利亚装饰味，适合最高档。',
      draw(x, y, o) {
        htube(x + 1, y + 16, 18, 7, IRONL); warn(x + 8, y + 16, 3, 7); R(x + 1, y + 16, 1, 7, P.iron[0]);
        cradle(x, y, 16, 12);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 6, Y - 2.5, 20, 5, IRONL); for (const u of [0, 6, 12]) R(X + u, Y - 3, 2, 6, P.iron[1]);
          poly([[X + 13, Y - 4], [X + 19, Y - 6], [X + 26, Y - 4], [X + 30, Y - 3], [X + 24, Y - 1], [X + 17, Y - 1]], IRONL);
          poly([[X + 14, Y + 1], [X + 20, Y + 1], [X + 28, Y + 3], [X + 21, Y + 5], [X + 14, Y + 4]], IRONL);
          px(X + 21, Y - 4, P.fire[2]); line(X + 17, Y - 5, X + 12, Y - 9, 1, P.iron[4]); line(X + 19, Y - 6, X + 15, Y - 10, 1, P.iron[3]);
          for (let u = 23; u < 29; u += 2) { px(X + u, Y - 2, P.white); px(X + u - 1, Y + 2, P.white); }
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 28, 0); o.on ? flameJet(mx, my, o.a, 40, o.t) : pilot(Math.round(mx), Math.round(my), o.t); } },
    { key: 'D', name: '立文斯重型喷火器', ref: '新：一战英军的立文斯大型喷火器（横放大燃料缸 + 压缩气瓶 + 长喷管）',
      idea: '炮座后半卧着一只又粗又长的铆接燃料缸（红色警示带），缸尾立着两只细高的压缩气瓶；转动的是一根长喷管，末端一只球形喷头和一圈点火环。最工业、最重。',
      draw(x, y, o) {
        for (const u of [1, 5]) { vtube(x + u, y + 4, 4, 14, IRONL); R(x + u + 1, y + 2, 2, 2, P.brass[2]); }
        box(x + 1, y + 16, 30, 8, IRONL); warn(x + 12, y + 16, 5, 8); for (let u = 4; u < 30; u += 4) px(x + u, y + 17, P.iron[4]);
        R(x + 13, y + 10, 10, 6, P.iron[1]); R(x + 13, y + 10, 10, 1, P.iron[3]);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 6, Y - 2.5, 32, 5, IRONL); for (const u of [4, 14]) R(X + u, Y - 3.5, 2, 7, P.iron[0]);
          ball(X + 27, Y, 3.2, IRONL); R(X + 29, Y - 1, 2, 2, P.iron[0]);
          R(X + 22, Y - 4, 1, 8, P.brass[2]); R(X + 23, Y - 4, 1, 8, P.brass[0]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 31, 0); o.on ? flameJet(mx, my, o.a, 46, o.t) : pilot(Math.round(mx), Math.round(my) - 1, o.t); } },
    { key: 'E', name: '玻璃燃烧室', ref: '新：以太时代的「看得见火」——黄铜笼里的玻璃燃烧室',
      idea: '转动的炮身中段是一只玻璃燃烧室，外面一道道黄铜笼条；里面一直有一团火在打转（不喷时小、喷时满），前端一根短喷口。底下一只燃料罐 + 小泵。最高档的「未来装置」感。',
      draw(x, y, o) {
        box(x + 2, y + 15, 14, 9, IRONL); warn(x + 2, y + 18, 14, 2); R(x + 16, y + 17, 3, 3, P.iron[1]);
        cradle(x, y, 14, 14);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 3, 12, 6, IRONL);
          R(X + 4, Y - 5, 16, 10, P.glass[0]); R(X + 5, Y - 4, 14, 8, P.glass[1]);
          R(X + 3, Y - 6, 18, 2, P.brass[1]); R(X + 3, Y + 4, 18, 2, P.brass[0]); for (const u of [3, 8, 13, 19]) R(X + u, Y - 6, 2, 12, P.brass[u === 3 ? 2 : 1]);
          htube(X + 21, Y - 2, 8, 4, IRONL); R(X + 28, Y - 3, 2, 6, P.iron[0]);
        });
        pin(x + 18, y + 13);
      },
      fx(x, y, o) {
        const n = o.on ? 10 : 4; for (let k = 0; k < n; k++) { const p = saw(o.t * 3 + k * 10, 40); const [fx0, fy0] = at(x + 18, y + 13, o.a, 6 + p * 12, Math.sin(p * 9 + k) * (o.on ? 3 : 1.5)); px(fx0, fy0, k % 3 ? P.fire[2] : P.fire[3]); }
        const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); o.on ? flameJet(mx, my, o.a, 40, o.t) : pilot(Math.round(mx), Math.round(my) - 1, o.t);
      } },
    { key: 'F', name: '翅片喷焰炮', ref: '新：粗短的喷焰炮（一圈大散热翅片 + 电火花点火极）',
      idea: '转动的是一段粗短的炮身，套着一圈高高的散热翅片（剪影像一只齿轮夹在管子上），前端两根点火电极之间一直噼啪地跳电火花；底座是一只贴车体的装甲燃料箱，前沿刷着红黑警示斜纹。',
      draw(x, y, o) {
        box(x + 4, y + 16, 26, 8, IRONL); for (let u = 0; u < 24; u += 4) { line(x + 5 + u, y + 23, x + 8 + u, y + 17, 2, P.fire[0]); }
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 4, 34, 8, IRONL);
          for (let u = 2; u < 18; u += 2) { R(X + u, Y - 9, 1, 18, P.iron[u % 4 ? 1 : 3]); px(X + u, Y - 9, P.iron[4]); }
          R(X + 26, Y - 3, 4, 6, P.iron[0]); R(X + 27, Y - 2, 2, 4, P.dark[0]);
          line(X + 26, Y - 4, X + 31, Y - 6, 1, P.brass[2]); line(X + 26, Y + 4, X + 31, Y + 6, 1, P.brass[2]);
        });
      },
      fx(x, y, o) {
        const [mx, my] = at(x + 18, y + 13, o.a, 30, 0);
        if (o.t % 5 < 2) { const [ax, ay] = at(x + 18, y + 13, o.a, 31, -5), [bx, by] = at(x + 18, y + 13, o.a, 31, 5); line(ax, ay, (ax + bx) / 2 + 1, (ay + by) / 2, 1, P.white); line((ax + bx) / 2 + 1, (ay + by) / 2, bx, by, 1, P.glass[3]); }
        o.on ? flameJet(mx, my, o.a, 44, o.t) : pilot(Math.round(mx), Math.round(my), o.t);
      } },
  ];

  // ================= 火箭架 rocket_rack（2×2 = 48×48；耳轴 (24,28)，弹头离耳轴 34）：要数得出「4」=================
  // o.n = 架上还剩几发（0～4）；o.fire = 刚射出一发（尾焰 / 烟）
  const rkt = (X0, Y, len = 14, fin = true) => {   // 横放的一发火箭：铁壳弹体 + 红色弹头 + 尾翼
    R(X0, Y - 1.5, len, 3, P.iron[2]); R(X0, Y - 1.5, len, 1, P.iron[4]); R(X0, Y + 1, len, 1, P.iron[0]);
    R(X0 + len, Y - 1.5, 2, 3, P.fire[0]); px(X0 + len + 2, Y - 0.5, P.fire[1]); px(X0 + len, Y - 1.5, P.fire[1]);
    if (fin) { px(X0 - 1, Y - 2.5, P.iron[3]); px(X0 - 1, Y + 1.5, P.iron[3]); }
  };
  const bed2 = (x, y) => { box(x + 10, y + 38, 28, 10, IRON); R(x + 11, y + 38, 26, 1, P.iron[3]); for (const u of [15, 29]) R(x + u, y + 24, 4, 14, P.iron[1]); };
  const ROCKET = [
    { key: 'A', name: '管束发射架', ref: '（v1 候选 A 重画）四根粗发射管竖着叠成一排，黄铜箍扎紧',
      idea: '四根粗发射管上下叠成一束（侧面一眼数得出 4 根），两道黄铜箍扎紧，管口露出红色弹头；装在一只矮炮床的耳轴上。发一发，少一个弹头。',
      draw(x, y, o) {
        bed2(x, y);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          for (let i = 0; i < 4; i++) { const v = -10.5 + i * 5.5; htube(X - 16, Y + v - 2.5, 42, 5, IRONL); R(X + 25, Y + v - 3, 2, 6, P.iron[0]); R(X + 25, Y + v - 1.5, 2, 3, P.dark[0]); if (i < o.n) { R(X + 27, Y + v - 1.5, 3, 3, P.fire[0]); R(X + 30, Y + v - 0.5, 2, 1, P.fire[1]); px(X + 27, Y + v - 1.5, P.fire[1]); } }
          for (const u of [-8, 12]) { R(X + u, Y - 14, 3, 24, P.brass[0]); R(X + u, Y - 14, 1, 24, P.brass[3]); R(X + u + 1, Y - 14, 1, 24, P.brass[2]); }
        });
        pin(x + 24, y + 28);
      } },
    { key: 'B', name: '康格里夫导轨', ref: '（v1 候选 B 重画）拿破仑时代的康格里夫火箭：梯形导轨 + 带长尾杆的火箭',
      idea: '一副梯子一样的发射导轨，四根横档上各架一支火箭：圆筒弹体 + 红黄相间的锥形弹头 + 一根长长的导向尾杆拖到导轨后面。最「蒸汽朋克」，一眼知道是火箭不是炮。',
      draw(x, y, o) {
        bed2(x, y);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          for (const v of [-12, 10]) { R(X - 20, Y + v, 50, 2, P.iron[0]); R(X - 20, Y + v, 50, 1, P.iron[3]); }
          for (let u = -18; u < 30; u += 8) R(X + u, Y - 12, 1, 24, P.iron[1]);
          for (let i = 0; i < 4; i++) { const v = -8 + i * 5.3; if (i < o.n) { R(X - 20, Y + v, 34, 1, P.leather[2]); R(X + 14, Y + v - 1.5, 12, 3, P.iron[3]); R(X + 14, Y + v - 1.5, 12, 1, P.iron[4]); for (let u = 0; u < 7; u++) { const h = 1.5 - u / 5; R(X + 26 + u, Y + v - h, 1, Math.max(1, h * 2), u % 2 ? P.fire[1] : P.fire[3]); } } else R(X - 20, Y + v, 50, 1, P.iron[1]); }
        });
        pin(x + 24, y + 28);
      } },
    { key: 'C', name: '蜂巢箱', ref: '（v1 候选 C 重画）方形发射箱，正面 2×2 四个孔露出红弹头',
      idea: '一只铆接方箱，前端斜着露出一块正面板，板上 2×2 四个圆孔里是红色弹头（发一发空一个黑孔）；箱盖往上掀开一道缝。最规整，放在车体里像一只箱子。',
      draw(x, y, o) {
        bed2(x, y);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          box(X - 18, Y - 12, 38, 24, IRONL); for (let u = -15; u < 20; u += 6) { px(X + u, Y - 10, P.iron[4]); px(X + u, Y + 10, P.iron[4]); }
          line(X - 16, Y - 13, X + 16, Y - 16, 2, P.iron[3]); R(X + 15, Y - 17, 3, 3, P.iron[1]);
          poly([[X + 20, Y - 12], [X + 30, Y - 9], [X + 30, Y + 11], [X + 20, Y + 12]], IRONL);
          for (let i = 0; i < 4; i++) { const cx = X + 23 + (i % 2) * 5, cy = Y - 5 + Math.floor(i / 2) * 11; disc(cx, cy, 2.6, P.dark[0]); if (i < o.n) { disc(cx, cy, 1.8, P.fire[0]); px(cx - 1, cy - 1, P.fire[1]); } }
        });
        pin(x + 24, y + 28);
      } },
    { key: 'D', name: '转轮弹巢', ref: '新：左轮手枪的转轮搬大（四个弹巢轮流对准一根发射管）',
      idea: '一只大转轮，侧面看得见四道弹巢槽（每道一发，装着的露出红弹头尾），每发一次转轮转一格；上面一根长发射管。像一把放大的左轮，「数得出 4」靠转轮上的四道槽。',
      draw(x, y, o) {
        bed2(x, y);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          box(X - 14, Y - 11, 22, 22, IRONL); R(X - 15, Y - 12, 24, 2, P.brass[1]); R(X - 15, Y + 10, 24, 2, P.brass[0]);
          for (let i = 0; i < 4; i++) { const v = -8 + i * 5.3; R(X - 13, Y + v - 1, 20, 3, P.iron[0]); if (i < o.n) { R(X - 13, Y + v - 1, 3, 3, P.brass[2]); R(X + 5, Y + v - 1, 2, 3, P.fire[0]); } }
          htube(X + 8, Y - 12, 24, 6, IRONL); R(X + 30, Y - 13, 3, 8, P.iron[0]); R(X + 31, Y - 12, 1, 6, P.iron[4]);
          gear(X - 3, Y + 14, 3, 8, (4 - o.n) * 0.8);
        });
        pin(x + 24, y + 28);
      } },
    { key: 'E', name: '黑尔槽式 + 顶升缸', ref: '新：黑尔旋转火箭（没有尾杆，靠尾喷口旋转）+ 蒸汽顶升缸抬架子',
      idea: '四条敞口的 U 形发射槽像风琴一样一层层错开叠着，槽里躺着黑尔火箭（短粗、尾部三个斜喷口）；架子底下一根蒸汽顶升缸把整个架子往上顶（仰角越大顶得越长）。',
      draw(x, y, o) {
        bed2(x, y);
        const [jx, jy] = at(x + 24, y + 28, o.a, 12, 12);
        line(x + 32, y + 40, jx, jy, 5, P.iron[0]); line(x + 32, y + 40, jx, jy, 3, P.iron[3]); line(x + 32, y + 40, x + 32 + (jx - x - 32) * 0.5, y + 40 + (jy - y - 40) * 0.5, 5, P.brass[1]);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          for (let i = 0; i < 4; i++) {
            const v = -11 + i * 6, s = -i * 3;
            R(X - 16 + s, Y + v + 2, 40, 2, P.iron[0]); R(X - 16 + s, Y + v + 2, 40, 1, P.iron[3]); R(X - 16 + s, Y + v - 2, 1, 4, P.iron[1]); R(X + 23 + s, Y + v - 2, 1, 4, P.iron[1]);
            if (i < o.n) { R(X + 4 + s, Y + v - 1.5, 18, 3, P.iron[3]); R(X + 4 + s, Y + v - 1.5, 18, 1, P.iron[4]); R(X + 22 + s, Y + v - 1.5, 3, 3, P.fire[0]); px(X + 25 + s, Y + v - 0.5, P.fire[1]); for (const w of [0, 2]) px(X + 3 + s, Y + v - 1 + w, P.dark[0]); }
          }
        });
        pin(x + 24, y + 28);
      } },
    { key: 'F', name: '双臂挂架', ref: '新：圆炮塔两侧伸出挂架（上两发、下两发），像飞机翼下挂弹',
      idea: '中间一只圆炮塔，上下各伸出一对挂架臂，每条臂上挂一发带尾翼的火箭（上两发、下两发），挂钩一松火箭就滑出去。剪影是一只圆球夹在四支箭中间，和别的发射架都不一样。',
      draw(x, y, o) {
        bed2(x, y);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          for (const v of [-13, -7, 7, 13]) { R(X - 6, Y + v - (v < 0 ? 0 : 1), 26, 2, P.iron[0]); R(X - 6, Y + v - (v < 0 ? 0 : 1), 26, 1, P.iron[3]); }
          const slots = [-15.5, -9.5, 10.5, 16.5];
          slots.forEach((v, i) => { if (i < o.n) rkt(X + 2, Y + v, 18); for (const u of [4, 14]) px(X + u, Y + v + (v < 0 ? 1.5 : -2.5), P.brass[2]); });
          ball(X, Y, 8, IRONL); R(X - 8, Y - 1, 16, 2, P.brass[1]); lens(X + 3, Y - 4, 3, 2, false); htube(X + 6, Y - 1.5, 10, 3, IRONL);
        });
        pin(x + 24, y + 28);
      } },
  ];


  // ================= v2（2026-09-29 用户：鱼叉 E + 绞缆盘做背景大圆盘；喷射器选 A；喷火器 F 去电极、火焰去黑杂点并混进蒸汽；火箭重做成投石机 / 投矛器，每个投射点一枚短炸弹）=================
  // 火焰 v2：实心的火锥（不挖洞、不用最暗的红），喷口一圈白汽领子，火舌前端化成一团团白汽 / 烟
  function flameJet2(x, y, a, len, t) {
    const r = a * Math.PI / 180, cx = Math.cos(r), cy = -Math.sin(r), L = len * 0.72;
    const put = (u, v, c) => px(x + cx * u - cy * v, y + cy * u + cx * v, c);
    for (let i = 0; i < L; i++) {
      const k = i / L, w = 1 + i * 0.24 * (1 - k * 0.35), jit = Math.sin(i * 0.55 + t * 0.6) * k * 1.4;
      for (let s = -w; s <= w; s += 0.5) {
        const e = Math.abs(s) / w;
        put(i, s + jit, e < 0.3 ? (k < 0.3 ? P.white : P.fire[3]) : e < 0.65 ? (k < 0.75 ? P.fire[3] : P.fire[2]) : e < 0.9 ? P.fire[2] : P.fire[1]);
      }
    }
    for (let q = 0; q < 7; q++) {                                                   // 火舌尖化成汽团：越远越大、越白
      const p = saw(t * 2 + q * 14, 100), u = L * 0.8 + p * len * 0.55, v = Math.sin(q * 2.3 + t * 0.15) * (2 + p * 4), rr = 1.6 + p * 3.6;
      const c = p < 0.2 ? P.fire[3] : p < 0.55 ? P.white : P.steam[2];
      disc(x + cx * u - cy * v, y + cy * u + cx * v, rr, c);
    }
    for (const sd of [-1, 1]) { const p = saw(t * 3 + (sd > 0 ? 50 : 0), 100); disc(x + cx * (2 + p * 8) - cy * sd * (3 + p * 3), y + cy * (2 + p * 8) + cx * sd * (3 + p * 3), 1 + p * 1.6, p < 0.5 ? P.white : P.steam[2]); }   // 喷口两侧的白汽领子
  }
  const FLAME2 = [
    { key: 'F2', name: '翅片喷焰炮', ref: 'v1 选定 F：粗短炮身 + 一圈大散热翅片（去掉电极）',
      idea: '（v2）转动的是一段粗短的炮身，套着一圈高高的散热翅片，前端一只收口喷嘴；底座是一只贴车体的装甲燃料箱，前沿刷着红黑警示斜纹。电极和电火花去掉了；喷火改成实心的火锥（不再有黑色杂点），喷口一圈白汽，火舌前端化成一团团白汽——和蒸汽喷射器是一家。',
      draw(x, y, o) {
        box(x + 4, y + 16, 26, 8, IRONL); for (let u = 0; u < 24; u += 4) line(x + 5 + u, y + 23, x + 8 + u, y + 17, 2, P.fire[0]);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          htube(X - 8, Y - 4, 34, 8, IRONL);
          for (let u = 2; u < 18; u += 2) { R(X + u, Y - 9, 1, 18, P.iron[u % 4 ? 1 : 3]); px(X + u, Y - 9, P.iron[4]); }
          poly([[X + 25, Y - 4], [X + 30, Y - 2.5], [X + 30, Y + 2.5], [X + 25, Y + 4]], IRONL); R(X + 29, Y - 1, 2, 2, P.dark[0]);
        });
      },
      fx(x, y, o) { const [mx, my] = at(x + 18, y + 13, o.a, 30, 0); o.on ? flameJet2(mx, my, o.a, 46, o.t) : pilot(Math.round(mx), Math.round(my) - 1, o.t); } },
  ];

  // 鱼叉 v2：链锚抓钩 + 身后占满高度的绞缆盘（正面看的大圆盘，一圈圈缠着的缆绳）
  const HARPOON2 = [
    { key: 'E2', name: '链锚抓钩 + 绞缆盘', ref: 'v1 选定 E 链锚抓钩为主体 + F 的绞缆盘改成背景大圆盘',
      idea: '（v3）身后立着一只占满整个模块高度的大绞缆盘（正面看：黄铜轮缘、三圈粗缆——每圈之间一道黑缝、左上亮右下暗、稀疏的捻纹——中间黄铜轮毂），前面是粗口径短炮管和四爪抓钩。抓钩后面接一小段铁链，再接盘上的缆绳。射出去时绞盘放缆（缆圈的纹路往外转），收回时往回转。',
      draw(x, y, o) {
        const cx = x + 13, cy = y + 12, spin = (o.out ? 1 : -0.3) * o.t * 0.12;
        cableDrum(cx, cy, spin);
        cradle(x, y, 12, 16);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          const d = o.k * 5; htube(X - 7 - d, Y - 4, 28, 8, IRONL); R(X + 18 - d, Y - 5, 3, 10, P.iron[0]); R(X + 19 - d, Y - 4, 1, 8, P.iron[4]); R(X - 3 - d, Y - 4, 2, 8, P.brass[1]);
          if (!o.out) { R(X + 21 - d, Y - 1, 6, 2, P.iron[3]); disc(X + 27 - d, Y, 1.5, P.iron[4]); for (const s of [-1, -0.35, 0.35, 1]) { line(X + 27 - d, Y, X + 32 - d, Y + s * 5, 1, P.iron[3]); line(X + 32 - d, Y + s * 5, X + 30 - d, Y + s * 6.5, 1, P.iron[4]); } }
        });
        pin(x + 18, y + 13);
        // 缆绳：从绞盘顶上出来，拴到炮口的一小段铁链（射出时绷直伸出去）
        const [rx, ry] = at(x + 18, y + 13, o.a, 21, -1);
        if (o.out) { line(cx, cy - 10.5, rx, ry, 1, ROPE[1]); const [ex, ey] = at(x + 18, y + 13, o.a, 60, 0); const n = Math.round(Math.hypot(ex - rx, ey - ry) / 2); for (let i = 0; i <= n; i++) { const k = i / n; px(rx + (ex - rx) * k, ry + (ey - ry) * k, i < 6 ? (i % 2 ? P.iron[4] : P.iron[1]) : ROPE[i % 3 ? 1 : 2]); } }
        else rope(cx + 2, cy - 10.5, rx, ry, 2);
      } },
  ];

  // 火箭架 v2：投石机 / 投矛器。每个投射点一枚短炸弹（圆胖弹体 + 红箍 + 一截引信）。
  // o.n：架上几枚（装填 / 打空时用）；o.s：一轮投掷的进度 0～1（0 = 没在投）
  const bomb = (cx, cy) => {
    disc(cx, cy, 2.6, P.iron[0]); disc(cx, cy, 1.8, P.iron[2]); px(cx - 1, cy - 1, P.iron[4]);
    R(cx - 2, cy, 5, 1, P.fire[0]); px(cx - 1, cy, P.fire[1]);
    R(cx, cy - 4, 1, 2, P.brass[1]); px(cx + 1, cy - 5, P.fire[3]);
  };
  const cup = (cx, cy) => { R(cx - 3, cy + 2, 7, 2, P.iron[0]); R(cx - 3, cy + 2, 7, 1, P.iron[3]); px(cx - 3, cy + 1, P.iron[2]); px(cx + 3, cy + 1, P.iron[2]); };
  const beam = (x0, y0, x1, y1, w = 3) => { line(x0, y0, x1, y1, w, P.iron[0]); line(x0, y0, x1, y1, Math.max(1, w - 2), P.iron[3]); };
  const easeOut = (k) => 1 - (1 - k) ** 3;
  // 单臂整体甩一次（B、D）：0～0.35 甩出去，0.35～0.6 停在前面，0.6～1 空臂收回来
  const swingOf = (s) => (s <= 0 ? 0 : s < 0.35 ? easeOut(s / 0.35) : s < 0.6 ? 1 : 1 - (s - 0.6) / 0.4);
  const CATA = [
    { key: 'G', name: '四杓投掷轮', ref: '新：中世纪投掷轮 + 蒸汽机的飞轮（四根杓臂轮流甩出）',
      idea: '一只装在车体支架上的大飞轮，伸出四根杓臂（十字），每只杓里一枚短炸弹；投掷时飞轮猛地转过四分之一圈，转到右上方的那只杓把炸弹甩出去，一枚接一枚。数得出 4：四根臂、四只杓。',
      draw(x, y, o) {
        const H = [x + 22, y + 26], firing = o.s > 0, per = firing ? o.s * 4 : 0, shot = Math.floor(per), sw = firing ? easeOut(per - shot) : 0;
        beam(x + 10, y + 42, H[0], H[1], 4); beam(x + 34, y + 42, H[0], H[1], 4); box(x + 6, y + 40, 34, 8, IRON);
        const base = -Math.PI * 0.75 + (shot + sw) * Math.PI / 2;
        for (let k = 0; k < 4; k++) {
          const a = base - k * Math.PI / 2, ex = H[0] + Math.cos(a) * 17, ey = H[1] + Math.sin(a) * 17;
          beam(H[0], H[1], ex, ey, 3);
          const loaded = firing ? (k > shot || (k === shot && sw < 0.8)) : k < o.n;
          const ux = Math.cos(a), uy = Math.sin(a);
          R(ex - 2 - uy * 0, ey - 2, 5, 5, P.iron[0]); R(ex - 1, ey - 1, 3, 3, P.iron[2]);
          if (loaded) bomb(ex - uy * 3.5 * -1 + ux * 0, ey - 3.5);
        }
        disc(H[0], H[1], 9, P.brass[0]); disc(H[0], H[1], 8, P.brass[1]); disc(H[0], H[1], 6, P.brass[0]); for (let k = 0; k < 8; k++) { const a = base + k * Math.PI / 4; line(H[0], H[1], H[0] + Math.cos(a) * 6, H[1] + Math.sin(a) * 6, 1, P.brass[2]); }
        disc(H[0], H[1], 2.2, P.iron[0]); px(H[0] - 1, H[1] - 1, P.brass[3]);
      } },
    { key: 'H', name: '投矛臂', ref: '新：投矛器（阿特拉特尔）放大成车载长臂 + 蒸汽缸猛推',
      idea: '一根长长的投矛臂平时向后放倒，臂上一排四个托架各托一枚短炸弹；开火时底下的蒸汽缸猛地一推，长臂从后往前抡过头顶，四枚炸弹从臂梢往根部一个接一个脱手飞出去，然后空臂慢慢放回。',
      draw(x, y, o) {
        box(x + 4, y + 40, 40, 8, IRON); R(x + 22, y + 33, 6, 8, P.iron[1]); R(x + 22, y + 33, 6, 1, P.iron[3]);
        const Pv = [x + 25, y + 36], sw = swingOf(o.s), a = (-172 + sw * 112) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
        const Cyl = [x + 40, y + 42], Arm8 = [Pv[0] + ux * 9, Pv[1] + uy * 9];
        line(Cyl[0], Cyl[1], Arm8[0], Arm8[1], 5, P.iron[0]); line(Cyl[0], Cyl[1], Arm8[0], Arm8[1], 3, P.iron[3]);
        line(Cyl[0], Cyl[1], Cyl[0] + (Arm8[0] - Cyl[0]) * 0.45, Cyl[1] + (Arm8[1] - Cyl[1]) * 0.45, 5, P.brass[1]);
        beam(Pv[0], Pv[1], Pv[0] + ux * 27, Pv[1] + uy * 27, 4); R(Pv[0] + ux * 27 - 1, Pv[1] + uy * 27 - 2, 3, 3, P.brass[2]);
        for (let k = 0; k < 4; k++) {
          const d = 26 - k * 5.5, bx = Pv[0] + ux * d, by = Pv[1] + uy * d, nx = uy, ny = -ux;   // 托架在臂的上沿
          const tx = bx + nx * -3, ty = by + ny * -3;
          line(bx, by, tx, ty, 1, P.iron[3]);
          const gone = o.s > 0 ? o.s > 0.22 + k * 0.035 : k >= o.n;
          if (!gone) bomb(tx, ty - 1);
        }
        pin(Pv[0], Pv[1]);
      } },
    { key: 'I', name: '四联投石机', ref: '新：古代的扭力投石机（绞索扭力束 + 撞杆）四台排成一排',
      idea: '四台小投石机一台比一台高地排成台阶（像管风琴），每台一只绞索扭力束 + 一根短臂 + 一只杓，杓里一枚炸弹；上方一根包皮的挡杆。开火时四根臂一根接一根弹起来撞在挡杆上，把炸弹抛出去。',
      draw(x, y, o) {
        R(x + 2, y + 15, 44, 3, P.iron[0]); R(x + 2, y + 15, 44, 1, P.iron[3]); R(x + 4, y + 13, 40, 2, P.leather[1]);
        for (const u of [3, 43]) R(x + u, y + 15, 2, 28, P.iron[1]);
        box(x + 2, y + 42, 44, 6, IRON);
        for (let k = 3; k >= 0; k--) {
          const Pv = [x + 12 + k * 9, y + 41 - k * 4], firing = o.s > 0, p = firing ? Math.max(0, Math.min(1, o.s * 4.5 - k)) : 0;
          const up = firing ? easeOut(p) : k < o.n ? 0 : 1, a = (-168 + up * 88) * Math.PI / 180, ex = Pv[0] + Math.cos(a) * 15, ey = Pv[1] + Math.sin(a) * 15;
          R(Pv[0] - 4, Pv[1] - 1, 8, 4 + k * 4, P.iron[1]); R(Pv[0] - 4, Pv[1] - 1, 8, 1, P.iron[3]);
          beam(Pv[0], Pv[1], ex, ey, 3);
          R(ex - 2, ey - 2, 4, 3, P.iron[0]);
          if (firing ? p < 0.75 : k < o.n) bomb(ex, ey - 4);
          disc(Pv[0], Pv[1], 2.6, ROPE[0]); disc(Pv[0], Pv[1], 1.8, ROPE[1]); px(Pv[0], Pv[1] - 1, ROPE[2]);
        }
      } },
    { key: 'J', name: '配重投石机', ref: '新：配重投石机（高 A 字架 + 长臂 + 铁配重箱），长臂梢一只四叉头',
      idea: '一座高高的 A 字架托着一根长抛臂，短的一头挂着一只铆接配重箱；长臂梢是一只四叉头，四根短叉各挑一枚炸弹。开火时配重箱落下、长臂从后下方甩到右上方，四枚炸弹一枚接一枚甩出去，然后长臂慢慢放回。',
      draw(x, y, o) {
        const Ax = [x + 24, y + 17], sw = swingOf(o.s), a = (150 - sw * 208) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
        beam(x + 11, y + 43, Ax[0], Ax[1], 4); beam(x + 37, y + 43, Ax[0], Ax[1], 4); beam(x + 15, y + 34, x + 33, y + 34, 2); box(x + 6, y + 42, 36, 6, IRON);
        const S = [Ax[0] - ux * 8, Ax[1] - uy * 8];
        line(S[0], S[1], S[0], S[1] + 4, 1, P.iron[3]); box(S[0] - 4, S[1] + 4, 9, 8, IRONL); px(S[0] - 2, S[1] + 6, P.iron[4]); px(S[0] + 2, S[1] + 6, P.iron[4]);
        const E = [Ax[0] + ux * 19, Ax[1] + uy * 19];
        beam(S[0], S[1], E[0], E[1], 4);
        for (let k = 0; k < 4; k++) {
          const b = a + (k - 1.5) * 0.5, tx = E[0] + Math.cos(b) * 5, ty = E[1] + Math.sin(b) * 5;
          line(E[0], E[1], tx, ty, 1, P.iron[3]);
          const gone = o.s > 0 ? o.s > 0.24 + k * 0.03 : k >= o.n;
          if (!gone) bomb(tx + Math.cos(b) * 2, ty + Math.sin(b) * 2);
        }
        pin(Ax[0], Ax[1]);
      } },
  ];
  // 投掷时的小烟尘：从脱手点往外飘两团汽（材质层之后）
  function cataFx(x, y, o) { if (o.s > 0.15 && o.s < 0.5) { const p = (o.s - 0.15) / 0.35; disc(x + 40 + p * 8, y + 8 - p * 6, 1 + p * 2.5, p < 0.5 ? P.white : P.steam[2]); disc(x + 32 + p * 10, y + 4 - p * 4, 0.8 + p * 2, P.steam[2]); } }

  // ================= v3（2026-09-29 用户：绞盘线缆糊成一团要清楚；火箭架做成六档六种样式，投矛臂、投掷轮保留，v1 火箭架挑一个当高阶，再探索一些）=================
  // 绞缆盘 v3：三圈粗缆，每圈之间一道黑缝；每圈左上亮、右下暗（光从左上来），捻纹稀疏、随绞盘转
  function cableDrum(cx, cy, spin) {
    disc(cx, cy, 12, P.brass[0]); disc(cx, cy, 11, P.brass[1]); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; px(cx + Math.cos(a) * 11.4, cy + Math.sin(a) * 11.4, P.brass[3]); }
    for (let yy = Math.floor(cy - 10); yy <= cy + 10; yy++) for (let xx = Math.floor(cx - 10); xx <= cx + 10; xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > 9.9) continue;
      if (d < 3.2) continue;
      const f = (d - 3.4) / 2.1, ring = Math.floor(f), fr = f - ring;
      if (ring > 2 || fr > 0.72 || f < 0) { px(xx, yy, P.black); continue; }
      const a = Math.atan2(dy, dx), lit = Math.cos(a + Math.PI * 0.75);                                     // 左上 = 1，右下 = -1
      const ph = ((a - spin) / TAU * 8 % 1 + 1) % 1, tw = ring === 2 && ph < 0.12;   // 捻纹：只在最外圈，一圈 8 道短痕（看得出绞盘在转）
      px(xx, yy, tw ? ROPE[0] : lit > 0.35 ? ROPE[2] : lit < -0.4 ? ROPE[0] : ROPE[1]);
    }
    disc(cx, cy, 3, P.brass[0]); disc(cx, cy, 2.2, P.brass[2]); for (let k = 0; k < 4; k++) { const a = spin + k * TAU / 4; px(cx + Math.cos(a) * 2.2, cy + Math.sin(a) * 2.2, P.brass[0]); }
    px(cx - 1, cy - 1, P.brass[3]); px(cx, cy, P.iron[0]);
  }

  // ---------- 火箭架六档：从「扔」到「射」 ----------
  // 状态统一：o.n 架上几枚（装填 / 空）；o.s 一轮开火进度 0～1；o.a 仰角（会转的发射管用）
  const shotsOf = (o) => { if (!(o.s > 0)) return { n: o.n, fire: false }; const sh = o.s * 5; return { n: Math.max(0, 4 - Math.floor(sh + 0.8)), fire: sh % 1 < 0.5 && sh < 4.3 }; };
  const tubeFx = (dx, dy) => (x, y, o) => { const S = shotsOf(o); if (!S.fire) return; const [bx, by] = at(x + 24, y + 28, o.a, dx, dy); steamJet(bx, by, o.a + 180, 14, o.t, true); };
  const coil = (x0, y0, x1, y1, turns, rr) => {   // 画一根螺旋弹簧：沿 a→b 一圈圈的斜线
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, N = turns * 8;
    for (let i = 0; i < N; i++) { const k0 = i / N, k1 = (i + 1) / N, s0 = Math.sin(k0 * turns * TAU), s1 = Math.sin(k1 * turns * TAU); line(x0 + ux * L * k0 + nx * rr * s0, y0 + uy * L * k0 + ny * rr * s0, x0 + ux * L * k1 + nx * rr * s1, y0 + uy * L * k1 + ny * rr * s1, 1, Math.cos(k0 * turns * TAU) > 0 ? P.iron[4] : P.iron[1]); }
  };
  const ROCKET6 = [
    { key: 'T1', tier: 1, name: '投矛臂', ref: 'v2 H，保留', idea: '（T1 黄铜）一根长投矛臂平时向后放倒，臂上四个托架各一枚短炸弹；蒸汽缸一推，长臂抡过头顶，炸弹从臂梢到根部依次脱手。', draw: (x, y, o) => CATA[1].draw(x, y, o), fx: cataFx },
    { key: 'T2', tier: 2, name: '四杓投掷轮', ref: 'v2 G，保留', idea: '（T2 熟铁）大飞轮伸出十字四根杓臂，每只杓一枚短炸弹；每投一枚飞轮转四分之一圈。', draw: (x, y, o) => CATA[0].draw(x, y, o), fx: cataFx },
    { key: 'T3a', tier: 3, name: '卷簧投掷臂', ref: '新：钢制大螺旋弹簧拉着的投掷臂（钢 = 弹簧钢）',
      idea: '（T3 钢候选）一根投掷臂向后压倒，被一根又粗又长的钢螺旋弹簧拉着；臂梢一只四杓头，各一枚炸弹。开火时弹簧猛地收缩，臂甩到竖直撞上挡块，四枚炸弹一起飞出去。「钢」这一档的主角是弹簧。',
      draw(x, y, o) {
        box(x + 4, y + 40, 40, 8, IRON); R(x + 36, y + 14, 5, 27, P.iron[1]); R(x + 36, y + 14, 5, 1, P.iron[3]); R(x + 33, y + 14, 8, 3, P.leather[1]);
        const Pv = [x + 22, y + 38], sw = swingOf(o.s), a = (-172 + sw * 94) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
        const A10 = [Pv[0] + ux * 10, Pv[1] + uy * 10];
        coil(x + 39, y + 36, A10[0], A10[1], 6, 2.5); R(x + 38, y + 35, 3, 3, P.iron[0]);
        beam(Pv[0], Pv[1], Pv[0] + ux * 22, Pv[1] + uy * 22, 4);
        const E = [Pv[0] + ux * 22, Pv[1] + uy * 22];
        for (let k = 0; k < 4; k++) { const b = a + (k - 1.5) * 0.45, tx = E[0] + Math.cos(b) * 4, ty = E[1] + Math.sin(b) * 4; line(E[0], E[1], tx, ty, 1, P.iron[3]); const gone = o.s > 0 ? o.s > 0.2 : k >= o.n; if (!gone) bomb(tx - uy * 2, ty + ux * 2 - 1); }
        pin(Pv[0], Pv[1]);
      }, fx: cataFx },
    { key: 'T3b', tier: 3, name: '板簧连弩', ref: '新：四副叠层板簧弓上下排成一架（连弩），每根弦前一枚炸弹',
      idea: '（T3 钢候选）一只斜架子里上下排着四副叠层钢板簧弓，每根弦前坐着一枚短炸弹；开火时从上到下一根根弦弹直，把炸弹弹出去。四副弓 = 数得出 4。',
      draw(x, y, o) {
        box(x + 8, y + 40, 32, 8, IRON);
        const S = shotsOf(o);
        turn(x + 24, y + 28, 20 + (o.a || 0) * 0.4, (X, Y) => {
          for (const u of [-16, 12]) { R(X + u, Y - 18, 3, 36, P.iron[0]); R(X + u, Y - 18, 1, 36, P.iron[3]); }
          for (let k = 0; k < 4; k++) {
            const v = -13 + k * 8.5, loaded = k < S.n, bend = loaded ? 3 : 0.6;
            R(X - 16, Y + v, 28, 2, P.iron[1]); R(X - 16, Y + v, 28, 1, P.iron[3]);
            for (let lf = 0; lf < 2; lf++) for (let i = -4 + lf; i <= 4 - lf; i++) { const bx = X + 11 + lf - Math.round(i * i / 16 * bend); px(bx, Y + v + i, lf ? P.iron[2] : P.iron[4]); }
            const nock = loaded ? X - 3 : X + 9; line(X + 11 - bend, Y + v - 4, nock, Y + v, 1, P.steam[1]); line(X + 11 - bend, Y + v + 4, nock, Y + v, 1, P.steam[1]);
            if (loaded) bomb(X + 1, Y + v - 2);
          }
        });
        pin(x + 24, y + 28);
      } },
    { key: 'T4a', tier: 4, name: '气压抛射管', ref: '新：四根短粗的气压迫击管排成管风琴 + 一根蒸汽汇流管',
      idea: '（T4 镀镍候选）四根短粗的抛射管像管风琴一样一高一低排着，管口露出炸弹的圆顶和引信；底下一根汇流管连着一只压力表。开火时一根接一根「噗」地喷一口白汽，炸弹被顶出去。从「扔」进化到「喷」。',
      draw(x, y, o) {
        box(x + 4, y + 40, 40, 8, IRON); const S = shotsOf(o), tilt = (50 + (o.a || 0) * 0.4) * Math.PI / 180;
        htube(x + 6, y + 36, 36, 4, IRONL); gauge(x + 40, y + 33, 3, S.fire ? 0.3 : 0.8);
        for (let k = 0; k < 4; k++) {
          const bx = x + 10 + k * 8, by = y + 37, L = 16 + (k % 2) * 5, ex = bx + Math.cos(tilt) * L, ey = by - Math.sin(tilt) * L;
          line(bx, by, ex, ey, 6, P.iron[0]); line(bx, by, ex, ey, 4, P.iron[2]); line(bx - 1, by - 1, ex - 1, ey - 1, 1, P.iron[4]);
          line(ex - 1, ey + 1, ex + 2, ey - 2, 2, P.iron[0]);
          if (k < S.n) bomb(ex, ey - 2);
        }
      },
      fx(x, y, o) { const S = shotsOf(o); if (!S.fire) return; const k = 4 - S.n - 1, tilt = 50 + (o.a || 0) * 0.4, L = 16 + (k % 2) * 5, r = tilt * Math.PI / 180; steamJet(x + 10 + k * 8 + Math.cos(r) * L, y + 37 - Math.sin(r) * L, tilt, 12, o.t, true); } },
    { key: 'T4b', tier: 4, name: '蒸汽弹射轨', ref: '新：一根斜轨 + 蒸汽活塞推的弹射滑块 + 轨尾一只竖弹仓',
      idea: '（T4 镀镍候选）一根斜着往上的弹射轨，轨尾立着一只开了观察窗的竖弹仓，里面的炸弹一个摞一个看得见；开火时蒸汽活塞把滑块沿轨道猛推上去，把炸弹甩出轨头，滑块退回、下一枚掉进来。',
      draw(x, y, o) {
        box(x + 4, y + 40, 40, 8, IRON); const S = shotsOf(o);
        box(x + 3, y + 8, 11, 33, IRONL); R(x + 5, y + 11, 7, 27, P.dark[0]); R(x + 3, y + 8, 11, 2, P.brass[1]);
        for (let k = 0; k < Math.max(0, S.n - 1); k++) bomb(x + 8.5, y + 35 - k * 7);
        turn(x + 14, y + 36, 28 + (o.a || 0) * 0.4, (X, Y) => {
          R(X - 2, Y - 2, 38, 4, P.iron[0]); R(X - 2, Y - 2, 38, 1, P.iron[3]); for (let u = 2; u < 36; u += 6) px(X + u, Y, P.iron[4]);
          htube(X, Y + 2, 16, 5, IRONL); R(X + 16, Y + 3, 2, 3, P.brass[1]);
          const sh = S.fire ? 24 : 0; R(X + 4 + sh, Y - 5, 7, 3, P.brass[1]); R(X + 4 + sh, Y - 5, 7, 1, P.brass[3]); if (sh) R(X + 4, Y - 3, sh, 1, P.iron[4]);
          if (S.n > 0 && !S.fire) bomb(X + 7.5, Y - 8);
        });
        pin(x + 14, y + 36);
      },
      fx(x, y, o) { const S = shotsOf(o); if (!S.fire) return; const [bx, by] = at(x + 14, y + 36, 28 + (o.a || 0) * 0.4, 0, 5); steamJet(bx, by, 28 + 180, 10, o.t, true); } },
    { key: 'T5a', tier: 5, name: '火箭助推炸弹', ref: '新：炸弹屁股上绑一节火箭筒 + 导向尾杆（康格里夫的思路套在炸弹上）',
      idea: '（T5 乌兹钢候选）四条短导轨上下排成梯子，每条上面一枚「火箭炸弹」：前头是圆胖炸弹，后面绑着一节火箭筒和一根导向尾杆。开火时尾部喷火，一枚接一枚冲出去。从「扔」过渡到「射」的一档。',
      draw(x, y, o) {
        box(x + 8, y + 40, 32, 8, IRON); const S = shotsOf(o);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          R(X - 18, Y - 14, 3, 26, P.iron[0]); R(X - 18, Y - 14, 1, 26, P.iron[3]); R(X + 14, Y - 14, 3, 26, P.iron[0]);
          for (let k = 0; k < 4; k++) {
            const v = -11 + k * 6.5; R(X - 18, Y + v + 3, 36, 1, P.iron[2]);
            if (k < S.n) { R(X - 16, Y + v + 1, 18, 1, P.leather[2]); R(X + 2, Y + v - 1, 10, 3, P.iron[3]); R(X + 2, Y + v - 1, 10, 1, P.iron[4]); R(X + 5, Y + v - 1, 1, 3, P.brass[1]); bomb(X + 15, Y + v); }
          }
        });
        pin(x + 24, y + 28);
      },
      fx(x, y, o) { const S = shotsOf(o); if (!S.fire) return; const k = 4 - S.n - 1, [bx, by] = at(x + 24, y + 28, o.a, 1, -11 + k * 6.5); flameJet2(bx, by, o.a + 180, 12, o.t); } },
    { key: 'T5b', tier: 5, name: '转轮弹巢', ref: 'v1 火箭架 D，放到高阶做候选',
      idea: '（T5 乌兹钢候选）一只大转轮，侧面四道弹巢槽，每发一次转一格；上面一根长发射管。像一把放大的左轮。', draw(x, y, o) { const S = shotsOf(o); ROCKET[3].draw(x, y, { ...o, n: S.n }); }, fx: tubeFx(-14, -9) },
    { key: 'T6', tier: 6, name: '管束发射架', ref: 'v1 火箭架 A：选作最高档（从「扔」一路进化到真正的火箭）',
      idea: '（T6 以太合金）四根粗发射管上下叠成一束，两道箍扎紧，管口露出红色弹头；装在矮炮床的耳轴上。一发一发打出去，管尾喷烟。这一档是整条进化线的终点：真正的火箭。', draw(x, y, o) { const S = shotsOf(o); ROCKET[0].draw(x, y, { ...o, n: S.n }); }, fx: tubeFx(-18, -8) },
  ];
  const LINEUP = ['T1', 'T2', 'T3a', 'T4a', 'T5a', 'T6'];   // 推荐的六档（T3～T5 各有两个候选）
  // 火箭：发射那一下，管尾喷一团烟、带一点火
  function rocketFx(x, y, o) {
    if (!o.fire) return;
    const [bx, by] = at(x + 24, y + 28, o.a, -20, -8 + (4 - o.n - 1) * 5.3);
    steamJet(bx, by, o.a + 180, 16, o.t, true); flameJet(bx, by, o.a + 180, 6, o.t);
  }
  const lerp = (lo, hi, t) => lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * 0.025));
  const MODS = [
    { id: 'harpoon', name: '鱼叉 · 链锚抓钩 + 绞缆盘', w: 2, h: 1, piv: [18, 13], elev: [-10, 28], tiers: [1, 2, 3, 4, 5, 6], SET: HARPOON2,
      rule: '2×1 · 第三章 · 耳轴 (18,13)、爪尖离耳轴 34 · 选定 E 链锚抓钩，身后的绞缆盘占满模块高度 · 页面循环：瞄准 → 射出（绞盘放缆，缆绳 + 一段铁链绷直伸出去）→ 收回',
      state: (t) => { const c = t % 120; return { t, a: lerp(-10, 28, t), out: c >= 60 && c < 110, k: c >= 60 && c < 66 ? 1 - (c - 60) / 6 : 0 }; },
      poses: [{ a: -10 }, { a: 0 }, { a: 28 }, { a: 10, out: true }] },
    { id: 'steamjet', name: '蒸汽喷射器 · 扇形喷汽阀 · T1～T3', w: 2, h: 1, piv: [18, 13], elev: [-12, 25], tiers: [1, 2, 3], SET: STEAM.filter(e => e.key === 'A'),
      rule: '2×1 · 第三章 · 选定 A 扇形喷汽阀，不改 · 只做黄铜 → 熟铁 → 钢 · 页面循环：待机（喷口丝丝冒汽）→ 喷射',
      state: (t) => { const c = t % 100; return { t, a: lerp(-12, 25, t), on: c >= 40 && c < 90 }; },
      poses: [{ a: -12 }, { a: 0 }, { a: 25 }, { a: 8, on: true }] },
    { id: 'flamer', name: '喷火器 · 翅片喷焰炮 · T4～T6', w: 2, h: 1, piv: [18, 13], elev: [-12, 25], tiers: [4, 5, 6], SET: FLAME2,
      rule: '2×1 · 第三章 · 选定 F 翅片喷焰炮：去掉电极；火焰改成实心火锥 + 白汽领子 + 火舌尖化成汽团（和蒸汽喷射器一家）· 只做镀镍 → 乌兹钢 → 以太合金 · 页面循环：待机（小火苗）→ 喷火',
      state: (t) => { const c = t % 100; return { t, a: lerp(-12, 25, t), on: c >= 40 && c < 90 }; },
      poses: [{ a: -12 }, { a: 0 }, { a: 25 }, { a: 8, on: true }] },
    { id: 'rocket_rack', name: '火箭架 · 六档六种（从扔到射）', w: 2, h: 2, piv: [24, 28], elev: [-8, 38], tiers: [1, 2, 3, 4, 5, 6], SET: ROCKET6, lineup: true,
      rule: '2×2 · 第四章 · 每档一种样式，从低到高是一条进化线：T1 投矛臂（人力杠杆）→ T2 投掷轮（飞轮）→ T3 钢（弹簧）→ T4 镀镍（蒸汽 / 气压）→ T5 乌兹钢（火箭助推）→ T6 以太合金（真正的火箭，v1 管束发射架）· 每个投射点一枚短炸弹，四个 = 四枚齐射 · T3～T5 各两个候选，每张卡只按它那一档的材质画',
      state: (t) => { const c = t % 150, a = lerp(-8, 38, t); if (c < 40) return { t, a, n: 4, s: 0 }; if (c < 76) return { t, a, n: 4, s: (c - 40) / 36 }; if (c < 100) return { t, a, n: 0, s: 0 }; return { t, a, n: Math.min(4, 1 + Math.floor((c - 100) / 12)), s: 0 }; },
      poses: [{ a: 10, n: 4, s: 0, label: '满 4 枚' }, { a: 10, n: 4, s: 0.18, label: '开火中' }, { a: 10, n: 4, s: 0.6, label: '打完' }, { a: 10, n: 2, s: 0, label: '装填 2 / 4' }] },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, m) { g = ctx; if (e.fx) e.fx(x, y, o); else if (m && m.fx) m.fx(x, y, o); }
  const byKey = (k) => ROCKET6.find(e => e.key === k);
  return { MODS, figure, over, LINEUP: LINEUP.map(byKey) };
})();
