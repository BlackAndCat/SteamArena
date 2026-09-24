// 街头赛：锦标赛之外的赚钱比赛。对手是随手拼装的小角色，评分贴近玩家；每档比赛有评分上限
window.SA = window.SA || {};

SA.Street = (() => {
  const h = SA.h, M = SA.MODULES, K = SA.K;
  const ri = (n) => Math.floor(Math.random() * n);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[ri(a.length)];
  const d = () => SA.S.d;
  const cell = (id) => ({ id, hp: M[id].hp });

  // 随手拼一台小车：底盘 2~4 格，上面 1~3 层逐层变窄；直射武器只放在每行最前端，不会被己方挡住
  function build(name, big) {
    const v = SA.V.create(name);
    const last = K.ROWS - 1, c0 = 2;
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
    if (!SA.V.stats(v).boilers) { const [br, bc] = spots.pop(); v.body[br][bc] = cell('boiler'); }
    // 偶尔加点花样：车头铲斗 / 撞角 / 侧炮
    if (chassis !== 'biped' && Math.random() < 0.15) v.body[last][c0 + w] = cell('bucket');
    const r1 = last - 1, fr = v.body[r1].reduce((a, x, c) => (x ? c : a), -1);
    if (fr >= 0 && /^armor/.test(v.body[r1][fr].id) && Math.random() < 0.3) v.body[r1][fr + 1] = cell('spike');
    if (spots.length && Math.random() < 0.15) { const [sr, sc] = pick(spots); if (v.body[sr][sc].id !== 'cockpit') v.side[sr][sc] = cell('side_cannon'); }
    return v;
  }

  const myRating = () => SA.V.stats(d().vehicle).rating;
  const baseFor = (tier) => Math.min(myRating(), tier.cap);

  // 为第 ti 档生成一个对手：多拼几台，取评分最接近目标的那台（不超过上限）
  function makeOffer(ti, used = []) {
    const tier = SA.STREET_TIERS[ti];
    const base = baseFor(tier);
    const goal = Math.min(tier.cap, base * rnd(0.88, 1.08));
    let best = null;
    for (let k = 0; k < 200; k++) {
      const v = build('', goal > 280 && k % 2 === 0);
      if (!v) continue;
      const s = SA.V.stats(v);
      if (!s.canDeploy || s.blocked.length || s.rating > tier.cap) continue;
      const diff = Math.abs(s.rating - goal);
      if (!best || diff < best.diff) best = { diff, v, rating: s.rating };
      if (diff < goal * 0.03) break;
    }
    if (!best) {   // 兜底：最朴素的小双足
      const v = SA.V.fromAscii('', ['........', '........', '........', '...KM...', '...OA...', '...BB...']);
      best = { v, rating: SA.V.stats(v).rating };
    }
    const pool = SA.STREET_PILOTS.filter(p => !used.includes(p[0]));
    const [pilot, name] = pick(pool.length ? pool : SA.STREET_PILOTS);
    return {
      tier: ti, pilot, name, base, rating: best.rating, aim: +rnd(0.55, 0.75).toFixed(2),
      prize: Math.round(best.rating * 0.4 / 5) * 5,   // 奖金只看对手强弱
      layout: SA.V.layout(best.v),
    };
  }

  // 当前的街头赛邀约：玩家评分变化超过 15% 的那一档重新配对手
  function offers(force) {
    const st = d().street || (d().street = { offers: [] });
    SA.STREET_TIERS.forEach((tier, ti) => {
      const o = st.offers[ti];
      const base = baseFor(tier);
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

  function fight(ti) {
    const o = d().street.offers[ti];
    document.querySelector('#modal').hidden = true;
    SA.Battle.start({ mode: 'street', streetTier: ti, enemyVehicle: SA.V.fromLayout(o.name, o.layout), enemyName: o.name, aim: o.aim, hpMul: 1, prize: o.prize });
  }

  function open(force) {
    const me = SA.V.stats(d().vehicle);
    const list = offers(force);
    const money = SA.UI.money;
    const cards = list.map((o, ti) => {
      const tier = SA.STREET_TIERS[ti];
      const over = me.rating > tier.cap;
      const v = SA.V.fromLayout(o.name, o.layout);
      const why = over ? `你的评分 ${me.rating} 超过上限 ${tier.cap}` : !me.canDeploy ? me.problems[0] : '';
      return h('div', { class: 'panel card street' },
        h('div', { class: 'top' }, h('b', {}, tier.name), h('span', { class: 'chip' }, `评分上限 ${tier.cap}`), h('span', { class: 'price' }, money(o.prize))),
        SA.UI.vehiclePreview(v, 1),
        h('div', {}, h('b', {}, `「${o.name}」`), h('span', { class: 'muted' }, ` · ${o.pilot}`)),
        h('div', { class: 'st' }, `对手评分 ${o.rating} · 你 ${me.rating}${over ? '（超限）' : ''}`),
        h('div', { class: 'ft' },
          why ? h('span', { class: 'st', style: 'color:#fff' }, why) : null,
          h('button', { class: 'btn small primary', disabled: !!why, onclick: () => fight(ti) }, '应战')));
    });
    SA.UI.openModal('街头赛', [
      h('p', { class: 'muted', style: 'font-size:12px;margin-top:0' }, '锦标赛之外赚点外快：对手是街坊邻居随手拼的小车，评分和你差不多。每档有评分上限，车太强进不了场。赢了拿奖金，不计声望、不影响赛程；损伤照样带回工坊。'),
      h('div', { class: 'cards' }, cards),
      h('p', {}, h('button', { class: 'btn small', onclick: () => open(true) }, '换一批对手')),
    ]);
  }

  return { open, offers, consume, build };
})();
