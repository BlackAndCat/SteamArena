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

async function main() {
  const check = evolve.check();
  const parallel = await evolve.parallelCheck();
  const impact = evolve.impactCheck();
  const modules = coverage.run();
  if (modules.found !== modules.total) throw new Error(`模块覆盖不完整：${modules.found}/${modules.total}`);
  const ai = calibration.selfCheck();
  const result = { check: { fingerprint: check.fingerprint, campaign: check.campaign, legalMutations: check.legalMutations, mutationOps: check.mutationOps, share: check.share }, parallel, impact, modules: { total: modules.total, found: modules.found, missing: modules.missing }, ai };
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
