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
  // ---------- 装饰零件试验：齿轮 / 齿轮组 / 传动杆 / 手轮 / 铜管 ----------
  // 齿轮本来就是圆的，按 §3.1「圆只留给本来就圆的小零件」允许。黄铜件在材质处理里只换成该材料的饰件色（trim），不染瓷漆；
  // 铜管用单独的紫铜色阶（不在铁 / 暗铁 / 锈的源色里，材质处理不动它）。
  const COPPER = ['#3b1e16', '#74391f', '#b0603a', '#dd9a6a'];
  // 齿轮：r = 齿顶半径，n = 齿数，ph = 相位（0～1）。轮体是干净的圆盘（描边 + 亮 / 暗半边），齿是一圈 1px（r ≥ 6 时 2px）的方齿；
  // r ≥ 7 开四个减重孔。小齿轮不做逐像素齿形，避免糊成一团
  function gear(cx, cy, r, n, ph = 0, holes = r >= 7) {
    const rb = r - (r >= 6 ? 2 : 1), tw = r >= 6 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = (k + ph) / n * Math.PI * 2, tx = cx + Math.cos(a) * (rb + tw * 0.5) - tw / 2, ty = cy + Math.sin(a) * (rb + tw * 0.5) - tw / 2;
      R(Math.round(tx), Math.round(ty), tw, tw, P.brass[0]);
    }
    for (let yy = Math.floor(cy - rb - 1); yy <= Math.ceil(cy + rb + 1); yy++) for (let xx = Math.floor(cx - rb - 1); xx <= Math.ceil(cx + rb + 1); xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > rb + 0.3) continue;
      let c = d > rb - 0.7 ? P.brass[0] : (d > rb - 1.7 ? (dx + dy < 0 ? P.brass[3] : P.brass[1]) : P.brass[2]);
      if (holes) for (let k = 0; k < 4; k++) { const ha = Math.PI / 4 + k * Math.PI / 2; if (Math.hypot(dx - Math.cos(ha) * rb * 0.52, dy - Math.sin(ha) * rb * 0.52) < rb * 0.2 + 0.3) c = P.dark[0]; }
      if (rb >= 3 && d < rb * 0.3 + 0.5) c = d < 0.8 ? P.brass[3] : P.brass[0];
      else if (rb < 3 && d < 0.8) c = P.brass[0];   // 小齿轮只点一个轴心
      px(xx, yy, c);
    }
  }
  // 手轮：铁轮圈 + 四根辐条 + 黄铜轮毂 + 一个摇柄
  function handwheel(cx, cy, r) {
    for (let yy = Math.floor(cy - r - 1); yy <= Math.ceil(cy + r + 1); yy++) for (let xx = Math.floor(cx - r - 1); xx <= Math.ceil(cx + r + 1); xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d <= r && d > r - 1.3) px(xx, yy, dx + dy < 0 ? P.iron[4] : P.iron[0]);
      else if (d <= r - 1.3 && (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6)) px(xx, yy, P.iron[2]);
    }
    disc(cx, cy, 1.4, P.brass[0]); px(Math.floor(cx), Math.floor(cy), P.brass[3]);
    R(Math.round(cx + r - 1), Math.round(cy - r) - 1, 2, 2, P.brass[2]);
  }
  // 传动杆：铁杆 + 黄铜轴套；水平 / 竖直
  function shaftH(x0, x1, y0) { R(x0, y0, x1 - x0, 2, P.iron[0]); R(x0, y0, x1 - x0, 1, P.iron[3]); }
  function shaftV(x0, y0, y1) { R(x0, y0, 2, y1 - y0, P.iron[0]); R(x0, y0, 1, y1 - y0, P.iron[3]); }
  function collar(x0, y0, vertical = false) { if (vertical) { R(x0 - 1, y0, 4, 2, P.brass[1]); R(x0 - 1, y0, 4, 1, P.brass[3]); } else { R(x0, y0 - 1, 2, 4, P.brass[1]); R(x0, y0 - 1, 1, 4, P.brass[3]); } }
  // 连杆（曲柄销到曲柄销的斜杆，一条直线）
  function link(x0, y0, x1, y1) { line(x0, y0, x1, y1, 2, P.iron[0]); line(x0, y0, x1, y1, 1, P.iron[3]); disc(x0 + 0.5, y0 + 0.5, 1.3, P.brass[2]); disc(x1 + 0.5, y1 + 0.5, 1.3, P.brass[2]); }
  // 铜管（3px：亮 / 中 / 暗），直角弯头，接头处黄铜法兰
  function pipeH(x0, x1, y0) { R(x0, y0, x1 - x0, 1, COPPER[3]); R(x0, y0 + 1, x1 - x0, 1, COPPER[2]); R(x0, y0 + 2, x1 - x0, 1, COPPER[0]); }
  function pipeV(x0, y0, y1) { R(x0, y0, 1, y1 - y0, COPPER[3]); R(x0 + 1, y0, 1, y1 - y0, COPPER[2]); R(x0 + 2, y0, 1, y1 - y0, COPPER[0]); }
  function flangeH(x0, y0) { R(x0, y0 - 1, 2, 5, P.brass[0]); R(x0, y0 - 1, 1, 5, P.brass[3]); }
  function flangeV(x0, y0) { R(x0 - 1, y0, 5, 2, P.brass[0]); R(x0 - 1, y0, 5, 1, P.brass[3]); }
  function valve(cx, cy) { R(cx - 2, cy - 1, 5, 3, P.brass[1]); R(cx - 2, cy - 1, 5, 1, P.brass[3]); R(cx, cy - 4, 1, 3, P.iron[0]); R(cx - 2, cy - 5, 5, 1, P.iron[3]); }
  // 镂空齿轮（v5，用户：颜色要纯、不要杂、不要断断续续）：先算形状遮罩（齿 + 轮缘 + 直辐条 + 轮毂，辐条之间镂空），
  // 再上色——贴着空处的像素一律描边，其余纯色填充；上半部分紧贴描边下面一像素提亮、下半部分紧贴描边上面一像素压暗。
  // 只用 4 个黄铜色，不做逐像素明暗，所以不会糊。齿数按「2px 齿 + 2px 空」（r ≥ 9 时 3px 齿 + 2px 空）算。
  // 颜色固定为真黄铜（不跟材料换），在材质处理之后、垫在整张精灵后面画（destination-over），所以永远是纯黄铜、永远在最后面。
  function gearMask(r, k, ph, sp, opt = {}) {
    const big = r >= 9, n = opt.n || Math.max(6, Math.round(Math.PI * 2 * r / (big ? 5 : 4))), frac = big ? 0.6 : 0.5;
    const rb = r - 2, rim = opt.rim || (big ? 3 : 2), hubR = opt.hub || (big ? 3 : 2), sw = opt.sw || (big ? 1.6 : 1.2);   // r ≥ 9：3px 齿 / 轮缘 / 辐条，中间才有填充色
    return (dx, dy) => {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.2) return false;
      if (d > rb) { const f = ((((Math.atan2(dy, dx) / (Math.PI * 2)) * n + ph) % 1) + 1) % 1; return f < frac; }
      if (d > rb - rim) return true;
      if (d <= hubR + 0.4) return d > 0.9;                    // 轮毂，中间留一个轴孔
      if (!k) return true;                                    // 不开辐条的小齿轮：实心轮盘
      for (let i = 0; i < k; i++) {
        const a0 = sp + i * Math.PI * 2 / k, along = dx * Math.cos(a0) + dy * Math.sin(a0), across = -dx * Math.sin(a0) + dy * Math.cos(a0);
        if (along > 0 && Math.abs(across) < sw) return true;
      }
      return false;
    };
  }
  function gearClean(cx, cy, r, k, ph = 0, sp = 0) {
    const m = gearMask(r, k, ph, sp), x0 = Math.floor(cx - r - 1), y0 = Math.floor(cy - r - 1), W2 = Math.ceil(r * 2 + 3);
    const at = (i, j) => m(x0 + i + 0.5 - cx, y0 + j + 0.5 - cy);
    for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) {
      if (!at(i, j)) continue;
      const up = at(i, j - 1), dn = at(i, j + 1), lf = at(i - 1, j), rt = at(i + 1, j);
      let c = P.brass[2];
      if (!up || !dn || !lf || !rt) c = P.brass[0];
      else if (!at(i, j - 2) && y0 + j + 0.5 < cy) c = P.brass[3];
      else if (!at(i, j + 2) && y0 + j + 0.5 > cy) c = P.brass[1];
      px(x0 + i, y0 + j, c);
    }
  }
  // ---------- 对称齿轮（v6，用户：边缘杂色、奇怪的突起太多，显得不规则、脆弱；要纯色、完美对称、禁止杂边）----------
  // 做法：直径 D 取偶数，圆心落在像素角上；只算 1/8 扇区（0 ≤ y ≤ x），再镜像到 8 个扇区 → 像素级完全对称。
  // 齿是矩形（沿径向 2px 深、横向 tw 宽），齿数是 4 的倍数且有一个齿在 0°；辐条沿坐标轴（或对角线），宽度固定。
  // 上色：整只齿轮只用一种纯色（没有描边、没有明暗），轮毂一个浅色实心圆，轴孔一个深色 2×2。
  // 转动（活动设计）：只在 4 个对称帧之间切换——齿相位 0 / 半齿 × 辐条正 / 斜，每一帧都 8 向对称。
  const GEAR_SPEC = {
    S: { D: 10, n: 8, tw: 2, rim: 0, hub: 1.6, sw: 0, spokes: 0 },
    M: { D: 14, n: 8, tw: 2, rim: 2, hub: 2.2, sw: 2, spokes: 4 },
    L: { D: 18, n: 12, tw: 2, rim: 2, hub: 2.8, sw: 2, spokes: 4 },
    XL: { D: 24, n: 16, tw: 2, rim: 3, hub: 3.6, sw: 4, spokes: 4 },
  };
  const GEAR_TONE = { XL: 1, L: 2, M: 2, S: 2 };   // 最后面的超大齿轮暗一阶；其余同一本色，叠在一起靠各自的斜面光分开
  function gearSymMask(sp, frame) {
    const R0 = sp.D / 2, rb = R0 - 2, half = (frame & 1) ? 0.5 : 0, diag = (frame & 2) ? Math.PI / 4 : 0;
    return (ox, oy) => {                     // ox ≥ oy ≥ 0（1/8 扇区）
      const d = Math.hypot(ox, oy);
      if (d > R0) return 0;
      if (d > rb) {                          // 矩形齿
        for (let k = 0; k < sp.n; k++) {
          const t = (k + half) * Math.PI * 2 / sp.n, al = ox * Math.cos(t) + oy * Math.sin(t), ac = -ox * Math.sin(t) + oy * Math.cos(t);
          if (al > rb - 0.5 && Math.abs(ac) < sp.tw / 2) return 1;
        }
        return 0;
      }
      if (d < 1) return 3;                   // 轴孔
      if (d <= sp.hub) return 2;             // 轮毂
      if (!sp.spokes || d > rb - sp.rim) return 1;   // 实心小齿轮 / 轮缘
      for (let k = 0; k < sp.spokes; k++) {
        const t = diag + k * Math.PI * 2 / sp.spokes, al = ox * Math.cos(t) + oy * Math.sin(t), ac = -ox * Math.sin(t) + oy * Math.cos(t);
        if (al > 0 && Math.abs(ac) < sp.sw / 2) return 1;
      }
      return 0;
    };
  }
  // (cx, cy) = 圆心（像素角，整数）；size = 'S' | 'M' | 'L' | 'XL'；frame = 0～3
  // 金属感（v7，用户：纯色做底图不错，在此基础上加高光和阴影，但不要硬描边）：形状仍然 8 向对称，只在颜色上加光——
  //   ① 斜面：朝左上的边（上 / 左是空的）亮一阶，朝右下的边暗一阶——是本色的邻阶，不是深色描边；
  //   ② 轮缘 + 齿：左上一段弧亮一阶（再叠斜面就是最亮的高光），右下一段弧暗一阶；
  //   ③ 轮毂：比本体亮一阶，左上一个更亮的高光点；轴孔最深。暗部最低只到本色下一阶，不出现描边色。
  // 1/8 扇区镜像成整张 D×D 网格（0 空 / 1 本体 / 2 轮毂 / 3 轴孔）
  function gearGrid(sp, frame) {
    const m = gearSymMask(sp, frame), D = sp.D, h = D / 2, g = new Uint8Array(D * D);
    for (let j = 0; j < h; j++) for (let i = j; i < h; i++) {
      const v = m(i + 0.5, j + 0.5);
      if (!v) continue;
      for (const [a, b] of [[i, j], [j, i]]) for (const sx of [1, -1]) for (const sy of [1, -1]) g[(sy > 0 ? h + b : h - b - 1) * D + (sx > 0 ? h + a : h - a - 1)] = v;
    }
    return g;
  }
  // 按网格上色，返回 [[dx, dy, 颜色], ...]（dx / dy 相对圆心左上角）
  function gearPaint(sp, g) {
    const D = sp.D, h = D / 2, base = sp.tone, rimIn = h - 2 - sp.rim - 0.5, out = [];
    const RAMP = [P.brass[0], P.brass[1], P.brass[2], P.brass[3], '#f6dc92'];
    const at = (i, j) => (i < 0 || j < 0 || i >= D || j >= D) ? 0 : g[j * D + i];
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const v = g[j * D + i];
      if (!v) continue;
      const ox = i + 0.5 - h, oy = j + 0.5 - h, d = Math.hypot(ox, oy), nd = (ox + oy) / (d * Math.SQRT2 || 1);
      let k;
      if (v === 3) k = 0;
      else if (v === 2) k = base + 1 + (ox + oy < -1 ? 1 : 0) - ((at(i + 1, j) !== 2 || at(i, j + 1) !== 2) && ox + oy > 0 ? 1 : 0);
      else {
        let s = 0;
        if (!sp.spokes || d > rimIn) s += nd < -0.55 ? 1 : nd > 0.55 ? -1 : 0;          // 轮缘 / 齿的弧光
        const lit = !at(i, j - 1) || !at(i - 1, j), dark = !at(i, j + 1) || !at(i + 1, j);
        if (lit && !dark) s += 1; else if (dark && !lit) s -= 1;                          // 斜面
        k = base + Math.max(-1, Math.min(2, s));
      }
      out.push([i - h, j - h, RAMP[Math.max(1, Math.min(4, k))]]);
      if (v === 3) out[out.length - 1][2] = RAMP[0];
    }
    return out;
  }
  const gearPainted = new Map();
  function gearSym(cx, cy, size, frame = 0) {
    const sp = Object.assign({ tone: GEAR_TONE[size] }, GEAR_SPEC[size]), key = size + frame;
    if (!gearPainted.has(key)) gearPainted.set(key, gearPaint(sp, gearGrid(sp, frame)));
    for (const [dx, dy, c] of gearPainted.get(key)) px(cx + dx, cy + dy, c);
  }
  // 预制齿轮组：大（r 14，6 辐）在后，中（r 9，十字 4 辐）、小（r 6，实心环 + 轮毂）叠在它前面并咬合。(x, y) = 大齿轮中心。
  // 画的顺序配合 destination-over：先画的在前面（小 → 中 → 大）
  // v6：超大（D24，一整个 24px 块）在最后，大（D18）、中（D14）、小（D10）依次叠在前面、互相咬合；(x, y) = 超大齿轮圆心。
  // destination-over 下先画的在前面：小 → 中 → 大 → 超大。相邻两只的圆心距 = 两个齿顶半径之和 − 2（齿深）
  const GEARSET = [[43, -7, 'S', 1], [34, -4, 'M', 0], [20, -3, 'L', 1], [0, 0, 'XL', 0]];
  function gearSet(g, x, y) {
    SA.CAND.use(g);
    const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'destination-over';
    for (const [dx, dy, size, f] of GEARSET) gearSym(x + dx, y + dy, size, f);
    g.globalCompositeOperation = prev;
  }
  // 零件板（样机页单独展示）：先画铁件（传动杆、连杆），材质处理之后再垫齿轮
  function partsBoard(g, x, y) {
    SA.CAND.use(g);
    shaftH(x + 50, x + 76, y + 50); collar(x + 60, y + 50);
    link(x + 52, y + 44, x + 70, y + 30);
  }
  function partsGears(g, x, y) {
    gearSet(g, x + 16, y + 17);
    SA.CAND.use(g);
    const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'destination-over';
    gearSym(x + 8, y + 50, 'S'); gearSym(x + 24, y + 48, 'M'); gearSym(x + 45, y + 46, 'L'); gearSym(x + 66, y + 44, 'XL', 2);
    g.globalCompositeOperation = prev;
  }

  // ---------- 重炮 3×2（72 × 48，横躺，镀镍起：T4～T6）· v3 历史重炮 ----------
  // 用户：v2 不够蒸汽朋克、偏高科技；取消仪表；背景加黄铜齿轮和铜管；参考历史重炮重新设计。
  // 参考 19 世纪的套箍式攻城 / 岸防重炮（阿姆斯特朗、罗德曼一类）：
  //   炮身 = 炮尾最粗、一段段台阶式收细到炮口（全是直线台阶），尾端一个炮尾钮；
  //   炮架 = 两片台阶形铁炮耳架（墙板）夹着炮耳，坐在带滚轮的铁滑轨上；
  //   俯仰 = 炮尾下方一段黄铜齿弧，由炮架上的小齿轮咬住，传动杆接到后面的手轮。
  // 耳轴 (34,24)，炮口末端 x 76（blen 42，出框 4px），仰角 −6°～34°。v4：装饰只留背景大中小镂空齿轮 + 传动杆（用户：底座装饰太多、不利识别）。
  // 档位：T4 台阶形炮耳架；T5～6 炮耳架前沿斜切（斜向板）+ 炮身更粗、炮管两道铁箍。（试过立一块斜防盾，读成竖杆，放弃）
  // 三种装饰浓度（试验）：A 只有俯仰机构（齿弧 + 小齿轮 + 传动杆 + 手轮）+ 炮架减重窗；
  //                     B = A + 炮架上一组黄铜齿轮（档位越高齿轮越多）+ 紫铜液压管；
  //                     C = B + 炮尾后面的大钟表齿轮背景 + 连杆。
  const HP = { x: 34, y: 24 };   // v4：耳轴下移 6px，把上面让给齿轮组
  const H_TIERS = {
    4: { shield: false, heavy: false, win: 3, gears: 1, riv: 3 },
    5: { shield: true, heavy: true, win: 4, gears: 2, riv: 4 },
    6: { shield: true, heavy: true, win: 4, gears: 3, riv: 4, win2: true },
  };
  // 台阶形炮耳架：tops[i] 是 x0+i 这一列的上沿，底边统一到 bot
  function stepped(x, y, x0, tops, bot) {
    tops.forEach((t, i) => {
      const xx = x + x0 + i, prev = i ? tops[i - 1] : 99, next = i < tops.length - 1 ? tops[i + 1] : 99;
      R(xx, y + t, 1, bot - t + 1, P.iron[2]); px(xx, y + t, P.iron[0]); px(xx, y + t + 1, P.iron[4]); px(xx, y + bot, P.iron[0]);
      if (prev > t) R(xx, y + t, 1, Math.min(prev, bot) - t + 1, P.iron[0]);
      if (prev > t && i) R(xx + 1, y + t + 1, 1, Math.min(prev, bot) - t - 1, P.iron[3]);
      if (next > t) R(xx, y + t, 1, Math.min(next, bot) - t + 1, P.iron[0]);
    });
  }
  const CHEEK_TOPS = [...Array(8).fill(34), ...Array(8).fill(30), ...Array(25).fill(25), ...Array(4).fill(31)];   // x 12～56：T4 台阶形
  const CHEEK_SLANT = [...Array(8).fill(34), ...Array(8).fill(30), ...Array(19).fill(25), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 25 + Math.round(i * 1.4))];   // T5～6：前沿斜切
  // 背景齿轮组（v5 起是预制件 gearSet）：大齿轮在炮尾后上方，中、小叠在它前面并咬合；
  // 被炮身挡住下半也没关系，上半露出来就是「炮背后的钟表机构」。全部落在 48 高的格子里（y ≥ 0）。
  const GEAR_AT = { x: 13, y: 12 };   // v6：超大齿轮圆心（炮尾后上方，左边露出来）   // 预制齿轮组的大齿轮中心：在炮尾后上方（用户：大齿轮放后部）
  function carriage(x, y, T) {
    link(x + 58, y + 8, x + 62, y + 37);                                                        // 传动杆：小齿轮曲柄 → 滑轨前端（从炮管后面穿过）
    box(x + 1, y + 39, 70, 6, IRON); R(x + 2, y + 40, 68, 1, P.iron[4]);                     // 铁滑轨
    for (const wx of [9, 36, 63]) { disc(x + wx, y + 45.5, 2.6, P.dark[0]); disc(x + wx, y + 45.5, 1.6, P.dark[2]); px(x + wx, y + 45, P.brass[2]); }   // 滚轮
    stepped(x, y, 12, T.shield ? CHEEK_SLANT : CHEEK_TOPS, 39);                                // 炮耳架：T4 台阶形，T5～6 前沿斜切
    shaftH(x + 14, x + 54, y + 36); collar(x + 22, y + 36); collar(x + 46, y + 36);            // 传动杆：沿炮耳架的长轴 + 两个轴套
  }
  function hGun(x, y, o, T) {
    turn(x + HP.x, y + HP.y, o.a || 0, (PX, PY) => {
      const d = Math.round((o.k || 0) * 12), C = PX - d, M = PY;
      // 台阶式炮身：[起, 止, 半高]（相对耳轴）
      const H = T.heavy;
      const segs = [[-27, -25, 3], [-25, -24, 2], [-24, -8, H ? 11 : 10], [-8, 8, 9], [8, 18, H ? 8 : 7], [18, 37, H ? 6 : 5], [37, 42, H ? 7 : 6]];
      for (const [a0, a1, hh] of segs) for (let i = C + a0; i < C + a1; i++) {
        R(i, M - hh, 1, hh * 2 + 1, P.iron[0]);
        if (hh > 1) { R(i, M - hh + 1, 1, hh * 2 - 1, P.iron[3]); px(i, M - hh + 1, P.iron[4]); if (hh > 3) { px(i, M - hh + 2, P.iron[4]); R(i, M + hh - 2, 1, 2, P.iron[2]); } }
      }
      segs.forEach(([a0, a1, hh], k) => { if (k && segs[k - 1][2] > hh) R(C + a0, M - hh + 1, 1, hh * 2 - 1, P.iron[2]); });   // 收细处只压暗一列（台阶的阴影面）
      R(C - 28, M - 2, 1, 5, P.iron[0]);                                                                                          // 炮尾钮后沿
      R(C - 12, M - (H ? 11 : 10), 2, (H ? 11 : 10) * 2 + 1, P.brass[1]); R(C - 12, M - (H ? 11 : 10), 1, (H ? 11 : 10) * 2 + 1, P.brass[3]);   // 炮尾黄铜箍
      if (H) for (const hx of [23, 31]) { R(C + hx, M - 7, 2, 15, P.iron[0]); R(C + hx, M - 6, 1, 13, P.iron[4]); }                            // 炮管铁箍
      else { R(C + 27, M - 6, 2, 13, P.iron[0]); R(C + 27, M - 5, 1, 11, P.iron[4]); }
      R(C + 41, M - 2, 1, 5, P.black);                                                                                                          // 炮口
      if ((o.k || 0) >= 0.85) { R(C + 42, M - 5, 4, 11, P.fire[3]); R(C + 46, M - 3, 3, 7, P.fire[2]); }
    });
    disc(x + HP.x, y + HP.y, 3.6, P.brass[0]); disc(x + HP.x, y + HP.y, 2.6, P.brass[2]); px(x + HP.x - 1, y + HP.y - 1, P.brass[3]); px(x + HP.x, y + HP.y, P.brass[0]);   // 炮耳（本来就圆）
  }
  function hBase(g, x, y, T, o = {}) { SA.CAND.use(g); carriage(x, y, T); hGun(x, y, o, T); }
  function hOver(g, x, y, T) {   // 铆钉（滑轨上沿，钢质）+ 垫在最后面的预制齿轮组
    gearSet(g, x + GEAR_AT.x, y + GEAR_AT.y);
    SA.CAND.use(g);
    const n = T.riv, x0 = 5, x1 = 66, step = (x1 - x0) / (n - 1);
    for (let i = 0; i < n; i++) rivetC(Math.round(x + x0 + i * step), y + 41, RIVET_C.steel);
  }
  const H_ZONES_VIEW = [
    ['炮身（随炮转，炮口出框 4px）', '#8f8a80', (x, y) => [x + 7, y + 13, 70, 23]],
    ['预制齿轮组：大（后）+ 中 + 小（前，咬合）', '#f5d77a', (x, y) => [x + 2, y + 0, 54, 29]],
    ['传动杆：曲柄连杆 + 炮耳架长轴', '#ef7a21', (x, y) => [x + 13, y + 10, 50, 29]],
    ['炮耳架（T4 台阶 / T5～6 斜切）', '#46c2c9', (x, y) => [x + 12, y + 25, 45, 15]],
    ['滑轨 · 铆钉', '#6fcf6a', (x, y) => [x + 1, y + 39, 70, 6]],
  ];



  // ---------- 臼炮（高抛火炮）2×2 · v1 ----------
  // 用户：臼炮是抛射火炮，剪影最容易和中炮撞；参考现实重新设计，和其他火炮都分开；没有直射，所以在炮管底座两侧做两个大齿轮，做活动设计。
  // 参考 19 世纪攻城 / 岸防臼炮（如 13 英寸「独裁者」）：炮管又短又粗、口径大，**越往炮口越粗**（和所有加农炮相反），炮口一道厚箍；
  // 炮耳在炮尾，夹在一块炮耳座里；整门炮坐在低矮厚重的炮床上，炮口永远朝天（32°～82°）。
  // 活动设计：炮耳上一个小齿轮跟着炮管转，带动两侧两个大齿轮反向转——瞄准时齿轮真的在转（精灵按 2° 一档缓存，齿轮相位跟仰角走）。
  // 炮管按「旋转后的坐标」逐像素算（不是把画好的图转过去），所以 82° 也不会锯齿。耳轴 (24,30)，炮口末端离耳轴 24（blen 24）。
  // 形体：T1～2 方炮床 + 方炮耳座；T3～4 两层台阶炮床 + 加厚炮耳座；T5～6 炮床前沿斜切 + 梯形炮耳座（斜向板）。
  // 分区：炮床正面左段 = 散热口；炮床上沿右段 = 铆钉；包角 = 炮床两个底角（钢起）；齿轮和炮管周围不放零件。
  const MP = { x: 24, y: 30 };
  const MO_TIERS = [
    { bed: 'block', cheek: 'block', hoops: 0, fat: false, vent: ['slits', 3], riv: [2, 'brass'], corners: false },
    { bed: 'block', cheek: 'block', hoops: 0, fat: false, vent: ['slits', 3], riv: [2, 'brass'], corners: false },
    { bed: 'step', cheek: 'box', hoops: 1, fat: true, vent: ['slits2', 4], riv: [3, 'brass'], corners: true },
    { bed: 'step', cheek: 'box', hoops: 1, fat: true, vent: ['slits2', 4], riv: [3, 'steel'], corners: true },
    { bed: 'slant', cheek: 'trap', hoops: 2, fat: true, vent: ['grid2', 4], riv: [4, 'steel'], corners: true },
    { bed: 'slant', cheek: 'trap', hoops: 2, fat: true, vent: ['louver2', 4], riv: [4, 'steel'], corners: true },
  ];
  const MOZ = { block: { vent: { x: 8, y: 40, h: 3 }, riv: { y: 38, x0: 33, x1: 40 } }, step: { vent: { x: 6, y: 42, h: 3 }, riv: { y: 36, x0: 32, x1: 38 } } };
  const MO_BED = {
    block(x, y) { box(x + 3, y + 36, 42, 11, IRON); R(x + 4, y + 37, 40, 1, P.iron[4]); R(x + 4, y + 45, 40, 1, P.brass[2]); },
    step(x, y) { box(x + 2, y + 40, 44, 7, IRON); R(x + 3, y + 41, 42, 1, P.iron[4]); box(x + 8, y + 35, 32, 6, IRON); R(x + 9, y + 36, 30, 1, P.iron[4]); },
    slant(x, y) {
      for (let yy = 40; yy <= 46; yy++) {
        const xr = x + 40 + Math.round((yy - 40) * 0.9);
        R(x + 2, y + yy, xr - x - 2, 1, P.iron[2]); px(x + 2, y + yy, P.iron[0]); px(x + 3, y + yy, P.iron[3]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
      }
      R(x + 2, y + 40, 38, 1, P.iron[0]); R(x + 3, y + 41, 37, 1, P.iron[4]); R(x + 2, y + 46, 44, 1, P.iron[0]);
      box(x + 8, y + 35, 32, 6, IRON); R(x + 9, y + 36, 30, 1, P.iron[4]);
    },
  };
  const MO_CHEEK = {   // 炮耳座：画在炮管前面（近侧那片墙板），把炮尾夹住
    block(x, y) { box(x + 18, y + 26, 13, 11, IRON); R(x + 19, y + 27, 11, 1, P.iron[4]); },
    box(x, y) { box(x + 16, y + 25, 17, 11, IRON); R(x + 17, y + 26, 15, 1, P.iron[4]); R(x + 17, y + 31, 15, 1, P.iron[1]); },
    trap(x, y) {
      for (let yy = 25; yy <= 35; yy++) {
        const k = Math.round((yy - 25) * 0.4), x0 = x + 18 - k, x1 = x + 31 + k;
        R(x0, y + yy, x1 - x0, 1, P.iron[2]); px(x0, y + yy, P.iron[0]); px(x0 + 1, y + yy, P.iron[3]); px(x1 - 1, y + yy, P.iron[0]); px(x1 - 2, y + yy, P.iron[4]);
      }
      R(x + 18, y + 25, 13, 1, P.iron[0]); R(x + 19, y + 26, 11, 1, P.iron[4]);
    },
  };
  // 炮管：u 沿炮管（0 = 耳轴，正向朝炮口），v 垂直于炮管（负 = 向光的一侧）。越往炮口越粗
  function moProfile(T) {
    const c = T.fat ? 7 : 6, b = T.fat ? 8 : 7, m = b + 1;
    return [[-7, -4, 3], [-4, 5, c], [5, 21, b], [21, 25, m]];
  }
  function moTube(x, y, o, T) {
    const a = (o.a == null ? 55 : o.a) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), d = Math.round((o.k || 0) * 6);
    const segs = moProfile(T), hoopU = T.hoops === 2 ? [[10, 12], [15, 17]] : T.hoops === 1 ? [[13, 15]] : [];
    const cx = x + MP.x, cy = y + MP.y;
    const uv = (px0, py0) => { const dx = px0 + 0.5 - cx, dy = py0 + 0.5 - cy; return [dx * cs - dy * sn + d, dx * sn + dy * cs]; };
    const hwAt = (u) => { for (const [u0, u1, hw] of segs) if (u >= u0 && u < u1) return hw + (hoopU.some(([h0, h1]) => u >= h0 && u < h1) ? 1 : 0); return -1; };
    const inside = (px0, py0) => { const [u, v] = uv(px0, py0), hw = hwAt(u); return hw > 0 && Math.abs(v) <= hw; };
    for (let py0 = cy - 34; py0 <= cy + 14; py0++) for (let px0 = cx - 14; px0 <= cx + 34; px0++) {
      if (!inside(px0, py0)) continue;
      const [u, v] = uv(px0, py0), hw = hwAt(u);
      let c = P.iron[3];
      if (!inside(px0 - 1, py0) || !inside(px0 + 1, py0) || !inside(px0, py0 - 1) || !inside(px0, py0 + 1)) c = P.iron[0];
      else if (u > 23.5 && Math.abs(v) < hw - 2) c = P.black;                                   // 炮口（大口径）
      else if (u >= 3 && u < 5) c = v < 0 ? P.brass[3] : P.brass[1];                            // 黄铜箍
      else if (v < -hw + 2.2) c = P.iron[4];
      else if (v > hw * 0.45) c = P.iron[2];
      if (c === P.iron[3] && hoopU.some(([h0, h1]) => u >= h0 && u < h0 + 1)) c = P.iron[4];
      px(px0, py0, c);
    }
    if ((o.k || 0) >= 0.85) for (let t = 25; t < 31; t++) { const w = Math.max(1, 5 - (t - 25) * 0.7); for (let q = -w; q <= w; q++) px(Math.round(cx + cs * (t - d) + sn * q), Math.round(cy - sn * (t - d) + cs * q), t < 28 ? P.fire[3] : P.fire[2]); }
  }
  // 传动示意（v2，用户：臼炮和齿轮没联动）：左侧大齿轮轮毂上的曲柄销 → 炮管背面的吊耳，一根直连杆；
  // 仰角变了吊耳跟着炮管走、连杆跟着摆，看得出是齿轮在推炮管
  function moLug(x, y, o) {
    const a = (o.a == null ? 55 : o.a) * Math.PI / 180, d = Math.round((o.k || 0) * 6), u = 12 - d, v = -8.5;
    return [Math.round(x + MP.x + Math.cos(a) * u + Math.sin(a) * v), Math.round(y + MP.y - Math.sin(a) * u + Math.cos(a) * v)];
  }
  function moLink(x, y, o) {
    const [lx, ly] = moLug(x, y, o);
    line(x + 10, y + 29, lx, ly, 3, P.iron[0]); line(x + 10, y + 29, lx, ly, 1, P.iron[3]);
    disc(lx + 0.5, ly + 0.5, 2, P.brass[0]); disc(lx + 0.5, ly + 0.5, 1.2, P.brass[2]);        // 炮管上的吊耳
    disc(x + 10, y + 29, 2.2, P.brass[0]); disc(x + 10, y + 29, 1.3, P.brass[3]);             // 齿轮轮毂上的曲柄销
  }
  function moBase(g, x, y, T, o = {}) {
    SA.CAND.use(g);
    MO_BED[T.bed](x, y);
    const Z = MOZ[T.bed === 'block' ? 'block' : 'step'];
    vents(x, y, Z.vent.x, Z.vent.y, Z.vent.h, T.vent[0], T.vent[1]);
    if (T.corners) { corner(x + 2, y + 42, 1, -1); corner(x + (T.bed === 'slant' ? 40 : 41), y + 42, -1, -1); }
    moTube(x, y, o, T);
    moLink(x, y, o);
    MO_CHEEK[T.cheek](x, y);
    R(x + MP.x - 2, y + MP.y - 2, 5, 5, P.brass[0]); R(x + MP.x - 1, y + MP.y - 1, 3, 3, P.brass[3]); px(x + MP.x, y + MP.y, P.brass[0]);   // 方形固定螺栓（炮耳）
  }
  // 叠加件：铆钉；垫底：活动齿轮（炮耳小齿轮跟炮管转，两侧大齿轮反向转）
  function moOver(g, x, y, T, o = {}) {
    SA.CAND.use(g);
    const Z = MOZ[T.bed === 'block' ? 'block' : 'step'].riv, [n, kind] = T.riv, step = (Z.x1 - Z.x0) / (n - 1);
    for (let i = 0; i < n; i++) rivetC(Math.round(x + Z.x0 + i * step), y + Z.y, RIVET_C[kind]);
    const a = (o.a == null ? 55 : o.a) * Math.PI / 180;
    const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'destination-over';
    const f = Math.floor((o.a == null ? 55 : o.a) / 6) % 4;   // 活动设计：仰角每 6° 换一个对称帧
    gearSym(x + MP.x, y + MP.y, 'S', f);                                                  // 炮耳小齿轮
    for (const gx of [10, 38]) gearSym(x + gx, y + 29, 'L', 3 - f);                       // 两侧大齿轮：反向转
    g.globalCompositeOperation = prev;
  }
  // 可转动的齿轮：把遮罩整体转 θ（弧度）
  function gearRot(cx, cy, r, k, th, opt) {
    const m = gearMask(r, k, 0, 0, opt), c0 = Math.cos(th), s0 = Math.sin(th), x0 = Math.floor(cx - r - 1), y0 = Math.floor(cy - r - 1), N = Math.ceil(r * 2 + 3);
    const at = (i, j) => { const dx = x0 + i + 0.5 - cx, dy = y0 + j + 0.5 - cy; return m(dx * c0 + dy * s0, -dx * s0 + dy * c0); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!at(i, j)) continue;
      let c = P.brass[2];
      if (!at(i, j - 1) || !at(i, j + 1) || !at(i - 1, j) || !at(i + 1, j)) c = P.brass[0];
      else if (!at(i, j - 2) && y0 + j + 0.5 < cy) c = P.brass[3];
      else if (!at(i, j + 2) && y0 + j + 0.5 > cy) c = P.brass[1];
      px(x0 + i, y0 + j, c);
    }
  }
  const MO_ZONES_VIEW = [
    ['炮管（越往炮口越粗）+ 炮口朝天', '#8f8a80', (x, y) => [x + 20, y + 4, 22, 30]],
    ['两侧活动大齿轮（随仰角转）+ 连杆推炮管', '#f5d77a', (x, y) => [x + 0, y + 14, 48, 24]],
    ['炮耳座（画在炮管前面）', '#c9a0ff', (x, y) => [x + 16, y + 25, 17, 12]],
    ['散热区（炮床正面左段）', '#46c2c9', (x, y) => [x + 5, y + 39, 12, 5]],
    ['铆钉（炮床上沿右段）', '#6fcf6a', (x, y) => [x + 31, y + 35, 12, 4]],
    ['包角位（钢起）', '#ef7a21', (x, y) => [x + 2, y + 42, 5, 5], (x, y) => [x + 41, y + 42, 5, 5]],
  ];
  return { M_TIERS, mBase, mOver, M_ZONES_VIEW, S_TIERS, sBase, sOver, S_ZONES_VIEW, SD_TIERS, sdBase, sdOver, SD_ZONES_VIEW, H_TIERS, hBase, hOver, H_ZONES_VIEW, partsBoard, partsGears, gearSet, MO_TIERS, moBase, moOver, MO_ZONES_VIEW };
})();
