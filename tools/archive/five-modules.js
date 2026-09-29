// 五模块造型样机（历史存档，tools/archive/five-modules.html 专用）。2026-09-29 用户选定：小臼炮 D、装弹机 B、加压舱 F（扩大到 1×2 = F2）、冷凝器 A，
// 已进游戏（sprites.js 的 mortarS / autoloaderArt / pressureArt / condenserArt）；双人驾驶舱没选，继续在「当前开发」。
//
// 本期（2026-09-29）：五个模块一起开发，每个至少 6 种剪影 / 设计模式——
//   装弹机 autoloader（1×1 控制）· 小臼炮 mortar_s（1×1 火力，武器可以出格）· 联合驾驶舱（双人）cockpit_pair（1×2 控制，两名驾驶员保持 1×1 大小）·
//   加压舱 pressure_chamber（1×1 能源，压力表 + 安全阀，不发光）· 冷凝器 condenser（1×2 冷却，实心，不像水箱也不像散热片）。
// 通用规则：车载（没有三脚架 / 立柱 / 手柄）；T1 原画（冷铁 + 黄铜 + 语义色），材质由游戏的装饰层换；非武器不出格；每个造型带一点动画。
window.SA = window.SA || {};

SA.CUR = (() => {
  const P = SA.PAL, TAU = Math.PI * 2;
  let g = null;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const px = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => {
    g.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g.fillRect(xx, yy, 1, 1);
    }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2); g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  const ring = (cx, cy, r, c) => { const n = Math.ceil(r * 7); for (let i = 0; i < n; i++) { const a = i / n * TAU; px(Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), c); } };
  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]], IRONL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]], BRASS = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]], DARK = [P.dark[0], P.dark[1], P.dark[2], P.dark[3]];
  const LEATHER = [P.black, P.leather[0], P.leather[1], P.leather[2]], WATER = [P.water[0], P.water[1], P.water[2], P.water[3]];
  const box = (x, y, w, h, r) => { R(x, y, w, h, r[0]); R(x + 1, y + 1, w - 2, h - 2, r[2]); R(x + 1, y + h - 2, w - 2, 1, r[1]); R(x + w - 2, y + 1, 1, h - 2, r[1]); R(x + 1, y + 1, w - 2, 1, r[3]); R(x + 1, y + 1, 1, h - 2, r[3]); };
  const rivet = (x, y) => { R(x, y, 2, 2, P.iron[4]); px(x + 1, y + 1, P.iron[2]); };
  // 任意形状按像素判定上色：外沿描边、左上两像素亮、右下两像素暗
  function shape(test, x0, y0, x1, y1, r = IRONL) {
    const inn = (xx, yy) => test(xx + 0.5, yy + 0.5);
    for (let yy = Math.floor(y0); yy <= Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx <= Math.ceil(x1); xx++) {
      if (!inn(xx, yy)) continue;
      if (!inn(xx - 1, yy) || !inn(xx + 1, yy) || !inn(xx, yy - 1) || !inn(xx, yy + 1)) { px(xx, yy, r[0]); continue; }
      px(xx, yy, !inn(xx - 2, yy) || !inn(xx, yy - 2) ? r[3] : !inn(xx + 2, yy) || !inn(xx, yy + 2) ? r[1] : r[2]);
    }
  }
  const inPoly = (pts) => (x, y) => { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; };
  const poly = (pts, r) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); shape(inPoly(pts), Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, r); };
  const ball = (cx, cy, rr, r) => shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr, cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1, r);
  const vtube = (x, y, w, h, r = IRONL) => { R(x, y, w, h, r[0]); R(x + 1, y, w - 2, h, r[2]); R(x + 1, y, 1, h, r[3]); if (w > 3) R(x + w - 2, y, 1, h, r[1]); };
  const htube = (x, y, w, h, r = IRONL) => { R(x, y, w, h, r[0]); R(x, y + 1, w, h - 2, r[2]); R(x, y + 1, w, 1, r[3]); if (h > 3) R(x, y + h - 2, w, 1, r[1]); };
  const lens = (x, y, w, h, glint) => { R(x, y, w, h, P.glass[0]); if (w > 2 && h > 2) R(x + 1, y + 1, w - 2, h - 2, P.glass[2]); px(x + (w > 2 ? 1 : 0), y + (h > 2 ? 1 : 0), glint ? P.white : P.glass[3]); };
  const puff = (x, y, t, n = 3, rise = 8) => { for (let k = 0; k < n; k++) { const p = ((t * 0.04 + k / n) % 1); disc(x + Math.sin(p * 6 + k) * 1.5, y - p * rise, 0.8 + p * 1.6, p < 0.5 ? P.steam[2] : P.steam[1]); } };
  // 黄铜炮弹：横放（弹壳 + 铁弹头 + 底火）/ 竖放
  const shellH = (x, y, l = 9) => { R(x, y, l - 3, 3, P.brass[1]); R(x, y, l - 3, 1, P.brass[3]); R(x, y + 2, l - 3, 1, P.brass[0]); R(x + l - 3, y, 2, 3, P.iron[3]); px(x + l - 1, y + 1, P.iron[3]); px(x + l - 3, y, P.iron[4]); px(x, y + 1, P.brass[0]); };
  const shellV = (x, y, l = 9) => { R(x, y + 3, 3, l - 3, P.brass[1]); R(x, y + 3, 1, l - 3, P.brass[3]); R(x + 2, y + 3, 1, l - 3, P.brass[0]); R(x, y + 1, 3, 2, P.iron[3]); px(x + 1, y, P.iron[3]); px(x, y + 1, P.iron[4]); px(x + 1, y + l - 1, P.brass[0]); };
  const gear = (cx, cy, r, n, rot, ramp = BRASS) => { shape((x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - rot; return d <= r - 1 || (d <= r + 0.6 && Math.cos(a * n) > 0.2); }, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2, ramp); disc(cx, cy, Math.max(0.8, r * 0.3), P.iron[0]); };
  function gauge(cx, cy, r, v = 0.6) {
    disc(cx, cy, r, P.brass[0]); disc(cx, cy, r - 1, P.steam[2]);
    const a = Math.PI * (0.75 + 1.5 * v), L = Math.max(1.5, r - 1.5);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 0.5 + Math.cos(a) * L), Math.round(cy - 0.5 + Math.sin(a) * L), 1, P.dark[0]);
  }
  const plinth = (x, y, x0, x1, top, bot = 24) => { box(x + x0, y + top, x1 - x0, bot - top, IRON); if (x1 - x0 > 8) { rivet(x + x0 + 2, y + top + 2); rivet(x + x1 - 4, y + top + 2); } };
  const saw = (t, per) => ((t % per) + per) % per / per;   // 0～1 锯齿

  // ================= 装弹机 autoloader（1×1 控制）：看得到炮弹和机械 =================
  const AUTOLOADER = [
    { key: 'A', name: '转轮弹鼓', ref: '左轮手枪的转轮 / 舰炮的转鼓装填机',
      idea: '正面看一只大转鼓，六个弹膛里露出黄铜弹底（底火一点）；每隔两秒转鼓一顿一顿地转过 60°，把下一发送到位。剪影：圆盘坐在方座上。',
      draw(x, y, o) {
        const t = o.t || 0, k = Math.floor(t / 33), f = Math.min(1, (t % 33) / 8), rot = (k + f) * TAU / 6;
        plinth(x, y, 2, 22, 19);
        ball(x + 12, y + 10, 9.5, IRONL);
        for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6, cx = x + 12 + Math.cos(a) * 5.6, cy = y + 10 + Math.sin(a) * 5.6; disc(cx, cy, 2.3, P.brass[0]); disc(cx - 0.3, cy - 0.3, 1.7, P.brass[2]); px(Math.floor(cx), Math.floor(cy), P.iron[1]); }
        disc(x + 12, y + 10, 2, P.iron[0]); disc(x + 12, y + 10, 1.2, P.brass[3]);
        R(x + 20, y + 9, 3, 3, P.dark[0]);   // 出弹口
      } },
    { key: 'B', name: '链式扬弹机', ref: '战舰的链式扬弹机',
      idea: '竖框里上下两只链轮，一条链子绕着转，前面一段挂着三发横放的炮弹往上送，送到顶从右边出弹口推出去。剪影：竖长框 + 两只齿轮。',
      draw(x, y, o) {
        const t = o.t || 0, sh = saw(t, 90);
        box(x + 3, y + 1, 18, 23, IRON); R(x + 5, y + 3, 14, 19, P.dark[1]);
        gear(x + 12, y + 5, 3.4, 8, t * 0.07); gear(x + 12, y + 19, 3.4, 8, t * 0.07);
        R(x + 8, y + 5, 1, 14, P.iron[3]); R(x + 15, y + 5, 1, 14, P.iron[3]);
        for (let i = 0; i < 3; i++) { const yy = y + 18 - ((sh + i / 3) % 1) * 13; shellH(x + 6, yy - 1, 9); }
        R(x + 19, y + 3, 3, 4, P.dark[0]);
      } },
    { key: 'C', name: '推弹臂', ref: '岸防炮的蒸汽推弹器',
      idea: '左边弹架上叠着三发炮弹，下面一只蒸汽推杆每隔一会儿伸出去，把最上面那发推进右边的炮尾口，再缩回来。剪影：左高右低的台阶。',
      draw(x, y, o) {
        const t = o.t || 0, p = saw(t, 70), ext = p < 0.3 ? p / 0.3 : p < 0.45 ? 1 : p < 0.7 ? 1 - (p - 0.45) / 0.25 : 0;
        plinth(x, y, 1, 23, 19);
        box(x + 1, y + 4, 12, 15, IRONL); R(x + 2, y + 5, 10, 13, P.dark[1]);
        for (let i = 0; i < 2; i++) shellH(x + 2, y + 12 + i * 3.5, 10);
        shellH(x + 2 + ext * 9, y + 7, 10);
        box(x + 16, y + 5, 7, 8, IRONL); R(x + 19, y + 7, 4, 4, P.dark[0]);   // 炮尾口
        htube(x + 13, y + 14, 8, 4, IRONL); R(x + 13 + ext * 6, y + 15, 2, 2, P.brass[2]);   // 推杆缸
      } },
    { key: 'D', name: '摇篮翻斗', ref: '重炮的装填摇篮',
      idea: '一只黄铜摇篮托着一发炮弹，从下面的弹架上翻起来，斜着把炮弹送到右上的装填口，再翻回去拿下一发。剪影：一根会翻的斜臂。',
      draw(x, y, o) {
        const t = o.t || 0, p = saw(t, 80), s = p < 0.35 ? p / 0.35 : p < 0.5 ? 1 : p < 0.85 ? 1 - (p - 0.5) / 0.35 : 0;
        plinth(x, y, 1, 23, 18);
        shellH(x + 12, y + 19, 9);
        box(x + 15, y + 1, 8, 7, IRONL); R(x + 19, y + 3, 4, 3, P.dark[0]);
        const a = -0.05 - s * 0.75, pv = [x + 4, y + 16], L = 15, e = [pv[0] + Math.cos(a) * L, pv[1] + Math.sin(a) * L];
        line(pv[0], pv[1], e[0], e[1], 3, P.brass[0]); line(pv[0], pv[1] - 1, e[0], e[1] - 1, 1, P.brass[3]);
        const m = [pv[0] + Math.cos(a) * 9, pv[1] + Math.sin(a) * 9 - 2.5];
        R(m[0] - 4, m[1] - 1, 8, 3, P.brass[1]); R(m[0] - 4, m[1] - 1, 8, 1, P.brass[3]); R(m[0] + 3, m[1] - 1, 2, 3, P.iron[3]);
        disc(pv[0], pv[1], 2.2, P.iron[0]); disc(pv[0], pv[1], 1.3, P.brass[2]);
      } },
    { key: 'E', name: '弹带链轮', ref: '转管炮的弹带供弹 + 链轮',
      idea: '右边一只大链轮，一条挂满竖放小炮弹的弹带从左边送过来、绕进链轮，弹带一格一格地走。剪影：大齿轮 + 一排竖条。',
      draw(x, y, o) {
        const t = o.t || 0, sh = saw(t, 12) * 4;
        plinth(x, y, 1, 23, 20);
        for (let i = 0; i < 4; i++) { const xx = x + 1 + ((i * 4 + sh) % 14); shellV(xx, y + 10, 9); }
        R(x + 1, y + 18, 15, 1, P.dark[0]);
        gear(x + 17, y + 11, 5.6, 10, t * 0.05, IRONL); disc(x + 17, y + 11, 2, P.brass[2]);
        box(x + 14, y + 1, 9, 4, IRON);
      } },
    { key: 'F', name: '重力弹斗', ref: '维多利亚铁路的煤斗 + 擒纵星轮',
      idea: '左上一只斜漏斗装满炮弹，炮弹顺着斜槽滚下来，槽口一只星形擒纵轮一格一格转，每转一格放一发到右下。剪影：左高右低的斜斗。',
      draw(x, y, o) {
        const t = o.t || 0, sh = saw(t, 50);
        plinth(x, y, 1, 23, 20);
        poly([[x + 1, y + 1], [x + 12, y + 1], [x + 16, y + 10], [x + 5, y + 10]], IRON);
        for (let i = 0; i < 3; i++) shellH(x + 3 + i * 2, y + 3 + i * 2, 8);
        poly([[x + 11, y + 11], [x + 22, y + 15], [x + 22, y + 18], [x + 11, y + 14]], IRONL);
        shellH(x + 12 + sh * 7, y + 12 + sh * 2.5, 8);
        gear(x + 12, y + 12, 3, 5, Math.floor(t / 10) * TAU / 5, BRASS);
      } },
    { key: 'G', name: '气动传送管', ref: '维多利亚的气动邮政管',
      idea: '一根竖着的玻璃管（黄铜管箍），一只黄铜弹舱被气压从下往上「嗖」地送上去，到顶一顿、落下一发；底下一只风箱在打气。剪影：一根竖玻璃管 + 底座。',
      draw(x, y, o) {
        const t = o.t || 0, p = saw(t, 60), up = p < 0.25 ? (p / 0.25) ** 2 : 1;
        plinth(x, y, 3, 21, 19);
        R(x + 8, y + 1, 8, 18, P.glass[0]); R(x + 9, y + 1, 6, 18, P.glass[1]); R(x + 9, y + 1, 1, 18, P.glass[3]);
        for (const yy of [1, 9, 17]) R(x + 7, y + yy, 10, 2, P.brass[1]);
        if (p < 0.4) { const yy = y + 14 - up * 11; R(x + 10, yy, 4, 4, P.brass[2]); R(x + 10, yy, 4, 1, P.brass[3]); }
        const b = Math.sin(t * 0.25) > 0 ? 1 : 0; for (let u = 0; u < 4; u++) R(x + 3, y + 12 + u * 1.6 + b * u * 0.3, 4, 1, u % 2 ? P.leather[0] : P.leather[1]);
      } },
  ];

  // ================= 小臼炮 mortar_s（1×1 火力）：耳轴 (12,13)，炮口离耳轴 18，仰角 32°～82°（静止 55°） =================
  // 画法：固定部分（炮床 / 座）先画，炮管按仰角绕耳轴转；后坐时炮管沿自身往后退 k×4px；没有火药 → 开火只喷蒸汽
  const PV = [12, 13];
  function barrel(x, y, a, k, parts, over) {
    const ar = a * Math.PI / 180, c = Math.cos(ar), s = Math.sin(ar), back = (k || 0) * 4;
    const P0 = [x + PV[0], y + PV[1]], at = (u, v) => [P0[0] + c * (u - back) + s * v, P0[1] - s * (u - back) + c * v];
    for (const [pts, r] of parts) poly(pts.map(([u, v]) => at(u, v)), r);
    if (over) over(at);
    return at;
  }
  const muzzleSteam = (at, k, u = 18) => { if ((k || 0) > 0.4) { const m = at(u + 2, 0); for (let i = 0; i < 3; i++) disc(m[0] + (i - 1) * 1.5, m[1] - i * 1.2, 1.4 + i * 0.4, P.steam[2 - (i % 2)]); } };
  const MORTAR = [
    { key: 'A', name: '缩小臼炮', ref: '已定稿的 2×2 臼炮（同一套语言缩到 1×1）',
      idea: '短粗、越往炮口越粗的炮管 + 厚炮口箍 + 黑洞炮口，炮耳夹在方炮耳座里，底下一块低矮的铸铁炮床。和大臼炮一眼是一家。',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        box(x + 1, y + 18, 22, 6, IRON); rivet(x + 3, y + 20); rivet(x + 19, y + 20);
        const at = barrel(x, y, a, k, [[[[-4, -4], [14, -5.6], [14, 5.6], [-4, 4]], IRONL], [[[13, -6.4], [18, -6.4], [18, 6.4], [13, 6.4]], IRONL]], (at) => { const m = at(18, 0); disc(m[0], m[1], 2.6, P.dark[0]); });
        box(x + 8, y + 10, 8, 9, IRON); disc(x + 12, y + 13, 2.2, P.brass[0]); disc(x + 12, y + 13, 1.3, P.brass[3]);
        muzzleSteam(at, k);
      } },
    { key: 'B', name: '科霍恩铜臼炮', ref: '18～19 世纪的科霍恩臼炮（黄铜炮身 + 铁箍楔座）',
      idea: '一只黄铜小炮身（炮尾圆鼓、炮口有唇）坐在一块铁箍加固的楔形座上。剪影：一只坐在楔块上的铜壶。',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        poly([[x + 1, y + 24], [x + 23, y + 24], [x + 23, y + 17], [x + 8, y + 12], [x + 1, y + 16]], IRON);
        R(x + 3, y + 18, 18, 1, P.iron[3]); R(x + 3, y + 21, 18, 1, P.iron[1]);
        const at = barrel(x, y, a, k, [[[[-5, -4.4], [-1, -5.4], [14, -4], [14, 4], [-1, 5.4], [-5, 4.4]], BRASS], [[[14, -5.2], [17.5, -5.2], [17.5, 5.2], [14, 5.2]], BRASS]], (at) => { const m = at(17.5, 0); disc(m[0], m[1], 2.3, P.dark[0]); });
        disc(x + 12, y + 13, 1.8, P.iron[0]); disc(x + 12, y + 13, 1, P.iron[4]);
        muzzleSteam(at, k);
      } },
    { key: 'C', name: '双管臼炮', ref: '维多利亚要塞的双联臼炮',
      idea: '两根短炮管并排、一道黄铜箍捆在一起，共用一对炮耳；炮床是一块带斜切的铁座。剪影：一对并排的短管。',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        poly([[x + 1, y + 24], [x + 23, y + 24], [x + 23, y + 19], [x + 19, y + 17], [x + 5, y + 17], [x + 1, y + 19]], IRON);
        const at = barrel(x, y, a, k, [[[[-3, -6.2], [17, -6.2], [17, -0.6], [-3, -0.6]], IRONL], [[[-3, 0.6], [17, 0.6], [17, 6.2], [-3, 6.2]], IRONL], [[[6, -7], [9, -7], [9, 7], [6, 7]], BRASS]], (at) => { for (const v of [-3.4, 3.4]) { const m = at(17, v); disc(m[0], m[1], 1.6, P.dark[0]); } });
        box(x + 9, y + 11, 6, 7, IRON); disc(x + 12, y + 13, 1.6, P.brass[3]);
        muzzleSteam(at, k, 17);
      } },
    { key: 'D', name: '炮塔臼炮', ref: '一战要塞的装甲臼炮塔',
      idea: '一只低矮的半球装甲炮塔（铆钉一圈），粗短的炮管从炮塔里伸出来俯仰，炮管根部一块跟着炮管转的装甲防盾盖住炮塔开口；炮口是一道厚箍 + 口沿暗线（侧面看不到炮膛的圆洞）。剪影：圆顶 + 一根短管。（v2：去掉炮口的黑圆点和炮塔上的黑竖条）',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        g.save(); g.beginPath(); g.rect(x, y, 24, 20); g.clip(); ball(x + 12, y + 20, 10.5, IRON); g.restore();
        for (let i = 0; i < 7; i++) { const aa = Math.PI + i / 6 * Math.PI; px(x + 12 + Math.cos(aa) * 8.6, y + 19 + Math.sin(aa) * 8.6, P.iron[4]); }
        const at = barrel(x, y, a, k, [[[[1, -3.2], [15, -3.6], [15, 3.6], [1, 3.2]], IRONL], [[[14.5, -4.8], [18, -4.8], [18, 4.8], [14.5, 4.8]], IRONL], [[[-3.5, -5.6], [3.5, -5.6], [4.5, -3.6], [4.5, 3.6], [3.5, 5.6], [-3.5, 5.6]], IRONL]], (at) => {
          const m0 = at(17.6, -4), m1 = at(17.6, 4); line(m0[0], m0[1], m1[0], m1[1], 1, P.iron[1]);   // 炮口沿：一道暗线
          const h0 = at(15.2, -4.4), h1 = at(15.2, 4.4); line(h0[0], h0[1], h1[0], h1[1], 1, P.iron[4]);   // 炮口箍的亮边
          const q = at(0, 0); disc(q[0], q[1], 1.5, P.brass[2]); px(q[0] - 1, q[1] - 1, P.brass[3]);   // 防盾中心的耳轴盖
        });
        box(x + 0, y + 19, 24, 5, IRON);
        muzzleSteam(at, k);
      } },
    { key: 'E', name: '长管迫击炮', ref: '一战斯托克斯迫击炮（车载：两脚架换成一根液压撑杆）',
      idea: '一根细长的炮管，炮尾坐在圆座板的球座里，炮管中段由一根液压撑杆顶着——撑杆随仰角伸缩。剪影：一根斜杆 + 一根撑杆。',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        box(x + 2, y + 20, 20, 4, IRON);
        const at0 = barrel(x, y, a, k, []), mid = at0(9, 0), base = [x + 20, y + 20];
        line(base[0], base[1], mid[0], mid[1], 3, P.iron[0]); line(base[0], base[1], (base[0] + mid[0]) / 2, (base[1] + mid[1]) / 2, 1, P.iron[3]); line((base[0] + mid[0]) / 2, (base[1] + mid[1]) / 2, mid[0], mid[1], 1, P.iron[4]);
        barrel(x, y, a, k, [[[[-6, -2.4], [18, -2.4], [18, 2.4], [-6, 2.4]], IRONL], [[[16.5, -3.2], [18.5, -3.2], [18.5, 3.2], [16.5, 3.2]], BRASS]], (at) => { const m = at(18.5, 0); disc(m[0], m[1], 1.3, P.dark[0]); const b0 = at(-6, 0); disc(b0[0], b0[1], 2.4, P.brass[1]); });
        disc(base[0], base[1] - 0.5, 1.6, P.brass[2]);
        muzzleSteam(at0, k, 19);
      } },
    { key: 'F', name: '喇叭口臼炮', ref: '马莱特臼炮（Mallet\'s Mortar，1857）的大喇叭口',
      idea: '炮管往炮口急剧张开成喇叭口（最大的炮口），两道粗箍，坐在一只圆转盘上。剪影：一只斜着的大喇叭。',
      draw(x, y, o) {
        const a = o.a, k = o.k;
        box(x + 2, y + 19, 20, 5, IRON); R(x + 4, y + 21, 16, 1, P.iron[1]);
        const at = barrel(x, y, a, k, [[[[-4, -3.4], [8, -3.8], [14, -5.6], [17.5, -7.2], [17.5, 7.2], [14, 5.6], [8, 3.8], [-4, 3.4]], IRONL], [[[4, -4.4], [6, -4.4], [6, 4.4], [4, 4.4]], BRASS], [[[10, -5], [12, -5], [12, 5], [10, 5]], BRASS]], (at) => { const m = at(17.5, 0); disc(m[0], m[1], 4, P.dark[0]); });
        R(x + 9, y + 12, 6, 8, P.iron[2]); R(x + 9, y + 12, 1, 8, P.iron[3]); disc(x + 12, y + 13, 1.8, P.brass[3]);
        muzzleSteam(at, k);
      } },
    { key: 'G', name: '弹簧炮座', ref: '19 世纪末的弹簧复进炮架',
      idea: '炮管架在一只摇篮上，摇篮下两根粗螺旋弹簧撑着——开炮时弹簧被压扁、再弹回。剪影：短管 + 底下两只弹簧。',
      draw(x, y, o) {
        const a = o.a, k = o.k || 0, sq = k * 3;
        box(x + 1, y + 21, 22, 3, IRON);
        for (const sx of [5, 17]) { const top = y + 15 + sq; for (let yy = top; yy < y + 21; yy += 1.5) R(x + sx - 2, yy, 5, 1, (Math.round(yy * 2) % 3) ? P.iron[3] : P.iron[1]); }
        R(x + 3, y + 14 + sq, 18, 2, P.iron[2]); R(x + 3, y + 14 + sq, 18, 1, P.iron[4]);
        const at = barrel(x, y + sq * 0.5, a, k, [[[[-4, -3.6], [15, -4.4], [15, 4.4], [-4, 3.6]], IRONL], [[[14.5, -5.4], [17.5, -5.4], [17.5, 5.4], [14.5, 5.4]], IRONL]], (at) => { const m = at(17.5, 0); disc(m[0], m[1], 2.2, P.dark[0]); });
        disc(x + 12, y + 13 + sq * 0.5, 1.8, P.brass[3]);
        muzzleSteam(at, k);
      } },
  ];

  // ================= 联合驾驶舱（双人）cockpit_pair（1×2 = 24×48 控制）：两名驾驶员保持 1×1 大小 =================
  // holes = 两名驾驶员的圆窗中心（游戏的 cockpitCrew 在这里按半径 4.8 剪一个圆，画煤球小人）；造型只画窗框，窗里留深色
  const porthole = (cx, cy, r = 6.4, ramp = BRASS) => { ball(cx, cy, r, ramp); disc(cx, cy, 5, P.glass[0]); };
  const COCKPIT = [
    { key: 'A', name: '双层潜水钟', ref: '现役 1×1 驾驶舱（潜水盔）叠两层',
      idea: '上层是一只和现役驾驶舱一样的潜水盔圆顶，下层是一段铆接的圆筒舱，中间一圈黄铜领箍；两扇圆窗上下各一。和单人舱一眼是一家。', holes: [[12, 12], [12, 35]],
      draw(x, y, o) {
        g.save(); g.beginPath(); g.rect(x, y, 24, 22); g.clip(); ball(x + 12, y + 13, 10.5, IRONL); g.restore();
        box(x + 2, y + 23, 20, 22, IRON); for (const yy of [26, 42]) { rivet(x + 4, y + yy); rivet(x + 18, y + yy); }
        R(x + 1, y + 20, 22, 4, P.brass[0]); R(x + 2, y + 20, 20, 3, P.brass[1]); R(x + 2, y + 20, 20, 1, P.brass[3]);
        R(x + 3, y + 45, 18, 3, P.brass[0]); R(x + 4, y + 45, 16, 1, P.brass[2]);
        porthole(x + 12, y + 12); porthole(x + 12, y + 35);
        R(x + 10, y + 0, 4, 2, P.brass[1]);
      } },
    { key: 'B', name: '电车驾驶室', ref: '维多利亚有轨电车的驾驶台',
      idea: '一间高高的方舱，顶上黄铜拱顶，正面上下两扇圆窗，门缝、铰链和一盏小头灯，底下一级踏板。剪影：竖长方盒 + 拱顶。',
      holes: [[12, 14], [12, 33]],
      draw(x, y, o) {
        poly([[x + 1, y + 6], [x + 4, y + 2], [x + 20, y + 2], [x + 23, y + 6], [x + 23, y + 45], [x + 1, y + 45]], IRON);
        R(x + 2, y + 2, 20, 3, P.brass[1]); R(x + 4, y + 1, 16, 1, P.brass[3]);
        R(x + 3, y + 23, 18, 1, P.iron[0]); R(x + 3, y + 24, 18, 1, P.iron[3]);
        R(x + 20, y + 8, 1, 35, P.iron[1]); for (const yy of [10, 38]) R(x + 19, y + yy, 3, 2, P.brass[2]);
        porthole(x + 12, y + 14); porthole(x + 12, y + 33);
        disc(x + 4, y + 25, 1.6, P.brass[1]); px(x + 3, y + 24, P.glass[3]);
        R(x + 3, y + 45, 18, 3, P.iron[1]); R(x + 3, y + 45, 18, 1, P.iron[3]);
      } },
    { key: 'C', name: '机车驾驶室', ref: '蒸汽机车的司机室（出檐顶棚 + 前窗 + 汽笛）',
      idea: '一块全宽的出檐顶棚压在舱顶，顶棚上一只黄铜汽笛偶尔冒汽；上窗是一扇圆角大前窗，下窗是圆窗，侧边一根黄铜扶手。剪影：T 字顶的高舱。',
      holes: [[12, 16], [12, 36]],
      draw(x, y, o) {
        const t = o.t || 0;
        box(x + 3, y + 6, 18, 41, IRON);
        R(x + 0, y + 3, 24, 4, P.iron[0]); R(x + 1, y + 3, 22, 2, P.iron[3]); R(x + 1, y + 5, 22, 1, P.brass[2]);
        R(x + 10, y + 0, 3, 3, P.brass[1]); R(x + 10, y + 0, 1, 3, P.brass[3]); if (saw(t, 120) < 0.15) puff(x + 11, y + 0, t, 2, 4);
        box(x + 5, y + 9, 14, 14, BRASS); disc(x + 12, y + 16, 5, P.glass[0]);
        porthole(x + 12, y + 36);
        R(x + 21, y + 10, 1, 34, P.brass[2]);
        for (const yy of [26, 44]) { rivet(x + 5, y + yy); rivet(x + 17, y + yy); }
      } },
    { key: 'D', name: '潜艇指挥塔', ref: '维多利亚潜艇（鹦鹉螺号）的指挥塔',
      idea: '一整根圆角的铆接塔身，上下两扇厚圆窗，侧面一只舱门手轮，塔顶一圈护栏。剪影：圆头长胶囊。', holes: [[12, 14], [12, 34]],
      draw(x, y, o) {
        const t = o.t || 0;
        shape((u, v) => { const lx = u - x, ly = v - y; if (lx < 2 || lx > 22 || ly < 3 || ly > 47) return false; const cy = ly < 12 ? 12 : ly; return (lx - 12) ** 2 * (ly < 12 ? 1 : 0) + (ly < 12 ? (cy - ly) ** 2 : 0) <= 100 || ly >= 12; }, x + 1, y + 2, x + 23, y + 47, IRONL);
        for (let yy = 8; yy < 46; yy += 4) { px(x + 4, y + yy, P.iron[4]); px(x + 19, y + yy, P.iron[4]); }
        R(x + 7, y + 1, 10, 1, P.iron[3]); R(x + 7, y + 1, 1, 3, P.iron[3]); R(x + 16, y + 1, 1, 3, P.iron[3]);
        porthole(x + 12, y + 14, 6.6, IRONL); porthole(x + 12, y + 34, 6.6, IRONL);
        const a = t * 0.02; ring(x + 19, y + 24, 2.5, P.brass[2]); for (let k = 0; k < 4; k++) px(x + 19 + Math.cos(a + k * TAU / 4) * 1.6, y + 24 + Math.sin(a + k * TAU / 4) * 1.6, P.brass[1]);
      } },
    { key: 'E', name: '双泡吊舱', ref: '飞艇吊舱的玻璃观察泡',
      idea: '一根铆接竖梁上串着两只黄铜框的球形观察泡，两侧各一片小尾鳍；驾驶员坐在泡里。剪影：两只圆球叠在一根杆上。', holes: [[12, 12], [12, 35]],
      draw(x, y, o) {
        box(x + 9, y + 2, 6, 44, IRON);
        for (const [cy, s] of [[12, 1], [35, -1]]) { poly([[x + 1, y + cy + 6], [x + 5, y + cy], [x + 5, y + cy + 8]], IRON); poly([[x + 23, y + cy + 6], [x + 19, y + cy], [x + 19, y + cy + 8]], IRON); }
        for (const cy of [12, 35]) { ball(x + 12, y + cy, 9, BRASS); disc(x + 12, y + cy, 7, P.glass[1]); disc(x + 12, y + cy, 5, P.glass[0]); px(x + 8, y + cy - 4, P.glass[3]); }
        R(x + 8, y + 45, 8, 3, P.iron[1]);
      } },
    { key: 'F', name: '哥特双窗塔', ref: '哥特复兴的钟楼 / 礼拜堂窗',
      idea: '石砌的方塔，两扇尖拱窗框上下排列（驾驶员坐在尖拱里的圆窗后），塔顶两角各一只小尖饰，中间一道檐线。剪影：带尖角的高塔。', holes: [[12, 15], [12, 36]],
      draw(x, y, o) {
        box(x + 2, y + 4, 20, 43, IRONL);
        for (let yy = 8; yy < 46; yy += 5) R(x + 3, y + yy, 18, 1, P.iron[2]);
        poly([[x + 1, y + 5], [x + 3, y + 0], [x + 5, y + 5]], IRONL); poly([[x + 19, y + 5], [x + 21, y + 0], [x + 23, y + 5]], IRONL);
        R(x + 1, y + 25, 22, 2, P.brass[1]); R(x + 1, y + 25, 22, 1, P.brass[3]);
        for (const cy of [15, 36]) { poly([[x + 5, y + cy + 7], [x + 5, y + cy - 3], [x + 12, y + cy - 9], [x + 19, y + cy - 3], [x + 19, y + cy + 7]], BRASS); disc(x + 12, y + cy, 5.2, P.dark[0]); disc(x + 12, y + cy, 5, P.glass[0]); }
      } },
    { key: 'G', name: '装甲指挥舱', ref: '一战装甲车的指挥舱',
      idea: '两块厚铆接装甲板上下叠着（下板略宽），每块开一扇圆舱口，舱口上一道观察缝眉罩；大螺栓一圈。最硬朗的一种。剪影：两级台阶的厚板。', holes: [[12, 14], [12, 35]],
      draw(x, y, o) {
        poly([[x + 3, y + 3], [x + 21, y + 3], [x + 22, y + 25], [x + 2, y + 25]], IRONL);
        poly([[x + 1, y + 24], [x + 23, y + 24], [x + 23, y + 47], [x + 1, y + 47]], IRON);
        for (const [a, b] of [[4, 5], [18, 5], [4, 21], [18, 21], [3, 27], [19, 27], [3, 44], [19, 44]]) rivet(x + a, y + b);
        for (const cy of [14, 35]) { R(x + 5, y + cy - 8, 14, 2, P.iron[0]); R(x + 6, y + cy - 8, 12, 1, P.iron[4]); porthole(x + 12, y + cy, 6.4, IRONL); }
      } },
  ];

  // ================= 加压舱 pressure_chamber（1×1 能源）：压力表 + 安全阀，不发光（不是锅炉） =================
  const valvePuff = (x, y, t, per = 110) => { if (saw(t, per) < 0.2) puff(x, y, t * 2, 3, 7); };
  const PRESS = [
    { key: 'A', name: '球形压力罐', ref: '维多利亚工厂的球形蒸汽罐',
      idea: '一只铆接的圆球罐坐在马鞍座上，正面一只压力表（指针随压力摆），顶上一只安全阀，定时「噗」地泄一口汽。剪影：座上一只球。',
      draw(x, y, o) {
        const t = o.t || 0;
        R(x + 4, y + 18, 16, 6, P.iron[0]); box(x + 3, y + 19, 18, 5, IRON);
        ball(x + 12, y + 11, 8.5, IRONL); ring(x + 12, y + 11, 6.4, P.iron[2]);
        gauge(x + 12, y + 12, 3.6, 0.45 + 0.35 * Math.sin(t * 0.05));
        R(x + 11, y + 1, 3, 2, P.brass[1]); R(x + 10, y + 0, 5, 1, P.brass[2]);
        valvePuff(x + 12, y + 0, t);
      } },
    { key: 'B', name: '三联气瓶', ref: '压缩空气瓶组 + 集气管',
      idea: '三只竖放的圆头气瓶（黄铜箍）并排，顶上一根集气管把它们串起来，集气管一头一只压力表、一头一只安全阀。剪影：三根竖柱。',
      draw(x, y, o) {
        const t = o.t || 0;
        box(x + 1, y + 21, 22, 3, IRON);
        for (const u of [2, 9, 16]) { vtube(x + u, y + 7, 6, 14); disc(x + u + 3, y + 7, 3, P.iron[0]); disc(x + u + 3, y + 7, 2.2, P.iron[3]); R(x + u, y + 12, 6, 1, P.brass[2]); R(x + u, y + 17, 6, 1, P.brass[1]); }
        htube(x + 3, y + 2, 16, 3, IRONL);
        gauge(x + 20, y + 3.5, 3, 0.5 + 0.3 * Math.sin(t * 0.04));
        R(x + 2, y + 1, 2, 3, P.brass[2]); valvePuff(x + 3, y + 0, t, 130);
      } },
    { key: 'C', name: '活塞增压泵', ref: '蒸汽活塞式空气压缩机',
      idea: '卧式汽缸里一根活塞杆来回推（十字头在导轨上滑），压进右边一只小储气罐；罐顶一只压力表。剪影：横缸 + 立罐。',
      draw(x, y, o) {
        const t = o.t || 0, s = Math.sin(t * 0.18) * 2.5;
        box(x + 1, y + 20, 22, 4, IRON);
        box(x + 1, y + 10, 11, 9, IRONL); R(x + 3, y + 10, 1, 9, P.brass[2]); R(x + 9, y + 10, 1, 9, P.brass[2]);
        htube(x + 12, y + 13, 5 + s, 3, IRONL); R(x + 15 + s, y + 12, 2, 5, P.brass[1]);
        vtube(x + 17, y + 6, 6, 14); disc(x + 20, y + 6, 3, P.iron[0]); disc(x + 20, y + 6, 2.2, P.iron[3]);
        gauge(x + 6, y + 6, 3.2, 0.4 + 0.2 * Math.sin(t * 0.18));
        R(x + 5, y + 9, 2, 1, P.brass[0]);
      } },
    { key: 'D', name: '压力钟', ref: '维多利亚铆接压力容器（钟形）',
      idea: '一只上窄下宽的钟形铆接容器坐在圆座上，正面一只大压力表，钟顶一只汽笛阀定时鸣一声、冒一口汽。剪影：一口钟。',
      draw(x, y, o) {
        const t = o.t || 0;
        poly([[x + 7, y + 3], [x + 17, y + 3], [x + 19, y + 8], [x + 21, y + 19], [x + 3, y + 19], [x + 5, y + 8]], IRONL);
        for (const yy of [8, 14]) { px(x + 5, y + yy, P.iron[4]); px(x + 18, y + yy, P.iron[4]); }
        box(x + 2, y + 19, 20, 5, IRON);
        gauge(x + 12, y + 12, 4.4, 0.35 + 0.4 * saw(t, 110));
        R(x + 11, y + 0, 2, 3, P.brass[1]); R(x + 10, y + 0, 4, 1, P.brass[3]);
        valvePuff(x + 12, y + 0, t);
      } },
    { key: 'E', name: '杠杆安全阀鼓', ref: '早期锅炉的杠杆重锤安全阀',
      idea: '一只卧式圆鼓（两头圆封头），顶上一根杠杆：一头铰在阀座上、另一头挂一只重锤球；压力到了重锤被顶起、泄汽，再落回去。剪影：横鼓 + 一根斜杠杆。',
      draw(x, y, o) {
        const t = o.t || 0, p = saw(t, 120), lift = p < 0.12 ? p / 0.12 : p < 0.3 ? 1 - (p - 0.12) / 0.18 : 0;
        shape((u, v) => { const lx = u - x, ly = v - y; if (ly < 9 || ly > 20) return false; const r = 5.5; if (lx < 1 || lx > 23) return false; if (lx < 1 + r) return (lx - 1 - r) ** 2 + (ly - 14.5) ** 2 <= r * r; if (lx > 23 - r) return (lx - 23 + r) ** 2 + (ly - 14.5) ** 2 <= r * r; return true; }, x, y + 8, x + 24, y + 21, IRONL);
        box(x + 4, y + 20, 16, 4, IRON);
        gauge(x + 7, y + 14.5, 3, 0.5 + 0.3 * lift);
        R(x + 5, y + 6, 3, 3, P.brass[1]);
        const ex = x + 20, ey = y + 5 - lift * 2.5; line(x + 6, y + 6, ex, ey, 1, P.iron[0]); line(x + 6, y + 5, ex, ey - 1, 1, P.iron[4]);
        disc(ex, ey, 2.2, P.iron[0]); disc(ex - 0.4, ey - 0.4, 1.5, P.iron[3]);
        if (lift > 0.3) puff(x + 6, y + 5, t * 2, 2, 5);
      } },
    { key: 'F', name: '风箱增压器', ref: '铁匠风箱 + 储气包',
      idea: '左边一只皮风箱被曲柄一压一放（褶子一收一张），把气打进右边一只小储气包；储气包顶上一只压力表。剪影：手风琴 + 小罐。（用户选定；以后加压舱改成 1×2，见下面的 F2）',
      draw(x, y, o) {
        const t = o.t || 0, s = (Math.sin(t * 0.15) + 1) / 2, top = y + 5 + s * 5;
        box(x + 1, y + 20, 22, 4, IRON);
        R(x + 1, top - 2, 11, 2, P.brass[1]); R(x + 1, top - 2, 11, 1, P.brass[3]);
        const h = y + 19 - top; for (let i = 0; i < 4; i++) { const yy = top + i * h / 4; poly([[x + 2, yy], [x + 11, yy], [x + 12, yy + h / 8], [x + 11, yy + h / 4], [x + 2, yy + h / 4], [x + 1, yy + h / 8]], LEATHER); }
        R(x + 1, y + 18, 11, 2, P.brass[1]);
        htube(x + 11, y + 15, 3, 3, IRONL);
        vtube(x + 14, y + 7, 8, 13); disc(x + 18, y + 7, 4, P.iron[0]); disc(x + 18, y + 7, 3.2, P.iron[3]);
        gauge(x + 18, y + 13, 2.8, 0.3 + 0.5 * s);
      } },
    { key: 'F2', name: '风箱增压器 · 1×2', size: [1, 2], ref: '铁匠风箱 + 储气包 + 曲柄',
      idea: '扩大到 1×2（用户定：以后加压舱都是这个大小）。左边一只高高的皮风箱（六道褶），顶板由上面一只曲柄盘带着一压一放；右边一只立式储气包（黄铜箍），正面压力表跟着打气摆，顶上安全阀定时泄一口汽；底下一根连通管。',
      draw(x, y, o) {
        const t = o.t || 0, ph = t * 0.12, s = (Math.sin(ph) + 1) / 2, top = y + 14 + s * 9;
        box(x + 1, y + 43, 22, 5, IRON); rivet(x + 3, y + 45); rivet(x + 19, y + 45);
        // 储气包
        vtube(x + 13, y + 11, 10, 32); disc(x + 18, y + 11, 5, P.iron[0]); disc(x + 18, y + 11, 4.2, P.iron[3]); disc(x + 16.5, y + 9.5, 1.5, P.iron[4]);
        for (const yy of [19, 36]) { R(x + 13, y + yy, 10, 2, P.brass[1]); R(x + 13, y + yy, 10, 1, P.brass[3]); }
        gauge(x + 18, y + 27.5, 3.6, 0.25 + 0.55 * s);
        R(x + 17, y + 3, 3, 3, P.brass[1]); R(x + 16, y + 3, 5, 1, P.brass[3]);
        valvePuff(x + 18.5, y + 3, t, 130);
        // 风箱
        const h = y + 41 - top; for (let i = 0; i < 6; i++) { const yy = top + i * h / 6; poly([[x + 2, yy], [x + 10, yy], [x + 11.5, yy + h / 12], [x + 10, yy + h / 6], [x + 2, yy + h / 6], [x + 0.5, yy + h / 12]], LEATHER); }
        R(x + 1, top - 2, 11, 2, P.brass[1]); R(x + 1, top - 2, 11, 1, P.brass[3]); R(x + 1, y + 40, 11, 3, P.brass[0]); R(x + 1, y + 40, 11, 1, P.brass[2]);
        htube(x + 11, y + 38, 3, 3, IRONL);
        // 曲柄：顶上一只小飞轮，连杆拉着风箱顶板
        const C = [x + 6, y + 6], pin = [C[0] + Math.cos(ph - Math.PI / 2) * 2.6, C[1] + Math.sin(ph - Math.PI / 2) * 2.6];
        disc(C[0], C[1], 4, P.iron[0]); disc(C[0], C[1], 3.2, P.iron[3]); disc(C[0], C[1], 1.2, P.brass[2]);
        R(x + 5, y + 10, 2, 1, P.iron[1]);
        line(pin[0], pin[1], x + 6, top - 2, 2, P.iron[0]); line(pin[0], pin[1], x + 6, top - 2, 1, P.iron[4]);
        disc(pin[0], pin[1], 1, P.brass[3]);
      } },
  ];

  // ================= 冷凝器 condenser（1×2 = 24×48 冷却）：实心，不像水箱（没有大窗、没有水位）也不像散热片（没有密排的鳍片） =================
  // 冷却的语义色是青（P.water）：只用在冷却水管、水滴、管口这些「冷」的地方
  const drip = (x, y, t, per = 40, fall = 6) => { const p = saw(t, per); disc(x, y + p * fall, 0.8, P.water[2]); };
  const COND = [
    { key: 'A', name: '盘管冷凝柱', ref: '蒸馏器的蛇形冷凝盘管',
      idea: '一根实心铁柱外面绕着一条盘管（只看得到朝前的一股股斜管），管外凝着一颗颗青色水珠，管的低端一直往下滴水；柱底一只青色出水嘴。剪影：竖柱 + 一串斜纹。（v2：水珠加多）',
      draw(x, y, o) {
        const t = o.t || 0;
        vtube(x + 6, y + 3, 12, 40); disc(x + 12, y + 3, 6, P.iron[0]); disc(x + 12, y + 3, 5, P.iron[3]);
        box(x + 3, y + 43, 18, 5, IRON);
        for (let i = 0; i < 7; i++) {
          const yy = y + 7 + i * 5;
          line(x + 3, yy, x + 21, yy + 2.4, 2, P.brass[0]); line(x + 3, yy - 0.5, x + 21, yy + 1.9, 1, P.brass[2]); px(x + 2, yy + 1, P.brass[1]); px(x + 21, yy + 3, P.brass[0]);
          for (const [u, ph] of [[5 + (i % 3) * 2, 0], [11 + (i % 2) * 3, 1], [17 - (i % 3), 2]]) { const bx = x + u, by = yy + (u - 3) * 2.4 / 18 + 1.6; px(bx, by, P.water[2]); px(bx, by + 1, P.water[1]); if ((i + ph) % 2) px(bx, by, P.water[3]); }   // 凝在管上的水珠
          const p = saw(t + i * 17, 45); if (p < 0.7) { const dy = p / 0.7 * 4.5; px(x + 21, yy + 4 + dy, P.water[2]); if (dy > 1) px(x + 21, yy + 3 + dy, P.water[1]); }   // 管的低端往下滴
        }
        R(x + 1, y + 40, 4, 2, P.water[1]); drip(x + 2, y + 42, t);
      } },
    { key: 'B', name: '管板冷凝器', ref: '船用表面冷凝器（管板 + 管束）',
      idea: '竖放的圆筒冷凝器，顶上是一块管板，一圈圈青色的管口（冷却管的端头）露在外面；上下两道法兰一圈螺栓，侧面进出水管口是青色。剪影：带法兰的竖筒。',
      draw(x, y, o) {
        const t = o.t || 0;
        vtube(x + 4, y + 8, 16, 34);
        for (const yy of [7, 40]) { R(x + 2, y + yy, 20, 3, P.iron[0]); R(x + 3, y + yy, 18, 1, P.iron[4]); for (let u = 4; u < 20; u += 3) px(x + u, y + yy + 1, P.iron[2]); }
        shape((u, v) => (u - x - 12) ** 2 / 64 + (v - y - 5) ** 2 / 9 <= 1, x + 3, y + 1, x + 21, y + 9, IRONL);
        for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { if (Math.abs(i) === 2 && j !== 0) continue; px(x + 12 + i * 2.6, y + 5 + j * 1.6, P.water[saw(t + i * 7, 60) < 0.5 ? 2 : 1]); }
        for (const [yy, side] of [[14, -1], [34, 1]]) { const xx = side < 0 ? x + 1 : x + 20; R(xx, y + yy, 3, 4, P.water[1]); R(xx, y + yy, 3, 1, P.water[2]); }
        box(x + 3, y + 43, 18, 5, IRON);
      } },
    { key: 'C', name: '冷凝塔', ref: '冷却塔（双曲线收腰）的缩小版',
      idea: '一座收腰的双曲线铁塔（横向铆缝一道道），塔口冒出一缕缕白汽，塔脚一圈青色的集水槽。剪影：沙漏形的高塔。',
      draw(x, y, o) {
        const t = o.t || 0, hw = (ly) => 10 - 4.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, (ly - 4) / 38)));
        shape((u, v) => { const lx = u - x - 12, ly = v - y; return ly >= 4 && ly <= 42 && Math.abs(lx) <= hw(ly); }, x, y + 3, x + 24, y + 43, IRONL);
        for (let ly = 10; ly < 42; ly += 6) R(x + 12 - hw(ly) + 1, y + ly, hw(ly) * 2 - 2, 1, P.iron[2]);
        R(x + 1, y + 42, 22, 3, P.water[1]); R(x + 2, y + 42, 20, 1, P.water[2]);
        box(x + 1, y + 45, 22, 3, IRON);
        puff(x + 12, y + 4, t, 3, 4);
      } },
    { key: 'D', name: '双筒 U 形冷凝器', ref: '回流式双筒冷凝器（U 形弯头）',
      idea: '两根细长的竖筒并排，顶上和底下各一道黄铜 U 形弯头把它们连成一圈，左筒上一只青色的流量窗里有水珠往下走。剪影：一个竖长的「口」字。',
      draw(x, y, o) {
        const t = o.t || 0;
        vtube(x + 3, y + 7, 7, 29); vtube(x + 14, y + 7, 7, 29);
        for (const [yy, up] of [[7, 1], [36, -1]]) { g.save(); g.beginPath(); g.rect(x, up > 0 ? y : y + yy, 24, up > 0 ? yy + 1 : 48); g.clip(); ring(x + 12, y + yy, 6.5, P.brass[0]); ring(x + 12, y + yy, 5.5, P.brass[2]); ring(x + 12, y + yy, 4.8, P.brass[0]); g.restore(); }
        R(x + 5, y + 16, 3, 12, P.water[0]); R(x + 6, y + 16, 1, 12, P.water[1]); disc(x + 6.5, y + 16 + saw(t, 50) * 11, 0.8, P.water[3]);
        box(x + 1, y + 44, 22, 4, IRON);
      } },
    { key: 'E', name: '瓦特冷凝器', ref: '瓦特的分离冷凝器 + 空气泵（1765）',
      idea: '下半是一只铆接的冷凝箱，上半一只竖放的空气泵缸，缸顶一根摇杆一上一下地拉活塞杆；箱侧一根青色的冷水进水管。剪影：箱子上立一根缸 + 一根摇杆。',
      draw(x, y, o) {
        const t = o.t || 0, s = Math.sin(t * 0.08) * 2;
        box(x + 1, y + 26, 22, 22, IRON); for (const [a, b] of [[3, 28], [19, 28], [3, 44], [19, 44]]) rivet(x + a, y + b);
        R(x + 3, y + 36, 18, 1, P.iron[1]);
        vtube(x + 7, y + 10, 10, 16); R(x + 6, y + 10, 12, 2, P.brass[1]); R(x + 6, y + 24, 12, 2, P.brass[1]);
        R(x + 11, y + 4 + s, 2, 7 - s, P.iron[4]);
        const pv = [x + 5, y + 5]; line(pv[0], pv[1], x + 21, y + 4 + s * 1.4, 2, P.iron[0]); line(pv[0], pv[1] - 0.5, x + 21, y + 3.5 + s * 1.4, 1, P.iron[3]);
        disc(pv[0], pv[1], 1.8, P.brass[2]); R(x + 4, y + 6, 2, 20, P.iron[1]);
        R(x + 20, y + 30, 4, 3, P.water[1]); R(x + 20, y + 30, 4, 1, P.water[2]);
      } },
    { key: 'F', name: '喷淋冷凝器', ref: '喷射式冷凝器（冷水直接喷进蒸汽）',
      idea: '一只高高的铁柜，顶上一只黄铜喷头，正面几道横向观察缝里能看到青色的水雨一直往下落；柜底一根排水管滴水。剪影：带喷头的高柜。',
      draw(x, y, o) {
        const t = o.t || 0;
        box(x + 2, y + 5, 20, 39, IRON);
        R(x + 8, y + 1, 8, 4, P.brass[1]); R(x + 8, y + 1, 8, 1, P.brass[3]); R(x + 11, y + 0, 2, 1, P.brass[2]);
        for (const yy of [11, 20, 29]) { R(x + 4, y + yy, 16, 4, P.dark[0]); for (let k = 0; k < 6; k++) { const xx = x + 5 + k * 2.6, p = saw(t + k * 13, 24); px(xx, y + yy + Math.floor(p * 4), P.water[2]); } R(x + 4, y + yy - 1, 16, 1, P.iron[3]); }
        for (const [a, b] of [[4, 7], [18, 7], [4, 39], [18, 39]]) rivet(x + a, y + b);
        box(x + 1, y + 44, 22, 4, IRON); R(x + 20, y + 41, 3, 3, P.water[1]); drip(x + 21.5, y + 44, t, 36, 4);
      } },
  ];

  const MODS = [
    { id: 'autoloader', name: '装弹机', w: 1, h: 1, rule: '1×1 控制 · 看得到炮弹和机械（黄铜炮弹只作零件，主体仍是冷铁）· 不出格', SET: AUTOLOADER },
    { id: 'mortar_s', name: '小臼炮', w: 1, h: 1, weapon: true, rule: '1×1 火力（武器可以出格）· 耳轴 (12,13)、炮口离耳轴 18、仰角 32°～82° · 没有火药，开火喷蒸汽', SET: MORTAR },
    { id: 'cockpit_pair', name: '联合驾驶舱（双人）', w: 1, h: 2, crew: true, rule: '1×2 控制 · 两名驾驶员保持 1×1 大小（圆窗半径 4.8，和单人舱一样）· 玻璃是控制类的语义色', SET: COCKPIT },
    { id: 'pressure_chamber', name: '加压舱', w: 1, h: 1, rule: '1×1 能源 · 压力表 + 安全阀，不发光（它不是锅炉，没有火门和炉火）', SET: PRESS },
    { id: 'condenser', name: '冷凝器', w: 1, h: 2, rule: '1×2 冷却 · 实心，不像水箱（没有大窗和水位）也不像散热片（没有密排鳍片）· 青色只用在冷水管、水滴、管口', SET: COND },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  return { MODS, figure };
})();
