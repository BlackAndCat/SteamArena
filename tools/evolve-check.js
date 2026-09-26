/*
 * 进化后台的单命令验收入口。
 *
 * 它串起固定种子、并行模拟、规则影响夹具、模块覆盖和真人摘要自测；
 * 任何一项失败都会以非零退出，供任务 F 或提交前检查调用。
 */
'use strict';

const evolve = require('./evolve');
const coverage = require('./evolve-coverage');
const calibration = require('./ai-calibration');

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

async function main() {
  const check = evolve.check();
  const parallel = await evolve.parallelCheck();
  const impact = evolve.impactCheck();
  const modules = coverage.run();
  if (modules.found !== modules.total) throw new Error(`模块覆盖不完整：${modules.found}/${modules.total}`);
  const ai = calibration.selfCheck();
  const auxiliaryAim = auxiliaryAimCheck();
  const result = { check: { fingerprint: check.fingerprint, campaign: check.campaign, legalMutations: check.legalMutations, mutationOps: check.mutationOps, share: check.share }, parallel, impact, modules: { total: modules.total, found: modules.found, missing: modules.missing }, auxiliaryAim, ai };
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
