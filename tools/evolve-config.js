'use strict';
const os = require('node:os');

// 关卡车进化生成器的算法参数。这里的参数只控制搜索策略和报告权重，
// 不直接修改战斗规则；战斗数值和用户已经拍板的门槛仍以 docs/evolve-plan.md 为准。
module.exports = {
  rulesVersion: 'evolve-stage-diversity-2026-10-03',
  // 默认最多使用八个逻辑处理器；明确传入 workers 时仍以调用者设置为准。
  defaultWorkers: Math.max(1, Math.min(8, os.availableParallelism?.() || os.cpus?.().length || 1)),
  maxWorkers: 14, // 手动并行数的统一上限；默认值保持为已测过的八线程上限。
  population: {
    size: 24,
    generations: 4,
    freshRate: 0.2,
    survivors: 0.35,
    mutationAttempts: 8,
    maxExtraGenerations: 2,
    maxFreshRate: 0.5,
    maxStructuralMutations: 3,
  },
  evaluation: {
    quickGames: 6,
    archiveGames: 40,
    anchorCount: 6,
    // 双向配对轮数：60 轮＝双方各 60 场，共 120 场；报告 games 记实际 120 场。
    finalDuelGames: 60,
    eloStart: 1000,
    eloK: 32,
  },
  archive: {
    cellsPerBucket: 3,
    terrainDeltaMin: 20,
    terrainPerformanceMin: 45,
    oddFraction: 0.05,
    toxicTopFraction: 0.2,
    toxicPerformanceBelow: 35,
  },
  performance: {
    base: 40,
    hitRate: 12,
    chargedHit: 5,
    closeCombat: 12,
    collision: 8,
    terrain: 8,
    dismantle: 8,
    clean: 10,
    tempo: 7,
    reversal: 5,
    ownHeatDeath: -20,
    enemyHeatDeath: -12,
    timeout: -8,
    draw: -10,
    distantInefficient: -20,
    noEngage: -10,
  },
  // 强度优先，节约只按造价计分；不奖励减少实体件数。
  ranking: { efficiencyWeight: 0.2, strengthWeight: 0.8 },
  difficulty: { min: 0.6, max: 0.75 },
  diversity: { similarAt: 0.85, minClusterRatio: 0.5, maxClusterShare: 0.4, finalMinClusters: 3 },
  reward: {
    effectMin: 1,
    controlDelta: 0.1,
  },
};
