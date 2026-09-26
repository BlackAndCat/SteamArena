// 腿部套件：游戏里的双足 / 四足底盘（sprites.js 的 biped / quad）和样机页（biped-lab、biped-v2、mech-kit）共用。
// 双足：六档腿型 + 探索版（DESIGNS），游戏按外观阶段选用；四足：蜘蛛腿（spiderLeg + carapace，SPIDERS 是各型号的腿形参数）。
// 每个设计都在 48 单位的格子坐标里描述，由一个小光栅器按任意像素密度画出来（1× = 48px 原生，2× = 96px 精细）：
// 形状先写进遮罩，再统一按「描边 / 暗面 / 固有色 / 亮面」四阶上色（光源左上），两种密度共用同一份造型代码，
// 只有标了 pn.hi 的细节（刻线、铆钉、齿纹）在 2× 才画。
window.SA = window.SA || {};

SA.LEGLAB = (() => {
  const P = SA.PAL, TAU = Math.PI * 2;

  // ---------- 颜色 → RGBA32 ----------
  const U32 = new Map();
  const col = (hex) => {
    let v = U32.get(hex);
    if (v === undefined) {
      const n = parseInt(hex.slice(1), 16);
      v = ((0xff << 24) | ((n & 0xff) << 16) | (((n >> 8) & 0xff) << 8) | (n >> 16)) >>> 0;
      U32.set(hex, v);
    }
    return v;
  };

  // ---------- 光栅器：画进自己的像素缓冲，flush() 时贴到目标画布 ----------
  function Pen(W, H) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx2 = cv.getContext('2d'), img = cx2.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
    const m = new Uint8Array(W * H);
    let s = 1, ox = 0, oy = 0, bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    const PX = (u) => (u + ox) * s, PY = (u) => (u + oy) * s;
    const has = (i, j) => i >= 0 && j >= 0 && i < W && j < H && m[j * W + i] === 1;
    const put = (i, j, c) => { if (i >= 0 && j >= 0 && i < W && j < H) buf[j * W + i] = c; };
    function area(ux0, uy0, ux1, uy1, test) {
      const i0 = Math.max(0, Math.floor(PX(ux0)) - 1), i1 = Math.min(W - 1, Math.ceil(PX(ux1)) + 1);
      const j0 = Math.max(0, Math.floor(PY(uy0)) - 1), j1 = Math.min(H - 1, Math.ceil(PY(uy1)) + 1);
      for (let j = j0; j <= j1; j++) {
        const uy = (j + 0.5) / s - oy;
        for (let i = i0; i <= i1; i++) {
          if (!test((i + 0.5) / s - ox, uy)) continue;
          m[j * W + i] = 1;
          if (i < bx0) bx0 = i; if (i > bx1) bx1 = i; if (j < by0) by0 = j; if (j > by1) by1 = j;
        }
      }
    }
    const pen = {
      get s() { return s; }, get hi() { return s >= 2; },
      at(scale, ux, uy) { s = scale; ox = ux; oy = uy; return pen; },
      // 以 (ux, uy) 为支点整体放大 k 倍画（像素大小不变，形状用更多像素）；返回还原函数
      around(k, ux, uy) {
        const s0 = s, ox0 = ox, oy0 = oy;
        s = s0 * k; ox = (ux + ox0) / k - ux; oy = (uy + oy0) / k - uy;
        return () => { s = s0; ox = ox0; oy = oy0; };
      },
      disc(cx, cy, r) { area(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r); return pen; },
      rect(x, y, w, h) { area(x, y, x + w, y + h, (u, v) => u >= x && u < x + w && v >= y && v < y + h); return pen; },
      cap(ax, ay, bx, by, r) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        area(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (x, y) => {
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
          return (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 <= r * r;
        });
        return pen;
      },
      poly(pts) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        area(x0, y0, x1, y1, (x, y) => {
          let inside = false;
          for (let k = 0, n = pts.length, l = n - 1; k < n; l = k++) {
            const [xi, yi] = pts[k], [xj, yj] = pts[l];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        });
        return pen;
      },
      // 上色：ramp = [描边, 暗面, 固有色, 亮面]；bevel 'l' 只画亮边 / 's' 只画暗边 / '' 平涂；clip = [ux0, ux1] 横向裁切
      paint(ramp, o = {}) {
        if (bx1 < 0) return pen;
        const ol = o.outline !== false, bev = o.bevel === undefined ? 'ls' : o.bevel, bw = o.bw || 1;
        const c = ramp.map(col);
        const ci0 = o.clip ? Math.round(PX(o.clip[0])) : -1e9, ci1 = o.clip ? Math.round(PX(o.clip[1])) : 1e9;
        const i0 = Math.max(0, bx0 - 1, ci0), i1 = Math.min(W - 1, bx1 + 1, ci1 - 1), j0 = Math.max(0, by0 - 1), j1 = Math.min(H - 1, by1 + 1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          if (!has(i, j)) {
            if (ol && (has(i - 1, j) || has(i + 1, j) || has(i, j - 1) || has(i, j + 1) ||
              has(i - 1, j - 1) || has(i + 1, j - 1) || has(i - 1, j + 1) || has(i + 1, j + 1))) buf[j * W + i] = c[0];
            continue;
          }
          let k = 1, v = c[2];
          for (; k <= bw; k++) {
            if (bev.includes('l') && (!has(i - k, j) || !has(i, j - k))) { v = c[3]; break; }
            if (bev.includes('s') && (!has(i + k, j) || !has(i, j + k))) { v = c[1]; break; }
          }
          buf[j * W + i] = v;
        }
        for (let j = by0; j <= by1; j++) m.fill(0, j * W + bx0, j * W + bx1 + 1);
        bx0 = W; by0 = H; bx1 = by1 = -1;
        return pen;
      },
      // 直接画（不进遮罩）：矩形（单位坐标）、单个物理像素、物理 1px 细线
      fill(x, y, w, h, c) {
        const v = col(c), i0 = Math.round(PX(x)), i1 = Math.round(PX(x + w)), j0 = Math.round(PY(y)), j1 = Math.round(PY(y + h));
        for (let j = Math.max(0, j0); j < Math.min(H, j1); j++) for (let i = Math.max(0, i0); i < Math.min(W, i1); i++) buf[j * W + i] = v;
        return pen;
      },
      dot(x, y, c) { put(Math.floor(PX(x)), Math.floor(PY(y)), col(c)); return pen; },
      ln(ax, ay, bx, by, c, w = 1) {
        const v = col(c), x0 = PX(ax), y0 = PY(ay), x1 = PX(bx), y1 = PY(by), o = Math.floor(w / 2);
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let k = 0; k <= n; k++) {
          const i = Math.floor(x0 + (x1 - x0) * k / n) - o, j = Math.floor(y0 + (y1 - y0) * k / n) - o;
          for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(i + a, j + b, v);
        }
        return pen;
      },
      // 把缓冲贴到目标画布并清空（画别的东西——比如车体——之前先 flush）
      flush(g) {
        cx2.putImageData(img, 0, 0);
        g.drawImage(cv, 0, 0);
        buf.fill(0);
        return pen;
      },
      blit(g, image, ux, uy) {
        g.imageSmoothingEnabled = false;
        g.drawImage(image, Math.round(PX(ux)), Math.round(PY(uy)), image.width * s, image.height * s);
      },
    };
    return pen;
  }

  // ---------- 几何 ----------
  // 骨骼坐标系：a 沿骨骼方向，f 朝「前」（骨骼朝下时 f>0 = +x = 车头方向）
  const bone = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const p = (a, f) => [ax + ux * a + uy * f, ay + uy * a - ux * f];
    return { len, p, pts: (arr) => arr.map(([a, f]) => p(a, f)), ang: Math.atan2(dy, dx) };
  };
  // 局部坐标系：u 向前，v 向下，整体转 ang（顺时针为正：脚尖朝下）
  const frame = (x, y, ang) => {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const p = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    return { p, pts: (arr) => arr.map(([u, v]) => p(u, v)) };
  };
  // 两段 IK：kd = 1 膝盖朝前（人形），-1 膝盖朝后（反关节）。返回膝和实际够到的踝
  function ik(hx, hy, fx, fy, L1, L2, kd) {
    const dx = fx - hx, dy = fy - hy, d = Math.max(1, Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01));
    const t = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const ang = Math.atan2(dy, dx) - kd * t;
    const kx = hx + Math.cos(ang) * L1, ky = hy + Math.sin(ang) * L1;
    const ex = fx - kx, ey = fy - ky, el = Math.hypot(ex, ey) || 1;
    return [kx, ky, kx + ex / el * L2, ky + ey / el * L2];
  }
  // 步态：S 步幅、H 抬脚高度。着地时脚往后蹬，抬起时往前摆；抬脚前半程脚尖朝下，后半程脚尖翘起
  function gait(o, ph, S, H) {
    if (!o.mv) return { x: 0, lift: 0, tilt: 0, sn: 0, c: 1 };
    if (o.plant) return plantGait(o, ph, o.plantS != null ? o.plantS : S, o.plantH != null ? o.plantH : H);
    const a = o.a + ph, c = Math.cos(a), sn = Math.sin(a);
    return { x: -S * c, lift: Math.max(0, sn) * H, tilt: 0.35 * Math.max(0, sn) * c, sn, c };
  }
  // 踩实地的步态（新版整件底盘用，o.plant）：前半个周期抬脚往前摆（先快后慢），后半个周期着地、脚相对车身匀速往后蹬。
  // 脚在胯前后 ±S 之间摆。步态周期要等于车走 4S（着地那半个周期车走 2S = 脚往后蹬的距离），脚才钉在地上不打滑：
  // 调用方按车走的距离推进步态角 a += 2π × 距离 / (4S)（腿放大画的，S 要按放大倍数折算）
  function plantGait(o, ph, S, H) {
    const u = ((((o.a + ph) / TAU) % 1) + 1) % 1;
    if (u < 0.5) {
      const w = u * 2, e = w * w * (3 - 2 * w), sn = Math.sin(Math.PI * w), c = Math.cos(Math.PI * w);
      return { x: -S + 2 * S * e, lift: sn * H, tilt: 0.35 * sn * c, sn, c };
    }
    const w = (u - 0.5) * 2;
    return { x: S - 2 * S * w, lift: 0, tilt: 0, sn: -Math.sin(Math.PI * w), c: -Math.cos(Math.PI * w) };
  }
  const yAt = (pts, u) => {
    for (let k = 1; k < pts.length; k++) if (u <= pts[k][0]) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      return y0 + (y1 - y0) * (u - x0) / (x1 - x0 || 1);
    }
    return pts[pts.length - 1][1];
  };

  // ---------- 材质：近侧 / 远侧（远侧整体压暗一阶、描边用黑） ----------
  const NEAR = {
    dark: [P.dark[0], P.dark[1], P.dark[2], P.dark[3]],
    leg: [P.dark[0], P.dark[2], P.dark[3], P.iron[2]],
    iron: [P.iron[0], P.iron[1], P.iron[2], P.iron[3]],
    steel: [P.iron[0], P.iron[2], P.iron[3], P.iron[4]],
    brass: [P.brass[0], P.brass[1], P.brass[2], P.brass[3]],
    fire: [P.fire[0], P.fire[1], P.fire[2], P.fire[3]],
    leather: [P.black, P.leather[0], P.leather[1], P.leather[2]],
    steam: [P.dark[0], P.steam[0], P.steam[1], P.steam[2]],
    gauge: [P.gauge[0], P.gauge[0], P.gauge[1], P.gauge[2]],
  };
  const FAR = {};
  for (const k in NEAR) FAR[k] = [P.black, NEAR[k][0], NEAR[k][1], NEAR[k][2]];
  FAR.fire = [P.black, P.fire[0], P.fire[1], P.fire[2]];
  const flat = (c) => [c, c, c, c];

  // ---------- 通用零件 ----------
  function rivet(pn, x, y) {
    if (pn.hi) { pn.disc(x + 1, y + 1, 0.95).paint([P.iron[0], P.iron[2], P.iron[3], P.iron[4]], { outline: false }); pn.dot(x + 1.6, y + 1.6, P.iron[0]); return; }
    pn.fill(x, y, 2, 2, P.iron[4]).fill(x + 1, y + 1, 1, 1, P.iron[2]).fill(x + 2, y + 1, 1, 1, P.iron[0]).fill(x + 1, y + 2, 1, 1, P.iron[0]);
  }
  // 底盘顶部的车体底板：和上方模块的框架同色相接，没有模块压着时才描顶边（同 sprites.js）
  function floor(pn, x, y, o) {
    pn.fill(x, y, 48, 4, P.iron[1]);
    if (!o.top) { pn.fill(x, y, 48, 1, P.iron[0]); pn.fill(x, y + 1, 48, 1, P.iron[3]); }
    for (let rx = 4; rx < 48; rx += 8) pn.fill(x + rx, y + 2, 1, 1, P.iron[3]);
    pn.fill(x, y + 3, 48, 1, P.iron[0]);
  }
  // 横梁：相邻同类格子连成一根（越过格子边界再裁掉，接缝处没有描边）
  function beamBox(pn, x, y, o, ramp, top, h) {
    const x0 = o.connL ? x - 4 : x + 3, x1 = o.connR ? x + 52 : x + 45;
    pn.rect(x0, y + top, x1 - x0, h).paint(ramp, { clip: [x, x + 48] });
    return [Math.max(x0, x), Math.min(x1, x + 48)];
  }
  function gear(pn, cx, cy, r, n, rot, ramp, hub) {
    pn.disc(cx, cy, r - 0.9);
    const w = Math.PI / n * 0.5;
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * TAU, at = (aa, rr) => [cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr];
      pn.poly([at(a - w * 1.2, r - 1.2), at(a - w * 0.8, r + 0.9), at(a + w * 0.8, r + 0.9), at(a + w * 1.2, r - 1.2)]);
    }
    pn.paint(ramp);
    if (hub) pn.disc(cx, cy, Math.max(0.9, r * 0.38)).paint(hub, { outline: false });
    if (pn.hi && r > 3.5) for (let k = 0; k < 4; k++) {
      const a = rot + k / 4 * TAU + 0.4;
      pn.ln(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, cx + Math.cos(a) * (r - 1.4), cy + Math.sin(a) * (r - 1.4), ramp[1]);
    }
  }
  function spring(pn, ax, ay, bx, by, turns, amp, M) {
    const B = bone(ax, ay, bx, by), n = turns * 2;
    let prev = B.p(0, 0);
    for (let k = 1; k <= n; k++) {
      const pt = B.p(B.len * k / (n + 1), k % 2 ? amp : -amp);
      pn.cap(prev[0], prev[1], pt[0], pt[1], 0.5); prev = pt;
    }
    const e = B.p(B.len, 0); pn.cap(prev[0], prev[1], e[0], e[1], 0.5);
    pn.paint(M.steam, { bevel: 'l' });
  }

  // ---------- 设计 ----------
  // 每个设计：leg(pn, L, ph, o) 画一条腿（近侧 / 远侧共用，材质取 L.M）；beam(pn, x, y, o) 画横梁（只在近侧层）；
  // mid(pn, L, o) 画在横梁之后、近侧腿之前（夹在两腿之间的东西）；over(pn, L, ph, o) 画在腿之后（挂在胯上的甲片）。
  // L = { far, M, hx, hy（胯）, gy（地面）, x, y（格子左上，已含起伏） }

  // T1 · 工装 Mk.II：箱形梁大腿 + 液压撑杆 + 双支杆小腿 + 带肋平脚（反关节）
  const MK2 = {
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7, 5);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + 2 + g.x, L.gy - 4.5 - g.lift, 15, 16, -1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt);
      // 液压撑杆：横梁前端斜拉到小腿中段
      const [sx, sy] = S.p(S.len * 0.42, 0), c0x = L.hx + 9, c0y = L.hy - 4;
      const mx = c0x + (sx - c0x) * 0.55, my = c0y + (sy - c0y) * 0.55;
      pn.cap(mx, my, sx, sy, 0.8).paint(M.steam, { bevel: 'l' });
      pn.cap(c0x, c0y, mx, my, 1.9).paint(M.iron);
      pn.disc(c0x, c0y, 1.3).paint(M.brass, { bevel: 'l' });
      // 平脚 + 踝座
      pn.poly(F.pts([[-6, 1.4], [7, 1.4], [10, 4.5], [-7, 4.5]])).poly(F.pts([[-2.4, -1.6], [2.4, -1.6], [2.4, 1.8], [-2.4, 1.8]])).paint(M.leg);
      if (pn.hi) for (const u of [-4, -1, 2, 5]) pn.ln(...F.p(u, 2.2), ...F.p(u + 0.8, 4), M.leg[1]);
      // 小腿：双支杆 + 斜撑
      pn.cap(...S.p(0, 1.8), ...S.p(S.len, 1.1), 1.1).cap(...S.p(0, -1.8), ...S.p(S.len, -1.1), 1.1).paint(M.leg, { bevel: 'l' });
      pn.ln(...S.p(2.5, 1.8), ...S.p(S.len - 3, -1.2), M.leg[pn.hi ? 3 : 2], pn.hi ? 2 : 1);
      pn.disc(ex, ey, 2).paint(M.iron);
      // 大腿：箱形梁 + 减重孔
      pn.cap(L.hx, L.hy, kx, ky, 3.2).paint(M.leg);
      for (const t of pn.hi ? [0.36, 0.66] : [0.5]) { const [px, py] = T.p(T.len * t, 0); pn.disc(px, py, pn.hi ? 1.2 : 0.6).paint(flat(M.dark[0]), { outline: false, bevel: '' }); }
      pn.disc(kx, ky, 3.3).paint(M.iron); pn.dot(kx - 1, ky - 1, M.iron[3]);
      pn.disc(L.hx, L.hy, 3.3).paint(M.iron); pn.disc(L.hx, L.hy, 1.2).paint(M.brass, { outline: false });
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.dark, 4, 11);
      pn.fill(a, y + 7, b - a, 1, P.dark[3]);
      if (pn.hi) for (let k = a + 5; k < b - 3; k += 6) pn.fill(k, y + 9, 3, 3, P.dark[1]);
      rivet(pn, x + 9, y + 8); rivet(pn, x + 37, y + 8);
    },
  };

  // T2 · 鹭步：三段鸟腿（膝盖朝前、跗关节高高翘在后），黄铜关节毂 + 膝后弹簧 + 三趾爪
  const HERON = {
    toe(pn, F, du, dv, ramp, M) {
      pn.poly(F.pts([[du - 0.5, dv - 1.4], [du + 4, dv - 1], [du + 7.5, dv + 0.6], [du + 9, dv + 2.3], [du + 6.5, dv + 1.7], [du + 3, dv + 1.7], [du - 0.5, dv + 1.4]])).paint(ramp);
      pn.dot(...F.p(du + 8.3, dv + 1.9), M.brass[3]);
    },
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 8, 6);
      const tx = L.hx + 5 + g.x, ty = L.gy - 2.2 - g.lift, F = frame(tx, ty, g.tilt);
      const [hax, hay] = F.p(-4.5, -10);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, hax, hay, 12, 14, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey);
      HERON.toe(pn, F, -1.4, -0.9, M.dark, M);
      spring(pn, ...T.p(T.len * 0.35, -2.8), ...S.p(S.len * 0.45, -1.6), 3, 1.2, M);
      pn.poly(F.pts([[0, -0.5], [-4.6, 1.3], [-4.2, 2.3], [0.6, 1.3]])).paint(M.leg);   // 后趾
      pn.cap(ex, ey, tx, ty, 1.5).paint(M.leg);                                          // 跗骨
      pn.cap(...S.p(0, 1.1), ...S.p(S.len, 0.8), 1).cap(...S.p(0, -1.2), ...S.p(S.len, -0.8), 0.9).paint(M.leg, { bevel: 'l' });
      pn.poly(T.pts([[-3, -3.2], [-3.5, 3], [T.len * 0.5, 4.2], [T.len + 1, 2], [T.len + 1, -2]])).paint(M.iron);
      pn.ln(...T.p(-1, 2.6), ...T.p(T.len - 1, 1.4), M.brass[2], pn.hi ? 2 : 1);
      if (pn.hi) pn.ln(...T.p(0, -1.6), ...T.p(T.len - 1, -1), M.iron[1]);
      HERON.toe(pn, F, 0, 0, M.leg, M);
      pn.disc(ex, ey, 2.1).paint(M.brass);
      pn.disc(kx, ky, 2.8).paint(M.brass); pn.dot(kx, ky, M.brass[0]);
      pn.disc(L.hx, L.hy, 3).paint(M.brass); pn.dot(L.hx, L.hy, M.brass[0]);
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.iron, 4, 9);
      pn.fill(a, y + 8, b - a, 1, P.brass[2]);
      rivet(pn, x + 24, y + 6); rivet(pn, x + 40, y + 6);
    },
  };

  // T3 · 掷弹兵：人形正膝，铆接圆筒大腿 + 喇叭口护胫 + 平头重靴；膝盖是一块压力表，膝后一根蒸汽活塞
  const GREN = {
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7, 4.5);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + g.x, L.gy - 7 - g.lift, 14, 14.5, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt * 0.6);
      // 膝后活塞
      const p0 = T.p(T.len * 0.3, -4.2), p1 = S.p(S.len * 0.55, -4.2), pm = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      pn.cap(...pm, ...p1, 0.8).paint(M.steam, { bevel: 'l' });
      pn.cap(...p0, ...pm, 1.8).paint(M.dark);
      // 靴：平头、厚底、黄铜扣
      pn.poly(F.pts([[-5.5, -1], [3.5, -1], [4.5, 2.5], [9.5, 4], [11, 5.6], [10.6, 7], [-6, 7], [-6, 0]])).paint(M.leg);
      pn.poly(F.pts([[-6, 5.7], [10.9, 5.7], [10.6, 7], [-6, 7]])).paint(M.dark, { outline: false, bevel: '' });
      if (pn.hi) for (let u = -5; u < 10; u += 2) pn.dot(...F.p(u, 6.3), M.leg[3]);
      pn.poly(F.pts([[-1.5, 0.8], [1.5, 0.8], [1.5, 2.8], [-1.5, 2.8]])).paint(M.brass, { bevel: 'l' });
      // 护胫：往下张开的喇叭口
      pn.poly(S.pts([[-1, -3.4], [-1, 3.6], [S.len - 1, 4.8], [S.len + 1.5, 5], [S.len + 1.5, -4.6], [S.len - 1, -4.4]])).paint(M.iron);
      if (pn.hi) for (let a = 2; a < S.len; a += 3) { pn.dot(...S.p(a, 2.8), P.iron[4]); pn.dot(...S.p(a, -2.8), M.iron[1]); }
      else pn.ln(...S.p(1, 2.4), ...S.p(S.len - 1, 3.2), M.iron[3]);
      // 大腿：铆接圆筒 + 两道黄铜箍
      pn.cap(L.hx, L.hy, kx, ky, 4.6).paint(M.iron);
      for (const t of [0.3, 0.72]) { const a = T.len * t; pn.poly(T.pts([[a - 0.9, -4.7], [a + 0.9, -4.7], [a + 0.9, 4.7], [a - 0.9, 4.7]])).paint(M.brass, { outline: false }); }
      if (pn.hi) for (const a of [T.len * 0.12, T.len * 0.51, T.len * 0.9]) pn.dot(...T.p(a, 2.6), P.iron[4]);
      // 膝：压力表
      pn.disc(kx, ky, 4.4).paint(M.brass);
      pn.disc(kx, ky, 2.9).paint([M.dark[0], M.steam[1], M.steam[2], M.steam[3]], { outline: false, bevel: 's' });
      if (pn.hi) for (let k = 0; k < 5; k++) { const a = Math.PI * (0.9 + k * 0.3); pn.dot(kx + Math.cos(a) * 2.3, ky + Math.sin(a) * 2.3, k > 3 ? M.fire[2] : M.gauge[2]); }
      const na = -Math.PI * (o.mv ? 0.2 : 0.8);
      pn.ln(kx, ky, kx + Math.cos(na) * 2.4, ky + Math.sin(na) * 2.4, M.dark[0]);
      // 胯
      pn.disc(L.hx, L.hy, 4.8).paint(M.iron); pn.disc(L.hx, L.hy, 1.8).paint(M.dark, { outline: false });
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.iron, 4, 12);
      pn.fill(a, y + 12, b - a, 1, P.brass[2]); pn.fill(a, y + 13, b - a, 1, P.brass[1]);
      for (const rx of [5, 24, 40]) rivet(pn, x + rx, y + 7);
    },
  };

  // T4 · 蒸汽圣骑：哥特板甲。大腿甲 / 带扇形侧翼的护膝 / 护胫 / 分节尖头铁靴 + 马刺；横梁做成腰甲，胯上挂草摺
  const KNIGHT = {
    hipY: 13, bob: 2,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7.5, 5);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + 1 + g.x, L.gy - 4.5 - g.lift, 15.5, 15.5, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt);
      L.T = T;
      // 铁靴：尖头、分节
      const top = [[-4.5, -1.5], [-1, -3], [3, -2], [8, 0.8], [14.5, 3.6]];
      pn.poly(F.pts([...top, [14, 4.5], [-4.5, 4.5]])).paint(M.steel);
      for (const u of pn.hi ? [0.5, 3, 5.5, 8.5] : [2, 6]) pn.ln(...F.p(u, yAt(top, u) + 0.6), ...F.p(u - 0.8, 4), M.steel[0]);
      // 马刺
      const [sx, sy] = F.p(-6.3, 1.4);
      pn.ln(...F.p(-4.5, 1.6), sx, sy, M.brass[1], Math.max(1, pn.s - 1));
      if (pn.hi) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + (o.a || 0); pn.ln(sx, sy, sx + Math.cos(a) * 1.8, sy + Math.sin(a) * 1.8, M.brass[2]); }
      pn.disc(sx, sy, pn.hi ? 0.9 : 0.6).paint(M.brass, { bevel: 'l' });
      // 护胫
      pn.poly(S.pts([[-1, -3.2], [-1, 3.4], [S.len + 0.5, 2.6], [S.len + 0.5, -2.4], [S.len * 0.62, -3.4], [S.len * 0.32, -4.6]])).paint(M.steel);
      pn.ln(...S.p(1, 1.8), ...S.p(S.len - 1, 1.2), M.steel[3]);
      if (pn.hi) pn.ln(...S.p(1, 1.1), ...S.p(S.len - 1, 0.6), M.steel[1]);
      // 大腿甲
      pn.poly(T.pts([[-2, -4], [-2, 5.2], [T.len - 3, 4.4], [T.len - 0.5, 1], [T.len - 2.5, -3.2]])).paint(M.steel);
      pn.ln(...T.p(0, 2.2), ...T.p(T.len - 3, 1.8), M.steel[3]);
      if (pn.hi) { pn.ln(...T.p(0, 1.5), ...T.p(T.len - 3, 1.2), M.steel[1]); pn.ln(...T.p(1, -1.5), ...T.p(T.len - 4, -1.2), M.steel[1]); }
      // 护膝：黄铜扇形侧翼 + 钢护膝 + 前尖
      const wx = kx - 2.6, wy = ky + 0.3, nr = pn.hi ? 7 : 4;
      pn.disc(wx, wy, 5.4).poly([[wx - 1, wy - 5], [wx + 2.5, wy - 6.8], [wx + 3, wy - 3]]).paint(M.brass);
      for (let k = 0; k < nr; k++) { const a = Math.PI * (0.55 + k / (nr - 1) * 0.95); pn.ln(wx + Math.cos(a) * 1.4, wy + Math.sin(a) * 1.4, wx + Math.cos(a) * 4.6, wy + Math.sin(a) * 4.6, M.brass[1]); }
      pn.disc(kx + 0.6, ky, 2.9).poly([[kx + 2.2, ky - 1.5], [kx + 5.6, ky + 0.2], [kx + 2.2, ky + 1.6]]).paint(M.steel);
      pn.dot(kx - 0.2, ky - 1, M.steel[3]);
    },
    // 草摺：挂在胯上，跟着大腿转一半
    over(pn, L, ph, o) {
      const M = L.M, F = frame(L.hx, L.hy - 4, (L.T.ang - Math.PI / 2) * 0.55);
      pn.poly(F.pts([[-6, 0], [6.5, 0], [7.5, 7], [-5, 8]])).paint(M.steel);
      pn.poly(F.pts([[-5.2, 6.5], [7.4, 5.7], [7.7, 7.5], [-5, 8.5]])).paint(M.brass, { outline: false, bevel: 'l' });
      if (pn.hi) { pn.ln(...F.p(-5.5, 3.2), ...F.p(6.9, 3), M.steel[1]); pn.ln(...F.p(-5.5, 3.7), ...F.p(6.9, 3.5), M.steel[3]); }
      pn.dot(...F.p(-3.6, 1.4), M.steel[3]); pn.dot(...F.p(4.8, 1.4), M.steel[3]);
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.steel, 4, 10);
      pn.fill(a, y + 8, b - a, 1, P.iron[1]); pn.fill(a, y + 9, b - a, 1, P.iron[4]);
      pn.fill(a, y + 12, b - a, 1, P.brass[2]); pn.fill(a, y + 13, b - a, 1, P.brass[1]);
      for (const rx of [26, 42]) rivet(pn, x + rx, y + 5);
      // 纹章盾：隔一格一块
      if (o.ri % 2 === 0) {
        const cx = x + 34, cy = y + 9.2, sh = [[cx - 3.2, cy - 3.6], [cx + 3.2, cy - 3.6], [cx + 3.2, cy + 0.4], [cx, cy + 3.8], [cx - 3.2, cy + 0.4]];
        pn.poly(sh).paint([P.brass[0], P.brass[1], P.brass[2], P.brass[3]]);
        pn.poly([[cx - 2.2, cy - 2.6], [cx + 2.2, cy - 2.6], [cx + 2.2, cy + 0.2], [cx, cy + 2.6], [cx - 2.2, cy + 0.2]]).paint(flat(P.iron[1]), { outline: false });
        pn.fill(cx - 0.5, cy - 2.6, 1, 5, P.brass[3]); pn.fill(cx - 2.2, cy - 1.2, 4.4, 1, P.brass[3]);
      }
    },
  };

  // T5 · 钟表巨像：开框大腿里转着齿轮，膝盖是大齿轮，胫骨带棘轮齿；脚是维多利亚家具的「爪握球」
  const CLOCK = {
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 7, 5);
      const bx = L.hx + 1.5 + g.x, by = L.gy - 4.3 - g.lift;
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, bx - 0.5, by - 6, 13, 13, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey);
      // 球（滚动时接缝跟着转）
      pn.disc(bx, by, 4.3).paint(M.iron);
      const ra = (o.q || 0) / 4.3;
      if (pn.hi) pn.ln(bx + Math.cos(ra) * 3.2, by + Math.sin(ra) * 3.2, bx - Math.cos(ra) * 3.2, by - Math.sin(ra) * 3.2, M.iron[1]);
      pn.dot(bx - 1.6, by - 1.8, P.iron[4]);
      // 胫：棘轮齿在后缘
      for (let a = 2; a < S.len - 2; a += pn.hi ? 2.2 : 3.2) pn.poly(S.pts([[a, -2], [a + 1.8, -2], [a + 1.8, -3.9]]));
      pn.paint(M.iron, { bevel: 'l' });
      pn.poly(S.pts([[0, -2.4], [0, 2.8], [S.len, 2.2], [S.len, -2]])).paint(M.iron);
      for (const a of [0.8, S.len - 1.4]) pn.poly(S.pts([[a - 0.8, -2.6], [a + 0.8, -2.6], [a + 0.8, 3], [a - 0.8, 3]])).paint(M.brass, { outline: false });
      // 三根黄铜爪从踝扣下来握住球
      const claw = (px, py, qx, qy) => pn.cap(ex, ey, px, py, 0.9).cap(px, py, qx, qy, 0.8);
      claw(bx - 3.7, by - 2.4, bx - 4.4, by + 0.8); claw(bx + 3.5, by - 2.6, bx + 4.4, by + 0.6); claw(bx + 0.6, by - 4.4, bx + 2, by - 2.6);
      pn.paint(M.brass, { bevel: 'l' });
      pn.disc(ex, ey, 2.2).paint(M.brass);
      // 大腿：开框 + 齿轮
      pn.cap(L.hx, L.hy, kx, ky, 1.8).paint(M.leg);
      pn.cap(...T.p(0, -3.3), ...T.p(T.len, -2.7), 0.9).cap(...T.p(0, 3.5), ...T.p(T.len, 2.9), 0.9).paint(M.brass, { bevel: 'l' });
      for (const t of pn.hi ? [0.35, 0.65] : [0.5]) pn.ln(...T.p(T.len * t, -2.9), ...T.p(T.len * t, 3.1), M.brass[1], pn.hi ? 2 : 1);
      // 膝：大齿轮
      gear(pn, kx, ky, 4.6, 10, -o.a * 1.2 + ph, M.brass, M.iron);
      gear(pn, L.hx, L.hy, 3.6, 8, o.a * 1.5 + ph, M.brass, M.iron);
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      beamBox(pn, x, y, o, NEAR.iron, 4, 12);
      const w0 = o.connL ? x : x + 6, w1 = o.connR ? x + 48 : x + 42;
      pn.fill(w0, y + 7, w1 - w0, 6, P.dark[0]);
      for (let k = 0; k < 5; k++) {
        const gx = x + 6 + k * 9;
        if (gx < w0 + 1 || gx > w1 - 1) continue;
        gear(pn, gx, y + 10, 2.7, 6, (k % 2 ? -1 : 1) * (o.q || 0) / 2.7 + k * 0.5, NEAR.brass, NEAR.iron);
      }
      pn.fill(w0, y + 6, w1 - w0, 1, P.brass[2]); pn.fill(w0, y + 13, w1 - w0, 1, P.brass[1]);
      pn.fill(w0, y + 14, w1 - w0, 1, P.iron[0]);
    },
  };

  // T6 · 熔心龙骑：三段龙腿。鳞甲大腿里嵌一座小炉膛（发光 = 能源语义：底盘自带少量动力）、膝前尖刺、跗关节后刺、三爪
  const DRAGON = {
    talon(pn, F, du, dv, ramp, M) {
      pn.poly(F.pts([[du, dv - 1.4], [du + 4, dv - 1], [du + 7, dv + 0.4], [du + 8.8, dv + 2.4], [du + 7.6, dv + 2.6], [du + 5.5, dv + 1.8], [du, dv + 2]])).paint(ramp);
      pn.poly(F.pts([[du + 7, dv + 0.9], [du + 8.8, dv + 2.4], [du + 7.6, dv + 2.6]])).paint(M.brass, { outline: false, bevel: '' });
    },
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 8, 6);
      const tx = L.hx + 5 + g.x, ty = L.gy - 2.4 - g.lift, F = frame(tx, ty, g.tilt);
      const [hax, hay] = F.p(-5.5, -10);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, hax, hay, 12.5, 13.5, 1);
      const T = bone(L.hx, L.hy, kx, ky), S = bone(kx, ky, ex, ey), Mt = bone(ex, ey, tx, ty);
      DRAGON.talon(pn, F, -1.6, -0.9, M.dark, M);
      pn.poly(F.pts([[0.5, -0.5], [-4.5, 1.2], [-4.8, 2.4], [0.5, 1.5]])).paint(M.leg);      // 后爪
      pn.cap(ex, ey, tx, ty, 1.8).paint(M.leg);                                              // 跗骨
      pn.poly(Mt.pts([[0.5, 1.2], [Mt.len - 1.2, 1.4], [Mt.len - 2, 2.9], [1, 2.9]])).paint(M.iron);
      pn.poly([[ex + 0.5, ey - 1.8], [ex - 6.2, ey - 3.8], [ex - 0.5, ey + 1.6]]).paint(M.brass);   // 跗关节后刺
      pn.poly(S.pts([[-1, -3.2], [-1, 3.4], [S.len, 2.2], [S.len + 1, -1.8]])).paint(M.iron);
      if (pn.hi) pn.ln(...S.p(0.5, 1.6), ...S.p(S.len - 0.5, 1), M.iron[3]);
      // 大腿：鳞甲
      pn.poly(T.pts([[-3, -4.6], [-3, 5.4], [T.len * 0.6, 5.2], [T.len + 0.5, 2.6], [T.len + 0.5, -2.4], [T.len * 0.5, -4.4]])).paint(M.iron);
      const rows = pn.hi ? [0.5, 0.68, 0.86] : [0.62, 0.86];
      rows.forEach((t, r) => {
        for (const f of [-2.4, 0.4, 3.2]) {
          const a = T.len * t, ff = f + (r % 2) * 1.4;
          if (ff > 4.2) continue;
          pn.ln(...T.p(a - 1.4, ff - 1.3), ...T.p(a, ff), M.iron[0]); pn.ln(...T.p(a, ff), ...T.p(a - 1.4, ff + 1.3), M.iron[0]);
          if (pn.hi) pn.dot(...T.p(a - 1.2, ff), M.iron[3]);
        }
      });
      // 炉膛：一扇小炉窗，煤块忽明忽暗
      const fl = o.fl || 0;
      pn.poly(T.pts([[0, -2.2], [0, 3.2], [4.8, 3.2], [4.8, -2.2]])).paint([M.dark[0], M.fire[0], M.fire[1], M.fire[1]], { bevel: '' });
      for (let k = 0; k < (pn.hi ? 7 : 3); k++) {
        const aa = 0.8 + (k * 1.7) % 3.4, ffv = -1.3 + (k * 2.3) % 4.2;
        pn.dot(...T.p(aa, ffv), (k + fl) % 3 === 0 ? M.fire[3] : M.fire[2]);
      }
      pn.ln(...T.p(1.6, -2.2), ...T.p(1.6, 3.2), M.dark[0]); pn.ln(...T.p(3.2, -2.2), ...T.p(3.2, 3.2), M.dark[0]);
      // 膝：前刺 + 黄铜毂
      pn.poly([[kx + 1, ky - 2.2], [kx + 6.8, ky - 3.4], [kx + 2, ky + 1.8]]).paint(M.brass);
      pn.disc(kx, ky, 3).paint(M.brass); pn.dot(kx, ky, M.brass[0]);
      DRAGON.talon(pn, F, 0, 0, M.leg, M);
      pn.disc(L.hx, L.hy, 3.8).paint(M.iron); pn.disc(L.hx, L.hy, 1.5).paint(M.fire, { outline: false, bevel: '' });
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      // 下沿一排垂鳞
      for (let k = -1; k < 11; k++) { const sx = x + 2 + k * 5; if (!o.connL && sx < x + 3) continue; if (!o.connR && sx > x + 45) continue; pn.disc(sx, y + 14.2, 2.6); }
      pn.paint(NEAR.iron, { clip: [x, x + 48] });
      const [a, b] = beamBox(pn, x, y, o, NEAR.iron, 4, 11);
      pn.fill(a, y + 13, b - a, 1, P.brass[1]);
      // 通风缝里透出炉火
      pn.fill(x + 21, y + 7, 9, 3, P.dark[0]);
      for (let k = 0; k < 4; k++) pn.fill(x + 22 + k * 2, y + 8, 1, 1, (k + (o.fl || 0)) % 2 ? P.fire[3] : P.fire[2]);
      pn.fill(x + 20, y + 6, 11, 1, P.brass[2]); pn.fill(x + 20, y + 10, 11, 1, P.brass[1]);
      rivet(pn, x + 8, y + 7); rivet(pn, x + 40, y + 7);
    },
  };

  // ---------- 探索版 ----------
  // E1 · 高跷：没有膝盖的伸缩腿，靠套筒伸缩抬脚
  const STILT = {
    bob: 4,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 8.5, 6);
      const fx = L.hx + 1 + g.x, fy = L.gy - 2.4 - g.lift, B = bone(L.hx, L.hy, fx, fy), n = B.len;
      pn.poly([[fx - 3.5, fy + 0.2], [fx + 3.5, fy + 0.2], [fx + 4.6, fy + 2.4], [fx - 4.6, fy + 2.4]]).paint(M.leg);
      pn.disc(fx, fy, 1.4).paint(M.iron);
      pn.cap(...B.p(n * 0.55, 0), ...B.p(n - 1, 0), 0.9).paint(M.steam, { bevel: 'l' });
      pn.cap(...B.p(9, 0), ...B.p(n * 0.62, 0), 1.6).paint(M.iron);
      const collar = (a, w, ramp) => pn.poly(B.pts([[a - 0.8, -w], [a + 0.7, -w], [a + 0.7, w], [a - 0.8, w]])).paint(ramp);
      collar(n * 0.62, 2.1, M.brass);
      pn.cap(...B.p(-1, 0), ...B.p(11, 0), 2.4).paint(M.leg);
      collar(11, 2.9, M.brass);
      if (pn.hi) pn.ln(...B.p(0, 1.2), ...B.p(10, 1.2), M.leg[3]);
      pn.disc(L.hx, L.hy, 3.2).paint(M.brass); pn.dot(L.hx - 1, L.hy - 1, M.brass[3]);
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.dark, 4, 8);
      pn.fill(a, y + 7, b - a, 1, P.brass[1]);
      for (const hx of [16, 30]) pn.poly([[x + hx - 5, y + 11], [x + hx + 5, y + 11], [x + hx + 3, y + 15], [x + hx - 3, y + 15]]).paint(NEAR.dark);
    },
  };

  // E2 · 轮足：反关节腿末端是辐条轮，滑行不迈步——起伏最小
  const WHEEL = {
    bob: 1,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 3, 1.5);
      const wx = L.hx + 3 + g.x, wy = L.gy - 5.8 - g.lift;
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, wx, wy, 14, 15, -1);
      pn.cap(L.hx, L.hy, kx, ky, 2.6).paint(M.leg);
      pn.disc(wx, wy, 5.8).paint(M.dark);
      pn.disc(wx, wy, 4.4).paint(flat(M.iron[1]), { outline: false, bevel: '' });
      const ra = (o.q || 0) / 5.8;
      for (let k = 0; k < 6; k++) { const a = ra + k * Math.PI / 3; pn.ln(wx, wy, wx + Math.cos(a) * 4.3, wy + Math.sin(a) * 4.3, M.iron[3]); }
      if (pn.hi) for (let k = 0; k < 12; k++) { const a = ra + k * Math.PI / 6; pn.dot(wx + Math.cos(a) * 5.2, wy + Math.sin(a) * 5.2, M.dark[3]); }
      pn.disc(wx, wy, 1.5).paint(M.brass);
      // 挡泥板
      for (let k = 0; k <= 6; k++) { const a = Math.PI * (1.05 + k * 0.12); pn.cap(wx + Math.cos(a) * 6.8, wy + Math.sin(a) * 6.8, wx + Math.cos(a + 0.12) * 6.8, wy + Math.sin(a + 0.12) * 6.8, 0.6); }
      pn.paint(M.iron, { bevel: 'l' });
      pn.cap(kx, ky, ex, ey, 1.5).paint(M.leg, { bevel: 'l' });
      pn.disc(kx, ky, 2.8).paint(M.iron);
      pn.disc(L.hx, L.hy, 3).paint(M.iron); pn.disc(L.hx, L.hy, 1.1).paint(M.brass, { outline: false });
    },
    beam: MK2.beam,
  };

  // E3 · 裙甲堡：大裙甲罩住大腿和膝盖，只露出护胫和铁靴碎步走
  const SKIRT = {
    bob: 2, hipY: 15,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 5, 3);
      const [kx, ky, ex, ey] = ik(L.hx, L.hy, L.hx + 1 + g.x, L.gy - 4 - g.lift, 15, 15, 1);
      L.T = bone(L.hx, L.hy, kx, ky);
      const S = bone(kx, ky, ex, ey), F = frame(ex, ey, g.tilt);
      const top = [[-4, -1.5], [-1, -2.6], [4, -1.4], [8, 1.4], [11.5, 3.4]];
      pn.poly(F.pts([...top, [11, 4], [-4, 4]])).paint(M.steel);
      pn.ln(...F.p(3, yAt(top, 3) + 0.6), ...F.p(2.4, 3.6), M.steel[0]);
      pn.poly(S.pts([[-1, -3.2], [-1, 3.8], [S.len * 0.5, 4.2], [S.len + 0.5, 2.8], [S.len + 0.5, -2.6]])).paint(M.steel);
      pn.ln(...S.p(1, 1.8), ...S.p(S.len - 1, 1.2), M.steel[3]);
      pn.cap(L.hx, L.hy, kx, ky, 3).paint(M.leg);
      pn.disc(kx + 0.6, ky, 3).paint(M.iron);
    },
    over(pn, L, ph, o) {
      const M = L.M, F = frame(L.hx, L.hy - 3, (L.T.ang - Math.PI / 2) * 0.3);
      for (let k = 2; k >= 0; k--) {
        const v = k * 6, w0 = 7 + k * 2.3, w1 = w0 + 2.3;
        pn.poly(F.pts([[-w0, v], [w0, v], [w1, v + 8], [-w1, v + 8]])).paint(M.steel);
        pn.poly(F.pts([[-w1 + 0.5, v + 6.7], [w1 - 0.5, v + 6.7], [w1 - 0.3, v + 7.9], [-w1 + 0.3, v + 7.9]])).paint(k === 2 ? M.brass : M.iron, { outline: false, bevel: 'l' });
        if (pn.hi) for (const u of [-w0 + 2, 0, w0 - 2]) pn.dot(...F.p(u, v + 2), P.iron[4]);
      }
    },
    beam(pn, x, y, o) {
      floor(pn, x, y, o);
      const [a, b] = beamBox(pn, x, y, o, NEAR.steel, 4, 10);
      pn.fill(a, y + 12, b - a, 1, P.brass[2]); pn.fill(a, y + 13, b - a, 1, P.brass[1]);
    },
  };

  // E4 · 板簧跑刃：短大腿 + C 形叠层板簧刀片（跑步假肢），着地时压弯回弹
  const BLADE = {
    bob: 3,
    leg(pn, L, ph, o) {
      const M = L.M, g = gait(o, ph, 8, 6);
      const tx = L.hx + 4 + g.x, ty = L.gy - 1.4 - g.lift;
      const [kx, ky] = ik(L.hx, L.hy, tx - 5, ty - 11, 11, 13, 1);
      const load = o.mv ? Math.max(0, -g.sn) : 0.6;
      const P0 = [kx, ky], P1 = [kx - 3 - 2.5 * load, ky + 9], P2 = [tx - 9 - load, ty + 1], P3 = [tx + 2.5, ty];
      const bz = (t) => { const u = 1 - t; return [0, 1].map(i => u * u * u * P0[i] + 3 * u * u * t * P1[i] + 3 * u * t * t * P2[i] + t * t * t * P3[i]); };
      const N = 16, pts = Array.from({ length: N + 1 }, (_, k) => bz(k / N));
      // 副簧片（后面一层，短一截）
      for (let k = 1; k < N * 0.7; k++) { const a = pts[k - 1], b = pts[k]; pn.cap(a[0] - 1.3, a[1] + 0.6, b[0] - 1.3, b[1] + 0.6, 0.9); }
      pn.paint(M.iron, { bevel: 'l' });
      for (let k = 1; k <= N; k++) { const a = pts[k - 1], b = pts[k]; pn.cap(a[0], a[1], b[0], b[1], 1.4); }
      pn.paint(M.steel);
      pn.poly([[tx - 3, ty + 0.3], [tx + 3.5, ty - 0.1], [tx + 3.6, ty + 1.4], [tx - 3, ty + 1.4]]).paint(M.dark);
      pn.cap(L.hx, L.hy, kx, ky, 2.8).paint(M.leg);
      pn.disc(kx, ky, 3).paint(M.iron); pn.dot(kx + 0.5, ky + 0.5, M.brass[2]);
      pn.disc(L.hx, L.hy, 3).paint(M.iron); pn.disc(L.hx, L.hy, 1.1).paint(M.brass, { outline: false });
    },
    beam: HERON.beam,
  };

  // E5 · 圣堂 · 纹章罩袍：圣骑 + 两腿之间一块随步伐摆动的罩袍（黄铜镶边、齿轮纹章）
  const TABARD = {
    ...KNIGHT,
    mid(pn, L, o) {
      const M = L.M, x = L.x, top = L.y + 12, sw = o.mv ? Math.sin(o.a) * 1.6 : 0;
      const pts = [[x + 17, top], [x + 30, top], [x + 30.5 + sw, top + 22], [x + 23.5 + sw, top + 25], [x + 16.5 + sw, top + 22]];
      pn.poly(pts).paint(M.leather);
      pn.poly([[x + 16.9 + sw, top + 20.6], [x + 23.5 + sw, top + 23.4], [x + 30.4 + sw, top + 20.6], [x + 30.5 + sw, top + 22], [x + 23.5 + sw, top + 25], [x + 16.5 + sw, top + 22]]).paint(M.brass, { outline: false, bevel: '' });
      if (pn.hi) { pn.ln(x + 17.6, top + 1, x + 17.2 + sw, top + 20, M.brass[1]); pn.ln(x + 29.4, top + 1, x + 29.8 + sw, top + 20, M.brass[1]); }
      const gx = x + 23.5 + sw * 0.4, gy = top + 8;
      if (pn.hi) gear(pn, gx, gy, 3, 8, 0.2, M.brass, M.leather);
      else { pn.fill(gx - 0.5, gy - 2, 1, 5, M.brass[2]); pn.fill(gx - 2, gy - 0.5, 5, 1, M.brass[2]); }
    },
  };

  // 现役（对照）：直接调用游戏里的精灵
  const tmp = document.createElement('canvas'); tmp.width = 80; tmp.height = 64;
  const BASE = {
    game: true,
    draw(pn, g, x, y, o, part) {
      const t = tmp.getContext('2d'); t.clearRect(0, 0, 80, 64);
      SA.SPR.drawModule(t, 'biped', 0, 16, { moving: o.mv, phase: o.phase, bd: o.bd, part, ri: o.ri, connL: o.connL, connR: o.connR, top: o.top });
      pn.flush(g); pn.blit(g, tmp, x, y - 16);
    },
  };

  const DESIGNS = [
    { id: 'base', q: 0, tag: '现役', name: '双足底盘', sub: '对照组：两根小铁棍', d: BASE,
      note: '现役造型：两段反关节细腿 + 小方脚，1× 下只有 3px 粗。' },
    { id: 'mk2', q: 1, name: '工装 Mk.II', sub: '箱形梁 · 液压撑杆', d: MK2,
      note: '和现役同一套反关节步态，一眼是「同一条腿的正经版」：大腿换成带减重孔的箱形梁，小腿换成双支杆 + 斜撑，前方多一根会伸缩的液压撑杆，脚板有肋。' },
    { id: 'heron', q: 2, name: '鹭步', sub: '三段鸟腿 · 三趾爪', d: HERON,
      note: '剪影换成 Z 字：膝盖朝前、跗关节高高翘在后面，像鹭鸟。黄铜关节毂、膝后弹簧、三趾爪 + 后趾。轻快、细长，适合做「更快更晃」的精良款。' },
    { id: 'gren', q: 3, name: '掷弹兵', sub: '圆筒腿 · 压力表膝', d: GREN,
      note: '第一次换成人形正膝：铆接圆筒大腿 + 黄铜箍，喇叭口护胫，平头厚底重靴。膝盖是一块压力表（走起来指针打到高压），膝后一根蒸汽活塞。粗壮、稳。' },
    { id: 'knight', q: 4, name: '蒸汽圣骑', sub: '哥特板甲骑士', d: KNIGHT,
      note: '骑士机甲：大腿甲（带棱线）、护膝 + 黄铜扇形侧翼、护胫、分节尖头铁靴、脚跟马刺（2× 下是会转的星轮）。横梁做成腰甲，胯上挂一片跟着大腿摆的草摺，每隔一格一面纹章盾。' },
    { id: 'clock', q: 5, name: '钟表巨像', sub: '齿轮 · 爪握球', d: CLOCK,
      note: '开框大腿里转着齿轮，膝盖是一只大齿轮，胫骨后缘是棘轮齿；脚是维多利亚家具的「爪握球」：三根黄铜爪握住一颗铁球。横梁开窗露出一排随步伐转动的齿轮组。' },
    { id: 'dragon', q: 6, name: '熔心龙骑', sub: '龙腿 · 炉膛 · 三爪', d: DRAGON,
      note: '三段龙腿：鳞甲大腿里嵌一扇小炉窗（煤块忽明忽暗），膝前尖刺、跗关节后刺、三爪 + 后爪，横梁下沿一排垂鳞、通风缝透出炉火。发光 = 能源语义，所以玩法上建议让它自带一点动力。' },
    { id: 'stilt', q: -1, name: '高跷', sub: '伸缩套筒 · 无膝', d: STILT,
      note: '探索：没有膝盖，腿是三节伸缩套筒，抬脚靠缩短。最细最高的剪影，起伏最大。' },
    { id: 'wheel', q: -1, name: '轮足', sub: '反关节 + 辐条轮', d: WHEEL,
      note: '探索：反关节腿末端是辐条轮，滑行不迈步，几乎不起伏。玩法可以是「双足里最稳的一款」。' },
    { id: 'skirt', q: -1, name: '裙甲堡', sub: '大裙甲 · 碎步', d: SKIRT,
      note: '探索：三层裙甲罩住大腿和膝盖，只露护胫和铁靴碎步走，剪影是钟形。最耐打的双足方向。' },
    { id: 'blade', q: -1, name: '板簧跑刃', sub: 'C 形叠层板簧', d: BLADE,
      note: '探索：短大腿 + C 形叠层板簧刀片（跑步假肢），着地时刀片被压弯、抬脚回弹。最快最弹。' },
    { id: 'tabard', q: -1, name: '圣堂 · 纹章罩袍', sub: '圣骑 + 罩袍', d: TABARD,
      note: '探索：在蒸汽圣骑的基础上，两腿之间挂一块随步伐摆动的皮革罩袍（黄铜镶边、齿轮纹章），测试布料能不能让骑士感更强。' },
  ];

  // ---------- 一格底盘 ----------
  // L = 一条腿的挂点；hx 可覆盖（整段巨腿模式下腿不在格子里的固定位置）
  const legAt = (D, far, x, y, o, hx) => ({
    far, M: far ? FAR : NEAR, x, y: y + o.bd,
    hx: hx != null ? hx : x + (far ? 30 : 16), hy: y + (D.hipY || 14) + o.bd - (far ? 3 : 0),
    gy: y + 47 - (far ? 3 : 0) + ((far ? o.g1 : o.g0) || 0),   // 悬挂：这只脚往下伸（正）/ 往上收（负）
  });
  // 腿长倍率 k：以胯为支点放大整条腿（和挂在胯上的甲片），横梁不变
  function drawLeg(pn, D, L, o, k) {
    const ph = L.far ? Math.PI : 0, back = pn.around(k || 1, L.hx, L.hy);
    D.leg(pn, L, ph, o); if (D.over) D.over(pn, L, ph, o);
    back();
  }
  // part: 'far' 只画远侧腿 / 'near' 只画横梁 + 近侧腿 / 省略 = 都画；o.noLegs 只画横梁（巨腿模式另外画腿）
  function drawCell(pn, g, D, x, y, o, part) {
    if (D.game) return D.draw(pn, g, x, y, o, part);
    if (part !== 'near' && !o.noLegs) drawLeg(pn, D, legAt(D, true, x, y, o), o, o.k);
    if (part === 'far') return;
    const L = legAt(D, false, x, y, o);
    D.beam(pn, x, y + o.bd, o);
    if (D.mid) D.mid(pn, L, o);
    if (!o.noLegs) drawLeg(pn, D, L, o, o.k);
  }

  // 步态状态 → 每格的绘制参数（同 sprites.js：12 帧一循环、每走 5px 换一帧；相邻格错开半个周期）
  function cellOpts(D, st, ri, rn, extra) {
    const N = st.frames, gf = st.mv ? SA.Dyn.frame(st.phase, N, 60 / N) : 0, a = gf / N * TAU;
    const amp = D.d.bob == null ? 3 : D.d.bob;
    return {
      mv: st.mv, a: a + ri * Math.PI, bd: amp - Math.round(Math.abs(Math.sin(a)) * amp),
      q: gf * 60 / N, phase: st.phase, fl: Math.floor(st.t * 8) % 4, ri, rn,
      connL: ri > 0, connR: ri < rn - 1, k: st.k || 1, ...extra,
    };
  }
  // 地面高度（格子坐标）：胯 + 腿长 × 倍率；现役精灵不缩放
  const groundY = (e, k) => (e.d.game ? 47 : (e.d.hipY || 14) + (47 - (e.d.hipY || 14)) * k);

  // ---------- 蜘蛛腿（四足） ----------
  // 每格两条：近侧一条、远侧一条，往前后张开。H.up = 膝盖高出胯多少（用膝高区分型号），H.kx 膝盖往外伸，H.reach 脚往外伸。
  // 脚到膝盖之间的小腿长度可变：悬挂伸缩时脚跟着地面走，小腿自己拉长缩短
  function spiderLeg(pn, M, hx, hy, gy, dir, ph, o, H) {
    const g = gait(o, ph, H.stride || 5, H.lift || 4);
    const fx = hx + dir * H.reach + g.x, fy = gy - g.lift;
    const kx = hx + dir * H.kx + g.x * (H.kf || 0.3), ky = hy - H.up - g.lift * 0.6;   // kf：膝盖跟着脚摆多少
    const F = bone(hx, hy, kx, ky), t = H.w || 1;   // t：腿的粗细倍数（新版四足用，游戏里现有的蜘蛛腿是 1）
    pn.disc(hx, hy, 3.2 * t).paint(M.iron); pn.disc(hx, hy, 1.2 * t).paint(M.brass, { outline: false });   // 髋关节毂先画：股节、胫节压在它前面
    pn.poly(F.pts([[0, -2.6 * t], [0, 2.6 * t], [F.len, 3.4 * t], [F.len, -3.4 * t]])).paint(M.leg);
    if (F.len > 14) pn.ln(...F.p(2, 0), ...F.p(F.len - 3, 0), M.leg[3]);
    const B = bone(kx, ky, fx, fy), a = B.len * 0.3;
    pn.poly(B.pts([[-1, -3.6 * t], [-1, 3.6 * t], [B.len * 0.45, 2.8 * t], [B.len - 3, 1.2 * t], [B.len + 1, 0], [B.len - 3, -1.2 * t], [B.len * 0.45, -2.4 * t]])).paint(M.leg);
    pn.poly(B.pts([[a - 0.9, -3.1 * t], [a + 0.9, -3.1 * t], [a + 0.9, 3.1 * t], [a - 0.9, 3.1 * t]])).paint(M.brass, { outline: false });
    pn.disc(kx, ky, 3.4 * t).paint(M.iron); pn.dot(kx - 1, ky - 1, M.iron[3]);
  }
  // 蜘蛛机身（一格）：压低的梯形甲壳，相邻同类格子连成一片
  function carapace(pn, x, y, connL, connR, top, w = 48) {
    pn.fill(x, y, w, 3, P.iron[1]); pn.fill(x, y + 2, w, 1, P.iron[0]);
    if (!top) { pn.fill(x, y, w, 1, P.iron[0]); pn.fill(x, y + 1, w, 1, P.iron[3]); }
    const x0 = connL ? x - 4 : x + 2, x1 = connR ? x + w + 4 : x + w - 2;
    pn.poly([[x0, y + 3], [x1, y + 3], [x1 - (connR ? 0 : 3), y + 14], [x0 + (connL ? 0 : 3), y + 14]]).paint(NEAR.dark, { clip: [x, x + w] });
    for (let k = 8; k < w; k += 16) pn.fill(x + k, y + 5, 1, 8, P.dark[0]);
    rivet(pn, x + 3, y + 6); rivet(pn, x + w - 6, y + 6);
    pn.fill(x0 < x ? x : x0 + 1, y + 11, Math.min(x1, x + w) - Math.max(x0, x) - 1, 1, P.brass[1]);
  }
  // 蜘蛛型号：伏地蛛 = 四足 T1（矮、宽、稳），高脚蛛 = 膝盖高出机身一大截
  const SPIDERS = {
    crawl: { name: '伏地蛛', up: 12, kx: 15, reach: 30 },
    tall: { name: '高脚蛛', up: 30, kx: 12, reach: 24 },
  };

  // ================= 新版整件底盘（四足 4×2、真双足 2×4）：只管外观和动画，坐标都是模块左上角 =================

  // 步幅（新版整件底盘，世界像素）：跟着车速变，慢走小步、快跑大步，脚在胯前后 ±步幅之间摆（跨过腿的轴线）
  const strideFor = (v) => Math.max(16, Math.min(40, 18 + v * 0.25));
  // 四足整件的步幅：小碎步，最多 ±13px，脚不出这一件的边界（战斗里按它推进步态角，脚不打滑）
  const quadStride = (v) => Math.max(8, Math.min(13, 8 + v * 0.07));
  // 机身起伏：着地的腿像圆规一样绕脚转，脚离胯越远胯越低（R = 胯到脚的腿长）。phs = 各条腿的相位差，dx0 = 脚静止时离胯多远
  function strideBob(o, R, phs, dx0 = 0) {
    if (!o.mv) return 0;
    let d = 0;
    for (const ph of phs) {
      const g = plantGait(o, ph, o.stride || 15, 1);
      if (g.lift > 0) continue;
      const x = g.x + dx0;
      d = Math.max(d, R - Math.sqrt(Math.max(0, R * R - x * x)));
    }
    return Math.round(d);
  }
  const quadBob = (o) => Math.round(strideBob(o, 70, [0, Math.PI]) * 0.35);   // 四足稳：四条腿轮流撑着，机身只轻轻起伏
  const bipedBob = (o) => strideBob(o, 58, [0, Math.PI], 4);

  // 四足型号：腿形。reach = 脚静止时离胯多远（小 → 脚在胯下附近前后大幅摆动），kf = 膝盖跟着脚摆多少。伏地蛛矮宽稳，高脚蛛膝盖高出机身一大截
  // 伏地蛛的膝盖只比胯高一点、贴着甲壳上沿（2026-09-26）：原来膝盖高出机身 16px，会挡住车身两侧的模块和摆放格
  // 脚收在整件范围里（2026-09-26）：膝盖往外张、脚往回收，静止时脚离胯 4px，加上四足自己的小步幅（quadStride ≤ 13），
  // 走起来脚也不会伸出这一件的左右边界（原来脚伸出去四五十像素，车头车尾的腿像走出了车外）
  const QUADS = {
    crawl: { name: '伏地蛛', up: 5, kx: 10, reach: 4, kf: 0.45, w: 1.35 },
    tall: { name: '高脚蛛', up: 38, kx: 16, reach: 18, kf: 0.45, w: 1.25 },
  };
  // 四足 · 4×2（96×48）：一整块压低的蜘蛛甲壳 + 四条腿（近侧后 / 前、远侧后 / 前）。后腿往后张、前腿往前张，
  // 对角两条同相（近后 + 远前、近前 + 远后）大步交替。远侧腿压暗、往右上错开，画在车体后面。
  // o：{ mv, a（步态角）, stride（步幅，见 strideFor）, bd（机身起伏，见 quadBob）, g: [近后, 近前, 远后, 远前]（悬挂伸缩）, top（上面压着模块）, look: QUADS 的键 }
  // 接地点（模块内 x，静止时，伏地蛛）：近后 18、近前 78、远后 20、远前 80；走起来在这前后 ±步幅（quadStride）
  // part：'far' 只画远侧两条腿 / 'near' 只画甲壳 + 近侧两条腿 / 'shell' 只画甲壳 / 'legs' 只画近侧两条腿 / 省略 = 都画
  // connL / connR：左右紧挨着另一件四足（首尾相连的车体蜈蚣），甲壳连成一片
  const QUAD_HIPS = { nr: [22, 10], nf: [74, 10], fr: [24, 7], ff: [76, 7] };   // 远侧只往右错 2px，远侧的膝和脚也不出界
  function quadArt(pn, x, y, o, part) {
    const H = QUADS[o.look] || QUADS.crawl, bd = o.bd || 0, g = o.g || [0, 0, 0, 0], S = o.stride || 15;
    const lo = { ...o, plant: true, plantS: S, plantH: 5 + 0.3 * S };
    const leg = (M, [hx, hy], gy, dir, ph) => spiderLeg(pn, M, x + hx, y + hy + bd, gy, dir, ph, lo, H);
    if (!part || part === 'far') { leg(FAR, QUAD_HIPS.fr, y + 45 + g[2], -1, Math.PI); leg(FAR, QUAD_HIPS.ff, y + 45 + g[3], 1, 0); }
    if (part === 'far') return;
    if (part !== 'legs') {
      carapace(pn, x, y + bd, !!o.connL, !!o.connR, o.top, 96);
      pn.fill(x + 44, y + bd + 5, 8, 6, P.dark[0]); pn.fill(x + 45, y + bd + 6, 6, 4, P.brass[1]); pn.fill(x + 45, y + bd + 6, 6, 1, P.brass[3]);   // 甲壳正中的黄铜舱盖
    }
    if (part === 'shell') return;
    leg(NEAR, QUAD_HIPS.nr, y + 48 + g[0], -1, 0); leg(NEAR, QUAD_HIPS.nf, y + 48 + g[1], 1, Math.PI);
  }

  // 胯：腰部回转环（刻痕随步伐转）+ 倒梯形胯体 + 陀螺仪窗；左右腰挂位有模块时，胯体伸出同材质的法兰板压住，一颗大铆钉固定。
  // (cx, Y) = 胯列中心、胯顶。o：{ legId（决定胯的材质）, wL, wR, phase, t（陀螺转动）, tilt（陀螺偏向，平衡系统用）, wob（晃动幅度） }
  const PELVIS_MAT = { knight: 'steel', tabard: 'steel', skirt: 'steel', clock: 'brass', dragon: 'fire' };
  function ellipse(pn, cx, cy, rx, ry, tilt, front, back) {
    const n = 36, c = Math.cos(tilt), s = Math.sin(tilt);
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pn.dot(cx + x * c - y * s, cy + x * s + y * c, Math.sin(a) > 0 ? front : back);
    }
  }
  function pelvis(pn, cx, Y, o = {}) {
    const mat = PELVIS_MAT[o.legId] || 'iron';
    const R = mat === 'steel' ? NEAR.steel : mat === 'brass' ? NEAR.brass : NEAR.iron;
    for (const side of [-1, 1]) if (side < 0 ? o.wL : o.wR) {
      pn.poly([[cx + side * 17, Y + 7], [cx + side * 30, Y + 9], [cx + side * 30, Y + 23], [cx + side * 15, Y + 26]]).paint(R);
      pn.disc(cx + side * 25, Y + 16, 2.4).paint(NEAR.brass);
    }
    pn.rect(cx - 17, Y - 1, 34, 6).paint(NEAR.brass);
    const sp = Math.floor((o.phase || 0) / 3);
    for (let k = 0; k < 6; k++) pn.fill(cx - 16 + ((k * 6 + sp) % 32 + 32) % 32, Y + 1, 1, 3, P.brass[0]);
    pn.poly([[cx - 20, Y + 5], [cx + 20, Y + 5], [cx + 13, Y + 31], [cx - 13, Y + 31]]).paint(R);
    pn.poly([[cx - 9, Y + 30], [cx + 9, Y + 30], [cx + 5, Y + 36], [cx - 5, Y + 36]]).paint(NEAR.dark);
    rivet(pn, cx - 18, Y + 7); rivet(pn, cx + 15, Y + 7);
    const gy = Y + 18, tilt = (o.wob == null ? 0.04 : o.wob) * Math.sin((o.t || 0) * 9) + (o.tilt || 0);
    pn.disc(cx, gy, 8.5).paint(NEAR.dark, { bevel: 's' });
    ellipse(pn, cx, gy, 7, 7, tilt, P.brass[1], P.brass[1]);
    const spin = (o.t || 0) * 7, rx = 0.8 + 5.5 * Math.abs(Math.cos(spin));
    ellipse(pn, cx, gy, rx, 5.5, tilt, P.brass[3], P.brass[1]);
    ellipse(pn, cx, gy, Math.max(0.5, rx - 1), 5.5, tilt, P.brass[2], P.brass[0]);
    pn.ln(cx - Math.sin(tilt) * -7, gy - Math.cos(tilt) * 7, cx + Math.sin(tilt) * -7, gy + Math.cos(tilt) * 7, P.brass[2]);
    pn.disc(cx, gy, 1.6).paint(mat === 'fire' ? NEAR.fire : NEAR.brass, { outline: false });
  }

  // 真双足 · 2×4（48×96）：上两行是胯，下两行是一对长腿。腿型沿用 DESIGNS 的六档，以胯为支点放大到地面（胯关节到地面 67px，约 2 倍），
  // 仍是原生像素；步幅按放大倍数折算，脚踩实地不打滑。远侧腿压暗、往右 8px 上 3px，画在躯干后面。
  // o：{ mv, a, stride（步幅，世界像素）, bd（起伏，见 bipedBob）, g: [近侧脚, 远侧脚], legs: DESIGNS 的 id, wL, wR, phase, t, tilt, wob }
  // 接地点（模块内 x，静止时）：近侧 26、远侧 34
  const BIPED_HIP = 29;
  function bipedArt(pn, x, y, o, part) {
    const e = DESIGNS.find(d => d.id === o.legs && !d.d.game) || DESIGNS.find(d => d.id === 'mk2'), D = e.d;
    const cx = x + 24, bd = o.bd || 0, ground = y + 96, g = o.g || [0, 0];
    const k = (96 - BIPED_HIP) / (47 - (D.hipY || 14));
    const S = o.stride || 15, lo = { ...o, plant: true, plantS: S / k, plantH: (4 + 0.3 * S) / k };
    const leg = (far) => {
      const L = legAt(D, far, cx - 24, y, lo, far ? cx + 6 : cx - 2);
      L.hy = y + BIPED_HIP + bd - (far ? 3 : 0);
      L.gy = L.hy + (ground - (far ? 3 : 0) + (far ? g[1] : g[0]) - L.hy) / k;
      drawLeg(pn, D, L, lo, k);
    };
    if (part !== 'near') leg(true);
    if (part === 'far') return;
    pelvis(pn, cx, y + bd, { legId: e.id, wL: o.wL, wR: o.wR, phase: o.phase, t: o.t, tilt: o.tilt, wob: o.wob });
    if (D.mid) { const top = y + bd + 30, back = pn.around(k * 0.8, cx + 2, top); D.mid(pn, { M: NEAR, x: cx - 21.5, y: top - 12 }, lo); back(); }
    leg(false);
  }

  // 真双足的躯干切角：画好的车体上，把露在外面的角切成斜角，箱子堆读起来像一副躯干（收腰、切肩）。
  // 腰挂和再往上两行（第 ROWS-6 ~ ROWS-3 行）的模块：底下和外侧都空着的底角切 12px（腰挂）/ 9px；所有模块顶上和外侧都空着的顶角切 6px。
  // g = 车体画布（SA.SPR.renderVehicle 的坐标：x = PADX + c × 24，y = r × 24），v = 载具，pc = 胯的列（胯那 2×2 格当作占着）
  function torsoCuts(g, v, pc, padx) {
    const K = SA.K, S = K.CELL, O = SA.V.occ(v, 'body');
    const has = (r, c) => r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS && (!!O[r][c] || (c >= pc && c <= pc + 1 && r >= K.ROWS - 4 && r <= K.ROWS - 3));
    const cut = (x, y, side, n, top) => {
      for (let i = 0; i < n; i++) {
        const w = n - i, yy = top ? y + i : y - 1 - i;
        if (side < 0) { g.clearRect(x, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x + w, yy, 1, 1); }
        else { g.clearRect(x - w, yy, w, 1); g.fillStyle = P.iron[0]; g.fillRect(x - w - 1, yy, 1, 1); }
      }
    };
    SA.V.each(v, (cell, r, c, layer) => {
      if (layer !== 'body' || SA.isRam(cell.id)) return;
      const f = SA.fp(cell.id), b = r + f.h - 1, x0 = padx + c * S, x1 = padx + (c + f.w) * S;
      if (b >= K.ROWS - 6 && b <= K.ROWS - 3) {
        const n = b === K.ROWS - 3 ? 12 : 9;
        if (!has(b + 1, c) && !has(b, c - 1)) cut(x0, (b + 1) * S, -1, n);
        if (!has(b + 1, c + f.w - 1) && !has(b, c + f.w)) cut(x1, (b + 1) * S, 1, n);
      }
      if (!has(r - 1, c) && !has(r, c - 1) && !has(r - 1, c - 1)) cut(x0, r * S, -1, 6, true);
      if (!has(r - 1, c + f.w - 1) && !has(r, c + f.w) && !has(r - 1, c + f.w)) cut(x1, r * S, 1, 6, true);
    });
  }

  return { Pen, DESIGNS, drawCell, drawLeg, legAt, cellOpts, groundY, spiderLeg, carapace, SPIDERS, QUADS, quadArt, pelvis, bipedArt, torsoCuts, strideFor, quadStride, quadBob, bipedBob, U: { NEAR, FAR, gait, plantGait, ik, bone, frame, gear, rivet, flat } };
})();
