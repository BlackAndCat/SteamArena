// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：履带底盘 · 六档视觉探索（2026-09-29）。用户：「开发不同档位的履带视觉探索，依旧要参考现实历史设计；
// 也允许没有履带的早期版本，但不能是纯粹的轮子」。六档 = 六种材料，每一档取一个真实的历史节点：
//   T1 铰接脚板轮   1846 博伊德尔「无极铁路」（Boydell）：大轮的轮缘上挂着一圈铰接铁脚板，脚板逐块放平压在地上——还没有履带，但不是光轮
//   T2 木板链带     1901 隆巴德原木牵引车 / 1904 霍恩斯比：木板条链带绕驱动轮和诱导轮，铁包头，中间几只小托轮
//   T3 铁链节履带   1908 霍尔特：铁链节 + 抓地齿，铆接铁板侧框（竖肋），成对负重轮
//   T4 减重孔钢框   1917 Mark IV / 雷诺 FT：冲孔减重的钢侧框，钢盘负重轮，链节中间凸起的导向齿，辐条诱导轮
//   T5 桁架转向架   1918 维克斯 / 霍尔特 75：桁架斜撑侧框，板簧转向架，黄铜轮毂的辐条链轮
//   T6 全包裙板     一战末期到 1920s 的重型履带：铆接整块裙板盖住上段和侧框，只露出下面一排负重轮，黄铜饰边 + 百叶散热口
// 一节（48px 宽）= 游戏里履带模块的一格；页面里画 3 节长的一条，左端是驱动轮（链轮），右端是诱导轮。
// 画法：链带按「体育场形」路径（左右半圆 + 上下直线）等距摆链节，行驶相位 ph 0～23 平移一个链节，24 帧无缝循环。
// o = { ph 行驶相位, n 节数 }
window.SA = window.SA || {};

SA.CUR = (() => {
  const { P, R, px, disc, line, box, IRON, IRONL, BRASS } = SA.CAND;
  const WOOD = [P.leather[0], P.leather[1], P.leather[2], P.leather[3]];
  const RUSTR = [P.rust[0], P.rust[1], P.rust[2], P.rust[3]];
  const TAU = Math.PI * 2, r0 = Math.round;

  // ---------- 通用零件 ----------
  // 沿方向 a 画一条短线（链节 / 脚板 / 木板条）：中心 (cx, cy)，长 len，粗 w
  function seg(cx, cy, a, len, w, col) {
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
    line(r0(cx - dx), r0(cy - dy), r0(cx + dx), r0(cy + dy), w, col);
  }
  // 体育场形链带：左右半圆（半径 r，圆心 cxL / cxR，高 cy）+ 上下直线，按 len 等距摆链节，ph 平移。fn(x, y, 切线角, 序号, 位置: 'top' | 'bot' | 'end')
  function loop(cxL, cxR, cy, r, len, ph, fn) {
    const fl = cxR - cxL, P2 = 2 * fl + 2 * Math.PI * r;
    const n = Math.round(P2 / len), step = P2 / n;
    for (let i = 0; i < n; i++) {
      const s = (i * step + ph * step / 24) % P2;
      let x, y, a, where = 'end';
      if (s < fl) { x = cxL + s; y = cy - r; a = 0; where = 'top'; }
      else if (s < fl + Math.PI * r) { const t = (s - fl) / r, b = -Math.PI / 2 + t; x = cxR + r * Math.cos(b); y = cy + r * Math.sin(b); a = b + Math.PI / 2; }
      else if (s < 2 * fl + Math.PI * r) { x = cxR - (s - fl - Math.PI * r); y = cy + r; a = Math.PI; where = 'bot'; }
      else { const t = (s - 2 * fl - Math.PI * r) / r, b = Math.PI / 2 + t; x = cxL + r * Math.cos(b); y = cy + r * Math.sin(b); a = b + Math.PI / 2; }
      fn(x, y, a, i, where);
    }
  }
  // 辐条轮：ang 转角，n 根辐条，rim 轮缘色阶 / spoke 辐条色 / hub 轮毂色
  function spoked(cx, cy, r, ang, n, o = {}) {
    const rim = o.rim || P.iron, sp = o.spoke || P.iron[3], hub = o.hub || P.iron[3];
    disc(cx, cy, r, P.dark[0]); disc(cx, cy, r - 1, rim[2]); disc(cx - 0.5, cy - 0.5, r - 1.6, rim[3] || rim[2]);
    disc(cx, cy, r - 2.2, o.hole || P.dark[1]);
    for (let i = 0; i < n; i++) { const a = ang + i * TAU / n; line(r0(cx), r0(cy), r0(cx + Math.cos(a) * (r - 2)), r0(cy + Math.sin(a) * (r - 2)), o.sw || 1, sp); }
    disc(cx, cy, Math.max(1.4, r * 0.28), hub); px(r0(cx - 1), r0(cy - 1), P.iron[4]);
  }
  // 链轮齿：驱动轮外缘一圈小方齿（链节咬在齿间）
  function teeth(cx, cy, r, ang, n, col) {
    for (let i = 0; i < n; i++) { const a = ang + i * TAU / n; R(r0(cx + Math.cos(a) * r) - 1, r0(cy + Math.sin(a) * r) - 1, 2, 2, col); }
  }
  const bolt = (x, y) => { px(x, y, P.iron[4]); px(x + 1, y + 1, P.iron[0]); };
  // 板条 / 铆接板：带高光下沿的矩形
  const plate = (x, y, w, h, ramp) => { R(x, y, w, h, ramp[0]); R(x + 1, y + 1, w - 2, h - 2, ramp[2]); R(x + 1, y + 1, w - 2, 1, ramp[3]); if (h > 3) R(x + 1, y + h - 2, w - 2, 1, ramp[1]); };
  // 铁链节：黑描边 + 交替明暗的板面 + 外侧一条高光 + 黄铜链销；cleat = 外侧抓地齿的形状（'tooth' 单齿 / 'bar' 横条 / 'guide' 内侧导向齿）
  function chainLink(X, Y, a, i, w, o = {}) {
    const nx = -Math.sin(a), ny = Math.cos(a);
    seg(X, Y, a, 5.8, 3, P.iron[0]);
    seg(X, Y, a, 4.6, 2, i % 2 ? P.iron[3] : P.iron[2]);
    px(r0(X - nx * 1.2 - 0.5), r0(Y - ny * 1.2 - 0.5), P.iron[4]);
    if (w !== 'end') px(r0(X - Math.cos(a) * 2.6 - 0.5), r0(Y - Math.sin(a) * 2.6 - 0.5), o.pin || P.brass[2]);
    if (i % 2 === 0) {
      if (o.bar) { seg(X - nx * 2.6, Y - ny * 2.6, a + Math.PI / 2, 2, 1, P.iron[0]); seg(X - nx * 3.6, Y - ny * 3.6, a, 3, 1, P.iron[4]); }
      else R(r0(X - nx * 3 - 0.5), r0(Y - ny * 3 - 0.5), 1, 1, P.iron[4]);
    }
    if (o.guide && i % 2 === 1) R(r0(X + nx * 2.6 - 1), r0(Y + ny * 2.6 - 1), 2, 2, P.iron[4]);
  }
  const GROUND = 46;   // 履带接地线（一节 48px 高，链带底面在 y+45）

  // ---------- 六档 ----------
  // 每档：draw(x, y, W, ph) 在 (x, y) 起、宽 W = 48 × 节数 的范围内作画。返回不用
  const TIERS = [];

  // T1 铰接脚板轮（博伊德尔 1846）：一排大木辐轮，轮缘上挂一圈铰接铁脚板（每块脚板用黄铜销挂在轮缘上），
  // 走到最下面时脚板放平压在地上；轴梁从上面把几只轮子串起来，木板车台。没有链带，但每只轮子都有「脚」
  TIERS.push({
    name: 'T1 铰接脚板轮', ref: '1846 博伊德尔「无极铁路」蒸汽牵引车',
    idea: '还没有履带：大木辐轮的轮缘上挂一圈铰接铁脚板，转到最下面时脚板放平压地——每只轮子都是「自带铁路」。轴梁串起几只轮子，上面铺木板车台。',
    draw(x, y, W, ph) {
      const m = W / 48 + 1, r = 12, cy = y + GROUND - r - 1, xs = Array.from({ length: m }, (_, i) => x + 14 + i * (W - 28) / (m - 1));
      // 轴梁 + 车台
      plate(x + 3, y + 12, W - 6, 4, WOOD); R(x + 3, y + 16, W - 6, 2, P.iron[0]); R(x + 3, y + 16, W - 6, 1, P.iron[3]);
      for (let k = x + 8; k < x + W - 6; k += 10) bolt(k, y + 13);
      xs.forEach((cx, i) => {
        const wa = ph / 24 * TAU / 9 + i * 0.5;   // 转一格 = 一块脚板（9 块）
        R(r0(cx) - 1, y + 18, 3, cy - y - 18, P.iron[0]); R(r0(cx), y + 18, 1, cy - y - 18, P.iron[3]);   // 吊杆
        // 铰接脚板：9 块，沿轮缘切线摆，最下面那块因为转到位刚好放平
        for (let k = 0; k < 9; k++) {
          const a = wa + k * TAU / 9 + Math.PI / 2, rr = r + 0.5;
          seg(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a + Math.PI / 2, 7.4, 3, P.iron[0]);
          seg(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a + Math.PI / 2, 6.2, 2, k % 2 ? P.iron[2] : P.iron[3]);
          px(r0(cx + Math.cos(a + 0.36) * (rr + 0.3)), r0(cy + Math.sin(a + 0.36) * (rr + 0.3)), P.brass[3]);   // 铰链销
        }
        // 木轮：轮辋 + 八根木辐 + 铁轮毂
        disc(cx, cy, r - 1.2, WOOD[0]); disc(cx, cy, r - 2.2, WOOD[2]); disc(cx - 0.5, cy - 0.5, r - 3, WOOD[3]); disc(cx, cy, r - 4, WOOD[1]);
        for (let k = 0; k < 8; k++) { const a = wa * 3 + k * TAU / 8; line(r0(cx), r0(cy), r0(cx + Math.cos(a) * (r - 4)), r0(cy + Math.sin(a) * (r - 4)), 1, WOOD[3]); }
        disc(cx, cy, 2.4, P.iron[0]); disc(cx, cy, 1.6, P.brass[2]); px(r0(cx - 1), r0(cy - 1), P.brass[3]);
      });
    },
  });

  // T2 木板链带（隆巴德 1901 / 霍恩斯比 1904）：大驱动轮 + 诱导轮 + 木板条链带（铁包头、两边铁链销），中间几只铸铁小托轮，上面一根铁梁
  TIERS.push({
    name: 'T2 木板链带', ref: '1901 隆巴德原木牵引车 · 1904 霍恩斯比链带',
    idea: '第一次有了「带」：一根根木板条串成链带，绕过驱动轮和诱导轮；每隔一块钉一条铁抓地条。下段贴着几只铸铁小托轮，上面一根铁梁托着上段。',
    draw(x, y, W, ph) {
      const rb = 12, cy = y + GROUND - 1 - rb, cxL = x + rb + 2, cxR = x + W - rb - 2;
      // 链带：木板条（每块 4px 宽，交替明暗），每隔一块加铁抓地条
      loop(cxL, cxR, cy, rb, 4, ph, (X, Y, a, i, w) => {
        seg(X, Y, a + Math.PI / 2, 4.2, 3, WOOD[0]);
        seg(X, Y, a + Math.PI / 2, 3.2, 2, i % 2 ? WOOD[1] : WOOD[2]);
        if (i % 3 === 0) seg(X + Math.sin(a) * 0.0, Y, a + Math.PI / 2, 4.2, 1, P.iron[2]);
        if (w === 'bot' && i % 2) px(r0(X), r0(Y + 2), P.iron[0]);
      });
      // 里面的机件
      disc(cxL, cy, rb - 3, P.dark[1]); disc(cxR, cy, rb - 3, P.dark[1]);
      spoked(cxL, cy, rb - 3.5, -ph / 24 * TAU / 8, 6, { spoke: P.iron[2], rim: P.iron, hub: P.brass[2] });
      teeth(cxL, cy, rb - 3, -ph / 24 * TAU / 8, 8, P.iron[4]);
      spoked(cxR, cy, rb - 3.5, -ph / 24 * TAU / 8, 5, { spoke: P.iron[2], rim: P.iron, hub: P.iron[3] });
      const nr = Math.floor((cxR - cxL) / 16);
      for (let i = 1; i <= nr; i++) { const rx = cxL + i * (cxR - cxL) / (nr + 1); disc(rx, cy + rb - 5, 3.4, P.dark[0]); disc(rx, cy + rb - 5, 2.6, P.iron[2]); px(r0(rx - 1), r0(cy + rb - 6), P.iron[4]); }
      // 上梁 + 吊杆
      R(cxL, y + 11, cxR - cxL, 4, P.iron[0]); R(cxL, y + 12, cxR - cxL, 2, P.iron[3]); R(cxL, y + 12, cxR - cxL, 1, P.iron[4]);
      for (const bx of [cxL + 4, (cxL + cxR) / 2, cxR - 4]) { R(r0(bx) - 1, y + 15, 3, cy - y - 15 - 6, P.iron[0]); R(r0(bx), y + 15, 1, cy - y - 21, P.iron[3]); }
      for (let k = cxL + 3; k < cxR - 2; k += 9) bolt(k, y + 12);
    },
  });

  // T3 铁链节履带（霍尔特 1908～1914）：铁链节带抓地齿，铆接铁板侧框（竖肋，A7V 式），成对负重轮，链轮有齿
  TIERS.push({
    name: 'T3 铁链节履带', ref: '1908 霍尔特链带 · 1916 Mark I 铆接侧框',
    idea: '木板换成铁链节：每节铁板带一个凸起的抓地齿、用销连成链；中间是铆接铁板侧框（竖肋），下面成对负重轮压着下段链带。',
    draw(x, y, W, ph) {
      const rb = 12, cy = y + GROUND - 1 - rb, cxL = x + rb + 2, cxR = x + W - rb - 2;
      loop(cxL, cxR, cy, rb, 5, ph, (X, Y, a, i, w) => chainLink(X, Y, a, i, w, { bar: true }));
      spoked(cxL, cy, rb - 3.5, -ph / 24 * TAU / 6, 6, { spoke: P.iron[3], hub: P.iron[3] });
      teeth(cxL, cy, rb - 2.6, -ph / 24 * TAU / 6, 10, P.iron[4]);
      spoked(cxR, cy, rb - 3.5, -ph / 24 * TAU / 6, 6, { spoke: P.iron[3], hub: P.iron[3] });
      // 侧框：铆接铁板 + 竖肋
      const fx0 = cxL + 6, fx1 = cxR - 6;
      plate(fx0, y + 22, fx1 - fx0, 12, [P.iron[0], P.iron[1], P.iron[2], P.iron[3]]);
      for (let k = fx0 + 6; k < fx1 - 3; k += 9) { R(k, y + 24, 1, 8, P.iron[1]); R(k + 1, y + 24, 1, 8, P.iron[4]); }
      for (let k = fx0 + 3; k < fx1 - 2; k += 9) { bolt(k, y + 23); bolt(k, y + 31); }
      // 成对负重轮
      const nb = Math.max(2, Math.round((fx1 - fx0) / 24));
      for (let g = 0; g < nb; g++) {
        const bx = fx0 + (g + 0.5) * (fx1 - fx0) / nb;
        R(r0(bx) - 6, y + 34, 12, 2, P.dark[0]);
        for (const d of [-4, 4]) { const wy = cy + rb - 5.5; disc(bx + d, wy, 4.3, P.dark[0]); disc(bx + d, wy, 3.4, P.dark[3]); disc(bx + d, wy, 1.6, P.dark[2]); const a = ph / 24 * TAU + d; px(r0(bx + d + Math.cos(a) * 2 - 0.5), r0(wy + Math.sin(a) * 2 - 0.5), P.iron[3]); }
      }
    },
  });

  // T4 减重孔钢框（Mark IV / 雷诺 FT 1917）：冲孔减重的钢侧框、钢盘负重轮、链节中间凸起的导向齿、辐条诱导轮
  TIERS.push({
    name: 'T4 减重孔钢框', ref: '1917 Mark IV 冲孔侧框 · 雷诺 FT 辐条诱导轮',
    idea: '侧框改冲压钢板，冲出一排减重孔；负重轮换成整块钢盘；链节中间多一排凸起的导向齿（嵌在轮子中间，防脱链）；前端是一只大辐条诱导轮。',
    draw(x, y, W, ph) {
      const rb = 12, cy = y + GROUND - 1 - rb, cxL = x + rb + 2, cxR = x + W - rb - 2;
      loop(cxL, cxR, cy, rb, 5, ph, (X, Y, a, i, w) => chainLink(X, Y, a, i, w, { bar: true, guide: true }));
      spoked(cxL, cy, rb - 3.5, -ph / 24 * TAU / 7, 7, { spoke: P.iron[4], hub: P.brass[2], sw: 1 });
      teeth(cxL, cy, rb - 2.6, -ph / 24 * TAU / 7, 12, P.iron[4]);
      spoked(cxR, cy, rb - 3.5, -ph / 24 * TAU / 7, 8, { spoke: P.iron[3], hub: P.iron[3] });
      const fx0 = cxL + 5, fx1 = cxR - 5;
      plate(fx0, y + 21, fx1 - fx0, 14, [P.iron[0], P.iron[1], P.iron[2], P.iron[3]]);
      for (let k = fx0 + 5; k + 4 < fx1; k += 9) { disc(k + 1.5, y + 28, 3.4, P.iron[1]); disc(k + 1.5, y + 28, 2.8, P.dark[1]); px(k - 1, y + 26, P.iron[0]); px(k + 1, y + 30, P.iron[3]); }
      R(fx0 + 1, y + 22, fx1 - fx0 - 2, 1, P.iron[4]);
      for (let k = fx0 + 2; k < fx1 - 1; k += 9) { bolt(k, y + 33); }
      const nb = Math.max(3, Math.round((fx1 - fx0) / 17));
      for (let g = 0; g < nb; g++) {
        const wx = fx0 + (g + 0.5) * (fx1 - fx0) / nb, wy = cy + rb - 5.5, a = ph / 24 * TAU + g;
        disc(wx, wy, 4.6, P.dark[0]); disc(wx, wy, 3.8, P.iron[2]); disc(wx - 0.5, wy - 0.5, 2.6, P.iron[3]); disc(wx, wy, 1.4, P.iron[1]);
        for (const k of [0, TAU / 3, 2 * TAU / 3]) px(r0(wx + Math.cos(a + k) * 2.6 - 0.5), r0(wy + Math.sin(a + k) * 2.6 - 0.5), P.iron[4]);
      }
    },
  });

  // T5 桁架转向架（维克斯 / 霍尔特 75）：桁架斜撑侧框、板簧转向架（每组两只轮挂在一根摆臂上，摆臂中点吊在板簧上）、黄铜轮毂的辐条链轮
  TIERS.push({
    name: 'T5 桁架转向架', ref: '1918 维克斯 · 霍尔特 75 转向架 + 板簧',
    idea: '侧框镂空成 X 形桁架斜撑，轻而硬；负重轮分成一组一组的转向架，每组两只轮挂一根摆臂、摆臂吊在弯板簧上；链轮换成黄铜轮毂的大辐条轮。',
    draw(x, y, W, ph) {
      const rb = 12, cy = y + GROUND - 1 - rb, cxL = x + rb + 2, cxR = x + W - rb - 2;
      loop(cxL, cxR, cy, rb, 5, ph, (X, Y, a, i, w) => chainLink(X, Y, a, i, w, { bar: true, guide: true, pin: P.brass[3] }));
      spoked(cxL, cy, rb - 3.2, -ph / 24 * TAU / 8, 8, { spoke: P.iron[4], hub: P.brass[2], sw: 1, hole: P.dark[2] });
      teeth(cxL, cy, rb - 2.4, -ph / 24 * TAU / 8, 12, P.brass[3]);
      disc(cxL, cy, 2.2, P.brass[1]); px(cxL - 1, cy - 1, P.brass[3]);
      spoked(cxR, cy, rb - 3.2, -ph / 24 * TAU / 8, 8, { spoke: P.iron[4], hub: P.brass[2], sw: 1, hole: P.dark[2] });
      // 桁架：上下弦 + X 斜撑，节点上打铆钉
      const fx0 = cxL + 6, fx1 = cxR - 6;
      R(fx0, y + 20, fx1 - fx0, 3, P.iron[0]); R(fx0, y + 21, fx1 - fx0, 1, P.iron[3]); R(fx0, y + 20, fx1 - fx0, 1, P.brass[2]);
      R(fx0, y + 31, fx1 - fx0, 3, P.iron[0]); R(fx0, y + 32, fx1 - fx0, 1, P.iron[3]);
      const bay = 12;
      for (let k = fx0; k + bay <= fx1; k += bay) {
        line(k + 1, y + 22, k + bay - 1, y + 32, 2, P.iron[1]); line(k + 1, y + 21, k + bay - 1, y + 31, 1, P.iron[3]);
        line(k + bay - 1, y + 22, k + 1, y + 32, 2, P.iron[1]); line(k + bay - 1, y + 21, k + 1, y + 31, 1, P.iron[3]);
        R(k, y + 20, 2, 14, P.iron[0]); R(k, y + 21, 1, 12, P.iron[4]); bolt(k, y + 24); bolt(k, y + 29);
      }
      // 转向架：每组两只轮 + 摆臂 + 弯板簧（摆臂随行驶轻轻摇）
      const nb = Math.max(2, Math.round((fx1 - fx0) / 24));
      for (let g = 0; g < nb; g++) {
        const bx = fx0 + (g + 0.5) * (fx1 - fx0) / nb, rock = Math.round(Math.sin(ph / 24 * TAU + g * 2));
        R(r0(bx) - 1, y + 34, 3, 3, P.dark[0]);
        for (let k = -4; k <= 4; k++) px(r0(bx + k), y + 35 - (Math.abs(k) < 3 ? 1 : 0), P.iron[k % 2 ? 2 : 3]);   // 弯板簧
        line(r0(bx) - 5, y + 39 + rock, r0(bx) + 5, y + 39 - rock, 2, P.dark[0]);
        for (const d of [-5, 5]) { const wy = cy + rb - 5.5 + (d > 0 ? -rock : rock) * 0.5, a = ph / 24 * TAU + d; disc(bx + d, wy, 4.4, P.dark[0]); disc(bx + d, wy, 3.6, P.iron[2]); disc(bx + d - 0.5, wy - 0.5, 2.4, P.iron[3]); disc(bx + d, wy, 1.4, P.brass[2]); px(r0(bx + d + Math.cos(a) * 2.4 - 0.5), r0(wy + Math.sin(a) * 2.4 - 0.5), P.iron[4]); }
      }
    },
  });

  // T6 全包裙板：整块铆接裙板盖住上段和侧框（只露出下面一排负重轮和前后两只大轮），裙板上沿一道黄铜饰边、板面百叶散热口 + 铆钉，下沿带铰链翻板
  TIERS.push({
    name: 'T6 全包裙板', ref: '1918～1920s 重型履带 · 全包裹装甲裙板',
    idea: '把侧框和上段履带整个盖进一整块铆接裙板：板面有百叶散热口、黄铜饰边和一颗颗大铆钉；下沿留出一排负重轮、前后大轮的下半只露在外面——最像「一堵会走的墙」。',
    draw(x, y, W, ph) {
      const rb = 12, cy = y + GROUND - 1 - rb, cxL = x + rb + 2, cxR = x + W - rb - 2;
      loop(cxL, cxR, cy, rb, 5, ph, (X, Y, a, i, w) => chainLink(X, Y, a, i, w, { bar: true, guide: true, pin: P.brass[3] }));
      spoked(cxL, cy, rb - 3.2, -ph / 24 * TAU / 8, 8, { spoke: P.brass[2], hub: P.brass[2], sw: 1, hole: P.dark[2] });
      teeth(cxL, cy, rb - 2.4, -ph / 24 * TAU / 8, 12, P.brass[3]);
      spoked(cxR, cy, rb - 3.2, -ph / 24 * TAU / 8, 8, { spoke: P.brass[2], hub: P.brass[2], sw: 1, hole: P.dark[2] });
      const nb = Math.max(3, Math.round((cxR - cxL) / 15));
      for (let g = 0; g < nb; g++) {
        const wx = cxL + 5 + (g + 0.5) * (cxR - cxL - 10) / nb, wy = cy + rb - 5.5, a = ph / 24 * TAU + g;
        disc(wx, wy, 4.4, P.dark[0]); disc(wx, wy, 3.6, P.iron[2]); disc(wx - 0.5, wy - 0.5, 2.4, P.iron[3]); disc(wx, wy, 1.4, P.brass[2]);
        px(r0(wx + Math.cos(a) * 2.4 - 0.5), r0(wy + Math.sin(a) * 2.4 - 0.5), P.iron[4]);
      }
      // 裙板：盖住 y+12 ～ y+34，前后两端斜切露出大轮
      const sx0 = x + 3, sx1 = x + W - 3, top = y + 10, hh = 25;
      const inside = (xx, yy) => xx >= sx0 && xx < sx1 && yy >= top && yy < top + hh && !(xx - sx0 + (yy - top) * 0 < 0) && !(yy - top > 12 && xx < sx0 + (yy - top - 12) * 1.1) && !(yy - top > 12 && xx >= sx1 - (yy - top - 12) * 1.1);
      for (let yy = top; yy < top + hh; yy++) for (let xx = sx0; xx < sx1; xx++) {
        if (!inside(xx, yy)) continue;
        const edge = !inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) || !inside(xx, yy + 1);
        px(xx, yy, edge ? P.iron[0] : !inside(xx, yy - 2) ? P.iron[4] : !inside(xx, yy + 2) ? P.iron[1] : P.iron[3]);
      }
      R(sx0 + 1, top + 1, sx1 - sx0 - 2, 1, P.brass[3]); R(sx0 + 1, top + 2, sx1 - sx0 - 2, 1, P.brass[2]);   // 黄铜饰边
      R(sx0 + 1, top + 13, sx1 - sx0 - 2, 1, P.iron[1]); R(sx0 + 1, top + 14, sx1 - sx0 - 2, 1, P.iron[4]);   // 上下两块板的接缝
      for (let k = sx0 + 10; k + 8 < sx1 - 6; k += 14) for (let s = 0; s < 4; s++) { R(k, top + 4 + s * 2, 8, 1, P.iron[0]); R(k, top + 5 + s * 2, 8, 1, P.iron[4]); }   // 百叶散热口
      for (let k = sx0 + 5; k < sx1 - 3; k += 8) { bolt(k, top + 15); }
      for (let k = sx0 + 7; k < sx1 - 3; k += 8) { bolt(k, top + 9 - 6 + 0); }
    },
  });

  // ---------- 对外 ----------
  // 画一条 n 节的履带到画布 g 的 (x, y)（底图，材质在页面里套）
  function strip(g, x, y, tier, o = {}) {
    SA.CAND.use(g);
    TIERS[tier - 1].draw(x, y, (o.n || 3) * 48, o.ph || 0);
  }
  return { TIERS, strip };
})();
