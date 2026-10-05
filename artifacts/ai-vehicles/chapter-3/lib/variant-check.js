/* 第三章完整种子回归：所有实际候选都经工作台导入、规范导出及makeRecord，绝不请求保存。 */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {SA}=require('../../../../tools/evolve.js').loadGame();
const session=require('../../../../tools/workbench-session.js');
const directory=path.resolve(__dirname,'..');let count=0,unique=0,cores=0;
const normalize=cells=>JSON.stringify(Array.from(cells,cell=>JSON.stringify([...cell.slice(0,6),cell[6]?.unique||null])).sort());
for(const file of fs.readdirSync(directory).filter(file=>/^ch3-0[1-6]-candidates\.json$/.test(file))) {
  const data=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  for(const candidate of data.candidates) {
    const vehicle=session.parseVehicle(JSON.stringify({cells:candidate.cells}),candidate.name,SA);
    const exported=SA.StageCars.cellsOf(vehicle);assert.deepStrictEqual(normalize(exported),normalize(candidate.cells));
    for(const cell of candidate.cells.filter(cell=>cell[6]?.look)) assert.equal(exported.find(item=>item[0]===cell[0]&&item[1]===cell[1]&&item[2]===cell[2])[6]?.look,cell[6].look);
    const back=session.parseVehicle(session.exportVehicle(vehicle,SA),candidate.name,SA);
    const record=SA.StageCars.makeRecord(3,Number(data.stageId.split(':')[1]),{name:candidate.name},back);
    assert.deepStrictEqual(normalize(JSON.parse(JSON.stringify(record)).cells),normalize(candidate.cells));
    if(candidate.cells.some(cell=>cell[6]?.unique==='biped:mail')) {unique++;assert.equal(SA.V.stats(back).load,6000);}
    for(const cell of record.cells.filter(cell=>cell[3]==='boss_core')) {cores++;assert.equal(cell[4],3);assert(!cell[6]?.unique);}
    count++;
  }
}
console.log(JSON.stringify({candidates:count,mailVehicles:unique,ordinarySteelCores:cores,fullRoundTrip:true,savePayload:true,writeRequests:0}));

