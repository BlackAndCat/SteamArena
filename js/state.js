// 存档与经济
window.SA = window.SA || {};

SA.S = (() => {
  const KEY = 'steam_arena_save_v2';   // v2：战役 + 材料（v1 的旧存档不再读取）
  let d = null;

  function fresh() {
    return {
      money: 300, debt: 0, rep: 0, season: 1, round: 0,
      inv: { armor: 2, mg: 1 }, ingots: {},
      vehicle: SA.V.fromAscii('一号原型机', SA.STARTER.rows, [], 1, [], SA.STARTER.subs),
      // 唯一件领取账本：键是模块 id；只记录已从战利品领取过的件，不删除旧存档已有库存。
      uniqueClaims: {},
      bet: null,
      // 战役进度：ch 章、st 关；feat 已开放的功能、mods 商店里能买的模块、mat 能升级到的材料、grid 改装台大小
      camp: { ch: 0, st: 0, intro: -1, done: false, sideWins: {}, ...JSON.parse(JSON.stringify(SA.CAMP_START)) },
      orders: ['farmer', 'post', 'mill'], ordersDone: [],
      wins: 0, losses: 0, battles: 0, champion: 0,
      news: '老汤姆的铁匠铺后院：你的第一台原型机已经点着了锅炉。去「出战」打第一场练习赛。',
    };
  }

  function load() {
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (!d || !d.vehicle || !d.camp) d = fresh();
    d.ingots = d.ingots || {};
    d.uniqueClaims = d.uniqueClaims || {};
    d.vehicle = SA.V.migrate(d.vehicle);   // 旧存档是 6 × 8 大格，换算成子格
    fixModules(d);
    return d;
  }
  // 模块表改动后的旧存档修正：副驾驶 → 联合驾驶舱；低于最低材料的（黄铜直射火炮）补到最低材料；开局的新模块补进商店
  function fixModules(s) {
    s.inv = s.inv || {};
    const oldAux = { scope: 'periscope', loader: 'autoloader', gyro: 'gyroscope', ranger: 'rangefinder' };
    SA.V.each(s.vehicle, (cell) => {
      // 旧存档的驾驶舱槽位迁移为库存中的 1×1 实体模块。
      for (const old of cell.aux || []) if (oldAux[old]) s.inv[oldAux[old]] = (s.inv[oldAux[old]] || 0) + 1;
      delete cell.aux;
      SA.fixCell(cell);
    });
    const inv = {};
    for (const k in s.inv) { const f = SA.fixKey(k); inv[f] = (inv[f] || 0) + s.inv[k]; }
    s.inv = inv;
    // 旧存档若已经有标记为唯一件的库存 / 车上模块，保留物品并视为已领取，避免迁移后重复发放。
    SA.V.each(s.vehicle, (cell) => {
      if (SA.isUnique(cell.id)) s.uniqueClaims[cell.id] = s.uniqueClaims[cell.id] || { mt: cell.mt || 1, source: 'legacy' };
    });
    for (const k in s.inv) {
      const p = SA.parseKey(k);
      if (s.inv[k] > 0 && SA.isUnique(p.id)) s.uniqueClaims[p.id] = s.uniqueClaims[p.id] || { mt: p.mt, source: 'legacy' };
    }
    const C = s.camp;
    C.sideWins = C.sideWins || {};
    const mods = [];
    for (const id of [...SA.CAMP_START.mods, ...C.mods]) { const f = SA.liveId(id); if (!mods.includes(f)) mods.push(f); }
    C.mods = mods;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 隐私模式 */ } }
  function reset() { d = fresh(); save(); return d; }

  // 库存按「模块 + 材料」分开记：黄铜的键就是 id，其余是 id@材料（SA.invKey）
  const addInv = (id, n = 1, mt = 1) => { const k = SA.invKey(id, mt); d.inv[k] = (d.inv[k] || 0) + n; if (d.inv[k] <= 0) delete d.inv[k]; };
  const invCount = (id) => Object.keys(d.inv).reduce((a, k) => a + (SA.parseKey(k).id === id ? d.inv[k] : 0), 0);
  // 从库存取出一个该模块，优先拿材料最好的；返回材料等级，没有就返回 0
  function takeBest(id) {
    let best = 0;
    for (const k in d.inv) { const p = SA.parseKey(k); if (p.id === id && d.inv[k] > 0) best = Math.max(best, p.mt); }
    if (best) addInv(id, -1, best);
    return best;
  }
  const addIngots = (map) => { for (const k in map || {}) d.ingots[k] = (d.ingots[k] || 0) + map[k]; };
  // 唯一件只能由缴获流程写入账本；重复调用保持幂等并拒绝第二件。
  function hasUnique(id) { return !!(d.uniqueClaims && d.uniqueClaims[id]); }
  function claimUnique(id, mt, source = 'salvage') {
    if (hasUnique(id)) return false;
    d.uniqueClaims[id] = { mt: mt || SA.uniqueRule(id)?.mt || 5, source, at: Date.now() };
    return true;
  }

  // 银行：每场比赛未还清的债务加收 10% 利息
  const LOAN_CAP = 1500;
  const loanRoom = () => Math.max(0, LOAN_CAP - d.debt);
  function borrow(n) {
    if (n <= 0 || n > loanRoom()) return false;
    d.debt += n; d.money += n;
    return true;
  }
  // 买下 n 个模块进库存
  function buy(id, n = 1) {
    if (SA.isUnique(id)) return false;
    const cost = SA.buyPrice(id) * n;
    if (d.money < cost) return false;
    d.money -= cost; addInv(id, n, SA.buyMt(id));
    return true;
  }

  function repairCost(cell) {
    // 修满 = 模块总价值（含材料和改装）× 该模块的修理费比例（SA.repairRate），按损伤比例计；报废的也按修满算
    const lost = 1 - Math.max(0, cell.hp) / SA.V.maxHp(cell);
    return lost <= 0 ? 0 : Math.max(1, Math.ceil(lost * SA.cellValue(cell) * SA.repairRate(cell.id)));
  }

  // 终局锦标赛（通关战役后开放）：第 1 赛季对手是镀镍，之后每季升一级材料，封顶以太合金后再加耐久
  function opponent(i = d.round) {
    const o = SA.OPPONENTS[i];
    const mt = Math.min(SA.MAT_MAX, 3 + d.season);
    const mul = 1 + Math.max(0, d.season - 3) * 0.2;
    return { ...o, index: i, hpMul: mul, mt, prize: Math.round(o.prize * (2 + (d.season - 1) * 0.6)), vehicle: SA.V.fromAscii(o.name, o.rows, o.sides, mt) };
  }

  // 赔率：对手评分 / 我方评分
  function odds(ev, hpMul = 1) {
    const me = SA.V.stats(d.vehicle).rating;
    const them = SA.V.stats(SA.V.battleCopy(ev, hpMul, true)).rating;
    return Math.max(1.15, Math.min(5, +(1.1 + (them / Math.max(1, me)) * 0.9).toFixed(2)));
  }

  // 分享码示例：只读内置数据，不写本地“云端”存储；玩家车辆通过蓝图库导入 / 导出分享码。
  const Cloud = {
    list() {
      const presets = SA.CLOUD_PRESETS.map(p => ({ author: p.author, name: p.name, code: SA.V.encode(SA.V.fromAscii(p.name, p.rows, p.sides)) }));
      return presets;
    },
  };

  // 提示金额的格式与原界面一致，结算规则不依赖 DOM。
  const formatMoney = (n) => `£${Math.round(n).toLocaleString()}`;

  // 蓝图库独立存储与应用规则；重置主存档时仍保留蓝图。
  const Blueprints = (() => {
    const M = SA.MODULES;
  const KEY = 'steam_arena_blueprints_v1';   // 独立于存档，SA.reset() 不会清掉
  const d = () => SA.S.d;
  const money = formatMoney;

  const official = () => SA.OFFICIAL_BLUEPRINTS.map(b => ({ official: true, name: b.name, desc: b.desc, ...SA.V.layout(SA.V.fromAscii(b.name, b.rows, b.sides || [])) }));
  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 隐私模式 */ } }

  function save(name) {
    const list = mine();
    list.unshift({ name, ...SA.V.layout(d().vehicle), at: Date.now() });
    store(list);
  }
  function overwrite(i) {
    const list = mine();
    Object.assign(list[i], SA.V.layout(d().vehicle), { at: Date.now() });
    store(list);
  }
  function del(i) { const list = mine(); list.splice(i, 1); store(list); }
  function rename(i, name) { const list = mine(); if (list[i]) { list[i].name = name; store(list); } }

  // 应用蓝图要花多少钱：优先复用车上的模块（受损的先用上，保留原耐久），再用库存，最后补买
  function plan(bp) {
    const target = SA.V.fromLayout(d().vehicle.name, bp);
    const need = SA.V.countIds(target);
    const pool = {};
    let scrap = 0;
    const blocked = [];
    SA.V.each(d().vehicle, (cell) => {
      if (cell.hp <= 0) scrap += Math.round(SA.cellValue({ id: cell.id, mt: cell.mt }) * 0.1);
      else (pool[cell.id] = pool[cell.id] || []).push(cell);
    });
    // 车上的同款模块：材料好的先用，同材料里受损的先用上（保留原耐久）
    for (const id in pool) pool[id].sort((a, b) => (b.mt || 1) - (a.mt || 1) || a.hp / SA.V.maxHp(a) - b.hp / SA.V.maxHp(b));
    const buy = {};
    let buyCost = 0, fixCost = 0;
    for (const id in need) {
      const miss = Math.max(0, need[id] - (pool[id] || []).length - SA.S.invCount(id));
      if (miss && SA.isUnique(id)) blocked.push(`${M[id].name}是唯一件，只能通过缴获获得`);
      else if (miss) { buy[id] = miss; buyCost += miss * SA.buyPrice(id); }
    }
    // 用不上的受损模块要修好才能放回库存
    for (const id in pool) for (const cell of pool[id].slice(need[id] || 0)) if (cell.hp < SA.V.maxHp(cell)) fixCost += SA.S.repairCost(cell);
    return { target, need, pool, buy, buyCost, fixCost, scrap, blocked, cost: buyCost + fixCost };
  }

  // 付款确认后按原计划组装，库存、回收款与车辆变更统一在逻辑层处理。
  function applyPlan(p) {
      for (const id in p.buy) SA.S.addInv(id, p.buy[id], SA.buyMt(id));
      SA.V.each(p.target, (cell, r, c, layer) => {
        const reuse = p.pool[cell.id] && p.pool[cell.id].shift();
        if (reuse) p.target[layer][r][c] = reuse;
        else p.target[layer][r][c] = SA.newCell(cell.id, SA.S.takeBest(cell.id) || 1);
      });
      // 用不上的模块回库存；改装件按半价回收
      for (const id in p.pool) for (const cell of p.pool[id]) {
        SA.S.addInv(cell.id, 1, cell.mt || 1);
        for (let k = 1; k <= (cell.lv || 0); k++) d().money += Math.round(SA.upCost(cell.id, k) * 0.5);
      }
      d().money += p.scrap;
      d().vehicle = p.target;
      SA.Camp.syncLim();
      SA.S.save();
  }

  // 统一列表：我的 → 官方 → 内置分享码示例（示例也能当蓝图直接应用）
  function all() {
    const out = [];
    mine().forEach((b, i) => out.push({ ...b, kind: 'mine', index: i, key: `m${b.at}` }));
    official().forEach((b, i) => out.push({ ...b, kind: 'official', key: `o${i}` }));
    SA.S.Cloud.list().forEach((e, i) => {
      const v = SA.V.decode(e.code);
      if (v) out.push({ name: e.name, author: e.author, code: e.code, kind: 'cloud', key: `c${i}${e.name}`, ...SA.V.layout(v) });
    });
    return out;
  }

  // 导入分享码：存成自己的蓝图
  function importCode(code) {
    const v = SA.V.decode(code);
    if (!v) return null;
    const list = mine();
    list.unshift({ name: v.name, ...SA.V.layout(v), at: Date.now() });
    store(list);
    return v;
  }

  // 分享：只生成分享码，不写任何云端或本地上传记录。
  function share(bp) {
    const v = SA.V.fromLayout(bp.name, bp);
    return SA.V.encode(v);
  }

    return { all, save, overwrite, del, rename, mine, official, plan, applyPlan, importCode, share };
  })();

  function arenaEntries(mode) {
    const D = d;
    if (mode === 'camp') {
      const C = D.camp, over = SA.Camp.done();
      return SA.CAMPAIGN.flatMap((chapter, chapterIndex) => chapter.stages.map((o, i) => {
        const stage = SA.Camp.stage(chapterIndex, i);
        const beaten = over || chapterIndex < C.ch || (chapterIndex === C.ch && i < C.st);
        const next = !over && chapterIndex === C.ch && i === C.st;
        const replay = beaten;
        return { key: `${chapterIndex},${i}`, name: o.name, pilot: o.pilot, blurb: o.blurb, v: stage.vehicle, raw: stage.vehicle, hpMul: 1, rating: SA.V.stats(stage.vehicle).rating, prize: replay ? 0 : o.prize, boss: o.boss, terrain: o.terrain || 'flat', replay, next,
          tag: replay ? ['ok', '可重打'] : next ? ['next', o.boss ? 'Boss' : '下一场'] : ['no', o.boss ? 'Boss' : `第 ${i + 1} 场`],
          title: `第 ${chapterIndex + 1} 章 · 第 ${i + 1} 场 · ${o.name}`, lock: replay || next ? null : '先完成前面的战役',
          start: () => SA.Battle.start({ mode: 'campaign', replay, enemyVehicle: stage.vehicle, enemyName: o.name, aim: o.aim, style: o.style, terrain: o.terrain, boss: o.boss, hpMul: 1, prize: replay ? 0 : o.prize, uniqueLoot: o.uniqueLoot || [] }) };
      }));
    }
    if (mode === 'side') return SA.Camp.sideEntries().map(e => ({
      key: e.id, name: e.name, pilot: e.pilot, blurb: e.blurb, v: e.vehicle, raw: e.vehicle, hpMul: 1,
      rating: SA.V.stats(e.vehicle).rating, prize: 0, boss: false, terrain: e.terrain || 'flat',
      tag: e.won ? ['ok', '可重打'] : ['next', '可选遭遇'], title: `遭遇 · ${e.name}`,
      lock: null, replay: e.won,
      start: () => SA.Battle.start({ mode: 'side', sideId: e.id, replay: e.won, enemyVehicle: e.vehicle, enemyName: e.name, aim: e.aim, style: e.style, terrain: e.terrain, boss: false, hpMul: 1, prize: 0, settleDamage: e.settleDamage !== false,
        uniqueLoot: e.reward ? [{ id: e.reward.id, mt: e.reward.mt, once: true, source: e.reward.source || 'side' }] : [] }),
    }));
    if (mode === 'tour') return SA.OPPONENTS.map((o, i) => {
      const op = SA.S.opponent(i);
      const bv = SA.V.battleCopy(op.vehicle, op.hpMul, true);
      const terrain = SA.TERRAIN_ORDER[i % SA.TERRAIN_ORDER.length];   // 终局锦标赛：六轮六种场地
      return { key: i, name: op.name, pilot: op.pilot, blurb: op.blurb, v: bv, raw: op.vehicle, hpMul: op.hpMul, rating: SA.V.stats(bv).rating, prize: op.prize, terrain,
        tag: i < D.round ? ['ok', '已击败'] : i === D.round ? ['next', '下一场'] : ['no', `第 ${i + 1} 轮`],
        title: `第 ${i + 1} 轮 · ${op.name}`, lock: i !== D.round ? (i < D.round ? '已经击败过了' : `先打完第 ${D.round + 1} 轮`) : null,
        start: () => SA.Battle.start({ mode: 'tournament', enemyVehicle: op.vehicle, enemyName: op.name, aim: op.aim, terrain, boss: i === SA.OPPONENTS.length - 1, hpMul: op.hpMul, prize: op.prize }) };
    });
    if (mode === 'street') {
      const me = SA.V.stats(D.vehicle).rating;
      return SA.Street.offers().map((o, i) => {
        const tier = SA.STREET_TIERS[i];
        const v = SA.Street.vehicleOf(o), cap = SA.Street.cap(i);
        return { key: i, name: o.name, pilot: o.pilot, blurb: '街坊邻居随手拼的小车。赢了拿奖金，不计声望、不影响赛程；损伤照常带回车间。', v, rating: o.rating, prize: o.prize, terrain: o.terrain || 'flat',
          tag: ['', `上限 ${cap}`], title: `${tier.name} · ${o.name}`, lock: me > cap ? `你的评分 ${me} 超过上限 ${cap}` : null,
          start: () => SA.Battle.start({ mode: 'street', streetTier: i, enemyVehicle: v, enemyName: o.name, aim: o.aim, terrain: o.terrain, hpMul: 1, prize: o.prize }) };
      });
    }
    return [];
  }


  // 委托资格与交付沿用原声望、连通和属性条件，不消耗车辆。
  function orderStatus(o, s) {
    const locked = d.rep < o.rep;
    return { locked, ok: !locked && !s.issues.length && o.req.every(([, f, n]) => f(s) >= n) };
  }
  function readyOrders(s) {
    return SA.ORDERS.filter(o => d.orders.includes(o.id) && orderStatus(o, s).ok).length;
  }
  function deliverOrder(o, oid) {
    d.money += o.reward; d.rep += 1; addIngots(o.ingots);
    d.orders = d.orders.filter(x => x !== oid); d.ordersDone.push(oid);
    d.news = `${o.who}买下了你的图纸授权，付款 ${formatMoney(o.reward)}。`;
  }
  // 下注和撤回只变更存档；界面负责保持原刷新与提示顺序。
  function placeBet(amount, odds) { d.money -= amount; d.bet = { amount, odds }; save(); }
  function cancelBet() { d.money += d.bet.amount; d.bet = null; save(); }

  // 战斗结算只更新存档并返回原提示；缴获与解锁弹窗由视觉层按顺序呈现。
  const drawFee = (prize) => Math.max(5, Math.round(prize * 0.1 / 5) * 5);
  function settleBattle(res) {
    const lines = [], pre = [], money0 = d.money;
    if (res.replay) {
      d.news = res.win ? `「${d.vehicle.name}」重打击败了「${res.enemyName}」。` : `「${d.vehicle.name}」完成了与「${res.enemyName}」的重打。`;
      save();
      return { lines, pre, money0 };
    }
    const settlesDamage = res.mode !== 'friendly' && (res.mode !== 'side' || res.opts.settleDamage !== false);
    if (res.mode !== 'friendly' && settlesDamage) {
      d.battles++;
      // 损伤带回车间
      SA.V.each(d.vehicle, (cell, r, c, layer) => {
        if (cell.hp <= 0) return;
        const b = res.playerVehicle[layer][r][c];
        cell.hp = b ? Math.max(0, b.hp) : 0;
      });
    }
    if (res.mode === 'street') {
      const tier = SA.STREET_TIERS[res.opts.streetTier];
      if (res.draw) {
        const fee = drawFee(res.prize);
        d.money += fee;
        lines.push(`平手：双方各拿出场费 ${formatMoney(fee)}`);
        d.news = `「${d.vehicle.name}」在${tier.name}和「${res.enemyName}」打成平手。`;
      } else if (res.win) {
        d.money += res.prize; d.wins++;
        lines.push(`奖金 +${formatMoney(res.prize)}`);
        d.news = `「${d.vehicle.name}」在${tier.name}赢了「${res.enemyName}」，进账 ${formatMoney(res.prize)}。`;
      } else {
        d.losses++;
        d.news = `「${d.vehicle.name}」在${tier.name}输给了「${res.enemyName}」。`;
      }
      lines.push('街头赛不计声望，也不影响战役进度。');
      SA.Street.consume(res.opts.streetTier);
    } else if (res.mode === 'side') {
      const firstWin = res.win && SA.Camp.sideWin(res.opts.sideId || res.enemyName);
      if (res.draw) {
        lines.push('遭遇战平手：不发奖金，也不计声望。');
        d.news = `「${d.vehicle.name}」和「${res.enemyName}」在场外打成平手。`;
      } else if (res.win) {
        lines.push('遭遇战胜利：不发奖金，也不计声望。');
        if (firstWin) {
          const loot = SA.Camp.salvageOptions(res.survivors || []);
          if (loot.length) pre.push({ kind: 'salvage', survivors: res.survivors || [] });
          else lines.push('对手车上没有你缺的零件，这次没什么可缴获的。');
        } else lines.push('这场遭遇战已经完成过了，没有重复奖励。');
        d.news = `「${d.vehicle.name}」击败了场外的「${res.enemyName}」。`;
      } else {
        lines.push('遭遇战失败：不发奖金，也不计声望。');
        d.news = `「${d.vehicle.name}」败给了场外的「${res.enemyName}」。`;
      }
    } else if (res.mode === 'campaign' || res.mode === 'tournament') {
      const camp = res.mode === 'campaign';
      if (d.debt) { const add = Math.ceil(d.debt * 0.1); d.debt += add; lines.push(`银行利息 +${formatMoney(add)}`); }
      if (res.draw) {
        const fee = drawFee(res.prize);
        d.money += fee;
        lines.push(`平手：双方各拿出场费 ${formatMoney(fee)}，这一场要重赛`);
        if (d.bet) { d.money += d.bet.amount; lines.push(`平局退还赌注 ${formatMoney(d.bet.amount)}`); }
        d.news = `「${d.vehicle.name}」和「${res.enemyName}」打成平手，择日重赛。`;
      } else if (res.win) {
        d.money += res.prize; d.wins++;
        const rep = (res.flawless ? 2 : 1) + (res.surrendered ? 1 : 0);
        d.rep += rep;
        lines.push(`奖金 +${formatMoney(res.prize)}`, `声望 +${rep}${[res.flawless ? '驾驶舱毫发无损' : '', res.surrendered ? '接受投降，体面收场' : ''].filter(Boolean).map(x => `（${x}）`).join('')}`);
        if (d.bet) { const pay = Math.round(d.bet.amount * d.bet.odds); d.money += pay; lines.push(`赌注兑现 +${formatMoney(pay)}`); }
        // 缴获：只有你还没有的零件或史诗 / 传奇件；什么都没有就说一声
        const loot = SA.Camp.salvageOptions(res.survivors || []);
        if (loot.length) pre.push({ kind: 'salvage', survivors: res.survivors || [] });
        else lines.push('对手车上没有你缺的零件，这次没什么可缴获的。');
        if (camp) {
          const r = SA.Camp.win();
          lines.push(...r.lines);
          for (const u of r.unlocks) pre.push({ kind: 'unlock', unlock: u });
          const st = SA.Camp.current();
          d.news = SA.Camp.done() ? `「${d.vehicle.name}」击败女王号，夺得帝国蒸汽大奖赛冠军！`
            : `「${d.vehicle.name}」击败了「${res.enemyName}」。下一场：${SA.CAMPAIGN[st.ci].name} · ${st.name}。`;
        } else {
          d.round++;
          if (d.round >= SA.OPPONENTS.length) {
            d.champion++; d.season++; d.round = 0;
            SA.S.addIngots({ aether: 1 });
            lines.push(`🏆 你赢得了第 ${d.season - 1} 赛季冠军！奖励 ${SA.INGOTS.aether.name} ×1。新赛季的对手会换上更好的材料。`);
            d.news = `「${d.vehicle.name}」夺得伦敦蒸汽大奖赛第 ${d.season - 1} 赛季冠军！`;
          } else {
            d.news = `「${d.vehicle.name}」击败了「${res.enemyName}」，晋级第 ${d.round + 1} 轮。`;
          }
        }
      } else {
        d.losses++;
        if (d.bet) lines.push(`赌注 ${formatMoney(d.bet.amount)} 输光了`);
        d.news = `「${d.vehicle.name}」败给了「${res.enemyName}」。${SA.Camp.has('garage') ? '回车间对症改装，再来。' : '再来一次。'}`;
      }
      d.bet = null;
      // 补充订单
      const pool = SA.ORDERS.filter(o => !d.orders.includes(o.id) && !d.ordersDone.includes(o.id));
      if (!pool.length && d.ordersDone.length) d.ordersDone = [];
      while (d.orders.length < 3) {
        const p = SA.ORDERS.filter(o => !d.orders.includes(o.id) && !d.ordersDone.includes(o.id));
        if (!p.length) break;
        d.orders.push(p[Math.floor(Math.random() * p.length)].id);
      }
    } else {
      lines.push('友谊赛：不结算奖金，也不留下损伤。');
    }
    SA.S.save();
    return { lines, pre, money0 };
  }

  function stashCell(cell) {
    let back = 0;
    for (let k = 1; k <= (cell.lv || 0); k++) back += Math.round(SA.upCost(cell.id, k) * 0.5);
    if (cell.hp <= 0) back += Math.round(SA.cellValue({ id: cell.id, mt: cell.mt }) * 0.1);
    else SA.S.addInv(cell.id, 1, cell.mt || 1);
    d.money += back;
    return back;
  }

  // 材料升级：黄铜 → 熟铁 → 钢 → 镀镍（花钱，随战役解锁）→ 乌兹钢 / 以太合金（还要消耗锭 / 结晶）
  function matUpInfo(cell) {
    const to = (cell.mt || 1) + 1;
    if (to > SA.MAT_MAX) return { max: true };
    const mat = SA.MATS[to], cost = SA.matUpCost(cell.id, to);
    if (mat.ingot) {
      const n = d.ingots[mat.ingot] || 0;
      return { to, mat, cost, ok: n > 0, why: n > 0 ? '' : `需要 ${SA.INGOTS[mat.ingot].name}（委托 / Boss 掉落）` };
    }
    if (to > SA.Camp.maxMat()) return { to, mat, cost, ok: false, why: `${mat.name}还没解锁（推进战役）` };
    return { to, mat, cost, ok: true };
  }

  // 通过原摆放检查并付款后执行换件；回收和库存扣除保持原先顺序。
  function installStock(v, id, r, c, mt, layer, cur, clash) {
    const old = cur && cur.cell;
      let scrap = 0;
      if (old) { v[layer][cur.r][cur.c] = null; scrap = stashCell(old); }
      for (const o of clash) { v.body[o.r][o.c] = null; scrap += stashCell(o.cell); }
      SA.V.put(v, id, r, c, mt);
      SA.S.addInv(id, -1, mt);
    return scrap;
  }

  // 编辑器操作：付款在原确认入口扣除，其余模块变更在此执行。
  const buyable = (id) => SA.Camp.has('shop') && SA.Camp.hasMod(id) && !SA.isUnique(id);
  function payAmount(amount) { d.money -= amount; save(); }
  function repay(n) { const x = Math.min(n, d.debt); d.debt -= x; d.money -= x; }
  function repairCells(cells) { for (const c of cells) c.hp = SA.V.maxHp(c); }
  function upgradeMaterial(cell, u) {
    if (u.mat.ingot) d.ingots[u.mat.ingot]--;
    const before = SA.V.maxHp(cell);
    cell.mt = u.to;
    if (cell.hp > 0) cell.hp += SA.V.maxHp(cell) - before;
  }
  function upgradeCell(cell, lv) {
    const before = SA.V.maxHp(cell);
    cell.lv = lv;
    if (cell.hp > 0) cell.hp += SA.V.maxHp(cell) - before;
  }
  function renameVehicle(name) { d.vehicle.name = name.trim() || '原型机'; save(); }
  function sellStock(id, mt) {
    const x = Math.round(SA.cellValue({ id, mt }) * 0.5);
    d.money += x; addInv(id, -1, mt);
    return x;
  }
  function removeVehicleCell(layer, r, c) {
    const res = SA.V.remove(d.vehicle, layer, r, c);
    if (!res.ok) return res;
    let scrap = 0;
    for (const cell of res.removed) scrap += stashCell(cell);
    return { ...res, scrap };
  }
  return { load, save, reset, get d() { return d; }, addInv, invCount, takeBest, addIngots, hasUnique, claimUnique, LOAN_CAP, loanRoom, borrow, buy, repairCost, opponent, odds, Cloud, Blueprints, arenaEntries, orderStatus, readyOrders, deliverOrder, placeBet, cancelBet, settleBattle, stashCell, matUpInfo, buyable, payAmount, repay, repairCells, upgradeMaterial, upgradeCell, renameVehicle, sellStock, installStock, removeVehicleCell };
})();
