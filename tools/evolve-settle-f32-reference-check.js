/* settle f32 测试核的零 GPU 接口、源码锚点和逐步舍入检查。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evolve = require('./evolve');
const { settleF32, installSettleF32 } = require('./evolve-settle-f32-reference');

const boundary = { dt: 1, xc: 1, kw0: 0, yo0: 0, follow: 1,
  pts: [{ x: 0, y: 10, up: 1, down: 1, key: 'a', i: 0 },
    { x: 2, y: 10, up: 1, down: 1, key: 'a', i: 1 }],
  rigid: [{ x: 1, y: 0 }],
  constants: { tiltMax: 0.45, tiltResponse: 8, heightResponse: 10, rigidClearance: 6, ground: 0 } };
assert.deepEqual(settleF32(boundary), { kw: 0, yo: 6, pivX: 1, gnd: { a: [1, 1] } });
const rawRigidX = 1.00000001;
assert.notEqual(rawRigidX, Math.fround(rawRigidX));
const sampled = [];
const withRawRigid = settleF32({ ...boundary, rigid: [{ x: rawRigidX }],
  sampleRigid: x => { sampled.push(x); return 0; } });
const withQuantizedRigid = settleF32({ ...boundary, rigid: [{ x: Math.fround(rawRigidX), y: 0 }] });
assert.deepEqual(sampled, [rawRigidX], 'groundAt 必须收到原始双精度 x');
assert.deepEqual(withRawRigid, withQuantizedRigid, '刚性点后续数值必须采用 f32 x');

const traceFile = process.argv[2];
if (traceFile) {
  const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  const rows = [trace.records[0], trace.records[6255], trace.records[9190], trace.records.at(-1)];
  for (const row of rows) {
    const result = settleF32(row);
    for (const value of [result.kw, result.yo, result.pivX, ...Object.values(result.gnd).flat()])
      assert.ok(Number.isFinite(value) && Math.fround(value) === value, 'f32 输出含非有限或未舍入值');
  }
}
const battleFile = path.join(__dirname, '../js/battle.js');
const before = fs.readFileSync(battleFile);
const { SA, context } = evolve.loadGame();
const installed = installSettleF32(context);
assert.equal(typeof SA.Battle.simulate, 'function');
assert.deepEqual(fs.readFileSync(battleFile), before, '安装测试核不得改写生产文件');
assert.equal(typeof installed.sourceSha256, 'string');
console.log(JSON.stringify({ valid: true, sourceSha256: installed.sourceSha256,
  alteredSha256: installed.alteredSha256, checkedTraceRows: traceFile ? 4 : 0 }));
