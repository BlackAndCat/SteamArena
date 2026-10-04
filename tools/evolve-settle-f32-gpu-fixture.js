/* 从真实 settle trace 制作至多 32 条的硬件 direct 核严格对照输入；不启动 GPU。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { settleF32 } = require('./evolve-settle-f32-reference');

const inputFile = process.argv[2], outputFile = process.argv[3];
assert.ok(inputFile && outputFile && path.isAbsolute(inputFile) && path.isAbsolute(outputFile),
  '请传入真实 trace 与输出 JSON 的绝对路径');
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
assert.equal(input.kind, 'settle-real-input-trace');
const count = 32;
const records = Array.from({ length: count }, (_, i) => {
  const row = input.records[Math.floor((i + 0.5) * input.records.length / count)];
  return { ...row, expected: settleF32(row) };
});
const scenes = {};
for (const row of records) scenes[row.source.scene] = (scenes[row.source.scene] || 0) + 1;
const fixture = { kind: 'settle-real-input-trace', ruleFingerprint: input.ruleFingerprint,
  sourceHashes: input.sourceHashes, note: '真实输入；expected 为 Node Math.fround 逐步舍入参考，不是原双精度结果',
  bench: { rounds: 1, verifyF32Only: true }, records };
fs.writeFileSync(outputFile, JSON.stringify(fixture));
console.log(JSON.stringify({ outputFile, count, scenes }));
