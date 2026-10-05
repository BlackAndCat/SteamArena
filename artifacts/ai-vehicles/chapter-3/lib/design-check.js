/* 第三章设计校验薄入口：只补隔离VM内已明确的规格，复用公共六项与固定种子真实战斗。 */
'use strict';
const common = require('../../chapter-2/lib/design-check.js');
const { previewStageSpec } = require('../../../../tools/evolve.js');
function stageSpecForCandidate(SA,chapter,stage) {
  if (chapter !== 3 || ![0,1,2,3,4,5].includes(stage)) throw new Error('第三章本关的完整设计约束尚未确认');
  // 本批每车重炮体现新装备是明确设计要求；不把地图unlockMods泛化成必装规则。
  // 重炮生产最低材质是镀镍4，仅本关重炮保留既有最低材料例外；其它件仍受钢3上限约束。
  const enemyMaterial = 4, rewardModules = [['cannon_heavy'],['rangefinder'],['rocket_rack'],['boiler_l','water_l'],['pressure_tank'],['boss_core']][stage];
  Object.assign(SA.CAMPAIGN_MAP.chapters[chapter].stages[stage],{enemyMaterial,rewardModules});
  const spec = previewStageSpec(SA,chapter,stage);
  return {...spec,...(stage === 4 ? {uniqueLoot:[SA.uniqueByKey('biped:mail')]} : stage === 5 ? {uniqueLoot:[]} : {}),
    planningPatch:{enemyMaterial,rewardModules,designRequirementsSource:'本批设计要求（待用户采用），不表示生产现有关卡硬必装。',ordinaryMaterialCap:3,materialExceptions:{cannon_heavy:4},
    ...(stage === 4 ? {uniqueReward:'biped:mail',uniqueMaterial:4,uniqueCount:1} : {}),
    ...([1,2].includes(stage) ? {proposedFixedItems:[{id:rewardModules[0],count:1,mt:3}]} : {}),
    ...(stage === 5 ? {proposedFixedItems:[{id:'boss_core',count:1,mt:3}],
      rewardNote:'规划称唯一核心但生产尚未注册唯一身份，本批使用普通钢制核心；乌兹钢锭仅规划文本，不新增库存机制。'} : {}),
    note:'仅第三章隔离规格：普通件至多钢，新装备按本关明确要求装配；重炮依生产最低材料使用镀镍4特例；正式地图、奖励与预算未写入。'}};
}
function additionalConditions(SA,car,vehicle,spec) {
  const uniqueKey = spec.planningPatch?.uniqueReward;
  const uniqueRaw = cell => uniqueKey && cell[6]?.unique === uniqueKey && cell[3] === 'biped';
  const result = {ordinaryMaterials:car.cells.every(cell=>cell[3]==='cannon_heavy'?cell[4]===4:uniqueRaw(cell)?cell[4]===4:cell[4]<=3)};
  if (uniqueKey) {
    let identities = 0; SA.V.each(vehicle,cell=>{if(cell.id==='biped'&&cell.unique===uniqueKey&&cell.mt===4)identities++;});
    result.uniqueReward=car.cells.filter(uniqueRaw).length===1&&identities===1;
  }
  // 核心尚无唯一注册：每车必须有普通钢制核心，禁止以未注册第七项伪装唯一身份。
  if (spec.stage === 5) {
    const core = car.cells.filter(cell=>cell[3]==='boss_core');
    result.coreReward=core.length>0&&core.every(cell=>cell[4]===3&&!cell[6]?.unique);
  }
  return result;
}
if(require.main===module) common.main({stageSpecForCandidate,additionalConditions,includeReferenceSnapshot:true});
module.exports = {...common,stageSpecForCandidate,additionalConditions};
