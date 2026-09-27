// 材质语言 v2 · 第三轮：把颜色找回来，但用低饱和和讲究的用法（tools/material-lab.html 专用，只做视觉，游戏里仍是 decorate）。
// 一种材料 = 明度曲线 + 若干「染色手法」的组合，每种手法都可以单独开关、调色相和强度：
//   wash   整体掺色：整条色阶带一点色相（低饱和）
//   split  冷暖分离：暗部一个色相、亮部另一个色相，中间阶保持基调
//   mottle 杂色斑：平整面上零散的小色斑（像氧化、回火、铜绿），按覆盖率控制
//   edge   关键点增色：只给亮边（受光的最亮一阶）上色；hue 为 'iris' 时亮边按位置轮换色相（贝母 / 虹彩）
//   temper 回火色带：钢回火时出现的麦黄 → 褐 → 紫 → 蓝，按斜向宽带轻轻铺在中间几阶
//   trim   饰件换料：黄铜饰件换成紫铜 / 玫瑰金 / 淡金
// 染色一律「保留原像素的明度、只换色相和饱和度」，所以明度结构（形体、光影）不变，也不会混出脏色。
// 紧固件：自动认出 rivet() 画的铆钉，默认只换每个模块四角各一颗（不用逐个模块写代码）。所有材料都不发光。
window.SA = window.SA || {};

SA.MATLAB = (() => {
  const P = SA.PAL;
  const rgbOf = (hx) => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hexOf = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const k3 = (r, g, b) => (r << 16) | (g << 8) | b;
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function hsl(h, s, l) {   // h 度，s / l 0~100 → [r, g, b]
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
  }
  const lightOf = ([r, g, b]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510 * 100;
  const recolor = (c, h, s) => hsl(h, s, lightOf(c));   // 保留明度，只换色相 / 饱和度
  const hueLerp = (a, b, t) => { let d = ((b - a + 540) % 360) - 180; return a + d * t; };

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

  // ---------- 明度基调 ----------
  const TONE = { dark: [9, 15, 25, 38, 55], mid: [14, 24, 38, 54, 75], light: [22, 36, 56, 74, 91], iron: [12, 19, 29, 39, 50] };
  const TRIMS = {
    brass: null,
    copper: ['#4a2014', '#8c4526', '#c26a3e', '#e8a07a'],
    rosegold: ['#4d2a24', '#93594c', '#cf8f7c', '#f0c3b0'],
    palegold: ['#4a4128', '#8c7d4e', '#c9b882', '#eee3bd'],
  };
  const TEMPER = [48, 32, 18, 290, 225, 205];   // 回火色：麦黄、金、褐、紫、蓝、浅蓝

  // 由参数生成完整色阶
  function build(c) {
    c.L = c.L || TONE[c.tone || 'mid'];
    const wash = c.wash || { h: 210, s: 0 }, sp = c.split;
    c.iron = c.L.map((l, i) => {
      let h = wash.h, s = wash.s;
      // 冷暖分离：0~2 阶（暗部和固有色）用暗部色相，3~4 阶（亮侧，装甲这类亮面模块的大面积就在第 3 阶）用亮部色相；两边饱和度可以分开给
      if (sp) { const hs = sp.hs == null ? sp.s : sp.hs; if (i <= 2) { h = sp.sh; s = Math.max(s, sp.s * (i === 2 ? 0.8 : 1)); } else { h = sp.hh; s = Math.max(s, hs * (i === 4 ? 0.8 : 1)); } }
      return hsl(h, i === 4 ? s * 0.8 : s, l);
    });
    const dl = [c.L[0] * 0.45, c.L[0] * 0.75, c.L[0] * 1.08, (c.L[0] + c.L[1]) * 0.55];
    c.dark = dl.map(l => hsl(sp ? sp.sh : wash.h, (sp ? Math.max(wash.s, sp.s) : wash.s) * 0.9, l));
    c.rust = P.rust.map(h => { const x = rgbOf(h), Lx = lum(x); let b = 0; c.iron.forEach((v, i) => { if (Math.abs(lum(v) - Lx) < Math.abs(lum(c.iron[b]) - Lx)) b = i; }); return mix(x, c.iron[b], 0.3); });
    c.trimC = c.trim && TRIMS[c.trim] ? TRIMS[c.trim].map(rgbOf) : null;
    c.swatch = [...c.iron, ...c.dark].map(hexOf);
    c.spec = c.spec || 'crisp'; c.pin = c.pin || 'rivet';
    return c;
  }
  // 候选：id、名字、说明 + 参数
  const K = (id, name, desc, o) => build({ id, name, desc, ...o });
  const CANDS = {
    iron: [K('I1', '熟铁', '暗、暖灰、哑光，锻打麻点（你满意的现状观感，保留）', { L: TONE.iron, wash: { h: 40, s: 4 }, spec: 'matte', tex: 'pits' })],
    steel: [
      K('S1', '淡青钢', '整体掺一点点青：钢灰里透着冷意，六角螺栓', { tone: 'mid', wash: { h: 190, s: 9 }, pin: 'bolt' }),
      K('S2', '青钢 · 青亮边', '底色几乎中性，只有受光的亮边带青', { tone: 'mid', wash: { h: 200, s: 5 }, edge: { h: 188, s: 32 }, pin: 'bolt' }),
      K('S3', '青灰钢 · 青斑', '中性钢上零散几块淡青色斑，像冷却水留下的痕', { tone: 'mid', wash: { h: 205, s: 5 }, mottle: { h: 185, s: 22, cov: 0.16 }, pin: 'bolt' }),
    ],
    nickel: [
      K('N1', '暖银 · 金色高光', '冷暖分离：暗部偏冷蓝灰，亮部偏金，整体仍是银', { tone: 'light', split: { sh: 220, hh: 45, s: 16 }, spec: 'glint', pin: 'brass' }),
      K('N2', '玫瑰镍', '整体掺一点玫瑰粉，像老式镀镍器具泛的暖光', { tone: 'light', wash: { h: 350, s: 11 }, spec: 'glint', pin: 'brass' }),
      K('N3', '翠镍', '整体掺一点点绿（镍矿本来泛绿），高光柔和', { tone: 'light', wash: { h: 150, s: 10 }, spec: 'soft', pin: 'brass' }),
      K('N4', '银 · 铜斑', '近中性的银上零散几块紫铜色斑，饰件换紫铜', { tone: 'light', wash: { h: 40, s: 4 }, mottle: { h: 18, s: 30, cov: 0.14 }, trim: 'copper', spec: 'glint', pin: 'brass' }),
      K('N5', '冷银 · 紫影', '冷暖分离：暗部带一点紫，亮部偏暖白', { tone: 'light', split: { sh: 270, hh: 50, s: 14 }, spec: 'glint', pin: 'brass' }),
    ],
    wootz: [
      K('W1', '回火虹彩', '钢回火时的麦黄 → 褐 → 紫 → 蓝，按斜向宽带淡淡铺开；流水纹', { tone: 'dark', wash: { h: 220, s: 4 }, temper: { s: 20 }, tex: 'watered', pin: 'gold' }),
      K('W2', '牛血暗钢', '整体掺一点暗红（牛血红），流水纹，金销', { tone: 'dark', wash: { h: 355, s: 16 }, tex: 'watered', pin: 'gold' }),
      K('W3', '暗钢 · 铜绿斑', '暗钢上零散的铜绿色斑，像老武器的氧化痕', { tone: 'dark', wash: { h: 30, s: 5 }, mottle: { h: 165, s: 26, cov: 0.18 }, tex: 'watered', pin: 'gold' }),
      K('W4', '琥珀暗钢', '冷暖分离：暗部冷蓝，亮部琥珀橙', { tone: 'dark', split: { sh: 220, hh: 32, s: 22 }, tex: 'watered', pin: 'gold' }),
      K('W5', '暗钢 · 蓝紫回火边', '底色中性暗钢，只有亮边带回火的蓝紫', { tone: 'dark', wash: { h: 220, s: 5 }, edge: { h: 262, s: 38 }, tex: 'watered', pin: 'gold' }),
    ],
    aether: [
      K('E1', '黑金', '近黑的石墨，亮边一道金，饰件换淡金', { L: [7, 12, 20, 30, 45], wash: { h: 35, s: 6 }, edge: { h: 45, s: 55 }, trim: 'palegold', pin: 'gold' }),
      K('E2', '午夜蓝 · 金边', '深午夜蓝（低饱和），亮边金色，金钉', { tone: 'dark', wash: { h: 222, s: 18 }, edge: { h: 45, s: 45 }, pin: 'gold' }),
      K('E3', '翡翠', '整体掺淡翡翠绿，高光柔和，饰件淡金', { tone: 'mid', wash: { h: 155, s: 15 }, spec: 'soft', trim: 'palegold', pin: 'gold' }),
      K('E4', '珍珠虹彩', '浅暖白底，亮边按位置轮换淡淡的虹彩色（贝母光）', { tone: 'light', wash: { h: 30, s: 5 }, edge: { h: 'iris', s: 30 }, pin: 'pearl' }),
      K('E5', '玫瑰铜', '整体掺玫瑰铜色，饰件玫瑰金', { tone: 'mid', wash: { h: 12, s: 16 }, trim: 'rosegold', pin: 'gold' }),
      K('E6', '酒红 · 金边', '暗酒红（低饱和），亮边金色', { tone: 'dark', wash: { h: 345, s: 16 }, edge: { h: 45, s: 45 }, pin: 'gold' }),
      K('E7', '孔雀蓝 · 铜斑', '暗孔雀蓝底，零散紫铜色斑，饰件紫铜', { tone: 'dark', wash: { h: 188, s: 16 }, mottle: { h: 20, s: 30, cov: 0.12 }, trim: 'copper', pin: 'gold' }),
    ],
  };
  const sel = { iron: 'I1', steel: 'S1', nickel: 'N1', wootz: 'W1', aether: 'E1' };
  let pins = 'corner', override = null;
  const pick = (key) => override || (CANDS[key] || []).find(c => c.id === sel[key]);

  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  const rnd = (x, y) => (hash(x, y) % 1000) / 1000;
  // 值噪声：3px 一格，双线性插值（杂色斑用，按模块内坐标取，同一模块每次一样）
  function noise(x, y, cs = 3) {
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs), fx = x / cs - gx, fy = y / cs - gy;
    const a = rnd(gx, gy), b = rnd(gx + 1, gy), c = rnd(gx, gy + 1), d = rnd(gx + 1, gy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  const PIN = {
    bolt: (c) => [c.iron[4], c.iron[3], c.iron[3], c.iron[1]],
    brass: (c) => (c.trimC ? [c.trimC[3], c.trimC[2], c.trimC[2], c.trimC[1]] : [P.brass[3], P.brass[2], P.brass[2], P.brass[1]].map(rgbOf)),
    gold: (c) => (c.trimC ? [c.trimC[3], c.trimC[1], c.trimC[1], c.trimC[0]] : [P.brass[3], P.brass[1], P.brass[1], P.brass[0]].map(rgbOf)),
    pearl: () => ['#f4f1ea', '#d9d4c9', '#d9d4c9', '#aaa497'].map(rgbOf),
    dark: (c) => [c.iron[1], c.iron[0], c.iron[0], c.dark[0]],
  };
  const PIN_NAME = { rivet: '原样圆铆钉', bolt: '六角螺栓', brass: '花钉', gold: '销钉', pearl: '珍珠色钉', dark: '暗色钉' };
  const TRIM_NAME = { brass: '黄铜', copper: '紫铜', rosegold: '玫瑰金', palegold: '淡金' };
  // 手法说明（卡片上的小标签）
  function describe(c) {
    const t = [];
    if (c.wash && c.wash.s) t.push(`掺色 ${Math.round(c.wash.h)}° ${c.wash.s}%`);
    if (c.split) t.push(`冷暖分离 ${c.split.sh}°/${c.split.hh}°`);
    if (c.mottle) t.push(`杂色斑 ${c.mottle.h}° ${Math.round(c.mottle.cov * 100)}%`);
    if (c.edge) t.push(`亮边 ${c.edge.h === 'iris' ? '虹彩' : c.edge.h + '°'}`);
    if (c.temper) t.push('回火色带');
    if (c.trim && c.trim !== 'brass') t.push(`饰件 ${TRIM_NAME[c.trim]}`);
    if (c.tex) t.push({ pits: '麻点', watered: '流水纹', brushed: '拉丝', meteor: '结晶纹' }[c.tex]);
    t.push(PIN_NAME[c.pin]);
    return t.join(' · ');
  }

  function pass(cv, mat, ox, oy, skip = []) {
    const M = pick(mat.key);
    if (!M) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, img = g.getImageData(0, 0, W, H), d = img.data;
    const src = new Array(W * H).fill(null), brass = new Int8Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) {
      if (d[i * 4 + 3] < 8) continue;
      const kk = k3(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (M.trimC && BRASS.has(kk)) { brass[i] = BRASS.get(kk); continue; }
      const c = classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (!c) continue;
      const lx = i % W - ox, ly = Math.floor(i / W) - oy;
      if (c.kind === 'dark' && skip.some(([sx, sy, sw, sh]) => lx >= sx && lx < sx + sw && ly >= sy && ly < sy + sh)) continue;
      src[i] = c;
    }
    const isM = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !!src[y * W + x];
    const lvAt = (x, y) => { if (!isM(x, y)) return -1; const c = src[y * W + x]; return c.kind === 'iron' ? c.lv : -1; };
    const out = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) {
      const c = src[i];
      if (c) out[i] = c.kind === 'dark' ? M.dark[c.lv] : c.kind === 'rust' ? M.rust[c.lv] : M.iron[c.lv];
      else if (brass[i] >= 0) out[i] = M.trimC[brass[i]];
    }
    const lvC = (lv) => M.iron[Math.max(0, Math.min(4, lv))];
    const flat = (x, y) => isM(x - 1, y) && isM(x + 1, y) && isM(x, y - 1) && isM(x, y + 1) && isM(x - 1, y - 1) && isM(x + 1, y + 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = src[i]; if (!c || c.kind !== 'iron') continue;
      const lx = x - ox, ly = y - oy, fl = flat(x, y);
      // 反光
      const corner = c.lv === 4 && !isM(x, y - 1) && !isM(x - 1, y);
      if (M.spec === 'matte' && c.lv === 4) out[i] = lvC(3);
      else if (M.spec === 'crisp' && corner) out[i] = mix(M.iron[4], [255, 255, 255], 0.45);
      else if (M.spec === 'glint' && corner) out[i] = rgbOf(P.white);
      else if (M.spec === 'soft' && c.lv === 4 && (lx + ly) % 2) out[i] = mix(M.iron[3], M.iron[4], 0.5);
      // 纹理：只在平整面的中间两阶，只动一阶
      if (fl && (c.lv === 2 || c.lv === 3)) {
        if (M.tex === 'pits') {
          const bx = Math.floor(lx / 4), by = Math.floor(ly / 4), h = hash(bx, by);
          if ((((lx % 4) + 4) % 4) === h % 4 && (((ly % 4) + 4) % 4) === (h >> 2) % 4) out[i] = lvC(c.lv + (h % 5 === 0 ? 1 : -1));
        } else if (M.tex === 'watered') {
          const f = ly * 0.9 + 2.4 * Math.sin(lx * 0.3 + ly * 0.07), fr = ((f / 5) % 1 + 1) % 1;
          if (fr < 0.14) out[i] = lvC(c.lv + 1);
        } else if (M.tex === 'brushed') {
          const h = hash(Math.floor(lx / 6), ly); if (h % 5 === 0 && ((lx % 6) + 6) % 6 < 3) out[i] = lvC(c.lv + 1);
        } else if (M.tex === 'meteor') {
          const a = ((lx + ly * 2) % 7 + 7) % 7, b = ((lx * 2 - ly) % 9 + 9) % 9; if (a === 0 || b === 0) out[i] = lvC(c.lv + 1);
        }
      }
      // 回火色带：中间三阶，斜向宽带，保留明度只换色相
      if (M.temper && c.lv >= 1 && c.lv <= 3) {
        const t = ((ly + lx * 0.35) / 11 % TEMPER.length + TEMPER.length) % TEMPER.length, a = Math.floor(t), f = t - a;
        out[i] = recolor(out[i], hueLerp(TEMPER[a], TEMPER[(a + 1) % TEMPER.length], f), M.temper.s);
      }
      // 杂色斑：平整面上，值噪声超过阈值的地方染色
      if (M.mottle && c.lv >= 1 && c.lv <= 3 && fl && noise(lx + 17, ly + 5) > 1 - M.mottle.cov * 1.9) out[i] = recolor(out[i], M.mottle.h, M.mottle.s);
      // 关键点增色：只染亮边
      if (M.edge && c.lv === 4) out[i] = recolor(out[i], M.edge.h === 'iris' ? ((lx + ly) * 23 % 360 + 360) % 360 : M.edge.h, M.edge.s);
    }
    // 紧固件
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
  return {
    CANDS, TONE, TRIMS, TRIM_NAME, sel, pass, pick, build, describe,
    setPins: (m) => { pins = m; }, getPins: () => pins,
    setOverride: (c) => { override = c || null; },
  };
})();
