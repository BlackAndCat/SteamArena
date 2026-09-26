// 小炮（cannon_s，1×1 = 24px）造型探索 + 材质语法（tools/cannon-s-lab.html 专用，只做视觉，不改游戏）。
// 材质语法：每种材料不只换颜色，而是提供一套自己的「零件画法」——面板、炮管截面、箍、炮口、耳轴、紧固件。
// 模块只画骨架（占格、耳轴、炮口点不变），调用这些零件；换材料 = 换零件画法，剪影类别不变，材料特色在 2px 以内的边缘和表面上。
window.SA = window.SA || {};

SA.CSLAB = (() => {
  const P = SA.PAL;
  let g = null, F = 0;   // 当前画布、动画帧（8 fps）
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const px = (x, y, c) => R(x, y, 1, 1, c);
  const clr = (x, y, w = 1, h = 1) => g.clearRect(x, y, w, h);
  const disc = (cx, cy, r, c) => {
    g.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++)
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) g.fillRect(xx, yy, 1, 1);
      }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2);
    g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  const hash = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
  const box = (x, y, w, h, r) => { R(x, y, w, h, r[0]); R(x + 1, y + 1, w - 2, h - 2, r[2]); R(x + 1, y + h - 2, w - 2, 1, r[1]); R(x + w - 2, y + 1, 1, h - 2, r[1]); R(x + 1, y + 1, w - 2, 1, r[3]); R(x + 1, y + 1, 1, h - 2, r[3]); };
  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]];
  const DARK = [P.dark[0], P.dark[1], P.dark[2], P.dark[3]];

  // ---------- 材料：色阶 r = [描边, 暗面, 固有色, 亮面, 镜面] + 工艺说明 ----------
  const GLOW = ['#1f958c', '#2fd6c4', '#8ffbee', '#2fd6c4'];   // 以太的发光脉动，4 档循环
  const MATS = [
    { key: 'orig', mt: 1, name: '现状原画', craft: '冷铁 + 黄铜箍（游戏里 T1 的画法）', r: [P.iron[0], P.iron[1], P.iron[2], P.iron[3], P.iron[4]] },
    { key: 'brass', mt: 1, name: '黄铜', craft: '铸造', r: ['#4e3510', '#8a5f18', '#c08a2e', '#e6b653', '#f8e3a0'] },
    { key: 'iron', mt: 2, name: '熟铁', craft: '锻打箍套', r: ['#16171b', '#2c2e34', '#474950', '#63656c', '#7d7f86'] },
    { key: 'steel', mt: 3, name: '钢', craft: '机加工', r: ['#111926', '#283b54', '#43628a', '#6f95c0', '#d2e4f8'] },
    { key: 'nickel', mt: 4, name: '镀镍', craft: '电镀抛光', r: ['#262b33', '#56606c', '#98a2ae', '#d0d7df', '#ffffff'] },
    { key: 'wootz', mt: 5, name: '乌兹钢', craft: '折叠锻纹', r: ['#1a1024', '#33224c', '#523b74', '#7c5fa8', '#b89ce4'] },
    { key: 'aether', mt: 6, name: '以太合金', craft: '悬浮晶构', r: ['#061c1c', '#0d3a38', '#155f5a', '#1f958c', '#6ff0df'] },
  ];
  const glow = (k = 0) => GLOW[(Math.floor(F / 2) + k) % 4];
  const watered = (i, j) => Math.sin(i * 0.9 + 2.2 * Math.sin(j * 0.7 + i * 0.15));

  // 面板：带描边的方块；边角处理、光泽、纹理按材料走
  function corners(x, y, w, h, n, col) {
    for (let k = 0; k < n; k++) {
      const c = n - k;
      clr(x, y + k, c); clr(x + w - c, y + k, c); clr(x, y + h - 1 - k, c); clr(x + w - c, y + h - 1 - k, c);
      px(x + c, y + k, col); px(x + w - 1 - c, y + k, col); px(x + c, y + h - 1 - k, col); px(x + w - 1 - c, y + h - 1 - k, col);
    }
  }
  function plate(M, x, y, w, h) {
    const r = M.r;
    box(x, y, w, h, r);
    switch (M.key) {
      case 'brass':   // 铸件：1px 圆角 + 宽柔的暖色高光
        corners(x, y, w, h, 1, r[0]);
        R(x + 2, y + 2, Math.max(1, Math.floor(w * 0.45)), 1, r[4]);
        if (h > 7) R(x + 2, y + 2, 1, Math.floor(h * 0.35), r[4]);
        break;
      case 'iron':    // 锻打：高光断断续续、面上锻打斑点、几乎不反光
        for (let i = x + 1; i < x + w - 1; i++) if (hash(i, y) % 3 === 0) px(i, y + 1, r[2]);
        for (let i = x + 2; i < x + w - 2; i++) for (let j = y + 2; j < y + h - 2; j++) {
          const q = hash(i, j) % 9;
          if (q === 0) px(i, j, r[1]); else if (q === 4) px(i, j, r[3]);
        }
        break;
      case 'steel':   // 机加工：2px 倒角 + 冷色锐利高光 + 角上一点镜面
        corners(x, y, w, h, 2, r[0]);
        R(x + 3, y + 1, w - 6, 1, r[4]); px(x + 2, y + 2, r[4]);
        break;
      case 'nickel':  // 镜面：亮带 → 暗反射带 → 亮带，黄铜细边
        corners(x, y, w, h, 1, r[0]);
        R(x + 2, y + 1, w - 4, 1, r[4]);
        if (h > 6) { const b = y + Math.round(h * 0.45); R(x + 2, b, w - 4, 1, r[1]); R(x + 2, b + 1, w - 4, 1, r[3]); }
        if (h > 8) R(x + 2, y + h - 3, w - 4, 1, P.brass[2]);
        break;
      case 'wootz':   // 刃形：右上大切角 + 流水花纹
        corners(x, y, w, h, 1, r[0]);
        for (let k = 0; k < 3; k++) { clr(x + w - 3 + k, y + k, 3 - k); px(x + w - 4 + k, y + k, r[0]); }
        for (let i = x + 2; i < x + w - 2; i++) for (let j = y + 2; j < y + h - 2; j++) {
          const v = watered(i, j);
          if (v > 0.78) px(i, j, r[3]); else if (v < -0.85) px(i, j, r[1]);
        }
        break;
      case 'aether':  // 暗芯 + 发光导流纹（四角断开，像电路）
        R(x + 2, y + 2, w - 4, h - 4, r[1]);
        if (w >= 8 && h >= 8) {
          const c = glow();
          R(x + 3, y + 2, w - 6, 1, c); R(x + 3, y + h - 3, w - 6, 1, c);
          R(x + 2, y + 3, 1, h - 6, c); R(x + w - 3, y + 3, 1, h - 6, c);
        }
        break;
    }
  }

  // 炮管的一列：u = 从炮尾数起的第几列（给纹样和箍套用）
  function tcol(M, i, y, h, u) {
    const r = M.r;
    if (M.key === 'iron' && h >= 5 && Math.floor(u / 6) % 2 === 0) { y -= 1; h += 2; }   // 一节节箍套：隔一节鼓出 1px
    R(i, y, 1, h, r[0]);
    for (let j = y + 1; j < y + h - 1; j++) {
      const k = j - y, last = k === h - 2;
      let c = k === 1 ? r[3] : last ? r[1] : r[2];
      switch (M.key) {
        case 'orig': c = k === 1 ? r[4] : last ? r[2] : r[3]; break;
        case 'brass': if (k === 1) c = u % 9 < 6 ? r[4] : r[3]; else if (k === 2 && h >= 6) c = r[3]; break;
        case 'iron': if (u % 6 === 5) c = r[1]; else if (k === 1) c = hash(i, j) % 4 ? r[3] : r[2]; else if (hash(i, j) % 11 === 0) c = r[1]; break;
        case 'steel': if (k === 1) c = r[4]; else if (k === 2 && h >= 6) c = r[3]; break;
        case 'nickel': { const mid = Math.floor((h - 1) / 2); c = k === 1 ? r[4] : k === mid && h >= 5 ? r[1] : last ? r[2] : k < mid ? r[3] : r[3]; break; }
        case 'wootz': { const v = watered(u, j); if (!last && k > 1) c = v > 0.7 ? r[3] : v < -0.8 ? r[1] : r[2]; break; }
        case 'aether': c = k === Math.floor((h - 1) / 2) ? glow(u % 2) : k === 1 ? r[3] : r[1]; break;
      }
      px(i, j, c);
    }
  }
  const tube = (M, x0, y, len, h) => { for (let u = 0; u < len; u++) tcol(M, x0 + u, y, h, u); };

  // 箍：横跨炮管 y..y+h-1
  function hoop(M, x, y, h) {
    const r = M.r;
    switch (M.key) {
      case 'orig': R(x, y - 1, 2, h + 2, P.brass[1]); R(x, y - 1, 1, h + 2, P.brass[3]); break;
      case 'brass': R(x, y - 1, 2, h + 2, r[0]); R(x, y, 1, h, r[4]); R(x + 1, y, 1, h, r[2]); break;   // 铸造加强环
      case 'iron': R(x, y - 2, 3, h + 4, r[0]); R(x, y - 1, 3, h + 2, r[1]); R(x, y - 1, 1, h + 2, r[3]); px(x + 1, y + (h >> 1), r[3]); break;   // 厚铁箍 + 铆钉
      case 'steel': R(x, y - 1, 2, h + 2, r[0]); R(x, y, 1, h, r[4]); break;   // 细车削环
      case 'nickel': R(x, y - 1, 2, h + 2, P.brass[0]); R(x, y, 2, h, P.brass[2]); R(x, y, 1, h, P.brass[3]); break;   // 黄铜镶嵌
      case 'wootz':   // 皮革缠绳
        R(x - 1, y - 1, 5, h + 2, P.leather[0]);
        for (let j = y; j < y + h; j++) for (let i = 0; i < 3; i++) px(x + i, j, (i + j) % 3 === 0 ? P.leather[2] : P.leather[1]);
        break;
      case 'aether': {   // 悬浮环：和炮管隔 1px，上下浮动
        const b = F % 8 < 4 ? 0 : 1, c = glow(1);
        R(x, y - 3 + b, 2, 1, c); R(x, y + h + 1 + b, 2, 1, c); px(x, y - 3 + b, r[4]); px(x, y + h + 1 + b, r[4]);
        R(x, y + 1, 1, h - 2, c);
        break;
      }
    }
  }

  // 炮口：xe = 炮口末端（不含），炮管 y..y+h-1
  function muzzle(M, xe, y, h) {
    const r = M.r, bore = P.black;
    switch (M.key) {
      case 'orig':
        R(xe - 5, y - 1, 5, h + 2, r[0]); R(xe - 4, y, 3, h, r[3]); R(xe - 4, y, 3, 1, r[4]);
        for (let j = y + 1; j < y + h - 1; j += 2) R(xe - 3, j, 2, 1, P.dark[0]);
        break;
      case 'brass':   // 喇叭口
        R(xe - 3, y - 1, 3, h + 2, r[0]); R(xe - 1, y - 2, 1, h + 4, r[0]);
        R(xe - 3, y, 2, h, r[3]); R(xe - 3, y, 2, 1, r[4]); R(xe - 1, y - 1, 1, 1, r[4]);
        R(xe - 1, y + 1, 1, h - 2, bore);
        break;
      case 'iron':    // 加厚箍口
        R(xe - 4, y - 2, 4, h + 4, r[0]); R(xe - 4, y - 1, 3, h + 2, r[2]); R(xe - 4, y - 1, 3, 1, r[3]);
        R(xe - 3, y - 1, 1, h + 2, r[1]); px(xe - 2, y, r[3]);
        R(xe - 1, y, 1, h, bore);
        break;
      case 'steel':   // 开槽制退器
        R(xe - 5, y - 2, 5, h + 4, r[0]); R(xe - 4, y - 1, 3, h + 2, r[2]); R(xe - 4, y - 1, 3, 1, r[4]);
        R(xe - 4, y + 1, 1, h - 2, r[0]); R(xe - 2, y + 1, 1, h - 2, r[0]);
        break;
      case 'nickel':  // 黄铜冠圈 + 抛光外沿
        R(xe - 4, y - 1, 2, h + 2, P.brass[0]); R(xe - 4, y, 2, h, P.brass[3]);
        R(xe - 2, y - 2, 2, h + 4, r[0]); R(xe - 2, y - 1, 1, h + 2, r[4]);
        R(xe - 1, y, 1, h, bore);
        break;
      case 'wootz': { // 斜切刃口：上沿比下沿长
        for (let j = 0; j < h; j++) {
          const cut = Math.round(j * 3 / Math.max(1, h - 1));
          if (cut) clr(xe - cut, y + j, cut);
          px(xe - cut - 1, y + j, j === 0 ? r[4] : r[0]);
        }
        px(xe - 6, y + 1, P.brass[3]);
        break;
      }
      case 'aether': { // 三爪晶体炮口
        clr(xe - 3, y, 3, h);
        R(xe - 3, y, 1, h, r[0]);
        const c = glow(2);
        line(xe - 3, y, xe - 1, y - 2, 1, r[3]); px(xe - 1, y - 2, c);
        line(xe - 3, y + h - 1, xe - 1, y + h + 1, 1, r[3]); px(xe - 1, y + h + 1, c);
        px(xe - 2, y + (h >> 1), c); px(xe - 1, y + (h >> 1), GLOW[2]);
        break;
      }
    }
  }

  // 耳轴 / 球座 / 尾钮
  function boss(M, cx, cy, rad) {
    const r = M.r;
    disc(cx, cy, rad, r[0]); disc(cx, cy, rad - 1, r[2]);
    switch (M.key) {
      case 'orig': disc(cx, cy, rad, P.brass[0]); disc(cx, cy, rad - 1, P.brass[2]); px(Math.round(cx - rad / 2), Math.round(cy - rad / 2), P.brass[3]); break;
      case 'brass': disc(cx - 0.6, cy - 0.6, rad - 2, r[3]); px(Math.round(cx - rad / 2), Math.round(cy - rad / 2), r[4]); break;
      case 'iron': R(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, r[3]); px(Math.round(cx), Math.round(cy), r[0]); break;
      case 'steel': R(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3, r[1]); px(Math.round(cx) - 1, Math.round(cy) - 1, r[4]); break;
      case 'nickel': disc(cx, cy - 0.8, rad - 1.6, r[4]); disc(cx, cy + 0.2, rad - 2.4, r[1]); px(Math.round(cx), Math.round(cy), P.brass[3]); break;
      case 'wootz': disc(cx - 0.5, cy - 0.5, rad - 2, r[3]); px(Math.round(cx), Math.round(cy), P.brass[3]); break;
      case 'aether': disc(cx, cy, rad - 1, glow()); disc(cx, cy, rad - 2, r[1]); px(Math.round(cx), Math.round(cy), GLOW[2]); break;
    }
  }

  // 紧固件（2×2 左右）
  function fastener(M, x, y) {
    const r = M.r;
    switch (M.key) {
      case 'orig': R(x, y, 2, 2, P.iron[4]); px(x + 1, y + 1, P.iron[2]); px(x + 2, y + 1, P.iron[0]); px(x + 1, y + 2, P.iron[0]); break;
      case 'brass': px(x, y, r[3]); px(x + 1, y + 1, r[1]); break;                     // 铸件一体：只有小凸点
      case 'iron': R(x, y, 2, 2, r[3]); px(x + 1, y + 1, r[2]); px(x + 2, y + 1, r[0]); px(x + 1, y + 2, r[0]); break;   // 大圆铆钉
      case 'steel': R(x, y, 2, 2, r[1]); px(x, y, r[4]); px(x + 1, y + 1, r[0]); break;  // 六角螺栓
      case 'nickel': px(x, y, P.brass[3]); px(x + 1, y, P.brass[1]); px(x, y + 1, P.brass[1]); break;   // 黄铜花饰
      case 'wootz': px(x, y, P.brass[3]); px(x + 1, y + 1, P.brass[0]); break;         // 金销钉
      case 'aether': px(x, y, glow(3)); px(x + 1, y, r[3]); px(x, y + 1, r[3]); break;   // 发光节点
    }
  }

  // ---------- 骨架（不随材料变）：耳轴 (12,13)、炮口在耳轴前 24px（= 伸出格子 12px）、后坐 4px ----------
  const PIV = [12, 13], BLEN = 24, RC = 4;
  const layer = document.createElement('canvas'); layer.width = 72; layer.height = 48;
  function turn(pxX, pxY, a, fn) {
    const main = g, lg = layer.getContext('2d');
    lg.clearRect(0, 0, 72, 48);
    g = lg; fn(32, 24); g = main;
    main.save(); main.imageSmoothingEnabled = false;
    main.translate(pxX, pxY); main.rotate(-(a || 0) * Math.PI / 180);
    main.drawImage(layer, -32, -24);
    main.restore();
  }
  const flash = (x, y, h, k) => { if (k >= 0.85) { R(x, y + 1, 3, h - 2, P.fire[3]); R(x + 3, y + (h >> 1) - 1, 2, 2, P.fire[2]); } };
  const foot = (x, y) => box(x + 1, y + 20, 22, 4, IRON);   // 中性铁脚：接进车体框架，不跟材料走

  const DIRS = [
    {
      id: 'A', name: '小炮塔', idea: '中炮家族缩小：方炮塔 + 小观察塔 + 单管。',
      pro: '和中炮、直射火炮一脉相承，最稳妥。', con: '24px 里像缩小的中炮，炮塔大面积容易读成甲片。',
      draw(M, x, y, o) {
        foot(x, y);
        plate(M, x + 2, y + 8, 19, 13);
        plate(M, x + 5, y + 4, 9, 5);
        R(x + 4, y + 12, 5, 1, P.dark[0]);
        fastener(M, x + 4, y + 16); fastener(M, x + 16, y + 17);
        const d = Math.round(o.k * RC);
        turn(x + PIV[0], y + PIV[1], o.a, (X, Y) => {
          tube(M, X + 1 - d, Y - 2, 23, 5); hoop(M, X + 8 - d, Y - 2, 5); muzzle(M, X + BLEN - d, Y - 2, 5); flash(X + BLEN - d, Y - 2, 5, o.k);
        });
        boss(M, x + PIV[0], y + PIV[1], 3.5);
      },
    },
    {
      id: 'B', name: '舰炮座', idea: '立柱炮座 + 罩式防盾（顶板 + 前板），炮下面是镂空的。',
      pro: '剪影带「负空间」，一眼和满格模块分开；防盾是展示材质的面。', con: '底下镂空，放在车体里像没装满；防盾和改装的「炮盾」挂件会重叠。',
      draw(M, x, y, o) {
        box(x + 3, y + 20, 18, 4, IRON);
        box(x + 9, y + 14, 7, 7, DARK); R(x + 7, y + 14, 11, 2, P.dark[3]); R(x + 7, y + 14, 11, 1, P.iron[3]);
        plate(M, x + 9, y + 4, 12, 4);    // 防盾顶板：往后罩住炮身
        plate(M, x + 16, y + 4, 7, 15);   // 防盾前板：炮管从中间穿出
        fastener(M, x + 11, y + 5); fastener(M, x + 18, y + 16);
        const d = Math.round(o.k * RC);
        turn(x + PIV[0], y + PIV[1], o.a, (X, Y) => {
          tube(M, X - 6 - d, Y - 2, BLEN + 6, 5); hoop(M, X + 12 - d, Y - 2, 5); muzzle(M, X + BLEN - d, Y - 2, 5); flash(X + BLEN - d, Y - 2, 5, o.k);
        });
        boss(M, x + PIV[0], y + PIV[1], 3);
      },
    },
    {
      id: 'C', name: '卡隆短炮', idea: '粗短炮身 + 尾钮 + 滑架：最经典的「炮」图标。',
      pro: '1× 也认得出是炮；大面积炮身正好是材质的展示面，材质语法效果最好。', con: '古董炮味道重，离一战铁甲稍远；仰角大时尾部下沉要留空。',
      draw(M, x, y, o) {
        box(x + 1, y + 19, 22, 5, DARK); R(x + 2, y + 19, 20, 1, P.iron[3]);
        disc(x + 5, y + 22, 2, P.dark[0]); disc(x + 19, y + 22, 2, P.dark[0]); px(x + 5, y + 22, P.iron[3]); px(x + 19, y + 22, P.iron[3]);
        box(x + 9, y + 15, 7, 5, DARK);
        const d = Math.round(o.k * RC);
        turn(x + PIV[0], y + PIV[1], o.a, (X, Y) => {
          boss(M, X - 11 - d, Y, 2.5);
          tube(M, X - 10 - d, Y - 5, 12, 11);   // 粗短药室
          for (let i = 0; i < 3; i++) tcol(M, X + 2 + i - d, Y - 4 + (i >> 1), 9 - (i >> 1) * 2, 12 + i);   // 收口
          tube(M, X + 5 - d, Y - 3, BLEN - 5, 7);
          hoop(M, X - 6 - d, Y - 5, 11);
          muzzle(M, X + BLEN - d, Y - 4, 9); flash(X + BLEN - d, Y - 3, 7, o.k);
        });
      },
    },
    {
      id: 'D', name: '炮窗', idea: '满格装甲面 + 球形炮座，炮管从炮窗里伸出来。',
      pro: '嵌进车体最自然，正好是「把缝隙变成第二个射击位」。', con: '除了炮管就是一块甲片，材质表现和装甲重复；炮管被打掉后和甲片分不开。',
      draw(M, x, y, o) {
        plate(M, x + 1, y + 1, 22, 22);
        for (const [a, b] of [[3, 3], [18, 3], [3, 18], [18, 18]]) fastener(M, x + a, y + b);
        disc(x + PIV[0], y + PIV[1], 6.5, P.dark[0]);
        const d = Math.round(o.k * RC);
        turn(x + PIV[0], y + PIV[1], o.a, (X, Y) => {
          tube(M, X + 2 - d, Y - 2, BLEN - 2, 5); hoop(M, X + 10 - d, Y - 2, 5); muzzle(M, X + BLEN - d, Y - 2, 5); flash(X + BLEN - d, Y - 2, 5, o.k);
        });
        boss(M, x + PIV[0], y + PIV[1], 5);
      },
    },
    {
      id: 'E', name: '喇叭口', idea: '转轴叉架 + 细长管 + 喇叭口 + 后握把：维多利亚船头炮。',
      pro: '维多利亚味最浓，剪影独一无二。', con: '喇叭口容易读成霰弹 / 喷射类，和以后的喷火器、蒸汽喷射器语义打架。',
      draw(M, x, y, o) {
        box(x + 5, y + 20, 15, 4, IRON);
        box(x + 10, y + 15, 5, 6, DARK);
        plate(M, x + 8, y + 14, 9, 3);
        R(x + 9, y + 11, 1, 4, M.r[0]); R(x + 15, y + 11, 1, 4, M.r[0]);
        const d = Math.round(o.k * RC);
        turn(x + PIV[0], y + PIV[1], o.a, (X, Y) => {
          line(X - 8 - d, Y + 1, X - 11 - d, Y + 6, 2, P.leather[0]); line(X - 8 - d, Y + 1, X - 11 - d, Y + 6, 1, P.leather[2]);
          boss(M, X - 9 - d, Y, 2);
          tube(M, X - 8 - d, Y - 2, 25, 5);
          hoop(M, X + 1 - d, Y - 2, 5);
          for (let i = 0; i < 7; i++) {   // 喇叭：越往前越宽
            const hh = Math.round(2.5 + i * 0.75), col = X + 17 + i - d;
            tcol(M, col, Y - hh, hh * 2 + 1, 25 + i);
          }
          R(X + 23 - d, Y - 5, 1, 11, P.black);
          flash(X + BLEN - d, Y - 3, 7, o.k);
        });
        boss(M, x + PIV[0], y + PIV[1], 2);
      },
    },
  ];

  // 甲片（1×1）套同一套材质语法：证明语法不是只为小炮写的
  function plateModule(M, x, y) {
    plate(M, x + 2, y + 2, 20, 20);
    R(x + 3, y + 11, 18, 1, M.r[1]); R(x + 3, y + 12, 18, 1, M.r[3]);
    for (const [a, b] of [[4, 4], [17, 4], [4, 16], [17, 16]]) fastener(M, x + a, y + b);
  }

  // 镀镍的闪光：隔一阵子一道斜向亮线扫过亮像素
  function glint(cv) {
    const ph = F % 24;
    if (ph > 9) return;
    const c = cv.getContext('2d'), img = c.getImageData(0, 0, cv.width, cv.height), d = img.data, p = ph * 6 - 8;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const s = x + y - p;
      if (s < 0 || s > 1) continue;
      const i = (y * cv.width + x) * 4;
      if (d[i + 3] < 8 || 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] < 110) continue;
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
    c.putImageData(img, 0, 0);
  }

  // ---------- 对外：画一张精灵 ----------
  const PAD = { l: 6, t: 8, r: 20, b: 2 };
  const SW = PAD.l + 24 + PAD.r, SH = PAD.t + 24 + PAD.b;
  function sprite(dir, M, o = {}) {
    const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
    const prev = g; g = cv.getContext('2d');
    dir.draw(M, PAD.l, PAD.t, { a: o.a || 0, k: o.k || 0 });
    g = prev;
    if (M.key === 'orig' && o.decorate > 1) SA.SPR.decorate(cv, SA.MATS[o.decorate], PAD.l, PAD.t);
    if (M.key === 'nickel' && o.anim) glint(cv);
    return cv;
  }
  function plateSprite(M, o = {}) {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
    const prev = g; g = cv.getContext('2d');
    if (M.key === 'orig') SA.SPR.drawModule(g, 'plate', 0, 0, { mt: o.decorate || 1 }); else plateModule(M, 0, 0);
    g = prev;
    if (M.key === 'nickel' && o.anim) glint(cv);
    return cv;
  }
  return { MATS, DIRS, PAD, SW, SH, PIV, BLEN, sprite, plateSprite, setFrame: (f) => { F = f; } };
})();
