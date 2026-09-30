// 方案 C · 蒸汽公报：维多利亚印刷品——主页面是报纸头版，改装台是零件邮购目录，出战是拳赛式对决海报。
(() => {
  const U = SA.UILAB, { h, D, money } = U, M = SA.MODULES;
  const ab = (x, y, w, hh, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${hh ? `height:${hh}px;` : ''}` }, ...kids);
  const pct = (x) => `${Math.max(0, Math.min(100, x * 100)).toFixed(1)}%`;
  const INK = [30, 23, 18], RED = [179, 38, 30];
  const eng = (cv, s = 1, flip) => { const c = U.show(U.engrave(cv, INK, RED), s); if (flip) c.style.transform = 'scaleX(-1)'; return c; };
  const ovalCoal = (name, w, hh, s) => h('div', { class: 'c-oval', style: `width:${w}px;height:${hh}px` }, U.show(U.coal(name), s));

  function bar(g) {
    const bad = g.pct >= 1;
    return h('div', { class: `c-bar ${bad ? 'bad' : ''}` }, h('b', {}, g.name),
      h('div', { class: 'tr' }, h('i', { class: 'fill', style: `width:${pct(Math.min(1, g.pct))}` }), g.delta ? h('i', { class: 'ghost', style: `left:${pct(Math.min(g.pct, g.pct + g.delta))};width:${pct(Math.abs(g.delta))}` }) : null),
      h('span', { class: 'v' }, g.val, g.delta ? (g.delta > 0 ? ' ▲' : ' ▼') : ''));
  }
  const chip = (mt) => { const m = SA.MATS[mt]; return h('span', { class: 'c-chip' }, h('i', { style: `background:${m.chip}` }), `${['', '壹', '贰', '叁', '肆', '伍', '陆'][mt]} · ${m.name}`); };
  function nav(on) {
    const T = [['home', '头版'], ['garage', '车间'], ['arena', '赛程'], ['street', '街头赛'], ['bank', '银行'], ['bp', '蓝图']];
    return h('div', { class: 'c-nav' }, T.map(([k, n]) => h('span', { class: k === on ? 'on' : '' }, n, k === 'garage' ? h('span', { class: 'n' }, ' ①') : null)));
  }
  function ear() { return h('div', { class: 'c-ear' }, '你的账户', h('br'), h('b', {}, money(D.money)), ' · 声望 ', '★'.repeat(D.rep), h('br'), D.ingots.map(([k, n]) => `${k} ${n} 块`).join('')); }
  function item([id, mt, n, price], o = {}) {
    return h('div', { class: `c-item ${o.sel ? 'sel' : ''} ${n ? 'own' : ''}` },
      h('div', { class: 'pic' }, o.color ? U.show(U.mod(id, mt), 1) : eng(U.mod(id, mt), 1)),
      h('div', {}, h('div', { class: 'nm' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name), h('div', { class: 'd' }, (M[id].desc || '').split('。')[0] + '。')),
      h('div', { class: 'pr' }, n ? `×${n}` : money(price), h('small', {}, n ? '库存' : '邮购')),
      o.sel ? h('span', { class: 'c-stamp' }, '已拿起') : null);
  }

  // ---------- 设计语言 ----------
  function lang() {
    const sw = (c, n) => h('div', { style: 'display:grid;gap:4px;justify-items:center;font-size:12px' }, h('i', { style: `width:54px;height:40px;background:${c};border:1.5px solid #1e1712` }), n);
    return h('div', { class: 'pc sheet' },
      h('div', { class: 'row' },
        h('div', { style: 'flex:1;min-width:300px' },
          h('div', { class: 'c-kick' }, '本报设计语言'), h('div', { class: 'c-head' }, '蒸汽公报'),
          h('p', { class: 'c-body', style: 'max-width:560px' }, '整个界面是维多利亚时代的印刷品：报纸、海报、邮购目录、票根和电报。只有纸、墨和一个', h('b', {}, '朱红'), '（主操作、问题、印章）。车和零件用游戏精灵转成铜版画网点，拿起来的那一件恢复彩色。最有「讲故事」的味道：每一场比赛都是一条新闻。')),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [['#efe4c6', '新闻纸'], ['#e3d2a8', '旧纸'], ['#1e1712', '油墨'], ['#5a4a38', '淡墨'], ['#b3261e', '朱红·主操作'], ['#a8782a', '烫金']].map(([c, n]) => sw(c, n)))),
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'c-head md' }, '标题 · 宋体特粗'), h('div', { class: 'c-body', style: 'margin-top:4px' }, '正文 · 宋体 15px，两端对齐'), h('div', { style: 'font:700 18px Georgia,serif;margin-top:4px' }, '数字 £1,240 · 1887')),
        h('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, h('button', { class: 'c-btn red' }, '入场出战', h('span', { class: 'no' }, 'No.042')), h('button', { class: 'c-btn' }, '次操作'), h('button', { class: 'c-btn off' }, '不可用'), h('button', { class: 'c-btn sm' }, '小票根'), h('span', { class: 'c-link' }, '文字链接 →'))),
      h('div', { class: 'row' },
        h('div', { class: 'c-box', style: 'width:250px' }, h('div', { class: 'h' }, '专栏框'), h('div', { class: 'c-body sm' }, '面板 = 报纸的栏框：细线外框，标题下双线。')),
        h('div', { class: 'c-ad', style: 'width:230px' }, h('div', { class: 't' }, '广告框'), h('div', { class: 's' }, '银行、街头赛、蓝图交换所都是报上的广告；点广告就去那里')),
        h('div', { style: 'display:grid;gap:16px;justify-items:start' }, h('span', { class: 'c-stamp' }, '待修'), h('span', { class: 'c-stamp', style: 'color:#2a5a2a;border-color:#2a5a2a' }, '已胜')),
        h('div', { class: 'c-seal' }, '蒸汽', h('br'), '竞技'),
        ovalCoal('玛莎·布莱克', 96, 116, 1)),
      h('div', { class: 'row' },
        h('div', { style: 'width:360px;display:grid;gap:8px' }, U.gauges('me').slice(0, 4).map(bar)),
        h('div', { class: 'c-body sm', style: 'max-width:260px' }, '属性 = 「性能证书」上的印刷条：网线 = 现在，', h('b', {}, '朱红框'), ' = 装上手里的零件以后。超上限整条变红。'),
        h('div', { style: 'display:flex;gap:10px;align-items:flex-end' }, eng(U.car('foe'), 1), U.show(U.car('foe'), 1), h('span', { class: 'c-body sm', style: 'max-width:150px' }, '左：铜版画（没选中）；右：原色（拿起 / 选中）'))));
  }

  // ---------- 主页面：报纸头版 ----------
  function home() {
    const F = U.facts(), foe = D.stages[2];
    return U.screen('pc',
      ab(24, 12, 1232, 20, h('div', { class: 'c-line' }, h('span', {}, '伦敦 · 一八八七年十月 · 星期六'), h('span', {}, '第 42 期 · 售价一便士'), h('span', {}, '天气：煤烟，傍晚有雾'))),
      ab(24, 34, 1232, 4, h('div', { class: 'c-rule th' })),
      ab(24, 44, 210, null, h('div', { class: 'c-ear' }, '本期要闻', h('br'), h('b', {}, '后巷女王'), h('br'), '迎战新人')),
      ab(1046, 44, 210, null, ear()),
      ab(260, 36, 760, null, h('div', { class: 'c-mast' }, h('div', { class: 'ttl' }, '蒸汽公报'), h('div', { class: 'en' }, 'THE STEAM GAZETTE'))),
      ab(24, 138, 1232, 4, h('div', { class: 'c-rule' })),
      ab(24, 146, 1232, null, nav('home')),
      ab(24, 176, 1232, 4, h('div', { class: 'c-rule' })),
      // 头条
      ab(24, 190, 740, null, h('div', {},
        h('div', { class: 'c-kick' }, `今晚 · ${D.place} · ${D.chapter.split(' · ')[0]}压轴战`),
        h('div', { class: 'c-head', style: 'font-size:40px;margin:4px 0 0;white-space:nowrap' }, '后巷女王「煤灰寡妇」迎战新人！'))),
      ab(24, 264, 740, 2, h('div', { style: 'border-top:1px solid var(--ink)' })),
      ab(24, 280, 170, null, h('div', { style: 'display:grid;justify-items:center;gap:6px' }, ovalCoal(foe.pilot, 140, 168, 1.3), h('div', { style: 'font:700 12px var(--display)' }, '玛莎·布莱克女士'))),
      ab(206, 290, 180, null, h('div', { style: 'display:grid;justify-items:center;gap:4px' }, eng(U.car('foe'), 1, true), h('div', { style: 'font:700 12px var(--display)' }, '图：她的四足战车'))),
      ab(400, 280, 364, null, h('div', {},
        h('p', { class: 'c-body c-drop', style: 'margin:0' }, '据本报记者消息，玛莎·布莱克的四足战车「煤灰寡妇」车顶装着一门', h('b', {}, '臼炮'), '，专门越过货箱砸人车顶；两台锅炉都挂在', h('b', {}, '车尾'), '。她的车比新人快一倍，追是追不上的。'),
        h('p', { class: 'c-body sm', style: 'margin:8px 0 0;color:var(--ink2)' }, `场地：货箱　奖金：${money(foe.prize)}　另可缴获一件`, h('br'), `评分：寡妇 ${F.foeRating} 对 新人 ${F.rating}`),
        h('div', { style: 'display:flex;gap:14px;align-items:center;margin-top:14px;flex-wrap:wrap' }, h('button', { class: 'c-btn red' }, '购票入场 · 出战', h('span', { class: 'no' }, 'No.042')), h('span', { class: 'c-link' }, '先回车间准备 →')))),
      // 右栏
      ab(784, 190, 1, 380, h('div', { style: 'height:100%;border-left:1px solid var(--ink)' })),
      ab(800, 190, 456, null, h('div', { style: 'display:grid;gap:12px' },
        h('div', { class: 'c-box' }, h('div', { class: 'h' }, '车 间 简 讯'),
          h('div', { style: 'display:flex;gap:12px;align-items:center' }, eng(U.car('me'), 1),
            h('div', { class: 'c-body sm' }, '新人的「一号原型机」', h('b', {}, `动力不足（${F.demand} > ${F.supply}）`), '，铁匠老汤姆建议再添一台小锅炉。', h('div', { style: 'margin-top:6px;display:flex;gap:12px;align-items:center' }, h('span', { class: 'c-stamp' }, '待修'), h('span', { class: 'c-link' }, '去车间 →'))))),
        h('div', { class: 'c-box' }, h('div', { class: 'h' }, '上 期 战 报'),
          D.stages.filter(s => s.done).map(s => h('div', { class: 'c-body sm', style: 'display:flex;justify-content:space-between' }, h('span', {}, `新人 胜 ${s.name}（${s.pilot}）`), h('span', { style: 'color:#2a5a2a;font-weight:900' }, '胜'))),
          h('div', { class: 'c-body sm', style: 'color:var(--ink2)' }, '已胜的对手可以重打，不奖不罚。')))),
      // 广告
      ab(24, 586, 1232, 4, h('div', { class: 'c-rule' })),
      ab(24, 604, 1232, 104, h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:14px;height:100%' },
        h('div', { class: 'c-ad' }, h('div', { class: 't' }, '伦敦蒸汽银行'), h('div', { class: 's' }, '缺钱改装？借款还款，童叟无欺', h('br'), '☞ 点此办理')),
        h('div', { class: 'c-ad' }, h('div', { class: 't' }, '后巷街头赛'), h('div', { class: 's' }, '随手拼的小车也能上场', h('br'), '奖金现结 ☞ 报名')),
        h('div', { class: 'c-ad off' }, h('div', { class: 't' }, '皇家锦标赛'), h('div', { class: 's' }, '第五章以后开放', h('br'), '敬请期待')),
        h('div', { class: 'c-ad' }, h('div', { class: 't' }, '蓝图交换所'), h('div', { class: 's' }, '官方图纸四种，分享码互换', h('br'), '☞ 入内')))),
    );
  }

  // ---------- 改装台：零件邮购目录（摊开的书）----------
  function garage() {
    const S2 = 2, cv = U.carGrid('me', 10, 8), cp = U.CELLPX * S2, F = U.facts();
    const px = 90, py = 96, gw = cv.width * S2, gh = (cv.height - 14) * S2;
    const bo = U.layout('me').find(b => b.id === 'boiler');
    const bx = px + (bo.c0 - cv._c0) * cp, by = py + (bo.r0 - cv._r0) * cp, bw = (bo.c1 - bo.c0 + 1) * cp, bh = (bo.r1 - bo.r0 + 1) * cp;
    const items = U.catItems('energy').slice(0, 6);
    const tabCol = { mobility: '#9ec79a', control: '#b8dbe6', energy: '#f0a868', cooling: '#8fcfd3', structure: '#c8cad0', firepower: '#e8c46a', ram: '#d99a86' };
    return U.screen('pc c-desk',
      h('div', { class: 'c-page l', style: 'left:36px;top:24px;width:600px;height:680px' }),
      h('div', { class: 'c-page r', style: 'left:636px;top:24px;width:590px;height:680px' }),
      // 索引标签
      U.CATS.map((k, i) => ab(1224, 60 + i * 84, null, null, h('div', { class: `c-idx ${k === 'energy' ? 'on' : ''}`, style: `background:${tabCol[k]};height:76px` }, SA.CAT[k].name))),
      h('div', { class: 'pc', style: 'position:absolute;inset:0;background:none' },
        // 左页
        ab(66, 42, 540, null, h('div', { style: 'display:flex;align-items:baseline;gap:10px' }, h('span', { class: 'c-kick' }, '图版 I'), h('span', { class: 'c-head md' }, '一号原型机 ✎'), h('span', { style: 'margin-left:auto;font-size:13px' }, `评分 ${F.rating}`))),
        ab(66, 78, 540, 4, h('div', { class: 'c-rule' })),
        ab(px - 6, py - 6, gw + 12, gh + 12, h('div', { class: 'c-plate', style: `width:100%;height:100%;background:linear-gradient(rgba(30,23,18,.12) 1px,transparent 1px) 6px 6px/${cp}px ${cp}px,linear-gradient(90deg,rgba(30,23,18,.12) 1px,transparent 1px) 6px 6px/${cp}px ${cp}px,#e8dcb8` })),
        ab(px, py, null, null, U.show(cv, S2)),
        ab(bx - 4, by - 4, bw + 8, bh + 8, h('div', { style: 'width:100%;height:100%;border:3px solid var(--red);border-radius:50%' })),
        ab(bx - 26, by - 16, null, null, h('span', { class: 'c-seal', style: 'width:26px;height:26px;font-size:12px;box-shadow:0 0 0 2px #9a2018' }, '①')),
        ab(px + gw - 150, py + 8, null, null, h('div', { style: 'font-size:13px;display:flex;gap:8px' }, h('b', { style: 'color:var(--red);border-bottom:2px solid var(--red)' }, '主体'), h('span', { style: 'color:var(--ink2)' }, '侧挂'), h('span', { class: 'c-link', style: 'margin-left:8px' }, '↶ 撤销'))),
        ab(66, py + gh + 18, 540, null, h('div', { class: 'c-box', style: 'padding:8px 12px' },
          h('div', { style: 'display:flex;align-items:baseline;gap:10px;border-bottom:3px double var(--ink);padding-bottom:3px;margin-bottom:6px' }, h('b', { style: 'letter-spacing:.2em' }, '性能证书'), h('span', { style: 'font-size:12px;color:var(--ink2)' }, '朱红框 = 装上「竖式锅炉」以后'), h('span', { class: 'c-stamp', style: 'margin-left:auto;font-size:12px' }, '动力不足')),
          h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:5px 18px' }, U.gauges('me').map(bar)))),
        ab(66, 646, 540, null, h('div', { class: 'c-body sm', style: 'border-top:1px solid var(--ink);padding-top:4px' }, h('b', {}, '① 燃煤锅炉'), `：耐久 120/120 · 供给 6，现在要 ${F.demand}。　`, h('span', { class: 'c-link' }, '升熟铁 £78'), '　', h('span', { class: 'c-link' }, '加甲 £18'), '　', h('span', { class: 'c-link' }, '拆下'))),
        // 右页
        ab(670, 42, 520, null, h('div', { style: 'display:flex;align-items:baseline;gap:10px' }, h('span', { class: 'c-kick' }, '邮购目录'), h('span', { class: 'c-head md' }, '能源类'), h('span', { style: 'margin-left:auto;font-size:13px' }, h('b', {}, '有货'), ' · ', h('span', { style: 'color:var(--ink2)' }, '全部')))),
        ab(670, 78, 520, 4, h('div', { class: 'c-rule' })),
        ab(670, 88, 520, 520, h('div', {}, items.map(x => item(x, { sel: x[0] === 'boiler_s', color: x[0] === 'boiler_s' })))),
        ab(670, 626, 520, null, h('div', { style: 'display:flex;align-items:center;gap:14px' }, h('span', { class: 'c-body sm', style: 'flex:1;color:var(--ink2)' }, `拖到左边图版上安装 · 右键放回 · 钱包 ${money(D.money)}`), h('button', { class: 'c-btn red' }, '出战 →')))),
    );
  }

  // ---------- 出战：对决海报 ----------
  function arena() {
    const F = U.facts(), foe = D.stages[2];
    return U.screen('pc c-wall',
      // 左：赛程剪报
      h('div', { class: 'pc', style: 'position:absolute;inset:0;background:none' },
        h('div', { class: 'c-clip', style: 'left:26px;top:40px;width:250px;rotate:-2deg' },
          h('div', { class: 'c-head sm', style: 'text-align:center;letter-spacing:.3em;border-bottom:3px double var(--ink);padding-bottom:4px' }, '赛 程 表'),
          h('div', { class: 'c-body sm', style: 'margin-top:6px' }, h('b', { style: 'color:var(--ink)' }, D.chapter)),
          D.stages.map(s => h('div', { class: 'c-body sm', style: `display:flex;justify-content:space-between;${s.next ? 'color:var(--red);font-weight:900' : ''}` }, h('span', {}, s.next ? '☞ ' : '　', s.name), h('span', {}, s.done ? '胜' : s.boss ? '今晚' : ''))),
          h('div', { class: 'c-body sm', style: 'margin-top:8px;color:var(--ink2)' }, D.chapters.slice(2).join('　')),
          h('div', { style: 'margin-top:10px;display:flex;gap:6px;font-size:12px' }, h('span', { class: 'c-link' }, '街头赛'), '　', h('span', { style: 'color:var(--ink3)' }, '锦标赛（未开）'))),
        // 中：海报
        h('div', { class: 'ab', style: 'left:300px;top:14px;width:680px;height:694px;background:var(--paper);box-shadow:6px 8px 0 rgba(0,0,0,.5);border:10px solid var(--paper);outline:3px solid var(--ink);outline-offset:-16px' }),
        ab(330, 44, 620, null, h('div', { style: 'text-align:center' },
          h('div', { class: 'c-kick', style: 'font-size:16px' }, `${D.place} · 蒸汽竞技大赛 · ${D.chapter.split(' · ')[0]}压轴`),
          h('div', { style: 'font:900 80px/1.1 var(--display);letter-spacing:.2em;margin:6px 0 6px;color:var(--red);text-shadow:3px 3px 0 var(--ink)' }, '大对决'),
          h('div', { style: 'font:italic 700 16px Georgia,serif;letter-spacing:.5em' }, 'GRAND MATCH'))),
        ab(350, 206, 220, null, h('div', { style: 'display:grid;justify-items:center;gap:4px' }, ovalCoal('你', 124, 148, 1.2), h('div', { class: 'c-head sm' }, '铁匠铺新人'), h('div', { style: 'font-size:13px' }, `一号原型机 · 评分 ${F.rating}`))),
        ab(710, 206, 220, null, h('div', { style: 'display:grid;justify-items:center;gap:4px' }, ovalCoal(foe.pilot, 124, 148, 1.2), h('div', { class: 'c-head sm' }, foe.pilot), h('div', { style: 'font-size:13px' }, `煤灰寡妇 · 评分 ${F.foeRating}`))),
        ab(598, 250, null, null, h('div', { class: 'c-seal', style: 'width:84px;height:84px;font-size:30px' }, '对')),
        ab(386, 412, null, null, eng(U.car('me'), 1)),
        ab(730, 411, null, null, eng(U.car('foe'), 1, true)),
        ab(330, 612, 620, null, h('div', { style: 'border-top:3px double var(--ink);border-bottom:3px double var(--ink);padding:5px 0;text-align:center;font:700 15px var(--display);letter-spacing:.1em' }, `场地：货箱　奖金：${money(foe.prize)}　声望 +1　另缴获一件`)),
        ab(420, 652, 440, null, h('div', { style: 'display:flex;justify-content:center;gap:16px' }, h('button', { class: 'c-btn red', style: 'font-size:20px' }, '今晚入场 · 出战', h('span', { class: 'no' }, 'No.042')))),
        // 右：档案 + 下注单
        h('div', { class: 'c-clip', style: 'left:1002px;top:36px;width:250px;rotate:1.5deg' },
          h('div', { class: 'c-head sm', style: 'text-align:center;letter-spacing:.2em;border-bottom:3px double var(--ink);padding-bottom:4px' }, '对手档案 · 独家'),
          D.foeTags.map(t => h('div', { class: 'c-body sm' }, '☞ ', t)),
          h('div', { class: 'c-body sm', style: 'margin-top:6px;color:var(--red);font-weight:900' }, '本报建议：顶上加甲，别追。'),
          h('div', { style: 'margin-top:8px' }, h('span', { class: 'c-link' }, '回车间对症改装 →'))),
        h('div', { class: 'c-clip', style: 'left:1010px;top:360px;width:236px;rotate:-1.5deg;background:#f6ecd0;border:2px dashed var(--ink)' },
          h('div', { class: 'c-head sm', style: 'text-align:center;letter-spacing:.2em' }, '下 注 单'),
          h('div', { class: 'c-body sm', style: 'text-align:center' }, '赔率 二赔一'),
          h('div', { style: 'display:flex;justify-content:center;gap:10px;margin-top:8px;font:700 14px var(--display)' }, h('span', {}, '○ 不下'), h('span', { style: 'color:var(--red)' }, '● £50'), h('span', {}, '○ £100'))),
        h('div', { class: 'c-clip', style: 'left:1010px;top:520px;width:236px;rotate:1deg' },
          h('div', { class: 'c-body sm' }, h('b', { style: 'color:var(--ink)' }, '操纵须知'), h('br'), 'A / D 行驶　鼠标瞄准', h('br'), '按住左键蓄准，松开开火', h('br'), '1～9 换武器'))),
    );
  }

  // ---------- 小组件 ----------
  function parts() {
    const box = (t, ...kids) => h('div', { style: 'display:grid;gap:8px;align-content:start' }, h('div', { class: 'c-kick' }, t), ...kids);
    return h('div', { class: 'pc sheet' },
      h('div', { class: 'row' },
        box('资源 · 报头耳框', h('div', { style: 'width:220px' }, ear())),
        box('材料 壹～陆', h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;max-width:430px' }, [1, 2, 3, 4, 5, 6].map(chip))),
        box('战斗顶条 · 记分牌', h('div', { class: 'c-score', style: 'width:520px' },
          h('div', { style: 'display:grid;gap:4px' }, bar({ name: '耐久', val: '1170', pct: .82 }), bar({ name: '热量', val: '46%', pct: .46 })),
          h('div', { class: 'clk' }, '87'),
          h('div', { style: 'display:grid;gap:4px' }, bar({ name: '耐久', val: '880', pct: .64 }), bar({ name: '热量', val: '30%', pct: .3 }))))),
      h('div', { class: 'row' },
        box('目录条目：有货 / 拿起 / 邮购', h('div', { style: 'width:420px' }, item(['boiler_s', 1, 1, 90]), item(['armor', 2, 1, 29], { sel: true, color: true }), item(['mortar_s', 1, 0, 140]))),
        box('悬停提示 · 脚注', h('div', { class: 'c-box', style: 'width:240px' }, h('div', { class: 'c-body sm' }, h('b', { style: 'color:var(--ink)' }, '小臼炮'), '　高抛，越过货箱砸顶。', h('br'), '伤害 14 · 装填 3.2 秒 · 半吨', h('br'), h('b', {}, '装上：火力 ▲　动力 ▼')))),
        box('提示条 · 电报', h('div', { class: 'c-tele' }, '电报：', h('b', {}, '缴获'), '熟铁锅炉 已入库 STOP'), h('div', { class: 'c-tele' }, '电报：此处', h('b', {}, '悬空'), '　下面要有车体 STOP'))),
      h('div', { class: 'row' },
        box('确认 / 资金不足 · 银行来信', h('div', { class: 'c-letter' }, h('div', { class: 'hd' }, '伦敦蒸汽银行'),
          '尊敬的先生：升级所需 £430，阁下账上 £240，尚差 ', h('b', { style: 'color:var(--red)' }, '£190'), '。本行可借 £200，每届锦标赛计息一成。',
          h('div', { style: 'display:flex;gap:12px;justify-content:flex-end;margin-top:12px' }, h('button', { class: 'c-btn sm' }, '婉拒'), h('button', { class: 'c-btn sm red' }, '借款并升级')))),
        box('缴获战利品', h('div', { class: 'c-box', style: 'width:470px' }, h('div', { class: 'h' }, '战 利 品 · 任 选 一 件'),
          h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px' }, [['mortar_s', 1], ['boiler_s', 2], ['armor', 2]].map(([id, mt], i) => h('div', { style: `display:grid;justify-items:center;gap:4px;padding:6px;${i === 0 ? 'outline:3px solid var(--red)' : ''}` }, i === 0 ? U.show(U.mod(id, mt), 1.5) : eng(U.mod(id, mt), 1.5), h('b', { style: 'font-size:13px' }, (mt > 1 ? SA.MATS[mt].name : '') + M[id].name), chip(mt)))),
          h('div', { style: 'text-align:right;margin-top:8px' }, h('button', { class: 'c-btn red sm' }, '拿走 小臼炮'))))));
  }

  U.add({ id: 'C', name: '蒸汽公报', tag: '印刷品 · 纸与墨 · 最会讲故事',
    pitch: '整个界面是维多利亚时代的印刷品。主页面是一份报纸头版：头条就是下一场比赛（对手是谁、她的车怕什么），右栏是「车间简讯」（你的车哪里有问题）和上期战报，底下的广告就是银行、街头赛、蓝图库的入口。改装台是一本摊开的零件邮购目录：左页是你的车（图版）和性能证书，右页是目录，书边的彩色索引标签就是类别。出战是一张拳赛式的对决海报，两边钉着赛程表、对手档案和下注单。',
    pros: ['最有个性、最不像别的游戏；每一场比赛都像一条新闻，剧情感强', '纸 + 墨 + 一个朱红，主操作永远最显眼', '铜版画滤镜直接读游戏精灵，拿起的零件恢复彩色，焦点很清楚'],
    cons: ['浅色纸面和游戏里的深色战斗场景反差最大', '书、报纸这种版式固定，屏幕比例变了（手机）要重新排', '目录一页放的零件少，零件多了要翻页'],
    notes: { home: '头条 = 下一场；右栏简讯 = 车况；底下广告 = 银行、街头赛、锦标赛、蓝图', garage: '书边彩色标签 = 类别；拿起的零件恢复彩色；①= 选中的模块', arena: '左：赛程剪报；右：对手档案、下注单、操纵须知' },
    lang, home, garage, arena, parts });
})();
