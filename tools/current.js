// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：四足整件底盘（4×2 = 96×48）的六档 + 变体探索（2026-09-29）。用户：「T6 各等级的四足底盘，以及 T2 一个变体、T3～T6 各两个变体；
// 进行剪影、蒸汽朋克、狂想的探索」。共 15 种：
//   主线 6：T1 黄铜 茶壶蟹 · T2 熟铁 蚱蜢 · T3 钢 骆驼 · T4 镀镍 螳螂 · T5 乌兹钢 象 · T6 以太合金 章鱼
//   变体 9：T2 铁龟 · T3 螃蟹 / 高跷蛛 · T4 机械马 / 犀角甲虫 · T5 蜗牛 / 犰狳 · T6 鹿（管风琴鹿角）/ 晶簇蛛
// 做法：每种 = 一个车体剪影（shell）+ 后腿 / 前腿各一种腿型（kind + 参数）。腿型有 7 类：crab 蟹腿（2 段、膝盖外张）、hop 蚱蜢后腿（大 Z 形）、
// digi 趾行腿（3 段、踝高）、pillar 立柱腿（伸缩柱 + 圆盘脚）、tent 触手（贝塞尔 + 行波）、blade 螳螂镰刀（前腿）、flip 桨脚（短柱 + 宽脚掌）。
// 几何和游戏里的四足整件一致：胯在 (22,10) / (74,10)（远侧 (24,7) / (76,7)），地面在 y+48（远侧 y+45），对角腿同相，踩实地步态；
// 车体顶上一条 3 px 的顶板和上面的模块相接（顶板以上只允许头饰 / 角 / 峰这类「剪影件」，做成正式版时按格子摆放规则再定）。
window.SA = window.SA || {};

SA.QLAB = (() => {
  const LL = SA.LEGLAB, U = LL.U, P = SA.PAL, { NEAR, FAR, gait, ik, bone, frame, gear, rivet, flat } = U;
  const TAU = Math.PI * 2;
  const seg = (pn, a, b, r) => pn.cap(a[0], a[1], b[0], b[1], r);
  const ball = (pn, ramp, x, y, r) => { pn.disc(x, y, r).paint(ramp); pn.dot(x - r * 0.35, y - r * 0.35, ramp[3]); };
  const HIPS = { nr: [22, 10], nf: [74, 10], fr: [24, 7], ff: [76, 7] };

  // ---------- 腿型 ----------
  // c = { pn, M, hx, hy, gy, dir, ph, o, g（步态）, S }；H = 腿型参数；返回不用
  const footOf = (c, H) => [c.hx + c.dir * (H.reach == null ? 4 : H.reach) + c.g.x, c.gy - c.g.lift];
  const LEGS = {
    // 蟹腿：股节往外上方张、胫节往下收，球关节；foot: 'ball' 圆脚 / 'pad' 扁脚
    crab(c, H) {
      const { pn, M, hx, hy, g } = c, hd = H.drop || 0, w = H.w || 1.2, F = footOf(c, H);
      const hip = [hx, hy + hd], K = [hx + c.dir * H.kx + g.x * 0.4, hy + hd - H.up - g.lift * 0.6];
      F[1] -= H.foot === 'pad' ? 1.4 : 2;
      seg(pn, hip, K, w * 1.5); pn.paint(H.thigh || M.steel, { bevel: 'l' });
      const B = bone(K[0], K[1], F[0], F[1]), n = B.len;
      pn.poly(B.pts([[-1, -w * 2.4], [-1, w * 2.4], [n * 0.5, w * 1.8], [n, w * 0.6], [n, -w * 0.6], [n * 0.5, -w * 1.9]])).paint(H.shin || M.iron);
      pn.poly(B.pts([[n * 0.3 - 0.8, -w * 2.2], [n * 0.3 + 0.8, -w * 2.2], [n * 0.3 + 0.8, w * 2.2], [n * 0.3 - 0.8, w * 2.2]])).paint(M.brass, { outline: false, bevel: 'l' });
      ball(pn, M.iron, hip[0], hip[1], w * 2.2); ball(pn, M.iron, K[0], K[1], w * 2.4);
      if (H.foot === 'pad') pn.poly([[F[0] - 4, F[1] + 1.4], [F[0] - 2.5, F[1] - 1], [F[0] + 3, F[1] - 1], [F[0] + 5, F[1] + 1.4]]).paint(M.iron);
      else ball(pn, M.brass, F[0], F[1], w * 1.7);
    },
    // 蚱蜢后腿：大腿甩到高处的膝、小腿又长又斜、脚在前（反关节 Z 形）
    hop(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), hd = H.drop || 0;
      const [kx, ky, ex, ey] = ik(hx, hy + hd, F[0], F[1] - 2, H.l1, H.l2, H.kd || -1);
      const w = H.w || 1.5, T = bone(hx, hy + hd, kx, ky), S = bone(kx, ky, ex, ey);
      seg(pn, [kx, ky], [ex, ey], w * 0.8); pn.paint(M.iron, { bevel: 'l' });
      pn.poly(T.pts([[-2, -w * 2.6], [-2, w * 2.6], [T.len + 1, w * 1.6], [T.len + 1, -w * 1.6]])).paint(M.steel);
      pn.ln(...T.p(2, w * 1.4), ...T.p(T.len - 2, w * 0.8), M.iron[3]);
      for (const a of [0.35, 0.7]) { const q = S.p(S.len * a, 0); pn.disc(q[0], q[1], w * 1.1).paint(M.brass, { bevel: 'l' }); }
      ball(pn, M.brass, kx, ky, w * 2); ball(pn, M.iron, hx, hy + hd, w * 2.4);
      pn.poly([[ex - 5, F[1] + 1.2], [ex - 2, F[1] - 1.4], [ex + 6, F[1] - 0.4], [ex + 8, F[1] + 1.2]]).paint(M.leg);
    },
    // 趾行腿：髋 → 膝 → 踝（ik），踝 → 脚（掌骨），脚是小蹄；kd 决定膝盖朝前 / 朝后
    digi(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), hd = H.drop || 0, w = H.w || 1.2;
      const A = [F[0] - (H.lean || 0) * c.dir * -1, F[1] - (H.l3 || 8)];
      const [kx, ky, ex, ey] = ik(hx, hy + hd, A[0], A[1], H.l1, H.l2, H.kd);
      seg(pn, [ex, ey], [F[0], F[1] - 1], w * 0.75); pn.paint(M.iron, { bevel: 'l' });
      seg(pn, [kx, ky], [ex, ey], w * 0.95); pn.paint(H.shin || M.iron, { bevel: 'l' });
      seg(pn, [hx, hy + hd], [kx, ky], w * 1.55); pn.paint(H.thigh || M.steel, { bevel: 'l' });
      ball(pn, M.brass, ex, ey, w * 1.5); ball(pn, M.iron, kx, ky, w * 2); ball(pn, M.iron, hx, hy + hd, w * 2.3);
      pn.poly([[F[0] - 3.4, F[1] + 1.6], [F[0] - 2, F[1] - 1.6], [F[0] + 2.4, F[1] - 1.6], [F[0] + 4, F[1] + 1.6]]).paint(H.hoof || M.dark);
    },
    // 立柱腿：粗伸缩柱 + 黄铜箍 + 大圆盘脚（内柱随抬脚缩进外柱）
    pillar(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), hd = H.drop || 0, w = H.w || 4, pw = H.pad || 7;
      const top = [hx, hy + hd], bot = [F[0], F[1] - 3], B = bone(top[0], top[1], bot[0], bot[1]), n = B.len;
      pn.cap(...B.p(n * 0.45, 0), ...B.p(n, 0), w * 0.72).paint(M.steel, { bevel: 'l' });
      pn.cap(...B.p(0, 0), ...B.p(n * 0.55, 0), w).paint(M.iron, { bevel: 'l' });
      for (const a of [n * 0.12, n * 0.55]) pn.poly(B.pts([[a - 0.9, -w - 0.7], [a + 0.9, -w - 0.7], [a + 0.9, w + 0.7], [a - 0.9, w + 0.7]])).paint(M.brass, { outline: false, bevel: 'l' });
      if (pn.hi) pn.ln(...B.p(2, -w * 0.5), ...B.p(n * 0.5, -w * 0.5), M.iron[3]);
      pn.poly([[F[0] - pw, F[1]], [F[0] - pw + 2, F[1] - 3.2], [F[0] + pw - 2, F[1] - 3.2], [F[0] + pw, F[1]]]).paint(H.padRamp || M.leg);
      pn.fill(F[0] - pw + 1, F[1] - 1, pw * 2 - 2, 1, M.dark[0]);
      ball(pn, M.iron, top[0], top[1], w * 1.1);
    },
    // 触手：二次贝塞尔（髋 → 外展控制点 → 脚），沿线叠行波；一节节变细，吸盘点在内侧
    tent(c, H) {
      const { pn, M, hx, hy, o } = c, F = footOf(c, H), hd = H.drop || 0, N = 10;
      const P0 = [hx, hy + hd], P1 = [hx + c.dir * (H.out || 12), hy + hd + (H.drop2 == null ? 14 : H.drop2)], t0 = (o.a || 0) - c.ph;
      const pt = (t) => {
        const u = 1 - t, x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * F[0], y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * F[1];
        const dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (F[0] - P1[0]), dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (F[1] - P1[1]), d = Math.hypot(dx, dy) || 1;
        const off = (o.mv ? Math.sin(t * 6 - t0 * 1.5) : Math.sin(t * 5 + (o.t || 0) * 2 + c.ph)) * (H.amp || 2.2) * Math.sin(Math.PI * t);
        return [x - dy / d * off, y + dx / d * off, dx / d, dy / d];
      };
      for (let i = 0; i < N; i++) {
        const a = pt(i / N), b = pt((i + 1) / N), r = (H.r0 || 3.4) + ((H.r1 || 0.9) - (H.r0 || 3.4)) * (i + 0.5) / N;
        pn.cap(a[0], a[1], b[0], b[1], r); pn.paint(i % 2 ? M.iron : (H.ramp || M.steel), { bevel: 'l' });
        if (i % 3 === 1) pn.dot(b[0] + b[3] * r * 0.6, b[1] - b[2] * r * 0.6, M.brass[2]);
      }
      const e = pt(1); pn.disc(e[0], e[1], 1.3).paint(M.brass, { bevel: 'l' });
      ball(pn, M.iron, P0[0], P0[1], (H.r0 || 3.4) + 0.8);
    },
    // 螳螂镰刀（前腿）：粗上臂高高抬到肘，前臂是一片带锯齿的刀，刀尖着地
    blade(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = [hx + c.dir * H.kx + c.g.x * 0.5, hy - H.up - c.g.lift * 0.4];
      const B = bone(K[0], K[1], F[0], F[1]), n = B.len;
      pn.poly(B.pts([[-1, -3.6], [-1, 4.4], [n * 0.5, 4], [n, 0.3], [n * 0.6, -2.4]])).paint(M.steel);
      pn.ln(...B.p(0, 2.6), ...B.p(n - 1, 0.4), M.steel[3], pn.hi ? 2 : 1);
      for (let a = 5; a < n - 3; a += 4.4) pn.poly(B.pts([[a, -2.2], [a + 2.4, -2.2], [a + 1.2, -5]])).paint(M.steel);
      seg(pn, [hx, hy], K, 2.6); pn.paint(M.steel, { bevel: 'l' });
      ball(pn, M.brass, K[0], K[1], 3.2); ball(pn, M.iron, hx, hy, 3.2);
    },
    // 桨脚：短粗立柱 + 宽扁的脚掌（龟）
    flip(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), hd = H.drop || 0, w = H.w || 3.4;
      seg(pn, [hx, hy + hd], [F[0], F[1] - 3], w); pn.paint(M.iron, { bevel: 'l' });
      pn.poly([[F[0] - 7, F[1]], [F[0] - 5, F[1] - 3.2], [F[0] + 4, F[1] - 3.2], [F[0] + 8, F[1] - 1.2], [F[0] + 8, F[1]]]).paint(M.leg);
      for (const u of [-3, 0, 3, 6]) pn.ln(F[0] + u, F[1] - 3, F[0] + u + 0.6, F[1] - 0.6, M.leg[1]);
      pn.poly([[hx - w - 1, hy + hd - 1], [hx + w + 1, hy + hd - 1], [hx + w, hy + hd + 3], [hx - w, hy + hd + 3]]).paint(M.brass, { bevel: 'l' });
    },
  };

  // ---------- 车体剪影 ----------
  // 顶板：3 px，和上面的模块相接（同 legs.js carapace）
  const deck = (pn, x, y) => { pn.fill(x + 3, y, 90, 3, P.iron[1]); pn.fill(x + 3, y, 90, 1, P.iron[0]); pn.fill(x + 3, y + 1, 90, 1, P.iron[3]); pn.fill(x + 3, y + 2, 90, 1, P.iron[0]); };
  const rivets = (pn, x, y, xs) => { for (const u of xs) rivet(pn, x + u, y); };
  const steamPuff = (pn, x, y, t, n = 3) => { for (let k = 0; k < n; k++) { const p = ((t * 1.3 + k / n) % 1); pn.disc(x + Math.sin(p * 5 + k) * 2, y - p * 12, 1 + p * 2.2).paint(NEAR.steam, { outline: false, bevel: '' }); } };
  const eye = (pn, x, y, r = 1.5) => { pn.disc(x, y, r).paint(flat(P.white), { outline: false, bevel: '' }); pn.dot(x, y, P.black); };
  const SHELL = {
    // 1 茶壶蟹：圆肚壶身 + 壶嘴（冒汽）+ 壶耳；侧面一块压力表
    kettle(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, b = (k + 1) / 20 * TAU; pn.cap(x + 1 + Math.cos(a) * 7, y + 13 + Math.sin(a) * 9, x + 1 + Math.cos(b) * 7, y + 13 + Math.sin(b) * 9, 0.9); }
      pn.paint(NEAR.brass, { bevel: 'l' });
      pn.poly(Q([[88, 10], [98, 3], [102, 1], [103, 5], [93, 16], [88, 19]])).paint(NEAR.brass);
      steamPuff(pn, x + 103, y + 1, o.t || 0);
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [90, 3], [94, 12], [88, 26], [12, 26], [2, 12]])).paint(NEAR.iron);
      pn.fill(x + 4, y + 11, 90, 2, P.brass[2]); pn.fill(x + 4, y + 13, 90, 1, P.brass[1]);
      rivets(pn, x, y + 16, [14, 26, 38, 60, 72]);
      pn.disc(x + 49, y + 19, 5).paint(NEAR.brass); pn.disc(x + 49, y + 19, 3.4).paint(NEAR.gauge, { outline: false, bevel: 's' });
      const na = -0.6 + Math.sin((o.t || 0) * 3) * 0.4; pn.ln(x + 49, y + 19, x + 49 + Math.cos(na) * 3, y + 19 + Math.sin(na) * 3, P.black);
    },
    // 2 蚱蜢：细长身体 + 尖头 + 触角 + 尾刺
    grass(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), sw = Math.sin((o.t || 0) * 4);
      pn.cap(x + 90, y + 6, x + 100, y - 7 + sw, 0.5).cap(x + 100, y - 7 + sw, x + 108, y - 6 + sw * 2, 0.5).paint(NEAR.leg, { bevel: '' });
      deck(pn, x, y);
      pn.poly(Q([[12, 3], [82, 3], [96, 8], [102, 13], [86, 15], [10, 15], [2, 9]])).paint(NEAR.iron);
      pn.poly(Q([[12, 3], [-6, 11], [10, 13]])).paint(NEAR.iron);
      pn.fill(x + 10, y + 9, 76, 1, P.brass[2]); rivets(pn, x, y + 5, [20, 34, 48, 62]);
      pn.disc(x + 92, y + 8, 2.8).paint(NEAR.brass); pn.dot(x + 91, y + 7, P.white);
      for (let k = 0; k < 5; k++) pn.fill(x + 16 + k * 12, y + 11, 1, 3, P.dark[0]);   // 腹节
    },
    // 3 骆驼：双峰（锅炉圆顶）+ 长颈探头 + 宽鞍
    camel(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      for (const c of [30, 64]) { pn.disc(x + c, y + 3, 9).paint(NEAR.brass); pn.dot(x + c - 3, y - 3, P.brass[3]); pn.fill(x + c - 9, y + 3, 18, 1, P.brass[0]); }
      deck(pn, x, y);
      pn.poly(Q([[5, 3], [88, 3], [90, 16], [4, 16]])).paint(NEAR.iron);
      pn.poly(Q([[86, 4], [96, 2], [104, 6], [106, 11], [98, 12], [93, 10], [88, 16]])).paint(NEAR.iron);
      pn.fill(x + 99, y + 5, 2, 2, P.white); pn.fill(x + 100, y + 6, 1, 1, P.black);
      pn.fill(x + 6, y + 11, 82, 1, P.brass[2]); rivets(pn, x, y + 6, [12, 44, 76]);
      pn.poly(Q([[36, 3], [58, 3], [56, 8], [38, 8]])).paint(NEAR.leather);   // 鞍
    },
    // 4 螳螂：细长腹 + 前胸颈 + 三角头 + 大复眼
    mantis(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      deck(pn, x, y);
      pn.poly(Q([[2, 3], [68, 3], [72, 13], [4, 12]])).paint(NEAR.steel);
      pn.poly(Q([[66, 3], [86, 3], [90, 9], [74, 15]])).paint(NEAR.steel);
      pn.poly(Q([[84, 2], [98, 5], [102, 12], [92, 14], [86, 9]])).paint(NEAR.steel);
      pn.disc(x + 94, y + 7, 3.2).paint(NEAR.brass); pn.dot(x + 93, y + 6, P.white);
      pn.cap(x + 100, y + 4, x + 108, y - 6, 0.5).paint(NEAR.leg, { bevel: '' });
      for (let k = 0; k < 6; k++) pn.fill(x + 10 + k * 10, y + 6, 1, 6, P.iron[0]);
      pn.fill(x + 6, y + 11, 62, 1, P.brass[2]);
    },
    // 5 象：厚身 + 大头 + 齿轮耳 + 长鼻（分节软管）+ 象牙
    elephant(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), sw = Math.sin((o.t || 0) * 2.4 + (o.a || 0));
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [86, 3], [92, 14], [86, 22], [10, 22], [3, 12]])).paint(NEAR.iron);
      pn.poly(Q([[80, 3], [98, 5], [102, 16], [94, 26], [84, 20]])).paint(NEAR.iron);
      let px = 99, py = 18; const ang = 0.5 + sw * 0.25;   // 鼻：8 节软管，节节下垂、末端前翘
      for (let i = 0; i < 8; i++) { const nx = px + Math.cos(ang - i * 0.28) * 4.2, ny = py + Math.sin(ang - i * 0.28 + 1.1) * 4.2; pn.cap(x + px, y + py, x + nx, y + ny, 2.4 - i * 0.2); pn.paint(i % 2 ? NEAR.leg : NEAR.iron, { bevel: 'l' }); px = nx; py = ny; }
      pn.poly(Q([[95, 20], [107, 24], [96, 23]])).paint(NEAR.brass);
      gear(pn, x + 80, y + 12, 10, 12, (o.t || 0) * 0.6, NEAR.brass, NEAR.iron);
      eye(pn, x + 92, y + 11, 1.6);
      pn.fill(x + 6, y + 14, 68, 1, P.brass[2]); rivets(pn, x, y + 6, [10, 24, 38, 52]);
    },
    // 6 章鱼：钟形外套膜 + 大眼 + 漏斗；顶上一圈花斑铆钉
    octo(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), bl = (o.t || 0) % 4 > 3.8;
      deck(pn, x, y);
      pn.poly(Q([[8, 3], [88, 3], [95, 11], [86, 26], [14, 26], [3, 11]])).paint(NEAR.iron);
      pn.poly(Q([[80, 10], [100, 15], [96, 25], [86, 25]])).paint(NEAR.iron);
      for (const [ex, ey] of [[82, 11], [92, 15]]) { pn.disc(x + ex, y + ey, 4.6).paint(flat(P.white), { bevel: '' }); pn.disc(x + ex + 1, y + ey, 2.2).paint(NEAR.fire, { outline: false, bevel: '' }); if (bl) pn.fill(x + ex - 4, y + ey - 1, 9, 2, P.iron[1]); }
      pn.poly(Q([[3, 10], [-3, 14], [6, 16]])).paint(NEAR.brass);
      for (let k = 0; k < 6; k++) pn.disc(x + 14 + k * 11, y + 9 + (k % 2) * 5, 1.4).paint(NEAR.fire, { outline: false, bevel: '' });
    },
    // 7 铁龟：厚圆背甲（六角甲片）+ 短颈探头 + 短尾
    tortoise(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [90, 3], [93, 12], [82, 26], [14, 26], [3, 12]])).paint(NEAR.iron);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const cx = x + 14 + k * 13 + (r % 2) * 6, cy = y + 8 + r * 6.4; if (r === 2 && (k === 5 || k === 0)) continue; pn.poly([[cx - 5, cy], [cx - 2.5, cy - 3.5], [cx + 2.5, cy - 3.5], [cx + 5, cy], [cx + 2.5, cy + 3.5], [cx - 2.5, cy + 3.5]]).paint(NEAR.steel, { bevel: 'l' }); }
      pn.poly(Q([[90, 10], [102, 12], [105, 18], [94, 20]])).paint(NEAR.iron);
      eye(pn, x + 100, y + 14, 1.5);
      pn.poly(Q([[3, 14], [-5, 20], [6, 18]])).paint(NEAR.iron);
    },
    // 8 螃蟹：扁宽甲 + 眼柄 + 一对大钳
    crabby(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), op = 0.3 + Math.abs(Math.sin((o.t || 0) * 2)) * 0.5;
      for (const ex of [78, 86]) { pn.cap(x + ex, y + 4, x + ex + 2, y - 3, 0.5).paint(NEAR.leg, { bevel: '' }); eye(pn, x + ex + 2, y - 4, 2); }
      deck(pn, x, y);
      pn.poly(Q([[8, 3], [88, 3], [95, 12], [88, 22], [8, 22], [1, 12]])).paint(NEAR.steel);
      pn.fill(x + 6, y + 12, 84, 1, P.brass[2]); rivets(pn, x, y + 15, [12, 30, 60, 78]);
      pn.cap(x + 90, y + 11, x + 101, y + 15, 2.8); pn.paint(NEAR.iron, { bevel: 'l' });
      const cx = x + 101, cy = y + 15;
      pn.poly([[cx, cy - 4], [cx + 12, cy - 4 - op * 6], [cx + 13, cy - 1], [cx + 2, cy]]).paint(NEAR.steel);
      pn.poly([[cx, cy + 1], [cx + 13, cy + 1 + op * 4], [cx + 10, cy + 5], [cx, cy + 4.4]]).paint(NEAR.steel);
    },
    // 9 高跷蛛：吊舱小车体
    pod(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      deck(pn, x, y);
      pn.poly(Q([[20, 3], [76, 3], [84, 10], [72, 17], [24, 17], [12, 10]])).paint(NEAR.steel);
      pn.disc(x + 48, y + 10, 5).paint(NEAR.brass); pn.disc(x + 48, y + 10, 2.4).paint(NEAR.dark, { outline: false, bevel: 's' });
      pn.fill(x + 16, y + 9, 64, 1, P.brass[2]); rivets(pn, x, y + 12, [24, 68]);
      pn.poly(Q([[12, 10], [4, 8], [8, 14]])).paint(NEAR.brass); pn.poly(Q([[84, 10], [92, 8], [88, 14]])).paint(NEAR.brass);
    },
    // 10 机械马：桶身 + 胸甲 + 长颈马头（鬃毛管）+ 尾羽管
    horse(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), sw = Math.sin((o.t || 0) * 3 + (o.a || 0));
      for (let k = 0; k < 4; k++) pn.cap(x + 3, y + 6 + k, x - 8 - k * 1.5, y + 16 + k * 3 + sw * 2, 0.7);
      pn.paint(NEAR.brass, { bevel: 'l' });
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [82, 3], [90, 8], [88, 17], [8, 17], [2, 8]])).paint(NEAR.steel);
      pn.poly(Q([[84, 3], [96, 1], [105, 9], [104, 15], [97, 13], [92, 12], [88, 17]])).paint(NEAR.steel);
      pn.fill(x + 100, y + 6, 2, 2, P.white); pn.fill(x + 101, y + 7, 1, 1, P.black);
      for (let k = 0; k < 5; k++) pn.cap(x + 86 - k * 3, y + 3, x + 84 - k * 3, y - 3 - (k % 2), 0.5);
      pn.paint(NEAR.brass, { bevel: '' });
      pn.fill(x + 6, y + 11, 78, 1, P.brass[2]); rivets(pn, x, y + 6, [14, 36, 58]);
    },
    // 11 犀角甲虫：双鞘翅 + 前头一根大角 + 钳
    beetle(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [88, 3], [93, 13], [84, 25], [10, 25], [3, 13]])).paint(NEAR.steel);
      pn.ln(x + 47, y + 3, x + 47, y + 25, P.iron[0]); pn.ln(x + 48, y + 4, x + 48, y + 24, P.iron[4]);
      pn.poly(Q([[86, 10], [96, 6], [106, -10], [102, 8], [100, 14], [90, 18]])).paint(NEAR.iron);
      pn.poly(Q([[92, 18], [104, 20], [100, 23], [90, 23]])).paint(NEAR.iron);
      pn.disc(x + 92, y + 12, 1.6).paint(NEAR.brass, { outline: false, bevel: '' });
      pn.fill(x + 6, y + 19, 78, 1, P.brass[2]);
    },
    // 12 蜗牛：低伏软体 + 螺旋壳（齿轮螺旋）+ 眼柄
    snail(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), w = Math.sin((o.t || 0) * 3);
      pn.cap(x + 90, y + 6, x + 96, y - 6 + w, 0.6).cap(x + 96, y + 6, x + 104, y - 5 - w, 0.6).paint(NEAR.leg, { bevel: '' });
      eye(pn, x + 96, y - 7 + w, 2); eye(pn, x + 104, y - 6 - w, 2);
      deck(pn, x, y);
      pn.poly(Q([[4, 3], [94, 3], [104, 12], [98, 22], [6, 22]])).paint(NEAR.iron);
      pn.disc(x + 40, y + 10, 15).paint(NEAR.steel);
      for (let k = 0; k < 5; k++) { const r = 13 - k * 2.6; for (let i = 0; i < 16; i++) { const a = i / 16 * 1.7 + k * 1.6 + (o.t || 0) * 0.3; pn.dot(x + 40 + Math.cos(a) * r, y + 10 + Math.sin(a) * r, P.brass[2]); } }
      pn.disc(x + 40, y + 10, 2.4).paint(NEAR.brass, { bevel: 'l' });
    },
    // 13 犰狳：分节带甲（一节节横带）+ 尖吻 + 短尾
    armadillo(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      deck(pn, x, y);
      pn.poly(Q([[6, 3], [84, 3], [90, 11], [82, 25], [8, 25], [2, 11]])).paint(NEAR.iron);
      for (let k = 0; k < 8; k++) { const bx = x + 8 + k * 9.6; pn.poly([[bx, y + 3], [bx + 8.4, y + 3], [bx + 8, y + 24], [bx + 0.6, y + 24]]).paint(k % 2 ? NEAR.steel : NEAR.iron, { bevel: 'l' }); }
      pn.poly(Q([[84, 6], [98, 10], [106, 17], [92, 22], [84, 22]])).paint(NEAR.iron);
      pn.poly(Q([[86, 5], [88, -1], [91, 5]])).paint(NEAR.iron);
      eye(pn, x + 94, y + 14, 1.5);
      pn.poly(Q([[3, 14], [-8, 22], [4, 20]])).paint(NEAR.iron);
    },
    // 14 鹿：细身 + 长颈鹿头 + 管风琴鹿角（黄铜管分叉，管口冒汽）
    deer(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]), t = o.t || 0;
      const horn = (bx, by, sx) => {
        const p = [[bx, by], [bx + 3 * sx, by - 8], [bx + 2 * sx, by - 15]];
        seg(pn, [x + p[0][0], y + p[0][1]], [x + p[1][0], y + p[1][1]], 0.9); seg(pn, [x + p[1][0], y + p[1][1]], [x + p[2][0], y + p[2][1]], 0.9);
        seg(pn, [x + p[1][0], y + p[1][1]], [x + p[1][0] + 6 * sx, y + p[1][1] - 6], 0.8); seg(pn, [x + p[1][0], y + p[1][1]], [x + p[1][0] - 3 * sx, y + p[1][1] - 6], 0.8);
        pn.paint(NEAR.brass, { bevel: 'l' });
      };
      horn(96, 3, 1); horn(92, 3, -1);
      for (const [gx, gy] of [[98, -12], [94, -12], [104, -3]]) pn.disc(x + gx, y + gy, 1.1).paint(NEAR.fire, { outline: false, bevel: '' });
      steamPuff(pn, x + 98, y - 13, t, 2);
      deck(pn, x, y);
      pn.poly(Q([[8, 3], [78, 3], [84, 9], [80, 15], [10, 15], [4, 9]])).paint(NEAR.iron);
      pn.poly(Q([[78, 4], [90, 1], [100, 6], [104, 12], [96, 13], [88, 11]])).paint(NEAR.iron);
      pn.fill(x + 96, y + 7, 2, 2, P.white); pn.fill(x + 97, y + 8, 1, 1, P.black);
      pn.fill(x + 8, y + 10, 68, 1, P.brass[2]); rivets(pn, x, y + 5, [16, 36, 56]);
    },
    // 15 晶簇蛛：切面壳 + 背上冒出的晶簇
    crys(pn, x, y, o) {
      const Q = (a) => a.map(([u, v]) => [x + u, y + v]);
      for (const [cx, l, a] of [[36, 12, -1.9], [46, 16, -1.6], [58, 10, -1.3], [50, 9, -1.9]]) {
        const c = Math.cos(a), s = Math.sin(a), px = x + cx, py = y + 3, P2 = (u, v) => [px + u * c - v * s, py + u * s + v * c];
        pn.poly([P2(0, -2.4), P2(l * 0.7, -2.4), P2(l, 0), P2(l * 0.7, 2.4), P2(0, 2.4)]).paint(NEAR.steel); pn.ln(...P2(1, 0), ...P2(l * 0.8, 0), P.fire[3]);
      }
      deck(pn, x, y);
      pn.poly(Q([[10, 3], [86, 3], [94, 11], [76, 25], [22, 25], [4, 11]])).paint(NEAR.iron);
      pn.ln(x + 22, y + 3, x + 36, y + 25, P.iron[4]); pn.ln(x + 62, y + 3, x + 50, y + 25, P.iron[0]); pn.ln(x + 36, y + 25, x + 50, y + 25, P.iron[0]);
      pn.poly(Q([[42, 11], [48, 7], [54, 11], [48, 20]])).paint(NEAR.fire, { bevel: 'l' });
      pn.poly(Q([[94, 11], [104, 15], [90, 17]])).paint(NEAR.steel);
    },
  };

  // ---------- 15 种的编制 ----------
  // rear / front = [腿型, 参数]；hips 可覆盖胯的位置
  const SET = [
    { id: 'kettle', mt: 1, main: true, name: '茶壶蟹', ref: '维多利亚铜茶壶 + 螃蟹', shell: 'kettle',
      idea: '铜茶壶壶身当车体：圆肚、壶嘴（冒白汽）、壶耳；四条短蟹腿撑着，矮、宽、稳。剪影是一只趴着的壶。',
      hips: { nr: [22, 18], nf: [74, 18], fr: [24, 15], ff: [76, 15] },
      rear: ['crab', { up: 5, kx: 15, reach: 6, w: 1.5, foot: 'ball' }], front: ['crab', { up: 5, kx: 15, reach: 6, w: 1.5, foot: 'ball' }] },
    { id: 'grass', mt: 2, main: true, name: '蚱蜢', ref: '蚱蜢的大 Z 形后腿', shell: 'grass',
      idea: '细长身体 + 尖头 + 会抖的触角 + 尾刺；后腿是大 Z（膝盖高高翘在背后上方），前腿是短蟹腿。剪影：后半身像一张拉开的弓。',
      hips: { nr: [22, 12], nf: [74, 12], fr: [24, 9], ff: [76, 9] },
      rear: ['hop', { l1: 20, l2: 27, kd: -1, reach: 2, w: 1.5 }], front: ['crab', { up: 9, kx: 15, reach: 6, w: 1.2, foot: 'ball' }] },
    { id: 'camel', mt: 3, main: true, name: '骆驼', ref: '双峰驼 + 立式锅炉', shell: 'camel',
      idea: '背上两座黄铜圆顶（两只小锅炉）当驼峰，长颈探头，皮革鞍；腿长而细、膝盖大，脚是小蹄。剪影：双峰。',
      rear: ['digi', { l1: 19, l2: 21, kd: -1, l3: 7, lean: 2, reach: 5, w: 1.3 }], front: ['digi', { l1: 19, l2: 21, kd: 1, l3: 7, lean: 0, reach: 4, w: 1.3 }] },
    { id: 'mantis', mt: 4, main: true, name: '螳螂', ref: '螳螂的捕捉足', shell: 'mantis',
      idea: '细长腹 + 前胸颈 + 三角头 + 大复眼；前腿是高高举起的锯齿镰刀（刀尖着地当脚），后腿是趾行腿。剪影：前面像举着一对刀。',
      rear: ['digi', { l1: 19, l2: 21, kd: -1, l3: 8, lean: 2, reach: 3, w: 1.15 }], hips: { nr: [22, 12], nf: [74, 12], fr: [24, 9], ff: [76, 9] },
      front: ['blade', { kx: 12, up: 12, reach: 20 }] },
    { id: 'elephant', mt: 5, main: true, name: '象', ref: '大象 + 齿轮', shell: 'elephant',
      idea: '厚实身体 + 大头 + 一只会转的齿轮大耳 + 分节软管长鼻（跟步子甩）+ 黄铜象牙；四条伸缩立柱腿，圆盘脚。最重、剪影最厚。',
      rear: ['pillar', { w: 4.6, pad: 7.5, reach: 2, drop: 8 }], front: ['pillar', { w: 4.6, pad: 7.5, reach: 4, drop: 8 }] },
    { id: 'octo', mt: 6, main: true, name: '章鱼', ref: '章鱼 / 头足类', shell: 'octo',
      idea: '钟形外套膜 + 一对会眨的大眼 + 漏斗；四条触手一节节变细、末端带吸盘，步行时沿触手传一道波。没有关节，全靠曲线。',
      hips: { nr: [24, 18], nf: [72, 18], fr: [26, 15], ff: [74, 15] },
      rear: ['tent', { out: -16, drop2: 8, r0: 4.2, r1: 1.1, amp: 3, reach: 2 }], front: ['tent', { out: 16, drop2: 8, r0: 4.2, r1: 1.1, amp: 3, reach: 4 }] },
    { id: 'tortoise', mt: 2, name: '铁龟', ref: '陆龟', shell: 'tortoise',
      idea: '六角甲片的厚圆背 + 探头 + 短尾；桨脚：短粗柱 + 宽脚掌。最矮最稳，起伏最小。',
      hips: { nr: [24, 20], nf: [72, 20], fr: [26, 17], ff: [74, 17] },
      rear: ['flip', { w: 3.6, reach: 3 }], front: ['flip', { w: 3.6, reach: 4 }] },
    { id: 'crabby', mt: 3, name: '螃蟹', ref: '招潮蟹的一只大钳', shell: 'crabby',
      idea: '扁宽甲 + 一对眼柄 + 前面一只开合的大钳；四条蟹腿膝盖外张、腿肚有铜箍。剪影：一边一只钳。',
      hips: { nr: [22, 15], nf: [74, 15], fr: [24, 12], ff: [76, 12] },
      rear: ['crab', { up: 9, kx: 17, reach: 5, w: 1.4, foot: 'pad' }], front: ['crab', { up: 9, kx: 17, reach: 7, w: 1.4, foot: 'pad' }] },
    { id: 'stilt', mt: 3, name: '高跷蛛', ref: '盲蛛（长腿蜘蛛）', shell: 'pod',
      idea: '巴掌大的吊舱车体挂在四根又细又长的腿上，膝盖高高举过车体，腿肚一枚黄铜环。剪影：腿比身子长三倍。',
      hips: { nr: [30, 10], nf: [66, 10], fr: [31, 7], ff: [67, 7] },
      rear: ['crab', { up: 32, kx: 14, reach: 20, w: 0.8, foot: 'ball' }], front: ['crab', { up: 32, kx: 14, reach: 20, w: 0.8, foot: 'ball' }] },
    { id: 'horse', mt: 4, name: '机械马', ref: '蒸汽马（19 世纪的蒸汽马机器人设想）', shell: 'horse',
      idea: '桶身 + 胸甲 + 长颈马头（黄铜鬃毛管）+ 尾羽管（会飘）；趾行腿，前膝朝前、后踝朝后，像奔马。',
      hips: { nr: [22, 14], nf: [74, 14], fr: [24, 11], ff: [76, 11] },
      rear: ['digi', { l1: 18, l2: 20, kd: -1, l3: 9, lean: 2, reach: 3, w: 1.3 }], front: ['digi', { l1: 18, l2: 20, kd: 1, l3: 9, lean: 0, reach: 5, w: 1.3 }] },
    { id: 'beetle', mt: 4, name: '犀角甲虫', ref: '独角仙', shell: 'beetle',
      idea: '双鞘翅（中缝一条线）+ 前头一根向上翘的大角 + 下颚钳；腿粗短带刺。剪影：一根冲天的角。',
      hips: { nr: [22, 18], nf: [74, 18], fr: [24, 15], ff: [76, 15] },
      rear: ['crab', { up: 6, kx: 15, reach: 5, w: 1.8, foot: 'pad' }], front: ['crab', { up: 6, kx: 15, reach: 5, w: 1.8, foot: 'pad' }] },
    { id: 'snail', mt: 5, name: '蜗牛', ref: '蜗牛 + 发条', shell: 'snail',
      idea: '低伏的软体 + 一只螺旋壳（螺旋线是转动的发条）+ 两根眼柄；没有腿——四个肉垫脚一收一放，像蜗牛的肌肉波。',
      hips: { nr: [22, 16], nf: [74, 16], fr: [24, 13], ff: [76, 13] },
      rear: ['pillar', { w: 3.4, pad: 6.5, reach: 2 }], front: ['pillar', { w: 3.4, pad: 6.5, reach: 4 }] },
    { id: 'armadillo', mt: 5, name: '犰狳', ref: '犰狳（带甲）', shell: 'armadillo',
      idea: '八节横带甲片（一节深一节浅）+ 尖吻 + 小耳 + 短尾；腿短，爪子向外撇。剪影：锯齿顶的圆背。',
      hips: { nr: [22, 18], nf: [74, 18], fr: [24, 15], ff: [76, 15] },
      rear: ['crab', { up: 5, kx: 14, reach: 4, w: 1.7, foot: 'pad' }], front: ['crab', { up: 5, kx: 14, reach: 6, w: 1.7, foot: 'pad' }] },
    { id: 'deer', mt: 6, name: '鹿', ref: '麋鹿 + 管风琴', shell: 'deer',
      idea: '细身 + 长颈鹿头 + 管风琴鹿角（黄铜管分叉、管口冒汽、顶端发光宝石）；长细趾行腿。剪影：头顶一棵铜管树。',
      rear: ['digi', { l1: 19, l2: 21, kd: -1, l3: 9, lean: 2, reach: 3, w: 1.0 }], front: ['digi', { l1: 19, l2: 21, kd: 1, l3: 9, lean: 0, reach: 5, w: 1.0 }] },
    { id: 'crys', mt: 6, name: '晶簇蛛', ref: '晶洞 / 水晶簇', shell: 'crys',
      idea: '切面的岩石壳 + 背上冒出一簇发光晶柱 + 中央一颗宝石；腿是尖锐的折线（腿节像晶棱），和双足晶枝腿同一语言。',
      hips: { nr: [24, 17], nf: [72, 17], fr: [26, 14], ff: [74, 14] },
      rear: ['crab', { up: 12, kx: 17, reach: 8, w: 1.1, foot: 'ball' }], front: ['crab', { up: 12, kx: 17, reach: 8, w: 1.1, foot: 'ball' }] },
  ];

  // ---------- 一只四足整件（96×48）画到透明画布，(ox, oy) = 模块左上角；o = { a 步态角, mv, t 秒, stride } ----------
  function figure(g, ox, oy, e, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const S = o.stride || 13, lo = { mv: !!o.mv, a: o.a || 0, t: o.t || 0, plant: true, plantS: S, plantH: 5 + 0.3 * S, stride: S };
    const bd = o.mv ? LL.quadBob({ mv: true, a: lo.a, stride: S }) : 0, hp = { ...HIPS, ...(e.hips || {}) };
    const leg = (M, key, gy, dir, ph, kind) => {
      const [k, H] = kind, [hx, hy] = hp[key];
      const gt = gait(lo, ph, S, 5 + 0.3 * S);
      LEGS[k]({ pn, M, hx: ox + hx, hy: oy + hy + bd, gy, dir, ph, o: lo, g: gt, S }, H || {});
    };
    leg(FAR, 'fr', oy + 45, -1, Math.PI, e.rear); leg(FAR, 'ff', oy + 45, 1, 0, e.front);
    SHELL[e.shell](pn, ox, oy + bd, lo);
    leg(NEAR, 'nr', oy + 48, -1, 0, e.rear); leg(NEAR, 'nf', oy + 48, 1, Math.PI, e.front);
    pn.flush(g);
  }
  return { SET, figure };
})();
