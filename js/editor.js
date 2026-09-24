// 车间：改装台 + 商店 + 修理 + 蓝图库/云车库，全在这一页（主体层 / 侧挂层，像素 / 图纸视图）
// 操作集中在底部操作栏：选模块 → 点格子放置；点已有模块直接替换，再点一次同款模块就拆下。
// 操作栏可切到「蓝图库」：保存 / 应用 / 分享蓝图，云车库里别人的车也能直接套用。
// 车上的模块可以拖动（空格 = 移动，有模块 = 对调），拖出车外放回库存。
// 改装台上允许悬空、乱放；只有出战时才要求所有模块都连到底盘（SA.V.issues）。
window.SA = window.SA || {};

SA.Editor = (() => {
  const h = SA.h, K = SA.K, M = SA.MODULES, P = SA.PAL;
  const PADX = SA.SPR.PADX, C = K.CELL;
  const W = K.COLS * C + PADX * 2, H = K.ROWS * C + 12;
  const DRAG_PX = 6;
  // sel：从库存选中、准备放置的模块 id；pick：车上选中的格子 { layer, r, c }
  // dock：底部操作栏显示「模块」还是「蓝图库」；bp：蓝图库里选中的蓝图 key；bpFilter：蓝图来源筛选
  const st = { layer: 'body', sel: null, pick: null, hover: null, stats: null, tab: 'all', plateOpen: null, press: null, drag: null, msg: null, noClick: false,
    dock: 'mods', bp: null, bpFilter: 'all', shop: false, fold: loadFold() };
  // 商店分组的折叠状态记在本机
  function loadFold() { try { return new Set(JSON.parse(localStorage.getItem('steam_arena_fold_v1')) || []); } catch (e) { return new Set(); } }
  function saveFold() { try { localStorage.setItem('steam_arena_fold_v1', JSON.stringify([...st.fold])); } catch (e) { /* ignore */ } }   // shop：「商店」开关，打开后列表里也显示没有库存的模块
  let cv, g, stage, tipEl, viewEl, ctxEl, toolsEl, invEl, dockEl, plateEl, ghost, ro;

  const d = () => SA.S.d;
  const veh = () => d().vehicle;
  const money = (n) => SA.UI.money(n);
  const hurt = (cell) => cell && cell.hp > 0 && cell.hp < SA.V.maxHp(cell);
  const where = (r, c) => `第 ${K.ROWS - r} 层 第 ${c + 1} 列`;
  const issueAt = (layer, r, c) => st.stats.issues.find(x => x.layer === layer && x.r === r && x.c === c);

  function open(dock) {
    if (dock) st.dock = dock;
    SA.go('garage');
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    Object.assign(st, { sel: null, pick: null, hover: null, press: null, drag: null, msg: null });
    if (st.plateOpen == null) st.plateOpen = window.innerWidth >= 1700;   // 展开的铭牌会盖住格子，默认收成一行
    st.stats = SA.V.stats(veh());

    cv = h('canvas', { class: 'px', width: W, height: H });
    g = cv.getContext('2d');
    tipEl = h('div', { class: 'ed-tip' });
    plateEl = h('div', { class: 'brass-plate' });
    viewEl = h('div', { class: 'ed-view' });
    stage = h('div', { class: 'ed-stage' }, cv, plateEl, viewEl, tipEl,
      h('button', { class: 'ed-help', title: '图例与规则', 'aria-label': '图例与规则', onclick: openHelp }, '?'));
    // 中间：画布 + 下方操作栏；右边：模块清单 / 蓝图库（拖出车外的模块丢到这里就回库存）
    ctxEl = h('div', { class: 'dock-ctx' });
    toolsEl = h('div', { class: 'panel-tools' });
    invEl = h('div', { class: 'panel-list' });
    dockEl = h('aside', { class: 'ed-panel' }, toolsEl, invEl);
    screen.append(h('div', { class: 'ed' }, h('div', { class: 'ed-main' }, stage, h('div', { class: 'ed-dock' }, ctxEl)), dockEl));

    cv.addEventListener('pointerdown', onCanvasDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', cancelPress);
    cv.addEventListener('pointerleave', () => { if (!st.press) st.hover = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', onKey);
    if (ro) ro.disconnect();
    ro = new ResizeObserver(fit);
    ro.observe(stage);
    renderAll();
    requestAnimationFrame(() => { fit(); loop(); });
  }

  // 弹窗关闭后由 SA.UI.refresh 调用：钱、库存可能变了
  function refresh() {
    if (!cv || !cv.isConnected) return;
    st.stats = SA.V.stats(veh());
    renderAll();
  }

  function onKey(e) {
    if (SA.current !== 'garage' || !document.querySelector('#modal').hidden) return;
    if (e.target.matches && e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') { st.sel = null; st.pick = null; st.bp = null; cancelPress(); renderDock(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && st.pick) { e.preventDefault(); removeAt(st.pick); }
  }

  function fit() {
    if (!cv || !stage.isConnected) return;
    const aw = stage.clientWidth - 16, ah = stage.clientHeight - 16;
    let s = Math.min(aw / W, ah / H);
    s = s >= 1 ? Math.floor(s * 4) / 4 : Math.max(0.3, s);
    cv.style.width = `${Math.round(W * s)}px`;
    cv.style.height = `${Math.round(H * s)}px`;
  }

  function cellAtXY(x0, y0) {
    const rc = cv.getBoundingClientRect();
    if (x0 < rc.left || x0 > rc.right || y0 < rc.top || y0 > rc.bottom) return null;
    const x = (x0 - rc.left) / rc.width * W, y = (y0 - rc.top) / rc.height * H;
    const c = Math.floor((x - PADX) / C), r = Math.floor(y / C);
    return r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS ? { r, c } : null;
  }
  const overCanvas = (x, y) => { const rc = cv.getBoundingClientRect(); return x >= rc.left && x <= rc.right && y >= rc.top && y <= rc.bottom; };

  function say(text, err) { st.msg = { text, err: !!err, at: performance.now() }; }

  // ---------- 指针：点击 / 拖动 ----------
  function onCanvasDown(e) {
    e.preventDefault();
    const cell = cellAtXY(e.clientX, e.clientY);
    st.hover = cell;
    if (!cell) { if (st.pick) { st.pick = null; renderDock(); } return; }
    const v = veh();
    if (e.button === 2) {
      const layer = v[st.layer][cell.r][cell.c] ? st.layer : v.body[cell.r][cell.c] ? 'body' : null;
      if (layer) removeAt({ layer, ...cell });
      return;
    }
    if (st.sel) { placeAt(st.sel, cell); return; }
    const here = v[st.layer][cell.r][cell.c];
    if (here) { beginPress(e, { kind: 'cell', layer: st.layer, r: cell.r, c: cell.c, id: here.id }); return; }
    // 空格子：已选中车上的模块 → 移过来
    if (st.pick) moveTo(st.pick, cell);
    else if (st.layer === 'side' && v.body[cell.r][cell.c]) say('侧挂层这里没有侧炮。切回「主体层」才能选中主体模块');
  }

  function beginPress(e, src) {
    st.press = { src, x: e.clientX, y: e.clientY, pid: e.pointerId, el: e.currentTarget };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onMove(e) {
    const p = st.press;
    if (!p || p.pid !== e.pointerId) {
      if (e.currentTarget === cv) st.hover = cellAtXY(e.clientX, e.clientY);
      return;
    }
    if (!st.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_PX) {
      st.drag = p.src;
      makeGhost(p.src.id);
    }
    if (st.drag) {
      st.hover = cellAtXY(e.clientX, e.clientY);
      moveGhost(e.clientX, e.clientY);
      dockEl.classList.toggle('drop', st.drag.kind === 'cell' && !overCanvas(e.clientX, e.clientY));
    }
  }

  function onUp(e) {
    const p = st.press;
    if (!p || p.pid !== e.pointerId) return;
    const src = p.src, drag = st.drag;
    const target = cellAtXY(e.clientX, e.clientY);
    const inside = overCanvas(e.clientX, e.clientY);
    cancelPress();
    if (!drag) { if (src.kind === 'cell') tapCell(src); return; }
    st.noClick = true;   // 拖完松手不再触发库存按钮的 click
    setTimeout(() => { st.noClick = false; }, 0);
    st.hover = target;
    if (src.kind === 'inv') { if (target) placeAt(src.id, target); return; }
    if (target) moveTo(src, target);
    else if (!inside) removeAt(src);
  }

  function cancelPress() {
    if (st.press && st.press.el) try { st.press.el.releasePointerCapture(st.press.pid); } catch (err) { /* ignore */ }
    st.press = null; st.drag = null;
    dropGhost();
    if (dockEl) dockEl.classList.remove('drop');
  }

  function makeGhost(id) {
    dropGhost();
    const s = cv.getBoundingClientRect().width / W;
    const img = SA.SPR.moduleCanvas(id, s);
    ghost = h('div', { class: 'ed-ghost' }, img);
    ghost._off = (C / 2 + 2) * s;
    document.body.append(ghost);
  }
  function moveGhost(x, y) { if (ghost) ghost.style.transform = `translate(${x - ghost._off}px, ${y - ghost._off}px)`; }
  function dropGhost() { if (ghost) ghost.remove(); ghost = null; }

  // ---------- 操作 ----------
  function tapCell(src) {
    const same = st.pick && st.pick.layer === src.layer && st.pick.r === src.r && st.pick.c === src.c;
    st.pick = same ? null : { layer: src.layer, r: src.r, c: src.c };
    st.sel = null;
    renderDock();
  }

  function changed() {
    st.stats = SA.V.stats(veh());
    SA.S.save();
    SA.UI.topbar();
    renderAll();
  }

  // 拆下来的模块：完好的回库存，报废的按原价 10% 回收；改装件拆掉按一半折价回收
  function stash(cell) {
    let back = 0;
    for (let k = 1; k <= (cell.lv || 0); k++) back += Math.round(SA.upCost(cell.id, k) * 0.5);
    if (cell.hp <= 0) back += Math.round(M[cell.id].price * 0.1);
    else SA.S.addInv(cell.id, 1);
    d().money += back;
    return back;
  }

  // 改装：炮盾 / 附加装甲，每级加耐久和重量
  function upgrade(cell) {
    const lv = (cell.lv || 0) + 1, cost = SA.upCost(cell.id, lv), name = SA.upName(cell.id);
    SA.UI.pay({ title: `改装 · ${name}`, amount: cost, okLabel: `装上${name}`,
      lines: [h('p', { style: 'margin-top:0' }, `${M[cell.id].name} 升到 ${lv} 级：耐久 +${Math.round(SA.upHp(cell.id) * 100)}%（按原耐久算），重量 +${SA.K.UP_KG} kg。`),
        h('p', { class: 'muted' }, '纯属性升级，不占格子。拆下模块时改装件按一半价格回收。')],
      onPaid: () => {
        const before = SA.V.maxHp(cell);
        cell.lv = lv;
        if (cell.hp > 0) cell.hp += SA.V.maxHp(cell) - before;
        st.pick = null;
        say(`${M[cell.id].name} 装上${name}，${'▲'.repeat(lv)}`);
        changed();
      } });
  }

  // 库存不够就问要不要买（钱不够再问要不要贷款）
  function withStock(id, then) {
    if (d().inv[id] > 0) { then(); return; }
    const m = M[id];
    SA.UI.pay({
      title: `购买 ${m.name}`, amount: m.price, okLabel: '购买并安装',
      lines: [h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(id, 1), h('div', {}, h('b', {}, m.name), h('div', { class: 'muted' }, SA.UI.statLine(id))))],
      onPaid: () => { SA.S.addInv(id, 1); then(); },
    });
  }

  function placeAt(id, { r, c }) {
    const v = veh(), layer = SA.V.layerOf(id), m = M[id];
    if (st.layer !== layer) st.layer = layer;
    const cur = v[layer][r][c];
    if (cur && cur.id === id) { removeAt({ layer, r, c }); return; }   // 同款再点一次 = 拆下
    if (cur && hurt(cur)) { say(`${M[cur.id].name} 受损，先修理才能替换`, true); st.pick = { layer, r, c }; st.sel = null; renderDock(); return; }
    withStock(id, () => {
      const old = v[layer][r][c];
      let scrap = 0;
      if (old) { v[layer][r][c] = null; scrap = stash(old); }
      SA.V.put(v, id, r, c);
      SA.S.addInv(id, -1);
      st.sel = null; st.pick = null;   // 放置完成即取消选中
      const iss = SA.V.issues(v).find(x => x.layer === layer && x.r === r && x.c === c);
      const tail = iss ? `（${iss.reason}，出战前要接好）` : '';
      say(old ? `${M[old.id].name} → ${m.name}${scrap ? `，损毁件 / 改装件回收 ${money(scrap)}` : ''}${tail}` : `装上 ${m.name}${tail}`, !!iss);
      changed();
    });
  }

  function removeAt({ layer, r, c }) {
    const res = SA.V.remove(veh(), layer, r, c);
    if (!res.ok) { say(res.reason, true); return; }
    let scrap = 0;
    for (const cell of res.removed) scrap += stash(cell);
    say(`拆下 ${res.removed.map(x => M[x.id].name).join('、')}，已放回库存${scrap ? `；损毁件 / 改装件回收 ${money(scrap)}` : ''}`);
    st.pick = null;
    changed();
  }

  function moveTo(from, to) {
    const v = veh();
    const res = SA.V.move(v, from.layer, from.r, from.c, to.r, to.c);
    if (!res.ok) { if (res.reason) say(res.reason, true); return; }
    say(res.swapped ? `对调：${M[v[from.layer][to.r][to.c].id].name} ⇄ ${M[v[from.layer][from.r][from.c].id].name}` : `移到${where(to.r, to.c)}`);
    st.pick = null;   // 移动完成即取消选中
    changed();
  }

  function repair(cells) {
    const cost = cells.reduce((a, x) => a + SA.S.repairCost(x), 0);
    SA.UI.pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false,
      onPaid: () => { for (const x of cells) x.hp = SA.V.maxHp(x); st.pick = null; say(`修好了，花费 ${money(cost)}`); changed(); } });
  }

  function buyOne(id) {
    const m = M[id];
    SA.UI.pay({ title: `购买 ${m.name}`, amount: m.price, okLabel: '购买',
      lines: [h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(id, 1), h('div', {}, h('b', {}, m.name), h('div', { class: 'muted' }, SA.UI.statLine(id))))],
      onPaid: () => { SA.S.addInv(id, 1); say(`购入 ${m.name}，库存 ${d().inv[id]}`); changed(); } });
  }

  function selectInv(id) {
    if (st.noClick) return;
    st.sel = st.sel === id ? null : id;
    st.pick = null;
    if (st.sel) st.layer = SA.V.layerOf(id);
    renderAll();
  }

  // ---------- 黄铜铭牌（画布左上角）：车名、评分、状态、一键修理；展开看性能条 ----------
  function damagedCells() {
    const out = [];
    SA.V.each(veh(), (cell) => { if (cell.hp < SA.V.maxHp(cell)) out.push(cell); });
    return out;
  }
  function renderPlate() {
    const s = st.stats;
    plateEl.innerHTML = '';
    plateEl.classList.toggle('closed', !st.plateOpen);
    const nameIn = h('input', { type: 'text', class: 'plate-name', value: veh().name, maxLength: 20, 'aria-label': '车名',
      onchange: () => { veh().name = nameIn.value.trim() || '原型机'; SA.S.save(); } });
    const bad = s.problems.length;
    const hurtList = damagedCells();
    const cost = hurtList.reduce((a, x) => a + SA.S.repairCost(x), 0);
    plateEl.append(...[
      h('div', { class: 'plate-head' }, nameIn,
        h('button', { class: 'plate-toggle', title: st.plateOpen ? '收起性能' : '展开性能', onclick: () => { st.plateOpen = !st.plateOpen; renderPlate(); } },
          h('span', { class: 'rating' }, `评分 ${s.rating}`),
          h('span', { class: `weight ${s.weight > s.load ? 'bad' : ''}`, title: `总重 / 底盘承重 ${SA.tons(s.load)}` }, SA.tons(s.weight)),
          h('span', { class: `flag ${bad ? 'bad' : ''}` }, bad ? `✗ ${bad} 项问题` : s.warnings.length ? `${s.warnings.length} 项提醒` : '✓ 可出战'),
          h('span', { class: 'fold' }, st.plateOpen ? '▴' : '▾'))),
      hurtList.length ? h('button', { class: 'btn small plate-fix', onclick: () => repair(hurtList) }, `修理 ${hurtList.length} 处受损 · ${money(cost)}`) : null,
      st.plateOpen ? h('div', { class: 'plate-body' }, SA.UI.statBars(s)) : null].filter(Boolean));
  }

  // 画布右上角：看哪一层 + 蓝图库开关（右侧面板在模块清单和蓝图库之间切换）
  function setDock(k) { st.dock = k; st.sel = null; st.pick = null; st.bp = null; renderAll(); }
  function renderView() {
    viewEl.innerHTML = '';
    const seg = (items, cur, set) => h('span', { class: 'seg' }, items.map(([k, n]) =>
      h('button', { class: `btn small ${cur === k ? 'on' : ''}`, onclick: () => { set(k); renderAll(); } }, n)));
    viewEl.append(
      seg([['body', '主体层'], ['side', '侧挂层']], st.layer, (k) => { st.layer = k; st.pick = null; if (st.sel && SA.V.layerOf(st.sel) !== k) st.sel = null; }),
      h('button', { class: `btn small bp-btn ${st.dock === 'bps' ? 'on' : ''}`, title: '蓝图库：保存 / 套用整车方案，云车库也在这里',
        onclick: () => setDock(st.dock === 'bps' ? 'mods' : 'bps') }, SA.SPR.iconCanvas('scroll', st.dock === 'bps' ? '#e4e0d6' : '#f5d77a', 2), '蓝图库'));
  }

  // ---------- 底部操作栏 ----------
  function thumb(id) { const cvs = SA.SPR.moduleCanvas(id, 0.75); cvs.classList.add('thumb'); return cvs; }

  function renderCtx() {
    ctxEl.innerHTML = '';
    const v = veh(), inv = d().inv;
    if (st.sel) {
      const id = st.sel, m = M[id], n = inv[id] || 0;
      ctxEl.append(thumb(id),
        h('div', { class: 'info' },
          h('div', {}, h('b', {}, m.name), ' ', h('span', { class: `q q${m.q}` }, SA.QUALITY[m.q].star), ' ',
            n ? h('span', { class: 'chip' }, `库存 ${n}`) : h('span', { class: 'chip buy' }, `无库存 · 放置时购买 ${money(m.price)}`)),
          h('div', { class: 'sub' }, n ? '点格子放置；点已有模块直接替换，点同款模块拆下' : '点格子即可购买并安装')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn small', onclick: () => buyOne(id) }, `买 ${money(m.price)}`),
          n ? h('button', { class: 'btn small', onclick: () => sellOne(id) }, `卖 ${money(m.price * 0.5)}`) : null,
          h('button', { class: 'btn small', title: 'Esc', onclick: () => { st.sel = null; renderAll(); } }, '取消')));
      return;
    }
    const pk = st.pick && v[st.pick.layer][st.pick.r][st.pick.c];
    if (pk) {
      const { layer, r, c } = st.pick, m = M[pk.id], max = SA.V.maxHp(pk);
      const iss = issueAt(layer, r, c);
      const fix = [pk, layer === 'body' && v.side[r][c]].filter(x => x && x.hp < SA.V.maxHp(x));
      const cost = fix.reduce((a, x) => a + SA.S.repairCost(x), 0);
      const lv = pk.lv || 0, upName = SA.upName(pk.id);
      ctxEl.append(thumb(pk.id),
        h('div', { class: 'info' },
          h('div', {}, h('b', {}, m.name), ' ', h('span', { class: 'chip' }, pk.hp <= 0 ? '已损毁' : `耐久 ${pk.hp}/${max}`), ' ',
            h('span', { class: `chip rank ${lv ? 'on' : ''}`, title: `${upName} ${lv}/${SA.K.UP_MAX} 级` }, `${upName} ${'▲'.repeat(lv)}${'△'.repeat(SA.K.UP_MAX - lv)}`), ' ',
            h('span', { class: 'muted' }, `${SA.tons(SA.weightOf(pk))} · ${where(r, c)}`)),
          iss ? h('div', { class: 'sub err' }, iss.reason) : h('div', { class: 'sub' }, '点空格子移动；拖到别的模块上对调；拖出车外放回库存')),
        h('div', { class: 'acts' },
          pk.hp > 0 && lv < SA.K.UP_MAX ? h('button', { class: 'btn small primary', title: `耐久 +${Math.round(SA.upHp(pk.id) * 100)}%，重量 +${SA.K.UP_KG} kg`, onclick: () => upgrade(pk) },
            `${upName} ${lv + 1} 级 · ${money(SA.upCost(pk.id, lv + 1))}`) : null,
          fix.length ? h('button', { class: 'btn small', onclick: () => repair(fix) }, `修理 ${money(cost)}`) : null,
          h('button', { class: 'btn small', title: 'Delete', onclick: () => removeAt(st.pick) }, pk.hp <= 0 ? `报废 +${money(M[pk.id].price * 0.1)}` : '拆下'),
          h('button', { class: 'btn small', title: 'Esc', onclick: () => { st.pick = null; renderDock(); } }, '取消')));
      return;
    }
    st.pick = null;
    if (st.dock === 'bps') { bpCtx(); return; }
    // 什么都没选：告诉玩家现在该做什么
    const s = st.stats;
    ctxEl.append(h('div', { class: 'info' },
      s.problems.length ? h('div', { class: 'err' }, s.problems[0]) : h('div', {}, h('b', {}, '车已就绪'), s.warnings.length ? h('span', { class: 'muted' }, ` · ${s.warnings[0]}`) : null),
      h('div', { class: 'sub' }, '从模块清单选一个，再点格子放置；拖动车上的模块可移动 / 对调，拖回清单就放回库存。')),
    s.canDeploy ? h('div', { class: 'acts' }, h('button', { class: 'btn small primary', onclick: () => SA.nav('arena') }, '去出战 →')) : '');
  }

  // ---------- 右侧面板：页签 + 「商店」开关 / 蓝图筛选 ----------
  function renderTools() {
    toolsEl.innerHTML = '';
    const title = (t, extra) => h('div', { class: 'panel-title' }, h('b', {}, t), extra);
    if (st.dock === 'bps') {
      toolsEl.append(title('蓝图库', h('button', { class: 'btn small', onclick: () => setDock('mods') }, '← 模块清单')),
        h('div', { class: 'panel-row' },
          h('div', { class: 'inv-tabs' }, [['all', '全部'], ['mine', '我的'], ['official', '官方'], ['cloud', '云端']].map(([k, n]) =>
            h('button', { class: `tab ${st.bpFilter === k ? 'on' : ''}`, onclick: () => { st.bpFilter = k; renderTools(); renderInv(); } }, n))),
          h('button', { class: 'btn small', onclick: importDialog }, '导入分享码')));
      return;
    }
    const owned = SA.MODULE_ORDER.reduce((a, id) => a + (d().inv[id] || 0), 0);
    toolsEl.append(title('模块清单', h('span', { class: 'muted' }, `库存 ${owned} 件`)),
      h('div', { class: 'panel-row' },
        h('span', { class: 'muted' }, st.shop ? '也列出没有库存的模块' : '只列出有库存的模块'),
        h('label', { class: `switch ${st.shop ? 'on' : ''}`, title: '打开后也列出没有库存的模块，放到车上即购买' },
          h('input', { type: 'checkbox', checked: st.shop, onchange: (e) => { st.shop = e.target.checked; renderTools(); renderInv(); } }),
          h('span', { class: 'knob' }), '商店')));
  }

  // 模块最关键的两三项数值，做成小标签
  function keyStats(id) {
    const m = M[id], out = [];
    if (m.layer === 'chassis') out.push(`承重 ${SA.tons(m.load)}`, `速度 ${m.speed}`, m.evade ? `闪避 +${Math.round(m.evade * 100)}%` : m.acc ? `命中 +${Math.round(m.acc * 100)}%` : `耐久 ${m.hp}`);
    else if (m.dmg) out.push(`伤害 ${m.dmg}`, `装填 ${m.reload}s`, m.indirect ? '高抛' : `散布 ±${m.spread}°`);
    else if (m.supply) out.push(`动力 +${m.supply}`, `产热 ${m.heatRate}/s`);
    else if (m.water) out.push(`冷却 ${m.cool}/s`, `水 ${m.water}`);
    else if (m.ram) out.push(`撞击 ${m.ram}`, m.punch ? `活塞 ${m.punch}` : `耐久 ${m.hp}`);
    else out.push(`耐久 ${m.hp}`);
    if (m.power) out.push(`动力 -${m.power}`);
    out.push(SA.tons(SA.weightOf({ id })));
    return out;
  }

  const CAT_ORDER = ['mobility', 'control', 'energy', 'cooling', 'structure', 'firepower', 'ram'];
  function renderInv() {
    const keep = invEl.scrollTop;
    invEl.innerHTML = '';
    if (st.dock === 'bps') { renderBps(); invEl.scrollTop = keep; return; }
    const inv = d().inv;
    let shown = 0;
    for (const cat of CAT_ORDER) {
      const ids = SA.MODULE_ORDER.filter(id => M[id].cat === cat && (st.shop || inv[id] > 0));
      if (!ids.length) continue;
      // 折叠条：齿轮 + 铆钉钢条 + 铜色描边；折起来齿轮转半圈
      const folded = st.fold.has(cat);
      const have = ids.reduce((a, id) => a + (inv[id] || 0), 0);
      invEl.append(h('button', { class: `grp cat-${cat} ${folded ? 'folded' : ''}`, 'aria-expanded': String(!folded),
        onclick: () => { if (folded) st.fold.delete(cat); else st.fold.add(cat); saveFold(); renderInv(); } },
        h('span', { class: 'gear l' }, SA.SPR.iconCanvas('gear', '#c8834a', 3)),
        h('i', { style: `background:${SA.CAT[cat].plate}` }),
        h('span', { class: 'gname' }, SA.CAT[cat].name),
        h('span', { class: 'gcnt' }, st.shop ? `${ids.length} 种` : `${have} 件`),
        h('span', { class: 'gear r' }, SA.SPR.iconCanvas('gear', '#c8834a', 3))));
      if (folded) { shown += ids.length; continue; }
      for (const id of ids) {
        shown++;
        const m = M[id], n = inv[id] || 0;
        const row = h('button', { class: `mrow cat-${m.cat} ${st.sel === id ? 'sel' : ''} ${n ? '' : 'unowned'}`,
          title: `${m.desc}\n${SA.UI.statLine(id)}`, onclick: () => selectInv(id) },
        h('span', { class: 'pic' }, SA.SPR.moduleCanvas(id, 1)),
        h('span', { class: 'mid' },
          h('span', { class: 'nm' }, m.name, ' ', h('span', { class: `q q${m.q}` }, SA.QUALITY[m.q].star)),
          h('span', { class: 'ks' }, keyStats(id).map(t => h('span', {}, t)))),
        n ? h('span', { class: 'cnt' }, h('b', {}, `×${n}`), h('small', {}, '库存'))
          : h('span', { class: 'cnt buy' }, h('b', {}, money(m.price)), h('small', {}, '购买')));
        row.addEventListener('pointerdown', (e) => { if (e.button === 0) beginPress(e, { kind: 'inv', id }); });
        row.addEventListener('pointermove', onMove);
        row.addEventListener('pointerup', onUp);
        row.addEventListener('pointercancel', cancelPress);
        invEl.append(row);
      }
    }
    if (!shown) invEl.append(h('div', { class: 'empty' },
      h('b', {}, '库存是空的'),
      h('span', { class: 'muted' }, '车上的模块拖到这里会放回库存。想买新模块，打开「商店」。'),
      h('button', { class: 'btn primary', onclick: () => { st.shop = true; renderTools(); renderInv(); } }, '打开商店')));
    else if (st.shop) invEl.prepend(h('div', { class: 'shop-note' }, '商店已打开：选中没有库存的模块，放到车上就自动购买。'));
    invEl.scrollTop = keep;
  }

  function renderDock() { renderCtx(); renderInv(); }
  function renderAll() { renderPlate(); renderView(); renderCtx(); renderTools(); renderInv(); }

  // ---------- 蓝图库 · 云车库（底部操作栏的第二个页签）----------
  const KIND = { mine: '我的', official: '官方', cloud: '云端' };
  function bpList() { return SA.Blueprints.all().filter(b => st.bpFilter === 'all' || b.kind === st.bpFilter); }
  function bpPic(bp, scale) {
    const cvs = SA.UI.vehiclePreview(SA.V.fromLayout(bp.name, bp), scale);
    cvs.classList.add('bp-pic');
    return cvs;
  }

  function renderBps() {
    const nextName = `${veh().name} 方案 ${SA.Blueprints.mine().length + 1}`;
    invEl.append(h('button', { class: 'bprow add', title: '把当前车辆存成一张蓝图', onclick: () => {
      SA.Blueprints.save(nextName);
      st.bpFilter = st.bpFilter === 'official' || st.bpFilter === 'cloud' ? 'all' : st.bpFilter;
      st.bp = SA.Blueprints.all().find(b => b.kind === 'mine').key;
      say(`已存为蓝图「${nextName}」`);
      renderAll();
    } }, h('span', { class: 'plus' }, '＋'), h('span', { class: 'mid' }, h('span', { class: 'nm' }, '存为蓝图'), h('span', { class: 'muted' }, '把当前车辆存一份，随时一键换回来'))));
    for (const bp of bpList()) {
      const p = SA.Blueprints.plan(bp);
      invEl.append(h('button', { class: `bprow ${st.bp === bp.key ? 'sel' : ''}`, title: bp.desc || bp.name,
        onclick: () => { st.bp = st.bp === bp.key ? null : bp.key; renderDock(); } },
      bpPic(bp, 1),
      h('span', { class: 'mid' },
        h('span', { class: 'nm' }, bp.name),
        h('span', { class: 'ks' }, h('span', { class: `kind-${bp.kind}` }, bp.kind === 'cloud' ? `云端 · ${bp.author}` : KIND[bp.kind]),
          h('span', { class: p.cost ? 'gold' : '' }, p.cost ? `需 ${money(p.cost)}` : '库存够用')))));
    }
  }

  function bpCtx() {
    const bp = st.bp && SA.Blueprints.all().find(b => b.key === st.bp);
    if (!bp) {
      ctxEl.append(h('div', { class: 'info' },
        h('div', {}, h('b', {}, '蓝图库 · 云车库')),
        h('div', { class: 'sub' }, '在右边选一张蓝图一键换装（车上的模块先拆回库存，缺的按原价补买）。「存为蓝图」保存当前车辆；「导入分享码」把别人的车存进来。')));
      return;
    }
    const v = SA.V.fromLayout(bp.name, bp), s = SA.V.stats(v), p = SA.Blueprints.plan(bp);
    const done = () => { st.bp = null; st.stats = SA.V.stats(veh()); changed(); };
    const nameIn = bp.kind === 'mine' ? h('input', { type: 'text', class: 'bp-name', value: bp.name, maxLength: 20, 'aria-label': '蓝图名称',
      onchange: () => { SA.Blueprints.rename(bp.index, nameIn.value.trim() || bp.name); renderInv(); } }) : h('b', {}, bp.name);
    let armed = false;
    const del = bp.kind === 'mine' ? h('button', { class: 'btn small', onclick: () => {
      if (!armed) { armed = true; del.textContent = '确认删除？'; del.classList.add('danger'); return; }
      SA.Blueprints.del(bp.index); st.bp = null; say('蓝图已删除'); renderAll();
    } }, '删除') : null;
    ctxEl.append(bpPic(bp, 0.5),
      h('div', { class: 'info' },
        h('div', {}, nameIn, ' ', h('span', { class: `chip kind-${bp.kind}` }, bp.kind === 'cloud' ? `云端 · ${bp.author}` : KIND[bp.kind]), ' ', h('span', { class: 'chip' }, `评分 ${s.rating}`)),
        h('div', { class: `sub ${s.canDeploy ? '' : 'err'}` }, bp.desc || (s.canDeploy ? '可以直接出战' : s.problems[0]))),
      h('div', { class: 'acts' },
        h('button', { class: 'btn small primary', onclick: () => SA.Blueprints.apply(bp, done) }, p.cost ? `应用 · ${money(p.cost)}` : '应用'),
        bp.kind === 'mine' ? h('button', { class: 'btn small', title: '用当前车辆覆盖这张蓝图', onclick: () => { SA.Blueprints.overwrite(bp.index); say('已用当前车辆覆盖'); renderAll(); } }, '覆盖') : null,
        bp.kind !== 'official' ? h('button', { class: 'btn small', title: '复制分享码；自己的蓝图会同时上传到云车库', onclick: () => {
          const code = bp.kind === 'mine' ? SA.Blueprints.share(bp) : bp.code;
          if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
          say(bp.kind === 'mine' ? '已上传云车库，分享码已复制' : '分享码已复制');
          if (bp.kind === 'mine') renderInv();
        } }, bp.kind === 'mine' ? '分享' : '复制码') : null,
        del));
  }

  function importDialog() {
    const box = h('textarea', { rows: 3, placeholder: '粘贴 SA1. 开头的分享码' });
    SA.UI.dialog('导入分享码', [h('p', { class: 'muted', style: 'margin-top:0' }, '导入的车会存成你自己的蓝图，可以直接应用；想和它打一场，去「出战 → 友谊赛」。'), box],
      [{ label: '导入', primary: true, onClick: () => {
        const v = SA.Blueprints.importCode(box.value);
        if (!v) { SA.UI.toast('分享码无效'); return; }
        st.dock = 'bps'; st.bpFilter = 'mine'; st.bp = SA.Blueprints.all()[0].key;
        say(`已导入「${v.name}」`); renderAll();
      } }]);
    setTimeout(() => box.focus(), 0);
  }

  function sellOne(id) {
    const x = Math.round(M[id].price * 0.5);
    d().money += x; SA.S.addInv(id, -1);
    if (!d().inv[id]) st.sel = null;
    say(`卖出 ${M[id].name}，进账 ${money(x)}`);
    changed();
  }

  // 「?」：图例 + 规则，合在一个地方
  function openHelp() {
    const H = (t) => h('h3', { class: 'help-h' }, t);
    SA.UI.openModal('图例与规则', h('div', { class: 'help' },
      H('模块图例'),
      h('div', { class: 'help-cats' }, Object.entries(SA.CAT).map(([k, c]) => h('div', { class: `help-cat cat-${k}` },
        h('b', {}, h('i', { style: `background:${c.plate}` }), c.name),
        h('div', { class: 'help-mods' }, SA.MODULE_ORDER.filter(id => M[id].cat === k).map(id => h('span', {}, SA.SPR.moduleCanvas(id, 0.6), M[id].name)))))),
      H('车间里的颜色'),
      h('p', {}, h('b', { style: 'color:var(--gauge2)' }, '绿色闪烁'), ' 选中 / 可以放 · ', h('b', { style: 'color:#ff3b2f' }, '红色闪烁'), ' 悬空、不合规或不能放 · 空格上的淡绿 = 能稳稳装上的位置'),
      H('操作'),
      h('p', {}, '从模块清单选一个再点格子放置（也可以直接拖上去）；点已有模块直接替换（换下的回库存），点同款模块拆下。点车上的模块选中它（修理 / 拆下）；拖动可移动或对调，拖回清单放回库存。打开「商店」开关能看到没有库存的模块，放置时自动购买，钱不够会问要不要贷款。右键 拆下 · Esc 取消 · Delete 拆下选中。'),
      H('摆放规则'),
      h('p', {}, '重量：每个模块都有重量（基础 250 kg + 自身重量），总重不能超过底盘承重；车越重，行驶要的动力越多、加速越慢，撞击却越狠（撞击面自己也会受伤）。改装：选中车上的模块可以加炮盾 / 附加装甲，每级加耐久也加重量，鼠标停在模块上能看到军衔杠。'),
      h('p', {}, '改装台上可以随便摆、暂时悬空，但出战前所有模块都要一路连到底盘。底盘只能放最底行，其他模块叠在底盘或模块上，最高 6 层。直射火炮、机枪同一行前方不能有己方模块，高抛火炮不受影响。撞击武器（铲斗装在底盘前，撞角 / 撞锤装在装甲前）必须是这一行最前端。侧炮挂在侧挂层的任意主体模块上，不会被己方挡住但命中率低。'),
      H('战斗里的颜色'),
      h('p', {}, h('b', {}, '白框'), ' 准星对准的模块 · ', h('b', { style: 'color:var(--magenta)' }, '洋红'), ' 准星对准的侧炮 · 虚线框 = 炮弹会先打中的模块 · ', h('b', { style: 'color:var(--fire2)' }, '橙'), ' 热量 · ', h('b', { style: 'color:var(--water2)' }, '青'), ' 水 · ', h('b', { style: 'color:var(--gauge2)' }, '绿'), ' 动力 · ', h('b', { style: 'color:var(--brass2)' }, '黄铜'), ' 火力。准星旁的小沙漏 = 装填进度。'),
    ));
  }

  // ---------- 绘制 ----------
  // 状态提示：整格缓慢闪烁的颜色（红 = 不可用/悬空，绿 = 选中/可放置），不再描边
  const RED = '#ff3b2f', GREEN = '#6fcf6a', WHITE = '#ffffff';
  const pulse = (t, lo, hi, per = 1.6) => lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / per));
  const tmp = document.createElement('canvas');
  tmp.width = C; tmp.height = C;
  const tg = tmp.getContext('2d');
  // 把 paint(tg) 画出来的像素整体染色后叠到画布上（只染模块本身，不染背景）
  function tint(paint, x, y, color, a) {
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, C, C);
    paint(tg);
    tg.globalCompositeOperation = 'source-atop';
    tg.fillStyle = color;
    tg.fillRect(0, 0, C, C);
    g.globalAlpha = a;
    g.drawImage(tmp, x, y);
    g.globalAlpha = 1;
  }
  const fromVeh = (vc, x, y) => (c2d) => c2d.drawImage(vc, x, y, C, C, 0, 0, C, C);
  const fromModule = (id, t) => (c2d) => SA.SPR.drawModule(c2d, id, 0, 0, { t, heat: 0.3, water: 1 });
  function fillCell(x, y, color, a) {
    g.globalAlpha = a; g.fillStyle = color; g.fillRect(x + 1, y + 1, C - 1, C - 1); g.globalAlpha = 1;
  }
  function cross(x, y) {
    SA.SPR.useCtx(g);
    const a = Math.round(C * 0.3), b = Math.round(C * 0.7);
    SA.SPR.line(x + a, y + a, x + b, y + b, 5, P.black);
    SA.SPR.line(x + b, y + a, x + a, y + b, 5, P.black);
    SA.SPR.line(x + a, y + a, x + b, y + b, 3, P.white);
    SA.SPR.line(x + b, y + a, x + a, y + b, 3, P.white);
  }

  // 拖动到某格后，那一格会不会悬空（按悬停格缓存，避免每帧克隆）
  let dropMemo = { key: '', bad: false };
  function dropBad(drag, hv) {
    const key = `${drag.layer}${drag.r}${drag.c}>${hv.r}${hv.c}`;
    if (dropMemo.key !== key) {
      const v = SA.V.clone(veh());
      SA.V.move(v, drag.layer, drag.r, drag.c, hv.r, hv.c);
      dropMemo = { key, bad: SA.V.issues(v).some(x => x.r === hv.r && x.c === hv.c) };
    }
    return dropMemo.bad;
  }

  function tipText() {
    const v = veh(), hv = st.hover, now = performance.now();
    if (st.drag && st.drag.kind === 'cell' && !hv) return { text: `松手：拆下 ${M[st.drag.id].name}，放回库存` };
    if (st.msg && now - st.msg.at < 2600) return st.msg;
    if (!hv) return st.msg && now - st.msg.at < 5000 ? st.msg : null;
    const id = st.drag ? st.drag.id : st.sel;
    if (id) {
      const layer = SA.V.layerOf(id), cur = v[layer][hv.r][hv.c];
      if (st.drag && st.drag.kind === 'cell') {
        if (st.drag.r === hv.r && st.drag.c === hv.c) return { text: '放回原处' };
        return { text: cur ? `对调 ${M[st.drag.id].name} ⇄ ${M[cur.id].name}` : `移到${where(hv.r, hv.c)}` };
      }
      const buy = d().inv[id] > 0 ? '' : `购买（${money(M[id].price)}）并`;
      if (cur && cur.id === id) return { text: `再点一次：拆下 ${M[id].name}` };
      if (cur && hurt(cur)) return { text: `${M[cur.id].name} 受损，先修理才能替换`, err: true };
      if (cur) return { text: `${buy}替换 ${M[cur.id].name} → ${M[id].name}` };
      const chk = SA.V.canPlace(v, id, hv.r, hv.c);
      return chk.ok ? { text: `${buy}放置 ${M[id].name}：${where(hv.r, hv.c)}` } : { text: `${buy}放置 ${M[id].name}（会悬空：${chk.reason}）`, err: true };
    }
    const side = v.side[hv.r][hv.c], body = v.body[hv.r][hv.c];
    const cell = (st.layer === 'side' && side) || body || side;
    if (!cell) return { text: `${where(hv.r, hv.c)} · 空` };
    const m = M[cell.id], layer = cell === side ? 'side' : 'body';
    const iss = issueAt(layer, hv.r, hv.c);
    if (iss) return { text: `${m.name}：${iss.reason}`, err: true };
    const up = cell.lv ? ` · ${SA.upName(cell.id)} ${cell.lv} 级` : '';
    return { text: `${m.name}（${SA.CAT[m.cat].name}）· 耐久 ${Math.max(0, cell.hp)}/${SA.V.maxHp(cell)}${up} · ${SA.tons(SA.weightOf(cell))} · ${SA.UI.statLine(cell.id).split(' · ').slice(1).join(' · ')}` };
  }

  function draw(t) {
    const v = veh();
    g.fillStyle = P.bg[2];
    g.fillRect(0, 0, W, H);
    g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
    g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
    g.fillStyle = P.bg[1];
    for (let c = 0; c <= K.COLS; c++) g.fillRect(PADX + c * C, 0, 1, K.ROWS * C);
    for (let r = 0; r <= K.ROWS; r++) g.fillRect(PADX, r * C, K.COLS * C, 1);
    g.fillStyle = 'rgba(111,207,106,0.06)';
    for (let c = 0; c < K.COLS; c++) if (v.body[K.ROWS - 1][c]) g.fillRect(PADX + c * C, 0, C, K.ROWS * C);
    const drag = st.drag && st.drag.kind === 'cell' ? st.drag : null;
    const vc = SA.SPR.renderVehicle(v, {
      key: 'editor', t, heat: 0.35, water: 1, showWrecks: true, showBlocked: true,
      blocked: st.stats.blocked, dimBody: st.layer === 'side', dimCell: drag && drag.layer === 'body' ? drag : null,
    });
    g.drawImage(vc, 0, 0);

    const cellXY = (r, c) => [PADX + c * C, r * C];

    // 悬空 / 不合规：整格红色闪烁 + 感叹号
    for (const x of st.stats.issues) {
      const [px, py] = cellXY(x.r, x.c);
      tint(fromVeh(vc, px, py), px, py, RED, pulse(t, 0.2, 0.65));
      SA.SPR.text(g, '!', px + C - 8, py + 5, RED, 2);
    }

    const hv = st.hover;
    const id = drag ? drag.id : st.sel;
    if (id) {
      // 能稳稳装上的空格：淡淡的绿色呼吸
      if (!drag) for (let r = 0; r < K.ROWS; r++)
        for (let c = 0; c < K.COLS; c++)
          if (SA.V.canPlace(v, id, r, c).ok) fillCell(...cellXY(r, c), GREEN, pulse(t, 0.06, 0.2, 2));
      if (hv) {
        const [x, y] = cellXY(hv.r, hv.c);
        const cur = v[SA.V.layerOf(id)][hv.r][hv.c];
        const home = drag && drag.r === hv.r && drag.c === hv.c;
        if (!drag && cur && cur.id === id) {           // 同款：再点一次拆下
          tint(fromVeh(vc, x, y), x, y, RED, pulse(t, 0.3, 0.7, 1));
          cross(x, y);
        } else if (!home) {
          const bad = drag ? dropBad(drag, hv) : (cur ? hurt(cur) : !SA.V.canPlace(v, id, hv.r, hv.c).ok);
          if (cur) { g.fillStyle = 'rgba(7,8,12,0.6)'; g.fillRect(x, y, C, C); }
          g.globalAlpha = 0.8;
          SA.SPR.drawModule(g, id, x, y, { t, heat: 0.3, water: 1 });
          g.globalAlpha = 1;
          tint(fromModule(id, t), x, y, bad ? RED : GREEN, pulse(t, 0.3, 0.6, 1));
        }
      }
    } else if (hv && v[st.layer][hv.r][hv.c]) {
      const [x, y] = cellXY(hv.r, hv.c);
      tint(fromVeh(vc, x, y), x, y, WHITE, 0.18);
    }
    // 选中：整格绿色闪烁
    if (st.pick && !drag) {
      const [x, y] = cellXY(st.pick.r, st.pick.c);
      tint(fromVeh(vc, x, y), x, y, GREEN, pulse(t, 0.25, 0.6));
    }
    // 鼠标停在模块上（或选中它）：显示改装军衔杠
    const rankAt = (p) => { const cell = p && (v[p.layer || st.layer][p.r][p.c] || v.body[p.r][p.c]); if (cell) SA.SPR.chevrons(g, ...cellXY(p.r, p.c), cell.lv || 0, K.UP_MAX); };
    if (!drag && !st.sel) { if (hv) rankAt(hv); if (st.pick && !(hv && hv.r === st.pick.r && hv.c === st.pick.c)) rankAt(st.pick); }

    const tip = tipText();
    const text = tip ? tip.text : '';
    if (tipEl._t !== text) { tipEl._t = text; tipEl.textContent = text; tipEl.hidden = !text; }
    tipEl.classList.toggle('err', !!(tip && tip.err));
  }

  function loop() {
    if (SA.current !== 'garage') return;
    draw(performance.now() / 1000);
    requestAnimationFrame(loop);
  }

  return { open, refresh };
})();
