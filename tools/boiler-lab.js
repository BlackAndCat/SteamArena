// 竖式锅炉 boiler_s（1×2 = 24 × 48）造型探索（tools/boiler-lab.html 专用，只做视觉，不接进游戏）。
// 2026-09-28 用户：锅炉最小就是 1×2；竖立炉身 + 烟囱 + 炉门火光；和水罐、蓄压罐分开（只有锅炉发光）。
// 三个候选都按 docs/visual-rules.md 做六档：形体在 T3、T5 跃迁（原形 → 方包壳平顶 → 斜肩板）；
// 散热口 3 竖缝 → 4 密排 → 两行 → 两行斜百叶；接缝铆钉 2 → 3 → 4（T1～3 黄铜、镀镍起钢质淡青）；
// 钢起包角铁；镀镍起直径 7 的小压力表（表位 = 顶上左侧，和 2×2 锅炉一样「表在左、烟囱在右」）。
// 画法同火炮家族：base（跟材料换色的铁件 + 语义色炉火）→ 材质处理 → over（铆钉、压力表，颜色固定）。
// o = { lv 1~3 火力, fr 0~3 帧 }
// v2（2026-09-28）：用户改选 A 立式锅炉，要求炉膛更大、更好认 → CANDS 换成 A2 大方炉门 / A3 拱形炉口，v1 的 A / B / C 挪到 HIST
window.SA = window.SA || {};

SA.BLLAB = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, DARK, BRASS } = SA.CAND;
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  function corner(x, y, fx = 1, fy = 1) {
    const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
    for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
    px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
  }
  function smallGauge(cx, cy) {   // 直径 7 的小压力表（和中炮同一件）
    disc(cx, cy, 3.4, P.brass[0]); disc(cx, cy, 2.6, P.steam[2]);
    px(Math.round(cx - 2), Math.round(cy - 2), P.brass[3]);
    px(Math.round(cx + 1), Math.round(cy - 2), P.gauge[1]); px(Math.round(cx + 2), Math.round(cy - 1), P.gauge[1]);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2), Math.round(cy - 1.5), 1, P.dark[0]);
  }
  // 散热口（窄区版，同中炮）：slits 竖缝间距 3 / slits2 密排间距 2 / grid2 两行短竖缝 / louver2 两行斜百叶
  function vents(x, y, style, n, h = 4) {
    const slit = (sx, sy, hh) => { R(sx, sy, 1, hh, P.iron[0]); R(sx + 1, sy, 1, hh, P.iron[3]); };
    if (style === 'slits') for (let i = 0; i < n; i++) slit(x + i * 3, y, h);
    else if (style === 'slits2') for (let i = 0; i < n; i++) slit(x + i * 2, y, h);
    else if (style === 'grid2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) slit(x + i * 2, y + ry, 2);
    else if (style === 'louver2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { px(x + i * 2 + k, y + ry + k, P.iron[0]); px(x + i * 2 + k + 1, y + ry + k, P.iron[3]); }
  }
  const ventW = (style, n) => (style === 'slits' ? n * 3 - 1 : n * 2 + (style === 'louver2' ? 1 : 0));
  // 圆柱明暗（竖放）：左边受光，ramp = 五阶（描边 → 最亮）
  const IRON5 = [P.iron[0], P.iron[1], P.iron[2], P.iron[3], P.iron[4]];
  const DARK5 = [P.dark[0], P.dark[1], P.dark[2], P.dark[3], P.iron[2]];
  function cyl(x0, y0, w, h, ramp = IRON5) {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const k = i === 0 || i === w - 1 ? 0 : t < 0.14 ? 3 : t < 0.3 ? 4 : t < 0.42 ? 3 : t < 0.78 ? 2 : 1;
      R(x0 + i, y0, 1, h, ramp[k]);
    }
  }
  // 炉火：暗炉膛 + 底部煤层；大块黑煤挤在一起，块间裂缝透出火光，火力越大裂缝越亮（同 2×2 锅炉的画法缩小）
  function fire(x0, y0, w, h, o = {}) {
    const lv = o.lv || 2, fr = o.fr || 0;
    R(x0, y0, w, h, P.dark[0]);
    const bed = Math.max(3, Math.round(h * 0.5)), by = y0 + h - bed;
    for (let i = 0; i < w; i++) { if ((i + fr) % 2 === 0) px(x0 + i, by - 2, P.fire[0]); px(x0 + i, by - 1, lv >= 3 ? P.fire[1] : P.fire[0]); }
    R(x0, by, w, bed, P.fire[1]);
    let lx = 0, k = 0;
    while (lx < w) {
      const lw = Math.min([3, 4, 3, 2][k % 4], w - lx), top = by + (k % 2), X = x0 + lx;
      R(X, top, lw, y0 + h - 1 - top, P.dark[1]); px(X, top, P.dark[3]); if (lw > 1) R(X + 1, top, lw - 1, 1, P.dark[2]);
      const hot = (k * 5 + fr) % 4;
      if (lx + lw < w) R(X + lw - 1, top + 1, 1, Math.max(1, y0 + h - 3 - top), hot < lv ? P.fire[Math.min(3, lv - 1 + (hot === 0 ? 1 : 0))] : P.fire[0]);
      lx += lw; k++;
    }
    R(x0, y0 + h - 1, w, 1, P.fire[lv >= 3 ? 2 : 1]);
    if (lv >= 2) px(x0 + (1 + fr * 3) % w, by - 3 - (fr % 2), P.fire[2]);
    if (lv >= 3) px(x0 + (w - 2 - fr * 2 + w * 4) % w, by - 4 + (fr % 2), P.fire[1]);
  }
  // 炉门框：厚铁框 + 左铰链（黄铜）+ 右门闩
  function door(x, y, w, h, o, fw = 2) {
    box(x, y, w, h, IRONL);
    fire(x + fw, y + fw, w - fw * 2, h - fw * 2, o);
    R(x - 1, y + 2, 2, 3, P.brass[1]); px(x - 1, y + 2, P.brass[3]); R(x - 1, y + h - 5, 2, 3, P.brass[1]); px(x - 1, y + h - 5, P.brass[3]);
    R(x + w - 2, y + (h >> 1) - 1, 2, 3, P.brass[2]); px(x + w - 2, y + (h >> 1) - 1, P.brass[3]);
  }
  const seam = (x0, x1, y) => { R(x0, y, x1 - x0 + 1, 1, P.iron[1]); R(x0, y + 1, x1 - x0 + 1, 1, P.iron[4]); };
  function rivets(xs, y, kind) { for (const x of xs) rivetC(x, y, RIVET_C[kind]); }
  // 烟囱：cap = rim 翻边（T1～2）/ box 方帽 + 挡雨缝（T3～4）/ slant 斜罩（T5～6）；x0 左沿、w 宽、y1 底
  function stack(x0, w, y0, y1, cap) {
    cyl(x0, y0, w, y1 - y0, DARK5);
    if (cap === 'rim') { R(x0 - 1, y0 - 2, w + 2, 2, P.dark[0]); R(x0, y0 - 2, w, 1, P.dark[3]); }
    else if (cap === 'box') {
      R(x0 - 2, y0 - 5, w + 4, 3, P.dark[0]); R(x0 - 1, y0 - 4, w + 2, 1, P.dark[3]);
      R(x0 + 1, y0 - 2, 1, 2, P.dark[0]); R(x0 + w - 2, y0 - 2, 1, 2, P.dark[0]);                                   // 帽和烟囱之间的两根支柱（中间是挡雨缝）
      R(x0 - 1, y0 + 3, w + 2, 2, P.dark[0]); R(x0, y0 + 3, w, 1, P.dark[3]);                                       // 一道箍
    } else {
      for (let k = 0; k < 4; k++) { R(x0 - 3 + k, y0 - 5 + k, w + 6 - k * 2, 1, k === 0 ? P.dark[3] : P.dark[2]); px(x0 - 3 + k, y0 - 5 + k, P.dark[0]); px(x0 + w + 2 - k, y0 - 5 + k, P.dark[0]); }
      R(x0 - 3, y0 - 6, w + 6, 1, P.dark[0]);
      R(x0 - 1, y0 + 3, w + 2, 2, P.dark[0]); R(x0, y0 + 3, w, 1, P.dark[3]);
    }
  }
  // 斜肩包壳：顶上两角各切掉 d 像素的 45° 斜板（T5～6 唯一的斜线）
  function slantBox(x, y, w, h, d) {
    box(x, y, w, h, IRONL);
    for (let k = 0; k < d; k++) {
      const n = d - k;
      g().clearRect(x, y + k, n, 1); g().clearRect(x + w - n, y + k, n, 1);
      px(x + n, y + k, P.iron[0]); px(x + w - 1 - n, y + k, P.iron[0]);
      if (k > 0) { px(x + n, y + k, P.iron[4]); px(x + w - 1 - n, y + k, P.iron[1]); }
    }
  }
  let G = null; const g = () => G;
  const TIERS = [
    { f: 'raw', vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { f: 'raw', vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { f: 'box', vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { f: 'box', vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { f: 'slant', vent: ['grid2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { f: 'slant', vent: ['louver2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];
  const capOf = (f) => (f === 'raw' ? 'rim' : f === 'box' ? 'box' : 'slant');
  const riveXs = (n, x0, x1) => (n === 2 ? [x0 + 1, x1 - 3] : Array.from({ length: n }, (_, i) => Math.round(x0 + (x1 - x0 - 2) * i / (n - 1))));
  const plinth = (x, y, w, h = 5) => { box(x, y, w, h, IRON); R(x + 1, y + 1, w - 2, 1, P.iron[3]); };

  // ================= A 立式锅炉：一根竖着的火管锅炉筒 =================
  // 原形 = 圆筒 + 平顶盖板；方包壳 = 方铁皮包住圆筒（平顶）；斜肩 = 包壳顶上两角斜切。烟囱在右上、表在左上，炉门在下半
  const A_ZONE = { stack: [14, 6, 3, 10], vent: [7, 14], seam: 20, riv: 22, door: [5, 26, 14, 12], corners: [[2, 38, 1, -1], [17, 38, -1, -1]], gauge: [7.5, 5.5] };
  function aBase(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const Z = A_ZONE;
    stack(x + Z.stack[0], Z.stack[1], y + Z.stack[2], y + Z.stack[3] + 1, capOf(T.f));
    if (T.f === 'raw') {
      cyl(x + 3, y + 11, 18, 32);
      box(x + 2, y + 9, 20, 3, IRONL);
      R(x + 3, y + 40, 18, 2, P.brass[1]); R(x + 3, y + 40, 18, 1, P.brass[3]);                                  // 底上一道黄铜箍
    } else if (T.f === 'box') {
      box(x + 2, y + 10, 20, 33, IRONL);
      box(x + 1, y + 8, 22, 3, IRON);                                                                            // 平顶盖板（厚一级）
    } else {
      slantBox(x + 2, y + 9, 20, 34, 4);
      R(x + 6, y + 8, 12, 2, P.iron[0]); R(x + 7, y + 8, 10, 1, P.iron[3]);
    }
    if (T.parts.includes('gauge')) { R(x + 7, y + 8, 1, 2, P.iron[0]); }                                          // 表杆
    seam(x + 3, x + 20, y + Z.seam);
    const [vs, vn] = T.vent; vents(x + 12 - (ventW(vs, vn) >> 1), y + Z.vent[1], vs, vn);
    door(x + Z.door[0], y + Z.door[1], Z.door[2], Z.door[3], o);
    if (T.parts.includes('corners')) for (const [cx, cy, fx, fy] of Z.corners) corner(x + cx, y + cy, fx, fy);
    plinth(x + 1, y + 43, 22);
  }
  function aOver(G0, x, y, T) {
    SA.CAND.use(G0); G = G0;
    rivets(riveXs(T.riv[0], 4, 20), y + A_ZONE.riv, T.riv[1]);
    if (T.parts.includes('gauge')) smallGauge(x + A_ZONE.gauge[0], y + A_ZONE.gauge[1]);
  }
  const A_ZONES_VIEW = [
    ['烟囱（右上，帽子随档变：翻边 → 方帽 + 挡雨缝 → 斜罩）', '#8f8a80', (x, y) => [x + 11, y - 3, 12, 15]],
    ['表位（镀镍起，直径 7）', '#f5d77a', (x, y) => [x + 3, y + 1, 9, 9]],
    ['散热区', '#6fcf6a', (x, y) => [x + 5, y + 13, 14, 6]],
    ['接缝 + 铆钉', '#46c2c9', (x, y) => [x + 3, y + 20, 18, 5]],
    ['功能区：炉门（永远不放零件）', '#ff6b4a', (x, y) => [x + 4, y + 26, 16, 12]],
    ['包角位（钢起）', '#c9a0ff', (x, y) => [x + 2, y + 38, 5, 5], (x, y) => [x + 17, y + 38, 5, 5]],
  ];

  // ================= B 炉灶式：铸铁炉 + 细烟管 + 大炉窗 =================
  // 原形 = 四条短腿 + 檐口 + 大炉窗（竖炉栅）；方包壳 = 实心底座、檐口加厚；斜肩 = 斜罩顶收进烟管 + 斜切底座
  const B_ZONE = { pipe: [10, 4, 3, 9], riv: 13, win: [4, 17, 16, 17], vent: 37, corners: [[2, 34, 1, -1], [17, 34, -1, -1]], gauge: [5.5, 5.5] };
  function bBase(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const Z = B_ZONE;
    // 细烟管 + 风门箍
    stack(x + Z.pipe[0], Z.pipe[1], y + Z.pipe[2], y + Z.pipe[3] + 1, capOf(T.f));
    R(x + 9, y + 6, 6, 2, P.brass[1]); R(x + 9, y + 6, 6, 1, P.brass[3]);
    if (T.f === 'raw') {
      box(x + 2, y + 11, 20, 30, IRONL);
      box(x + 1, y + 9, 22, 3, IRON);                                                                            // 檐口
      for (const lx of [2, 18]) { R(x + lx, y + 41, 4, 5, P.iron[0]); R(x + lx + 1, y + 41, 2, 4, P.iron[3]); R(x + lx - 1, y + 45, 6, 2, P.iron[0]); }   // 短腿 + 脚
    } else if (T.f === 'box') {
      box(x + 2, y + 11, 20, 31, IRONL);
      box(x + 0, y + 8, 24, 4, IRON); R(x + 1, y + 9, 22, 1, P.iron[3]);                                        // 加厚檐口
      plinth(x + 1, y + 42, 22, 6);
    } else {
      box(x + 2, y + 12, 20, 30, IRONL);
      for (let k = 0; k < 4; k++) { R(x + 1 + k * 2, y + 8 + k, 22 - k * 4, 1, k === 0 ? P.iron[0] : P.iron[3]); px(x + 1 + k * 2, y + 8 + k, P.iron[0]); px(x + 22 - k * 2, y + 8 + k, P.iron[0]); }   // 斜罩顶
      R(x + 1, y + 11, 22, 1, P.iron[0]);
      for (let k = 0; k < 6; k++) { R(x + 1 + (k >> 1), y + 42 + k, 22 - (k >> 1) * 2, 1, k === 0 ? P.iron[0] : k === 1 ? P.iron[3] : P.iron[2]); px(x + 1 + (k >> 1), y + 42 + k, P.iron[0]); px(x + 22 - (k >> 1), y + 42 + k, P.iron[0]); }   // 斜切底座
    }
    // 大炉窗：竖炉栅（黑铁条）挡在火前
    const [wx, wy, ww, wh] = Z.win;
    box(x + wx, y + wy, ww, wh, IRON);
    fire(x + wx + 2, y + wy + 2, ww - 4, wh - 4, o);
    for (let i = 2; i < ww - 4; i += 3) R(x + wx + 2 + i, y + wy + 2, 1, wh - 4, P.dark[0]);
    R(x + wx - 1, y + wy + 3, 2, 3, P.brass[1]); R(x + wx - 1, y + wy + wh - 6, 2, 3, P.brass[1]);
    const [vs, vn] = T.vent; vents(x + 12 - (ventW(vs, vn) >> 1), y + Z.vent - (vs === 'grid2' || vs === 'louver2' ? 1 : 0), vs, vn, 3);   // 灰坑风门缝
    if (T.parts.includes('corners')) for (const [cx, cy, fx, fy] of Z.corners) corner(x + cx, y + cy, fx, fy);
  }
  function bOver(G0, x, y, T) {
    SA.CAND.use(G0); G = G0;
    rivets(riveXs(T.riv[0], 4, 20), y + B_ZONE.riv, T.riv[1]);
    if (T.parts.includes('gauge')) { smallGauge(x + B_ZONE.gauge[0], y + B_ZONE.gauge[1]); }
  }
  const B_ZONES_VIEW = [
    ['细烟管 + 黄铜风门箍', '#8f8a80', (x, y) => [x + 7, y - 3, 10, 12]],
    ['表位（镀镍起）', '#f5d77a', (x, y) => [x + 1, y + 1, 9, 9]],
    ['檐口下的铆钉排', '#46c2c9', (x, y) => [x + 3, y + 12, 18, 4]],
    ['功能区：大炉窗 + 竖炉栅', '#ff6b4a', (x, y) => [x + 3, y + 17, 18, 17]],
    ['散热区（灰坑风门缝）', '#6fcf6a', (x, y) => [x + 5, y + 36, 14, 5]],
    ['包角位（钢起）', '#c9a0ff', (x, y) => [x + 2, y + 34, 5, 5], (x, y) => [x + 17, y + 34, 5, 5]],
  ];

  // ================= C 高烟囱：矮炉身 + 一根又粗又高的烟囱 =================
  // 剪影靠烟囱：上面 18px 全给烟囱，一眼是「会冒烟的东西」；左上一只黄铜汽笛；下面烟箱带 + 炉门
  const C_ZONE = { stack: [6, 9, 5, 18], whistle: 2, box: 19, vent: 21, seam: 26, riv: 28, door: [5, 31, 14, 11], corners: [[2, 38, 1, -1], [17, 38, -1, -1]], gauge: [19.5, 13.5] };
  function cBase(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const Z = C_ZONE;
    stack(x + Z.stack[0], Z.stack[1], y + Z.stack[2], y + Z.stack[3] + 1, capOf(T.f));
    // 黄铜汽笛（左上）
    R(x + 2, y + 12, 3, 6, P.brass[1]); R(x + 2, y + 12, 1, 6, P.brass[3]); R(x + 1, y + 11, 5, 1, P.brass[0]); R(x + 3, y + 18, 1, 1, P.brass[0]);
    if (T.f === 'raw') {
      box(x + 2, y + 19, 20, 7, DARK);                                                                           // 烟箱带（烟熏黑）
      cyl(x + 3, y + 26, 18, 17);
    } else if (T.f === 'box') {
      box(x + 1, y + 18, 22, 8, IRON);
      box(x + 2, y + 26, 20, 17, IRONL);
    } else {
      slantBox(x + 1, y + 18, 22, 8, 3);
      box(x + 2, y + 26, 20, 17, IRONL);
    }
    seam(x + 3, x + 20, y + Z.seam);
    const [vs, vn] = T.vent; vents(x + 12 - (ventW(vs, vn) >> 1), y + Z.vent - (vs === 'grid2' || vs === 'louver2' ? 1 : 0), vs, vn, vs === 'grid2' || vs === 'louver2' ? 2 : 3);
    door(x + Z.door[0], y + Z.door[1], Z.door[2], Z.door[3], o);
    if (T.parts.includes('corners')) for (const [cx, cy, fx, fy] of Z.corners) corner(x + cx, y + cy, fx, fy);
    plinth(x + 1, y + 43, 22);
  }
  function cOver(G0, x, y, T) {
    SA.CAND.use(G0); G = G0;
    rivets(riveXs(T.riv[0], 4, 20), y + C_ZONE.riv, T.riv[1]);
    if (T.parts.includes('gauge')) smallGauge(x + C_ZONE.gauge[0], y + C_ZONE.gauge[1]);
  }
  const C_ZONES_VIEW = [
    ['高烟囱（占上面 18px，帽子随档变）', '#8f8a80', (x, y) => [x + 3, y - 1, 15, 20]],
    ['黄铜汽笛', '#f5d77a', (x, y) => [x + 1, y + 10, 6, 9]],
    ['表位（镀镍起，烟囱右侧）', '#ffd0a0', (x, y) => [x + 16, y + 10, 8, 8]],
    ['烟箱带 + 散热区', '#6fcf6a', (x, y) => [x + 2, y + 19, 20, 7]],
    ['接缝 + 铆钉', '#46c2c9', (x, y) => [x + 3, y + 26, 18, 5]],
    ['功能区：炉门', '#ff6b4a', (x, y) => [x + 4, y + 31, 16, 11]],
    ['包角位（钢起）', '#c9a0ff', (x, y) => [x + 2, y + 38, 5, 5], (x, y) => [x + 17, y + 38, 5, 5]],
  ];

  // ================= v2（2026-09-28 用户：采用 A 立式锅炉，扩大炉膛、让燃火的部分占更多空间）=================
  // 大炉膛的火：暗炉膛 + 底部煤层 + 从煤缝里窜起的火舌（芯黄 → 橙 → 红尖），火力决定火舌高度，4 帧摇曳
  const SWAY = [0, 1, 0, -1], TALL = [1, 0.8, 0.92, 0.72];
  function fireBig(x0, y0, w, h, o = {}) {
    const lv = o.lv || 2, fr = o.fr || 0;
    R(x0, y0, w, h, P.dark[0]);
    const bed = Math.max(4, Math.round(h * 0.3)), by = y0 + h - bed;
    const fh = Math.round((h - bed) * [0, 0.5, 0.75, 0.95][lv]);
    for (let yy = by - Math.round(fh * 0.7); yy < by; yy++) for (let i = 0; i < w; i++) if (((i + yy + fr) & 1) === 0) px(x0 + i, yy, P.fire[0]);   // 炉膛后壁的余光（抖动）
    const n = Math.max(2, Math.round(w / 5)), step = w / n;
    for (let k = 0; k < n; k++) {
      const c = x0 + (k + 0.5) * step + SWAY[(fr + k) % 4], H = Math.max(3, Math.round(fh * TALL[(fr + k * 2) % 4])), hw = step * 0.62 + 0.5;
      for (let r = 0; r < H; r++) {
        const t = r / H, half = hw * Math.pow(1 - t, 0.8);
        for (let i = 0; i < w; i++) {
          const dx = Math.abs(x0 + i + 0.5 - c); if (dx > half) continue;
          const inner = dx <= half * 0.5;
          px(x0 + i, by - 1 - r, t < 0.45 && inner ? P.fire[3] : t < 0.75 && inner ? P.fire[2] : t < 0.4 ? P.fire[2] : P.fire[1]);
        }
      }
    }
    if (lv >= 2) { px(x0 + (2 + fr * 3) % w, by - fh - 2 + (fr % 2), P.fire[2]); }
    if (lv >= 3) { px(x0 + (w - 3 - fr * 4 + w * 4) % w, by - fh - 1 - (fr % 2), P.fire[3]); px(x0 + (5 + fr * 5) % w, by - fh - 4, P.fire[1]); }
    // 煤层：大块黑煤，块间裂缝透出火光
    R(x0, by, w, bed, P.fire[1]);
    let lx = 0, k = 0;
    while (lx < w) {
      const lw = Math.min([4, 3, 4, 3][k % 4], w - lx), top = by + (k % 2), X = x0 + lx;
      R(X, top, lw, y0 + h - 1 - top, P.dark[1]); px(X, top, P.dark[3]); if (lw > 1) R(X + 1, top, lw - 1, 1, P.dark[2]);
      const hot = (k * 5 + fr) % 4;
      if (lx + lw < w) R(X + lw - 1, top + 1, 1, Math.max(1, y0 + h - 3 - top), hot < lv ? P.fire[Math.min(3, lv - 1 + (hot === 0 ? 1 : 0))] : P.fire[0]);
      lx += lw; k++;
    }
    R(x0, y0 + h - 1, w, 1, P.fire[lv >= 3 ? 2 : 1]);                                                               // 炉栅下透出的灰坑红光
  }
  // 大炉口：暗铁厚框（外沿描边 + 内沿黑口）+ 左侧两只黄铜铰链 + 右侧门闩；arch = 顶上半圆拱 + 黄铜拱心石
  function mouth(x, y, w, h, o, arch) {
    box(x, y, w, h, IRON);
    const fx = x + 2, fy = y + 2, fw = w - 4, fh = h - 4;
    fireBig(fx, fy, fw, fh, o);
    if (arch) {
      const r = fw / 2, cx = fx + r, cy = fy + r;
      for (let yy = fy; yy < cy; yy++) for (let xx = fx; xx < fx + fw; xx++) {
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) px(xx, yy, P.iron[2]); else if (d > r - 1) px(xx, yy, P.dark[0]);
      }
      R(cx - 1, fy - 2, 2, 3, P.brass[2]); px(cx - 1, fy - 2, P.brass[3]); R(cx - 1, fy + 1, 2, 1, P.brass[0]);   // 拱心石
    } else {
      R(fx, fy, fw, 1, P.dark[0]);                                                                                    // 上沿压一条黑口，火像是在门里面
    }
    R(fx - 1, fy + fh, fw + 2, 1, P.iron[0]);                                                                         // 炉栅横档
    R(x - 1, y + 3, 2, 3, P.brass[1]); px(x - 1, y + 3, P.brass[3]); R(x - 1, y + h - 6, 2, 3, P.brass[1]); px(x - 1, y + h - 6, P.brass[3]);
    R(x + w - 2, y + (h >> 1) - 1, 2, 3, P.brass[2]); px(x + w - 2, y + (h >> 1) - 1, P.brass[3]);
  }
  // 布局：烟囱右上、表左上（镀镍起）；盖板下一条窄带放铆钉 + 散热口；炉口从 y 19 一直到 y 42（18 × 24，火 14 × 20，原来 A 是 10 × 8）；
  // 包角铁挪到底座两端（炉口占满了下半，没有别的角可包）
  const V2_ZONE = { stack: [15, 5, 2, 10], riv: 12, vent: 15, door: [3, 19, 18, 24], corners: [[1, 43, 1, -1], [19, 43, -1, -1]], gauge: [7.5, 5.5] };
  function v2Base(arch) {
    return (G0, x, y, T, o = {}) => {
      SA.CAND.use(G0); G = G0; const Z = V2_ZONE;
      stack(x + Z.stack[0], Z.stack[1], y + Z.stack[2], y + Z.stack[3] + 1, capOf(T.f));
      if (T.f === 'raw') { cyl(x + 3, y + 11, 18, 32); box(x + 2, y + 9, 20, 3, IRONL); }
      else if (T.f === 'box') { box(x + 2, y + 10, 20, 33, IRONL); box(x + 1, y + 8, 22, 3, IRON); }
      else { slantBox(x + 2, y + 9, 20, 34, 4); R(x + 6, y + 8, 12, 2, P.iron[0]); R(x + 7, y + 8, 10, 1, P.iron[3]); }
      if (T.parts.includes('gauge')) R(x + 7, y + 8, 1, 2, P.iron[0]);
      const [vs, vn] = T.vent, two = vs === 'grid2' || vs === 'louver2';
      vents(x + 12 - (ventW(vs, vn) >> 1), y + Z.vent - (two ? 1 : 0), vs, vn, two ? 2 : 3);
      mouth(x + Z.door[0], y + Z.door[1], Z.door[2], Z.door[3], o, arch);
      plinth(x + 1, y + 43, 22);
      if (T.parts.includes('corners')) for (const [cx, cy, fx, fy] of Z.corners) corner(x + cx, y + cy, fx, fy);
    };
  }
  function v2Over(G0, x, y, T) {
    SA.CAND.use(G0); G = G0;
    rivets(riveXs(T.riv[0], 4, 20), y + V2_ZONE.riv, T.riv[1]);
    if (T.parts.includes('gauge')) smallGauge(x + V2_ZONE.gauge[0], y + V2_ZONE.gauge[1]);
  }
  const V2_ZONES_VIEW = [
    ['烟囱（右上，帽子随档变）', '#8f8a80', (x, y) => [x + 12, y - 4, 11, 15]],
    ['表位（镀镍起，直径 7）', '#f5d77a', (x, y) => [x + 3, y + 1, 9, 9]],
    ['铆钉 + 散热口（盖板下的窄带）', '#46c2c9', (x, y) => [x + 3, y + 11, 18, 7]],
    ['功能区：大炉口（18 × 24，永远不放零件）', '#ff6b4a', (x, y) => [x + 2, y + 18, 20, 25]],
    ['包角位（钢起，底座两端）', '#c9a0ff', (x, y) => [x + 1, y + 43, 5, 5], (x, y) => [x + 19, y + 43, 5, 5]],
  ];

  const CANDS = [
    { key: 'A2', name: 'A2 立式 · 大方炉门', idea: 'A 的炉身，炉口放大到 18 × 24（火 14 × 20，原来 10 × 8），占掉下半个模块；火舌从煤缝窜起、随火力长高。上面只留一条窄带放铆钉和散热口', base: v2Base(false), over: v2Over, zones: V2_ZONES_VIEW },
    { key: 'A3', name: 'A3 立式 · 拱形炉口', idea: '同 A2，炉口顶上是半圆拱 + 黄铜拱心石——「炉子嘴」的样子，1× 远看也是一个发光的拱门，和水罐的方窗分得最开', base: v2Base(true), over: v2Over, zones: V2_ZONES_VIEW },
  ];
  // v1 三个方向（A 立式 / B 炉灶式 / C 高烟囱），留作记录
  const HIST = [
    { key: 'A', name: 'A 立式锅炉', idea: '一根竖着的火管锅炉筒：平顶盖板、右上烟囱、下半炉门。最「老实」，和 2×2 锅炉同一套（表在左、烟囱在右、炉门在下）', base: aBase, over: aOver, zones: A_ZONES_VIEW },
    { key: 'B', name: 'B 炉灶式', idea: '维多利亚铸铁炉：檐口 + 细烟管 + 占半个模块的大炉窗（竖炉栅），T1～2 四条短腿。火光面积最大，一眼是「烧火的」', base: bBase, over: bOver, zones: B_ZONES_VIEW },
    { key: 'C', name: 'C 高烟囱', idea: '矮炉身 + 又粗又高的烟囱占掉上面 18px，左上黄铜汽笛。剪影最强（1× 远看也知道是锅炉），和水罐、蓄压罐最不像', base: cBase, over: cOver, zones: C_ZONES_VIEW },
  ];
  return { TIERS, CANDS, HIST, fire, fireBig };
})();
