// 出战页：左边选比赛（战役 / 支线 / 街头赛 / 委托 / 终局锦标赛，后几项随战役解锁），右边是对阵、下注和出发按钮。
// 所有「要打的比赛」和「能赚钱的事」都在这一页，选好就走，不再层层弹窗。
window.SA = window.SA || {};

SA.Arena = (() => {
  const h = SA.h, M = SA.MODULES;
  const d = () => SA.S.d;
  const money = (n) => SA.UI.money(n);
  // [页签, 名称, 需要的功能]
  const MODES = [['camp', '战役', null], ['side', '遭遇战', 'garage'], ['street', '街头赛', 'street'], ['orders', '委托', 'orders'], ['tour', '锦标赛', 'season']];
  const modes = () => MODES.filter(([, , f]) => !f || SA.Camp.has(f));
  const st = { mode: 'camp', pick: { camp: null, tour: null, street: null, friendly: null }, bet: null };
  let root = null;

  // quiet：战后结算会接着弹窗，先不弹章节开场
  function open(mode, quiet) {
    if (mode) st.mode = mode;
    if (!modes().some(([k]) => k === st.mode)) st.mode = 'camp';
    st.pick.tour = null; st.pick.camp = null;   // 每次进来都默认选中当前这一场
    SA.go('arena');
    root = h('div', { class: 'arena' });
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    screen.append(root);
    render();
    if (!quiet) SA.Camp.introIfNew();
  }

  // ---------- 数据：当前模式下的比赛列表 ----------
  function render() {
    if (!root || !root.isConnected) return;
    const D = d();
    root.innerHTML = '';
    if (st.pick.tour == null) st.pick.tour = D.round;
    if (st.pick.camp == null) st.pick.camp = `${SA.Camp.chIndex()},${Math.min(D.camp.st, SA.CAMPAIGN[SA.Camp.chIndex()].stages.length - 1)}`;
    const list = st.mode === 'orders' ? [] : SA.S.arenaEntries(st.mode);
    const pickKey = st.pick[st.mode];
    const cur = list.find(x => x.key === pickKey) || list.find(x => x.next) || list.find(x => !x.lock) || list[0] || null;
    if (cur) st.pick[st.mode] = cur.key;

    const s = SA.V.stats(D.vehicle);
    const ordersReady = SA.S.readyOrders(s);
    const ms = modes();
    const tabs = ms.length > 1 ? h('div', { class: 'ar-tabs' }, ms.map(([k, n]) => h('button', { class: `tab ${st.mode === k ? 'on' : ''}`, onclick: () => { st.mode = k; render(); } },
      n, k === 'tour' ? h('span', { class: 'cnt' }, `第 ${D.round + 1} 轮`) : null,
      k === 'orders' && ordersReady ? h('span', { class: 'badge' }, ordersReady) : null))) : null;
    const ch = SA.CAMPAIGN[SA.Camp.chIndex()];
    const campHead = st.mode === 'camp' ? h('div', { class: 'ar-chapter' }, h('b', {}, ch.name), h('span', { class: 'muted' }, SA.Camp.done() ? '战役已通关 · 终局锦标赛已开放' : ch.blurb)) : null;

    const body = st.mode === 'orders' ? ordersList(s) : h('div', { class: 'ar-rows' }, list.map(e =>
      h('button', { class: `ar-row ${cur && cur.key === e.key ? 'on' : ''} ${e.lock ? 'locked' : ''}`, onclick: () => { st.pick[st.mode] = e.key; render(); } },
        h('span', { class: `chip ${e.tag[0]}` }, e.tag[1]),
        h('span', { class: 'grow' }, h('b', {}, e.title), h('span', { class: 'muted' }, ` · ${e.pilot}`)),
        h('span', { class: 'chip' }, `评分 ${e.rating}`),
        e.prize ? h('span', { class: 'chip gold' }, money(e.prize)) : null)));

    const foot = st.mode === 'street' ? h('button', { class: 'btn small', onclick: () => { SA.Street.offers(true); render(); } }, '换一批对手')
      : st.mode === 'tour' ? h('span', { class: 'muted' }, `第 ${D.season} 赛季 · 伦敦蒸汽大奖赛：连胜六轮夺冠，奖励以太结晶。本赛季对手是「${SA.MATS[Math.min(SA.MAT_MAX, 3 + D.season)].name}」打造。点其他轮次可以侦察。`)
        : st.mode === 'camp' ? h('span', { class: 'muted' }, `第 ${SA.Camp.chIndex() + 1}/${SA.CAMPAIGN.length} 章。已击败的主线可以重打，不发奖励也不留下战损。`) : null;

    root.append(
      D.news ? h('div', { class: 'panel ar-news' }, h('b', {}, '号外'), D.news) : '',
      h('div', { class: 'ar-grid' },
        h('section', { class: 'panel ar-list' }, tabs, campHead, body, foot ? h('div', { class: 'ar-foot' }, foot) : null),
        h('section', { class: 'panel ar-match' }, st.mode === 'orders' ? ordersSide(s) : matchPanel(cur, s))));
  }

  // ---------- 右侧：对阵 ----------
  function card(v, name, sub, rating, flip) {
    const cv = SA.UI.vehiclePreview(v, 2);
    if (flip) cv.style.transform = 'scaleX(-1)';
    const st2 = SA.V.stats(v);
    // 主材料：车上最多的那种；另外标出最好的一件
    const cnt = {};
    let best = 1;
    SA.V.each(v, (cell) => { const t = cell.mt || 1; cnt[t] = (cnt[t] || 0) + 1; best = Math.max(best, t); });
    const main = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 1;
    return h('div', { class: 'vs-card' }, h('div', { class: 'vs-pic' }, cv), h('b', {}, name), h('span', { class: 'muted' }, sub),
      h('span', { class: 'vs-chips' }, h('span', { class: 'chip' }, `评分 ${rating}`), SA.Camp.matChip(main), best > main ? SA.Camp.matChip(best) : null,
        h('span', { class: 'chip' }, SA.tons(st2.weight)), h('span', { class: 'chip' }, SA.kmh(st2.topSpeed))));
  }

  function readiness(s) {
    const D = d();
    const hurt = [];
    SA.V.each(D.vehicle, (cell) => { if (cell.hp < SA.V.maxHp(cell)) hurt.push(cell); });
    const cost = hurt.reduce((a, c) => a + SA.S.repairCost(c), 0);
    const out = [];
    if (s.problems.length) out.push(h('div', { class: 'warn bad' }, h('b', {}, '还不能出战：'), s.problems.join('；'), ' ',
      SA.Camp.has('garage') ? h('button', { class: 'btn small', onclick: () => SA.nav('garage') }, '去车间处理') : null));
    if (hurt.length) out.push(h('div', { class: 'warn' }, `${hurt.length} 个模块受损，`, h('button', { class: 'btn small', title: `最贵的几项：
${SA.UI.repairBrief(hurt)}`, onclick: () =>
      SA.UI.pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false, lines: [SA.UI.repairList(hurt)], onPaid: () => { SA.S.repairCells(hurt); SA.UI.toast('全部修好了'); render(); } }) }, `全部修理 ${money(cost)}`)));
    const warns = s.warnings.filter(w => !/损毁/.test(w));
    if (warns.length) out.push(h('div', { class: 'warn' }, warns.join('；')));
    return out;
  }

  function betRow(e) {
    const D = d();
    if ((st.mode !== 'tour' && st.mode !== 'camp') || e.lock || e.replay || !SA.Camp.has('bet')) return null;
    const odds = SA.S.odds(e.raw, e.hpMul);
    if (D.bet) return h('div', { class: 'bet' }, h('span', { class: 'k' }, '下注'),
      h('span', { class: 'grow' }, `已押 ${money(D.bet.amount)} × ${D.bet.odds} → 赢了拿回 `, h('b', { class: 'gold' }, money(D.bet.amount * D.bet.odds))),
      h('button', { class: 'btn small', onclick: () => { SA.S.cancelBet(); SA.UI.topbar(); render(); } }, '撤回'));
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
        SA.S.placeBet(x, odds); st.bet = null; SA.UI.topbar(); SA.UI.toast(`押注 ${money(x)}`); render();
      } }, '押自己赢'));
  }

  function matchPanel(e, s) {
    const D = d();
    if (!e) return h('p', { class: 'muted' }, '这里还没有比赛。');
    const why = e.lock || (!s.canDeploy ? '先把车修整好' : null);
    const label = st.mode === 'camp' ? (e.replay ? `重打 · ${e.name}` : `拉响汽笛 · ${e.name}`) : st.mode === 'side' ? (e.replay ? `重打 · ${e.name}` : `出发 · ${e.name}`) : st.mode === 'tour' ? `拉响汽笛 · 第 ${D.round + 1} 轮` : '应战';
    return [
      h('div', { class: 'vs' },
        card(D.vehicle, D.vehicle.name, '你的车', s.rating, false),
        h('div', { class: 'vs-mid' }, 'VS', e.prize ? h('span', { class: 'gold' }, money(e.prize)) : null),
        card(e.v, e.name, e.pilot, e.rating, true)),
      h('p', { class: 'muted blurb' }, e.blurb),
      e.terrain ? h('div', { class: 'terrain-note' }, h('b', {}, `场地 · ${SA.TERRAINS[e.terrain].name}`), h('span', { class: 'muted' }, SA.TERRAINS[e.terrain].desc)) : null,
      readiness(s),
      betRow(e),
      h('button', { class: 'btn primary go', disabled: !!why, onclick: () => { document.querySelector('#modal').hidden = true; e.start(); } }, why || label),
      h('div', { class: 'keys' }, h('kbd', {}, 'A'), h('kbd', {}, 'D'), ' 移动（起步先憋气）· 鼠标瞄准 · 按住', h('kbd', {}, '左键'), '稳住准星，绿光自动开火、松手立刻开火 · ', h('kbd', {}, '1'), '–', h('kbd', {}, '9'), ' 换武器'),
    ];
  }

  // ---------- 委托：民间图纸订单 ----------
  function ordersList(s) {
    const D = d();
    const rows = D.orders.map(oid => {
      const o = SA.ORDERS.find(x => x.id === oid);
      const { locked, ok } = SA.S.orderStatus(o, s);
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
          o.ingots ? h('span', { class: 'chip mat', style: `--mat:${SA.MATS[5].chip}` }, Object.entries(o.ingots).map(([k, n]) => `${SA.INGOTS[k].name}×${n}`).join(' ')) : null,
          h('button', { class: 'btn small primary', disabled: !ok, onclick: () => {
            SA.S.deliverOrder(o, oid);
            SA.UI.toast(`委托完成 +${money(o.reward)}${o.ingots ? ` 和 ${Object.keys(o.ingots).map(k => SA.INGOTS[k].name).join('、')}` : ''}，声望 +1`);
            SA.S.save(); SA.UI.topbar(); render();
          } }, '交付图纸')));
    });
    return h('div', { class: 'ar-rows' },
      rows.length ? rows : h('p', { class: 'muted' }, '暂时没有新委托，打完下一场锦标赛再来看看。'),
      s.issues.length ? h('div', { class: 'warn bad' }, `车上有 ${s.issues.length} 个模块悬空，接好之后才能交付图纸。`) : null);
  }

  function ordersSide(s) {
    const D = d();
    return [
      h('div', { class: 'vs' }, card(D.vehicle, D.vehicle.name, '你的车', s.rating, false)),
      h('p', { class: 'muted blurb' }, '委托只买图纸授权：车满足条件就能交付，车留在你手里。可以临时改装去满足条件，交付后再改回来——在车间用「蓝图库」存一份当前方案，改回来只要一键。有些委托还会付乌兹钢锭，那是把模块升到史诗级的途径之一。'),
      h('button', { class: 'btn go', onclick: () => SA.nav('garage') }, '去车间改装'),
    ];
  }

  return { open, render };
})();
