// 程序化像素精灵（48px 格）。不再用角标图标：每个模块靠自身造型一眼可辨。
// 驾驶舱 = 黄铜拱门剖面 + Q 版护目镜驾驶员；水箱 = 带水位的方块；锅炉 = 铁栅栏后闷燃的煤；
// 直射炮 = 水平长管；高抛炮 = 朝天粗管；撞击武器 = 锈钢铲斗/撞角/撞锤；履带 = 一战铆接履带框架。
window.SA = window.SA || {};

SA.SPR = (() => {
  // C：模块精灵的原生尺寸（48px = 2×2 子格）；S：网格子格（24px）。精灵按 C 画，摆放位置按 S 算
  const P = SA.PAL, K = SA.K, C = K.ART, S = K.CELL;
  const PADX = 28;               // 左右留白：炮管最多伸出半格（24px）
  let ctx = null;

  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  // ramp = [描边, 暗面, 固有色, 亮面]，光源统一左上
  const box = (x, y, w, h, ramp) => {
    R(x, y, w, h, ramp[0]);
    R(x + 1, y + 1, w - 2, h - 2, ramp[2]);
    R(x + 1, y + h - 2, w - 2, 1, ramp[1]);
    R(x + w - 2, y + 1, 1, h - 2, ramp[1]);
    R(x + 1, y + 1, w - 2, 1, ramp[3]);
    R(x + 1, y + 1, 1, h - 2, ramp[3]);
  };
  const disc = (cx, cy, r, c) => {
    ctx.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++)
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(xx, yy, 1, 1);
      }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    ctx.fillStyle = c;
    const o = Math.floor(w / 2);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  const rivet = (x, y, lite = P.iron[4], dk = P.iron[0]) => { R(x, y, 2, 2, lite); R(x + 1, y + 1, 1, 1, P.iron[2]); R(x + 2, y + 1, 1, 1, dk); R(x + 1, y + 2, 1, 1, dk); };
  // 拱形：上半圆 + 下方矩形
  const arch = (cx, top, bottom, rad, col) => {
    const cy = top + rad;
    ctx.fillStyle = col;
    for (let yy = top; yy < bottom; yy++) {
      const dy = yy + 0.5 - cy;
      const hw = dy < 0 ? Math.sqrt(Math.max(0, rad * rad - dy * dy)) : rad;
      ctx.fillRect(Math.round(cx - hw), yy, Math.round(hw * 2), 1);
    }
  };

  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]];
  const IRONL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]];
  const DARK = [P.dark[0], P.dark[1], P.dark[2], P.dark[3]];
  const BRASS = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]];
  const RUST = [P.rust[0], P.rust[1], P.rust[2], P.rust[3]];

  // 竖着的水罐（24 宽 × hh 高）：胶囊形罐身 + 黄铜箍 + 注水口 + 水位窗
  function tankArt(x, y, hh, o) {
    const top = y + 10, bot = y + hh - 10, rad = hh > 24 ? 9 : 8;
    R(x + 10, y + 1, 4, 3, P.brass[1]); R(x + 10, y + 1, 4, 1, P.brass[3]);
    disc(x + 12, top, rad, P.iron[0]); disc(x + 12, bot, rad, P.iron[0]); R(x + 12 - rad, top, rad * 2 + 1, bot - top, P.iron[0]);
    disc(x + 12, top, rad - 1, P.iron[3]); disc(x + 12, bot, rad - 1, P.iron[3]); R(x + 13 - rad, top, rad * 2 - 1, bot - top, P.iron[3]);
    R(x + 13 - rad, top - 2, 1, bot - top + 4, P.iron[4]); R(x + 10 + rad, top - 2, 1, bot - top + 4, P.iron[2]);
    const wy = top - 3, wh = bot - top + 6;
    R(x + 9, wy, 6, wh, P.iron[0]); R(x + 10, wy + 1, 4, wh - 2, P.glass[0]);
    const lh = Math.round((wh - 2) * (o.lv == null ? 29 : o.lv) / 29), wb = wy + wh - 1;
    if (lh > 0) { R(x + 10, wb - lh, 4, lh, P.water[2]); R(x + 10, wb - lh, 4, 1, P.water[3]); }
    if (lh > 3) R(x + 11 + ((o.fr || 0) % 2), wb - 1 - (((o.fr || 0) * 3) % (lh - 1)), 1, 1, P.water[3]);
    for (const by of hh > 24 ? [y + 7, y + hh - 8] : [y + hh - 4]) { R(x + 3, by, 18, 2, P.brass[1]); R(x + 3, by, 18, 1, P.brass[2]); }
  }

  // 炮塔外壳（直射炮 / 机枪共用）
  function housing(x, y, cupola) {
    if (cupola) { box(x + 10, y + 7, 22, 10, IRON); R(x + 14, y + 10, 12, 1, P.iron[0]); }
    box(x + 3, y + 14, 42, 31, IRON);
    for (let i = 0; i < 3; i++) R(x + 7, y + 22 + i * 4, 12, 1, P.iron[0]);
    R(x + 4, y + 39, 40, 1, P.brass[2]);
    R(x + 4, y + 40, 40, 1, P.brass[1]);
    rivet(x + 6, y + 17); rivet(x + 6, y + 34);
  }

  // 可转动的炮组：先在离屏按「水平」画好，再以耳轴为支点转到仰角 a（度，向上为正）贴回来；最近邻缩放保持像素风
  const gunLayer = document.createElement('canvas');
  gunLayer.width = 112; gunLayer.height = 64;
  function turn(px, py, a, draw) {
    const main = ctx, lg = gunLayer.getContext('2d');
    lg.clearRect(0, 0, 112, 64);
    ctx = lg;
    draw(40 - px, 32 - py);          // 画的时候支点落在离屏 (40, 32)
    ctx = main;
    main.save();
    main.imageSmoothingEnabled = false;
    main.translate(px, py); main.rotate(-(a || 0) * Math.PI / 180);
    main.drawImage(gunLayer, -40, -32);
    main.restore();
  }

  // 后坐量化档 k（0~8）→ 该武器的制退位移（px）
  const rcPx = (id, k) => Math.round((k || 0) / 8 * (SA.MODULES[id].rcPx || 0));

  // ---------- 改装挂件（V3）：炮盾 / 加固裙板 / 加厚撞面 / 附加装甲，每级多挂一层，画成冷铁（材料装饰层照常换色）----------
  const bolted = (x, y, w, h) => { box(x, y, w, h, IRONL); if (w >= 5 && h >= 5) { R(x + 1, y + 1, 1, 1, P.iron[4]); R(x + w - 2, y + h - 2, 1, 1, P.iron[1]); } };
  // 炮盾：立在耳轴前面的防盾，炮管画在它上面（所以不用开炮口缝）。cx = 防盾左边，cy = 耳轴高度，hh = 一级的半高；
  // 一级一块板，二级加高并在顶上折边，三级再叠一层加强板
  function gunShield(cx, cy, lv, hh) {
    if (!lv) return;
    const h1 = hh + (lv - 1) * 3;
    box(cx, cy - h1, 5, h1 * 2, IRON); R(cx + 1, cy - h1 + 1, 1, h1 * 2 - 2, P.iron[4]);
    for (let k = cy - h1 + 3; k < cy + h1 - 3; k += 6) { R(cx + 2, k, 2, 2, P.iron[1]); R(cx + 2, k, 1, 1, P.iron[4]); }
    if (lv >= 2) { R(cx - 3, cy - h1, 8, 2, P.iron[0]); R(cx - 3, cy - h1, 8, 1, P.iron[3]); }
    if (lv >= 3) box(cx + 4, cy - h1 + 4, 3, h1 * 2 - 8, IRONL);
  }
  // 非武器的挂件：精灵画完以后贴上去（武器的炮盾在 DRAW 里画，要压在炮管下面）
  function attach(id, q, f, x, y) {
    const lv = q.up, m = SA.MODULES[id];
    if (!lv || SA.isWeapon(id)) return;
    if (m.layer === 'chassis') {
      if (id === 'track') {   // 裙板盖住上段履带和侧框上沿，三级分段
        const x0 = x + (q.connL ? 0 : 6), x1 = x + (q.connR ? C : 44), hh = [0, 7, 11, 16][lv];
        box(x0, y + 6, x1 - x0, hh, IRONL);
        R(x0 + 1, y + 4 + hh, x1 - x0 - 2, 1, P.iron[1]);
        for (let k = x0 + 4; k < x1 - 2; k += 8) rivet(k, y + 8);
        if (lv >= 3) for (let k = x0 + 12; k < x1 - 2; k += 12) R(k, y + 7, 1, hh - 2, P.iron[0]);
      } else { box(x + 4, y + 1, 40, 3 + lv * 2, IRONL); for (let k = 8; k < 42; k += 10) rivet(x + k, y + 2); }
      return;
    }
    if (m.layer === 'ram') {
      if (id === 'bucket') {   // 斗板前沿再贴一条耐磨板，一级比一级厚
        for (let yy = 6; yy <= 44; yy++) {
          const x0 = x + 39 - Math.round(6 * Math.sin(Math.PI * (yy - 4) / 42));
          R(x0, y + yy, lv + 1, 1, P.iron[0]); R(x0, y + yy, lv, 1, yy % 8 === 0 ? P.iron[4] : P.iron[3]);
        }
      } else if (id === 'spike') {   // 锥身套上加强箍
        for (let i = 0; i < lv; i++) { const ii = 5 + i * 7, hh = Math.round(13 * (1 - ii / 33)) + 1; box(x + 15 + ii, y + 24 - hh, 3, hh * 2 + 1, IRONL); }
      } else if (id === 'piston') {   // 锤面加厚
        const e = 4 + (q.p || 0) * 5, st = q.st || 1;
        box(x + 24 + e + (st === 2 ? 12 : 11), y + (st === 2 ? 5 : 8), 1 + lv * 2, st === 2 ? 38 : 32, IRONL);
      }
      return;
    }
    // 附加装甲：左右两侧先挂竖板，三级再加一条底板
    const W = f.w * S, H = f.h * S, t = W > S ? 5 : 3, y0 = y + Math.round(H * 0.2), hh = Math.round(H * 0.65);
    bolted(x + 1, y0, t, hh);
    if (lv >= 2) bolted(x + W - 1 - t, y0, t, hh);
    if (lv >= 3) bolted(x + 2, y + H - t - 1, W - 4, t);
  }

  // 履带节：xa..xb 范围内按 8px 节距排布，off 为滚动偏移
  function links(xa, xb, yy, h, off, grouser) {
    R(xa, yy, xb - xa, h, P.dark[0]);
    for (let lx = xa - 8 + (((off % 8) + 8) % 8); lx < xb; lx += 8) {
      const a = Math.max(lx, xa), b = Math.min(lx + 7, xb);
      if (b <= a) continue;
      R(a, yy + 1, b - a, h - 2, P.dark[2]);
      R(a, yy + 1, b - a, 1, P.dark[3]);
      if (grouser && lx + 2 >= xa && lx + 5 <= xb) R(lx + 2, yy + h, 3, 2, P.dark[3]);
    }
  }
  // 下段履带：逐列画，高度跟着 hAt(本格内 x) 走，折线穿过各组负重轮底部；链节图案按画布绝对 x 排（格宽 48 是节距 8 的整数倍，跨格不错位）
  function belt(x, xa, xb, yy, hAt, ph) {
    for (let cx = xa; cx < xb; cx++) {
      const t = yy + Math.round(hAt(cx - x)), p = (((cx + ph) % 8) + 8) % 8;
      R(cx, t, 1, 6, P.dark[0]);
      if (p !== 7) { R(cx, t + 1, 1, 4, P.dark[2]); R(cx, t + 1, 1, 1, P.dark[3]); }
      if (p >= 2 && p <= 4) R(cx, t + 6, 1, 2, P.dark[3]);
    }
  }
  // 折线插值：pts = [[x, h], …]（x 递增），两端之外取端点
  function polyAt(pts) {
    return (lx) => {
      if (lx <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (lx <= pts[i][0]) { const [x0, h0] = pts[i - 1], [x1, h1] = pts[i]; return h0 + (h1 - h0) * (lx - x0) / Math.max(1, x1 - x0); }
      return pts[pts.length - 1][1];
    };
  }
  function spokedWheel(cx, cy, r, ph, spokes, hub = P.iron[3]) {
    disc(cx, cy, r + 1.5, P.dark[0]);
    disc(cx, cy, r + 0.5, P.dark[1]);
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2 + ph;
      R(Math.round(cx - 1 + Math.cos(ang) * (r + 0.5)), Math.round(cy - 1 + Math.sin(ang) * (r + 0.5)), 2, 2, P.dark[3]);
    }
    disc(cx, cy, r - 2, P.dark[3]);
    disc(cx, cy, r - 3.2, P.dark[2]);
    for (let a = 0; a < spokes; a++) {
      const ang = a / spokes * Math.PI * 2 + ph;
      line(Math.round(cx), Math.round(cy), Math.round(cx + Math.cos(ang) * (r - 3)), Math.round(cy + Math.sin(ang) * (r - 3)), 1, P.iron[2]);
    }
    disc(cx, cy, 2.4, hub);
    R(Math.round(cx) - 1, Math.round(cy) - 1, 1, 1, P.iron[4]);
  }
  // 履带绕过尾部链轮的半圈（左半椭圆环），链节按弧长 8px 节距排布、随 ph 滚动，外侧带履齿
  function wrapBand(cx, cy, rx, ry, ph) {
    const th = 6, rm = (rx + ry) / 2 - th / 2;
    for (let yy = Math.floor(cy - ry - 2); yy <= Math.ceil(cy + ry + 2); yy++)
      for (let xx = Math.floor(cx - rx - 2); xx < cx; xx++) {
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
        const eo = (dx / rx) ** 2 + (dy / ry) ** 2;
        const ei = (dx / (rx - th)) ** 2 + (dy / (ry - th)) ** 2;
        const eg = (dx / (rx + 2)) ** 2 + (dy / (ry + 2)) ** 2;
        let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2;
        const m = ((Math.floor((a - Math.PI / 2) * rm + ph) % 8) + 8) % 8;
        if (eo <= 1 && ei > 1) {
          const e1 = (dx / (rx - 1)) ** 2 + (dy / (ry - 1)) ** 2, e2 = (dx / (rx - th + 1)) ** 2 + (dy / (ry - th + 1)) ** 2;
          const edge = e1 > 1 || e2 <= 1 || m === 7;
          R(xx, yy, 1, 1, edge ? P.dark[0] : m === 0 ? P.dark[3] : P.dark[2]);
        } else if (eo > 1 && eg <= 1 && m >= 2 && m <= 4) R(xx, yy, 1, 1, P.dark[3]);
      }
  }
  // 腿式底盘：腿用 js/legs.js 的光栅器画（形状先写进遮罩，再按描边 / 暗面 / 固有色 / 亮面四阶上色，光源左上）。
  // 外观阶段 1~3 → 腿型：双足取 legs.js 的 DESIGNS（真双足 bipedArt），四足取 QUADS（T3 / T5 用哪一档待定，先都用 T1）
  const BIPED_LOOK = ['mk2', 'mk2', 'mk2'];
  const QUAD_LOOK = ['crawl', 'crawl', 'crawl'];   // legs.js 的 QUADS：伏地蛛；高脚蛛给 T3 / T5 还是留给别的用途，待定
  const pens = new Map();
  function penFor(cv) {
    const k = `${cv.width}x${cv.height}`;
    let p = pens.get(k);
    if (!p) { p = SA.LEGLAB.Pen(cv.width, cv.height); pens.set(k, p); }
    return p.at(1, 0, 0);
  }
  // 腿式底盘（有腿、要画远侧腿的底盘）；amp 是旧逐格画法留下的起伏幅度，整件四足 / 真双足改用 quadBob / bipedBob
  const BOB = { biped: 3, quad: 1 };
  const gfOf = (a) => ((Math.round(a / (Math.PI * 2 / 12)) % 12) + 12) % 12;   // 腿的步态帧：战斗给的是步态角（每走 4 × 步幅一圈），12 帧一循环
  // 底盘顶部的车体底板：与上方模块的框架同色相接；没有模块压着时才描顶边
  function floor(x, y, o, h = 5) {
    R(x, y, C, h, P.iron[1]);
    if (!o.top) { R(x, y, C, 1, P.iron[0]); R(x, y + 1, C, 1, P.iron[3]); }
    for (let rx = 4; rx < C; rx += 8) R(x + rx, y + h - 2, 1, 1, P.iron[3]);
    R(x, y + h - 1, C, 1, P.iron[0]);
  }

  // Q 版小黑炭球：毛茸茸的圆身子 + 萌萌的大眼睛 + 两只小短手。不是纯黑：身子带色、上沿有亮边、毛尖更深
  // pal = [毛尖, 身子, 亮边]；look = 眼珠朝向（-1 左 / 1 右）；blink = 眨眼；hands = [[肩x, 肩y, 手x, 手y], …]
  function soot(cx, cy, rad, pal, o = {}) {
    const [tip, body, rim] = pal;
    for (let i = 0; i < 16; i++) {   // 毛刺
      const a = i / 16 * Math.PI * 2 + (i % 2) * 0.2, rr = rad + 1.5 + (i % 3 === 0 ? 1.5 : 0);
      R(Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 2, 2, tip);
    }
    disc(cx, cy, rad + 0.6, tip);
    disc(cx, cy, rad - 0.4, body);
    for (let i = 0; i <= 6; i++) {   // 左上亮边
      const a = Math.PI * (1.05 + i * 0.07);
      R(Math.round(cx + Math.cos(a) * (rad - 1.5)), Math.round(cy + Math.sin(a) * (rad - 1.5)), 1, 1, rim);
    }
    for (const [sx, sy, hx, hy] of o.hands || []) {   // 小短手：两像素粗，末端一颗圆拳
      line(sx, sy, hx, hy, 3, tip); line(sx, sy, hx, hy, 1, body);
      disc(hx, hy, 1.6, tip); R(Math.round(hx) - 1, Math.round(hy) - 1, 1, 1, rim);
    }
    const look = o.look || 0, ey = cy - 1, er = rad * 0.42, gap = rad * 0.45;
    for (const ex of [cx - gap, cx + gap]) {   // 大眼睛：白底 + 黑瞳 + 高光
      if (o.blink) { R(Math.round(ex - er), Math.round(ey), Math.round(er * 2) + 1, 1, P.steam[2]); continue; }
      disc(ex, ey, er + 0.8, P.black); disc(ex, ey, er, P.white);
      R(Math.round(ex + look) - 1, Math.round(ey) - 1, 3, 4, P.black);
      R(Math.round(ex + look) - 1, Math.round(ey) - 1, 1, 1, P.white);
    }
  }
  const SOOT_PILOT = ['#141824', '#2f3850', '#6a7a9c'];     // 驾驶员：蓝灰炭球
  // 舷窗里的 1×1 大小驾驶员（驾驶舱和联合驾驶舱共用，联合驾驶舱里的驾驶员不放大）。
  // f = 动画帧（1、2 帧往下沉一格，3 帧眨眼）；st ≥ 2 = 史诗起的换装：皮飞行帽 + 黄铜护目镜
  function pilot(cx, cy, f, blink, st) {
    const bob = f === 1 || f === 2 ? 1 : 0, yy = cy + bob;
    disc(cx, yy, 3.3, SOOT_PILOT[0]); disc(cx, yy, 2.6, SOOT_PILOT[1]);
    R(cx - 2, yy - 2, 1, 1, SOOT_PILOT[2]);
    if (st >= 2) {
      R(cx - 2, yy - 4, 5, 2, P.leather[1]); R(cx - 1, yy - 4, 3, 1, P.leather[2]);
      R(cx - 4, yy - 1, 9, 1, P.brass[1]);
      for (const ex of [cx - 2, cx + 1]) { R(ex, yy - 1, 2, 2, P.brass[2]); R(ex, yy - 1, 1, 1, P.glass[3]); R(ex + 1, yy, 1, 1, P.glass[1]); }
      return;
    }
    for (const ex of [cx - 2, cx + 1]) {
      if (f === 3 && blink) { R(ex, yy, 2, 1, P.steam[2]); continue; }
      R(ex, yy - 1, 2, 2, P.white); R(ex + 1, yy, 1, 1, P.black);
    }
  }
  // 黄铜舷窗，里面坐一个驾驶员；seed 让几个驾驶员的动画错开
  function porthole(cx, cy, o, seed) {
    disc(cx, cy, 6.2, P.black); disc(cx, cy, 5.4, P.brass[1]);
    for (const [px, py] of [[-4, -4], [-2, -5], [-5, -2]]) R(cx + px, cy + py, 1, 1, P.brass[3]);
    disc(cx, cy, 4.3, P.glass[0]);
    const f = ((o.lv || 0) + seed) % 4;
    pilot(cx, cy + 1, f, ((o.seed || 0) + seed) % 2 === 0, o.st || 1);
    R(cx - 3, cy - 3, 1, 1, P.glass[3]);
  }
  const SOOT_CO = ['#1c1318', '#4a3040', '#8a6078'];        // 副驾驶：暖棕紫炭球

  // ---------- 公共装饰零件（2026-09-27 定稿，规则见 docs/visual-rules.md，样机 tools/cannon-lab.html）----------
  // 两类：铁件（包角铁、散热口）在 DRAW 里画，跟着材料换色；身份件（铆钉、珐琅铭牌、压力表）在 OVER 里、材质处理之后画，颜色按档位固定。
  // 位置一律按模块立面的分区放（接缝铆钉 → 散热区 → 铭牌区；包角位；表位），互相至少空 1 像素，不压散热口和观察缝。
  const RIVET_TIER = { brass: [P.brass[3], P.brass[2], P.brass[0]], steel: ['#e2eef0', '#9fb4b8', '#2c3637'] };   // T1～3 黄铜，镀镍起钢质淡青
  const PART = {
    // 散热口：暗线 + 下面一道亮线；rows 单列横槽 / grid 双列 / louver 斜百叶
    vents(x, y, z, style, n) {
      const slot = (sx, sy, w) => { R(x + sx, y + sy, w, 1, P.iron[0]); R(x + sx, y + sy + 1, w, 1, P.iron[3]); };
      if (style === 'rows') { const gap = n <= 2 ? 4 : 3; for (let i = 0; i < n; i++) slot(z.x, z.y + 1 + i * gap, 12); }
      else if (style === 'grid') { for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) slot(z.x + c * 8, z.y + i * 3, 6); }
      else if (style === 'louver') { for (let i = 0; i < n; i++) for (let k = 0; k < 7; k++) { R(x + z.x + i * 4 + (k >> 1), y + z.y + k, 1, 1, P.iron[0]); R(x + z.x + i * 4 + (k >> 1) + 1, y + z.y + k, 1, 1, P.iron[3]); } }
    },
    // 包角铁：L 形角铁 5×5 + 一颗铆钉；fx / fy 是朝向
    corner(x, y, fx = 1, fy = 1) {
      const X = (dx) => (fx > 0 ? x + dx : x + 4 - dx), Y = (dy) => (fy > 0 ? y + dy : y + 4 - dy);
      for (let i = 0; i < 5; i++) { R(X(i), Y(0), 1, 1, P.dark[0]); R(X(0), Y(i), 1, 1, P.dark[0]); R(X(i), Y(1), 1, 1, P.dark[3]); R(X(1), Y(i), 1, 1, P.dark[3]); }
      R(X(1), Y(1), 1, 1, P.iron[4]); R(X(2), Y(2), 1, 1, P.dark[0]);
    },
    // 铆钉（身份件）：2×2 钉头 + 右下暗影，颜色 c = [亮, 中, 影]
    rivet(x, y, c) { R(x, y, 2, 2, c[0]); R(x + 1, y + 1, 1, 1, c[1]); R(x + 2, y + 1, 1, 1, c[2]); R(x + 1, y + 2, 1, 1, c[2]); },
    // 接缝铆钉：在 x0～x1 之间等距打 n 颗
    seam(x, y, z, n, c) { const step = n > 1 ? (z.x1 - z.x0) / (n - 1) : 0; for (let i = 0; i < n; i++) PART.rivet(Math.round(x + z.x0 + i * step), y + z.y, c); },
    // 珐琅铭牌 10×6：黄铜边框 + 深色底 + 两道黄铜刻字——放在任何底色上都分得开
    plate(x, y) {
      R(x, y, 10, 6, P.brass[0]); R(x + 1, y + 1, 8, 4, P.brass[2]); R(x + 1, y + 1, 8, 1, P.brass[3]);
      R(x + 2, y + 2, 6, 2, '#1c1a1f'); R(x + 3, y + 2, 4, 1, P.brass[1]); R(x + 3, y + 3, 3, 1, P.brass[1]);
    },
    // 压力表 直径 11：黄铜圈 + 蒸汽白表盘 + 绿区 + 指针
    gauge(cx, cy) {
      disc(cx, cy, 5, P.brass[0]); disc(cx, cy, 4, P.brass[2]); disc(cx, cy, 3.2, P.steam[2]);
      R(Math.round(cx - 3), Math.round(cy - 3), 1, 1, P.brass[3]);
      for (let i = 0; i < 4; i++) { const a = Math.PI * (1.6 + i * 0.14); R(Math.round(cx - 0.5 + Math.cos(a) * 2.4), Math.round(cy - 0.5 + Math.sin(a) * 2.4), 1, 1, P.gauge[1]); }
      line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2.5), Math.round(cy - 2), 1, P.dark[0]);
      R(Math.round(cx - 0.5), Math.round(cy - 0.5), 1, 1, P.fire[1]);
    },
  };
  // 直射火炮 2×2 的立面分区（模块内坐标）：炮组左边露出来的那块立面 x 4～25、y 16～38
  const CANNON_ZONE = { seam: { y: 18, x0: 10, x1: 23 }, vent: { x: 7, y: 22 }, plate: { x: 7, y: 32 }, gauge: { x: 11, y: 11 } };
  // 六档：炮塔、炮管、散热口排法 + 数量、接缝铆钉（数量 + 材质）、零件。形体只在 T3、T5 变（方 → 方平顶 → 斜向板）
  const CANNON_TIERS = [
    { t: 'square', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { t: 'square', b: 1, vent: ['rows', 2], riv: [2, 'brass'], parts: [] },
    { t: 'box', b: 2, vent: ['rows', 3], riv: [3, 'brass'], parts: ['corners'] },
    { t: 'box', b: 2, vent: ['rows', 3], riv: [3, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { t: 'slant', b: 3, vent: ['grid', 3], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
    { t: 'slant', b: 3, vent: ['louver', 4], riv: [4, 'steel'], parts: ['corners', 'plate', 'gauge'] },
  ];
  const cannonBase = (x, y) => { box(x + 3, y + 16, 42, 29, IRON); R(x + 4, y + 39, 40, 1, P.brass[2]); R(x + 4, y + 40, 40, 1, P.brass[1]); };
  const CANNON_TOWER = {
    square(x, y) { box(x + 10, y + 7, 22, 10, IRON); R(x + 14, y + 10, 12, 1, P.iron[0]); cannonBase(x, y); },
    box(x, y) { box(x + 5, y + 5, 28, 12, IRON); R(x + 18, y + 9, 11, 2, P.dark[0]); box(x + 11, y + 1, 8, 5, IRON); cannonBase(x, y); },
    slant(x, y) {
      for (let yy = 5; yy <= 16; yy++) {
        const xr = x + 31 + Math.round((yy - 5) * 1.2);
        R(x + 5, y + yy, xr - x - 5, 1, P.iron[2]); R(x + 5, y + yy, 1, 1, P.iron[0]); R(xr - 1, y + yy, 1, 1, P.iron[0]); R(xr - 2, y + yy, 1, 1, P.iron[4]);
      }
      R(x + 5, y + 4, 26, 1, P.iron[0]); R(x + 6, y + 5, 24, 1, P.iron[4]);
      R(x + 17, y + 9, 10, 2, P.dark[0]); box(x + 11, y, 8, 5, IRON); cannonBase(x, y);
    },
  };
  // ---------- 火炮家族（2026-09-27 定稿，样机 tools/gun-family-lab.html，规则 docs/visual-rules.md）----------
  // 窄区散热口（中炮）：slits 竖缝 / slits2 密排竖缝 / grid2 两行短竖缝 / louver2 两行斜百叶；(zx, zy) 是区的左上角，h 是缝高
  function slimVents(x, y, zx, zy, h, style, n) {
    const slit = (sx, sy, hh) => { R(x + sx, y + sy, 1, hh, P.iron[0]); R(x + sx + 1, y + sy, 1, hh, P.iron[3]); };
    if (style === 'slits') for (let i = 0; i < n; i++) slit(zx + i * 3, zy, h);
    else if (style === 'slits2') for (let i = 0; i < n; i++) slit(zx + i * 2, zy, h);
    else if (style === 'grid2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) slit(zx + i * 2, zy + ry, 2);
    else if (style === 'louver2') for (const ry of [0, 3]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { R(x + zx + i * 2 + k, y + zy + ry + k, 1, 1, P.iron[0]); R(x + zx + i * 2 + k + 1, y + zy + ry + k, 1, 1, P.iron[3]); }
  }
  // 小压力表 直径 7（2×1 模块用；1×1 不放）
  function gaugeS(cx, cy) {
    disc(cx, cy, 3.4, P.brass[0]); disc(cx, cy, 2.6, P.steam[2]);
    R(Math.round(cx - 2), Math.round(cy - 2), 1, 1, P.brass[3]);
    R(Math.round(cx + 1), Math.round(cy - 2), 1, 1, P.gauge[1]); R(Math.round(cx + 2), Math.round(cy - 1), 1, 1, P.gauge[1]);
    line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(cx - 2), Math.round(cy - 1.5), 1, P.dark[0]);
  }
  // 中炮 2×1 的立面分区：T1～2 敞开炮架（散热口在炮组下方、铆钉在前挡板脚）；T3～6 炮廓（表位左上、散热区在表位下、铆钉压炮廓和底座的接缝）
  const CANNON_M_ZONE = {
    open: { vent: { x: 11, y: 18, h: 3 }, rivets: { y: 19, xs: [27, 30] } },
    hood: { vent: { x: 3, y: 13, h: 5 }, rivets: { y: 18, x0: 4, x1: 28 }, gauge: { x: 6.5, y: 8.5 } },
  };
  const CANNON_M_TIERS = [
    { h: 'open', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'open', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['grid2', 3], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['louver2', 3], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];
  const CANNON_M_HOOD = {
    open(x, y) { box(x + 1, y + 12, 30, 12, IRON); R(x + 2, y + 22, 28, 1, P.brass[2]); box(x + 26, y + 12, 7, 11, IRON); },   // 敞开炮架 + 低矮前挡板
    box(x, y) { box(x + 1, y + 18, 33, 6, IRON); R(x + 2, y + 22, 31, 1, P.brass[2]); box(x + 2, y + 3, 29, 16, IRON); R(x + 3, y + 4, 27, 1, P.iron[4]); },   // 方平顶炮廓
    slant(x, y) {                                                                                                                                             // 前沿斜板
      box(x + 1, y + 18, 33, 6, IRON); R(x + 2, y + 22, 31, 1, P.brass[2]);
      for (let yy = 3; yy <= 18; yy++) {
        const xr = x + 26 + Math.round((yy - 3) * 0.35);
        R(x + 2, y + yy, xr - x - 2, 1, P.iron[2]); R(x + 2, y + yy, 1, 1, P.iron[0]); R(xr - 1, y + yy, 1, 1, P.iron[0]); R(xr - 2, y + yy, 1, 1, P.iron[4]); R(x + 3, y + yy, 1, 1, P.iron[3]);
      }
      R(x + 2, y + 3, 24, 1, P.iron[0]); R(x + 3, y + 4, 22, 1, P.iron[4]);
    },
  };
  // 小炮 1×1：只靠剪影，不放身份件（visual-rules §3.5）。滑架 → 方箱 → 斜板炮座；铸造瓶身 → 方套箱 → 斜肩套箱
  const CANNON_S_TIERS = [
    { m: 'slide', form: 'cast' }, { m: 'slide', form: 'cast' },
    { m: 'box', form: 'jacket' }, { m: 'box', form: 'jacket' },
    { m: 'slant', form: 'slant' }, { m: 'slant', form: 'slant' },
  ];
  const CANNON_S_MOUNT = {
    slide(x, y) { box(x + 1, y + 19, 23, 5, DARK); R(x + 2, y + 19, 21, 1, P.iron[3]); for (const wx of [4, 20]) { disc(x + wx, y + 22.5, 2, P.dark[0]); R(x + wx, y + 22, 1, 1, P.iron[3]); } },
    box(x, y) { box(x + 1, y + 19, 23, 5, IRON); R(x + 2, y + 20, 21, 1, P.iron[4]); },
    slant(x, y) {
      for (let yy = 19; yy <= 23; yy++) {
        const xr = x + 20 + Math.round((yy - 19) * 0.8);
        R(x + 1, y + yy, xr - x - 1, 1, P.iron[2]); R(x + 1, y + yy, 1, 1, P.iron[0]); R(xr - 1, y + yy, 1, 1, P.iron[0]); R(xr - 2, y + yy, 1, 1, P.iron[4]);
      }
      R(x + 1, y + 19, 20, 1, P.iron[0]); R(x + 2, y + 20, 18, 1, P.iron[4]); R(x + 1, y + 23, 23, 1, P.iron[0]);
    },
  };
  // 侧炮 2×2（侧挂层）：挂板（跟材料）+ 暗铁悬吊臂 + 吊着的长炮；零件只放挂板上
  const SIDE_ZONE = {
    post: { vent: { x: 12, y: 5, h: 4 }, rivets: { y: 5, xs: [7, 24] } },
    box: { vent: { x: 15, y: 8, h: 5 }, rivets: { y: 3, x0: 14, x1: 26 }, gauge: { x: 8.5, y: 10.5 } },
  };
  const SIDE_TIERS = [
    { h: 'post', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'post', b: 1, vent: ['slits', 3], riv: [2, 'brass'], parts: [] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'brass'], parts: ['corners'] },
    { h: 'box', b: 2, vent: ['slits2', 4], riv: [3, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['grid2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
    { h: 'slant', b: 3, vent: ['louver2', 4], riv: [4, 'steel'], parts: ['corners', 'gauge'] },
  ];
  // 悬吊臂：上下法兰；T1～2 粗方柱 + 两道加强筋，T3～4 双柱 + 两道横撑，T5～6 实心腹板 + 竖筋
  const SIDE_ARM = (() => {
    const col = (x, y, w, h) => { R(x, y, w, h, P.dark[0]); R(x + 1, y, w - 2, h, P.dark[2]); R(x + 1, y, 1, h, P.dark[3]); };
    const flange = (x, y, w) => { R(x, y, w, 2, P.dark[0]); R(x + 1, y, w - 2, 1, P.dark[3]); };
    const rib = (x, y, w) => { R(x, y, w, 1, P.dark[0]); R(x, y + 1, w, 1, P.dark[3]); };
    return {
      post(x, y) { col(x + 13, y + 12, 7, 15); rib(x + 13, y + 16, 7); rib(x + 13, y + 21, 7); flange(x + 10, y + 12, 13); flange(x + 10, y + 25, 13); },
      truss(x, y) {
        col(x + 11, y + 16, 5, 11); col(x + 20, y + 16, 5, 11);
        for (const ry of [19, 23]) { R(x + 16, y + ry, 4, 2, P.dark[0]); R(x + 16, y + ry, 4, 1, P.dark[3]); }
        flange(x + 9, y + 16, 18); flange(x + 9, y + 25, 18);
      },
      solid(x, y) {
        R(x + 11, y + 16, 14, 11, P.dark[0]); R(x + 12, y + 16, 12, 11, P.dark[2]); R(x + 12, y + 16, 1, 11, P.dark[3]);
        for (const vx of [15, 20]) { R(x + vx, y + 17, 1, 9, P.dark[0]); R(x + vx + 1, y + 17, 1, 9, P.dark[3]); }
        flange(x + 9, y + 16, 18); flange(x + 9, y + 25, 18);
      },
    };
  })();
  const SIDE_HANG = {
    post(x, y) { box(x + 5, y + 3, 23, 9, IRON); R(x + 6, y + 4, 21, 1, P.iron[4]); SIDE_ARM.post(x, y); },
    box(x, y) { box(x + 3, y + 2, 29, 14, IRON); R(x + 4, y + 3, 27, 1, P.iron[4]); SIDE_ARM.truss(x, y); },
    slant(x, y) {
      for (let yy = 2; yy <= 15; yy++) {
        const xr = x + 26 + Math.round((yy - 2) * 0.4);
        R(x + 3, y + yy, xr - x - 3, 1, P.iron[2]); R(x + 3, y + yy, 1, 1, P.iron[0]); R(x + 4, y + yy, 1, 1, P.iron[3]); R(xr - 1, y + yy, 1, 1, P.iron[0]); R(xr - 2, y + yy, 1, 1, P.iron[4]);
      }
      R(x + 3, y + 2, 23, 1, P.iron[0]); R(x + 4, y + 3, 21, 1, P.iron[4]); R(x + 3, y + 15, 28, 1, P.iron[0]);
      SIDE_ARM.solid(x, y);
    },
  };
  // ---------- 齿轮与传动件（2026-09-27 定稿，样机 tools/gun-family-lab.html 齿轮 v6）----------
  // 对称齿轮：直径 D 取偶数、圆心落在像素角上；只算 1/8 扇区（0 ≤ y ≤ x）再镜像到 8 个扇区 → 像素级完全对称，没有杂边。
  // 矩形齿（径向 2px 深、横向 tw 宽，齿数是 4 的倍数、0° 有一个齿）；辐条沿坐标轴或对角线。
  // 整只齿轮一种纯色（没有描边、没有明暗）：后面的大齿轮暗、前面的小齿轮亮；轮毂一个实心圆、轴孔 2×2。
  // 转动只在 4 个对称帧之间切换：齿相位 0 / 半齿 × 辐条正 / 斜。齿轮画在 UNDER[id]（材质处理之后垫在最后面），颜色固定真黄铜。
  const GEAR_SPEC = {
    XS: { D: 8, n: 8, tw: 2, rim: 0, hub: 1.2, sw: 0, spokes: 0, tone: 2 },
    S: { D: 10, n: 8, tw: 2, rim: 0, hub: 1.6, sw: 0, spokes: 0, tone: 2 },
    M: { D: 14, n: 8, tw: 2, rim: 2, hub: 2.2, sw: 2, spokes: 4, tone: 2 },
    L: { D: 20, n: 12, tw: 2, rim: 2, hub: 3, sw: 2, spokes: 4, tone: 2 },
    XL: { D: 24, n: 16, tw: 2, rim: 3, hub: 3.6, sw: 4, spokes: 4, tone: 1 },
    XXL: { D: 32, n: 20, tw: 2, rim: 3, hub: 4.6, sw: 4, spokes: 4, tone: 1 },
  };
  function gearSymMask(sp, frame) {
    const R0 = sp.D / 2, rb = R0 - 2, half = (frame & 1) ? 0.5 : 0, diag = (frame & 2) ? Math.PI / 4 : 0;
    return (ox, oy) => {
      const d = Math.hypot(ox, oy);
      if (d > R0) return 0;
      if (d > rb) {
        for (let k = 0; k < sp.n; k++) {
          const t = (k + half) * Math.PI * 2 / sp.n;
          if (ox * Math.cos(t) + oy * Math.sin(t) > rb - 0.5 && Math.abs(-ox * Math.sin(t) + oy * Math.cos(t)) < sp.tw / 2) return 1;
        }
        return 0;
      }
      if (d < 1) return 3;
      if (d <= sp.hub) return 2;
      if (!sp.spokes || d > rb - sp.rim) return 1;
      for (let k = 0; k < sp.spokes; k++) {
        const t = diag + k * Math.PI * 2 / sp.spokes;
        if (ox * Math.cos(t) + oy * Math.sin(t) > 0 && Math.abs(-ox * Math.sin(t) + oy * Math.cos(t)) < sp.sw / 2) return 1;
      }
      return 0;
    };
  }
  // 金属感（v7，用户：纯色做底图不错，在此基础上加高光和阴影，但不要硬描边）：形状仍然 8 向对称，只在颜色上加光——
  //   ① 斜面：朝左上的边（上 / 左是空的）亮一阶，朝右下的边暗一阶——是本色的邻阶，不是深色描边；
  //   ② 轮缘 + 齿：左上一段弧亮一阶（再叠斜面就是最亮的高光），右下一段弧暗一阶；
  //   ③ 轮毂：比本体亮一阶，左上一个更亮的高光点；轴孔最深。暗部最低只到本色下一阶，不出现描边色。
  // 1/8 扇区镜像成整张 D×D 网格（0 空 / 1 本体 / 2 轮毂 / 3 轴孔）
  function gearGrid(sp, frame) {
    const m = gearSymMask(sp, frame), D = sp.D, h = D / 2, g = new Uint8Array(D * D);
    for (let j = 0; j < h; j++) for (let i = j; i < h; i++) {
      const v = m(i + 0.5, j + 0.5);
      if (!v) continue;
      for (const [a, b] of [[i, j], [j, i]]) for (const sx of [1, -1]) for (const sy of [1, -1]) g[(sy > 0 ? h + b : h - b - 1) * D + (sx > 0 ? h + a : h - a - 1)] = v;
    }
    return g;
  }
  // 按网格上色，返回 [[dx, dy, 颜色], ...]（dx / dy 相对圆心左上角）
  function gearPaint(sp, g) {
    const D = sp.D, h = D / 2, base = sp.tone, rimIn = h - 2 - sp.rim - 0.5, out = [];
    const RAMP = GEAR_RAMP;
    const at = (i, j) => (i < 0 || j < 0 || i >= D || j >= D) ? 0 : g[j * D + i];
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const v = g[j * D + i];
      if (!v) continue;
      const ox = i + 0.5 - h, oy = j + 0.5 - h, d = Math.hypot(ox, oy), nd = (ox + oy) / (d * Math.SQRT2 || 1);
      let k;
      if (v === 3) k = 0;
      else if (v === 2) k = base + 1 + (ox + oy < -1 ? 1 : 0) - ((at(i + 1, j) !== 2 || at(i, j + 1) !== 2) && ox + oy > 0 ? 1 : 0);
      else {
        let s = 0;
        if (!sp.spokes || d > rimIn) s += nd < -0.55 ? 1 : nd > 0.55 ? -1 : 0;          // 轮缘 / 齿的弧光
        const lit = !at(i, j - 1) || !at(i - 1, j), dark = !at(i, j + 1) || !at(i + 1, j);
        if (lit && !dark) s += 1; else if (dark && !lit) s -= 1;                          // 斜面
        k = base + Math.max(-1, Math.min(2, s));
      }
      out.push([i - h, j - h, RAMP[Math.max(1, Math.min(4, k))]]);
      if (v === 3) out[out.length - 1][2] = RAMP[0];
    }
    return out;
  }
  // 齿轮色阶 = 黄铜挪开一个色值（蓝通道 ±1）：肉眼一样，但材质处理按精确色匹配黄铜、认不出它，饱和色又原样保留 →
  // 齿轮可以画在 DRAW 的任何层次（夹在炮耳架和炮管之间、被炮床挡住……），在所有材料上都是纯黄铜
  const GEAR_RAMP = [...P.brass, '#f6dc92'].map(h => { const n = parseInt(h.slice(1), 16), b = n & 255; return '#' + ((n & 0xffff00) | (b > 0 ? b - 1 : 1)).toString(16).padStart(6, '0'); });
  const gearCache = new Map();   // 上好色的像素表，按（尺寸, 帧）缓存
  PART.gear = (cx, cy, size, frame = 0) => {
    const sp = GEAR_SPEC[size], key = size + frame;
    if (!gearCache.has(key)) gearCache.set(key, gearPaint(sp, gearGrid(sp, frame)));
    for (const [dx, dy, c] of gearCache.get(key)) R(cx + dx, cy + dy, 1, 1, c);
  };
  // 预制齿轮组：超大（D24，一整个 24px 块）在最后，大、中、小依次叠在前面咬合；(x, y) = 超大齿轮圆心。
  // 在 destination-over 下画，先画的在前面：小 → 中 → 大 → 超大
  const GEARSET = [[43, -7, 'S', 1], [34, -4, 'M', 0], [20, -3, 'L', 1], [0, 0, 'XL', 0]];
  PART.gearSet = (x, y) => { for (const [dx, dy, size, f] of GEARSET) PART.gear(x + dx, y + dy, size, f); };
  // 传动杆（2px 铁杆，上沿亮）+ 黄铜轴套；连杆（任意方向的直杆，两端黄铜销）
  PART.shaft = (x0, x1, y0) => { R(x0, y0, x1 - x0, 2, P.iron[0]); R(x0, y0, x1 - x0, 1, P.iron[3]); };
  PART.collar = (x0, y0) => { R(x0, y0 - 1, 2, 4, P.brass[1]); R(x0, y0 - 1, 1, 4, P.brass[3]); };
  PART.link = (x0, y0, x1, y1) => { line(x0, y0, x1, y1, 2, P.iron[0]); line(x0, y0, x1, y1, 1, P.iron[3]); disc(x0 + 0.5, y0 + 0.5, 1.3, P.brass[2]); disc(x1 + 0.5, y1 + 0.5, 1.3, P.brass[2]); };
  // 重炮 3×2（镀镍起，T4～T6）：台阶形炮耳架（T5～6 前沿斜切）+ 带滚轮的铁滑轨；背景齿轮组 + 传动杆
  const HEAVY_TIERS = { 4: { slant: false, heavy: false, riv: 3 }, 5: { slant: true, heavy: true, riv: 4 }, 6: { slant: true, heavy: true, riv: 4 } };
  const heavyTier = (mt) => HEAVY_TIERS[Math.max(4, Math.min(6, mt || 4))];
  const HEAVY_CHEEK = {
    step: [...Array(8).fill(34), ...Array(8).fill(30), ...Array(25).fill(25), ...Array(4).fill(31)],
    slant: [...Array(8).fill(34), ...Array(8).fill(30), ...Array(19).fill(25), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 25 + Math.round(i * 1.4))],
  };
  // 台阶形墙板：tops[i] 是 x0 + i 这一列的上沿，底边统一到 bot
  function steppedPlate(x, y, x0, tops, bot) {
    tops.forEach((t, i) => {
      const xx = x + x0 + i, prev = i ? tops[i - 1] : 99, next = i < tops.length - 1 ? tops[i + 1] : 99;
      R(xx, y + t, 1, bot - t + 1, P.iron[2]); R(xx, y + t, 1, 1, P.iron[0]); R(xx, y + t + 1, 1, 1, P.iron[4]); R(xx, y + bot, 1, 1, P.iron[0]);
      if (prev > t) R(xx, y + t, 1, Math.min(prev, bot) - t + 1, P.iron[0]);
      if (prev > t && i) R(xx + 1, y + t + 1, 1, Math.min(prev, bot) - t - 1, P.iron[3]);
      if (next > t) R(xx, y + t, 1, Math.min(next, bot) - t + 1, P.iron[0]);
    });
  }

  // 臼炮 2×2（高抛火炮）：炮床 + 炮耳座 + 越往炮口越粗的短炮管；两侧活动大齿轮在 UNDER.mortar
  const MORTAR_TIERS = [
    { bed: 'block', cheek: 'block', hoops: 0, fat: false, vent: ['slits', 3], riv: [2, 'brass'], corners: false },
    { bed: 'block', cheek: 'block', hoops: 0, fat: false, vent: ['slits', 3], riv: [2, 'brass'], corners: false },
    { bed: 'step', cheek: 'box', hoops: 1, fat: true, vent: ['slits2', 4], riv: [3, 'brass'], corners: true },
    { bed: 'step', cheek: 'box', hoops: 1, fat: true, vent: ['slits2', 4], riv: [3, 'steel'], corners: true },
    { bed: 'slant', cheek: 'trap', hoops: 2, fat: true, vent: ['grid2', 4], riv: [4, 'steel'], corners: true },
    { bed: 'slant', cheek: 'trap', hoops: 2, fat: true, vent: ['louver2', 4], riv: [4, 'steel'], corners: true },
  ];
  const MORTAR_ZONE = { block: { vent: { x: 8, y: 40, h: 3 }, riv: { y: 38, x0: 33, x1: 40 } }, step: { vent: { x: 6, y: 42, h: 3 }, riv: { y: 36, x0: 32, x1: 38 } } };
  const MORTAR_BED = {
    block(x, y) { box(x + 3, y + 36, 42, 11, IRON); R(x + 4, y + 37, 40, 1, P.iron[4]); R(x + 4, y + 45, 40, 1, P.brass[2]); },
    step(x, y) { box(x + 2, y + 40, 44, 7, IRON); R(x + 3, y + 41, 42, 1, P.iron[4]); box(x + 8, y + 35, 32, 6, IRON); R(x + 9, y + 36, 30, 1, P.iron[4]); },
    slant(x, y) {
      for (let yy = 40; yy <= 46; yy++) {
        const xr = x + 40 + Math.round((yy - 40) * 0.9);
        R(x + 2, y + yy, xr - x - 2, 1, P.iron[2]); R(x + 2, y + yy, 1, 1, P.iron[0]); R(x + 3, y + yy, 1, 1, P.iron[3]); R(xr - 1, y + yy, 1, 1, P.iron[0]); R(xr - 2, y + yy, 1, 1, P.iron[4]);
      }
      R(x + 2, y + 40, 38, 1, P.iron[0]); R(x + 3, y + 41, 37, 1, P.iron[4]); R(x + 2, y + 46, 44, 1, P.iron[0]);
      box(x + 8, y + 35, 32, 6, IRON); R(x + 9, y + 36, 30, 1, P.iron[4]);
    },
  };
  const MORTAR_CHEEK = {   // 炮耳座：画在炮管前面（近侧墙板），夹住炮尾
    block(x, y) { box(x + 18, y + 26, 13, 11, IRON); R(x + 19, y + 27, 11, 1, P.iron[4]); },
    box(x, y) { box(x + 16, y + 25, 17, 11, IRON); R(x + 17, y + 26, 15, 1, P.iron[4]); R(x + 17, y + 31, 15, 1, P.iron[1]); },
    trap(x, y) {
      for (let yy = 25; yy <= 35; yy++) {
        const k = Math.round((yy - 25) * 0.4), x0 = x + 18 - k, x1 = x + 31 + k;
        R(x0, y + yy, x1 - x0, 1, P.iron[2]); R(x0, y + yy, 1, 1, P.iron[0]); R(x0 + 1, y + yy, 1, 1, P.iron[3]); R(x1 - 1, y + yy, 1, 1, P.iron[0]); R(x1 - 2, y + yy, 1, 1, P.iron[4]);
      }
      R(x + 18, y + 25, 13, 1, P.iron[0]); R(x + 19, y + 26, 11, 1, P.iron[4]);
    },
  };
  // 臼炮炮管：按旋转后的坐标逐像素算（u 沿炮管、v 垂直，负 = 向光），82° 也不锯齿；越往炮口越粗
  function mortarTube(cx, cy, aDeg, d, T, fire) {
    const a = aDeg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const c1 = T.fat ? 7 : 6, b1 = T.fat ? 8 : 7, segs = [[-7, -4, 3], [-4, 5, c1], [5, 21, b1], [21, 25, b1 + 1]];
    const hoopU = T.hoops === 2 ? [[10, 12], [15, 17]] : T.hoops === 1 ? [[13, 15]] : [];
    const uv = (px0, py0) => { const dx = px0 + 0.5 - cx, dy = py0 + 0.5 - cy; return [dx * cs - dy * sn + d, dx * sn + dy * cs]; };
    const hwAt = (u) => { for (const [u0, u1, hw] of segs) if (u >= u0 && u < u1) return hw + (hoopU.some(([h0, h1]) => u >= h0 && u < h1) ? 1 : 0); return -1; };
    const inside = (px0, py0) => { const [u, v] = uv(px0, py0), hw = hwAt(u); return hw > 0 && Math.abs(v) <= hw; };
    for (let py0 = cy - 34; py0 <= cy + 14; py0++) for (let px0 = cx - 14; px0 <= cx + 34; px0++) {
      if (!inside(px0, py0)) continue;
      const [u, v] = uv(px0, py0), hw = hwAt(u);
      let c = P.iron[3];
      if (!inside(px0 - 1, py0) || !inside(px0 + 1, py0) || !inside(px0, py0 - 1) || !inside(px0, py0 + 1)) c = P.iron[0];
      else if (u > 23.5 && Math.abs(v) < hw - 2) c = P.black;
      else if (u >= 3 && u < 5) c = v < 0 ? P.brass[3] : P.brass[1];
      else if (v < -hw + 2.2) c = P.iron[4];
      else if (v > hw * 0.45) c = P.iron[2];
      if (c === P.iron[3] && hoopU.some(([h0]) => u >= h0 && u < h0 + 1)) c = P.iron[4];
      R(px0, py0, 1, 1, c);
    }
    if (fire) for (let t = 25; t < 31; t++) { const w = Math.max(1, 5 - (t - 25) * 0.7); for (let q = -w; q <= w; q++) R(Math.round(cx + cs * (t - d) + sn * q), Math.round(cy - sn * (t - d) + cs * q), 1, 1, t < 28 ? P.fire[3] : P.fire[2]); }
  }

  // 方形固定螺栓（耳轴）：火炮家族共用
  const trunnionBolt = (cx, cy) => { R(cx - 2, cy - 2, 5, 5, P.brass[0]); R(cx - 1, cy - 1, 3, 3, P.brass[3]); R(cx, cy, 1, 1, P.brass[0]); };

  // 材质处理之后才画的「身份件」：DRAW 画铁件，OVER 画颜色固定的零件
  const OVER = {
    cannon(x, y, q) {
      const T = CANNON_TIERS[(q.mt || 1) - 1], Z = CANNON_ZONE;
      PART.seam(x, y, Z.seam, T.riv[0], RIVET_TIER[T.riv[1]]);
      if (T.parts.includes('plate')) PART.plate(x + Z.plate.x, y + Z.plate.y);
      if (T.parts.includes('gauge')) PART.gauge(x + Z.gauge.x, y + Z.gauge.y);
    },
    mortar(x, y, q) {   // 炮床上沿右段的铆钉
      const T = MORTAR_TIERS[(q.mt || 1) - 1], Z = MORTAR_ZONE[T.bed === 'block' ? 'block' : 'step'].riv, [n, kind] = T.riv, step = (Z.x1 - Z.x0) / (n - 1);
      for (let i = 0; i < n; i++) PART.rivet(Math.round(x + Z.x0 + i * step), y + Z.y, RIVET_TIER[kind]);
    },
    cannon_heavy(x, y, q) {   // 滑轨上沿的钢质铆钉
      const n = heavyTier(q.mt).riv, step = 61 / (n - 1);
      for (let i = 0; i < n; i++) PART.rivet(Math.round(x + 5 + i * step), y + 41, RIVET_TIER.steel);
    },
    side_cannon(x, y, q) {
      const T = SIDE_TIERS[(q.mt || 1) - 1], c = RIVET_TIER[T.riv[1]];
      if (T.h === 'post') for (const fx of SIDE_ZONE.post.rivets.xs) PART.rivet(x + fx, y + SIDE_ZONE.post.rivets.y, c);
      else PART.seam(x, y, SIDE_ZONE.box.rivets, T.riv[0], c);
      if (T.parts.includes('gauge')) gaugeS(x + SIDE_ZONE.box.gauge.x, y + SIDE_ZONE.box.gauge.y);
    },
    cannon_m(x, y, q) {
      const T = CANNON_M_TIERS[(q.mt || 1) - 1], c = RIVET_TIER[T.riv[1]];
      if (T.h === 'open') for (const fx of CANNON_M_ZONE.open.rivets.xs) PART.rivet(x + fx, y + CANNON_M_ZONE.open.rivets.y, c);
      else PART.seam(x, y, CANNON_M_ZONE.hood.rivets, T.riv[0], c);
      if (T.parts.includes('gauge')) gaugeS(x + CANNON_M_ZONE.hood.gauge.x, y + CANNON_M_ZONE.hood.gauge.y);
    },
  };

  // 垫在最后面的背景件（材质处理之后、destination-over）：颜色固定、永远在整张精灵后面
  const UNDER = {};   // 齿轮改用 GEAR_RAMP 后直接画在 DRAW 里，这里暂时不用（管线保留）


  const DRAW = {
    armor(x, y) {
      box(x + 3, y + 3, 42, 42, IRONL);
      R(x + 4, y + 23, 40, 1, P.iron[1]);
      R(x + 4, y + 24, 40, 1, P.iron[4]);
      for (const ry of [7, 19, 28, 39]) for (const rx of [8, 18, 28, 38]) rivet(x + rx, y + ry);
      R(x + 30, y + 13, 5, 1, P.iron[2]); R(x + 12, y + 32, 3, 1, P.iron[2]); R(x + 33, y + 34, 4, 1, P.iron[2]);
    },
    armor_heavy(x, y) {
      box(x + 3, y + 3, 42, 42, IRON);
      box(x + 8, y + 8, 32, 32, IRONL);
      R(x + 9, y + 23, 30, 2, P.iron[2]); R(x + 9, y + 25, 30, 1, P.iron[4]);
      R(x + 23, y + 9, 2, 30, P.iron[2]); R(x + 25, y + 9, 1, 30, P.iron[4]);
      for (const [bx, by] of [[14, 14], [34, 14], [14, 34], [34, 34]]) {
        disc(x + bx, y + by, 3.2, P.iron[0]); disc(x + bx - 0.5, y + by - 0.5, 2.3, P.iron[4]); R(x + bx, y + by, 1, 1, P.iron[2]);
      }
      for (let k = 8; k < 42; k += 8) { rivet(x + k, y + 4, P.iron[3]); rivet(x + k, y + 41, P.iron[3]); rivet(x + 4, y + k, P.iron[3]); rivet(x + 41, y + k, P.iron[3]); }
    },
    cockpit(x, y, o) {
      // 2×2 联合驾驶舱（4 名驾驶员）：大铁壳 + 黄铜拱顶，四个舷窗里各坐一个 1×1 大小的驾驶员（不放大，见 module-plan §0.5）；
      // 舷窗之间是传声管和压力表。史诗起驾驶员换装（皮飞行帽 + 护目镜），拱顶多一圈黄铜饰边
      const st = o.st || 1;
      box(x + 3, y + 3, 42, 42, IRON);
      arch(x + 24, y + 4, y + 44, 19, P.brass[0]);
      arch(x + 24, y + 5, y + 43, 18, P.brass[2]);
      arch(x + 24, y + 7, y + 42, 16, P.iron[2]);
      arch(x + 24, y + 8, y + 41, 15, P.iron[1]);
      for (let a = 0; a <= 8; a++) {
        const ang = Math.PI + a / 8 * Math.PI;
        R(Math.round(x + 24 + Math.cos(ang) * 17), Math.round(y + 24 + Math.sin(ang) * 17), 1, 1, P.brass[3]);
      }
      if (st >= 2) { R(x + 21, y + 1, 7, 3, P.brass[0]); R(x + 22, y + 1, 5, 2, P.brass[2]); R(x + 23, y + 1, 3, 1, P.brass[3]); }
      // 传声管：十字把四个舷窗连起来，中间一只压力表
      R(x + 23, y + 12, 2, 28, P.brass[1]); R(x + 23, y + 12, 1, 28, P.brass[2]);
      R(x + 10, y + 25, 28, 2, P.brass[1]); R(x + 10, y + 25, 28, 1, P.brass[2]);
      disc(x + 24, y + 26, 3.4, P.brass[0]); disc(x + 24, y + 26, 2.5, P.steam[2]); R(x + 24, y + 25, 1, 2, P.dark[0]);
      porthole(x + 15, y + 17, o, 0); porthole(x + 33, y + 17, o, 1);
      porthole(x + 15, y + 35, o, 2); porthole(x + 33, y + 35, o, 3);
      for (const ry of [30, 38]) { R(x + 6, y + ry, 2, 2, P.brass[3]); R(x + 40, y + ry, 2, 2, P.brass[3]); }
    },
    copilot(x, y, o) {
      // 副驾驶：圆舷窗里的暖棕紫小黑炭球，扶着黄铜望远镜往外看；下方两根拉杆
      box(x + 3, y + 3, 42, 42, IRON);
      disc(x + 24, y + 20, 15, P.black); disc(x + 24, y + 20, 14, P.brass[1]); disc(x + 24, y + 20, 12.5, P.brass[2]);
      disc(x + 24, y + 20, 11, P.iron[1]);
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; R(Math.round(x + 24 + Math.cos(ang) * 13), Math.round(y + 20 + Math.sin(ang) * 13), 1, 1, P.brass[3]); }
      const bob = [0, 1, 1, 0][o.lv || 0];
      // 望远镜架在舷窗上，小黑炭球（暖棕紫）用两只小短手扶着往外看
      line(x + 26, y + 18, x + 37, y + 15, 4, P.black); line(x + 26, y + 18, x + 37, y + 15, 2, P.brass[2]);
      R(x + 36, y + 13, 3, 5, P.brass[3]);
      soot(x + 21, y + 21 + bob, 8.5, SOOT_CO, {
        look: 1, blink: (o.lv || 0) === 3,
        hands: [[x + 27, y + 20 + bob, x + 29, y + 16], [x + 27, y + 25 + bob, x + 32, y + 17]],
      });
      // 下方：拉杆 + 小仪表
      box(x + 8, y + 34, 32, 9, DARK);
      for (const lx of [14, 20]) { line(x + lx, y + 38, x + lx + (lx === 14 ? bob : -bob), y + 31, 2, P.brass[2]); disc(x + lx + (lx === 14 ? bob : -bob), y + 31, 1.6, P.fire[2]); }
      disc(x + 32, y + 38, 3, P.brass[2]); disc(x + 32, y + 38, 2, P.steam[2]); R(x + 32, y + 37, 1, 2, P.dark[0]);
      rivet(x + 6, y + 6); rivet(x + 40, y + 6); rivet(x + 6, y + 40); rivet(x + 40, y + 40);
    },
    water(x, y, o) {
      // 带水位的方块水箱
      box(x + 19, y + 2, 10, 6, BRASS);
      box(x + 4, y + 6, 40, 39, IRONL);
      R(x + 8, y + 10, 32, 31, P.iron[0]);
      R(x + 9, y + 11, 30, 29, P.glass[0]);
      const lh = o.lv == null ? 29 : o.lv, fr = o.fr || 0;
      if (lh > 0) {
        const top = y + 40 - lh;
        R(x + 9, top, 30, lh, P.water[1]);
        R(x + 9, top, 30, 1, P.water[3]);
        for (let i = 0; i < 30; i += 7) R(x + 9 + ((i + fr * 2) % 28), top + 1, 3, 1, P.water[2]);
        if (lh > 4) R(x + 11, top + 3, 2, lh - 5, P.water[2]);
        for (const [bx, by] of [[18, 5], [27, 12], [33, 8]]) {
          const yy = y + 39 - ((by + fr * 3) % Math.max(1, lh - 2));
          if (yy > top + 1) R(x + bx, yy, 1, 1, P.water[3]);
        }
      }
      R(x + 35, y + 13, 2, 7, P.glass[2]); R(x + 33, y + 15, 1, 3, P.glass[2]);
      for (let k = 0; k < 4; k++) R(x + 41, y + 14 + k * 7, 2, 1, P.iron[4]);
      for (const [rx, ry] of [[6, 8], [40, 8], [6, 42], [40, 42]]) rivet(x + rx - 1, y + ry - 1);
      R(x + 4, y + 43, 5, 2, P.brass[2]);
    },
    boiler(x, y, o) {
      // 大燃煤窗口：唯一的发光体。外观阶段 ②（史诗起）：高烟囱 + 防火星罩、双压力表、圆形炉门 + 辐射炉栅
      const st = o.st || 1;
      box(x + 3, y + 6, 42, 39, IRON);
      if (st === 2) {
        box(x + 33, y - 4, 8, 12, DARK); R(x + 31, y - 6, 12, 3, P.dark[0]); R(x + 32, y - 6, 10, 1, P.dark[3]);
        for (const cx0 of [32, 35, 38, 41]) R(x + cx0, y - 8, 1, 2, P.dark[3]);   // 防火星罩的齿冠
        R(x + 34, y + 1, 6, 1, P.brass[2]);
      } else { box(x + 33, y, 8, 8, DARK); R(x + 32, y, 10, 2, P.dark[3]); }
      R(x + 4, y + 11, 40, 1, P.iron[1]);
      for (const rx of [8, 16, 24]) R(x + rx, y + 11, 1, 1, P.iron[4]);
      disc(x + 11, y + 9, 3.2, P.brass[2]); disc(x + 11, y + 9, 2.2, P.steam[2]); R(x + 11, y + 8, 1, 2, P.gauge[1]);
      if (st === 2) { disc(x + 20, y + 9, 3.2, P.brass[2]); disc(x + 20, y + 9, 2.2, P.steam[2]); R(x + 20, y + 9, 2, 1, P.fire[1]); R(x + 14, y + 9, 3, 1, P.brass[1]); }
      box(x + 7, y + 15, 34, 28, [P.iron[0], P.iron[1], P.iron[3], P.iron[4]]);
      rivet(x + 9, y + 17); rivet(x + 37, y + 17); rivet(x + 9, y + 39); rivet(x + 37, y + 39);
      R(x + 5, y + 21, 2, 5, P.brass[2]); R(x + 5, y + 33, 2, 5, P.brass[2]);
      const lv = o.lv || 1, fr = o.fr || 0;
      // 炉膛：暗室，底部煤层的余温向上晕开（抖动像素）
      R(x + 11, y + 19, 26, 20, P.dark[0]);
      for (let i = 0; i < 26; i++) {
        if (i % 2 === 0) R(x + 11 + i, y + 27, 1, 1, P.fire[0]);
        R(x + 11 + i, y + 28, 1, 1, P.fire[0]);
      }
      // 煤层：大块黑煤挤在一起，只有块间的裂缝透出暗红，热量越高裂缝越亮
      R(x + 11, y + 29, 26, 10, P.fire[1]);
      R(x + 11, y + 38, 26, 1, P.fire[lv >= 3 ? 2 : 1]);
      const lumps = [[0, 29, 6, 4], [6, 28, 6, 5], [12, 29, 5, 4], [17, 28, 6, 5], [23, 29, 3, 4],
        [0, 33, 5, 5], [5, 32, 6, 6], [11, 33, 6, 5], [17, 32, 5, 6], [22, 33, 4, 5]];
      lumps.forEach(([lx, ly, w, h], i) => {
        const X = x + 11 + lx, Y = y + ly;
        R(X + 1, Y, w - 2, h, P.dark[1]);
        R(X, Y + 1, w, h - 2, P.dark[1]);
        R(X + 1, Y, w - 2, 1, P.dark[2]); R(X, Y + 1, 1, 1, P.dark[3]); R(X + 1, Y, 1, 1, P.dark[3]);
        R(X + 1, Y + h - 1, w - 2, 1, P.dark[0]);
        // 裂缝余烬：逐帧轻微明灭
        const hot = (i * 5 + fr) % 4;
        R(X + w - 1, Y + 2, 1, Math.max(1, h - 4), hot < lv ? P.fire[Math.min(3, lv - 1 + (hot === 0 ? 1 : 0))] : P.fire[0]);
        if (hot < lv && i % 3 === 1) R(X + 2, Y + h - 1, 2, 1, P.fire[1]);
      });
      // 火星：只在高温时偶尔飘起一两粒
      if (lv >= 2) { R(x + 13 + fr * 5, y + 26 - fr % 2 * 3, 1, 1, P.fire[2]); if (lv >= 3) R(x + 31 - fr * 4, y + 23 + fr % 2, 1, 1, P.fire[1]); }
      if (st === 2) {
        // 圆形炉门：圆外是门板，圆里是炉火；黄铜门圈、左侧铰链，炉栅按圆裁
        const ccx = x + 24, ccy = y + 29, rr = 10.5;
        for (let yy = y + 19; yy < y + 40; yy++) for (let xx = x + 11; xx < x + 37; xx++) {
          const dx = xx + 0.5 - ccx, dy = yy + 0.5 - ccy, d2 = dx * dx + dy * dy;
          if (d2 > (rr + 1.5) ** 2) R(xx, yy, 1, 1, P.iron[3]);
          else if (d2 > rr * rr) R(xx, yy, 1, 1, dx + dy < 0 ? P.brass[3] : P.brass[1]);
          else if ((((xx - x) % 5) === 1 && Math.abs(dy) < rr - 1) || (Math.abs(dy + 4) < 1)) R(xx, yy, 1, 1, P.iron[0]);
        }
        R(x + 9, y + 24, 3, 10, P.brass[1]); R(x + 9, y + 24, 1, 10, P.brass[3]);
        rivet(x + 12, y + 20); rivet(x + 34, y + 20); rivet(x + 12, y + 37); rivet(x + 34, y + 37);
      } else {
        // 铁栅栏：竖条 + 一道横档，压在煤火前面
        R(x + 11, y + 25, 26, 2, P.iron[0]); R(x + 11, y + 25, 26, 1, P.iron[2]);
        for (const gx of [14, 20, 26, 32]) {
          R(x + gx, y + 19, 2, 20, P.iron[0]);
          R(x + gx, y + 19, 1, 20, P.iron[2]);
          R(x + gx, y + 25, 2, 2, P.iron[3]);
        }
      }
      // 灰斗缝透出微光
      R(x + 11, y + 40, 26, 1, lv >= 2 ? P.fire[1] : P.fire[0]);
    },
    cannon(x, y, o) {
      // 直射火炮 2×2（2026-09-27 定稿，样机 tools/cannon-lab.html）：按材料档位 T1～T6 画，形体只在 T3、T5 变——
      // T1～2 方指挥塔、T3～4 方平顶炮廓、T5～6 斜向板炮廓；炮管 ① 素管两道箍 + 方制退器，② 炮尾套筒 + 一道箍 + 阶梯式方制退器，③ 粗炮身 + 三道铁箍 + 大方制退器。
      // 立面：散热口逐档变（两道 → 三道 → 双列 → 斜百叶），钢起有包角铁；铆钉 / 铭牌 / 压力表在 OVER.cannon 里画。全部直线，炮口末端都在耳轴前 40px
      const T = CANNON_TIERS[(o.mt || 1) - 1];
      CANNON_TOWER[T.t](x, y);
      PART.vents(x, y, CANNON_ZONE.vent, T.vent[0], T.vent[1]);
      if (T.parts.includes('corners')) { PART.corner(x + 3, y + 16, 1, 1); PART.corner(x + 3, y + 40, 1, -1); PART.corner(x + 40, y + 40, -1, -1); }
      gunShield(x + 43, y + 27, o.up, 11);
      const d = rcPx('cannon', o.k);
      turn(x + 34, y + 27, o.a, (X, Y) => {
        X += x; Y += y;
        box(X + 26, Y + 15, 16, 24, BRASS);
        R(X + 29, Y + 17, 1, 20, P.brass[3]);
        R(X + 40, Y + 33, 12, 5, P.dark[0]); R(X + 40, Y + 34, 12, 3, P.iron[2]); R(X + 40, Y + 34, 12, 1, P.iron[4]);
        const lug = X + 58 - d;
        if (lug > X + 52) { R(X + 52, Y + 35, lug - X - 52, 2, P.iron[0]); R(X + 52, Y + 35, lug - X - 52, 1, P.brass[3]); }
        R(lug - 1, Y + 31, 3, 6, P.brass[1]); R(lug - 1, Y + 31, 1, 6, P.brass[3]);
        const bx = X + 38 - d;
        const tube = (x0, len, y0, hh) => { R(x0, y0, len, hh, P.iron[0]); R(x0, y0 + 1, len, hh - 2, P.iron[3]); R(x0, y0 + 1, len, 1, P.iron[4]); R(x0, y0 + hh - 2, len, 1, P.iron[2]); };
        const band = (hx, y0, hh) => { R(hx, y0, 3, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
        const hoop = (hx, y0, hh) => { R(hx, y0, 3, hh, P.iron[0]); R(hx, y0 + 1, 3, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
        const brake = (x0, y0, w, hh, slots) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (const sy of slots) R(x0 + 2, Y + sy, w - 4, 2, P.dark[0]); };
        if (T.b === 1) {
          tube(bx, 30, Y + 22, 10); for (const hb of [8, 18]) band(bx + hb, Y + 21, 12);
          brake(bx + 28, Y + 19, 8, 16, [22, 26, 30]);
        } else if (T.b === 2) {
          tube(bx, 30, Y + 22, 10); tube(bx, 14, Y + 20, 14); band(bx + 14, Y + 21, 12);
          R(bx + 24, Y + 20, 5, 14, P.iron[0]); R(bx + 25, Y + 21, 3, 12, P.iron[3]); R(bx + 25, Y + 21, 3, 1, P.iron[4]);   // 阶梯制退器的前一段
          brake(bx + 28, Y + 18, 8, 18, [21, 25, 29]);
        } else {
          tube(bx, 30, Y + 21, 12); for (const hb of [4, 11, 18]) hoop(bx + hb, Y + 20, 14);
          brake(bx + 27, Y + 18, 10, 18, [21, 25, 29]);
        }
        if ((o.k || 0) >= 7) { R(bx + 36, Y + 23, 3, 8, P.fire[3]); R(bx + 39, Y + 25, 2, 4, P.fire[2]); }   // 刚开炮：炮口余焰
      });
      disc(x + 34, y + 27, 3, P.brass[0]); disc(x + 34, y + 27, 2, P.brass[3]);   // 耳轴
    },
    // 中炮 2×1（48×24，横躺，2026-09-27 定稿）：炮组绕耳轴 (18,13) 转，炮口末端在耳轴前 41（blen 40）。和直射火炮同构——
    // T1～2 敞开炮架 + 低前挡板、T3～4 方平顶炮廓、T5～6 斜板炮廓；炮管 ① 素管 + 黄铜箍 + 小方制退器，② 炮尾套筒 + 箍 + 连体阶梯制退器，③ 粗炮身 + 三道铁箍 + 大方制退器。
    // 散热口每档至少 3 个；铆钉 / 小压力表在 OVER.cannon_m 里画
    cannon_m(x, y, o) {
      const T = CANNON_M_TIERS[(o.mt || 1) - 1], Z = CANNON_M_ZONE[T.h === 'open' ? 'open' : 'hood'];
      CANNON_M_HOOD[T.h](x, y);
      slimVents(x, y, Z.vent.x, Z.vent.y, Z.vent.h, T.vent[0], T.vent[1]);
      if (T.parts.includes('corners')) { PART.corner(x + 2, y + 3, 1, 1); PART.corner(x + 1, y + 19, 1, -1); }
      gunShield(x + 33, y + 13, o.up, 6);
      const d = rcPx('cannon_m', o.k);
      turn(x + 18, y + 13, o.a, (X, Y) => {
        X += x; Y += y;
        box(X + 11, Y + 7, 12, 11, BRASS); R(X + 13, Y + 9, 1, 7, P.brass[3]);   // 黄铜摇架
        const end = X + 59 - d, b0 = X + 22 - d;
        const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
        const band = (hx, y0, hh) => { R(hx, y0, 2, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
        const hoop = (hx, y0, hh) => { R(hx, y0, 2, hh, P.iron[0]); R(hx, y0 + 1, 2, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
        const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 2 + i * 3, w - 4, 1, P.dark[0]); };
        if (T.b === 1) { tube(b0, end - 5, Y + 10, 6); band(b0 + 12, Y + 9, 8); brake(end - 6, Y + 8, 6, 10, 2); }
        else if (T.b === 2) {
          tube(b0, end - 8, Y + 10, 6); tube(b0, b0 + 14, Y + 9, 8); band(b0 + 14, Y + 9, 8);
          R(end - 9, Y + 9, 3, 8, P.iron[0]); R(end - 8, Y + 10, 1, 6, P.iron[3]);
          brake(end - 6, Y + 7, 6, 12, 3);
        } else { tube(b0, end - 6, Y + 9, 8); for (const hb of [3, 11, 19]) hoop(b0 + hb, Y + 8, 10); brake(end - 7, Y + 7, 7, 12, 3); }
        if ((o.k || 0) >= 7) { R(end, Y + 10, 3, 6, P.fire[3]); R(end + 3, Y + 11, 2, 4, P.fire[2]); }   // 刚开炮：炮口余焰
      });
      trunnionBolt(x + 18, y + 13);
    },
    // 小炮 1×1（卡隆短炮，2026-09-27 定稿）：只靠剪影，不放铆钉 / 散热口 / 压力表 / 包角铁（visual-rules §3.5）。
    // 长药室 17×15 撑满格子上半；炮组绕耳轴 (12,13) 转，炮口末端在耳轴前 24。只留方形固定螺栓 + 药室一道黄铜箍
    cannon_s(x, y, o) {
      const T = CANNON_S_TIERS[(o.mt || 1) - 1];
      CANNON_S_MOUNT[T.m](x, y);
      gunShield(x + 21, y + 13, o.up, 4);
      const d = rcPx('cannon_s', o.k);
      turn(x + 12, y + 13, o.a, (X, Y) => {
        const C = X + x + 12 - d, M = Y + y + 13, end = C + 24;
        const col = (cx, t, b) => { R(cx, t, 1, b - t + 1, P.iron[0]); if (b - t > 1) { R(cx, t + 1, 1, b - t - 1, P.iron[3]); R(cx, t + 1, 1, 1, P.iron[4]); if (b - t > 3) R(cx, t + 2, 1, 1, P.iron[4]); R(cx, b - 1, 1, 1, P.iron[2]); } };
        const hoop = (hx, hh) => { R(hx, M - hh, 2, hh * 2 + 1, P.iron[0]); R(hx, M - hh + 1, 2, hh * 2 - 1, P.iron[2]); R(hx, M - hh + 1, 1, hh * 2 - 1, P.iron[4]); };
        const ring = (x0, w, hh) => { R(x0, M - hh, w, hh * 2 + 1, P.iron[0]); R(x0 + 1, M - hh + 1, w - 2, hh * 2 - 1, P.iron[3]); R(x0 + 1, M - hh + 1, w - 2, 1, P.iron[4]); };
        if (T.form === 'cast') {   // 铸造瓶身：圆尾钮 + 两端倒角的长药室 + 细炮管 + 方口箍
          disc(C - 10.5, M, 2.5, P.iron[0]); disc(C - 10.5, M, 1.5, P.iron[3]);
          [4, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 4].forEach((hh, i) => col(C - 9 + i, M - hh, M + hh));
          for (let i = C + 8; i < end - 3; i++) col(i, M - 3, M + 3);
          ring(end - 3, 3, 4); R(end - 1, M, 1, 1, P.black);
        } else {                   // 方套箱（T5～6 前肩斜切）：方尾钮 + 17×15 套箱（倒 1px 角）
          const slant = T.form === 'slant', x0 = C - 9, n = 17;
          R(C - 12, M - 2, 3, 5, P.iron[0]); R(C - 11, M - 1, 1, 3, P.iron[3]); R(C - 11, M - 1, 1, 1, P.iron[4]);
          for (let i = 0; i < n; i++) {
            const edge = i === 0 || i === n - 1;
            const t = M - 7 + (slant && i >= 7 ? Math.round((i - 7) * 0.6) : 0) + (edge ? 1 : 0), b = M + 7 - (edge ? 1 : 0);
            R(x0 + i, t, 1, b - t + 1, P.iron[0]);
            if (!edge) { R(x0 + i, t + 1, 1, b - t - 1, P.iron[2]); R(x0 + i, t + 1, 1, 1, P.iron[4]); R(x0 + i, b - 1, 1, 1, P.iron[1]); }
            if (i === 1) R(x0 + i, t + 1, 1, b - t - 1, P.iron[3]);
            if (i === n - 2) R(x0 + i, t + 1, 1, b - t - 1, P.iron[1]);
          }
          const hh = slant ? 4 : 3;
          for (let i = C + 8; i < end - 5; i++) col(i, M - hh, M + hh);
          if (!slant) { col(C + 8, M - 5, M + 5); col(C + 9, M - 5, M + 5); R(C + 9, M - 5, 1, 11, P.iron[0]); hoop(C + 14, 4); ring(end - 6, 3, 4); ring(end - 3, 3, 5); R(end - 1, M, 1, 1, P.black); }   // 台阶收口 + 铁箍 + 阶梯方口
          else { hoop(C + 11, 5); ring(end - 6, 6, 5); R(end - 4, M - 2, 3, 1, P.dark[0]); R(end - 4, M + 2, 3, 1, P.dark[0]); }   // 粗箍 + 方制退器
        }
        R(C - 5, M - 7, 2, 15, P.brass[1]); R(C - 5, M - 7, 1, 15, P.brass[3]);   // 药室黄铜箍
        if ((o.k || 0) >= 7) { R(end, M - 2, 3, 5, P.fire[3]); R(end + 3, M - 1, 2, 3, P.fire[2]); }
      });
      trunnionBolt(x + 12, y + 13);
    },
    // ---------- 小模块：24px 原生画（不再借大模块缩小），像素大小和大模块一样 ----------
    // 1×1 驾驶舱：铁头盔 + 黄铜舷窗，窗里是小黑炭球驾驶员（联合驾驶舱里的驾驶员也按这个大小）
    helmet(x, y, o) {
      arch(x + 12, y + 2, y + 22, 10, P.iron[0]);
      arch(x + 12, y + 3, y + 21, 9, P.iron[2]);
      for (const [hx, hy] of [[5, 7], [6, 5], [8, 4], [4, 9], [4, 11]]) R(x + hx, y + hy, 1, 1, P.iron[3]);
      R(x + 20, y + 9, 1, 9, P.iron[1]);
      R(x + 8, y + 1, 5, 2, P.brass[0]); R(x + 9, y + 1, 3, 1, P.brass[2]);
      R(x + 2, y + 18, 20, 4, P.brass[0]); R(x + 3, y + 18, 18, 3, P.brass[1]); R(x + 3, y + 18, 18, 1, P.brass[3]);
      rivet(x + 4, y + 13);
      disc(x + 13, y + 11, 6.2, P.black); disc(x + 13, y + 11, 5.4, P.brass[1]);
      for (const [px, py] of [[9, 7], [11, 6], [8, 9]]) R(x + px, y + py, 1, 1, P.brass[3]);
      disc(x + 13, y + 11, 4.3, P.glass[0]);
      pilot(x + 13, y + 12, o.lv || 0, (o.seed || 0) % 2 === 0, o.st || 1);
      R(x + 10, y + 8, 1, 1, P.glass[3]);
      if ((o.st || 1) >= 2) { R(x + 11, y - 1, 3, 3, P.brass[0]); R(x + 12, y - 1, 1, 2, P.brass[3]); }   // 史诗起：头盔顶上的黄铜冠饰
    },
    plate(x, y) {
      box(x + 2, y + 2, 20, 20, IRONL);
      R(x + 3, y + 11, 18, 1, P.iron[1]); R(x + 3, y + 12, 18, 1, P.iron[4]);
      for (const [a, b] of [[4, 4], [17, 4], [4, 16], [17, 16]]) rivet(x + a, y + b);
      R(x + 13, y + 7, 3, 1, P.iron[2]); R(x + 7, y + 17, 2, 1, P.iron[2]);
    },
    // 水罐（1×1 / 1×2）：圆罐 + 竖玻璃窗，水位跟着剩水量降，偶尔冒个气泡
    tank_s(x, y, o) { tankArt(x, y, 24, o); },
    tank_tall(x, y, o) { tankArt(x, y, 48, o); },
    // 臼炮 2×2（高抛火炮，2026-09-27 定稿，样机 tools/gun-family-lab.html 臼炮 v1）：参考 19 世纪攻城 / 岸防臼炮——
    // 炮管短粗、越往炮口越粗、炮口厚箍 + 大口径黑洞；炮耳在炮尾，夹在炮耳座里（炮耳座画在炮管前面）；低矮厚重的炮床；
    // 两侧活动大齿轮在 UNDER.mortar（随仰角转）。T1～2 方炮床 + 方炮耳座 → T3～4 台阶炮床 + 加厚炮耳座、一道铁箍 → T5～6 炮床前沿斜切 + 梯形炮耳座、两道铁箍。
    // 耳轴 (24,30)，炮口末端离耳轴 24（blen 24）
    mortar(x, y, o) {
      const T = MORTAR_TIERS[(o.mt || 1) - 1], Z = MORTAR_ZONE[T.bed === 'block' ? 'block' : 'step'];
      const ang = o.a == null ? 55 : o.a, rk = rcPx('mortar', o.k), f = Math.floor(ang / 6) % 4;   // 活动设计：仰角每 6° 换一个对称帧
      PART.gear(x + 10, y + 29, 'L', 3 - f);                                                        // 左齿轮：在最后面
      PART.gear(x + 24, y + 30, 'S', f);                                                            // 炮耳小齿轮
      mortarTube(x + 24, y + 30, ang, rk, T, (o.k || 0) >= 7);
      {   // 传动示意：左齿轮轮毂的曲柄销 → 炮管背面的吊耳（随仰角摆）
        const ar = ang * Math.PI / 180, u = 12 - rk, v = -8.5;
        const lx = Math.round(x + 24 + Math.cos(ar) * u + Math.sin(ar) * v), ly = Math.round(y + 30 - Math.sin(ar) * u + Math.cos(ar) * v);
        line(x + 10, y + 29, lx, ly, 3, P.iron[0]); line(x + 10, y + 29, lx, ly, 1, P.iron[3]);
        disc(lx + 0.5, ly + 0.5, 2, P.brass[0]); disc(lx + 0.5, ly + 0.5, 1.2, P.brass[2]);
        disc(x + 10, y + 29, 2.2, P.brass[0]); disc(x + 10, y + 29, 1.3, P.brass[3]);
      }
      MORTAR_CHEEK[T.cheek](x, y);
      trunnionBolt(x + 24, y + 30);
      PART.gear(x + 38, y + 29, 'L', f);                                                            // 右齿轮：在炮身和炮耳座前面
      MORTAR_BED[T.bed](x, y);                                                                       // 炮床最后画，挡住两只齿轮的下半
      slimVents(x, y, Z.vent.x, Z.vent.y, Z.vent.h, T.vent[0], T.vent[1]);
      if (T.corners) { PART.corner(x + 2, y + 42, 1, -1); PART.corner(x + (T.bed === 'slant' ? 40 : 41), y + 42, -1, -1); }
      if (o.up) {   // 改装：炮床两端立护板，三级前护板加高
        bolted(x + 41, y + (o.up >= 3 ? 22 : 30), 6, o.up >= 3 ? 18 : 10);
        if (o.up >= 2) bolted(x + 1, y + 30, 6, 10);
      }
    },
    mg(x, y, o) {
      housing(x, y, false);
      disc(x + 14, y + 30, 10, P.brass[0]);
      disc(x + 14, y + 30, 9, P.brass[1]);
      disc(x + 13, y + 29, 6, P.brass[2]);
      R(x + 9, y + 22, 4, 1, P.brass[3]); R(x + 7, y + 24, 1, 3, P.brass[3]);
      disc(x + 14, y + 30, 2, P.brass[0]);
      gunShield(x + 43, y + 29, o.up, 11);
      const k = rcPx('mg', o.k), f = o.f || 0;
      // 机匣 + 三管绕 (34,29) 转到仰角；三管轮转：每打一发转一格（亮的那根换位），整组后坐 k 像素
      turn(x + 34, y + 29, o.a, (X, Y) => {
        X += x; Y += y;
        box(X + 28, Y + 15, 13, 27, BRASS);
        for (let i = 0; i < 5; i++) R(X + 31, Y + 19 + i * 4, 7, 1, P.brass[0]);
        [19, 27, 35].forEach((yy, i) => {
          const lit = (i + f) % 3 === 0;
          R(X + 41 - k, Y + yy, 19, 4, P.iron[0]);
          R(X + 41 - k, Y + yy + 1, 19, 2, lit ? P.iron[4] : P.iron[3]);
          R(X + 41 - k, Y + yy + 1, 19, 1, P.iron[4]);
        });
        R(X + 57 - k, Y + 18, 3, 22, P.iron[0]); R(X + 57 - k, Y + 19, 2, 20, P.brass[1]);
        if ((o.k || 0) >= 6) R(X + 60 - k, Y + 26, 3, 4, P.fire[3]);   // 枪口焰
      });
      // 弹鼓下挂的供弹链：逐发前移
      for (let i = 0; i < 6; i++) {
        const bx = x + 4 + ((i * 4 + f) % 24);
        R(bx, y + 41, 3, 4, P.dark[0]); R(bx, y + 41, 2, 3, P.brass[2]); R(bx, y + 41, 2, 1, P.brass[3]);
      }
    },
    // 重炮 3×2（72×48，横躺，镀镍起，2026-09-27 定稿，样机 tools/gun-family-lab.html v5）：参考 19 世纪套箍式攻城 / 岸防重炮——
    // 台阶式炮身（炮尾最粗、直线台阶收细、炮尾钮、炮尾黄铜箍）+ 台阶形铁炮耳架 + 带三个滚轮的铁滑轨；
    // 背景齿轮：巨型 + 大 + 中在炮身后，迷你夹在炮耳架和炮身之间；炮耳架上一根长轴。耳轴 (34,24)，炮口末端 x 76（出框 4px，blen 42）。
    // T4 台阶形炮耳架；T5～6 炮耳架前沿斜切 + 炮身更粗、炮管两道铁箍；铆钉在 OVER.cannon_heavy
    cannon_heavy(x, y, o) {
      const T = heavyTier(o.mt);
      // 齿轮（用户按图排的大小和位置）：巨型 D32 在炮尾后面、大 D20 在右上、中 D14 在炮耳上方——都在炮身后面；
      // 迷你 D8 在炮耳下方，夹在炮耳架前、炮身后
      PART.gear(x + 16, y + 25, 'XXL', 0); PART.gear(x + 26, y + 11, 'L', 1); PART.gear(x + 38, y + 20, 'M', 0);
      box(x + 1, y + 39, 70, 6, IRON); R(x + 2, y + 40, 68, 1, P.iron[4]);                        // 铁滑轨
      for (const wx of [9, 36, 63]) { disc(x + wx, y + 45.5, 2.6, P.dark[0]); disc(x + wx, y + 45.5, 1.6, P.dark[2]); R(x + wx, y + 45, 1, 1, P.brass[2]); }
      steppedPlate(x, y, 12, T.slant ? HEAVY_CHEEK.slant : HEAVY_CHEEK.step, 39);                  // 炮耳架
      PART.gear(x + 32, y + 34, 'XS', 1);
      PART.shaft(x + 14, x + 54, y + 36); PART.collar(x + 22, y + 36); PART.collar(x + 46, y + 36);   // 炮耳架长轴
      gunShield(x + 58, y + 24, o.up, 9);
      const d = rcPx('cannon_heavy', o.k);
      turn(x + 34, y + 24, o.a, (X, Y) => {
        const C = X + x + 34 - d, M = Y + y + 24, H = T.heavy;
        const segs = [[-27, -25, 3], [-25, -24, 2], [-24, -8, H ? 11 : 10], [-8, 8, 9], [8, 18, H ? 8 : 7], [18, 37, H ? 6 : 5], [37, 42, H ? 7 : 6]];
        for (const [a0, a1, hh] of segs) for (let i = C + a0; i < C + a1; i++) {
          R(i, M - hh, 1, hh * 2 + 1, P.iron[0]);
          if (hh > 1) { R(i, M - hh + 1, 1, hh * 2 - 1, P.iron[3]); R(i, M - hh + 1, 1, 1, P.iron[4]); if (hh > 3) { R(i, M - hh + 2, 1, 1, P.iron[4]); R(i, M + hh - 2, 1, 2, P.iron[2]); } }
        }
        segs.forEach(([a0, , hh], k) => { if (k && segs[k - 1][2] > hh) R(C + a0, M - hh + 1, 1, hh * 2 - 1, P.iron[2]); });   // 台阶的阴影面
        R(C - 28, M - 2, 1, 5, P.iron[0]);                                                                                   // 炮尾钮后沿
        const bh = H ? 11 : 10;
        R(C - 12, M - bh, 2, bh * 2 + 1, P.brass[1]); R(C - 12, M - bh, 1, bh * 2 + 1, P.brass[3]);                           // 炮尾黄铜箍
        if (H) for (const hx of [23, 31]) { R(C + hx, M - 7, 2, 15, P.iron[0]); R(C + hx, M - 6, 1, 13, P.iron[4]); }       // 炮管铁箍
        else { R(C + 27, M - 6, 2, 13, P.iron[0]); R(C + 27, M - 5, 1, 11, P.iron[4]); }
        R(C + 41, M - 2, 1, 5, P.black);
        if ((o.k || 0) >= 7) { R(C + 42, M - 5, 4, 11, P.fire[3]); R(C + 46, M - 3, 3, 7, P.fire[2]); }
      });
      disc(x + 34, y + 24, 3.6, P.brass[0]); disc(x + 34, y + 24, 2.6, P.brass[2]); R(x + 33, y + 23, 1, 1, P.brass[3]); R(x + 34, y + 24, 1, 1, P.brass[0]);   // 炮耳
    },
    // 侧炮 2×2（侧挂层，2026-09-27 定稿，样机 tools/gun-family-lab.html）：挂板 + 暗铁悬吊臂 + 吊着的长炮，只画骨架、透出后面的主体模块。
    // T1～2 窄挂板 + 粗方柱、T3～4 方箱挂板 + 双柱横撑、T5～6 斜板挂板 + 实心腹板；炮管同中炮一套，炮口末端在耳轴前 48。
    // 零件只放挂板：上沿铆钉、中右散热口、钢起包角铁、镀镍起左侧小压力表（OVER.side_cannon）
    side_cannon(x, y, o) {
      const T = SIDE_TIERS[(o.mt || 1) - 1], Z = SIDE_ZONE[T.h === 'post' ? 'post' : 'box'];
      SIDE_HANG[T.h](x, y);
      slimVents(x, y, Z.vent.x, Z.vent.y, Z.vent.h, T.vent[0], T.vent[1]);
      if (T.parts.includes('corners')) { PART.corner(x + 3, y + 2, 1, 1); PART.corner(x + (T.h === 'slant' ? 25 : 27), y + 11, -1, -1); }
      gunShield(x + 29, y + 34, o.up, 8);
      const d = rcPx('side_cannon', o.k);
      turn(x + 18, y + 34, o.a, (X, Y) => {
        X += x; Y += y;
        box(X + 8, Y + 27, 19, 14, BRASS); R(X + 10, Y + 29, 1, 10, P.brass[3]);   // 黄铜摇架
        const end = X + 66 - d, b0 = X + 26 - d;
        const tube = (x0, x1, y0, hh) => { R(x0, y0, x1 - x0, hh, P.iron[0]); R(x0, y0 + 1, x1 - x0, hh - 2, P.iron[3]); R(x0, y0 + 1, x1 - x0, 1, P.iron[4]); R(x0, y0 + hh - 2, x1 - x0, 1, P.iron[2]); };
        const band = (hx, y0, hh) => { R(hx, y0, 2, hh, P.brass[1]); R(hx, y0, 1, hh, P.brass[3]); };
        const hoop = (hx, y0, hh) => { R(hx, y0, 2, hh, P.iron[0]); R(hx, y0 + 1, 2, hh - 2, P.iron[2]); R(hx, y0 + 1, 1, hh - 2, P.iron[4]); };
        const brake = (x0, y0, w, hh, n) => { R(x0, y0, w, hh, P.iron[0]); R(x0 + 1, y0 + 1, w - 2, hh - 2, P.iron[3]); R(x0 + 1, y0 + 1, w - 2, 1, P.iron[4]); for (let i = 0; i < n; i++) R(x0 + 2, y0 + 2 + i * 3, w - 4, 1, P.dark[0]); };
        if (T.b === 1) { tube(b0, end - 5, Y + 31, 6); band(b0 + 16, Y + 30, 8); brake(end - 6, Y + 29, 6, 10, 2); }
        else if (T.b === 2) {
          tube(b0, end - 8, Y + 31, 6); tube(b0, b0 + 16, Y + 30, 8); band(b0 + 16, Y + 30, 8);
          R(end - 9, Y + 30, 3, 8, P.iron[0]); R(end - 8, Y + 31, 1, 6, P.iron[3]);
          brake(end - 6, Y + 28, 6, 12, 3);
        } else { tube(b0, end - 6, Y + 30, 8); for (const hb of [4, 14, 24]) hoop(b0 + hb, Y + 29, 10); brake(end - 7, Y + 28, 7, 12, 3); }
        if ((o.k || 0) >= 7) { R(end, Y + 31, 3, 6, P.fire[3]); R(end + 3, Y + 32, 2, 4, P.fire[2]); }
      });
      trunnionBolt(x + 18, y + 34);
    },
    bucket(x, y, o = {}) {
      // 铲斗：装在底盘前方，弧形推土板 + 齿。阶段 ②（史诗起）：斗板加三道黄铜箍、四颗齿、上臂加液压缸
      line(x + 1, y + 12, x + 28, y + 18, 5, P.dark[0]); line(x + 1, y + 12, x + 28, y + 18, 3, P.dark[3]);
      line(x + 1, y + 34, x + 28, y + 34, 5, P.dark[0]); line(x + 1, y + 34, x + 28, y + 34, 3, P.dark[3]);
      box(x + 6, y + 9, 12, 6, IRON);
      for (let yy = 4; yy <= 46; yy++) {
        const t = (yy - 4) / 42, off = Math.round(6 * Math.sin(Math.PI * t));
        const x0 = x + 33 - off;
        R(x0 - 1, y + yy, 8, 1, P.rust[0]);
        R(x0, y + yy, 6, 1, P.rust[2]);
        R(x0, y + yy, 1, 1, P.rust[3]);
        R(x0 + 5, y + yy, 1, 1, P.rust[1]);
      }
      R(x + 28, y + 4, 12, 1, P.rust[3]);
      if ((o.st || 1) === 2) {
        for (const ry of [12, 24, 36]) { const bx0 = x + 32 - Math.round(6 * Math.sin(Math.PI * (ry - 4) / 42)); R(bx0 - 1, y + ry, 9, 2, P.brass[1]); R(bx0 - 1, y + ry, 9, 1, P.brass[3]); }
        line(x + 3, y + 7, x + 18, y + 11, 4, P.brass[0]); line(x + 3, y + 7, x + 18, y + 11, 2, P.brass[2]);   // 液压缸
        line(x + 18, y + 11, x + 27, y + 13, 2, P.iron[4]);
        for (const ty of [22, 30, 37, 43]) { R(x + 38, y + ty, 8, 3, P.iron[0]); R(x + 38, y + ty, 7, 2, P.iron[4]); R(x + 45, y + ty + 1, 2, 1, P.iron[3]); }
        return;
      }
      for (const ry of [12, 24, 36]) rivet(x + 31 - Math.round(6 * Math.sin(Math.PI * (ry - 4) / 42)), y + ry, P.rust[3], P.rust[0]);
      for (const ty of [39, 43]) { R(x + 39, y + ty, 7, 3, P.iron[0]); R(x + 39, y + ty, 6, 2, P.iron[4]); R(x + 45, y + ty + 1, 2, 1, P.iron[3]); }
    },
    spike(x, y, o = {}) {
      // 撞角：锥形尖刺。阶段 ②（史诗起）：螺旋刻槽的钻矛 + 双黄铜箍 + 淬硬的亮钢尖
      box(x, y + 6, 10, 36, IRON);
      rivet(x + 3, y + 10); rivet(x + 3, y + 36);
      box(x + 9, y + 10, 6, 28, BRASS);
      for (let i = 0; i <= 32; i++) {
        const hh = Math.round(13 * (1 - i / 33)), cx = x + 15 + i;
        R(cx, y + 24 - hh, 1, hh * 2 + 1, P.rust[0]);
        if (hh > 0) {
          R(cx, y + 25 - hh, 1, hh, P.rust[2]);
          R(cx, y + 25, 1, hh - 1, P.rust[1]);
          R(cx, y + 25 - hh, 1, 1, P.rust[3]);
        }
        if (i % 7 === 3 && hh > 2) R(cx, y + 25 - hh, 1, hh * 2 - 1, P.rust[1]);
      }
      line(x + 17, y + 17, x + 40, y + 23, 1, P.rust[3]);
      R(x + 47, y + 24, 1, 1, P.iron[4]);
      if ((o.st || 1) === 2) {
        for (let i = 2; i <= 26; i += 5) { const hh = Math.round(13 * (1 - i / 33)); line(x + 15 + i, y + 25 - hh + 1, x + 15 + i + Math.round(hh * 0.5), y + 24 + hh - 1, 1, P.rust[0]); }
        for (let i = 27; i <= 32; i++) { const hh = Math.round(13 * (1 - i / 33)); R(x + 15 + i, y + 25 - hh, 1, Math.max(1, hh * 2 - 1), P.iron[4]); }
        box(x + 13, y + 8, 4, 32, BRASS); R(x + 14, y + 9, 1, 30, P.brass[3]);
      }
    },
    piston(x, y, o) {
      // 蒸汽撞锤：气缸 + 活塞杆 + 锤头。阶段 ②（史诗起）：带散热片的大气缸 + 压力表、双活塞杆、镶钉锤面 + 黄铜包边
      if ((o.st || 1) === 2) {
        box(x, y + 9, 24, 30, IRON);
        for (let fy = 12; fy <= 35; fy += 4) { R(x + 2, y + fy, 20, 1, P.iron[1]); R(x + 2, y + fy + 1, 20, 1, P.iron[4]); }
        disc(x + 12, y + 7, 4, P.brass[0]); disc(x + 12, y + 7, 3, P.brass[2]); disc(x + 12, y + 7, 2, P.steam[2]); R(x + 12, y + 6, 1, 2, P.dark[0]);
        const e = 4 + (o.p || 0) * 5;
        for (const ry of [15, 29]) { R(x + 24, y + ry, e, 4, P.iron[0]); R(x + 24, y + ry + 1, e, 2, P.iron[4]); }
        box(x + 24 + e, y + 5, 12, 38, RUST);
        R(x + 25 + e, y + 5, 10, 1, P.brass[2]); R(x + 25 + e, y + 42, 10, 1, P.brass[1]); R(x + 35 + e, y + 6, 1, 36, P.brass[1]);
        for (const ry of [10, 18, 26, 34]) { disc(x + 31 + e, y + ry, 1.8, P.iron[0]); disc(x + 30.5 + e, y + ry - 0.5, 1.1, P.iron[4]); }
        return;
      }
      box(x, y + 12, 24, 24, IRON);
      R(x + 6, y + 13, 2, 22, P.brass[2]); R(x + 16, y + 13, 2, 22, P.brass[2]);
      disc(x + 12, y + 11, 3, P.brass[1]); disc(x + 12, y + 11, 2, P.brass[2]);
      const e = 4 + (o.p || 0) * 5;
      R(x + 24, y + 21, e, 6, P.iron[0]); R(x + 24, y + 22, e, 4, P.iron[4]); R(x + 24, y + 22, e, 1, P.steam[2]);
      box(x + 24 + e, y + 8, 11, 32, RUST);
      for (const ry of [12, 22, 32]) rivet(x + 27 + e, y + ry, P.rust[3], P.rust[0]);
      for (const ry of [11, 19, 27, 35]) R(x + 34 + e, y + ry, 2, 3, P.iron[3]);
    },
    track(x, y, o) {
      // 一战铆接履带：底板 → 上段履带 → 铆接侧框（A7V 式竖肋）→ 成对负重轮 → 下段履带
      // th = 掉链子（任意一段被毁，整条履带脱落）：链条摊在地上，sn = 被打断的那一段
      // 外观阶段只换侧框、负重轮、诱导轮（骨架、轮位、链轮都不动）：① 竖肋侧框 + 素轮；② 减重孔侧框 + 钢制盘轮；③ 桁架斜撑侧框 + 黄铜轮毂辐条轮
      const L = o.connL, Rr = o.connR, th = o.th, ph = th ? 0 : o.ph || 0, st = o.st || 1;
      // 尾部链轮：履带绕它包一圈；单格履带空间不够，链轮缩小
      const rc = Rr ? 22 : 14;
      const fx0 = x + (L ? 0 : rc), fx1 = x + (Rr ? C : 30);
      floor(x + (L ? 0 : 4), y, o, 5);
      if (!L) R(x + 4, y, 1, 5, P.iron[0]);
      if (!th) links(fx0, Rr ? x + C : x + 40, y + 5, 6, ph, false);
      if (!L && !th) wrapBand(x + rc, y + 26, rc - 2, 20.5, ph);
      R(fx0, y + 11, fx1 - fx0, 21, P.iron[2]);
      R(fx0, y + 11, fx1 - fx0, 1, P.iron[3]);
      R(fx0, y + 31, fx1 - fx0, 1, P.iron[0]);
      if (st === 1) for (let k = fx0 + 6; k < fx1; k += 12) { R(k, y + 13, 1, 17, P.iron[1]); R(k + 1, y + 13, 1, 17, P.iron[3]); }
      else if (st === 2) {
        R(fx0, y + 13, fx1 - fx0, 1, P.iron[1]); R(fx0, y + 29, fx1 - fx0, 1, P.iron[1]);
        for (let k = fx0 + 6; k + 4 < fx1; k += 12) { disc(k + 1, y + 21, 4.4, P.iron[1]); disc(k + 1, y + 21, 3.6, P.dark[1]); R(k - 2, y + 18, 2, 1, P.iron[0]); R(k + 1, y + 24, 3, 1, P.iron[3]); }
      } else {
        R(fx0, y + 11, fx1 - fx0, 1, P.brass[2]);
        for (let k = fx0; k + 12 <= fx1; k += 12) {
          const up = ((k - x) / 12) % 2 === 0;
          line(k + 1, up ? y + 28 : y + 15, k + 11, up ? y + 15 : y + 28, 2, P.iron[1]); line(k + 1, up ? y + 27 : y + 14, k + 11, up ? y + 14 : y + 27, 1, P.iron[3]);
        }
        R(fx0, y + 14, fx1 - fx0, 1, P.iron[3]); R(fx0, y + 28, fx1 - fx0, 1, P.iron[1]);
      }
      for (let k = fx0 + 3; k < fx1 - 1; k += 6) { R(k, y + 14, 1, 1, P.iron[4]); R(k, y + 28, 1, 1, P.iron[4]); }
      // 成对负重轮（Holt 式转向架）：悬挂时每组各自上下（g0 = 前一组 bx 6、g1 = 后一组 bx 30），转向架和侧框之间露出减震柱
      const gd = [th ? 0 : o.g0 || 0, th ? 0 : o.g1 || 0];
      [6, 30].forEach((bx, i) => {
        if (x + bx < fx0 || x + bx + 12 > (Rr ? x + C + 2 : x + 30)) return;
        const d = gd[i];
        if (d > 0) { R(x + bx + 4, y + 32, 6, d, P.dark[0]); for (let k = 0; k < d; k++) R(x + bx + 5, y + 32 + k, 4, 1, k % 2 ? P.dark[2] : P.iron[2]); }   // 伸出来的螺旋弹簧
        R(x + bx, y + 32 + d, 14, 2, P.dark[0]);
        for (const wx of [bx + 3, bx + 11]) {
          const wy = y + 37 + d, wa = ph / 24 * Math.PI * 2 + wx;   // 轮毂上的螺栓 / 辐条跟着行驶相位转
          disc(x + wx, wy, 4.4, P.dark[0]);
          if (st === 1) {
            disc(x + wx, wy, 3.5, P.dark[3]); disc(x + wx, wy, 1.6, P.dark[2]);
            for (const k of [0, Math.PI]) R(Math.round(x + wx - 0.5 + Math.cos(wa + k) * 2), Math.round(y + 36.5 + d + Math.sin(wa + k) * 2), 1, 1, P.iron[3]);
          } else if (st === 2) {
            disc(x + wx, wy, 3.5, P.iron[2]); disc(x + wx - 0.5, wy - 0.5, 2.4, P.iron[3]); disc(x + wx, wy, 1.4, P.iron[1]);
            for (const k of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) R(Math.round(x + wx - 0.5 + Math.cos(wa + k) * 2.4), Math.round(y + 36.5 + d + Math.sin(wa + k) * 2.4), 1, 1, P.iron[4]);
          } else {
            disc(x + wx, wy, 3.5, P.dark[2]);
            for (const k of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) line(x + wx, wy, Math.round(x + wx + Math.cos(wa + k) * 3), Math.round(wy + Math.sin(wa + k) * 3), 1, P.iron[3]);
            disc(x + wx, wy, 1.6, P.brass[2]); R(x + wx - 1, wy - 1, 1, 1, P.brass[3]);
          }
        }
      });
      // 下段履带：一条穿过各组负重轮底部的折线。轮组底下是平的；相邻格的轮组偏移由 gL / gR 传进来，跨格也连成一条；
      // 车尾从链轮包带的底部（固定在车身上）斜下来，车头接上翘段
      if (!th) {
        const xe = Rr ? x + C : x + 26, gL = o.gL || 0, gR = o.gR || 0;
        const pts = [];
        if (L) pts.push([0, gL + (gd[0] - gL) * 0.4]);
        else pts.push([rc, 0]);
        if (L) pts.push([6, gd[0]], [20, gd[0]]);
        if (Rr) pts.push([30, gd[1]], [44, gd[1]], [48, gd[1] + (gR - gd[1]) * 0.4]);
        else pts.push([24, gd[1]], [26, gd[1]]);
        belt(x, fx0, xe, y + 40, polyAt(pts), ph);
      }
      else {
        const cable = (x0, y0, x1, y1) => { line(x0, y0, x1, y1, 5, P.dark[0]); line(x0, y0, x1, y1, 3, P.dark[2]); };
        const xa = L ? x : x + 2, xb = Rr ? x + C : x + 44;
        if (o.sn) {
          // 断口：两截链条，断头翘起
          links(xa, x + 17, y + 42, 5, 3, false); links(x + 31, xb, y + 42, 5, 3, false);
          cable(x + 15, y + 44, x + 20, y + 37); cable(x + 33, y + 44, x + 29, y + 38);
          R(x + 19, y + 36, 2, 2, P.dark[3]); R(x + 28, y + 37, 2, 2, P.dark[3]);
        } else links(xa, xb, y + 42, 5, 3, false);
        if (!L) cable(x + rc - 12, y + 30, x + 3, y + 43);
        if (!Rr) cable(x + 45, y + 22, x + 44, y + 43);
      }
      const hub = st === 3 ? P.brass[2] : P.iron[3];
      if (!L) spokedWheel(x + rc, y + 26, Rr ? 13 : 8, -ph / 24 * Math.PI * 2 / 6, st === 3 ? 8 : 6, hub);
      if (!Rr) {
        // 前端上翘（Mark IV）+ 大辐条诱导轮（雷诺 FT）；掉链后只剩诱导轮
        if (!th) {
          const d1 = o.g1 || 0;   // 上翘段的起点跟着后一组负重轮
          line(x + 24, y + 43 + d1, x + 40, y + 27, 8, P.dark[0]);
          line(x + 24, y + 43 + d1, x + 40, y + 27, 6, P.dark[1]);
          for (let i = 0; i <= 16; i += 4) R(x + 24 + i + 1, y + 43 + Math.round(d1 * (1 - i / 16)) - i - 3, 2, 2, P.dark[3]);
        }
        spokedWheel(x + 36, y + 19, 11, ph / 24 * Math.PI * 2 / 7, [7, 5, 9][st - 1], hub);
        if (st === 2) { disc(x + 36, y + 19, 5, P.iron[1]); disc(x + 36, y + 19, 4, P.iron[3]); disc(x + 36, y + 19, 2, P.iron[1]); }   // 钢制盘轮的轮心
      }
    },
    // 腿式底盘分两层：近侧腿画在车体前；远侧腿压暗、向右上错位，画在整个车体后面 → 伪立体纵深。
    // part: 'far' 只画远侧腿 / 'near' 只画机身 + 近侧腿 / 省略 = 都画（卡片图标用）。bd = 机身随步态下沉的像素
    // 双足 T1 · 工装 Mk.II：箱形梁大腿 + 液压撑杆 + 双支杆小腿 + 带肋平脚（反关节）
    // 真双足 2×4（48×96，tools/chassis-lab.html 的画法）：上两行是带陀螺仪的胯（腰挂位有模块时伸出法兰板压住），
    // 下两行是一对放大的长腿。ga = 步态角档（12 档一圈），sd = 步幅，g2 = [近侧脚, 远侧脚] 的悬挂伸缩，tt = 陀螺转动的时间档
    biped(x, y, o) {
      const LL = SA.LEGLAB, pn = penFor(ctx.canvas);
      LL.bipedArt(pn, x, y, { mv: !!o.mv, a: (o.ga || 0) / 12 * Math.PI * 2, stride: o.sd || 16, bd: o.bd || 0, g: o.g2 || [0, 0],
        legs: BIPED_LOOK[(o.st || 1) - 1], wL: !!o.wL, wR: !!o.wR, phase: (o.ga || 0) * 4, t: (o.tt || 0) / 6 }, o.part || undefined);
      pn.flush(ctx);
    },
    // 四足整件 4×2（96×48，tools/chassis-lab.html 的画法）：一整块蜘蛛甲壳 + 四条腿，后腿往后张、前腿往前张，对角两条同相大步交替。
    // ga = 步态角档（12 档一圈），sd = 步幅（世界像素），g4 = 四只脚的悬挂伸缩 [近后, 近前, 远后, 远前]（战斗 settle() 按 contactPts 算）
    quad(x, y, o) {
      const LL = SA.LEGLAB, pn = penFor(ctx.canvas);
      // 首尾相连的多件四足：相邻两件步态差半圈（像蜈蚣一样一节一节往前传），甲壳连成一片
      const lo = { mv: !!o.mv, a: (o.ga || 0) / 12 * Math.PI * 2 + (o.odd ? Math.PI : 0), stride: o.sd || 12 };
      LL.quadArt(pn, x, y, { ...lo, bd: o.bd || 0, g: o.g4 || [0, 0, 0, 0], top: !!o.top, connL: o.connL, connR: o.connR, look: QUAD_LOOK[(o.st || 1) - 1] }, o.part || undefined);
      pn.flush(ctx);
    },
  };

  // ---------- 缓存：量化参数 → 离屏精灵 ----------
  const cache = new Map();
  const TOP = 16;
  const BOT = 14;   // 精灵底下留的空：悬挂伸长时轮子 / 脚落到格子下面也画得下
  const LEFT = 16;  // 精灵左边留的空：蜘蛛腿往后张的脚伸到格子外面也画得下
  // 四足整件的腿张得很开（脚离机身 ±步幅 + 伸出量），膝盖也高过机身：画布四周多留边
  const PAD = { quad: { l: 56, t: 40, r: 64 }, biped: { l: 48, t: 24, r: 56 } };
  const padOf = (id) => PAD[id] || { l: LEFT, t: TOP, r: 32 };
  const angQ = (a, rest) => Math.round((a == null ? rest : a) / 2) * 2;   // 仰角按 2° 一档缓存
  // 悬挂偏移按整像素缓存；没有偏移就不写进键里（和原来的缓存一致）
  // 腿式底盘（step = 2）按 2px 一档：脚最多差 1px，但光栅腿的缓存命中率高得多
  function gndQ(q, o, step = 1) {
    if (!o.gnd) return;
    const rq = (v) => Math.round((v || 0) / step) * step;
    const a = rq(o.gnd[0]), b = rq(o.gnd[1]), l = rq(o.gL), r = rq(o.gR);
    if (a || b) { q.g0 = a; q.g1 = b; }
    if (l) q.gL = l;
    if (r) q.gR = r;
  }
  function quant(id, o) {
    const q = {};
    switch (id) {
      case 'boiler': { const fl = Math.floor((o.t || 0) * 8 + (o.seed || 0)) % 4; q.fr = fl; q.lv = Math.max(1, Math.min(3, Math.floor(1 + (o.heat || 0) * 2.2 + (fl % 2) * 0.6))); break; }
      case 'water': case 'tank_s': case 'tank_tall': q.lv = Math.round(29 * Math.max(0, Math.min(1, o.water == null ? 1 : o.water))); q.fr = Math.floor((o.t || 0) * 4) % 4; break;
      case 'cockpit': case 'copilot': case 'helmet': q.lv = Math.floor((o.t || 0) * 1.5 + (o.seed || 0)) % 4; break;
      case 'cannon': case 'cannon_m': case 'cannon_s': case 'cannon_heavy': case 'side_cannon': q.k = SA.Dyn.quant(o.recoil, 8); q.a = angQ(o.a, 0); break;
      case 'mortar': q.k = SA.Dyn.quant(o.recoil, 8); q.a = angQ(o.a, 55); break;
      case 'mg': q.k = SA.Dyn.quant(o.recoil, 8); q.f = SA.Dyn.frame(o.feed, 12); q.a = angQ(o.a, 0); break;
      case 'track': q.ph = o.thrown ? 0 : SA.Dyn.frame(o.phase, 24); q.connL = !!o.connL; q.connR = !!o.connR; q.top = !!o.top; q.th = !!o.thrown; q.sn = !!o.snap; gndQ(q, o); break;
      case 'quad': {   // 整件四足：步态角 12 档、步幅 4px 一档、四只脚的悬挂 2px 一档
        const A = o.gait || 0;
        q.mv = !!o.moving; q.ga = q.mv ? ((Math.round(A / (Math.PI * 2 / 12)) % 12) + 12) % 12 : 0; q.sd = Math.round((o.stride || 12) / 2) * 2;
        q.bd = o.bd || 0; q.part = o.part || null; q.top = !!o.top;
        if (o.connL) q.connL = true; if (o.connR) q.connR = true; if ((o.ri || 0) % 2) q.odd = true;
        if (o.g4 && o.g4.some(v => v)) q.g4 = o.g4.map(v => Math.round((v || 0) / 2) * 2);
        break;
      }
      case 'biped': {   // 真双足：步态角 12 档、步幅 4px 一档、两只脚的悬挂 2px 一档、陀螺 6 档 / 秒（6 秒一轮）
        const A = o.gait || 0;
        q.mv = !!o.moving; q.ga = q.mv ? ((Math.round(A / (Math.PI * 2 / 12)) % 12) + 12) % 12 : 0; q.sd = Math.round((o.stride || 16) / 4) * 4;
        q.bd = o.bd || 0; q.part = o.part || null; q.tt = Math.floor((o.t || 0) * 6) % 36;
        if (o.wL) q.wL = true; if (o.wR) q.wR = true;
        if (o.g2 && o.g2.some(v => v)) q.g2 = o.g2.map(v => Math.round((v || 0) / 2) * 2);
        break;
      }
      case 'piston': q.p = Math.round((o.punch || 0) * 3); break;
    }
    if (o.up) q.up = Math.min(3, o.up);   // 改装等级 → 挂件
    if (o.mt > 1) q.mt = o.mt;
    return q;
  }
  // ---------- 材料（2026-09-27 定稿，T1 黄铜到 T6 以太，色值在 palette.js 的 SA.PAL.mat，样机 tools/material-lab.html）----------
  // 金属像素（冷铁 / 暗铁 / 锈钢）按「阶」换成材料自己的颜色，不混色；黄铜饰件、炉火、水、玻璃、皮革、驾驶员保持原色。
  // 在此之上，每种材料最多再加：瓷漆（只刷模块大面的第 2、3 阶，亮边和斜面仍露金属）、描线（离模块外沿 3px 的 1px 线，自动算）、
  // 只改明度一阶的纹理（熟铁麻点、钢花纹板）、反光方式、四角紧固件（自动认出 rivet() 画的铆钉，只换最靠四个角的各一颗）。
  // 全部不发光，所以新模块只要照常画冷铁 + 用 rivet()，六种材料就自动有各自的样子。
  const rgbOf = (hx) => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const k3 = (r, g, b) => (r << 16) | (g << 8) | b;
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  const SRC_PX = new Map();   // 源像素：{ kind: dark | iron | rust, lv }
  P.dark.forEach((h, i) => SRC_PX.set(k3(...rgbOf(h)), { kind: 'dark', lv: i }));
  P.iron.forEach((h, i) => SRC_PX.set(k3(...rgbOf(h)), { kind: 'iron', lv: i }));
  P.rust.forEach((h, i) => SRC_PX.set(k3(...rgbOf(h)), { kind: 'rust', lv: i }));
  const BRASS_PX = new Map(P.brass.map((h, i) => [k3(...rgbOf(h)), i]));
  const KEEP_PX = new Set([...P.brass, ...P.fire, ...P.water, ...P.gauge, ...P.glass, ...P.steam, ...P.leather, ...P.bg, P.white, P.black, P.magenta, ...SOOT_PILOT, ...SOOT_CO].map(h => k3(...rgbOf(h))));
  const IRON_LUM = P.iron.map(h => lum(...rgbOf(h)));
  // 不在调色板里的颜色（旋转贴图的边缘等）：灰的按明度归到最近的冷铁阶，有颜色的保留
  function pxSrc(r, g, b) {
    const k = k3(r, g, b);
    if (SRC_PX.has(k)) return SRC_PX.get(k);
    if (KEEP_PX.has(k)) return null;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0 || (mx - mn) / mx >= 0.28) return null;
    const L = lum(r, g, b); let best = 0;
    IRON_LUM.forEach((v, i) => { if (Math.abs(v - L) < Math.abs(IRON_LUM[best] - L)) best = i; });
    return { kind: 'iron', lv: best };
  }
  // 材料定义转成 RGB，按需缓存
  const matCache = {};
  function matOf(key) {
    const m = SA.PAL.mat && SA.PAL.mat[key];
    if (!m) return null;
    if (!matCache[key]) {
      const toC = (a) => (a ? a.map(rgbOf) : null);
      matCache[key] = { ...m, ironC: toC(m.iron), darkC: toC(m.dark), rustC: toC(m.rust), paintC: toC(m.paint), trimC: toC(m.trim), lineC: m.line ? rgbOf(m.line) : null };
    }
    return matCache[key];
  }
  const mixC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  // 只改明度的纹理：返回 -1 / 0 / +1
  function texAt(tex, lx, ly) {
    if (tex === 'pits') { const h = hash(Math.floor(lx / 4), Math.floor(ly / 4)); return (((lx % 4) + 4) % 4) === h % 4 && (((ly % 4) + 4) % 4) === (h >> 2) % 4 ? (h % 5 === 0 ? 1 : -1) : 0; }
    if (tex === 'checker') { const u = ((lx % 8) + 8) % 8, v = ((ly % 8) + 8) % 8, alt = (Math.floor(lx / 8) + Math.floor(ly / 8)) % 2; return (alt ? (u === v && (u === 3 || u === 4)) : (u + v === 7 && (u === 3 || u === 4))) ? 1 : 0; }
    return 0;
  }
  // 四角紧固件的 2×2 钉头 [左上, 右上, 左下, 右下]
  const PIN_HEAD = {
    bolt: (M) => [M.ironC[4], M.ironC[3], M.ironC[3], M.ironC[1]],
    gold: (M) => (M.trimC ? [M.trimC[3], M.trimC[1], M.trimC[1], M.trimC[0]] : [P.brass[3], P.brass[1], P.brass[1], P.brass[0]].map(rgbOf)),
  };
  // 这些区域里的暗铁色像素不参与材质处理（模块内坐标 [x, y, w, h]）：炉膛里的煤是煤，不是金属；炉栅、炉门照常换材料
  const DECOR_SKIP = { boiler: [[11, 19, 26, 21]] };
  let matPass = null;   // 样机页可以换一套材质处理（setMatPass），游戏里始终是 decorate
  function decorate(cv, mat, ox, oy, skip = []) {
    const M = matOf(mat.key);
    if (!M) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, img = g.getImageData(0, 0, W, H), d = img.data;
    const src = new Array(W * H).fill(null), brass = new Int8Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) {
      if (d[i * 4 + 3] < 8) continue;
      const kk = k3(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (M.trimC && BRASS_PX.has(kk)) { brass[i] = BRASS_PX.get(kk); continue; }
      const c = pxSrc(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
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
      if (c) out[i] = c.kind === 'dark' ? M.darkC[c.lv] : c.kind === 'rust' ? M.rustC[c.lv] : M.ironC[c.lv];
      else if (brass[i] >= 0) out[i] = M.trimC[brass[i]];
    }
    // 描线要知道每个冷铁像素离非金属有多远（4 邻域，算到 5 为止）
    const dist = M.lineC ? new Uint8Array(W * H) : null;
    if (dist) {
      const q = [];
      for (let i = 0; i < W * H; i++) dist[i] = src[i] && src[i].kind === 'iron' ? 255 : 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (dist[i] && (!isM(x - 1, y) || !isM(x + 1, y) || !isM(x, y - 1) || !isM(x, y + 1))) { dist[i] = 1; q.push(i); } }
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % W, y = Math.floor(i / W); if (dist[i] >= 5) continue;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (dist[j] === 255) { dist[j] = dist[i] + 1; q.push(j); } }
      }
    }
    const flat = (x, y) => isM(x - 1, y) && isM(x + 1, y) && isM(x, y - 1) && isM(x, y + 1) && isM(x - 1, y - 1) && isM(x + 1, y + 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = src[i]; if (!c || c.kind !== 'iron') continue;
      const lx = x - ox, ly = y - oy, face = c.lv === 2 || c.lv === 3, fl = flat(x, y);
      if (M.spec === 'matte' && c.lv === 4) out[i] = M.ironC[3];   // 哑光：亮边压一阶
      else if (M.spec === 'crisp' && c.lv === 4 && !isM(x, y - 1) && !isM(x - 1, y)) out[i] = mixC(M.ironC[4], [255, 255, 255], 0.45);   // 受光角一个亮点
      else if (M.spec === 'soft' && c.lv === 4 && (lx + ly) % 2) out[i] = mixC(M.ironC[3], M.ironC[4], 0.5);   // 柔和：亮边隔一个像素压半阶
      if (M.paintC && face) out[i] = M.paintC[c.lv];
      else if (M.tex && face && fl) { const t = texAt(M.tex, lx, ly); if (t) out[i] = M.ironC[Math.max(0, Math.min(4, c.lv + t))]; }
      if (dist && face && fl && dist[i] === 3) out[i] = M.lineC;
    }
    if (PIN_HEAD[M.pin]) {
      const found = [];
      for (let y = 0; y < H - 2; y++) for (let x = 0; x < W - 2; x++) {
        const a = lvAt(x, y);
        if (a < 3 || lvAt(x + 1, y) !== a || lvAt(x, y + 1) !== a || lvAt(x + 1, y + 1) !== 2 || lvAt(x + 2, y + 1) !== 0) continue;
        found.push([x, y]);
      }
      let use = found;
      if (found.length > 4) {
        const xs = found.map(p => p[0]), ys = found.map(p => p[1]), pickd = new Set();
        for (const ax of [Math.min(...xs), Math.max(...xs)]) for (const ay of [Math.min(...ys), Math.max(...ys)]) {
          let best = 0, bd = 1e9; found.forEach((p, k) => { const dd = (p[0] - ax) ** 2 + (p[1] - ay) ** 2; if (dd < bd) { bd = dd; best = k; } }); pickd.add(best);
        }
        use = [...pickd].map(k => found[k]);
      }
      const col = PIN_HEAD[M.pin](M);
      for (const [x, y] of use) [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], k) => { out[(y + b) * W + x + a] = col[k]; });
    }
    for (let i = 0; i < W * H; i++) { const c = out[i]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
    g.putImageData(img, 0, 0);
  }
  // 外观接口：DRAW[id](x, y, q) 在 (x, y) 画一个占 f.w × f.h 子格的模块；q 是 quant() 量化后的状态，
  // 另外带 q.st = 外观阶段（1~3，按材料算，见 SA.stageOf；只有一个造型的模块永远是 1，不写进 q）。
  // 画布按占格放大：右边留 32px 给伸出去的炮管，左边留 LEFT 给往后张的腿，上面留 TOP 给抬起的炮管，下面留 BOT 给伸长的悬挂
  function sprite(id, q, f = { w: 2, h: 2 }) {
    const key = id + JSON.stringify(q);
    let cv = cache.get(key);
    if (!cv) {
      if (cache.size > 800) cache.clear();
      cv = document.createElement('canvas');
      const pd = padOf(id);
      cv.width = f.w * S + pd.r + pd.l; cv.height = f.h * S + pd.t + BOT;
      cv.ox = pd.l; cv.oy = pd.t;
      ctx = cv.getContext('2d');
      DRAW[id](pd.l, pd.t, q);
      attach(id, q, f, pd.l, pd.t);
      (matPass || decorate)(cv, SA.MATS[q.mt || 1], pd.l, pd.t, DECOR_SKIP[id]);   // 每个材料（包括 T1 黄铜）都按 SA.PAL.mat 处理
      if (OVER[id]) { ctx = cv.getContext('2d'); OVER[id](pd.l, pd.t, q); }        // 身份件（铆钉、铭牌、压力表）最后画，颜色不被材质换掉
      if (UNDER[id]) { ctx = cv.getContext('2d'); ctx.globalCompositeOperation = 'destination-over'; UNDER[id](pd.l, pd.t, q); ctx.globalCompositeOperation = 'source-over'; }   // 背景齿轮：垫在最后面
      cache.set(key, cv);
    }
    return cv;
  }
  // 模块的精灵：量化状态 + 外观阶段。art 字段 = 暂时借用别的（2×2）模块的画
  function modSprite(id, o) {
    const m = SA.MODULES[id], art = m.art || id, q = quant(art, o), st = SA.stageOf(id, o.mt || 1);
    if (st > 1) q.st = st;
    return sprite(art, q, m.art ? { w: 2, h: 2 } : SA.fp(id));
  }
  // 尚无专用美术的模块先画成带中文名称的功能占位，避免借用精灵让玩家误认模块。
  // 占位仍使用材料色边框，尺寸严格按 24px 子格，后续替换 DRAW 不会影响布局和数值。
  function placeholderModule(c2d, id, x, y, o = {}) {
    const f = SA.fp(id), w = f.w * S, h = f.h * S, mat = SA.MATS[o.mt || 1];
    c2d.save();
    c2d.fillStyle = '#18232b'; c2d.fillRect(x, y, w, h);
    c2d.strokeStyle = mat.chip; c2d.lineWidth = 2; c2d.strokeRect(x + 1, y + 1, w - 2, h - 2);
    let fs = Math.min(12, Math.max(7, Math.floor(Math.min(w, h) * 0.34))), label = SA.MODULES[id].placeholder;
    c2d.font = `bold ${fs}px sans-serif`;
    while (fs > 7 && c2d.measureText(label).width > w - 4) { fs--; c2d.font = `bold ${fs}px sans-serif`; }
    c2d.fillStyle = '#f2f4f7'; c2d.textAlign = 'center'; c2d.textBaseline = 'middle';
    c2d.fillText(label, x + w / 2, y + h / 2);
    c2d.restore();
  }
  // 有自己画的模块按原生大小贴；借用大模块精灵的小模块（1×1、1×2）暂时缩小画，以后再重画
  function drawModule(c2d, id, x, y, o = {}) {
    if (SA.MODULES[id].placeholder) { placeholderModule(c2d, id, x, y, o); ctx = c2d; return; }
    const f = SA.fp(id), img = modSprite(id, o);
    if (!SA.MODULES[id].art || (f.w === 2 && f.h === 2)) c2d.drawImage(img, x - img.ox, y - img.oy);
    else c2d.drawImage(img, img.ox, img.oy, C, C, x, y, f.w * S, f.h * S);
    ctx = c2d;
  }
  // 按 48px 设计的叠加层（裂纹、残骸）缩放到模块的实际大小
  function scaled(g, x, y, id, fn) {
    const f = SA.fp(id);
    if (f.w === 2 && f.h === 2) { fn(x, y); return; }
    g.save(); g.translate(x, y); g.scale(f.w / 2, f.h / 2); fn(0, 0); g.restore(); ctx = g;
  }

  // 通用受损叠加层
  function damage(x, y, frac, seed) {
    if (frac > 0.66) return;
    const s = (seed * 7) % 5;
    line(x + 27 + (s % 4), y + 6, x + 21, y + 19, 1, P.black);
    line(x + 21, y + 19, x + 28, y + 30, 1, P.black);
    line(x + 21, y + 19, x + 13, y + 22, 1, P.black);
    if (frac <= 0.33) {
      line(x + 8, y + 39, x + 16 + (s % 3), y + 28, 1, P.black);
      line(x + 33, y + 36, x + 40, y + 42, 1, P.black);
      ctx.fillStyle = 'rgba(7,8,12,0.4)';
      ctx.fillRect(x + 6 + s, y + 9, 10, 7);
      ctx.fillRect(x + 24, y + 31 - (s % 3), 13, 7);
    }
  }

  // 被毁舱位：框架还在，舱内烧空
  function wreck(x, y) {
    R(x + 3, y + 3, 42, 42, P.dark[0]);
    R(x + 4, y + 4, 40, 40, P.dark[1]);
    line(x + 6, y + 40, x + 18, y + 21, 3, P.iron[1]);
    line(x + 18, y + 21, x + 26, y + 29, 3, P.iron[1]);
    line(x + 30, y + 12, x + 41, y + 24, 1, P.iron[2]);
    R(x + 9, y + 9, 6, 3, P.dark[2]); R(x + 33, y + 36, 8, 4, P.dark[2]);
  }

  function blockedMark(x, y) {
    disc(x, y, 8, P.black);
    disc(x, y, 7, P.white);
    disc(x, y, 5, P.black);
    line(x - 4, y + 3, x + 3, y - 4, 2, P.white);
  }

  // ---------- 车体框架：把所有舱位连成一台机器 ----------
  // 按子格画：同一个模块内部不画缝，相邻两个模块之间打铆钉，露在外面的边描黑
  function hull(O, cx, cy) {
    const solid = (o) => o && !SA.isRam(o.cell.id) && SA.MODULES[o.cell.id].layer !== 'chassis';   // 双足的胯在车身行里，但不算车体框架
    const at = (r, c) => (r >= 0 && r < K.ROWS - 2 && c >= 0 && c < K.COLS ? O[r][c] : null);
    const body = (fn) => { for (let r = 0; r < K.ROWS - 2; r++) for (let c = 0; c < K.COLS; c++) if (solid(O[r][c])) fn(r, c, cx(c), cy(r), O[r][c]); };
    body((r, c, x, y) => R(x, y, S, S, P.iron[1]));
    body((r, c, x, y, o) => {
      const rt = at(r, c + 1), dn = at(r + 1, c);
      if (solid(rt) && rt !== o) for (const yy of [6, 16]) rivet(x + S - 2, y + yy, P.iron[3]);
      if (solid(dn) && dn !== o) for (const xx of [6, 16]) rivet(x + xx, y + S - 2, P.iron[3]);
    });
    body((r, c, x, y) => {
      if (!solid(at(r - 1, c))) { R(x, y, S, 1, P.iron[0]); R(x + 1, y + 1, S - 1, 1, P.iron[3]); }
      if (!solid(at(r, c - 1))) { R(x, y, 1, S, P.iron[0]); R(x + 1, y + 1, 1, S - 1, P.iron[2]); }
      if (!solid(at(r, c + 1))) R(x + S - 1, y, 1, S, P.iron[0]);
      if (!solid(at(r + 1, c))) R(x, y + S - 1, S, 1, P.iron[0]);
    });
  }

  // ---------- 整车渲染 ----------
  const pool = {};
  function vehCanvas(key) {
    if (!pool[key]) {
      pool[key] = document.createElement('canvas');
      pool[key].width = K.COLS * S + PADX * 2;
      pool[key].height = K.ROWS * S + BOT;   // 底下留边给伸长的悬挂
    }
    return pool[key];
  }

  // 双足远侧腿单独画在一层上（同尺寸），再垫到车体下面
  const farLayers = new Map();
  function farLayer(cv) {
    let f = farLayers.get(cv);
    if (!f) { f = document.createElement('canvas'); farLayers.set(cv, f); }
    if (f.width !== cv.width || f.height !== cv.height) { f.width = cv.width; f.height = cv.height; }
    return f;
  }
  function renderVehicle(veh, o = {}) {
    const cv = vehCanvas(o.key || 'default');
    const g = cv.getContext('2d');
    ctx = g;
    g.clearRect(0, 0, cv.width, cv.height);
    const t = o.t || 0;
    const blocked = o.blocked || [];
    const isBlocked = (r, c) => blocked.some(b => b.r === r && b.c === c);
    const cx = (c) => PADX + c * S, cy = (r) => r * S;
    const O = SA.V.occ(veh, 'body');
    // 底盘锚点行：履带 / 四足在倒数第二行，真双足 2×4 在倒数第四行
    const CH = SA.V && SA.V.chassisRowOf ? SA.V.chassisRowOf(veh) : K.ROWS - 2;

    // 底盘行：履带任意一段被毁 → 整条掉链；腿式底盘的步态决定机身下沉量 bd
    const base = veh.body[CH];
    const thrown = base.some(x => x && x.id === 'track' && x.hp <= 0);
    const amp = base.some(x => x && x.id === 'track') ? 0 : Math.max(0, ...base.map(x => (x && x.hp > 0 && BOB[x.id]) || 0));
    const dyn = o.dyn || null;   // SA.Dyn.animator：战斗里提供行驶相位、后坐、供弹；改装台 / 预览不传就是静止
    const phase = dyn ? dyn.phase : (o.phase || 0);
    // 整件四足：dyn.phase 是步态角（战斗里按走过的距离 ÷ (4 × 步幅) 推进一圈），步幅跟着车速变；机身起伏按 quadBob
    const hasQuad = base.some(x => x && x.id === 'quad' && x.hp > 0), bipC = base.findIndex(x => x && x.id === 'biped'), hasBiped = bipC >= 0 && base[bipC].hp > 0;
    const stride = (hasQuad ? SA.LEGLAB.quadStride : SA.LEGLAB.strideFor)(o.speed || 0), gaitA = Math.round(phase / (Math.PI * 2 / 12)) * (Math.PI * 2 / 12);
    const bd = hasQuad ? SA.LEGLAB.quadBob({ mv: !!o.moving, a: gaitA, stride: Math.round(stride / 4) * 4 })
      : hasBiped ? SA.LEGLAB.bipedBob({ mv: !!o.moving, a: gaitA, stride: Math.round(stride / 4) * 4 })
      : amp - Math.round(Math.abs(Math.sin((o.moving ? gfOf(phase) : 0) / 12 * Math.PI * 2)) * amp);
    const isChassis = (id) => SA.MODULES[id].layer === 'chassis';
    const dy = (id, r) => (isChassis(id) ? 0 : bd);   // 底盘自己处理下沉，其余整体随之起伏
    // 双足的腰挂位（胯层左右各一大格）上有没有模块：有就让胯伸出法兰板压住
    const waist = (c0) => { for (let r = CH; r < CH + 2; r++) for (let c = c0; c < c0 + 2; c++) { const x = c >= 0 && c < K.COLS && O[r][c]; if (x && x.cell.id !== 'biped') return true; } return false; };

    const modOpts = (cell, r, c) => {
      const m = SA.MODULES[cell.id];
      const row = veh.body[r], w = SA.fp(cell.id).w;
      const same = (k) => k >= 0 && k < K.COLS && row[k] && row[k].id === cell.id;
      // 正上方紧贴着（非撞击件的）模块：底盘据此画出承托
      let above = null;
      if (r > 0) for (let k = c; k < c + w; k++) { const a = O[r - 1][k]; if (a && !SA.isRam(a.cell.id)) above = a.cell; }
      return {
        t, heat: o.heat || 0, water: o.water, moving: o.moving, seed: r * 3 + c, bd, mt: cell.mt, up: cell.lv || 0,
        gnd: o.gnd && m.layer === 'chassis' ? o.gnd[`${r},${c}`] || [0, 0] : null,   // 悬挂：每格两个接地点各自上下（像素，正 = 往下伸）
        gL: o.gnd && same(c - w) && o.gnd[`${r},${c - w}`] ? o.gnd[`${r},${c - w}`][1] : 0,   // 左右相邻同类底盘靠近本格的那个接地点（履带连成一条）
        gR: o.gnd && same(c + w) && o.gnd[`${r},${c + w}`] ? o.gnd[`${r},${c + w}`][0] : 0,
        recoil: dyn ? dyn.recoilOf(`${r},${c},${m.layer === 'side' ? 's' : 'b'}`) : 0,
        feed: dyn ? dyn.feedOf(`${r},${c},${m.layer === 'side' ? 's' : 'b'}`) : 0,
        a: o.elev ? o.elev[`${r},${c},${m.layer === 'side' ? 's' : 'b'}`] : undefined,   // 炮管仰角（度）：战斗里跟着鼠标转
        punch: o.punch ? (o.punch[`${r},${c}`] || 0) : 0,
        phase, gait: phase, stride,
        g4: cell.id === 'quad' && o.gnd ? o.gnd[`${r},${c}`] || null : null,
        g2: cell.id === 'biped' && o.gnd ? o.gnd[`${r},${c}`] || null : null,
        wL: cell.id === 'biped' && waist(c - 2), wR: cell.id === 'biped' && waist(c + 2),
        connL: same(c - w),
        connR: same(c + w),
        ...run(row, c),
        top: !!(above && !SA.isRam(above.id)),
        thrown, snap: cell.id === 'track' && cell.hp <= 0,
      };
    };
    // 同类底盘连续段：本格在段内的序号与段长（腿按整段分配）
    const run = (row, c) => {
      const id = row[c].id, w = SA.fp(id).w;
      let a0 = c, a1 = c;
      while (a0 - w >= 0 && row[a0 - w] && row[a0 - w].id === id) a0 -= w;
      while (a1 + w < K.COLS && row[a1 + w] && row[a1 + w].id === id) a1 += w;
      return { ri: (c - a0) / w, rn: (a1 - a0) / w + 1 };
    };
    // 被毁的底盘/撞击件：压暗 + 裂纹，不画成半透明虚影
    const dead = (fn) => { g.save(); g.filter = 'brightness(0.45)'; fn(); g.restore(); ctx = g; };

    // 远侧腿：在整个车体之前画，被车体遮住一部分
    base.forEach((cell, c) => {
      if (!cell || !BOB[cell.id] || cell.id === 'biped') return;
      const r = CH, draw = () => { g.save(); if (cell.id === 'quad' && o.ghostLegs) g.globalAlpha = 0.35; drawModule(g, cell.id, cx(c), cy(r), { ...modOpts(cell, r, c), part: 'far' }); g.restore(); ctx = g; };
      if (cell.hp > 0) draw(); else dead(draw);
    });
    g.save(); g.translate(0, bd); hull(O, cx, cy); g.restore(); ctx = g;
    // 主体层：底盘/撞击 → 其他 → 武器（炮管压在相邻格上，被挡时一眼可见）
    // 整件四足（pass 3）：甲壳和近侧腿压在整个车身前面（同 tools/chassis-lab.html），膝盖高过机身也不会被模块挡住
    // 撞击件（pass 4）画在四足的腿前面，装在车头的铲斗、撞角不会被腿挡住。
    // o.ghostLegs（改装台正在摆放 / 拖动模块时）：四足的腿画成半透明，看得清底盘两侧的格子
    const order = (id) => (SA.isRam(id) ? 4 : id === 'quad' || id === 'biped' ? 3 : SA.isWeapon(id) ? 2 : isChassis(id) ? 0 : 1);
    for (const pass of [0, 1, 2, 3, 4]) {
      // 真双足：躯干画完（pass 3 之前）把露在外面的角切成斜角，再把远侧腿垫到最底下（destination-over），切角不会切到腿
      if (pass === 3 && bipC >= 0) {
        g.save(); g.translate(0, bd); SA.LEGLAB.torsoCuts(g, veh, bipC, PADX); g.restore();
        const fl = farLayer(cv), cell = base[bipC], fg = fl.getContext('2d');
        fg.clearRect(0, 0, fl.width, fl.height);
        fg.save(); if (o.ghostLegs) fg.globalAlpha = 0.35; if (cell.hp <= 0) fg.filter = 'brightness(0.45)';
        drawModule(fg, 'biped', cx(bipC), cy(CH), { ...modOpts(cell, CH, bipC), part: 'far' });
        fg.restore();
        g.save(); g.globalCompositeOperation = 'destination-over'; g.drawImage(fl, 0, 0); g.restore(); ctx = g;
      }
      eachCell(veh.body, (cell, r, c) => {
        if (order(cell.id) !== pass) return;
        const x = cx(c), y = cy(r) + dy(cell.id, r);
        const mo = { ...modOpts(cell, r, c), part: 'near' };
        const f = SA.fp(cell.id);
        if (cell.hp <= 0) {
          ctx = g;
          if (cell.id === 'track') { drawModule(g, cell.id, x, y, mo); scaled(g, x, y, cell.id, (xx, yy) => damage(xx, yy, 0, r * 8 + c)); }
          else if (cell.id === 'quad' || cell.id === 'biped') dead(() => drawModule(g, cell.id, x, y, mo));
          else if (isChassis(cell.id) || SA.isRam(cell.id)) { dead(() => drawModule(g, cell.id, x, y, mo)); scaled(g, x, y, cell.id, (xx, yy) => damage(xx, yy, 0, r * 8 + c)); }
          else scaled(g, x, y, cell.id, wreck);
          return;
        }
        if ((cell.id === 'quad' || cell.id === 'biped') && o.ghostLegs) {
          drawModule(g, cell.id, x, y, { ...mo, part: 'shell' });
          g.save(); g.globalAlpha = 0.35; drawModule(g, cell.id, x, y, { ...mo, part: 'legs' }); g.restore(); ctx = g;
        } else drawModule(g, cell.id, x, y, mo);
        if (cell.id !== 'quad' && cell.id !== 'biped') scaled(g, x, y, cell.id, (xx, yy) => damage(xx, yy, cell.hp / (cell.max || SA.mod(cell).hp), r * 8 + c));   // 四足的格子大半是腿间空地，裂纹会画在空中
        if (o.showBlocked && isBlocked(r, c)) blockedMark(x + f.w * S + 12, y + f.h * S - 21);
      });
    }
    if (o.dimBody) { g.fillStyle = 'rgba(7,8,12,0.55)'; g.fillRect(0, 0, cv.width, cv.height); }
    if (o.dimCell) { const dc = veh.body[o.dimCell.r][o.dimCell.c], f = dc ? SA.fp(dc.id) : { w: 2, h: 2 }; g.fillStyle = 'rgba(7,8,12,0.55)'; g.fillRect(cx(o.dimCell.c), cy(o.dimCell.r) + bd, f.w * S, f.h * S); }

    // 侧挂层：硬阴影 + 本体，明确“在另一个平面”
    eachCell(veh.side, (cell, r, c) => {
      if (cell.hp <= 0) return;
      const img = modSprite(cell.id, modOpts(cell, r, c));
      g.save();
      g.globalAlpha = o.dimSide ? 0.35 : 1;
      g.filter = 'brightness(0) opacity(0.55)';
      g.drawImage(img, cx(c) + 3 - img.ox, cy(r) + 3 + bd - img.oy);
      g.filter = 'none';
      g.drawImage(img, cx(c) - img.ox, cy(r) + bd - img.oy);
      g.restore();
      ctx = g;
      scaled(g, cx(c), cy(r) + bd, cell.id, (xx, yy) => damage(xx, yy, cell.hp / (cell.max || SA.mod(cell).hp), r * 8 + c + 3));
    });
    ctx = g;
    return cv;
  }

  function eachCell(grid, fn) {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++)
        if (grid[r][c]) fn(grid[r][c], r, c);
  }

  // ---------- 高亮描边：白芯黑边（主体）/ 洋红（侧挂）----------
  function outline(c2d, x, y, w, h, inner, outer, dash) {
    ctx = c2d;
    if (dash != null) {
      const per = 2 * (w + h) + 4;
      for (let i = 0; i < per; i++) {
        const col = ((i + dash) >> 2) % 2 === 0 ? inner : outer;
        let px, py;
        if (i < w + 2) { px = x - 1 + i; py = y - 1; }
        else if (i < w + h + 3) { px = x + w; py = y - 1 + (i - w - 2); }
        else if (i < 2 * w + h + 4) { px = x + w - (i - w - h - 3); py = y + h; }
        else { px = x - 1; py = y + h - (i - 2 * w - h - 4); }
        R(px, py, 2, 2, col);
      }
      return;
    }
    R(x - 3, y - 3, w + 6, 1, outer); R(x - 3, y + h + 2, w + 6, 1, outer);
    R(x - 3, y - 3, 1, h + 6, outer); R(x + w + 2, y - 3, 1, h + 6, outer);
    R(x - 2, y - 2, w + 4, 2, inner); R(x - 2, y + h, w + 4, 2, inner);
    R(x - 2, y - 2, 2, h + 4, inner); R(x + w, y - 2, 2, h + 4, inner);
  }

  // ---------- 改装军衔杠：lv 条实心黄铜 V 字，其余空槽（最多 max 条），画在格子左上角 ----------
  function chevrons(c2d, x, y, lv, max = 3) {
    ctx = c2d;
    R(x + 2, y + 2, 16, 5 + max * 6, 'rgba(7,8,12,0.75)');
    for (let i = 0; i < max; i++) {
      const on = i < lv, yy = y + 4 + (max - 1 - i) * 6;
      const col = on ? P.brass[3] : P.iron[1], edge = on ? P.brass[0] : P.dark[0];
      // V 字：左右两条斜杠，3 像素厚
      for (let k = 0; k < 6; k++) {
        R(x + 4 + k, yy + Math.floor(k / 2), 2, 3, edge); R(x + 16 - k - 2, yy + Math.floor(k / 2), 2, 3, edge);
      }
      for (let k = 0; k < 6; k++) {
        R(x + 4 + k, yy + Math.floor(k / 2), 1, 2, col); R(x + 16 - k - 1, yy + Math.floor(k / 2), 1, 2, col);
      }
    }
  }

  // ---------- UI 图标（9×9，顶栏导航等）----------
  const ICONS = {
    coin: ['..#####..', '.#.....#.', '#...##..#', '#..#....#', '#.####..#', '#..#....#', '#.#####.#', '.#.....#.', '..#####..'],
    wrench: ['......##.', '.....#..#', '......#.#', '.....####', '....##...', '...##....', '..##.....', '.##......', '##.......'],
    gear: ['...###...', '.#.###.#.', '..#####..', '####.####', '###...###', '####.####', '..#####..', '.#.###.#.', '...###...'],
    scroll: ['.#######.', '#.#.....#', '.##.###.#', '..#.....#', '..#.###.#', '..#.....#', '..#.###.#', '..#.....#', '..######.'],
    trophy: ['#########', '#.#####.#', '#.#####.#', '.#.###.#.', '...###...', '....#....', '....#....', '..#####..', '..#####..'],
    dice: ['#########', '#.......#', '#.#...#.#', '#.......#', '#...#...#', '#.......#', '#.#...#.#', '#.......#', '#########'],
    swords: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '.##...##.', '.##...##.', '#.......#'],
    cloud: ['.........', '...###...', '..#####..', '.#######.', '#########', '#########', '.#######.', '.........', '.........'],
    back: ['...#.....', '..##.....', '.########', '#########', '.########', '..##.....', '...#.....', '.........', '.........'],
    flag: ['##.......', '#####....', '#######..', '#####....', '##.......', '#........', '#........', '#........', '##.......'],
    eye: ['.........', '..#####..', '.#.....#.', '#..###..#', '#..###..#', '.#.....#.', '..#####..', '.........', '.........'],
  };
  const bits = (rows, x, y, c, s = 1) => {
    ctx.fillStyle = c;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i * s, y + j * s, s, s); });
  };

  function iconCanvas(name, color, scale = 3) {
    const cv = document.createElement('canvas');
    cv.width = 9; cv.height = 9;
    ctx = cv.getContext('2d');
    bits(ICONS[name], 0, 0, color);
    cv.style.width = cv.style.height = `${9 * scale}px`;
    cv.className = 'px';
    return cv;
  }

  // 模块卡片预览（含炮管伸出），主体模块带一圈车体框架
  function moduleCanvas(id, scale = 1, mt = 1) {
    // 整件四足的腿往前后张、膝盖高过机身：卡片左右上都多留一点，整只蜘蛛都画得进去
    const ex = id === 'quad' ? { l: 24, t: 18, r: 0 } : id === 'biped' ? { l: 24, t: 4, r: 16 } : { l: 0, t: 0, r: 0 };
    const f = SA.fp(id), fw = f.w * S, fh = f.h * S, W = Math.max(C, fw) + 32 + ex.l + ex.r, H = Math.max(C, fh) + 4 + ex.t, oy = H - 2 - fh, ox = 2 + ex.l;   // 小模块按实际大小画，底边对齐
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    ctx = g;
    if (SA.MODULES[id].layer === 'body') { R(ox, oy, fw, fh, P.iron[1]); R(ox, oy, fw, 1, P.iron[0]); R(ox, oy, 1, fh, P.iron[0]); R(ox + fw - 1, oy, 1, fh, P.iron[0]); R(ox, oy + fh - 1, fw, 1, P.iron[0]); }
    drawModule(g, id, ox, oy, { heat: 0.5, water: 0.7, t: 0, mt });
    cv.style.width = `${W * scale}px`; cv.style.height = `${H * scale}px`;
    cv.className = 'px';
    return cv;
  }

  // ---------- 3×5 像素字（伤害数字）----------
  const FONT = {
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['###', '..#', '###', '#..', '###'], '3': ['###', '..#', '.##', '..#', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
    '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'],
    'M': ['#.#', '###', '###', '#.#', '#.#'], 'I': ['###', '.#.', '.#.', '.#.', '###'],
    'S': ['###', '#..', '###', '..#', '###'], '-': ['...', '...', '###', '...', '...'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  };
  function text(c2d, str, x, y, color, s = 3) {
    ctx = c2d;
    let cx = Math.round(x - (str.length * 4 * s - s) / 2);
    for (const ch of str) {
      const g = FONT[ch];
      if (g) { bits(g, cx + s, y + s, P.black, s); bits(g, cx, y, color, s); }
      cx += 4 * s;
    }
  }

  return {
    PADX, drawModule, renderVehicle, outline, iconCanvas, moduleCanvas, text, chevrons, decorate,
    setMatPass: (fn) => { matPass = fn || null; cache.clear(); },
    useCtx: (c) => { ctx = c; }, R: (...a) => R(...a), disc: (...a) => disc(...a), line: (...a) => line(...a),
  };
})();
