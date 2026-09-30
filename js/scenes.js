// 战斗场景：铁匠铺后院（序章）、野地（竞技场外遭遇战）、预选赛（其余竞技场比赛）。
// 每个场景分五层，从远到近：天空（不跟镜头）→ 远景（×0.05）→ 中远景（×0.15～0.2）→ 中景（×0.45）→ 地面（1:1，世界坐标）→ 近景（×1.4，压在车前面的画面最下沿）。
// 规则同 docs/art-style.md：硬像素、左上光、渐变用 4×4 Bayer 抖动；背景只用中低明度、低饱和，只有炉火、灯这类发光物可以亮。
// 纹理一次画好（按场景缓存），每帧只做平铺 / 圆筒采样，再叠一点程序化的小动效（烟、火星、风车、火车、人群、草）。
// 世界坐标：地平线 HZ = 408，中景底 GE = 538，地面纹理从 F0 = 552 开始，车在 GROUND = 648。画在 battle-view 的「视口像素」里（左上角 = 镜头角）。
window.SA = window.SA || {};

SA.Scenes = (() => {
  const P = SA.PAL, TAU = Math.PI * 2;
  const W = 1280, H = 720, GROUND = 648, HZ = 408, GE = 538, F0 = 552;
  const TW = 1248;   // 可平铺纹理的周期
  const SKY0 = -640;   // 天空纹理顶端的世界 y（镜头拉到最远时顶上还是天）
  const NAMES = { forge: '铁匠铺后院', wild: '野地', qual: '预选赛' };

  // 哪一场用哪个场景：序章 → 铁匠铺后院；竞技场外遭遇战 → 野地；其余（战役第一章起、街头赛、锦标赛、试驾场）→ 预选赛。opts.scene 可以直接指定
  function pick(opts = {}) {
    if (opts.scene && NAMES[opts.scene]) return opts.scene;
    if (opts.mode === 'side') return 'wild';
    if (opts.mode === 'campaign' && /^0,/.test(opts.storyKey || '')) return 'forge';
    return 'qual';
  }

  // ---------- 像素缓冲 ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const U32 = {};
  const u32 = (hex) => U32[hex] || (U32[hex] = (0xff000000 | (parseInt(hex.slice(5, 7), 16) << 16) | (parseInt(hex.slice(3, 5), 16) << 8) | parseInt(hex.slice(1, 3), 16)) >>> 0);
  // w × h 的画布；wrap = 横向循环（跨过右边界的东西从左边接着画），可平铺纹理都用它
  function Pix(w, h, wrap) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), img = x.createImageData(w, h), d = new Uint32Array(img.data.buffer);
    const put = (px, py, col) => {
      if (col == null) return;
      px = Math.floor(px); py = Math.floor(py);
      if (py < 0 || py >= h) return;
      if (wrap) px = ((px % w) + w) % w; else if (px < 0 || px >= w) return;
      d[py * w + px] = typeof col === 'number' ? col : u32(col);
    };
    const has = (px, py) => { px = Math.floor(px); py = Math.floor(py); if (py < 0 || py >= h) return false; if (wrap) px = ((px % w) + w) % w; else if (px < 0 || px >= w) return false; return d[py * w + px] !== 0; };
    const rect = (x0, y0, ww, hh, col) => { for (let yy = Math.round(y0); yy < Math.round(y0 + hh); yy++) for (let xx = Math.round(x0); xx < Math.round(x0 + ww); xx++) put(xx, yy, col); };
    const disc = (cx, cy, r, col, ry = r) => {
      for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++) for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
        const dx = (xx + 0.5 - cx) / r, dy = (yy + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) put(xx, yy, typeof col === 'function' ? col(xx, yy, dx, dy) : col);
      }
    };
    const line = (x0, y0, x1, y1, col, th = 1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) { const k = i / n; rect(Math.round(x0 + (x1 - x0) * k - (th - 1) / 2), Math.round(y0 + (y1 - y0) * k - (th - 1) / 2), th, th, col); }
    };
    // 竖向抖动渐变：stops = [[y, 色]...]，相邻两色之间按 Bayer 过渡
    const vgrad = (x0, x1, stops) => {
      for (let i = 0; i < stops.length - 1; i++) {
        const [ya, ca] = stops[i], [yb, cb] = stops[i + 1];
        for (let yy = ya; yy < yb; yy++) for (let xx = x0; xx < x1; xx++) put(xx, yy, bayer(xx, yy) < (yy - ya) / (yb - ya) ? cb : ca);
      }
    };
    // 1px 外轮廓（只描在空白处），col = 描边色
    const outline = (col, x0 = 0, x1 = w) => {
      const o = u32(col), mark = [];
      for (let yy = 0; yy < h; yy++) for (let xx = x0; xx < x1; xx++) if (!d[yy * w + xx] && (has(xx - 1, yy) || has(xx + 1, yy) || has(xx, yy - 1) || has(xx, yy + 1))) mark.push(yy * w + xx);
      for (const i of mark) d[i] = o;
    };
    const done = () => { x.putImageData(img, 0, 0); return c; };
    return { c, w, h, put, has, rect, disc, line, vgrad, outline, done };
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 起伏的山脊线：几组正弦叠加，保证在 TW 周期上首尾相接
  const ridge = (u, base, amps, seed) => amps.reduce((s, [a, k], i) => s + a * Math.sin((u / TW) * TAU * k + seed * (i + 1) * 1.7), base);

  // ---------- 每帧的采样 ----------
  // 平铺层：tex 顶边在世界 y0，横向按 rot 偏移（rot = 镜头 x × 视差）
  function strip(g, tex, y0, rot, vw, oy) {
    const per = tex.width, u = ((Math.round(rot) % per) + per) % per, y = Math.round(y0 - oy);
    for (let x = -u; x < vw; x += per) g.drawImage(tex, x, y);
  }
  // 纹理坐标 u 在平铺层上落在屏幕哪几列（可能有两三份）
  function spots(u, rot, per, vw, pad, fn) {
    const r = ((Math.round(rot) % per) + per) % per;
    for (let x = u - r - per; x < vw + pad; x += per) if (x > -pad) fn(x);
  }
  // 圆筒层（预选赛看台）：屏幕中间 1:1，越往两边越压缩，像绕着圆形场地转。tex 是两圈宽（采样跨接缝时不用拆）
  function drum(g, tex, y0, rot, vw, oy) {
    const K0 = 0.82, R = (vw / 2) / K0, per = tex.width / 2, th = tex.height, STEP = 4, y = Math.round(y0 - oy);
    const tx = (sx) => rot + Math.asin(Math.max(-1, Math.min(1, (sx - vw / 2) / (vw / 2))) * K0) * R;
    let t0 = tx(0);
    for (let sx = 0; sx < vw; sx += STEP) {
      const t1 = tx(sx + STEP), u = ((t0 % per) + per) % per;
      g.drawImage(tex, Math.floor(u), 0, Math.max(1, Math.round(t1 - t0)), th, sx, y, STEP, th);
      t0 = t1;
    }
  }
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function blob(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let y = -Math.floor(r); y <= r; y++) { const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  // 一缕烟：从 (x, y) 往上飘、被风吹向右，t 是时间；k = 粗细倍数
  function smoke(g, x, y, t, seed, cols, k = 1, rise = 70, wind = 26) {
    for (let i = 0; i < 5; i++) {
      const f = ((t * 0.16 + i / 5 + seed * 0.37) % 1), r = (2 + f * 8) * k;
      g.globalAlpha = 0.5 * (1 - f) * (f < 0.08 ? f / 0.08 : 1);
      blob(g, x + f * wind * k + Math.sin(f * 5 + seed) * 2, y - f * rise * k, r, f < 0.35 ? cols[1] : cols[0]);
    }
    g.globalAlpha = 1;
  }
  // 天空：竖向抖动渐变做成 64 宽的图案，铺满整个视口（天空不跟镜头平移）
  function skyTex(stops) {
    const p = Pix(64, HZ + 160 - SKY0), seam = 12, st = [];
    // 一条条平的色带，只在交界处留 12px 抖动过渡（大面积整片抖动会像纱窗）
    stops.forEach(([y, c], i) => { if (i) st.push([y - SKY0 - seam, stops[i - 1][1]]); st.push([y - SKY0, c]); });
    p.vgrad(0, 64, st.filter(([y], i) => i === 0 || y > st[i - 1][0]));
    return p.done();
  }
  // 天空：64 宽的图案先铺成一张 2112 宽的整图（比镜头拉到最远时的视口还宽），每帧一次 drawImage，比图案填充快得多
  function paintSky(g, S, vw, vh, oy) {
    const top = SKY0 - oy;
    if (top > 0) R(g, 0, 0, vw, top, S.skyTop);
    if (!S.skyWide) { const [c, x] = mk(2112, S.sky.height); for (let i = 0; i < 2112; i += 64) x.drawImage(S.sky, i, 0); S.skyWide = c; }
    g.drawImage(S.skyWide, 0, top);
  }
  // 云：几团抖动的椭圆叠出来，下缘压暗、上缘受光
  function cloud(w, h, cols, seed) {
    const p = Pix(w, h), r = rng(seed), puffs = [];
    for (let i = 0; i < 7; i++) { const k = i / 6; puffs.push([w * (0.12 + 0.76 * k) + (r() - 0.5) * 10, h * 0.62 - Math.sin(k * Math.PI) * h * 0.25 * (0.6 + r() * 0.6), h * (0.22 + 0.2 * Math.sin(k * Math.PI)) + r() * 4]); }
    for (const [cx, cy, rr] of puffs) p.disc(cx, cy, rr * 1.5, (x, y, dx, dy) => (dy > 0.45 ? cols[0] : dy < -0.35 && dx < 0.3 ? cols[2] : bayer(x, y) < 0.5 - dy ? cols[1] : cols[0]), rr);
    for (let x = 0; x < w; x++) for (let y = Math.floor(h * 0.72); y < h; y++) if (p.has(x, y) && y > h * 0.8) p.put(x, y, bayer(x, y) < 0.5 ? 0 : cols[0]);
    return p.done();
  }
  // 云按时间往右飘（每朵速度不同），也带一点点视差；宽度按视口循环
  function clouds(g, S, vw, oy, camx, t) {
    for (const c of S.clouds) {
      const span = vw + c.img.width * 2, x = ((c.x + t * c.v - camx * c.par) % span + span) % span - c.img.width;
      g.drawImage(c.img, Math.round(x), Math.round(c.y - oy));
    }
  }
  // 一群鸟（剪影的小 v，翅膀两帧），每 period 秒飞过一次
  function birds(g, vw, oy, t, y0, period, col, dir = 1) {
    const ph = (t % period) / period, x0 = dir > 0 ? -60 + ph * (vw + 160) : vw + 60 - ph * (vw + 160);
    if (ph > 0.9) return;
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const bx = Math.round(x0 - dir * (i % 2 ? 1 : -0.4) * i * 9), by = Math.round(y0 - oy + Math.abs(i - 2.5) * 5 + Math.sin(t * 2 + i) * 2);
      const up = Math.floor(t * 6 + i) % 2;
      g.fillRect(bx, by, 1, 1); g.fillRect(bx - 2, by - 1 + up * 2, 2, 1); g.fillRect(bx + 1, by - 1 + up * 2, 2, 1);
    }
  }

  // =====================================================================
  // 铁匠铺后院：黄昏。远处伦敦屋顶和烟囱，中景是铁匠铺（敞开的炉门、火光、打铁的火星、冒烟的砖烟囱），
  // 老汤姆在铁砧前抡锤、远房亲戚站在门口（成双入对）；近景是废料堆和铁砧剪影，空气里飘着火星
  // =====================================================================
  function buildForge() {
    const S = { id: 'forge' };
    const C = {
      sky: [[SKY0, '#140f17'], [40, '#1b1420'], [170, '#2a1a25'], [270, '#3f2229'], [340, '#58292a'], [392, '#723827'], [440, '#84452a'], [HZ + 160, '#84452a']],
      far: '#35222a', farD: '#2c1c22', farWin: '#8a5a2e',
      mid2: '#24171b', mid2D: '#1d1216', mid2L: '#3a2326',
      brick: ['#2c1a17', '#3b231e', '#4a2c24', '#5a372b'], slate: ['#1a1418', '#231b20', '#2e242a'], wood: ['#241710', '#352216', '#4a3020'],
      iron: ['#161314', '#241f20', '#3a3232'], soot: '#120d0d', glow: ['#5c1a0e', '#8a3414', '#b8561e', '#e08a32'],
      gnd: ['#1a1413', '#241c1a', '#2e2522', '#3a2f2a', '#4a3d35'], near: '#0e0a0a', rim: ['#7a3a20', '#3a1c12'],
    };
    S.skyTop = C.sky[0][1];
    S.sky = skyTex(C.sky);
    S.clouds = [0, 1, 2, 3].map(i => ({ img: cloud(150 + i * 40, 22 + (i % 2) * 8, ['#3a2128', '#4c2a2e', '#6e3a2c'], 11 + i), x: i * 470, y: 120 + (i % 3) * 58, v: 3 + i * 0.8, par: 0.02 }));
    // 远景：伦敦屋顶、烟囱帽、储气罐框架、教堂尖塔、钟楼，零星亮着的窗
    {
      const y0 = 250, p = Pix(TW, F0 - y0, true), r = rng(5), chim = [];
      for (let x = 0; x < TW;) {
        const w = 26 + Math.floor(r() * 44), top = 150 - Math.floor(r() * 36) + (r() < 0.2 ? 18 : 0);
        p.rect(x, top, w, F0 - y0 - top, C.far);
        if (r() < 0.5) p.line(x, top, x + w / 2, top - 10, C.far, 2), p.line(x + w / 2, top - 10, x + w, top, C.far, 2), p.rect(x + 2, top - 9 + 5, w - 4, 10, C.far);
        for (let k = 0; k < 2; k++) if (r() < 0.6) { const cx = x + 4 + Math.floor(r() * (w - 10)), ch = 10 + Math.floor(r() * 14); p.rect(cx, top - ch, 5, ch, C.far); p.rect(cx - 1, top - ch, 7, 2, C.farD); if (r() < 0.45) chim.push([cx + 2, top - ch + y0]); }
        for (let wy = top + 8; wy < 175; wy += 10) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (r() < 0.07) p.rect(wx, wy, 2, 3, C.farWin);
        x += w + (r() < 0.2 ? 6 : 0);
      }
      // 储气罐：圆柱罐体 + 三层导轨框架
      const gx = 300; p.rect(gx, 110, 90, 90, C.farD);
      for (const yy of [104, 128, 152]) p.rect(gx - 4, yy, 98, 2, C.far);
      for (let k = 0; k <= 6; k++) p.rect(gx - 4 + k * 16, 100, 2, 100, C.far);
      // 教堂尖塔 + 钟楼
      p.rect(760, 60, 14, 120, C.far); for (let k = 0; k < 34; k++) p.rect(767 - k / 5, 26 + k, 1 + (k / 5) * 2, 1, C.far);
      p.rect(1010, 70, 22, 110, C.far); p.rect(1006, 64, 30, 8, C.farD); p.rect(1014, 44, 14, 20, C.far); p.rect(1020, 36, 2, 8, C.far);
      p.disc(1021, 88, 6, C.farWin); p.rect(1021, 84, 1, 4, C.far); p.rect(1021, 88, 3, 1, C.far);
      S.far = p.done(); S.farY = y0; S.farChim = chim;
    }
    // 中远景：隔壁作坊和工人住宅的背面，晾衣绳，水塔
    {
      const y0 = 360, p = Pix(TW, F0 - y0, true), r = rng(9);
      for (let x = 0; x < TW;) {
        const w = 60 + Math.floor(r() * 80), top = 60 + Math.floor(r() * 40);
        p.rect(x, top, w, F0 - y0 - top, C.mid2);
        for (let k = 0; k < w; k++) p.put(x + k, top + Math.floor(Math.abs(k - w / 2) * 0.35) - Math.floor(w * 0.17), C.mid2D);   // 坡屋顶
        for (let k = 0; k < w; k++) for (let yy = top + Math.floor(Math.abs(k - w / 2) * 0.35) - Math.floor(w * 0.17) + 1; yy < top; yy++) p.put(x + k, yy, C.mid2);
        if (r() < 0.6) { const wx = x + 10 + Math.floor(r() * (w - 26)); p.rect(wx, top + 16, 10, 12, C.mid2D); if (r() < 0.5) p.rect(wx + 2, top + 18, 6, 8, '#5a3424'); }
        x += w + 2;
      }
      // 水塔：四条腿 + 木桶
      p.rect(840, 10, 46, 30, C.mid2D); for (let k = 0; k < 46; k += 6) p.rect(840 + k, 10, 1, 30, C.mid2); p.rect(836, 6, 54, 5, C.mid2D);
      for (const lx of [842, 882]) p.rect(lx, 40, 3, 60, C.mid2D); p.line(845, 50, 882, 90, C.mid2D); p.line(882, 50, 845, 90, C.mid2D);
      S.mid2 = p.done(); S.mid2Y = y0;
    }
    // 中景：铁匠铺本体 + 院子
    {
      const y0 = 190, MW = TW * 2, p = Pix(MW, F0 - y0, true), r = rng(21);   // 两屏宽：拉到最远也只看到一座铁匠铺
      const Y = (wy) => wy - y0;   // 世界 y → 纹理 y
      const B = C.brick;
      // 背后的木板围栏（整圈都有，挡住远处的缝）
      for (let x = 0; x < MW; x += 7) { const top = Y(462) - (Math.floor(x / 7) % 3); p.rect(x, top, 6, Y(GE) - top, (x / 7) % 2 ? C.wood[1] : C.wood[0]); p.put(x + 2, top + 4, C.wood[0]); p.put(x + 2, Y(GE) - 8, C.wood[0]); }
      p.rect(0, Y(474), MW, 2, C.wood[0]); p.rect(0, Y(516), MW, 2, C.wood[0]);
      for (let x = 30; x < MW; x += 97) { p.disc(x, Y(490), 4, C.iron[2], 4); p.disc(x, Y(491), 2, C.wood[1], 2); p.rect(x - 3, Y(492), 7, 3, C.wood[1]); }   // 钉在围栏上的马蹄铁
      // 铁匠铺：砖墙 x 300..760，屋顶、烟囱
      const bx0 = 300, bx1 = 760, wallTop = Y(352);
      for (let yy = wallTop; yy < Y(GE); yy++) {
        const row = Math.floor((yy - wallTop) / 5), mortar = (yy - wallTop) % 5 === 4;
        for (let x = bx0; x < bx1; x++) {
          const joint = ((x + (row % 2 ? 6 : 0)) % 12) === 0;
          const light = 1 - (yy - wallTop) / (Y(GE) - wallTop);
          p.put(x, yy, mortar || joint ? B[0] : hash(Math.floor((x + (row % 2 ? 6 : 0)) / 12), row) < 0.15 ? B[2] : bayer(x, yy) < light * 0.35 ? B[2] : B[1]);
        }
      }
      // 坡屋顶（石板瓦）
      for (let x = bx0 - 16; x < bx1 + 16; x++) {
        const k = Math.abs(x - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2 + 16), top = Math.round(Y(300) + k * 52);
        for (let yy = top; yy < wallTop + 2; yy++) p.put(x, yy, (yy - top) % 6 === 5 || ((x + Math.floor((yy - top) / 6) * 5) % 10 === 0) ? C.slate[0] : yy - top < 2 ? C.slate[2] : C.slate[1]);
      }
      // 屋顶上的天窗（亮着）
      p.rect(430, Y(318), 26, 14, C.slate[0]); p.rect(433, Y(321), 20, 9, C.glow[1]); p.rect(442, Y(321), 1, 9, C.slate[0]);
      // 大烟囱：砖砌，顶上铁帽
      const cx0 = 640, cTop = Y(204);
      for (let yy = cTop; yy < Y(330); yy++) for (let x = cx0; x < cx0 + 30; x++) p.put(x, yy, (yy - cTop) % 5 === 4 || (x + ((Math.floor((yy - cTop) / 5) % 2) ? 5 : 0)) % 10 === 0 ? B[0] : x < cx0 + 5 ? B[2] : B[1]);
      p.rect(cx0 - 3, cTop - 4, 36, 5, C.iron[1]); p.rect(cx0 - 3, cTop - 4, 36, 1, C.iron[2]);
      S.chimney = [cx0 + 15, y0 + cTop - 6];
      // 大门洞：里面暗、炉膛发光（动效另画），门框木头
      const dx0 = 420, dx1 = 548, dTop = Y(420);
      p.rect(dx0 - 5, dTop - 6, dx1 - dx0 + 10, 6, C.wood[2]); p.rect(dx0 - 5, dTop - 6, 5, Y(GE) - dTop + 6, C.wood[1]); p.rect(dx1, dTop - 6, 5, Y(GE) - dTop + 6, C.wood[1]);
      p.rect(dx0, dTop, dx1 - dx0, Y(GE) - dTop, '#150d0b');
      // 炉膛：砖砌炉台 + 炉口（炉火动效画在炉口上）
      p.rect(492, Y(470), 44, Y(GE) - Y(470), B[1]); p.rect(490, Y(468), 48, 4, B[2]); p.rect(500, Y(486), 28, 18, '#0b0707');
      S.hearth = [500, y0 + Y(486), 28, 18];
      p.rect(506, Y(430), 16, 38, B[0]); p.rect(502, Y(426), 24, 5, C.iron[1]);   // 炉罩
      // 屋里挂着的工具剪影
      for (let k = 0; k < 5; k++) { const tx = 430 + k * 11; p.rect(tx, dTop + 6, 1, 14 + (k % 2) * 6, C.iron[1]); p.rect(tx - 2, dTop + 20 + (k % 2) * 6, 5, 3, C.iron[1]); }
      // 铁砧（门口外面，老汤姆就在这儿打铁）
      const ax = 572, ay = Y(GE);
      p.rect(ax, ay - 9, 12, 9, C.wood[1]); p.rect(ax - 1, ay - 9, 14, 1, C.wood[2]);   // 木墩
      p.rect(ax - 4, ay - 16, 22, 5, C.iron[2]); p.rect(ax - 8, ay - 16, 6, 3, C.iron[2]); p.rect(ax + 2, ay - 11, 10, 2, C.iron[1]); p.rect(ax - 4, ay - 16, 22, 1, '#5a4a48');
      S.anvil = [ax + 6, y0 + ay - 17];
      // 窗：暖光 + 十字窗棂
      p.rect(336, Y(420), 40, 30, C.wood[1]); p.rect(339, Y(423), 34, 24, C.glow[1]); p.rect(339, Y(423), 34, 10, C.glow[2]); p.rect(355, Y(423), 2, 24, C.wood[0]); p.rect(339, Y(434), 34, 2, C.wood[0]);
      S.window = [339, y0 + Y(423), 34, 24];
      // 挂招牌的铁架（招牌本身画成动效，会晃）
      p.rect(556, Y(400), 30, 2, C.iron[2]); p.line(556, Y(412), 570, Y(401), C.iron[2]);
      S.sign = [580, y0 + Y(402)];
      // 风箱：靠墙的大皮风箱
      p.rect(390, Y(508), 26, 18, C.wood[1]); for (let k = 0; k < 4; k++) p.rect(390, Y(510) + k * 4, 26, 1, C.wood[0]); p.rect(386, Y(514), 4, 3, C.iron[2]);
      // 棚子 + 废料：车轮、齿轮、管子、旧锅炉壳
      for (let x = 770; x < 920; x++) { const top = Y(446) + Math.floor((x - 770) * 0.12); p.rect(x, top, 1, 3, C.iron[1]); }
      for (const px of [772, 916]) p.rect(px, Y(448), 3, Y(GE) - Y(448), C.wood[1]);
      p.disc(812, Y(512), 22, (x, y, ddx, ddy) => { const rr = Math.hypot(ddx, ddy); return rr > 0.8 || rr < 0.18 || Math.abs(Math.atan2(ddy, ddx) % (Math.PI / 3)) < 0.14 ? C.iron[2] : null; });
      p.disc(862, Y(522), 16, (x, y, ddx, ddy) => { const rr = Math.hypot(ddx, ddy), a = Math.atan2(ddy, ddx); return (rr > 0.72 && (rr < 0.86 || Math.abs(((a / (TAU / 10)) % 1 + 1) % 1 - 0.5) < 0.22)) || rr < 0.25 ? C.iron[1] : null; });
      p.rect(840, Y(528), 70, 10, C.iron[1]); p.rect(840, Y(528), 70, 1, C.iron[2]); for (let k = 0; k < 70; k += 9) p.rect(840 + k, Y(528), 1, 10, C.iron[0]);
      // 煤堆 + 水槽 + 木桶
      for (let k = -30; k <= 30; k++) { const hh = Math.round(18 * (1 - (k / 30) ** 2)); p.rect(250 + k, Y(GE) - hh, 1, hh, (k + hh) % 3 ? '#161213' : '#221c1d'); }
      p.rect(610, Y(522), 40, 16, C.wood[1]); p.rect(612, Y(524), 36, 3, '#2e3a44'); p.rect(610, Y(522), 40, 2, C.wood[2]);
      for (const bx of [960, 986]) { p.rect(bx, Y(512), 22, 26, C.wood[1]); p.rect(bx, Y(518), 22, 2, C.iron[1]); p.rect(bx, Y(530), 22, 2, C.iron[1]); p.rect(bx, Y(512), 22, 1, C.wood[2]); }
      // 煤气路灯（灯罩亮暖黄，火苗动效另画）
      const lx = 1100; p.rect(lx, Y(420), 3, Y(GE) - Y(420), C.iron[1]); p.rect(lx - 5, Y(418), 13, 3, C.iron[2]); p.rect(lx - 3, Y(404), 9, 14, C.iron[1]);
      S.lamp = [lx - 2, y0 + Y(406)];
      // 砂轮
      p.disc(1180, Y(520), 12, (x, y, ddx, ddy) => (Math.hypot(ddx, ddy) > 0.8 ? '#3a3232' : '#4a4040')); p.rect(1170, Y(530), 20, 8, C.wood[1]);
      S.wheel = [1180, y0 + Y(520)];
      // 地面边：院子里的煤渣
      p.rect(0, Y(GE), MW, F0 - GE, C.gnd[1]);
      for (let x = 0; x < MW; x++) if (hash(x, 3) < 0.3) p.put(x, Y(GE) + Math.floor(hash(x, 5) * 14), C.gnd[2]);
      // 后半圈：煤棚、木吊杆（吊着一只旧锅炉壳，动效另画）、一摞车轮、架在木马上造了一半的锅炉、第二盏路灯
      const sx0 = 1420;
      p.rect(sx0, Y(452), 170, 4, C.wood[2]); p.rect(sx0, Y(452), 170, 1, '#5a3c28');
      for (const px of [sx0 + 2, sx0 + 84, sx0 + 164]) p.rect(px, Y(456), 4, Y(GE) - Y(456), C.wood[1]);
      p.rect(sx0 + 6, Y(460), 158, Y(GE) - Y(460), '#140e0c');
      for (let k = -70; k <= 70; k++) { const hh = Math.round(34 * (1 - (k / 70) ** 2)); p.rect(sx0 + 84 + k, Y(GE) - hh, 1, hh, (k + hh) % 3 ? '#1a1516' : '#2a2224'); }
      p.rect(sx0 + 20, Y(GE) - 22, 14, 22, C.wood[1]); p.rect(sx0 + 18, Y(GE) - 24, 18, 3, C.iron[1]);   // 煤桶
      const cx = 1760;   // 木吊杆：立柱 + 斜撑 + 往右伸的吊臂
      p.rect(cx, Y(350), 6, Y(GE) - Y(350), C.wood[1]); p.rect(cx, Y(350), 2, Y(GE) - Y(350), C.wood[2]);
      p.line(cx - 34, Y(GE), cx, Y(430), C.wood[1], 3); p.line(cx + 40, Y(GE), cx + 6, Y(430), C.wood[1], 3);
      p.line(cx + 3, Y(356), cx + 110, Y(372), C.wood[1], 4); p.line(cx + 3, Y(352), cx + 110, Y(370), C.wood[2]);
      p.line(cx + 3, Y(340), cx + 104, Y(370), C.iron[1]); p.rect(cx - 1, Y(340), 8, 4, C.iron[2]);
      p.disc(cx + 12, Y(470), 7, (x, y, a, b) => (Math.hypot(a, b) > 0.6 ? C.iron[2] : C.iron[0]));   // 绞盘
      S.hook = [cx + 106, y0 + Y(372)];
      for (let i = 0; i < 4; i++) p.disc(1960 + i * 9, Y(GE) - 18, 17, (x, y, a, b) => { const rr = Math.hypot(a, b); return rr > 0.78 || rr < 0.2 || Math.abs(a) < 0.1 ? (i % 2 ? C.wood[2] : C.wood[1]) : null; }, 18);   // 靠着围栏的一摞车轮
      const bx = 2150;   // 造了一半的锅炉：铆钉圆筒 + 两个木马 + 散着的铆钉
      for (const tx of [bx + 8, bx + 92]) { p.line(tx - 10, Y(GE), tx, Y(508), C.wood[1], 3); p.line(tx + 10, Y(GE), tx, Y(508), C.wood[1], 3); p.rect(tx - 12, Y(508), 24, 3, C.wood[2]); }
      p.rect(bx - 6, Y(478), 112, 30, C.iron[1]); p.rect(bx - 6, Y(478), 112, 4, C.iron[2]); p.rect(bx - 6, Y(504), 112, 4, C.iron[0]);
      for (let k = 0; k < 112; k += 8) { p.put(bx - 4 + k, Y(481), '#6a5a52'); p.put(bx - 4 + k, Y(502), C.iron[2]); }
      for (const k of [30, 64]) p.rect(bx - 6 + k, Y(478), 2, 30, C.iron[0]);
      p.disc(bx - 6, Y(493), 5, C.iron[2], 15); p.rect(bx + 104, Y(480), 6, 26, C.iron[0]);   // 封头 + 没装好的一头
      const lx2 = 2380; p.rect(lx2, Y(420), 3, Y(GE) - Y(420), C.iron[1]); p.rect(lx2 - 5, Y(418), 13, 3, C.iron[2]); p.rect(lx2 - 3, Y(404), 9, 14, C.iron[1]);
      S.lamp2 = [lx2 - 2, y0 + Y(406)];
      S.mid = p.done(); S.midY = y0;
    }
    // 地面（世界坐标 1:1）：煤渣院子 + 截面
    S.floor = floorTex(C.gnd, (p, x, y) => {
      const d = y + F0;
      if (d < GROUND) { const k = (d - F0) / (GROUND - F0); return bayer(x, y) < k * 0.6 ? C.gnd[2] : C.gnd[1]; }
      return null;
    }, [['#141011', 0.05], ['#3a2f2a', 0.03]], (p, r, Y) => {
      // 几片旧鹅卵石路面、煤块、两个映着晚霞的水洼、车辙、散落的螺栓
      for (let i = 0; i < 9; i++) { const cx = r() * TW, cy = Y(572 + r() * 56), n = 6 + r() * 8; for (let k = 0; k < n; k++) { const sx = cx + (r() - 0.5) * 70, sy = cy + (r() - 0.5) * 20, sw = 6 + Math.floor(r() * 4); p.rect(sx, sy, sw, 4, C.gnd[3]); p.rect(sx, sy, sw, 1, C.gnd[4]); p.rect(sx, sy + 4, sw, 1, C.gnd[0]); } }
      for (let i = 0; i < 140; i++) { const x = r() * TW, y = Y(556 + r() * 88); p.rect(x, y, r() < 0.3 ? 3 : 2, 2, '#121011'); p.put(x, y, '#2e2a2c'); }
      for (const px of [260, 900]) { const py = Y(604); p.disc(px, py, 34, (x, y, aa, bb) => (bb < -0.1 ? '#3f2229' : '#2c1c22'), 5); p.rect(px - 20, py - 2, 16, 1, '#723827'); p.rect(px + 6, py + 1, 9, 1, '#58292a'); }
      for (let x = 0; x < TW; x++) { if (hash(x >> 3, 7) < 0.8) p.put(x, Y(634), C.gnd[0]); if (hash(x >> 3, 9) < 0.8) p.put(x, Y(641), C.gnd[0]); }
      for (let i = 0; i < 16; i++) { const x = r() * TW, y = Y(560 + r() * 80); p.rect(x, y, 3, 2, '#3a3232'); p.put(x, y, '#6a5a50'); }
    });
    // 近景：废料堆、铁砧、木桶、野草剪影（最暗），顶边被炉火映红
    S.near = nearTex(1680, 64, (p, r) => {
      const heap = (cx, w, hh) => { for (let k = -w; k <= w; k++) { const t = Math.round(hh * (1 - (k / w) ** 2) + (hash(cx + k, 1) - 0.5) * 3); p.rect(cx + k, 64 - t, 1, t, C.near); } };
      heap(140, 90, 34); heap(760, 70, 26); heap(1300, 110, 40);
      p.disc(120, 32, 18, (x, y, a, b) => (Math.hypot(a, b) > 0.7 || Math.abs(a) < 0.12 || Math.abs(b) < 0.12 ? C.near : null));   // 半埋的车轮
      p.rect(1270, 12, 44, 8, C.near); p.rect(1262, 12, 10, 4, C.near); p.rect(1282, 20, 20, 44, C.near);   // 铁砧 + 墩子
      p.disc(500, 58, 26, (x, y, a, b) => { const rr = Math.hypot(a, b), an = Math.atan2(b, a); return rr > 0.78 && Math.abs(((an / (TAU / 12)) % 1 + 1) % 1 - 0.5) > 0.22 ? null : rr < 0.3 && rr > 0.15 ? null : C.near; });   // 半埋的大齿轮
      for (let k = 0; k < 9; k++) p.rect(560 + k * 7, 40 + Math.round(Math.sin(k * 0.7) * 4), 6, 3, C.near);   // 一截铁链
      for (let k = 0; k < 40; k++) { const x = Math.floor(r() * 1680), hh = 6 + Math.floor(r() * 12); p.line(x, 64, x + (r() - 0.5) * 6, 64 - hh, C.near); }
      p.line(900, 64, 960, 20, C.near, 3); p.line(960, 20, 1000, 64, C.near, 3);   // 斜靠的管子
    }, C.rim);
    // ---- 每帧 ----
    const tom = (pose) => coalSprite('铁匠 老汤姆', pose, 'normal', 1), uncle = (pose, expr = 'normal') => coalSprite('远房亲戚', pose, expr, -1);
    S.back = (g, vw, vh, oy, camx, t, opts) => {
      paintSky(g, S, vw, vh, oy);
      // 月牙 + 金星
      const mx = Math.round(vw * 0.2), my = Math.round(80 - oy);
      blob(g, mx, my, 9, '#a07860'); blob(g, mx + 4, my - 2, 8, '#1d1521');
      R(g, Math.round(vw * 0.62), Math.round(40 - oy), 1, 1, '#c89a70');
      for (let i = 0; i < 26; i++) { const x = Math.round(hash(i, 1) * vw), y = Math.round(-260 + hash(i, 2) * 300 - oy); if (Math.sin(t * (1 + hash(i, 3) * 2) + i) > -0.3) R(g, x, y, 1, 1, i % 3 ? '#6a5060' : '#8a6a70'); }   // 早出的星星，一闪一闪
      clouds(g, S, vw, oy, camx, t);
      birds(g, vw, oy, t, 250, 38, '#1a1014');
      strip(g, S.far, S.farY, camx * 0.05, vw, oy);
      for (const [u, y] of S.farChim) spots(u, camx * 0.05, TW, vw, 60, (x) => smoke(g, x, y - oy, t, u, ['#40303a', '#523a3e'], 0.6, 50, 20));
      strip(g, S.mid2, S.mid2Y, camx * 0.18, vw, oy);
      strip(g, S.mid, S.midY, camx * 0.45, vw, oy);
      const rot = camx * 0.45, MW = S.mid.width;
      const flick = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 7.3), strike = (t % 0.9) / 0.9;
      // 炉膛：火苗 + 门口地上的光斑
      spots(S.hearth[0], rot, MW, vw, 200, (x) => {
        const [, hy, hw, hh] = S.hearth, y = hy - oy;
        R(g, x, y + hh - 8, hw, 8, P.fire[1]); R(g, x + 2, y + hh - 12, hw - 4, 6, P.fire[2]);
        for (let i = 0; i < 5; i++) { const fh = 4 + ((Math.sin(t * 13 + i * 2.1) + 1) * 3) | 0; R(g, x + 3 + i * 5, y + hh - 10 - fh, 3, fh, i % 2 ? P.fire[2] : P.fire[3]); }
        g.globalAlpha = 0.16 * flick; R(g, x - 90, GE - 8 - oy, 150, 22, P.fire[2]); g.globalAlpha = 0.1 * flick; R(g, x - 76, S.hearth[1] - 50 - oy, 104, 60, P.fire[2]); g.globalAlpha = 1;
      });
      // 窗里的炉光一明一暗
      spots(S.window[0], rot, MW, vw, 60, (x) => { g.globalAlpha = 0.3 * flick; R(g, x, S.window[1] - oy, S.window[2], S.window[3], P.fire[3]); g.globalAlpha = 1; });
      // 烟囱：粗烟 + 偶尔窜出的火星
      spots(S.chimney[0], rot, MW, vw, 120, (x) => {
        smoke(g, x, S.chimney[1] - oy, t, 3, ['#3e3036', '#5a4644'], 1.5, 110, 50);
        for (let i = 0; i < 4; i++) { const f = (t * 0.7 + i / 4) % 1; if (f < 0.5) R(g, x - 4 + i * 3 + Math.sin(f * 9 + i) * 5, S.chimney[1] - oy - f * 60, 1, 1, f < 0.25 ? P.fire[3] : P.fire[2]); }
      });
      // 老汤姆打铁 + 远房亲戚在门口（和老汤姆对打的那一关，他在对面车里，这里只剩亲戚）
      const tomHere = !(opts && opts.storyKey === '0,2');
      spots(S.anvil[0], rot, MW, vw, 80, (x) => {
        if (opts && opts.noCast) return;   // 主页面（js/home.js）用这张底图，人物由它自己画
        const ay = S.anvil[1] - oy, foot = ay + 17 - 34;   // 小人 40×40，身子底边在第 34 行，踩在地面 GE 上
        if (tomHere) {
          const up = strike < 0.55;
          g.drawImage(tom(up ? 'cheer' : 'hold'), x - 42, foot + (up ? 0 : 1));   // 铁砧左边，面朝铁砧抡锤
          if (strike > 0.55 && strike < 0.8) for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.33, k = (strike - 0.55) / 0.25, d = 3 + k * (10 + (i % 3) * 5); R(g, x + Math.cos(a) * d, ay + Math.sin(a) * d + k * k * 6, 1, 1, k < 0.5 ? P.fire[3] : P.fire[2]); }
        }
        const cheer = !tomHere && Math.floor(t / 1.6) % 3 === 0, bob = Math.floor(t * 2) % 2;
        g.drawImage(uncle(cheer ? 'cheer' : Math.floor(t / 5) % 4 === 3 ? 'salute' : 'idle', cheer ? 'happy' : 'normal'), x + 6, foot - bob);   // 铁砧右边，看着老汤姆
      });
      // 招牌（铁砧形）在风里慢慢晃
      spots(S.sign[0], rot, MW, vw, 40, (x) => {
        const a = Math.sin(t * 1.3) * 0.12, y = S.sign[1] - oy;
        g.save(); g.translate(x, y); g.rotate(a);
        R(g, -1, 0, 1, 6, '#3a3232'); R(g, -9, 6, 18, 12, C.wood[1]); R(g, -9, 6, 18, 1, C.wood[2]);
        R(g, -6, 9, 12, 3, '#8a7a70'); R(g, -3, 12, 6, 3, '#8a7a70'); R(g, -8, 9, 3, 2, '#8a7a70');
        g.restore();
      });
      spots(S.lamp[0], rot, MW, vw, 40, (x) => { R(g, x, S.lamp[1] - oy, 7, 10, P.fire[2]); R(g, x + 2, S.lamp[1] + 2 - oy, 3, 5 + (Math.sin(t * 11) > 0 ? 1 : 0), P.fire[3]); g.globalAlpha = 0.08; blob(g, x + 3, S.lamp[1] + 5 - oy, 26, P.fire[2]); g.globalAlpha = 1; });
      spots(S.lamp2[0], rot, MW, vw, 40, (x) => { R(g, x, S.lamp2[1] - oy, 7, 10, P.fire[2]); R(g, x + 2, S.lamp2[1] + 2 - oy, 3, 5 + (Math.sin(t * 9 + 1) > 0 ? 1 : 0), P.fire[3]); g.globalAlpha = 0.08; blob(g, x + 3, S.lamp2[1] + 5 - oy, 26, P.fire[2]); g.globalAlpha = 1; });
      // 吊杆上吊着的旧锅炉壳，慢慢打转摆动
      spots(S.hook[0], rot, MW, vw, 60, (x) => {
        const y = S.hook[1] - oy, sw = Math.sin(t * 0.9) * 4, L = 70, ex = x + sw, ey = y + L;
        g.fillStyle = '#1e1a1a'; for (let k = 0; k <= L; k += 1) g.fillRect(Math.round(x + sw * k / L), y + k, 1, 1);
        R(g, ex - 2, ey, 5, 4, '#3a3232');
        const w = 26 + Math.round(Math.cos(t * 0.6) * 6);   // 转动时宽窄变化
        R(g, ex - w / 2, ey + 4, w, 22, C.iron[1]); R(g, ex - w / 2, ey + 4, w, 3, C.iron[2]); R(g, ex - w / 2, ey + 23, w, 3, C.iron[0]);
        R(g, ex - w / 2 + 3, ey + 12, 1, 1, '#6a5a52'); R(g, ex + w / 2 - 4, ey + 12, 1, 1, '#6a5a52');
      });
      // 砂轮在转（辐条）
      spots(S.wheel[0], rot, MW, vw, 30, (x) => { const a = t * 3; for (let k = 0; k < 3; k++) { const b = a + k * TAU / 3; R(g, x + Math.cos(b) * 7, S.wheel[1] - oy + Math.sin(b) * 7, 2, 2, '#2a2424'); } });
    };
    S.front = (g, vw, vh, oy, camx, t) => {
      nearLayer(g, S.near, vw, vh, camx);
      // 空气里飘的火星（近处，最亮但很小）
      for (let i = 0; i < 14; i++) {
        const f = (t * (0.06 + (i % 5) * 0.012) + i * 0.137) % 1, x = ((i * 211 + t * 12 - camx * 1.2) % (vw + 80) + vw + 80) % (vw + 80) - 40 + Math.sin(t * 1.7 + i) * 10;
        const y = vh - f * vh * 0.85;
        g.globalAlpha = f < 0.1 ? f * 10 : f > 0.8 ? (1 - f) * 5 : 1;
        R(g, x, y, i % 4 ? 1 : 2, 1, i % 3 ? P.fire[2] : P.fire[3]);
      }
      g.globalAlpha = 1;
    };
    return S;
  }

  // =====================================================================
  // 野地：阴天傍晚的荒原。远山、山头上转着的风车、高架桥上开过的蒸汽火车；中景是干砌石墙、电报线杆、歪脖子山楂树；
  // 近景是随风摆动的长草、蓟、栅栏桩，草籽飘过
  // =====================================================================
  function buildWild() {
    const S = { id: 'wild' };
    const C = {
      sky: [[SKY0, '#222a32'], [60, '#28313a'], [190, '#36404a'], [280, '#465052'], [340, '#585e56'], [390, '#6a6a56'], [430, '#787258'], [HZ + 160, '#787258']],
      hill1: '#4a525a', hill1D: '#444c54', hill2: '#3a4640', hill2D: '#34403a',
      field: ['#2a3526', '#313d2a', '#3a4830', '#4c5838'], stone: ['#2e302c', '#3c3e38', '#4c4e46', '#5a5c52'], wood: ['#221c16', '#2e261e', '#3c3226'],
      gorse: ['#1e2618', '#2a3420', '#6a6a3a'], near: '#0f130f', rim: '#2a3326',
      gnd: ['#1c1a14', '#262219', '#30291e', '#3a3226', '#4a4030'],
    };
    C.rim = ['#3e4a36', '#1e2a1c'];
    S.skyTop = C.sky[0][1];
    S.sky = skyTex(C.sky);
    S.clouds = [0, 1, 2, 3, 4].map(i => ({ img: cloud(220 + (i % 3) * 70, 44 + (i % 2) * 16, ['#3c464e', '#4c5456', '#76705c'], 31 + i), x: i * 380, y: 40 + (i % 3) * 70, v: 5 + (i % 3) * 2.5, par: 0.015 }));
    // 远景：两道远山 + 高架桥 + 山头风车塔
    {
      const y0 = 300, p = Pix(TW, F0 - y0, true);
      for (let x = 0; x < TW; x++) {
        const a = Math.round(ridge(x, 70, [[18, 1], [9, 3], [4, 7]], 1.3)), b = Math.round(ridge(x, 98, [[14, 2], [6, 5], [3, 11]], 2.9));
        for (let y = a; y < F0 - y0; y++) p.put(x, y, y < b ? (y - a < 2 ? '#5a6064' : C.hill1) : y - b < 2 ? '#48544a' : C.hill2);
      }
      // 高架桥：一排拱，桥面在 y0 + 88
      const vx0 = 120, vx1 = 620, deck = 88;
      for (let x = vx0; x < vx1; x++) {
        p.rect(x, deck, 1, 4, C.hill2D);
        const k = (x - vx0) % 36, pier = k < 6, crown = 6 + (15 - Math.sqrt(Math.max(0, 225 - (k - 21) ** 2)));   // 拱顶离桥面 6px，两边往下落
        for (let y = deck + 4; y < F0 - y0; y++) if (pier || y - deck - 4 < crown) p.put(x, y, C.hill2D);
      }
      S.viaduct = [vx0, vx1, y0 + deck];
      // 风车塔（叶片动效另画）
      const wx = 900, wy = Math.round(ridge(wx, 70, [[18, 1], [9, 3], [4, 7]], 1.3));
      for (let k = 0; k < 34; k++) p.rect(wx - 4 - k / 6, wy - 34 + k, 8 + k / 3, 1, C.hill2D);   // 上窄下宽的塔身
      p.rect(wx - 5, wy - 38, 10, 5, C.hill2D);
      S.mill = [wx, y0 + wy - 34];
      S.far = p.done(); S.farY = y0;
    }
    // 中远景：近一点的缓坡、树篱、石头农舍（冒烟）、草垛、零星的树
    {
      const y0 = 400, p = Pix(TW, F0 - y0, true), r = rng(3);
      for (let x = 0; x < TW; x++) {
        const top = Math.round(ridge(x, 42, [[10, 2], [5, 5]], 4.1));
        for (let y = top; y < F0 - y0; y++) p.put(x, y, y - top < 2 ? C.field[3] : y - top < 8 ? (bayer(x, y) < 0.5 ? C.field[2] : C.field[1]) : C.field[1]);   // 坡顶被夕阳照亮
        if (x % 3 === 0 && hash(x, 7) < 0.9) { const hy = top + 18 + Math.round(Math.sin(x / 60) * 6); p.rect(x, hy, 3, 3, C.field[0]); }   // 树篱线
      }
      const tree = (tx, ty, rr) => { p.rect(tx - 1, ty, 3, rr + 4, C.wood[0]); p.disc(tx, ty, rr, (x, y, a, b) => (b < -0.3 && a < 0 && bayer(x, y) < 0.5 ? C.field[2] : C.field[0])); };
      for (let i = 0; i < 9; i++) { const tx = Math.floor(r() * TW); tree(tx, Math.round(ridge(tx, 42, [[10, 2], [5, 5]], 4.1)) - 8, 6 + Math.floor(r() * 5)); }
      // 石头农舍：墙 + 石板屋顶 + 烟囱 + 亮窗
      const hx = 460, hy = Math.round(ridge(hx, 42, [[10, 2], [5, 5]], 4.1));
      p.rect(hx, hy - 20, 44, 26, C.stone[1]); for (let k = 0; k < 44; k++) p.rect(hx + k, hy - 20 - Math.floor(12 - Math.abs(k - 22) * 0.55), 1, Math.floor(12 - Math.abs(k - 22) * 0.55) + 1, C.stone[0]);
      p.rect(hx + 32, hy - 36, 5, 10, C.stone[0]); p.rect(hx + 8, hy - 12, 6, 6, '#8a6a3a'); p.rect(hx + 22, hy - 12, 8, 18, C.wood[0]);
      S.cottage = [hx + 34, y0 + hy - 37, hx + 8, y0 + hy - 12];
      // 草垛
      for (const sx of [180, 780, 1040]) { const sy = Math.round(ridge(sx, 42, [[10, 2], [5, 5]], 4.1)) + 6; p.disc(sx, sy, 10, (x, y, a, b) => (b < -0.2 && a < 0.2 ? '#4a4630' : '#3a3726'), 9); p.rect(sx - 10, sy, 21, 4, '#34321f'); }
      S.mid2 = p.done(); S.mid2Y = y0;
    }
    // 中景：干砌石墙 + 电报线杆 + 山楂树 + 荆豆丛 + 路牌 + 立石
    {
      const y0 = 300, p = Pix(TW, F0 - y0, true), r = rng(17), Y = (wy) => wy - y0;
      // 背后的荒草坡（整圈连续）
      for (let x = 0; x < TW; x++) { const top = Y(488) + Math.round(ridge(x, 0, [[6, 3], [3, 8]], 0.7)); for (let y = top; y < F0 - y0; y++) p.put(x, y, y - top < 1 ? C.field[3] : bayer(x, y) < 0.35 ? C.field[1] : C.field[2]); }
      // 干砌石墙：一块块圆角石头
      for (let x = 0; x < TW; x += 9) for (let row = 0; row < 4; row++) {
        if ((x > 540 && x < 620 && row > 1)) continue;   // 豁口
        const sx = x + (row % 2) * 4 + Math.floor(hash(x, row) * 3), sy = Y(GE) - 8 - row * 7, sw = 8 + Math.floor(hash(x, row + 9) * 3);
        p.rect(sx, sy, sw, 6, C.stone[1]); p.rect(sx, sy, sw, 1, C.stone[2]); p.rect(sx, sy, 1, 6, C.stone[2]); p.put(sx, sy, C.stone[0]); p.put(sx + sw - 1, sy + 5, C.stone[0]);
        p.rect(sx, sy + 6, sw, 1, C.stone[0]);
      }
      p.rect(0, Y(GE), TW, F0 - GE, C.gnd[1]);
      // 电报线杆（线另画，好让它随风轻晃）
      S.poles = [];
      for (let x = 80; x < TW; x += 312) { p.rect(x, Y(356), 3, Y(GE) - Y(356), C.wood[1]); p.rect(x, Y(356), 1, Y(GE) - Y(356), C.wood[2]); p.rect(x - 9, Y(362), 21, 2, C.wood[1]); p.rect(x - 7, Y(374), 17, 2, C.wood[1]); for (const k of [-8, -2, 5, 11]) p.put(x + k, Y(361), C.stone[3]); S.poles.push(x + 1); }
      // 山楂树：被风吹歪的树干 + 一侧茂密的树冠
      const tx = 610;
      p.line(tx, Y(GE), tx + 8, Y(470), C.wood[1], 5); p.line(tx + 8, Y(470), tx + 30, Y(420), C.wood[1], 4); p.line(tx + 14, Y(456), tx - 10, Y(430), C.wood[1], 3); p.line(tx + 26, Y(428), tx + 56, Y(410), C.wood[0], 2);
      for (let i = 0; i < 26; i++) { const cx = tx + 12 + r() * 60, cy = Y(412) + r() * 30 - (cx - tx) * 0.1; p.disc(cx, cy, 6 + r() * 6, (x, y, a, b) => (b < -0.2 && a < 0.2 && bayer(x, y) < 0.6 ? C.gorse[1] : C.gorse[0]), 5 + r() * 3); }
      S.tree = [tx + 40, y0 + Y(414)];
      // 荆豆丛（黄花点）
      for (const gx of [220, 420, 980, 1150]) { for (let i = 0; i < 6; i++) p.disc(gx + (i - 2.5) * 8 + r() * 4, Y(GE) - 6 - r() * 6, 7, (x, y, a, b) => (b < -0.3 && bayer(x, y) < 0.5 ? C.gorse[1] : C.gorse[0]), 6); for (let i = 0; i < 12; i++) p.put(gx - 20 + r() * 44, Y(GE) - 4 - r() * 14, C.gorse[2]); }
      // 路牌 + 立石
      p.rect(870, Y(486), 3, 52, C.wood[1]); p.rect(858, Y(488), 26, 7, C.wood[2]); p.rect(880, Y(489), 6, 5, C.wood[2]); p.rect(862, Y(499), 20, 6, C.wood[1]); p.rect(856, Y(500), 6, 4, C.wood[1]);
      p.disc(1060, Y(GE) - 20, 9, (x, y, a) => (a < -0.3 ? C.stone[2] : C.stone[1]), 22); p.rect(1051, Y(GE) - 4, 19, 4, C.stone[0]);
      // 翻倒的车轮
      p.disc(330, Y(GE) - 6, 12, (x, y, a, b) => { const rr = Math.hypot(a, b); return rr > 0.75 || rr < 0.2 || Math.abs(a) < 0.1 || Math.abs(b) < 0.1 ? C.wood[1] : null; }, 5);
      S.mid = p.done(); S.midY = y0;
      // 电报线一跨（杆距 312）：两根下垂的线，按风摆幅画 6 帧
      S.wires = [0, 1, 2, 3, 4, 5].map(f => {
        const q = Pix(314, 44), sway = (f / 5 * 2 - 1) * 1.5;
        for (const [wy, sag] of [[5, 14], [17, 17]]) for (let k = 0; k <= 312; k++) q.put(k, Math.round(wy + Math.sin(k / 312 * Math.PI) * (sag + sway)), '#1a1c1a');
        return q.done();
      });
      S.tufts = []; for (let i = 0; i < 70; i++) S.tufts.push([Math.floor(hash(i, 4) * TW), Math.floor(hash(i, 5) * 4) + 3]);
    }
    S.floor = floorTex(C.gnd, (p, x, y) => {
      const d = y + F0;
      if (d < GROUND - 26) { const k = (d - F0) / (GROUND - 26 - F0); return bayer(x, y) < 0.15 + k * 0.35 ? C.field[0] : C.field[1]; }
      if (d < GROUND) { const k = (d - (GROUND - 26)) / 26; return bayer(x, y) < k ? C.gnd[3] : C.gnd[2]; }
      return null;
    }, [['#141210', 0.04]], (p, r, Y) => {
      // 草地：一簇簇亮一点的草、零星的蓟花和金雀花；下面一条土路（两道车辙、积水、石子）
      for (let i = 0; i < 520; i++) { const x = Math.floor(r() * TW), y = Math.floor(Y(556 + r() * 62)), c = r() < 0.5 ? C.field[2] : C.field[3]; p.put(x, y, c); p.put(x - 1, y - 1, c); p.put(x + 1, y - 1, c); if (r() < 0.4) p.put(x, y - 2, c); }
      for (let i = 0; i < 50; i++) { const x = r() * TW, y = Y(560 + r() * 56), c = r() < 0.5 ? '#5e4a5e' : '#6e6a3a'; p.put(x, y + 1, C.field[3]); p.rect(x - 1, y - 1, 2, 2, c); }
      for (let x = 0; x < TW; x++) { p.put(x, Y(GROUND - 26), C.field[0]); if (hash(x >> 2, 3) < 0.85) p.put(x, Y(GROUND - 17), C.gnd[1]); if (hash(x >> 2, 5) < 0.85) p.put(x, Y(GROUND - 7), C.gnd[1]); }
      for (const px of [300, 820]) { p.rect(px, Y(GROUND - 19), 38, 3, '#3a4146'); p.rect(px + 4, Y(GROUND - 19), 12, 1, '#575e5c'); }
      for (let i = 0; i < 40; i++) { const x = r() * TW, y = Y(GROUND - 24 + r() * 22); p.rect(x, y, 2, 1, C.gnd[4]); }
    });
    S.near = nearTex(1520, 64, (p, r) => {
      // 栅栏桩 + 带刺铁丝、一块大圆石
      for (const fx of [200, 520, 1100]) { p.rect(fx, 8, 6, 56, C.near); p.rect(fx - 1, 6, 8, 3, C.near); }
      p.line(200, 18, 520, 22, C.near); p.line(200, 32, 520, 36, C.near);
      p.disc(820, 60, 40, C.near, 22);
    }, C.rim);
    // 近景的长草：固定位置、按时间摆（离画面近，摆幅大）
    // 近景的长草：12 帧一个循环（4 秒），每根草按自己的相位摆，帧里预先画好
    S.grass = []; { const r = rng(77); for (let i = 0; i < 90; i++) S.grass.push([r() * 1520, 12 + r() * 28, r() < 0.12 ? 'thistle' : r() < 0.3 ? 'reed' : 'blade', r() * TAU]); }
    S.grassFrames = Array.from({ length: 12 }, (_, f) => {
      const q = Pix(1520, 72, true), a = f / 12 * TAU, wind = Math.sin(a) * 0.6 + Math.sin(2 * a + 1) * 0.25, H0 = 71;
      for (const [u, hh, kind, ph] of S.grass) {
        const bend = (wind + Math.sin(a + ph) * 0.15) * hh * 0.35;
        for (let k = 0; k < hh; k++) { const ff = k / hh, x = u + bend * ff * ff; q.rect(Math.round(x), H0 - k, kind === 'reed' ? 2 : 1, 1, C.near); if (kind === 'blade' && k < hh * 0.6) q.put(Math.round(u + 3 + bend * 0.8 * ff * ff), H0 - k, C.near); }
        const tx = u + bend;
        if (kind === 'thistle') { q.disc(tx, H0 - hh - 2, 3, C.near); q.rect(Math.round(tx) - 2, H0 - hh - 6, 5, 2, '#3a2e3a'); }
        if (kind === 'reed') q.rect(Math.round(tx) - 1, H0 - hh - 6, 3, 7, C.near);
      }
      return q.done();
    });
    // ---- 每帧 ----
    S.back = (g, vw, vh, oy, camx, t) => {
      paintSky(g, S, vw, vh, oy);
      // 云后的淡太阳
      const sx = Math.round(vw * 0.72), sy = Math.round(318 - oy);
      g.globalAlpha = 0.1; blob(g, sx, sy, 70, '#9a8e66'); blob(g, sx, sy, 44, '#9a8e66'); g.globalAlpha = 1; blob(g, sx, sy, 18, '#b0a070');
      // 从云缝里斜着漏下来的几道光，慢慢变强变弱
      for (let i = 0; i < 4; i++) {
        const a = 0.035 + 0.025 * Math.sin(t * 0.3 + i * 1.7), x0 = sx - 180 + i * 70;
        g.globalAlpha = Math.max(0, a); g.fillStyle = '#b0a070';
        for (let y = -150; y < 180; y += 2) { const k = (y + 150) / 330, l = x0 + (-170 + i * 30) * k, r = x0 + 26 + (-146 + i * 30) * k; g.fillRect(Math.round(l), sy + y, Math.round(r - l), 2); }   // 按 2px 一行画，不做抗锯齿的斜边
      }
      g.globalAlpha = 1;
      clouds(g, S, vw, oy, camx, t);
      birds(g, vw, oy, t + 11, 170, 46, '#23282a', -1);
      strip(g, S.far, S.farY, camx * 0.04, vw, oy);
      const rF = camx * 0.04;
      // 风车叶片：四片十字，一直在转
      spots(S.mill[0], rF, TW, vw, 40, (x) => {
        const y = S.mill[1] - oy, a = t * 0.9;
        for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; for (let d = 2; d < 24; d++) { const px = x + Math.cos(b) * d, py = y + Math.sin(b) * d; R(g, px, py, 1, 1, C.hill2D); if (d > 8) R(g, px - Math.sin(b) * 2, py + Math.cos(b) * 2, 1, 1, C.hill2D); } }
        R(g, x - 1, y - 1, 3, 3, C.hill2D);
      });
      // 高架桥上的火车：每 40 秒开过一趟（车头 + 煤水车 + 四节车厢），后面拖一串白烟
      const [v0, v1, vy] = S.viaduct, span = v1 - v0 + 200, pos = (t * 28) % (span * 2.2) - 100;
      if (pos < span) spots(v0 + pos, rF, TW, vw, 200, (x) => {
        const y = vy - oy;
        for (let k = 0; k < 6; k++) { const cx = x - k * 17; if (cx < 0 && cx < -20) continue; R(g, cx - 14, y - 9, k ? 15 : 14, k ? 8 : 9, C.hill2D); if (k === 0) { R(g, cx - 4, y - 14, 3, 5, C.hill2D); R(g, cx - 14, y - 12, 5, 3, C.hill2D); } }
        for (let i = 0; i < 8; i++) { const f = i / 8, px = x - 2 - i * 9 - ((t * 20) % 9), py = y - 16 - f * 10 - Math.sin(i + t) * 1.5; g.globalAlpha = 0.55 * (1 - f); blob(g, px, py, 3 + f * 5, '#6e706a'); }
        g.globalAlpha = 1;
      });
      strip(g, S.mid2, S.mid2Y, camx * 0.15, vw, oy);
      spots(S.cottage[0], camx * 0.15, TW, vw, 60, (x) => smoke(g, x, S.cottage[1] - oy, t, 5, ['#4a5050', '#5c6260'], 0.7, 60, 40));
      spots(S.cottage[2], camx * 0.15, TW, vw, 10, (x) => { if (Math.sin(t * 0.7) > -0.8) R(g, x, S.cottage[3] - oy, 6, 6, '#a07a40'); });
      strip(g, S.mid, S.midY, camx * 0.45, vw, oy);
      const rM = camx * 0.45, sway = Math.sin(t * 0.8) * 1.5;
      // 电报线：两根杆之间下垂的弧，随风轻轻晃（6 帧预先画好）
      const wire = S.wires[Math.floor((Math.sin(t * 0.8) + 1) / 2 * 5.99)];
      for (const a of S.poles) spots(a, rM, TW, vw, 330, (x) => g.drawImage(wire, x, 356 - oy));
      // 墙头的草丛随风摆
      g.fillStyle = C.field[3];
      for (const [u, hh] of S.tufts) spots(u, rM, TW, vw, 10, (x) => { const s = Math.round(Math.sin(t * 2 + u) * 1.2 + sway * 0.5); g.fillRect(x + s, GE - 30 - hh - oy, 1, hh); g.fillRect(x + s + 2, GE - 29 - hh - oy, 1, hh - 1); });
      // 山楂树冠飘几片叶子
      spots(S.tree[0], rM, TW, vw, 200, (x) => { for (let i = 0; i < 4; i++) { const f = (t * 0.2 + i / 4) % 1; R(g, x + f * 160 + Math.sin(f * 12 + i) * 6, S.tree[1] - oy + f * 110 + i * 5, 2, 1, i % 2 ? C.gorse[1] : '#4a4a30'); } });
    };
    S.front = (g, vw, vh, oy, camx, t) => {
      nearLayer(g, S.near, vw, vh, camx);
      nearLayer(g, S.grassFrames[Math.floor(t * 3) % 12], vw, vh + 1, camx);
      // 飘过的草籽（蓟绒）
      for (let i = 0; i < 10; i++) {
        const span = vw + 100, x = ((i * 173 + t * (18 + i * 2) - camx * 1.1) % span + span) % span - 50, y = vh * (0.25 + (i % 5) * 0.12) + Math.sin(t * 1.3 + i) * 12;
        g.globalAlpha = 0.7; R(g, x, y, 1, 1, '#b4b2a4'); R(g, x - 1, y - 1, 3, 1, '#7a7a6e'); g.globalAlpha = 1;
      }
    };
    return S;
  }

  // =====================================================================
  // 预选赛：白天的临时赛场。远处伦敦天际线（钟楼、圆顶、吊车），天上飘着飞艇和两只热气球；
  // 中远景是游乐场（条纹帐篷、转着的摩天轮、螺旋滑梯塔）；中景是一圈木看台（人群起伏、挥帽子，顶上彩旗飘）；
  // 近景是前排观众的后脑勺和围绳，偶尔有彩纸飘过
  // =====================================================================
  function buildQual() {
    const S = { id: 'qual' };
    const C = {
      sky: [[SKY0, '#2a3442'], [60, '#313d4c'], [190, '#3c4a5a'], [290, '#4a5968'], [360, '#586672'], [420, '#66727a'], [HZ + 160, '#66727a']],
      city: '#4c5864', cityD: '#46525e', city2: '#3e4a56',
      red: ['#3e2224', '#56302e', '#6e4038'], cream: ['#4e4a42', '#625c50', '#767062'], navy: ['#1e2632', '#2a3444', '#3a4658'], green: ['#23302a', '#2e3e34'],
      wood: ['#1e1814', '#2a221c', '#382e24', '#463a2c'], crowd: ['#1a1818', '#262222', '#302a28', '#3e3530', '#4a3f38'],
      gnd: ['#221e18', '#2e2820', '#3a3228', '#463d30', '#554a3a'], near: '#0d0d10', rim: ['#4a505a', '#22252c'],
    };
    S.skyTop = C.sky[0][1];
    S.sky = skyTex(C.sky);
    S.clouds = [0, 1, 2].map(i => ({ img: cloud(180 + i * 60, 34 + i * 6, ['#4e5a68', '#5e6a76', '#7a8288'], 51 + i), x: i * 600, y: 60 + i * 60, v: 4 + i * 1.5, par: 0.02 }));
    // 气球（条纹）和飞艇的小精灵
    S.balloon = (() => { const p = Pix(24, 34); p.disc(12, 11, 11, (x, y, a) => (Math.floor((a + 1) * 3) % 2 ? (a < -0.3 ? C.red[2] : C.red[1]) : (a < -0.3 ? C.cream[2] : C.cream[1])), 11); p.line(5, 19, 9, 27, '#1e1c1c'); p.line(19, 19, 15, 27, '#1e1c1c'); p.rect(8, 27, 8, 6, C.wood[2]); p.rect(8, 27, 8, 1, C.wood[3]); p.outline('#1c1a1e'); return p.done(); })();
    S.airship = (() => {
      const p = Pix(120, 40);
      p.disc(56, 14, 50, (x, y, a, b) => (b < -0.4 ? C.cream[2] : b > 0.5 ? C.cream[0] : C.cream[1]), 12);
      for (let x = 14; x < 100; x += 12) for (let y = 3; y < 26; y++) if (p.has(x, y)) p.put(x, y, C.cream[0]);
      p.rect(100, 6, 12, 3, C.cream[0]); p.rect(104, 2, 6, 22, C.cream[0]); p.rect(98, 12, 18, 3, C.cream[0]);   // 尾翼
      p.rect(40, 28, 26, 6, C.navy[2]); p.rect(40, 28, 26, 1, C.cream[1]); for (let x = 43; x < 64; x += 5) p.rect(x, 30, 3, 2, '#7a6a40');   // 吊舱
      p.line(44, 25, 42, 28, C.navy[1]); p.line(62, 25, 64, 28, C.navy[1]);
      p.outline('#1c1e24');
      return p.done();
    })();
    // 远景：伦敦天际线（钟楼、圆顶、吊车）
    {
      const y0 = 270, p = Pix(TW, F0 - y0, true), r = rng(13);
      for (let x = 0; x < TW;) { const w = 20 + Math.floor(r() * 40), top = 120 + Math.floor(r() * 26); p.rect(x, top, w, F0 - y0 - top, r() < 0.5 ? C.city : C.cityD); if (r() < 0.4) p.rect(x + 4, top - 8, 4, 8, C.city); x += w; }
      // 钟楼
      const bx = 300; p.rect(bx, 30, 24, 130, C.city2); p.rect(bx - 2, 26, 28, 6, C.cityD); for (let k = 0; k < 22; k++) p.rect(bx + 12 - (22 - k) * 0.55, 4 + k, (22 - k) * 1.1 + 1, 1, C.city2);
      p.disc(bx + 12, 44, 8, '#5a5e5a'); p.rect(bx + 12, 38, 1, 6, C.city2); p.rect(bx + 12, 44, 4, 1, C.city2);
      S.clock = [bx + 12, y0 + 44];
      // 圆顶（有点像圣保罗）
      const dx = 760; p.disc(dx, 92, 34, C.city2, 30); p.rect(dx - 38, 92, 76, 70, C.city2); p.rect(dx - 3, 50, 6, 14, C.city2); p.rect(dx - 1, 44, 2, 6, C.city2);
      for (let k = -30; k <= 30; k += 10) p.rect(dx + k, 96, 3, 30, C.cityD);
      // 码头吊车
      for (const cx of [1000, 1110]) { p.rect(cx, 60, 4, 100, C.cityD); p.line(cx - 40, 64, cx + 30, 60, C.cityD, 2); p.line(cx + 2, 40, cx - 36, 64, C.cityD); p.line(cx + 2, 40, cx + 28, 60, C.cityD); p.rect(cx - 38, 64, 1, 30, C.cityD); }
      S.far = p.done(); S.farY = y0;
    }
    // 中远景：游乐场
    {
      const y0 = 240, p = Pix(TW, F0 - y0, true), r = rng(29), Y = (wy) => wy - y0, GL = 400;   // GL = 游乐场地面（被看台顶棚挡住，只露出上半截）
      for (let x = 0; x < TW; x++) { const top = Y(GL) + Math.round(Math.sin(x / 40) * 2); for (let y = top; y < F0 - y0; y++) p.put(x, y, bayer(x, y) < 0.4 ? C.green[0] : C.green[1]); }
      for (let i = 0; i < 16; i++) { const tx = Math.floor(r() * TW), rr = 7 + r() * 6; p.disc(tx, Y(GL - 4), rr, (x, y, a, b) => (b < -0.3 && a < 0 ? C.green[1] : C.green[0]), rr * 0.8); }
      // 条纹大帐篷：圆锥顶 + 竖条纹墙 + 顶尖小旗杆
      const tent = (cx, w, hh, cols) => {
        const top = Y(GL) - hh;
        for (let x = cx - w; x <= cx + w; x++) {
          const k = Math.abs(x - cx) / w, roof = Math.round(top + k * hh * 0.45), band = Math.floor((x - cx + w) / 6) % 2;
          for (let y = roof; y < Y(GL); y++) p.put(x, y, y < top + hh * 0.45 ? (band ? cols[0][1] : cols[1][1]) : (band ? cols[0][0] : cols[1][0]));
          p.put(x, Math.round(top + hh * 0.45), C.wood[1]);
          if (Math.abs(x - cx) % 7 === 3) p.put(x, Math.round(top + hh * 0.45) + 1, C.wood[1]);
        }
        p.rect(cx, top - 10, 1, 10, C.wood[1]);
        return [cx + 1, y0 + top - 10];
      };
      S.pennants = [tent(180, 50, 88, [C.red, C.cream]), tent(560, 36, 70, [C.navy, C.cream]), tent(1040, 56, 96, [C.red, C.cream])];
      // 螺旋滑梯塔
      const hx = 860; for (let y = Y(300); y < Y(GL); y++) { const k = (y - Y(300)) / 100, w = 5 + k * 8; p.rect(hx - w, y, w * 2, 1, (Math.floor((y - Y(300) + k * 6) / 6) % 2) ? C.cream[1] : C.red[1]); } p.rect(hx - 6, Y(292), 12, 8, C.red[2]); p.rect(hx - 1, Y(280), 2, 12, C.wood[1]);   // 螺旋滑梯塔
      // 摩天轮底座（轮子动效另画）
      const fx = 360, fy = Y(318); p.line(fx - 30, Y(GL), fx, fy, C.wood[1], 2); p.line(fx + 30, Y(GL), fx, fy, C.wood[1], 2);
      S.ferris = [fx, y0 + fy];
      S.mid2 = p.done(); S.mid2Y = y0;
    }
    // 中景：看台（圆筒贴图，4 帧人群动画）
    {
      const y0 = 330, h0 = F0 - y0, Y = (wy) => wy - y0, frames = [];
      const seats = []; { const r = rng(41); for (let row = 0; row < 7; row++) for (let x = 2; x < TW; x += 7) if (r() < 0.86) seats.push([x + Math.floor(r() * 2), row, Math.floor(r() * 5), r(), Math.floor(r() * 6)]); }
      const flagX = []; for (let x = 60; x < TW; x += 156) flagX.push(x);
      for (let f = 0; f < 4; f++) {
        const p = Pix(TW, h0, true);
        const standTop = Y(418), standBot = Y(GE);
        // 顶棚 + 立柱 + 花边
        p.rect(0, Y(384), TW, 6, C.wood[2]); p.rect(0, Y(384), TW, 1, C.wood[3]);
        for (let x = 0; x < TW; x++) { const sc = Y(390) + (x % 12 < 6 ? (x % 6 < 3 ? 2 : 3) : (x % 6 < 3 ? 3 : 2)); p.rect(x, Y(390), 1, sc - Y(390) + 1, Math.floor(x / 12) % 2 ? C.red[1] : C.cream[1]); }
        for (let x = 0; x < TW; x++) for (let y = Y(394); y < standBot; y++) p.put(x, y, y < standTop ? C.wood[0] : (y - standTop) % 16 < 12 ? (bayer(x, y) < 0.25 ? C.wood[1] : C.wood[0]) : C.wood[1]);   // 看台背板：一排排台阶
        for (let x = 20; x < TW; x += 104) { p.rect(x, Y(384), 4, standBot - Y(384), C.wood[2]); p.rect(x, Y(384), 1, standBot - Y(384), C.wood[3]); }
        // 台阶
        for (let row = 0; row < 7; row++) { const y = standTop + row * 16; p.rect(0, y + 12, TW, 4, C.wood[1]); p.rect(0, y + 12, TW, 1, C.wood[2]); }
        // 人群：碳球观众（圆头 + 帽子），每帧有人上下弹 / 举帽 / 挥小旗
        for (const [x, row, tone, ph, hat] of seats) {
          const y = standTop + row * 16 + 11, act = (Math.floor(ph * 4) + f) % 4, bob = ph < 0.55 ? (act === 1 ? 1 : 0) : 0, cheer = ph > 0.86 && act < 2;
          const col = C.crowd[1 + tone % 3], hy = y - 6 - bob - (cheer ? 1 : 0);
          p.rect(x, hy, 5, 6, col); p.put(x, hy, 0); p.put(x + 4, hy, 0); p.put(x + 1, hy + 1, C.crowd[4]);
          if (hat === 1) { p.rect(x, hy - 1, 5, 1, C.crowd[0]); p.rect(x + 1, hy - 4, 3, 3, C.crowd[0]); }         // 礼帽
          else if (hat === 2) { p.rect(x - 1, hy, 7, 1, C.crowd[0]); p.rect(x + 1, hy - 2, 3, 2, C.crowd[0]); }  // 圆顶礼帽
          else if (hat === 3) { p.rect(x - 1, hy, 7, 1, C.cream[1]); p.rect(x, hy - 1, 5, 1, C.cream[1]); }        // 女士草帽
          if (cheer) { const up = act === 0; p.rect(x + 5, hy - (up ? 5 : 3), 1, up ? 5 : 3, col); if (hat === 4) p.rect(x + 5, hy - 9, 4, 3, (f % 2) ? C.red[2] : C.navy[2]); else if (up) p.rect(x + 4, hy - 7, 3, 2, C.crowd[0]); }
        }
        // 前面的广告围板（抽象图案，不写字）
        p.rect(0, Y(GE) - 12, TW, 12, C.wood[1]);
        for (let x = 0; x < TW; x += 64) { const k = (x / 64) % 4, col = [C.red, C.navy, C.cream, C.green][k]; p.rect(x + 2, Y(GE) - 11, 60, 10, col[1] || col[0]); p.rect(x + 2, Y(GE) - 11, 60, 1, (col[2] || col[1])); if (k === 0) p.disc(x + 32, Y(GE) - 6, 4, C.cream[2]); else if (k === 1) for (let i = 0; i < 5; i++) p.rect(x + 10 + i * 10, Y(GE) - 8, 6, 4, C.cream[1]); else if (k === 2) p.rect(x + 12, Y(GE) - 7, 40, 2, C.red[1]); else p.disc(x + 32, Y(GE) - 6, 3, C.cream[1]); }
        // 顶棚上的旗杆 + 飘动的三角旗（4 帧飘动）
        for (const fx of flagX) {
          p.rect(fx, Y(350), 2, Y(384) - Y(350), C.wood[3]);
          for (let k = 0; k < 16; k++) { const wave = Math.round(Math.sin(k * 0.55 - f * Math.PI / 2) * (k / 16) * 3), hh = Math.round(10 * (1 - k / 18)); p.rect(fx + 2 + k, Y(351) + wave + (10 - hh) / 2, 1, hh, (fx / 156) % 2 ? C.red[2] : C.navy[2]); }
        }
        // 彩旗串：旗杆之间下垂的三角小旗
        for (let i = 0; i < flagX.length; i++) {
          const a = flagX[i], b = i + 1 < flagX.length ? flagX[i + 1] : flagX[0] + TW;
          for (let x = a; x < b; x++) { const k = (x - a) / (b - a), y = Y(356) + Math.round(Math.sin(k * Math.PI) * 18); p.put(x, y, C.wood[0]); if ((x - a) % 10 === 5) { const sw = (f + Math.floor(x / 10)) % 2; const col = [C.red[2], C.cream[2], C.navy[2]][Math.floor(x / 10) % 3]; for (let k2 = 0; k2 < 5; k2++) p.rect(x - 2 + Math.floor(k2 / 2) + sw * 0, y + 1 + k2, 5 - k2, 1, col); } }
        }
        p.rect(0, standBot, TW, h0 - standBot, C.gnd[1]);
        // 两圈宽，圆筒采样跨接缝用
        const [c2, x2] = mk(TW * 2, h0); x2.drawImage(p.done(), 0, 0); x2.drawImage(c2, 0, 0, TW, h0, TW, 0, TW, h0);
        frames.push(c2);
      }
      S.stands = frames; S.standsY = y0;
    }
    S.floor = floorTex(C.gnd, (p, x, y) => {
      const d = y + F0;
      if (d < GROUND) {
        const k = (d - F0) / (GROUND - F0), lane = (d - F0) % 24;
        if (lane === 0 && (x % 48) < 30) return '#5e5a4e';   // 白灰车道线
        if ((d - F0) % 6 === 3 && hash(x >> 2, d) < 0.6) return C.gnd[1];   // 耙过的沙道
        return bayer(x, y) < 0.3 + k * 0.4 ? C.gnd[3] : C.gnd[2];
      }
      return null;
    }, [['#1a1612', 0.04]], (p, r, Y) => {
      // 起跑区的白灰方格、撒落的彩票和稻草屑
      for (let x = 0; x < TW; x += 416) for (let yy = 0; yy < 5; yy++) for (let k = 0; k < 4; k++) if ((yy + k) % 2) p.rect(x + k * 4, Y(566) + yy * 4, 4, 4, '#4e483c');
      for (let i = 0; i < 70; i++) { const x = r() * TW, y = Y(556 + r() * 88); p.rect(x, y, 3, 2, r() < 0.5 ? '#625c50' : '#56302e'); }
      for (let i = 0; i < 120; i++) { const x = r() * TW, y = Y(556 + r() * 88); p.rect(x, y, 3, 1, '#554a3a'); }
    });
    S.near = nearTex(1400, 64, (p) => {
      // 围绳立柱（绳子另画成下垂弧线）
      for (let x = 60; x < 1400; x += 280) { p.rect(x, 20, 5, 44, C.near); p.disc(x + 2, 19, 4, C.near); }
    }, C.rim);
    // 围绳一跨、前排观众的脑袋（5 种帽子）都预先画好
    S.rope = (() => { const q = Pix(284, 14); for (let k = 0; k <= 280; k++) q.rect(2 + k, Math.round(Math.sin(k / 280 * Math.PI) * 10), 1, 2, '#2a1e18'); return q.done(); })();
    S.headImg = [0, 1, 2, 3, 4].map(hat => {
      const q = Pix(30, 64), x = 15, top = 16;
      q.disc(x, top + 8, 9, C.near); q.rect(x - 9, top + 8, 19, 64, C.near);
      if (hat === 1) { q.rect(x - 7, top - 11, 14, 12, C.near); q.rect(x - 11, top, 22, 3, C.near); }
      else if (hat === 2) { q.disc(x, top + 1, 7, C.near); q.rect(x - 11, top + 1, 22, 3, C.near); }
      else if (hat === 3) { q.rect(x - 13, top + 2, 26, 3, C.near); q.rect(x - 6, top - 3, 12, 5, C.near); }
      for (let xx = 0; xx < 30; xx++) for (let y = 0; y < 64; y++) if (q.has(xx, y)) { if (xx < x && hash(xx, y) < 0.9) q.put(xx, y, C.rim[0]); break; }   // 头顶左半边一道天光
      return q.done();
    });
    S.heads = []; { const r = rng(91); for (let x = 0; x < 1400;) { S.heads.push([x, 18 + r() * 10, Math.floor(r() * 5), r() * TAU]); x += 30 + r() * 60; } }
    // ---- 每帧 ----
    S.back = (g, vw, vh, oy, camx, t) => {
      paintSky(g, S, vw, vh, oy);
      const sx = Math.round(vw * 0.18), sy = Math.round(120 - oy);
      g.globalAlpha = 0.12; blob(g, sx, sy, 60, '#9a9a88'); blob(g, sx, sy, 38, '#9a9a88'); g.globalAlpha = 1; blob(g, sx, sy, 17, '#b2ae98');
      clouds(g, S, vw, oy, camx, t);
      // 飞艇：很慢地横穿天空；两只热气球上下飘
      const span = vw + 300, ax = ((t * 9 - camx * 0.03) % span + span) % span - 150;
      g.drawImage(S.airship, Math.round(ax), Math.round(150 - oy + Math.sin(t * 0.4) * 3));
      for (let i = 0; i < 2; i++) { const bx = ((vw * (0.45 + i * 0.35) + t * (2 + i) - camx * 0.04) % (vw + 60) + vw + 60) % (vw + 60) - 30; g.drawImage(S.balloon, Math.round(bx), Math.round(230 + i * 60 - oy + Math.sin(t * 0.5 + i * 2) * 8)); }
      strip(g, S.far, S.farY, camx * 0.05, vw, oy);
      // 钟楼上的分针在走
      spots(S.clock[0], camx * 0.05, TW, vw, 10, (x) => { const a = t * 0.2 - Math.PI / 2; R(g, x + Math.cos(a) * 5, S.clock[1] - oy + Math.sin(a) * 5, 1, 1, '#2c333b'); R(g, x + Math.cos(a) * 3, S.clock[1] - oy + Math.sin(a) * 3, 1, 1, '#2c333b'); });
      strip(g, S.mid2, S.mid2Y, camx * 0.15, vw, oy);
      const r2 = camx * 0.15;
      // 摩天轮：轮圈 + 8 根辐条 + 8 个吊厢（吊厢不跟着转，始终朝下）
      spots(S.ferris[0], r2, TW, vw, 50, (x) => {
        const y = S.ferris[1] - oy, a = t * 0.25, RR = 44;
        g.fillStyle = C.wood[2];
        for (let k = 0; k < 140; k++) { const b = k / 140 * TAU; g.fillRect(Math.round(x + Math.cos(b) * RR), Math.round(y + Math.sin(b) * RR), 1, 1); }
        for (let k = 0; k < 10; k++) {
          const b = a + k * TAU / 10;
          for (let d = 2; d < RR; d += 2) g.fillRect(Math.round(x + Math.cos(b) * d), Math.round(y + Math.sin(b) * d), 1, 1);
          const cx = Math.round(x + Math.cos(b) * RR), cy = Math.round(y + Math.sin(b) * RR);
          R(g, cx - 3, cy + 1, 7, 5, k % 2 ? C.red[2] : C.cream[2]); R(g, cx - 3, cy + 1, 7, 1, C.wood[1]);
        }
        R(g, x - 2, y - 2, 5, 5, C.wood[3]);
      });
      // 帐篷顶的小旗
      for (const [u, y] of S.pennants) spots(u, r2, TW, vw, 12, (x) => { for (let k = 0; k < 7; k++) R(g, x + k, y - oy + Math.round(Math.sin(t * 6 - k * 0.7) * (k / 7) * 1.5), 1, Math.max(1, 4 - Math.floor(k / 2)), C.red[2]); });
      drum(g, S.stands[Math.floor(t * 3.5) % 4], S.standsY, camx * 0.45, vw, oy);
      // 圆筒两边压暗，显出场地是一圈
      // 只压两边各 20%（中间 60% 不画，省掉一整屏的半透明混合）
      const bot = F0 - oy, ew = Math.ceil(vw * 0.2);
      if (!S.edge || S.edge.w !== ew) { const gr = g.createLinearGradient(0, 0, ew, 0); gr.addColorStop(0, 'rgba(7,8,12,0.55)'); gr.addColorStop(1, 'rgba(7,8,12,0)'); S.edge = { w: ew, gr }; }
      g.fillStyle = S.edge.gr; g.fillRect(0, 0, ew, bot);
      g.save(); g.translate(vw, 0); g.scale(-1, 1); g.fillRect(0, 0, ew, bot); g.restore();
    };
    S.front = (g, vw, vh, oy, camx, t) => {
      const per = S.near.width, rot = ((Math.round(camx * 1.4) % per) + per) % per;
      // 围绳：立柱之间下垂的粗绳
      for (let x0 = 60 - rot - per; x0 < vw + per; x0 += 280) if (x0 < vw + 10 && x0 + 284 > -10) g.drawImage(S.rope, x0, vh - 42);
      nearLayer(g, S.near, vw, vh, camx);
      // 前排观众的后脑勺（碳球 + 帽子剪影），跟着比赛一起一伏
      g.fillStyle = C.near;
      for (const [u, hh, hat, ph] of S.heads) for (let x = u - rot - per; x < vw + 30; x += per) {
        if (x < -30) continue;
        const bob = Math.round(Math.max(0, Math.sin(t * 2.4 + ph)) * 3), top = Math.round(vh - hh - bob);
        g.drawImage(S.headImg[hat], Math.round(x) - 15, top - 16);
        if (Math.sin(t * 0.7 + ph * 3) > 0.93) { const up = Math.floor(t * 5) % 2; g.fillRect(Math.round(x + 8), top - 10 - up * 3, 3, 14); g.fillRect(Math.round(x + 6), top - 14 - up * 3, 8, 4); }   // 举帽子欢呼
      }
      // 彩纸：几片慢慢飘落翻转
      const cols = [C.red[2], C.cream[2], C.navy[2], '#6e6a3a'];
      for (let i = 0; i < 12; i++) {
        const f = (t * 0.07 + i * 0.083) % 1, x = ((i * 157 + Math.sin(t * 0.9 + i) * 30 - camx * 1.2) % (vw + 40) + vw + 40) % (vw + 40) - 20, y = f * vh * 0.9;
        R(g, x, y, Math.abs(Math.sin(t * 5 + i)) > 0.5 ? 3 : 1, 2, cols[i % 4]);
      }
    };
    return S;
  }

  // ---------- 共用：地面纹理、近景纹理 ----------
  // 地面：TW × (H - F0)，paint 返回地面以上（后方场地）的颜色；地面以下是泥土截面（地层线 + 埋着的石子），specks = 散点
  function floorTex(G, paint, specks, deco) {
    const p = Pix(TW, H - F0, true);
    for (let y = 0; y < H - F0; y++) for (let x = 0; x < TW; x++) {
      const d = y + F0;
      let col = paint(p, x, y);
      if (col == null) {
        const k = d - GROUND;
        col = k < 2 ? G[3] : k < 4 ? G[2] : ((k - 8) % 14 === 0 && hash(x >> 2, k) < 0.7) ? G[0] : bayer(x, y) < 0.25 ? G[0] : G[1];
      }
      p.put(x, y, col);
    }
    for (const [c, dens] of specks) for (let i = 0; i < TW * (H - F0) * dens / 24; i++) { const x = Math.floor(hash(i, 91) * TW), y = Math.floor(hash(i, 97) * (H - F0)); p.rect(x, y, 2, 1, c); }
    if (deco) deco(p, rng(TW + specks.length), (wy) => wy - F0);
    for (let x = 0; x < TW; x++) p.put(x, GROUND - F0, G[4]);   // 地面线上 1px 受光
    return p.done();
  }
  // 近景：w × h 的剪影条（贴在画面最下沿），顶边 1px 描上场景的轮廓光
  function nearTex(w, h, paint, rim) {
    const p = Pix(w, h, true), r = rng(w);
    paint(p, r);
    const [rimA, rimB] = [].concat(rim).map(u32), mark = [];
    // 每列最上面一个像素描轮廓光（被炉火 / 天光照亮），下面一个像素半亮（抖动）
    for (let x = 0; x < w; x++) for (let y = 1; y < h; y++) if (p.has(x, y) && !p.has(x, y - 1)) { mark.push([x, y]); break; }
    for (const [x, y] of mark) { if (hash(x, y) < 0.85) p.put(x, y, rimA); if (rimB && (x + y) % 2 && p.has(x, y + 1)) p.put(x, y + 1, rimB); }
    return p.done();
  }
  function nearLayer(g, tex, vw, vh, camx) {
    const per = tex.width, u = ((Math.round(camx * 1.4) % per) + per) % per, y = vh - tex.height;
    for (let x = -u; x < vw; x += per) g.drawImage(tex, x, y);
  }
  // 场景里的碳球小人（sprite 尺寸 40×40），按 [人, 姿势, 表情, 朝向] 缓存
  const coalCache = {};
  function coalSprite(name, pose, expr, look) {
    const k = `${name}|${pose}|${expr}|${look}`;
    if (coalCache[k]) return coalCache[k];
    const ch = SA.Coal && SA.Coal.byName[name];
    return (coalCache[k] = ch ? SA.Coal.draw(ch, { size: 'sprite', pose, expr, look }) : document.createElement('canvas'));
  }

  const built = {};
  function get(id) {
    if (!built[id]) built[id] = id === 'forge' ? buildForge() : id === 'wild' ? buildWild() : buildQual();
    return built[id];
  }
  // 画背景（天空 → 中景）：画在世界画布的视口像素里；t = 秒（场景自己的时钟，不跟战斗暂停）
  function back(id, g, vw, vh, oy, camx, t, opts) { get(id).back(g, vw, vh, oy, camx, t, opts); }
  // 地面：世界坐标里平铺（调用前已经平移到镜头）
  function floor(id, g, cam) { const f = get(id).floor; for (let x = Math.floor((cam.x - 40) / TW) * TW; x < cam.x + cam.w + 40; x += TW) g.drawImage(f, x, F0); }
  // 近景：压在车前面，画在视口像素里（vh = 视口高，底边就是画面底边）
  function front(id, g, vw, vh, oy, camx, t) { get(id).front(g, vw, vh, oy, camx, t); }

  return { pick, get, back, floor, front, NAMES };
})();
