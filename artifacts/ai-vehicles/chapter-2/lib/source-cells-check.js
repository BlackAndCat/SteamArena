/* 原始模块保真回归：扫描已完成候选，重复锚点反例必须在真实模拟之前被 CLI 拒绝。 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), { spawnSync } = require('child_process');
const { loadGame } = require('../../../../tools/evolve');
const tool = require('./design-check');
// 可指定另一章输出目录和薄CLI入口；默认仍仅检查原第二章目录。
const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..'), { SA } = loadGame();
const checker = process.argv[3] ? path.resolve(process.argv[3]) : path.join(__dirname,'design-check.js');
const files = fs.readdirSync(directory).filter(file => /^ch\d+-0[1-6]-candidates\.json$/.test(file)).sort(), rows = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  for (const car of data.candidates) {
    const v = tool.vehicle(SA, car, data.spec?.grid || {cols:8,rows:6});
    const validation = tool.sourceCellsConditions(SA, car, v);
    rows.push({id:car.id,fingerprint:tool.fingerprint(car.cells),validation});
  }
}
const originalFile = files.includes('ch2-04-candidates.json') ? 'ch2-04-candidates.json' : files[0];
assert(originalFile,'没有可检查的候选文件');
const original = JSON.parse(fs.readFileSync(path.join(directory,originalFile),'utf8'));
const bad = { ...original, candidates: [JSON.parse(JSON.stringify(original.candidates[0]))] };
bad.candidates[0].cells.push([...bad.candidates[0].cells[0]]);
const temp = `Z:/AI/CodexTemp/ai-design-source-cells-invalid-${original.stageId.split(':')[0]}.json`;
try {
  fs.writeFileSync(temp, JSON.stringify(bad));
  const result = spawnSync(process.execPath, [checker,'battle',temp,
    path.join(directory,originalFile),original.candidates[0].id,'1','Z:/AI/CodexTemp/ai-design-invalid-result.json'], {encoding:'utf8'});
  assert.notEqual(result.status,0); assert.match(result.stderr,/未通过规则/);
  const report = { candidates:rows, duplicateAnchorRejected:true, invalid:rows.filter(row=>!Object.values(row.validation).every(Boolean)) };
  fs.writeFileSync(path.join(directory,'results/source-cells-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checked:rows.length,invalid:report.invalid,duplicateAnchorRejected:true}));
  assert.equal(report.invalid.length,0);
} finally { fs.unlinkSync(temp); }
