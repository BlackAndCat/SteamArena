// 方案 D · 锅炉控制台：现代游戏界面的骨架（底部导航、卡片、分段表、零件格），蒸汽朋克只做点缀；UX 优先，能缩到手机。
(() => {
  const U = SA.UILAB, { h, D, money } = U, M = SA.MODULES;
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const ic = (n, c = '#e0b04a', s = 2) => U.icon(n, c, s);
  const COL = { power: '#ff7a2e', weight: '#c9ced8', speed: '#6fcf6a', heat: '#ff5068', water: '#46c2c9', hp: '#e0b04a' };

  function meter(g, gainSeg = 0) {
    const n = 12, on = Math.round(Math.min(1, g.pct) * n), over = g.pct > 1 || g.pct >= 1 && g.k === 'power';
    const ext = Math.round(Math.abs(g.delta || 0) * n) || (g.delta ? 1 : 0), up = (g.delta || 0) > 0;
    const good = g.k === 'weight' || g.k === 'heat' ? !up : up;
    const segs = [...Array(n)].map((_, i) => {
      let cls = i < on ? 'on' : '';
      if (over && i < on) cls = 'over';
      if (g.delta && up && i >= on && i < on + ext) cls = good ? 'gain' : 'loss';
      if (g.delta && !up && i < on && i >= on - ext) cls += good ? ' gain' : ' loss';
      return h('i', { class: cls });
    });
    return h('div', { class: 'd-meter', style: `--c:${COL[g.k] || '#e0b04a'}` },
      h('div', { class: 'top' }, h('span', {}, g.name), h('span', { class: 'v' }, g.val), g.delta ? h('span', { class: `dl ${good ? '' : 'bad'}` }, up ? '▲' : '▼') : null),
      h('div', { class: 'segs' }, segs), h('span', { class: 'note' }, g.note));
  }
  function pills() {
    return h('div', { style: 'display:flex;gap:8px;align-items:center' },
      h('span', { class: 'd-pill money' }, ic('coin', '#f5d77a'), h('span', { class: 'num' }, money(D.money))),
      h('span', { class: 'd-pill' }, h('span', { style: 'color:#f5d77a' }, '★'), h('span', { class: 'num' }, D.rep)),
      h('span', { class: 'd-pill' }, h('i', { style: 'width:12px;height:12px;background:#b07ae6;display:inline-block' }), h('span', { class: 'num' }, D.ingots[0][1])),
      h('button', { class: 'd-ib' }, ic('gear', '#9aa1ae')));
  }
  function topbar(title, extra) {
    return ab(0, 0, 1280, 56, h('div', { style: 'height:100%;display:flex;align-items:center;gap:14px;padding:0 16px;background:linear-gradient(180deg,#0c0e12,rgba(12,14,18,.6));box-shadow:inset 0 -1px 0 #3a404e' },
      h('b', { style: 'color:var(--brass);letter-spacing:.2em;font-size:15px' }, '蒸汽竞技场'), h('span', { style: 'width:1px;height:22px;background:var(--line)' }),
      h('b', { style: 'font-size:18px;letter-spacing:.1em' }, title), extra || null, h('span', { style: 'margin-left:auto' }), pills()));
  }
  function nav(on) {
    const T = [['home', '主页', 'flag'], ['garage', '车间', 'wrench'], ['arena', '出战', 'swords'], ['bp', '蓝图', 'scroll'], ['bank', '银行', 'coin']];
    return ab(0, 664, 1280, 56, h('div', { class: 'd-nav', style: 'height:100%' }, T.map(([k, n, i]) => h('span', { class: k === on ? 'on' : '' }, ic(i, k === on ? '#f5d77a' : '#6b7280', 2), n, k === 'garage' ? h('span', { class: 'bd' }, '1') : null))));
  }
  function stepper(compact) {
    const S = D.stages;
    const kids = [];
    S.forEach((s, i) => {
      if (i) kids.push(h('i', { class: `ln ${S[i - 1].done && s.done ? 'done' : S[i - 1].done ? 'done' : ''}` }));
      kids.push(h('span', { class: `n ${s.done ? 'done' : s.next ? 'cur' : ''}` }, s.done ? '✓' : s.boss ? '☠' : i + 1, compact ? null : h('small', {}, s.name)));
    });
    return h('div', { class: 'd-step' }, kids);
  }
  function tile([id, mt, n, price], cls = '') {
    return h('div', { class: `d-tile ${n ? '' : 'none'} ${cls}` }, h('i', { class: 'mt', style: `background:${SA.MATS[mt].chip}` }),
      h('div', { class: 'pic' }, U.show(U.mod(id, mt), 1)), h('span', { class: 'nm' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name),
      n ? h('span', { class: 'ct' }, `×${n}`) : h('span', { class: 'pr' }, money(price)));
  }
  const matTag = (mt) => { const m = SA.MATS[mt]; return h('span', { class: 'd-tag', style: `box-shadow:inset 0 0 0 1px ${m.chip};${mt >= 5 ? `background:${m.chip}22;` : ''}` }, h('i', { style: `width:8px;height:8px;background:${m.chip};display:inline-block` }), `T${mt} ${m.name}`, m.rank ? h('b', { style: `color:${m.chip}` }, ` ${m.rank}`) : null); };

  // ---------- 设计语言 ----------
  function lang() {
    const sw = (c, n) => h('div', { style: 'display:grid;gap:4px;justify-items:center;font-size:11px;color:var(--mut)' }, h('i', { style: `width:54px;height:40px;background:${c};box-shadow:inset 0 0 0 1px #3a404e` }), n);
    const g = U.gauges('me');
    const phone = h('div', { style: 'position:relative;width:300px;height:600px;background:var(--bg);box-shadow:0 0 0 8px #000,0 0 0 10px #333;border-radius:26px;overflow:hidden;flex:none' },
      h('div', { style: 'height:44px;display:flex;align-items:center;gap:8px;padding:0 12px;box-shadow:inset 0 -1px 0 var(--line)' }, h('b', { style: 'color:var(--brass);font-size:13px;letter-spacing:.15em' }, '蒸汽竞技场'), h('span', { style: 'margin-left:auto' }), h('span', { class: 'd-pill money', style: 'padding:3px 8px 3px 5px;font-size:12px' }, ic('coin', '#f5d77a', 1.5), h('span', { class: 'num' }, money(D.money)))),
      h('div', { style: 'height:210px;position:relative;overflow:hidden' }, (() => { const c = U.show(U.scene('qual', 1280, 720, 300, 120), 0.5); c.style.cssText += 'position:absolute;left:-100px;top:-60px;filter:brightness(.6)'; return c; })(),
        h('div', { style: 'position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center' }, U.show(U.car('me'), 0.9))),
      h('div', { style: 'padding:10px;display:grid;gap:8px' },
        h('div', { class: 'd-card hi', style: 'padding:10px' }, h('div', { class: 'hd', style: 'margin-bottom:6px' }, h('b', {}, '下一场'), h('span', { class: 'r' }, stepper(true))),
          h('div', { style: 'display:flex;gap:8px;align-items:center' }, U.show(U.coal('玛莎·布莱克', { size: 'portrait' }), 0.5), h('div', {}, h('b', {}, '煤灰寡妇 '), h('span', { class: 'd-tag boss' }, 'BOSS'), h('div', { style: 'font-size:11px;color:var(--mut)' }, '奖金 £220 · 高抛炮砸顶'))),
          h('button', { class: 'd-btn pri', style: 'width:100%;margin-top:8px;font-size:16px' }, '出战')),
        h('div', { class: 'd-card', style: 'padding:8px 10px;font-size:12px;display:flex;align-items:center;gap:8px' }, h('span', { style: 'color:var(--bad);font-weight:900' }, '⚠'), '动力不足', h('button', { class: 'd-btn sm', style: 'margin-left:auto' }, '去修'))),
      h('div', { class: 'd-nav', style: 'position:absolute;left:0;right:0;bottom:0;height:52px' }, [['主页', 'flag', 1], ['车间', 'wrench'], ['出战', 'swords'], ['蓝图', 'scroll'], ['银行', 'coin']].map(([n, i, on]) => h('span', { class: on ? 'on' : '' }, ic(i, on ? '#f5d77a' : '#6b7280', 1.5), n))));
    return h('div', { class: 'pd sheet' },
      h('div', { class: 'row' },
        h('div', { style: 'flex:1;min-width:320px;display:grid;gap:14px;align-content:start' },
          h('div', { style: 'font-size:32px;font-weight:900;letter-spacing:.15em' }, '锅炉控制台'),
          h('p', { style: 'line-height:1.7;max-width:600px;color:var(--mut);margin:0' }, '先把好用做到位，再加蒸汽味：现代手游 / 独立游戏常见的骨架（底部导航、卡片、分段表、零件格），颜色是深铁灰 + 黄铜点缀，只有「炉火橙」是主操作。所有面板切 8px 斜角当作铆接铁板的暗示；像素精灵和碳球人物负责风格。同一套组件能直接缩到手机竖屏（右边）。'),
          h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [['#111318', '底'], ['#1a1d24', '卡片'], ['#2c313c', '按钮'], ['#e0b04a', '黄铜·选中'], ['#ff7a2e', '炉火·主操作'], ['#6fcf6a', '变好'], ['#ff5068', '问题 / 变差'], ['#46c2c9', '水']].map(([c, n]) => sw(c, n))),
          h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, h('button', { class: 'd-btn pri' }, '主操作'), h('button', { class: 'd-btn pri big' }, '出战'), h('button', { class: 'd-btn' }, '次操作'), h('button', { class: 'd-btn ghost' }, '幽灵'), h('button', { class: 'd-btn danger' }, '拆下'), h('button', { class: 'd-btn off' }, '不可用')),
          h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, h('span', { class: 'd-seg' }, h('span', { class: 'on' }, '主体'), h('span', {}, '侧挂')), h('span', { class: 'd-tag bad' }, '威胁'), h('span', { class: 'd-tag ok' }, '弱点'), h('span', { class: 'd-tag boss' }, 'BOSS'), h('span', {}, h('span', { class: 'd-kbd' }, 'A'), h('span', { class: 'd-kbd' }, 'D'), ' 行驶')),
          h('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, ['coin', 'wrench', 'swords', 'scroll', 'flag', 'gear', 'trophy', 'dice', 'eye'].map(n => ic(n, '#e0b04a', 3)), h('span', { style: 'font-size:12px;color:var(--mut)' }, '图标：游戏里现成的 9×9 像素图标')),
          h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,260px));gap:12px 24px' }, g.map(x => meter(x))),
          h('div', { style: 'font-size:12px;color:var(--mut);max-width:560px;line-height:1.6' }, '分段表：实心 = 现在；', h('b', { style: 'color:var(--ok)' }, '绿框'), ' = 装上会变好的部分，', h('b', { style: 'color:var(--bad)' }, '红框'), ' = 会变差；超上限整条变红。')),
        phone));
  }

  // ---------- 主页面 ----------
  function home() {
    const F = U.facts(), foe = D.stages[2];
    const bg = U.show(U.scene('qual', 1280, 720, 380, 60), 1); bg.style.cssText += 'position:absolute;left:0;top:0;filter:brightness(.62) saturate(.85)';
    return U.screen('pd',
      bg,
      h('div', { class: 'ab', style: 'inset:0;background:linear-gradient(90deg,rgba(17,19,24,.1) 0,rgba(17,19,24,.2) 55%,rgba(17,19,24,.92) 66%),linear-gradient(180deg,transparent 60%,rgba(17,19,24,.9))' }),
      topbar('主页'),
      // 车 + 转台
      ab(150, 560, 480, 40, h('div', { style: 'width:100%;height:100%;border-radius:50%;background:radial-gradient(ellipse,rgba(224,176,74,.35),rgba(224,176,74,.05) 60%,transparent 70%)' })),
      ab(240, 190, 300, 380, h('div', { style: 'width:100%;height:100%;background:radial-gradient(ellipse at 50% 100%,rgba(255,230,170,.2),transparent 65%)' })),
      ab(240, 196, null, null, U.show(U.car('me'), 2)),
      ab(250, 596, 300, null, h('div', { style: 'text-align:center' }, h('b', { style: 'font-size:18px;letter-spacing:.1em' }, '一号原型机'), h('div', { style: 'font-size:12px;color:var(--mut)' }, `评分 ${F.rating} · ${SA.tons(U.stats('me').weight)} · ${SA.kmh(U.stats('me').topSpeed)}`))),
      ab(24, 76, null, null, h('div', { class: 'd-say' }, U.show(U.coal('铁匠 老汤姆', { size: 'portrait' }), 0.42), h('span', {}, h('b', {}, '老汤姆：'), '下一场是 Boss，先把', h('b', { style: 'color:var(--fire2)' }, '动力'), '补上再去。'))),
      // 右栏
      ab(856, 76, 400, null, h('div', { class: 'd-card hi' },
        h('div', { class: 'hd' }, h('b', {}, '下一场'), `${D.chapter} · 3/3`, h('span', { class: 'r' })),
        h('div', { style: 'padding:0 14px 26px' }, stepper()),
        h('div', { style: 'display:flex;gap:14px;align-items:center' }, h('div', { style: 'width:84px;height:84px;border-radius:50%;overflow:hidden;background:#2c313c;box-shadow:0 0 0 2px var(--brass);display:grid;place-items:center' }, U.show(U.coal(foe.pilot, { size: 'portrait' }), 0.9)),
          h('div', { style: 'display:grid;gap:5px' }, h('div', {}, h('b', { style: 'font-size:22px' }, '煤灰寡妇 '), h('span', { class: 'd-tag boss' }, 'BOSS')), h('span', { style: 'color:var(--mut);font-size:13px' }, `${foe.pilot} · 场地 货箱 · 评分 ${F.foeRating}`),
            h('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, h('span', { class: 'd-tag bad' }, '高抛炮砸顶'), h('span', { class: 'd-tag bad' }, '比你快'), h('span', { class: 'd-tag ok' }, '锅炉在车尾')))),
        h('div', { style: 'display:flex;gap:8px;margin:12px 0' }, h('span', { class: 'd-pill money' }, ic('coin', '#f5d77a'), h('span', { class: 'num' }, money(220))), h('span', { class: 'd-pill' }, '★ +1'), h('span', { class: 'd-pill' }, '缴获 1 件')),
        h('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:8px' }, h('button', { class: 'd-btn pri big' }, '出战'), h('button', { class: 'd-btn ghost' }, '看对手')))),
      ab(856, 430, 400, null, h('div', { class: 'd-card', style: 'box-shadow:inset 0 0 0 1px rgba(255,80,104,.6)' },
        h('div', { class: 'hd' }, h('b', {}, '车况'), h('span', { class: 'r', style: 'color:var(--bad);font-weight:700' }, '1 个问题')),
        h('div', { style: 'display:flex;align-items:center;gap:10px' }, h('span', { style: 'font-size:22px;color:var(--bad)' }, '⚠'), h('div', { style: 'flex:1' }, h('b', {}, '动力不足'), h('div', { style: 'font-size:12px;color:var(--mut)' }, `要 ${F.demand}，锅炉只给 ${F.supply}：跑不满速、开火更慢`)), h('button', { class: 'd-btn' }, '去修 →')))),
      ab(856, 548, 400, 100, h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;height:100%' },
        [['街头赛', '后巷 · 集市', 'dice', ''], ['锦标赛', '🔒 第五章后', 'trophy', 'off'], ['蓝图库', '官方 4 · 我的 2', 'scroll', '']].map(([n, s, i, off]) => h('div', { class: 'd-card', style: `padding:10px;display:grid;gap:4px;align-content:center;justify-items:center;${off ? 'opacity:.45' : ''}` }, ic(i, '#e0b04a', 3), h('b', {}, n), h('span', { style: 'font-size:11px;color:var(--mut)' }, s))))),
      nav('home'),
    );
  }

  // ---------- 改装台 ----------
  function garage() {
    const S2 = 2, cv = U.carGrid('me', 12, 9), cp = U.CELLPX * S2, F = U.facts();
    const gx = 384, gy = 92, gw = cv.width * S2, gh = (cv.height - 14) * S2;
    const L = U.layout('me'), bo = L.find(b => b.id === 'boiler'), fb = SA.fp('boiler_s');
    const at = (b) => ({ x: gx + (b.c0 - cv._c0) * cp, y: gy + (b.r0 - cv._r0) * cp, w: (b.c1 - b.c0 + 1) * cp, h: (b.r1 - b.r0 + 1) * cp });
    const r = at(bo), gh2 = at({ c0: 10, r0: 8 - fb.h, c1: 9 + fb.w, r1: 7 });
    const items = U.catItems('energy');
    const g6 = U.gauges('me');
    return U.screen('pd',
      topbar('车间', h('span', { style: 'display:flex;gap:10px;align-items:center;margin-left:14px' },
        h('span', { class: 'd-pill' }, '一号原型机 ▾'), h('span', { style: 'font-size:12px;color:var(--mut)' }, `评分 ${F.rating}`),
        h('span', { class: 'd-seg', style: 'margin-left:18px' }, h('span', { class: 'on' }, '主体层'), h('span', {}, '侧挂层')), h('span', { style: 'font-size:14px;color:var(--mut)', title: '侧挂层：挂在车体外侧的炮和撞击件' }, 'ⓘ'),
        h('button', { class: 'd-ib', style: 'margin-left:10px' }, '↶'), h('button', { class: 'd-ib' }, '↷'), h('button', { class: 'd-btn sm ghost' }, '存为蓝图'))),
      // 类别栏 + 零件格
      ab(0, 56, 64, 608, h('div', { class: 'd-rail', style: 'height:100%;background:#0c0e12;box-shadow:inset -1px 0 0 var(--line);padding-top:8px' },
        U.CATS.map(k => h('span', { class: k === 'energy' ? 'on' : '' }, h('i', { style: `background:${SA.CAT[k].plate}` }, SA.CAT[k].name[0]), SA.CAT[k].name, h('b', {}, D.inv.filter(([id, , n]) => M[id].cat === k && n).length || ''))))),
      ab(64, 56, 304, 608, h('div', { style: 'height:100%;background:var(--s1);box-shadow:inset -1px 0 0 var(--line);padding:12px;display:flex;flex-direction:column;gap:10px' },
        h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('b', { style: 'font-size:16px' }, '能源'), h('span', { style: 'font-size:12px;color:var(--mut)' }, `${items.length} 种`), h('span', { class: 'd-seg', style: 'margin-left:auto' }, h('span', {}, '有货'), h('span', { class: 'on' }, '全部'))),
        h('div', { style: 'height:32px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line);display:flex;align-items:center;padding:0 10px;color:var(--dim);font-size:13px' }, '🔍 搜零件…'),
        h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px' }, items.map(x => tile(x, x[0] === 'boiler_s' ? 'sel' : x[0] === 'boiler' ? 'hov' : ''))),
        h('div', { style: 'margin-top:auto;font-size:12px;color:var(--mut);line-height:1.6' }, '点零件拿起 → 点格子放下', h('br'), h('span', { class: 'd-kbd' }, '右键'), '放回 ', h('span', { class: 'd-kbd' }, 'R'), '换层 ', h('span', { class: 'd-kbd' }, 'Ctrl Z'), '撤销'))),
      // 画布
      ab(368, 56, 592, 608, h('div', { style: 'height:100%;background:radial-gradient(ellipse at 50% 60%,#1d2129,#111318 70%)' })),
      ab(gx, gy, gw, gh, h('div', { style: `width:100%;height:100%;background:radial-gradient(circle,rgba(154,161,174,.28) 1.5px,transparent 2px) 0 0/${cp / 2}px ${cp / 2}px;box-shadow:inset 0 0 0 1px rgba(154,161,174,.25)` })),
      ab(gx, gy, null, null, U.show(cv, S2)),
      ab(gh2.x, gh2.y, gh2.w, gh2.h, h('div', { style: 'width:100%;height:100%;box-shadow:inset 0 0 0 2px var(--ok);background:rgba(111,207,106,.14)' })),
      ab(gh2.x + 4, gh2.y + 6, null, null, (() => { const c = U.show(U.mod('boiler_s'), 2); c.style.opacity = '.7'; c.style.maxHeight = `${gh2.h - 12}px`; c.style.width = 'auto'; return c; })()),
      ab(gh2.x + gh2.w + 8, gh2.y + 4, null, null, h('span', { class: 'd-tag ok' }, '✓ 可以放 · 动力 6 → 9')),
      ab(r.x + r.w - 14, r.y - 12, null, null, h('span', { style: 'display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--bad);color:#fff;font-weight:900;box-shadow:0 0 0 3px rgba(255,80,104,.3)' }, '!')),
      ab(r.x - 2, r.y - 2, r.w + 4, r.h + 4, h('div', { style: 'width:100%;height:100%;box-shadow:inset 0 0 0 2px var(--bad)' })),
      ab(430, 612, 500, null, h('div', { style: 'display:flex;justify-content:center' }, h('div', { class: 'd-say', style: 'font-size:13px' }, h('span', { class: 'd-tile', style: 'height:34px;width:40px;padding:2px' }, (() => { const c = U.show(U.mod('boiler_s'), 1); c.style.maxHeight = '30px'; c.style.width = 'auto'; return c; })()), '拿着 ', h('b', {}, '竖式锅炉'), ' · 点绿框放下 · ', h('span', { class: 'd-kbd' }, '右键'), '放回'))),
      // 悬停提示（燃煤锅炉）
      ab(250, 300, 230, null, h('div', { class: 'd-tip' }, h('b', {}, '燃煤锅炉'), ' 2×2 · £130', h('br'), '提供 6 点动力；被击毁会爆炸。', h('br'), '装上：', h('span', { class: 'up' }, '动力 +6'), ' · ', h('span', { class: 'dn' }, '重 +0.55 t'), ' · ', h('span', { class: 'dn' }, '产热 +1.5'))),
      ab(906, 70, null, null, h('div', { style: 'display:grid;gap:6px' }, h('button', { class: 'd-ib' }, '+'), h('button', { class: 'd-ib' }, '−'), h('button', { class: 'd-ib', style: 'font-size:12px' }, '⤢'))),
      // 右：车况
      ab(960, 56, 320, 608, h('div', { style: 'height:100%;background:var(--s1);box-shadow:inset 1px 0 0 var(--line);padding:14px 16px;display:flex;flex-direction:column;gap:12px' },
        h('div', { style: 'display:flex;align-items:baseline;gap:8px' }, h('b', { style: 'font-size:16px' }, '车况'), h('span', { style: 'font-size:12px;color:var(--mut)' }, '绿框 = 放下以后'), h('span', { style: 'margin-left:auto;font-size:22px;font-weight:900;color:var(--brass2)' }, F.rating), h('span', { style: 'color:var(--ok);font-size:12px;font-weight:700' }, '+14')),
        g6.map(g => meter(g)),
        h('div', { class: 'd-card', style: 'padding:10px 12px;margin-top:auto;box-shadow:inset 0 0 0 1px rgba(255,80,104,.6)' },
          h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('span', { style: 'color:var(--bad);font-size:18px' }, '⚠'), h('b', {}, '动力不足'), h('span', { style: 'margin-left:auto;font-size:12px;color:var(--mut)' }, `${F.demand} / ${F.supply}`)),
          h('div', { style: 'font-size:12px;color:var(--ok);margin:4px 0 8px' }, '✓ 放下手里的竖式锅炉就能解决'),
          h('button', { class: 'd-btn sm' }, '◎ 在车上找到它')),
        h('button', { class: 'd-btn pri', style: 'font-size:18px;letter-spacing:.2em' }, '出战 ▶'))),
      nav('garage'),
    );
  }

  // ---------- 出战 ----------
  function arena() {
    const F = U.facts(), foe = D.stages[2], sm = U.stats('me'), sf = U.stats('foe');
    const bg = U.show(U.scene('qual', 844, 416, 420, 260), 1); bg.style.cssText += 'position:absolute;left:0;top:0;filter:brightness(.7)';
    const rows = [['火力', sm.dps, sf.dps, (x) => x.toFixed(1)], ['耐久', sm.maxHp, sf.maxHp, (x) => x], ['速度', sm.topSpeed, sf.topSpeed, (x) => SA.kmh(x)], ['动力', sm.supply - sm.demand, sf.supply - sf.demand, (x) => (x > 0 ? '+' : '') + x.toFixed(1)]];
    const cmp = rows.map(([n, a, b, f]) => { const mx = Math.max(Math.abs(a), Math.abs(b), 1e-6), win = a >= b;
      return h('div', { class: 'd-card', style: 'padding:8px 10px;display:grid;gap:5px' }, h('div', { style: 'display:flex;font-size:12px;color:var(--mut)' }, n, h('span', { style: `margin-left:auto;font-weight:700;color:${win ? 'var(--ok)' : 'var(--bad)'}` }, win ? '你占优' : '对手占优')),
        h('div', { style: 'display:grid;grid-template-columns:1fr 58px;gap:6px;align-items:center;font-size:12px' }, h('div', { style: 'height:8px;background:var(--s3)' }, h('i', { style: `display:block;height:100%;width:${Math.max(3, Math.abs(a) / mx * 100)}%;background:${a < 0 ? 'var(--bad)' : 'var(--brass)'}` })), h('span', { class: 'num' }, f(a)),
          h('div', { style: 'height:8px;background:var(--s3)' }, h('i', { style: `display:block;height:100%;width:${Math.max(3, Math.abs(b) / mx * 100)}%;background:#9aa1ae` })), h('span', { class: 'num', style: 'color:var(--mut)' }, f(b)))); });
    return U.screen('pd',
      topbar('出战', h('span', { class: 'd-seg', style: 'margin-left:14px' }, h('span', { class: 'on' }, '战役'), h('span', {}, '街头赛'), h('span', { style: 'opacity:.5' }, '锦标赛 🔒'))),
      ab(16, 68, 844, 64, h('div', { class: 'd-card', style: 'height:100%;padding:10px 16px;display:flex;align-items:center;gap:18px' },
        h('span', { class: 'd-pill' }, D.chapter, ' ▾'), h('div', { style: 'flex:1;padding:0 24px 14px' }, stepper()), h('span', { style: 'font-size:12px;color:var(--mut)' }, '2 / 3 · 打过的可以重打'))),
      // 对阵
      ab(16, 144, 844, 416, h('div', { class: 'd-cut', style: 'position:relative;width:100%;height:100%;overflow:hidden;background:#000' }, bg,
        h('div', { class: 'ab', style: 'inset:0;background:linear-gradient(180deg,rgba(17,19,24,.55),transparent 30%,transparent 75%,rgba(17,19,24,.8))' }),
        ab(70, 110, null, null, U.show(U.car('me'), 1.5)),
        ab(540, 110, null, null, (() => { const c = U.show(U.car('foe'), 1.5); c.style.transform = 'scaleX(-1)'; return c; })()),
        ab(382, 150, null, null, h('div', { style: 'width:80px;height:80px;display:grid;place-items:center;font:900 30px "Microsoft YaHei";color:#2a1204;background:linear-gradient(180deg,var(--fire2),var(--fire));clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)' }, 'VS')),
        ab(16, 14, null, null, h('div', { style: 'display:flex;align-items:center;gap:10px' }, h('div', { style: 'width:52px;height:52px;border-radius:50%;overflow:hidden;background:#2c313c;box-shadow:0 0 0 2px var(--brass);display:grid;place-items:center' }, U.show(U.coal('你', { size: 'portrait' }), 0.6)), h('div', {}, h('b', { style: 'font-size:16px' }, '你 · 一号原型机'), h('div', { style: 'font-size:12px;color:var(--mut)' }, `评分 ${F.rating}`)))),
        ab(560, 14, 270, null, h('div', { style: 'display:flex;align-items:center;gap:10px;justify-content:flex-end;text-align:right' }, h('div', {}, h('b', { style: 'font-size:16px' }, '煤灰寡妇 '), h('span', { class: 'd-tag boss' }, 'BOSS'), h('div', { style: 'font-size:12px;color:var(--mut)' }, `${foe.pilot} · 评分 ${F.foeRating}`)), h('div', { style: 'width:52px;height:52px;border-radius:50%;overflow:hidden;background:#2c313c;box-shadow:0 0 0 2px var(--bad);display:grid;place-items:center' }, U.show(U.coal(foe.pilot, { size: 'portrait' }), 0.6)))))),
      ab(16, 572, 844, 80, h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;height:100%' }, cmp)),
      // 右栏
      ab(876, 68, 388, null, h('div', { style: 'display:grid;gap:10px' },
        h('div', { class: 'd-card' }, h('div', { class: 'hd' }, h('b', {}, '对手情报')),
          h('div', { style: 'display:grid;gap:8px;font-size:13px' },
            h('div', {}, h('span', { class: 'd-tag bad' }, '威胁'), ' 臼炮高抛，专砸车顶'), h('div', {}, h('span', { class: 'd-tag bad' }, '威胁'), ' 四足，比你快一倍'), h('div', {}, h('span', { class: 'd-tag ok' }, '弱点'), ' 两台锅炉挂在车尾'),
            h('div', { style: 'color:var(--mut);font-size:12px;border-top:1px solid var(--line);padding-top:8px' }, '建议：顶上加甲，守住正面别追。'))),
        h('div', { class: 'd-card' }, h('div', { class: 'hd' }, h('b', {}, '场地 · 货箱')),
          h('div', { style: 'position:relative;height:46px;border-bottom:2px solid var(--mut)' }, h('i', { style: 'position:absolute;left:44%;bottom:0;width:26px;height:26px;background:#6b5a44;box-shadow:inset 0 0 0 2px #3a2e20' }), h('i', { style: 'position:absolute;left:54%;bottom:0;width:26px;height:18px;background:#6b5a44;box-shadow:inset 0 0 0 2px #3a2e20' }),
            h('i', { style: 'position:absolute;left:8%;bottom:14px;width:34%;border-top:2px dashed var(--bad)' }), h('i', { style: 'position:absolute;left:30%;right:10%;top:-6px;height:40px;border:2px dashed var(--ok);border-bottom:0;border-radius:50% 50% 0 0' })),
          h('div', { style: 'font-size:12px;color:var(--mut);margin-top:6px' }, '箱子挡直射（红），高抛越过（绿）')),
        h('div', { class: 'd-card' }, h('div', { class: 'hd' }, h('b', {}, '奖励'), h('span', { class: 'r' }, '赔率 2 : 1')),
          h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, h('span', { class: 'd-pill money' }, ic('coin', '#f5d77a'), h('span', { class: 'num' }, money(220))), h('span', { class: 'd-pill' }, '★ +1'), h('span', { class: 'd-pill' }, '缴获 1 件')),
          h('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px' }, '下注', h('span', { class: 'd-seg' }, h('span', {}, '不下'), h('span', { class: 'on' }, '£50'), h('span', {}, '£100')))))),
      ab(876, 548, 388, 104, h('div', { style: 'display:grid;gap:8px' }, h('button', { class: 'd-btn pri big', style: 'width:100%' }, '出战'),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('button', { class: 'd-btn sm ghost' }, '← 回车间对症改装'), h('span', { style: 'margin-left:auto;font-size:11px;color:var(--mut)' }, h('span', { class: 'd-kbd' }, 'A'), h('span', { class: 'd-kbd' }, 'D'), '走 ', h('span', { class: 'd-kbd' }, '左键'), '蓄准开火')))),
      nav('arena'),
    );
  }

  // ---------- 小组件 ----------
  function parts() {
    const box = (t, ...kids) => h('div', { style: 'display:grid;gap:8px;align-content:start' }, h('span', { style: 'font-size:12px;color:var(--mut);letter-spacing:.12em' }, t), ...kids);
    return h('div', { class: 'pd sheet' },
      h('div', { class: 'row' },
        box('资源', pills()),
        box('材料 T1～T6（史诗、传奇带底色）', h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;max-width:460px' }, [1, 2, 3, 4, 5, 6].map(matTag))),
        box('战斗顶条', h('div', { class: 'd-hud', style: 'width:560px' },
          h('div', { style: 'display:grid;gap:5px' }, h('div', { style: 'display:flex;font-size:12px' }, h('b', {}, '你'), h('span', { class: 'num', style: 'margin-left:auto' }, '1170')), h('div', { class: 'hp' }, h('i', { style: 'left:0;width:82%;background:var(--brass)' })), h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' }, h('div', { class: 'hp', style: 'height:5px' }, h('i', { style: 'left:0;width:46%;background:var(--bad)' })), h('div', { class: 'hp', style: 'height:5px' }, h('i', { style: 'left:0;width:70%;background:var(--water)' })))),
          h('div', { class: 'clk' }, '87'),
          h('div', { style: 'display:grid;gap:5px' }, h('div', { style: 'display:flex;font-size:12px' }, h('span', { class: 'num' }, '880'), h('b', { style: 'margin-left:auto' }, '煤灰寡妇')), h('div', { class: 'hp' }, h('i', { style: 'right:0;width:64%;background:#9aa1ae' })), h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' }, h('div', { class: 'hp', style: 'height:5px' }, h('i', { style: 'right:0;width:30%;background:var(--bad)' })), h('div', { class: 'hp', style: 'height:5px' }, h('i', { style: 'right:0;width:88%;background:var(--water)' }))))))),
      h('div', { class: 'row' },
        box('零件格：有货 / 拿起 / 悬停 / 没货', h('div', { style: 'display:grid;grid-template-columns:repeat(4,96px);gap:6px' }, tile(['boiler_s', 1, 1, 90]), tile(['armor', 2, 1, 29], 'sel'), tile(['cannon', 1, 1, 120], 'hov'), tile(['mortar_s', 1, 0, 140]))),
        box('悬停提示', h('div', { class: 'd-tip', style: 'width:240px' }, h('b', {}, '小臼炮'), ' 1×1 · £140', h('br'), '高抛，越过货箱砸顶。', h('br'), '装上：', h('span', { class: 'up' }, '火力 +3.1/s'), ' · ', h('span', { class: 'dn' }, '动力 −1'))),
        box('提示条', h('div', { class: 'd-toast' }, h('span', { style: 'color:var(--ok);font-size:18px' }, '✓'), h('span', {}, '缴获 ', h('b', {}, '熟铁锅炉'), '，已放进库存')), h('div', { class: 'd-toast bad' }, h('span', { style: 'color:var(--bad);font-size:18px' }, '✕'), '这里悬空：下面要有车体托着'))),
      h('div', { class: 'row' },
        box('确认 / 资金不足', h('div', { class: 'd-dlg' }, h('div', { class: 'hd' }, '钱不够'),
          h('div', { class: 'bd' }, '升级要 ', h('b', {}, '£430'), '，你有 £240，还差 ', h('b', { style: 'color:var(--bad)' }, '£190'), '。', h('br'), '可以向伦敦蒸汽银行借 £200（每场锦标赛利息 10%）。'),
          h('div', { class: 'ft' }, h('button', { class: 'd-btn ghost' }, '算了'), h('button', { class: 'd-btn pri' }, '借 £200 并升级')))),
        box('缴获战利品（唯一件金边排最前）', h('div', { class: 'd-dlg', style: 'width:500px' }, h('div', { class: 'hd' }, '缴获战利品 · 选一件'),
          h('div', { class: 'bd', style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px' },
            h('div', { style: 'display:grid;gap:4px' }, tile(['mortar_s', 1, 1, 0], 'sel'), h('span', { class: 'd-tag boss', style: 'justify-self:start' }, '★ 唯一件')),
            h('div', { style: 'display:grid;gap:4px' }, tile(['boiler_s', 2, 1, 0]), matTag(2)), h('div', { style: 'display:grid;gap:4px' }, tile(['armor', 2, 1, 0]), matTag(2))),
          h('div', { class: 'ft' }, h('button', { class: 'd-btn pri' }, '拿走 小臼炮'))))));
  }

  U.add({ id: 'D', name: '锅炉控制台', tag: '现代游戏骨架 · UX 优先 · 能上手机',
    pitch: '先把好用做到位，再加蒸汽味。骨架是玩家最熟悉的现代游戏界面：底部五个导航（主页 / 车间 / 出战 / 蓝图 / 银行）、卡片、分段表、零件格。主页面左边是你的车停在竞技场里，右边「下一场」卡片一个大按钮直接出战，车况有问题就在下面说哪里不行、点一下去修。改装台三栏：左边类别 + 零件格（商店合在里面，没货显示价格），中间大车，右边车况分段表（绿框预览放下以后）。出战：上面章节进度，中间对阵，下面四项对比，右边对手情报、场地、奖励和出战按钮。',
    pros: ['最好上手：布局是大家玩过的样子，不用学', '同一套组件直接缩到手机竖屏，以后发布到移动端最省事', '实现和维护最简单：组件少、全是 CSS，改数值和加功能不用重画'],
    cons: ['风格最「通用」，蒸汽朋克只靠颜色、斜角和像素图撑', '和 A / C 比，界面本身没有故事感', '要靠后面的动效（压力针、蒸汽、火花）补个性'],
    notes: { home: '右栏「下一场」一个大按钮；车况卡直接说问题并带「去修」；下面三个次要模式', garage: '左：类别 + 零件格；中：绿框 = 放得下；右：分段表绿框预览 + 问题卡', arena: '上：章节进度；中：对阵；下：四项对比（谁占优）；右：情报、场地、奖励' },
    lang, home, garage, arena, parts });
})();
