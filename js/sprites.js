// 程序化像素精灵（48px 格）。不再用角标图标：每个模块靠自身造型一眼可辨。
// 驾驶舱 = 黄铜拱门剖面 + Q 版护目镜驾驶员；水箱 = 带水位的方块；锅炉 = 铁栅栏后闷燃的煤；
// 直射炮 = 水平长管；高抛炮 = 朝天粗管；撞击武器 = 锈钢铲斗/撞角/撞锤；履带 = 一战铆接履带框架。
window.SA = window.SA || {};

SA.SPR = (() => {
  const P = SA.PAL, K = SA.K, C = K.CELL;
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
  function spokedWheel(cx, cy, r, ph, spokes) {
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
    disc(cx, cy, 2.4, P.iron[3]);
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
  // 腿的两层配色与错位：远侧更暗、向右上偏移
  const LEG = {
    near: { o: P.dark[0], f: P.dark[3], j: P.iron[3], jl: P.iron[4], pis: P.steam[2], foot: [P.dark[0], P.dark[1], P.dark[2], P.dark[3]], dx: 0, dy: 0 },
    far: { o: P.black, f: P.dark[2], j: P.iron[1], jl: P.iron[2], pis: P.steam[0], foot: [P.black, P.dark[0], P.dark[1], P.dark[2]], dx: 2, dy: -3, far: true },
  };
  const walk = (o) => ({ a: (o.gf || 0) / 12 * Math.PI * 2, mv: !!o.mv, bd: o.bd || 0 });
  // 腿式底盘的横梁：相邻同类格子连成一根，不画中间的接缝
  function beam(x0, x1, yy, hh, o) {
    box(x0, yy, x1 - x0, hh, DARK);
    if (o.connL) R(x0, yy + 1, 2, hh - 2, P.dark[2]);
    if (o.connR) R(x1 - 2, yy + 1, 2, hh - 3, P.dark[2]);
  }
  // 两段腿 IK，膝盖朝后（-x）
  function ik(hx, hy, fx, fy, L1, L2) {
    const dx = fx - hx, dy = fy - hy, d = Math.max(1, Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01));
    const t = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const ang = Math.atan2(dy, dx) + t;
    return [Math.round(hx + Math.cos(ang) * L1), Math.round(hy + Math.sin(ang) * L1)];
  }
  // 机身起伏幅度：双足大、四足小；混有履带就不起伏
  const BOB = { biped: 3, quad: 1 };
  const gfOf = (phase) => SA.Dyn.frame(phase, 12, 5);   // 腿的步态帧：每走 5px 换一帧，12 帧一循环
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
  const SOOT_CO = ['#1c1318', '#4a3040', '#8a6078'];        // 副驾驶：暖棕紫炭球

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
      // 剖面：黄铜拱门框 + 空洞舱室 + Q 版小黑炭球驾驶员
      box(x + 3, y + 3, 42, 42, IRON);
      arch(x + 24, y + 5, y + 44, 18, P.brass[0]);
      arch(x + 24, y + 6, y + 43, 17, P.brass[2]);
      arch(x + 24, y + 8, y + 42, 15, P.brass[1]);
      arch(x + 24, y + 9, y + 41, 14, P.iron[1]);
      R(x + 13, y + 22, 22, 15, P.iron[2]);
      for (let a = 0; a <= 8; a++) {
        const ang = Math.PI + a / 8 * Math.PI;
        R(Math.round(x + 24 + Math.cos(ang) * 16), Math.round(y + 23 + Math.sin(ang) * 16), 1, 1, P.brass[3]);
      }
      R(x + 7, y + 25, 1, 16, P.brass[3]);
      for (const ry of [27, 33, 39]) { R(x + 7, y + ry, 2, 2, P.brass[3]); R(x + 39, y + ry, 2, 2, P.brass[3]); }
      // 舱内：管线、压力表、地板
      R(x + 28, y + 19, 9, 2, P.brass[1]); R(x + 28, y + 19, 9, 1, P.brass[2]);
      disc(x + 32, y + 15, 3.3, P.brass[2]); disc(x + 32, y + 15, 2.3, P.steam[2]); R(x + 32, y + 14, 1, 2, P.dark[0]);
      R(x + 10, y + 37, 28, 4, P.leather[1]); R(x + 10, y + 37, 28, 1, P.leather[2]);
      for (const px of [16, 24, 32]) R(x + px, y + 38, 1, 3, P.leather[0]);
      const f = o.lv || 0, lv = [0, 1, 2, 1][f];
      // 操纵杆（轻微摆动）
      box(x + 29, y + 32, 6, 5, DARK);
      line(x + 32, y + 32, x + 30 + lv, y + 25, 2, P.brass[2]);
      disc(x + 30.5 + lv, y + 24.5, 1.8, P.brass[3]);
      // 小黑炭球驾驶员：坐在舱里，两只小短手够着操纵杆
      const bob = f === 1 || f === 2 ? 1 : 0;
      soot(x + 19, y + 28 + bob, 9.5, SOOT_PILOT, {
        look: 1, blink: f === 3 && (o.seed || 0) % 2 === 0,
        hands: [[x + 26, y + 29 + bob, x + 30 + lv, y + 25], [x + 26, y + 33 + bob, x + 30 + lv, y + 29]],
      });
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
      // 大燃煤窗口：唯一的发光体
      box(x + 3, y + 6, 42, 39, IRON);
      box(x + 33, y, 8, 8, DARK); R(x + 32, y, 10, 2, P.dark[3]);
      R(x + 4, y + 11, 40, 1, P.iron[1]);
      for (const rx of [8, 16, 24]) R(x + rx, y + 11, 1, 1, P.iron[4]);
      disc(x + 11, y + 9, 3.2, P.brass[2]); disc(x + 11, y + 9, 2.2, P.steam[2]); R(x + 11, y + 8, 1, 2, P.gauge[1]);
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
      // 铁栅栏：竖条 + 一道横档，压在煤火前面
      R(x + 11, y + 25, 26, 2, P.iron[0]); R(x + 11, y + 25, 26, 1, P.iron[2]);
      for (const gx of [14, 20, 26, 32]) {
        R(x + gx, y + 19, 2, 20, P.iron[0]);
        R(x + gx, y + 19, 1, 20, P.iron[2]);
        R(x + gx, y + 25, 2, 2, P.iron[3]);
      }
      // 灰斗缝透出微光
      R(x + 11, y + 40, 26, 1, lv >= 2 ? P.fire[1] : P.fire[0]);
    },
    cannon(x, y, o) {
      // 分件：炮塔座固定；摇架 + 驻退筒 + 炮管绕耳轴 (34,27) 转到仰角；炮管整体后坐 d 像素，复进杆随之伸缩
      housing(x, y, true);
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
        R(bx, Y + 22, 30, 10, P.iron[0]); R(bx, Y + 23, 30, 8, P.iron[3]); R(bx, Y + 23, 30, 1, P.iron[4]); R(bx, Y + 30, 30, 1, P.iron[2]);
        for (const hb of [8, 18]) { R(bx + hb, Y + 21, 3, 12, P.brass[1]); R(bx + hb, Y + 21, 1, 12, P.brass[3]); }
        R(bx + 28, Y + 19, 8, 16, P.iron[0]); R(bx + 29, Y + 20, 6, 14, P.iron[3]); R(bx + 29, Y + 20, 6, 1, P.iron[4]);
        for (const sy of [22, 26, 30]) R(bx + 30, Y + sy, 4, 2, P.dark[0]);
        if ((o.k || 0) >= 7) { R(bx + 36, Y + 23, 3, 8, P.fire[3]); R(bx + 39, Y + 25, 2, 4, P.fire[2]); }   // 刚开炮：炮口余焰
      });
      disc(x + 34, y + 27, 3, P.brass[0]); disc(x + 34, y + 27, 2, P.brass[3]);   // 耳轴
    },
    mortar(x, y, o) {
      // 朝天粗管：一眼看出“往上打”
      box(x + 3, y + 28, 42, 17, IRON);
      R(x + 4, y + 39, 40, 1, P.brass[2]);
      box(x + 11, y + 22, 7, 12, DARK); box(x + 24, y + 22, 7, 12, DARK);
      const k = rcPx('mortar', o.k);
      const ang = (o.a == null ? 55 : o.a) * Math.PI / 180;
      const dx = Math.cos(ang), dy = -Math.sin(ang), px = x + 20 - dx * k, py = y + 30 - dy * k, L = 27;
      for (let t = 0; t <= L; t += 1) disc(px + dx * t, py + dy * t, 6, P.iron[0]);
      for (let t = 0; t <= L; t += 1) disc(px + dx * t, py + dy * t, 5, P.iron[3]);
      for (let t = 0; t <= L; t += 1) disc(px + dx * t + 2.6, py + dy * t + 1.8, 1.4, P.iron[2]);
      for (let t = 0; t <= L; t += 1) disc(px + dx * t - 2.8, py + dy * t - 1.9, 1, P.iron[4]);
      for (const bt of [9, 18]) for (let t = bt; t <= bt + 2; t++) { disc(px + dx * t, py + dy * t, 6.2, P.brass[0]); disc(px + dx * t, py + dy * t, 5.2, P.brass[2]); }
      disc(px + dx * L, py + dy * L, 6.5, P.iron[0]);
      disc(px + dx * L, py + dy * L, 5.5, P.iron[2]);
      disc(px + dx * L, py + dy * L, 3.3, P.black);
      disc(x + 20, y + 31, 6, P.brass[0]); disc(x + 20, y + 31, 5, P.brass[1]); disc(x + 19.5, y + 30.5, 3, P.brass[2]); R(x + 19, y + 30, 2, 2, P.brass[0]);
    },
    mg(x, y, o) {
      housing(x, y, false);
      disc(x + 14, y + 30, 10, P.brass[0]);
      disc(x + 14, y + 30, 9, P.brass[1]);
      disc(x + 13, y + 29, 6, P.brass[2]);
      R(x + 9, y + 22, 4, 1, P.brass[3]); R(x + 7, y + 24, 1, 3, P.brass[3]);
      disc(x + 14, y + 30, 2, P.brass[0]);
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
    side_cannon(x, y, o) {
      // 外挂支架：侧挂层独有的剪影
      box(x + 6, y + 3, 20, 9, DARK);
      rivet(x + 9, y + 6, P.iron[3]); rivet(x + 21, y + 6, P.iron[3]);
      R(x + 13, y + 11, 6, 20, P.dark[0]);
      R(x + 14, y + 11, 4, 20, P.iron[2]);
      R(x + 14, y + 11, 1, 20, P.iron[3]);
      const k = rcPx('side_cannon', o.k);
      turn(x + 18, y + 34, o.a, (X, Y) => {
        X += x; Y += y;
        R(X + 26 - k, Y + 28, 40, 12, P.dark[0]);
        R(X + 26 - k, Y + 29, 40, 10, P.iron[3]);
        R(X + 26 - k, Y + 29, 40, 1, P.iron[4]);
        R(X + 26 - k, Y + 37, 40, 1, P.iron[2]);
        for (const bx of [40, 54]) { R(X + bx - k, Y + 27, 4, 14, P.brass[1]); R(X + bx - k, Y + 27, 1, 14, P.brass[3]); }
        disc(X + 18, Y + 34, 11, P.dark[0]);
        disc(X + 18, Y + 34, 10, P.brass[1]);
        disc(X + 17, Y + 33, 7, P.brass[2]);
        R(X + 11, Y + 26, 3, 2, P.brass[3]);
      });
    },
    bucket(x, y) {
      // 铲斗：装在底盘前方，弧形推土板 + 齿
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
      for (const ry of [12, 24, 36]) rivet(x + 31 - Math.round(6 * Math.sin(Math.PI * (ry - 4) / 42)), y + ry, P.rust[3], P.rust[0]);
      for (const ty of [39, 43]) { R(x + 39, y + ty, 7, 3, P.iron[0]); R(x + 39, y + ty, 6, 2, P.iron[4]); R(x + 45, y + ty + 1, 2, 1, P.iron[3]); }
    },
    spike(x, y) {
      // 撞角：锥形尖刺
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
    },
    piston(x, y, o) {
      // 蒸汽撞锤：气缸 + 活塞杆 + 锤头
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
      const L = o.connL, Rr = o.connR, th = o.th, ph = th ? 0 : o.ph || 0;
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
      for (let k = fx0 + 6; k < fx1; k += 12) { R(k, y + 13, 1, 17, P.iron[1]); R(k + 1, y + 13, 1, 17, P.iron[3]); }
      for (let k = fx0 + 3; k < fx1 - 1; k += 6) { R(k, y + 14, 1, 1, P.iron[4]); R(k, y + 28, 1, 1, P.iron[4]); }
      // 成对负重轮（Holt 式转向架）
      for (const bx of [6, 30]) {
        if (x + bx < fx0 || x + bx + 12 > (Rr ? x + C + 2 : x + 30)) continue;
        R(x + bx, y + 32, 14, 2, P.dark[0]);
        for (const wx of [bx + 3, bx + 11]) {
          disc(x + wx, y + 37, 4.4, P.dark[0]); disc(x + wx, y + 37, 3.5, P.dark[3]); disc(x + wx, y + 37, 1.6, P.dark[2]);
          R(x + wx, y + 36, 1, 1, P.iron[3]);
        }
      }
      if (!th) links(fx0, Rr ? x + C : x + 26, y + 40, 6, -ph, true);
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
      if (!L) spokedWheel(x + rc, y + 26, Rr ? 13 : 8, -ph / 24 * Math.PI * 2 / 6, 6);
      if (!Rr) {
        // 前端上翘（Mark IV）+ 大辐条诱导轮（雷诺 FT）；掉链后只剩诱导轮
        if (!th) {
          line(x + 24, y + 43, x + 40, y + 27, 8, P.dark[0]);
          line(x + 24, y + 43, x + 40, y + 27, 6, P.dark[1]);
          for (let i = 0; i <= 16; i += 4) R(x + 24 + i + 1, y + 43 - i - 3, 2, 2, P.dark[3]);
        }
        spokedWheel(x + 36, y + 19, 11, ph / 24 * Math.PI * 2 / 7, 7);
      }
    },
    // 腿式底盘分两层：近侧腿画在车体前；远侧腿压暗、向右上错位，画在整个车体后面 → 伪立体纵深。
    // part: 'far' 只画远侧腿 / 'near' 只画横梁+近侧腿 / 省略 = 都画（卡片图标用）。bd = 机身随步态下沉的像素
    biped(x, y, o) {
      // 每格一对腿：原来并排的两条腿，一条留在近侧，另一条退到车体后面（远侧）
      const { a: a0, mv, bd } = walk(o), S = mv ? 7 : 0, a = a0 + (o.ri || 0) * Math.PI;
      const leg = (L, ph) => {
        const hx = x + (L.far ? 28 : 16) + L.dx, hy = y + 14 + bd + L.dy;
        const lift = mv ? Math.round(Math.max(0, Math.sin(a + ph)) * 5) : 0;
        const fx = Math.round(hx - S * Math.cos(a + ph)), fy = y + 42 + L.dy - lift;
        const [kx, ky] = ik(hx, hy, fx, fy, 15, 16);
        line(hx, hy, kx, ky, 5, L.o); line(hx, hy, kx, ky, 3, L.f);
        line(kx, ky, fx, fy, 5, L.o); line(kx, ky, fx, fy, 3, L.f);
        line(hx - 4, hy + 2, kx - 1, ky - 3, 1, L.pis);
        disc(kx + 0.5, ky + 0.5, 4, L.o); disc(kx + 0.5, ky + 0.5, 3, L.j); R(kx - 1, ky - 1, 1, 1, L.jl);
        box(fx - 7, fy, 16, 5, L.foot); R(fx + 8, fy + 2, 2, 3, L.j);
      };
      if (o.part !== 'near') leg(LEG.far, Math.PI);
      if (o.part === 'far') return;
      floor(x, y + bd, o, 4);
      const x0 = x + (o.connL ? 0 : 3), x1 = x + C - (o.connR ? 0 : 3);
      beam(x0, x1, y + 4 + bd, 11, o);
      rivet(x + 9, y + 8 + bd, P.iron[3]); rivet(x + 37, y + 8 + bd, P.iron[3]);
      leg(LEG.near, 0);
      disc(x + 16.5, y + 14.5 + bd, 3.2, P.iron[0]); disc(x + 16.5, y + 14.5 + bd, 2.2, P.iron[3]);
    },
    quad(x, y, o) {
      const { a: a0, mv, bd } = walk(o), a = a0 + (o.ri || 0) * Math.PI;
      const leg = (L, lx, ph) => {
        const hx = x + lx + L.dx, top = y + 15 + bd + L.dy, ky = top + 12;
        const lift = mv ? Math.round(Math.max(0, Math.sin(a + ph)) * 3) : 0;
        const sw = mv ? Math.round(-3 * Math.cos(a + ph)) : 0;
        const fy = y + 41 + L.dy - lift;
        R(hx - 3, top, 7, 10, L.o); R(hx - 2, top, 5, 10, L.f);
        line(hx + 4, ky, hx + 4 + sw, fy, 6, L.o); line(hx + 4, ky, hx + 4 + sw, fy, 4, L.f);
        disc(hx + 1, ky, 4, L.o); disc(hx + 1, ky, 3, L.j); R(hx, ky - 1, 1, 1, L.jl);
        box(hx - 3 + sw, fy, 15, 6, L.foot);
      };
      // 每格两条腿：一条近侧、一条退到车体后面（远侧），两者反相；相邻格再错开半个周期
      if (o.part !== 'near') leg(LEG.far, 26, Math.PI);
      if (o.part === 'far') return;
      floor(x, y + bd, o, 4);
      const x0 = x + (o.connL ? 0 : 2), x1 = x + C - (o.connR ? 0 : 2);
      beam(x0, x1, y + 4 + bd, 12, o);
      R(x0 + 1, y + 7 + bd, x1 - x0 - 2, 1, P.dark[3]);
      leg(LEG.near, 14, 0);
    },
  };

  // ---------- 缓存：量化参数 → 离屏精灵 ----------
  const cache = new Map();
  const TOP = 16;
  const angQ = (a, rest) => Math.round((a == null ? rest : a) / 2) * 2;   // 仰角按 2° 一档缓存
  function quant(id, o) {
    const q = {};
    switch (id) {
      case 'boiler': { const fl = Math.floor((o.t || 0) * 8 + (o.seed || 0)) % 4; q.fr = fl; q.lv = Math.max(1, Math.min(3, Math.floor(1 + (o.heat || 0) * 2.2 + (fl % 2) * 0.6))); break; }
      case 'water': q.lv = Math.round(29 * Math.max(0, Math.min(1, o.water == null ? 1 : o.water))); q.fr = Math.floor((o.t || 0) * 4) % 4; break;
      case 'cockpit': case 'copilot': q.lv = Math.floor((o.t || 0) * 1.5 + (o.seed || 0)) % 4; break;
      case 'cannon': case 'side_cannon': q.k = SA.Dyn.quant(o.recoil, 8); q.a = angQ(o.a, 0); break;
      case 'mortar': q.k = SA.Dyn.quant(o.recoil, 8); q.a = angQ(o.a, 55); break;
      case 'mg': q.k = SA.Dyn.quant(o.recoil, 8); q.f = SA.Dyn.frame(o.feed, 12); q.a = angQ(o.a, 0); break;
      case 'track': q.ph = o.thrown ? 0 : SA.Dyn.frame(o.phase, 24); q.connL = !!o.connL; q.connR = !!o.connR; q.top = !!o.top; q.th = !!o.thrown; q.sn = !!o.snap; break;
      case 'biped': case 'quad': q.gf = o.moving ? gfOf(o.phase) : 0; q.mv = !!o.moving; q.bd = o.bd || 0; q.part = o.part || null; q.ri = o.ri || 0; q.rn = o.rn || 1; q.connL = !!o.connL; q.connR = !!o.connR; q.top = !!o.top; break;
      case 'piston': q.p = Math.round((o.punch || 0) * 3); break;
    }
    if (o.mt > 1) q.mt = o.mt;
    return q;
  }
  // 材料换色：'color' 混合只换色相和饱和度、保留原图明暗；再用原图的不透明度把透明处抠回来
  function tintMat(cv, mat) {
    const keep = document.createElement('canvas');
    keep.width = cv.width; keep.height = cv.height;
    keep.getContext('2d').drawImage(cv, 0, 0);
    const g = cv.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'color'; g.globalAlpha = mat.a; g.fillStyle = mat.tint;
    g.fillRect(0, 0, cv.width, cv.height);
    if (mat.dark) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = mat.dark; g.fillStyle = '#000000'; g.fillRect(0, 0, cv.width, cv.height); }
    if (mat.lite) { g.globalCompositeOperation = 'screen'; g.globalAlpha = mat.lite; g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    g.drawImage(keep, 0, 0);
    g.restore();
  }
  function sprite(id, q) {
    const key = id + JSON.stringify(q);
    let cv = cache.get(key);
    if (!cv) {
      if (cache.size > 800) cache.clear();
      // 上方留 TOP 像素：炮管抬起来时不会被裁掉
      cv = document.createElement('canvas');
      cv.width = C + 32; cv.height = C + TOP;
      ctx = cv.getContext('2d');
      DRAW[id](0, TOP, q);
      if (q.mt > 1) tintMat(cv, SA.MATS[q.mt]);
      cache.set(key, cv);
    }
    return cv;
  }
  function drawModule(c2d, id, x, y, o = {}) {
    c2d.drawImage(sprite(id, quant(id, o)), x, y - TOP);
    ctx = c2d;
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
  function hull(grid, cx, cy) {
    const solid = (cell) => cell && !SA.isRam(cell.id);
    const occ = (r, c) => r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS && solid(grid[r][c]);
    const body = (fn) => { for (let r = 0; r < K.ROWS - 1; r++) for (let c = 0; c < K.COLS; c++) if (solid(grid[r][c])) fn(r, c, cx(c), cy(r)); };
    body((r, c, x, y) => R(x, y, C, C, P.iron[1]));
    body((r, c, x, y) => {
      if (occ(r, c + 1)) for (const yy of [10, 23, 36]) rivet(x + C - 2, y + yy, P.iron[3]);
      if (occ(r + 1, c) && r + 1 < K.ROWS - 1) for (const xx of [10, 23, 36]) rivet(x + xx, y + C - 2, P.iron[3]);
    });
    body((r, c, x, y) => {
      if (!occ(r - 1, c)) { R(x, y, C, 1, P.iron[0]); R(x, y + 1, C, 1, P.iron[3]); }
      if (!occ(r, c - 1)) { R(x, y, 1, C, P.iron[0]); R(x + 1, y + 1, 1, C - 1, P.iron[2]); }
      if (!occ(r, c + 1)) R(x + C - 1, y, 1, C, P.iron[0]);
      if (!occ(r + 1, c)) R(x, y + C - 1, C, 1, P.iron[0]);
    });
  }

  // ---------- 整车渲染 ----------
  const pool = {};
  function vehCanvas(key) {
    if (!pool[key]) {
      pool[key] = document.createElement('canvas');
      pool[key].width = K.COLS * C + PADX * 2;
      pool[key].height = K.ROWS * C;
    }
    return pool[key];
  }

  function renderVehicle(veh, o = {}) {
    const cv = vehCanvas(o.key || 'default');
    const g = cv.getContext('2d');
    ctx = g;
    g.clearRect(0, 0, cv.width, cv.height);
    const t = o.t || 0;
    const blocked = o.blocked || [];
    const isBlocked = (r, c) => blocked.some(b => b.r === r && b.c === c);
    const cx = (c) => PADX + c * C, cy = (r) => r * C;


    // 底盘行：履带任意一段被毁 → 整条掉链；腿式底盘的步态决定机身下沉量 bd
    const base = veh.body[K.ROWS - 1];
    const thrown = base.some(x => x && x.id === 'track' && x.hp <= 0);
    const amp = base.some(x => x && x.id === 'track') ? 0 : Math.max(0, ...base.map(x => (x && x.hp > 0 && BOB[x.id]) || 0));
    const dyn = o.dyn || null;   // SA.Dyn.animator：战斗里提供行驶相位、后坐、供弹；改装台 / 预览不传就是静止
    const phase = dyn ? dyn.phase : (o.phase || 0);
    const bd = amp - Math.round(Math.abs(Math.sin((o.moving ? gfOf(phase) : 0) / 12 * Math.PI * 2)) * amp);
    const isChassis = (id) => SA.MODULES[id].layer === 'chassis';
    const dy = (id, r) => (r === K.ROWS - 1 && isChassis(id) ? 0 : bd);   // 底盘自己处理下沉，其余整体随之起伏

    const modOpts = (cell, r, c) => {
      const m = SA.MODULES[cell.id];
      const row = veh.body[r];
      const same = (k) => row[k] && row[k].id === cell.id;
      const above = r > 0 && veh.body[r - 1][c];
      return {
        t, heat: o.heat || 0, water: o.water, moving: o.moving, seed: r * 3 + c, bd, mt: cell.mt,
        recoil: dyn ? dyn.recoilOf(`${r},${c},${m.layer === 'side' ? 's' : 'b'}`) : 0,
        feed: dyn ? dyn.feedOf(`${r},${c},${m.layer === 'side' ? 's' : 'b'}`) : 0,
        a: o.elev ? o.elev[`${r},${c},${m.layer === 'side' ? 's' : 'b'}`] : undefined,   // 炮管仰角（度）：战斗里跟着鼠标转
        punch: o.punch ? (o.punch[`${r},${c}`] || 0) : 0,
        phase,
        connL: c > 0 && same(c - 1),
        connR: c < K.COLS - 1 && same(c + 1),
        ...run(row, c),
        top: !!(above && !SA.isRam(above.id)),
        thrown, snap: cell.id === 'track' && cell.hp <= 0,
      };
    };
    // 同类底盘连续段：本格在段内的序号与段长（腿按整段分配）
    const run = (row, c) => {
      const id = row[c].id;
      let a0 = c, a1 = c;
      while (a0 > 0 && row[a0 - 1] && row[a0 - 1].id === id) a0--;
      while (a1 < K.COLS - 1 && row[a1 + 1] && row[a1 + 1].id === id) a1++;
      return { ri: c - a0, rn: a1 - a0 + 1 };
    };
    // 被毁的底盘/撞击件：压暗 + 裂纹，不画成半透明虚影
    const dead = (fn) => { g.save(); g.filter = 'brightness(0.45)'; fn(); g.restore(); ctx = g; };

    // 远侧腿：在整个车体之前画，被车体遮住一部分
    base.forEach((cell, c) => {
      if (!cell || !BOB[cell.id]) return;
      const r = K.ROWS - 1, draw = () => drawModule(g, cell.id, cx(c), cy(r), { ...modOpts(cell, r, c), part: 'far' });
      if (cell.hp > 0) draw(); else dead(draw);
    });
    g.save(); g.translate(0, bd); hull(veh.body, cx, cy); g.restore(); ctx = g;
    // 主体层：底盘/撞击 → 其他 → 武器（炮管压在相邻格上，被挡时一眼可见）
    const order = (id) => (SA.isWeapon(id) ? 2 : isChassis(id) ? 0 : 1);
    for (const pass of [0, 1, 2]) {
      eachCell(veh.body, (cell, r, c) => {
        if (order(cell.id) !== pass) return;
        const x = cx(c), y = cy(r) + dy(cell.id, r);
        const mo = { ...modOpts(cell, r, c), part: 'near' };
        if (cell.hp <= 0) {
          ctx = g;
          if (cell.id === 'track') { drawModule(g, cell.id, x, y, mo); damage(x, y, 0, r * 8 + c); }
          else if (isChassis(cell.id) || SA.isRam(cell.id)) { dead(() => drawModule(g, cell.id, x, y, mo)); damage(x, y, 0, r * 8 + c); }
          else wreck(x, y);
          return;
        }
        drawModule(g, cell.id, x, y, mo);
        damage(x, y, cell.hp / (cell.max || SA.mod(cell).hp), r * 8 + c);
        if (o.showBlocked && isBlocked(r, c)) blockedMark(x + C + 12, y + 27);
      });
    }
    if (o.dimBody) { g.fillStyle = 'rgba(7,8,12,0.55)'; g.fillRect(0, 0, cv.width, cv.height); }
    if (o.dimCell) { g.fillStyle = 'rgba(7,8,12,0.55)'; g.fillRect(cx(o.dimCell.c), cy(o.dimCell.r) + bd, C, C); }

    // 侧挂层：硬阴影 + 本体，明确“在另一个平面”
    eachCell(veh.side, (cell, r, c) => {
      if (cell.hp <= 0) return;
      const img = sprite(cell.id, quant(cell.id, modOpts(cell, r, c)));
      g.save();
      g.globalAlpha = o.dimSide ? 0.35 : 1;
      g.filter = 'brightness(0) opacity(0.55)';
      g.drawImage(img, cx(c) + 3, cy(r) + 3 + bd - TOP);
      g.filter = 'none';
      g.drawImage(img, cx(c), cy(r) + bd - TOP);
      g.restore();
      ctx = g;
      damage(cx(c), cy(r) + bd, cell.hp / (cell.max || SA.mod(cell).hp), r * 8 + c + 3);
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
    const cv = document.createElement('canvas');
    cv.width = C + 32; cv.height = C + 4;
    const g = cv.getContext('2d');
    ctx = g;
    if (SA.MODULES[id].layer === 'body') { R(2, 2, C, C, P.iron[1]); R(2, 2, C, 1, P.iron[0]); R(2, 2, 1, C, P.iron[0]); R(C + 1, 2, 1, C, P.iron[0]); R(2, C + 1, C, 1, P.iron[0]); }
    drawModule(g, id, 2, 2, { heat: 0.5, water: 0.7, t: 0, mt });
    cv.style.width = `${(C + 32) * scale}px`; cv.style.height = `${(C + 4) * scale}px`;
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
    PADX, drawModule, renderVehicle, outline, iconCanvas, moduleCanvas, text, chevrons,
    useCtx: (c) => { ctx = c; }, R: (...a) => R(...a), disc: (...a) => disc(...a), line: (...a) => line(...a),
  };
})();
