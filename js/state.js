// 存档与经济
window.SA = window.SA || {};

SA.S = (() => {
  const KEY = 'steam_arena_save_v2';   // v2：战役 + 材料（v1 的旧存档不再读取）
  const CLOUD_KEY = 'steam_arena_cloud_v1';
  let d = null;

  function fresh() {
    return {
      money: 300, debt: 0, rep: 0, season: 1, round: 0,
      inv: { armor: 2, mg: 1 }, ingots: {},
      vehicle: SA.V.fromAscii('一号原型机', SA.STARTER),
      bet: null,
      // 战役进度：ch 章、st 关；feat 已开放的功能、mods 商店里能买的模块、mat 能升级到的材料、grid 改装台大小
      camp: { ch: 0, st: 0, intro: -1, done: false, ...JSON.parse(JSON.stringify(SA.CAMP_START)) },
      orders: ['farmer', 'post', 'mill'], ordersDone: [],
      wins: 0, losses: 0, battles: 0, champion: 0,
      news: '老汤姆的铁匠铺后院：你的第一台原型机已经点着了锅炉。去「出战」打第一场练习赛。',
    };
  }

  function load() {
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (!d || !d.vehicle || !d.camp) d = fresh();
    d.ingots = d.ingots || {};
    return d;
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
    const cost = SA.MODULES[id].price * n;
    if (d.money < cost) return false;
    d.money -= cost; addInv(id, n);
    return true;
  }

  function repairCost(cell) {
    // 修满只要原价的 1/20，按损伤比例计；报废的也按修满算
    const lost = 1 - Math.max(0, cell.hp) / SA.V.maxHp(cell);
    return lost <= 0 ? 0 : Math.max(1, Math.ceil(lost * SA.cellValue(cell) / 20));
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

  // 云车库：本地模拟，接口留给真正的后端
  const Cloud = {
    list() {
      let mine = [];
      try { mine = JSON.parse(localStorage.getItem(CLOUD_KEY)) || []; } catch (e) { mine = []; }
      const presets = SA.CLOUD_PRESETS.map(p => ({ author: p.author, name: p.name, code: SA.V.encode(SA.V.fromAscii(p.name, p.rows, p.sides)) }));
      return mine.concat(presets);
    },
    upload(name, v) {
      let mine = [];
      try { mine = JSON.parse(localStorage.getItem(CLOUD_KEY)) || []; } catch (e) { mine = []; }
      const copy = SA.V.clone(v); copy.name = name;
      const entry = { author: '我', name, code: SA.V.encode(copy), at: Date.now() };
      mine.unshift(entry);
      try { localStorage.setItem(CLOUD_KEY, JSON.stringify(mine.slice(0, 20))); } catch (e) { /* ignore */ }
      return entry;
    },
  };

  return { load, save, reset, get d() { return d; }, addInv, invCount, takeBest, addIngots, LOAN_CAP, loanRoom, borrow, buy, repairCost, opponent, odds, Cloud };
})();
