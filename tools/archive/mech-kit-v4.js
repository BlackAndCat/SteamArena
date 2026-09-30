// 「当前开发」页：全局子格套件（机甲套件）v4——从 tools/mech-kit.js（2026-09-25 v3）原样继承，接着开发。
// v4（2026-09-30）：补上之前计划里有、套件里没有的零件：肩甲、背负锅炉、背水罐、喷汽背包（都是现有模块的子格外观）+ 腕枪臂（新的手臂）
// 原说明：
// 所有模块缩小到 1/4：24px 子格，一个旧格 = 2×2 子格，像素大小不变。零件是公共的，双足 / 履带 / 蜘蛛共用；
// 同一零件有两种品质外观（铁制 / 钢制）。两层：
//   车体层 —— 驾驶舱、燃炉、水罐、甲片：占格、连成车体框架；
//   附加层 —— 机械臂（肩膀属于手臂）、盾臂、巨炮臂、剑、锤、侧炮、重炮：画在车体前面，可以盖住车体格、武器可以伸出格外。
//   附加层规则对所有底盘一样：必须压在或贴着车体零件上；附加层之间不重叠；瞄准它时只打它（沿用侧炮规则）。
// 只做视觉，不涉及数值。
window.SA = window.SA || {};

SA.MECHKIT = (() => {
  const P = SA.PAL, S = 24, PADX = SA.SPR.PADX, TAU = Math.PI * 2;
  const { Pen, U } = SA.LEGLAB;
  const { NEAR, FAR, bone, gear, rivet } = U;
  const B2 = SA.BIPED2;

  const LOOK = {
    L: { name: '铁制', hull: (M) => [M.iron[0], M.iron[1], M.iron[1], M.iron[2]] },
    K: { name: '钢制', hull: (M) => [M.iron[0], M.iron[1], M.iron[2], M.iron[3]] },
  };
  const SOOT = ['#141824', '#2f3850', '#6a7a9c'];
  const shell = (s, M) => (s === 'L' ? M.iron : M.steel);
  const flatGauge = (M) => [M.gauge[1], M.gauge[1], P.steam[2], P.steam[2]];

  // ---------- 车体层零件（坐标：块的左上角） ----------
  const PARTS = {
    helm: {
      name: '头盔驾驶舱', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        if (s === 'L') {
          pn.disc(x + 12, y + 12, 10).rect(x + 2, y + 12, 20, 10).paint(M.iron);
          pn.rect(x + 1, y + 19, 22, 4).paint(M.brass);
          pn.disc(x + 14, y + 11, 6.2).paint(M.brass);
          pn.disc(x + 14, y + 11, 4.6).paint([M.glass[0], M.glass[0], M.glass[0], M.glass[1]], { outline: false });
          pn.disc(x + 14, y + 12, 3.6).paint([SOOT[0], SOOT[1], SOOT[1], SOOT[2]], { outline: false });
          for (const ex of [x + 13, x + 16]) {
            if (o.blink) { pn.fill(ex, y + 11, 2, 1, P.steam[2]); continue; }
            pn.fill(ex, y + 10, 2, 2, P.white); pn.fill(ex + 1, y + 11, 1, 1, P.black);
          }
          pn.dot(x + 11, y + 8, M.glass[3]);
          pn.rect(x + 7, y + 1, 4, 3).paint(M.brass, { bevel: 'l' });
          rivet(pn, x + 4, y + 14);
        } else {
          pn.poly([[x + 7, y + 3], [x + 12, y], [x + 17, y + 3]]).paint(M.brass);
          pn.poly([[x + 3, y + 5], [x + 8, y + 2], [x + 18, y + 2], [x + 22, y + 5], [x + 22, y + 22], [x + 2, y + 22], [x + 2, y + 8]]).paint(M.steel);
          pn.fill(x + 10, y + 9, 12, 3, P.black);
          if (!o.blink) { pn.dot(x + 15, y + 10, P.white); pn.dot(x + 19, y + 10, P.white); }
          pn.fill(x + 10, y + 8, 12, 1, P.brass[2]); pn.fill(x + 16, y + 12, 2, 10, P.brass[2]); pn.fill(x + 17, y + 12, 1, 10, P.brass[1]);
          for (const [dx, dy] of [[12, 15], [20, 15], [13, 18], [20, 18]]) pn.dot(x + dx, y + dy, P.iron[0]);
          pn.fill(x + 3, y + 20, 19, 1, P.brass[2]);
          pn.ln(x + 5, y + 7, x + 5, y + 18, M.steel[3]);
        }
      },
    },
    furnace: {
      name: '燃炉', w: 2, h: 2, layer: 'body',
      draw(pn, x, y, s, M, o) {
        const ember = (k) => ((k + o.fl) % 4 === 0 ? M.fire[3] : (k + o.fl) % 2 ? M.fire[2] : M.fire[1]);
        if (s === 'L') {
          pn.poly([[x + 3, y + 8], [x + 8, y + 3], [x + 40, y + 3], [x + 45, y + 8], [x + 45, y + 45], [x + 3, y + 45]]).paint(M.iron);
          for (const yy of [9, 40]) pn.rect(x + 3, y + yy, 42, 3).paint(M.brass, { outline: false });
          pn.disc(x + 24, y + 26, 11.5).paint(M.brass);
          pn.disc(x + 24, y + 26, 9.5).paint([P.black, M.fire[0], M.fire[0], M.fire[0]], { outline: false, bevel: '' });
          for (let k = 0; k < 9; k++) { const a = k * 2.4, rr = (k % 3 + 1) / 3.4 * 9.5; pn.dot(x + 24 + Math.cos(a) * rr, y + 26 + Math.sin(a) * rr, ember(k)); }
          for (let k = -2; k <= 2; k++) pn.fill(x + 23 + k * 4, y + 17, 1, 19, P.dark[0]);
          pn.disc(x + 39, y + 20, 3.4).paint(M.brass); pn.disc(x + 39, y + 20, 2.3).paint(flatGauge(M), { outline: false, bevel: '' });
          pn.ln(x + 39, y + 20, x + 40, y + 18, P.dark[0]);
          rivet(pn, x + 6, y + 16); rivet(pn, x + 6, y + 33);
        } else {
          pn.poly([[x + 3, y + 3], [x + 45, y + 3], [x + 45, y + 30], [x + 36, y + 45], [x + 12, y + 45], [x + 3, y + 30]]).paint(M.steel);
          pn.fill(x + 4, y + 4, 40, 2, P.brass[2]);
          pn.ln(x + 5, y + 8, x + 17, y + 20, M.steel[3]); pn.ln(x + 43, y + 8, x + 31, y + 20, M.steel[1]);
          pn.poly([[x + 16, y + 40], [x + 16, y + 22], [x + 24, y + 12], [x + 32, y + 22], [x + 32, y + 40]]).paint(M.brass);
          pn.poly([[x + 18, y + 39], [x + 18, y + 23], [x + 24, y + 15], [x + 30, y + 23], [x + 30, y + 39]]).paint([P.black, M.fire[0], M.fire[0], M.fire[0]], { outline: false, bevel: '' });
          for (let k = 0; k < 12; k++) pn.dot(x + 19 + (k * 5) % 11, y + 20 + (k * 7) % 18, ember(k));
          for (const xx of [21, 24, 27]) pn.fill(x + xx, y + 16, 1, 24, P.dark[0]);
          rivet(pn, x + 7, y + 10); rivet(pn, x + 39, y + 10);
        }
      },
    },
    tank: {
      name: '水罐', w: 1, h: 2, layer: 'body',
      draw(pn, x, y, s, M, o) {
        pn.cap(x + 12, y + 12, x + 12, y + 37, 9).paint(shell(s, M));
        for (const yy of [8, 39]) pn.rect(x + 3, y + yy, 18, 2).paint(M.brass, { outline: false });
        pn.rect(x + 9, y + 13, 7, 23).paint([M.iron[0], M.iron[0], M.glass[0], M.glass[0]], { bevel: '' });
        const lv = 15;
        pn.fill(x + 10, y + 35 - lv, 5, lv, M.water[2]); pn.fill(x + 10, y + 35 - lv, 5, 1, M.water[3]);
        pn.dot(x + 12, y + 33 - ((o.fl * 3) % lv), M.water[3]);
        pn.rect(x + 9, y + 1, 6, 4).paint(M.brass, { bevel: 'l' });
        if (s === 'K') { pn.ln(x + 5, y + 12, x + 5, y + 36, M.steel[3]); pn.ln(x + 19, y + 12, x + 19, y + 36, M.steel[1]); }
      },
    },
    jar: {
      name: '小水罐', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M) {
        pn.cap(x + 12, y + 10, x + 12, y + 15, 8).paint(shell(s, M));
        pn.rect(x + 9, y + 8, 6, 10).paint([M.iron[0], M.iron[0], M.glass[0], M.glass[0]], { bevel: '' });
        pn.fill(x + 10, y + 12, 4, 5, M.water[2]); pn.fill(x + 10, y + 12, 4, 1, M.water[3]);
        pn.rect(x + 4, y + 20, 16, 2).paint(M.brass, { outline: false });
        pn.rect(x + 10, y, 4, 3).paint(M.brass, { bevel: 'l' });
      },
    },
    plate: {
      name: '甲片', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M) {
        if (s === 'L') {
          pn.rect(x + 2, y + 2, 20, 20).paint(M.iron);
          for (const [a, b] of [[4, 4], [17, 4], [4, 17], [17, 17]]) rivet(pn, x + a, y + b);
          pn.fill(x + 3, y + 11, 18, 1, P.iron[0]); pn.fill(x + 3, y + 12, 18, 1, P.iron[3]);
        } else {
          pn.rect(x + 2, y + 2, 20, 20).paint(M.steel);
          pn.fill(x + 3, y + 19, 18, 2, P.brass[2]);
          pn.ln(x + 5, y + 5, x + 12, y + 16, M.steel[3]); pn.ln(x + 19, y + 5, x + 12, y + 16, M.steel[1]);
          rivet(pn, x + 4, y + 4); rivet(pn, x + 17, y + 4);
        }
      },
    },


    // ---------- v4 新增（2026-09-30）：之前计划里有、套件里还没有的零件 ----------
    // 这些都不是新模块，是现有模块的子格外观：肩甲 = 甲片、背负锅炉 = 竖式锅炉、背水罐 = 小水罐、喷汽背包 = 加压舱；手臂系列才是新模块
    pauldron: {
      name: '肩甲（甲片）', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        const sw = Math.round((o.swing || 0) * 1);
        if (s === 'L') {
          // 三片弧形甲片一层压一层，下面两片随步伐轻晃
          for (let k = 2; k >= 0; k--) {
            const v = y + 3 + k * 6, dx = k === 0 ? 0 : sw * (k === 2 ? 1 : 0.5), pts = [];
            for (let i = 0; i <= 10; i++) { const a = Math.PI * (1 + i / 10); pts.push([x + 12 + dx + Math.cos(a) * 11, v + 9 + Math.sin(a) * 7]); }
            pts.push([x + 23 + dx, v + 11], [x + 1 + dx, v + 11]);
            pn.poly(pts).paint(M.iron);
            rivet(pn, x + 3 + dx, v + 5); rivet(pn, x + 19 + dx, v + 5);
          }
        } else {
          // 一整片圆鼓的钢肩甲 + 高高翻起的护颈 + 黄铜包边
          pn.poly([[x + 1, y + 9], [x + 3, y + 1], [x + 8, y + 1], [x + 9, y + 8]]).paint(M.steel);
          const pts = [];
          for (let i = 0; i <= 12; i++) { const a = Math.PI * (1 + i / 12); pts.push([x + 12 + Math.cos(a) * 11.5, y + 16 + Math.sin(a) * 10]); }
          pts.push([x + 23.5, y + 21], [x + 0.5, y + 21]);
          pn.poly(pts).paint(M.steel);
          pn.rect(x + 1, y + 18, 22, 3).paint(M.brass, { outline: false });
          pn.ln(x + 4, y + 11, x + 11, y + 7, M.steel[3]); pn.fill(x + 4, y + 2, 3, 1, P.brass[2]);
          rivet(pn, x + 17, y + 11);
        }
      },
    },
    backboiler: {
      name: '背负锅炉（竖式锅炉）', w: 1, h: 2, layer: 'body',
      draw(pn, x, y, s, M, o) {
        // 烟囱从肩后伸出来：机甲剪影最重要的一笔；顶上冒烟
        pn.rect(x + 5, y - 17, 6, 22).paint(M.dark);
        if (s === 'K') pn.rect(x + 3, y - 20, 10, 4).paint(M.brass); else pn.rect(x + 4, y - 19, 8, 3).paint(M.dark);
        for (let k = 0; k < 3; k++) { const p = ((o.t || 0) * 0.9 + k / 3) % 1; pn.disc(x + 8 - p * 5 + Math.sin(k * 2 + p * 6), y - 22 - p * 14, 1.3 + p * 2.6).paint(p < 0.5 ? [P.steam[1], P.steam[2], P.steam[2], P.white] : M.steam, { outline: false }); }
        pn.cap(x + 12, y + 10, x + 12, y + 38, 9.5).paint(shell(s, M));
        const bands = s === 'K' ? [8, 22, 37] : [9, 35];
        for (const yy of bands) pn.rect(x + 3, y + yy, 18, 2).paint(M.brass, { outline: false });
        if (s === 'K') { pn.disc(x + 15, y + 16, 3.2).paint(M.brass); pn.disc(x + 15, y + 16, 2.2).paint(flatGauge(M), { outline: false, bevel: '' }); pn.ln(x + 15, y + 16, x + 16, y + 14, P.dark[0]); }
        else { rivet(pn, x + 5, y + 14); rivet(pn, x + 5, y + 26); }
        // 炉门：透出炉火
        pn.rect(x + 6, y + 27, 11, 8).paint(M.dark);
        for (let k = 0; k < 6; k++) pn.dot(x + 8 + (k * 3) % 8, y + 29 + (k % 3) * 2, (k + o.fl) % 3 ? M.fire[2] : M.fire[3]);
        // 背带勒到躯干上
        for (const yy of [12, 30]) pn.rect(x + 19, y + yy, 6, 3).paint(M.leather, { bevel: 'l' });
      },
    },
    backjar: {
      name: '背水罐（小水罐）', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        for (const cx of [7, 17]) {
          pn.cap(x + cx, y + 6, x + cx, y + 17, 5).paint(shell(s, M));
          pn.rect(x + cx - 2, y + 6, 4, 10).paint([M.iron[0], M.iron[0], M.glass[0], M.glass[0]], { bevel: '' });
          pn.fill(x + cx - 1, y + 10, 2, 5, M.water[2]); pn.fill(x + cx - 1, y + 10, 2, 1, M.water[3]);
          pn.rect(x + cx - 2, y, 4, 3).paint(M.brass, { bevel: 'l' });
        }
        pn.rect(x + 1, y + 12, 22, 3).paint(s === 'K' ? M.brass : M.leather, { bevel: 'l' });
        pn.cap(x + 7, y + 2, x + 17, y + 2, 0.9).paint(M.brass, { outline: false });
      },
    },
    jetpack: {
      name: '喷汽背包（加压舱）', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        // 背后一只加压箱 + 两只朝下的喷口；走起来喷口一直往下冒一点汽，站定时只剩一丝
        pn.rect(x + 3, y + 1, 18, 14).paint(shell(s, M));
        pn.rect(x + 3, y + 6, 18, 2).paint(M.brass, { outline: false });
        if (s === 'K') { pn.disc(x + 12, y + 4, 2.4).paint(M.brass); pn.dot(x + 12, y + 4, P.dark[0]); } else { rivet(pn, x + 5, y + 10); rivet(pn, x + 17, y + 10); }
        for (const cx of [7, 17]) pn.poly([[x + cx - 2, y + 15], [x + cx + 2, y + 15], [x + cx + 4, y + 22], [x + cx - 4, y + 22]]).paint(M.brass);
        const n = o.mv ? 4 : 1;
        for (const cx of [7, 17]) for (let k = 0; k < n; k++) { const p = ((o.t || 0) * 1.6 + k / n + cx * 0.07) % 1; pn.disc(x + cx + Math.sin(k * 3 + p * 5), y + 24 + p * (o.mv ? 12 : 5), 1 + p * (o.mv ? 3 : 1.4)).paint(p < 0.4 ? [P.steam[1], P.steam[2], P.white, P.white] : M.steam, { outline: false }); }
      },
    },

    // ---------- 附加层 ----------
    arm_fist: { name: '格斗臂', w: 2, h: 3, layer: 'add', arm: 'fist', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'fist') },
    arm_sword: { name: '剑臂', w: 2, h: 3, layer: 'add', arm: 'sword', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'sword') },
    arm_hammer: { name: '锤臂', w: 2, h: 3, layer: 'add', arm: 'hammer', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'hammer') },
    arm_cannon: { name: '巨炮臂', w: 2, h: 3, layer: 'add', arm: 'cannon', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'cannon') },
    arm_shield: { name: '盾臂', w: 2, h: 3, layer: 'add', arm: 'shield', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'shield') },
    arm_mg: { name: '腕枪臂', w: 2, h: 3, layer: 'add', arm: 'mg', draw: (pn, x, y, s, M, o) => arm(pn, x, y, s, M, o, 'mg') },   // v4 新增：护手拳 + 小臂上一挺短机枪
    heavy: {
      name: '重炮', w: 2, h: 2, layer: 'add',
      draw(pn, x, y, s, M, o) {
        // 炮座压在车体上，耳轴架起一根长炮管（伸出块外一格），炮管下两根复进气缸
        const k = Math.round((o.recoil || 0) * 5), py = y + 30;
        pn.poly([[x + 6, y + 48], [x + 10, y + 36], [x + 26, y + 36], [x + 30, y + 48]]).paint(M.iron);
        pn.rect(x + 7, y + 44, 22, 2).paint(M.brass, { outline: false });
        pn.cap(x + 14 - k, py + 7, x + 44 - k, py + 7, 1.6).paint(M.steam, { bevel: 'l' });
        pn.poly([[x + 2 - k, py - 7], [x + 26 - k, py - 7], [x + 26 - k, py + 7], [x + 2 - k, py + 7]]).paint(shell(s, M));
        pn.poly([[x + 24 - k, py - 5], [x + 66 - k, py - 4], [x + 66 - k, py + 4], [x + 24 - k, py + 5]]).paint(shell(s, M));
        pn.rect(x + 64 - k, py - 6, 7, 12).paint(M.brass);
        pn.fill(x + 70 - k, py - 2, 1, 4, P.black);
        for (const xx of [30, 44, 56]) pn.fill(x + xx - k, py - 5, 2, 10, P.brass[2]);
        pn.ln(x + 26 - k, py - 3, x + 62 - k, py - 2, s === 'L' ? M.iron[3] : M.steel[3]);
        pn.disc(x + 18, py + 3, 4.2).paint(M.brass); pn.dot(x + 18, py + 3, P.brass[0]);
        rivet(pn, x + 5 - k, py - 4);
      },
    },
    sidegun: {
      name: '侧炮', w: 2, h: 1, layer: 'add',
      draw(pn, x, y, s, M) {
        // 铆接悬臂从车体伸出来，托着一门中口径炮
        pn.poly([[x - 2, y + 9], [x + 16, y + 11], [x + 16, y + 17], [x - 2, y + 19]]).paint(M.dark);
        rivet(pn, x + 1, y + 13); rivet(pn, x + 10, y + 13);
        pn.rect(x + 12, y + 6, 18, 12).paint(shell(s, M));
        pn.rect(x + 28, y + 9, 24, 6).paint(shell(s, M));
        pn.rect(x + 50, y + 8, 4, 8).paint(M.brass);
        pn.fill(x + 36, y + 9, 2, 6, P.brass[2]);
        pn.disc(x + 18, y + 12, 2.6).paint(M.brass);
      },
    },
  };

  // 机械臂：肩膀属于手臂模块。肩关节 + 肩甲 → 大臂 → 肘 → 小臂 → 手 / 武器；随步伐反向摆
  function arm(pn, x, y, s, M, o, end) {
    const R = shell(s, M), sw = o.swing || 0;
    const sx = x + 14, sy = y + 12;
    const ex = sx + 2 + sw * 4, ey = sy + 26;
    const W = { mg: [ex + 13, ey + 13], fist: [ex + 13, ey + 16], sword: [ex + 13, ey + 10], hammer: [ex + 12, ey + 12], cannon: [ex + 4, ey + 2], shield: [ex + 14, ey + 4] }[end];
    const [wx, wy] = W;
    // 武器在手后面先画
    if (end === 'sword') sword(pn, wx, wy, -0.62 + sw * 0.08, s, M);
    if (end === 'hammer') hammer(pn, wx, wy, 0.55 + sw * 0.1, s, M);
    // 大臂
    const UA = bone(sx, sy, ex, ey);
    pn.poly(UA.pts([[0, -6], [0, 6], [UA.len, 5], [UA.len, -5]])).paint(R);
    if (s === 'L') pn.ln(...UA.p(3, -6.2), ...UA.p(UA.len - 3, -5), M.steam[3]);
    else pn.ln(...UA.p(2, 2.4), ...UA.p(UA.len - 2, 2), M.steel[3]);
    // 小臂 / 炮
    if (end === 'cannon') bigGun(pn, ex, ey, s, M, o);
    else {
      const FA = bone(ex, ey, wx, wy);
      pn.poly(FA.pts([[0, -5], [0, 5], [FA.len, 6.4], [FA.len, -6]])).paint(R);
      if (s === 'K') { pn.ln(...FA.p(2, 2.4), ...FA.p(FA.len - 1, 3), M.steel[3]); pn.fill(...FA.p(FA.len - 3, -5), 1, 1, P.brass[2]); }
      else pn.ln(...FA.p(2, -5), ...FA.p(FA.len - 2, -6), M.steam[3]);
      if (end === 'shield') shieldOn(pn, wx + 4, wy - 4, s, M);
      else hand(pn, FA, s, M, end === 'mg' ? 'fist' : end);
      if (end === 'mg') wristGun(pn, FA, s, M, o);
    }
    // 肘
    if (s === 'L') { pn.disc(ex, ey, 4.4).paint(M.brass); pn.dot(ex, ey, P.brass[0]); }
    else {
      pn.disc(ex - 2.5, ey + 0.5, 5.2).paint(M.brass);
      for (let k = 0; k < 5; k++) { const a = Math.PI * (0.55 + k / 4 * 0.9); pn.ln(ex - 2.5 + Math.cos(a) * 1.4, ey + 0.5 + Math.sin(a) * 1.4, ex - 2.5 + Math.cos(a) * 4.5, ey + 0.5 + Math.sin(a) * 4.5, M.brass[1]); }
      pn.disc(ex + 0.5, ey, 3).paint(M.steel);
    }
    // 肩：关节轴套 + 肩甲（不大于大臂的两倍宽，不抢戏）
    pn.disc(sx, sy, 6.5).paint(M.dark);
    if (s === 'L') {
      pn.poly([[sx - 9, sy - 1], [sx - 6, sy - 8], [sx + 5, sy - 9], [sx + 10, sy - 3], [sx + 8, sy + 3], [sx - 8, sy + 3]]).paint(M.iron);
      pn.disc(sx, sy - 2, 2.6).paint(M.brass);
      rivet(pn, sx - 6, sy - 4); rivet(pn, sx + 5, sy - 5);
    } else {
      pn.poly([[sx - 10, sy + 1], [sx - 8, sy - 7], [sx - 1, sy - 11], [sx + 8, sy - 9], [sx + 12, sy - 2], [sx + 11, sy + 4], [sx - 9, sy + 5]]).paint(M.steel);
      pn.poly([[sx - 9, sy + 4], [sx + 11, sy + 3], [sx + 10, sy + 8], [sx - 8, sy + 9]]).paint(M.steel);
      pn.ln(sx - 9, sy + 3, sx + 11, sy + 2, P.brass[2]); pn.ln(sx - 8, sy + 8, sx + 10, sy + 7, P.brass[2]);
      pn.ln(sx - 7, sy - 6, sx - 1, sy - 10, M.steel[3]);
      rivet(pn, sx + 5, sy - 6);
    }
  }
  function hand(pn, FA, s, M, end) {
    if (end === 'fist' && s === 'L') {
      // 三指液压爪
      for (const [f, bend] of [[4, 3], [0, 4], [-4, 2]]) { const b = FA.p(FA.len + 5, f), t = FA.p(FA.len + 8, f + bend); pn.cap(...FA.p(FA.len, f * 0.8), ...b, 1.4).cap(...b, ...t, 1.1); }
      pn.paint(M.brass, { bevel: 'l' });
      pn.poly(FA.pts([[FA.len - 2, -6], [FA.len - 2, 6], [FA.len + 3, 6], [FA.len + 3, -6]])).paint(M.iron);
      return;
    }
    // 护手拳：握着武器时小一点
    const big = end === 'fist' ? 1 : 0.8;
    pn.poly(FA.pts([[FA.len - 2, -6 * big], [FA.len - 2, 6.5 * big], [FA.len + 8 * big, 6 * big], [FA.len + 9 * big, -5 * big]])).paint(shell(s, M));
    pn.ln(...FA.p(FA.len + 5 * big, -5 * big), ...FA.p(FA.len + 5 * big, 6 * big), (s === 'L' ? M.iron : M.steel)[1]);
    if (s === 'K') pn.ln(...FA.p(FA.len - 1, -5), ...FA.p(FA.len - 1, 6), P.brass[2]);
  }
  // 腕枪：绑在小臂外侧的一挺短机枪（弹鼓在下），枪口伸过拳头；开火时枪口一闪
  function wristGun(pn, FA, s, M, o) {
    // 暗色机匣贴在小臂外侧 → 一根亮钢枪管伸过拳头 → 黄铜枪口；机匣上顶一只黄铜弹鼓；两道箍把机匣绑在小臂上
    const k = Math.round((o.recoil || 0) * 2), L = FA.len;
    pn.poly(FA.pts([[1 - k, -13], [L + 1 - k, -13], [L + 1 - k, -6], [1 - k, -6]])).paint(M.dark);
    pn.poly(FA.pts([[L - k, -11], [L + 18 - k, -11], [L + 18 - k, -8], [L - k, -8]])).paint(M.steel);
    pn.poly(FA.pts([[L + 15 - k, -12.5], [L + 19 - k, -12.5], [L + 19 - k, -6.5], [L + 15 - k, -6.5]])).paint(M.brass);
    pn.disc(...FA.p(8 - k, -15.5), 4).paint(M.brass); pn.disc(...FA.p(8 - k, -15.5), 1.6).paint(M.dark, { outline: false });
    for (const u of [4, L - 4]) pn.poly(FA.pts([[u, -13.5], [u + 2, -13.5], [u + 2, 5.5], [u, 5.5]])).paint(s === 'K' ? M.brass : M.leather, { outline: false });
    if ((o.fl || 0) % 2 === 0 && o.mv) { const [mx, my] = FA.p(L + 21 - k, -9.5); pn.disc(mx, my, 1.6).paint([P.fire[1], P.fire[2], P.fire[3], P.white], { outline: false }); }
  }
  function sword(pn, wx, wy, a, s, M) {
    const B = bone(wx, wy, wx + Math.cos(a) * 50, wy + Math.sin(a) * 50);
    pn.poly(B.pts([[-7, -1.6], [-7, 1.6], [0, 1.6], [0, -1.6]])).paint(M.leather);
    pn.disc(...B.p(-8, 0), 2).paint(M.brass);
    pn.poly(B.pts([[5, -3], [5, 3], [48, 0.8], [52, 0], [48, -0.8]])).paint([P.iron[0], P.iron[3], P.iron[4], P.white]);
    pn.ln(...B.p(7, 0), ...B.p(44, 0), P.iron[2]);
    pn.poly(B.pts([[2, -8], [5, -8], [5, 8], [2, 8]])).paint(M.brass);
  }
  function hammer(pn, wx, wy, a, s, M) {
    // 蒸汽锤：长柄 + 锤头，锤头背后一根活塞
    const B = bone(wx, wy, wx + Math.cos(a) * 34, wy + Math.sin(a) * 34);
    pn.poly(B.pts([[-8, -1.8], [-8, 1.8], [30, 1.8], [30, -1.8]])).paint(M.leather);
    pn.poly(B.pts([[33, 12], [42, 13.5], [42, 18], [33, 17]])).paint(M.steam, { bevel: 'l' });
    pn.poly(B.pts([[26, -13], [26, 13], [44, 15], [44, -15]])).paint(shell(s, M));
    for (const aa of [29, 38]) pn.poly(B.pts([[aa, -13.5], [aa + 2, -13.5], [aa + 2, 13.5], [aa, 13.5]])).paint(M.brass, { outline: false });
    pn.poly(B.pts([[34, -20], [38, -20], [38, -14], [34, -14]])).paint(M.dark);
  }
  function bigGun(pn, ex, ey, s, M, o) {
    const k = Math.round((o.recoil || 0) * 4), R = shell(s, M);
    pn.disc(ex + 2 - k, ey + 11, 6.5).paint(M.brass); pn.disc(ex + 2 - k, ey + 11, 3).paint(M.dark, { outline: false });
    pn.rect(ex - 8 - k, ey - 7, 20, 15).paint(R);
    pn.poly([[ex + 10 - k, ey - 5], [ex + 50 - k, ey - 4], [ex + 50 - k, ey + 4], [ex + 10 - k, ey + 5]]).paint(R);
    pn.rect(ex + 48 - k, ey - 6, 8, 12).paint(M.brass);
    pn.fill(ex + 55 - k, ey - 2, 1, 4, P.black);
    for (const xx of [16, 28, 40]) pn.fill(ex + xx - k, ey - 5, 2, 10, P.brass[2]);
    pn.ln(ex + 12 - k, ey - 3, ex + 46 - k, ey - 2, R[3]);
    pn.rect(ex + 12 - k, ey + 5, 5, 7).paint(M.dark);
    rivet(pn, ex - 6 - k, ey - 5);
  }
  function shieldOn(pn, cx, cy, s, M) {
    if (s === 'L') {
      pn.poly([[cx - 11, cy - 20], [cx + 11, cy - 20], [cx + 11, cy + 14], [cx, cy + 22], [cx - 11, cy + 14]]).paint(M.iron);
      pn.ln(cx, cy - 17, cx, cy + 18, M.iron[3]);
      pn.fill(cx - 7, cy - 14, 14, 2, P.black);
      pn.disc(cx, cy + 1, 4).paint(M.brass); pn.dot(cx - 1, cy, P.brass[3]);
      for (const yy of [-17, -6, 9]) { rivet(pn, cx - 10, cy + yy); rivet(pn, cx + 7, cy + yy); }
    } else {
      pn.poly([[cx - 13, cy - 21], [cx + 13, cy - 21], [cx + 13, cy + 3], [cx, cy + 24], [cx - 13, cy + 3]]).paint(M.brass);
      pn.poly([[cx - 11, cy - 19], [cx + 11, cy - 19], [cx + 11, cy + 2], [cx, cy + 21], [cx - 11, cy + 2]]).paint(M.steel, { outline: false });
      pn.ln(cx - 10, cy - 18, cx - 10, cy + 1, M.steel[3]);
      gear(pn, cx, cy - 5, 6, 10, 0.2, M.brass, M.steel);
      pn.fill(cx - 1, cy + 4, 2, 12, P.brass[2]);
    }
  }

  // ---------- 车体框架：子格外轮廓，露在外面的角切 4px ----------
  function hull(pn, cells, M, sty) {
    const has = (c, r) => cells.has(c + ',' + r);
    for (const key of cells) {
      const [c, r] = key.split(',').map(Number), x = PADX + c * S, y = r * S, n = 4;
      const tl = !has(c - 1, r) && !has(c, r - 1) && !has(c - 1, r - 1);
      const tr = !has(c + 1, r) && !has(c, r - 1) && !has(c + 1, r - 1);
      const br = !has(c + 1, r) && !has(c, r + 1) && !has(c + 1, r + 1);
      const bl = !has(c - 1, r) && !has(c, r + 1) && !has(c - 1, r + 1);
      pn.poly([
        [x + (tl ? n : 0), y], [x + S - (tr ? n : 0), y], [x + S, y + (tr ? n : 0)], [x + S, y + S - (br ? n : 0)],
        [x + S - (br ? n : 0), y + S], [x + (bl ? n : 0), y + S], [x, y + S - (bl ? n : 0)], [x, y + (tl ? n : 0)],
      ]);
    }
    pn.paint(LOOK[sty].hull(M));
  }

  // ---------- 整机：同一套零件装在三种底盘上 ----------
  // chassis：biped（胯在子格列 PC，腿区在最底两行子格）/ track / spider（占子格列 c0..c1，最底两行）
  const PC = 7;
  const MECHS = [
    { name: '双足 · 剑士', sty: 'L', chassis: 'biped', legs: 'heron',
      parts: [['helm', 7, 5], ['plate', 6, 5], ['furnace', 7, 6], ['tank', 6, 6], ['jar', 6, 8], ['arm_sword', 7, 6]],
      note: '头盔正好在胯的正上方。剑臂的肩膀就在胸口中间，剑斜指前上方，伸出格外。' },
    { name: '双足 · 圣骑', sty: 'K', chassis: 'biped', legs: 'knight',
      parts: [['helm', 7, 5], ['plate', 6, 5], ['furnace', 7, 6], ['tank', 6, 6], ['plate', 6, 8], ['plate', 8, 8], ['arm_shield', 7, 6], ['heavy', 6, 3]],
      note: '盾臂挡在胸前，背上一门重炮越过头顶。重炮和侧炮、手臂是同一层、同一套规则。' },
    { name: '双足 · 锤', sty: 'K', chassis: 'biped', legs: 'gren',
      parts: [['helm', 7, 5], ['plate', 6, 5], ['furnace', 7, 6], ['tank', 6, 6], ['jar', 8, 8], ['arm_hammer', 7, 6]],
      note: '换一双腿（掷弹兵），零件照用。蒸汽锤拖在身前，锤头背后一根活塞。' },
    { name: '双足 · 巨炮', sty: 'L', chassis: 'biped', legs: 'dragon',
      parts: [['helm', 7, 5], ['plate', 6, 5], ['furnace', 7, 6], ['tank', 6, 6], ['plate', 6, 8], ['arm_cannon', 7, 6]],
      note: '整条小臂换成一门巨炮，炮管伸出块外一格多，弹鼓挂在炮尾下面。' },
    { name: '双足 · 轻骑（v4 新件）', sty: 'L', chassis: 'biped', legs: 'heron',
      parts: [['helm', 7, 5], ['pauldron', 6, 5], ['pauldron', 8, 5], ['plate', 6, 6], ['plate', 8, 6], ['plate', 7, 6], ['jar', 6, 7], ['plate', 7, 7], ['plate', 8, 7], ['backboiler', 5, 6], ['arm_mg', 7, 6]],
      note: '背负锅炉背在躯干后面一列，烟囱从肩后伸出来冒烟（机甲剪影最重要的一笔）；头盔两边一对叠片肩甲；腕枪臂：护手拳 + 小臂上一挺短机枪。' },
    { name: '双足 · 突击（v4 新件）', sty: 'K', chassis: 'biped', legs: 'knight',
      parts: [['helm', 7, 5], ['pauldron', 8, 5], ['plate', 6, 5], ['furnace', 7, 6], ['tank', 6, 6], ['backjar', 5, 6], ['jetpack', 5, 7], ['arm_fist', 7, 6]],
      note: '钢制：前肩一片带护颈的圆肩甲；背后上面一对背水罐、下面一只喷汽背包（走起来喷口往下冒汽）；格斗臂。' },
    { name: '双足 · 圣骑 + 背锅炉（v4）', sty: 'K', chassis: 'biped', legs: 'knight',
      parts: [['helm', 7, 5], ['pauldron', 6, 5], ['pauldron', 8, 5], ['plate', 6, 6], ['plate', 7, 6], ['plate', 8, 6], ['tank', 6, 7], ['plate', 7, 7], ['backboiler', 5, 5], ['arm_shield', 7, 6]],
      note: '原来的圣骑把燃炉换成背负锅炉：躯干空出来全是甲片，更轻；钢制背锅炉带压力表和黄铜防火星罩。' },
    { name: '履带 · 腕枪臂也能装（v4）', sty: 'L', chassis: 'track', c0: 4, c1: 9,
      parts: [['tank', 4, 8], ['furnace', 5, 8], ['plate', 7, 9], ['plate', 8, 9], ['jar', 8, 8], ['helm', 7, 8], ['plate', 6, 7], ['pauldron', 7, 7], ['arm_mg', 6, 7]],
      note: '手臂是新模块，别的底盘也能装：履带车顶上一条腕枪臂 + 一片肩甲，只是没有双足好看。' },
    { name: '履带 · 同一套零件', sty: 'L', chassis: 'track', c0: 4, c1: 9,
      parts: [['tank', 4, 8], ['furnace', 5, 8], ['plate', 7, 9], ['plate', 8, 9], ['jar', 8, 8], ['helm', 7, 8], ['plate', 6, 7], ['heavy', 5, 5], ['sidegun', 8, 7]],
      note: '履带也用子格零件：燃炉、水罐、头盔驾驶舱照样装，重炮架在顶上，侧炮从车体伸出。' },
    { name: '蜘蛛 · 同一套零件', sty: 'K', chassis: 'spider', c0: 4, c1: 9,
      parts: [['tank', 5, 8], ['furnace', 6, 8], ['plate', 8, 9], ['jar', 8, 8], ['helm', 6, 7], ['plate', 4, 9], ['arm_hammer', 7, 7]],
      note: '蜘蛛背着同一套零件，外加一条锤臂：附加层对所有底盘规则一样。' },
  ];
  for (const m of MECHS) {
    m.body = new Set(); m.add = [];
    for (const [id, c, r] of m.parts) {
      const pt = PARTS[id];
      if (pt.layer === 'add') { m.add.push([id, c, r]); continue; }
      for (let i = 0; i < pt.w; i++) for (let j = 0; j < pt.h; j++) m.body.add((c + i) + ',' + (r + j));
    }
  }

  const MAT = (far) => {
    const B = far ? FAR : NEAR, dim = (r) => (far ? [P.black, r[0], r[1], r[2]] : r);
    return { ...B, glass: dim([P.glass[0], P.glass[1], P.glass[2], P.glass[3]]), water: dim([P.water[0], P.water[1], P.water[2], P.water[3]]) };
  };
  const VX = PADX + 2 * S, VY = 60, VW = 12 * S, VH = B2.GROUND + 10 - VY;

  const pens = new Map();
  const penFor = (cv) => { let pn = pens.get(cv); if (!pn) { pn = Pen(cv.width, cv.height); pens.set(cv, pn); } return pn; };
  function render(cv, m, st) {
    const g = cv.getContext('2d'), pn = penFor(cv);
    g.clearRect(0, 0, cv.width, cv.height);
    const N = 12, gf = st.mv ? SA.Dyn.frame(st.phase, N, 60 / N) : 0, a = gf / N * TAU;
    const amp = m.chassis === 'biped' ? 4 : m.chassis === 'spider' ? 1 : 0;
    const bd = amp - Math.round(Math.abs(Math.sin(a)) * amp);
    const o = { mv: st.mv, a, bd, q: gf * 5, phase: st.phase, t: st.t, fl: Math.floor(st.t * 8) % 4, ri: 0, rn: 1,
      swing: st.mv && m.chassis === 'biped' ? -Math.sin(a) : 0, blink: Math.floor(st.t * 1.3) % 5 === 0 && (st.t * 1.3) % 1 < 0.25 };
    const M = MAT(false), MF = MAT(true);
    pn.at(1, -VX, -VY);
    pn.fill(VX, B2.GROUND, VW, 10, P.bg[4]).fill(VX, B2.GROUND, VW, 1, P.bg[5]);
    const cx = PADX + PC * S + 12, D = m.legs ? B2.legDesign(m.legs).d : null;
    const cells = [];
    if (m.c0 != null) for (let c = m.c0; c <= m.c1; c += 2) cells.push(c);
    const H = { up: 22, kx: 12, reach: 26 }, dirOf = (ri) => (ri < cells.length / 2 ? -1 : 1);
    // 远侧：腿 / 蜘蛛腿 + 手臂（压暗、右上错位，只画空手）
    if (st.far) {
      if (m.chassis === 'biped') B2.bipedLeg(pn, D, cx, o, true);
      if (m.chassis === 'spider') cells.forEach((c, ri) => B2.spiderLeg(pn, FAR, PADX + c * S + 30, 5 * 48 + bd + 7, B2.GROUND - 3, -dirOf(ri), Math.PI, { ...o, a: o.a + ri * Math.PI }, H));
      pn.at(1, -VX - 6, -VY + bd - 3);
      for (const [id, c, r] of m.add) if (PARTS[id].arm) arm(pn, PADX + c * S, r * S, m.sty, MF, { ...o, swing: -o.swing }, 'fist');
    }
    pn.at(1, -VX, -VY + bd);
    if (st.hull) hull(pn, m.body, M, m.sty);
    for (const [id, c, r] of m.parts) if (PARTS[id].layer === 'body') PARTS[id].draw(pn, PADX + c * S, r * S, m.sty, M, o);
    pn.at(1, -VX, -VY);
    if (m.chassis === 'biped') {
      const waist = [...m.body].map(k => k.split(',').map(Number)).filter(([c, r]) => r >= 8 && Math.abs(c - PC) === 1).map(([c]) => ({ r: 4, c: c < PC ? 2 : 4 }));
      B2.pelvis(pn, { pc: 3, bal: { tone: 'ok', d: 0 }, cells: waist }, m.legs, st, bd, cx);
      B2.bipedLeg(pn, D, cx, o, false);
    } else if (m.chassis === 'spider') {
      cells.forEach((c, ri) => B2.carapace(pn, PADX + c * S, 5 * 48 + bd, ri > 0, ri < cells.length - 1));
      cells.forEach((c, ri) => B2.spiderLeg(pn, NEAR, PADX + c * S + 22, 5 * 48 + bd + 10, B2.GROUND, dirOf(ri), 0, { ...o, a: o.a + ri * Math.PI }, H));
    }
    pn.flush(g);
    if (m.chassis === 'track') cells.forEach((c, ri) => SA.SPR.drawModule(g, 'track', PADX + c * S - VX, 5 * 48 - VY,
      { moving: st.mv, phase: st.phase, connL: ri > 0, connR: ri < cells.length - 1, top: true }));
    // 附加层：画在最前面
    pn.at(1, -VX, -VY + bd);
    for (const [id, c, r] of m.add) PARTS[id].draw(pn, PADX + c * S, r * S, m.sty, M, o);
    pn.flush(g);
    if (st.grid) subgrid(g, m, bd);
  }
  function subgrid(g, m, bd) {
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(228,224,214,0.16)';
    for (let c = 0; c <= 16; c++) { const x = PADX + c * S - VX + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, VH); g.stroke(); }
    for (let r = 0; r <= 12; r++) { const y = r * S - VY + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke(); }
    g.fillStyle = 'rgba(255,43,214,0.13)'; g.strokeStyle = 'rgba(255,43,214,0.7)'; g.setLineDash([3, 2]);
    for (const [id, c, r] of m.add) {
      const x = PADX + c * S - VX, y = r * S - VY + bd, w = PARTS[id].w * S, h = PARTS[id].h * S;
      g.fillRect(x, y, w, h); g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    g.restore();
  }

  // 零件表里的单件：车体层零件带一块车体框架，附加层零件下面垫一块示意用的车体
  function renderPart(cv, id, sty, st) {
    const g = cv.getContext('2d'), pn = penFor(cv), pt = PARTS[id];
    g.clearRect(0, 0, cv.width, cv.height);
    const o = { mv: false, a: 0, t: st.t, fl: Math.floor(st.t * 8) % 4, swing: 0 };
    pn.at(1, -PADX + 10 + (id === 'sidegun' ? S : 0), 14 + (id === 'backboiler' ? 34 : 0));
    const cells = new Set();
    if (pt.layer === 'body') for (let i = 0; i < pt.w; i++) for (let j = 0; j < pt.h; j++) cells.add(i + ',' + j);
    else if (pt.arm) for (const k of ['0,0', '0,1', '1,1', '0,2']) cells.add(k);
    else if (id === 'sidegun') cells.add('-1,0');
    else for (let i = 0; i < pt.w; i++) cells.add(i + ',' + pt.h);
    hull(pn, cells, MAT(false), sty);
    pt.draw(pn, PADX, 0, sty, MAT(false), o);
    pn.flush(g);
  }
  const partBox = (id) => { const pt = PARTS[id]; return { w: pt.w * S + (pt.layer === 'add' ? 48 : 20) + (id === 'sidegun' ? 24 : 0), h: pt.h * S + 30 + (id === 'heavy' ? S : 0) + (id === 'backboiler' ? 34 : id === 'jetpack' ? 14 : 0) }; };

  return { PARTS, LOOK, MECHS, render, renderPart, partBox, VW, VH, S };
})();
