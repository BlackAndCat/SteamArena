// 后期模块造型候选：巨炮与 3 件 Boss 件（见 cand-kit.js）
(() => {
  const { P, R, px, disc, ring, line, box, rivet, arch, bolted, gauge, tube, hoop, flash, puff, turn, IRON, IRONL, DARK, BRASS, RUST, add } = SA.CAND;
  const rc = (o) => Math.round(o.k * (o.m.rcPx || 0));
  // 粗炮管：高 h，n 道黄铜箍，末端制退器
  function bigBarrel(X, Y, x0, x1, h, hoops, st = 'brake') {
    tube(x0, Y - (h >> 1), x1 - x0, h);
    for (const hx of hoops) { R(hx, Y - (h >> 1) - 1, 3, h + 2, P.brass[0]); R(hx, Y - (h >> 1), 3, h, P.brass[2]); R(hx, Y - (h >> 1), 1, h, P.brass[3]); }
    if (st === 'brake') {
      R(x1 - 10, Y - (h >> 1) - 3, 10, h + 6, P.iron[0]); R(x1 - 9, Y - (h >> 1) - 2, 8, h + 4, P.iron[3]); R(x1 - 9, Y - (h >> 1) - 2, 8, 1, P.iron[4]);
      for (const sx of [x1 - 7, x1 - 4]) R(sx, Y - (h >> 1), 1, h, P.dark[0]);
    }
  }

  // ---------- 巨炮 4×4（96×96）：耳轴 (58,30)，炮口长 66 ----------
  add('cannon_giant', 'late', '要点：终局唯一件（S 级，只有一个造型），女王号上缴获。占 4×4，炮口伸出格子 28px。要让它一出场就是「移动堡垒上的那门炮」，同时仍守规矩：冷铁为主、黄铜点缀、只有炮口闪光发光。', [
    {
      key: 'A', name: '女王要塞炮', idea: '一座圆肩大炮塔，塔顶一圈黄铜王冠齿饰，伸出带三道黄铜箍和大制退器的粗炮管；下半部是弹药甲板，架着两枚巨型炮弹和一台小吊臂。',
      draw(x, y, o) {
        box(x + 2, y + 56, 92, 40, IRON); R(x + 3, y + 62, 90, 2, P.brass[1]); R(x + 3, y + 62, 90, 1, P.brass[3]);
        for (const sx of [10, 34]) { R(x + sx, y + 72, 18, 8, P.brass[1]); R(x + sx, y + 72, 18, 2, P.brass[3]); R(x + sx + 18, y + 72, 6, 8, P.iron[3]); px(x + sx + 23, y + 75, P.iron[4]); }
        line(x + 70, y + 88, x + 70, y + 60, 2, P.dark[3]); line(x + 70, y + 60, x + 86, y + 66, 2, P.dark[3]); line(x + 86, y + 66, x + 86, y + 74, 1, P.steam[1]);
        for (const rx of [6, 48, 88]) rivet(x + rx, y + 88);
        arch(x + 48, y + 10, y + 58, 42, P.iron[0]); arch(x + 48, y + 11, y + 58, 41, P.iron[2]); arch(x + 42, y + 14, y + 40, 26, P.iron[3]);
        R(x + 8, y + 50, 82, 2, P.brass[2]); R(x + 8, y + 51, 82, 1, P.brass[1]);
        for (let i = 0; i < 5; i++) { const cx = x + 31 + i * 8, hh = i % 2 ? 4 : 7; R(cx, y + 10 - hh, 3, hh, P.brass[0]); R(cx, y + 11 - hh, 2, hh - 1, P.brass[2]); px(cx, y + 11 - hh, P.brass[3]); }
        R(x + 29, y + 10, 38, 3, P.brass[1]); R(x + 29, y + 10, 38, 1, P.brass[3]);
        for (const [a, b] of [[16, 22], [28, 40], [80, 26]]) rivet(x + a, y + b);
        R(x + 20, y + 30, 14, 3, P.dark[0]); R(x + 21, y + 31, 12, 1, P.glass[1]);
        const d = rc(o);
        turn(x + 58, y + 30, o.a, (X, Y) => {
          disc(X, Y, 13, P.iron[0]); disc(X, Y, 12, P.iron[2]); disc(X - 3, Y - 3, 7, P.iron[3]);
          bigBarrel(X, Y, X - 6 - d, X + 66 - d, 14, [X + 14 - d, X + 32 - d, X + 48 - d]);
          flash(X + 66 - d, Y - 6, 13, o.k);
        });
        disc(x + 58, y + 30, 4, P.brass[0]); disc(x + 58, y + 30, 3, P.brass[2]); px(x + 57, y + 29, P.brass[3]);
      },
    },
    {
      key: 'B', name: '铁路炮', idea: '一副铆接的桁架底座（斜撑看得见镂空），上面架着巨大的摇架，炮身上下两只驻退筒，炮尾一只装填托盘上躺着一枚巨弹。更「工程」，一战列车炮的味道。',
      draw(x, y, o) {
        R(x + 2, y + 64, 92, 4, P.iron[0]); R(x + 2, y + 92, 92, 4, P.iron[0]); R(x + 3, y + 64, 90, 1, P.iron[3]); R(x + 3, y + 92, 90, 1, P.iron[3]);
        for (let i = 0; i < 6; i++) { const bx = x + 4 + i * 15; line(bx, y + 91, bx + 15, y + 68, 2, P.iron[1]); line(bx + 15, y + 91, bx, y + 68, 1, P.iron[1]); R(bx, y + 66, 3, 28, P.iron[0]); px(bx + 1, y + 67, P.iron[3]); }
        box(x + 30, y + 40, 48, 26, IRON); for (const rx of [34, 72]) { rivet(x + rx, y + 46); rivet(x + rx, y + 58); }
        R(x + 31, y + 60, 46, 1, P.brass[2]);
        box(x + 2, y + 44, 26, 10, DARK); R(x + 5, y + 46, 16, 5, P.brass[1]); R(x + 5, y + 46, 16, 1, P.brass[3]); R(x + 21, y + 46, 5, 5, P.iron[3]);
        const d = rc(o);
        turn(x + 58, y + 30, o.a, (X, Y) => {
          box(X - 34, Y - 10, 34, 20, BRASS); R(X - 32, Y - 8, 1, 16, P.brass[3]);
          tube(X - 30, Y - 17, 48, 7); tube(X - 30, Y + 10, 48, 7);
          bigBarrel(X, Y, X - 4 - d, X + 66 - d, 12, [X + 20 - d, X + 40 - d]);
          flash(X + 66 - d, Y - 5, 11, o.k);
        });
        disc(x + 58, y + 30, 5, P.brass[0]); disc(x + 58, y + 30, 4, P.brass[2]);
      },
    },
    {
      key: 'C', name: '王室礼炮', idea: '纪念碑式的三级台座（黄铜腰线），顶上一门炮身黄铁相间、耳轴是一朵黄铜玫瑰的礼仪大炮。最华丽、最「女王」，但装饰多，得小心别抢了规则色。',
      draw(x, y, o) {
        box(x + 2, y + 78, 92, 18, IRON); box(x + 10, y + 60, 76, 19, IRON); box(x + 20, y + 44, 56, 17, IRON);
        for (const [ty, tx, tw] of [[78, 2, 92], [60, 10, 76], [44, 20, 56]]) { R(x + tx + 1, y + ty, tw - 2, 2, P.brass[1]); R(x + tx + 1, y + ty, tw - 2, 1, P.brass[3]); }
        for (const [cx, cy] of [[24, 87], [72, 87], [30, 70], [66, 70]]) { disc(x + cx, y + cy, 3, P.brass[0]); disc(x + cx, y + cy, 2, P.brass[2]); }
        const d = rc(o);
        turn(x + 58, y + 30, o.a, (X, Y) => {
          disc(X - 20 - d, Y, 5, P.iron[0]); disc(X - 20 - d, Y, 4, P.iron[2]);
          for (let i = 0; i < 86; i++) {
            const cx = X - 18 + i - d, hh = 8 - Math.floor(i / 22), band = Math.floor(i / 11) % 2;
            R(cx, Y - hh, 1, hh * 2 + 1, band ? P.brass[0] : P.iron[0]);
            R(cx, Y - hh + 1, 1, hh * 2 - 1, band ? P.brass[2] : P.iron[3]); px(cx, Y - hh + 1, band ? P.brass[3] : P.iron[4]);
          }
          R(X + 63 - d, Y - 7, 3, 15, P.brass[0]); R(X + 63 - d, Y - 6, 2, 13, P.brass[3]); R(X + 65 - d, Y - 4, 1, 9, P.black);
          flash(X + 66 - d, Y - 5, 11, o.k);
        });
        disc(x + 58, y + 30, 7, P.brass[0]); disc(x + 58, y + 30, 6, P.brass[2]);
        for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; px(Math.round(x + 58 + Math.cos(ang) * 4), Math.round(y + 30 + Math.sin(ang) * 4), P.brass[3]); }
        disc(x + 58, y + 30, 2, P.fire[1]);
      },
    },
  ]);

  // ---------- 圣堂压力核心 1×1（铁甲圣堂的 Boss 件） ----------
  add('boss_core', 'late', '要点：Boss 唯一件，「铁甲圣堂」的压力核心：同时给动力、储压、储水和冷却。用圣堂的哥特元素（尖拱、玫瑰窗）让它一眼就和普通件不同；核心要不要发一点光（能源语义）需要用户定，这里用炉火色的暗阶、不画发光。', [
    {
      key: 'A', name: '圣骨匣', idea: '一座黄铜尖拱小龛，里面供着一颗铆接的压力球，球心一点暗红余烬，龛下一只压力表。「供奉起来的心脏」。',
      draw(x, y, o) {
        box(x + 1, y + 18, 22, 6, IRON);
        for (let yy = 0; yy < 18; yy++) { const hw = Math.min(10, Math.round(yy * 0.9)); R(x + 12 - hw, y + 1 + yy, hw * 2, 1, P.brass[0]); if (hw > 1) R(x + 13 - hw, y + 1 + yy, hw * 2 - 2, 1, yy > 2 ? P.dark[1] : P.brass[2]); }
        for (let yy = 3; yy < 18; yy++) { const hw = Math.min(10, Math.round(yy * 0.9)); px(x + 12 - hw, y + 1 + yy, P.brass[3]); px(x + 11 + hw, y + 1 + yy, P.brass[1]); }
        disc(x + 12, y + 13, 5.5, P.iron[0]); disc(x + 12, y + 13, 4.5, P.iron[2]); disc(x + 11, y + 12, 2.5, P.iron[3]);
        disc(x + 12, y + 13, 1.6, (o.t % 6 < 3) ? P.fire[1] : P.fire[0]);
        gauge(x + 12, y + 21, 2.5, 0.7);
        px(x + 12, y, P.brass[3]);
      },
    },
    {
      key: 'B', name: '玫瑰窗', idea: '整格是一扇圆形玫瑰窗：黄铜花格分出八瓣，瓣里是玻璃、绿、青三色「彩窗」，正中是压力核心。最华丽、最像教堂，1× 下也是一个醒目的彩色圆。',
      draw(x, y, o) {
        box(x, y, 24, 24, IRON);
        disc(x + 12, y + 12, 11, P.brass[0]); disc(x + 12, y + 12, 10, P.brass[2]);
        const cols = [P.glass[1], P.gauge[1], P.water[1], P.glass[2]];
        for (let yy = -9; yy <= 9; yy++) for (let xx = -9; xx <= 9; xx++) {
          const r2 = xx * xx + yy * yy; if (r2 > 81 || r2 < 9) continue;
          const seg = Math.floor(((Math.atan2(yy, xx) + Math.PI) / (Math.PI / 4)) % 8);
          px(x + 12 + xx, y + 12 + yy, cols[(seg + (o.t >> 3)) % 4]);
        }
        for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; line(x + 12, y + 12, Math.round(x + 12 + Math.cos(ang) * 9), Math.round(y + 12 + Math.sin(ang) * 9), 1, P.brass[1]); }
        ring(x + 12.5, y + 12.5, 6, 6, P.brass[1]);
        disc(x + 12, y + 12, 3, P.iron[0]); disc(x + 12, y + 12, 2, P.fire[1]); px(x + 11, y + 11, P.fire[2]);
      },
    },
    {
      key: 'C', name: '三联压力球', idea: '三只小压力球排成三角，黄铜管两两相连，背后一圈带齿的黄铜光环。读起来是「好几件东西合成的一件」，对应它一身四用的功能。',
      draw(x, y, o) {
        ring(x + 12, y + 12, 10.5, 10.5, P.brass[1]);
        for (let a = 0; a < 12; a++) { const ang = a * Math.PI / 6 + o.t * 0.05; px(Math.round(x + 11.5 + Math.cos(ang) * 11.5), Math.round(y + 11.5 + Math.sin(ang) * 11.5), P.brass[2]); }
        const pts = [[12, 6], [6, 17], [18, 17]];
        for (let i = 0; i < 3; i++) { const [a, b] = pts[i], [c, e] = pts[(i + 1) % 3]; line(x + a, y + b, x + c, y + e, 2, P.brass[1]); }
        for (const [a, b] of pts) { disc(x + a, y + b, 4.5, P.iron[0]); disc(x + a, y + b, 3.5, P.iron[2]); px(x + a - 2, y + b - 2, P.iron[4]); }
        disc(x + 12, y + 6, 1.5, P.gauge[2]); disc(x + 6, y + 17, 1.5, P.water[2]); disc(x + 18, y + 17, 1.5, P.fire[1]);
      },
    },
  ]);

  // ---------- 公爵测距棱镜 1×1（黄铜公爵的 Boss 件） ----------
  add('boss_lens', 'late', '要点：Boss 唯一件，「黄铜公爵」沃德豪斯的测距棱镜（瞄准更快更稳）。公爵 = 黄铜、贵族、单片眼镜；控制类用玻璃色。', [
    {
      key: 'A', name: '棱镜王冠', idea: '一块三角玻璃棱镜嵌在带尖齿的黄铜冠座上，右边射出一小束三色分光。最「棱镜」，冠座交代了「公爵」。',
      draw(x, y, o) {
        box(x + 2, y + 17, 20, 7, BRASS);
        for (let i = 0; i < 5; i++) { R(x + 3 + i * 4, y + 14, 2, 3, P.brass[2]); px(x + 3 + i * 4, y + 14, P.brass[3]); }
        for (let yy = 0; yy < 13; yy++) { const hw = Math.round(yy * 0.62); R(x + 12 - hw, y + 2 + yy, hw * 2 + 1, 1, P.glass[1]); px(x + 12 - hw, y + 2 + yy, P.glass[3]); px(x + 12 + hw, y + 2 + yy, P.glass[0]); }
        line(x + 12, y + 3, x + 8, y + 13, 1, P.glass[3]);
        const sh = o.t % 8 < 4 ? 0 : 1;
        R(x + 17, y + 8 + sh, 6, 1, P.fire[2]); R(x + 17, y + 9 + sh, 6, 1, P.gauge[2]); R(x + 17, y + 10 + sh, 6, 1, P.water[2]);
      },
    },
    {
      key: 'B', name: '公爵单片眼镜', idea: '一只巨大的黄铜框单片眼镜立在小座上，镜片会闪光，一条黄铜细链垂下来。很有角色感（一眼想到那位公爵），也最幽默。',
      draw(x, y, o) {
        box(x + 3, y + 20, 18, 4, DARK); R(x + 11, y + 16, 2, 5, P.brass[1]);
        disc(x + 12, y + 9, 8.5, P.brass[0]); disc(x + 12, y + 9, 7.5, P.brass[2]); disc(x + 12, y + 9, 6, P.glass[0]); disc(x + 11, y + 8, 4.5, P.glass[1]);
        px(x + 7, y + 4, P.brass[3]); px(x + 6, y + 6, P.brass[3]);
        if (o.t % 16 < 3) { line(x + 9, y + 11, x + 13, y + 5, 1, P.white); } else px(x + 9, y + 6, P.glass[3]);
        for (let i = 0; i < 6; i++) px(x + 19 + (i % 2), y + 12 + i * 2, i % 2 ? P.brass[1] : P.brass[3]);
      },
    },
    {
      key: 'C', name: '光学塔', idea: '一根黄铜长镜筒竖着，上面三道镜片环，顶上一块斜放的棱镜头朝前。像天文台的测距塔，精密但偏细。',
      draw(x, y, o) {
        box(x + 4, y + 19, 16, 5, IRON);
        R(x + 8, y + 5, 8, 15, P.brass[0]); R(x + 9, y + 5, 6, 15, P.brass[2]); R(x + 9, y + 5, 1, 15, P.brass[3]);
        for (const ry of [8, 12, 16]) { R(x + 7, y + ry, 10, 2, P.iron[0]); R(x + 8, y + ry, 8, 1, P.glass[2]); }
        for (let i = 0; i < 6; i++) { R(x + 8 + i, y + 5 - Math.floor(i / 2) - 1, 1, 2 + Math.floor(i / 2), P.glass[1]); px(x + 8 + i, y + 4 - Math.floor(i / 2), P.glass[3]); }
        R(x + 14, y + 1, 7, 3, P.brass[1]); R(x + 20, y + 1, 2, 3, P.glass[2]);
        if (o.t % 12 < 2) px(x + 21, y + 2, P.white);
      },
    },
  ]);

  // ---------- 寡妇液压撞头 2×1（撞击层，煤灰寡妇的 Boss 件） ----------
  add('boss_ram', 'late', '要点：Boss 唯一件，「煤灰寡妇」玛莎·布莱克改装的液压撞头（冲撞 + 短周期活塞打击）。撞击件一律锈钢色、装在车头最前；寡妇 = 黑寡妇蜘蛛，可以借它的红色沙漏标记（炉火色暗阶，不发光）。', [
    {
      key: 'A', name: '沙漏液压锤', idea: '一只黄铜箍的液压缸，活塞杆一伸一缩（动画），锤头是锈钢的沙漏形，锤面上一只红沙漏——黑寡妇的记号。',
      draw(x, y, o) {
        box(x, y + 5, 20, 14, IRON); R(x + 1, y + 8, 18, 1, P.brass[2]); R(x + 1, y + 15, 18, 1, P.brass[2]);
        gauge(x + 6, y + 12, 2.5, 0.8);
        const e = [0, 3, 6, 3][Math.floor(o.t / 2) % 4];
        R(x + 20, y + 10, 4 + e, 4, P.iron[0]); R(x + 20, y + 11, 4 + e, 2, P.iron[4]);
        const hx = x + 24 + e;
        for (let yy = 0; yy < 24; yy++) { const w = 4 + Math.round(Math.abs(yy - 11.5) * 0.45); R(hx, y + yy, w, 1, P.rust[0]); R(hx + 1, y + yy, w - 2, 1, P.rust[2]); px(hx + 1, y + yy, P.rust[3]); }
        for (let i = 0; i < 4; i++) { R(hx + 3 + i, y + 7 + i, 1, 1, P.fire[1]); R(hx + 3 + i, y + 16 - i, 1, 1, P.fire[1]); }
        R(hx + 6, y + 10, 2, 4, P.fire[1]);
      },
    },
    {
      key: 'B', name: '蛛颚', idea: '两片弯曲的锈钢颚像蜘蛛的螯肢一样一张一合（动画），根部各一只小液压缸。最凶、最像「寡妇」，剪影独一无二；缺点是看起来更像夹子而不是锤。',
      draw(x, y, o) {
        box(x, y + 6, 16, 12, IRON); rivet(x + 3, y + 9); rivet(x + 11, y + 13);
        const open = [0, 2, 4, 2][Math.floor(o.t / 2) % 4];
        for (const s of [-1, 1]) {
          line(x + 14, y + 12 + s * 3, x + 22, y + 12 + s * (5 + open), 3, P.iron[0]); line(x + 14, y + 12 + s * 3, x + 22, y + 12 + s * (5 + open), 1, P.brass[2]);
          for (let i = 0; i <= 22; i++) {
            const t = i / 22, cx = x + 20 + i, cy = y + 12 + s * ((6 + open) * Math.sin(Math.PI * t * 0.9) + 1 - t * 2);
            const w = Math.max(1, Math.round(4 * (1 - t)));
            R(cx, Math.round(cy - w / 2), 1, w + 1, P.rust[0]); if (w > 1) R(cx, Math.round(cy - w / 2) + 1, 1, w - 1, P.rust[2]);
          }
        }
        R(x + 6, y + 10, 4, 4, P.fire[1]);
      },
    },
    {
      key: 'C', name: '三联活塞锤', idea: '三根并排的活塞锤轮流敲出（动画），共用一块锈钢锤面座，气缸上一排黄铜箍。把「短周期活塞打击」直接画出来。',
      draw(x, y, o) {
        box(x, y + 1, 18, 22, IRON); gauge(x + 5, y + 5, 2.5, 0.6);
        for (let i = 0; i < 3; i++) {
          const yy = y + 3 + i * 7, e = (Math.floor(o.t / 2) % 3) === i ? 7 : 1;
          R(x + 18, yy + 1, 6 + e, 3, P.iron[0]); R(x + 18, yy + 2, 6 + e, 1, P.iron[4]);
          R(x + 24 + e, yy - 1, 6, 7, P.rust[0]); R(x + 25 + e, yy, 4, 5, P.rust[2]); R(x + 25 + e, yy, 1, 5, P.rust[3]);
          R(x + 12, yy, 2, 5, P.brass[2]);
        }
      },
    },
  ]);
})();
