/* AI 定制候选浏览器：直接读最终设计数据，选择与工作台草稿导入不写正式关卡。 */
'use strict';
(() => {
  // 两章真实候选与图片已齐；未完成正式测试的车仍显示待测状态，章节目录独立。
  const chapters = [2,3];
  const chapterName = chapter => ({2:'第二章',3:'第三章'}[chapter] || `第${chapter}章`);
  const baseOf = stage => `../artifacts/ai-vehicles/chapter-${stage.stageId.split(':')[0]}/`;
  const fileOf = stage => `ch${stage.stageId.split(':')[0]}-0${Number(stage.stageId.split(':')[1])+1}-candidates.json`;
  const files = chapters.flatMap(chapter => [1,2,3,4,5,6].map(stage => `../artifacts/ai-vehicles/chapter-${chapter}/ch${chapter}-0${stage}-candidates.json`));
  const SELECTION_KEY = 'sa.aiDesignSelection.v1';
  const $ = id => document.getElementById(id);
  let allStages = [], stages = [], currentChapter = 2, current = 0, chapterStages = {}, selectedId = '', moduleNames = {}, styleNames = {}, terrainNames = {}, referenceNames = {}, selections = {};
  // 会话内分别记住每关选择，返回本页时恢复浏览位置；不写游戏存档。
  try { const saved = JSON.parse(sessionStorage.getItem(SELECTION_KEY) || '{}'); currentChapter = saved.currentChapter || 2;
    chapterStages = saved.chapterStages || {2:saved.current || 0}; current = chapterStages[currentChapter] || 0; selections = saved.selections || {};
  } catch (_) { /* 旧会话数据无效时从推荐参考开始 */ }
  function remember() { chapterStages[currentChapter] = current; sessionStorage.setItem(SELECTION_KEY, JSON.stringify({ current:chapterStages[2] || 0, currentChapter, chapterStages, selections })); }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const percent = value => `${(Number(value) * 100).toFixed(2)}%`;
  const moduleName = id => moduleNames[id]?.name || id;
  const styleName = id => styleNames[id] || id;
  const terrainName = id => terrainNames[id]?.name || id;
  const materialName = mt => window.SA.MATS[mt || 1]?.name || `材料档 ${mt || 1}`;
  const uniqueName = item => window.SA.uniqueByKey(item.key || item.id)?.name
    || moduleNames[item.id || item.key]?.name || item.name || item.key || item.id;
  // 规范spec与单列唯一要求共同决定必装显示，普通四足不能冒充步行履带唯一件。
  const requirements = stage => [...new Set([...(stage.spec.requiredModules || []).map(moduleName),
    ...(stage.spec.planningPatch?.uniqueReward ? [uniqueName({key:stage.spec.planningPatch.uniqueReward})] : [])])];
  // 对战对象使用当批参考快照及候选车名，编号仅作辅助定位。
  const referenceName = id => referenceNames[id] ? `${referenceNames[id]}（${id}）` : id;
  // 六项构筑规则之外，后续批次也检查源锚点保真与唯一奖励等附加条件。
  const legal = car => ['construction','grid','modulePool','materials','budget','reward'].every(key => car.validation?.[key] === true)
    && Object.values(car.inputValidation || {}).every(value => value === true)
    && Object.values(car.additionalValidation || {}).every(value => value === true);
  function status(car) {
    if (!car.battleTests) return {text:'正式测试进行中',kind:'low'};
    const rate = car.battleTests.winRate, target = car.battleTests.target || [.6,.75];
    return rate > target[1] ? {text:'超目标',kind:'high'} : rate >= target[0] ? {text:'达标',kind:'target'} : rate < .45 ? {text:'偏弱',kind:'weak'} : {text:'未达目标',kind:'low'};
  }
  // 只统计原始 cells；材料与升级等级始终由完整结构传递给工作台。
  function modules(car) {
    const counts = {};
    for (const cell of car.cells) counts[cell[3]] = (counts[cell[3]] || 0) + 1;
    return Object.entries(counts).map(([id,count]) => `${moduleName(id)}×${count}`).join('、');
  }
  function render() {
    const stage = stages[current], index = Number(stage.stageId.split(':')[1]);
    $('chapter-title').textContent = `AI 设计候选 · ${chapterName(currentChapter)} · ${stages.length} 关 · ${stages.reduce((count,item)=>count+item.candidates.length,0)} 台`;
    $('chapter-tabs').hidden = chapters.length < 2;
    $('chapter-tabs').innerHTML = chapters.map(chapter => `<button type="button" data-chapter="${chapter}" aria-selected="${chapter===currentChapter}">${chapterName(chapter)} · ${allStages.filter(item=>Number(item.stageId.split(':')[0])===chapter).reduce((count,item)=>count+item.candidates.length,0)} 台候选</button>`).join('');
    $('stage-tabs').innerHTML = stages.map((s,i) => `<button type="button" data-stage="${i}" aria-selected="${i===current}">${chapterName(currentChapter)}第 ${i+1} 关 · ${escape(s.stageName)}</button>`).join('');
    const selected = stage.candidates.find(car => car.id === selectedId);
    $('stage-link').disabled = !selected || !legal(selected);
    const required = requirements(stage);
    const requirementLabel = stage.spec.planningPatch?.designRequirementsSource ? '本批设计要求（待用户采用）' : '必装';
    $('stage-summary').textContent = `${chapterName(currentChapter)}第 ${index+1} 关 · ${stage.stageName} · ${stage.candidates.length} 台候选 · 预算上限 £${stage.spec.budget}${required.length?' · '+requirementLabel+' '+required.join('、'):''} · ${stage.spec.grid.cols}×${stage.spec.grid.rows} 大格`;
    $('candidate-grid').innerHTML = stage.candidates.map(car => {
      const result = status(car), recommended = stage.temporaryReferenceId === car.id;
      return `<article class="ai-card" data-id="${escape(car.id)}" data-selected="${car.id===selectedId}">
        <h3>${escape(car.name)}</h3><span class="ai-badge">AI 生成 · ${escape(car.model)}${recommended?' · 推荐参考（未正式采用）':''}</span>
        <img src="${baseOf(stage)+escape(car.preview)}" alt="${escape(car.name)}真实游戏预览" width="440" height="302">
        <strong>£${car.budget} / £${stage.spec.budget}</strong>
        <span class="ai-status" data-kind="${result.kind}">${car.battleTests?percent(car.battleTests.winRate)+' · ':''}${result.text}</span>
        <small>${legal(car)?'六项硬规则全部通过':'硬规则未全部通过'} · ${car.battleTests?.games || 0} 局正式实测</small>
        <button type="button" data-select="${escape(car.id)}" aria-pressed="${car.id===selectedId}">${car.id===selectedId?'已选中 · 查看详情':'选择这台'}</button>
      </article>`;
    }).join('');
    renderDetails();
  }
  function renderDetails() {
    const stage = stages[current], car = stage.candidates.find(item => item.id === selectedId);
    $('candidate-details').hidden = !car;
    if (!car) return;
    const b = car.battleTests || {}, result = status(car), warnings = car.validationDetails?.warnings || [];
    const cross = (car.crossTests || []).map(test => `${referenceName(test.referenceId)}：${percent(test.winRate)}（${test.games}局）`).join('；');
    const plan = stage.rewardPlan;
    // 材料例外只对明确列出的新装备生效，不能把隔离spec上限误读为全车材料开放。
    const patch = stage.spec.planningPatch, materials = patch?.ordinaryMaterialCap
      ? [`普通模块可用${materialName(patch.ordinaryMaterialCap)}制（上限）`,
        ...Object.entries(patch.materialExceptions || {}).map(([id,mt]) => `${moduleName(id)}：${materialName(mt)}（规则最低材料）`)].join('；') : '';
    // 缺失奖励只是提案；唯一件列入可选缴获，不能表述为保证发放。
    const rewards = plan?.status === 'proposal-not-saved' ? [
      ...(plan.fixedItems || []).map(item => `${materialName(item.mt)}制${moduleName(item.id)}×${item.count}`),
      ...(plan.uniqueLoot || []).map(item => `${uniqueName(item)}（可选缴获，非保证发放）`),
      ...(plan.unlock?.feat || []).map(id => `开放功能：${window.SA.FEATURES[id]?.name || id}`),
    ].join('；') : '';
    $('candidate-details').innerHTML = `<h2>${escape(car.name)} · 设计详情</h2>
      <div class="ai-detail-grid"><img src="${baseOf(stage)+escape(car.preview)}" alt="选中车辆真实预览" width="440" height="302"><div>
        <p>${escape(car.designIntent)}</p><dl>
          <dt>设计来源</dt><dd>AI 生成 · ${escape(car.model)} · ${escape(car.id)}</dd>
          <dt>预算</dt><dd>£${car.budget} / £${stage.spec.budget}（${percent(car.budget/stage.spec.budget)}）</dd>
          <dt>主要模块</dt><dd>${escape(modules(car))}</dd>
          <dt>战术策略</dt><dd>${escape(styleName(car.style))}${requirements(stage).length?' · 必装：'+escape(requirements(stage).join('、')):''}</dd>
          <dt>规则校验</dt><dd>${legal(car)?'构筑、网格、解锁模块、材料、预算、奖励：全部通过':'规则未全部通过'}${car.inputValidation?'；源锚点、材料等级与完整部件保真：'+(Object.values(car.inputValidation).every(Boolean)?'通过':'未通过'):''}${car.additionalValidation?.uniqueReward!==undefined?'；唯一奖励身份与普通材料上限：'+(Object.values(car.additionalValidation).every(Boolean)?'通过':'未通过'):''}</dd>
          <dt>实战结果</dt><dd>${car.battleTests?`${b.wins} 胜 / ${b.draws} 平 / ${b.losses} 负；${percent(b.winRate)}，${result.text}`:result.text}（目标 ${(b.target || [.6,.75]).map(percent).join('～')}）</dd>
          <dt>对战参考</dt><dd>${car.battleTests?`${escape(referenceName(b.referenceId))} · 场地 ${escape(terrainName(b.terrain))}；双方瞄准 ${b.candidateAim} / ${b.referenceAim}`:'正式成绩尚未写入'}</dd>
          ${plan?.status === 'proposal-not-saved'?`<dt>奖励提案 · 待保存</dt><dd>${escape(rewards || '无新增固定奖励')}<br>${escape(plan.note || '')}</dd>`:''}
          <dt>搭配限制</dt><dd>${materials?escape(materials)+'<br>':''}${escape(warnings.join('；') || '无记录的构筑警告')}${car.budgetTradeoff?.note?'<br>'+escape(car.budgetTradeoff.note):''}</dd>
          ${b.notReachedReason?`<dt>未达标原因</dt><dd>${escape(b.notReachedReason)}</dd>`:''}
          ${cross?`<dt>交叉检查</dt><dd>${escape(cross)}。每对仅 6 局，供参考。</dd>`:''}
        </dl></div></div>
      <div class="ai-actions"><button type="button" id="open-workbench" ${legal(car)?'':'disabled'}>送入本关工作台 · 查看与改装</button><a href="${baseOf(stage)+fileOf(stage)}" target="_blank" rel="noopener">查看完整候选 JSON</a></div>
      <p class="ai-note">带入车辆与设计策略，保存后才生效；会替换目标关卡的未保存草稿。保留本关原枪法，可在工作台“文字与奖励”调整策略；本页 0.8 是测试条件。AI 来源保留在候选记录及车名中。</p>
      <p id="handoff-message" role="status"></p>`;
    $('open-workbench').addEventListener('click', () => openWorkbench(stage, car));
  }
  function openWorkbench(stage, car) {
    // 同页会话桥一次消费完整 cells；不用不保真材料等级的分享码，也不调用保存接口。
    const [chapter,index] = stage.stageId.split(':').map(Number), key = `${chapter},${index}`;
    try {
      sessionStorage.setItem('steam_arena_stage_swap', JSON.stringify({ key, name: car.name, cells: car.cells,
        code: null, style: car.style, source: car.source, candidateId: car.id, rewardPlan: stage.rewardPlan }));
      remember();
      location.href = `console.html#/stage/${key}/build`;
    } catch (error) { $('handoff-message').textContent = `草稿未送入：${error.message || error}`; }
  }
  $('chapter-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-chapter]');
    if (!button) return;
    currentChapter = Number(button.dataset.chapter); stages = allStages.filter(stage => Number(stage.stageId.split(':')[0]) === currentChapter);
    current = chapterStages[currentChapter] || 0;
    if (!stages[current]) current = 0;
    selectedId = selections[stages[current].stageId] || stages[current].temporaryReferenceId || stages[current].candidates[0].id;
    remember(); render();
  });
  $('stage-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-stage]');
    if (!button) return;
    current = Number(button.dataset.stage);
    selectedId = selections[stages[current].stageId] || stages[current].temporaryReferenceId || stages[current].candidates[0].id;
    remember();
    render();
  });
  // 页头主按钮始终读取最新选择，和详情按钮复用完整草稿交接路径。
  $('stage-link').addEventListener('click', () => {
    const stage = stages[current], car = stage?.candidates.find(item => item.id === selectedId);
    if (car && legal(car)) openWorkbench(stage, car);
  });
  $('candidate-grid').addEventListener('click', event => {
    const card = event.target.closest('[data-id]');
    if (!card) return;
    selectedId = card.dataset.id; selections[stages[current].stageId] = selectedId; remember(); render();
  });
  async function load() {
    const responses = await Promise.all([...files.map(file => fetch(file, {cache:'no-store'})),
      fetch('../config/content.json', {cache:'no-store'}), fetch('../artifacts/ai-vehicles/chapter-2/references/manual-cars.json', {cache:'no-store'})]);
    if (responses.some(response => !response.ok)) throw new Error('候选数据读取失败，请使用本地服务器打开页面。');
    const data = await Promise.all(responses.map(response => response.json()));
    allStages = data.slice(0,files.length); moduleNames = window.SA.MODULES;
    styleNames = Object.fromEntries(window.SA.AI_STYLES.map(item => [item.id,item.name]));
    terrainNames = data[files.length].TERRAINS || {};
    referenceNames = Object.fromEntries([...data[files.length+1].candidates, ...allStages.flatMap(stage => stage.candidates)].map(car => [car.id,car.name]));
    if (!chapters.includes(currentChapter)) currentChapter = 2;
    stages = allStages.filter(stage => Number(stage.stageId.split(':')[0]) === currentChapter);
    current = chapterStages[currentChapter] || 0;
    if (!stages[current]) current = 0;
    selectedId = selections[stages[current].stageId] || stages[current].temporaryReferenceId || stages[current].candidates[0].id;
    render();
  }
  load().catch(error => { $('load-error').hidden=false; $('load-error').textContent=error.message; $('stage-summary').textContent='候选数据未加载'; });
})();
