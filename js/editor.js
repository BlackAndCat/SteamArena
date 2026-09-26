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
  // sel：从库存选中、准备放置的库存键（id 或 id@材料，见 SA.invKey）；pick：车上选中的格子 { layer, r, c }
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
  const where = (r, c) => `第 ${K.ROWS - r} 行 第 ${c + 1} 列`;   // 子格坐标，从地面往上数
  const kid = (k) => SA.parseKey(k).id, kmt = (k) => SA.parseKey(k).mt;
  const has = (f) => SA.Camp.has(f);
  // 商店里能买的：商店已开放、战役已解锁这种模块（只卖黄铜，更好的材料在车上升级）
  const buyable = (id) => has('shop') && SA.Camp.hasMod(id) && !SA.isUnique(id);
  const matName = (mt) => SA.MATS[mt].name;
  const fullName = (id, mt) => (mt > 1 ? `${matName(mt)}${M[id].name}` : M[id].name);
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

  // 鼠标 → 子格；fr / fc 是带小数的子格坐标（摆放时让模块中心对准鼠标）
  function cellAtXY(x0, y0) {
    const rc = cv.getBoundingClientRect();
    if (x0 < rc.left || x0 > rc.right || y0 < rc.top || y0 > rc.bottom) return null;
    const x = (x0 - rc.left) / rc.width * W, y = (y0 - rc.top) / rc.height * H;
    const fc = (x - PADX) / C, fr = y / C, c = Math.floor(fc), r = Math.floor(fr);
    return r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS ? { r, c, fr, fc } : null;
  }
  // 把模块 id 摆到鼠标位置：模块中心对准鼠标（底盘自动贴到最底两行），返回锚点和会压到的模块（ignore 的锚点除外）
  function spot(id, hv, v = veh(), ignore = null) {
    const f = SA.fp(id), clampI = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const r = M[id].layer === 'chassis' ? SA.V.CH : clampI(Math.round(hv.fr - f.h / 2), 0, K.ROWS - f.h);
    const c = clampI(Math.round(hv.fc - f.w / 2), 0, K.COLS - f.w);
    const O = SA.V.occ(v, SA.V.layerOf(id)), hits = [];
    for (let i = 0; i < f.h; i++) for (let j = 0; j < f.w; j++) {
      const o = O[r + i][c + j];
      if (o && !(ignore && o.r === ignore.r && o.c === ignore.c) && !hits.some(x => x.r === o.r && x.c === o.c)) hits.push(o);
    }
    return { r, c, w: f.w, h: f.h, hits };
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
      const layer = SA.V.at(v, st.layer, cell.r, cell.c) ? st.layer : SA.V.at(v, 'body', cell.r, cell.c) ? 'body' : null;
      if (layer) { const o = SA.V.at(v, layer, cell.r, cell.c); removeAt({ layer, r: o.r, c: o.c }); }
      return;
    }
    if (st.sel) { placeAt(st.sel, cell); return; }
    const here = SA.V.at(v, st.layer, cell.r, cell.c);
    if (here) { beginPress(e, { kind: 'cell', layer: st.layer, r: here.r, c: here.c, id: here.cell.id, key: SA.invKey(here.cell.id, here.cell.mt) }); return; }
    // 空格子：已选中车上的模块 → 移过来
    if (st.pick) moveTo(st.pick, cell);
    else if (st.layer === 'side' && SA.V.at(v, 'body', cell.r, cell.c)) say('侧挂层这里没有侧炮。切回「主体层」才能选中主体模块');
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
      makeGhost(p.src.key);
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
    if (src.kind === 'inv') { if (target) placeAt(src.key, target); return; }
    if (target) moveTo(src, target);
    else if (!inside) removeAt(src);
  }

  function cancelPress() {
    if (st.press && st.press.el) try { st.press.el.releasePointerCapture(st.press.pid); } catch (err) { /* ignore */ }
    st.press = null; st.drag = null;
    dropGhost();
    if (dockEl) dockEl.classList.remove('drop');
  }

  function makeGhost(key) {
    dropGhost();
    const s = cv.getBoundingClientRect().width / W;
    const id = kid(key), f = SA.fp(id);
    const img = SA.SPR.moduleCanvas(id, s, kmt(key));
    ghost = h('div', { class: 'ed-ghost' }, img);
    // 模块在卡片画布里底边对齐，鼠标对准模块中心
    ghost._ox = (2 + f.w * C / 2) * s; ghost._oy = (2 + K.ART - f.h * C / 2) * s;
    document.body.append(ghost);
  }
  function moveGhost(x, y) { if (ghost) ghost.style.transform = `translate(${x - ghost._ox}px, ${y - ghost._oy}px)`; }
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

  // 拆下来的模块：完好的连同材料回库存，报废的按总价值 10% 回收；改装件拆掉按一半折价回收
  function stash(cell) {
    let back = 0;
    for (let k = 1; k <= (cell.lv || 0); k++) back += Math.round(SA.upCost(cell.id, k) * 0.5);
    if (cell.hp <= 0) back += Math.round(SA.cellValue({ id: cell.id, mt: cell.mt }) * 0.1);
    else SA.S.addInv(cell.id, 1, cell.mt || 1);
    d().money += back;
    return back;
  }

  // 材料升级：黄铜 → 熟铁 → 钢 → 镀镍（花钱，随战役解锁）→ 乌兹钢 / 以太合金（还要消耗锭 / 结晶）
  function matUpInfo(cell) {
    const to = (cell.mt || 1) + 1;
    if (to > SA.MAT_MAX) return { max: true };
    const mat = SA.MATS[to], cost = SA.matUpCost(cell.id, to);
    if (mat.ingot) {
      const n = d().ingots[mat.ingot] || 0;
      return { to, mat, cost, ok: n > 0, why: n > 0 ? '' : `需要 ${SA.INGOTS[mat.ingot].name}（委托 / Boss 掉落）` };
    }
    if (to > SA.Camp.maxMat()) return { to, mat, cost, ok: false, why: `${mat.name}还没解锁（推进战役）` };
    return { to, mat, cost, ok: true };
  }
  function matUpgrade(cell) {
    const u = matUpInfo(cell);
    if (!u.ok) { say(u.why, true); return; }
    const m0 = SA.mod(cell), m1 = SA.mod(cell.id, u.to);
    const diff = [['耐久', 'hp'], ['伤害', 'dmg'], ['动力', 'supply'], ['水', 'water'], ['冷却', 'cool'], ['撞击', 'ram'], ['活塞', 'punch'], ['承重', 'load'], ['护甲', 'armor']]
      .filter(([, k]) => m0[k]).map(([n, k]) => `${n} ${k === 'load' ? SA.tons(m0[k]) : m0[k]} → ${k === 'load' ? SA.tons(m1[k]) : m1[k]}`);
    SA.UI.pay({ title: `升级材料 · ${u.mat.name}`, amount: u.cost, okLabel: `升级为${u.mat.name}`,
      lines: [h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(cell.id, 1, u.to), h('div', {}, h('b', {}, fullName(cell.id, u.to)), ' ', SA.Camp.matChip(u.to),
        h('div', { class: 'muted' }, diff.join(' · ')))),
        u.mat.ingot ? h('p', { class: 'muted' }, `同时消耗 ${SA.INGOTS[u.mat.ingot].name} ×1（剩 ${(d().ingots[u.mat.ingot] || 0) - 1}）。`) : null,
        h('p', { class: 'muted' }, '材料越好，耐久、伤害、动力、冷却等一起放大；重量和产热不变。拆下后材料跟着模块走。')],
      onPaid: () => {
        if (u.mat.ingot) d().ingots[u.mat.ingot]--;
        const before = SA.V.maxHp(cell);
        cell.mt = u.to;
        if (cell.hp > 0) cell.hp += SA.V.maxHp(cell) - before;
        say(`${M[cell.id].name} 升级为${u.mat.name}`);
        changed();
      } });
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

  // 库存不够就问要不要买（钱不够再问要不要贷款）；商店只卖已解锁的黄铜模块
  function withStock(key, then) {
    if (d().inv[key] > 0) { then(); return; }
    const id = kid(key), m = M[id];
    if (kmt(key) !== SA.buyMt(id) || !buyable(id)) { say(has('shop') ? `${m.name}还没解锁` : '商店还没开张：只能用库存里的模块', true); st.sel = null; renderDock(); return; }
    // 钱够就直接买，不弹确认；钱不够才会问要不要贷款
    SA.UI.pay({
      title: `购买 ${fullName(id, SA.buyMt(id))}`, amount: SA.buyPrice(id), okLabel: '购买并安装', confirm: false,
      lines: [h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(id, 1), h('div', {}, h('b', {}, m.name), h('div', { class: 'muted' }, SA.UI.statLine(id))))],
      onPaid: () => { SA.S.addInv(id, 1, SA.buyMt(id)); then(); },
    });
  }

  // 把库存里的模块放到鼠标位置：压着一个模块就替换它（同款同材料 = 拆下），压着好几个就不行
  function placeAt(key, hv) {
    const id = kid(key), mt = kmt(key);
    const v = veh(), layer = SA.V.layerOf(id), m = M[id];
    const sp = spot(id, hv, v), { r, c } = sp;
    if (!SA.V.boxInRegion(v, r, c, sp.w, sp.h)) { say('这一格还没扩建：推进战役会解锁更大的改装台', true); return; }
    if (st.layer !== layer) st.layer = layer;
    if (sp.hits.length > 1) { say('这里压着好几个模块：先拆掉或挪开，再放', true); return; }
    const cur = sp.hits[0] || null;
    if (cur && cur.cell.id === id && (cur.cell.mt || 1) === mt) { removeAt({ layer, r: cur.r, c: cur.c }); return; }   // 同款再点一次 = 拆下
    if (cur && hurt(cur.cell)) { say(`${M[cur.cell.id].name} 受损，先修理才能替换`, true); st.pick = { layer, r: cur.r, c: cur.c }; st.sel = null; renderDock(); return; }
    // 换下旧模块后放不放得下（大小可能不一样），先在副本上试
    const test = SA.V.clone(v);
    if (cur) test[layer][cur.r][cur.c] = null;
    const chk = SA.V.canPut(test, id, r, c);
    if (!chk.ok) { say(chk.reason, true); return; }
    withStock(key, () => {
      const old = cur && cur.cell;
      let scrap = 0;
      if (old) { v[layer][cur.r][cur.c] = null; scrap = stash(old); }
      SA.V.put(v, id, r, c, mt);
      SA.S.addInv(id, -1, mt);
      // 库存还有就保持选中，可以接着放；用完了才取消选中
      if (!(d().inv[key] > 0)) st.sel = null;
      st.pick = null;
      const iss = SA.V.issues(v).find(x => x.layer === layer && x.r === r && x.c === c);
      const tail = iss ? `（${iss.reason}，出战前要接好）` : '';
      say(old ? `${fullName(old.id, old.mt || 1)} → ${fullName(id, mt)}${scrap ? `，损毁件 / 改装件回收 ${money(scrap)}` : ''}${tail}` : `装上 ${m.name}${tail}`, !!iss);
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

  // 把车上的模块（锚点 from）搬到鼠标位置；压着一个模块就对调
  function moveTo(from, hv) {
    const v = veh(), cell = v[from.layer][from.r][from.c];
    if (!cell) return;
    const sp = spot(cell.id, hv, v, from);
    if (sp.r === from.r && sp.c === from.c) return;
    const res = SA.V.move(v, from.layer, from.r, from.c, sp.r, sp.c);
    if (!res.ok) { if (res.reason) say(res.reason, true); return; }
    const other = res.swapped && v[from.layer][from.r][from.c];
    say(other ? `对调：${M[cell.id].name} ⇄ ${M[other.id].name}` : `移到${where(sp.r, sp.c)}`);
    st.pick = null;   // 移动完成即取消选中
    changed();
  }

  function repair(cells) {
    const cost = cells.reduce((a, x) => a + SA.S.repairCost(x), 0);
    SA.UI.pay({ title: '修理', amount: cost, okLabel: '修理', confirm: false, lines: [SA.UI.repairList(cells)],
      onPaid: () => { for (const x of cells) x.hp = SA.V.maxHp(x); st.pick = null; say(`修好了，花费 ${money(cost)}`); changed(); } });
  }

  function buyOne(id) {
    const m = M[id];
    if (!buyable(id)) return;
    SA.UI.pay({ title: `购买 ${fullName(id, SA.buyMt(id))}`, amount: SA.buyPrice(id), okLabel: '购买', confirm: false,
      lines: [h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(id, 1), h('div', {}, h('b', {}, m.name), h('div', { class: 'muted' }, SA.UI.statLine(id))))],
      onPaid: () => { const k = SA.invKey(id, SA.buyMt(id)); SA.S.addInv(id, 1, SA.buyMt(id)); say(`购入 ${fullName(id, SA.buyMt(id))}，库存 ${d().inv[k]}`); changed(); } });
  }

  function selectInv(key) {
    if (st.noClick) return;
    st.sel = st.sel === key ? null : key;
    st.pick = null;
    if (st.sel) st.layer = SA.V.layerOf(kid(key));
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
      hurtList.length ? h('button', { class: 'btn small plate-fix', title: `最贵的几项：
${SA.UI.repairBrief(hurtList)}`, onclick: () => repair(hurtList) }, `修理 ${hurtList.length} 处受损 · ${money(cost)}`) : null,
      st.plateOpen ? h('div', { class: 'plate-body' }, SA.UI.statBars(s, veh())) : null].filter(Boolean));
  }

  // 画布右上角：看哪一层 + 蓝图库开关（右侧面板在模块清单和蓝图库之间切换）
  function setDock(k) { st.dock = k; st.sel = null; st.pick = null; st.bp = null; renderAll(); }
  function renderView() {
    viewEl.innerHTML = '';
    const seg = (items, cur, set) => h('span', { class: 'seg' }, items.map(([k, n]) =>
      h('button', { class: `btn small ${cur === k ? 'on' : ''}`, onclick: () => { set(k); renderAll(); } }, n)));
    viewEl.append(...[
      has('side') ? seg([['body', '主体层'], ['side', '侧挂层']], st.layer, (k) => { st.layer = k; st.pick = null; if (st.sel && SA.V.layerOf(kid(st.sel)) !== k) st.sel = null; }) : null,
      has('blueprints') ? h('button', { class: `btn small bp-btn ${st.dock === 'bps' ? 'on' : ''}`, title: '蓝图库：保存 / 套用整车方案，云车库也在这里',
        onclick: () => setDock(st.dock === 'bps' ? 'mods' : 'bps') }, SA.SPR.iconCanvas('scroll', st.dock === 'bps' ? '#e4e0d6' : '#f5d77a', 2), '蓝图库') : null].filter(Boolean));
  }

  // ---------- 底部操作栏 ----------
  function thumb(id, mt) { const cvs = SA.SPR.moduleCanvas(id, 0.75, mt); cvs.classList.add('thumb'); return cvs; }

  function renderCtx() {
    ctxEl.innerHTML = '';
    const v = veh(), inv = d().inv;
    if (st.sel) {
      const key = st.sel, id = kid(key), mt = kmt(key), m = M[id], n = inv[key] || 0;
      ctxEl.append(thumb(id, mt),
        h('div', { class: 'info' },
          h('div', {}, h('b', {}, m.name), ' ', SA.Camp.matChip(mt), ' ', SA.UI.repairChip({ id, mt }), ' ',
            n ? h('span', { class: 'chip' }, `库存 ${n}`) : h('span', { class: 'chip buy' }, `无库存 · 放置时购买 ${money(SA.buyPrice(id))}`)),
          h('div', { class: 'sub' }, n ? '点格子放置，库存没用完就一直保持选中；点已有模块直接替换，点同款模块拆下' : '点格子即可直接购买并安装')),
        h('div', { class: 'acts' },
          mt === SA.buyMt(id) && buyable(id) ? h('button', { class: 'btn small', onclick: () => buyOne(id) }, `买 ${money(SA.buyPrice(id))}`) : null,
          n ? h('button', { class: 'btn small', onclick: () => sellOne(key) }, `卖 ${money(SA.cellValue({ id, mt }) * 0.5)}`) : null,
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
      const mu = matUpInfo(pk);
      // 下一级材料：已解锁或有锭才显示按钮；没解锁的只在提示里说一句
      const matBtn = pk.hp > 0 && !mu.max && (mu.ok || mu.mat.ingot || mu.to <= SA.Camp.maxMat() + 1) && SA.Camp.maxMat() > 1
        ? h('button', { class: `btn small ${mu.ok ? 'primary' : ''}`, disabled: !mu.ok, title: mu.why || `属性 ×${mu.mat.mul}`, onclick: () => matUpgrade(pk) },
          `升级为${mu.mat.name} · ${money(mu.cost)}${mu.mat.ingot ? ` + ${SA.INGOTS[mu.mat.ingot].name}` : ''}`) : null;
      ctxEl.append(thumb(pk.id, pk.mt),
        h('div', { class: 'info' },
          h('div', {}, h('b', {}, m.name), ' ', SA.Camp.matChip(pk.mt || 1), ' ', h('span', { class: 'chip' }, pk.hp <= 0 ? '已损毁' : `耐久 ${pk.hp}/${max}`), ' ', SA.UI.repairChip(pk), ' ',
            has('upgrade') ? h('span', { class: `chip rank ${lv ? 'on' : ''}`, title: `${upName} ${lv}/${SA.K.UP_MAX} 级` }, `${upName} ${'▲'.repeat(lv)}${'△'.repeat(SA.K.UP_MAX - lv)}`) : null, ' ',
            h('span', { class: 'muted' }, `${SA.tons(SA.weightOf(pk))} · ${where(r, c)}`)),
          iss ? h('div', { class: 'sub err' }, iss.reason) : h('div', { class: 'sub' }, matBtn && !mu.ok ? mu.why : '点空格子移动；拖到别的模块上对调；拖出车外放回库存'),
          ''),
        h('div', { class: 'acts' },
          matBtn,
          has('upgrade') && pk.hp > 0 && lv < SA.K.UP_MAX ? h('button', { class: 'btn small', title: `耐久 +${Math.round(SA.upHp(pk.id) * 100)}%，重量 +${SA.K.UP_KG} kg`, onclick: () => upgrade(pk) },
            `${upName} ${lv + 1} 级 · ${money(SA.upCost(pk.id, lv + 1))}`) : null,
          fix.length ? h('button', { class: 'btn small', title: SA.UI.repairBrief(fix), onclick: () => repair(fix) }, `修理 ${money(cost)}`) : null,
          h('button', { class: 'btn small', title: 'Delete', onclick: () => removeAt(st.pick) }, pk.hp <= 0 ? `报废 +${money(SA.cellValue({ id: pk.id, mt: pk.mt }) * 0.1)}` : '拆下'),
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
    const owned = Object.values(d().inv).reduce((a, n) => a + n, 0);
    toolsEl.append(title('模块清单', h('span', { class: 'muted' }, `库存 ${owned} 件`)),
      has('shop') ? h('div', { class: 'panel-row' },
        h('span', { class: 'muted' }, st.shop ? '也列出没有库存的模块' : '只列出有库存的模块'),
        h('label', { class: `switch ${st.shop ? 'on' : ''}`, title: '打开后也列出没有库存的模块，放到车上即购买' },
          h('input', { type: 'checkbox', checked: st.shop, onchange: (e) => { st.shop = e.target.checked; renderTools(); renderInv(); } }),
          h('span', { class: 'knob' }), '商店')) : h('div', { class: 'panel-row' }, h('span', { class: 'muted' }, '商店还没开张：先用库存里的模块。')));
  }

  // 模块最关键的两三项数值，做成小标签
  function keyStats(id, mt = 1) {
    const m = SA.mod(id, mt), out = [];
    if (m.layer === 'chassis') out.push(`承重 ${SA.tons(m.load)}`, SA.kmh(m.speed), m.brake >= 1.5 ? '起步刹车最快' : m.brake < 0.8 ? '刹车慢' : '刹车中等', m.sway < 0.6 ? '移动最稳' : m.sway > 1.2 ? '移动晃' : '移动一般');
    else if (m.dmg) out.push(`伤害 ${m.dmg}`, `装填 ${m.reload}s`, m.indirect ? '高抛' : `散布 ±${m.spread}°`, m.penetration >= 99 ? '不会弹开' : `穿深 ${m.penetration}`);
    else if (m.supply) out.push(`动力 +${m.supply}`, `产热 ${m.heatRate}/s`);
    else if (m.store) out.push(`储能 ${m.store}`, '不够时补 3/s');
    else if (m.water) out.push(`冷却 ${m.cool}/s`, `水 ${m.water}`);
    else if (m.dryCool) out.push(`不耗水散热 ${m.dryCool}/s`);
    else if (m.waterSave) out.push(`省水 ${Math.round((1 - m.waterSave) * 100)}%`, `冷却 ${m.cool}/s`);
    else if (m.ram) out.push(`撞击 ${m.ram}`, m.punch ? `活塞 ${m.punch}` : `耐久 ${m.hp}`);
    else out.push(`耐久 ${m.hp}`);
    if (m.tether) out.push('牵引');
    if (m.armor && !m.load) out.push(`装甲厚 ${Math.round(m.armor * 10) / 10}`);
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
    const shop = st.shop && has('shop');
    let shown = 0;
    for (const cat of CAT_ORDER) {
      // 每种模块按材料分行：库存里有的都列，材料好的排前面；商店打开时补上能买的黄铜款
      const keys = [];
      for (const id of SA.MODULE_ORDER) {
        if (M[id].cat !== cat) continue;
        for (let mt = SA.MAT_MAX; mt >= 1; mt--) {
          const k = SA.invKey(id, mt);
          if (inv[k] > 0 || (mt === SA.buyMt(id) && shop && buyable(id))) keys.push(k);
        }
      }
      if (!keys.length) continue;
      // 折叠条：齿轮 + 铆钉钢条 + 铜色描边；折起来齿轮转半圈
      const folded = st.fold.has(cat);
      const have = keys.reduce((a, k) => a + (inv[k] || 0), 0);
      invEl.append(h('button', { class: `grp cat-${cat} ${folded ? 'folded' : ''}`, 'aria-expanded': String(!folded),
        onclick: () => { if (folded) st.fold.delete(cat); else st.fold.add(cat); saveFold(); renderInv(); } },
        h('span', { class: 'gear l' }, SA.SPR.iconCanvas('gear', '#c8834a', 3)),
        h('i', { style: `background:${SA.CAT[cat].plate}` }),
        h('span', { class: 'gname' }, SA.CAT[cat].name),
        h('span', { class: 'gcnt' }, shop ? `${keys.length} 种` : `${have} 件`),
        h('span', { class: 'gear r' }, SA.SPR.iconCanvas('gear', '#c8834a', 3))));
      if (folded) { shown += keys.length; continue; }
      for (const key of keys) {
        shown++;
        const id = kid(key), mt = kmt(key), m = M[id], n = inv[key] || 0;
        const row = h('button', { class: `mrow cat-${m.cat} ${st.sel === key ? 'sel' : ''} ${n ? '' : 'unowned'}`,
          title: `${m.desc}\n${SA.UI.statLine(id, mt)}`, onclick: () => selectInv(key) },
        h('span', { class: 'pic' }, SA.SPR.moduleCanvas(id, 1, mt)),
        h('span', { class: 'mid' },
          h('span', { class: 'nm' }, m.name, ' ', SA.Camp.matChip(mt)),
          h('span', { class: 'ks' }, keyStats(id, mt).map(t => h('span', {}, t)), SA.UI.repairPips(id, '修'))),
        n ? h('span', { class: 'cnt' }, h('b', {}, `×${n}`), h('small', {}, '库存'))
          : h('span', { class: 'cnt buy' }, h('b', {}, money(m.price)), h('small', {}, '购买')));
        row.addEventListener('pointerdown', (e) => { if (e.button === 0) beginPress(e, { kind: 'inv', id, key }); });
        row.addEventListener('pointermove', onMove);
        row.addEventListener('pointerup', onUp);
        row.addEventListener('pointercancel', cancelPress);
        invEl.append(row);
        // 选中的那一行展开：穿深 / 装甲厚度对照、新属性说明和装上后的变化（V4）
        if (st.sel === key) {
          const more = [SA.UI.newAttrInfo(id, mt, veh()), SA.UI.penTable(id, Math.max(mt, SA.Camp.maxMat()))].filter(Boolean);
          if (more.length) invEl.append(h('div', { class: `mdetail cat-${m.cat}` }, more));
        }
      }
    }
    if (!shown) invEl.append(h('div', { class: 'empty' },
      h('b', {}, '库存是空的'),
      h('span', { class: 'muted' }, has('shop') ? '车上的模块拖到这里会放回库存。想买新模块，打开「商店」。' : '车上的模块拖到这里会放回库存。商店打完序章才开张。'),
      has('shop') ? h('button', { class: 'btn primary', onclick: () => { st.shop = true; renderTools(); renderInv(); } }, '打开商店') : null));
    else if (shop) invEl.prepend(h('div', { class: 'shop-note' }, '商店已打开：选中没有库存的模块，放到车上就自动购买。'));
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

  function sellOne(key) {
    const id = kid(key), mt = kmt(key);
    const x = Math.round(SA.cellValue({ id, mt }) * 0.5);
    d().money += x; SA.S.addInv(id, -1, mt);
    if (!d().inv[key]) st.sel = null;
    say(`卖出 ${fullName(id, mt)}，进账 ${money(x)}`);
    changed();
  }

  // 「?」：图例 + 规则，合在一个地方
  function openHelp() {
    const H = (t) => h('h3', { class: 'help-h' }, t);
    SA.UI.openModal('图例与规则', h('div', { class: 'help' },
      H('模块图例'),
      h('div', { class: 'help-cats' }, Object.entries(SA.CAT).map(([k, c]) => h('div', { class: `help-cat cat-${k}` },
        h('b', {}, h('i', { style: `background:${c.plate}` }), c.name),
        h('div', { class: 'help-mods' }, SA.MODULE_ORDER.filter(id => M[id].cat === k && !M[id].retired).map(id => h('span', {}, SA.SPR.moduleCanvas(id, 0.6), M[id].name)))))),
      H('材料'),
      h('p', {}, '模块的品质就是材料：', SA.MATS.slice(1).map((mt, i) => [SA.Camp.matChip(i + 1), ` ×${mt.mul} `]),
        '。选中车上的模块就能升级材料：耐久、伤害、动力、水、冷却、撞击、承重、护甲一起放大，重量和产热不变。黄铜到镀镍花钱升级，随战役逐章解锁；史诗「乌兹钢」和传奇「以太合金」还要消耗乌兹钢锭 / 以太结晶，只能靠委托、Boss 掉落获得。战役胜利后还能从对手剩下的模块里缴获一件。'),
      H('实体辅助模块'),
      h('p', {}, '观察镜、装弹机、陀螺仪和测距仪是可被击毁的 1×1 实体模块，放在车上即可生效。'),
      H('护甲与穿深'),
      h('p', {}, `装甲类模块有装甲厚度（铁装甲 ${M.armor.armor}、重装甲 ${M.armor_heavy.armor}、铲斗 ${M.bucket.armor}、履带 ${M.track.armor}、四足 ${M.quad.armor}，随材料加厚），每挨一发先减掉固定伤害，最少保留 25%。武器有穿深（不随材料变）：穿深不到装甲厚度的炮弹有概率`, h('b', {}, '弹开'),
        `，几乎没有伤害。机枪穿深 ${M.mg.penetration}，打熟铁以上的装甲就会开始弹开，适合专打没护甲的锅炉、水箱、驾驶舱；主炮穿深高，才能稳定打穿厚甲。在模块清单里选中一件武器或装甲，会展开它的穿深对照表。`),
      H('修理费'),
      h('p', {}, '越复杂精密的部件修起来越贵：甲片、装甲便宜，水箱低，撞击件、武器居中，驾驶舱和锅炉最贵。模块清单里每件的「修」刻度亮几格就是第几档（', h('span', { style: 'color:var(--gauge2)' }, '便宜'), ' → ', h('span', { style: 'color:var(--brass2)' }, '一般'), ' → ', h('span', { style: 'color:var(--fire2)' }, '较贵'), ' → ', h('span', { style: 'color:#ff5a3c' }, '昂贵'), '），战后结算会列出每件花了多少。'),
      H('新属性'),
      h('p', {}, h('b', { style: 'color:var(--fire2)' }, '储能'), '：蓄压罐在锅炉有富余时存下蒸汽，动力不够时补上。', h('b', { style: 'color:var(--water2)' }, '省水'), '：冷凝器让冷却耗水打折，同样的水撑得更久。', h('b', { style: 'color:var(--water2)' }, '不耗水散热'), '：散热片不用水也能一直散热。', h('b', { style: 'color:var(--brass2)' }, '牵引'), '：鱼叉命中后把对手拉过来，被拉过来的撞击反震减半。选中这些模块可以看到装上后整车的变化。'),
      H('车间里的颜色'),
      h('p', {}, h('b', { style: 'color:var(--gauge2)' }, '绿色闪烁'), ' 选中 / 可以放 · ', h('b', { style: 'color:#ff3b2f' }, '红色闪烁'), ' 悬空、不合规或不能放 · 空格上的淡绿 = 能稳稳装上的位置'),
      H('操作'),
      h('p', {}, '从模块清单选一个再点格子放置（也可以直接拖上去）；点已有模块直接替换（换下的回库存），点同款模块拆下。点车上的模块选中它（修理 / 拆下）；拖动可移动或对调，拖回清单放回库存。打开「商店」开关能看到没有库存的模块，放置时自动购买，钱不够会问要不要贷款。右键 拆下 · Esc 取消 · Delete 拆下选中。'),
      H('摆放规则'),
      h('p', {}, '驾驶员：驾驶舱里坐 1 人，1×2 联合驾驶舱 2 人，2×2 联合驾驶舱 4 人。全车驾驶员每比 1 多一个，就替你操作一组你当前没在用的武器（你切换武器组，他们跟着接手剩下的），自己挑目标，但没你准。'),
      h('p', {}, '速度：最高速度 = 底盘速度 × 动力比（锅炉富余最多超速 25%），单位 km/h。底盘手感：双足起步和刹车最快但走起来最晃，四足刹车最慢但移动时最平稳，履带居中。重量：每个模块都有重量（基础 250 kg + 自身重量），总重不能超过底盘承重；车越重，行驶要的动力越多、加速越慢，撞击却越狠（撞击面自己也会受伤）。改装：选中车上的模块可以加炮盾 / 附加装甲，每级加耐久也加重量，鼠标停在模块上能看到军衔杠。'),
      h('p', {}, '格子：每个大格分成 2×2 个小格。大模块占 2×2 小格，可以错开半格摆；甲片、小水罐、头盔驾驶舱占 1 个小格，水罐占 1×2，用来补缝。摆放时模块的中心跟着鼠标走，底盘自动贴到最底下两行。'),
      h('p', {}, '改装台上可以随便摆、暂时悬空，但出战前所有模块都要一路连到底盘。底盘只能放最底下两行；其他模块四周紧贴已连上的模块就行（可以侧挂、悬挑，撞击件不算支撑），最高 6 层。直射火炮、机枪炮管那一行（模块下半格）前方不能有己方模块，高抛火炮不受影响。撞击武器（铲斗装在底盘前，撞角 / 撞锤装在装甲或底盘前）必须是它那几行的最前端。两车只在同一高度的行上相撞：光秃秃的底盘只在底盘那两行挡路，高处的撞角能越过它撞到后面。侧炮整个挂在主体模块上，不会被己方挡住但命中率低。'),
      H('战斗里的颜色'),
      h('p', {}, h('b', {}, '白框'), ' 准星对准的模块 · ', h('b', { style: 'color:var(--magenta)' }, '洋红'), ' 准星对准的侧炮 · ', h('b', { style: 'color:#ffb347' }, '橙色角框'), ' = 弹道中心会先打中的模块（不是你瞄的那个）· ', h('b', { style: 'color:var(--fire2)' }, '橙'), ' 热量 · ', h('b', { style: 'color:var(--water2)' }, '青'), ' 水 · ', h('b', { style: 'color:var(--gauge2)' }, '绿'), ' 动力 · ', h('b', { style: 'color:var(--brass2)' }, '黄铜'), ' 火力。准星旁的小沙漏 = 装填进度。'),
    ));
  }

  // ---------- 绘制 ----------
  // 状态提示：整格缓慢闪烁的颜色（红 = 不可用/悬空，绿 = 选中/可放置），不再描边
  const RED = '#ff3b2f', GREEN = '#6fcf6a', WHITE = '#ffffff';
  const pulse = (t, lo, hi, per = 1.6) => lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / per));
  const tmp = document.createElement('canvas');
  tmp.width = K.ART; tmp.height = K.ART;
  const tg = tmp.getContext('2d');
  // 把 paint(tg) 画出来的像素整体染色后叠到画布上（只染模块本身，不染背景）；w, h 是模块像素大小
  function tint(paint, x, y, w, h, color, a) {
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, K.ART, K.ART);
    paint(tg);
    tg.globalCompositeOperation = 'source-atop';
    tg.fillStyle = color;
    tg.fillRect(0, 0, w, h);
    g.globalAlpha = a;
    g.drawImage(tmp, 0, 0, w, h, x, y, w, h);
    g.globalAlpha = 1;
  }
  const fromVeh = (vc, x, y, w, h) => (c2d) => c2d.drawImage(vc, x, y, w, h, 0, 0, w, h);
  const fromModule = (id, t, mt) => (c2d) => SA.SPR.drawModule(c2d, id, 0, 0, { t, heat: 0.3, water: 1, mt });
  function fillCell(x, y, color, a) {
    g.globalAlpha = a; g.fillStyle = color; g.fillRect(x + 1, y + 1, C - 1, C - 1); g.globalAlpha = 1;
  }
  function cross(x, y, w, h) {
    SA.SPR.useCtx(g);
    const x0 = x + Math.round(w * 0.3), x1 = x + Math.round(w * 0.7), y0 = y + Math.round(h * 0.3), y1 = y + Math.round(h * 0.7);
    SA.SPR.line(x0, y0, x1, y1, 5, P.black);
    SA.SPR.line(x1, y0, x0, y1, 5, P.black);
    SA.SPR.line(x0, y0, x1, y1, 3, P.white);
    SA.SPR.line(x1, y0, x0, y1, 3, P.white);
  }
  // 模块（锚点）在画布上的位置和像素大小
  const cellXY = (r, c) => [PADX + c * C, r * C];
  const boxOf = (v, layer, r, c) => { const cell = v[layer][r][c], f = SA.fp(cell ? cell.id : 'armor'); return [PADX + c * C, r * C, f.w * C, f.h * C]; };

  // 拖动到某处后，搬过去的模块会不会悬空 / 放不下（按目标锚点缓存，避免每帧克隆）
  let dropMemo = { key: '', bad: false };
  function dropBad(drag, sp) {
    const key = `${drag.layer}${drag.r},${drag.c}>${sp.r},${sp.c}`;
    if (dropMemo.key !== key) {
      const v = SA.V.clone(veh());
      const res = SA.V.move(v, drag.layer, drag.r, drag.c, sp.r, sp.c);
      dropMemo = { key, bad: !res.ok || SA.V.issues(v).some(x => x.r === sp.r && x.c === sp.c) };
    }
    return dropMemo.bad;
  }

  function tipText() {
    const v = veh(), hv = st.hover, now = performance.now();
    if (st.drag && st.drag.kind === 'cell' && !hv) return { text: `松手：拆下 ${M[st.drag.id].name}，放回库存` };
    if (hv && !SA.V.inRegion(v, hv.r, hv.c)) return { text: '这一格还没扩建：推进战役会解锁更大的改装台', err: true };
    if (st.msg && now - st.msg.at < 2600) return st.msg;
    if (!hv) return st.msg && now - st.msg.at < 5000 ? st.msg : null;
    const key = st.drag ? st.drag.key : st.sel;
    if (key) {
      const id = kid(key), mt = kmt(key);
      const dragCell = st.drag && st.drag.kind === 'cell' ? st.drag : null;
      const sp = spot(id, hv, v, dragCell), cur = sp.hits.length === 1 ? sp.hits[0].cell : null;
      if (dragCell) {
        if (sp.r === dragCell.r && sp.c === dragCell.c) return { text: '放回原处' };
        if (sp.hits.length > 1) return { text: '这里压着好几个模块，换不了', err: true };
        return { text: cur ? `对调 ${M[dragCell.id].name} ⇄ ${M[cur.id].name}` : `移到${where(sp.r, sp.c)}` };
      }
      const buy = d().inv[key] > 0 ? '' : `购买（${money(SA.buyPrice(id))}）并`;
      if (sp.hits.length > 1) return { text: '这里压着好几个模块：先拆掉或挪开，再放', err: true };
      if (cur && cur.id === id && (cur.mt || 1) === mt) return { text: `再点一次：拆下 ${M[id].name}` };
      if (cur && hurt(cur)) return { text: `${M[cur.id].name} 受损，先修理才能替换`, err: true };
      if (cur) return { text: `${buy}替换 ${M[cur.id].name} → ${M[id].name}` };
      const chk = SA.V.canPlace(v, id, sp.r, sp.c);
      return chk.ok ? { text: `${buy}放置 ${M[id].name}：${where(sp.r, sp.c)}` } : { text: `${buy}放置 ${M[id].name}（${chk.reason}）`, err: true };
    }
    const so = SA.V.at(v, 'side', hv.r, hv.c), bo = SA.V.at(v, 'body', hv.r, hv.c);
    const o = (st.layer === 'side' && so) || bo || so;
    if (!o) return { text: `${where(hv.r, hv.c)} · 空` };
    const cell = o.cell, m = M[cell.id], layer = o === so ? 'side' : 'body';
    const iss = issueAt(layer, o.r, o.c);
    if (iss) return { text: `${m.name}：${iss.reason}`, err: true };
    const up = cell.lv ? ` · ${SA.upName(cell.id)} ${cell.lv} 级` : '';
    const fixTxt = cell.hp < SA.V.maxHp(cell) ? ` · 修理 ${money(SA.S.repairCost(cell))}（${SA.UI.repairTier(cell.id).name}）` : '';
    return { text: `${fullName(cell.id, cell.mt || 1)}（${SA.CAT[m.cat].name}）· 耐久 ${Math.max(0, cell.hp)}/${SA.V.maxHp(cell)}${fixTxt}${up} · ${SA.tons(SA.weightOf(cell))} · ${SA.UI.statLine(cell.id, cell.mt || 1).split(' · ').slice(1).join(' · ')}` };
  }

  // 未扩建格子的斜线纹理（8×8 平铺）
  let hatchPat = null;
  function hatch() {
    if (hatchPat) return hatchPat;
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const hg = c.getContext('2d');
    hg.fillStyle = 'rgba(120,110,95,0.22)';
    for (let i = 0; i < 8; i++) hg.fillRect(7 - i, i, 1, 1);
    return (hatchPat = g.createPattern(c, 'repeat'));
  }

  function draw(t) {
    const v = veh();
    g.fillStyle = P.bg[2];
    g.fillRect(0, 0, W, H);
    g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
    g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
    // 网格：小格细线，大格（2×2 小格）粗一点
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let c = 0; c <= K.COLS; c++) if (c % 2) g.fillRect(PADX + c * C, 0, 1, K.ROWS * C);
    for (let r = 0; r <= K.ROWS; r++) if (r % 2) g.fillRect(PADX, r * C, K.COLS * C, 1);
    g.fillStyle = P.bg[1];
    for (let c = 0; c <= K.COLS; c += 2) g.fillRect(PADX + c * C, 0, 1, K.ROWS * C);
    for (let r = 0; r <= K.ROWS; r += 2) g.fillRect(PADX, r * C, K.COLS * C, 1);
    const O = SA.V.occ(v, 'body');
    g.fillStyle = 'rgba(111,207,106,0.06)';
    for (let c = 0; c < K.COLS; c++) if (O[K.ROWS - 1][c]) g.fillRect(PADX + c * C, 0, C, K.ROWS * C);
    // 还没扩建的格子：压暗 + 斜线
    const reg = SA.V.region(v);
    for (let r = 0; r < K.ROWS; r++)
      for (let c = 0; c < K.COLS; c++) {
        if (r >= reg.r0 && c >= reg.c0 && c <= reg.c1) continue;
        const x = PADX + c * C, y = r * C;
        g.fillStyle = 'rgba(7,8,12,0.62)'; g.fillRect(x, y, C, C);
        g.fillStyle = hatch(); g.fillRect(x, y, C, C);
      }
    const drag = st.drag && st.drag.kind === 'cell' ? st.drag : null;
    const vc = SA.SPR.renderVehicle(v, {
      key: 'editor', t, heat: 0.35, water: 1, showWrecks: true, showBlocked: true,
      blocked: st.stats.blocked, dimBody: st.layer === 'side', dimCell: drag && drag.layer === 'body' ? drag : null,
    });
    g.drawImage(vc, 0, 0);

    // 悬空 / 不合规：整个模块红色闪烁 + 感叹号
    for (const x of st.stats.issues) {
      if (!v[x.layer][x.r][x.c]) continue;
      const [px, py, w, h] = boxOf(v, x.layer, x.r, x.c);
      tint(fromVeh(vc, px, py, w, h), px, py, w, h, RED, pulse(t, 0.2, 0.65));
      SA.SPR.text(g, '!', px + w - 8, py + 5, RED, 2);
    }

    const hv = st.hover;
    const selKey = drag ? drag.key : st.sel;
    const id = selKey && kid(selKey), selMt = selKey ? kmt(selKey) : 1;
    if (id) {
      // 能稳稳装上的地方：淡淡的绿色呼吸（所有合规位置盖到的小格）
      if (!drag) {
        const f = SA.fp(id), cover = new Set();
        for (let r = 0; r <= K.ROWS - f.h; r++)
          for (let c = 0; c <= K.COLS - f.w; c++)
            if (SA.V.canPlace(v, id, r, c).ok) for (let i = 0; i < f.h; i++) for (let j = 0; j < f.w; j++) cover.add((r + i) * K.COLS + c + j);
        for (const k of cover) fillCell(...cellXY(Math.floor(k / K.COLS), k % K.COLS), GREEN, pulse(t, 0.06, 0.2, 2));
      }
      if (hv) {
        const sp = spot(id, hv, v, drag);
        const [x, y] = cellXY(sp.r, sp.c), w = sp.w * C, h = sp.h * C;
        const cur = sp.hits.length === 1 ? sp.hits[0] : null;
        const home = drag && drag.r === sp.r && drag.c === sp.c;
        if (!drag && cur && cur.cell.id === id && (cur.cell.mt || 1) === selMt) {           // 同款：再点一次拆下
          const [bx, by, bw, bh] = boxOf(v, 'body' === SA.V.layerOf(id) ? 'body' : 'side', cur.r, cur.c);
          tint(fromVeh(vc, bx, by, bw, bh), bx, by, bw, bh, RED, pulse(t, 0.3, 0.7, 1));
          cross(bx, by, bw, bh);
        } else if (!home) {
          const bad = !SA.V.boxInRegion(v, sp.r, sp.c, sp.w, sp.h) || sp.hits.length > 1
            || (drag ? dropBad(drag, sp) : (cur ? hurt(cur.cell) : !SA.V.canPlace(v, id, sp.r, sp.c).ok));
          for (const o of sp.hits) { const [bx, by, bw, bh] = boxOf(v, SA.V.layerOf(id), o.r, o.c); g.fillStyle = 'rgba(7,8,12,0.6)'; g.fillRect(bx, by, bw, bh); }
          g.globalAlpha = 0.8;
          SA.SPR.drawModule(g, id, x, y, { t, heat: 0.3, water: 1, mt: selMt });
          g.globalAlpha = 1;
          tint(fromModule(id, t, selMt), x, y, w, h, bad ? RED : GREEN, pulse(t, 0.3, 0.6, 1));
        }
      }
    } else if (hv) {
      const o = SA.V.at(v, st.layer, hv.r, hv.c);
      if (o) { const [x, y, w, h] = boxOf(v, st.layer, o.r, o.c); tint(fromVeh(vc, x, y, w, h), x, y, w, h, WHITE, 0.18); }
    }
    // 选中：整个模块绿色闪烁
    if (st.pick && !drag && v[st.pick.layer][st.pick.r][st.pick.c]) {
      const [x, y, w, h] = boxOf(v, st.pick.layer, st.pick.r, st.pick.c);
      tint(fromVeh(vc, x, y, w, h), x, y, w, h, GREEN, pulse(t, 0.25, 0.6));
    }
    // 鼠标停在模块上（或选中它）：显示改装军衔杠
    const rankAt = (o, layer) => { if (o && o.cell) SA.SPR.chevrons(g, ...cellXY(o.r, o.c), o.cell.lv || 0, K.UP_MAX); };
    if (!drag && !st.sel && has('upgrade')) {
      const ho = hv && (SA.V.at(v, st.layer, hv.r, hv.c) || SA.V.at(v, 'body', hv.r, hv.c));
      rankAt(ho);
      if (st.pick && !(ho && ho.r === st.pick.r && ho.c === st.pick.c)) rankAt({ cell: v[st.pick.layer][st.pick.r][st.pick.c], r: st.pick.r, c: st.pick.c });
    }

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
