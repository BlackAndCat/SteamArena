// 改装蓝图库：官方基础蓝图（不能删除）+ 玩家保存在本地的蓝图
// 蓝图只记录布局；应用时先拆回当前车上的模块，缺的模块按原价补买
window.SA = window.SA || {};

SA.Blueprints = (() => {
  const h = SA.h, M = SA.MODULES;
  const KEY = 'steam_arena_blueprints_v1';   // 独立于存档，SA.reset() 不会清掉
  const d = () => SA.S.d;
  const money = (n) => SA.UI.money(n);

  const official = () => SA.OFFICIAL_BLUEPRINTS.map(b => ({ official: true, name: b.name, desc: b.desc, ...SA.V.layout(SA.V.fromAscii(b.name, b.rows, b.sides || [])) }));
  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 隐私模式 */ } }

  function save(name) {
    const list = mine();
    list.unshift({ name, ...SA.V.layout(d().vehicle), at: Date.now() });
    store(list);
  }
  function overwrite(i) {
    const list = mine();
    Object.assign(list[i], SA.V.layout(d().vehicle), { at: Date.now() });
    store(list);
  }
  function del(i) { const list = mine(); list.splice(i, 1); store(list); }

  // 应用蓝图要花多少钱：优先复用车上的模块（受损的先用上，保留原耐久），再用库存，最后补买
  function plan(bp) {
    const target = SA.V.fromLayout(d().vehicle.name, bp);
    const need = SA.V.countIds(target);
    const pool = {};
    let scrap = 0;
    SA.V.each(d().vehicle, (cell) => {
      if (cell.hp <= 0) scrap += Math.round(M[cell.id].price * 0.1);
      else (pool[cell.id] = pool[cell.id] || []).push(cell);
    });
    for (const id in pool) pool[id].sort((a, b) => a.hp / SA.V.maxHp(a) - b.hp / SA.V.maxHp(b));
    const buy = {};
    let buyCost = 0, fixCost = 0;
    for (const id in need) {
      const miss = Math.max(0, need[id] - (pool[id] || []).length - (d().inv[id] || 0));
      if (miss) { buy[id] = miss; buyCost += miss * M[id].price; }
    }
    // 用不上的受损模块要修好才能放回库存
    for (const id in pool) for (const cell of pool[id].slice(need[id] || 0)) if (cell.hp < SA.V.maxHp(cell)) fixCost += SA.S.repairCost(cell);
    return { target, need, pool, buy, buyCost, fixCost, scrap, cost: buyCost + fixCost };
  }

  function apply(bp, done) {
    const p = plan(bp);
    const run = () => {
      for (const id in p.buy) SA.S.addInv(id, p.buy[id]);
      SA.V.each(p.target, (cell, r, c, layer) => {
        const reuse = p.pool[cell.id] && p.pool[cell.id].shift();
        if (reuse) p.target[layer][r][c] = reuse;
        else SA.S.addInv(cell.id, -1);
      });
      for (const id in p.pool) for (const cell of p.pool[id]) SA.S.addInv(cell.id, 1);
      d().money += p.scrap;
      d().vehicle = p.target;
      SA.S.save();
      SA.UI.toast(`已按「${bp.name}」改装${p.scrap ? `，损毁件回收 ${money(p.scrap)}` : ''}`);
      if (done) done();
    };
    const lines = [
      h('p', {}, `车上现有的模块会先拆回库存，再按蓝图「${bp.name}」重新组装。`),
      Object.keys(p.buy).length ? h('div', { class: 'list', style: 'margin-bottom:8px' }, Object.entries(p.buy).map(([id, n]) =>
        h('div', { class: 'dlg-item', style: 'margin:0' }, SA.SPR.moduleCanvas(id, 0.6), `${M[id].name} ×${n}`, h('span', { class: 'gold', style: 'margin-left:auto' }, money(M[id].price * n))))) : null,
      p.fixCost ? h('p', { class: 'muted' }, `用不上的受损模块修好后放回库存：${money(p.fixCost)}`) : null,
    ];
    if (!p.cost) {
      SA.UI.dialog(`应用蓝图`, [lines, h('p', { class: 'muted' }, '库存够用，不需要花钱。')], [{ label: '应用', primary: true, onClick: run }]);
      return;
    }
    SA.UI.pay({ title: '应用蓝图', amount: p.cost, lines, okLabel: '应用', onPaid: run });
  }

  // 蓝图库弹窗；onApplied 在应用蓝图后回调（改装页用来刷新）
  function open(onApplied) {
    const reopen = () => open(onApplied);
    const nameIn = h('input', { type: 'text', maxLength: 20, value: `${d().vehicle.name} 方案 ${mine().length + 1}`, 'aria-label': '蓝图名称' });
    const card = (bp, i) => {
      const v = SA.V.fromLayout(bp.name, bp);
      const s = SA.V.stats(v);
      const p = plan(bp);
      let armed = false;
      const delBtn = !bp.official && h('button', { class: 'btn small', onclick: () => {
        if (!armed) { armed = true; delBtn.textContent = '确认删除？'; delBtn.classList.add('danger'); return; }
        del(i); reopen();
      } }, '删除');
      return h('div', { class: 'panel card bp' },
        h('div', { class: 'top' }, h('b', {}, bp.name), bp.official ? h('span', { class: 'chip next' }, '官方') : null),
        SA.UI.vehiclePreview(v, 1),
        h('div', { class: 'st' }, bp.official ? bp.desc : `保存于 ${new Date(bp.at).toLocaleString()}`),
        h('div', { class: 'st' }, `评分 ${s.rating} · ${s.issues.length ? `${s.issues.length} 个模块悬空` : s.canDeploy ? '可出战' : s.problems[0]}`),
        h('div', { class: 'ft' },
          h('span', { class: 'price' }, p.cost ? `需 ${money(p.cost)}` : '库存够用'),
          !bp.official ? h('button', { class: 'btn small', title: '用当前车辆覆盖这张蓝图', onclick: () => { overwrite(i); SA.UI.toast('已覆盖'); reopen(); } }, '覆盖') : null,
          delBtn,
          h('button', { class: 'btn small primary', onclick: () => apply(bp, onApplied) }, '应用')));
    };
    SA.UI.openModal('蓝图库', [
      h('div', { class: 'panel', style: 'padding:12px;display:grid;gap:8px;margin-bottom:12px' },
        h('b', {}, '把当前车辆存为蓝图'),
        h('div', { style: 'display:flex;gap:8px' }, nameIn, h('button', { class: 'btn primary', style: 'flex:none;white-space:nowrap', onclick: () => {
          save(nameIn.value.trim() || d().vehicle.name); SA.UI.toast('蓝图已保存'); reopen();
        } }, '保存')),
        h('span', { class: 'muted', style: 'font-size:12px' }, '蓝图只保存在这台设备的浏览器里，悬空的布局也会原样保存。应用蓝图时，车上的模块拆回库存，缺的模块按原价补买。')),
      h('div', { class: 'cards' }, mine().map(card), official().map(bp => card(bp))),
    ]);
  }

  return { open, save, mine, official, plan, apply };
})();
