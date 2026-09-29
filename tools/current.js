// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：四足整件底盘（4×2 = 96×48）六档 + 变体 · 重做 v2（2026-09-29）。
// 用户对 v1：剪影区分度不够，没有双足龙骑 / 圣骑 / 掷弹兵那种出彩的感觉。采用 T2 桁架爬机、T3 板簧拖车、T4 曲柄步行机、T5 汽锤步行机（都作主线），
// 其余重画，加入龙、裙甲、仪表、齿轮等元素（参考双足，不局限于此），重新审视剪影。
// v2 做法：拓扑、胯、地面、步态仍和游戏的四足整件一致，顶板以上不画；剪影靠四样东西拉开——
//   ① 膝盖的位置和朝向：高膝蜘蛛（T1/T2/T4 仪表/T5 钟表/T6 晶枝）、人形正膝在半高处（掷弹兵/圣骑/锚链/圣堂）、膝朝里（步行履带）、三段龙腿（龙骑）；
//   ② 脚的形状：带肋平脚、铁靴、长尖靴、履带段、船锚、三爪、岩板；
//   ③ 车体下沿的附加层：裙甲（整块罩住）、草摺、罩袍、半露的大齿轮、垂下的锚链、晶簇、锯齿尖刺；
//   ④ 膝部的大件：压力表盘、大齿轮、扇形侧翼、羽翼、岩石宝石。
// 风格语言不变：工业、蒸汽朋克、维多利亚、少量一战；不做动物头。
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

    // ---- v2 新画（参考双足：工装 Mk.II、裙甲堡、掷弹兵、蒸汽圣骑、钟表巨像、熔心龙骑、圣堂骑士、晶枝腿） ----
    // T1 工装 Mk.II：箱形梁大腿 + 跨膝液压撑杆 + 双支杆小腿 + 带肋平脚（脚尖朝外）
    mk2(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H), K = kneeOf(c, H), inn = -dir;
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len;
      for (const s of [-1.8, 1.8]) pn.cap(...B.p(1, s), ...B.p(n, s * 0.45), 0.8);
      pn.paint(M.leg, { bevel: 'l' });
      for (const a of [n * 0.36, n * 0.72]) band(pn, B, a, 2.5, M.iron, 0.7);
      const x = F[0], y = F[1];
      pn.poly([[x - dir * 4.5, y], [x - dir * 4, y - 3], [x + dir * 3.5, y - 3], [x + dir * 6.5, y - 0.8], [x + dir * 6.5, y]]).paint(M.iron);
      for (const u of [-2, 1, 4]) pn.fill(x + dir * u, y - 2.4, 1, 2, M.iron[1]);
      ball(pn, M.iron, B.p(n, 0)[0], B.p(n, 0)[1], 1.3);
      const T = bone(hx, hy, K[0], K[1]);
      pn.poly(T.pts([[-1.5, -2.9], [-1.5, 2.9], [T.len + 1, 2.3], [T.len + 1, -2.3]])).paint(M.iron);
      pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[1]);
      const P1 = T.p(T.len * 0.35, inn * 3.2), P2 = B.p(n * 0.38, inn * 2.4), D = bone(P1[0], P1[1], P2[0], P2[1]);
      pn.cap(...D.p(D.len * 0.45, 0), ...P2, 0.65).paint(M.steel, { bevel: 'l' });
      pn.cap(...P1, ...D.p(D.len * 0.5, 0), 1.3).paint(M.brass, { bevel: 'l' });
      ball(pn, M.iron, P1[0], P1[1], 1); ball(pn, M.iron, P2[0], P2[1], 1);
      ball(pn, M.iron, K[0], K[1], 2.8); pn.dot(K[0], K[1], M.brass[2]);
      hub(c, 3.2);
    },

    // T2 裙甲堡的腿：大腿和膝盖藏在裙甲里，只露出往下张开的护胫和脚尖朝外的铁靴（碎步）
    skirt(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H);
      const T0 = [hx + c.g.x * 0.35, hy + 12], B = bone(T0[0], T0[1], F[0], F[1] - 4), n = B.len;
      pn.poly(B.pts([[0, -2.4], [0, 2.4], [n, 3.4], [n, -3.4]])).paint(M.iron);
      pn.ln(...B.p(2, 0), ...B.p(n - 1, 0), M.iron[3]);
      band(pn, B, n * 0.55, 3.2, M.brass, 0.6);
      const x = F[0], y = F[1];
      pn.poly([[x - dir * 4, y], [x - dir * 4, y - 4.2], [x + dir * 2, y - 4.2], [x + dir * 5.5, y - 1.6], [x + dir * 6, y]]).paint(M.leg);
      pn.fill(x - 3.5, y - 4.6, 7, 1, M.iron[3]);
    },

    // T3 掷弹兵：人形正膝（膝盖朝外、在半高处）。铆接圆筒大腿 + 两道黄铜箍，膝盖是一只压力表，喇叭口护胫，平头重靴；膝后一根蒸汽活塞
    gren(c, H) {
      const { pn, M, hx, hy, dir, far } = c, F = footOf(c, H), inn = -dir;
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 4, H.l1 || 17, H.l2 || 19, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky);
      const P1 = T.p(T.len * 0.55, inn * 3), P2 = B.p(n * 0.45, inn * 2.6);
      pn.cap(...P1, ...P2, 0.7).paint(M.steel, { bevel: 'l' });
      pn.poly(B.pts([[0, -2.4], [0, 2.4], [n * 0.7, 2.5], [n + 0.5, 3.9], [n + 0.5, -3.9], [n * 0.7, -2.5]])).paint(M.iron);
      pn.ln(...B.p(3, 0), ...B.p(n - 1, 0), M.iron[3]);
      const x = F[0], y = F[1];
      pn.poly([[x - dir * 4.5, y], [x - dir * 4.5, y - 4.4], [x + dir * 3, y - 4.4], [x + dir * 6, y - 2], [x + dir * 6, y]]).paint(M.leg);
      pn.fill(x + (dir > 0 ? 2 : -5), y - 4, 3, 1, M.brass[2]);
      pn.cap(hx, hy, kx, ky, 3.3).paint(M.iron);
      for (const a of [T.len * 0.3, T.len * 0.72]) band(pn, T, a, 3.4, M.brass, 0.7);
      if (pn.hi) for (let a = 2; a < T.len - 1; a += 2.6) pn.dot(...T.p(a, dir * 1.8), M.iron[4]);
      // 膝上压力表
      pn.disc(kx, ky, 3.6).paint(M.brass);
      pn.disc(kx, ky, 2.4).paint(far ? FAR.steam : NEAR.steam, { outline: false, bevel: '' });
      const na = -2.4 + (c.o.mv ? Math.sin((c.o.a || 0) + c.ph) * 1.2 + 1.2 : Math.sin((c.t || 0) * 2) * 0.3);
      pn.ln(kx, ky, kx + Math.cos(na) * 2, ky + Math.sin(na) * 2, far ? P.dark[0] : P.fire[1]);
      hub(c, 3.4);
    },

    // T3 步行履带脚（迪普洛克「步行履带」Pedrail，1900s；一战坦克的前身）：膝盖朝里的两段支腿，脚是一小段履带（两只负重轮，履带板随步子走）
    pedrail(c, H) {
      const { pn, M, hx, hy, dir, far } = c, F = footOf(c, H);
      const A = [F[0], F[1] - 4.6];
      const [kx, ky] = ik(hx, hy, A[0], A[1], H.l1 || 16, H.l2 || 21, -dir);
      pn.cap(kx, ky, ...A, 1.6).paint(M.steel, { bevel: 'l' });
      const x = F[0], y = F[1], half = 6.2;
      pn.cap(x - half, y - 2.4, x + half, y - 2.4, 2.4).paint(M.leg);
      const sh = ((c.o.mv ? -(c.g.x) : (c.t || 0) * 3) % 2.4 + 2.4) % 2.4;
      for (let u = -half - 1 + sh; u < half + 1; u += 2.4) { pn.dot(x + u, y - 4.6, M.iron[3]); pn.dot(x + u, y - 0.2, M.iron[2]); }
      for (const u of [-3.6, 0, 3.6]) ball(pn, M.iron, x + u, y - 2.4, 1.2);
      pn.poly([[A[0] - 2.4, A[1] - 1], [A[0] + 2.4, A[1] - 1], [A[0] + 1.6, A[1] + 2.3], [A[0] - 1.6, A[1] + 2.3]]).paint(M.iron);   // 履带架
      ball(pn, M.brass, A[0], A[1], 1.1);
      const T = bone(hx, hy, kx, ky);
      pn.poly(T.pts([[-1.5, -2.6], [-1.5, 2.6], [T.len + 1, 2], [T.len + 1, -2]])).paint(M.iron);
      if (pn.hi) for (let a = 2; a < T.len - 1; a += 3) pn.dot(...T.p(a, 0), M.iron[4]); else pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[1]);
      ball(pn, M.steel, kx, ky, 2.4);
      hub(c, 3);
    },

    // T4 蒸汽圣骑 / T6 圣堂骑士（H.templar）：人形正膝的哥特板甲腿——棱线大腿甲、护膝 + 黄铜扇形侧翼（圣堂：三片后掠羽翼 + 能量脉）、护胫、分节尖头铁靴 + 马刺
    knight(c, H) {
      const { pn, M, hx, hy, dir, far, t } = c, F = footOf(c, H), tp = !!H.templar;
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 3.6, H.l1 || 16, H.l2 || 19, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky);
      pn.poly(B.pts([[0, -2.5], [0, 2.5], [n * 0.6, 2.8], [n, 2], [n, -2], [n * 0.6, -2.8]])).paint(M.steel);
      pn.ln(...B.p(2, dir * 0.6), ...B.p(n - 1, dir * 0.4), M.steel[3]);
      if (tp) { pn.poly(B.pts([[n * 0.2, -dir * 2.6], [n * 0.75, -dir * 2.6], [n * 0.55, -dir * 5]])).paint(M.brass); }   // 护胫后缘的刀锋尾鳍
      const x = F[0], y = F[1], L = tp ? 9.5 : 7.5;
      pn.poly([[x - dir * 3, y], [x - dir * 3, y - 3.8], [x + dir * 1, y - 3.8], [x + dir * L, y - 0.6], [x + dir * (L + 0.5), y]]).paint(M.steel);
      for (const u of [1.5, 3.5, 5.5]) pn.ln(x + dir * u, y - 3.4 + u * 0.35, x + dir * u, y - 0.4, M.steel[1]);
      pn.ln(x - dir * 3, y - 2, x - dir * (tp ? 6.5 : 5.5), y - (tp ? 1.4 : 2.6), M.brass[2]); pn.dot(x - dir * (tp ? 6.5 : 5.5), y - (tp ? 1.4 : 2.6), M.brass[3]);
      pn.poly(T.pts([[-1, -3.4], [-1, 3.4], [T.len, 2.8], [T.len, -2.8]])).paint(M.steel);
      pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.steel[3]);
      if (tp && !far) { const pulse = Math.sin(t * 5) > 0; pn.ln(...T.p(2, -0.9), ...T.p(T.len - 2, -0.9), P.fire[pulse ? 3 : 2]); }
      // 护膝 + 侧翼
      if (tp) for (const [ang, len] of [[-0.9, 8], [-0.5, 9.5], [-0.1, 8]]) {
        const a = dir > 0 ? Math.PI - ang : ang, tip = [kx + Math.cos(a) * len, ky + Math.sin(a) * len];
        pn.poly([[kx, ky - 1], [tip[0], tip[1]], [kx + (tip[0] - kx) * 0.45, ky + (tip[1] - ky) * 0.45 + 1.6]]).paint(M.brass);
      }
      else pn.poly([[kx, ky - 3], [kx + dir * 5.5, ky - 1.5], [kx + dir * 5, ky + 2.5], [kx, ky + 1.5]]).paint(M.brass);
      ball(pn, M.steel, kx, ky, 2.8);
      hub(c, 3.2);
    },

    // T4 仪表腿：膝盖是一只大号压力表（表盘、刻度、指针随抬脚摆动），细抛光杆腿，小腿上一根玻璃液位管（水柱随抬脚升降），脚是三钉小圆脚
    dial(c, H) {
      const { pn, M, hx, hy, far, g } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len, Gl = far ? GLASS.far : GLASS.near;
      pn.cap(...B.p(0, 0), ...B.p(n, 0), 1.2).paint(M.steel, { bevel: 'l' });
      const g0 = n * 0.3, g1 = n * 0.78;
      pn.poly(B.pts([[g0, -1.8], [g0, 1.8], [g1, 1.8], [g1, -1.8]])).paint(Gl, { bevel: 'l' });
      if (!far) { const lv = g1 - (g1 - g0) * (0.25 + 0.06 * g.lift); pn.poly(B.pts([[lv, -0.9], [lv, 0.9], [g1 - 0.6, 0.9], [g1 - 0.6, -0.9]])).paint(NEAR.gauge, { outline: false, bevel: '' }); }
      for (const a of [g0, g1]) band(pn, B, a, 2.4, M.brass, 0.6);
      const x = F[0], y = F[1];
      pn.poly([[x - 4, y], [x - 3, y - 2.4], [x + 3, y - 2.4], [x + 4, y]]).paint(M.brass);
      for (const u of [-3, 0, 3]) pn.dot(x + u, y - 0.3, M.brass[0]);
      pn.cap(hx, hy, K[0], K[1], 1.3).paint(M.steel, { bevel: 'l' });
      // 表盘
      const R = 5.2;
      pn.disc(K[0], K[1], R).paint(M.brass);
      pn.disc(K[0], K[1], R - 1.3).paint(far ? FAR.steam : NEAR.steam, { outline: false, bevel: '' });
      for (let k = 0; k < 7; k++) { const a = Math.PI * 0.8 + k / 6 * Math.PI * 1.4; pn.dot(K[0] + Math.cos(a) * (R - 2), K[1] + Math.sin(a) * (R - 2), P.dark[1]); }
      const na = Math.PI * 0.8 + (0.2 + g.lift * 0.1 + (c.o.mv ? 0 : Math.sin((c.t || 0) * 1.5) * 0.08)) * Math.PI * 1.4;
      pn.ln(K[0], K[1], K[0] + Math.cos(na) * (R - 2), K[1] + Math.sin(na) * (R - 2), far ? P.dark[0] : P.fire[1]);
      pn.dot(K[0], K[1], M.brass[1]);
      hub(c, 2.8);
    },

    // T5 钟表巨像：大腿是开框（两根边梁，中间一只小齿轮在转），膝盖是一只大齿轮（随步伐转），胫后缘一排棘轮齿，宽脚板：脚跟发条盒、脚尖小齿轮
    clock(c, H) {
      const { pn, M, hx, hy, dir, o, t } = c, F = footOf(c, H), K = kneeOf(c, H);
      const rot = (o.mv ? (o.a || 0) + c.ph : t) * dir;
      const B = bone(K[0], K[1], F[0], F[1] - 3), n = B.len;
      for (let a = 5; a < n - 3; a += 3) pn.poly(B.pts([[a, dir * 1.6], [a + 2.6, dir * 1.6], [a + 2.6, dir * 3.6]]));
      pn.paint(M.iron, { bevel: 'l' });
      pn.poly(B.pts([[0, -2.2], [0, 2.2], [n, 1.5], [n, -1.5]])).paint(M.iron);
      const x = F[0], y = F[1];
      pn.poly([[x - 6, y], [x - 5, y - 2.8], [x + 5, y - 2.8], [x + 6, y]]).paint(M.iron);
      ball(pn, M.brass, x - dir * 4, y - 3.2, 2);
      gear(pn, x + dir * 4, y - 3.2, 1.8, 6, rot * 2, M.brass);
      const T = bone(hx, hy, K[0], K[1]);
      for (const s of [-2, 2]) pn.cap(...T.p(0, s), ...T.p(T.len, s * 0.7), 0.75);
      pn.paint(M.iron, { bevel: 'l' });
      gear(pn, ...T.p(T.len * 0.5, 0), 2.1, 6, -rot * 2, M.brass);
      gear(pn, K[0], K[1], 5, 10, rot, M.brass, M.iron);
      hub(c, 2.9);
    },

    // T5 锚链腿（铁甲舰）：人形正膝，锻铁大腿 + 缠着两道锚链箍的小腿，脚是一只船锚——锚冠着地、两只锚爪往上弯
    anchor(c, H) {
      const { pn, M, hx, hy, dir } = c, F = footOf(c, H);
      const A = [F[0], F[1] - 8];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 15, H.l2 || 16, dir);
      const B = bone(kx, ky, ex, ey), n = B.len;
      pn.poly(B.pts([[0, -2.4], [0, 2.4], [n, 1.8], [n, -1.8]])).paint(M.iron);
      for (const a of [n * 0.35, n * 0.6]) { pn.poly(B.pts([[a - 1.2, -2.8], [a + 1.2, -2.8], [a + 1.2, 2.8], [a - 1.2, 2.8]])).paint(M.steel, { bevel: 'l' }); pn.ln(...B.p(a, -2), ...B.p(a, 2), M.steel[0]); }
      // 船锚：锚环、锚杆、锚冠 + 两只弯爪
      const x = F[0], y = F[1];
      pn.cap(ex, ey, x, y - 1.5, 1.1).paint(M.steel, { bevel: 'l' });
      pn.disc(ex, ey, 1.6).paint(M.steel);
      pn.fill(x - 2.5, y - 5.8, 5, 1, M.steel[1]);   // 锚杆上的横档
      for (const s of [-1, 1]) {
        pn.cap(x, y - 1.2, x + s * 3.2, y - 1, 0.9).cap(x + s * 3.2, y - 1, x + s * 5, y - 3.8, 0.9);
        pn.poly([[x + s * 6.6, y - 3], [x + s * 5.2, y - 6.4], [x + s * 3.8, y - 3.4]]);
      }
      pn.paint(M.steel, { bevel: 'l' });
      pn.disc(x, y - 1.3, 1.2).paint(M.brass, { outline: false });
      const T = bone(hx, hy, kx, ky);
      pn.poly(T.pts([[-1.5, -3.2], [-1.5, 3.2], [T.len + 1, 2.4], [T.len + 1, -2.4]])).paint(M.iron);
      pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[3]);
      ball(pn, M.iron, kx, ky, 2.6); pn.dot(kx, ky, M.brass[3]);
      hub(c, 3.4);
    },

    // T6 熔心龙骑：三段龙腿（膝朝前、跗关节朝后），鳞甲大腿里嵌一座小炉膛，膝前尖刺、跗关节后刺，三爪 + 后爪；脚尖统一朝车头
    dragon(c, H) {
      const { pn, M, hx, hy, far, t } = c, F = footOf(c, H);
      const Hk = [F[0] - 3.5, F[1] - 9];
      const [kx, ky, ex, ey] = ik(hx, hy, Hk[0], Hk[1], H.l1 || 14, H.l2 || 15, 1);
      const x = F[0], y = F[1];
      // 爪
      pn.poly([[x - 1, y - 2.6], [x + 6, y - 0.6], [x + 7.5, y], [x - 1, y]]).paint(M.leg);
      pn.poly([[x, y - 3.4], [x + 4.5, y - 2.4], [x + 5.6, y - 1.2], [x + 0.5, y - 1.2]]).paint(M.leg);
      pn.dot(x + 7, y - 0.4, M.steel[3]); pn.dot(x + 5.2, y - 1.6, M.steel[3]);
      pn.poly([[ex - 0.5, ey + 2], [ex - 4, y - 0.4], [ex - 3, y], [ex + 1, ey + 3.5]]).paint(M.leg);   // 后爪
      pn.cap(ex, ey, x, y - 2, 1.3).paint(M.iron, { bevel: 'l' });
      const B = bone(kx, ky, ex, ey), n = B.len;
      pn.poly(B.pts([[0, -2.6], [0, 2.6], [n, 1.6], [n, -1.6]])).paint(M.iron);
      if (pn.hi) for (let a = 2; a < n - 1; a += 2.4) pn.ln(...B.p(a, -1.5), ...B.p(a + 1, 0), M.iron[3]);
      pn.poly([[ex, ey - 1.2], [ex - 5.5, ey - 3], [ex - 1, ey + 1.4]]).paint(M.brass);   // 跗关节后刺
      const T = bone(hx, hy, kx, ky);
      pn.poly(T.pts([[-2, -3.8], [-2, 3.8], [T.len + 1, 2.8], [T.len + 1, -2.8]])).paint(M.steel);
      for (const [a, f] of [[3, -1.5], [3, 1.5], [6.5, 0], [10, -1.3], [10, 1.3]]) if (a < T.len) pn.ln(...T.p(a - 1, f - 1.2), ...T.p(a + 0.6, f), M.steel[1]);
      if (!far) { const q = T.p(T.len * 0.5, 0), hot = Math.sin(t * 6 + c.ph) > 0; pn.fill(q[0] - 1.5, q[1] - 1, 3, 2, P.fire[hot ? 3 : 2]); pn.dot(q[0] - 1.5, q[1] - 1, P.fire[1]); }
      pn.poly([[kx - 1, ky - 1.5], [kx + 5, ky - 5], [kx + 1.5, ky + 1]]).paint(M.brass);   // 膝前尖刺
      ball(pn, M.iron, kx, ky, 2.6);
      hub(c, 3.4);
    },

    // T6 晶枝腿：大腿是一根扭曲的枯枝，膝盖是一块棱角岩石、嵌一颗发光宝石，小腿是更细的枯枝、背面长出一簇晶体，脚是扁平岩板 + 趾尖晶柱
    crystal(c, H) {
      const { pn, M, hx, hy, dir, far } = c, F = footOf(c, H), K = kneeOf(c, H), Gl = far ? GLASS.far : GLASS.near, Wd = far ? FAR.leather : NEAR.leather;
      const twig = (a, b, r0, r1, k) => { const B = bone(a[0], a[1], b[0], b[1]); let q0 = a; for (let i = 1; i <= 8; i++) { const u = i / 8, q = B.p(B.len * u, Math.sin(u * 7 + k) * 1.1 * Math.sin(Math.PI * u)); pn.cap(q0[0], q0[1], q[0], q[1], r0 + (r1 - r0) * u); q0 = q; } return B; };
      const B = twig(K, [F[0], F[1] - 3], 1.5, 0.9, 1); pn.paint(Wd, { bevel: 'l' });
      pn.poly(B.pts([[B.len * 0.4, dir * 1], [B.len * 0.3, dir * 6], [B.len * 0.52, dir * 1.4]]));
      pn.poly(B.pts([[B.len * 0.5, dir * 1], [B.len * 0.52, dir * 5], [B.len * 0.62, dir * 1]]));
      pn.poly(B.pts([[B.len * 0.34, dir * 0.8], [B.len * 0.18, dir * 4], [B.len * 0.42, dir * 1.2]])).paint(Gl, { bevel: 'l' });
      const x = F[0], y = F[1];
      pn.poly([[x - 5, y], [x - 4, y - 2.4], [x + 1, y - 3.2], [x + 4.5, y - 2], [x + 5.5, y]]).paint(M.steel);
      pn.poly([[x + dir * 2.5, y - 2.5], [x + dir * 4, y - 7], [x + dir * 5, y - 2.2]]).paint(Gl, { bevel: 'l' });
      twig([c.hx, c.hy], K, 2, 1.5, 3); pn.paint(Wd, { bevel: 'l' });
      if (pn.hi) { const T = bone(hx, hy, K[0], K[1]); pn.poly(T.pts([[T.len * 0.5, 0], [T.len * 0.62, -3.5], [T.len * 0.6, 0]])).paint(Wd, { bevel: '' }); }
      pn.poly([[K[0] - 3, K[1] - 1], [K[0] - 1, K[1] - 3.4], [K[0] + 2.6, K[1] - 2.4], [K[0] + 3.4, K[1] + 1], [K[0] + 0.5, K[1] + 3.2], [K[0] - 2.8, K[1] + 2]]).paint(M.steel);
      pn.fill(K[0] - 0.5, K[1] - 0.5, 2, 2, far ? P.glass[1] : P.glass[3]); pn.dot(K[0] - 0.5, K[1] + 0.5, P.glass[2]);
      hub(c, 2.8);
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
    // T6 熔心龙骑：整块车体是交叠的鳞甲（两排），正中一扇炉膛格栅（火光随呼吸明灭），下沿一排朝下的锯齿尖刺
    dragon(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 93, y + 16], [x + 3, y + 16]]).paint(NEAR.iron);
      for (let u = 6; u < 92; u += 6) pn.poly([[x + u - 2.6, y + 17], [x + u + 2.6, y + 17], [x + u, y + 22]]).paint(NEAR.steel);
      for (const [row, off] of [[7, 0], [12, 3]]) for (let u = 4 + off; u < 94; u += 6) {
        if (u > 37 && u < 59) continue;
        pn.poly([[x + u - 3, y + row - 3], [x + u + 3, y + row - 3], [x + u + 3, y + row], [x + u, y + row + 2.4], [x + u - 3, y + row]]).paint(NEAR.iron);
      }
      pn.rect(x + 38, y + 4, 20, 12).paint(NEAR.iron);
      const hot = 0.5 + 0.5 * Math.sin((o.t || 0) * 2.6);
      pn.fill(x + 40, y + 6, 16, 8, P.fire[hot > 0.5 ? 2 : 1]); pn.fill(x + 42, y + 10, 12, 4, P.fire[hot > 0.5 ? 3 : 2]);
      for (let u = 41; u < 56; u += 3) pn.fill(x + u, y + 5, 1, 10, P.dark[0]);
    },
  };

  // 车体的附加层：BACK 画在车体后面（露出车体下沿的部分），FRONT 画在近侧腿前面
  const BACK = {
    // 钟表巨像：肚子底下半露一只大齿轮 + 一只啮合的小齿轮，走路时转
    bellygear(pn, x, y, o) {
      const r = (o.mv ? o.a || 0 : (o.t || 0)) * 0.6;
      gear(pn, x + 48, y + 17, 10, 16, r, NEAR.brass, NEAR.iron);
      gear(pn, x + 34, y + 21, 5, 9, -r * 2 + 0.2, NEAR.brass, NEAR.iron);
      gear(pn, x + 62, y + 21, 5, 9, -r * 2 + 0.2, NEAR.brass, NEAR.iron);
    },
    // 锚链：前后两个锚链孔之间垂下一段锚链（悬链线，微微晃）
    chains(pn, x, y, o) {
      const sw = Math.sin((o.t || 0) * 1.6) * 1.2;
      for (const [a, b, sag] of [[30, 66, 12], [36, 60, 7]]) {
        const N = Math.round((b - a) / 2.2);
        for (let i = 0; i <= N; i++) {
          const u = i / N, px = x + a + (b - a) * u + sw * Math.sin(Math.PI * u), py = y + 18 + sag * 4 * u * (1 - u);
          if (i % 2) pn.fill(px - 0.5, py - 1, 1, 2, P.iron[3]); else { pn.disc(px, py, 1.3).paint(NEAR.steel, { bevel: 'l' }); pn.dot(px, py, P.dark[0]); }
        }
      }
      for (const u of [30, 66]) { pn.disc(x + u, y + 17, 2.2).paint(NEAR.steel); pn.dot(x + u, y + 17, P.black); }
    },
    // 晶簇：车体底下往下 / 斜着长出几簇晶体
    shards(pn, x, y, o) {
      const G = GLASS.near;
      for (const [u, len, lean, w] of [[36, 9, -3, 2.2], [41, 12, 0, 2.6], [46, 7, 2, 2], [52, 11, -1, 2.4], [58, 8, 3, 2], [63, 6, 1, 1.8]]) {
        pn.poly([[x + u - w, y + 15], [x + u + w, y + 15], [x + u + lean, y + 15 + len]]).paint(G, { bevel: 'l' });
      }
    },
  };
  const FRONT = {
    // 裙甲堡：车体下沿垂下一圈铆接熟铁裙甲（钟形，往下张开），盖住大腿和膝盖
    skirt(pn, x, y, o) {
      const N = 8, top = y + 14, bot = y + 32;
      for (let i = 0; i < N; i++) {
        const t0 = 4 + i * 88 / N, t1 = 4 + (i + 1) * 88 / N, fl = (u) => 48 + (u - 48) * 1.07;
        pn.poly([[x + t0, top], [x + t1, top], [x + fl(t1), bot - (i % 2 ? 0 : 1.5)], [x + fl(t0), bot - (i % 2 ? 0 : 1.5)]]).paint(i % 2 ? NEAR.iron : NEAR.steel);
        if (pn.hi) { rivet(pn, x + (t0 + t1) / 2 - 1, top + 2); rivet(pn, x + (fl(t0) + fl(t1)) / 2 - 1, bot - 4); } else pn.dot(x + (t0 + t1) / 2, top + 2, P.iron[4]);
      }
      pn.fill(x + 3, top, 90, 2, P.brass[1]); pn.fill(x + 3, top, 90, 1, P.brass[2]);
    },
    // 蒸汽圣骑：车体侧面挂一排骑士风筝盾（黄铜包边、斜带纹章），尖底垂出车体下沿
    shields(pn, x, y, o) {
      for (const [cx, k] of [[7, 0], [36, 1], [48, 0], [60, 1], [89, 0]]) {
        const pts = [[cx - 4.6, y + 5], [cx + 4.6, y + 5], [cx + 4.6, y + 12], [cx + 2.4, y + 18], [cx, y + 22.5], [cx - 2.4, y + 18], [cx - 4.6, y + 12]].map(([u, v]) => [x + u, v]);
        pn.poly(pts).paint(NEAR.brass);
        pn.poly(pts.map(([u, v]) => [u + (x + cx - u) * 0.26, v + (y + 11 - v) * 0.2])).paint(NEAR.steel, { outline: false });
        if (k) pn.ln(x + cx - 3, y + 7, x + cx + 3, y + 14, P.brass[1], pn.hi ? 2 : 1); else { pn.ln(x + cx - 3, y + 14, x + cx, y + 9, P.brass[1]); pn.ln(x + cx, y + 9, x + cx + 3, y + 14, P.brass[1]); }
      }
    },
    // 圣堂骑士：车腹正中垂下两片白布红十字罩袍（随风摆），上沿挂在黄铜横杆上
    tabard(pn, x, y, o) {
      const sw = Math.sin((o.t || 0) * 2.2);
      for (const cx of [42, 54]) {
        const b = y + 36, dx = sw * 1.4 * (cx === 42 ? 1 : 0.8);
        pn.poly([[x + cx - 5, y + 15], [x + cx + 5, y + 15], [x + cx + 5 + dx, b - 2], [x + cx + dx, b], [x + cx - 5 + dx, b - 2]]).paint(NEAR.steam);
        const m = cx + dx * 0.5;
        pn.fill(x + m - 0.8, y + 18, 2, 12, P.fire[1]); pn.fill(x + m - 3.5, y + 22, 7, 2, P.fire[1]);
      }
      pn.rect(x + 35, y + 14, 26, 1.6).paint(NEAR.brass);
    },
  };

  // ---------- 编制（15 种 = 主线 6 + 变体 9） ----------
  // mt 材质档；hull 车体；back / front 车体附加层；leg 腿型；main 主线；kept = v1 里用户采用的
  const SET = [
    { mt: 1, main: true, name: '工装 Mk.II', hull: 'base', leg: 'mk2', ref: '现役伏地蛛 + 双足 T1 工装 Mk.II',
      idea: '现役伏地蛛的甲壳不动，腿换成双足 T1 的做法：箱形梁大腿、跨膝液压撑杆（缸体铰在大腿、活塞杆铰在小腿，膝盖一弯就跟着伸缩）、镂空的双支杆小腿、脚尖朝外的带肋平脚。' },
    { mt: 2, main: true, kept: true, name: '桁架爬机', hull: 'girder', leg: 'truss', ref: '维多利亚铁桥 / 格构铁塔（v1 采用）',
      idea: '小腿是往下收窄的铆接格构梁（透空），大腿是实心箱梁，铸铁平底靴；车体是一段熟铁板梁。' },
    { mt: 2, name: '裙甲堡', hull: 'girder', front: 'skirt', leg: 'skirt', ref: '双足裙甲堡 · 攻城盾墙 / 钟形裙甲',
      idea: '车体下沿垂下一圈八块铆接熟铁裙甲，钟形往下张开，把大腿和膝盖整个罩住，只露出张开的护胫和脚尖朝外的铁靴碎步走。剪影是一整块「堡」。' },
    { mt: 3, main: true, kept: true, name: '板簧拖车', hull: 'landship', leg: 'leaf', ref: '一战炮兵牵引车（v1 采用）',
      idea: '大腿是一叠弓形板簧（中段卡箍），小腿是直撑杆 + 螺旋减震，脚是带抓地齿的履带板；车体是陆地巡洋舰装甲壳。' },
    { mt: 3, name: '掷弹兵', hull: 'landship', leg: 'gren', ref: '双足掷弹兵',
      idea: '换成人形正膝：膝盖朝外、落在半高处。铆接圆筒大腿 + 两道黄铜箍，膝盖是一只压力表（指针随步子摆），喇叭口护胫、平头重靴，膝后一根蒸汽活塞。剪影是四根粗壮的柱子。' },
    { mt: 3, name: '步行履带', hull: 'landship', leg: 'pedrail', ref: '迪普洛克「步行履带」Pedrail（1900 年代，一战坦克的前身之一）',
      idea: '膝盖朝里的两段支腿，每只脚是一小段履带：三只负重轮、履带板随步子走。剪影是四条长长的扁脚。' },
    { mt: 4, main: true, kept: true, name: '曲柄步行机', hull: 'coach', leg: 'crank', ref: '切比雪夫步行机 / 维多利亚机械玩具（v1 采用）',
      idea: '车体侧面四只转动的黄铜飞轮，曲柄销推一根滑槽推杆带动膝盖；抛光圆杆小腿、平掌；车体是马车厢。' },
    { mt: 4, name: '蒸汽圣骑', hull: 'coach', front: 'shields', leg: 'knight', ref: '双足蒸汽圣骑 · 哥特板甲',
      idea: '人形正膝的哥特板甲腿：棱线大腿甲、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴 + 马刺；车体侧面挂一排五面骑士风筝盾（黄铜包边、纹章），尖底垂出车体下沿。剪影是尖脚 + 膝侧翼片 + 一排盾尖。' },
    { mt: 4, name: '仪表步行机', hull: 'coach', leg: 'dial', ref: '维多利亚压力表、玻璃液位计',
      idea: '四个膝盖是四只大号压力表：黄铜表圈、白表盘、刻度，指针随抬脚摆动；小腿上一根玻璃液位管，水柱随抬脚升降；腿是细抛光杆，脚是三钉小圆脚。剪影是车体下方四只大圆盘。' },
    { mt: 5, main: true, kept: true, name: '汽锤步行机', hull: 'forge', leg: 'hammer', ref: '内史密斯蒸汽锤（v1 采用）',
      idea: '每条腿是一台吊在耳轴上的竖直汽缸，活塞杆伸到砧形铁脚，落脚喷汽；车体是厚锻铁 + 蒸汽管 + 压力表。' },
    { mt: 5, name: '钟表巨像', hull: 'forge', back: 'bellygear', leg: 'clock', ref: '双足钟表巨像 · 塔钟机芯',
      idea: '膝盖是一只十齿大齿轮，开框大腿里转着小齿轮，胫后缘一排棘轮齿，宽脚板带发条盒和小齿轮；车腹底下半露一只大齿轮 + 两只啮合的小齿轮，走路时一起转。剪影是齿形的圆。' },
    { mt: 5, name: '锚链铁甲', hull: 'forge', back: 'chains', leg: 'anchor', ref: '维多利亚铁甲舰的锚与锚链',
      idea: '人形正膝，锻铁大腿、缠两道锚链箍的小腿，每只脚是一只船锚：锚冠着地、两只锚爪往上弯。车腹两个锚链孔之间垂下两段锚链。' },
    { mt: 6, main: true, name: '熔心龙骑', hull: 'dragon', leg: 'dragon', ref: '双足熔心龙骑（没有龙头，只取鳞甲、炉膛、尖刺、爪）',
      idea: '车体是两排交叠的鳞甲，正中一扇炉膛格栅（火光随呼吸明灭），下沿一排朝下的锯齿尖刺。腿是三段龙腿：鳞甲大腿里嵌一座小炉膛、膝前尖刺、跗关节后刺、三爪 + 后爪，四只脚尖统一朝车头。' },
    { mt: 6, name: '圣堂骑士', hull: 'arc', front: 'tabard', leg: 'knight', H: { templar: true }, ref: '双足圣堂骑士腿 · 十字军罩袍',
      idea: '蒸汽圣骑的升级：护膝侧面三片后掠黄铜羽翼、护胫后缘一片刀锋尾鳍、更长更尖的铁靴 + 脚跟长刺、大腿甲正中一条发光能量脉；车腹正中垂下两片白布红十字罩袍，随风摆。' },
    { mt: 6, name: '晶枝', hull: 'arc', back: 'shards', leg: 'crystal', ref: '双足晶枝腿 · 枯枝、岩石、宝石',
      idea: '大腿是扭曲的枯枝，膝盖是一块棱角岩石、嵌一颗发光宝石，小腿是更细的枯枝、背面长出一簇晶体，脚是扁平岩板 + 趾尖晶柱；车腹底下往下长出一片晶簇。' },
  ];
  const LEG_H = { crank: { reach: 4 }, skirt: { reach: 3 }, gren: { reach: 3 }, pedrail: { reach: 2 }, knight: { reach: 2 }, dial: { up: -9, kx: 11 }, clock: { up: -1, kx: 11 }, anchor: { reach: 3 }, dragon: { reach: 0 } };

  // 画一只整件四足到透明画布，坐标 (ox, oy) = 模块左上角。o = { mv, a 步态角, t 秒, stride, top }
  function figure(g, ox, oy, e, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const S = o.stride || 13, lo = { mv: !!o.mv, a: o.a || 0, plant: true, plantS: S, plantH: 5 + 0.3 * S };
    const bd = LL.quadBob({ mv: !!o.mv, a: o.a || 0, stride: S }), y = oy + bd, H = { ...(LEG_H[e.leg] || {}), ...(e.H || {}) };
    const ho = { t: o.t || 0, top: !!o.top, mv: !!o.mv, a: o.a || 0 };
    const leg = (M, far, [hx, hy], gy, dir, ph) => {
      const c = { pn, M, far, hx: ox + hx, hy: y + hy, gy, dir, ph, o: lo, t: o.t || 0 };
      c.g = gait(lo, ph, 5, 4);
      LEGS[e.leg](c, H);
    };
    leg(FAR, true, HIPS.fr, oy + 45, -1, Math.PI); leg(FAR, true, HIPS.ff, oy + 45, 1, 0);
    if (e.back) BACK[e.back](pn, ox, y, ho);
    HULL[e.hull](pn, ox, y, ho);
    leg(NEAR, false, HIPS.nr, oy + 48, -1, 0); leg(NEAR, false, HIPS.nf, oy + 48, 1, Math.PI);
    if (e.front) FRONT[e.front](pn, ox, y, ho);
    pn.flush(g);
  }
  return { SET, figure, LEGS, HULL };
})();
