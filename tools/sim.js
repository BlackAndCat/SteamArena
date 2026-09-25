// 数值自测：无画面 AI 对 AI 批量对打（SA.Battle.simulate），检验战役节奏、对战胜率、评分校准和模块性价比
// 不读写玩家存档（只在「加入我的车」时只读一次）
(() => {
  const h = SA.h, M = SA.MODULES;
  const $ = (s) => document.querySelector(s);
  const out = $('#out');

  // 每章的「参考玩家车」：玩家打这一章时、用前面各章的解锁能造出来的一台正常水平的车
  // 第 n 章的检验 = REF[n] 打本章各关（应该大多能赢）+ REF[n-1] 打本章 Boss（应该很难赢，逼玩家升级）
  const REF = [
    { name: '序章 · 原型机', grid: [4, 3], mt: 1, rows: ['........', '........', '........', '...KC...', '...OWA..', '...TTT..'] },
    { name: '一章 · 装甲炮车', grid: [5, 3], mt: 1, rows: ['........', '........', '........', '...KC...', '..WOAA..', '..TTTT..'], subs: [[5, 6, 'cannon_s']] },
    { name: '二章 · 熟铁四层', grid: [5, 4], mt: 2, rows: ['........', '........', '...C....', '..KAM...', '.WOOHH..', '.QQQQQ..'], subs: [[2, 6, 'tank_tall'], [8, 12, 'periscope'], [8, 13, 'autoloader']] },
    { name: '三章 · 钢撞角双足', grid: [6, 4], mt: 3, style: 'rush', rows: ['........', '........', '...C....', '..KAM...', '..OWAHX.', '..BBBB..'], subs: [[3, 5, 'condenser'], [1, 5, 'pressure_chamber'], [6, 10, 'mortar_s']] },
    { name: '四章 · 镀镍炮垒', grid: [6, 5], mt: 4, style: 'rush', rows: ['........', '...P....', '..KAC...', '.WOAHH..', '.WOOHAY.', '.TTTTTT.'], sides: [[3, 3], [3, 4]], subs: [[6, 12, 'steamjet'], [8, 14, 'gyroscope'], [8, 15, 'rangefinder']] },
    { name: '五章 · 镀镍 + 史诗', grid: [7, 5], mt: 4, rows: ['........', '...P....', '..VKAC..', 'WWOAHH..', 'WOOHHAY.', 'TTTTTTT.'], sides: [[3, 3], [3, 4], [4, 3]], elite: [[2, 5, 5], [1, 3, 5]], subs: [[0, 6, 'pressure_tank'], [0, 4, 'radiator'], [4, 12, 'rocket_rack'], [6, 14, 'flamer'], [8, 14, 'harpoon']] },
  ];
  // 联合驾驶舱第四章通关才解锁：前面几章的参考车把 K 换成 1×1 驾驶舱（车头下角）+ 三块甲片，占格不变
  const soloK = (rows) => {
    const subs = [];
    rows = rows.map((row, R) => row.replace(/K/g, (m, C) => { subs.push([2 * R + 1, 2 * C + 1, 'helmet'], [2 * R, 2 * C, 'plate'], [2 * R, 2 * C + 1, 'plate'], [2 * R + 1, 2 * C, 'plate']); return '.'; }));
    return { rows, subs };
  };
  const refVeh = (r, ci = REF.indexOf(r)) => {
    // 序章到第四章的参考车都用 1×1 驾驶舱 + 甲片，避免提前使用第四章才解锁的联合驾驶舱。
    const k = (r._solo || (ci >= 0 && ci < 5)) ? soloK(r.rows) : { rows: r.rows, subs: [] };
    return SA.V.fromAscii(r.name, k.rows, r.sides || [], r.mt, r.elite || [], k.subs.concat(r.subs || []));
  };
  const rating = (v) => SA.V.stats(v).rating;
  const pct = (x) => `${Math.round(x * 100)}%`;
  // 机制贡献是可解释的纸面指标：把齐射、溅射、持续伤害 / 升温、牵引和辅助倍率换算成同一列，
  // 只用于检查新模块确实进入数值链路，不替代战斗模拟中的实际命中统计。
  const mechanismValue = (m) => {
    let x = 0;
    if (m.salvo > 1) x += (m.salvo - 1) * (m.dmg || 0) / Math.max(0.1, m.reload || 1);
    if (m.indirect) x += 1;
    if (m.reload && m.reload < SA.K.FAST_RELOAD) x += (SA.K.FAST_RELOAD - m.reload) * 2;
    if (m.splash) x += (m.dmg || 0) * m.splash.k * Math.PI * m.splash.r * m.splash.r / (SA.K.CELL * SA.K.CELL) * 0.08 / Math.max(0.1, m.reload || 1);
    x += (m.dmgPerSec || 0) + (m.heatToEnemy || 0) * 0.5 + (m.tether || 0) / 10;
    x += (m.store || 0) * 0.15 + (m.dryCool || 0) + (m.waterSave ? (1 - m.waterSave) * 8 : 0);
    x += (m.ram || 0) / 10 + (m.punch || 0) / 10 + (m.heatMul ? (1 - m.heatMul) * 10 : 0);
    x += m.reloadMul ? (1 - m.reloadMul) * 10 : 0;
    x += m.spreadMul ? (1 - m.spreadMul) * 8 : 0;
    x += m.swayMul ? (1 - m.swayMul) * 8 : 0;
    x += (m.aimSpeed || 0) * 4 + (m.aimShrink || 0) * 8;
    return x;
  };
  const interval = (wins, n) => {
    if (!n) return [0, 1];
    const z = 1.96, p = wins / n, z2 = z * z, den = 1 + z2 / n;
    const mid = p + z2 / (2 * n), span = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return [Math.max(0, (mid - span) / den), Math.min(1, (mid + span) / den)];
  };
  const range = (wins, n) => { const [lo, hi] = interval(wins, n); return `${pct(lo)}–${pct(hi)}`; };
  const opt = () => ({ n: Math.max(2, +$('#games').value || 50), aim: +$('#aim').value || 0.8 });
  let effectTotals = null;
  const mergeEffects = (source) => {
    if (!effectTotals || !source) return;
    for (const [id, v] of Object.entries(source)) {
      const e = effectTotals[id] || (effectTotals[id] = { active: 0, fire: 0, hit: 0, tether: 0, energy: 0, waterSaved: 0, dryCool: 0 });
      for (const k of Object.keys(e)) e[k] += v[k] || 0;
    }
  };

  // 只累计在当前关卡开始前已经发放的模块；关卡自己的 unlock 要等赢下本关后才生效。
  const availableMods = (ci, si = 0) => {
    const got = new Set(SA.CAMP_START.mods || []);
    SA.CAMPAIGN.forEach((ch, c) => {
      if (c > ci) return;
      ch.stages.forEach((stage, s) => {
        if (c < ci || (c === ci && s < si)) for (const id of stage.unlock?.mods || []) got.add(id);
      });
      if (c < ci) for (const id of ch.unlock?.mods || []) got.add(id);
    });
    return got;
  };
  const vehicleIds = (v) => { const out = new Set(); SA.V.each(v, (cell) => out.add(cell.id)); return out; };
  const missingMods = (v, ci, si) => [...vehicleIds(v)].filter(id => !availableMods(ci, si).has(id));

  // ---------- 调度：分帧跑，页面不卡 ----------
  let running = false;
  function runJobs(jobs, onDone) {
    if (running) return;
    running = true;
    const bar = $('#bar'), label = $('#prog');
    let i = 0;
    const t0 = performance.now();
    const tick = () => {
      const end = performance.now() + 40;
      while (i < jobs.length && performance.now() < end) jobs[i++]();
      bar.style.width = `${(i / jobs.length) * 100}%`;
      label.textContent = `${i} / ${jobs.length} 局 · ${((performance.now() - t0) / 1000).toFixed(1)} 秒`;
      if (i < jobs.length) setTimeout(tick, 0);   // 不用 rAF：标签页在后台时也继续跑
      else { running = false; onDone(); }
    };
    tick();
  }
  // a 对 b 打 n 局，结果累加到 acc
  function duel(acc, a, b) {
    return () => {
      const r = SA.Battle.simulate({ p: a.v, e: b.v, pAim: a.aim, eAim: b.aim, pStyle: a.style, eStyle: b.style, eBoss: b.boss, terrain: b.terrain || a.terrain || $('#ter').value || 'flat' });
      acc.n++; acc.t += r.t;
      if (r.winner === 'p') acc.w++; else if (r.winner === 'draw') acc.d++;
      const who = r.winner === 'p' ? '对方' : r.winner === 'e' ? '我方' : '平手';
      acc.reasons[`${who}：${r.reason}`] = (acc.reasons[`${who}：${r.reason}`] || 0) + 1;
      if (r.winner === 'p') acc.fail.enemy++; else if (r.winner === 'e') acc.fail.our++; else if (/双方|同时/.test(r.reason || '')) acc.fail.both++; else acc.fail.draw++;
      mergeEffects(r.effectStats?.p); mergeEffects(r.effectStats?.e);
    };
  }
  const blank = () => ({ n: 0, w: 0, d: 0, t: 0, reasons: {}, fail: { our: 0, enemy: 0, both: 0, draw: 0 } });

  // ---------- 1. 战役关卡检验 ----------
  // 合格线（见 docs/game-design.md）：本章参考车打普通关 ≥ 70%，打 Boss 60–70%；上一章参考车打 Boss < 30%
  function campaign() {
    const { n, aim } = opt();
    effectTotals = Object.fromEntries(SA.MODULE_ORDER.map(id => [id, { active: 0, fire: 0, hit: 0, tether: 0, energy: 0, waterSaved: 0, dryCool: 0 }]));
    const rows = [], jobs = [];
    SA.CAMPAIGN.forEach((ch, ci) => ch.stages.forEach((o, si) => {
      const ev = SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []);
      const e = { v: ev, aim: o.aim, style: o.style, boss: o.boss, terrain: $('#ter').value || o.terrain || 'flat' };
      const cur = REF[ci], prev = REF[ci - 1];
      const curVeh = refVeh(cur), missing = missingMods(curVeh, ci, si);
      const row = { ci, si, o, er: rating(ev), cur: blank(), prev: prev && o.boss ? blank() : null, missing };
      for (let k = 0; k < n; k++) jobs.push(duel(row.cur, { v: curVeh, aim, style: cur.style }, e));
      if (row.prev) for (let k = 0; k < n; k++) jobs.push(duel(row.prev, { v: refVeh(prev), aim, style: prev.style }, e));
      rows.push(row);
    }));
    runJobs(jobs, () => {
      const band = (row, w) => (row.o.boss ? (w >= 0.6 && w <= 0.7 ? 'ok' : w > 0.85 || w < 0.4 ? 'bad' : 'meh') : (w >= 0.7 ? 'ok' : w >= 0.5 ? 'meh' : 'bad'));
      const normal = rows.filter(r => !r.o.boss);
      const bosses = rows.filter(r => r.o.boss);
      const normalPass = normal.filter(r => r.cur.w / Math.max(1, r.cur.n) >= 0.7).length;
      const bossBand = bosses.filter(r => { const w = r.cur.w / Math.max(1, r.cur.n); return w >= 0.6 && w <= 0.7; }).length;
      const prevBoss = bosses.filter(r => r.prev).map(r => r.prev.w / Math.max(1, r.prev.n));
      const prevPass = prevBoss.length ? prevBoss.filter(w => w < 0.3).length : 0;
      const totalN = rows.reduce((s, r) => s + r.cur.n, 0);
      const totalD = rows.reduce((s, r) => s + r.cur.d, 0);
      const totalT = rows.reduce((s, r) => s + r.cur.t, 0);
      const heatN = rows.reduce((s, r) => s + Object.entries(r.cur.reasons).filter(([k]) => /烧干|热量/.test(k)).reduce((n2, [, v]) => n2 + v, 0), 0);
      const fail = rows.reduce((s, r) => ({ our: s.our + r.cur.fail.our, enemy: s.enemy + r.cur.fail.enemy, both: s.both + r.cur.fail.both, draw: s.draw + r.cur.fail.draw }), { our: 0, enemy: 0, both: 0, draw: 0 });
      const avgT = totalT / Math.max(1, totalN), heatRate = heatN / Math.max(1, totalN), drawRate = totalD / Math.max(1, totalN);
      out.innerHTML = '';
      out.append(h('h2', {}, '战役关卡检验'),
        h('p', { class: 'muted' }, `每格 ${n} 局，参考车瞄准 ${aim}，对手用关卡里的瞄准和性格。绿 = 达标，黄 = 偏离，红 = 明显不对。本章参考车打普通关目标 ≥ 70%、打 Boss 60–70%；上一章参考车打 Boss 目标 < 30%。${n < 50 ? ` 当前样本较少，建议提高到 50 局以上。` : ''}`),
        h('p', { class: 'muted small' }, `验收指标：普通关达标 ${normalPass}/${normal.length}；Boss 落在 60–70% ${bossBand}/${bosses.length}；上一章 Boss 胜率低于 30% ${prevPass}/${prevBoss.length}；总体平手 ${pct(drawRate)}；平均用时 ${Math.round(avgT)} 秒；热量/缺水失败 ${pct(heatRate)}。目标分别是平手 < 5%、时长 30–60 秒、热量失败 < 30%。失败归因：我方 ${fail.our}、对方 ${fail.enemy}、同时 ${fail.both}、其他平手 ${fail.draw}。`),
        h('table', {},
          h('tr', {}, ['章', '关', '对手', '评分', '本章参考车', '胜率（95%区间）', '平手', '平均用时', '上一章参考车打它', '失败（我方 / 对方 / 同时）', '主要结局'].map(t => h('th', {}, t))),
          rows.map(r => {
            const w = r.cur.w / r.cur.n, pw = r.prev ? r.prev.w / r.prev.n : null;
            const top = Object.entries(r.cur.reasons).sort((a, b) => b[1] - a[1])[0];
            return h('tr', { class: r.o.boss ? 'boss' : '' },
              h('td', {}, SA.CAMPAIGN[r.ci].name.split(' · ')[0]), h('td', {}, r.si + 1),
              h('td', {}, r.o.name, r.o.boss ? ' 【Boss】' : '', h('span', { class: 'muted small' }, ` · ${SA.TERRAINS[$('#ter').value || r.o.terrain || 'flat'].name}`)), h('td', { class: 'num' }, r.er),
              h('td', {}, `${REF[r.ci].name}（${rating(refVeh(REF[r.ci]))}）`),
              h('td', { class: `num ${band(r, w)}` }, `${pct(w)}（${range(r.cur.w, r.cur.n)}）`), h('td', { class: 'num' }, pct(r.cur.d / r.cur.n)),
              h('td', { class: 'num' }, `${Math.round(r.cur.t / r.cur.n)} 秒`),
              h('td', { class: `num ${pw == null ? '' : pw < 0.3 ? 'ok' : pw < 0.5 ? 'meh' : 'bad'}` }, pw == null ? '—' : pct(pw)),
              h('td', { class: 'num' }, `${r.cur.fail.our} / ${r.cur.fail.enemy} / ${r.cur.fail.both}`),
              h('td', { class: 'muted small' }, `${top ? `${top[0]}（${top[1]}）` : ''}${r.missing.length ? `；参考车提前使用：${r.missing.map(id => M[id]?.name || id).join('、')}` : ''}`));
          })),
        h('h2', {}, '模块生效统计'),
        h('p', { class: 'muted' }, '统计包含本章参考车和战役对手的整轮模拟；被动模块用“激活”计数，武器同时记录开火、命中，鱼叉记录牵引，蓄压罐/散热片/冷凝器记录对应资源效果。'),
        h('table', {}, h('tr', {}, ['模块', '激活', '开火', '命中', '牵引', '放出储能', '省水', '无水散热'].map(t => h('th', {}, t))),
          ['pressure_tank', 'radiator', 'condenser', 'rocket_rack', 'harpoon', 'flamer', 'steamjet', 'boss_core', 'boss_lens', 'boss_ram', 'mortar_s', 'mg2', 'periscope', 'autoloader', 'rangefinder', 'gyroscope'].map(id => {
            const e = effectTotals[id] || {};
            return h('tr', {}, h('td', {}, M[id].name), h('td', { class: `num ${e.active > 0 ? 'ok' : 'bad'}` }, Math.round(e.active || 0)), h('td', { class: 'num' }, Math.round(e.fire || 0)), h('td', { class: 'num' }, Math.round(e.hit || 0)), h('td', { class: 'num' }, Math.round(e.tether || 0)), h('td', { class: 'num' }, (e.energy || 0).toFixed(1)), h('td', { class: 'num' }, (e.waterSaved || 0).toFixed(1)), h('td', { class: 'num' }, (e.dryCool || 0).toFixed(1)));
          })));
    });
  }

  // ---------- 2. 对战矩阵 + 评分校准 ----------
  function pool() {
    const k = $('#pool').value;
    const list = [];
    if (k === 'ref' || k === 'mix') REF.forEach(r => list.push({ name: r.name, v: refVeh(r), style: r.style }));
    if (k === 'boss' || k === 'mix') SA.CAMPAIGN.forEach(ch => ch.stages.filter(o => o.boss).forEach(o => list.push({ name: o.name, v: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []), style: o.style })));
    if (k === 'all') SA.CAMPAIGN.forEach(ch => ch.stages.forEach(o => list.push({ name: o.name, v: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []), style: o.style })));
    if (k === 'bp') SA.OFFICIAL_BLUEPRINTS.forEach(b => list.push({ name: b.name, v: SA.V.fromAscii(b.name, b.rows, b.sides || []) }));
    const mine = myCar();
    if ($('#mine').checked && mine) list.unshift({ name: `我的车 · ${mine.name}`, v: mine });
    return list;
  }
  function myCar() {
    try { const d = JSON.parse(localStorage.getItem('steam_arena_save_v2')); return d && d.vehicle ? d.vehicle : null; } catch (e) { return null; }
  }
  function matrix() {
    const { n, aim } = opt();
    const list = pool();
    for (const x of list) { x.aim = aim; x.r = rating(x.v); }
    const res = list.map(() => list.map(() => null));
    const jobs = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        // 一半局数换边打，抵消左右站位的偏差
        const a = blank(), b = blank();
        res[i][j] = a; res[j][i] = b;
        for (let k = 0; k < n; k++) jobs.push(k % 2 ? duel(a, list[i], list[j]) : duel(b, list[j], list[i]));
      }
    runJobs(jobs, () => {
      // 合并换边的两半：res[i][j] 记 i 的胜率
      const wr = (i, j) => { const a = res[i][j], b = res[j][i]; const n2 = a.n + b.n; return n2 ? (a.w + (b.n - b.w - b.d)) / n2 : null; };
      const dr = (i, j) => { const a = res[i][j], b = res[j][i]; return (a.d + b.d) / Math.max(1, a.n + b.n); };
      const tm = (i, j) => { const a = res[i][j], b = res[j][i]; return (a.t + b.t) / Math.max(1, a.n + b.n); };
      const cells = (w) => (w == null ? '' : w >= 0.7 ? 'hi' : w >= 0.55 ? 'mhi' : w > 0.45 ? 'mid' : w > 0.3 ? 'mlo' : 'lo');
      // 评分校准：按评分比分桶，看实际胜率
      const buckets = [[0, 0.7], [0.7, 0.9], [0.9, 1.1], [1.1, 1.3], [1.3, 1.6], [1.6, 99]].map(([lo, hi]) => ({ lo, hi, n: 0, w: 0 }));
      let draws = 0, pairs = 0, time = 0;
      for (let i = 0; i < list.length; i++)
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const ratio = list[i].r / Math.max(1, list[j].r), w = wr(i, j);
          const b = buckets.find(x => ratio >= x.lo && ratio < x.hi);
          b.n++; b.w += w;
          if (i < j) { draws += dr(i, j); time += tm(i, j); pairs++; }
        }
      out.innerHTML = '';
      out.append(h('h2', {}, '对战矩阵'),
        h('p', { class: 'muted' }, `每对 ${n} 局（一半换边），双方瞄准 ${aim}。格子 = 行方的胜率。平均平手率 ${pct(draws / Math.max(1, pairs))}，平均用时 ${Math.round(time / Math.max(1, pairs))} 秒（目标 30–60 秒、平手 < 5%）。`),
        h('div', { class: 'scroll' }, h('table', { class: 'matrix' },
          h('tr', {}, h('th', {}, ''), h('th', {}, '评分'), list.map((x, j) => h('th', { class: 'vert', title: x.name }, `${j + 1}`))),
          list.map((x, i) => h('tr', {}, h('th', { class: 'left' }, `${i + 1}. ${x.name}`), h('td', { class: 'num' }, x.r),
            list.map((y, j) => { const w = i === j ? null : wr(i, j); return h('td', { class: `num ${cells(w)}`, title: i === j ? '' : `${x.name} vs ${y.name}：胜 ${pct(w)}，平 ${pct(dr(i, j))}，${Math.round(tm(i, j))} 秒` }, w == null ? '—' : pct(w)); }))))),
        h('h2', {}, '评分校准'),
        h('p', { class: 'muted' }, '评分比 = 自己的评分 / 对手的评分。评分公式准的话，这一列应该单调上升，1.0 附近约 50%，1.2 倍左右约 65%。'),
        h('table', {}, h('tr', {}, ['评分比', '样本', '实际胜率'].map(t => h('th', {}, t))),
          buckets.map(b => h('tr', {}, h('td', {}, b.hi > 50 ? `≥ ${b.lo}` : `${b.lo} – ${b.hi}`), h('td', { class: 'num' }, b.n), h('td', { class: `num ${cells(b.n ? b.w / b.n : null)}` }, b.n ? pct(b.w / b.n) : '—')))));
    });
  }

  // ---------- 3. 模块性价比 ----------
  function value() {
    const mt = +$('#mat').value;
    const rows = SA.MODULE_ORDER.filter(id => !SA.MODULES[id].retired).map(id => {
      const m = SA.mod(id, mt), price = SA.cellValue({ id, mt }), t = SA.weightOf({ id }) / 1000;
      const dps = m.dmg ? (m.dmg * Math.max(0.4, 0.95 - m.spread * 0.03)) / m.reload : 0;
      return { id, m, price, t, dps, effect: mechanismValue(m), v: {
        dpsP: dps ? dps / price * 100 : null, hpP: m.hp / price, hpT: m.hp / t, dpsW: dps && m.power ? dps / m.power : null, dpsT: dps ? dps / t : null,
      } };
    });
    // 每一列和中位数比：高于 1.4 倍标绿（划算得可疑）、低于 0.6 倍标红（没人会买）
    const med = {};
    for (const k of ['dpsP', 'hpP', 'hpT', 'dpsW', 'dpsT']) {
      const xs = rows.map(r => r.v[k]).filter(x => x != null).sort((a, b) => a - b);
      med[k] = xs[Math.floor(xs.length / 2)] || 1;
    }
    const cell = (r, k, digits = 2) => { const x = r.v[k]; if (x == null) return h('td', { class: 'num muted' }, '—'); const q = x / med[k]; return h('td', { class: `num ${q > 1.4 ? 'hi' : q < 0.6 ? 'lo' : ''}` }, x.toFixed(digits)); };
    out.innerHTML = '';
    out.append(h('h2', {}, `模块性价比 · ${SA.MATS[mt].name}`),
      h('p', { class: 'muted' }, '纸面 DPS = 伤害 × 命中系数 ÷ 装填（同评分公式，没算护甲）。机制贡献把齐射、溅射、持续伤害 / 升温、牵引、储能、冷却和实体辅助倍率换算成可比较的正值，用于确认机制已接入数值链路。价格 = 原价 + 材料升级。绿 = 比同列中位数高 40% 以上，红 = 低 40% 以上。'),
      h('table', {},
        h('tr', {}, ['模块', '价格', '重量', '耐久', '护甲', '动力', 'DPS', '机制贡献', 'DPS / £100', '耐久 / £', '耐久 / 吨', 'DPS / 动力', 'DPS / 吨'].map(t => h('th', {}, t))),
        rows.map(r => h('tr', {},
          h('td', {}, M[r.id].name), h('td', { class: 'num' }, `£${r.price}`), h('td', { class: 'num' }, r.t.toFixed(2)),
          h('td', { class: 'num' }, r.m.hp), h('td', { class: 'num' }, r.m.armor || ''), h('td', { class: 'num' }, r.m.supply ? `+${r.m.supply}` : r.m.power ? `-${r.m.power}` : ''),
          h('td', { class: 'num' }, r.dps ? r.dps.toFixed(1) : ''), h('td', { class: `num ${r.effect > 0 ? 'hi' : 'muted'}` }, r.effect > 0 ? r.effect.toFixed(1) : '—'),
          cell(r, 'dpsP'), cell(r, 'hpP'), cell(r, 'hpT', 0), cell(r, 'dpsW'), cell(r, 'dpsT')))));
  }

  // ---------- 4. 构筑淘汰模拟 ----------
  // 用参考车的合法骨架生成少量候选，只改变武器、材料和预算；每一轮只保留胜率靠前者。
  function buildCandidates(ci, budget) {
    const base = REF[ci] || REF[REF.length - 1];
    // 每章至少尝试一次已解锁的武器；没有对应大格时替换第一处武器位，避免新模块永远不进入测试池。
    const weapon = ['C', 'M', 'P', 'L', 'R', 'G', 'J', 'F'];
    const weaponName = { C: '直射炮', M: '机枪', P: '高抛炮', L: '小炮', R: '重炮', G: '火箭架', J: '鱼叉', F: '喷火器' };
    const weaponId = { C: 'cannon', M: 'mg', P: 'mortar', L: 'cannon_s', R: 'cannon_heavy', G: 'rocket_rack', J: 'harpoon', F: 'flamer' };
    const available = availableMods(ci, 0);
    const out = [];
    // 预算只约束相对本章基准车的新增投入；基准车本体视为已经拥有，不能把整车总价再扣一遍。
    const baseVehicle = refVeh({ ...base, mt: 1, _solo: ci > 0 && ci < 5 });
    const baseValue = SA.V.stats(baseVehicle).value;
    const extras = ['condenser', 'radiator', 'pressure_chamber', 'tank_tall'];
    for (let mt = 1; mt <= Math.min(4, ci + 1); mt++) for (const w of weapon) {
      if (!available.has(weaponId[w]) || mt < SA.minMt(weaponId[w])) continue;
      const rows = base.rows.map(row => row.replace(/[CMPLRGJF]/, w));
      const v = refVeh({ ...base, rows, mt, _solo: ci > 0 && ci < 5 });
      const st = SA.V.stats(v);
      const issues = SA.V.issues(v);
      const spend = Math.max(0, st.value - baseValue);
      if (issues.length || spend > budget) continue;
      const wn = weaponName[w];
      out.push({ name: `${SA.MATS[mt].name}${wn}构筑`, v, mt, value: st.value, spend, style: base.style });
      for (const id of extras) {
        if (!available.has(id)) continue;
        const extra = legalWithSub(base, mt, rows, id);
        if (!extra) continue;
        const es = SA.V.stats(extra);
        const extraSpend = Math.max(0, es.value - baseValue);
        if (extraSpend <= budget) out.push({ name: `${SA.MATS[mt].name}${wn}+${M[id].name}`, v: extra, mt, value: es.value, spend: extraSpend, style: base.style, mark: '能源变体' });
      }
    }
    // 预算过低时仍保留最便宜的合法车，避免章节没有样本。
    if (!out.length) {
      const rows = !available.has('cannon') && available.has('cannon_s') ? base.rows.map(row => row.replace(/C/g, 'L')) : base.rows;
      const v = refVeh({ ...base, rows, _solo: ci > 0 && ci < 5 }), st = SA.V.stats(v);
      out.push({ name: `${base.name}（超预算基线）`, v, mt: base.mt, value: st.value, spend: 0, style: base.style });
    }
    return out;
  }
  // 在空闲子格尝试放置能源/冷却件，只有通过出战检查的布局才返回。
  function legalWithSub(base, mt, rows, id) {
    const ci = REF.indexOf(base);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 16; c++) {
      const v = refVeh({ ...base, rows, mt, _solo: ci > 0 && ci < 5 });
      if (SA.V.at(v, 'body', r, c)) continue;
      v.body[r][c] = SA.newCell(id, mt);
      if (!SA.V.issues(v).length) return v;
    }
    return null;
  }
  function improveCandidate(candidate, reason, ci) {
    const id = /烧干|热量/.test(reason) ? 'condenser' : /超时|平手/.test(reason) ? 'pressure_chamber' : 'radiator';
    // 改良必须从原候选车复制，保留它已选择的武器、材料和已有子模块。
    // 重新从章节基准车构造会把第一轮筛出的构筑静默换回基线，令前后胜率不可比较。
    const extra = addSubToVehicle(candidate.v, id, candidate.mt || 1);
    return extra ? { ...candidate, v: extra, name: `${candidate.name} +${M[id].name}`, value: SA.V.stats(extra).value, mark: '失败原因改良' } : candidate;
  }
  // 在候选车的空闲主体子格加入一个补救模块，并重新检查出战合法性。
  function addSubToVehicle(source, id, mt = 1) {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 16; c++) {
      const v = SA.V.clone(source);
      if (SA.V.at(v, 'body', r, c)) continue;
      v.body[r][c] = SA.newCell(id, mt);
      if (!SA.V.issues(v).length) return v;
    }
    return null;
  }
  // 保守经济轨迹：从真实开局资金开始，每场先结算 prize，再最多购买一件当前已解锁且买得起的新模块。
  // 这不是玩家 AI，而是用来检查“新答案出现后 2～3 场内是否能买到”的节奏上限。
  function economyPlan() {
    let cash = 300, stageNo = 0, lastBuy = 0;
    const available = new Set(SA.CAMP_START.mods || []), owned = new Set(SA.CAMP_START.mods || []), rows = [];
    SA.CAMPAIGN.forEach((ch) => ch.stages.forEach((stage, si) => {
      stageNo++;
      cash += stage.prize || 0;
      for (const id of stage.unlock?.mods || []) available.add(id);
      if (si === ch.stages.length - 1) for (const id of ch.unlock?.mods || []) available.add(id);
      const choices = [...available].filter(id => !owned.has(id) && SA.MODULES[id]).sort((a, b) => SA.buyPrice(a) - SA.buyPrice(b));
      const id = choices.find(x => cash >= SA.buyPrice(x));
      let bought = '—', gap = '—';
      if (id) { const price = SA.buyPrice(id); cash -= price; owned.add(id); bought = `${M[id].name} £${price}`; gap = stageNo - lastBuy; lastBuy = stageNo; }
      rows.push({ stageNo, name: stage.name, prize: stage.prize || 0, cash, unlocks: [...(stage.unlock?.mods || []), ...(si === ch.stages.length - 1 ? (ch.unlock?.mods || []) : [])], bought, gap });
    }));
    return rows;
  }
  function buildSim() {
    const { n, aim } = opt();
    const jobs = [], chapters = [];
    // 以开局资金作为现金轨迹起点；之后严格累加关卡 prize，避免用与内容表脱节的固定奖励。
    let funds = 300;
    SA.CAMPAIGN.forEach((ch, ci) => {
      const budget = funds;
      const pool = buildCandidates(ci, budget);
      const rows = pool.map(c => ({ c, acc: blank() }));
      ch.stages.forEach(stage => rows.forEach(row => {
        const e = { v: SA.V.fromAscii(stage.name, stage.rows, stage.sides || [], stage.mt || 1, stage.elite || [], stage.subs || []), aim: stage.aim, style: stage.style, boss: stage.boss, terrain: $('#ter').value || stage.terrain || 'flat' };
        for (let k = 0; k < n; k++) jobs.push(duel(row.acc, { v: row.c.v, aim, style: row.c.style }, e));
      }));
      chapters.push({ ch, ci, budget, rows });
      funds += ch.stages.reduce((sum, stage) => sum + (stage.prize || 0), 0);
    });
    runJobs(jobs, () => {
      out.innerHTML = '';
      const blocks = [];
      const improvedJobs = [], improved = [];
      chapters.forEach(({ ch, budget, rows, ci }) => {
        rows.sort((a, b) => (b.acc.w / Math.max(1, b.acc.n)) - (a.acc.w / Math.max(1, a.acc.n)));
        const keep = rows.slice(0, 3);
        const next = keep.map(r => {
          const top = Object.entries(r.acc.reasons).filter(x => x[0].startsWith('我方：')).sort((a, b) => b[1] - a[1])[0];
          const c = improveCandidate(r.c, top ? top[0] : '', ci); const row = { c, acc: blank() }; improved.push({ ch, budget, row, before: r }); return row;
        });
        ch.stages.forEach(stage => next.forEach(row => {
          const e = { v: SA.V.fromAscii(stage.name, stage.rows, stage.sides || [], stage.mt || 1, stage.elite || [], stage.subs || []), aim: stage.aim, style: stage.style, boss: stage.boss, terrain: $('#ter').value || stage.terrain || 'flat' };
          for (let k = 0; k < n; k++) improvedJobs.push(duel(row.acc, { v: row.c.v, aim, style: row.c.style }, e));
        }));
      });
      runJobs(improvedJobs, () => {
      chapters.forEach(({ ch, budget, rows }) => {
        const keep = rows.slice(0, 3);
        blocks.push(h('h2', {}, `${ch.name} · 预算 £${budget}`),
          h('p', { class: 'muted' }, `候选 ${rows.length} 台，按胜率淘汰后保留前 ${keep.length} 名；每台对本章全部关卡各 ${n} 局。`),
          h('table', {}, h('tr', {}, ['排名', '构筑', '材料', '车价', '改装费', '胜率', '平均用时', '主要失败原因'].map(t => h('th', {}, t))),
            keep.map((r, i) => {
              const a = r.acc, w = a.w / Math.max(1, a.n), top = Object.entries(a.reasons).filter(x => x[0].startsWith('我方：')).sort((x, y) => y[1] - x[1])[0];
              return h('tr', {}, h('td', { class: 'num' }, i + 1), h('td', {}, r.c.name), h('td', {}, SA.MATS[r.c.mt].name), h('td', { class: 'num' }, `£${r.c.value}`), h('td', { class: 'num' }, `£${r.c.spend || 0}`), h('td', { class: `num ${w >= 0.7 ? 'ok' : w >= 0.5 ? 'meh' : 'bad'}` }, pct(w)), h('td', { class: 'num' }, `${Math.round(a.t / Math.max(1, a.n))} 秒`), h('td', { class: 'muted small' }, top ? `${top[0].replace('我方：', '')}（${top[1]}）` : '—'));
            })));
        improved.filter(x => x.ch === ch).forEach(x => {
        const a = x.row.acc, w = a.w / Math.max(1, a.n), top = Object.entries(a.reasons).filter(r => r[0].startsWith('我方：')).sort((u, v) => v[1] - u[1])[0];
        blocks.push(h('p', { class: 'muted small' }, `改良构筑：${x.row.c.name} · 胜率 ${pct(w)} · 主要失败 ${top ? top[0] : '—'}`));
        });
      });
      const sampleHint = n < 50 ? `当前每组仅 ${n} 局，胜率误差较大；建议调到 50 局以上再作节奏判断。` : `每组 ${n} 局，可用于初步节奏判断。`;
      const economy = economyPlan();
      out.append(h('h2', {}, '构筑淘汰模拟'), h('p', { class: 'muted' }, `资金从开局 £300 开始，严格累加关卡 prize；${sampleHint}失败原因来自战斗模拟，便于定位烧干、被击毁、超时和平局等问题。`), ...blocks,
        h('h2', {}, '经济节奏轨迹'),
        h('p', { class: 'muted' }, '按每场奖金结算后最多购买一件新模块，不计修理、贷款、街头赛和缴获；“距离上次购买”超过 3 场就标红，表示主线奖励需要调整。'),
        h('table', {}, h('tr', {}, ['场次', '关卡', '奖金', '结算后现金', '本场解锁', '模拟购买', '距离上次购买'].map(t => h('th', {}, t))), economy.map(x => h('tr', {},
          h('td', { class: 'num' }, x.stageNo), h('td', {}, x.name), h('td', { class: 'num' }, `£${x.prize}`), h('td', { class: 'num' }, `£${x.cash}`), h('td', {}, x.unlocks.map(id => M[id]?.name || id).join('、') || '—'),
          h('td', {}, x.bought), h('td', { class: `num ${x.gap !== '—' && x.gap > 3 ? 'bad' : ''}` }, x.gap === '—' ? '—' : `${x.gap} 场`)))));
      });
    });
  }

  // ---------- 界面 ----------
  $('#run-camp').onclick = campaign;
  $('#run-matrix').onclick = matrix;
  $('#run-value').onclick = value;
  $('#run-build').onclick = buildSim;
  $('#mat').append(...SA.MATS.slice(1).map((m, i) => h('option', { value: i + 1 }, m.name)));
  $('#ter').append(...SA.TERRAIN_ORDER.map(k => h('option', { value: k }, `全部用「${SA.TERRAINS[k].name}」`)));
  $('#mat').onchange = value;
  if (!myCar()) { $('#mine').disabled = true; $('#mine').parentElement.title = '本机还没有存档'; }
  value();
})();
