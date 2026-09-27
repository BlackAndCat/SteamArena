// 材质语言 v2 探索（tools/material-lab.html 专用，只做视觉，游戏里仍是 sprites.js 的 decorate）。
// 思路：不再「整体染色 + 满铺纹样」，而是
//   ① 调色板映射：每种材料为冷铁 5 阶、暗铁 4 阶各配一组手挑的低饱和色，逐像素按阶映射（不混色，不产生调色板外的脏色）；
//   ② 做工：材料特色只放在「反光方式」和「一阶以内、稀疏的表面细节」上，每 4×4 最多一个细节，只落在平整的内部面；
//   ③ 点缀件：铆钉换成各材料自己的紧固件（螺栓、金销、发光铆钉）——面积小、位置固定、一眼可辨。
// 方案 A = ①；B = ① + ②；C = ① + ② + ③（含以太铆钉脉动、镀镍沿高光边扫过的反光）。
window.SA = window.SA || {};

SA.MATLAB = (() => {
  const P = SA.PAL;
  const rgbOf = (hx) => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const k3 = (r, g, b) => (r << 16) | (g << 8) | b;
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // 源像素分类：暗铁 0~3、冷铁 0~4、锈钢 0~3
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
    if (mx === 0 || (mx - mn) / mx >= 0.28) return null;   // 有颜色的（驾驶员、旋转边缘上的彩色）保留
    const L = lum([r, g, b]); let best = 0;
    IRON_L.forEach((v, i) => { if (Math.abs(v - L) < Math.abs(IRON_L[best] - L)) best = i; });
    return { kind: 'iron', lv: best };
  }

  // ---------- 材料：手挑的低饱和色阶（暗铁 4 阶 + 冷铁 5 阶）+ 做工 ----------
  // sat：冷铁固有色（第 2 阶）的饱和度，给页面上标注用
  const MATS = {
    iron: {
      name: '熟铁', look: '暗、暖灰、哑光', spec: '几乎不反光：亮面只比固有色高一阶', tex: '锻打麻点（每 4×4 至多一个，暗一阶；偶尔一个亮屑）', stud: '原样的圆铆钉',
      dark: ['#0c0c0e', '#17171a', '#242427', '#333336'], iron: ['#1c1c20', '#2d2e33', '#45464c', '#606168', '#7f8087'],
    },
    steel: {
      name: '钢', look: '比原画亮一档的中性灰、对比强、干净', spec: '亮边锐利，受光角一个冷白点', tex: '无——「干净」本身就是钢的特征', stud: '六角螺栓（中心压暗）',
      dark: ['#0e1013', '#191c21', '#272b31', '#383d45'], iron: ['#23272d', '#3a4048', '#5f6670', '#8c939c', '#c9ced4'],
    },
    nickel: {
      name: '镀镍', look: '最亮、近中性的银、低对比', spec: '亮面接近白，受光角白色闪点；方案 C 里一道反光沿亮边慢慢扫过', tex: '无', stud: '黄铜花钉（镍配铜，维多利亚常见搭配）',
      dark: ['#181818', '#262625', '#373735', '#4b4b48'], iron: ['#373736', '#5d5d5a', '#939390', '#c1c1bc', '#eeeeea'],
    },
    wootz: {
      name: '乌兹钢', look: '暗、冷灰略带紫', spec: '中等', tex: '流水纹：只在平整内部面、只亮一阶的细波纹', stud: '金销钉',
      dark: ['#0d0b12', '#18151f', '#25212e', '#36303f'], iron: ['#1c1826', '#2f293b', '#4a4258', '#6c637a', '#978ea6'],
    },
    aether: {
      name: '以太合金', look: '暗枪灰、略带青', spec: '亮边带一丝青（轮廓光）', tex: '无', stud: '青色发光铆钉（全车唯一的非炉火光，只在铆钉上；方案 C 里慢慢呼吸）',
      dark: ['#0a0f10', '#141b1c', '#202a2b', '#2e3a3b'], iron: ['#182122', '#283536', '#3f5051', '#5f7475', '#91a8a7'],
      glow: ['#2fb8aa', '#6ff0df', '#c9fff7'],
    },
  };
  // 锈钢（撞击件）：保留锈色语义，按明度往材料色阶靠一半
  for (const m of Object.values(MATS)) {
    const ir = m.iron.map(rgbOf), il = ir.map(lum);
    m.rust = P.rust.map(h => { const c = rgbOf(h), L = lum(c); let b = 0; il.forEach((v, i) => { if (Math.abs(v - L) < Math.abs(il[b] - L)) b = i; }); return mix(c, ir[b], 0.3); });
    m.darkC = m.dark.map(rgbOf); m.ironC = ir;
    const [r, g, b] = ir[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); m.sat = Math.round((mx - mn) / (mx || 1) * 100);
  }

  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  let frame = 0, tint = 1;   // tint：冷暖倾向强度（0 = 纯灰，1 = 定义值，2 = 加倍）
  const tinted = (c) => { if (tint === 1) return c; const L = lum(c); return c.map(v => Math.max(0, Math.min(255, Math.round(L + (v - L) * tint)))); };

  // 生成一个可以挂到 SA.SPR.setMatPass 的处理函数（签名同 decorate）
  function makePass(scheme) {
    return function pass(cv, mat, ox, oy, skip = []) {
      const M = MATS[mat.key];
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
      const lvAt = (x, y) => { const c = src[y * W + x]; return c && c.kind === 'iron' ? c.lv : -1; };
      const out = new Array(W * H).fill(null);
      const put = (i, c) => { out[i] = c; };
      // ① 调色板映射
      for (let i = 0; i < W * H; i++) {
        const c = src[i]; if (!c) continue;
        put(i, tinted(c.kind === 'dark' ? M.darkC[c.lv] : c.kind === 'rust' ? M.rust[c.lv] : M.ironC[c.lv]));
      }
      if (scheme === 'A') return write();
      // ② 做工
      const shift = (i, c, dl) => { if (c.kind !== 'iron') return; const lv = Math.max(0, Math.min(4, c.lv + dl)); put(i, tinted(M.ironC[lv])); };
      const flat = (x, y) => isM(x - 1, y) && isM(x + 1, y) && isM(x, y - 1) && isM(x, y + 1) && isM(x - 1, y - 1) && isM(x + 1, y + 1);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, c = src[i]; if (!c || c.kind !== 'iron') continue;
        const lx = x - ox, ly = y - oy;
        // 受光角：亮阶像素，上面和左边都不是金属 → 一个点
        const corner = c.lv === 4 && !isM(x, y - 1) && !isM(x - 1, y);
        if (mat.key === 'iron') {
          if ((c.lv === 2 || c.lv === 3) && flat(x, y)) {
            const bx = Math.floor(lx / 4), by = Math.floor(ly / 4), h = hash(bx, by);
            if ((((lx % 4) + 4) % 4) === h % 4 && (((ly % 4) + 4) % 4) === (h >> 2) % 4) shift(i, c, h % 5 === 0 ? 1 : -1);
          }
          if (c.lv === 4) put(i, tinted(M.ironC[3]));   // 哑光：亮边压一阶
        } else if (mat.key === 'steel') {
          if (corner) put(i, [224, 232, 240]);
        } else if (mat.key === 'nickel') {
          if (corner) put(i, rgbOf(P.white));
          if (scheme === 'C' && c.lv === 4) { const p = (lx + ly - (frame * 3) % 90 + 90) % 90; if (p < 2) put(i, rgbOf(P.white)); }
        } else if (mat.key === 'wootz') {
          if ((c.lv === 2 || c.lv === 3) && flat(x, y)) {
            const f = ly * 0.9 + 2.4 * Math.sin(lx * 0.3 + ly * 0.07);
            const fr = ((f / 5) % 1 + 1) % 1;
            if (fr < 0.14) shift(i, c, 1);
          }
        } else if (mat.key === 'aether') {
          if (c.lv === 4) put(i, tinted(mix(M.ironC[4], rgbOf('#7fd6ca'), 0.45)));
        }
      }
      // ③ 紧固件：认出 sprites.js 的 rivet() 图案（2×2 亮 + 中心 iron2 + 右下暗影），整颗换掉
      if (scheme === 'C') {
        for (let y = 0; y < H - 2; y++) for (let x = 0; x < W - 2; x++) {
          const a = lvAt(x, y);
          if (a < 3 || lvAt(x + 1, y) !== a || lvAt(x, y + 1) !== a || lvAt(x + 1, y + 1) !== 2 || lvAt(x + 2, y + 1) !== 0) continue;
          const ids = [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1];
          if (mat.key === 'steel') { put(ids[0], tinted(M.ironC[4])); put(ids[1], tinted(M.ironC[3])); put(ids[2], tinted(M.ironC[3])); put(ids[3], tinted(M.ironC[1])); }
          else if (mat.key === 'nickel') { put(ids[0], rgbOf(P.brass[3])); put(ids[1], rgbOf(P.brass[2])); put(ids[2], rgbOf(P.brass[2])); put(ids[3], rgbOf(P.brass[1])); }
          else if (mat.key === 'wootz') { put(ids[0], rgbOf(P.brass[3])); put(ids[1], rgbOf(P.brass[1])); put(ids[2], rgbOf(P.brass[1])); put(ids[3], rgbOf(P.brass[0])); }
          else if (mat.key === 'aether') {
            const on = Math.floor(frame / 3 + (hash(x, y) % 4)) % 4;
            put(ids[0], rgbOf(M.glow[on === 0 ? 2 : 1])); put(ids[1], rgbOf(M.glow[1])); put(ids[2], rgbOf(M.glow[1])); put(ids[3], rgbOf(M.glow[0]));
          }
        }
      }
      return write();
      function write() {
        for (let i = 0; i < W * H; i++) { const c = out[i]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
        g.putImageData(img, 0, 0);
      }
    };
  }
  const PASSES = { A: makePass('A'), B: makePass('B'), C: makePass('C') };
  return { MATS, PASSES, setFrame: (f) => { frame = f; }, setTint: (k) => { tint = k; } };
})();
