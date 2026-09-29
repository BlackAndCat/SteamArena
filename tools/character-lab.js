// 人物形象探索：碳球。圆形小碳球、小短手、看不到腿；1～3 只眼；不画嘴。
// 长相都差不多，靠「肤色（黑往体色过渡）+ 眼球颜色 + 假发 + 饰品」区分。程序化像素画：同一份角色数据按三种尺寸画——
// 驾驶舱里（半径 3.3，和游戏里的驾驶员一样）、场景小人（半径 8）、对话头像（半径 19）。
window.SA = window.SA || {};

SA.CoalLab = (() => {
  const P = SA.PAL;
  const INK = '#07080c';
  // 体色：[暗部, 中间, 反光]。反光圈用第 3 色；皮肤按「浓度」从近黑往第 3 色过渡（见 skinFn）
  const TINT = {
    slate: { name: '蓝灰', c: ['#141824', '#2f3850', '#6a7a9c'], note: '现在驾驶舱里的驾驶员' },
    plum: { name: '暖紫', c: ['#1c1318', '#4a3040', '#8a6078'], note: '现在联合驾驶舱里的副驾驶' },
    moss: { name: '苔绿', c: ['#121a14', '#2c4032', '#628a68'] },
    rust: { name: '锈红', c: ['#1e1210', '#4a2a20', '#94583e'] },
    ochre: { name: '赭黄', c: ['#1b1710', '#463a22', '#98804a'] },
    teal: { name: '青铜绿', c: ['#101a1c', '#24403f', '#4f8a86'] },
    ash: { name: '灰白', c: ['#1a1a1a', '#3c3c3a', '#8c8a84'] },
    rose: { name: '玫瑰', c: ['#1e1216', '#4e2a36', '#a8647c'] },
    navy: { name: '藏青', c: ['#10131e', '#232c4a', '#4e5e96'] },
  };
  // 皮肤浓度：0 = 全黑（只剩反光圈），1 = 适中，越大越往体色走
  const SKIN = [[0, '全黑'], [0.6, '淡'], [1, '适中'], [1.6, '浓']];
  const C = {
    white: '#f4f7ee', eyeS: '#c9d2d8',
    red: '#9c2a22', redS: '#5c1a0e', redH: '#c84a32', khaki: '#ece6d6', khakiS: '#b8b0a0',
    brass: P.brass[2], brassH: P.brass[3], brassS: P.brass[1], brassD: P.brass[0],
    leather: P.leather[1], leatherH: P.leather[2], leatherD: P.leather[0],
    iron: P.iron[2], ironH: P.iron[4], ironS: P.iron[1],
    glass: P.glass[2], glassH: P.glass[3],
    must: '#f4f7ee', mustS: '#c8c4bc', grey: '#9a968e', greyS: '#6a665e',
    blue: '#3a5a8c', blueH: '#6a8cc4', blueS: '#243858',
    green: '#2f6a3a', greenH: '#5a9a5a', navy: '#1f2a4a', navyH: '#3a4a7a',
    black: '#15151a', blackH: '#3a3a44', cream: '#e8dcb8', pink: '#c05a78', pinkH: '#e88aa0',
    fire: P.fire[2], fireH: P.fire[3], purple: '#5a3a7a', purpleH: '#8a6aaa',
  };
  const hex = (h2) => [1, 3, 5].map(k => parseInt(h2.slice(k, k + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, '0')).join(''); };

  // ---------- 画布与形状 ----------
  function canvas(w, h, R, cx, cy) {
    const px = new Array(w * h).fill(null);
    const put = (x, y, col) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h && col) px[y * w + x] = col; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? px[y * w + x] : null);
    const X = (u) => cx + u * R, Y = (v) => cy + v * R;
    // 归一化坐标（身体半径 = 1）下的椭圆；col 可以是函数 (nx, ny, x, y) → 颜色，nx / ny 为椭圆内的相对位置 -1～1
    const E = (u, v, ru, rv, col, test) => {
      const ex = X(u), ey = Y(v), rx = Math.max(0.5, ru * R), ry = Math.max(0.5, rv * R);
      for (let y = Math.floor(ey - ry - 1); y <= ey + ry + 1; y++) for (let x = Math.floor(ex - rx - 1); x <= ex + rx + 1; x++) {
        const nx = (x + 0.5 - ex) / rx, ny = (y + 0.5 - ey) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (test && !test(nx, ny, x, y)) continue;
        put(x, y, typeof col === 'function' ? col(nx, ny, x, y) : col);
      }
    };
    const Rt = (u0, v0, u1, v1, col) => { for (let y = Math.round(Y(v0)); y < Math.round(Y(v1)); y++) for (let x = Math.round(X(u0)); x < Math.round(X(u1)); x++) put(x, y, col); };
    const L = (u0, v0, u1, v1, col, th = 0) => {
      const x0 = X(u0), y0 = Y(v0), x1 = X(u1), y1 = Y(v1), n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1, t = th * R;
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (t < 0.8) put(x, y, col); else for (let dy = -t; dy <= t; dy++) for (let dx = -t; dx <= t; dx++) if (dx * dx + dy * dy <= t * t) put(x + dx, y + dy, col);
      }
    };
    const outline = (col = INK) => {
      const o = px.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!px[y * w + x] && (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || get(x, y + 1))) o[y * w + x] = col;
      px.splice(0, px.length, ...o);
    };
    const toCanvas = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), img = g.createImageData(w, h);
      px.forEach((col, i) => { if (!col) return; const n = parseInt(col.slice(1), 16); img.data.set([n >> 16, (n >> 8) & 255, n & 255, 255], i * 4); });
      g.putImageData(img, 0, 0);
      return c;
    };
    return { w, h, R, cx, cy, px, put, get, X, Y, E, Rt, L, outline, toCanvas, mini: R < 5 };
  }

  // ---------- 身体 ----------
  const BODY = {
    A: { name: 'A 圆煤球', desc: '光滑的圆，左上一圈反光、一点高光。就是现在驾驶舱里的样子' },
    B: { name: 'B 块煤', desc: '九边形切面，每个面一种明暗，像刚敲下来的煤块；更「硬」、更像矿物' },
    C: { name: 'C 余烬', desc: '圆煤球身上几道暗红裂纹，还带着一点火气；裂纹颜色可以当第二个区分色' },
  };
  // 皮肤：四级色阶，从近黑往体色走 skin 的量；grad = 第二种颜色，身体越往下越往它过渡（量化成 4 段，保持像素色块）
  const SKIN_BASE = '#0d0e13';
  function skinFn(tint, skin, grad) {
    const hue = tint[2], lv = [0.02, 0.16, 0.3, 0.46], cache = {};
    return (ny, level) => {
      const gk = grad ? Math.round(Math.max(0, Math.min(1, (ny + 0.2) / 1.1)) * 3) / 3 : 0;
      const key = `${level}|${gk}`;
      return cache[key] || (cache[key] = mix(SKIN_BASE, grad ? mix(hue, grad, gk) : hue, lv[level] * skin));
    };
  }
  const lit = (nx, ny) => -(0.55 * nx + 0.83 * ny);
  // 明暗 → 0～3 级：左上亮、右下暗，中间一大片是 1 级
  const level = (nx, ny) => { const k = lit(nx, ny) * Math.hypot(nx, ny); return k > 0.5 ? 3 : k > 0.18 ? 2 : k > -0.45 ? 1 : 0; };
  function body(c, style, tint, sq, sk) {
    const l = tint[2];
    if (style === 'B') {
      // 九边形：某个角度上的边界半径 = cos(π/N) / cos(到该边中线的夹角)
      const N = 9, rot = 0.3, seg = Math.PI * 2 / N;
      c.E(0, 0, 1.06, 1.06 * sq, (nx, ny) => {
        const a = Math.atan2(ny, nx), r = Math.hypot(nx, ny) * 1.06;
        const k = Math.floor((((a - rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg), ac = rot + (k + 0.5) * seg;
        if (r > Math.cos(seg / 2) / Math.cos(a - ac - Math.round((a - ac) / (Math.PI * 2)) * Math.PI * 2)) return null;
        const l2 = lit(Math.cos(ac), Math.sin(ac));
        if (r < 0.5) return sk(ny, l2 > 0.3 && r > 0.28 ? 2 : 1);
        return l2 > 0.55 ? l : sk(ny, l2 > 0.05 ? 2 : l2 > -0.5 ? 1 : 0);
      });
      return;
    }
    c.E(0, 0, 1, sq, (nx, ny) => (Math.hypot(nx, ny) > 0.86 && lit(nx, ny) > 0.4 ? l : sk(ny, level(nx, ny))));
    if (!c.mini) c.E(-0.42, -0.5 * sq, 0.13, 0.11, l);
    if (style === 'C' && !c.mini) {
      for (const [u0, v0, u1, v1] of [[0.25, 0.25, 0.55, 0.45], [0.55, 0.45, 0.62, 0.72], [0.55, 0.45, 0.8, 0.35], [-0.2, 0.6, 0.05, 0.8]]) c.L(u0, v0 * sq, u1, v1 * sq, P.fire[1]);
      c.put(c.X(0.55), c.Y(0.45 * sq), P.fire[2]);
    }
  }

  // ---------- 手：小短手（圆头，和皮肤同色，上沿一点亮）----------
  const POSES = {
    idle: { name: '垂手', L: [-1.02, 0.35], R: [1.02, 0.35] },
    wave: { name: '招手', L: [-1.02, 0.35], R: [1.0, -0.55] },
    point: { name: '指', L: [-1.02, 0.35], R: [1.28, 0.05] },
    salute: { name: '敬礼', L: [-1.02, 0.35], R: [0.62, -0.72] },
    hold: { name: '拿东西', L: [-0.95, 0.42], R: [0.92, 0.45] },
    cheer: { name: '欢呼', L: [-1.0, -0.6], R: [1.0, -0.6] },
  };
  function arm(c, [u, v], sk, glove) {
    c.E(u, v, 0.26, 0.22, (nx, ny) => sk(v, ny < -0.35 ? 2 : 1));
    if (glove) c.E(u, v + 0.02, 0.19, 0.16, (nx, ny) => (ny < -0.2 ? C.white : C.eyeS));
  }

  // ---------- 眼睛：1～3 只 ----------
  // 大眼睛 + 大虹膜：眼白 → 彩色虹膜（上深下浅）→ 黑瞳孔 → 两点高光。一只眼更圆、虹膜更大、多一点高光和三根睫毛，偏可爱
  const EYESETS = {
    1: [[0, -0.02, 1.55]],
    2: [[-0.36, -0.04, 1], [0.36, -0.04, 1]],
    3: [[-0.4, 0.08, 0.86], [0.4, 0.08, 0.86], [0, -0.44, 0.72]],
  };
  const IRIS = {
    brown: { name: '棕', c: ['#3a2414', '#7a4a24', '#b8834a'] },
    amber: { name: '琥珀', c: ['#5a3408', '#b87414', '#f0c050'] },
    blue: { name: '蓝', c: ['#16305a', '#2e64b0', '#7ab4ec'] },
    teal: { name: '青', c: ['#0e3a3c', '#1f7a86', '#6ad4d4'] },
    green: { name: '绿', c: ['#123a22', '#2a7a44', '#6ac47a'] },
    violet: { name: '紫', c: ['#2a1848', '#5a3a9a', '#a88ae0'] },
    pink: { name: '粉', c: ['#4a1830', '#a84070', '#f09ac0'] },
    red: { name: '红', c: ['#4a0e0e', '#a82424', '#f07060'] },
    grey: { name: '灰', c: ['#26282c', '#5a5e66', '#a8aeb8'] },
    black: { name: '黑', c: ['#07080c', '#1b1d24', '#3a3e4a'] },
  };
  const EXPR = { normal: '平常', blink: '眨眼', happy: '高兴', surprise: '吃惊', angry: '生气', sad: '难过', sleepy: '犯困' };
  function eyes(c, n, expr, look, iris, skinAt) {
    const ic = (IRIS[iris] || IRIS.brown).c;
    if (c.mini) {
      // 驾驶舱尺寸：两只 = 左右各 2×2（右下一格是虹膜色）；一只 = 3×3；三只 = 两只 + 头顶一个像素
      const cx = Math.round(c.cx), cy = Math.round(c.cy);
      const eye = (x, y, w2, h2) => {
        for (let yy = 0; yy < h2; yy++) for (let xx = 0; xx < w2; xx++) c.put(x + xx, y + yy, expr === 'blink' ? (yy === h2 - 1 ? C.eyeS : null) : C.white);
        if (expr === 'blink') return;
        if (w2 > 2) { c.put(x + 1, y + 1, ic[1]); c.put(x + 2, y + 1, ic[0]); c.put(x + 1, y + 2, ic[2]); c.put(x + 2, y + 2, ic[1]); }
        else c.put(x + w2 - 1, y + h2 - 1, ic[1]);
      };
      if (n === 1) eye(cx - 1, cy - 2, 3, 3);
      if (n >= 2) { eye(cx - 2, cy - 1, 2, 2); eye(cx + 1, cy - 1, 2, 2); }
      if (n === 3) c.put(cx, cy - 2, C.white);
      return;
    }
    const tiny = c.R < 12;
    for (const [u, v, s] of EYESETS[n]) {
      const rx = 0.27 * s, ry = 0.31 * s, lx = look * 0.06 * s;
      if (expr === 'blink') { c.E(u, v + ry * 0.3, rx, Math.max(ry * 0.22, 1 / c.R), INK, (nx, ny) => ny > -0.1); continue; }
      if (expr === 'happy') { c.E(u, v + ry * 0.15, rx, ry * 0.75, INK, (nx, ny) => ny < 0.1 && Math.hypot(nx, ny + 0.85) > 0.98); continue; }
      const big = expr === 'surprise' ? 1.12 : 1;
      c.E(u, v, rx * big, ry * big, (nx, ny) => (ny > 0.62 ? C.eyeS : C.white));
      // 虹膜几乎占满眼白，上深下浅；吃惊时缩小
      const ir = (expr === 'surprise' ? 0.13 : 0.2) * s * (n === 1 ? 1.08 : 1), iy = v + 0.03 * s;
      c.E(u + lx, iy, ir, ir * 1.12, (nx, ny) => (ny < -0.35 ? ic[0] : ny > 0.4 ? ic[2] : ic[1]));
      c.E(u + lx, iy + ir * 0.05, ir * 0.5, ir * 0.58, INK);
      if (tiny) c.put(c.X(u + lx - ir * 0.45), c.Y(iy - ir * 0.45), C.white);
      else {
        c.E(u + lx - ir * 0.42, iy - ir * 0.42, ir * 0.3, ir * 0.3, C.white);
        c.E(u + lx + ir * 0.42, iy + ir * 0.45, ir * 0.14, ir * 0.14, C.white);
        if (n === 1) c.E(u + lx + ir * 0.5, iy - ir * 0.55, ir * 0.12, ir * 0.12, C.white);
      }
      // 眉 / 眼皮：用这块皮肤的颜色盖掉眼白一角
      const lid = (test) => c.E(u, v, rx * 1.25, ry * 1.25, (nx, ny, x, y) => skinAt(x, y), test);
      if (expr === 'angry') lid((nx, ny) => ny < -0.3 + (n === 1 ? 0 : (u < 0 ? nx : -nx) * 0.7));
      if (expr === 'sad') lid((nx, ny) => ny < -0.4 - (n === 1 ? Math.abs(nx) * 0.5 : (u < 0 ? nx : -nx) * 0.6));
      if (expr === 'sleepy') lid((nx, ny) => ny < 0.05);
      // 一只眼：上沿三根小睫毛
      if (n === 1 && !tiny && expr !== 'sleepy' && expr !== 'angry') for (const a of [-0.55, 0, 0.55]) c.L(u + Math.sin(a) * rx * 0.9, v - ry * 0.95, u + Math.sin(a) * rx * 1.25, v - ry * 1.28, INK);
    }
  }

  // ---------- 假发 ----------
  // 画在帽子下面（戴帽子时只露出两侧和下摆）；over = true 的画在帽子上面（呆毛）
  const WIGC = {
    powder: { name: '白粉', c: '#e8e4da' }, silver: { name: '银灰', c: '#a8acb4' }, blonde: { name: '金', c: '#e0b850' },
    ginger: { name: '姜红', c: '#c85a28' }, chestnut: { name: '栗棕', c: '#8a4a24' }, black: { name: '黑', c: '#2a2024' },
    pink: { name: '粉', c: '#e88aa0' }, blue: { name: '蓝', c: '#5a7ac8' },
  };
  const wigShade = (col) => [mix(col, '#000000', 0.35), col, mix(col, '#ffffff', 0.35)];
  const cap = (c, w, top = -1.02) => c.E(0, -0.42, 1.02, 0.66, (nx, ny) => (nx > 0.45 ? w[0] : nx < -0.4 && ny < -0.2 ? w[2] : w[1]), (nx, ny) => ny < -0.05 && (ny < -0.55 || Math.abs(nx) > 0.62));
  const curl = (c, u, v, r, w) => c.E(u, v, r, r, (nx, ny) => (nx + ny > 0.5 ? w[0] : nx + ny < -0.6 ? w[2] : w[1]));
  const WIGS = {
    none: { name: '不戴' },
    ahoge: { name: '呆毛', over: true, draw(c, w) { c.L(0.05, -0.95, 0.1, -1.3, w[1], 0.04); c.L(0.1, -1.3, 0.35, -1.42, w[1], 0.04); c.L(0.35, -1.42, 0.38, -1.25, w[1], 0.03); }, mini(c, w) { c.put(Math.round(c.cx), Math.round(c.cy - 4), w[1]); c.put(Math.round(c.cx) + 1, Math.round(c.cy - 5), w[1]); } },
    bob: { name: '波波头', draw(c, w) {
      cap(c, w);
      c.E(0, -0.62, 0.98, 0.42, (nx) => (nx > 0.5 ? w[0] : w[1]), (nx, ny) => ny < 0.35);
      for (const s of [-1, 1]) c.Rt(s < 0 ? -1.04 : 0.8, -0.5, s < 0 ? -0.8 : 1.04, 0.32, s < 0 ? w[1] : w[0]);
      for (let u = -0.8; u < 0.8; u += 3 / c.R) c.put(c.X(u), c.Y(-0.4), w[0]);
    }, mini(c, w) { sideMini(c, w, 2); } },
    bun: { name: '发髻', draw(c, w) { cap(c, w); curl(c, 0, -1.12, 0.32, w); c.L(-0.3, -1.3, 0.35, -1.0, C.brassH); }, mini(c, w) { sideMini(c, w, 1); c.put(Math.round(c.cx), Math.round(c.cy - 4), w[1]); } },
    pigtails: { name: '双马尾', draw(c, w) {
      cap(c, w);
      for (const s of [-1, 1]) { c.E(s * 1.08, -0.45, 0.14, 0.14, C.red); for (let i = 0; i < 4; i++) curl(c, s * (1.2 + i * 0.05), -0.25 + i * 0.22, 0.2 - i * 0.02, w); }
    }, mini(c, w) { for (const s of [-1, 1]) { c.put(Math.round(c.cx) + s * 4, Math.round(c.cy - 1), w[1]); c.put(Math.round(c.cx) + s * 4, Math.round(c.cy), w[1]); } } },
    barrister: { name: '法官假发', draw(c, w) {
      // 头顶一圈圈横卷（每卷下沿一道暗线），两侧各三个小卷垂到脸边
      cap(c, w);
      for (let i = 0; i < 4; i++) { const v = -0.98 + i * 0.13, hw = 0.5 + i * 0.13; c.Rt(-hw, v, hw, v + 0.1, w[1]); c.Rt(-hw, v + 0.08, hw, v + 0.12, w[0]); }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) curl(c, s * 1.02, -0.32 + i * 0.24, 0.14, w);
    }, mini(c, w) { sideMini(c, w, 2); } },
    periwig: { name: '贵族长卷', draw(c, w) {
      cap(c, w); curl(c, -0.35, -0.95, 0.3, w); curl(c, 0.35, -0.95, 0.3, w);
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) curl(c, s * (1.0 + (i % 2) * 0.1), -0.45 + i * 0.3, 0.22, w);
    }, mini(c, w) { sideMini(c, w, 3); } },
    pompadour: { name: '大背头', draw(c, w) {
      cap(c, w);
      c.E(-0.1, -1.05, 0.72, 0.36, (nx, ny) => (ny > 0.3 ? w[0] : nx < -0.3 ? w[2] : w[1]));
      c.L(-0.6, -1.12, 0.3, -1.3, w[2]);
    }, mini(c, w) { hatMini(c, w[1], 5, null); } },
    curly: { name: '卷毛', draw(c, w) {
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.02 + i * 0.12); curl(c, Math.cos(a) * 0.9, Math.sin(a) * 0.9 - 0.12, 0.28, w); }
      curl(c, 0, -0.85, 0.34, w);
    }, mini(c, w) { hatMini(c, w[1], 7, null); } },
  };
  function sideMini(c, w, len) { for (const s of [-1, 1]) for (let k = 0; k < len; k++) c.put(Math.round(c.cx) + s * 4, Math.round(c.cy - 2 + k), w[1]); hatMini(c, w[1], 5, null); }

  // ---------- 饰品库 ----------
  // 每件：layer = back（身后）/ neck（身上）/ face（脸上）/ hat（头顶）/ hand（手里）；mini = 驾驶舱尺寸下的画法（没有就不画）
  const ACC = {
    // 帽子
    pith: { name: '遮阳盔', layer: 'hat', draw(c) {
      c.E(0, -0.88, 0.66, 0.5, (nx) => (nx > 0.45 ? C.khakiS : C.khaki), (nx, ny) => ny < 0.1);
      c.Rt(-0.66, -0.95, 0.66, -0.86, C.brass);
      c.E(0, -0.82, 0.92, 0.1, (nx, ny) => (ny > 0 ? C.khakiS : C.khaki));
      c.E(0, -1.4, 0.07, 0.07, C.brassH);
    }, mini(c) { hatMini(c, C.khaki, 5, C.brass); } },
    topHat: { name: '大礼帽', layer: 'hat', color: C.black, band: C.red, draw(c, a) {
      c.Rt(-0.44, -1.78, 0.44, -0.84, a.color);
      c.Rt(-0.44, -1.78, -0.3, -0.84, a.hi || C.blackH);
      c.Rt(-0.44, -1.06, 0.44, -0.9, a.band);
      c.E(0, -0.84, 0.76, 0.1, a.color);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy - 3); for (let dx = -2; dx <= 2; dx++) c.put(x + dx, y, a.color); for (let yy = 1; yy <= 3; yy++) for (let xx = -1; xx <= 1; xx++) c.put(x + xx, y - yy, yy === 1 ? a.band : a.color); } },
    flatCap: { name: '鸭舌帽', layer: 'hat', color: C.grey, draw(c, a) {
      c.E(-0.05, -0.78, 0.8, 0.34, (nx, ny) => (ny > 0.2 ? a.shade || C.greyS : a.color), (nx, ny) => ny < 0.35);
      c.E(0.62, -0.72, 0.36, 0.1, a.shade || C.greyS);
      c.put(c.X(-0.05), c.Y(-1.05), a.shade || C.greyS);
    }, mini(c, a) { hatMini(c, a.color, 5, null, 1); } },
    bowler: { name: '圆顶礼帽', layer: 'hat', color: C.black, draw(c, a) {
      c.E(0, -0.9, 0.55, 0.46, (nx) => (nx < -0.4 ? C.blackH : a.color), (nx, ny) => ny < 0.15);
      c.Rt(-0.55, -0.92, 0.55, -0.82, a.band || C.brassS);
      c.E(0, -0.8, 0.76, 0.09, a.color);
    }, mini(c, a) { hatMini(c, a.color, 5, a.band || C.brassS); } },
    beanie: { name: '毛线帽', layer: 'hat', color: C.blue, draw(c, a) {
      c.E(0, -0.72, 0.84, 0.5, (nx) => (Math.floor((nx + 1) * 6) % 2 ? a.color : a.shade || C.blueS), (nx, ny) => ny < 0.2);
      c.Rt(-0.84, -0.72, 0.84, -0.58, a.cuff || a.shade || C.blueS);
      c.E(0, -1.24, 0.15, 0.15, a.pom || C.cream);
    }, mini(c, a) { hatMini(c, a.color, 7, a.cuff || a.shade); } },
    goggleCap: { name: '皮帽 + 护目镜', layer: 'hat', color: C.leather, draw(c, a) {
      c.E(0, -0.62, 0.9, 0.55, (nx) => (nx > 0.45 ? C.leatherD : a.color), (nx, ny) => ny < 0.15);
      for (const u of [-0.32, 0.32]) { c.E(u, -0.72, 0.26, 0.24, C.brass); c.E(u, -0.72, 0.17, 0.15, (nx, ny) => (nx + ny < -0.3 ? C.glassH : C.glass)); }
      c.Rt(-0.06, -0.76, 0.06, -0.68, C.brassS);
    }, mini(c) { hatMini(c, C.leather, 7, C.brass); } },
    aviator: { name: '飞行帽（现在的史诗驾驶员）', layer: 'hat', color: C.leather, draw(c, a) {
      c.E(0, -0.3, 1.04, 0.95, (nx) => (nx > 0.5 ? C.leatherD : a.color), (nx, ny) => ny < -0.05 || Math.abs(nx) > 0.72);
      c.Rt(-1.02, -0.2, 1.02, -0.06, C.brassS);
    }, mini(c) { hatMini(c, C.leather, 5, C.leatherH); } },
    bandana: { name: '头巾', layer: 'hat', color: C.red, draw(c, a) {
      c.E(0, -0.7, 0.92, 0.42, (nx, ny) => ((Math.floor((nx + 2) * 5) + Math.floor((ny + 2) * 5)) % 3 === 0 ? a.dot || C.cream : a.color), (nx, ny) => ny < 0.1);
      c.E(-0.95, -0.55, 0.16, 0.12, a.color); c.E(-1.12, -0.42, 0.14, 0.1, a.color);
    }, mini(c, a) { hatMini(c, a.color, 7); } },
    kepi: { name: '邮差帽', layer: 'hat', color: C.navy, draw(c, a) {
      c.Rt(-0.52, -1.3, 0.52, -0.82, a.color); c.Rt(-0.52, -1.3, -0.38, -0.82, C.navyH);
      c.Rt(-0.52, -0.96, 0.52, -0.86, C.red);
      c.E(0.5, -0.82, 0.3, 0.08, INK);
      c.E(0, -1.08, 0.08, 0.08, C.brassH);
    }, mini(c, a) { hatMini(c, a.color, 5, C.red, 2); } },
    peaked: { name: '工程师大檐帽', layer: 'hat', color: C.cream, draw(c, a) {
      c.E(0, -0.98, 0.72, 0.28, (nx, ny) => (ny > 0.2 ? '#b8ac88' : a.color));
      c.Rt(-0.5, -0.92, 0.5, -0.8, C.black);
      c.E(0.3, -0.78, 0.4, 0.08, INK);
      c.E(0, -1.0, 0.1, 0.09, C.brassH);
    }, mini(c, a) { hatMini(c, a.color, 7, C.black); } },
    miner: { name: '矿工盔 + 头灯', layer: 'hat', color: '#a88a3a', draw(c, a) {
      c.E(0, -0.78, 0.8, 0.52, (nx) => (nx > 0.45 ? '#6a5424' : a.color), (nx, ny) => ny < 0.1);
      c.E(0, -0.72, 0.98, 0.09, '#6a5424');
      c.E(0, -1.02, 0.2, 0.18, C.brass); c.E(0, -1.02, 0.12, 0.1, C.fireH);
    }, mini(c, a) { hatMini(c, a.color, 7, null); c.put(Math.round(c.cx), Math.round(c.cy - 4), C.fireH); } },
    widow: { name: '寡妇小帽 + 面纱 + 羽毛', layer: 'hat', color: C.black, draw(c, a) {
      c.E(-0.15, -0.92, 0.5, 0.2, C.black); c.Rt(-0.5, -0.92, 0.2, -0.82, a.band || C.purple);
      c.L(0.2, -0.95, 0.85, -1.55, a.band || C.purple, 0.05); c.L(0.3, -1.05, 0.75, -1.5, a.feather || C.purpleH);
      // 面纱：稀疏网点，盖在眼睛上面
      for (let v = -0.8; v < -0.1; v += 3 / c.R) for (let u = -0.8; u < 0.8; u += 3 / c.R) if (Math.hypot(u, v) < 0.98) c.put(c.X(u) + ((Math.round(c.Y(v)) % 2) ? 1 : 0), c.Y(v), INK);
    }, mini(c, a) { hatMini(c, C.black, 5, a.band || C.purple); } },
    deerstalker: { name: '猎鹿帽', layer: 'hat', color: '#7a6a44', draw(c, a) {
      c.E(0, -0.78, 0.82, 0.48, (nx, ny) => ((Math.floor((nx + 2) * 7) + Math.floor((ny + 2) * 7)) % 2 ? a.color : '#5a4a2c'), (nx, ny) => ny < 0.15);
      c.E(-0.78, -0.72, 0.2, 0.08, '#5a4a2c'); c.E(0.78, -0.72, 0.2, 0.08, '#5a4a2c');
      c.E(-0.7, -0.35, 0.14, 0.3, a.color); c.E(0.7, -0.35, 0.14, 0.3, a.color);
      c.E(0, -1.22, 0.1, 0.06, '#5a4a2c');
    }, mini(c, a) { hatMini(c, a.color, 7, '#5a4a2c'); } },
    greatHelm: { name: '骑士桶盔', layer: 'hat', color: C.ironH, draw(c, a) {
      c.E(0, -0.72, 0.9, 0.62, (nx) => (nx > 0.4 ? C.iron : a.color), (nx, ny) => ny < 0.35);
      c.Rt(-0.1, -1.32, 0.1, -0.52, C.white); c.Rt(-0.5, -1.0, 0.5, -0.86, C.white);
      c.Rt(-0.9, -0.52, 0.9, -0.42, C.ironS);
    }, mini(c, a) { hatMini(c, a.color, 7, C.white); } },
    laurel: { name: '冠军桂冠', layer: 'hat', draw(c) {
      for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) c.E(sgn * (0.86 - i * 0.12), -0.78 - i * 0.12, 0.12, 0.07, i % 2 ? C.brassH : C.brass);
    }, mini(c) { const x = Math.round(c.cx), y = Math.round(c.cy - 3); for (const dx of [-3, -2, 2, 3]) c.put(x + dx, y + (Math.abs(dx) === 3 ? 1 : 0), C.brassH); } },
    tiara: { name: '小头冠', layer: 'hat', draw(c) {
      c.Rt(-0.45, -0.98, 0.45, -0.9, C.brass);
      for (const [u, h2] of [[-0.35, 0.12], [0, 0.22], [0.35, 0.12]]) c.L(u, -0.98, u, -0.98 - h2, C.brassH);
      c.E(0, -1.22, 0.07, 0.07, C.pinkH);
    }, mini(c) { const x = Math.round(c.cx), y = Math.round(c.cy - 3); c.put(x - 1, y, C.brassH); c.put(x, y - 1, C.brassH); c.put(x + 1, y, C.brassH); } },
    sootTop: { name: '歪礼帽（压扁的）', layer: 'hat', color: C.black, draw(c, a) {
      c.L(-0.35, -0.86, -0.5, -1.62, a.color, 0.06); c.L(0.4, -0.86, 0.45, -1.5, a.color, 0.06);
      for (let v = -1.6; v < -0.86; v += 0.5 / c.R) c.L(-0.35 - (v + 0.86) * 0.2, v, 0.4 + (v + 0.86) * -0.05, v - (v + 0.86) * 0.12, a.color);
      c.L(-0.5, -1.62, 0.45, -1.52, C.blackH);
      c.E(0, -0.84, 0.74, 0.1, a.color);
      c.E(0.1, -1.25, 0.1, 0.12, C.blackH);
    }, mini(c, a) { hatMini(c, a.color, 5, null, 3); } },
    feather: { name: '帽上的羽毛（冠军）', layer: 'hat', draw(c) { c.L(0.3, -1.6, 0.85, -2.1, C.white, 0.06); c.L(0.4, -1.65, 0.8, -2.05, C.eyeS); } },
    // 脸上（没有嘴：胡子、烟斗都挂在眼睛下面那块）
    monocle: { name: '单片眼镜', layer: 'face', draw(c, a, eyeset) {
      const [u, v, s] = eyeset[eyeset.length > 1 ? 1 : 0];
      c.E(u, v, 0.36 * s, 0.4 * s, C.brassH, (nx, ny) => nx * nx + ny * ny > 0.7);
      c.L(u + 0.28 * s, v + 0.3 * s, u + 0.55, 0.85, C.brassS);
    } },
    loupe: { name: '钟表匠放大镜', layer: 'face', draw(c, a, eyeset) {
      const [u, v, s] = eyeset[0];
      c.E(u, v, 0.36 * s, 0.4 * s, INK, (nx, ny) => nx * nx + ny * ny > 0.62); c.E(u, v, 0.33 * s, 0.37 * s, C.brass, (nx, ny) => nx * nx + ny * ny > 0.7);
      c.Rt(u - 0.9, v - 0.03, u - 0.32 * s, v + 0.04, C.brassS);
    } },
    pince: { name: '夹鼻眼镜', layer: 'face', draw(c, a, eyeset) {
      for (const [u, v, s] of eyeset.slice(0, 2)) c.E(u, v + 0.02, 0.3 * s, 0.32 * s, C.brassH, (nx, ny) => nx * nx + ny * ny > 0.72);
      c.Rt(-0.1, -0.02, 0.1, 0.02, C.brassH);
    } },
    walrus: { name: '海象胡', layer: 'face', color: C.must, draw(c, a) {
      c.E(-0.24, 0.4, 0.32, 0.13, (nx, ny) => (ny > 0.3 ? C.mustS : a.color)); c.E(0.24, 0.4, 0.32, 0.13, (nx, ny) => (ny > 0.3 ? C.mustS : a.color));
      c.E(-0.52, 0.52, 0.08, 0.14, a.color); c.E(0.52, 0.52, 0.08, 0.14, a.color);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 1); for (let dx = -2; dx <= 2; dx++) c.put(x + dx, y, a.color); } },
    handlebar: { name: '八字胡', layer: 'face', color: C.black, draw(c, a) {
      c.L(-0.05, 0.38, -0.5, 0.36, a.color, 0.05); c.L(0.05, 0.38, 0.5, 0.36, a.color, 0.05);
      c.L(-0.5, 0.36, -0.62, 0.22, a.color); c.L(0.5, 0.36, 0.62, 0.22, a.color);
    } },
    beard: { name: '大胡子', layer: 'face', color: C.grey, draw(c, a) {
      c.E(0, 0.68, 0.72, 0.48, (nx, ny) => (Math.floor((nx + 2) * 5) % 2 && ny > 0 ? a.shade || C.greyS : a.color), (nx, ny) => ny > -0.3);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 1); for (let dx = -2; dx <= 2; dx++) { c.put(x + dx, y + 1, a.color); if (Math.abs(dx) < 2) c.put(x + dx, y + 2, a.color); } } },
    blush: { name: '腮红', layer: 'face', color: C.pinkH, draw(c, a, eyeset) { for (const [u, v, s] of eyeset.slice(0, 2)) c.E(u * 1.25, v + 0.42 * s, 0.13, 0.06, a.color); } },
    pipe: { name: '烟斗', layer: 'face', draw(c) { c.L(0.12, 0.46, 0.55, 0.56, C.leatherD, 0.03); c.Rt(0.5, 0.34, 0.68, 0.6, C.leatherH); c.Rt(0.5, 0.34, 0.68, 0.4, INK); } },
    // 身上
    scarf: { name: '围巾', layer: 'neck', color: C.blue, draw(c, a) {
      c.E(0, 0.74, 0.8, 0.2, (nx) => (Math.floor((nx + 2) * 6) % 3 === 0 ? a.stripe || a.shade || C.blueS : a.color));
      c.Rt(0.45, 0.8, 0.66, 1.25, a.color); c.Rt(0.45, 1.12, 0.66, 1.25, a.stripe || a.shade || C.blueS);
      if (a.patch) c.Rt(-0.3, 0.66, -0.1, 0.82, a.patch);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 2); for (let dx = -2; dx <= 2; dx++) c.put(x + dx, y, a.color); } },
    bowtie: { name: '领结', layer: 'neck', color: C.red, draw(c, a) {
      c.E(-0.17, 0.74, 0.17, 0.11, a.color); c.E(0.17, 0.74, 0.17, 0.11, a.color); c.E(0, 0.74, 0.07, 0.07, a.shade || C.redS);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 2); c.put(x - 1, y, a.color); c.put(x + 1, y, a.color); } },
    cravat: { name: '领巾', layer: 'neck', color: C.cream, draw(c, a) {
      c.E(0, 0.72, 0.26, 0.12, a.color); c.E(0, 0.92, 0.14, 0.2, a.color); c.put(c.X(0), c.Y(0.87), a.pin || C.fire);
    } },
    sash: { name: '绶带', layer: 'neck', color: C.red, draw(c, a) {
      c.L(-0.82, 0.25, 0.3, 0.97, a.color, 0.09); c.L(-0.78, 0.18, 0.36, 0.9, a.edge || C.brass);
      if (a.medal) { c.E(0.42, 0.64, 0.13, 0.13, C.brassH); c.E(0.42, 0.64, 0.07, 0.07, C.brass); }
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 1); c.put(x - 2, y, a.color); c.put(x - 1, y + 1, a.color); c.put(x, y + 2, a.color); } },
    epaulette: { name: '金肩章', layer: 'neck', draw(c) {
      for (const u of [-0.78, 0.78]) { c.E(u, 0.12, 0.24, 0.1, C.brass); for (let k = -0.18; k <= 0.18; k += 2 / c.R) c.Rt(u + k, 0.18, u + k + 1 / c.R, 0.34, C.brassS); }
    } },
    apron: { name: '皮围裙', layer: 'neck', color: C.leather, draw(c, a) {
      c.E(0, 0.6, 0.62, 0.5, (nx) => (nx > 0.5 ? C.leatherD : a.color), (nx, ny) => ny > -0.1);
      c.L(-0.5, 0.36, -0.72, -0.05, a.color); c.L(0.5, 0.36, 0.72, -0.05, a.color);
    }, mini(c, a) { const x = Math.round(c.cx), y = Math.round(c.cy + 2); for (let dx = -1; dx <= 1; dx++) c.put(x + dx, y, a.color); } },
    strap: { name: '邮包斜挎带', layer: 'neck', color: C.leather, draw(c, a) {
      c.L(0.7, -0.3, -0.5, 0.95, a.color, 0.05);
      c.Rt(-0.85, 0.72, -0.25, 1.12, a.color); c.Rt(-0.85, 0.72, -0.25, 0.82, C.leatherH); c.put(c.X(-0.55), c.Y(0.9), C.brassH);
    } },
    medal: { name: '勋章', layer: 'neck', draw(c) {
      c.Rt(-0.6, 0.28, -0.44, 0.48, C.red); c.Rt(-0.54, 0.28, -0.5, 0.48, C.white);
      c.E(-0.52, 0.58, 0.11, 0.11, C.brassH);
    } },
    // 身后 / 手里
    cane: { name: '手杖', layer: 'hand', draw(c, a, _, pose) { const [u, v] = pose.R; c.L(u + 0.08, v - 0.2, u + 0.25, 1.1, C.leatherD, 0.04); c.E(u + 0.05, v - 0.24, 0.1, 0.08, C.brassH); } },
    wrench: { name: '扳手', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R; c.L(u, v, u + 0.25, v - 0.7, C.ironH, 0.06);
      c.E(u + 0.28, v - 0.78, 0.15, 0.13, C.ironH, (nx, ny) => !(ny < -0.1 && Math.abs(nx) < 0.35));
    } },
    hammer: { name: '铁锤', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R; c.L(u, v + 0.1, u + 0.2, v - 0.75, C.leatherH, 0.05);
      c.Rt(u - 0.12, v - 1.0, u + 0.5, v - 0.72, C.iron); c.Rt(u - 0.12, v - 1.0, u + 0.5, v - 0.92, C.ironH);
    } },
    broom: { name: '烟囱刷', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R; c.L(u, v + 0.3, u + 0.15, v - 1.2, C.leatherH, 0.04);
      for (let k = 0; k < 10; k++) { const t = k / 9 * Math.PI * 2; c.L(u + 0.16, v - 1.3, u + 0.16 + Math.cos(t) * 0.3, v - 1.3 + Math.sin(t) * 0.3, INK); }
    } },
    watch: { name: '怀表', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R; c.E(u + 0.1, v - 0.2, 0.18, 0.18, C.brass); c.E(u + 0.1, v - 0.2, 0.12, 0.12, C.cream); c.L(u + 0.1, v - 0.2, u + 0.1, v - 0.29, INK); c.L(u + 0.1, v - 0.2, u + 0.16, v - 0.2, INK);
      c.L(u + 0.1, v - 0.38, -0.2, 0.6, C.brassS);
    } },
    lantern: { name: '马灯', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R; c.L(u, v, u + 0.05, v + 0.15, C.ironS); c.Rt(u - 0.12, v + 0.15, u + 0.22, v + 0.2, C.iron); c.Rt(u - 0.1, v + 0.2, u + 0.2, v + 0.55, C.fireH); c.Rt(u - 0.12, v + 0.55, u + 0.22, v + 0.6, C.iron);
    } },
    fan: { name: '折扇', layer: 'hand', draw(c, a, _, pose) {
      const [u, v] = pose.R;
      for (let k = 0; k < 7; k++) { const t = -2.3 + k * 0.28; c.L(u, v, u + Math.cos(t) * 0.5, v + Math.sin(t) * 0.5, k % 2 ? C.pinkH : C.pink, 0.04); }
    } },
    rifle: { name: '猎枪', layer: 'back', draw(c) { c.L(-0.9, 0.9, 0.95, -1.05, C.leatherD, 0.05); c.L(0.3, -0.35, 1.0, -1.1, C.iron, 0.04); } },
    rope: { name: '缆绳圈', layer: 'back', draw(c) { c.E(-0.85, 0.4, 0.4, 0.4, '#b8a070', (nx, ny) => Math.hypot(nx, ny) > 0.55); } },
  };
  function hatMini(c, col, w, band, style) {
    const x = Math.round(c.cx), y = Math.round(c.cy - 3), hw = (w - 1) / 2;
    for (let dx = -hw; dx <= hw; dx++) c.put(x + dx, y, band || col);
    for (let dx = -hw + 1; dx <= hw - 1; dx++) c.put(x + dx, y - 1, col);
    if (style === 1) c.put(x + hw + 1, y, col);
    if (style === 2) { c.put(x - 1, y - 2, col); c.put(x, y - 2, col); c.put(x + 1, y - 2, col); }
    if (style === 3) c.put(x - 1, y - 2, col);
  }

  // ---------- 角色阵容 ----------
  // tint：体色；skin：皮肤浓度（不写 = 1）；grad：身体下半过渡到的颜色；eyes：1～3；iris：眼球颜色；
  // wig：[样式, 发色]；acc：[[饰品, 参数]]；item：手里拿的；pose：默认姿势；sq：身体扁一点；big：大一号
  const CAST = [
    { id: 'uncle', name: '远房亲戚', role: '旁白 · 大英帝国退役军官', tint: 'rust', eyes: 2, iris: 'blue', pose: 'salute',
      acc: [['epaulette'], ['medal'], ['walrus'], ['monocle'], ['pith']],
      note: '最常出现的脸：遮阳盔 + 海象胡 + 单片眼镜 + 金肩章，一眼就是「老军官」' },
    { id: 'me', name: '你', role: '主角 · 身无分文', tint: 'slate', eyes: 2, iris: 'brown', pose: 'idle', wig: ['ahoge', 'black'],
      acc: [['scarf', { color: C.blue, shade: C.blueS, patch: C.leatherH }]],
      note: '就是现在驾驶舱里的蓝灰碳球；一根呆毛 + 打了补丁的蓝围巾，越朴素越像主角' },
    { id: 'timmy', name: '学徒 小提米', role: '序章 · 陪练', tint: 'ochre', eyes: 2, iris: 'amber', pose: 'wave', item: 'wrench', wig: ['ahoge', 'chestnut'],
      acc: [['blush'], ['goggleCap']],
      note: '皮帽上顶着一副大护目镜，帽子上翘出一根呆毛，手里一把扳手' },
    { id: 'tom', name: '铁匠 老汤姆', role: '序章', tint: 'rust', grad: '#b8391b', eyes: 1, iris: 'amber', pose: 'hold', item: 'hammer',
      acc: [['apron'], ['beard', { color: C.grey }], ['bandana', { color: C.red }]],
      note: '独眼铁匠（大眼 + 睫毛，不凶）：身子下半被炉火烤得发红；大胡子、皮围裙、红头巾、铁锤' },
    { id: 'harry', name: '锅炉工 胖哈利', role: '第一章', tint: 'rust', grad: '#98804a', eyes: 2, iris: 'brown', pose: 'idle', sq: 0.9, big: 1.15,
      acc: [['scarf', { color: '#8a6a3a', shade: '#5a4424' }], ['beanie', { color: C.red, shade: C.redS, pom: C.redH }]],
      note: '大一号、扁一点；毛线帽 + 脏围巾' },
    { id: 'jack', name: '扒手 机灵杰克', role: '第一章', tint: 'moss', eyes: 3, iris: 'green', pose: 'point', item: 'watch',
      acc: [['scarf', { color: C.green, shade: '#1e4426' }], ['flatCap', { color: C.grey }]],
      note: '三只眼（「眼观六路」）；鸭舌帽、绿围巾、手里一块偷来的怀表' },
    { id: 'martha', name: '玛莎·布莱克', role: '第一章 Boss · 煤灰寡妇', tint: 'plum', grad: '#5a3a7a', eyes: 2, iris: 'violet', pose: 'idle', wig: ['bun', 'black'],
      acc: [['cravat', { color: C.black, pin: C.purpleH }], ['widow', { band: C.purple, feather: C.purpleH }]],
      note: '黑发髻 + 面纱小帽 + 紫羽毛，紫眼睛；身子往深紫过渡' },
    { id: 'isabella', name: '伊莎贝拉·雷恩', role: '锦标赛 · 双足舞者', tint: 'rose', skin: 1.6, eyes: 2, iris: 'green', pose: 'cheer', item: 'fan', wig: ['pigtails', 'ginger'],
      acc: [['blush'], ['bowtie', { color: C.pink, shade: '#8a3050' }], ['tiara']],
      note: '姜红双马尾 + 小头冠 + 腮红，皮肤颜色最浓的一只' },
    { id: 'bill', name: '码头工 大块头比尔', role: '第二章', tint: 'teal', eyes: 1, iris: 'teal', pose: 'cheer', big: 1.2,
      acc: [['rope'], ['beanie', { color: C.navy, shade: '#141c34', cuff: C.navyH, pom: C.navyH }]],
      note: '最大的一只；独眼、水手毛线帽、背一圈缆绳' },
    { id: 'joe', name: '邮差 老乔', role: '第二章', tint: 'navy', eyes: 2, iris: 'grey', pose: 'wave',
      acc: [['strap'], ['handlebar', { color: C.grey }], ['kepi']],
      note: '藏青邮差帽 + 八字胡 + 邮包' },
    { id: 'vic', name: '钟表匠 老维克', role: '第二章 Boss', tint: 'ash', eyes: 2, iris: 'blue', pose: 'hold', item: 'watch', wig: ['curly', 'silver'],
      acc: [['bowtie', { color: C.green, shade: '#1e4426' }], ['loupe'], ['bowler', { color: C.black, band: C.green }]],
      note: '银灰卷毛从礼帽下冒出来；一只眼上夹着放大镜，绿领结' },
    { id: 'tommy', name: '扫烟囱的汤米', role: '第三章', tint: 'slate', skin: 0.6, eyes: 2, iris: 'blue', pose: 'hold', item: 'broom',
      acc: [['scarf', { color: C.red, shade: C.redS }], ['sootTop']],
      note: '压扁的歪礼帽 + 烟囱刷；满身煤灰，最黑的一只' },
    { id: 'wode', name: '车间领班 沃德豪斯', role: '第三章 Boss', tint: 'plum', eyes: 2, iris: 'violet', pose: 'point', wig: ['periwig', 'powder'],
      acc: [['cravat', { color: C.cream }], ['pince'], ['topHat', { color: C.black, band: C.purple }]],
      note: '白粉长卷假发 + 大礼帽 + 夹鼻眼镜：有钱的工厂主' },
    { id: 'hobbs', name: '矿工头 霍布斯', role: '第四章', tint: 'ochre', skin: 0.6, eyes: 1, iris: 'amber', pose: 'hold', item: 'lantern',
      acc: [['beard', { color: C.black, shade: C.blackH }], ['miner']],
      note: '独眼、矿工盔带头灯、手提马灯' },
    { id: 'grey', name: '猎场看守 格雷', role: '第四章', tint: 'moss', eyes: 2, iris: 'green', pose: 'idle',
      acc: [['rifle'], ['pipe'], ['deerstalker']],
      note: '猎鹿帽 + 烟斗 + 背一杆猎枪' },
    { id: 'templar', name: '圣殿骑士团', role: '第四章 Boss', tint: 'ash', eyes: 3, iris: 'red', pose: 'salute',
      acc: [['greatHelm']],
      note: '桶盔盖住上半身，只露出眼睛；红眼睛、白十字' },
    { id: 'whit', name: '皇家工程师 惠特克', role: '第五章', tint: 'teal', eyes: 2, iris: 'teal', pose: 'point', wig: ['barrister', 'powder'],
      acc: [['medal'], ['peaked']],
      note: '白色大檐帽下一圈法官式卷发 + 勋章' },
    { id: 'harr', name: '卫冕冠军 哈灵顿爵士', role: '终局 Boss', tint: 'navy', grad: '#d9a441', eyes: 2, iris: 'blue', pose: 'cheer', wig: ['pompadour', 'blonde'],
      acc: [['sash', { color: C.blue, edge: C.brassH, medal: true }], ['epaulette'], ['handlebar', { color: C.cream }], ['topHat', { color: C.black, band: C.brass }], ['laurel'], ['feather']],
      note: '冠军：身子往金色过渡；礼帽 + 金桂冠 + 羽毛 + 蓝绶带' },
  ];

  // ---------- 画一个角色 ----------
  // size：'mini'（驾驶舱，半径 3.3）/ 'sprite'（场景小人，半径 8）/ 'portrait'（对话头像，半径 19）
  // o 里的 tint / skin / grad / eyes / iris / wig / wigColor / acc / item / pose / expr 会覆盖角色自己的设定
  const SIZES = { mini: { R: 3.3, w: 11, h: 11, cx: 5, cy: 6 }, sprite: { R: 8, w: 40, h: 40, cx: 20, cy: 25 }, portrait: { R: 19, w: 96, h: 96, cx: 48, cy: 58 } };
  const pick = (o, ch, k, d) => (o[k] !== undefined && o[k] !== null ? o[k] : ch[k] !== undefined ? ch[k] : d);
  function draw(ch, o = {}) {
    const sz = SIZES[o.size || 'portrait'], big = o.size === 'mini' ? 1 : (ch.big || 1), sq = ch.sq || 1;
    const c = canvas(o.w || sz.w, o.h || sz.h, sz.R * big, o.cx != null ? o.cx : sz.cx, (o.cy != null ? o.cy : sz.cy) + (o.size === 'mini' ? 0 : sz.R * (big - 1) * 0.9));
    const tint = TINT[pick(o, ch, 'tint', 'slate')].c, style = pick(o, ch, 'body', 'A'), n = pick(o, ch, 'eyes', 2);
    const sk = skinFn(tint, pick(o, ch, 'skin', 1), pick(o, ch, 'grad', null));
    const skinAt = (x, y) => { const nx = (x + 0.5 - c.cx) / c.R, ny = (y + 0.5 - c.cy) / (c.R * sq); return sk(ny, level(nx, ny)); };
    const pose = POSES[pick(o, ch, 'pose', 'idle')], expr = o.expr || 'normal', look = o.look == null ? 0.4 : o.look;
    const accs = pick(o, ch, 'acc', []).map(([id, a]) => [ACC[id], { ...ACC[id], ...(a || {}) }]).filter(([x]) => x);
    const item = pick(o, ch, 'item', null);
    const wig0 = pick(o, ch, 'wig', null), wigId = o.wigStyle || (wig0 && wig0[0]) || 'none', wigCol = o.wigColor || (wig0 && wig0[1]) || 'black';
    const wig = WIGS[wigId], wc = wigShade(WIGC[wigCol] ? WIGC[wigCol].c : wigCol);
    const drawWig = (over) => { if (!wig || !wig.draw || !!wig.over !== over) return; if (c.mini) { if (wig.mini) wig.mini(c, wc); } else wig.draw(c, wc); };
    const layer = (L) => accs.filter(([x]) => x.layer === L).forEach(([x, a]) => { if (c.mini) { if (x.mini) x.mini(c, a); } else x.draw(c, a, EYESETS[n], pose); });
    layer('back');
    if (!c.mini) arm(c, pose.L, sk, o.glove);
    body(c, style, tint, sq, sk);
    eyes(c, n, expr, look, pick(o, ch, 'iris', 'brown'), skinAt);
    layer('neck');
    layer('face');
    drawWig(false);
    layer('hat');
    drawWig(true);
    if (!c.mini) {
      if (item && ACC[item]) ACC[item].draw(c, ACC[item], EYESETS[n], pose);
      arm(c, pose.R, sk, o.glove);
    }
    if (!c.mini && o.outline !== false) c.outline();
    return c.toCanvas();
  }

  return { TINT, SKIN, BODY, POSES, EXPR, EYESETS, IRIS, WIGS, WIGC, ACC, CAST, draw, SIZES };
})();
