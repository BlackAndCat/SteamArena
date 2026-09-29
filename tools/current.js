// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：真双足（2×4，48×96）的画面探索（2026-09-29）。用户：「至少 12 种；黄铜材质只有 1 种，其他材质 2～3 种不同的形态；
// 其中 6 个是该材质的标准主线形态，剩下的是特殊唯一变体，从熟铁开始每个材质有 1～3 个变体」。
// 本期共 14 种：
//   主线 6（各材质 1 种，沿用 js/legs.js 已有的六档腿型）：T1 黄铜 工装 Mk.II · T2 熟铁 鹭步 · T3 钢 掷弹兵 · T4 镀镍 蒸汽圣骑 · T5 乌兹钢 钟表巨像 · T6 以太合金 熔心龙骑
//   唯一变体 8：熟铁 1（轮足）· 钢 2（板簧跑刃、裙甲堡）· 镀镍 1（圣堂 · 纹章罩袍）· 乌兹钢 2（高跷、蒸汽人）· 以太合金 2（袋鼠跳腿、以太悬浮足）
//   其中 5 个是 legs.js 里已有的探索腿型（高跷 / 轮足 / 裙甲堡 / 板簧跑刃 / 纹章罩袍）按材质档位重新分配，3 个是本期新画（蒸汽人 / 袋鼠跳腿 / 以太悬浮足），
//   新画的腿型登记进 SA.LEGLAB.DESIGNS（id: steamman / kangaroo / levit），和游戏里的双足共用同一套光栅器、胯（陀螺仪）和步态。
// 历史参考：蒸汽人 = 1868 德德里克「草原蒸汽人」（世界上第一台蒸汽行走机器）；袋鼠跳腿 = 19 世纪末的弹跳机械 / 跳跃假肢；
//   高跷 = 伸缩套筒；纹章罩袍 = 中世纪重甲；轮足 = 1903 迪普洛克 Pedrail「行走轮」的思路。
window.SA = window.SA || {};

SA.BIP = (() => {
  const LL = SA.LEGLAB, U = LL.U, P = SA.PAL, { NEAR, gait, ik, bone, frame } = U, flat = U.flat;

  // ---------- 新画 1 · 蒸汽人（1868 德德里克）：人形正膝，粗大的铆接汽缸大腿 + 直筒小腿 + 圆头铁靴；腿后一根蒸汽管，膝盖处随迈步喷白汽 ----------
  const STEAMMAN = {
    hipY: 14, bob: 2,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7, 4.5);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + g.x, L.gy - 6.4 - g.lift, 14.5, 15, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt * 0.6);
      // 蒸汽管：从胯后沿着腿后缘垂到膝后，膝后阀口在抬腿时喷汽
      const p0 = T.p(1, -4.6), p1 = T.p(T.len - 1, -4.6), p2 = S.p(S.len * 0.4, -4.2);
      pn.cap(...p0, ...p1, 0.9).cap(...p1, ...p2, 0.9).paint(M.steam, { bevel: 'l' });
      pn.disc(p1[0], p1[1], 1.5).paint(M.brass, { bevel: 'l' });
      if (g.lift > 1.2 && o.mv) { pn.disc(p1[0] - 2.4, p1[1] - 1, 0.9 + g.lift * 0.12).paint(NEAR.steam, { outline: false, bevel: '' }); pn.dot(p1[0] - 3.4, p1[1] - 2.6, P.steam[2]); }
      // 圆头铁靴（无尖，像一只倒扣的锅）
      pn.poly(F.pts([[-5, -1], [2, -1.6], [7, 0.2], [10.4, 3.4], [10.8, 6.2], [-5.4, 6.6], [-5.4, 0]])).paint(M.leg);
      pn.poly(F.pts([[-5.4, 5], [10.7, 5], [10.8, 6.6], [-5.4, 6.6]])).paint(M.dark, { outline: false, bevel: '' });
      pn.poly(F.pts([[-1.5, 0.6], [2.5, 0.6], [2.5, 2.6], [-1.5, 2.6]])).paint(M.brass, { bevel: 'l' });
      // 小腿：直筒 + 三道箍
      pn.poly(S.pts([[-1, -3], [-1, 3.2], [S.len + 0.5, 3.6], [S.len + 0.5, -3.4]])).paint(M.iron);
      for (const a of [S.len * 0.25, S.len * 0.62, S.len * 0.95]) pn.poly(S.pts([[a - 0.8, -3.4], [a + 0.8, -3.4], [a + 0.8, 3.8], [a - 0.8, 3.8]])).paint(M.brass, { outline: false });
      if (pn.hi) for (let a = 2; a < S.len; a += 3) pn.dot(...S.p(a, 2.2), P.iron[4]);
      // 大腿：更粗的汽缸，纵向两条接缝
      pn.cap(L.hx, L.hy, kx, ky, 4.9).paint(M.iron);
      for (const t of [0.22, 0.5, 0.78]) { const a = T.len * t; pn.poly(T.pts([[a - 0.8, -5], [a + 0.8, -5], [a + 0.8, 5], [a - 0.8, 5]])).paint(M.brass, { outline: false }); }
      pn.ln(...T.p(1, 1.2), ...T.p(T.len - 1, 1.2), M.iron[1]);
      // 膝：黄铜球关节；胯：大铁毂
      pn.disc(kx, ky, 4.3).paint(M.brass); pn.dot(kx - 1.2, ky - 1.2, M.brass[3]);
      pn.disc(L.hx, L.hy, 4.9).paint(M.iron); pn.disc(L.hx, L.hy, 1.8).paint(M.brass, { outline: false });
    },
  };

  // ---------- 新画 2 · 袋鼠跳腿：反关节，短粗的大腿 + 又长又细的小腿 + 长脚板；大腿后到脚跟绷一根「弹力筋」（一排弹簧圈），落地时被压扁 ----------
  const KANGAROO = {
    hipY: 13, bob: 4,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 8.5, 6.5);
      const hx = L.hx, hy = L.hy;
      const [kx, ky, ex, ey] = ik(hx, hy, hx + 3 + g.x, L.gy - 5 - g.lift, 13, 19.5, -1);
      const T = bone(hx, hy, kx, ky), S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt);
      // 长脚板：前掌长、后面一小截脚跟
      pn.poly(F.pts([[-3.4, -0.6], [9.5, 0.6], [14.5, 3.4], [15, 5], [-3.6, 5], [-3.8, 1]])).paint(M.leg);
      pn.poly(F.pts([[-3.6, 3.6], [15, 3.6], [15, 5], [-3.6, 5]])).paint(M.dark, { outline: false, bevel: '' });
      if (pn.hi) for (let u = 0; u < 14; u += 2.4) pn.dot(...F.p(u, 4.3), M.leg[3]);
      pn.dot(...F.p(13.2, 2.4), M.brass[3]);
      // 小腿：细长双杆
      pn.cap(...S.p(0, 1.5), ...S.p(S.len, 0.9), 1).cap(...S.p(0, -1.5), ...S.p(S.len, -0.9), 1).paint(M.leg, { bevel: 'l' });
      pn.ln(...S.p(2, 1.5), ...S.p(S.len - 2, -0.9), M.leg[pn.hi ? 3 : 2], pn.hi ? 2 : 1);
      pn.disc(ex, ey, 2.1).paint(M.iron); pn.dot(ex - 0.6, ey - 0.6, M.brass[3]);
      // 大腿：短而粗的楔形肌 + 黄铜护环
      pn.poly(T.pts([[-3.6, -3.4], [-3.6, 4], [T.len * 0.55, 5.6], [T.len + 1, 2.4], [T.len + 1, -2.4], [T.len * 0.45, -4.4]])).paint(M.iron);
      pn.ln(...T.p(-1, 3), ...T.p(T.len - 1, 1.4), M.brass[2], pn.hi ? 2 : 1);
      // 弹力筋：从大腿后上方拉到脚跟，中间是一排弹簧圈（落地时被压扁：圈幅跟脚离地高度反着来）
      const a0 = T.p(T.len * 0.15, -3.6), a1 = F.p(-3, 0.4), sB = bone(a0[0], a0[1], a1[0], a1[1]), amp = 1.6 + (g.lift < 0.5 ? 1 : 0), n = pn.hi ? 8 : 5;
      let prev = sB.p(0, 0);
      for (let k = 1; k <= n; k++) { const pt = sB.p(sB.len * k / (n + 1), k % 2 ? amp : -amp); pn.cap(prev[0], prev[1], pt[0], pt[1], 0.75); prev = pt; }
      pn.cap(prev[0], prev[1], a1[0], a1[1], 0.75).paint(M.brass, { bevel: 'l' });
      pn.disc(kx, ky, 2.9).paint(M.brass); pn.dot(kx, ky, M.brass[0]);
      pn.disc(hx, hy, 3.5).paint(M.iron); pn.disc(hx, hy, 1.3).paint(M.brass, { outline: false });
    },
  };

  // ---------- 新画 3 · 以太悬浮足：腿是两根细的黄铜套筒杆（膝盖是万向环），脚不着地——一块悬浮圆盘飘在离地 3 格的地方，盘下两圈涟漪 ----------
  const LEVIT = {
    hipY: 14, bob: 1,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 6.5, 3.6), gy = L.gy - 4.6 - g.lift * 0.8;
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + g.x * 0.9, gy - 4, 15.5, 15.5, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), t = (o.t || 0) * 5;
      // 悬浮盘 + 涟漪（盘下两道越来越淡的椭圆环，随时间胀缩）
      const px0 = ex, py0 = gy;
      const ripple = (r, ramp) => pn.poly([[px0 - r, py0 + 2.2], [px0 - r * 0.7, py0 + 1.2], [px0 + r * 0.7, py0 + 1.2], [px0 + r, py0 + 2.2], [px0 + r * 0.7, py0 + 3.2], [px0 - r * 0.7, py0 + 3.2]]).paint(ramp, { bevel: '' });
      const w1 = 8.5 + Math.sin(t) * 0.8, w2 = 11 + Math.sin(t + 1.6) * 0.8;
      ripple(w2, flat(P.steam[0])); ripple(w1, flat(P.steam[1]));
      pn.poly([[px0 - 7, py0 - 0.2], [px0 - 5, py0 - 2.4], [px0 + 5, py0 - 2.4], [px0 + 7, py0 - 0.2], [px0 + 5, py0 + 1.4], [px0 - 5, py0 + 1.4]]).paint(M.iron);
      pn.poly([[px0 - 5, py0 - 2.4], [px0 + 5, py0 - 2.4], [px0 + 4, py0 - 3.6], [px0 - 4, py0 - 3.6]]).paint(M.brass, { bevel: 'l' });
      pn.ln(px0 - 6, py0 + 0.4, px0 + 6, py0 + 0.4, M.iron[1]);
      // 踝：喇叭形发射口
      pn.poly([[ex - 1.6, ey - 1], [ex + 1.6, ey - 1], [ex + 3.2, py0 - 3.4], [ex - 3.2, py0 - 3.4]]).paint(M.brass, { bevel: 'l' });
      // 小腿：套筒杆（外粗内细两节）
      pn.cap(...S.p(0, 0), ...S.p(S.len * 0.55, 0), 1.9).paint(M.leg);
      pn.cap(...S.p(S.len * 0.5, 0), ...S.p(S.len, 0), 1.1).paint(M.brass, { bevel: 'l' });
      pn.poly(S.pts([[S.len * 0.5 - 0.7, -2.4], [S.len * 0.5 + 0.7, -2.4], [S.len * 0.5 + 0.7, 2.4], [S.len * 0.5 - 0.7, 2.4]])).paint(M.iron, { outline: false });
      // 大腿：更粗的套筒 + 两道箍
      pn.cap(L.hx, L.hy, kx, ky, 2.6).paint(M.leg);
      for (const a of [T.len * 0.3, T.len * 0.66]) pn.poly(T.pts([[a - 0.8, -3], [a + 0.8, -3], [a + 0.8, 3], [a - 0.8, 3]])).paint(M.brass, { outline: false });
      // 膝：万向环（两只交错的椭圆环）
      pn.disc(kx, ky, 3.4).paint(M.iron); pn.disc(kx, ky, 1.5).paint(M.brass, { outline: false });
      pn.ln(kx - 3.4, ky, kx + 3.4, ky, M.brass[2]);
      pn.disc(L.hx, L.hy, 3.3).paint(M.iron); pn.disc(L.hx, L.hy, 1.2).paint(M.brass, { outline: false });
    },
  };

  LL.DESIGNS.push(
    { id: 'steamman', q: -1, name: '蒸汽人', sub: '汽缸腿 · 圆头靴', d: STEAMMAN, note: '' },
    { id: 'kangaroo', q: -1, name: '袋鼠跳腿', sub: '反关节 · 弹力筋', d: KANGAROO, note: '' },
    { id: 'levit', q: -1, name: '以太悬浮足', sub: '套筒杆 · 悬浮盘', d: LEVIT, note: '' });

  // ---------- 14 种的编制 ----------
  // main = 该材质的标准主线形态；其余是唯一变体（unique）。leg = SA.LEGLAB.DESIGNS 里的 id
  const SET = [
    { mt: 1, leg: 'mk2', main: true, name: '工装 Mk.II', ref: '现役造型', idea: '箱形梁大腿 + 液压撑杆 + 双支杆小腿 + 带肋平脚（反关节）。黄铜档只有这一种。' },
    { mt: 2, leg: 'heron', main: true, name: '鹭步', ref: '主线', idea: '三段鸟腿：膝盖朝前、跗关节高高翘在后；黄铜关节毂、膝后弹簧、三趾爪。轻快细长。' },
    { mt: 2, leg: 'wheel', name: '轮足', ref: '1903 迪普洛克 Pedrail 行走轮的思路', idea: '反关节腿末端是辐条轮，滑行不迈步，几乎不起伏。熟铁的「稳」变体。' },
    { mt: 3, leg: 'gren', main: true, name: '掷弹兵', ref: '主线', idea: '人形正膝：铆接圆筒大腿 + 黄铜箍，喇叭口护胫，平头重靴；膝盖是压力表，膝后一根蒸汽活塞。粗壮、稳。' },
    { mt: 3, leg: 'blade', name: '板簧跑刃', ref: '跑步假肢的叠层板簧', idea: '短大腿 + C 形叠层板簧刀片，着地被压弯、抬脚回弹。最快最弹。' },
    { mt: 3, leg: 'skirt', name: '裙甲堡', ref: '攻城盾墙 / 钟形裙甲', idea: '三层裙甲罩住大腿和膝盖，只露护胫和铁靴碎步走，剪影是钟形。最耐打。' },
    { mt: 4, leg: 'knight', main: true, name: '蒸汽圣骑', ref: '主线', idea: '哥特板甲：大腿甲带棱线、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴 + 马刺；胯上挂草摺。' },
    { mt: 4, leg: 'tabard', name: '圣堂 · 纹章罩袍', ref: '中世纪重甲罩袍', idea: '蒸汽圣骑 + 两腿之间一块随步伐摆的皮革罩袍，黄铜镶边、齿轮纹章。' },
    { mt: 5, leg: 'clock', main: true, name: '钟表巨像', ref: '主线', idea: '开框大腿里转着齿轮，膝盖是大齿轮，胫后缘是棘轮齿；脚是维多利亚家具的「爪握球」。' },
    { mt: 5, leg: 'stilt', name: '高跷', ref: '伸缩套筒', idea: '没有膝盖，三节伸缩套筒，抬脚靠缩短。最细最高的剪影，起伏最大。' },
    { mt: 5, leg: 'steamman', name: '蒸汽人', ref: '1868 德德里克「草原蒸汽人」', idea: '人形正膝，粗大的铆接汽缸大腿 + 直筒小腿 + 圆头铁靴；腿后一根蒸汽管，迈步时膝后喷白汽。' },
    { mt: 6, leg: 'dragon', main: true, name: '熔心龙骑', ref: '主线', idea: '三段龙腿：鳞甲大腿里嵌一座小炉膛、膝前尖刺、跗关节后刺、三爪 + 后爪。' },
    { mt: 6, leg: 'kangaroo', name: '袋鼠跳腿', ref: '19 世纪末弹跳机械', idea: '反关节，短粗大腿 + 细长小腿 + 长脚板；后面绷一根弹簧圈「弹力筋」，落地被压扁。起伏最大、跳跃感最强。' },
    { mt: 6, leg: 'levit', name: '以太悬浮足', ref: '以太合金（发光 = 能源语义）', idea: '两根黄铜套筒杆，膝盖是万向环；脚不着地，一块悬浮圆盘飘在地面上，盘下两圈涟漪。' },
  ];

  // 画一只整件双足（2×4：48×96），画到透明画布，坐标 (ox, oy) = 模块左上角。o = { a 步态角, mv, t 秒, stride }
  function figure(g, ox, oy, leg, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const p = { mv: !!o.mv, a: o.a || 0, stride: o.stride || 20, g: [0, 0], legs: leg, phase: (o.a || 0) * 4, t: o.t || 0 };
    p.bd = LL.bipedBob(p);
    LL.bipedArt(pn, ox, oy, p);
    pn.flush(g);
  }
  return { SET, figure };
})();
