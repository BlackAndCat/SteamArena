// 界面像素件（tools/ui-lab.html v3）：所有框、按钮、齿轮、数字都用代码逐像素画，放大 2 倍显示（全界面一种像素大小）。
// 规矩同 docs/art-style.md：四阶色 [描边, 暗, 固有, 亮]，左上光，不抗锯齿，不旋转，渐变用 Bayer 抖动。
// 调色板用 SA.PAL；纸 / 牛皮纸 / 黑板 / 蓝图四组是界面新加的色阶（定了以后写进 js/palette.js）。
window.SA = window.SA || {};

SA.PX = (() => {
  const P = SA.PAL, S = 2;   // 一个美术像素 = 2 CSS 像素
  const RAMP = {
    iron: { o: P.dark[0], d: P.iron[0], b: P.iron[1], l: P.iron[2], h: P.iron[3], hh: P.iron[4] },
    brass: { o: P.brass[0], d: P.brass[1], b: P.brass[2], l: P.brass[3] },
    paper: { o: '#4a3a28', d: '#b59c6c', a: '#cdb887', b: '#decda3', l: '#efe4c6', s: '#c9b387' },
    kraft: { o: P.leather[0], d: '#8e6238', b: '#c09560', l: '#d8b27c', s: '#a97f4c' },
    wood: { o: '#1e120a', d: P.leather[0], b: P.leather[1], l: P.leather[2] },
    fire: { o: P.fire[0], d: '#8c2a14', b: P.fire[1], l: P.fire[2] },
    flat: { o: P.dark[0], d: P.dark[1], b: P.dark[2], l: P.dark[3] },
    board: { o: P.dark[0], b: '#1d2823', l: '#25322c', d: '#161f1b' },
    blue: { o: '#0c2340', b: '#18406e', m: '#1f4b7e', g: '#2d5c92', G: '#4a7cb4', ink: '#dcecfb' },
  };
  const INK = '#2a1a05', RED = P.fire[1], CHALK = '#e8e3d2';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const hash = (x, y, s = 1) => { let v = (x * 374761393 + y * 668265263 + s * 982451653) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };

  function C(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const k = { c, g, w, h, p(x, y, col) { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }, r(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, clr(x, y) { g.clearRect(x, y, 1, 1); } };
    return k;
  }
  // 四阶方块：描边 + 左上亮 + 右下暗；inset = 凹进去（亮暗对调）
  function box(k, x, y, w, h, R, inset) {
    k.r(x, y, w, h, R.o); k.r(x + 1, y + 1, w - 2, h - 2, R.b);
    k.r(x + 1, y + 1, w - 2, 1, inset ? R.d : R.l); k.r(x + 1, y + 1, 1, h - 2, inset ? R.d : R.l);
    k.r(x + 1, y + h - 2, w - 2, 1, inset ? R.l : R.d); k.r(x + w - 2, y + 1, 1, h - 2, inset ? R.l : R.d);
  }
  function box0(k, w, h, R) { k.r(0, 0, w, 1, R.o); k.r(0, h - 1, w, 1, R.o); k.r(0, 0, 1, h, R.o); k.r(w - 1, 0, 1, h, R.o); k.r(1, 1, w - 2, 1, R.l); k.r(1, 1, 1, h - 2, R.l); k.r(1, h - 2, w - 2, 1, R.d); k.r(w - 2, 1, 1, h - 2, R.d); }
  const rivet = (k, x, y, R = RAMP.iron) => { k.r(x, y, 2, 2, R.h); k.p(x, y, R.hh || R.l); k.p(x + 2, y + 1, R.o); k.p(x + 1, y + 2, R.o); k.p(x + 2, y + 2, R.d); };
  const brassRivet = (k, x, y) => { k.r(x, y, 2, 2, P.brass[2]); k.p(x, y, P.brass[3]); k.p(x + 2, y + 1, P.brass[0]); k.p(x + 1, y + 2, P.brass[0]); k.p(x + 2, y + 2, P.brass[0]); };
  function line(k, x0, y0, x1, y1, col, gap = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, i = 0;
    for (;;) { if (!gap || hash(x0, y0, 7) > gap) k.p(x0, y0, col); i++; if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }

  // ---------- 木纹：一根根长纹线（不要零散杂点），偶尔一个节疤；vertical = 竖纹（柱子）----------
  function woodGrain(k, x0, y0, w, h, R, seed, mask, vertical) {
    const put = vertical ? (x, y, c) => k.p(y, x, c) : (x, y, c) => k.p(x, y, c);
    const inb = (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && (!mask || mask(x, y));
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) put(x, y, R.b);
    const n = Math.max(2, Math.round(h / 3.2));
    for (let i = 0; i < n; i++) {
      let y = y0 + 1 + Math.floor(hash(i, 1, seed) * Math.max(1, h - 2));
      const col = hash(i, 2, seed) < 0.72 ? R.d : R.l, step = 14 + Math.floor(hash(i, 5, seed) * 18);
      const x = x0 + Math.floor(hash(i, 3, seed) * w * 0.6) - Math.floor(w * 0.2), len = Math.floor(w * (0.45 + hash(i, 4, seed) * 0.7));
      for (let t = 0; t < len; t++) {
        if (t && t % step === 0) y += hash(i * 31 + t, 6, seed) < 0.5 ? -1 : 1;
        y = Math.max(y0 + 1, Math.min(y0 + h - 2, y));
        if (inb(x + t, y)) put(x + t, y, col);
      }
    }
    const knots = Math.floor(w * h / 1100);
    for (let i = 0; i < knots; i++) {
      const cx = x0 + 5 + Math.floor(hash(i, 7, seed) * Math.max(1, w - 10)), cy = y0 + 2 + Math.floor(hash(i, 8, seed) * Math.max(1, h - 4));
      for (const [dx, dy] of [[-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [1, 1], [0, 1], [-1, 1]]) if (inb(cx + dx, cy + dy)) put(cx + dx, cy + dy, R.d);
      if (inb(cx, cy)) put(cx, cy, R.o);
    }
  }
  const nail = (k, x, y) => { k.r(x, y, 2, 2, P.iron[2]); k.p(x, y, P.iron[4]); k.p(x + 1, y + 1, P.dark[0]); };
  // ---------- 笔迹：红笔手画的圈、波浪下划线、带箭头的注释线（画在纸上）----------
  const PEN = P.fire[1];
  function penLoop(w, h, col = PEN, seed = 5) {
    const k = C(w, h), cx = (w - 1) / 2, cy = (h - 1) / 2, a0 = -2.4 + hash(1, 1, seed) * 0.8, rx = cx - 1.2, ry = cy - 1.2;
    for (let t = 0; t <= 1.13; t += 0.0015) {
      const a = a0 + t * Math.PI * 2, wob = 1 + 0.045 * Math.sin(a * 2 + seed) + 0.025 * Math.sin(a * 5 + seed * 2), sh = t > 1 ? (t - 1) * 1.1 : 0;
      const x = Math.round(cx + Math.cos(a) * rx * (wob - sh * 0.5)), y = Math.round(cy + Math.sin(a) * ry * (wob - sh));
      k.p(x, y, col); if (t > 0.12 && t < 0.5) k.p(x, y + (Math.sin(a) > 0 ? -1 : 1), col);
    }
    return k.c;
  }
  function penUnder(w, col = PEN, seed = 3) {
    const k = C(w, 5);
    for (let x = 0; x < w; x++) { const y = 2 + Math.round(Math.sin(x / 4.2 + seed) * 1.2); k.p(x, y, col); if (x > 2 && x < w * 0.6) k.p(x, y + 1, col); }
    return k.c;
  }
  // pts = 三个点（起点、弯曲控制点、终点），终点画箭头
  function penArrow(w, h, pts, col = PEN) {
    const k = C(w, h), [[x0, y0], [x1, y1], [x2, y2]] = pts;
    for (let t = 0; t <= 1; t += 0.004) { const u = 1 - t; k.p(Math.round(u * u * x0 + 2 * u * t * x1 + t * t * x2), Math.round(u * u * y0 + 2 * u * t * y1 + t * t * y2), col); }
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    for (const s of [1, -1]) line(k, x2, y2, x2 - ux * 4 + uy * 3 * s, y2 - uy * 4 - ux * 3 * s, col);
    return k.c;
  }
  // 贴在木牌上的纸条：毛边、左边一片浆糊印、右上角翘起
  function paperLabel(w, h, seed = 3) {
    const k = C(w, h), R = RAMP.paper;
    paperFill(k, 0, 0, w, h, R, seed, 2); deckle(k, w, h, R, seed);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < Math.min(9, w - 2); x++) if (bay(x, y) < 0.28) k.p(x, y, R.a);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) k.clr(w - 1 - j, i);
    for (let i = 0; i < 4; i++) { k.p(w - 4 + i, i, R.o); if (i) k.p(w - 5 + i, i, R.l); }
    return k.c;
  }

  // ---------- 九宫格皮肤：{ url, c }，CSS 用 border-image: url c fill / (c*2)px repeat ----------
  const SKIN = {};
  function skin(name, c, m, paint) { const k = C(c * 2 + m, c * 2 + m); paint(k, k.w, k.h); SKIN[name] = { url: k.c.toDataURL(), c }; }
  function paperFill(k, x0, y0, w, h, R, seed, edge = 0) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const hs = hash(x, y, seed);
      let col = R.b;
      if (hs < 0.03) col = R.s; else if (hs > 0.992) col = R.l;
      if (edge) { const e = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y); if (e < edge && bay(x, y) > e / edge) col = R.a || R.s; }
      k.p(x, y, col);
    }
    // 纸纤维：稀疏的 2～3 像素短横
    for (let i = 0; i < w * h / 220; i++) { const x = x0 + Math.floor(hash(i, 3, seed) * (w - 3)), y = y0 + Math.floor(hash(i, 5, seed) * h); k.r(x, y, 2 + (i % 2), 1, hash(i, 9, seed) > 0.5 ? R.l : R.s); }
  }
  // 毛边：描边沿着纸边随机往里缩一个像素
  function deckle(k, w, h, R, seed) {
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const inn = hash(x, y, seed) < 0.28; if (inn) { k.clr(x, y); k.p(x, y === 0 ? 1 : h - 2, R.o); } else k.p(x, y, R.o); }
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const inn = hash(x, y, seed + 1) < 0.28; if (inn) { k.clr(x, y); k.p(x === 0 ? 1 : w - 2, y, R.o); } else k.p(x, y, R.o); }
    k.clr(0, 0); k.clr(w - 1, 0); k.clr(0, h - 1); k.clr(w - 1, h - 1);
  }
  function build() {
    // 铁板：平的，只在四角打铆钉；不要满屏纹理
    skin('iron', 6, 20, (k, w, h) => { box(k, 0, 0, w, h, RAMP.iron); for (const [x, y] of [[2, 2], [w - 5, 2], [2, h - 5], [w - 5, h - 5]]) rivet(k, x, y); });
    skin('ironIn', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, { o: P.dark[0], b: P.dark[1], l: P.iron[1], d: P.dark[0] }, true); });
    skin('brass', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.brass); k.r(2, 2, w - 5, 1, P.brass[3]); });
    skin('brassDn', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.brass, true); });
    skin('ironBtn', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.iron); for (const [x, y] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) brassRivet(k, x, y); });
    skin('ironBtnDn', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.iron, true); for (const [x, y] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) brassRivet(k, x, y); });
    skin('fire', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.fire); for (const [x, y] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) brassRivet(k, x, y); });
    skin('flat', 4, 16, (k, w, h) => { box(k, 0, 0, w, h, RAMP.flat); });
    skin('paper', 6, 40, (k, w, h) => { paperFill(k, 0, 0, w, h, RAMP.paper, 11, 4); deckle(k, w, h, RAMP.paper, 11); });
    skin('paperOld', 6, 40, (k, w, h) => { paperFill(k, 0, 0, w, h, { ...RAMP.paper, b: '#d4bf92', a: '#bba172', s: '#c2aa7a' }, 13, 5); deckle(k, w, h, RAMP.paper, 13); });
    skin('kraft', 4, 24, (k, w, h) => { paperFill(k, 0, 0, w, h, RAMP.kraft, 17, 2); deckle(k, w, h, RAMP.kraft, 17); });
    skin('green', 4, 24, (k, w, h) => { paperFill(k, 0, 0, w, h, { o: '#2e3a26', b: '#cfdcb8', a: '#b8c89c', l: '#e2ecd0', s: '#bccb9f' }, 19, 3); deckle(k, w, h, { o: '#2e3a26' }, 19); });
    skin('wood', 5, 18, (k, w, h) => { woodGrain(k, 0, 0, w, h, RAMP.wood, 23); box0(k, w, h, RAMP.wood); });
    skin('board', 8, 32, (k, w, h) => {
      woodGrain(k, 0, 0, w, h, RAMP.wood, 29, (x, y) => x < 5 || y < 5 || x >= w - 5 || y >= h - 5); box0(k, w, h, RAMP.wood);
      for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) k.p(x, y, hash(x >> 2, y >> 2, 29) < 0.18 && bay(x, y) < 0.35 ? RAMP.board.l : RAMP.board.b);
      k.r(5, 5, w - 10, 1, RAMP.board.d); k.r(5, 5, 1, h - 10, RAMP.board.d); k.r(4, 4, w - 8, 1, RAMP.wood.o); k.r(4, 4, 1, h - 8, RAMP.wood.o); k.r(4, h - 5, w - 8, 1, RAMP.wood.l); k.r(w - 5, 4, 1, h - 8, RAMP.wood.l);
    });
    skin('stamp', 3, 12, (k, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, h - 1 - y); if (e < 2 && hash(x, y, 31) > 0.12) k.p(x, y, RED); } });
  }

  // ---------- 像素数字（5×7）：钱、数值、价格、评分都用它 ----------
  const G = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '£': ['00110', '01001', '01000', '11100', '01000', '01000', '11111'], ',': ['00', '00', '00', '00', '00', '01', '10'], '.': ['0', '0', '0', '0', '0', '0', '1'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'], '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'], '-': ['0000', '0000', '0000', '1111', '0000', '0000', '0000'],
    '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'], ':': ['0', '1', '0', '0', '0', '1', '0'],
    't': ['0100', '0100', '1110', '0100', '0100', '0101', '0010'], 'k': ['1000', '1000', '1001', '1010', '1100', '1010', '1001'],
    'm': ['00000', '00000', '11010', '10101', '10101', '10101', '10101'], 'h': ['1000', '1000', '1110', '1001', '1001', '1001', '1001'],
    'I': ['111', '010', '010', '010', '010', '010', '111'], 'V': ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
    '▲': ['00000', '00000', '00100', '01110', '11111', '00000', '00000'], '▼': ['00000', '00000', '11111', '01110', '00100', '00000', '00000'],
    ' ': ['00', '00', '00', '00', '00', '00', '00'], '→': ['00000', '00100', '00010', '11111', '00010', '00100', '00000'],
  };
  function numW(str) { let w = 0; for (const ch of str) w += ((G[ch] || G[' '])[0].length) + 1; return Math.max(1, w - 1); }
  function num(str, col = INK, o = {}) {
    str = String(str); const sh = o.shadow; const k = C(numW(str) + (sh ? 1 : 0), 7 + (sh ? 1 : 0));
    let x = 0;
    for (const ch of str) { const gl = G[ch] || G[' ']; gl.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') { if (sh) k.p(x + i + 1, y + 1, sh); } }); x += gl[0].length + 1; }
    x = 0;
    for (const ch of str) { const gl = G[ch] || G[' ']; gl.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') k.p(x + i, y, col); }); x += gl[0].length + 1; }
    return k.c;
  }

  // ---------- 齿轮：半径 R、n 个齿；ph = 转角；frames 张帧（转一个齿距）----------
  function gear(R, n, Rm = RAMP.brass, ph = 0, o = {}) {
    const sz = R * 2 + 1, k = C(sz, sz), c = R + 0.5, hole = o.hole == null ? R * 0.3 : o.hole;
    const inside = (x, y) => { const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy); if (d > R + 0.3) return false; if (d <= R - 1.7) return true; const t = (((Math.atan2(dy, dx) + ph) / (Math.PI * 2)) * n % 1 + 1) % 1; return t < 0.5; };
    for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
      if (!inside(x, y)) continue;
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      let col = Rm.b;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = Rm.o;
      else if (d < hole) col = Rm.o;
      else if (d < hole + 1.1) col = (dx + dy < 0) ? Rm.d : Rm.l;
      else if ((!inside(x - 1, y - 1) || !inside(x - 2, y - 1) || !inside(x - 1, y - 2))) col = Rm.l;
      else if ((!inside(x + 1, y + 1) || !inside(x + 2, y + 1) || !inside(x + 1, y + 2))) col = Rm.d;
      else if (o.spokes && d > R * 0.42 && d < R - 2.6 && Math.abs(Math.sin((Math.atan2(dy, dx) + ph) * o.spokes / 2)) > 0.55) col = Rm.d;
      k.p(x, y, col);
    }
    return k.c;
  }
  // 一整条齿轮帧（横排），给 CSS steps() 动画用
  function gearStrip(R, n, Rm, frames = 3) {
    const sz = R * 2 + 1, k = C(sz * frames, sz);
    for (let f = 0; f < frames; f++) k.g.drawImage(gear(R, n, Rm, (Math.PI * 2 / n) * f / frames), f * sz, 0);
    return { url: k.c.toDataURL(), sz, frames };
  }

  // ---------- 其余像素件 ----------
  // 五角星（声望）
  const STAR = ['...o...', '..ooo..', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', 'o.....o'];
  function star(on = true) { const k = C(7, 7); STAR.forEach((r, y) => { for (let x = 0; x < 7; x++) if (r[x] === 'o') k.p(x, y, on ? (y < 3 ? P.brass[3] : y < 5 ? P.brass[2] : P.brass[1]) : P.dark[2]); }); return k.c; }
  // 乌兹钢锭
  function ingot(col = '#8f55d6') { const k = C(11, 6); k.r(1, 0, 9, 1, P.dark[0]); k.r(0, 1, 11, 5, P.dark[0]); k.r(1, 1, 9, 4, col); k.r(2, 1, 7, 1, '#c8a4f0'); k.r(1, 4, 9, 1, '#5a2e96'); return k.c; }
  // 回形针（黄铜丝）
  function clip() { const k = C(6, 15), B = RAMP.brass; const pts = ['.oooo.', 'o....o', 'o.oo.o', 'o.o..o', 'o.o..o', 'o.o..o', 'o.o..o', 'o.o..o', 'o.o..o', 'o.o..o', 'o.oo.o', 'o....o', 'o....o', '.o..o.', '..oo..']; pts.forEach((r, y) => { for (let x = 0; x < 6; x++) if (r[x] === 'o') k.p(x, y, x < 2 ? B.l : B.b); }); return k.c; }
  // 夹板的黄铜夹子
  function bigClip(w = 30) { const k = C(w, 11); box(k, 0, 2, w, 9, RAMP.brass); k.r(3, 0, w - 6, 3, P.brass[0]); k.r(4, 1, w - 8, 2, P.brass[2]); k.r(Math.floor(w / 2) - 4, 5, 8, 3, P.brass[0]); k.r(Math.floor(w / 2) - 3, 5, 6, 1, P.dark[0]); brassRivet(k, 2, 4); brassRivet(k, w - 5, 4); return k.c; }
  // 牛皮纸吊牌的头（尖角 + 黄铜鸡眼），接在九宫格身子左边
  function tagHead() { const k = C(8, 15), R = RAMP.kraft; for (let y = 0; y < 15; y++) { const inset = Math.abs(7 - y); for (let x = inset; x < 8; x++) k.p(x, y, x === inset ? R.o : (y === 0 || y === 14) ? R.o : R.b); } k.r(4, 6, 3, 3, P.brass[1]); k.p(4, 6, P.brass[3]); k.p(5, 7, P.dark[0]); return k.c; }
  // 气泡尾巴
  function tail() { const k = C(8, 6), R = RAMP.paper; for (let y = 0; y < 6; y++) for (let x = 0; x < 8 - y; x++) k.p(x, y, x === 0 || x === 7 - y ? R.o : R.b); k.r(0, 0, 8, 1, R.b); k.p(0, 0, R.o); k.p(7, 0, R.o); return k.c; }
  // 纸条的一段：横线（打过的划掉）、粉笔圈
  function chalkLine(w) { const k = C(w, 3); for (let x = 0; x < w; x++) { const y = x < w * 0.45 ? 1 : x < w * 0.8 ? 1 + (x % 7 === 0 ? 1 : 0) : 2 - (x > w * 0.92 ? 1 : 0); if (hash(x, 1, 41) > 0.1) k.p(x, y, CHALK); } return k.c; }
  function ellipse(w, h, col = CHALK, gap = 0.08, thick = 1) {
    const k = C(w, h), cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let t = 0; t < 1.06; t += 0.0025) { const a = t * Math.PI * 2 - 0.5, r = 1 + (t > 1 ? 0.04 : 0); const x = Math.round(cx + Math.cos(a) * (cx - 0.5) * r), y = Math.round(cy + Math.sin(a) * (cy - 0.5) * r); if (hash(x, y, 43) > gap) { k.p(x, y, col); if (thick > 1) k.p(x, y + 1, col); } }
    return k.c;
  }
  // 拉杆（调速杆）：铁底座 + 黄铜扇形齿板 + 三像素宽的铁杆 + 黄铜箍 + 皮握把，轴心是一只小黄铜齿轮
  // pos 0 = 往后扳（待命）、1 = 往前推到底（出战）
  function lever(pos = 0) {
    const W = 50, H = 58, k = C(W, H), px = 25, py = 46, B = RAMP.brass;
    for (let y = 0; y < py; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - px, dy = y + 0.5 - py, d = Math.hypot(dx, dy), a = Math.atan2(dx, -dy) * 180 / Math.PI;
      if (Math.abs(a) > 62 || dy > -3) continue;
      const tooth = d > 22 && d <= 24.6 && ((a + 64) % 8) < 4 && Math.abs(a) < 58;
      if (tooth) { k.p(x, y, d > 23.8 || ((a + 64) % 8) < 0.9 ? B.o : B.d); continue; }
      if (d < 16.2 || d > 22.2) continue;
      k.p(x, y, d < 17.1 || d > 21.3 || Math.abs(a) > 60 ? B.o : d < 18.2 ? B.l : a > 20 ? B.d : B.b);
    }
    // 两个刻度：待命（暗）/ 出战（红）
    for (const [ang, col] of [[-50, P.dark[0]], [50, P.fire[2]]]) { const r = ang * Math.PI / 180; k.r(Math.round(px + Math.sin(r) * 19.5) - 1, Math.round(py - Math.cos(r) * 19.5) - 1, 2, 2, col); }
    box(k, 5, py, 40, 12, RAMP.iron); rivet(k, 8, py + 4); rivet(k, 39, py + 4);
    // 杆
    const ang = (-42 + 84 * pos) * Math.PI / 180, L = 31, ux = Math.sin(ang), uy = -Math.cos(ang), nx = -uy, ny = ux;
    for (let t = 0; t <= L; t += 0.5) { const cx = px + ux * t, cy = py + uy * t;
      k.p(Math.round(cx + nx * 1.4), Math.round(cy + ny * 1.4), P.dark[0]); k.p(Math.round(cx - nx * 1.4), Math.round(cy - ny * 1.4), P.dark[0]);
      k.p(Math.round(cx + nx * 0.5), Math.round(cy + ny * 0.5), P.iron[2]); k.p(Math.round(cx - nx * 0.5), Math.round(cy - ny * 0.5), P.iron[3]); }
    // 卡爪（咬在齿上）
    const cx0 = px + ux * 20, cy0 = py + uy * 20; k.r(Math.round(cx0) - 1, Math.round(cy0) - 1, 3, 3, P.dark[0]); k.p(Math.round(cx0), Math.round(cy0), P.iron[3]);
    // 黄铜箍 + 皮握把
    const gx = Math.round(px + ux * (L + 1)), gy = Math.round(py + uy * (L + 1));
    k.r(gx - 3, gy - 1, 7, 3, B.o); k.r(gx - 2, gy, 5, 1, B.l);
    k.r(gx - 3, gy - 9, 7, 9, P.leather[0]); k.r(gx - 2, gy - 8, 5, 7, P.leather[1]); k.r(gx - 2, gy - 8, 1, 7, P.leather[2]); k.clr(gx - 3, gy - 9); k.clr(gx + 3, gy - 9);
    // 轴心齿轮
    k.g.drawImage(gear(5, 7, RAMP.brass, 0.25 + pos), px - 5, py - 5);
    return k.c;
  }
  // 路标木牌：两块木板（长木纹、斜面、中缝）、箭头尖露出端面、靠柱子一头箍一条铁带、两颗铁钉、下沿磕掉两小块
  // 画的时候都按朝右画，dir = -1 时整张镜像（铁带就到了右边，贴着柱子）
  function sign(w, dir = 1, R = RAMP.wood, seed = 1) {
    const h = 26, tip = 12, k = C(w, h);
    const lim = (y) => w - Math.round(Math.abs(y - (h - 1) / 2) * tip / ((h - 1) / 2));   // 箭头尖：中间最长
    const put = (x, y, c) => k.p(dir > 0 ? x : w - 1 - x, y, c);
    const inside = (x, y) => y >= 0 && y < h && x >= 0 && x < lim(y);
    const kk = { p: put };
    woodGrain(kk, 0, 0, w, 12, R, seed, inside); woodGrain(kk, 0, 13, w, 13, R, seed + 5, inside);
    for (let x = 1; x < w; x++) { if (inside(x, 1)) put(x, 1, R.l); if (inside(x, 14)) put(x, 14, R.l); if (inside(x, 11)) put(x, 11, R.d); if (inside(x, 24)) put(x, 24, R.d); if (inside(x, 12)) put(x, 12, R.o); }
    for (let y = 0; y < h; y++) { const e = lim(y); if (e - 2 >= 0 && y !== 12) put(e - 2, y, R.l); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) put(x, y, R.o);
    for (const cx of [Math.round(w * 0.34), Math.round(w * 0.63)]) for (let x = cx; x < cx + 2; x++) { k.clr(dir > 0 ? x : w - 1 - x, h - 1); put(x, h - 2, R.o); }
    // 铁带（靠柱子一头）+ 两颗螺栓
    for (let y = 0; y < h; y++) { put(3, y, P.dark[0]); put(4, y, P.iron[3]); put(5, y, P.iron[2]); put(6, y, P.iron[1]); put(7, y, P.dark[0]); }
    for (const y of [4, 19]) { put(4, y, P.iron[4]); put(5, y, P.iron[3]); put(4, y + 1, P.iron[3]); put(5, y + 1, P.dark[0]); }
    // 靠箭头一头各钉一颗钉子
    for (const y of [5, 18]) { const x = lim(y) - 7; put(x, y, P.iron[4]); put(x + 1, y, P.iron[2]); put(x, y + 1, P.iron[2]); put(x + 1, y + 1, P.dark[0]); }
    return k.c;
  }
  // 竖木柱：竖纹 + 顶上一个小尖帽
  function post(hh = 290) {
    const w = 10, k = C(w, hh);
    woodGrain(k, 0, 0, hh, w, RAMP.wood, 61, null, true);
    k.r(0, 0, 1, hh, RAMP.wood.o); k.r(w - 1, 0, 1, hh, RAMP.wood.o); k.r(1, 0, 1, hh, RAMP.wood.l); k.r(w - 2, 0, 1, hh, RAMP.wood.d);
    k.r(0, 0, w, 1, RAMP.wood.o); k.r(1, 1, w - 2, 2, RAMP.wood.l);
    return k.c;
  }
  // 木箱：木纹板 + 斜撑 + 四颗钉子
  function crate(w = 40, h = 22) {
    const k = C(w, h), R = RAMP.wood;
    woodGrain(k, 0, 0, w, h, R, 71); box0(k, w, h, R);
    k.r(1, 7, w - 2, 1, R.o); k.r(1, 14, w - 2, 1, R.o);
    for (let i = 0; i < w - 4; i++) { const y = 2 + Math.round(i * (h - 5) / (w - 5)); k.p(2 + i, y, R.d); k.p(2 + i, y + 1, R.l); }
    for (const [x, y] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]]) nail(k, x, y);
    return k.c;
  }
  // 桌面 / 地板平铺块：两排长木板，接缝错开；只有木纹，没有杂点
  function planks(w = 128, h = 32) {
    const k = C(w, h), R = { o: '#1a0f08', d: '#291810', b: '#33200f', l: '#3f2814' };
    woodGrain(k, 0, 0, w, 15, R, 81); woodGrain(k, 0, 16, w, 16, R, 83);
    k.r(0, 15, w, 1, R.o); k.r(0, 31, w, 1, R.o); k.r(Math.round(w * 0.3), 0, 1, 15, R.o); k.r(Math.round(w * 0.78), 16, 1, 15, R.o);
    return k.c;
  }

  // ---------- 注册 CSS 变量 ----------
  let ready = false;
  const GEARS = {};
  function init(root = document.documentElement) {
    if (ready) return; ready = true;
    build();
    for (const [n, s] of Object.entries(SKIN)) root.style.setProperty(`--sk-${n}`, `url(${s.url})`);
    GEARS.btn = gearStrip(6, 8, RAMP.brass, 3); GEARS.btnIron = gearStrip(6, 8, RAMP.iron, 3);
    GEARS.small = gearStrip(4, 6, RAMP.brass, 3);
    root.style.setProperty('--gear-btn', `url(${GEARS.btn.url})`); root.style.setProperty('--gear-small', `url(${GEARS.small.url})`);
  }
  return { S, RAMP, INK, RED, CHALK, PEN, P, C, box, rivet, brassRivet, line, num, numW, gear, gearStrip, star, ingot, clip, bigClip, tagHead, tail, chalkLine, ellipse, lever, sign, post, crate, planks, paperLabel, penLoop, penUnder, penArrow, woodGrain, init, SKIN, GEARS, hash, bay };
})();
