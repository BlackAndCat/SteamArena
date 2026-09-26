/*
 * 进化后台的单命令验收入口。
 *
 * 它串起固定种子、并行模拟、规则影响夹具、模块覆盖、战斗常量和真人摘要自测；
 * 任何一项失败都会以非零退出，供任务 F 或提交前检查调用。
 */
'use strict';

const evolve = require('./evolve');
const coverage = require('./evolve-coverage');
const calibration = require('./ai-calibration');
const battleConstants = require('./battle-constants-check');

function auxiliaryAimCheck() {
  const { SA } = evolve.loadGame();
  const make = id => SA.V.fromAscii(`辅助件检查·${id}`, SA.STARTER.rows, SA.STARTER.sides || [], 1, [], [[8, 12, id]]);
  const base = SA.V.stats(SA.V.fromAscii('辅助件检查·基础', SA.STARTER.rows, SA.STARTER.sides || [], 1));
  const periscope = SA.V.stats(make('periscope'));
  const lens = SA.V.stats(make('boss_lens'));
  const expected = {
    periscope: { aimShrink: SA.K.AIM_SHRINK + 0.1, aimSpeed: SA.K.AIM_SPEED + 0.25 },
    boss_lens: { aimShrink: SA.K.AIM_SHRINK + 0.12, aimSpeed: SA.K.AIM_SPEED + 0.18 },
  };
  for (const [id, stats] of [['periscope', periscope], ['boss_lens', lens]]) {
    const want = expected[id];
    if (Math.abs(stats.aimShrink - want.aimShrink) > 1e-9 || Math.abs(stats.aimSpeed - want.aimSpeed) > 1e-9)
      throw new Error(`${id} 瞄准统计错误：实际 ${stats.aimShrink}/${stats.aimSpeed}，期望 ${want.aimShrink}/${want.aimSpeed}`);
    if (!(stats.aimShrink > base.aimShrink && stats.aimSpeed > base.aimSpeed)) throw new Error(`${id} 没有高于基础瞄准能力`);
  }
  return {
    base: { aimShrink: base.aimShrink, aimSpeed: base.aimSpeed },
    periscope: { aimShrink: periscope.aimShrink, aimSpeed: periscope.aimSpeed },
    bossLens: { aimShrink: lens.aimShrink, aimSpeed: lens.aimSpeed },
  };
}

function chassisRuleCheck() {
  const { SA } = evolve.loadGame();
  const quad = SA.V.fromAscii('整件四足检查', ['........', '........', '........', '..K.....', '..O.....', '..Q.....']);
  const qs = SA.V.stats(quad);
  if (SA.fp('quad').w !== 4 || SA.fp('quad').h !== 2 || (SA.suspPts('quad') || []).join(',') !== '18,78,20,80')
    throw new Error('四足整件尺寸或固定接地点错误');
  if (qs.issues.length || !qs.canDeploy || qs.byId.quad !== 1) throw new Error(`四足整件布局不合法：${JSON.stringify(qs.issues)}`);

  const biped = SA.V.fromAscii('真双足检查', ['........', '........', '........', '..K.....', '..O.....', '..B.....']);
  const bs = SA.V.stats(biped);
  if (SA.fp('biped').w !== 1 || SA.fp('biped').h !== 2 || !['平衡', '前倾', '后仰'].includes(bs.balance) || bs.legs !== '正常')
    throw new Error(`双足平衡或分区初值错误：${JSON.stringify({ balance: bs.balance, legs: bs.legs })}`);
  const invalid = SA.V.create('双足腿区非法检查');
  invalid.body[SA.V.CH][6] = SA.newCell('biped');
  invalid.body[SA.V.CH + 1][6] = SA.newCell('armor');
  if (!SA.V.issues(invalid).some(x => x.reason.includes('腿区'))) throw new Error('双足腿区未拦截普通模块');

  const legacy = SA.V.create('旧底盘迁移检查');
  legacy.body[SA.V.CH][4] = SA.newCell('quad');
  legacy.body[SA.V.CH][5] = SA.newCell('quad');
  const migrated = SA.V.migrate(legacy);
  if (SA.V.countIds(migrated).quad !== 1) throw new Error('旧逐格四足未归一为一个整件');
  // 整件四足可以多件首尾相连（车体蜈蚣），隔着空子要报不合规（2026-09-26 用户决定）
  const chain = SA.V.create('四足相连检查');
  chain.body[SA.V.CH][2] = SA.newCell('quad'); chain.body[SA.V.CH][6] = SA.newCell('quad');
  if (SA.V.issues(chain).some(x => x.reason.includes('四足'))) throw new Error('首尾相连的两件四足被误报不合规');
  const gap = SA.V.create('四足隔空检查');
  gap.body[SA.V.CH][2] = SA.newCell('quad'); gap.body[SA.V.CH][7] = SA.newCell('quad');
  if (!SA.V.issues(gap).some(x => x.reason.includes('隔着空子'))) throw new Error('隔空的四足没有报不合规');
  return { quad: { size: `${SA.fp('quad').w}x${SA.fp('quad').h}`, contactPts: SA.suspPts('quad') }, biped: { balance: bs.balance, legs: bs.legs }, legacyQuadCount: SA.V.countIds(migrated).quad };
}

function uniqueRuleCheck() {
  const { SA } = evolve.loadGame();
  const fresh = SA.S.reset();
  if (!fresh.uniqueClaims || SA.S.hasUnique('boss_ram')) throw new Error('唯一件账本初始化错误');
  const initialClaims = Object.keys(fresh.uniqueClaims).length;
  if (SA.S.buy('boss_ram')) throw new Error('唯一件仍可直接购买');
  const first = SA.Camp.salvageOptions([{ id: 'boss_ram', mt: 4, unique: { id: 'boss_ram', mt: 5, once: true, source: 'salvage' } }]);
  if (first.length !== 1 || first[0].mt !== 5 || !first[0].unique) throw new Error(`唯一件固定材料或缴获候选错误：${JSON.stringify(first)}`);
  if (!SA.S.claimUnique(first[0].unique.id, first[0].mt, 'salvage')) throw new Error('唯一件首次领取失败');
  if (SA.Camp.salvageOptions([{ id: 'boss_ram', mt: 5, unique: { id: 'boss_ram', mt: 5, once: true, source: 'salvage' } }]).length) throw new Error('唯一件重复领取未被拦截');
  if (!SA.isUnique('periscope') || !SA.isUnique('armor_heavy')) throw new Error('支线唯一奖励没有接入唯一件规则');
  return { initialClaims, claimed: SA.S.d.uniqueClaims.boss_ram };
}

function sideRuleCheck() {
  const { SA } = evolve.loadGame();
  const fresh = SA.S.reset();
  if (SA.Camp.sideEntries().length) throw new Error('第一章提前开放支线');
  fresh.camp.ch = 1;
  const entries = SA.Camp.sideEntries();
  if (entries.length !== 2 || entries.some(e => e.prize || e.reward == null)) throw new Error('支线数据或奖励错误');
  if (!entries.every(e => e.settleDamage !== false)) throw new Error('支线战损默认值错误');
  if (!SA.Camp.sideWin(entries[0].id) || SA.Camp.sideWin(entries[0].id)) throw new Error('支线完成记录不是一次性');
  return { available: entries.map(e => e.id), firstWin: entries[0].id };
}

function shareGarageCheck() {
  const { SA } = evolve.loadGame();
  if (typeof SA.S.Cloud.upload !== 'undefined') throw new Error('分享码车库仍保留上传到云端模拟');
  const examples = SA.S.Cloud.list();
  if (!examples.length || examples.some(entry => !SA.V.decode(entry.code))) throw new Error('内置分享码示例无法解码');
  const vehicle = SA.V.fromAscii('分享码车库检查', SA.STARTER.rows, SA.STARTER.sides || []);
  const code = SA.V.encode(vehicle), decoded = SA.V.decode(code);
  if (!decoded || SA.V.encode(decoded) !== code) throw new Error('分享码导出 / 导入往返失败');
  return { examples: examples.length, roundTrip: true };
}

async function main() {
  const check = evolve.check();
  const parallel = await evolve.parallelCheck();
  const impact = evolve.impactCheck();
  const modules = coverage.run();
  if (modules.found !== modules.total) throw new Error(`模块覆盖不完整：${modules.found}/${modules.total}`);
  const ai = calibration.selfCheck();
  const auxiliaryAim = auxiliaryAimCheck();
  const chassis = chassisRuleCheck();
  const unique = uniqueRuleCheck();
  const side = sideRuleCheck();
  const shareGarage = shareGarageCheck();
  const battle = battleConstants.run();
  const result = { check: { fingerprint: check.fingerprint, campaign: check.campaign, legalMutations: check.legalMutations, mutationOps: check.mutationOps, share: check.share }, parallel, impact, modules: { total: modules.total, found: modules.found, missing: modules.missing }, auxiliaryAim, chassis, ai };
  result.unique = unique;
  result.side = side;
  result.shareGarage = shareGarage;
  result.battle = battle;
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
