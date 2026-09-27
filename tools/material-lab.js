// 材质语言 v2 · 第四轮（tools/material-lab.html 专用，只做视觉，游戏里仍是 decorate）。
// 上一轮的反馈：乌兹钢的晕染和彩色「油星」显得廉价；杂色脏；亮边染色看不出来；暗部 / 亮部染色分不出区别。
// 这一轮换成区分度更强、也更「维多利亚机器」的手法：
//   wash   金属本色：整条色阶带一点色相（低饱和，保留）
//   paint  漆面：模块的大面（固有色和亮侧两阶）刷一层深色瓷漆，受光的亮边和暗部斜面仍是金属——像蒸汽机车的涂装，漆色 + 金属边，一眼分得开
//   line   描线：离模块外沿 3 像素处一道 1 像素细线（金 / 奶白 / 朱红 / 黑），维多利亚机车的面板饰线；自动算出来，不用逐个模块画
//   tex    只改明度（一阶）的精细纹理：细大马士革、机刻纹（钟表上的扭索纹）、花纹板、珍珠纹、拉丝、锻打麻点——不带颜色，所以不会「油」
//   trim   饰件换料：黄铜饰件换紫铜 / 玫瑰金 / 淡金
// 染色一律保留原像素明度、只换色相和饱和度；漆面按金属原来的明度换成漆的明度。紧固件默认只换四角。都不发光。
window.SA = window.SA || {};

SA.MATLAB = (() => {
  const P = SA.PAL;
  const rgbOf = (hx) => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hexOf = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const k3 = (r, g, b) => (r << 16) | (g << 8) | b;
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
  }

  // ---------- 源像素分类 ----------
  const SRC = new Map();
  P.dark.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'dark', lv: i }));
  P.iron.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'iron', lv: i }));
  P.rust.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'rust', lv: i }));
  const BRASS = new Map(P.brass.map((h, i) => [k3(...rgbOf(h)), i]));
  const KEEP = new Set();
  for (const h of [...P.brass, ...P.fire, ...P.water, ...P.gauge, ...P.glass, ...P.steam, ...P.leather, ...P.bg, P.white, P.black, P.magenta]) KEEP.add(k3(...rgbOf(h)));
  const IRON_L = P.iron.map(h => lum(rgbOf(h)));
  function classify(r, g, b) {
    const k = k3(r, g, b);
    if (SRC.has(k)) return SRC.get(k);
    if (KEEP.has(k)) return null;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0 || (mx - mn) / mx >= 0.28) return null;
    const L = lum([r, g, b]); let best = 0;
    IRON_L.forEach((v, i) => { if (Math.abs(v - L) < Math.abs(IRON_L[best] - L)) best = i; });
    return { kind: 'iron', lv: best };
  }

  // ---------- 预设 ----------
  const TONE = { dark: [9, 15, 25, 38, 55], mid: [14, 24, 38, 54, 75], light: [22, 36, 56, 74, 91], iron: [12, 19, 29, 39, 50] };
  const TRIMS = { brass: null, iron: [P.iron[0], P.iron[2], P.iron[3], P.iron[4]], copper: ['#4a2014', '#8c4526', '#c26a3e', '#e8a07a'], rosegold: ['#4d2a24', '#93594c', '#cf8f7c', '#f0c3b0'], palegold: ['#4a4128', '#8c7d4e', '#c9b882', '#eee3bd'] };
  const TRIM_NAME = { brass: '黄铜', iron: '冷铁', copper: '紫铜', rosegold: '玫瑰金', palegold: '淡金' };
  // 维多利亚瓷漆：h 色相、s 饱和度、k 相对金属明度的深浅（< 1 更深）
  const PAINTS = {
    crimson: { name: '深红（米德兰）', h: 352, s: 42, k: 0.72 },
    ochre: { name: '赭橙', h: 20, s: 42, k: 0.78 },
    mustard: { name: '芥黄', h: 42, s: 38, k: 0.86 },
    brunswick: { name: '布伦瑞克绿', h: 150, s: 30, k: 0.62 },
    teal: { name: '孔雀青', h: 186, s: 30, k: 0.66 },
    navy: { name: '海军蓝', h: 222, s: 34, k: 0.62 },
    plum: { name: '李紫', h: 320, s: 22, k: 0.58 },
    black: { name: '黑漆', h: 220, s: 8, k: 0.38 },
    ivory: { name: '象牙白', h: 45, s: 24, k: 1.3 },
  };
  const LINES = { gold: ['金', '#d9a441'], cream: ['奶白', '#e8dcb8'], red: ['朱红', '#b04a32'], white: ['银白', '#dfe3e8'], black: ['黑', '#15161a'] };
  const TEX_NAME = { pits: '锻打麻点', damascus: '细大马士革', guilloche: '机刻纹', checker: '花纹板', perlage: '珍珠纹', brushed: '拉丝' };
  const PIN_NAME = { rivet: '原样铆钉', bolt: '六角螺栓', brass: '花钉', gold: '销钉', pearl: '珍珠色钉', dark: '暗色钉' };

  function build(c) {
    c.L = c.L || TONE[c.tone || 'mid'];
    const w = c.wash || { h: 210, s: 0 };
    c.iron = c.ramp ? c.ramp.map(rgbOf) : c.L.map((l, i) => hsl(w.h, i === 4 ? w.s * 0.8 : w.s, l));
    const dl = [c.L[0] * 0.45, c.L[0] * 0.75, c.L[0] * 1.08, (c.L[0] + c.L[1]) * 0.55];
    c.dark = c.ramp ? [mix(c.iron[0], [0, 0, 0], 0.55), mix(c.iron[0], [0, 0, 0], 0.3), c.iron[0], mix(c.iron[0], c.iron[1], 0.5)] : dl.map(l => hsl(w.h, w.s * 0.9, l));
    c.hiC = c.hi ? rgbOf(c.hi) : null;
    c.rust = P.rust.map(h => { const x = rgbOf(h), Lx = lum(x); let b = 0; c.iron.forEach((v, i) => { if (Math.abs(lum(v) - Lx) < Math.abs(lum(c.iron[b]) - Lx)) b = i; }); return mix(x, c.iron[b], 0.3); });
    if (c.paint) { const p = typeof c.paint === 'string' ? PAINTS[c.paint] : c.paint; c.paintC = c.L.map(l => hsl(p.h, p.s, Math.min(92, l * p.k))); }
    else c.paintC = null;
    c.lineC = c.line ? rgbOf(LINES[c.line] ? LINES[c.line][1] : c.line) : null;   // line 可以是预设名，也可以直接给色值
    c.rimC = c.rim ? [P.brass[1], P.brass[3]].map(rgbOf) : null;   // rim：亮边直接换成黄铜（包边）
    c.trimC = c.trim && TRIMS[c.trim] ? TRIMS[c.trim].map(rgbOf) : null;
    c.spec = c.spec || 'crisp'; c.pin = c.pin || 'rivet';
    c.swatch = [...c.iron, ...(c.paintC ? c.paintC.slice(1, 4) : [])].map(hexOf);
    return c;
  }
  const K = (id, name, desc, o) => build({ id, name, desc, ...o });
  // 层级思路：T3 钢 = 金属本色；T4 镀镍 = 亮 + 精加工纹理；T5 乌兹钢 = 暗 + 细纹或开始上漆；T6 以太 = 整套漆面涂装 + 描线
  const CANDS = {
    iron: [K('I1', '熟铁', '暗、暖灰、哑光，锻打麻点（保留）', { L: TONE.iron, wash: { h: 40, s: 4 }, spec: 'matte', tex: 'pits' })],
    steel: [
      K('S1', '淡青钢', '整体掺一点点青，干净，六角螺栓', { tone: 'mid', wash: { h: 190, s: 9 }, pin: 'bolt' }),
      K('S2', '淡青钢 · 花纹板', '淡青钢加一层只改明度的菱形防滑纹，工业味', { tone: 'mid', wash: { h: 190, s: 8 }, tex: 'checker', pin: 'bolt' }),
      K('S3', '淡青钢 · 银白描线', '淡青钢，面板里一道银白细线', { tone: 'mid', wash: { h: 190, s: 9 }, line: 'white', pin: 'bolt' }),
    ],
    nickel: [
      K('N1', '亮银 · 机刻纹', '最亮的银，大面上一圈圈只改明度的扭索纹（钟表机芯那种），黄铜花钉', { tone: 'light', wash: { h: 40, s: 5 }, tex: 'guilloche', spec: 'glint', pin: 'brass' }),
      K('N2', '亮银 · 珍珠纹', '亮银，大面上细密的小圆涡纹（高级机芯的珍珠纹）', { tone: 'light', wash: { h: 40, s: 5 }, tex: 'perlage', spec: 'glint', pin: 'brass' }),
      K('N3', '亮银 · 金描线', '亮银，面板里一道金色细线，花钉', { tone: 'light', wash: { h: 40, s: 5 }, line: 'gold', spec: 'glint', pin: 'brass' }),
      K('N4', '暖银 · 深红漆', '大面刷深红瓷漆，亮边是银——漆色和金属对比最强', { tone: 'light', wash: { h: 40, s: 5 }, paint: 'crimson', spec: 'glint', pin: 'brass' }),
    ],
    wootz: [
      K('W1', '暗钢 · 细大马士革', '中性暗钢，只改明度的细密折叠纹，不带任何颜色', { tone: 'dark', wash: { h: 215, s: 4 }, tex: 'damascus', pin: 'gold' }),
      K('W2', '炭钢 · 金描线', '接近黑的炭钢，面板里一道金线，金销', { tone: 'dark', wash: { h: 30, s: 4 }, line: 'gold', pin: 'gold' }),
      K('W3', '暗钢 · 布伦瑞克绿漆', '大面刷深绿瓷漆（英国机车的布伦瑞克绿），暗钢边', { tone: 'dark', wash: { h: 215, s: 4 }, paint: 'brunswick', pin: 'gold' }),
      K('W4', '暗钢 · 大马士革 + 朱红描线', '细大马士革纹，再加一道朱红细线', { tone: 'dark', wash: { h: 215, s: 4 }, tex: 'damascus', line: 'red', pin: 'gold' }),
    ],
    aether: [
      K('E1', '黑漆 · 金描线', '整车黑色瓷漆 + 金色描线 + 淡金饰件——维多利亚最经典的高级涂装', { tone: 'mid', wash: { h: 220, s: 4 }, paint: 'black', line: 'gold', trim: 'palegold', pin: 'gold' }),
      K('E2', '海军蓝漆 · 金描线', '深海军蓝瓷漆 + 金色描线', { tone: 'mid', wash: { h: 220, s: 4 }, paint: 'navy', line: 'gold', pin: 'gold' }),
      K('E3', '象牙白漆 · 金描线', '象牙白瓷漆 + 金色描线 + 淡金饰件，最亮、最「礼仪」', { tone: 'mid', wash: { h: 40, s: 4 }, paint: 'ivory', line: 'gold', trim: 'palegold', pin: 'gold' }),
      K('E4', '深红漆 · 奶白描线', '米德兰深红瓷漆 + 奶白描线', { tone: 'mid', wash: { h: 220, s: 4 }, paint: 'crimson', line: 'cream', pin: 'gold' }),
      K('E5', '孔雀青漆 · 铜描线', '孔雀青瓷漆 + 紫铜饰件', { tone: 'mid', wash: { h: 220, s: 4 }, paint: 'teal', line: 'cream', trim: 'copper', pin: 'gold' }),
      K('E6', '铂银 · 机刻纹 + 金描线', '不上漆：亮铂银 + 机刻纹 + 金描线，金属本身做到最精', { tone: 'light', wash: { h: 210, s: 4 }, tex: 'guilloche', line: 'gold', spec: 'soft', pin: 'gold' }),
    ],
  };
  // ---------- 定稿（2026-09-27 用户选定）----------
  const FINAL = {
    iron: CANDS.iron[0],
    steel: K('S定', '淡青钢 · 花纹板', '淡青钢 + 放稀的花纹板（8px 一格），六角螺栓', { tone: 'mid', wash: { h: 190, s: 8 }, tex: 'checker', pin: 'bolt' }),
    nickel: K('N定', '象牙白漆 · 金描线', '象牙白瓷漆 + 金色描线 + 淡金饰件', { tone: 'mid', wash: { h: 40, s: 4 }, paint: 'ivory', line: 'gold', trim: 'palegold', pin: 'gold' }),
    wootz: K('W定', '布伦瑞克绿漆', '暗钢边 + 布伦瑞克绿瓷漆，金销', { tone: 'dark', wash: { h: 215, s: 4 }, paint: 'brunswick', pin: 'gold' }),
    aether: K('E定', '海军蓝漆 · 象牙白描线', '海军蓝瓷漆 + 象牙白（奶白）描线，金钉', { tone: 'mid', wash: { h: 220, s: 4 }, paint: 'navy', line: 'cream', pin: 'gold' }),
  };
  for (const k of ['steel', 'nickel', 'wootz', 'aether']) CANDS[k].unshift(FINAL[k]);
  // ---------- 黄铜（T1）：最初的零件，要有自己的语言 ----------
  // 色阶取自 Lospec 上常用的成熟像素调色板（冷铁 0～4 阶依次替换成下面 5 色，hi 是受光角的高光）：
  //   AAP-64（Adigun A. Polack）、Apollo（AdamCYounis）、Endesga 64（ENDESGA）、Resurrect 64（Kerrie Lake）
  // 共同点：色相随明度偏移——暗部红褐 / 紫褐，中间调铜橙，亮部黄金，高光奶黄。这正是「铜味」的来源。
  CANDS.brass = [
    K('B1', '现状原画', '冷蓝铁 + 黄铜饰件（游戏里现在的 T1）', { orig: true }),
    K('C1', 'AAP-64 黄铜', 'Adigun Polack 的 AAP-64 调色板里的黄铜色阶：暗部红褐、亮部金黄，最经典的像素黄铜', { ramp: ['#322b28', '#71413b', '#bb7547', '#dba463', '#f4d29c'], hi: '#fef3c0', spec: 'shine' }),
    K('C2', 'Apollo 黄铜', 'AdamCYounis 的 Apollo 调色板：更深、更偏红的黄铜，暗部带紫褐', { ramp: ['#341c27', '#602c2c', '#884b2b', '#be772b', '#de9e41'], hi: '#e8c170', spec: 'shine' }),
    K('C3', 'Endesga 64 紫铜', 'ENDESGA 的 Endesga 64：偏粉橙的紫铜色阶，比黄铜更「红铜」', { ramp: ['#391f21', '#5d2c28', '#8a4836', '#bf6f4a', '#e69c69'], hi: '#f6ca9f', spec: 'shine' }),
    K('C4', 'AAP-64 旧黄铜', 'AAP-64 里去饱和的旧黄铜 / 卡其色阶：像用久了的黄铜，最克制', { ramp: ['#423934', '#5a4e44', '#796755', '#a08662', '#c7b08b'], hi: '#e4d2aa', spec: 'soft' }),
    K('C5', 'Apollo 青铜', 'Apollo 里低饱和的青铜 / 皮革色阶：偏暗的古铜', { ramp: ['#4d2b32', '#7a4841', '#ad7757', '#c09473', '#d7b594'], hi: '#e7d5b3', spec: 'shine' }),
    K('C6', 'AAP-64 黄铜 · 铁箍', '同 C1 的黄铜身，但黄铜饰件反过来换成冷铁（铜身铁箍），饰件和机身拉开', { ramp: ['#322b28', '#71413b', '#bb7547', '#dba463', '#f4d29c'], hi: '#fef3c0', spec: 'shine', trim: 'iron' }),
    K('C7', 'Resurrect 64 亮铜（偏艳，作对照）', 'Kerrie Lake 的 Resurrect 64：最亮、最饱和的铜金色阶，放在这里看「太艳」的边界在哪', { ramp: ['#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954'], hi: '#fbff86', spec: 'shine' }),
  ];
  const sel = { brass: 'B1', iron: 'I1', steel: 'S定', nickel: 'N定', wootz: 'W定', aether: 'E定' };
  let pins = 'corner', override = null;
  const pick = (key) => override || (CANDS[key] || []).find(c => c.id === sel[key]);

  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  const PIN = {
    bolt: (c) => [c.iron[4], c.iron[3], c.iron[3], c.iron[1]],
    brass: (c) => (c.trimC ? [c.trimC[3], c.trimC[2], c.trimC[2], c.trimC[1]] : [P.brass[3], P.brass[2], P.brass[2], P.brass[1]].map(rgbOf)),
    gold: (c) => (c.trimC ? [c.trimC[3], c.trimC[1], c.trimC[1], c.trimC[0]] : [P.brass[3], P.brass[1], P.brass[1], P.brass[0]].map(rgbOf)),
    pearl: () => ['#f4f1ea', '#d9d4c9', '#d9d4c9', '#aaa497'].map(rgbOf),
    dark: (c) => [c.iron[1], c.iron[0], c.iron[0], c.dark[0]],
  };
  function describe(c) {
    const t = [];
    if (c.wash && c.wash.s) t.push(`本色 ${Math.round(c.wash.h)}° ${c.wash.s}%`);
    if (c.paint) t.push(`漆面 ${typeof c.paint === 'string' ? PAINTS[c.paint].name : c.paint.h + '°'}`);
    if (c.line) t.push(`${LINES[c.line] ? LINES[c.line][0] : '自定色'}描线`);
    if (c.tex) t.push(TEX_NAME[c.tex]);
    if (c.trim && c.trim !== 'brass') t.push(`饰件 ${TRIM_NAME[c.trim]}`);
    t.push(PIN_NAME[c.pin]);
    return t.join(' · ');
  }

  // 只改明度的纹理：返回 -1 / 0 / +1
  function texAt(tex, lx, ly, cx, cy) {
    switch (tex) {
      case 'pits': { const h = hash(Math.floor(lx / 4), Math.floor(ly / 4)); return (((lx % 4) + 4) % 4) === h % 4 && (((ly % 4) + 4) % 4) === (h >> 2) % 4 ? (h % 5 === 0 ? 1 : -1) : 0; }
      case 'damascus': { const f = ly + 1.6 * Math.sin(lx * 0.3 + ly * 0.1), fr = ((f / 5) % 1 + 1) % 1; return fr < 0.16 && (hash(lx, ly) % 4) ? 1 : 0; }   // 5px 一道、断续的细线
      case 'guilloche': { const dx = lx - cx, dy = ly - cy, r = Math.sqrt(dx * dx + dy * dy) + 0.7 * Math.sin(Math.atan2(dy, dx) * 8); return ((r / 5) % 1 + 1) % 1 < 0.2 ? 1 : 0; }   // 5px 一圈的同心扭索纹
      case 'checker': { const u = ((lx % 8) + 8) % 8, v = ((ly % 8) + 8) % 8, alt = (Math.floor(lx / 8) + Math.floor(ly / 8)) % 2; return (alt ? (u === v && (u === 3 || u === 4)) : (u + v === 7 && (u === 3 || u === 4))) ? 1 : 0; }   // 8px 一格、每格一道 2px 斜纹（用户嫌 6px 太密）
      case 'perlage': { const gx = Math.floor(lx / 5), gy = Math.floor(ly / 5), ox = (gy % 2) * 2.5; const ccx = gx * 5 + 2.5 + ox, ccy = gy * 5 + 2.5; const d = Math.hypot(lx + 0.5 - ccx, ly + 0.5 - ccy); return d > 2.2 && d < 3.2 && (lx + 0.5 - ccx) + (ly + 0.5 - ccy) < 0 ? 1 : 0; }
      case 'brushed': { const h = hash(Math.floor(lx / 6), ly); return h % 5 === 0 && ((lx % 6) + 6) % 6 < 3 ? 1 : 0; }
    }
    return 0;
  }

  function pass(cv, mat, ox, oy, skip = []) {
    const M = pick(mat.key);
    if (!M || M.orig) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, img = g.getImageData(0, 0, W, H), d = img.data;
    const src = new Array(W * H).fill(null), brass = new Int8Array(W * H).fill(-1);
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let i = 0; i < W * H; i++) {
      if (d[i * 4 + 3] < 8) continue;
      const kk = k3(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (M.trimC && BRASS.has(kk)) { brass[i] = BRASS.get(kk); continue; }
      const c = classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (!c) continue;
      const x = i % W, y = Math.floor(i / W), lx = x - ox, ly = y - oy;
      if (c.kind === 'dark' && skip.some(([sx, sy, sw, sh]) => lx >= sx && lx < sx + sw && ly >= sy && ly < sy + sh)) continue;
      src[i] = c;
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
    const isM = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !!src[y * W + x];
    const lvAt = (x, y) => { if (!isM(x, y)) return -1; const c = src[y * W + x]; return c.kind === 'iron' ? c.lv : -1; };
    const out = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) {
      const c = src[i];
      if (c) out[i] = c.kind === 'dark' ? M.dark[c.lv] : c.kind === 'rust' ? M.rust[c.lv] : M.iron[c.lv];
      else if (brass[i] >= 0) out[i] = M.trimC[brass[i]];
    }
    // 离非金属的距离（4 邻域，最多算到 5）：描线用
    const dist = new Uint8Array(W * H);
    if (M.lineC) {
      const q = [];
      for (let i = 0; i < W * H; i++) { if (!src[i] || src[i].kind !== 'iron') { dist[i] = 0; } else { dist[i] = 255; } }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (dist[i] === 0) continue; if (!isM(x - 1, y) || !isM(x + 1, y) || !isM(x, y - 1) || !isM(x, y + 1)) { dist[i] = 1; q.push(i); } }
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % W, y = Math.floor(i / W); if (dist[i] >= 5) continue;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (dist[j] === 255) { dist[j] = dist[i] + 1; q.push(j); } }
      }
    }
    const lvC = (lv) => M.iron[Math.max(0, Math.min(4, lv))];
    const flat = (x, y) => isM(x - 1, y) && isM(x + 1, y) && isM(x, y - 1) && isM(x, y + 1) && isM(x - 1, y - 1) && isM(x + 1, y + 1);
    const cx = (bx0 + bx1) / 2 - ox, cy = (by0 + by1) / 2 - oy;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = src[i]; if (!c || c.kind !== 'iron') continue;
      const lx = x - ox, ly = y - oy, face = c.lv === 2 || c.lv === 3, fl = flat(x, y);
      const corner = c.lv === 4 && !isM(x, y - 1) && !isM(x - 1, y);
      if (M.rimC && c.lv === 4) { out[i] = M.rimC[corner ? 1 : 0]; continue; }
      if (M.spec === 'matte' && c.lv === 4) out[i] = lvC(3);
      else if (M.spec === 'crisp' && corner) out[i] = mix(M.iron[4], [255, 255, 255], 0.45);
      else if (M.spec === 'glint' && corner) out[i] = rgbOf(P.white);
      else if (M.spec === 'soft' && c.lv === 4 && (lx + ly) % 2) out[i] = mix(M.iron[3], M.iron[4], 0.5);
      else if (M.spec === 'shine' && corner) out[i] = M.hiC || rgbOf(P.white);
      if (M.paintC && face) {
        out[i] = M.paintC[c.lv];
      } else if (M.tex && face && fl) {
        const t = texAt(M.tex, lx, ly, cx, cy); if (t) out[i] = lvC(c.lv + t);
      }
      if (M.lineC && face && dist[i] === 3 && fl) out[i] = M.lineC;
    }
    if (pins !== 'off' && PIN[M.pin]) {
      const found = [];
      for (let y = 0; y < H - 2; y++) for (let x = 0; x < W - 2; x++) {
        const a = lvAt(x, y);
        if (a < 3 || lvAt(x + 1, y) !== a || lvAt(x, y + 1) !== a || lvAt(x + 1, y + 1) !== 2 || lvAt(x + 2, y + 1) !== 0) continue;
        found.push([x, y]);
      }
      let use = found;
      if (pins === 'corner' && found.length > 4) {
        const xs = found.map(p => p[0]), ys = found.map(p => p[1]), set = new Set();
        for (const ax of [Math.min(...xs), Math.max(...xs)]) for (const ay of [Math.min(...ys), Math.max(...ys)]) {
          let best = 0, bd = 1e9; found.forEach((p, k) => { const dd = (p[0] - ax) ** 2 + (p[1] - ay) ** 2; if (dd < bd) { bd = dd; best = k; } }); set.add(best);
        }
        use = [...set].map(k => found[k]);
      }
      const col = PIN[M.pin](M);
      for (const [x, y] of use) [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], k) => { out[(y + b) * W + x + a] = col[k]; });
    }
    for (let i = 0; i < W * H; i++) { const c = out[i]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
    g.putImageData(img, 0, 0);
  }
  return {
    CANDS, FINAL, TONE, TRIMS, TRIM_NAME, PAINTS, LINES, TEX_NAME, PIN_NAME, sel, pass, pick, build, describe,
    setPins: (m) => { pins = m; }, getPins: () => pins, setOverride: (c) => { override = c || null; },
  };
})();
