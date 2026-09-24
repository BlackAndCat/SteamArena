// 机甲套件 · 视觉验证（tools/mech-kit.html 专用）：模块缩小到 1/4（24px 子格，一个旧格 = 2×2 子格），
// 以轻骑（鹭步腿）和圣骑（蒸汽圣骑腿）为核心，各画一套头盔驾驶舱 / 燃炉 / 水罐 / 机械臂 / 盾牌 / 甲片，
// 检验模块化拼装能不能拼出协调匀称的双足机甲。只做视觉，不涉及数值。
window.SA = window.SA || {};

SA.MECHKIT = (() => {
  const P = SA.PAL, S = 24, PADX = SA.SPR.PADX, TAU = Math.PI * 2;
  const { Pen, U } = SA.LEGLAB;
  const { NEAR, FAR, bone, gear, rivet } = U;
  const B2 = SA.BIPED2;

  // ---------- 两套风格的材质 ----------
  // 轻骑：暗铁 + 黄铜关节（鹭步腿）；圣骑：亮钢 + 黄铜包边（圣骑腿）
  const STYLE = {
    L: { name: '轻骑', legs: 'heron', body: 'iron', trim: 'brass', hull: (M) => [M.iron[0], M.iron[1], M.iron[1], M.iron[2]] },
    K: { name: '圣骑', legs: 'knight', body: 'steel', trim: 'brass', hull: (M) => [M.iron[0], M.iron[1], M.iron[2], M.iron[3]] },
  };
  const SOOT = ['#141824', '#2f3850', '#6a7a9c'];

  // ---------- 零件（坐标：块的左上角，单位 px） ----------
  // 每个零件：w×h 子格、layer（body 车体 / limb 肢体层，画在车体前面，相当于现在的侧挂层）、draw(pn, x, y, sty, M, o)
  const PARTS = {
    helm: {
      name: '头盔驾驶舱', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        if (s === 'L') {
          // 潜水盔：圆顶 + 黄铜领圈 + 圆舷窗，窗里是小黑炭球驾驶员
          pn.disc(x + 12, y + 12, 10).rect(x + 2, y + 12, 20, 10).paint(M.iron);
          pn.rect(x + 1, y + 19, 22, 4).paint(M.brass);
          pn.disc(x + 14, y + 11, 6.2).paint(M.brass);
          pn.disc(x + 14, y + 11, 4.6).paint([M.glass[0], M.glass[0], M.glass[0], M.glass[1]], { outline: false });
          pn.disc(x + 14, y + 12, 3.6).paint([SOOT[0], SOOT[1], SOOT[1], SOOT[2]], { outline: false });
          const blink = o.blink;
          for (const ex of [x + 13, x + 16]) {
            if (blink) { pn.fill(ex, y + 11, 2, 1, P.steam[2]); continue; }
            pn.fill(ex, y + 10, 2, 2, P.white); pn.fill(ex + 1, y + 11, 1, 1, P.black);
          }
          pn.dot(x + 11, y + 8, M.glass[3]);
          pn.rect(x + 7, y + 1, 4, 3).paint(M.brass, { bevel: 'l' });
          rivet(pn, x + 4, y + 14);
        } else {
          // 桶盔：平顶、正面一道横向目缝（缝里透出驾驶员的两点眼光），黄铜十字加强筋 + 冠脊
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
        const coal = (cx, cy, r) => {
          pn.disc(cx, cy, r).paint([P.black, M.fire[0], M.fire[0], M.fire[0]], { outline: false, bevel: '' });
          for (let k = 0; k < 9; k++) {
            const a = k * 2.4, rr = (k % 3 + 1) / 3.4 * r;
            pn.dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (k + o.fl) % 4 === 0 ? M.fire[3] : (k + o.fl) % 2 ? M.fire[2] : M.fire[1]);
          }
        };
        if (s === 'L') {
          // 圆筒炉：两道黄铜箍、圆形炉门（铁栅栏后闷燃的煤）
          pn.poly([[x + 3, y + 8], [x + 8, y + 3], [x + 40, y + 3], [x + 45, y + 8], [x + 45, y + 45], [x + 3, y + 45]]).paint(M.iron);
          for (const yy of [9, 40]) pn.rect(x + 3, y + yy, 42, 3).paint(M.brass, { outline: false });
          pn.disc(x + 24, y + 26, 11.5).paint(M.brass);
          coal(x + 24, y + 26, 9.5);
          for (let k = -2; k <= 2; k++) pn.fill(x + 23 + k * 4, y + 17, 1, 19, P.dark[0]);
          pn.disc(x + 39, y + 20, 3.4).paint(M.brass); pn.disc(x + 39, y + 20, 2.3).paint(flatGauge(M), { outline: false, bevel: '' });
          pn.ln(x + 39, y + 20, x + 40, y + 18, P.dark[0]);
          rivet(pn, x + 6, y + 16); rivet(pn, x + 6, y + 33);
        } else {
          // 胸甲炉：胸甲往腰部收，中间一扇哥特尖拱炉栅
          pn.poly([[x + 3, y + 3], [x + 45, y + 3], [x + 45, y + 30], [x + 36, y + 45], [x + 12, y + 45], [x + 3, y + 30]]).paint(M.steel);
          pn.fill(x + 4, y + 4, 40, 2, P.brass[2]);
          pn.ln(x + 5, y + 8, x + 17, y + 20, M.steel[3]); pn.ln(x + 43, y + 8, x + 31, y + 20, M.steel[1]);
          const arch = [[x + 16, y + 40], [x + 16, y + 22], [x + 24, y + 12], [x + 32, y + 22], [x + 32, y + 40]];
          pn.poly(arch).paint(M.brass);
          pn.poly([[x + 18, y + 39], [x + 18, y + 23], [x + 24, y + 15], [x + 30, y + 23], [x + 30, y + 39]]).paint([P.black, M.fire[0], M.fire[0], M.fire[0]], { outline: false, bevel: '' });
          for (let k = 0; k < 12; k++) pn.dot(x + 19 + (k * 5) % 11, y + 20 + (k * 7) % 18, (k + o.fl) % 4 === 0 ? M.fire[3] : (k + o.fl) % 2 ? M.fire[2] : M.fire[1]);
          for (const xx of [21, 24, 27]) pn.fill(x + xx, y + 16, 1, 24, P.dark[0]);
          rivet(pn, x + 7, y + 10); rivet(pn, x + 39, y + 10);
        }
      },
    },
    tank: {
      name: '水罐', w: 1, h: 2, layer: 'body',
      draw(pn, x, y, s, M, o) {
        pn.cap(x + 12, y + 12, x + 12, y + 37, 9).paint(s === 'L' ? M.iron : M.steel);
        for (const yy of [8, 39]) pn.rect(x + 3, y + yy, 18, 2).paint(M.brass, { outline: false });
        pn.rect(x + 9, y + 13, 7, 23).paint([M.iron[0], M.iron[0], M.glass[0], M.glass[0]], { bevel: '' });
        const lv = Math.round(21 * (o.water == null ? 0.7 : o.water));
        pn.fill(x + 10, y + 35 - lv, 5, lv, M.water[2]); pn.fill(x + 10, y + 35 - lv, 5, 1, M.water[3]);
        pn.dot(x + 12, y + 33 - ((o.fl * 3) % Math.max(1, lv)), M.water[3]);
        pn.rect(x + 9, y + 1, 6, 4).paint(M.brass, { bevel: 'l' });
        if (s === 'K') { pn.ln(x + 5, y + 12, x + 5, y + 36, M.steel[3]); pn.ln(x + 19, y + 12, x + 19, y + 36, M.steel[1]); }
      },
    },
    jar: {
      name: '小水罐', w: 1, h: 1, layer: 'body',
      draw(pn, x, y, s, M, o) {
        pn.cap(x + 12, y + 10, x + 12, y + 15, 8).paint(s === 'L' ? M.iron : M.steel);
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
    arm: {
      name: '机械臂', w: 1, h: 2, layer: 'limb',
      draw(pn, x, y, s, M, o) { arm(pn, x, y, s, M, o, 'hand'); },
    },
    armgun: {
      name: '臂炮', w: 1, h: 2, layer: 'limb',
      draw(pn, x, y, s, M, o) { arm(pn, x, y, s, M, o, 'gun'); },
    },
    shield: {
      name: '盾牌', w: 1, h: 2, layer: 'limb', grip: true,
      draw(pn, x, y, s, M, o) {
        const dx = Math.round(o.swing * 2); x += dx;
        if (s === 'L') {
          // 铆接塔盾：窄长、上方一道观察缝、黄铜盾心
          pn.poly([[x + 3, y + 3], [x + 21, y + 3], [x + 21, y + 39], [x + 12, y + 46], [x + 3, y + 39]]).paint(M.iron);
          pn.ln(x + 12, y + 6, x + 12, y + 42, M.iron[3]);
          pn.fill(x + 6, y + 9, 12, 2, P.black);
          pn.disc(x + 12, y + 25, 3.6).paint(M.brass); pn.dot(x + 11, y + 24, P.brass[3]);
          for (const yy of [6, 16, 34]) { rivet(pn, x + 4, y + yy); rivet(pn, x + 18, y + yy); }
        } else {
          // 鸢尾盾（heater）：黄铜包边 + 齿轮纹章
          pn.poly([[x + 1, y + 3], [x + 23, y + 3], [x + 23, y + 26], [x + 12, y + 46], [x + 1, y + 26]]).paint(M.brass);
          pn.poly([[x + 3, y + 5], [x + 21, y + 5], [x + 21, y + 25], [x + 12, y + 43], [x + 3, y + 25]]).paint(M.steel, { outline: false });
          pn.ln(x + 4, y + 6, x + 4, y + 24, M.steel[3]);
          gear(pn, x + 12, y + 20, 5, 8, 0.2 + (o.t || 0) * 0, M.brass, M.steel);
          pn.fill(x + 11, y + 28, 2, 10, P.brass[2]);
        }
      },
    },
  };
  const flatGauge = (M) => [M.gauge[1], M.gauge[1], P.steam[2], P.steam[2]];

  // 机械臂：肩在块顶，上臂往下到肘，前臂往前伸；随步伐反向摆
  function arm(pn, x, y, s, M, o, end) {
    const sx = x + 7, sy = y + 7, sw = o.swing || 0;
    const ex = sx + 1 + sw * 3, ey = sy + 17;
    const hx = end === 'gun' ? ex + 12 : ex + 7 + sw * 2, hy = end === 'gun' ? ey + 1 : ey + 15;
    if (s === 'L') {
      pn.cap(sx, sy, ex, ey, 2.4).paint(M.leg);
      pn.ln(sx + 3, sy + 3, ex + 2, ey - 3, M.steam[3]);
      pn.disc(ex, ey, 3).paint(M.brass); pn.dot(ex, ey, P.brass[0]);
      if (end === 'gun') gun(pn, ex, ey, M, s, o);
      else {
        const F = bone(ex, ey, hx, hy);
        pn.poly(F.pts([[0, -2.2], [0, 2.2], [F.len, 3.2], [F.len, -3.2]])).paint(M.iron);
        for (const [a, f] of [[3.2, 2.6], [4, 0], [3.2, -2.6]]) { const [px, py] = F.p(F.len + a, f); pn.cap(...F.p(F.len, f * 0.7), px, py, 0.8); }
        pn.paint(M.brass, { bevel: 'l' });
      }
      pn.disc(sx, sy, 4.6).paint(M.brass); pn.disc(sx, sy, 2).paint(M.iron, { outline: false });
    } else {
      pn.cap(sx, sy, ex, ey, 3).paint(M.steel);
      if (end === 'gun') gun(pn, ex, ey, M, s, o);
      else {
        const F = bone(ex, ey, hx, hy);
        pn.poly(F.pts([[0, -3], [0, 3], [F.len - 2, 3.6], [F.len - 2, -3.2]])).paint(M.steel);
        pn.poly(F.pts([[F.len - 3, -3.4], [F.len - 3, 3.8], [F.len + 3, 3.4], [F.len + 3.5, -2.8]])).paint(M.steel);
        pn.ln(...F.p(F.len - 1, -3), ...F.p(F.len - 1, 3.4), M.steel[1]);
        pn.ln(...F.p(1, 1.6), ...F.p(F.len - 4, 2), M.steel[3]);
      }
      // 肘甲：和护膝同款的黄铜扇翼
      pn.disc(ex - 2, ey + 0.5, 4.2).paint(M.brass);
      for (let k = 0; k < 4; k++) { const a = Math.PI * (0.55 + k / 3 * 0.9); pn.ln(ex - 2 + Math.cos(a) * 1.2, ey + 0.5 + Math.sin(a) * 1.2, ex - 2 + Math.cos(a) * 3.6, ey + 0.5 + Math.sin(a) * 3.6, M.brass[1]); }
      pn.disc(ex + 0.5, ey, 2.4).paint(M.steel);
      // 肩甲：两层甲片 + 黄铜包边
      pn.poly([[x - 1, y + 13], [x + 1, y + 16], [x + 17, y + 17], [x + 19, y + 13]]).paint(M.steel);
      pn.poly([[x - 2, y + 11], [x - 1, y + 4], [x + 5, y], [x + 14, y + 1], [x + 20, y + 6], [x + 20, y + 12]]).paint(M.steel);
      pn.ln(x - 1, y + 11, x + 19, y + 12, P.brass[2]); pn.ln(x + 1, y + 15, x + 17, y + 16, P.brass[2]);
      pn.ln(x + 1, y + 4, x + 6, y + 1, M.steel[3]); pn.ln(x + 6, y + 2, x + 12, y + 10, M.steel[1]);
      rivet(pn, x + 13, y + 5);
    }
  }
  // 臂炮：前臂换成一根向前的炮管（伸出块外 1/2 子格）
  function gun(pn, ex, ey, M, s, o) {
    const k = Math.round((o.recoil || 0) * 3);
    pn.rect(ex - 2 - k, ey - 3, 22, 6).paint(s === 'L' ? M.iron : M.steel);
    pn.rect(ex + 18 - k, ey - 4, 4, 8).paint(M.brass);
    pn.fill(ex + 21 - k, ey - 1, 1, 2, P.black);
    for (const xx of [4, 10]) pn.fill(ex + xx - k, ey - 3, 2, 6, P.brass[2]);
    pn.rect(ex - 4, ey + 2, 8, 6).paint(M.dark);
  }

  // ---------- 车体：子格外轮廓 + 露在外面的角切 4px ----------
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
    pn.paint(STYLE[sty].hull(M));
  }

  // ---------- 整机 ----------
  // parts: [id, 子格列, 子格行]；old: 旧的 48px 模块 [id, 子格列, 子格行]（占 2×2 子格，对齐偶数子格）
  const MECHS = [
    { name: '轻骑 · 子模块', sty: 'L',
      parts: [['furnace', 6, 6], ['tank', 5, 6], ['helm', 7, 5], ['plate', 6, 5], ['jar', 5, 8], ['arm', 8, 6]],
      note: '胸口一座圆筒燃炉，背一只水罐，头盔驾驶舱探在前上方，腰挂一只小水罐，前面一条机械爪。躯干只有 3×3 子格（1.5×1.5 旧格），和长腿比例刚好。' },
    { name: '圣骑 · 子模块', sty: 'K',
      parts: [['furnace', 6, 6], ['tank', 5, 6], ['helm', 7, 5], ['plate', 6, 5], ['plate', 5, 8], ['plate', 8, 8], ['arm', 7, 6], ['shield', 8, 6]],
      note: '胸甲燃炉往腰部收，桶盔 + 黄铜冠脊；手臂压在胸口前面（肢体层可以盖住车体），肩甲、肘甲扇翼和腿上的护膝同款；两块甲片挂在腰挂位就是草摺；盾举在前方。' },
    { name: '圣骑 · 臂炮', sty: 'K',
      parts: [['furnace', 6, 6], ['tank', 5, 6], ['helm', 7, 5], ['plate', 6, 5], ['plate', 5, 8], ['armgun', 8, 6], ['jar', 8, 8]],
      note: '同一副躯干把盾和手换成臂炮：武器也可以做成肢体层零件，而不是一格方炮塔。' },
    { name: '轻骑 · 加宽', sty: 'L',
      parts: [['furnace', 6, 6], ['tank', 5, 6], ['tank', 4, 6], ['helm', 7, 5], ['plate', 6, 5], ['plate', 5, 5], ['plate', 8, 6], ['plate', 8, 7], ['jar', 5, 8], ['jar', 8, 8], ['armgun', 9, 6]],
      note: '同一套零件往外多堆一圈（4 子格宽）：仍然像机甲，但开始变成箱子。子格让「堆多了」也是逐步变难看，而不是一下子变成房子。' },
    { name: '圣骑 · 混搭旧模块', sty: 'K',
      parts: [['furnace', 6, 6], ['tank', 5, 6], ['plate', 5, 8], ['plate', 8, 8], ['arm', 8, 6]],
      old: [['cockpit', 6, 4], ['cannon', 4, 4]],
      note: '把旧的 48px 驾驶舱和火炮直接放上去：细节密度和比例都对不上（驾驶舱比整个胸口还宽），旧模块在机甲上只能当「背包 / 肩炮」用。' },
  ];
  // 占格
  for (const m of MECHS) {
    m.body = new Set(); m.limb = [];
    for (const [id, c, r] of m.parts) {
      const pt = PARTS[id];
      if (pt.layer === 'limb') { m.limb.push([id, c, r]); continue; }
      for (let i = 0; i < pt.w; i++) for (let j = 0; j < pt.h; j++) m.body.add((c + i) + ',' + (r + j));
    }
    for (const [, c, r] of m.old || []) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) m.body.add((c + i) + ',' + (r + j));
  }

  const MAT = (far) => {
    const B = far ? FAR : NEAR, dim = (r) => (far ? [P.black, r[0], r[1], r[2]] : r);
    return { ...B, glass: dim([P.glass[0], P.glass[1], P.glass[2], P.glass[3]]), water: dim([P.water[0], P.water[1], P.water[2], P.water[3]]), gauge: B.gauge };
  };
  const VX = PADX + 2 * S, VY = 64, VW = 10 * S, VH = B2.GROUND + 10 - VY;

  const pens = new Map();
  const penFor = (cv) => { let pn = pens.get(cv); if (!pn) { pn = Pen(cv.width, cv.height); pens.set(cv, pn); } return pn; };
  function render(cv, m, st) {
    const g = cv.getContext('2d'), pn = penFor(cv);
    g.clearRect(0, 0, cv.width, cv.height);
    const N = 12, gf = st.mv ? SA.Dyn.frame(st.phase, N, 60 / N) : 0, a = gf / N * TAU;
    const bd = 4 - Math.round(Math.abs(Math.sin(a)) * 4);
    const o = { mv: st.mv, a, bd, q: gf * 5, phase: st.phase, t: st.t, fl: Math.floor(st.t * 8) % 4, ri: 0, rn: 1,
      swing: st.mv ? -Math.sin(a) : 0, water: 0.7, blink: Math.floor(st.t * 1.3) % 5 === 0 && (st.t * 1.3) % 1 < 0.25 };
    const sty = STYLE[m.sty], D = B2.legDesign(sty.legs).d, cx = PADX + 3 * 48 + 24;
    const M = MAT(false), MF = MAT(true);
    pn.at(1, -VX, -VY);
    pn.fill(VX, B2.GROUND, VW, 10, P.bg[4]).fill(VX, B2.GROUND, VW, 1, P.bg[5]);
    // 远侧：腿 + 肢体（压暗、右上错位）
    if (st.far) {
      B2.bipedLeg(pn, D, cx, o, true);
      pn.at(1, -VX - 6, -VY + bd - 3);
      for (const [id, c, r] of m.limb) if (!PARTS[id].grip) PARTS[id].draw(pn, PADX + c * S, r * S, m.sty, MF, { ...o, swing: -o.swing });
    }
    pn.at(1, -VX, -VY + bd);
    if (st.hull) hull(pn, m.body, M, m.sty);
    for (const [id, c, r] of m.parts) if (PARTS[id].layer === 'body') PARTS[id].draw(pn, PADX + c * S, r * S, m.sty, M, o);
    pn.flush(g);
    for (const [id, c, r] of m.old || []) SA.SPR.drawModule(g, id, PADX + c * S - VX, r * S - VY + bd, { t: st.t, heat: 0.5 });
    // 胯 + 近侧腿
    pn.at(1, -VX, -VY);
    const waist = [...m.body].map(k => k.split(',').map(Number)).filter(([, r]) => r === 8).map(([c]) => ({ r: 4, c: c < 6 ? 2 : 4 }));
    B2.pelvis(pn, { pc: 3, bal: { tone: 'ok', d: 0 }, cells: waist }, sty.legs, st, bd);
    B2.bipedLeg(pn, D, cx, o, false);
    // 肢体层：画在最前面
    pn.at(1, -VX, -VY + bd);
    for (const [id, c, r] of m.limb) PARTS[id].draw(pn, PADX + c * S, r * S, m.sty, M, o);
    pn.flush(g);
    if (st.grid) subgrid(g, m, bd);
  }
  function subgrid(g, m, bd) {
    g.save();
    g.strokeStyle = 'rgba(228,224,214,0.18)'; g.lineWidth = 1;
    for (let c = 0; c <= 16; c++) { const x = PADX + c * S - VX + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, VH); g.stroke(); }
    for (let r = 0; r <= 12; r++) { const y = r * S - VY + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke(); }
    g.strokeStyle = 'rgba(245,215,122,0.35)';
    for (let c = 0; c <= 8; c++) { const x = PADX + c * 48 - VX + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, VH); g.stroke(); }
    for (let r = 0; r <= 6; r++) { const y = r * 48 - VY + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke(); }
    g.fillStyle = 'rgba(255,43,214,0.16)';
    for (const [id, c, r] of m.limb) g.fillRect(PADX + c * S - VX, r * S - VY + bd, PARTS[id].w * S, PARTS[id].h * S);
    g.restore();
  }

  // 零件表里的单件
  function renderPart(cv, id, sty, st) {
    const g = cv.getContext('2d'), pn = penFor(cv), pt = PARTS[id];
    g.clearRect(0, 0, cv.width, cv.height);
    const o = { mv: false, a: 0, t: st.t, fl: Math.floor(st.t * 8) % 4, swing: 0, water: 0.7 };
    pn.at(1, -PADX + 8, 8);
    const x = PADX, y = 0;
    if (pt.layer === 'body') {
      const cells = new Set();
      for (let i = 0; i < pt.w; i++) for (let j = 0; j < pt.h; j++) cells.add(i + ',' + j);
      hull(pn, cells, MAT(false), sty);
    }
    if (id === 'shield') PARTS.arm.draw(pn, x, y, sty, MAT(false), o);
    pt.draw(pn, x, y, sty, MAT(false), o);
    pn.flush(g);
  }

  return { PARTS, STYLE, MECHS, render, renderPart, VW, VH, S };
})();
