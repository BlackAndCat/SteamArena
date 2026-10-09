/*
 * WebGPU 热量核与游戏原始 overheatTime 的严格差分测试。
 * 用法：node tools/evolve-gpu-heat-diff.js [--diagnose]；整次测试最多运行 45 秒。
 * 只比较 GPU 已认证的步数；-1 表示按契约回退 CPU，不算通过认证。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const evolve = require('./evolve');
const { createGpuHeatRuntime } = require('./evolve-gpu-heat');

const deadline = setTimeout(() => {
  console.error('GPU 差分测试超过 45 秒硬上限');
  process.exit(124);
}, 45000);

function fixture() {
  const { SA, context } = evolve.loadGame();
  const source = fs.readFileSync(path.join(__dirname, '../js/vehicle.js'), 'utf8');
  const patched = source.replace('  function stats(v, options = null) {',
    '  SA.heatReference = overheatTime;\n  function stats(v, options = null) {');
  if (patched === source) throw new Error('无法导出原始热循环，车辆源码接口已变化');
  vm.runInContext(patched, context, { filename: 'js/vehicle.js' });

  const rows = [], labels = [], groups = [];
  function add(group, label, input) { rows.push(input); labels.push(label); groups.push(group); }
  // 对正式关卡车只读取结构统计；不写回手工关卡数据。
  for (let ch = 0; ch < SA.CAMPAIGN.length; ch++) {
    for (let st = 0; st < SA.CAMPAIGN[ch].stages.length; st++) {
      const stage = evolve.stageFor(SA, ch, st);
      if (!stage?.vehicle || stage.unfinished) continue;
      SA.V.stats(stage.vehicle, { captureThermalInput: input => add('真实关卡车', `关卡 ${ch + 1}-${st + 1}`, input) });
    }
  }

  const base = { water: 0, shaftKw: 1, heatKw: 100, weaponKw: 0, cool: 0,
    dryCool: 0, waterSave: 1, capacity: 50, idleHeat: SA.K.IDLE_HEAT,
    dissipate: SA.K.DISSIPATE, coolFull: SA.K.COOL_FULL,
    waterFlow: SA.K.WATER_FLOW, waterHeatPerL: SA.K.WATER_HEAT_PER_L, waterSoftLimit: SA.K.WATER_SOFT_LIMIT };
  add('手工边界', '首步过热', { ...base, heatKw: 20000 });
  add('手工边界', '不发生过热', { ...base, heatKw: 0, shaftKw: 0 });
  add('手工边界', '耗尽储水', { ...base, water: 1, cool: 200, heatKw: 180 });
  add('手工边界', '持续冷却', { ...base, water: 1000, cool: 200, heatKw: 180 });
  for (const waterFlow of [0, 1, 3]) add('热参数快照', `流量 ${waterFlow}`, { ...base, water: 1000, cool: 200, heatKw: 180, waterFlow });
  add('热参数快照', '不同热水移热', { ...base, water: 2, cool: 200, heatKw: 180, waterHeatPerL: 400 });
  add('热参数快照', '不同软上限', { ...base, water: 100, cool: 200, heatKw: 180, waterSoftLimit: 80 });
  add('热参数快照', '不同阀门开启温差', { ...base, water: 100, cool: 200, heatKw: 180, coolFull: 20 });
  add('热参数快照', '低负载阀门关闭', { ...base, water: 100, cool: 200, heatKw: 25 });
  // 首帧干冷后的温度落在阀门及高温效率边界两侧，核对连续开启与保守回退。
  for (const temp of [60, 90, 120]) for (const offset of [-0.001, 0, 0.001]) {
    const beforePassive = base.capacity * (temp + offset - 20) / (1 - base.dissipate * 0.5 / base.capacity / 30);
    add('热参数快照', `首帧温度 ${temp + offset}`, { ...base, water: 0.1, cool: 200, heatKw: beforePassive * 2 - base.idleHeat });
  }
  add('手工边界', '边界外的极小值应回退', { ...base, water: 1e-30 });

  // 原规则二分找出各首次过热步数的临界热功率，检查阈值两侧及第 600 步。
  function expected(input) {
    const t = SA.heatReference(input.weaponKw, input.cool, input.water, input.dryCool,
      input.waterSave, input.capacity, input.shaftKw, input.heatKw, input);
    return Number.isFinite(t) ? Math.round(t * 2) : 0;
  }
  for (const step of [1, 2, 30, 300, 599, 600]) {
    let lo = 0, hi = 20000;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2, got = expected({ ...base, heatKw: mid });
      if (got && got <= step) hi = mid; else lo = mid;
    }
    for (const scale of [1 - 1e-9, 1, 1 + 1e-9])
      add('首次过热临界', `首次过热 ${step} 步临界 ${scale}`, { ...base, heatKw: hi * scale });
  }
  // 宽合法区间包括有水、无水、零散热和不同热容量。
  for (const capacity of [1, 5, 50, 500]) for (const water of [0, 0.01, 10, 1000])
    for (const cool of [0, 10, 500])
      add('网格宽范围', `范围 ${capacity}/${water}/${cool}`, { ...base, capacity, water, cool,
        heatKw: 20 + capacity * 3, weaponKw: cool / 3, dryCool: capacity / 4 });
  // 固定种子生成 2048 个物理上合法的输入；四组分别侧重纯积热、冷却、水耗尽和综合情况。
  let state = 20261004;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  for (let i = 0; i < 2048; i++) {
    const group = ['随机纯积热', '随机持续冷却', '随机水量限制', '随机综合'][Math.floor(i / 512)];
    const capacity = 1 + random() * 300, heatKw = random() * 400;
    const input = { ...base, capacity, heatKw, weaponKw: random() * 250,
      dryCool: random() * 100, waterSave: 0.2 + random() * 5 };
    if (group === '随机纯积热') { input.water = 0; input.cool = 0; }
    else if (group === '随机持续冷却') { input.water = 100 + random() * 1000; input.cool = random() * 300; }
    else if (group === '随机水量限制') { input.water = random() * 2; input.cool = random() * 500; }
    else { input.water = random() * 150; input.cool = random() * 500; }
    add(group, `固定种子 ${i}`, input);
  }
  return { rows, labels, groups, expected };
}

async function main() {
  let { rows, labels, groups, expected } = fixture();
  if (process.argv.includes('--diagnose')) {
    const selected = rows.map((_, i) => i).filter(i => groups[i] === '真实关卡车' ||
      groups[i] === '手工边界' || groups[i] === '热参数快照' || groups[i] === '首次过热临界' && labels[i].includes(' 1 步') ||
      labels[i] === '固定种子 0' || labels[i] === '固定种子 100' ||
      labels[i] === '固定种子 512' || labels[i] === '固定种子 1024' ||
      labels[i] === '固定种子 1536');
    rows = selected.map(i => rows[i]); labels = selected.map(i => labels[i]); groups = selected.map(i => groups[i]);
  }
  const runtime = await createGpuHeatRuntime();
  try {
    if (!runtime.available) throw new Error(`硬件 GPU 不可用：${runtime.reason}`);
    const result = await runtime.predict(rows);
    if (!Array.isArray(result.steps) || result.steps.length !== rows.length)
      throw new Error('GPU 返回的步数数组长度不正确');
    let certified = 0, uncertain = 0;
    const mismatches = [];
    const byGroup = {};
    for (let i = 0; i < rows.length; i++) {
      const cpu = expected(rows[i]);
      const step = result.steps[i], group = byGroup[groups[i]] ||= {
        total: 0, cpuOverheat: 0, certified: 0, certifiedOverheat: 0, certifiedNoOverheat: 0, uncertain: 0, reasons: {} };
      group.total++;
      if (cpu) group.cpuOverheat++;
      if (step === -1) {
        uncertain++; group.uncertain++;
        const code = result.telemetry.reasonCodes?.[i] ?? -1;
        group.reasons[code] = (group.reasons[code] || 0) + 1;
        continue;
      }
      certified++; group.certified++;
      if (step) group.certifiedOverheat++; else group.certifiedNoOverheat++;
      if (step !== cpu) mismatches.push({ label: labels[i], gpu: step, cpu, input: rows[i] });
    }
    const { reasonCodes, ...telemetry } = result.telemetry;
    console.log(JSON.stringify({ total: rows.length, certified, uncertain,
      certificationRate: certified / rows.length, byGroup, telemetry, mismatches }, null, 2));
    if (mismatches.length) throw new Error(`${mismatches.length} 项 GPU 认证步数与原规则不符`);
  } finally {
    await runtime.close();
    clearTimeout(deadline);
  }
}

main().catch(error => { clearTimeout(deadline); console.error(error.stack || error); process.exitCode = 1; });
