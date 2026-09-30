/* 工程单位回归：直接加载真实规则与真实战斗帧，不复制实现公式。 */
'use strict';

const assert = require('assert');
const { loadGame, stageFor } = require('./evolve');
const { SA } = loadGame();
const P = SA.Phys;
const near = (a, b, eps = 1e-6) => assert(Math.abs(a - b) <= eps, `${a} 与 ${b} 不符`);

// 标准锅炉 500 kW 蒸汽热功率 × 12% = 60 kW 轴功率。
near(SA.MODULES.boiler.supply, 60);
near(P.kwToPs(60), 81.57729703823426);
near(P.boilerEnergy(60, 75).steamKw, 500);
near(P.boilerEnergy(60, 75).exhaustKw, 365);
near(P.boilerEnergy(60, 75).combustionLossKw, 125);
near(P.steamWater(60), 500 / 2680);

const starter = SA.V.fromAscii('单位检查', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs);
const stats = SA.V.stats(starter);
near(stats.weight, stats.dryWeight + stats.water);
assert(stats.weight > stats.dryWeight && stats.heatCapacity > 0);
near(P.temp(stats.heatCapacity * 45, stats.heatCapacity), 65);
near(stats.heatCapacity * 45 / stats.heatMax, 0.45);

// 低水量时产汽受焓限制；冷凝只回收闭式流，喷射口的开式流不能回收。
const base = { shaftKw: 60, heatKw: 75, weaponKw: 0, cool: 0, dryCool: 0, waterSave: 1, capacity: 50 };
const dry = P.thermalStep(100, 0, 1 / 60, base);
near(dry.shaftKw, 0); near(dry.water, 0);
const last = P.thermalStep(100, 0.001, 1 / 60, { ...base, cool: 200 });
assert(last.water >= 0 && last.steamUsed <= 0.001 + 1e-9);
const cooled = P.thermalStep(100, 0.001, 1 / 60, { ...base, shaftKw: 0, cool: 200 });
assert(cooled.cooled <= 0.001 * P.LATENT_KJ_L + 1e-9);
near(cooled.water, 0.001 - cooled.cooled / P.LATENT_KJ_L);
const condensed = P.thermalStep(0, 1, 1, { ...base, steamRecovery: 0.7 });
const open = P.thermalStep(0, 1, 1, { ...base, steamRecovery: 0.7, openKw: 20 });
near(condensed.steamUsed, P.steamWater(60) * 0.7);
near(open.steamUsed, P.steamWater(40) * 0.7 + P.steamWater(20));
assert(open.steamUsed > condensed.steamUsed);
near(P.waterLimitedKw(0.001, 1 / 60, 0.7), 0.001 * 0.12 * 2680 * 60 / 0.7);

// 同质量下高坡在指定速度所需功率更大；6 PS 牵引四吨车不能免费获得额定加速度。
const sixPsKw = 6 * P.PS_KW, kg = 4000, v = 48 * P.PX_M;
const flatKw = kg * P.GRAVITY * P.ROLL * v / P.TRANSMISSION / 1000;
const hillKw = kg * P.GRAVITY * (P.ROLL + 0.1) * v / P.TRANSMISSION / 1000;
assert(sixPsKw > flatKw && sixPsKw < hillKw);
assert(P.driveKw(kg, 48) > sixPsKw);

// 真正开一局：纸面满水质量、蒸汽耗水、回路升温及水重变化进入战斗状态。
SA.go = () => {};
SA.S.reset(); SA.S.d.vehicle = starter;
SA.Battle.startState({ mode: 'friendly', enemyVehicle: starter, enemyName: '检查目标', terrain: 'flat', hpMul: 1 });
const side = SA.Battle.debug.B.p;
near(side.mass * 1000, stats.weight);
near(side.supply, stats.supply);
near(side.heatCapacity, stats.heatCapacity);
side.dir = 1; side.spool = 0; side.spoolDir = 1;
const startWater = side.water;
SA.Battle.debug.step(1);
assert(side.water < startWater && side.water >= 0);
near(side.mass * 1000, side.dryKg + side.water, 0.1);
assert(Number.isFinite(side.heat) && Number.isFinite(side.vx));
// 真实受击损毁会移走该模块的参与换热质量，回路温度不能凭空跳升。
let target;
SA.V.each(side.v, (cell, r, c, layer) => { if (!target && cell.id === 'mg_s') target = { cell, r, c, layer }; });
assert(target);
side.heat = side.heatCapacity * 50;
const beforeTemp = P.temp(side.heat, side.heatCapacity), beforeCap = side.heatCapacity;
SA.Battle.debug.damage('p', target.r, target.c, target.layer, SA.V.maxHp(target.cell) + 100);
assert(side.heatCapacity < beforeCap);
near(P.temp(side.heat, side.heatCapacity), beforeTemp);

// 旧分享码仍按原模块 ID 解码；真实固定帧对局在两种帧长下均无 NaN。
const decoded = SA.V.decode(SA.V.encode(starter));
assert(SA.V.stats(decoded).count === stats.count);
for (const dt of [1 / 30, 1 / 60]) {
  const result = SA.Battle.simulate({ p: starter, e: decoded, terrain: 'flat', dt, seed: 7 });
  assert(Number.isFinite(result.t) && result.t > 0 && result.winner);
  assert(result.events.p.fire > 0 && result.events.e.fire > 0, '真实逐帧战斗未能开火');
}
const firstStage = stageFor(SA, 0, 0);
assert(firstStage?.vehicle, '战役第一关未能加载');
const firstFight = SA.Battle.simulate({ p: starter, e: firstStage.vehicle, terrain: firstStage.terrain || 'flat', dt: 1 / 60, seed: 8 });
assert(firstFight.events.p.fire > 0 || firstFight.events.e.fire > 0, '战役第一关未能开火');
console.log(`单位检查通过：标准锅炉 ${P.kwToPs(60).toFixed(1)} PS，满载 ${P.steamWater(60).toFixed(3)} L/s；样车满水 ${SA.tons(stats.weight)}。`);
