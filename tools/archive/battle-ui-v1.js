// 「当前开发」页：战斗界面 v1 · 三套方案（2026-09-30）。
// 用户：白旗会被效果和背景人物挡住；不想要敌方的各种实时状态；重新设计战斗页面的提示和各类展示，挑一套满意的。
// 每套方案画三种时刻（常态 / 告急 / 对方挂白旗），场景、车、人物都读游戏代码，界面件用 js/ui-px.js 的像素画法（2 倍）。
// 战场按镜头 z = 1 画（1280 × 720 世界像素，和游戏镜头拉远时一样），界面像素 = 2 屏幕像素。
window.SA = window.SA || {};

SA.BATTLEUI = (() => {
  const P = SA.PAL, X = SA.PX, K = SA.K, C = K.CELL, PADX = SA.SPR.PADX;
  const W = 1280, H = 720, GROUND = 648, CAMY = GROUND + 60 - H;   // 镜头左上角的世界 y
  const VW = K.COLS * C + PADX * 2, VH = K.ROWS * C;
  const INK = '#2a1a05', CHALK = '#e8e3d2', LIGHT = '#e4e0d6', SHADOW = '#0b0e15';

  // ---------- 小工具 ----------
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const px = (g, src, x, y, s = 2) => { g.imageSmoothingEnabled = false; g.drawImage(src, Math.round(x), Math.round(y), src.width * s, src.height * s); };
  function T(g, str, x, y, o = {}) {
    g.font = o.font || `bold ${o.size || 14}px SimSun, serif`;
    g.textAlign = o.align || 'left'; g.textBaseline = 'middle';
    if (o.sh !== false) { g.fillStyle = o.shc || SHADOW; g.fillText(str, x + 2, y + 2); }
    g.fillStyle = o.col || LIGHT; g.fillText(str, x, y);
    return g.measureText(str).width;
  }
  // 九宫格：用 ui-px 生成的皮肤图（和游戏里的框一模一样），按 2 倍贴
  const SK = {};
  async function loadSkins() {
    X.init();
    for (const [n, v] of Object.entries(X.SKIN)) { const im = new Image(); im.src = v.url; await im.decode(); SK[n] = { im, c: v.c }; }
  }
  function nine(g, name, x, y, w, h, s = 2) {
    const { im, c } = SK[name], IW = im.width, IH = im.height, cs = c * s;
    const sx = [0, c, IW - c, IW], sy = [0, c, IH - c, IH], dx = [x, x + cs, x + w - cs, x + w], dy = [y, y + cs, y + h - cs, y + h];
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.drawImage(im, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j], dx[i], dy[j], dx[i + 1] - dx[i], dy[j + 1] - dy[j]);
  }
  // 5×7 数字放大，带一圈黑描边（读数）
  function bigNum(g, str, x, y, col, s = 3, align = 'left') {
    const src = X.num(str, col), w = src.width * s;
    const x0 = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    g.imageSmoothingEnabled = false;
    const sil = cv(src.width, src.height), sg = sil.getContext('2d'); sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = SHADOW; sg.fillRect(0, 0, sil.width, sil.height);
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [1, 2], [0, 2]]) g.drawImage(sil, x0 + dx * s, y + dy * s, w, src.height * s);
    g.drawImage(src, x0, y, w, src.height * s);
    return w;
  }

  // ---------- 像素件（1 倍美术像素，画的时候 ×2）----------
  // 压力表：黄铜外圈 + 纸表盘 + 刻度 + 红区 + 指针
  function dial(R, pct, red = 0.8, hot = false) {
    const D = R * 2 + 2, k = X.C(D, D), c = R + 0.5;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > R + 0.4) continue;
      const a = Math.atan2(x + 0.5 - c, -(y + 0.5 - c)) / Math.PI * 180, f = (a + 135) / 270;
      if (d > R - 1) k.p(x, y, hot ? P.fire[0] : P.brass[0]);
      else if (d > R - 3) k.p(x, y, hot ? (x + y < D ? P.fire[2] : P.fire[1]) : (x + y < D ? P.brass[3] : P.brass[1]));
      else if (d > R - 4) k.p(x, y, P.brass[0]);
      else if (d > R - 7 && d <= R - 5 && f >= red && f <= 1 && Math.abs(a) <= 135) k.p(x, y, P.fire[1]);
      else k.p(x, y, d < R - 9 ? X.RAMP.paper.l : X.RAMP.paper.b);
    }
    for (let i = 0; i <= 8; i++) { const a = (-135 + 270 * i / 8) * Math.PI / 180; k.p(Math.round(c - 0.5 + Math.sin(a) * (R - 5.5)), Math.round(c - 0.5 - Math.cos(a) * (R - 5.5)), INK); }
    const a = (-135 + 270 * Math.min(1.04, pct)) * Math.PI / 180;
    X.line(k, Math.round(c - 0.5), Math.round(c - 0.5), Math.round(c - 0.5 + Math.sin(a) * (R - 6)), Math.round(c - 0.5 - Math.cos(a) * (R - 6)), pct >= red ? P.fire[1] : INK);
    k.r(Math.round(c) - 2, Math.round(c) - 2, 3, 3, P.brass[1]); k.p(Math.round(c) - 2, Math.round(c) - 2, P.brass[3]);
    return k.c;
  }
  // 竖液位管：上下黄铜盖 + 玻璃 + 液面；ramp 四阶
  function tube(h, pct, ramp, warn = false) {
    const k = X.C(9, h);
    X.box(k, 0, 0, 9, 3, X.RAMP.brass); X.box(k, 0, h - 3, 9, 3, X.RAMP.brass);
    k.r(1, 3, 7, h - 6, warn ? P.fire[1] : P.dark[0]); k.r(2, 3, 5, h - 6, P.dark[1]);
    const lv = Math.round((h - 6) * Math.max(0, Math.min(1, pct)));
    for (let y = 0; y < lv; y++) { const yy = h - 4 - y; k.r(2, yy, 5, 1, ramp[2]); k.p(2, yy, ramp[3]); k.p(6, yy, ramp[1]); }
    if (lv) k.r(2, h - 3 - lv, 5, 1, ramp[3]);
    k.r(3, 4, 1, h - 8, 'rgba(255,255,255,0.18)');
    return k.c;
  }
  // 指示灯：黄铜圈 + 玻璃（亮 / 暗）
  function lamp(on, col) {
    const k = X.C(11, 11);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const d = Math.hypot(x - 5, y - 5);
      if (d > 5.4) continue;
      if (d > 4.3) k.p(x, y, P.brass[0]);
      else if (d > 3.3) k.p(x, y, x + y < 9 ? P.brass[3] : P.brass[1]);
      else k.p(x, y, on ? (d < 1.6 ? '#fff4d8' : col) : (x + y < 9 ? P.dark[2] : P.dark[1]));
    }
    if (!on) k.p(4, 4, P.dark[3]);
    return k.c;
  }
  // 计时鼓：铁框 + 纸字轮
  function drum(str) {
    const N = str.length, w = 6 + N * 8, k = X.C(w, 15);
    X.box(k, 0, 0, w, 15, X.RAMP.iron);
    X.box(k, 2, 2, N * 8 + 1, 11, { o: P.dark[0], b: P.dark[0], l: P.dark[0], d: P.dark[0] });
    [...str].forEach((ch, i) => {
      const x = 3 + i * 8, PR = X.RAMP.paper;
      for (let y = 3; y < 12; y++) k.r(x, y, 7, 1, y === 3 || y === 11 ? PR.d : y === 4 || y === 10 ? PR.a : PR.l);
      k.g.drawImage(X.num(ch, X.INK), x + 1, 4);
    });
    return k.c;
  }
  // 武器键：黄铜（选中按下去）/ 铁（没选）/ 暗（打不了）；数字 + 装填条
  function key(n, sel, reload, off) {
    const k = X.C(30, 22), R = off ? X.RAMP.flat : sel ? X.RAMP.brass : X.RAMP.iron;
    X.box(k, 0, sel ? 1 : 0, 30, 21, R, sel);
    k.g.drawImage(X.num(String(n), off ? P.dark[3] : sel ? INK : LIGHT), 3, sel ? 4 : 3);
    X.box(k, 3, 15 + (sel ? 1 : 0), 24, 4, { o: P.dark[0], b: P.dark[1], l: P.dark[1], d: P.dark[0] }, true);
    const f = Math.round(22 * (reload == null ? 1 : reload));
    if (!off && f > 0) k.r(4, 16 + (sel ? 1 : 0), f, 2, reload == null || reload >= 1 ? P.gauge[2] : P.brass[2]);
    return k.c;
  }
  // 九块装甲片一排：耐久（还在的亮、打掉的暗）
  function plates(n, of) {
    const k = X.C(of * 6 + 1, 9);
    for (let i = 0; i < of; i++) { const on = i < n; X.box(k, i * 6, 0, 7, 9, on ? X.RAMP.brass : { o: P.dark[0], b: P.dark[1], l: P.dark[2], d: P.dark[0] }); if (on) k.p(i * 6 + 2, 2, P.brass[3]); }
    return k.c;
  }
  const GEAR_RET = X.gear(11, 8, X.RAMP.brass, 0.15);
  const GEAR_RED = X.gear(11, 8, X.RAMP.fire, 0.15);

  // ---------- 场景：铁匠铺后院 + 两辆车 ----------
  const OP = SA.OPPONENTS;
  const veh = (i) => SA.V.fromAscii(OP[i].name, OP[i].rows, OP[i].sides, 2);
  const ME = { v: veh(0), x: W / 2 - 200 - PADX - K.COLS * C, name: '锈钉子号', pilot: '你' };
  const FOE = { v: veh(2), x: W / 2 + 200 - PADX, name: OP[2].name, pilot: OP[2].pilot };
  const sprite = (v, k) => SA.SPR.renderVehicle(v, { key: k, t: 1.2, heat: 0.5, water: 0.7 });
  // 车画布里最上面一行实心像素：白旗插在这里（敌方镜像后的屏幕 x）
  function topOf(src, flip, x0) {
    const d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data;
    for (let y = 0; y < src.height; y++) {
      let sx = 0, n = 0;
      for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 8) { sx += x; n++; }
      if (n > 6) { const cx = sx / n; return { x: x0 + (flip ? src.width - cx : cx), y: y + GROUND - CAMY - VH }; }
    }
    return { x: x0 + src.width / 2, y: 300 };
  }
  let BASE = null;
  function world() {
    if (BASE) return BASE;
    const c = cv(W, H), g = c.getContext('2d');
    SA.Scenes.back('forge', g, W, H, CAMY, 0, 3, { mode: 'campaign', storyKey: '0,1' });
    g.save(); g.translate(0, -CAMY); SA.Scenes.floor('forge', g, { x: 0, y: CAMY, w: W, h: H }); g.restore();
    const ps = sprite(ME.v, 'bu-me'), es = sprite(FOE.v, 'bu-foe'), y = GROUND - CAMY - VH;
    g.imageSmoothingEnabled = false;
    g.drawImage(ps, ME.x, y);
    g.save(); g.translate(FOE.x + VW, y); g.scale(-1, 1); g.drawImage(es, 0, 0); g.restore();
    const front = cv(W, H); SA.Scenes.front('forge', front.getContext('2d'), W, H, CAMY, 0, 3);
    BASE = { c, front, es, meTop: topOf(ps, false, ME.x), foeTop: topOf(es, true, FOE.x), y };
    return BASE;
  }
  // 战场上的东西：弹道扇区、准星、伤害数字、对方车上的烟火
  function fx(g, st, o = {}) {
    const B0 = world(), mx = B0.meTop.x + 60, my = B0.meTop.y + 52, ax = FOE.x + 150, ay = B0.y + 190;
    if (st !== 'flag') {
      g.save(); g.globalAlpha = 0.16; g.fillStyle = P.white; g.beginPath();
      g.moveTo(mx, my); g.lineTo(ax + 40, ay - 52); g.lineTo(ax + 40, ay + 46); g.closePath(); g.fill(); g.restore();
      for (let i = 0; i < 9; i++) { const t = i / 9, x = mx + (ax - mx) * t, y = my + (ay - my) * t + Math.sin(t * Math.PI) * -8; g.fillStyle = P.black; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4); g.fillStyle = P.white; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
    }
    // 对方车上的烟和火星（白旗被挡的元凶之一）
    const smoke = [[FOE.x + 120, B0.foeTop.y + 10, 16], [FOE.x + 150, B0.foeTop.y - 14, 22], [FOE.x + 108, B0.foeTop.y - 40, 26], [FOE.x + 170, B0.foeTop.y + 40, 14]];
    g.save(); g.globalAlpha = st === 'flag' ? 0.25 : 0.75;
    for (const [x, y, s] of smoke) { g.fillStyle = P.iron[1]; g.fillRect(x - s / 2, y - s / 2, s, s); g.fillStyle = P.dark[3]; g.fillRect(x - s / 2 + 3, y - s / 2 + 3, s - 8, s - 8); }
    g.restore();
    if (st !== 'flag') {
      bigNum(g, '32', FOE.x + 250, B0.y + 150, '#ffa133', 4, 'center');
      bigNum(g, '9×3', FOE.x + 180, B0.y + 104, P.white, 3, 'center');
      px(g, o.red ? GEAR_RED : GEAR_RET, ax - 23, ay - 23);
      g.fillStyle = P.black; g.fillRect(ax - 3, ay - 3, 6, 6); g.fillStyle = P.white; g.fillRect(ax - 2, ay - 2, 4, 4);
    }
  }
  // 白旗：画在最上层（压过近景、烟火、界面），旗杆 + 黄铜杆头 + 飘动的旗；周围压暗，只留对方车和旗亮着
  function flag(g) {
    const B0 = world(), x = Math.round(B0.foeTop.x), y0 = Math.round(B0.foeTop.y) + 2, len = 70, top = y0 - len;
    // 压暗：整屏一层暗色（烟火、背景人物、界面都压下去），再把对方的车原样画回来——只有它和旗是亮的
    g.fillStyle = 'rgba(8,8,14,0.62)'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.save(); g.imageSmoothingEnabled = false; g.translate(FOE.x + VW, B0.y); g.scale(-1, 1); g.drawImage(B0.es, 0, 0); g.restore();
    // 旗杆
    g.fillStyle = P.black; g.fillRect(x - 5, y0 - 5, 11, 6); g.fillStyle = P.iron[2]; g.fillRect(x - 4, y0 - 4, 9, 4);
    g.fillStyle = P.black; g.fillRect(x - 2, top, 5, len); g.fillStyle = P.iron[3]; g.fillRect(x - 1, top, 1, len - 3); g.fillStyle = P.iron[1]; g.fillRect(x + 1, top, 1, len - 3);
    g.fillStyle = P.black; g.fillRect(x - 3, top - 5, 7, 6); g.fillStyle = P.brass[2]; g.fillRect(x - 2, top - 4, 5, 4); g.fillStyle = P.brass[3]; g.fillRect(x - 2, top - 4, 2, 1);
    const FW = 34, FH = 20;
    for (let i = 0; i < FW; i++) {
      const k = i / FW, dy = Math.round(Math.sin(1.2 - i * 0.42) * 2.2 * k), hgt = FH - Math.round(k * 4), shade = Math.sin(2.4 - i * 0.42) > 0.55;
      g.fillStyle = P.black; g.fillRect(x + 3 + i, top + 1 + dy - 1, 1, hgt + 2);
      g.fillStyle = shade ? P.iron[4] : P.white; g.fillRect(x + 3 + i, top + 1 + dy, 1, hgt);
    }
    g.fillStyle = P.black; g.fillRect(x + 3 + FW, top + Math.round(Math.sin(1.2 - FW * 0.42) * 2.2), 1, FH - 3);
  }
  // 驾驶员喊话：纸气泡，尾巴指着驾驶舱
  function bubble(g, x, y, w, lines, o = {}) {
    const h = 14 + lines.length * 22;
    nine(g, 'paper', x, y, w, h);
    px(g, X.tail(), o.tailX != null ? x + o.tailX : x + 18, y + h - 2);
    lines.forEach((ln, i) => T(g, ln, x + 12, y + 18 + i * 22, { font: `bold ${o.size || 18}px KaiTi, STKaiti, serif`, col: o.col && i === 0 ? o.col : INK, sh: false }));
  }

  // ---------- 三套方案 ----------
  // 数据：三种时刻的你的车况
  const ST = {
    normal: { hp: 0.72, heat: 0.46, water: 0.62, sel: 1, reload: [1, 0.45], off: false, lamps: [] },
    alert: { hp: 0.58, heat: 0.97, water: 0.09, sel: 1, reload: [0.3, 0.2], off: true, lamps: ['heat', 'water', 'gun'] },
    flag: { hp: 0.64, heat: 0.55, water: 0.4, sel: 1, reload: [1, 1], off: false, lamps: [] },
  };
  const WEAP = [['火炮', 1], ['机枪', 2]];

  // A 驾驶台：战场干净，所有车况集中在底下一条铁皮仪表台；警报 = 仪表台上的指示灯 + 准星变红；对方的事 = 上方落下一张电报
  function propA(st) {
    const s = ST[st], BAR = 132, c = cv(W, H + BAR), g = c.getContext('2d'), B0 = world();
    g.drawImage(B0.c, 0, 0); fx(g, st, { red: s.off }); g.drawImage(B0.front, 0, 0);
    // 上方：左右两块名牌（没有条），正中计时鼓
    nine(g, 'iron', 16, 12, 196, 32); T(g, `你 · ${ME.name}`, 30, 28, { size: 16 });   // 名牌用铁：黄铜只留给能点的东西
    nine(g, 'iron', W - 16 - 246, 12, 246, 32); T(g, `${FOE.pilot} · ${FOE.name}`, W - 30, 28, { align: 'right', size: 16 });
    px(g, drum(st === 'flag' ? '41' : st === 'alert' ? '58' : '74'), W / 2 - 22, 10); T(g, '铁匠铺后院', W / 2, 52, { align: 'center', size: 12 });
    if (st === 'flag') {
      flag(g);
      // 电报从上方落下（牛皮纸 + 红笔）
      const tx = W / 2 - 190, ty = 68;
      nine(g, 'kraft', tx, ty, 380, 74); px(g, X.pin(), W / 2 - 8, ty - 8);
      T(g, '电 报', tx + 16, ty + 20, { col: '#7e2a12', sh: false, size: 13 });
      T(g, `「${FOE.name}」挂白旗了`, W / 2, ty + 38, { align: 'center', col: INK, sh: false, font: 'bold 22px "Microsoft YaHei", sans-serif' });
      T(g, '点画面跳过 · 接下来选接受或拒绝', W / 2, ty + 60, { align: 'center', col: '#5a4426', sh: false, size: 13 });
    }
    // 仪表台
    const y0 = H;
    nine(g, 'iron', 0, y0, W, BAR);
    // 车况：锅炉压力表 + 水位管 + 装甲片
    const hot = s.heat >= 0.9;
    px(g, dial(22, s.heat, 0.82, hot), 26, y0 + 12); T(g, '锅炉', 72, y0 + 118, { align: 'center', size: 13, col: hot ? '#ff8a5c' : LIGHT });
    px(g, tube(46, s.water, P.water, s.water < 0.15), 136, y0 + 12); T(g, '水', 145, y0 + 118, { align: 'center', size: 13, col: s.water < 0.15 ? '#7fd8e4' : LIGHT });
    T(g, '装甲', 186, y0 + 26, { size: 13 }); bigNum(g, `${Math.round(s.hp * 100)}%`, 230, y0 + 16, LIGHT, 3);
    px(g, plates(Math.round(s.hp * 10), 10), 186, y0 + 50);
    // 指示灯：过热 / 缺水 / 动力 / 履带 / 武器
    const L = [['heat', '过热', P.fire[2]], ['water', '缺水', '#46c2c9'], ['power', '动力', P.fire[2]], ['track', '履带', P.fire[2]], ['gun', '武器', P.fire[2]]];
    L.forEach(([id, nm, col], i) => { const x = 186 + i * 42, on = s.lamps.includes(id); px(g, lamp(on, col), x, y0 + 74); T(g, nm, x + 11, y0 + 112, { align: 'center', size: 12, col: on ? '#ffd36b' : '#8a8577' }); });
    // 告示条（纸）：平时是操作提示，出事时一句红字
    nine(g, 'paper', 420, y0 + 12, 440, 36);
    if (st === 'alert') T(g, '锅炉过热 · 停火降温中 · 水快没了', 640, y0 + 30, { align: 'center', col: X.RED, sh: false, font: 'bold 17px "Microsoft YaHei", sans-serif' });
    else T(g, 'A / D 移动 · 鼠标瞄准 · 按住左键稳住准星', 640, y0 + 30, { align: 'center', col: INK, sh: false, size: 14 });
    // 武器键
    WEAP.forEach(([nm, n], i) => { const x = 470 + i * 180; px(g, key(n, s.sel === n, s.reload[i], s.off), x, y0 + 58); T(g, nm + (n === 2 ? ' ×2' : ''), x + 70, y0 + 80, { size: 15, col: s.off ? '#8a8577' : LIGHT }); T(g, s.off ? '停火中' : s.reload[i] >= 1 ? '装好了' : '装填中', x + 70, y0 + 102, { size: 12, col: s.off ? '#ff8a5c' : '#b9b4a6' }); });
    // 右：紧急泄压（炉火红拉手）+ 撤退
    nine(g, 'fire', 940, y0 + 22, 170, 44); T(g, '紧急泄压', 1025, y0 + 44, { align: 'center', size: 16 }); T(g, '限一次', 1025, y0 + 82, { align: 'center', size: 12, col: '#b9b4a6' });
    nine(g, 'ironBtn', 1136, y0 + 22, 120, 44); T(g, '撤退', 1196, y0 + 44, { align: 'center', size: 16 });
    return c;
  }

  // B 车上见：几乎没有框。你的车况是车头上方三根小液位管（只给你自己）；出事时你的驾驶员喊一句；对方的事由对方驾驶员喊
  function propB(st) {
    const s = ST[st], c = cv(W, H), g = c.getContext('2d'), B0 = world();
    g.drawImage(B0.c, 0, 0); fx(g, st); g.drawImage(B0.front, 0, 0);
    px(g, drum(st === 'flag' ? '41' : st === 'alert' ? '58' : '74'), W / 2 - 22, 10);
    // 你车顶上的三根液位管（装甲 / 热 / 水），挂在一块小铁牌上；告急的那根描红
    const bx = ME.x + 24, by = Math.round(B0.meTop.y) - 104;
    nine(g, 'iron', bx, by, 92, 84);
    [[s.hp, P.brass, '甲', false], [s.heat, P.fire, '热', s.heat >= 0.9], [s.water, P.water, '水', s.water < 0.15]].forEach(([v, r, nm, warn], i) => {
      px(g, tube(28, v, r, warn), bx + 12 + i * 24, by + 10); T(g, nm, bx + 21 + i * 24, by + 74, { align: 'center', size: 12, col: warn ? '#ffd36b' : LIGHT });
    });
    // 告急：你的驾驶员喊
    if (st === 'alert') { const cx = Math.round(B0.meTop.x); bubble(g, cx - 10, B0.meTop.y - 78, 230, ['烫烫烫！先停火！', '水也快见底了…'], { col: X.RED, tailX: 4 }); }
    // 武器键：地面上一排，靠左；泄压 / 撤退靠右
    WEAP.forEach(([nm, n], i) => { const x = 22 + i * 132; px(g, key(n, s.sel === n, s.reload[i], s.off), x, H - 52); T(g, nm, x + 68, H - 30, { size: 14, col: s.off ? '#8a8577' : LIGHT }); });
    nine(g, 'fire', W - 250, H - 50, 120, 40); T(g, '紧急泄压', W - 190, H - 30, { align: 'center', size: 14 });
    nine(g, 'ironBtn', W - 118, H - 50, 96, 40); T(g, '撤退', W - 70, H - 30, { align: 'center', size: 14 });
    if (st === 'flag') {
      flag(g);
      // 对方驾驶员喊 + 正中一行大字（毛笔红字）
      const fx0 = Math.round(B0.foeTop.x) - 250, fy0 = Math.round(B0.foeTop.y) - 70;
      bubble(g, fx0, fy0, 230, ['别打了别打了，', '我认输！'], { tailX: 226 });
      const br = X.brush('白旗', 44); px(g, br, W / 2 - br.width, 60);
      T(g, `「${FOE.name}」投降了 · 点画面跳过`, W / 2, 60 + br.height * 2 + 16, { align: 'center', size: 15 });
    }
    return c;
  }

  // C 记分牌：上方挂一块木记分牌（双方名字 + 耐久片 + 计时），这是对方唯一的信息；你的车况在底下一条窄铁条；
  // 出事时记分牌下面翻出一行字；对方挂白旗时记分牌整块翻过来写「白旗」，四角灯泡亮
  function propC(st) {
    const s = ST[st], BAR = 84, c = cv(W, H + BAR), g = c.getContext('2d'), B0 = world();
    g.drawImage(B0.c, 0, 0); fx(g, st); g.drawImage(B0.front, 0, 0);
    if (st === 'flag') flag(g);
    // 记分牌：两根铁链吊着
    const bw = 560, bh = 92, bx = W / 2 - bw / 2, by = 18;
    g.fillStyle = P.dark[0]; for (const xx of [bx + 60, bx + bw - 64]) for (let yy = 0; yy < by + 4; yy += 6) { g.fillRect(xx, yy, 4, 5); g.fillStyle = P.iron[2]; g.fillRect(xx + 1, yy + 1, 2, 2); g.fillStyle = P.dark[0]; }
    nine(g, 'board', bx, by, bw, bh);
    const bulbs = st === 'flag';
    for (const [lx, ly] of [[bx + 10, by + 10], [bx + bw - 32, by + 10], [bx + 10, by + bh - 32], [bx + bw - 32, by + bh - 32]]) px(g, lamp(bulbs, '#ffd36b'), lx, ly);
    if (st === 'flag') {
      const br = X.brush('白旗', 36, '#f4f0e0', SHADOW); px(g, br, W / 2 - br.width, by + 10);
      nine(g, 'paper', W / 2 - 200, by + bh + 6, 400, 34);
      T(g, `「${FOE.name}」挂白旗了 · 点画面跳过`, W / 2, by + bh + 23, { align: 'center', col: INK, sh: false, size: 15 });
    } else {
      T(g, '你', bx + 48, by + 30, { col: CHALK, size: 18, font: 'bold 18px "Microsoft YaHei", sans-serif' });
      px(g, plates(Math.round(s.hp * 10), 10), bx + 48, by + 50);
      T(g, FOE.pilot, bx + bw - 48, by + 30, { align: 'right', col: CHALK, size: 16, font: 'bold 16px "Microsoft YaHei", sans-serif' });
      px(g, plates(8, 10), bx + bw - 48 - 122, by + 50);
      px(g, drum(st === 'alert' ? '58' : '74'), W / 2 - 22, by + 22); T(g, '铁匠铺后院', W / 2, by + 70, { align: 'center', col: CHALK, size: 12 });
      if (st === 'alert') { nine(g, 'paper', W / 2 - 200, by + bh + 6, 400, 34); T(g, '你的锅炉过热 · 停火降温中', W / 2, by + bh + 23, { align: 'center', col: X.RED, sh: false, font: 'bold 17px "Microsoft YaHei", sans-serif' }); }
    }
    // 底条：你的车况（齿条表）+ 武器键 + 泄压 / 撤退
    const y0 = H;
    nine(g, 'iron', 0, y0, W, BAR);
    [['耐久', s.hp, 'hp', false], ['热量', s.heat, 'heat', s.heat >= 0.9], ['水', s.water, 'water', s.water < 0.15]].forEach(([nm, v, kk, bad], i) => {
      const yy = y0 + 12 + i * 22;
      T(g, nm, 22, yy + 10, { size: 13, col: bad ? '#ffd36b' : LIGHT });
      px(g, X.ui.rack(Math.min(1, v), { k: kk, over: bad, w: 80 }), 64, yy);
      T(g, `${Math.round(v * 100)}%`, 238, yy + 10, { size: 13, col: bad ? '#ff8a5c' : LIGHT });
    });
    WEAP.forEach(([nm, n], i) => { const x = 330 + i * 160; px(g, key(n, s.sel === n, s.reload[i], s.off), x, y0 + 18); T(g, nm, x + 68, y0 + 40, { size: 14, col: s.off ? '#8a8577' : LIGHT }); });
    T(g, 'A / D 移动 · 鼠标瞄准 · 按住左键稳住准星', 860, y0 + 42, { align: 'center', size: 12, col: '#b9b4a6' });
    nine(g, 'fire', 1010, y0 + 20, 130, 44); T(g, '紧急泄压', 1075, y0 + 42, { align: 'center', size: 15 });
    nine(g, 'ironBtn', 1156, y0 + 20, 104, 44); T(g, '撤退', 1208, y0 + 42, { align: 'center', size: 15 });
    return c;
  }

  const PROPS = [
    { id: 'A', name: 'A 驾驶台', fn: propA, why: [
      '战场上什么框都没有：车况、警报、武器、按钮全部收进画面下面一条铁皮仪表台，像坐在驾驶室里看仪表。',
      '你的车况：锅炉压力表（指针进红区 = 过热）、水位管、装甲片（十片，掉一成灭一片）。',
      '警报：仪表台上一排指示灯（过热 / 缺水 / 动力 / 履带 / 武器）+ 纸条上一句红字；同时<b>准星变红</b>——眼睛盯着准星也知道现在打不了。',
      '对方：只有右上角一块名牌，没有任何条。挂白旗时上方钉下一张电报。',
    ] },
    { id: 'B', name: 'B 车上见', fn: propB, why: [
      '几乎没有界面：上方只有计时鼓，武器键和两个按钮缩在地面那一条上。',
      '你的车况：你车顶上挂一块小铁牌，三根液位管（甲 / 热 / 水），跟着你的车走；告急的那根描红。只给你自己，对方车上什么都不挂。',
      '警报：你的驾驶员直接喊（纸气泡、手写字），比如「烫烫烫！先停火！」。',
      '对方的事由对方驾驶员喊：挂白旗时他喊「我认输！」，正中一行毛笔大字「白旗」。',
    ] },
    { id: 'C', name: 'C 记分牌', fn: propC, why: [
      '像看台上的比赛：上方吊一块木记分牌——双方名字、各自十片耐久、中间计时。<b>对方只在这里出现，只有耐久</b>，没有热量、水、警报。',
      '你的车况：画面下面一条窄铁条，三根齿条表（耐久 / 热量 / 水）+ 武器键 + 两个按钮。',
      '警报：记分牌下面翻出一行纸条字（只说你的事）。',
      '对方挂白旗：记分牌整块翻过来写「白旗」，四角灯泡亮，下面一行说明。',
    ] },
  ];
  const STATES = [['normal', '常态'], ['alert', '告急'], ['flag', '对方挂白旗']];

  async function mount() {
    await loadSkins();
    const root = document.getElementById('props');
    for (const p of PROPS) {
      const box = document.createElement('section'); box.className = 'prop';
      box.innerHTML = `<h2>${p.name}</h2><ul class="why">${p.why.map(x => `<li>${x}</li>`).join('')}</ul>`;
      const seg = document.createElement('div'); seg.className = 'seg';
      const img = document.createElement('img'); img.className = 'shot';
      const show = (sid) => { img.src = p.fn(sid).toDataURL(); [...seg.children].forEach(b => b.classList.toggle('on', b.dataset.s === sid)); };
      for (const [sid, nm] of STATES) { const b = document.createElement('button'); b.textContent = nm; b.dataset.s = sid; b.onclick = () => show(sid); seg.append(b); }
      box.append(seg, img);
      root.append(box);
      show('normal');
    }
  }
  return { mount, PROPS, propA, propB, propC };
})();
SA.BATTLEUI.mount().catch(e => { console.error(e); document.getElementById('props').textContent = '样机出错：' + e.message; });
