/* 冻结候选的验证与实测元数据回填：只写说明/成绩，绝不生成或改变cells、策略和设计字段。 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { fingerprint } = require('./design-check.js');
const [input, validationPath, formalPath, ...crossPaths] = process.argv.slice(2);
const read = filename => JSON.parse(fs.readFileSync(filename,'utf8'));
const data = read(input), validation = read(validationPath), formal = formalPath && formalPath !== '-' ? read(formalPath) : null;
const crosses = crossPaths.map(filename=>({filename,report:read(filename)}));
const before = data.candidates.map(car=>({id:car.id,cells:fingerprint(car.cells),style:car.style}));
function summary(tests,filename) {
  const {rows,...result} = tests;
  return {...result,resultFile:`results/${path.basename(filename)}`,
    seeds:[...new Set(rows.map(row=>row.seed))],pairedSides:true,
    outcomeNote:'固定种子同局双方换位；胜率按（胜＋0.5×平）÷总局数，直接simulate，不走进化。'};
}
for (const car of data.candidates) {
  const row = validation.candidates.find(item=>item.id===car.id);
  assert(row,`${car.id} 缺校验记录`); assert.equal(row.fingerprint,fingerprint(car.cells));
  car.budget = row.budget; car.budgetUsage = row.budget/validation.spec.budget;
  car.validation=row.validation; car.inputValidation=row.inputValidation; car.additionalValidation=row.additionalValidation;
  car.fingerprint=row.fingerprint;
  car.validationDetails={...(car.validationDetails||{}),issues:row.issues,warnings:row.stats.warnings||[],problems:row.stats.problems||[]};
  car.validationStatus=Object.values({...row.validation,...row.inputValidation,...row.additionalValidation}).every(Boolean)?'passed':'failed';
  car.preview=`previews/${car.id}.png`;
  if (formal) {
    const tested=formal.candidates.find(item=>item.id===car.id); assert(tested,`${car.id} 缺正式记录`);
    assert.equal(tested.fingerprint,car.fingerprint); assert.equal(tested.battleTests.games,120);
    car.battleTests=summary(tested.battleTests,formalPath);
    const target=car.battleTests.target,rate=car.battleTests.winRate;
    car.battleTests.status=rate>target[1]?'above-target':rate>=target[0]?'target-reached':rate<.45?'below-45':'below-target';
    if(!car.battleTests.reachedTarget) car.battleTests.notReachedReason=rate>target[1]?'正式胜率超过目标上限，保留真实结果。':'正式胜率低于目标；保留合法候选供用户甄选，不改策略或种子修饰成绩。';
    car.rewardEvidence=car.battleTests.rewardEffects;
    car.crossTests=crosses.map(({filename,report})=>{
      const cross=report.candidates.find(item=>item.id===car.id);assert(cross);assert.equal(cross.fingerprint,car.fingerprint);
      return summary(cross.battleTests,filename);
    });
  }
}
// 旧校验文件只缺后来补充的设计来源说明，不因此覆盖已明确的提案边界。
const designRequirementsSource=data.spec?.planningPatch?.designRequirementsSource;
data.spec=validation.spec;
if(designRequirementsSource)data.spec.planningPatch={...data.spec.planningPatch,designRequirementsSource};
data.ruleFingerprint=validation.rules;
if(formal) { data.status='completed'; data.reference={...(data.reference||{}),id:formal.referenceSnapshot?.id,
  name:formal.referenceSnapshot?.name,fingerprint:formal.referenceSnapshot?.fingerprint,sourceFile:formal.referenceSnapshot?.sourceFile}; }
assert.deepStrictEqual(data.candidates.map(car=>({id:car.id,cells:fingerprint(car.cells),style:car.style})),before);
fs.writeFileSync(input,JSON.stringify(data,null,2));
console.log(JSON.stringify({stageId:data.stageId,candidates:data.candidates.length,cellsAndStylesUnchanged:true,formal:!!formal}));
