// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：四足整件底盘（4×2 = 96×48）六档 + 变体 · 重做 v3（2026-09-29）。用户对 v2 的意见：
//   ① 腿普遍太细，撑不起特色 → 所有腿加粗（大腿 6～8px、小腿 4～6px，脚加大）；
//   ② 双足有上下颠簸，四足看不到 → 机身按步态起伏：对角两腿交替着地时（双支撑）机身最低、单对腿撑在正下方时最高，每步两次，幅度 2px；
//   ③ 遮挡关系大多不对（胯上的销钉盖住摆过来的小腿、大腿盖住小腿……）→ 每条腿按层画（见 Z）：
//      驱动件 → 大腿 → 胯销 → 连杆 → 小腿 → 膝销 → 脚 → 踝销；远侧腿看到的是内侧面，整组倒过来画；
//   ④ T6 整体重做（哥特圣殿 / 天象仪 / 熔炉龙骑）、仪表步行机重做；
//   ⑤ 底盘（无腿部分）T4～T6 重新探索：每档三种车体候选（见 HULL_CANDS），主线腿穿上各候选对照。
// 保留：T1 工装 Mk.II、T2 桁架爬机 + 裙甲堡、T3 板簧拖车 + 掷弹兵 + 步行履带、T4 曲柄步行机 + 蒸汽圣骑、T5 汽锤步行机 + 钟表巨像 + 锚链铁甲（都加粗、按层画）。
// 风格：工业、蒸汽朋克、维多利亚、少量一战；不做动物头。拓扑、胯、地面、步态和游戏的四足整件一致，顶板以上不画。
window.SA = window.SA || {};

SA.QLAB = (() => {
  const LL = SA.LEGLAB, U = LL.U, P = SA.PAL, { NEAR, FAR, gait, ik, bone, gear, rivet } = U;
  const TAU = Math.PI * 2;
  const ball = (pn, ramp, x, y, r) => { pn.disc(x, y, r).paint(ramp); if (r > 1.6) pn.dot(x - r * 0.4, y - r * 0.4, ramp[3]); };
  const band = (pn, B, a, w, ramp, t = 0.8) => pn.poly(B.pts([[a - t, -w], [a + t, -w], [a + t, w], [a - t, w]])).paint(ramp, { outline: false, bevel: 'l' });
  const slab = (B, a0, a1, w0, w1) => B.pts([[a0, -w0], [a0, w0], [a1, w1], [a1, -w1]]);   // 沿骨骼的梯形板
  const GLASS = { near: [P.glass[0], P.glass[1], P.glass[2], P.glass[3]], far: [P.black, P.glass[0], P.glass[1], P.glass[2]] };
  const HIPS = { nr: [22, 10], nf: [74, 10], fr: [24, 7], ff: [76, 7] };
  const ell = (pn, cx, cy, rx, ry, tilt, front, back) => {
    const n = Math.max(16, Math.round((rx + ry) * 4)), c = Math.cos(tilt), s = Math.sin(tilt);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pn.dot(cx + x * c - y * s, cy + x * s + y * c, Math.sin(a) > 0 ? front : back); }
  };

  // 遮挡层（近侧腿从小到大画；远侧腿倒过来）
  const Z = { DRV: 0, TH: 1, HIP: 2, LNK: 3, SH: 4, KN: 5, FT: 6, AN: 7 };

  // ---------- 腿 ----------
  // c = { pn, M, far, hx, hy, gy, dir（-1 后腿 / 1 前腿）, ph, o（步态参数）, g（gait 结果）, t, L(z, fn) 按层登记 }
  const footOf = (c, H) => [c.hx + c.dir * (H.reach == null ? 4 : H.reach) + c.g.x, c.gy - c.g.lift];
  const kneeOf = (c, H) => [c.hx + c.dir * (H.kx == null ? 10 : H.kx) + c.g.x * (H.kf == null ? 0.45 : H.kf), c.hy - (H.up == null ? 5 : H.up) - c.g.lift * 0.6];
  const hub = (c, r = 3.4) => c.L(Z.HIP, () => { ball(c.pn, c.M.iron, c.hx, c.hy, r); c.pn.disc(c.hx, c.hy, r * 0.38).paint(c.M.brass, { outline: false }); });
  const shoe = (pn, M, F, w = 5, h = 3.4, ramp) => pn.poly([[F[0] - w, F[1]], [F[0] - w + 1.4, F[1] - h], [F[0] + w - 1.4, F[1] - h], [F[0] + w, F[1]]]).paint(ramp || M.leg);
  const boot = (pn, M, F, dir, back, toe, h, ramp) => pn.poly([[F[0] - dir * back, F[1]], [F[0] - dir * back, F[1] - h], [F[0] + dir * (toe - 3.5), F[1] - h], [F[0] + dir * toe, F[1] - 1.6], [F[0] + dir * toe, F[1]]]).paint(ramp || M.leg);

  const LEGS = {
    // T1 工装 Mk.II：箱形梁大腿 + 跨膝液压撑杆 + 双支杆小腿 + 带肋平脚（脚尖朝外）
    mk2(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H), K = kneeOf(c, H), inn = -dir;
      const B = bone(K[0], K[1], F[0], F[1] - 3.6), n = B.len, T = bone(hx, hy, K[0], K[1]);
      const P1 = T.p(T.len * 0.4, inn * 4), P2 = B.p(n * 0.42, inn * 3.4), D = bone(P1[0], P1[1], P2[0], P2[1]);
      L(Z.TH, () => { pn.poly(slab(T, -2, T.len + 1.5, 4, 3.2)).paint(M.iron); pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[1]); });
      hub(c, 3.8);
      L(Z.LNK, () => {
        pn.cap(...D.p(D.len * 0.45, 0), ...P2, 0.9).paint(M.steel, { bevel: 'l' });
        pn.cap(...P1, ...D.p(D.len * 0.52, 0), 1.8).paint(M.brass, { bevel: 'l' });
        ball(pn, M.iron, P1[0], P1[1], 1.2); ball(pn, M.iron, P2[0], P2[1], 1.2);
      });
      L(Z.SH, () => {
        for (const s of [-2.4, 2.4]) pn.cap(...B.p(1, s), ...B.p(n, s * 0.5), 1.15);
        pn.paint(M.leg, { bevel: 'l' });
        for (const a of [n * 0.36, n * 0.72]) band(pn, B, a, 3.2, M.iron, 0.8);
      });
      L(Z.KN, () => { ball(pn, M.iron, K[0], K[1], 3.4); pn.dot(K[0], K[1], M.brass[2]); });
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        boot(pn, M, F, dir, 5, 8, 3.4, M.iron);
        for (const u of [-2.5, 0.5, 3.5]) pn.fill(x + dir * u, y - 2.8, 1, 2.4, M.iron[1]);
      });
      L(Z.AN, () => ball(pn, M.iron, ...B.p(n, 0), 1.7));
    },

    // T2 桁架爬机：箱形大腿 + 往下收窄的铆接格构小腿（两根弦杆 + 之字形腹杆，透空），铸铁平底靴
    truss(c, H) {
      const { pn, M, hx, hy, L } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3.4), n = B.len, w0 = 5.2, w1 = 2.2, wAt = (a) => w0 + (w1 - w0) * a / n, T = bone(hx, hy, K[0], K[1]);
      L(Z.TH, () => { pn.poly(slab(T, -2, T.len + 1, 3.6, 3)).paint(M.iron); if (pn.hi) pn.ln(...T.p(1.5, 0), ...T.p(T.len - 1.5, 0), M.iron[0]); });
      hub(c, 3.8);
      L(Z.SH, () => {
        const k = 5;
        for (let i = 0; i < k; i++) { const a0 = n * i / k, a1 = n * (i + 1) / k, s = i % 2 ? 1 : -1; pn.cap(...B.p(a0, s * (wAt(a0) - 0.8)), ...B.p(a1, -s * (wAt(a1) - 0.8)), 0.55); }
        pn.paint(M.iron, { outline: false, bevel: '' });
        pn.cap(...B.p(0, -w0), ...B.p(n, -w1), 1.05).cap(...B.p(0, w0), ...B.p(n, w1), 1.05).paint(M.iron, { bevel: 'l' });
        for (const a of [n * 0.02, n * 0.98]) pn.poly(B.pts([[a - 0.7, -wAt(a)], [a + 0.7, -wAt(a)], [a + 0.7, wAt(a)], [a - 0.7, wAt(a)]])).paint(M.iron, { outline: false });
        for (let i = 1; i < k; i++) { const a = n * i / k; for (const s of [-1, 1]) pn.dot(...B.p(a, s * wAt(a)), M.brass[3]); }
      });
      L(Z.KN, () => { ball(pn, M.iron, K[0], K[1], 3.4); pn.dot(K[0], K[1], M.brass[2]); });
      L(Z.FT, () => { shoe(pn, M, F, 5.5, 3.6); pn.fill(F[0] - 3.5, F[1] - 4.2, 7, 1, M.brass[1]); });
    },

    // T2 裙甲堡的腿：大腿和膝盖藏在裙甲里，只露出往下张开的粗护胫和脚尖朝外的铁靴（碎步）
    skirt(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H);
      const T0 = [hx + c.g.x * 0.35, hy + 12], B = bone(T0[0], T0[1], F[0], F[1] - 4.4), n = B.len;
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 3.4, 4.6)).paint(M.iron);
        pn.ln(...B.p(2, 0), ...B.p(n - 1, 0), M.iron[3]);
        band(pn, B, n * 0.55, 4.4, M.brass, 0.7);
      });
      L(Z.FT, () => { boot(pn, M, F, dir, 5, 7.5, 4.6); pn.fill(F[0] - 4.5, F[1] - 5, 9, 1, M.iron[3]); });
    },

    // T3 板簧拖车：大腿是一叠弓形板簧（中段卡箍），小腿是直撑杆 + 螺旋减震，脚是带抓地齿的履带板
    leaf(c, H) {
      const { pn, M, hx, hy, L } = c, F = footOf(c, H), K = kneeOf(c, H);
      const B = bone(K[0], K[1], F[0], F[1] - 3.4), n = B.len, T = bone(hx, hy, K[0], K[1]), Lt = T.len;
      L(Z.TH, () => {
        for (const [f0, f1, d] of [[0.3, 0.7, 3.6], [0.14, 0.86, 1.8], [0, 1, 0]]) {
          let q0 = null;
          for (let i = 0; i <= 6; i++) { const u = f0 + (f1 - f0) * i / 6, q = T.p(Lt * u, -(2.4 * Math.sin(Math.PI * u)) + d); if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.95); q0 = q; }
          pn.paint(M.steel, { bevel: 'l' });
        }
        pn.poly(T.pts([[Lt * 0.5 - 1.3, -3.4], [Lt * 0.5 + 1.3, -3.4], [Lt * 0.5 + 1.3, 5.2], [Lt * 0.5 - 1.3, 5.2]])).paint(M.dark);
      });
      hub(c, 3.6);
      L(Z.SH, () => {
        pn.cap(...B.p(n * 0.36, 0), ...B.p(n * 0.74, 0), 1).paint(M.steel, { bevel: '' });
        for (let k = 0; k < 4; k++) { const a = n * 0.42 + n * 0.26 * k / 3; pn.cap(...B.p(a - 1, -3.3), ...B.p(a + 1, 3.3), 0.8); }
        pn.paint(M.steel, { bevel: 'l' });
        pn.cap(...B.p(0, 0), ...B.p(n * 0.38, 0), 2.7).paint(M.iron, { bevel: 'l' });
        pn.cap(...B.p(n * 0.72, 0), ...B.p(n, 0), 1.9).paint(M.steel, { bevel: 'l' });
        for (const a of [n * 0.38, n * 0.72]) band(pn, B, a, 3.6, M.brass, 0.7);
      });
      L(Z.KN, () => ball(pn, M.iron, K[0], K[1], 3.2));
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.rect(x - 7, y - 3.8, 14, 2.8).paint(M.iron);
        for (const u of [-6, -2, 2]) pn.rect(x + u, y - 1.2, 3, 1.2).paint(M.leg, { outline: false });
      });
    },

    // T3 掷弹兵：人形正膝（膝盖朝外、在半高处）。铆接圆筒大腿 + 黄铜箍，膝盖是一只压力表，喇叭口护胫，平头重靴；膝后一根蒸汽活塞
    gren(c, H) {
      const { pn, M, hx, hy, dir, far, L } = c, F = footOf(c, H), inn = -dir;
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 4.6, H.l1 || 17, H.l2 || 19, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky);
      L(Z.TH, () => {
        pn.cap(hx, hy, kx, ky, 4.2).paint(M.iron);
        for (const a of [T.len * 0.3, T.len * 0.72]) band(pn, T, a, 4.3, M.brass, 0.8);
        if (pn.hi) for (let a = 2; a < T.len - 1; a += 2.6) pn.dot(...T.p(a, dir * 2.2), M.iron[4]);
      });
      hub(c, 3.8);
      L(Z.LNK, () => pn.cap(...T.p(T.len * 0.5, inn * 4), ...B.p(n * 0.45, inn * 3.6), 0.9).paint(M.steel, { bevel: 'l' }));
      L(Z.SH, () => {
        pn.poly(B.pts([[0, -3], [0, 3], [n * 0.65, 3.2], [n + 0.6, 5], [n + 0.6, -5], [n * 0.65, -3.2]])).paint(M.iron);
        pn.ln(...B.p(3, 0), ...B.p(n - 1, 0), M.iron[3]);
      });
      L(Z.KN, () => {
        pn.disc(kx, ky, 4.2).paint(M.brass);
        pn.disc(kx, ky, 2.9).paint(far ? FAR.steam : NEAR.steam, { outline: false, bevel: '' });
        const na = -2.4 + (c.o.mv ? Math.sin((c.o.a || 0) + c.ph) * 1.2 + 1.2 : Math.sin((c.t || 0) * 2) * 0.3);
        pn.ln(kx, ky, kx + Math.cos(na) * 2.4, ky + Math.sin(na) * 2.4, far ? P.dark[0] : P.fire[1]);
      });
      L(Z.FT, () => { boot(pn, M, F, dir, 5.5, 8, 5); pn.fill(F[0] + (dir > 0 ? 2.5 : -5.5), F[1] - 4.6, 3, 1, M.brass[2]); });
    },

    // T3 步行履带（迪普洛克 Pedrail，1900s）：膝盖朝里的两段粗支腿，脚是一段履带：三只负重轮、履带板随步子走
    pedrail(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H), A = [F[0], F[1] - 5.6];
      const [kx, ky] = ik(hx, hy, A[0], A[1], H.l1 || 16, H.l2 || 21, -dir), T = bone(hx, hy, kx, ky);
      L(Z.TH, () => { pn.poly(slab(T, -2, T.len + 1.5, 3.6, 3)).paint(M.iron); if (pn.hi) for (let a = 2; a < T.len - 1; a += 3) pn.dot(...T.p(a, 0), M.iron[4]); else pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[1]); });
      hub(c, 3.6);
      L(Z.SH, () => pn.cap(kx, ky, ...A, 2.4).paint(M.steel, { bevel: 'l' }));
      L(Z.KN, () => ball(pn, M.steel, kx, ky, 3));
      L(Z.FT, () => {
        const x = F[0], y = F[1], half = 7;
        pn.poly([[A[0] - 3, A[1] - 1], [A[0] + 3, A[1] - 1], [A[0] + 2, A[1] + 2.6], [A[0] - 2, A[1] + 2.6]]).paint(M.iron);
        pn.cap(x - half, y - 2.8, x + half, y - 2.8, 2.8).paint(M.leg);
        const sh = ((c.o.mv ? -c.g.x : (c.t || 0) * 3) % 2.6 + 2.6) % 2.6;
        for (let u = -half - 1 + sh; u < half + 1; u += 2.6) { pn.dot(x + u, y - 5.4, M.iron[3]); pn.dot(x + u, y - 0.3, M.iron[2]); }
        for (const u of [-4.2, 0, 4.2]) ball(pn, M.iron, x + u, y - 2.8, 1.5);
      });
      L(Z.AN, () => ball(pn, M.brass, A[0], A[1], 1.4));
    },

    // T4 曲柄步行机：车体侧面一只六辐飞轮（曲柄销推一根滑槽推杆去带膝盖），抛光粗圆杆小腿 + 平掌
    crank(c, H) {
      const { pn, M, hx, hy, dir, o, L } = c, F = footOf(c, H);
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 3.6, H.l1 || 12, H.l2 || 34, dir);
      const A = (o.mv ? (o.a || 0) + c.ph : (c.t || 0) * 1.2) * dir, C = [hx - dir * 11, hy + 1], R = 5.6, Pn = [C[0] + Math.cos(A) * 3.8, C[1] + Math.sin(A) * 3.8];
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey);
      L(Z.DRV, () => {
        pn.disc(C[0], C[1], R).paint(M.brass);
        pn.disc(C[0], C[1], R - 1.4).paint(M.dark, { outline: false, bevel: '' });
        for (let k = 0; k < 6; k++) { const a = A + k / 6 * TAU; pn.ln(C[0], C[1], C[0] + Math.cos(a) * (R - 1.2), C[1] + Math.sin(a) * (R - 1.2), M.brass[2]); }
        ball(pn, M.brass, C[0], C[1], 1.4);
      });
      L(Z.TH, () => { pn.poly(slab(T, -1.5, T.len + 1.5, 3.4, 2.8)).paint(M.steel); pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.steel[3]); });
      hub(c, 3.6);
      L(Z.LNK, () => {
        pn.cap(...Pn, kx, ky, 1.1).paint(M.iron, { bevel: 'l' });
        if (pn.hi) { const Rr = bone(Pn[0], Pn[1], kx, ky); pn.ln(...Rr.p(Rr.len * 0.4, 0), ...Rr.p(Rr.len * 0.85, 0), M.dark[0]); }
        ball(pn, M.iron, Pn[0], Pn[1], 1.5);
      });
      L(Z.SH, () => {
        pn.poly(slab(B, 0, B.len, 2.6, 2)).paint(M.steel);
        pn.ln(...B.p(1, -1), ...B.p(B.len - 1, -0.8), M.steel[3]);
        for (const a of [B.len * 0.3, B.len * 0.62]) band(pn, B, a, 2.9, M.brass, 0.8);
      });
      L(Z.KN, () => ball(pn, M.steel, kx, ky, 3));
      L(Z.FT, () => { pn.poly([[ex - 6, ey + 3.6], [ex - 5, ey + 0.4], [ex + 5, ey + 0.4], [ex + 6.5, ey + 3.6]]).paint(M.iron); pn.fill(ex - 3.5, ey + 1.4, 7, 1, M.brass[2]); });
      L(Z.AN, () => ball(pn, M.brass, ex, ey, 1.6));
    },

    // T4 蒸汽圣骑：人形正膝的哥特板甲腿——棱线大腿甲、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴 + 马刺
    knight(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H);
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 4, H.l1 || 16, H.l2 || 19, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky);
      L(Z.TH, () => { pn.poly(slab(T, -1, T.len, 4.4, 3.6)).paint(M.steel); pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.steel[3]); });
      hub(c, 3.8);
      L(Z.SH, () => {
        pn.poly(B.pts([[0, -3.2], [0, 3.2], [n * 0.6, 3.6], [n, 2.6], [n, -2.6], [n * 0.6, -3.6]])).paint(M.steel);
        pn.ln(...B.p(2, dir * 0.8), ...B.p(n - 1, dir * 0.5), M.steel[3]);
      });
      L(Z.KN, () => {
        pn.poly([[kx, ky - 3.6], [kx + dir * 7, ky - 2], [kx + dir * 6.4, ky + 3.2], [kx, ky + 2]]).paint(M.brass);
        pn.ln(kx + dir * 2, ky - 1, kx + dir * 5.5, ky - 0.5, M.brass[1]);
        ball(pn, M.steel, kx, ky, 3.4);
      });
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.poly([[x - dir * 3.5, y], [x - dir * 3.5, y - 4.4], [x + dir * 1, y - 4.4], [x + dir * 9, y - 0.8], [x + dir * 9.5, y]]).paint(M.steel);
        for (const u of [1.8, 4, 6.2]) pn.ln(x + dir * u, y - 4 + u * 0.38, x + dir * u, y - 0.5, M.steel[1]);
        pn.ln(x - dir * 3.5, y - 2.4, x - dir * 6, y - 3, M.brass[2]); pn.dot(x - dir * 6, y - 3, M.brass[3]);
      });
    },

    // T4 仪表步行机（重做）：人形正膝，膝盖是一只大号压力表（黄铜厚表圈、白表盘、刻度、红区、指针随抬脚摆）——落在腿的半高处，不和车体粘在一起；
    // 大腿是一根带法兰的粗黄铜蒸汽管（顺着一根细导压管到表），小腿是一根粗玻璃液位管（黄铜管帽、水柱随抬脚升降），脚是带三颗调平螺丝的仪器底座
    gauge(c, H) {
      const { pn, M, hx, hy, dir, far, g, L } = c, F = footOf(c, H);
      const [kx, ky, ex, ey] = ik(hx, hy, F[0], F[1] - 4.4, H.l1 || 15, H.l2 || 19, dir);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len, Gl = far ? GLASS.far : GLASS.near;
      L(Z.TH, () => {
        pn.cap(hx, hy, kx, ky, 3).paint(M.brass, { bevel: 'l' });
        for (const a of [T.len * 0.35, T.len * 0.7]) pn.poly(T.pts([[a - 1, -4], [a + 1, -4], [a + 1, 4], [a - 1, 4]])).paint(M.iron);
        pn.ln(...T.p(1, -dir * 3.6), ...T.p(T.len - 3, -dir * 3.4), M.iron[2]);
      });
      hub(c, 3.6);
      L(Z.SH, () => {
        pn.poly(slab(B, 3, n - 3, 3, 3)).paint(Gl, { bevel: 'l' });
        if (!far) {
          const lv = n - 3 - (n - 6) * (0.3 + 0.05 * g.lift);
          pn.poly(slab(B, lv, n - 3.6, 1.6, 1.6)).paint(NEAR.gauge, { outline: false, bevel: '' });
          pn.ln(...B.p(4, -1.8), ...B.p(n - 4, -1.8), P.glass[3]);
        }
        for (const [a0, a1] of [[0, 4], [n - 4, n]]) pn.poly(slab(B, a0, a1, 3.8, 3.8)).paint(M.brass);
      });
      L(Z.KN, () => {
        const R = 6.2;
        pn.disc(kx, ky, R).paint(M.brass);
        pn.disc(kx, ky, R - 1.6).paint(far ? FAR.steam : NEAR.steam, { outline: false, bevel: '' });
        for (let k = 0; k <= 8; k++) { const a = Math.PI * 0.75 + k / 8 * Math.PI * 1.5; pn.dot(kx + Math.cos(a) * (R - 2.4), ky + Math.sin(a) * (R - 2.4), k >= 7 ? P.fire[1] : P.dark[1]); }
        const na = Math.PI * 0.75 + (0.15 + g.lift * 0.08 + (c.o.mv ? 0 : Math.sin((c.t || 0) * 1.5) * 0.05)) * Math.PI * 1.5;
        pn.ln(kx, ky, kx + Math.cos(na) * (R - 2.2), ky + Math.sin(na) * (R - 2.2), far ? P.dark[0] : P.black);
        pn.disc(kx, ky, 1).paint(M.brass, { outline: false });
        pn.rect(kx - 1.2, ky - R - 1.8, 2.4, 2).paint(M.brass);   // 表顶的接管
      });
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.poly([[x - 6.5, y - 1.6], [x - 5, y - 4.4], [x + 5, y - 4.4], [x + 6.5, y - 1.6]]).paint(M.iron);
        for (const u of [-5, 0, 5]) { pn.rect(x + u - 0.8, y - 1.8, 1.6, 1.8).paint(M.brass, { outline: false }); }
        pn.fill(x - 4, y - 3.6, 8, 1, M.brass[2]);
      });
    },

    // T5 汽锤步行机（内史密斯蒸汽锤）：胯上一根耳轴吊着竖直的粗汽缸，活塞杆往下伸到砧形铁脚；抬脚 = 活塞缩回；落脚时缸底喷一口汽
    hammer(c, H) {
      const { pn, M, hx, hy, dir, g, L } = c, F = footOf(c, H);
      const B = bone(hx, hy, F[0], F[1] - 4.6), n = B.len, cyl = 20;
      L(Z.SH, () => pn.cap(...B.p(cyl - 2, 0), ...B.p(n, 0), 1.9).paint(M.steel, { bevel: 'l' }));
      L(Z.TH, () => {
        pn.poly(slab(B, -2, cyl, 4.4, 4.4)).paint(M.steel);
        pn.poly(slab(B, cyl - 1.8, cyl + 1, 5.3, 5.3)).paint(M.iron);
        pn.poly(slab(B, 1, 3.4, 5.3, 5.3)).paint(M.iron);
        band(pn, B, cyl * 0.55, 4.5, M.brass, 0.7);
        pn.ln(...B.p(5, -2.2), ...B.p(cyl - 3, -2.2), M.steel[3]);
        if (pn.hi) for (const a of [2.2, cyl - 0.4]) for (const f of [-4.2, 4.2]) pn.dot(...B.p(a, f), M.brass[3]);
        if (c.o.mv && g.lift < 0.5 && !c.far) { const q = B.p(cyl, dir * -5.6); pn.disc(q[0] - dir * 1.5, q[1] - 1, 1.6).paint(NEAR.steam, { outline: false, bevel: '' }); }
      });
      L(Z.HIP, () => { ball(pn, M.iron, hx, hy, 4.2); pn.disc(hx, hy, 1.6).paint(M.brass, { outline: false }); });   // 耳轴
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.poly([[x - 6.5, y], [x - 5.5, y - 1.8], [x - 2.6, y - 2.6], [x - 4, y - 5], [x + 4, y - 5], [x + 2.6, y - 2.6], [x + 5.5, y - 1.8], [x + 6.5, y]]).paint(M.iron);
      });
      L(Z.AN, () => ball(pn, M.iron, ...B.p(n, 0), 1.8));
    },

    // T5 钟表巨像：大腿是开框（两根边梁，中间一只小齿轮在转），膝盖是一只大齿轮，胫后缘一排棘轮齿，宽脚板：脚跟发条盒、脚尖小齿轮
    clock(c, H) {
      const { pn, M, hx, hy, dir, o, t, L } = c, F = footOf(c, H), K = kneeOf(c, H);
      const rot = (o.mv ? (o.a || 0) + c.ph : t) * dir, B = bone(K[0], K[1], F[0], F[1] - 3.6), n = B.len, T = bone(hx, hy, K[0], K[1]);
      L(Z.TH, () => {
        for (const s of [-2.8, 2.8]) pn.cap(...T.p(0, s), ...T.p(T.len, s * 0.7), 1.1);
        pn.paint(M.iron, { bevel: 'l' });
        gear(pn, ...T.p(T.len * 0.5, 0), 2.4, 6, -rot * 2, M.brass);
      });
      hub(c, 3.6);
      L(Z.SH, () => {
        for (let a = 5; a < n - 3; a += 3.2) pn.poly(B.pts([[a, dir * 2.4], [a + 2.8, dir * 2.4], [a + 2.8, dir * 4.6]]));
        pn.paint(M.iron, { bevel: 'l' });
        pn.poly(slab(B, 0, n, 3, 2.2)).paint(M.iron);
        pn.ln(...B.p(2, 0), ...B.p(n - 1, 0), M.iron[3]);
      });
      L(Z.KN, () => gear(pn, K[0], K[1], 5.6, 11, rot, M.brass, M.iron));
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.poly([[x - 7, y], [x - 6, y - 3.2], [x + 6, y - 3.2], [x + 7, y]]).paint(M.iron);
        ball(pn, M.brass, x - dir * 4.6, y - 3.6, 2.4);
        gear(pn, x + dir * 4.6, y - 3.6, 2.2, 7, rot * 2, M.brass);
      });
    },

    // T5 锚链铁甲：人形正膝，锻铁大腿 + 缠两道锚链箍的小腿，脚是一只船锚——锚冠着地、两只锚爪往上弯
    anchor(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H), A = [F[0], F[1] - 8.5];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 15, H.l2 || 16, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky), x = F[0], y = F[1];
      L(Z.TH, () => { pn.poly(slab(T, -1.5, T.len + 1, 4.4, 3.2)).paint(M.iron); pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.iron[3]); });
      hub(c, 4);
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 3.2, 2.4)).paint(M.iron);
        for (const a of [n * 0.35, n * 0.62]) { pn.poly(slab(B, a - 1.4, a + 1.4, 3.6, 3.6)).paint(M.steel, { bevel: 'l' }); pn.ln(...B.p(a, -2.6), ...B.p(a, 2.6), M.steel[0]); }
      });
      L(Z.KN, () => { ball(pn, M.iron, kx, ky, 3.2); pn.dot(kx, ky, M.brass[3]); });
      L(Z.FT, () => {
        pn.cap(ex, ey, x, y - 1.6, 1.5).paint(M.steel, { bevel: 'l' });
        pn.fill(x - 3, y - 6.2, 6, 1.2, M.steel[1]);
        for (const s of [-1, 1]) {
          pn.cap(x, y - 1.3, x + s * 3.6, y - 1.1, 1.2).cap(x + s * 3.6, y - 1.1, x + s * 5.6, y - 4.2, 1.2);
          pn.poly([[x + s * 7.4, y - 3.2], [x + s * 5.8, y - 7.2], [x + s * 4.2, y - 3.6]]);
        }
        pn.paint(M.steel, { bevel: 'l' });
        pn.disc(x, y - 1.4, 1.4).paint(M.brass, { outline: false });
      });
      L(Z.AN, () => { pn.disc(ex, ey, 2).paint(M.steel); pn.dot(ex, ey, P.dark[0]); });
    },

    // ---- T6 重做 ----
    // T6 哥特圣殿（主线）：大腿是一道飞扶壁（上缘平直、下缘是拱，中间镂一个三叶孔），小腿是一根石砌方柱（每层一道缝、中段一个发光的尖拱龛），
    // 膝上立一座小尖塔（卷叶饰 + 黄铜尖顶），脚是两级台座
    gothic(c, H) {
      const { pn, M, hx, hy, dir, far, t, L } = c, F = footOf(c, H), A = [F[0], F[1] - 4.4];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 19, H.l2 || 22, dir);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len, Lt = T.len, up = -dir;   // up：飞扶壁的上缘在哪一侧
      L(Z.TH, () => {
        const us = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
        pn.poly(us.map(u => T.p(Lt * u, up * 3.4)).concat(us.slice().reverse().map(u => T.p(Lt * u, up * (3.4 - (6.6 - 3.8 * Math.sin(Math.PI * u))))))).paint(M.steel);
        pn.ln(...T.p(1, up * 2.6), ...T.p(Lt - 1, up * 2.6), M.steel[3]);
        const q = T.p(Lt * 0.5, up * 1.8); for (const [dx, dy] of [[0, -0.9], [-0.9, 0.5], [0.9, 0.5]]) pn.dot(q[0] + dx, q[1] + dy, P.dark[0]);
      });
      hub(c, 3.8);
      L(Z.SH, () => {
        pn.poly(slab(B, -1, n, 3.6, 4.4)).paint(M.steel);
        for (let a = 4; a < n - 1; a += 4.2) pn.ln(...B.p(a, -3.6 - a / n * 0.8), ...B.p(a, 3.6 + a / n * 0.8), M.steel[1]);
        const m = B.p(n * 0.5, 0), glow = far ? P.glass[0] : (Math.sin(t * 3 + c.ph) > 0 ? P.glass[3] : P.glass[2]);
        pn.poly([[m[0] - 1.4, m[1] + 3], [m[0] - 1.4, m[1] - 1], [m[0], m[1] - 3], [m[0] + 1.4, m[1] - 1], [m[0] + 1.4, m[1] + 3]]).paint([P.dark[0], glow, glow, glow], { bevel: '' });
      });
      L(Z.KN, () => {
        pn.poly([[kx - 3.4, ky + 1], [kx + 3.4, ky + 1], [kx + 1.6, ky - 5], [kx, ky - 10], [kx - 1.6, ky - 5]]).paint(M.steel);
        for (const v of [-2.5, -5.5]) { pn.dot(kx - 2.2 - v * 0.15, ky + v, M.brass[2]); pn.dot(kx + 2 + v * 0.15, ky + v, M.brass[2]); }
        pn.dot(kx, ky - 10.4, M.brass[3]);
        pn.fill(kx - 3.6, ky + 0.5, 7.2, 1.5, M.brass[1]);
      });
      L(Z.FT, () => { const x = F[0], y = F[1]; pn.rect(x - 7, y - 2.4, 14, 2.4).paint(M.steel); pn.rect(x - 5, y - 4.8, 10, 2.4).paint(M.steel); });
    },

    // T6 天象仪：膝盖是一只浑天仪（外环 + 两道随步伐转的内环 + 以太光核），黄铜粗管大腿、铁柱小腿（刻着星点），脚是一只半球地球仪（经纬线）
    orrery(c, H) {
      const { pn, M, hx, hy, dir, far, o, t, L } = c, F = footOf(c, H), A = [F[0], F[1] - 5];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 15, H.l2 || 19, dir);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len, spin = (o.mv ? (o.a || 0) + c.ph : t) * 1.3;
      L(Z.TH, () => { pn.cap(hx, hy, kx, ky, 3.2).paint(M.brass, { bevel: 'l' }); for (const a of [T.len * 0.25, T.len * 0.6]) band(pn, T, a, 3.6, M.iron, 0.8); });
      hub(c, 3.6);
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 3.2, 2.4)).paint(M.iron);
        for (let a = 4; a < n - 2; a += 3.4) pn.dot(...B.p(a, (Math.round(a) % 2 ? 1 : -1) * 1.2), M.brass[3]);
      });
      L(Z.KN, () => {
        const R = 6;
        pn.disc(kx, ky, R).paint(far ? FAR.dark : NEAR.dark, { bevel: '' });
        ell(pn, kx, ky, R - 0.5, R - 0.5, 0, M.brass[2], M.brass[2]); ell(pn, kx, ky, R - 1.2, R - 1.2, 0, M.brass[1], M.brass[1]);
        const r1 = 0.6 + 4.2 * Math.abs(Math.cos(spin)), r2 = 0.6 + 4.2 * Math.abs(Math.sin(spin * 0.7));
        ell(pn, kx, ky, r1, 4.6, 0.4, M.brass[3], M.brass[1]); ell(pn, kx, ky, 4.6, r2, -0.3, M.brass[3], M.brass[1]);
        pn.disc(kx, ky, 1.3).paint([P.glass[0], P.glass[2], far ? P.glass[1] : P.glass[3], P.white], { outline: false });
      });
      L(Z.FT, () => {
        const x = F[0], y = F[1], R = 5.4, pts = [];
        for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); }
        pn.poly(pts).paint(M.brass);
        pn.ln(x - R + 1, y - 2, x + R - 1, y - 2, M.brass[1]);
        for (const u of [-2.4, 0, 2.4]) pn.ln(x + u, y - Math.sqrt(R * R - u * u) + 1, x + u * 1.2, y - 0.5, M.brass[1]);
      });
      L(Z.AN, () => ball(pn, M.iron, ...A, 1.8));
    },

    // T6 熔炉龙骑（重做）：粗壮的三段龙腿（膝朝前、跗关节朝后），大腿是三块交叠甲片 + 嵌在里面的炉膛，膝前尖刺、跗关节后刺，三爪 + 后爪；脚尖统一朝车头
    dragon(c, H) {
      const { pn, M, hx, hy, far, t, L } = c, F = footOf(c, H), Hk = [F[0] - 4, F[1] - 10];
      const [kx, ky, ex, ey] = ik(hx, hy, Hk[0], Hk[1], H.l1 || 14, H.l2 || 15, 1);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len, x = F[0], y = F[1];
      L(Z.TH, () => {
        pn.poly(slab(T, -2.5, T.len + 1, 5.4, 3.8)).paint(M.steel);
        for (const a of [T.len * 0.3, T.len * 0.62]) pn.poly(T.pts([[a - 0.5, -5], [a + 2.2, -4.2], [a + 2.2, 4.2], [a - 0.5, 5]])).paint(M.steel, { bevel: 'l' });
        if (!far) { const q = T.p(T.len * 0.46, 0), hot = Math.sin(t * 6 + c.ph) > 0; pn.fill(q[0] - 2, q[1] - 1.2, 4, 2.4, P.fire[hot ? 3 : 2]); pn.fill(q[0] - 2, q[1] - 1.2, 4, 1, P.fire[1]); }
      });
      hub(c, 4);
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 3.8, 2.6)).paint(M.iron);
        for (let a = 2.5; a < n - 1; a += 2.8) pn.ln(...B.p(a, -2.6), ...B.p(a + 1.2, 0), M.iron[3]);
        pn.poly([[ex, ey - 1.6], [ex - 7, ey - 3.6], [ex - 1.4, ey + 2]]).paint(M.brass);   // 跗关节后刺
      });
      L(Z.KN, () => { pn.poly([[kx - 1.5, ky - 2], [kx + 7, ky - 6.5], [kx + 2, ky + 1.5]]).paint(M.brass); ball(pn, M.iron, kx, ky, 3.2); });
      L(Z.FT, () => {
        pn.cap(ex, ey, x, y - 2.4, 1.9).paint(M.iron, { bevel: 'l' });
        pn.poly([[ex - 0.5, ey + 3], [ex - 5, y - 0.5], [ex - 3.5, y], [ex + 1.5, ey + 4.5]]).paint(M.leg);   // 后爪
        pn.poly([[x - 1.5, y - 3.2], [x + 7, y - 0.8], [x + 9, y], [x - 1.5, y]]).paint(M.leg);
        pn.poly([[x - 0.5, y - 4.2], [x + 5.4, y - 2.8], [x + 6.8, y - 1.4], [x, y - 1.4]]).paint(M.leg);
        pn.dot(x + 8.4, y - 0.4, M.brass[3]); pn.dot(x + 6.3, y - 1.8, M.brass[3]);
      });
      L(Z.AN, () => ball(pn, M.iron, ex, ey, 2.2));
    },
  };

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
    // T2 熟铁板梁
    girder(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 2, y + 3], [x + 94, y + 3], [x + 92, y + 16], [x + 4, y + 16]]).paint(NEAR.iron);
      pn.fill(x + 3, y + 3, 90, 2, P.iron[1]); pn.fill(x + 4, y + 13, 88, 2, P.iron[1]); pn.fill(x + 4, y + 13, 88, 1, P.iron[0]);
      for (let u = 8; u < 92; u += 12) { if (Math.abs(u - 48) < 8) continue; pn.fill(x + u, y + 5, 1, 8, P.iron[3]); pn.fill(x + u + 1, y + 5, 1, 8, P.iron[0]); }
      if (pn.hi) { rivRow(pn, x, y + 3, 5, 90, 3); rivRow(pn, x, y + 13, 6, 89, 3); } else { for (let u = 6; u < 92; u += 4) { pn.dot(x + u, y + 4, P.iron[4]); pn.dot(x + u, y + 14, P.iron[3]); } }
      pn.disc(x + 48, y + 9, 4.2).paint(NEAR.iron); pn.fill(x + 45, y + 8, 6, 1, P.brass[2]); pn.fill(x + 45, y + 10, 6, 1, P.brass[1]);
    },
    // T3 一战陆地巡洋舰
    landship(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 95, y + 8], [x + 87, y + 19], [x + 9, y + 19], [x + 1, y + 8]]).paint(NEAR.iron);
      pn.fill(x + 2, y + 11, 92, 1, P.iron[0]); pn.fill(x + 2, y + 12, 92, 1, P.iron[3]);
      for (const u of [24, 48, 72]) pn.fill(x + u, y + 4, 1, 7, P.iron[0]);
      if (pn.hi) { rivRow(pn, x, y + 5, 4, 91, 3.5); rivRow(pn, x, y + 14, 12, 84, 3.5); } else { for (let u = 4; u < 93; u += 4) pn.dot(x + u, y + 5, P.iron[4]); for (let u = 12; u < 85; u += 4) pn.dot(x + u, y + 14, P.iron[4]); }
      for (const u of [80, 84, 88]) pn.fill(x + u, y + 7, 2, 1, P.black);
      pn.disc(x + 48, y + 14, 3.4).paint(NEAR.iron); pn.disc(x + 48, y + 14, 1.4).paint(NEAR.dark, { outline: false }); pn.dot(x + 47, y + 13, P.iron[4]);
    },

    // ---- T4 候选 ----
    // A 水晶宫温室：铸铁框 + 一排圆拱玻璃窗，檐口黄铜线，下沿垂一排铸铁吊饰（维多利亚铁艺花边）
    conserv(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 2, y + 3, 92, 13).paint(NEAR.iron);
      pn.fill(x + 3, y + 4, 90, 1, P.brass[2]); pn.fill(x + 3, y + 5, 90, 1, P.brass[1]);
      for (let i = 0; i < 9; i++) {
        const cx = x + 7 + i * 10.25;
        pn.rect(cx - 3.4, y + 9, 6.8, 5).disc(cx, y + 9, 3.4).paint(GLASS.near, { bevel: 'l' });
        pn.fill(cx - 0.5, y + 6.5, 1, 7.5, P.iron[1]); pn.fill(cx - 3.4, y + 10.5, 6.8, 1, P.iron[1]);
      }
      pn.fill(x + 3, y + 14.5, 90, 1.5, P.iron[1]);
      for (let u = 5; u < 93; u += 5.8) { pn.poly([[x + u - 1.4, y + 16], [x + u + 1.4, y + 16], [x + u, y + 19.5]]).paint(NEAR.iron); pn.dot(x + u, y + 20, P.brass[2]); }
    },
    // B 蒸汽游艇：船形车体（下沿是一道弧、船首尖），镀金护舷线、一排黄铜舷窗、船首一道卷草金饰
    yacht(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 96, y + 3], [x + 96, y + 5], [x + 91, y + 12], [x + 82, y + 18], [x + 62, y + 21.5], [x + 32, y + 21.5], [x + 13, y + 18.5], [x + 4, y + 13], [x + 1, y + 9]]).paint(NEAR.steel);
      pn.fill(x + 2, y + 6, 93, 1, P.brass[2]); pn.fill(x + 2, y + 7, 92, 1, P.brass[1]);
      for (const u of [30, 64]) pn.fill(x + u - 6, y + 17, 12, 1, P.iron[1]);
      for (const u of [14, 26, 38, 58, 70, 82]) { pn.disc(x + u, y + 11.5, 2.3).paint(NEAR.brass); pn.disc(x + u, y + 11.5, 1.2).paint(GLASS.near, { outline: false, bevel: '' }); }
      let q0 = null; for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU * 1.1, r = 2.6 * (1 - k / 14), q = [x + 90 + Math.cos(a) * r, y + 9 + Math.sin(a) * r]; if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.5); q0 = q; }
      pn.paint(NEAR.brass, { bevel: '' });
      pn.disc(x + 48, y + 13, 3).paint(NEAR.brass); pn.dot(x + 48, y + 13, P.brass[0]);
    },
    // C 铁路沙龙车厢：镶板车厢 + 圆角窗，两头敞开的车尾平台和黄铜栏杆，车底一副「皇后柱」张拉桁架（拉杆 + 两根短柱 + 花篮螺丝）
    railcar(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 9, y + 3, 78, 12).paint(NEAR.steel);
      for (let i = 0; i < 7; i++) { const u = x + 13 + i * 10.4; pn.rect(u, y + 5.5, 6.4, 5).paint(GLASS.near, { bevel: 'l' }); pn.fill(u, y + 12, 6.4, 1, P.brass[1]); }
      pn.fill(x + 10, y + 4, 76, 1, P.brass[2]); pn.fill(x + 10, y + 13.5, 76, 1, P.iron[1]);
      for (const [a, b] of [[1, 9], [87, 95]]) {
        pn.rect(x + a, y + 13.5, b - a, 2).paint(NEAR.iron);
        pn.fill(x + a, y + 6, b - a, 1, P.brass[2]);
        for (let u = a + 1; u < b; u += 2.4) pn.fill(x + u, y + 6, 1, 7.5, P.brass[1]);
      }
      for (const [a, b] of [[[12, 15.5], [34, 22]], [[34, 22], [62, 22]], [[62, 22], [84, 15.5]]]) pn.cap(x + a[0], y + a[1], x + b[0], y + b[1], 0.7);
      pn.paint(NEAR.iron, { bevel: 'l' });
      for (const u of [34, 62]) pn.rect(x + u - 0.8, y + 15, 1.6, 7).paint(NEAR.iron, { outline: false });
      pn.rect(x + 46, y + 21, 4, 2).paint(NEAR.brass);
    },

    // ---- T5 候选 ----
    // A 铁甲舰炮廓：斜装甲、三扇带盖炮门、下沿一道装甲带和大螺栓，船首下方一只撞角
    ironclad(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 95, y + 14], [x + 92, y + 19], [x + 4, y + 19], [x + 1, y + 14]]).paint(NEAR.iron);
      pn.rect(x + 2, y + 13, 92, 5).paint(NEAR.steel, { bevel: 'l' });
      for (let u = 6; u < 92; u += 8) pn.rect(x + u - 1, y + 14.5, 2.4, 2.4).paint(NEAR.iron, { outline: false, bevel: 'l' });
      for (const u of [34, 48, 62]) { pn.rect(x + u - 3, y + 7, 6, 4.5).paint(NEAR.dark); pn.poly([[x + u - 3.6, y + 7], [x + u + 3.6, y + 7], [x + u + 3, y + 4.2], [x + u - 3, y + 4.2]]).paint(NEAR.steel); }
      pn.poly([[x + 82, y + 18], [x + 95, y + 17], [x + 99, y + 20.5], [x + 95, y + 23], [x + 84, y + 22]]).paint(NEAR.steel);
      pn.disc(x + 82, y + 8, 1.8).paint(NEAR.dark);
    },
    // B 机车锅炉：一整根卧式锅炉（黄铜箍），车头是烟箱（圆门、铰链带、把手），车尾是火箱（火门透着炉火），底下一条走板
    boiler(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 1, y + 3, 14, 17).paint(NEAR.iron);
      const hot = Math.sin((o.t || 0) * 5) > 0; pn.rect(x + 5, y + 10, 6, 5).paint(NEAR.dark); pn.fill(x + 6, y + 11, 4, 3, P.fire[hot ? 3 : 2]);
      pn.cap(x + 22, y + 11, x + 80, y + 11, 8.2).paint(NEAR.steel);
      for (let u = 26; u < 80; u += 11) { pn.fill(x + u, y + 3, 2, 16, P.brass[2]); pn.fill(x + u + 1, y + 3, 1, 16, P.brass[1]); }
      pn.ln(x + 20, y + 6, x + 80, y + 6, P.iron[4]);
      pn.rect(x + 83, y + 3, 12, 16).paint(NEAR.dark);
      pn.disc(x + 89, y + 11, 5.2).paint(NEAR.iron); pn.fill(x + 85, y + 9, 8, 1, P.iron[1]); pn.fill(x + 85, y + 13, 8, 1, P.iron[1]); pn.dot(x + 89, y + 11, P.brass[3]);
      pn.fill(x + 1, y + 19, 94, 2, P.iron[1]); pn.fill(x + 1, y + 19, 94, 1, P.iron[3]);
    },
    // C 鹦鹉螺潜艇：雪茄形铆接艇身，艇首大圆观察窗，底下一排锯齿龙骨，艇尾一只转动的螺旋桨
    nautilus(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.cap(x + 12, y + 10.5, x + 84, y + 10.5, 8).paint(NEAR.iron);
      for (let u = 18; u < 82; u += 8) pn.ln(x + u, y + 4, x + u, y + 17, P.iron[1]);
      for (let u = 18; u <= 78; u += 5) pn.poly([[x + u - 2.2, y + 17], [x + u + 2.2, y + 17], [x + u - 0.4, y + 22.5]]).paint(NEAR.steel);
      for (const u of [30, 40, 56, 66]) { pn.disc(x + u, y + 9, 1.6).paint(NEAR.brass); pn.dot(x + u, y + 9, P.glass[2]); }
      pn.disc(x + 86, y + 10.5, 5).paint(NEAR.brass); pn.disc(x + 86, y + 10.5, 3.4).paint(GLASS.near, { outline: false, bevel: 'l' });
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; pn.ln(x + 86, y + 10.5, x + 86 + Math.cos(a) * 3.4, y + 10.5 + Math.sin(a) * 3.4, P.brass[1]); }
      const r = (o.mv ? (o.a || 0) * 3 : (o.t || 0) * 5);
      for (let k = 0; k < 3; k++) { const a = r + k / 3 * TAU, h = Math.sin(a) * 5; pn.poly([[x + 2.5, y + 10.5], [x + 1.2, y + 10.5 + h], [x + 3.8, y + 10.5 + h]]); }
      pn.paint(NEAR.brass, { bevel: '' });
      pn.disc(x + 3, y + 10.5, 1.6).paint(NEAR.iron);
    },

    // ---- T6 候选 ----
    // A 哥特圣殿：扶壁柱之间一排尖拱彩窗（以太光慢慢流过），正中一扇玫瑰窗，下沿垂一排倒挂的尖拱花边
    gothic(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 1, y + 3, 94, 15).paint(NEAR.iron);
      const t = o.t || 0;
      for (const [i, cx] of [14, 26, 36, 60, 70, 82].entries()) {
        const on = Math.sin(t * 2 - i * 0.8) > 0.3, c1 = i % 2 ? P.glass[on ? 3 : 2] : P.fire[on ? 3 : 2];
        pn.poly([[x + cx - 2.6, y + 16], [x + cx - 2.6, y + 9], [x + cx, y + 5.5], [x + cx + 2.6, y + 9], [x + cx + 2.6, y + 16]]).paint([P.dark[0], c1, c1, c1], { bevel: '' });
        pn.fill(x + cx - 0.5, y + 8, 1, 8, P.dark[0]);
      }
      for (const u of [8, 20, 31, 41, 55, 65, 76, 88]) pn.rect(x + u - 1.4, y + 4, 2.8, 14).paint(NEAR.steel, { bevel: 'l' });
      pn.disc(x + 48, y + 10.5, 6).paint(NEAR.steel);
      const on = 0.5 + 0.5 * Math.sin(t * 1.6);
      pn.disc(x + 48, y + 10.5, 4.4).paint([P.dark[0], P.glass[1], on > 0.5 ? P.glass[3] : P.glass[2], P.white], { outline: false, bevel: 'l' });
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; pn.ln(x + 48, y + 10.5, x + 48 + Math.cos(a) * 4.4, y + 10.5 + Math.sin(a) * 4.4, P.dark[0]); }
      pn.dot(x + 48, y + 10.5, P.brass[3]);
      for (let u = 3; u < 93; u += 6) { let q0 = null; for (let k = 0; k <= 6; k++) { const s = k / 6, q = [x + u + 6 * s, y + 18 + 3 * Math.sin(Math.PI * s)]; if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.55); q0 = q; } }
      pn.paint(NEAR.steel, { bevel: '' });
      for (let u = 3; u <= 93; u += 6) { pn.fill(x + u - 0.5, y + 18, 1, 4, P.iron[3]); pn.dot(x + u, y + 22, P.brass[2]); }
    },
    // B 天象仪：扁平的黄铜星环车体（一排星点），车腹下一座转动的太阳系仪：发光的太阳 + 三根悬臂挑着三颗行星（椭圆轨道、前后遮挡）
    orrery(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 2, y + 3], [x + 94, y + 3], [x + 92, y + 13], [x + 4, y + 13]]).paint(NEAR.iron);
      pn.fill(x + 3, y + 9, 90, 2, P.brass[2]); pn.fill(x + 3, y + 10, 90, 1, P.brass[1]);
      for (let u = 6; u < 92; u += 4) pn.dot(x + u, y + 6, (u / 4) % 3 ? P.brass[2] : P.brass[3]);
      const cx = x + 48, cy = y + 22, t = (o.mv ? (o.a || 0) : (o.t || 0) * 0.8);
      pn.rect(cx - 1, y + 13, 2, 7).paint(NEAR.steel, { outline: false });
      const pl = [[10, 1.4, 2.2, NEAR.steel], [16, 1.9, 1.3, NEAR.brass], [22, 2.4, 0.8, GLASS.near]].map(([R, r, sp, ramp]) => { const a = t * sp; return { R, r, ramp, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.28, back: Math.sin(a) < 0 }; });
      for (const p of pl) for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; if (k % 2) pn.dot(cx + Math.cos(a) * p.R, cy + Math.sin(a) * p.R * 0.28, P.brass[1]); }
      const arm = (p) => { pn.ln(cx, cy - 1, p.x, p.y - p.r - 0.5, P.brass[2]); ball(pn, p.ramp, p.x, p.y, p.r); };
      for (const p of pl) if (p.back) arm(p);
      const hot = 0.5 + 0.5 * Math.sin((o.t || 0) * 3);
      pn.disc(cx, cy, 3.6).paint([P.fire[0], P.fire[1], P.fire[hot > 0.5 ? 3 : 2], P.white]);
      for (const p of pl) if (!p.back) arm(p);
    },
    // C 熔炉龙鳞：车体侧面是一副弯曲的铁肋骨，肋骨之间透出炉火（随呼吸明灭），顶上一排鳞片，下沿一排带黄铜尖的粗尖刺
    furnace(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 93, y + 17], [x + 3, y + 17]]).paint(NEAR.iron);
      const hot = 0.5 + 0.5 * Math.sin((o.t || 0) * 2.6);
      pn.fill(x + 5, y + 7, 86, 8, P.fire[hot > 0.5 ? 2 : 1]); pn.fill(x + 5, y + 10, 86, 3, P.fire[hot > 0.5 ? 3 : 2]);
      for (let u = 6; u < 92; u += 7) { pn.cap(x + u, y + 6, x + u + 2.2, y + 11, 1.3).cap(x + u + 2.2, y + 11, x + u + 1, y + 16, 1.3); }
      pn.paint(NEAR.steel, { bevel: 'l' });
      for (let u = 4; u < 94; u += 5) pn.poly([[x + u - 2.6, y + 3], [x + u + 2.6, y + 3], [x + u, y + 6.6]]).paint(NEAR.iron);
      for (let u = 8; u < 92; u += 8) { pn.poly([[x + u - 3, y + 17], [x + u + 3, y + 17], [x + u, y + 24]]).paint(NEAR.steel); pn.dot(x + u, y + 23.4, P.brass[3]); }
    },
  };
  // 每档的车体候选（T4～T6 重新探索）；SET 里的变体默认用第一种
  const HULL_CANDS = {
    4: [['conserv', 'A 水晶宫温室', '铸铁框 + 一排圆拱玻璃窗，檐口黄铜线，下沿一排铸铁吊饰（1851 水晶宫、维多利亚温室）'],
      ['yacht', 'B 蒸汽游艇', '船形车体：下沿一道弧、船首尖，镀金护舷线、六只黄铜舷窗、船首卷草金饰'],
      ['railcar', 'C 铁路沙龙车厢', '镶板车厢 + 圆角窗，两头敞开的车尾平台和黄铜栏杆，车底一副皇后柱张拉桁架']],
    5: [['ironclad', 'A 铁甲舰炮廓', '斜装甲、三扇带盖炮门、装甲带和大螺栓，船首下方一只撞角（1860 年代铁甲舰）'],
      ['boiler', 'B 机车锅炉', '整根卧式锅炉 + 黄铜箍，车头烟箱（圆门），车尾火箱（炉火），底下走板'],
      ['nautilus', 'C 鹦鹉螺潜艇', '雪茄形铆接艇身、艇首大圆观察窗、锯齿龙骨、艇尾螺旋桨（凡尔纳，1870）']],
    6: [['gothic', 'A 哥特圣殿', '扶壁柱 + 尖拱彩窗（以太光流过），正中玫瑰窗，下沿倒挂尖拱花边（哥特复兴：议会大厦、圣潘克拉斯）'],
      ['orrery', 'B 天象仪', '扁平星环车体，车腹下一座转动的太阳系仪：发光太阳 + 三颗行星（前后遮挡）'],
      ['furnace', 'C 熔炉龙鳞', '侧面一副弯曲铁肋骨、肋间透出炉火，顶上一排鳞片，下沿带黄铜尖的粗尖刺']],
  };

  // 车体的附加层：BACK 画在车体后面（露出车体下沿的部分），FRONT 画在近侧腿前面
  const BACK = {
    bellygear(pn, x, y, o) {   // 钟表巨像：肚子底下半露一只大齿轮 + 两只啮合的小齿轮
      const r = (o.mv ? o.a || 0 : (o.t || 0)) * 0.6;
      gear(pn, x + 48, y + 17, 10, 16, r, NEAR.brass, NEAR.iron);
      gear(pn, x + 34, y + 21, 5, 9, -r * 2 + 0.2, NEAR.brass, NEAR.iron);
      gear(pn, x + 62, y + 21, 5, 9, -r * 2 + 0.2, NEAR.brass, NEAR.iron);
    },
    chains(pn, x, y, o) {      // 锚链铁甲：两个锚链孔之间垂下两段锚链
      const sw = Math.sin((o.t || 0) * 1.6) * 1.2;
      for (const [a, b, sag] of [[30, 66, 12], [36, 60, 7]]) {
        const N = Math.round((b - a) / 2.4);
        for (let i = 0; i <= N; i++) {
          const u = i / N, px = x + a + (b - a) * u + sw * Math.sin(Math.PI * u), py = y + 18 + sag * 4 * u * (1 - u);
          if (i % 2) pn.fill(px - 0.5, py - 1, 1, 2, P.iron[3]); else { pn.disc(px, py, 1.5).paint(NEAR.steel, { bevel: 'l' }); pn.dot(px, py, P.dark[0]); }
        }
      }
      for (const u of [30, 66]) { pn.disc(x + u, y + 17, 2.4).paint(NEAR.steel); pn.dot(x + u, y + 17, P.black); }
    },
  };
  const FRONT = {
    skirt(pn, x, y, o) {       // 裙甲堡：车体下沿垂下一圈钟形铆接熟铁裙甲
      const N = 8, top = y + 14, bot = y + 32;
      for (let i = 0; i < N; i++) {
        const t0 = 4 + i * 88 / N, t1 = 4 + (i + 1) * 88 / N, fl = (u) => 48 + (u - 48) * 1.07;
        pn.poly([[x + t0, top], [x + t1, top], [x + fl(t1), bot - (i % 2 ? 0 : 1.5)], [x + fl(t0), bot - (i % 2 ? 0 : 1.5)]]).paint(i % 2 ? NEAR.iron : NEAR.steel);
        if (pn.hi) { rivet(pn, x + (t0 + t1) / 2 - 1, top + 2); rivet(pn, x + (fl(t0) + fl(t1)) / 2 - 1, bot - 4); } else pn.dot(x + (t0 + t1) / 2, top + 2, P.iron[4]);
      }
      pn.fill(x + 3, top, 90, 2, P.brass[1]); pn.fill(x + 3, top, 90, 1, P.brass[2]);
    },
    shields(pn, x, y, o) {     // 蒸汽圣骑：车体侧面一排骑士风筝盾，尖底垂出车体下沿
      for (const [cx, k] of [[7, 0], [36, 1], [48, 0], [60, 1], [89, 0]]) {
        const pts = [[cx - 4.6, y + 5], [cx + 4.6, y + 5], [cx + 4.6, y + 12], [cx + 2.4, y + 18], [cx, y + 22.5], [cx - 2.4, y + 18], [cx - 4.6, y + 12]].map(([u, v]) => [x + u, v]);
        pn.poly(pts).paint(NEAR.brass);
        pn.poly(pts.map(([u, v]) => [u + (x + cx - u) * 0.26, v + (y + 11 - v) * 0.2])).paint(NEAR.steel, { outline: false });
        if (k) pn.ln(x + cx - 3, y + 7, x + cx + 3, y + 14, P.brass[1], pn.hi ? 2 : 1); else { pn.ln(x + cx - 3, y + 14, x + cx, y + 9, P.brass[1]); pn.ln(x + cx, y + 9, x + cx + 3, y + 14, P.brass[1]); }
      }
    },
  };

  // ---------- 编制（15 种 = 主线 6 + 变体 9） ----------
  // mt 材质档；hull 车体；back / front 车体附加层；leg 腿型；main 主线；kept = 之前采用的
  const SET = [
    { mt: 1, main: true, name: '工装 Mk.II', hull: 'base', leg: 'mk2', ref: '现役伏地蛛 + 双足 T1 工装 Mk.II',
      idea: '现役甲壳不动，腿换成双足 T1 的做法：箱形梁大腿、跨膝液压撑杆（在大腿和小腿之间那一层）、镂空的双支杆小腿、脚尖朝外的带肋平脚。' },
    { mt: 2, main: true, kept: true, name: '桁架爬机', hull: 'girder', leg: 'truss', ref: '维多利亚铁桥 / 格构铁塔',
      idea: '小腿是往下收窄的铆接格构梁（透空），大腿是实心箱梁，铸铁平底靴；车体是一段熟铁板梁。' },
    { mt: 2, name: '裙甲堡', hull: 'girder', front: 'skirt', leg: 'skirt', ref: '双足裙甲堡',
      idea: '车体下沿垂下一圈八块钟形铆接熟铁裙甲，罩住大腿和膝盖，只露出粗护胫和脚尖朝外的铁靴。' },
    { mt: 3, main: true, kept: true, name: '板簧拖车', hull: 'landship', leg: 'leaf', ref: '一战炮兵牵引车',
      idea: '大腿是一叠弓形板簧（中段卡箍），小腿是粗撑杆 + 螺旋减震，脚是带抓地齿的履带板；车体是陆地巡洋舰装甲壳。' },
    { mt: 3, name: '掷弹兵', hull: 'landship', leg: 'gren', ref: '双足掷弹兵',
      idea: '人形正膝，膝盖朝外、落在半高处：铆接圆筒大腿 + 黄铜箍，膝盖是一只压力表，喇叭口护胫、平头重靴，膝后一根蒸汽活塞。' },
    { mt: 3, name: '步行履带', hull: 'landship', leg: 'pedrail', ref: '迪普洛克 Pedrail（1900 年代，一战坦克的前身之一）',
      idea: '膝盖朝里的两段粗支腿，每只脚是一段履带：三只负重轮、履带板随步子走。' },
    { mt: 4, main: true, kept: true, name: '曲柄步行机', hull: 'conserv', leg: 'crank', ref: '切比雪夫步行机 / 维多利亚机械玩具',
      idea: '车体侧面的六辐飞轮在大腿后面转，曲柄销推一根滑槽推杆带动膝盖；抛光粗圆杆小腿、平掌。车体见下面「T4 车体候选」。' },
    { mt: 4, name: '蒸汽圣骑', hull: 'conserv', front: 'shields', leg: 'knight', ref: '双足蒸汽圣骑 · 哥特板甲',
      idea: '人形正膝的哥特板甲腿：棱线大腿甲、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴 + 马刺；车体侧面挂一排五面风筝盾。' },
    { mt: 4, name: '仪表步行机', hull: 'conserv', leg: 'gauge', ref: '维多利亚压力表、玻璃液位计、仪器底座（重做）',
      idea: '膝盖是一只大号压力表（厚表圈、刻度、红区、指针随抬脚摆），落在腿的半高处；大腿是带法兰的粗黄铜蒸汽管 + 导压管，小腿是一根粗玻璃液位管（水柱随抬脚升降），脚是带三颗调平螺丝的仪器底座。' },
    { mt: 5, main: true, kept: true, name: '汽锤步行机', hull: 'ironclad', leg: 'hammer', ref: '内史密斯蒸汽锤',
      idea: '每条腿是一台吊在耳轴上的竖直粗汽缸，活塞杆伸到砧形铁脚，落脚喷汽。车体见下面「T5 车体候选」。' },
    { mt: 5, name: '钟表巨像', hull: 'ironclad', back: 'bellygear', leg: 'clock', ref: '双足钟表巨像 · 塔钟机芯',
      idea: '膝盖是一只十一齿大齿轮，开框大腿里转着小齿轮，胫后缘一排棘轮齿，宽脚板带发条盒和小齿轮；车腹底下半露一组啮合齿轮。' },
    { mt: 5, name: '锚链铁甲', hull: 'ironclad', back: 'chains', leg: 'anchor', ref: '维多利亚铁甲舰的锚与锚链',
      idea: '人形正膝，锻铁大腿、缠两道锚链箍的小腿，每只脚是一只船锚；车腹两个锚链孔之间垂下两段锚链。' },
    { mt: 6, main: true, name: '哥特圣殿', hull: 'gothic', leg: 'gothic', ref: '哥特复兴建筑：飞扶壁、尖塔、彩窗（议会大厦、圣潘克拉斯车站）',
      idea: '车体是一段圣殿中殿：扶壁柱、尖拱彩窗（以太光流过）、玫瑰窗、倒挂的尖拱花边。腿：大腿是一道飞扶壁（下缘是拱、镂三叶孔），小腿是石砌方柱（中段一个发光尖拱龛），膝上立一座小尖塔，脚是两级台座。' },
    { mt: 6, name: '天象仪', hull: 'orrery', leg: 'orrery', ref: '维多利亚太阳系仪（orrery）、浑天仪',
      idea: '车腹下一座转动的太阳系仪（发光太阳 + 三颗行星，前后遮挡）。膝盖是一只浑天仪（外环 + 两道转动的内环 + 以太光核），黄铜粗管大腿、刻星点的铁柱小腿，脚是半球地球仪。' },
    { mt: 6, name: '熔炉龙骑', hull: 'furnace', leg: 'dragon', ref: '双足熔心龙骑（重做：只取鳞、炉火、肋骨、尖刺、爪，不做龙头）',
      idea: '车体侧面一副铁肋骨、肋间透出炉火，下沿一排粗尖刺。腿是粗壮的三段龙腿：大腿三块交叠甲片 + 嵌在里面的炉膛，膝前 / 跗关节各一根黄铜尖刺，三爪 + 后爪，脚尖统一朝车头。' },
  ];
  const LEG_H = { crank: { reach: 4 }, skirt: { reach: 3 }, gren: { reach: 3 }, pedrail: { reach: 2 }, knight: { reach: 2 }, gauge: { reach: 3 }, clock: { up: -1, kx: 11 }, anchor: { reach: 3 }, dragon: { reach: 0 }, gothic: { reach: 3 }, orrery: { reach: 3 } };

  // 机身起伏：对角两腿交替着地（plantGait：一对腿在 u=0.75、另一对在 u=0.25 撑在胯正下方 = 最高；u=0、0.5 双支撑 = 最低），每步两次
  const bobOf = (o) => (o.mv ? Math.round(2 * (1 - Math.abs(Math.sin(o.a || 0)))) : 0);

  // 画一只整件四足到透明画布，坐标 (ox, oy) = 模块左上角。o = { mv, a 步态角, t 秒, stride, top, hull（换车体对照用） }
  function figure(g, ox, oy, e, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const S = o.stride || 13, lo = { mv: !!o.mv, a: o.a || 0, plant: true, plantS: S, plantH: 5 + 0.3 * S };
    const y = oy + bobOf(o), H = { ...(LEG_H[e.leg] || {}), ...(e.H || {}) };
    const ho = { t: o.t || 0, top: !!o.top, mv: !!o.mv, a: o.a || 0 };
    const leg = (M, far, [hx, hy], gy, dir, ph) => {
      const q = [], c = { pn, M, far, hx: ox + hx, hy: y + hy, gy, dir, ph, o: lo, t: o.t || 0, L: (z, fn) => q.push([z, q.length, fn]) };
      c.g = gait(lo, ph, 5, 4);
      LEGS[e.leg](c, H);
      q.sort((a, b) => (far ? b[0] - a[0] : a[0] - b[0]) || a[1] - b[1]);
      for (const [, , fn] of q) fn();
    };
    leg(FAR, true, HIPS.fr, oy + 45, -1, Math.PI); leg(FAR, true, HIPS.ff, oy + 45, 1, 0);
    const hull = o.hull || e.hull;
    if (e.back && !o.hull) BACK[e.back](pn, ox, y, ho);
    HULL[hull](pn, ox, y, ho);
    leg(NEAR, false, HIPS.nr, oy + 48, -1, 0); leg(NEAR, false, HIPS.nf, oy + 48, 1, Math.PI);
    if (e.front && !o.hull) FRONT[e.front](pn, ox, y, ho);
    pn.flush(g);
  }
  return { SET, figure, LEGS, HULL, HULL_CANDS, bobOf };
})();
