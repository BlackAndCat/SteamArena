/* 第三章奖励提案桥回归：调用生产控制台合并函数，核验本批六关，绝不保存草稿。 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {SA}=require('../../../../tools/evolve.js').loadGame();
const source=fs.readFileSync(path.join(__dirname,'../../../../tools/console.js'),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
const context={SA,clone,planStage:(chapter,stage)=>SA.CAMPAIGN_MAP.chapters[chapter].stages[stage],stageBefore:()=>null,newStageName:(chapter,stage)=>SA.CAMPAIGN_MAP.chapters[chapter].stages[stage].car,STYLE_BY_NAME:{}};
function block(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
vm.runInNewContext(block('  function newStageDefaults(','  // 候选工具交来的车'),context);
vm.runInNewContext(block('  function mergeAiRewardPlan(','  // 新关卡只在内存里建立底稿'),context);
for(let stage=0;stage<6;stage++){
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,`../ch3-0${stage+1}-candidates.json`),'utf8')),fresh=context.newStageDefaults(3,stage);
  const fields={rewardItems:[],lootText:JSON.stringify(fresh.uniqueLoot),unlock:fresh.unlock};
  context.mergeAiRewardPlan(fields,data.rewardPlan);const first=JSON.stringify(fields);context.mergeAiRewardPlan(fields,data.rewardPlan);assert.equal(JSON.stringify(fields),first,'重复交接不叠加奖励');
  for(const id of SA.CAMPAIGN_MAP.chapters[3].stages[stage].unlockMods||[])assert(fields.unlock.mods.includes(id),'保留规划的模块解锁');
  if(stage===0)assert.equal(fields.rewardItems.find(item=>item.id==='cannon_heavy'&&item.mt===4).count,1);
  if(stage===1)assert.equal(fields.rewardItems.find(item=>item.id==='rangefinder'&&item.mt===3).count,1);
  if(stage===2)assert.equal(fields.rewardItems.find(item=>item.id==='rocket_rack'&&item.mt===3).count,1);
  if(stage===4)assert.equal(JSON.parse(fields.lootText).filter(item=>item.key==='biped:mail').length,1);
  if(stage===5){assert.equal(fields.rewardItems.find(item=>item.id==='boss_core'&&item.mt===3).count,1);assert(!JSON.parse(fields.lootText).some(item=>['boss_core','core'].includes(item.key)));}
}
// 用户已经编辑的固定奖励数量和唯一对象必须保留；提案只补缺项。
const custom={rewardItems:[{id:'rangefinder',mt:3,count:7}],lootText:JSON.stringify([{key:'biped:mail',note:'用户值'}]),unlock:{mods:['piston'],feat:['shop'],mat:4,grid:{cols:8,rows:6}}};
context.mergeAiRewardPlan(custom,{status:'proposal-not-saved',fixedItems:[{id:'rangefinder',mt:3,count:1}],uniqueLoot:[{key:'biped:mail'}],unlock:{mods:['rocket_rack'],feat:['upgrade']}});
assert.equal(custom.rewardItems[0].count,7);assert.equal(JSON.parse(custom.lootText)[0].note,'用户值');assert.equal(custom.unlock.mat,4);assert.equal(custom.unlock.grid.cols,8);assert(custom.unlock.mods.includes('piston'));assert(custom.unlock.mods.includes('rocket_rack'));assert(custom.unlock.feat.includes('shop'));
console.log(JSON.stringify({plannedStages:6,steelRangefinder:true,steelRocketRack:true,mailIdentity:true,ordinarySteelCore:true,idempotent:true,userValuesPreserved:true,writeRequests:0}));
