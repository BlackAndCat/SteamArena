/*
 * 战斗常量回归检查：确认蓄压罐释放上限、车间说明和跳弹公式共用同一份规则。
 * 该脚本只通过 evolve.loadGame 加载真实游戏代码，不修改生产接口。
 */
'use strict';

const assert = require('assert');
const evolve = require('./evolve');

function checkStoreRelease(SA) {
  // evolve.loadGame 不加载 main.js；补上 start 所需的最小场景切换钩子。
  SA.go = () => { SA.current = 'battle'; };
  const tankVehicle = SA.V.fromAscii('蓄压检查', ['........', '........', '...K....', '...ON...', '...OWA..', '...TTT..'], [], 1);
  const enemy = SA.V.fromAscii('蓄压检查敌车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs);
  SA.S.reset();
  SA.S.d.vehicle = tankVehicle;
  SA.Battle.start({ mode: 'friendly', enemyVehicle: enemy, enemyName: '检查目标', terrain: 'flat', hpMul: 1 });
  const side = SA.Battle.debug.B;
  assert(side && side.p, '战斗调试状态未创建');
  // 直接构造“库存不足”的战斗状态，避免依赖具体车辆配平；随后按真实帧推进。
  side.p.supply = 0;
  side.p.demand = 10;
  side.p.storeMax = 20;
  side.p.store = 20;
  const before = side.p.store;
  SA.Battle.debug.step(1);
  const after = side.p.store;
  const released = before - after;
  assert(released >= 0 && released <= SA.K.BATTLE.STORE_RELEASE_PER_SEC + 1e-6,
    `蓄压罐每秒释放超限：${released}`);

  // 不同推进时长都按秒计，库存不能因帧长变化而多放。
  side.p.store = 20;
  SA.Battle.debug.step(0.5);
  const halfReleased = 20 - side.p.store;
  assert(halfReleased <= SA.K.BATTLE.STORE_RELEASE_PER_SEC * 0.5 + 0.05,
    `半秒释放超限：${halfReleased}`);
  return { oneSecond: released, halfSecond: halfReleased, cap: SA.K.BATTLE.STORE_RELEASE_PER_SEC };
}

function checkDescriptionsAndRicochet(SA) {
  const tank = SA.MODULES.pressure_tank;
  const core = SA.MODULES.boss_core;
  const tankDesc = Object.getOwnPropertyDescriptor(tank, 'desc');
  const coreDesc = Object.getOwnPropertyDescriptor(core, 'desc');
  assert(tankDesc && typeof tankDesc.get === 'function', '蓄压罐说明没有动态读取释放常量');
  assert(coreDesc && typeof coreDesc.get === 'function', '压力核心说明没有动态读取释放常量');
  const old = SA.K.BATTLE.STORE_RELEASE_PER_SEC;
  try {
    SA.K.BATTLE.STORE_RELEASE_PER_SEC = old + 7;
    assert(tank.desc.includes(String(old + 7)) && core.desc.includes(String(old + 7)), '说明未随释放常量更新');
  } finally {
    SA.K.BATTLE.STORE_RELEASE_PER_SEC = old;
  }

  const weapon = { penetration: 2, ricochet: 0.1 };
  const got = SA.Battle.ricochetChance(6, weapon);
  const deficit = (6 - 2) / 6;
  const expected = Math.min(SA.K.BATTLE.RICOCHET_MAX, SA.K.BATTLE.RICOCHET_BASE + deficit * SA.K.BATTLE.RICOCHET_DEFICIT + 0.1);
  assert(Math.abs(got - expected) < 1e-9, `跳弹公式未读取规则参数：${got} !== ${expected}`);
  return { ricochet: got, descriptionDynamic: true };
}

function run() {
  const { SA } = evolve.loadGame();
  return { store: checkStoreRelease(SA), formula: checkDescriptionsAndRicochet(SA) };
}

module.exports = { run };

if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
