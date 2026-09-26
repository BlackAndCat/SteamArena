// 蓝图库：我的蓝图（本地）+ 官方基础蓝图（不能删除）+ 内置分享码示例
// 蓝图只记录布局（不记材料）；应用时先拆回当前车上的模块，优先用材料最好的库存，缺的按黄铜原价补买。界面在车间底部操作栏里
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
  function rename(i, name) { const list = mine(); if (list[i]) { list[i].name = name; store(list); } }

  // 应用蓝图要花多少钱：优先复用车上的模块（受损的先用上，保留原耐久），再用库存，最后补买
  function plan(bp) {
    const target = SA.V.fromLayout(d().vehicle.name, bp);
    const need = SA.V.countIds(target);
    const pool = {};
    let scrap = 0;
    const blocked = [];
    SA.V.each(d().vehicle, (cell) => {
      if (cell.hp <= 0) scrap += Math.round(SA.cellValue({ id: cell.id, mt: cell.mt }) * 0.1);
      else (pool[cell.id] = pool[cell.id] || []).push(cell);
    });
    // 车上的同款模块：材料好的先用，同材料里受损的先用上（保留原耐久）
    for (const id in pool) pool[id].sort((a, b) => (b.mt || 1) - (a.mt || 1) || a.hp / SA.V.maxHp(a) - b.hp / SA.V.maxHp(b));
    const buy = {};
    let buyCost = 0, fixCost = 0;
    for (const id in need) {
      const miss = Math.max(0, need[id] - (pool[id] || []).length - SA.S.invCount(id));
      if (miss && SA.isUnique(id)) blocked.push(`${M[id].name}是唯一件，只能通过缴获获得`);
      else if (miss) { buy[id] = miss; buyCost += miss * SA.buyPrice(id); }
    }
    // 用不上的受损模块要修好才能放回库存
    for (const id in pool) for (const cell of pool[id].slice(need[id] || 0)) if (cell.hp < SA.V.maxHp(cell)) fixCost += SA.S.repairCost(cell);
    return { target, need, pool, buy, buyCost, fixCost, scrap, blocked, cost: buyCost + fixCost };
  }

  function apply(bp, done) {
    const p = plan(bp);
    if (p.blocked.length) {
      SA.UI.dialog('蓝图无法应用', [h('p', { style: 'margin-top:0' }, p.blocked.join('；')), h('p', { class: 'muted' }, '唯一件不能购买，只能在对应战斗中缴获。')], [{ label: '知道了', primary: true }]);
      return;
    }
    const run = () => {
      for (const id in p.buy) SA.S.addInv(id, p.buy[id], SA.buyMt(id));
      SA.V.each(p.target, (cell, r, c, layer) => {
        const reuse = p.pool[cell.id] && p.pool[cell.id].shift();
        if (reuse) p.target[layer][r][c] = reuse;
        else p.target[layer][r][c] = SA.newCell(cell.id, SA.S.takeBest(cell.id) || 1);
      });
      // 用不上的模块回库存；改装件按半价回收
      for (const id in p.pool) for (const cell of p.pool[id]) {
        SA.S.addInv(cell.id, 1, cell.mt || 1);
        for (let k = 1; k <= (cell.lv || 0); k++) d().money += Math.round(SA.upCost(cell.id, k) * 0.5);
      }
      d().money += p.scrap;
      d().vehicle = p.target;
      SA.Camp.syncLim();
      SA.S.save();
      SA.UI.toast(`已按「${bp.name}」改装${p.scrap ? `，损毁件回收 ${money(p.scrap)}` : ''}`);
      if (done) done();
    };
    const lines = [
      h('p', {}, `车上现有的模块会先拆回库存，再按蓝图「${bp.name}」重新组装。`),
      Object.keys(p.buy).length ? h('div', { class: 'list', style: 'margin-bottom:8px' }, Object.entries(p.buy).map(([id, n]) =>
        h('div', { class: 'dlg-item', style: 'margin:0' }, SA.SPR.moduleCanvas(id, 0.6), `${M[id].name} ×${n}`, h('span', { class: 'gold', style: 'margin-left:auto' }, money(SA.buyPrice(id) * n))))) : null,
      p.fixCost ? h('p', { class: 'muted' }, `用不上的受损模块修好后放回库存：${money(p.fixCost)}`) : null,
    ];
    if (!p.cost) {
      SA.UI.dialog(`应用蓝图`, [lines, h('p', { class: 'muted' }, '库存够用，不需要花钱。')], [{ label: '应用', primary: true, onClick: run }]);
      return;
    }
    SA.UI.pay({ title: '应用蓝图', amount: p.cost, lines, okLabel: '应用', onPaid: run });
  }

  // 统一列表：我的 → 官方 → 内置分享码示例（示例也能当蓝图直接应用）
  function all() {
    const out = [];
    mine().forEach((b, i) => out.push({ ...b, kind: 'mine', index: i, key: `m${b.at}` }));
    official().forEach((b, i) => out.push({ ...b, kind: 'official', key: `o${i}` }));
    SA.S.Cloud.list().forEach((e, i) => {
      const v = SA.V.decode(e.code);
      if (v) out.push({ name: e.name, author: e.author, code: e.code, kind: 'cloud', key: `c${i}${e.name}`, ...SA.V.layout(v) });
    });
    return out;
  }

  // 导入分享码：存成自己的蓝图
  function importCode(code) {
    const v = SA.V.decode(code);
    if (!v) return null;
    const list = mine();
    list.unshift({ name: v.name, ...SA.V.layout(v), at: Date.now() });
    store(list);
    return v;
  }

  // 分享：只生成分享码，不写任何云端或本地上传记录。
  function share(bp) {
    const v = SA.V.fromLayout(bp.name, bp);
    return SA.V.encode(v);
  }

  return { all, save, overwrite, del, rename, mine, official, plan, apply, importCode, share };
})();
