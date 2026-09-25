'use strict';

// 关卡车进化生成器的算法参数。这里的参数只控制搜索策略和报告权重，
// 不直接修改战斗规则；战斗数值和用户已经拍板的门槛仍以 docs/evolve-plan.md 为准。
module.exports = {
  rulesVersion: 'evolve-p0-2026-09-25',
  population: {
    size: 24,
    generations: 4,
    freshRate: 0.2,
    survivors: 0.35,
    mutationAttempts: 8,
  },
  evaluation: {
    quickGames: 6,
    archiveGames: 40,
    anchorCount: 6,
    eloStart: 1000,
    eloK: 32,
  },
  archive: {
    cellsPerBucket: 3,
    performanceWeight: 0.35,
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
  budget: {
    startingMoney: 300,
    prizeKeepRate: 0.8,
    repairReserve: 0.2,
    bossMultiplier: 1.3,
  },
};
