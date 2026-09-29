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

  // 常春藤：沿骨骼 a0～a1 绕一根藤（正弦摆动），每隔 step 长一片叶子（左右交替），偶尔一朵小花。绿色是植物本色，不参与材质换色
  const IVY = ['#1c2616', '#2f4024', '#46592f', '#61744a'];   // 压暗的橄榄绿（v6：原来的压力表绿太艳）；饱和度保持在 0.35 以上，否则材质层会把它当金属换色
  const leafRamp = (far, dark) => (far ? [P.black, IVY[0], IVY[0], IVY[1]] : dark ? [IVY[0], IVY[0], IVY[1], IVY[1]] : IVY);
  const leaf = (pn, x, y, s, far) => pn.poly([[x, y], [x + s * 2.2, y - 1.4], [x + s * 2.8, y + 0.4], [x + s * 1, y + 1.4]]).paint(leafRamp(far), { bevel: 'l' });
  function vine(pn, B, a0, a1, amp, ph, far, step) {
    let q0 = B.p(a0, Math.sin(a0 * 0.7 + ph) * amp);
    for (let a = a0 + 1; a <= a1; a += 1) { const q = B.p(a, Math.sin(a * 0.7 + ph) * amp); pn.cap(q0[0], q0[1], q[0], q[1], 0.55); q0 = q; }
    pn.paint(leafRamp(far, 1), { outline: false, bevel: '' });
    let k = 0;
    for (let a = a0 + 1.5; a < a1; a += step, k++) {
      const f = Math.sin(a * 0.7 + ph) * amp, q = B.p(a, f);
      leaf(pn, q[0], q[1], k % 2 ? 1 : -1, far);
      if (!far && k % 4 === 3) pn.dot(q[0] + (k % 2 ? -1 : 1), q[1] - 1, '#c4b27a');
    }
  }

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

    // T3 板簧拖车：大腿是一叠弓形板簧（中段卡箍），小腿是直撑杆 + 螺旋减震，脚是带抓地齿的履带板。
    // 挤压感：着地承重时膝盖往下沉 4.5px，减震弹簧被压短、线圈变密、往两边鼓；板簧被压平。抬脚时弹簧弹回原长、板簧回弓
    leaf(c, H) {
      const { pn, M, hx, hy, g, L } = c, F = footOf(c, H), K0 = kneeOf(c, H);
      const comp = c.o.mv ? Math.max(0, 1 - g.lift / 3) : 0.6, K = [K0[0], K0[1] + 4.5 * comp];
      const B = bone(K[0], K[1], F[0], F[1] - 3.4), n = B.len, T = bone(hx, hy, K[0], K[1]), Lt = T.len;
      const tube = 11, rod = 10, s0 = tube, s1 = Math.max(tube + 4, n - rod), bulge = 3 + 1.8 * comp;
      L(Z.TH, () => {
        for (const [f0, f1, d] of [[0.3, 0.7, 3.6], [0.14, 0.86, 1.8], [0, 1, 0]]) {
          let q0 = null;
          for (let i = 0; i <= 6; i++) { const u = f0 + (f1 - f0) * i / 6, q = T.p(Lt * u, -(2.8 * (1 - 0.75 * comp) * Math.sin(Math.PI * u)) + d); if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.95); q0 = q; }
          pn.paint(M.steel, { bevel: 'l' });
        }
        pn.poly(T.pts([[Lt * 0.5 - 1.3, -3.4], [Lt * 0.5 + 1.3, -3.4], [Lt * 0.5 + 1.3, 5.2], [Lt * 0.5 - 1.3, 5.2]])).paint(M.dark);
      });
      hub(c, 3.6);
      L(Z.SH, () => {
        pn.cap(...B.p(s0 - 1, 0), ...B.p(s1 + 1, 0), 1).paint(M.steel, { bevel: '' });   // 穿过弹簧的导杆
        const N = 5;
        for (let k = 0; k < N; k++) { const a = s0 + 1 + (s1 - s0 - 2) * k / (N - 1); pn.cap(...B.p(a - 1, -bulge), ...B.p(a + 1, bulge), 0.85); }
        pn.paint(M.steel, { bevel: 'l' });
        pn.cap(...B.p(0, 0), ...B.p(s0, 0), 2.7).paint(M.iron, { bevel: 'l' });
        pn.cap(...B.p(s1, 0), ...B.p(n, 0), 1.9).paint(M.steel, { bevel: 'l' });
        for (const a of [s0, s1]) pn.poly(slab(B, a - 0.9, a + 0.9, 3.9, 3.9)).paint(M.brass, { bevel: 'l' });   // 弹簧座
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

    // T4 曲柄步行机（温室）：夸张的高膝——膝盖最高点超出车体顶板约 24px（半个底盘高），像温室里爬满藤的铁架。
    // 车体侧面的六辐飞轮在大腿后面转，曲柄销推一根滑槽推杆去带大腿；大腿、小腿都缠着常春藤（叶子、几朵小花），膝上垂下几缕藤蔓随风摆；平掌
    crank(c, H) {
      const { pn, M, hx, hy, dir, o, far, t, L } = c, F = footOf(c, H), g = c.g;
      const K = [hx + dir * (H.kx || 7) + g.x * 0.3, hy - (H.up || 34) - g.lift * 0.3];
      const A = (o.mv ? (o.a || 0) + c.ph : (t || 0) * 1.2) * dir, C = [hx - dir * 11, hy + 1], R = 5.6, Pn = [C[0] + Math.cos(A) * 3.8, C[1] + Math.sin(A) * 3.8];
      const T = bone(hx, hy, K[0], K[1]), B = bone(K[0], K[1], F[0], F[1] - 3.6), Mid = T.p(T.len * 0.3, 0);
      L(Z.DRV, () => {
        pn.disc(C[0], C[1], R).paint(M.brass);
        pn.disc(C[0], C[1], R - 1.4).paint(M.dark, { outline: false, bevel: '' });
        for (let k = 0; k < 6; k++) { const a = A + k / 6 * TAU; pn.ln(C[0], C[1], C[0] + Math.cos(a) * (R - 1.2), C[1] + Math.sin(a) * (R - 1.2), M.brass[2]); }
        ball(pn, M.brass, C[0], C[1], 1.4);
      });
      L(Z.TH, () => {
        pn.poly(slab(T, -1.5, T.len + 1.5, 3.4, 2.6)).paint(M.steel); pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.steel[3]);
        vine(pn, T, 4, T.len - 3, 2.2, 0.4 + c.ph, far, 6);
      });
      hub(c, 3.6);
      L(Z.LNK, () => {
        pn.cap(...Pn, ...Mid, 1.1).paint(M.iron, { bevel: 'l' });
        if (pn.hi) { const Rr = bone(Pn[0], Pn[1], Mid[0], Mid[1]); pn.ln(...Rr.p(Rr.len * 0.4, 0), ...Rr.p(Rr.len * 0.85, 0), M.dark[0]); }
        ball(pn, M.iron, Pn[0], Pn[1], 1.5); ball(pn, M.brass, Mid[0], Mid[1], 1.2);
      });
      L(Z.SH, () => {
        pn.poly(slab(B, 0, B.len, 2.8, 2)).paint(M.steel);
        pn.ln(...B.p(1, -1), ...B.p(B.len - 1, -0.8), M.steel[3]);
        for (const a of [B.len * 0.3, B.len * 0.62]) band(pn, B, a, 3.1, M.brass, 0.8);
        vine(pn, B, 4, B.len * 0.7, 2.4, 2 + c.ph, far, 6.5);
      });
      L(Z.KN, () => {
        ball(pn, M.steel, K[0], K[1], 3.4);
        for (const [dx, len, ph] of [[1.8, 10, 1.3]]) {   // 膝上垂下的藤
          const sw = Math.sin(t * 2 + ph + c.ph) * 1.2; let q0 = [K[0] + dx * dir, K[1] + 1];
          for (let i = 1; i <= 4; i++) { const u = i / 4, q = [K[0] + dx * dir + sw * u * u, K[1] + 1 + len * u]; pn.cap(q0[0], q0[1], q[0], q[1], 0.45); q0 = q; }
          pn.paint(leafRamp(far, 1), { outline: false, bevel: '' });
          for (let i = 1; i <= 2; i++) { const u = i / 2.4; leaf(pn, K[0] + dx * dir + sw * u * u + (i % 2 ? 1 : -1), K[1] + 1 + len * u, i % 2 ? 1 : -1, far); }
        }
      });
      L(Z.FT, () => { const ex = F[0], ey = F[1] - 3.6; pn.poly([[ex - 6, ey + 3.6], [ex - 5, ey + 0.4], [ex + 5, ey + 0.4], [ex + 6.5, ey + 3.6]]).paint(M.iron); pn.fill(ex - 3.5, ey + 1.4, 7, 1, M.brass[2]); });
      L(Z.AN, () => ball(pn, M.brass, F[0], F[1] - 3.6, 1.6));
    },

    // T4 蒸汽圣骑（龟足）：更粗的龟足柱腿，纹路改成盔甲——大腿是三片分节甲片（每片一道棱、两端铆钉），小腿是一摞往下张开的分节胫甲（一片压一片、中间一道脊线、黄铜铆钉），
    // 膝上大圆护膝 + 扇翼，脚是圆厚的龟足垫 + 三枚钝甲。剪影：四根粗壮的盔甲柱 + 圆脚，配车体侧面一排风筝盾
    knight(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H), A = [F[0], F[1] - 5];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 14, H.l2 || 18, dir);
      const B = bone(kx, ky, ex, ey), n = B.len, T = bone(hx, hy, kx, ky);
      L(Z.TH, () => {
        pn.poly(slab(T, -2.5, T.len + 1, 6.2, 5.2)).paint(M.steel);
        for (const u of [0.3, 0.62]) { const a = T.len * u; pn.ln(...T.p(a, -6), ...T.p(a, 6), M.steel[0]); pn.ln(...T.p(a + 1, -5.6), ...T.p(a + 1, 5.6), M.steel[3]); }
        pn.ln(...T.p(0, 0), ...T.p(T.len, 0), M.steel[3]);
      });
      hub(c, 4.4);
      L(Z.SH, () => {
        pn.poly(slab(B, -1, n, 5.4, 7)).paint(M.steel);
        for (let a = 2.5; a < n - 1; a += 3.4) {   // 分节胫甲：每一片的下沿暗线 + 上沿亮线 + 两端铆钉
          const w = 5.4 + 1.6 * a / n;
          pn.ln(...B.p(a, -w), ...B.p(a, w), M.steel[0]); pn.ln(...B.p(a + 0.9, -w + 0.4), ...B.p(a + 0.9, w - 0.4), M.steel[3]);
          for (const s of [-1, 1]) pn.dot(...B.p(a + 1.8, s * (w - 1.3)), M.brass[3]);
        }
        pn.ln(...B.p(0, 0), ...B.p(n - 1, 0), M.steel[3]);
        band(pn, B, 0.5, 5.8, M.brass, 0.9);
      });
      L(Z.KN, () => {
        pn.poly([[kx, ky - 4], [kx + dir * 7.5, ky - 2.8], [kx + dir * 6.8, ky + 2.6], [kx, ky + 2]]).paint(M.brass);
        pn.ln(kx + dir * 2, ky - 1.5, kx + dir * 6.5, ky - 1, M.brass[1]);
        ball(pn, M.steel, kx, ky, 4.6); pn.disc(kx, ky, 2).paint(M.steel, { outline: false, bevel: 's' }); pn.dot(kx, ky, M.brass[3]);
      });
      L(Z.FT, () => {
        const x = F[0], y = F[1], pts = [];
        for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI; pts.push([x + Math.cos(a) * 8, y + Math.sin(a) * 5.8]); }
        pn.poly(pts).paint(M.steel);
        pn.fill(x - 7, y - 1.6, 14, 1, M.steel[1]);
        for (const u of [2.4, 4.8, 7]) pn.disc(x + dir * u, y - 1, 1.2).paint(M.brass, { outline: false, bevel: 'l' });
      });
    },

    // T4 螳臂步行机（替换仪表步行机）：以螳螂腿为灵感——高膝，大腿是一片带棱线的三角甲板、下缘一排倒刺，
    // 小腿是一把长长的刀形胫甲，越往下越细，末端就是脚：一根锋利的钢尖（黄铜箍 + 一根后刺），只用尖点着地。强调尖脚
    mantis(c, H) {
      const { pn, M, hx, hy, dir, L } = c, F = footOf(c, H), K = kneeOf(c, H), inn = -dir;
      const T = bone(hx, hy, K[0], K[1]), B = bone(K[0], K[1], F[0], F[1]), n = B.len;
      L(Z.TH, () => {
        for (let a = 3; a < T.len - 2; a += 3) pn.poly(T.pts([[a, inn * 3.2], [a + 1.8, inn * 3.2], [a + 0.6, inn * 6]]));
        pn.paint(M.steel, { bevel: 'l' });
        pn.poly(T.pts([[-1.5, -4.2], [-1.5, 4.2], [T.len * 0.55, 5], [T.len + 1.5, 3], [T.len + 1.5, -3], [T.len * 0.55, -3.8]])).paint(M.steel);
        pn.ln(...T.p(1, 0), ...T.p(T.len - 1, 0), M.steel[3]);
      });
      hub(c, 3.8);
      L(Z.SH, () => {
        pn.poly(B.pts([[-1, -4.4], [-1, 4.4], [n * 0.35, 4], [n * 0.72, 2.6], [n * 0.9, 1.2], [n, 0], [n * 0.9, -1], [n * 0.72, -2], [n * 0.35, -3.2]])).paint(M.steel);
        pn.ln(...B.p(1, -0.6), ...B.p(n - 3, -0.3), M.steel[3]);
        band(pn, B, n * 0.2, 4.2, M.brass, 0.8);
        pn.poly(B.pts([[n * 0.6, dir * 2.4], [n * 0.68, dir * 2], [n * 0.52, dir * 6.4]])).paint(M.steel);   // 胫上后刺
        band(pn, B, n * 0.8, 2, M.brass, 0.7);
        pn.dot(...B.p(n - 0.5, 0), M.steel[3]);
      });
      L(Z.KN, () => { pn.poly([[K[0], K[1] - 2.2], [K[0] + dir * 6.5, K[1] - 3], [K[0], K[1] + 2]]).paint(M.steel); ball(pn, M.iron, K[0], K[1], 3.2); pn.dot(K[0], K[1], M.brass[3]); });
    },

    // T5 汽锤步行机（内史密斯蒸汽锤）：胯上耳轴吊着一只更粗的竖直汽缸，缸底伸出两根并排的活塞杆（中间镂空），下端一只十字头连着砧形铁脚。
    // 走路姿势：着地的半个周期里锤头连续砸地三下（铁脚抬起 2.5px 再砸下，每砸一下缸底喷一口汽）；抬脚 = 活塞缩回
    hammer(c, H) {
      const { pn, M, hx, hy, dir, g, o, L } = c, F = footOf(c, H);
      let strike = 0, hit = false;
      if (o.mv && g.lift === 0) { const u = ((((o.a || 0) + c.ph) / TAU) % 1 + 1) % 1, w = (u - 0.5) * 2, s = Math.abs(Math.sin(w * Math.PI * 3)); strike = 2.5 * s; hit = s < 0.3; }
      F[1] -= strike;
      const B = bone(hx, hy, F[0], F[1] - 5.2), n = B.len, cyl = 19;
      L(Z.SH, () => {
        for (const f of [-2.6, 2.6]) pn.cap(...B.p(cyl - 1, f), ...B.p(n - 1, f), 1.15);
        pn.paint(M.steel, { bevel: 'l' });
        pn.poly(slab(B, n - 2.4, n + 0.6, 4.2, 4.2)).paint(M.iron);   // 十字头
      });
      L(Z.TH, () => {
        pn.poly(slab(B, -2.5, cyl, 5.8, 5.8)).paint(M.steel);
        pn.poly(slab(B, cyl - 2, cyl + 1, 6.8, 6.8)).paint(M.iron);
        pn.poly(slab(B, 1, 3.6, 6.8, 6.8)).paint(M.iron);
        for (const a of [cyl * 0.45, cyl * 0.72]) band(pn, B, a, 5.9, M.brass, 0.7);
        pn.ln(...B.p(5, -3), ...B.p(cyl - 3, -3), M.steel[3]);
        if (pn.hi) for (const a of [2.3, cyl - 0.5]) for (const f of [-5.6, 5.6]) pn.dot(...B.p(a, f), M.brass[3]);
        if (hit && !c.far) { const q = B.p(cyl + 1, dir * -7); pn.disc(q[0] - dir * 1.5, q[1] - 1, 1.8).paint(NEAR.steam, { outline: false, bevel: '' }); pn.disc(q[0] - dir * 3.2, q[1] - 2.6, 1.2).paint(NEAR.steam, { outline: false, bevel: '' }); }
      });
      L(Z.HIP, () => { ball(pn, M.iron, hx, hy, 4.8); pn.disc(hx, hy, 1.8).paint(M.brass, { outline: false }); });   // 耳轴
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.poly([[x - 7.5, y], [x - 6.5, y - 2], [x - 3, y - 2.8], [x - 4.6, y - 5.4], [x + 4.6, y - 5.4], [x + 3, y - 2.8], [x + 6.5, y - 2], [x + 7.5, y]]).paint(M.iron);
        if (hit && strike < 0.8 && !c.far) { pn.dot(x - 8.5, y - 0.5, P.steam[1]); pn.dot(x + 8.5, y - 0.5, P.steam[1]); }
      });
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
    // T6 哥特教堂（主线）：大腿是一道飞扶壁（上缘平直、下缘是拱，中间镂一个三叶孔），小腿是一根石砌方柱（每层一道缝、中段一个发光的尖拱龛），
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

    // T6 大本钟（替换天象仪）：以威斯敏斯特钟楼为灵感的厚重建筑腿——大腿是一段方形塔身（凹槽 + 镀金箍），膝盖是一座方钟亭（金框、白钟面、指针在走），
    // 小腿是往下加粗的塔身（垂直式哥特窗格：竖棂 + 横档），脚是三级台座
    bigben(c, H) {
      const { pn, M, hx, hy, dir, far, t, L } = c, F = footOf(c, H), A = [F[0], F[1] - 5.8];
      const [kx, ky, ex, ey] = ik(hx, hy, A[0], A[1], H.l1 || 15, H.l2 || 19, dir);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len;
      L(Z.TH, () => {
        pn.poly(slab(T, -1.5, T.len, 4.6, 4)).paint(M.steel);
        pn.ln(...T.p(1.5, 0), ...T.p(T.len - 2, 0), M.steel[1]);
        band(pn, T, 1.5, 4.8, M.brass, 0.8);
      });
      hub(c, 4);
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 4.4, 5.4)).paint(M.steel);
        for (const f of [-2, 2]) pn.ln(...B.p(2, f), ...B.p(n - 1, f * 1.15), M.steel[1]);
        for (let a = 4; a < n - 1; a += 4) pn.ln(...B.p(a, -4.4 - a / n), ...B.p(a, 4.4 + a / n), M.brass[1]);
      });
      L(Z.KN, () => {
        pn.rect(kx - 5, ky - 5, 10, 10).paint(M.steel);
        pn.fill(kx - 4, ky - 4, 8, 1, M.brass[2]); pn.fill(kx - 4, ky + 3, 8, 1, M.brass[1]);
        pn.disc(kx, ky, 3.4).paint(M.brass);
        pn.disc(kx, ky, 2.5).paint(far ? FAR.steam : NEAR.steam, { outline: false, bevel: '' });
        const mA = t * 2 - Math.PI / 2, hA = t * 0.17 + 1;
        pn.ln(kx, ky, kx + Math.cos(mA) * 2.2, ky + Math.sin(mA) * 2.2, P.dark[0]); pn.ln(kx, ky, kx + Math.cos(hA) * 1.4, ky + Math.sin(hA) * 1.4, P.dark[0]);
      });
      L(Z.FT, () => {
        const x = F[0], y = F[1];
        pn.rect(x - 7.5, y - 2.4, 15, 2.4).paint(M.steel); pn.rect(x - 6, y - 4.4, 12, 2).paint(M.steel); pn.rect(x - 4.5, y - 6, 9, 1.6).paint(M.steel);
        pn.fill(x - 6, y - 4.4, 12, 1, M.brass[1]);
      });
    },

    // T6 铁鳞龙骑（v8 重做，不再有透火）：粗壮的三段龙腿（膝朝前、跗关节朝后，脚尖统一朝车头）。
    // 大腿是三片带中脊的厚甲板上压下（每片在下一片上投一道阴影），膝上一块厚膝甲 + 一根粗角刺，小腿两片甲 + 跗关节后刺，
    // 跖骨粗短，脚是三根粗弯爪 + 一根后爪、爪根有指节垫
    dragon(c, H) {
      const { pn, M, hx, hy, L } = c, F = footOf(c, H), Hk = [F[0] - 6, F[1] - 12.5];
      const [kx, ky, ex, ey] = ik(hx, hy, Hk[0], Hk[1], H.l1 || 16, H.l2 || 13, 1);
      const T = bone(hx, hy, kx, ky), B = bone(kx, ky, ex, ey), n = B.len, x = F[0], y = F[1];
      const lame = (Bn, a0, a1, w0, w1, R) => {   // 一片厚甲：先投影、再甲面、再中脊和两颗粗糙斑点
        pn.poly(slab(Bn, a0 + 1.4, a1 + 1.4, w0, w1)).paint(DSH, { outline: false, bevel: '' });
        pn.poly(slab(Bn, a0, a1, w0, w1)).paint(R);
        pn.ln(...Bn.p(a0 + 0.8, 0), ...Bn.p(a1 - 1, 0), R[3]);
        pn.dot(...Bn.p((a0 + a1) / 2, w0 * 0.5), R[1]); pn.dot(...Bn.p(a0 + 1.5, -w0 * 0.55), R[1]);
      };
      L(Z.TH, () => {
        pn.poly(slab(T, -3, T.len + 1, 7.4, 5.4)).paint(M.steel);
        const Lt = T.len;
        for (const [a0, a1, w0, w1] of [[Lt * 0.62, Lt + 1, 6, 5.4], [Lt * 0.3, Lt * 0.7, 6.8, 6.2], [-3, Lt * 0.38, 7.6, 7]]) lame(T, a0, a1, w0, w1, M.steel);
        pn.ln(...T.p(0, 6.6), ...T.p(Lt, 4.6), M.steel[3]);   // 前缘亮边
      });
      hub(c, 4.6);
      L(Z.SH, () => {
        pn.poly(slab(B, 0, n, 5.2, 3.8)).paint(M.steel);
        for (const [a0, a1, w0, w1] of [[n * 0.5, n, 4.6, 3.8], [0, n * 0.56, 5.4, 4.8]]) lame(B, a0, a1, w0, w1, M.steel);
        pn.ln(...B.p(1, 4.6), ...B.p(n - 1, 3.4), M.steel[3]);   // 前缘亮边
        pn.poly([[ex - 1, ey - 2.4], [ex - 8.5, ey - 4], [ex - 7.5, ey - 2.6], [ex - 1.4, ey + 2.4]]).paint(M.steel);   // 跗关节后刺（粗）
      });
      L(Z.KN, () => {
        pn.poly([[kx - 2.4, ky - 2.4], [kx + 4, ky - 6], [kx + 9, ky - 8.5], [kx + 7, ky - 4.5], [kx + 3, ky + 2]]).paint(M.steel);   // 膝角
        pn.ln(kx + 1, ky - 2, kx + 7.5, ky - 7, M.steel[3]);
        pn.disc(kx, ky, 4.4).paint(M.steel); pn.ln(kx - 2.6, ky - 1.5, kx + 2.4, ky - 2.8, M.steel[3]); pn.dot(kx - 1, ky + 1.5, M.steel[1]);
      });
      L(Z.FT, () => {
        pn.cap(ex, ey, x, y - 3, 2.8).paint(M.steel, { bevel: 'l' });
        pn.ln(ex + 1.5, ey, x + 1.5, y - 4, M.steel[3]);
        const claw = (pts, r0) => { for (let k = 1; k < pts.length; k++) pn.cap(...pts[k - 1], ...pts[k], r0 - k * 0.45); };
        claw([[x + 0.5, y - 3.4], [x + 4.5, y - 4.2], [x + 8, y - 2.4], [x + 9.4, y]], 2);
        claw([[x, y - 4.2], [x + 3, y - 6.4], [x + 6, y - 6], [x + 7.2, y - 3.6]], 1.8);
        claw([[x - 0.5, y - 3], [x - 3.6, y - 3.4], [x - 6, y - 1.6], [x - 6.6, y]], 1.8);
        pn.paint(M.iron, { bevel: 'l' });
        for (const [u, v] of [[9.2, -0.4], [7.2, -3.8], [-6.5, -0.4]]) pn.dot(x + u, y + v, M.steel[3]);
        for (const u of [2.2, 5.6]) pn.dot(x + u, y - 1.2, M.leg[1]);   // 指节垫下的暗缝
        ball(pn, M.iron, x, y - 3.4, 2.4);
      });
      L(Z.AN, () => { ball(pn, M.iron, ex, ey, 3); pn.dot(ex - 1, ey - 1, M.iron[3]); });
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
        if (i % 3 === 1) { pn.fill(cx - 2.5, y + 12.5, 5, 1.5, IVY[1]); pn.dot(cx - 1.5, y + 11.5, IVY[2]); pn.dot(cx + 1, y + 11.5, IVY[2]); }   // 窗里的盆栽
      }
      pn.fill(x + 3, y + 14.5, 90, 1.5, P.iron[1]);
      for (let u = 5; u < 93; u += 5.8) { pn.poly([[x + u - 1.4, y + 16], [x + u + 1.4, y + 16], [x + u, y + 19.5]]).paint(NEAR.iron); pn.dot(x + u, y + 20, P.brass[2]); }
      for (const [u, len] of [[40, 7], [86, 6]]) {   // 檐下垂下的常春藤
        const sw = Math.sin((o.t || 0) * 2 + u) * 0.8;
        pn.ln(x + u, y + 16, x + u + sw, y + 16 + len, IVY[1]);
        for (let i = 3; i < len; i += 3.5) leaf(pn, x + u + sw * i / len, y + 16 + i, (i | 0) % 2 ? 1 : -1, false);
      }
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
    // A 哥特教堂：石砌立面，扶壁柱顶上各一枚金十字，两侧尖拱彩窗（以太光慢慢流过），正中一段凸出的门楼：上面玫瑰窗、下面一道尖拱木门（铁铰链），
    // 下沿垂一排倒挂的尖拱花边；进游戏时配两面下垂的旗帜（FRONT.banners）遮住胯部
    gothic(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 1, y + 3, 94, 15).paint(NEAR.iron);
      for (let r = 6; r < 17; r += 3.5) pn.fill(x + 2, y + r, 92, 1, P.iron[1]);   // 石缝
      const t = o.t || 0;
      for (const [i, cx] of [14, 26, 70, 82].entries()) {
        const on = Math.sin(t * 2 - i * 0.8) > 0.3, c1 = i % 2 ? P.glass[on ? 3 : 2] : P.fire[on ? 3 : 2];
        pn.poly([[x + cx - 2.8, y + 16], [x + cx - 2.8, y + 9], [x + cx, y + 5.5], [x + cx + 2.8, y + 9], [x + cx + 2.8, y + 16]]).paint([P.dark[0], c1, c1, c1], { bevel: '' });
        pn.fill(x + cx - 0.5, y + 8, 1, 8, P.dark[0]); pn.fill(x + cx - 2.8, y + 12, 5.6, 1, P.dark[0]);
      }
      for (const u of [8, 20, 32, 64, 76, 88]) { pn.rect(x + u - 1.6, y + 4, 3.2, 14).paint(NEAR.steel, { bevel: 'l' }); pn.fill(x + u - 0.5, y + 4.5, 1, 3, P.brass[2]); pn.fill(x + u - 1.5, y + 5.5, 3, 1, P.brass[2]); }
      // 门楼
      pn.rect(x + 37, y + 3, 22, 16).paint(NEAR.steel);
      pn.fill(x + 38, y + 4, 20, 1, P.brass[2]);
      const on = 0.5 + 0.5 * Math.sin(t * 1.6);
      pn.disc(x + 48, y + 8.5, 4.2).paint(NEAR.iron);
      pn.disc(x + 48, y + 8.5, 3).paint([P.dark[0], P.glass[1], on > 0.5 ? P.glass[3] : P.glass[2], P.white], { outline: false, bevel: 'l' });
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; pn.ln(x + 48, y + 8.5, x + 48 + Math.cos(a) * 3, y + 8.5 + Math.sin(a) * 3, P.dark[0]); }
      pn.poly([[x + 44.5, y + 19], [x + 44.5, y + 15], [x + 48, y + 12.8], [x + 51.5, y + 15], [x + 51.5, y + 19]]).paint(NEAR.leather, { bevel: 'l' });
      pn.fill(x + 47.5, y + 14, 1, 5, P.black); pn.fill(x + 45, y + 15.5, 2, 1, P.iron[3]); pn.fill(x + 49, y + 15.5, 2, 1, P.iron[3]);
      for (let u = 3; u < 93; u += 6) { if (u > 36 && u < 58) continue; let q0 = null; for (let k = 0; k <= 6; k++) { const s = k / 6, q = [x + u + 6 * s, y + 18 + 3 * Math.sin(Math.PI * s)]; if (q0) pn.cap(q0[0], q0[1], q[0], q[1], 0.55); q0 = q; } }
      pn.paint(NEAR.steel, { bevel: '' });
      for (let u = 3; u <= 93; u += 6) { if (u > 36 && u < 60) continue; pn.fill(x + u - 0.5, y + 18, 1, 4, P.iron[3]); pn.dot(x + u, y + 22, P.brass[2]); }
    },
    // B 大本钟：威斯敏斯特钟楼式的厚重石砌车体——垂直式哥特窗格（竖棂 + 横档 + 镀金檐带），正中一只大钟面（金框、罗马刻度、指针在走），
    // 两侧各一块小钟面，下沿一排粗壮的挑檐托石
    bigben(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.rect(x + 1, y + 3, 94, 17).paint(NEAR.steel);
      pn.fill(x + 2, y + 4, 92, 1, P.brass[2]); pn.fill(x + 2, y + 5, 92, 1, P.brass[1]);
      for (let u = 4; u < 93; u += 4) { if (u > 34 && u < 62) continue; pn.fill(x + u, y + 6, 1, 11, P.iron[1]); }
      for (const r of [9.5, 13.5]) { pn.fill(x + 2, y + r, 32, 1, P.brass[1]); pn.fill(x + 62, y + r, 32, 1, P.brass[1]); }
      pn.fill(x + 2, y + 17, 92, 1.5, P.iron[1]);
      const t = o.t || 0, clock = (cx, cy, R) => {
        pn.rect(cx - R - 1.5, cy - R - 1.5, R * 2 + 3, R * 2 + 3).paint(NEAR.iron);
        pn.disc(cx, cy, R).paint(NEAR.brass);
        pn.disc(cx, cy, R - 1.3).paint(NEAR.steam, { outline: false, bevel: '' });
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; pn.dot(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2), k % 3 ? P.dark[3] : P.dark[0]); }
        const mA = t * 2 - Math.PI / 2, hA = t * 0.17 + 1;
        pn.ln(cx, cy, cx + Math.cos(mA) * (R - 2), cy + Math.sin(mA) * (R - 2), P.brass[0]); pn.ln(cx, cy, cx + Math.cos(hA) * (R - 3.2), cy + Math.sin(hA) * (R - 3.2), P.brass[0]);
        pn.dot(cx, cy, P.brass[3]);
      };
      clock(x + 48, y + 11.5, 7);
      for (let u = 4; u <= 92; u += 6) pn.rect(x + u - 1.6, y + 20, 3.2, 2.8).paint(NEAR.steel, { bevel: 'l' });
    },
    // C 铁鳞龙骑车体（v8）：没有火光——车体本身只露出顶板下一条厚边和两头的角板，其余被裙板（龙鳞裙板三方案之一）盖住
    drake(pn, x, y, o) {
      deck(pn, x, y, o);
      pn.poly([[x + 1, y + 3], [x + 95, y + 3], [x + 93, y + 18], [x + 3, y + 18]]).paint(NEAR.iron);
      pn.fill(x + 2, y + 3, 92, 1.5, P.iron[1]);
      for (const [a, s] of [[2, 1], [94, -1]]) pn.poly([[x + a, y + 3], [x + a + s * 6, y + 3], [x + a + s * 2, y + 14]]).paint(NEAR.steel);   // 两头的角板
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
    6: [['gothic', 'A 哥特教堂', '石砌立面 + 扶壁柱顶金十字，尖拱彩窗（以太光流过），正中门楼：玫瑰窗 + 尖拱木门，下沿倒挂尖拱花边（主线另配两面胯位燕尾旗）'],
      ['bigben', 'B 大本钟', '威斯敏斯特钟楼式厚重石砌车体：垂直式哥特窗格、镀金檐带，正中大钟面（指针在走），下沿一排粗挑檐托石'],
      ['drake', 'C 铁鳞龙骑', '厚边车体 + 龙脊甲裙板（三种裙板见「铁鳞龙骑 · 车体裙板」），没有透火，全是有厚度的甲片', 'spine']],
  };

  // 车体的附加层：BACK 画在车体后面（露出车体下沿的部分），FRONT 画在近侧腿前面
  const BACK = {
    // 锚链铁甲：两根锚链——前面一根短的吊在锚链孔下晃（走路时往后甩），车腹正中一根长的垂到地面、只拖一小截（四节）。
    // o.trail：1 = 前进（拖在车后，左边），-1 = 后退（拖到车前），中间值 = 正在换边
    drag(pn, x, y, o) {
      const s = o.trail == null ? 1 : o.trail, g = o.gy - 1, t = o.t || 0, jit = o.mv ? Math.sin((o.a || 0) * 4) * 0.4 : 0;
      const link = (px, py, i) => { if (i % 2) pn.fill(px - 0.5, py - 1, 1, 2, P.iron[3]); else { pn.disc(px, py, 1.5).paint(NEAR.steel, { bevel: 'l' }); pn.dot(px, py, P.dark[0]); } };
      const H0 = [x + 44, y + 19], pts = [];
      for (let k = 0; k <= 11; k++) { const u = k / 11, cc = [H0[0] - s * 3, g - 4], b = [H0[0] - s * 9, g]; pts.push([(1 - u) ** 2 * H0[0] + 2 * u * (1 - u) * cc[0] + u * u * b[0], (1 - u) ** 2 * H0[1] + 2 * u * (1 - u) * cc[1] + u * u * b[1]]); }
      for (let k = 1; k <= 4; k++) pts.push([H0[0] - s * (9 + k * 2.4) + jit, g]);
      pts.forEach(([px, py], i) => i && link(px, py, i));
      const H1 = [x + 64, y + 19], ang = Math.sin(t * 2.4) * 0.3 + (o.mv ? 0.35 * s : 0), N = 5;   // 短链：钟摆
      for (let i = 1; i <= N; i++) { const r = i * 2.3; link(H1[0] - Math.sin(ang) * r, H1[1] + Math.cos(ang) * r, i); }
      for (const H of [H0, H1]) { pn.disc(H[0], H[1] - 1.5, 2.4).paint(NEAR.steel); pn.dot(H[0], H[1] - 1.5, P.black); }
    },
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
    sideskirt(pn, x, y, o) {   // 步行履带：一战坦克式侧裙板，六块铆接钢板从车体中部垂到 y+28，把胯（腿根）和大腿上部整个罩住，每块一个排泥孔
      for (let i = 0; i < 6; i++) {
        const a = x + 3 + i * 15, b = a + 15;
        pn.poly([[a, y + 6], [b, y + 6], [b, y + 27], [a + 1, y + 28.5]]).paint(i % 2 ? NEAR.iron : NEAR.steel);
        pn.rect(a + 5, y + 19, 5, 3.4).paint(NEAR.dark, { bevel: '' });
        pn.fill(a + 1, y + 13, b - a - 1, 1, P.iron[0]);
        if (pn.hi) { for (let u = a + 2; u < b - 1; u += 3) { rivet(pn, u, y + 7); rivet(pn, u, y + 25.5); } } else for (let u = a + 2; u < b - 1; u += 3) { pn.dot(u, y + 7.5, P.iron[4]); pn.dot(u, y + 26, P.iron[4]); }
      }
      pn.fill(x + 3, y + 6, 90, 1, P.iron[3]);
    },
    banners(pn, x, y, o) {     // 哥特教堂：两个胯位各垂一面燕尾旗（深红底、金边、金十字），遮住胯和大腿根，随风摆
      const t = o.t || 0, cloth = [P.fire[0], P.fire[0], P.fire[1], P.fire[2]];
      for (const [cx, ph] of [[22, 0], [74, 1.7]]) {
        const top = y + 13, bot = y + 33, sw = Math.sin(t * 2 + ph) * 1.4, sl = (v) => sw * (v - top) / (bot - top);
        pn.poly([[x + cx - 5.5, top], [x + cx + 5.5, top], [x + cx + 5.5 + sl(bot), bot], [x + cx + sl(bot - 4), bot - 4.5], [x + cx - 5.5 + sl(bot), bot]]).paint(cloth, { bevel: 's' });
        for (const s of [-4.3, 4.3]) pn.ln(x + cx + s, top + 1, x + cx + s + sl(bot - 1), bot - 1.5, P.brass[2]);
        const m = (v) => x + cx + sl(v);
        pn.fill(m(top + 10) - 0.5, top + 4, 1.2, 9, P.brass[3]); pn.fill(m(top + 7) - 3, top + 6.5, 6.2, 1.2, P.brass[3]);
        pn.rect(x + cx - 7, top - 1, 14, 1.6).paint(NEAR.brass); pn.dot(x + cx - 7.5, top - 0.3, P.brass[3]); pn.dot(x + cx + 7, top - 0.3, P.brass[3]);
      }
    },
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

  // ---------- 铁鳞龙骑：车体裙板 3 方案（v8：不要透火，专注物理甲片和龙的质感）----------
  // 每片甲都有厚度：先在下一片上投一道 1.5px 的阴影，再画甲面（亮边 / 暗边）、中脊和几颗粗糙斑点；上排压下排，所以从最下一排开始画
  const DSH = [P.black, P.black, P.dark[0], P.dark[0]];
  const PLATE = [P.dark[0], P.iron[1], P.iron[2], P.iron[3]];
  const armor = (pn, pts, keel, ramp = PLATE, dy = 1.6) => {
    pn.poly(pts.map(([u, v]) => [u, v + dy])).paint(DSH, { outline: false, bevel: '' });
    pn.poly(pts).paint(ramp);
    if (keel) { pn.ln(keel[0], keel[1], keel[2], keel[3], P.iron[4]); pn.ln(keel[0] + 1, keel[1] + 1, keel[2] + 1, keel[3], P.iron[1]); }
  };
  const horn = (pn, x, y, dx, dy, w) => { pn.poly([[x - w, y], [x + w, y], [x + dx * 0.6 + w * 0.3, y + dy * 0.6], [x + dx, y + dy]]).paint([P.dark[0], P.iron[2], P.iron[3], P.iron[4]]); pn.ln(x - w * 0.2, y + 0.5, x + dx * 0.85, y + dy * 0.85, P.iron[4]); };
  const SKIRTS = {
    // A 龙脊甲：三层带中脊的大盾鳞（每片 13px 宽），最下一层是长长的尖角甲垂到 y+28；上层压下层、层层投影
    spine(pn, x, y, o) {
      for (const [t0, h, off, long] of [[14, 8.5, 0, 1], [9, 8, 6.5, 0], [4, 8, 0, 0]]) {
        for (let u = 2 + off - 13; u < 94; u += 13) {
          const a = Math.max(x + 2, x + u), b = Math.min(x + 94, x + u + 13), cx = x + u + 6.5, bt = y + t0 + h;
          if (b - a < 3) continue;
          const pts = (long ? [[a, y + t0], [b, y + t0], [b, bt - 5], [cx, bt + 2], [a, bt - 5]] : [[a, y + t0], [b, y + t0], [b, bt - 3], [cx + 3, bt - 0.5], [cx, bt], [cx - 3, bt - 0.5], [a, bt - 3]]).map(([px, py]) => [Math.min(x + 94, Math.max(x + 2, px)), py]);
          armor(pn, pts, cx > x + 4 && cx < x + 92 ? [cx, y + t0 + 1, cx, bt - 2] : null);
          if (cx > x + 4 && cx < x + 92) { pn.dot(cx - 3, y + t0 + 3, P.iron[1]); pn.dot(cx + 3.5, y + t0 + 4.5, P.iron[1]); }
        }
      }
    },
    // B 龙腹横甲：四条横向的宽腹甲（像龙 / 蛇的腹鳞），每条一片压一片、下沿微微下垂，甲面有横向的细纹；两头各一块弯角护板，最下一条挂五根粗尖角
    belly(pn, x, y, o) {
      for (let k = 2; k >= 0; k--) {
        const t0 = y + 4 + k * 5.5, b = t0 + 7.6, pts = [[x + 8, t0], [x + 88, t0]];
        for (let px = 88; px >= 8; px -= 2) pts.push([x + px, b - 1.6 + 1.6 * Math.sin(Math.PI * (px - 8) / 80)]);
        armor(pn, pts, null);
        for (let px = 20; px < 80; px += 15) { pn.ln(x + px, t0 + 1, x + px, b - 1, P.iron[0]); pn.ln(x + px + 1, t0 + 1, x + px + 1, b - 1.5, P.iron[3]); }   // 腹甲的分节缝
        pn.ln(x + 9, t0 + 1, x + 87, t0 + 1, P.iron[3]);
      }
      for (let u = 20; u < 80; u += 15) horn(pn, x + u + 7.5, y + 22.5, 0, 6, 2.6);
      for (const [a, s] of [[2, 1], [94, -1]]) armor(pn, [[x + a, y + 4], [x + a + s * 9, y + 4], [x + a + s * 8, y + 16], [x + a + s * 3, y + 26], [x + a, y + 20]], [x + a + s * 5, y + 6, x + a + s * 4, y + 22]);
    },
    // C 棘背甲：两个胯位各一副三层圆肩甲（一层比一层窄），每层两颗粗锥形骨刺朝外下方；中间一块带脊的胸甲，下沿两根向下的粗角
    horns(pn, x, y, o) {
      armor(pn, [[x + 37, y + 4], [x + 59, y + 4], [x + 59, y + 15], [x + 48, y + 21], [x + 37, y + 15]], [x + 48, y + 5, x + 48, y + 19]);
      horn(pn, x + 43, y + 17, -1.5, 8, 2.6); horn(pn, x + 53, y + 17, 1.5, 8, 2.6);
      for (const cx of [22, 74]) {
        for (const [t0, hw, h] of [[11, 11, 10], [4, 14, 10]]) {
          const pts = [[x + cx - hw, y + t0]];
          for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; pts.push([x + cx - Math.cos(a) * hw, y + t0 + 2 + Math.sin(a) * (h - 2)]); }
          pts.push([x + cx + hw, y + t0]);
          armor(pn, pts, [x + cx, y + t0 + 1, x + cx, y + t0 + h - 1.5]);
        }
        for (const [s, t0, hw] of [[-1, 4, 14], [1, 4, 14], [-1, 11, 11], [1, 11, 11]]) horn(pn, x + cx + s * hw * 0.62, y + t0 + 6.5, s * 5, 5.5, 2.2);
      }
    },
  };
  const SKIRT_LIST = [
    ['spine', 'A 龙脊甲', '三层带中脊的大盾鳞（每片 13px），最下一层是长尖角甲垂到车体下方；上层压下层、每层在下一层上投影，甲面有粗糙斑点'],
    ['belly', 'B 龙腹横甲', '四条横向宽腹甲一条压一条（像龙腹的横鳞），甲面横向细纹；两头各一块弯角护板，最下挂五根粗尖角'],
    ['horns', 'C 棘背甲', '两个胯位各一副三层圆肩甲，每层两颗粗锥形骨刺朝外下方；中间一块带脊的胸甲，下沿两根粗角'],
  ];

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
    { mt: 3, name: '步行履带', hull: 'landship', front: 'sideskirt', leg: 'pedrail', ref: '迪普洛克 Pedrail（1900 年代，一战坦克的前身之一）',
      idea: '膝盖朝里的两段粗支腿，每只脚是一段履带：三只负重轮、履带板随步子走；车体下挂一圈一战坦克式侧裙板（六块铆接钢板 + 排泥孔），罩住胯和大腿上部。' },
    { mt: 4, main: true, kept: true, name: '曲柄步行机', hull: 'conserv', leg: 'crank', ref: '切比雪夫步行机 / 维多利亚机械玩具',
      idea: '水晶宫温室车体（窗里摆着盆栽、檐下垂着常春藤）。夸张的高膝：膝盖最高点超出车体顶板约 24px（半个底盘高）。飞轮在大腿后面转、推杆带大腿；大腿小腿都缠着常春藤（叶子 + 几朵小花），膝上垂下几缕藤蔓随风摆。' },
    { mt: 4, name: '蒸汽圣骑', hull: 'conserv', front: 'shields', leg: 'knight', ref: '龟足 / 象足 + 骑士的护膝与风筝盾',
      idea: '腿换成龟足：短粗的甲板大腿、往下张开的柱状小腿（三排龟甲鳞 + 黄铜箍边），膝上圆护膝 + 小扇翼，脚是圆厚的龟足垫、前缘三枚钝甲；车体侧面挂一排五面风筝盾。' },
    { mt: 4, name: '螳臂步行机', hull: 'railcar', leg: 'mantis', ref: '螳螂的腿和胫刺（替换仪表步行机）',
      idea: '高膝，大腿是一片带棱线的三角甲板、下缘一排倒刺；小腿是一把越往下越细的长刀形胫甲，末端就是脚——一根钢尖（黄铜箍 + 一根后刺），只用尖点着地。四只尖脚是剪影的重点。车体用铁路沙龙车厢。' },
    { mt: 5, main: true, kept: true, name: '汽锤步行机', hull: 'ironclad', leg: 'hammer', ref: '内史密斯蒸汽锤',
      idea: '每条腿是一台吊在耳轴上的更粗的竖直汽缸，缸底伸出两根并排的活塞杆（中间镂空）、十字头连砧形铁脚。着地的半个周期里锤头连续砸地三下，每砸一下缸底喷汽、脚边扬尘。' },
    { mt: 5, name: '钟表巨像', hull: 'ironclad', back: 'bellygear', leg: 'clock', ref: '双足钟表巨像 · 塔钟机芯',
      idea: '膝盖是一只十一齿大齿轮，开框大腿里转着小齿轮，胫后缘一排棘轮齿，宽脚板带发条盒和小齿轮；车腹底下半露一组啮合齿轮。' },
    { mt: 5, name: '锚链铁甲', hull: 'ironclad', back: 'drag', leg: 'anchor', ref: '维多利亚铁甲舰的锚与锚链',
      idea: '人形正膝，锻铁大腿、缠两道锚链箍的小腿，每只脚是一只船锚；车腹下两根锚链：前面一根短的吊着晃（走路时往后甩），正中一根长的垂到地面、只拖一小截；拖地那截跟着前进 / 后退换到车后（页面顶上可以切方向）。' },
    { mt: 6, main: true, name: '哥特教堂', hull: 'gothic', front: 'banners', leg: 'gothic', ref: '哥特复兴教堂：飞扶壁、尖塔、彩窗、玫瑰窗、燕尾旗',
      idea: '车体是教堂立面：石缝、扶壁柱顶金十字、尖拱彩窗（以太光流过），正中门楼（玫瑰窗 + 尖拱木门）。两个胯位各垂一面深红燕尾旗（金边、金十字），遮住胯和大腿根。腿：飞扶壁大腿、石砌方柱小腿（发光尖拱龛），膝上小尖塔，两级台座。' },
    { mt: 6, name: '大本钟', hull: 'bigben', leg: 'bigben', ref: '威斯敏斯特宫钟楼（大本钟，1859）',
      idea: '厚重建筑感：车体是垂直式哥特窗格 + 正中大钟面（指针在走）+ 下沿粗挑檐托石。腿是方形塔身，膝盖是一座方钟亭（小钟面也在走），小腿往下加粗、刻竖棂横档，脚是三级台座。' },
    { mt: 6, name: '铁鳞龙骑', hull: 'drake', front: 'spine', leg: 'dragon', ref: '龙的鳞甲 / 骨刺 / 爪 + 中世纪板甲的叠片做法（v8 重做，去掉透火）',
      idea: '车体和裙板全是有厚度的物理甲片：每片带中脊、亮边暗边、粗糙斑点，上片在下片上投一道阴影；三种裙板见「铁鳞龙骑 · 车体裙板」，这里用 A 龙脊甲。腿大幅加粗：大腿三片厚甲（最宽 15px）、膝上厚膝甲 + 粗角刺、小腿两片甲 + 跗关节粗后刺、粗短跖骨，脚是三根粗弯爪 + 后爪。' },
  ];
  const LEG_H = { crank: { reach: 4, up: 34, kx: 7 }, skirt: { reach: 3 }, gren: { reach: 3 }, pedrail: { reach: 2 }, knight: { reach: 2 }, mantis: { up: 2, kx: 12, reach: 3 }, clock: { up: -1, kx: 11 }, anchor: { reach: 3 }, dragon: { reach: 0 }, gothic: { reach: 3 }, bigben: { reach: 3 } };

  // 机身起伏：对角两腿交替着地（plantGait：一对腿在 u=0.75、另一对在 u=0.25 撑在胯正下方 = 最高；u=0、0.5 双支撑 = 最低），每步两次
  // 步幅（v7）：跟车速变——慢走 14px、快跑 24px（原来最多 13）；步态角按走过的距离推进：Δa = 2π·距离 / (4·步幅)，所以同样的车速步频更低，脚不打滑
  const strideOf = (v) => Math.max(14, Math.min(24, 14 + v * 0.12));
  const bobOf = (o) => (o.mv ? Math.round((2 + ((o.stride || 14) - 14) / 10) * (1 - Math.abs(Math.sin(o.a || 0)))) : 0);

  // 画一只整件四足到透明画布，坐标 (ox, oy) = 模块左上角。o = { mv, a 步态角, t 秒, stride, top, hull（换车体对照用） }
  function figure(g, ox, oy, e, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const S = o.stride || 14, lo = { mv: !!o.mv, a: o.a || 0, plant: true, plantS: S, plantH: 4 + 0.3 * S };
    const y = oy + bobOf(o), H = { ...(LEG_H[e.leg] || {}), ...(e.H || {}) };
    const ho = { t: o.t || 0, top: !!o.top, mv: !!o.mv, a: o.a || 0, gy: oy + 48, trail: o.trail };
    const leg = (M, far, [hx, hy], gy, dir, ph) => {
      const q = [], c = { pn, M, far, hx: ox + hx, hy: y + hy, gy, dir, ph, o: lo, t: o.t || 0, L: (z, fn) => q.push([z, q.length, fn]) };
      c.g = gait(lo, ph, 5, 4);
      LEGS[e.leg](c, H);
      q.sort((a, b) => (far ? b[0] - a[0] : a[0] - b[0]) || a[1] - b[1]);
      for (const [, , fn] of q) fn();
    };
    leg(FAR, true, HIPS.fr, oy + 45, -1, Math.PI); leg(FAR, true, HIPS.ff, oy + 45, 1, 0);
    const hull = o.hull || e.hull, back = o.hull ? o.back : e.back, front = o.skirt || (o.hull ? o.front : e.front);
    if (back) BACK[back](pn, ox, y, ho);
    HULL[hull](pn, ox, y, ho);
    leg(NEAR, false, HIPS.nr, oy + 48, -1, 0); leg(NEAR, false, HIPS.nf, oy + 48, 1, Math.PI);
    if (front) (FRONT[front] || SKIRTS[front])(pn, ox, y, ho);
    pn.flush(g);
  }
  return { SET, figure, LEGS, HULL, HULL_CANDS, SKIRT_LIST, bobOf, strideOf };
})();
