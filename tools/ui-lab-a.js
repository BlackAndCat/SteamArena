// 方案 A · 铁匠铺工坊：界面就是老汤姆的铁匠铺——路标导航、压力表属性、零件柜抽屉、黑板赛程、拉闸出战。
(() => {
  const U = SA.UILAB, { h, D, money } = U, M = SA.MODULES;
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const big = (cv, s, extra = '') => { const c = U.show(cv, s); if (extra) c.style.cssText += extra; return c; };

  // ---------- 小件 ----------
  function gauge(g, sz = 92, withNote = true) {
    const hot = g.pct >= 1;
    return h('div', { class: `a-gauge ${hot ? 'hot' : ''}`, style: `--v:${Math.min(1, g.pct).toFixed(3)};--d:${g.delta || 0};--sz:${sz}px` },
      h('div', { class: 'face' }, h('i', { class: 'ghost' }), h('i', { class: 'needle' }), h('i', { class: 'cap' }), h('span', { class: 'val' }, g.val),
        g.delta ? h('span', { class: `dl ${g.delta < 0 ? 'dn' : ''}` }, g.delta > 0 ? '▲' : '▼') : null),
      h('span', { class: 'a-brass sm' }, g.name),
      withNote ? h('span', { class: 'note' }, g.note) : null);
  }
  function odo(n) {
    const s = String(n).padStart(5, ' ');
    return h('span', { class: 'a-odo' }, h('i', { class: 'u' }, '£'), [...s].map(ch => h('i', {}, ch.trim() || '0')));
  }
  const rep = (n) => h('span', { style: 'color:var(--brass3);font-size:18px;letter-spacing:2px;text-shadow:1px 1px 0 #000' }, '★'.repeat(n), h('span', { style: 'opacity:.25' }, '★'.repeat(Math.max(0, 5 - n))));
  function resBar() {
    return h('div', { class: 'a-plate', style: 'display:flex;align-items:center;gap:16px;padding:8px 18px' },
      odo(D.money), rep(D.rep),
      h('span', { class: 'a-tag', style: 'font-size:12px' }, D.ingots.map(([k, n]) => `${k} ×${n}`).join(' ')));
  }
  const matChip = (mt) => { const m = SA.MATS[mt]; return h('span', { class: 'a-chip', style: `background:${m.chip}` }, h('i', { style: `background:${m.chip}` }), `T${mt} ${m.name}`); };
  function part([id, mt, n, price], sel) {
    return h('div', { class: `a-part ${n ? '' : 'none'} ${sel ? 'sel' : ''}` },
      big(U.mod(id, mt), 1.5, 'max-width:100%'),
      h('span', { class: 'nm' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name),
      n ? h('span', { class: 'a-tag' }, `×${n}`) : h('span', { class: 'a-tag red' }, money(price)));
  }
  function lever(label, sub) {
    return h('div', { class: 'a-lever' }, h('div', { class: 'slot' }, h('i', { class: 'arm' }, h('i', { class: 'knob' }))), h('div', { class: 'lbl' }, label, h('small', {}, sub)));
  }
  function chalkFixtures(compact) {
    return h('div', { class: 'a-chalk' },
      h('div', { class: 't' }, D.chapter),
      D.stages.map((s, i) => h('div', { class: `ln ${s.next ? 'cur' : ''}` }, h('span', { class: 'ck' }, s.done ? '✓' : s.next ? '▶' : '·'),
        s.done ? h('s', {}, s.name) : s.next ? h('span', { class: 'circ' }, s.name) : s.name,
        h('span', { style: 'font-size:13px;opacity:.7;margin-left:auto' }, s.boss ? 'Boss' : s.pilot.split(' ').pop()))),
      compact ? null : [h('div', { class: 't', style: 'margin-top:12px;font-size:15px' }, '往后'),
        D.chapters.slice(2).map(c => h('div', { class: 'ln lock' }, h('span', { class: 'ck' }, '?'), c))]);
  }
  // 画布里的真实车：forge 场景 2 倍放大当底
  function sceneBg(id, left, top, dim = 0) {
    const c = U.scene(id, 1280, 720, 0, 0);
    const el = U.show(c, 2); el.style.cssText += `position:absolute;left:${left}px;top:${top}px;${dim ? `filter:brightness(${1 - dim})` : ''}`;
    return el;
  }

  // ---------- 设计语言 ----------
  function lang() {
    const sw = (c, n) => h('div', { style: 'display:grid;gap:4px;justify-items:center;font-size:11px' }, h('i', { style: `width:54px;height:40px;background:${c};border:2px solid #000` }), n);
    return h('div', { class: 'pa sheet' },
      h('div', { class: 'row' },
        h('div', { style: 'flex:1;min-width:300px' },
          h('div', { class: 'h', style: 'font-size:34px' }, '铁匠铺工坊'),
          h('p', { style: 'line-height:1.7;max-width:560px' }, '界面就是这个世界里的东西：老汤姆铁匠铺的院子和车间。导航是院子里的木路标，属性是锅炉上的压力表，零件放在铁皮零件柜的抽屉里，赛程写在黑板上，出战要拉闸。颜色取自炉火、木头、铸铁和黄铜；只有炉火橙是「要你去做」的颜色。')),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [['#140e0b', '煤烟底'], ['#5a3920', '木'], ['#4a4d57', '铸铁'], ['#d9a441', '黄铜'], ['#ef7a21', '炉火·主操作'], ['#1b2420', '黑板'], ['#dcc9a0', '纸签'], ['#c8412c', '红漆·警告']].map(([c, n]) => sw(c, n)))),
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'h', style: 'font-size:28px' }, '标题 · 宋体粗'), h('div', { style: 'font:22px var(--hand);margin-top:6px' }, '黑板 · 楷体（粉笔字）'), h('div', { style: 'margin-top:6px' }, '正文 · 微软雅黑 14px；数字用等宽')),
        h('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' },
          h('button', { class: 'a-btn' }, '黄铜按钮 · 主'), h('button', { class: 'a-btn iron' }, '铁按钮 · 次'), h('button', { class: 'a-btn red' }, '红漆 · 拆除'), h('button', { class: 'a-btn off' }, '不可用'), h('button', { class: 'a-btn press' }, '按下'))),
      h('div', { class: 'row' },
        h('div', { class: 'a-plate', style: 'width:220px' }, h('span', { class: 'a-brass' }, '铆钉铁板'), h('p', { style: 'margin:10px 0 0;font-size:13px' }, '主要面板：四角铆钉、左上受光。')),
        h('div', { class: 'a-chalk', style: 'width:230px' }, h('div', { class: 't' }, '黑板'), h('div', { class: 'ln' }, '赛程、提示、教学')),
        h('div', { style: 'display:grid;gap:10px' }, h('span', { class: 'a-tag' }, '纸吊牌 · 件数 ×4'), h('span', { class: 'a-tag red' }, '红吊牌 · £120 要买'), h('span', { class: 'a-brass' }, '黄铜铭牌')),
        h('div', { style: 'display:grid;gap:10px' }, h('div', { class: 'a-sign r go' }, '出战', h('small', {}, '路标 · 主导航')), h('div', { class: 'a-sign l' }, '车间', h('small', {}, '木牌 · 次导航')))),
      h('div', { class: 'row', style: 'align-items:flex-end' },
        U.gauges('me').slice(0, 4).map(g => gauge(g)),
        h('div', { style: 'max-width:260px;font-size:13px;line-height:1.6' }, '属性都是压力表：指针 = 现在的值，', h('b', { style: 'color:var(--glow)' }, '橙色影子针'), ' = 拿起零件后会变成多少；指到红区表盘发烫。'),
        lever('出战', '拉闸 · 主操作'),
        h('div', { class: 'a-say', style: 'width:260px;margin-top:16px' }, h('span', { class: 'a-brass sm who' }, '老汤姆'), '说话都用碳球头像 + 纸气泡，关键词', h('b', {}, '标红'), '。')));
  }

  // ---------- 主页面：铁匠铺院子 ----------
  function home() {
    const sayTom = h('div', { class: 'a-say', style: '--tail:64px' }, h('span', { class: 'a-brass sm who' }, '铁匠 老汤姆'),
      '下一场是后巷的', h('b', {}, '煤灰寡妇'), '，她的高抛炮专砸车顶。', h('br'), '你的锅炉', h('b', {}, '顶不住动力'), '了——再添一台小锅炉，顶上压块甲再去。',
      h('div', { style: 'display:flex;gap:10px;margin-top:10px' }, h('button', { class: 'a-btn sm' }, '去改装台'), h('button', { class: 'a-btn iron sm' }, '直接出战')));
    return U.screen('pa',
      sceneBg('forge', -330, -690),
      h('div', { class: 'ab', style: 'inset:0;background:linear-gradient(180deg,rgba(20,14,11,.55),transparent 22%,transparent 70%,rgba(20,14,11,.7))' }),
      // 顶栏：徽标 + 资源 + 小按钮
      ab(18, 14, null, null, h('div', { style: 'display:flex;gap:14px;align-items:center' }, h('span', { class: 'a-brass', style: 'font-size:18px' }, '蒸汽竞技场'), resBar())),
      ab(1016, 18, null, null, h('div', { style: 'display:flex;gap:10px' }, h('button', { class: 'a-btn iron sm' }, '蓝图柜'), h('button', { class: 'a-btn iron sm' }, '⚙ 设置'))),
      // 黑板
      ab(24, 118, 250, null, chalkFixtures(false)),
      // 车 + 老汤姆（站在车右边，看着车）
      ab(330, 302, null, null, h('div', { style: 'position:relative;padding:12px;border:3px dashed rgba(255,209,102,.75)' },
        big(U.car('me'), 1.5),
        h('span', { class: 'a-tag', style: 'position:absolute;left:36px;top:-18px' }, '点车 · 进改装台'),
        h('span', { class: 'a-tag red', style: 'position:absolute;left:-12px;bottom:-16px;font-size:12px' }, '⚠ 动力不足'))),
      ab(632, 514, null, null, big(U.coal('铁匠 老汤姆', { size: 'scene', pose: 'point', look: -1 }), 2)),
      ab(596, 318, 300, null, sayTom),
      // 路标
      ab(1128, 150, 16, 570, h('div', { style: 'width:100%;height:100%;background:linear-gradient(90deg,#2a180c,#6a4424 45%,#2a180c);border:2px solid #120a05' })),
      ab(1112, 96, 48, 54, h('div', { style: 'width:100%;height:100%;background:radial-gradient(circle at 50% 55%,#ffe7a0,#ef7a21 45%,rgba(239,122,33,0) 70%);border:3px solid #1a1a1a;border-radius:8px 8px 4px 4px;box-shadow:0 0 40px 18px rgba(239,122,33,.35)' })),
      ab(960, 176, 300, null, h('div', { class: 'a-sign r go', style: 'font-size:26px' }, '出战', h('small', {}, `竞技场 · ${D.stages[2].name}【Boss】`))),
      ab(900, 268, 260, null, h('div', { class: 'a-sign l' }, '车间', h('small', {}, '改装 · 订货'))),
      ab(1000, 346, 250, null, h('div', { class: 'a-sign r' }, '银行', h('small', {}, '伦敦蒸汽银行 · 借款 / 还款'))),
      ab(930, 424, 230, null, h('div', { class: 'a-sign l' }, '街头赛', h('small', {}, '后巷赛 · 集市赛'))),
      ab(1000, 502, 250, null, h('div', { class: 'a-sign r', style: 'filter:grayscale(.8) brightness(.6)' }, '锦标赛', h('small', {}, '🔒 第五章以后开放'))),
    );
  }

  // ---------- 改装台：车间里的升降台 ----------
  function garage() {
    const S2 = 2, cv = U.carGrid('me', 12, 9), cp = U.CELLPX * S2;
    const gx = 300, gy = 96, gw = cv.width * S2, gh = (cv.height - 14) * S2;
    const bx = U.cellBox('me', 'boiler') || { c0: 6, r0: 8, c1: 7, r1: 9 };
    const sx = gx + (bx.c0 - cv._c0) * cp, sy = gy + (bx.r0 - cv._r0) * cp, sw = (bx.c1 - bx.c0 + 1) * cp, sh = (bx.r1 - bx.r0 + 1) * cp;
    const g6 = U.gauges('me'), F = U.facts();
    const inv = U.catItems('energy');
    const drawers = U.CATS.map(k => h('div', { class: `a-drawer ${k === 'energy' ? 'on' : ''}` }, h('i', { class: 'strip', style: `background:${SA.CAT[k].plate}` }), h('span', { class: 'lb' }, SA.CAT[k].name), h('span', { class: 'pull' }),
      h('span', { class: 'n' }, D.inv.filter(([id, , n]) => M[id].cat === k && n).length || '')));
    return U.screen('pa a-brick',
      // 地板
      h('div', { class: 'ab', style: 'left:0;right:0;bottom:0;height:118px;background:repeating-linear-gradient(90deg,#3a2415 0 94px,#22150c 94px 96px),linear-gradient(#4a2e1a,#2a180c);border-top:4px solid #120a05' }),
      // 顶梁
      ab(0, 0, 1280, 62, h('div', { class: 'a-beam', style: 'height:100%;display:flex;align-items:center;gap:14px;padding:0 16px' },
        h('button', { class: 'a-btn iron sm' }, '← 院子'),
        h('span', { class: 'a-brass', style: 'font-size:18px' }, '一号原型机 ✎'),
        h('span', { class: 'a-tag' }, `评分 ${F.rating}`),
        h('div', { style: 'display:flex;align-items:center;gap:6px;margin-left:24px;font-size:12px;color:var(--iron4)' }, '层',
          h('span', { class: 'a-btn sm' }, '主体'), h('span', { class: 'a-btn iron sm' }, '侧挂'), h('span', { style: 'max-width:150px;line-height:1.3' }, '侧挂层：挂在车体外侧的炮和撞击件')),
        h('button', { class: 'a-btn iron sm', style: 'margin-left:auto' }, '↶ 撤销'), h('button', { class: 'a-btn iron sm' }, '↷'), h('button', { class: 'a-btn iron sm' }, '蓝图柜'), odo(D.money))),
      // 左：仪表板
      ab(16, 80, 262, 600, h('div', { class: 'a-plate', style: 'height:100%;display:flex;flex-direction:column;gap:8px' },
        h('span', { class: 'a-brass', style: 'align-self:center' }, '车况仪表'),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px 6px;justify-items:center;margin-top:8px' }, g6.map(g => gauge(g, 70))),
        h('div', { style: 'margin-top:auto;display:grid;gap:8px' },
          h('span', { class: 'a-tag red', style: 'font-size:13px' }, `⚠ 动力不足：要 ${F.demand}，锅炉只给 ${F.supply}`),
          h('div', { style: 'font-size:12px;color:var(--tag);line-height:1.5' }, '橙色影子针 = 装上手里的「竖式锅炉」以后：动力 6 → 9、重量 +0.4 t'),
          h('button', { class: 'a-btn sm', style: 'justify-self:start' }, '◎ 定位问题')))),
      // 中：升降台 + 粉笔网格
      ab(gx - 12, gy - 12, gw + 24, gh + 24, h('div', { style: 'width:100%;height:100%;border:2px dashed rgba(236,230,212,.35);background:rgba(10,6,4,.35)' })),
      ab(gx, gy, gw, gh, h('div', { style: `width:100%;height:100%;background:linear-gradient(90deg,rgba(236,230,212,.13) 1px,transparent 1px) 0 0/${cp}px ${cp}px,linear-gradient(rgba(236,230,212,.13) 1px,transparent 1px) 0 0/${cp}px ${cp}px` })),
      ab(gx, gy, null, null, big(cv, S2)),
      ab(gx + 40, gy + gh + 8, gw - 80, 22, h('div', { style: 'height:100%;background:linear-gradient(var(--iron3),var(--iron1));border:3px solid var(--iron0)' })),
      ab(gx + 90, gy + gh + 30, 20, 60, h('div', { style: 'height:100%;background:linear-gradient(90deg,#666,#ddd,#666);border:2px solid #111' })),
      ab(gx + gw - 110, gy + gh + 30, 20, 60, h('div', { style: 'height:100%;background:linear-gradient(90deg,#666,#ddd,#666);border:2px solid #111' })),
      // 选中：锅炉 + 工单
      ab(sx - 4, sy - 4, sw + 8, sh + 8, h('div', { style: 'width:100%;height:100%;border:3px dashed var(--glow2);box-shadow:0 0 18px rgba(255,209,102,.5)' })),
      ab(sx + sw / 2 - 1, sy + sh + 4, 3, 548 - sy - sh, h('div', { style: 'height:100%;background:var(--tag)' })),
      ab(sx - 60, 548, 300, null, h('div', { class: 'a-notice', style: 'rotate:-1deg' },
        h('b', {}, '工单 · 燃煤锅炉（黄铜）'),
        h('div', {}, '耐久 120/120 · 动力 +6 · 产热 1.5/秒 · 0.55 t'),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px' }, h('button', { class: 'a-btn sm' }, '升熟铁 £78'), h('button', { class: 'a-btn iron sm' }, '加甲 £18'), h('button', { class: 'a-btn red sm' }, '拆下')))),
      ab(700, 616, 200, null, h('div', { style: 'font:15px/1.5 var(--hand);color:var(--chalk);opacity:.85;text-align:center' }, '从右边抽屉拿零件拖到车上', h('br'), '右键拆下 · Ctrl+Z 撤销')),
      // 右：零件柜
      ab(916, 80, 348, 492, h('div', { class: 'a-plate', style: 'height:100%;display:flex;flex-direction:column;gap:10px' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' }, h('span', { class: 'a-brass' }, '零件柜'),
          h('span', { style: 'font-size:12px' }, h('span', { class: 'a-btn sm' }, '有货'), ' ', h('span', { class: 'a-btn iron sm' }, '全部 · 含订货'))),
        h('div', { class: 'a-drawers' }, drawers),
        h('div', { class: 'a-tray', style: 'flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start;margin-top:6px' },
          inv.slice(0, 9).map((x) => part(x, x[0] === 'boiler_s'))))),
      ab(1034, 590, null, null, lever('出战', '车况有 1 项问题')),
    );
  }

  // ---------- 出战：竞技场门口 ----------
  function arena() {
    const foe = D.stages[2];
    return U.screen('pa',
      (() => { const c = U.show(U.scene('qual', 1280, 720, 300, 0), 1); c.style.cssText += 'position:absolute;left:0;top:0;filter:brightness(.55) saturate(.8)'; return c; })(),
      h('div', { class: 'ab', style: 'inset:0;background:radial-gradient(ellipse at 55% 60%,transparent 30%,rgba(20,14,11,.75) 80%)' }),
      ab(18, 14, null, null, h('div', { style: 'display:flex;gap:14px;align-items:center' }, h('button', { class: 'a-btn iron sm' }, '← 院子'), resBar())),
      ab(420, 70, 500, null, h('div', { style: 'text-align:center' }, h('span', { class: 'a-brass', style: 'font-size:22px' }, `${D.chapter} · 第 3 场`), h('div', { class: 'h', style: 'font-size:44px;margin-top:10px' }, `对阵 ${foe.name}`))),
      ab(24, 130, 270, null, chalkFixtures(false)),
      // 两台车（地面 y = 648）
      ab(360, 360, null, null, big(U.car('me'), 1.5)),
      ab(716, 358, null, null, big(U.car('foe'), 1.5, 'transform:scaleX(-1)')),
      ab(604, 430, null, null, h('div', { class: 'a-medal' }, 'VS')),
      ab(380, 660, null, null, h('span', { class: 'a-brass sm' }, `你 · 一号原型机 · 评分 ${U.facts().rating}`)),
      ab(740, 660, null, null, h('span', { class: 'a-brass sm' }, `${foe.pilot} · 评分 ${U.facts().foeRating}`)),
      ab(470, 196, 400, null, h('div', { style: 'text-align:center' }, h('div', { class: 'a-sign', style: 'display:inline-flex;font-size:15px;padding:6px 14px;cursor:default' }, '场地：货箱', h('small', { style: 'display:inline;margin-left:8px' }, '两只箱子挡直射，高抛不受影响')))),
      // 对手：头像 + 钉住的纸条
      ab(1100, 56, null, null, h('div', { class: 'a-oval', style: 'width:130px;height:156px' }, big(U.coal(foe.pilot), 1.3))),
      ab(1086, 226, 160, null, h('div', { style: 'text-align:center' }, h('span', { class: 'a-brass sm' }, foe.pilot), h('div', { style: 'font-size:12px;margin-top:4px;color:var(--tag)' }, '后巷女王 · Boss'))),
      ab(930, 96, 150, null, h('div', { class: 'a-notice', style: 'rotate:-4deg' }, h('b', {}, '高抛炮'), '专砸车顶 → 顶上加甲')),
      ab(930, 214, 140, null, h('div', { class: 'a-notice', style: 'rotate:2deg' }, h('b', {}, '四足，快'), '比你快一倍：别追，守正面')),
      ab(1040, 296, 200, null, h('div', { class: 'a-notice', style: 'rotate:3deg' }, h('b', {}, '两台锅炉在车尾'), '高抛砸后半截，锅炉一炸就哑')),
      // 奖励 + 下注 + 场地
      ab(24, 548, 300, null, h('div', { class: 'a-plate', style: 'display:grid;gap:8px' },
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('span', { class: 'a-brass sm' }, '奖金'), h('b', { style: 'font-size:20px;color:var(--brass3)' }, money(foe.prize)), h('span', { class: 'a-tag', style: 'font-size:12px' }, '声望 +1 · 缴获 1 件')),
        h('div', { style: 'display:flex;gap:6px;align-items:center;font-size:12px' }, '下注', h('span', { class: 'a-btn iron sm' }, '不下'), h('span', { class: 'a-btn sm' }, '£50'), h('span', { class: 'a-btn iron sm' }, '£100'), h('span', { style: 'color:var(--tag)' }, '赔率 2:1')))),
      ab(1030, 574, null, null, lever('拉闸出战', 'A / D 走 · 鼠标瞄准 · 左键开火')),
      ab(1034, 512, null, null, h('button', { class: 'a-btn iron sm' }, '← 回车间对症改装')),
    );
  }

  // ---------- 小组件 ----------
  function parts() {
    const box = (title, ...kids) => h('div', { style: 'display:grid;gap:10px;align-content:start' }, h('span', { class: 'a-brass sm', style: 'justify-self:start' }, title), ...kids);
    return h('div', { class: 'pa sheet' },
      h('div', { class: 'row' },
        box('资源', resBar(), h('span', { class: 'cap' }, '钱是黄铜里程计，点开 = 银行')),
        box('材料标 T1～T6', h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;max-width:420px' }, [1, 2, 3, 4, 5, 6].map(matChip))),
        box('战斗顶条', h('div', { class: 'a-hud', style: 'width:560px' },
          h('div', { class: 'side' }, [['耐久', '#e4e0d6', 82], ['热量', '#ef7a21', 46], ['水', '#46c2c9', 70]].map(([n, c, v]) => h('div', { class: 'br' }, n, h('div', { class: 'tube' }, h('i', { style: `width:${v}%;background:${c}` }))))),
          h('div', { class: 'clock' }, '87'),
          h('div', { class: 'side r' }, [['耐久', '#e4e0d6', 64], ['热量', '#ef7a21', 30], ['水', '#46c2c9', 88]].map(([n, c, v]) => h('div', { class: 'br' }, h('div', { class: 'tube' }, h('i', { style: `width:${v}%;background:${c}` })), n)))))),
      h('div', { class: 'row' },
        box('零件卡：有货 / 选中 / 要订货', h('div', { class: 'a-tray', style: 'display:flex;gap:10px' }, part(['boiler_s', 1, 1, 90]), part(['armor', 2, 1, 29], true), part(['mortar_s', 1, 0, 140]))),
        box('悬停提示', h('div', { class: 'a-notice', style: 'width:230px' }, h('b', {}, '小臼炮（黄铜）'), '高抛，越过货箱砸顶。', h('br'), '伤害 14 · 装填 3.2 秒 · 0.5 t', h('div', { style: 'margin-top:6px;color:#8a2a14;font-weight:700' }, '装上：火力 ▲ 动力 ▼'))),
        box('提示条', h('div', { class: 'a-toast' }, h('span', { class: 'st' }, '入库'), '缴获 熟铁锅炉，放进零件柜'), h('div', { class: 'a-toast' }, h('span', { class: 'st', style: 'background:#c8412c;border-color:#5a0c06' }, '不行'), '这里悬空：下面要有车体托着'))),
      h('div', { class: 'row' },
        box('确认 / 资金不足', h('div', { class: 'a-dialog' }, h('div', { class: 'hd' }, '钱不够'),
          h('div', { class: 'bd' }, '升级要 £430，你有 £240，还差 ', h('b', { style: 'color:#8a2a14' }, '£190'), '。', h('br'), h('span', { style: 'font-size:13px;opacity:.75' }, '向伦敦蒸汽银行借 £200：每打一场锦标赛加收 10% 利息。')),
          h('div', { class: 'ft' }, h('button', { class: 'a-btn iron sm' }, '算了'), h('button', { class: 'a-btn sm' }, '借 £200 并升级')))),
        box('缴获战利品', h('div', { class: 'a-dialog', style: 'width:470px' }, h('div', { class: 'hd' }, '缴获战利品'),
          h('div', { class: 'bd' }, '按赛会规矩，胜者可以从对手车上拆走一件：',
            h('div', { class: 'a-tray', style: 'display:flex;gap:8px;margin-top:10px' }, part(['mortar_s', 1, 1, 0], true), part(['boiler_s', 2, 1, 0]), part(['armor', 2, 1, 0]))),
          h('div', { class: 'ft' }, h('button', { class: 'a-btn' }, '拿走 小臼炮'))))));
  }

  U.add({ id: 'A', name: '铁匠铺工坊', tag: '实景 · 暖色 · 物件感最强',
    pitch: '界面就是老汤姆的铁匠铺。主页面是铁匠铺的院子（直接用游戏里「铁匠铺后院」的场景），往哪去看木路标；车停在院子里，点车进改装台；老汤姆站在车旁边告诉你下一场该注意什么。改装台是车间里的升降台：左边一排压力表，右边一个铁皮零件柜，抽屉就是类别；出战在竞技场门口，对手的弱点是钉在墙上的纸条，最后拉闸出战。',
    pros: ['世界观最足：铁匠铺、碳球人物、黑板、压力表都是游戏里的东西', '老汤姆带路，新手不用读说明也知道下一步', '「拉闸出战」「抽屉拿零件」这些动作本身就有乐趣'],
    cons: ['画面元素多，实现和维护工作量最大（每块面板都是手工质感）', '仪表盘读数不如条形图精确，高级玩家比较数值要多看一眼', '小屏幕（手机竖屏）放不下这么多实物，要另做简化版'],
    notes: { home: '背景是游戏里的「铁匠铺后院」场景 2 倍放大；路标 = 主导航，出战最亮', garage: '橙色影子针 = 拿起零件后的变化；选中的模块挂一张工单', arena: '对手弱点 = 钉在墙上的纸条；下注 = 黄铜筹码' },
    lang, home, garage, arena, parts });
})();
