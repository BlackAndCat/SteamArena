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

    // T6 熔炉龙骑（重做）：粗壮的三段龙腿（膝朝前、跗关节朝后），大腿是三块交叠甲片 + 嵌在里面的炉膛，膝前尖刺、跗关节后刺，三爪 + 后爪；脚尖统一朝车头
    dragon(c, H) {
      const { pn, M, hx, hy, far, t, L } = c, F = footOf(c, H), Hk = [F[0] - 3, F[1] - 7.5];
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
      L(Z.FT, () => {   // 三根前爪 + 一根后爪，各自分开、弯曲，只有爪尖点地（不要鞋底）
        const b = [x, y - 2.8];
        pn.cap(ex, ey, ...b, 2).paint(M.iron, { bevel: 'l' });
        const talon = (pts) => { for (let k = 1; k < pts.length; k++) pn.cap(...pts[k - 1], ...pts[k], 1.35 - k * 0.3); };
        talon([b, [x + 3.5, y - 3.6], [x + 6.5, y - 2], [x + 7.6, y]]);
        talon([[x, y - 3.4], [x + 2.4, y - 5.4], [x + 4.6, y - 5], [x + 5.4, y - 3]]);
        talon([b, [x - 3, y - 2.8], [x - 5.2, y - 1.4], [x - 5.8, y]]);
        pn.paint(M.leg, { bevel: 'l' });
        for (const [u, v] of [[7.6, -0.3], [5.4, -3.2], [-5.8, -0.3]]) pn.dot(x + u, y + v, M.brass[3]);
        ball(pn, M.iron, ...b, 1.6);
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
    6: [['gothic', 'A 哥特教堂', '石砌立面 + 扶壁柱顶金十字，尖拱彩窗（以太光流过），正中门楼：玫瑰窗 + 尖拱木门，下沿倒挂尖拱花边（主线另配两面胯位燕尾旗）'],
      ['bigben', 'B 大本钟', '威斯敏斯特钟楼式厚重石砌车体：垂直式哥特窗格、镀金檐带，正中大钟面（指针在走），下沿一排粗挑檐托石'],
      ['furnace', 'C 熔炉龙鳞', '肋骨炉膛车体 + 大块鳞甲裙板（这里用 B 巨鳞，七种见「熔炉龙骑 · 鳞甲裙板」）', 'giant']],
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

  // ---------- 熔炉龙骑的鳞甲裙板：7 种方案（v7：v6 的细密小鳞让人密恐，全部改成大块）----------
  // 都盖住胯（腿根，y+10）和大腿上部，范围 x+2～x+94、y+4～y+28；甲板的描边用炉火色 = 缝里透出来的火光（随呼吸明灭）
  const fireOf = (o) => { const t = o.t || 0, hot = Math.sin(t * 2.6) > 0; return { t, seam: hot ? P.fire[2] : P.fire[1], core: hot ? P.fire[3] : P.fire[2] }; };
  const plate = (seam) => [seam, P.iron[1], P.iron[2], P.iron[3]];
  const shrink = (pts, d) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length; return pts.map(([px, py]) => { const l = Math.hypot(px - cx, py - cy) || 1; return [px - (px - cx) / l * d, py - (py - cy) / l * d]; }); };
  const SKIRTS = {
    // A 叠瓦大甲：三条横向宽甲带，上压下；每条下沿是六个大圆瓣（一瓣 15px），瓣中一道脊、瓣根一颗铆钉
    tiles(pn, x, y, o) {
      const { seam } = fireOf(o);
      [[4, 12], [10, 19], [17, 27]].map((b, i) => [b, i]).reverse().forEach(([[t0, b0], bi]) => {
        const off = bi % 2 ? 7.7 : 0, w = 15.3, pts = [[x + 2, y + t0], [x + 94, y + t0]];
        for (let px = 94; px >= 2; px -= 1) { const f = (((px - 2 + off) / w) % 1 + 1) % 1; pts.push([x + px, y + b0 - 3.4 + 3.4 * Math.sin(Math.PI * f)]); }
        pn.poly(pts).paint(plate(seam));
        for (let k = -1; k < 7; k++) { const cx = x + 2 - off + w * (k + 0.5); if (cx < x + 4 || cx > x + 92) continue; pn.ln(cx, y + t0 + 2, cx, y + b0 - 1, P.iron[3]); pn.dot(cx, y + t0 + 1, P.brass[3]); }
      });
    },
    // B 巨鳞：一排六片大盾形鳞（15px 宽、从 y+4 垂到 y+26 的尖），后面错开一排五片只露出鳞尖；每片一道中脊 + 两道侧槽 + 顶上一颗铆钉
    giant(pn, x, y, o) {
      const { seam } = fireOf(o), sc = (cx, top, tip, hw, back) => {
        const pts = [[cx - hw, top], [cx + hw, top], [cx + hw, tip - 10], [cx + hw * 0.45, tip - 3.5], [cx, tip], [cx - hw * 0.45, tip - 3.5], [cx - hw, tip - 10]];
        pn.poly(pts).paint(back ? [seam, P.iron[0], P.iron[1], P.iron[2]] : plate(seam), { clip: [x + 2, x + 94] });
        if (back || cx < x + 5 || cx > x + 91) return;
        pn.ln(cx, top + 2, cx, tip - 2, P.iron[3]); pn.ln(cx - hw * 0.5, top + 3, cx - hw * 0.3, tip - 8, P.iron[1]); pn.ln(cx + hw * 0.5, top + 3, cx + hw * 0.3, tip - 8, P.iron[1]);
        pn.dot(cx, top + 1.5, P.brass[3]);
      };
      for (let k = 0; k < 5; k++) sc(x + 2 + 15.3 * (k + 1), y + 8, y + 29, 7, true);
      for (let k = 0; k < 6; k++) sc(x + 2 + 15.3 * (k + 0.5), y + 4, y + 26, 7.4, false);
    },
    // C 鳄背脊板：两排竖向大甲板（11px 宽），每块一道隆起的龙骨脊（亮线 + 阴影），下排错开半块、下沿一枚短尖
    scutes(pn, x, y, o) {
      const { seam } = fireOf(o);
      for (const [t0, b0, off, last] of [[13, 25, 5.75, 1], [4, 15, 0, 0]]) for (let u = 2 - off; u < 94; u += 11.5) {
        const a = x + u, b = x + u + 11.5, cx = (a + b) / 2;
        const pts = last ? [[a + 0.5, y + t0], [b - 0.5, y + t0], [b - 0.5, y + b0 - 2], [cx, y + b0 + 2.5], [a + 0.5, y + b0 - 2]] : [[a + 1.5, y + t0], [b - 1.5, y + t0], [b - 0.5, y + t0 + 1.5], [b - 0.5, y + b0 - 1], [a + 0.5, y + b0 - 1], [a + 0.5, y + t0 + 1.5]];
        pn.poly(pts).paint(plate(seam), { clip: [x + 2, x + 94] });
        if (cx < x + 4 || cx > x + 92) continue;
        pn.ln(cx, y + t0 + 1.5, cx, y + b0 - 1.5, P.iron[4]); pn.ln(cx + 1, y + t0 + 2, cx + 1, y + b0 - 1.5, P.iron[1]);
      }
    },
    // D 熔岩裂甲：七八块不规则的黑曜岩甲板，板与板之间是 1～2px 的熔岩裂缝（亮心随呼吸变亮），下沿参差
    lava(pn, x, y, o) {
      const { core, t } = fireOf(o);
      const xs = [2, 15, 29, 43, 57, 71, 84, 94], r1 = [13, 16, 12, 15, 13, 16, 12, 14], r2 = [26, 28, 25, 28, 26, 27, 25, 27];
      const top = xs.map((u) => [x + u, y + 4]), mid = xs.map((u, i) => [x + u + (i % 2 ? 2 : -2) * (i > 0 && i < 7 ? 1 : 0), y + r1[i]]), bot = xs.map((u, i) => [x + u + (i % 2 ? -1.5 : 1.5) * (i > 0 && i < 7 ? 1 : 0), y + r2[i]]);
      pn.poly(top.concat(bot.slice().reverse())).paint([P.fire[0], P.fire[1], core, core], { bevel: '' });
      for (const [R0, R1] of [[top, mid], [mid, bot]]) for (let i = 0; i < 7; i++) {
        if ((i + (R0 === top ? 0 : 1)) % 3 === 2) { pn.poly(shrink([R0[i], R0[i + 1], R1[i + 1]], 1)).paint([P.black, P.dark[1], P.dark[2], P.dark[3]], { outline: false }); pn.poly(shrink([R0[i], R1[i + 1], R1[i]], 1)).paint([P.black, P.dark[1], P.dark[2], P.dark[3]], { outline: false }); }
        else pn.poly(shrink([R0[i], R0[i + 1], R1[i + 1], R1[i]], 1)).paint([P.black, P.dark[1], P.dark[2], P.dark[3]], { outline: false });
      }
      for (let k = 0; k < 6; k++) if (Math.sin(t * 4 + k * 2.1) > 0.6) pn.dot(x + 8 + k * 15, y + 14 + (k % 2) * 2, P.fire[3]);
    },
    // E 后掠刃鳞：七片长长的弯刃甲从上沿往后下方掠（像收拢的羽 / 镰刀），后一片压前一片，刃间透火
    blades(pn, x, y, o) {
      const { seam } = fireOf(o);
      for (let k = 0; k < 7; k++) {
        const ax = x + 12 + k * 13.2, a = [ax, y + 4.5], cc = [ax + 1, y + 17], tip = [ax - 11, y + 27], pts = [], back = [];
        for (let i = 0; i <= 8; i++) {
          const u = i / 8, px = (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * cc[0] + u * u * tip[0], py = (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * cc[1] + u * u * tip[1];
          const dx = 2 * (1 - u) * (cc[0] - a[0]) + 2 * u * (tip[0] - cc[0]), dy = 2 * (1 - u) * (cc[1] - a[1]) + 2 * u * (tip[1] - cc[1]), l = Math.hypot(dx, dy) || 1, w = 6.2 * (1 - u) + 0.3;
          pts.push([px + dy / l * w, py - dx / l * w]); back.push([px - dy / l * w * 0.35, py + dx / l * w * 0.35]);
        }
        pn.poly(pts.concat(back.reverse())).paint(plate(seam), { clip: [x + 1, x + 95] });
        const m = pts[3]; pn.dot(m[0] - 1, m[1] + 1, P.iron[4]); pn.dot(ax, y + 5.5, P.brass[3]);
      }
      pn.fill(x + 2, y + 3.5, 92, 1.5, P.iron[0]);
    },
    // F 炉门护甲：每个胯位一扇铆接的大炉门（铰链带、门闩，门上三道透火的格栅缝），两门之间一块炉口护板（拱形火口 + 竖栅），门下沿三枚尖
    doors(pn, x, y, o) {
      const { seam, core } = fireOf(o);
      const grate = (a, b, t0, b0) => { pn.rect(a, t0, b - a, b0 - t0).paint([P.black, P.fire[1], core, core], { bevel: '' }); };
      pn.rect(x + 35, y + 5, 26, 17).paint(NEAR.iron);
      pn.poly([[x + 40, y + 21], [x + 40, y + 13], [x + 48, y + 8], [x + 56, y + 13], [x + 56, y + 21]]).paint([P.black, P.fire[1], core, core], { bevel: '' });
      for (let u = 42; u < 56; u += 3) pn.fill(x + u, y + 9, 1.2, 12, P.iron[1]);
      for (const cx of [22, 74]) {
        const a = x + cx - 13, b = x + cx + 13;
        for (const u of [cx - 9, cx, cx + 9]) pn.poly([[x + u - 2.4, y + 23], [x + u + 2.4, y + 23], [x + u, y + 28.5]]).paint(plate(seam));
        pn.rect(a, y + 4, 26, 20).paint(NEAR.steel);
        pn.rect(a + 2, y + 6, 22, 16).paint(NEAR.iron, { bevel: 's' });
        for (const r of [9, 13, 17]) grate(a + 5, b - 5, y + r, y + r + 1.6);
        for (const r of [7, 19]) pn.rect(cx < 48 ? a - 1 : b - 9, y + r, 10, 2).paint(NEAR.brass);   // 铰链带（在外侧）
        pn.rect(cx < 48 ? b - 3 : a + 1, y + 12, 2, 5).paint(NEAR.brass);   // 门闩
        if (pn.hi) for (const [u, v] of [[a + 1, y + 5], [b - 3, y + 5], [a + 1, y + 21], [b - 3, y + 21]]) rivet(pn, u, v); else for (const [u, v] of [[a + 1, y + 5], [b - 2, y + 5], [a + 1, y + 22], [b - 2, y + 22]]) pn.dot(u, v, P.iron[4]);
      }
    },
    // G 折翼：每个胯位收着一只铁骨龙翼——三根翼骨从肩关节往后下方张开，翼膜在骨间下垂成弧，被炉火从里面照透（暗红）；肩上一枚黄铜爪钩
    wings(pn, x, y, o) {
      const { core } = fireOf(o);
      for (const cx of [22, 74]) {
        const S = [x + cx + 8, y + 5], tips = [[x + cx - 16, y + 25], [x + cx - 5, y + 28], [x + cx + 7, y + 26]];
        const pts = [S, tips[0]];
        for (let k = 0; k < 2; k++) { const A = tips[k], B = tips[k + 1]; for (let i = 1; i < 6; i++) { const u = i / 6; pts.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u - 3.6 * Math.sin(Math.PI * u)]); } pts.push(B); }
        pn.poly(pts).paint([P.black, P.fire[0], P.fire[1], core], { bevel: 'l' });
        for (const T of tips) pn.cap(S[0], S[1], T[0], T[1], 1.3);
        pn.cap(S[0], S[1], S[0] - 13, S[1] + 2, 1.6);
        pn.paint(plate(P.black), { bevel: 'l' });
        ball(pn, NEAR.steel, S[0], S[1], 2.6);
        pn.poly([[S[0] + 1, S[1] - 2], [S[0] + 5, S[1] - 1], [S[0] + 3, S[1] + 1.5]]).paint(NEAR.brass);
      }
    },
  };
  const SKIRT_LIST = [
    ['giant', 'B 巨鳞', '一排六片大盾形鳞（15px 宽、尖朝下），后面错开一排只露鳞尖；每片中脊 + 侧槽 + 铆钉'],
    ['tiles', 'A 叠瓦大甲', '三条横向宽甲带上压下，每条下沿六个大圆瓣；瓣缝透火'],
    ['scutes', 'C 鳄背脊板', '两排竖向大甲板，每块一道隆起的龙骨脊，下排错开半块、下沿短尖'],
    ['lava', 'D 熔岩裂甲', '七八块不规则黑曜岩甲板，板间是熔岩裂缝（亮心随呼吸变亮），下沿参差'],
    ['blades', 'E 后掠刃鳞', '七片长弯刃甲往后下方掠，像收拢的羽 / 镰刀，刃间透火'],
    ['doors', 'F 炉门护甲', '每个胯位一扇铆接大炉门（铰链、门闩、三道透火格栅），中间一块拱形炉口护板，门下三枚尖'],
    ['wings', 'G 折翼', '每个胯位收着一只铁骨龙翼：三根翼骨往后张开，翼膜被炉火照透成暗红，肩上黄铜爪钩'],
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
    { mt: 6, name: '熔炉龙骑', hull: 'furnace', front: 'giant', leg: 'dragon', ref: '双足熔心龙骑（只取鳞、炉火、肋骨、尖刺、爪，不做龙头）',
      idea: '车体下挂一片盖住腿根的大块鳞甲裙板，甲缝透出炉火——七种方案见下方「熔炉龙骑 · 鳞甲裙板」，这里先用 B 巨鳞。腿是粗壮的三段龙腿：交叠甲片大腿 + 炉膛，膝前 / 跗关节各一根黄铜尖刺；脚是分开的弯爪——三根前爪 + 一根后爪，只有爪尖点地。' },
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
