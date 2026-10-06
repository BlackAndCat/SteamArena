// 「当前开发」页：出征 · 样板路线 1 · 视觉稿 v1（2026-10-06）。计划见 docs/expedition-plan.md。
// 这一页不复用：用户确认后复制到 tools/archive/expedition-v1.*，在 labs.js 登记，再换下一项。
// 只是画面样机：路线按计划 §4 的分段表手抄一份；敌车读 config/stage-cars.json 的现有关卡车；
// 煤、货位、遭遇、破门都是摆拍的假动作，规则以 astra 的实现为准。新件（货箱、煤仓、路线物件）全按世界像素 1:1 画。
window.SA = window.SA || {};
(() => {
  const P = SA.PAL, S = SA.K.CELL, PADX = SA.SPR.PADX, ROWS = SA.K.ROWS;
  const GROUND = 648, VW = 1280, VH = 720, LEN = 7680;
  const RA = SA.RouteArt, { hash, wrap, pen, CARGO, BIN, sackAt, crateAt, barrelAt, relicAt, rider } = RA;
  const { WOOD, COAL, SACK, STONE, GLOW } = RA.PAL, IR = P.iron, BR = P.brass, RU = P.rust;
  const IRONB = [IR[0], IR[1], IR[2], IR[3]], BRASSB = [BR[0], BR[1], BR[2], BR[3]];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pick = { cargo: 'A', bin: 'A' };
  const art = new Map(), cached = (k, make) => { if (!art.has(k)) art.set(k, make()); return art.get(k); };
  const prop = RA.prop, coalPile = (full) => prop('coal', !full), supplyCache = (taken) => prop('supply', taken), spoils = () => prop('spoils'), waterTower = () => prop('water'),
    barricade = (st) => prop('barricade', st), ruinGate = (st) => prop('ruinDoor', st), relicChest = () => prop('relic'), startSign = () => prop('sign'),
    pumpHouse = () => prop('pump'), depot = () => prop('depot'), train = () => prop('train');
  // ---------- 路线 1（计划 §4）----------
  const R1 = {
    hills: [{ x: 3000, w: 360, h: 44 }, { x: 5200, w: 200, h: 20 }], mud: [[3900, 4600]],
    crates: [{ x: 900, w: 48, h: 48 }, { x: 1250, w: 48, h: 40 }, { x: 1700, w: 40, h: 56 }, { x: 6500, w: 48, h: 48 }, { x: 6552, w: 44, h: 72 }],
    bars: [{ x: 2540, enc: 0 }, { x: 7020, enc: 2 }], gate: { x: 5560 },
    pickups: [
      { kind: 'coal', x: 1500, take: true }, { kind: 'supply', x: 2800, take: true }, { kind: 'refugee', x: 3400, take: true, seed: 1 },
      { kind: 'supply', x: 3650, take: false }, { kind: 'supply', x: 4300, take: false }, { kind: 'relic', x: 5660, take: true },
      { kind: 'refugee', x: 6000, take: true, seed: 4 }, { kind: 'coal', x: 6300, take: true },
    ],
    water: 5050,
    enc: [{ car: [0, 0], name: '拾荒小车', at: 2420, take: true }, { car: [1, 0], name: '铁皮罐头', at: 4760, take: false }, { car: [1, 4], name: '推土机', at: 6880, charge: 6640, take: false }],
    end: 7380,
  };
  const ground = new Float32Array(LEN + 1).fill(GROUND);
  for (const hl of R1.hills) for (let x = Math.max(0, Math.floor(hl.x - hl.w / 2)); x <= Math.min(LEN, Math.ceil(hl.x + hl.w / 2)); x++) ground[x] -= hl.h * 0.5 * (1 + Math.cos(Math.PI * (x - hl.x) / (hl.w / 2)));
  const gAt = (x) => ground[clamp(Math.round(x), 0, LEN)];
  // 地形层（土坡 + 泥地）：SA.TerrainArt.layer 能按任意宽度画；切成 1280 宽的块，免得一张画布太大
  const tiles = RA.terrainTiles(ground, R1.mud, LEN, VH, GROUND);

  // ---------- 车：玩家的样车（履带 ×3 + 铲斗；车尾留出 2×2 货箱、1×2 煤仓的位置，样机里另画）+ 三辆关卡车 ----------
  const PCELLS = [[0, 10, 4, 'track', 1, 0], [0, 10, 6, 'track', 1, 0], [0, 10, 8, 'track', 1, 0], [0, 10, 10, 'bucket', 1, 0],
    [0, 8, 7, 'boiler_s', 1, 0], [0, 8, 8, 'helmet', 1, 0], [0, 9, 8, 'tank_s', 1, 0], [0, 9, 9, 'cannon_m', 1, 0], [0, 8, 9, 'plate', 1, 0], [0, 8, 10, 'mg_s', 1, 0]];
  const PV = SA.V.fromCells('样车', PCELLS);
  const colSpan = (v) => { let a = 99, b = -1; SA.V.each(v, (cell, r, c) => { a = Math.min(a, c); b = Math.max(b, c + SA.fp(cell.id).w - 1); }); return [a, b]; };
  const carCv = document.createElement('canvas');
  function playerCar(t, phase, moving, speed, load, coal) {
    const src = SA.SPR.renderVehicle(PV, { key: 'route-p', t, phase, moving, speed, heat: 0.4, water: 0.8 });
    carCv.width = src.width; carCv.height = src.height;
    const q = wrap(carCv); q.g.drawImage(src, 0, 0);
    CARGO[pick.cargo].big(q, PADX + 4 * S, 8 * S, load);
    BIN[pick.bin].draw(q, PADX + 6 * S, 8 * S, coal);
    return carCv;
  }
  const foes = R1.enc.map((e, i) => {
    const rec = SA.StageCars.get(e.car[0], e.car[1]);
    const v = SA.V.fromCells(e.name, rec.cells);
    return { ...e, i, v, span: colSpan(v), x: e.at, state: 'wait', hp: 1, len: (colSpan(v)[1] - colSpan(v)[0] + 1) * S };
  });
  const darken = (() => { const c = document.createElement('canvas'); return (src) => { c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(12,9,7,0.72)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; return c; }; })();
  // 车画在世界里：底边中点踩在地面上，按坡度倾斜；dir = -1 是朝左的敌车
  function drawCar(g, cv, span, x, dir, bob = 0) {
    const bx = PADX + (span[0] + span[1] + 1) / 2 * S, y = gAt(x), k = (gAt(x + 70) - gAt(x - 70)) / 140;
    g.save(); g.translate(Math.round(x), Math.round(y + bob)); g.rotate(Math.atan(k)); g.scale(dir, 1);
    g.drawImage(cv, -Math.round(bx), -ROWS * S); g.restore();
  }

  // ---------- 演示状态 ----------
  const view = document.getElementById('view'), vg = view.getContext('2d');
  const st = {};
  function reset(to = 0) {
    Object.assign(st, { x: 140, v: 0, phase: 0, t: 0, coal: 1, load: [], hold: 0, mode: 'drive', note: null, noteT: 0, cam: 0, parts: [], ended: false, fight: null, gateSt: 0, gateT: 0, waterT: 0 });
    R1.crates.forEach(c => { c.dead = false; c.hit = 0; });
    R1.bars.forEach(b => { b.st = 0; });
    R1.pickups.forEach(p => { p.taken = false; p.full = false; });
    foes.forEach(f => { f.state = 'wait'; f.x = f.at; f.burn = 0; f.spoil = false; });
    if (to > 0) fastForward(to);
    st.cam = camTarget();
  }
  const front = () => st.x + 96;
  const SPEED = 60;     // 演示的满速（px/s），比履带真速快一点，省得等
  let mul = 2, playing = true;
  function say(text, sec = 2.2) { st.note = text; st.noteT = sec; }
  function puff(x, y, n, col, up = 60) { for (let i = 0; i < n; i++) st.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y - Math.random() * 10, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * up, life: 0.6 + Math.random() * 0.6, col }); }
  const slots = () => 4 - st.load.length;
  function step(dt) {
    st.t += dt;
    if (st.noteT > 0) st.noteT -= dt;
    st.parts = st.parts.filter(p => (p.life -= dt) > 0); for (const p of st.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    if (st.ended) { st.v = 0; return; }
    const f = front();
    // 要停：难民、遗迹门、水塔、遭遇
    if (st.mode === 'hold') { st.v = Math.max(0, st.v - 180 * dt); st.hold -= dt; if (st.holdTick) st.holdTick(dt); if (st.hold <= 0) { const done = st.onDone; st.mode = 'drive'; st.holdTick = null; st.onDone = null; if (done) done(); } return move(dt); }
    let want = SPEED;
    // 慢行捡东西：只有演示司机决定要捡的才减速
    for (const p of R1.pickups) if (!p.taken && !p.full && p.take && p.kind !== 'refugee' && p.x - f < 120 && p.x - f > -60) want = SPEED * 0.3;
    for (const e of foes) if (e.spoil && !e.spoilTaken && e.take && e.x - f < 120 && e.x - f > -60) want = SPEED * 0.3;
    st.slow = want < SPEED;
    st.v += clamp(want - st.v, -150 * dt, 80 * dt);
    // 木箱、路障：撞上就碎，顿一下
    for (const c of R1.crates) if (!c.dead && f >= c.x - c.w / 2) { c.dead = true; st.v *= 0.45; puff(c.x, gAt(c.x) - c.h / 2, 14, WOOD[4]); }
    for (const b of R1.bars) if (b.st < 2 && f >= b.x - 30 && foes[b.enc].state === 'dead') { b.st = 2; st.v *= 0.35; puff(b.x, gAt(b.x) - 30, 22, IR[2]); }
    // 拾取
    for (const p of R1.pickups) {
      if (p.taken || p.full) continue;
      if (p.kind === 'refugee' && f >= p.x - 50) {
        if (!slots()) { p.full = true; say('货位满了，接不了这家人'); continue; }
        st.mode = 'hold'; st.hold = 1.8; st.onDone = () => { p.taken = true; st.load.push('refugee'); say('接上一家难民（占 1 位）'); };
        say('停车 · 接人'); return move(dt);
      }
      if (p.kind === 'relic' && st.gateSt < 2) continue;
      if (Math.abs(p.x - (st.x + 40)) < 30) {
        if (!p.take) { if (st.v > SPEED * 0.5 && !p.saidSkip) { p.saidSkip = true; say(p.x === 4300 ? '泥地正中那箱，不下去捡了' : '全速冲过去：不减速就捡不到'); } continue; }
        if (p.kind === 'coal') { p.taken = true; st.coal = Math.min(1, st.coal + 0.15); say('慢行铲上一堆煤 +15%'); puff(p.x, gAt(p.x) - 10, 10, COAL[3]); }
        else if (!slots()) { p.full = true; say('货位满了'); }
        else { p.taken = true; st.load.push(p.kind); say(p.kind === 'relic' ? '拿到遗迹件！' : '慢行捡到一箱物资'); }
      }
    }
    for (const e of foes) if (e.spoil && !e.spoilTaken && Math.abs(e.x - (st.x + 40)) < 30) {
      if (!e.take) { e.spoilTaken = true; continue; }
      if (slots()) { e.spoilTaken = true; st.load.push('supply'); say('从残骸上拆下一包零件'); }
    }
    // 遗迹门：停车，开炮把门轰开
    if (st.gateSt === 0 && f >= R1.gate.x - 40) {
      st.mode = 'hold'; st.hold = 2.6; st.gateT = 0; say('停车 · 轰开遗迹门');
      st.holdTick = (d) => { st.gateT += d; const s = st.gateT > 1.7 ? 2 : st.gateT > 0.8 ? 1 : 0; if (s !== st.gateSt) { st.gateSt = s; puff(R1.gate.x, gAt(R1.gate.x) - 60, 24, STONE[3], 90); } if (Math.random() < d * 6) muzzle(); };
      return move(dt);
    }
    if (!st.waterDone && f >= R1.water + 10) { st.waterDone = true; st.mode = 'hold'; st.hold = 1.2; say('水塔下停一停：补满水'); return move(dt); }
    // 遭遇：敌车登场 → 对打 → 打爆 → 残骸变成拆件
    for (const e of foes) {
      if (e.state === 'wait' && f >= e.at - e.len / 2 - 300) { e.state = 'fight'; e.ft = 0; say(`遭遇 · ${e.name}`, 2.8); st.fight = e; }
      if (e.state === 'fight') {
        e.ft += dt;
        if (e.charge) e.x = Math.max(e.charge, e.x - 70 * dt);
        st.mode = 'hold'; st.hold = 0.05;
        if (Math.random() < dt * 5) muzzle(); if (Math.random() < dt * 4) puff(e.x + (Math.random() - 0.5) * e.len, gAt(e.x) - 60 - Math.random() * 80, 6, P.fire[2], 40);
        if (e.ft > 3.2) { e.state = 'dead'; e.burn = 1.6; puff(e.x, gAt(e.x) - 60, 30, P.steam[1], 90); st.coal -= 0.04; st.fight = null; say(`${e.name} 被打爆了`); }
        return move(dt);
      }
      if (e.state === 'dead' && e.burn > 0) { e.burn -= dt; if (e.burn <= 0) e.spoil = true; }
    }
    if (f >= R1.end) { st.ended = true; say('抵达旧煤场 · 坐运煤小火车回家', 99); }
    move(dt);
  }
  function muzzle() { const x = front() - 20, y = gAt(x) - 7 * S + 12; st.parts.push({ x: x + 30, y, vx: 0, vy: 0, life: 0.12, col: P.fire[3], big: 1 }); }
  function move(dt) {
    const d = st.v * dt;
    st.x += d; st.phase += d;
    st.coal = Math.max(0, st.coal - d * 0.9 / 7400);
    if (st.fight && st.fight.state !== 'fight') st.fight = null;
  }
  function camTarget() {
    if (st.fight) return (st.x + st.fight.x) / 2 - VW / 2;
    return clamp(st.x - 380, 0, LEN - VW);
  }
  function fastForward(to) { let guard = 0; while (front() < to && !st.ended && guard++ < 40000) step(1 / 30); st.note = null; }

  // ---------- 画 ----------
  const bd = document.createElement('canvas'); bd.width = VW; bd.height = VH; const bg = bd.getContext('2d');
  function draw() {
    const t = performance.now() / 1000, cam = { x: st.cam, y: GROUND + 60 - VH, w: VW, h: VH }, ox = Math.floor(cam.x), oy = Math.floor(cam.y);
    // 背景：暂借「野地」，压暗去色当废土（真正的废土场景是计划 V2）
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.imageSmoothingEnabled = false;
    SA.Scenes.back('wild', bg, VW, VH, oy, cam.x, t, {});
    const vis = (x, w = 400) => x + w > cam.x && x - w < cam.x + VW;
    const putOn = (g, a, x, y) => { if (vis(x, a.c.width)) g.drawImage(a.c, Math.round(x - a.ax), Math.round(y - a.ay)); };
    const put = (a, x, dy = 0) => putOn(vg, a, x, gAt(x) + dy);
    bg.save(); bg.translate(-ox, -oy); SA.Scenes.floor('wild', bg, cam);
    // 地标站在地面的远端（路后面），和背景一起压暗去色
    putOn(bg, pumpHouse(), R1.gate.x + 60, 566); putOn(bg, depot(), 7470, 566); putOn(bg, waterTower(), R1.water, 606);
    bg.restore();
    vg.setTransform(1, 0, 0, 1, 0, 0); vg.imageSmoothingEnabled = false;
    vg.filter = 'saturate(0.45) sepia(0.3) brightness(0.88)'; vg.drawImage(bd, 0, 0); vg.filter = 'none';
    vg.save(); vg.translate(-ox, -oy);
    put(startSign(), 260);
    // 地形（土坡、泥地）
    for (const tl of tiles) if (vis(tl.x + 640, 700)) vg.drawImage(tl.c, tl.x, 0);
    put(train(), 7440);
    for (const c of R1.crates) { if (!vis(c.x)) continue; const y1 = gAt(c.x); if (c.dead) SA.TerrainArt.rubble(vg, c.x - c.w / 2 - 6, c.x + c.w / 2 + 6, y1); else SA.TerrainArt.crate(vg, c.x - c.w / 2, y1 - c.h, c.w, c.h, 1, 0); }
    for (const b of R1.bars) put(barricade(b.st), b.x);
    put(ruinGate(st.gateSt), R1.gate.x);
    // 拾取物
    for (const p of R1.pickups) {
      if (!vis(p.x)) continue;
      if (p.kind === 'coal') put(coalPile(!p.taken), p.x);
      else if (p.kind === 'supply') put(supplyCache(p.taken), p.x);
      else if (p.kind === 'relic' && !p.taken) { const a = relicChest(), y = gAt(p.x); const k = 0.5 + 0.5 * Math.sin(t * 3); vg.globalAlpha = 0.25 + 0.2 * k; vg.fillStyle = GLOW[2]; for (let r = 18; r > 6; r -= 4) vg.fillRect(Math.round(p.x - r), Math.round(y - 12 - r / 2), r * 2, r); vg.globalAlpha = 1; put(a, p.x); }
      else if (p.kind === 'refugee' && !p.taken) refugeeGroup(p, t);
    }
    for (const e of foes) if (e.spoil && !e.spoilTaken) put(spoils(), e.x);
    // 敌车
    for (const e of foes) {
      if (!vis(e.x, 300) || (e.state === 'dead' && e.burn <= 0)) continue;
      const cv = SA.SPR.renderVehicle(e.v, { key: `route-e${e.i}`, t, phase: e.at - e.x, moving: e.state === 'fight' && !!e.charge, speed: 40, heat: 0.5, water: 0.7 });
      drawCar(vg, e.state === 'dead' ? darken(cv) : cv, e.span, e.x, -1);
      if (e.state === 'dead') puff(e.x, gAt(e.x) - 50, 1, P.steam[0], 50);
    }
    // 玩家
    drawCar(vg, playerCar(t, st.phase, st.v > 2, st.v, st.load, st.coal), [4, 11], st.x, 1);
    // 粒子
    for (const p of st.parts) { vg.globalAlpha = Math.min(1, p.life * 2); vg.fillStyle = p.col; const s = p.big ? 8 : 3; vg.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
    vg.globalAlpha = 1;
    vg.restore();
    SA.Scenes.front('wild', vg, VW, VH, oy, cam.x, t);
    hud(t);
  }
  function refugeeGroup(p, t) { RA.refugees(vg, p.x, gAt(p.x), t, { seed: p.seed, near: Math.abs(front() - p.x) < 260, sad: p.full }); }
  // 顶上的路程条（替换计时鼓）+ 演示旁白
  function hud(t) {
    const x0 = 400, w = 480, y0 = 10;
    const q = wrap(view);
    q.box(x0 - 14, y0, w + 28, 30, [IR[0], IR[1], IR[2], IR[3]]);
    for (const rx of [x0 - 10, x0 + w + 8]) { q.px(rx, y0 + 4, IR[4]); q.px(rx, y0 + 24, IR[4]); }
    q.R(x0, y0 + 18, w, 2, P.dark[1]); q.R(x0, y0 + 18, Math.round(w * clamp(front() / R1.end, 0, 1)), 2, BR[2]);
    const at = (x) => x0 + Math.round(w * x / R1.end);
    for (const e of foes) { const xx = at(e.at); q.R(xx - 3, y0 + 7, 7, 7, e.state === 'dead' ? IR[1] : RU[2]); q.R(xx - 2, y0 + 8, 5, 5, e.state === 'dead' ? IR[2] : RU[3]); q.px(xx, y0 + 10, IR[0]); }
    for (const p of R1.pickups) if (p.kind === 'refugee') { const xx = at(p.x); q.disc(xx, y0 + 10, 3, p.taken ? IR[2] : '#d8d2c0'); }
    { const xx = at(R1.gate.x); q.disc(xx, y0 + 10, 3.5, st.gateSt === 2 ? IR[2] : GLOW[2]); q.px(xx, y0 + 10, IR[0]); }
    { const xx = at(R1.end); q.R(xx, y0 + 4, 1, 12, P.white); q.R(xx + 1, y0 + 4, 6, 4, RU[3]); }
    const cx = at(clamp(front(), 0, R1.end)); q.R(cx - 4, y0 + 15, 9, 5, BR[2]); q.R(cx - 3, y0 + 14, 5, 1, BR[3]); q.px(cx - 3, y0 + 20, IR[0]); q.px(cx + 3, y0 + 20, IR[0]);
    if (st.note && st.noteT > 0) {
      vg.font = 'bold 18px sans-serif'; const tw = vg.measureText(st.note).width;
      q.box(VW / 2 - tw / 2 - 16, 56, tw + 32, 32, [BR[0], BR[1], '#3a2a14', BR[2]]);
      vg.fillStyle = '#f5e6c0'; vg.textAlign = 'center'; vg.textBaseline = 'middle'; vg.fillText(st.note, VW / 2, 73); vg.textAlign = 'start';
    }
  }
  // 驾驶台：煤表 + 货位格（HTML 外框里的两块小画布）+ 汽笛
  const coalG = wrap(document.getElementById('coalG')), cargoG = wrap(document.getElementById('cargoG'));
  function dash(t) {
    coalG.g.clearRect(0, 0, 124, 20);
    coalG.box(0, 0, 124, 20, [IR[0], IR[1], P.dark[1], IR[2]]);
    const n = Math.ceil(st.coal * 20), low = st.coal < 0.2;
    for (let i = 0; i < 20; i++) { const x = 3 + i * 6; if (i < n) { coalG.R(x, 4, 5, 12, low && Math.floor(t * 4) % 2 ? P.fire[1] : COAL[2]); coalG.R(x, 4, 5, 1, COAL[4]); coalG.px(x, 5, COAL[3]); } else coalG.R(x, 4, 5, 12, P.dark[0]); }
    cargoG.g.clearRect(0, 0, 132, 28);
    for (let i = 0; i < 4; i++) {
      const x = i * 33; cargoG.box(x, 0, 30, 28, [BR[0], BR[1], '#2a2016', BR[2]]);
      const k = st.load[i]; if (!k) continue;
      if (k === 'refugee') cargoG.img(rider(i + 1), x + 9, 6);
      else if (k === 'relic') relicAt(cargoG, x + 15, 22);
      else [sackAt, crateAt, barrelAt][i % 3](cargoG, x + 15, 24);
    }
    document.getElementById('slowLamp').classList.toggle('on', !!st.slow && !st.ended);
    document.getElementById('stopLamp').classList.toggle('on', st.mode === 'hold' && !st.fight);
    document.getElementById('where').textContent = `${Math.round(front() * 1.5 / 24)} m`;
  }
  {
    const q = wrap(document.getElementById('whistle'));
    q.box(9, 2, 10, 18, BRASSB); q.R(11, 4, 1, 14, BR[3]); q.R(8, 0, 12, 3, BR[1]); q.R(10, 20, 8, 3, BR[0]);
    q.R(13, 23, 2, 6, IR[1]); q.box(9, 28, 10, 6, IRONB);
  }

  // ---------- ② 路线图（出征黑板）----------
  function drawMap() {
    const m = wrap(document.getElementById('map')), W = 1536, H = 240, k = W / LEN, chalk = '#e4dfcf', dim = '#9a978a';
    m.R(0, 0, W, H, '#1d2621');
    for (let i = 0; i < 900; i++) m.px(hash(i, 1) * W, hash(i, 2) * H, '#243029');
    const gy = (x) => 170 - (GROUND - gAt(x)) * 1.2;
    for (let x = 0; x < W; x++) { const y = gy(x / k); m.px(x, y, chalk); if (hash(x, 3) < 0.7) m.px(x, y + 1, dim); }
    for (const [a, b] of R1.mud) for (let x = a * k; x < b * k; x += 4) m.line(x, 176, x + 6, 184, dim);
    for (const c of R1.crates) m.R(c.x * k - 3, gy(c.x) - 8, 6, 7, dim);
    for (const b of R1.bars) { const x = b.x * k; m.line(x - 5, gy(b.x) - 12, x + 5, gy(b.x) - 2, chalk); m.line(x + 5, gy(b.x) - 12, x - 5, gy(b.x) - 2, chalk); }
    m.g.globalCompositeOperation = 'source-over';
    for (const e of foes) {
      const src = SA.SPR.renderVehicle(e.v, { key: 'map-e', t: 0 }), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#d98a6a'; g.fillRect(0, 0, c.width, c.height);
      const sc = 0.32, bx = PADX + (e.span[0] + e.span[1] + 1) / 2 * S;
      m.g.save(); m.g.translate(e.at * k, gy(e.at)); m.g.scale(-sc, sc); m.g.drawImage(c, -bx, -ROWS * S); m.g.restore();
      m.disc(e.at * k, gy(e.at) - 40, 15, (a, b) => (Math.abs(Math.hypot(a, b) - 0.92) < 0.09 ? '#d98a6a' : null));
    }
    const icon = (x, kind) => { const X = x * k, Y = gy(x) - 22; if (kind === 'coal') m.R(X - 4, Y + 10, 8, 5, '#6a7286'); else if (kind === 'supply') { m.R(X - 4, Y + 6, 8, 8, chalk); m.R(X - 3, Y + 7, 6, 6, '#1d2621'); m.line(X - 3, Y + 7, X + 2, Y + 12, chalk); } else if (kind === 'refugee') { m.disc(X - 3, Y + 6, 2.5, chalk); m.disc(X + 3, Y + 7, 2.2, chalk); m.R(X - 6, Y + 9, 12, 5, chalk); } else if (kind === 'relic') m.disc(X, Y + 8, 5, GLOW[2]); };
    for (const p of R1.pickups) icon(p.x, p.kind);
    m.R(R1.water * k - 1, gy(R1.water) - 26, 2, 26, dim); m.R(R1.water * k - 5, gy(R1.water) - 32, 10, 7, P.water[2]);
    m.R(R1.gate.x * k - 6, gy(R1.gate.x) - 26, 3, 26, chalk); m.R(R1.gate.x * k + 3, gy(R1.gate.x) - 26, 3, 26, chalk); m.line(R1.gate.x * k - 6, gy(R1.gate.x) - 28, R1.gate.x * k + 6, gy(R1.gate.x) - 28, chalk);
    m.R(R1.end * k, gy(R1.end) - 34, 2, 34, chalk); m.R(R1.end * k + 2, gy(R1.end) - 34, 12, 8, '#d98a6a');
    m.g.font = '13px sans-serif'; m.g.fillStyle = chalk;
    const segs = [[0, '院门'], [640, '碎石路'], [1920, '拦路 · 拾荒小车'], [2560, '土坡 · 难民'], [3840, '泥洼 · 铁皮罐头'], [4800, '水泵站遗迹'], [5760, '煤场前哨 · 推土机'], [7040, '旧煤场']];
    for (const [x, s] of segs) { m.R(x * k, 8, 1, 200, '#33423a'); m.g.fillText(s, x * k + 6, 24); }
    m.g.fillStyle = dim; m.g.fillText('泥地：履带吃香，双足吃亏', 3900 * k + 4, 204); m.g.fillText('补水', R1.water * k - 12, gy(R1.water) - 38);
  }

  // ---------- ③ ④ 选项卡片 ----------
  function big(c, s) { const o = document.createElement('canvas'); o.className = 'px'; o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); o.style.width = `${c.width * s}px`; o.style.height = `${c.height * s}px`; return o; }
  const fig = (c, s, cap) => { const f = document.createElement('figure'); f.append(big(c, s)); f.append(cap); return f; };
  function cards(box, table, which, render) {
    box.innerHTML = '';
    for (const [k, o] of Object.entries(table)) {
      const card = document.createElement('div'); card.className = `card ${pick[which] === k ? 'on' : ''}`;
      const h = document.createElement('h3'); h.textContent = `${o.name}${pick[which] === k ? '　· 预览中' : ''}`;
      const row = document.createElement('div'); row.className = 'row';
      render(o, row);
      const p = document.createElement('p'); p.textContent = o.desc;
      card.append(h, row, p);
      card.onclick = () => { pick[which] = k; buildCards(); };
      box.append(card);
    }
  }
  function buildCards() {
    cards(document.getElementById('cargoOpts'), CARGO, 'cargo', (o, row) => {
      for (const [load, cap] of [[[], '空'], [['supply', 'supply'], '两件物资'], [['supply', 'refugee', 'supply', 'refugee'], '装满（含难民）']]) { const q = pen(48, 48); o.big(q, 0, 0, load); row.append(fig(q.c, 3, cap)); }
      for (const [load, cap] of [[[], '小 · 空'], [['refugee'], '小 · 一人']]) { const q = pen(24, 24); o.small(q, 0, 0, load); row.append(fig(q.c, 3, cap)); }
    });
    cards(document.getElementById('binOpts'), BIN, 'bin', (o, row) => {
      for (const [lv, cap] of [[1, '满'], [0.5, '半'], [0.15, '快没了'], [0, '空']]) { const q = pen(24, 48); o.draw(q, 0, 0, lv); row.append(fig(q.c, 3, cap)); }
    });
  }
  function buildSheet() {
    const box = document.getElementById('props'); box.innerHTML = '';
    const add = (a, cap) => box.append(fig(a.c, 2, cap));
    add(coalPile(true), '煤堆'); add(coalPile(false), '煤堆 · 铲走后');
    add(supplyCache(false), '物资箱'); add(supplyCache(true), '物资箱 · 捡走后'); add(spoils(), '残骸拆件');
    { const q = pen(110, 40); [[-30, 0], [-6, 1], [18, 2]].forEach(([dx, k], i) => { q.img(SA.Coal.draw(SA.Coal.crew(`难民${1 + k}`), { size: 'sprite', pose: i === 1 ? 'wave' : 'cheer', expr: 'happy', look: -1 }), 40 + dx, 0); q.R(46 + dx + 6 + 20 - 20, 34, 7, 6, SACK[1]); }); q.R(96, 0, 3, 40, WOOD[2]); q.R(99, 1, 10, 7, '#d8d2c0'); add({ c: q.c }, '难民一家 · 路牌下挥白布'); }
    add(barricade(0), '掠夺者路障'); add(barricade(1), '路障 · 打坏'); add(barricade(2), '路障 · 撞开');
    add(ruinGate(0), '遗迹门 · 锁着'); add(ruinGate(1), '遗迹门 · 链子断了'); add(ruinGate(2), '遗迹门 · 轰开'); add(relicChest(), '遗迹箱（发以太光）');
    add(waterTower(), '水塔'); add(startSign(), '院门口的路牌');
    { const q = pen(320, 270); q.img(pumpHouse().c, 0, 0); box.append(fig(q.c, 1, '地标 · 废弃水泵站（1 倍）')); }
    { const q = pen(360, 300); q.img(depot().c, 0, 0); box.append(fig(q.c, 1, '地标 · 旧煤场井架 + 绞车房（1 倍）')); }
    add(train(), '终点 · 平板车 + 小水柜机车');
  }

  // ---------- 控制 ----------
  const scrub = document.getElementById('scrub'), playBtn = document.getElementById('play');
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '暂停' : '播放'; };
  document.getElementById('restart').onclick = () => { reset(0); playing = true; playBtn.textContent = '暂停'; };
  for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { mul = +b.dataset.speed; };
  scrub.oninput = () => { reset(+scrub.value); };
  document.getElementById('mapBox').onclick = (e) => { const r = e.currentTarget.querySelector('canvas').getBoundingClientRect(); reset(clamp((e.clientX - r.left) / r.width * LEN, 0, LEN)); };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) for (let i = 0; i < mul; i++) step(dt);
    st.cam += (camTarget() - st.cam) * Math.min(1, dt * 3);
    draw(); dash(now / 1000);
    if (document.activeElement !== scrub) scrub.value = Math.round(front());
    requestAnimationFrame(frame);
  }
  reset(0); buildCards(); buildSheet(); drawMap();
  requestAnimationFrame(frame);
  SA.ExpeditionLab = { st, reset, step, draw, pick };
})();
