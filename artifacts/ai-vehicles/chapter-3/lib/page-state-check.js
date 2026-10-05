/* 章节状态隔离回归：第三章尚未落稿时仅在VM中复制测试数据，不向真实页面发布假车。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.resolve(__dirname,'../../../..');
const { SA } = require('../../../../tools/evolve.js').loadGame();
const source = fs.readFileSync(path.join(root,'tools/ai-designs.js'),'utf8').replace('const chapters = [2];','const chapters = [2,3];');
const storage = new Map([['sa.aiDesignSelection.v1',JSON.stringify({current:1,selections:{'2:1':'ch2-02-02'}})]]), nodes = new Map(), location = {href:''};
function node(id) {
  if (!nodes.has(id)) nodes.set(id,{hidden:false,textContent:'',innerHTML:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  return nodes.get(id);
}
const browser = { window:{SA},document:{getElementById:node},location,
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  fetch:async url=>({ok:true,json:async()=>{
    const match = url.match(/chapter-3\/ch3-0([1-6])-candidates\.json$/);
    if (!match) return JSON.parse(fs.readFileSync(path.resolve(root,'tools',url),'utf8'));
    const stage = Number(match[1])-1, data = JSON.parse(fs.readFileSync(path.join(root,`artifacts/ai-vehicles/chapter-2/ch2-0${stage+1}-candidates.json`),'utf8'));
    data.stageId=`3:${stage}`; data.stageName=`第三章测试${stage+1}`; data.temporaryReferenceId=data.temporaryReferenceId.replace('ch2','ch3');
    if (stage === 0) data.spec.planningPatch={ordinaryMaterialCap:3,materialExceptions:{cannon_heavy:4}};
    for(const car of data.candidates) { car.id=car.id.replace('ch2','ch3'); car.name=`测试第三章 ${car.name}`; }
    return data;
  }}) };
const click = (id,dataset)=>node(id).listeners.click({target:{closest:()=>({dataset})}});
async function main() {
  vm.runInNewContext(source,browser); await new Promise(resolve=>setImmediate(resolve));
  assert(node('candidate-details').innerHTML.includes('ch2-02-02'),'兼容原第二章会话');
  click('chapter-tabs',{chapter:'3'});
  assert(node('candidate-details').innerHTML.includes('普通模块可用钢制（上限）'));
  assert(node('candidate-details').innerHTML.includes('重炮：镀镍（规则最低材料）'));
  click('stage-tabs',{stage:'1'}); click('candidate-grid',{id:'ch3-02-04'});
  click('stage-link',{}); let payload=JSON.parse(storage.get('steam_arena_stage_swap'));
  assert.equal(payload.key,'3,1'); assert.equal(payload.candidateId,'ch3-02-04');
  assert(node('candidate-grid').innerHTML.includes('chapter-3/previews/'));
  assert(node('candidate-details').innerHTML.includes('chapter-3/ch3-02-candidates.json'));
  click('chapter-tabs',{chapter:'2'}); assert(node('candidate-details').innerHTML.includes('ch2-02-02'));
  click('stage-link',{}); payload=JSON.parse(storage.get('steam_arena_stage_swap')); assert.equal(payload.key,'2,1');
  click('chapter-tabs',{chapter:'3'}); assert(node('candidate-details').innerHTML.includes('ch3-02-04'));
  vm.runInNewContext(source,browser); await new Promise(resolve=>setImmediate(resolve));
  assert(node('candidate-details').innerHTML.includes('ch3-02-04'),'第三章浏览位置恢复');
  const state=JSON.parse(storage.get('sa.aiDesignSelection.v1'));assert.equal(state.selections['2:1'],'ch2-02-02');assert.equal(state.selections['3:1'],'ch3-02-04');
  console.log(JSON.stringify({mockOnly:true,legacySession:true,chaptersIndependent:true,chapterPaths:true,targetKeys:true,reloadRestored:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
