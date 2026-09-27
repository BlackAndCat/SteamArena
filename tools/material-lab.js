// 材质语言 v2 探索（tools/material-lab.html 专用，只做视觉，游戏里仍是 sprites.js 的 decorate）。
// 做法：
//   ① 调色板映射：每种材料为冷铁 5 阶、暗铁 4 阶各给一组低饱和色，逐像素按阶替换（不混色，不生成调色板外的脏色）；
//   ② 做工：反光方式 + 只走一阶、只落在平整内部面的稀疏纹理（每 4×4 至多一个细节）；
//   ③ 紧固件：认出 sprites.js 的 rivet() 图案，换成材料自己的钉子。默认只换每个模块最靠四角的那几颗——
//      位置固定、数量少，新模块只要照常用 rivet() 就自动生效，不需要逐个模块写代码。
// 不发光：按用户意见，以太不再有发光铆钉，全部材料都不发光。
// 每种材料有多套候选调色板（CANDS），页面上挑选；候选由色相 / 饱和度 / 明度曲线生成，高光略往暖、阴影略往冷偏（像素画常用的色相偏移）。
window.SA = window.SA || {};

SA.MATLAB = (() => {
  const P = SA.PAL;
  const rgbOf = (hx) => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hexOf = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const k3 = (r, g, b) => (r << 16) | (g << 8) | b;
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function hsl(h, s, l) {   // h 度，s / l 0~100
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
  }

  // ---------- 源像素分类 ----------
  const SRC = new Map();
  P.dark.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'dark', lv: i }));
  P.iron.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'iron', lv: i }));
  P.rust.forEach((h, i) => SRC.set(k3(...rgbOf(h)), { kind: 'rust', lv: i }));
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

  // ---------- 候选调色板 ----------
  // h 色相、s 饱和度（%）、L 冷铁 5 阶明度（%）、dh 高光往暖偏的度数；spec 反光、tex 纹理、pin 紧固件
  const C = (id, name, desc, h, s, L, o = {}) => ({ id, name, desc, h, s, L, dh: o.dh == null ? 12 : o.dh, spec: o.spec || 'crisp', tex: o.tex || null, pin: o.pin || 'rivet' });
  const CANDS = {
    iron: [C('I1', '熟铁', '暗、暖灰、哑光，锻打麻点（你满意的现状观感，保留）', 40, 4, [12, 19, 29, 39, 50], { spec: 'matte', tex: 'pits', pin: 'rivet' })],
    steel: [
      C('S1', '中性钢', '比原画亮一档的中性灰，锐利亮边，六角螺栓', 215, 6, [15, 25, 40, 57, 80], { pin: 'bolt' }),
      C('S2', '冷灰钢', '略偏冷的钢灰，比原画更亮、更干净', 210, 8, [14, 24, 39, 56, 79], { pin: 'bolt' }),
      C('S3', '炮钢灰', '略暗、偏暖的炮钢灰，厚重', 30, 5, [12, 20, 33, 49, 70], { pin: 'bolt' }),
      C('S4', '拉丝钢', '中性钢加稀疏的横向拉丝（只亮一阶）', 215, 5, [15, 25, 40, 57, 78], { pin: 'bolt', tex: 'brushed' }),
    ],
    nickel: [
      C('N1', '中性银', '最亮的中性银，受光角白点，黄铜花钉', 60, 2, [22, 36, 57, 75, 92], { spec: 'glint', pin: 'brass' }),
      C('N2', '暖银', '带一点暖意的银，像老式镀镍器具', 40, 7, [22, 36, 56, 74, 91], { spec: 'glint', pin: 'brass' }),
      C('N3', '镜铬', '对比更强的冷亮铬，暗色钉', 205, 6, [16, 31, 56, 79, 96], { spec: 'glint', pin: 'dark' }),
      C('N4', '缎面镍', '低对比、柔和的哑光镍，高光不刺眼', 50, 4, [26, 39, 54, 66, 78], { spec: 'soft', pin: 'brass' }),
    ],
    wootz: [
      C('W1', '大马士革灰', '中性暗灰 + 只亮一阶的流水纹，金销钉', 220, 4, [10, 17, 28, 42, 60], { tex: 'watered', pin: 'gold' }),
      C('W2', '回火褐钢', '暗钢里带一点回火的麦秆褐，流水纹', 28, 8, [10, 17, 28, 41, 58], { tex: 'watered', pin: 'gold', dh: 8 }),
      C('W3', '碳黑钢', '接近黑的炭灰，流水纹', 25, 5, [8, 13, 22, 33, 48], { tex: 'watered', pin: 'gold' }),
      C('W4', '青灰锻钢', '冷青灰的暗钢，流水纹', 195, 9, [10, 17, 28, 41, 58], { tex: 'watered', pin: 'gold' }),
    ],
    aether: [
      C('E1', '铂金', '最高明度的冷白铂，低对比，珍珠色钉', 200, 5, [24, 40, 62, 79, 93], { spec: 'soft', pin: 'pearl' }),
      C('E2', '黑金', '近黑的石墨色，亮边一丝香槟金，金钉', 35, 6, [7, 12, 20, 30, 45], { spec: 'champagne', pin: 'gold' }),
      C('E3', '烤蓝钢', '枪械「烤蓝」的深蓝黑 + 金钉，经典的高级枪械涂层', 218, 14, [8, 13, 22, 33, 50], { pin: 'gold', dh: 20 }),
      C('E4', '香槟钛', '温暖的香槟灰，柔和高光，暗色钉', 38, 8, [20, 33, 51, 67, 83], { spec: 'soft', pin: 'dark' }),
      C('E5', '陨铁', '中灰陨铁，表面是只亮一阶的交叉结晶纹（天外之物，但不发光）', 210, 4, [14, 23, 36, 51, 70], { tex: 'meteor', pin: 'dark' }),
      C('E6', '珍珠贝母', '浅暖白，亮边隔几像素泛一点淡粉 / 淡绿的贝母光', 30, 5, [22, 37, 58, 76, 91], { spec: 'pearl', pin: 'pearl' }),
    ],
  };
  for (const list of Object.values(CANDS)) for (const c of list) {
    c.iron = c.L.map((l, i) => hsl(c.h + (i - 2) * c.dh * 0.5, c.s * (i === 4 ? 0.7 : 1), l));
    const dl = [c.L[0] * 0.45, c.L[0] * 0.75, c.L[0] * 1.08, (c.L[0] + c.L[1]) * 0.55];
    c.dark = dl.map((l) => hsl(c.h - c.dh * 0.5, c.s * 0.9, l));
    c.rust = P.rust.map(h => { const x = rgbOf(h), Lx = lum(x); let b = 0; c.iron.forEach((v, i) => { if (Math.abs(lum(v) - Lx) < Math.abs(lum(c.iron[b]) - Lx)) b = i; }); return mix(x, c.iron[b], 0.3); });
    const [r, g, b] = c.iron[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); c.sat = Math.round((mx - mn) / (mx || 1) * 100);
    c.swatch = [...c.iron, ...c.dark].map(hexOf);
  }
  const sel = { iron: 'I1', steel: 'S1', nickel: 'N1', wootz: 'W1', aether: 'E1' };
  let pins = 'corner';   // corner = 只换四角 / all = 全部 / off = 不换
  const pick = (key) => (CANDS[key] || []).find(c => c.id === sel[key]);

  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  const PIN = {   // 2×2 钉头 [左上, 右上, 左下, 右下]
    bolt: (c) => [c.iron[4], c.iron[3], c.iron[3], c.iron[1]],
    brass: () => [P.brass[3], P.brass[2], P.brass[2], P.brass[1]].map(rgbOf),
    gold: () => [P.brass[3], P.brass[1], P.brass[1], P.brass[0]].map(rgbOf),
    pearl: () => ['#f4f1ea', '#d9d4c9', '#d9d4c9', '#aaa497'].map(rgbOf),
    dark: (c) => [c.iron[1], c.iron[0], c.iron[0], c.dark[0]],
  };
  const PIN_NAME = { rivet: '原样圆铆钉', bolt: '六角螺栓', brass: '黄铜花钉', gold: '金销钉', pearl: '珍珠色钉', dark: '暗色钉' };
  const SPEC_NAME = { matte: '哑光', crisp: '锐利亮边', glint: '受光角白点', soft: '柔和', champagne: '香槟金亮边', pearl: '贝母光' };
  const TEX_NAME = { pits: '锻打麻点', watered: '流水纹', brushed: '拉丝', meteor: '交叉结晶纹' };

  function pass(cv, mat, ox, oy, skip = []) {
    const M = pick(mat.key);
    if (!M) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, img = g.getImageData(0, 0, W, H), d = img.data;
    const src = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) {
      if (d[i * 4 + 3] < 8) continue;
      const c = classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (!c) continue;
      const lx = i % W - ox, ly = Math.floor(i / W) - oy;
      if (c.kind === 'dark' && skip.some(([sx, sy, sw, sh]) => lx >= sx && lx < sx + sw && ly >= sy && ly < sy + sh)) continue;   // 炉膛里的煤不是金属
      src[i] = c;
    }
    const isM = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !!src[y * W + x];
    const lvAt = (x, y) => { if (!isM(x, y)) return -1; const c = src[y * W + x]; return c.kind === 'iron' ? c.lv : -1; };
    const out = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) { const c = src[i]; if (c) out[i] = c.kind === 'dark' ? M.dark[c.lv] : c.kind === 'rust' ? M.rust[c.lv] : M.iron[c.lv]; }
    const lvC = (lv) => M.iron[Math.max(0, Math.min(4, lv))];
    const flat = (x, y) => isM(x - 1, y) && isM(x + 1, y) && isM(x, y - 1) && isM(x, y + 1) && isM(x - 1, y - 1) && isM(x + 1, y + 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = src[i]; if (!c || c.kind !== 'iron') continue;
      const lx = x - ox, ly = y - oy;
      const corner = c.lv === 4 && !isM(x, y - 1) && !isM(x - 1, y);
      if (M.spec === 'matte' && c.lv === 4) out[i] = lvC(3);
      else if (M.spec === 'crisp' && corner) out[i] = mix(M.iron[4], [255, 255, 255], 0.45);
      else if (M.spec === 'glint' && corner) out[i] = rgbOf(P.white);
      else if (M.spec === 'soft' && c.lv === 4 && (lx + ly) % 2) out[i] = mix(M.iron[3], M.iron[4], 0.5);
      else if (M.spec === 'champagne' && c.lv === 4) out[i] = mix(M.iron[4], rgbOf('#e8d6a8'), 0.5);
      else if (M.spec === 'pearl' && c.lv === 4) { const p = ((lx * 2 + ly) % 9 + 9) % 9; if (p === 0) out[i] = rgbOf('#f2dfe4'); else if (p === 4) out[i] = rgbOf('#dff0e6'); }
      if (!((c.lv === 2 || c.lv === 3) && flat(x, y))) continue;   // 纹理只在平整面的中间两阶上
      if (M.tex === 'pits') {
        const bx = Math.floor(lx / 4), by = Math.floor(ly / 4), h = hash(bx, by);
        if ((((lx % 4) + 4) % 4) === h % 4 && (((ly % 4) + 4) % 4) === (h >> 2) % 4) out[i] = lvC(c.lv + (h % 5 === 0 ? 1 : -1));
      } else if (M.tex === 'watered') {
        const f = ly * 0.9 + 2.4 * Math.sin(lx * 0.3 + ly * 0.07), fr = ((f / 5) % 1 + 1) % 1;
        if (fr < 0.14) out[i] = lvC(c.lv + 1);
      } else if (M.tex === 'brushed') {
        const h = hash(Math.floor(lx / 6), ly);
        if (h % 5 === 0 && ((lx % 6) + 6) % 6 < 3) out[i] = lvC(c.lv + 1);
      } else if (M.tex === 'meteor') {
        const a = ((lx + ly * 2) % 7 + 7) % 7, b = ((lx * 2 - ly) % 9 + 9) % 9;
        if (a === 0 || b === 0) out[i] = lvC(c.lv + 1);
      }
    }
    // 紧固件：找出 rivet() 图案（2×2 亮 + 中心 iron2 + 右下暗影）；四角模式只取离模块四个角最近的各一颗
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
        for (const cx of [Math.min(...xs), Math.max(...xs)]) for (const cy of [Math.min(...ys), Math.max(...ys)]) {
          let best = 0, bd = 1e9; found.forEach((p, k) => { const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (dd < bd) { bd = dd; best = k; } }); set.add(best);
        }
        use = [...set].map(k => found[k]);
      }
      const col = PIN[M.pin](M);
      for (const [x, y] of use) [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], k) => { out[(y + b) * W + x + a] = col[k]; });
    }
    for (let i = 0; i < W * H; i++) { const c = out[i]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
    g.putImageData(img, 0, 0);
  }
  return { CANDS, sel, pass, pick, PIN_NAME, SPEC_NAME, TEX_NAME, setPins: (m) => { pins = m; }, getPins: () => pins };
})();
