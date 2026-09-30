// 主页面的场景：老汤姆的铁匠铺院子（界面重建 v3，专门给主页面画的，不借战斗背景）。
// 原生 640×360，显示放大 2 倍（和人物、车同一种像素大小）。左边砖砌铁匠铺：石板瓦屋顶 + 烟囱、敞开的大门里炉膛发光（炉罩、风箱、挂着的工具），
// 暖光的窗、门口挂的铁砧招牌、水桶和煤堆；右边黄昏天空、远处城市剪影、废料棚和木栅栏；地面是鹅卵石，门里的炉光洒出来。
// base() = 静态底图（缓存）；fx(g, t) = 每帧叠上去的动效（炉火、窗光、烟），画在同尺寸的透明画布上。
// 规矩同 docs/art-style.md：左上光、四阶色、渐变用 Bayer 抖动、不抗锯齿。
window.SA = window.SA || {};

SA.HomeScene = (() => {
  const P = SA.PAL, W = 640, H = 360, GROUND = 303;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const hash = (x, y, s = 1) => { let v = (x * 374761393 + y * 668265263 + s * 982451653) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  // 建筑、门、窗的位置（home.js 也用它们摆人物和道具）
  const L = { wall: [0, 92, 440, GROUND], door: [118, 148, 250, GROUND], hearth: [158, 232, 214, 280], window: [332, 170, 384, 214], chimney: [322, 18, 352, 70], sign: [262, 116] };
  let cache = null;

  function base() {
    if (cache) return cache;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const p = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };

    // ---------- 天空：黄昏，从上到下 紫 → 酒红 → 橙，带之间一行抖动 ----------
    const SKY = ['#1f1627', '#2a1c30', '#3d2436', '#5a2f38', '#7c3c34', '#a4552e', '#c9763a'];
    for (let y = 0; y < 190; y++) {
      const f = Math.pow(y / 190, 1.25) * (SKY.length - 1), i = Math.floor(f), fr = f - i;
      for (let x = 0; x < W; x++) p(x, y, SKY[Math.min(SKY.length - 1, i + (fr > bay(x, y) ? 1 : 0))]);
    }
    for (let i = 0; i < 26; i++) p(Math.floor(hash(i, 1, 3) * W), Math.floor(hash(i, 2, 3) * 44), hash(i, 3, 3) > 0.5 ? '#8a7a90' : '#5e5068');
    // 落日：右边城市后面半个圆 + 一圈光晕（抖动）
    for (let y = 120; y < 190; y++) for (let x = 500; x < 640; x++) {
      const d = Math.hypot(x - 575, y - 176);
      if (d < 22) p(x, y, d < 18 ? '#ffd166' : '#f2a444');
      else if (d < 48 && (48 - d) / 26 * 0.55 > bay(x, y)) p(x, y, '#e08a3a');
    }
    // 两条长云
    for (const [cx, cy, w] of [[430, 58, 120], [560, 92, 90], [120, 40, 80]]) for (let x = 0; x < w; x++) { const hh = Math.round(3 - Math.abs(x - w / 2) / w * 5); for (let y = 0; y < Math.max(1, hh); y++) p(cx + x - w / 2, cy + y, y ? '#6a3a42' : '#8a4a4a'); }

    // ---------- 远景城市剪影（低对比）：厂房、烟囱、钟塔，零星暖窗 ----------
    const far = '#3a2432', far2 = '#2e1c28';
    const blocks = [[440, 150, 26, 40], [466, 138, 18, 52], [486, 158, 40, 32], [528, 146, 22, 44], [552, 164, 50, 26], [604, 150, 36, 40], [380, 160, 60, 30]];
    for (const [x, y, w, h] of blocks) { R(x, y, w, 190 - y, far); for (let i = 0; i < w * h / 90; i++) if (hash(x + i, y, 5) > 0.5) p(x + 2 + Math.floor(hash(i, x, 7) * (w - 4)), y + 3 + Math.floor(hash(i, y, 9) * (190 - y - 6)), '#8a5a3a'); }
    for (const [x, top] of [[470, 104], [540, 112], [598, 120]]) R(x, top, 5, 190 - top, far2);
    R(508, 96, 12, 94, far2); R(506, 92, 16, 6, far2); R(511, 84, 6, 8, far2); p(514, 80, far2); R(510, 104, 8, 8, '#6a4a3a'); p(514, 108, far2); p(514, 106, far2);   // 钟塔

    // ---------- 右：废料棚 + 木栅栏 ----------
    const shed = [446, 196, 640, GROUND];
    R(shed[0], shed[1] + 8, shed[2] - shed[0], GROUND - shed[1] - 8, '#241814');
    for (let x = shed[0] - 6; x < W; x++) { const y = shed[1] + Math.round((x - shed[0]) * 0.06); R(x, y, 1, 9, (x % 6 < 3) ? '#5a5e66' : '#44474e'); p(x, y, '#8a8e96'); p(x, y + 8, '#1e1a1a'); }   // 波纹铁皮屋顶
    for (const px of [452, 560, 634]) { R(px, shed[1] + 14, 4, GROUND - shed[1] - 14, '#3b2418'); R(px, shed[1] + 14, 1, GROUND - shed[1] - 14, '#6b4128'); }
    // 棚里的废料：大齿轮、旧车轮、管子
    for (let y = -22; y <= 22; y++) for (let x = -22; x <= 22; x++) {
      const d = Math.hypot(x, y), a = Math.atan2(y, x), tooth = (((a / (Math.PI * 2)) * 12 % 1) + 1) % 1 < 0.5;
      if ((d < 20 || (d < 23 && tooth)) && d > 6 && !(d > 9 && d < 16 && Math.abs(Math.sin(a * 3)) > 0.5)) p(506 + x, 272 + y, d > 18 ? '#2e3647' : (x + y < 0 ? '#4a5468' : '#3a4254'));
    }
    for (let a = 0; a < Math.PI * 2; a += 0.02) { p(Math.round(596 + Math.cos(a) * 16), Math.round(282 + Math.sin(a) * 16), '#5a3a20'); p(Math.round(596 + Math.cos(a) * 14), Math.round(282 + Math.sin(a) * 14), '#3b2418'); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; for (let r = 3; r < 14; r++) p(Math.round(596 + Math.cos(a) * r), Math.round(282 + Math.sin(a) * r), '#4a3018'); }
    R(530, 290, 60, 5, '#343c4e'); R(530, 290, 60, 1, '#6f7a8e'); R(548, 282, 40, 4, '#2e3647'); R(548, 282, 40, 1, '#4a5468');
    // 栅栏（棚前左边一段）
    for (let x = 440; x < 470; x += 7) { R(x, 236, 6, GROUND - 236, '#4a2e1a'); R(x, 236, 1, GROUND - 236, '#6b4128'); R(x + 5, 236, 1, GROUND - 236, '#2a180c'); R(x + 1, 234, 4, 2, '#4a2e1a'); }
    R(440, 250, 32, 3, '#3b2418'); R(440, 280, 32, 3, '#3b2418');

    // ---------- 铁匠铺：砖墙 ----------
    const [wx0, wy0, wx1] = L.wall;
    const BR = ['#6e3a26', '#7c4430', '#633222', '#8a4c34'], MORT = '#3a1e16';
    for (let y = wy0; y < GROUND; y++) for (let x = wx0; x < wx1; x++) {
      const row = Math.floor((y - wy0) / 7), off = row % 2 ? 7 : 0, bx = Math.floor((x + off) / 14);
      const mort = (y - wy0) % 7 === 6 || (x + off) % 14 === 13;
      let col = mort ? MORT : BR[Math.floor(hash(bx, row, 11) * 4)];
      if (!mort && (y - wy0) % 7 === 0) col = '#8e5238';                   // 砖的上沿受光
      const soot = Math.max(0, 1 - (y - wy0) / 60) * 0.6 + Math.max(0, (y - (GROUND - 30)) / 30) * 0.5;   // 屋檐下和墙根发黑
      if (!mort && soot > bay(x, y) + 0.25) col = '#4a2418';
      p(x, y, col);
    }
    // 墙角石 + 墙根一道石条
    R(wx1 - 6, wy0, 6, GROUND - wy0, '#5a4f45'); for (let y = wy0; y < GROUND; y += 12) { R(wx1 - 6, y, 6, 1, '#3b322c'); R(wx1 - 6, y + 1, 1, 10, '#6f6154'); }
    R(wx0, GROUND - 6, wx1 - wx0, 6, '#4a3f37'); R(wx0, GROUND - 6, wx1 - wx0, 1, '#6f6154'); R(wx0, GROUND - 1, wx1 - wx0, 1, '#231e1b');
    // ---------- 屋顶：石板瓦，出檐 ----------
    for (let y = 56; y < wy0 + 4; y++) {
      const inset = Math.round((y - 56) * 0.35);
      for (let x = wx0 - 4; x < wx1 + 8 - inset; x++) {
        const row = Math.floor((y - 56) / 5), off = row % 2 ? 5 : 0;
        let col = ((x + off) % 10 === 9) ? '#1e1a22' : ((y - 56) % 5 === 4 ? '#221c24' : hash(Math.floor((x + off) / 10), row, 13) > 0.5 ? '#3e3440' : '#4a3e4a');
        if ((y - 56) % 5 === 0) col = '#5e5060';
        p(x, y, col);
      }
    }
    R(wx0 - 4, wy0 + 2, wx1 - wx0 + 12, 3, '#2a180c'); R(wx0 - 4, wy0 + 2, wx1 - wx0 + 12, 1, '#5a3920');   // 檐板
    // 烟囱
    const [cx0, cy0, cx1, cy1] = L.chimney;
    for (let y = cy0; y < 60; y++) for (let x = cx0; x < cx1; x++) { const mort = (y - cy0) % 6 === 5 || (x + (Math.floor((y - cy0) / 6) % 2 ? 5 : 0)) % 10 === 9; p(x, y, mort ? MORT : x < cx0 + 3 ? '#8a4c34' : x > cx1 - 4 ? '#4a2418' : '#6e3a26'); }
    R(cx0 - 3, cy0 - 4, cx1 - cx0 + 6, 5, '#343c4e'); R(cx0 - 3, cy0 - 4, cx1 - cx0 + 6, 1, '#6f7a8e');

    // ---------- 大门：木门框、里面的铁匠炉 ----------
    const [dx0, dy0, dx1] = L.door;
    R(dx0, dy0, dx1 - dx0, GROUND - dy0, '#140c0a');
    // 里墙（暗砖）+ 地面
    for (let y = dy0 + 6; y < GROUND - 8; y++) for (let x = dx0 + 6; x < dx1 - 6; x++) { const mort = (y % 7 === 6) || ((x + (Math.floor(y / 7) % 2 ? 7 : 0)) % 14 === 13); p(x, y, mort ? '#140a08' : '#2a1610'); }
    R(dx0 + 6, GROUND - 14, dx1 - dx0 - 12, 14, '#1e1410');
    // 墙上挂的工具剪影：锤、钳、马蹄铁
    const tool = (x, y, kind) => { R(x, y - 6, 1, 6, '#0e0806'); if (kind === 0) { R(x, y, 1, 18, '#3a2a20'); R(x - 3, y, 7, 4, '#4a5468'); } else if (kind === 1) { R(x - 1, y, 1, 20, '#343c4e'); R(x + 1, y, 1, 20, '#343c4e'); R(x - 2, y + 18, 5, 2, '#4a5468'); } else { for (let a = 0.3; a < Math.PI * 1.7; a += 0.2) p(Math.round(x + Math.cos(a + 1.6) * 5), Math.round(y + 6 + Math.sin(a + 1.6) * 5), '#6f7a8e'); } };
    [[134, 172, 0], [146, 170, 1], [158, 174, 2], [228, 172, 0], [238, 170, 1]].forEach(([x, y, k]) => tool(x, y, k));
    // 炉罩（铁，梯形）+ 往上的烟道
    const [hx0, hy0, hx1, hy1] = L.hearth;
    for (let y = 196; y < hy0; y++) { const inset = Math.round((hy0 - y) * 0.45); R(hx0 - 6 + inset, y, hx1 - hx0 + 12 - inset * 2, 1, y === hy0 - 1 ? '#6f7a8e' : (y % 4 === 0 ? '#2e3647' : '#343c4e')); }
    R(180, dy0 + 6, 14, 196 - dy0 - 6, '#2e3647'); R(180, dy0 + 6, 2, 196 - dy0 - 6, '#4a5468');
    // 砖炉台 + 炉口
    for (let y = hy0; y < GROUND - 8; y++) for (let x = hx0 - 4; x < hx1 + 4; x++) { const mort = (y % 6 === 5) || ((x + (Math.floor(y / 6) % 2 ? 4 : 0)) % 8 === 7); p(x, y, mort ? '#2a1410' : '#5a2c1e'); }
    R(hx0 - 6, hy0, hx1 - hx0 + 12, 3, '#4a5468'); R(hx0 - 6, hy0, hx1 - hx0 + 12, 1, '#a3adbd');
    R(hx0 + 6, hy0 + 12, hx1 - hx0 - 12, 18, '#0b0707');   // 炉口（火画在 fx 里）
    // 风箱（皮，叠褶）
    for (let i = 0; i < 5; i++) { R(132, 258 + i * 4, 24 - i * 2, 3, i % 2 ? '#3b2418' : '#6b4128'); R(132, 258 + i * 4, 24 - i * 2, 1, '#9a6a3f'); }
    R(154, 262, 8, 3, '#343c4e');
    // 门框（粗木）+ 往外开的两扇门
    R(dx0 - 6, dy0 - 6, dx1 - dx0 + 12, 6, '#3b2418'); R(dx0 - 6, dy0 - 6, dx1 - dx0 + 12, 1, '#6b4128');
    for (const x of [dx0 - 6, dx1]) { R(x, dy0 - 6, 6, GROUND - dy0 + 6, '#3b2418'); R(x, dy0 - 6, 1, GROUND - dy0 + 6, '#6b4128'); R(x + 5, dy0 - 6, 1, GROUND - dy0 + 6, '#22150c'); }
    const leaf = (x0, w, dir) => { for (let x = 0; x < w; x++) { const xx = dir > 0 ? x0 + x : x0 - x, top = dy0 + 2 + Math.round(x * 0.35), bot = GROUND - 2 - Math.round(x * 0.2); R(xx, top, 1, bot - top, x % 7 === 0 ? '#2a180c' : x % 7 === 1 ? '#7a4a2a' : '#5a3920'); } R(dir > 0 ? x0 + 2 : x0 - w + 2, dy0 + 30, w - 4, 3, '#2e3647'); R(dir > 0 ? x0 + 2 : x0 - w + 2, GROUND - 40, w - 4, 3, '#2e3647'); };
    leaf(dx0 - 7, 18, -1); leaf(dx1 + 6, 18, 1);
    // ---------- 窗：木框十字窗棂，暖光（亮度在 fx 里闪）----------
    const [wx, wy, wx2, wy2] = L.window;
    R(wx - 4, wy - 4, wx2 - wx + 8, wy2 - wy + 8, '#3b2418'); R(wx - 4, wy - 4, wx2 - wx + 8, 1, '#6b4128');
    R(wx, wy, wx2 - wx, wy2 - wy, '#c9763a');
    R(wx - 6, wy2 + 4, wx2 - wx + 12, 4, '#5a4f45'); R(wx - 6, wy2 + 4, wx2 - wx + 12, 1, '#8a7e70');   // 窗台石
    // ---------- 门口挂的招牌：铁支架 + 两根链子 + 木牌上画铁砧 ----------
    const [sx, sy] = L.sign;
    R(sx - 2, sy - 16, 34, 2, '#343c4e'); R(sx - 2, sy - 16, 2, 10, '#343c4e');
    for (const x of [sx + 6, sx + 24]) for (let y = sy - 14; y < sy; y += 2) p(x, y, '#6f7a8e');
    R(sx, sy, 32, 18, '#2a180c'); R(sx + 1, sy + 1, 30, 16, '#6b4128'); R(sx + 1, sy + 1, 30, 1, '#9a6a3f');
    R(sx + 8, sy + 6, 16, 3, '#1e1a1a'); R(sx + 5, sy + 6, 4, 2, '#1e1a1a'); R(sx + 12, sy + 9, 8, 3, '#1e1a1a'); R(sx + 10, sy + 12, 12, 2, '#1e1a1a'); R(sx + 8, sy + 6, 16, 1, '#8a8e96');
    // ---------- 门边：水桶（木桶 + 铁箍）和煤堆 ----------
    for (let x = 0; x < 22; x++) { const bulge = Math.round(Math.sin(x / 21 * Math.PI) * 2); R(86 + x, 270 - bulge, 1, GROUND - 270 + bulge, x % 5 === 0 ? '#3b2418' : x < 6 ? '#8a5a34' : '#6b4128'); }
    R(86, 278, 22, 2, '#343c4e'); R(86, 292, 22, 2, '#343c4e'); R(88, 268, 18, 2, '#1f7a86'); R(90, 268, 6, 1, '#46c2c9');
    for (let y = 0; y < 14; y++) for (let x = -20 + y; x < 20 - y; x++) if (hash(x, y, 17) > 0.15) p(270 + x, GROUND - 1 - y, hash(x, y, 19) > 0.8 ? '#4a4452' : hash(x, y, 23) > 0.5 ? '#1a1616' : '#2a2626');
    R(284, 268, 2, 20, '#6b4128'); R(281, 286, 8, 4, '#4a5468');   // 铲子

    // ---------- 地面：鹅卵石，越往下越暗；门口洒出一片炉光 ----------
    for (let y = GROUND; y < H; y++) {
      const row = Math.floor((y - GROUND) / 6), off = (row % 2) * 5;
      for (let x = 0; x < W; x++) {
        const cx = Math.floor((x + off) / 10), inStone = ((x + off) % 10) !== 9 && ((y - GROUND) % 6) !== 5;
        let col = inStone ? (hash(cx, row, 29) > 0.5 ? '#4a3f37' : '#3b322c') : '#231e1b';
        if (inStone && (y - GROUND) % 6 === 0) col = '#5c4f45';
        const dark = (y - GROUND) / (H - GROUND);
        if (dark > 0.55 && dark - 0.55 > bay(x, y) * 0.5) col = inStone ? '#2e2723' : '#1a1614';
        // 炉光：门前梯形，越远越淡
        const spread = (y - GROUND) * 0.9, glow = x > L.door[0] - spread && x < L.door[2] + spread ? 1 - (y - GROUND) / 60 : 0;
        if (inStone && glow > bay(x, y) + 0.1) col = glow > 0.6 ? '#8a5a34' : '#6e4a30';
        p(x, y, col);
      }
    }
    return (cache = c);
  }

  // ---------- 动效：炉火、火星、窗光闪、烟囱冒烟 ----------
  function fx(g, t) {
    g.clearRect(0, 0, W, H);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const [hx0, hy0, hx1] = L.hearth, mx = hx0 + 6, my = hy0 + 12, mw = hx1 - hx0 - 12;
    const f = Math.floor(t * 10);
    for (let x = 0; x < mw; x++) {
      const h1 = 6 + Math.floor(hash(x, f, 31) * 9 + Math.sin(x * 0.7 + t * 5) * 2);
      for (let y = 0; y < h1; y++) R(mx + x, my + 18 - y - 1, 1, 1, y < 3 ? '#b8391b' : y < h1 - 3 ? '#ef7a21' : '#ffd166');
    }
    R(mx, my + 14, mw, 4, '#ffd166');
    for (let i = 0; i < 5; i++) { const k = ((t * 0.9 + i / 5) % 1); if (hash(i, Math.floor(t), 37) > 0.4) R(Math.round(mx + mw / 2 + Math.sin(i * 7 + t * 3) * 8), Math.round(my - k * 30), 1, 1, k < 0.5 ? '#ffd166' : '#ef7a21'); }
    // 窗光：偶尔暗一下
    const [wx, wy, wx2, wy2] = L.window, flick = hash(0, Math.floor(t * 4), 41) > 0.85;
    R(wx + 2, wy + 2, wx2 - wx - 4, wy2 - wy - 4, flick ? '#b86a34' : '#e8943e');
    R(wx + 2, wy + 2, (wx2 - wx - 4) / 2 - 2, 8, flick ? '#c9763a' : '#ffc46a');
    R(Math.round((wx + wx2) / 2) - 1, wy, 2, wy2 - wy, '#3b2418'); R(wx, Math.round((wy + wy2) / 2) - 1, wx2 - wx, 2, '#3b2418');
    // 烟：一串方块往上飘、变大变淡
    const [cx0, cy0, cx1] = L.chimney;
    for (let i = 0; i < 7; i++) {
      const k = (t * 0.18 + i / 7) % 1, s = 3 + Math.round(k * 9), x = Math.round((cx0 + cx1) / 2 - s / 2 + Math.sin(k * 5 + i) * 4 + k * 26), y = Math.round(cy0 - 6 - k * 70);
      g.globalAlpha = 0.55 * (1 - k); R(x, y, s, s, k < 0.4 ? '#6d6a64' : '#8a8078'); R(x, y, s, 1, '#a8a39a'); g.globalAlpha = 1;
    }
  }
  return { base, fx, W, H, GROUND, L };
})();
