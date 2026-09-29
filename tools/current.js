// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：机炮 mg + 双联机枪 mg2 v2（2×2，2026-09-28）。用户否决 v1（带弹鼓 / 弹斗 / 弹箱、太现代，已归档 archive/mg-mg2-v1）：
// 「考虑最古早的设计，不要带供弹系统；用更多蒸汽朋克元素，不要显得过于现代」。
// 所以 v2 全部取 1870 年以前的速射武器：温南斯 / 珀金斯蒸汽离心炮、雷菲米特留兹青铜炮、箍炮 + 蒸汽活塞、中世纪风琴炮、
// 诺克排枪式青铜双管（海豚提耳 + 尾钮）、希罗汽转球。看不到任何弹药和供弹，动力全是蒸汽：锅炉、铜管、安全阀、汽笛、活塞、白汽。
// 炮身多用青铜 / 黄铜铸造（按规则，镀镍起换成各材料的饰件色）；铁件跟材料换色。
// 固定部分 = 车体上的装甲壳 / 炮耳墙（T1～2 铸造圆角 → T3～4 方壳平顶 → T5～6 斜面装甲），转动部分 = 炮身（绕耳轴转到仰角）。
// 枪口是老式的：① 郁金香口（口部鼓一圈）→ ② + 黄铜口箍 → ③ 冠状口（再外翻一圈、带缺口）；不用方制退器、散热片这类现代件。
// 2×2 零件照直射火炮：接缝铆钉 2 → 3 → 4（T1～3 黄铜、镀镍起钢质淡青）、散热口、钢起包角铁、镀镍起珐琅铭牌 + 直径 11 压力表。
// o = { a 仰角°, k 后坐 0~8, f 帧 }
window.SA = window.SA || {};

SA.CUR = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, BRASS } = SA.CAND;
  const COPPER = ['#3b2820', '#6b4632', '#8f6044', '#b3825c'];   // 同游戏里水罐的暗紫铜
  const RIVET_C = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };
  const rivetC = (x, y, c) => { R(x, y, 2, 2, c[0]); px(x + 1, y + 1, c[1]); px(x + 2, y + 1, c[2]); px(x + 1, y + 2, c[2]); };
  const riveXs = (n, x0, x1) => Array.from({ length: n }, (_, i) => Math.round(x0 + (x1 - x0 - 2) * i / (n - 1)));
  let G = null;
  function corner(x, y, fx = 1, fy = 1) {
    const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
    for (let i = 0; i < 5; i++) { px(X(i), Y(0), P.dark[0]); px(X(0), Y(i), P.dark[0]); px(X(i), Y(1), P.dark[3]); px(X(1), Y(i), P.dark[3]); }
    px(X(1), Y(1), P.iron[4]); px(X(2), Y(2), P.dark[0]);
  }
  function gauge(cx, cy) {
    disc(cx, cy, 5, P.brass[0]); disc(cx, cy, 4, P.brass[2]); disc(cx, cy, 3.2, P.steam[2]);
    px(Math.round(cx - 3), Math.round(cy - 3), P.brass[3]);
    for (let i = 0; i < 4; i++) { const a = Math.PI * (1.6 + i * 0.14); px(Math.round(cx - 0.5 + Math.cos(a) * 2.4), Math.round(cy - 0.5 + Math.sin(a) * 2.4), P.gauge[1]); }
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2.5), Math.round(cy - 2), 1, P.dark[0]);
    px(Math.round(cx - 0.5), Math.round(cy - 0.5), P.fire[1]);
  }
  function plate(x, y) {
    R(x, y, 10, 6, P.brass[0]); R(x + 1, y + 1, 8, 4, P.brass[2]); R(x + 1, y + 1, 8, 1, P.brass[3]);
    R(x + 2, y + 2, 6, 2, '#1c1a1f'); R(x + 3, y + 2, 4, 1, P.brass[1]); R(x + 3, y + 3, 3, 1, P.brass[1]);
  }
  function vents(x, y, style, n) {
    const slot = (sx, sy, w) => { R(sx, sy, w, 1, P.iron[0]); R(sx, sy + 1, w, 1, P.iron[3]); };
    if (style === 'rows') { const gap = n <= 2 ? 4 : 3; for (let i = 0; i < n; i++) slot(x, y + 1 + i * gap, 12); }
    else if (style === 'grid') { for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) slot(x + c * 8, y + i * 3, 6); }
    else for (let i = 0; i < n; i++) for (let k = 0; k < 7; k++) { px(x + i * 4 + (k >> 1), y + k, P.iron[0]); px(x + i * 4 + (k >> 1) + 1, y + k, P.iron[3]); }
  }
  const TIERS = [
    { f: 'raw', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { f: 'raw', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { f: 'box', b: 2, vent: ['rows', 3], riv: [3, 'brass'], parts: ['corners'] },
    { f: 'box', b: 2, vent: ['rows', 3], riv: [3, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { f: 'slant', b: 3, vent: ['grid', 3], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { f: 'slant', b: 3, vent: ['louver', 3], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
  ];

  // ---------- 装甲壳 ----------
  function shade(x, y, w, h, inside) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inside(xx, yy)) continue;
      if (!inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) || !inside(xx, yy + 1)) { px(xx, yy, P.iron[0]); continue; }
      px(xx, yy, !inside(xx - 2, yy) || !inside(xx, yy - 2) ? P.iron[4] : !inside(xx + 2, yy) || !inside(xx, yy + 2) ? P.iron[2] : P.iron[3]);
    }
  }
  function shellIn(x, y, w, h, f, r) {
    return (xx, yy) => {
      if (xx < x || yy < y || xx >= x + w || yy >= y + h) return false;
      if (f === 'box') return true;
      const ex = xx < x + r ? x + r - xx : xx >= x + w - r ? xx - (x + w - r - 1) : 0, ey = yy < y + r ? y + r - yy : yy >= y + h - r ? yy - (y + h - r - 1) : 0;
      if (f === 'raw') return ex * ex + ey * ey <= r * r + r * 0.6;
      const tx = xx - x, ty = yy - y, d = r + 2;
      return !(ty + tx < d - 2 || ty + (w - 1 - tx) < d + 1);
    };
  }
  const shell = (x, y, w, h, f, r) => { shade(x, y, w, h, shellIn(x, y, w, h, f, r)); if (f === 'box') { R(x - 1, y - 1, w + 2, 2, P.iron[0]); R(x, y - 1, w, 1, P.iron[3]); } };
  const seam = (x0, x1, y) => { R(x0, y, x1 - x0 + 1, 1, P.iron[1]); R(x0, y + 1, x1 - x0 + 1, 1, P.iron[4]); };
  // 车体下壳：壳 + 底座 + 接缝；零件位：左段表（竖直居中）、接缝铆钉在右段 (20～42)、散热口 (19, top+7，最多两排)、铭牌 (34, top+7)、底角包角铁
  function hull(x, y, T, top) {
    shell(x + 3, y + top, 42, 44 - top, T.f, 4);
    seam(x + 5, x + 42, y + top + 3);
    const [vs, vn] = T.vent; vents(x + 19, y + top + 7, vs, vs === 'louver' ? vn : Math.min(vn, 2));
    box(x + 2, y + 44, 44, 4, IRON); R(x + 3, y + 45, 42, 1, P.iron[3]);
    if (T.parts.includes('corners')) { corner(x + 3, y + 39, 1, -1); corner(x + 40, y + 39, -1, -1); }
  }
  const hullOver = (top) => (G0, x, y, T) => {
    SA.CAND.use(G0); G = G0;
    for (const rx of riveXs(T.riv[0], 20, 43)) rivetC(x + rx, y + top + 4, RIVET_C[T.riv[1]]);
    if (T.parts.includes('plate')) plate(x + 34, y + top + 7);
    if (T.parts.includes('gauge')) gauge(x + 10.5, y + (top + 47) / 2);
  };
  // 炮耳墙：两块铆接铁板夹着耳轴（车体上的，不是轮式炮架），T5～6 前沿斜切
  function cheek(x, y, cx, cy, T, w = 12, h = 12) {
    const x0 = x + cx - (w >> 1), y0 = y + cy - 3;
    shade(x0, y0, w, h, (xx, yy) => xx >= x0 && xx < x0 + w && yy >= y0 && yy < y0 + h && (T.f !== 'slant' || xx - x0 < w - Math.max(0, 4 - (yy - y0))) && (T.f !== 'raw' || !((xx === x0 || xx === x0 + w - 1) && yy === y0)));
    px(x0 + 2, y0 + h - 3, P.iron[4]); px(x0 + w - 3, y0 + h - 3, P.iron[4]);
  }
  const trunnion = (cx, cy) => { disc(cx + 0.5, cy + 0.5, 2.4, P.brass[0]); disc(cx + 0.5, cy + 0.5, 1.6, P.brass[2]); px(cx, cy, P.brass[3]); };

  // ---------- 老式炮身零件（水平画，C / M = 耳轴）----------
  // 铸造锥形炮身：从 x0（半高 h0）收到 x1（半高 h1），ramp = [描边, 暗, 固有, 亮]；上沿一道高光、下沿一道暗
  function cast(x0, x1, M, h0, h1, ramp) {
    for (let x = x0; x < x1; x++) {
      const hh = Math.round(h0 + (h1 - h0) * (x - x0) / Math.max(1, x1 - x0 - 1));
      R(x, M - hh, 1, hh * 2 + 1, ramp[0]);
      if (hh > 0) { R(x, M - hh + 1, 1, hh * 2 - 1, ramp[2]); px(x, M - hh + 1, ramp[3]); if (hh > 2) px(x, M - hh + 2, ramp[3]); if (hh > 1) px(x, M + hh - 1, ramp[1]); }
    }
  }
  const BRONZE = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]];
  const IRONR = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]];
  // 加强箍 / 腰箍：比炮身各高 1px 的一圈
  const band = (x0, w, M, hh, ramp) => { R(x0, M - hh, w, hh * 2 + 1, ramp[0]); R(x0, M - hh + 1, w, hh * 2 - 1, ramp[1]); px(x0, M - hh + 1, ramp[3]); };
  // 尾钮（炮尾后面的圆球）
  const knob = (cx, M, r = 2) => { R(cx + 1, M - 1, 2, 3, P.brass[0]); disc(cx - 0.5, M + 0.5, r + 0.6, P.brass[0]); disc(cx - 0.5, M + 0.5, r - 0.3, P.brass[2]); px(cx - 1, M - 1, P.brass[3]); };
  // 老式口部：b1 郁金香口 / b2 + 黄铜口箍 / b3 冠状口（外翻 + 缺口）；ramp 跟炮身；返回口部末端 x
  function oldMuzzle(end, M, hh, b, ramp) {
    band(end - 3, 3, M, hh + 1, ramp); px(end - 1, M, P.black); if (hh > 1) { px(end - 1, M - 1, P.black); px(end - 1, M + 1, P.black); }
    if (b >= 2) band(end - 6, 2, M, hh + 1, BRONZE);
    if (b === 3) { band(end, 2, M, hh + 2, ramp); for (const dy of [-hh - 2, hh + 2]) px(end + 1, M + dy, P.dark[0]); px(end + 1, M, P.black); return end + 2; }   // 冠口：外翻一圈 + 上下缺口
    return end;
  }
  const flash = (end, M, k) => { if (k >= 6) { R(end, M - 1, 3, 3, P.fire[3]); px(end + 3, M, P.fire[2]); px(end + 1, M - 2, P.fire[2]); px(end + 1, M + 2, P.fire[2]); } };
  // 白汽：从 (x, y) 往上飘（帧 f），开火时才冒；只用蒸汽色，不发光
  function puff(x, y, f, on, n = 3) {
    if (!on) return;
    for (let i = 0; i < n; i++) { const p = (f + i * 2) % 6; R(x + ((i * 3 + p) % 3) - 1, y - p, p < 3 ? 2 : 1, p < 3 ? 2 : 1, P.steam[p < 2 ? 2 : p < 4 ? 1 : 0]); }
  }
  // 铜管：折线（每段 2px 粗，上沿亮）
  function pipe(pts) { for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c, d] = pts[i]; line(a, b, c, d, 2, COPPER[1]); line(a, b - (a === c ? 0 : 1), c, d - (a === c ? 0 : 1), 1, COPPER[3]); } for (const [a, b] of pts.slice(1, -1)) { R(a - 1, b - 1, 3, 3, COPPER[0]); px(a, b, COPPER[2]); } }
  // 安全阀 + 汽笛（竖在管上的小黄铜件）
  const valve = (x, y) => { R(x, y, 3, 4, P.brass[1]); px(x, y, P.brass[3]); R(x - 1, y - 1, 5, 1, P.brass[0]); R(x + 1, y - 3, 1, 2, P.brass[2]); };
  function turnGun(G0, x, y, piv, a, kmax, o, gun) {
    const k = Math.round((o.k || 0) / 8 * kmax);
    SA.CAND.turn(x + piv[0], y + piv[1], a || 0, (X, Y) => { G = SA.CAND.ctx(); gun(X - k, Y); });
    SA.CAND.use(G0); G = G0;
  }
  const firing = (o) => (o.k || 0) >= 4;

  // ================= 机炮 mg（2×2）=================
  // A 蒸汽离心炮（1861 温南斯蒸汽炮 / 1824 珀金斯蒸汽炮）：车上一只小立式锅炉，铜管把蒸汽送进一只铆接黄铜离心鼓；
  // 转子在鼓里转（开火时看得见），短粗炮管从鼓心伸出，炮管根部套一只锥形防盾。安全阀开火时冒白汽
  function mA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [29, 20], f = o.f || 0;
    hull(x, y, T, 28);
    // 小立式锅炉：圆筒 + 半球顶 + 细烟囱 + 炉门一道暗缝（不发光：发光的只有真锅炉）
    R(x + 7, y + 11, 10, 18, P.iron[0]); R(x + 8, y + 12, 8, 16, P.iron[3]); R(x + 8, y + 12, 2, 16, P.iron[4]); R(x + 14, y + 12, 2, 16, P.iron[2]);
    disc(x + 12, y + 12, 5, P.iron[0]); disc(x + 12, y + 12, 4, P.iron[3]); px(x + 10, y + 10, P.iron[4]);
    R(x + 8, y + 17, 8, 1, P.brass[1]); R(x + 8, y + 24, 8, 1, P.brass[1]);
    R(x + 9, y + 20, 6, 2, P.dark[0]);
    R(x + 13, y + 3, 3, 6, P.dark[0]); R(x + 13, y + 4, 1, 5, P.dark[3]); R(x + 12, y + 2, 5, 2, P.dark[0]);
    valve(x + 9, y + 5); puff(x + 10, y + 3, f, firing(o));
    pipe([[x + 16, y + 14], [x + 20, y + 14], [x + 20, y + 20], [x + 21, y + 20]]);
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      cast(C + 5, C + 20, M, 4, 3, IRONR); band(C + 12, 2, M, 4, IRONR);
      flash(oldMuzzle(C + 20, M, 3, T.b, IRONR), M, o.k || 0);
      for (let i = 0; i < 4; i++) { const hh = 5 + i; R(C + 7 + i, M - hh, 1, hh * 2 + 1, P.iron[0]); R(C + 7 + i, M - hh + 1, 1, hh * 2 - 1, i === 3 ? P.iron[2] : P.iron[3]); px(C + 7 + i, M - hh + 1, P.iron[4]); }   // 锥形防盾
    });
    // 离心鼓（固定，压在炮根上）：铆接黄铜圈 + 铁面 + 转子（开火时转）
    const dx = x + pv[0], dy = y + pv[1];
    disc(dx + 0.5, dy + 0.5, 9, P.brass[0]); disc(dx + 0.5, dy + 0.5, 8, P.brass[2]); disc(dx + 0.5, dy + 0.5, 6.5, P.iron[0]); disc(dx + 0.5, dy + 0.5, 5.5, P.iron[2]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; px(Math.round(dx + Math.cos(a) * 7.3), Math.round(dy + Math.sin(a) * 7.3), P.brass[0]); }
    const an = ((firing(o) ? f : 0) % 4) * Math.PI / 8;
    for (let i = 0; i < 4; i++) { const a = an + i * Math.PI / 2; line(dx, dy, Math.round(dx + Math.cos(a) * 4), Math.round(dy + Math.sin(a) * 4), 1, P.iron[4]); }
    trunnion(dx, dy);
  }
  // B 米特留兹青铜炮（1859 蒙蒂尼 / 1866 雷菲）：看起来像一门青铜加农炮——锥形铸造炮身、腰箍、尾钮，
  // 口部端面是一格格枪口（里面是一束枪管）；炮尾没有摇把，换成一只铜管喂汽的蒸汽缸（开火时活塞动）。铆接炮耳墙
  function mB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [22, 21], f = o.f || 0;
    hull(x, y, T, 30);
    box(x + 5, y + 21, 9, 9, IRON); R(x + 6, y + 22, 1, 7, P.iron[4]);                                              // 蒸汽缸
    pipe([[x + 9, y + 21], [x + 9, y + 17], [x + 12, y + 17]]); valve(x + 5, y + 16); puff(x + 6, y + 14, f, firing(o));
    cheek(x, y, pv[0], pv[1], T, 14, 13);
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      cast(C - 10, C + 22, M, 7, 5, BRONZE);
      for (const bx of [C - 4, C + 7]) band(bx, 2, M, 7, BRONZE);
      band(C - 10, 2, M, 7, BRONZE); knob(C - 13, M);
      R(C - 9, M - 9, 4, 2, P.brass[0]); px(C - 8, M - 9, P.brass[3]);                                             // 炮尾上的蒸汽阀柄（活塞推它）
      R(C - 12, M + 4, 3, 2, P.iron[0]); R(C - 16 + ((o.k || 0) >= 4 ? 2 : 0), M + 4, 4, 2, P.iron[3]);             // 活塞杆
      const end = C + 25;
      band(end - 3, 3, M, 6, BRONZE); R(end - 1, M - 4, 1, 9, P.dark[0]);
      for (const gy of [-3, 0, 3]) for (const gx of [0]) px(end - 1 + gx, M + gy, P.black);                        // 端面一格格枪口
      for (const gy of [-3, 0, 3]) px(end - 2, M + gy, P.brass[0]);
      if (T.b >= 2) band(end - 7, 2, M, 6, BRONZE);
      if (T.b === 3) { band(end, 2, M, 7, BRONZE); px(end + 1, M - 7, P.iron[1]); px(end + 1, M + 7, P.iron[1]); }
      if ((o.k || 0) >= 6) for (const gy of [-3, 0, 3]) { R(end + (T.b === 3 ? 2 : 0), M + gy, 3, 1, P.fire[3]); px(end + (T.b === 3 ? 5 : 3), M + gy, P.fire[2]); }
    });
    trunnion(x + pv[0], y + pv[1]);
  }
  // C 蒸汽活塞速射炮（阿姆斯特朗式箍炮 + 外露蒸汽缸）：铁炮身尾粗口细、尾部两道加粗箍；炮身下面平行挂一只黄铜蒸汽缸，
  // 活塞杆随后坐伸缩；炮尾顶上安全阀 + 汽笛，开火冒白汽；铜管从汽缸尾部弯回炮耳
  function mC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [20, 19], f = o.f || 0;
    hull(x, y, T, 30);
    cheek(x, y, pv[0], pv[1], T, 13, 14);
    turnGun(G0, x, y, pv, o.a, 4, o, (C, M) => {
      cast(C + 8, C + 27, M, 3, 2, IRONR);
      cast(C - 9, C + 8, M, 6, 5, IRONR); band(C - 9, 3, M, 6, IRONR); band(C - 1, 3, M, 6, IRONR); band(C + 12, 2, M, 3, IRONR);
      knob(C - 12, M);
      flash(oldMuzzle(C + 27, M, 2, T.b, IRONR), M, o.k || 0);
      box(C - 4, M + 6, 18, 6, BRASS); R(C - 3, M + 8, 16, 1, P.brass[1]);                                         // 蒸汽缸
      const ext = (o.k || 0) >= 4 ? 0 : 4; R(C + 14, M + 8, 2 + ext, 2, P.iron[0]); R(C + 14, M + 8, 2 + ext, 1, P.iron[4]); R(C + 16 + ext, M + 6, 2, 5, P.iron[0]);   // 活塞杆 + 连到炮身的吊耳
      pipe([[C - 4, M + 9], [C - 7, M + 9], [C - 7, M + 4]]);
      valve(C - 6, M - 10); R(C - 2, M - 9, 2, 3, P.brass[1]); R(C - 3, M - 11, 4, 2, P.brass[2]);              // 安全阀 + 汽笛
      puff(C - 5, M - 12, f, firing(o)); puff(C - 1, M - 13, f + 3, firing(o), 2);
    });
    trunnion(x + pv[0], y + pv[1]);
  }

  // ================= 双联机枪 mg2（2×2）=================
  // A 双联风琴管（中世纪风琴炮 ribauldequin）：两根黄铜长管像管风琴的管子（根部有风琴管的「口」缺口，口部外翻成喇叭），
  // 两道铁箍捆在一起，插在一只铁皮「风箱」蒸汽箱上，箱侧一只黄铜阀轮；上下交替开火
  function dA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [18, 20], f = o.f || 0;
    hull(x, y, T, 30);
    cheek(x, y, pv[0], pv[1], T, 12, 13);
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      for (const [i, dy] of [-4, 4].entries()) {
        const MM = M + dy, hot = (f + i) % 2 ? o.k || 0 : 0;
        cast(C + 2, C + 26, MM, 2, 2, BRONZE);
        R(C + 6, MM - 1, 2, 1, P.dark[0]); px(C + 8, MM - 1, P.brass[0]);                                         // 风琴管的「口」
        for (let k = 0; k < 3; k++) { const hh = 3 + k; R(C + 26 + k, MM - hh, 1, hh * 2 + 1, P.brass[0]); R(C + 26 + k, MM - hh + 1, 1, hh * 2 - 1, k === 2 ? P.brass[1] : P.brass[2]); }   // 喇叭口
        px(C + 28, MM, P.black);
        if (T.b >= 2) band(C + 22, 2, MM, 3, BRONZE);
        if (T.b === 3) { R(C + 29, MM - 5, 1, 11, P.brass[0]); px(C + 29, MM, P.black); }
        if (hot >= 6) { R(C + 29 + (T.b === 3 ? 1 : 0), MM - 1, 3, 3, P.fire[3]); px(C + 32 + (T.b === 3 ? 1 : 0), MM, P.fire[2]); }
      }
      for (const bx of [C + 12, C + 19]) { R(bx, M - 7, 2, 15, P.iron[0]); R(bx, M - 6, 1, 13, P.iron[3]); }       // 两道铁箍
      shade(C - 10, M - 8, 13, 17, shellIn(C - 10, M - 8, 13, 17, T.f, 3));                                        // 风箱蒸汽箱
      disc(C - 3.5, M + 0.5, 3.4, P.brass[0]); disc(C - 3.5, M + 0.5, 2.5, P.brass[2]); line(C - 6, M, C - 1, M, 1, P.brass[0]); line(C - 4, M - 2, C - 4, M + 3, 1, P.brass[0]);   // 阀轮
      pipe([[C - 8, M - 8], [C - 8, M - 11], [C - 3, M - 11]]); puff(C - 3, M - 12, f, firing(o));
    });
    trunnion(x + pv[0], y + pv[1]);
  }
  // B 双联青铜排枪（诺克排枪 / 早期青铜炮）：一整块铸造青铜炮尾，伸出上下两根青铜管；炮尾顶上一对「海豚」提耳、后面尾钮，
  // 口部郁金香；一根铜管从车体里给炮尾喂汽（没有摇把、没有弹药）
  function dB(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [20, 21], f = o.f || 0;
    hull(x, y, T, 30);
    pipe([[x + 8, y + 30], [x + 8, y + 24], [x + 12, y + 24]]); valve(x + 5, y + 25); puff(x + 6, y + 23, f, firing(o));
    cheek(x, y, pv[0], pv[1], T, 13, 13);
    turnGun(G0, x, y, pv, o.a, 3, o, (C, M) => {
      for (const [i, dy] of [-4, 4].entries()) {
        const MM = M + dy, hot = (f + i) % 2 ? o.k || 0 : 0;
        cast(C + 2, C + 25, MM, 3, 2, BRONZE); band(C + 11, 2, MM, 3, BRONZE);
        flash(oldMuzzle(C + 25, MM, 2, T.b, BRONZE), MM, hot);
      }
      cast(C - 9, C + 3, M, 9, 8, BRONZE); band(C - 9, 2, M, 9, BRONZE); band(C + 1, 2, M, 8, BRONZE);          // 铸造炮尾
      knob(C - 12, M, 2.5);
      for (const hx of [C - 5, C + 0]) { R(hx, M - 12, 3, 1, P.brass[0]); R(hx - 1, M - 11, 1, 3, P.brass[0]); R(hx + 3, M - 11, 1, 3, P.brass[0]); px(hx, M - 12, P.brass[3]); }   // 一对海豚提耳
      R(C - 7, M - 2, 8, 1, P.brass[1]); R(C - 7, M + 2, 8, 1, P.brass[1]);                                        // 铸纹
    });
    trunnion(x + pv[0], y + pv[1]);
  }
  // C 双嘴汽转球（希罗汽转球 aeolipile）：一只铆接黄铜球架在铁叉上，球前伸出上下两根弯嘴喷管；
  // 下面一只小火盆（暗红，不发光）烧着球里的水，铜管从车体接进球轴。开火时两嘴交替喷白汽 + 火花
  function dC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const pv = [20, 20], f = o.f || 0;
    hull(x, y, T, 30);
    R(x + 15, y + 27, 11, 3, P.iron[0]); R(x + 16, y + 28, 9, 1, P.dark[1]); px(x + 18, y + 28, P.fire[0]); px(x + 22, y + 28, P.fire[0]);   // 小火盆（余烬暗红）
    for (const fx of [11, 27]) { R(x + fx, y + 18, 3, 12, P.iron[0]); R(x + fx + 1, y + 19, 1, 10, P.iron[3]); }   // 铁叉
    pipe([[x + 6, y + 30], [x + 6, y + 21], [x + 11, y + 21]]);
    turnGun(G0, x, y, pv, o.a, 2, o, (C, M) => {
      for (const [i, dy] of [-5, 5].entries()) {
        const MM = M + dy, hot = (f + i) % 2 ? o.k || 0 : 0;
        line(C + 6, M + Math.sign(dy) * 3, C + 9, MM, 3, P.brass[0]); line(C + 6, M + Math.sign(dy) * 3, C + 9, MM, 1, P.brass[2]);   // 弯嘴根部
        cast(C + 9, C + 25, MM, 2, 1, BRONZE);
        const end = oldMuzzle(C + 25, MM, 1, T.b, BRONZE);
        if (hot >= 6) { R(end, MM - 1, 3, 3, P.fire[3]); px(end + 3, MM, P.fire[2]); }
        if (hot >= 4) { R(end + 1, MM - 3, 2, 2, P.steam[2]); px(end + 4, MM - 4, P.steam[1]); }
      }
      disc(C + 0.5, M + 0.5, 9, P.brass[0]); disc(C + 0.5, M + 0.5, 8, P.brass[1]); disc(C - 0.5, M - 0.5, 6.5, P.brass[2]);   // 黄铜球
      disc(C - 2.5, M - 2.5, 2, P.brass[3]);
      R(C - 8, M, 17, 1, P.brass[0]); for (let i = -6; i <= 6; i += 3) px(C + i, M - 1, P.brass[3]);               // 赤道铆接缝
    });
    trunnion(x + pv[0], y + pv[1]);
  }

  const MG_L = [
    { key: 'A', name: 'A 蒸汽离心炮', idea: '1861 温南斯蒸汽炮：车上一只小立式锅炉，铜管送汽进铆接黄铜离心鼓，转子在鼓里转，短粗炮管 + 锥形防盾从鼓心伸出；安全阀开火时冒白汽。历史上真有这种车载蒸汽机枪', base: mA, over: hullOver(28), piv: [29, 20], blen: 22 },
    { key: 'B', name: 'B 米特留兹青铜炮', idea: '1866 雷菲米特留兹：外形是一门青铜加农炮（锥形炮身、腰箍、尾钮），口部端面一格格枪口；炮尾的摇把换成铜管喂汽的蒸汽缸。像炮不像枪，最古典', base: mB, over: hullOver(30), piv: [22, 21], blen: 25 },
    { key: 'C', name: 'C 蒸汽活塞速射炮', idea: '阿姆斯特朗式箍炮（尾粗口细、两道加粗箍）+ 炮身下外露的黄铜蒸汽缸，活塞杆随后坐伸缩；炮尾安全阀 + 汽笛冒白汽。机械最外露', base: mC, over: hullOver(30), piv: [20, 19], blen: 27 },
  ];
  const MG_2 = [
    { key: 'A', name: 'A 双联风琴管', idea: '中世纪风琴炮：两根黄铜长管像管风琴（根部有风琴管的「口」、口部外翻成喇叭），两道铁箍捆着，插在铁皮风箱蒸汽箱上，箱侧黄铜阀轮。上下交替开火', base: dA, over: hullOver(30), piv: [18, 20], blen: 28 },
    { key: 'B', name: 'B 双联青铜排枪', idea: '诺克排枪 / 早期青铜炮：一整块铸造青铜炮尾伸出上下两根青铜管，顶上一对「海豚」提耳、后面尾钮，郁金香口；铜管从车体给炮尾喂汽', base: dB, over: hullOver(30), piv: [20, 21], blen: 25 },
    { key: 'C', name: 'C 双嘴汽转球', idea: '希罗汽转球：铆接黄铜球架在铁叉上，球前伸出上下两根弯嘴喷管，下面小火盆烧着；开火时两嘴交替喷白汽 + 火花。最奇想、最蒸汽朋克', base: dC, over: hullOver(30), piv: [20, 20], blen: 25 },
  ];
  return { TIERS, MG_L, MG_2, L: { TIERS, CANDS: MG_L }, D: { TIERS, CANDS: MG_2 } };
})();
// 候选页（module-candidates.html）按 SA[lab].TIERS / CANDS 读
SA.CUR_MG_L = SA.CUR.L;
SA.CUR_MG_2 = SA.CUR.D;
