/* 后续章节完整车辆往返检查：验证身份/外观/策略传递，只构造保存载荷，不请求保存。 */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {SA}=require('../../../tools/evolve.js').loadGame();
const session=require('../../../tools/workbench-session.js');
// 专项改造独立于lv；旧车缺省refit=0，新车不能在导出或保存载荷中丢级。
const normalize=cells=>JSON.stringify(Array.from(cells,cell=>JSON.stringify([...cell.slice(0,6),cell[6]?.unique||null,cell[6]?.refit||0])).sort());
function main(directory,chapter){
  let count=0,uniqueVehicles=0;
  const pattern=new RegExp('^ch'+chapter+'-0[1-6]-candidates\\.json$');
  for(const file of fs.readdirSync(directory).filter(file=>pattern.test(file)).sort()){
    const data=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
    assert.equal(Number(data.stageId.split(':')[0]),chapter);
    for(const candidate of data.candidates){
      const vehicle=session.parseVehicle(JSON.stringify({cells:candidate.cells}),candidate.name,SA);
      const exported=SA.StageCars.cellsOf(vehicle);assert.equal(normalize(exported),normalize(candidate.cells));
      // 唯一件可补标准外观，但显式指定的外观不能在导出中丢失。
      for(const cell of candidate.cells.filter(cell=>cell[6]?.look))assert.equal(exported.find(item=>item[0]===cell[0]&&item[1]===cell[1]&&item[2]===cell[2])[6]?.look,cell[6].look);
      const back=session.parseVehicle(session.exportVehicle(vehicle,SA),candidate.name,SA);
      const record=SA.StageCars.makeRecord(chapter,Number(data.stageId.split(':')[1]),{name:candidate.name,style:candidate.style},back);
      assert.equal(normalize(record.cells),normalize(candidate.cells));
      if(candidate.cells.some(cell=>cell[6]?.unique))uniqueVehicles++;
      count++;
    }
  }
  assert(count>0,'没有可检查的真实候选文件');
  console.log(JSON.stringify({chapter,candidates:count,uniqueVehicles,fullRoundTrip:true,savePayload:true,writeRequests:0}));
}
module.exports={main};
