// 改装：格子编辑器（主体层 / 侧挂层，像素 / 蓝图视图）
// 操作集中在底部操作栏：选模块 → 点格子放置；点已有模块直接替换，再点一次同款模块就拆下。
// 车上的模块可以拖动（空格 = 移动，有模块 = 对调），拖出车外放回库存。
// 改装台上允许悬空、乱放；只有出战时才要求所有模块都连到底盘（SA.V.issues）。
window.SA = window.SA || {};

SA.Editor = (() => {
  const h = SA.h, K = SA.K, M = SA.MODULES, P = SA.PAL;
  const PADX = SA.SPR.PADX, C = K.CELL;
  const W = K.COLS * C + PADX * 2, H = K.ROWS * C + 12;
  const TABS = [['all', '全部'], ['mobility', '底盘'], ['firepower', '火力'], ['ram', '撞击'], ['structure', '结构'], ['energy', '能源'], ['cooling', '冷却'], ['control', '控制']];
  const DRAG_PX = 6;
  // sel：从库存选中、准备放置的模块 id；pick：车上选中的格子 { layer, r, c }
  const st = { layer: 'body', view: 'pixel', sel: null, pick: null, hover: null, stats: null, tab: 'all', plateOpen: null, press: null, drag: null, msg: null, noClick: false };
  let cv, g, stage, tipEl, headEl, ctxEl, toolsEl, invEl, dockEl, plateEl, ghost, ro;

  const d = () => SA.S.d;
  const veh = () => d().vehicle;
  const money = (n) => SA.UI.money(n);
  const hurt = (cell) => cell && cell.hp > 0 && cell.hp < SA.V.maxHp(cell);
  const where = (r, c) => `第 ${K.ROWS - r} 层 第 ${c + 1} 列`;
  const issueAt = (layer, r, c) => st.stats.issues.find(x => x.layer === layer && x.r === r && x.c === c);

  function open() {
    SA.go('editor');
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    Object.assign(st, { sel: null, pick: null, hover: null, press: null, drag: null, msg: null });
    if (st.plateOpen == null) st.plateOpen = window.innerWidth >= 1100;
    st.stats = SA.V.stats(veh());

    cv = h('canvas', { class: 'px', width: W, height: H });
    g = cv.getContext('2d');
    tipEl = h('div', { class: 'ed-tip' });
    plateEl = h('div', { class: 'brass-plate' });
    stage = h('div', { class: 'ed-stage' }, cv, plateEl, tipEl);
    headEl = h('div', { class: 'ed-head' });
    ctxEl = h('div', { class: 'dock-ctx' });
    toolsEl = h('div', { class: 'dock-tools' });
    invEl = h('div', { class: 'dock-inv' });
    dockEl = h('div', { class: 'ed-dock' }, h('div', { class: 'dock-inner' }, ctxEl, toolsEl, invEl));
    screen.append(h('div', { class: 'ed' }, headEl, stage, dockEl));

    cv.addEventListener('pointerdown', onCanvasDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', cancelPress);
    cv.addEventListener('pointerleave', () => { if (!st.press) st.hover = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // 桌面端：滚轮横向滚动库存条
    invEl.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { invEl.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('keydown', onKey);
    ro = new ResizeObserver(fit);
    ro.observe(stage);
    renderAll();
    requestAnimationFrame(() => { fit(); loop(); });
  }

  function close(next) {
    document.removeEventListener('keydown', onKey);
    if (ro) ro.disconnect();
    dropGhost();
    SA.S.save();
    SA.go('workshop');
    if (next) next();
  }

  function onKey(e) {
    if (SA.current !== 'editor' || !document.querySelector('#modal').hidden) return;
    if (e.target.matches && e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') { st.sel = null; st.pick = null; cancelPress(); renderDock(); }
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

  // 拆下来的模块：完好的回库存，报废的按原价 10% 回收
  function stash(cell) {
    if (cell.hp <= 0) { const x = Math.round(M[cell.id].price * 0.1); d().money += x; return x; }
    SA.S.addInv(cell.id, 1);
    return 0;
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
      const iss = SA.V.issues(v).find(x => x.layer === layer && x.r === r && x.c === c);
      const tail = iss ? `（${iss.reason}，出战前要接好）` : '';
      say(old ? `${M[old.id].name} → ${m.name}${scrap ? `，损毁件回收 ${money(scrap)}` : ''}${tail}` : `装上 ${m.name}${tail}`, !!iss);
      changed();
    });
  }

  function removeAt({ layer, r, c }) {
    const res = SA.V.remove(veh(), layer, r, c);
    if (!res.ok) { say(res.reason, true); return; }
    let scrap = 0;
    for (const cell of res.removed) scrap += stash(cell);
    say(`拆下 ${res.removed.map(x => M[x.id].name).join('、')}${scrap ? `，损毁件回收 ${money(scrap)}` : '，已放回库存'}`);
    if (st.pick && st.pick.layer === layer && st.pick.r === r && st.pick.c === c) st.pick = null;
    changed();
  }

  function moveTo(from, to) {
    const v = veh();
    const res = SA.V.move(v, from.layer, from.r, from.c, to.r, to.c);
    if (!res.ok) { if (res.reason) say(res.reason, true); return; }
    say(res.swapped ? `对调：${M[v[from.layer][to.r][to.c].id].name} ⇄ ${M[v[from.layer][from.r][from.c].id].name}` : `移到${where(to.r, to.c)}`);
    st.pick = { layer: from.layer, r: to.r, c: to.c };
    changed();
  }

  function repair(cells) {
    const cost = cells.reduce((a, x) => a + SA.S.repairCost(x), 0);
    SA.UI.pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false,
      onPaid: () => { for (const x of cells) x.hp = SA.V.maxHp(x); say(`修好了，花费 ${money(cost)}`); changed(); } });
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

  // ---------- 顶部：返回、车名、状态、出战 ----------
  function renderHead() {
    const s = st.stats;
    headEl.innerHTML = '';
    const nameIn = h('input', { type: 'text', value: veh().name, maxLength: 20, 'aria-label': '车名',
      onchange: () => { veh().name = nameIn.value.trim() || '原型机'; SA.S.save(); } });
    const bad = s.problems.length;
    headEl.append(
      h('button', { class: 'btn small back', title: '返回工坊', onclick: () => close() }, SA.SPR.iconCanvas('back', P.text || '#e4e0d6', 2), h('span', { class: 'wide-only' }, '工坊')),
      nameIn,
      h('button', { class: `status ${bad ? 'bad' : 'ok'}`, title: '展开/收起性能铭牌', onclick: () => { st.plateOpen = !st.plateOpen; renderPlate(); } },
        h('span', { class: 'rating' }, `评分 ${s.rating}`),
        h('span', { class: 'flag' }, bad ? `✗ ${bad} 项问题` : s.warnings.length ? `${s.warnings.length} 项提醒` : '✓ 可出战')),
      h('button', { class: 'btn small', title: '改装规则', onclick: openRules }, '?'),
      h('button', { class: 'btn small primary', onclick: () => close(() => SA.UI.deploy()) }, '出战'),
    );
  }

  // 黄铜性能铭牌：悬浮在画布左上角，可折叠
  function renderPlate() {
    const s = st.stats;
    plateEl.innerHTML = '';
    plateEl.classList.toggle('closed', !st.plateOpen);
    if (!st.plateOpen) return;
    plateEl.append(
      h('button', { class: 'plate-head', title: '收起', onclick: () => { st.plateOpen = false; renderPlate(); } },
        h('b', {}, '性能'), h('span', { class: 'rating' }, `评分 ${s.rating}`), h('span', { class: 'fold' }, '✕')),
      h('div', { class: 'plate-body' }, SA.UI.statBars(s)));
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
          h('div', { class: 'sub' }, n ? '点格子放置；点已有模块直接替换；再点同款模块拆下' : '点格子即可购买并安装')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn small', onclick: () => buyOne(id) }, `买 ${money(m.price)}`),
          h('button', { class: 'btn small', title: 'Esc', onclick: () => { st.sel = null; renderAll(); } }, '取消')));
      return;
    }
    const pk = st.pick && v[st.pick.layer][st.pick.r][st.pick.c];
    if (pk) {
      const { layer, r, c } = st.pick, m = M[pk.id], max = SA.V.maxHp(pk);
      const iss = issueAt(layer, r, c);
      const fix = [pk, layer === 'body' && v.side[r][c]].filter(x => x && x.hp < SA.V.maxHp(x));
      const cost = fix.reduce((a, x) => a + SA.S.repairCost(x), 0);
      ctxEl.append(thumb(pk.id),
        h('div', { class: 'info' },
          h('div', {}, h('b', {}, m.name), ' ', h('span', { class: 'chip' }, pk.hp <= 0 ? '已损毁' : `耐久 ${pk.hp}/${max}`), ' ', h('span', { class: 'muted' }, where(r, c))),
          iss ? h('div', { class: 'sub err' }, iss.reason) : h('div', { class: 'sub' }, '点空格子移动；拖到别的模块上对调；拖出车外放回库存')),
        h('div', { class: 'acts' },
          fix.length ? h('button', { class: 'btn small', onclick: () => repair(fix) }, `修理 ${money(cost)}`) : null,
          h('button', { class: 'btn small', title: 'Delete', onclick: () => removeAt(st.pick) }, pk.hp <= 0 ? `报废 +${money(M[pk.id].price * 0.1)}` : '拆下'),
          h('button', { class: 'btn small', title: 'Esc', onclick: () => { st.pick = null; renderDock(); } }, '取消')));
      return;
    }
    st.pick = null;
    const n = st.stats.issues.length;
    ctxEl.append(h('div', { class: 'info' },
      n ? h('div', { class: 'err' }, `${n} 个模块悬空或摆放不合规（红框），出战前要接好`) : h('div', {}, h('b', {}, '改装台')),
      h('div', { class: 'sub' }, '选下面的模块，再点格子放置；拖动车上的模块可以移动/对调，拖出车外放回库存。没有库存的模块可以直接购买。')));
  }

  function renderTools() {
    toolsEl.innerHTML = '';
    const inv = d().inv;
    const seg = (items, cur, set) => h('span', { class: 'seg' }, items.map(([k, n]) =>
      h('button', { class: `btn small ${cur === k ? 'on' : ''}`, onclick: () => { set(k); renderAll(); } }, n)));
    const stockOf = (k) => SA.MODULE_ORDER.filter(id => k === 'all' || M[id].cat === k).reduce((a, id) => a + (inv[id] || 0), 0);
    toolsEl.append(
      seg([['body', '主体层'], ['side', '侧挂层']], st.layer, (k) => { st.layer = k; st.pick = null; if (st.sel && SA.V.layerOf(st.sel) !== k) st.sel = null; }),
      seg([['pixel', '像素'], ['blueprint', '蓝图']], st.view, (k) => { st.view = k; }),
      h('div', { class: 'inv-tabs' }, TABS.map(([k, n]) =>
        h('button', { class: `tab ${st.tab === k ? 'on' : ''} ${k !== 'all' ? `cat-${k}` : ''}`, onclick: () => { st.tab = k; renderTools(); renderInv(); } },
          n, h('span', { class: 'cnt' }, stockOf(k))))),
    );
  }

  function renderInv() {
    const keep = invEl.scrollLeft;
    invEl.innerHTML = '';
    const inv = d().inv;
    const list = SA.MODULE_ORDER.filter(id => st.tab === 'all' || M[id].cat === st.tab);
    for (const id of list) {
      const m = M[id], n = inv[id] || 0;
      const tile = h('button', { class: `tile cat-${m.cat} ${st.sel === id ? 'sel' : ''} ${n ? '' : 'empty'}`,
        title: `${m.name}（${SA.QUALITY[m.q].name}）\n${m.desc}\n${SA.UI.statLine(id)}`,
        onclick: () => selectInv(id) },
      SA.SPR.moduleCanvas(id, 0.75),
      h('span', { class: 'nm' }, m.name),
      n ? h('span', { class: 'n' }, `×${n}`) : h('span', { class: 'n price' }, money(m.price)));
      tile.addEventListener('pointerdown', (e) => { if (e.button === 0) beginPress(e, { kind: 'inv', id }); });
      tile.addEventListener('pointermove', onMove);
      tile.addEventListener('pointerup', onUp);
      tile.addEventListener('pointercancel', cancelPress);
      invEl.append(tile);
    }
    invEl.scrollLeft = keep;
  }

  function renderDock() { renderCtx(); renderInv(); }
  function renderAll() { renderHead(); renderPlate(); renderCtx(); renderTools(); renderInv(); }

  function openRules() {
    SA.UI.openModal('改装规则', [
      h('div', { class: 'list rules' },
        h('div', {}, h('b', {}, '操作'), '：选底部的模块再点格子放置；点已有模块会直接替换（换下的放回库存），再点同款模块就拆下。点车上的模块可选中它（修理 / 拆下）；拖动可以移动或对调，拖出车外放回库存。右键 = 拆下，Esc = 取消，Delete = 拆下选中的模块。'),
        h('div', {}, h('b', {}, '购买'), '：没有库存的模块也能直接放，确认后自动购买；钱不够会询问是否向银行贷款。'),
        h('div', {}, h('b', {}, '悬空'), '：改装台上可以随便摆、暂时悬空，但出战前所有模块都要一路连到底盘，红框标出的模块要先接好。'),
        h('div', {}, h('b', {}, '主体层'), '：底盘只能放最底行；其他模块必须叠在底盘或其他模块上，最高 6 层。直射火炮、机枪的同一行前方不能有己方模块；高抛火炮不受影响。撞击武器（铲斗装在底盘前，撞角/撞锤装在装甲前）必须是这一行的最前端，上面不能叠东西。'),
        h('div', {}, h('b', {}, '侧挂层'), '：侧炮挂在任意主体模块上，射击不会被己方挡住，但命中率低。被瞄准时敌人只打侧炮；下面的模块被毁，侧炮也会掉落。'),
        h('div', { class: 'legend' }, Object.values(SA.CAT).map(c => h('span', {}, h('i', { style: `background:${c.plate}` }), c.name)))),
    ]);
  }

  // ---------- 绘制 ----------
  function corners(x, y, col) {
    SA.SPR.useCtx(g);
    const e = C - 1, L = 6;
    for (const [dx, dy, w, hh] of [[1, 1, L, 2], [1, 1, 2, L], [e - L, 1, L, 2], [e - 1, 1, 2, L], [1, e - 1, L, 2], [1, e - L, 2, L], [e - L, e - 1, L, 2], [e - 1, e - L, 2, L]])
      SA.SPR.R(x + dx, y + dy, w, hh, col);
  }
  function cross(x, y) {
    SA.SPR.useCtx(g);
    const a = Math.round(C * 0.3), b = Math.round(C * 0.7);
    SA.SPR.line(x + a, y + a, x + b, y + b, 5, P.black);
    SA.SPR.line(x + b, y + a, x + a, y + b, 5, P.black);
    SA.SPR.line(x + a, y + a, x + b, y + b, 3, P.white);
    SA.SPR.line(x + b, y + a, x + a, y + b, 3, P.white);
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
    return { text: `${m.name}（${SA.CAT[m.cat].name}）· 耐久 ${Math.max(0, cell.hp)}/${SA.V.maxHp(cell)} · ${SA.UI.statLine(cell.id).split(' · ').slice(1).join(' · ')}` };
  }

  function draw(t) {
    const v = veh();
    const bp = st.view === 'blueprint';
    g.fillStyle = bp ? '#10335c' : P.bg[2];
    g.fillRect(0, 0, W, H);
    if (!bp) {
      g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
      g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
      g.fillStyle = P.bg[1];
      for (let c = 0; c <= K.COLS; c++) g.fillRect(PADX + c * C, 0, 1, K.ROWS * C);
      for (let r = 0; r <= K.ROWS; r++) g.fillRect(PADX, r * C, K.COLS * C, 1);
      g.fillStyle = 'rgba(111,207,106,0.06)';
      for (let c = 0; c < K.COLS; c++) if (v.body[K.ROWS - 1][c]) g.fillRect(PADX + c * C, 0, C, K.ROWS * C);
    }
    const drag = st.drag && st.drag.kind === 'cell' ? st.drag : null;
    g.drawImage(SA.SPR.renderVehicle(v, {
      key: 'editor', t, view: st.view, heat: 0.35, water: 1, showWrecks: true, showBlocked: true,
      blocked: st.stats.blocked, dimBody: st.layer === 'side' && !bp, dimCell: drag && drag.layer === 'body' ? drag : null,
    }), 0, 0);

    // 悬空 / 不合规：洋红虚线框 + 感叹号
    const dash = Math.floor(t * 8);
    for (const x of st.stats.issues) {
      const px = PADX + x.c * C, py = x.r * C;
      SA.SPR.outline(g, px + 2, py + 2, C - 4, C - 4, SA.PAL.magenta, P.black, dash);
      SA.SPR.text(g, '!', px + C - 8, py + 5, SA.PAL.magenta, 2);
    }

    const hv = st.hover;
    const id = drag ? drag.id : st.sel;
    if (id) {
      // 合规位置打角标，方便一眼找到能稳稳装上的格子
      if (!drag) for (let r = 0; r < K.ROWS; r++)
        for (let c = 0; c < K.COLS; c++)
          if (SA.V.canPlace(v, id, r, c).ok) corners(PADX + c * C, r * C, P.white);
      if (hv) {
        const x = PADX + hv.c * C, y = hv.r * C;
        const cur = v[SA.V.layerOf(id)][hv.r][hv.c];
        const home = drag && drag.r === hv.r && drag.c === hv.c;
        if (!st.drag && cur && cur.id === id) cross(x, y);
        else if (!home) {
          g.globalAlpha = cur ? 0.85 : 0.7;
          if (cur) { g.fillStyle = 'rgba(7,8,12,0.6)'; g.fillRect(x, y, C, C); }
          SA.SPR.drawModule(g, id, x, y, { t, heat: 0.3, water: 1 });
          g.globalAlpha = 1;
        }
        SA.SPR.outline(g, x, y, C, C, P.white, P.black);
      }
    } else if (hv) {
      const cell = v[st.layer][hv.r][hv.c];
      if (cell) SA.SPR.outline(g, PADX + hv.c * C, hv.r * C, C, C, st.layer === 'side' ? SA.PAL.magenta : P.white, P.black);
    }
    if (st.pick && !drag) SA.SPR.outline(g, PADX + st.pick.c * C, st.pick.r * C, C, C, st.pick.layer === 'side' ? SA.PAL.magenta : P.brass[3], P.black, dash);

    const tip = tipText();
    const text = tip ? tip.text : '';
    if (tipEl._t !== text) { tipEl._t = text; tipEl.textContent = text; tipEl.hidden = !text; }
    tipEl.classList.toggle('err', !!(tip && tip.err));
  }

  function loop() {
    if (SA.current !== 'editor') return;
    draw(performance.now() / 1000);
    requestAnimationFrame(loop);
  }

  return { open };
})();
