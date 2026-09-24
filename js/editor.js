// 改装：格子编辑器（主体层 / 侧挂层，像素 / 蓝图视图）
window.SA = window.SA || {};

SA.Editor = (() => {
  const h = SA.h, K = SA.K, M = SA.MODULES, P = SA.PAL;
  const PADX = SA.SPR.PADX, C = K.CELL;
  const W = K.COLS * C + PADX * 2, H = K.ROWS * C + 12;
  const st = { layer: 'body', view: 'pixel', sel: null, tool: 'place', hover: null, stats: null, tab: 'all', sort: 'default', stockOnly: false, plateOpen: true };
  let cv, g, hintEl, sideEl, wrap, topEl, plateEl;
  const TABS = [['all', '全部'], ['mobility', '底盘'], ['firepower', '火力'], ['ram', '撞击'], ['structure', '结构'], ['energy', '能源'], ['cooling', '冷却'], ['control', '控制']];
  const SORTS = [['default', '默认顺序'], ['q_desc', '品质 高→低'], ['q_asc', '品质 低→高'], ['stock', '库存 多→少'], ['price', '价格 高→低']];

  const d = () => SA.S.d;

  function open() {
    SA.go('editor');
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    st.stats = SA.V.stats(d().vehicle);
    cv = h('canvas', { class: 'px', width: W, height: H });
    g = cv.getContext('2d');
    hintEl = h('div', { class: 'ed-hint' });
    sideEl = h('aside', { class: 'ed-side' });
    topEl = h('div', { class: 'ed-top' });
    plateEl = h('div', { class: 'brass-plate' });
    wrap = h('div', { class: 'ed-canvas-wrap' }, cv, hintEl, legend());
    screen.append(h('div', { class: 'ed' }, topEl, h('div', { class: 'ed-main' }, wrap, sideEl, plateEl)));

    cv.addEventListener('pointermove', (e) => { st.hover = cellAt(e); updateHint(); });
    cv.addEventListener('pointerleave', () => { st.hover = null; updateHint(); });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    renderTop();
    renderSide();
    renderPlate();
    setHint('选择右侧的模块，再点击格子放置。右键或「拆除」工具拆下模块。');
    requestAnimationFrame(() => { fit(); loop(); });
  }

  function close() {
    window.removeEventListener('resize', fit);
    document.removeEventListener('keydown', onKey);
    SA.S.save();
    SA.go('workshop');
  }

  function onKey(e) {
    if (SA.current !== 'editor') return;
    if (e.key === 'Escape') { st.sel = null; st.tool = 'place'; renderTop(); renderSide(); }
  }

  function fit() {
    if (!cv || !wrap.isConnected) return;
    const aw = wrap.clientWidth - 24;
    const ah = Math.max(260, window.innerHeight - 200);
    let s = Math.min(aw / W, ah / H);
    s = s >= 1 ? Math.floor(s) : s;
    cv.style.width = `${W * s}px`;
    cv.style.height = `${H * s}px`;
  }

  function cellAt(e) {
    const rc = cv.getBoundingClientRect();
    const x = (e.clientX - rc.left) / rc.width * W, y = (e.clientY - rc.top) / rc.height * H;
    const c = Math.floor((x - PADX) / C), r = Math.floor(y / C);
    return r >= 0 && r < K.ROWS && c >= 0 && c < K.COLS ? { r, c } : null;
  }

  function setHint(text, err) {
    hintEl.textContent = text;
    hintEl.classList.toggle('err', !!err);
  }

  function updateHint() {
    const v = d().vehicle, hv = st.hover;
    if (!hv) return;
    if (st.tool === 'remove') {
      const cell = v[st.layer][hv.r][hv.c];
      setHint(cell ? `拆下 ${M[cell.id].name}${cell.hp <= 0 ? '（已损毁，将报废回收 10%）' : ''}` : '这里是空的');
      return;
    }
    if (st.sel) {
      const chk = SA.V.canPlace(v, st.sel, hv.r, hv.c);
      setHint(chk.ok ? `放置 ${M[st.sel].name}：第 ${K.ROWS - hv.r} 层 第 ${hv.c + 1} 列` : chk.reason, !chk.ok);
      return;
    }
    const side = v.side[hv.r][hv.c], body = v.body[hv.r][hv.c];
    const cell = (st.layer === 'side' && side) || body || side;
    if (cell) {
      const m = M[cell.id];
      setHint(`${m.name}（${SA.CAT[m.cat].name}）· 耐久 ${Math.max(0, cell.hp)}/${SA.V.maxHp(cell)} · ${SA.UI.statLine(cell.id).split(" · ").slice(1).join(" · ")}`);
    } else setHint(`第 ${K.ROWS - hv.r} 层 第 ${hv.c + 1} 列 · 空`);
  }

  function onDown(e) {
    e.preventDefault();
    const cell = cellAt(e);
    if (!cell) return;
    st.hover = cell;
    if (e.button === 2 || st.tool === 'remove') doRemove(cell);
    else if (st.sel) doPlace(cell);
    updateHint();
  }

  function changed() {
    st.stats = SA.V.stats(d().vehicle);
    SA.S.save();
    SA.UI.topbar();
    renderSide();
    renderPlate();
  }

  function doPlace({ r, c }) {
    const id = st.sel;
    if (!(d().inv[id] > 0)) { setHint('库存不足，去商店购买', true); return; }
    const chk = SA.V.place(d().vehicle, id, r, c);
    if (!chk.ok) { setHint(chk.reason, true); return; }
    SA.S.addInv(id, -1);
    if (!d().inv[id]) st.sel = null;
    changed();
  }

  function doRemove({ r, c }) {
    const v = d().vehicle;
    let layer = st.layer;
    if (layer === 'side' && !v.side[r][c]) { setHint('侧挂层这里没有侧炮', true); return; }
    const res = SA.V.remove(v, layer, r, c);
    if (!res.ok) { setHint(res.reason, true); return; }
    let scrap = 0;
    for (const cell of res.removed) {
      if (cell.hp <= 0) scrap += Math.round(M[cell.id].price * 0.1);
      else SA.S.addInv(cell.id, 1);
    }
    if (scrap) { d().money += scrap; SA.UI.toast(`损毁模块报废，回收 £${scrap}`); }
    changed();
  }

  // ---------- 顶栏 ----------
  function renderTop() {
    topEl.innerHTML = '';
    const nameIn = h('input', { type: 'text', value: d().vehicle.name, maxLength: 20, onchange: () => { d().vehicle.name = nameIn.value.trim() || '原型机'; SA.S.save(); } });
    const seg = (items, cur, set) => h('span', { class: 'seg' }, items.map(([k, n]) =>
      h('button', { class: `btn small ${cur === k ? 'on' : ''}`, onclick: () => { set(k); renderTop(); renderSide(); } }, n)));
    topEl.append(
      h('button', { class: 'btn small', onclick: close }, SA.SPR.iconCanvas('back', P.text || '#e4e0d6', 2), ''),
      h('b', {}, '改装'), nameIn,
      h('span', { class: 'lbl' }, '图层'),
      seg([['body', '主体层'], ['side', '侧挂层']], st.layer, (k) => { st.layer = k; if (st.sel && SA.V.layerOf(st.sel) !== k) st.sel = null; }),
      h('span', { class: 'lbl' }, '视图'),
      seg([['pixel', '像素'], ['blueprint', '蓝图']], st.view, (k) => { st.view = k; }),
      h('button', { class: `btn small ${st.tool === 'remove' ? 'on' : ''}`, onclick: () => { st.tool = st.tool === 'remove' ? 'place' : 'remove'; st.sel = null; renderTop(); renderSide(); } }, '拆除工具'),
    );
    topEl.firstChild.querySelector('canvas').style.display = 'inline-block';
    topEl.firstChild.append(' 返回工坊');
  }

  // ---------- 黄铜性能铭牌：悬浮在改装界面左上角，可折叠 ----------
  function renderPlate() {
    const s = st.stats;
    plateEl.innerHTML = '';
    plateEl.classList.toggle('closed', !st.plateOpen);
    const flag = s.problems.length ? h('span', { class: 'flag bad' }, `${s.problems.length} 项问题`) : s.warnings.length ? h('span', { class: 'flag' }, `${s.warnings.length} 项提醒`) : null;
    plateEl.append(
      h('button', { class: 'plate-head', title: st.plateOpen ? '收起' : '展开', onclick: () => { st.plateOpen = !st.plateOpen; renderPlate(); } },
        h('b', {}, '性能'), h('span', { class: 'rating' }, `评分 ${s.rating}`), flag, h('span', { class: 'fold' }, st.plateOpen ? '▴' : '▾')),
      st.plateOpen ? h('div', { class: 'plate-body' }, SA.UI.statBars(s)) : null);
  }

  // ---------- 侧栏：库存（按类别分标签页，可按品质排序）----------
  function renderSide() {
    const inv = d().inv;
    sideEl.innerHTML = '';
    const ids = SA.MODULE_ORDER.filter(id => SA.V.layerOf(id) === st.layer);
    const tabs = TABS.filter(([k]) => k === 'all' || ids.some(id => M[id].cat === k));
    if (!tabs.some(([k]) => k === st.tab)) st.tab = 'all';
    const stockOf = (k) => ids.filter(id => k === 'all' || M[id].cat === k).reduce((a, id) => a + (inv[id] || 0), 0);
    const ord = (id) => SA.MODULE_ORDER.indexOf(id);
    const cmp = {
      default: (a, b) => ord(a) - ord(b),
      q_desc: (a, b) => M[b].q - M[a].q || ord(a) - ord(b),
      q_asc: (a, b) => M[a].q - M[b].q || ord(a) - ord(b),
      stock: (a, b) => (inv[b] || 0) - (inv[a] || 0) || ord(a) - ord(b),
      price: (a, b) => M[b].price - M[a].price || ord(a) - ord(b),
    }[st.sort];
    const list = ids.filter(id => (st.tab === 'all' || M[id].cat === st.tab) && (!st.stockOnly || inv[id] > 0)).sort(cmp);
    const sortSel = h('select', { class: 'sel', onchange: () => { st.sort = sortSel.value; renderSide(); } },
      SORTS.map(([k, n]) => h('option', { value: k, selected: st.sort === k }, n)));
    sideEl.append(
      h('div', {}, h('h3', {}, st.layer === 'side' ? '库存 · 侧挂层（只能挂远程武器）' : '库存 · 主体层'),
        tabs.length > 2 ? h('div', { class: 'inv-tabs' }, tabs.map(([k, n]) =>
          h('button', { class: `tab ${st.tab === k ? 'on' : ''} ${k !== 'all' ? `cat-${k}` : ''}`, onclick: () => { st.tab = k; renderSide(); } },
            n, h('span', { class: 'cnt' }, stockOf(k))))) : null,
        h('div', { class: 'inv-tools' }, h('span', { class: 'lbl' }, '排序'), sortSel,
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: st.stockOnly, onchange: (e) => { st.stockOnly = e.target.checked; renderSide(); } }), '只看有库存')),
        list.length ? h('div', { class: 'inv' }, list.map(id => {
          const m = M[id], n = inv[id] || 0, q = SA.QUALITY[m.q];
          return h('button', { class: `btn inv-item cat-${m.cat} ${st.sel === id ? 'sel' : ''} ${n ? '' : 'empty'}`,
            title: `${m.desc}\n${SA.UI.statLine(id)}`,
            onclick: () => {
              if (!n) { setHint(`${m.name} 没有库存，去工坊的「商店」购买`, true); return; }
              st.sel = st.sel === id ? null : id; st.tool = 'place';
              renderTop(); renderSide();
              setHint(st.sel ? `${m.name}：${m.desc}` : '');
            } },
            SA.SPR.moduleCanvas(id, 1),
            h('span', {}, h('div', { class: 'nm' }, m.name), h('div', { class: `q q${m.q}` }, `${q.star} ${q.name}`), h('div', { class: 'n' }, `库存 ${n}`)));
        })) : h('p', { class: 'muted', style: 'font-size:12px' }, '这一类没有库存。去工坊的「商店」购买。')),
      h('p', { class: 'muted', style: 'font-size:12px;margin:0' },
        st.layer === 'side'
          ? '侧挂层：侧炮挂在任意主体模块上，射击不会被己方挡住，但命中率低。被瞄准时敌人只打侧炮，不会伤到下面的模块；下面的模块被毁，侧炮也会掉落。'
          : '主体层：模块必须叠在底盘或其他模块上，最高 6 层。直射火炮、机枪的同一行前方不能有己方模块；高抛火炮不受影响。撞击武器（铲斗/撞角/撞锤）装在底盘或装甲的正前方（右侧），必须是这一行的最前端。'),
    );
  }

  function legend() {
    return h('div', { class: 'legend' }, Object.values(SA.CAT).map(c => h('span', {}, h('i', { style: `background:${c.plate}` }), c.name)));
  }

  // ---------- 绘制 ----------
  function corners(x, y, col) {
    SA.SPR.useCtx(g);
    const e = C - 1, L = 6;
    for (const [dx, dy, w, hh] of [[1, 1, L, 2], [1, 1, 2, L], [e - L, 1, L, 2], [e - 1, 1, 2, L], [1, e - 1, L, 2], [1, e - L, 2, L], [e - L, e - 1, L, 2], [e - 1, e - L, 2, L]])
      SA.SPR.R(x + dx, y + dy, w, hh, col);
  }

  function draw(t) {
    const v = d().vehicle;
    const bp = st.view === 'blueprint';
    g.fillStyle = bp ? '#10335c' : P.bg[2];
    g.fillRect(0, 0, W, H);
    if (!bp) {
      // 工坊地面与格子参考线
      g.fillStyle = P.bg[3]; g.fillRect(0, H - 12, W, 12);
      g.fillStyle = P.bg[4]; g.fillRect(0, H - 12, W, 1);
      g.fillStyle = P.bg[1];
      for (let c = 0; c <= K.COLS; c++) g.fillRect(PADX + c * C, 0, 1, K.ROWS * C);
      for (let r = 0; r <= K.ROWS; r++) g.fillRect(PADX, r * C, K.COLS * C, 1);
      // 有底盘的列：淡色承载柱，提示可以往上叠
      g.fillStyle = 'rgba(111,207,106,0.06)';
      for (let c = 0; c < K.COLS; c++) if (v.body[K.ROWS - 1][c]) g.fillRect(PADX + c * C, 0, C, K.ROWS * C);
    }
    g.drawImage(SA.SPR.renderVehicle(v, {
      key: 'editor', t, view: st.view, heat: 0.35, water: 1, showWrecks: true, showBlocked: true,
      blocked: st.stats.blocked, dimBody: st.layer === 'side' && !bp,
    }), 0, 0);

    const hv = st.hover;
    if (st.sel) {
      for (let r = 0; r < K.ROWS; r++)
        for (let c = 0; c < K.COLS; c++)
          if (SA.V.canPlace(v, st.sel, r, c).ok) corners(PADX + c * C, r * C, P.white);
      if (hv) {
        const x = PADX + hv.c * C, y = hv.r * C;
        if (SA.V.canPlace(v, st.sel, hv.r, hv.c).ok) {
          g.globalAlpha = 0.7;
          SA.SPR.drawModule(g, st.sel, x, y, { t, heat: 0.3, water: 1 });
          g.globalAlpha = 1;
          SA.SPR.outline(g, x, y, C, C, P.white, P.black);
        } else {
          SA.SPR.useCtx(g);
          const a = Math.round(C * 0.25), b = Math.round(C * 0.75);
          SA.SPR.line(x + a, y + a, x + b, y + b, 5, P.black);
          SA.SPR.line(x + b, y + a, x + a, y + b, 5, P.black);
          SA.SPR.line(x + a, y + a, x + b, y + b, 3, P.white);
          SA.SPR.line(x + b, y + a, x + a, y + b, 3, P.white);
        }
      }
    } else if (hv) {
      const cell = v[st.layer][hv.r][hv.c] || (st.tool !== 'remove' && v.body[hv.r][hv.c]);
      if (cell) {
        const side = st.layer === 'side' && v.side[hv.r][hv.c];
        if (st.tool === 'remove') SA.SPR.outline(g, PADX + hv.c * C, hv.r * C, C, C, P.white, P.black, Math.floor(t * 8));
        else SA.SPR.outline(g, PADX + hv.c * C, hv.r * C, C, C, side ? SA.PAL.magenta : P.white, P.black);
      }
    }
  }

  function loop() {
    if (SA.current !== 'editor') return;
    draw(performance.now() / 1000);
    requestAnimationFrame(loop);
  }

  return { open };
})();
