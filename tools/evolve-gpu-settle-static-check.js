/* 不启动浏览器/GPU，检查真实 trace 到测试页各批次的打包与原始期望值映射。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, 'evolve-gpu-settle-page.html'), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, '测试页脚本缺失');
const sections = [
  /  function cpuSettle\(row, centeredMatrix = false\) \{[\s\S]*?(?=  function compare\()/,
  /  function pack\(rows\) \{[\s\S]*?(?=  function gpuObjects\()/,
  /  function unpack\(rows, gpu\) \{[\s\S]*?(?=  function constructedBoundary\()/,
  /  function constructedBoundary\(\) \{[\s\S]*?(?=  function sampleRows\()/,
  /  function sampleRows\(records, count\) \{[\s\S]*?(?=  function sceneCounts\()/,
  /  function originalExpected\(row\) \{[\s\S]*?(?=  async function runBenchmark\()/,
].map(pattern => {
  const body = script.match(pattern)?.[0];
  assert.ok(body, `测试页接口缺失：${pattern}`);
  return body;
});
const helpers = new Function('clamp', sections.join('\n') +
  '; return { cpuSettle, pack, unpack, constructedBoundary, sampleRows, originalExpected };')(
  (x, a, b) => Math.max(a, Math.min(b, x)));
const tracePath = process.argv[2];
assert.ok(tracePath && path.isAbsolute(tracePath), '请传入真实 trace 绝对路径');
const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
assert.equal(trace.kind, 'settle-real-input-trace');
for (const count of [1, 28, 4096, trace.records.length, 4096, 4096]) {
  const rows = helpers.sampleRows(trace.records, count), packed = helpers.pack(rows);
  const expected = rows.map(helpers.originalExpected);
  const points = rows.reduce((sum, row) => sum + row.pts.length, 0);
  assert.equal(packed.cases.length, count * 16);
  assert.equal(packed.points.length, points * 4);
  assert.equal(expected.length, count);
  for (let i = 0; i < count; i++) for (let j = 0; j < rows[i].pts.length; j++)
    if (rows[i].pts[j].key) assert.ok(Number.isFinite(expected[i].pointGnd[j]), `第 ${i} 项期望值缺失`);
  const result = helpers.unpack(rows, { values: new Float32Array(count * 4), ground: new Float32Array(points) });
  assert.equal(result.length, count);
  assert.equal(result.reduce((sum, row) => sum + row.pointGnd.length, 0), points);
}
const boundary = helpers.constructedBoundary();
assert.deepEqual(helpers.cpuSettle(boundary).gnd, boundary.expected.gnd);
assert.equal(helpers.pack([boundary]).points.length, boundary.pts.length * 4);
const started = performance.now();
let originalMismatchCount = 0, centeredMatrixMismatchCount = 0;
const firstMismatches = [];
function check(expected, actual, variant, index) {
  const fields = ['kw', 'yo', 'pivX'];
  for (const key of Object.keys(expected.gnd))
    for (let i = 0; i < expected.gnd[key].length; i++) fields.push(`gnd.${key}[${i}]`);
  for (const field of fields) {
    const value = data => field.startsWith('gnd.')
      ? data.gnd[field.slice(4, field.lastIndexOf('['))]?.[Number(field.slice(field.lastIndexOf('[') + 1, -1))]
      : data[field];
    if (value(expected) === value(actual)) continue;
    if (variant === 'original') originalMismatchCount++; else centeredMatrixMismatchCount++;
    if (firstMismatches.length < 8) firstMismatches.push({ index, variant, field,
      expected: value(expected), actual: value(actual) });
  }
}
for (let i = 0; i < trace.records.length; i++) {
  const row = trace.records[i], original = helpers.cpuSettle(row);
  check(row.expected, original, 'original', i);
  check(row.expected, helpers.cpuSettle(row, true), 'centeredMatrix', i);
}
const report = { kind: 'settle-node-number-static-check', trace: tracePath,
  records: trace.records.length, originalMismatchCount, centeredMatrixMismatchCount,
  firstMismatches, elapsedMs: performance.now() - started };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
assert.equal(originalMismatchCount, 0);
assert.equal(centeredMatrixMismatchCount, 0);
