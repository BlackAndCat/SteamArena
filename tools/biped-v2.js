// 真双足 · 视觉语言样机（tools/biped-v2.html 专用）。腿的造型沿用 biped-lab.js 的六档 + 探索版。
// 真双足：一台车只有一对腿，底盘占两行——最底行是腿区（不能放模块），倒数第二行中间是胯（陀螺仪），胯两侧各一格腰挂位；
// 躯干坐在胯上，最宽 3 格。重心相对胯的偏移决定姿态（平衡 / 前倾冲锋 / 后仰炮台 / 失衡）。
// 四足改成蜘蛛：每格一对向外张开、膝盖高过机身的腿，用膝高区分型号。
window.SA = window.SA || {};

SA.BIPED2 = (() => {
  const P = SA.PAL, C = 48, PADX = SA.SPR.PADX, TAU = Math.PI * 2;
  const { Pen, DESIGNS, drawLeg, legAt, U } = SA.LEGLAB;
  const { NEAR, gait, bone } = U;
  const Y4 = 4 * C, GROUND = 6 * C;        // 腰胯层顶 / 地面
  const HIP = Y4 + 29;                      // 胯关节
  const VX = PADX + C - 16, VY = 40, VW = 6 * C + 32, VH = GROUND + 10 - VY;   // 画面截取范围
  const legDesign = (id) => DESIGNS.find(e => e.id === id);
  const ASCII = { K: 'cockpit', A: 'armor', H: 'armor_heavy', C: 'cannon', P: 'mortar', M: 'mg', O: 'boiler', W: 'water', V: 'copilot' };

  // ---------- 平衡 ----------
  // 重心 = 各模块重量（含底盘）按列加权；d 为相对胯中心的偏移（格，正 = 车头方向），h 为重心高出腰胯层几行
  function balance(b) {
    let m = 0, mx = 0, my = 0, wide = false;
    const chassis = SA.K.WEIGHT_BASE * 2 + SA.MODULES.biped.kg;
    m += chassis;
    b.cells.forEach(({ id, r, c }) => {
      const w = SA.weightOf({ id });
      m += w; mx += w * (c - b.pc); my += w * (4 - r);
      if (r >= 3 && Math.abs(c - b.pc) > 1) wide = true;
    });
    const d = mx / m, h = my / m;
    let state, tone;
    if (wide) { state = '超宽：躯干 / 腰挂最宽 3 格，不能出战'; tone = 'bad'; }
    else if (Math.abs(d) > 0.6) { state = '失衡：会摔倒，不能出战'; tone = 'bad'; }
    else if (d > 0.25) { state = '前倾 · 冲锋姿态：起步、冲撞更猛，行进射击更晃'; tone = 'lean'; }
    else if (d < -0.25) { state = '后仰 · 炮台姿态：更吃得住后坐，起步更慢'; tone = 'lean'; }
    else { state = '平衡：边走边打最稳，可以踢击'; tone = 'ok'; }
    return { d, h, wide, state, tone, kg: m, top: h > 1.8 };
  }

  // ---------- 躯干：用游戏里的整车渲染，再把底角切成斜角（向腰部收） ----------
  function parse(b) {
    b.cells = []; b.quad = [];
    b.rows.forEach((row, r) => {
      for (let c = 0; c < 8; c++) {
        const ch = row[c];
        if (ch === 'G') b.pc = c;
        else if (ch === 'Q') b.quad.push(c);
        else if (ch !== '.') b.cells.push({ id: ASCII[ch], r, c });
      }
    });
    const clean = b.rows.map(row => row.replace(/[GQ]/g, '.'));
    const v = SA.V.fromAscii(b.name, clean);
    const src = SA.SPR.renderVehicle(v, { key: 'v2' });
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d'); g.drawImage(src, 0, 0);
    if (b.pc != null) {
      const has = (r, c) => r >= 0 && r < 6 && c >= 0 && c < 8 && !!v.body[r][c];
      // 底角切斜：躯干最底一行的外端、腰挂的上下两侧都往胯收
      for (let r = 3; r <= 4; r++) for (let c = 0; c < 8; c++) {
        if (!has(r, c) || has(r + 1, c)) continue;
        const x = PADX + c * C, y = (r + 1) * C;
        if (!has(r, c - 1)) cut(g, x, y, -1, r === 4 ? 12 : 9);
        if (!has(r, c + 1)) cut(g, x + C, y, 1, r === 4 ? 12 : 9);
      }
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
        if (!has(r, c) || has(r - 1, c)) continue;
        const x = PADX + c * C, y = r * C;
        if (!has(r, c - 1) && !has(r - 1, c - 1)) cutTop(g, x, y, -1, 6);
        if (!has(r, c + 1) && !has(r - 1, c + 1)) cutTop(g, x + C, y, 1, 6);
      }
    }
    b.torso = cv;
    b.bal = b.pc != null ? balance(b) : null;
    return b;
  }
  // 从 (x, y) 这个底角往里切一个 n 像素的阶梯三角，沿斜边补 1px 描边
  function cut(g, x, y, side, n) {
    for (let i = 0; i < n; i++) {
      const w = n - i, yy = y - 1 - i;
      if (side < 0) { g.clearRect(x, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x + w, yy, 1, 1); }
      else { g.clearRect(x - w, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x - w - 1, yy, 1, 1); }
    }
  }

  function cutTop(g, x, y, side, n) {
    for (let i = 0; i < n; i++) {
      const w = n - i, yy = y + i;
      if (side < 0) { g.clearRect(x, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x + w, yy, 1, 1); }
      else { g.clearRect(x - w, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x - w - 1, yy, 1, 1); }
    }
  }

  // ---------- 胯：腰部回转环 + 倒梯形胯体 + 陀螺仪窗 ----------
  const PELVIS_MAT = { knight: 'steel', tabard: 'steel', skirt: 'steel', clock: 'brass', dragon: 'fire' };
  function ellipse(pn, cx, cy, rx, ry, tilt, front, back) {
    const n = 36, c = Math.cos(tilt), s = Math.sin(tilt);
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pn.dot(cx + x * c - y * s, cy + x * s + y * c, Math.sin(a) > 0 ? front : back);
    }
  }
  function pelvis(pn, b, legId, st, y0) {
    const cx = PADX + b.pc * C + 24, Y = Y4 + y0, mat = PELVIS_MAT[legId] || 'iron';
    const R = mat === 'steel' ? NEAR.steel : mat === 'brass' ? NEAR.brass : NEAR.iron;
    const has = (c) => b.cells.some(k => k.r === 4 && k.c === c);
    // 腰挂支架：胯两侧各两道黄铜卡箍，夹住腰挂模块
    for (const side of [-1, 1]) if (has(b.pc + side)) for (const yy of [9, 21]) pn.rect(cx + side * 26 - 3, Y + yy, 6, 4).paint(NEAR.brass, { bevel: 'l' });
    // 回转环：刻痕随步伐转
    pn.rect(cx - 17, Y - 1, 34, 6).paint(NEAR.brass);
    const sp = Math.floor((st.phase || 0) / 3);
    for (let k = 0; k < 6; k++) pn.fill(cx - 16 + ((k * 6 + sp) % 32 + 32) % 32, Y + 1, 1, 3, P.brass[0]);
    // 胯体
    pn.poly([[cx - 20, Y + 5], [cx + 20, Y + 5], [cx + 13, Y + 31], [cx - 13, Y + 31]]).paint(R);
    pn.poly([[cx - 9, Y + 30], [cx + 9, Y + 30], [cx + 5, Y + 36], [cx - 5, Y + 36]]).paint(NEAR.dark);
    U.rivet(pn, cx - 18, Y + 7); U.rivet(pn, cx + 15, Y + 7);
    // 陀螺仪：外环固定，转子绕竖轴转（椭圆宽度随角度变），失衡时整个陀螺晃
    const gy = Y + 18, wob = b.bal.tone === 'bad' ? 0.5 : b.bal.tone === 'lean' ? 0.18 : 0.04;
    const tilt = wob * Math.sin(st.t * 9) + Math.max(-0.4, Math.min(0.4, b.bal.d * 0.5));
    pn.disc(cx, gy, 8.5).paint(NEAR.dark, { bevel: 's' });
    ellipse(pn, cx, gy, 7, 7, tilt, P.brass[1], P.brass[1]);
    const spin = st.t * 7;
    const rx = 0.8 + 5.5 * Math.abs(Math.cos(spin));
    ellipse(pn, cx, gy, rx, 5.5, tilt, P.brass[3], P.brass[1]);
    ellipse(pn, cx, gy, Math.max(0.5, rx - 1), 5.5, tilt, P.brass[2], P.brass[0]);
    pn.ln(cx - Math.sin(tilt) * -7, gy - Math.cos(tilt) * 7, cx + Math.sin(tilt) * -7, gy + Math.cos(tilt) * 7, P.brass[2]);
    pn.disc(cx, gy, 1.6).paint(mat === 'fire' ? NEAR.fire : NEAR.brass, { outline: false });
    return cx;
  }

  // ---------- 蜘蛛腿（四足） ----------
  // 每格两条：近侧一条、远侧一条；前半段往前张、后半段往后张。H.up = 膝盖高出胯多少（区分型号）
  function spiderLeg(pn, M, hx, hy, gy, dir, ph, o, H) {
    const g = gait(o, ph, 5, 4);
    const fx = hx + dir * H.reach + g.x, fy = gy - g.lift;
    const kx = hx + dir * H.kx + g.x * 0.3, ky = hy - H.up - g.lift * 0.6;
    const F = bone(hx, hy, kx, ky);
    pn.poly(F.pts([[0, -2.6], [0, 2.6], [F.len, 3.4], [F.len, -3.4]])).paint(M.leg);
    if (F.len > 14) pn.ln(...F.p(2, 0), ...F.p(F.len - 3, 0), M.leg[3]);
    const B = bone(kx, ky, fx, fy), a = B.len * 0.3;
    pn.poly(B.pts([[-1, -3.6], [-1, 3.6], [B.len * 0.45, 2.8], [B.len - 3, 1.2], [B.len + 1, 0], [B.len - 3, -1.2], [B.len * 0.45, -2.4]])).paint(M.leg);
    pn.poly(B.pts([[a - 0.9, -3.1], [a + 0.9, -3.1], [a + 0.9, 3.1], [a - 0.9, 3.1]])).paint(M.brass, { outline: false });
    pn.disc(kx, ky, 3.4).paint(M.iron); pn.dot(kx - 1, ky - 1, M.iron[3]);
    pn.disc(hx, hy, 3.2).paint(M.iron); pn.disc(hx, hy, 1.2).paint(M.brass, { outline: false });
  }
  function carapace(pn, x, y, connL, connR) {
    pn.fill(x, y, C, 3, P.iron[1]); pn.fill(x, y + 2, C, 1, P.iron[0]);
    const x0 = connL ? x - 4 : x + 2, x1 = connR ? x + 52 : x + 46;
    pn.poly([[x0, y + 3], [x1, y + 3], [x1 - (connR ? 0 : 3), y + 14], [x0 + (connL ? 0 : 3), y + 14]]).paint(NEAR.dark, { clip: [x, x + C] });
    for (let k = 8; k < C; k += 16) pn.fill(x + k, y + 5, 1, 8, P.dark[0]);
    U.rivet(pn, x + 3, y + 6); U.rivet(pn, x + 42, y + 6);
    pn.fill(x0 < x ? x : x0 + 1, y + 11, Math.min(x1, x + C) - Math.max(x0, x) - 1, 1, P.brass[1]);
  }

  // ---------- 一帧 ----------
  const pens = new Map();
  function render(cv, b, st) {
    const g = cv.getContext('2d');
    let pn = pens.get(cv); if (!pn) { pn = Pen(cv.width, cv.height); pens.set(cv, pn); }
    pn.at(1, -VX, -VY);
    g.clearRect(0, 0, cv.width, cv.height);
    const N = 12, gf = st.mv ? SA.Dyn.frame(st.phase, N, 60 / N) : 0, a = gf / N * TAU;
    const o = { mv: st.mv, a, q: gf * 5, phase: st.phase, t: st.t, fl: Math.floor(st.t * 8) % 4, ri: 0, rn: 1, top: true };
    pn.fill(VX, GROUND, VW, 10, P.bg[4]).fill(VX, GROUND, VW, 1, P.bg[5]);
    const blitTorso = (bd, off) => {
      g.imageSmoothingEnabled = false;
      for (let r = 0; r < 5; r++) g.drawImage(b.torso, 0, r * C, b.torso.width, C, -VX + off(r), r * C + bd - VY, b.torso.width, C);
    };
    if (b.pc == null) return renderSpider(pn, g, b, st, o, a, blitTorso);

    // 真双足
    const e = legDesign(st.legs || b.legs), D = e.d;
    const amp = 4, bd = amp - Math.round(Math.abs(Math.sin(a)) * amp);
    o.bd = bd;
    const bal = b.bal;
    const lean = Math.max(-1.3, Math.min(1.3, bal.d / 0.6)) * 4 + (st.mv ? 1.5 : 0) + (bal.tone === 'bad' ? Math.sin(st.t * 5) * 2 : 0);
    const off = (r) => Math.round(lean * (4 - r) * 0.5);
    const cx = PADX + b.pc * C + 24, hy = HIP + bd, k = (GROUND - HIP) / (47 - (D.hipY || 14));
    const leg = (far) => {
      const L = legAt(D, far, cx - 24, 0, o, far ? cx + 6 : cx - 2);
      L.hy = hy - (far ? 3 : 0); L.gy = L.hy + (GROUND - (far ? 3 : 0) - L.hy) / k;
      return L;
    };
    if (st.far) drawLeg(pn, D, leg(true), o, k);
    pn.flush(g);
    blitTorso(bd, off);
    pelvis(pn, b, e.id, st, bd);
    if (D.mid) {   // 罩袍挂在胯下，跟腿一起放大
      const top = Y4 + bd + 30, back = pn.around(k * 0.8, cx + 2, top);
      D.mid(pn, { M: NEAR, x: cx - 21.5, y: top - 12 }, o); back();
    }
    drawLeg(pn, D, leg(false), o, k);
    if (st.hud) hud(pn, b, cx, off, bd);
    pn.flush(g);
    if (st.grid) grid(g, b);
  }

  function renderSpider(pn, g, b, st, o, a, blitTorso) {
    const H = b.spider, bd = 1 - Math.round(Math.abs(Math.sin(a)));
    o.bd = bd;
    const cells = b.quad, rn = cells.length, y = 5 * C + bd;
    const dirOf = (ri) => (ri < rn / 2 ? -1 : 1);
    const opt = (ri) => ({ ...o, a: o.a + ri * Math.PI });
    if (st.far) cells.forEach((c, ri) => spiderLeg(pn, U.FAR, PADX + c * C + 30, y + 7, GROUND - 3, -dirOf(ri), Math.PI, opt(ri), H));
    pn.flush(g);
    blitTorso(bd, () => 0);
    cells.forEach((c, ri) => carapace(pn, PADX + c * C, y, ri > 0, ri < rn - 1));
    cells.forEach((c, ri) => spiderLeg(pn, NEAR, PADX + c * C + 22, y + 10, GROUND, dirOf(ri), 0, opt(ri), H));
    pn.flush(g);
    if (st.grid) grid(g, b);
  }

  // ---------- 平衡指示（UI 叠加层）：地面上的支撑区 + 从重心垂下的铅垂线 ----------
  function hud(pn, b, cx, off, bd) {
    const { d, h } = b.bal;
    pn.fill(cx - 44, GROUND + 3, 88, 2, P.fire[1]);
    pn.fill(cx - 29, GROUND + 3, 58, 2, P.brass[2]);
    pn.fill(cx - 12, GROUND + 3, 24, 2, P.gauge[2]);
    const rr = 4 - h, px = Math.round(cx + d * C + off(Math.round(rr))), py = Math.round(rr * C + 24 + bd);
    for (let yy = py + 4; yy < GROUND - 4; yy += 2) pn.fill(px, yy, 1, 1, (yy >> 1) % 2 ? P.white : P.black);
    pn.poly([[px - 2.5, GROUND - 5], [px + 3.5, GROUND - 5], [px + 0.5, GROUND]]).paint(NEAR.brass);
    pn.disc(px + 0.5, py + 0.5, 3.2).paint([P.black, P.white, P.white, P.white], { bevel: '' });
    pn.fill(px - 3, py, 7, 1, P.black); pn.fill(px, py - 3, 1, 7, P.black);
  }

  // ---------- 规则分区（示意）：腿区 / 腰挂位 / 胯 / 躯干最宽 3 格 ----------
  function grid(g, b) {
    const X = (c) => PADX + c * C - VX, Yr = (r) => r * C - VY;
    g.save();
    g.lineWidth = 1; g.font = '9px sans-serif'; g.textBaseline = 'top';
    const box = (c, r, w, h, fill, stroke, label) => {
      g.fillStyle = fill; g.fillRect(X(c), Yr(r), w * C, h * C);
      g.strokeStyle = stroke; g.setLineDash([3, 2]); g.strokeRect(X(c) + 0.5, Yr(r) + 0.5, w * C - 1, h * C - 1);
      if (label) { g.fillStyle = stroke; g.fillText(label, X(c) + 3, Yr(r) + 3); }
    };
    if (b.pc != null) {
      box(0, 5, 8, 1, 'rgba(239,122,33,0.10)', P.fire[2], '腿区：不能放模块');
      box(b.pc - 1, 4, 1, 1, 'rgba(111,207,106,0.10)', P.gauge[2], '腰挂');
      box(b.pc + 1, 4, 1, 1, 'rgba(111,207,106,0.10)', P.gauge[2], '腰挂');
      box(b.pc, 4, 1, 1, 'rgba(217,164,65,0.12)', P.brass[2], '胯');
      box(b.pc - 1, 0, 3, 4, 'rgba(0,0,0,0)', P.steam[1], '躯干 ≤ 3 格宽');
    } else box(b.quad[0], 5, b.quad.length, 1, 'rgba(111,207,106,0.10)', P.gauge[2], '蜘蛛底盘：每格一对腿');
    g.restore();
  }

  // ---------- 样例 ----------
  const BUILDS = [
    { name: '轻骑', legs: 'heron', rows: ['........', '........', '...O....', '..WKM...', '...G....', '........'],
      note: '最精简的双足：躯干只有 4 个模块。重心几乎压在胯上，走得最快、最稳。' },
    { name: '圣骑', legs: 'knight', rows: ['........', '...K....', '..OAC...', '..WHA...', '..AGA...', '........'],
      note: '两块铁装甲挂在腰挂位上，读起来就是草摺。满编 3×3 躯干 + 两个腰挂，左右对称，正好平衡。' },
    { name: '冲锋', legs: 'dragon', rows: ['........', '........', '...KC...', '...OH...', '...GA...', '........'],
      note: '重装甲和火炮都压在胯前面：重心偏前 → 前倾冲锋姿态，冲得更猛，但行进射击更晃。' },
    { name: '炮台', legs: 'gren', rows: ['........', '........', '..PK....', '..OW....', '..AG....', '........'],
      note: '高抛炮和锅炉放在胯后：重心偏后 → 后仰炮台姿态，站着开炮最稳，起步慢。' },
    { name: '搭房子', legs: 'mk2', rows: ['........', '.AAAAA..', '.OWKCA..', '.HHAHH..', '..AGA...', '........'],
      note: '履带那种搭房子的造法：躯干 5 格宽、头重脚轻，超出胯的承托范围 → 不能出战。' },
    { name: '伏地蛛', spider: { up: 12, kx: 15, reach: 30 }, rows: ['........', '........', '........', '...KC...', '..OWAA..', '..QQQQ..'],
      note: '四足改成蜘蛛：机身压低，腿往前后张开。膝盖只比机身高一点——矮、宽、稳。' },
    { name: '高脚蛛', spider: { up: 30, kx: 12, reach: 24 }, rows: ['........', '........', '...K....', '..OAC...', '..WHAA..', '..QQQQ..'],
      note: '同一套蜘蛛腿，膝盖高出机身一大截：用膝高区分四足型号，和直立的双足拉开剪影。' },
  ].map(parse);

  return { BUILDS, render, VW, VH };
})();
