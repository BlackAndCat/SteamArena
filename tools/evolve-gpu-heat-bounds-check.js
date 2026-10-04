/* 检查页面实际使用的 double→f32 包围函数，不启动 GPU。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function run() {
  const source = fs.readFileSync(path.join(__dirname, 'evolve-gpu-heat-page.html'), 'utf8');
  const body = source.match(/  function bounds\(value, out, offset\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(body, '未找到页面实际使用的 bounds 函数');
  const bounds = vm.runInNewContext(`(() => {
    const f32 = new Float32Array(1), bits = new Uint32Array(f32.buffer);
    ${body}
    return bounds;
  })()`);
  const inputs = [0, 1, 0.2, 0.1, 1 / 3, Math.fround(0.2) - 1e-10,
    Math.fround(0.2) + 1e-10, 1e-20, 1e-6, 1e6];
  for (const value of inputs) {
    const out = new Float32Array(2);
    bounds(value, out, 0);
    assert.ok(out[0] <= value && value <= out[1],
      `输入 ${value} 未被 [${out[0]}, ${out[1]}] 包围`);
  }
  const exactZero = new Float32Array(2);
  bounds(0, exactZero, 0);
  assert.deepEqual(Array.from(exactZero), [0, 0]);
  return { values: inputs.length };
}
if (require.main === module) console.log(`bounds 包围验证通过：${run().values} 个值`);
module.exports = { run };
