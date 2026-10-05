/* 奖励桥回归：调用控制台实际局部函数，检查计划新关与提案幂等；不打开保存接口。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { SA } = require('../../../../tools/evolve.js').loadGame();
const source = fs.readFileSync(path.join(__dirname,'../../../../tools/console.js'),'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const context = { SA, clone, planStage:(c,s)=>SA.CAMPAIGN_MAP.chapters[c].stages[s], stageBefore:()=>null,
  newStageName:(c,s)=>SA.CAMPAIGN_MAP.chapters[c].stages[s].car, STYLE_BY_NAME:{} };
function functionBlock(start,end) { return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))); }
vm.runInNewContext(functionBlock('  function newStageDefaults(', '  // 候选工具交来的车'),context);
vm.runInNewContext(functionBlock('  function mergeAiRewardPlan(', '  // 新关卡只在内存里建立底稿'),context);
for (const stage of [3,4,5]) {
  const document = JSON.parse(fs.readFileSync(path.join(__dirname,`../ch2-0${stage+1}-candidates.json`),'utf8'));
  const fresh = context.newStageDefaults(2,stage);
  const fields = { rewardItems:[],lootText:JSON.stringify(fresh.uniqueLoot),unlock:fresh.unlock };
  context.mergeAiRewardPlan(fields,document.rewardPlan);
  const initial = JSON.stringify(fields); context.mergeAiRewardPlan(fields,document.rewardPlan);
  assert.equal(JSON.stringify(fields),initial,'重复导入不得重复奖励');
  if (stage===3) assert.equal(JSON.parse(fields.lootText).filter(item=>item.key==='quad:pedrail').length,1);
  if (stage===4) { assert(fields.unlock.feat.includes('upgrade')); assert.equal(fields.rewardItems.find(item=>item.id==='armor'&&item.mt===3).count,2); }
  if (stage===5) { assert(fields.unlock.mods.includes('piston')); assert(fields.unlock.mods.includes('boss_lens')); assert.equal(JSON.parse(fields.lootText).filter(item=>item.key==='boss_lens').length,1); }
}
// 用户已经手动改过的数量、唯一件对象及解锁标量要保留；提案只补缺集合。
const modified = {rewardItems:[{id:'armor',mt:3,count:7}],lootText:JSON.stringify([{key:'quad:pedrail',note:'用户值'}]),unlock:{feat:['shop'],mat:4,grid:{cols:8,rows:6}}};
context.mergeAiRewardPlan(modified,{status:'proposal-not-saved',fixedItems:[{id:'armor',mt:3,count:2}],uniqueLoot:[{key:'quad:pedrail'}],unlock:{feat:['upgrade']}});
assert.equal(modified.rewardItems[0].count,7); assert.equal(JSON.parse(modified.lootText)[0].note,'用户值');
assert.equal(modified.unlock.mat,4); assert.equal(modified.unlock.grid.cols,8); assert(modified.unlock.feat.includes('shop'));
console.log(JSON.stringify({plannedStages:3,upgrade:true,piston:true,bossLens:true,pedrail:true,idempotent:true,userValuesPreserved:true,writeRequests:0}));
