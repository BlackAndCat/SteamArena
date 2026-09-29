// 「当前开发」页的绘制代码（tools/current.html 专用）。这一页不复用：只放正在开发、等开发者确认的东西；
// 确认后把 current.html / current.js 复制到 tools/archive/<名字>.*，在 labs.js 登记成历史存档，再把这里换成下一项。
//
// 本期：观察镜 `periscope`（1×1 = 24×24，控制类）造型探索 v1（2026-09-29）。
// 规则：① 各档只换材质颜色（游戏的装饰层），所以只挑一个造型——剪影本身要立得住；② 不能伸出格子（只有武器和撞击件能出格），
// 镜头要收在 24px 里；③ 控制类的语义色是舷窗玻璃（P.glass）；④ 车载，不用三脚架、立柱、手柄这类步兵件；
// ⑤ 画在 T1 原画上（冷铁 + 黄铜 + 玻璃），材质层按档换色。每个造型都有一点动画（镜头转、眼睑眨、对焦……），让它在车上一眼看出是「活的仪器」。
window.SA = window.SA || {};

SA.PERI = (() => {
  const P = SA.PAL;
  let g = null;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const px = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => {
    g.fillStyle = c;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g.fillRect(xx, yy, 1, 1);
    }
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, o = Math.floor(w / 2); g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - o, Math.round(y0 + (y1 - y0) * i / n) - o, w, w);
  };
  const IRON = [P.iron[0], P.iron[1], P.iron[2], P.iron[3]], IRONL = [P.iron[0], P.iron[2], P.iron[3], P.iron[4]], BRASS = [P.brass[0], P.brass[1], P.brass[2], P.brass[3]];
  // 方块：描边 + 左上亮 + 右下暗
  const box = (x, y, w, h, r) => { R(x, y, w, h, r[0]); R(x + 1, y + 1, w - 2, h - 2, r[2]); R(x + 1, y + h - 2, w - 2, 1, r[1]); R(x + w - 2, y + 1, 1, h - 2, r[1]); R(x + 1, y + 1, w - 2, 1, r[3]); R(x + 1, y + 1, 1, h - 2, r[3]); };
  const rivet = (x, y) => { R(x, y, 2, 2, P.iron[4]); px(x + 1, y + 1, P.iron[2]); };
  // 竖直圆管：描边 → 亮边 → 固有 → 暗边
  const vtube = (x, y, w, h, r = IRONL) => { R(x, y, w, h, r[0]); R(x + 1, y, w - 2, h, r[2]); R(x + 1, y, 1, h, r[3]); if (w > 3) R(x + w - 2, y, 1, h, r[1]); };
  // 玻璃镜片：暗边 + 玻璃 + 一粒高光；glint 为真时闪白
  const lens = (x, y, w, h, glint) => { R(x, y, w, h, P.glass[0]); R(x, y, w, Math.max(1, h - 1), P.glass[1]); if (w > 2 && h > 2) R(x + 1, y + 1, w - 2, h - 2, P.glass[2]); px(x + (w > 2 ? 1 : 0), y + (h > 2 ? 1 : 0), glint ? P.white : P.glass[3]); };
  const glintAt = (t, period, off = 0) => (((t + off) % period) + period) % period < 3;
  // 底座：一块铆接的方座（坐在格子底部，和车体的格子接得上）
  const plinth = (x, y, x0, x1, top) => { box(x + x0, y + top, x1 - x0, 24 - top, IRON); rivet(x + x0 + 2, y + top + 2); rivet(x + x1 - 4, y + top + 2); };

  const SET = [
    { key: 'A', name: '潜望镜塔', ref: '潜艇 / 一战坦克的潜望镜',
      idea: '铆接方座上立一根镜管，顶上一只镜头箱；镜头箱慢慢左右转，观察窗在箱面上滑来滑去，转到正面时闪一下光。剪影：一根竖杆顶一个横盒。',
      draw(x, y, o) {
        const t = o.t || 0, th = Math.sin(t * 0.045) * 1.25;
        plinth(x, y, 3, 21, 17);
        R(x + 7, y + 15, 10, 2, P.brass[1]); R(x + 7, y + 15, 10, 1, P.brass[3]);
        vtube(x + 10, y + 6, 5, 9);
        R(x + 8, y + 10, 9, 2, P.brass[2]); px(x + 8, y + 10, P.brass[3]);
        box(x + 6, y + 1, 13, 6, IRONL);
        const w = Math.max(1, Math.round(4 * Math.cos(th))), cx = x + 12.5 + Math.sin(th) * 3.5;
        lens(cx - w / 2, y + 3, w, 2, Math.abs(th) < 0.12);
        R(x + 7, y + 1, 11, 1, P.brass[2]);
      } },
    { key: 'B', name: '观察穹', ref: '一战装甲车 / 坦克的指挥塔穹顶',
      idea: '低矮的半球穹顶坐在一圈铆接座圈上，穹顶腰上一圈观察缝（每道缝上有黄铜眉罩），整个穹顶慢慢转，观察缝跟着转过去。剪影：一只圆顶。',
      draw(x, y, o) {
        const t = o.t || 0, cx = x + 12, cy = y + 17;
        g.save(); g.beginPath(); g.rect(x, y, 24, 17); g.clip();   // 穹顶只露上半球，不能伸出格子下沿
        disc(cx, cy, 10, P.iron[0]); disc(cx, cy, 9, P.iron[2]); disc(cx - 1.5, cy - 1.5, 7, P.iron[3]); disc(cx - 3, cy - 4, 2.5, P.iron[4]);
        g.restore();
        box(x + 1, y + 17, 22, 7, IRON); for (const u of [3, 8, 14, 19]) rivet(x + u, y + 19);
        for (let k = 0; k < 8; k++) {   // 8 道观察缝，正面同时露出 3～4 道（只露两道时像一张脸）
          const a = t * 0.03 + k * Math.PI / 4, c = Math.cos(a); if (c < 0.15) continue;
          const sx = cx + Math.sin(a) * 8, w = Math.max(1, Math.round(2 * c));
          R(sx - w / 2, y + 11, w, 1, P.brass[2]); lens(sx - w / 2, y + 12, w, 2, c > 0.97);
        }
        R(cx - 2, y + 6, 4, 2, P.brass[1]); R(cx - 1, y + 6, 2, 1, P.brass[3]);
      } },
    { key: 'C', name: '剪式双筒镜', ref: '一战炮兵的剪式潜望镜（Scherenfernrohr，「兔耳镜」）',
      idea: '小炮塔座上一对斜伸的镜筒呈 V 形（兔耳），两根镜筒慢慢张开、合拢（调整基线），筒顶各一只朝前的镜头箱。剪影：一个 V。',
      draw(x, y, o) {
        const t = o.t || 0, s = 5.5 + 2.5 * Math.sin(t * 0.03), P0 = [x + 12, y + 16];
        box(x + 5, y + 17, 14, 7, IRON); rivet(x + 7, y + 19); rivet(x + 15, y + 19);
        for (const d of [-1, 1]) {
          const tip = [P0[0] + d * s, y + 4];
          line(P0[0], P0[1], tip[0], tip[1], 3, P.iron[0]); line(P0[0], P0[1], tip[0], tip[1], 1, P.iron[3]);
          const m = [(P0[0] + tip[0]) / 2, (P0[1] + tip[1]) / 2]; R(m[0] - 1.5, m[1] - 0.5, 3, 2, P.brass[2]);
          box(tip[0] - 2.5, tip[1] - 3, 5, 4, IRONL); lens(tip[0] + 0.5, tip[1] - 2, 2, 2, glintAt(t, 60, d * 20));
        }
        disc(P0[0], P0[1], 2.4, P.brass[0]); disc(P0[0], P0[1], 1.5, P.brass[2]);
        R(x + 9, y + 16, 2, 2, P.brass[1]); R(x + 13, y + 16, 2, 2, P.brass[1]);   // 目镜
      } },
    { key: 'D', name: '轭架望远镜', ref: '维多利亚天文台的赤道仪 / 舰载望远镜',
      idea: '转台上一副 U 形轭架，两颗黄铜耳轴夹着一支斜向上的黄铜望远镜（前端物镜、后端目镜），镜筒慢慢上下俯仰搜索。剪影：U 形架 + 一根斜管。',
      draw(x, y, o) {
        const t = o.t || 0, tilt = Math.sin(t * 0.035) * 1.2, pv = [x + 12, y + 12];
        box(x + 3, y + 19, 18, 5, IRON); for (let u = 5; u < 20; u += 4) px(x + u + ((t >> 3) % 4), y + 21, P.iron[1]);
        box(x + 5, y + 10, 3, 10, IRONL); box(x + 16, y + 10, 3, 10, IRONL);
        const dx = 10, dy = -3.2 + tilt, a = [pv[0] - dx, pv[1] - dy], b = [pv[0] + dx, pv[1] + dy];
        line(a[0], a[1], b[0], b[1], 4, P.brass[0]); line(a[0], a[1] - 0.5, b[0], b[1] - 0.5, 2, P.brass[2]); line(a[0], a[1] - 1, b[0], b[1] - 1, 1, P.brass[3]);
        for (const u of [0.3, 0.7]) { const q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; R(q[0] - 0.5, q[1] - 2, 1, 4, P.brass[0]); }
        R(b[0], b[1] - 2.5, 2, 5, P.brass[0]); lens(b[0] + 1, b[1] - 2, 2, 4, glintAt(t, 70));
        R(a[0] - 1, a[1] - 1, 2, 2, P.dark[0]);
        disc(x + 6.5, y + 12, 1.6, P.brass[3]); disc(x + 17.5, y + 12, 1.6, P.brass[3]);
      } },
    { key: 'E', name: '装甲舷窗', ref: '铁甲舰的舷窗 + 装甲眼睑',
      idea: '整块装甲板中间一扇厚黄铜舷窗（一圈螺栓），窗上一片装甲眼睑定时落下、抬起（眨眼）。剪影就是方块，靠那只大圆窗认。',
      draw(x, y, o) {
        const t = o.t || 0, cx = x + 12, cy = y + 12;
        box(x + 1, y + 1, 22, 22, IRONL); for (const [a, b] of [[3, 3], [19, 3], [3, 19], [19, 19]]) rivet(x + a, y + b);
        disc(cx, cy, 8, P.brass[0]); disc(cx, cy, 7, P.brass[2]); disc(cx - 1, cy - 1, 5.5, P.brass[3]);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; px(cx - 0.5 + Math.cos(a) * 6.3, cy - 0.5 + Math.sin(a) * 6.3, P.brass[0]); }
        disc(cx, cy, 5, P.glass[0]); disc(cx, cy, 4.2, P.glass[1]); disc(cx - 0.5, cy - 0.5, 3.4, P.glass[2]);
        R(cx - 3, cy - 3, 2, 1, P.glass[3]); px(cx - 3, cy - 2, P.glass[3]);
        const ph = (t + 60) % 160, close = ph < 10 ? ph / 10 : ph < 22 ? 1 : ph < 32 ? 1 - (ph - 22) / 10 : 0;   // 眼睑：约 10 秒眨一次
        if (close > 0) { const ly = cy - 5 + close * 10; g.save(); g.beginPath(); g.arc(cx, cy, 5.2, 0, Math.PI * 2); g.clip(); R(cx - 6, cy - 6, 12, ly - (cy - 6), P.iron[2]); R(cx - 6, ly - 1, 12, 1, P.iron[0]); R(cx - 6, cy - 6, 12, 1, P.iron[3]); g.restore(); }
        R(cx - 2, y + 2, 4, 2, P.iron[1]);   // 眼睑的铰链
      } },
    { key: 'F', name: '皮腔镜箱', ref: '维多利亚大画幅相机（皮腔 + 导轨对焦）',
      idea: '导轨上一只后箱、一段皮腔、一块前镜板和黄铜镜头；皮腔慢慢伸缩对焦（镜头前后移 1～2px）。剪影：横放的手风琴 + 圆镜头。',
      draw(x, y, o) {
        const t = o.t || 0, ext = Math.round(1 + Math.sin(t * 0.04));
        box(x + 1, y + 19, 22, 5, IRON); for (let u = 3; u < 21; u += 2) px(x + u, y + 19, P.iron[1]);   // 对焦导轨（齿条）
        box(x + 1, y + 7, 7, 12, IRONL); R(x + 2, y + 8, 5, 1, P.brass[2]); R(x + 2, y + 17, 5, 1, P.brass[1]);   // 后箱
        const b0 = x + 8, b1 = x + 12 + ext;
        for (let u = b0; u < b1; u++) { const k = (u - b0) / (b1 - b0), hh = 12 - k * 3, top = y + 7 + k * 1.5; R(u, top, 1, hh, (u - b0) % 2 ? P.leather[0] : P.leather[1]); }
        R(b0, y + 7, b1 - b0, 1, P.dark[0]); R(b0, y + 18, b1 - b0, 1, P.dark[0]);
        box(b1, y + 8, 3, 11, BRASS);   // 前镜板
        R(b1 + 3, y + 10, 4, 7, P.brass[0]); R(b1 + 3, y + 11, 4, 5, P.brass[2]); R(b1 + 3, y + 11, 4, 1, P.brass[3]);
        lens(b1 + 6, y + 11, 2, 5, glintAt(t, 80));
      } },
    { key: 'G', name: '灯塔瞭望镜', ref: '灯塔的菲涅尔透镜灯室',
      idea: '铆接基座上一座小灯室：一圈黄铜立框夹着一节横纹的菲涅尔玻璃，里面一道亮带慢慢绕着转，顶上黄铜穹盖。剪影：一只灯笼。',
      draw(x, y, o) {
        const t = o.t || 0;
        plinth(x, y, 4, 20, 18);
        box(x + 5, y + 16, 14, 3, BRASS);
        R(x + 6, y + 6, 12, 10, P.glass[1]); for (let r = 7; r < 16; r += 2) R(x + 6, y + r, 12, 1, P.glass[2]);   // 菲涅尔棱纹
        const bx = x + 6 + ((t * 0.12) % 13); R(bx, y + 6, 1.5, 10, P.glass[3]); px(bx, y + 10, P.white);
        for (const u of [5, 11, 17]) R(x + u, y + 5, 2, 11, P.brass[1]);
        R(x + 5, y + 5, 14, 1, P.brass[0]);
        R(x + 6, y + 2, 12, 3, P.brass[2]); R(x + 8, y + 1, 8, 1, P.brass[3]); R(x + 11, y + 0, 2, 1, P.brass[1]); R(x + 6, y + 4, 12, 1, P.brass[0]);
      } },
  ];

  // 画一只观察镜到画布（T1 原画，材质由页面的装饰层换）
  function figure(ctx, x, y, e, o = {}) { g = ctx; e.draw(x, y, o); }
  return { SET, figure };
})();
