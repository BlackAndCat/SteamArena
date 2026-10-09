// 出征路边的废墟（2026-10-09 用户：难民放在破旧的房子或者废墟旁边；路边做更多废墟，降低同质化和均匀分配的感觉）。
// 十种：塌顶小屋、断墙、烟囱残桩、塌掉的木棚、锈锅炉、破车、枯树、歪路灯、碎砖堆、断栏杆；每种按种子变化。
// 摆法：成簇（一簇 1～4 件，间隔 40～180px），簇和簇之间的空隙 300～1500px 不等；陡坡上只放小东西，平地上才放房子；
// 一部分放在更远的田野上（往上提一点、压暗一层），拉出远近。难民身后一定有一间有人住的破屋（屋顶补了油布、门口一盏灯）。
// 全按世界像素 1:1 画（和车同一尺度），平涂、低噪点，颜色压在背景的中低明度，不抢车和小机械。
// 每件精灵底边往下多画 24px 地基 / 碎砖：放在坡上也不会悬空（路面那一层会把多出来的部分盖住）。
window.SA = window.SA || {};

SA.RouteRuins = (() => {
  const A = SA.RouteArt, P = SA.PAL, IR = P.iron, RU = P.rust;
  const { WOOD, BRICK, STONE, IVY, TARP } = A.PAL;
  const hash = A.hash, FOOT = 24;
  const cache = new Map();
  const STONEB = [STONE[0], STONE[1], STONE[3], STONE[4]];
  const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const strSeed = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  // 砖墙（4px 一行，错缝）、地基碎砖
  function bricks(q, x0, y0, w, h, seed) {
    q.R(x0, y0, w, h, BRICK[2]);
    for (let yy = 0; yy < h; yy++) {
      if (yy % 4 === 3) { q.R(x0, y0 + yy, w, 1, BRICK[1]); continue; }
      const off = (Math.floor(yy / 4) % 2) * 4;
      for (let xx = 0; xx < w; xx++) if ((xx + off) % 8 === 7) q.px(x0 + xx, y0 + yy, BRICK[1]);
      if (yy % 4 === 0) for (let xx = 0; xx < w; xx++) if ((xx + off) % 8 < 3 && hash(Math.floor((xx + off) / 8) + seed, Math.floor(yy / 4) + seed) < 0.3) q.px(x0 + xx, y0 + yy, BRICK[3]);
    }
  }
  // 墙头参差：每一列往下啃掉一截（clear），断口描一道暗边
  function jag(q, x0, w, top, depth, seed, smooth = 3) {
    for (let i = 0; i < w; i++) {
      const d = Math.round((hash(Math.floor(i / smooth) + seed, 7) * 0.7 + 0.3 * hash(i + seed, 8)) * depth);
      if (d > 0) q.g.clearRect(x0 + i, top, 1, d);
      q.px(x0 + i, top + d, BRICK[0]);
    }
  }
  function ivy(q, x0, y0, w, h, seed, n = 1) { for (let k = 0; k < w * h / 22 * n; k++) { const xx = x0 + Math.round(hash(k, seed) * w), yy = y0 + Math.round(Math.pow(hash(k, seed + 1), 0.5) * h); q.R(xx, yy, 3, 2, IVY[1]); q.px(xx, yy, IVY[3]); q.px(xx + 1, yy + 1, IVY[0]); } }
  function rubble(q, cx, base, w, seed, h = 8) {
    for (let k = 0; k < w * 0.6; k++) {
      const r = hash(k, seed), xx = Math.round(cx - w / 2 + r * w), lift = Math.round((1 - Math.abs(r - 0.5) * 2) * h * hash(k, seed + 3)), stone = hash(k, seed + 5) < 0.35;
      q.R(xx, base - lift - 3, 5, 3, stone ? STONE[2] : BRICK[2]); q.px(xx, base - lift - 3, stone ? STONE[4] : BRICK[3]); q.R(xx, base - lift, 5, 1, stone ? STONE[0] : BRICK[0]);
    }
  }
  const foot = (q, w, base, seed) => { q.R(0, base, w, FOOT, BRICK[1]); for (let k = 0; k < w / 3; k++) q.R(Math.round(hash(k, seed) * w), base + Math.round(hash(k, seed + 1) * FOOT), 4, 2, hash(k, seed + 2) < 0.4 ? STONE[1] : BRICK[0]); };

  // ---------- 十种废墟 ----------
  // 塌顶小屋：两层砖、山墙；屋顶塌了一半（露出椽子）；一个窗洞一个门洞。lived = 有人住：塌的地方补一块油布，门口挂一盏灯、门里透暖光
  function cottage(seed, lived) {
    const r = rngOf(seed), w = 96 + Math.round(r() * 40), wallH = 52 + Math.round(r() * 16), roofH = 30 + Math.round(r() * 10), H = wallH + roofH + 4, base = H;
    const q = A.pen(w + 16, H + FOOT), x0 = 8;
    bricks(q, x0, base - wallH, w, wallH, seed);
    // 山墙（三角）
    for (let i = 0; i < w; i++) { const t = 1 - Math.abs(i - w / 2) / (w / 2), top = base - wallH - Math.round(t * roofH); bricks(q, x0 + i, top, 1, base - wallH - top, seed + 1); }
    // 屋顶：左半边还在（石板），右半边塌了只剩椽子
    const keep = 0.35 + r() * 0.3;
    for (let i = -6; i < w * keep; i++) { const t = 1 - Math.abs(i - w / 2) / (w / 2), top = base - wallH - Math.round(t * roofH) - 3; q.R(x0 + i, top, 1, 4, i % 5 ? STONE[1] : STONE[0]); q.px(x0 + i, top, STONE[3]); }
    for (let k = 0; k < 4; k++) { const xx = x0 + w * keep + k * (w * (1 - keep) / 4); q.line(xx, base - wallH - roofH * (1 - Math.abs(xx - x0 - w / 2) / (w / 2)) - 2, xx + 6, base - wallH + 2, WOOD[1], 2); }
    jag(q, x0 + Math.round(w * keep), Math.round(w * (1 - keep)), base - wallH - roofH, 12, seed);
    // 窗洞、门洞
    const dw = 18, dx = x0 + Math.round(w * (0.18 + r() * 0.15)), wx = dx + dw + 14 + Math.round(r() * 12);
    q.R(dx, base - 34, dw, 34, lived ? '#2a1a12' : '#0e0a08'); q.R(dx - 2, base - 36, dw + 4, 3, STONE[2]);
    q.R(wx, base - wallH + 12, 16, 14, '#0e0a08'); q.R(wx - 1, base - wallH + 26, 18, 2, STONE[2]);
    if (!lived) { q.line(wx + 2, base - wallH + 13, wx + 14, base - wallH + 25, WOOD[2], 2); }   // 窗洞钉了一块斜板
    if (lived) {
      // 油布补丁 + 门里暖光 + 门口挂灯
      const tx = x0 + Math.round(w * keep) - 4, tw = Math.round(w * (1 - keep) * 0.7);
      for (let i = 0; i < tw; i++) { const sag = Math.round(Math.sin(i / tw * Math.PI) * 4), t = 1 - Math.abs(tx + i - x0 - w / 2) / (w / 2), top = base - wallH - Math.round(t * roofH) - 1 + sag; q.R(tx + i, top, 1, 4, i % 9 ? TARP[2] : TARP[1]); q.px(tx + i, top, TARP[3]); }
      q.R(dx + 2, base - 30, dw - 4, 30, '#5a3420'); q.R(dx + 4, base - 26, dw - 8, 26, '#7a4a28');
      q.R(dx + dw + 2, base - 40, 1, 6, IR[1]); q.box(dx + dw, base - 34, 5, 6, [IR[0], IR[1], P.fire[2], P.fire[3]]);
    }
    ivy(q, x0, base - wallH, Math.round(w * 0.3), wallH, seed + 9, lived ? 0.6 : 1);
    rubble(q, x0 + w * 0.8, base, w * 0.5, seed + 4);
    foot(q, w + 16, base, seed);
    return { c: q.c, ax: Math.round((w + 16) / 2), ay: base, w: w + 16, door: dx - 8 + dw / 2 - (w + 16) / 2 };
  }
  // 断墙：一段砖墙，顶上参差，有时带一个拱窗
  function wall(seed) {
    const r = rngOf(seed), w = 40 + Math.round(r() * 60), h = 34 + Math.round(r() * 46), base = h + 6;
    const q = A.pen(w + 8, base + FOOT);
    bricks(q, 4, base - h, w, h, seed);
    jag(q, 4, w, base - h, Math.round(h * 0.6), seed, 4);
    if (w > 60 && r() < 0.6) { const ax = 4 + Math.round(w * 0.35), aw = 14; for (let yy = 0; yy < 24; yy++) { const hw = yy < aw / 2 ? Math.sqrt(Math.max(0, (aw / 2) ** 2 - (aw / 2 - yy) ** 2)) : aw / 2; q.R(ax + aw / 2 - hw, base - h + 14 + yy, hw * 2, 1, '#0e0a08'); } }
    q.R(4, base - 6, w, 6, STONE[1]); q.R(4, base - 6, w, 1, STONE[3]);
    ivy(q, 4, base - h, w, h, seed + 3, 0.6);
    rubble(q, 4 + w / 2, base, w + 6, seed + 5, 6);
    foot(q, w + 8, base, seed);
    return { c: q.c, ax: Math.round((w + 8) / 2), ay: base, w: w + 8 };
  }
  // 烟囱残桩：又高又窄，顶上断了，底下一堆碎砖
  function chimney(seed) {
    const r = rngOf(seed), w = 16 + Math.round(r() * 8), h = 70 + Math.round(r() * 70), base = h + 4;
    const q = A.pen(w + 40, base + FOOT), x0 = 20;
    bricks(q, x0, base - h, w, h, seed);
    q.R(x0, base - h, 1, h, BRICK[0]); q.R(x0 + w - 1, base - h, 1, h, BRICK[0]);
    q.R(x0 - 2, base - h + 10, w + 4, 3, STONE[2]); q.px(x0 - 2, base - h + 10, STONE[4]);
    jag(q, x0, w, base - h, 10, seed, 2);
    rubble(q, x0 + w / 2, base, w + 34, seed + 2, 10);
    foot(q, w + 40, base, seed);
    return { c: q.c, ax: Math.round((w + 40) / 2), ay: base, w: w + 40 };
  }
  // 塌掉的木棚：几根歪着的立柱、斜搭的木板
  function shed(seed) {
    const r = rngOf(seed), w = 50 + Math.round(r() * 40), h = 36 + Math.round(r() * 20), base = h + 4;
    const q = A.pen(w + 10, base + FOOT);
    for (let k = 0; k < 3; k++) { const xx = 5 + Math.round(k * w / 2), lean = Math.round((r() - 0.5) * 10); q.line(xx, base, xx + lean, base - h + Math.round(r() * 10), WOOD[2], 3); }
    for (let k = 0; k < 6; k++) { const xx = 5 + Math.round(r() * w * 0.8), yy = base - Math.round(r() * h * 0.7); q.line(xx, yy, xx + 18 + Math.round(r() * 16), yy + 8 + Math.round(r() * 14), k % 2 ? WOOD[3] : WOOD[2], 3); }
    q.line(5, base - h + 4, 5 + w, base - h * 0.4, WOOD[1], 3);
    rubble(q, 5 + w / 2, base, w, seed + 1, 4);
    foot(q, w + 10, base, seed);
    return { c: q.c, ax: Math.round((w + 10) / 2), ay: base, w: w + 10 };
  }
  // 锈锅炉：横倒的圆筒，铆钉、锈斑、一个破口
  function boiler(seed) {
    const r = rngOf(seed), w = 48 + Math.round(r() * 30), h = 24 + Math.round(r() * 8), base = h + 3;
    const q = A.pen(w + 8, base + FOOT);
    for (let yy = 0; yy < h; yy++) { const t = yy / h, col = t < 0.15 ? RU[3] : t < 0.6 ? RU[2] : t < 0.9 ? RU[1] : RU[0]; q.R(4, base - h + yy, w, 1, col); }
    for (const ex of [4, 4 + w - 6]) { q.R(ex, base - h - 1, 6, h + 1, IR[1]); q.R(ex, base - h - 1, 6, 1, IR[3]); }
    for (let xx = 10; xx < w; xx += 6) { q.px(4 + xx, base - h + 3, IR[4]); q.px(4 + xx, base - 4, IR[0]); }
    const hx = 4 + Math.round(w * (0.3 + r() * 0.3)); q.R(hx, base - h + 6, 10, 8, '#0e0a08'); q.px(hx, base - h + 6, RU[3]);
    q.R(4, base - 2, w, 2, IR[0]);
    foot(q, w + 8, base, seed);
    return { c: q.c, ax: Math.round((w + 8) / 2), ay: base, w: w + 8 };
  }
  // 破车：歪着的车斗 + 一个轮子（另一个掉了）
  function cart(seed) {
    const r = rngOf(seed), w = 44 + Math.round(r() * 16), base = 30;
    const q = A.pen(w + 14, base + FOOT);
    for (let i = 0; i < w; i++) { const yy = base - 20 + Math.round(i * 0.14); q.R(7 + i, yy, 1, 9, i % 9 === 0 ? WOOD[1] : WOOD[3]); q.px(7 + i, yy, WOOD[5]); }
    q.line(7 + w, base - 14, 7 + w + 8, base - 2, WOOD[2], 2);
    q.disc(16, base - 8, 8, (u, v) => { const d = Math.hypot(u, v); return d > 0.78 ? IR[1] : d < 0.22 ? WOOD[2] : Math.abs(u) < 0.14 || Math.abs(v) < 0.14 ? WOOD[3] : null; });
    q.R(7 + w * 0.6, base - 3, 12, 3, WOOD[2]);
    foot(q, w + 14, base, seed);
    return { c: q.c, ax: Math.round((w + 14) / 2), ay: base, w: w + 14 };
  }
  // 枯树：主干 + 几根分叉，全是剪影色
  function tree(seed) {
    const r = rngOf(seed), h = 60 + Math.round(r() * 50), base = h + 2, W = 70;
    const q = A.pen(W, base + FOOT), col = '#1a1512', col2 = '#241d18';
    const branch = (x, y, len, ang, wd, d) => { const x2 = x + Math.cos(ang) * len, y2 = y - Math.sin(ang) * len; q.line(x, y, x2, y2, d % 2 ? col2 : col, wd); if (d < 3) for (let k = 0; k < 2; k++) branch(x2, y2, len * (0.55 + r() * 0.2), ang + (k ? 1 : -1) * (0.35 + r() * 0.4), Math.max(1, wd - 1), d + 1); };
    branch(W / 2, base, h * 0.55, Math.PI / 2 + (r() - 0.5) * 0.25, 4, 0);
    foot(q, W, base, seed);
    return { c: q.c, ax: W / 2, ay: base, w: 40 };
  }
  // 歪路灯：铸铁灯杆，弯了一截，灯罩碎了
  function post(seed) {
    const r = rngOf(seed), h = 64 + Math.round(r() * 20), base = h + 4, lean = (r() < 0.5 ? -1 : 1) * (6 + Math.round(r() * 12));
    const q = A.pen(50, base + FOOT), x0 = 25;
    q.R(x0 - 3, base - 8, 7, 8, IR[1]); q.R(x0 - 3, base - 8, 7, 1, IR[3]);
    q.line(x0, base - 8, x0, base - h * 0.55, IR[1], 3);
    q.line(x0, base - h * 0.55, x0 + lean, base - h, IR[1], 3);
    q.box(x0 + lean - 4, base - h - 10, 9, 10, [IR[0], IR[1], P.glass[1], IR[3]]); q.g.clearRect(x0 + lean - 2, base - h - 8, 3, 4);
    foot(q, 50, base, seed);
    return { c: q.c, ax: 25, ay: base, w: 22 };
  }
  // 碎砖堆
  function heap(seed) {
    const r = rngOf(seed), w = 30 + Math.round(r() * 40), base = 16;
    const q = A.pen(w + 10, base + FOOT);
    rubble(q, 5 + w / 2, base, w, seed, 12);
    if (r() < 0.5) q.line(8, base - 6, 8 + w * 0.6, base - 12, WOOD[2], 2);   // 一根断梁
    foot(q, w + 10, base, seed);
    return { c: q.c, ax: Math.round((w + 10) / 2), ay: base, w: w + 10 };
  }
  // 断栏杆：一段铸铁栅栏，几根弯了、几根没了
  function fence(seed) {
    const r = rngOf(seed), w = 40 + Math.round(r() * 50), h = 26, base = h + 2;
    const q = A.pen(w + 6, base + FOOT);
    q.R(3, base - h + 4, w, 2, IR[1]); q.R(3, base - 6, w, 2, IR[1]);
    for (let xx = 4; xx < w; xx += 5) { if (r() < 0.2) continue; const bend = r() < 0.15 ? Math.round((r() - 0.5) * 8) : 0; q.line(3 + xx, base, 3 + xx + bend, base - h, IR[1], 1); q.px(3 + xx + bend, base - h - 1, IR[3]); }
    foot(q, w + 6, base, seed);
    return { c: q.c, ax: Math.round((w + 6) / 2), ay: base, w: w + 6 };
  }

  // 塌掉的工厂：两层高的砖壳，成排拱窗（全黑），铁屋架只剩几榀，一侧连着大烟囱；墙头参差
  function factory(seed) {
    const r = rngOf(seed), w = 190 + Math.round(r() * 80), h = 110 + Math.round(r() * 40), base = h + 70;
    const q = A.pen(w + 40, base + FOOT), x0 = 10;
    bricks(q, x0, base - h, w, h, seed);
    for (let k = 0; k < 3; k++) { const tx = x0 + 20 + k * (w - 40) / 2; q.line(tx - 30, base - h + 2, tx, base - h - 26, IR[1], 2); q.line(tx, base - h - 26, tx + 30, base - h + 2, IR[1], 2); q.line(tx, base - h - 26, tx, base - h + 2, IR[0], 1); }   // 铁屋架
    jag(q, x0, w, base - h, 34, seed, 5);
    for (const row of [base - h + 22, base - h + 64]) for (let wx = x0 + 10; wx < x0 + w - 18; wx += 26) {
      if (hash(wx, row + seed) < 0.12) continue;
      for (let yy = 0; yy < 26; yy++) { const hw = yy < 6 ? Math.sqrt(Math.max(0, 36 - (6 - yy) ** 2)) : 6; q.R(wx + 6 - hw, row + yy, hw * 2, 1, '#0e0a08'); }
      q.R(wx - 1, row + 26, 14, 2, STONE[2]);
    }
    q.R(x0, base - 14, w, 14, STONE[1]); q.R(x0, base - 14, w, 1, STONE[3]);
    const cx = x0 + w - 6;   // 大烟囱
    bricks(q, cx, base - h - 60, 22, h + 60, seed + 3); q.R(cx, base - h - 60, 1, h + 60, BRICK[0]); q.R(cx + 21, base - h - 60, 1, h + 60, BRICK[0]);
    jag(q, cx, 22, base - h - 60, 8, seed + 4, 2);
    ivy(q, x0, base - h, Math.round(w * 0.25), h, seed + 6, 0.8);
    rubble(q, x0 + w * 0.5, base, w * 0.9, seed + 7, 12);
    foot(q, w + 40, base, seed);
    return { c: q.c, ax: Math.round((w + 40) / 2), ay: base, w: w + 40 };
  }
  // 一排连栋小楼：3～4 间挨着，高低不一，屋顶塌得各不一样，有的只剩山墙
  function terrace(seed) {
    const r = rngOf(seed), n = 3 + Math.floor(r() * 2), unit = 38 + Math.round(r() * 8), w = n * unit, base = 112;
    const q = A.pen(w + 12, base + FOOT), x0 = 6;
    for (let i = 0; i < n; i++) {
      const ux = x0 + i * unit, wh = 54 + Math.round(r() * 30), gable = 18 + Math.round(r() * 8);
      bricks(q, ux, base - wh, unit, wh, seed + i);
      if (r() < 0.6) for (let k = 0; k < unit; k++) { const t = 1 - Math.abs(k - unit / 2) / (unit / 2); bricks(q, ux + k, base - wh - Math.round(t * gable), 1, Math.round(t * gable), seed + i); }
      jag(q, ux, unit, base - wh - gable, Math.round(gable * (0.4 + r() * 0.8)), seed + i * 3, 3);
      q.R(ux, base - wh, 1, wh, BRICK[0]);
      q.R(ux + 8, base - wh + 14, 10, 12, '#0e0a08'); q.R(ux + 22, base - 30, 10, 30, '#0e0a08');
      if (r() < 0.5) { bricks(q, ux + unit - 12, base - wh - gable - 14, 8, 16, seed + i + 9); }
    }
    rubble(q, x0 + w / 2, base, w, seed + 5, 8);
    foot(q, w + 12, base, seed);
    return { c: q.c, ax: Math.round((w + 12) / 2), ay: base, w: w + 12 };
  }

  const KINDS = { cottage, wall, chimney, shed, boiler, cart, tree, post, heap, fence, factory, terrace };
  const BIG = new Set(['cottage', 'wall', 'chimney', 'shed', 'factory', 'terrace']);
  // 远近三层：0 近（原色）/ 1 中（压暗两成）/ 2 远（压暗四成，和背景的雾色混）
  const DIM = [0, 0.22, 0.42];
  function sprite(kind, seed, depth, lived) {
    depth = depth === true ? 2 : depth || 0;
    const key = `${kind}|${seed}|${depth}|${lived ? 1 : 0}`;
    if (!cache.has(key)) {
      const s = kind === 'cottage' ? cottage(seed, lived) : KINDS[kind](seed);
      if (depth) { const g = s.c.getContext('2d'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(22,18,16,${DIM[depth]})`; g.fillRect(0, 0, s.c.width, s.c.height); g.globalCompositeOperation = 'source-over'; }
      cache.set(key, s);
    }
    return cache.get(key);
  }

  /**
   * 一条路线上的废墟清单（按路线 id 定种子，每次一样）：[{ kind, x, seed, far, lived }]
   * keep：什么都不放的区间 [[x0, x1], ...]（院子、地标、桥、终点）；clear：只放远处的、近处留空的区间（遭遇的战场）；refugees：难民的位置（每家身后一间有人住的破屋）；slope(x)：坡度
   */
  function layout(def, o) {
    const r = rngOf(strSeed(def.id || 'route')), out = [], len = def.len || 7680;
    const blocked = (x, w, far) => (o.keep || []).some(([a, b]) => x + w / 2 > a && x - w / 2 < b) || (!far && (o.clear || []).some(([a, b]) => x + w / 2 > a && x - w / 2 < b));
    for (const fx of o.refugees || []) out.push({ kind: 'cottage', x: fx + 26, seed: Math.round(fx), far: false, lived: true, w: 140 });
    const nearRef = (x) => (o.refugees || []).some(fx => Math.abs(fx + 26 - x) < 150);
    let x = 640 + r() * 200;
    while (x < len - 120) {
      const n = 1 + Math.floor(r() * 5 * (0.4 + 0.6 * r()));   // 一簇 1～5 件，大小不一
      let lastR = -1e9;
      for (let i = 0; i < n && x < len - 120; i++) {
        const steep = Math.abs(o.slope(x)) > 0.12;
        const pool = steep ? ['tree', 'post', 'heap', 'boiler', 'heap', 'fence'] : ['cottage', 'wall', 'wall', 'chimney', 'shed', 'boiler', 'cart', 'tree', 'post', 'heap', 'fence', 'wall'];
        const kind = pool[Math.floor(r() * pool.length)], far = r() < 0.38, w = BIG.has(kind) ? 120 : 60;
        if ((far || x - w / 2 > lastR) && !blocked(x, w, far) && !nearRef(x)) { out.push({ kind, x: Math.round(x), seed: Math.floor(r() * 1e6), far, lived: false, w }); if (!far) lastR = x + w / 2; }
        x += 30 + r() * 120;
      }
      x += (r() < 0.25 ? 600 + r() * 500 : 160 + r() * 360);   // 簇和簇之间：多半是短空隙，偶尔一大片空地
    }
    // 废墟区（路线数据 ruins: [{ x0, x1 }]）：一大片挤在一起，三排（远 / 中 / 近）各自密密地排，远排多放工厂、连栋楼这种大件
    for (const z of def.ruins || []) {
      const rows = [[2, ['factory', 'terrace', 'factory', 'chimney', 'wall', 'terrace'], 50, 120], [1, ['terrace', 'cottage', 'wall', 'chimney', 'shed', 'factory'], 45, 110], [0, ['wall', 'heap', 'boiler', 'fence', 'cart', 'post', 'shed', 'heap'], 55, 150]];
      for (const [depth, pool, a, b] of rows) {
        for (let x = z.x0 + r() * a; x < z.x1; x += a + r() * (b - a)) {
          if (depth === 0 && ((o.clear || []).some(([c0, c1]) => x > c0 && x < c1) || nearRef(x))) continue;
          out.push({ kind: pool[Math.floor(r() * pool.length)], x: Math.round(x), seed: Math.floor(r() * 1e6), depth, far: depth === 2, lived: false });
        }
      }
    }
    // 碎砖坡（features 里的 rubble）：坡顶插几截断墙、碎砖堆，坡后面立一座塌了的工厂
    for (const f of (def.features || []).filter(f => f.kind === 'rubble')) {
      const mid = (f.x0 + f.x1) / 2, span = f.x1 - f.x0;
      out.push({ kind: 'factory', x: Math.round(mid + (r() - 0.5) * span * 0.3), seed: Math.floor(r() * 1e6), depth: 1, far: false });
      for (let k = 0; k < 3; k++) out.push({ kind: k === 1 ? 'wall' : 'heap', x: Math.round(f.x0 + span * (0.25 + 0.25 * k) + (r() - 0.5) * 30), seed: Math.floor(r() * 1e6), depth: 0, far: false });
    }
    for (const it of out) if (it.depth == null) it.depth = it.far ? 2 : 0;
    out.sort((a, b) => b.depth - a.depth);   // 远的先画
    return out;
  }

  /** 画：g 已经平移到世界坐标；seen(x, w) 判断镜头看不看得到；远的往上提 10px、中的 5px（站在路后面的田里） */
  const LIFT = [3, -5, -10];
  function draw(g, list, groundAt, seen) {
    for (const it of list) {
      if (!seen(it.x, 200)) continue;
      const s = sprite(it.kind, it.seed, it.depth, it.lived);
      g.drawImage(s.c, Math.round(it.x - s.ax), Math.round(groundAt(it.x) + LIFT[it.depth || 0] - s.ay));
    }
  }

  return { layout, draw, sprite, KINDS };
})();
