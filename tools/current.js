// 「当前开发」页：出征 v2——起伏地形（黑乡真实剖面）、小机械、撞击反馈、音效试听台（2026-10-06）。
// 计划见 docs/expedition-plan.md §12、§13，docs/feel-audio-plan.md v0.2。这一页不复用：用户确认后复制到 tools/archive/expedition-v2.*，在 labs.js 登记。
// 只是样机：地形、机械、撞击都是摆拍，规则以 astra 的实现为准。地面画法在 js/terrain-art.js（profileTiles），机械和碎件在 js/route-art.js，声音在 js/audio.js。
window.SA = window.SA || {};
(() => {
  const P = SA.PAL, S = SA.K.CELL, PADX = SA.SPR.PADX, ROWS = SA.K.ROWS, RA = SA.RouteArt;
  const GROUND = 648, VW = 1280, VH = 720, LEN = 7680;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- 真实高程（EU-DEM 25 m，OpenTopoData 取样）：[离起点的米数, 海拔米] ----------
  // 达德利城堡 (52.5114, -2.0800) → 内瑟顿 (52.4890, -2.0770) → 风车端 (52.4847, -2.0597) → 特纳山一侧 (52.4908, -2.0540) → 罗利里吉斯 (52.4800, -2.0400)
  const REAL = [[0, 202.3], [61, 204.8], [123, 207.7], [184, 208.9], [246, 205.7], [307, 202.6], [368, 200.8], [430, 201.1], [491, 202.8], [553, 204.4], [614, 204.6], [675, 202.2], [737, 198.0], [798, 194.0], [860, 190.5], [921, 187.5], [983, 184.0], [1044, 180.6], [1105, 177.3], [1167, 175.3], [1228, 172.4], [1290, 167.9], [1351, 163.3], [1412, 160.5], [1474, 157.9], [1535, 155.1], [1597, 153.1], [1658, 151.3], [1719, 148.1], [1781, 144.5], [1842, 142.0], [1904, 140.9], [1965, 140.3], [2026, 140.0], [2088, 141.1], [2149, 142.4], [2211, 143.9], [2272, 144.9], [2333, 145.1], [2395, 142.7], [2456, 141.0], [2510, 140.3], [2571, 140.1], [2633, 139.5], [2694, 138.7], [2755, 137.5], [2816, 135.6], [2878, 133.8], [2939, 132.6], [3000, 131.5], [3062, 130.2], [3123, 126.0], [3184, 126.9], [3245, 125.3], [3307, 125.9], [3368, 126.9], [3429, 128.0], [3490, 129.9], [3552, 133.3], [3613, 135.8], [3674, 138.8], [3736, 141.2], [3783, 144.7], [3845, 149.7], [3906, 153.7], [3967, 156.1], [4029, 159.7], [4090, 165.3], [4152, 171.0], [4213, 176.9], [4274, 183.5], [4336, 189.6], [4397, 196.0], [4458, 200.1], [4520, 202.1], [4576, 201.2], [4637, 200.5], [4699, 201.1], [4760, 203.5], [4822, 204.2], [4883, 204.1], [4944, 206.3], [5006, 209.3], [5067, 212.2], [5128, 215.5], [5190, 217.9], [5251, 219.2], [5312, 220.5], [5374, 221.2], [5435, 219.4], [5496, 216.4], [5558, 211.8], [5619, 207.0], [5680, 202.1], [5742, 197.4], [5803, 193.5], [5864, 190.4], [5926, 188.5], [5987, 186.2], [6049, 183.9]];
  const REAL_LEN = 6049, EMIN = 125.3, KX = LEN / REAL_LEN, EXAG = 3, KY = KX * EXAG;   // 横向 px/m、竖向 px/m（夸张 3 倍）
  const PLACES = [[0, '达德利城堡岭'], [1904, '内瑟顿'], [3245, '风车端 · 运河谷底'], [3307, '科布抽水机房（1831）'], [5374, '罗利山'], [6049, '罗利里吉斯']];

  // 真实剖面 → 每像素地面高度：Catmull-Rom 插值，再叠 19 世纪的人造地形（驼背桥、路堑）
  const natural = new Float32Array(LEN + 1);
  {
    const pts = REAL.map(([m, e]) => [m * KX, (e - EMIN) * KY]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let x = Math.ceil(p1[0]); x <= Math.min(LEN, Math.floor(p2[0])); x++) {
        const t = (x - p1[0]) / Math.max(1e-6, p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
        natural[x] = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      }
    }
  }
  // 人造地形（世界 x，px）：驼背桥过运河（谷底最低点）、谷底一段路堤接桥、山顶路堑
  const BRIDGE = { x0: 4060, x1: 4200, hump: 24 }, FILL = { x0: 3930, x1: 4060 }, CUT = { x0: 6560, x1: 7000, depth: 34 };
  const ground = new Float32Array(LEN + 1);
  const baseY = (x) => GROUND - natural[clamp(Math.round(x), 0, LEN)];
  for (let x = 0; x <= LEN; x++) {
    let h = natural[x];
    if (x >= BRIDGE.x0 && x <= BRIDGE.x1) { const u = (x - (BRIDGE.x0 + BRIDGE.x1) / 2) / ((BRIDGE.x1 - BRIDGE.x0) / 2); h += BRIDGE.hump * Math.cos(u * Math.PI / 2) ** 2; }
    if (x >= FILL.x0 && x < FILL.x1) { const k = (x - FILL.x0) / (FILL.x1 - FILL.x0); h = Math.max(h, natural[FILL.x0] + (natural[BRIDGE.x0] - natural[FILL.x0]) * k + 6 * Math.sin(k * Math.PI)); }
    if (x >= CUT.x0 && x <= CUT.x1) { const r = Math.min(1, (x - CUT.x0) / 120, (CUT.x1 - x) / 120); h -= CUT.depth * (r * r * (3 - 2 * r)); }
    ground[x] = GROUND - h;
  }
  const gAt = (x) => ground[clamp(Math.round(x), 0, LEN)];
  const slopeAt = (x) => (gAt(x + 24) - gAt(x - 24)) / 48;   // > 0 = 往右下坡
  const water = Math.round(baseY((BRIDGE.x0 + BRIDGE.x1) / 2) + 10);
  const tiles = SA.TerrainArt.profileTiles(ground, LEN, 900, {
    bridge: [{ x0: BRIDGE.x0, x1: BRIDGE.x1, water }],
    fill: [{ x0: FILL.x0, x1: FILL.x1, natural: (x) => baseY(x) }],
    cut: [{ x0: CUT.x0, x1: CUT.x1, depth: CUT.depth }],
  });

  // ---------- 剖面图 ----------
  function drawChart() {
    const c = document.getElementById('chart'), g = c.getContext('2d'), W = 1280, H = 230, L = 50, R = 20, T = 18, B = 34;
    g.fillStyle = '#1d2621'; g.fillRect(0, 0, W, H);
    const sx = (m) => L + m / REAL_LEN * (W - L - R), sy = (e) => T + (225 - e) / (225 - 120) * (H - T - B);
    g.font = '12px sans-serif'; g.fillStyle = '#7f8a80'; g.strokeStyle = '#2f3b33';
    for (let e = 120; e <= 220; e += 20) { g.beginPath(); g.moveTo(L, sy(e)); g.lineTo(W - R, sy(e)); g.stroke(); g.fillText(`${e} m`, 6, sy(e) + 4); }
    for (let k = 0; k <= 6; k++) { g.fillText(`${k} km`, sx(k * 1000) - 12, H - 10); }
    // 游戏剖面（换算回米，浅色）+ 真实剖面（粉笔白）
    g.strokeStyle = '#a8794e'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= LEN; x += 8) { const m = x / KX, e = EMIN + (GROUND - gAt(x)) / KY; x ? g.lineTo(sx(m), sy(e)) : g.moveTo(sx(m), sy(e)); }
    g.stroke();
    g.strokeStyle = '#e4dfcf'; g.lineWidth = 1.5; g.beginPath();
    REAL.forEach(([m, e], i) => (i ? g.lineTo(sx(m), sy(e)) : g.moveTo(sx(m), sy(e)))); g.stroke();
    for (const [m, e] of REAL) { g.fillStyle = '#e4dfcf'; g.fillRect(sx(m) - 1, sy(e) - 1, 2, 2); }
    g.fillStyle = '#e4dfcf';
    for (const [m, name] of PLACES) { const e = REAL.reduce((b, p) => (Math.abs(p[0] - m) < Math.abs(b[0] - m) ? p : b))[1]; g.fillRect(sx(m), sy(e) - 22, 1, 18); g.fillText(name, Math.min(W - 150, sx(m) + 4), sy(e) - 12); }
    g.fillStyle = '#a8794e'; g.fillText('橙线：换算进游戏后的地面（加了驼背桥、路堑）', W - 330, H - 10);
  }

  // ---------- 车 ----------
  const PCELLS = [[0, 10, 4, 'track', 1, 0], [0, 10, 6, 'track', 1, 0], [0, 10, 8, 'track', 1, 0], [0, 10, 10, 'bucket', 1, 0],
    [0, 8, 7, 'boiler_s', 1, 0], [0, 8, 8, 'helmet', 1, 0], [0, 9, 8, 'tank_s', 1, 0], [0, 9, 9, 'cannon_m', 1, 0], [0, 8, 9, 'plate', 1, 0], [0, 8, 10, 'mg_s', 1, 0]];
  const PV = SA.V.fromCells('样车', PCELLS), carCv = document.createElement('canvas');
  function playerCar(t, phase, moving, speed, load) {
    const src = SA.SPR.renderVehicle(PV, { key: 'route-p2', t, phase, moving, speed, heat: 0.4, water: 0.8 });
    carCv.width = src.width; carCv.height = src.height;
    const q = RA.wrap(carCv); q.g.drawImage(src, 0, 0);
    RA.CARGO.A.big(q, PADX + 4 * S, 8 * S, load);
    RA.BIN.A.draw(q, PADX + 6 * S, 8 * S, 0.8);
    return carCv;
  }
  const SPAN = [4, 11], HALF = (SPAN[1] - SPAN[0] + 1) * S / 2;

  // ---------- 路上的东西 ----------
  const ROUTE = {
    crates: [{ x: 620, w: 48, h: 48 }, { x: 900, w: 44, h: 40 }, { x: 2900, w: 48, h: 56 }],
    bar: { x: 6480 },
    mobs: [
      ...[1780, 1810, 1840, 1870, 1900].map(x => ({ kind: 'soldier', x })),
      ...[2700, 2950, 3200, 3420, 3650].map(x => ({ kind: 'crawler', x })),
      ...[5300, 5420, 5560, 5700].map((x, i) => ({ kind: 'barrel', x, release: 4700 + i * 120 })),
      { kind: 'sentry', x: 6200 },
    ],
    pump: 4330, headframe: 7150, end: 7300,
  };

  // ---------- 演示状态 ----------
  const view = document.getElementById('view'), vg = view.getContext('2d');
  const fb = { stop: true, cam: true, recoil: true, debris: true, scrap: true, sound: true };
  const st = {};
  function reset(to = 0) {
    Object.assign(st, { x: 140 + HALF, v: 0, phase: 0, t: 0, cam: { x: 0, y: GROUND + 60 - VH }, kick: 0, recoil: 0, freeze: 0, shake: 0, parts: [], bits: [], floats: [], metal: 0, ended: false });
    ROUTE.crates.forEach(c => { c.dead = false; });
    ROUTE.bar.st = 0;
    ROUTE.mobs.forEach(m => { m.dead = false; m.mx = m.x; m.rolling = false; m.t = Math.random() * 3; });
    if (to > 0) { let n = 0; while (st.x + HALF < to && n++ < 60000) step(1 / 30, true); st.parts = []; st.bits = []; st.floats = []; }
    st.cam = camTarget();
  }
  const front = () => st.x + HALF;
  let mul = 2, playing = true;
  const sfx = (name, x, vol) => { if (fb.sound && SA.Audio) SA.Audio.play(name, { x: clamp((x - st.cam.x) / VW, 0, 1), vol }); };
  function crush(x, y, kind, heavy) {
    // 撞击反馈：顿帧 / 镜头冲撞 / 车头反冲 / 碎件 / 金属飞上车 / 声音，按被撞的东西分量
    const w = { crate: 0.35, soldier: 0.3, crawler: 0.5, barrel: 0.8, sentry: 1, barricade: 1 }[kind] || 0.5, speed = clamp(st.v / 75, 0.3, 1.6);
    if (fb.stop) st.freeze = Math.max(st.freeze, 0.025 + 0.05 * w);
    if (fb.cam) st.kick = Math.max(st.kick, 6 + 10 * w * speed);
    if (fb.recoil) st.recoil = Math.max(st.recoil, 2 + 4 * w);
    st.v *= 1 - 0.35 * w;
    if (fb.debris) {
      const list = kind === 'crate' || kind === 'barricade' ? ['stave', 'stave', 'plate', 'stave'] : RA.DEBRIS[kind] || ['plate'];
      for (const [i, t] of list.entries()) st.parts.push({ type: t, x: x + (Math.random() - 0.5) * 10, y: y - 6 - Math.random() * 10, vx: 60 + Math.random() * 140 * speed + i * 10, vy: -120 - Math.random() * 160, rot: Math.floor(Math.random() * 4), spin: 6 + Math.random() * 10, life: 3 });
      for (let i = 0; i < 8; i++) st.parts.push({ dust: true, x: x + (Math.random() - 0.5) * 20, y: y - Math.random() * 10, vx: (Math.random() - 0.3) * 80, vy: -Math.random() * 60, life: 0.6 + Math.random() * 0.5 });
      if (kind !== 'crate') for (let i = 0; i < 6; i++) st.parts.push({ spark: true, x, y: y - 8, vx: 40 + Math.random() * 160, vy: -60 - Math.random() * 140, life: 0.25 + Math.random() * 0.2 });
    }
    if (kind !== 'crate' && kind !== 'barricade' && fb.scrap) {
      const n = kind === 'sentry' ? 4 : kind === 'barrel' ? 2 : kind === 'soldier' ? 1 : 2;
      for (let i = 0; i < n; i++) st.bits.push({ x, y: y - 10, t: 0, dur: 0.55 + i * 0.08, h: 60 + Math.random() * 50, delay: 0.08 * i });
    }
    if (kind === 'crate') sfx('crush.wood', x);
    else if (kind === 'barricade') { sfx('hit.plate', x); sfx('crush.wood', x, 0.7); }
    else if (kind === 'barrel') { sfx('boom', x); st.shake = Math.max(st.shake, 8); for (let i = 0; i < 14; i++) st.parts.push({ fire: true, x, y: y - 10, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 200, life: 0.3 + Math.random() * 0.4 }); }
    else { sfx('crush.machine', x); if (heavy) sfx('hit.metal.heavy', x, 0.8); }
    sfx('ram.thud', x, 0.35 + 0.5 * w);
  }
  function step(dt, silent) {
    st.t += dt;
    if (st.freeze > 0 && !silent) { st.freeze -= dt; return; }   // 顿帧：世界停一下，画面照常
    // 碎件、金属、飘字
    for (const p of st.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.dust) p.vy += 520 * dt; else p.vy += 30 * dt; const gy = gAt(p.x); if (!p.dust && !p.spark && !p.fire && p.y > gy - 2) { p.y = gy - 2; p.vy *= -0.3; p.vx *= 0.5; p.spin *= 0.5; } }
    st.parts = st.parts.filter(p => p.life > 0);
    for (const b of st.bits) { if (b.delay > 0) { b.delay -= dt; continue; } b.t += dt; if (b.t >= b.dur && !b.done) { b.done = true; st.metal++; st.floats.push({ x: st.x - 72, y: gAt(st.x) - 120, life: 0.9 }); if (!silent) sfx('scrap.pickup', st.x, 0.7); } }
    st.bits = st.bits.filter(b => !b.done);
    for (const f of st.floats) { f.life -= dt; f.y -= 30 * dt; }
    st.floats = st.floats.filter(f => f.life > 0);
    st.kick *= Math.pow(0.02, dt); st.recoil *= Math.pow(0.01, dt); st.shake *= Math.pow(0.02, dt);
    if (st.ended) { st.v = 0; return; }
    // 车速：上坡慢、下坡快
    const sl = slopeAt(st.x), want = 75 * clamp(1 + sl * 1.6, 0.45, 1.5);
    st.v += clamp(want - st.v, -160 * dt, 70 * dt);
    st.x += st.v * dt; st.phase += st.v * dt;
    const f = front();
    for (const c of ROUTE.crates) if (!c.dead && f >= c.x - c.w / 2) { c.dead = true; if (!silent) crush(c.x, gAt(c.x) - c.h / 2, 'crate'); }
    if (ROUTE.bar.st < 2 && f >= ROUTE.bar.x - 30) { ROUTE.bar.st = 2; if (!silent) crush(ROUTE.bar.x, gAt(ROUTE.bar.x) - 30, 'barricade'); }
    for (const m of ROUTE.mobs) {
      if (m.dead) continue;
      m.t += dt;
      // 行为（摆拍）：步兵往左慢走、爬车往左爬；滚桶等车开上坡后被放下来，顺坡往下滚、越滚越快
      if (m.kind === 'soldier') m.mx -= 12 * dt;
      else if (m.kind === 'crawler') m.mx -= 8 * dt;
      else if (m.kind === 'barrel') { if (!m.rolling && f >= m.release) m.rolling = true; if (m.rolling) { m.vx = Math.min(140, (m.vx || 20) + 90 * Math.max(0, -slopeAt(m.mx)) * dt + 10 * dt); m.mx -= m.vx * dt; } }
      if (f >= m.mx - 8) { m.dead = true; if (!silent) crush(m.mx, gAt(m.mx) - 10, m.kind, m.kind === 'sentry'); }
    }
    if (f >= ROUTE.end) st.ended = true;
  }
  function camTarget() {
    const sl = slopeAt(st.x + 200), gy = gAt(st.x);
    return { x: clamp(st.x - 430, 0, LEN - VW), y: gy - VH * 0.72 + sl * 160 };
  }

  // ---------- 画 ----------
  const bd = document.createElement('canvas'); bd.width = VW; bd.height = VH; const bg = bd.getContext('2d');
  const scene = () => (SA.Scenes.NAMES.waste && SA.Scenes.get('waste') ? 'waste' : 'wild');
  function draw() {
    const t = performance.now() / 1000, sh = st.shake > 0.3 ? (Math.random() - 0.5) * st.shake : 0;
    const cam = { x: st.cam.x + (fb.cam ? st.kick : 0), y: st.cam.y + sh, w: VW, h: VH };
    const ox = Math.floor(cam.x), oy = Math.floor(cam.y);
    // 背景：竖直视差——镜头上下走，远景只跟着动两成；背景底下（远处的地面）用一块平的暗色接住，不露天
    const oyB = Math.round(-12 + (cam.y + 12) * 0.2), sc = scene();
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.imageSmoothingEnabled = false;
    SA.Scenes.back(sc, bg, VW, VH, oyB, cam.x, t, {});
    bg.fillStyle = '#2a3022'; bg.fillRect(0, 552 - oyB, VW, VH);
    vg.setTransform(1, 0, 0, 1, 0, 0); vg.imageSmoothingEnabled = false;
    vg.filter = sc === 'wild' ? 'saturate(0.4) sepia(0.35) brightness(0.8)' : 'none'; vg.drawImage(bd, 0, 0); vg.filter = 'none';
    vg.save(); vg.translate(-ox, -oy);
    const vis = (x, w = 400) => x + w > cam.x && x - w < cam.x + VW;
    const put = (a, x, y) => { if (a && vis(x, a.c.width)) vg.drawImage(a.c, Math.round(x - a.ax), Math.round(y - a.ay)); };
    // 地标（路后面）：科布抽水机房、罗利山采石场的岩壁、山顶矿井架
    put(RA.prop('pump'), ROUTE.pump, gAt(ROUTE.pump) + 6);
    quarry(vg, 4700, 5700, vis);
    put(RA.prop('depot'), ROUTE.headframe, gAt(ROUTE.headframe) + 6);
    put(RA.prop('sign'), 260, gAt(260));
    // 地面（整块）
    for (const tl of tiles) if (vis(tl.x + 640, 700)) vg.drawImage(tl.c, tl.x, 0);
    for (const c of ROUTE.crates) { if (!vis(c.x)) continue; const y1 = gAt(c.x); if (c.dead) SA.TerrainArt.rubble(vg, c.x - c.w / 2 - 6, c.x + c.w / 2 + 6, y1); else SA.TerrainArt.crate(vg, c.x - c.w / 2, y1 - c.h, c.w, c.h, 1, 0); }
    put(RA.prop('barricade', ROUTE.bar.st), ROUTE.bar.x, gAt(ROUTE.bar.x));
    // 小机械（走动帧按时间换）
    for (const m of ROUTE.mobs) {
      if (m.dead || !vis(m.mx, 60)) continue;
      const fr = m.kind === 'barrel' ? Math.floor((m.rolling ? (m.x - m.mx) / 4 : 0)) : m.kind === 'sentry' ? Math.floor(m.t * 1.2) : Math.floor(m.t * (m.kind === 'soldier' ? 6 : 5));
      const a = RA.mob(m.kind, ((fr % 8) + 8) % 8), y = gAt(m.mx) + (m.kind === 'soldier' && fr % 2 ? -1 : 0);
      put(a, m.mx, y);
    }
    // 车：顺着坡倾斜；反冲时往后一缩、车头微抬
    const sl = clamp(Math.atan(slopeAt(st.x)), -0.45, 0.45), cv = playerCar(t, st.phase, st.v > 2, st.v, ['supply', 'refugee']);
    const bx = PADX + (SPAN[0] + SPAN[1] + 1) / 2 * S;
    vg.save(); vg.translate(Math.round(st.x - (fb.recoil ? st.recoil : 0)), Math.round(gAt(st.x))); vg.rotate(sl - (fb.recoil ? st.recoil * 0.008 : 0)); vg.drawImage(cv, -Math.round(bx), -ROWS * S); vg.restore();
    // 碎件 / 尘土 / 火星 / 火
    for (const p of st.parts) {
      vg.globalAlpha = Math.min(1, p.life * 2);
      if (p.dust) { vg.fillStyle = '#5c544a'; vg.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); }
      else if (p.spark) { vg.fillStyle = P.brass[3]; vg.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
      else if (p.fire) { vg.fillStyle = p.life > 0.3 ? P.fire[3] : P.fire[1]; vg.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6); }
      else put(RA.piece(p.type, p.rot + Math.floor((3 - p.life) * p.spin)), p.x, p.y + 4);
    }
    vg.globalAlpha = 1;
    // 金属片：沿弧线飞进车里的货箱
    for (const b of st.bits) {
      if (b.delay > 0) continue;
      const k = clamp(b.t / b.dur, 0, 1), tx = st.x - 72, ty = gAt(st.x) - 84, x = b.x + (tx - b.x) * k, y = b.y + (ty - b.y) * k - Math.sin(k * Math.PI) * b.h;
      put(RA.piece('scrap', Math.floor(k * 8)), x, y);
    }
    vg.font = 'bold 16px sans-serif'; vg.textAlign = 'center';
    for (const f of st.floats) { vg.globalAlpha = Math.min(1, f.life * 2); vg.fillStyle = '#0b0e15'; vg.fillText('+1 金属', f.x + 1, f.y + 1); vg.fillStyle = P.iron[4]; vg.fillText('+1 金属', f.x, f.y); }
    vg.globalAlpha = 1; vg.textAlign = 'start';
    vg.restore();
    // 场景的近景（栅栏、草、车轮剪影）是按平地画在画面最下沿的，起伏地形上会浮在地下，先不画（已告诉画场景的会话）
  }
  // 罗利山的玄武岩采石场：路后面一面一级一级的暗色岩壁。每级台阶顶上一道受光边，岩面按块裂开（不规则的横缝 + 斜缝），
  // 台阶脚下一堆碎石坡；颜色压在背景的中低明度里，不抢车
  const quarryCache = new Map();
  const ROCK = ['#1d1c1b', '#262422', '#2d2a27', '#36322e', '#45403a'];
  function quarry(g, x0, x1, vis) {
    for (let x = x0; x < x1; x += 200) {
      if (!vis(x + 100, 220)) continue;
      const key = `${x}`;
      if (!quarryCache.has(key)) {
        // 一块 200 宽的岩壁：三级台阶，每级顶上一道受光边；岩面平涂，只有零星的层理横缝和节理竖缝；底边按每一列的地面收进路里（坡上不悬空）
        const W = 200, top0 = Math.min(...Array.from({ length: W }, (_, i) => gAt(x + i))) - 120, H = Math.ceil(Math.max(...Array.from({ length: W }, (_, i) => gAt(x + i))) - top0 + 8);
        const q = RA.pen(W, H), r = (a, b) => RA.hash(a + x, b);
        const benches = [0, 1, 2].map(k => ({ x0: k * 66 + Math.round(r(k, 1) * 10), drop: k * 20 + Math.round(r(k, 2) * 10) }));
        for (let i = 0; i < W; i++) {
          const base = Math.round(gAt(x + i) - top0) + 6;
          let top = 4;
          for (const b of benches) if (i >= b.x0) top = 4 + b.drop + (r(i >> 2, 3) < 0.3 ? 1 : 0);
          const edge = Math.min(i, W - 1 - i); if (edge < 12) top = Math.max(top, base - edge * 14);   // 两头斜着收进坡里
          for (let y = top; y < base; y++) {
            // 岩面平涂：只有零星一截的层理缝，和每级台阶下沿一道阴影
            const bed = (y - top) % 26 === 13 && r(i >> 3, y) < 0.35;
            q.px(i, y, y === top ? ROCK[4] : y === top + 1 ? ROCK[3] : bed ? ROCK[1] : y > base - 16 ? ROCK[1] : ROCK[2]);
          }
          if (r(i, 7) < 0.2) q.px(i, top - 1, '#353f2c');
        }
        for (let k = 0; k < 70; k++) { const px = Math.round(r(k, 9) * (W - 3)), gb = Math.round(gAt(x + px) - top0) + 4, py = gb - Math.round(Math.pow(r(k, 10), 2) * 18); q.R(px, py, 3, 2, ROCK[r(k, 11) < 0.5 ? 3 : 1]); }
        quarryCache.set(key, { c: q.c, y: top0 });
      }
      const Q = quarryCache.get(key); g.drawImage(Q.c, x, Math.round(Q.y));
    }
  }

  // ---------- 小机械的展示表 ----------
  function big(c, s) { const o = document.createElement('canvas'); o.className = 'px'; o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); o.style.width = `${c.width * s}px`; o.style.height = `${c.height * s}px`; return o; }
  function buildMobs() {
    const box = document.getElementById('mobs'), anims = [];
    for (const [kind, name] of [['crawler', '拾荒爬车'], ['barrel', '滚桶炸弹'], ['soldier', '发条步兵'], ['sentry', '步哨炮车']]) {
      const f = document.createElement('figure'), first = RA.mob(kind, 0).c, c = big(first, 4);
      f.append(c, document.createTextNode(name)); box.append(f);
      anims.push({ kind, c, n: RA.MOBS[kind].frames });
    }
    const f = document.createElement('figure'), q = RA.pen(110, 12);
    ['gear', 'plate', 'spring', 'key', 'wheel', 'coat', 'stave', 'scrap'].forEach((t, i) => q.img(RA.piece(t, 0).c, i * 13 + 2, 2));
    f.append(big(q.c, 4), document.createTextNode('碎件：齿轮 · 铁片 · 弹簧 · 钥匙 · 小轮 · 军装 · 桶板 · 金属片')); box.append(f);
    setInterval(() => { const k = Math.floor(performance.now() / 160); for (const a of anims) { const src = RA.mob(a.kind, k % a.n).c, g = a.c.getContext('2d'); g.clearRect(0, 0, a.c.width, a.c.height); g.drawImage(src, 0, 0); } }, 160);
  }

  // ---------- 音效试听台 ----------
  function buildBench() {
    const box = document.getElementById('bench'), A = SA.Audio, s = A.settings();
    for (const [id, key] of [['vMaster', 'master'], ['vSfx', 'sfx'], ['vUi', 'ui']]) { const el = document.getElementById(id); el.value = s[key]; el.oninput = () => A.settings({ [key]: +el.value }); }
    const NAMES = { 'crush.wood': '撞碎木箱', 'crush.machine': '小机械散架', 'crush.rock': '砖石 / 煤渣', 'hit.plate': '铁皮 / 路障 / 装甲重击', 'hit.metal.light': '机枪打铁、小碎件', 'hit.metal.medium': '金属中击', 'hit.metal.heavy': '金属重击', 'ram.thud': '车头撞上的闷响', 'scrap.pickup': '金属片飞上车', 'boom': '爆炸', 'boom.big': '大爆炸', 'cannon.fire': '开炮', 'cannon.hit': '炮弹命中', 'gun.shot': '小炮 / 机枪', 'steam.hiss': '泄压 / 蒸汽', 'chain': '铁链 / 闩锁', 'ui.click': '界面 · 点击', 'ui.switch': '界面 · 拨杆', 'ui.confirm': '界面 · 确认', 'ui.error': '界面 · 不行' };
    for (const [name, b] of Object.entries(A.BANK)) {
      const d = document.createElement('div'); d.className = 'snd';
      d.innerHTML = `<b>${NAMES[name] || name}</b> <span>${name}</span>`;
      const vs = document.createElement('div'); vs.className = 'vs';
      const rnd = document.createElement('button'); rnd.className = 'btn small'; rnd.textContent = '随机'; rnd.onclick = () => A.play(name); vs.append(rnd);
      for (let i = 0; i < b.n; i++) { const bt = document.createElement('button'); bt.className = 'btn small'; bt.textContent = String(i); bt.onclick = () => A.play(name, { v: i }); vs.append(bt); }
      d.append(vs); box.append(d);
    }
    A.load();
  }

  // ---------- 控制 ----------
  const scrub = document.getElementById('scrub'), playBtn = document.getElementById('play');
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '暂停' : '播放'; };
  document.getElementById('restart').onclick = () => { reset(0); playing = true; playBtn.textContent = '暂停'; };
  for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { mul = +b.dataset.speed; };
  scrub.oninput = () => reset(+scrub.value);
  for (const [id, k] of [['fbStop', 'stop'], ['fbCam', 'cam'], ['fbRecoil', 'recoil'], ['fbDebris', 'debris'], ['fbScrap', 'scrap'], ['fbSound', 'sound']]) { const el = document.getElementById(id); el.onchange = () => { fb[k] = el.checked; }; }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) for (let i = 0; i < mul; i++) step(dt);
    const tg = camTarget(); st.cam.x += (tg.x - st.cam.x) * Math.min(1, dt * 4); st.cam.y += (tg.y - st.cam.y) * Math.min(1, dt * 3);
    draw();
    if (document.activeElement !== scrub) scrub.value = Math.round(front());
    document.getElementById('where').textContent = `${Math.round(front() / KX)} m（真实）`;
    document.getElementById('metal').textContent = `金属 ${st.metal}`;
    requestAnimationFrame(frame);
  }
  drawChart(); buildMobs(); buildBench(); reset(0);
  requestAnimationFrame(frame);
  SA.ExpeditionLab = { st, reset, step, draw, fb, ground, ROUTE };
})();
