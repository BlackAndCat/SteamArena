// 载具模型：子格网格、两层（主体/侧挂）、摆放规则、属性计算、分享码
// 子格 24px，全车 16 列 × 12 行；模块只记在左上角那一格（锚点），占 SA.fp(id) = w×h 个子格。
// 「占格表」occ() 把每个子格指向盖住它的模块，摆放、连通、遮挡、点选都查它
window.SA = window.SA || {};

SA.V = (() => {
  const K = SA.K, M = SA.MODULES;
  const grid = () => Array.from({ length: K.ROWS }, () => Array(K.COLS).fill(null));
  const create = (name = '原型机') => ({ name, body: grid(), side: grid() });
  const layerOf = (id) => (M[id].layer === 'side' ? 'side' : 'body');
  // 满耐久：改装（炮盾 / 附加装甲）每级按比例加；参战副本直接带 max
  const maxHp = (cell) => cell.max || Math.round(SA.mod(cell).hp * (1 + SA.upHp(cell.id) * (cell.lv || 0)));
  const alive = (cell) => cell && cell.hp > 0;
  const fp = SA.fp;
  const CH = K.ROWS - 2;   // 底盘锚点行：底盘占最底下两行子格
  const inGrid = (r, c) => r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS;
  const fits = (r, c, w, h) => r >= 0 && c >= 0 && r + h <= K.ROWS && c + w <= K.COLS;
  const box = (r, c, w, h) => { const out = []; for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) out.push([r + i, c + j]); return out; };
  // 紧贴模块外圈的子格（上下左右，不含对角）
  const ring = (r, c, w, h) => {
    const out = [];
    for (let j = 0; j < w; j++) out.push([r - 1, c + j], [r + h, c + j]);
    for (let i = 0; i < h; i++) out.push([r + i, c - 1], [r + i, c + w]);
    return out.filter(([rr, cc]) => inGrid(rr, cc));
  };

  // 占格表：每个子格 → { cell, r, c }（盖住它的模块和锚点），没有就是 null
  function occ(v, layer = 'body') {
    const g = grid(), L = v[layer];
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        const cell = L[r][c];
        if (!cell) continue;
        const ref = { cell, r, c };
        for (const [rr, cc] of box(r, c, fp(cell.id).w, fp(cell.id).h)) if (inGrid(rr, cc)) g[rr][cc] = ref;
      }
    return g;
  }
  // 某个子格上是哪个模块（点选用）
  const at = (v, layer, r, c) => (inGrid(r, c) ? occ(v, layer)[r][c] : null);

  const ASCII = { T: 'track', Q: 'quad', B: 'biped', K: 'cockpit', A: 'armor', H: 'armor_heavy', C: 'cannon', P: 'mortar', M: 'mg', O: 'boiler', W: 'water', S: 'side_cannon', U: 'bucket', X: 'spike', Y: 'piston', V: 'copilot' };

  // 关卡 / 官方蓝图的 ASCII 按大格写（6 行 × 8 列，一个字符 = 一个 2×2 模块），锚点换算成子格 (2r, 2c)
  // mt：整车材料；sides / elite 也用大格坐标。elite：个别格子的材料 [[r, c, mt, 'side'?], ...]（Boss 身上的史诗件）
  function fromAscii(name, rows, sides = [], mt = 1, elite = []) {
    const v = create(name);
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const id = ASCII[row[c]];
        if (id) v.body[r * 2][c * 2] = SA.newCell(id, mt);
      }
    });
    sides.forEach(([r, c]) => { v.side[r * 2][c * 2] = SA.newCell('side_cannon', mt); });
    for (const [r, c, t, layer] of elite) { const L = v[layer || 'body'], cell = L[r * 2][c * 2]; if (cell) L[r * 2][c * 2] = SA.newCell(cell.id, t); }
    return v;
  }
  // 大格网格（6 × 8，每格一个模块对象）→ 子格载具
  function fromBig(name, body, side) {
    const v = create(name);
    for (const [layer, g] of [['body', body], ['side', side || []]])
      g.forEach((row, r) => row.forEach((cell, c) => { if (cell) v[layer][r * 2][c * 2] = cell; }));
    return v;
  }
  // 旧存档（6 × 8 大格）→ 子格
  function migrate(v) {
    if (!v || !v.body || v.body.length === K.ROWS) return v;
    const out = fromBig(v.name, v.body, v.side);
    if (v.lim) out.lim = v.lim;
    return out;
  }

  // 改装台的可用区域：战役逐章扩建。v.lim = { cols, rows }（大格数，只有玩家的车有），列从中间往两边扩，行从底盘往上扩
  function region(v) {
    const L = v && v.lim;
    if (!L) return { c0: 0, c1: K.COLS - 1, r0: 0 };
    const c0 = 2 * Math.floor((K.COLS / 2 - L.cols) / 2);
    return { c0, c1: c0 + 2 * L.cols - 1, r0: K.ROWS - 2 * L.rows };
  }
  const inRegion = (v, r, c) => { const g = region(v); return r >= g.r0 && c >= g.c0 && c <= g.c1; };
  const boxInRegion = (v, r, c, w, h) => inRegion(v, r, c) && inRegion(v, r + h - 1, c + w - 1);
  const LOCKED = '这一格还没扩建：推进战役会解锁更大的改装台';

  function each(v, fn) {
    for (const layer of ['body', 'side'])
      for (let r = 0; r < K.ROWS; r++)
        for (let c = 0; c < K.COLS; c++)
          if (v[layer][r][c]) fn(v[layer][r][c], r, c, layer);
  }

  const isRamCell = (cell) => cell && SA.isRam(cell.id);
  const mountText = (m) => `${m.name}要装在${m.mount.map(x => M[x].name).join('/')}的正前方（右侧）`;
  // 这几行里，锚点左边有没有撞击件（撞击件前方不能再放东西）
  const ramBehind = (O, r, c, h) => { for (let i = 0; i < h; i++) for (let k = 0; k < c; k++) if (O[r + i][k] && isRamCell(O[r + i][k].cell)) return true; return false; };
  // 这几行里，模块右边还有没有东西（撞击件必须是最前端）
  const anyAhead = (O, r, c, w, h) => { for (let i = 0; i < h; i++) for (let k = c + w; k < K.COLS; k++) if (O[r + i][k]) return true; return false; };
  // 紧贴在模块正后方（左边一列）的模块
  const behind = (O, r, c, h) => { const out = []; if (c > 0) for (let i = 0; i < h; i++) { const o = O[r + i][c - 1]; if (o && !out.includes(o)) out.push(o); } return out; };

  // 严格摆放：这个位置是否合规（能连上、不悬空）
  function canPlace(v, id, r, c) {
    const m = M[id], { w, h } = fp(id);
    const no = (reason) => ({ ok: false, reason });
    if (!fits(r, c, w, h)) return no('超出格子范围');
    if (!boxInRegion(v, r, c, w, h)) return no(LOCKED);
    const O = occ(v, 'body'), cells = box(r, c, w, h);
    if (m.layer === 'side') {
      if (r + h > CH) return no('底盘上不能挂侧炮');
      const S = occ(v, 'side');
      if (cells.some(([rr, cc]) => S[rr][cc])) return no('侧挂层这里已经有侧炮');
      if (cells.some(([rr, cc]) => !O[rr][cc])) return no('侧炮必须整个挂在主体模块上');
      if (cells.some(([rr, cc]) => isRamCell(O[rr][cc].cell))) return no('撞击武器上不能挂侧炮');
      return { ok: true };
    }
    if (cells.some(([rr, cc]) => O[rr][cc])) return no('这里已经有模块');
    if (m.layer === 'ram') {
      if (!behind(O, r, c, h).some(o => m.mount.includes(o.cell.id))) return no(mountText(m));
      if (anyAhead(O, r, c, w, h)) return no('撞击武器必须在这一行的最前端');
      return { ok: true };
    }
    if (m.layer === 'chassis') {
      if (r !== CH) return no('底盘只能放在最底下两行');
      if (ramBehind(O, r, c, h)) return no('撞击武器前方不能再放模块');
      return { ok: true };
    }
    if (r + h > CH) return no('最底下两行只能放底盘');
    // 外圈只要挨着一个（非撞击件的）模块就能塞进去；是否一路连到底盘由 issues() 检查
    const near = ring(r, c, w, h).map(([rr, cc]) => O[rr][cc]).filter(Boolean);
    if (!near.length) return no('悬空：四周都没有模块可以依靠');
    if (near.every(o => isRamCell(o.cell))) return no('撞击武器不能当支撑');
    if (ramBehind(O, r, c, h)) return no('撞击武器前方不能再放模块');
    return { ok: true };
  }

  function place(v, id, r, c, mt = 1) {
    const chk = canPlace(v, id, r, c);
    if (chk.ok) v[layerOf(id)][r][c] = SA.newCell(id, mt);
    return chk;
  }

  // ---------- 改装台上的自由摆放：出战前允许悬空、乱放，出战时再由 issues() 把关 ----------
  const hurt = (x) => x && x.hp > 0 && x.hp < maxHp(x);
  // 同一层这块地方有没有空
  const free = (v, layer, r, c, w, h) => { const O = occ(v, layer); return box(r, c, w, h).every(([rr, cc]) => !O[rr][cc]); };

  // 只检查位置是否空着；返回 { ok, reason, fit }，fit 表示这个位置是否已经合规
  function canPut(v, id, r, c) {
    const { w, h } = fp(id), layer = layerOf(id);
    if (!fits(r, c, w, h)) return { ok: false, reason: '超出格子范围' };
    if (!boxInRegion(v, r, c, w, h)) return { ok: false, reason: LOCKED };
    if (!free(v, layer, r, c, w, h)) return { ok: false, reason: layer === 'side' ? '侧挂层这里已经有侧炮' : '这里已经有模块' };
    const chk = canPlace(v, id, r, c);
    return { ok: true, fit: chk.ok, reason: chk.reason };
  }

  function put(v, id, r, c, mt = 1) {
    const chk = canPut(v, id, r, c);
    if (chk.ok) v[layerOf(id)][r][c] = SA.newCell(id, mt);
    return chk;
  }

  // 挂在某个主体模块上的侧炮：侧炮整个落在这个模块范围里（拆 / 搬主体模块时跟着走）
  function ridersOf(v, r, c) {
    const cell = v.body[r][c];
    if (!cell) return [];
    const f = fp(cell.id), out = [];
    each(v, (sc, sr, scc, layer) => {
      if (layer !== 'side') return;
      const g = fp(sc.id);
      if (sr >= r && scc >= c && sr + g.h <= r + f.h && scc + g.w <= c + f.w) out.push({ cell: sc, dr: sr - r, dc: scc - c });
    });
    return out;
  }

  // 拆下：主体模块连同挂在它上面的侧炮一起拆；上方的模块留在原地悬空。(r, c) 是锚点
  // 受损模块要先修理；报废模块直接清除（由调用方回收残值）
  function remove(v, layer, r, c) {
    const cell = inGrid(r, c) && v[layer][r][c];
    if (!cell) return { ok: false, reason: '这里是空的' };
    const riders = layer === 'body' ? ridersOf(v, r, c) : [];
    if (hurt(cell) || riders.some(x => hurt(x.cell))) return { ok: false, reason: '受损模块要先修理才能拆下' };
    const out = [cell];
    for (const x of riders) { out.push(x.cell); v.side[r + x.dr][c + x.dc] = null; }
    v[layer][r][c] = null;
    return { ok: true, removed: out };
  }

  // 移动：把锚点 (r1, c1) 的模块搬到锚点 (r2, c2)。目标位置正好压着另一个模块就对调（对方搬到原位，放得下才行）
  // 主体模块连同挂在它上面的侧炮一起搬
  function move(v, layer, r1, c1, r2, c2) {
    if (!inGrid(r1, c1) || !inGrid(r2, c2)) return { ok: false, reason: '超出格子范围' };
    if (r1 === r2 && c1 === c2) return { ok: false, reason: '' };
    const cell = v[layer][r1][c1];
    if (!cell) return { ok: false, reason: '这里是空的' };
    const { w, h } = fp(cell.id);
    if (!fits(r2, c2, w, h)) return { ok: false, reason: '超出格子范围' };
    if (!boxInRegion(v, r2, c2, w, h)) return { ok: false, reason: LOCKED };
    const lift = (r, c) => {
      const riders = layer === 'body' ? ridersOf(v, r, c) : [];
      const it = { cell: v[layer][r][c], riders };
      v[layer][r][c] = null;
      for (const x of riders) v.side[r + x.dr][c + x.dc] = null;
      return it;
    };
    const drop = (it, r, c) => {
      v[layer][r][c] = it.cell;
      for (const x of it.riders) v.side[r + x.dr][c + x.dc] = x.cell;
    };
    const a = lift(r1, c1);
    const O = occ(v, layer);
    const hits = [];
    for (const [rr, cc] of box(r2, c2, w, h)) { const o = O[rr][cc]; if (o && !hits.includes(o)) hits.push(o); }
    if (!hits.length) { drop(a, r2, c2); return { ok: true, swapped: false }; }
    if (hits.length > 1) { drop(a, r1, c1); return { ok: false, reason: '目标位置压着好几个模块，换不了' }; }
    const X = hits[0], xf = fp(X.cell.id);
    const b = lift(X.r, X.c);
    // 先放搬过去的，再看对方能不能放回原位
    if (free(v, layer, r2, c2, w, h) && fits(r1, c1, xf.w, xf.h) && boxInRegion(v, r1, c1, xf.w, xf.h)) {
      drop(a, r2, c2);
      if (free(v, layer, r1, c1, xf.w, xf.h)) { drop(b, r1, c1); return { ok: true, swapped: true }; }
      v[layer][r2][c2] = null; for (const x of a.riders) v.side[r2 + x.dr][c2 + x.dc] = null;
    }
    drop(b, X.r, X.c); drop(a, r1, c1);
    return { ok: false, reason: `${M[X.cell.id].name}放不回原位，换不了（尺寸不一样）` };
  }

  // 出战检查：逐个模块找出悬空（没有一路连到底盘）或摆放不合规的。
  // 连通规则：从底盘出发，四周紧贴的主体模块都算连上（可以侧挂、可以悬挑）；撞击件不传导支撑
  function issues(v) {
    const out = [];
    const B = v.body, O = occ(v, 'body');
    const ok = new Set();
    const key = (r, c) => r * K.COLS + c;
    const flag = (layer, r, c, reason) => out.push({ layer, r, c, reason });
    const queue = [];
    for (let c = 0; c < K.COLS; c++) if (B[CH][c] && M[B[CH][c].id].layer === 'chassis' && inRegion(v, CH, c)) { ok.add(key(CH, c)); queue.push([CH, c]); }
    while (queue.length) {
      const [r, c] = queue.shift();
      const f = fp(B[r][c].id);
      for (const [rr, cc] of ring(r, c, f.w, f.h)) {
        const o = O[rr][cc];
        if (!o || ok.has(key(o.r, o.c))) continue;
        const m = M[o.cell.id];
        if (m.layer !== 'body' || o.r + fp(o.cell.id).h > CH) continue;
        ok.add(key(o.r, o.c)); queue.push([o.r, o.c]);
      }
    }
    for (let r = K.ROWS - 1; r >= 0; r--)
      for (let c = 0; c < K.COLS; c++) {
        const cell = B[r][c];
        if (!cell) continue;
        const m = M[cell.id], { w, h } = fp(cell.id);
        if (!boxInRegion(v, r, c, w, h)) flag('body', r, c, LOCKED);
        else if (m.layer === 'chassis') {
          if (r !== CH) flag('body', r, c, '底盘只能放在最底下两行');
        } else if (m.layer === 'ram') {
          if (!behind(O, r, c, h).some(o => m.mount.includes(o.cell.id) && ok.has(key(o.r, o.c)))) flag('body', r, c, mountText(m));
          else if (anyAhead(O, r, c, w, h)) flag('body', r, c, '撞击武器必须是这一行的最前端');
        } else if (r + h > CH) {
          flag('body', r, c, '最底下两行只能放底盘');
        } else if (!ok.has(key(r, c))) {
          const below = ring(r, c, w, h).filter(([rr]) => rr === r + h).map(([rr, cc]) => O[rr][cc]).filter(Boolean);
          flag('body', r, c, below.length && below.every(o => isRamCell(o.cell)) ? '悬空：撞击武器不能当支撑' : '悬空：四周都没连到底盘');
        }
      }
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        const cell = v.side[r][c];
        if (!cell) continue;
        const { w, h } = fp(cell.id), under = box(r, c, w, h).map(([rr, cc]) => inGrid(rr, cc) && O[rr][cc]);
        if (!boxInRegion(v, r, c, w, h)) flag('side', r, c, LOCKED);
        else if (r + h > CH) flag('side', r, c, '底盘上不能挂侧炮');
        else if (under.some(o => !o)) flag('side', r, c, '悬空：侧炮必须整个挂在主体模块上');
        else if (under.some(o => isRamCell(o.cell))) flag('side', r, c, '撞击武器上不能挂侧炮');
        else if (under.some(o => !ok.has(key(o.r, o.c)))) flag('side', r, c, '悬空：挂载的模块没有连到底盘');
      }
    return out;
  }

  // 直射武器：炮管所在的那一行子格（模块最下面一行）前方有己方存活主体模块 → 被挡；高抛炮不受影响
  function blockedList(v) {
    const out = [], O = occ(v, 'body');
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        const cell = v.body[r][c];
        if (!alive(cell) || !SA.isWeapon(cell.id) || M[cell.id].indirect) continue;
        const { w, h } = fp(cell.id), br = r + h - 1;
        for (let k = c + w; k < K.COLS; k++) if (O[br][k] && alive(O[br][k].cell)) { out.push({ r, c }); break; }
      }
    return out;
  }

  function overheatTime(gen, coolRate, water, drain = 0) {
    let heat = 0;
    for (let t = 0; t < 300; t += 0.5) {
      heat += (gen + K.IDLE_HEAT - K.DISSIPATE) * 0.5;
      water = Math.max(0, water - drain * 0.5);
      if (water > 0 && heat > 0) {
        const c = Math.min(heat, SA.coolRate(coolRate, heat) * 0.5);
        heat -= c; water -= c * K.WATER_PER_HEAT;
      }
      heat = Math.max(0, heat);
      if (heat >= K.HEAT_MAX) return t;
    }
    return Infinity;
  }

  function stats(v) {
    const s = {
      aimShrink: K.AIM_SHRINK, aimSpeed: K.AIM_SPEED,   // 瞄准：基础值 + 瞄准类部件加成
      demand: 0, equip: 0, drive: 0, weight: 0, load: 0, supply: 0, hp: 0, maxHp: 0, cockpits: 0, chassis: 0, boilers: 0, tanks: 0,
      water: 0, cool: 0, dps: 0, weapons: 0, heatRate: 0, evade: 0, acc: 0, broken: 0, damaged: 0,
      value: 0, count: 0, height: 0, byId: {}, speed: 0, rams: 0, accel: 0, brake: 0, sway: 0,
    };
    each(v, (cell, r, c) => {
      const m = SA.mod(cell);
      s.value += SA.cellValue(cell); s.count++;
      s.byId[cell.id] = (s.byId[cell.id] || 0) + (cell.hp > 0 ? 1 : 0);
      if (cell.hp <= 0) { s.broken++; return; }
      if (cell.hp < maxHp(cell)) s.damaged++;
      s.height = Math.max(s.height, Math.ceil((K.ROWS - r) / 2));   // 按大格算层数
      s.hp += cell.hp; s.maxHp += maxHp(cell);
      s.equip += m.power || 0;
      s.aimShrink += m.aimShrink || 0; s.aimSpeed += m.aimSpeed || 0;
      s.weight += SA.weightOf(cell);
      s.supply += m.supply || 0;
      if (m.layer === 'chassis') { s.chassis++; s.load += m.load; s.evade += m.evade || 0; s.acc += m.acc || 0; s.speed += m.speed; s.accel += m.accel; s.brake += m.brake; s.sway += m.sway; }
      if (m.ram) s.rams++;
      if (SA.isCockpit(cell.id)) s.cockpits++;
      if (m.supply) { s.boilers++; s.heatRate += m.heatRate; }
      if (m.water) { s.tanks++; s.water += m.water; s.cool += m.cool; }
    });
    // 驾驶舱辅助设备（瞄准镜 / 装弹仓 / 陀螺稳定仪 / 测距仪）
    const cells = [];
    each(v, (cell) => cells.push(cell));
    const ax = s.aux = SA.auxEffect(cells);
    s.aimShrink = Math.min(K.AIM_SHRINK_MAX, s.aimShrink + ax.aimShrink);
    s.aimSpeed += ax.aimSpeed;
    if (s.chassis) for (const k of ['evade', 'acc', 'speed', 'accel', 'brake', 'sway']) s[k] /= s.chassis;
    s.sway *= ax.sway;
    // 动力：设备耗能 + 行驶耗能（按车重）；锅炉供给不够时，装填和车速一起按比例下降
    s.drive = Math.round(s.weight / 1000 * K.DRIVE_PER_T * 10) / 10;
    s.demand = Math.round((s.equip + s.drive) * 10) / 10;
    s.blocked = blockedList(v);
    // 最高速度 = 底盘基础速度 × 动力比（锅炉富余时可以超速，最多 125%）
    s.speedMul = s.demand ? Math.min(K.SPEED_BOOST, s.supply / s.demand) : (s.supply ? 1 : 0);
    s.topSpeed = s.speed * s.speedMul;
    s.power = s.demand ? Math.min(1, s.supply / s.demand) : 1;
    const util = s.supply ? Math.min(1, s.demand / s.supply) : 0;
    let weaponHeat = 0, weaponWater = 0;
    each(v, (cell, r, c, layer) => {
      const m = SA.mod(cell);
      if (!alive(cell) || !m.dmg) return;
      s.weapons++;
      if (layer === 'body' && s.blocked.some(b => b.r === r && b.c === c)) return;
      const reload = m.reload * ax.reload;
      s.dps += (m.dmg * Math.max(0.4, 0.95 - m.spread * ax.spread * 0.03 + s.acc)) / reload * s.power;
      weaponHeat += m.heat / reload * s.power;
      weaponWater += m.heat * K.FIRE_WATER / reload * s.power;
    });
    s.boilerHeat = s.heatRate * Math.max(0.3, util);
    s.heatGen = s.boilerHeat + weaponHeat;
    s.overheat = overheatTime(s.heatGen, s.cool, s.water, weaponWater);
    s.rating = Math.round(s.hp / 12 + s.dps * 5 + s.evade * 60 + s.rams * 15 + Math.min(s.overheat, 120) / 4);

    s.problems = [];
    if (!s.chassis) s.problems.push('没有底盘');
    if (!s.cockpits) s.problems.push('没有可用的驾驶舱');
    if (!s.boilers) s.problems.push('没有锅炉，机器无法启动');
    if (s.chassis && s.weight > s.load) s.problems.push(`超重：总重 ${SA.tons(s.weight)} 超过底盘承重 ${SA.tons(s.load)}`);
    s.issues = issues(v);
    if (s.issues.length) s.problems.push(`${s.issues.length} 个模块悬空或摆放不合规（车间里红色闪烁），接好才能出战`);
    // 履带是一个整体：有一段被毁就整条掉链，修好之前开不动
    const deadTracks = v.body[CH].filter(cell => cell && cell.id === 'track' && cell.hp <= 0).length;
    s.thrown = deadTracks > 0;
    if (s.thrown) s.problems.push('履带掉链（有一段被打断），在车间修好才能开');
    s.warnings = [];
    if (s.demand > s.supply && s.boilers) s.warnings.push(`动力不足：车速和装填降至 ${Math.round(s.power * 100)}%`);
    if (s.blocked.length) s.warnings.push(`${s.blocked.length} 门武器被己方模块挡住，无法开火`);
    if (!s.weapons) s.warnings.push('没有武器');
    if (s.overheat < 60) s.warnings.push(`全力开火约 ${Math.round(s.overheat)} 秒后烧干`);
    const brokenOther = s.broken - deadTracks;
    if (brokenOther > 0) s.warnings.push(`${brokenOther} 个模块已损毁，不会参战`);
    s.canDeploy = s.problems.length === 0;
    return s;
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));

  // 参战副本：剔除损毁模块；hpMul 用于赛季强化
  function battleCopy(v, hpMul = 1, fullHp = false) {
    const b = create(v.name);
    each(v, (cell, r, c, layer) => {
      if (cell.hp <= 0) return;
      const max = Math.round(maxHp(cell) * hpMul);
      b[layer][r][c] = { id: cell.id, mt: cell.mt || 1, lv: cell.lv || 0, aux: cell.aux, hp: fullHp ? max : Math.min(max, Math.round(cell.hp * hpMul)), max };
    });
    return b;
  }

  // 布局（本地蓝图用）：原样记录每个模块的锚点，悬空的也保留。g: 2 = 子格坐标（没有 g 的旧蓝图是大格坐标，读的时候 ×2）
  function layout(v) {
    const b = [], s = [];
    each(v, (cell, r, c, layer) => (layer === 'body' ? b : s).push([r, c, cell.id]));
    return { b, s, g: 2 };
  }
  function fromLayout(name, L) {
    const v = create(name), k = L.g === 2 ? 1 : 2;
    for (const [layer, list] of [['body', L.b || []], ['side', L.s || []]])
      for (const [r, c, id] of list)
        if (M[id] && inGrid(r * k, c * k) && layerOf(id) === layer) v[layer][r * k][c * k] = SA.newCell(id);
    return v;
  }
  // 布局需要的模块数量 { id: n }
  function countIds(v) {
    const n = {};
    each(v, (cell) => { n[cell.id] = (n[cell.id] || 0) + 1; });
    return n;
  }

  // 分享码：SA2.<base64>（子格坐标）；旧的 SA1 码是大格坐标，照样能读
  function encode(v) {
    const b = [], s = [];
    each(v, (cell, r, c, layer) => (layer === 'body' ? b : s).push([r, c, SA.MODULE_ORDER.indexOf(cell.id)]));
    const json = JSON.stringify({ n: v.name, b, s });
    return 'SA2.' + btoa(unescape(encodeURIComponent(json)));
  }

  function decode(code) {
    try {
      const raw = String(code).trim();
      const ver = raw.startsWith('SA2.') ? 2 : raw.startsWith('SA1.') ? 1 : 0;
      if (!ver) return null;
      const k = ver === 1 ? 2 : 1;
      const d = JSON.parse(decodeURIComponent(escape(atob(raw.slice(4)))));
      const v = create(String(d.n || '无名载具').slice(0, 20));
      // 自下而上摆放，保证规则合法；侧炮最后挂
      const list = [...(d.b || []), ...(d.s || [])].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      const sideLast = list.filter(x => SA.MODULE_ORDER[x[2]] !== 'side_cannon').concat(list.filter(x => SA.MODULE_ORDER[x[2]] === 'side_cannon'));
      for (const [r, c, i] of sideLast) {
        const id = SA.MODULE_ORDER[i];
        if (id) place(v, id, r * k, c * k);
      }
      return v;
    } catch (e) { return null; }
  }

  return { create, fromAscii, fromBig, migrate, region, inRegion, boxInRegion, occ, at, CH, each, canPlace, place, canPut, put, remove, move, issues, layout, fromLayout, countIds, blockedList, stats, clone, battleCopy, encode, decode, layerOf, maxHp, alive };
})();
