// 「当前开发」页：出征 · 样板路线 1 · 视觉稿 v1（2026-10-06）。计划见 docs/expedition-plan.md。
// 这一页不复用：用户确认后复制到 tools/archive/expedition-v1.*，在 labs.js 登记，再换下一项。
// 只是画面样机：路线按计划 §4 的分段表手抄一份；敌车读 config/stage-cars.json 的现有关卡车；
// 煤、货位、遭遇、破门都是摆拍的假动作，规则以 astra 的实现为准。新件（货箱、煤仓、路线物件）全按世界像素 1:1 画。
window.SA = window.SA || {};
(() => {
  const P = SA.PAL, S = SA.K.CELL, PADX = SA.SPR.PADX, ROWS = SA.K.ROWS;
  const GROUND = 648, VW = 1280, VH = 720, LEN = 7680;
  const IR = P.iron, BR = P.brass, RU = P.rust;
  const WOOD = ['#22130c', '#3b2418', '#55331f', '#6b4128', '#7f5231', '#9a6a3f', '#b88a5a'];
  const COAL = ['#08090c', '#13151a', '#1f232b', '#323844', '#535c6e'];
  const SACK = ['#2e2216', '#4f3b26', '#735838', '#977850', '#b49768'];
  const TARP = ['#2a271d', '#47412f', '#665e45', '#878063', '#a69f80'];
  const BRICK = ['#241310', '#43241c', '#62362a', '#7e4a3a', '#9a6250'];
  const STONE = ['#24221e', '#38352f', '#4f4b43', '#6a655a', '#878172'];
  const IVY = ['#121a0d', '#1f2c15', '#2e411f', '#42592b'];
  const GLOW = ['#1d4a4a', '#3f8f8a', '#7fd8cc', '#d4fff4'];   // 遗迹的以太光
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- 像素笔：1px 一格，左上光 ----------
  function wrap(c) {
    const g = c.getContext('2d');
    const q = {
      c, g,
      R(x, y, w, h, col) { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
      px(x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
      // ramp = [描边, 暗面, 固有色, 亮面]
      box(x, y, w, h, ramp) { q.R(x, y, w, h, ramp[0]); q.R(x + 1, y + 1, w - 2, h - 2, ramp[2]); q.R(x + 1, y + h - 2, w - 2, 1, ramp[1]); q.R(x + w - 2, y + 1, 1, h - 2, ramp[1]); q.R(x + 1, y + 1, w - 2, 1, ramp[3]); q.R(x + 1, y + 1, 1, h - 2, ramp[3]); },
      disc(cx, cy, r, col) { for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) { const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy; if (dx * dx + dy * dy <= r * r) q.px(xx, yy, typeof col === 'function' ? col(dx / r, dy / r) : col); } },
      line(x0, y0, x1, y1, col, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2); for (let i = 0; i <= n; i++) q.R(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w, col); },
      img(src, x, y) { g.drawImage(src, Math.round(x), Math.round(y)); },
    };
    return q;
  }
  const pen = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return wrap(c); };
  const WOODB = [WOOD[1], WOOD[2], WOOD[4], WOOD[5]], IRONB = [IR[0], IR[1], IR[2], IR[3]], BRASSB = [BR[0], BR[1], BR[2], BR[3]];
  const skid = (q, x, y, w) => { q.R(x + 1, y, w - 2, 2, IR[0]); q.R(x + 2, y, w - 4, 1, IR[2]); q.R(x + 3, y + 2, 5, 2, IR[0]); q.R(x + w - 8, y + 2, 5, 2, IR[0]); q.R(x + 4, y + 2, 3, 1, IR[2]); q.R(x + w - 7, y + 2, 3, 1, IR[2]); };

  // ---------- 货物：麻袋 / 木箱 / 木桶 / 坐着的难民 / 遗迹件。都站在 rim（货箱口）上，下半截被箱壁挡住 ----------
  function sackAt(q, cx, rim) {
    const prof = [2, 3, 4, 4, 5, 5, 5, 5, 5], top = rim - 8;
    q.R(cx - 1, top - 2, 2, 2, SACK[3]); q.px(cx - 2, top - 3, SACK[4]); q.px(cx + 1, top - 3, SACK[2]);   // 扎口的穗
    prof.forEach((hw, i) => { const y = top + i; q.R(cx - hw, y, hw * 2, 1, SACK[2]); q.px(cx - hw, y, SACK[0]); q.px(cx + hw - 1, y, SACK[0]); if (hw > 2) { q.px(cx - hw + 1, y, SACK[3]); q.px(cx + hw - 2, y, SACK[1]); } });
    q.R(cx - 2, top, 4, 1, SACK[0]); q.R(cx - 3, top + 1, 6, 1, SACK[1]);
    q.px(cx - 3, top + 4, SACK[4]);
  }
  function crateAt(q, cx, rim) { const x = cx - 5, y = rim - 8; q.box(x, y, 10, 10, WOODB); q.R(x + 1, y + 4, 8, 1, WOOD[2]); q.px(x + 1, y + 1, IR[3]); q.px(x + 8, y + 1, IR[3]); }
  function barrelAt(q, cx, rim) {
    const x = cx - 4, y = rim - 9;
    for (let i = 0; i < 9; i++) { const e = i === 0 || i === 8; q.R(x + i, y + (e ? 1 : 0), 1, e ? 10 : 12, e ? WOOD[1] : i < 3 ? WOOD[5] : i > 6 ? WOOD[2] : WOOD[3]); }
    q.R(x, y + 2, 9, 1, IR[1]); q.R(x + 1, y + 2, 2, 1, IR[3]); q.R(x, y + 7, 9, 1, IR[1]); q.R(x + 1, y + 7, 2, 1, IR[3]);
    q.R(x + 1, y - 1, 7, 1, WOOD[1]); q.R(x + 2, y, 5, 1, WOOD[4]);
  }
  const riders = new Map();
  function rider(seed, expr) {
    const k = `${seed}|${expr || ''}`;
    if (!riders.has(k)) riders.set(k, SA.Coal.draw(SA.Coal.crew(`难民${seed}`), { size: 'mini', expr }));
    return riders.get(k);
  }
  function riderAt(q, cx, rim, seed) { q.img(rider(seed), cx - 5, rim - 9); q.R(cx + 3, rim - 4, 3, 3, SACK[0]); q.px(cx + 4, rim - 3, SACK[3]); }   // 碳球 + 肩上的小包袱
  function relicAt(q, cx, rim) { q.box(cx - 4, rim - 7, 8, 8, BRASSB); q.R(cx - 3, rim - 4, 6, 1, BR[0]); q.px(cx, rim - 3, GLOW[3]); q.px(cx - 1, rim - 3, GLOW[2]); for (const [dx, dy] of [[-5, -8], [4, -9], [5, -2], [-6, -3]]) q.px(cx + dx, rim + dy, GLOW[2]); }
  function contents(q, load, xs, rim, seed = 0) {
    let n = 0;
    load.forEach((k, i) => {
      const cx = xs[i];
      if (cx == null) return;
      if (k === 'refugee') riderAt(q, cx, rim, seed + i);
      else if (k === 'relic') relicAt(q, cx, rim);
      else [sackAt, crateAt, barrelAt][(n++ + seed) % 3](q, cx, rim);
    });
  }

  // ---------- ③ 货箱三套：A 板条货筐 · B 篷布货厢 · C 铆接铁货柜（2×2 = 48×48；小货箱 1×1 = 24×24）----------
  // load：货物数组（'supply' | 'refugee' | 'relic'），按货位顺序从车尾往车头摆
  function cargoA(q, x, y, load) {
    contents(q, load, [x + 9, x + 19, x + 29, x + 39], y + 25);
    q.R(x + 3, y + 24, 42, 18, '#160e09');                       // 板缝里透出的暗腔
    for (const sy of [24, 30, 36]) {
      q.R(x + 3, y + sy, 42, 5, WOOD[3]); q.R(x + 3, y + sy, 42, 1, WOOD[5]); q.R(x + 3, y + sy + 4, 42, 1, WOOD[2]);
      for (let i = 0; i < 42; i += 1) if (hash(i, sy) < 0.1) q.px(x + 3 + i, y + sy + 2, WOOD[4]);
    }
    for (const bx of [15, 31]) { q.R(x + bx, y + 23, 2, 19, IR[1]); q.R(x + bx, y + 23, 1, 19, IR[3]); for (const sy of [26, 32, 38]) q.px(x + bx, y + sy, IR[4]); }
    for (const cx of [0, 44]) { q.R(x + cx, y + 21, 4, 22, IR[0]); q.R(x + cx + 1, y + 22, 2, 20, IR[2]); q.R(x + cx + 1, y + 22, 1, 20, IR[3]); q.px(x + cx + 1, y + 22, IR[4]); }
    q.R(x + 1, y + 41, 46, 2, IR[0]); q.R(x + 2, y + 41, 44, 1, IR[2]);
    skid(q, x, y + 43, 48);
  }
  function cargoB(q, x, y, load) {
    const refs = load.filter(k => k === 'refugee').length, sup = load.filter(k => k !== 'refugee').length;
    q.box(x + 1, y + 31, 46, 12, WOODB); q.R(x + 2, y + 36, 44, 1, WOOD[1]); q.R(x + 2, y + 37, 44, 1, WOOD[4]);
    for (const cx of [1, 43]) { q.R(x + cx, y + 31, 4, 12, IR[1]); q.R(x + cx + 1, y + 32, 2, 10, IR[2]); q.px(x + cx + 1, y + 32, IR[4]); }
    skid(q, x, y + 43, 48);
    // 篷布：三道篷骨撑起的拱，车尾（左）开口；空车在篷骨之间往下塌，物资越多鼓得越高
    const L = 2, Rr = 45, R0 = 9, hoops = [14, 24, 34];
    const bump = (i) => { for (let j = 0; j < sup; j++) if (Math.abs(i - [29, 19, 39, 12][j]) <= 2) return 1; return 0; };
    const sag = (i) => (load.length ? 0 : hoops.some(h => Math.abs(i - (h + 5)) <= 2) ? 1 : 0);
    const topAt = (i) => {
      let t = y + 6;
      if (i < L + R0) t += Math.round(R0 - Math.sqrt(Math.max(0, R0 * R0 - (L + R0 - i) ** 2)));
      else if (i > Rr - R0) t += Math.round(R0 - Math.sqrt(Math.max(0, R0 * R0 - (i - (Rr - R0)) ** 2)));
      return t + sag(i) - bump(i);
    };
    for (let i = L; i <= Rr; i++) {
      const t = topAt(i), hoop = hoops.includes(i), lit = hoops.includes(i - 1);
      for (let yy = t; yy < y + 31; yy++) {
        const edge = yy === t || i === L || i === Rr;
        q.px(x + i, yy, edge ? TARP[0] : hoop ? TARP[1] : lit ? TARP[3] : i <= L + 2 || yy <= t + 1 ? TARP[3] : i >= Rr - 2 ? TARP[1] : TARP[2]);
      }
    }
    q.R(x + L, y + 29, Rr - L + 1, 2, TARP[1]);
    for (let i = L + 3; i < Rr; i += 6) { q.px(x + i, y + 31, SACK[3]); q.px(x + i, y + 32, SACK[1]); }
    // 车尾开口：拉绳收口的椭圆，里面是坐着的人 / 麻袋
    const ox = x + 8, oy = y + 21, rx = 4.6, ry = 8.4;
    const hole = pen(16, 22), hq = hole;
    hq.R(0, 0, 16, 22, '#120c08');
    if (refs > 0) hq.img(rider(7), 2, 2);
    if (refs > 1) hq.img(rider(9), 4, 9);
    if (sup > 0 && refs < 2) sackAt(hq, 8, 22);
    for (let yy = 0; yy < 22; yy++) for (let xx = 0; xx < 16; xx++) { const dx = (xx + 0.5 - 8) / rx, dy = (yy + 0.5 - 11) / ry; if (dx * dx + dy * dy > 1) hq.g.clearRect(xx, yy, 1, 1); }
    q.img(hole.c, ox - 8, oy - 11);
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; q.px(ox + Math.cos(t) * (rx + 0.6), oy + Math.sin(t) * (ry + 0.6), a % 3 ? TARP[3] : TARP[1]); }
    if (refs > 2) { q.img(rider(11), x + 18, y + 25 - 9); }                                         // 多出来的人挤在车斗边上
    if (refs > 3) { q.img(rider(13), x + 27, y + 25 - 9); }
    // 车头篷骨上挂一盏马灯
    q.R(x + 43, y + 9, 1, 3, IR[1]); q.box(x + 42, y + 12, 4, 5, BRASSB); q.R(x + 43, y + 13, 2, 3, P.fire[2]); q.px(x + 43, y + 13, P.fire[3]);
  }
  function cargoC(q, x, y, load) {
    q.R(x + 1, y + 7, 4, 16, IR[0]); q.R(x + 2, y + 8, 2, 14, IR[2]); q.R(x + 2, y + 8, 1, 14, IR[3]); q.px(x + 2, y + 10, IR[4]); q.px(x + 2, y + 19, IR[4]);   // 掀起来的箱盖
    q.line(x + 5, y + 12, x + 9, y + 22, IR[1]);                                                                                                            // 撑杆
    contents(q, load, [x + 12, x + 21, x + 30, x + 39], y + 23);
    q.box(x + 1, y + 22, 46, 21, IRONB);
    for (const sx of [16, 31]) { q.R(x + sx, y + 23, 1, 19, IR[1]); q.R(x + sx + 1, y + 23, 1, 19, IR[3]); }
    for (let xx = 4; xx < 46; xx += 4) { q.px(x + xx, y + 24, IR[4]); q.px(x + xx, y + 40, IR[4]); }
    q.R(x + 2, y + 29, 44, 4, RU[1]); q.R(x + 2, y + 29, 44, 1, RU[2]);                       // 褪色的漆带
    for (const [dx, dy] of [[21, 34], [22, 34], [23, 34], [23, 35], [22, 36], [23, 37], [21, 38], [22, 38], [23, 38]]) q.px(x + dx, y + dy, P.steam[1]);   // 刷上去的「3」号
    q.R(x + 45, y + 25, 2, 1, IR[0]); q.R(x + 46, y + 25, 1, 7, IR[0]); q.R(x + 45, y + 31, 2, 1, IR[0]);   // 车头一侧的把手
    skid(q, x, y + 43, 48);
  }
  function smallA(q, x, y, load) {
    contents(q, load, [x + 12], y + 11);
    q.R(x + 2, y + 10, 20, 11, '#160e09');
    for (const sy of [10, 16]) { q.R(x + 2, y + sy, 20, 5, WOOD[3]); q.R(x + 2, y + sy, 20, 1, WOOD[5]); q.R(x + 2, y + sy + 4, 20, 1, WOOD[2]); }
    for (const cx of [0, 21]) { q.R(x + cx, y + 8, 3, 13, IR[0]); q.R(x + cx + 1, y + 9, 1, 11, IR[3]); }
    skid(q, x, y + 20, 24);
  }
  function smallB(q, x, y, load) {
    q.box(x + 1, y + 15, 22, 6, WOODB); skid(q, x, y + 20, 24);
    for (let i = 2; i <= 21; i++) { const d = Math.abs(i - 11.5) / 10, t = y + 4 + Math.round(9 * (1 - Math.sqrt(Math.max(0, 1 - d * d)))) - (load.length ? 1 : 0); for (let yy = t; yy < y + 15; yy++) q.px(x + i, yy, yy === t || i === 2 || i === 21 ? TARP[0] : i < 5 ? TARP[3] : i > 18 ? TARP[1] : i === 12 ? TARP[1] : TARP[2]); }
    q.R(x + 4, y + 9, 5, 6, '#120c08');
    if (load[0] === 'refugee') { const r = rider(5); q.g.save(); q.g.beginPath(); q.g.rect(x + 4, y + 9, 5, 6); q.g.clip(); q.img(r, x + 1, y + 6); q.g.restore(); }
    else if (load[0]) q.R(x + 5, y + 11, 3, 4, SACK[2]);
  }
  function smallC(q, x, y, load) {
    q.R(x + 1, y + 1, 3, 10, IR[0]); q.R(x + 2, y + 2, 1, 8, IR[3]);
    contents(q, load, [x + 13], y + 11);
    q.box(x + 1, y + 10, 22, 11, IRONB); q.R(x + 2, y + 14, 20, 2, RU[1]); for (let xx = 3; xx < 22; xx += 4) q.px(x + xx, y + 12, IR[4]);
    skid(q, x, y + 20, 24);
  }
  const CARGO = {
    A: { name: 'A 板条货筐', big: cargoA, small: smallA, desc: '敞口木条筐 + 两道铁箍 + 铁角柱。装了什么一眼就看见：麻袋、木箱、木桶、探出头的难民都露在筐口上。最轻、最便宜的感觉，前期就有。' },
    B: { name: 'B 篷布货厢', big: cargoB, small: smallB, desc: '木车斗 + 三道篷骨撑起的篷布，车尾一个收口的开口，人从里面往外看；物资越多篷布鼓得越高，空车时篷布塌下去；车头挂一盏马灯。最有「逃难大篷车」的味道，但装了几件要看驾驶台的货位格。' },
    C: { name: 'C 铆接铁货柜', big: cargoC, small: smallC, desc: '铆接铁皮柜，箱盖掀起来用撑杆撑着，货物和人从口上露出来；褪色漆带上刷着编号。最结实、最像军用补给车，和装甲件放一起不突兀。' },
  };

  // ---------- ④ 煤仓三套（1×2 = 24×48），lv = 煤量 0～1 ----------
  function lumps(q, x0, y0, w, h, seed, solid = true) {
    if (solid) q.R(x0, y0, w, h, COAL[1]);
    for (let yy = 0; yy < h; yy += 2) for (let xx = (yy >> 1) % 2; xx < w; xx += 3) {
      const r = hash(xx + seed, yy + seed * 7);
      if (r < 0.55) { q.px(x0 + xx, y0 + yy, COAL[2]); if (r < 0.25) q.px(x0 + xx, y0 + yy, COAL[3]); if (r < 0.08) q.px(x0 + xx, y0 + yy, COAL[4]); }
    }
  }
  function binA(q, x, y, lv) {
    // 漏斗：上宽下窄，前面一条浮子刻度槽（黄铜浮标的高度 = 煤量）
    const y0 = y + 8, y1 = y + 31, xl = (yy) => x + 1 + Math.round((yy - y0) * 5 / (y1 - y0)), xr = (yy) => x + 22 - Math.round((yy - y0) * 5 / (y1 - y0));
    if (lv > 0.7) { for (let i = 2; i <= 21; i++) { const hh = Math.round(7 * Math.sin(Math.PI * (i - 1) / 21) * (lv - 0.55) / 0.45); for (let k = 0; k <= hh; k++) q.px(x + i, y0 - 1 - k, k === hh ? COAL[0] : COAL[1]); } lumps(q, x + 3, y0 - 6, 18, 6, 3, false); }
    for (let yy = y0; yy <= y1; yy++) { const a = xl(yy), b = xr(yy); q.R(a, yy, b - a + 1, 1, IR[2]); q.px(a, yy, IR[0]); q.px(b, yy, IR[0]); q.px(a + 1, yy, IR[3]); q.px(b - 1, yy, IR[1]); }
    q.R(x, y0 - 1, 24, 2, IR[0]); q.R(x + 1, y0 - 1, 22, 1, IR[3]);                      // 口沿
    if (lv <= 0.7 && lv > 0.03) for (let i = 2; i < 22; i += 3) q.px(x + i, y0 - 2, COAL[2]);   // 口沿下露出一点煤
    q.R(xl(y1), y1, xr(y1) - xl(y1) + 1, 1, IR[0]);
    for (let xx = 4; xx < 21; xx += 4) { q.px(x + xx, y0 + 3, IR[4]); q.px(x + xx, y0 + 4, IR[1]); }
    // 浮子槽
    q.R(x + 11, y0 + 5, 3, 16, IR[0]); q.R(x + 12, y0 + 6, 1, 14, '#0c0e14');
    const fy = y0 + 19 - Math.round(lv * 13); q.R(x + 10, fy, 5, 2, BR[2]); q.px(x + 10, fy, BR[3]);
    // 腿 + 往车头斜下去的溜槽
    for (const lx of [5, 17]) { q.R(x + lx, y1, 2, 13, IR[0]); q.px(x + lx, y1, IR[3]); }
    q.line(x + 12, y1 + 1, x + 22, y1 + 8, IR[1], 3); q.line(x + 12, y1, x + 22, y1 + 7, IR[3]);
    if (lv > 0.03) { q.px(x + 23, y1 + 9, COAL[3]); q.px(x + 22, y1 + 11, COAL[2]); }
    skid(q, x, y + 44, 24);
  }
  function binB(q, x, y, lv) {
    // 铆接圆筒煤柜：圆顶 + 黄铜加煤口；筒身中间一条玻璃视窗看煤位；底下螺旋送煤管 + 手轮
    q.R(x + 10, y + 0, 4, 2, BR[1]); q.R(x + 10, y + 0, 4, 1, BR[3]);
    for (let i = 0; i < 20; i++) { const d = Math.abs(i - 9.5) / 10, h = Math.round(5 * Math.sqrt(1 - d * d)); q.R(x + 2 + i, y + 7 - h, 1, h, i < 4 ? IR[3] : i > 15 ? IR[1] : IR[2]); q.px(x + 2 + i, y + 7 - h, IR[0]); }
    for (let i = 0; i < 20; i++) { const t = i / 19; q.R(x + 2 + i, y + 7, 1, 33, i === 0 || i === 19 ? IR[0] : t < 0.18 ? IR[4] : t < 0.4 ? IR[3] : t > 0.8 ? IR[1] : IR[2]); }
    for (const by of [9, 37]) { q.R(x + 2, y + by, 20, 2, IR[1]); q.R(x + 3, y + by, 5, 1, IR[4]); }
    const wy = y + 13, wh = 22, lh = Math.round(wh * lv);
    q.R(x + 7, wy - 1, 10, wh + 2, IR[0]); q.R(x + 8, wy, 8, wh, P.glass[0]);
    if (lh > 0) lumps(q, x + 8, wy + wh - lh, 8, lh, 11);
    if (lh > 0) q.R(x + 8, wy + wh - lh, 8, 1, COAL[3]);
    q.R(x + 9, wy + 1, 1, Math.min(8, wh - lh), P.glass[1]);
    for (let k = 0; k <= 4; k++) q.px(x + 18, wy + Math.round(k * wh / 4), BR[2]);
    q.R(x + 1, y + 40, 23, 4, IR[0]); q.R(x + 2, y + 41, 21, 2, IR[2]); q.R(x + 2, y + 41, 21, 1, IR[3]);
    q.disc(x + 3.5, y + 42, 3, (a, b) => (Math.hypot(a, b) > 0.6 ? BR[1] : BR[0])); q.px(x + 2, y + 40, BR[3]);
    skid(q, x, y + 44, 24);
  }
  function binC(q, x, y, lv) {
    // 煤袋架：铁架三层、每层两袋；用掉一袋就空一格
    for (const lx of [0, 21]) { q.R(x + lx, y + 2, 3, 43, IR[0]); q.R(x + lx + 1, y + 3, 1, 41, IR[3]); }
    for (const sy of [16, 31]) { q.R(x, y + sy, 24, 2, IR[0]); q.R(x + 1, y + sy, 22, 1, IR[2]); }
    const n = Math.round(lv * 6), slots = [[45, 7], [45, 16], [30, 7], [30, 16], [15, 7], [15, 16]];
    slots.slice(0, n).forEach(([by, cx], i) => {
      const top = y + by - 12;
      for (let k = 0; k < 12; k++) { const hw = k < 2 ? 2 : k < 4 ? 3 : 4, yy = top + k; q.R(x + cx - hw, yy, hw * 2 + 1, 1, SACK[1]); q.px(x + cx - hw, yy, SACK[0]); q.px(x + cx + hw, yy, SACK[0]); if (hw > 2) q.px(x + cx - hw + 1, yy, SACK[2]); }
      q.R(x + cx - 1, top - 1, 3, 2, COAL[2]); q.px(x + cx, top - 2, COAL[3]);   // 袋口露出的煤
      q.R(x + cx - 2, top + 6, 5, 2, COAL[1]); q.px(x + cx - 2, top + 6, COAL[3]);   // 煤灰印
      q.R(x + cx - 4, top + 11, 9, 1, SACK[0]);
    });
    if (n === 0) { q.R(x + 4, y + 42, 9, 2, SACK[1]); q.R(x + 4, y + 42, 9, 1, SACK[2]); }       // 空了：一只瘪袋子
    q.R(x, y + 45, 24, 3, IR[0]); q.R(x + 1, y + 45, 22, 1, IR[2]);
  }
  const BIN = {
    A: { name: 'A 漏斗煤斗', draw: binA, desc: '上宽下窄的铁漏斗，满了煤堆冒出口沿；前面一条浮子槽，黄铜浮标的高度就是煤量；底下溜槽斜着往锅炉送煤。最像真机器。' },
    B: { name: 'B 圆筒煤柜', draw: binB, desc: '铆接圆筒 + 圆顶黄铜加煤口，筒身一条玻璃视窗直接看煤位，底下螺旋送煤管和手轮。和现在的水罐（大水窗）是一家人，读数最清楚。' },
    C: { name: 'C 煤袋架', draw: binC, desc: '三层铁架摞着六袋煤，用掉一袋空一格，数袋子就知道还剩多少。最土、最有逃难感，也最好笑。' },
  };
  const pick = { cargo: 'A', bin: 'B' };

  // ---------- ⑤ 路线上的东西（世界像素 1:1）。每个返回 { c, ax, ay }：(ax, ay) = 落地点（底边中点）----------
  const art = new Map();
  const cached = (k, make) => { if (!art.has(k)) art.set(k, make()); return art.get(k); };
  const coalPile = (full) => cached(`coal${full}`, () => {
    const q = pen(66, 30);
    if (full) {
      for (let i = 0; i < 62; i++) { const u = (i - 31) / 31, hh = Math.round(20 * Math.pow(Math.max(0, 1 - u * u), 0.85)); q.R(2 + i, 29 - hh, 1, hh + 1, COAL[1]); q.px(2 + i, 29 - hh, COAL[0]); if (u < -0.2) q.px(2 + i, 30 - hh, COAL[3]); }
      for (let k = 0; k < 70; k++) { const u = hash(k, 1) * 2 - 1, hh = 20 * Math.pow(Math.max(0, 1 - u * u), 0.85), xx = Math.round(33 + u * 30), yy = Math.round(29 - hash(k, 2) * hh); if (yy < 29 - hh + 2) continue; q.R(xx, yy, 2, 2, COAL[2]); q.px(xx, yy, u < 0.2 ? COAL[4] : COAL[3]); }
      q.line(50, 2, 42, 22, WOOD[5], 2); q.line(51, 3, 43, 23, WOOD[2]); q.R(48, 1, 6, 2, WOOD[4]);   // 插着的铁锹
      q.R(39, 21, 6, 5, IR[3]); q.R(39, 21, 6, 1, IR[4]);
    } else {
      for (let k = 0; k < 26; k++) { const xx = 4 + Math.round(hash(k, 3) * 56), yy = 27 - Math.round(hash(k, 4) * 3); q.R(xx, yy, 2, 2, COAL[2]); q.px(xx, yy, COAL[3]); }
      q.R(18, 27, 26, 2, WOOD[4]); q.R(18, 27, 26, 1, WOOD[5]); q.R(44, 25, 7, 4, IR[3]);                   // 铁锹倒在地上
    }
    return { c: q.c, ax: 33, ay: 30 };
  });
  const supplyCache = (taken) => cached(`supply${taken}`, () => {
    const q = pen(62, 36);
    q.box(2, 31, 58, 5, WOODB); for (let xx = 8; xx < 58; xx += 10) q.R(xx, 32, 1, 3, WOOD[1]);   // 货板
    if (!taken) {
      q.box(4, 10, 25, 21, WOODB); q.R(5, 20, 23, 1, WOOD[1]); q.R(5, 21, 23, 1, WOOD[4]);
      for (const [cx, cy] of [[4, 10], [24, 10], [4, 26], [24, 26]]) { q.R(cx, cy, 5, 5, IR[1]); q.px(cx + 1, cy + 1, IR[4]); }
      q.line(6, 12, 26, 29, SACK[3]); q.line(26, 12, 6, 29, SACK[3]);                             // 捆箱子的麻绳
      sackAt(q, 37, 31); q.R(30, 23, 1, 8, SACK[0]);
      barrelAt(q, 51, 31);
    } else { q.line(10, 30, 26, 29, SACK[3]); q.line(26, 29, 30, 30, SACK[2]); }
    return { c: q.c, ax: 31, ay: 36 };
  });
  const spoils = () => cached('spoils', () => {
    const q = pen(44, 18);
    q.box(2, 9, 18, 9, IRONB); q.line(18, 16, 30, 8, IR[3], 2); q.box(22, 11, 14, 7, [RU[0], RU[1], RU[2], RU[3]]);
    q.disc(30, 9, 6, (a, b) => { const r = Math.hypot(a, b), ang = Math.atan2(b, a); return r < 0.35 ? IR[0] : r > 0.8 && Math.cos(ang * 8) < 0.2 ? null : a + b < -0.3 ? IR[4] : IR[2]; });
    q.px(29, 8, BR[3]); q.R(36, 13, 6, 5, BR[1]); q.R(36, 13, 6, 1, BR[3]);
    return { c: q.c, ax: 22, ay: 18 };
  });
  const waterTower = () => cached('water', () => {
    const q = pen(52, 118);
    for (const [x0, x1] of [[8, 4], [42, 46]]) q.line(x0, 40, x1, 117, IR[1], 3);   // 两条斜腿
    q.line(8, 60, 44, 90, IR[0]); q.line(44, 60, 8, 90, IR[0]); q.line(6, 92, 46, 116, IR[0]); q.line(46, 92, 6, 116, IR[0]);
    for (let yy = 50; yy < 116; yy += 6) q.R(1, yy, 6, 1, WOOD[4]);                 // 梯子
    q.R(1, 48, 1, 70, WOOD[3]); q.R(6, 48, 1, 70, WOOD[3]);
    for (let i = 0; i < 38; i++) { const e = i === 0 || i === 37; q.R(7 + i, 8, 1, 33, e ? WOOD[1] : i < 6 ? WOOD[5] : i > 31 ? WOOD[2] : i % 6 === 0 ? WOOD[2] : WOOD[3]); }
    for (const hy of [12, 24, 36]) { q.R(7, hy, 38, 2, IR[1]); q.R(8, hy, 8, 1, IR[3]); }
    for (let i = 0; i < 44; i++) { const h = Math.round(8 - Math.abs(i - 21.5) * 0.36); q.R(4 + i, 9 - h, 1, h, i < 18 ? STONE[3] : STONE[1]); q.px(4 + i, 9 - h, STONE[0]); }
    q.R(44, 38, 6, 3, IR[1]); q.R(48, 38, 2, 14, P.leather[1]); q.R(47, 52, 4, 3, BR[2]);      // 出水管 + 皮管 + 黄铜阀
    return { c: q.c, ax: 26, ay: 118 };
  });
  const barricade = (st) => cached(`bar${st}`, () => {
    const q = pen(88, 80), G = 79;
    const log = (x0, y0, x1, y1) => { q.line(x0, y0, x1, y1, WOOD[1], 4); q.line(x0, y0 - 1, x1, y1 - 1, WOOD[4], 2); q.line(x1, y1, x1 + Math.sign(x1 - x0) * 4, y1 - 3, WOOD[5]); };
    const drum = (x0, y0, dent) => { q.box(x0, y0, 16, 20, [IR[0], RU[1], RU[2], RU[3]]); q.R(x0 + 1, y0 + 5, 14, 1, IR[1]); q.R(x0 + 1, y0 + 14, 14, 1, IR[1]); if (dent) { q.R(x0 + 9, y0 + 7, 4, 4, RU[1]); q.px(x0 + 9, y0 + 7, RU[0]); } };
    if (st < 2) {
      log(2, G, 30, G - 34); log(30, G, 4, G - 30);                                                 // 交叉的削尖木桩
      drum(30, G - 20, false); if (st === 0) drum(31, G - 40, true);
      if (st === 0) { for (let i = 0; i < 22; i++) q.R(48 + i, 12 + Math.round(i * 0.15), 1, G - 12 - Math.round(i * 0.15), i === 0 || i === 21 ? IR[0] : i % 4 < 2 ? IR[3] : IR[2]); for (let yy = 22; yy < G; yy += 14) q.px(50, yy, IR[4]); }   // 竖起来的瓦楞铁皮
      else { q.R(48, G - 6, 30, 6, IR[0]); for (let i = 0; i < 28; i++) q.px(49 + i, G - 5, i % 4 < 2 ? IR[3] : IR[2]); q.R(49, G - 4, 28, 3, IR[2]); }
      q.R(80, 8, 2, G - 8, WOOD[2]); q.px(80, 8, WOOD[5]);                                          // 旗杆 + 破布旗
      for (let i = 0; i < 12; i++) q.R(70 + i - 12 + 12, 9 + (i % 3 === 0 ? 1 : 0), 1, 8 - (i > 8 ? i - 8 : 0), i < 3 ? RU[3] : RU[2]);
    } else {
      q.line(4, G - 2, 34, G - 6, WOOD[1], 4); q.line(4, G - 3, 34, G - 7, WOOD[4], 2);
      q.line(20, G - 1, 44, G - 3, WOOD[2], 3);
      q.box(44, G - 14, 20, 14, [IR[0], RU[1], RU[2], RU[3]]); q.R(52, G - 13, 1, 12, IR[1]);       // 侧躺的油桶
      q.R(62, G - 4, 24, 4, IR[0]); q.R(63, G - 4, 22, 1, IR[3]);
    }
    return { c: q.c, ax: 44, ay: 80 };
  });
  function bricks(q, x0, y0, w, h, seed = 0) {
    q.R(x0, y0, w, h, BRICK[2]);
    for (let yy = 0; yy < h; yy++) {
      if (yy % 4 === 3) { q.R(x0, y0 + yy, w, 1, BRICK[1]); continue; }
      const off = (Math.floor(yy / 4) % 2) * 4;
      for (let xx = 0; xx < w; xx++) if ((xx + off) % 8 === 7) q.px(x0 + xx, y0 + yy, BRICK[1]);
      if (yy % 4 === 0) for (let xx = 0; xx < w; xx++) if ((xx + off) % 8 < 3 && hash(Math.floor((xx + off) / 8) + seed, Math.floor(yy / 4)) < 0.35) q.px(x0 + xx, y0 + yy, BRICK[3]);
    }
  }
  function ivy(q, x0, y0, w, h, seed) { for (let k = 0; k < w * h / 18; k++) { const xx = x0 + Math.round(hash(k, seed) * w), yy = y0 + Math.round(Math.pow(hash(k, seed + 1), 0.6) * h); q.R(xx, yy, 3, 2, IVY[1]); q.px(xx, yy, IVY[3]); q.px(xx + 1, yy + 1, IVY[0]); } }
  const ruinGate = (st) => cached(`gate${st}`, () => {
    const q = pen(128, 160), G = 159;
    // 两根砖门柱 + 石帽；右柱顶上塌了一块；左柱爬满常春藤
    bricks(q, 0, 30, 24, G - 30, 1); q.R(0, 30, 1, G - 30, BRICK[0]); q.R(23, 30, 1, G - 30, BRICK[0]);
    q.box(-2, 22, 28, 9, [STONE[0], STONE[1], STONE[3], STONE[4]]); q.box(2, 16, 20, 7, [STONE[0], STONE[1], STONE[2], STONE[4]]);
    bricks(q, 104, 46, 24, G - 46, 2); q.R(104, 46, 1, G - 46, BRICK[0]); q.R(127, 46, 1, G - 46, BRICK[0]);
    for (let i = 0; i < 24; i++) { const j = Math.round(hash(i, 9) * 6 + (i > 12 ? 4 : 0)); q.g.clearRect(104 + i, 46, 1, j); q.px(104 + i, 46 + j, BRICK[0]); }
    ivy(q, 0, 30, 18, 90, 4); ivy(q, 104, 120, 12, 36, 6);
    // 铸铁大门：上半竖栅（矛尖）、下半铆接铁板；中间铁链 + 黄铜挂锁
    const leaf = (x0, w, skew) => {
      for (let xx = x0 + 2; xx < x0 + w - 1; xx += 5) { q.R(xx, 48 + skew, 2, 50, IR[1]); q.px(xx, 48 + skew, IR[3]); q.R(xx, 44 + skew, 2, 4, IR[2]); q.px(xx, 43 + skew, IR[4]); }
      q.R(x0, 58 + skew, w, 3, IR[0]); q.R(x0, 58 + skew, w, 1, IR[3]);
      q.box(x0, 98 + skew, w, G - 98 - skew, IRONB);
      for (let yy = 102; yy < G - 2; yy += 9) for (let xx = x0 + 3; xx < x0 + w - 2; xx += 6) q.px(xx, yy + skew, IR[4]);
      q.R(x0, 98 + skew, 1, G - 98 - skew, IR[0]); q.R(x0 + w - 1, 46 + skew, 1, G - 46 - skew, IR[0]); q.R(x0, 46 + skew, 1, 52, IR[0]);
    };
    if (st < 2) {
      leaf(24, 40, st === 1 ? 3 : 0); leaf(64, 40, 0);
      if (st === 1) { for (let i = 0; i < 8; i++) q.px(34 + i, 110 + (i % 3), IR[0]); q.R(30, 120, 8, 6, IR[1]); q.px(30, 120, IR[0]); }   // 凹痕
      if (st === 0) { q.line(46, 100, 82, 104, IR[3], 2); q.box(60, 102, 7, 8, BRASSB); q.R(62, 99, 3, 3, BR[1]); q.g.clearRect(63, 100, 1, 2); }
      else { q.line(60, 102, 62, 128, IR[3], 2); q.line(70, 104, 68, 122, IR[3], 2); }        // 铁链断了垂下来
    } else {
      q.R(24, G - 6, 44, 6, IR[0]); q.R(25, G - 6, 42, 1, IR[3]); q.R(25, G - 5, 42, 4, IR[2]);   // 倒在地上的门扇
      q.R(70, G - 4, 34, 4, IR[0]); q.R(71, G - 4, 32, 1, IR[3]);
    }
    return { c: q.c, ax: 64, ay: 160 };
  });
  const relicChest = () => cached('relic', () => {
    const q = pen(30, 24);
    q.box(2, 9, 26, 15, WOODB); for (let i = 0; i < 26; i++) { const h = Math.round(4 * Math.sqrt(1 - ((i - 12.5) / 13) ** 2)); q.R(2 + i, 9 - h, 1, h + 1, WOOD[3]); q.px(2 + i, 9 - h, WOOD[1]); if (i < 8) q.px(2 + i, 10 - h, WOOD[5]); }
    for (const bx of [5, 23]) { q.R(bx, 5, 3, 19, BR[1]); q.R(bx, 5, 1, 19, BR[3]); }
    q.R(2, 9, 26, 2, BR[1]); q.R(2, 9, 26, 1, BR[3]);
    q.disc(15, 16, 4, (a, b) => (Math.hypot(a, b) < 0.45 ? GLOW[3] : BR[2])); q.px(15, 16, GLOW[2]);   // 齿轮纹章 + 以太光
    return { c: q.c, ax: 15, ay: 24 };
  });
  const startSign = () => cached('sign', () => {
    const q = pen(56, 84);
    q.R(26, 10, 4, 74, WOOD[2]); q.R(26, 10, 1, 74, WOOD[4]);
    const board = (y, dir) => { const x0 = dir > 0 ? 28 : 2; q.box(x0, y, 26, 10, WOODB); const tip = dir > 0 ? x0 + 26 : x0 - 1; for (let k = 0; k < 5; k++) q.R(tip + (dir > 0 ? k : -k), y + k, 1, 10 - k * 2, WOOD[dir > 0 ? 3 : 4]); };
    board(16, 1); board(32, -1);
    q.R(33, 20, 14, 1, '#d8d2c0'); q.R(44, 19, 1, 3, '#d8d2c0'); q.px(45, 20, '#d8d2c0');            // 粉笔画的箭头（往煤场）
    q.R(8, 35, 8, 2, '#d8d2c0'); q.R(10, 37, 4, 3, '#d8d2c0');                                        // 粉笔画的铁砧（回家）
    q.R(31, 4, 1, 6, IR[1]); q.box(29, 0, 6, 6, BRASSB); q.R(30, 2, 4, 3, P.fire[2]);
    return { c: q.c, ax: 28, ay: 84 };
  });
  // 地标（画在路后面）：废弃的维多利亚水泵站、旧煤场的井架和绞车房、运煤小火车
  const pumpHouse = () => cached('pump', () => {
    const q = pen(320, 270), G = 269;
    bricks(q, 262, 6, 30, G - 6, 5); q.R(262, 6, 1, G - 6, BRICK[0]); q.R(291, 6, 1, G - 6, BRICK[0]);
    for (let i = 0; i < 30; i++) { const j = Math.round(hash(i, 3) * 10); q.g.clearRect(262 + i, 6, 1, j); q.px(262 + i, 6 + j, BRICK[0]); }
    q.R(258, 40, 38, 5, STONE[2]); q.R(258, 40, 38, 1, STONE[4]);
    bricks(q, 20, 80, 236, G - 80, 7); q.R(20, 80, 1, G - 80, BRICK[0]); q.R(255, 80, 1, G - 80, BRICK[0]);
    for (let i = 0; i < 118; i++) { const yy = 80 - Math.round(i * 0.5); q.R(20 + i, yy, 1, 80 - yy, STONE[1]); q.px(20 + i, yy, STONE[0]); if (i % 7 === 0) q.R(20 + i, yy + 1, 1, 80 - yy - 1, STONE[0]); }   // 左半边石板屋顶还在
    for (let k = 0; k < 5; k++) q.line(140 + k * 22, 21 + k * 11, 150 + k * 22, 80, WOOD[1], 2);                                                            // 右半边只剩椽子
    q.line(138, 21, 256, 80, WOOD[2], 3);
    q.R(18, 112, 240, 6, STONE[2]); q.R(18, 112, 240, 1, STONE[4]); q.R(18, G - 22, 240, 22, STONE[1]); q.R(18, G - 22, 240, 1, STONE[3]);
    for (const wx of [42, 104, 166, 218]) {
      const w = wx === 218 ? 22 : 30, top = 130;
      for (let yy = top; yy < 210; yy++) { const dy = yy - top, hw = dy < w / 2 ? Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - dy) ** 2)) : w / 2; q.R(wx + w / 2 - hw, yy, hw * 2, 1, '#120c0a'); }
      q.R(wx - 2, 210, w + 4, 4, STONE[2]); q.R(wx + w / 2, top + 4, 1, 76, IR[1]); q.R(wx, 170, w, 1, IR[1]);
      if (hash(wx, 1) < 0.6) { q.px(wx + 6, 150, P.glass[1]); q.px(wx + 7, 151, P.glass[2]); }
    }
    ivy(q, 20, 90, 60, 150, 8); ivy(q, 230, 200, 40, 60, 9);
    for (let k = 0; k < 18; k++) { const xx = 230 + Math.round(hash(k, 5) * 60), yy = G - Math.round(hash(k, 6) * 12); q.R(xx, yy, 5, 4, BRICK[2]); q.px(xx, yy, BRICK[3]); }
    return { c: q.c, ax: 150, ay: 270 };
  });
  const depot = () => cached('depot', () => {
    const q = pen(360, 300), G = 299;
    // 井架：两条桁架腿 + 后撑，顶上大绞轮
    const girder = (x0, y0, x1, y1) => { q.line(x0 - 3, y0, x1 - 3, y1, IR[1], 2); q.line(x0 + 3, y0, x1 + 3, y1, IR[1], 2); const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 14); for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n; q.line(x0 - 3 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + 3 + (x1 - x0) * b, y0 + (y1 - y0) * b, IR[0]); } };
    girder(70, G, 118, 64); girder(170, G, 128, 64); girder(250, G, 132, 70);
    q.R(104, 60, 40, 6, IR[0]); q.R(105, 60, 38, 1, IR[3]);
    q.disc(124, 38, 24, (a, b) => { const r = Math.hypot(a, b), ang = Math.atan2(b, a), spoke = Math.abs(Math.sin(ang * 3)) * r * 24 < 1.3; return r > 0.9 ? IR[0] : r > 0.78 ? (a + b < -0.2 ? IR[3] : IR[2]) : r < 0.16 ? IR[3] : r < 0.24 ? IR[0] : spoke ? IR[1] : null; });
    q.R(122, 36, 4, 4, IR[0]); q.px(123, 37, IR[4]);
    q.R(145, 40, 1, 220, IR[0]);
    // 绞车房 + 烟囱
    bricks(q, 220, 190, 120, G - 190, 3); q.R(220, 190, 1, G - 190, BRICK[0]); q.R(339, 190, 1, G - 190, BRICK[0]);
    for (let i = 0; i < 124; i++) { const yy = 190 - Math.round(16 - Math.abs(i - 62) * 0.26); q.R(218 + i, yy, 1, 190 - yy, STONE[1]); q.px(218 + i, yy, STONE[0]); }
    bricks(q, 312, 110, 14, 70, 4); q.R(310, 108, 18, 4, STONE[2]);
    for (const wx of [236, 278]) { q.R(wx, 222, 22, 40, '#120c0a'); q.R(wx + 2, 224, 18, 16, '#8a6a3a'); q.R(wx + 10, 224, 1, 16, IR[1]); q.R(wx - 2, 262, 26, 3, STONE[2]); }
    for (let k = 0; k < 40; k++) { const xx = 6 + Math.round(hash(k, 7) * 60), yy = G - Math.round(Math.pow(hash(k, 8), 1.4) * 22); q.R(xx, yy, 3, 2, COAL[2]); q.px(xx, yy, COAL[3]); }
    return { c: q.c, ax: 180, ay: 300 };
  });
  const train = () => cached('train', () => {
    const q = pen(250, 70), G = 69;
    q.R(0, G - 3, 250, 3, IR[0]); for (let xx = 2; xx < 250; xx += 9) q.R(xx, G - 2, 5, 2, WOOD[2]);   // 铁轨 + 枕木
    q.box(2, G - 20, 124, 8, WOODB); for (const wx of [18, 46, 82, 110]) q.disc(wx, G - 8, 6, (a, b) => (Math.hypot(a, b) < 0.4 ? IR[3] : IR[1]));   // 平板车
    q.R(0, G - 18, 3, 4, IR[0]);
    q.box(132, G - 44, 66, 32, [IR[0], P.dark[2], P.dark[3], IR[2]]); q.box(176, G - 62, 24, 50, [IR[0], P.dark[2], P.dark[3], IR[2]]);   // 小水柜机车：锅炉 + 驾驶室
    q.R(180, G - 56, 8, 8, '#8a6a3a'); q.R(140, G - 56, 7, 12, IR[1]); q.R(138, G - 58, 11, 3, IR[0]);
    q.R(132, G - 30, 66, 2, BR[1]); for (const wx of [146, 166, 188]) q.disc(wx, G - 9, 8, (a, b) => (Math.hypot(a, b) < 0.35 ? BR[2] : Math.hypot(a, b) > 0.8 ? IR[0] : P.dark[3]));
    q.R(200, G - 22, 6, 4, IR[0]);
    return { c: q.c, ax: 0, ay: 70 };
  });

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
  const tiles = [];
  {
    const full = SA.TerrainArt.layer(ground, R1.mud, LEN, VH, GROUND);
    for (let x = 0; x < LEN; x += 1280) { const c = document.createElement('canvas'); c.width = 1280; c.height = VH; c.getContext('2d').drawImage(full, -x, 0); tiles.push(c); }
  }

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
    for (let i = 0; i < tiles.length; i++) if (vis(i * 1280 + 640, 700)) vg.drawImage(tiles[i], i * 1280, 0);
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
  function refugeeGroup(p, t) {
    const y = gAt(p.x), near = Math.abs(front() - p.x) < 260, sad = p.full;
    vg.fillStyle = WOOD[2]; vg.fillRect(Math.round(p.x + 34), Math.round(y - 52), 3, 52);                                    // 路牌杆 + 白布
    const wave = Math.floor(t * 4) % 2;
    vg.fillStyle = '#d8d2c0'; vg.fillRect(Math.round(p.x + 37), Math.round(y - 52 + wave), 12, 7); vg.fillRect(Math.round(p.x + 45), Math.round(y - 45 + wave), 4, 3);
    [[-24, 0], [-4, 1], [14, 2]].forEach(([dx, k]) => {
      const pose = sad ? 'idle' : near ? (Math.floor(t * 3 + k) % 2 ? 'wave' : 'cheer') : 'hold';
      const key = `${p.seed + k}|${pose}|${sad}`;
      const c = cached(`ref${key}`, () => ({ c: SA.Coal.draw(SA.Coal.crew(`难民${p.seed + k}`), { size: 'sprite', pose, expr: sad ? 'sad' : near ? 'happy' : 'normal', look: -1 }) })).c;
      vg.drawImage(c, Math.round(p.x + dx - 20), Math.round(y - 33));
      vg.fillStyle = SACK[1]; vg.fillRect(Math.round(p.x + dx + 6), Math.round(y - 6), 7, 6); vg.fillStyle = SACK[3]; vg.fillRect(Math.round(p.x + dx + 6), Math.round(y - 6), 7, 1);
    });
  }
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
