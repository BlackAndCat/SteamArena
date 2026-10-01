/* 首关奖励与教程回归：真实存档规则在独立 VM 中运行，不写用户存档。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('./evolve');
const source = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function run() {
  const { SA, context } = loadGame(), memory = new Map();
  context.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  SA.S.reset();
  assert.deepStrictEqual(Object.keys(SA.S.d.inv), [], '新档仍预置了装甲或机炮');
  const first = SA.Camp.stage(0, 0);
  assert.strictEqual(first.rewardItems?.[0]?.id, 'tank_s');
  assert.strictEqual(first.rewardItems[0].mt, 1);
  assert(/小水罐/.test(first.unlock.note) && !/机炮|铁装甲/.test(first.unlock.note), '手工关卡旧备注仍误导首胜奖励');
  const result = SA.Camp.win();
  assert(result.lines.some(line => /小水罐/.test(line)));
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '首胜未实发一只小水罐');
  assert.strictEqual(SA.S.d.camp.rewardClaims['0:0:tank_s'], true);
  SA.S.save(); SA.S.load(); SA.Camp.backfill(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '刷新后重复发首关奖励');

  // 旧玩家库存保留；补发记号保存后，重新加载仍只补一次。
  SA.S.reset();
  SA.S.d.inv = { armor: 4, mg: 1 };
  SA.S.d.camp.st = 1;
  SA.S.save(); SA.S.load(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1);
  assert.strictEqual(SA.S.d.inv.armor, 4);
  assert.strictEqual(SA.S.d.inv.mg, 1);
  SA.S.load(); SA.Camp.backfill();
  assert.strictEqual(SA.S.d.inv.tank_s, 1, '旧档补发未幂等');

  // 重打是友谊赛结算，不会调用 Camp.win() 发固定奖励。
  const beforeReplay = SA.S.d.inv.tank_s;
  SA.S.settleBattle({ mode: 'campaign', replay: true, win: true, enemyName: '小提米' });
  assert.strictEqual(SA.S.d.inv.tank_s, beforeReplay);

  vm.runInContext(source('story.js'), context, { filename: 'js/story.js' });
  const parts = SA.STORY.tutorial.parts;
  assert.deepStrictEqual(Array.from(parts, p => p.part), ['cockpit', 'track', 'boiler', 'mg']);
  const starterIds = SA.V.countIds(SA.S.starterVehicle());
  for (const id of ['helmet', 'track', 'boiler_s', 'mg_s']) assert(starterIds[id] > 0, `初始车缺教程目标 ${id}`);
  // 按页面顺序接上画面层并真正开始第一关，读取运行时生成的四个箭头。
  SA.Scenes = { pick: () => ({}) };
  SA.Story = { tutorial: () => SA.STORY.tutorial, talk: () => ({ close() {} }) };
  SA.go = () => {};
  vm.runInContext(source('battle-view.js'), context, { filename: 'js/battle-view.js' });
  vm.runInContext(source('battle.js'), context, { filename: 'js/battle.js' });
  SA.S.d.vehicle = SA.S.starterVehicle();
  SA.Battle.start({ mode: 'campaign', enemyVehicle: first.vehicle, enemyName: first.name, terrain: first.terrain || 'flat' });
  const battle = SA.Battle.debug.B, arrows = battle.intro?.arrows || [];
  assert.deepStrictEqual(Array.from(arrows, a => a.part), ['cockpit', 'track', 'boiler', 'mg']);
  const targetId = { cockpit: 'helmet', track: 'track', boiler: 'boiler_s', mg: 'mg_s' };
  for (const arrow of arrows) {
    let own;
    SA.V.each(battle.p.v, (cell, r, c) => { if (!own && cell.id === targetId[arrow.part]) own = { r, c }; });
    assert(own, `玩家缺少 ${arrow.part}`);
    const [px, py] = SA.Battle.debug.cellCenter('p', own.r, own.c);
    assert(Math.abs(arrow.mx - px) < 1e-6 && Math.abs(arrow.my - py) < 1e-6, `${arrow.part} 箭头没有指向玩家模块`);
  }
  const editor = source('editor.js'), help = editor.slice(editor.indexOf('function openHelp() {'), editor.indexOf('// ---------- 绘制 ----------'));
  assert.strictEqual((help.match(/h\('p',/g) || []).length, 3, '车间帮助不是三条');
  assert(/左键/.test(help) && /右键/.test(help) && /出战/.test(help) && /按住左键稳住准星/.test(help));
  return { firstReward: SA.S.d.inv.tank_s, legacyBackfillOnce: true, tutorialParts: parts.length, helpItems: 3 };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
