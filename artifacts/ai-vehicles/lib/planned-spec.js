/* 第四、五章设计提案规格：只补独立模拟进程中的地图，不写正式地图、奖励或用户关卡。 */
'use strict';
const {previewStageSpec}=require('../../../tools/evolve.js');
const requirements={
  2:[[],[],[],[],['armor'],['boss_lens']],
  3:[['cannon_heavy'],['rangefinder'],['rocket_rack'],['boiler_l','water_l'],['pressure_tank'],['boss_core']],
  4:[['cockpit'],['armor','mortar_s'],['mg2','harpoon'],['gyroscope'],['mortar'],['cockpit','mg2']],
  5:[['mg','harpoon'],['flamer','rocket_rack'],['mg2','spike'],['boss_ram','mortar'],['flamer','harpoon'],['cannon_giant']]
};
const uniqueKeys={ '5:0':'biped:steamman','5:1':'quad:dragon','5:3':'boss_ram','5:5':'cannon_giant' };
const fixedItems={
  4:[[{id:'cockpit',mt:4,count:1}],[{id:'armor',mt:4,count:2}],[{id:'mg2',mt:4,count:1}],
    [{id:'gyroscope',mt:2,count:1}],[{id:'mortar',mt:5,count:1}],[{id:'mg2',mt:5,count:1}]],
  5:[[],[],[{id:'mg2',mt:5,count:1}],[],[{id:'flamer',mt:4,count:1}],[]]
};
function stageSpecForCandidate(SA,chapter,stage){
  if(![4,5].includes(chapter)||!Number.isInteger(stage)||stage<0||stage>5)throw new Error('设计章节或关卡无效');
  // 逐关累计前批已展示的模块；真实手工记录仍由公共规格函数优先读取。
  for(let ch=2;ch<=chapter;ch++)for(let s=0;s<6;s++){
    if(ch===chapter&&s>stage)break;
    const entry=SA.CAMPAIGN_MAP.chapters[ch].stages[s];
    if(ch>=3||s>=3)entry.rewardModules=requirements[ch][s];
  }
  const key=`${chapter}:${stage}`,uniqueReward=uniqueKeys[key],unique=uniqueReward?SA.uniqueByKey(uniqueReward):null;
  const ordinaryMaterialCap=chapter===4&&stage===3?2:chapter===5&&stage===4?4:5;
  const enemyMaterial=Math.max(ordinaryMaterialCap,unique?.mt||1);
  Object.assign(SA.CAMPAIGN_MAP.chapters[chapter].stages[stage],{enemyMaterial});
  const spec=previewStageSpec(SA,chapter,stage);
  return {...spec,uniqueLoot:unique?[unique]:[],planningPatch:{enemyMaterial,ordinaryMaterialCap,
    rewardModules:requirements[chapter][stage],proposedFixedItems:fixedItems[chapter][stage],
    designRequirementsSource:'本批直接设计提案，待用户采用；没有写入正式关卡。',
    ...(unique?{uniqueReward,uniqueMaterial:unique.mt,uniqueCount:1}:{}),
    note:'预算读取逐关权威表。全车间开放；唯一件材料只对该身份生效，普通件不随之提升。'}};
}
function additionalConditions(SA,car,vehicle,spec){
  const p=spec.planningPatch,key=p.uniqueReward;
  const actual=SA.StageCars.cellsOf(vehicle);
  const marked=car.cells.filter(cell=>cell[6]?.unique||SA.MODULES[cell[3]].unique);
  const uniqueMatch=cell=>key&&(cell[6]?.unique||cell[3])===key&&cell[4]===p.uniqueMaterial;
  const chassis=spec.chapter===4?['track','track','biped','track','quad','track'][spec.stage]:['biped','quad','biped','track','track','track'][spec.stage];
  return {ordinaryMaterials:car.cells.every(cell=>uniqueMatch(cell)||cell[4]<=p.ordinaryMaterialCap),
    uniqueReward:key?marked.length===1&&uniqueMatch(marked[0])&&actual.filter(uniqueMatch).length===1:marked.length===0,
    chassisTheme:car.cells.some(cell=>cell[3]===chassis)&&car.cells.every(cell=>SA.MODULES[cell[3]].layer!=='chassis'||cell[3]===chassis)};
}
module.exports={stageSpecForCandidate,additionalConditions,fixedItems};
