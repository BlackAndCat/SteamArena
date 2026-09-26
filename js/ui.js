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

  // 小确认框：actions = [{ label, primary, onClick }]，自动附带「取消」（cancelLabel = false 不带）
  // onDismiss：没点任何按钮就关掉（取消 / 点背景 / Esc）时调用，用来把一串战后弹窗接下去
  function dialog(title, body, actions = [], cancelLabel = '取消', onDismiss = null) {
    const m = $('#modal');
    m.innerHTML = '';
    const btns = actions.map(a => h('button', { class: `btn ${a.primary ? 'primary' : ''}`, onclick: () => { modalOnClose = null; closeModal(); a.onClick(); } }, a.label));
    if (cancelLabel !== false || !btns.length) btns.push(h('button', { class: 'btn', onclick: closeModal }, actions.length ? cancelLabel : '知道了'));
    m.append(h('div', { class: 'panel dialog' },
      h('div', { class: 'panel-head' }, h('h2', {}, title)),
      h('div', { class: 'panel-body' }, body),
      h('div', { class: 'dialog-actions' }, btns)));
    m.hidden = false;
    modalOnClose = onDismiss;
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
    if (!SA.Camp.has('bank')) {
      dialog('资金不足', [lines, h('p', {}, `还差 ${money(short)}。`), h('p', { class: 'muted' }, '打一场比赛赚点钱再来，或者把用不上的库存卖掉（选中模块 → 卖）。')]);
      return;
    }
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
  // 徽标：车间 = 出战前必须处理的问题数；出战 = 可交付的委托
  // 函数名沿用 topbar()：各处改完数据都调用它刷新。车间、银行都要战役解锁后才出现
  function topbar() {
    const d = S();
    const bar = $('#side');
    bar.innerHTML = '';
    const cur = SA.current;
    const s = SA.V.stats(d.vehicle);
    const fix = s.problems.length;
    const has = SA.Camp.has;
    const ready = has('orders') ? SA.ORDERS.filter(o => d.orders.includes(o.id) && d.rep >= o.rep && !s.issues.length && o.req.every(([, f, n]) => f(s) >= n)).length : 0;
    const st = SA.Camp.current(), ch = SA.CAMPAIGN[SA.Camp.chIndex()];
    const where = st ? `${ch.name.split(' · ')[0]} · 第 ${st.si + 1}/${ch.stages.length} 场` : `锦标赛第 ${d.round + 1} 轮`;
    const ingots = Object.entries(d.ingots || {}).filter(([, n]) => n > 0);
    const plate = (key, icon, label, sub, badge, bad) => h('button', { class: `nav-plate ${cur === key ? 'on' : ''}`, 'aria-current': cur === key ? 'page' : null, onclick: () => SA.nav(key) },
      h('span', { class: 'rivets' }),
      SA.SPR.iconCanvas(icon, cur === key ? '#2a1a05' : '#d9a441', 4),
      h('span', { class: 'nm' }, label),
      h('span', { class: 'sub' }, sub),
      badge ? h('span', { class: `badge ${bad ? 'bad' : ''}` }, badge) : null);
    bar.append(
      h('div', { class: 'side-title' }, '蒸汽', h('br'), '竞技场'),
      h('nav', { class: 'side-nav' },
        has('garage') ? plate('garage', 'wrench', '车间', has('shop') ? '改装 · 商店' : '改装', fix ? `${fix} 项问题` : null, true) : null,
        plate('arena', 'swords', '出战', where, ready ? `${ready} 份委托` : null)),
      h('div', { class: 'side-res' },
        h(has('bank') ? 'button' : 'span', { class: 'res money', title: has('bank') ? '银行：借款 / 还款' : '资金', onclick: has('bank') ? openBank : null },
          h('span', { class: 'k' }, '资金'), h('b', {}, money(d.money)),
          d.debt ? h('span', { class: 'debt' }, `债 ${money(d.debt)}`) : null),
        h('span', { class: 'res' }, h('span', { class: 'k' }, '声望'), h('b', {}, '★'.repeat(Math.min(d.rep, 8)) || '—'), d.rep > 8 ? `×${d.rep}` : null),
        ingots.length ? h('span', { class: 'res' }, h('span', { class: 'k' }, '材料'), h('b', {}, ingots.map(([k, n]) => `${SA.INGOTS[k].name}×${n}`).join(' '))) : null,
        h('span', { class: 'res season' }, h('span', { class: 'k' }, SA.Camp.done() ? '赛季' : '战役'), h('b', {}, SA.Camp.done() ? `${d.season} · ${d.round + 1}/6` : ch.place)),
        h('button', { class: 'dev-btn', title: '开发者模式：一键解锁、跳章、加钱', onclick: SA.Camp.dev.panel }, '开发者'),
        h('button', { class: `dev-btn ${SA.Text && SA.Text.isEditing() ? 'on' : ''}`, title: '一键切换文本编辑模式', onclick: () => { SA.Text.toggle(); topbar(); } }, SA.Text && SA.Text.isEditing() ? '完成文本编辑' : '文本编辑')),
    );
  }

  // ---------- 属性条 ----------
  function statBars(s, v) {
    const pmax = Math.max(s.supply, s.demand, 1);
    const wmax = Math.max(s.load, s.weight, 1);
    const pct = (x, m) => `${Math.max(0, Math.min(100, (x / m) * 100))}%`;
    const oh = s.overheat === Infinity ? '不会烧干' : `全力开火 ${Math.round(s.overheat)} 秒后烧干`;
    const heatShare = Math.min(1, (s.heatGen + SA.K.IDLE_HEAT) / Math.max(0.1, SA.K.DISSIPATE + s.cool + (s.dryCool || 0)));
    // 省水：同样的水按耗水倍率折算成"等效水量"，水条后面用斜纹接上多出来的那一截
    const effWater = s.waterSave < 1 ? s.water / s.waterSave : s.water, wScale = Math.max(250, effWater);
    // 全车最大穿深 / 最厚装甲（v 可选：给了才算；穿深对照表在选中武器时的清单里）
    let pen = 0, thick = 0;
    if (v) SA.V.each(v, (cell) => { if (cell.hp <= 0) return; const m = SA.mod(cell); if (m.penetration < 99) pen = Math.max(pen, m.penetration || 0); thick = Math.max(thick, m.armor || 0); });
    return h('div', { class: 'bars' },
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '动力'),
        h('div', { class: 'bar power' }, h('i', { style: `width:${pct(s.demand, pmax)}` }),
          h('span', { class: 'mark', style: `left:${pct(s.supply, pmax)}`, title: '锅炉供给' }))),
      h('div', { class: 'bar-note' }, `需求 ${s.demand}（设备 ${s.equip} + 行驶 ${s.drive}）· 锅炉供给 ${s.supply}（白线）`,
        s.store ? h('span', { class: 'na-inline na-储能' }, ` · 储能 ${f1(s.store)}：富余时蓄压，不够时每秒补 3`) : null),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '重量'),
        h('div', { class: `bar weight ${s.weight > s.load ? 'over' : ''}` }, h('i', { style: `width:${pct(s.weight, wmax)}` }),
          h('span', { class: 'cap', style: `left:calc(${pct(s.load, wmax)} - 2px)`, title: '底盘承重' }))),
      h('div', { class: 'bar-note' }, `总重 ${SA.tons(s.weight)} · 底盘承重 ${SA.tons(s.load)}（红线）· 撞击伤害 ×${SA.ramMul(s.weight).toFixed(2)} · 每吨要 ${SA.K.DRIVE_PER_T} 动力才能跑满速`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '速度'),
        h('div', { class: 'bar speed' }, h('i', { style: `width:${pct(s.topSpeed, 100)}` }),
          h('span', { class: 'mark', style: `left:${pct(s.speed, 100)}`, title: '底盘基础速度' }))),
      h('div', { class: 'bar-note' }, `最高 ${SA.kmh(s.topSpeed)}（底盘 ${SA.kmh(s.speed)} × 动力 ${Math.round((s.speedMul || 0) * 100)}%，锅炉富余最多 ${Math.round(SA.K.SPEED_BOOST * 100)}%）· 刹车 ×${(s.brake || 0).toFixed(2)} · 晃动 ×${(s.sway || 0).toFixed(2)}`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '瞄准'),
        h('div', { class: 'bar aim' }, h('i', { style: `width:${pct(s.aimShrink, SA.K.AIM_SHRINK_MAX)}` }))),
      h('div', { class: 'bar-note' }, `按住蓄满最多缩小散布 ${Math.round(s.aimShrink * 100)}% · 瞄准速度 ×${s.aimSpeed.toFixed(2)}（直射火炮约 ${(SA.MODULES.cannon.aimT / s.aimSpeed).toFixed(1)} 秒蓄满）· 以后加装瞄准镜可以缩得更多、更快`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '热量'),
        h('div', { class: 'bar heat' }, h('i', { style: `width:${pct(heatShare, 1)}` }))),
      h('div', { class: 'bar-note' }, `产热 ${(s.heatGen + SA.K.IDLE_HEAT).toFixed(1)}/秒 · 散热 ${SA.K.DISSIPATE}+冷却 ≤${s.cool}/秒`,
        s.dryCool ? h('span', { class: 'na-inline na-不耗水散热' }, ` + 不耗水散热 ${f1(s.dryCool)}/秒`) : null, ` · ${oh}`),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '水'),
        h('div', { class: 'bar water' }, h('i', { style: `width:${pct(s.water, wScale)}` }),
          effWater > s.water ? h('b', { class: 'eff', style: `left:${pct(s.water, wScale)};width:${pct(effWater - s.water, wScale)}`, title: '省水：冷却耗水打折后等于多出来的水' }) : null)),
      h('div', { class: 'bar-note' }, `${s.tanks} 只水箱 · 共 ${s.water} 单位`,
        s.waterSave < 1 ? h('span', { class: 'na-inline na-省水' }, ` · 省水：冷却耗水 ×${f1(s.waterSave)}，相当于 ${Math.round(effWater)} 单位（斜纹）`) : null),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '耐久'),
        h('div', { class: 'bar hp' }, h('i', { style: `width:${pct(s.hp, Math.max(s.maxHp, 1))}` }))),
      h('div', { class: 'bar-note' }, `${s.hp}/${s.maxHp} · 火力 ${s.dps.toFixed(1)}/秒 · 综合评分 ${s.rating}`,
        pen ? ` · 最大穿深 ${f1(pen)}` : '', thick ? ` · 最厚装甲 ${f1(thick)}` : '',
        s.tether ? h('span', { class: 'na-inline na-牵引' }, ' · 带牵引') : null),
      s.problems.map(p => h('div', { class: 'warn bad' }, p)),
      s.warnings.map(w => h('div', { class: 'warn' }, w)),
    );
  }

  function statLine(id, mt = 1) {
    const m = SA.mod(id, mt);
    const parts = [`耐久 ${m.hp}`];
    if (m.armor) parts.push(`装甲厚度 ${f1(m.armor)}`);
    if (m.power) parts.push(`动力 -${m.power}`);
    if (m.supply) parts.push(`动力 +${m.supply}`, `产热 ≤${m.heatRate}/秒`);
    if (m.load) parts.push(`承重 ${SA.tons(m.load)}`, `速度 ${SA.kmh(m.speed)}`, `起步 ×${m.accel}`, `刹车 ×${m.brake}`, `晃动 ×${m.sway}`);
    parts.push(`重量 ${SA.tons(SA.weightOf({ id }))}`);
    if (m.dmg) parts.push(`伤害 ${m.dmg}`, `装填 ${m.reload}s`, m.indirect ? '高抛 · 指哪打哪' : `直射 · 散布 ±${m.spread}° · 仰角 ${m.elev[0]}~${m.elev[1]}°`, `热 +${m.heat}/发`);
    if (m.penetration) parts.push(m.penetration >= 99 ? '不会弹开' : `穿深 ${m.penetration}${m.ricochet ? `（易弹开 +${Math.round(m.ricochet * 100)}%）` : ''}`);
    if (m.tether) parts.push(`牵引 ${m.tether}`);
    if (m.store) parts.push(`储能 ${f1(m.store)}`);
    if (m.dryCool) parts.push(`不耗水散热 ${f1(m.dryCool)}/秒`);
    if (m.waterSave) parts.push(`省水：耗水 ×${m.waterSave}`);
    if (m.ram) parts.push(`撞击 ${m.ram}×速度`);
    if (m.punch) parts.push(`活塞 ${m.punch}/${m.punchCd}s`);
    if (m.water) parts.push(`冷却 ${m.cool}/秒`, `水 ${m.water}`);
    else if (m.cool) parts.push(`冷却 ${m.cool}/秒`);
    if (m.evade) parts.push(`闪避 +${Math.round(m.evade * 100)}%`);
    if (m.acc && !m.dmg) parts.push(`命中 +${Math.round(m.acc * 100)}%`);
    return parts.join(' · ');
  }

  function vehiclePreview(v, scale = 4) {
    const cv = h('canvas', { class: 'px' });
    // 裁到载具包围盒，让车在预览里尽量大
    const C = SA.K.CELL;
    let c0 = SA.K.COLS, c1 = -1, r0 = SA.K.ROWS;
    SA.V.each(v, (cell, r, c) => { c0 = Math.min(c0, c); c1 = Math.max(c1, c + SA.fp(cell.id).w - 1); r0 = Math.min(r0, r); });
    if (c1 < 0) { c0 = 0; c1 = SA.K.COLS - 1; r0 = 0; }
    r0 = Math.min(r0, SA.K.ROWS - 6);   // 至少露出 3 层大格
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
    const pre = [];   // 结算弹窗之前依次弹出的：缴获、解锁
    const money0 = d.money;   // 结算时和修理费对照：这一场到底赚没赚
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
          if (loot.length) pre.push((next) => SA.Camp.salvageDialog(res.survivors || [], next));
          else lines.push('对手车上没有你缺的零件，这次没什么可缴获的。');
        } else lines.push('这场遭遇战已经完成过了，没有重复奖励。');
        d.news = `「${d.vehicle.name}」击败了场外的「${res.enemyName}」。`;
      } else {
        lines.push('遭遇战失败：不发奖金，也不计声望。');
        d.news = `「${d.vehicle.name}」败给了场外的「${res.enemyName}」。`;
      }
    } else if (res.mode === 'campaign' || res.mode === 'tournament') {
      const camp = res.mode === 'campaign';
      if (d.debt) { const add = Math.ceil(d.debt * 0.1); d.debt += add; lines.push(`银行利息 +${money(add)}`); }
      if (res.draw) {
        const fee = drawFee(res.prize);
        d.money += fee;
        lines.push(`平手：双方各拿出场费 ${money(fee)}，这一场要重赛`);
        if (d.bet) { d.money += d.bet.amount; lines.push(`平局退还赌注 ${money(d.bet.amount)}`); }
        d.news = `「${d.vehicle.name}」和「${res.enemyName}」打成平手，择日重赛。`;
      } else if (res.win) {
        d.money += res.prize; d.wins++;
        const rep = (res.flawless ? 2 : 1) + (res.surrendered ? 1 : 0);
        d.rep += rep;
        lines.push(`奖金 +${money(res.prize)}`, `声望 +${rep}${[res.flawless ? '驾驶舱毫发无损' : '', res.surrendered ? '接受投降，体面收场' : ''].filter(Boolean).map(x => `（${x}）`).join('')}`);
        if (d.bet) { const pay = Math.round(d.bet.amount * d.bet.odds); d.money += pay; lines.push(`赌注兑现 +${money(pay)}`); }
        // 缴获：只有你还没有的零件或史诗 / 传奇件；什么都没有就说一声
        const loot = SA.Camp.salvageOptions(res.survivors || []);
        if (loot.length) pre.push((next) => SA.Camp.salvageDialog(res.survivors || [], next));
        else lines.push('对手车上没有你缺的零件，这次没什么可缴获的。');
        if (camp) {
          const r = SA.Camp.win();
          lines.push(...r.lines);
          for (const u of r.unlocks) pre.push((next) => SA.Camp.unlockDialog(u, next));
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
        if (d.bet) lines.push(`赌注 ${money(d.bet.amount)} 输光了`);
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
    SA.nav('arena', null, true);
    // 受损就直接给出修理入口，不让玩家自己找
    const summary = () => {
      const hurt = [];
      SA.V.each(d.vehicle, (cell) => { if (cell.hp < SA.V.maxHp(cell)) hurt.push(cell); });
      const cost = hurt.reduce((a, c) => a + SA.S.repairCost(c), 0);
      const fixAll = () => { for (const c of hurt) c.hp = SA.V.maxHp(c); toast(`修好 ${hurt.length} 个模块，花费 ${money(cost)}`); };
      const after = () => { refresh(); SA.Camp.introIfNew(); };
      const gain = d.money - money0, net = gain - cost;
      dialog(res.draw ? '平手' : res.win ? '胜利！' : '战败', [
        h('p', { style: 'font-size:16px;margin-top:0' }, h('b', {}, res.reason)),
        h('p', { class: 'muted' }, `造成伤害 ${Math.round(res.dealt)} · 承受伤害 ${Math.round(res.taken)} · 用时 ${Math.round(res.time)} 秒`),
        lines.map(l => h('div', { class: 'warn', style: 'border-left-color:var(--brass2)' }, l)),
        hurt.length ? h('div', { class: 'rp-sum' },
          h('div', { class: 'rp-head' }, h('b', {}, `修理费 · ${hurt.length} 个模块受损`), h('span', { class: 'muted' }, '越精密的部件修起来越贵')),
          repairList(hurt),
          gain > 0 ? h('div', { class: `rp-net ${net < 0 ? 'bad' : ''}` },
            `本场进账 ${money(gain)} − 修理 ${money(cost)} = `, h('b', {}, `${net < 0 ? '净亏' : '净赚'} ${money(Math.abs(net))}`)) : null) : null,
      ], [
        hurt.length ? { label: `全部修理 ${money(cost)}`, primary: true, onClick: () => pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false, onPaid: () => { fixAll(); after(); } }) } : null,
        hurt.length && SA.Camp.has('garage') ? { label: '去车间', onClick: () => SA.nav('garage') } : null,
      ].filter(Boolean), hurt.length ? '稍后再说' : '继续', after);
    };
    const run = (i) => (i < pre.length ? pre[i](() => run(i + 1)) : summary());
    run(0);
  }

  // ---------- 修理费呈现（W2，docs/campaign-direction.md §5）----------
  // 修理费比例（SA.repairRate，astra 定）分四档给玩家看：越精密越贵。"修满" = 这一件（含材料和改装）从报废修到满耐久的钱
  const RP_TIERS = [[0.06, '便宜'], [0.12, '一般'], [0.2, '较贵'], [Infinity, '昂贵']];
  function repairTier(id) {
    const rate = SA.repairRate(id), i = RP_TIERS.findIndex(([x]) => rate <= x + 1e-9);
    return { n: i + 1, name: RP_TIERS[i][1], rate };
  }
  const repairFull = (cell) => Math.max(1, Math.ceil(SA.cellValue(cell) * SA.repairRate(cell.id)));
  // 四格小扳手刻度：亮几格 = 第几档
  function repairPips(id, label) {
    const t = repairTier(id);
    return h('span', { class: `rp rp-${t.n}`, title: `修理费${t.name}：修满约为部件价值的 ${Math.round(t.rate * 100)}%` },
      label ? h('em', {}, label) : null, h('i'), h('i'), h('i'), h('i'));
  }
  function repairChip(cell) {
    const t = repairTier(cell.id);
    return h('span', { class: `chip rp-chip rp-${t.n}`, title: `修理费${t.name}：部件价值 ${money(SA.cellValue(cell))} × ${Math.round(t.rate * 100)}%，按损伤比例计` },
      `修满 ${money(repairFull(cell))} · ${t.name}`);
  }
  // 修理清单：按花费从高到低，最贵的几件单独列出，条的长短 = 占总修理费的比例
  function repairList(cells, top = 5) {
    const rows = cells.map(c => ({ c, cost: SA.S.repairCost(c) })).filter(r => r.cost > 0).sort((a, b) => b.cost - a.cost);
    const total = rows.reduce((a, r) => a + r.cost, 0), rest = rows.slice(top);
    const row = ({ c, cost }) => {
      const max = SA.V.maxHp(c), lost = c.hp <= 0 ? '报废' : `损 ${Math.round((1 - c.hp / max) * 100)}%`, t = repairTier(c.id);
      const pic = SA.SPR.moduleCanvas(c.id, 0.5, c.mt); pic.classList.add('px');
      return h('div', { class: `rp-row rp-${t.n}`, style: `--f:${(cost / Math.max(1, total) * 100).toFixed(1)}%` },
        h('span', { class: 'pic' }, pic), h('span', { class: 'nm' }, SA.MODULES[c.id].name, ' ', SA.Camp.matChip(c.mt || 1)),
        h('span', { class: `lost ${c.hp <= 0 ? 'dead' : ''}` }, lost), repairPips(c.id), h('b', {}, money(cost)));
    };
    return h('div', { class: 'rp-list' }, rows.slice(0, top).map(row),
      rest.length ? h('div', { class: 'rp-row more' }, h('span', { class: 'nm' }, `其余 ${rest.length} 件`), h('b', {}, money(rest.reduce((a, r) => a + r.cost, 0)))) : null,
      rows.length > 1 ? h('div', { class: 'rp-row total' }, h('span', { class: 'nm' }, '合计'), h('b', {}, money(total))) : null);
  }
  // 一行文字版（按钮的鼠标提示用）
  const repairBrief = (cells) => cells.map(c => [c, SA.S.repairCost(c)]).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([c, k]) => `${SA.MODULES[c.id].name} ${money(k)}`).join('\n');

  // ---------- 新属性（V4）：储能、省水、不耗水散热、牵引、穿深 / 装甲厚度 ----------
  const f1 = (x) => (Math.round(x * 10) / 10).toString();
  // 弹开概率（和战斗里同一个公式，SA.Battle.ricochetChance）
  const bounce = (armor, w) => (SA.Battle && SA.Battle.ricochetChance ? SA.Battle.ricochetChance(armor, w) : 0);
  const ARMOR_REF = ['plate', 'armor', 'bucket', 'armor_heavy'];
  const PEN_REF = ['mg', 'side_cannon', 'cannon_s', 'cannon_m', 'rocket_rack', 'mortar', 'cannon', 'cannon_heavy', 'cannon_giant'];
  function bounceCell(ch) {
    const k = ch <= 0 ? 0 : ch < 0.3 ? 1 : ch < 0.55 ? 2 : 3;
    return h('td', { class: `pen pen-${k}`, title: ch <= 0 ? '穿深够：照常按护甲减伤' : `穿深不够：${Math.round(ch * 100)}% 的炮弹会弹开，几乎没伤害` },
      ch <= 0 ? '穿' : `${Math.round(ch * 100)}%`);
  }
  // 穿深对照表：武器 → 各种装甲 × 各级材料；装甲 → 常见武器 × 这块装甲的各级材料
  function penTable(id, maxMt = SA.MAT_MAX) {
    const m = SA.MODULES[id], mats = SA.MATS.slice(1, Math.max(1, maxMt) + 1);
    const head = h('tr', {}, h('th', {}, ''), mats.map((mt) => h('th', { title: mt.rank ? `${mt.rank} · ${mt.name}` : mt.name }, h('i', { class: 'mat-dot', style: `background:${mt.chip}` }), mt.name)));
    if (m.dmg) {
      if (!m.penetration || m.penetration >= 99) return h('div', { class: 'pen-note' }, '喷射类武器：不会弹开。');
      return h('div', { class: 'pen-wrap' },
        h('div', { class: 'pen-cap' }, `穿深 ${m.penetration}${m.ricochet ? `（另加 ${Math.round(m.ricochet * 100)}% 弹开）` : ''} 打各种装甲的弹开率`),
        h('table', { class: 'pen-tab' }, head, ARMOR_REF.map(a => h('tr', {}, h('th', {}, SA.MODULES[a].name),
          mats.map((mt, i) => bounceCell(bounce(SA.mod(a, i + 1).armor, m)))))));
    }
    if (m.armor) {
      return h('div', { class: 'pen-wrap' },
        h('div', { class: 'pen-cap' }, `装甲厚度 ${mats.map((mt, i) => f1(SA.mod(id, i + 1).armor)).join(' / ')}（随材料加厚）· 各武器打它的弹开率`),
        h('table', { class: 'pen-tab' }, head, PEN_REF.map(w => h('tr', {}, h('th', {}, `${SA.MODULES[w].name} ${SA.MODULES[w].penetration}`),
          mats.map((mt, i) => bounceCell(bounce(SA.mod(id, i + 1).armor, SA.MODULES[w])))))));
    }
    return null;
  }
  // 把一件模块临时放进车的空位，算出装上前后的整车属性（只用来预览，不管摆放规则）
  function statsWith(v, id, mt = 1) {
    const layer = SA.V.layerOf(id) === 'side' ? 'side' : 'body', f = SA.fp(id), o = SA.V.occ(v, layer);
    for (let r = 0; r + f.h <= SA.K.ROWS - 2; r++) for (let c = 0; c + f.w <= SA.K.COLS; c++) {
      let free = true;
      for (let i = 0; i < f.h && free; i++) for (let j = 0; j < f.w && free; j++) if (o[r + i][c + j]) free = false;
      if (!free) continue;
      const w = SA.V.clone(v);
      w[layer][r][c] = SA.newCell(id, mt);
      return SA.V.stats(w);
    }
    return null;
  }
  const secs = (t) => (t === Infinity ? '不会烧干' : `${Math.round(t)} 秒`);
  // 新属性模块的说明 + 装上后的变化（车间右侧选中行展开）
  function newAttrInfo(id, mt, v) {
    const m = SA.mod(id, mt), out = [];
    if (m.store) out.push(['储能', `蓄压容量 ${f1(m.store)}：锅炉有富余时把多出来的动力存起来，动力不够时每秒最多补 3 点。存量过半时被打爆会爆炸。`]);
    if (m.waterSave) out.push(['省水', `全车冷却耗水 ×${m.waterSave}（多个相乘，最低 ×0.4）：同样的水能冷却更久。本身不储水。`]);
    if (m.dryCool) out.push(['不耗水散热', `每秒额外散掉 ${f1(m.dryCool)} 点热量，不用水：水烧光以后也照样散热。`]);
    if (m.tether) out.push(['牵引', `命中后挂上绳索，把对手往自己这边拉（收绳 ${m.tether}）；被拉过来撞上时反震从 ${Math.round(SA.K.RAM_SELF * 100)}% 降到 ${Math.round(SA.K.RAM_TETHER_SELF * 100)}%。绳子挂着时不能再发射。`]);
    if (!out.length) return null;
    const a = v && SA.V.stats(v), b = v && statsWith(v, id, mt);
    const diff = [];
    if (a && b) {
      if ((m.store || m.waterSave || m.dryCool) && a.overheat !== b.overheat) diff.push(`全力开火烧干：${secs(a.overheat)} → ${secs(b.overheat)}`);
      if (m.store) diff.push(`储能 ${f1(a.store)} → ${f1(b.store)}`);
      if (m.waterSave) diff.push(`冷却耗水 ×${f1(a.waterSave)} → ×${f1(b.waterSave)}`);
      if (m.dryCool) diff.push(`不耗水散热 ${f1(a.dryCool)} → ${f1(b.dryCool)}/秒`);
      diff.push(`评分 ${a.rating} → ${b.rating}`, `总重 ${SA.tons(a.weight)} → ${SA.tons(b.weight)}`);
    }
    return h('div', { class: 'na-wrap' },
      out.map(([k, t]) => h('div', { class: 'na-row' }, h('b', { class: `na-tag na-${k}` }, k), h('span', {}, t))),
      diff.length ? h('div', { class: 'na-diff' }, h('span', { class: 'muted' }, '装上这一件：'), diff.map(x => h('span', {}, x))) : null);
  }

  return { toast, openModal, closeModal, dialog, pay, topbar, refresh, openBank, statBars, statLine, vehiclePreview, afterBattle, money,
    repairTier, repairFull, repairPips, repairChip, repairList, repairBrief, penTable, newAttrInfo, statsWith };
})();
