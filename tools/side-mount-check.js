/* 侧挂单件承托、装弹机定向效果及旧布局保件回归。 */
'use strict';
const assert = require('assert');
const { loadGame } = require('./evolve');

function run() {
  const { SA } = loadGame();
  const cell = id => SA.newCell(id, 6);
  const vehicle = () => {
    const v = SA.V.create('侧挂检查');
    v.body[10][4] = cell('track'); v.body[8][4] = cell('boiler'); v.body[6][4] = cell('cockpit');
    return v;
  };
  const check = (v, id, r, c, ok) => {
    assert.strictEqual(SA.V.canPlace(v, id, r, c).ok, ok, `${id} @ ${r},${c} 严格摆放`);
    assert.strictEqual(SA.V.canPut(v, id, r, c).fit, ok, `${id} @ ${r},${c} 车间合法标记`);
    v.side[r][c] = cell(id);
    assert.strictEqual(!SA.V.issues(v).some(x => x.layer === 'side' && x.r === r && x.c === c), ok, `${id} @ ${r},${c} 出战校验`);
    v.side[r][c] = null;
  };

  // 重装甲能完整承托 2×2 侧炮；小甲拼接、跨边界或非装甲主体都不能替代单件承托。
  const armor = vehicle(); armor.body[4][4] = cell('armor_heavy');
  check(armor, 'side_cannon', 4, 4, true);
  check(armor, 'side_cannon', 4, 5, false);
  check(armor, 'gyroscope', 4, 4, true);
  const plates = vehicle();
  for (let r = 4; r < 6; r++) for (let c = 4; c < 6; c++) plates.body[r][c] = cell('plate');
  check(plates, 'side_cannon', 4, 4, false);
  check(plates, 'periscope', 4, 4, true);
  const iron = vehicle(); iron.body[4][4] = cell('armor');
  check(iron, 'radiator', 4, 4, true);
  const boiler = vehicle(); boiler.body[4][4] = cell('boiler');
  check(boiler, 'gyroscope', 4, 4, false);

  // 横向、纵向大炮均可挂装弹机；小炮、火箭、蒸汽、喷火、近战都不合格。
  for (const id of ['cannon_m', 'mg_heavy']) {
    const v = vehicle(); v.body[4][4] = cell(id);
    if (SA.fp(id).h === 1) v.body[5][4] = cell('plate');
    check(v, 'autoloader', 4, 4, true);
  }
  for (const id of ['cannon_s', 'rocket_rack', 'steamjet', 'flamer', 'piston']) {
    const v = vehicle(); v.body[4][4] = cell(id); check(v, 'autoloader', 4, 4, false);
  }

  // 两门同型炮仅一门被加速；损毁挂件立即失效，纸面与战斗读取同一倍率。
  const v = vehicle();
  v.body[10][4] = cell('track'); v.body[10][6] = cell('track'); v.body[10][8] = cell('track');
  v.body[8][4] = cell('boiler'); v.body[8][6] = cell('cockpit');
  v.body[7][4] = cell('cannon_m'); v.body[6][4] = cell('plate'); v.body[5][4] = cell('plate'); v.body[4][4] = cell('cannon_m');
  v.side[7][4] = cell('autoloader');
  assert.strictEqual(SA.V.weaponReloadMul(v, 7, 4), 0.85);
  assert.strictEqual(SA.V.weaponReloadMul(v, 4, 4), 1);
  const boosted = SA.V.stats(v), normal = SA.V.clone(v);
  normal.side[7][4] = null;
  const base = SA.V.stats(normal);
  assert(boosted.salvoDps > base.salvoDps && boosted.salvoDps < base.salvoDps / 0.85, '纸面只加速一门炮');
  SA.go = () => {}; SA.S.reset(); SA.S.d.vehicle = v;
  SA.Battle.startState({ mode: 'friendly', enemyVehicle: normal, terrain: 'flat', boss: true });
  const weapons = SA.Battle.debug.B.p.weapons.filter(w => w.cell.id === 'cannon_m');
  assert.strictEqual(weapons.length, 2);
  assert.strictEqual(weapons.find(w => w.r === 7).m.reload, SA.MODULES.cannon_m.reload * 0.85);
  assert.strictEqual(weapons.find(w => w.r === 4).m.reload, SA.MODULES.cannon_m.reload);
  v.side[7][4].hp = 0;
  assert.strictEqual(SA.V.weaponReloadMul(v, 7, 4), 1);
  assert(Math.abs(SA.V.stats(v).salvoDps - base.salvoDps) < 1e-9, '损毁后纸面恢复原速');

  // 历史主体件迁至侧挂原位；相同位置已有挂件则完整退库，分享码不会吞掉标红旧件。
  const old = vehicle(); old.body[4][4] = cell('periscope');
  assert(SA.V.migrate(old).side[4][4]?.id === 'periscope');
  const conflict = vehicle(); conflict.body[4][4] = cell('autoloader'); conflict.side[4][4] = cell('gyroscope');
  assert(SA.V.migrate(conflict).migrationStock.some(x => x.id === 'autoloader'));
  const legacy = { g: 2, a: 2, pv: 2, b: [[4, 4, 'periscope']], s: [] };
  assert(SA.V.validLayout(legacy));
  assert(SA.V.fromLayout('旧蓝图', legacy).side[4][4]?.id === 'periscope');
  const oldConflict = SA.V.fromLayout('旧蓝图冲突', { ...legacy, s: [[4, 4, 'gyroscope']] });
  assert(oldConflict.side[4][4]?.id === 'gyroscope' && oldConflict.migrationStock.some(x => x.id === 'periscope'));
  assert(SA.V.fromCells('旧清单', [[0, 4, 4, 'periscope', 6, 0]]).side[4][4]?.id === 'periscope');
  const code = 'SA2.' + Buffer.from(JSON.stringify({ n: '旧分享码', a: 2, pv: 2,
    b: [[4, 4, SA.MODULE_ORDER.indexOf('periscope')]], s: [[5, 5, SA.MODULE_ORDER.indexOf('side_cannon')]] })).toString('base64');
  const imported = SA.V.decode(code);
  assert(imported?.side[4][4]?.id === 'periscope');
  assert(imported?.side[5][5]?.id === 'side_cannon');
  assert(SA.V.issues(imported).some(x => x.layer === 'side'), '旧车标红等待调整');
  return { hostRules: true, targetedReload: true, legacyPreserved: true };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run())); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
