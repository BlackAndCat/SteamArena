// 火炮家族 · 六档再设计（tools/gun-family-lab.html 专用，只做视觉，不改游戏）。按 docs/visual-rules.md：
// 只用直线；形体在 T3、T5 跃迁；散热口逐档变多、排法变化；铆钉 T1～3 黄铜、镀镍起钢质淡青；包角铁钢起；
// 小模块零件做减法——中炮不放铭牌，镀镍起只加一块小压力表（直径 7）。
//
// 中炮 2×1（48×24），耳轴 (18,13)，炮口末端 x 53，仰角 −8°～30°。形体和直射火炮一一对应：
//   T1～2 敞开式炮架 + 低矮前挡板（对应直射火炮的方指挥塔）；
//   T3～4 方方正正的平顶炮廓把炮座罩起来，炮管从炮廓里伸出（对应方平顶炮廓）；
//   T5～6 炮廓前沿做成斜板（对应斜板炮廓）。
// v1 试过「高防盾 / 斜防盾」，在 24px 高的模块上读成一根竖杆，放弃。
//
// 立面分区（模块内坐标）：
//   T1～2：散热区 = 炮架上炮组下方一条（x 11～25、y 17～19）；铆钉 = 前挡板脚（y 19）；
//   T3～6：表位 = 炮廓左上（中心 (6.5, 8.5)，直径 7）；散热区 = 表位下方（x 3～10、y 13～17，至少 3 个口）；
//          铆钉 = 压在炮廓和底座的接缝线上（y 18～20，x 4～30 等距）；包角位 = 炮廓左上、底座左下；
//   炮组（黄铜摇架 + 炮管）永远不放东西。
window.SA = window.SA || {};

SA.GFLAB = (() => {
  const { P, R, px, disc, line, box, turn, IRON, BRASS } = SA.CAND;
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  function corner(x, y, fx = 1, fy = 1) {
    const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
    for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
    px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
  }
  function smallGauge(cx, cy) {   // 直径 7 的小压力表
    disc(cx, cy, 3.4, P.brass[0]); disc(cx, cy, 2.6, P.steam[2]);
    px(Math.round(cx - 2), Math.round(cy - 2), P.brass[3]);
    px(Math.round(cx + 1), Math.round(cy - 2), P.gauge[1]); px(Math.round(cx + 2), Math.round(cy - 1), P.gauge[1]);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2), Math.round(cy - 1.5), 1, P.dark[0]);
  }
  // 散热口：slits 竖缝 / pairs 成对竖缝 / louver 斜百叶；(zx, zy) 是区的左上角，h 是缝高
  function vents(x, y, zx, zy, h, style, n) {
    const slit = (sx) => { R(x + sx, y + zy, 1, h, P.iron[0]); R(x + sx + 1, y + zy, 1, h, P.iron[3]); };
    if (style === 'slits') for (let i = 0; i < n; i++) slit(zx + i * 3);
    else if (style === 'pairs') for (let i = 0; i < n; i++) { slit(zx + i * 5); slit(zx + i * 5 + 2); }
    else if (style === 'louver') for (let i = 0; i < n; i++) for (let k = 0; k < h; k++) { px(x + zx + i * 3 + (k >> 1), y + zy + k, P.iron[0]); px(x + zx + i * 3 + (k >> 1) + 1, y + zy + k, P.iron[3]); }
    // 窄区（宽 8）用：slits2 密排竖缝（间距 2）/ grid2 两行短竖缝 / louver2 两行斜百叶
    else if (style === 'slits2') for (let i = 0; i < n; i++) { R(x + zx + i * 2, y + zy, 1, h, P.iron[0]); R(x + zx + i * 2 + 1, y + zy, 1, h, P.iron[3]); }
    else if (style === 'grid2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) { R(x + zx + i * 2, y + zy + ry, 1, 2, P.iron[0]); R(x + zx + i * 2 + 1, y + zy + ry, 1, 2, P.iron[3]); }
    else if (style === 'louver2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { px(x + zx + i * 2 + k, y + zy + ry + k, P.iron[0]); px(x + zx + i * 2 + k + 1, y + zy + ry + k, P.iron[3]); }
  }

  // ---------- 中炮 ----------
  const MZ = {
    open: { vent: { x: 11, y: 18, h: 3 }, rivets: { y: 19, xs: [27, 30] } },
    hood: { vent: { x: 3, y: 13, h: 5 }, rivets: { y: 18, x0: 4, x1: 28 }, gauge: { cx: 6.5, cy: 8.5 } },
  };
  const HOOD = {
    open(x, y) {                     // 敞开式炮架 + 低矮前挡板
      box(x + 1, y + 12, 30, 12, IRON); R(x + 2, y + 22, 28, 1, P.brass[2]);
      box(x + 26, y + 12, 7, 11, IRON);
    },
    box(x, y) {                      // 方平顶炮廓罩住炮座，下面是一条底座
      box(x + 1, y + 18, 33, 6, IRON); R(x + 2, y + 22, 31, 1, P.brass[2]);
      box(x + 2, y + 3, 29, 16, IRON); R(x + 3, y + 4, 27, 1, P.iron[4]);
    },
    slant(x, y) {                    // 炮廓前沿做成斜板（顶往后仰），T5～6 唯一的斜线
      box(x + 1, y + 18, 33, 6, IRON); R(x + 2, y + 22, 31, 1, P.brass[2]);
      for (let yy = 3; yy <= 18; yy++) {
        const xr = x + 26 + Math.round((yy - 3) * 0.35);
        R(x + 2, y + yy, xr - x - 2, 1, P.iron[2]); px(x + 2, y + yy, P.iron[0]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]); px(x + 3, y + yy, P.iron[3]);
      }
      R(x + 2, y + 3, 24, 1, P.iron[0]); R(x + 3, y + 4, 22, 1, P.iron[4]);
    },
  };
  // 炮组：黄铜摇架（10×8，压在炮廓上）+ 炮管（三种，全直线，和直射火炮同一套），炮口末端在 x 53
  function mGun(x, y, o, barrel) {
    turn(x + 18, y + 13, o.a || 0, (PX, PY) => {
      const X = PX - 18, Y = PY - 13, d = Math.round((o.k || 0) * 6), end = X + 53 - d;
      box(X + 11, Y + 7, 12, 11, BRASS); R(X + 13, Y + 9, 1, 7, P.brass[3]);   // 摇架（接近旧版大小，给左块留 x 3～10）
      const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
      const band = (hx, y0, hh) => { R(hx, y0, 2, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
      const hoop = (hx, y0, hh) => { R(hx, y0, 2, hh, P.iron[0]); R(hx, y0 + 1, 2, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
      const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 2 + i * 3, w - 4, 1, P.dark[0]); };
      const b0 = X + 22 - d;
      if (barrel === 1) {        // ① 素管 + 一道黄铜箍 + 小方制退器
        tube(b0, end - 5, Y + 10, 6); band(b0 + 9, Y + 9, 8);
        brake(end - 6, Y + 8, 6, 10, 2);
      } else if (barrel === 2) { // ② 炮尾套筒 + 一道箍 + 连体阶梯制退器
        tube(b0, end - 8, Y + 10, 6); tube(b0, b0 + 11, Y + 9, 8); band(b0 + 11, Y + 9, 8);
        R(end - 9, Y + 9, 3, 8, P.iron[0]); R(end - 8, Y + 10, 1, 6, P.iron[3]);
        brake(end - 6, Y + 7, 6, 12, 3);
      } else {                   // ③ 粗炮身 + 三道铁箍 + 大方制退器
        tube(b0, end - 6, Y + 9, 8); for (const hb of [3, 9, 15]) hoop(b0 + hb, Y + 8, 10);
        brake(end - 7, Y + 7, 7, 12, 3);
      }
      if ((o.k || 0) >= 0.85) { R(end, Y + 10, 3, 6, P.fire[3]); R(end + 3, Y + 11, 2, 4, P.fire[2]); }
    });
    R(x + 16, y + 11, 5, 5, P.brass[0]); R(x + 17, y + 12, 3, 3, P.brass[3]); R(x + 18, y + 13, 1, 1, P.brass[0]);   // 方形固定螺栓（同旧版的方框 + 中心点）
  }
  // 六档
  const M_TIERS = [
    { h: 'open', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'open', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['grid2', 3], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['louver2', 3], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];
  // 底图：参与材质处理
  function mBase(g, x, y, T, o = {}) {
    SA.CAND.use(g);
    HOOD[T.h](x, y);
    const Z = MZ[T.h === 'open' ? 'open' : 'hood'].vent;
    vents(x, y, Z.x, Z.y, Z.h, T.vent[0], T.vent[1]);
    if (T.parts.includes('corners')) { corner(x + 2, y + 3, 1, 1); corner(x + 1, y + 19, 1, -1); }
    mGun(x, y, o, T.b);
  }
  // 叠加件：材质之后画（颜色按档位固定）
  function mOver(g, x, y, T) {
    SA.CAND.use(g);
    const [n, kind] = T.riv, c = RIVET_C[kind];
    if (T.h === 'open') for (const fx of MZ.open.rivets.xs) rivetC(x + fx, y + MZ.open.rivets.y, c);
    else { const R0 = MZ.hood.rivets, step = (R0.x1 - R0.x0) / (n - 1); for (let i = 0; i < n; i++) rivetC(Math.round(x + R0.x0 + i * step), y + R0.y, c); }
    if (T.parts.includes('gauge')) smallGauge(x + MZ.hood.gauge.cx, y + MZ.hood.gauge.cy);
  }
  const M_ZONES_VIEW = [
    ['表位（镀镍起）', '#ff6b9a', (x, y) => [x + 3, y + 5, 8, 8]],
    ['散热区', '#46c2c9', (x, y) => [x + 3, y + 13, 8, 5]],
    ['接缝 · 铆钉', '#6fcf6a', (x, y) => [x + 4, y + 18, 27, 3]],
    ['包角位', '#ef7a21', (x, y) => [x + 2, y + 3, 5, 5], (x, y) => [x + 1, y + 19, 5, 5]],
    ['炮组（不放东西）', '#a8a39a', (x, y) => [x + 11, y + 6, 21, 12]],
  ];
  return { M_TIERS, mBase, mOver, M_ZONES_VIEW };
})();
