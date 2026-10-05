/* 真实两章页面回归：读取已落稿的60台，逐车核验草稿桥，不写正式关卡或游戏存档。 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../../../..');
const {SA}=require('../../../../tools/evolve.js').loadGame();
const session=require('../../../../tools/workbench-session.js');
// 正式接入前仅在隔离VM启用第三章，页面发布本身仍由任务统筹决定。
const source=fs.readFileSync(path.join(root,'tools/ai-designs.js'),'utf8').replace('const chapters = [2];','const chapters = [2,3];');
const chapters=[2,3],documents=chapters.flatMap(chapter=>[1,2,3,4,5,6].map(stage=>JSON.parse(fs.readFileSync(path.join(root,`artifacts/ai-vehicles/chapter-${chapter}/ch${chapter}-0${stage}-candidates.json`),'utf8'))));
const referenceNames=Object.fromEntries([...JSON.parse(fs.readFileSync(path.join(root,'artifacts/ai-vehicles/chapter-2/references/manual-cars.json'),'utf8')).candidates,...documents.flatMap(data=>data.candidates)].map(car=>[car.id,car.name]));
const storage=new Map([['sa.aiDesignSelection.v1',JSON.stringify({current:1,selections:{'2:1':'ch2-02-02'}})]]),nodes=new Map(),location={href:''};let writeRequests=0;
function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',innerHTML:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(id);}
const browser={window:{SA},document:{getElementById:node},location,sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},fetch:async(url,options)=>{if(options?.method&&options.method!=='GET')writeRequests++;return{ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,'tools',url),'utf8'))};}};
const click=(id,dataset)=>node(id).listeners.click({target:{closest:()=>({dataset})}});
const normalize=cells=>JSON.stringify(Array.from(cells,cell=>JSON.stringify([...cell.slice(0,6),cell[6]?.unique||null])).sort());
async function main(){
  vm.runInNewContext(source,browser);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(node('load-error').textContent,'');assert(node('candidate-details').innerHTML.includes('ch2-02-02'),'旧第二章选车恢复');
  let count=0;
  for(const chapter of chapters){
    click('chapter-tabs',{chapter:String(chapter)});
    const stages=documents.filter(data=>Number(data.stageId.split(':')[0])===chapter);
    for(let index=0;index<stages.length;index++){
      click('stage-tabs',{stage:String(index)});const data=stages[index];
      assert(node('chapter-title').textContent.includes('30 台'));
      assert(node('candidate-grid').innerHTML.includes(`chapter-${chapter}/previews/`));
      for(const car of data.candidates){
        click('candidate-grid',{id:car.id});
        if(car.battleTests)assert(node('candidate-details').innerHTML.includes(referenceNames[car.battleTests.referenceId]));
        else assert(node('candidate-details').innerHTML.includes('正式测试进行中'));
        click('open-workbench',{});const payload=JSON.parse(storage.get('steam_arena_stage_swap'));
        click('stage-link',{});assert.deepStrictEqual(JSON.parse(storage.get('steam_arena_stage_swap')),payload);
        assert.deepStrictEqual(payload.cells,car.cells);assert.deepStrictEqual(payload.rewardPlan,data.rewardPlan);
        assert.equal(payload.style,car.style);assert.equal(payload.aim,undefined);assert.equal(payload.name,car.name);
        assert.equal(payload.source,'ai-generated');assert.equal(payload.candidateId,car.id);
        assert.equal(payload.key,data.stageId.replace(':',','));assert.equal(location.href,`console.html#/stage/${payload.key}/build`);
        const restored=session.parseVehicle(JSON.stringify({cells:payload.cells}),payload.name,SA),exported=JSON.parse(session.exportVehicle(restored,SA)).cells;
        assert.equal(normalize(exported),normalize(payload.cells));
        for(const cell of payload.cells.filter(cell=>cell[6]?.look))assert.equal(exported.find(item=>item[0]===cell[0]&&item[1]===cell[1]&&item[2]===cell[2])[6]?.look,cell[6].look);
        assert(fs.existsSync(path.join(root,`artifacts/ai-vehicles/chapter-${chapter}`,car.preview)));count++;
      }
    }
  }
  // 同一关序号在两章保留各自选择，重新加载恢复第三章当前位置。
  click('chapter-tabs',{chapter:'2'});assert(node('candidate-details').innerHTML.includes('ch2-06-05'));
  click('chapter-tabs',{chapter:'3'});assert(node('candidate-details').innerHTML.includes('ch3-06-05'));
  vm.runInNewContext(source,browser);await new Promise(resolve=>setImmediate(resolve));assert(node('candidate-details').innerHTML.includes('ch3-06-05'));
  assert.equal(count,60);assert.equal(writeRequests,0);
  console.log(JSON.stringify({candidates:count,realData:true,legacySession:true,chapterSelectionsIndependent:true,cellsRoundTrip:true,rewardPlans:true,targetKeys:true,previewFiles:true,reloadRestored:true,writeRequests}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
