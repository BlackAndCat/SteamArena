// 中期模块造型候选：蓄压罐、散热片、双人驾驶舱、双联机枪、鱼叉、喷火器、蒸汽喷射器、火箭架、重炮（见 cand-kit.js）
(() => {
  const { P, R, px, clr, disc, ring, line, box, rivet, arch, bolted, gauge, tube, hoop, flash, puff, porthole, pilot, turn, IRON, IRONL, DARK, BRASS, SOOT_CO, add } = SA.CAND;
  const rc = (o) => Math.round(o.k * (o.m.rcPx || 0));
  const vcyl = (x, y, w, h) => { R(x, y, w, h, P.iron[0]); R(x + 1, y + 1, w - 2, h - 2, P.iron[2]); R(x + 1, y + 1, 2, h - 2, P.iron[3]); px(x + 2, y + 2, P.iron[4]); R(x + w - 2, y + 1, 1, h - 2, P.iron[1]); };
  const dome = (cx, top, rad, bottom) => { arch(cx, top, bottom, rad, P.iron[0]); arch(cx, top + 1, bottom, rad - 1, P.iron[2]); arch(cx - 1, top + 2, top + rad, Math.max(1, rad - 3), P.iron[3]); };
  // 喷口上的引燃火苗（火力 / 能源语义，只有 2～3 像素）
  const pilotFlame = (x, y, t) => { px(x, y, P.fire[t % 3 === 0 ? 3 : 2]); px(x + 1, y - (t % 2), P.fire[2]); if (t % 4 < 2) px(x + 1, y + 1, P.fire[1]); };

  // ---------- 蓄压罐 1×2：储蒸汽，不发光 ----------
  add('pressure_tank', 'mid', '要点：储能，用「动力」语义（压力表 + 蒸汽白），存量要看得见（这里用 lv 表示存量，60%）。要和 1×2 高水罐分开：水罐有青色水位窗，蓄压罐没有青色。', [
    {
      key: 'A', name: '立式气瓶', idea: '一只高高的铆接气瓶，上下圆顶，两道黄铜箍，腰上一只大压力表显示存量，瓶顶一只阀门。最直观。',
      draw(x, y, o) {
        R(x + 10, y, 4, 3, P.brass[1]); px(x + 10, y, P.brass[3]);
        dome(x + 12, y + 2, 9, y + 12);
        vcyl(x + 3, y + 10, 18, 30);
        arch(x + 12, y + 36, y + 47, 9, P.iron[0]); R(x + 4, y + 36, 16, 9, P.iron[2]); R(x + 4, y + 36, 2, 9, P.iron[3]);
        R(x + 3, y + 45, 18, 2, P.dark[1]);
        for (const by of [14, 36]) { R(x + 3, y + by, 18, 2, P.brass[1]); R(x + 3, y + by, 18, 1, P.brass[3]); }
        for (let yy = y + 18; yy < y + 34; yy += 3) px(x + 5, yy, P.iron[4]);
        gauge(x + 13, y + 25, 5, o.lv);
      },
    },
    {
      key: 'B', name: '双瓶组', idea: '两只细长气瓶并排，顶上一根黄铜汇流管和一只表。像潜水气瓶，「成组储备」的感觉；剪影是两根竖条。',
      draw(x, y, o) {
        R(x + 3, y + 5, 18, 3, P.brass[0]); R(x + 3, y + 5, 18, 2, P.brass[2]); R(x + 3, y + 5, 18, 1, P.brass[3]);
        R(x + 11, y + 2, 2, 4, P.brass[1]); gauge(x + 12, y + 3, 3, o.lv);
        for (const cx of [2, 13]) { dome(x + cx + 4.5, y + 8, 4, y + 14); vcyl(x + cx, y + 12, 9, 33); for (const by of [20, 36]) { R(x + cx, y + by, 9, 2, P.brass[1]); R(x + cx, y + by, 9, 1, P.brass[3]); } }
        R(x + 1, y + 45, 22, 3, P.dark[1]); R(x + 1, y + 45, 22, 1, P.dark[3]);
      },
    },
    {
      key: 'C', name: '储气球 + 液柱表', idea: '顶上一只储气球，下面的立管上开一道竖窗，里面的绿色液柱就是存量（高低一眼可见），底座一只安全阀。存量表达最清楚。',
      draw(x, y, o) {
        disc(x + 12, y + 11, 10, P.iron[0]); disc(x + 12, y + 11, 9, P.iron[2]); disc(x + 10, y + 9, 5, P.iron[3]); px(x + 7, y + 6, P.iron[4]);
        R(x + 3, y + 11, 18, 1, P.iron[1]); for (let i = 4; i < 21; i += 3) px(x + i, y + 12, P.iron[4]);
        R(x + 8, y + 20, 8, 18, P.iron[0]); R(x + 9, y + 21, 6, 16, P.glass[0]);
        const h = Math.round(16 * o.lv); R(x + 9, y + 37 - h, 6, h, P.gauge[1]); R(x + 9, y + 37 - h, 6, 1, P.gauge[3]);
        for (let yy = y + 23; yy < y + 37; yy += 4) px(x + 14, yy, P.steam[1]);
        box(x + 2, y + 37, 20, 11, IRON); rivet(x + 4, y + 40); rivet(x + 18, y + 40);
        R(x + 18, y + 33, 3, 4, P.brass[1]);
        if (o.t % 20 < 5) puff(x + 19, y + 33, o.t, 2);
      },
    },
  ]);

  // ---------- 散热片 1×2（侧挂层）：镂空格栅 ----------
  add('radiator', 'mid', '要点：侧挂层——必须有铆接支架把它撑在主体外面、自带一圈暗描边；「镂空」要真的透出后面的车体（这里的空隙是透明的，车体里那张图能看到）。冷却语义：青色只在进出水的集管上。', [
    {
      key: 'A', name: '横格栅', idea: '一片铁框里排满横向散热片，片与片之间是空的；上下两根青色集管，左边两条铆接支架。最像汽车散热器。',
      draw(x, y, o) {
        for (const by of [9, 37]) { R(x, y + by, 6, 4, P.dark[0]); R(x + 1, y + by + 1, 5, 2, P.dark[3]); px(x + 2, y + by + 1, P.iron[4]); }
        R(x + 4, y + 1, 20, 46, P.dark[0]);
        clr(x + 7, y + 6, 14, 36);
        R(x + 5, y + 2, 18, 4, P.iron[2]); R(x + 5, y + 3, 18, 2, P.water[1]); R(x + 5, y + 3, 18, 1, P.water[2]);
        R(x + 5, y + 42, 18, 4, P.iron[2]); R(x + 5, y + 43, 18, 2, P.water[1]); R(x + 5, y + 43, 18, 1, P.water[2]);
        R(x + 5, y + 6, 2, 36, P.iron[3]); R(x + 21, y + 6, 2, 36, P.iron[1]);
        for (let yy = y + 7; yy < y + 41; yy += 3) { R(x + 7, yy, 14, 1, P.iron[3]); px(x + 7, yy, P.iron[4]); }
      },
    },
    {
      key: 'B', name: '翅片管', idea: '三根竖直的冷却管，每根套着一圈圈短翅片，管与管之间镂空；上下黄铜集箱。像蒸汽机车上的散热管排。',
      draw(x, y, o) {
        for (const by of [9, 37]) { R(x, y + by, 6, 4, P.dark[0]); R(x + 1, y + by + 1, 5, 2, P.dark[3]); }
        box(x + 4, y + 1, 20, 6, BRASS); box(x + 4, y + 41, 20, 6, BRASS);
        R(x + 7, y + 1, 3, 2, P.water[2]); R(x + 18, y + 45, 3, 2, P.water[2]);
        for (const tx of [6, 12, 18]) {
          R(x + tx + 1, y + 7, 2, 34, P.dark[0]); R(x + tx + 1, y + 7, 1, 34, P.water[1]);
          for (let yy = y + 8; yy < y + 40; yy += 3) { R(x + tx, yy, 4, 1, P.iron[3]); px(x + tx + 3, yy, P.iron[1]); }
        }
      },
    },
    {
      key: 'C', name: '蜂窝芯', idea: '铁框里是一整块打满小孔的蜂窝散热芯（孔是透的），右上角一只温度表。最「精密」，但 1× 下孔会糊成灰面。',
      draw(x, y, o) {
        for (const by of [9, 37]) { R(x, y + by, 6, 4, P.dark[0]); R(x + 1, y + by + 1, 5, 2, P.dark[3]); }
        box(x + 4, y + 1, 20, 46, IRON);
        R(x + 6, y + 8, 16, 32, P.iron[2]);
        for (let r = 0; r < 11; r++) for (let c = 0; c < 4; c++) { const hx = x + 7 + c * 4 + (r % 2) * 2, hy = y + 9 + r * 3; if (hx + 2 <= x + 22) { clr(hx, hy, 2, 2); px(hx, hy + 2, P.iron[3]); } }
        R(x + 6, y + 4, 12, 2, P.water[1]); R(x + 6, y + 4, 12, 1, P.water[2]);
        R(x + 6, y + 42, 16, 2, P.water[1]);
        gauge(x + 20, y + 5, 2.5, 0.35);
      },
    },
  ]);

  // ---------- 联合驾驶舱（双人）1×2 ----------
  add('cockpit_pair', 'mid', '要点：驾驶舱 = 黄铜拱门剖面 + 舱里的小炭球驾驶员（驾驶员保持 1×1 大小，不放大）；两个人都要看得见。要和 1×1 驾驶舱、2×2 四人舱是一家。', [
    {
      key: 'A', name: '双层舷窗', idea: '一只高铁舱，黄铜拱顶，上下两个舷窗各坐一个炭球，中间一根黄铜传声管。和四人舱的画法完全一致，最稳。',
      draw(x, y, o) {
        box(x + 1, y + 5, 22, 42, IRON);
        arch(x + 12, y + 1, y + 12, 11, P.brass[0]); arch(x + 12, y + 2, y + 12, 10, P.brass[2]); arch(x + 12, y + 4, y + 12, 8, P.iron[2]);
        for (let a = 0; a <= 6; a++) { const ang = Math.PI + a / 6 * Math.PI; px(Math.round(x + 12 + Math.cos(ang) * 9.5), Math.round(y + 12 + Math.sin(ang) * 9.5), P.brass[3]); }
        R(x + 18, y + 18, 2, 14, P.brass[1]); R(x + 18, y + 18, 1, 14, P.brass[2]);
        porthole(x + 11, y + 15, o.t, 0); porthole(x + 11, y + 35, o.t, 1, SOOT_CO);
        gauge(x + 19, y + 25, 2.5, 0.5);
        rivet(x + 3, y + 43); rivet(x + 19, y + 43);
      },
    },
    {
      key: 'B', name: '驾驶塔', idea: '上面是 1×1 驾驶舱同款的铁头盔 + 舷窗（驾驶员），下面一层宽一点的指挥室，方窗里坐着副驾驶，左边一架小梯子。「两层楼」的剪影。',
      draw(x, y, o) {
        arch(x + 12, y + 2, y + 22, 10, P.iron[0]); arch(x + 12, y + 3, y + 21, 9, P.iron[2]);
        R(x + 2, y + 18, 20, 4, P.brass[0]); R(x + 3, y + 18, 18, 3, P.brass[1]); R(x + 3, y + 18, 18, 1, P.brass[3]);
        porthole(x + 13, y + 11, o.t, 0);
        box(x + 1, y + 22, 22, 26, IRON);
        R(x + 5, y + 26, 15, 13, P.brass[0]); R(x + 6, y + 27, 13, 11, P.glass[0]);
        pilot(x + 12, y + 32, (Math.floor(o.t / 3) + 1) % 4, true, SOOT_CO); px(x + 7, y + 28, P.glass[3]);
        line(x + 15, y + 36, x + 17, y + 31, 1, P.brass[2]); px(x + 17, y + 30, P.fire[2]);
        for (let yy = y + 26; yy < y + 46; yy += 3) R(x + 2, yy, 2, 1, P.iron[4]);
        rivet(x + 19, y + 42);
      },
    },
    {
      key: 'C', name: '纵列座舱', idea: '一整扇高高的拱形玻璃窗，里面前后（上下）坐两个炭球，一个开车一个看表。最通透、最有「坐了两个人」的感觉，但窗子大，受击面读起来也大。',
      draw(x, y, o) {
        box(x + 1, y + 1, 22, 46, IRON);
        arch(x + 12, y + 3, y + 42, 9, P.brass[0]); arch(x + 12, y + 4, y + 41, 8, P.brass[2]); arch(x + 12, y + 6, y + 40, 6, P.glass[0]);
        R(x + 6, y + 24, 12, 1, P.brass[1]);
        pilot(x + 12, y + 15, Math.floor(o.t / 3) % 4, true);
        pilot(x + 12, y + 32, (Math.floor(o.t / 3) + 2) % 4, false, SOOT_CO);
        px(x + 8, y + 10, P.glass[3]); px(x + 8, y + 27, P.glass[2]);
        R(x + 4, y + 43, 16, 2, P.brass[1]);
        rivet(x + 3, y + 3); rivet(x + 19, y + 3);
      },
    },
  ]);

  // ---------- 双联机枪 2×2：耳轴 (34,29)，枪口长 26 ----------
  const mgBase = (x, y) => { box(x + 3, y + 16, 40, 29, IRON); R(x + 4, y + 39, 38, 1, P.brass[2]); R(x + 4, y + 40, 38, 1, P.brass[1]); rivet(x + 6, y + 19); rivet(x + 6, y + 35); };
  const belt = (x, y, n, t) => { for (let i = 0; i < n; i++) { const bx = x + ((i * 4 + t) % (n * 4)); R(bx, y, 3, 4, P.dark[0]); R(bx, y, 2, 3, P.brass[2]); px(bx, y, P.brass[3]); } };
  add('mg2', 'mid', '要点：必须和机枪（一门三根短管 + 弹鼓）分开：双联是「两门并在一起」——两根更粗的枪管、两条弹链。枪口伸出 1/4 格左右（比火炮短）。', [
    {
      key: 'A', name: '水冷双联', idea: '维克斯式：一只黄铜机匣，伸出上下两根带散热孔的粗水冷套筒，前端细枪口；两条弹链从左边弹箱喂进去。',
      draw(x, y, o) {
        mgBase(x, y);
        box(x + 7, y + 22, 14, 11, IRONL); R(x + 8, y + 26, 12, 1, P.iron[1]); R(x + 12, y + 24, 4, 2, P.brass[2]); belt(x + 8, y + 42, 5, o.t % 4);
        const d = rc(o);
        turn(x + 34, y + 29, o.a, (X, Y) => {
          box(X - 12, Y - 12, 16, 24, BRASS); R(X - 10, Y - 10, 1, 20, P.brass[3]);
          for (const yy of [Y - 9, Y + 2]) {
            tube(X + 4 - d, yy, 16, 7); for (let i = X + 6 - d; i < X + 19 - d; i += 3) px(i, yy + 3, P.iron[0]);
            tube(X + 20 - d, yy + 2, 6, 3); R(X + 24 - d, yy + 1, 2, 5, P.iron[0]);
            if (o.k >= 0.6) R(X + 26 - d, yy + 2, 3, 3, P.fire[3]);
          }
        });
        disc(x + 34, y + 29, 3, P.brass[0]); disc(x + 34, y + 29, 2, P.brass[2]);
      },
    },
    {
      key: 'B', name: '防盾双联', idea: '马克沁式：两根枪管从一块带观察缝的弧形防盾里伸出来，底下弹药箱。防盾让它比机枪「重」一级，剪影也不一样。',
      draw(x, y, o) {
        box(x + 4, y + 34, 32, 11, IRON); box(x + 8, y + 26, 14, 9, DARK); R(x + 10, y + 28, 10, 1, P.brass[2]);
        belt(x + 10, y + 40, 4, o.t % 4);
        const d = rc(o);
        turn(x + 34, y + 29, o.a, (X, Y) => {
          box(X - 14, Y - 9, 16, 18, IRON);
          for (const yy of [Y - 7, Y + 3]) { tube(X - d, yy, 22, 5); hoop(X + 12 - d, yy, 5); R(X + 22 - d, yy - 1, 3, 7, P.iron[0]); if (o.k >= 0.6) R(X + 25 - d, yy + 1, 3, 3, P.fire[3]); }
        });
        for (let yy = 12; yy <= 44; yy++) { const xs = x + 36 + Math.round(Math.pow((yy - 28) / 16, 2) * 3); R(xs, y + yy, 5, 1, P.iron[2]); px(xs, y + yy, P.iron[4]); px(xs + 4, y + yy, P.iron[0]); }
        R(x + 36, y + 11, 5, 1, P.iron[0]); R(x + 37, y + 18, 3, 1, P.dark[0]);
        rivet(x + 37, y + 14); rivet(x + 37, y + 40);
      },
    },
    {
      key: 'C', name: '盘式双联', idea: '刘易斯式：两挺上下叠放，顶上各压一只扁圆盘式弹匣（会转），枪管套着带纵肋的粗散热筒。弹盘是最独特的剪影。',
      draw(x, y, o) {
        mgBase(x, y);
        const d = rc(o);
        turn(x + 34, y + 29, o.a, (X, Y) => {
          for (const [yy, s] of [[Y - 8, 0], [Y + 3, 1]]) {
            box(X - 16, yy, 18, 6, BRASS);
            R(X - 13, yy - 3, 13, 3, P.dark[0]); R(X - 12, yy - 3, 11, 2, P.iron[2]); px(X - 12 + ((o.t + s * 3) % 11), yy - 3, P.iron[4]);
            R(X + 2 - d, yy - 1, 16, 8, P.iron[0]); R(X + 3 - d, yy, 14, 6, P.iron[2]);
            for (let i = X + 4 - d; i < X + 17 - d; i += 2) R(i, yy, 1, 6, P.iron[3]);
            tube(X + 18 - d, yy + 1, 8, 4); if (o.k >= 0.6) R(X + 26 - d, yy + 1, 3, 3, P.fire[3]);
          }
        });
        disc(x + 34, y + 29, 2.5, P.brass[2]);
      },
    },
  ]);

  // ---------- 鱼叉 2×1：耳轴 (18,13)，叉头在耳轴前 34 ----------
  const rope = P.leather[2];
  add('harpoon', 'mid', '要点：叉头（带倒钩）必须露在炮口外面，叉尖就在炮口点上；要有绳索——命中后是「收绳牵引」，绳子是它和普通火炮的根本区别。', [
    {
      key: 'A', name: '捕鲸炮', idea: '捕鲸船的转轴炮：炮管前端插着一支带倒钩的鱼叉，后面一只缠满绳子的绳轮，绳子一路连到叉尾。',
      draw(x, y, o) {
        box(x + 1, y + 19, 34, 5, IRON);
        box(x + 14, y + 14, 8, 6, DARK);
        disc(x + 6, y + 12, 6, P.dark[0]); disc(x + 6, y + 12, 5, P.leather[1]);
        for (let i = -4; i <= 4; i += 2) R(x + 2, y + 12 + i, 9, 1, rope);
        disc(x + 6, y + 12, 1.5, P.brass[2]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - 6 - d, Y - 3, 24, 6); hoop(X + 2 - d, Y - 3, 6);
          R(X + 18 - d, Y - 1, 10, 2, P.iron[4]); px(X + 18 - d, Y, P.iron[2]);
          for (let i = 0; i < 6; i++) { const hh = 3 - Math.floor(i / 2); R(X + 28 + i - d, Y - hh, 1, hh * 2, P.iron[3]); px(X + 28 + i - d, Y - hh, P.iron[4]); }
          line(X + 29 - d, Y - 3, X + 27 - d, Y - 5, 1, P.iron[3]); line(X + 29 - d, Y + 2, X + 27 - d, Y + 4, 1, P.iron[3]);
          line(X - 12, Y + 1, X - 6 - d, Y + 1, 1, rope);
        });
        disc(x + 18, y + 13, 2.5, P.brass[0]); disc(x + 18, y + 13, 1.5, P.brass[2]);
      },
    },
    {
      key: 'B', name: '弩炮', idea: '一架大弩：前端一副弹簧钢弓臂，弓弦拉在叉尾；鱼叉躺在导轨上，尾部一只黄铜绞盘收绳。剪影最特别（竖着的弓），但更像中世纪。',
      draw(x, y, o) {
        box(x + 1, y + 19, 30, 5, IRON); box(x + 14, y + 14, 8, 6, DARK);
        disc(x + 5, y + 14, 4, P.brass[0]); disc(x + 5, y + 14, 3, P.brass[2]); line(x + 5, y + 14, x + 5 + ((o.t % 2) ? 3 : 0), y + 14 - ((o.t % 2) ? 0 : 3), 1, P.brass[3]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          R(X - 10, Y + 1, 30, 3, P.dark[0]); R(X - 10, Y + 1, 30, 1, P.dark[3]);
          for (let i = -10; i <= 10; i++) { const bx = X + 18 - Math.round(i * i / 20); px(bx, Y + i, P.iron[0]); px(bx - 1, Y + i, P.iron[3]); }
          const pull = d ? 0 : 4;
          line(X + 13, Y - 10, X + 4 + pull - d, Y, 1, P.steam[1]); line(X + 13, Y + 10, X + 4 + pull - d, Y, 1, P.steam[1]);
          R(X + 4 - d, Y - 1, 24, 2, P.iron[4]);
          for (let i = 0; i < 6; i++) { const hh = 3 - Math.floor(i / 2); R(X + 28 + i - d, Y - hh, 1, hh * 2, P.iron[3]); }
          line(X - 12, Y, X + 4 - d, Y, 1, rope);
        });
      },
    },
    {
      key: 'C', name: '绞盘鱼叉', idea: '一只占了半个模块的大黄铜绞盘（缠满绳子），前面一根短炮管射出带钩爪的鱼叉。「收绳」这件事最显眼。',
      draw(x, y, o) {
        box(x + 1, y + 4, 22, 20, IRON);
        R(x + 3, y + 7, 18, 14, P.brass[0]); R(x + 4, y + 8, 16, 12, P.leather[1]);
        for (let yy = y + 8; yy < y + 20; yy += 2) R(x + 4, yy, 16, 1, rope);
        R(x + 3, y + 6, 2, 16, P.brass[2]); R(x + 19, y + 6, 2, 16, P.brass[2]);
        const sp = o.t % 4; R(x + 4, y + 8 + sp * 3, 16, 1, P.leather[2]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - d, Y - 3, 20, 6); hoop(X + 6 - d, Y - 3, 6);
          R(X + 20 - d, Y - 1, 8, 2, P.iron[4]);
          line(X + 28 - d, Y, X + 34 - d, Y - 4, 1, P.iron[3]); line(X + 28 - d, Y, X + 34 - d, Y + 4, 1, P.iron[3]); line(X + 28 - d, Y, X + 34 - d, Y, 1, P.iron[4]);
        });
      },
    },
  ]);

  // ---------- 喷火器 2×1：喷口在耳轴前 30 ----------
  add('flamer', 'mid', '要点：燃料罐 + 软管 + 喷口，喷口上一小簇引燃火苗（火力 / 能源语义，只有两三个像素，不算「发光的大面积」）。要和蒸汽喷射器分开：喷火器 = 燃料罐（红色警示带）+ 火苗；喷射器 = 阀门 + 白汽。', [
    {
      key: 'A', name: '双罐喷枪', idea: '左边两只立着的燃料罐（红色警示带），一根软管接到喷枪，喷口一簇小火苗在跳。最写实的一战喷火器。',
      draw(x, y, o) {
        for (const cx of [1, 8]) { vcyl(x + cx, y + 4, 7, 19); R(x + cx, y + 9, 7, 2, P.fire[1]); R(x + cx + 2, y + 2, 3, 2, P.brass[1]); }
        box(x + 14, y + 16, 9, 8, DARK);
        line(x + 11, y + 21, x + 16, y + 17, 2, P.dark[0]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - 4 - d, Y - 2, 26, 5); hoop(X + 4 - d, Y - 2, 5);
          for (let i = 0; i < 8; i++) { const hh = 2 - Math.floor(i / 4); R(X + 22 + i - d, Y - hh, 1, hh * 2 + 1, P.iron[0]); if (hh) R(X + 22 + i - d, Y - hh + 1, 1, hh * 2 - 1, P.iron[3]); }
          pilotFlame(X + 30 - d, Y, o.t);
          if (o.k >= 0.6) { R(X + 30 - d, Y - 2, 4, 5, P.fire[2]); R(X + 31 - d, Y - 1, 3, 3, P.fire[3]); }
        });
        disc(x + 18, y + 13, 2, P.brass[2]);
      },
    },
    {
      key: 'B', name: '喷火塔', idea: '一座小炮塔，顶上压一只带红带的燃料球，伸出一根套着散热环的粗喷管。像一门「火炮」，读起来更重、更有威胁。',
      draw(x, y, o) {
        box(x + 2, y + 9, 26, 15, IRON); rivet(x + 5, y + 12); R(x + 3, y + 20, 24, 1, P.brass[2]);
        disc(x + 9, y + 7, 6, P.iron[0]); disc(x + 9, y + 7, 5, P.iron[2]); R(x + 4, y + 6, 10, 2, P.fire[1]); px(x + 7, y + 4, P.iron[4]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - d, Y - 3, 27, 7);
          for (let i = X + 6 - d; i < X + 24 - d; i += 4) R(i, Y - 4, 1, 9, P.dark[0]);
          R(X + 27 - d, Y - 2, 3, 5, P.iron[0]); px(X + 29 - d, Y, P.dark[0]);
          pilotFlame(X + 30 - d, Y, o.t);
          if (o.k >= 0.6) { R(X + 30 - d, Y - 2, 4, 5, P.fire[2]); R(X + 31 - d, Y - 1, 3, 3, P.fire[3]); }
        });
      },
    },
    {
      key: 'C', name: '龙首喷口', idea: '喷管末端是一只张着嘴的黄铜龙首，火苗从龙嘴里冒出来；下面卧一只燃料罐。维多利亚装饰味，Boss 或唯一件也可以用这个方向。',
      draw(x, y, o) {
        R(x + 2, y + 16, 22, 7, P.iron[0]); R(x + 3, y + 17, 20, 5, P.iron[2]); R(x + 3, y + 17, 20, 1, P.iron[3]); R(x + 10, y + 16, 3, 7, P.fire[1]);
        box(x + 14, y + 11, 8, 7, DARK);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - 6 - d, Y - 2, 22, 5);
          const hx = X + 16 - d;
          R(hx, Y - 5, 10, 5, P.brass[0]); R(hx + 1, Y - 4, 9, 3, P.brass[2]); R(hx + 1, Y - 4, 9, 1, P.brass[3]);
          R(hx + 9, Y - 4, 4, 2, P.brass[2]); px(hx + 12, Y - 3, P.brass[0]);
          px(hx + 5, Y - 3, P.fire[2]);
          R(hx, Y + 1, 12, 3, P.brass[0]); R(hx + 1, Y + 1, 10, 2, P.brass[1]);
          for (const tx of [7, 10]) { px(hx + tx, Y - 1, P.white); px(hx + tx, Y, P.white); }
          R(hx + 11, Y - 1, 3, 2, P.dark[0]);
          pilotFlame(hx + 13, Y, o.t);
          if (o.k >= 0.6) { R(X + 29 - d, Y - 2, 4, 5, P.fire[2]); R(X + 30 - d, Y - 1, 3, 3, P.fire[3]); }
        });
      },
    },
  ]);

  // ---------- 蒸汽喷射器 2×1 ----------
  add('steamjet', 'mid', '要点：喷蒸汽（加热 + 击退），语义是蒸汽白 + 压力表；喷口一直往外冒一点白汽（动画）。不能有火苗和红色，免得和喷火器混。', [
    {
      key: 'A', name: '扇形喷汽阀', idea: '阀体上顶一只黄铜手轮，直管末端是压扁的扇形喷嘴，嘴口一直冒白汽。「阀门 + 扁嘴」一看就是放汽的。',
      draw(x, y, o) {
        box(x + 2, y + 12, 20, 12, IRON); gauge(x + 7, y + 17, 3, 0.7);
        R(x + 11, y + 6, 2, 7, P.iron[2]);
        ring(x + 12, y + 5, 5, 1.5, P.brass[2]); R(x + 7, y + 5, 11, 1, P.brass[1]); px(x + 12, y + 5, P.brass[3]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - 4 - d, Y - 2, 26, 5); hoop(X + 6 - d, Y - 2, 5);
          for (let i = 0; i < 8; i++) { const hh = 2 + Math.floor(i / 2); R(X + 22 + i - d, Y - hh, 1, hh * 2 + 1, P.iron[0]); R(X + 22 + i - d, Y - hh + 1, 1, hh * 2 - 1, P.iron[3]); }
          R(X + 29 - d, Y - 4, 1, 9, P.dark[0]);
          for (let i = 0; i < 3; i++) { const p = (o.t + i * 2) % 6; px(X + 31 + p - d, Y - 3 + i * 3 + (p >> 1) * (i - 1), P.steam[p < 3 ? 2 : 1]); }
          if (o.k >= 0.6) { R(X + 30 - d, Y - 4, 5, 9, P.steam[1]); R(X + 31 - d, Y - 3, 4, 7, P.steam[2]); }
        });
      },
    },
    {
      key: 'B', name: '汽笛喇叭', idea: '一根直管接一只大喇叭口，管根上立着一只带排气槽的汽笛筒。像船上的汽笛，「嘟——」的感觉最强。',
      draw(x, y, o) {
        box(x + 2, y + 14, 22, 10, IRON);
        R(x + 6, y + 3, 6, 12, P.brass[0]); R(x + 7, y + 3, 4, 12, P.brass[2]); R(x + 7, y + 3, 1, 12, P.brass[3]);
        for (const sy of [6, 9]) R(x + 7, y + sy, 4, 1, P.brass[0]);
        if (o.t % 12 < 5) puff(x + 9, y + 2, o.t, 2);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - 4 - d, Y - 2, 22, 5);
          for (let i = 0; i < 12; i++) { const hh = 2 + Math.round(i * i / 24); R(X + 18 + i - d, Y - hh, 1, hh * 2 + 1, P.brass[0]); R(X + 18 + i - d, Y - hh + 1, 1, hh * 2 - 1, P.brass[2]); px(X + 18 + i - d, Y - hh + 1, P.brass[3]); }
          R(X + 29 - d, Y - 6, 1, 13, P.dark[0]);
          if (o.k >= 0.6) { R(X + 30 - d, Y - 5, 5, 11, P.steam[1]); R(X + 31 - d, Y - 3, 4, 7, P.steam[2]); }
        });
      },
    },
    {
      key: 'C', name: '多孔喷头', idea: '管子末端是一只打满小孔的圆喷头（像淋浴莲蓬），机身正面一只大压力表。剪影在喷口处是一个圆盘，和任何炮都不一样。',
      draw(x, y, o) {
        box(x + 2, y + 8, 18, 16, IRON); gauge(x + 10, y + 15, 5, 0.55 + 0.1 * Math.sin(o.t));
        R(x + 14, y + 20, 8, 3, P.dark[1]);
        const d = rc(o);
        turn(x + 18, y + 13, o.a, (X, Y) => {
          tube(X - d, Y - 2, 25, 5); hoop(X + 8 - d, Y - 2, 5);
          R(X + 25 - d, Y - 6, 5, 13, P.iron[0]); R(X + 26 - d, Y - 5, 3, 11, P.iron[3]);
          for (let yy = -4; yy <= 4; yy += 2) px(X + 28 - d, Y + yy, P.dark[0]);
          if (o.t % 4 < 2) for (const yy of [-4, 0, 4]) px(X + 31 - d, Y + yy, P.steam[2]);
          if (o.k >= 0.6) { R(X + 30 - d, Y - 6, 5, 13, P.steam[1]); R(X + 31 - d, Y - 4, 4, 9, P.steam[2]); }
        });
      },
    },
  ]);

  // ---------- 火箭架 2×2：耳轴 (24,28)，炮口长 34 ----------
  const rocketTip = (x, y) => { px(x, y, P.fire[1]); px(x, y + 1, P.fire[0]); };
  add('rocket_rack', 'mid', '要点：四发齐射，要数得出「4」；火箭头用一点红色（炉火色的暗阶，不发光）。要和机枪、双联机枪的「管」区分：火箭管粗、短、能看到弹头。', [
    {
      key: 'A', name: '管束发射架', idea: '四根粗发射管捆成一束，黄铜箍扎紧，管口能看到红色弹头；装在一只带俯仰耳轴的炮座上。最现代（一战后期）的样子。',
      draw(x, y, o) {
        box(x + 3, y + 30, 40, 15, IRON); R(x + 4, y + 40, 38, 1, P.brass[2]); rivet(x + 6, y + 33); rivet(x + 38, y + 33);
        box(x + 18, y + 24, 12, 8, DARK);
        const d = rc(o);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          for (let i = 0; i < 4; i++) { const yy = Y - 13 + i * 6; tube(X - 18 - d, yy, 50, 6); R(X + 32 - d, yy + 1, 2, 4, P.black); rocketTip(X + 31 - d, yy + 2); }
          for (const hx of [X - 12, X + 4, X + 22]) { R(hx - d, Y - 14, 3, 26, P.brass[0]); R(hx - d, Y - 13, 3, 24, P.brass[2]); R(hx - d, Y - 13, 1, 24, P.brass[3]); }
          if (o.k >= 0.6) for (let i = 0; i < 4; i++) R(X - 22 - d, Y - 12 + i * 6, 4, 3, P.steam[2]);
        });
        disc(x + 24, y + 28, 3, P.brass[0]); disc(x + 24, y + 28, 2, P.brass[2]);
      },
    },
    {
      key: 'B', name: '康格里夫导轨', idea: '拿破仑时代的康格里夫火箭：一副梯形导轨上躺着四支带尾杆和尾翼的火箭，火箭头红黄相间。最「蒸汽朋克」，一眼知道是火箭而不是炮。',
      draw(x, y, o) {
        box(x + 3, y + 32, 40, 13, IRON); line(x + 12, y + 32, x + 22, y + 26, 2, P.dark[3]); line(x + 32, y + 32, x + 26, y + 26, 2, P.dark[3]);
        const d = rc(o);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          R(X - 20, Y - 11, 54, 2, P.dark[0]); R(X - 20, Y + 10, 54, 2, P.dark[0]);
          for (let rx = X - 18; rx < X + 32; rx += 6) R(rx, Y - 11, 1, 22, P.dark[2]);
          for (let i = 0; i < 4; i++) {
            const yy = Y - 8 + i * 5, back = i % 2 ? 4 : 0;
            R(X - 22 + back - d, yy + 1, 18, 1, P.leather[2]);
            tube(X - 4 + back - d, yy, 30, 4, [P.iron[0], P.iron[2], P.iron[3], P.iron[4]]);
            R(X + 26 + back - d, yy, 3, 4, P.fire[1]); px(X + 29 + back - d, yy + 1, P.brass[3]); px(X + 29 + back - d, yy + 2, P.brass[2]);
            px(X - 5 + back - d, yy - 1, P.iron[3]); px(X - 5 + back - d, yy + 4, P.iron[3]);
          }
          if (o.k >= 0.6) R(X - 26 - d, Y - 8, 6, 18, P.steam[1]);
        });
      },
    },
    {
      key: 'C', name: '蜂巢箱', idea: '一只方形发射箱，正面 2×2 四个圆孔露出红色弹头，箱盖向上掀开一道缝。最「箱子」，放在车体里很规整，但剪影和方块模块接近。',
      draw(x, y, o) {
        box(x + 3, y + 32, 40, 13, IRON); box(x + 18, y + 25, 12, 8, DARK);
        const d = rc(o);
        turn(x + 24, y + 28, o.a, (X, Y) => {
          box(X - 18 - d, Y - 12, 52, 24, IRON);
          line(X - 16 - d, Y - 13, X + 30 - d, Y - 17, 2, P.iron[0]); line(X - 16 - d, Y - 14, X + 30 - d, Y - 18, 1, P.iron[3]);
          R(X + 27 - d, Y - 11, 7, 22, P.iron[0]); R(X + 28 - d, Y - 10, 5, 20, P.iron[3]);
          for (const [dy] of [[-6], [5]]) for (const dx of [0, 0]) { disc(X + 30 - d, Y + dy, 3.5, P.black); rocketTip(X + 30 - d, Y + dy - 1); }
          for (let i = X - 14; i < X + 26; i += 8) { px(i - d, Y - 9, P.iron[4]); px(i - d, Y + 9, P.iron[4]); }
          R(X - 16 - d, Y - 1, 40, 1, P.brass[2]);
          if (o.k >= 0.6) R(X - 22 - d, Y - 8, 4, 16, P.steam[2]);
        });
      },
    },
  ]);

  // ---------- 重炮 2×4（48×96）：耳轴 (34,30)，炮口长 48 ----------
  add('cannon_heavy', 'mid', '要点：占四行的高个子——炮在最上面一层，下面三层是承重和供弹。炮口伸出格子 34px（比直射火炮长），要让人一眼知道「这是全车最大的炮」。外观分级是 A′（T4 一个、T5–6 一个），这里只画 T1 基础造型。', [
    {
      key: 'A', name: '炮塔 + 升弹井', idea: '上面一座斜装甲炮塔伸出长炮管，下面三层是一口带格栅的升弹井，炮弹一发发往上送（动画），右侧一道黄铜滑轨。「炮 + 弹药」的因果关系画在一张图里。',
      draw(x, y, o) {
        box(x + 4, y + 44, 40, 52, IRON);
        R(x + 10, y + 48, 22, 44, P.dark[0]); R(x + 11, y + 49, 20, 42, P.dark[1]);
        for (let i = 0; i < 3; i++) { const sy = y + 88 - ((o.t * 2 + i * 15) % 42); R(x + 14, sy, 10, 4, P.brass[1]); R(x + 14, sy, 10, 1, P.brass[3]); R(x + 24, sy, 4, 4, P.iron[3]); }
        for (let yy = y + 50; yy < y + 91; yy += 5) R(x + 11, yy, 20, 1, P.iron[2]);
        R(x + 35, y + 46, 3, 48, P.brass[1]); R(x + 35, y + 46, 1, 48, P.brass[3]);
        for (const ry of [50, 70, 90]) { rivet(x + 6, y + ry); rivet(x + 40, y + ry); }
        for (let yy = 12; yy <= 44; yy++) { const xs = x + 3 + Math.max(0, Math.round((22 - yy) * 0.5)); R(xs, y + yy, x + 45 - xs, 1, P.iron[2]); px(xs, y + yy, P.iron[4]); px(x + 44, y + yy, P.iron[0]); }
        R(x + 8, y + 11, 36, 1, P.iron[0]); R(x + 4, y + 44, 40, 1, P.iron[0]);
        R(x + 6, y + 38, 38, 2, P.brass[2]); R(x + 6, y + 39, 38, 1, P.brass[1]);
        const d = rc(o);
        turn(x + 34, y + 30, o.a, (X, Y) => {
          tube(X - 10 - d, Y - 5, 51, 10); hoop(X + 4 - d, Y - 6, 12); hoop(X + 22 - d, Y - 5, 10);
          R(X + 40 - d, Y - 7, 8, 14, P.iron[0]); R(X + 41 - d, Y - 6, 6, 12, P.iron[3]); R(X + 41 - d, Y - 6, 6, 1, P.iron[4]);
          for (const sx of [42, 44]) R(X + sx - d, Y - 4, 1, 8, P.dark[0]);
          flash(X + 48 - d, Y - 4, 9, o.k);
        });
        disc(x + 34, y + 30, 4, P.brass[0]); disc(x + 34, y + 30, 3, P.brass[2]);
      },
    },
    {
      key: 'B', name: '高架炮座', idea: '一根铆接立柱把大炮高高架起，炮身上下各一只驻退筒，炮前一块厚防盾；立柱左边一架梯子，底座是宽法兰。像海岸炮台，「高」和「重」都读得出来。',
      draw(x, y, o) {
        box(x + 2, y + 84, 44, 12, IRON); R(x + 3, y + 90, 42, 1, P.brass[2]);
        box(x + 14, y + 40, 20, 46, DARK);
        for (const fy of [48, 62, 76]) { R(x + 11, y + fy, 26, 3, P.iron[0]); R(x + 12, y + fy, 24, 1, P.iron[3]); }
        for (let yy = y + 44; yy < y + 84; yy += 4) { R(x + 4, yy, 7, 1, P.iron[3]); }
        R(x + 4, y + 42, 1, 42, P.iron[2]); R(x + 10, y + 42, 1, 42, P.iron[2]);
        box(x + 12, y + 36, 26, 6, IRON);
        box(x + 38, y + 12, 7, 30, IRONL); rivet(x + 40, y + 16); rivet(x + 40, y + 34);
        const d = rc(o);
        turn(x + 34, y + 30, o.a, (X, Y) => {
          box(X - 22, Y - 7, 22, 14, BRASS);
          tube(X - 18, Y - 12, 30, 5); tube(X - 18, Y + 7, 30, 5);
          tube(X - 8 - d, Y - 4, 56, 9); hoop(X + 16 - d, Y - 4, 9);
          R(X + 42 - d, Y - 6, 6, 13, P.iron[0]); R(X + 43 - d, Y - 5, 4, 11, P.iron[3]); R(X + 46 - d, Y - 3, 1, 7, P.black);
          flash(X + 48 - d, Y - 4, 9, o.k);
        });
        disc(x + 34, y + 30, 4, P.brass[0]); disc(x + 34, y + 30, 3, P.brass[2]);
      },
    },
    {
      key: 'C', name: '三层塔楼', idea: '一座下宽上窄的三层铁塔楼，每层一道观察缝（玻璃）和黄铜腰线，炮从塔顶一只半圆炮廓里伸出。剪影像一座小城堡，辨识度最高，但不太像「武器模块」。',
      draw(x, y, o) {
        box(x + 1, y + 72, 46, 24, IRON); box(x + 4, y + 50, 40, 23, IRON); box(x + 8, y + 30, 32, 21, IRON);
        for (const [ty, tx, tw] of [[72, 1, 46], [50, 4, 40], [30, 8, 32]]) { R(x + tx + 1, y + ty, tw - 2, 2, P.brass[1]); R(x + tx + 1, y + ty, tw - 2, 1, P.brass[3]); }
        for (const [sy, sx, sw] of [[82, 8, 30], [60, 10, 26], [40, 12, 14]]) { R(x + sx, y + sy, sw, 3, P.iron[0]); R(x + sx + 1, y + sy + 1, sw - 2, 1, P.glass[1]); }
        for (const [ry, rx] of [[88, 4], [88, 42], [66, 7], [66, 39]]) rivet(x + rx, y + ry);
        disc(x + 30, y + 30, 13, P.iron[0]); disc(x + 30, y + 30, 12, P.iron[2]); disc(x + 28, y + 27, 8, P.iron[3]);
        R(x + 17, y + 30, 26, 2, P.iron[0]);
        const d = rc(o);
        turn(x + 34, y + 30, o.a, (X, Y) => {
          tube(X - 4 - d, Y - 4, 48, 9); hoop(X + 12 - d, Y - 4, 9); hoop(X + 30 - d, Y - 4, 9);
          R(X + 43 - d, Y - 6, 5, 13, P.iron[0]); R(X + 44 - d, Y - 5, 3, 11, P.iron[3]); R(X + 47 - d, Y - 3, 1, 7, P.black);
          flash(X + 48 - d, Y - 4, 9, o.k);
        });
        disc(x + 34, y + 30, 3, P.brass[0]); disc(x + 34, y + 30, 2, P.brass[3]);
      },
    },
  ]);
})();
