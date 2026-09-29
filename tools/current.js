// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：四足整件底盘（4×2 = 96×48）六档 + 变体 · 重做 v1（2026-09-29）。
// 用户：上一版（Sonnet 的茶壶蟹 / 蚱蜢 / 骆驼 / 螳螂 / 象 / 章鱼……）作废——不要动物头、不要奇形怪状；
// 要工业、蒸汽朋克、维多利亚、少量一战风格；以游戏里现有的四足（伏地蛛）为基础版本重画 T1～T6，参考双足的做法出变体和各材质的风格。
//
// 做法（和双足一样）：拓扑不变——一块压低的车体 + 四条「髋 → 高膝 → 脚」的腿，胯 / 地面 / 步态和游戏里的四足整件完全一致；
// 每档换的是「腿的构造」和「车体的工艺」，材质颜色交给游戏的装饰层（L.pass）。车体顶上 3px 顶板和上面的模块相接，顶板以上什么都不画。
// 各档的风格语言：
//   T1 黄铜 · 车间工装（现役伏地蛛）   T2 熟铁 · 维多利亚铁桥 / 桁架         T3 钢 · 一战陆地巡洋舰（菱形车壳、观察缝、液压）
//   T4 镀镍 · 维多利亚马车与仪器      T5 乌兹钢 · 重工业蒸汽机（汽锤、机车、横梁机）  T6 以太合金 · 维多利亚电气（绝缘子、线圈、电子管）
window.SA = window.SA || {};

SA.QLAB = (() => {
  const LL = SA.LEGLAB, U = LL.U, P = SA.PAL, { NEAR, FAR, gait, ik, bone, gear, rivet } = U;
  const TAU = Math.PI * 2;
  const seg = (pn, a, b, r) => pn.cap(a[0], a[1], b[0], b[1], r);
  const ball = (pn, ramp, x, y, r) => { pn.disc(x, y, r).paint(ramp); if (r > 1.6) pn.dot(x - r * 0.4, y - r * 0.4, ramp[3]); };
  const band = (pn, B, a, w, ramp, t = 0.8) => pn.poly(B.pts([[a - t, -w], [a + t, -w], [a + t, w], [a - t, w]])).paint(ramp, { outline: false, bevel: 'l' });
  const GLASS = { near: [P.glass[0], P.glass[1], P.glass[2], P.glass[3]], far: [P.black, P.glass[0], P.glass[1], P.glass[2]] };
  const HIPS = { nr: [22, 10], nf: [74, 10], fr: [24, 7], ff: [76, 7] };

  // ---------- 腿 ----------
  // c = { pn, M, far, hx, hy, gy, dir（-1 后腿 / 1 前腿）, ph, o（步态参数）, g（gait 结果）, t }
  const footOf = (c, H) => [c.hx + c.dir * (H.reach == null ? 4 : H.reach) + c.g.x, c.gy - c.g.lift];
  const kneeOf = (c, H) => [c.hx + c.dir * (H.kx == null ? 10 : H.kx) + c.g.x * (H.kf == null ? 0.45 : H.kf), c.hy - (H.up == null ? 5 : H.up) - c.g.lift * 0.6];
  const hub = (c, r = 3) => { ball(c.pn, c.M.iron, c.hx, c.hy, r); c.pn.disc(c.hx, c.hy, r * 0.38).paint(c.M.brass, { outline: false }); };
  const shoe = (pn, M, F, w = 4, h = 3, ramp) => {   // 铸铁平底靴：梯形 + 底缘一条暗线
    pn.poly([[F[0] - w, F[1]], [F[0] - w + 1.2, F[1] - h], [F[0] + w - 1.2, F[1] - h], [F[0] + w, F[1]]]).paint(ramp || M.leg);
  };

  const LEGS = {
    // T1 现役伏地蛛的蜘蛛腿（原样调用游戏代码）
    spider(c) { LL.spiderLeg(c.pn, c.M, c.hx, c.hy, c.gy, c.dir, c.ph, c.o, LL.QUADS.crawl); },

    // T2 桁架腿：箱形大腿 + 往下收窄的铆接格构小腿（上下两根弦杆 + 之字形腹杆，像维多利亚铁桥 / 铁塔的腿），铸铁平底靴
    truss(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len, w0 = 4.2, w1 = 1.6, wAt = (a) => w0 + (w1 - w0) * a / n;
      pn.cap(...B.p(0, -w0), ...B.p(n, -w1), 0.7).cap(...B.p(0, w0), ...B.p(n, w1), 0.7).paint(M.iron, { bevel: 'l' });
      const k = 5;
      for (let i = 0; i < k; i++) { const a0 = n * i / k, a1 = n * (i + 1) / k, s = i % 2 ? 1 : -1; pn.ln(...B.p(a0, s * (wAt(a0) - 0.6)), ...B.p(a1, -s * (wAt(a1) - 0.6)), M.iron[3]); }
      for (const a of [n * 0.02, n * 0.98]) pn.ln(...B.p(a, -wAt(a)), ...B.p(a, wAt(a)), M.iron[2]);
      if (pn.hi) for (let i = 1; i < k; i++) { const a = n * i / k; for (const s of [-1, 1]) pn.dot(...B.p(a, s * wAt(a)), M.brass[3]); }
      shoe(pn, M, F, 4.5, 3);
      pn.fill(F[0] - 3, F[1] - 3.6, 6, 1, M.brass[1]);
      seg(pn, [hx, hy], K, 2.3); pn.paint(M.iron, { bevel: 'l' });
      if (pn.hi) { const T = bone(hx, hy, K[0], K[1]); pn.ln(...T.p(1.5, 0), ...T.p(T.len - 1.5, 0), M.iron[0]); }
      ball(pn, M.iron, K[0], K[1], 2.8); pn.dot(K[0], K[1], M.brass[2]);
      hub(c, 3.2);
    },

    // T3 液压腿：铆接箱形大腿，小腿是粗缸筒套着活塞杆（抬脚时缩进），车体上伸出一根液压缸顶住小腿；冲压钢脚板带防滑齿
    hydra(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 2.5), n = B.len;
      pn.cap(...B.p(n * 0.42, 0), ...B.p(n, 0), 1.3).paint(M.steel, { bevel: 'l' });
      pn.cap(...B.p(0, 0), ...B.p(n * 0.5, 0), 2.7).paint(M.iron);
      band(pn, B, n * 0.47, 3.1, M.dark, 1);
      // 顶着小腿的液压缸：缸体铰在车体下沿，活塞杆铰在小腿的托耳上
      const R = [hx - dir * 5, hy + 5], S = B.p(n * 0.36, dir * 3.2), D = bone(R[0], R[1], S[0], S[1]);
      pn.cap(...D.p(D.len * 0.5, 0), ...S, 0.7).paint(M.steel, { bevel: 'l' });
      pn.cap(...R, ...D.p(D.len * 0.55, 0), 1.4).paint(M.iron, { bevel: 'l' });
      ball(pn, M.brass, S[0], S[1], 1.2);
      pn.poly([[F[0] - 5, F[1] - 0.8], [F[0] - 4, F[1] - 2.8], [F[0] + 4, F[1] - 2.8], [F[0] + 5, F[1] - 0.8]]).paint(M.iron);
      for (const u of [-4, -1, 2]) pn.fill(F[0] + u, F[1] - 1, 2, 1, M.dark[0]);
      const T = bone(hx, hy, K[0], K[1]);
      pn.poly(T.pts([[-1.5, -3], [-1.5, 3], [T.len + 1, 2.4], [T.len + 1, -2.4]])).paint(M.iron);
      if (pn.hi) for (let a = 2; a < T.len - 1; a += 2.5) pn.dot(...T.p(a, -1.7), M.iron[4]);
      else pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[1]);
      ball(pn, M.steel, K[0], K[1], 2.6);
      ball(pn, M.brass, R[0], R[1], 1.4);
      hub(c, 3.3);
    },

    // T4 曲柄连杆腿：胯是一只转动的黄铜曲柄盘（四根辐条），曲柄销推一根带滑槽的连杆去带大腿；
    // 大腿铰在车体上的轴承座里，抛光的圆杆小腿，脚是一块始终贴地的平掌（维多利亚机械玩具 / 切比雪夫步行机的味道）
    crank(c, H) {
      const { pn, M, hx, hy, dir, o } = c, F = footOf(c, H);
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 3, H.l1 || 12, H.l2 || 34, dir);
      const A = (o.mv ? (o.a || 0) + c.ph : (c.t || 0) * 1.2) * dir, C = [hx - dir * 11, hy + 1], R = 5, Pn = [C[0] + Math.cos(A) * 3.4, C[1] + Math.sin(A) * 3.4];
      // 飞轮（车体侧面，六辐）
      pn.disc(C[0], C[1], R).paint(M.brass);
      pn.disc(C[0], C[1], R - 1.3).paint(M.dark, { outline: false, bevel: '' });
      for (let k = 0; k < 6; k++) { const a = A + k / 6 * TAU; pn.ln(C[0], C[1], C[0] + Math.cos(a) * (R - 1.2), C[1] + Math.sin(a) * (R - 1.2), M.brass[2]); }
      ball(pn, M.brass, C[0], C[1], 1.2);
      // 小腿 + 平掌
      pn.cap(kx, ky, ex, ey, 1.6).paint(M.steel, { bevel: 'l' });
      const B = bone(kx, ky, ex, ey);
      for (const a of [B.len * 0.3, B.len * 0.62]) band(pn, B, a, 2.1, M.brass, 0.7);
      pn.poly([[ex - 5, ey + 3], [ex - 4, ey + 0.6], [ex + 4, ey + 0.6], [ex + 5.5, ey + 3]]).paint(M.iron);
      pn.fill(ex - 3, ey + 1.4, 6, 1, M.brass[2]);
      ball(pn, M.brass, ex, ey, 1.3);
      // 大腿 + 推杆（飞轮的曲柄销 → 膝盖；推杆带滑槽，允许一点伸缩）
      const T = bone(hx, hy, kx, ky);
      pn.poly(T.pts([[-1, -2.2], [-1, 2.2], [T.len + 1, 1.8], [T.len + 1, -1.8]])).paint(M.steel);
      pn.cap(...Pn, kx, ky, 0.85).paint(M.iron, { bevel: 'l' });
      if (pn.hi) { const Rr = bone(Pn[0], Pn[1], kx, ky); pn.ln(...Rr.p(Rr.len * 0.4, 0), ...Rr.p(Rr.len * 0.85, 0), M.dark[0]); }
      ball(pn, M.iron, Pn[0], Pn[1], 1.3);
      ball(pn, M.steel, kx, ky, 2.3);
      hub(c, 3);
    },

    // T5 汽锤腿（内史密斯蒸汽锤）：胯上一根耳轴吊着竖直的汽缸，活塞杆往下伸到砧形铁脚；抬脚 = 活塞缩回。落脚时缸底喷一口汽
    hammer(c, H) {
      const { pn, M, hx, hy, dir, g } = c, F = footOf(c, H);
      const B = bone(hx, hy, F[0], F[1] - 4), n = B.len, cyl = 20;
      pn.cap(...B.p(cyl - 2, 0), ...B.p(n, 0), 1.3).paint(M.steel, { bevel: 'l' });
      pn.poly(B.pts([[-2, -3.4], [-2, 3.4], [cyl, 3.4], [cyl, -3.4]])).paint(M.steel);
      pn.poly(B.pts([[cyl - 1.5, -4.2], [cyl - 1.5, 4.2], [cyl + 0.8, 4.2], [cyl + 0.8, -4.2]])).paint(M.iron);   // 缸底法兰
      pn.poly(B.pts([[1, -4.2], [1, 4.2], [3, 4.2], [3, -4.2]])).paint(M.iron);                                   // 缸盖法兰
      band(pn, B, cyl * 0.55, 3.5, M.brass, 0.6);
      if (pn.hi) for (const a of [2, cyl - 0.4]) for (const f of [-3.2, 3.2]) pn.dot(...B.p(a, f), M.brass[3]);
      // 砧形铁脚：宽顶、收腰、宽底
      const x = F[0], y = F[1];
      pn.poly([[x - 5.5, y], [x - 4.5, y - 1.6], [x - 2.2, y - 2.2], [x - 3.4, y - 4.4], [x + 3.4, y - 4.4], [x + 2.2, y - 2.2], [x + 4.5, y - 1.6], [x + 5.5, y]]).paint(M.iron);
      if (c.o.mv && g.lift < 0.5 && !c.far) { const q = B.p(cyl, dir * -4.5); pn.disc(q[0] - dir * 1.5, q[1] - 1, 1.4).paint(NEAR.steam, { outline: false, bevel: '' }); }
      ball(pn, M.iron, hx, hy, 3.8); pn.disc(hx, hy, 1.5).paint(M.brass, { outline: false });   // 耳轴
    },

    // T6 电弧腿（维多利亚电气）：大腿是一串瓷绝缘子套在黄铜芯上，膝盖是一只铜线圈，小腿是钢杆、中心一条会流动的光（能量），脚是黄铜圆顶 + 两根放电尖
    coil(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = kneeOf(c, H), t = c.t || 0;
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len;
      pn.poly(B.pts([[0, -2], [0, 2], [n, 0.9], [n, -0.9]])).paint(M.steel);
      if (!c.far) for (let a = 3; a < n - 2; a += 1) { const v = Math.sin(a * 0.7 - t * 9); if (v > 0.2) pn.dot(...B.p(a, 0), v > 0.75 ? P.fire[3] : P.fire[2]); }
      const x = F[0], y = F[1];
      pn.poly([[x - 4, y], [x - 3, y - 2], [x - 1.5, y - 3.4], [x + 1.5, y - 3.4], [x + 3, y - 2], [x + 4, y]]).paint(M.brass);
      pn.ln(x - 3, y - 0.5, x - 5, y + 0.2, M.brass[1]); pn.ln(x + 3, y - 0.5, x + 5, y + 0.2, M.brass[1]);
      const T = bone(hx, hy, K[0], K[1]);
      pn.cap(hx, hy, K[0], K[1], 0.9).paint(M.brass, { bevel: 'l' });
      for (let a = 3.5; a < T.len - 2; a += 3.4) pn.poly(T.pts([[a - 0.9, -2.6], [a + 0.9, -2.6], [a + 0.9, 2.6], [a - 0.9, 2.6]])).paint(c.far ? FAR.steam : NEAR.steam, { bevel: 'l' });
      pn.disc(K[0], K[1], 3.3).paint(M.brass);
      for (const d of [-1.6, 0, 1.6]) pn.ln(K[0] - 2.6, K[1] + d, K[0] + 2.6, K[1] + d, M.brass[0]);
      if (!c.far && Math.sin(t * 13 + c.ph * 3) > 0.85) pn.dot(K[0] + c.dir * 3, K[1] - 3, P.fire[3]);
      hub(c, 3);
    },

    // ---- 变体用腿 ----
    // T2 铁桥拱腿（1779 铁桥 · 科尔布鲁克代尔）：箱形大腿 + 一道铸铁拱肋做小腿，拱肋和直弦杆之间是一串圆环拱肩
    arch(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len, bow = -dir * 7, N = 10;
      const arc = (u) => B.p(n * u, bow * Math.sin(Math.PI * u));
      pn.cap(...B.p(0, 0), ...B.p(n, 0), 1.1).paint(M.iron, { bevel: 'l' });
      for (let i = 0; i < N; i++) { const a = arc(i / N), b = arc((i + 1) / N); pn.cap(a[0], a[1], b[0], b[1], 1.5); }
      pn.paint(M.iron, { bevel: 'l' });
      for (const u of [0.3, 0.52, 0.74]) {   // 圆环拱肩：圆环同时贴着拱肋和弦杆
        const s = Math.sin(Math.PI * u), r = Math.abs(bow) * s * 0.5 - 0.9, q = B.p(n * u, bow * s * 0.5);
        if (r < 1.2) continue;
        for (let k = 0; k < 12; k++) { const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU; pn.cap(q[0] + Math.cos(a0) * r, q[1] + Math.sin(a0) * r, q[0] + Math.cos(a1) * r, q[1] + Math.sin(a1) * r, 0.45); }
        pn.paint(M.iron, { outline: false, bevel: '' });
      }
      shoe(pn, M, F, 4.5, 3);
      seg(pn, [hx, hy], K, 2.3); pn.paint(M.iron, { bevel: 'l' });
      ball(pn, M.iron, K[0], K[1], 2.8); pn.dot(K[0], K[1], M.brass[2]);
      hub(c, 3.2);
    },

    // T3 剪式升降腿（懒人钳 / 剪叉升降台）：三节 X 形连杆，抬脚时整条腿缩短、同时变宽——连杆长度不变，按几何算
    scissor(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H);
      const top = [hx, hy + 2], B = bone(top[0], top[1], F[0], F[1] - 3), n = B.len, N = 2, Lk = 22, h = n / N;
      const w = Math.min(7.5, Math.sqrt(Math.max(9, Lk * Lk - h * h)) / 2);
      for (let i = 0; i < N; i++) { const a0 = i * h, a1 = (i + 1) * h; pn.cap(...B.p(a0, w), ...B.p(a1, -w), 1.05); }
      pn.paint(M.iron, { bevel: 'l' });
      for (let i = 0; i < N; i++) { const a0 = i * h, a1 = (i + 1) * h; pn.cap(...B.p(a0, -w), ...B.p(a1, w), 1.05); }
      pn.paint(M.steel, { bevel: 'l' });
      for (let i = 0; i < N; i++) ball(pn, M.brass, ...B.p(i * h + h / 2, 0), 1.3);
      for (const s of [-1, 1]) ball(pn, M.iron, ...B.p(h, s * w), 1.1);
      // 顶上的滑槽横梁（一头铰死、一头在槽里滑），底下是带两只滚轮的脚板
      pn.poly(B.pts([[-2.2, -w - 1.6], [-2.2, w + 1.6], [0.4, w + 1.6], [0.4, -w - 1.6]])).paint(M.iron);
      if (pn.hi) pn.ln(...B.p(-0.9, -w), ...B.p(-0.9, w), M.dark[0]);
      const x = F[0], y = F[1];
      pn.rect(x - w - 1.5, y - 3.2, w * 2 + 3, 2.2).paint(M.iron);
      ball(pn, M.dark, x - w, y - 1, 1.1); ball(pn, M.dark, x + w, y - 1, 1.1);
    },

    // T3 板簧拖车腿（一战炮兵牵引车）：大腿是一叠弓形板簧（中间 U 形卡箍），小腿是直撑杆 + 螺旋减震弹簧，脚是带抓地齿的履带板
    leaf(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len;
      pn.cap(...B.p(0, 0), ...B.p(n * 0.38, 0), 2).paint(M.iron, { bevel: 'l' });
      pn.cap(...B.p(n * 0.72, 0), ...B.p(n, 0), 1.3).paint(M.steel, { bevel: 'l' });
      pn.cap(...B.p(n * 0.36, 0), ...B.p(n * 0.74, 0), 0.7).paint(M.steel, { bevel: '' });
      const coils = 4;
      for (let k = 0; k < coils; k++) { const a = n * 0.42 + n * 0.26 * k / (coils - 1); pn.cap(...B.p(a - 0.9, -2.5), ...B.p(a + 0.9, 2.5), 0.6); }
      pn.paint(M.steel, { bevel: 'l' });
      for (const a of [n * 0.38, n * 0.72]) band(pn, B, a, 2.8, M.brass, 0.6);
      const x = F[0], y = F[1];
      pn.rect(x - 6, y - 3.4, 12, 2.4).paint(M.iron);
      for (const u of [-5, -1.3, 2.4]) pn.rect(x + u, y - 1.2, 2.6, 1.2).paint(M.leg, { outline: false });
      // 板簧：三片弓形叶片，最长的从胯到膝，短的叠在下面，中段一只卡箍
      const T = bone(hx, hy, K[0], K[1]), L = T.len;
      for (const [f0, f1, d] of [[0, 1, 0], [0.14, 0.86, 1.4], [0.3, 0.7, 2.8]]) {
        let q0 = null;
        for (let i = 0; i <= 6; i++) { const u = f0 + (f1 - f0) * i / 6, q = T.p(L * u, -(2.2 * Math.sin(Math.PI * u)) + d); if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.65); q0 = q; }
        pn.paint(M.steel, { bevel: 'l' });
      }
      pn.poly(T.pts([[L * 0.5 - 1, -3], [L * 0.5 + 1, -3], [L * 0.5 + 1, 4.2], [L * 0.5 - 1, 4.2]])).paint(M.dark);
      ball(pn, M.iron, K[0], K[1], 2.4);
      hub(c, 3);
    },

    // T4 铁艺卷草腿（维多利亚铸铁家具 / 缝纫机脚架）：大腿一根弧形铁条，小腿是 S 形主条 + 上下两个涡卷，脚是黄铜脚轮
    scroll(c, H) {
      const { pn, M, hx, hy, dir, t } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 5), n = B.len, N = 12, S = (u) => B.p(n * u, -dir * 2.6 * Math.sin(Math.PI * u) * (1 - 0.6 * u));
      for (let i = 0; i < N; i++) { const a = S(i / N), b = S((i + 1) / N); pn.cap(a[0], a[1], b[0], b[1], 2.1 - 0.8 * i / N); }
      pn.paint(M.iron, { bevel: 'l' });
      // 涡卷：从主条上长出来，往外卷一圈多收进去
      const volute = (u, side, r0) => {
        const b = S(u), cx = b[0] + side * (r0 + 0.4), cy = b[1] + 0.4, a0 = Math.atan2(b[1] - cy, b[0] - cx);
        let q0 = [b[0], b[1]];
        for (let i = 1; i <= 16; i++) { const v = i / 16, a = a0 - side * v * TAU * 1.15, r = r0 * (1 - v * 0.7), q = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; pn.cap(q0[0], q0[1], q[0], q[1], 0.8); q0 = q; }
        pn.paint(M.iron, { bevel: 'l' });
      };
      volute(0.34, dir, 3.4);
      // 黄铜脚轮：叉架 + 轮子（走起来转）
      const x = F[0], y = F[1];
      pn.poly([[x - 2.4, y - 5.6], [x + 2.4, y - 5.6], [x + 1.8, y - 3], [x - 1.8, y - 3]]).paint(M.brass);
      pn.disc(x, y - 2.4, 2.4).paint(M.brass);
      const r = (c.o.mv ? -(c.g.x) * 0.5 : t); pn.ln(x, y - 2.4, x + Math.cos(r) * 1.6, y - 2.4 + Math.sin(r) * 1.6, M.brass[0]);
      // 大腿：往上拱的一根铁条，膝上一颗黄铜球饰
      const T = bone(hx, hy, K[0], K[1]);
      let q0 = null; for (let i = 0; i <= 6; i++) { const u = i / 6, q = T.p(T.len * u, 1.6 * Math.sin(Math.PI * u)); if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 1.4); q0 = q; }
      pn.paint(M.iron, { bevel: 'l' });
      ball(pn, M.brass, K[0], K[1], 2.3);
      hub(c, 2.9);
    },

    // T4 伸缩镜筒腿（维多利亚黄铜望远镜）：三节套管，外管固定在膝下、细管固定在脚上，抬脚时中管往外管里缩；每节管口一道滚花箍，脚是尖头铁箍 + 小圆盘
    scope(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len;
      const o1 = Math.min(n - 6, 15), i0 = Math.max(o1 - 2, n - 13);
      pn.cap(...B.p(i0, 0), ...B.p(n, 0), 1.0).paint(M.steel, { bevel: 'l' });
      pn.cap(...B.p(o1 - 3, 0), ...B.p(i0 + 3, 0), 1.6).paint(M.brass, { bevel: 'l' });
      pn.cap(...B.p(0, 0), ...B.p(o1, 0), 2.3).paint(M.brass);
      for (const [a, w] of [[o1, 2.7], [i0 + 3, 2]]) pn.poly(B.pts([[a - 1, -w], [a + 0.4, -w], [a + 0.4, w], [a - 1, w]])).paint(M.iron, { bevel: 'l' });
      if (pn.hi) for (let a = 2; a < o1 - 1; a += 3) pn.ln(...B.p(a, -1.6), ...B.p(a, 1.6), M.brass[1]);
      const x = F[0], y = F[1];
      pn.poly([[x - 3.5, y - 2], [x + 3.5, y - 2], [x + 2.5, y - 3.4], [x - 2.5, y - 3.4]]).paint(M.iron);
      pn.poly([[x - 1, y - 2], [x + 1, y - 2], [x, y]]).paint(M.steel, { bevel: '' });
      const T = bone(hx, hy, K[0], K[1]);
      pn.poly(T.pts([[-1, -1.8], [-1, 1.8], [T.len, 1.8], [T.len, -1.8]])).paint(M.steel);
      pn.rect(K[0] - 2.4, K[1] - 2.4, 4.8, 4.8).paint(M.iron); pn.dot(K[0], K[1], M.brass[3]);   // 夹紧块
      hub(c, 2.8);
    },

    // T5 机车连杆腿：胯上一只带配重块的辐条动轮，曲柄销上套着大腿（大腿就是一根连杆），膝盖再由一根导杆（带滑槽）拉住车体
    loco(c, H) {
      const { pn, M, hx, hy, dir, o } = c, F = footOf(c, H), R = 6.2;
      const A = (o.mv ? -(o.a || 0) - c.ph : -(c.t || 0) * 1.2), C = [hx, hy + 1], Pn = [C[0] + Math.cos(A) * 3.6, C[1] + Math.sin(A) * 3.6];
      const [kx, ky, ex, ey] = ik(Pn[0], Pn[1], F[0], F[1] - 3, H.l1 || 13, H.l2 || 32, dir);
      pn.cap(kx, ky, ex, ey, 1.6).paint(M.iron, { bevel: 'l' });
      shoe(pn, M, [ex, ey + 3], 4.5, 3);
      // 动轮
      pn.disc(C[0], C[1], R).paint(M.steel);
      pn.disc(C[0], C[1], R - 1.4).paint(M.dark, { outline: false, bevel: '' });
      for (let k = 0; k < 8; k++) { const a = A + k / 8 * TAU; pn.ln(C[0], C[1], C[0] + Math.cos(a) * (R - 1.2), C[1] + Math.sin(a) * (R - 1.2), M.steel[3]); }
      const cw = A + Math.PI; pn.poly([0, 1, 2, 3, 4].map(i => { const a = cw - 0.9 + i * 0.45; return [C[0] + Math.cos(a) * (R - 1.4), C[1] + Math.sin(a) * (R - 1.4)]; }).concat([[C[0] + Math.cos(cw) * 2.2, C[1] + Math.sin(cw) * 2.2]])).paint(M.steel, { bevel: 'l' });
      ball(pn, M.brass, C[0], C[1], 1.3);
      // 导杆（车体下沿 → 膝盖，带滑槽）
      const Q = [hx + dir * 9, hy + 4];
      pn.cap(Q[0], Q[1], kx, ky, 0.8).paint(M.steel, { bevel: 'l' });
      if (pn.hi) { const G = bone(Q[0], Q[1], kx, ky); pn.ln(...G.p(G.len * 0.3, 0), ...G.p(G.len * 0.8, 0), M.dark[0]); }
      ball(pn, M.brass, Q[0], Q[1], 1.1);
      // 大腿 = 连杆：两头是轴瓦大头
      const T = bone(Pn[0], Pn[1], kx, ky);
      pn.poly(T.pts([[0, -1.3], [0, 1.3], [T.len, 1.3], [T.len, -1.3]])).paint(M.steel);
      ball(pn, M.steel, kx, ky, 2.3); ball(pn, M.brass, Pn[0], Pn[1], 1.4);
    },

    // T5 横梁机腿（瓦特横梁蒸汽机的「行走梁」）：一根鱼腹形铸铁横梁以胯为支点往外伸出、上下摇摆，梁头吊一根竖直连杆到铁脚——连杆长度不变，梁的摆角按几何算
    beam(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H), Lb = H.lb || 16, Lr = H.lr || 33;
      const x = F[0], y = F[1] - 3;
      const tipY = y - Lr, s = Math.max(-0.95, Math.min(0.95, (hy - tipY) / Lb)), tip = [hx + dir * Lb * Math.cos(Math.asin(s)), tipY];
      pn.cap(tip[0], tip[1], x, y, 1.2).paint(M.steel, { bevel: 'l' });
      const Rb = bone(tip[0], tip[1], x, y); band(pn, Rb, Rb.len * 0.55, 2, M.brass, 0.8);
      shoe(pn, M, F, 5, 3);
      // 鱼腹梁：以胯为支点，两头细、中间粗，尾端短短一截配重；腹上两个减重孔
      const back = [hx - dir * 5, hy + (hy - tip[1]) * 5 / Lb], T = bone(back[0], back[1], tip[0], tip[1]), L = T.len, u0 = 5 / L;
      const belly = (u) => (u < u0 ? 3.2 : 1.2 + 2.6 * Math.sin(Math.PI * Math.min(1, (u - u0) / (1 - u0) * 0.5 + 0.5)));
      const us = [0, 0.1, u0, 0.35, 0.55, 0.75, 1], sg = dir > 0 ? 1 : -1;
      pn.poly(us.map(u => T.p(L * u, -1.6 * sg)).concat(us.slice().reverse().map(u => T.p(L * u, belly(u) * sg)))).paint(M.steel);
      for (const u of [0.45, 0.72]) pn.disc(...T.p(L * u, sg), 0.9).paint(flatDark, { outline: false, bevel: '' });
      ball(pn, M.brass, tip[0], tip[1], 1.3);
      ball(pn, M.iron, hx, hy, 2.8); pn.dot(hx, hy, M.brass[3]);
    },

    // T6 差分机腿（巴贝奇差分机，1822）：小腿是两根立柱夹着一摞带刻度的黄铜数字轮，走路时各轮一个接一个转（刻度点横着移动）
    babbage(c, H) {
      const { pn, M, hx, hy, o } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len, w = 3.4;
      for (const s of [-1, 1]) pn.cap(...B.p(0, s * w), ...B.p(n, s * w * 0.7), 0.6).paint(M.steel, { bevel: '' });
      const turn = (o.mv ? (o.a || 0) + c.ph : (c.t || 0)) * 2;
      let i = 0;
      for (let a = 3; a < n - 2; a += 4.2, i++) {
        const ww = w * (1 - 0.3 * a / n) + 0.4;
        pn.poly(B.pts([[a - 1.4, -ww], [a + 1.4, -ww], [a + 1.4, ww], [a - 1.4, ww]])).paint(M.brass);
        const ph = ((turn * (1 + i * 0.35)) % 1 + 1) % 1;
        for (let k = 0; k < 2; k++) { const f = -ww + 0.8 + ((ph + k * 0.5) % 1) * (ww * 2 - 1.6); pn.dot(...B.p(a, f), M.brass[0]); }
      }
      shoe(pn, M, F, 4.5, 3, M.iron);
      seg(pn, [hx, hy], K, 1.8); pn.paint(M.steel, { bevel: 'l' });
      ball(pn, M.iron, K[0], K[1], 2.4); pn.dot(K[0], K[1], M.brass[3]);
      hub(c, 3);
    },

    // T6 电子管腿：小腿是一只大玻璃真空管（黄铜管座在上、瓷底座在下），里面的灯丝发光、栅极是几道细线；大腿是一根铜母线
    valve(c, H) {
      const { pn, M, hx, hy } = c, F = footOf(c, H), K = kneeOf(c, H), t = c.t || 0;
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len, g0 = n * 0.2, g1 = n * 0.8;
      const Gl = c.far ? GLASS.far : GLASS.near;
      pn.poly(B.pts([[g0, -3.4], [g0, 3.4], [g1 - 3, 3.4], [g1, 1.6], [g1, -1.6], [g1 - 3, -3.4]])).paint(Gl, { bevel: 'l' });
      if (!c.far) {
        const fl = 0.6 + 0.4 * Math.sin(t * 17);
        for (let a = g0 + 2; a < g1 - 2; a += 1) pn.dot(...B.p(a, Math.sin(a * 1.6) * 1.2), fl > 0.7 ? P.fire[3] : P.fire[2]);
        for (const a of [g0 + 3, (g0 + g1) / 2, g1 - 4]) pn.ln(...B.p(a, -2.2), ...B.p(a, 2.2), P.glass[1]);
      }
      pn.cap(...B.p(0, 0), ...B.p(g0, 0), 2.6).paint(M.brass);
      band(pn, B, g0 - 1.5, 3, M.brass, 0.5);
      pn.cap(...B.p(g1, 0), ...B.p(n, 0), 1.6).paint(c.far ? FAR.steam : NEAR.steam, { bevel: 'l' });
      shoe(pn, M, F, 4, 3, M.iron);
      pn.poly(bone(hx, hy, K[0], K[1]).pts([[-1, -1.5], [-1, 1.5], [bone(hx, hy, K[0], K[1]).len + 1, 1.5], [bone(hx, hy, K[0], K[1]).len + 1, -1.5]])).paint(M.brass);
      ball(pn, M.iron, K[0], K[1], 2.4);
      hub(c, 3);
    },
  };
  const flatDark = [P.dark[0], P.dark[0], P.dark[0], P.dark[0]];

  // ---------- 车体（顶板 y..y+3 和上面的模块相接，只画在 y+3 以下） ----------
  const deck = (pn, x, y, o) => {
    pn.fill(x, y, 96, 3, P.iron[1]); pn.fill(x, y + 2, 96, 1, P.iron[0]);
    if (!o.top) { pn.fill(x, y, 96, 1, P.iron[0]); pn.fill(x, y + 1, 96, 1, P.iron[3]); }
  };
  const rivRow = (pn, x, y, x0, x1, step) => { for (let u = x0; u <= x1; u += step) rivet(pn, x + u, y); };
  const HULL = {
    // T1 现役：伏地蛛甲壳 + 正中黄铜舱盖（游戏代码原样）
    base(pn, x, y, o) {
      LL.carapace(pn, x, y, false, false, o.top, 96);
      pn.fill(x + 44, y + 5, 8, 6, P.dark[0]); pn.fill(x + 45, y + 6, 6, 4, P.brass[1]); pn.fill(x + 45, y + 6, 6, 1, P.brass[3]);
    },
    // T2 熟铁板梁：上下翼缘 + 腹板，竖向加劲角铁每 12px 一道，翼缘上一排铆钉；正中一块椭圆铸铁铭牌
    girder(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 2, y + 3], [x + 94, y + 3], [x + 92, y + 16], [x + 4, y + 16]]).paint(NEAR.iron);
      pn.fill(x + 3, y + 3, 90, 2, P.iron[1]); pn.fill(x + 4, y + 13, 88, 2, P.iron[1]); pn.fill(x + 4, y + 13, 88, 1, P.iron[0]);
      for (let u = 8; u < 92; u += 12) { if (Math.abs(u - 48) < 8) continue; pn.fill(x + u, y + 5, 1, 8, P.iron[3]); pn.fill(x + u + 1, y + 5, 1, 8, P.iron[0]); }
      if (pn.hi) { rivRow(pn, x, y + 3, 5, 90, 3); rivRow(pn, x, y + 13, 6, 89, 3); } else { for (let u = 6; u < 92; u += 4) { pn.dot(x + u, y + 4, P.iron[4]); pn.dot(x + u, y + 14, P.iron[3]); } }
      pn.disc(x + 48, y + 9, 4.2).paint(NEAR.iron); pn.fill(x + 45, y + 8, 6, 1, P.brass[2]); pn.fill(x + 45, y + 10, 6, 1, P.brass[1]);
    },
    // T3 一战陆地巡洋舰：下沿楔形的装甲壳（前后斜切），横向板缝、两排铆钉、车头三道观察缝，侧面一扇圆形检修门
    landship(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 95, y + 8], [x + 87, y + 19], [x + 9, y + 19], [x + 1, y + 8]]).paint(NEAR.iron);
      pn.fill(x + 2, y + 11, 92, 1, P.iron[0]); pn.fill(x + 2, y + 12, 92, 1, P.iron[3]);
      for (const u of [24, 48, 72]) pn.fill(x + u, y + 4, 1, 7, P.iron[0]);
      if (pn.hi) { rivRow(pn, x, y + 5, 4, 91, 3.5); rivRow(pn, x, y + 14, 12, 84, 3.5); } else { for (let u = 4; u < 93; u += 4) pn.dot(x + u, y + 5, P.iron[4]); for (let u = 12; u < 85; u += 4) pn.dot(x + u, y + 14, P.iron[4]); }
      for (const u of [80, 84, 88]) pn.fill(x + u, y + 7, 2, 1, P.black);
      pn.disc(x + 48, y + 14, 3.4).paint(NEAR.iron); pn.disc(x + 48, y + 14, 1.4).paint(NEAR.dark, { outline: false }); pn.dot(x + 47, y + 13, P.iron[4]);
    },
    // T4 维多利亚马车厢：两头圆角的车厢板，两块内凹的饰线面板（黄铜描线），正中椭圆徽牌，车头一盏马车灯
    coach(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 3, y + 3], [x + 93, y + 3], [x + 93, y + 10], [x + 89, y + 15], [x + 84, y + 17], [x + 12, y + 17], [x + 7, y + 15], [x + 3, y + 10]]).paint(NEAR.steel);
      for (const [a, b] of [[10, 42], [54, 86]]) {
        pn.fill(x + a, y + 6, b - a, 1, P.brass[2]); pn.fill(x + a, y + 13, b - a, 1, P.brass[1]);
        pn.fill(x + a, y + 6, 1, 8, P.brass[2]); pn.fill(x + b - 1, y + 6, 1, 8, P.brass[1]);
        pn.fill(x + a + 1, y + 7, b - a - 2, 1, P.iron[2]);
      }
      pn.disc(x + 48, y + 10, 3.6).paint(NEAR.brass); pn.disc(x + 48, y + 10, 1.8).paint(NEAR.steel, { outline: false, bevel: '' });
      // 马车灯：黄铜灯罩 + 玻璃（灯芯是炉火色）
      pn.rect(x + 88, y + 5, 5, 6).paint(NEAR.brass); pn.fill(x + 89, y + 6, 3, 3, P.glass[2]); pn.dot(x + 90, y + 7, P.fire[3]); pn.fill(x + 89, y + 11, 3, 1, P.brass[1]);
    },
    // T5 锻铁重甲：厚车体、下沿一排大螺栓、一根带法兰的蒸汽管顺着车身走，正中安全阀 + 压力表，车尾排汽弯管朝下
    forge(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 95, y + 17], [x + 92, y + 20], [x + 4, y + 20], [x + 1, y + 17]]).paint(NEAR.iron);
      pn.fill(x + 2, y + 8, 92, 1, P.iron[0]); pn.fill(x + 2, y + 9, 92, 1, P.iron[3]);
      for (const u of [8, 30, 66, 88]) { pn.rect(x + u - 1.5, y + 14.5, 3, 3).paint(NEAR.steel, { bevel: 'l' }); pn.dot(x + u, y + 15.5, P.iron[0]); }   // 大六角螺栓
      pn.rect(x + 4, y + 11, 88, 2.4).paint(NEAR.steel, { bevel: 'l' });   // 蒸汽管
      for (const u of [18, 38, 58, 78]) pn.rect(x + u, y + 10, 2, 4.4).paint(NEAR.brass, { outline: false, bevel: 'l' });
      pn.rect(x + 42, y + 3.5, 12, 12).paint(NEAR.iron);
      pn.disc(x + 48, y + 9, 3.8).paint(NEAR.brass); pn.disc(x + 48, y + 9, 2.6).paint(NEAR.gauge, { outline: false, bevel: 's' });
      const na = -2.2 + Math.sin((o.t || 0) * 2) * 0.5; pn.ln(x + 48, y + 9, x + 48 + Math.cos(na) * 2, y + 9 + Math.sin(na) * 2, P.black);
      pn.cap(x + 3, y + 12, x - 1, y + 16, 1.3).paint(NEAR.steel, { bevel: 'l' });
      if (((o.t || 0) * 0.8) % 1 < 0.5) pn.disc(x - 1.5, y + 18.5, 1.4).paint(NEAR.steam, { outline: false, bevel: '' });
    },
    // T6 维多利亚电气：车体侧面一排瓷绝缘子，铜母线串起来，正中一道观察窗里是以太的光（慢慢呼吸）
    arc(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 2, y + 3], [x + 94, y + 3], [x + 92, y + 15], [x + 86, y + 17], [x + 10, y + 17], [x + 4, y + 15]]).paint(NEAR.iron);
      pn.fill(x + 4, y + 13, 88, 1, P.brass[2]);
      for (const u of [12, 26, 70, 84]) { pn.rect(x + u - 1.5, y + 5, 3, 5).paint(NEAR.steam, { bevel: 'l' }); pn.fill(x + u - 1, y + 7, 2, 1, P.steam[0]); pn.fill(x + u - 0.5, y + 10, 1, 3, P.brass[2]); }
      pn.rect(x + 36, y + 6, 24, 5).paint(NEAR.dark);
      const b = 0.5 + 0.5 * Math.sin((o.t || 0) * 2.4);
      pn.fill(x + 37, y + 7, 22, 3, P.fire[b > 0.5 ? 2 : 1]); pn.fill(x + 38, y + 8, 20, 1, P.fire[b > 0.5 ? 3 : 2]);
      for (const u of [42, 48, 54]) pn.fill(x + u, y + 7, 1, 3, P.dark[0]);
    },
  };

  // ---------- 编制（15 种 = 主线 6 + 变体 9） ----------
  // mt 材质档；hull 车体；leg 腿型；H 腿型参数；main 主线
  const SET = [
    { mt: 1, main: true, name: '工装爬机', hull: 'base', leg: 'spider', ref: '现役伏地蛛（游戏代码原样）',
      idea: '基础版本：一块压低的铆接甲壳 + 四条蜘蛛腿（膝盖只比胯高一点、脚收在车体范围里）。后面五档都保持这个拓扑，只换腿的构造和车体的工艺。' },
    { mt: 2, main: true, name: '桁架爬机', hull: 'girder', leg: 'truss', ref: '维多利亚铁桥 / 格构铁塔（福斯桥、埃菲尔铁塔的腿）',
      idea: '小腿是往下收窄的铆接格构梁：两根弦杆 + 之字形腹杆，透空；大腿是实心箱梁，脚是铸铁平底靴。车体是一段熟铁板梁：上下翼缘、竖向加劲角铁、成排铆钉、正中椭圆铭牌。' },
    { mt: 2, name: '铁桥拱腿', hull: 'girder', leg: 'arch', ref: '1779 年科尔布鲁克代尔铁桥（圆环拱肩）',
      idea: '小腿是一道往后弓的铸铁拱肋，拱肋和直弦杆之间是一串圆环拱肩——铁桥最有名的那一排圆圈。比桁架腿更「铸造」、更有弧线。' },
    { mt: 3, main: true, name: '液压陆舰', hull: 'landship', leg: 'hydra', ref: '一战英国马克 I 型坦克（陆地巡洋舰）、液压起重机',
      idea: '车体是下沿楔形的装甲壳：板缝、两排铆钉、车头三道观察缝、侧面圆形检修门。腿是铆接箱形大腿 + 缸筒套活塞杆的小腿，车体下沿再伸一根液压缸顶住小腿；冲压钢脚板带防滑齿。' },
    { mt: 3, name: '剪式升降腿', hull: 'landship', leg: 'scissor', ref: '懒人钳 / 剪叉式升降台',
      idea: '每条腿是三节 X 形连杆：抬脚时整条腿缩短、同时往两边撑宽（连杆长度不变，按几何算），顶上一根滑槽横梁，脚板下两只滚轮。剪影是四串菱格。' },
    { mt: 3, name: '板簧拖车腿', hull: 'landship', leg: 'leaf', ref: '一战炮兵牵引车 / 马车的弓形板簧、螺旋减震',
      idea: '大腿是一叠三片弓形板簧（中段 U 形卡箍），小腿是直撑杆中间夹一只螺旋减震弹簧，脚是带抓地齿的履带板。最「军用车辆」的一种。' },
    { mt: 4, main: true, name: '镜筒步行机', hull: 'coach', leg: 'scope', ref: '维多利亚黄铜望远镜',
      idea: '车体是维多利亚马车厢：两头圆角、两块黄铜饰线面板、椭圆徽牌、车头一盏马车灯。小腿是三节黄铜套管，每节管口一道滚花箍；抬脚时中管往外管里缩。脚是尖头铁箍 + 小圆盘，膝上一块夹紧块。最细最亮的一种。' },
    { mt: 4, name: '曲柄步行机', hull: 'coach', leg: 'crank', ref: '切比雪夫步行机（1878 巴黎博览会）、维多利亚机械玩具',
      idea: '每条腿旁边一只转动的黄铜曲柄盘，曲柄销推一根滑槽连杆带动大腿；抛光圆杆小腿、平掌始终贴地。' },
    { mt: 4, name: '铁艺卷草腿', hull: 'coach', leg: 'scroll', ref: '维多利亚铸铁家具、缝纫机脚架',
      idea: '小腿是一根 S 形铁条加上下两个涡卷，大腿一根拱起的铁条、膝上一颗黄铜球饰，脚是会转的黄铜脚轮。最「客厅家具」的一种。' },
    { mt: 5, main: true, name: '汽锤步行机', hull: 'forge', leg: 'hammer', ref: '内史密斯蒸汽锤（1839）',
      idea: '车体是厚锻铁：下沿一排大螺栓、一根带法兰的蒸汽管、正中安全阀 + 压力表、车尾排汽弯管。每条腿是一台吊在耳轴上的竖直汽缸，活塞杆往下伸到砧形铁脚——抬脚 = 活塞缩回；落脚时缸底喷一口汽。' },
    { mt: 5, name: '机车连杆腿', hull: 'forge', leg: 'loco', ref: '蒸汽机车的动轮、主连杆、配重块',
      idea: '胯上一只带配重块的八辐动轮，大腿就是套在曲柄销上的主连杆，膝盖由一根带滑槽的导杆拉住车体。走起来四只动轮一起转。' },
    { mt: 5, name: '横梁机腿', hull: 'forge', leg: 'beam', ref: '瓦特横梁蒸汽机的行走梁（walking beam）',
      idea: '每条腿是一根鱼腹形铸铁横梁：以胯为支点往外伸出、上下摇摆，梁头吊一根竖直连杆到铁脚（连杆长度不变，摆角按几何算）。剪影是前后四根往外伸的梁。' },
    { mt: 6, main: true, name: '电弧步行机', hull: 'arc', leg: 'coil', ref: '维多利亚电气：瓷绝缘子、感应线圈、电弧灯',
      idea: '车体侧面一排瓷绝缘子，铜母线串起来，正中一道观察窗里是以太的光（慢慢呼吸）。大腿是一串瓷绝缘子套在黄铜芯上，膝盖是一只铜线圈（偶尔打火花），小腿中心一条流动的光，脚是黄铜圆顶 + 两根放电尖。' },
    { mt: 6, name: '差分机腿', hull: 'arc', leg: 'babbage', ref: '巴贝奇差分机（1822）',
      idea: '小腿是两根立柱夹着一摞带刻度的黄铜数字轮，走路时各轮一个接一个转（刻度横着移动）——维多利亚的「计算机器」。' },
    { mt: 6, name: '电子管腿', hull: 'arc', leg: 'valve', ref: '弗莱明真空二极管（1904）/ 克鲁克斯管',
      idea: '小腿是一只大玻璃真空管：黄铜管座在上、瓷底座在下，里面灯丝发光、栅极几道细线。大腿是一根铜母线。最亮的一种。' },
  ];
  const LEG_H = { crank: { reach: 4 }, loco: { reach: 5 }, beam: { reach: 10 }, scissor: { reach: 3 } };

  // 画一只整件四足到透明画布，坐标 (ox, oy) = 模块左上角。o = { mv, a 步态角, t 秒, stride, top }
  function figure(g, ox, oy, e, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const S = o.stride || 13, lo = { mv: !!o.mv, a: o.a || 0, plant: true, plantS: S, plantH: 5 + 0.3 * S };
    const bd = LL.quadBob({ mv: !!o.mv, a: o.a || 0, stride: S }), y = oy + bd, H = LEG_H[e.leg] || {};
    const leg = (M, far, [hx, hy], gy, dir, ph) => {
      const c = { pn, M, far, hx: ox + hx, hy: y + hy, gy, dir, ph, o: lo, t: o.t || 0 };
      c.g = gait(lo, ph, 5, 4);
      LEGS[e.leg](c, H);
    };
    leg(FAR, true, HIPS.fr, oy + 45, -1, Math.PI); leg(FAR, true, HIPS.ff, oy + 45, 1, 0);
    HULL[e.hull](pn, ox, y, { t: o.t || 0, top: !!o.top });
    leg(NEAR, false, HIPS.nr, oy + 48, -1, 0); leg(NEAR, false, HIPS.nf, oy + 48, 1, Math.PI);
    pn.flush(g);
  }
  return { SET, figure, LEGS, HULL };
})();
