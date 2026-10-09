/* 湿冷回归：运行真实共享热循环，核对流量上限、高温效率、库存边界及预测一致性。 */
'use strict';
const assert = require('assert');
const { loadGame } = require('./evolve');
const { SA } = loadGame();
const P = SA.Phys;
const near = (a, b, eps = 1e-8) => assert(Math.abs(a - b) <= eps, `${a} 与 ${b} 不符`);
const original = { flow: SA.K.WATER_FLOW, dissipate: SA.K.DISSIPATE };
const base = { shaftKw: 0, heatKw: 0, weaponKw: 0, cool: 100, dryCool: 0, waterSave: 1, capacity: 50 };
// 暂停环境干冷来单独测量湿冷；只修改本检查进程的配置，结束后恢复。
SA.K.DISSIPATE = 0;
const at = (temp, flow = 3, water = 100, p = base, dt = 0.1) => {
  SA.K.WATER_FLOW = flow;
  return P.thermalStep((temp - 20) * p.capacity, water, dt, p);
};
const low = at(75, 1), fast = at(75, 3), capped = at(75, 9);
assert(fast.heat < low.heat && fast.water < low.water, '加大流量须更快降温、更多耗水');
near(fast.cooled, low.cooled * 3); near(capped.heat, fast.heat); near(capped.water, fast.water);
near(at(65, 0).cooled, 0);
const ratios = [90, 105, 120, 150].map(temp => {
  const next = at(temp);
  assert(next.water < 100 && next.cooled > 0, '高温仍须实际耗水并带走热量');
  near(SA.coolRate(base.cool, (temp - 20) * base.capacity, base.capacity) * 0.1, next.cooled);
  return next.cooled / (100 - next.water);
});
near(ratios[0], 300); near(ratios[1], 120); near(ratios[2], 75);
assert(ratios[3] < ratios[2] && ratios[3] > 0, '越过过热线仍保留非零冷却效率');
near(at(65, 3, 0).cooled, 0);
near(at(65, 3, 100, { ...base, cool: 0 }).water, 100);
near(at(20).water, 100);
const scarce = at(65, 3, 0.001);
near(scarce.water, 0); near(scarce.cooled, 0.3);
const almostCold = at(20.001, 3, 100, base, 100);
near(almostCold.heat, 0.05); near(almostCold.water, 100);
// 温控阀在 60 °C 开始、90 °C 全开，两个边界连续；低温不喷水，仍保留干冷。
for (const temp of [20, 59.999, 60]) near(at(temp).water, 100);
near(P.waterCoolingPower(100, 50 * (60.001 - 20), 50), 0.01, 1e-7);
near(P.waterCoolingPower(100, 50 * (89.999 - 20), 50), 299.99, 1e-7);
near(P.waterCoolingPower(100, 50 * (90 - 20), 50), 300);
near(at(55, 3, 100, { ...base, waterSoftLimit: 80 }).cooled, 5);
near(at(65, 3, 100, { ...base, waterSoftLimit: 90, coolFull: 20 }).cooled, 0);
const condenser = at(75, 3, 100, { ...base, waterSave: 0.4 });
near(condenser.cooled, fast.cooled); near(100 - condenser.water, (100 - fast.water) * 0.4);
// 高温停火时仅用干式散热也能恢复；水不供能，干车仍输出同样的轴功率。
const dry = at(150, 3, 0, { ...base, cool: 0, dryCool: 200 });
assert(dry.heat < 130 * base.capacity && dry.passive > 0);
near(at(65, 3, 0, { ...base, shaftKw: 60, heatKw: 75 }).shaftKw, 60);
SA.K.DISSIPATE = original.dissipate;
SA.K.WATER_FLOW = original.flow;

// 恒定火力／行驶负载投影，非真人战斗：读取样车真实数值，不复制产热或冷却公式。
const starter = SA.V.fromAscii('热水检查车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs);
assert(SA.V.place(starter, 'tank_s', 9, 9, 1).ok);
let input;
SA.V.stats(starter, { captureThermalInput: value => { input = value; } });
assert(input, '样车热预测输入未捕获');
const project = (p, duration, dt) => {
  let heat = 0, water = p.water;
  for (let t = 0; t < duration - 1e-8; t += dt) {
    const next = P.thermalStep(heat, water, Math.min(dt, duration - t), p);
    heat = next.heat; water = next.water;
    assert(Number.isFinite(heat) && Number.isFinite(water) && heat >= 0 && water >= 0);
  }
  return { temp: P.temp(heat, p.capacity), used: p.water - water };
};
const nominal = project({ ...input, waterFlow: 1 }, 50, 1 / 60);
SA.K.WATER_FLOW = 3;
const improved = project(input, 50, 1 / 60);
const coarse = project(input, 50, 1 / 30);
assert(improved.temp < nominal.temp && improved.used > nominal.used);
near(coarse.temp, improved.temp, 0.15); near(coarse.used, improved.used, 0.05);
const radiator = project({ ...input, dryCool: input.dryCool + SA.mod({ id: 'radiator', mt: 1 }).dryCool }, 50, 1 / 60);
assert(radiator.temp < improved.temp && radiator.used < improved.used, '干式散热须降低温度及阀门耗水');
// 同一低负载巡航投影只替换温控阀，验证停止低温喷水的动机；这是恒定负载诊断，并非真人战斗。
const cruiseInput = { ...input, heatKw: 25, weaponKw: 0 };
const cruise = project(cruiseInput, 300, 1 / 60);
const valve = P.waterCoolingPower;
let oldCruise;
try {
  P.waterCoolingPower = (cool, heat, cap, flow = SA.K.WATER_FLOW) => cool * Math.max(0, Math.min(3, flow))
    * Math.max(0, Math.min(1, (P.temp(heat, cap) - 20) / SA.K.COOL_FULL));
  oldCruise = project(cruiseInput, 300, 1 / 60);
} finally { P.waterCoolingPower = valve; }
near(cruise.used, 0);
assert(oldCruise.used > 0 && cruise.temp < 60);
// CPU 纸面过热预测与逐步调用相同输入、相同 0.5 s 帧长的真实热循环必须完全一致。
let heat = 0, water = input.water, predicted = Infinity;
for (let t = 0; t < 300; t += 0.5) {
  const next = P.thermalStep(heat, water, 0.5, input);
  heat = next.heat; water = next.water;
  if (heat >= 100 * input.capacity) { predicted = t + 0.5; break; }
}
const stats = SA.V.stats(starter);
assert.strictEqual(stats.overheat, predicted, '纸面过热预测与共享热循环不一致');
// 已捕获输入不随热调漂移；缓存键则须区分最新参数，不能命中旧组的结果。
const snapshot = P.thermalStep(2000, 100, 0.5, input);
SA.K.WATER_FLOW = 1;
near(P.thermalStep(2000, 100, 0.5, input).heat, snapshot.heat);
let slowInput;
const slowStats = SA.V.stats(starter, { captureThermalInput: value => { slowInput = value; } });
assert.strictEqual(SA.V.thermalPrediction(slowInput).steps, Number.isFinite(slowStats.overheat) ? slowStats.overheat * 2 : 0);
assert.strictEqual(SA.V.thermalPrediction(input).steps, Number.isFinite(stats.overheat) ? stats.overheat * 2 : 0);
SA.K.WATER_FLOW = 3;
assert.strictEqual(SA.V.stats(starter).overheat, stats.overheat);
// 实战帧必须原样使用共享函数的热量和储水结果；包装仅用于观测，不替换算法。
SA.go = () => {};
SA.S.reset(); SA.S.d.vehicle = starter;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: starter, enemyName: '检查目标', terrain: 'flat', hpMul: 1 });
const step = P.thermalStep, observed = [];
P.thermalStep = (...args) => { const next = step(...args); observed.push(next); return next; };
SA.Battle.debug.step(1 / 60);
P.thermalStep = step;
assert(observed.length >= 2, '实战未调用共享热循环');
near(SA.Battle.debug.B.p.heat, observed[0].heat); near(SA.Battle.debug.B.p.water, observed[0].water);
// 冷凝遥测按真实耗水还原无节水基线；高温时不能再用蒸发潜热反推。
const condensed = SA.V.clone(starter);
assert(SA.V.place(condensed, 'condenser', 6, 8, 1).ok, '检查车无法安装冷凝器');
SA.S.d.vehicle = condensed;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: starter, enemyName: '检查目标', terrain: 'flat', hpMul: 1 });
const side = SA.Battle.debug.B.p;
side.heat = side.heatCapacity * 85;
const before = side.water;
SA.Battle.debug.step(1 / 60);
assert(side.waterSave < 1 && side.water < before);
near(side.effects.condenser.waterSaved, (before - side.water) * (1 / side.waterSave - 1));
SA.K.WATER_FLOW = original.flow;
console.log(`湿冷检查通过；恒定负载 50 s 投影：流量 1 为 ${nominal.temp.toFixed(2)} °C / ${nominal.used.toFixed(2)} L，流量 3 为 ${improved.temp.toFixed(2)} °C / ${improved.used.toFixed(2)} L。`);
console.log(`低负载巡航 300 s 投影：旧阀 ${oldCruise.temp.toFixed(2)} °C / ${oldCruise.used.toFixed(2)} L，新温控阀 ${cruise.temp.toFixed(2)} °C / ${cruise.used.toFixed(2)} L。`);
