// 界面重建 · 四套方案样机（tools/ui-lab.html）。
// 只做视觉样机：每套方案 = 设计语言 + 主页面 + 改装台 + 出战 + 小组件，画在 1280×720 的「屏幕」里。
// 车、模块、碳球人物、战斗场景都直接读游戏代码（sprites / legs / coal / scenes），数据是写死的样例，不读存档、不改规则。
window.SA = window.SA || {};

SA.UILAB = (() => {
  const P = SA.PAL, M = SA.MODULES;
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  // ---------- 素材 ----------
  // 裁掉透明边
  function trim(src, pad = 0) {
    const g0 = src.getContext('2d'), d = g0.getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return src;
    const c = document.createElement('canvas'); c.width = x1 - x0 + 1 + pad * 2; c.height = y1 - y0 + 1 + pad * 2;
    c.getContext('2d').drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
    return c;
  }
  // 画布副本，按 scale 整数放大显示（最近邻）
  function show(src, scale = 2, cls = '') {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = `${src.width * scale}px`; c.style.height = `${src.height * scale}px`;
    c.className = `px ${cls}`;
    return c;
  }
  // 样例车：玩家 = 一号原型机（履带炮车再加点东西）；对手 = 第一章 Boss 煤灰寡妇（关卡车记录，没有就用四足蓝图）
  const VEH = {};
  function vehicle(key) {
    if (VEH[key]) return VEH[key];
    let v = null;
    try {
      if (key === 'me') v = SA.V.fromAscii('一号原型机', ['........', '........', '...P....', '...KC...', '...OWA..', '...TTT..'], [], 1);
      else if (key === 'foe') {
        const rec = SA.STAGE_CARS && SA.STAGE_CARS.records && (SA.STAGE_CARS.records['1:2'] || SA.STAGE_CARS.records['1:1']);
        v = rec ? SA.V.fromCells('煤灰寡妇', rec.cells) : null;
      } else if (key.startsWith('bp')) { const b = SA.OFFICIAL_BLUEPRINTS[+key.slice(2)]; v = SA.V.fromAscii(b.name, b.rows, b.sides || [], 1); }
    } catch (e) { console.warn('ui-lab vehicle', key, e); }
    if (!v) { const b = SA.OFFICIAL_BLUEPRINTS[2]; v = SA.V.fromAscii(b.name, b.rows, [], 2); }
    return (VEH[key] = v);
  }
  const CAR = {};
  function car(key, t = 0) {
    const k = `${key}|${t}`;
    if (!CAR[k]) CAR[k] = trim(SA.SPR.renderVehicle(vehicle(key), { key: 'uilab', t, heat: 0.45, water: 0.8 }));
    return CAR[k];
  }
  // 改装台用：按子格对齐裁一块（cols × rows 子格，底边对齐地面、左右以车为中心），网格线能和车的格子对上
  const CELLPX = 24;
  function carGrid(key, cols = 12, rows = 9) {
    const src = SA.SPR.renderVehicle(vehicle(key), { key: 'uilab', t: 0, heat: 0.45, water: 0.8 });
    const g0 = src.getContext('2d', { willReadFrequently: true }), d = g0.getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, x1 = -1;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    const PADX = SA.SPR.PADX, K = SA.K;
    const mid = ((x0 + x1) / 2 - PADX) / CELLPX, sc0 = Math.round(mid - cols / 2), sr0 = K.ROWS - rows;
    const c = document.createElement('canvas'); c.width = cols * CELLPX; c.height = rows * CELLPX + 14;
    c.getContext('2d').drawImage(src, PADX + sc0 * CELLPX, sr0 * CELLPX, c.width, c.height, 0, 0, c.width, c.height);
    c._c0 = sc0; c._r0 = sr0;
    return c;
  }
  // 某个模块在车上的子格范围（第一件）：{ c0, r0, c1, r1 }
  function cellBox(key, id) {
    let b = null;
    SA.V.each(vehicle(key), (cell, r, c) => {
      if (cell.id !== id) return;
      if (b) return;
      const f = SA.fp(id);
      b = { c0: c, r0: r, c1: c + f.w - 1, r1: r + f.h - 1 };
    });
    return b;
  }
  // 车上每个模块的子格范围：[{ id, c0, r0, c1, r1 }]（每件一次）
  function layout(key) {
    const out = [], seen = new Set();
    SA.V.each(vehicle(key), (cell, r, c, layer) => {
      if (seen.has(cell)) return; seen.add(cell);
      const f = SA.fp(cell.id); out.push({ id: cell.id, layer, c0: c, r0: r, c1: c + f.w - 1, r1: r + f.h - 1 });
    });
    return out;
  }
  const svg = (w, hh, inner, style = '') => { const d = document.createElement('div'); d.innerHTML = `<svg class="b-svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" style="${style}">${inner}</svg>`; return d.firstChild; };
  function stats(key) { try { return SA.V.stats(vehicle(key)); } catch (e) { return null; } }
  const MOD = {};
  function mod(id, mt = 1) {
    const k = `${id}|${mt}`;
    if (!MOD[k]) { const c = SA.SPR.moduleCanvas(id, 1, mt); MOD[k] = trim(c); }
    return MOD[k];
  }
  const COAL = {};
  function coal(name, o = {}) {
    const k = `${name}|${JSON.stringify(o)}`;
    if (!COAL[k]) { const ch = SA.Coal.byName[name] || SA.Coal.crew(name); COAL[k] = SA.Coal.draw(ch, Object.assign({ size: 'bust' }, o)); }
    return COAL[k];
  }
  function icon(name, color, scale = 2) { return SA.SPR.iconCanvas(name, color, scale); }
  // 战斗场景截图：id = forge / wild / qual；camx 横向取景，oy 往下挪（看更多地面）
  const SCN = {};
  function scene(id, w = 1280, hgt = 720, camx = 0, oy = 0, t = 3) {
    const k = [id, w, hgt, camx, oy].join('|');
    if (SCN[k]) return SCN[k];
    const c = document.createElement('canvas'); c.width = w; c.height = hgt;
    const g = c.getContext('2d');
    try {
      SA.Scenes.back(id, g, w, hgt, oy, camx, t, {});
      g.save(); g.translate(-camx, -oy); SA.Scenes.floor(id, g, { x: camx, y: oy, w, h: hgt }); g.restore();
      SA.Scenes.front(id, g, w, hgt, oy, camx, t);
    } catch (e) { console.warn('ui-lab scene', id, e); g.fillStyle = '#231e1b'; g.fillRect(0, 0, w, hgt); }
    return (SCN[k] = c);
  }

  // ---------- 滤镜：同一张精灵换成方案 B 的蓝图线稿 / 方案 C 的铜版画 ----------
  const lum = (d, i) => (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
  // 蓝图：外轮廓粗白线，内部明暗变化处细线，暗部稀疏点，其余透明（纸色从底下透上来）
  function blueprint(src, ink = [232, 244, 255]) {
    const w = src.width, hh = src.height, d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, hh).data;
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const g = c.getContext('2d'), out = g.createImageData(w, hh), o = out.data;
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= hh) ? 0 : d[(y * w + x) * 4 + 3] > 8;
    const L = (x, y) => lum(d, (y * w + x) * 4);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!A(x, y)) continue;
      let a = 0;
      if (!A(x - 1, y) || !A(x + 1, y) || !A(x, y - 1) || !A(x, y + 1)) a = 255;
      else {
        const l = L(x, y), e = Math.max(Math.abs(l - L(x + 1, y)), Math.abs(l - L(x, y + 1)));
        if (e > 0.16) a = 170;
        else if (l < 0.22 && ((x + y) & 3) === 0) a = 70;
        else a = 18;
      }
      o[i] = ink[0]; o[i + 1] = ink[1]; o[i + 2] = ink[2]; o[i + 3] = a;
    }
    g.putImageData(out, 0, 0);
    return c;
  }
  // 铜版画：明度先拉伸到 0～1，再按档位排横线（亮处留纸、越暗线越密、最暗加竖线交叉）；外轮廓和明暗交界描实线
  function engrave(src, ink = [34, 24, 18], accent = null) {
    const w = src.width, hh = src.height, d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, hh).data;
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const g = c.getContext('2d'), out = g.createImageData(w, hh), o = out.data;
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= hh) ? 0 : d[(y * w + x) * 4 + 3] > 8;
    let lo = 1, hi = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) { const l = lum(d, i); if (l < lo) lo = l; if (l > hi) hi = l; }
    const L = (x, y) => Math.pow((lum(d, (y * w + x) * 4) - lo) / Math.max(0.05, hi - lo), 0.7);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!A(x, y)) continue;
      const put = (col) => { o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255; };
      // 火光 / 炉口这类很亮的暖色：套一点朱红
      if (accent && d[i] > 200 && d[i + 1] < 140 && d[i + 2] < 90) { if ((x + y) % 2 === 0) put(accent); continue; }
      const edge = !A(x - 1, y) || !A(x + 1, y) || !A(x, y - 1) || !A(x, y + 1);
      const l = L(x, y), e = x + 1 < w && y + 1 < hh && A(x + 1, y) && A(x, y + 1) ? Math.max(Math.abs(l - L(x + 1, y)), Math.abs(l - L(x, y + 1))) : 0;
      let on = edge || e > 0.28;
      if (!on) {
        if (l < 0.18) on = y % 2 === 0 || x % 3 === 0;
        else if (l < 0.38) on = y % 2 === 0;
        else if (l < 0.6) on = y % 3 === 0;
        else if (l < 0.8) on = y % 4 === 0 && x % 2 === 0;
      }
      if (on) put(ink);
    }
    g.putImageData(out, 0, 0);
    return c;
  }

  // ---------- 样例数据（和现在游戏同一套内容，只是写死）----------
  const D = {
    money: 1240, debt: 0, rep: 3, ingots: [['乌兹钢锭', 1]],
    chapter: '第一章 · 后巷', place: '白教堂后巷', chNo: 1,
    stages: [
      { name: '铁皮罐头', pilot: '锅炉工 胖哈利', done: true, terrain: '货箱', prize: 130 },
      { name: '双管哨兵', pilot: '扒手 机灵杰克', done: true, terrain: '平地', prize: 150 },
      { name: '煤灰寡妇', pilot: '玛莎·布莱克', boss: true, next: true, terrain: '货箱', prize: 220 },
    ],
    chapters: ['序章 · 铁匠铺后院', '第一章 · 后巷', '第二章 · 码头区', '第三章 · 工厂区', '第四章 · ？', '第五章 · 水晶宫'],
    foeTags: ['高抛炮砸顶', '两台锅炉在车尾', '四足：比你快一倍', '货箱挡直射'],
    reward: { money: 220, rep: 1, salvage: '缴获 1 件（可能有唯一件）' },
    // 库存（id, 材料档, 件数, 价格）；价格只是样例
    inv: [
      ['armor', 1, 4, 18], ['armor', 2, 1, 29], ['cannon', 1, 1, 120], ['mg_s', 1, 2, 60], ['mortar_s', 1, 0, 140],
      ['boiler_s', 1, 1, 90], ['tank_s', 1, 2, 40], ['radiator', 1, 0, 70], ['helmet', 1, 0, 110], ['spike', 1, 1, 45], ['bucket', 1, 0, 80],
      ['track', 1, 1, 150], ['quad', 1, 0, 140], ['biped', 1, 0, 120], ['periscope', 1, 0, 95],
    ].filter(([id]) => M[id]),
  };
  // 某一类的全部模块（不含唯一件 / Boss 件）：[id, 材料档, 件数, 价格]，件数取样例库存
  function catItems(cat) {
    return Object.keys(M).filter(id => M[id].cat === cat && !M[id].unique && !id.startsWith('boss_'))
      .map(id => { const own = D.inv.filter(x => x[0] === id).reduce((a, x) => a + x[2], 0); return [id, 1, own, M[id].price || 100]; });
  }
  // 玩家车的几条真实读数（问题提示里用）
  function facts() {
    const s = stats('me') || {}, f = (x) => Math.round(x * 10) / 10;
    return { demand: f(s.demand || 0), supply: f(s.supply || 0), rating: s.rating || 0, foeRating: (stats('foe') || {}).rating || 0 };
  }
  const money = (n) => `£${Math.round(n).toLocaleString()}`;
  const catOf = (id) => M[id].cat;
  const CATS = ['mobility', 'control', 'energy', 'cooling', 'structure', 'firepower', 'ram'];
  // 六个属性（真实数值从 SA.V.stats 读，读不到用样例）
  function gauges(key = 'me') {
    const s = stats(key) || {};
    const f = (x, d) => (Number.isFinite(x) ? x : d);
    const heatShare = s.heatGen != null ? Math.min(1, (s.heatGen + SA.K.IDLE_HEAT) / Math.max(0.1, SA.K.DISSIPATE + s.cool)) : 0.62;
    return [
      { k: 'power', name: '动力', val: `${f(s.demand, 7)} / ${f(s.supply, 8)}`, pct: Math.min(1, f(s.demand, 7) / Math.max(1, f(s.supply, 8))), note: '需求 / 锅炉供给', delta: +0.12 },
      { k: 'weight', name: '重量', val: `${SA.tons ? SA.tons(f(s.weight, 5)) : '5 t'}`, pct: Math.min(1, f(s.weight, 5) / Math.max(1, f(s.load, 7))), note: `承重 ${SA.tons ? SA.tons(f(s.load, 7)) : '7 t'}`, delta: +0.06 },
      { k: 'speed', name: '速度', val: SA.kmh ? SA.kmh(f(s.topSpeed, 40)) : '6 km/h', pct: Math.min(1, f(s.topSpeed, 40) / 100), note: '最高速度', delta: -0.04 },
      { k: 'heat', name: '热量', val: `${Math.round(heatShare * 100)}%`, pct: heatShare, note: s.overheat === Infinity ? '不会烧干' : `全力开火 ${Math.round(f(s.overheat, 44))} 秒烧干`, delta: +0.08 },
      { k: 'water', name: '水', val: `${f(s.water, 180)}`, pct: Math.min(1, f(s.water, 180) / 250), note: `${f(s.tanks, 1)} 只水箱`, delta: 0 },
      { k: 'hp', name: '耐久', val: `${f(s.maxHp, 420)}`, pct: Math.min(1, f(s.maxHp, 420) / 800), note: `评分 ${f(s.rating, 73)}`, delta: +0.1 },
    ];
  }

  // ---------- 屏幕框：1280×720，按容器宽度缩放 ----------
  const W = 1280, H = 720;
  function screen(cls, ...kids) {
    const inner = h('div', { class: `scr ${cls}` }, ...kids);
    const box = h('div', { class: 'stage' }, inner);
    const fit = () => { const s = box.clientWidth / W; inner.style.transform = `scale(${s})`; box.style.height = `${H * s}px`; };
    new ResizeObserver(fit).observe(box);
    return box;
  }

  // ---------- 方案登记 + 页面控制 ----------
  const PROPS = [];
  const add = (p) => PROPS.push(p);
  const PAGES = [['lang', '设计语言'], ['home', '主页面'], ['garage', '改装台'], ['arena', '出战'], ['parts', '小组件']];
  const KEY = 'steam_arena_uilab_v1';
  let st = { view: 'prop', prop: 'A', page: 'all', picks: {} };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 隐私模式 */ }
  // 地址里 #p=D 直接看某一套、#cmp=garage 直接对比某一页（截图工具用）
  { const m = /[#?&]p=([A-D])/.exec(location.href), c = /[#?&]cmp=(\w+)/.exec(location.href);
    if (m) Object.assign(st, { view: 'prop', prop: m[1], page: 'all' });
    if (c) Object.assign(st, { view: 'cmp', page: c[1] }); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([k, n]) => h('button', { class: k === cur ? 'on' : '', onclick: () => on(k) }, n)));
  function pickBtn(pid, page) {
    const on = st.picks[page] === pid;
    return h('button', { class: `pick ${on ? 'on' : ''}`, onclick: () => { st.picks[page] = on ? undefined : pid; save(); render(); } }, on ? '✔ 已选这个' : `选这个（${PAGES.find(p => p[0] === page)[1]}）`);
  }
  function block(p, page) {
    const title = PAGES.find(x => x[0] === page)[1];
    const note = p.notes && p.notes[page];
    return h('section', { class: 'blk', 'data-k': `${p.id}-${page}` },
      h('div', { class: 'blk-h' }, h('b', {}, `${p.id} · ${title}`), note ? h('span', { class: 'muted' }, note) : null, pickBtn(p.id, page)),
      p[page]());
  }
  function render() {
    const ctl = document.getElementById('ctl'), out = document.getElementById('out');
    const pages = [['all', '全部'], ...PAGES];
    const picks = PAGES.filter(([k]) => st.picks[k]).map(([k, n]) => `${n} ${st.picks[k]}`);
    ctl.replaceChildren(...[
      h('span', { class: 'k' }, '看法'), seg([['prop', '按方案看'], ['cmp', '按页面对比']], st.view, (k) => { st.view = k; if (k === 'cmp' && st.page === 'all') st.page = 'home'; save(); render(); }),
      st.view === 'prop' ? [h('span', { class: 'k' }, '方案'), seg(PROPS.map(p => [p.id, `${p.id} ${p.name}`]), st.prop, (k) => { st.prop = k; save(); render(); })] : null,
      h('span', { class: 'k' }, '页面'), seg(st.view === 'cmp' ? PAGES : pages, st.page, (k) => { st.page = k; save(); render(); }),
      h('span', { class: 'picks' }, '我的选择：', picks.length ? h('b', {}, picks.join(' · ')) : h('span', { class: 'muted' }, '还没选（每个画面下面点「选这个」，可以混搭）'))].flat().filter(Boolean));
    out.replaceChildren();
    if (st.view === 'prop') {
      const p = PROPS.find(x => x.id === st.prop) || PROPS[0];
      out.append(h('div', { class: `pitch pitch-${p.id}` },
        h('div', { class: 'pitch-t' }, h('span', { class: 'pid' }, p.id), h('b', {}, p.name), h('span', { class: 'tag' }, p.tag)),
        h('p', {}, p.pitch),
        h('div', { class: 'pc' }, h('div', {}, h('i', {}, '长处'), h('ul', {}, p.pros.map(x => h('li', {}, x)))), h('div', {}, h('i', {}, '代价'), h('ul', {}, p.cons.map(x => h('li', {}, x)))))));
      for (const [k] of PAGES) if (st.page === 'all' || st.page === k) out.append(block(p, k));
    } else {
      out.append(h('div', { class: 'cmp' }, PROPS.map(p => block(p, st.page))));
    }
  }
  function mount() { render(); }

  return { add, mount, PROPS, h, trim, show, vehicle, car, carGrid, CELLPX, cellBox, layout, svg, catItems, facts, stats, mod, coal, icon, scene, blueprint, engrave, D, money, catOf, CATS, gauges, screen, W, H };
})();
