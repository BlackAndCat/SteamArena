// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：机枪家族 v2（2026-09-28）。用户：机枪都是车载的，步兵式的三脚架、立柱支架、握把不合适。
// 所以 v2 全部改成「装在车体上的枪座」：球形枪座 / 小枪塔 / 侧舷枪座（1×1），装甲枪室 + 冷凝罐 / 蒸汽加特林 / 液压升降排枪（1×2）。
// 固定部分 = 装甲壳（跟材料换色，形体 T3、T5 跃迁：铸造圆角 → 方壳平顶 → 斜面装甲），转动部分 = 防盾 / 球座 + 枪（绕耳轴转到仰角）。
// 枪口 ① 直口箍 → ② 助退喇叭 / 加箍 → ③ 方制退器；1×1 只靠剪影；1×2 固定壳上放铆钉 2 → 3 → 4、散热口 ≥ 3、钢起包角铁、镀镍起小压力表。
// o = { a 仰角°, k 后坐 0~8, f 供弹帧 }
window.SA = window.SA || {};

SA.CUR = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, BRASS } = SA.CAND;
  const COPPER = ['#4a2418', '#8c4228', '#c46a3c', '#eaa070'];   // 紫铜管（同水罐的紫铜箍，材质处理不动）
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  const riveXs = (n, x0, x1) => (n === 2 ? [x0 + 1, x1 - 3] : Array.from({ length: n }, (_, i) => Math.round(x0 + (x1 - x0 - 2) * i / (n - 1))));
  let G = null;
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
  const ventW = (style, n) => (style === 'slits' ? n * 3 - 1 : n * 2 + (style === 'louver2' ? 1 : 0));
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

  // ---------- 装甲壳：按形状判定逐像素上色（外沿描边、左上亮、右下暗）----------
  function shade(x, y, w, h, inside, ramp = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]]) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inside(xx, yy)) continue;
      if (!inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) || !inside(xx, yy + 1)) { px(xx, yy, ramp[0]); continue; }
      px(xx, yy, !inside(xx - 2, yy) || !inside(xx, yy - 2) ? ramp[3] : !inside(xx + 2, yy) || !inside(xx, yy + 2) ? ramp[1] : ramp[2]);
    }
  }
  // 形体：raw = 四角圆 r（铸造）/ box = 直角 / slant = 顶上两角 45° 切 d（右上切得更多：迎弹面）
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
  const flash = (end, M, k) => { if (k >= 6) { R(end, M - 1, 3, 3, P.fire[3]); px(end + 3, M, P.fire[2]); px(end + 1, M - 2, P.fire[2]); px(end + 1, M + 2, P.fire[2]); } };
  const finJacket = (x0, x1, M) => { tube(x0, x1, M, 3); for (let i = x0 + 1; i < x1; i += 2) R(i, M - 2, 1, 5, P.iron[1]); };
  // 转动部分：以 (piv) 为支点画 gun(C, M)，后坐 k 像素（1×1 最多 2、1×2 最多 3）
  function turnGun(G0, x, y, piv, a, kmax, o, gun) {
    const k = Math.round((o.k || 0) / 8 * kmax);
    SA.CAND.turn(x + piv[0], y + piv[1], a || 0, (X, Y) => { G = SA.CAND.ctx(); gun(X - k, Y); });
    SA.CAND.use(G0); G = G0;
  }

  // ================= 1×1 车载机枪 mg_s（24 × 24）=================
  // A 球形枪座：一块装甲板上嵌一只球座，枪从球里伸出来（一战坦克车体机枪），左边一道观察缝
  function sA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [13, 12];
    shell(x + 2, y + 3, 20, 20, T.f, 4);
    R(x + 4, y + 8, 5, 1, P.dark[0]); R(x + 4, y + 9, 5, 1, P.iron[4]);                                              // 观察缝
    disc(x + pv[0] + 0.5, y + pv[1] + 0.5, 7, P.iron[0]); disc(x + pv[0] + 0.5, y + pv[1] + 0.5, 6, P.brass[1]); disc(x + pv[0], y + pv[1], 5, P.brass[2]);   // 黄铜球座圈
    turnGun(G0, x, y, pv, o.a, 2, o, (C, M) => {
      finJacket(C + 3, C + 13, M); tube(C + 13, C + 20, M, 1);
      flash(muzzle(C + 20 + (T.b === 3 ? 2 : 0), M, T.b), M, o.k || 0);
      disc(C + 0.5, M + 0.5, 5, P.iron[0]); disc(C + 0.5, M + 0.5, 4, P.iron[3]); disc(C - 0.5, M - 0.5, 2, P.iron[4]);   // 枪球
      if (T.b >= 2) brassRing(C + 4, 1, M, 3);
    });
  }
  // B 小枪塔：车顶上的低矮装甲圆顶 + 转动的防盾 + 顶置扁弹盘（装甲车的枪塔）
  function sB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [11, 11];
    const cx = 12, top = 11;
    if (T.f === 'raw') shade(x + 3, y + top, 18, 11, (xx, yy) => { const dx = xx + 0.5 - (x + cx), dy = yy + 0.5 - (y + top + 10); return yy < y + top + 11 && dx * dx / 81 + dy * dy / 100 <= 1; });
    else shell(x + 4, y + top + 1, 16, 10, T.f, 2);
    R(x + 7, y + 17, 10, 1, P.dark[0]); R(x + 7, y + 18, 10, 1, P.iron[4]);                                          // 观察缝
    box(x + 1, y + 21, 22, 3, IRON);                                                                                // 座圈
    turnGun(G0, x, y, pv, o.a, 2, o, (C, M) => {
      finJacket(C + 4, C + 14, M); tube(C + 14, C + 20, M, 1);
      flash(muzzle(C + 20 + (T.b === 3 ? 2 : 0), M, T.b), M, o.k || 0);
      shade(C - 5, M - 4, 10, 9, shellIn(C - 5, M - 4, 10, 9, T.f === 'raw' ? 'raw' : T.f, 2));                     // 防盾
      R(C - 6, M - 8, 12, 3, P.brass[0]); R(C - 5, M - 8, 10, 1, P.brass[3]); R(C - 5, M - 7, 10, 1, P.brass[2]);   // 扁弹盘
      px(C - 5 + ((o.f || 0) % 4) * 3, M - 7, P.brass[0]); R(C - 1, M - 5, 2, 1, P.iron[0]);
    });
  }
  // C 侧舷枪座：从车体侧面鼓出来的半圆枪座 + 竖枪缝 + 小圆防盾；紫铜供弹槽从枪座底下拐进车体
  function sC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [15, 11];
    box(x + 2, y + 2, 6, 21, IRON);                                                                                 // 贴车体的法兰
    const inS = (xx, yy) => {
      if (xx < x + 6 || yy < y + 3 || yy > y + 20) return false;
      const dy = yy + 0.5 - (y + 12), dx = xx + 0.5 - (x + 8);
      if (T.f === 'box') return xx <= x + 20;
      if (T.f === 'slant') return xx <= x + 21 - Math.max(0, Math.abs(dy) - 4);
      return dx * dx / 196 + dy * dy / 90 <= 1;
    };
    shade(x + 6, y + 3, 17, 18, inS);
    R(x + 13, y + 5, 4, 14, P.dark[0]);                                                                             // 竖枪缝
    for (let i = 0; i < 4; i++) { const bx = x + 11 - i * 2, by = y + 19 + i; R(bx, by, 3, 2, COPPER[1]); px(bx, by, COPPER[3]); }   // 供弹槽
    turnGun(G0, x, y, pv, o.a, 2, o, (C, M) => {
      tube(C + 2, C + 19, M, 1);
      for (const rx of [C + 5, C + 8]) ring(rx, 2, M, 3);
      if (T.b >= 2) brassRing(C + 11, 2, M, 2);
      flash(muzzle(C + 19 + (T.b === 3 ? 2 : 0), M, T.b), M, o.k || 0);
      disc(C + 0.5, M + 0.5, 4, P.iron[0]); disc(C + 0.5, M + 0.5, 3, P.iron[3]); px(C - 1, M - 1, P.iron[4]);         // 小圆防盾
    });
  }

  // ================= 1×2 重机枪 mg_heavy（24 × 48）=================
  // A 装甲枪室 + 冷凝罐：高装甲枪室，马克沁水冷枪从顶上的防盾伸出；紫铜管把枪套的蒸汽引到枪室面上的黄铜冷凝罐
  function hA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [13, 11];
    shell(x + 2, y + 6, 20, 38, T.f, 4);
    seam(x + 3, x + 20, y + 20);
    box(x + 4, y + 25, 8, 14, BRASS); R(x + 5, y + 28, 6, 1, P.brass[0]); R(x + 5, y + 34, 6, 1, P.brass[0]); R(x + 6, y + 23, 4, 2, P.brass[1]);   // 冷凝罐
    line(x + 9, y + 16, x + 8, y + 23, 2, COPPER[1]); line(x + 9, y + 16, x + 8, y + 23, 1, COPPER[3]);           // 紫铜管
    const [vs, vn] = T.vent, two = vs === 'grid2' || vs === 'louver2';
    vents(x + 17 - (ventW(vs, vn) >> 1), y + 26 - (two ? 1 : 0), vs, vn, two ? 2 : 3);
    box(x + 1, y + 44, 22, 4, IRON); R(x + 2, y + 45, 20, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 2, y + 39, 1, -1); corner(x + 17, y + 39, -1, -1); }
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      tube(C + 4, C + 20, M, 4); for (let i = C + 6; i < C + 19; i += 3) R(i, M - 3, 1, 7, P.iron[2]);
      R(C + 7, M - 5, 3, 1, P.brass[2]); ring(C + 19, 2, M, 5); tube(C + 21, C + 23, M, 1);
      flash(muzzle(C + 23 + (T.b === 1 ? 0 : 2), M, T.b), M, o.k || 0);
      if (T.b >= 2) brassRing(C + 4, 1, M, 4);
      shade(C - 6, M - 6, 11, 13, shellIn(C - 6, M - 6, 11, 13, T.f, 3));                                          // 防盾
      R(C - 3, M - 1, 4, 1, P.dark[0]);
    });
  }
  // B 蒸汽加特林：下半是蒸汽机壳（飞轮 + 活塞缸，开火时转），传动轴顶着上面的座圈；加特林六管 + 顶上高竖弹匣
  function hB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [12, 12], f = o.f || 0;
    box(x + 10, y + 15, 4, 8, IRONL); R(x + 9, y + 17, 6, 2, P.brass[1]); R(x + 9, y + 17, 6, 1, P.brass[3]);         // 传动轴 + 黄铜轴套
    shell(x + 2, y + 22, 20, 22, T.f, 3);
    const wx = x + 9, wy = y + 33, an = (f % 4) * Math.PI / 8;
    disc(wx + 0.5, wy + 0.5, 6, P.iron[0]); disc(wx + 0.5, wy + 0.5, 5, P.brass[1]); disc(wx + 0.5, wy + 0.5, 4, P.dark[1]);
    for (let s = 0; s < 4; s++) { const aa = an + s * Math.PI / 2; line(wx, wy, Math.round(wx + Math.cos(aa) * 4), Math.round(wy + Math.sin(aa) * 4), 1, P.brass[2]); }
    disc(wx + 0.5, wy + 0.5, 1.5, P.brass[3]);                                                                      // 飞轮
    box(x + 16, y + 28, 5, 10, IRON); R(x + 17, y + 29, 1, 8, P.iron[4]); const pr = [0, 2, 3, 2][f % 4]; R(x + 17, y + 25 + pr, 3, 3, P.iron[3]);   // 活塞缸
    const [vs, vn] = T.vent, two = vs === 'grid2' || vs === 'louver2';
    vents(x + 12 - (ventW(vs, vn) >> 1), y + 39 - (two ? 1 : 0), vs, vn, 2);
    box(x + 1, y + 44, 22, 4, IRON); R(x + 2, y + 45, 20, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 2, y + 39, 1, -1); corner(x + 17, y + 39, -1, -1); }
    box(x + 4, y + 19, 16, 4, IRON);                                                                                // 座圈
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      R(C + 3, M - 4, 19, 9, P.iron[0]);
      [-3, 0, 3].forEach((dy, i) => { const lit = (i + f) % 3 === 0; R(C + 3, M + dy - 1, 19, 2, lit ? P.iron[4] : P.iron[3]); R(C + 3, M + dy, 19, 1, lit ? P.iron[3] : P.iron[2]); });
      brassRing(C + 3, 2, M, 5); brassRing(C + 12, 2, M, 5); brassRing(C + 20, 2, M, 5);
      if (T.b === 3) { ring(C + 22, 3, M, 5); R(C + 23, M - 4, 2, 1, P.dark[0]); R(C + 23, M + 4, 2, 1, P.dark[0]); }
      flash(C + (T.b === 3 ? 25 : 22), M, o.k || 0);
      shade(C - 7, M - 4, 11, 9, shellIn(C - 7, M - 4, 11, 9, T.f, 2));                                             // 机匣
      R(C - 5, M - 13, 6, 10, P.brass[0]); R(C - 4, M - 12, 4, 9, P.brass[2]); R(C - 4, M - 12, 1, 9, P.brass[3]);   // 高竖弹匣
      for (let i = 0; i < 4; i++) R(C - 3, M - 11 + i * 2, 2, 1, P.brass[1]);
    });
  }
  // C 液压升降排枪：诺登菲尔特四管排枪架在液压柱上（两根斜撑活塞），底下是液压油箱；开火时四口齐闪
  function hC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [12, 11];
    for (const [x0, x1] of [[4, 9], [20, 15]]) { line(x + x0, y + 31, x + x1, y + 18, 2, P.iron[0]); line(x + x0, y + 30, x + x1, y + 18, 1, P.iron[3]); disc(x + x1 + 0.5, y + 18.5, 1.4, P.brass[2]); }   // 斜撑活塞
    box(x + 8, y + 17, 8, 15, IRONL); R(x + 8, y + 21, 8, 2, P.brass[1]); R(x + 8, y + 21, 8, 1, P.brass[3]);         // 液压主缸
    R(x + 10, y + 13, 4, 5, P.iron[4]); R(x + 13, y + 13, 1, 5, P.iron[2]);                                         // 抛光柱塞
    shell(x + 2, y + 31, 20, 13, T.f, 3);
    const [vs, vn] = T.vent, two = vs === 'grid2' || vs === 'louver2';
    vents(x + 17 - (ventW(vs, vn) >> 1), y + 35 - (two ? 1 : 0), vs, vn, two ? 2 : 3);
    box(x + 1, y + 44, 22, 4, IRON); R(x + 2, y + 45, 20, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 2, y + 39, 1, -1); corner(x + 17, y + 39, -1, -1); }
    box(x + 7, y + 8, 10, 6, IRON);                                                                                 // 叉形头
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      R(C + 3, M - 5, 17, 11, P.iron[0]);
      for (let i = 0; i < 4; i++) { R(C + 3, M - 4 + i * 3, 17, 2, P.iron[3]); R(C + 3, M - 4 + i * 3, 17, 1, P.iron[4]); }
      brassRing(C + 3, 2, M, 6); brassRing(C + 17, 3, M, 6); if (T.b >= 2) brassRing(C + 10, 1, M, 6);
      for (let i = 0; i < 4; i++) px(C + 19, M - 4 + i * 3, P.black);
      if (T.b === 3) { R(C + 20, M - 6, 3, 13, P.iron[0]); R(C + 20, M - 5, 2, 11, P.iron[3]); for (let i = 0; i < 4; i++) px(C + 22, M - 4 + i * 3, P.black); }
      const end = C + (T.b === 3 ? 23 : 20);
      if ((o.k || 0) >= 6) for (let i = 0; i < 4; i++) { R(end, M - 4 + i * 3, 2, 1, P.fire[3]); px(end + 2, M - 4 + i * 3, P.fire[2]); }
      shade(C - 7, M - 4, 11, 9, shellIn(C - 7, M - 4, 11, 9, T.f, 2));
      for (let k = 0; k < 6; k++) R(C - 6 + (k >> 1), M - 11 + k, 10 - (k >> 1) * 2, 1, k === 0 ? P.brass[3] : P.brass[2]);   // 弹斗
      R(C - 6, M - 12, 10, 1, P.brass[0]);
    });
  }
  // 1×2 的身份件（材质处理之后画）：铆钉排 + 小压力表；位置按各自的固定壳
  const hOver = (rivY, rx0, rx1, gauge) => (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], rx0, rx1)) rivetC(x + rx, y + rivY, RIVET_C[T.riv[1]]);
    if (T.parts.includes('gauge')) smallGauge(x + gauge[0], y + gauge[1]);
  };
  const noOver = () => {};

  const MG_S = [
    { key: 'A', name: 'A 球形枪座', idea: '一块装甲板上嵌一只黄铜圈球座，枪从球里伸出来，左边一道观察缝（一战坦克的车体机枪）。机匣藏在车里，最像「车上的枪」', base: sA, over: noOver, piv: [13, 12] },
    { key: 'B', name: 'B 小枪塔', idea: '车顶上的低矮装甲圆顶 + 座圈，上面是跟着转的防盾和顶置扁弹盘（装甲车枪塔）。剪影「圆顶 + 横枪」，1× 最好认', base: sB, over: noOver, piv: [11, 11] },
    { key: 'C', name: 'C 侧舷枪座', idea: '从车体侧面鼓出来的半圆枪座 + 竖枪缝 + 小圆防盾，紫铜供弹槽从底下拐进车体（一战坦克的侧舷）。和装甲板拼在一起最自然', base: sC, over: noOver, piv: [15, 11] },
  ];
  const MG_H = [
    { key: 'A', name: 'A 装甲枪室 + 冷凝罐', idea: '高装甲枪室，马克沁水冷枪从顶上的防盾伸出；紫铜管把枪套的蒸汽引到枪室面上的黄铜冷凝罐。枪室就是车体的一部分', base: hA, over: hOver(21, 4, 20, [17.5, 35.5]), piv: [13, 11] },
    { key: 'B', name: 'B 蒸汽加特林', idea: '下半是蒸汽机壳：飞轮和活塞开火时一起转，传动轴顶着座圈带动六管加特林，顶上高竖弹匣。最蒸汽朋克，靠机器而不是人摇', base: hB, over: hOver(23, 4, 14, [17.5, 25.5]), piv: [12, 12] },
    { key: 'C', name: 'C 液压升降排枪', idea: '诺登菲尔特四管排枪架在液压柱上（两根斜撑活塞、抛光柱塞），底下是液压油箱。开火时四个枪口一起闪', base: hC, over: hOver(32, 4, 20, [6.5, 38.5]), piv: [12, 11] },
  ];
  // 候选页（module-candidates.html）按 SA[lab].TIERS / CANDS 读
  return { TIERS, MG_S, MG_H, S: { TIERS, CANDS: MG_S }, H: { TIERS, CANDS: MG_H } };
})();
SA.CUR_MG_S = SA.CUR.S;
SA.CUR_MG_H = SA.CUR.H;
