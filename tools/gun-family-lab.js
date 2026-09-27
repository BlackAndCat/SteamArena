// 火炮家族 · 六档再设计（tools/gun-family-lab.html 专用，只做视觉，不改游戏）。按 docs/visual-rules.md：
// 只用直线；形体在 T3、T5 跃迁；散热口逐档变多、排法变化；铆钉 T1～3 黄铜、镀镍起钢质淡青；包角铁钢起；
// 小模块零件做减法——中炮不放铭牌，镀镍起只加一块小压力表（直径 7）；小炮 1×1 不放任何零件，只靠剪影。
//
// 中炮 2×1（48×24），耳轴 (18,13)，炮口末端 x 59（2026-09-27 按用户要求加长 6px，blen 34 → 40），仰角 −8°～30°。形体和直射火炮一一对应：
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
      const X = PX - 18, Y = PY - 13, d = Math.round((o.k || 0) * 6), end = X + 59 - d;
      box(X + 11, Y + 7, 12, 11, BRASS); R(X + 13, Y + 9, 1, 7, P.brass[3]);   // 摇架（接近旧版大小，给左块留 x 3～10）
      const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
      const band = (hx, y0, hh) => { R(hx, y0, 2, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
      const hoop = (hx, y0, hh) => { R(hx, y0, 2, hh, P.iron[0]); R(hx, y0 + 1, 2, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
      const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 2 + i * 3, w - 4, 1, P.dark[0]); };
      const b0 = X + 22 - d;
      if (barrel === 1) {        // ① 素管 + 一道黄铜箍 + 小方制退器
        tube(b0, end - 5, Y + 10, 6); band(b0 + 12, Y + 9, 8);
        brake(end - 6, Y + 8, 6, 10, 2);
      } else if (barrel === 2) { // ② 炮尾套筒 + 一道箍 + 连体阶梯制退器
        tube(b0, end - 8, Y + 10, 6); tube(b0, b0 + 14, Y + 9, 8); band(b0 + 14, Y + 9, 8);
        R(end - 9, Y + 9, 3, 8, P.iron[0]); R(end - 8, Y + 10, 1, 6, P.iron[3]);
        brake(end - 6, Y + 7, 6, 12, 3);
      } else {                   // ③ 粗炮身 + 三道铁箍 + 大方制退器
        tube(b0, end - 6, Y + 9, 8); for (const hb of [3, 11, 19]) hoop(b0 + hb, Y + 8, 10);
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
  // ---------- 小炮（卡隆短炮）1×1 · v3：剪影优先 ----------
  // 用户：1×1 不做复杂装饰，识别度和低视觉压力优先，剪影是识别的核心；而且格子上方 1/3 不能空着。
  // 所以：不放铆钉、散热口、压力表、包角铁；把卡隆短炮本身放大——长药室 17 长 × 15 高（y 6～20），撑满格子上半；
  // 档位只靠轮廓变：T1～2 铸造「瓶身」（两端倒角 + 圆尾钮 + 细炮管）→ T3～4 药室整个包进方套箱（剪影变方块）+ 台阶收口 → T5～6 套箱前肩斜切（梯形）+ 粗炮管。
  // 只保留两样结构件：耳轴的方形固定螺栓、药室上一道黄铜箍（火力的颜色）。24×24，耳轴 (12,13)，炮口末端 x 36。
  const MOUNT = {
    slide(x, y) {                    // 滑架：暗铁滑轨 + 两个小轮
      box(x + 1, y + 19, 23, 5, SA.CAND.DARK); R(x + 2, y + 19, 21, 1, P.iron[3]);
      for (const wx of [4, 20]) { disc(x + wx, y + 22.5, 2, P.dark[0]); px(x + wx, y + 22, P.iron[3]); }
    },
    box(x, y) { box(x + 1, y + 19, 23, 5, IRON); R(x + 2, y + 20, 21, 1, P.iron[4]); },
    slant(x, y) {
      for (let yy = 19; yy <= 23; yy++) {
        const xr = x + 20 + Math.round((yy - 19) * 0.8);
        R(x + 1, y + yy, xr - x - 1, 1, P.iron[2]); px(x + 1, y + yy, P.iron[0]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
      }
      R(x + 1, y + 19, 20, 1, P.iron[0]); R(x + 2, y + 20, 18, 1, P.iron[4]); R(x + 1, y + 23, 23, 1, P.iron[0]);
    },
  };
  // 一列圆管：上下描边、上沿亮、下沿暗（t / b 是这一列的上下沿）
  const colV = (cx, t, b) => { R(cx, t, 1, b - t + 1, P.iron[0]); if (b - t > 1) { R(cx, t + 1, 1, b - t - 1, P.iron[3]); px(cx, t + 1, P.iron[4]); if (b - t > 3) px(cx, t + 2, P.iron[4]); px(cx, b - 1, P.iron[2]); } };
  function sGun(x, y, o, form) {
    turn(x + 12, y + 13, o.a || 0, (PX, PY) => {
      const d = Math.round((o.k || 0) * 4), C = PX - d, Y = PY, end = C + 24;
      const hoop = (hx, hh) => { R(hx, Y - hh, 2, hh * 2 + 1, P.iron[0]); R(hx, Y - hh + 1, 2, hh * 2 - 1, P.iron[2]); R(hx, Y - hh + 1, 1, hh * 2 - 1, P.iron[4]); };
      const ring = (x0, w, hh) => { R(x0, Y - hh, w, hh * 2 + 1, P.iron[0]); R(x0 + 1, Y - hh + 1, w - 2, hh * 2 - 1, P.iron[3]); R(x0 + 1, Y - hh + 1, w - 2, 1, P.iron[4]); };
      if (form === 'cast') {         // T1～2 铸造卡隆：尾钮 + 两端倒角的长药室（17 长 × 15 高）+ 收口 + 细炮管 + 方口箍
        disc(C - 10.5, Y, 2.5, P.iron[0]); disc(C - 10.5, Y, 1.5, P.iron[3]);
        const prof = [4, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 4];   // 药室每列的半高（C-9～C+7）
        prof.forEach((hh, i) => colV(C - 9 + i, Y - hh, Y + hh));
        for (let i = C + 8; i < end - 3; i++) colV(i, Y - 3, Y + 3);
        R(C - 5, Y - 7, 2, 15, P.brass[1]); R(C - 5, Y - 7, 1, 15, P.brass[3]);   // 药室黄铜箍
        ring(end - 3, 3, 4); px(end - 1, Y, P.black);
      } else {                       // T3～6：整个药室包进方套箱（17×15，倒 1px 角）；T5～6 前肩斜切成梯形
        const slant = form === 'slant', x0 = C - 9, n = 17;
        R(C - 12, Y - 2, 3, 5, P.iron[0]); R(C - 11, Y - 1, 1, 3, P.iron[3]); px(C - 11, Y - 1, P.iron[4]);   // 方尾钮
        for (let i = 0; i < n; i++) {
          const t = Y - 7 + (slant && i >= 7 ? Math.round((i - 7) * 0.6) : 0) + (i === 0 || i === n - 1 ? 1 : 0), b = Y + 7 - (i === 0 || i === n - 1 ? 1 : 0);
          const edge = i === 0 || i === n - 1;
          R(x0 + i, t, 1, b - t + 1, P.iron[0]);
          if (!edge) { R(x0 + i, t + 1, 1, b - t - 1, P.iron[2]); px(x0 + i, t + 1, P.iron[4]); px(x0 + i, b - 1, P.iron[1]); }
          if (i === 1) R(x0 + i, t + 1, 1, b - t - 1, P.iron[3]);
          if (i === n - 2) R(x0 + i, t + 1, 1, b - t - 1, P.iron[1]);
        }
        R(C - 5, Y - 7, 2, 15, P.brass[1]); R(C - 5, Y - 7, 1, 15, P.brass[3]);   // 黄铜箍
        const hh = slant ? 4 : 3;
        for (let i = C + 8; i < end - 5; i++) colV(i, Y - hh, Y + hh);
        if (!slant) { colV(C + 8, Y - 5, Y + 5); colV(C + 9, Y - 5, Y + 5); R(C + 9, Y - 5, 1, 11, P.iron[0]); hoop(C + 14, 4); ring(end - 6, 3, 4); ring(end - 3, 3, 5); px(end - 1, Y, P.black); }   // 收口台阶 + 一道铁箍 + 阶梯方口
        else { hoop(C + 11, 5); ring(end - 6, 6, 5); R(end - 4, Y - 2, 3, 1, P.dark[0]); R(end - 4, Y + 2, 3, 1, P.dark[0]); }   // 一道粗箍 + 方制退器
      }
      if ((o.k || 0) >= 0.85) { R(end, Y - 2, 3, 5, P.fire[3]); R(end + 3, Y - 1, 2, 3, P.fire[2]); }
    });
    R(x + 10, y + 11, 5, 5, P.brass[0]); R(x + 11, y + 12, 3, 3, P.brass[3]); px(x + 12, y + 13, P.brass[0]);   // 方形固定螺栓（耳轴）
  }
  const S_TIERS = [
    { m: 'slide', form: 'cast' }, { m: 'slide', form: 'cast' },
    { m: 'box', form: 'jacket' }, { m: 'box', form: 'jacket' },
    { m: 'slant', form: 'slant' }, { m: 'slant', form: 'slant' },
  ];
  function sBase(g, x, y, T, o = {}) { SA.CAND.use(g); MOUNT[T.m](x, y); sGun(x, y, o, T.form); }
  function sOver() {}   // 1×1 不放身份件
  const S_ZONES_VIEW = [
    ['炮身（识别的核心）', '#f5d77a', (x, y) => [x, y + 4, 24, 15]],
    ['炮座', '#46c2c9', (x, y) => [x + 1, y + 19, 23, 5]],
  ];
  // ---------- 侧炮 2×2（侧挂层）----------
  // 侧挂层的招牌剪影：上面一块挂架板（栓在主体模块上）+ 吊杆 + 下面吊着一门长炮。48×48 里大部分是空的，透出后面的主体模块，所以只画骨架。
  // 耳轴 (18,34)，炮口末端 x 66（blen 48），仰角 −6°～24°。
  // 悬吊臂一律暗铁、加厚（v2）；挂板跟材料。形体：T1～2 窄挂板 + 粗方柱两道筋 → T3～4 方箱挂板 + 双柱两道横撑 → T5～6 斜板挂板 + 实心腹板。
  // 分区只在挂板上（炮组和吊杆不放东西）：铆钉 = 挂板上沿接缝；散热区 = 挂板中右；表位（镀镍起）= 挂板左；包角 = 挂板左上 + 右下。
  const SDZ = {
    post: { vent: { x: 12, y: 5, h: 4 }, rivets: { y: 5, xs: [7, 24] } },
    box: { vent: { x: 15, y: 8, h: 5 }, rivets: { y: 3, x0: 14, x1: 26 }, gauge: { cx: 8.5, cy: 10.5 } },
  };
  // 吊杆用暗铁（骨架在主体模块前面要分得开）；挂板用铁（跟材料）
  const post = (x, y, w, h) => { R(x, y, w, h, P.dark[0]); R(x + 1, y, w - 2, h, P.dark[2]); R(x + 1, y, 1, h, P.dark[3]); };
  // 悬吊臂（v2 加厚）：上下都有法兰；T1～2 粗方柱 + 两道加强筋，T3～4 双柱 + 两道横撑，T5～6 整块实心腹板 + 竖筋
  const flange = (x, y, w) => { R(x, y, w, 2, P.dark[0]); R(x + 1, y, w - 2, 1, P.dark[3]); };
  const rib = (x, y, w) => { R(x, y, w, 1, P.dark[0]); R(x, y + 1, w, 1, P.dark[3]); };
  const ARM = {
    post(x, y) { post(x + 13, y + 12, 7, 15); rib(x + 13, y + 16, 7); rib(x + 13, y + 21, 7); flange(x + 10, y + 12, 13); flange(x + 10, y + 25, 13); },
    truss(x, y) {
      post(x + 11, y + 16, 5, 11); post(x + 20, y + 16, 5, 11);
      for (const ry of [19, 23]) { R(x + 16, y + ry, 4, 2, P.dark[0]); R(x + 16, y + ry, 4, 1, P.dark[3]); }
      flange(x + 9, y + 16, 18); flange(x + 9, y + 25, 18);
    },
    solid(x, y) {
      R(x + 11, y + 16, 14, 11, P.dark[0]); R(x + 12, y + 16, 12, 11, P.dark[2]); R(x + 12, y + 16, 1, 11, P.dark[3]);
      for (const vx of [15, 20]) { R(x + vx, y + 17, 1, 9, P.dark[0]); R(x + vx + 1, y + 17, 1, 9, P.dark[3]); }
      flange(x + 9, y + 16, 18); flange(x + 9, y + 25, 18);
    },
  };
  const HANG = {
    post(x, y) { box(x + 5, y + 3, 23, 9, IRON); R(x + 6, y + 4, 21, 1, P.iron[4]); ARM.post(x, y); },
    box(x, y) { box(x + 3, y + 2, 29, 14, IRON); R(x + 4, y + 3, 27, 1, P.iron[4]); ARM.truss(x, y); },
    slant(x, y) {
      for (let yy = 2; yy <= 15; yy++) {
        const xr = x + 26 + Math.round((yy - 2) * 0.4);
        R(x + 3, y + yy, xr - x - 3, 1, P.iron[2]); px(x + 3, y + yy, P.iron[0]); px(x + 4, y + yy, P.iron[3]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
      }
      R(x + 3, y + 2, 23, 1, P.iron[0]); R(x + 4, y + 3, 21, 1, P.iron[4]); R(x + 3, y + 15, 28, 1, P.iron[0]);
      ARM.solid(x, y);
    },
  };
  function sdGun(x, y, o, barrel) {
    turn(x + 18, y + 34, o.a || 0, (PX, PY) => {
      const X = PX - 18, Y = PY - 34, d = Math.round((o.k || 0) * 7), end = X + 66 - d, b0 = X + 26 - d;
      box(X + 8, Y + 27, 19, 14, BRASS); R(X + 10, Y + 29, 1, 10, P.brass[3]);   // 黄铜摇架
      const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
      const band = (hx, y0, hh) => { R(hx, y0, 2, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
      const hoop = (hx, y0, hh) => { R(hx, y0, 2, hh, P.iron[0]); R(hx, y0 + 1, 2, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
      const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 2 + i * 3, w - 4, 1, P.dark[0]); };
      if (barrel === 1) { tube(b0, end - 5, Y + 31, 6); band(b0 + 16, Y + 30, 8); brake(end - 6, Y + 29, 6, 10, 2); }
      else if (barrel === 2) {
        tube(b0, end - 8, Y + 31, 6); tube(b0, b0 + 16, Y + 30, 8); band(b0 + 16, Y + 30, 8);
        R(end - 9, Y + 30, 3, 8, P.iron[0]); R(end - 8, Y + 31, 1, 6, P.iron[3]);
        brake(end - 6, Y + 28, 6, 12, 3);
      } else { tube(b0, end - 6, Y + 30, 8); for (const hb of [4, 14, 24]) hoop(b0 + hb, Y + 29, 10); brake(end - 7, Y + 28, 7, 12, 3); }
      if ((o.k || 0) >= 0.85) { R(end, Y + 31, 3, 6, P.fire[3]); R(end + 3, Y + 32, 2, 4, P.fire[2]); }
    });
    R(x + 16, y + 32, 5, 5, P.brass[0]); R(x + 17, y + 33, 3, 3, P.brass[3]); px(x + 18, y + 34, P.brass[0]);   // 方形固定螺栓
  }
  const SD_TIERS = [
    { h: 'post', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'post', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['grid2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['louver2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];
  function sdBase(g, x, y, T, o = {}) {
    SA.CAND.use(g);
    HANG[T.h](x, y);
    const Z = SDZ[T.h === 'post' ? 'post' : 'box'].vent;
    vents(x, y, Z.x, Z.y, Z.h, T.vent[0], T.vent[1]);
    if (T.parts.includes('corners')) { corner(x + 3, y + 2, 1, 1); corner(x + (T.h === 'slant' ? 25 : 27), y + 11, -1, -1); }
    sdGun(x, y, o, T.b);
  }
  function sdOver(g, x, y, T) {
    SA.CAND.use(g);
    const [n, kind] = T.riv, c = RIVET_C[kind];
    if (T.h === 'post') for (const fx of SDZ.post.rivets.xs) rivetC(x + fx, y + SDZ.post.rivets.y, c);
    else { const Z = SDZ.box.rivets, step = (Z.x1 - Z.x0) / (n - 1); for (let i = 0; i < n; i++) rivetC(Math.round(x + Z.x0 + i * step), y + Z.y, c); }
    if (T.parts.includes('gauge')) smallGauge(x + SDZ.box.gauge.cx, y + SDZ.box.gauge.cy);
  }
  const SD_ZONES_VIEW = [
    ['接缝 · 铆钉（挂板上沿）', '#6fcf6a', (x, y) => [x + 14, y + 3, 15, 3]],
    ['表位（镀镍起）', '#ff6b9a', (x, y) => [x + 4, y + 7, 9, 8]],
    ['散热区', '#46c2c9', (x, y) => [x + 15, y + 8, 10, 5]],
    ['包角位（钢起）', '#ef7a21', (x, y) => [x + 3, y + 2, 5, 5], (x, y) => [x + 27, y + 11, 5, 5]],
    ['悬吊臂 + 炮组（不放东西）', '#a8a39a', (x, y) => [x + 8, y + 12, 20, 29]],
  ];
  // ---------- 重炮 2×4（48 宽 × 96 高，镀镍起才有：只画 T4～T6 三档）----------
  // 两层立面：上层 = 炮廓 + 炮组（同直射火炮），下层 = 弹药库（弹药提升窗 + 散热口 + 铭牌）。耳轴 (27,30)，炮口末端 x 85（blen 58，长身），仰角 −6°～34°。
  // 形体：T4 方平顶炮廓；T5～6 炮廓前上角斜板（和直射火炮同一条斜线）。下层三档都方正。
  // 分区：上层 表位 = 炮廓左上（直径 11）、观察缝 = 炮廓右上、包角 = 炮廓左上；两层接缝 = 铆钉（y 51）；
  //       下层 散热区 = 左上、铭牌区 = 散热区下方、弹药提升窗 = 右侧（功能区，不放零件）、包角 = 下层左下 + 右下。
  const HZ = { seam: { y: 51, x0: 8, x1: 36 }, vent: { x: 7, y: 57 }, plate: { x: 7, y: 70 }, gauge: { cx: 10.5, cy: 21.5 } };
  function bigGauge(cx, cy) {
    disc(cx, cy, 5, P.brass[0]); disc(cx, cy, 4, P.brass[2]); disc(cx, cy, 3.2, P.steam[2]);
    px(Math.round(cx - 3), Math.round(cy - 3), P.brass[3]);
    for (let i = 0; i < 4; i++) { const a = Math.PI * (1.6 + i * 0.14); px(Math.round(cx - 0.5 + Math.cos(a) * 2.4), Math.round(cy - 0.5 + Math.sin(a) * 2.4), P.gauge[1]); }
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2.5), Math.round(cy - 2), 1, P.dark[0]);
    px(Math.round(cx - 0.5), Math.round(cy - 0.5), P.fire[1]);
  }
  function enamel(x, y) {
    R(x, y, 10, 6, P.brass[0]); R(x + 1, y + 1, 8, 4, P.brass[2]); R(x + 1, y + 1, 8, 1, P.brass[3]);
    R(x + 2, y + 2, 6, 2, '#1c1a1f'); R(x + 3, y + 2, 4, 1, P.brass[1]); R(x + 3, y + 3, 3, 1, P.brass[1]);
  }
  // 大散热口（同直射火炮 PART.vents）：rows 横槽 12 宽 / grid 双列 6 宽 / louver 斜百叶
  function wideVents(x, y, style, n) {
    const Z = HZ.vent, slot = (sx, sy, w) => { R(x + sx, y + sy, w, 1, P.iron[0]); R(x + sx, y + sy + 1, w, 1, P.iron[3]); };
    if (style === 'rows') for (let i = 0; i < n; i++) slot(Z.x, Z.y + 1 + i * 3, 12);
    else if (style === 'grid') for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) slot(Z.x + c * 8, Z.y + i * 3, 6);
    else if (style === 'louver') for (let i = 0; i < n; i++) for (let k = 0; k < 7; k++) { px(x + Z.x + i * 4 + (k >> 1), y + Z.y + k, P.iron[0]); px(x + Z.x + i * 4 + (k >> 1) + 1, y + Z.y + k, P.iron[3]); }
  }
  const HHOOD = {
    box(x, y) {                      // 方平顶炮廓 + 舱盖
      box(x + 3, y + 9, 38, 42, IRON); R(x + 4, y + 10, 36, 1, P.iron[4]);
      box(x + 9, y + 4, 11, 6, IRON);
    },
    slant(x, y) {                    // 前上角斜板
      for (let yy = 9; yy <= 50; yy++) {
        const xr = yy < 21 ? x + 27 + Math.round((yy - 9) * 1.2) : x + 41;
        R(x + 3, y + yy, xr - x - 3, 1, P.iron[2]); px(x + 3, y + yy, P.iron[0]); px(x + 4, y + yy, P.iron[3]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
      }
      R(x + 3, y + 9, 24, 1, P.iron[0]); R(x + 5, y + 10, 21, 1, P.iron[4]);
      box(x + 9, y + 4, 11, 6, IRON);
    },
  };
  function magazine(x, y) {          // 下层弹药库：方箱 + 腰线 + 右侧弹药提升窗（三发黄铜炮弹）
    box(x + 3, y + 50, 42, 43, IRON); R(x + 4, y + 51, 40, 1, P.iron[4]);
    R(x + 4, y + 86, 40, 1, P.brass[2]); R(x + 4, y + 87, 40, 1, P.brass[1]);
    box(x + 27, y + 56, 14, 27, SA.CAND.DARK); R(x + 28, y + 57, 12, 25, P.dark[0]);
    for (const sy of [59, 67, 75]) {
      R(x + 29, y + sy, 7, 5, P.brass[1]); R(x + 29, y + sy, 7, 1, P.brass[3]); R(x + 29, y + sy + 4, 7, 1, P.brass[0]);
      R(x + 36, y + sy + 1, 3, 3, P.iron[3]); px(x + 38, y + sy + 2, P.iron[2]); px(x + 36, y + sy + 1, P.iron[4]);
    }
  }
  function hGun(x, y, o, barrel) {
    turn(x + 27, y + 30, o.a || 0, (PX, PY) => {
      const X = PX - 27, Y = PY - 30, d = Math.round((o.k || 0) * 12), end = X + 85 - d, b0 = X + 36 - d;
      box(X + 16, Y + 17, 22, 27, BRASS); R(X + 18, Y + 19, 1, 23, P.brass[3]);   // 大黄铜摇架
      const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
      const band = (hx, y0, hh) => { R(hx, y0, 3, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
      const hoop = (hx, y0, hh) => { R(hx, y0, 3, hh, P.iron[0]); R(hx, y0 + 1, 3, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
      const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 3 + i * 4, w - 4, 2, P.dark[0]); };
      if (barrel === 2) {        // T4：炮尾套筒 + 一道箍 + 连体阶梯制退器
        tube(b0, end - 10, Y + 25, 11); tube(b0, b0 + 18, Y + 23, 15); band(b0 + 18, Y + 24, 13);
        R(end - 15, Y + 22, 6, 17, P.iron[0]); R(end - 14, Y + 23, 4, 15, P.iron[3]); R(end - 14, Y + 23, 4, 1, P.iron[4]);
        brake(end - 10, Y + 20, 10, 21, 4);
      } else {                   // T5～6：粗炮身 + 三道铁箍 + 大方制退器
        tube(b0, end - 10, Y + 24, 13); for (const hb of [5, 17, 29]) hoop(b0 + hb, Y + 23, 15);
        brake(end - 11, Y + 20, 11, 21, 4);
      }
      // 炮身下的复进杆（直射火炮同款）
      R(b0, Y + 38, 14, 4, P.dark[0]); R(b0, Y + 39, 14, 2, P.iron[2]); R(b0, Y + 39, 14, 1, P.iron[4]);
      if ((o.k || 0) >= 0.85) { R(end, Y + 25, 4, 11, P.fire[3]); R(end + 4, Y + 27, 2, 7, P.fire[2]); }
    });
    R(x + 24, y + 27, 7, 7, P.brass[0]); R(x + 25, y + 28, 5, 5, P.brass[3]); R(x + 26, y + 29, 3, 3, P.brass[1]); px(x + 27, y + 30, P.brass[0]);   // 方形固定螺栓（大号）
  }
  // 只有 T4～T6；低于 T4 的材料不存在这个模块（按 T4 画兜底）
  const H_TIERS = {
    4: { h: 'box', b: 2, vent: ['rows', 3], riv: 3 },
    5: { h: 'slant', b: 3, vent: ['grid', 3], riv: 4 },
    6: { h: 'slant', b: 3, vent: ['louver', 4], riv: 4 },
  };
  function hBase(g, x, y, T, o = {}) {
    SA.CAND.use(g);
    magazine(x, y);
    HHOOD[T.h](x, y);
    R(x + 26, y + 13, 11, 2, P.dark[0]); R(x + 26, y + 15, 11, 1, P.iron[4]);   // 观察缝（炮廓右上）
    wideVents(x, y, T.vent[0], T.vent[1]);
    corner(x + 3, y + 9, 1, 1); corner(x + 3, y + 88, 1, -1); corner(x + 40, y + 88, -1, -1);
    hGun(x, y, o, T.b);
  }
  function hOver(g, x, y, T) {
    SA.CAND.use(g);
    const Z = HZ.seam, step = (Z.x1 - Z.x0) / (T.riv - 1);
    for (let i = 0; i < T.riv; i++) rivetC(Math.round(x + Z.x0 + i * step), y + Z.y, RIVET_C.steel);
    enamel(x + HZ.plate.x, y + HZ.plate.y);
    bigGauge(x + HZ.gauge.cx, y + HZ.gauge.cy);
  }
  const H_ZONES_VIEW = [
    ['表位（直径 11）', '#ff6b9a', (x, y) => [x + 5, y + 16, 12, 12]],
    ['观察缝', '#c9a0ff', (x, y) => [x + 25, y + 12, 13, 5]],
    ['两层接缝 · 铆钉', '#6fcf6a', (x, y) => [x + 7, y + 50, 32, 4]],
    ['散热区', '#46c2c9', (x, y) => [x + 6, y + 56, 17, 9]],
    ['铭牌区', '#f5d77a', (x, y) => [x + 6, y + 69, 12, 8]],
    ['弹药提升窗（功能区）', '#a8a39a', (x, y) => [x + 27, y + 56, 14, 27]],
    ['包角位', '#ef7a21', (x, y) => [x + 3, y + 9, 5, 5], (x, y) => [x + 3, y + 88, 5, 5], (x, y) => [x + 40, y + 88, 5, 5]],
    ['炮组（不放东西）', '#8f8a80', (x, y) => [x + 16, y + 17, 22, 27]],
  ];
  return { M_TIERS, mBase, mOver, M_ZONES_VIEW, S_TIERS, sBase, sOver, S_ZONES_VIEW, SD_TIERS, sdBase, sdOver, SD_ZONES_VIEW, H_TIERS, hBase, hOver, H_ZONES_VIEW };
})();
