/* 锁甲腿精确6吨回归：通过正规模块、装车统计和完整导入导出验证，不写存档或正式配置。 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { SA } = require('../../../../tools/evolve.js').loadGame();
const session = require('../../../../tools/workbench-session.js');
const input = JSON.parse(fs.readFileSync(path.join(__dirname,'../ch3-05-candidates.json'),'utf8')).candidates[0];
const vehicle = session.parseVehicle(JSON.stringify({cells:input.cells}),input.name,SA);
const mail = SA.uniqueByKey('biped:mail'), finalLoad = mail.load;
assert.equal(finalLoad,6000);
const chassisCells = SA.LEG_VARIANTS.filter(rule=>rule.id==='biped').map(rule=>({id:'biped',mt:rule.mt,unique:rule.key}));
const others = chassisCells.filter(cell=>cell.unique!=='biped:mail');
const contextFor = cell => SA.V.fromCells('承重回归',[[0,8,7,cell.id,cell.mt,0,{unique:cell.unique}]]);
const beforeOthers = others.map(cell=>SA.modForVehicle(cell,contextFor(cell)));
const quadBefore = SA.mod({id:'quad',mt:3});
// 在隔离VM中暂去新数据字段，复现原唯一腿heavy×1.5，确认旧实际6300而非基础4200。
delete mail.load;
const previous = SA.V.stats(vehicle); assert.equal(previous.load,6300);
assert.equal(SA.mod('biped',4).load,4200);
mail.load=finalLoad;
const current=SA.V.stats(vehicle); assert.equal(current.load,6000); assert(current.canDeploy);
assert.equal(SA.mod({id:'biped',mt:4,unique:'biped:mail'}).load,6000);
assert.equal(SA.mod('biped',4).load,4200,'唯一覆盖不得污染材料缓存');
const ordinaryCells=SA.StageCars.cellsOf(vehicle).map(cell=>cell[3]==='biped'?cell.slice(0,6):cell);
assert.equal(SA.V.stats(SA.V.fromCells('同材普通双足',ordinaryCells)).load,4200,'同材普通装车承重保持原值');
for(const field of ['weight','loadKg','speed','topSpeed','value','hp','water','supply']) assert.equal(current[field],previous[field],`${field} 不得改变`);
others.forEach((cell,i)=>assert.deepStrictEqual(SA.modForVehicle(cell,contextFor(cell)),beforeOthers[i]));
assert.deepStrictEqual(SA.mod({id:'quad',mt:3}),quadBefore);
const back=session.parseVehicle(session.exportVehicle(vehicle,SA),input.name,SA);
assert.equal(SA.V.stats(back).load,6000);
assert(SA.StageCars.cellsOf(back).some(cell=>cell[6]?.unique==='biped:mail'&&cell[6]?.look==='mail'));
// 六件现有主体升级到合法最高3级，构造真实超过6000kg的同一连接结构，仍必须被部署拒绝。
let upgraded=0;
SA.V.each(back,cell=>{if(cell.id!=='biped'&&upgraded<6){cell.lv=3;cell.hp=SA.V.maxHp(cell,back);upgraded++;}});
const overloaded=SA.V.stats(back); assert(overloaded.loadKg>6000); assert.equal(overloaded.load,6000); assert.equal(overloaded.canDeploy,false);
assert(overloaded.problems.some(problem=>problem.includes('6.00 t')),'真实超承重规则须拒绝');
console.log(JSON.stringify({beforeActualLoad:previous.load,mailLoad:current.load,ordinaryLoad:4200,otherVariantsUnchanged:true,
  otherChassisUnchanged:true,propertiesUnchanged:true,identityRoundTrip:true,overloadedKg:overloaded.loadKg,overloadedRejected:true,writeRequests:0}));
