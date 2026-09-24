// 载具模型：格子、两层（主体/侧挂）、摆放规则、属性计算、分享码
window.SA = window.SA || {};

SA.V = (() => {
  const K = SA.K, M = SA.MODULES;
  const grid = () => Array.from({ length: K.ROWS }, () => Array(K.COLS).fill(null));
  const create = (name = '原型机') => ({ name, body: grid(), side: grid() });
  const layerOf = (id) => (M[id].layer === 'side' ? 'side' : 'body');
  const maxHp = (cell) => cell.max || M[cell.id].hp;
  const alive = (cell) => cell && cell.hp > 0;

  const ASCII = { T: 'track', Q: 'quad', B: 'biped', K: 'cockpit', A: 'armor', H: 'armor_heavy', C: 'cannon', P: 'mortar', M: 'mg', O: 'boiler', W: 'water', S: 'side_cannon', U: 'bucket', X: 'spike', Y: 'piston' };

  function fromAscii(name, rows, sides = []) {
    const v = create(name);
    rows.forEach((row, r) => {
      for (let c = 0; c < K.COLS; c++) {
        const id = ASCII[row[c]];
        if (id) v.body[r][c] = { id, hp: M[id].hp };
      }
    });
    sides.forEach(([r, c]) => { v.side[r][c] = { id: 'side_cannon', hp: M.side_cannon.hp }; });
    return v;
  }

  function each(v, fn) {
    for (const layer of ['body', 'side'])
      for (let r = 0; r < K.ROWS; r++)
        for (let c = 0; c < K.COLS; c++)
          if (v[layer][r][c]) fn(v[layer][r][c], r, c, layer);
  }

  const isRamCell = (cell) => cell && SA.isRam(cell.id);

  function canPlace(v, id, r, c) {
    const m = M[id];
    const no = (reason) => ({ ok: false, reason });
    if (r < 0 || r >= K.ROWS || c < 0 || c >= K.COLS) return no('超出格子范围');
    // 撞击武器挡在前面时，这一行它前方不能再放东西
    const ramBehind = () => { for (let k = 0; k < c; k++) if (isRamCell(v.body[r][k])) return true; return false; };
    if (m.layer === 'ram') {
      if (v.body[r][c]) return no('这里已经有模块');
      const back = c > 0 && v.body[r][c - 1];
      if (!back || !m.mount.includes(back.id)) return no(`${m.name}要装在${m.mount.map(x => M[x].name).join('/')}的正前方（右侧）`);
      for (let k = c + 1; k < K.COLS; k++) if (v.body[r][k]) return no('撞击武器必须在这一行的最前端');
      return { ok: true };
    }
    if (m.layer === 'chassis') {
      if (r !== K.ROWS - 1) return no('底盘只能放在最底行');
      if (v.body[r][c]) return no('这里已经有模块');
      if (ramBehind()) return no('撞击武器前方不能再放模块');
      return { ok: true };
    }
    if (m.layer === 'body') {
      if (r === K.ROWS - 1) return no('最底行只能放底盘');
      if (v.body[r][c]) return no('这里已经有模块');
      if (!v.body[r + 1][c]) return no('下方没有支撑：需要底盘或模块托住');
      if (isRamCell(v.body[r + 1][c])) return no('撞击武器上面不能叠模块');
      if (ramBehind()) return no('撞击武器前方不能再放模块');
      return { ok: true };
    }
    if (r === K.ROWS - 1) return no('底盘上不能挂侧炮');
    if (v.side[r][c]) return no('侧挂层这里已经有侧炮');
    if (!v.body[r][c]) return no('侧炮必须挂在主体模块上');
    if (isRamCell(v.body[r][c])) return no('撞击武器上不能挂侧炮');
    return { ok: true };
  }

  function place(v, id, r, c) {
    const chk = canPlace(v, id, r, c);
    if (chk.ok) v[layerOf(id)][r][c] = { id, hp: M[id].hp };
    return chk;
  }

  // 拆除：返回拆下的模块。受损模块需先修理；报废模块直接清除
  function remove(v, layer, r, c) {
    const cell = v[layer][r] && v[layer][r][c];
    if (!cell) return { ok: false, reason: '这里是空的' };
    if (layer === 'body' && r > 0 && v.body[r - 1][c]) return { ok: false, reason: '上方还有模块，先拆上面的' };
    if (layer === 'body' && c < K.COLS - 1 && isRamCell(v.body[r][c + 1])) return { ok: false, reason: '前方挂着撞击武器，先拆下它' };
    const hurt = (x) => x && x.hp > 0 && x.hp < maxHp(x);
    if (hurt(cell) || (layer === 'body' && hurt(v.side[r][c]))) return { ok: false, reason: '受损模块要先修理才能拆下' };
    const out = [cell];
    if (layer === 'body' && v.side[r][c]) { out.push(v.side[r][c]); v.side[r][c] = null; }
    v[layer][r][c] = null;
    return { ok: true, removed: out };
  }

  // 直射武器：同一行前方（列号更大）有己方存活主体模块 → 被挡；高抛炮不受影响
  function blockedList(v) {
    const out = [];
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        const cell = v.body[r][c];
        if (!alive(cell) || !SA.isWeapon(cell.id) || M[cell.id].indirect) continue;
        for (let k = c + 1; k < K.COLS; k++) if (alive(v.body[r][k])) { out.push({ r, c }); break; }
      }
    return out;
  }

  function overheatTime(gen, coolRate, water) {
    let heat = 0;
    for (let t = 0; t < 300; t += 0.5) {
      heat += (gen - K.DISSIPATE) * 0.5;
      if (water > 0 && heat > 0) {
        const c = Math.min(heat, coolRate * 0.5);
        heat -= c; water -= c * K.WATER_PER_HEAT;
      }
      heat = Math.max(0, heat);
      if (heat >= K.HEAT_MAX) return t;
    }
    return Infinity;
  }

  function stats(v) {
    const s = {
      demand: 0, supply: 0, cap: 0, hp: 0, maxHp: 0, cockpits: 0, chassis: 0, boilers: 0, tanks: 0,
      water: 0, cool: 0, dps: 0, weapons: 0, heatRate: 0, evade: 0, acc: 0, broken: 0, damaged: 0,
      value: 0, count: 0, height: 0, byId: {}, speed: 0, rams: 0,
    };
    each(v, (cell, r, c) => {
      const m = M[cell.id];
      s.value += m.price; s.count++;
      s.byId[cell.id] = (s.byId[cell.id] || 0) + (cell.hp > 0 ? 1 : 0);
      if (cell.hp <= 0) { s.broken++; return; }
      if (cell.hp < maxHp(cell)) s.damaged++;
      s.height = Math.max(s.height, K.ROWS - r);
      s.hp += cell.hp; s.maxHp += maxHp(cell);
      s.demand += m.power || 0;
      s.supply += m.supply || 0;
      if (m.layer === 'chassis') { s.chassis++; s.cap += m.cap; s.evade += m.evade || 0; s.acc += m.acc || 0; s.speed += m.speed; }
      if (m.ram) s.rams++;
      if (cell.id === 'cockpit') s.cockpits++;
      if (m.supply) { s.boilers++; s.heatRate += m.heatRate; }
      if (m.water) { s.tanks++; s.water += m.water; s.cool += m.cool; }
    });
    if (s.chassis) { s.evade /= s.chassis; s.acc /= s.chassis; s.speed /= s.chassis; }
    s.blocked = blockedList(v);
    s.power = s.demand ? Math.min(1, s.supply / s.demand) : 1;
    const util = s.supply ? Math.min(1, s.demand / s.supply) : 0;
    let weaponHeat = 0;
    each(v, (cell, r, c, layer) => {
      const m = M[cell.id];
      if (!alive(cell) || !m.dmg) return;
      s.weapons++;
      if (layer === 'body' && s.blocked.some(b => b.r === r && b.c === c)) return;
      s.dps += (m.dmg * Math.max(0.4, 0.95 - m.spread * 0.07 + s.acc)) / m.reload * s.power;
      weaponHeat += m.heat / m.reload * s.power;
    });
    s.boilerHeat = s.heatRate * Math.max(0.3, util);
    s.heatGen = s.boilerHeat + weaponHeat;
    s.overheat = overheatTime(s.heatGen, s.cool, s.water);
    s.rating = Math.round(s.hp / 12 + s.dps * 5 + s.evade * 60 + s.rams * 15 + Math.min(s.overheat, 120) / 4);

    s.problems = [];
    if (!s.chassis) s.problems.push('没有底盘');
    if (!s.cockpits) s.problems.push('没有可用的驾驶舱');
    if (!s.boilers) s.problems.push('没有锅炉，机器无法启动');
    if (s.demand > s.cap) s.problems.push(`动力需求 ${s.demand} 超过底盘承载上限 ${s.cap}`);
    // 履带是一个整体：有一段被毁就整条掉链，修好之前开不动
    s.thrown = v.body[K.ROWS - 1].some(cell => cell && cell.id === 'track' && cell.hp <= 0);
    if (s.thrown) s.problems.push('履带掉链（有一段被打断），先去「修理」接上');
    s.warnings = [];
    if (s.demand > s.supply && s.boilers) s.warnings.push(`动力不足：武器装填速度降至 ${Math.round(s.power * 100)}%`);
    if (s.blocked.length) s.warnings.push(`${s.blocked.length} 门武器被己方模块挡住，无法开火`);
    if (!s.weapons) s.warnings.push('没有武器');
    if (s.overheat < 60) s.warnings.push(`全力开火约 ${Math.round(s.overheat)} 秒后烧干`);
    const brokenOther = s.broken - (s.thrown ? v.body[K.ROWS - 1].filter(cell => cell && cell.id === 'track' && cell.hp <= 0).length : 0);
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
      const max = Math.round(M[cell.id].hp * hpMul);
      b[layer][r][c] = { id: cell.id, hp: fullHp ? max : Math.min(max, Math.round(cell.hp * hpMul)), max };
    });
    return b;
  }

  // 分享码：SA1.<base64>
  function encode(v) {
    const b = [], s = [];
    each(v, (cell, r, c, layer) => (layer === 'body' ? b : s).push([r, c, SA.MODULE_ORDER.indexOf(cell.id)]));
    const json = JSON.stringify({ n: v.name, b, s });
    return 'SA1.' + btoa(unescape(encodeURIComponent(json)));
  }

  function decode(code) {
    try {
      const raw = String(code).trim();
      if (!raw.startsWith('SA1.')) return null;
      const d = JSON.parse(decodeURIComponent(escape(atob(raw.slice(4)))));
      const v = create(String(d.n || '无名载具').slice(0, 20));
      // 自下而上摆放，保证规则合法
      const list = [...(d.b || []), ...(d.s || [])].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      const sideLast = list.filter(x => SA.MODULE_ORDER[x[2]] !== 'side_cannon').concat(list.filter(x => SA.MODULE_ORDER[x[2]] === 'side_cannon'));
      for (const [r, c, i] of sideLast) {
        const id = SA.MODULE_ORDER[i];
        if (id) place(v, id, r, c);
      }
      return v;
    } catch (e) { return null; }
  }

  return { create, fromAscii, each, canPlace, place, remove, blockedList, stats, clone, battleCopy, encode, decode, layerOf, maxHp, alive };
})();
