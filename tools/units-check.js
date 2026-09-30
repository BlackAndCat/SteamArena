/* 工程单位回归：直接加载真实规则与真实战斗帧，不复制实现公式。 */
'use strict';

const assert = require('assert');
const { loadGame, stageFor } = require('./evolve');
const { SA } = loadGame();
const P = SA.Phys;
const near = (a, b, eps = 1e-6) => assert(Math.abs(a - b) <= eps, `${a} 与 ${b} 不符`);

// 标准锅炉额定轴功率 60 kW，约 81.6 公制马力。
near(SA.MODULES.boiler.supply, 60);
near(P.kwToPs(60), 81.57729703823426);

// 开局车只有锅炉、武器、驾驶舱和底盘：供汽不应凭空生成储水。
const dryStarter = SA.V.fromAscii('无储水检查', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs);
near(SA.V.stats(dryStarter).water, 0);
for (const id of ['boiler_s', 'boiler', 'boiler_l']) near(SA.MODULES[id].water || 0, 0);
near(SA.MODULES.pressure_chamber.water, 8);
const starter = SA.V.clone(dryStarter);
const placed = SA.V.place(starter, 'tank_s', 8, 8, 1);
assert(placed.ok, `检查车无法安装小水罐：${placed.reason || ''}`);
const stats = SA.V.stats(starter);
near(stats.water, SA.MODULES.tank_s.water);
near(stats.weight, stats.dryWeight + stats.water);
assert(stats.weight > stats.dryWeight && stats.heatCapacity > 0);
near(P.temp(stats.heatCapacity * 45, stats.heatCapacity), 65);
near(stats.heatCapacity * 45 / stats.heatMax, 0.45);

// 用真实开战入口核对双方初始储水，并确认连续开战不会沿用上辆车的水量。
const startFight = (player, enemy) => {
  SA.go = () => {};
  SA.S.reset(); SA.S.d.vehicle = player;
  SA.Battle.startState({ mode: 'friendly', enemyVehicle: enemy, enemyName: '检查目标', terrain: 'flat', hpMul: 1 });
  return SA.Battle.debug.B;
};
const checkSideWater = (side, expected) => { near(side.waterMax, expected); near(side.water, expected); };
let fight = startFight(dryStarter, dryStarter);
checkSideWater(fight.p, 0); checkSideWater(fight.e, 0);
fight.p.isAI = true;
SA.Battle.debug.step(2);
assert(fight.p.power > 0 && fight.p.events.fire > 0, `零储水开战仍须供能并开火：供能 ${fight.p.power}、发射 ${fight.p.events.fire}`);
near(fight.p.water, 0);
fight = startFight(starter, dryStarter);
checkSideWater(fight.p, SA.MODULES.tank_s.water); checkSideWater(fight.e, 0);
fight = startFight(dryStarter, starter);
checkSideWater(fight.p, 0); checkSideWater(fight.e, SA.MODULES.tank_s.water);
for (const [id, mt] of [['boiler_s', 1], ['boiler', 3], ['boiler_l', 6]]) {
  const boilerCar = SA.V.fromCells('无储水锅炉车', [[0, 7, 7, id, mt, 0], [0, 9, 11, 'helmet', mt, 0], [0, 10, 11, 'track', mt, 0]]);
  near(SA.V.stats(boilerCar).water, 0);
  fight = startFight(boilerCar, dryStarter);
  checkSideWater(fight.p, 0); checkSideWater(fight.e, 0);
}
const tankCar = SA.V.clone(dryStarter);
assert(SA.V.place(tankCar, 'water', 6, 8, 1).ok, '检查车无法安装水箱');
fight = startFight(tankCar, dryStarter);
checkSideWater(fight.p, SA.MODULES.water.water);
let stageCount = 0;
for (let ci = 0; ci < SA.CAMPAIGN.length; ci++) for (let si = 0; si < SA.CAMPAIGN[ci].stages.length; si++) {
  const stage = stageFor(SA, ci, si);
  assert(stage?.vehicle, `关卡 ${ci}:${si} 未能加载`);
  let explicitWater = 0;
  SA.V.each(stage.vehicle, cell => { if (SA.V.alive(cell)) explicitWater += SA.mod(cell).water || 0; });
  near(SA.V.stats(stage.vehicle).water, explicitWater);
  fight = startFight(dryStarter, stage.vehicle);
  checkSideWater(fight.p, 0); checkSideWater(fight.e, explicitWater);
  if (ci === 0 && si === 0) near(explicitWater, 0);
  stageCount++;
}
assert.strictEqual(stageCount, 18, '战役关卡数量变化，需要更新水量检查范围');

// 锅炉供能不消耗储水，冷却蒸发才消耗储水。
const base = { shaftKw: 60, heatKw: 75, weaponKw: 0, cool: 0, dryCool: 0, waterSave: 1, capacity: 50 };
const dry = P.thermalStep(100, 0, 1 / 60, base);
near(dry.shaftKw, 60); near(dry.water, 0);
const last = P.thermalStep(100, 0.001, 1 / 60, { ...base, cool: 200 });
assert(last.water >= 0 && last.water <= 0.001);
const cooled = P.thermalStep(100, 0.001, 1 / 60, { ...base, shaftKw: 0, cool: 200 });
assert(cooled.cooled <= 0.001 * P.LATENT_KJ_L + 1e-9);
near(cooled.water, 0.001 - cooled.cooled / P.LATENT_KJ_L);
const running = P.thermalStep(0, 1, 1, base);
near(running.water, 1);
const wetCooling = P.thermalStep(100, 1, 1, { ...base, shaftKw: 0, cool: 200 });
assert(wetCooling.water < 1 && wetCooling.cooled > 0);

// 同质量下高坡在指定速度所需功率更大；6 PS 牵引四吨车不能免费获得额定加速度。
const sixPsKw = 6 * P.PS_KW, kg = 4000, v = 48 * P.PX_M;
const flatKw = kg * P.GRAVITY * P.ROLL * v / P.TRANSMISSION / 1000;
const hillKw = kg * P.GRAVITY * (P.ROLL + 0.1) * v / P.TRANSMISSION / 1000;
assert(sixPsKw > flatKw && sixPsKw < hillKw);
assert(P.driveKw(kg, 48) > sixPsKw);

// 真正开一局：纸面满水质量、蒸汽耗水、回路升温及水重变化进入战斗状态。
const side = startFight(starter, starter).p;
near(side.mass * 1000, stats.weight);
near(side.supply, stats.supply);
near(side.heatCapacity, stats.heatCapacity);
side.dir = 1; side.spool = 0; side.spoolDir = 1;
const startWater = side.water;
SA.Battle.debug.step(1);
assert(side.water <= startWater && side.water >= 0);
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
const dryFirstFight = SA.Battle.simulate({ p: dryStarter, e: firstStage.vehicle, terrain: firstStage.terrain || 'flat', dt: 1 / 60, seed: 8 });
assert(dryFirstFight.events.p.fire > 0 && dryFirstFight.events.e.fire > 0, '双方零储水的战役第一关未能交火');
console.log(`单位检查通过：标准锅炉 ${P.kwToPs(60).toFixed(1)} PS；无储水仍可开火，18 关初始水量正确；样车满水 ${SA.tons(stats.weight)}。`);
