// 通用界面：弹窗 / 确认框 / 付款（含贷款询问）、顶栏导航、属性条、载具预览、银行、战后结算
window.SA = window.SA || {};

SA.h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
};

SA.UI = (() => {
  const h = SA.h, M = SA.MODULES, P = SA.PAL;
  const $ = (s) => document.querySelector(s);
  const S = () => SA.S.d;
  const money = (n) => `£${Math.round(n).toLocaleString()}`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- 弹窗 ----------
  let modalOnClose = null;
  function openModal(title, body, onClose) {
    const m = $('#modal');
    m.innerHTML = '';
    const close = h('button', { class: 'btn small', onclick: closeModal }, '关闭');
    m.append(h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, title), close),
      h('div', { class: 'panel-body' }, body)));
    m.hidden = false;
    modalOnClose = onClose || null;
  }
  function closeModal() {
    $('#modal').hidden = true;
    const f = modalOnClose; modalOnClose = null;
    if (f) f();
    refresh();
  }

  // 小确认框：actions = [{ label, primary, onClick }]，自动附带「取消」
  function dialog(title, body, actions = [], cancelLabel = '取消') {
    const m = $('#modal');
    m.innerHTML = '';
    const btns = actions.map(a => h('button', { class: `btn ${a.primary ? 'primary' : ''}`, onclick: () => { closeModal(); a.onClick(); } }, a.label));
    btns.push(h('button', { class: 'btn', onclick: closeModal }, actions.length ? cancelLabel : '知道了'));
    m.append(h('div', { class: 'panel dialog' },
      h('div', { class: 'panel-head' }, h('h2', {}, title)),
      h('div', { class: 'panel-body' }, body),
      h('div', { class: 'dialog-actions' }, btns)));
    m.hidden = false;
    modalOnClose = null;
    setTimeout(() => btns[0].focus(), 0);
  }

  // 付钱：钱够就（按需确认后）直接扣款；不够就问要不要向银行贷款补齐差额
  function pay({ title, amount, lines = [], okLabel = '确认', confirm = true, onPaid }) {
    const d = S();
    const done = () => { d.money -= amount; SA.S.save(); topbar(); onPaid(); };
    if (d.money >= amount) {
      if (!confirm) { done(); return; }
      dialog(title, [lines, h('p', {}, `花费 `, h('b', { class: 'gold' }, money(amount)), `，剩余 ${money(d.money - amount)}`)],
        [{ label: `${okLabel} ${money(amount)}`, primary: true, onClick: done }]);
      return;
    }
    const short = amount - d.money;
    const loan = Math.ceil(short / 100) * 100;
    const room = SA.S.loanRoom();
    if (loan > room) {
      dialog('资金不足', [lines, h('p', {}, `还差 ${money(short)}，银行也不肯再借了（额度剩 ${money(room)}，上限 ${money(SA.S.LOAN_CAP)}）。`),
        h('p', { class: 'muted' }, '先在车间把用不上的库存卖掉（选中模块 → 卖），或者打一场比赛再来。')]);
      return;
    }
    dialog('资金不足', [lines,
      h('p', {}, `现有 ${money(d.money)}，还差 `, h('b', { class: 'gold' }, money(short)), '。要向伦敦蒸汽银行贷款吗？'),
      h('p', { class: 'muted' }, `借 ${money(loan)}：债务 ${money(d.debt)} → ${money(d.debt + loan)}，每打一场锦标赛加收 10% 利息。`)],
    [{ label: `贷款 ${money(loan)} 并${okLabel}`, primary: true, onClick: () => { SA.S.borrow(loan); done(); } }]);
  }


  // ---------- 侧边栏：两块铆钉钢板导航（车间 / 出战）+ 资源 ----------
  // 徽标：车间 = 出战前必须处理的问题数；出战 = 可交付的委托 / 军方邀约
  // 函数名沿用 topbar()：各处改完数据都调用它刷新
  function topbar() {
    const d = S();
    const bar = $('#side');
    bar.innerHTML = '';
    const cur = SA.current;
    const s = SA.V.stats(d.vehicle);
    const fix = s.problems.length;
    const offer = SA.S.militaryOffer();
    const ready = SA.ORDERS.filter(o => d.orders.includes(o.id) && d.rep >= o.rep && !s.issues.length && o.req.every(([, f, n]) => f(s) >= n)).length;
    const plate = (key, icon, label, sub, badge, bad) => h('button', { class: `nav-plate ${cur === key ? 'on' : ''}`, 'aria-current': cur === key ? 'page' : null, onclick: () => SA.nav(key) },
      h('span', { class: 'rivets' }),
      SA.SPR.iconCanvas(icon, cur === key ? '#2a1a05' : '#d9a441', 4),
      h('span', { class: 'nm' }, label),
      h('span', { class: 'sub' }, sub),
      badge ? h('span', { class: `badge ${bad ? 'bad' : ''}` }, badge) : null);
    bar.append(
      h('div', { class: 'side-title' }, '蒸汽', h('br'), '竞技场'),
      h('nav', { class: 'side-nav' },
        plate('garage', 'wrench', '车间', '改装 · 商店 · 蓝图', fix ? `${fix} 项问题` : null, true),
        plate('arena', 'swords', '出战', `锦标赛第 ${d.round + 1} 轮`, offer ? '军方邀约' : ready ? `${ready} 份委托` : null)),
      h('div', { class: 'side-res' },
        h('button', { class: 'res money', title: '银行：借款 / 还款', onclick: openBank },
          h('span', { class: 'k' }, '资金'), h('b', {}, money(d.money)),
          d.debt ? h('span', { class: 'debt' }, `债 ${money(d.debt)}`) : null),
        h('span', { class: 'res' }, h('span', { class: 'k' }, '声望'), h('b', {}, '★'.repeat(Math.min(d.rep, 8)) || '—'), d.rep > 8 ? `×${d.rep}` : null),
        h('span', { class: 'res season' }, h('span', { class: 'k' }, '赛季'), h('b', {}, `${d.season} · ${d.round + 1}/6`))),
    );
  }

  // ---------- 属性条 ----------
  function statBars(s) {
    const pmax = Math.max(s.supply, s.demand, 1);
    const wmax = Math.max(s.load, s.weight, 1);
    const pct = (x, m) => `${Math.max(0, Math.min(100, (x / m) * 100))}%`;
    const oh = s.overheat === Infinity ? '不会烧干' : `全力开火 ${Math.round(s.overheat)} 秒后烧干`;
    const heatShare = Math.min(1, (s.heatGen + SA.K.IDLE_HEAT) / Math.max(0.1, SA.K.DISSIPATE + s.cool));
    return h('div', { class: 'bars' },
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '动力'),
        h('div', { class: 'bar power' }, h('i', { style: `width:${pct(s.demand, pmax)}` }),
          h('span', { class: 'mark', style: `left:${pct(s.supply, pmax)}`, title: '锅炉供给' }))),
      h('div', { class: 'bar-note' }, `需求 ${s.demand}（设备 ${s.equip} + 行驶 ${s.drive}）· 锅炉供给 ${s.supply}（白线）`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '重量'),
        h('div', { class: `bar weight ${s.weight > s.load ? 'over' : ''}` }, h('i', { style: `width:${pct(s.weight, wmax)}` }),
          h('span', { class: 'cap', style: `left:calc(${pct(s.load, wmax)} - 2px)`, title: '底盘承重' }))),
      h('div', { class: 'bar-note' }, `总重 ${SA.tons(s.weight)} · 底盘承重 ${SA.tons(s.load)}（红线）· 每吨要 ${SA.K.DRIVE_PER_T} 动力才能跑满速`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '热量'),
        h('div', { class: 'bar heat' }, h('i', { style: `width:${pct(heatShare, 1)}` }))),
      h('div', { class: 'bar-note' }, `产热 ${(s.heatGen + SA.K.IDLE_HEAT).toFixed(1)}/秒 · 散热 ${SA.K.DISSIPATE}+冷却 ≤${s.cool}/秒 · ${oh}`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '水'),
        h('div', { class: 'bar water' }, h('i', { style: `width:${pct(s.water, 250)}` }))),
      h('div', { class: 'bar-note' }, `${s.tanks} 只水箱 · 共 ${s.water} 单位`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '耐久'),
        h('div', { class: 'bar hp' }, h('i', { style: `width:${pct(s.hp, Math.max(s.maxHp, 1))}` }))),
      h('div', { class: 'bar-note' }, `${s.hp}/${s.maxHp} · 火力 ${s.dps.toFixed(1)}/秒 · 综合评分 ${s.rating}`),
      s.problems.map(p => h('div', { class: 'warn bad' }, p)),
      s.warnings.map(w => h('div', { class: 'warn' }, w)),
    );
  }

  function statLine(id) {
    const m = M[id];
    const parts = [`耐久 ${m.hp}`];
    if (m.power) parts.push(`动力 -${m.power}`);
    if (m.supply) parts.push(`动力 +${m.supply}`, `产热 ≤${m.heatRate}/秒`);
    if (m.load) parts.push(`承重 ${SA.tons(m.load)}`);
    parts.push(`重量 ${SA.tons(SA.weightOf({ id }))}`);
    if (m.dmg) parts.push(`伤害 ${m.dmg}`, `装填 ${m.reload}s`, m.indirect ? '高抛 · 指哪打哪' : `直射 · 散布 ±${m.spread}° · 仰角 ${m.elev[0]}~${m.elev[1]}°`, `热 +${m.heat}/发`);
    if (m.ram) parts.push(`撞击 ${m.ram}×速度`);
    if (m.punch) parts.push(`活塞 ${m.punch}/${m.punchCd}s`);
    if (m.water) parts.push(`冷却 ${m.cool}/秒`, `水 ${m.water}`);
    if (m.evade) parts.push(`闪避 +${Math.round(m.evade * 100)}%`);
    if (m.acc && !m.dmg) parts.push(`命中 +${Math.round(m.acc * 100)}%`);
    return parts.join(' · ');
  }

  function vehiclePreview(v, scale = 4) {
    const cv = h('canvas', { class: 'px' });
    // 裁到载具包围盒，让车在预览里尽量大
    const C = SA.K.CELL;
    let c0 = SA.K.COLS, c1 = -1, r0 = SA.K.ROWS;
    SA.V.each(v, (cell, r, c) => { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); });
    if (c1 < 0) { c0 = 0; c1 = SA.K.COLS - 1; r0 = 0; }
    r0 = Math.min(r0, SA.K.ROWS - 3);
    const sx = SA.SPR.PADX + c0 * C - 16, sy = Math.max(0, r0 * C - 12);
    const W = (c1 - c0 + 1) * C + 16 + 20, H = SA.K.ROWS * C - sy + 12;
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const draw = (t) => {
      g.fillStyle = P.bg[2];
      g.fillRect(0, 0, W, H);
      g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
      g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
      const st = SA.V.stats(v);
      g.drawImage(SA.SPR.renderVehicle(v, { key: 'preview', t, heat: 0.3, water: 1, showWrecks: true, showBlocked: true, blocked: st.blocked }), -sx, -sy);
    };
    draw(0);
    cv.style.maxWidth = `${W * scale}px`;
    cv._draw = draw;
    return cv;
  }


  // ---------- 银行（点顶栏资金打开）----------
  function openBank() {
    const d = S();
    const act = (label, ok, fn, primary) => h('button', { class: `btn ${primary ? 'primary' : ''}`, disabled: !ok, onclick: () => { fn(); SA.S.save(); topbar(); openBank(); } }, label);
    openModal('伦敦蒸汽银行', [
      h('p', { class: 'muted', style: 'margin-top:0' }, `每打一场锦标赛，未还清的债务加收 10% 利息。借款上限 ${money(SA.S.LOAN_CAP)}。在车间买东西钱不够时，也会主动问你要不要借。`),
      h('div', { class: 'bank' },
        h('div', {}, h('span', { class: 'k' }, '资金'), h('b', { class: 'gold' }, money(d.money))),
        h('div', {}, h('span', { class: 'k' }, '债务'), h('b', { style: 'color:var(--fire2)' }, money(d.debt)))),
      h('div', { class: 'dialog-actions', style: 'padding:12px 0 0;justify-content:flex-start' },
        act('借 £300', SA.S.loanRoom() >= 300, () => SA.S.borrow(300), true),
        act('还 £100', d.debt && d.money >= Math.min(100, d.debt), () => { const x = Math.min(100, d.debt); d.debt -= x; d.money -= x; }),
        act('全部还清', d.debt && d.money >= d.debt, () => { d.money -= d.debt; d.debt = 0; })),
    ]);
    $('#modal > .panel').classList.add('dialog');
  }

  // 关掉弹窗后刷新当前页面
  function refresh() {
    SA.S.save();
    topbar();
    if (SA.current === 'arena' && SA.Arena) SA.Arena.render();
    if (SA.current === 'garage' && SA.Editor) SA.Editor.refresh();
  }

  // ---------- 战后结算 ----------
  const drawFee = (prize) => Math.max(5, Math.round(prize * 0.1 / 5) * 5);   // 平手：各拿奖金的一成
  function afterBattle(res) {
    const d = S();
    const lines = [];
    if (res.mode === 'tournament' || res.mode === 'street') {
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
        lines.push(`平手：双方各拿出场费 ${money(fee)}`);
        d.news = `「${d.vehicle.name}」在${tier.name}和「${res.enemyName}」打成平手。`;
      } else if (res.win) {
        d.money += res.prize; d.wins++;
        lines.push(`奖金 +${money(res.prize)}`);
        d.news = `「${d.vehicle.name}」在${tier.name}赢了「${res.enemyName}」，进账 ${money(res.prize)}。`;
      } else {
        d.losses++;
        d.news = `「${d.vehicle.name}」在${tier.name}输给了「${res.enemyName}」。`;
      }
      lines.push('街头赛不计声望，也不影响锦标赛进度。');
      SA.Street.consume(res.opts.streetTier);
    } else if (res.mode === 'tournament') {
      if (d.debt) { const add = Math.ceil(d.debt * 0.1); d.debt += add; lines.push(`银行利息 +${money(add)}`); }
      if (res.draw) {
        const fee = drawFee(res.prize);
        d.money += fee;
        lines.push(`平手：双方各拿出场费 ${money(fee)}，这一轮要重赛`);
        if (d.bet) { d.money += d.bet.amount; lines.push(`平局退还赌注 ${money(d.bet.amount)}`); }
        d.news = `「${d.vehicle.name}」和「${res.enemyName}」打成平手，第 ${d.round + 1} 轮择日重赛。`;
      } else if (res.win) {
        d.money += res.prize; d.wins++;
        const rep = res.flawless ? 2 : 1;
        d.rep += rep;
        lines.push(`奖金 +${money(res.prize)}`, `声望 +${rep}${res.flawless ? '（驾驶舱毫发无损）' : ''}`);
        if (d.bet) { const pay = Math.round(d.bet.amount * d.bet.odds); d.money += pay; lines.push(`赌注兑现 +${money(pay)}`); }
        d.round++;
        if (d.round >= SA.OPPONENTS.length) {
          d.champion++; d.season++; d.round = 0;
          lines.push(`🏆 你赢得了第 ${d.season - 1} 赛季冠军！新赛季的对手会更强。`);
          d.news = `「${d.vehicle.name}」夺得伦敦蒸汽大奖赛冠军！`;
        } else {
          d.news = `「${d.vehicle.name}」击败了「${res.enemyName}」，晋级第 ${d.round + 1} 轮。`;
        }
      } else {
        d.losses++;
        if (d.bet) lines.push(`赌注 ${money(d.bet.amount)} 输光了`);
        d.news = `「${d.vehicle.name}」败给了「${res.enemyName}」。修好车再来。`;
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
      if (SA.S.militaryOffer()) lines.push('📜 陆军部发来了原型机收购邀请，去「出战 · 委托」查看。');
      const st = SA.V.stats(d.vehicle);
    } else {
      lines.push('友谊赛：不结算奖金，也不留下损伤。');
    }
    SA.S.save();
    SA.nav('arena');
    // 受损就直接给出修理入口，不让玩家自己找
    const hurt = [];
    SA.V.each(d.vehicle, (cell) => { if (cell.hp < SA.V.maxHp(cell)) hurt.push(cell); });
    const cost = hurt.reduce((a, c) => a + SA.S.repairCost(c), 0);
    const fixAll = () => { for (const c of hurt) c.hp = SA.V.maxHp(c); toast(`修好 ${hurt.length} 个模块，花费 ${money(cost)}`); };
    dialog(res.draw ? '平手' : res.win ? '胜利！' : '战败', [
      h('p', { style: 'font-size:16px;margin-top:0' }, h('b', {}, res.reason)),
      h('p', { class: 'muted' }, `造成伤害 ${Math.round(res.dealt)} · 承受伤害 ${Math.round(res.taken)} · 用时 ${Math.round(res.time)} 秒`),
      lines.map(l => h('div', { class: 'warn', style: 'border-left-color:var(--brass2)' }, l)),
      hurt.length ? h('div', { class: 'warn' }, `${hurt.length} 个模块受损，全部修好 ${money(cost)}`) : null,
    ], hurt.length ? [
      { label: `全部修理 ${money(cost)}`, primary: true, onClick: () => pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false, onPaid: () => { fixAll(); refresh(); } }) },
      { label: '去车间', onClick: () => SA.nav('garage') },
    ] : [], hurt.length ? '稍后再说' : '继续');
  }

  return { toast, openModal, closeModal, dialog, pay, topbar, refresh, openBank, statBars, statLine, vehiclePreview, afterBattle, money };
})();
