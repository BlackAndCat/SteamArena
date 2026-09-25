// 街头赛：锦标赛之外的赚钱比赛。对手是随手拼装的小角色，评分贴近玩家；每档比赛有评分上限
window.SA = window.SA || {};

SA.Street = (() => {
  const M = SA.MODULES, K = SA.K;
  const ri = (n) => Math.floor(Math.random() * n);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[ri(a.length)];
  const d = () => SA.S.d;
  const cell = (id) => ({ id, hp: M[id].hp });

  // 随手拼一台小车：底盘 2~4 格，上面 1~3 层逐层变窄；直射武器只放在每行最前端，不会被己方挡住
  // 按大格（6 × 8）拼，最后换算成子格
  function build(name, big) {
    const bg = () => Array.from({ length: 6 }, () => Array(8).fill(null));
    const v = { body: bg(), side: bg() };
    const last = 5, c0 = 2;
    const chassis = pick(['track', 'quad', 'biped']);
    const w = big ? 3 + ri(3) : 2 + ri(3);
    for (let c = c0; c < c0 + w; c++) v.body[last][c] = cell(chassis);
    const spots = [];
    let width = w;
    const levels = big ? 2 + ri(3) : 1 + ri(3);
    for (let i = 0; i < levels && width > 0; i++) {
      const r = last - 1 - i;
      for (let c = c0; c < c0 + width; c++) {
        const front = c === c0 + width - 1;
        let id = pick(['armor', 'armor', 'armor', 'water', 'boiler', 'armor_heavy']);
        if (front && Math.random() < 0.65) id = pick(['mg', 'mg', 'cannon']);
        else if (!front && Math.random() < 0.1) id = 'mortar';
        v.body[r][c] = cell(id);
        if (!SA.isWeapon(id)) spots.push([r, c]);
      }
      width -= ri(2);
    }
    // 必须有驾驶舱和锅炉
    if (spots.length < 2) return null;
    spots.sort(() => Math.random() - 0.5);
    const [kr, kc] = spots.pop();
    v.body[kr][kc] = cell('cockpit');
    if (!v.body.some(row => row.some(x => x && x.id === 'boiler'))) { const [br, bc] = spots.pop(); v.body[br][bc] = cell('boiler'); }
    // 偶尔加点花样：车头铲斗 / 撞角 / 侧炮
    if (chassis !== 'biped' && Math.random() < 0.15) v.body[last][c0 + w] = cell('bucket');
    const r1 = last - 1, fr = v.body[r1].reduce((a, x, c) => (x ? c : a), -1);
    if (fr >= 0 && /^armor/.test(v.body[r1][fr].id) && Math.random() < 0.3) v.body[r1][fr + 1] = cell('spike');
    if (spots.length && Math.random() < 0.15) { const [sr, sc] = pick(spots); if (v.body[sr][sc].id !== 'cockpit') v.side[sr][sc] = cell('side_cannon'); }
    return SA.V.fromBig(name, v.body, v.side);
  }

  const myRating = () => SA.V.stats(d().vehicle).rating;
  // 评分上限随战役放大：材料越好，同一档比赛的车也越强
  const CAP_MUL = [1, 1, 1.35, 1.8, 2.4, 3.1];
  const cap = (ti) => Math.round(SA.STREET_TIERS[ti].cap * (SA.Camp.done() ? 3.8 : CAP_MUL[SA.Camp.chIndex()] || 1) / 10) * 10;
  const baseFor = (ti) => Math.min(myRating(), cap(ti));
  // 街头小车的材料：已解锁的最好材料，或者低一级
  const withMat = (v, mt) => { if (mt > 1) SA.V.each(v, (cell) => { cell.mt = mt; cell.hp = SA.mod(cell).hp; }); return v; };
  const vehicleOf = (o) => withMat(SA.V.fromLayout(o.name, o.layout), o.mt || 1);

  // 为第 ti 档生成一个对手：多拼几台，取评分最接近目标的那台（不超过上限）
  function makeOffer(ti, used = []) {
    const top = cap(ti);
    const base = baseFor(ti);
    const goal = Math.min(top, base * rnd(0.88, 1.08));
    const maxMt = SA.Camp.maxMat();
    let best = null;
    for (let k = 0; k < 200; k++) {
      const mt = Math.max(1, maxMt - (k % 2));
      const v = build('', goal / SA.MATS[mt].mul > 280 && k % 4 < 2);
      if (!v) continue;
      withMat(v, mt);
      const s = SA.V.stats(v);
      if (!s.canDeploy || s.blocked.length || s.rating > top) continue;
      const diff = Math.abs(s.rating - goal);
      if (!best || diff < best.diff) best = { diff, v, mt, rating: s.rating };
      if (diff < goal * 0.03) break;
    }
    if (!best) {   // 兜底：最朴素的小双足
      const v = SA.V.fromAscii('', ['........', '........', '........', '...KM...', '...OA...', '...BB...']);
      best = { v, mt: 1, rating: SA.V.stats(v).rating };
    }
    const pool = SA.STREET_PILOTS.filter(p => !used.includes(p[0]));
    const [pilot, name] = pick(pool.length ? pool : SA.STREET_PILOTS);
    return {
      tier: ti, pilot, name, base, rating: best.rating, aim: +rnd(0.55, 0.75).toFixed(2),
      prize: Math.round(best.rating * 0.4 / 5) * 5,   // 奖金只看对手强弱
      layout: SA.V.layout(best.v), mt: best.mt,
    };
  }

  // 当前的街头赛邀约：玩家评分变化超过 15% 的那一档重新配对手
  function offers(force) {
    const st = d().street || (d().street = { offers: [] });
    SA.STREET_TIERS.forEach((tier, ti) => {
      const o = st.offers[ti];
      const base = baseFor(ti);
      if (force || !o || Math.abs(o.base - base) > base * 0.15) {
        st.offers[ti] = makeOffer(ti, st.offers.filter((x, j) => x && j !== ti).map(x => x.pilot));
      }
    });
    SA.S.save();
    return st.offers;
  }

  // 打完一场，这一档换个新对手
  function consume(ti) {
    const st = d().street;
    if (!st || ti == null) return;
    st.offers[ti] = makeOffer(ti, st.offers.filter((x, j) => x && j !== ti).map(x => x.pilot));
  }

  return { offers, consume, build, cap, vehicleOf };
})();
