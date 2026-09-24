// 竞技场：加速/撞击、直射与高抛弹道 + 弹道预览、数字键切换武器、侧挂层优先、热量/水、AI
window.SA = window.SA || {};

SA.Battle = (() => {
  const h = SA.h, K = SA.K, M = SA.MODULES, P = SA.PAL, C = K.CELL, PADX = SA.SPR.PADX;
  const W = 1280, H = 720, GROUND = 648, VY = GROUND - K.ROWS * C;
  const VW = K.COLS * C + PADX * 2;
  const HALF = C / 2;
  const alive = SA.V.alive;
  const GROUP_ORDER = ['cannon', 'mortar', 'mg', 'side_cannon'];
  let B = null, cv, g, dg, wc, bg, wrap, hud = {};

  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- 阵营 ----------
  function makeSide(v, name, isAI, aim, x) {
    const s = { v, name, isAI, aim, x, vx: 0, heat: 0, water: 0, timers: {}, recoil: {}, punch: {}, punchT: {}, dead: false, reason: '',
      vented: false, hold: false, dealt: 0, taken: 0, smokeT: 0, dir: 0, phase: 0, moving: false,
      fireHeld: false, sel: null, target: null, retarget: 0, moveT: 0, goalX: x, charge: false, err: { x: 0, y: 0 },
      elev: {}, heldT: 0, lastSel: null, thrown: false, brakeT: 0, spool: 0, spoolDir: 0, chuffT: 0, rock: 0, spooling: false };
    refresh(s);
    s.water = s.waterMax;
    s.armed = s.weapons.length > 0;   // 开局有武器：武器全被打光就判负
    return s;
  }

  function refresh(s) {
    let supply = 0, demand = 0, heatRate = 0, cool = 0, waterMax = 0, ev = 0, acc = 0, ch = 0, sp = 0, cock = 0, mass = 0, rams = 0, minCol = K.COLS, frontCol = -1;
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (!alive(cell)) return;
      const m = M[cell.id];
      minCol = Math.min(minCol, c);
      if (layer === 'body') frontCol = Math.max(frontCol, c);
      supply += m.supply || 0; demand += m.power || 0; heatRate += m.heatRate || 0;
      cool += m.cool || 0; waterMax += m.water || 0; mass += m.mass || 1;
      if (m.layer === 'chassis') { ch++; ev += m.evade || 0; acc += m.acc || 0; sp += m.speed; }
      if (m.layer === 'ram') rams++;
      if (cell.id === 'cockpit') cock++;
    });
    // 履带是一个整体：任意一段被毁 = 掉链子，整车趴窝
    let thrown = false;
    SA.V.each(s.v, (cell) => { if (cell.id === 'track' && cell.hp <= 0) thrown = true; });
    Object.assign(s, { supply, demand, heatRate, cool, waterMax, minCol, frontCol, rams, mass: Math.max(1, mass), thrown,
      evade: ch ? ev / ch : 0, acc: ch ? acc / ch : 0, speed: thrown ? 0 : ch ? sp / ch : 0, cockpits: cock });
    s.water = Math.min(s.water, waterMax);
    const blocked = SA.V.blockedList(s.v);
    s.weapons = [];
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (!alive(cell) || !M[cell.id].dmg) return;
      s.weapons.push({ cell, r, c, layer, m: M[cell.id], key: `${r},${c},${layer === 'side' ? 's' : 'b'}`,
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
    for (let i = 0; i < 50; i++) part('steam', s.x + VW / 2 + rnd(-120, 120), VY + 120 + rnd(-90, 90), rnd(-30, 30), rnd(-90, -24), rnd(1, 2.2));
  }

  // ---------- 坐标 ----------
  const isP = (s) => s === B.p;
  const cellX = (s, c) => (isP(s) ? s.x + PADX + c * C : s.x + VW - PADX - (c + 1) * C);
  const cellY = (r) => VY + r * C;
  const frontEdge = (s) => (isP(s) ? cellX(s, s.frontCol) + C : cellX(s, s.frontCol));
  function cellAt(s, x, y) {
    const r = Math.floor((y - VY) / C);
    const c = isP(s) ? Math.floor((x - s.x - PADX) / C) : Math.floor((s.x + VW - PADX - x) / C);
    return r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS ? { r, c } : null;
  }
  function muzzle(s, w) {
    const x0 = cellX(s, w.c), y0 = cellY(w.r);
    if (w.cell.id === 'mortar') return [isP(s) ? x0 + 36 : x0 + C - 36, y0 + 8];
    const y = y0 + (w.cell.id === 'side_cannon' ? 34 : w.cell.id === 'mg' ? 29 : 27);
    return [isP(s) ? x0 + C + w.m.barrel : x0 - w.m.barrel, y];
  }
  // 准星优先级：侧挂层 > 主体层
  function targetAt(def, x, y) {
    const cell = cellAt(def, x, y);
    if (!cell) return null;
    if (alive(def.v.side[cell.r][cell.c])) return { layer: 'side', ...cell };
    if (alive(def.v.body[cell.r][cell.c])) return { layer: 'body', ...cell };
    return null;
  }

  // ---------- 弹道 ----------
  function solve(x0, y0, tx, ty, v, gr, high) {
    const dx = Math.max(1, Math.abs(tx - x0)), dy = y0 - ty, v2 = v * v;
    const disc = v2 * v2 - gr * (gr * dx * dx + 2 * dy * v2);
    if (disc < 0) return { a: Math.PI / 4, reach: false };
    const sq = Math.sqrt(disc);
    return { a: Math.atan((v2 + (high ? sq : -sq)) / (gr * dx)), reach: true };
  }
  // 散布（最大偏角，度）：只有直射武器有；高抛指哪打哪。边走边打散布更大
  const spreadDeg = (s, o, w) => (w.m.indirect ? 0 : w.m.spread * (1 - s.acc * 5) + o.evade * 20 + Math.min(1, Math.abs(s.vx) / 100) * 1.2);
  // 瞄准点 → 炮管该抬到的仰角（度），受射界限制
  function aimAngle(s, w, tx, ty) {
    const [x0, y0] = muzzle(s, w);
    const sol = solve(x0, y0, tx, ty, w.m.v, K.GRAVITY * w.m.g, w.m.arc === 'high');
    const raw = sol.a * 180 / Math.PI, [lo, hi] = w.m.elev;
    return { a: clamp(raw, lo, hi), reach: sol.reach, over: sol.reach && raw > hi ? 'high' : sol.reach && raw < lo ? 'low' : null };
  }
  const barrel = (s, w) => (s.elev[w.key] != null ? s.elev[w.key] : w.m.rest);
  function launch(s, w, deg, jitter) {
    const [x0, y0] = muzzle(s, w);
    const a = (deg + jitter) * Math.PI / 180;
    const dir = isP(s) ? 1 : -1;
    return { x: x0, y: y0, vx: dir * w.m.v * Math.cos(a), vy: -w.m.v * Math.sin(a), g: K.GRAVITY * w.m.g };
  }
  // 推进一步并检测命中：侧挂模式只和侧挂层碰撞
  function advance(sh, def, dt) {
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += sh.g * dt;
    const cell = cellAt(def, sh.x, sh.y);
    if (cell) {
      if (sh.side) { if (alive(def.v.side[cell.r][cell.c])) return { layer: 'side', ...cell }; }
      else if (alive(def.v.body[cell.r][cell.c])) return { layer: 'body', ...cell };
    }
    if (sh.y >= GROUND) return 'ground';
    if (sh.x < -80 || sh.x > W + 80 || sh.y > H) return 'out';
    return null;
  }
  function predict(s, o, w, deg, side, jitter = 0) {
    const sh = { ...launch(s, w, deg, jitter), side };
    const pts = [];
    for (let i = 0; i < 600; i++) {
      const res = advance(sh, o, 1 / 120);
      if (i % 4 === 0) pts.push([sh.x, sh.y]);
      if (res) return { pts, hit: typeof res === 'object' ? res : null, end: [sh.x, sh.y] };
    }
    return { pts, hit: null, end: [sh.x, sh.y] };
  }

  // ---------- 特效 ----------
  function part(type, x, y, vx, vy, life, col) { B.parts.push({ type, x, y, vx, vy, life, max: life, col }); }
  function textFx(str, x, y, col) { B.texts.push({ str, x, y, life: 0.9, col }); }
  function boom(x, y, n = 18) {
    for (let i = 0; i < n; i++) part('fire', x, y, rnd(-130, 130), rnd(-160, 30), rnd(0.3, 0.7));
    for (let i = 0; i < n / 2; i++) part('debris', x, y, rnd(-160, 160), rnd(-250, -60), rnd(0.8, 1.4), Math.random() < 0.5 ? P.iron[2] : P.dark[3]);
    for (let i = 0; i < n / 3; i++) part('smoke', x + rnd(-12, 12), y, rnd(-20, 20), rnd(-70, -30), rnd(1, 1.8));
    B.shake = Math.max(B.shake, 7);
  }

  // ---------- 开火与伤害 ----------
  // 按炮管当前仰角开火：炮管还没转到位就扣扳机，炮弹就飞向炮管指的地方
  function fire(s, o, w, side) {
    let jit = gauss() * spreadDeg(s, o, w);
    if (Math.random() < (w.m.wild || 0)) jit += (Math.random() < 0.5 ? -1 : 1) * rnd(1.4, 2.6) * w.m.spread; // 偏弹
    const sh = launch(s, w, barrel(s, w), jit);
    B.shots.push({ ...sh, side, from: s, to: o, dmg: w.m.dmg, big: w.m.proj === 'shell' });
    s.heat += w.m.heat;
    s.water = Math.max(0, s.water - w.m.heat * K.FIRE_WATER);
    s.recoil[w.key] = 1;
    const dir = isP(s) ? 1 : -1, up = w.m.arc === 'high';
    for (let i = 0; i < (w.m.proj === 'shell' ? 10 : 3); i++) part('flash', sh.x + dir * rnd(0, 10), sh.y + rnd(-3, 3) - (up ? rnd(0, 8) : 0), dir * rnd(30, 110), up ? rnd(-140, -40) : rnd(-30, 30), rnd(0.06, 0.14));
    if (w.m.proj === 'shell') part('smoke', sh.x, sh.y, dir * 30, -24, 0.9);
  }

  function damage(def, att, imp, dmg) {
    const cell = def.v[imp.layer][imp.r][imp.c];
    if (!alive(cell)) return;
    cell.hp -= dmg;
    def.taken += dmg; if (att) att.dealt += dmg;
    const x = cellX(def, imp.c) + HALF, y = cellY(imp.r) + 18;
    textFx(String(Math.round(dmg)), x + rnd(-9, 9), y - 18, imp.layer === 'side' ? P.magenta : P.white);
    for (let i = 0; i < 6; i++) part('spark', x, y + 6, rnd(-130, 130), rnd(-160, 0), rnd(0.15, 0.35));
    if (cell.hp <= 0) destroy(def, att, imp);
  }

  function destroy(def, att, imp) {
    const cell = def.v[imp.layer][imp.r][imp.c];
    cell.hp = 0;
    const x = cellX(def, imp.c) + HALF, y = cellY(imp.r) + HALF;
    boom(x, y);
    if (imp.layer === 'body') {
      const sd = def.v.side[imp.r][imp.c];
      if (alive(sd)) { sd.hp = 0; for (let i = 0; i < 8; i++) part('debris', x, y, rnd(-90, 90), rnd(-120, 0), 1.2, P.brass[1]); textFx('!', x, y - 40, P.fire[3]); }
    }
    const m = M[cell.id];
    if (cell.id === 'track' && !def.thrown) for (let i = 0; i < 14; i++) part('debris', x + rnd(-40, 40), GROUND - 10, rnd(-140, 140), rnd(-260, -80), rnd(0.8, 1.5), i % 2 ? P.dark[2] : P.dark[3]);
    if (m.explode) {
      boom(x, y, 30);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = imp.r + dr, c = imp.c + dc;
        if (r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS && alive(def.v.body[r][c])) damage(def, att, { layer: 'body', r, c }, m.explode);
      }
    }
    refresh(def);
  }

  // ---------- 移动与撞击 ----------
  // 起步：停稳后要先让锅炉「库吃库吃」憋几口蒸汽，才开得动；越重憋得越久
  const spoolTime = (s) => clamp(0.3 + s.mass * 0.02, 0.4, 0.8);
  function chuff(s, dt) {
    s.chuffT -= dt;
    if (s.chuffT > 0) return;
    s.chuffT = 0.2;
    s.rock = 1;
    s.heat += 0.3;
    s.water = Math.max(0, s.water - K.CHUFF_WATER);
    SA.V.each(s.v, (cell, r, c, layer) => {
      if (layer !== 'body' || !alive(cell) || cell.id !== 'boiler') return;
      const x = isP(s) ? cellX(s, c) + 37 : cellX(s, c) + 11, y = cellY(r);
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
    const top = dir * s.speed * (s.power || 0);
    const k = clamp(Math.sqrt(14 / s.mass), 0.6, 1.4);
    const braking = s.vx !== 0 && (top === 0 || Math.sign(top) !== Math.sign(s.vx) || Math.abs(top) < Math.abs(s.vx));
    const acc = (braking ? K.BRAKE : K.ACCEL) * k;
    s.vx += clamp(top - s.vx, -acc * dt, acc * dt);
    if (braking && Math.abs(s.vx) > 30) {
      s.brakeT -= dt;
      if (s.brakeT <= 0) {
        s.brakeT = 0.08;
        const back = cellX(s, isP(s) ? s.minCol : s.frontCol);
        part('dust', back + rnd(0, (s.frontCol - s.minCol + 1) * C), GROUND - 2, -Math.sign(s.vx) * rnd(10, 60), rnd(-60, -20), rnd(0.3, 0.5));
      }
    }
    const lo = isP(s) ? -(PADX + s.minCol * C) + 8 : -1e9;
    const hi = isP(s) ? 1e9 : W - 8 - VW + PADX + s.minCol * C;
    const want = s.x + s.vx * dt;
    const nx = clamp(want, lo, hi);
    if (nx !== want) s.vx = 0;
    s.phase += (nx - s.x) * (isP(s) ? 1 : -1);
    s.moving = Math.abs(nx - s.x) > 0.02;
    s.x = nx;
    if (s.moving && s.dir) {
      s.heat += K.MOVE_HEAT * dt;
      s.water = Math.max(0, s.water - K.MOVE_WATER * dt);
    }
  }

  // 每一行：attacker 最前端的模块 撞 defender 同一行最前端的模块
  function contactPairs(a, d) {
    const out = [];
    for (let r = 0; r < K.ROWS; r++) {
      const ma = a.v.body[r][a.frontCol];
      if (!alive(ma)) continue;
      let dc = -1;
      for (let k = K.COLS - 1; k >= 0; k--) if (alive(d.v.body[r][k])) { dc = k; break; }
      if (dc >= 0 && dc >= d.frontCol - 1) out.push({ r, ma, dc });
    }
    return out;
  }

  function collide() {
    const p = B.p, e = B.e;
    if (p.frontCol < 0 || e.frontCol < 0) return;
    const gap = frontEdge(e) - frontEdge(p);
    B.contact = gap <= 1;
    if (gap > 0) return;
    const closing = p.vx - e.vx;
    const cx = (frontEdge(p) + frontEdge(e)) / 2;
    if (closing > 25 && B.ramCd <= 0) {
      B.ramCd = 0.35;
      const f = closing / 60;
      let knockP = 0, knockE = 0;
      for (const [a, d] of [[p, e], [e, p]]) {
        for (const { r, ma, dc } of contactPairs(a, d)) {
          const dmg = (M[ma.id].ram || 6) * f;
          const target = d.v.body[r][dc];
          damage(d, a, { layer: 'body', r, c: dc }, SA.isRam(target.id) ? dmg * 0.5 : dmg);
          if (M[ma.id].knock) { if (a === p) knockE += M[ma.id].knock; else knockP += M[ma.id].knock; }
        }
      }
      for (let i = 0; i < 16; i++) part('spark', cx, cellY(K.ROWS - 2) + rnd(-90, 60), rnd(-300, 300), rnd(-300, 0), rnd(0.2, 0.4));
      B.shake = Math.max(B.shake, 5 + f * 4);
      // 一维碰撞：恢复系数 0.25，铲斗额外击退
      const mp = p.mass, me = e.mass, vp = p.vx, ve = e.vx;
      const vcm = (mp * vp + me * ve) / (mp + me);
      p.vx = vcm - 0.25 * (vp - vcm) - knockP * 45 * f;
      e.vx = vcm - 0.25 * (ve - vcm) + knockE * 45 * f;
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

  // 蒸汽撞锤：贴身时周期性猛击
  function pistons(s, o, dt) {
    for (const k in s.punch) s.punch[k] = Math.max(0, s.punch[k] - dt * 4);
    if (s.dead || o.dead || !B.contact) return;
    for (const pc of s.pistons) {
      if (pc.c !== s.frontCol || !alive(pc.cell)) continue;
      const key = `${pc.r},${pc.c}`;
      s.punchT[key] = (s.punchT[key] || 0) - dt;
      if (s.punchT[key] > 0) continue;
      s.punchT[key] = M.piston.punchCd;
      let dc = -1;
      for (let k = K.COLS - 1; k >= 0; k--) if (alive(o.v.body[pc.r][k])) { dc = k; break; }
      if (dc < 0) continue;
      s.punch[key] = 1;
      s.heat += M.piston.heat;
      damage(o, s, { layer: 'body', r: pc.r, c: dc }, M.piston.punch);
      o.vx += (isP(s) ? 1 : -1) * 60;
      const x = frontEdge(s), y = cellY(pc.r) + HALF;
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
    const aimPt = isP(s) ? B.aim : aiAimPoint(s, o);
    const firing = s.fireHeld && aimPt && s.power > 0 && !s.hold && !o.dead;
    const at = firing ? targetAt(o, aimPt[0], aimPt[1]) : null;
    const side = !!at && at.layer === 'side';
    // 扳机延迟：按住开火后要等一小会儿（点火/上膛）才打出第一发；换武器组重新计时
    if (s.sel !== s.lastSel) { s.lastSel = s.sel; s.heldT = 0; }
    s.heldT = firing ? s.heldT + dt : 0;
    for (const w of s.weapons) {
      if (w.blocked) continue;
      // 炮管以有限角速度转向瞄准点
      const cur = barrel(s, w), want = aimPt ? aimAngle(s, w, aimPt[0], aimPt[1]).a : cur;
      s.elev[w.key] = cur + clamp(want - cur, -w.m.slew * dt, w.m.slew * dt);
      if (s.timers[w.key] == null) s.timers[w.key] = rnd(0.2, 0.8) * w.m.reload;
      s.timers[w.key] -= dt * s.power;
      if (s.timers[w.key] <= 0) {
        if (firing && w.cell.id === s.sel && s.heldT >= w.m.windup) { fire(s, o, w, side); s.timers[w.key] = w.m.reload * rnd(0.92, 1.08); } else s.timers[w.key] = 0;
      }
    }
    for (const k in s.recoil) s.recoil[k] = Math.max(0, s.recoil[k] - dt * 5);
    s.smokeT -= dt;
    if (s.smokeT <= 0) {
      s.smokeT = 0.45 - Math.min(0.35, s.heat / 280);
      SA.V.each(s.v, (cell, r, c, layer) => {
        if (layer !== 'body' || !alive(cell)) return;
        if (cell.id === 'boiler') part('steam', isP(s) ? cellX(s, c) + 37 : cellX(s, c) + 11, cellY(r), rnd(-12, 12), rnd(-66, -36), rnd(0.8, 1.4));
        if (cell.hp / SA.V.maxHp(cell) < 0.34 && Math.random() < 0.5) part('smoke', cellX(s, c) + HALF, cellY(r) + 12, rnd(-12, 12), -42, 1.2);
      });
    }
  }

  // ---------- AI ----------
  function aiAimPoint(s, o) {
    const t = s.target;
    if (!t) return null;
    return [cellX(o, t.c) + HALF + s.err.x, cellY(t.r) + HALF + s.err.y];
  }
  function ai(s, o, dt) {
    if (s.dead) return;
    if (s.heat > 72) s.hold = true; else if (s.heat < 45) s.hold = false;
    s.retarget -= dt;
    const tAlive = s.target && alive(o.v[s.target.layer][s.target.r][s.target.c]);
    if (!tAlive || s.retarget <= 0) {
      const cands = [];
      SA.V.each(o.v, (cell, r, c, layer) => {
        if (!alive(cell)) return;
        const id = cell.id;
        const w = layer === 'side' ? 3 : M[id].dmg ? 2.5 : id === 'cockpit' ? 2 : id === 'boiler' ? 1.6 : id === 'water' ? 1.2 : M[id].layer === 'chassis' ? 0.3 : 0.6;
        cands.push({ w, t: { layer, r, c } });
      });
      let x = Math.random() * cands.reduce((a, b) => a + b.w, 0);
      s.target = null;
      for (const cnd of cands) { x -= cnd.w; if (x <= 0) { s.target = cnd.t; break; } }
      const e = (1 - s.aim) * 100 + 9;
      s.err = { x: gauss() * e, y: gauss() * e * 0.6 };
      s.retarget = rnd(3, 6);
      // 选武器组：直射打得到就直射，否则换高抛
      s.sel = s.groups[Math.floor(Math.random() * s.groups.length)] || null;
      if (s.target && s.target.layer === 'body' && s.groups.includes('mortar')) {
        const w = s.weapons.find(x => !x.blocked && x.cell.id === 'cannon');
        const pt = aiAimPoint(s, o);
        const pr = w && predict(s, o, w, aimAngle(s, w, pt[0], pt[1]).a, false);
        if (!pr || !pr.hit || pr.hit.c !== s.target.c || pr.hit.r !== s.target.r) s.sel = 'mortar';
      }
    }
    s.fireHeld = !!s.target;
    // 移动：有撞击武器就周期性冲撞，否则在交战距离内游走
    s.moveT -= dt;
    if (s.moveT <= 0) {
      s.charge = s.rams > 0 && !s.charge && Math.random() < 0.7;
      s.goalX = s.x - ((frontEdge(s) - frontEdge(o)) - rnd(140, 520));
      s.moveT = s.charge ? rnd(3, 5) : rnd(2, 5) * (s.speed > 62 ? 0.6 : 1);
    }
    if (s.charge) { s.dir = -1; if (B.contact && Math.abs(s.vx) < 10) s.moveT = Math.min(s.moveT, 0.4); }
    else s.dir = Math.abs(s.goalX - s.x) > 8 ? Math.sign(s.goalX - s.x) : 0;
  }

  // 失去战斗力：没有动力（锅炉全毁），或者没有能开火的武器。返回原因，否则为 null
  function crippled(s) {
    if (s.supply <= 0) return '失去动力';
    if (!s.weapons.some(w => !w.blocked)) return '没有能开火的武器';
    return null;
  }

  function step(dt) {
    B.t += dt;
    B.ramCd = Math.max(0, B.ramCd - dt);
    if (!B.p.dead) B.p.dir = (B.keys.right ? 1 : 0) - (B.keys.left ? 1 : 0);
    B.p.fireHeld = B.keys.fire;
    ai(B.e, B.p, dt);
    sim(B.p, B.e, dt);
    sim(B.e, B.p, dt);
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
          for (let k = 0; k < 6; k++) part('dust', sh.x, GROUND, rnd(-75, 75), rnd(-100, -30), rnd(0.3, 0.6));
          if (sh.big) part('smoke', sh.x, GROUND - 6, 0, -30, 0.8);
        } else if (res !== 'out') {
          damage(sh.to, sh.from, res, sh.dmg);
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
      if (p.type === 'debris' || p.type === 'spark' || p.type === 'dust') { p.vy += 660 * dt; if (p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; p.vx *= 0.6; } }
      if (p.type === 'smoke' || p.type === 'steam') p.vx *= 0.98;
    }
    B.parts = B.parts.filter(p => p.life > 0);
    for (const t of B.texts) { t.life -= dt; t.y -= 42 * dt; }
    B.texts = B.texts.filter(t => t.life > 0);
    B.shake = Math.max(0, B.shake - dt * 14);

    if (!B.ending) {
      // 武器打光：一方开局有武器、现在全被摧毁，而另一方还有 → 判负；两边同时打光走下面的平手
      const out = (s) => s.armed && !s.weapons.length;
      if (!B.p.dead && !B.e.dead && out(B.p) !== out(B.e)) kill(out(B.p) ? B.p : B.e, '武器全部被打光，失去战斗力');
      // 平手：双方都没了动力或没有能开火的武器，且场上没有飞行中的炮弹，持续 1.5 秒
      const both = !B.p.dead && !B.e.dead && crippled(B.p) && crippled(B.e) && !B.shots.length;
      B.drawT = both ? (B.drawT || 0) + dt : 0;
      if (B.drawT >= 1.5) {
        B.draw = `双方都${crippled(B.p) === crippled(B.e) ? crippled(B.p) : '失去了战斗力'}，裁判判定平手`;
        B.ending = 1.8;
      }
      if (!B.draw && B.t >= K.BATTLE_TIME && !B.p.dead && !B.e.dead) {
        const frac = (s) => { let a = 0, m = 0; SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); }); return a / Math.max(1, m); };
        kill(frac(B.p) >= frac(B.e) ? B.e : B.p, '时间到，剩余耐久较低，裁判判负');
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
    const tz = clamp((W - 60) / (er - pr + 360), 1, lob ? 1.25 : 1.8);
    const cam = B.cam;
    cam.z += (tz - cam.z) * Math.min(1, dt * 3);
    const sw = W / cam.z, sh = H / cam.z;
    const tx = clamp((pr + er) / 2 - sw / 2, 0, W - sw);
    cam.x += (tx - cam.x) * Math.min(1, dt * 4);
    cam.x = clamp(cam.x, 0, W - sw);
    cam.y = clamp(GROUND + 60 - sh, 0, H - sh);
    cam.w = sw; cam.h = sh;
    B.aim = B.aimScreen ? [cam.x + B.aimScreen[0] / cam.z, cam.y + B.aimScreen[1] / cam.z] : null;
  }

  // ---------- 背景 ----------
  function buildBg() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const HZ = GROUND - 240;
    const band = (y0, y1, col) => { x.fillStyle = col; x.fillRect(0, y0, W, y1 - y0); };
    const b1 = Math.round(HZ * 0.3), b2 = Math.round(HZ * 0.62);
    band(0, b1, P.bg[3]); band(b1, b2, P.bg[4]); band(b2, HZ, P.bg[5]);
    for (const [y, col] of [[b1, P.bg[4]], [b2, P.bg[5]]])
      for (let i = 0; i < W; i += 2) { x.fillStyle = col; x.fillRect(i + 1, y - 4, 1, 1); x.fillRect(i, y - 2, 1, 1); x.fillRect(i + 1, y - 1, 1, 1); }
    x.fillStyle = P.bg[6];
    const sunY = Math.round(HZ * 0.42);
    for (let yy = -40; yy <= 40; yy++) { const w = Math.sqrt(1600 - yy * yy); x.fillRect(Math.round(W * 0.76 - w), sunY + yy, Math.round(w * 2), 1); }
    let seed = 7;
    const rr = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 18; i++) {
      const bx = Math.round(rr() * W), bw = Math.round(48 + rr() * 90), bh = Math.round(40 + rr() * 110);
      x.fillStyle = P.bg[3]; x.fillRect(bx, HZ - bh, bw, bh);
      x.fillRect(bx + Math.round(bw * 0.3), HZ - bh - 54 - Math.round(rr() * 40), 12, 66);
      x.fillStyle = P.bg[4];
      for (let k = 0; k < Math.floor(bw / 18); k++) x.fillRect(bx + 8 + k * 18, HZ - bh + 14, 6, 9);
    }
    const GS = HZ, GE = GROUND - 110;
    x.fillStyle = P.bg[2]; x.fillRect(0, GS, W, GE - GS);
    for (let y = GS + 8; y < GE - 8; y += 13) {
      x.fillStyle = P.bg[1]; x.fillRect(0, y + 9, W, 3);
      for (let i = 0; i < W; i += 6) {
        const v = rr();
        if (v < 0.7) { x.fillStyle = v < 0.25 ? P.bg[4] : v < 0.5 ? P.bg[3] : P.bg[5]; x.fillRect(i, y + 2, 4, 6); x.fillRect(i + 1, y, 2, 2); }
      }
    }
    for (let i = 0; i < W; i += 26) { x.fillStyle = (i / 26) % 2 ? P.bg[5] : P.bg[4]; x.fillRect(i, GS - 5, 16, 4); x.fillRect(i + 3, GS - 1, 10, 3); x.fillRect(i + 6, GS + 2, 4, 3); }
    x.fillStyle = P.bg[1]; x.fillRect(0, GE, W, 14);
    for (let i = 0; i < W; i += 64) { x.fillStyle = P.bg[0]; x.fillRect(i, GE - 6, 8, 24); }
    x.fillStyle = P.bg[3]; x.fillRect(0, GE + 14, W, H - GE - 14);
    for (let i = 0; i < 900; i++) { x.fillStyle = rr() < 0.5 ? P.bg[2] : P.bg[4]; x.fillRect(Math.round(rr() * W), Math.round(GE + 14 + rr() * (H - GE - 14)), 4, 1); }
    x.fillStyle = P.bg[2]; x.fillRect(0, GROUND, W, H - GROUND);
    x.fillStyle = P.bg[4]; x.fillRect(0, GROUND, W, 1);
    for (let i = 0; i < W; i += 48) { x.fillStyle = P.bg[1]; x.fillRect(i, GROUND + 18, 30, 4); }
    return c;
  }

  // ---------- 绘制 ----------
  function draw() {
    const t = B.t;
    g = wc.getContext('2d');
    g.drawImage(bg, 0, 0);
    g.save();
    if (B.shake) g.translate(Math.round(rnd(-B.shake, B.shake)), Math.round(rnd(-B.shake, B.shake)));
    g.fillStyle = 'rgba(7,8,12,0.4)';
    for (const s of [B.p, B.e]) g.fillRect(Math.round(cellX(s, isP(s) ? s.minCol : K.COLS - 1)) - 8, GROUND - 3, (K.COLS - s.minCol) * C + 16, 8);

    const aimT = B.aim && !B.e.dead ? targetAt(B.e, B.aim[0], B.aim[1]) : null;
    const opts = (s, key, extra) => ({ key, t, heat: s.heat / 100, water: s.water / Math.max(1, s.waterMax), recoil: s.recoil, punch: s.punch, phase: s.phase, moving: s.moving, ...extra });
    const pc = SA.SPR.renderVehicle(B.p.v, opts(B.p, 'bp'));
    const rockY = (s) => VY - Math.round(s.rock * 2);   // 起步憋气时车身一颠一颠
    g.drawImage(pc, Math.round(B.p.x), rockY(B.p));
    if (B.p.dead) g.drawImage(tint(pc), Math.round(B.p.x), rockY(B.p));
    const ec = SA.SPR.renderVehicle(B.e.v, opts(B.e, 'be', { dimCell: aimT && aimT.layer === 'side' ? aimT : null }));
    g.save(); g.translate(Math.round(B.e.x) + VW, rockY(B.e)); g.scale(-1, 1); g.drawImage(ec, 0, 0);
    if (B.e.dead) g.drawImage(tint(ec), 0, 0);
    g.restore();

    if (aimT) SA.SPR.outline(g, Math.round(cellX(B.e, aimT.c)), cellY(aimT.r), C, C, aimT.layer === 'side' ? P.magenta : P.white, P.black);
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
      const col = aimT ? (aimT.layer === 'side' ? P.magenta : P.white) : P.steam[1];
      g.fillStyle = P.black;
      for (const [x, y, w, hh] of [[mx - 19, my - 3, 14, 6], [mx + 5, my - 3, 14, 6], [mx - 3, my - 19, 6, 14], [mx - 3, my + 5, 6, 14]]) g.fillRect(x, y, w, hh);
      g.fillStyle = col;
      for (const [x, y, w, hh] of [[mx - 18, my - 1, 12, 2], [mx + 6, my - 1, 12, 2], [mx - 1, my - 18, 2, 12], [mx - 1, my + 6, 2, 12]]) g.fillRect(x, y, w, hh);
      g.fillRect(mx - 1, my - 1, 3, 3);
      const rl = reloadFrac(B.p);
      if (rl != null) hourglass(mx + 16, my + 10, rl);
    }
    const cam = B.cam;
    dg.imageSmoothingEnabled = false;
    dg.drawImage(wc, cam.x, cam.y, cam.w, cam.h, 0, 0, W, H);
  }

  // 当前武器组的装填进度（0 → 1）；有一门已经装好就返回 null
  function reloadFrac(s) {
    if (s.dead || !s.sel) return null;
    let best = null;
    for (const w of s.weapons) {
      if (w.cell.id !== s.sel || w.blocked) continue;
      const left = Math.max(0, s.timers[w.key] || 0);
      const f = 1 - left / w.m.reload;
      if (best == null || f > best) best = f;
    }
    return best == null || best >= 1 ? null : clamp(best, 0, 1);
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
    const col = side ? P.magenta : P.white;
    const big = w.m.proj === 'shell';
    SA.SPR.useCtx(g);
    const sp = spreadDeg(p, B.e, w);
    if (sp > 0) {
      const lo = predict(p, B.e, w, cur, side, -sp), hi = predict(p, B.e, w, cur, side, sp);
      // 扇区：两条边界弹道之间半透明填充
      g.save(); g.globalAlpha = 0.14; g.fillStyle = col; g.beginPath();
      [...lo.pts, lo.end].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      [hi.end, ...hi.pts.slice().reverse()].forEach(([x, y]) => g.lineTo(x, y));
      g.closePath(); g.fill(); g.restore();
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
    if (pr.hit) {
      info.hit = pr.hit;
      if (!sameCell(pr.hit, aimT)) SA.SPR.outline(g, Math.round(cellX(B.e, pr.hit.c)), cellY(pr.hit.r), C, C, P.white, P.black, Math.floor(B.t * 16));
    }
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
      if (Math.abs(s.vx) > 5) st.push(`速度 ${Math.round(Math.abs(s.vx))}`);
      if (!s.isAI && s.fireHeld) st.push('开火中');
    }
    el.state.textContent = st.join(' · ');
  }

  // 武器组槽位：只有 ≥2 组时才显示，数字键切换
  function renderSlots() {
    const p = B.p;
    const sig = p.groups.join(',') + '|' + p.sel;
    if (hud.slotSig === sig) return;
    hud.slotSig = sig;
    hud.slots.innerHTML = '';
    if (p.groups.length < 2) return;
    p.groups.forEach((id, i) => {
      const n = p.weapons.filter(w => w.cell.id === id).length;
      hud.slots.append(h('button', { class: `btn small slot ${p.sel === id ? 'on' : ''}`, onclick: () => { p.sel = id; } },
        h('b', {}, `${i + 1}`), ` ${M[id].name} ×${n}`));
    });
  }

  function infoText() {
    const p = B.p;
    if (!p.sel) return '没有可用的武器。可以用 A/D 冲撞对手。';
    const head = `<b>${M[p.sel].name}</b>`;
    if (!B.aim) return `${head} · 移动鼠标瞄准，<b>按住左键开火</b>；<b>A/D</b> 移动与冲撞${p.groups.length > 1 ? '；<b>数字键</b>切换武器' : ''}。`;
    const aimT = targetAt(B.e, B.aim[0], B.aim[1]);
    const pi = B.previewInfo;
    const parts = [head];
    if (pi && pi.blocked) parts.push('<b>这组武器全被己方模块挡住了</b>，换一组武器');
    if (aimT && aimT.layer === 'side') parts.push('瞄准 <span class="side">敌方侧炮（侧挂层）</span>：只打侧炮，不会被前面的装甲挡住');
    else if (aimT) parts.push(`瞄准 <b>敌方${M[B.e.v.body[aimT.r][aimT.c].id].name}</b>`);
    else parts.push('准星没有对准敌方模块');
    const alt = p.groups.includes('mortar') && p.sel !== 'mortar' ? ' → 换高抛火炮试试' : '';
    if (pi && pi.over) parts.push(pi.over === 'high' ? `<b>超出射界</b>：目标太高/太近，炮管抬不到 ${M[p.sel].elev[1]}° 以上${alt}` : '<b>超出射界</b>：炮管压不了那么低');
    else if (pi && !pi.reach) parts.push('<b>超出射程，靠近一些</b>');
    else if (pi && pi.slewing) parts.push('炮管转动中…');
    if (aimT && pi && pi.hit && !sameCell(pi.hit, aimT)) parts.push(`弹道中心先打到 <b>「${M[B.e.v[pi.hit.layer][pi.hit.r][pi.hit.c].id].name}」</b>（虚线框）${alt}`);
    if (aimT && pi && pi.chance != null) parts.push(`命中率约 <b>${pi.chance}%</b>（扇区 = 散布范围）`);
    else if (aimT && pi && M[p.sel].indirect) parts.push('高抛：指哪打哪（对方移动会躲开）');
    if (pi && pi.windup) parts.push('点火中…');
    return parts.join(' · ');
  }

  // ---------- 流程 ----------
  function frontShift(v) {
    let m = -1;
    SA.V.each(v, (cell, r, c) => { m = Math.max(m, c); });
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
    B = { opts, pShift, t: 0, shots: [], parts: [], texts: [], shake: 0, aim: null, ending: 0, done: false, hudT: 0, ramCd: 0, contact: false,
      keys: { left: false, right: false, fire: false }, cam: { x: 0, y: 0, z: 1, w: W, h: H }, aimScreen: null };
    B.p = makeSide(pv, d.vehicle.name, false, 1, W / 2 - 200 - PADX - K.COLS * C);
    B.e = makeSide(ev, opts.enemyName, true, opts.aim || 0.9, W / 2 + 200 - PADX);
    bg = buildBg();

    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    cv = h('canvas', { class: 'px', width: W, height: H });
    dg = cv.getContext('2d');
    wc = document.createElement('canvas'); wc.width = W; wc.height = H;
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
        hud.slots, hud.info, hud.vent,
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
    const loop = (now) => {
      if (SA.current !== 'battle' || B.done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt);
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
    hud.timer.textContent = `${Math.max(0, Math.ceil(K.BATTLE_TIME - B.t))}`;
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
    window.removeEventListener('resize', fit);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    const draw = !!B.draw;
    const win = !draw && !B.p.dead && B.e.dead;
    let flawless = true;
    SA.V.each(B.p.v, (cell) => { if (cell.id === 'cockpit' && cell.hp < SA.V.maxHp(cell)) flawless = false; });
    SA.UI.afterBattle({
      mode: B.opts.mode, opts: B.opts, win, draw, prize: B.opts.prize || 0, enemyName: B.e.name,
      reason: draw ? B.draw : win ? `「${B.e.name}」${B.e.reason}` : `你的「${B.p.name}」${B.p.reason}`,
      playerVehicle: shiftVeh(B.p.v, -B.pShift), dealt: B.p.dealt, taken: B.p.taken, time: B.t, flawless: win && flawless,
    });
  }

  // 调试：预览环境里 rAF 可能不跑，可手动推进
  const debug = {
    step(sec = 1) { for (let i = 0; i < sec * 60; i++) { if (B.done) break; step(1 / 60); } draw(); hudTick(1); return { t: B.t, px: B.p.x, ex: B.e.x, pv: B.p.vx, ev: B.e.vx, ph: B.p.heat, eh: B.e.heat, pd: B.p.dead, ed: B.e.dead }; },
    get B() { return B; },
    cellCenter(side, r, c) { const s = side === 'e' ? B.e : B.p; return [cellX(s, c) + HALF, cellY(r) + HALF]; },
    aimWorld(x, y) { const cam = B.cam; B.aimScreen = [(x - cam.x) * cam.z, (y - cam.y) * cam.z]; camera(0); },
  };
  return { start, debug };
})();
