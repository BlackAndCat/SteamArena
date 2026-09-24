// 工坊中枢与各功能面板
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

  // ---------- 顶栏 ----------
  function topbar() {
    const d = S();
    const bar = $('#topbar');
    bar.innerHTML = '';
    const items = [
      h('span', { class: 'title' }, '蒸汽竞技场'),
      h('span', { class: 'res money' }, h('span', { class: 'k' }, '资金'), h('b', {}, money(d.money))),
      d.debt ? h('span', { class: 'res debt' }, h('span', { class: 'k' }, '债务'), h('b', {}, money(d.debt))) : null,
      h('span', { class: 'res' }, h('span', { class: 'k' }, '声望'), h('b', {}, '★'.repeat(Math.min(d.rep, 8)) || '—'), d.rep > 8 ? `×${d.rep}` : null),
      h('span', { class: 'res' }, h('span', { class: 'k' }, '赛季'), h('b', {}, `${d.season} · 第 ${d.round + 1}/6 轮`)),
    ];
    bar.append(...items.filter(Boolean));
  }

  // ---------- 属性条 ----------
  function statBars(s) {
    const pmax = Math.max(s.cap, s.supply, s.demand, 1);
    const pct = (x, m) => `${Math.max(0, Math.min(100, (x / m) * 100))}%`;
    const oh = s.overheat === Infinity ? '不会烧干' : `全力开火 ${Math.round(s.overheat)} 秒后烧干`;
    const heatShare = Math.min(1, s.heatGen / Math.max(0.1, SA.K.DISSIPATE + s.cool));
    return h('div', { class: 'bars' },
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '动力'),
        h('div', { class: 'bar power' }, h('i', { style: `width:${pct(s.demand, pmax)}` }),
          h('span', { class: 'mark', style: `left:${pct(s.supply, pmax)}`, title: '锅炉供给' }),
          h('span', { class: 'cap', style: `left:calc(${pct(s.cap, pmax)} - 2px)`, title: '底盘承载上限' }))),
      h('div', { class: 'bar-note' }, `需求 ${s.demand} · 锅炉供给 ${s.supply}（白线）· 底盘上限 ${s.cap}（红线）`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '热量'),
        h('div', { class: 'bar heat' }, h('i', { style: `width:${pct(heatShare, 1)}` }))),
      h('div', { class: 'bar-note' }, `产热 ${s.heatGen.toFixed(1)}/秒 · 散热 ${SA.K.DISSIPATE}+冷却 ${s.cool}/秒 · ${oh}`),
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
    if (m.cap) parts.push(`承载 ${m.cap}`);
    if (m.dmg) parts.push(`伤害 ${m.dmg}`, `装填 ${m.reload}s`, m.indirect ? '高抛 · 指哪打哪' : `直射 · 散布 ±${m.spread}° · 仰角 ${m.elev[0]}~${m.elev[1]}°`, `热 +${m.heat}/发`);
    if (m.ram) parts.push(`撞击 ${m.ram}×速度`);
    if (m.punch) parts.push(`活塞 ${m.punch}/${m.punchCd}s`);
    if (m.water) parts.push(`冷却 ${m.cool}/秒`, `水 ${m.water}`);
    if (m.evade) parts.push(`闪避 +${Math.round(m.evade * 100)}%`);
    if (m.acc && !m.dmg) parts.push(`命中 +${Math.round(m.acc * 100)}%`);
    return parts.join(' · ');
  }

  function vehiclePreview(v, scale = 4, view = 'pixel') {
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
      g.fillStyle = view === 'blueprint' ? '#10335c' : P.bg[2];
      g.fillRect(0, 0, W, H);
      if (view !== 'blueprint') {
        g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
        g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
      }
      const st = SA.V.stats(v);
      g.drawImage(SA.SPR.renderVehicle(v, { key: 'preview', t, view, heat: 0.3, water: 1, showWrecks: true, showBlocked: true, blocked: st.blocked }), -sx, -sy);
    };
    draw(0);
    cv.style.maxWidth = `${W * scale}px`;
    cv._draw = draw;
    return cv;
  }

  // ---------- 工坊 ----------
  let benchCanvas = null;
  function workshop() {
    const d = S();
    const s = SA.V.stats(d.vehicle);
    const screen = $('#screen');
    screen.innerHTML = '';
    benchCanvas = vehiclePreview(d.vehicle, 3);

    const damaged = s.damaged + s.broken;
    const orderReady = SA.ORDERS.filter(o => d.orders.includes(o.id) && d.rep >= o.rep && o.req.every(([, f, n]) => f(s) >= n)).length;
    const offer = SA.S.militaryOffer();
    const op = SA.S.opponent();

    const btn = (icon, label, sub, onclick, extra = {}) => h('button', { class: `btn hub-btn ${extra.cls || ''}`, onclick },
      SA.SPR.iconCanvas(icon, extra.cls && extra.cls.includes('primary') ? '#2a1a05' : P.brass3, 4),
      h('span', {}, h('span', { class: 'lbl' }, label), h('span', { class: 'sub' }, sub)),
      extra.badge ? h('span', { class: 'badge' }, extra.badge) : null);

    screen.append(h('div', { class: 'ws' },
      h('section', { class: 'panel bench' },
        h('h2', {}, d.vehicle.name),
        benchCanvas,
        statBars(s)),
      h('section', { class: 'hub' },
        btn('coin', '商店 / 借贷', '买卖模块，向银行借钱', () => openShop()),
        btn('wrench', '修理', damaged ? `${damaged} 个模块受损` : '车况良好', () => openRepair(), { badge: damaged ? `${damaged}` : null }),
        btn('gear', '改装', '在格子上叠放模块', () => SA.Editor.open()),
        btn('scroll', '订单', offer ? '陆军部发来收购邀请！' : `${d.orders.length} 份委托`, () => openOrders(), { badge: offer ? '军方' : orderReady ? `${orderReady}` : null }),
        btn('trophy', '赛事', `下一场：${op.name}`, () => openTournament()),
        btn('dice', '下注', d.bet ? `已押 ${money(d.bet.amount)} @ ${d.bet.odds}` : `赔率 ${SA.S.odds()}`, () => openBet()),
        btn('cloud', '云车库', '分享载具 · 挑战其他玩家', () => openCloud()),
        btn('eye', '图例', '看懂模块的颜色与铭牌', () => openLegend()),
        btn('swords', '出战', `第 ${d.round + 1} 轮 · 对手「${op.name}」· 奖金 ${money(op.prize)}`, () => deploy(), { cls: 'primary fight' }),
      ),
      h('section', { class: 'panel news' }, h('b', {}, '号外'), d.news),
    ));
  }

  function refresh() {
    SA.S.save();
    topbar();
    if (SA.current === 'workshop') workshop();
  }

  // ---------- 商店 / 借贷 ----------
  function openShop(tab = 'buy') {
    const d = S();
    const tabs = h('div', { class: 'tabs' },
      [['buy', '购买模块'], ['sell', '出售库存'], ['loan', '银行借贷']].map(([k, n]) =>
        h('button', { class: `btn small ${tab === k ? 'on' : ''}`, onclick: () => openShop(k) }, n)));
    let body;
    if (tab === 'buy') {
      body = h('div', { class: 'cards' }, SA.MODULE_ORDER.map(id => {
        const m = M[id];
        return h('div', { class: `panel card cat-${m.cat}` },
          h('div', { class: 'top' }, SA.SPR.moduleCanvas(id, 2), h('div', {}, h('div', { class: 'nm' }, m.name), h('div', { class: 'cat' }, `${SA.CAT[m.cat].name} · `, h('span', { class: `q q${m.q}` }, `${SA.QUALITY[m.q].star} ${SA.QUALITY[m.q].name}`), ` · 库存 ${d.inv[id] || 0}`))),
          h('div', { class: 'st' }, statLine(id)),
          h('div', { class: 'st' }, m.desc),
          h('div', { class: 'ft' }, h('span', { class: 'price' }, money(m.price)),
            h('button', { class: 'btn small primary', disabled: d.money < m.price, onclick: () => {
              d.money -= m.price; SA.S.addInv(id); toast(`购入 ${m.name}`); SA.S.save(); topbar(); openShop('buy');
            } }, '购买')));
      }));
    } else if (tab === 'sell') {
      const ids = Object.keys(d.inv).filter(id => d.inv[id] > 0);
      body = ids.length ? h('div', { class: 'list' }, ids.map(id => h('div', { class: `panel row card cat-${M[id].cat}` },
        SA.SPR.moduleCanvas(id, 1), h('span', { class: 'grow' }, `${M[id].name} ×${d.inv[id]}`),
        h('button', { class: 'btn small', onclick: () => {
          d.money += Math.round(M[id].price * 0.5); SA.S.addInv(id, -1); SA.S.save(); topbar(); openShop('sell');
        } }, `出售 ${money(M[id].price * 0.5)}`)))) : h('p', { class: 'muted' }, '库存是空的。装在车上的模块要先在「改装」里拆下来。');
    } else {
      const cap = 1500;
      body = h('div', { class: 'list' },
        h('div', { class: 'panel row' }, h('span', { class: 'grow' }, '伦敦蒸汽银行：每打一场比赛，未还清的债务加收 10% 利息。上限 ', money(cap), '。'),
          h('b', {}, `当前债务 ${money(d.debt)}`)),
        h('div', { class: 'panel row' },
          h('button', { class: 'btn primary', disabled: d.debt + 300 > cap, onclick: () => { d.debt += 300; d.money += 300; SA.S.save(); topbar(); openShop('loan'); } }, '借 £300'),
          h('button', { class: 'btn', disabled: !d.debt || d.money < Math.min(100, d.debt), onclick: () => { const x = Math.min(100, d.debt); d.debt -= x; d.money -= x; SA.S.save(); topbar(); openShop('loan'); } }, '还 £100'),
          h('button', { class: 'btn', disabled: !d.debt || d.money < d.debt, onclick: () => { d.money -= d.debt; d.debt = 0; SA.S.save(); topbar(); openShop('loan'); } }, '全部还清')));
    }
    openModal('商店 / 借贷', [tabs, body]);
  }

  // ---------- 修理 ----------
  function openRepair() {
    const d = S();
    const items = [];
    SA.V.each(d.vehicle, (cell, r, c, layer) => {
      const max = SA.V.maxHp(cell);
      if (cell.hp < max) items.push({ cell, r, c, layer, cost: SA.S.repairCost(cell) });
    });
    const total = items.reduce((a, b) => a + b.cost, 0);
    const fix = (list) => {
      for (const it of list) { d.money -= it.cost; it.cell.hp = SA.V.maxHp(it.cell); }
      SA.S.save(); topbar(); openRepair();
    };
    const body = items.length ? [
      h('div', { class: 'panel row' }, h('span', { class: 'grow' }, `共 ${items.length} 个模块需要修理。损毁的模块修理费是原价的 60%。`),
        h('button', { class: 'btn primary', disabled: d.money < total, onclick: () => fix(items) }, `全部修理 ${money(total)}`)),
      h('div', { class: 'list' }, items.map(it => {
        const m = M[it.cell.id];
        const frac = it.cell.hp / SA.V.maxHp(it.cell);
        return h('div', { class: `panel row card cat-${m.cat}` },
          SA.SPR.moduleCanvas(it.cell.id, 0.75),
          h('span', { class: 'grow' }, h('b', {}, m.name), ` · 第 ${SA.K.ROWS - it.r} 层 第 ${it.c + 1} 列${it.layer === 'side' ? '（侧挂层）' : ''}`),
          h('div', { class: 'bar hp', style: 'width:120px' }, h('i', { style: `width:${frac * 100}%` })),
          h('span', { class: 'chip' }, it.cell.hp <= 0 ? '已损毁' : `${it.cell.hp}/${SA.V.maxHp(it.cell)}`),
          h('button', { class: 'btn small', disabled: d.money < it.cost, onclick: () => fix([it]) }, `修理 ${money(it.cost)}`));
      }))] : h('p', { class: 'muted' }, '所有模块完好无损。');
    openModal('修理', body);
  }

  // ---------- 订单 ----------
  function openOrders() {
    const d = S();
    const s = SA.V.stats(d.vehicle);
    const offer = SA.S.militaryOffer();
    const parts = [];
    if (offer) {
      parts.push(h('div', { class: 'panel big-offer' },
        h('b', {}, '陆军部 · 原型机收购邀请'),
        h('span', { class: 'muted' }, '你在竞技场的表现引起了军方的注意。出售后当前原型机交给陆军部，工坊会拿到一台新的基础底盘重新起步（库存保留）。'),
        h('span', { class: 'amt' }, money(offer)),
        h('div', { class: 'ft', style: 'display:flex;gap:8px' },
          h('button', { class: 'btn primary', onclick: () => {
            d.money += offer; d.rep = Math.max(0, d.rep - 3);
            d.sold = (d.sold || 0) + 1;
            d.vehicle = SA.V.fromAscii(`${d.sold + 1} 号原型机`, SA.STARTER);
            d.news = `原型机以 ${money(offer)} 售予陆军部。工坊的新底盘已就位。`;
            closeModal();
          } }, '出售原型机'),
          h('button', { class: 'btn', onclick: () => { toast('你决定继续改进原型机'); closeModal(); } }, '继续改进'))));
    } else {
      parts.push(h('p', { class: 'muted' }, `军方订单：声望达到 ★4 后，陆军部会发来原型机收购邀请（当前 ★${d.rep}）。`));
    }
    parts.push(h('div', { class: 'list' }, d.orders.map(oid => {
      const o = SA.ORDERS.find(x => x.id === oid);
      const locked = d.rep < o.rep;
      const ok = !locked && o.req.every(([, f, n]) => f(s) >= n);
      return h('div', { class: 'panel row' },
        h('div', { class: 'grow' },
          h('div', {}, h('b', {}, o.who), ' ', locked ? h('span', { class: 'chip no' }, `需要声望 ★${o.rep}`) : null),
          h('div', { class: 'muted', style: 'font-size:12px;margin:4px 0' }, o.text),
          o.req.map(([label, f, n]) => {
            const cur = f(s);
            const isFlag = n === 1 && (cur === 0 || cur === 1) && !/底盘|水箱|装甲/.test(label);
            return h('div', { class: `req ${cur >= n ? 'ok' : 'no'}` }, isFlag ? label : `${label} ${cur}/${n}`);
          })),
        h('span', { class: 'price', style: 'color:var(--brass3);font-weight:700' }, money(o.reward)),
        h('button', { class: 'btn small primary', disabled: !ok, onclick: () => {
          d.money += o.reward; d.rep += 1;
          d.orders = d.orders.filter(x => x !== oid); d.ordersDone.push(oid);
          d.news = `${o.who}买下了你的图纸授权，付款 ${money(o.reward)}。`;
          toast(`订单完成 +${money(o.reward)}，声望 +1`);
          SA.S.save(); topbar(); openOrders();
        } }, '交付图纸'));
    })));
    if (!d.orders.length) parts.push(h('p', { class: 'muted' }, '暂时没有新委托，打完下一场比赛再来看看。'));
    parts.push(h('p', { class: 'muted', style: 'font-size:12px' }, '民间订单只买图纸授权：满足条件时交付，载具保留在你手里。可以临时改装去满足条件，交付后再改回来。'));
    openModal('订单', parts);
  }

  // ---------- 赛事 ----------
  function openTournament(scoutIdx) {
    const d = S();
    const rows = SA.OPPONENTS.map((o, i) => {
      const op = SA.S.opponent(i);
      const st = SA.V.stats(SA.V.battleCopy(op.vehicle, op.hpMul, true));
      const status = i < d.round ? ['ok', '已击败'] : i === d.round ? ['next', '下一场'] : ['no', '未解锁'];
      return h('div', { class: 'panel row' },
        h('span', { class: `chip ${status[0]}` }, status[1]),
        h('span', { class: 'grow' }, h('b', {}, `第 ${i + 1} 轮 · ${o.name}`), h('span', { class: 'muted' }, `  驾驶员：${o.pilot}`)),
        h('span', { class: 'chip' }, `评分 ${st.rating}`),
        h('span', { class: 'chip' }, `奖金 ${money(op.prize)}`),
        h('button', { class: 'btn small', disabled: i > d.round, onclick: () => openTournament(i) }, '侦察'));
    });
    const parts = [h('p', { class: 'muted' }, `第 ${d.season} 赛季 · 伦敦蒸汽大奖赛。连胜六轮即可夺冠${d.season > 1 ? `；本赛季对手耐久 +${(d.season - 1) * 25}%` : ''}。`), h('div', { class: 'list' }, rows)];
    if (scoutIdx != null) {
      const op = SA.S.opponent(scoutIdx);
      const bv = SA.V.battleCopy(op.vehicle, op.hpMul, true);
      const st = SA.V.stats(bv);
      const holder = h('div', {}, vehiclePreview(bv, 2));
      const show = (view) => { holder.innerHTML = ''; holder.append(vehiclePreview(bv, 2, view)); };
      parts.unshift(h('div', { class: 'panel scout', style: 'padding:12px;margin-bottom:12px' },
        h('div', {}, holder, h('div', { class: 'seg', style: 'margin-top:8px' },
          h('button', { class: 'btn small', onclick: () => show('pixel') }, '像素'),
          h('button', { class: 'btn small', onclick: () => show('blueprint') }, '蓝图'))),
        h('div', { class: 'bars' }, h('b', {}, op.name), h('span', { class: 'muted', style: 'font-size:12px' }, op.blurb),
          h('span', { style: 'font-size:12px' }, `耐久 ${st.hp} · 火力 ${st.dps.toFixed(1)}/秒 · 侧炮 ${st.byId.side_cannon || 0} · 锅炉 ${st.boilers} · 水箱 ${st.tanks}`),
          h('span', { style: 'font-size:12px' }, `闪避 ${Math.round(st.evade * 100)}% · 烧干时间 ${st.overheat === Infinity ? '∞' : Math.round(st.overheat) + ' 秒'}`))));
    }
    openModal('赛事', parts);
  }

  // ---------- 下注 ----------
  function openBet() {
    const d = S();
    const op = SA.S.opponent();
    const odds = SA.S.odds();
    const parts = [h('p', {}, `下一场：你的「${d.vehicle.name}」对阵「${op.name}」。只能押自己赢，赔率由双方评分决定。`)];
    if (d.bet) {
      parts.push(h('div', { class: 'panel row' }, h('span', { class: 'grow' }, `已下注 ${money(d.bet.amount)}，赔率 ${d.bet.odds}，赢了拿回 ${money(d.bet.amount * d.bet.odds)}`),
        h('button', { class: 'btn small', onclick: () => { d.money += d.bet.amount; d.bet = null; SA.S.save(); topbar(); openBet(); } }, '撤回')));
    } else {
      const max = Math.max(0, Math.floor(d.money / 10) * 10);
      const out = h('b', {}, money(0));
      const range = h('input', { type: 'range', min: 0, max, step: 10, value: Math.min(100, max),
        oninput: () => { out.textContent = `${money(+range.value)} → 赢回 ${money(+range.value * odds)}`; } });
      range.dispatchEvent(new Event('input'));
      parts.push(h('div', { class: 'panel', style: 'padding:12px;display:grid;gap:10px' },
        h('div', {}, '赔率 ', h('b', { style: 'color:var(--brass3);font-size:20px' }, `× ${odds}`)),
        range, out,
        h('button', { class: 'btn primary', disabled: !max, onclick: () => {
          const amt = +range.value; if (!amt) return;
          d.money -= amt; d.bet = { amount: amt, odds }; SA.S.save(); topbar(); toast(`押注 ${money(amt)}`); openBet();
        } }, '下注')));
    }
    openModal('下注', parts);
  }

  // ---------- 云车库 ----------
  function openCloud() {
    const d = S();
    const nameIn = h('input', { type: 'text', value: d.vehicle.name, maxLength: 20 });
    const codeOut = h('div', { class: 'code muted' });
    const codeIn = h('textarea', { rows: 2, placeholder: '粘贴 SA1. 开头的分享码' });
    const challenge = (v) => {
      const st = SA.V.stats(d.vehicle);
      if (!st.canDeploy) { toast('你的载具还不能出战：' + st.problems[0]); return; }
      closeModal();
      SA.Battle.start({ mode: 'friendly', enemyVehicle: v, enemyName: v.name, aim: 0.9, hpMul: 1 });
    };
    const list = SA.S.Cloud.list().map(e => {
      const v = SA.V.decode(e.code);
      if (!v) return null;
      const st = SA.V.stats(v);
      const pv = vehiclePreview(v, 1);
      return h('div', { class: 'panel card' },
        pv,
        h('div', {}, h('b', {}, e.name), h('span', { class: 'muted' }, ` · ${e.author}`)),
        h('div', { class: 'st' }, `评分 ${st.rating} · 耐久 ${st.hp} · 火力 ${st.dps.toFixed(1)}/秒`),
        h('div', { class: 'ft' },
          h('button', { class: 'btn small primary', onclick: () => challenge(v) }, '挑战'),
          h('button', { class: 'btn small', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(e.code); toast('分享码已复制'); } }, '复制码')));
    });
    openModal('云车库', [
      h('p', { class: 'muted', style: 'font-size:12px' }, '原型阶段：云端用本地存储模拟，分享码可以跨设备粘贴导入。友谊赛不结算奖金，也不造成损伤。'),
      h('div', { class: 'panel', style: 'padding:12px;display:grid;gap:8px;margin-bottom:12px' },
        h('b', {}, '上传当前载具'),
        h('div', { style: 'display:flex;gap:8px' }, nameIn, h('button', { class: 'btn primary', onclick: () => {
          const e = SA.S.Cloud.upload(nameIn.value.trim() || d.vehicle.name, d.vehicle);
          codeOut.textContent = e.code; toast('已上传'); navigator.clipboard && navigator.clipboard.writeText(e.code);
        } }, '上传')), codeOut,
        h('b', {}, '导入分享码'),
        h('div', { style: 'display:flex;gap:8px' }, codeIn, h('button', { class: 'btn', onclick: () => {
          const v = SA.V.decode(codeIn.value);
          if (!v) { toast('分享码无效'); return; }
          challenge(v);
        } }, '挑战'))),
      h('div', { class: 'cards' }, list),
    ]);
  }

  // ---------- 图例 ----------
  function openLegend() {
    const cats = Object.entries(SA.CAT).map(([k, c]) => h('div', { class: `panel card cat-${k}` },
      h('div', { class: 'top' }, h('i', { style: `width:18px;height:18px;background:${c.plate};border:2px solid #0b0e15;display:inline-block` }), h('b', {}, c.name)),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, SA.MODULE_ORDER.filter(id => M[id].cat === k).map(id =>
        h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px' }, SA.SPR.moduleCanvas(id, 1), M[id].name)))));
    openModal('图例：一眼认出模块', [
      h('p', { class: 'muted' }, '每个模块靠自身造型辨认：驾驶舱是黄铜拱门里戴护目镜的小驾驶员；水箱是看得见水位的方块；锅炉是铁栅栏后闷燃的煤；直射炮管水平伸出，高抛炮口朝天；撞击武器是锈钢色，装在车头最前端。只有炉火会发光。'),
      h('div', { class: 'cards' }, cats),
      h('div', { class: 'panel', style: 'padding:12px;margin-top:12px;display:grid;gap:6px;font-size:13px' },
        h('div', {}, h('b', {}, '白色描边'), '：准星对准的主体模块。点线 = 炮管当前指向的弹道（炮管转动有延迟）；直射武器的半透明扇区 = 散布范围，两端方块 = 可能的落点范围，并显示命中率；高抛火炮的 × = 落点，指哪打哪。虚线框 = 炮弹实际会先打中的模块。'),
        h('div', {}, h('b', { style: 'color:var(--magenta)' }, '洋红描边'), '：准星对准的侧炮。侧挂层优先，只打侧炮，下面的主体会压暗。'),
        h('div', {}, h('b', { style: 'color:var(--fire2)' }, '橙色'), ' 只代表热量；', h('b', { style: 'color:var(--water2)' }, '青色'), ' 只代表水；', h('b', { style: 'color:var(--gauge2)' }, '绿色'), ' 只代表动力与底盘承载；', h('b', { style: 'color:var(--brass2)' }, '黄铜'), ' 只代表火力。'))]);
  }

  // ---------- 出战 ----------
  function deploy() {
    const d = S();
    const s = SA.V.stats(d.vehicle);
    const op = SA.S.opponent();
    if (!s.canDeploy) {
      openModal('无法出战', [h('p', {}, '原型机还不满足出战条件：'), s.problems.map(p => h('div', { class: 'warn bad' }, p)),
        h('p', {}, h('button', { class: 'btn primary', onclick: () => { closeModal(); SA.Editor.open(); } }, '去改装'))]);
      return;
    }
    openModal(`出战 · 第 ${d.round + 1} 轮`, [
      h('p', {}, `对手：「${op.name}」（${op.pilot}）· 奖金 ${money(op.prize)}${d.bet ? ` · 你押了 ${money(d.bet.amount)}` : ''}`),
      s.warnings.map(w => h('div', { class: 'warn' }, w)),
      h('p', { class: 'muted', style: 'font-size:13px' }, '操作：A/D 左右移动——机器有惯性，起步要加速、松手会滑行一段（加速冲撞可造成撞击伤害）；移动鼠标瞄准，炮管会慢慢转过去，按住左键开火（第一发要点火片刻），松开停火降温；直射武器有射界和散布，不保证指哪打哪，高抛火炮则指哪打哪；有多种武器时用数字键切换。履带被打断会掉链趴窝。锅炉烧干就会停机，驾驶舱全毁即告负。'),
      h('button', { class: 'btn primary', onclick: () => {
        $('#modal').hidden = true;
        SA.Battle.start({ mode: 'tournament', enemyVehicle: op.vehicle, enemyName: op.name, aim: op.aim, hpMul: op.hpMul, prize: op.prize });
      } }, '拉响汽笛，出发！'),
    ]);
  }

  // ---------- 战后结算 ----------
  function afterBattle(res) {
    const d = S();
    const lines = [];
    if (res.mode === 'tournament') {
      d.battles++;
      // 损伤带回工坊
      SA.V.each(d.vehicle, (cell, r, c, layer) => {
        if (cell.hp <= 0) return;
        const b = res.playerVehicle[layer][r][c];
        cell.hp = b ? Math.max(0, b.hp) : 0;
      });
      if (d.debt) { const add = Math.ceil(d.debt * 0.1); d.debt += add; lines.push(`银行利息 +${money(add)}`); }
      if (res.win) {
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
      if (SA.S.militaryOffer()) lines.push('📜 陆军部发来了原型机收购邀请，去「订单」查看。');
      const st = SA.V.stats(d.vehicle);
      if (st.damaged + st.broken) lines.push(`${st.damaged + st.broken} 个模块受损，记得去「修理」。`);
    } else {
      lines.push('友谊赛：不结算奖金，也不留下损伤。');
    }
    SA.S.save();
    SA.go('workshop');
    openModal(res.win ? '胜利！' : '战败', [
      h('p', { style: 'font-size:16px' }, h('b', {}, res.reason)),
      h('p', { class: 'muted' }, `造成伤害 ${Math.round(res.dealt)} · 承受伤害 ${Math.round(res.taken)} · 用时 ${Math.round(res.time)} 秒`),
      lines.map(l => h('div', { class: 'warn', style: 'border-left-color:var(--brass2)' }, l)),
    ]);
  }

  return { toast, openModal, closeModal, topbar, workshop, refresh, statBars, statLine, vehiclePreview, afterBattle, money,
    get benchCanvas() { return benchCanvas; } };
})();
