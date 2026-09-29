// 机枪家族造型探索（tools/mg-lab.html 专用，只做视觉，还没接进游戏）。
// 2026-09-28 用户：竖式锅炉、水罐进游戏后开始做机枪家族。家族 = 1×1 车载机枪 mg_s → 1×2 重机枪 mg_heavy → 2×2 机炮 mg（现有，最后按同一语言重画）。
// 参考 19 世纪末的机枪：刘易斯（顶置弹盘 + 散热片枪套）、哈乞开斯（枪管上的散热圈 + 侧面弹板）、加特林（转管 + 手摇曲柄 + 竖弹匣）、
// 马克沁（水冷枪套 + 弹链 + 枪口助退器）、诺登菲尔特（几根枪管叠在一起的排枪 + 顶上弹斗 + 后面的操纵杆）。
// 六档照 docs/visual-rules.md：形体在 T3、T5 跃迁（原形 → 方机匣平顶 → 斜面机匣 / 斜肩座），枪口 ① 直口箍 → ② 助退喇叭 / 加箍 → ③ 方制退器；
// 1×1 只靠剪影（不放铆钉 / 包角铁 / 压力表）；1×2 下半是弹药箱：盖板铆钉 2 → 3 → 4（T1～3 黄铜、镀镍起钢质淡青）、散热口 ≥ 3、钢起包角铁、镀镍起小压力表。
// 画法同火炮家族：base（跟材料换色的铁件 + 黄铜饰件）→ 材质处理 → over（铆钉、压力表，颜色固定）。
// 枪组先水平画在离屏（耳轴 = 支点），再转到仰角 a 贴回来（SA.CAND.turn）。o = { a 仰角°, k 后坐 0~8, f 供弹帧 0~11 }
window.SA = window.SA || {};

SA.MGLAB = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, DARK, BRASS } = SA.CAND;
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  const riveXs = (n, x0, x1) => (n === 2 ? [x0 + 1, x1 - 3] : Array.from({ length: n }, (_, i) => Math.round(x0 + (x1 - x0 - 2) * i / (n - 1))));
  function corner(x, y, fx = 1, fy = 1) {
    const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
    for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
    px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
  }
  function smallGauge(cx, cy) {
    disc(cx, cy, 3.4, P.brass[0]); disc(cx, cy, 2.6, P.steam[2]);
    px(Math.round(cx - 2), Math.round(cy - 2), P.brass[3]);
    px(Math.round(cx + 1), Math.round(cy - 2), P.gauge[1]); px(Math.round(cx + 2), Math.round(cy - 1), P.gauge[1]);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2), Math.round(cy - 1.5), 1, P.dark[0]);
  }
  function vents(x, y, style, n, h = 3) {
    const slit = (sx, sy, hh) => { R(sx, sy, 1, hh, P.iron[0]); R(sx + 1, sy, 1, hh, P.iron[3]); };
    if (style === 'slits') for (let i = 0; i < n; i++) slit(x + i * 3, y, h);
    else if (style === 'slits2') for (let i = 0; i < n; i++) slit(x + i * 2, y, h);
    else if (style === 'grid2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) slit(x + i * 2, y + ry, 2);
    else for (const ry of [0, 3]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { px(x + i * 2 + k, y + ry + k, P.iron[0]); px(x + i * 2 + k + 1, y + ry + k, P.iron[3]); }
  }
  const TIERS = [
    { f: 'raw', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { f: 'raw', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { f: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { f: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { f: 'slant', b: 3, vent: ['grid2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { f: 'slant', b: 3, vent: ['louver2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];

  // ---------- 枪组零件（水平画，C / M = 耳轴）----------
  // 横向圆管：从 x0 到 x1（不含），半高 hh
  function tube(x0, x1, M, hh) {
    for (let x = x0; x < x1; x++) {
      R(x, M - hh, 1, hh * 2 + 1, P.iron[0]);
      if (hh > 0) { R(x, M - hh + 1, 1, hh * 2 - 1, P.iron[3]); px(x, M - hh + 1, P.iron[4]); if (hh > 1) px(x, M + hh - 1, P.iron[2]); }
    }
  }
  const ring = (x0, w, M, hh) => { R(x0, M - hh, w, hh * 2 + 1, P.iron[0]); R(x0 + 1, M - hh + 1, Math.max(1, w - 2), hh * 2 - 1, P.iron[3]); R(x0 + 1, M - hh + 1, Math.max(1, w - 2), 1, P.iron[4]); };
  const brassRing = (x0, w, M, hh) => { R(x0, M - hh, w, hh * 2 + 1, P.brass[0]); R(x0, M - hh + 1, w, hh * 2 - 1, P.brass[1]); R(x0, M - hh + 1, 1, hh * 2 - 1, P.brass[3]); };
  // 枪口：b 1 直口箍 / 2 喇叭助退器 / 3 方制退器（两侧开槽）；返回枪口末端 x
  function muzzle(end, M, b, hh = 1) {
    if (b === 1) { ring(end - 2, 2, M, hh + 1); px(end - 1, M, P.black); return end; }
    if (b === 2) { for (let i = 0; i < 4; i++) ring(end - 4 + i, 1, M, hh + 1 + (i >> 1)); px(end - 1, M, P.black); return end; }
    ring(end - 5, 5, M, hh + 2); R(end - 4, M - hh - 1, 3, 1, P.dark[0]); R(end - 4, M + hh + 1, 3, 1, P.dark[0]); px(end - 1, M, P.black); return end;
  }
  const flash = (end, M, k) => { if (k >= 6) { R(end, M - 1, 3, 3, P.fire[3]); px(end + 3, M, P.fire[2]); px(end + 1, M - 2, P.fire[2]); px(end + 1, M + 2, P.fire[2]); } };
  // 机匣：raw 圆角 / box 方 + 平顶盖 / slant 前上角斜切；(x0, y0) 左上，w × h
  function receiver(x0, y0, w, h, f) {
    box(x0, y0, w, h, IRON);
    if (f === 'raw') { G.clearRect(x0, y0, 1, 1); G.clearRect(x0 + w - 1, y0, 1, 1); G.clearRect(x0, y0 + h - 1, 1, 1); G.clearRect(x0 + w - 1, y0 + h - 1, 1, 1); }
    else if (f === 'box') { R(x0 - 1, y0 - 1, w + 2, 2, P.iron[0]); R(x0, y0 - 1, w, 1, P.iron[3]); }
    else { const d = Math.min(4, h - 3); for (let k = 0; k < d; k++) { G.clearRect(x0 + w - d + k, y0 + k, d - k, 1); px(x0 + w - d + k - 1, y0 + k, P.iron[0]); } }
  }
  const grips = (C, M, len = 3) => { R(C - len, M - 2, len, 1, P.dark[0]); R(C - len, M + 1, len, 1, P.dark[0]); R(C - len - 1, M - 2, 1, 4, P.iron[0]); px(C - len - 1, M - 2, P.brass[2]); px(C - len - 1, M + 1, P.brass[2]); };
  let G = null;

  // ================= 1×1 车载机枪 mg_s（24 × 24，耳轴 (11,12)，架子在下半）=================
  const S_PIV = [11, 12];
  // 枪架：raw 三脚短架 / box 方座 / slant 斜肩方座
  function sMount(x, y, f) {
    if (f === 'raw') {
      line(x + 11, y + 17, x + 5, y + 22, 2, P.iron[0]); line(x + 12, y + 17, x + 18, y + 22, 2, P.iron[0]);
      line(x + 11, y + 17, x + 6, y + 21, 1, P.iron[3]); line(x + 12, y + 17, x + 17, y + 21, 1, P.iron[3]);
      R(x + 3, y + 22, 4, 2, P.iron[0]); R(x + 17, y + 22, 4, 2, P.iron[0]);
      box(x + 10, y + 13, 4, 7, IRONL);
    } else if (f === 'box') {
      box(x + 10, y + 12, 4, 5, IRONL);
      box(x + 5, y + 16, 14, 8, IRONL); R(x + 6, y + 19, 12, 1, P.iron[1]);
    } else {
      box(x + 10, y + 12, 4, 5, IRONL);
      box(x + 5, y + 16, 14, 8, IRONL);
      for (let k = 0; k < 3; k++) { G.clearRect(x + 19 - 3 + k, y + 16 + k, 3 - k, 1); px(x + 19 - 3 + k - 1, y + 16 + k, P.iron[0]); }
      R(x + 6, y + 19, 12, 1, P.iron[1]);
    }
    box(x + 8, y + 9, 7, 6, IRON);                                                                                   // 叉形摇架
  }
  const pivotBolt = (cx, cy) => { disc(cx + 0.5, cy + 0.5, 1.6, P.brass[0]); px(cx, cy, P.brass[3]); };
  // A 刘易斯式：顶置扁弹盘（随供弹转）+ 带散热片的粗枪套 + 细枪管
  function sA(C, M, T, o) {
    const f4 = (o.f || 0) % 4, b = T.b;
    tube(C + 4, C + 15, M, 3);
    for (let i = C + 5; i < C + 15; i += 2) R(i, M - 2, 1, 5, P.iron[1]);                                            // 散热片的缝
    tube(C + 15, C + 21, M, 1);
    flash(muzzle(C + 21 + (b === 3 ? 2 : 0), M, b), M, o.k || 0);
    receiver(C - 7, M - 3, 11, 7, T.f);
    grips(C - 7, M);
    R(C - 8, M - 7, 13, 3, P.brass[0]); R(C - 7, M - 7, 11, 1, P.brass[3]); R(C - 7, M - 6, 11, 1, P.brass[2]);   // 扁弹盘（侧面看）
    R(C - 2, M - 8, 3, 1, P.brass[1]); px(C - 6 + f4 * 3, M - 6, P.brass[0]);
    R(C - 2, M - 4, 3, 1, P.iron[0]);
  }
  // B 哈乞开斯式：细枪管上一串散热圈 + 左侧伸出的黄铜弹板（逐发往里走）
  function sB(C, M, T, o) {
    const f4 = (o.f || 0) % 4, b = T.b;
    tube(C + 4, C + 21, M, 1);
    for (const rx of [C + 5, C + 8, C + 11]) ring(rx, 2, M, 4);
    if (b >= 2) brassRing(C + 14, 2, M, 2);
    flash(muzzle(C + 21 + (b === 3 ? 2 : 0), M, b), M, o.k || 0);
    receiver(C - 7, M - 3, 11, 7, T.f);
    grips(C - 7, M);
    R(C - 11, M - 5, 7, 2, P.brass[0]); for (let i = 0; i < 3; i++) { const bx = C - 11 + ((i * 2 + f4) % 7); R(bx, M - 7, 1, 2, P.brass[3]); px(bx, M - 5, P.brass[2]); }   // 弹板 + 板上的子弹
  }
  // C 小转管：三根枪管一束（亮的那根随供弹换位）+ 前后黄铜夹板 + 顶上竖弹匣 + 侧面手摇曲柄（随供弹转）
  function sC(C, M, T, o) {
    const f = o.f || 0, b = T.b;
    R(C + 4, M - 3, 16, 7, P.iron[0]);
    [-2, 0, 2].forEach((dy, i) => R(C + 4, M + dy, 16, 1, (i + f) % 3 === 0 ? P.iron[4] : P.iron[3]));
    brassRing(C + 4, 2, M, 4); brassRing(C + 17, 2, M, 4); if (b >= 2) brassRing(C + 11, 1, M, 4);
    if (b === 3) { ring(C + 20, 3, M, 4); R(C + 21, M - 3, 2, 1, P.dark[0]); R(C + 21, M + 3, 2, 1, P.dark[0]); }
    flash(C + (b === 3 ? 23 : 20), M, o.k || 0);
    receiver(C - 7, M - 3, 11, 7, T.f);
    R(C - 5, M - 10, 5, 7, P.brass[0]); R(C - 4, M - 9, 3, 6, P.brass[2]); R(C - 4, M - 9, 1, 6, P.brass[3]);       // 竖弹匣
    for (let i = 0; i < 3; i++) px(C - 3, M - 8 + i * 2, P.brass[0]);
    const cr = [[3, 0], [0, 3], [-3, 0], [0, -3]][f % 4];
    disc(C - 7.5, M + 1.5, 1.6, P.brass[1]); line(C - 8, M + 1, C - 8 + cr[0], M + 1 + cr[1], 1, P.dark[0]); px(C - 8 + cr[0], M + 1 + cr[1], P.brass[3]);
  }
  function sBase(gun) {
    return (G0, x, y, T, o = {}) => {
      SA.CAND.use(G0); G = G0;
      sMount(x, y, T.f);
      const k = Math.round((o.k || 0) / 8 * 2);
      SA.CAND.turn(x + S_PIV[0], y + S_PIV[1], o.a || 0, (X, Y) => { SA.CAND.use(G = SA.CAND.ctx()); gun(X - k, Y, T, o); });
      SA.CAND.use(G0); G = G0;
      pivotBolt(x + S_PIV[0], y + S_PIV[1]);
    };
  }

  // ================= 1×2 重机枪 mg_heavy（24 × 48：上半枪、下半弹药箱，耳轴 (13,12)：机匣后面的握把 / 操纵杆收在格子里）=================
  const H_PIV = [13, 12];
  const H_ZONE = { lid: 26, riv: 27, vent: [12, 33], gauge: [7.5, 35.5], corners: [[2, 39, 1, -1], [17, 39, -1, -1]] };
  // 下半：立柱 + 弹药箱（raw 圆角铁箱 + 提手 / box 方箱 + 厚盖 / slant 斜肩箱）+ 从箱里爬上去的弹链（在枪后面）+ 底座
  function hLower(x, y, T, o) {
    const f4 = (o.f || 0) % 4;
    box(x + 10, y + 14, 6, 12, IRONL);                                                                              // 立柱
    for (let i = 0; i < 6; i++) { const by = y + 25 - i * 2 - (f4 & 1), bx = x + 18 - Math.round(i * 0.6); R(bx, by, 3, 1, P.brass[2]); px(bx, by, P.brass[3]); px(bx + 3, by, P.dark[0]); }   // 弹链
    if (T.f === 'raw') { box(x + 3, y + 27, 18, 17, IRONL); for (const [cx, cy] of [[3, 27], [20, 27], [3, 43], [20, 43]]) G.clearRect(x + cx, y + cy, 1, 1); R(x + 8, y + 25, 8, 2, P.iron[0]); R(x + 9, y + 25, 6, 1, P.iron[3]); }
    else if (T.f === 'box') { box(x + 3, y + 28, 18, 16, IRONL); box(x + 2, y + 25, 20, 4, IRON); }
    else {
      box(x + 3, y + 28, 18, 16, IRONL); box(x + 2, y + 25, 20, 4, IRON);
      for (let k = 0; k < 3; k++) { G.clearRect(x + 2 + 3 - k - 1, y + 25 + k, 1, 1); G.clearRect(x + 2 + 20 - 3 + k, y + 25 + k, 3 - k, 1); }
    }
    const [vs, vn] = T.vent, two = vs === 'grid2' || vs === 'louver2';
    vents(x + H_ZONE.vent[0], y + H_ZONE.vent[1] - (two ? 1 : 0), vs, vn, two ? 2 : 3);
    R(x + 5, y + 40, 14, 1, P.iron[1]);
    box(x + 1, y + 44, 22, 4, IRON); R(x + 2, y + 45, 20, 1, P.iron[3]);
    if (T.parts.includes('corners')) for (const [cx, cy, fx, fy] of H_ZONE.corners) corner(x + cx, y + cy, fx, fy);
  }
  // A 马克沁式：粗水冷枪套（竖筋 + 顶上黄铜注水口）+ 枪口助退器 + 机匣右侧进弹口
  function hA(C, M, T, o) {
    const b = T.b;
    tube(C + 5, C + 22, M, 4);
    for (let i = C + 7; i < C + 21; i += 3) R(i, M - 3, 1, 7, P.iron[2]);
    R(C + 8, M - 5, 3, 1, P.brass[2]); px(C + 8, M - 5, P.brass[3]);
    ring(C + 21, 2, M, 5);
    tube(C + 23, C + 25, M, 1);
    flash(muzzle(C + 25 + (b === 1 ? 0 : 2), M, b === 1 ? 1 : b, 1), M, o.k || 0);
    receiver(C - 9, M - 4, 14, 9, T.f);
    grips(C - 9, M, 4);
    R(C + 1, M + 3, 3, 2, P.brass[1]);                                                                              // 进弹口
    if (b >= 2) brassRing(C + 5, 1, M, 4);
  }
  // B 加特林式：六管一束（看得见三根，亮的随供弹转）+ 前中后三道黄铜夹板 + 顶上高竖弹匣 + 机匣侧面曲柄
  function hB(C, M, T, o) {
    const f = o.f || 0, b = T.b;
    R(C + 5, M - 4, 20, 9, P.iron[0]);
    [-3, 0, 3].forEach((dy, i) => { R(C + 5, M + dy - 1, 20, 2, (i + f) % 3 === 0 ? P.iron[4] : P.iron[3]); R(C + 5, M + dy, 20, 1, (i + f) % 3 === 0 ? P.iron[3] : P.iron[2]); });
    brassRing(C + 5, 2, M, 5); brassRing(C + 14, 2, M, 5); brassRing(C + 23, 2, M, 5);
    if (b === 3) { ring(C + 25, 3, M, 5); R(C + 26, M - 4, 2, 1, P.dark[0]); R(C + 26, M + 4, 2, 1, P.dark[0]); }
    flash(C + (b === 3 ? 28 : 25), M, o.k || 0);
    receiver(C - 9, M - 4, 14, 9, T.f);
    R(C - 5, M - 14, 6, 11, P.brass[0]); R(C - 4, M - 13, 4, 10, P.brass[2]); R(C - 4, M - 13, 1, 10, P.brass[3]);   // 高竖弹匣
    for (let i = 0; i < 4; i++) R(C - 3, M - 12 + i * 2, 2, 1, P.brass[1]);
    const cr = [[4, 0], [0, 4], [-4, 0], [0, -4]][f % 4];
    disc(C - 9.5, M + 1.5, 2, P.brass[1]); line(C - 10, M + 1, C - 10 + cr[0], M + 1 + cr[1], 1, P.dark[0]); disc(C - 9.5 + cr[0], M + 1.5 + cr[1], 1, P.brass[3]);
  }
  // C 诺登菲尔特排枪：四根枪管叠成一块（前面黄铜夹板、四个黑枪口）+ 顶上梯形弹斗 + 机匣后面的操纵杆（随供弹摆）
  function hC(C, M, T, o) {
    const f = o.f || 0, b = T.b;
    R(C + 5, M - 5, 17, 11, P.iron[0]);
    for (let i = 0; i < 4; i++) { const yy = M - 4 + i * 3; R(C + 5, yy, 17, 2, P.iron[3]); R(C + 5, yy, 17, 1, P.iron[4]); }
    brassRing(C + 5, 2, M, 6); brassRing(C + 19, 3, M, 6);
    for (let i = 0; i < 4; i++) px(C + 21, M - 4 + i * 3, P.black);
    if (b >= 2) brassRing(C + 12, 1, M, 6);
    if (b === 3) { R(C + 22, M - 6, 3, 13, P.iron[0]); R(C + 22, M - 5, 2, 11, P.iron[3]); for (let i = 0; i < 4; i++) px(C + 24, M - 4 + i * 3, P.black); }
    const end = C + (b === 3 ? 25 : 22);
    if ((o.k || 0) >= 6) for (let i = 0; i < 4; i++) { R(end, M - 4 + i * 3, 2, 1, P.fire[3]); px(end + 2, M - 4 + i * 3, P.fire[2]); }
    receiver(C - 9, M - 4, 14, 9, T.f);
    for (let k = 0; k < 6; k++) R(C - 7 + (k >> 1), M - 11 + k, 12 - (k >> 1) * 2, 1, k === 0 ? P.brass[3] : P.brass[2]);   // 梯形弹斗
    R(C - 7, M - 12, 12, 1, P.brass[0]); for (let i = 0; i < 4; i++) px(C - 6 + i * 3, M - 11, P.brass[0]);
    const lv = [-4, -2, 0, -2][f % 4];
    line(C - 9, M + 2, C - 14, M + 2 + lv - 3, 2, P.iron[0]); disc(C - 14 + 0.5, M + lv - 1 + 0.5, 1.4, P.brass[2]);
  }
  function hBase(gun) {
    return (G0, x, y, T, o = {}) => {
      SA.CAND.use(G0); G = G0;
      hLower(x, y, T, o);
      const k = Math.round((o.k || 0) / 8 * 3);
      SA.CAND.turn(x + H_PIV[0], y + H_PIV[1], o.a || 0, (X, Y) => { SA.CAND.use(G = SA.CAND.ctx()); gun(X - k, Y, T, o); });
      SA.CAND.use(G0); G = G0;
      box(x + 10, y + 9, 7, 6, IRON);                                                                               // 摇架
      pivotBolt(x + H_PIV[0], y + H_PIV[1]);
    };
  }
  function hOver(G0, x, y, T) {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], 4, 20)) rivetC(x + rx, y + H_ZONE.riv, RIVET_C[T.riv[1]]);
    if (T.parts.includes('gauge')) smallGauge(x + H_ZONE.gauge[0], y + H_ZONE.gauge[1]);
  }
  const noOver = () => {};

  const S_ZONES = [['耳轴 (11,12) + 叉形摇架', '#f5d77a', (x, y) => [x + 7, y + 8, 9, 8]], ['枪架（T1～2 三脚 → T3～4 方座 → T5～6 斜肩座）', '#8f8a80', (x, y) => [x + 3, y + 15, 18, 9]], ['枪组（随仰角转，枪口伸出格子）', '#ff6b4a', (x, y) => [x + 3, y + 3, 30, 12]]];
  const H_ZONES = [['枪组（随仰角转，耳轴 (13,12)）', '#ff6b4a', (x, y) => [x + 1, y + 0, 38, 22]], ['立柱 + 弹链', '#8f8a80', (x, y) => [x + 10, y + 13, 11, 13]], ['弹药箱盖 + 铆钉', '#46c2c9', (x, y) => [x + 2, y + 25, 20, 5]], ['表位（镀镍起）', '#f5d77a', (x, y) => [x + 3, y + 31, 9, 9]], ['散热区', '#6fcf6a', (x, y) => [x + 11, y + 31, 10, 7]], ['包角位（钢起）', '#c9a0ff', (x, y) => [x + 2, y + 39, 5, 5], (x, y) => [x + 17, y + 39, 5, 5]]];

  const MODS = [
    { id: 'mg_s', name: '车载机枪', size: [1, 1], piv: S_PIV, cands: [
      { key: 'A', name: 'A 刘易斯式', idea: '顶置扁弹盘 + 带散热片的粗枪套 + 细枪管。弹盘让 1× 下的剪影是「枪上顶着一块饼」，和小炮的粗药室分得开', base: sBase(sA), over: noOver, zones: S_ZONES, blen: 21 },
      { key: 'B', name: 'B 哈乞开斯式', idea: '细枪管上串三道散热圈 + 左侧伸出的黄铜弹板（逐发往里走）。最「细长」，一眼是小口径速射', base: sBase(sB), over: noOver, zones: S_ZONES, blen: 21 },
      { key: 'C', name: 'C 小转管', idea: '三根枪管一束 + 前后黄铜夹板 + 顶上竖弹匣 + 侧面手摇曲柄（开火时转）。和现有 2×2 机炮的转管同一血缘', base: sBase(sC), over: noOver, zones: S_ZONES, blen: 20 },
    ] },
    { id: 'mg_heavy', name: '重机枪', size: [1, 2], piv: H_PIV, cands: [
      { key: 'A', name: 'A 马克沁式', idea: '粗水冷枪套（竖筋 + 黄铜注水口）+ 枪口助退器；下半弹药箱，弹链从箱里爬上去喂进机匣。最经典的「重机枪」', base: hBase(hA), over: hOver, zones: H_ZONES, blen: 25 },
      { key: 'B', name: 'B 加特林式', idea: '六管一束（开火时转）+ 三道黄铜夹板 + 顶上高竖弹匣 + 侧面曲柄。转管最直白，但和 2×2 机炮要拉开（机炮以后改别的形）', base: hBase(hB), over: hOver, zones: H_ZONES, blen: 25 },
      { key: 'C', name: 'C 诺登菲尔特排枪', idea: '四根枪管叠成一块 + 前面四个黑枪口 + 顶上梯形弹斗 + 后面操纵杆（开火时摆）。最蒸汽朋克、最少见，开火时四口齐闪', base: hBase(hC), over: hOver, zones: H_ZONES, blen: 22 },
    ] },
  ];
  return { TIERS, MODS };
})();
// 候选页（module-candidates.html）按模块读：SA[lab].TIERS / CANDS
SA.MGLAB_S = { TIERS: SA.MGLAB.TIERS, CANDS: SA.MGLAB.MODS[0].cands };
SA.MGLAB_H = { TIERS: SA.MGLAB.TIERS, CANDS: SA.MGLAB.MODS[1].cands };
