// 方案 B · 工程蓝图：整个游戏是一张张晒图纸——车是线稿加引线标注，属性是标尺，零件是零件表，问题用红铅笔圈出来。
(() => {
  const U = SA.UILAB, { h, D, money, svg } = U, M = SA.MODULES;
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const pct = (x) => `${Math.max(0, Math.min(100, x * 100)).toFixed(1)}%`;
  const INK = '#eaf4ff', RED = '#ff6a58', HL = '#ffe066';

  function tabs(on) {
    const T = [['home', '总图'], ['garage', '改装'], ['arena', '出战'], ['bp', '蓝图库'], ['bank', '银行']];
    return h('div', { class: 'b-tabs' }, T.map(([k, n]) => h('b', { class: k === on ? 'on' : '' }, n, k === 'garage' ? h('span', { class: 'n' }, '●1') : null)));
  }
  function scale(g, lim) {
    const bad = g.pct >= 1;
    return h('div', { class: `b-scale ${bad ? 'bad' : ''}` },
      h('div', { class: 'top' }, h('b', {}, g.name), g.delta ? h('span', { class: `d ${g.delta < 0 ? 'dn' : ''}` }, g.delta > 0 ? '▲' : '▼') : null, h('span', { class: 'v' }, g.val)),
      h('div', { class: 'tr' }, h('i', { class: 'fill', style: `width:${pct(Math.min(1, g.pct))}` }),
        g.delta ? h('i', { class: 'ghost', style: `left:${pct(Math.min(g.pct, g.pct + g.delta))};width:${pct(Math.abs(g.delta))}` }) : null,
        lim != null ? h('i', { class: 'lim', style: `left:${pct(lim)}` }) : null),
      h('span', { class: 'note' }, g.note));
  }
  const chip = (mt) => { const m = SA.MATS[mt]; return h('span', { class: 'b-chip' }, h('i', { style: `background:${m.chip}` }), `T${mt} ${m.name}`); };
  function titleBlock() {
    const F = U.facts();
    const cell = (k, v) => h('td', {}, h('i', {}, k), h('b', {}, v));
    return h('table', { class: 'b-tb' }, h('tr', {}, cell('项目', '蒸汽竞技场'), cell('图号', 'SA-000'), cell('资金', money(D.money)), cell('声望', '★'.repeat(D.rep)), cell('材料', D.ingots.map(([k, n]) => `${k}×${n}`).join(' ')), cell('评分', F.rating), cell('日期', '1887-10')));
  }
  // 线稿车 + 模块位置（按子格对齐）
  function drawing(key, cols, rows, s, flip) {
    const cv = U.carGrid(key, cols, rows), bp = U.blueprint(cv);
    const el = U.show(bp, s); if (flip) el.style.transform = 'scaleX(-1)';
    const at = (b) => {
      const w = cv.width * s, x0 = (b.c0 - cv._c0) * U.CELLPX * s, x1 = (b.c1 + 1 - cv._c0) * U.CELLPX * s;
      return { x: flip ? w - x1 : x0, y: (b.r0 - cv._r0) * U.CELLPX * s, w: x1 - x0, h: (b.r1 - b.r0 + 1) * U.CELLPX * s };
    };
    return { el, cv, at, w: cv.width * s, h: cv.height * s };
  }

  // ---------- 设计语言 ----------
  function lang() {
    const sw = (c, n) => h('div', { style: 'display:grid;gap:4px;justify-items:center;font-size:11px' }, h('i', { style: `width:54px;height:40px;background:${c};border:2px solid #eaf4ff` }), n);
    const g = U.gauges('me');
    return h('div', { class: 'pb sheet' },
      h('div', { class: 'row' },
        h('div', { style: 'flex:1;min-width:300px' },
          h('div', { class: 'b-h', style: 'font-size:32px' }, '工程蓝图'), h('div', { class: 'b-cap' }, 'SA-000 · 设计语言 · 比例 1:1'),
          h('p', { style: 'line-height:1.7;max-width:560px' }, '这是一个「造车」的游戏，那就让界面像总工程师的图纸。车在改装台上就是一张图：网格就是图纸方格，零件是零件表，属性是标尺；问题用红铅笔圈，选中用黄色荧光笔。信息最清楚、最好比较，适合喜欢算构筑的玩家。')),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [['#15427a', '晒图纸'], ['#0f3464', '纸·暗'], ['#eaf4ff', '白线'], ['#b3d3f5', '次要线'], ['#ffe066', '荧光笔·选中'], ['#ff6a58', '红铅笔·问题'], ['#8ff0b0', '验收章']].map(([c, n]) => sw(c, n)))),
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'b-h' }, '标题 · 黑体加宽字距'), h('div', { class: 'mono', style: 'font-size:18px;margin-top:6px' }, '数字 · 等宽 0123456789 £1,240'), h('div', { style: 'font:18px KaiTi,STKaiti,serif;color:var(--red);margin-top:6px' }, '红铅笔批注 · 楷体')),
        h('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, h('button', { class: 'b-btn pri' }, '主操作'), h('button', { class: 'b-btn' }, '次操作'), h('button', { class: 'b-btn red' }, '拆除'), h('button', { class: 'b-btn off' }, '不可用'), h('button', { class: 'b-btn sm' }, '小按钮 ', h('span', { class: 'k' }, 'Ctrl+Z')))),
      h('div', { class: 'row' },
        h('div', { class: 'b-sheet', 'data-no': 'SA-010', style: 'width:300px' }, h('div', { class: 't' }, '图框面板', h('small', {}, '双线外框')), h('div', { style: 'font-size:13px' }, '所有面板都是一张图：外粗内细两道框，右上角图号。')),
        h('div', { style: 'display:grid;gap:10px' }, tabs('garage'), h('span', { class: 'b-cap' }, '页签 = 图纸夹的分页；红点 = 有问题')),
        h('div', { style: 'display:flex;gap:18px;align-items:center' }, h('span', { class: 'b-stamp ok' }, '已验收'), h('span', { class: 'b-stamp' }, '待验证'), h('span', { class: 'b-stamp' }, '未开放'))),
      h('div', { class: 'row' },
        h('div', { style: 'width:300px;display:grid;gap:12px' }, scale(g[0], 0.77), scale(g[1], 1), scale(g[3])),
        h('div', { style: 'max-width:300px;font-size:13px;line-height:1.7' }, '标尺：斜线 = 现在；', h('b', { style: 'color:var(--hl)' }, '黄框'), ' = 装上手里的零件以后；', h('b', { style: 'color:var(--red)' }, '红竖线'), ' = 上限（锅炉供给、底盘承重）。超了整条变红。'),
        h('div', { style: 'position:relative;width:260px;height:120px' },
          svg(260, 120, `<circle cx="40" cy="70" r="26" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="5 3"/><path d="M64 58 L120 30" stroke="${RED}" stroke-width="2" fill="none"/><circle cx="40" cy="70" r="3" fill="${INK}"/><path d="M40 70 L40 110 L110 110" stroke="${INK}" stroke-width="1.5" fill="none"/>`),
          h('span', { class: 'b-call red', style: 'left:120px;top:14px' }, '动力不够 → 加锅炉'),
          h('span', { class: 'b-call', style: 'left:110px;top:98px' }, h('b', {}, '锅炉'), ' 耐久 120'))));
  }

  // ---------- 主页面：总图 ----------
  function home() {
    const F = U.facts(), D1 = drawing('me', 8, 9, 2), L = U.layout('me');
    const ox = 214, oy = 132;
    const lbl = { mortar: '臼炮 · 高抛', cockpit: '驾驶舱', cannon_m: '中炮 · 直射', boiler: '锅炉', water: '水箱', armor: '铁装甲 ×2', track: '履带 ×3' };
    const shown = new Set(); let calls = '', boxes = [];
    const sides = { mortar: [-120, -10], cockpit: [-130, 10], boiler: [-130, 20], track: [-120, 30], cannon_m: [120, -30], water: [150, 50], armor: [120, 20] };
    for (const b of L) {
      if (shown.has(b.id) || !lbl[b.id]) continue; shown.add(b.id);
      const r = D1.at(b), cx = ox + r.x + r.w / 2, cy = oy + r.y + r.h / 2, [dx, dy] = sides[b.id] || [120, 0];
      const lx = dx < 0 ? ox - 24 : ox + D1.w + 14, ly = cy + dy;
      calls += `<circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/><path d="M${cx} ${cy} L${lx} ${ly}" stroke="${INK}" stroke-width="1.2"/>`;
      boxes.push(h('span', { class: `b-call ${b.id === 'boiler' ? 'red' : ''}`, style: `${dx < 0 ? `right:${1280 - lx}px` : `left:${lx}px`};top:${ly - 11}px` }, b.id === 'boiler' ? `锅炉不够 ${F.demand} > ${F.supply}` : h('b', {}, lbl[b.id])));
    }
    const bo = D1.at(L.find(b => b.id === 'boiler'));
    calls += `<ellipse cx="${ox + bo.x + bo.w / 2}" cy="${oy + bo.y + bo.h / 2}" rx="${bo.w * 0.75}" ry="${bo.h * 0.7}" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="6 3"/>`;
    // 尺寸线
    const gy = oy + D1.h - 14 * 2, top = oy + 64;
    calls += `<path d="M${ox + D1.w + 8} ${top} L${ox + D1.w + 8} ${gy}" stroke="${INK}" stroke-width="1" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    calls += `<path d="M${ox} ${gy + 30} L${ox + D1.w} ${gy + 30}" stroke="${INK}" stroke-width="1"/><path d="M${ox} ${gy + 22} v16 M${ox + D1.w} ${gy + 22} v16" stroke="${INK}"/>`;
    const stages = D.stages.map((s, i) => h('div', { class: `b-node ${s.done ? 'done' : s.next ? 'next' : ''}` }, h('b', {}, s.name), h('span', { class: 'b-cap' }, s.boss ? 'BOSS · ' + s.pilot : s.pilot), s.done ? h('span', { class: 'b-stamp ok' }, '已验收') : null));
    return U.screen('pb',
      ab(24, 14, null, null, tabs('home')),
      ab(0, 50, 1280, 2, h('div', { class: 'b-rule' })),
      ab(1080, 14, null, null, h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'b-btn sm' }, '? 说明'), h('button', { class: 'b-btn sm' }, '⚙ 设置'))),
      ab(24, 70, 660, 568, h('div', { class: 'b-sheet', 'data-no': '图 SA-001', style: 'height:100%' }, h('div', { class: 't' }, '一号原型机 · 侧视', h('small', {}, '比例 1:24 · 点图进改装台')))),
      ab(ox, oy, null, null, D1.el),
      svg(1280, 720, `<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${INK}"/></marker></defs>${calls}`),
      boxes,
      ab(ox + D1.w + 16, (top + gy) / 2 - 10, null, null, h('span', { class: 'mono', style: 'font-size:12px' }, '高 5 层')),
      ab(ox + D1.w / 2 - 70, gy + 36, 140, null, h('div', { class: 'mono', style: 'font-size:12px;text-align:center' }, `宽 3 格 · ${SA.tons(U.stats('me').weight)}`)),
      ab(44, oy + bo.y + bo.h / 2 + 34, null, null, h('button', { class: 'b-btn sm red' }, '去改装台修 →')),
      ab(24, 650, null, null, titleBlock()),
      // 右：下一项 + 进度
      ab(704, 70, 552, 214, h('div', { class: 'b-sheet', 'data-no': 'SA-101', style: `height:100%;border-color:${HL};outline-color:rgba(255,224,102,.5)` },
        h('div', { class: 't', style: `color:${HL};border-color:${HL}` }, '下一项试验', h('small', {}, `${D.chapter} · 第 3 场`)),
        h('div', { style: 'display:flex;gap:16px' },
          U.show(U.blueprint(U.coal('玛莎·布莱克'), [255, 224, 102]), 1),
          h('div', { style: 'flex:1;display:grid;gap:6px;align-content:start' },
            h('div', { class: 'b-h', style: 'font-size:24px;color:var(--hl)' }, '煤灰寡妇 ', h('span', { class: 'b-stamp' }, 'BOSS')),
            h('div', { style: 'font-size:13px' }, '玛莎·布莱克 · 场地 货箱 · 奖金 ', h('b', { class: 'mono' }, money(220))),
            h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, D.foeTags.map(t => h('span', { class: 'b-chip', style: 'font-family:inherit' }, t))),
            h('div', { style: 'display:flex;gap:10px;margin-top:6px' }, h('button', { class: 'b-btn pri' }, '出战 →'), h('button', { class: 'b-btn' }, '先去改装')))))),
      ab(704, 300, 552, 270, h('div', { class: 'b-sheet', 'data-no': 'SA-100', style: 'height:100%' },
        h('div', { class: 't' }, '工程进度', h('small', {}, '战役')),
        h('div', { style: 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px' }, D.chapters.map((c, i) => h('div', { class: `b-node ${i < 1 ? 'done' : i === 1 ? '' : 'lock'}`, style: `padding:4px 6px;font-size:11px;${i === 1 ? 'border-color:var(--hl);color:var(--hl)' : ''}` }, h('b', { style: 'font-size:12px' }, c.split(' · ')[0]), c.split(' · ')[1] || ''))),
        h('div', { style: 'display:grid;grid-template-columns:1fr 24px 1fr 24px 1fr;align-items:center;gap:4px;margin-top:20px' }, stages[0], h('span', { class: 'b-arrow' }, '→'), stages[1], h('span', { class: 'b-arrow' }, '→'), stages[2]),
        h('div', { class: 'b-cap', style: 'margin-top:16px' }, '已验收的场次可以重打（不奖不罚）'))),
      ab(704, 586, 552, 116, h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;height:100%' },
        h('div', { class: 'b-node' }, h('b', {}, '街头赛'), h('span', { class: 'b-cap' }, '后巷赛 · 集市赛'), h('div', { style: 'font-size:12px;margin-top:6px' }, '随手拼的小车，赚零花')),
        h('div', { class: 'b-node lock' }, h('b', {}, '锦标赛'), h('span', { class: 'b-cap' }, '第五章以后'), h('span', { class: 'b-stamp' }, '未开放')),
        h('div', { class: 'b-node' }, h('b', {}, '蓝图库'), h('span', { class: 'b-cap' }, '官方 4 · 我的 2'), h('div', { style: 'font-size:12px;margin-top:6px' }, '分享码导入 / 导出')))),
    );
  }

  // ---------- 改装台：制图台 ----------
  function garage() {
    const S2 = 2, cv = U.carGrid('me', 12, 9), cp = U.CELLPX * S2, F = U.facts();
    const gx = 316, gy = 118, gw = cv.width * S2, gh = (cv.height - 14) * S2;
    const L = U.layout('me'), bo = L.find(b => b.id === 'boiler');
    const at = (b) => ({ x: gx + (b.c0 - cv._c0) * cp, y: gy + (b.r0 - cv._r0) * cp, w: (b.c1 - b.c0 + 1) * cp, h: (b.r1 - b.r0 + 1) * cp });
    const fb = SA.fp('boiler_s'), r = at(bo), ghost = at({ c0: 10, r0: 8 - fb.h, c1: 9 + fb.w, r1: 7 });
    const inv = U.catItems('energy').concat(U.catItems('cooling')).slice(0, 9);
    const g6 = U.gauges('me');
    return U.screen('pb',
      ab(24, 14, null, null, tabs('garage')),
      ab(0, 50, 1280, 2, h('div', { class: 'b-rule' })),
      ab(16, 62, 1248, 40, h('div', { style: 'display:flex;align-items:center;gap:12px;height:100%' },
        h('span', { class: 'b-h', style: 'font-size:18px' }, '一号原型机 ✎'), h('span', { class: 'b-cap' }, `图 SA-001 · 评分 ${F.rating}`),
        h('span', { style: 'margin-left:16px;font-size:13px' }, '层：', h('b', { style: 'color:var(--hl)' }, '◉ 主体'), '　○ 侧挂', h('span', { class: 'b-cap' }, '　侧挂 = 车体外侧的炮和撞击件')),
        h('span', { style: 'margin-left:auto' }), h('button', { class: 'b-btn sm' }, '↶ 撤销 ', h('span', { class: 'k' }, 'Ctrl+Z')), h('button', { class: 'b-btn sm' }, '↷'), h('button', { class: 'b-btn sm' }, '存为蓝图'),
        h('button', { class: 'b-btn sm pri' }, '实物'), h('button', { class: 'b-btn sm' }, '线稿'), h('span', { class: 'mono', style: 'font-size:15px;margin-left:8px' }, money(D.money)))),
      // 左：性能参数
      ab(16, 116, 282, 588, h('div', { class: 'b-sheet', 'data-no': 'SA-011', style: 'height:100%;display:flex;flex-direction:column;gap:12px' },
        h('div', { class: 't', style: 'margin-bottom:0' }, '性能参数', h('small', {}, '黄框 = 放下以后')),
        g6.map((g, i) => scale(g, i === 0 ? F.supply / Math.max(F.demand, F.supply) : i === 1 ? 1 : null)),
        h('div', { style: 'margin-top:auto;border-top:1px solid var(--red);padding-top:8px;display:grid;gap:6px' },
          h('div', { style: 'color:var(--red);font:16px KaiTi,STKaiti,serif' }, `① 动力不足：要 ${F.demand}，供给 ${F.supply}`),
          h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'b-btn sm red' }, '◎ 在图上找'), h('button', { class: 'b-btn sm' }, '怎么修？'))))),
      // 中：图纸 + 车
      ab(gx - 2, gy - 2, gw + 4, gh + 4, h('div', { style: 'width:100%;height:100%;border:2px solid var(--ink);background:linear-gradient(rgba(234,244,255,.18) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,rgba(234,244,255,.18) 1px,transparent 1px) 0 0/48px 48px' })),
      ab(gx - 2, gy - 22, null, null, h('span', { class: 'b-cap' }, 'A　B　C　D　E　F　G　H　I　J　K　L')),
      ab(gx, gy, null, null, U.show(cv, S2)),
      // 拿在手里的竖式锅炉：放下的预览
      ab(ghost.x, ghost.y, ghost.w, ghost.h, h('div', { style: `width:100%;height:100%;border:3px dashed ${HL};background:rgba(255,224,102,.12)` })),
      ab(ghost.x + 8, ghost.y + 8, null, null, (() => { const c = U.show(U.mod('boiler_s'), 2); c.style.opacity = '.6'; c.style.maxHeight = `${ghost.h - 16}px`; c.style.width = 'auto'; return c; })()),
      ab(ghost.x + ghost.w + 10, ghost.y, null, null, h('span', { class: 'b-call hl', style: 'position:static;display:inline-block' }, h('b', {}, '放这里'), h('br'), '动力 6 → 9 · 重 +0.4 t')),
      svg(1280, 720, `<ellipse cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" rx="${r.w * 0.72}" ry="${r.h * 0.66}" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="6 3"/><path d="M${r.x + r.w / 2} ${r.y + r.h + 30} L${r.x + r.w / 2 + 40} ${gy + gh + 30}" stroke="${RED}" stroke-width="2"/>`),
      ab(r.x + r.w / 2 + 44, gy + gh + 18, null, null, h('span', { class: 'b-call red', style: 'position:static' }, '① 这台锅炉不够用')),
      // 下：详图
      ab(gx - 2, 612, gw + 4, 92, h('div', { class: 'b-sheet', 'data-no': '详图 A', style: 'height:100%;padding:8px 12px;display:flex;gap:14px;align-items:center' },
        U.show(U.mod('boiler_s'), 1.5),
        h('div', { style: 'flex:1;font-size:13px;line-height:1.5' }, h('b', { style: 'font-size:15px;letter-spacing:.1em' }, '拿着：竖式锅炉 '), chip(1), h('br'), h('span', { class: 'mono' }, '1×2 · 供给 +3 · 耐久 70 · 0.36 t · 库存 1')),
        h('div', { style: 'display:grid;gap:4px;font-size:12px;color:var(--ink2);text-align:right' }, '点格子放下 · 右键放回', h('span', {}, 'R 键看侧挂层')))),
      // 右：零件表
      ab(912, 116, 352, 530, h('div', { class: 'b-sheet', 'data-no': 'SA-020', style: 'height:100%;display:flex;flex-direction:column;gap:8px' },
        h('div', { class: 't', style: 'margin-bottom:0' }, '零件表', h('small', {}, '☑ 含商店（没货显示价格）')),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, U.CATS.map(k => h('span', { class: 'b-btn sm', style: k === 'energy' ? `background:var(--ink);color:var(--paper2)` : 'padding:2px 7px' }, SA.CAT[k].name))),
        h('table', { class: 'b-bom' }, h('tr', {}, h('th', {}, ''), h('th', {}, '名称'), h('th', {}, '格'), h('th', { style: 'text-align:right' }, '库存 / 价')),
          inv.map(([id, mt, n, price]) => { const f = SA.fp(id); const c = U.mod(id, mt); const e = U.show(c, 1); e.style.maxHeight = '30px'; e.style.width = 'auto';
            return h('tr', { class: `${id === 'boiler_s' ? 'sel' : ''} ${n ? '' : 'none'}` }, h('td', {}, e), h('td', {}, M[id].name), h('td', { class: 'n' }, `${f.w}×${f.h}`), h('td', { class: 'n' }, n ? `×${n}` : h('span', { class: 'buy' }, money(price)))); })))),
      ab(912, 660, 352, 44, h('div', { style: 'display:flex;gap:10px;align-items:center;height:100%' }, h('span', { style: 'color:var(--red);font:15px KaiTi,STKaiti,serif;flex:1' }, '还有 1 项问题'), h('button', { class: 'b-btn pri' }, '出战 →'))),
    );
  }

  // ---------- 出战：对比图 ----------
  function arena() {
    const sm = U.stats('me'), sf = U.stats('foe');
    const A = drawing('me', 8, 8, 1.5), B = drawing('foe', 10, 8, 1.5, true);
    const ax = 60, ay = 200, bx = 1220 - B.w, by = 200;
    const LF = U.layout('foe'), mortar = B.at(LF.find(b => b.id === 'mortar')), boil = LF.filter(b => b.id === 'boiler').map(B.at);
    const bx0 = Math.min(...boil.map(b => b.x)), bx1 = Math.max(...boil.map(b => b.x + b.w)), by0 = boil[0].y, bh = boil[0].h;
    const rows = [['火力', sm.dps, sf.dps, (x) => `${x.toFixed(1)}/s`], ['耐久', sm.maxHp, sf.maxHp, (x) => x], ['速度', sm.topSpeed, sf.topSpeed, (x) => SA.kmh(x)], ['重量', sm.weight, sf.weight, (x) => SA.tons(x)], ['动力富余', sm.supply - sm.demand, sf.supply - sf.demand, (x) => x.toFixed(1)], ['评分', sm.rating, sf.rating, (x) => x]];
    const cmp = h('div', { style: 'display:grid;gap:10px' }, h('div', { style: 'display:grid;grid-template-columns:1fr 90px 1fr;font-size:12px' }, h('span', { class: 'b-cap' }, '一号原型机'), h('span', {}), h('span', { class: 'b-cap', style: 'text-align:right' }, '煤灰寡妇')),
      rows.map(([n, a, b, f]) => { const mx = Math.max(Math.abs(a), Math.abs(b), 1e-6), win = a >= b;
        const bar = (v, right, w) => h('div', { style: `height:14px;display:flex;${right ? '' : 'justify-content:flex-end'}` }, h('i', { style: `width:${Math.max(2, Math.abs(v) / mx * 100)}%;background:repeating-linear-gradient(-45deg,${w ? HL : INK} 0 2px,transparent 2px 5px);border:1px solid ${v < 0 ? RED : w ? HL : INK}` }));
        return h('div', { style: 'display:grid;grid-template-columns:60px 1fr 90px 1fr 60px;align-items:center;gap:6px' },
          h('span', { class: 'mono', style: `font-size:12px;text-align:right;color:${a < 0 ? RED : win ? HL : INK}` }, f(a)), bar(a, false, win), h('b', { style: 'text-align:center;letter-spacing:.1em;font-size:13px' }, n), bar(b, true, !win), h('span', { class: 'mono', style: `font-size:12px;color:${!win ? HL : INK}` }, f(b))); }));
    const T = (x) => 40 + x;
    const terr = `<path d="M0 88 H600" stroke="${INK}" stroke-width="2"/><path d="M0 92 H600" stroke="${INK}" stroke-width=".6" stroke-dasharray="2 4"/>
      <rect x="250" y="52" width="36" height="36" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M250 52 L286 88 M286 52 L250 88" stroke="${INK}" stroke-width=".7"/>
      <rect x="318" y="64" width="36" height="24" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M318 64 L354 88 M354 64 L318 88" stroke="${INK}" stroke-width=".7"/>
      <path d="M70 70 L246 70" stroke="${RED}" stroke-width="2" stroke-dasharray="6 4"/><path d="M240 64 l8 6 -8 6" fill="none" stroke="${RED}" stroke-width="2"/>
      <text x="20" y="62" fill="${INK}" font-size="12">你</text><rect x="18" y="68" width="40" height="20" fill="none" stroke="${INK}"/><text x="540" y="50" fill="${INK}" font-size="12">寡妇</text><rect x="526" y="58" width="52" height="30" fill="none" stroke="${INK}"/><path d="M520 66 Q400 -30 150 60" fill="none" stroke="${HL}" stroke-width="2" stroke-dasharray="5 4"/><path d="M158 52 l-8 8 11 2" fill="none" stroke="${HL}" stroke-width="2"/>`;
    return U.screen('pb',
      ab(24, 14, null, null, tabs('arena')),
      ab(0, 50, 1280, 2, h('div', { class: 'b-rule' })),
      ab(1040, 14, null, null, h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'b-btn sm pri' }, '战役'), h('button', { class: 'b-btn sm' }, '街头赛'), h('button', { class: 'b-btn sm off' }, '锦标赛'))),
      // 进度条
      ab(24, 66, 1232, 62, h('div', { style: 'display:flex;align-items:center;gap:8px;height:100%' },
        h('div', { class: 'b-node done', style: 'padding:4px 10px' }, h('b', { style: 'font-size:12px' }, '序章'), h('span', { class: 'b-stamp ok' }, '✓')),
        h('span', { class: 'b-arrow' }, '→'),
        h('div', { style: 'display:flex;align-items:center;gap:6px;border:1.5px dashed var(--hl);padding:6px 8px' }, h('b', { style: 'color:var(--hl);letter-spacing:.1em;font-size:13px;margin-right:4px' }, '第一章 · 后巷'),
          D.stages.map((s, i) => [i ? h('span', { class: 'b-arrow' }, '→') : null, h('div', { class: `b-node ${s.done ? 'done' : 'next'}`, style: 'padding:3px 10px' }, h('b', { style: 'font-size:12px' }, s.name, s.boss ? ' · BOSS' : ''))])),
        h('span', { class: 'b-arrow' }, '→'), D.chapters.slice(2).map(c => h('div', { class: 'b-node lock', style: 'padding:4px 8px;font-size:11px' }, c.split(' · ')[0])))),
      // 对比图
      ab(24, 140, 1232, 410, h('div', { class: 'b-sheet', 'data-no': '对比图 SA-102', style: 'height:100%' }, h('div', { class: 't' }, '一号原型机　对　煤灰寡妇', h('small', {}, '黄 = 占优')))),
      ab(ax, ay, null, null, A.el), ab(bx, by, null, null, B.el),
      ab(ax, ay + A.h + 4, A.w, null, h('div', { class: 'b-cap', style: 'text-align:center' }, '你 · 一号原型机')),
      ab(bx, by + B.h + 4, B.w, null, h('div', { class: 'b-cap', style: 'text-align:center' }, '玛莎·布莱克 · 煤灰寡妇')),
      ab(346, 206, 460, null, cmp),
      svg(1280, 720, `<ellipse cx="${bx + mortar.x + mortar.w / 2}" cy="${by + mortar.y + mortar.h / 2}" rx="${mortar.w * .8}" ry="${mortar.h * .7}" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="6 3"/>
        <rect x="${bx + bx0 - 6}" y="${by + by0 - 6}" width="${bx1 - bx0 + 12}" height="${bh + 12}" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="6 3"/>
        <path d="M${bx + mortar.x - 6} ${by + mortar.y + mortar.h / 2} L${bx + mortar.x - 40} ${by + mortar.y + mortar.h / 2 + 26}" stroke="${RED}" stroke-width="2"/><path d="M${bx + bx0 + (bx1 - bx0) / 2} ${by + by0 + bh + 6} L${bx + bx0 + (bx1 - bx0) / 2 - 20} ${by + by0 + bh + 60}" stroke="${RED}" stroke-width="2"/>`),
      ab(816, by + mortar.y + mortar.h / 2 + 18, null, null, h('span', { class: 'b-call red', style: 'position:static' }, '高抛砸顶 → 你顶上加甲')),
      ab(bx + bx0 - 130, by + by0 + bh + 60, null, null, h('span', { class: 'b-call red', style: 'position:static' }, '两台锅炉在车尾 → 高抛砸后半截')),
      // 场地剖面
      ab(24, 564, 620, 140, h('div', { class: 'b-sheet', 'data-no': '剖面 SA-103', style: 'height:100%;padding:10px 12px' }, h('div', { class: 't', style: 'margin-bottom:4px' }, '场地：货箱', h('small', {}, '红 = 直射被挡　黄 = 高抛越过')))),
      ab(34, 598, null, null, svg(600, 100, terr, 'position:static')),
      // 奖励 + 出战
      ab(660, 564, 596, 140, h('div', { class: 'b-sheet', 'data-no': 'SA-104', style: 'height:100%;padding:10px 14px;display:grid;grid-template-columns:1fr auto;gap:8px 16px' },
        h('div', { style: 'display:grid;gap:6px;font-size:13px' },
          h('div', {}, h('b', { style: 'letter-spacing:.15em' }, '奖励　'), h('span', { class: 'mono' }, `${money(220)} · 声望 +1 · 缴获 1 件`)),
          h('div', {}, h('b', { style: 'letter-spacing:.15em' }, '下注　'), '◉ 不下　○ £50　○ £100 ', h('span', { class: 'b-cap' }, '赔率 2:1')),
          h('div', { class: 'b-cap' }, 'A/D 行驶 · 鼠标瞄准 · 按住左键蓄准 · 1~9 换武器')),
        h('div', { style: 'display:grid;gap:8px;align-content:center' }, h('button', { class: 'b-btn pri', style: 'font-size:18px;padding:10px 22px' }, '开始试验 · 出战'), h('button', { class: 'b-btn sm' }, '← 回改装台对症改')))),
    );
  }

  // ---------- 小组件 ----------
  function parts() {
    const box = (title, ...kids) => h('div', { class: 'b-sheet', 'data-no': title[0], style: 'display:grid;gap:10px;align-content:start' }, h('div', { class: 't', style: 'margin-bottom:0' }, title[1]), ...kids);
    const bomRow = (id, mt, n, price, cls) => { const e = U.show(U.mod(id, mt), 1); e.style.maxHeight = '30px'; e.style.width = 'auto'; return h('tr', { class: cls }, h('td', {}, e), h('td', {}, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name), h('td', { class: 'n' }, n ? `×${n}` : h('span', { class: 'buy' }, money(price)))); };
    return h('div', { class: 'pb sheet' },
      h('div', { class: 'row' },
        box(['SA-030', '资源 = 图框标题栏'], titleBlock()),
        box(['SA-031', '材料 T1～T6'], h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;max-width:380px' }, [1, 2, 3, 4, 5, 6].map(chip)))),
      h('div', { class: 'row' },
        box(['SA-032', '零件行：有货 / 选中 / 没货'], h('table', { class: 'b-bom', style: 'width:300px' }, bomRow('boiler_s', 1, 1, 90, ''), bomRow('armor', 2, 1, 29, 'sel'), bomRow('mortar_s', 1, 0, 140, 'none'))),
        box(['SA-033', '悬停提示 = 引线标注'], h('div', { style: 'position:relative;width:280px;height:110px' },
          h('div', { style: 'position:absolute;left:0;top:30px' }, U.show(U.blueprint(U.mod('mortar_s')), 1.5)),
          svg(280, 110, `<circle cx="40" cy="60" r="3" fill="${INK}"/><path d="M40 60 L100 26 H130" stroke="${INK}" stroke-width="1.2" fill="none"/>`),
          h('span', { class: 'b-call', style: 'left:130px;top:6px;white-space:normal;width:150px' }, h('b', {}, '小臼炮'), h('br'), '高抛越过货箱砸顶', h('br'), h('span', { class: 'mono' }, '伤害 14 · 装填 3.2s'), h('br'), h('span', { style: 'color:var(--hl)' }, '火力 ▲ 动力 ▼')))),
        box(['SA-034', '提示条'], h('div', { class: 'b-toast' }, h('span', { class: 'b-stamp ok', style: 'rotate:0deg' }, '入库'), '缴获 熟铁锅炉'), h('div', { class: 'b-toast', style: 'border-color:var(--red)' }, h('span', { class: 'b-stamp', style: 'rotate:0deg' }, '不行'), '悬空：下面要有车体托着'))),
      h('div', { class: 'row' },
        box(['SA-035', '确认 / 资金不足'], h('div', { style: 'width:380px;display:grid;gap:8px;font-size:13px' },
          h('div', {}, '升级 熟铁锅炉 需要 ', h('b', { class: 'mono' }, '£430'), '，现有 ', h('span', { class: 'mono' }, '£240'), '，差 ', h('b', { class: 'mono', style: 'color:var(--red)' }, '£190')),
          h('div', { class: 'b-cap' }, '向伦敦蒸汽银行借 £200 · 每场锦标赛利息 10%'),
          h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, h('button', { class: 'b-btn sm' }, '取消'), h('button', { class: 'b-btn sm pri' }, '借 £200 并升级')),
          h('span', { class: 'b-stamp', style: 'position:absolute;right:20px;top:36px' }, '资金不足'))),
        box(['SA-036', '缴获战利品 · 三选一'], h('div', { style: 'display:flex;gap:10px' }, [['mortar_s', 1], ['boiler_s', 2], ['armor', 2]].map(([id, mt], i) => h('div', { class: `b-node ${i === 0 ? 'next' : ''}`, style: 'display:grid;justify-items:center;gap:4px;padding:8px' }, U.show(U.mod(id, mt), 1.5), h('b', { style: 'font-size:12px' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name), chip(mt)))),
          h('button', { class: 'b-btn pri', style: 'justify-self:end' }, '拿走 小臼炮'))),
      h('div', { class: 'row' },
        box(['SA-037', '战斗顶条'], h('div', { class: 'b-hud', style: 'width:620px' },
          h('div', { style: 'display:grid;gap:6px' }, scale({ name: '耐久', val: '1170', pct: .82, note: '' }), scale({ name: '热量', val: '46%', pct: .46, note: '' })),
          h('div', { class: 'clk' }, '87'),
          h('div', { style: 'display:grid;gap:6px' }, scale({ name: '耐久', val: '880', pct: .64, note: '' }), scale({ name: '热量', val: '30%', pct: .3, note: '' }))))));
  }

  U.add({ id: 'B', name: '工程蓝图', tag: '图纸 · 冷色 · 信息最清楚',
    pitch: '这是造车的游戏，界面就是总工程师的图纸。主页面是「总图」：左边是你的车的线稿，每个模块拉引线标名字，有问题的地方用红铅笔圈出来；右边是「下一项试验」和战役进度流程图。改装台是制图台：图纸方格就是建造网格，属性是标尺（黄框预览装上以后的变化），零件是零件表。出战是对比图：两台车线稿并排、中间逐项对比，红铅笔标出对手弱点，下面画场地剖面，直接看出直射会不会被挡。',
    pros: ['信息最清楚：数值对比、预览变化、问题定位都最直接', '网格 = 图纸方格，改装台的操作和风格天然一致', '线稿滤镜直接读游戏精灵，新模块不用另画'],
    cons: ['冷蓝色调和游戏里暖色的战斗场景反差大，切换时会跳', '「图纸」偏理性，热闹、人情味不如 A / C', '文字和数字多，第一次看会觉得「像工具软件」'],
    notes: { home: '左：车的线稿 + 引线；红圈 = 问题；右：下一项试验 + 进度流程', garage: '黄虚框 = 手里零件放下的位置和变化；红圈 = 问题', arena: '中间逐项对比（黄 = 占优）；下面场地剖面：红 = 直射被挡，黄 = 高抛越过' },
    lang, home, garage, arena, parts });
})();
