// 进化报告页：读取 tools/evolve.js 的运行报告（tools/out/evolve-*.json）或候选车库（tools/evolve-candidates.json），
// 展示选关结果、强度 × 表现散点图、分类网格、毒瘤车与奇特构筑，以及单台车的详情、种子复现和试驾入口。
// 只读报告，不改存档、不改关卡数据；试驾通过 localStorage 把车交给游戏的试驾场（js/camp.js 的 evolve 来源）。
(() => {
  const h = SA.h;
  const $ = (s) => document.querySelector(s);
  const out = $('#out');

  // 三类存档：颜色经过深色背景下的色盲校验，另外用形状区分，不单靠颜色
  const CLASS = {
    normal: { name: '常规', color: '#b0802c', shape: 'circle' },
    odd: { name: '奇特构筑', color: '#139aa3', shape: 'diamond' },
    toxic: { name: '毒瘤车', color: '#a94cc4', shape: 'square' },
  };
  const STYLE = { rush: '冲锋', kite: '风筝', turtle: '龟缩', wander: '游走' };
  const CHASSIS = { track: '履带', quad: '四足', biped: '双足' };
  const COND = {
    reward: '带奖励件', nonToxic: '不是毒瘤车', target: '目标强度', terrain: '地形条件', bossGeneric: 'Boss 通用型',
    previousBoss: '上一档 Boss 打它 < 30%', rewardLowerBound: '奖励车打上一档 Boss ≥ 60%', rewardCrushGuard: '防碾压：上一档 Boss 打它 ≥ 15%',
    rewardEffect: '奖励件生效', rewardContrast: '对照测试（换成甲片后胜率下降）',
  };
  const PICKS_KEY = 'steam_arena_evolve_picks';   // 和 js/camp.js 试驾场的 evolve 来源共用
  const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const fix = (x, d = 0) => (x == null || !Number.isFinite(+x) ? '—' : (+x).toFixed(d));
  const terrainName = (k) => (SA.TERRAINS[k] ? SA.TERRAINS[k].name : k || '平地');
  const stageName = (ci, si) => { const s = SA.CAMPAIGN[ci] && SA.CAMPAIGN[ci].stages[si]; return s ? s.name : `第 ${ci + 1} 章第 ${si + 1} 关`; };
  const chapterShort = (ci) => (SA.CAMPAIGN[ci] ? SA.CAMPAIGN[ci].name.split(' · ')[0] : `第 ${ci + 1} 章`);

  const st = { report: null, label: '', chapter: 'all', fingerprint: null, grid: null };

  // ---------- 规则指纹：和 tools/evolve.js 的 ruleFingerprint 同一算法 ----------
  const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v);
  async function currentFingerprint() {
    const files = ['js/modules.js', 'js/vehicle.js', 'js/content.js', 'js/state.js', 'js/camp.js', 'js/battle.js'];
    const texts = await Promise.all([...files.map(f => `../${f}`), 'evolve-config.js'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text())));
    const module = { exports: {} };
    new Function('module', 'exports', 'require', texts[3])(module, module.exports, () => ({}));
    const payload = stable({
      version: module.exports.rulesVersion,
      gameVersion: SA.RULES_VERSION || null,
      constants: SA.K,
      modules: SA.MODULES,
      terrains: SA.TERRAINS,
      campaigns: SA.CAMPAIGN.map(ch => ({ name: ch.name, unlock: ch.unlock, stages: ch.stages.map(s => ({ name: s.name, terrain: s.terrain, spec: s.spec, uniqueLoot: s.uniqueLoot, unlock: s.unlock, boss: !!s.boss })) })),
      source: files.map((f, i) => [f, texts[i]]),
    });
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  // ---------- 读取 ----------
  // 报告列表来自 tools/out/ 的目录页（tools/serve.py 和 python -m http.server 都会生成）
  async function listReports() {
    try {
      const html = await fetch('out/', { cache: 'no-store' }).then(r => (r.ok ? r.text() : ''));
      const names = [...html.matchAll(/href="(evolve-\d+\.json)"/g)].map(m => m[1]);
      return [...new Set(names)].sort().reverse();
    } catch (e) { return []; }
  }
  async function hasCandidates() {
    try { return /href="evolve-candidates\.json"/.test(await fetch('./', { cache: 'no-store' }).then(r => (r.ok ? r.text() : ''))); } catch (e) { return false; }
  }
  // 候选车库只有分享码、标签和分数，整理成和报告里一样的记录形状
  function normalize(data) {
    if (data && Array.isArray(data.chapters)) return data;
    const rows = (data && data.candidates) || [];
    return {
      generatedAt: data && data.generatedAt, rules: data && data.rules, lite: true, chapters: [], selectionFailures: [],
      candidates: rows.map(r => ({
        name: '', code: r.code, cells: r.cells, style: r.tags && r.tags.style, chassis: r.tags && r.tags.chassis, archiveClass: 'normal',
        spec: { chapter: r.tags && r.tags.chapter, stage: r.tags && r.tags.stage, terrain: r.tags && r.tags.terrain },
        strength: r.scores && r.scores.strength, performance: r.scores && r.scores.performance, rules: r.rules,
      })),
    };
  }
  async function load(url, label) {
    try {
      const data = await fetch(url, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
      use(normalize(data), label);
    } catch (e) { banner(`读取失败：${label}（${e.message}）`, 'stale'); out.innerHTML = ''; }
  }
  function use(report, label) {
    st.report = report; st.label = label; st.grid = null;
    render();
  }

  // ---------- 车辆 ----------
  const vcache = new Map();
  // 优先用完整模块清单（带材料和改装等级）；老报告只有分享码时，按补丁里的材料（mt / elite，按大格）补回材料，改装等级无法还原
  function vehicleOf(rec) {
    if (!rec || (!rec.code && !rec.cells)) return null;
    const key = rec.cells ? JSON.stringify(rec.cells) : rec.code;
    if (!vcache.has(key)) {
      let v = null;
      try {
        if (rec.cells) v = SA.V.fromCells(rec.name || '候选车', rec.cells);
        else {
          v = SA.V.decode(rec.code);
          const pt = rec.patch;
          if (v && pt) {
            const elite = new Map((pt.elite || []).map(([r, c, mt]) => [`${r},${c}`, mt]));
            SA.V.each(v, (cell, r, c) => {
              const mt = Math.max(elite.get(`${Math.floor(r / 2)},${Math.floor(c / 2)}`) || pt.mt || 1, SA.minMt(cell.id));
              if (mt > 1) cell.mt = mt; else delete cell.mt;
              cell.hp = SA.V.maxHp(cell);
            });
          }
        }
      } catch (e) { v = null; }
      vcache.set(key, v);
    }
    return vcache.get(key);
  }
  const exact = (rec) => !!rec.cells;
  function thumb(rec, caption) {
    const v = vehicleOf(rec);
    const box = h('button', { class: 'thumb', title: '点开看详情', onclick: () => openDetail(rec) });
    if (v) box.append(SA.UI.vehiclePreview(v, 1)); else box.append(h('span', { class: 'bad small' }, '分享码无法解析'));
    box.append(h('span', { class: 'cap' }, caption != null ? caption : `强 ${fix(rec.strength)} · 表 ${fix(rec.performance)}`));
    return box;
  }
  const classOf = (rec) => CLASS[rec.archiveClass] || CLASS.normal;
  function markSvg(cls, size = 12) {
    const c = CLASS[cls] || CLASS.normal, r = size / 2;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.append(shape(c.shape, r, r, r - 1, c.color));
    return svg;
  }
  function shape(kind, x, y, r, color) {
    const ns = 'http://www.w3.org/2000/svg';
    let el;
    if (kind === 'diamond') { el = document.createElementNS(ns, 'path'); el.setAttribute('d', `M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`); }
    else if (kind === 'square') { el = document.createElementNS(ns, 'rect'); el.setAttribute('x', x - r); el.setAttribute('y', y - r); el.setAttribute('width', r * 2); el.setAttribute('height', r * 2); el.setAttribute('rx', 1); }
    else { el = document.createElementNS(ns, 'circle'); el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', r); }
    el.setAttribute('fill', color);
    return el;
  }

  // ---------- 页面 ----------
  function banner(text, cls = '') { const b = $('#banner'); b.className = `banner ${cls}`; b.textContent = text; }
  function inChapter(ci) { return st.chapter === 'all' || +st.chapter === ci; }
  function allRecords() {
    const r = st.report;
    return (r.candidates || []).filter(c => c.spec == null || c.spec.chapter == null || inChapter(c.spec.chapter));
  }
  function selectedCodes() {
    const set = new Set();
    for (const ch of st.report.chapters || []) for (const s of ch.stages || []) if (s.selected) set.add(s.selected.code);
    return set;
  }

  function render() {
    const r = st.report;
    // 章节筛选
    const chaps = [...new Set((r.candidates || []).map(c => c.spec && c.spec.chapter).filter(x => x != null))].sort((a, b) => a - b);
    const sel = $('#chap');
    sel.innerHTML = '';
    sel.append(h('option', { value: 'all' }, '全部'), ...chaps.map(ci => h('option', { value: ci, selected: String(st.chapter) === String(ci) }, SA.CAMPAIGN[ci] ? SA.CAMPAIGN[ci].name : `第 ${ci + 1} 章`)));
    if (st.chapter !== 'all' && !chaps.includes(+st.chapter)) st.chapter = 'all';
    // 规则指纹
    const same = st.fingerprint && r.rules === st.fingerprint;
    banner(!r.rules ? `${st.label}：报告里没有规则指纹，无法判断是否过期。`
      : !st.fingerprint ? `${st.label} · 规则指纹 ${r.rules}（当前规则的指纹计算失败，无法比较）`
      : same ? `${st.label} · 规则指纹 ${r.rules}，和当前规则一致。`
      : `数据过期，需要复核：报告按规则 ${r.rules} 生成，当前规则是 ${st.fingerprint}。关卡车和分数可能已经不准，先跑 node tools/evolve.js --impact 复核（docs/evolve-plan.md §10）。`,
      !r.rules || !st.fingerprint ? '' : same ? 'fresh' : 'stale');
    const sections = r.lite
      ? [['scatter', '强度 × 表现'], ['archive', '毒瘤车与奇特构筑']]
      : [['overview', '概览'], ['picks', '选关结果'], ['scatter', '强度 × 表现'], ['grid', '分类网格'], ['archive', '毒瘤车与奇特构筑']];
    const nav = $('#nav'); nav.innerHTML = '';
    nav.append(...sections.map(([id, name]) => h('a', { href: `#${id}` }, name)));
    out.innerHTML = '';
    if (!r.lite) out.append(overview(), picks());
    else out.append(h('p', { class: 'muted' }, '这是候选车库（只有分享码、标签和分数），没有选关结果和分类网格。要看完整内容，请选一份 tools/out/ 里的运行报告。'));
    out.append(scatter());
    if (!r.lite) out.append(grid());
    out.append(archiveSection());
  }

  function overview() {
    const r = st.report, fails = (r.selectionFailures || []).filter(f => inChapter(f.chapter));
    const stages = (r.chapters || []).filter(ch => inChapter(ch.chapter)).reduce((a, ch) => a + (ch.stages || []).length, 0);
    const tile = (k, v) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
    return h('section', { id: 'overview' }, h('h2', {}, '概览'),
      h('p', { class: 'muted small' }, `生成于 ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '—'} · 随机种子 ${r.seed ?? '—'}`),
      h('div', { class: 'tiles' }, tile('关卡', stages), tile('候选车', allRecords().length), tile('选关未达标', fails.length)),
      fails.length ? h('div', {}, h('h3', {}, '未达标的关卡'),
        h('table', {}, h('tr', {}, ['关卡', '没满足的条件'].map(t => h('th', {}, t))),
          fails.map(f => h('tr', {}, h('td', {}, `${chapterShort(f.chapter)} · ${f.name || stageName(f.chapter, f.stage)}`),
            h('td', {}, (f.failed || []).length ? f.failed.map(k => h('span', { class: 'chip bad' }, COND[k] || k)) : '没有选出车'))))) : null);
  }

  function picks() {
    const r = st.report, rows = [];
    for (const ch of r.chapters || []) {
      if (!inChapter(ch.chapter)) continue;
      (ch.stages || []).forEach((s, si) => {
        const sel = s.selected, ev = s.selection || {}, spec = s.spec || {};
        const failed = ev.failed || [];
        rows.push(h('tr', { class: spec.boss ? 'boss' : '' },
          h('td', {}, chapterShort(ch.chapter)),
          h('td', {}, spec.name || stageName(ch.chapter, si), spec.boss ? h('span', { class: 'chip' }, 'Boss') : null,
            spec.rewardModule ? h('span', { class: 'chip' }, `奖励：${(SA.MODULES[spec.rewardModule] || {}).name || spec.rewardModule}`) : null),
          h('td', {}, terrainName(spec.terrain)),
          h('td', {}, sel ? thumb(sel) : h('span', { class: 'bad' }, '没有选出车')),
          h('td', {}, sel ? `${STYLE[sel.style] || sel.style || '—'} · ${CHASSIS[sel.chassis] || sel.chassis || '—'}` : '—'),
          h('td', { class: 'num' }, sel ? `${fix(sel.strength)} ± ${fix(sel.strengthCi)}` : '—'),
          h('td', { class: 'num' }, sel ? fix(sel.performance) : '—'),
          h('td', { class: 'small' }, evidence(spec, ev)),
          h('td', {}, failed.length ? failed.map(k => h('span', { class: 'chip bad' }, COND[k] || k)) : h('span', { class: 'ok' }, '全部满足'))));
      });
    }
    return h('section', { id: 'picks' }, h('h2', {}, '选关结果'),
      h('p', { class: 'muted small' }, '每一关从本关候选里按硬条件和目标强度挑出的车。导出补丁在详情里（只替换车的数据，关卡名、剧情、奖励和奖金不动）。'),
      h('div', { class: 'scroll' }, h('table', {},
        h('tr', {}, ['章', '关卡', '场地', '选中的车', '性格 · 底盘', '强度分', '表现分', '关键数据', '硬条件'].map(t => h('th', {}, t))), rows)));
  }
  function evidence(spec, ev) {
    const parts = [];
    if (spec.boss) {
      if (ev.bossAverageWinRate != null) parts.push(`对本档平均胜率 ${pct(ev.bossAverageWinRate)}`);
      if (ev.bossReverseWinRate != null) parts.push(`本档打它 ${pct(ev.bossReverseWinRate)}`);
      if (ev.previousBossWinRate != null) parts.push(`上一档 Boss 打它 ${pct(ev.previousBossWinRate)}`);
    } else {
      if (ev.bossWinRate != null) parts.push(`本章 Boss 打它 ${pct(ev.bossWinRate)}`);
      if (ev.rewardWinRateAgainstPreviousBoss != null) parts.push(`打上一档 Boss ${pct(ev.rewardWinRateAgainstPreviousBoss)}`);
      if (ev.rewardControl != null) parts.push(`换甲片后 ${pct(ev.rewardControl)}`);
    }
    if (ev.terrainDelta != null && spec.terrain && spec.terrain !== 'flat') parts.push(`地形专长 ${ev.terrainDelta >= 0 ? '+' : ''}${fix(ev.terrainDelta)}`);
    return parts.length ? parts.join(' · ') : '—';
  }

  // ---------- 散点图：强度分（横）× 表现分（纵） ----------
  function scatter() {
    const recs = allRecords().filter(c => Number.isFinite(+c.strength) && Number.isFinite(+c.performance));
    const wrap = h('div', { class: 'chart-wrap' });
    const sec = h('section', { id: 'scatter' }, h('h2', {}, '强度 × 表现'),
      h('p', { class: 'muted small' }, '横轴是实战测出的强度分（1000 = 和标尺车打平），纵轴是表现分（观众算法，0～100）。右下角 = 强但难看，毒瘤车在那里。带圈的是选关选中的车。悬停看数据，点击看详情。'));
    if (!recs.length) { sec.append(h('div', { class: 'empty-state' }, '这份数据里没有带分数的车。')); return sec; }
    const ns = 'http://www.w3.org/2000/svg', W = 900, H = 420, L = 52, R = 16, T = 12, B = 40;
    const xs = recs.map(c => +c.strength), lo = Math.floor(Math.min(...xs) / 50) * 50, hi = Math.ceil(Math.max(...xs) / 50) * 50 || lo + 100;
    const xmin = lo === hi ? lo - 50 : lo, xmax = lo === hi ? hi + 50 : hi;
    const X = (v) => L + (v - xmin) / (xmax - xmin) * (W - L - R), Y = (v) => T + (1 - v / 100) * (H - T - B);
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `强度分和表现分散点图，共 ${recs.length} 台车`);
    const line = (x1, y1, x2, y2, color) => { const l = document.createElementNS(ns, 'line'); Object.entries({ x1, y1, x2, y2, stroke: color, 'stroke-width': 1 }).forEach(([k, v]) => l.setAttribute(k, v)); svg.append(l); };
    const text = (x, y, s, anchor = 'middle', color = '#a8a39a') => { const t = document.createElementNS(ns, 'text'); Object.entries({ x, y, fill: color, 'font-size': 11, 'text-anchor': anchor }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = s; svg.append(t); };
    // 网格与刻度（横纵各一套，只有一条纵轴）
    const step = (xmax - xmin) / 50 > 10 ? 100 : 50;
    for (let v = xmin; v <= xmax + 0.1; v += step) { line(X(v), T, X(v), H - B, '#1d2230'); text(X(v), H - B + 16, v); }
    for (let v = 0; v <= 100; v += 20) { line(L, Y(v), W - R, Y(v), '#1d2230'); text(L - 8, Y(v) + 4, v, 'end'); }
    line(L, H - B, W - R, H - B, '#343c4e');
    text((L + W - R) / 2, H - 6, '强度分');
    text(14, (T + H - B) / 2, '表现分', 'middle');
    svg.lastChild.setAttribute('transform', `rotate(-90 14 ${(T + H - B) / 2})`);
    // 毒瘤线：表现分低于它、强度又在前列的算毒瘤车
    const toxicLine = (st.report.config && st.report.config.archive && st.report.config.archive.toxicPerformanceBelow) || 35;
    line(L, Y(toxicLine), W - R, Y(toxicLine), '#5a3a6a');
    text(W - R - 4, Y(toxicLine) - 4, `毒瘤线 ${toxicLine}`, 'end', '#a8a39a');
    // 点：常规在下层，奇特和毒瘤在上层
    const chosen = selectedCodes();
    const order = { normal: 0, odd: 1, toxic: 2 };
    const tip = h('div', { class: 'tip', hidden: true });
    recs.slice().sort((a, b) => (order[a.archiveClass] || 0) - (order[b.archiveClass] || 0)).forEach(rec => {
      const c = classOf(rec), x = X(+rec.strength), y = Y(+rec.performance);
      const g = document.createElementNS(ns, 'g');
      g.style.cursor = 'pointer';
      if (chosen.has(rec.code)) { const ring = document.createElementNS(ns, 'circle'); Object.entries({ cx: x, cy: y, r: 9, fill: 'none', stroke: '#e4e0d6', 'stroke-width': 1.5 }).forEach(([k, v]) => ring.setAttribute(k, v)); g.append(ring); }
      const halo = shape(c.shape, x, y, 6, '#0b0e15');   // 2px 表面色描边，重叠时分得开
      const dot = shape(c.shape, x, y, 4, c.color);
      const hit = document.createElementNS(ns, 'circle'); Object.entries({ cx: x, cy: y, r: 10, fill: 'transparent' }).forEach(([k, v]) => hit.setAttribute(k, v));
      g.append(halo, dot, hit);
      g.addEventListener('pointerenter', () => {
        tip.hidden = false; tip.innerHTML = '';
        const sp = rec.spec || {};
        tip.append(h('b', {}, rec.name || '候选车'), h('br'),
          `${sp.chapter != null ? `${chapterShort(sp.chapter)} · ${stageName(sp.chapter, sp.stage)}` : ''}`, h('br'),
          `${c.name} · ${STYLE[rec.style] || rec.style || '—'} · ${CHASSIS[rec.chassis] || rec.chassis || '—'}`, h('br'),
          `强度 ${fix(rec.strength)}${rec.strengthCi != null ? ` ± ${fix(rec.strengthCi)}` : ''} · 表现 ${fix(rec.performance)}`);
        const box = wrap.getBoundingClientRect(), pt = svg.getBoundingClientRect(), sx = pt.width / W;
        tip.style.left = `${Math.min(box.width - 220, x * sx + 14)}px`;
        tip.style.top = `${y * sx + 4}px`;
      });
      g.addEventListener('pointerleave', () => { tip.hidden = true; });
      g.addEventListener('click', () => openDetail(rec));
      svg.append(g);
    });
    wrap.append(svg, tip);
    const counts = Object.fromEntries(Object.keys(CLASS).map(k => [k, recs.filter(r => (r.archiveClass || 'normal') === k).length]));
    sec.append(wrap, h('div', { class: 'legend' },
      Object.entries(CLASS).map(([k, c]) => h('span', {}, markSvg(k), `${c.name}（${counts[k]}）`)),
      h('span', { class: 'muted' }, '○ 圈 = 选关选中的车')));
    return sec;
  }

  // ---------- 分类网格：性格 × 底盘，一关一张 ----------
  function grid() {
    const r = st.report, stages = [];
    for (const ch of r.chapters || []) if (inChapter(ch.chapter)) (ch.stages || []).forEach((s, si) => stages.push({ ci: ch.chapter, si, s }));
    const sec = h('section', { id: 'grid' }, h('h2', {}, '分类网格'),
      h('p', { class: 'muted small' }, '每一关的候选按"性格 × 底盘"分格（场地是这一关的场地）。报告只保存每关前几名的完整数据，所以格子里只显示这些车；覆盖的格子数来自完整存档。'));
    if (!stages.length) { sec.append(h('div', { class: 'empty-state' }, '这份报告没有关卡数据。')); return sec; }
    if (!st.grid || !stages.some(x => `${x.ci},${x.si}` === st.grid)) st.grid = `${stages[0].ci},${stages[0].si}`;
    const pick = h('select', { onchange: (e) => { st.grid = e.target.value; const old = $('#grid'); old.replaceWith(grid()); } },
      stages.map(x => h('option', { value: `${x.ci},${x.si}`, selected: st.grid === `${x.ci},${x.si}` }, `${chapterShort(x.ci)} · ${(x.s.spec && x.s.spec.name) || stageName(x.ci, x.si)}`)));
    const cur = stages.find(x => `${x.ci},${x.si}` === st.grid);
    const top = cur.s.top || [], arch = cur.s.archive || {};
    const styles = Object.keys(STYLE), chassis = Object.keys(CHASSIS);
    sec.append(h('div', { class: 'ctl', style: 'margin-bottom:6px' }, h('label', {}, '关卡 ', pick),
      h('span', { class: 'muted small' }, `场地：${terrainName(cur.s.spec && cur.s.spec.terrain)} · 候选 ${cur.s.count ?? top.length} 台 · 存档覆盖 ${arch.buckets ?? '—'} 格`)));
    sec.append(h('div', { class: 'scroll' }, h('table', { class: 'gridtbl' },
      h('tr', {}, h('th', {}, '性格 \\ 底盘'), chassis.map(c => h('th', {}, CHASSIS[c]))),
      styles.map(sy => h('tr', {}, h('th', {}, STYLE[sy]), chassis.map(cz => {
        const cell = top.filter(rec => rec.style === sy && rec.chassis === cz);
        return cell.length ? h('td', {}, cell.map(rec => thumb(rec))) : h('td', { class: 'empty' }, '—');
      }))))));
    return sec;
  }

  // ---------- 毒瘤车与奇特构筑 ----------
  function archiveSection() {
    const r = st.report;
    const sec = h('section', { id: 'archive' }, h('h2', {}, '毒瘤车与奇特构筑'),
      h('p', { class: 'muted small' }, '毒瘤车：强度在本档前列、表现分低于毒瘤线，不会用于关卡，保留下来给你看它是怎么赢的。奇特构筑：特征明显偏离常规、强度不低于中位数。'));
    const groups = [];
    if (r.lite) {
      const rows = allRecords().filter(c => c.archiveClass === 'toxic' || c.archiveClass === 'odd');
      if (rows.length) groups.push({ title: '候选车库', toxic: rows.filter(c => c.archiveClass === 'toxic'), odd: rows.filter(c => c.archiveClass === 'odd') });
    } else {
      for (const ch of r.chapters || []) {
        if (!inChapter(ch.chapter)) continue;
        (ch.stages || []).forEach((s, si) => {
          const known = new Map((s.top || []).map(rec => [rec.code, rec]));
          const recOf = (code, cls, cells) => known.get(code) ? { ...known.get(code), archiveClass: cls } : { code, cells, archiveClass: cls, name: '', spec: s.spec, codeOnly: true };
          const a = s.archive || {};
          const toxic = (a.toxicCodes || []).map((code, i) => recOf(code, 'toxic', (a.toxicCells || [])[i]));
          const odd = (a.oddCodes || []).map((code, i) => recOf(code, 'odd', (a.oddCells || [])[i]));
          if (toxic.length || odd.length) groups.push({ title: `${chapterShort(ch.chapter)} · ${(s.spec && s.spec.name) || stageName(ch.chapter, si)}`, toxic, odd });
        });
      }
    }
    if (!groups.length) { sec.append(h('div', { class: 'empty-state' }, '这份数据里没有毒瘤车或奇特构筑。')); return sec; }
    const cap = (rec) => (rec.codeOnly ? '只有分享码' : `强 ${fix(rec.strength)} · 表 ${fix(rec.performance)}`);
    for (const g of groups) {
      sec.append(h('h3', {}, g.title));
      if (g.toxic.length) sec.append(h('div', {}, h('span', { class: 'small muted' }, markSvg('toxic'), `毒瘤车 ${g.toxic.length}`), h('div', {}, g.toxic.map(rec => thumb(rec, cap(rec))))));
      if (g.odd.length) sec.append(h('div', {}, h('span', { class: 'small muted' }, markSvg('odd'), `奇特构筑 ${g.odd.length}`), h('div', {}, g.odd.map(rec => thumb(rec, cap(rec))))));
    }
    return sec;
  }

  // ---------- 详情 ----------
  function stageOpponent(rec) {
    const sp = rec.spec || {};
    if (sp.chapter == null || sp.stage == null) return null;
    const o = SA.CAMPAIGN[sp.chapter] && SA.CAMPAIGN[sp.chapter].stages[sp.stage];
    if (!o) return null;
    return { o, v: SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []) };
  }
  // 按报告里的种子重跑典型对局：和 tools/evolve.js 的 duel 同样的参数（候选车在左、这一关的战役对手在右）
  function replay(rec) {
    const v = vehicleOf(rec), opp = stageOpponent(rec), t = rec.typical;
    if (!v || !opp || !t || t.seed == null) return null;
    return SA.Battle.simulate({ p: v, e: opp.v, pAim: 0.8, eAim: 0.8, pStyle: opp.o.style || 'wander', eStyle: 'wander', terrain: (rec.spec && rec.spec.terrain) || 'flat', seed: t.seed });
  }
  const winnerName = (w) => (w === 'p' ? '候选车胜' : w === 'e' ? '关卡原车胜' : '平手');
  function testDrive(rec) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PICKS_KEY)) || []; } catch (e) { list = []; }
    const sp = rec.spec || {};
    const name = rec.name || `进化车 ${rec.code.slice(4, 10)}`;
    list = [{ name, code: rec.code, cells: rec.cells || null, terrain: sp.terrain || 'flat', style: rec.style || null, from: sp.chapter != null ? `${chapterShort(sp.chapter)} · ${stageName(sp.chapter, sp.stage)}` : '' },
      ...list.filter(x => x.code !== rec.code)].slice(0, 20);
    try { localStorage.setItem(PICKS_KEY, JSON.stringify(list)); } catch (e) { /* 隐私模式：试驾场里就看不到了 */ }
    window.open('../index.html#sandbox=evolve', '_blank', 'noopener');
  }
  function copyText(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = '已复制'; setTimeout(() => { btn.textContent = old; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }
  function openDetail(rec) {
    const v = vehicleOf(rec), c = classOf(rec), sp = rec.spec || {}, s = rec.stats || {};
    const box = $('#detail'); box.innerHTML = '';
    const close = h('button', { class: 'btn', onclick: closeDetail }, '关闭');
    const replayOut = h('span', { class: 'small' });
    const kv = (k, val) => h('tr', {}, h('th', {}, k), h('td', {}, val));
    box.append(
      h('div', { class: 'detail-head' }, h('h2', {}, markSvg(rec.archiveClass || 'normal', 14), ' ', rec.name || '候选车'), close),
      h('div', { class: 'detail-body' },
        h('div', { class: 'detail-pic' }, v ? SA.UI.vehiclePreview(v, 3) : h('span', { class: 'bad' }, '分享码无法解析')),
        h('div', { class: 'detail-info' },
          h('table', {},
            kv('来源', sp.chapter != null ? `${chapterShort(sp.chapter)} · ${stageName(sp.chapter, sp.stage)} · ${terrainName(sp.terrain)}` : '—'),
            kv('分类', `${c.name} · ${STYLE[rec.style] || rec.style || '—'} · ${CHASSIS[rec.chassis] || rec.chassis || '—'}`),
            kv('强度分', rec.codeOnly ? '报告只保存了分享码' : `${fix(rec.strength)}${rec.strengthCi != null ? ` ± ${fix(rec.strengthCi)}` : ''}${rec.terrainStrength != null && sp.terrain && sp.terrain !== 'flat' ? `（平地 ${fix(rec.terrainStrength)}，地形专长 ${rec.terrainDelta >= 0 ? '+' : ''}${fix(rec.terrainDelta)}）` : ''}`),
            kv('表现分', rec.codeOnly ? '—' : fix(rec.performance, 1)),
            kv('属性', s.hp != null ? `耐久 ${fix(s.hp)} · 秒伤 ${fix(s.dps, 1)} · 升温 ${fix(s.heatDps, 1)} · 水 ${fix(s.water)} · 冷却 ${fix(s.cool, 1)} · 评分 ${fix(s.rating)} · 价值 £${fix(s.value)}` : '—')),
          rec.styleTrials && rec.styleTrials.length ? h('div', {}, h('h3', {}, '四种性格试跑'),
            h('table', {}, h('tr', {}, ['性格', '表现分', '胜率'].map(t => h('th', {}, t))),
              rec.styleTrials.map(x => h('tr', {}, h('td', {}, STYLE[x.style] || x.style, x.style === rec.style ? h('span', { class: 'chip' }, '绑定') : null), h('td', { class: 'num' }, fix(x.performance, 1)), h('td', { class: 'num' }, pct(x.winRate)))))) : null,
          h('h3', {}, '典型对局'),
          rec.typical ? h('p', { class: 'small' }, `对手：这一关的原车 · ${winnerName(rec.typical.winner)} · ${fix(rec.typical.t, 1)} 秒 · ${rec.typical.reason || '—'} · 种子 ${rec.typical.seed ?? '—'}`) : h('p', { class: 'muted small' }, '报告里没有记录典型对局。'),
          h('div', { class: 'row-btns' },
            h('button', { class: 'btn', disabled: !(rec.typical && rec.typical.seed != null && stageOpponent(rec)), onclick: () => {
              const res = replay(rec);
              if (!res) { replayOut.textContent = '无法复现：缺少种子或对手。'; replayOut.className = 'small bad'; return; }
              const same = res.winner === rec.typical.winner && Math.abs(res.t - rec.typical.t) < 0.05 && res.reason === rec.typical.reason;
              replayOut.className = `small ${same ? 'ok' : 'bad'}`;
              replayOut.textContent = `${same ? '✓ 复现一致' : exact(rec) ? '✗ 结果不同（规则可能已改）' : '✗ 结果不同：这份老报告没有完整模块清单，改装等级无法还原'}：${winnerName(res.winner)} · ${fix(res.t, 1)} 秒 · ${res.reason || '—'}`;
            } }, '按种子复现'),
            h('button', { class: 'btn primary', disabled: !v, onclick: () => testDrive(rec) }, '去试驾场和它打一场'),
            replayOut),
          h('h3', {}, '分享码'),
          h('textarea', { class: 'code', readonly: true }, rec.code || ''),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: (e) => copyText(rec.code || '', e.currentTarget) }, '复制分享码')),
          rec.patch ? h('div', {}, h('h3', {}, '导出补丁（只替换车的数据）'),
            h('textarea', { class: 'code', readonly: true, style: 'min-height:120px' }, JSON.stringify(rec.patch, null, 2)),
            h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: (e) => copyText(JSON.stringify(rec.patch, null, 2), e.currentTarget) }, '复制补丁'))) : null)));
    $('#overlay').hidden = false;
    close.focus();
  }
  function closeDetail() { $('#overlay').hidden = true; }
  $('#overlay').addEventListener('pointerdown', (e) => { if (e.target.id === 'overlay') closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  // ---------- 启动 ----------
  async function refreshList(keep) {
    const src = $('#src');
    const reports = await listReports(), cand = await hasCandidates();
    const opts = [...reports.map(n => [`out/${n}`, `运行报告 · ${new Date(+n.match(/\d+/)[0]).toLocaleString()}`]), ...(cand ? [['evolve-candidates.json', '候选车库（evolve-candidates.json）']] : [])];
    src.innerHTML = '';
    src.append(...opts.map(([v, n]) => h('option', { value: v, selected: v === keep }, n)));
    if (!opts.length) {
      banner('还没有报告。', '');
      out.innerHTML = '';
      out.append(h('div', { class: 'empty-state' }, '在仓库根目录跑一次生成器，报告会写进 ', h('code', {}, 'tools/out/'), '：', h('br'),
        h('code', {}, 'node tools/evolve.js --sample 2 2'), '（2 章、每对 2 局的快速试跑）', h('br'),
        '也可以用上面的"打开本地文件"读一份报告 JSON。'));
      return;
    }
    const pickV = opts.some(o => o[0] === keep) ? keep : opts[0][0];
    src.value = pickV;
    load(pickV, src.selectedOptions[0].textContent);
  }
  $('#src').onchange = (e) => load(e.target.value, e.target.selectedOptions[0].textContent);
  $('#reload').onclick = () => refreshList($('#src').value);
  $('#chap').onchange = (e) => { st.chapter = e.target.value; render(); };
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { use(normalize(JSON.parse(await f.text())), `本地文件 · ${f.name}`); } catch (err) { banner(`无法读取 ${f.name}：${err.message}`, 'stale'); }
    e.target.value = '';
  };
  currentFingerprint().then(fp => { st.fingerprint = fp; }).catch(() => { st.fingerprint = null; }).finally(() => refreshList());
})();
