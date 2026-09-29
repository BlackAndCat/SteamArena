// 历史存档（原「当前开发」页）：机炮 + 双联机枪 v1 · 2026-09-28 · 用户否决：带供弹系统、太现代；改做最古早的蒸汽朋克设计（v2）
// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：机炮 mg + 双联机枪 mg2（2×2，2026-09-28）。机枪家族已定：车载机枪 = 侧舷枪座，重机枪 = 蒸汽加特林（都已进游戏）。
// 同一语言：车载枪座、没有三脚架 / 立柱 / 握把；固定部分是车体上的装甲壳（T1～2 铸造圆角 → T3～4 方壳平顶 → T5～6 斜面装甲），
// 转动部分是防盾 / 炮塔 + 枪（绕耳轴转到仰角）；供弹靠弹鼓 / 弹斗 / 蒸汽机，不露人手操作的东西。
// 2×2 零件照直射火炮：接缝铆钉 2 → 3 → 4（T1～3 黄铜、镀镍起钢质淡青）、散热口 横槽 2 → 3 → 双列 → 斜百叶、钢起包角铁、
// 镀镍起珐琅铭牌 + 直径 11 压力表。枪口 ① 直口箍 → ② 助退喇叭 / 加箍 → ③ 方制退器。
// o = { a 仰角°, k 后坐 0~8, f 供弹帧 }
window.SA = window.SA || {};

SA.MGL1 = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, BRASS } = SA.CAND;
  const COPPER = ['#3b2820', '#6b4632', '#8f6044', '#b3825c'];   // 同游戏里水罐的暗紫铜
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  const riveXs = (n, x0, x1) => Array.from({ length: n }, (_, i) => Math.round(x0 + (x1 - x0 - 2) * i / (n - 1)));
  let G = null;
  function corner(x, y, fx = 1, fy = 1) {
    const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
    for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
    px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
  }
  // 压力表 直径 11 / 珐琅铭牌 10×6（同 sprites.js 的 PART.gauge / PART.plate）
  function gauge(cx, cy) {
    disc(cx, cy, 5, P.brass[0]); disc(cx, cy, 4, P.brass[2]); disc(cx, cy, 3.2, P.steam[2]);
    px(Math.round(cx - 3), Math.round(cy - 3), P.brass[3]);
    for (let i = 0; i < 4; i++) { const a = Math.PI * (1.6 + i * 0.14); px(Math.round(cx - 0.5 + Math.cos(a) * 2.4), Math.round(cy - 0.5 + Math.sin(a) * 2.4), P.gauge[1]); }
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2.5), Math.round(cy - 2), 1, P.dark[0]);
    px(Math.round(cx - 0.5), Math.round(cy - 0.5), P.fire[1]);
  }
  function plate(x, y) {
    R(x, y, 10, 6, P.brass[0]); R(x + 1, y + 1, 8, 4, P.brass[2]); R(x + 1, y + 1, 8, 1, P.brass[3]);
    R(x + 2, y + 2, 6, 2, '#1c1a1f'); R(x + 3, y + 2, 4, 1, P.brass[1]); R(x + 3, y + 3, 3, 1, P.brass[1]);
  }
  // 散热口（同 PART.vents）：rows 单列横槽 / grid 双列 / louver 斜百叶
  function vents(x, y, style, n) {
    const slot = (sx, sy, w) => { R(sx, sy, w, 1, P.iron[0]); R(sx, sy + 1, w, 1, P.iron[3]); };
    if (style === 'rows') { const gap = n <= 2 ? 4 : 3; for (let i = 0; i < n; i++) slot(x, y + 1 + i * gap, 12); }
    else if (style === 'grid') { for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) slot(x + c * 8, y + i * 3, 6); }
    else for (let i = 0; i < n; i++) for (let k = 0; k < 7; k++) { px(x + i * 4 + (k >> 1), y + k, P.iron[0]); px(x + i * 4 + (k >> 1) + 1, y + k, P.iron[3]); }
  }
  const TIERS = [
    { f: 'raw', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { f: 'raw', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { f: 'box', b: 2, vent: ['rows', 3], riv: [3, 'brass'], parts: ['corners'] },
    { f: 'box', b: 2, vent: ['rows', 3], riv: [3, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { f: 'slant', b: 3, vent: ['grid', 3], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { f: 'slant', b: 3, vent: ['louver', 3], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
  ];

  // ---------- 装甲壳 ----------
  function shade(x, y, w, h, inside) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inside(xx, yy)) continue;
      if (!inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) || !inside(xx, yy + 1)) { px(xx, yy, P.iron[0]); continue; }
      px(xx, yy, !inside(xx - 2, yy) || !inside(xx, yy - 2) ? P.iron[4] : !inside(xx + 2, yy) || !inside(xx, yy + 2) ? P.iron[2] : P.iron[3]);
    }
  }
  function shellIn(x, y, w, h, f, r) {
    return (xx, yy) => {
      if (xx < x || yy < y || xx >= x + w || yy >= y + h) return false;
      if (f === 'box') return true;
      const ex = xx < x + r ? x + r - xx : xx >= x + w - r ? xx - (x + w - r - 1) : 0, ey = yy < y + r ? y + r - yy : yy >= y + h - r ? yy - (y + h - r - 1) : 0;
      if (f === 'raw') return ex * ex + ey * ey <= r * r + r * 0.6;
      const tx = xx - x, ty = yy - y, d = r + 2;
      return !(ty + tx < d - 2 || ty + (w - 1 - tx) < d + 1);
    };
  }
  const shell = (x, y, w, h, f, r) => { shade(x, y, w, h, shellIn(x, y, w, h, f, r)); if (f === 'box') { R(x - 1, y - 1, w + 2, 2, P.iron[0]); R(x, y - 1, w, 1, P.iron[3]); } };
  const seam = (x0, x1, y) => { R(x0, y, x1 - x0 + 1, 1, P.iron[1]); R(x0, y + 1, x1 - x0 + 1, 1, P.iron[4]); };
  // 车体下壳（机炮 A / B、双联 B 共用）：壳 + 底座 + 接缝；零件位：散热口 (19, top+7)、表 (12.5, top+11.5)、铭牌 (34, top+7)、底角包角铁
  function hull(x, y, T, top) {
    shell(x + 3, y + top, 42, 44 - top, T.f, 4);
    seam(x + 5, x + 42, y + top + 3);
    const [vs, vn] = T.vent; vents(x + 19, y + top + 7, vs, vn);
    box(x + 2, y + 44, 44, 4, IRON); R(x + 3, y + 45, 42, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 3, y + 39, 1, -1); corner(x + 40, y + 39, -1, -1); }
  }
  const hullOver = (top) => (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], 6, 42)) rivetC(x + rx, y + top + 4, RIVET_C[T.riv[1]]);
    if (T.parts.includes('plate')) plate(x + 34, y + top + 7);
    if (T.parts.includes('gauge')) gauge(x + 12.5, y + top + 11.5);
  };

  // ---------- 枪的零件（水平画，C / M = 耳轴）----------
  function tube(x0, x1, M, hh) {
    for (let x = x0; x < x1; x++) {
      R(x, M - hh, 1, hh * 2 + 1, P.iron[0]);
      if (hh > 0) { R(x, M - hh + 1, 1, hh * 2 - 1, P.iron[3]); px(x, M - hh + 1, P.iron[4]); if (hh > 1) px(x, M + hh - 1, P.iron[2]); }
    }
  }
  const ring = (x0, w, M, hh) => { const ix = w > 2 ? x0 + 1 : x0, iw = w > 2 ? w - 2 : w; R(x0, M - hh, w, hh * 2 + 1, P.iron[0]); R(ix, M - hh + 1, iw, hh * 2 - 1, P.iron[3]); R(ix, M - hh + 1, iw, 1, P.iron[4]); };
  const brassRing = (x0, w, M, hh) => { R(x0, M - hh, w, hh * 2 + 1, P.brass[0]); R(x0, M - hh + 1, w, hh * 2 - 1, P.brass[1]); R(x0, M - hh + 1, 1, hh * 2 - 1, P.brass[3]); };
  function muzzle(end, M, b, hh = 1) {
    if (b === 1) { ring(end - 2, 2, M, hh + 1); px(end - 1, M, P.black); return end; }
    if (b === 2) { for (let i = 0; i < 4; i++) ring(end - 4 + i, 1, M, hh + 1 + (i >> 1)); px(end - 1, M, P.black); return end; }
    ring(end - 5, 5, M, hh + 2); R(end - 4, M - hh - 1, 3, 1, P.dark[0]); R(end - 4, M + hh + 1, 3, 1, P.dark[0]); px(end - 1, M, P.black); return end;
  }
  const flash = (end, M, k, big) => { if (k >= 6) { R(end, M - 1 - big, 3 + big, 3 + big * 2, P.fire[3]); px(end + 3 + big, M, P.fire[2]); px(end + 1, M - 2 - big, P.fire[2]); px(end + 1, M + 2 + big, P.fire[2]); } };
  const finJacket = (x0, x1, M, hh = 3) => { tube(x0, x1, M, hh); for (let i = x0 + 1; i < x1; i += 2) R(i, M - hh + 1, 1, hh * 2 - 1, P.iron[1]); };
  function turnGun(G0, x, y, piv, a, kmax, o, gun) {
    const k = Math.round((o.k || 0) / 8 * kmax);
    SA.CAND.turn(x + piv[0], y + piv[1], a || 0, (X, Y) => { G = SA.CAND.ctx(); gun(X - k, Y); });
    SA.CAND.use(G0); G = G0;
  }
  // 三辐飞轮（同重机枪）
  function flywheel(cx, cy, r, f) {
    disc(cx + 0.5, cy + 0.5, r, P.iron[0]); disc(cx + 0.5, cy + 0.5, r - 1, P.brass[1]); disc(cx + 0.5, cy + 0.5, r - 2, P.dark[1]);
    const an = (f % 6) * Math.PI / 9;
    for (let k = 0; k < 3; k++) { const aa = an + k * Math.PI * 2 / 3; line(cx, cy, Math.round(cx + Math.cos(aa) * (r - 2)), Math.round(cy + Math.sin(aa) * (r - 2)), 2, P.brass[2]); }
    disc(cx + 0.5, cy + 0.5, 1.8, P.brass[3]);
  }

  // ================= 机炮 mg（2×2）=================
  // A 砰砰炮炮塔：车体下壳 + 座圈；转动的圆头炮塔（防盾）里伸出粗水冷炮管（竖筋 + 助退器），炮塔侧面挂黄铜弹箱，紫铜管把枪套蒸汽引回炮塔
  function mA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [22, 20];
    hull(x, y, T, 26);
    box(x + 9, y + 22, 26, 5, IRON); R(x + 10, y + 23, 24, 1, P.iron[3]);                                            // 座圈
    turnGun(G0, x, y, pv, o.a, 4, o, (C, M) => {
      tube(C + 6, C + 25, M, 5); for (let i = C + 8; i < C + 24; i += 3) R(i, M - 4, 1, 9, P.iron[2]);
      R(C + 9, M - 6, 4, 1, P.brass[2]); ring(C + 24, 3, M, 6); tube(C + 27, C + 30, M, 2);
      flash(muzzle(C + 30 + (T.b === 3 ? 2 : 0), M, T.b, 2), M, o.k || 0, 1);
      if (T.b >= 2) brassRing(C + 6, 2, M, 5);
      shade(C - 14, M - 9, 21, 16, shellIn(C - 14, M - 9, 21, 16, T.f, 5));                                          // 圆头炮塔
      R(C - 6, M - 5, 7, 1, P.dark[0]); R(C - 6, M - 4, 7, 1, P.iron[4]);                                          // 观察缝
      box(C - 12, M - 1, 9, 8, BRASS); for (let i = 0; i < 3; i++) R(C - 10 + i * 2, M + 1, 1, 4, P.brass[0]);        // 弹箱
      line(C + 8, M + 5, C + 5, M + 7, 2, COPPER[1]); px(C + 8, M + 5, COPPER[3]);
    });
  }
  // B 弹鼓机炮：高一点的装甲炮室；转动的机匣侧面挂一只大黄铜弹鼓（开火时鼓面的弹位转）+ 散热片枪套 + 长炮管 + 制退器（延续旧画的黄铜弹鼓）
  function mB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [24, 22];
    hull(x, y, T, 22);
    turnGun(G0, x, y, pv, o.a, 4, o, (C, M) => {
      finJacket(C + 4, C + 19, M, 4); tube(C + 19, C + 28, M, 2);
      if (T.b >= 2) brassRing(C + 19, 2, M, 3);
      flash(muzzle(C + 28 + (T.b === 3 ? 2 : 0), M, T.b, 2), M, o.k || 0, 1);
      shade(C - 11, M - 6, 16, 12, shellIn(C - 11, M - 6, 16, 12, T.f, 3));                                         // 机匣
      const dx = C - 8, dy = M - 5, f = o.f || 0;
      disc(dx + 0.5, dy + 0.5, 9, P.brass[0]); disc(dx + 0.5, dy + 0.5, 8, P.brass[1]); disc(dx, dy, 6.5, P.brass[2]);   // 弹鼓
      for (let i = 0; i < 8; i++) { const a = (i / 8 + (f % 8) / 64) * Math.PI * 2; px(Math.round(dx + Math.cos(a) * 5.5), Math.round(dy + Math.sin(a) * 5.5), P.brass[0]); }
      disc(dx + 0.5, dy + 0.5, 2.2, P.brass[0]); disc(dx, dy, 1.3, P.brass[3]); px(dx - 5, dy - 5, P.brass[3]);
    });
  }
  // C 蒸汽转管炮：下壳是蒸汽机房（大三辐飞轮 + 两只活塞缸，开火时转）+ 传动轴顶着座圈；上面五管转管炮 + 顶上高弹斗（重机枪蒸汽加特林的放大版）
  function mC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [21, 16], f = o.f || 0;
    box(x + 18, y + 18, 6, 8, IRONL); R(x + 17, y + 20, 8, 2, P.brass[1]); R(x + 17, y + 20, 8, 1, P.brass[3]);
    shell(x + 3, y + 25, 42, 19, T.f, 4);
    flywheel(x + 13, y + 35, 7, f);                                                                                 // 机房：左飞轮、右活塞缸、中间散热口 + 铭牌
    box(x + 38, y + 31, 5, 11, IRON); R(x + 39, y + 32, 1, 9, P.iron[4]); R(x + 39, y + 27 + [0, 2, 3, 2][f % 4], 3, 4, P.iron[3]);
    const [vs, vn] = T.vent; vents(x + 22, y + 29, vs === 'louver' ? 'grid' : vs, Math.min(vn, 3));
    box(x + 2, y + 44, 44, 4, IRON); R(x + 3, y + 45, 42, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 3, y + 39, 1, -1); corner(x + 40, y + 39, -1, -1); }
    box(x + 8, y + 22, 28, 4, IRON);                                                                                // 座圈
    turnGun(G0, x, y, pv, o.a, 4, o, (C, M) => {
      R(C + 3, M - 6, 25, 13, P.iron[0]);
      [-4, 0, 4].forEach((dy, i) => { const lit = (i + f) % 3 === 0; R(C + 3, M + dy - 1, 25, 3, lit ? P.iron[4] : P.iron[3]); R(C + 3, M + dy + 1, 25, 1, P.iron[2]); });
      brassRing(C + 3, 2, M, 7); brassRing(C + 15, 2, M, 7); brassRing(C + 26, 2, M, 7);
      if (T.b === 3) { ring(C + 28, 4, M, 7); R(C + 29, M - 6, 2, 1, P.dark[0]); R(C + 29, M + 6, 2, 1, P.dark[0]); }
      else if (T.b === 2) ring(C + 28, 2, M, 7);
      flash(C + (T.b === 3 ? 32 : T.b === 2 ? 30 : 28), M, o.k || 0, 2);
      shade(C - 10, M - 6, 14, 13, shellIn(C - 10, M - 6, 14, 13, T.f, 3));
      for (let k = 0; k < 7; k++) R(C - 8 + (k >> 1), M - 14 + k, 11 - (k >> 1) * 2, 1, k === 0 ? P.brass[3] : P.brass[2]);   // 弹斗
      R(C - 8, M - 15, 11, 1, P.brass[0]); for (let i = 0; i < 4; i++) px(C - 7 + i * 3, M - 14, P.brass[0]);
    });
  }
  const mCOver = (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], 10, 35)) rivetC(x + rx, y + 23, RIVET_C[T.riv[1]]);                         // 座圈上的铆钉
    if (T.parts.includes('plate')) plate(x + 26, y + 38);
    if (T.parts.includes('gauge')) gauge(x + 40.5, y + 25.5);                                                       // 机房右上角，骑在壳顶
  };

  // ================= 双联机枪 mg2（2×2）=================
  // A 双联侧舷：车载机枪侧舷枪座的放大版——贴车体的法兰 + 一整面鼓出的半圆枪座 + 两道竖枪缝，上下两挺各带小圆防盾和散热圈
  const T2A = [[27, 13], [27, 30]];
  function dA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0;
    box(x + 2, y + 3, 9, 42, IRON); R(x + 4, y + 5, 1, 38, P.iron[1]);
    shade(x + 9, y + 4, 36, 40, (xx, yy) => {
      if (xx < x + 9 || yy < y + 4 || yy > y + 43 || xx > x + 44) return false;
      const dy = yy + 0.5 - (y + 24), dx = xx + 0.5 - (x + 11);
      if (T.f === 'box') return xx <= x + 41;
      if (T.f === 'slant') return xx <= x + 43 - Math.max(0, Math.abs(dy) - 9);
      return dx * dx / 1089 + dy * dy / 420 <= 1;
    });
    const [vs, vn] = T.vent; vents(x + 13, y + 20 + (vs === 'louver' ? -1 : 0), vs, vn);
    for (const [px0, py0] of T2A) R(x + px0 - 2, y + py0 - 6, 4, 12, P.dark[0]);
    box(x + 2, y + 44, 44, 4, IRON); R(x + 3, y + 45, 42, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 11, y + 39, 1, -1); corner(x + 38, y + 39, -1, -1); }
    for (const [i, pv] of T2A.entries()) {
      const hot = ((o.f || 0) + i) % 2 ? o.k || 0 : 0;
      turnGun(G0, x, y, pv, o.a, 3, { ...o, k: hot }, (C, M) => {
        tube(C + 2, C + 24, M, 1);
        for (const rx of [C + 6, C + 9, C + 12]) ring(rx, 2, M, 3);
        if (T.b >= 2) brassRing(C + 15, 2, M, 2);
        flash(muzzle(C + 24 + (T.b === 3 ? 2 : 0), M, T.b), M, hot, 0);
        disc(C + 0.5, M + 0.5, 5, P.iron[0]); disc(C + 0.5, M + 0.5, 4, P.iron[3]); disc(C - 0.5, M - 0.5, 1.5, P.iron[4]);
      });
    }
  }
  const dAOver = (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    const n = T.riv[0]; for (let i = 0; i < n; i++) rivetC(x + 5, y + Math.round(7 + i * 31 / (n - 1)), RIVET_C[T.riv[1]]);   // 法兰上一竖排
    if (T.parts.includes('plate')) plate(x + 14, y + 35);
    if (T.parts.includes('gauge')) gauge(x + 17.5, y + 10.5);
  };
  // B 双联枪塔：车体下壳上一只低矮装甲圆顶；转动的共用防盾里上下两根枪管（散热片枪套），顶上叠着两只扁弹盘
  function dB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [20, 20];
    hull(x, y, T, 30);
    const cx = 22, top = 16;
    if (T.f === 'raw') shade(x + 4, y + top, 36, 16, (xx, yy) => { const dx = xx + 0.5 - (x + cx), dy = yy + 0.5 - (y + top + 15); return yy < y + top + 15 && dx * dx / 324 + dy * dy / 225 <= 1; });
    else shell(x + 6, y + top + 2, 32, 13, T.f, 4);
    R(x + 30, y + 24, 6, 1, P.dark[0]); R(x + 30, y + 25, 6, 1, P.iron[4]);
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      for (const dy of [-4, 4]) { finJacket(C + 6, C + 17, M + dy, 2); tube(C + 17, C + 26, M + dy, 1); flash(muzzle(C + 26 + (T.b === 3 ? 2 : 0), M + dy, T.b), M + dy, o.k || 0, 0); if (T.b >= 2) brassRing(C + 17, 1, M + dy, 2); }
      shade(C - 8, M - 9, 15, 18, shellIn(C - 8, M - 9, 15, 18, T.f, 4));
      R(C - 9, M - 13, 16, 3, P.brass[0]); R(C - 8, M - 13, 14, 1, P.brass[3]); R(C - 8, M - 12, 14, 1, P.brass[2]);   // 两只扁弹盘（前后错开）
      R(C - 6, M - 15, 12, 2, P.brass[1]); R(C - 5, M - 15, 10, 1, P.brass[3]);
      px(C - 7 + ((o.f || 0) % 4) * 3, M - 12, P.brass[0]);
    });
  }
  // C 双球座装甲墙：一整面装甲墙（横接缝）上下两只黄铜圈球座，枪从球里伸出；左上观察缝
  const T2C = [[28, 13], [28, 31]];
  function dC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0;
    shell(x + 3, y + 3, 42, 41, T.f, 5);
    seam(x + 5, x + 42, y + 22);
    R(x + 8, y + 9, 10, 1, P.dark[0]); R(x + 8, y + 10, 10, 1, P.iron[4]);
    const [vs, vn] = T.vent; vents(x + 7, y + 30, vs, vn);
    box(x + 2, y + 44, 44, 4, IRON); R(x + 3, y + 45, 42, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 3, y + 39, 1, -1); corner(x + 40, y + 39, -1, -1); }
    for (const [bx, by] of T2C) { disc(x + bx + 0.5, y + by + 0.5, 7.5, P.iron[0]); disc(x + bx + 0.5, y + by + 0.5, 6.5, P.brass[1]); disc(x + bx, y + by, 5.5, P.brass[2]); }
    for (const [i, pv] of T2C.entries()) {
      const hot = ((o.f || 0) + i) % 2 ? o.k || 0 : 0;
      turnGun(G0, x, y, pv, o.a, 3, { ...o, k: hot }, (C, M) => {
        finJacket(C + 3, C + 15, M); tube(C + 15, C + 23, M, 1);
        if (T.b >= 2) brassRing(C + 4, 1, M, 3);
        flash(muzzle(C + 23 + (T.b === 3 ? 2 : 0), M, T.b), M, hot, 0);
        disc(C + 0.5, M + 0.5, 5.5, P.iron[0]); disc(C + 0.5, M + 0.5, 4.5, P.iron[3]); disc(C - 0.5, M - 0.5, 2, P.iron[4]);
      });
    }
  }
  const dCOver = (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], 6, 20)) rivetC(x + rx, y + 23, RIVET_C[T.riv[1]]);
    if (T.parts.includes('plate')) plate(x + 8, y + 14);
    if (T.parts.includes('gauge')) gauge(x + 12.5, y + 35.5);
  };

  const MG_L = [
    { key: 'A', name: 'A 砰砰炮炮塔', idea: '车体下壳 + 座圈上一只转动的圆头炮塔，伸出粗水冷炮管（竖筋 + 助退器），侧面挂黄铜弹箱，紫铜管把蒸汽引回炮塔（马克沁-诺登菲尔特「砰砰炮」）。一根粗管，和双联的两根细管分得最开', base: mA, over: hullOver(26), piv: [22, 20], blen: 30 },
    { key: 'B', name: 'B 弹鼓机炮', idea: '装甲炮室里转动的机匣，侧面挂一只大黄铜弹鼓（开火时鼓面弹位转）+ 散热片枪套 + 长炮管 + 制退器。保留旧画的黄铜弹鼓，玩家最熟', base: mB, over: hullOver(22), piv: [24, 22], blen: 28 },
    { key: 'C', name: 'C 蒸汽转管炮', idea: '重机枪蒸汽加特林的放大版：下壳是机房（大三辐飞轮 + 两只活塞缸，开火时转）+ 传动轴；上面五管转管炮 + 高弹斗。家族感最强，但和重机枪也最像', base: mC, over: mCOver, piv: [21, 16], blen: 28 },
  ];
  const MG_2 = [
    { key: 'A', name: 'A 双联侧舷', idea: '车载机枪侧舷枪座的放大版：一整面鼓出的半圆枪座 + 两道竖枪缝，上下两挺交替开火。和车载机枪一眼是一家', base: dA, over: dAOver, piv: [27, 21], blen: 24 },
    { key: 'B', name: 'B 双联枪塔', idea: '车体上的低矮装甲圆顶，转动的共用防盾里上下两根枪管，顶上叠着两只扁弹盘。「一个塔两根管」，数得出是双联', base: dB, over: hullOver(30), piv: [20, 20], blen: 26 },
    { key: 'C', name: 'C 双球座装甲墙', idea: '一整面装甲墙上下两只黄铜圈球座，枪从球里伸出，交替开火。最「车体」，但两只球座读起来像两个独立模块', base: dC, over: dCOver, piv: [28, 22], blen: 23 },
  ];
  return { TIERS, MG_L, MG_2, L: { TIERS, CANDS: MG_L }, D: { TIERS, CANDS: MG_2 } };
})();
// 候选页（module-candidates.html）按 SA[lab].TIERS / CANDS 读
