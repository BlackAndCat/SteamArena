// 竞技场：加速/撞击、直射与高抛弹道 + 弹道预览、数字键切换武器、侧挂层优先、热量/水、AI
window.SA = window.SA || {};

SA.Battle = (() => {
  const h = SA.h, K = SA.K, M = SA.MODULES, P = SA.PAL, C = K.CELL, PADX = SA.SPR.PADX;
  const W = 1280, H = 720, GROUND = 648, VY = GROUND - K.ROWS * C;
  const VW = K.COLS * C + PADX * 2;
  const HALF = C / 2;   // C = 子格 24px；模块的实际大小按 SA.fp 算（modBox / modCenter）
  const alive = SA.V.alive;
  const GROUP_ORDER = ['cannon', 'cannon_m', 'mortar', 'mg', 'side_cannon'];
  let B = null, cv, g, dg, wc, wrap, hud = {};
  const ZMIN = 0.62;   // 镜头最远能拉到的缩放：两车离得再远也尽量框在一屏里

  const rnd = (a, b) => a + Math.random() * (b - a);
  // 散布分布：两个均匀数相加（三角分布），中间密、边缘稀，但扇区边缘确实会打到
  const gauss = () => Math.random() + Math.random() - 1;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- 阵营 ----------
  function makeSide(v, name, isAI, aim, x) {
    const s = { v, name, isAI, aim, x, vx: 0, heat: 0, water: 0, timers: {}, anim: SA.Dyn.animator(), co: { target: null, err: { x: 0, y: 0 }, retarget: 0 }, punch: {}, punchT: {}, dead: false, reason: '',
      vented: false, hold: false, dealt: 0, taken: 0, smokeT: 0, dir: 0, phase: 0, moving: false,
      fireHeld: false, sel: null, target: null, retarget: 0, moveT: 0, goalX: x, charge: false, err: { x: 0, y: 0 },
      elev: {}, heldT: 0, lastSel: null, thrown: false, brakeT: 0, spool: 0, spoolDir: 0, chuffT: 0, rock: 0, spooling: false,
      focus: 0, jolt: 0, release: false, kick: 0 };   // focus：瞄准稳定度 0~1（按住蓄力）；jolt：起步/刹车造成的颠簸
    s.homeX = x;
    s.occ = SA.V.occ(v, 'body'); s.occS = SA.V.occ(v, 'side');   // 占格表：战斗中模块不会挪位置，开局算一次
    refresh(s);
    settle(s, 1);
    s.water = s.waterMax;
    s.armed = s.weapons.length > 0;   // 开局有武器（敌方判负规则用）
    return s;
  }

  function refresh(s) {
    let supply = 0, equip = 0, heatRate = 0, cool = 0, waterMax = 0, ev = 0, acc = 0, ch = 0, sp = 0, cock = 0, kg = 0, rams = 0, minCol = K.COLS, frontCol = -1;
    let ak = 0, bk = 0, sw = 0, spk = 0, cop = 0, aimSh = 0, aimSp = 0;
    const chIds = {};
    const live = [];
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (!alive(cell)) return;
      live.push(cell);
      const m = SA.mod(cell);   // 按材料放大后的属性
      minCol = Math.min(minCol, c);
      if (layer === 'body') frontCol = Math.max(frontCol, c + SA.fp(cell.id).w - 1);
      supply += m.supply || 0; equip += m.power || 0; heatRate += m.heatRate || 0;
      cool += m.cool || 0; waterMax += m.water || 0; kg += SA.weightOf(cell);
      if (m.layer === 'chassis') { chIds[cell.id] = (chIds[cell.id] || 0) + 1; ch++; ev += m.evade || 0; acc += m.acc || 0; sp += m.speed; ak += m.accel; bk += m.brake; sw += m.sway; spk += m.spool; }
      if (m.layer === 'ram') rams++;
      if (SA.isCockpit(cell.id)) { cock++; cop += SA.driversOf(cell.id); }
      aimSh += m.aimShrink || 0; aimSp += m.aimSpeed || 0;
    });
    // 履带是一个整体：任意一段被毁 = 掉链子，整车趴窝
    let thrown = false;
    SA.V.each(s.v, (cell) => { if (cell.id === 'track' && cell.hp <= 0) thrown = true; });
    // mass = 车重（吨）：决定加速、起步、碰撞和撞击伤害；动力需求 = 设备耗能 + 车重 × 行驶系数
    const mass = Math.max(0.5, kg / 1000);
    const demand = equip + mass * K.DRIVE_PER_T;
    // 底盘手感（多种底盘取平均）：accelK 起步、brakeK 刹车、sway 移动时的晃动、spoolK 起步憋气时间
    const avg = (x, d) => (ch ? x / ch : d);
    // 瞄准能力：基础值 + 瞄准类部件加成（以后的瞄准镜等）
    // 驾驶舱辅助设备：只算活着的驾驶舱，驾驶舱被毁设备就失效
    const ax = SA.auxEffect(live);
    s.aimShrink = Math.min(K.AIM_SHRINK_MAX, K.AIM_SHRINK + aimSh + ax.aimShrink);
    s.aimSpeed = K.AIM_SPEED + aimSp + ax.aimSpeed;
    Object.assign(s, { accelK: avg(ak, 1), brakeK: avg(bk, 1), sway: avg(sw, 1) * ax.sway, spoolK: avg(spk, 1),
      speedMul: supply <= 0 ? 0 : demand ? Math.min(K.SPEED_BOOST, supply / demand) : 1 });
    s.chassisId = Object.keys(chIds).sort((a, b) => chIds[b] - chIds[a])[0] || 'track';
    Object.assign(s, { supply, demand, heatRate, cool, waterMax, minCol, frontCol, rams, mass, thrown,
      evade: ch ? ev / ch : 0, acc: ch ? acc / ch : 0, speed: thrown ? 0 : ch ? sp / ch : 0, cockpits: cock, copilots: Math.max(0, cop - 1) });   // 多出来的驾驶员各管一组武器
    s.water = Math.min(s.water, waterMax);
    const blocked = SA.V.blockedList(s.v);
    s.weapons = [];
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (!alive(cell) || !M[cell.id].dmg) return;
      const m = SA.mod(cell);
      s.weapons.push({ cell, r, c, layer, m: ax.reload === 1 && ax.spread === 1 ? m : { ...m, reload: m.reload * ax.reload, spread: m.spread * ax.spread }, key: `${r},${c},${layer === 'side' ? 's' : 'b'}`,
        blocked: layer === 'body' && blocked.some(b => b.r === r && b.c === c) });
    });
    s.groups = GROUP_ORDER.filter(id => s.weapons.some(w => w.cell.id === id));
    if (!s.groups.includes(s.sel)) s.sel = s.groups[0] || null;
    s.pistons = [];
    SA.V.each(s.v, (cell, r, c, layer) => { if (layer === 'body' && alive(cell) && cell.id === 'piston') s.pistons.push({ cell, r, c }); });
    if (!cock) kill(s, '驾驶舱全部被摧毁');
  }

  function kill(s, reason) {
    if (s.dead) return;
    s.dead = true; s.reason = reason; s.fireHeld = false; s.dir = 0;
    for (let i = 0; i < 50; i++) part('steam', s.x + VW / 2 + rnd(-120, 120), VY + (s.yo || 0) + 120 + rnd(-90, 90), rnd(-30, 30), rnd(-90, -24), rnd(1, 2.2));
  }

  // ---------- 地形 ----------
  // B.ter：每个像素的地面高度（土坡）、泥地区间、货箱。数据在 SA.TERRAINS；没有地形就是平地
  const MUD = { track: 0.8, quad: 0.65, biped: 0.45 };   // 泥地里的速度系数（按底盘）
  function makeTerrain(id) {
    const key = SA.TERRAINS[id] ? id : 'flat', def = SA.TERRAINS[key];
    const ground = new Float32Array(W + 1).fill(GROUND);
    for (const hl of def.hills || [])
      for (let x = Math.max(0, Math.floor(hl.x - hl.w / 2)); x <= Math.min(W, Math.ceil(hl.x + hl.w / 2)); x++)
        ground[x] -= hl.h * 0.5 * (1 + Math.cos(Math.PI * (x - hl.x) / (hl.w / 2)));
    const at = (x) => ground[Math.max(0, Math.min(W, Math.round(x)))];
    const crates = (def.crates || []).map(c => { const y1 = at(c.x); return { x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: y1 - c.h, y1, hp: c.hp, max: c.hp, dead: false, shake: 0 }; });
    return { id: key, def, ground, mud: def.mud || [], crates };
  }
  const groundAt = (x) => (B && B.ter && x >= 0 && x <= W ? B.ter.ground[Math.round(x)] : GROUND);   // 地形只在中间这一段，其余都是平地
  const crateAt = (x, y) => (B && B.ter ? B.ter.crates.findIndex(c => !c.dead && x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) : -1);
  // 整车在世界里的左右边缘
  const span = (s) => (isP(s) ? [cellX(s, s.minCol), cellX(s, s.frontCol) + C] : [cellX(s, s.frontCol), cellX(s, s.minCol) + C]);
  // 地形对速度的影响：泥地按底盘减速；上坡慢、下坡快（按车头车尾的高度差）
  function terrainK(s, dir) {
    if (!B.ter) return { top: 1, acc: 1 };
    const [L, R] = span(s), wd = Math.max(1, R - L);
    let mud = 0, junk = 0;
    for (const [a, b] of B.ter.mud) mud += Math.max(0, Math.min(R, b) - Math.max(L, a));
    for (const c of B.ter.crates) if (c.dead) junk += Math.max(0, Math.min(R, c.x1 + 10) - Math.max(L, c.x0 - 10));   // 碎木堆：谁开过去都慢一点
    const mk = (1 - (mud / wd) * (1 - (MUD[s.chassisId] || 0.7))) * (1 - Math.min(1, junk / wd) * 0.35);
    let slope = 1;
    if (dir) {
      const front = dir > 0 ? R : L, back = dir > 0 ? L : R;
      slope = clamp(1 - (groundAt(back) - groundAt(front)) / wd * 2.2, 0.35, 1.35);
    }
    return { top: mk * slope, acc: mk };
  }
  // 车身贴地 + 悬挂（见 docs/game-design.md §4.1）：上层车体是刚体，底盘每格两个接地点（履带的两组负重轮、腿式的两只脚）各自在行程内伸缩。
  // 车底是一条斜线，坡度 kw（世界里每往右 1px 往下多少 px）= 接地点下面地面的最小二乘拟合 × 主底盘的跟坡比例；
  // 车底放在各点的平均高度，但不让哪一点插进地里超过上收行程（宁可悬空）。被毁的底盘不参与；撞击件最多压进地面 6px。
  // 画面上整车绕车底中点旋转 atan(kw)，每个接地点的伸缩存进 s.gnd 交给 renderVehicle
  function settle(s, dt) {
    const [L, R] = span(s), xc = (L + R) / 2;
    const pts = [], rigid = [];
    for (let c = 0; c < K.COLS; c++) {
      const cell = s.v.body[SA.V.CH][c];
      if (!cell) continue;
      const m = SA.MODULES[cell.id];
      if (m.susp && alive(cell)) m.susp.pts.forEach((px, i) => pts.push({ key: `${SA.V.CH},${c}`, i, x: isP(s) ? cellX(s, c) + px : cellX(s, c) + C - px, up: m.susp.up, down: m.susp.down }));
      else if (SA.isRam(cell.id)) for (let k = 0; k < SA.fp(cell.id).w; k++) rigid.push(cellX(s, c + k) + HALF);
    }
    if (!pts.length) for (let x = L + 6; x <= R - 6; x += 12) pts.push({ x, up: 0, down: 0 });   // 底盘全毁：整车趴在地上
    for (const p of pts) p.y = groundAt(p.x);
    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    const follow = (SA.MODULES[s.chassisId] && SA.MODULES[s.chassisId].susp || { follow: 1 }).follow;
    const kT = clamp((sxx ? sxy / sxx : 0) * follow, -0.45, 0.45);
    s.kw = (s.kw || 0) + (kT - (s.kw || 0)) * Math.min(1, dt * 8);
    const rel = (x, y) => y - s.kw * (x - xc);   // 地面相对车底线的高度
    for (const p of pts) p.r = rel(p.x, p.y);
    const lo = Math.max(...pts.map(p => p.r - p.down));
    let hi = Math.min(...pts.map(p => p.r + p.up));
    for (const x of rigid) hi = Math.min(hi, rel(x, groundAt(x)) + 6);
    const mean = pts.reduce((a, p) => a + p.r, 0) / n, want = lo <= hi ? clamp(mean, lo, hi) : hi;
    s.pivX = xc;
    s.yo = (s.yo || 0) + (want - GROUND - (s.yo || 0)) * Math.min(1, dt * 10);
    const cs = Math.cos(Math.atan(s.kw)), py = GROUND + s.yo;
    s.gnd = {};
    for (const p of pts) if (p.key) (s.gnd[p.key] = s.gnd[p.key] || [0, 0])[p.i] = clamp((p.r - py) * cs, -p.up, p.down);
  }
  // 车身倾斜：绕支点（车底中点）旋转 atan(kw)。「平放坐标」（cellX / cellY 算出来的）↔ 世界坐标
  const tiltOf = (s) => Math.atan(s.kw || 0);
  const pivY = (s) => GROUND + (s.yo || 0);
  function toWorld(s, x, y) {
    const a = tiltOf(s);
    if (!a || s.pivX == null) return [x, y];
    const dx = x - s.pivX, dy = y - pivY(s), c = Math.cos(a), n = Math.sin(a);
    return [s.pivX + dx * c - dy * n, pivY(s) + dx * n + dy * c];
  }
  function toFlat(s, x, y) {
    const a = tiltOf(s);
    if (!a || s.pivX == null) return [x, y];
    const dx = x - s.pivX, dy = y - pivY(s), c = Math.cos(a), n = Math.sin(a);
    return [s.pivX + dx * c + dy * n, pivY(s) - dx * n + dy * c];
  }
  // 车头抬起的角度（度，两边都是「抬头为正」）：瞄准和出膛方向要加上它
  const pitchOf = (s) => (isP(s) ? -1 : 1) * tiltOf(s) * 180 / Math.PI;
  // 货箱挨打 / 被碾：一抖、飞木屑，打烂了就散成一地碎木。crush = 被车碾（每帧都有，不飘数字，木屑少一点）
  function hitCrate(k, dmg, crush) {
    const c = B.ter.crates[k];
    if (!c || c.dead) return;
    c.hp -= dmg;
    c.shake = 0.2;
    const x = (c.x0 + c.x1) / 2, y = (c.y0 + c.y1) / 2;
    if (!crush) textFx(String(Math.round(dmg)), x + rnd(-9, 9), c.y0 - 10, '#d9b27a');
    if (!crush || Math.random() < 0.25) for (let i = 0; i < (crush ? 2 : 6); i++) part('debris', x, y, rnd(-120, 120), rnd(-180, -40), rnd(0.4, 0.8), P.leather[1]);
    if (c.hp <= 0) {
      c.dead = true;
      for (let i = 0; i < 16; i++) part('debris', x + rnd(-20, 20), y + rnd(-20, 20), rnd(-200, 200), rnd(-260, -60), rnd(0.8, 1.4), i % 2 ? P.leather[1] : P.leather[2]);
      for (let i = 0; i < 6; i++) part('dust', x, c.y1 - 4, rnd(-80, 80), rnd(-60, -10), rnd(0.4, 0.8));
      B.shake = Math.max(B.shake, 4);
    }
  }

  // ---------- 坐标 ----------
  const isP = (s) => s === B.p;
  const isHuman = (s) => s === B.p && !s.isAI;   // 数值自测时玩家这一侧也交给 AI
  const cellX = (s, c) => (isP(s) ? s.x + PADX + c * C : s.x + VW - PADX - (c + 1) * C);
  const cellY = (r, s) => VY + (s ? s.yo || 0 : 0) + r * C;   // s.yo：车被地形抬高 / 压低的量（负 = 抬高）
  const frontEdge = (s) => (isP(s) ? cellX(s, s.frontCol) + C : cellX(s, s.frontCol));
  // 模块在世界里的包围盒（敌方镜像：锚点列在世界里是最右边那一列）
  function modBox(s, r, c, id) {
    const f = SA.fp(id), x0 = isP(s) ? cellX(s, c) : cellX(s, c + f.w - 1);
    // 车身倾斜时模块中心跟着转（包围盒大小不变，够画角框、军衔杠、特效用）
    const [cx, cy] = toWorld(s, x0 + f.w * C / 2, cellY(r, s) + f.h * C / 2);
    return { x0: cx - f.w * C / 2, x1: cx + f.w * C / 2, y0: cy - f.h * C / 2, y1: cy + f.h * C / 2 };
  }
  function modCenter(s, layer, r, c) {
    const cell = s.v[layer][r][c], b = modBox(s, r, c, cell ? cell.id : 'armor');
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }
  // 世界坐标 → 子格
  function cellAt(s, x, y) {
    [x, y] = toFlat(s, x, y);   // 先转回车身平放时的坐标
    const r = Math.floor((y - VY - (s.yo || 0)) / C);
    const c = isP(s) ? Math.floor((x - s.x - PADX) / C) : Math.floor((s.x + VW - PADX - x) / C);
    return r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS ? { r, c } : null;
  }
  // 子格上活着的模块 → { layer, r, c }（锚点）
  function modAt(s, layer, r, c) {
    const o = (layer === 'side' ? s.occS : s.occ)[r][c];
    return o && alive(o.cell) ? { layer, r: o.r, c: o.c } : null;
  }
  // 炮口位置：耳轴 + 炮管长度沿当前仰角伸出去（和画面上转动的炮管一致）；敌方镜像
  function muzzle(s, w) {
    const x0 = cellX(s, w.c), y0 = cellY(w.r, s);
    const [px, py] = w.m.piv, a = barrel(s, w) * Math.PI / 180;
    const dx = Math.cos(a) * w.m.blen, dy = -Math.sin(a) * w.m.blen;
    const mx = isP(s) ? x0 + px + dx : x0 + C - px - dx;
    return toWorld(s, mx, y0 + py + dy);
  }
  // 准星优先级：侧挂层 > 主体层
  function targetAt(def, x, y) {
    const cell = cellAt(def, x, y);
    if (!cell) return null;
    return modAt(def, 'side', cell.r, cell.c) || modAt(def, 'body', cell.r, cell.c);
  }

  // ---------- 弹道 ----------
  function solve(x0, y0, tx, ty, v, gr, high) {
    const dx = Math.max(1, Math.abs(tx - x0)), dy = y0 - ty, v2 = v * v;
    const disc = v2 * v2 - gr * (gr * dx * dx + 2 * dy * v2);
    if (disc < 0) return { a: Math.PI / 4, reach: false };
    const sq = Math.sqrt(disc);
    return { a: Math.atan((v2 + (high ? sq : -sq)) / (gr * dx)), reach: true };
  }
  // 车身不稳的程度：移动速度 + 起步/刹车颠簸，乘底盘晃动系数（四足最稳，双足最晃）
  const shakeOf = (s) => s.sway * (Math.min(1, Math.abs(s.vx) / 60) * 1.6 + Math.min(1.5, s.jolt) * 2.2);
  // 散布（最大偏角，度）：只有直射武器有；高抛指哪打哪。边走边打、刹车时散布更大；按住蓄力（focus）能把散布缩到 30%
  const spreadDeg = (s, o, w, focus = s.focus) => (w.m.indirect ? 0
    : (w.m.spread * (1 - s.acc * 5) + shakeOf(s) * 1.4) * (1 - s.aimShrink * focus) + o.evade * 20);
  // 瞄准点 → 炮管该抬到的仰角（度），受射界限制
  function aimAngle(s, w, tx, ty) {
    const [x0, y0] = muzzle(s, w);
    const sol = solve(x0, y0, tx, ty, w.m.v, K.GRAVITY * w.m.g, w.m.arc === 'high');
    // 世界里要的仰角 → 炮管相对车身的仰角（车身在坡上抬头 / 低头，射界也跟着车身走）
    const raw = sol.a * 180 / Math.PI - pitchOf(s), [lo, hi] = w.m.elev;
    return { a: clamp(raw, lo, hi), reach: sol.reach, over: sol.reach && raw > hi ? 'high' : sol.reach && raw < lo ? 'low' : null };
  }
  const barrel = (s, w) => (s.elev[w.key] != null ? s.elev[w.key] : w.m.rest);
  function launch(s, w, deg, jitter) {
    const [x0, y0] = muzzle(s, w);
    const a = (deg + jitter) * Math.PI / 180;
    const dir = isP(s) ? 1 : -1;
    const wa = a + pitchOf(s) * Math.PI / 180;   // 炮管仰角（相对车身）+ 车身抬头 = 世界里的仰角
    return { x: x0, y: y0, vx: dir * w.m.v * Math.cos(wa), vy: -w.m.v * Math.sin(wa), g: K.GRAVITY * w.m.g };
  }
  // 推进一步并检测命中：侧挂模式只和侧挂层碰撞
  function advance(sh, def, dt) {
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += sh.g * dt;
    const cell = cellAt(def, sh.x, sh.y);
    if (cell) {
      const hit = modAt(def, sh.side ? 'side' : 'body', cell.r, cell.c);
      if (hit) return hit;
    }
    const cr = crateAt(sh.x, sh.y);
    if (cr >= 0) return { crate: cr };
    if (sh.y >= groundAt(sh.x)) return 'ground';
    if (sh.y > H + 100 || (B.cam && (sh.x < B.cam.x - 800 || sh.x > B.cam.x + B.cam.w + 800))) return 'out';
    return null;
  }
  function predict(s, o, w, deg, side, jitter = 0) {
    const sh = { ...launch(s, w, deg, jitter), side };
    const pts = [];
    for (let i = 0; i < 600; i++) {
      const res = advance(sh, o, 1 / 120);
      if (i % 4 === 0) pts.push([sh.x, sh.y]);
      if (res) return { pts, hit: res.layer ? res : null, blocked: res.crate != null ? 'crate' : res === 'ground' && sh.y < GROUND - 1 ? 'hill' : null, end: [sh.x, sh.y] };
    }
    return { pts, hit: null, end: [sh.x, sh.y] };
  }

  // ---------- 特效 ----------
  // 无画面模拟（数值自测）不产生粒子和飘字
  function part(type, x, y, vx, vy, life, col) { if (!B.headless) B.parts.push({ type, x, y, vx, vy, life, max: life, col }); }
  function textFx(str, x, y, col) { if (!B.headless) B.texts.push({ str, x, y, life: 0.9, col }); }
  function boom(x, y, n = 18) {
    for (let i = 0; i < n; i++) part('fire', x, y, rnd(-130, 130), rnd(-160, 30), rnd(0.3, 0.7));
    for (let i = 0; i < n / 2; i++) part('debris', x, y, rnd(-160, 160), rnd(-250, -60), rnd(0.8, 1.4), Math.random() < 0.5 ? P.iron[2] : P.dark[3]);
    for (let i = 0; i < n / 3; i++) part('smoke', x + rnd(-12, 12), y, rnd(-20, 20), rnd(-70, -30), rnd(1, 1.8));
    B.shake = Math.max(B.shake, 7);
  }

  // ---------- 开火与伤害 ----------
  // 按炮管当前仰角开火：炮管还没转到位就扣扳机，炮弹就飞向炮管指的地方
  function fire(s, o, w, side, focus = s.focus) {
    let jit = gauss() * spreadDeg(s, o, w, focus);
    if (Math.random() < (w.m.wild || 0)) jit += (Math.random() < 0.5 ? -1 : 1) * rnd(1, 1.4) * w.m.spread; // 偏弹
    const sh = launch(s, w, barrel(s, w), jit);
    B.shots.push({ ...sh, side, from: s, to: o, dmg: w.m.dmg, big: w.m.proj === 'shell' });
    s.heat += w.m.heat;
    s.water = Math.max(0, s.water - w.m.heat * K.FIRE_WATER);
    // 制退与反作用：炮管后坐（动态模块）、车身被往后推、整车晃一下；越重的车越稳
    const dir = isP(s) ? 1 : -1, up = w.m.arc === 'high';
    s.anim.gun(w.key, w.m);
    const push = (w.m.kick || 0) / s.mass;
    s.vx -= dir * push * (up ? 0.3 : 1);
    SA.Dyn.kick(s.anim.body, -push * (up ? 2 : 4));
    if (w.m.proj === 'shell') B.shake = Math.max(B.shake, 1.5 + push / 6);
    for (let i = 0; i < (w.m.proj === 'shell' ? 10 : 3); i++) part('flash', sh.x + dir * rnd(0, 10), sh.y + rnd(-3, 3) - (up ? rnd(0, 8) : 0), dir * rnd(30, 110), up ? rnd(-140, -40) : rnd(-30, 30), rnd(0.06, 0.14));
    if (w.m.proj === 'shell') {
      part('smoke', sh.x, sh.y, dir * 30, -24, 0.9);
      // 炮口制退器两侧喷出的气浪 + 炮口前方的冲击尘
      if (!up) for (const vy of [-1, 1]) for (let i = 0; i < 3; i++) part('steam', sh.x - dir * 4, sh.y + vy * 4, -dir * rnd(20, 60), vy * rnd(60, 120), rnd(0.25, 0.45));
      if (sh.y > groundAt(sh.x) - 120) for (let i = 0; i < 6; i++) part('dust', sh.x + dir * rnd(0, 30), groundAt(sh.x) - 2, dir * rnd(20, 120), rnd(-80, -20), rnd(0.3, 0.6));
    }
  }

  function damage(def, att, imp, dmg) {
    const cell = def.v[imp.layer][imp.r][imp.c];
    if (!alive(cell)) return;
    cell.hp -= dmg;
    def.taken += dmg; if (att) att.dealt += dmg;
    const [x, y0] = modCenter(def, imp.layer, imp.r, imp.c), y = y0 - 6;
    textFx(String(Math.round(dmg)), x + rnd(-9, 9), y - 18, imp.layer === 'side' ? P.magenta : P.white);
    for (let i = 0; i < 6; i++) part('spark', x, y + 6, rnd(-130, 130), rnd(-160, 0), rnd(0.15, 0.35));
    if (cell.hp <= 0) destroy(def, att, imp);
  }

  function destroy(def, att, imp) {
    const cell = def.v[imp.layer][imp.r][imp.c];
    cell.hp = 0;
    const [x, y] = modCenter(def, imp.layer, imp.r, imp.c);
    boom(x, y);
    const f = SA.fp(cell.id);
    // 挂在这个主体模块上的侧炮一起掉下来
    if (imp.layer === 'body') {
      const seen = new Set();
      for (let i = 0; i < f.h; i++) for (let j = 0; j < f.w; j++) {
        const o = def.occS[imp.r + i][imp.c + j];
        if (!o || seen.has(o.cell) || !alive(o.cell)) continue;
        seen.add(o.cell); o.cell.hp = 0;
        for (let k = 0; k < 8; k++) part('debris', x, y, rnd(-90, 90), rnd(-120, 0), 1.2, P.brass[1]);
        textFx('!', x, y - 40, P.fire[3]);
      }
    }
    const m = M[cell.id];
    if (cell.id === 'track' && !def.thrown) for (let i = 0; i < 14; i++) part('debris', x + rnd(-40, 40), GROUND - 10, rnd(-140, 140), rnd(-260, -80), rnd(0.8, 1.5), i % 2 ? P.dark[2] : P.dark[3]);
    if (m.explode) {
      boom(x, y, 30);
      // 波及外圈紧贴的每个模块（各炸一次）
      const hit = new Set();
      for (let i = -1; i <= f.h; i++) for (let j = -1; j <= f.w; j++) {
        if ((i === -1 || i === f.h) === (j === -1 || j === f.w)) continue;   // 只要上下左右，不要对角和自己
        const r = imp.r + i, c = imp.c + j;
        if (r < 0 || r >= K.ROWS || c < 0 || c >= K.COLS) continue;
        const o = def.occ[r][c];
        if (o && alive(o.cell) && !hit.has(o.cell)) { hit.add(o.cell); damage(def, att, { layer: 'body', r: o.r, c: o.c }, m.explode); }
      }
    }
    refresh(def);
  }

  // ---------- 移动与撞击 ----------
  // 起步：停稳后要先让锅炉「库吃库吃」憋几口蒸汽，才开得动；越重憋得越久
  const spoolTime = (s) => clamp(0.3 + s.mass * 0.05, 0.4, 0.9) * s.spoolK;
  function chuff(s, dt) {
    s.chuffT -= dt;
    if (s.chuffT > 0) return;
    s.chuffT = 0.2;
    s.rock = 1;
    s.heat += 0.3;
    s.water = Math.max(0, s.water - K.CHUFF_WATER);
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (layer !== 'body' || !alive(cell) || cell.id !== 'boiler') return;
      const x = modBox(s, r, c, cell.id).x0 + (isP(s) ? 37 : 11), y = cellY(r, s);
      for (let i = 0; i < 7; i++) part('steam', x + rnd(-5, 5), y, rnd(-50, 50), rnd(-170, -80), rnd(0.5, 0.9));
    });
    const back = cellX(s, isP(s) ? s.minCol : s.frontCol);
    for (let i = 0; i < 3; i++) part('steam', back + (isP(s) ? 0 : C), GROUND - 16, (isP(s) ? -1 : 1) * rnd(40, 90), rnd(-40, -10), rnd(0.4, 0.7));
  }

  // 惯性：起步要憋气再加速，松开/反向要先制动滑行；越重越慢
  function drive(s, dt) {
    let dir = s.dead ? 0 : s.dir;
    s.spooling = false;
    if (dir && Math.abs(s.vx) < 4 && s.speed > 0 && s.power > 0) {
      if (s.spoolDir !== dir) { s.spoolDir = dir; s.spool = spoolTime(s); s.chuffT = 0; }
      if (s.spool > 0) { s.spool -= dt; s.spooling = true; chuff(s, dt); dir = 0; }
    } else if (!dir) s.spoolDir = 0;
    s.rock = Math.max(0, s.rock - dt * 6);
    // 最高速度 = 底盘速度 × 动力比（锅炉富余可超速到 125%）
    // 地形：泥地减速、上坡慢下坡快
    const tk = terrainK(s, dir || Math.sign(s.vx));
    const top = dir * s.speed * (s.speedMul || 0) * tk.top;
    const k = clamp(Math.sqrt(5.5 / s.mass), 0.55, 1.4);   // 越重加速、刹车越慢
    const braking = s.vx !== 0 && (top === 0 || Math.sign(top) !== Math.sign(s.vx) || Math.abs(top) < Math.abs(s.vx));
    // 被撞飞（速度超过自己能开出的最高速度）：履带和脚在地上打滑，急停。正常松手 / 掉头仍按原来的刹车慢慢停
    const own = s.speed * (s.speedMul || 0) * tk.top;
    const skid = braking && Math.abs(s.vx) > own * 1.05 + 4;
    const acc = (braking ? Math.max(K.BRAKE * s.brakeK, skid ? K.SKID : 0) : K.ACCEL * s.accelK * tk.acc) * k;
    const vx0 = s.vx;
    s.vx += clamp(top - s.vx, -acc * dt, acc * dt);
    // 颠簸：速度变化越猛越颠（起步、刹车、撞击），慢慢平复
    // 颠簸：当前速度和「平滑速度」的差（起步、刹车、撞击时大；开火的小后坐几乎不算）
    s.vxs = (s.vxs == null ? s.vx : s.vxs + (s.vx - s.vxs) * Math.min(1, dt * 4));
    if (dt > 0) s.jolt += (Math.min(1.5, Math.abs(s.vx - s.vxs) / 25) - s.jolt) * Math.min(1, dt * 6);
    if (braking && Math.abs(s.vx) > 30) {
      s.brakeT -= dt;
      if (s.brakeT <= 0) {
        s.brakeT = 0.08;
        const back = cellX(s, isP(s) ? s.minCol : s.frontCol);
        const dx0 = back + rnd(0, (s.frontCol - s.minCol + 1) * C);
        part('dust', dx0, groundAt(dx0) - 2, -Math.sign(s.vx) * rnd(10, 60), rnd(-60, -20), rnd(0.3, 0.5));
      }
    }
    // 场地左右无限延伸：想退多远退多远，不会被堵在角落里（背景看台会跟着转）
    let nx = s.x + s.vx * dt;
    // 货箱：不经撞，车一顶上去就碾碎（车越重、越快碎得越快），碾的时候车速被拖慢；碎了留一堆碎木，开过去再慢一点
    if (B.ter) {
      const [L, R] = span(s);
      for (let k2 = 0; k2 < B.ter.crates.length; k2++) {
        const cb = B.ter.crates[k2];
        if (cb.dead) continue;
        const dx = nx - s.x;
        let stop = null;
        if (dx > 0 && R <= cb.x0 + 1.5 && R + dx > cb.x0) stop = s.x + (cb.x0 - R);
        else if (dx < 0 && L >= cb.x1 - 1.5 && L + dx < cb.x1) stop = s.x + (cb.x1 - L);
        if (stop == null) continue;
        const v = Math.abs(s.vx), hit = !cb.touch;   // 刚撞上的那一下另算冲击
        cb.touch = 0.15;
        let dmg = s.mass * (8 + v * 0.5) * dt * (s.rams ? 2 : 1);
        if (hit && v > 10) dmg += s.mass * v * 0.2 * (s.rams ? 1.5 : 1);
        hitCrate(k2, dmg, true);
        if (cb.dead) { s.vx *= 0.7; continue; }      // 碾碎了：冲过去，只丢一点速度
        nx = stop;
        s.vx = Math.sign(s.vx) * Math.min(Math.abs(s.vx), 18);   // 还没碎：顶着慢慢碾
      }
    }
    s.moving = Math.abs(nx - s.x) > 0.02;
    s.phase += (nx - s.x) * (isP(s) ? 1 : -1);
    s.anim.phase = s.phase;   // 履带链节 / 负重轮 / 腿的步态都读动态模块里的行驶相位
    s.x = nx;
    settle(s, dt);
    if (s.moving && s.dir) {
      s.heat += K.MOVE_HEAT * dt;
      s.water = Math.max(0, s.water - K.MOVE_WATER * dt);
    }
  }

  // ---------- 逐行碰撞 ----------
  // 两车只在「同一高度的行」上相撞：每一行各自最前端的模块互相顶住。
  // 这样底盘伸得再长也只在底盘那一行挡路，上层的撞角可以从光秃秃的底盘上方越过去撞到后面的模块。
  // 每一行子格最前端的活模块（占格表里的 { cell, r, c }），没有就是 null
  const rowFront = (s, r) => { for (let c = K.COLS - 1; c >= 0; c--) { const o = s.occ[r][c]; if (o && alive(o.cell)) return o; } return null; };
  const rowEdge = (s, o) => { const b = modBox(s, o.r, o.c, o.cell.id); return isP(s) ? b.x1 : b.x0; };
  // 返回 { gap, rows }：最小间距，以及贴得最近（在 1px 内）的那些行
  // 两车被地形抬到不同高度时，按世界高度对齐：p 的第 r 行对着 e 的第 r + dr 行
  function rowContact(p, e) {
    let gap = Infinity;
    const rows = [];
    const dr = Math.round(((p.yo || 0) - (e.yo || 0)) / C);
    for (let r = 0; r < K.ROWS; r++) {
      const re = r + dr;
      if (re < 0 || re >= K.ROWS) continue;
      const pc = rowFront(p, r), ec = rowFront(e, re);
      if (!pc || !ec) continue;
      const g0 = rowEdge(e, ec) - rowEdge(p, pc);
      rows.push({ r, re, g: g0, pc, ec });
      gap = Math.min(gap, g0);
    }
    return { gap, dr, rows: rows.filter(x => x.g <= gap + 1) };
  }

  function collide() {
    const p = B.p, e = B.e;
    if (p.frontCol < 0 || e.frontCol < 0) return;
    const { gap, rows, dr } = rowContact(p, e);
    B.contactRows = gap <= 1 ? rows.map(x => x.r) : [];
    B.contactRowsE = gap <= 1 ? rows.map(x => x.re) : [];
    B.rowShift = dr;
    B.contact = gap <= 1;
    if (gap > 0) return;
    const closing = p.vx - e.vx;
    const cx = (rowEdge(p, rows[0].pc) + rowEdge(e, rows[0].ec)) / 2;
    if (closing > 25 && B.ramCd <= 0) {
      B.ramCd = 0.35;
      const f = closing / 60;
      let knockP = 0, knockE = 0;
      // 一对模块顶在一起（可能跨好几行子格）只算一次
      const pairs = [];
      for (const x of rows) if (!pairs.some(q => q.pc === x.pc && q.ec === x.ec)) pairs.push(x);
      for (const [a, d] of [[p, e], [e, p]]) {
        for (const x of pairs) {
          const am = a === p ? x.pc : x.ec, dm = a === p ? x.ec : x.pc;
          const ma = am.cell;
          // 撞击伤害 ∝ 相对速度 × 自身车重；撞击面自己也吃一部分反作用
          const dmg = (SA.mod(ma).ram || 6) * f * SA.ramMul(a.mass * 1000);   // 车越重撞得越狠
          damage(d, a, { layer: 'body', r: dm.r, c: dm.c }, SA.isRam(dm.cell.id) ? dmg * 0.5 : dmg);
          if (alive(ma)) damage(a, null, { layer: 'body', r: am.r, c: am.c }, dmg * K.RAM_SELF);
          if (M[ma.id].knock) { if (a === p) knockE += M[ma.id].knock; else knockP += M[ma.id].knock; }
        }
      }
      for (let i = 0; i < 16; i++) part('spark', cx, cellY(rows[0].r, p) + HALF + rnd(-30, 30), rnd(-300, 300), rnd(-300, 0), rnd(0.2, 0.4));
      B.shake = Math.max(B.shake, 5 + f * 4);
      // 一维碰撞：恢复系数 0.25，铲斗额外击退
      const mp = p.mass, me = e.mass, vp = p.vx, ve = e.vx;
      const vcm = (mp * vp + me * ve) / (mp + me);
      p.vx = vcm - 0.25 * (vp - vcm);
      e.vx = vcm - 0.25 * (ve - vcm);
      // 铲斗 / 撞角的额外击退：两车之间的一对冲量，谁重谁的速度变化小
      if (knockE) shove(p, e, knockE * 22 * f);
      if (knockP) shove(e, p, knockP * 22 * f);
    } else if (closing > 0) {
      // 顶牛：按质量合成速度
      const v = (p.mass * p.vx + e.mass * e.vx) / (p.mass + e.mass);
      p.vx = v; e.vx = v;
    }
    // 分离，按质量分摊
    const ov = -gap;
    p.x -= ov * e.mass / (p.mass + e.mass);
    e.x += ov * p.mass / (p.mass + e.mass);
  }

  // a 把 t 往前推：动量守恒的一对冲量。dv 是两车一样重时各自的速度变化；
  // 质量不同时按质量反比分摊，重车的速度变化永远比轻车小（以前只推对方、还按比例截断，重车会被推得比轻车更远）
  function shove(a, t, dv) {
    dv = Math.min(dv, K.KNOCK_MAX);   // 击退封顶：一下撞不飞几十米
    const dir = isP(a) ? 1 : -1, sum = a.mass + t.mass;
    t.vx += dir * dv * 2 * a.mass / sum;
    a.vx -= dir * dv * 2 * t.mass / sum;
  }

  // 蒸汽撞锤：贴身时周期性猛击
  function pistons(s, o, dt) {
    for (const k in s.punch) s.punch[k] = Math.max(0, s.punch[k] - dt * 4);
    if (s.dead || o.dead || !B.contact) return;
    for (const pc of s.pistons) {
      // 撞锤要在自己这几行的最前端，并且其中一行正顶着对方
      const f = SA.fp(pc.cell.id);
      let row = -1;
      const mine = (isP(s) ? B.contactRows : B.contactRowsE) || [];
      for (let i = 0; i < f.h; i++) { const rr = pc.r + i, fr = rowFront(s, rr); if (fr && fr.cell === pc.cell && mine.includes(rr)) row = rr; }
      if (!alive(pc.cell) || row < 0) continue;
      const key = `${pc.r},${pc.c}`;
      s.punchT[key] = (s.punchT[key] || 0) - dt;
      if (s.punchT[key] > 0) continue;
      s.punchT[key] = M.piston.punchCd;
      const tr = row + (isP(s) ? 1 : -1) * (B.rowShift || 0);   // 对方那边同一高度的行
      const tgt = tr >= 0 && tr < K.ROWS ? rowFront(o, tr) : null;
      if (!tgt) continue;
      const dc = tgt.c;
      s.punch[key] = 1;
      s.heat += M.piston.heat;
      damage(o, s, { layer: 'body', r: tgt.r, c: dc }, SA.armorCut(SA.mod(tgt.cell), SA.mod(pc.cell).punch));
      shove(s, o, 30);   // 撞锤的推力同样是一对冲量：推重车时自己被弹开得更多
      const x = frontEdge(s), y = cellY(row, s) + HALF;
      for (let i = 0; i < 10; i++) part('steam', x, y, rnd(-90, 90), rnd(-120, -15), rnd(0.4, 0.8));
      B.shake = Math.max(B.shake, 4);
    }
  }

  // ---------- 模拟 ----------
  function sim(s, o, dt) {
    if (s.dead) { drive(s, dt); return; }
    const util = s.supply ? Math.min(1, s.demand / s.supply) : 0;
    s.power = s.supply <= 0 ? 0 : s.demand ? Math.min(1, s.supply / s.demand) : 1;
    drive(s, dt);
    s.heat += (s.heatRate * Math.max(0.3, util) + K.IDLE_HEAT - K.DISSIPATE) * dt;
    if (s.water > 0 && s.heat > 0) {
      const c = Math.min(s.heat, SA.coolRate(s.cool, s.heat) * dt);
      s.heat -= c; s.water = Math.max(0, s.water - c * K.WATER_PER_HEAT);
    }
    s.heat = Math.max(0, s.heat);
    if (s.heat >= K.HEAT_MAX) { kill(s, '锅炉烧干，机器停摆'); return; }
    const aimPt = isHuman(s) ? B.aim : aiAimPoint(s, o);
    const aiming = s.fireHeld && aimPt && s.power > 0 && !s.hold && !o.dead;
    // 玩家松开按键的这一帧也算开火（提前松手 = 用当前稳定度打出去）
    const firing = aiming || (isHuman(s) && s.release && aimPt && s.power > 0 && !o.dead);
    const at = firing ? targetAt(o, aimPt[0], aimPt[1]) : null;
    const side = !!at && at.layer === 'side';
    // 瞄准稳定度：按住就慢慢蓄满（准星收紧、散布缩小），车身晃动会拖慢蓄力并不断把它抖散
    const selW = s.weapons.find(w => w.cell.id === s.sel && !w.blocked);
    const shake = shakeOf(s);
    if (aiming) s.focus += dt * s.aimSpeed / (selW ? selW.m.aimT : 1) / (1 + shake);
    s.focus = clamp(s.focus - dt * (aiming ? shake * 0.2 : 2.5), 0, 1);
    // 扳机延迟（AI 用）：按住开火后要等一小会儿才打出第一发；换武器组重新计时
    if (s.sel !== s.lastSel) { s.lastSel = s.sel; s.heldT = 0; s.focus = 0; }
    s.heldT = aiming ? s.heldT + dt : 0;
    // 玩家：稳定度蓄满（绿光）自动开火，或者松手立刻开火
    // 快枪（机枪）：按住装好就打，不用等蓄满；稳定度照样影响散布，每发后坐会把它震掉一些
    const ready = (w) => (isHuman(s) ? s.focus >= 1 || s.release || w.m.reload < K.FAST_RELOAD : s.heldT >= w.m.windup);
    // 多出来的驾驶员：每人接管一组「当前没在手操」的武器，自己挑目标开火（枪法比玩家差）
    s.coGroups = s.copilots ? s.groups.filter(g => g !== s.sel).slice(0, s.copilots) : [];
    const coPt = s.coGroups.length && !o.dead && s.power > 0 && !s.hold ? copilotAim(s, o, dt) : null;
    const coAt = coPt ? targetAt(o, coPt[0], coPt[1]) : null;
    // 装填：先把所有炮的装填计时推进一步
    for (const w of s.weapons) {
      if (w.blocked) continue;
      if (s.timers[w.key] == null) s.timers[w.key] = rnd(0.2, 0.8) * w.m.reload;
      s.timers[w.key] -= dt * s.power;
    }
    // 手操的这一组是齐射：组里每门炮都装好了才一起开火（其他驾驶员管的组照旧各打各的）
    const salvo = s.weapons.filter(w => !w.blocked && w.cell.id === s.sel);
    const salvoReady = salvo.length > 0 && salvo.every(w => s.timers[w.key] <= 0);
    const salvoGo = salvoReady && firing && salvo.every(w => ready(w));
    const again = rnd(0.95, 1.05);   // 同一轮齐射用同一个装填时间，下一轮还是一起好
    for (const w of s.weapons) {
      if (w.blocked) continue;
      const mine = w.cell.id === s.sel, co = !mine && s.coGroups.includes(w.cell.id);
      const pt = co ? coPt : aimPt;
      // 炮管以有限角速度转向瞄准点
      const cur = barrel(s, w), want = pt ? aimAngle(s, w, pt[0], pt[1]).a : cur;
      s.elev[w.key] = cur + clamp(want - cur, -w.m.slew * dt, w.m.slew * dt);
      if (s.timers[w.key] > 0) continue;
      if (mine) {
        if (salvoGo) { fire(s, o, w, side); s.timers[w.key] = w.m.reload * again; s.kick = w.m.reload < K.FAST_RELOAD ? K.FOCUS_KICK_FAST : K.FOCUS_KICK; }
        else s.timers[w.key] = 0;
      } else if (co && coPt && Math.abs(want - cur) < 3) { fire(s, o, w, !!coAt && coAt.layer === 'side', 0.4); s.timers[w.key] = w.m.reload * rnd(1, 1.2); }
      else s.timers[w.key] = 0;
    }
    if (s.kick) { s.focus *= s.kick; s.kick = 0; }   // 后坐力把准星震开（快枪只震掉一点）
    s.release = false;
    s.smokeT -= dt;
    if (s.smokeT <= 0) {
      s.smokeT = 0.45 - Math.min(0.35, s.heat / 280);
      SA.V.each(s.v, (cell, r, c, layer) => {
        if (layer !== 'body' || !alive(cell)) return;
        if (cell.id === 'boiler') part('steam', modBox(s, r, c, cell.id).x0 + (isP(s) ? 37 : 11), cellY(r, s), rnd(-12, 12), rnd(-66, -36), rnd(0.8, 1.4));
        if (cell.hp / SA.V.maxHp(cell) < 0.34 && Math.random() < 0.5) part('smoke', modCenter(s, layer, r, c)[0], cellY(r, s) + 12, rnd(-12, 12), -42, 1.2);
      });
    }
  }

  // ---------- AI ----------
  function aiAimPoint(s, o) {
    const t = s.target;
    if (!t) return null;
    const [x, y] = modCenter(o, t.layer, t.r, t.c);
    return [x + s.err.x, y + s.err.y];
  }
  // 按权重随机挑一个敌方模块当目标：武器、驾驶舱、锅炉优先
  function pickTarget(o) {
    const cands = [];
    SA.V.each(o.v, (cell, r, c, layer) => {
      if (!alive(cell)) return;
      const id = cell.id;
      const w = layer === 'side' ? 3 : M[id].dmg ? 2.5 : SA.isCockpit(id) ? 2 : id === 'boiler' ? 1.6 : id === 'water' ? 1.2 : M[id].layer === 'chassis' ? 0.3 : 0.6;
      cands.push({ w, t: { layer, r, c } });
    });
    let x = Math.random() * cands.reduce((a, b) => a + b.w, 0);
    for (const cnd of cands) { x -= cnd.w; if (x <= 0) return cnd.t; }
    return null;
  }
  // 其他驾驶员的瞄准点：自己挑目标，几秒换一次，带固定的手抖误差
  function copilotAim(s, o, dt) {
    const co = s.co;
    co.retarget -= dt;
    if (!co.target || !alive(o.v[co.target.layer][co.target.r][co.target.c]) || co.retarget <= 0) {
      co.target = pickTarget(o);
      co.err = { x: gauss() * 34, y: gauss() * 20 };
      co.retarget = rnd(3, 6);
    }
    if (!co.target) return null;
    const [x, y] = modCenter(o, co.target.layer, co.target.r, co.target.c);
    return [x + co.err.x, y + co.err.y];
  }
  function ai(s, o, dt) {
    if (s.dead) return;
    if (s.heat > 72) s.hold = true; else if (s.heat < 45) s.hold = false;
    s.retarget -= dt;
    const tAlive = s.target && alive(o.v[s.target.layer][s.target.r][s.target.c]);
    if (!tAlive || s.retarget <= 0) {
      s.target = pickTarget(o);
      const e = (1 - s.aim) * 100 + 9;
      s.err = { x: gauss() * e, y: gauss() * e * 0.6 };
      s.retarget = rnd(3, 6);
      // 选武器组：直射打得到就直射，否则换高抛
      s.sel = s.groups[Math.floor(Math.random() * s.groups.length)] || null;
      if (s.target && s.target.layer === 'body' && s.groups.includes('mortar')) {
        const w = s.weapons.find(x => !x.blocked && (x.cell.id === 'cannon' || x.cell.id === 'cannon_m'));
        const pt = aiAimPoint(s, o);
        const pr = w && predict(s, o, w, aimAngle(s, w, pt[0], pt[1]).a, false);
        if (!pr || !pr.hit || pr.hit.c !== s.target.c || pr.hit.r !== s.target.r) s.sel = 'mortar';
      }
    }
    s.fireHeld = !!s.target;
    // 移动：按性格来。默认 = 有撞击武器就周期性冲撞，否则在交战距离内游走；
    // rush 冲锋：几乎一直在冲，退也只退一小段助跑；kite 放风筝：保持远距离，很少冲撞；turtle 龟缩：守在出发点附近
    s.moveT -= dt;
    if (s.moveT <= 0) {
      const sty = s.style;
      s.charge = s.rams > 0 && sty !== 'turtle' && (sty === 'rush' ? !s.charge || Math.random() < 0.35 : !s.charge && Math.random() < (sty === 'kite' ? 0.15 : 0.7));
      const [lo, hi] = sty === 'kite' ? [400, 640] : sty === 'rush' ? [70, 260] : [140, 520];
      const fwd = isP(s) ? 1 : -1, gap = fwd * (frontEdge(o) - frontEdge(s));   // 两车车头之间的距离
      s.goalX = sty === 'turtle' ? s.homeX + rnd(-40, 40) : s.x + fwd * (gap - rnd(lo, hi));
      s.moveT = s.charge ? rnd(3, 5) : rnd(2, 5) * (s.speed > 70 ? 0.6 : 1);
    }
    if (s.charge) { s.dir = isP(s) ? 1 : -1; if (B.contact && Math.abs(s.vx) < 10) s.moveT = Math.min(s.moveT, 0.4); }
    else s.dir = Math.abs(s.goalX - s.x) > 8 ? Math.sign(s.goalX - s.x) : 0;
  }

  // 失去战斗力：没有动力（锅炉全毁），或者没有能开火的武器。返回原因，否则为 null
  function crippled(s) {
    if (s.supply <= 0) return '失去动力';
    if (!s.weapons.some(w => !w.blocked)) return '没有能开火的武器';
    return null;
  }
  // 彻底没法打：开不了火，也撞不了人（有撞击件、有动力、能开动就还算能打）
  const helpless = (s) => !!crippled(s) && !(s.rams && s.supply > 0 && s.speed > 0);

  // 投降：对手彻底没法打、而玩家还能打，持续 1 秒就挂白旗。战斗暂停，玩家选择接受（立即获胜，额外声望）还是继续打
  // 只有对手会投降（玩家没了武器还能等对手烧干）；无画面模拟里视为玩家接受投降
  // 剩余耐久比例（含已损毁的模块）
  const hpFrac = (s) => { let a = 0, m = 0; SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); }); return a / Math.max(1, m); };
  // 对手想不想投降：返回理由，否则 null
  // ① 彻底没法打（开不了火、也撞不了人）；② 开不了火、只剩撞击件，耐久不到一半；③ 残血（不到 20%）而你的耐久比例是它的 3 倍以上
  // Boss 有骨气：只有 ① 才投降
  function quitReason(e, p) {
    if (helpless(e)) return crippled(e);
    if (e.boss) return null;
    const fe = hpFrac(e);
    if (crippled(e) && fe < 0.5) return `${crippled(e)}，只剩撞击件`;
    if (fe < 0.2 && hpFrac(p) >= fe * 3) return '伤得太重，打不下去了';
    return null;
  }
  function surrender(dt) {
    const p = B.p, e = B.e;
    if (p.dead || e.dead || B.surrender) return;
    const why = helpless(p) ? null : quitReason(e, p);
    B.surT = why ? (B.surT || 0) + dt : 0;
    if (B.surT < 1) return;
    if (B.headless) { B.surrender = 'accepted'; kill(e, `${why}，挂白旗投降`); return; }
    B.surrender = 'asked';
    B.frozen = true;
    B.keys.left = B.keys.right = B.keys.fire = false;
    for (let i = 0; i < 12; i++) part('steam', e.x + VW / 2 + rnd(-40, 40), VY + rnd(0, 60), rnd(-20, 20), rnd(-60, -20), rnd(1, 2));
    const resume = (ok) => {
      B.frozen = false;
      if (ok) { B.surrender = 'accepted'; kill(e, `${why}，挂白旗投降`); textFx('投降', e.x + VW / 2, VY + 40, P.white); }
      else B.surrender = 'refused';
    };
    SA.UI.dialog(`「${e.name}」挂出了白旗`, [
      h('p', { style: 'margin-top:0' }, `对手${why}，已经没法再打，请求投降。`),
      h('p', {}, h('b', {}, '接受：'), '立即获胜，对手剩下的零件原样保留（缴获的选择更多），体面收场额外 ', h('b', {}, '声望 +1'), '。'),
      h('p', { class: 'muted' }, '拒绝：比赛继续，你可以把它拆得更彻底；这场不会再问第二次。'),
    ], [{ label: '接受投降', primary: true, onClick: () => resume(true) }], '拒绝，继续打', () => resume(false));
  }

  function step(dt) {
    B.t += dt;
    B.ramCd = Math.max(0, B.ramCd - dt);
    if (B.ter) for (const c of B.ter.crates) { c.shake = Math.max(0, c.shake - dt); c.touch = Math.max(0, (c.touch || 0) - dt); }
    if (B.p.isAI) ai(B.p, B.e, dt);
    else {
      if (!B.p.dead) B.p.dir = (B.keys.right ? 1 : 0) - (B.keys.left ? 1 : 0);
      if (B.p.fireHeld && !B.keys.fire) B.p.release = true;
      B.p.fireHeld = B.keys.fire;
    }
    ai(B.e, B.p, dt);
    sim(B.p, B.e, dt);
    sim(B.e, B.p, dt);
    B.p.anim.step(dt); B.e.anim.step(dt);
    collide();
    pistons(B.p, B.e, dt);
    pistons(B.e, B.p, dt);
    camera(dt);

    for (const sh of B.shots) {
      const n = Math.max(1, Math.ceil(dt * 120));
      for (let i = 0; i < n && !sh.done; i++) {
        const res = advance(sh, sh.to, dt / n);
        if (!res) continue;
        sh.done = true;
        if (res === 'ground') {
          const gy = groundAt(sh.x);
          for (let k = 0; k < 6; k++) part('dust', sh.x, gy, rnd(-75, 75), rnd(-100, -30), rnd(0.3, 0.6));
          if (sh.big) part('smoke', sh.x, gy - 6, 0, -30, 0.8);
        } else if (res.crate != null) {
          hitCrate(res.crate, sh.dmg);
        } else if (res !== 'out') {
          // 护甲：每发先减掉固定伤害（机枪打装甲只冒火星）
          const tc = sh.to.v[res.layer][res.r][res.c];
          damage(sh.to, sh.from, res, tc ? SA.armorCut(SA.mod(tc), sh.dmg) : sh.dmg);
          if (sh.big) B.shake = Math.max(B.shake, 3);
        }
      }
      sh.trail = sh.trail || [];
      sh.trail.push([sh.x, sh.y]);
      if (sh.trail.length > 5) sh.trail.shift();
    }
    B.shots = B.shots.filter(s => !s.done);

    for (const p of B.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'debris' || p.type === 'spark' || p.type === 'dust') { p.vy += 660 * dt; const gy = groundAt(p.x); if (p.y > gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; } }
      if (p.type === 'smoke' || p.type === 'steam') p.vx *= 0.98;
    }
    B.parts = B.parts.filter(p => p.life > 0);
    for (const t of B.texts) { t.life -= dt; t.y -= 42 * dt; }
    B.texts = B.texts.filter(t => t.life > 0);
    B.shake = Math.max(0, B.shake - dt * 14);

    if (!B.ending) {
      surrender(dt);
      // 武器打光：一方开局有武器、现在全被摧毁，而另一方还有 → 判负；两边同时打光走下面的平手
      // 敌方判负：武器打光 + 水烧干 + 没有近战（撞击件）。这条只对敌方生效，玩家不会因此判负
      const e = B.e;
      if (!e.dead && !B.p.dead && e.armed && !e.weapons.length && e.water <= 0 && !e.rams) kill(e, '武器打光、水也烧干，又没有近战手段，失去战斗力');
      // 自测时两边都是 AI，这条规则对称生效
      const p = B.p;
      if (p.isAI && !p.dead && !e.dead && p.armed && !p.weapons.length && p.water <= 0 && !p.rams) kill(p, '武器打光、水也烧干，又没有近战手段，失去战斗力');
      // 平手：双方都没了动力或没有能开火的武器，且场上没有飞行中的炮弹，持续 1.5 秒
      const both = !B.p.dead && !B.e.dead && crippled(B.p) && crippled(B.e) && !B.shots.length;
      B.drawT = both ? (B.drawT || 0) + dt : 0;
      if (B.drawT >= 1.5) {
        B.draw = `双方都${crippled(B.p) === crippled(B.e) ? crippled(B.p) : '失去了战斗力'}，裁判判定平手`;
        B.ending = 1.8;
      }
      if (!B.draw && B.t >= K.BATTLE_TIME && !B.p.dead && !B.e.dead) {
        kill(hpFrac(B.p) >= hpFrac(B.e) ? B.e : B.p, '时间到，剩余耐久较低，裁判判负');
      }
      if (B.p.dead || B.e.dead) B.ending = B.ending || 1.8;
    } else {
      B.ending -= dt;
      if (B.ending <= 0 && !B.done) finish();
    }
  }

  // ---------- 镜头 ----------
  function camera(dt) {
    const pr = cellX(B.p, B.p.minCol), er = cellX(B.e, B.e.minCol) + C;
    const lob = B.p.sel === 'mortar';
    const tz = clamp((W - 60) / (er - pr + 360), ZMIN, lob ? 1.25 : 1.8);
    const cam = B.cam;
    cam.z += (tz - cam.z) * Math.min(1, dt * 3);
    const sw = W / cam.z, sh = H / cam.z;
    const tx = (pr + er) / 2 - sw / 2;   // 场地无限：镜头只跟着两车的中点走
    cam.x += (tx - cam.x) * Math.min(1, dt * 4);
    cam.y = GROUND + 60 - sh;          // 地面始终在画面底部附近
    cam.w = sw; cam.h = sh;
    B.aim = B.aimScreen ? [cam.x + B.aimScreen[0] / cam.z, cam.y + B.aimScreen[1] / cam.z] : null;
  }

  // ---------- 背景：一座圆形竞技场 ----------
  // 场地左右无限延伸。天空固定；远处的厂房和一圈看台画在「圆筒」上：屏幕中间 1:1、越往两边越压缩，
  // 镜头跟着车移动时看台跟着转，看起来像车在绕着圆形竞技场跑。地面（和地形）在世界坐标里，跟车 1:1 移动
  const HZ = GROUND - 240, GS = HZ, GE = GROUND - 110;
  const TW = 1248;   // 可平铺纹理的周期：人群 6、旗 26、柱 48、地面刻痕 48 都能整除
  let BD = null;
  function buildBackdrop() {
    const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return [c, c.getContext('2d')]; };
    let seed = 7;
    const rr = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    // 天空（固定不动）
    const [sky, x] = mk(W, HZ);
    const band = (y0, y1, col) => { x.fillStyle = col; x.fillRect(0, y0, W, y1 - y0); };
    const b1 = Math.round(HZ * 0.3), b2 = Math.round(HZ * 0.62);
    band(0, b1, P.bg[3]); band(b1, b2, P.bg[4]); band(b2, HZ, P.bg[5]);
    for (const [y, col] of [[b1, P.bg[4]], [b2, P.bg[5]]])
      for (let i = 0; i < W; i += 2) { x.fillStyle = col; x.fillRect(i + 1, y - 4, 1, 1); x.fillRect(i, y - 2, 1, 1); x.fillRect(i + 1, y - 1, 1, 1); }
    x.fillStyle = P.bg[6];
    const sunY = Math.round(HZ * 0.42);
    for (let yy = -40; yy <= 40; yy++) { const w = Math.sqrt(1600 - yy * yy); x.fillRect(Math.round(W * 0.76 - w), sunY + yy, Math.round(w * 2), 1); }
    // 远处的厂房：一圈 TW 宽可平铺，画成两圈宽（采样跨过接缝时不用拆两段）
    const [line, y] = mk(TW * 2, HZ);
    for (let i = 0; i < 18; i++) {
      const bx0 = Math.round(rr() * TW), bw = Math.round(48 + rr() * 90), bh = Math.round(40 + rr() * 110), ch = 54 + Math.round(rr() * 40);
      for (const bx of [bx0 - TW, bx0, bx0 + TW, bx0 + 2 * TW]) {
        y.fillStyle = P.bg[3]; y.fillRect(bx, HZ - bh, bw, bh);
        y.fillRect(bx + Math.round(bw * 0.3), HZ - bh - ch, 12, 66);
        y.fillStyle = P.bg[4];
        for (let k = 0; k < Math.floor(bw / 18); k++) y.fillRect(bx + 8 + k * 18, HZ - bh + 14, 6, 9);
      }
    }
    // 看台：人群、彩旗、围栏（一圈 TW，复制成两圈）
    const S0 = GS - 5;
    const [stands, z] = mk(TW * 2, GE + 14 - S0);
    z.fillStyle = P.bg[2]; z.fillRect(0, GS - S0, TW, GE - GS);
    for (let yy = GS + 8; yy < GE - 8; yy += 13) {
      z.fillStyle = P.bg[1]; z.fillRect(0, yy + 9 - S0, TW, 3);
      for (let i = 0; i < TW; i += 6) {
        const v = rr();
        if (v < 0.7) { z.fillStyle = v < 0.25 ? P.bg[4] : v < 0.5 ? P.bg[3] : P.bg[5]; z.fillRect(i, yy + 2 - S0, 4, 6); z.fillRect(i + 1, yy - S0, 2, 2); }
      }
    }
    for (let i = 0; i < TW; i += 26) { z.fillStyle = (i / 26) % 2 ? P.bg[5] : P.bg[4]; z.fillRect(i, 0, 16, 4); z.fillRect(i + 3, 4, 10, 3); z.fillRect(i + 6, 7, 4, 3); }
    z.fillStyle = P.bg[1]; z.fillRect(0, GE - S0, TW, 14);
    for (let i = 0; i < TW; i += 48) { z.fillStyle = P.bg[0]; z.fillRect(i, GE - 6 - S0, 8, 20); }
    z.drawImage(stands, 0, 0, TW, stands.height, TW, 0, TW, stands.height);
    // 地面：世界坐标里平铺（跟车 1:1 移动）
    const F0 = GE + 14;
    const [floor, f] = mk(TW, H - F0);
    f.fillStyle = P.bg[3]; f.fillRect(0, 0, TW, GROUND - F0);
    for (let i = 0; i < 900; i++) { f.fillStyle = rr() < 0.5 ? P.bg[2] : P.bg[4]; f.fillRect(Math.round(rr() * TW), Math.round(rr() * (GROUND - F0)), 4, 1); }
    f.fillStyle = P.bg[2]; f.fillRect(0, GROUND - F0, TW, H - GROUND);
    f.fillStyle = P.bg[4]; f.fillRect(0, GROUND - F0, TW, 1);
    for (let i = 0; i < TW; i += 48) { f.fillStyle = P.bg[1]; f.fillRect(i, GROUND - F0 + 18, 30, 4); }
    return { sky, line, stands, floor, S0, F0 };
  }
  // 圆筒映射：屏幕列 sx → 纹理坐标 rot + asin(u·K0)·R（u = 离屏幕中心的比例）。中间一个屏幕像素 = 1/z 个纹理像素（和世界一样的缩放），两边压缩
  function drum(tex, wy0, rot) {
    const cam = B.cam, z = cam.z, K0 = 0.82, R = (W / 2) / (K0 * z), per = tex.width / 2, th = tex.height;
    const y = Math.round((wy0 - cam.y) * z), hh = Math.ceil(th * z), STEP = 4;
    const tx = (sx) => rot + Math.asin(clamp((sx - W / 2) / (W / 2), -1, 1) * K0) * R;
    let t0 = tx(0);
    for (let sx = 0; sx < W; sx += STEP) {
      const t1 = tx(sx + STEP), u = ((t0 % per) + per) % per;
      dg.drawImage(tex, u, 0, Math.max(0.5, t1 - t0), th, sx, y, STEP, hh);
      t0 = t1;
    }
  }
  // 屏幕空间的背景：天空 → 远处厂房（转得慢）→ 看台（像绕着场地转）→ 两边压暗，显出圆筒感
  function drawBackdrop() {
    const cam = B.cam, z = cam.z, sy = (wy) => Math.round((wy - cam.y) * z);
    dg.fillStyle = P.bg[3]; dg.fillRect(0, 0, W, H);
    const sw = Math.max(W, W * z);
    dg.drawImage(BD.sky, 0, 0, W, HZ, Math.round(W / 2 - sw / 2), sy(0), Math.ceil(sw), Math.ceil(HZ * z));
    drum(BD.line, 0, cam.x * 0.12);
    drum(BD.stands, BD.S0, cam.x * 0.45);
    const bot = sy(GE + 14);   // 从画面顶部一直压到看台底部，不留硬边
    const gr = dg.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, 'rgba(7,8,12,0.6)'); gr.addColorStop(0.2, 'rgba(7,8,12,0)'); gr.addColorStop(0.8, 'rgba(7,8,12,0)'); gr.addColorStop(1, 'rgba(7,8,12,0.6)');
    dg.fillStyle = gr; dg.fillRect(0, 0, W, bot);
  }
  // 世界坐标里的地面：按 TW 平铺，镜头走到哪铺到哪
  function drawFloor() {
    const cam = B.cam;
    for (let x = Math.floor((cam.x - 40) / TW) * TW; x < cam.x + cam.w + 40; x += TW) g.drawImage(BD.floor, x, BD.F0);
  }

  // ---------- 绘制 ----------
  // 地形：土坡填满到地面、泥地一层湿泥、货箱（木板 + 铁包角，越破裂纹越多）
  function drawTerrain() {
    const T = B.ter;
    if (!T) return;
    if (!T.art && ((T.def.hills || []).length || T.mud.length)) T.art = SA.TerrainArt.layer(T.ground, T.mud, W, H, GROUND);   // 土坡 + 泥地：静态像素层，只画一次
    if (T.art) g.drawImage(T.art, 0, 0);
    for (const c of T.crates) {
      if (c.dead) SA.TerrainArt.rubble(g, c.x0 - 6, c.x1 + 6, c.y1);
      else SA.TerrainArt.crate(g, c.x0, c.y0, Math.round(c.x1 - c.x0), Math.round(c.y1 - c.y0), c.hp / c.max, c.shake > 0 ? (Math.floor(B.t * 40) % 2 ? 1 : -1) : 0);
    }
  }

  function draw() {
    const t = B.t;
    g = wc.getContext('2d');
    // 世界画布只装镜头看得到的那一块：先平移到镜头左上角，背景之后在屏幕空间里画
    const cam = B.cam, ox = Math.floor(cam.x), oy = Math.floor(cam.y);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;   // 车身倾斜旋转时用最近邻采样，保持像素块
    g.clearRect(0, 0, wc.width, wc.height);
    g.save();
    g.translate(-ox, -oy);
    drawFloor();
    g.save();
    if (B.shake) g.translate(Math.round(rnd(-B.shake, B.shake)), Math.round(rnd(-B.shake, B.shake)));
    drawTerrain();

    const aimT = B.aim && !B.e.dead ? targetAt(B.e, B.aim[0], B.aim[1]) : null;
    const opts = (s, key, extra) => ({ key, t, heat: s.heat / 100, water: s.water / Math.max(1, s.waterMax), dyn: s.anim, elev: s.elev, punch: s.punch, moving: s.moving, gnd: s.gnd, ...extra });
    const pc = SA.SPR.renderVehicle(B.p.v, opts(B.p, 'bp'));
    const ec = SA.SPR.renderVehicle(B.e.v, opts(B.e, 'be'));
    drawVehicle(B.p, pc); drawVehicle(B.e, ec, aimT);
    overhead(B.p); overhead(B.e);

    // 准星停在模块上：显示它的改装军衔杠
    if (aimT) { const t0 = B.e.v[aimT.layer][aimT.r][aimT.c]; const b0 = modBox(B.e, aimT.r, aimT.c, t0.id); SA.SPR.chevrons(g, Math.round(b0.x0), b0.y0, t0.lv || 0, K.UP_MAX); }
    B.previewInfo = null;
    if (B.aim && !B.p.dead && !B.e.dead) drawPreview(aimT);

    for (const sh of B.shots) {
      const tr = sh.trail || [];
      if (sh.big) {
        for (let i = 0; i < tr.length - 1; i++) { g.fillStyle = i < tr.length - 3 ? P.steam[0] : P.steam[1]; g.fillRect(Math.round(tr[i][0]) - 2, Math.round(tr[i][1]) - 2, 3, 3); }
        g.fillStyle = P.brass[0]; g.fillRect(Math.round(sh.x) - 4, Math.round(sh.y) - 4, 9, 9);
        g.fillStyle = P.brass[2]; g.fillRect(Math.round(sh.x) - 3, Math.round(sh.y) - 3, 7, 7);
        g.fillStyle = P.brass[3]; g.fillRect(Math.round(sh.x) - 3, Math.round(sh.y) - 3, 3, 2);
      } else {
        const p0 = tr[0] || [sh.x, sh.y];
        SA.SPR.useCtx(g); SA.SPR.line(Math.round(p0[0]), Math.round(p0[1]), Math.round(sh.x), Math.round(sh.y), 3, P.fire[3]);
      }
    }
    for (const p of B.parts) {
      const k = p.life / p.max;
      let col, s = 3;
      switch (p.type) {
        case 'fire': col = k > 0.66 ? P.fire[3] : k > 0.33 ? P.fire[2] : P.fire[1]; s = k > 0.5 ? 6 : 3; break;
        case 'flash': col = P.fire[3]; s = 6; break;
        case 'spark': col = P.brass[3]; break;
        case 'dust': col = P.bg[5]; s = 4; break;
        case 'debris': col = p.col; s = 4; break;
        case 'smoke': col = k > 0.5 ? P.dark[3] : P.iron[1]; s = 6 + Math.round((1 - k) * 9); g.globalAlpha = Math.min(1, k * 1.5) * 0.8; break;
        case 'steam': col = k > 0.5 ? P.steam[2] : P.steam[1]; s = 3 + Math.round((1 - k) * 12); g.globalAlpha = Math.min(1, k * 1.2) * 0.7; break;
      }
      g.fillStyle = col;
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      g.globalAlpha = 1;
    }
    for (const tx of B.texts) SA.SPR.text(g, tx.str, tx.x, Math.round(tx.y), tx.col);
    g.restore();

    if (B.aim) {
      const [mx, my] = B.aim.map(Math.round);
      reticle(mx, my, aimT);
      reticleAlerts(mx, my);
    }
    g.restore();
    drawBackdrop();
    dg.imageSmoothingEnabled = false;
    dg.drawImage(wc, cam.x - ox, cam.y - oy, cam.w, cam.h, 0, 0, W, H);
    // 过热：屏幕四周红光呼吸，余光就能看到
    if (!B.p.dead && B.p.heat > 75) {
      const a = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(B.t * 8))) * Math.min(1, (B.p.heat - 75) / 15 + 0.4);
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, 60, 0, 0, W, 60], [0, H, 0, H - 60, 0, H - 60, W, 60], [0, 0, 60, 0, 0, 0, 60, H], [W, 0, W - 60, 0, W - 60, 0, 60, H]]) {
        const gr = dg.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, `rgba(255,40,30,${a})`); gr.addColorStop(1, 'rgba(255,40,30,0)');
        dg.fillStyle = gr; dg.fillRect(rx, ry, rw, rh);
      }
    }
  }

  // 准星：装填中 = 来回摆动的沙漏（外面一圈稳定度环，按住蓄力时跟着收紧）；装好了 = 黄铜齿轮。
  // 按住蓄满自动开火后如果还按着，也照样先变沙漏，装好了再变回齿轮、接着蓄力。
  // 机枪这类快枪（装填 < 1 秒）不切沙漏：齿轮每打一发咔哒转一齿，领头的齿闪一下，内圈细弧显示装填
  // 准星半径跟实际缩圈幅度走：前期只能缩一点，加装瞄准镜后能缩得更紧
  // 准星半径 = 瞄准度（0→100% 从 24 收到 9）；实际散布缩多少由车的缩圈幅度决定，扇区会如实反映
  const reticleR = (focus) => Math.round(24 - 15 * focus);
  function reticle(x, y, aimT) {
    const p = B.p;
    const group = p.weapons.filter(w => w.cell.id === p.sel && !w.blocked);
    const fast = group.length && group[0].m.reload < 1;
    const rl = reloadFrac(p);
    // 正在装填（慢炮）：沙漏，不管按没按住
    if (rl != null && !fast) {
      // 稳定度环：装填时按住也在蓄力，环跟着收紧；蓄满变绿
      g.save(); g.globalAlpha = p.fireHeld ? 0.75 : 0.45; g.lineWidth = 2; g.strokeStyle = p.focus >= 1 ? '#6fcf6a' : P.brass[2];
      g.beginPath(); g.arc(x, y, reticleR(p.focus), 0, Math.PI * 2); g.stroke(); g.restore();
      g.fillStyle = P.black; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = P.white; g.fillRect(x - 1, y - 1, 3, 3);
      // 沙漏像钟摆一样挂在准星上方来回摆
      g.save(); g.translate(x, y - 34); g.rotate(Math.sin(B.t * 4.5) * 0.38);
      hourglass(-11, 0, rl);
      g.restore();
      return;
    }
    let ticks = 0, flash = 0;
    for (const w of group) { ticks += p.anim.feedOf(w.key); flash = Math.max(flash, p.anim.flashOf(w.key)); }
    gearReticle(x, y, p.focus, aimT, { fast, ticks, flash, rl });
    if (aimT && aimT.layer === 'side') {   // 瞄的是侧挂层的侧炮：标一下
      g.font = 'bold 13px sans-serif'; g.textAlign = 'left';
      g.fillStyle = P.black; g.fillText('侧炮', x + 29, y - 13); g.fillStyle = P.white; g.fillText('侧炮', x + 28, y - 14);
    }
  }

  // 黄铜齿轮准星：按住蓄力时齿轮收紧、转动；蓄满（稳定度 100%）闪绿光
  function gearReticle(x, y, focus, aimT, mg) {
    const full = focus >= 1;
    const r = reticleR(focus);
    const rot = focus * Math.PI / 2 + (mg.fast ? mg.ticks * Math.PI / 4 + (B.p.fireHeld ? B.t * 9 : 0) : B.t * (full ? 2 : 0.3));   // 快枪按住时齿轮飞转
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 12);
    const col = full ? (pulse > 0.5 ? '#9dff8a' : '#6fcf6a') : P.brass[2];
    const hi = full ? '#e8ffd9' : P.brass[3];
    g.save();
    if (full) {   // 绿色光晕
      g.globalAlpha = 0.25 + 0.35 * pulse; g.strokeStyle = '#6fcf6a'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, y, r + 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.lineWidth = 7; g.strokeStyle = P.black;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.strokeStyle = col;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1; g.strokeStyle = hi;
    g.beginPath(); g.arc(x, y, r - 1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    // 内圈细弧 = 装填进度（装好了就不画）
    if (mg.rl != null) {
      g.globalAlpha = 0.8; g.lineWidth = 2; g.strokeStyle = hi;
      g.beginPath(); g.arc(x, y, Math.max(3, r - 5), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mg.rl); g.stroke(); g.globalAlpha = 1;
    }
    // 8 个齿（快枪：领头的齿在开火瞬间闪白）
    g.translate(x, y); g.rotate(rot);
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.fillStyle = P.black; g.fillRect(-4, -r - 8, 8, 8);
      g.fillStyle = mg.fast && i === 7 && mg.flash > 0.3 ? '#ffffff' : col; g.fillRect(-2.5, -r - 6.5, 5, 5);
    }
    g.restore();
    // 中心：十字小点
    g.fillStyle = P.black; g.fillRect(x - 3, y - 3, 7, 7);
    g.fillStyle = full ? hi : P.white; g.fillRect(x - 1, y - 1, 3, 3);
  }

  // 当前武器组的装填进度（0 → 1）：齐射要等最慢的那门炮，所以取最小值；全部装好才返回 null
  function reloadFrac(s) {
    if (s.dead || !s.sel) return null;
    let worst = null;
    for (const w of s.weapons) {
      if (w.cell.id !== s.sel || w.blocked) continue;
      const left = Math.max(0, s.timers[w.key] || 0);
      const f = 1 - left / w.m.reload;
      if (worst == null || f < worst) worst = f;
    }
    return worst == null || worst >= 1 ? null : clamp(worst, 0, 1);
  }
  // 跟着准星走的小沙漏：上半沙子漏到下半 = 装填进度
  function hourglass(x, y, f) {
    const S = 2;   // 放大两倍，镜头拉远时也看得清
    const R = (a, b, w, hh, col) => { g.fillStyle = col; g.fillRect(x + a * S, y + b * S, w * S, hh * S); };
    R(-1, -1, 13, 19, P.black);                       // 描边
    R(0, 0, 11, 2, P.brass[2]); R(0, 15, 11, 2, P.brass[2]);   // 上下黄铜盖
    R(0, 2, 1, 13, P.brass[1]); R(10, 2, 1, 13, P.brass[1]);   // 立柱
    const glass = [[2, 7], [2, 7], [3, 5], [4, 3], [5, 1], [5, 1], [4, 3], [3, 5], [2, 7], [2, 7], [2, 7]];
    glass.forEach(([gx, gw], i) => R(gx, 3 + i, gw, 1, P.steam[0]));
    const top = Math.round((1 - f) * 4), bot = Math.round(f * 4);
    for (let i = 0; i < top; i++) { const [gx, gw] = glass[4 - i]; R(gx, 7 - i, gw, 1, P.brass[3]); }
    for (let i = 0; i < bot; i++) { const [gx, gw] = glass[10 - i]; R(gx, 13 - i, gw, 1, P.brass[3]); }
    if (f < 1 && Math.floor(B.t * 10) % 2) R(5, 8, 1, 5 - bot, P.brass[3]);   // 漏下来的细流
  }

  // 画一辆车：起步憋气的颠簸 + 开火反作用的前后晃动与抬头（动态模块里的车身弹簧）；敌方整体镜像
  // 一辆车当前的警报（按紧急程度排序）
  function alertsOf(s) {
    if (s.dead) return [];
    const out = [];
    if (s.heat > 75) out.push(['过热！', '#d8261b']);
    if (s.waterMax && s.water <= 0) out.push(['没水了', '#1c7f99']);
    else if (s.waterMax && s.water / s.waterMax < 0.2) out.push(['水快没了', '#1c7f99']);
    if (s.supply <= 0) out.push(['失去动力', '#d8261b']);
    if (s.thrown) out.push(['履带掉链', '#d8261b']);
    if (!s.weapons.some(w => !w.blocked)) out.push(['没有能开火的武器', '#d8261b']);
    return out;
  }
  // 车顶的小仪表：耐久 / 热量 / 水 三条细条 + 警报字，跟着车走，视线不用离开战场
  function overhead(s) {
    let top = K.ROWS, lo = 1e9, hi = -1e9;
    SA.V.each(s.v, (cell, r, c) => { if (!alive(cell)) return; top = Math.min(top, r); const b = modBox(s, r, c, cell.id); lo = Math.min(lo, b.x0); hi = Math.max(hi, b.x1); });
    if (hi < lo) return;
    let a = 0, m = 0;
    SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); });
    const w = Math.min(150, hi - lo), x = Math.round((lo + hi) / 2 - w / 2), y = Math.round(VY + (s.yo || 0) + top * C - 30);
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    const bar = (yy, f, col, flash) => {
      g.fillStyle = 'rgba(7,8,12,0.8)'; g.fillRect(x - 1, yy - 1, w + 2, 6);
      g.fillStyle = flash && pulse > 0.5 ? '#ffffff' : col; g.fillRect(x, yy, Math.round(w * clamp(f, 0, 1)), 4);
    };
    bar(y, a / Math.max(1, m), '#e4e0d6');
    bar(y + 7, s.heat / K.HEAT_MAX, s.heat > 75 ? '#ff3b2f' : '#ef7a21', s.heat > 75);
    bar(y + 14, s.waterMax ? s.water / s.waterMax : 0, '#46c2c9', s.waterMax && s.water / s.waterMax < 0.2);
    const al = alertsOf(s);
    if (al.length) chips(al, x + w / 2, y - 26, 16);
  }
  // 警报牌：实色底 + 白字 + 黑描边，一排居中，底色随脉冲闪（比细字醒目得多）
  function chips(al, cx, y, size) {
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const pad = 6, hgt = size + 8, gap = 6;
    const ws = al.map(([t]) => Math.ceil(g.measureText(t).width) + pad * 2);
    let x = Math.round(cx - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2);
    al.forEach(([t, col], i) => {
      g.fillStyle = P.black; g.fillRect(x - 2, y - 2, ws[i] + 4, hgt + 4);
      g.fillStyle = col; g.globalAlpha = 0.7 + 0.3 * pulse; g.fillRect(x, y, ws[i], hgt); g.globalAlpha = 1;
      if (pulse > 0.5) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, ws[i] - 2, hgt - 2); }
      g.fillStyle = P.black; g.fillText(t, x + ws[i] / 2 + 1, y + hgt / 2 + 2);
      g.fillStyle = '#ffffff'; g.fillText(t, x + ws[i] / 2, y + hgt / 2 + 1);
      x += ws[i] + gap;
    });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  // 准星下方：玩家自己最要紧的一两条警报（盯着准星也能看到）
  function reticleAlerts(x, y) {
    const al = alertsOf(B.p).slice(0, 2);
    if (al.length) chips(al, x, y + 34, 14);
  }

  // 瞄准高亮：整格白色闪烁 + 白描边，侧炮和普通模块一样，不分颜色
  const hlC = document.createElement('canvas');
  hlC.width = K.ART + 8; hlC.height = K.ART + 8;
  // lx, ly：模块在整车画布里的左上角；w, h：模块像素大小；dx, dy：画到哪（当前坐标系）
  function highlight(cvs, lx, ly, w, h, dx, dy) {
    const x = hlC.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, hlC.width, hlC.height);
    x.drawImage(cvs, lx - 4, ly - 4, w + 8, h + 8, 0, 0, w + 8, h + 8);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w + 8, h + 8);
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    g.globalAlpha = 0.3 + 0.45 * pulse; g.drawImage(hlC, 0, 0, w + 8, h + 8, dx - 4, dy - 4, w + 8, h + 8); g.globalAlpha = 1;
    g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`; g.strokeRect(dx - 1, dy - 1, w + 2, h + 2);
  }

  function drawVehicle(s, cvs, hl) {
    const w = s.anim.body.x;                        // 后坐：本地坐标里往后挪（负 = 被往后推）
    const py = K.ROWS * C;                          // 车身画布底边 = 车底
    const lp = isP(s) ? s.pivX - s.x : s.x + VW - s.pivX;   // 支点（车底中点）在车身画布里的 x
    g.save();
    g.translate(Math.round(s.pivX), Math.round(pivY(s)) - Math.round(s.rock * 2));
    g.rotate(tiltOf(s));                            // 跟着坡度倾斜（整车绕车底中点转）
    if (!isP(s)) g.scale(-1, 1);
    g.translate(w, 0);
    g.rotate(clamp(w * 0.012, -0.06, 0.06));        // 往后坐时车头微微抬起
    g.drawImage(cvs, -lp, -py);
    if (s.dead) g.drawImage(tint(cvs), -lp, -py);
    if (hl) {
      const f = SA.fp(s.v[hl.layer][hl.r][hl.c].id), lx = PADX + hl.c * C, ly = hl.r * C;
      highlight(cvs, lx, ly, f.w * C, f.h * C, lx - lp, ly - py);   // 本地坐标：跟着车身晃动、倾斜、敌方镜像
    }
    g.restore();
  }

  // 命中率估算用的固定分位样本（与 gauss() 同分布），每帧结果稳定不闪
  const QS = (() => { const a = Array.from({ length: 3000 }, gauss).sort((x, y) => x - y); return Array.from({ length: 15 }, (_, i) => a[Math.floor((i + 0.5) / 15 * a.length)]); })();
  const sameCell = (a, b) => a && b && a.layer === b.layer && a.r === b.r && a.c === b.c;

  // 当前武器组的弹道预览：按炮管「当前」仰角画（炮管转动有延迟）。
  // 直射：中心点线 + 散布扇区 + 命中率；高抛：点线 + 落点 ×（指哪打哪）
  function drawPreview(aimT) {
    const side = aimT && aimT.layer === 'side';
    const info = { hit: null, reach: true, blocked: false };
    B.previewInfo = info;
    const p = B.p;
    const w = p.weapons.find(x => x.cell.id === p.sel && !x.blocked);
    if (!w) { info.blocked = p.weapons.some(x => x.cell.id === p.sel); return; }
    const want = aimAngle(p, w, B.aim[0], B.aim[1]), cur = barrel(p, w);
    info.reach = want.reach || w.m.g < 1;
    info.over = want.over;
    info.slewing = Math.abs(want.a - cur) > 1;
    info.windup = p.fireHeld && p.heldT < w.m.windup;
    const pr = predict(p, B.e, w, cur, side);
    const col = P.white;
    const big = w.m.proj === 'shell';
    SA.SPR.useCtx(g);
    const sp = spreadDeg(p, B.e, w);
    // 扇区宽度：散布变大立刻跟上（扇区永远盖住真实散布），变小时慢慢收（不随每一帧的颠簸抖）
    const now = B.t, dtv = Math.min(0.1, now - (B.fanT || now));
    B.fanT = now;
    B.fanSp = B.fanSp == null || B.fanW !== w.key || sp > B.fanSp ? sp : B.fanSp + (sp - B.fanSp) * Math.min(1, dtv * 4);
    B.fanW = w.key;
    if (sp > 0) {
      // 扇区：散布范围内均匀取 17 条弹道，各自飞到真正撞上的模块 / 货箱 / 地面为止（不做长度平滑，终点就是真实落点）；
      // 相邻两条弹道之间围成一条条带，所有条带放进同一条路径一次填满（nonzero 规则，重叠处不会叠深），没有缝也没有锯齿
      const N = 17, rays = [];
      for (let i = 0; i < N; i++) {
        const r0 = predict(p, B.e, w, cur, side, -B.fanSp + 2 * B.fanSp * i / (N - 1));
        rays.push([...r0.pts, r0.end]);
      }
      g.save(); g.globalAlpha = 0.16; g.fillStyle = col; g.beginPath();
      for (let i = 0; i < N - 1; i++) {
        const a = rays[i], b = rays[i + 1];
        g.moveTo(a[0][0], a[0][1]);
        for (let k = 1; k < a.length; k++) g.lineTo(a[k][0], a[k][1]);
        for (let k = b.length - 1; k >= 0; k--) g.lineTo(b[k][0], b[k][1]);
        g.closePath();
      }
      g.fill('nonzero'); g.restore();
      if (aimT) {
        let n = 0;
        for (const q of QS) if (sameCell(predict(p, B.e, w, cur, side, q * sp).hit, aimT)) n++;
        const base = n / QS.length;
        info.chance = Math.round(100 * base * (1 - (w.m.wild || 0) * 0.8));
      }
    }
    pr.pts.forEach(([x, y], i) => {
      if (i % (big ? 2 : 3)) return;
      g.fillStyle = P.black; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, big ? 5 : 4, big ? 5 : 4);
      g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), big ? 3 : 2, big ? 3 : 2);
    });
    if (sp <= 0) {
      const [ex, ey] = pr.end.map(Math.round);
      SA.SPR.line(ex - 6, ey - 6, ex + 6, ey + 6, 4, P.black); SA.SPR.line(ex + 6, ey - 6, ex - 6, ey + 6, 4, P.black);
      SA.SPR.line(ex - 5, ey - 5, ex + 5, ey + 5, 2, col); SA.SPR.line(ex + 5, ey - 5, ex - 5, ey + 5, 2, col);
    }
    if (pr.blocked) info.cover = pr.blocked;   // 弹道被货箱 / 土坡挡住
    if (pr.hit) {
      info.hit = pr.hit;
      if (!sameCell(pr.hit, aimT)) { const b = modBox(B.e, pr.hit.r, pr.hit.c, B.e.v[pr.hit.layer][pr.hit.r][pr.hit.c].id); cornerMark(Math.round(b.x0), Math.round(b.y0), b.x1 - b.x0, b.y1 - b.y0); }
    }
  }

  // 「弹道中心会先打到这个模块」：四个橙色角框（黑边），轻轻呼吸
  function cornerMark(x, y, w, h) {
    const n = Math.max(6, Math.round(Math.min(w, h) * 0.3)), a = 0.65 + 0.35 * Math.sin(B.t * 6);
    g.save();
    for (const [col, lw, off] of [[P.black, 5, 0], ['#ffb347', 3, 0]]) {
      g.globalAlpha = col === P.black ? 0.8 : a; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        g.moveTo(cx + dx * n, cy + off); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * n);
      }
      g.stroke();
    }
    g.restore();
  }

  const tintC = document.createElement('canvas');
  function tint(src) {
    tintC.width = src.width; tintC.height = src.height;
    const x = tintC.getContext('2d');
    x.clearRect(0, 0, src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(7,8,12,0.55)';
    x.fillRect(0, 0, src.width, src.height);
    x.globalCompositeOperation = 'source-over';
    return tintC;
  }

  // ---------- HUD ----------
  function sidePanel(cls) {
    const el = {};
    el.root = h('div', { class: `bt-side ${cls}` },
      el.nm = h('div', { class: 'nm' }),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '耐久'), h('div', { class: 'bar hp' }, el.hp = h('i'))),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '热量'), el.heatBar = h('div', { class: 'bar heat' }, el.heat = h('i'))),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '水'), h('div', { class: 'bar water' }, el.water = h('i'))),
      el.state = h('div', { class: 'state' }));
    return el;
  }
  function updPanel(el, s) {
    let a = 0, m = 0;
    SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); });
    el.nm.textContent = s.name;
    el.hp.style.width = `${(a / Math.max(1, m)) * 100}%`;
    el.heat.style.width = `${Math.min(100, s.heat)}%`;
    el.heatBar.classList.toggle('hot', s.heat > 75);
    el.water.style.width = `${(s.water / Math.max(1, s.waterMax)) * 100}%`;
    const st = [];
    if (s.dead) st.push(s.reason);
    else {
      if (s.power < 1) st.push(`动力 ${Math.round(s.power * 100)}%`);
      if (s.heat > 75) st.push('即将烧干！');
      else if (s.water <= 0) st.push('水已耗尽');
      if (s.hold) st.push('停火降温中');
      if (s.thrown) st.push('履带掉链，无法移动');
      if (s.spooling) st.push('锅炉加压中…');
      const cr = crippled(s);
      if (cr) st.push(cr);
      if (Math.abs(s.vx) > 2) st.push(`${SA.kmh(Math.abs(s.vx))}`);
      if (!s.isAI && s.fireHeld) st.push('开火中');
    }
    // 警报用醒目的闪烁标签，普通状态是灰字
    el.state.innerHTML = '';
    for (const [t] of alertsOf(s)) el.state.append(h('span', { class: 'alert' }, t));
    el.state.append(st.filter(x => !/即将烧干|水已耗尽|履带掉链|失去动力|没有能开火/.test(x)).join(' · '));
  }

  // 武器组槽位：只有 ≥2 组时才显示，数字键切换
  function renderSlots() {
    const p = B.p;
    const sig = p.groups.join(',') + '|' + p.sel + '|' + (p.coGroups || []).join(',');
    if (hud.slotSig === sig) return;
    hud.slotSig = sig;
    hud.slots.innerHTML = '';
    if (p.groups.length < 2) return;
    p.groups.forEach((id, i) => {
      const n = p.weapons.filter(w => w.cell.id === id).length;
      const co = (p.coGroups || []).includes(id);
      hud.slots.append(h('button', { class: `btn small slot ${p.sel === id ? 'on' : ''} ${co ? 'co' : ''}`, title: co ? '另一名驾驶员正在操作这组武器' : '', onclick: () => { p.sel = id; } },
        h('b', {}, `${i + 1}`), ` ${M[id].name} ×${n}`, co ? h('span', { class: 'co-tag' }, '驾驶员') : null));
    });
  }

  function infoText() {
    const p = B.p;
    if (!p.sel) return '没有可用的武器。可以用 A/D 冲撞对手。';
    const head = `<b>${M[p.sel].name}</b>`;
    if (!B.aim) return `${head} · 移动鼠标瞄准，<b>按住左键</b>稳住准星（蓄满闪绿光自动开火，提前松手立刻开火）；<b>A/D</b> 移动与冲撞${p.groups.length > 1 ? '；<b>数字键</b>切换武器' : ''}。`;
    const aimT = targetAt(B.e, B.aim[0], B.aim[1]);
    const pi = B.previewInfo;
    const parts = [head];
    if (pi && pi.blocked) parts.push('<b>这组武器全被己方模块挡住了</b>，换一组武器');
    if (aimT && aimT.layer === 'side') parts.push('瞄准 <span class="side">敌方侧炮（侧挂层）</span>：只打侧炮，不会被前面的装甲挡住');
    else if (aimT) parts.push(`瞄准 <b>敌方${M[B.e.v[aimT.layer][aimT.r][aimT.c].id].name}</b>`);
    else parts.push('准星没有对准敌方模块');
    const alt = p.groups.includes('mortar') && p.sel !== 'mortar' ? ' → 换高抛火炮试试' : '';
    if (pi && pi.over) parts.push(pi.over === 'high' ? `<b>超出射界</b>：目标太高/太近，炮管抬不到 ${M[p.sel].elev[1]}° 以上${alt}` : '<b>超出射界</b>：炮管压不了那么低');
    else if (pi && !pi.reach) parts.push('<b>超出射程，靠近一些</b>');
    else if (pi && pi.slewing) parts.push('炮管转动中…');
    if (aimT && pi && pi.hit && !sameCell(pi.hit, aimT)) parts.push(`弹道中心先打到 <b>「${M[B.e.v[pi.hit.layer][pi.hit.r][pi.hit.c].id].name}」</b>（橙色角框）${alt}`);
    if (aimT && pi && pi.cover && !pi.hit) parts.push(pi.cover === 'crate' ? '弹道被<b>货箱</b>挡住：打烂它、绕过去，或者换高抛' : `弹道打在<b>土坡</b>上：靠近一些${alt || '，或者换高抛'}`);
    if (aimT && pi && pi.chance != null) parts.push(`命中率约 <b>${pi.chance}%</b>（扇区 = 散布范围）`);
    else if (aimT && pi && M[p.sel].indirect) parts.push('高抛：指哪打哪（对方移动会躲开）');
    if (p.fireHeld) parts.push(p.focus >= 1 ? `<b style="color:#6fcf6a">准星稳住了！</b>散布 -${Math.round(p.aimShrink * 100)}%` : `瞄准 ${Math.round(p.focus * 100)}%（散布 -${Math.round(p.aimShrink * p.focus * 100)}%）${shakeOf(p) > 0.4 ? ' · 车身在晃，停稳更快' : ''}`);
    return parts.join(' · ');
  }

  // ---------- 流程 ----------
  function frontShift(v) {
    let m = -1;
    SA.V.each(v, (cell, r, c) => { m = Math.max(m, c + SA.fp(cell.id).w - 1); });
    return m < 0 ? 0 : K.COLS - 1 - m;
  }
  function shiftVeh(v, k) {
    if (!k) return v;
    const out = SA.V.create(v.name);
    SA.V.each(v, (cell, r, c, layer) => { if (c + k >= 0 && c + k < K.COLS) out[layer][r][c + k] = cell; });
    return out;
  }

  const KEYMAP = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'fire' };
  function onKey(e) {
    if (!B || B.done || SA.current !== 'battle') return;
    const k = KEYMAP[e.code];
    if (k) { B.keys[k] = e.type === 'keydown'; e.preventDefault(); }
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && e.type === 'keydown' && B.p.groups.length > 1) {
      const id = B.p.groups[+m[2] - 1];
      if (id) B.p.sel = id;
    }
  }

  // 游戏速度：整场战斗的时间流速（移动、装填、热量、AI、动画全部按它缩放）
  const SPEED_KEY = 'steam_arena_speed_v1';
  function gameSpeed() { try { const v = parseFloat(localStorage.getItem(SPEED_KEY)); return v > 0 ? v : K.GAME_SPEED; } catch (e) { return K.GAME_SPEED; } }
  function speedSlider() {
    const out = h('b', {}, `${gameSpeed().toFixed(2)}×`);
    const range = h('input', { type: 'range', min: 0.3, max: 1.5, step: 0.05, value: gameSpeed(), 'aria-label': '游戏速度',
      oninput: () => { B.speed = +range.value; out.textContent = `${B.speed.toFixed(2)}×`; try { localStorage.setItem(SPEED_KEY, String(B.speed)); } catch (e) { /* ignore */ } },
      onchange: () => range.blur() });
    return h('label', { class: 'bt-speed', title: '游戏速度：拖动试试什么节奏合适' }, '速度', range, out);
  }

  function holdBtn(label, key) {
    const b = h('button', { class: 'btn' }, label);
    const set = (v) => (e) => { e.preventDefault(); if (B) B.keys[key] = v; };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, set(false));
    return b;
  }

  function start(opts) {
    SA.go('battle');
    const d = SA.S.d;
    const pShift = frontShift(d.vehicle);
    const pv = shiftVeh(SA.V.battleCopy(d.vehicle, 1, opts.mode === 'friendly'), pShift);
    const ev = shiftVeh(SA.V.battleCopy(opts.enemyVehicle, opts.hpMul || 1, true), frontShift(opts.enemyVehicle));
    B = { opts, pShift, ter: makeTerrain(opts.terrain), t: 0, shots: [], parts: [], texts: [], shake: 0, aim: null, ending: 0, done: false, hudT: 0, ramCd: 0, contact: false,
      speed: gameSpeed(), keys: { left: false, right: false, fire: false }, cam: { x: 0, y: 0, z: 1, w: W, h: H }, aimScreen: null };
    B.p = makeSide(pv, d.vehicle.name, false, 1, W / 2 - 200 - PADX - K.COLS * C);
    B.e = makeSide(ev, opts.enemyName, true, opts.aim || 0.9, W / 2 + 200 - PADX);
    B.e.style = opts.style || null;
    B.e.boss = !!opts.boss;
    BD = BD || buildBackdrop();

    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    cv = h('canvas', { class: 'px', width: W, height: H });
    dg = cv.getContext('2d');
    wc = document.createElement('canvas'); wc.width = Math.ceil(W / ZMIN) + 4; wc.height = Math.ceil(H / ZMIN) + 4;   // 镜头拉到最远时也装得下
    g = wc.getContext('2d');
    hud.p = sidePanel('player');
    hud.e = sidePanel('enemy');
    hud.timer = h('div', { class: 'bt-timer' });
    hud.info = h('div', { class: 'bt-info' });
    hud.slots = h('div', { class: 'bt-slots' });
    hud.slotSig = null;
    hud.vent = h('button', { class: 'btn', onclick: () => {
      if (B.p.vented || B.p.dead) return;
      B.p.vented = true; B.p.heat = Math.max(0, B.p.heat - 35);
      for (let i = 0; i < 30; i++) part('steam', B.p.x + VW / 2 + rnd(-90, 90), VY + rnd(30, 240), rnd(-120, 120), rnd(-150, -30), rnd(0.6, 1.3));
      hud.vent.disabled = true;
    } }, '紧急泄压（限一次）');
    wrap = h('div', { class: 'bt-canvas-wrap' }, cv);
    screen.append(h('div', { class: 'bt' },
      h('div', { class: 'bt-hud' }, hud.p.root, hud.timer, hud.e.root),
      wrap,
      h('div', { class: 'bt-bottom' },
        h('div', { class: 'bt-ctrl' }, holdBtn('◀ 后退', 'left'), holdBtn('前进 ▶', 'right'), holdBtn('开火', 'fire')),
        hud.slots, hud.info, speedSlider(), hud.vent,
        h('button', { class: 'btn', onclick: () => { if (!B.p.dead) SA.UI.dialog('撤出比赛', h('p', {}, '确定撤出？这会判负。'), [{ label: '撤退', primary: true, onClick: () => kill(B.p, '主动撤出比赛') }], '继续比赛'); } }, '撤退'))));

    const toNative = (e) => {
      const rc = cv.getBoundingClientRect();
      return [(e.clientX - rc.left) / rc.width * W, (e.clientY - rc.top) / rc.height * H];
    };
    cv.addEventListener('pointermove', (e) => { B.aimScreen = toNative(e); });
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') B.aimScreen = null; B.keys.fire = false; });
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      B.aimScreen = toNative(e);
      if (e.button !== 0) return;
      B.keys.fire = true;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointerup', () => { B.keys.fire = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('resize', fit);
    fit();
    camera(1);
    let last = performance.now();
    const mine = B;   // 每场战斗一个循环：换了新的一场，旧循环自己退出
    const loop = (now) => {
      if (SA.current !== 'battle' || B !== mine || B.done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!B.frozen) step(dt * B.speed);   // frozen：调试 / 测试时暂停实时推进，只用 debug.step 手动推
      draw();
      hudTick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function hudTick(dt) {
    B.hudT -= dt;
    if (B.hudT > 0) return;
    B.hudT = 0.1;
    updPanel(hud.p, B.p); updPanel(hud.e, B.e);
    hud.timer.innerHTML = `${Math.max(0, Math.ceil(K.BATTLE_TIME - B.t))}<small>${B.ter.def.name}</small>`;
    hud.info.innerHTML = infoText();
    renderSlots();
  }

  function fit() {
    if (!wrap || !wrap.isConnected) return;
    const aw = wrap.clientWidth - 16;
    const ah = Math.max(240, window.innerHeight - 250);
    let s = Math.min(aw / W, ah / H);
    if (s >= 2) s = Math.floor(s);
    cv.style.width = `${Math.round(W * s)}px`;
    cv.style.height = `${Math.round(H * s)}px`;
  }

  function finish() {
    B.done = true;
    if (B.headless) {
      B.result = { winner: B.draw ? 'draw' : B.e.dead && !B.p.dead ? 'p' : B.p.dead && !B.e.dead ? 'e' : 'draw',
        t: B.t, reason: B.draw || (B.e.dead ? B.e.reason : B.p.reason), pDealt: B.p.dealt, eDealt: B.e.dealt };
      return;
    }
    window.removeEventListener('resize', fit);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    const draw = !!B.draw;
    const win = !draw && !B.p.dead && B.e.dead;
    let flawless = true;
    SA.V.each(B.p.v, (cell) => { if (SA.isCockpit(cell.id) && cell.hp < SA.V.maxHp(cell)) flawless = false; });
    // 对手还完好的模块：战役胜利后可以挑一件缴获
    const survivors = [];
    SA.V.each(B.e.v, (cell) => { if (cell.hp > 0) survivors.push({ id: cell.id, mt: cell.mt || 1 }); });
    SA.UI.afterBattle({
      mode: B.opts.mode, opts: B.opts, win, draw, prize: B.opts.prize || 0, enemyName: B.e.name,
      reason: draw ? B.draw : win ? `「${B.e.name}」${B.e.reason}` : `你的「${B.p.name}」${B.p.reason}`, surrendered: win && B.surrender === 'accepted',
      playerVehicle: shiftVeh(B.p.v, -B.pShift), survivors, dealt: B.p.dealt, taken: B.p.taken, time: B.t, flawless: win && flawless,
    });
  }

  // ---------- 无画面模拟（tools/sim.html 数值自测用）----------
  // 两边都交给 AI，按固定步长一口气打完，返回 { winner: 'p' | 'e' | 'draw', t, reason, pDealt, eDealt }
  // o = { p: 载具, e: 载具, pAim, eAim, pStyle, eStyle, eBoss, terrain, dt }
  function simulate(o) {
    const keep = B;
    const pS = frontShift(o.p), eS = frontShift(o.e);
    B = { headless: true, opts: { mode: 'sim' }, pShift: pS, ter: makeTerrain(o.terrain), t: 0, shots: [], parts: [], texts: [], shake: 0, aim: null, ending: 0, done: false, hudT: 0, ramCd: 0, contact: false,
      speed: 1, keys: { left: false, right: false, fire: false }, cam: { x: 0, y: 0, z: 1, w: W, h: H }, aimScreen: null };
    try {
      B.p = makeSide(shiftVeh(SA.V.battleCopy(o.p, 1, true), pS), 'A', true, o.pAim || 0.8, W / 2 - 200 - PADX - K.COLS * C);
      B.p.style = o.pStyle || null;
      B.e = makeSide(shiftVeh(SA.V.battleCopy(o.e, 1, true), eS), 'B', true, o.eAim || 0.8, W / 2 + 200 - PADX);
      B.e.style = o.eStyle || null;
      B.e.boss = !!o.eBoss;
      const dt = o.dt || 1 / 30;
      while (!B.done && B.t < K.BATTLE_TIME + 10) step(dt);
      return B.result || { winner: 'draw', t: B.t, reason: '超时', pDealt: B.p.dealt, eDealt: B.e.dealt };
    } finally { B = keep; }
  }

  // 调试：预览环境里 rAF 可能不跑，可手动推进
  const debug = {
    step(sec = 1) { for (let i = 0; i < sec * 60; i++) { if (B.done) break; step(1 / 60); } draw(); hudTick(1); return { t: B.t, px: B.p.x, ex: B.e.x, pv: B.p.vx, ev: B.e.vx, ph: B.p.heat, eh: B.e.heat, pd: B.p.dead, ed: B.e.dead }; },
    get B() { return B; },
    cellCenter(side, r, c, layer = 'body') { const s = side === 'e' ? B.e : B.p; return modCenter(s, layer, r, c); },
    aimWorld(x, y) { const cam = B.cam; B.aimScreen = [(x - cam.x) * cam.z, (y - cam.y) * cam.z]; camera(0); },
  };
  return { start, simulate, debug };
})();
