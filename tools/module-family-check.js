/*
 * 新模块族回归：使用真实规则层检查旧分享码、摆放、属性、解锁和武器组。
 * 机枪仰角由视觉侧配置；字段未交付时验收明确失败，不以跳过实射冒充通过。
 */
'use strict';

const assert = require('assert');
const { loadGame } = require('./evolve');

const OLD_ORDER = ['track', 'quad', 'biped', 'cockpit', 'boiler', 'water',
  'armor', 'armor_heavy', 'cannon', 'mortar', 'mg', 'side_cannon', 'bucket', 'spike', 'piston',
  'copilot', 'helmet', 'plate', 'tank_s', 'tank_tall', 'cannon_m',
  'cannon_s', 'cannon_heavy', 'cannon_giant', 'pressure_tank', 'pressure_chamber', 'cockpit_pair',
  'radiator', 'condenser', 'rocket_rack', 'harpoon', 'flamer',
  'boss_core', 'boss_lens', 'boss_ram', 'mortar_s', 'mg2', 'steamjet', 'periscope', 'autoloader', 'rangefinder', 'gyroscope'];
// 此码由新增模块前的索引 0/4/10/16 独立生成，不能用当前编码器自证兼容。
const OLD_MG_CODE = 'SA2.eyJuIjoi5pen5py654KuIiwiYiI6W1sxMCw2LDBdLFs4LDYsNF0sWzgsOCwxMF0sWzcsOCwxNl1dLCJzIjpbXX0=';
const NEW_IDS = ['mg_s', 'mg_heavy', 'boiler_s', 'boiler_l', 'water_l'];

function put(SA, v, id, r, c) {
  const result = SA.V.place(v, id, r, c);
  assert(result.ok, `${id}@${r},${c} 摆放失败：${result.reason}`);
  return v.body[r][c];
}

function fullVehicle(SA) {
  const v = SA.V.create('模块族合法车');
  for (const c of [4, 6, 8, 10]) put(SA, v, 'track', 10, c);
  put(SA, v, 'boiler_l', 7, 5);
  put(SA, v, 'water_l', 7, 8);
  put(SA, v, 'helmet', 6, 7);
  put(SA, v, 'mg_s', 6, 8);
  put(SA, v, 'mg_heavy', 5, 9);
  put(SA, v, 'boiler_s', 5, 6);
  return v;
}

function checkOrderAndOldCode(SA) {
  assert.strictEqual(OLD_ORDER.length, 42);
  OLD_ORDER.forEach((id, i) => assert.strictEqual(SA.MODULE_ORDER[i], id, `旧模块序号 ${i} 改变`));
  assert.deepStrictEqual(Array.from(SA.MODULE_ORDER.slice(42)), NEW_IDS);
  const v = SA.V.decode(OLD_MG_CODE);
  assert(v, '旧分享码无法读回');
  assert.strictEqual(v.body[8][8]?.id, 'mg', '旧索引 10 未读回原机炮');
  assert.strictEqual(v.body[7][8]?.id, 'helmet');
  assert.strictEqual(SA.MODULES.mg.name, '机炮');
  assert(SA.MODULES.mg2 && SA.STARTER && SA.S.reset().inv.mg === 1, '旧库存或双联机枪丢失');
  return { oldCount: OLD_ORDER.length, decoded: v.body[8][8].id };
}

function checkLayoutAndStats(SA) {
  const sizes = { mg_s: [1, 1], mg_heavy: [1, 2], boiler_s: [1, 2], boiler_l: [3, 3], water_l: [3, 3] };
  for (const [id, [w, h]] of Object.entries(sizes)) {
    assert.strictEqual(SA.fp(id).w, w);
    assert.strictEqual(SA.fp(id).h, h);
  }
  const v = fullVehicle(SA), stats = SA.V.stats(v), occ = SA.V.occ(v);
  assert(stats.canDeploy, `完整车不能出战：${stats.problems.join('；')}`);
  for (const [id, r, c] of [['boiler_l', 7, 5], ['water_l', 7, 8]])
    for (let y = r; y < r + 3; y++) for (let x = c; x < c + 3; x++) assert.strictEqual(occ[y][x]?.cell.id, id);
  assert(!SA.V.canPlace(v, 'plate', 8, 7).ok, '3×3 中央允许重叠');
  assert(!SA.V.canPlace(v, 'water_l', 10, 13).ok, '3×3 越界允许摆放');
  assert(!SA.V.canPlace(SA.V.create('空车'), 'water_l', 0, 0).ok, '悬空模块允许摆放');
  // 早期 5×3 大格也能容纳一个 3×3 子格件；实际商店仍按第四章通关解锁。
  const early = SA.V.create('早期改装台');
  early.lim = { cols: 5, rows: 3 };
  put(SA, early, 'track', 10, 6);
  put(SA, early, 'water_l', 7, 6);
  assert(!SA.V.canPut(early, 'boiler_l', 5, 9).ok, '3×3 越过早期改装台上边界');
  const round = SA.V.decode(SA.V.encode(v));
  assert(round && SA.V.stats(round).canDeploy, '新模块分享码读回不能出战');
  for (const id of NEW_IDS) assert.strictEqual(SA.V.countIds(round)[id], 1, `${id} 分享码丢失`);
  assert.strictEqual(stats.supply, SA.MODULES.boiler_s.supply + SA.MODULES.boiler_l.supply);
  assert.strictEqual(stats.heatRate, SA.MODULES.boiler_s.heatRate + SA.MODULES.boiler_l.heatRate);
  assert.strictEqual(stats.water, SA.MODULES.water_l.water);
  assert.strictEqual(stats.cool, SA.MODULES.water_l.cool);
  for (const [id, field, value] of [['boiler_s', 'supply', SA.MODULES.boiler_l.supply],
    ['boiler_l', 'supply', SA.MODULES.boiler_s.supply], ['water_l', 'water', 0]]) {
    const copy = SA.V.clone(v);
    SA.V.each(copy, cell => { if (cell.id === id) cell.hp = 0; });
    const damaged = SA.V.stats(copy);
    assert.strictEqual(damaged[field], value, `${id} 被毁后仍提供 ${field}`);
    if (id === 'water_l') assert.strictEqual(damaged.cool, 0, '大水箱被毁后仍冷却');
    else assert(Math.abs(damaged.heatRate - (stats.heatRate - SA.MODULES[id].heatRate)) < 1e-9, `${id} 被毁后仍产热`);
  }
  return { deploy: true, supply: stats.supply, heatRate: stats.heatRate, water: stats.water, cool: stats.cool };
}

function checkProgressAndShop(SA) {
  assert(['mg_s', 'boiler_s'].every(id => SA.CAMPAIGN[0].unlock.mods.includes(id)), '序章通关解锁错误');
  assert(SA.CAMPAIGN[1].unlock.mods.includes('mg_heavy'), '第一章通关解锁错误');
  assert(['boiler_l', 'water_l'].every(id => SA.CAMPAIGN[4].unlock.mods.includes(id)), '第四章通关解锁错误');
  const d = SA.S.reset();
  d.camp.ch = 5; d.camp.st = 0;
  d.camp.mods = d.camp.mods.filter(id => !NEW_IDS.includes(id));
  SA.Camp.backfill();
  for (const id of NEW_IDS) assert(SA.Camp.hasMod(id) && SA.S.buyable(id), `${id} 通关存档未补解锁`);
  d.money = 10000;
  for (const id of NEW_IDS) {
    const before = SA.S.invCount(id), money = d.money;
    assert(SA.S.buy(id), `${id} 购买失败`);
    assert.strictEqual(SA.S.invCount(id), before + 1);
    assert.strictEqual(d.money, money - SA.buyPrice(id));
  }
  return { backfilled: NEW_IDS.length, bought: NEW_IDS.length };
}

function checkWeapons(SA) {
  const enemy = SA.V.fromAscii('目标', SA.STARTER.rows, [], 1, [], SA.STARTER.subs);
  const results = {};
  for (const id of ['mg_s', 'mg_heavy']) {
    const v = SA.V.create(id);
    put(SA, v, 'track', 10, 6); put(SA, v, 'track', 10, 8);
    put(SA, v, 'boiler', 8, 6); put(SA, v, id, 8, 8); put(SA, v, 'helmet', 7, 8);
    assert(SA.V.stats(v).canDeploy, `${id} 试射车不合法`);
    SA.S.d.vehicle = v;
    SA.go = () => { SA.current = 'battle'; };
    SA.Battle.startState({ mode: 'friendly', enemyVehicle: enemy, enemyName: '目标', terrain: 'flat', hpMul: 1 });
    const side = SA.Battle.debug.B.p;
    assert(side.groups.includes(id) && side.weapons.some(w => w.cell.id === id && !w.blocked), `${id} 未进入可用武器组`);
    assert(Array.isArray(SA.MODULES[id].elev) && Number.isFinite(SA.MODULES[id].rest), `${id} 待 Opus 接入仰角 / 静止角后才能验收实射`);
    const duel = SA.Battle.simulate({ p: v, e: enemy, seed: 82 });
    assert(duel.events.p.fire > 0, `${id} 没有开火`);
    results[id] = duel.events.p.fire;
  }
  return results;
}

function run() {
  const { SA } = loadGame();
  return { compatibility: checkOrderAndOldCode(SA), layout: checkLayoutAndStats(SA), shop: checkProgressAndShop(SA), weapons: checkWeapons(SA) };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
