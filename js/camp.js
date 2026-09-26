// 战役规则：进度、逐步解锁（功能 / 模块 / 材料 / 改装台大小）、每一关的对手、战后缴获和章节介绍进度
// 数据在 content.js 的 SA.CAMPAIGN；存档在 SA.S.d.camp
window.SA = window.SA || {};

SA.Camp = (() => {
  const M = SA.MODULES;
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

  // 试驾场临时换材料仍由规则层重算耐久；界面只传入材料等级，不直接改车格。
  function prepareTrialVehicle(v, mt) {
    if (!v || !mt) return v;
    SA.V.each(v, (cell) => { cell.mt = mt; cell.hp = SA.mod(cell).hp; });
    return v;
  }

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

  // ---------- 竞技场外遭遇战（K6） ----------
  function sideEntries() {
    const C = c();
    return (SA.SIDE_ENCOUNTERS || []).filter(e => C.ch >= (e.chapter || 1)).map(e => ({
      ...e, vehicle: SA.V.fromAscii(e.name, e.rows, e.sides || [], e.mt || 1, e.elite || [], e.subs || []),
      won: !!C.sideWins[e.id],
    }));
  }
  function sideWin(id) {
    const C = c();
    if (!C.sideWins) C.sideWins = {};
    if (C.sideWins[id]) return false;
    C.sideWins[id] = { at: Date.now() };
    return true;
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
  // 章节介绍的进度只由规则层写入；界面取得待展示章节后原样绘制。
  function takeIntro() {
    const C = c();
    if (done() || C.intro >= C.ch) return null;
    C.intro = C.ch;
    SA.S.save();
    return SA.CAMPAIGN[C.ch];
  }

  // 缴获选择的唯一件检查与入库集中在规则层，失败时不重复发放。
  function claimSalvage(x) {
    if (x.unique && !SA.S.claimUnique(x.unique.id, x.mt, x.unique.source || 'salvage')) return false;
    SA.S.addInv(x.id, 1, x.mt);
    return true;
  }

  // 保留旧公共入口；界面模块在 camp.js 之后加载，调用时再转交。
  const salvageDialog = (...args) => SA.CampUI.salvageDialog(...args);
  const unlockDialog = (...args) => SA.CampUI.unlockDialog(...args);
  const introIfNew = (...args) => SA.CampUI.introIfNew(...args);
  const matChip = (...args) => SA.CampUI.matChip(...args);

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
    sandbox: (...args) => SA.CampUI.sandbox(...args),
    drive: (...args) => SA.CampUI.drive(...args),
    panel: (...args) => SA.CampUI.devPanel(...args),
  };

  return { backfill, owns, sideEntries, sideWin, salvageOptions, has, hasMod, maxMat, grid, done, chIndex, syncLim, stage, current, prepareTrialVehicle, win, applyUnlock, unlockLines, takeIntro, claimSalvage, salvageDialog, unlockDialog, introIfNew, matChip, dev };
})();
SA.dev = SA.Camp.dev;
