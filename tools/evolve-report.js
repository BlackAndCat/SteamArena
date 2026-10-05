// 进化擂台：读取 tools/evolve.js 的运行报告（tools/out/evolve-*.json）或候选车库（tools/evolve-candidates.json）。
// 第一屏是「选关结果」：每关一张卡。勾着「手动选择」的关先显示游戏里的关卡车（后台关卡工作台保存的那辆）和它在进化里的成绩，
// 取消勾选后显示进化选出的车；点卡片，这一排下面展开这一关的全部候选。往下翻是强度 × 表现散点、毒瘤车与奇特构筑、报告信息。
// 原报告只读；关卡车只在后台关卡工作台「保存」（这里的「换上这辆」只把车交过去当草稿），这里能改的只有「手动选择」这一个勾。
// 收藏的候选另存在本机进化擂台库。外观同后台（tools/console.css）。
(() => {
  const h = SA.h;
  const $ = (s) => document.querySelector(s);
  const out = $('#out');

  // 三类存档：纸面上也分得开的三种颜色，另外用形状区分，不单靠颜色
  const CLASS = {
    normal: { name: '常规', color: '#9a6b1d', shape: 'circle', glyph: '●' },
    odd: { name: '奇特构筑', color: '#127f87', shape: 'diamond', glyph: '◆' },
    toxic: { name: '毒瘤车', color: '#8d3aa6', shape: 'square', glyph: '■' },
  };
  // 性格名和战斗规则共用 SA.AI_STYLES；旧报告里的四种老名字照旧能显示
  const STYLE = Object.fromEntries([['rush', '冲锋'], ['kite', '风筝'], ['turtle', '龟缩'], ['wander', '游走'], ['roam', '游走'],
    ...(SA.AI_STYLES || []).map(s => [s.id, s.name])]);
  const CHASSIS = { track: '履带', quad: '四足', biped: '双足' };
  const COND = {
    construction: '构筑合法', modulePool: '本关模块', budget: '财富上限', grid: '车间格子', materials: '材料',
    reward: '带奖励件', nonToxic: '不是毒瘤车', target: '对上一关胜率', terrain: '地形条件', bossGeneric: 'Boss 通用型',
    previousBoss: '上一档 Boss 打它 < 30%', rewardLowerBound: '奖励车打上一档 Boss ≥ 60%', rewardCrushGuard: '防碾压：上一档 Boss 打它 ≥ 15%',
    rewardEffect: '奖励件生效', rewardContrast: '对照测试（换成甲片后胜率下降）',
    manualReview: '手工修改，待重新模拟',
  };
  const PICKS_KEY = 'steam_arena_evolve_picks';   // 和 js/camp.js 试驾场的 evolve 来源共用
  const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const fix = (x, d = 0) => (x == null || !Number.isFinite(+x) ? '—' : (+x).toFixed(d));
  const terrainName = (k) => (SA.TERRAINS[k] ? SA.TERRAINS[k].name : k || '平地');
  const styleName = (k) => STYLE[k] || k || '—';
  const chassisName = (k) => CHASSIS[k] || SA.MODULES[k]?.name || k || '—';
  const targetText = (t) => (Array.isArray(t) ? `${Math.round(t[0] * 100)}–${Math.round(t[1] * 100)}%` : '—');
  const stageName = (ci, si) => {
    const raw = SA.CAMPAIGN[ci] && SA.CAMPAIGN[ci].stages[si];
    const s = raw && SA.StageCars ? SA.StageCars.merge(raw, ci, si) : raw;
    return s ? s.name : `第 ${ci + 1} 章第 ${si + 1} 关`;
  };
  const chapterShort = (ci) => (SA.CAMPAIGN[ci] ? SA.CAMPAIGN[ci].name.split(' · ')[0] : `第 ${ci + 1} 章`);
  const chapterPlace = (ci) => (SA.CAMPAIGN[ci] ? SA.CAMPAIGN[ci].name.split(' · ')[1] || '' : '');
  const stageCode = (ci, si) => `${ci}-${si + 1}`;   // 和后台关卡列表同一种编号

  // 页面记忆仅保存选择；运行报告仍从服务器读取，不复制报告或自动发起模拟。
  const MEMORY_KEY = 'steam_arena_evolve_page_v1';
  const RUN_FIELDS = ['mode', 'chapter', 'stage', 'origin', 'after-count', 'population', 'generations', 'games', 'workers', 'seed'];
  const PAGE_HASHES = ['#overview', '#picks', '#scatter', '#grid', '#archive', '#selftest'];
  let memory = {}, generationReady = false;
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORY_KEY));
    if (saved?.version === 1) memory = saved;
  } catch (_) { /* 损坏或禁用的存储回到页面默认值。 */ }
  const st = { report: null, rawReport: null, label: '', chapter: memory.chapter ?? 'all', fingerprint: null, grid: null, source: null, drawer: null };
  function rememberPage() {
    memory = { ...memory, version: 1 };
    if (st.rawReport && st.source) { memory.chapter = st.chapter; memory.grid = st.grid; }
    if (st.rawReport) memory.source = st.source;
    if (PAGE_HASHES.includes(location.hash)) memory.hash = location.hash;
    // 异步目录尚未建立时保留历史参数，避免默认空选项覆盖它们。
    if (generationReady) memory.run = Object.fromEntries(RUN_FIELDS.map(key => [key, $(`#run-${key}`).value]));
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch (_) { /* 存储不可用不影响生成和查看。 */ }
  }
  function restoreField(key, value) {
    const field = $(`#run-${key}`);
    if (value == null) return;
    if (field.tagName === 'SELECT') {
      if ([...field.options].some(option => option.value === String(value))) field.value = String(value);
    } else {
      const fallback = field.value;
      field.value = String(value);
      if (!field.value || !Number.isInteger(+field.value) || !field.checkValidity()) field.value = fallback;
    }
  }
  if (!location.hash && PAGE_HASHES.includes(memory.hash)) location.hash = memory.hash;

  // ---------- 规则指纹：和 tools/evolve.js 的 ruleFingerprint 同一算法 ----------
  const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v);
  async function currentFingerprint() {
    const names = (await fetch('/__config/list', { cache: 'no-store' }).then(r => r.json())).names;
    const files = ['js/modules.js', 'js/vehicle.js', 'js/content.js', 'js/state.js', 'js/camp.js', 'js/battle.js', 'tools/campaign-map.js', 'tools/evolve-stage-rules.json', 'tools/evolve-config.js',
      ...names.slice().sort().map(name => `config/${name}.json`)];
    const texts = await Promise.all([...files.map(f => `../${f}`), 'evolve-config.js'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text())));
    const module = { exports: {} };
    new Function('module', 'exports', 'require', texts[files.length])(module, module.exports, () => ({}));
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
      // 历史报告有较短的数字文件名，按数字排序才能让新生成的时间戳报告排在最前。
      return [...new Set(names)].sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
    } catch (e) { return []; }
  }
  async function hasCandidates() {
    try { return /href="evolve-candidates\.json"/.test(await fetch('./', { cache: 'no-store' }).then(r => (r.ok ? r.text() : ''))); } catch (e) { return false; }
  }
  // 候选车库只有分享码、标签和分数，整理成和报告里一样的记录形状
  function normalize(data) {
    if (data && Array.isArray(data.chapters)) return SA.Camp.migrateEvolutionReport(data);
    const rows = (data && data.candidates) || [];
    return {
      campaignLayout: data && data.campaignLayout, generatedAt: data && data.generatedAt, rules: data && data.rules, lite: true, chapters: [], selectionFailures: [],
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
      st.source = url; use(normalize(data), label);
    } catch (e) { banner(`读取失败：${label}（${e.message}）`, 'stale'); out.replaceChildren(h('div', { class: 'sheet' }, emptyState(`读取失败：${label}（${e.message}）。点上面的「刷新列表」再试，或换一份报告。`))); }
  }
  function use(report, label) {
    st.rawReport = report; st.report = report; st.label = label; st.grid = st.source === memory.source ? memory.grid : null;
    render();
  }

  // 旧报告没有聚合胜率时不从强度分倒推；手工改车后也不得继续显示旧车战绩。
  function winText(rec) {
    if (rec?.needsEvaluation) return '待重新模拟';
    if (!Number.isFinite(rec?.winRate) || !rec.games) return '未记录';
    return `${(rec.winRate * 100).toFixed(1)}% · ${rec.games} 局`;
  }
  function arenaRow(rec) { return rec.arenaId ? SA.EvolveArena.get(rec.arenaId) : SA.EvolveArena.find(rec); }
  function toggleFavorite(rec) {
    try {
      const row = arenaRow(rec), favorite = !row?.favorite;
      if (row) SA.EvolveArena.update(row.id, { favorite }); else SA.EvolveArena.remember(rec, { favorite });
    } catch (error) { banner(error.message, 'stale'); }
  }
  // 「换上这辆」：把车交给后台关卡工作台当草稿（console.js 读 SWAP_KEY），点那边的「保存」才变成这一关的车
  const SWAP_KEY = 'steam_arena_stage_swap';
  function openStage(ci, si) {
    const hash = `#/stage/${ci},${si}/build`;
    try { if (window.top !== window && /\/console\.html$/.test(window.top.location.pathname)) { window.top.location.hash = hash; return; } } catch (_) { /* 嵌在别处就整页跳过去 */ }
    location.href = `console.html${hash}`;
  }
  function swapIntoStage(rec) {
    const sp = rec.spec || {};
    if (!Number.isInteger(sp.chapter) || !Number.isInteger(sp.stage)) { banner('这台车没有记录是哪一关的，换不上', 'stale'); return; }
    try { sessionStorage.setItem(SWAP_KEY, JSON.stringify({ key: `${sp.chapter},${sp.stage}`, name: rec.name || '', cells: rec.cells || null, code: rec.cells ? null : rec.code || null })); }
    catch (_) { banner('浏览器不让暂存，换不上；可以复制分享码到工作台「导入…」', 'stale'); return; }
    openStage(sp.chapter, sp.stage);
  }

  // ---------- 关卡车：游戏里这一关真正用的车（config/stage-cars.json，只在后台关卡工作台保存） ----------
  // 记录里的 locked 在这里叫「手动选择」：勾着时卡片先显示它；进化擂台生成时它每代占一个固定席位、单独记成绩（报告的 stage.manual）。
  const carMemo = new Map();
  function stageCarOf(ci, si) {
    const key = `${ci},${si}`;
    if (carMemo.has(key)) return carMemo.get(key);
    const stg = SA.CAMPAIGN[ci]?.stages?.[si];
    let car = null;
    if (stg && !stg.unfinished && stg.source === 'manual' && stg.vehicle && SA.StageCars) {
      const cells = SA.StageCars.cellsOf(stg.vehicle), stats = SA.V.stats(stg.vehicle);
      car = { stageCar: true, pinned: stg.locked !== false, updatedAt: stg.stageCar?.updatedAt || null,
        name: stg.vehicleName || stg.vehicle.name || stg.name, cells, code: SA.V.encode(stg.vehicle), style: stg.style || 'wander',
        chassis: cells.map(row => row[3]).find(id => SA.MODULES[id]?.layer === 'chassis') || null,
        spec: { chapter: ci, stage: si, terrain: stg.terrain || 'flat' }, stats: { value: stats.value, hp: stats.hp, dps: stats.dps, rating: stats.rating } };
    }
    carMemo.set(key, car);
    return car;
  }
  const sortedCells = (cells) => JSON.stringify((cells || []).map(row => [...row]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  // 报告测的是不是现在这辆：车和性格都没改过才算
  function measuredFor(s, car) {
    const m = s?.manual;
    return car && m && sortedCells(m.cells) === sortedCells(car.cells) && (m.style || 'wander') === car.style ? m : null;
  }
  const stageRecord = (car, measured) => (measured ? { ...measured, stageCar: true, pinned: car.pinned } : car);
  // 勾掉 / 勾上「手动选择」：只改这一关记录的 locked，别的字段原样（tools/serve.py 按字段合并）
  async function setPinned(ci, si, pinned) {
    const id = `${ci}:${si}`, rec = SA.STAGE_CARS?.records?.[id];
    try {
      if (!rec?.cells) throw new Error('这一关没有关卡车记录');
      const response = await fetch('/__stage-cars/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workbenchVersion: 1, target: { kind: 'stage', id }, record: { id, source: 'manual', cells: rec.cells, locked: pinned } }) });
      const saved = await response.json().catch(() => ({}));
      if (!response.ok || !saved.ok) throw new Error(saved.error || `HTTP ${response.status}`);
      reloadStageCars();
      try { const channel = new BroadcastChannel('steam-arena-stage-cars'); channel.postMessage({ type: 'saved', id }); channel.close(); } catch (_) { /* 别的后台标签刷新后才看到 */ }
    } catch (error) { banner(`「手动选择」没改成：${error.message}`, 'stale'); }
    if (st.rawReport) render();
  }
  function reloadStageCars() {
    SA.Config.clear('stage-cars');
    const fresh = SA.Config.get('stage-cars');
    Object.assign(SA.STAGE_CARS, fresh);
    SA.StageCars.applyToCampaign();
    carMemo.clear();
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

  // ---------- 车图：和后台战役地图同一种画法（透明底、裁掉空边、整数倍放大） ----------
  const pics = new Map();
  function trimCanvas(src) {
    const w = src.width, ht = src.height, d = src.getContext('2d').getImageData(0, 0, w, ht).data;
    let x0 = w, y0 = ht, x1 = -1, y1 = -1;
    for (let y = 0; y < ht; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const c = document.createElement('canvas');
    if (x1 < 0) { c.width = c.height = 1; return c; }
    c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }
  // 放得下就按整数倍放大（最多 max 倍，画成真的大画布）；盒子比车小时由样式缩小，缩小的那张改用平滑缩放（见 softenPics）
  function carPic(rec, w, ht, max = 3) {
    const v = vehicleOf(rec);
    if (!v) return null;
    const key = rec.cells ? JSON.stringify(rec.cells) : rec.code;
    if (!pics.has(key)) {
      let src = null;
      try { src = trimCanvas(SA.SPR.renderVehicle(v, { key: 'evolve-report', t: 0, heat: 0.45, water: 0.8 })); } catch (e) { src = null; }
      pics.set(key, src);
    }
    const src = pics.get(key);
    if (!src) return null;
    const s = Math.max(1, Math.min(max, Math.floor(Math.min(w / src.width, ht / src.height))));
    const cv = document.createElement('canvas');
    cv.width = src.width * s; cv.height = src.height * s;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, cv.width, cv.height);
    return cv;
  }
  function softenPics() {
    for (const c of document.querySelectorAll('#out canvas, #detail canvas')) c.classList.toggle('soft', c.clientHeight < c.height - 0.5 || c.clientWidth < c.width - 0.5);
  }
  // 第一屏尽量放下全部选关卡片：按窗口高度算车图框高（最多两三排；排数再多就用默认高度往下翻）
  function fitBoard() {
    const grid = document.querySelector('.picks'), cards = grid ? [...grid.querySelectorAll('.pk')] : [];
    if (!cards.length) return;
    grid.style.removeProperty('--carh');
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, rows = Math.ceil(cards.length / cols);
    const css = getComputedStyle(grid), gap = parseFloat(css.rowGap) || 0, padB = parseFloat(css.paddingBottom) || 0;
    const top = grid.getBoundingClientRect().top + scrollY + (parseFloat(css.paddingTop) || 0);
    const rest = Math.max(...cards.map(c => c.offsetHeight - (c.querySelector('.pk-car')?.offsetHeight || 0)));
    const carH = Math.floor((innerHeight - top - padB - (rows - 1) * gap) / rows - rest);
    grid.style.setProperty('--carh', `${rows <= 3 && carH >= 96 ? Math.min(carH, 184) : 132}px`);
    softenPics();
  }

  const unreadable = () => h('span', { class: 'bad', style: 'font-size:12px' }, '分享码无法解析');
  function thumb(rec, caption) {
    return h('button', { type: 'button', class: 'thumb', title: `${rec.name || '候选车'} · 点开看详情`, onclick: () => openDetail(rec) },
      carPic(rec, 150, 64, 2) || unreadable(),
      h('span', { class: 'cap' }, caption != null ? caption : `强 ${fix(rec.strength)} · 表 ${fix(rec.performance)}`));
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
    else if (kind === 'square') { el = document.createElementNS(ns, 'rect'); el.setAttribute('x', x - r); el.setAttribute('y', y - r); el.setAttribute('width', r * 2); el.setAttribute('height', r * 2); }
    else { el = document.createElementNS(ns, 'circle'); el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', r); }
    el.setAttribute('fill', color);
    return el;
  }
  const emptyState = (text) => h('div', { class: 'empty-state' }, text);

  // ---------- 页面 ----------
  // 顶栏右边的规则指纹牌：放不下的完整说明放在悬停提示里
  function banner(text, cls = '', short) {
    const b = $('#banner');
    b.className = `rule ${cls}`; b.textContent = short || text; b.title = text;
  }
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
  // 当前章节下的全部关：报告里的关、游戏里已有关卡车的关（报告里还没有也照样一张卡），
  // 以及生成器目录里有、两样都没有的关（「未生成」空位）
  function stageRows(withGhosts = false) {
    const rows = new Map(), put = (ci, si, row) => { if (!rows.has(`${ci},${si}`)) rows.set(`${ci},${si}`, { ci, si, ...row }); };
    for (const ch of st.report.chapters || []) {
      if (!inChapter(ch.chapter)) continue;
      (ch.stages || []).forEach((s, i) => put(ch.chapter, s.spec?.stage ?? i, { s }));
    }
    if (withGhosts) {
      SA.CAMPAIGN.forEach((ch, ci) => { if (inChapter(ci)) (ch.stages || []).forEach((_, si) => { if (stageCarOf(ci, si)) put(ci, si, { s: null }); }); });
      const shown = new Set([...rows.values()].map(x => x.ci));
      if (runCatalog) for (const ch of runCatalog.chapters) if (shown.has(ch.chapter)) for (const row of ch.stages) put(ch.chapter, row.stage, { ghost: row });
    }
    return [...rows.values()].sort((a, b) => a.ci - b.ci || a.si - b.si);
  }

  const chapterList = () => [...new Set([...(st.report.chapters || []).map(ch => ch.chapter), ...(st.report.candidates || []).map(c => c.spec && c.spec.chapter),
    ...SA.CAMPAIGN.map((ch, ci) => ((ch.stages || []).some((_, si) => stageCarOf(ci, si)) ? ci : null))]
    .filter(x => x != null))].sort((a, b) => a - b);
  function render() {
    st.report = SA.EvolveArena.merge(st.rawReport);
    carMemo.clear();
    const r = st.report;
    if (st.chapter !== 'all' && !chapterList().includes(+st.chapter)) st.chapter = 'all';
    // 规则指纹
    const same = st.fingerprint && r.rules === st.fingerprint && !(r.candidates || []).some(rec => rec.rules && rec.rules !== st.fingerprint);
    if (!r.rules) banner(`${st.label}：报告里没有规则指纹，无法判断是否过期。`, '', '规则指纹：报告里没有');
    else if (!st.fingerprint) banner(`${st.label} · 规则指纹 ${r.rules}（当前规则的指纹计算失败，无法比较）`, '', `规则指纹 ${r.rules} · 无法比较`);
    else if (same) banner(`${st.label} · 规则指纹 ${r.rules}，和当前规则一致。`, 'fresh', '规则和当前一致');
    else banner(`部分数据过期，需要复核：当前规则是 ${st.fingerprint}，报告是 ${r.rules}。可在上方选择相应章 / 关重新模拟；其余关卡保留原有结果。`, 'stale', '规则已改：部分数据过期，需复核');
    out.replaceChildren(picks());
    out.append(scatter(), archiveSection(), reportInfo());
    rememberPage();
    fitBoard();
    showDrawer(false);
  }

  // ---------- 第一屏：选关结果 ----------
  function picks() {
    const r = st.report, rows = r.lite ? [] : stageRows(true), real = rows.filter(x => !x.ghost), chaps = chapterList();
    const manual = real.filter(x => stageCarOf(x.ci, x.si)?.pinned).length, ran = real.filter(x => x.s?.spec);
    const picked = ran.filter(x => x.s.selected).length;
    const seg = chaps.length > 1 ? h('nav', { class: 'seg', 'aria-label': '章节' },
      [['all', '全部'], ...chaps.map(ci => [String(ci), chapterShort(ci)])].map(([v, name]) =>
        h('button', { type: 'button', class: String(st.chapter) === v ? 'on' : '', onclick: () => { st.chapter = v; st.drawer = null; render(); } }, name))) : null;
    const sum = r.lite ? h('span', { class: 'sum' }, `候选车库 · ${allRecords().length} 台`)
      : h('span', { class: 'sum' }, '本页含已有记录 · ', h('b', {}, real.length), ' 关 · 手动选择 ', h('b', {}, manual), ' · 进化选出 ', h('b', {}, picked),
        ran.length - picked ? [' · ', h('span', { class: 'warn' }, `没选出 ${ran.length - picked}`)] : null,
        r.generatedAt ? ` · 生成于 ${new Date(r.generatedAt).toLocaleString()}` : null, h('span', { class: 'tip-text' }, ' · 点卡片看这一关的其他候选'));
    const sec = h('section', { id: 'picks' }, h('div', { class: 'board-h' }, h('h2', {}, '选关结果'), seg, sum));
    const cards = h('div', { class: 'picks' });
    if (r.lite) cards.append(emptyState('这是候选车库（只有分享码、标签和分数），没有选关结果。要看每关选出的车，请在上面选一份 tools/out/ 里的运行报告。'));
    else if (!rows.length) cards.append(emptyState('这份报告里还没有关卡。在上面的「定向模拟」选好章 / 关，点「模拟并生成报告」，选出的车会一关一张卡排在这里。'));
    let lastCi = null;
    for (const x of rows) { cards.append(x.ghost ? ghostCard(x, x.ci !== lastCi) : pickCard(x, x.ci !== lastCi)); lastCi = x.ci; }
    sec.append(cards);
    return sec;
  }
  const chapterTab = (ci) => h('div', { class: 'pk-tab' }, chapterShort(ci), chapterPlace(ci) ? h('small', {}, chapterPlace(ci)) : null);
  // 没选出车时，筛选里离目标最近的那一台（生成器用它的证据写失败原因）
  function diagnosticOf(s) {
    if (s.provisional) return s.provisional;
    const ev = s.selection || {};
    const row = (ev.verified || []).find(v => v.validationSeed != null && v.validationSeed === ev.validationSeed);
    return row ? (s.top || []).find(rec => rec.name === row.name) || null : null;
  }
  let runCatalog = null;   // 生成器目录（initGeneration 读取）；卡片上的「重跑」和「未生成」空位要用
  /** 三处共用预算提示：当前目录优先，报告上限仅作回退，零上限同样有效。 */
  function budgetBlock(rec, spec = rec?.spec || {}) {
    const currentLimit = runCatalog?.budgets?.find(row => row.chapter === spec.chapter && row.stage === spec.stage)?.budget ??
      runCatalog?.chapters.find(ch => ch.chapter === spec.chapter)?.stages.find(row => row.stage === spec.stage)?.budget;
    const limit = Number.isFinite(currentLimit) && currentLimit >= 0 ? currentLimit : Number.isFinite(spec.budget) && spec.budget >= 0 ? spec.budget : null;
    const used = Number.isFinite(rec?.stats?.value) ? rec.stats.value : null;
    const exceeded = limit != null && used != null && used > limit, money = n => Number(n.toFixed(2));
    return h('div', { class: `budget-info${exceeded ? ' bad' : ''}` },
      `已用预算 ${used == null ? '未记录' : `£${money(used)}`} / 预算上限 ${limit == null ? runCatalog ? '未配置' : '暂不可用' : `£${money(limit)}`}`,
      exceeded ? h('div', {}, `超出 £${money(used - limit)}，仅提示，仍可参与进化`) : null);
  }
  function canAim(ci, si) { return !!(runCatalog && catalogChapter(ci)?.stages.some(row => row.stage === si)); }
  const aimButton = (ci, si, label = '重跑') => h('button', { type: 'button', class: 'btn sm ghost aim', disabled: !canAim(ci, si),
    title: canAim(ci, si) ? '把上面的生成范围设成这一关，再点「模拟并生成报告」开跑' : '生成器目录里没有这一关', onclick: () => aimAt(ci, si) }, `↻ ${label}`);
  // 车图左上角的「手动选择」勾：勾着 = 卡片显示关卡车、进化时给它留席位；勾掉 = 卡片显示进化选出的车
  const pinTag = (ci, si, car) => h('label', { class: `pin${car.pinned ? ' on' : ''}`,
    title: car.pinned ? `关卡车「${car.name}」优先：卡片显示它，进化时每代给它留一个席位并记成绩。勾掉后卡片改显示进化选出的车，也不再留席位`
      : `勾上：关卡车「${car.name}」优先显示，进化时每代给它留一个席位并记成绩` },
    h('input', { type: 'checkbox', checked: car.pinned, onchange: (e) => setPinned(ci, si, e.target.checked) }), '手动选择');
  // 卡片上除了按钮和勾，点哪里都展开 / 收起这一关的候选
  const cardClick = (ci, si) => (e) => { if (!e.target.closest('button, input, label, a, select, textarea')) toggleDrawer(ci, si); };
  const cardKey = (ci, si) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggleDrawer(ci, si); } };
  function pickCard({ ci, si, s }, first) {
    s = s || {};
    const stg = SA.CAMPAIGN[ci]?.stages?.[si] || {};
    const spec = s.spec || {}, sel = s.selected, ev = s.selection || {}, failed = ev.failed || [];
    // 选关卡片只用文字和车图：tools/evolve-report-origin-check.js 在没有擂台库和 SVG 的最小页面里渲染它
    const car = stageCarOf(ci, si), diag = sel ? null : diagnosticOf(s);
    const manual = !!car && (car.pinned || (!sel && !diag));
    const measured = manual ? measuredFor(s, car) : null, mev = measured?.evidence || {};
    const shown = manual ? stageRecord(car, measured) : sel || diag;
    const row = !manual && sel && SA.EvolveArena ? arenaRow(sel) : null, name = spec.name || stageName(ci, si);
    let state, verdict;
    if (manual) {
      const n = (mev.failed || []).length;
      state = !measured ? 'none' : measured.unusable ? 'bad' : n ? 'warn' : 'ok';
      verdict = !measured ? (s.spec ? '待重新模拟' : '还没跑过') : measured.unusable ? '✗ 不能出战' : n ? `${n} 条未满足` : '✓ 达标';
    } else {
      state = sel ? (failed.length ? 'warn' : 'ok') : 'bad';
      verdict = sel ? (failed.length ? (ev.status || '待复核') : '✓ 选出') : '✗ 没选出';
    }
    const missing = !manual && sel && SA.EvolveArena ? SA.EvolveArena.missingReward(sel) : null;
    // 新报告的明确空奖励优先；只有旧报告缺必带数组时才回退历史显示字段。
    const boss = spec.boss ?? stg.boss, reward = Array.isArray(spec.requiredModules) ? spec.requiredModules[0] || null : spec.rewardModule || stg.spec?.reward || null, terrainKey = spec.terrain || stg.terrain;
    const terrain = terrainKey && terrainKey !== 'flat' ? terrainName(terrainKey) : null;
    const nums = shown ? h('div', { class: 'pk-nums' },
      h('div', { class: 'pk-num', title: '实战测出的强度分（1000 = 和标尺车打平）' }, h('small', {}, '强度'), h('b', {}, fix(shown.strength)), shown.strengthCi != null ? h('em', {}, `±${fix(shown.strengthCi)}`) : null),
      h('div', { class: 'pk-num', title: `同档胜率：${winText(shown)}（平局计半胜）` }, h('small', {}, '同档胜率'),
        shown.needsEvaluation ? h('b', {}, '待测') : Number.isFinite(shown.winRate) && shown.games ? [h('b', {}, `${Math.round(shown.winRate * 100)}%`), h('em', {}, `${shown.games}局`)] : h('b', {}, '—')),
      h('div', { class: 'pk-num', title: '表现分（观众算法，0～100）' }, h('small', {}, '表现'), h('b', {}, fix(shown.performance)))) : null;
    const tev = manual ? mev : ev;   // 「打上一关车」这一行：手动车看它自己的复测，进化车看选车复测
    const shownFailed = manual ? (mev.failed || []) : failed;
    const chips = [
      boss ? h('span', { class: 'chip boss' }, 'Boss') : null,
      reward ? h('span', { class: 'chip', title: '这一关的奖励件，进化选出的车必须带着' }, `奖励 ${SA.MODULES[reward]?.name || reward}`) : null,
      terrain ? h('span', { class: 'chip' }, terrain) : null,
      spec.previewRuleSource ? h('span', { class: 'chip', title: '预算与结构限制临时继承，正式关卡配置未修改' }, `临时继承 ${stageCode(spec.previewRuleSource.chapter, spec.previewRuleSource.stage)}`) : null,
      !manual && shown && shown.archiveClass && shown.archiveClass !== 'normal' ? h('span', { class: 'chip' }, h('span', { style: `color:${classOf(shown).color}` }, classOf(shown).glyph), classOf(shown).name) : null,
      ...shownFailed.filter(k => k !== 'target' || tev.previousWinRate == null).map(k => h('span', { class: 'chip bad', title: manual ? '进化选车的硬条件；手动选择的车不受它限制，只是记下来' : null }, COND[k] || k)),
      missing ? h('span', { class: 'chip bad' }, `缺少奖励：${SA.MODULES[missing]?.name || missing}`) : null,
    ].filter(Boolean);
    const verified = ev.verified || [], pass = verified.filter(v => !(v.failed || []).length).length;
    const oc = !manual ? s.originComparison : null, key = `${ci},${si}`;
    const evolvedLine = manual && s.spec ? h('div', { class: 'pk-line' }, '进化另选 ',
      sel ? [h('b', {}, `强 ${fix(sel.strength)}`), h('span', { class: 'muted' }, ` · 胜率 ${pct(sel.winRate)} · 表现 ${fix(sel.performance)}`)] : h('b', { class: 'bad' }, '没选出')) : null;
    return h('article', { class: `pk${boss ? ' boss' : ''}${!manual && !sel ? ' miss' : ''}${manual ? ' manual' : ''}${st.drawer === key ? ' open' : ''}`,
      'data-stage': key, tabindex: 0, 'aria-expanded': String(st.drawer === key), onclick: cardClick(ci, si), onkeydown: cardKey(ci, si) },
      first ? chapterTab(ci) : null,
      h('div', { class: 'pk-head' },
        h('span', { class: 'pk-code' }, stageCode(ci, si)),
        h('h3', { class: 'pk-name', title: name }, name),
        h('span', { class: `verdict ${state}` }, verdict),
        !manual && sel ? h('button', { type: 'button', class: `star${row?.favorite ? ' on' : ''}`, 'aria-pressed': String(!!row?.favorite),
          title: row?.favorite ? '已收藏：重跑时保留这台车（点一下取消）' : '收藏这台车，重跑时保留', onclick: () => toggleFavorite(sel) }, row?.favorite ? '★' : '☆') : null),
      shown ? h('div', { class: `pk-car${!manual && !sel ? ' miss' : ''}`, title: shown.name || '' },
        carPic(shown, 230, 184, 2) || unreadable(), !manual && !sel ? h('span', { class: 'cap' }, s.provisional ? '临时参考（未达标）' : '最接近的一台') : null,
        car ? pinTag(ci, si, car) : null,
        h('span', { class: 'who' }, `${manual ? `${shown.name || car.name} · ` : ''}${styleName(shown.style)} · ${chassisName(shown.chassis)}${shown.stats?.value != null ? ` · £${fix(shown.stats.value)}` : ''}`))
        : h('div', { class: 'pk-car none' }, '没有选出车'),
      nums,
      budgetBlock(shown, { ...spec, chapter: ci, stage: si }),
      measured?.unusable ? h('div', { class: 'pk-line bad', title: measured.unusable }, measured.unusable) : null,
      tev.previousWinRate != null ? h('div', { class: 'pk-line', title: `${tev.previousName || '上一关的车'}和它换边对打 ${tev.previousGames || '—'} 局；目标是这台车赢 ${targetText(tev.target)}` },
        tev.previousProvisional ? '打上关临时参考（未达标） ' : '打上一关车 ', h('b', { class: tev.targetPass ? 'ok' : 'bad' }, pct(tev.previousWinRate)), h('span', { class: 'muted' }, ` · 目标 ${targetText(tev.target)}`)) : null,
      oc ? h('div', { class: 'pk-line', title: originComparisonLabel(oc) }, '对原点车胜率 ', h('b', {}, `${pct(oc.winRate)} · ${oc.games} 局`), h('span', { class: 'muted' }, ` · ${originComparisonLabel(oc)}`)) : null,
      evolvedLine,
      chips.length ? h('div', { class: 'pk-tags' }, chips) : null,
      h('div', { class: 'pk-foot' },
        h('button', { type: 'button', class: 'screen', title: verified.length ? `这一关进化筛选了 ${verified.length} 台候选，${pass} 台满足全部硬条件；点一下在下面展开` : '在下面展开这一关的候选', onclick: () => toggleDrawer(ci, si) },
          verified.length ? [h('span', { class: 'dots', 'aria-hidden': 'true' }, verified.slice(0, 12).map(v => h('i', { class: sel && v.name === sel.name ? 'chosen' : (v.failed || []).length ? '' : 'y' }))),
            `达标 ${pass} / ${verified.length}`] : s.spec ? `候选 ${(s.top || []).length} 台` : '还没有候选'),
        aimButton(ci, si)));
  }
  function ghostCard({ ci, si, ghost }, first) {
    return h('article', { class: 'pk ghost', 'data-stage': `${ci},${si}` },
      first ? chapterTab(ci) : null,
      h('div', { class: 'pk-head' }, h('span', { class: 'pk-code' }, stageCode(ci, si)), h('h3', { class: 'pk-name', title: ghost.name }, ghost.name), h('span', { class: 'verdict none' }, '未生成')),
      h('div', { class: 'pk-car none' }, '这份报告里没有这一关'),
      h('div', { class: 'pk-line muted' }, `预算 £${ghost.budget}${ghost.status === 'draft' ? ' · 审阅草案' : ''}${ghost.hasVehicle ? '' : ' · 游戏里还没有关卡车'}`),
      h('div', { class: 'pk-foot' }, aimButton(ci, si, '设为生成目标')));
  }
  // 卡片上的「重跑这关」：只把生成范围设好，开跑仍要点「模拟并生成报告」
  function aimAt(ci, si) {
    if (!canAim(ci, si)) return;
    const set = (key, value) => { const f = $(`#run-${key}`); f.value = String(value); f.dispatchEvent(new Event('change')); };
    set('mode', 'single'); set('chapter', ci); set('stage', si);
    const gen = $('#gen');
    gen.classList.remove('flash'); void gen.offsetWidth; gen.classList.add('flash');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#generate').focus({ preventScroll: true });
  }
  // 生成器的旧报告只记录原点车名；没有明确章关时保留车名，不推断来源关卡。
  function originComparisonLabel(comparison) {
    const origin = comparison.origin, name = comparison.name || '原点车';
    return Number.isInteger(origin?.chapter) && origin.chapter >= 0 &&
      Number.isInteger(origin?.stage) && origin.stage >= 0
      ? `${name} · ${chapterShort(origin.chapter)}第 ${origin.stage + 1} 关` : name;
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
    return parts.join(' · ');
  }

  // ---------- 点卡片：这一关的其他候选，插在这张卡所在那一排的下面 ----------
  function toggleDrawer(ci, si) {
    const key = `${ci},${si}`;
    st.drawer = st.drawer === key ? null : key;
    if (st.drawer) st.grid = key;
    rememberPage();
    showDrawer(true);
  }
  function showDrawer(scroll) {
    document.querySelector('#grid')?.remove();
    for (const c of document.querySelectorAll('.picks .pk')) {
      const on = c.dataset.stage === st.drawer;
      c.classList.toggle('open', on);
      if (c.hasAttribute('aria-expanded')) c.setAttribute('aria-expanded', String(on));
    }
    if (!st.drawer) return;
    const panel = drawer();
    if (!panel) return;
    document.querySelector('.picks').append(panel);
    placeDrawer();
    softenPics();
    if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  // 放到选中那张卡所在一排的最后一张后面；小三角对准那张卡
  function placeDrawer() {
    const grid = document.querySelector('.picks'), panel = document.querySelector('#grid');
    const card = grid?.querySelector(`.pk[data-stage="${st.drawer}"]`);
    if (!panel) return;
    panel.remove();
    if (!card) return;
    const top = card.offsetTop, last = [...grid.querySelectorAll('.pk')].filter(c => c.offsetTop === top).pop();
    last.after(panel);
    const a = card.getBoundingClientRect(), b = panel.getBoundingClientRect();
    panel.style.setProperty('--notch', `${Math.round(a.left + a.width / 2 - b.left)}px`);
  }
  function drawer() {
    const [ci, si] = st.drawer.split(',').map(Number);
    const row = stageRows(true).find(x => x.ci === ci && x.si === si && !x.ghost);
    if (!row) { st.drawer = null; return null; }
    const s = row.s || {}, spec = s.spec || {}, ev = s.selection || {}, top = s.top || [], arch = s.archive || {};
    const car = stageCarOf(ci, si), measured = measuredFor(s, car), name = spec.name || stageName(ci, si);
    const info = [s.spec ? `场地 ${terrainName(spec.terrain)}` : null, spec.budget != null ? `预算 £${spec.budget}` : null,
      s.spec ? `终代种群 ${s.count ?? '未知'} 台 · 保留候选 ${top.length} 台 · 各代累计评估 ${stageEvaluations(s) ?? '未知'} 次（含重复个体）` : '还没跑过进化', arch.buckets != null ? `存档覆盖 ${arch.buckets} 格` : null,
      s.diversity ? `${s.diversity.clusterCount} 个造型簇` : null, ev.warning].filter(Boolean).join(' · ');
    const extra = evidence(spec, ev);
    // 关卡车放第一张；进化筛选按 selection.verified 的顺序（报告只存每关前几名的完整车，按名字对上）；再后面是收藏等其他车
    const byName = new Map(top.map(rec => [rec.name, rec])), seen = new Set(), cards = [];
    if (car) cards.push(candCard(stageRecord(car, measured), measured?.evidence || null, null, s, true));
    (ev.verified || []).forEach((v, i) => { const rec = byName.get(v.name); if (rec) seen.add(rec); cards.push(candCard(rec || { name: v.name, codeOnly: true }, v, i, s)); });
    top.filter(rec => !seen.has(rec)).forEach(rec => cards.push(candCard(rec, null, null, s)));
    const styles = [...new Set(top.map(rec => rec.style).filter(Boolean))], chassis = [...new Set(top.map(rec => rec.chassis).filter(Boolean))];
    return h('section', { id: 'grid', class: 'drawer', 'aria-label': `${stageCode(ci, si)} ${name} 的候选` },
      h('div', { class: 'drawer-h' },
        h('h3', {}, h('span', { class: 'pk-code' }, stageCode(ci, si)), `${name} · 这一关的候选`),
        h('span', { class: 'muted' }, info), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => toggleDrawer(ci, si) }, '收起 ✕')),
      spec.lesson || extra ? h('p', { class: 'hint' }, spec.lesson ? `考题：${spec.lesson}` : null, spec.lesson && extra ? ' · ' : null, extra || null) : null,
      !s.spec ? h('p', { class: 'hint' }, '这一关还没跑过进化：点卡片上的「↻ 重跑」把生成范围设成这一关，再点「模拟并生成报告」。关卡车勾着「手动选择」就会占一个席位、记下成绩。') : null,
      cards.length ? h('div', { class: 'cands' }, cards) : emptyState('这一关没有保存候选车。'),
      styles.length && chassis.length ? h('details', { class: 'fold', open: !!st.foldOpen, ontoggle: (e) => { st.foldOpen = e.target.open; } },
        h('summary', {}, `按性格 × 底盘分格（存档覆盖 ${arch.buckets ?? '—'} 格）`),
        h('p', { class: 'hint', style: 'margin-top:6px' }, '报告只保存每关前几名的完整数据，所以格子里只显示这些车；覆盖的格子数来自完整存档。'),
        h('div', { class: 'scroll' }, h('table', { class: 'gridtbl' },
          h('tr', {}, h('th', {}, '性格 \\ 底盘'), chassis.map(c => h('th', {}, chassisName(c)))),
          styles.map(sy => h('tr', {}, h('th', {}, styleName(sy)), chassis.map(cz => {
            const cell = top.filter(rec => rec.style === sy && rec.chassis === cz);
            return cell.length ? h('td', {}, cell.map(rec => thumb(rec))) : h('td', { class: 'empty' }, '—');
          })))))) : null);
  }
  /** 评分解释只使用报告记录的权重与扣分；旧评分不能追认成当前规则。 */
  function rankingText(ranking, previousWinRate) {
    if (!ranking) return '未记录选车评分';
    if (ranking.scoringVersion !== 'budget-pressure-v1' || !Number.isFinite(ranking.baseTotal) ||
      !Number.isFinite(ranking.budgetPenalty) || !Number.isFinite(ranking.previousWinRatePenalty))
      return `已有旧评分 ${fix(ranking.total, 2)}（权重、预算扣分和胜率扣分未记录）`;
    const weights = ranking.weights;
    const rule = weights && Number.isFinite(weights.strength) && Number.isFinite(weights.efficiency)
      ? `强度 ${Math.round(weights.strength * 100)}%＋节约 ${Math.round(weights.efficiency * 100)}%` : '权重未记录';
    const previous = Number.isFinite(previousWinRate)
      ? `胜率扣分 ${fix(ranking.previousWinRatePenalty, 2)}（对上关参考 ${pct(previousWinRate)}）` : '未测试，未计胜率扣分';
    return `基础分 ${fix(ranking.baseTotal, 2)}（${rule}）－预算扣分 ${fix(ranking.budgetPenalty, 2)}－${previous}＝扣后总分 ${fix(ranking.total, 2)}；预算缺口按指数扣分，对上关参考胜率低于 45% 时扣分`;
  }
  function candCard(rec, v, i, s, isStage = false) {
    const isPick = !isStage && !!s.selected && !rec.codeOnly && s.selected.code === rec.code;
    const fail = v ? v.failed || [] : [], other = fail.filter(k => k !== 'target');
    const row = rec.codeOnly || isStage ? null : arenaRow(rec), missing = !isStage && rec.cells ? SA.EvolveArena.missingReward(rec) : null;
    const verdict = isStage ? h('span', { class: `verdict ${rec.pinned ? 'ok' : 'none'}` }, rec.pinned ? '关卡车 · 手动选择' : '关卡车')
      : isPick ? h('span', { class: 'verdict ok' }, '进化选出') : v ? h('span', { class: `verdict ${fail.length ? 'bad' : 'none'}` }, fail.length ? '未达标' : '达标')
      : row?.manual ? h('span', { class: 'verdict warn' }, '手工') : row?.favorite ? h('span', { class: 'verdict none' }, '收藏') : null;
    const sp = rec.spec || {}, unmeasured = isStage && !Number.isFinite(rec.strength);
    return h('div', { class: `cand${isPick ? ' chosen' : ''}${isStage ? ' stagecar' : ''}${fail.length ? ' fail' : ''}` },
      h('div', { class: 'cand-head' }, i != null ? h('span', { class: 'rank' }, `#${i + 1}`) : null, h('span', { class: 'nm', title: rec.name || '' }, rec.name || '候选车'), verdict),
      rec.codeOnly ? h('div', { class: 'pk-car none' }, '报告没存这台车') :
        h('button', { type: 'button', class: 'pk-car', title: '点开看详情', onclick: () => openDetail(rec) }, carPic(rec, 180, 80, 2) || unreadable()),
      h('div', { class: 'cand-info' },
        `${styleName(rec.style)} · ${chassisName(rec.chassis)}${rec.archiveClass && rec.archiveClass !== 'normal' ? ` · ${classOf(rec).name}` : ''}`, h('br'),
        unmeasured ? (s.spec ? '这次进化没测它（之后改过车或性格），重跑这关就有成绩' : '还没跑过进化')
          : ['强 ', h('b', {}, fix(rec.strength)), ' · 表 ', h('b', {}, fix(rec.performance)), ` · ${winText(rec)}${rec.ranking ? ` · ${rankingText(rec.ranking, rec.previousWinRate)}` : ''}`],
        rec.unusable ? [h('br'), h('span', { class: 'bad' }, rec.unusable)] : null,
        v && v.previousWinRate != null ? [h('br'), s.selection?.previousProvisional ? '打上关临时参考（未达标） ' : '打上一关车 ', h('b', { class: v.targetPass ? 'ok' : 'bad' }, pct(v.previousWinRate)), ` · 目标 ${targetText(v.target)}`] : null,
        !isStage && s.provisional?.code === rec.code ? [h('br'), '本关临时参考（未达标，未正式入选）'] : null,
        other.length ? [h('br'), other.map(k => h('span', { class: 'chip bad' }, COND[k] || k))] : null,
        missing ? [h('br'), h('span', { class: 'bad' }, `缺少奖励：${SA.MODULES[missing]?.name || missing}，不参与选关`)] : null),
      budgetBlock(rec, s.spec || rec.spec),
      rec.codeOnly ? null : h('div', { class: 'cand-btns' },
        isStage ? h('button', { type: 'button', class: 'btn sm', title: '在后台关卡工作台打开这一关', onclick: () => openStage(sp.chapter, sp.stage) }, '去关卡工作台')
          : h('button', { type: 'button', class: 'btn sm primary', title: '把这辆车交给后台关卡工作台当草稿；在那边点「保存」才变成这一关的车', disabled: !Number.isInteger(sp.chapter), onclick: () => swapIntoStage(rec) }, '换上这辆'),
        isStage ? null : h('button', { type: 'button', class: 'btn sm', 'aria-pressed': String(!!row?.favorite), onclick: () => toggleFavorite(rec) }, row?.favorite ? '★ 已收藏' : '☆ 收藏')));
  }

  // ---------- 散点图：强度分（横）× 表现分（纵），往下翻第 2 块 ----------
  function scatter() {
    const recs = allRecords().filter(c => Number.isFinite(+c.strength) && Number.isFinite(+c.performance));
    const wrap = h('div', { class: 'chart-wrap' });
    const sec = h('section', { id: 'scatter', class: 'sheet' }, h('h2', {}, '强度 × 表现', h('small', {}, `${recs.length} 台车`)),
      h('p', { class: 'hint' }, '横轴是实战测出的强度分（1000 = 和标尺车打平），纵轴是表现分（观众算法，0～100）。右下角 = 强但难看，毒瘤车在那里。带圈的是选关选中的车。悬停看数据，点击看详情。'));
    if (!recs.length) { sec.append(emptyState('这份数据里没有带分数的车。')); return sec; }
    const ns = 'http://www.w3.org/2000/svg', W = 900, H = 420, L = 52, R = 16, T = 12, B = 40;
    const xs = recs.map(c => +c.strength), lo = Math.floor(Math.min(...xs) / 50) * 50, hi = Math.ceil(Math.max(...xs) / 50) * 50 || lo + 100;
    const xmin = lo === hi ? lo - 50 : lo, xmax = lo === hi ? hi + 50 : hi;
    const X = (v) => L + (v - xmin) / (xmax - xmin) * (W - L - R), Y = (v) => T + (1 - v / 100) * (H - T - B);
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `强度分和表现分散点图，共 ${recs.length} 台车`);
    const line = (x1, y1, x2, y2, color, dash) => { const l = document.createElementNS(ns, 'line'); Object.entries({ x1, y1, x2, y2, stroke: color, 'stroke-width': 1, 'stroke-dasharray': dash || null }).forEach(([k, v]) => v != null && l.setAttribute(k, v)); svg.append(l); };
    const text = (x, y, s, anchor = 'middle', color = '#6b553a') => { const t = document.createElementNS(ns, 'text'); Object.entries({ x, y, fill: color, 'font-size': 11, 'text-anchor': anchor }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = s; svg.append(t); };
    // 网格与刻度（横纵各一套，只有一条纵轴）
    const step = (xmax - xmin) / 50 > 10 ? 100 : 50;
    for (let v = xmin; v <= xmax + 0.1; v += step) { line(X(v), T, X(v), H - B, '#e7d8b1'); text(X(v), H - B + 16, v); }
    for (let v = 0; v <= 100; v += 20) { line(L, Y(v), W - R, Y(v), '#e7d8b1'); text(L - 8, Y(v) + 4, v, 'end'); }
    line(L, H - B, W - R, H - B, '#8e6238');
    text((L + W - R) / 2, H - 6, '强度分');
    text(14, (T + H - B) / 2, '表现分', 'middle');
    svg.lastChild.setAttribute('transform', `rotate(-90 14 ${(T + H - B) / 2})`);
    // 毒瘤线：表现分低于它、强度又在前列的算毒瘤车
    const toxicLine = (st.report.config && st.report.config.archive && st.report.config.archive.toxicPerformanceBelow) || 35;
    line(L, Y(toxicLine), W - R, Y(toxicLine), CLASS.toxic.color, '5 4');
    text(W - R - 4, Y(toxicLine) - 4, `毒瘤线 ${toxicLine}`, 'end', CLASS.toxic.color);
    // 点：常规在下层，奇特和毒瘤在上层
    const chosen = selectedCodes();
    const order = { normal: 0, odd: 1, toxic: 2 };
    const tip = h('div', { class: 'tip', hidden: true });
    recs.slice().sort((a, b) => (order[a.archiveClass] || 0) - (order[b.archiveClass] || 0)).forEach(rec => {
      const c = classOf(rec), x = X(+rec.strength), y = Y(+rec.performance);
      const g = document.createElementNS(ns, 'g');
      g.style.cursor = 'pointer';
      if (chosen.has(rec.code)) { const ring = document.createElementNS(ns, 'circle'); Object.entries({ cx: x, cy: y, r: 9, fill: 'none', stroke: '#2a1a05', 'stroke-width': 1.5 }).forEach(([k, v]) => ring.setAttribute(k, v)); g.append(ring); }
      const halo = shape(c.shape, x, y, 6, '#f8f1dc');   // 2px 纸色描边，重叠时分得开
      const dot = shape(c.shape, x, y, 4, c.color);
      const hit = document.createElementNS(ns, 'circle'); Object.entries({ cx: x, cy: y, r: 10, fill: 'transparent' }).forEach(([k, v]) => hit.setAttribute(k, v));
      g.append(halo, dot, hit);
      g.addEventListener('pointerenter', () => {
        tip.hidden = false; tip.innerHTML = '';
        const sp = rec.spec || {};
        tip.append(h('b', {}, rec.name || '候选车'), h('br'),
          `${sp.chapter != null ? `${stageCode(sp.chapter, sp.stage)} · ${stageName(sp.chapter, sp.stage)}` : ''}`, h('br'),
          `${c.name} · ${styleName(rec.style)} · ${chassisName(rec.chassis)}`, h('br'),
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

  // ---------- 往下翻 3：毒瘤车与奇特构筑 ----------
  function archiveSection() {
    const r = st.report;
    const sec = h('section', { id: 'archive', class: 'sheet' }, h('h2', {}, '毒瘤车与奇特构筑'),
      h('p', { class: 'hint' }, '毒瘤车：强度在本档前列、表现分低于毒瘤线，不会用于关卡，保留下来给你看它是怎么赢的。奇特构筑：特征明显偏离常规、强度不低于中位数。'));
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
          const sti = s.spec?.stage ?? si;
          if (toxic.length || odd.length) groups.push({ title: `${stageCode(ch.chapter, sti)} · ${(s.spec && s.spec.name) || stageName(ch.chapter, sti)}`, toxic, odd });
        });
      }
    }
    if (!groups.length) { sec.append(emptyState('这份数据里没有毒瘤车或奇特构筑。')); return sec; }
    const cap = (rec) => (rec.codeOnly ? '只有分享码' : `强 ${fix(rec.strength)} · 表 ${fix(rec.performance)}`);
    // 一关一块，横着排开
    sec.append(h('div', { class: 'arch-wrap' }, groups.map(g => h('div', { class: 'arch-group' }, h('h3', {}, g.title),
      g.toxic.length ? h('div', {}, h('div', { class: 'small' }, markSvg('toxic'), ` 毒瘤车 ${g.toxic.length}`), g.toxic.map(rec => thumb(rec, cap(rec)))) : null,
      g.odd.length ? h('div', {}, h('div', { class: 'small' }, markSvg('odd'), ` 奇特构筑 ${g.odd.length}`), g.odd.map(rec => thumb(rec, cap(rec)))) : null))));
    return sec;
  }

  // ---------- 往下翻 4：报告信息与说明 ----------
  function reportInfo() {
    const r = st.report, fails = (r.selectionFailures || []).filter(f => inChapter(f.chapter));
    const fact = (k, v) => [h('dt', {}, k), h('dd', {}, v)];
    return h('section', { id: 'report-info', class: 'sheet' }, h('h2', {}, '报告信息'),
      h('dl', { class: 'facts' },
        fact('报告', st.label || '—'),
        fact('生成于', r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '—'),
        fact('随机种子', String(r.seed ?? '—')),
        fact('规则指纹', h('span', {}, '报告 ', h('code', {}, r.rules || '—'), ' · 当前 ', h('code', {}, st.fingerprint || '—'))),
        fails.length ? fact('没选出车的关', fails.map(f => `${stageCode(f.chapter, f.stage)} ${f.name || stageName(f.chapter, f.stage)}：${(f.failed || []).map(k => COND[k] || k).join('、') || '没有选出车'}`).join('；')) : null),
      h('p', { class: 'hint', style: 'margin:10px 0 0' }, '关卡车进化生成器（', h('code', {}, 'tools/evolve.js'), '）的结果：每一关选出的车、强度分和表现分的分布、分类存档、毒瘤车和奇特构筑。点任意一台车看大图、分享码和典型对局，可以按种子复现，也可以去试驾场和它打一场。规则见 ',
        h('code', {}, 'docs/evolve-plan.md'), '。胜率来自同档标尺的换边实战，平局计半胜；与强度分使用同一批样本。旧报告没有记录时显示「未记录」，手工改车后需重新模拟。'));
  }

  // ---------- 详情 ----------
  function stageOpponent(rec) {
    // 新报告保存真实的同档标尺，旧报告继续使用原关卡车。
    if (rec.typical?.opponent?.cells) return { o: { style: rec.typical.style }, v: SA.V.fromCells(rec.typical.opponent.name, rec.typical.opponent.cells) };
    const sp = rec.spec || {};
    if (sp.chapter == null || sp.stage == null) return null;
    const raw = SA.CAMPAIGN[sp.chapter] && SA.CAMPAIGN[sp.chapter].stages[sp.stage];
    const o = raw && SA.StageCars ? SA.StageCars.merge(raw, sp.chapter, sp.stage) : raw;
    if (!o) return null;
    return { o, v: o.vehicle || SA.V.fromAscii(o.name, o.rows, o.sides || [], o.mt || 1, o.elite || [], o.subs || []) };
  }
  // 按报告里的种子和标尺重跑典型对局，与 tools/evolve.js 的 duel 参数一致。
  function replay(rec) {
    const v = vehicleOf(rec), opp = stageOpponent(rec), t = rec.typical;
    if (!v || !opp || !t || t.seed == null) return null;
    // 报告只保存章号；复现时从当前章节读取场地边界，与生成时的规格一致。
    return SA.Battle.simulate({ p: v, e: opp.v, pAim: 0.8, eAim: 0.8, pStyle: opp.o.style || 'wander', eStyle: 'wander', terrain: (rec.spec && rec.spec.terrain) || 'flat', bounds: SA.CAMPAIGN[rec.spec?.chapter]?.bounds, seed: t.seed });
  }
  const winnerName = (w) => (w === 'p' ? '候选车胜' : w === 'e' ? '对手胜' : '平手');
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
  // 这台车在它那一关筛选里的记录（打上一关车的胜率、没满足的条件）
  function screeningOf(rec) {
    const sp = rec.spec || {};
    const s = (st.report.chapters || []).find(ch => ch.chapter === sp.chapter)?.stages.find(x => x.spec?.stage === sp.stage);
    const evidence = s && rec.name ? (s.selection?.verified || []).find(v => v.name === rec.name) || null : null;
    return evidence ? { ...evidence, previousProvisional: !!s.selection.previousProvisional,
      provisional: s.provisional?.code === rec.code } : null;
  }
  function openDetail(rec) {
    const v = vehicleOf(rec), c = classOf(rec), sp = rec.spec || {}, s = rec.stats || {}, scr = screeningOf(rec);
    const box = $('#detail'); box.innerHTML = '';
    const close = h('button', { type: 'button', class: 'btn', onclick: closeDetail }, '关闭');
    const replayOut = h('span', { style: 'font-size:12.5px' });
    const kv = (k, val) => h('tr', {}, h('th', {}, k), h('td', {}, val));
    box.append(
      h('div', { class: 'detail-head' }, h('h2', { title: rec.name || '' }, markSvg(rec.archiveClass || 'normal', 14), rec.name || '候选车'),
        sp.chapter != null ? h('span', { class: 'chip' }, `${stageCode(sp.chapter, sp.stage)} · ${stageName(sp.chapter, sp.stage)}`) : null, close),
      h('div', { class: 'detail-body' },
        h('div', { class: 'detail-pic' }, (v && carPic(rec, 400, 300, 4)) || unreadable()),
        h('div', { class: 'detail-info' },
          h('table', {},
            kv('来源', sp.chapter != null ? `${chapterShort(sp.chapter)} · ${stageName(sp.chapter, sp.stage)} · ${terrainName(sp.terrain)}` : '—'),
            kv('分类', `${c.name} · ${styleName(rec.style)} · ${chassisName(rec.chassis)}`),
            kv('胜率（同档标尺）', `${winText(rec)}${rec.opponentCount ? ` · ${rec.opponentCount} 台标尺 · 平局计半胜` : ''}${rec.evaluationStyle ? ` · 实测性格：${styleName(rec.evaluationStyle)}` : ''}`),
            scr ? kv('本关筛选', h('span', {}, scr.previousWinRate != null ? [scr.previousProvisional ? '打上关临时参考（未达标） ' : '打上一关车 ', h('b', { class: scr.targetPass ? 'ok' : 'bad' }, pct(scr.previousWinRate)), ` · 目标 ${targetText(scr.target)}`] : '第一关不比上一关',
              (scr.failed || []).length ? ` · 没满足：${scr.failed.map(k => COND[k] || k).join('、')}` : ' · 硬条件全部满足')) : null,
            scr?.provisional ? kv('临时参考', '本关未达标候选，仅供后续模拟参考，未正式入选') : null,
            rec.stageCar ? kv('关卡车', rec.pinned ? '游戏里这一关用的车 · 手动选择：进化时每代留一个席位' : '游戏里这一关用的车 · 没勾「手动选择」')
              : kv('擂台状态', `${arenaRow(rec)?.manual ? '手工修改 · ' : ''}${arenaRow(rec)?.favorite ? '已收藏，重跑保留' : '未收藏'}`),
            kv('强度分', rec.codeOnly ? '报告只保存了分享码' : `${fix(rec.strength)}${rec.strengthCi != null ? ` ± ${fix(rec.strengthCi)}` : ''}${rec.terrainStrength != null && sp.terrain && sp.terrain !== 'flat' ? `（平地 ${fix(rec.terrainStrength)}，地形专长 ${rec.terrainDelta >= 0 ? '+' : ''}${fix(rec.terrainDelta)}）` : ''}`),
            kv('表现分', rec.codeOnly ? '—' : `${fix(rec.performance, 1)}${rec.efficiency ? ` · 节约原分 ${fix(rec.efficiency.total, 2)}（${rec.efficiency.count} 件 / £${fix(rec.efficiency.value)}，上限 £${fix(rec.efficiency.budget)}）` : ''}`),
            kv('选车综合分', rankingText(rec.ranking, rec.previousWinRate)),
            kv('属性', s.hp != null ? `耐久 ${fix(s.hp)} · 秒伤 ${fix(s.dps, 1)} · 升温 ${fix(s.heatDps, 1)} · 水 ${fix(s.water)} · 冷却 ${fix(s.cool, 1)} · 评分 ${fix(s.rating)} · 价值 £${fix(s.value)}` : '—')),
          budgetBlock(rec),
          h('div', { class: 'row-btns' },
            h('button', { type: 'button', class: 'btn primary', disabled: !v, onclick: () => testDrive(rec) }, '去试驾场和它打一场'),
            rec.stageCar ? h('button', { type: 'button', class: 'btn', disabled: sp.chapter == null, onclick: () => openStage(sp.chapter, sp.stage) }, '去关卡工作台')
              : h('button', { type: 'button', class: 'btn', title: '交给后台关卡工作台当草稿；在那边点「保存」才变成这一关的车', disabled: !v || sp.chapter == null, onclick: () => swapIntoStage(rec) }, '换上这辆（去关卡工作台）'),
            rec.stageCar ? null : h('button', { type: 'button', class: 'btn', onclick: () => { toggleFavorite(rec); openDetail(rec); } }, arenaRow(rec)?.favorite ? '★ 取消收藏' : '☆ 收藏并保留'),
            rec.stageCar ? null : h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: arenaRow(rec)?.participate !== false, onchange: e => {
              const row = arenaRow(rec) || SA.EvolveArena.remember(rec, { favorite: true });
              SA.EvolveArena.update(row.id, { participate: e.target.checked });
            } }), '作为后续进化种子')),
          rec.styleTrials && rec.styleTrials.length ? h('div', {}, h('h3', {}, '各性格试跑'),
            h('table', {}, h('tr', {}, ['性格', '表现分', '胜率'].map(t => h('th', {}, t))),
              rec.styleTrials.map(x => h('tr', {}, h('td', {}, styleName(x.style), x.style === rec.style ? h('span', { class: 'chip', style: 'margin-left:6px' }, '绑定') : null), h('td', { class: 'num' }, fix(x.performance, 1)), h('td', { class: 'num' }, pct(x.winRate)))))) : null,
          h('h3', {}, '典型对局'),
          rec.typical ? h('p', { style: 'margin:0;font-size:12.5px' }, `对手：${rec.typical.opponent?.name || '这一关的原车'} · ${winnerName(rec.typical.winner)} · ${fix(rec.typical.t, 1)} 秒 · ${rec.typical.reason || '—'} · 种子 ${rec.typical.seed ?? '—'}`) : h('p', { class: 'muted', style: 'margin:0;font-size:12.5px' }, '报告里没有记录典型对局。'),
          h('div', { class: 'row-btns' },
            h('button', { type: 'button', class: 'btn sm', disabled: !(rec.typical && rec.typical.seed != null && stageOpponent(rec)), onclick: () => {
              const res = replay(rec);
              if (!res) { replayOut.textContent = '无法复现：缺少种子或对手。'; replayOut.className = 'bad'; return; }
              const same = res.winner === rec.typical.winner && Math.abs(res.t - rec.typical.t) < 0.05 && res.reason === rec.typical.reason;
              replayOut.className = same ? 'ok' : 'bad';
              replayOut.textContent = `${same ? '✓ 复现一致' : exact(rec) ? '✗ 结果不同（规则可能已改）' : '✗ 结果不同：这份老报告没有完整模块清单，改装等级无法还原'}：${winnerName(res.winner)} · ${fix(res.t, 1)} 秒 · ${res.reason || '—'}`;
            } }, '按种子复现'),
            replayOut),
          h('h3', {}, '分享码'),
          h('textarea', { class: 'code', readOnly: true }, rec.code || ''),
          h('div', { class: 'row-btns' }, h('button', { type: 'button', class: 'btn sm', onclick: (e) => copyText(rec.code || '', e.currentTarget) }, '复制分享码')),
          rec.patch ? h('div', {}, h('h3', {}, '导出补丁（只替换车的数据）'),
            h('textarea', { class: 'code', readOnly: true, style: 'min-height:120px' }, JSON.stringify(rec.patch, null, 2)),
            h('div', { class: 'row-btns' }, h('button', { type: 'button', class: 'btn sm', onclick: (e) => copyText(JSON.stringify(rec.patch, null, 2), e.currentTarget) }, '复制补丁'))) : null)));
    $('#overlay').hidden = false;
    close.focus();
    softenPics();
  }
  function closeDetail() { $('#overlay').hidden = true; }
  let fitQueued = 0;
  addEventListener('resize', () => { cancelAnimationFrame(fitQueued); fitQueued = requestAnimationFrame(() => { fitBoard(); placeDrawer(); }); });
  // 后台关卡工作台保存了关卡车（或别的标签改了「手动选择」）：重读关卡配置再画
  try {
    const channel = new BroadcastChannel('steam-arena-stage-cars');
    channel.onmessage = (e) => {
      if (e.data?.type === 'created') { location.reload(); return; }
      if (e.data?.type !== 'saved') return;
      try { reloadStageCars(); if (st.rawReport) render(); } catch (error) { console.error('关卡配置刷新失败', error); }
    };
  } catch (_) { /* 不支持频道的浏览器刷新后才看到 */ }
  $('#overlay').addEventListener('pointerdown', (e) => { if (e.target.id === 'overlay') closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); $('#gen-more').open = false; } });
  // 「参数」小窗：点外面收起
  document.addEventListener('pointerdown', (e) => { const more = $('#gen-more'); if (more.open && !more.contains(e.target)) more.open = false; });

  // ---------- 启动 ----------
  async function refreshList(keep) {
    const src = $('#src');
    keep ??= memory.source;
    const reports = await listReports(), cand = await hasCandidates();
    const opts = [...reports.map(n => [`out/${n}`, `运行报告 · ${new Date(+n.match(/\d+/)[0]).toLocaleString()}`]), ...(cand ? [['evolve-candidates.json', '候选车库（evolve-candidates.json）']] : [])];
    src.innerHTML = '';
    src.append(...opts.map(([v, n]) => h('option', { value: v, selected: v === keep }, n)));
    if (!opts.length) {
      st.source = null;
      use({ chapters: [], candidates: [], selectionFailures: [] }, '本机进化擂台');
      banner('还没有运行报告。各关的关卡车仍在下方；选择章／关后点击“模拟并生成报告”即可开始。');
      return;
    }
    const pickV = opts.some(o => o[0] === keep) ? keep : opts[0][0];
    src.value = pickV;
    await load(pickV, src.selectedOptions[0].textContent);
  }
  $('#src').onchange = (e) => load(e.target.value, e.target.selectedOptions[0].textContent);
  $('#reload').onclick = () => refreshList($('#src').value);
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { st.source = null; use(normalize(JSON.parse(await f.text())), `本地文件 · ${f.name}`); } catch (err) { banner(`无法读取 ${f.name}：${err.message}`, 'stale'); }
    e.target.value = '';
  };
  // 数值自测复用原页面，页签切换不销毁它，正在运行的检验和结果均保留。
  function toolTab() {
    rememberPage();
    const selftest = location.hash === '#selftest';
    $('#lab-evolve').hidden = selftest; $('#lab-selftest').hidden = !selftest;
    $('#tab-evolve').classList.toggle('on', !selftest); $('#tab-selftest').classList.toggle('on', selftest);
    if (selftest && !$('#selftest-frame').getAttribute('src')) $('#selftest-frame').src = 'sim.html?embedded=1';
  }
  $('#tab-evolve').onclick = () => { location.hash = 'overview'; };
  $('#tab-selftest').onclick = () => { location.hash = 'selftest'; };
  window.addEventListener('hashchange', toolTab); toolTab();
  const refreshArena = () => { if (st.rawReport) render(); };
  window.addEventListener('evolve-arena-change', refreshArena);
  window.addEventListener('storage', event => { if (event.key === SA.EvolveArena.KEY) refreshArena(); });

  // 生成进度条：读状态文字里的百分比（文字仍由下面的轮询写），「停止生成」能点 = 正在跑
  function syncMeter() {
    const text = $('#generation-status').textContent, m = /（(\d+)%）/.exec(text), busy = !$('#stop-generation').disabled;
    // 结束时按结果上色，条长始终按实际／计划步数显示；提前达标不填造未执行步骤。
    const end = busy ? '' : /^生成完成/.test(text) ? 'done' : /^模拟完成/.test(text) ? 'warn' : /^生成失败/.test(text) ? 'failed' : /^已停止/.test(text) ? 'stopped' : '';
    $('#gen').classList.toggle('busy', busy);
    $('#gen').dataset.end = end;
    $('#gen-meter').hidden = !busy && !end;
    $('#gen-meter').firstElementChild.style.width = `${m ? Math.min(100, +m[1]) : 0}%`;
    $('#generation-status').title = text;
  }
  new MutationObserver(syncMeter).observe($('#generation-status'), { childList: true, characterData: true, subtree: true });
  new MutationObserver(syncMeter).observe($('#stop-generation'), { attributes: true, attributeFilter: ['disabled'] });
  new MutationObserver(() => { $('#scope-info').title = $('#scope-info').textContent; }).observe($('#scope-info'), { childList: true, characterData: true, subtree: true });

  let pollTimer = null, finishedJob = null;
  // 目录可能过滤缺配置章节和关卡，原始 ID 不能作为数组下标。
  const catalogChapter = chapter => runCatalog.chapters.find(row => row.chapter === chapter);
  async function service(url, payload) {
    const response = await fetch(`/__evolve/${url}`, payload === undefined ? { cache: 'no-store' } :
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (response.status === 404 || response.status === 501) throw new Error('模拟服务未启动，请重启 python tools/serve.py 后刷新本页');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `服务错误 ${response.status}`);
    return data;
  }
  function scopeInfo() {
    if ($('#run-mode').value === 'route-after') {
      const [chapter, stage] = $('#run-origin').value.split(',').map(Number);
      const chapterRow = catalogChapter(chapter);
      const origin = chapterRow?.stages.find(row => row.stage === stage);
      const count = $('#run-after-count');
      count.max = origin?.maxAfter || 0;
      $('#scope-info').textContent = origin ? `从 ${chapterRow.name} · ${origin.name} 之后生成；最多 ${origin.maxAfter} 关。未配置关使用临时继承规则，不修改正式关卡。` : '请选择已有车辆的原点关卡。';
      return;
    }
    const chapter = catalogChapter(+$('#run-chapter').value);
    const stages = $('#run-stage').value === 'all' ? chapter.stages : chapter.stages.filter(s => s.stage === +$('#run-stage').value);
    $('#scope-info').textContent = stages.map(s => `${s.name}：£${s.budget}${s.status === 'draft' ? '（审阅草案）' : s.previewRuleSource ? `（临时继承 ${chapterShort(s.previewRuleSource.chapter)}第 ${s.previewRuleSource.stage + 1} 关）` : ''}`).join('；') +
      (stages.length === 1 ? `。可用模块：${stages[0].modules.join('、')}` : '。各关使用各自预算与模块表。');
  }
  function runStages() {
    const chapter = catalogChapter(+$('#run-chapter').value);
    $('#run-stage').replaceChildren(h('option', { value: 'all' }, '整章'), ...chapter.stages.map(s => h('option', { value: s.stage }, `${s.stage + 1} · ${s.name}`)));
    scopeInfo();
  }
  function runMode() {
    const route = $('#run-mode').value === 'route-after';
    $('#run-chapter').parentElement.hidden = route;
    $('#run-stage').parentElement.hidden = route;
    $('#run-origin').parentElement.hidden = !route;
    $('#run-after-count').parentElement.hidden = !route;
    scopeInfo();
  }
  // 剩余时间是实测速度估计，向上取整避免尚未结束时显示“0 秒”。
  function duration(ms) {
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
    const minutes = Math.ceil(seconds / 60);
    return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
  }
  function overallProgress(p) {
    if (!(p.totalSteps > 0)) return '正在统计总步数';
    return `总进度 ${p.completedSteps || 0} / ${p.totalSteps} 步（${Math.floor((p.completedSteps || 0) / p.totalSteps * 100)}%）`;
  }
  /** 各代候选评估次数按实际种群求和，含重复个体、不含额外最终复测，不是总战斗局数；旧报告缺指标时不推算。 */
  function stageEvaluations(stage) {
    const metrics = stage.generationMetrics;
    return Array.isArray(metrics) && metrics.length > 0 && metrics.every(row => Number.isInteger(row.population))
      ? metrics.reduce((sum, row) => sum + row.population, 0) : null;
  }
  /** 老服务任务没有路线状态时，只读取该任务的落盘报告，不改变用户正在查看的报告。 */
  async function completedJobResult(job) {
    const result = job.result;
    if (result.status || !/^out\/evolve-\d+\.json$/.test(result.file || '')) return result;
    const response = await fetch(result.file, { cache: 'no-store' });
    if (!response.ok) throw new Error('任务已结束，但对应报告暂时无法读取，请刷新重试');
    const report = await response.json();
    const scope = job.request?.scope;
    // 续接报告含其他关卡的旧失败；恢复时仅取本次请求范围内的失败证据。
    const inScope = row => scope?.type === 'route-after' ?
      row.chapter > scope.origin.chapter || row.chapter === scope.origin.chapter && row.stage > scope.origin.stage :
      !scope || row.chapter === scope.chapter && (scope.stage == null || row.stage === scope.stage);
    const processed = (report.chapters || []).flatMap(ch => ch.stages.map(row => row.spec)).filter(inScope)
      .sort((a, b) => a.chapter - b.chapter || a.stage - b.stage).slice(0, result.stages);
    const failures = (report.selectionFailures || []).filter(row => processed.some(spec => spec.chapter === row.chapter && spec.stage === row.stage));
    return { ...result, status: report.status || 'complete', plannedStages: scope?.type === 'route-after' ? scope.count : result.plannedStages,
      selectionFailures: failures.map(failure => {
        const stage = report.chapters?.find(ch => ch.chapter === failure.chapter)?.stages.find(row => row.spec.stage === failure.stage);
        const selection = stage?.selection, rates = (selection?.verified || []).map(row => row.previousWinRate).filter(Number.isFinite);
        return { ...failure, target: selection?.target || stage?.spec.target, previousName: selection?.previousName,
          previousProvisional: !!selection?.previousProvisional,
          bestWinRate: rates.length ? Math.max(...rates) : selection?.previousWinRate };
      }) };
  }
  /** 路线失败已终止计算，保留原计划分母，并直接解释未执行的后续工作。 */
  function completedJobText(job, result) {
    const failed = result.status === 'failed', interrupted = result.status === 'interrupted';
    const unmet = (result.selectionFailures || []).length;
    const prefix = failed ? '生成失败：旧任务因路线筛选未达标而结束。' : interrupted ? '已停止生成：' :
      unmet ? `模拟完成，${unmet} 关未达标（候选已保留）：` : '生成完成：';
    const failures = (result.selectionFailures || []).map(row => {
      const conditions = (row.failed || []).map(key => key === 'target' ? `${COND.target}${Array.isArray(row.target) ? `：目标 ${row.target.map(rate => `${Math.round(rate * 100)}%`).join('～')}` : ''}${Number.isFinite(row.bestWinRate) ? `，当前最佳 ${(row.bestWinRate * 100).toFixed(1)}%` : ''}` : COND[key] || key).join('、');
      return `${chapterShort(row.chapter)} · 第 ${row.stage + 1} 关 ${row.name || ''}未选出车：${conditions || '没有合格候选'}${row.previousProvisional ? '（对上关未达标临时参考复测）' : ''}`;
    }).join('；');
    const pendingStages = Number.isInteger(result.plannedStages) ? Math.max(0, result.plannedStages - result.stages) : null;
    const skipped = failed || interrupted ? ` ${interrupted ? pendingStages == null ? '仍有关卡未完成，' : `仍有 ${pendingStages} 关未完成，` : pendingStages == null ? '后续未继续运行，' : `后续 ${pendingStages} 关未运行，`}计划中 ${Math.max(0, result.totalSteps - result.completedSteps)} 步未执行。` :
      ` 全部目标关已处理${result.completedSteps < result.totalSteps ? `，提前达标免运行的计划步骤 ${result.totalSteps - result.completedSteps} 步` : ''}。`;
    // 本轮摘要来自服务的 fresh 报告，不能用页面合并报告中的历史关卡补齐。
    const stages = Array.isArray(result.stageSummaries) ? result.stageSummaries.map(row =>
      `${chapterShort(row.chapter)} · 第 ${row.stage + 1} 关 ${row.name || ''}：终代种群 ${row.population ?? '未知'} 台、保留候选 ${row.retainedCandidates ?? '未知'} 台、各代累计评估 ${row.evaluations ?? '未知'} 次（含重复个体）`).join('；') :
      '旧任务未记录本轮逐关数量；本页可能包含已有记录，各代累计评估次数未知';
    return `${prefix}${overallProgress(result)} · 本轮 ${result.stages} 关、${result.candidates} 台保留候选，已用 ${duration(job.elapsedMs ?? result.elapsedMs)}。本轮关卡：${stages}。${failures}${skipped}` +
      (result.seedWarnings || []).map(row => `${row.name}：${row.reason}`).join('；');
  }
  async function pollJob(restoring = false) {
    clearTimeout(pollTimer);
    try {
      const job = await service('job'), busy = job.status === 'running';
      $('#generate').disabled = busy || !runCatalog; $('#stop-generation').disabled = !busy;
      if (busy) {
        const p = job.progress || {}, label = p.chapter == null ? '本次生成' : `${chapterShort(p.chapter)}${p.stage == null ? '' : ` · 第 ${p.stage + 1} 关`}`;
        const phase = { start: '准备', 'stage-start': '准备本关', 'generation-start': '评估', candidate: '评估', 'generation-end': '完成本代', 'stage-end': '完成本关整理', 'boss-start': '筛选 Boss 标尺', 'boss-end': '完成 Boss 标尺', 'selection-start': '筛选关卡车', 'selection-end': '完成本关筛选', 'chapter-end': '选关完成', complete: '正在保存报告' }[p.phase] || '准备';
        const generation = p.generation == null ? '' : `第 ${p.generation + 1} 代 · 本代 ${p.completed ?? 0}/${p.total ?? '—'} 台`;
        const remaining = Number.isFinite(job.remainingMs) ? `预计剩余约 ${duration(job.remainingMs)}` : '剩余时间估算中';
        $('#generation-status').textContent = `${overallProgress(p)} · 已用 ${duration(job.elapsedMs ?? p.elapsedMs ?? 0)} · ${remaining} · ${label} · ${phase}${generation}`;
        pollTimer = setTimeout(pollJob, 1500);
      } else if (job.status === 'complete' && finishedJob !== job.id) {
        const result = await completedJobResult(job);
        finishedJob = job.id;
        $('#generation-status').textContent = completedJobText(job, result);
        // 刷新只是恢复当前查看位置；此前已完成的任务不能覆盖手选报告。
        // 后续轮询观察到任务完成时，仍自动展示该任务的新报告。
        if (!restoring) await refreshList(result.file);
      } else if (job.status === 'failed') $('#generation-status').textContent = `生成失败：${job.error} · ${overallProgress(job.progress || {})}`;
      else if (job.status === 'cancelled') $('#generation-status').textContent = `已停止生成：${overallProgress(job.progress || {})}，之前的报告和保留车型仍可查看。`;
    } catch (error) {
      $('#generation-status').textContent = error.message;
      $('#generate').disabled = !runCatalog;
    }
  }
  $('#generate').onclick = async () => {
    $('#generate').disabled = true;
    try {
      const params = Object.fromEntries(['population', 'generations', 'games', 'workers', 'seed'].map(key => {
        const field = $(`#run-${key}`); if (!field.checkValidity()) throw new Error(`请检查${field.parentElement.textContent.trim()}的取值`);
        return [key, +field.value];
      }));
      const route = $('#run-mode').value === 'route-after';
      const [chapter, stage] = $('#run-origin').value.split(',').map(Number);
      const scope = route ? { type: 'route-after', origin: { chapter, stage }, count: +$('#run-after-count').value }
        : { chapter: +$('#run-chapter').value, stage: $('#run-stage').value === 'all' ? null : +$('#run-stage').value };
      const origin = catalogChapter(chapter)?.stages.find(row => row.stage === stage);
      if (route && !origin?.hasVehicle)
        throw new Error('请选择已有车辆的原点关卡');
      if (route && (!$('#run-after-count').checkValidity() || !Number.isInteger(scope.count)))
        throw new Error(`后续关数无效；该原点最多可选 ${origin?.maxAfter || 0} 关`);
      const seeds = SA.EvolveArena.read().filter(row => (row.favorite || row.manual) && row.participate !== false &&
        row.record.spec?.chapter === (route ? chapter : scope.chapter) && (route || scope.stage == null || row.record.spec.stage === scope.stage)).map(row => row.record);
      // 手动选择的关卡车由生成服务直接读正式关卡配置、自动占席位，这里不用再带
      const request = { ...params, scope, seeds, baseReport: /^out\/evolve-\d+\.json$/.test(st.source || '') ? st.source : null };
      await service('run', request);
      await pollJob();
    } catch (error) { $('#generation-status').textContent = error.message; $('#generate').disabled = false; }
  };
  $('#stop-generation').onclick = async () => {
    try { await service('stop', {}); await pollJob(); } catch (error) { $('#generation-status').textContent = error.message; }
  };
  async function initGeneration() {
    try {
      runCatalog = await service('config');
      $('#run-chapter').replaceChildren(...runCatalog.chapters.map(ch => h('option', { value: ch.chapter }, ch.name)));
      $('#run-origin').replaceChildren(...runCatalog.chapters.flatMap(ch => ch.stages.filter(row => row.hasVehicle).map(row =>
        h('option', { value: `${ch.chapter},${row.stage}` }, `${ch.name} · ${row.name}`))));
      for (const [key, value] of Object.entries(runCatalog.defaults)) $(`#run-${key}`).value = value;
      $('#run-chapter').onchange = () => { runStages(); rememberPage(); };
      $('#run-stage').onchange = () => { scopeInfo(); rememberPage(); };
      $('#run-mode').onchange = () => { runMode(); rememberPage(); };
      $('#run-origin').onchange = () => { scopeInfo();
        const count = $('#run-after-count');
        if (!count.checkValidity()) count.value = Math.max(+count.min, Math.min(+count.value || +count.min, +count.max));
        rememberPage(); };
      $('#run-after-count').onchange = () => { rememberPage(); };
      // 章节决定关卡选项，原点决定后续关数上限；必须按依赖顺序恢复。
      const savedRun = memory.run && typeof memory.run === 'object' ? memory.run : {};
      restoreField('chapter', savedRun.chapter);
      runStages();
      for (const key of ['stage', 'mode', 'origin']) restoreField(key, savedRun[key]);
      runMode();
      for (const key of ['after-count', 'population', 'generations', 'games', 'workers', 'seed']) restoreField(key, savedRun[key]);
      generationReady = true;
      for (const key of RUN_FIELDS) $(`#run-${key}`).addEventListener('input', rememberPage);
      rememberPage();
      await pollJob(true);
    } catch (error) { $('#scope-info').textContent = error.message; }
  }
  // 其他工作台保存预算后只重读目录并重画报告，不自动重跑模拟或更换所选报告。
  try {
    const channel = new BroadcastChannel('steam-arena-evolve-budget');
    channel.onmessage = async () => {
      try { runCatalog = await service('config'); if (st.rawReport) render(); }
      catch (error) { $('#scope-info').textContent = error.message; }
    };
  } catch (error) { /* 刷新本页仍会读取最新预算。 */ }
  currentFingerprint().then(fp => { st.fingerprint = fp; }).catch(() => { st.fingerprint = null; }).finally(async () => {
    await refreshList(); await initGeneration();
    // 生成器目录到了以后再画一遍：卡片上的「重跑这关」和「未生成」空位要用它
    if (st.rawReport) render();
  });
})();
