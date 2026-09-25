// 战役：进度、逐步解锁（功能 / 模块 / 材料 / 改装台大小）、每一关的对手、战后缴获、章节开场
// 数据在 content.js 的 SA.CAMPAIGN；存档在 SA.S.d.camp
window.SA = window.SA || {};

SA.Camp = (() => {
  const h = SA.h, M = SA.MODULES;
  const d = () => SA.S.d;
  const c = () => d().camp;

  const has = (f) => c().feat.includes(f);
  const hasMod = (id) => c().mods.includes(id);
  const hasAux = (k) => has('aux') && (c().aux || []).includes(k);
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
    return { ...o, ci, si, chapter: ch, vehicle: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || []) };
  }
  const current = () => (done() ? null : stage());

  // ---------- 解锁 ----------
  function applyUnlock(u, noIngots) {
    if (!u) return;
    const C = c();
    for (const f of u.feat || []) if (!C.feat.includes(f)) C.feat.push(f);
    for (const id of u.mods || []) if (!C.mods.includes(id)) C.mods.push(id);
    C.aux = C.aux || [];
    for (const k of u.aux || []) if (!C.aux.includes(k)) C.aux.push(k);
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
    if (u.aux && u.aux.length) out.push(`驾驶舱辅助设备：${u.aux.map(k => SA.AUX[k].name).join('、')}`);
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
    const name = (x) => (x.mt > 1 ? `${SA.MATS[x.mt].name}${M[x.id].name}` : M[x.id].name);
    SA.UI.dialog('缴获战利品', [
      h('p', { style: 'margin-top:0' }, '按赛会规矩，胜者可以从对手车上拆走一件你还没有的零件：'),
      h('div', { class: 'salvage' }, opts.map(x => h('div', { class: 'dlg-item' }, SA.SPR.moduleCanvas(x.id, 1, x.mt),
        h('div', {}, h('b', {}, name(x)), ' ', matChip(x.mt), h('div', { class: 'muted' }, SA.UI.statLine(x.id, x.mt)))))),
    ], opts.map(x => ({ label: `拿走 ${name(x)}`, primary: x.mt >= 5, onClick: () => {
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
      row(sel, act('跳到这一章', () => dev.goto(+sel.value)), act('清空存档重来', () => SA.reset()))));
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
    panel: devPanel,
  };

  return { backfill, owns, salvageOptions, has, hasMod, hasAux, maxMat, grid, done, chIndex, syncLim, stage, current, win, applyUnlock, unlockLines, salvageDialog, unlockDialog, introIfNew, matChip, dev };
})();
SA.dev = SA.Camp.dev;
