// 历史存档：辅助四件（蓄压罐 / 测距仪 / 陀螺仪 / 散热片 v1，各 6 种）。原「当前开发」页的绘制代码。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期（2026-09-29）：蓄压罐 pressure_tank（1×2）、测距仪 rangefinder（1×1）、陀螺仪 gyroscope（1×1）、散热片 radiator（1×2 侧挂）。
// 每种 6 个：A～C 是 2026-09-27 夜间候选 v1（tools/cand-early.js / cand-mid.js）按现在的画法重画，D～F 是新方向。
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



  // ================= 小工具 =================
  const bottle = (x, y, w, h, r = IRONL) => {   // 竖放的铆接气瓶：上下圆顶 + 竖缝铆钉
    vtube(x, y + w / 2, w, h - w, r);
    shape((xx, yy) => ((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y - w / 2) / (w / 2)) ** 2 <= 1 && yy <= y + w / 2 + 0.5, x, y, x + w, y + w / 2 + 1, r);
    shape((xx, yy) => ((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y - h + w / 2) / (w / 2)) ** 2 <= 1 && yy >= y + h - w / 2 - 0.5, x, y + h - w / 2 - 1, x + w, y + h, r);
  };
  const band = (x, y, w, h = 2) => { R(x, y, w, h, P.brass[1]); R(x, y, w, 1, P.brass[3]); if (h > 2) R(x, y + h - 1, w, 1, P.brass[0]); };
  const glint = (x, y, t, per = 60) => { const p = saw(t, per); if (p < 0.12) { px(x, y, P.white); px(x + 1, y - 1, P.glass[3]); } };
  const ellRing = (cx, cy, rx, ry, c, c2) => { const n = Math.ceil(Math.max(rx, ry) * 7) + 4; for (let i = 0; i < n; i++) { const a = i / n * TAU; px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c2 && Math.sin(a) > 0 ? c2 : c); } };
  const cyanPipe = (x, y, w, t) => { R(x, y, w, 4, P.water[0]); R(x, y + 1, w, 2, P.water[1]); R(x, y + 1, w, 1, P.water[2]); for (let u = 0; u < w; u++) if (saw(t * 0.6 + u * 4, 60) < 0.08) px(x + u, y + 1, P.water[3]); };   // 冷却液集管：只有这里用青色，亮点在流
  const bracket = (x, y) => { R(x, y, 5, 5, P.iron[0]); R(x + 1, y + 1, 3, 3, P.iron[2]); px(x + 1, y + 1, P.iron[4]); px(x + 3, y + 3, P.iron[1]); };

  // ================= 蓄压罐 pressure_tank（1×2 = 24×48，能源）：存量看得见（o.lv 0～1），没有青色 =================
  const PTANK = [
    { key: 'A', name: '立式气瓶', ref: '（v1 候选 A 重画）',
      idea: '一只高高的铆接气瓶，上下圆顶、两道黄铜箍，腰上一只大压力表显示存量，瓶顶一只阀门。充气时阀门口冒一丝白汽。最直观。',
      draw(x, y, o) {
        R(x + 3, y + 45, 18, 3, P.iron[0]); R(x + 4, y + 45, 16, 1, P.iron[3]);
        bottle(x + 4, y + 3, 16, 43); band(x + 4, y + 14, 16); band(x + 4, y + 36, 16);
        for (let yy = y + 18; yy < y + 35; yy += 3) px(x + 6, yy, P.iron[4]);
        R(x + 10, y + 0, 4, 4, P.brass[1]); R(x + 8, y + 0, 8, 1, P.brass[2]);
        gauge(x + 12, y + 25, 5, o.lv); disc(x + 12, y + 25, 0.9, P.brass[2]);
      },
      fx(x, y, o) { if (o.chg) puff(x + 12, y, o.t, 2, 6); } },
    { key: 'B', name: '双瓶组', ref: '（v1 候选 B 重画）',
      idea: '两只细长气瓶并排，顶上一根黄铜汇流管把它们接在一起，汇流管正中一只压力表；两道皮带把两只瓶捆在底座上。「成组储备」，剪影是两根竖条。',
      draw(x, y, o) {
        R(x + 1, y + 45, 22, 3, P.iron[0]); R(x + 2, y + 45, 20, 1, P.iron[3]);
        for (const u of [2, 13]) { bottle(x + u, y + 10, 9, 36); }
        for (const v of [22, 36]) { R(x + 1, y + v, 22, 2, P.leather[1]); R(x + 1, y + v, 22, 1, P.leather[2]); R(x + 11, y + v - 1, 2, 4, P.brass[2]); }
        R(x + 3, y + 7, 18, 3, P.brass[0]); R(x + 3, y + 7, 18, 2, P.brass[1]); R(x + 3, y + 7, 18, 1, P.brass[3]);
        for (const u of [6, 17]) R(x + u, y + 9, 2, 3, P.brass[1]);
        R(x + 11, y + 4, 2, 4, P.brass[1]); gauge(x + 12, y + 4, 3.6, o.lv);
      },
      fx(x, y, o) { if (o.chg) puff(x + 20, y + 7, o.t, 2, 5); } },
    { key: 'C', name: '储气球 + 液柱表', ref: '（v1 候选 C 重画）',
      idea: '顶上一只铆接储气球（黄铜赤道箍），下面的立管上开一道竖窗，窗里的绿色液柱就是存量——高低一眼可见；底座一只安全阀。存量表达最清楚。',
      draw(x, y, o) {
        R(x + 3, y + 44, 18, 4, P.iron[0]); R(x + 4, y + 44, 16, 1, P.iron[3]);
        vtube(x + 7, y + 20, 10, 25, IRONL); R(x + 9, y + 23, 6, 19, P.dark[0]); const h = Math.round(17 * o.lv); R(x + 10, y + 41 - h, 4, h, P.gauge[1]); R(x + 10, y + 41 - h, 4, 1, P.gauge[3]); R(x + 10, y + 41 - h, 1, h, P.gauge[2]);
        for (let v = 24; v <= 40; v += 4) px(x + 15, y + v, P.brass[2]);
        ball(x + 12, y + 12, 10, IRONL); R(x + 2, y + 12, 20, 2, P.brass[1]); R(x + 2, y + 12, 20, 1, P.brass[3]); px(x + 8, y + 6, P.iron[4]); px(x + 9, y + 5, P.iron[4]);
        R(x + 17, y + 38, 5, 3, P.brass[1]); R(x + 20, y + 35, 2, 3, P.brass[2]);
      },
      fx(x, y, o) { if (o.lv > 0.92) puff(x + 21, y + 34, o.t, 2, 5); } },
    { key: 'D', name: '杠杆安全阀储汽罐', ref: '新：维多利亚锅炉的杠杆安全阀（长杠杆 + 铁球配重）+ 外挂刻度尺',
      idea: '一只铆接储汽罐，顶上一只杠杆安全阀：长长的杠杆一头压着阀门、一头挂一只铁球；存满时杠杆被顶起、阀口喷汽。罐身左边一根外挂黄铜刻度尺，指针跟着存量上下走。最维多利亚。',
      draw(x, y, o) {
        R(x + 4, y + 45, 18, 3, P.iron[0]); R(x + 5, y + 45, 16, 1, P.iron[3]);
        bottle(x + 6, y + 8, 15, 38); for (const u of [10, 16]) for (let v = 16; v < 42; v += 3) px(x + u, y + v, P.iron[4]); band(x + 6, y + 20, 15);
        R(x + 1, y + 12, 3, 32, P.brass[0]); R(x + 2, y + 12, 1, 32, P.brass[2]); for (let v = 13; v < 44; v += 5) px(x + 3, y + v, P.brass[3]);
        const py = y + 42 - Math.round(o.lv * 28); R(x, py, 5, 2, P.fire[2]); px(x + 4, py, P.fire[3]);
        R(x + 12, y + 3, 4, 6, P.brass[1]); R(x + 12, y + 3, 4, 1, P.brass[3]);
        const up = o.lv > 0.92 ? 2 : 0; R(x + 9, y + 3, 2, 3, P.iron[1]);
        line(x + 9, y + 3, x + 22, y + 3 - up, 1, P.iron[3]); disc(x + 21, y + 5 - up, 2.4, P.iron[0]); disc(x + 21, y + 5 - up, 1.6, P.iron[2]); px(x + 20, y + 4 - up, P.iron[4]);
      },
      fx(x, y, o) { if (o.lv > 0.92) puff(x + 14, y + 2, o.t, 3, 7); } },
    { key: 'E', name: '伸缩储气柜', ref: '新：维多利亚城市的伸缩储气柜（格构导轨架 + 升降的钟罩）',
      idea: '四根格构立柱围成导轨架，中间一只铆接钟罩：存得越多，钟罩升得越高（罩顶的导轮沿立柱滚）；下半截坐在一只矮水槽里。存量就是钟罩的高度，一眼能从剪影上看出来。',
      draw(x, y, o) {
        for (const u of [1, 20]) { R(x + u, y + 4, 3, 40, P.iron[0]); R(x + u + 1, y + 4, 1, 40, P.iron[3]); }
        for (let v = 6; v < 40; v += 9) { line(x + 3, y + v, x + 20, y + v + 8, 1, P.iron[1]); line(x + 20, y + v, x + 3, y + v + 8, 1, P.iron[1]); }
        R(x + 1, y + 3, 22, 2, P.iron[0]); R(x + 1, y + 3, 22, 1, P.iron[3]);
        const top = y + 36 - Math.round(o.lv * 26);
        shape((xx, yy) => yy >= top + 2 || ((xx - x - 12) / 7.5) ** 2 + ((yy - top - 2) / 3) ** 2 <= 1, x + 4, top - 2, x + 20, y + 40, IRONL);
        for (let v = top + 5; v < y + 39; v += 4) for (let u = 6; u < 19; u += 3) px(x + u, v, P.iron[4]);
        R(x + 3, top + 3, 2, 2, P.brass[2]); R(x + 19, top + 3, 2, 2, P.brass[2]);
        box(x + 2, y + 38, 20, 10, IRON); R(x + 3, y + 39, 18, 1, P.iron[3]); for (const u of [5, 12, 18]) px(x + u, y + 42, P.iron[4]);
      } },
    { key: 'F', name: '双球储罐', ref: '新：工厂里一上一下叠着的铆接球罐（赤道箍 + 连通管 + 表盘）',
      idea: '两只铆接球罐一上一下叠着，每只一道黄铜赤道箍，右边一根连通管带一只截止阀；上球正面一只大表盘显示存量，下球坐在四条短腿的座圈上。圆滚滚的剪影，和方块车体最不一样。',
      draw(x, y, o) {
        for (const u of [4, 9, 15, 20]) R(x + u - 1, y + 40, 2, 8, P.iron[1]); R(x + 3, y + 41, 18, 2, P.iron[0]); R(x + 3, y + 41, 18, 1, P.iron[3]);
        ball(x + 12, y + 31, 9.5, IRONL); R(x + 2, y + 31, 20, 2, P.brass[1]); R(x + 2, y + 31, 20, 1, P.brass[3]);
        ball(x + 12, y + 11, 9.5, IRONL); R(x + 2, y + 11, 20, 2, P.brass[1]); R(x + 2, y + 11, 20, 1, P.brass[3]);
        R(x + 20, y + 13, 3, 16, P.iron[0]); R(x + 21, y + 13, 1, 16, P.iron[3]); R(x + 19, y + 19, 5, 3, P.brass[1]);
        gauge(x + 11, y + 10, 5, o.lv); disc(x + 11, y + 10, 0.9, P.brass[2]); px(x + 6, y + 5, P.iron[4]); px(x + 6, y + 25, P.iron[4]);
      },
      fx(x, y, o) { if (o.chg) puff(x + 12, y + 1, o.t, 2, 5); } },
  ];

  // ================= 测距仪 rangefinder（1×1 = 24×24，控制）：直射散布更小 =================
  const RANGE = [
    { key: 'A', name: '合像测距仪', ref: '（v1 候选 A 重画）一战的合像测距仪：两头带镜片的长横管',
      idea: '一根横贯整格的测距管（两道黄铜箍），两头各一块玻璃镜片，中间朝下一只目镜；架在车体上的铆接托座里。镜片时不时闪一下光。「一根横杆两头发亮」在 1× 下也认得出。',
      draw(x, y, o) {
        box(x + 7, y + 14, 10, 10, IRON); R(x + 8, y + 14, 8, 1, P.iron[3]); rivet(x + 9, y + 18); rivet(x + 13, y + 18);
        htube(x, y + 7, 24, 6, IRONL); band(x + 4, y + 7, 2, 6); band(x + 18, y + 7, 2, 6);
        R(x, y + 8, 2, 4, P.glass[1]); R(x + 22, y + 8, 2, 4, P.glass[1]); px(x, y + 8, P.glass[3]); px(x + 22, y + 8, P.glass[3]);
        R(x + 10, y + 12, 4, 3, P.brass[1]); R(x + 11, y + 12, 2, 3, P.dark[0]);
      },
      fx(x, y, o) { glint(x + 1, y + 9, o.t); glint(x + 23, y + 9, o.t + 30); } },
    { key: 'B', name: '刻度表盘', ref: '（v1 候选 B 重画）铁箱 + 大刻度盘 + 小镜筒',
      idea: '一只铆接铁箱，正面一只大刻度盘（一圈刻度、指针随瞄准来回找距离），左上角一支小镜筒。读起来更像「仪表」，靠镜筒和压力表区分。',
      draw(x, y, o) {
        box(x + 1, y + 6, 22, 18, IRONL); rivet(x + 3, y + 8); rivet(x + 19, y + 8); rivet(x + 3, y + 20); rivet(x + 19, y + 20);
        disc(x + 12, y + 15, 7, P.brass[0]); disc(x + 12, y + 15, 6, P.steam[2]);
        for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.8 + k * 0.14); px(x + 12 + Math.cos(a) * 5, y + 15 + Math.sin(a) * 5, k % 5 ? P.dark[2] : P.dark[0]); }
        const a = Math.PI * (1.1 + 0.5 * (0.5 + 0.5 * Math.sin(o.t * 0.05))); line(x + 12, y + 15, x + 12 + Math.cos(a) * 4.5, y + 15 + Math.sin(a) * 4.5, 1, P.fire[1]); px(x + 12, y + 15, P.dark[0]);
        htube(x + 2, y + 1, 12, 4, IRONL); R(x + 13, y + 1, 2, 4, P.glass[1]); R(x + 6, y + 4, 2, 3, P.iron[1]);
      },
      fx(x, y, o) { glint(x + 14, y + 2, o.t, 70); } },
    { key: 'C', name: '双筒测距镜', ref: '（v1 候选 C 重画）一对上下叠放的镜筒',
      idea: '一对上下叠放的镜筒架在转轴上（中间一块黄铜连接板），前端两块镜片；转轴托架贴在车体上。像双筒望远镜，友好好认。',
      draw(x, y, o) {
        box(x + 5, y + 17, 12, 7, IRON); R(x + 9, y + 12, 4, 6, P.iron[1]);
        htube(x + 2, y + 3, 19, 5, IRONL); htube(x + 2, y + 9, 19, 5, IRONL); R(x + 8, y + 5, 6, 7, P.brass[1]); R(x + 8, y + 5, 6, 1, P.brass[3]);
        for (const v of [4, 10]) { R(x + 20, y + v, 3, 3, P.glass[1]); px(x + 21, y + v, P.glass[3]); R(x, y + v, 2, 3, P.dark[1]); }
        disc(x + 11, y + 13, 1.6, P.brass[2]);
      },
      fx(x, y, o) { glint(x + 22, y + 4, o.t); glint(x + 22, y + 10, o.t + 8); } },
    { key: 'D', name: '双耳测距塔', ref: '新：战列舰炮塔顶上的测距仪「耳朵」——圆顶小塔 + 贯穿两侧伸出的长测距管',
      idea: '一只铆接圆顶小塔，一根长测距管从塔身里横穿过去、两头伸出来像一对耳朵，耳朵末端是带遮光罩的镜窗；塔正面一道观察缝。剪影是「圆顶 + 两只耳朵」，一眼认出。',
      draw(x, y, o) {
        box(x + 3, y + 16, 18, 8, IRON); R(x + 4, y + 16, 16, 1, P.iron[3]);
        shape((xx, yy) => ((xx - x - 12) / 8.5) ** 2 + ((yy - y - 16) / 9) ** 2 <= 1 && yy <= y + 16.5, x + 3, y + 6, x + 21, y + 17, IRONL);
        for (let k = 1; k < 6; k++) { const a = Math.PI * (1 + k / 6); px(x + 12 + Math.cos(a) * 7, y + 16 + Math.sin(a) * 7.5, P.iron[4]); }
        htube(x, y + 10, 24, 4, IRONL); for (const u of [0, 21]) { R(x + u, y + 8, 3, 8, P.iron[0]); R(x + u + (u ? 0 : 2), y + 10, 1, 4, P.glass[1]); }
        R(x + 8, y + 15, 8, 1, P.dark[0]);
      },
      fx(x, y, o) { glint(x + 2, y + 11, o.t, 80); glint(x + 21, y + 11, o.t + 40, 80); } },
    { key: 'E', name: '经纬仪', ref: '新：测量用的经纬仪（U 形支架 + 竖直刻度圈 + 横穿的望远镜 + 调平螺钉）',
      idea: '一只带三颗调平螺钉的底盘上立着 U 形支架，中间一只黄铜竖直刻度圈（一圈刻度），一支小望远镜从圈心横穿过去、慢慢上下点头找目标；底盘上一只水准泡。最「精密仪器」。',
      draw(x, y, o) {
        box(x + 3, y + 19, 18, 5, IRON); for (const u of [5, 12, 19]) { R(x + u - 1, y + 22, 2, 2, P.brass[1]); }
        R(x + 9, y + 20, 6, 2, P.glass[1]); px(x + 11 + Math.round(Math.sin(o.t * 0.05)), y + 20, P.white);
        for (const u of [5, 17]) { R(x + u, y + 7, 2, 12, P.iron[0]); R(x + u, y + 7, 1, 12, P.iron[3]); }
        disc(x + 12, y + 11, 6.5, P.brass[0]); disc(x + 12, y + 11, 5.5, P.brass[2]); disc(x + 12, y + 11, 3.8, P.brass[1]);
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; px(x + 12 + Math.cos(a) * 5.2, y + 11 + Math.sin(a) * 5.2, P.brass[0]); }
        const a = Math.sin(o.t * 0.04) * 0.25, dx = Math.cos(a), dy = -Math.sin(a);
        line(x + 12 - dx * 9, y + 11 - dy * 9, x + 12 + dx * 9, y + 11 + dy * 9, 3, P.iron[0]); line(x + 12 - dx * 9, y + 11 - dy * 9, x + 12 + dx * 9, y + 11 + dy * 9, 1, P.iron[3]);
        px(x + 12 + dx * 9, y + 11 + dy * 9, P.glass[2]); disc(x + 12, y + 11, 1.2, P.brass[3]);
      } },
    { key: 'F', name: '六分仪', ref: '新：航海六分仪放大装在车上（扇形刻度弧 + 指标臂 + 小望远镜 + 反射镜）',
      idea: '一只黄铜扇形框：底边一道弧形刻度尺，顶点一面小反射镜，一根指标臂从顶点垂下来沿刻度弧慢慢扫；顶上横着一支小望远镜。扇形剪影在方块车里最特别。',
      draw(x, y, o) {
        box(x + 3, y + 19, 18, 5, IRON);
        const A0 = Math.PI * 0.32, A1 = Math.PI * 0.68, C = [x + 12, y + 3], r = 15;
        for (const a of [A0, A1]) line(C[0], C[1], C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, 2, P.brass[1]);
        for (let k = 0; k <= 24; k++) { const a = A0 + (A1 - A0) * k / 24; px(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, P.brass[2]); px(C[0] + Math.cos(a) * (r - 1), C[1] + Math.sin(a) * (r - 1), P.brass[0]); if (k % 4 === 0) px(C[0] + Math.cos(a) * (r - 2), C[1] + Math.sin(a) * (r - 2), P.dark[0]); }
        const ai = A0 + (A1 - A0) * (0.5 + 0.4 * Math.sin(o.t * 0.04)); line(C[0], C[1], C[0] + Math.cos(ai) * (r + 1), C[1] + Math.sin(ai) * (r + 1), 1, P.iron[4]);
        R(x + 12, y + 18, 2, 2, P.iron[1]);
        htube(x + 4, y + 1, 15, 3, IRONL); R(x + 18, y + 1, 2, 3, P.glass[1]); R(x + 11, y + 3, 3, 3, P.glass[2]); disc(C[0], C[1] + 1, 1.2, P.brass[3]);
      },
      fx(x, y, o) { glint(x + 12, y + 4, o.t, 50); } },
  ];

  // ================= 陀螺仪 gyroscope（1×1，控制）：车身晃动更小；和双足胯里的黄铜陀螺仪同一语言，转子一直在转 =================
  const GYRO = [
    { key: 'A', name: '万向环', ref: '（v1 候选 A 重画）',
      idea: '两根短立柱夹着一只黄铜外环，里面的内环不停翻转（宽窄变化表示在转），中心是转子；底座贴车体。剪影是一个圆环，在方块堆里最显眼。',
      draw(x, y, o) {
        box(x + 3, y + 19, 18, 5, IRON);
        for (const u of [2, 20]) { R(x + u, y + 9, 2, 11, P.iron[0]); R(x + u, y + 9, 1, 11, P.iron[3]); }
        ellRing(x + 12, y + 11, 8.5, 8.5, P.brass[1], P.brass[0]); ellRing(x + 12, y + 11, 7.8, 7.8, P.brass[2]);
        const w = Math.abs(Math.cos(o.t * 0.08)) * 6 + 0.6; ellRing(x + 12, y + 11, w, 6, P.brass[3], P.brass[0]);
        disc(x + 12, y + 11, 2.6, P.iron[2]); const s = o.t * 0.4; line(x + 12 - Math.cos(s) * 2.4, y + 11 - Math.sin(s) * 2.4, x + 12 + Math.cos(s) * 2.4, y + 11 + Math.sin(s) * 2.4, 1, P.iron[4]);
        R(x + 3, y + 10, 2, 2, P.brass[2]); R(x + 19, y + 10, 2, 2, P.brass[2]);
      } },
    { key: 'B', name: '陀螺舱窗', ref: '（v1 候选 B 重画）和双足胯上的陀螺窗同一语言',
      idea: '一只铆接铁箱，正面一扇圆玻璃窗，窗里是侧看成扁椭圆的黄铜转子，一道高光带一直从左扫到右（高速旋转）。',
      draw(x, y, o) {
        box(x + 1, y + 2, 22, 22, IRONL); rivet(x + 3, y + 4); rivet(x + 19, y + 4); rivet(x + 3, y + 20); rivet(x + 19, y + 20);
        disc(x + 12, y + 13, 8, P.brass[0]); disc(x + 12, y + 13, 7, P.glass[0]);
        shape((xx, yy) => ((xx - x - 12) / 6) ** 2 + ((yy - y - 13) / 2.4) ** 2 <= 1, x + 5, y + 10, x + 19, y + 16, BRASS);
        const p = saw(o.t * 3, 100), hx = x + 7 + p * 10; R(hx, y + 11, 1, 5, P.brass[3]); R(hx + 4 > x + 17 ? hx - 6 : hx + 4, y + 11, 1, 5, P.brass[2]);
        R(x + 11, y + 6, 2, 14, P.iron[3]); px(x + 8, y + 8, P.glass[3]);
      } },
    { key: 'C', name: '飞轮笼', ref: '（v1 候选 C 重画）',
      idea: '上下两块黄铜轴承板、四根笼条，中间一只侧看成扁椭圆的重飞轮绕竖轴转（轮缘上的刻痕一直在移），竖轴贯穿上下。更「重工业」，强调「稳」。',
      draw(x, y, o) {
        R(x + 2, y + 21, 20, 3, P.iron[0]); R(x + 2, y + 21, 20, 1, P.iron[3]);
        band(x + 3, y + 2, 18, 3); band(x + 3, y + 18, 18, 3);
        for (const u of [3, 20]) R(x + u, y + 5, 1, 13, P.iron[3]);
        R(x + 11, y + 2, 2, 19, P.iron[4]); R(x + 12, y + 2, 1, 19, P.iron[2]);
        shape((xx, yy) => ((xx - x - 12) / 8) ** 2 + ((yy - y - 12) / 3.4) ** 2 <= 1, x + 3, y + 8, x + 21, y + 16, IRONL);
        for (let k = 0; k < 4; k++) { const a = o.t * 0.25 + k * Math.PI / 2, cx = Math.cos(a); if (Math.sin(a) > 0) R(x + 12 + cx * 7, y + 13, 1, 2, P.iron[0]); }
      } },
    { key: 'D', name: '陀螺罗经', ref: '新：安许茨陀螺罗经（万向环吊着的黄铜碗 + 转子壳 + 罗经盘）',
      idea: '两根支柱挑着一只外环，外环里吊着一只黄铜半球碗（随车身晃动轻轻摆），碗口一面罗经盘在转（盘上一个红色北针点），碗底伸出转子壳。像船上的罗经台，一看就是「稳定 / 定向」。',
      draw(x, y, o) {
        box(x + 3, y + 20, 18, 4, IRON);
        for (const u of [2, 20]) { R(x + u, y + 4, 2, 17, P.iron[0]); R(x + u, y + 4, 1, 17, P.iron[3]); }
        R(x + 3, y + 7, 18, 2, P.brass[1]); R(x + 3, y + 7, 18, 1, P.brass[3]);
        const sw = Math.round(Math.sin(o.t * 0.05) * 1.5);
        shape((xx, yy) => ((xx - x - 12 - sw) / 7) ** 2 + ((yy - y - 9) / 8) ** 2 <= 1 && yy >= y + 9, x + 4, y + 8, x + 20, y + 18, BRASS);
        R(x + 10 + sw, y + 17, 4, 3, P.iron[1]);
        shape((xx, yy) => ((xx - x - 12 - sw) / 6.5) ** 2 + ((yy - y - 9) / 1.8) ** 2 <= 1, x + 4, y + 7, x + 20, y + 11, [P.dark[0], P.steam[1], P.steam[2], P.white]);
        const a = o.t * 0.08; px(x + 12 + sw + Math.cos(a) * 5, y + 9 + Math.sin(a) * 1.3, P.fire[1]);
      } },
    { key: 'E', name: '双转子对转', ref: '新：两只对着转的陀螺转子（齿轮咬合，互相抵消晃动）',
      idea: '一块铆接背板上并排两只转子，轮缘上的齿互相咬着、一只顺转一只逆转，中间一只小轴承；背板底下一只驱动小蒸汽缸。「两个对着转的稳定器」，动起来最热闹。',
      draw(x, y, o) {
        box(x + 1, y + 3, 22, 21, IRON); rivet(x + 3, y + 5); rivet(x + 19, y + 5);
        gear(x + 7, y + 12, 5.2, 10, o.t * 0.2); gear(x + 17, y + 12, 5.2, 10, -o.t * 0.2 + 0.31);
        for (const [cx, s] of [[7, 1], [17, -1]]) { const a = s * o.t * 0.2; line(x + cx, y + 12, x + cx + Math.cos(a) * 3, y + 12 + Math.sin(a) * 3, 1, P.brass[3]); }
        htube(x + 5, y + 19, 14, 4, IRONL); R(x + 11, y + 18, 2, 2, P.brass[2]);
      } },
    { key: 'F', name: '船用减摇陀螺', ref: '新：施利克的船用减摇陀螺（沉重的转子筒 + 横向耳轴，整只筒前后摇摆）',
      idea: '一副 A 形支架托着一只又粗又重的转子筒（上下圆盖、一圈铆钉），筒绕横向耳轴前后慢慢摇（进动），底下一只刹车油缸跟着伸缩。最重、最有「压住晃动」的分量感。',
      draw(x, y, o) {
        box(x + 2, y + 20, 20, 4, IRON);
        for (const [a, b] of [[3, 12], [21, 12]]) { line(x + a, y + 20, x + b, y + 12, 2, P.iron[1]); }
        const th = Math.sin(o.t * 0.04) * 0.22, c = Math.cos(th), s = Math.sin(th), C = [x + 12, y + 11];
        const inside = (xx, yy) => { const dx = xx - C[0], dy = yy - C[1], u = dx * c + dy * s, v = -dx * s + dy * c; return Math.abs(u) <= 8 && Math.abs(v) <= 7 - (Math.abs(u) > 6.5 ? (Math.abs(u) - 6.5) * 2 : 0); };
        shape(inside, x + 3, y + 1, x + 21, y + 21, IRONL);
        for (const v of [-5, 5]) { const px0 = C[0] - s * v, py0 = C[1] + c * v; line(px0 - c * 7, py0 - s * 7, px0 + c * 7, py0 + s * 7, 2, P.brass[1]); line(px0 - c * 7, py0 - s * 7, px0 + c * 7, py0 + s * 7, 1, P.brass[3]); }
        for (let k = -2; k <= 2; k++) { const u = k * 3; px(C[0] + c * u + s * 2.5, C[1] + s * u - c * 2.5 + 5, P.iron[4]); }
        disc(C[0], C[1], 1.8, P.brass[1]); px(C[0], C[1], P.brass[3]);
        const ey = y + 16 + s * 6; R(x + 17, ey, 3, y + 20 - ey, P.brass[1]); R(x + 16, y + 17, 5, 3, P.iron[1]);
      } },
  ];

  // ================= 散热片 radiator（1×2 侧挂 = 24×48，冷却）：左边铆接支架挂在车体外；镂空要真的透；青色只在集管上 =================
  // o.heat 0～1：车越热，冷却液流得越快（集管上的亮点），百叶窗开得越大
  const RAD = [
    { key: 'A', name: '横格栅', ref: '（v1 候选 A 重画）汽车散热器式',
      idea: '一片铁框里排满横向散热片，片与片之间是空的（透出后面的车体）；上下两根青色集管，冷却液的亮点在里面流；左边两只铆接支架挂在车体上。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36);
        R(x + 4, y + 2, 20, 2, P.iron[0]); R(x + 4, y + 44, 20, 2, P.iron[0]); R(x + 4, y + 2, 2, 44, P.iron[0]); R(x + 22, y + 2, 2, 44, P.iron[0]); R(x + 5, y + 2, 1, 44, P.iron[3]);
        cyanPipe(x + 6, y + 4, 16, o.t * (1 + o.heat * 2)); cyanPipe(x + 6, y + 40, 16, o.t * (1 + o.heat * 2) + 30);
        for (let v = 10; v < 39; v += 3) { R(x + 6, y + v, 16, 1, P.iron[3]); px(x + 6, y + v, P.iron[1]); }
      } },
    { key: 'B', name: '翅片管排', ref: '（v1 候选 B 重画）蒸汽机车上的散热管排',
      idea: '三根竖直的冷却管，每根套着一圈圈短翅片，管与管之间镂空；上下两根青色集管把三根管接起来；左边铆接支架。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36); R(x + 4, y + 6, 2, 36, P.iron[0]); R(x + 5, y + 6, 1, 36, P.iron[3]);
        cyanPipe(x + 5, y + 3, 19, o.t * (1 + o.heat * 2)); cyanPipe(x + 5, y + 41, 19, o.t * (1 + o.heat * 2) + 30);
        for (const u of [8, 14, 20]) { R(x + u, y + 7, 2, 34, P.iron[2]); R(x + u, y + 7, 1, 34, P.iron[4]); for (let v = 9; v < 40; v += 2) { R(x + u - 2, y + v, 6, 1, P.iron[3]); px(x + u + 3, y + v, P.iron[1]); } }
      } },
    { key: 'C', name: '蜂窝芯', ref: '（v1 候选 C 重画）孔改大，1× 下不再糊成灰面',
      idea: '铁框里是一整块蜂窝散热芯：一格一格 3×3 的孔都是透的（能看见后面的车体），孔壁是细铁条；右上角一只温度表，上下青色集管。最「精密」。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36);
        box(x + 4, y + 2, 20, 44, IRON);
        cyanPipe(x + 6, y + 4, 16, o.t * (1 + o.heat * 2)); cyanPipe(x + 6, y + 40, 16, o.t * (1 + o.heat * 2) + 30);
        g.clearRect(x + 6, y + 9, 16, 30);
        for (let v = 9; v <= 39; v += 4) R(x + 6, y + v, 16, 1, P.iron[3]);
        for (let r = 0; r < 8; r++) for (let u = (r % 2) * 2 + 6; u <= 22; u += 4) R(x + u, y + 9 + r * 4, 1, 4, P.iron[2]);
        disc(x + 20, y + 9, 2.8, P.brass[0]); disc(x + 20, y + 9, 2, P.steam[2]); line(x + 20, y + 9, x + 20 - 1.5 + o.heat * 3, y + 7.5, 1, P.fire[1]);
      } },
    { key: 'D', name: '蛇形管排', ref: '新：一根来回折返的蛇形冷却管（U 形弯头）挂在一根竖脊梁上',
      idea: '一根冷却管在格子里来回折返七八次（每个折返是一个 U 形弯头），管子之间全是空的；左边一根竖脊梁用卡箍把每一道管卡住，脊梁再用支架挂到车体上；青色只在上面的进口和下面的出口。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36); R(x + 4, y + 3, 3, 42, P.iron[0]); R(x + 5, y + 3, 1, 42, P.iron[3]);
        const runs = 8;
        for (let k = 0; k < runs; k++) {
          const v = y + 6 + k * 5; R(x + 7, v, 15, 3, P.iron[1]); R(x + 7, v, 15, 1, P.iron[4]);
          if (k < runs - 1) { const ex = k % 2 ? x + 7 : x + 21; R(ex, v, 3, 8, P.iron[1]); R(ex + (k % 2 ? 0 : 2), v + 1, 1, 6, P.iron[4]); }
          R(x + 6, v - 1, 3, 5, P.brass[1]);
        }
        R(x + 7, y + 2, 4, 5, P.water[1]); R(x + 7, y + 2, 4, 1, P.water[2]); R(x + 7, y + 43, 4, 4, P.water[1]); R(x + 7, y + 43, 4, 1, P.water[2]);
        if (saw(o.t * (1 + o.heat * 2), 30) < 0.3) px(x + 8, y + 3, P.water[3]);
      } },
    { key: 'E', name: '百叶窗散热器', ref: '新：机车 / 飞艇发动机的百叶窗（温控，越热开得越大）',
      idea: '一只铁框里横着九片百叶，右边一根联动杆把它们串起来，底下一只小恒温缸推着联动杆：车冷时百叶关成一整面（不透），车越热百叶转得越平、缝越大（透出后面的车体）。温度就是百叶开合，一眼能看出来。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36);
        R(x + 4, y + 2, 20, 2, P.iron[0]); R(x + 4, y + 44, 20, 2, P.iron[0]); R(x + 4, y + 2, 2, 44, P.iron[0]); R(x + 22, y + 2, 2, 44, P.iron[0]); R(x + 5, y + 2, 1, 44, P.iron[3]);
        cyanPipe(x + 6, y + 4, 16, o.t * (1 + o.heat * 2));
        const hgt = Math.max(1, Math.round(1 + (1 - o.heat) * 3.4));
        for (let k = 0; k < 8; k++) { const v = y + 9 + k * 4.25; R(x + 6, v, 15, hgt, P.iron[2]); R(x + 6, v, 15, 1, P.iron[4]); if (hgt > 1) R(x + 6, v + hgt - 1, 15, 1, P.iron[1]); px(x + 21, v, P.brass[2]); }
        const lift = Math.round(o.heat * 3); R(x + 20, y + 8 - lift, 2, 34, P.brass[0]); R(x + 20, y + 8 - lift, 1, 34, P.brass[2]);
        box(x + 16, y + 40, 6, 4, IRONL);
      } },
    { key: 'F', name: '鳍柱', ref: '新：摩托车缸头式的一叠大散热鳍（中间一根冷却管柱）',
      idea: '中间一根竖直的冷却管柱，套着一叠又宽又薄的横散热鳍（像一摞薄钢盘），鳍与鳍之间全是空的；两根拉杆把整叠鳍夹紧；上下管口是青色的。剪影是一排横条纹的柱子，和格栅框不一样。',
      draw(x, y, o) {
        bracket(x, y + 8); bracket(x, y + 36); R(x + 4, y + 9, 10, 2, P.iron[1]); R(x + 4, y + 37, 10, 2, P.iron[1]);
        R(x + 13, y + 1, 4, 5, P.water[1]); R(x + 13, y + 1, 4, 1, P.water[2]); R(x + 13, y + 43, 4, 4, P.water[1]); R(x + 13, y + 43, 4, 1, P.water[2]);
        for (let v = 6; v < 43; v += 3) { R(x + 6, y + v, 18, 1, P.iron[3]); px(x + 6, y + v, P.iron[1]); px(x + 23, y + v, P.iron[1]); }
        R(x + 13, y + 5, 4, 38, P.iron[1]); R(x + 13, y + 5, 1, 38, P.iron[4]);
        for (const u of [7, 22]) R(x + u, y + 5, 1, 38, P.iron[0]);
        if (saw(o.t * (1 + o.heat * 2), 30) < 0.3) px(x + 14, y + 2, P.water[3]);
      } },
  ];

  const MODS = [
    { id: 'pressure_tank', name: '蓄压罐', w: 1, h: 2, tiers: [1, 2, 3, 4, 5, 6], SET: PTANK,
      rule: '1×2 · 第四章 · 能源：动力富余时存蒸汽，不够时往外补 · 存量要看得见（页面上存量来回变：涨的时候阀口冒汽）· 用「动力」语义（压力表 + 蒸汽白），没有青色（和水罐分开）',
      state: (t) => ({ t, lv: 0.5 + 0.5 * Math.sin(t * 0.03), chg: Math.cos(t * 0.03) > 0 }),
      poses: [{ lv: 1, label: '满' }, { lv: 0.6, label: '六成' }, { lv: 0.25, label: '两成半' }, { lv: 0, label: '空' }] },
    { id: 'rangefinder', name: '测距仪', w: 1, h: 1, tiers: [1, 2, 3, 4, 5, 6], SET: RANGE,
      rule: '1×1 · 第四章 · 控制：直射武器散布更小 · 要一眼认出是「光学测距」，和观察镜（轭架望远镜）、压力表区分开 · 镜片偶尔闪光',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 25, label: '' }, { t: 50, label: '' }, { t: 75, label: '' }] },
    { id: 'gyroscope', name: '陀螺仪', w: 1, h: 1, tiers: [1, 2, 3, 4, 5, 6], SET: GYRO,
      rule: '1×1 · 第四章 · 控制：全车晃动更小 · 和双足胯里的黄铜陀螺仪同一语言（黄铜环 + 转子），转子一直在转',
      state: (t) => ({ t }), poses: [{ t: 0, label: '' }, { t: 7, label: '' }, { t: 14, label: '' }, { t: 21, label: '' }] },
    { id: 'radiator', name: '散热片（侧挂）', w: 1, h: 2, side: true, tiers: [1, 2, 3, 4, 5, 6], SET: RAD,
      rule: '1×2 侧挂层 · 第四章 · 冷却：不储水，提高持续散热 · 左边铆接支架挂在车体外，镂空要真的透出后面的车体（右边「装在车上」那张能看出来）· 青色只在进出水的集管上 · 页面上车温来回变：越热冷却液流得越快，百叶窗开得越大',
      state: (t) => ({ t, heat: 0.5 + 0.5 * Math.sin(t * 0.02) }), poses: [{ heat: 0, label: '冷' }, { heat: 0.5, label: '温' }, { heat: 1, label: '热' }, { heat: 1, t: 30, label: '热（换一帧）' }] },
  ];
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  function over(ctx, x, y, e, o = {}, m) { g = ctx; if (e.fx) e.fx(x, y, o); else if (m && m.fx) m.fx(x, y, o); }
  return { MODS, figure, over, LINEUP: [] };
})();
