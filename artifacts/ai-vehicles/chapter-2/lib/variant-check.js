/* 完整模块清单回归：检查工作台往返、局部编辑和手动保存预备记录，不调用真实保存接口。 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { loadGame } = require('../../../../tools/evolve.js');
const session = require('../../../../tools/workbench-session.js');
const { SA } = loadGame();
const clone = value => JSON.parse(JSON.stringify(value));
const legacyCells = vehicle => {
  const cells = [];
  SA.V.each(vehicle, (cell,row,col,layer) => cells.push([layer === 'side' ? 1 : 0,row,col,cell.id,cell.mt || 1,cell.lv || 0]));
  return cells;
};
const ordinary = SA.V.fromCells('普通车', [[0,10,2,'quad',2,0],[0,8,2,'cockpit',2,0],[0,8,4,'boiler',2,0]]);
assert.deepStrictEqual(clone(SA.StageCars.cellsOf(ordinary)), clone(legacyCells(ordinary)));
const checked = [];
for (const [stage,unique] of [[4,'quad:pedrail'],[6,'boss_lens']]) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname,`../ch2-0${stage}-candidates.json`),'utf8'));
  const candidate = data.candidates[0], vehicle = session.parseVehicle(JSON.stringify({cells:candidate.cells}),candidate.name,SA);
  // 工作台纯会话替换后进行真实等级编辑，再通过规范出口返回宿主；不替换唯一身份。
  const workbench = session.create(); workbench.select({kind:'stage',id:data.stageId.replace(':',',')},vehicle);
  let uniqueCell;
  SA.V.each(vehicle,cell => { if (cell.unique === unique) uniqueCell = cell; });
  assert(uniqueCell, `${unique} 导入丢失`);
  const originalLook = uniqueCell.look; uniqueCell.lv = 1;
  const exported = SA.StageCars.cellsOf(workbench.vehicle());
  assert.deepStrictEqual(clone(exported), JSON.parse(session.exportVehicle(vehicle,SA)).cells);
  const back = session.parseVehicle(JSON.stringify({cells:exported}),candidate.name,SA);
  const record = SA.StageCars.makeRecord(2,stage-1,{name:candidate.name,terrain:'flat'},back,{vehicleName:candidate.name});
  const saved = record.cells.find(cell => cell[6]?.unique === unique);
  assert(saved, `${unique} 保存预备记录丢失`); assert.equal(saved[5],1); assert.equal(saved[6].look,originalLook);
  // JSON请求体序列化也必须保留合法第七项；只构造请求体，不发POST。
  const payload = JSON.parse(JSON.stringify({workbenchVersion:1,target:{kind:'stage',id:record.id},record}));
  assert.deepStrictEqual(payload.record.cells, clone(record.cells));
  checked.push(unique);
}
console.log(JSON.stringify({ordinaryOutputUnchanged:true,uniqueKeys:checked,editedRoundTrip:true,savePayload:true,writeRequests:0}));
