// 直射火炮 · 高阶造型语言（tools/cannon-lab.html 专用，只做视觉，不改游戏）。
// 用户反馈：镀镍以上越来越复杂、越来越「高级」，乌兹钢的圆顶像外星科技，以太的线路 + 圆润 + 看不清的细节又难认又太科幻。
// 这里的做法：
//   ① 造型只用直线条：第三阶段不再用圆顶和刻槽，改成「阶梯式炮廓 + 檐口线脚 + 铁箍炮身 + 方形制退器」（维多利亚工业建筑的语言）；
//   ② 高阶身份交给一套可复用的装饰零件——铭牌、包角铁、铆钉排、顶饰、檐口、徽记、压力表、铁箍——每件都小、直、位置固定；
//   ③ 每档只换 / 只加一件，不靠堆细节。零件按原画的冷铁 + 黄铜画，材质处理照常换色（铁件跟材料走，黄铜件保持黄铜）。
window.SA = window.SA || {};

SA.CNLAB = (() => {
  const { P, R, px, disc, line, box, rivet, arch, turn, IRON, IRONL, DARK, BRASS } = SA.CAND;
  const PIV = [34, 27];

  // ---------- 可复用的装饰零件（坐标都是模块内的绝对像素） ----------
  const PARTS = {
    // 黄铜铭牌：机车上的制造商铭牌，10×6，两颗铆钉 + 两道刻字线
    plate(x, y) {
      R(x, y, 10, 6, P.brass[0]); R(x + 1, y + 1, 8, 4, P.brass[2]); R(x + 1, y + 1, 8, 1, P.brass[3]);
      px(x + 1, y + 3, P.brass[0]); px(x + 8, y + 3, P.brass[0]);
      R(x + 3, y + 2, 4, 1, P.brass[1]); R(x + 3, y + 4, 4, 1, P.brass[1]);
    },
    // 包角铁：模块角上的 L 形角铁，5×5，一颗铆钉；fx / fy 决定朝向
    corner(x, y, fx = 1, fy = 1) {
      const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
      for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
      px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
    },
    // 铆钉排：沿接缝一排铆钉，4px 一颗
    rivets(x, y, n) { for (let i = 0; i < n; i++) rivet(x + i * 5, y, P.iron[3]); },
    // 顶饰：炮塔顶上的黄铜球头（维多利亚屋脊的小尖顶）
    finial(cx, y) { R(cx, y - 3, 1, 3, P.brass[1]); disc(cx + 0.5, y - 4.5, 1.8, P.brass[0]); disc(cx + 0.5, y - 4.5, 1.1, P.brass[3]); },
    // 檐口线脚：顶边一条外挑 1px 的线脚（上亮下暗两道）
    cornice(x, y, w) { R(x - 1, y, w + 2, 1, P.iron[0]); R(x - 1, y + 1, w + 2, 1, P.iron[4]); R(x - 1, y + 2, w + 2, 1, P.iron[1]); },
    // 徽记：黄铜盾形徽章，9×10，中间一颗星——最高档专用
    crest(x, y) {
      const rows = [9, 9, 9, 9, 9, 7, 7, 5, 3, 1];
      rows.forEach((w, i) => { const o = (9 - w) >> 1; R(x + o, y + i, w, 1, P.brass[0]); if (w > 2) R(x + o + 1, y + i, w - 2, 1, i < 2 ? P.brass[3] : P.brass[2]); });
      R(x + 4, y + 2, 1, 5, P.brass[0]); R(x + 2, y + 4, 5, 1, P.brass[0]); px(x + 4, y + 4, P.brass[3]);
    },
    // 压力表：黄铜圈 + 蒸汽白表盘 + 绿区 + 指针
    gauge(cx, cy) { SA.CAND.gauge(cx, cy, 3.5, 0.6); },
    // 铁箍：炮身上的加强箍（在炮管里画，这里给零件库展示用）
    hoops(x, y, h, n) { for (let i = 0; i < n; i++) { R(x + i * 5, y - 1, 3, h + 2, P.iron[0]); R(x + i * 5, y, 3, h, P.iron[2]); R(x + i * 5, y, 1, h, P.iron[4]); } },
  };
  const PART_INFO = [
    ['plate', '黄铜铭牌', '机车上的制造商铭牌。放在炮塔 / 模块最大的平面中间偏下', '10×6'],
    ['corner', '包角铁', '四角的 L 形加强角铁，一颗铆钉。放在模块外沿四角', '5×5'],
    ['rivets', '铆钉排', '沿接缝的一排铆钉。放在两块板的拼接处', '每颗 3×3'],
    ['finial', '顶饰', '顶上的黄铜小球头，维多利亚屋脊的尖顶。放在模块最高点', '3×7'],
    ['cornice', '檐口线脚', '顶边外挑 1px 的线脚，像建筑的檐口。放在模块顶边', '宽 +2 × 3'],
    ['crest', '徽记', '黄铜盾形徽章 + 星，最高档专用。放在铭牌的位置', '9×10'],
    ['gauge', '压力表', '蒸汽朋克的标志件。放在侧面、管路旁', '直径 7'],
    ['hoops', '铁箍', '炮身 / 管身的加强箍（铁，跟材料走）。代替刻槽和复杂的炮身', '3×高'],
  ];

  // ---------- 炮塔（照搬游戏的阶段 ①②，另加直线版的阶段 ③） ----------
  function housing1(x, y) {
    box(x + 10, y + 7, 22, 10, IRON); R(x + 14, y + 10, 12, 1, P.iron[0]);
    box(x + 3, y + 14, 42, 31, IRON);
    for (let i = 0; i < 3; i++) R(x + 7, y + 22 + i * 4, 12, 1, P.iron[0]);
    R(x + 4, y + 39, 40, 1, P.brass[2]); R(x + 4, y + 40, 40, 1, P.brass[1]);
    rivet(x + 6, y + 17); rivet(x + 6, y + 34);
  }
  function housing2(x, y) {
    box(x + 3, y + 16, 42, 29, IRON);
    for (let yy = 5; yy <= 16; yy++) {
      const xr = x + 31 + Math.round((yy - 5) * 1.2);
      R(x + 5, y + yy, xr - x - 5, 1, P.iron[2]); px(x + 5, y + yy, P.iron[0]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
    }
    R(x + 5, y + 4, 26, 1, P.iron[0]); R(x + 6, y + 5, 24, 1, P.iron[4]);
    box(x + 10, y, 9, 5, IRON);
    R(x + 8, y + 10, 12, 2, P.dark[0]);
    for (const rx of [8, 18, 28]) rivet(x + rx, y + 7);
    lowerDetails(x, y);
  }
  // 游戏里现在的阶段 ③（圆顶）——对照用
  function housing3dome(x, y) {
    box(x + 3, y + 16, 42, 29, IRON);
    arch(x + 23, y + 3, y + 18, 19, P.iron[0]); arch(x + 23, y + 4, y + 18, 18, P.iron[2]); arch(x + 22, y + 5, y + 18, 16, P.iron[3]);
    R(x + 6, y + 9, 34, 2, P.brass[1]); R(x + 7, y + 9, 32, 1, P.brass[3]);
    for (const qx of [12, 20]) { R(x + qx, y - 1, 3, 5, P.iron[0]); R(x + qx, y, 2, 3, P.iron[3]); px(x + qx, y + 1, P.glass[2]); }
    for (let a = 1; a < 6; a++) { const ang = Math.PI * (1 + a / 6); rivet(Math.round(x + 22 + Math.cos(ang) * 14), Math.round(y + 18 + Math.sin(ang) * 11)); }
    lowerDetails(x, y);
  }
  // 新阶段 ③：阶梯式炮廓，全部直线——下层宽炮座、上层窄炮廓、顶上一道檐口
  function housing3step(x, y) {
    box(x + 3, y + 16, 42, 29, IRON);
    box(x + 7, y + 6, 28, 11, IRON);
    R(x + 10, y + 10, 10, 2, P.dark[0]);   // 观察缝
    box(x + 12, y + 1, 7, 5, IRON);         // 方舱盖
    lowerDetails(x, y);
  }
  function lowerDetails(x, y) {
    for (let i = 0; i < 3; i++) R(x + 7, y + 22 + i * 4, 12, 1, P.iron[0]);
    R(x + 4, y + 39, 40, 1, P.brass[2]); R(x + 4, y + 40, 40, 1, P.brass[1]);
    rivet(x + 6, y + 34); rivet(x + 40, y + 34);
  }

  // ---------- 炮组：耳轴 (34,27) 转到仰角，炮口在耳轴前 40px ----------
  function gun(x, y, o, barrel) {
    turn(x + PIV[0], y + PIV[1], o.a || 0, (PX, PY) => {
      const X = PX - PIV[0], Y = PY - PIV[1], d = Math.round((o.k || 0) * 9);
      box(X + 26, Y + 15, 16, 24, BRASS); R(X + 29, Y + 17, 1, 20, P.brass[3]);
      R(X + 40, Y + 33, 12, 5, P.dark[0]); R(X + 40, Y + 34, 12, 3, P.iron[2]); R(X + 40, Y + 34, 12, 1, P.iron[4]);
      const bx = X + 38 - d;
      const tube = (x0, len, y0, hh) => { R(x0, y0, len, hh, P.iron[0]); R(x0, y0 + 1, len, hh - 2, P.iron[3]); R(x0, y0 + 1, len, 1, P.iron[4]); R(x0, y0 + hh - 2, len, 1, P.iron[2]); };
      const band = (hx, y0, hh) => { R(hx, y0, 3, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
      const hoop = (hx, y0, hh) => { R(hx, y0, 3, hh, P.iron[0]); R(hx, y0 + 1, 3, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
      if (barrel === 1) {
        tube(bx, 30, Y + 22, 10); for (const hb of [8, 18]) band(bx + hb, Y + 21, 12);
        R(bx + 28, Y + 19, 8, 16, P.iron[0]); R(bx + 29, Y + 20, 6, 14, P.iron[3]); R(bx + 29, Y + 20, 6, 1, P.iron[4]);
        for (const sy of [22, 26, 30]) R(bx + 30, Y + sy, 4, 2, P.dark[0]);
      } else if (barrel === 2) {
        tube(bx, 30, Y + 23, 8); tube(bx, 17, Y + 21, 12);
        for (const rb of [4, 8, 12]) R(bx + rb, Y + 22, 1, 10, P.iron[1]);
        band(bx + 15, Y + 20, 14); band(bx + 23, Y + 22, 10);
        for (const mx of [27, 32]) { R(bx + mx, Y + 19, 4, 16, P.iron[0]); R(bx + mx + 1, Y + 20, 2, 14, P.iron[3]); R(bx + mx + 1, Y + 20, 2, 1, P.iron[4]); }
      } else if (barrel === 3) {   // 游戏现在的阶段 ③：刻槽 + 喇叭制退器
        R(X + 40, Y + 16, 14, 5, P.dark[0]); R(X + 40, Y + 17, 14, 3, P.iron[2]); R(X + 40, Y + 17, 14, 1, P.iron[4]);
        tube(bx, 28, Y + 22, 10);
        for (let i = bx + 1; i < bx + 26; i += 2) { px(i, Y + 25, P.iron[2]); px(i, Y + 28, P.iron[2]); }
        band(bx + 6, Y + 21, 12); band(bx + 20, Y + 21, 12);
        R(bx + 27, Y + 17, 10, 20, P.iron[0]); R(bx + 28, Y + 18, 8, 18, P.iron[3]); R(bx + 28, Y + 18, 8, 1, P.iron[4]);
        R(bx + 35, Y + 16, 2, 22, P.iron[0]); R(bx + 35, Y + 17, 1, 20, P.iron[4]);
        for (const sy of [20, 24, 28, 32]) R(bx + 29, Y + sy, 5, 2, P.dark[0]);
      } else {                     // 新阶段 ③：粗直炮身 + 三道铁箍 + 方形大制退器（直线）
        tube(bx, 30, Y + 21, 12);
        for (const hb of [4, 11, 18]) hoop(bx + hb, Y + 20, 14);
        R(bx + 27, Y + 18, 10, 18, P.iron[0]); R(bx + 28, Y + 19, 8, 16, P.iron[3]); R(bx + 28, Y + 19, 8, 1, P.iron[4]);
        for (const sy of [21, 25, 29]) R(bx + 30, Y + sy, 5, 2, P.dark[0]);
      }
      if ((o.k || 0) >= 0.85) { R(bx + 36, Y + 23, 3, 8, P.fire[3]); R(bx + 39, Y + 25, 2, 4, P.fire[2]); }
    });
    disc(x + 34, y + 27, 3, P.brass[0]); disc(x + 34, y + 27, 2, P.brass[3]);
  }

  // ---------- 方案：每档 = 造型 + 零件 ----------
  // 零件放在固定挂点上：铭牌 / 徽记在炮座大面左下 (8, 29)；角铁在炮座四角；铆钉排在炮座顶接缝；顶饰在炮塔最高点；檐口在上层炮廓顶边
  const HOUSING = { 1: housing1, 2: housing2, dome: housing3dome, step: housing3step };
  const ANCHOR = {
    plate: (x, y) => PARTS.plate(x + 7, y + 30),
    crest: (x, y) => PARTS.crest(x + 8, y + 29),
    corners: (x, y) => { PARTS.corner(x + 3, y + 16, 1, 1); PARTS.corner(x + 3, y + 40, 1, -1); PARTS.corner(x + 40, y + 40, -1, -1); },
    rivets: (x, y) => PARTS.rivets(x + 8, y + 17, 5),
    gauge: (x, y) => PARTS.gauge(x + 13, y + 22),
    finial: (x, y, h) => PARTS.finial(x + (h === 'step' ? 15 : h === 2 ? 14 : 20), y + (h === 'step' ? 1 : h === 2 ? 0 : 7)),
    cornice: (x, y, h) => { if (h === 'step') PARTS.cornice(x + 7, y + 5, 28); else if (h === 2) PARTS.cornice(x + 5, y + 3, 26); else PARTS.cornice(x + 10, y + 6, 22); },
  };
  // tiers：T1～T6 各一个 { h 炮塔, b 炮管, parts 零件 }
  // ================= 方案 A v2：排布规则 =================
  // 炮塔侧面露在炮组左边的那块（模块内 x 4～25、y 16～38）是唯一能放东西的「立面」，按上下分区，每区只放一类东西：
  //   接缝线（y 18～20）—— 铆钉，只打在上下两块板的接缝下沿，等距；
  //   散热区（y 22～30）—— 散热口，档位越高越多，排法也变；
  //   铭牌区（y 32～37）—— 铭牌，在散热区正下方、黄铜腰线之上，左对齐散热口；
  //   包角位            —— 炮座外沿的三个露出来的角（左上、左下、右下）；
  //   表位              —— 上层炮廓的左侧平面（斜板前面那块），只有最高档有压力表。
  // 零件之间、零件和散热口之间至少空 1 像素；任何零件都不压散热口、不压观察缝。
  const ZONE = {
    seam: { y: 19, x0: 10, x1: 23 },          // 铆钉接缝（铆钉占 y 18～20，左边让出包角位）
    vent: { x: 7, y: 22, w: 16, h: 9 },       // 散热区（y 22～30）
    plate: { x: 7, y: 32 },                   // 铭牌（10×6，y 32～37；下面 y 39 是黄铜腰线）
    gauge: { x: 11, y: 10 },                  // 压力表中心
  };
  // 散热口：暗线 + 下面一道亮线（有进深）。排法：rows 单列横槽 / grid 双列横槽 / louver 斜百叶
  function vents(x, y, style, n) {
    const Z = ZONE.vent, slot = (sx, sy, w) => { R(x + sx, y + sy, w, 1, P.iron[0]); R(x + sx, y + sy + 1, w, 1, P.iron[3]); };
    if (style === 'rows') { const gap = n <= 2 ? 4 : 3; for (let i = 0; i < n; i++) slot(Z.x, Z.y + 1 + i * gap, 12); }
    else if (style === 'grid') { for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) slot(Z.x + c * 8, Z.y + i * 3, 6); }
    else if (style === 'louver') { for (let i = 0; i < n; i++) for (let k = 0; k < 7; k++) { px(x + Z.x + i * 4 + (k >> 1), y + Z.y + k, P.iron[0]); px(x + Z.x + i * 4 + (k >> 1) + 1, y + Z.y + k, P.iron[3]); } }
  }
  function seamRivets(x, y, n) {
    const Z = ZONE.seam, step = n > 1 ? (Z.x1 - Z.x0) / (n - 1) : 0;
    for (let i = 0; i < n; i++) rivet(Math.round(x + Z.x0 + i * step), y + Z.y - 1, P.iron[3]);
  }
  // 三种炮塔：方（T1～2）、方 + 平顶炮廓（T3～4）、斜板炮廓（T5～6）。下层炮座都是同一块 42×29 的箱体
  function body(x, y) {
    box(x + 3, y + 16, 42, 29, IRON);
    R(x + 4, y + 39, 40, 1, P.brass[2]); R(x + 4, y + 40, 40, 1, P.brass[1]);
  }
  const TOWER = {
    square(x, y) {   // 原画的方指挥塔
      box(x + 10, y + 7, 22, 10, IRON); R(x + 14, y + 10, 12, 1, P.iron[0]);
      body(x, y);
    },
    box(x, y) {      // 方方正正的平顶炮廓 + 方舱盖
      box(x + 5, y + 5, 28, 12, IRON); R(x + 8, y + 9, 12, 2, P.dark[0]);
      box(x + 11, y + 1, 8, 5, IRON);
      body(x, y);
    },
    slant(x, y) {    // 斜向板：炮廓前沿向后倾（同钢 / 镀镍原来的斜板）
      for (let yy = 5; yy <= 16; yy++) {
        const xr = x + 31 + Math.round((yy - 5) * 1.2);
        R(x + 5, y + yy, xr - x - 5, 1, P.iron[2]); px(x + 5, y + yy, P.iron[0]); px(xr - 1, y + yy, P.iron[0]); px(xr - 2, y + yy, P.iron[4]);
      }
      R(x + 5, y + 4, 26, 1, P.iron[0]); R(x + 6, y + 5, 24, 1, P.iron[4]);
      R(x + 17, y + 9, 10, 2, P.dark[0]);   // 观察缝挪到右边，左边留给表位
      box(x + 11, y, 8, 5, IRON);
      body(x, y);
    },
  };
  // T1～T6：炮塔、炮管、散热口排法 + 数量、接缝铆钉数、零件（每档只多一件）
  const TIERS_A2 = [
    { t: 'square', b: 1, vent: ['rows', 2], riv: 2, parts: [] },
    { t: 'square', b: 1, vent: ['rows', 2], riv: 2, parts: [] },
    { t: 'box', b: 2, vent: ['rows', 3], riv: 3, parts: [] },
    { t: 'box', b: 2, vent: ['rows', 3], riv: 3, parts: ['plate'] },
    { t: 'slant', b: 4, vent: ['grid', 3], riv: 4, parts: ['plate', 'corners'] },
    { t: 'slant', b: 4, vent: ['louver', 4], riv: 4, parts: ['plate', 'corners', 'gauge'] },
  ];
  function drawA2(g0, x, y, tier, o = {}) {
    SA.CAND.use(g0);
    TOWER[tier.t](x, y);
    vents(x, y, tier.vent[0], tier.vent[1]);
    seamRivets(x, y, tier.riv);
    if (tier.parts.includes('plate')) PARTS.plate(x + ZONE.plate.x, y + ZONE.plate.y);
    if (tier.parts.includes('corners')) { PARTS.corner(x + 3, y + 16, 1, 1); PARTS.corner(x + 3, y + 40, 1, -1); PARTS.corner(x + 40, y + 40, -1, -1); }
    if (tier.parts.includes('gauge')) PARTS.gauge(x + ZONE.gauge.x, y + ZONE.gauge.y);
    gun(x, y, o, tier.b);
  }
  // 排布规则图：在 6 倍图上画出各区
  const ZONES_VIEW = [
    ['接缝线 · 铆钉', '#6fcf6a', (x, y) => [x + ZONE.seam.x0 - 1, y + ZONE.seam.y - 2, ZONE.seam.x1 - ZONE.seam.x0 + 4, 4]],
    ['散热区', '#46c2c9', (x, y) => [x + ZONE.vent.x, y + ZONE.vent.y, ZONE.vent.w, ZONE.vent.h]],
    ['铭牌区', '#f5d77a', (x, y) => [x + ZONE.plate.x, y + ZONE.plate.y, 10, 6]],
    ['包角位', '#ef7a21', (x, y) => [x + 3, y + 16, 5, 5], (x, y) => [x + 3, y + 40, 5, 5], (x, y) => [x + 40, y + 40, 5, 5]],
    ['表位（最高档）', '#ff6b9a', (x, y) => [x + ZONE.gauge.x - 4, y + ZONE.gauge.y - 4, 8, 8]],
    ['炮组（不放东西）', '#a8a39a', (x, y) => [x + 26, y + 14, 20, 26]],
  ];

  const SCHEMES = [
    {
      id: 'now', name: '现状（游戏里）', note: '阶段 ①②③ 按 vis [1,3,5]：乌兹钢和以太是圆顶 + 刻槽 + 喇叭口',
      tiers: [[1, 1, []], [1, 1, []], [2, 2, []], [2, 2, []], ['dome', 3, []], ['dome', 3, []]],
    },
    {
      id: 'A', name: 'A v1 · 直线三段 + 每档一件（上一版）', note: '阶段 ③ 换成阶梯式炮廓 + 铁箍炮身（全直线）；镀镍起每档只多一件零件：铭牌 → 包角铁 → 徽记（替换铭牌）',
      tiers: [[1, 1, []], [1, 1, []], [2, 2, []], [2, 2, ['plate']], ['step', 4, ['plate', 'corners']], ['step', 4, ['crest', 'corners']]],
    },
    {
      id: 'B', name: 'B · 骨架不变，只换一件', note: '六档都用阶段 ① 的干净炮塔；每档只有一件「签名零件」，而且是替换不是叠加：钢 铆钉排 → 镀镍 铭牌 → 乌兹钢 包角铁 → 以太 徽记',
      tiers: [[1, 1, []], [1, 1, []], [1, 1, ['rivets']], [1, 1, ['plate']], [1, 1, ['corners']], [1, 1, ['crest']]],
    },
    {
      id: 'C', name: 'C · 建筑感', note: '阶段 ② 保留；阶段 ③ 阶梯炮廓自带檐口线脚；高档加顶饰和压力表，像一座小机房',
      tiers: [[1, 1, []], [1, 1, []], [2, 2, []], [2, 2, ['cornice']], ['step', 4, ['cornice', 'gauge']], ['step', 4, ['cornice', 'finial', 'gauge', 'plate']]],
    },
  ];
  function drawCannon(g0, x, y, h, b, parts, o = {}) {
    SA.CAND.use(g0);
    HOUSING[h](x, y);
    for (const p of parts) if (p !== 'finial' && p !== 'cornice') ANCHOR[p](x, y, h);
    if (parts.includes('cornice')) ANCHOR.cornice(x, y, h);
    if (parts.includes('finial')) ANCHOR.finial(x, y, h);
    gun(x, y, o, b);
  }
  return { PARTS, PART_INFO, SCHEMES, drawCannon, PIV, TIERS_A2, drawA2, ZONES_VIEW, ZONE };
})();
