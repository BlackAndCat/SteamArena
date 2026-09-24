// 出战页：左边选比赛（锦标赛 / 街头赛 / 友谊赛 / 委托），右边是对阵、下注和出发按钮。
// 所有「要打的比赛」和「能赚钱的事」都在这一页，选好就走，不再层层弹窗。
window.SA = window.SA || {};

SA.Arena = (() => {
  const h = SA.h, M = SA.MODULES;
  const d = () => SA.S.d;
  const money = (n) => SA.UI.money(n);
  const MODES = [['tour', '锦标赛'], ['street', '街头赛'], ['friendly', '友谊赛'], ['orders', '委托']];
  const st = { mode: 'tour', pick: { tour: null, street: null, friendly: null }, bet: null };
  let root = null;

  function open(mode) {
    if (mode) st.mode = mode;
    st.pick.tour = null;   // 每次进来都默认选中当前这一轮
    SA.go('arena');
    root = h('div', { class: 'arena' });
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    screen.append(root);
    render();
  }

  // ---------- 数据：当前模式下的比赛列表 ----------
  function entries() {
    const D = d();
    if (st.mode === 'tour') return SA.OPPONENTS.map((o, i) => {
      const op = SA.S.opponent(i);
      const bv = SA.V.battleCopy(op.vehicle, op.hpMul, true);
      return { key: i, name: op.name, pilot: op.pilot, blurb: op.blurb, v: bv, rating: SA.V.stats(bv).rating, prize: op.prize,
        tag: i < D.round ? ['ok', '已击败'] : i === D.round ? ['next', '下一场'] : ['no', `第 ${i + 1} 轮`],
        title: `第 ${i + 1} 轮 · ${op.name}`, lock: i !== D.round ? (i < D.round ? '已经击败过了' : `先打完第 ${D.round + 1} 轮`) : null,
        start: () => SA.Battle.start({ mode: 'tournament', enemyVehicle: op.vehicle, enemyName: op.name, aim: op.aim, hpMul: op.hpMul, prize: op.prize }) };
    });
    if (st.mode === 'street') {
      const me = SA.V.stats(D.vehicle).rating;
      return SA.Street.offers().map((o, i) => {
        const tier = SA.STREET_TIERS[i];
        const v = SA.V.fromLayout(o.name, o.layout);
        return { key: i, name: o.name, pilot: o.pilot, blurb: '街坊邻居随手拼的小车。赢了拿奖金，不计声望、不影响赛程；损伤照常带回车间。', v, rating: o.rating, prize: o.prize,
          tag: ['', `上限 ${tier.cap}`], title: `${tier.name} · ${o.name}`, lock: me > tier.cap ? `你的评分 ${me} 超过上限 ${tier.cap}` : null,
          start: () => SA.Battle.start({ mode: 'street', streetTier: i, enemyVehicle: v, enemyName: o.name, aim: o.aim, hpMul: 1, prize: o.prize }) };
      });
    }
    if (st.mode === 'friendly') return SA.S.Cloud.list().map((e, i) => {
      const v = SA.V.decode(e.code);
      if (!v) return null;
      return { key: i, name: e.name, pilot: e.author, blurb: '云车库里其他玩家的载具。友谊赛不结算奖金，也不留下损伤。', v, rating: SA.V.stats(v).rating, prize: 0,
        tag: ['', e.author === '我' ? '我上传的' : '云端'], title: e.name, lock: null,
        start: () => SA.Battle.start({ mode: 'friendly', enemyVehicle: v, enemyName: v.name, aim: 0.9, hpMul: 1 }) };
    }).filter(Boolean);
    return [];
  }

  function render() {
    if (!root || !root.isConnected) return;
    const D = d();
    root.innerHTML = '';
    if (st.pick.tour == null) st.pick.tour = D.round;
    const list = st.mode === 'orders' ? [] : entries();
    const pickKey = st.pick[st.mode];
    const cur = list.find(x => x.key === pickKey) || list.find(x => !x.lock) || list[0] || null;
    if (cur) st.pick[st.mode] = cur.key;

    const s = SA.V.stats(D.vehicle);
    const ordersReady = SA.ORDERS.filter(o => D.orders.includes(o.id) && D.rep >= o.rep && !s.issues.length && o.req.every(([, f, n]) => f(s) >= n)).length;
    const offer = SA.S.militaryOffer();
    const tabs = h('div', { class: 'ar-tabs' }, MODES.map(([k, n]) => h('button', { class: `tab ${st.mode === k ? 'on' : ''}`, onclick: () => { st.mode = k; render(); } },
      n, k === 'tour' ? h('span', { class: 'cnt' }, `第 ${D.round + 1} 轮`) : null,
      k === 'orders' && (offer || ordersReady) ? h('span', { class: 'badge' }, offer ? '军方' : ordersReady) : null)));

    const body = st.mode === 'orders' ? ordersList(s) : h('div', { class: 'ar-rows' }, list.map(e =>
      h('button', { class: `ar-row ${cur && cur.key === e.key ? 'on' : ''} ${e.lock ? 'locked' : ''}`, onclick: () => { st.pick[st.mode] = e.key; render(); } },
        h('span', { class: `chip ${e.tag[0]}` }, e.tag[1]),
        h('span', { class: 'grow' }, h('b', {}, e.title), h('span', { class: 'muted' }, ` · ${e.pilot}`)),
        h('span', { class: 'chip' }, `评分 ${e.rating}`),
        e.prize ? h('span', { class: 'chip gold' }, money(e.prize)) : null)));

    const foot = st.mode === 'street' ? h('button', { class: 'btn small', onclick: () => { SA.Street.offers(true); render(); } }, '换一批对手')
      : st.mode === 'friendly' ? h('span', { class: 'muted' }, '在「车间 → 蓝图库」里可以上传自己的车、导入别人的分享码。')
        : st.mode === 'tour' ? h('span', { class: 'muted' }, `第 ${D.season} 赛季 · 伦敦蒸汽大奖赛：连胜六轮夺冠${D.season > 1 ? `；本赛季对手耐久 +${(D.season - 1) * 25}%` : ''}。点其他轮次可以侦察。`) : null;

    root.append(
      D.news ? h('div', { class: 'panel ar-news' }, h('b', {}, '号外'), D.news) : '',
      h('div', { class: 'ar-grid' },
        h('section', { class: 'panel ar-list' }, tabs, body, foot ? h('div', { class: 'ar-foot' }, foot) : null),
        h('section', { class: 'panel ar-match' }, st.mode === 'orders' ? ordersSide(s) : matchPanel(cur, s))));
  }

  // ---------- 右侧：对阵 ----------
  function card(v, name, sub, rating, flip) {
    const cv = SA.UI.vehiclePreview(v, 2);
    if (flip) cv.style.transform = 'scaleX(-1)';
    return h('div', { class: 'vs-card' }, h('div', { class: 'vs-pic' }, cv), h('b', {}, name), h('span', { class: 'muted' }, sub), h('span', { class: 'chip' }, `评分 ${rating}`));
  }

  function readiness(s) {
    const D = d();
    const hurt = [];
    SA.V.each(D.vehicle, (cell) => { if (cell.hp < SA.V.maxHp(cell)) hurt.push(cell); });
    const cost = hurt.reduce((a, c) => a + SA.S.repairCost(c), 0);
    const out = [];
    if (s.problems.length) out.push(h('div', { class: 'warn bad' }, h('b', {}, '还不能出战：'), s.problems.join('；'), ' ',
      h('button', { class: 'btn small', onclick: () => SA.nav('garage') }, '去车间处理')));
    if (hurt.length) out.push(h('div', { class: 'warn' }, `${hurt.length} 个模块受损，`, h('button', { class: 'btn small', onclick: () =>
      SA.UI.pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false, onPaid: () => { for (const c of hurt) c.hp = SA.V.maxHp(c); SA.UI.toast('全部修好了'); render(); } }) }, `全部修理 ${money(cost)}`)));
    const warns = s.warnings.filter(w => !/损毁/.test(w));
    if (warns.length) out.push(h('div', { class: 'warn' }, warns.join('；')));
    return out;
  }

  function betRow(e) {
    const D = d();
    if (st.mode !== 'tour' || e.lock) return null;
    const odds = SA.S.odds();
    if (D.bet) return h('div', { class: 'bet' }, h('span', { class: 'k' }, '下注'),
      h('span', { class: 'grow' }, `已押 ${money(D.bet.amount)} × ${D.bet.odds} → 赢了拿回 `, h('b', { class: 'gold' }, money(D.bet.amount * D.bet.odds))),
      h('button', { class: 'btn small', onclick: () => { D.money += D.bet.amount; D.bet = null; SA.S.save(); SA.UI.topbar(); render(); } }, '撤回'));
    const max = Math.max(0, Math.floor(D.money / 10) * 10);
    if (!max) return h('div', { class: 'bet' }, h('span', { class: 'k' }, '下注'), h('span', { class: 'muted' }, `赔率 × ${odds}，只能押自己赢。现在没钱可押。`));
    const amt = Math.min(max, st.bet == null ? Math.min(100, max) : st.bet);
    const out = h('span', { class: 'amt' });
    const show = (x) => { out.textContent = `${money(x)} → 赢回 ${money(x * odds)}`; };
    const range = h('input', { type: 'range', min: 0, max, step: 10, value: amt, oninput: () => { st.bet = +range.value; show(+range.value); } });
    show(amt);
    return h('div', { class: 'bet' }, h('span', { class: 'k' }, `下注 × ${odds}`), range, out,
      h('button', { class: 'btn small', onclick: () => {
        const x = +range.value; if (!x) return;
        D.money -= x; D.bet = { amount: x, odds }; st.bet = null; SA.S.save(); SA.UI.topbar(); SA.UI.toast(`押注 ${money(x)}`); render();
      } }, '押自己赢'));
  }

  function matchPanel(e, s) {
    const D = d();
    if (!e) return h('p', { class: 'muted' }, '这里还没有比赛。');
    const why = e.lock || (!s.canDeploy ? '先把车修整好' : null);
    const label = st.mode === 'tour' ? `拉响汽笛 · 第 ${D.round + 1} 轮` : st.mode === 'street' ? '应战' : '友谊赛 · 开打';
    return [
      h('div', { class: 'vs' },
        card(D.vehicle, D.vehicle.name, '你的车', s.rating, false),
        h('div', { class: 'vs-mid' }, 'VS', e.prize ? h('span', { class: 'gold' }, money(e.prize)) : null),
        card(e.v, e.name, e.pilot, e.rating, true)),
      h('p', { class: 'muted blurb' }, e.blurb),
      readiness(s),
      betRow(e),
      h('button', { class: 'btn primary go', disabled: !!why, onclick: () => { document.querySelector('#modal').hidden = true; e.start(); } }, why || label),
      h('div', { class: 'keys' }, h('kbd', {}, 'A'), h('kbd', {}, 'D'), ' 移动（起步先憋气）· 鼠标瞄准 · 按住', h('kbd', {}, '左键'), '开火 · ', h('kbd', {}, '1'), '–', h('kbd', {}, '9'), ' 换武器'),
    ];
  }

  // ---------- 委托：民间图纸订单 + 军方收购 ----------
  function ordersList(s) {
    const D = d();
    const rows = D.orders.map(oid => {
      const o = SA.ORDERS.find(x => x.id === oid);
      const locked = D.rep < o.rep;
      const ok = !locked && !s.issues.length && o.req.every(([, f, n]) => f(s) >= n);
      return h('div', { class: 'ar-order' },
        h('div', { class: 'grow' },
          h('div', {}, h('b', {}, o.who), ' ', locked ? h('span', { class: 'chip no' }, `需要声望 ★${o.rep}`) : null),
          h('div', { class: 'muted', style: 'font-size:12px;margin:4px 0' }, o.text),
          h('div', { class: 'reqs' }, o.req.map(([label, f, n]) => {
            const cur = f(s);
            const isFlag = n === 1 && (cur === 0 || cur === 1) && !/底盘|水箱|装甲/.test(label);
            return h('span', { class: `req ${cur >= n ? 'ok' : 'no'}` }, isFlag ? label : `${label} ${cur}/${n}`);
          }))),
        h('div', { class: 'ar-order-act' }, h('b', { class: 'gold' }, money(o.reward)),
          h('button', { class: 'btn small primary', disabled: !ok, onclick: () => {
            D.money += o.reward; D.rep += 1;
            D.orders = D.orders.filter(x => x !== oid); D.ordersDone.push(oid);
            D.news = `${o.who}买下了你的图纸授权，付款 ${money(o.reward)}。`;
            SA.UI.toast(`委托完成 +${money(o.reward)}，声望 +1`);
            SA.S.save(); SA.UI.topbar(); render();
          } }, '交付图纸')));
    });
    return h('div', { class: 'ar-rows' },
      militaryCard(),
      rows.length ? rows : h('p', { class: 'muted' }, '暂时没有新委托，打完下一场锦标赛再来看看。'),
      s.issues.length ? h('div', { class: 'warn bad' }, `车上有 ${s.issues.length} 个模块悬空，接好之后才能交付图纸。`) : null);
  }

  function militaryCard() {
    const D = d();
    const offer = SA.S.militaryOffer();
    if (!offer) return h('div', { class: 'ar-order muted' }, `陆军部：声望达到 ★4 后会来收购你的原型机（当前 ★${D.rep}）。`);
    return h('div', { class: 'ar-order big-offer' },
      h('div', { class: 'grow' }, h('b', {}, '陆军部 · 原型机收购邀请'),
        h('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, '出售后原型机交给陆军部，车间会拿到一台新的基础底盘重新起步（库存保留），声望 -3。')),
      h('div', { class: 'ar-order-act' }, h('span', { class: 'amt' }, money(offer)),
        h('button', { class: 'btn small primary', onclick: () => SA.UI.dialog('出售原型机', h('p', {}, `以 ${money(offer)} 把「${D.vehicle.name}」卖给陆军部？`), [{ label: '出售', primary: true, onClick: () => {
          D.money += offer; D.rep = Math.max(0, D.rep - 3);
          D.sold = (D.sold || 0) + 1;
          D.vehicle = SA.V.fromAscii(`${D.sold + 1} 号原型机`, SA.STARTER);
          D.news = `原型机以 ${money(offer)} 售予陆军部。车间的新底盘已就位。`;
          SA.S.save(); SA.UI.topbar(); render();
        } }]) }, '出售原型机')));
  }

  function ordersSide(s) {
    const D = d();
    return [
      h('div', { class: 'vs' }, card(D.vehicle, D.vehicle.name, '你的车', s.rating, false)),
      h('p', { class: 'muted blurb' }, '委托只买图纸授权：车满足条件就能交付，车留在你手里。可以临时改装去满足条件，交付后再改回来——在车间用「蓝图库」存一份当前方案，改回来只要一键。'),
      h('button', { class: 'btn go', onclick: () => SA.nav('garage') }, '去车间改装'),
    ];
  }

  return { open, render };
})();
