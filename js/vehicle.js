// 载具模型：格子、两层（主体/侧挂）、摆放规则、属性计算、分享码
window.SA = window.SA || {};

SA.V = (() => {
  const K = SA.K, M = SA.MODULES;
  const grid = () => Array.from({ length: K.ROWS }, () => Array(K.COLS).fill(null));
  const create = (name = '原型机') => ({ name, body: grid(), side: grid() });
  const layerOf = (id) => (M[id].layer === 'side' ? 'side' : 'body');
  // 满耐久：改装（炮盾 / 附加装甲）每级按比例加；参战副本直接带 max
  const maxHp = (cell) => cell.max || Math.round(M[cell.id].hp * (1 + SA.upHp(cell.id) * (cell.lv || 0)));
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

  // ---------- 改装台上的自由摆放：出战前允许悬空、乱放，出战时再由 issues() 把关 ----------
  const inGrid = (r, c) => r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS;
  const hurt = (x) => x && x.hp > 0 && x.hp < maxHp(x);

  // 只检查格子是否空着；返回 { ok, reason, fit }，fit 表示这个位置是否已经合规
  function canPut(v, id, r, c) {
    if (!inGrid(r, c)) return { ok: false, reason: '超出格子范围' };
    const layer = layerOf(id);
    if (v[layer][r][c]) return { ok: false, reason: layer === 'side' ? '侧挂层这里已经有侧炮' : '这里已经有模块' };
    const chk = canPlace(v, id, r, c);
    return { ok: true, fit: chk.ok, reason: chk.reason };
  }

  function put(v, id, r, c) {
    const chk = canPut(v, id, r, c);
    if (chk.ok) v[layerOf(id)][r][c] = { id, hp: M[id].hp };
    return chk;
  }

  // 拆下：主体模块连同挂在它上面的侧炮一起拆；上方的模块留在原地悬空
  // 受损模块要先修理；报废模块直接清除（由调用方回收残值）
  function remove(v, layer, r, c) {
    const cell = inGrid(r, c) && v[layer][r][c];
    if (!cell) return { ok: false, reason: '这里是空的' };
    if (hurt(cell) || (layer === 'body' && hurt(v.side[r][c]))) return { ok: false, reason: '受损模块要先修理才能拆下' };
    const out = [cell];
    if (layer === 'body' && v.side[r][c]) { out.push(v.side[r][c]); v.side[r][c] = null; }
    v[layer][r][c] = null;
    return { ok: true, removed: out };
  }

  // 移动：目标格有模块就对调。主体层连同侧挂层一起搬
  function move(v, layer, r1, c1, r2, c2) {
    if (!inGrid(r1, c1) || !inGrid(r2, c2)) return { ok: false, reason: '超出格子范围' };
    if (r1 === r2 && c1 === c2) return { ok: false, reason: '' };
    if (!v[layer][r1][c1]) return { ok: false, reason: '这里是空的' };
    for (const L of layer === 'body' ? ['body', 'side'] : ['side']) {
      const a = v[L][r1][c1];
      v[L][r1][c1] = v[L][r2][c2];
      v[L][r2][c2] = a;
    }
    return { ok: true, swapped: !!v[layer][r1][c1] };
  }

  // 出战检查：逐格找出悬空（没有一路连到底盘）或摆放不合规的模块
  function issues(v) {
    const out = [];
    const B = v.body, last = K.ROWS - 1;
    const ok = grid();   // 该主体格已稳稳连到底盘
    const flag = (layer, r, c, reason) => out.push({ layer, r, c, reason });
    for (let r = last; r >= 0; r--)
      for (let c = 0; c < K.COLS; c++) {
        const cell = B[r][c];
        if (!cell) continue;
        const m = M[cell.id];
        if (m.layer === 'chassis') {
          if (r !== last) flag('body', r, c, '底盘只能放在最底行');
          else ok[r][c] = true;
        } else if (m.layer === 'ram') {
          const back = c > 0 && B[r][c - 1];
          if (!back || !m.mount.includes(back.id) || !ok[r][c - 1]) flag('body', r, c, `${m.name}要装在${m.mount.map(x => M[x].name).join('/')}的正前方（右侧）`);
          else if (B[r].some((x, k) => x && k > c)) flag('body', r, c, '撞击武器必须是这一行的最前端');
          else ok[r][c] = true;
        } else if (r === last) {
          flag('body', r, c, '最底行只能放底盘');
        } else {
          const below = B[r + 1][c];
          if (!below) flag('body', r, c, '悬空：下方没有支撑');
          else if (isRamCell(below)) flag('body', r, c, '撞击武器上面不能叠模块');
          else if (!ok[r + 1][c]) flag('body', r, c, '悬空：下方的模块没有连到底盘');
          else ok[r][c] = true;
        }
      }
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        if (!v.side[r][c]) continue;
        if (r === last) flag('side', r, c, '底盘上不能挂侧炮');
        else if (!B[r][c]) flag('side', r, c, '悬空：侧炮必须挂在主体模块上');
        else if (isRamCell(B[r][c])) flag('side', r, c, '撞击武器上不能挂侧炮');
        else if (!ok[r][c]) flag('side', r, c, '悬空：挂载的模块没有连到底盘');
      }
    return out;
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
      demand: 0, equip: 0, drive: 0, weight: 0, load: 0, supply: 0, hp: 0, maxHp: 0, cockpits: 0, chassis: 0, boilers: 0, tanks: 0,
      water: 0, cool: 0, dps: 0, weapons: 0, heatRate: 0, evade: 0, acc: 0, broken: 0, damaged: 0,
      value: 0, count: 0, height: 0, byId: {}, speed: 0, rams: 0, accel: 0, brake: 0, sway: 0,
    };
    each(v, (cell, r, c) => {
      const m = M[cell.id];
      s.value += m.price; s.count++;
      for (let k = 1; k <= (cell.lv || 0); k++) s.value += SA.upCost(cell.id, k);
      s.byId[cell.id] = (s.byId[cell.id] || 0) + (cell.hp > 0 ? 1 : 0);
      if (cell.hp <= 0) { s.broken++; return; }
      if (cell.hp < maxHp(cell)) s.damaged++;
      s.height = Math.max(s.height, K.ROWS - r);
      s.hp += cell.hp; s.maxHp += maxHp(cell);
      s.equip += m.power || 0;
      s.weight += SA.weightOf(cell);
      s.supply += m.supply || 0;
      if (m.layer === 'chassis') { s.chassis++; s.load += m.load; s.evade += m.evade || 0; s.acc += m.acc || 0; s.speed += m.speed; s.accel += m.accel; s.brake += m.brake; s.sway += m.sway; }
      if (m.ram) s.rams++;
      if (cell.id === 'cockpit') s.cockpits++;
      if (m.supply) { s.boilers++; s.heatRate += m.heatRate; }
      if (m.water) { s.tanks++; s.water += m.water; s.cool += m.cool; }
    });
    if (s.chassis) for (const k of ['evade', 'acc', 'speed', 'accel', 'brake', 'sway']) s[k] /= s.chassis;
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
      const m = M[cell.id];
      if (!alive(cell) || !m.dmg) return;
      s.weapons++;
      if (layer === 'body' && s.blocked.some(b => b.r === r && b.c === c)) return;
      s.dps += (m.dmg * Math.max(0.4, 0.95 - m.spread * 0.07 + s.acc)) / m.reload * s.power;
      weaponHeat += m.heat / m.reload * s.power;
      weaponWater += m.heat * K.FIRE_WATER / m.reload * s.power;
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
    // 履带是一个整体：有一段被毁就整条掉链，修好之前开不动
    s.issues = issues(v);
    if (s.issues.length) s.problems.push(`${s.issues.length} 个模块悬空或摆放不合规（车间里红色闪烁），接好才能出战`);
    s.thrown = v.body[K.ROWS - 1].some(cell => cell && cell.id === 'track' && cell.hp <= 0);
    if (s.thrown) s.problems.push('履带掉链（有一段被打断），在车间修好才能开');
    s.warnings = [];
    if (s.demand > s.supply && s.boilers) s.warnings.push(`动力不足：车速和装填降至 ${Math.round(s.power * 100)}%`);
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
      const max = Math.round(maxHp(cell) * hpMul);
      b[layer][r][c] = { id: cell.id, lv: cell.lv || 0, hp: fullHp ? max : Math.min(max, Math.round(cell.hp * hpMul)), max };
    });
    return b;
  }

  // 布局（本地蓝图用）：原样记录每一格，悬空的也保留
  function layout(v) {
    const b = [], s = [];
    each(v, (cell, r, c, layer) => (layer === 'body' ? b : s).push([r, c, cell.id]));
    return { b, s };
  }
  function fromLayout(name, L) {
    const v = create(name);
    for (const [layer, list] of [['body', L.b || []], ['side', L.s || []]])
      for (const [r, c, id] of list)
        if (M[id] && inGrid(r, c) && layerOf(id) === layer) v[layer][r][c] = { id, hp: M[id].hp };
    return v;
  }
  // 布局需要的模块数量 { id: n }
  function countIds(v) {
    const n = {};
    each(v, (cell) => { n[cell.id] = (n[cell.id] || 0) + 1; });
    return n;
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

  return { create, fromAscii, each, canPlace, place, canPut, put, remove, move, issues, layout, fromLayout, countIds, blockedList, stats, clone, battleCopy, encode, decode, layerOf, maxHp, alive };
})();
