// 界面重建 v3 · 像素版：铁匠铺 × 公报。所有框、按钮、表、齿轮都是 SA.PX 画的像素件（2 倍），不用渐变、圆角、模糊阴影和旋转。
// 这一版按用户意见删掉了意义不明的装饰（黑板下的抹布粉笔、筹码堆、蓝图卷、提示小纸条……），拉杆改成齿板式调速杆，齿轮进到会动的部件里。
(() => {
  const U = SA.UILAB, X = SA.PX, { h, D, money } = U, M = SA.MODULES, P = SA.PAL;
  X.init();
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const img = (cv, s = 2, style = '') => { const c = U.show(cv, s); if (style) c.style.cssText += style; return c; };
  const num = (str, col = X.INK, sh) => { const c = img(X.num(str, col, { shadow: sh })); c.classList.add('n'); return c; };
  const sk = (name, kids, style = '', cls = '') => h('div', { class: `sk sk-${name} ${cls}`, style }, kids);

  // ---------- 桌面、砖墙：像素平铺底纹 ----------
  (() => {
    document.documentElement.style.setProperty('--px-desk', `url(${X.planks().toDataURL()})`);
    const b = X.C(32, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) { const row = y >> 3, off = row ? 8 : 0, mort = (y % 8 === 7) || ((x + off) % 16 === 15); b.p(x, y, mort ? P.bg[0] : X.hash((x + off) >> 4, row, 9) < 0.5 ? P.bg[3] : P.bg[2]); if (!mort && (y % 8 === 0)) b.p(x, y, P.bg[4]); }
    document.documentElement.style.setProperty('--px-brick', `url(${b.c.toDataURL()})`);
  })();

  // ---------- 组件 ----------
  function btn(label, o = {}) {
    const kind = o.kind || 'sec';
    return h('button', { class: `pxb ${kind} ${o.sm ? 'sm' : ''} ${o.big ? 'big' : ''} ${o.dn ? 'dn' : ''} ${o.spin ? 'spin' : ''}` }, kind === 'pri' && o.gear !== false ? h('i', { class: 'g' }) : null, h('span', {}, label));
  }
  const plate = (text, style = '') => h('span', { class: 'sk sk-brass plate', style }, text);
  function tag(kids, color) {
    return h('span', { class: 'ptag' }, img(X.tagHead()), h('span', { class: 'sk sk-kraft body' }, color ? h('i', { style: `width:6px;height:14px;background:${color};display:block` }) : null, kids));
  }
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const matTag = (mt) => { const m = SA.MATS[mt]; return tag([num(ROMAN[mt]), h('span', {}, m.name), m.rank ? h('b', { class: 'red' }, m.rank) : null], m.chip); };
  const stamp = (kids, style = '') => h('span', { class: 'sk sk-stamp pstamp', style }, kids);
  // 齿条表：左边一只小齿轮推着一根带齿的条；棋盘点 = 装上以后多出来 / 少掉的部分；红竖线 = 上限
  const RAMPS = { power: P.gauge, weight: P.iron.slice(1), speed: P.glass, heat: P.fire, water: P.water, hp: P.brass };
  function rack(pct, o = {}) {
    const W = o.w || 70, k = X.C(W, 11), L = W - 10, len = Math.round(Math.min(1, pct) * L), over = o.over;
    const R4 = over ? P.fire : (RAMPS[o.k] || P.brass);
    X.box(k, 6, 1, W - 6, 9, { o: P.dark[0], b: P.dark[1], l: P.iron[0], d: P.dark[0] }, true);
    for (let x = 0; x < len; x++) { const xx = 8 + x; k.p(xx, 4, R4[3]); k.p(xx, 5, R4[2]); k.p(xx, 6, R4[1]); if (x % 3 === 1) k.p(xx, 3, R4[2]); }
    if (len) { k.r(8 + len, 3, 1, 4, R4[0]); }
    if (o.d) { const a = Math.round(Math.min(1, pct + Math.min(0, o.d)) * L), b = Math.round(Math.min(1, pct + Math.max(0, o.d)) * L), col = o.good === false ? P.fire[2] : P.gauge[2]; for (let x = a; x < b; x++) for (let y = 3; y < 7; y++) if ((x + y) % 2 === 0) k.p(8 + x, y, col); }
    if (o.lim != null) { const lx = 8 + Math.round(o.lim * L); k.r(lx, 0, 1, 11, P.fire[1]); k.p(lx - 1, 0, P.fire[1]); k.p(lx + 1, 0, P.fire[1]); }
    k.g.drawImage(X.gear(5, 7, X.RAMP.brass, len * 0.35), 0, 0);
    return k.c;
  }
  function meter(g, o = {}) {
    const bad = g.pct >= 1 && ['power', 'weight', 'heat'].includes(g.k);
    const lim = g.k === 'power' ? U.facts().supply / Math.max(U.facts().demand, U.facts().supply) : null;
    const good = g.delta ? (g.k === 'weight' || g.k === 'heat' ? g.delta < 0 : g.delta > 0) : true;
    const val = String(g.val).replace(/\s/g, '').replace('km/h', 'km/h');
    return h('div', { class: 'prow', style: `grid-template-columns:44px ${(o.w || 70) * 2}px 1fr;${o.light ? 'color:#e4e0d6;text-shadow:2px 2px 0 #0b0e15' : ''}` }, h('span', { class: 'nm' }, g.name),
      img(rack(g.pct, { k: g.k, over: bad, d: g.delta, good, lim, w: o.w })),
      h('span', { style: 'display:flex;gap:4px;align-items:center;justify-content:flex-end' }, num(val, bad ? X.RED : o.light ? '#e4e0d6' : X.INK, o.light ? P.dark[0] : undefined), g.delta ? num(g.delta > 0 ? '▲' : '▼', good ? P.gauge[1] : X.RED) : null));
  }
  function counter() {
    const s = String(D.money).padStart(5, '0'), N = s.length + 1, W = 9 + N * 8 + 4, k = X.C(W, 15);
    X.box(k, 6, 0, W - 6, 15, X.RAMP.iron);
    X.box(k, 9, 2, N * 8 + 1, 11, { o: P.dark[0], b: P.dark[0], l: P.dark[0], d: P.dark[0] });
    ['£', ...s].forEach((ch, i) => {
      const x = 10 + i * 8; const PR = X.RAMP.paper;
      for (let y = 3; y < 12; y++) k.r(x, y, 7, 1, y === 3 || y === 11 ? PR.d : y === 4 || y === 10 ? PR.a : PR.l);
      k.g.drawImage(X.num(ch, i ? X.INK : X.RED), x + 1, 4);
    });
    k.g.drawImage(X.gear(6, 8, X.RAMP.brass, 0.2), 0, 1);
    const stars = h('span', { style: 'display:flex;gap:2px' }, [0, 1, 2, 3, 4].map(i => img(X.star(i < D.rep))));
    return sk('iron', [img(k.c), stars, h('span', { style: 'display:flex;gap:4px;align-items:center' }, img(X.ingot()), num(`×${D.ingots[0][1]}`, '#e4e0d6', P.dark[0]))], 'display:inline-flex;gap:12px;align-items:center;padding:0 4px', 'drop');
  }
  // 换层旋钮：黄铜齿轮上一根指针，指向哪边就是哪层
  function toggle(a, b, right) {
    const k = X.C(15, 15); k.g.drawImage(X.gear(7, 9, X.RAMP.brass, 0.1), 0, 0);
    const ex = right ? 13 : 1; X.line(k, 7, 7, ex, 3, P.dark[0]); X.line(k, 7, 8, ex, 4, P.dark[0]); k.r(6, 6, 3, 3, P.dark[0]); k.p(6, 6, P.iron[3]);
    const lab = (t, on) => sk('paper', t, `padding:0 2px;font:bold 14px SimSun,serif;white-space:nowrap;${on ? '' : 'color:#9a845f'}`);
    return sk('iron', [lab(a, !right), img(k.c, 2, 'cursor:pointer'), lab(b, right)], 'display:inline-flex;gap:6px;align-items:center;padding:0 2px');
  }
  function card(kids, style = '') { return h('div', { style: `position:relative;${style}` }, img(X.clip(), 2, 'position:absolute;left:14px;top:-12px;z-index:2'), sk('paper', kids, 'padding:4px 6px', 'drop')); }
  function part([id, mt, n, price], sel) {
    return h('div', { style: 'position:relative;width:112px' }, sk(sel ? 'paperOld' : 'paper', [
      h('div', { style: 'height:62px;display:grid;place-items:center' }, (() => { const c = U.show(U.mod(id, mt), 1); c.style.maxHeight = '60px'; c.style.maxWidth = '84px'; c.style.width = 'auto'; c.style.height = 'auto'; if (!n) c.style.opacity = '.55'; return c; })()),
      h('div', { style: 'font:bold 12px SimSun,serif;text-align:center' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name)], 'padding:2px 2px', 'drop'),
    h('div', { style: 'position:absolute;right:-6px;top:-8px' }, n ? stamp(num(`×${n}`, X.RED), 'background:#efe4c6') : tag(num(money(price)))),
    sel ? brackets(112, 100) : null);
  }
  // 黄铜角框：可以点 / 选中（四个角，像素）
  function brackets(w, hh, col = P.brass[2]) {
    const k = X.C(Math.round(w / 2), Math.round(hh / 2)), L = 5;
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [k.w - 1, 0, -1, 1], [0, k.h - 1, 1, -1], [k.w - 1, k.h - 1, -1, -1]]) for (let i = 0; i < L; i++) { k.p(x + sx * i, y, col); k.p(x, y + sy * i, col); k.p(x + sx * i, y + sy, P.brass[0]); k.p(x + sx, y + sy * i, P.brass[0]); }
    return img(k.c, 2, 'position:absolute;left:0;top:0;pointer-events:none');
  }
  function bubbleEl(x, y, tailX) {
    const inner = h('span', {});
    const b = h('div', { class: 'bubble', style: `left:${x}px;top:${y}px` }, sk('paper', inner, 'padding:2px 6px', 'drop'), img(X.tail(), 2, `left:${tailX}px`));
    b.lastChild.classList.add('tl');
    b.set = (who, html) => { inner.innerHTML = `<span class="who">${who}</span>${html}`; };
    return b;
  }
  function leverEl(label, sub, pos = 0) {
    const lv = img(X.lever(pos));
    const box = h('div', { class: 'hot', style: 'display:flex;flex-direction:column;align-items:center;gap:4px' }, lv, plate(label, 'font-size:18px'), sub ? h('span', { class: 'cap', style: 'margin:0' }, sub) : null);
    // 悬停：杆往前推（三帧）
    const fr = [0, 0.5, 1].map(p => X.lever(p)); let t = null;
    box.addEventListener('mouseenter', () => { let i = 0; clearInterval(t); t = setInterval(() => { i = Math.min(2, i + 1); lv.getContext('2d').clearRect(0, 0, 50, 58); lv.getContext('2d').drawImage(fr[i], 0, 0); if (i === 2) clearInterval(t); }, 70); });
    box.addEventListener('mouseleave', () => { clearInterval(t); lv.getContext('2d').clearRect(0, 0, 50, 58); lv.getContext('2d').drawImage(fr[0], 0, 0); });
    return box;
  }
  // 纸上的笔迹：红笔圈住 / 波浪下划线 / 注释箭头（都是像素）
  const loop = (kids, w, hh, seed = 5, style = '') => h('span', { style: `position:relative;display:inline-block;${style}` }, kids, img(X.penLoop(w, hh, X.PEN, seed), 2, `position:absolute;left:50%;top:50%;margin-left:-${w}px;margin-top:-${hh}px;pointer-events:none`));
  const underline = (kids, w, seed = 3) => h('span', { style: 'position:relative;display:inline-block' }, kids, img(X.penUnder(w, X.PEN, seed), 2, 'position:absolute;left:-4px;bottom:-9px;pointer-events:none'));
  const hand = (text, size = 17, style = '') => h('span', { style: `font:${size}px/1.35 KaiTi,STKaiti,serif;color:${X.PEN};white-space:nowrap;${style}` }, text);
  function dial(pct, label) {
    const k = X.C(23, 23), c = 11.5;
    for (let y = 0; y < 23; y++) for (let x = 0; x < 23; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d > 11.3) continue; k.p(x, y, d > 10.3 ? P.brass[0] : d > 8.6 ? (x + y < 20 ? P.brass[3] : P.brass[1]) : d > 7.8 ? P.brass[0] : X.RAMP.paper.l); }
    for (let i = 0; i <= 6; i++) { const a = (-135 + 270 * i / 6) * Math.PI / 180; k.p(Math.round(c - 0.5 + Math.sin(a) * 6.5), Math.round(c - 0.5 - Math.cos(a) * 6.5), X.INK); }
    const a = (-135 + 270 * pct) * Math.PI / 180; X.line(k, 11, 11, 11 + Math.sin(a) * 6, 11 - Math.cos(a) * 6, X.RED); k.r(10, 10, 3, 3, P.brass[1]); k.p(10, 10, P.brass[3]);
    return h('div', { style: 'display:grid;justify-items:center;gap:2px' }, img(k.c), label ? h('span', { class: 'small', style: 'font-weight:bold' }, label) : null);
  }

  // ---------- 设计语言 + 小组件 ----------
  function lang() {
    const g6 = U.gauges('me'), F = U.facts();
    const cap = (t) => h('span', { class: 'cap' }, t);
    const col = (t, ...kids) => h('div', { style: 'display:grid;gap:8px;align-content:start' }, cap(t), ...kids);
    const gearRow = [[4, 6], [5, 7], [6, 8], [7, 9], [9, 12]].map(([r, n]) => img(X.gear(r, n, X.RAMP.brass, 0.2)));
    return h('div', { class: 'v3 sheet' },
      h('div', { class: 'row', style: 'align-items:stretch' },
        sk('paper', [h('div', { class: 'h1' }, '铁做底 · 铜能动 · 纸写字'),
          h('div', { style: 'margin-top:6px;max-width:560px' }, '每样东西都是一张像素图：2 倍放大，一种像素大小；四阶色、左上光，没有渐变、圆角、模糊阴影，也不斜着放。', h('br'), h('b', { class: 'red' }, '黄铜 + 齿轮 = 能动手'), '：按钮里的齿轮、表上推齿条的小齿轮、钱数的计数器、换层旋钮、拉杆的扇形齿板。')], 'width:560px;padding:6px 10px', 'drop'),
        h('div', { style: 'display:grid;grid-template-columns:repeat(3,auto);gap:10px' },
          col('铁（底板）', sk('iron', '', 'width:96px;height:56px')), col('黄铜（能按）', sk('brass', '', 'width:96px;height:56px')), col('纸（写字）', sk('paper', '', 'width:96px;height:56px')),
          col('旧纸 / 海报', sk('paperOld', '', 'width:96px;height:56px')), col('牛皮纸（吊牌、档案夹）', sk('kraft', '', 'width:96px;height:56px')), col('黑板', sk('board', '', 'width:96px;height:56px')))),
      h('div', { class: 'row' },
        col('齿轮（只放在会动的部件里）', h('div', { style: 'display:flex;gap:12px;align-items:center' }, gearRow)),
        col('数字：像素字（钱、数值、价格）', h('div', { style: 'display:flex;gap:14px;align-items:center' }, sk('paper', [num('£1,240'), num('7.8/6', X.RED), num('4.2km/h'), num('×4', X.RED)], 'display:flex;gap:12px;align-items:center;padding:2px 6px'))),
        col('文字：宋体点阵（12 / 14 / 16）+ 标题黑体', sk('paper', [h('div', { class: 'h2' }, '标题 黑体'), h('div', { style: 'font:bold 16px SimSun' }, '按钮 宋体 16 粗'), h('div', {}, '正文 宋体 14'), h('div', { class: 'small' }, '小字 宋体 12')], 'padding:2px 8px'))),
      h('div', { class: 'sec-t' }, h('span', { class: 'h2 onDark' }, '按钮'), h('span', { class: 'cap', style: 'margin:0' }, '主操作的齿轮在鼠标移上去时转；按下整块下沉 2 像素、亮暗对调')),
      h('div', { class: 'row', style: 'align-items:center' },
        btn('出战', { kind: 'pri' }), btn('出战', { kind: 'pri', spin: true }), btn('出战', { kind: 'pri', dn: true }), btn('去改装'), btn('去改装', { dn: true }), btn('拆下', { kind: 'dng' }), btn('不可用', { kind: 'off' }),
        btn('升熟铁', { kind: 'pri', sm: true }), btn('撤销', { sm: true }), btn('拉闸出战', { kind: 'pri', big: true })),
      h('div', { class: 'row' },
        col('拉杆：黄铜扇形齿板 + 铁杆 + 皮握把（悬停往前推）', h('div', { style: 'display:flex;gap:18px;align-items:flex-end' }, img(X.lever(0)), img(X.lever(0.5)), img(X.lever(1)), leverEl('出战'))),
        col('换层旋钮 / 铭牌', toggle('主体', '侧挂'), toggle('有货', '全部', true), plate('一号原型机')),
        col('计数器：齿轮带着纸字轮 + 声望星 + 钢锭', counter())),
      h('div', { class: 'row', style: 'align-items:flex-end' },
        col('路标木牌：两块木板 + 长木纹 + 铁带 + 铁钉，上面贴纸条', h('div', { style: 'display:flex;gap:18px;align-items:center' }, [['出战', 1, 132, true], ['银行', -1, 110]].map(([t, dir, w, go], i) => h('div', { style: 'position:relative' }, img(X.sign(w, dir, go ? { o: '#2a0e06', d: P.fire[0], b: '#7e2a12', l: '#a8421c' } : X.RAMP.wood, 3 + i * 7)),
          h('div', { style: `position:absolute;top:9px;${dir > 0 ? 'left:26px' : 'right:26px'};width:${(t.length * 11 + 14) * 2}px;height:34px` }, img(X.paperLabel(t.length * 11 + 14, 17, 5 + i), 2, 'position:absolute;left:0;top:0'), h('span', { style: `position:absolute;inset:0;display:grid;place-items:center;font:900 19px "Microsoft YaHei",sans-serif;letter-spacing:.12em;color:${go ? X.PEN : '#2a1a05'}` }, t)))))),
        col('木箱 / 木柱', h('div', { style: 'display:flex;gap:18px;align-items:flex-end' }, img(X.crate()), img(X.post(60))))),
      h('div', { class: 'sec-t' }, h('span', { class: 'h2 onDark' }, '表'), h('span', { class: 'cap', style: 'margin:0' }, '小齿轮推齿条；棋盘点 = 装上以后（绿变好、红变差）；红竖线 = 上限；超了整条变红')),
      h('div', { class: 'row' },
        sk('paper', h('div', { style: 'display:grid;gap:6px' }, g6.map(g => meter(g))), 'padding:4px 8px;width:340px', 'drop'),
        col('小表盘（战斗顶条用）', h('div', { style: 'display:flex;gap:16px' }, dial(0.82, '耐久'), dial(0.46, '热量'), dial(0.7, '水')))),
      h('div', { class: 'sec-t' }, h('span', { class: 'h2 onDark' }, '其余')),
      h('div', { class: 'row' },
        col('材料吊牌', h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;max-width:520px' }, [1, 2, 3, 4, 5, 6].map(matTag))),
        col('纸上的笔迹：红笔圈 / 下划线 / 注释箭头 + 手写字（替代纸上的红块和按钮）', sk('paper', h('div', { style: 'display:flex;gap:26px;align-items:center;padding:8px 6px' }, loop(h('b', { style: 'font-size:16px' }, '锅炉在车尾'), 54, 20, 11), underline(num('£220'), 30, 4),
          h('span', { style: 'position:relative;display:inline-block;width:150px;height:40px' }, img(X.penArrow(30, 18, [[4, 1], [6, 14], [26, 14]]), 2, 'position:absolute;left:0;top:0'), h('span', { style: 'position:absolute;left:62px;top:14px' }, hand('能赢 £100！')))), '', 'drop')),
        col('铁上的印章（车上、零件上）', h('div', { style: 'display:flex;gap:10px' }, stamp('待修', 'background:#efe4c6'), stamp('已胜', 'background:#efe4c6'))),
        col('零件卡：有货 / 选中（黄铜角框）/ 没货挂价签', h('div', { style: 'display:flex;gap:14px' }, part(['boiler_s', 1, 1, 90]), part(['armor', 2, 1, 29], true), part(['mortar_s', 1, 0, 140])))),
      h('div', { class: 'row' },
        col('提示卡（回形针）', card([h('b', {}, '小臼炮'), ' ', num('£140'), h('div', {}, '高抛，越过货箱砸顶。'), h('div', {}, '装上：', h('b', { style: 'color:#3f8f48' }, '火力▲'), ' ', h('b', { class: 'red' }, '动力▼'))], 'width:220px')),
        col('提示条', sk('paper', [stamp('入库'), ' 缴获 熟铁锅炉'], 'display:inline-flex;align-items:center;gap:6px;padding:0 6px', 'drop'), sk('paper', [stamp('不行'), ' 这里悬空：下面要有车体'], 'display:inline-flex;align-items:center;gap:6px;padding:0 6px', 'drop')),
        col('对话气泡', h('div', { style: 'position:relative;height:70px;width:230px' }, (() => { const b = bubbleEl(0, 0, 20); b.classList.add('on'); b.set('铁匠 老汤姆', '顶上<b>压块甲</b>再去。'); return b; })()))),
      h('div', { class: 'row' },
        col('确认 / 资金不足', sk('iron', [h('div', { style: 'display:flex;justify-content:center;margin-top:-4px' }, plate('伦敦蒸汽银行')), sk('paper', [h('div', {}, '升级要 ', num('£430'), ' 你有 ', num('£240'), ' 还差 ', num('£190', X.RED)), h('div', { class: 'small dim' }, '可以借 £200，每场锦标赛利息 10%')], 'margin-top:6px;padding:2px 6px'),
          h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:8px' }, btn('算了', { sm: true }), btn('借钱升级', { kind: 'pri', sm: true }))], 'width:380px;padding:0 4px', 'drop')),
        col('缴获战利品：挑一件', sk('iron', [h('div', { style: 'display:flex;justify-content:center;margin-top:-4px' }, plate('战利品')), h('div', { style: 'display:flex;gap:14px;margin:12px 0 8px' }, part(['mortar_s', 1, 1, 0], true), part(['boiler_s', 2, 1, 0]), part(['armor', 2, 1, 0])),
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, stamp('唯一件', 'background:#efe4c6'), btn('拿走 小臼炮', { kind: 'pri', sm: true }))], 'padding:0 6px', 'drop')),
        col('战斗顶条', sk('iron', [h('div', { style: 'display:grid;gap:4px' }, sk('paper', '你', 'padding:0 4px;justify-self:start;font-weight:bold;color:#2a1a05'), meter({ k: 'hp', name: '耐久', val: '1170', pct: .82 }, { w: 60, light: true }), meter({ k: 'heat', name: '热量', val: '46%', pct: .46 }, { w: 60, light: true })),
          dial(0.4), h('div', { style: 'display:grid;gap:4px' }, sk('paper', '煤灰寡妇', 'padding:0 4px;justify-self:end;font-weight:bold;color:#2a1a05'), meter({ k: 'hp', name: '耐久', val: '880', pct: .64 }, { w: 60, light: true }), meter({ k: 'heat', name: '热量', val: '30%', pct: .3 }, { w: 60, light: true }))], 'display:flex;gap:14px;align-items:center;padding:0 6px;color:#e4e0d6', 'drop'))));
  }

  // ---------- 主页面：铁匠铺院子 ----------
  let homeTimer = null;
  function home() {
    const F = U.facts(), foe = D.stages[2];
    const C = (n, o) => U.coal(n, Object.assign({ size: 'scene' }, o));
    const hid = ['铁匠 老汤姆', '远房亲戚'].map(n => [n, SA.Coal.byName[n]]);
    hid.forEach(([n]) => delete SA.Coal.byName[n]);
    const bgc = U.scene('forge', 1280, 720, 0, 0);
    hid.forEach(([n, c]) => { SA.Coal.byName[n] = c; });
    const who = {};
    const actor = (key, x, y, frame, flip) => {
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; cv.style.cssText = 'width:112px;height:112px;image-rendering:pixelated';
      const box = h('div', { class: 'ab hot', style: `left:${x}px;top:${y}px;${flip ? 'transform:scaleX(-1)' : ''}` }, cv);
      who[key] = { box, set(f) { const g = cv.getContext('2d'); g.clearRect(0, 0, 56, 56); g.drawImage(f, 0, 0); } }; who[key].set(frame); return box;
    };
    const F_TOM = { up: C('铁匠 老汤姆', { pose: 'cheer', look: 1 }), hit: C('铁匠 老汤姆', { pose: 'point', look: 1 }), rest: C('铁匠 老汤姆', { pose: 'hold', look: 1 }), talk: C('铁匠 老汤姆', { pose: 'hold', look: -1, expr: 'happy' }), blink: C('铁匠 老汤姆', { pose: 'hold', look: 1, expr: 'blink' }) };
    const F_REL = { idle: C('远房亲戚', { pose: 'idle', look: 1 }), blink: C('远房亲戚', { pose: 'idle', look: 1, expr: 'blink' }), talk: C('远房亲戚', { pose: 'salute', look: 1, expr: 'happy' }), sleep: C('远房亲戚', { pose: 'idle', look: 1, expr: 'sleepy' }), jolt: C('远房亲戚', { pose: 'cheer', look: 1, expr: 'surprise' }) };
    const F_TIM = { work: C('学徒 小提米', { pose: 'point', look: 1 }), rest: C('学徒 小提米', { pose: 'hold', look: 1 }), talk: C('学徒 小提米', { pose: 'wave', look: -1, expr: 'happy' }), yelp: C('学徒 小提米', { pose: 'cheer', look: -1, expr: 'surprise' }) };
    const bubbles = { rel: bubbleEl(34, 386, 30), tom: bubbleEl(196, 420, 80), tim: bubbleEl(650, 418, 150) };
    const sparks = [...Array(6)].map((_, i) => h('i', { class: 'px-spark', style: `background:${i % 2 ? P.fire[3] : P.fire[2]}` }));
    const zz = h('div', { class: 'ab', style: 'left:124px;top:450px;opacity:0' }, num('z z Z', '#e4e0d6', P.dark[0]));
    const post = { c: X.post(290) };
    const lamp = X.C(14, 18); X.box(lamp, 0, 2, 14, 16, X.RAMP.iron); lamp.r(5, 0, 4, 2, P.iron[0]); lamp.r(3, 5, 8, 10, P.fire[2]); lamp.r(4, 6, 6, 8, P.fire[3]); lamp.r(3, 9, 8, 1, P.iron[0]); lamp.r(6, 5, 1, 10, P.iron[0]);
    const signs = [['出战', 1, 132, true], ['车间', -1, 116], ['蓝图柜', 1, 126], ['银行', -1, 110], ['街头赛', 1, 122]], PX = 1010;
    const root = U.screen('v3',
      img(bgc, 2, 'position:absolute;left:-330px;top:-690px'),
      // 墙上的公报（点 = 看赛程）
      ab(28, 96, 250, null, h('div', { class: 'hot' }, sk('paperOld', [
        h('div', { class: 'h2', style: 'text-align:center;letter-spacing:.4em;border-bottom:2px solid #2a1a05;padding-bottom:2px' }, '蒸汽公报'),
        h('div', { class: 'red small', style: 'margin-top:4px;font-weight:bold' }, '今晚 · 白教堂后巷'),
        h('div', { style: 'font:bold 16px/1.35 SimSun,serif;margin:2px 0 6px' }, '后巷女王「煤灰寡妇」', h('br'), '迎战铁匠铺新人！'),
        h('div', { style: 'display:flex;gap:8px;align-items:flex-end' }, sk('paper', U.show(U.engrave(U.coal(foe.pilot, { size: 'scene' }), [42, 26, 5], [184, 57, 27]), 2), 'padding:0;flex:none'), h('span', { class: 'small' }, '她专砸车顶，锅炉挂在车尾。', h('br'), h('b', { class: 'red' }, '→ 看赛程')))], 'padding:4px 8px', 'drop'))),
      // 道具
      ab(52, 562, null, null, img(X.crate())),
      ab(356, 546, null, null, U.show((() => { const k = X.C(34, 30); X.box(k, 10, 16, 14, 14, X.RAMP.wood); k.r(8, 13, 18, 4, P.dark[0]); k.r(9, 13, 16, 3, P.iron[2]); k.r(12, 9, 10, 5, P.dark[0]); k.r(13, 9, 8, 4, P.iron[1]); k.r(0, 4, 34, 6, P.dark[0]); k.r(1, 4, 32, 5, P.iron[2]); k.r(1, 4, 32, 1, P.iron[4]); k.r(27, 5, 6, 3, P.iron[3]); return k.c; })(), 2)),
      // 车（点 = 进改装台，2 倍 = 和人物、场景同一种像素大小）：黄铜角框 = 能点
      ab(430, 606 - U.car('me').height * 2 - 10, U.car('me').width * 2 + 20, U.car('me').height * 2 + 20, h('div', { class: 'hot', style: 'position:relative;width:100%;height:100%;padding:10px' }, U.show(U.car('me'), 2), brackets(U.car('me').width * 2 + 20, U.car('me').height * 2 + 20), h('div', { style: 'position:absolute;left:24px;top:258px' }, stamp('动力不足', 'background:#efe4c6')))),
      // 人物
      actor('rel', 40, 472, F_REL.idle), actor('tom', 250, 514, F_TOM.rest), actor('tim', 770, 514, F_TIM.work, true),
      sparks.map(s => ab(422, 552, null, null, s)), zz,
      bubbles.rel, bubbles.tom, bubbles.tim,
      // 顶上：计数器 + 设置
      ab(300, 14, null, null, counter()),
      ab(1206, 14, null, null, h('button', { class: 'pxb sec', style: 'padding:0 2px', title: '设置' }, img(X.gear(6, 8, X.RAMP.brass, 0.1)))),
      // 路标
      ab(PX, 150, null, null, img(post.c)), ab(PX - 4, 116, null, null, img(lamp.c)),
      signs.map(([t, dir, w, go], i) => { const y = 170 + i * 84, x = dir > 0 ? PX + 2 : PX - w * 2 + 18;
        const cv = X.sign(w, dir, go ? { o: '#2a0e06', d: P.fire[0], b: '#7e2a12', l: '#a8421c' } : X.RAMP.wood, 3 + i * 7);
        const lw = t.length * 11 + 14, lab = X.paperLabel(lw, 17, 5 + i);
        return ab(x, y, w * 2, 52, h('div', { class: 'hot', style: 'position:relative;width:100%;height:100%' }, img(cv),
          h('div', { style: `position:absolute;top:9px;${dir > 0 ? 'left:26px' : 'right:26px'};width:${lw * 2}px;height:34px` }, img(lab, 2, 'position:absolute;left:0;top:0'),
            h('span', { style: `position:absolute;inset:0;display:grid;place-items:center;font:900 19px "Microsoft YaHei",sans-serif;letter-spacing:.12em;color:${go ? X.PEN : '#2a1a05'}` }, t)))); }),
    );
    const LINES = [
      ['rel', '想当年在孟买，我们的蒸汽车能拖动一整个炮兵连！', 'talk'], ['tom', '你那台车？早锈成门把手了。', 'talk'], ['tim', '师傅！锅炉又在漏气！', 'yelp'], ['tom', '拿扳手拧紧，别拿脑袋顶着。', 'talk'],
      ['rel', '……', 'sleep'], ['rel', '谁？！谁在开炮？！', 'jolt'], ['tom', '后巷那寡妇专砸车顶。顶上<b>压块甲</b>再去。', 'talk'], ['tim', '我在锅炉上画了个笑脸！', 'talk'],
    ];
    const NAME = { rel: '远房亲戚', tom: '铁匠 老汤姆', tim: '学徒 小提米' };
    const TIP = { tom: `下一场是<b>${foe.name}</b>。你的锅炉<b>顶不住</b>（${F.demand}/${F.supply}），先添一台小锅炉。`, rel: '赛程在墙上那张报纸里，打过的我给你划掉了！', tim: '要改装就点车！' };
    let i = 0, t0 = 0, cur = null, forced = null, tick = 0, mounted = false;
    const say = (key, html) => { for (const k in bubbles) bubbles[k].classList.remove('on'); if (!key) return; bubbles[key].set(NAME[key], html); bubbles[key].classList.add('on'); };
    const burst = () => sparks.forEach((s, k) => { const a = -Math.PI * (0.15 + 0.7 * k / 5), r = 10 + (k % 3) * 8; let f = 0; s.style.opacity = '1'; const iv = setInterval(() => { f++; const q = f / 4; s.style.transform = `translate(${Math.round(Math.cos(a) * r * q / 2) * 2}px,${Math.round((Math.sin(a) * r * q + q * q * 6) / 2) * 2}px)`; if (f >= 4) { s.style.opacity = '0'; clearInterval(iv); } }, 70); });
    const step = () => {
      if (root.isConnected) mounted = true; else if (mounted) { clearInterval(homeTimer); homeTimer = null; return; }
      tick++;
      if (!cur || tick - t0 > 32) { if (forced) { cur = forced; forced = null; } else { cur = LINES[i % LINES.length]; i++; } t0 = tick; say(cur[0], cur[1]); }
      const [spk, , act] = cur;
      if (spk === 'tom') who.tom.set(F_TOM.talk); else { const ph = tick % 8; who.tom.set(ph < 3 ? F_TOM.up : ph < 5 ? F_TOM.hit : (tick % 40 === 7 ? F_TOM.blink : F_TOM.rest)); if (ph === 3) burst(); }
      who.rel.set(spk === 'rel' ? F_REL[act] || F_REL.talk : (tick % 30 === 5 ? F_REL.blink : F_REL.idle)); zz.style.opacity = spk === 'rel' && act === 'sleep' ? '1' : '0';
      who.rel.box.style.translate = spk === 'rel' && act === 'jolt' ? '0 -8px' : '0 0';
      who.tim.set(spk === 'tim' ? F_TIM[act] || F_TIM.talk : (tick % 6 < 3 ? F_TIM.work : F_TIM.rest));
      who.tim.box.style.translate = spk === 'tim' && act === 'yelp' ? '0 -6px' : '0 0';
    };
    for (const k of ['tom', 'rel', 'tim']) who[k].box.addEventListener('click', () => { forced = [k, TIP[k], 'talk']; cur = null; });
    if (homeTimer) clearInterval(homeTimer);
    homeTimer = setInterval(step, 100); step();
    return root;
  }

  // ---------- 改装台：桌上三叠纸 + 中间铁图板夹着蓝图 ----------
  function garage() {
    const cv = U.carGrid('me', 12, 9), F = U.facts(), g6 = U.gauges('me');
    const bx = 346, by = 122;   // 车（2 倍）左上角
    const bo = U.layout('me').find(b => b.id === 'boiler'), cp = 48;
    const r = { x: bx + (bo.c0 - cv._c0) * cp, y: by + (bo.r0 - cv._r0) * cp, w: (bo.c1 - bo.c0 + 1) * cp, h: (bo.r1 - bo.r0 + 1) * cp };
    // 蓝图纸：方格和车的子格对齐（24 像素一大格，6 像素一小格）
    const BW = 288 + 16, BH = 216 + 36, bp = X.C(BW, BH), B = X.RAMP.blue;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const gx = x - 8, gy = y - 22; let col = B.b; if (gx >= 0 && gy >= 0 && gx <= 288 && gy <= 216) { if (gx % 24 === 0 || gy % 24 === 0) col = B.G; else if (gx % 6 === 0 && gy % 6 === 0) col = B.g; } k0(x, y, col); }
    function k0(x, y, col) { bp.p(x, y, col); }
    bp.r(0, 0, BW, 1, B.o); bp.r(0, BH - 1, BW, 1, B.o); bp.r(0, 0, 1, BH, B.o); bp.r(BW - 1, 0, 1, BH, B.o); bp.r(2, 2, BW - 4, 1, B.G); bp.r(2, BH - 3, BW - 4, 1, B.G); bp.r(2, 2, 1, BH - 4, B.G); bp.r(BW - 3, 2, 1, BH - 4, B.G);
    const row = ([id, mt, n, price], hov) => h('div', { style: `display:grid;grid-template-columns:48px 1fr auto;gap:8px;align-items:center;padding:4px 2px;border-bottom:2px solid #cdb887;${hov ? 'background:#cdb887' : ''}` },
      h('div', { style: 'display:grid;place-items:center;height:44px' }, (() => { const c = U.show(U.mod(id, mt), 1); c.style.maxHeight = '42px'; c.style.maxWidth = '46px'; c.style.width = 'auto'; c.style.height = 'auto'; return c; })()),
      h('div', { style: 'font:bold 14px SimSun,serif' }, M[id].name, h('div', { class: 'small dim', style: 'font-weight:normal' }, `${SA.fp(id).w}×${SA.fp(id).h} 格`)),
      n ? stamp(num(`×${n}`, X.RED)) : tag(num(money(price))));
    return U.screen('v3',
      h('div', { class: 'ab', style: 'inset:0;background:var(--px-desk) 0 0/256px 64px' }),
      // 顶：铭牌 + 换层 + 撤销 + 蓝图柜 + 钱
      ab(18, 14, null, null, h('div', { style: 'display:flex;gap:12px;align-items:center' }, btn('← 院子', { sm: true }))),
      ab(346, 14, 600, null, h('div', { style: 'display:flex;gap:12px;align-items:center' }, plate('一号原型机'), toggle('主体', '侧挂'), btn('撤销', { sm: true }), btn('重做', { sm: true }), btn('蓝图柜', { sm: true }))),
      ab(958, 12, null, null, counter()),
      // 中：铁图板 + 蓝图 + 车
      ab(bx - 32, by - 64, BW * 2 + 32, BH * 2 + 38, sk('iron', '', 'width:100%;height:100%', 'drop')),
      ab(bx - 16, by - 44, null, null, img(bp.c)),
      ab(bx, by, null, null, U.show(cv, 2)),
      ab(bx + 90, by - 34, null, null, h('span', { style: 'font:bold 14px SimSun,serif;color:#dcecfb' }, `一号原型机 · 侧视 · 评分 ${F.rating}`)),
      // 选中的锅炉：黄铜角框 + 问题小红章
      ab(r.x - 4, r.y - 4, r.w + 8, r.h + 8, h('div', { style: 'position:relative;width:100%;height:100%' }, brackets(r.w + 8, r.h + 8))),
      ab(r.x - 26, r.y - 14, null, null, img((() => { const k = X.C(11, 11); X.box(k, 0, 0, 11, 11, X.RAMP.fire); k.r(5, 3, 1, 4, '#fff4e0'); k.r(5, 8, 1, 1, '#fff4e0'); return k.c; })())),
      // 工单：搭在图板下沿
      ab(bx - 20, by + BH * 2 - 18, 360, null, h('div', { style: 'display:flex;align-items:stretch' }, img(X.tagHead(), 2, 'height:auto;align-self:flex-start;margin-top:8px'), sk('kraft', [
        h('div', { style: 'display:flex;gap:8px;align-items:center;font:bold 14px SimSun,serif' }, '工单 · 燃煤锅炉', matTag(1)),
        h('div', { class: 'small', style: 'margin:2px 0 6px' }, `耐久 ${M.boiler.hp}/${M.boiler.hp} · 供给 ${M.boiler.supply} · ${SA.tons ? SA.tons(M.boiler.kg) : ''}`),
        h('div', { style: 'display:flex;gap:8px' }, btn('升熟铁 £78', { kind: 'pri', sm: true }), btn('加甲 £18', { sm: true }), btn('拆下', { kind: 'dng', sm: true }))], 'padding:0 6px;margin-left:-2px', 'drop'))),
      // 左：夹板上的性能单
      ab(16, 70, 296, null, h('div', { style: 'position:relative' }, sk('iron', sk('paper', [
        h('div', { class: 'h2', style: 'text-align:center;border-bottom:2px solid #2a1a05;margin-bottom:6px' }, '性能单'),
        h('div', { style: 'display:grid;gap:6px' }, g6.map(g => meter(g, { w: 44 }))),
        h('div', { class: 'small dim', style: 'margin-top:4px' }, '棋盘点 = 悬停的「竖式锅炉」装上以后'),
        h('div', { style: 'border-top:2px solid #b8391b;margin-top:8px;padding-top:4px;display:flex;align-items:center;justify-content:space-between' }, h('b', { class: 'red' }, `动力不足 ${F.demand} > ${F.supply}`), btn('找到它', { sm: true }))], 'padding:4px 6px'), 'padding:14px 2px 0', 'drop'),
        img(X.bigClip(34), 2, 'position:absolute;left:114px;top:-6px'))),
      // 右：邮购目录 + 纸页签
      ab(1226, 88, 46, null, h('div', { style: 'display:grid;gap:6px' }, U.CATS.map(k => sk('paper', h('div', { style: `writing-mode:vertical-rl;font:bold 14px SimSun,serif;letter-spacing:.3em;display:flex;align-items:center;gap:4px;${k === 'energy' ? 'color:#b8391b' : ''}` }, h('i', { style: `width:8px;height:8px;background:${SA.CAT[k].plate}` }), SA.CAT[k].name), `padding:2px 0;${k === 'energy' ? 'margin-left:-8px' : ''}`)))),
      ab(962, 74, 264, null, sk('paper', [
        h('div', { style: 'display:flex;align-items:baseline;gap:8px' }, h('span', { class: 'h2', style: 'white-space:nowrap' }, '能源'), h('span', { class: 'small dim', style: 'white-space:nowrap' }, '邮购目录')),
        h('div', { style: 'display:flex;justify-content:flex-end;border-bottom:2px solid #2a1a05;padding-bottom:4px' }, toggle('有货', '全部', true)),
        U.catItems('energy').map(x => row(x, x[0] === 'boiler_s'))], 'padding:2px 6px', 'drop')),
      // 悬停提示：指着目录里的竖式锅炉
      ab(760, 356, 190, null, card([h('b', {}, '竖式锅炉'), ' ', num('×1', X.RED), h('div', { class: 'small' }, `小锅炉，提供 ${M.boiler_s.supply} 点动力`), h('div', { class: 'small' }, h('b', { style: 'color:#3f8f48' }, `供给 ${F.supply}→${F.supply + M.boiler_s.supply}`), ' ', h('b', { class: 'red' }, `重 +${SA.tons ? SA.tons(M.boiler_s.kg) : ''}`))])),
      // 右下：拉杆
      ab(1070, 520, null, null, leverEl('出战')),
    );
  }

  // ---------- 出战：黑板 + 海报 + 档案 + 下注单 ----------
  function arena() {
    const F = U.facts(), foe = D.stages[2], sf = U.stats('foe');
    // 海报（整张像素纸：毛边、右下撕掉一角、双线框、四角菱形、底部红飘带）
    const PW = 280, PH = 336, pk = X.C(PW, PH), PR = { o: '#4a3a28', b: '#d8c396', a: '#bea477', s: '#c7ae80', l: '#e8dab4' };
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const torn = x + y > PW + PH - 34 + Math.round(X.hash(x, y, 51) * 3) - (x % 5 === 0 ? 1 : 0);
      if (torn) continue;
      const e = Math.min(x, y, PW - 1 - x, PH - 1 - y); let col = X.hash(x, y, 53) < 0.03 ? PR.s : PR.b;
      if (e < 6 && X.bay(x, y) > e / 6) col = PR.a; if (e === 0 || x + y >= PW + PH - 35) col = PR.o;
      pk.p(x, y, col);
    }
    const INKc = '#2a1a05';
    for (const i of [8, 10]) { pk.r(i, i, PW - 2 * i, 1, INKc); pk.r(i, PH - 1 - i, PW - 2 * i - 26, 1, INKc); pk.r(i, i, 1, PH - 2 * i, INKc); pk.r(PW - 1 - i, i, 1, PH - 2 * i - 26, INKc); }
    for (const [x, y] of [[14, 14], [PW - 17, 14], [14, PH - 17]]) { pk.p(x + 1, y, INKc); pk.r(x, y + 1, 3, 1, INKc); pk.p(x + 1, y + 2, INKc); }
    pk.r(24, 303, PW - 48, 1, INKc); pk.r(24, 305, PW - 48, 1, INKc);
    const oval = (name) => { const k = X.C(64, 76), E = X.ellipse(64, 76, INKc, 0), E2 = X.ellipse(58, 70, INKc, 0);
      for (let y = 0; y < 76; y++) for (let x = 0; x < 64; x++) { const dx = (x + 0.5 - 32) / 29, dy = (y + 0.5 - 38) / 35; if (dx * dx + dy * dy < 1) k.p(x, y, dx * dx + dy * dy > 0.8 ? '#cdb887' : '#e2d2a8'); }
      k.g.drawImage(E, 0, 0); k.g.drawImage(E2, 3, 3);
      return h('div', { style: 'position:relative;width:128px;height:152px' }, img(k.c), h('div', { style: 'position:absolute;left:8px;top:20px' }, U.show(U.coal(name, { size: 'scene' }), 2))); };
    // 黑板上的粉笔画：场地剖面（货箱挡直射、高抛越过）
    const sketch = X.C(120, 40); { const k = sketch, c = X.CHALK; X.line(k, 0, 36, 119, 36, c, 0.12); for (const [x, y, w, hh] of [[50, 24, 12, 12], [66, 28, 11, 8]]) { X.line(k, x, y, x + w, y, c, .1); X.line(k, x, y, x, y + hh, c, .1); X.line(k, x + w, y, x + w, y + hh, c, .1); } X.line(k, 50, 24, 62, 36, c, .3);
      for (const [x, w] of [[4, 14], [100, 16]]) { X.line(k, x, 30, x + w, 30, c, .1); X.line(k, x, 30, x, 36, c); X.line(k, x + w, 30, x + w, 36, c); }
      for (let x = 18; x < 48; x += 3) k.p(x, 32, P.fire[2]); k.p(46, 31, P.fire[2]); k.p(46, 33, P.fire[2]);
      for (let t = 0; t <= 1; t += 0.03) { const x = 100 - t * 80, y = 28 - Math.sin(t * Math.PI) * 26; if ((t * 33 | 0) % 2 === 0) k.p(Math.round(x), Math.round(y), P.fire[3]); } }
    const stages = D.stages.map(s => {
      const w = s.name.length * 18 + 8;
      return h('div', { style: 'display:flex;align-items:center;gap:10px;padding:4px 0' }, h('span', { style: 'width:18px' }, s.done ? '✓' : ''),
        h('span', { style: 'position:relative;display:inline-block' }, s.name,
          s.done ? img(X.chalkLine(Math.round(w / 2)), 2, 'position:absolute;left:-4px;top:11px') : null,
          s.next ? img(X.ellipse(Math.round(w / 2) + 10, 17, P.fire[3], 0.06), 2, 'position:absolute;left:-14px;top:-4px') : null),
        h('span', { style: 'margin-left:auto;font-size:14px;opacity:.7' }, s.boss ? '今晚 · Boss' : s.pilot.split(' ').pop()));
    });
    // 下注单的孔线
    const perf = X.C(2, 76); for (let y = 0; y < 76; y += 4) perf.r(0, y, 2, 2, '#2e3a26');
    return U.screen('v3',
      h('div', { class: 'ab', style: 'inset:0;background:var(--px-brick) 0 0/64px 32px' }),
      h('div', { class: 'ab', style: 'left:0;right:0;bottom:0;height:34px;background:var(--px-desk) 0 0/256px 64px;border-top:4px solid #120a05' }),
      // 左：黑板
      ab(18, 30, 316, 540, sk('board', h('div', { class: 'chalk', style: 'padding:2px 8px' },
        h('div', { style: 'display:flex;gap:18px;font-size:16px;margin-bottom:10px' }, h('span', { style: 'border-bottom:2px solid #e8e3d2' }, '战役'), h('span', { style: 'opacity:.55' }, '街头赛')),
        h('div', { style: 'font-size:22px;border-bottom:2px solid rgba(232,227,210,.45);padding-bottom:2px;margin-bottom:6px' }, D.chapter),
        stages,
        h('div', { style: 'margin-top:16px;opacity:.4;font-size:16px' }, '下一章：码头区'),
        h('div', { style: 'margin-top:26px;font-size:18px;border-bottom:2px solid rgba(232,227,210,.45);padding-bottom:2px' }, '场地：货箱'),
        img(sketch.c, 2, 'margin-top:8px'),
        h('div', { style: 'font-size:15px;margin-top:4px' }, h('span', { style: `color:${P.fire[2]}` }, '直射被挡'), '　', h('span', { style: `color:${P.fire[3]}` }, '高抛能过'))), 'height:100%', 'drop')),
      ab(18, 592, null, null, btn('← 回车间对症改装', { sm: true })),
      // 中：海报
      ab(356, 14, null, null, img(pk.c, 2, 'filter:drop-shadow(4px 4px 0 rgba(7,8,12,.55))')),
      ab(376, 44, 520, null, h('div', { style: 'text-align:center' },
        h('div', { class: 'red', style: 'font:bold 14px SimSun,serif;letter-spacing:.3em' }, `${D.place} · 第一章压轴`),
        h('div', { style: `font:900 84px/1.1 "Microsoft YaHei",sans-serif;letter-spacing:.2em;margin-left:.2em;color:${P.fire[1]};text-shadow:4px 4px 0 #2a1a05` }, '大对决'))),
      ab(398, 208, 200, null, h('div', { style: 'display:grid;justify-items:center;gap:4px' }, oval('你'), h('div', { class: 'h2' }, '铁匠铺新人'), h('div', { style: 'display:flex;gap:6px;align-items:center' }, h('span', { class: 'small' }, '评分'), num(F.rating)))),
      ab(676, 208, 200, null, h('div', { style: 'display:grid;justify-items:center;gap:4px' }, oval(foe.pilot), h('div', { class: 'h2' }, '玛莎·布莱克'), h('div', { style: 'display:flex;gap:6px;align-items:center' }, h('span', { class: 'small' }, '评分'), num(F.foeRating)))),
      ab(596, 256, 84, 76, h('div', { style: 'position:relative;width:100%;height:100%;display:grid;place-items:center' }, h('span', { style: 'font:900 42px "Microsoft YaHei",sans-serif;color:#2a1a05' }, '对'), img(X.penLoop(42, 38, X.PEN, 7), 2, 'position:absolute;left:0;top:0'))),
      ab(420, 616 - U.car('me').height, null, null, U.show(U.engrave(U.car('me'), [42, 26, 5], [184, 57, 27]), 1)),
      ab(700, 616 - U.car('foe').height, null, null, (() => { const c = U.show(U.engrave(U.car('foe'), [42, 26, 5], [184, 57, 27]), 1); c.style.transform = 'scaleX(-1)'; return c; })()),
      ab(396, 624, 480, 30, h('div', { style: 'height:100%;display:flex;align-items:center;justify-content:center;gap:10px;color:#2a1a05;font:bold 16px SimSun,serif;letter-spacing:.1em' }, '奖金', underline(num(money(foe.prize)), 30, 4), '· 声望 +1 · 缴获一件')),
      // 右上：对手档案
      ab(940, 22, 320, 262, sk('kraft', '', 'width:100%;height:100%', 'drop')),
      ab(952, 34, 296, null, sk('paper', [
        h('div', { style: 'display:flex;align-items:center;gap:8px;border-bottom:2px solid #2a1a05;padding-bottom:2px;margin-bottom:6px' }, h('span', { class: 'h2' }, '对手档案'), h('span', { style: 'margin-left:auto' }), underline(hand('Boss！', 20), 26, 6)),
        h('div', { style: 'display:grid;grid-template-columns:1fr 92px;gap:10px' },
          h('div', { style: 'display:grid;gap:4px' },
            h('div', {}, h('span', { class: 'dim' }, '车手　'), foe.pilot), h('div', {}, h('span', { class: 'dim' }, '座驾　'), '四足 · 臼炮'),
            h('div', { style: 'display:flex;gap:6px;align-items:center' }, h('span', { class: 'dim' }, '评分　'), num(F.foeRating), h('span', { class: 'small dim' }, '你'), num(F.rating)),
            h('div', {}, h('span', { class: 'dim' }, '速度　'), '比你快一倍'),
            h('div', { style: 'justify-self:start' }, h('span', { class: 'dim' }, '弱点　'), loop(h('b', {}, '锅炉在车尾'), 50, 19, 11))),
          h('div', { style: 'position:relative;justify-self:end' }, sk('paper', U.show(U.coal(foe.pilot, { size: 'sprite' }), 2), 'padding:0'), img(X.clip(), 2, 'position:absolute;left:36px;top:-14px'))),
        h('div', { style: 'position:relative;border-top:2px dashed #b59c6c;margin-top:8px;padding-top:4px' }, hand('线人：专砸车顶——顶上加甲；别追她。', 16, 'white-space:normal'), img(X.penArrow(30, 18, [[16, 14], [19, 3], [6, 3]]), 2, 'position:absolute;left:112px;top:-30px'))], 'padding:2px 6px')),
      // 右下：下注单
      ab(946, 398, 312, null, h('div', { style: 'display:flex;align-items:stretch' },
        sk('green', h('div', { style: 'display:grid;gap:6px;justify-items:center;align-content:center;height:100%' }, [...'0042'].map(ch => num(ch, '#2e3a26'))), 'width:40px'),
        img(perf.c, 2, 'height:auto;margin:6px -2px'),
        sk('green', [
          h('div', { style: 'text-align:center;font:bold 14px SimSun,serif;letter-spacing:.15em;border-bottom:2px solid #2e3a26;padding-bottom:2px' }, '伦敦蒸汽赛会 · 下注凭单'),
          h('div', { style: 'display:flex;align-items:center;gap:6px;margin:6px 0' }, '押 铁匠铺新人 · 赔率', num('2:1')),
          h('div', { style: 'display:flex;gap:22px;align-items:center;font:bold 16px SimSun,serif;margin:8px 0 2px 6px' }, h('span', { class: 'hot' }, '□ 不下'), h('span', { class: 'hot' }, loop(['■ ', num('£50')], 42, 21, 13)), h('span', { class: 'hot' }, '□ ', num('£100'))),
          h('div', { style: 'position:relative;height:40px' }, img(X.penArrow(30, 18, [[4, 1], [6, 14], [26, 14]]), 2, 'position:absolute;left:64px;top:-2px'), h('span', { style: 'position:absolute;left:128px;top:12px' }, hand('能赢 £100！', 17)))], 'flex:1;padding:2px 4px', 'drop'))),
      // 拉杆
      ab(1070, 516, null, null, leverEl('拉闸出战')),
    );
  }

  // ---------- 页面 ----------
  const KEY = 'steam_arena_uilab_v3';
  const st = { sec: 'all', ok: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) Object.assign(st, s); } catch (e) { /* 隐私模式 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const SECS = [['lang', '设计语言 + 小组件', lang, '全部是像素图：2 倍、四阶色、左上光；黄铜 + 齿轮 = 能动手'], ['home', '主页面', home, '人物会自己聊天、打铁、拧扳手；点人物听跟你有关的话；黄铜角框 = 能点'], ['garage', '改装台', garage, '中间铁图板夹着蓝图；左边夹板性能单；右边邮购目录 + 纸页签；工单搭在图板下沿'], ['arena', '出战', arena, '黑板上划掉打过的、圈出要打的，画了场地；中间海报；右边档案和下注单；拉杆出战']];
  const okBtn = (k) => h('button', { class: `pick ${st.ok[k] ? 'on' : ''}`, onclick: () => { st.ok[k] = !st.ok[k]; save(); render(); } }, st.ok[k] ? '✔ 这页可以' : '这页可以');
  function render() {
    document.getElementById('ctl').replaceChildren(h('span', { class: 'k' }, '看'),
      h('div', { class: 'seg' }, [['all', '全部'], ...SECS.map(s => [s[0], s[1]])].map(([k, n]) => h('button', { class: k === st.sec ? 'on' : '', onclick: () => { st.sec = k; save(); render(); } }, n))),
      h('span', { class: 'picks' }, '认可：', h('b', {}, SECS.filter(s => st.ok[s[0]]).map(s => s[1]).join('、') || '—')));
    document.getElementById('out').replaceChildren(...SECS.filter(s => st.sec === 'all' || st.sec === s[0]).map(([k, n, fn, note]) => h('section', { class: 'blk', 'data-k': `v3-${k}` },
      h('div', { class: 'blk-h' }, h('b', {}, n), h('span', { class: 'muted' }, note), okBtn(k)), fn())));
  }
  render();
})();
