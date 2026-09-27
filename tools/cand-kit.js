// 新模块造型候选 · 画图工具与登记表（tools/module-candidates.html 专用，只做视觉，不接进游戏）。
// 候选按 T1 原画画（冷铁 + 黄铜 + 语义色，只用 SA.PAL），材料换色直接调游戏的装饰层 SA.SPR.decorate；
// 武器的耳轴 / 炮口长度读游戏数据（SA.MODULES[id].piv / blen），保证候选的炮口位置和游戏一致。
// 登记：SA.CAND.add(id, batch, note, [{ key, name, idea, draw(x, y, o) }, …])；o = { a 仰角, k 后坐 0~1, t 帧, lv 0~1 存量 }
window.SA = window.SA || {};

SA.CAND = (() => {
  const P = SA.PAL;
  let g = null;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const px = (x, y, c) => R(x, y, 1, 1, c);
  const clr = (x, y, w = 1, h = 1) => g.clearRect(Math.round(x), Math.round(y), w, h);   // 镂空（侧挂件透出后面的车体）
  const disc = (cx, cy, r, c) => {
    g.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++)
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) g.fillRect(xx, yy, 1, 1);
      }
  };
  // 椭圆环（陀螺仪、万向环用）：rx × ry，线宽 1
  const ring = (cx, cy, rx, ry, c, from = 0, to = Math.PI * 2) => {
    const n = Math.ceil((rx + ry) * 4);
    for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; px(Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), c); }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2);
    g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  // ramp = [描边, 暗面, 固有色, 亮面]，光源左上
  const box = (x, y, w, h, r) => { R(x, y, w, h, r[0]); R(x + 1, y + 1, w - 2, h - 2, r[2]); R(x + 1, y + h - 2, w - 2, 1, r[1]); R(x + w - 2, y + 1, 1, h - 2, r[1]); R(x + 1, y + 1, w - 2, 1, r[3]); R(x + 1, y + 1, 1, h - 2, r[3]); };
  const rivet = (x, y, lite = P.iron[4], dk = P.iron[0]) => { R(x, y, 2, 2, lite); px(x + 1, y + 1, P.iron[2]); px(x + 2, y + 1, dk); px(x + 1, y + 2, dk); };
  const arch = (cx, top, bottom, rad, col) => {
    const cy = top + rad; g.fillStyle = col;
    for (let yy = top; yy < bottom; yy++) { const dy = yy + 0.5 - cy, hw = dy < 0 ? Math.sqrt(Math.max(0, rad * rad - dy * dy)) : rad; g.fillRect(Math.round(cx - hw), yy, Math.round(hw * 2), 1); }
  };
  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]];
  const IRONL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]];
  const DARK = [P.dark[0], P.dark[1], P.dark[2], P.dark[3]];
  const BRASS = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]];
  const RUST = [P.rust[0], P.rust[1], P.rust[2], P.rust[3]];
  const bolted = (x, y, w, h) => { box(x, y, w, h, IRONL); if (w >= 5 && h >= 5) { px(x + 1, y + 1, P.iron[4]); px(x + w - 2, y + h - 2, P.iron[1]); } };
  // 压力表：黄铜圈 + 蒸汽白表盘 + 指针（v 0~1 从左下扫到右下）
  function gauge(cx, cy, r, v = 0.6, needle = P.dark[0]) {
    disc(cx, cy, r, P.brass[0]); disc(cx, cy, r - 1, P.steam[2]);
    if (r >= 3.5) px(Math.round(cx - r + 1.5), Math.round(cy - r + 1.5), P.brass[3]);
    for (let i = 0; i < 4; i++) { const a = Math.PI * (1.6 + i * 0.16); px(Math.round(cx - 0.5 + Math.cos(a) * (r - 1.2)), Math.round(cy - 0.5 + Math.sin(a) * (r - 1.2)), P.gauge[2]); }   // 表盘上的绿区：读成仪表而不是眼睛
    const a = Math.PI * (0.75 + 1.5 * v), L = Math.max(1.5, r - 1.5);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 0.5 + Math.cos(a) * L), Math.round(cy - 0.5 + Math.sin(a) * L), 1, needle);
  }
  // 炮管：横向圆管（描边 → 亮 → 固有 → 暗 → 描边）
  function tube(x0, y, len, h, ramp = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]]) {
    R(x0, y, len, h, ramp[0]);
    if (h > 2) { R(x0, y + 1, len, h - 2, ramp[2]); R(x0, y + 1, len, 1, ramp[3]); if (h > 3) R(x0, y + h - 2, len, 1, ramp[1]); }
  }
  const hoop = (x, y, h) => { R(x, y, 2, h, P.brass[1]); R(x, y, 1, h, P.brass[3]); };
  const flash = (x, y, h, k) => { if (k >= 0.85) { R(x, y + 1, 3, Math.max(1, h - 2), P.fire[3]); R(x + 3, y + (h >> 1) - 1, 2, 2, P.fire[2]); } };
  // 蒸汽 / 烟：几粒 steam 色像素往上飘（t 帧）
  function puff(x, y, t, n = 3) {
    for (let i = 0; i < n; i++) { const p = (t + i * 3) % 9; R(x + ((i * 5 + p) % 3) - 1, y - p, p < 4 ? 2 : 1, p < 4 ? 2 : 1, P.steam[p < 3 ? 2 : p < 6 ? 1 : 0]); }
  }

  // Q 版小炭球驾驶员（同 sprites.js 的 pilot / porthole）
  const SOOT_PILOT = ['#141824', '#2f3850', '#6a7a9c'], SOOT_CO = ['#1c1318', '#4a3040', '#8a6078'];
  function pilot(cx, cy, f, blink, pal = SOOT_PILOT) {
    const bob = f === 1 || f === 2 ? 1 : 0, yy = cy + bob;
    disc(cx, yy, 3.3, pal[0]); disc(cx, yy, 2.6, pal[1]); px(cx - 2, yy - 2, pal[2]);
    for (const ex of [cx - 2, cx + 1]) {
      if (f === 3 && blink) { R(ex, yy, 2, 1, P.steam[2]); continue; }
      R(ex, yy - 1, 2, 2, P.white); px(ex + 1, yy, P.black);
    }
  }
  function porthole(cx, cy, t, seed, pal) {
    disc(cx, cy, 6.2, P.black); disc(cx, cy, 5.4, P.brass[1]);
    for (const [a, b] of [[-4, -4], [-2, -5], [-5, -2]]) px(cx + a, cy + b, P.brass[3]);
    disc(cx, cy, 4.3, P.glass[0]);
    pilot(cx, cy + 1, (Math.floor(t / 3) + seed) % 4, seed % 2 === 0, pal);
    px(cx - 3, cy - 3, P.glass[3]);
  }

  // 可转动的炮组：先水平画在离屏上（耳轴落在 (160, 100)），再绕耳轴转到仰角 a 贴回来（最近邻）
  const layer = document.createElement('canvas'); layer.width = 320; layer.height = 200;
  function turn(pxX, pxY, a, fn) {
    const main = g, lg = layer.getContext('2d');
    lg.clearRect(0, 0, 320, 200);
    g = lg; fn(160, 100); g = main;
    main.save(); main.imageSmoothingEnabled = false;
    main.translate(pxX, pxY); main.rotate(-(a || 0) * Math.PI / 180);
    main.drawImage(layer, -160, -100);
    main.restore();
  }

  // ---------- 登记表 ----------
  const MODS = [];
  const BATCH = { early: '早期（玩家最早见到）', mid: '中期', late: '后期（巨炮与 Boss 件）' };
  function add(id, batch, note, cands) { MODS.push({ id, batch, note, cands }); }
  const M = (id) => SA.MODULES[id];
  const isGun = (id) => !!(M(id).piv && M(id).blen != null);
  // 画布四周留边：武器按炮口伸出量留右边，仰角留上边
  function padOf(id) {
    const m = M(id), W = (m.w || 2) * 24;
    if (!isGun(id)) return { l: 8, t: 10, r: 10, b: 6 };
    const e = m.elev || [0, 30], hi = Math.max(0, e[1]) * Math.PI / 180;
    const tipX = m.piv[0] + m.blen, tipY = m.piv[1] - m.blen * Math.sin(hi);   // 水平时伸得最远，最大仰角时抬得最高
    return { l: 16, t: Math.max(10, Math.ceil(-tipY) + 12), r: Math.max(12, tipX - W + 14), b: 8 };
  }
  // 画一张候选：T1 原画；mt > 1 时套游戏的材料装饰层
  function sprite(id, cand, o = {}) {
    const m = M(id), pd = padOf(id), W = (m.w || 2) * 24, H = (m.h || 2) * 24;
    const cv = document.createElement('canvas'); cv.width = pd.l + W + pd.r; cv.height = pd.t + H + pd.b;
    cv.ox = pd.l; cv.oy = pd.t; cv.fw = W; cv.fh = H;
    const prev = g; g = cv.getContext('2d');
    const e = m.elev || [0, 0];
    cand.draw(pd.l, pd.t, { a: o.a == null ? (m.rest || 0) : o.a, k: o.k || 0, t: o.t || 0, lv: o.lv == null ? 0.6 : o.lv, m });
    g = prev;
    if (o.mt > 1) SA.SPR.decorate(cv, SA.MATS[o.mt], pd.l, pd.t);
    return cv;
  }
  return {
    P, R, px, clr, disc, ring, line, box, rivet, arch, bolted, gauge, tube, hoop, flash, puff, pilot, porthole, turn,
    IRON, IRONL, DARK, BRASS, RUST, SOOT_PILOT, SOOT_CO,
    MODS, BATCH, add, sprite, padOf, isGun,
    ctx: () => g,
  };
})();
