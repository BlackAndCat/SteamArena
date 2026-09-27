// 关卡车工作台：只调用规则层接口，工具页面本身不改变游戏界面文件。
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { ci: 0, si: 0, vehicle: null, base: null, record: null, tests: {} };
  const styles = { wander: '游走', rush: '冲锋', kite: '放风筝', turtle: '龟缩' };
  const targetKeys = (SA.StageCars && SA.StageCars.targetKeys()) || ['0:0', '0:1', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2'];
  const [chapterCount] = [3];

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])); }
  function stageAt(ci, si) { return SA.CAMPAIGN[ci]?.stages?.[si] || null; }
  function actualStage(ci, si) {
    const base = stageAt(ci, si);
    if (!base) return null;
    const out = SA.StageCars ? SA.StageCars.merge(base, ci, si) : { ...base, source: 'original', locked: false };
    out.vehicle = out.vehicle || SA.V.fromAscii(out.name, out.rows, out.sides || [], out.mt || 1, out.elite || [], out.subs || []);
    return out;
  }
  function cellsOf(v) { return SA.StageCars.cellsOf(v); }

  function renderList() {
    let candidateNames = [];
    try { candidateNames = (JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []).map(x => String(x.from || x.name || '')); } catch (error) { candidateNames = []; }
    $('stage-list').innerHTML = targetKeys.map(key => {
      const [ci, si] = key.split(':').map(Number), base = stageAt(ci, si), rec = SA.StageCars.get(ci, si), selected = ci === state.ci && si === state.si;
      if (!base) return '';
      const evolved = !rec && candidateNames.some(name => name.includes(base.name));
      const source = rec ? `<span class="tag manual">手工</span>${rec.locked !== false ? '<span class="tag locked">锁定</span>' : '<span class="tag">可进化</span>'}` : `<span class="tag">原始</span>${evolved ? '<span class="tag">进化候选</span>' : ''}`;
      return `<button data-ci="${ci}" data-si="${si}" class="${selected ? 'selected' : ''}">${esc(ci === 0 ? `序章 ${si + 1}` : `第 ${ci} 章 ${si + 1}`)} · ${esc(rec?.name || base.name)}${source}</button>`;
    }).join('');
    $('stage-list').querySelectorAll('button').forEach(button => button.onclick = () => selectStage(+button.dataset.ci, +button.dataset.si));
  }

  function renderTerrain() {
    $('terrain').innerHTML = Object.keys(SA.TERRAINS).map(id => `<option value="${esc(id)}">${esc(SA.TERRAINS[id].name || id)}</option>`).join('');
  }

  function readFields() {
    let unlock = state.record?.unlock || state.base?.unlock || null;
    const mods = $('unlock-mods').value.split(',').map(x => x.trim()).filter(Boolean);
    const feat = $('unlock-feat').value.split(',').map(x => x.trim()).filter(Boolean);
    const unlockMatText = $('unlock-mat').value.trim();
    const unlockMat = unlockMatText ? +unlockMatText : NaN;
    const gridText = $('unlock-grid').value.trim().toLowerCase().replace(/[×*]/g, 'x');
    const gridMatch = gridText.match(/^(\d+)x(\d+)$/);
    const grid = gridMatch ? { cols: +gridMatch[1], rows: +gridMatch[2] } : undefined;
    if (mods.length || feat.length || Number.isFinite(unlockMat) || grid || unlock) unlock = { ...(unlock || {}), mods, feat };
    if (unlock && Number.isFinite(unlockMat)) unlock.mat = Math.max(1, Math.min(SA.MAT_MAX, unlockMat));
    if (unlock && grid) unlock.grid = { cols: Math.max(1, Math.min(8, grid.cols)), rows: Math.max(1, Math.min(6, grid.rows)) };
    let uniqueLoot = state.record?.uniqueLoot || state.base?.uniqueLoot || [];
    try { uniqueLoot = $('loot').value.trim() ? JSON.parse($('loot').value) : []; } catch (error) { throw new Error(`可缴获件不是有效 JSON：${error.message}`); }
    return {
      name: $('name').value.trim(), pilot: $('pilot').value.trim(), style: $('style').value,
      aim: +$('aim').value, terrain: $('terrain').value, boss: $('boss').checked, prize: +$('prize').value,
      unlock, uniqueLoot, blurb: $('blurb').value, weakness: $('weakness').value,
      locked: state.record ? state.record.locked !== false : true,
    };
  }

  function fillFields(stage) {
    const rec = SA.StageCars.get(state.ci, state.si), base = stageAt(state.ci, state.si);
    state.record = rec;
    $('name').value = stage.name || '';
    $('pilot').value = stage.pilot || '';
    $('style').value = stage.style || 'wander';
    $('aim').value = stage.aim ?? 0.8;
    $('terrain').value = stage.terrain || 'flat';
    $('boss').checked = !!stage.boss;
    $('prize').value = stage.prize || 0;
    $('unlock-mods').value = (stage.unlock?.mods || []).join(',');
    $('unlock-feat').value = (stage.unlock?.feat || []).join(',');
    $('unlock-mat').value = stage.unlock?.mat ?? '';
    $('unlock-grid').value = stage.unlock?.grid ? `${stage.unlock.grid.cols}x${stage.unlock.grid.rows}` : '';
    $('loot').value = JSON.stringify(stage.uniqueLoot || [], null, 2);
    $('blurb').value = stage.blurb || '';
    $('weakness').value = stage.weakness || '';
    $('title').innerHTML = `<h2>${esc(stage.name)} <span class="tag">${stage.source === 'manual' ? '手工' : '原始'}</span>${stage.locked ? '<span class="tag locked">锁定</span>' : ''}</h2><div class="muted">${esc(SA.CAMPAIGN[state.ci].name)} · ${esc(stage.pilot || '')}</div>`;
    state.base = base;
  }

  function renderPreview(v) {
    const box = $('preview'); box.innerHTML = '';
    if (v) box.appendChild(SA.UI.vehiclePreview(v, 2));
  }

  function weaknessList(v, stats) {
    const out = [];
    const cockpit = [], armor = [], all = [];
    SA.V.each(v, (cell, r, c) => { all.push({ r, c }); if (SA.isCockpit(cell.id)) cockpit.push({ r, c }); if (SA.mod(cell).armor) armor.push({ r, c, a: SA.mod(cell).armor }); });
    if (!cockpit.length) out.push('没有驾驶舱');
    if (cockpit.some(x => !armor.some(a => Math.abs(a.r - x.r) <= 2 && Math.abs(a.c - x.c) <= 2))) out.push('驾驶舱附近缺少装甲，可能暴露');
    const top = SA.V.stats(v).height;
    if (top && !armor.some(x => x.r <= 2)) out.push('顶部没有装甲，容易被高抛火力命中');
    const waterSeconds = stats.heatDps > 0 ? stats.water / stats.heatDps : Infinity;
    if (waterSeconds < 20) out.push(`水量只够约 ${Math.max(0, Math.round(waterSeconds))} 秒武器产热`);
    const xs = all.map(x => x.c), min = Math.min(...xs), max = Math.max(...xs);
    if (Number.isFinite(min) && !armor.some(x => x.c <= min + 1)) out.push('左侧没有装甲覆盖');
    if (Number.isFinite(max) && !armor.some(x => x.c >= max - 1)) out.push('右侧没有装甲覆盖');
    return out;
  }

  function distribution(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => `${value}×${count}`).join('、') || '无';
  }

  function renderStats(v) {
    const box = $('stats'); box.innerHTML = '';
    if (!v) return;
    const s = SA.V.stats(v), pen = [], thick = [];
    SA.V.each(v, cell => { const m = SA.mod(cell); if (m.penetration) pen.push(m.penetration); if (m.armor) thick.push(m.armor); });
    const values = [['评分', s.rating], ['价值', s.value], ['重量', Math.round(s.weight)], ['动力消耗 / 供给', `${s.demand}/${s.supply}`], ['水量', Math.round(s.water)], ['烧干时间', Number.isFinite(s.overheat) ? `${Math.round(s.overheat)} 秒` : '无限'], ['秒伤', s.dps.toFixed(1)], ['穿深分布', distribution(pen)], ['装甲厚度分布', distribution(thick)]];
    box.innerHTML = values.map(([key, value]) => `<div class="stat"><span class="muted">${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
    const weak = weaknessList(v, s);
    $('warnings').innerHTML = `<div class="notice ${s.canDeploy ? 'ok' : 'bad'}">${s.canDeploy ? '可以出战' : `不能出战：${esc(s.problems.join('；'))}`}</div>${weak.length ? `<div class="notice">自动弱点：${weak.map(esc).join('；')}</div>` : ''}`;
  }

  function renderProgress() {
    const rows = targetKeys.map(key => {
      const [ci, si] = key.split(':').map(Number), st = actualStage(ci, si); if (!st) return '';
      const rating = st.vehicle ? SA.V.stats(st.vehicle).rating : 0;
      const target = st.boss ? 'Boss 45～65%' : st.spec?.targetStrength ? `${st.spec.targetStrength[0]}～${st.spec.targetStrength[1]}` : '普通 35～80%';
      const test = state.tests[key] ? `${Math.round(state.tests[key].rate * 100)}%` : '—';
      return `<tr><td>${ci === 0 ? `序章 ${si + 1}` : `第 ${ci} 章 ${si + 1}`}</td><td>${esc(st.name)}</td><td>${rating}</td><td>${esc(target)}</td><td>${test}</td></tr>`;
    }).join('');
    $('progress').innerHTML = `<table><thead><tr><th>关</th><th>车</th><th>评分</th><th>目标强度</th><th>实测胜率</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCandidateList() {
    let picks = [];
    try { picks = JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []; } catch (error) { picks = []; }
    $('candidate').innerHTML = '<option value="">进化报告候选车</option>' + picks.map((p, i) => `<option value="${i}">${esc(p.name || `候选 ${i + 1}`)}${p.from ? ` · ${esc(p.from)}` : ''}</option>`).join('');
  }

  function selectStage(ci, si) {
    state.ci = ci; state.si = si;
    const st = actualStage(ci, si); state.vehicle = st.vehicle;
    fillFields(st); renderPreview(state.vehicle); renderStats(state.vehicle); renderList(); renderProgress(); renderCandidateList();
    $('test-result').textContent = '尚未测试。';
  }

  function parseImport(value) {
    const text = value.trim();
    if (!text) throw new Error('导入内容为空');
    if (text.startsWith('SA1.') || text.startsWith('SA2.')) return SA.V.decode(text);
    const json = JSON.parse(text), cells = Array.isArray(json) ? json : json.cells;
    if (!Array.isArray(cells)) throw new Error('需要分享码或 cells 模块清单');
    return SA.V.fromCells($('name').value || '导入关卡车', cells);
  }

  function saveRecord(lockValue) {
    const meta = readFields(); if (lockValue !== undefined) meta.locked = lockValue;
    const record = SA.StageCars.makeRecord(state.ci, state.si, state.base, state.vehicle, meta);
    const check = SA.StageCars.validate(record, state.ci, state.si, state.vehicle);
    if (!check.ok) throw new Error(check.errors.join('；'));
    const records = { ...(SA.STAGE_CARS.records || {}), [record.id]: record };
    return fetch('/__stage-cars/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, records }) }).then(response => {
      if (!response.ok) throw new Error(`服务器返回 HTTP ${response.status}`);
      SA.STAGE_CARS.records = records;
      if (SA.StageCars.applyToCampaign) SA.StageCars.applyToCampaign();
      return { record, check };
    }).catch(async error => {
      const text = `window.SA.STAGE_CARS.records = ${JSON.stringify(records, null, 2)};\nif (window.SA.StageCars && window.SA.StageCars.data) window.SA.StageCars.data.records = window.SA.STAGE_CARS.records;`;
      try { if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(text); } catch (copyError) { /* 只读环境没有剪贴板 */ }
      throw new Error(`${error.message}。记录已复制到剪贴板，请粘贴到 js/stage-cars.js：\n${text}`);
    });
  }

  function testVehicle() {
    const games = Math.max(1, Math.min(200, +$('games').value || 20)), refs = [SA.V.fromAscii('开局参考车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || [])];
    for (let ci = 0; ci <= state.ci; ci++) for (let si = 0; si < SA.CAMPAIGN[ci].stages.length; si++) if (ci < state.ci || si < state.si) refs.push(actualStage(ci, si).vehicle);
    const rows = [], counts = { p: 0, e: 0, draw: 0, timeout: 0 }; let wins = 0, total = 0, time = 0;
    refs.slice(-4).forEach((ref, ri) => { for (let i = 0; i < games; i++) {
      const seed = 0x5eed + state.ci * 10000 + state.si * 1000 + ri * 100 + i;
      const a = SA.Battle.simulate({ p: ref, e: state.vehicle, pAim: 0.8, eAim: +$('aim').value, pStyle: 'wander', eStyle: $('style').value, terrain: $('terrain').value, eBoss: $('boss').checked, seed });
      const b = SA.Battle.simulate({ p: state.vehicle, e: ref, pAim: +$('aim').value, eAim: 0.8, pStyle: $('style').value, eStyle: 'wander', terrain: $('terrain').value, seed: seed + 1 });
      for (const [result, candidateSide] of [[a, 'e'], [b, 'p']]) { const winner = result.winner || 'draw'; counts[winner] = (counts[winner] || 0) + 1; if (winner === candidateSide) wins++; total++; time += result.t || 0; }
    } });
    const rate = total ? wins / total : 0, z = 1.96, den = 1 + z * z / total, centre = rate + z * z / (2 * total), spread = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total);
    const lo = (centre - spread) / den, hi = (centre + spread) / den;
    state.tests[`${state.ci}:${state.si}`] = { rate, lo, hi, total };
    const boss = $('boss').checked, reward = !!(state.record?.unlock?.mods?.length || state.base?.spec?.reward);
    const range = boss ? [0.45, 0.65] : reward ? [0.4, 0.7] : [0.35, 0.8];
    const soft = boss ? [0.3, 0.78] : [0.2, 0.9];
    const level = rate >= range[0] && rate <= range[1] ? 'ok' : rate >= soft[0] && rate <= soft[1] ? 'warn' : 'bad';
    const label = level === 'ok' ? '绿色：目标范围内' : level === 'warn' ? '黄色：接近目标，建议扩大样本' : '红色：偏离目标，需要复核';
    $('test-result').className = `notice ${level}`;
    $('test-result').innerHTML = `${label}：候选车胜率 <b>${(rate * 100).toFixed(1)}%</b>（95% ${(lo * 100).toFixed(1)}%～${(hi * 100).toFixed(1)}%），平均用时 ${(time / Math.max(1, total)).toFixed(1)} 秒；结局 p/e/平 ${counts.p || 0}/${counts.e || 0}/${counts.draw || 0}。表现分 ${(rate * 100).toFixed(1)}。`;
    renderProgress();
  }

  $('save').onclick = async () => { try { const result = await saveRecord(); alert(`已保存并锁定。${result.check.warnings.length ? `\n警告：${result.check.warnings.join('；')}` : ''}`); selectStage(state.ci, state.si); } catch (error) { alert(error.message); } };
  $('unlock').onclick = async () => { try { await saveRecord(false); selectStage(state.ci, state.si); } catch (error) { alert(error.message); } };
  $('relock').onclick = async () => { try { await saveRecord(true); selectStage(state.ci, state.si); } catch (error) { alert(error.message); } };
  $('import').onclick = () => { $('import-box').hidden = false; $('import-value').focus(); };
  $('import-cancel').onclick = () => { $('import-box').hidden = true; $('import-value').value = ''; };
  $('import-confirm').onclick = () => {
    const value = $('import-value').value;
    if (!value.trim()) return;
    try {
      state.vehicle = parseImport(value);
      $('import-box').hidden = true;
      $('import-value').value = '';
      renderPreview(state.vehicle); renderStats(state.vehicle);
    } catch (error) { alert(error.message); }
  };
  $('candidate-import').onclick = () => { const i = +$('candidate').value; if (!Number.isInteger(i)) return; let picks = []; try { picks = JSON.parse(localStorage.getItem('steam_arena_evolve_picks')) || []; } catch (error) { return; } const p = picks[i]; if (!p) return; state.vehicle = p.cells ? SA.V.fromCells($('name').value || p.name, p.cells) : SA.V.decode(p.code); renderPreview(state.vehicle); renderStats(state.vehicle); };
  $('test').onclick = () => { try { testVehicle(); } catch (error) { $('test-result').className = 'notice bad'; $('test-result').textContent = `测试失败：${error.message}`; } };
  $('drive').onclick = () => {
    if (!state.vehicle) return;
    localStorage.setItem('steam_arena_evolve_picks', JSON.stringify([{ name: $('name').value || '手工关卡车', cells: cellsOf(state.vehicle), terrain: $('terrain').value, style: $('style').value, from: `关卡车工作台 · ${$('name').value}` }]));
    const opened = window.open('../index.html#sandbox=evolve', '_blank', 'noopener');
    // 某些内置浏览器会拦截脚本新标签；同页跳转仍然能进入现有试驾场。
    if (!opened) window.location.href = '../index.html#sandbox=evolve';
  };
  renderTerrain();
  try { SA.S.load(); SA.Camp.backfill(); } catch (error) { console.warn('工具页没有正式存档，继续使用原始关卡数据', error); }
  selectStage(0, 0);
})();
