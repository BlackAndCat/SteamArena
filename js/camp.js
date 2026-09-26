// 战役：进度、逐步解锁（功能 / 模块 / 材料 / 改装台大小）、每一关的对手、战后缴获、章节开场
// 数据在 content.js 的 SA.CAMPAIGN；存档在 SA.S.d.camp
window.SA = window.SA || {};

SA.Camp = (() => {
  const h = SA.h, M = SA.MODULES;
  const d = () => SA.S.d;
  const c = () => d().camp;

  const has = (f) => c().feat.includes(f);
  const hasMod = (id) => c().mods.includes(id);
  const maxMat = () => c().mat;
  const grid = () => c().grid;
  const done = () => !!c().done;
  // 当前章节序号（通关后停在最后一章）
  const chIndex = () => Math.min(c().ch, SA.CAMPAIGN.length - 1);

  // 玩家的车带上改装台大小，编辑器和出战检查都按它限制可用格子
  function syncLim() { if (d() && d().vehicle) d().vehicle.lim = { ...grid() }; }

  // 第 ci 章第 si 关的对手
  function stage(ci = c().ch, si = c().st) {
    const ch = SA.CAMPAIGN[ci], o = ch && ch.stages[si];
    if (!o) return null;
    return { ...o, ci, si, chapter: ch, vehicle: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []) };
  }
  const current = () => (done() ? null : stage());

  // ---------- 解锁 ----------
  function applyUnlock(u, noIngots) {
    if (!u) return;
    const C = c();
    for (const f of u.feat || []) if (!C.feat.includes(f)) C.feat.push(f);
    for (const id of u.mods || []) if (!C.mods.includes(id)) C.mods.push(id);
    if (u.mat) C.mat = Math.max(C.mat, u.mat);
    if (u.grid) C.grid = { ...u.grid };
    if (!noIngots) SA.S.addIngots(u.ingots);
    syncLim();
  }
  // 读档时补发：已经打过的关卡 / 章节，按现在的数据重新发一遍解锁（以后新加的解锁内容老存档也能拿到；锭不重复发）
  function backfill() {
    const C = c();
    SA.CAMPAIGN.forEach((ch, ci) => {
      ch.stages.forEach((s, si) => { if (C.done || ci < C.ch || (ci === C.ch && si < C.st)) applyUnlock(s.unlock, true); });
      if (C.done || ci < C.ch) applyUnlock(ch.unlock, true);
    });
  }
  function unlockLines(u) {
    const out = [];
    if (u.grid) out.push(`改装台扩建到 ${u.grid.cols} 列 × ${u.grid.rows} 层`);
    if (u.mat) out.push(`材料「${SA.MATS[u.mat].name}」：属性 ×${SA.MATS[u.mat].mul}，选中车上的模块即可升级`);
    if (u.mods && u.mods.length) out.push(`新模块：${u.mods.map(id => M[id].name).join('、')}`);
    if (u.feat && u.feat.length) out.push(`新功能：${u.feat.map(f => SA.FEATURES[f]).join('、')}`);
    for (const k in u.ingots || {}) out.push(`${SA.INGOTS[k].name} ×${u.ingots[k]}`);
    return out;
  }

  // 赢下当前这一关：推进进度、发放解锁与掉落。返回 { lines, unlocks: [{ title, u }] }
  function win() {
    const C = c(), st = current();
    const out = { lines: [], unlocks: [] };
    if (!st) return out;
    if (st.unlock) { applyUnlock(st.unlock); out.unlocks.push({ title: '新功能开放', u: st.unlock }); }
    if (st.drop) {
      SA.S.addIngots(st.drop);
      for (const k in st.drop) out.lines.push(`掉落 ${SA.INGOTS[k].name} ×${st.drop[k]}`);
    }
    C.st++;
    if (C.st >= st.chapter.stages.length) {
      applyUnlock(st.chapter.unlock);
      out.unlocks.push({ title: `${st.chapter.name} · 通关`, u: st.chapter.unlock });
      if (C.ch + 1 >= SA.CAMPAIGN.length) { C.done = true; C.st = st.chapter.stages.length; }
      else { C.ch++; C.st = 0; }
    }
    return out;
  }

  // ---------- 缴获：只在战役 / 终局锦标赛赢了之后，从对手还完好的模块里挑一件 ----------
  // 候选只有两种：你还没有的（车上和库存里都没有这种模块，或者只有更差的材料），以及史诗 / 传奇的特殊件
  // 史诗 / 传奇件排在前面，其余随机，最多 3 件，同款同材料不重复
  function owns(id, mt) {
    let yes = false;
    SA.V.each(d().vehicle, (cell) => { if (cell.id === id && (cell.mt || 1) >= mt) yes = true; });
    for (const k in d().inv) { const p = SA.parseKey(k); if (p.id === id && p.mt >= mt && d().inv[k] > 0) yes = true; }
    return yes;
  }
  function salvageOptions(survivors) {
    const seen = new Set(), pool = [];
    for (const x of survivors) {
      const unique = x.unique ? { ...SA.uniqueRule(x.id), ...x.unique, id: x.id } : SA.uniqueRule(x.id);
      if (unique && unique.once !== false) {
        if (SA.S.hasUnique(unique.id)) continue;
        const key = `unique:${unique.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push({ ...x, id: unique.id, mt: unique.mt || x.mt || 5, unique });
        continue;
      }
      const k = SA.invKey(x.id, x.mt);
      if (seen.has(k) || (x.mt < 5 && owns(x.id, x.mt))) continue;
      seen.add(k); pool.push(x);
    }
    pool.sort(() => Math.random() - 0.5);
    pool.sort((a, b) => (b.mt >= 5) - (a.mt >= 5));
    return pool.slice(0, 3);
  }
  function salvageDialog(survivors, next) {
    const opts = salvageOptions(survivors);
    if (!opts.length) { next(); return; }
    const name = (x) => `${x.unique ? '唯一件 · ' : ''}${x.mt > 1 ? `${SA.MATS[x.mt].name}${M[x.id].name}` : M[x.id].name}`;
    SA.UI.dialog('缴获战利品', [
      h('p', { style: 'margin-top:0' }, '按赛会规矩，胜者可以从对手车上拆走一件你还没有的零件：'),
      h('div', { class: 'salvage' }, opts.map(x => h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(x.id, 1, x.mt),
        h('div', {}, h('b', {}, name(x)), ' ', matChip(x.mt), h('div', { class: 'muted' }, SA.UI.statLine(x.id, x.mt)))))),
    ], opts.map(x => ({ label: `拿走 ${name(x)}`, primary: x.mt >= 5, onClick: () => {
      if (x.unique && !SA.S.claimUnique(x.unique.id, x.mt, x.unique.source || 'salvage')) { SA.UI.toast(`${name(x)}已经领取过了`); next(); return; }
      SA.S.addInv(x.id, 1, x.mt);
      SA.UI.toast(`缴获 ${name(x)}，放进库存`);
      next();
    } })), false, next);
  }

  function unlockDialog({ title, u }, next) {
    const lines = unlockLines(u);
    if (!lines.length && !u.note) { next(); return; }
    SA.UI.dialog(title, [
      u.note ? h('p', { style: 'margin-top:0' }, u.note) : null,
      h('div', { class: 'unlocks' }, lines.map(l => h('div', { class: 'warn', style: 'border-left-color:var(--gauge2)' }, l))),
    ], [{ label: '好', primary: true, onClick: next }], false, next);
  }

  // 章节开场：进入出战页时，新章节先弹一次介绍
  function introIfNew() {
    const C = c();
    if (done() || C.intro >= C.ch) return false;
    C.intro = C.ch;
    SA.S.save();
    const ch = SA.CAMPAIGN[C.ch];
    SA.UI.dialog(ch.name, [
      h('p', { style: 'margin-top:0' }, ch.blurb),
      h('div', { class: 'unlocks' }, ch.stages.map((s, i) => h('div', { class: 'warn', style: 'border-left-color:var(--brass2)' },
        h('b', {}, `第 ${i + 1} 场 · ${s.name}`), s.boss ? ' 【Boss】' : '', h('span', { class: 'muted' }, ` · ${s.pilot}`)))),
      h('p', { class: 'muted' }, '每一场都是一道构筑题：点对手看它的车和弱点，再回车间对症改装。'),
    ], [{ label: '出发', primary: true, onClick: () => {} }], false);
    return true;
  }

  const matChip = (mt) => h('span', { class: 'chip mat', style: `--mat:${SA.MATS[mt].chip}` }, SA.MATS[mt].rank ? `${SA.MATS[mt].rank} · ${SA.MATS[mt].name}` : SA.MATS[mt].name);

  // ---------- 调试（控制台）----------
  // SA.dev.goto(3)：直接跳到第 3 章开头（前面各章的解锁全部发放）；SA.dev.unlockAll()：全部解锁；SA.dev.money(n)
  // 开发者面板：侧边栏底部的「开发者」按钮。上面是开发工具（新标签页打开），下面是存档调试
  // 新做的工具页 / 预览页加到 DEV_TOOLS 里就会出现在面板上
  const DEV_TOOLS = [
    { url: 'tools/sim.html', name: '数值自测', desc: 'AI 对 AI 批量对打：战役关卡检验、对战矩阵 + 评分校准、模块性价比' },
    { url: 'tools/evolve.html', name: '进化报告', desc: '关卡车进化生成器的结果：选关、强度 × 表现散点图、分类网格、毒瘤车与奇特构筑，可复现、可试驾' },
    { url: 'tools/suspension-lab.html', name: '悬挂与爬坡样机', desc: '履带 / 四足 / 双足过坡：刚体 vs 悬挂（轮组、脚各自伸缩贴地），带悬空统计' },
    { url: 'tools/terrain-lab.html', name: '地形美术样机', desc: '土坡、泥地、货箱各阶段、碎木，以及坡上的车身倾斜（像素画法规则）' },
    { url: 'tools/spritesheet.html', name: '模块精灵表', desc: '全部模块的像素图、整车渲染、炮管后坐与供弹动态帧' },
    { url: 'tools/mech-kit.html', name: '机甲套件', desc: '全局子格套件：双足 / 履带 / 蜘蛛共用部件与挂载层的视觉验证' },
    { url: 'tools/biped-v2.html', name: '真双足样机', desc: '一对腿 + 陀螺仪平衡系统的视觉语言样机' },
    { url: 'tools/biped-lab.html', name: '双足设计探索', desc: '双足底盘升级版：六档品质 + 探索版腿型' },
  ];
  function devPanel() {
    const act = (label, fn, primary) => h('button', { class: `btn ${primary ? 'primary' : ''}`, onclick: () => { SA.UI.closeModal(); fn(); SA.UI.toast(label); } }, label);
    const sel = h('select', {}, SA.CAMPAIGN.map((ch, i) => h('option', { value: i, selected: i === chIndex() }, ch.name)));
    const row = (...kids) => h('div', { class: 'dialog-actions dev-row' }, kids);
    SA.UI.openModal('开发者模式', h('div', { class: 'dev-panel' },
      h('h3', { class: 'help-h' }, '开发工具 · 新标签页打开'),
      h('div', { class: 'dev-tools' }, DEV_TOOLS.map(t => h('a', { class: 'dev-tool', href: t.url, target: '_blank', rel: 'noopener' },
        h('b', {}, t.name, h('span', { class: 'ext' }, ' ↗')), h('span', { class: 'muted' }, t.desc)))),
      h('h3', { class: 'help-h' }, '存档调试 · 直接改存档'),
      row(act('一键全部解锁', () => { dev.unlockAll(); dev.money(10000); dev.ingots(5); }, true),
        act('+£1000', () => dev.money(1000)),
        act('乌兹钢锭 / 以太结晶 +3', () => dev.ingots(3))),
      row(sel, act('跳到这一章', () => dev.goto(+sel.value)), act('清空存档重来', () => SA.reset())),
      h('h3', { class: 'help-h' }, '试驾场 · 不结算、不留损伤'),
      row(h('button', { class: 'btn primary', onclick: sandbox }, '打开试驾场'), h('span', { class: 'muted' }, '任选场地、对手、对手材料 / 性格 / 枪法，用你现在的车打一场'))));
  }

  // ---------- 试驾场：任选场地和对手 ----------
  // 对手来源：战役各关 / 终局锦标赛 / 官方蓝图 / 我的蓝图 / 云车库 / 随机街头车；可以改材料、AI 性格、枪法。友谊赛：不结算、不留损伤
  const SB = { src: 'camp', foe: '1,0', terrain: '', mt: 0, style: '', aim: '' };   // 记住上一次的选择
  const SRC = [['camp', '战役各关'], ['tour', '终局锦标赛'], ['bp', '官方蓝图'], ['mine', '我的蓝图'], ['cloud', '云车库'], ['evolve', '进化报告'], ['street', '随机街头车']];
  const STYLES = [['', '按对手默认'], ['roam', '游走'], ['rush', '冲锋'], ['kite', '放风筝'], ['turtle', '龟缩']];
  // 某个来源的对手列表：{ key, name, make() → { v, aim, style, terrain, boss } }
  function foeList(src) {
    if (src === 'camp') return SA.CAMPAIGN.flatMap((ch, ci) => ch.stages.map((o, si) => ({ key: `${ci},${si}`, name: `${ch.name.split(' · ')[0]} · ${o.name}${o.boss ? '【Boss】' : ''}`,
      make: () => ({ v: stage(ci, si).vehicle, aim: o.aim, style: o.style, terrain: o.terrain, boss: o.boss }) })));
    if (src === 'tour') return SA.OPPONENTS.map((o, i) => ({ key: String(i), name: `第 ${i + 1} 轮 · ${o.name}`,
      make: () => { const op = SA.S.opponent(i); return { v: op.vehicle, aim: op.aim, terrain: SA.TERRAIN_ORDER[i % SA.TERRAIN_ORDER.length], boss: i === SA.OPPONENTS.length - 1 }; } }));
    if (src === 'bp') return SA.OFFICIAL_BLUEPRINTS.map((b, i) => ({ key: String(i), name: b.name, make: () => ({ v: SA.V.fromAscii(b.name, b.rows, b.sides || []), aim: 0.8 }) }));
    if (src === 'mine') return SA.Blueprints.mine().map((b, i) => ({ key: String(i), name: b.name, make: () => ({ v: SA.V.fromLayout(b.name, b), aim: 0.8 }) }));
    if (src === 'cloud') return SA.S.Cloud.list().map((e, i) => ({ key: String(i), name: `${e.name} · ${e.author}`, make: () => ({ v: SA.V.decode(e.code), aim: 0.85 }) }));
    // 进化报告页（tools/evolve.html）点"去试驾场和它打一场"时存进来的车，最新的在前
    if (src === 'evolve') {
      let picks = [];
      try { picks = JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []; } catch (e) { picks = []; }
      return picks.map((p, i) => ({ key: String(i), name: p.from ? `${p.name}（${p.from}）` : p.name,
        make: () => ({ v: p.cells ? SA.V.fromCells(p.name, p.cells) : SA.V.decode(p.code), aim: 0.8, style: p.style && p.style !== 'wander' ? p.style : null, terrain: p.terrain }) }));
    }
    return [{ key: 'rand', name: '随手拼一台（每次都不一样）', make: () => { let v = null; for (let k = 0; k < 50 && !v; k++) v = SA.Street.build('街头小车', Math.random() < 0.5); return { v, aim: 0.65 }; } }];
  }
  // src：直接打开某个对手来源（进化报告页跳过来时用 'evolve'，并选中最新的那台）
  function sandbox(src) {
    if (src && SRC.some(([k]) => k === src)) { SB.src = src; SB.foe = '0'; }
    const list = () => foeList(SB.src);
    if (!list().some(f => f.key === SB.foe)) SB.foe = (list()[0] || {}).key;
    const sel = (opts, cur, onchange) => h('select', { onchange: (e) => { onchange(e.target.value); draw(); } }, opts.map(([v, n]) => h('option', { value: v, selected: String(v) === String(cur) }, n)));
    const body = h('div', { class: 'sandbox' });
    let foe = null;   // 当前预览的对手（开打时直接用它，随机街头车也是看到的这台）
    function build() {
      const f = list().find(x => x.key === SB.foe);
      const r = f && f.make();
      if (!r || !r.v) return null;
      if (+SB.mt) SA.V.each(r.v, (cell) => { cell.mt = +SB.mt; cell.hp = SA.mod(cell).hp; });   // 统一换材料
      return { ...r, name: f.name.replace(/^.* · /, '').replace('【Boss】', ''), terrain: SB.terrain || r.terrain || 'flat',
        style: SB.style ? (SB.style === 'roam' ? null : SB.style) : r.style, aim: SB.aim ? +SB.aim : r.aim };
    }
    function draw(keepFoe) {
      if (!keepFoe) foe = build();
      body.innerHTML = '';
      const L = list();
      const field = (label, el) => h('label', { class: 'sb-field' }, h('span', { class: 'muted' }, label), el);
      body.append(h('div', { class: 'sb-grid' },
        field('对手来源', sel(SRC, SB.src, (v) => { SB.src = v; SB.foe = (foeList(v)[0] || {}).key; })),
        field('对手', L.length ? sel(L.map(f => [f.key, f.name]), SB.foe, (v) => { SB.foe = v; }) : h('span', { class: 'muted' }, '这里还没有车')),
        field('场地', sel([['', '按对手默认'], ...SA.TERRAIN_ORDER.map(k => [k, SA.TERRAINS[k].name])], SB.terrain, (v) => { SB.terrain = v; })),
        field('对手材料', sel([[0, '保持原样'], ...SA.MATS.slice(1).map((m, i) => [i + 1, m.rank ? `${m.rank} · ${m.name}` : m.name])], SB.mt, (v) => { SB.mt = +v; })),
        field('AI 性格', sel(STYLES, SB.style, (v) => { SB.style = v; })),
        field('对手枪法', sel([['', '按对手默认'], ...[0.3, 0.5, 0.65, 0.8, 0.9, 1].map(a => [a, `瞄准 ${a}`])], SB.aim, (v) => { SB.aim = v; }))));
      if (!foe) { body.append(h('p', { class: 'muted' }, '选一个对手')); return; }
      const t = SA.TERRAINS[foe.terrain], st = SA.V.stats(foe.v), me = SA.V.stats(d().vehicle);
      body.append(h('div', { class: 'sb-preview' },
        h('div', { class: 'vs-pic' }, (() => { const cv = SA.UI.vehiclePreview(foe.v, 2); cv.style.transform = 'scaleX(-1)'; return cv; })()),
        h('div', { class: 'sb-info' },
          h('b', {}, foe.name, foe.boss ? ' 【Boss】' : ''),
          h('div', {}, h('span', { class: 'chip' }, `评分 ${st.rating}`), ' ', h('span', { class: 'chip' }, `你的车 ${me.rating}`), ' ',
            h('span', { class: 'chip' }, `性格 ${(STYLES.find(x => x[0] === (foe.style || 'roam')) || STYLES[1])[1]}`), ' ', h('span', { class: 'chip' }, `瞄准 ${foe.aim}`)),
          h('div', { class: 'terrain-note' }, h('b', {}, `场地 · ${t.name}`), h('span', { class: 'muted' }, t.desc)),
          !me.canDeploy ? h('div', { class: 'warn bad' }, `你的车还不能出战：${me.problems[0]}`) : null)),
        h('div', { class: 'dialog-actions', style: 'padding:10px 0 0;justify-content:flex-start' },
          h('button', { class: 'btn primary', disabled: !me.canDeploy, onclick: () => {
            SA.UI.closeModal();
            SA.Battle.start({ mode: 'friendly', enemyVehicle: foe.v, enemyName: foe.name, aim: foe.aim, style: foe.style, terrain: foe.terrain, boss: foe.boss, hpMul: 1 });
          } }, '开打'),
          SB.src === 'street' ? h('button', { class: 'btn', onclick: () => draw() }, '换一台') : null));
    }
    SA.UI.openModal('试驾场', body);
    draw();
  }

  const dev = {
    goto(ci) {
      const C = c();
      for (let i = 0; i < ci && i < SA.CAMPAIGN.length; i++) {
        for (const s of SA.CAMPAIGN[i].stages) applyUnlock(s.unlock);
        applyUnlock(SA.CAMPAIGN[i].unlock);
      }
      Object.assign(C, { ch: Math.min(ci, SA.CAMPAIGN.length - 1), st: 0, intro: -1, done: ci >= SA.CAMPAIGN.length });
      SA.S.save(); SA.nav('arena');
    },
    unlockAll() { dev.goto(SA.CAMPAIGN.length); },
    money(n = 1000) { d().money += n; SA.S.save(); SA.UI.topbar(); },
    ingots(n = 3) { SA.S.addIngots({ wootz: n, aether: n }); SA.S.save(); SA.UI.topbar(); },
    sandbox,
    // 在指定地形上和某一关的对手打一场友谊赛（不结算、不留损伤）；控制台用
    drive(terrain = 'crates', foe = '1,0') {
      const [ci, si] = String(foe).split(',').map(Number), st = stage(ci, si);
      if (!st) return;
      SA.Battle.start({ mode: 'friendly', enemyVehicle: st.vehicle, enemyName: st.name, aim: st.aim, style: st.style, terrain, hpMul: 1 });
    },
    panel: devPanel,
  };

  return { backfill, owns, salvageOptions, has, hasMod, maxMat, grid, done, chIndex, syncLim, stage, current, win, applyUnlock, unlockLines, salvageDialog, unlockDialog, introIfNew, matChip, dev };
})();
SA.dev = SA.Camp.dev;
