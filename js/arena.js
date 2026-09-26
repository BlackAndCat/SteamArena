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
  // openCh：战役列表展开了哪几章（默认只展开当前这一章和选中的那一场所在的章）
  const st = { mode: 'camp', pick: { camp: null, tour: null, street: null, friendly: null }, bet: null, openCh: null };
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
    const sides = modes().some(([k]) => k === 'side') ? SA.Camp.sideEntries() : [];
    const sideNew = sides.filter(x => !x.won).length;
    const ms = modes();
    const tabs = ms.length > 1 ? h('div', { class: 'ar-tabs' }, ms.map(([k, n]) => h('button', { class: `tab ${st.mode === k ? 'on' : ''}`, onclick: () => { st.mode = k; render(); } },
      n, k === 'tour' ? h('span', { class: 'cnt' }, `第 ${D.round + 1} 轮`) : null,
      k === 'orders' && ordersReady ? h('span', { class: 'badge' }, ordersReady) : null,
      k === 'side' && sideNew ? h('span', { class: 'badge side' }, sideNew) : null))) : null;
    const ch = SA.CAMPAIGN[SA.Camp.chIndex()];
    const campHead = st.mode === 'camp' ? h('div', { class: 'ar-chapter' }, h('b', {}, ch.name), h('span', { class: 'muted' }, SA.Camp.done() ? '战役已通关 · 终局锦标赛已开放' : ch.blurb)) : null;

    const row = (e) => h('button', { class: `ar-row ${cur && cur.key === e.key ? 'on' : ''} ${e.lock ? 'locked' : ''} ${e.replay ? 'replay' : ''}`, onclick: () => { st.pick[st.mode] = e.key; render(); } },
      h('span', { class: `chip ${e.tag[0]}` }, e.replay ? '↺ 可重打' : e.tag[1]),
      h('span', { class: 'grow' }, h('b', {}, st.mode === 'camp' ? e.title.replace(/^第 \d+ 章 · /, '') : e.title), h('span', { class: 'muted' }, ` · ${e.pilot}`)),
      rewardsOf(e).filter(x => !x.claimed).length ? h('span', { class: 'chip uniq', title: '赢了可以缴获唯一件' }, '★') : null,
      h('span', { class: 'chip' }, `评分 ${e.rating}`),
      e.prize ? h('span', { class: 'chip gold' }, money(e.prize)) : null);
    const body = st.mode === 'orders' ? ordersList(s) : st.mode === 'camp' ? campList(list, cur, row) : h('div', { class: 'ar-rows' }, list.map(row));

    const foot = st.mode === 'street' ? h('button', { class: 'btn small', onclick: () => { SA.Street.offers(true); render(); } }, '换一批对手')
      : st.mode === 'tour' ? h('span', { class: 'muted' }, `第 ${D.season} 赛季 · 伦敦蒸汽大奖赛：连胜六轮夺冠，奖励以太结晶。本赛季对手是「${SA.MATS[Math.min(SA.MAT_MAX, 3 + D.season)].name}」打造。点其他轮次可以侦察。`)
        : st.mode === 'camp' ? h('span', { class: 'muted' }, `第 ${SA.Camp.chIndex() + 1}/${SA.CAMPAIGN.length} 章。已击败的主线可以重打（↺），不发奖励也不留下战损；点章节名展开 / 收起。`)
          : st.mode === 'side' ? h('span', { class: 'muted' }, '竞技场外的可选遭遇：没有观众、没有奖金和声望，第一次打赢可以缴获车上的特殊件。打赢过的可以重打。') : null;

    root.append(
      D.news ? h('div', { class: 'panel ar-news' }, h('b', {}, '号外'), D.news) : '',
      h('div', { class: 'ar-grid' },
        h('section', { class: 'panel ar-list' }, tabs, campHead, body, foot ? h('div', { class: 'ar-foot' }, foot) : null),
        h('section', { class: 'panel ar-match' }, st.mode === 'orders' ? ordersSide(s) : matchPanel(cur, s))));
  }

  // ---------- 战役列表按章分组（W4）：当前章展开，其余折叠；折叠条上显示这一章打到了哪 ----------
  function campList(list, cur, row) {
    const byCh = new Map();
    for (const e of list) { const ci = +String(e.key).split(',')[0]; if (!byCh.has(ci)) byCh.set(ci, []); byCh.get(ci).push(e); }
    if (!st.openCh || st.openFor !== SA.Camp.chIndex()) { st.openCh = new Set([SA.Camp.chIndex()]); st.openFor = SA.Camp.chIndex(); }   // 推进到新章节时重新只展开当前章
    if (cur) st.openCh.add(+String(cur.key).split(',')[0]);
    const out = [];
    for (const [ci, rows] of byCh) {
      const ch = SA.CAMPAIGN[ci], beaten = rows.filter(e => e.replay).length, open = st.openCh.has(ci);
      const state = beaten === rows.length ? ['ok', '已通关'] : rows.some(e => e.next) ? ['next', '进行中'] : ['no', '未开放'];
      out.push(h('button', { class: `ar-ch ${open ? 'open' : ''} ${state[0]}`, 'aria-expanded': String(open), onclick: () => { if (open) st.openCh.delete(ci); else st.openCh.add(ci); render(); } },
        h('span', { class: 'fold' }, open ? '▾' : '▸'), h('b', {}, ch.name), h('span', { class: `chip ${state[0]}` }, state[1]),
        h('span', { class: 'muted' }, `${beaten}/${rows.length}`)));
      if (open) out.push(...rows.map(row));
    }
    return h('div', { class: 'ar-rows' }, out);
  }

  // 这一场赢了能拿到的唯一件：主线看关卡的 uniqueLoot，支线看遭遇战的 reward；claimed = 这个存档已经拿过
  function rewardsOf(e) {
    if (!e) return [];
    let raw = [];
    if (st.mode === 'camp') { const [ci, si] = String(e.key).split(',').map(Number); raw = (SA.CAMPAIGN[ci] && SA.CAMPAIGN[ci].stages[si].uniqueLoot) || []; }
    else if (st.mode === 'side') { const x = SA.Camp.sideEntries().find(y => y.id === e.key); raw = x && x.reward ? [x.reward] : []; }
    return raw.map(r => ({ id: r.id, mt: r.mt || 1, claimed: SA.S.hasUnique(r.id) }));
  }
  function rewardBox(e) {
    const rs = rewardsOf(e);
    if (!rs.length) return null;
    return h('div', { class: 'ar-reward' }, h('b', {}, st.mode === 'side' ? '遭遇战奖励' : '对手身上的唯一件'),
      rs.map(r => h('div', { class: `dlg-item ${r.claimed ? 'claimed' : 'uniq-card'}` }, SA.SPR.moduleCanvas(r.id, 0.75, r.mt),
        h('div', {}, SA.UI.uniqueBadge(r.id), ' ', h('b', {}, `${r.mt > 1 ? SA.MATS[r.mt].name : ''}${M[r.id].name}`),
          h('div', { class: 'muted' }, r.claimed ? '已经拿到了' : e.replay ? '重打不掉落' : '第一次打赢后，在缴获里挑它')))));
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

  const sideOf = (e) => SA.Camp.sideEntries().find(x => x.id === e.key);
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
      e.replay ? h('div', { class: 'ar-note replay' }, h('b', {}, '↺ 重打'), '不发奖金、不计声望、不留战损，也不会再掉落战利品。只为再赢一次。') : null,
      st.mode === 'side' ? h('div', { class: 'ar-note side' }, h('b', {}, '竞技场外'), '没有观众、没有奖金和声望。',
        h('span', { class: 'chip' }, sideOf(e) && sideOf(e).settleDamage === false ? '不留战损' : '战损照常带回车间')) : null,
      h('p', { class: 'muted blurb' }, e.blurb),
      rewardBox(e),
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
