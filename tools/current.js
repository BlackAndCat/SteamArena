// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：机炮 mg + 双联机枪 mg2 v3（2×2，2026-09-28）：用户选 机炮 A 蒸汽离心炮 + 双联 C 双嘴汽转球，按物理合理性重做转轴（v2 六个候选已归档 archive/mg-mg2-v2）。
// v2 说明：用户否决 v1（带弹鼓 / 弹斗 / 弹箱、太现代，已归档 archive/mg-mg2-v1）：
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

  // ---------- v3 转轴规则（2026-09-28 用户：中间的固定螺栓不随枪身动，看起来很怪 → 按物理重新分「动 / 不动」）----------
  // 两件都是「绕一根横轴俯仰」的圆形主体：轴垂直于画面，所以轴本身、轴承和进汽的旋转接头都是固定的；
  // 圆形主体的明暗、高光由世界里的光决定（左上光），也不随俯仰转——只有主体上的「标记」（铆钉、接缝、法兰、枪管）跟着转。
  //   固定：车体、锅炉 / 火盆、铜管、轴承臂（从车体伸到轴心，让轴心一眼是车体的一部分）、轴心凸台 + 旋转接头、圆形主体的明暗
  //   跟着俯仰转：主体上的铆钉 / 接缝 / 法兰、枪管、防盾、喷嘴
  //   开火时再转：离心炮鼓里的转子（相对炮身转）
  //   不做后坐平移：蒸汽离心炮和汽转球都不烧火药、几乎没有后坐；主体套在轴上也不能沿炮管方向滑（v2 就是滑了 2～3px 才显得螺栓不跟着动）
  //   开火效果：离心炮没有火药 → 没有炮口火光，只有炮口一团白汽 + 转子转；汽转球两嘴交替喷白汽（带几颗火星）
  // 像素细节：转动层按耳轴「像素角」转（CAND.turn），所以所有绕轴的圆都按角点画（disc(C, M, r)），固定的圆也按同一个角点画，转起来才不会半像素乱跳。
  function bearingArm(x0, y0, x1, y1) { line(x0, y0, x1, y1, 4, P.iron[0]); line(x0, y0 - 1, x1, y1 - 1, 2, P.iron[3]); line(x0, y0 - 1, x1, y1 - 1, 1, P.iron[4]); }
  function hub(cx, cy) {   // 轴心凸台：黄铜压盖（旋转接头）+ 铁轴头 + 一颗六角螺母（固定）
    disc(cx, cy, 3.6, P.brass[0]); disc(cx, cy, 2.8, P.brass[2]); px(cx - 2, cy - 2, P.brass[3]);
    R(cx - 1, cy - 1, 2, 2, P.iron[0]); px(cx - 1, cy - 1, P.iron[4]);
  }
  // 固定的圆形主体：外圈描边 + 本体 + 左上受光 + 右下暗边（光是世界的，不随俯仰转）
  function roundBody(cx, cy, r, ramp) {
    disc(cx, cy, r, ramp[0]); disc(cx, cy, r - 1, ramp[1]); disc(cx - 0.8, cy - 0.8, r - 2, ramp[2]);
    disc(cx - r * 0.38, cy - r * 0.38, Math.max(1.2, r * 0.22), ramp[3]);
  }
  // 白汽团（炮口）：开火帧往前飘散，只用蒸汽色
  function steamShot(end, M, k, f) {
    if (k < 4) return;
    const p = f % 3;
    R(end + p, M - 1, 3, 3, P.steam[2]); px(end + 3 + p, M - 2, P.steam[1]); px(end + 3 + p, M + 2, P.steam[1]); if (p) px(end + 5 + p, M, P.steam[0]);
  }

  // ================= 机炮 mg（2×2）· 蒸汽离心炮 v3 =================
  // 1861 温南斯蒸汽炮：车上一只小立式锅炉（固定），铜管把蒸汽经轴心的旋转接头送进离心鼓；
  // 离心鼓外壳 + 锥形防盾 + 炮管是一整件，绕轴心俯仰；鼓里的转子开火时相对炮身转。轴承臂从车体斜伸到轴心
  const A_PIV = [29, 20];
  function mA(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const f = o.f || 0, dx = x + A_PIV[0], dy = y + A_PIV[1], on = firing(o);
    hull(x, y, T, 28);
    R(x + 7, y + 11, 10, 18, P.iron[0]); R(x + 8, y + 12, 8, 16, P.iron[3]); R(x + 8, y + 12, 2, 16, P.iron[4]); R(x + 14, y + 12, 2, 16, P.iron[2]);   // 小立式锅炉
    disc(x + 12, y + 12, 5, P.iron[0]); disc(x + 12, y + 12, 4, P.iron[3]); px(x + 10, y + 10, P.iron[4]);
    R(x + 8, y + 17, 8, 1, P.brass[1]); R(x + 8, y + 24, 8, 1, P.brass[1]); R(x + 9, y + 20, 6, 2, P.dark[0]);
    R(x + 13, y + 3, 3, 6, P.dark[0]); R(x + 13, y + 4, 1, 5, P.dark[3]); R(x + 12, y + 2, 5, 2, P.dark[0]);
    valve(x + 9, y + 5); puff(x + 10, y + 3, f, on);
    roundBody(dx, dy, 10, BRONZE);                                                                                  // 离心鼓外壳（明暗固定）
    disc(dx, dy, 6.5, P.iron[0]); disc(dx, dy, 5.6, P.dark[1]);                                                     // 鼓面开口，看得见转子
    SA.CAND.turn(dx, dy, o.a || 0, (C, M) => {
      G = SA.CAND.ctx();
      cast(C + 9, C + 22, M, 4, 3, IRONR); band(C + 15, 2, M, 4, IRONR);
      steamShot(oldMuzzle(C + 22, M, 3, T.b, IRONR), M, o.k || 0, f);
      for (let i = 0; i < 4; i++) { const hh = 5 + i; R(C + 8 + i, M - hh, 1, hh * 2 + 1, P.iron[0]); R(C + 8 + i, M - hh + 1, 1, hh * 2 - 1, i === 3 ? P.iron[2] : P.iron[3]); px(C + 8 + i, M - hh + 1, P.iron[4]); }   // 锥形防盾（和炮管一体）
      for (let i = 0; i < 6; i++) { const a = (i + 0.5) * Math.PI / 3; R(Math.round(C + Math.cos(a) * 8) - 1, Math.round(M + Math.sin(a) * 8) - 1, 2, 2, P.brass[0]); px(Math.round(C + Math.cos(a) * 8) - 1, Math.round(M + Math.sin(a) * 8) - 1, P.brass[3]); }   // 外壳法兰铆钉（跟着俯仰转）
      const spin = on ? (f % 4) * Math.PI / 8 : 0;                                                                   // 转子：开火时相对炮身转
      for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 2; line(C, M, Math.round(C + Math.cos(a) * 5), Math.round(M + Math.sin(a) * 5), 1, P.iron[3]); }
    });
    SA.CAND.use(G0); G = G0;
    bearingArm(x + 22, y + 30, dx, dy);                                                                             // 轴承臂（固定）
    pipe([[x + 16, y + 14], [x + 20, y + 14], [x + 20, y + 20], [dx - 3, dy]]);                                     // 铜管进轴心
    hub(dx, dy);
  }

  // ================= 双联机枪 mg2（2×2）· 双嘴汽转球 v3 =================
  // 希罗汽转球：铆接黄铜球（明暗固定）套在一根空心横轴上，下面小火盆烧着；铜管从车体经轴心旋转接头送汽。
  // 球上的赤道接缝 + 铆钉 + 上下两根弯嘴一起绕轴俯仰；两嘴交替喷白汽。后面铁叉（固定）托着轴，前面一条轴承臂压住轴头
  const C_PIV = [20, 20];
  function dC(G0, x, y, T, o = {}) {
    SA.CAND.use(G0); G = G0; const f = o.f || 0, dx = x + C_PIV[0], dy = y + C_PIV[1];
    hull(x, y, T, 30);
    for (const fx of [9, 28]) { R(x + fx, y + 17, 3, 13, P.iron[0]); R(x + fx + 1, y + 18, 1, 11, P.iron[3]); }   // 后面的铁叉（被球挡住一半）
    R(x + 14, y + 27, 12, 3, P.iron[0]); R(x + 15, y + 28, 10, 1, P.dark[1]); px(x + 17, y + 28, P.fire[0]); px(x + 22, y + 28, P.fire[0]);   // 小火盆（余烬暗红，不发光）
    roundBody(dx, dy, 9, BRONZE);                                                                                   // 黄铜球（明暗固定）
    SA.CAND.turn(dx, dy, o.a || 0, (C, M) => {
      G = SA.CAND.ctx();
      R(C - 8, M - 1, 16, 2, P.brass[0]); R(C - 8, M - 1, 16, 1, P.brass[1]);                                      // 赤道接缝（看得出俯仰角）
      for (const i of [-6, -3, 3, 6]) px(C + i, M - 2, P.brass[3]);
      for (const [i, sy] of [-1, 1].entries()) {
        const MM = M + sy * 5, hot = (f + i) % 2 ? o.k || 0 : 0;
        line(C + 6, M + sy * 4, C + 10, MM, 3, P.brass[0]); line(C + 6, M + sy * 4, C + 10, MM, 1, P.brass[2]);   // 弯嘴根部（从球面伸出）
        cast(C + 10, C + 25, MM, 2, 1, BRONZE);
        const end = oldMuzzle(C + 25, MM, 1, T.b, BRONZE);
        steamShot(end, MM, hot, f);
        if (hot >= 6) { px(end + 1, MM - 2, P.fire[3]); px(end + 4, MM + 1, P.fire[2]); }                          // 几颗火星
      }
    });
    SA.CAND.use(G0); G = G0;
    bearingArm(x + 13, y + 30, dx, dy);                                                                             // 前轴承臂（固定）
    pipe([[x + 5, y + 30], [x + 5, y + 25], [dx - 3, dy + 2]]);                                                     // 铜管顺着轴承臂进轴心（不横穿球面）
    hub(dx, dy);
  }

  const MG_L = [
    { key: 'A', name: 'A 蒸汽离心炮 v3', idea: '1861 温南斯蒸汽炮。固定：锅炉、铜管、轴承臂、轴心凸台（旋转接头）、鼓壳明暗；跟着俯仰：鼓壳铆钉、锥形防盾、炮管；开火：鼓里转子转 + 炮口白汽（不烧火药，没有火光、没有后坐）', base: mA, over: hullOver(28), piv: A_PIV, blen: 22 },
  ];
  const MG_2 = [
    { key: 'C', name: 'C 双嘴汽转球 v3', idea: '希罗汽转球。固定：铁叉、火盆、铜管、前轴承臂、轴心凸台、黄铜球明暗；跟着俯仰：赤道接缝 + 铆钉、上下两根弯嘴；开火：两嘴交替喷白汽 + 火星（没有后坐）', base: dC, over: hullOver(30), piv: C_PIV, blen: 25 },
  ];
  return { TIERS, MG_L, MG_2, L: { TIERS, CANDS: MG_L }, D: { TIERS, CANDS: MG_2 } };
})();
// 候选页（module-candidates.html）按 SA[lab].TIERS / CANDS 读
SA.CUR_MG_L = SA.CUR.L;
SA.CUR_MG_2 = SA.CUR.D;
