// 存档与经济
window.SA = window.SA || {};

SA.S = (() => {
  const KEY = 'steam_arena_save_v1';
  const CLOUD_KEY = 'steam_arena_cloud_v1';
  let d = null;

  function fresh() {
    return {
      money: 400, debt: 0, rep: 0, season: 1, round: 0,
      inv: { armor: 2, mg: 1 },
      vehicle: SA.V.fromAscii('一号原型机', SA.STARTER),
      bet: null,
      orders: ['farmer', 'post', 'mill'], ordersDone: [],
      wins: 0, losses: 0, battles: 0, champion: 0,
      news: '欢迎来到蒸汽竞技场。先在「车间」看看你的原型机，再去「出战」挑一场比赛。',
    };
  }

  function load() {
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (!d || !d.vehicle) d = fresh();
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 隐私模式 */ } }
  function reset() { d = fresh(); save(); return d; }

  const addInv = (id, n = 1) => { d.inv[id] = (d.inv[id] || 0) + n; if (d.inv[id] <= 0) delete d.inv[id]; };

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
    const m = SA.MODULES[cell.id];
    const lost = 1 - Math.max(0, cell.hp) / SA.V.maxHp(cell);
    return lost <= 0 ? 0 : Math.max(1, Math.ceil(lost * m.price / 20));
  }

  function opponent(i = d.round) {
    const o = SA.OPPONENTS[i];
    const mul = 1 + (d.season - 1) * 0.25;
    return { ...o, index: i, hpMul: mul, prize: Math.round(o.prize * (1 + (d.season - 1) * 0.5)), vehicle: SA.V.fromAscii(o.name, o.rows, o.sides) };
  }

  function odds() {
    const me = SA.V.stats(d.vehicle).rating;
    const op = opponent();
    const them = SA.V.stats(SA.V.battleCopy(op.vehicle, op.hpMul, true)).rating;
    return Math.max(1.15, Math.min(5, +(1.1 + (them / Math.max(1, me)) * 0.9).toFixed(2)));
  }

  function militaryOffer() {
    if (d.rep < 4) return null;
    const s = SA.V.stats(d.vehicle);
    return Math.round(s.value * 1.8 + 150 * d.season + 60 * d.rep);
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

  return { load, save, reset, get d() { return d; }, addInv, LOAN_CAP, loanRoom, borrow, buy, repairCost, opponent, odds, militaryOffer, Cloud };
})();
