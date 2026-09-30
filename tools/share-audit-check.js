/* 分享码边界回归：坏数据整体拒绝且不写存储，历史污染不阻断正常蓝图和迁移。 */
'use strict';
const assert = require('assert');
const { loadGame } = require('./evolve');

/** 用隔离存储检查正式导入、列表、规划与刷新，避免触碰玩家浏览器存档。 */
function run() {
  const { SA, context } = loadGame(), memory = new Map();
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  SA.S.reset();
  const encode = data => 'SA2.' + Buffer.from(JSON.stringify(data)).toString('base64');
  const good = SA.V.encode(SA.S.starterVehicle());
  const payload = JSON.parse(Buffer.from(good.slice(4), 'base64').toString());
  const stock = { id: 'pressure_chamber', hp: 10, mt: 2, lv: 1 };
  const corrupt = [null, [], { ...payload, b: {} }, { ...payload, ms: {} },
    { ...payload, b: [...payload.b, [0, 0, 9999]] },
    { ...payload, b: [...payload.b, [0, 0, -1]] },
    { ...payload, b: [...payload.b, payload.b[0]] },
    { ...payload, b: [[-1, 0, 0]] }, { ...payload, b: [[0.5, 0, 0]] },
    { ...payload, b: [[0, SA.K.COLS, 0]] },
    { ...payload, s: [payload.b[0]] },
    ...['missing', '__proto__', 'constructor'].map(id => ({ ...payload, ms: [{ ...stock, id }] })),
    ...[0, 7, 1.5, '2'].map(mt => ({ ...payload, ms: [{ ...stock, mt }] })),
    ...[-1, 4, 0.5].map(lv => ({ ...payload, ms: [{ ...stock, lv }] })),
    { ...payload, ms: [{ ...stock, hp: -1 }] }, { ...payload, ms: [null] },
    { ...payload, ms: [{ ...stock, hp: 1e9 }] },
    { ...payload, ms: [{ ...stock, hp: 1e9, max: 1e9 }] },
    { ...payload, ms: [{ ...stock, max: 1 }] }];
  // 规范快照与旧喷射器仍可迁移，含改装的残血比例不能因校验丢失。
  const stockMax = SA.V.maxHp(stock);
  const normalStock = SA.V.decode(encode({ ...payload, ms: [{ ...stock, max: stockMax }] }));
  assert(normalStock && normalStock.migrationStock[0].hp === stock.hp);
  for (const [id, mt] of [['flamer', 1], ['steamjet', 6], ['copilot', 1]]) {
    const cell = { id, mt, lv: 1 };
    cell.hp = SA.V.maxHp(cell) / 2;
    cell.max = SA.V.maxHp(cell);
    const round = SA.V.decode(encode({ ...payload, ms: [cell] }));
    assert(round && round.migrationStock[0].id === SA.materialId(SA.liveId(id), mt));
    const migrated = round.migrationStock[0];
    assert.strictEqual(migrated.hp, Math.round(SA.V.maxHp(migrated) / 2));
  }
  assert(SA.S.Blueprints.importCode(good), '正常码不能导入');
  const saved = [...memory.entries()], before = JSON.stringify(SA.S.d);
  for (const data of corrupt) {
    assert.strictEqual(SA.V.decode(encode(data)), null, `坏码未拒绝：${JSON.stringify(data)}`);
    assert.strictEqual(SA.S.Blueprints.importCode(encode(data)), null);
    assert.deepStrictEqual([...memory.entries()], saved, '拒绝导入改变了存储');
    assert.strictEqual(JSON.stringify(SA.S.d), before, '拒绝导入改变了玩家存档');
  }
  // 曾经持久化的未知退库件只在读取时隔离；正常蓝图名称、时间和构筑保持完整。
  const key = 'steam_arena_blueprints_v1', bp = { name: '保留蓝图', at: 123, ...SA.V.layout(SA.S.starterVehicle()) };
  memory.set(key, JSON.stringify([null, { ...bp, ms: [{ id: 'missing', hp: 1 }, stock] }, { ...bp, b: [[0.5, 0, 'track']] }]));
  const raw = memory.get(key), mine = SA.S.Blueprints.mine();
  assert.strictEqual(mine.length, 1);
  assert.strictEqual(mine[0].name, bp.name); assert.strictEqual(mine[0].at, bp.at);
  assert.strictEqual(JSON.stringify(mine[0].b), JSON.stringify(bp.b));
  assert.strictEqual(mine[0].ms.length, 1);
  assert.strictEqual(SA.S.Blueprints.plan(mine[0]).requests.filter(x => x.stock).length, 1);
  assert.strictEqual(memory.get(key), raw, '只读加载不应覆盖原始蓝图库');
  assert.strictEqual(SA.S.Blueprints.mine().length, 1, '刷新后污染又阻断了蓝图库');
  // 读取列表只净化原 ms，不能提前执行一次扩格迁移，否则规划时会重复退库。
  const oldPressure = { name: '旧加压舱蓝图', g: 2, a: 2, b: [[0, 0, 'pressure_chamber']], s: [] };
  const direct = SA.S.Blueprints.plan(oldPressure).requests.length;
  memory.set(key, JSON.stringify([oldPressure]));
  assert.strictEqual(SA.S.Blueprints.plan(SA.S.Blueprints.mine()[0]).requests.length, direct, '列表读取使旧蓝图重复退库');
  for (const look of SA.LEG_VARIANTS.filter(x => x.id === 'biped')) {
    const v = SA.V.create('唯一双足');
    v.body[SA.V.chassisRow('biped')][6] = { ...SA.newCell('biped', look.mt), look: look.look, unique: look.key };
    const round = SA.V.decode(SA.V.encode(v));
    assert(round && round.body[SA.V.chassisRow('biped')][6].unique === look.key);
  }
  return { rejected: corrupt.length, unchangedStorage: true, legacyLibrary: true, uniqueBipeds: 9 };
}
module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
