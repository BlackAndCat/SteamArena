// 早期模块造型候选：小臼炮、冷凝器、加压舱、4 个 1×1 小部件（见 cand-kit.js）
(() => {
  const { P, R, px, disc, ring, line, box, rivet, arch, gauge, tube, hoop, flash, puff, turn, IRON, IRONL, DARK, BRASS, add } = SA.CAND;
  const rc = (o) => Math.round(o.k * (o.m.rcPx || 0));
  // 竖着 / 横着的圆罐身：r 是半径，ramp 用冷铁
  const vcyl = (x, y, w, h) => { R(x, y, w, h, P.iron[0]); R(x + 1, y + 1, w - 2, h - 2, P.iron[2]); R(x + 1, y + 1, 2, h - 2, P.iron[3]); px(x + 2, y + 2, P.iron[4]); R(x + w - 2, y + 1, 1, h - 2, P.iron[1]); };

  // ---------- 小臼炮 1×1：朝天，耳轴 (12,13)，炮口长 18 ----------
  add('mortar_s', 'early', '要点：一眼「往上打」，和同格大小的小炮（平射）分开；和 2×2 高抛火炮是一家（粗短、黄铜箍、黑炮口）。默认仰角 55°。', [
    {
      key: 'A', name: '迷你臼炮', idea: '高抛火炮的缩小版：粗短炮管 + 两道黄铜箍 + 黑炮口，坐在两块暗铁耳轴座上。家族感最强。',
      draw(x, y, o) {
        box(x + 1, y + 17, 22, 7, IRON); R(x + 2, y + 21, 20, 1, P.brass[2]);
        box(x + 5, y + 11, 5, 9, DARK); box(x + 15, y + 11, 5, 9, DARK);
        const d = rc(o);
        turn(x + 12, y + 13, o.a, (X, Y) => {
          tube(X - 5 - d, Y - 4, 21, 9);
          R(X - 6 - d, Y - 3, 1, 7, P.iron[0]);
          for (const hx of [X + 1 - d, X + 8 - d]) { R(hx, Y - 5, 3, 11, P.brass[0]); R(hx, Y - 4, 3, 9, P.brass[2]); R(hx, Y - 4, 1, 9, P.brass[3]); }
          R(X + 15 - d, Y - 5, 3, 11, P.iron[0]); R(X + 15 - d, Y - 4, 2, 9, P.iron[2]); R(X + 17 - d, Y - 3, 1, 7, P.black);
          flash(X + 18 - d, Y - 3, 7, o.k);
        });
        disc(x + 12, y + 13, 3, P.brass[0]); disc(x + 12, y + 13, 2, P.brass[2]); px(x + 11, y + 12, P.brass[3]);
      },
    },
    {
      key: 'B', name: '掷弹筒', idea: '一战斯托克斯式堑壕迫击炮：细长炮管尾部抵在底板上，中间一副两脚架。剪影最轻、最「步兵」，和粗壮的大臼炮拉开。',
      draw(x, y, o) {
        box(x + 1, y + 19, 12, 5, DARK); rivet(x + 3, y + 20, P.iron[3]);
        for (const fx of [18, 22]) { line(x + 12, y + 13, x + fx, y + 23, 2, P.iron[0]); line(x + 12, y + 13, x + fx, y + 23, 1, P.iron[3]); }
        R(x + 16, y + 23, 8, 1, P.dark[0]);
        const d = rc(o);
        turn(x + 12, y + 13, o.a, (X, Y) => {
          tube(X - 11 - d, Y - 2, 29, 5);
          R(X - 12 - d, Y - 3, 2, 7, P.dark[1]);
          R(X + 15 - d, Y - 3, 3, 7, P.iron[0]); R(X + 15 - d, Y - 2, 2, 5, P.iron[3]); R(X + 17 - d, Y - 1, 1, 3, P.black);
          flash(X + 18 - d, Y - 2, 5, o.k);
        });
        box(x + 9, y + 10, 7, 6, BRASS);
      },
    },
    {
      key: 'C', name: '铜臼炮', idea: '维多利亚铜铸臼炮（Coehorn）：喇叭形铜炮身架在带提手的铁座上。最有年代感；缺点是炮身是黄铜，换材料时只有铁座变色。',
      draw(x, y, o) {
        box(x + 2, y + 15, 20, 9, IRON); R(x + 7, y + 15, 10, 3, P.dark[1]);
        for (const hx of [1, 21]) { R(x + hx, y + 17, 2, 5, P.brass[0]); R(x + hx, y + 18, 2, 3, P.brass[2]); }
        rivet(x + 4, y + 20); rivet(x + 18, y + 20);
        const d = rc(o);
        turn(x + 12, y + 13, o.a, (X, Y) => {
          disc(X - 6 - d, Y, 3, P.brass[0]); disc(X - 6 - d, Y, 2, P.brass[2]);
          for (let i = 0; i < 23; i++) {
            const hh = 3 + Math.round(Math.max(0, i - 6) * 0.2), cx = X - 5 + i - d;
            R(cx, Y - hh - 1, 1, hh * 2 + 3, P.brass[0]);
            R(cx, Y - hh, 1, hh * 2 + 1, P.brass[2]); px(cx, Y - hh, P.brass[3]); px(cx, Y + hh, P.brass[1]);
            if (i === 8 || i === 15) R(cx, Y - hh, 1, hh * 2 + 1, P.brass[1]);
          }
          R(X + 17 - d, Y - 5, 1, 11, P.black);
          flash(X + 18 - d, Y - 3, 7, o.k);
        });
      },
    },
  ]);

  // ---------- 冷凝器 1×2：不储水、降低耗水 ----------
  add('condenser', 'early', '要点：冷却类，青色只用在管路和一小截回收水位上；不能有水箱那样的大玻璃水位窗（冷凝器本身不储水），也要和侧挂的散热片分开（冷凝器是实心的主体件）。', [
    {
      key: 'A', name: '蛇形盘管', idea: '铁框玻璃窗里一根来回弯折的青色冷凝盘管，底下是接水斗，水珠一滴滴落下。功能最直白。',
      draw(x, y, o) {
        box(x + 8, y, 8, 4, BRASS);
        box(x + 2, y + 3, 20, 43, IRON);
        R(x + 5, y + 7, 14, 27, P.iron[0]); R(x + 6, y + 8, 12, 25, P.glass[0]);
        for (let k = 0; k < 6; k++) {
          const yy = y + 9 + k * 4;
          R(x + 7, yy, 10, 2, P.water[1]); R(x + 7, yy, 10, 1, P.water[2]);
          if (k < 5) { const cx = k % 2 ? x + 7 : x + 15; R(cx, yy, 2, 6, P.water[1]); px(cx, yy, P.water[2]); }
        }
        box(x + 4, y + 35, 16, 9, IRONL);
        R(x + 7, y + 38, 10, 3, P.glass[0]); R(x + 7, y + 40, 10, 1, P.water[2]);
        px(x + 12, y + 33 + (o.t % 3), P.water[3]);
        rivet(x + 3, y + 5); rivet(x + 19, y + 5);
      },
    },
    {
      key: 'B', name: '冷凝柱', idea: '一根竖立的冷凝柱套满横向散热翅片，旁边一根青色冷水管，底部接水盘。像实验室的蒸馏柱，翅片让它和水箱、锅炉都分得开。',
      draw(x, y, o) {
        arch(x + 12, y + 1, y + 6, 5, P.brass[0]); arch(x + 12, y + 2, y + 6, 4, P.brass[2]);
        vcyl(x + 8, y + 5, 8, 36);
        for (let yy = y + 8; yy <= y + 34; yy += 4) { R(x + 3, yy, 18, 2, P.iron[0]); R(x + 4, yy, 16, 1, P.iron[3]); }
        R(x + 19, y + 6, 3, 33, P.iron[0]); R(x + 20, y + 6, 1, 33, P.water[2]);
        box(x + 2, y + 40, 20, 7, DARK); R(x + 4, y + 42, 16, 1, P.water[2]);
        px(x + 11, y + 41 - (o.t % 2), P.water[3]);
      },
    },
    {
      key: 'C', name: '回流双罐', idea: '上面一个铁拱顶的蒸汽罐（带小压力表），中间一段青色螺旋管，下面一个带小水位窗的回收罐：把「蒸汽 → 冷却 → 回水」画成一条竖线。',
      draw(x, y, o) {
        arch(x + 12, y + 1, y + 19, 10, P.iron[0]); arch(x + 12, y + 2, y + 18, 9, P.iron[2]); arch(x + 11, y + 3, y + 12, 5, P.iron[3]);
        R(x + 3, y + 17, 18, 2, P.brass[1]); R(x + 3, y + 17, 18, 1, P.brass[3]);
        gauge(x + 12, y + 11, 3.5, 0.3 + 0.05 * (o.t % 4));
        for (let k = 0; k < 4; k++) { const y0 = y + 20 + k * 4; line(x + 6, y0, x + 18, y0 + 2, 2, P.water[1]); line(x + 6, y0, x + 18, y0 + 2, 1, P.water[2]); }
        R(x + 5, y + 19, 2, 17, P.iron[0]); R(x + 17, y + 19, 2, 17, P.iron[0]);
        box(x + 3, y + 35, 18, 12, IRON);
        R(x + 6, y + 38, 12, 6, P.iron[0]); R(x + 7, y + 39, 10, 4, P.glass[0]); R(x + 7, y + 41, 10, 2, P.water[1]); R(x + 7, y + 41, 10, 1, P.water[3]);
      },
    },
  ]);

  // ---------- 加压舱 1×1：+2 动力、会产热 ----------
  add('pressure_chamber', 'early', '要点：属于能源，但只有锅炉能发光，所以加压舱不发光；用「动力」的语义——蒸汽白 + 压力表。要和 1×1 甲片、小水罐分开：压力表和安全阀是它的标志。', [
    {
      key: 'A', name: '球形压力舱', idea: '铆接的铁球坐在鞍座上，正面一只大压力表，顶上安全阀一阵阵冒汽。圆形剪影在一堆方块里很显眼。',
      draw(x, y, o) {
        box(x + 3, y + 19, 18, 5, DARK);
        disc(x + 12, y + 12, 9, P.iron[0]); disc(x + 12, y + 12, 8, P.iron[2]); disc(x + 10, y + 10, 4.5, P.iron[3]); px(x + 8, y + 8, P.iron[4]);
        R(x + 4, y + 12, 16, 1, P.iron[1]); for (let i = 5; i < 20; i += 3) px(x + i, y + 13, P.iron[4]);
        R(x + 11, y + 1, 3, 3, P.brass[1]); px(x + 11, y + 1, P.brass[3]);
        gauge(x + 15, y + 15, 3.5, 0.5 + 0.1 * Math.sin(o.t * 0.7));
        if (o.t % 16 < 6) puff(x + 12, y, o.t, 2);
      },
    },
    {
      key: 'B', name: '卧式气囊', idea: '一只横放的胶囊压力罐，两道黄铜箍，顶上两只小表。更像「一节电池」，读起来是储能 / 增压的零件。',
      draw(x, y, o) {
        for (const [c, r] of [[P.iron[0], 5.5], [P.iron[2], 4.5]]) { disc(x + 7, y + 14, r, c); disc(x + 17, y + 14, r, c); R(x + 7, y + 14 - Math.floor(r) - (r > 5 ? 0 : 0), 10, Math.floor(r) * 2 + 1, c); }
        R(x + 5, y + 10, 14, 1, P.iron[3]); px(x + 4, y + 11, P.iron[4]);
        hoop(x + 9, y + 9, 11); hoop(x + 14, y + 9, 11);
        R(x + 6, y + 5, 1, 4, P.brass[1]); R(x + 17, y + 5, 1, 4, P.brass[1]);
        gauge(x + 6, y + 4, 3, 0.45); gauge(x + 17, y + 4, 3, 0.7 - 0.05 * (o.t % 3));
        R(x + 5, y + 20, 3, 4, P.dark[1]); R(x + 16, y + 20, 3, 4, P.dark[1]);
      },
    },
    {
      key: 'C', name: '加压泵', idea: '一只立式气缸配一个转个不停的小飞轮（动画），侧面一只压力表。会动的零件最能说明「这东西在产动力」。',
      draw(x, y, o) {
        box(x + 1, y + 20, 22, 4, DARK);
        vcyl(x + 3, y + 5, 9, 16); R(x + 3, y + 8, 9, 1, P.brass[2]); R(x + 3, y + 16, 9, 1, P.brass[2]);
        const up = o.t % 4 < 2 ? 0 : 2;
        R(x + 7, y + 1 + up, 1, 4 - up + 1, P.iron[4]); R(x + 6, y + up, 3, 1, P.iron[3]);
        disc(x + 17, y + 13, 6, P.dark[0]); disc(x + 17, y + 13, 5, P.iron[1]);
        for (let s = 0; s < 3; s++) { const a = o.t * 0.5 + s * Math.PI * 2 / 3; line(x + 17, y + 13, Math.round(x + 17 + Math.cos(a) * 4), Math.round(y + 13 + Math.sin(a) * 4), 1, P.iron[3]); }
        disc(x + 17, y + 13, 1.5, P.brass[2]);
        line(x + 8, y + 3 + up, x + 17, y + 13, 1, P.iron[2]);
        gauge(x + 7, y + 12, 2.5, 0.6);
      },
    },
  ]);

  // ---------- 4 个 1×1 小部件（控制类：玻璃语义） ----------
  add('periscope', 'early', '观察镜（瞄准更快）。控制类用舷窗玻璃色；不能伸出格子（只有武器和撞击件能出格），所以镜头要收在 24px 里。', [
    {
      key: 'A', name: '潜望镜', idea: '底座上竖一根潜望镜管，镜头朝前（朝右），底部有目镜。最直接的「观察」剪影：一根竖杆 + 一个朝前的头。',
      draw(x, y, o) {
        box(x + 2, y + 16, 20, 8, IRON); rivet(x + 18, y + 19);
        R(x + 4, y + 18, 5, 3, P.brass[1]); px(x + 4, y + 19, P.glass[2]);
        R(x + 9, y + 5, 6, 12, P.iron[0]); R(x + 10, y + 5, 4, 12, P.iron[3]); R(x + 10, y + 5, 1, 12, P.iron[4]);
        R(x + 8, y + 12, 8, 2, P.brass[2]); px(x + 8, y + 12, P.brass[3]);
        box(x + 8, y + 1, 14, 7, IRON); R(x + 18, y + 3, 3, 3, P.glass[1]); px(x + 18, y + 3, P.glass[3]);
        if (o.t % 20 < 2) px(x + 20, y + 3, P.white);
      },
    },
    {
      key: 'B', name: '黄铜望远镜', idea: '三脚小架上一支斜向的黄铜望远镜，前端玻璃镜片。维多利亚味道最浓，和驾驶舱的黄铜一家。',
      draw(x, y, o) {
        for (const fx of [4, 12, 19]) line(x + 12, y + 14, x + fx, y + 23, 1, P.dark[3]);
        R(x + 3, y + 23, 18, 1, P.dark[0]);
        line(x + 3, y + 14, x + 20, y + 6, 4, P.brass[0]); line(x + 3, y + 14, x + 20, y + 6, 2, P.brass[2]); line(x + 3, y + 13, x + 20, y + 5, 1, P.brass[3]);
        line(x + 11, y + 11, x + 13, y + 10, 5, P.brass[1]);
        R(x + 20, y + 4, 2, 4, P.glass[2]); px(x + 21, y + 4, P.glass[3]);
        R(x + 2, y + 13, 2, 3, P.dark[0]);
        disc(x + 12, y + 14, 1.5, P.dark[0]);
      },
    },
    {
      key: 'C', name: '观察窗', idea: '一块装甲板上开一道带黄铜眉罩的观察缝，缝里的玻璃偶尔闪一下光。最省空间，但剪影就是方块，只能靠那道玻璃缝认。',
      draw(x, y, o) {
        box(x + 1, y + 1, 22, 22, IRONL);
        for (const [a, b] of [[3, 3], [19, 3], [3, 19], [19, 19]]) rivet(x + a, y + b);
        R(x + 4, y + 7, 16, 2, P.brass[1]); R(x + 4, y + 7, 16, 1, P.brass[3]);
        R(x + 4, y + 9, 16, 5, P.iron[0]); R(x + 5, y + 10, 14, 3, P.glass[0]);
        const gx = (o.t * 2) % 30; if (gx < 14) R(x + 5 + gx, y + 10, 1, 3, P.glass[2]);
        R(x + 5, y + 10, 14, 1, P.glass[1]);
      },
    },
  ]);

  add('autoloader', 'early', '装弹机（装填更快）。画面上要看得到「炮弹」和「机械」：黄铜弹壳是火力语义，但这里只作为零件出现，主体仍是冷铁。', [
    {
      key: 'A', name: '弹架', idea: '铁框里横放三发黄铜炮弹，右边一根推弹杆。一眼就是「弹药」；缺点是静止时像个弹药箱。',
      draw(x, y, o) {
        box(x + 1, y + 1, 22, 22, IRON); R(x + 3, y + 3, 18, 18, P.dark[1]);
        const push = o.t % 12 < 3 ? 1 : 0;
        for (let i = 0; i < 3; i++) {
          const yy = y + 5 + i * 5, sx = x + 4 + (i === 0 ? push : 0);
          R(sx, yy, 9, 3, P.brass[1]); R(sx, yy, 9, 1, P.brass[3]); px(sx, yy + 1, P.dark[0]);
          R(sx + 9, yy, 3, 3, P.iron[3]); px(sx + 12, yy + 1, P.iron[4]); px(sx + 9, yy, P.iron[4]);
        }
        R(x + 18, y + 4, 2, 16, P.brass[0]); R(x + 18, y + 4, 1, 16, P.brass[2]);
        disc(x + 19, y + 5 + (o.t % 12 < 3 ? 0 : 1), 1.5, P.brass[3]);
      },
    },
    {
      key: 'B', name: '转轮弹鼓', idea: '一只圆形弹鼓，六个弹位绕着转（动画），中间黄铜轴，下方出弹口。转动感最强，但要注意别和机枪的弹鼓混。',
      draw(x, y, o) {
        box(x + 1, y + 18, 22, 6, DARK); R(x + 16, y + 17, 6, 3, P.dark[0]);
        disc(x + 11, y + 11, 10, P.iron[0]); disc(x + 11, y + 11, 9, P.iron[2]); disc(x + 10, y + 10, 5, P.iron[3]);
        for (let s = 0; s < 6; s++) {
          const a = s * Math.PI / 3 + Math.floor(o.t / 3) * Math.PI / 12, cx = x + 11 + Math.cos(a) * 5.5, cy = y + 11 + Math.sin(a) * 5.5;
          disc(cx, cy, 2, P.dark[0]); disc(cx, cy, 1.3, P.brass[2]); px(Math.round(cx - 1), Math.round(cy - 1), P.brass[3]);
        }
        disc(x + 11, y + 11, 2, P.brass[0]); disc(x + 11, y + 11, 1.2, P.brass[3]);
      },
    },
    {
      key: 'C', name: '链式提弹机', idea: '上下两个黄铜链轮带一条链子，链上挂着炮弹一发发往上送（动画）。机械味最足；1× 下细节偏多。',
      draw(x, y, o) {
        R(x + 2, y + 1, 3, 22, P.iron[0]); R(x + 3, y + 1, 1, 22, P.iron[3]);
        R(x + 19, y + 1, 3, 22, P.iron[0]); R(x + 20, y + 1, 1, 22, P.iron[3]);
        box(x + 1, y + 20, 22, 4, DARK);
        for (const cy of [5, 17]) { disc(x + 10, y + cy, 3.5, P.brass[0]); disc(x + 10, y + cy, 2.5, P.brass[2]); px(x + 9, y + cy - 1, P.brass[3]); }
        R(x + 6, y + 5, 1, 12, P.dark[0]); R(x + 13, y + 5, 1, 12, P.dark[0]);
        for (let i = 0; i < 12; i += 2) { px(x + 6, y + 5 + ((i + o.t) % 12), P.iron[3]); px(x + 13, y + 16 - ((i + o.t) % 12), P.iron[3]); }
        for (let i = 0; i < 2; i++) { const yy = y + 16 - ((o.t + i * 6) % 12); R(x + 14, yy, 4, 2, P.brass[2]); px(x + 18, yy, P.iron[3]); px(x + 18, yy + 1, P.iron[3]); }
      },
    },
  ]);

  add('rangefinder', 'early', '测距仪（直射散布更小）。一战的合像测距仪是一根两头带镜片的长横管，这是最有辨识度的形状。', [
    {
      key: 'A', name: '合像测距仪', idea: '一根横贯整格的测距管，两头玻璃镜片，中间朝下的目镜，架在小立柱上。「一根横杆两头发亮」在 1× 下也认得出。',
      draw(x, y, o) {
        box(x + 5, y + 19, 14, 5, DARK);
        R(x + 11, y + 13, 2, 7, P.iron[2]); px(x + 11, y + 13, P.iron[4]);
        tube(x, y + 5, 24, 7); hoop(x + 5, y + 5, 7); hoop(x + 17, y + 5, 7);
        R(x, y + 6, 2, 5, P.glass[1]); px(x, y + 6, P.glass[3]); R(x + 22, y + 6, 2, 5, P.glass[1]); px(x + 22, y + 6, P.glass[3]);
        R(x + 10, y + 11, 4, 3, P.iron[0]); R(x + 11, y + 12, 2, 1, P.glass[2]);
        if (o.t % 24 < 2) { px(x + 1, y + 7, P.white); px(x + 23, y + 7, P.white); }
      },
    },
    {
      key: 'B', name: '刻度表盘', idea: '铁箱正面一只大刻度盘，指针随瞄准晃动，左上角一支小镜筒。读起来更像「仪表」，和压力表容易混，要靠镜筒区分。',
      draw(x, y, o) {
        box(x + 1, y + 4, 22, 20, IRON);
        R(x + 3, y + 1, 9, 4, P.iron[0]); R(x + 4, y + 2, 7, 2, P.brass[2]); R(x + 3, y + 2, 1, 2, P.glass[2]);
        disc(x + 13, y + 14, 8, P.brass[0]); disc(x + 13, y + 14, 7, P.steam[2]);
        for (let a = 0; a < 7; a++) { const ang = Math.PI * (0.8 + a * 0.23); px(Math.round(x + 12.5 + Math.cos(ang) * 5.5), Math.round(y + 13.5 + Math.sin(ang) * 5.5), P.dark[0]); }
        const v = Math.PI * (1.3 + 0.35 * Math.sin(o.t * 0.4));
        line(x + 13, y + 14, Math.round(x + 13 + Math.cos(v) * 5), Math.round(y + 14 + Math.sin(v) * 5), 1, P.fire[1]);
        disc(x + 13, y + 14, 1, P.brass[1]);
      },
    },
    {
      key: 'C', name: '双筒测距镜', idea: '一对上下叠放的镜筒架在转轴上，前端两块镜片。像双筒望远镜，友好好认，但和观察镜 B 有点像。',
      draw(x, y, o) {
        box(x + 4, y + 20, 16, 4, DARK); R(x + 11, y + 14, 2, 7, P.iron[2]);
        tube(x + 3, y + 3, 18, 5); tube(x + 3, y + 9, 18, 5);
        R(x + 9, y + 2, 4, 13, P.brass[0]); R(x + 10, y + 3, 2, 11, P.brass[2]);
        for (const yy of [4, 10]) { R(x + 21, y + yy, 2, 3, P.glass[1]); px(x + 21, y + yy, P.glass[3]); R(x + 1, y + yy, 2, 3, P.brass[1]); }
      },
    },
  ]);

  add('gyroscope', 'early', '陀螺仪（车身晃动更小）。要和真双足胯里的黄铜陀螺仪是同一种语言（黄铜环 + 转子），转子一直在转。', [
    {
      key: 'A', name: '万向环', idea: '立柱上一只黄铜外环，里面的内环不停翻转（动画），中心是转子。剪影是一个圆环，在方块堆里最显眼。',
      draw(x, y, o) {
        box(x + 4, y + 20, 16, 4, DARK); R(x + 11, y + 17, 2, 4, P.iron[2]);
        ring(x + 12, y + 10, 9.5, 9.5, P.brass[0]); ring(x + 12, y + 10, 8.5, 8.5, P.brass[2]);
        const rx = 1 + Math.abs(Math.cos(o.t * 0.35)) * 6.5;
        ring(x + 12, y + 10, rx, 6.5, P.brass[3]); ring(x + 12, y + 10, Math.max(0.5, rx - 1), 5.5, P.brass[1]);
        disc(x + 12, y + 10, 2.5, P.iron[0]); disc(x + 12, y + 10, 1.8, P.iron[3]);
        px(x + 12 + ((o.t % 4) - 2), y + 10, P.iron[4]);
        R(x + 12, y, 1, 2, P.brass[1]);
      },
    },
    {
      key: 'B', name: '陀螺舱窗', idea: '铁箱正面一扇圆玻璃窗，窗里黄铜转子高速旋转（高光带扫过），和真双足胯上的陀螺仪窗一模一样的语言。',
      draw(x, y, o) {
        box(x + 1, y + 1, 22, 22, IRON);
        for (const [a, b] of [[3, 3], [19, 3], [3, 19], [19, 19]]) rivet(x + a, y + b);
        disc(x + 12, y + 12, 8, P.brass[0]); disc(x + 12, y + 12, 7, P.brass[2]); disc(x + 12, y + 12, 6, P.glass[0]);
        R(x + 7, y + 10, 11, 4, P.brass[0]); R(x + 7, y + 11, 11, 2, P.brass[2]);
        const s = x + 7 + (o.t * 3) % 11; R(s, y + 11, 2, 2, P.brass[3]);
        R(x + 12, y + 6, 1, 12, P.iron[3]);
        px(x + 9, y + 8, P.glass[3]);
      },
    },
    {
      key: 'C', name: '飞轮笼', idea: '铁笼里一只侧看成扁椭圆的重飞轮绕竖轴转（刻痕移动），上下黄铜轴承。更「重工业」，强调「稳」。',
      draw(x, y, o) {
        R(x + 2, y + 2, 2, 20, P.iron[0]); R(x + 20, y + 2, 2, 20, P.iron[0]); R(x + 3, y + 2, 1, 20, P.iron[3]); R(x + 21, y + 2, 1, 20, P.iron[3]);
        box(x + 1, y + 1, 22, 3, IRON); box(x + 1, y + 20, 22, 4, IRON);
        R(x + 11, y + 4, 2, 16, P.brass[1]); px(x + 11, y + 4, P.brass[3]);
        disc(x + 12, y + 5, 2, P.brass[2]); disc(x + 12, y + 19, 2, P.brass[2]);
        R(x + 4, y + 10, 16, 5, P.iron[0]); R(x + 5, y + 11, 14, 3, P.iron[2]); R(x + 5, y + 11, 14, 1, P.iron[4]);
        for (let i = 0; i < 14; i += 4) px(x + 5 + ((i + o.t) % 14), y + 12, P.iron[0]);
      },
    },
  ]);
})();
