/* 加压舱 1×1 → 1×2 迁移回归：旧载具、蓝图、分享码和关卡清单都不能吞件。 */
'use strict';

const assert = require('assert');
const { loadGame } = require('./evolve');
function run() {
  const { SA, context } = loadGame();

  function oldVehicle() {
    const v = SA.V.create('旧加压舱');
    delete v.pv;
    v.body[10][6] = SA.newCell('track');
    v.body[8][6] = SA.newCell('boiler');
    v.body[7][6] = SA.newCell('pressure_chamber', 3);
    v.body[7][6].lv = 2;
    v.body[7][6].hp = 12;
    return v;
  }

  function assertMoved(v) {
    assert.strictEqual(v.pv, 2);
    const found = [];
    SA.V.each(v, (cell, r, c) => { if (cell.id === 'pressure_chamber') found.push([cell, r, c]); });
    assert.strictEqual(found.length, 1, '加压舱从车上消失或重复');
    assert.notStrictEqual(found[0][1] + ',' + found[0][2], '7,6', '占用下格时没有迁移');
    assert.strictEqual(v.body[8][6].id, 'boiler', '原模块被挤掉');
    assert.strictEqual(found[0][0].mt, 3);
    assert.strictEqual(found[0][0].lv, 2);
    assert.strictEqual(found[0][0].hp, 12);
    assert.strictEqual(SA.V.issues(v).length, 0, '迁移后构筑不合法');
  }

  assert.deepStrictEqual([SA.fp('pressure_chamber').w, SA.fp('pressure_chamber').h], [1, 2], '模块表尺寸尚未改为 1×2');
  const migrated = SA.V.migrate(oldVehicle());
  assertMoved(migrated);
  assert.strictEqual(JSON.stringify(SA.V.migrate(migrated)), JSON.stringify(migrated), '二次迁移不幂等');

  // 旧蓝图、分享码沿用旧坐标；下格已有锅炉，必须保留锅炉并转移加压舱。
  const old = oldVehicle();
  const oldLayout = { b: [[10, 6, 'track'], [8, 6, 'boiler'], [7, 6, 'pressure_chamber']], s: [], g: 2, a: 2 };
  const blueprint = SA.V.fromLayout('旧蓝图', oldLayout);
  assert.strictEqual(SA.V.countIds(blueprint).pressure_chamber, 1);
  assert.strictEqual(blueprint.body[8][6].id, 'boiler');
  const index = id => SA.MODULE_ORDER.indexOf(id);
  const payload = { n: '旧分享码', b: [[10, 6, index('track')], [8, 6, index('boiler')], [7, 6, index('pressure_chamber')]], s: [], a: 2 };
  const code = 'SA2.' + Buffer.from(JSON.stringify(payload)).toString('base64');
  const decoded = SA.V.decode(code);
  assert(decoded && SA.V.countIds(decoded).pressure_chamber === 1, '旧分享码丢了加压舱');
  assert.strictEqual(decoded.body[8][6].id, 'boiler');

  const cells = [[0, 10, 6, 'track', 1, 0], [0, 8, 6, 'boiler', 1, 0], [0, 7, 6, 'pressure_chamber', 3, 2]];
  const restored = SA.V.fromCells('旧关卡', cells);
  assert.strictEqual(SA.V.countIds(restored).pressure_chamber, 1);
  assert.strictEqual(restored.body[8][6].id, 'boiler');

  // 改装台范围内没有完整空位时，模块对象进入待退库存，布局和分享码往返仍保留它。
  const full = oldVehicle();
  full.lim = { cols: 1, rows: 3 };
  for (let r = 6; r < 8; r++) for (let c = 6; c < 8; c++) if (!full.body[r][c]) full.body[r][c] = SA.newCell('plate');
  const stock = SA.V.migrate(full);
  assert.strictEqual(stock.migrationStock.length, 1);
  assert.strictEqual(stock.migrationStock[0].id, 'pressure_chamber');
  assert.strictEqual(stock.migrationStock[0].mt, 3);
  assert.strictEqual(SA.V.fromLayout('库存蓝图', SA.V.layout(stock)).migrationStock.length, 1);
  assert.strictEqual(SA.V.decode(SA.V.encode(stock)).migrationStock.length, 1);

  // 实际读档把待退库存消费一次，保留受损耐久和改装；再安装也不会被重建为满血白板。
  SA.S.reset();
  SA.S.d.vehicle = stock;
  let saved = JSON.stringify(SA.S.d);
  context.localStorage.getItem = () => saved;
  context.localStorage.setItem = (_, value) => { saved = value; };
  SA.S.load(); SA.S.save(); SA.S.load();
  assert.strictEqual(SA.S.invCount('pressure_chamber'), 1);
  assert.strictEqual(SA.S.d.vehicle.migrationStock, undefined);
  const item = SA.S.stockOptions('pressure_chamber', 3)[0];
  assert.strictEqual(item.hp, 12);
  assert.strictEqual(item.lv, 2);
  const install = SA.V.create('重新安装');
  SA.S.installStock(install, 'pressure_chamber', 6, 6, 3, 'body', null, []);
  assert.strictEqual(install.body[6][6].hp, 12);
  assert.strictEqual(install.body[6][6].lv, 2);
  assert.strictEqual(SA.S.invCount('pressure_chamber'), 0);

  // 旧关卡的下方是一件 1×1，且同位有侧挂；只迁移主体加压舱，原模块对象都保留。
  const small = oldVehicle();
  small.body[7][6] = SA.newCell('plate');
  small.body[6][6] = SA.newCell('pressure_chamber');
  small.side[8][6] = SA.newCell('side_cannon');
  SA.V.migrate(small);
  assert.strictEqual(small.body[7][6].id, 'plate');
  assert.strictEqual(small.side[8][6].id, 'side_cannon');
  assert.strictEqual(SA.V.issues(small).length, 0);

  // 旧大格和 ASCII 的入口使用相同占格迁移，不依赖保存格式。
  const big = Array.from({ length: 6 }, () => Array(8).fill(null));
  big[5][3] = SA.newCell('track'); big[4][3] = SA.newCell('boiler'); big[3][3] = SA.newCell('pressure_chamber');
  assert.strictEqual(SA.V.countIds(SA.V.migrate({ name: '大格旧档', body: big, side: [] })).pressure_chamber, 1);
  const ascii = SA.V.fromAscii('旧关卡', ['........', '........', '........', '........', '...O....', '...T....'], [], 1, [], [[7, 6, 'pressure_chamber']]);
  assert.strictEqual(SA.V.countIds(ascii).pressure_chamber, 1);
  assert.strictEqual(SA.V.issues(ascii).length, 0);

  // 旧双足上移和清理腿区不能抢先删掉加压舱；无版本清单中的合法占格也不能被擅自搬走。
  for (const row of [0, 9]) {
    const v = SA.V.create('旧双足加压舱'); delete v.pv;
    v.body[10][6] = SA.newCell('biped'); v.body[row][6] = SA.newCell('pressure_chamber');
    SA.V.migrate(v);
    assert.strictEqual((SA.V.countIds(v).pressure_chamber || 0) + (v.migrationStock || []).length, 1);
  }
  const floating = SA.V.fromCells('未完成的构筑', [[0, 6, 6, 'pressure_chamber', 1, 0]]);
  assert.strictEqual(floating.body[6][6].id, 'pressure_chamber');
  const invalid = SA.V.create('自由摆放');
  invalid.body[10][6] = SA.newCell('track'); invalid.body[8][6] = SA.newCell('boiler'); invalid.body[9][8] = SA.newCell('pressure_chamber');
  assert.strictEqual(SA.V.decode(SA.V.encode(invalid)).migrationStock.length, 1);
  return { size: '1×2', legacySave: true, share: true, blueprint: true, stages: true, stockOnce: true, legacyBiped: true };
}
module.exports = { run };
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
