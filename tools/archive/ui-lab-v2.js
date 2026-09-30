// 界面重建 v2 · 铁匠铺 × 蒸汽公报（tools/ui-lab.html）。
// 设计语言：铁是底、铜是手、纸是字。按钮 / 面板 / 属性表各三种，选哪种，三个画面就立刻换成哪种。
// 素材都读游戏代码（车、模块、碳球、战斗场景）；数据是写死的样例，不读存档、不改规则。
(() => {
  const U = SA.UILAB, { h, D, money } = U, M = SA.MODULES;
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const pct = (x) => `${Math.max(0, Math.min(100, x * 100)).toFixed(1)}%`;
  const INK = [35, 26, 18], RED = [168, 40, 29];
  const eng = (cv, s = 1, flip) => { const c = U.show(U.engrave(cv, INK, RED), s); if (flip) c.style.transform = 'scaleX(-1)'; return c; };
  const fit = (cv, maxH, maxW) => { const c = U.show(cv, 1); c.style.maxHeight = `${maxH}px`; if (maxW) c.style.maxWidth = `${maxW}px`; c.style.width = 'auto'; c.style.height = 'auto'; return c; };

  // ---------- 选择（本机）----------
  const KEY = 'steam_arena_uilab_v2';
  const st = { sec: 'all', picks: { btn: 'v1', panel: 'v1', meter: 'v1' }, ok: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) { Object.assign(st.picks, s.picks || {}); Object.assign(st.ok, s.ok || {}); if (s.sec) st.sec = s.sec; } } catch (e) { /* 隐私模式 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const V = st.picks;

  // ---------- 组件（按当前选择的样式出）----------
  function btn(label, o = {}) {
    const cls = `k-btn ${o.v || V.btn} ${o.pri ? 'pri' : ''} ${o.sm ? 'sm' : ''} ${o.big ? 'big' : ''} ${o.off ? 'off' : ''} ${o.press ? 'press' : ''}`;
    const v = o.v || V.btn;
    if (v === 'v2') return h('button', { class: cls }, h('i', { class: 'knob' }), h('span', { class: 'strip' }, label));
    if (v === 'v3') return h('button', { class: cls }, label);
    return h('button', { class: cls }, h('i', { class: 'screw' }), h('span', { class: 'card' }, label), h('i', { class: 'screw' }));
  }
  function panel(title, body, o = {}) {
    const v = o.v || V.panel, style = o.style || '';
    if (v === 'v2') return h('div', { class: 'k-frame rivets', style }, h('div', { class: 'plate m-brass t-engrave' }, h('i', { class: 'screw' }), title, h('i', { class: 'screw' })), h('div', { class: 'paper m-paper', style: o.inner || '' }, body));
    if (v === 'v3') return h('div', { class: 'k-pin m-paper', style }, h('i', { class: 'tack' }), h('i', { class: 'tack' }), h('div', { class: 'ttl' }, title), body);
    return h('div', { class: 'k-clip', style }, h('i', { class: 'clip' }), h('i', { class: 'u a' }), h('i', { class: 'u b' }), h('div', { class: 'sheet m-paper', style: o.inner || '' }, h('div', { class: 'ttl' }, title), body));
  }
  const LIQ = { power: '#d9722a', weight: '#6f727b', speed: '#5a9444', heat: '#b8321f', water: '#3a98ab', hp: '#c28f2c' };
  function meter(g, o = {}) {
    const v = o.v || V.meter, bad = g.pct >= 1 && ['power', 'weight', 'heat'].includes(g.k), p = Math.min(1, g.pct);
    const lim = g.k === 'power' ? 0.77 : g.k === 'weight' ? 1 : null;
    const dl = g.delta ? (g.delta > 0 ? '▲' : '▼') : '';
    if (v === 'v2') return h('div', { class: 'k-dial', style: `--v:${p.toFixed(3)};--d:${g.delta || 0};--sz:${o.sz || 74}px` },
      h('div', { class: 'face' }, h('i', { class: 'ghost' }), h('i', { class: 'needle' }), h('i', { class: 'cap' }), h('span', { class: 'val', style: bad ? 'color:var(--red)' : '' }, g.val)),
      h('span', { class: 'lbl m-paper' }, g.name, dl ? h('span', { style: 'color:var(--red)' }, ` ${dl}`) : null));
    if (v === 'v3') return h('div', { class: `k-bar ${bad ? 'bad' : ''}` }, h('span', { class: 'nm' }, g.name),
      h('div', { class: 'tr' }, h('i', { class: 'fill', style: `width:${pct(p)}` }), g.delta ? h('i', { class: 'ghost', style: `left:${pct(Math.min(p, p + g.delta))};width:${pct(Math.abs(g.delta))}` }) : null, h('i', { class: 'cur', style: `left:${pct(p)}` })),
      h('span', { class: 'v' }, g.val, dl ? h('span', { style: 'color:var(--red)' }, ` ${dl}`) : null));
    return h('div', { class: 'k-tube' }, h('span', { class: 'nm' }, g.name),
      h('div', { class: 'glass' }, h('i', { class: 'liq', style: `width:calc(${pct(p)} - 4px);--c:${LIQ[g.k] || '#b8321f'}` }),
        g.delta ? h('i', { class: 'ghost', style: `left:${pct(Math.min(p, p + g.delta))};width:${pct(Math.abs(g.delta))}` }) : null,
        lim != null ? h('i', { class: 'lim', style: `left:${pct(lim)}` }) : null),
      h('span', { class: `v ${bad ? 'bad' : ''}` }, g.val, dl ? h('span', { style: 'color:var(--red)' }, ` ${dl}`) : null),
      h('i', { class: 'scale' }), o.note === false ? null : h('span', { class: 'note' }, g.note, g.delta ? h('b', {}, `　铅笔 = 装上以后`) : null));
  }
  function counter(n = D.money) {
    const s = String(Math.round(n)).padStart(5, '0');
    return h('div', { class: 'k-counter m-iron rivets' }, h('span', { class: 'win' }, h('i', { class: 'u' }, '£'), [...s].map(c => h('i', {}, c))),
      h('span', { class: 'k-stars' }, [0, 1, 2, 3, 4].map(i => h('i', { class: i < D.rep ? '' : 'off' }))),
      h('span', { class: 'k-slip m-paper' }, D.ingots.map(([k, n2]) => `${k} ×${n2}`).join(' ')));
  }
  const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
  function mat(mt) {
    const m = SA.MATS[mt];
    return h('span', { class: `k-mat m-kraft ${mt >= 5 ? 'gold' : ''}` }, h('i', { class: 'eyelet' }), h('i', { class: 'band', style: `background:${m.chip}` }), h('span', { class: 'rn' }, ROMAN[mt]), m.name, m.rank ? h('b', { style: 'color:var(--red)' }, ` ${m.rank}`) : null);
  }
  function part([id, mt, n, price], o = {}) {
    return h('div', { class: `k-part m-paper ${n ? '' : 'none'} ${o.sel ? 'sel' : ''}`, style: o.style || '' },
      h('div', { class: 'pic' }, U.show(U.mod(id, mt), 1)), h('span', { class: 'nm' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name),
      n ? h('span', { class: 'stamp' }, `×${n}`) : h('span', { class: 'price m-kraft' }, money(price)));
  }
  const sw = (a, b, right) => h('span', { class: 'k-switch m-iron', style: 'border-width:2px' }, h('span', { class: `lab m-paper ${right ? 'dim' : ''}` }, a), h('span', { class: 'base', style: `--r:${right ? 35 : -35}deg` }, h('i', { class: 'lev' })), h('span', { class: `lab m-paper ${right ? '' : 'dim'}` }, b));
  function lever(label, sub) {
    return h('div', { class: 'lever' }, h('div', { class: 'slot' }, h('i', { class: 'arm' }, h('i', { class: 'knob' }))),
      h('div', { class: 'm-paper', style: 'padding:6px 14px;rotate:-1deg' }, h('div', { style: 'font:900 24px var(--serif);letter-spacing:.2em;color:var(--red)' }, label), h('div', { class: 't-small' }, sub)));
  }

  // ---------- 像素道具：铁砧、木箱 ----------
  function pix(w, hh, paint) { const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); paint((x, y, ww, hh2, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh2); }); return c; }
  const anvil = () => pix(34, 30, (R) => {
    R(10, 16, 14, 14, '#2a180c'); R(11, 16, 12, 13, '#5a3920'); R(12, 17, 3, 12, '#6e4526'); R(19, 18, 2, 10, '#3a2415'); R(11, 20, 12, 1, '#3a2415'); R(11, 25, 12, 1, '#3a2415');
    R(8, 13, 18, 4, '#16171b'); R(9, 13, 16, 3, '#464952'); R(12, 9, 10, 5, '#16171b'); R(13, 9, 8, 4, '#2c2e35');
    R(0, 4, 34, 6, '#16171b'); R(1, 4, 32, 5, '#464952'); R(1, 4, 32, 1, '#a7abb4'); R(0, 6, 3, 2, '#2c2e35'); R(27, 5, 6, 3, '#6c707a');
  });
  const crate = () => pix(40, 22, (R) => {
    R(0, 0, 40, 22, '#22150c'); R(1, 1, 38, 20, '#6e4526'); R(1, 7, 38, 1, '#3a2415'); R(1, 14, 38, 1, '#3a2415'); R(1, 1, 38, 1, '#8a5a34');
    for (let i = 0; i < 12; i++) R(3 + i * 3, 3 + i, 3, 2, '#4a2e1a');
    R(2, 2, 2, 2, '#d4a03f'); R(36, 2, 2, 2, '#d4a03f'); R(2, 18, 2, 2, '#d4a03f'); R(36, 18, 2, 2, '#d4a03f');
  });

  // ---------- 设计语言 + 小组件 ----------
  function lang() {
    const sw2 = (c, n, dark) => h('div', { style: 'display:grid;gap:4px;justify-items:center;font-size:11px;color:var(--paper2)' }, h('i', { style: `width:48px;height:36px;background:${c};border:2px solid ${dark ? '#000' : '#16171b'}` }), n);
    const col = (title, v, key, kids) => h('div', { class: 'm-iron rivets', style: `padding:14px 16px;display:grid;gap:12px;align-content:start;${V[key] === v ? 'box-shadow:inset 2px 2px 0 var(--iron3),0 0 0 3px var(--red),3px 4px 0 rgba(0,0,0,.5)' : ''}` },
      h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('b', { style: 'font:900 15px var(--serif);letter-spacing:.12em;color:var(--brass3)' }, title), h('span', { style: 'margin-left:auto' }), pickBtn(key, v)), ...kids);
    const g6 = U.gauges('me');
    const rowT = (t, sub) => h('div', { style: 'display:flex;align-items:baseline;gap:12px;margin:26px 0 12px' }, h('span', { class: 't-h2', style: 'color:var(--brass3)' }, t), h('span', { style: 'color:var(--paper3);font-size:13px' }, sub));
    return h('div', { class: 'fg sheet' },
      h('div', { class: 'row', style: 'align-items:stretch' },
        h('div', { class: 'm-paper', style: 'flex:1;min-width:320px;padding:18px 22px' },
          h('div', { class: 't-kick' }, '设计语言'), h('div', { class: 't-h1' }, '铁是底 · 铜是手 · 纸是字'),
          h('p', { style: 'font:15px/1.8 var(--serif);margin:8px 0 0' }, '界面里的每样东西都能在老汤姆的铺子里找到：铸铁的底板和托盘，黄铜的夹子、旋钮和拨杆，写满字的纸。', h('b', { style: 'color:var(--red)' }, '看到黄铜就能动手，看到纸就能读'), '。')),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-content:center' }, [['#2c2e35', '铸铁'], ['#464952', '铁·亮面'], ['#d4a03f', '黄铜'], ['#94661c', '黄铜·暗'], ['#f1e6c8', '新纸'], ['#dcc693', '旧纸'], ['#c8a472', '牛皮纸'], ['#231a12', '油墨'], ['#a8281d', '朱红·主操作'], ['#ef7a21', '炉火'], ['#1c4677', '晒图纸']].map(([c, n]) => sw2(c, n)))),
      h('div', { class: 'row' },
        h('div', { class: 'm-paper', style: 'padding:12px 18px;display:grid;gap:6px' }, h('span', { class: 't-h2' }, '标题 · 宋体特粗'), h('span', { style: 'font:15px var(--serif)' }, '正文 · 宋体（纸上的字都是印的）'), h('span', { class: 't-num', style: 'font-size:18px' }, '数字 £1,240 · 7.8 / 6'), h('span', { class: 'hand', style: 'font-size:17px;color:var(--red)' }, '批注 · 楷体（红铅笔、粉笔）'), h('span', { class: 't-type' }, '档案 · 打字机体')),
        h('div', { class: 'm-iron rivets', style: 'padding:14px 18px;display:grid;gap:8px;align-content:start;max-width:420px;font-size:13px;line-height:1.6' },
          h('b', { style: 'color:var(--brass3);font:900 15px var(--serif)' }, '三条规矩'),
          h('span', {}, '① 铁永远在下面，不写字；要写字就铆一块纸或铜牌上去。'), h('span', {}, '② 能点的一定带黄铜：框、钮、夹、拨杆。纯纸的东西只能读。'), h('span', {}, '③ 主操作是朱红纸签 / 红珐琅钮 / 红票；问题用红铅笔圈，不用红色大块。'))),
      rowT('按钮 · 三种', '选一种，下面三个画面立刻换'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px' },
        [['v1', '① 铜框纸签', '黄铜卡框里插一张纸签（抽屉标签那种），两头两颗螺丝；主操作是朱红纸签。'], ['v2', '② 铜钮纸条', '铁底板上一颗黄铜按钮，旁边铆一条纸标签；主操作是红珐琅钮。'], ['v3', '③ 铆铜票根', '一张票根两头各铆一颗黄铜钉；主操作是朱红票。']].map(([v, t, d]) =>
          col(t, v, 'btn', [h('span', { style: 'font-size:12px;color:var(--paper2);line-height:1.6' }, d),
            h('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:center' }, btn('出战', { v, pri: true }), btn('去改装', { v }), btn('拆下', { v, sm: true }), btn('不可用', { v, off: true })),
            h('div', { style: 'display:flex;gap:12px;align-items:center' }, btn('拉闸出战', { v, pri: true, big: true }), h('span', { style: 'font-size:12px;color:var(--paper3)' }, '大号'))]))),
      rowT('面板 · 三种', '参数、清单、弹窗都用它'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px' },
        [['v1', '① 铁夹板', '铁板 + 黄铜夹子夹住一叠纸，下面的纸错开露边。'], ['v2', '② 铁框纸芯', '铆钉铁框里嵌一张纸，黄铜铭牌铆在上框当标题。'], ['v3', '③ 钉墙纸', '黄铜图钉钉住的纸，右下角卷起；最轻，适合提示和剪报。']].map(([v, t, d]) =>
          col(t, v, 'panel', [h('span', { style: 'font-size:12px;color:var(--paper2);line-height:1.6' }, d),
            panel('性能单', h('div', { style: 'display:grid;gap:8px' }, meter(g6[0], { note: false }), meter(g6[3], { note: false }), h('div', { class: 'hand', style: 'color:var(--red);font-size:15px' }, '动力不够 → 加锅炉')), { v })]))),
      rowT('属性表 · 三种', '铅笔 / 红色影子 = 装上手里的零件以后'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px' },
        [['v1', '① 液位管', '纸刻度卡上一根玻璃管，两头黄铜管箍；每项一种颜色的液体，红竖线 = 上限。'], ['v2', '② 纸面表盘', '黄铜表圈里是印刷的纸表面，指针 + 红色影子针。'], ['v3', '③ 印刷条 + 铜游标', '纸上印的网线条，一只黄铜游标骑在上面。']].map(([v, t, d]) =>
          col(t, v, 'meter', [h('span', { style: 'font-size:12px;color:var(--paper2);line-height:1.6' }, d),
            h('div', { class: 'm-paper', style: `padding:12px 14px;display:${v === 'v2' ? 'grid;grid-template-columns:repeat(3,1fr);justify-items:center;gap:18px 6px' : 'grid;gap:7px'}` }, g6.map(g => meter(g, { v, sz: 66, note: v === 'v1' && g.k === 'power' ? undefined : false })))]))),
      rowT('其余小件', '统一用上面的规矩'),
      h('div', { class: 'row' },
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '资源：铁壳计数器（纸白字轮）+ 黄铜星 + 夹着的材料纸条'), counter()),
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '材料：牛皮纸吊牌 + 黄铜鸡眼 + 油墨色条；史诗 / 传奇描铜边'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;max-width:560px' }, [1, 2, 3, 4, 5, 6].map(mat)))),
      h('div', { class: 'row' },
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '零件卡：有货盖件数章 / 选中红框 / 没货挂牛皮纸价签'),
          h('div', { class: 'm-iron', style: 'padding:12px;display:flex;gap:10px' }, part(['boiler_s', 1, 1, 90], { style: 'width:104px' }), part(['armor', 2, 1, 29], { sel: true, style: 'width:104px' }), part(['mortar_s', 1, 0, 140], { style: 'width:104px' }))),
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '页签 + 开关'),
          h('div', { style: 'display:flex;gap:2px' }, ['底盘', '能源', '火力'].map((t, i) => h('span', { class: `k-tab m-paper ${i === 1 ? 'on' : ''}` }, h('i', { class: 'eyelet' }), t))),
          h('div', { style: 'display:flex;gap:12px' }, sw('主体', '侧挂'), sw('有货', '全部', true))),
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '悬停提示：索引卡 + 回形针'), h('div', { class: 'k-card', style: 'width:250px' }, h('b', {}, '小臼炮'), '　1×1 · £140', h('br'), '高抛，越过货箱砸顶。', h('br'), '装上：', h('span', { class: 'up' }, '火力 ▲'), '　', h('span', { class: 'dn' }, '动力 ▼'))),
        h('div', { style: 'display:grid;gap:10px' }, h('span', { class: 'cap' }, '提示条：电报纸带'), h('div', { class: 'k-tele' }, h('span', { class: 'st' }, '入库'), h('span', {}, '缴获 ', h('b', {}, '熟铁锅炉'), ' 停')), h('div', { class: 'k-tele bad' }, h('span', { class: 'st' }, '不行'), h('span', {}, '此处', h('b', {}, '悬空'), '　下面要有车体托着 停'))),
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '印章 + 蜡封'), h('div', { class: 'm-paper', style: 'display:flex;gap:18px;align-items:center;padding:12px 16px' }, h('span', { class: 'k-stamp' }, '待修'), h('span', { class: 'k-stamp ok' }, '已胜'), h('span', { class: 'k-seal' }, '蒸汽', h('br'), '竞技')))),
      h('div', { class: 'row' },
        h('div', { style: 'display:grid;gap:8px;width:400px' }, h('span', { class: 'cap' }, '确认 / 资金不足：银行来信'),
          panel('伦敦蒸汽银行', h('div', { style: 'font:14px/1.7 var(--serif)' }, '先生：升级需 ', h('b', { class: 't-num' }, '£430'), '，阁下账上 £240，尚差 ', h('b', { class: 't-num', style: 'color:var(--red)' }, '£190'), '。本行可借 £200，每届锦标赛计息一成。',
            h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:10px' }, h('span', { class: 'k-seal', style: 'width:40px;height:40px;font-size:10px;margin-right:auto' }, '银行'), btn('婉拒', { sm: true }), btn('借款并升级', { sm: true, pri: true }))))),
        h('div', { style: 'display:grid;gap:8px;width:440px' }, h('span', { class: 'cap' }, '缴获战利品：清单上勾一件'),
          panel('战利品清单', h('div', { style: 'display:grid;gap:4px' }, [['mortar_s', 1, true, '★ 唯一件'], ['boiler_s', 2], ['armor', 2]].map(([id, mt, on, u]) => h('div', { style: `display:grid;grid-template-columns:22px 60px 1fr auto;gap:8px;align-items:center;padding:4px 6px;${on ? 'outline:2px solid var(--red);outline-offset:-2px' : ''}` },
            h('span', { class: 'hand', style: 'font-size:20px;color:var(--red)' }, on ? '✓' : '□'), fit(U.mod(id, mt), 40, 56), h('span', { style: 'font:700 14px var(--serif)' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name, u ? h('span', { class: 'k-stamp', style: 'font-size:10px;margin-left:8px;padding:0 5px' }, u) : null), mat(mt))),
            h('div', { style: 'text-align:right;margin-top:6px' }, btn('拿走 小臼炮', { pri: true, sm: true }))))),
        h('div', { style: 'display:grid;gap:8px' }, h('span', { class: 'cap' }, '战斗顶条：铁梁 + 玻璃管 + 黄铜秒表'),
          h('div', { class: 'k-hud m-iron rivets', style: 'width:600px' },
            h('div', { style: 'display:grid;gap:4px' }, h('span', { class: 'who m-paper', style: 'justify-self:start' }, '你 · 一号原型机'), meter({ k: 'hp', name: '耐久', val: '1170', pct: .82 }, { v: 'v1', note: false }), meter({ k: 'heat', name: '热量', val: '46%', pct: .46 }, { v: 'v1', note: false })),
            h('div', { class: 'clk' }, '87'),
            h('div', { style: 'display:grid;gap:4px' }, h('span', { class: 'who m-paper', style: 'justify-self:end' }, '煤灰寡妇'), meter({ k: 'hp', name: '耐久', val: '880', pct: .64 }, { v: 'v1', note: false }), meter({ k: 'heat', name: '热量', val: '30%', pct: .3 }, { v: 'v1', note: false }))))));
  }

  // ---------- 主页面：铁匠铺院子（活的）----------
  let homeTimer = null;
  function home() {
    const F = U.facts(), foe = D.stages[2];
    const C = (n, o) => U.coal(n, Object.assign({ size: 'scene' }, o));
    // 院子里的人物由样机自己画（更大、会聊天）；场景自带的小老汤姆和亲戚先藏起来：渲染时把名字从 byName 拿掉，场景就画空白
    const hid = ['铁匠 老汤姆', '远房亲戚'].map(n => [n, SA.Coal.byName[n]]);
    hid.forEach(([n]) => delete SA.Coal.byName[n]);
    const bgc = U.scene('forge', 1280, 720, 0, 0);
    hid.forEach(([n, c]) => { SA.Coal.byName[n] = c; });
    const bg = U.show(bgc, 2); bg.style.cssText += 'position:absolute;left:-330px;top:-690px';
    // 人物：每人一张画布，换帧 = 换 src 画布
    const who = {};
    const actor = (key, x, y, frame, flip) => {
      const box = h('div', { class: 'ab who-click', style: `left:${x}px;top:${y}px;width:112px;height:112px;${flip ? 'transform:scaleX(-1)' : ''}` });
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; cv.style.cssText = 'width:112px;height:112px;image-rendering:pixelated';
      box.append(cv); who[key] = { box, cv, x, y, flip, set(f) { const g = cv.getContext('2d'); g.clearRect(0, 0, 56, 56); g.drawImage(f, 0, 0); } };
      who[key].set(frame); return box;
    };
    const F_TOM = { up: C('铁匠 老汤姆', { pose: 'cheer', look: 1 }), hit: C('铁匠 老汤姆', { pose: 'point', look: 1 }), rest: C('铁匠 老汤姆', { pose: 'hold', look: 1 }), talk: C('铁匠 老汤姆', { pose: 'hold', look: -1, expr: 'happy' }), blink: C('铁匠 老汤姆', { pose: 'hold', look: 1, expr: 'blink' }) };
    const F_REL = { idle: C('远房亲戚', { pose: 'idle', look: 1 }), blink: C('远房亲戚', { pose: 'idle', look: 1, expr: 'blink' }), talk: C('远房亲戚', { pose: 'salute', look: 1, expr: 'happy' }), sleep: C('远房亲戚', { pose: 'idle', look: 1, expr: 'sleepy' }), jolt: C('远房亲戚', { pose: 'cheer', look: 1, expr: 'surprise' }) };
    const F_TIM = { work: C('学徒 小提米', { pose: 'point', look: 1 }), rest: C('学徒 小提米', { pose: 'hold', look: 1 }), talk: C('学徒 小提米', { pose: 'wave', look: -1, expr: 'happy' }), yelp: C('学徒 小提米', { pose: 'cheer', look: -1, expr: 'surprise' }) };
    const bubbles = {};
    const bubble = (key, x, y, tail) => (bubbles[key] = h('div', { class: 'say', style: `left:${x}px;top:${y}px;--tail:${tail}px` }));
    const sparks = [...Array(7)].map(() => h('i', { class: 'spark' }));
    const zz = h('div', { class: 'ab', style: 'left:118px;top:444px;font:900 18px var(--hand);color:var(--chalk);opacity:0;transition:opacity .4s;text-shadow:1px 1px 0 #000' }, 'z z Z');
    const root = U.screen('fg',
      bg,
      h('div', { class: 'ab', style: 'inset:0;background:linear-gradient(180deg,rgba(20,14,11,.5),transparent 20%,transparent 72%,rgba(20,14,11,.65))' }),
      h('div', { class: 'ab', style: 'left:330px;top:330px;width:200px;height:200px;background:radial-gradient(circle,rgba(239,122,33,.28),transparent 65%);animation:flick 1.3s infinite' }),
      // 墙上钉的公报（点 = 去出战）
      ab(26, 88, 250, null, h('div', { class: 'm-paper old who-click', style: 'padding:12px 14px 12px;rotate:-2deg' }, h('i', { class: 'tack', style: 'left:10px;top:6px' }), h('i', { class: 'tack', style: 'right:10px;top:6px' }),
        h('div', { style: 'text-align:center;font:900 22px var(--serif);letter-spacing:.3em;border-bottom:3px double var(--ink);padding-bottom:2px' }, '蒸汽公报'),
        h('div', { style: 'display:flex;justify-content:space-between;font-size:10px;color:var(--ink2);margin:2px 0 6px' }, h('span', {}, '第 42 期'), h('span', {}, '一便士')),
        h('div', { class: 't-kick', style: 'letter-spacing:.1em' }, '今晚 · 白教堂后巷'),
        h('div', { style: 'font:900 19px/1.25 var(--serif);margin:2px 0 6px' }, '后巷女王「煤灰寡妇」', h('br'), '迎战铁匠铺新人！'),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('div', { style: 'border:1.5px solid var(--ink);padding:2px;background:#e8dab0;flex:none' }, eng(U.coal(foe.pilot, { size: 'portrait' }), 1)),
          h('div', { style: 'font:12px/1.55 var(--serif)' }, '她的臼炮专砸车顶，两台锅炉挂在车尾。', h('br'), h('span', { style: 'color:var(--red);font-weight:900;border-bottom:1px solid var(--red)' }, '☞ 看赛程')))) ),
      // 道具：木箱、铁砧
      ab(52, 562, null, null, U.show(crate(), 2)),
      ab(356, 546, null, null, U.show(anvil(), 2)),
      // 车（点 = 进改装台）+ 冒汽
      ab(462, 304, null, null, h('div', { class: 'who-click', style: 'position:relative;padding:10px;outline:2px dashed rgba(255,209,102,.55);outline-offset:-2px' }, U.show(U.car('me'), 1.5),
        h('span', { class: 'm-kraft', style: 'position:absolute;left:30px;top:-14px;padding:2px 10px 2px 8px;font:700 12px var(--serif);display:flex;gap:6px;align-items:center' }, h('i', { class: 'eyelet' }), '点车 · 进改装台'),
        h('span', { class: 'k-stamp', style: 'position:absolute;left:170px;top:-14px;background:var(--paper);mix-blend-mode:normal;font-size:13px;opacity:1' }, '动力不足'))),
      [0, 1, 2].map(i => ab(520 + i * 4, 318, null, null, h('i', { class: 'puff', style: `width:14px;height:14px;animation-delay:${i * 1.05}s` }))),
      // 人物
      actor('rel', 40, 472, F_REL.idle), actor('tom', 250, 514, F_TOM.rest), actor('tim', 700, 514, F_TIM.work, true),
      sparks.map(s => ab(424, 556, null, null, s)),
      zz,
      bubble('rel', 36, 360, 60), bubble('tom', 190, 404, 110), bubble('tim', 600, 402, 150),
      // 顶上：资源 + 小按钮
      ab(300, 14, null, null, counter()),
      ab(720, 16, null, null, h('div', { style: 'display:flex;gap:10px' }, btn('蓝图柜', { sm: true }), btn('设置', { sm: true }))),
      // 路标
      ab(1128, 150, 16, 570, h('div', { style: 'width:100%;height:100%;background:linear-gradient(90deg,#2a180c,#6a4424 45%,#2a180c);border:2px solid #120a05' })),
      ab(1108, 92, 56, 60, h('div', { style: 'width:100%;height:100%;background:radial-gradient(circle at 50% 58%,#ffe7a0,#ef7a21 42%,rgba(239,122,33,0) 70%),linear-gradient(#2c2e35,#16171b);border:3px solid #16171b;border-radius:10px 10px 4px 4px;box-shadow:0 0 44px 20px rgba(239,122,33,.33);animation:flick 1.7s infinite' })),
      ab(950, 176, 310, null, h('div', { class: 'sign r go', style: 'font-size:26px' }, h('i', { class: 'screw', style: 'left:8px' }), '出战', h('small', {}, `竞技场 · ${foe.name}【Boss】`))),
      ab(896, 270, 260, null, h('div', { class: 'sign l' }, h('i', { class: 'screw', style: 'right:8px' }), '车间', h('small', {}, '改装 · 订货'))),
      ab(1000, 348, 250, null, h('div', { class: 'sign r' }, h('i', { class: 'screw', style: 'left:8px' }), '银行', h('small', {}, '伦敦蒸汽银行 · 借 / 还'))),
      ab(926, 426, 230, null, h('div', { class: 'sign l' }, h('i', { class: 'screw', style: 'right:8px' }), '街头赛', h('small', {}, '后巷赛 · 集市赛'))),
      ab(1000, 504, 250, null, h('div', { class: 'sign r', style: 'filter:grayscale(.8) brightness(.6)' }, h('i', { class: 'screw', style: 'left:8px' }), '锦标赛', h('small', {}, '第五章以后开放'))),
      ab(20, 682, null, null, h('span', { class: 'm-kraft', style: 'padding:3px 12px 3px 8px;font:700 12px var(--serif);display:inline-flex;gap:6px;align-items:center' }, h('i', { class: 'eyelet' }), '点人物聊天 · 点车改装 · 点报纸看赛程')),
    );
    // 闲谈脚本：[说话人, 台词, 动作]；动作改人物的帧（和气泡一起持续）
    const LINES = [
      ['rel', '想当年在孟买，我们的蒸汽车能拖动一整个炮兵连！', 'talk'],
      ['tom', '你那台车？早锈成门把手了。', 'talk'],
      ['tim', '师傅！锅炉又在漏气！', 'yelp'],
      ['tom', '拿扳手拧紧，别拿脑袋顶着。', 'talk'],
      ['rel', '……', 'sleep'],
      ['rel', '谁？！谁在开炮？！', 'jolt'],
      ['tom', `后巷那寡妇专砸车顶。顶上<b>压块甲</b>再去。`, 'talk'],
      ['tim', '我在锅炉上画了个笑脸，它会跑得快一点吧？', 'talk'],
    ];
    const TIP = { tom: `下一场是 <b>${foe.name}</b>。你的锅炉<b>顶不住动力</b>（${F.demand} / ${F.supply}），先去车间添一台小锅炉。`, rel: '赛程贴在墙上那张报纸里。打过的我替你划掉了！', tim: '车顶那门小臼炮我擦亮啦。要改装就点车！' };
    let i = 0, t0 = 0, cur = null, forced = null, tick = 0;
    const say = (key, html) => { for (const k in bubbles) bubbles[k].classList.remove('on'); if (!key) return; const b = bubbles[key]; b.innerHTML = `<span class="who">${{ rel: '远房亲戚', tom: '铁匠 老汤姆', tim: '学徒 小提米' }[key]}</span>${html}`; b.classList.add('on'); };
    const burst = () => sparks.forEach((s, k) => { const a = -Math.PI * (0.15 + 0.7 * k / 6), r = 18 + (k % 3) * 10; s.style.transition = 'none'; s.style.opacity = '1'; s.style.transform = 'translate(0,0)'; requestAnimationFrame(() => { s.style.transition = 'transform .45s ease-out, opacity .45s'; s.style.transform = `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px)`; s.style.opacity = '0'; }); });
    let mounted = false;
    const step = () => {
      if (root.isConnected) mounted = true;
      else if (mounted) { clearInterval(homeTimer); homeTimer = null; return; }
      tick++;
      // 当前台词：强制（点人物）优先，否则按脚本轮换，每句 3.2 秒
      if (!cur || tick - t0 > 32) {
        if (forced) { cur = forced; forced = null; } else { cur = LINES[i % LINES.length]; i++; }
        t0 = tick; say(cur[0], cur[1]);
      }
      const [spk, , act] = cur;
      // 老汤姆：不说话时一直打铁（抬锤 3 帧 → 砸 2 帧 → 停 3 帧）
      if (spk === 'tom') who.tom.set(F_TOM.talk);
      else { const ph = tick % 8; who.tom.set(ph < 3 ? F_TOM.up : ph < 5 ? F_TOM.hit : (tick % 40 === 7 ? F_TOM.blink : F_TOM.rest)); if (ph === 3) burst(); }
      // 亲戚
      const relF = spk === 'rel' ? F_REL[act] || F_REL.talk : (tick % 30 === 5 ? F_REL.blink : F_REL.idle);
      who.rel.set(relF); zz.style.opacity = spk === 'rel' && act === 'sleep' ? '1' : '0';
      who.rel.box.style.translate = spk === 'rel' && act === 'jolt' ? '0 -8px' : '0 0';
      // 小提米：拧扳手
      who.tim.set(spk === 'tim' ? F_TIM[act] || F_TIM.talk : (tick % 6 < 3 ? F_TIM.work : F_TIM.rest));
      who.tim.box.style.translate = spk === 'tim' && act === 'yelp' ? '0 -6px' : '0 0';
    };
    for (const k of ['tom', 'rel', 'tim']) who[k].box.addEventListener('click', () => { forced = [k, TIP[k], k === 'tim' ? 'talk' : 'talk']; cur = null; });
    if (homeTimer) clearInterval(homeTimer);
    homeTimer = setInterval(step, 100);
    step();
    return root;
  }

  // ---------- 改装台：桌上的几叠纸，中间是图纸 ----------
  function garage() {
    const S2 = 2, cv = U.carGrid('me', 12, 9), cp = U.CELLPX * S2, F = U.facts();
    const bx0 = 350, by0 = 118, gw = cv.width * S2, gh = (cv.height - 14) * S2;
    const bo = U.layout('me').find(b => b.id === 'boiler');
    const r = { x: bx0 + (bo.c0 - cv._c0) * cp, y: by0 + (bo.r0 - cv._r0) * cp, w: (bo.c1 - bo.c0 + 1) * cp, h: (bo.r1 - bo.r0 + 1) * cp };
    const items = U.catItems('energy');
    const g6 = U.gauges('me');
    const corner = (x, y, rot) => ab(x, y, 30, 30, h('div', { class: 'm-brass', style: `width:100%;height:100%;clip-path:polygon(0 0,100% 0,0 100%);rotate:${rot}deg;border-width:0` }));
    const row = ([id, mt, n, price], hov) => h('div', { style: `position:relative;display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;padding:5px 4px;border-bottom:1px dotted var(--ink3);${hov ? 'background:rgba(168,40,29,.07);box-shadow:inset 3px 0 0 var(--red)' : ''}` },
      h('div', { style: 'display:grid;place-items:center;height:44px' }, fit(U.mod(id, mt), 42, 50)),
      h('div', {}, h('div', { style: 'font:900 14px var(--serif)' }, M[id].name), h('div', { class: 't-small', style: 'font-size:11px' }, `占 ${SA.fp(id).w}×${SA.fp(id).h} · ${(M[id].desc || '').split(/[，。；]/)[0]}`)),
      n ? h('span', { class: 't-num', style: 'color:var(--red);border:2px solid var(--red);border-radius:3px;padding:0 5px;rotate:6deg;font-size:13px' }, `×${n}`) : h('span', { class: 'm-kraft t-num', style: 'padding:2px 8px 2px 12px;font-size:12px;clip-path:polygon(7px 0,100% 0,100% 100%,7px 100%,0 50%)' }, money(price)));
    return U.screen('fg',
      // 桌面
      h('div', { class: 'ab', style: 'inset:0;background:var(--speck),repeating-linear-gradient(90deg,rgba(0,0,0,.2) 0 2px,transparent 2px 160px),repeating-linear-gradient(88deg,rgba(255,220,170,.035) 0 1px,transparent 1px 7px),linear-gradient(180deg,#4a2e1a,#2e1b0f)' }),
      h('div', { class: 'ab', style: 'inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(255,200,120,.12),transparent 60%),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.45))' }),
      // 左上：卷起的蓝图（= 蓝图库）
      ab(18, 12, 250, 48, h('div', { class: 'who-click', style: 'position:relative;width:100%;height:100%' },
        [0, 1, 2].map(k => h('i', { style: `position:absolute;left:${k * 10}px;top:${k * 12}px;width:${200 - k * 16}px;height:20px;border-radius:10px;background:linear-gradient(180deg,#3a6aa6,#1f4a80 60%,#163766);box-shadow:inset -10px 0 0 #e8dfc6,2px 3px 0 rgba(0,0,0,.4)` },
          h('i', { style: 'position:absolute;left:40px;top:-1px;bottom:-1px;width:8px;background:linear-gradient(90deg,var(--brass1),var(--brass3),var(--brass1))' }))),
        h('span', { class: 'm-kraft', style: 'position:absolute;left:196px;top:6px;padding:2px 8px;font:700 12px var(--serif);rotate:4deg' }, '蓝图柜 · 6 卷'))),
      // 顶上：铭牌 + 开关 + 撤销 + 钱
      ab(350, 14, 580, 44, h('div', { style: 'display:flex;align-items:center;gap:12px;height:100%' },
        h('span', { class: 'm-brass t-engrave', style: 'display:inline-flex;gap:10px;align-items:center;padding:5px 14px;font-size:19px' }, h('i', { class: 'screw' }), '一号原型机', h('i', { class: 'screw' })),
        h('span', { style: 'margin-left:auto' }), sw('主体', '侧挂'), btn('↶ 撤销', { sm: true }), btn('重做', { sm: true }))),
      ab(936, 12, null, null, counter()),
      // 中：铁制图板 + 蓝图纸
      ab(bx0 - 38, by0 - 44, gw + 76, gh + 118, h('div', { class: 'm-iron rivets', style: 'width:100%;height:100%' })),
      ab(bx0 - 24, by0 - 30, gw + 48, gh + 90, h('div', { class: 'm-blue', style: 'width:100%;height:100%;box-shadow:inset 0 0 0 1px rgba(234,244,255,.5),2px 3px 0 rgba(0,0,0,.4)' })),
      corner(bx0 - 28, by0 - 34, 0), corner(bx0 + gw - 2, by0 - 34, 90), corner(bx0 + gw - 2, by0 + gh + 30, 180), corner(bx0 - 28, by0 + gh + 30, 270),
      ab(bx0, by0 - 22, gw, 16, h('div', { style: 'display:flex;justify-content:space-between;font:11px Consolas,monospace;color:rgba(234,244,255,.7);letter-spacing:.1em' }, h('span', {}, `图号 SA-001 · 侧视 · 比例 1:24 · 评分 ${F.rating}`), h('span', {}, '主体层'))),
      ab(bx0, by0, gw, gh, h('div', { style: 'width:100%;height:100%;box-shadow:inset 0 0 0 1px rgba(234,244,255,.55)' })),
      ab(bx0, by0, null, null, U.show(cv, S2)),
      // 红铅笔：问题圈
      U.svg(1280, 720, `<ellipse cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" rx="${r.w * .74}" ry="${r.h * .7}" fill="none" stroke="#ff7a66" stroke-width="3" stroke-dasharray="9 4" transform="rotate(-6 ${r.x + r.w / 2} ${r.y + r.h / 2})"/><path d="M${r.x - 6} ${r.y + 16} Q ${r.x - 60} ${r.y - 10} ${r.x - 76} ${r.y - 52}" fill="none" stroke="#ff7a66" stroke-width="2.5"/>`),
      ab(r.x - 150, r.y - 92, 160, null, h('div', { class: 'hand', style: 'color:#ff8a76;font-size:17px;line-height:1.3;text-shadow:0 1px 0 rgba(0,0,0,.4)' }, '① 锅炉不够', h('br'), `要 ${F.demand} 只给 ${F.supply}`)),
      // 选中：挂一张牛皮纸工单（线从锅炉垂下来，工单搭在图板下沿）
      U.svg(1280, 720, `<path d="M${r.x + 14} ${r.y + r.h - 4} Q ${r.x - 20} ${r.y + r.h + 40} ${bx0 + 120} ${by0 + gh + 40}" fill="none" stroke="#d8c7a0" stroke-width="2"/>`),
      ab(bx0 - 14, by0 + gh + 34, 368, null, h('div', { class: 'm-kraft', style: 'position:relative;padding:10px 14px 10px 24px;rotate:-2.5deg;box-shadow:3px 4px 0 rgba(0,0,0,.4);clip-path:polygon(12px 0,100% 0,100% 100%,12px 100%,0 12px)' },
        h('i', { class: 'eyelet', style: 'position:absolute;left:8px;top:6px' }),
        h('div', { style: 'display:flex;align-items:center;gap:8px;font:900 15px var(--serif);letter-spacing:.1em' }, '工单 · 燃煤锅炉', mat(1)),
        h('div', { class: 't-small', style: 'color:var(--ink);margin:4px 0 8px' }, '耐久 120/120 · 供给 6 · 产热 1.5/秒 · 0.55 t'),
        h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, btn('升熟铁 £78', { sm: true }), btn('加甲 £18', { sm: true }), btn('拆下', { sm: true })))),
      // 左：几叠纸 = 参数
      ab(16, 76, 282, null, panel('性能单', h('div', { style: 'display:grid;gap:9px' },
        V.meter === 'v2' ? h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:14px 4px;justify-items:center' }, g6.map(g => meter(g, { sz: 64 }))) : g6.map(g => meter(g, { note: false })),
        h('div', { class: 'hand', style: 'font-size:13px;color:var(--pencil)' }, '红铅笔影子 = 悬停「竖式锅炉」装上以后')), { inner: 'padding-bottom:10px' })),
      ab(22, V.panel === 'v2' ? 560 : 548, 270, null, h('div', { class: 'm-paper old', style: 'padding:10px 14px;rotate:1.2deg' }, h('i', { class: 'tack', style: 'left:8px;top:-5px' }),
        h('div', { style: 'font:900 14px var(--serif);letter-spacing:.2em;border-bottom:1px solid var(--ink);margin-bottom:6px' }, '出战前要处理'),
        h('div', { class: 'hand', style: 'font-size:16px;color:var(--red)' }, `① 动力不足 ${F.demand} > ${F.supply}`),
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:6px' }, h('span', { class: 't-small' }, '添锅炉 / 换大锅炉'), btn('在图上找', { sm: true })))),
      // 右：零件目录 + 纸页签
      ab(1224, 90, 44, 500, h('div', { style: 'display:grid;gap:4px' }, U.CATS.map(k => h('div', { class: 'm-paper', style: `height:66px;display:grid;place-items:center;writing-mode:vertical-rl;font:900 13px var(--serif);letter-spacing:.25em;border-radius:0 6px 6px 0;box-shadow:inset 6px 0 0 ${SA.CAT[k].plate},2px 2px 0 rgba(0,0,0,.35);${k === 'energy' ? 'translate:6px 0;color:var(--red)' : ''}` }, SA.CAT[k].name)))),
      ab(962, 74, 264, 510, h('div', { class: 'm-paper', style: 'position:relative;height:100%;padding:12px 12px' },
        h('i', { style: 'position:absolute;inset:0;translate:5px 5px;rotate:1deg;z-index:-1;background:#dcc693;box-shadow:2px 3px 0 rgba(0,0,0,.3)' }),
        h('div', { style: 'display:flex;align-items:baseline;gap:8px;border-bottom:3px double var(--ink);padding-bottom:4px' }, h('span', { class: 't-kick', style: 'white-space:nowrap' }, '邮购目录'), h('b', { style: 'font:900 18px var(--serif)' }, '能源'), h('span', { class: 't-small', style: 'margin-left:auto' }, '5 种')),
        h('div', { style: 'display:flex;justify-content:flex-end;margin:6px 0 2px' }, sw('有货', '全部', true)),
        items.map(x => row(x, x[0] === 'boiler_s')))),
      // 悬停提示：索引卡（指着目录里的竖式锅炉）
      ab(778, 348, 204, null, h('div', { class: 'k-card', style: 'rotate:-1.5deg;z-index:6' }, h('b', {}, '竖式锅炉'), '　1×2 · 库存 1', h('br'), '小锅炉，提供 3 点动力。', h('br'), '装上：', h('span', { class: 'up' }, '动力 6 → 9'), h('br'), h('span', { class: 'dn' }, '重 +0.36 t · 产热 +0.8'))),
      // 右下：拉闸
      ab(1010, 598, null, null, lever('出战', '还有 1 项要处理')),
      ab(bx0 + 300, by0 + gh + 30, 290, null, h('div', { class: 'hand', style: 'color:rgba(234,244,255,.8);font-size:14px;text-align:right' }, '从右边目录拖零件到图纸上 · 右键拆下')),
    );
  }

  // ---------- 出战：黑板 + 对决海报 + 档案 + 下注单 ----------
  function arena() {
    const F = U.facts(), foe = D.stages[2], sm = U.stats('me'), sf = U.stats('foe');
    const chalkSketch = `<g stroke="#ece6d4" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"><path d="M4 70 Q 60 68 120 70 T 236 69"/><rect x="104" y="42" width="26" height="27" transform="rotate(-2 117 55)"/><path d="M106 44 L128 68 M128 44 L106 68" stroke-width="1"/><rect x="138" y="52" width="24" height="17"/>
      <rect x="10" y="52" width="30" height="16"/><rect x="196" y="46" width="34" height="22"/></g>
      <path d="M42 58 L 100 58" stroke="#ff8a76" stroke-width="2.5" stroke-dasharray="7 5"/><path d="M95 53 l7 5 -7 5" stroke="#ff8a76" stroke-width="2.5" fill="none"/>
      <path d="M198 46 Q 150 -4 44 48" stroke="#ffd166" stroke-width="2.5" fill="none" stroke-dasharray="6 5"/><path d="M52 40 l-9 9 12 2" stroke="#ffd166" stroke-width="2.5" fill="none"/>`;
    const oval = (name) => h('div', { style: 'position:relative;width:128px;height:152px;border-radius:50%;padding:6px;background:radial-gradient(ellipse,#f1e6c8 60%,#d9c48e);box-shadow:0 0 0 2px var(--ink),0 0 0 6px #efe2c0,0 0 0 7px var(--ink)' },
      h('div', { style: 'width:100%;height:100%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#e9dcb4,#c9b27c);box-shadow:inset 0 0 0 1px var(--ink)' }, (() => { const c = U.show(U.coal(name), 1.2); c.style.filter = 'sepia(.35) contrast(1.05)'; return c; })()));
    const field = (k, v, circ) => h('div', { style: 'display:grid;grid-template-columns:52px 1fr;gap:6px;font:13px/1.55 var(--type)' }, h('span', { style: 'color:var(--ink2)' }, k + '：'), circ ? h('span', { style: 'position:relative;color:var(--ink)' }, v, h('i', { style: 'position:absolute;inset:-3px -6px;border:2px solid var(--red);border-radius:50% 45% 55% 48%;rotate:-2deg' })) : h('span', {}, v));
    return U.screen('fg',
      // 墙和地
      h('div', { class: 'ab', style: 'inset:0;background:var(--speck),linear-gradient(180deg,transparent 0 22px,#150d08 22px 24px) 0 0/100% 24px,linear-gradient(90deg,transparent 0 46px,#150d08 46px 48px) 0 0/48px 48px,linear-gradient(90deg,transparent 0 22px,#150d08 22px 24px,transparent 24px) 0 24px/48px 48px,#43271b' }),
      h('div', { class: 'ab', style: 'inset:0;background:radial-gradient(ellipse at 52% 18%,rgba(255,200,120,.3),transparent 55%),radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(0,0,0,.55))' }),
      h('div', { class: 'ab', style: 'left:0;right:0;bottom:0;height:34px;background:repeating-linear-gradient(90deg,#3a2415 0 94px,#22150c 94px 96px),linear-gradient(#4a2e1a,#2a180c);border-top:4px solid #120a05' }),
      // 左：黑板
      ab(18, 36, 318, 590, h('div', { class: 'chalk', style: 'height:100%' },
        h('div', { style: 'display:flex;gap:14px;font-size:16px;margin-bottom:10px' }, h('span', { style: 'border-bottom:2px solid var(--chalk)' }, '战役'), h('span', { style: 'opacity:.6' }, '街头赛'), h('span', { style: 'opacity:.3' }, '锦标赛（没开）')),
        h('div', { class: 't' }, D.chapter),
        D.stages.map(s => h('div', { class: 'ln', style: s.next ? 'margin:8px 0' : '' }, h('span', { class: 'ck' }, s.done ? '✓' : ''), h('span', { class: s.done ? 'strike' : s.next ? 'circ' : '' }, s.name), h('span', { class: 'who' }, s.boss ? 'Boss · 今晚' : s.pilot.split(' ').pop()))),
        h('div', { class: 't', style: 'font-size:16px;margin-top:16px' }, '往后'),
        D.chapters.slice(2).map(c => h('div', { class: 'ln lock', style: 'font-size:15px' }, h('span', { class: 'ck' }, '?'), c)),
        h('div', { class: 't', style: 'font-size:16px;margin-top:16px' }, '场地：货箱'),
        U.svg(250, 80, chalkSketch, 'position:static'),
        h('div', { style: 'font-size:14px;opacity:.85' }, h('span', { style: 'color:#ff8a76' }, '直射被挡'), '　', h('span', { style: 'color:#ffd166' }, '高抛越过')),
        h('i', { class: 'rag', style: 'left:36px;bottom:-16px' }), h('i', { class: 'stick', style: 'left:110px;bottom:-12px' }), h('i', { class: 'stick', style: 'left:146px;bottom:-12px;width:14px;background:#f0c8c0' }))),
      // 中：海报（贴在墙上：纸浆皱、角撕掉一块）
      ab(356, 14, 560, 668, h('div', { class: 'm-paper old', style: 'position:relative;width:100%;height:100%;clip-path:polygon(0 0,100% 0,100% 94%,97% 100%,93% 96%,88% 100%,0 100%);background:var(--grain),var(--fiber),repeating-linear-gradient(176deg,transparent 0 60px,rgba(80,50,20,.06) 60px 64px,transparent 64px 120px),radial-gradient(ellipse at 20% 15%,rgba(150,100,40,.2),transparent 45%),radial-gradient(ellipse at 85% 80%,rgba(120,70,20,.25),transparent 45%),linear-gradient(180deg,#eadbb0,#dcc693)' },
        h('div', { style: 'position:absolute;inset:12px;border:3px solid var(--ink);box-shadow:inset 0 0 0 3px #e4d3a6,inset 0 0 0 4px var(--ink)' }))),
      ab(376, 40, 520, null, h('div', { style: 'text-align:center' },
        h('div', { class: 't-kick', style: 'font-size:14px' }, `✦ ${D.place} · 蒸汽竞技大赛 · 第一章压轴 ✦`),
        h('div', { style: 'font:900 88px/1.08 var(--serif);letter-spacing:.2em;margin:4px 0 0 .2em;color:var(--red);text-shadow:3px 2px 0 var(--ink)' }, '大对决'),
        h('div', { style: 'font:italic 700 15px Georgia,serif;letter-spacing:.55em' }, 'GRAND MATCH'),
        h('div', { style: 'margin:6px auto 0;width:360px;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:2px 0;font:700 13px var(--serif);letter-spacing:.3em' }, '今 晚 八 时 · 风 雨 无 阻'))),
      ab(398, 226, 200, null, h('div', { style: 'display:grid;justify-items:center;gap:6px' }, oval('你'), h('div', { style: 'font:900 20px var(--serif);letter-spacing:.1em' }, '铁匠铺新人'), h('div', { class: 't-small' }, `一号原型机 · 评分 ${F.rating}`))),
      ab(676, 226, 200, null, h('div', { style: 'display:grid;justify-items:center;gap:6px' }, oval(foe.pilot), h('div', { style: 'font:900 20px var(--serif);letter-spacing:.1em' }, '玛莎·布莱克'), h('div', { class: 't-small' }, `煤灰寡妇 · 评分 ${F.foeRating}`))),
      ab(596, 270, null, null, h('div', { class: 'k-seal', style: 'width:78px;height:78px;font-size:30px' }, '对')),
      ab(420, 440, null, null, eng(U.car('me'), 1)),
      ab(700, 438, null, null, eng(U.car('foe'), 1, true)),
      ab(386, 628, 500, null, h('div', { style: 'position:relative;text-align:center;font:900 16px var(--serif);letter-spacing:.12em;color:#fff4e0;background:var(--red);padding:6px 0;clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)' }, `奖金 ${money(foe.prize)} · 声望 +1 · 另缴获一件`)),
      // 右上：对手档案（牛皮纸夹 + 打字纸 + 回形针夹照片）
      ab(936, 26, 326, 360, h('div', { class: 'm-kraft', style: 'position:relative;width:100%;height:100%;rotate:1.5deg;box-shadow:3px 5px 0 rgba(0,0,0,.45);clip-path:polygon(0 18px,30% 18px,34% 0,62% 0,66% 18px,100% 18px,100% 100%,0 100%)' },
        h('span', { style: 'position:absolute;left:36%;top:2px;font:900 11px var(--serif);letter-spacing:.2em' }, '档 案 · 42'))),
      ab(950, 56, 300, 318, h('div', { class: 'm-paper', style: 'height:100%;padding:12px 14px;rotate:.5deg' },
        h('div', { style: 'display:flex;align-items:baseline;gap:8px;border-bottom:2px solid var(--ink);padding-bottom:4px;margin-bottom:8px' }, h('b', { style: 'font:900 17px var(--serif);letter-spacing:.2em' }, '对手档案'), h('span', { class: 'k-stamp', style: 'font-size:11px;margin-left:auto;padding:0 6px' }, '独家')),
        h('div', { style: 'display:grid;grid-template-columns:1fr 82px;gap:10px' },
          h('div', { style: 'display:grid;gap:2px' }, field('姓名', foe.pilot), field('外号', '后巷女王'), field('座驾', '四足 · 臼炮 + 直射炮'), field('评分', `${F.foeRating}（你 ${F.rating}）`), field('速度', `${SA.kmh(sf.topSpeed)}，比你快`), field('弱点', '两台锅炉在车尾', true)),
          h('div', { style: 'position:relative;justify-self:end;rotate:4deg' }, h('div', { style: 'padding:4px;background:#f6efdc;box-shadow:1px 2px 0 rgba(0,0,0,.35)' }, (() => { const c = U.show(U.coal(foe.pilot, { size: 'portrait' }), 0.75); c.style.filter = 'sepia(.7) contrast(1.1)'; return c; })()),
            h('i', { style: 'position:absolute;left:28px;top:-12px;width:12px;height:36px;border:2px solid var(--brass2);border-radius:7px;box-shadow:0 0 0 1px var(--brass0)' }))),
        h('div', { class: 'hand', style: 'margin-top:10px;font-size:16px;color:var(--red);line-height:1.4;border-top:1px dashed var(--ink3);padding-top:6px' }, '线人：她专砸车顶——顶上加甲；', h('br'), '别追，守住正面。'))),
      // 右下：下注单（孔线票根 + 编号 + 印好的赔率）+ 黄铜筹码
      ab(946, 404, 312, 164, h('div', { style: 'position:relative;height:100%;display:grid;grid-template-columns:56px 1fr;rotate:-1deg;filter:drop-shadow(3px 4px 0 rgba(0,0,0,.45))' },
        h('div', { style: 'background:var(--grain),linear-gradient(180deg,#d8e6c8,#c6d8b2);border-right:2px dashed var(--ink3);display:grid;place-items:center;writing-mode:vertical-rl;font:700 12px var(--num);letter-spacing:.2em' }, 'No. 0042'),
        h('div', { style: 'background:var(--grain),repeating-linear-gradient(45deg,rgba(40,80,40,.05) 0 2px,transparent 2px 6px),linear-gradient(180deg,#e4efd6,#d2e2c0);padding:10px 12px' },
          h('div', { style: 'text-align:center;font:900 14px var(--serif);letter-spacing:.2em;border-bottom:3px double var(--ink);padding-bottom:3px' }, '伦敦蒸汽赛会 · 下注凭单'),
          h('div', { style: 'font:13px/1.8 var(--serif);margin-top:4px' }, '押：', h('b', {}, '铁匠铺新人'), '　赔率 ', h('b', { class: 't-num' }, '2 : 1')),
          h('div', { style: 'display:flex;gap:6px;align-items:center;margin-top:4px' }, ['不下', '£50', '£100'].map((t, k) => h('span', { style: `position:relative;padding:2px 10px;border:1.5px solid var(--ink);font:700 13px var(--num)` }, t, k === 1 ? h('i', { class: 'k-stamp', style: 'position:absolute;left:-6px;top:-6px;right:-6px;bottom:-6px;border-radius:50%;padding:0;rotate:-10deg' }) : null)),
            h('span', { class: 'hand', style: 'margin-left:auto;color:var(--red);font-size:15px' }, '赢 £100'))))),
      ab(946, 580, null, null, h('div', { style: 'display:flex;gap:4px;align-items:flex-end' }, [5, 4, 3].map((n, k) => h('div', { style: 'display:grid' }, [...Array(n)].map(() => h('i', { style: `display:block;width:${34 - k * 4}px;height:6px;margin-top:-1px;border-radius:50%;background:linear-gradient(180deg,var(--brass3),var(--brass1));box-shadow:0 0 0 1px var(--brass0)` })))))),
      // 拉闸 + 回车间
      ab(1052, 574, null, null, lever('拉闸出战', 'A / D 走 · 左键蓄准开火')),
      ab(30, 672, null, null, btn('← 回车间对症改装', { sm: true })),
    );
  }

  // ---------- 页面 ----------
  const SECS = [['lang', '设计语言 + 小组件', lang, '按钮 / 面板 / 属性表各三种，选好下面立刻换'], ['home', '主页面', home, '人物会自己聊天、打铁、拧扳手；点人物听他跟你说的话，点报纸 = 看赛程'], ['garage', '改装台', garage, '中间铁图板上的蓝图 = 改装台；左边一叠参数单，右边邮购目录 + 纸页签；红铅笔 = 问题'], ['arena', '出战', arena, '黑板上划掉打过的、圈出要打的，还画了场地；中间贴海报，右边档案和下注单']];
  function pickBtn(key, v) {
    const on = V[key] === v;
    return h('button', { class: `pick ${on ? 'on' : ''}`, style: 'margin-left:0', onclick: () => { V[key] = v; save(); render(); } }, on ? '✔ 用这种' : '选这个');
  }
  function okBtn(k) {
    const on = st.ok[k];
    return h('button', { class: `pick ${on ? 'on' : ''}`, onclick: () => { st.ok[k] = !on; save(); render(); } }, on ? '✔ 这页方向可以' : '这页方向可以');
  }
  function render() {
    const ctl = document.getElementById('ctl'), out = document.getElementById('out');
    const NM = { v1: '①', v2: '②', v3: '③' };
    ctl.replaceChildren(h('span', { class: 'k' }, '看'),
      h('div', { class: 'seg' }, [['all', '全部'], ...SECS.map(s => [s[0], s[1]])].map(([k, n]) => h('button', { class: k === st.sec ? 'on' : '', onclick: () => { st.sec = k; save(); render(); } }, n))),
      h('span', { class: 'picks' }, '现在用：', h('b', {}, `按钮 ${NM[V.btn]} · 面板 ${NM[V.panel]} · 属性表 ${NM[V.meter]}`), '　认可：', h('b', {}, SECS.slice(1).filter(s => st.ok[s[0]]).map(s => s[1]).join('、') || '—')));
    out.replaceChildren(...SECS.filter(s => st.sec === 'all' || st.sec === s[0]).map(([k, n, fn, note]) => h('section', { class: 'blk', 'data-k': `v2-${k}` },
      h('div', { class: 'blk-h' }, h('b', {}, n), h('span', { class: 'muted' }, note), k === 'lang' ? null : okBtn(k)), fn())));
  }
  render();
})();
