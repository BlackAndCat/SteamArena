// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：真双足（2×4，48×96）画面探索 v2（2026-09-29）。用户对 v1 的意见：
//   ① T2 轮足取消，把 T5 的高跷换成熟铁色放进 T2；② T5 钟表巨像的脚很怪，重画；
//   ③ T6 袋鼠跳腿、悬浮足不通过，参考现实里的奇思妙想重新设计；圣堂纹章罩袍换一种做法放回来；
//   ④ 腰胯部分重新设计，至少 6 种供选；⑤ T1 工装两根撑杆是悬空的，改成符合物理的样子。
// 本期编制（13 种）：
//   主线 6（沿用 js/legs.js 的六档腿型）：T1 黄铜 工装 Mk.II · T2 熟铁 鹭步 · T3 钢 掷弹兵 · T4 镀镍 蒸汽圣骑 · T5 乌兹钢 钟表巨像 · T6 以太合金 熔心龙骑
//   唯一变体 7：熟铁 1（高跷，换成熟铁色）· 钢 2（板簧跑刃、裙甲堡）· 镀镍 1（圣堂 · 对开罩袍）· 乌兹钢 1（蒸汽人）· 以太合金 2（詹森连杆腿、缩放仪平行腿）
//   T6 两条新腿的现实参考：詹森连杆腿 = 荷兰艺术家 Theo Jansen 的「海滩兽」Strandbeest（11 根杆的「神圣数字」连杆，把曲柄转动变成近似平底的 D 形足迹）；
//     缩放仪平行腿 = 平行四连杆 / 缩放仪（pantograph，17 世纪绘图仪），俄亥俄州立大学 1980 年代「适应性悬挂行走车」的腿就是它——脚板永远保持水平。
// 历史参考：蒸汽人 = 1868 德德里克「草原蒸汽人」；高跷 = 伸缩套筒；纹章罩袍 = 十字军罩袍。
// 腰胯 7 种新设计（现役陀螺仪对照 + 7）都是真能动的机构：万向陀螺、球窝髋、蒸汽缸曲柄、差速齿轮、飞轮 + 瓦特调速器、马车板簧悬挂、回转环滚珠座圈。
window.SA = window.SA || {};

SA.BIP = (() => {
  const LL = SA.LEGLAB, U = LL.U, P = SA.PAL, { NEAR, gait, ik, bone, frame } = U, flat = U.flat, gear = U.gear, rivet = U.rivet;
  const TAU = Math.PI * 2;

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

  // ---------- 新画 2 · 詹森连杆腿（Theo Jansen 的海滩兽）----------
  // 真实的詹森「神圣数字」连杆：a 38.0 · b 41.5 · c 39.3 · d 40.1 · e 55.8 · f 39.4 · g 36.7 · h 65.7 · i 49.0 · j 50.0 · k 61.9 · l 7.8 · m 15.0。
  // 曲柄绕 O 转一圈，脚 F 走出一条底部近似平直的 D 形轨迹：着地半程脚匀速往后蹬，抬脚半程高高收起再落下。11 根杆全是刚性连杆（每个节点都是两圆求交，杆长恒定，没有悬空的东西）。
  // 整条连杆按 0.27 缩小，挂在一根带弹簧的立柱下面：立柱上端铰在胯上、下端是安装曲柄和固定铰点 A 的托板；悬挂伸缩时立柱跟着变长，连杆的落脚点始终对齐地面。
  const JN = { a: 38.0, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49.0, j: 50.0, k: 61.9, l: 7.8, m: 15.0 };
  const cinter = (p, r1, q, r2, sg) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = p[0] + dx * a / d, my = p[1] + dy * a / d;
    return [mx + sg * h * dy / d, my - sg * h * dx / d];
  };
  function jansen(th) {
    const A = [-JN.a, -JN.l], B = [JN.m * Math.cos(th), JN.m * Math.sin(th)];
    const n3 = cinter(A, JN.b, B, JN.j, 1), n4 = cinter(A, JN.c, B, JN.k, -1);
    const n5 = cinter(n3, JN.d, n4, JN.e, 1), n6 = cinter(n4, JN.f, n5, JN.g, -1), F = cinter(n6, JN.i, n5, JN.h, -1);
    return { A, B, n3, n4, n5, n6, F };
  }
  const JANSEN = {
    hipY: 14, bob: 2,
    leg(pn, L, ph, o) {
      const M = L.M, sc = 0.27;
      const th = o.mv ? (o.a || 0) + ph - 165 / 180 * Math.PI : 105 / 180 * Math.PI;
      const J = jansen(th), Oy = L.gy - 67 * sc - 1.6, Ox = L.hx - 0.5;
      const Q = (n) => [Ox + n[0] * sc, Oy + n[1] * sc];
      const A = Q(J.A), B = Q(J.B), n3 = Q(J.n3), n4 = Q(J.n4), n5 = Q(J.n5), n6 = Q(J.n6), F = Q(J.F);
      const bar = (p, q, r = 0.6) => pn.cap(p[0], p[1], q[0], q[1], r);
      // 背后一层杆：A–n4、B–n4、n4–n6（远一些，用暗一阶）
      bar(A, n4); bar(B, n4); bar(n4, n6); pn.paint(M.iron, { bevel: 'l' });
      // 前一层杆：A–n3、B–n3、n3–n5、n4–n5
      bar(A, n3); bar(B, n3); bar(n3, n5); bar(n4, n5); pn.paint(M.steel, { bevel: 'l' });
      // 脚三角板：n5–n6–F 三个铰点连成一块刚性的板（三边就是 g、i、h），中间开减重孔
      pn.poly([n5, n6, F]).cap(...n5, ...n6, 0.9).cap(...n6, ...F, 0.9).cap(...n5, ...F, 0.9).paint(M.iron);
      const gc = [(n5[0] + n6[0] + F[0]) / 3, (n5[1] + n6[1] + F[1]) / 3];
      pn.disc(gc[0], gc[1], 1.5).paint(flat(M.dark[0]), { outline: false, bevel: '' });
      pn.poly([[F[0] - 3.2, F[1] + 0.2], [F[0] + 3.6, F[1] + 0.2], [F[0] + 3.2, F[1] + 1.6], [F[0] - 3.4, F[1] + 1.6]]).paint(M.dark);
      for (const n of [n3, n4, n5, n6]) { pn.disc(n[0], n[1], 0.95).paint(M.brass, { bevel: 'l' }); }
      pn.disc(F[0], F[1], 1.1).paint(M.brass, { bevel: 'l' });
      // 托板：固定铰点 A 和曲柄轴 O 都长在这块板上，板下挂着整套连杆
      const x0 = A[0] - 1.8, x1 = Ox + 2.6, y0 = Oy - 2.8, y1 = Oy + 1;
      pn.poly([[x0, y0], [x1, y0], [x1, y1], [x0 + 0.6, y1]]).paint(M.iron);
      pn.disc(A[0], A[1], 1.1).paint(M.brass, { bevel: 'l' });
      // 曲柄：轴 O + 曲柄臂 + 曲柄销 B
      pn.cap(Ox, Oy, B[0], B[1], 0.8).paint(M.brass, { bevel: 'l' });
      pn.disc(Ox, Oy, 1.7).paint(M.brass); pn.disc(B[0], B[1], 0.9).paint(M.iron, { bevel: 'l' });
      // 立柱：上缸下杆 + 一圈弹簧，杆下端落在托板中央
      const sx = Ox + 1, sTop = L.hy, sBot = y0 + 0.4, mid = sTop + (sBot - sTop) * 0.5;
      pn.cap(sx, mid, sx, sBot, 1.2).paint(M.steam, { bevel: 'l' });
      pn.cap(sx, sTop, sx, mid, 2.5).paint(M.iron);
      for (let k = 2; k <= 2; k++) { const yy = mid + (sBot - mid) * k / 3; pn.poly([[sx - 3.2, yy - 0.5], [sx + 3.2, yy - 0.5], [sx + 3.2, yy + 0.5], [sx - 3.2, yy + 0.5]]).paint(M.brass, { outline: false, bevel: 'l' }); }
      pn.poly([[sx - 3.2, mid - 0.9], [sx + 3.2, mid - 0.9], [sx + 3.2, mid + 0.5], [sx - 3.2, mid + 0.5]]).paint(M.brass, { outline: false });
      pn.disc(L.hx, L.hy, 3.2).paint(M.iron); pn.disc(L.hx, L.hy, 1.2).paint(M.brass, { outline: false });
    },
  };

  // ---------- 新画 3 · 缩放仪平行腿：平行四连杆，脚板永远水平 ----------
  // 大腿、小腿各是一对等长平行杆，两端是竖直的铰板：胯板（固定）、膝板、踝板永远和胯板平行，
  // 所以脚板不管腿怎么弯都保持水平（俄亥俄州立「适应性悬挂行走车」的思路）。每段平行四边形的对角线是一根液压缸——对角线随腿弯曲而伸缩，这正是缸的用处。
  const PANTO = {
    hipY: 14, bob: 2,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7.5, 5.5), ws = 2.7;
      const ax = L.hx + 1 + g.x, ay = L.gy - ws - 1.7 - g.lift;
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, ax, ay, 15, 15, 1);
      const bars = (x0, y0, x1, y1) => { for (const s of [-1, 1]) pn.cap(x0, y0 + s * ws, x1, y1 + s * ws, 0.85); };
      // 对角液压缸：上一个铰点到下一个铰点（缸体 + 活塞杆各占一半）
      const ram = (x0, y0, x1, y1) => {
        const mx = x0 + (x1 - x0) * 0.5, my = y0 + (y1 - y0) * 0.5;
        pn.cap(mx, my, x1, y1, 0.55).paint(M.steam, { bevel: 'l' }); pn.cap(x0, y0, mx, my, 1.3).paint(M.iron);
      };
      // 远一层：后杆 + 液压缸；近一层：前杆
      pn.cap(L.hx, L.hy + ws, kx, ky + ws, 0.85).cap(kx, ky + ws, ex, ey + ws, 0.85).paint(M.iron, { bevel: 'l' });
      ram(L.hx, L.hy + ws, kx, ky - ws); ram(kx, ky + ws, ex, ey - ws);
      pn.cap(L.hx, L.hy - ws, kx, ky - ws, 0.85).cap(kx, ky - ws, ex, ey - ws, 0.85).paint(M.steel, { bevel: 'l' });
      // 铰板（竖直）：胯 / 膝 / 踝，铰点是黄铜销
      for (const [px, py, w] of [[L.hx, L.hy, 1.7], [kx, ky, 1.9], [ex, ey, 1.7]]) {
        pn.poly([[px - w, py - ws - 1.5], [px + w, py - ws - 1.5], [px + w, py + ws + 1.5], [px - w, py + ws + 1.5]]).paint(M.iron);
        for (const s of [-1, 1]) pn.disc(px, py + s * ws, 0.9).paint(M.brass, { outline: false, bevel: 'l' });
      }
      // 脚板：挂在踝板底下，永远水平；前掌长、后跟短，底下一排防滑齿
      const fy = ey + ws + 0.2;
      pn.poly([[ex - 6.4, fy], [ex + 8.2, fy], [ex + 11.2, fy + 1.2], [ex + 11.2, fy + 1.9], [ex - 6.8, fy + 1.9], [ex - 6.8, fy + 0.6]]).paint(M.leg);
      pn.poly([[ex - 6.8, fy + 1.1], [ex + 11.2, fy + 1.1], [ex + 11.2, fy + 1.9], [ex - 6.8, fy + 1.9]]).paint(M.dark, { outline: false, bevel: '' });
      pn.poly([[ex - 1.6, fy - 0.2], [ex + 1.6, fy - 0.2], [ex + 3.4, fy + 1.1], [ex - 3.4, fy + 1.1]]).paint(M.iron, { bevel: 'l' });
      if (pn.hi) for (let u = -5; u < 10; u += 2) pn.dot(ex + u, fy + 1.5, M.leg[3]);
      pn.disc(L.hx, L.hy, 2.6).paint(M.iron); pn.disc(L.hx, L.hy, 1).paint(M.brass, { outline: false });
    },
  };

  LL.DESIGNS.push(
    { id: 'steamman', q: -1, name: '蒸汽人', sub: '汽缸腿 · 圆头靴', d: STEAMMAN, note: '' },
    { id: 'jansen', q: -1, name: '詹森连杆腿', sub: '海滩兽连杆 · 立柱弹簧', d: JANSEN, note: '' },
    { id: 'panto', q: -1, name: '缩放仪平行腿', sub: '平行四连杆 · 脚板水平', d: PANTO, note: '' });

  // ---------- 13 种的编制 ----------
  // main = 该材质的标准主线形态；其余是唯一变体（unique）。leg = SA.LEGLAB.DESIGNS 里的 id
  const SET = [
    { mt: 1, leg: 'mk2', main: true, name: '工装 Mk.II', ref: '现役造型', idea: '箱形梁大腿 + 跨膝液压撑杆 + 双支杆小腿 + 带肋平脚（反关节）。黄铜档只有这一种。撑杆两头现在都铰在腿上：缸体在大腿前缘的托耳上、活塞杆在小腿前缘的托耳上，膝盖一弯它就跟着缩短。' },
    { mt: 2, leg: 'heron', main: true, name: '鹭步', ref: '主线', idea: '三段鸟腿：膝盖朝前、跗关节高高翘在后；黄铜关节毂、膝后弹簧、三趾爪。轻快细长。' },
    { mt: 2, leg: 'stilt', name: '高跷', ref: '伸缩套筒（原 T5，换成熟铁色）', idea: '没有膝盖，三节伸缩套筒，抬脚靠缩短。最细最高的剪影，起伏最大。' },
    { mt: 3, leg: 'gren', main: true, name: '掷弹兵', ref: '主线', idea: '人形正膝：铆接圆筒大腿 + 黄铜箍，喇叭口护胫，平头重靴；膝盖是压力表，膝后一根蒸汽活塞。粗壮、稳。' },
    { mt: 3, leg: 'blade', name: '板簧跑刃', ref: '跑步假肢的叠层板簧', idea: '短大腿 + C 形叠层板簧刀片，着地被压弯、抬脚回弹。最快最弹。' },
    { mt: 3, leg: 'skirt', name: '裙甲堡', ref: '攻城盾墙 / 钟形裙甲', idea: '三层裙甲罩住大腿和膝盖，只露护胫和铁靴碎步走，剪影是钟形。最耐打。' },
    { mt: 4, leg: 'knight', main: true, name: '蒸汽圣骑', ref: '主线', idea: '哥特板甲：大腿甲带棱线、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴 + 马刺；胯上挂草摺。' },
    { mt: 4, leg: 'tabard', name: '圣堂 · 对开罩袍', ref: '十字军罩袍（surcoat）', idea: '蒸汽圣骑 + 每条腿各挂一片白布红十字罩袍：挂在腰带上、跟着大腿转一部分，锯齿下摆比腰晚半拍甩动，黄铜腰带和下摆镶边。' },
    { mt: 5, leg: 'clock', main: true, name: '钟表巨像', ref: '主线', idea: '开框大腿里转着齿轮，膝盖是大齿轮，胫后缘是棘轮齿；脚改成宽脚板：脚跟发条盒、脚尖小齿轮转动、鞋底一排棘齿，踝上扣黄铜半球承窝。' },
    { mt: 5, leg: 'steamman', name: '蒸汽人', ref: '1868 德德里克「草原蒸汽人」', idea: '人形正膝，粗大的铆接汽缸大腿 + 直筒小腿 + 圆头铁靴；腿后一根蒸汽管，迈步时膝后喷白汽。' },
    { mt: 6, leg: 'dragon', main: true, name: '熔心龙骑', ref: '主线', idea: '三段龙腿：鳞甲大腿里嵌一座小炉膛、膝前尖刺、跗关节后刺、三爪 + 后爪。' },
    { mt: 6, leg: 'jansen', name: '詹森连杆腿', ref: 'Theo Jansen 的海滩兽（Strandbeest）', idea: '真实的詹森连杆：11 根杆的「神圣数字」，曲柄一转，脚走出底部近似平直的 D 形轨迹——着地匀速往后蹬、抬脚高高收起。整套连杆挂在一根带弹簧的立柱下面，曲柄和固定铰点都长在托板上。' },
    { mt: 6, leg: 'panto', name: '缩放仪平行腿', ref: '平行四连杆 / 缩放仪；俄亥俄州立「适应性悬挂行走车」', idea: '大腿、小腿各是一对等长平行杆，胯板、膝板、踝板永远互相平行，所以脚板不管腿怎么弯都保持水平；每段的对角线是一根液压缸，随腿弯曲伸缩。' },
  ];

  // ---------- 腰胯（真双足上两行的躯干）7 种新设计 + 现役对照 ----------
  // 每一种都画在同一块 48 宽的区域里（cx = 胯列中心，Y = 胯顶）：顶上 34 宽的黄铜环和上面的模块接（高 6），底下 Y+31 附近是腿的挂点（近侧 cx-2、远侧 cx+6），
  // 所以每一种胯的下沿都留出安装两只腿的位置；机构都是真的：连杆、曲柄、齿轮、滚珠按几何和步态角画，不是贴图。
  const HIP_MAT = { knight: 'steel', tabard: 'steel', skirt: 'steel', clock: 'brass', dragon: 'fire' };
  const hipRamp = (legId) => { const m = HIP_MAT[legId]; return m === 'steel' ? NEAR.steel : m === 'brass' ? NEAR.brass : NEAR.iron; };
  const ell = (pn, cx, cy, rx, ry, tilt, front, back) => {
    const n = 36, c = Math.cos(tilt), s = Math.sin(tilt);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pn.dot(cx + x * c - y * s, cy + x * s + y * c, Math.sin(a) > 0 ? front : back); }
  };
  const topRing = (pn, cx, Y, o) => {   // 和上面模块相接的黄铜环（刻痕随步伐转）
    pn.rect(cx - 17, Y - 1, 34, 6).paint(NEAR.brass);
    const sp = Math.floor((o.phase || 0) / 3);
    for (let k = 0; k < 6; k++) pn.fill(cx - 16 + ((k * 6 + sp) % 32 + 32) % 32, Y + 1, 1, 3, P.brass[0]);
  };
  const neck = (pn, cx, Y) => pn.poly([[cx - 9, Y + 30], [cx + 9, Y + 30], [cx + 5, Y + 36], [cx - 5, Y + 36]]).paint(NEAR.dark);
  const trap = (pn, cx, Y, R, w0 = 20, w1 = 13, y0 = 5, y1 = 31) => pn.poly([[cx - w0, Y + y0], [cx + w0, Y + y0], [cx + w1, Y + y1], [cx - w1, Y + y1]]).paint(R);
  const drive = (o) => (o.mv ? (o.a || 0) * 1.5 : (o.t || 0) * 1.4);   // 机构的转角：走起来跟步态角，站着时慢慢空转

  // 注意：腿的胯关节盘（半径约 7～10 像素）压在 Y+22 以下的中间位置，所以机构都放在上面的 Y+5 ～ Y+22 这条带子里（左右两侧也可以用）。
  const HIPS = [
    { id: 'gyro', name: '现役 · 陀螺仪', sub: '对照：回转环 + 倒梯形 + 陀螺窗', draw: (pn, cx, Y, o) => LL.pelvis(pn, cx, Y, o) },

    // H1 万向陀螺：三层万向环（外环固定、中环绕竖轴转、内环绕横轴转），中心一颗飞轮转子——真陀螺仪的结构
    { id: 'gimbal', name: '万向陀螺', sub: '三层万向环，中环 / 内环各绕一根轴转', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId);
      topRing(pn, cx, Y, o); trap(pn, cx, Y, R); neck(pn, cx, Y);
      rivet(pn, cx - 18, Y + 7); rivet(pn, cx + 15, Y + 7);
      const gy = Y + 14, t = o.t || 0, tilt = (o.wob == null ? 0.04 : o.wob) * Math.sin(t * 9) + (o.tilt || 0);
      pn.disc(cx, gy, 9.6).paint(NEAR.dark, { bevel: 's' });
      ell(pn, cx, gy, 8.8, 8.8, 0, P.brass[3], P.brass[1]); ell(pn, cx, gy, 8, 8, 0, P.brass[2], P.brass[1]);   // 外环（固定，正对着我们）
      pn.fill(cx - 0.5, gy - 9.6, 1, 2, P.brass[2]); pn.fill(cx - 0.5, gy + 7.8, 1, 2, P.brass[2]);           // 外环 / 中环的竖轴销
      const s1 = t * 5, rx = 0.8 + 6.4 * Math.abs(Math.cos(s1));
      ell(pn, cx, gy, rx, 6.6, tilt, P.brass[3], P.brass[1]); ell(pn, cx, gy, Math.max(0.5, rx - 1), 6.6, tilt, P.brass[2], P.brass[0]);   // 中环：绕竖轴
      const s2 = t * 8, ry = 0.8 + 3.8 * Math.abs(Math.cos(s2));
      ell(pn, cx, gy, 4, ry, tilt, P.brass[3], P.brass[1]);                                                     // 内环：绕横轴
      pn.disc(cx, gy, 2).paint(NEAR.brass, { bevel: 'l' }); pn.dot(cx - 0.8, gy - 0.8, P.brass[3]);
    } },

    // H2 球窝髋：一颗大黄铜球关节嵌在带压盖螺栓的钢承窝里；球上有经线纬线，随步态转
    { id: 'ball', name: '球窝髋', sub: '黄铜球关节 + 钢承窝 + 压盖螺栓', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId);
      topRing(pn, cx, Y, o); trap(pn, cx, Y, R, 20, 15, 5, 31); neck(pn, cx, Y);
      const bx = cx + 1, by = Y + 14.5, rot = drive(o) * 0.5;
      pn.disc(bx, by, 10.4).paint(NEAR.steel, { bevel: 's' });                                                    // 承窝（钢）
      pn.disc(bx, by, 8.6).paint(NEAR.dark, { outline: false, bevel: 's' });
      pn.disc(bx, by, 8).paint(NEAR.brass);                                                                       // 球
      ell(pn, bx, by, Math.max(0.6, 7.8 * Math.abs(Math.sin(rot))), 7.8, 0, P.brass[0], P.brass[1]);                // 经线
      ell(pn, bx, by, 7.8, 2.2 + Math.sin(rot * 0.7) * 1.1, 0, P.brass[0], P.brass[1]);                             // 纬线
      pn.dot(bx - 3, by - 3.6, P.brass[3]); pn.dot(bx - 2, by - 4.2, P.brass[3]);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; if (Math.sin(a) > 0.55) continue; rivet(pn, bx + Math.cos(a) * 9.6 - 1, by + Math.sin(a) * 9.6 - 1); }   // 压盖螺栓
    } },

    // H3 蒸汽缸曲柄：左右各一只蒸汽缸，活塞杆经十字头、连杆推曲柄盘（两缸曲柄错 90°，就是蒸汽机车的传动）
    { id: 'cyl', name: '蒸汽缸曲柄', sub: '双缸 · 十字头 · 连杆 · 曲柄盘', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId), th = drive(o) * 1.3, cyy = Y + 13.5, rc = 2.6, Lr = 11;
      topRing(pn, cx, Y, o);
      trap(pn, cx, Y, R, 15, 12.5, 5, 31); neck(pn, cx, Y);
      for (const [side, ph2] of [[-1, 0], [1, Math.PI / 2]]) {
        const a = th + ph2, px = cx + Math.cos(a) * rc, py = cyy + Math.sin(a) * rc;
        const xh = px + side * Math.sqrt(Lr * Lr - (py - cyy) ** 2);            // 十字头在缸轴上的位置
        pn.rect(cx + side * 10 - (side > 0 ? 0 : 11), cyy - 5, 11, 10).paint(NEAR.iron);   // 缸体
        pn.rect(cx + side * 21 - (side > 0 ? 0 : 3), cyy - 6, 3, 12).paint(NEAR.brass);    // 缸盖
        pn.rect(cx + side * 10 - (side > 0 ? 0 : 2), cyy - 3, 2, 6).paint(NEAR.dark, { outline: false, bevel: '' });
        pn.cap(cx + side * 10, cyy, xh, cyy, 0.8).paint(NEAR.steam, { bevel: 'l' });   // 活塞杆
        pn.rect(xh - 1.4, cyy - 1.8, 2.8, 3.6).paint(NEAR.brass);                       // 十字头
        pn.cap(xh, cyy, px, py, 0.7).paint(NEAR.steel, { bevel: 'l' });                 // 连杆
      }
      pn.disc(cx, cyy, 4.6).paint(NEAR.brass); pn.disc(cx, cyy, 1.4).paint(NEAR.dark, { outline: false, bevel: '' });
      for (const ph2 of [0, Math.PI / 2]) { const a = th + ph2; pn.disc(cx + Math.cos(a) * rc, cyy + Math.sin(a) * rc, 0.9).paint(NEAR.steel, { bevel: 'l' }); }
    } },

    // H4 差速齿轮：胯体开一扇窗，露出咬合的齿轮组（转速比 = 齿数比反过来）
    { id: 'diff', name: '差速齿轮', sub: '开窗露出咬合的齿轮组', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId), th = drive(o);
      topRing(pn, cx, Y, o); trap(pn, cx, Y, R); neck(pn, cx, Y);
      pn.rect(cx - 17, Y + 6, 34, 16).paint(NEAR.dark, { bevel: 's' });
      const nA = 12, nB = 11, rA = 6.4, rB = 5.8, ay = Y + 14;
      const ax = cx - 8, bx = ax + rA + rB + 0.2;
      gear(pn, ax, ay, rA, nA, th, NEAR.brass, NEAR.iron);
      gear(pn, bx, ay, rB, nB, -th * nA / nB + Math.PI / nB, NEAR.steel, NEAR.iron);
      gear(pn, bx + 6.1, ay - 5.1, 2.2, 5, th * nB / 5 + 0.5, NEAR.brass, NEAR.iron);
      pn.fill(cx - 17, Y + 6, 34, 1, P.brass[2]); pn.fill(cx - 17, Y + 21, 34, 1, P.brass[1]);
    } },

    // H5 飞轮 + 瓦特调速器：飞轮经皮带带动竖轴，两只飞球随转速甩开（飞球高度 = 连杆几何：套筒 y = 2·l·cosφ）
    { id: 'governor', name: '飞轮调速器', sub: '飞轮 + 皮带 + 瓦特飞球', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId), th = drive(o), fast = o.mv ? 1 : 0;
      topRing(pn, cx, Y, o); trap(pn, cx, Y, R, 20, 14, 5, 31); neck(pn, cx, Y);
      const gx = cx + 13, top = Y + 7, base = Y + 21, phi = 0.5 + fast * 0.4 + Math.sin((o.t || 0) * 3) * 0.04, la = 7, lk = 4.2;
      const fx = cx - 12, fy = Y + 14;
      pn.ln(fx + 1, fy + 7.4, gx - 2, base + 1, P.dark[0]); pn.ln(fx + 2, fy + 8.2, gx - 1.6, base + 2, P.dark[0]);      // 皮带
      pn.disc(fx, fy, 8).paint(NEAR.dark, { bevel: 's' });
      pn.disc(fx, fy, 6.8).paint(NEAR.brass);
      pn.disc(fx, fy, 4.6).paint(NEAR.dark, { outline: false, bevel: 's' });
      for (let k = 0; k < 6; k++) { const a = th * 1.4 + k / 6 * TAU; pn.cap(fx, fy, fx + Math.cos(a) * 5.6, fy + Math.sin(a) * 5.6, 0.55); }
      pn.paint(NEAR.brass, { outline: false, bevel: '' });
      pn.disc(fx, fy, 1.5).paint(NEAR.steel, { bevel: 'l' });
      pn.cap(gx, top, gx, base, 0.9).paint(NEAR.steel, { bevel: 'l' });
      const sy = top + 2 * lk * Math.cos(phi);
      for (const s of [-1, 1]) {
        const bxx = gx + s * la * Math.sin(phi), byy = top + la * Math.cos(phi), ax = gx + s * lk * Math.sin(phi), ay = top + lk * Math.cos(phi);
        pn.cap(gx, top, bxx, byy, 0.55).cap(ax, ay, gx, sy, 0.5).paint(NEAR.brass, { bevel: 'l' });
        pn.disc(bxx, byy, 1.9).paint(NEAR.iron, { bevel: 'l' });
      }
      pn.disc(gx, top, 1.1).paint(NEAR.brass, { bevel: 'l' }); pn.rect(gx - 1.7, sy - 0.6, 3.4, 1.8).paint(NEAR.brass);
      pn.disc(gx, base - 0.5, 2).paint(NEAR.iron, { bevel: 'l' });
    } },

    // H6 马车板簧悬挂：胯体是一块「车厢」，用吊环挂在一副多层叠板簧（弓形）两端，腿挂在簧中央——维多利亚马车的悬挂
    { id: 'spring', name: '板簧悬挂', sub: '车厢挂在多层叠板簧上，腿挂在簧中央', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId), t = o.t || 0, flex = o.mv ? 1 * Math.sin((o.a || 0) * 2) : 0.5 * Math.sin(t * 3);
      topRing(pn, cx, Y, o);
      pn.poly([[cx - 20, Y + 5], [cx + 20, Y + 5], [cx + 18, Y + 15], [cx - 18, Y + 15]]).paint(R);      // 车厢
      rivet(pn, cx - 17, Y + 7); rivet(pn, cx + 14, Y + 7);
      pn.disc(cx, Y + 10, 3.8).paint(NEAR.dark, { bevel: 's' }); ell(pn, cx, Y + 10, 3, 3, 0, P.brass[2], P.brass[1]);
      const ang = t * 7; pn.ln(cx - Math.cos(ang) * 2.6, Y + 10 - Math.sin(ang) * 2.6, cx + Math.cos(ang) * 2.6, Y + 10 + Math.sin(ang) * 2.6, P.brass[3]);
      // 板簧：弓形（两端上翘挂在车厢下，中央最低压着腿）。最长一片在最外（最下）
      const sag = 9 + flex, yEnd = Y + 19;
      for (let k = 0; k < 5; k++) {
        const w = 23 - k * 3.8, off = -k * 1.5;
        for (let i = 0; i < 16; i++) {
          const u0 = -w + 2 * w * i / 16, u1 = -w + 2 * w * (i + 1) / 16;
          const yf = (u) => yEnd + off + sag * (1 - Math.min(1, (u / 23) ** 2));
          pn.cap(cx + u0, yf(u0), cx + u1, yf(u1), 0.8);
        }
        pn.paint(k === 0 ? NEAR.iron : NEAR.steel, { bevel: 'l' });
      }
      for (const s of [-1, 1]) {   // 吊环：车厢下角 → 簧端环眼
        pn.cap(cx + s * 17.5, Y + 15, cx + s * 22.6, yEnd - 0.4, 0.9).paint(NEAR.brass, { bevel: 'l' });
        pn.disc(cx + s * 22.6, yEnd, 1.5).paint(NEAR.brass, { bevel: 'l' });
      }
      pn.rect(cx - 5, Y + 21, 10, 7).paint(NEAR.brass); rivet(pn, cx - 4, Y + 22); rivet(pn, cx + 1, Y + 22);   // 中央夹块（U 形螺栓）
      pn.poly([[cx - 9, Y + 28], [cx + 9, Y + 28], [cx + 6, Y + 36], [cx - 6, Y + 36]]).paint(NEAR.dark);
    } },

    // H7 回转环滚珠座圈：上面一块转台，下面一圈滚珠座圈（前半圈的滚珠随步态滚过），底下是固定的下座——坦克炮塔座圈的思路
    { id: 'race', name: '滚珠座圈', sub: '炮塔式座圈 + 一圈滚珠 + 驱动小齿轮', draw(pn, cx, Y, o) {
      const R = hipRamp(o.legId), th = drive(o) * 0.9;
      topRing(pn, cx, Y, o);
      pn.poly([[cx - 20, Y + 5], [cx + 20, Y + 5], [cx + 21, Y + 11], [cx - 21, Y + 11]]).paint(R);      // 转台
      rivet(pn, cx - 18, Y + 6); rivet(pn, cx + 15, Y + 6);
      pn.rect(cx - 21, Y + 11, 42, 9).paint(NEAR.dark, { bevel: 's' });                                        // 座圈槽
      pn.fill(cx - 21, Y + 11, 42, 1, P.brass[2]); pn.fill(cx - 21, Y + 19, 42, 1, P.brass[1]);
      const nb = 9;
      for (let k = 0; k < nb; k++) {                                                                       // 滚珠：绕座圈中心转，只画在前半圈
        const a = th + k / nb * TAU, s = Math.sin(a);
        if (s < -0.05) continue;
        pn.disc(cx + Math.cos(a) * 18, Y + 15.4 + s * 1.2, 2).paint([P.iron[0], P.iron[3], P.iron[4], '#e6eaf0'], { bevel: 'l' });
      }
      pn.poly([[cx - 19, Y + 20], [cx + 19, Y + 20], [cx + 13, Y + 31], [cx - 13, Y + 31]]).paint(R);      // 下座
      neck(pn, cx, Y);
      gear(pn, cx + 19, Y + 24, 3.4, 8, -th * 2, NEAR.brass, NEAR.iron);                                    // 驱动转台的小齿轮（在下座外侧）
    } },
  ];

  // 画一只整件双足（2×4：48×96）到透明画布，坐标 (ox, oy) = 模块左上角。o = { a 步态角, mv, t 秒, stride, hip: HIPS 的 id }
  function figure(g, ox, oy, leg, o = {}) {
    const pn = LL.Pen(g.canvas.width, g.canvas.height).at(1, 0, 0);
    const p = { mv: !!o.mv, a: o.a || 0, stride: o.stride || 20, g: [0, 0], legs: leg, phase: (o.a || 0) * 4, t: o.t || 0 };
    p.bd = LL.bipedBob(p);
    const H = o.hip && HIPS.find(h => h.id === o.hip);
    if (!H || H.id === 'gyro') LL.bipedArt(pn, ox, oy, p);
    else {
      LL.bipedArt(pn, ox, oy, p, 'far');
      H.draw(pn, ox + 24, oy + p.bd, { legId: leg, mv: p.mv, a: p.a, phase: p.phase, t: p.t });
      LL.bipedArt(pn, ox, oy, p, 'legs');
    }
    pn.flush(g);
  }
  return { SET, HIPS, figure };
})();
