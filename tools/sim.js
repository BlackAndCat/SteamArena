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
    { name: '一章 · 装甲炮车', grid: [5, 3], mt: 1, rows: ['........', '........', '........', '...KC...', '..WOAA..', '..TTTT..'] },
    { name: '二章 · 熟铁四层', grid: [5, 4], mt: 2, rows: ['........', '........', '...C....', '..KAM...', '.WOOHH..', '.TTTTT..'] },
    { name: '三章 · 钢撞角双足', grid: [6, 4], mt: 3, style: 'rush', rows: ['........', '........', '...C....', '..KAM...', '..OWAHX.', '..BBBB..'] },
    { name: '四章 · 镀镍炮垒', grid: [6, 5], mt: 4, rows: ['........', '...P....', '..KAC...', '.WOAHH..', '.WOOHAY.', '.TTTTTT.'], sides: [[3, 3], [3, 4]] },
    { name: '五章 · 镀镍 + 史诗', grid: [7, 5], mt: 4, rows: ['........', '...P....', '..VKAC..', 'WWOAHH..', 'WOOHHAY.', 'TTTTTTT.'], sides: [[3, 3], [3, 4], [4, 3]], elite: [[2, 5, 5], [1, 3, 5]] },
  ];
  // 联合驾驶舱第四章通关才解锁：前面几章的参考车把 K 换成 1×1 驾驶舱（车头下角）+ 三块甲片，占格不变
  const soloK = (rows) => {
    const subs = [];
    rows = rows.map((row, R) => row.replace(/K/g, (m, C) => { subs.push([2 * R + 1, 2 * C + 1, 'helmet'], [2 * R, 2 * C, 'plate'], [2 * R, 2 * C + 1, 'plate'], [2 * R + 1, 2 * C, 'plate']); return '.'; }));
    return { rows, subs };
  };
  const refVeh = (r, ci = REF.indexOf(r)) => {
    const k = ci >= 0 && ci < 5 ? soloK(r.rows) : { rows: r.rows, subs: [] };
    return SA.V.fromAscii(r.name, k.rows, r.sides || [], r.mt, r.elite || [], k.subs);
  };
  const rating = (v) => SA.V.stats(v).rating;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const opt = () => ({ n: Math.max(2, +$('#games').value || 20), aim: +$('#aim').value || 0.8 });

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
    };
  }
  const blank = () => ({ n: 0, w: 0, d: 0, t: 0, reasons: {} });

  // ---------- 1. 战役关卡检验 ----------
  // 合格线（见 docs/game-design.md）：本章参考车打普通关 ≥ 70%，打 Boss 60–70%；上一章参考车打 Boss < 30%
  function campaign() {
    const { n, aim } = opt();
    const rows = [], jobs = [];
    SA.CAMPAIGN.forEach((ch, ci) => ch.stages.forEach((o, si) => {
      const ev = SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || []);
      const e = { v: ev, aim: o.aim, style: o.style, boss: o.boss, terrain: $('#ter').value || o.terrain || 'flat' };
      const cur = REF[ci], prev = REF[ci - 1];
      const row = { ci, si, o, er: rating(ev), cur: blank(), prev: prev && o.boss ? blank() : null };
      for (let k = 0; k < n; k++) jobs.push(duel(row.cur, { v: refVeh(cur), aim, style: cur.style }, e));
      if (row.prev) for (let k = 0; k < n; k++) jobs.push(duel(row.prev, { v: refVeh(prev), aim, style: prev.style }, e));
      rows.push(row);
    }));
    runJobs(jobs, () => {
      const band = (row, w) => (row.o.boss ? (w >= 0.6 && w <= 0.7 ? 'ok' : w > 0.85 || w < 0.4 ? 'bad' : 'meh') : (w >= 0.7 ? 'ok' : w >= 0.5 ? 'meh' : 'bad'));
      out.innerHTML = '';
      out.append(h('h2', {}, '战役关卡检验'),
        h('p', { class: 'muted' }, `每格 ${n} 局，参考车瞄准 ${aim}，对手用关卡里的瞄准和性格。绿 = 达标，黄 = 偏离，红 = 明显不对。本章参考车打普通关目标 ≥ 70%、打 Boss 60–70%；上一章参考车打 Boss 目标 < 30%。`),
        h('table', {},
          h('tr', {}, ['章', '关', '对手', '评分', '本章参考车', '胜率', '平手', '平均用时', '上一章参考车打它', '主要结局'].map(t => h('th', {}, t))),
          rows.map(r => {
            const w = r.cur.w / r.cur.n, pw = r.prev ? r.prev.w / r.prev.n : null;
            const top = Object.entries(r.cur.reasons).sort((a, b) => b[1] - a[1])[0];
            return h('tr', { class: r.o.boss ? 'boss' : '' },
              h('td', {}, SA.CAMPAIGN[r.ci].name.split(' · ')[0]), h('td', {}, r.si + 1),
              h('td', {}, r.o.name, r.o.boss ? ' 【Boss】' : '', h('span', { class: 'muted small' }, ` · ${SA.TERRAINS[$('#ter').value || r.o.terrain || 'flat'].name}`)), h('td', { class: 'num' }, r.er),
              h('td', {}, `${REF[r.ci].name}（${rating(refVeh(REF[r.ci]))}）`),
              h('td', { class: `num ${band(r, w)}` }, pct(w)), h('td', { class: 'num' }, pct(r.cur.d / r.cur.n)),
              h('td', { class: 'num' }, `${Math.round(r.cur.t / r.cur.n)} 秒`),
              h('td', { class: `num ${pw == null ? '' : pw < 0.3 ? 'ok' : pw < 0.5 ? 'meh' : 'bad'}` }, pw == null ? '—' : pct(pw)),
              h('td', { class: 'muted small' }, top ? `${top[0]}（${top[1]}）` : ''));
          })));
    });
  }

  // ---------- 2. 对战矩阵 + 评分校准 ----------
  function pool() {
    const k = $('#pool').value;
    const list = [];
    if (k === 'ref' || k === 'mix') REF.forEach(r => list.push({ name: r.name, v: refVeh(r), style: r.style }));
    if (k === 'boss' || k === 'mix') SA.CAMPAIGN.forEach(ch => ch.stages.filter(o => o.boss).forEach(o => list.push({ name: o.name, v: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || []), style: o.style })));
    if (k === 'all') SA.CAMPAIGN.forEach(ch => ch.stages.forEach(o => list.push({ name: o.name, v: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || []), style: o.style })));
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
      return { id, m, price, t, dps, v: {
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
      h('p', { class: 'muted' }, '纸面 DPS = 伤害 × 命中系数 ÷ 装填（同评分公式，没算护甲）。价格 = 原价 + 材料升级。绿 = 比同列中位数高 40% 以上，红 = 低 40% 以上。武器之间比 DPS 那几列，装甲之间比耐久那几列。'),
      h('table', {},
        h('tr', {}, ['模块', '价格', '重量', '耐久', '护甲', '动力', 'DPS', 'DPS / £100', '耐久 / £', '耐久 / 吨', 'DPS / 动力', 'DPS / 吨'].map(t => h('th', {}, t))),
        rows.map(r => h('tr', {},
          h('td', {}, M[r.id].name), h('td', { class: 'num' }, `£${r.price}`), h('td', { class: 'num' }, r.t.toFixed(2)),
          h('td', { class: 'num' }, r.m.hp), h('td', { class: 'num' }, r.m.armor || ''), h('td', { class: 'num' }, r.m.supply ? `+${r.m.supply}` : r.m.power ? `-${r.m.power}` : ''),
          h('td', { class: 'num' }, r.dps ? r.dps.toFixed(1) : ''),
          cell(r, 'dpsP'), cell(r, 'hpP'), cell(r, 'hpT', 0), cell(r, 'dpsW'), cell(r, 'dpsT')))));
  }

  // ---------- 界面 ----------
  $('#run-camp').onclick = campaign;
  $('#run-matrix').onclick = matrix;
  $('#run-value').onclick = value;
  $('#mat').append(...SA.MATS.slice(1).map((m, i) => h('option', { value: i + 1 }, m.name)));
  $('#ter').append(...SA.TERRAIN_ORDER.map(k => h('option', { value: k }, `全部用「${SA.TERRAINS[k].name}」`)));
  $('#mat').onchange = value;
  if (!myCar()) { $('#mine').disabled = true; $('#mine').parentElement.title = '本机还没有存档'; }
  value();
})();
