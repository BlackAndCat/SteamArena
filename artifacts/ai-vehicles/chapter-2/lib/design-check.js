/* AI 手工设计检查工具：只读规则、校验显式 cells、指定策略直接对战；不生成或改装车辆。 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../../..');
const { loadGame, stageSpec, previewStageSpec, stageFor, constructionConditions, ruleFingerprint } = require(path.join(root, 'tools/evolve.js'));
const fingerprint = cells => crypto.createHash('sha256').update(JSON.stringify(cells)).digest('hex');
// 尚未落地的计划关只补隔离 VM 中已明确批准的字段；正式配置及既有三关规格不变。
function stageSpecForCandidate(SA, chapter, stage) {
  if (chapter !== 2 || stage < 3) return stageSpec(SA, chapter, stage);
  if (![3,4,5].includes(stage)) throw new Error('本关计划规格尚未确认，不能提前采用默认配置');
  // 第六关撞锤沿用既定解锁，本批仅镜片必装；解锁不能自动变成每台车的奖励构筑要求。
  const rewardModules = stage === 5 ? ['boss_lens'] : stage === 4 ? ['armor'] : [];
  const enemyMaterial = stage === 5 ? 5 : 3;
  Object.assign(SA.CAMPAIGN_MAP.chapters[chapter].stages[stage], { enemyMaterial, rewardModules });
  const spec = previewStageSpec(SA, chapter, stage);
  if (stage === 5) return { ...spec, uniqueLoot: [SA.uniqueByKey('boss_lens')], planningPatch: { enemyMaterial, rewardModules,
    ordinaryMaterialCap: 3, uniqueReward: 'boss_lens', uniqueCount: 1, uniqueMaterial: 5,
    note: '唯一镜片为可选缴获提案，不保证首胜发放；普通材料至多钢，既定解锁保留，正式配置未写入。' } };
  if (stage === 4) return { ...spec, planningPatch: { enemyMaterial: 3, rewardModules,
    proposedFixedItems: [{ id: 'armor', count: 2, mt: 3 }], note: '钢装甲固定奖励提案，不解锁新模块；既定upgrade功能奖励保留，正式配置未写入。' } };
  return { ...spec, uniqueLoot: [SA.uniqueByKey('quad:pedrail')], planningPatch: { enemyMaterial: 3, rewardModules: [],
    ordinaryMaterialCap: 2, uniqueReward: 'quad:pedrail', uniqueCount: 1, uniqueMaterial: 3,
    note: '仅补隔离运行的已批准计划字段；地图原有唯一奖励保留，正式配置未写入。' } };
}
// 六项规则照常走真实校验；唯一奖励身份及普通材料上限是本批单列的附加约束。
function additionalConditions(SA, car, v, spec) {
  if (spec.chapter !== 2 || ![3,5].includes(spec.stage)) return {};
  if (spec.stage === 5) {
    const raw = car.cells.filter(cell => cell[3] === 'boss_lens');
    let count = 0; SA.V.each(v, cell => { if (cell.id === 'boss_lens' && cell.mt === 5) count++; });
    return { uniqueReward: raw.length === 1 && raw[0][4] === 5 && count === 1,
      ordinaryMaterials: car.cells.every(cell => cell[3] === 'boss_lens' || cell[4] <= 3) };
  }
  const raw = car.cells.filter(cell => cell[3] === 'quad' && cell[6]?.unique === 'quad:pedrail');
  let identities = 0;
  SA.V.each(v, cell => { if (cell.id === 'quad' && cell.unique === 'quad:pedrail' && cell.mt === 3) identities++; });
  return { uniqueReward: raw.length === 1 && raw[0][4] === 3 && identities === 1,
    ordinaryMaterials: car.cells.every(cell => cell[3] === 'quad' && cell[6]?.unique === 'quad:pedrail' || cell[4] <= 2) };
}
function vehicle(SA, record, grid) {
  const v = SA.V.fromCells(record.name, record.cells);
  v.lim = { ...grid }; return v;
}
// 保留每件部件的层、锚点、模块、材料、等级与专项改造；标准外观的自动补齐不参与比较。
function sourceCellsConditions(SA, car, v) {
  const anchors = new Set(car.cells.map(cell => `${cell[0]}:${cell[1]}:${cell[2]}`));
  const core = list => list.map(([l,r,c,id,mt=1,lv=0,extra]) => JSON.stringify([l,r,c,id,mt,lv,extra?.refit ?? 0])).sort();
  const rebuilt = SA.StageCars.cellsOf(v);
  return { noDuplicateAnchors: anchors.size === car.cells.length, cellsPreserved: rebuilt.length === car.cells.length,
    sourceCells: JSON.stringify(core(car.cells)) === JSON.stringify(core(rebuilt)),
    refitLevels: car.cells.every(cell => Number.isInteger(cell[6]?.refit ?? 0) && (cell[6]?.refit ?? 0) >= 0 && (cell[6]?.refit ?? 0) <= 3) };
}
// 读取既有手工记录，仅导出参考数据，不修改用户配置。
function references(SA) {
  return ['0:0','0:1','0:2','1:0','1:1','1:2','1:3','1:4','1:5','1:6'].map(id => {
    const [chapter, stage] = id.split(':').map(Number), s = stageFor(SA, chapter, stage);
    return { id, name: s.name, style: s.style || 'wander', aim: s.aim ?? .8, cells: SA.StageCars.cellsOf(s.vehicle) };
  });
}
// 固定种子成对换边，候选身份映射独立于 p/e；保存接口实际返回的摘要。
function duel(SA, candidate, reference, spec, pairs, seedBase, target = [.6, .75]) {
  const p = vehicle(SA, candidate, spec.grid), e = vehicle(SA, reference, spec.grid), rows = [];
  for (let i = 0; i < pairs; i++) for (const reverse of [false, true]) {
    const seed = seedBase + i;
    const result = SA.Battle.simulate({ p: reverse ? e : p, e: reverse ? p : e,
      pStyle: reverse ? reference.style : candidate.style, eStyle: reverse ? candidate.style : reference.style,
      pAim: .8, eAim: .8,
      terrain: spec.terrain, bounds: spec.bounds, seed, aiStats: true });
    const candidateSide = reverse ? 'e' : 'p';
    // 保留真实返回值的摘要；不保存逐部件终局遥测，以免测试记录膨胀。
    const { state, ...summary } = result;
    if (state) summary.state = Object.fromEntries(Object.entries(state).map(([side, value]) => {
      const { cells, ...totals } = value; return [side, totals];
    }));
    rows.push({ seed, candidateSide, outcome: result.winner === 'draw' ? 'draw' : result.winner === candidateSide ? 'win' : 'loss', result: summary });
  }
  const wins = rows.filter(r => r.outcome === 'win').length, draws = rows.filter(r => r.outcome === 'draw').length;
  const damage = row => row.candidateSide === 'p' ? row.result.pDealt : row.result.eDealt;
  const shots = row => row.result.aiStats?.[row.candidateSide]?.shots;
  const failures = {};
  for (const row of rows) {
    const type = row.result.events?.[row.candidateSide]?.failureType;
    if (type) failures[type] = (failures[type] || 0) + 1;
  }
  const average = values => values.every(Number.isFinite) ? values.reduce((a,b) => a+b, 0) / values.length : null;
  const rewardEffects = {};
  const effectModules = [...new Set([...(spec.requiredModules || []), ...(spec.uniqueLoot || []).map(item=>item.id),
    ...(spec.planningPatch?.uniqueReward === 'quad:pedrail' ? ['quad'] : [])])];
  for (const id of effectModules) {
    const totals = {}, missingGames = rows.filter(row => !row.result.effectStats?.[row.candidateSide]?.[id]).length;
    for (const row of rows) for (const [key, value] of Object.entries(row.result.effectStats?.[row.candidateSide]?.[id] || {})) {
      if (Number.isFinite(value)) totals[key] = (totals[key] || 0) + value;
    }
    rewardEffects[id] = { totals, meanPerGame: Object.fromEntries(Object.entries(totals).map(([key,value]) => [key,value/rows.length])), missingGames,
      note: '仅汇总effectStats实际字段，不推断未暴露的伤害或常规冷却量；active等字段不擅自换算单位。'+
        (id === 'quad' ? '四足统计合并普通与唯一件，接口未单列pedrail效果或运动贡献。' : '') };
  }
  return { referenceId: reference.id, referenceFingerprint: fingerprint(reference.cells), referenceStyle: reference.style,
    candidateFingerprint: fingerprint(candidate.cells), style: candidate.style, terrain: spec.terrain, bounds: spec.bounds,
    candidateAim: .8, referenceAim: .8, referenceOriginalAim: reference.aim ?? null,
    seedBase, seedPairs: pairs, games: rows.length, wins, draws, losses: rows.length-wins-draws,
    winRate: (wins + draws * .5) / rows.length, rawWinRate: wins / rows.length,
    target, reachedTarget: (wins+draws*.5)/rows.length >= target[0] && (wins+draws*.5)/rows.length <= target[1],
    below45: (wins+draws*.5)/rows.length < .45, rewardEffects,
    diagnostics: { meanCandidateDamage: average(rows.map(damage)), meanCandidateShots: average(rows.map(shots)),
      noShotGames: rows.filter(row => shots(row) === 0).length, failureCounts: failures,
      note: '伤害和开火直接来自simulate返回值；未提供的数值保存null。失败类型为终局状态记录，不推断原因。' }, rows };
}
// 后续章节仅替换隔离规格与附加条件，CLI流程和真实对战保持共用；无参数时沿用第二章行为。
function main(options = {}) {
  const [mode, input, referencePath, referenceId, pairArg, outArg, filterId] = process.argv.slice(2), { SA } = loadGame();
  if (mode === 'references') {
    const output = { candidates: references(SA) }; fs.writeFileSync(input, JSON.stringify(output, null, 2)); return;
  }
  const data = JSON.parse(fs.readFileSync(input, 'utf8')), [chapter, stage] = data.stageId.split(':').map(Number);
  const spec = (options.stageSpecForCandidate || stageSpecForCandidate)(SA, chapter, stage), rules = ruleFingerprint(SA);
  const refData = mode === 'battle' ? JSON.parse(fs.readFileSync(referencePath, 'utf8')) : null;
  const reference = refData?.candidates.find(c => c.id === referenceId);
  if (mode === 'battle' && !reference) throw new Error('参考车 ID 不存在');
  const candidates = filterId ? data.candidates.filter(car => car.id === filterId) : data.candidates;
  if (!candidates.length) throw new Error('指定候选 ID 不存在');
  const report = { stageId: data.stageId, spec, rules, candidates: candidates.map(c => {
    const v = vehicle(SA, c, spec.grid), validation = constructionConditions(SA, v, spec), stats = SA.V.stats(v);
    // 原始同层锚点不可重复；fromCells会覆盖重复锚点，不能用转换后的合法车掩盖部件丢失。
    const inputValidation = sourceCellsConditions(SA, c, v);
    const additionalValidation = (options.additionalConditions || additionalConditions)(SA, c, v, spec);
    const row = { id: c.id, fingerprint: fingerprint(c.cells), validation, inputValidation, additionalValidation, issues: SA.V.issues(v), budget: stats.value, stats };
    if (mode === 'battle') {
      if (![...Object.values(validation), ...Object.values(inputValidation), ...Object.values(additionalValidation)].every(Boolean)) throw new Error(`${c.id} 未通过规则，不能正式对战`);
      row.battleTests = duel(SA, c, reference, spec, Number(pairArg) || 6, 20261005, data.designTargetWinRate || [.6,.75]);
      console.error(JSON.stringify({ id: c.id, games: row.battleTests.games, wins: row.battleTests.wins, draws: row.battleTests.draws }));
    }
    return row;
  }) };
  // 跨章参考显式记录文档来源和完整冻结结构，避免仅凭候选编号误取同关序号。
  // 默认第二章输出不新增此块，后续薄入口可明确启用。
  if (mode === 'battle' && options.includeReferenceSnapshot) {
    report.referenceSnapshot = { ...reference, fingerprint: fingerprint(reference.cells),
      sourceFile: path.relative(root,referencePath).replace(/\\/g,'/'), stageId: reference.stageId || refData.stageId };
    for (const row of report.candidates) row.battleTests.referenceSourceFile = report.referenceSnapshot.sourceFile;
  }
  const output = outArg || referencePath;
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
  else console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main();
module.exports = { main, vehicle, references, duel, fingerprint, stageSpecForCandidate, additionalConditions, sourceCellsConditions };
