// 小水罐 tank_s（1×1）/ 水罐 tank_tall（1×2）重画探索（tools/boiler-lab.html 专用，只做视觉，还没接进游戏）。
// 2026-09-28 用户：两种小水罐识别度太低（现在是胶囊罐身 + 4px 宽的水位窗，水只占一小条），要增加水的占比、一眼看出是水罐。
// 两个方向都让「水」成为最大的一块颜色：
//   W1 大水窗罐：铁罐身 + 占满罐身的玻璃窗（水面波纹、气泡、刻度）+ 侧面黄铜水龙头在滴水
//   W2 玻璃水筒：整只罐身就是玻璃筒（圆柱明暗的水）+ 黄铜上下盖 + 两根拉杆 + 顶上手轮
// 画法同其他样机：只用 SA.PAL 的冷铁 / 黄铜 / 水 / 玻璃，材料换色交给材质处理（水和玻璃保持原色）。
// o = { lv 0~1 水量, fr 0~3 帧 }
window.SA = window.SA || {};

SA.TKLAB = (() => {
  const { P, R, px, disc, box, IRON, IRONL, BRASS } = SA.CAND;
  const use = (g) => SA.CAND.use(g);
  // 圆角矩形（r 像素的 45° 小切角 + 1px 圆），ramp = [描边, 暗面, 固有色, 亮面]
  function rbox(x, y, w, h, r, ramp) {
    const inRR = (xx, yy, rr) => {
      const cx = xx < x + rr ? x + rr : xx >= x + w - rr ? x + w - rr - 1 : xx, cy = yy < y + rr ? y + rr : yy >= y + h - rr ? y + h - rr - 1 : yy;
      const dx = xx - cx, dy = yy - cy; return dx * dx + dy * dy <= rr * rr + rr * 0.6;
    };
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inRR(xx, yy, r)) continue;
      const edge = !inRR(xx - 1, yy, r) || !inRR(xx + 1, yy, r) || !inRR(xx, yy - 1, r) || !inRR(xx, yy + 1, r);
      if (edge) { px(xx, yy, ramp[0]); continue; }
      const lit = !inRR(xx - 2, yy, r) || !inRR(xx, yy - 2, r), shade = !inRR(xx + 2, yy, r) || !inRR(xx, yy + 2, r);
      px(xx, yy, lit ? ramp[3] : shade ? ramp[1] : ramp[2]);
    }
  }
  // 水窗里的水：玻璃底 → 水面（亮线 + 波纹，随帧移）→ 水体（圆柱明暗：左亮右暗 + 一道高光）→ 上升的气泡；玻璃反光竖条压在最上面
  function waterIn(x, y, w, h, lv, fr) {
    R(x, y, w, h, P.glass[0]);
    for (let i = 0; i < w; i += 3) px(x + i + (i % 2), y + 1, P.glass[1]);                                           // 空的部分：一点蒸汽凝结
    const lh = Math.max(0, Math.min(h, Math.round(h * lv))), top = y + h - lh;
    if (lh > 0) {
      for (let i = 0; i < w; i++) {
        const t = i / Math.max(1, w - 1);
        R(x + i, top, 1, lh, i === 0 || i === w - 1 ? P.water[0] : t < 0.3 ? P.water[2] : t > 0.78 ? P.water[0] : P.water[1]);
      }
      if (w > 6) R(x + Math.round(w * 0.2), top + 2, 1, Math.max(0, lh - 3), P.water[3]);                   // 圆柱高光
      for (let i = 0; i < w; i++) { const wave = ((i + fr) % 4) < 2; px(x + i, top, wave ? P.water[3] : P.water[2]); if (lh > 1 && wave) px(x + i, top + 1, P.water[2]); }
      if (lh > 5) for (const [bx, sp] of [[0.35, 0], [0.62, 5], [0.5, 11]]) {
        const yy = y + h - 2 - ((fr * 3 + sp) % Math.max(1, lh - 4)); if (yy > top + 2) px(x + Math.round(w * bx), yy, P.water[3]);
      }
    }
    R(x + 1, y + 1, 1, Math.max(1, Math.round(h * 0.45)), P.glass[3]);                                                // 玻璃反光
    if (h > 12) px(x + 1, y + Math.round(h * 0.45) + 2, P.glass[2]);
  }
  // 黄铜水龙头（左侧）+ 滴水（按帧往下落，落到底座就没了）
  function tap(x, y, fr, dropTo) {
    R(x, y, 3, 2, P.brass[1]); R(x, y, 3, 1, P.brass[3]);
    R(x, y + 2, 2, 2, P.brass[1]); px(x, y + 2, P.brass[2]); R(x + 1, y - 2, 1, 2, P.brass[2]);                       // 出水嘴 + 小阀柄
    const dy = y + 4 + fr * 2; if (dy < dropTo) { px(x, dy, P.water[3]); if (fr > 0) px(x, dy - 1, P.water[2]); }
  }
  // 顶上手轮（侧面看是一根横杆 + 轮毂）
  function wheel(cx, y) { R(cx - 4, y, 9, 2, P.brass[1]); R(cx - 4, y, 9, 1, P.brass[3]); R(cx, y + 2, 1, 2, P.iron[0]); px(cx, y, P.brass[0]); }
  const ticks = (x, y0, y1) => { for (let yy = y0; yy <= y1; yy += 5) R(x, yy, 2, 1, P.iron[4]); };
  const skid = (x, y, w) => { box(x, y, w, 3, IRON); R(x + 1, y + 3, 3, 1, P.iron[0]); R(x + w - 4, y + 3, 3, 1, P.iron[0]); };

  // ================= W1 大水窗罐 =================
  function w1Tall(g, x, y, o = {}) {
    use(g); const lv = o.lv == null ? 0.7 : o.lv, fr = o.fr || 0;
    wheel(x + 12, y + 1); R(x + 10, y + 3, 4, 3, P.iron[3]); R(x + 10, y + 3, 1, 3, P.iron[4]);
    rbox(x + 2, y + 5, 20, 39, 4, IRONL);
    R(x + 3, y + 8, 18, 2, P.brass[1]); R(x + 3, y + 8, 18, 1, P.brass[3]);                                         // 上箍
    R(x + 3, y + 40, 18, 2, P.brass[1]); R(x + 3, y + 40, 18, 1, P.brass[3]);                                       // 下箍
    box(x + 4, y + 11, 16, 28, [P.iron[0], P.iron[0], P.iron[0], P.iron[0]]);                                         // 窗框
    waterIn(x + 5, y + 12, 14, 26, lv, fr);
    ticks(x + 20, y + 14, y + 36);
    tap(x + 0, y + 33, fr, y + 44);
    skid(x + 3, y + 44, 18);
  }
  function w1Small(g, x, y, o = {}) {
    use(g); const lv = o.lv == null ? 0.7 : o.lv, fr = o.fr || 0;
    R(x + 9, y + 1, 6, 2, P.brass[1]); R(x + 9, y + 1, 6, 1, P.brass[3]); R(x + 11, y + 3, 2, 1, P.iron[0]);          // 注水口盖
    rbox(x + 2, y + 4, 20, 17, 3, IRONL);
    box(x + 4, y + 6, 16, 13, [P.iron[0], P.iron[0], P.iron[0], P.iron[0]]);
    waterIn(x + 5, y + 7, 14, 11, lv, fr);
    tap(x + 0, y + 14, fr % 2, y + 21);
    skid(x + 3, y + 21, 18);
  }

  // ================= W2 玻璃水筒 =================
  function cap(x, y, w, h) { box(x, y, w, h, IRON); R(x + 1, y + h - 2, w - 2, 1, P.brass[2]); R(x + 1, y + h - 1, w - 2, 1, P.brass[1]); }
  function capB(x, y, w, h) { box(x, y, w, h, IRON); R(x + 1, y, w - 2, 1, P.brass[1]); R(x + 1, y + 1, w - 2, 1, P.brass[3]); }
  function rods(x0, x1, y0, y1) { for (const rx of [x0, x1]) { R(rx, y0, 2, y1 - y0, P.iron[0]); R(rx, y0, 1, y1 - y0, P.iron[3]); } }
  function w2Tall(g, x, y, o = {}) {
    use(g); const lv = o.lv == null ? 0.7 : o.lv, fr = o.fr || 0;
    wheel(x + 12, y + 0); R(x + 11, y + 2, 2, 2, P.iron[0]);
    cap(x + 1, y + 4, 22, 5);
    R(x + 4, y + 9, 16, 32, P.glass[1]);                                                                              // 玻璃筒外壁
    waterIn(x + 5, y + 9, 14, 32, lv, fr);
    rods(x + 2, x + 20, y + 9, y + 41);
    capB(x + 1, y + 41, 22, 5);
    tap(x + 0, y + 36, fr, y + 46);                                                                                   // 水龙头接在下盖上面一点
    R(x + 3, y + 46, 3, 2, P.iron[0]); R(x + 18, y + 46, 3, 2, P.iron[0]);
  }
  function w2Small(g, x, y, o = {}) {
    use(g); const lv = o.lv == null ? 0.7 : o.lv, fr = o.fr || 0;
    R(x + 8, y + 1, 8, 2, P.brass[1]); R(x + 8, y + 1, 8, 1, P.brass[3]); R(x + 11, y + 3, 2, 1, P.iron[0]);
    cap(x + 1, y + 3, 22, 4);
    R(x + 4, y + 7, 16, 12, P.glass[1]);
    waterIn(x + 5, y + 7, 14, 12, lv, fr);
    rods(x + 2, x + 20, y + 7, y + 19);
    capB(x + 1, y + 19, 22, 4);
    R(x + 3, y + 23, 3, 1, P.iron[0]); R(x + 18, y + 23, 3, 1, P.iron[0]);
  }

  const CANDS = [
    { key: 'W1', name: 'W1 大水窗罐', idea: '铁罐身 + 占满罐身的玻璃窗：水面波纹、气泡、窗边刻度；左侧黄铜水龙头在滴水。水占 1×2 的约 30%（原来约 8%），铁罐身仍在，和装甲、锅炉同一家族', tall: w1Tall, small: w1Small },
    { key: 'W2', name: 'W2 玻璃水筒', idea: '整只罐身就是一根玻璃筒：圆柱明暗的水 + 黄铜上下盖 + 两根拉杆 + 顶上手轮。水占 1×2 的约 40%，最直白（一眼就是「一瓶水」），但铁件少、材料换色时变化也少', tall: w2Tall, small: w2Small },
  ];
  return { CANDS };
})();
