// 序章教学对手回归：用真实战斗逐帧驱动朴素玩家，检查胜率与可见的开火、驾驶节奏。
'use strict';

const { loadGame, stageFor } = require('./evolve');
const originalRandom = Math.random;
const seeded = seed => {
  let state = seed >>> 0 || 1;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
};

// 正式首关必须启用教学新手 AI，并保留作者配置的低命中率。
{
  const { SA } = loadGame();
  const stage = stageFor(SA, 0, 0), author = SA.StageCars.get(0, 0);
  if (stage.style !== author.style || stage.aim !== author.aim || stage.pilot !== author.pilot)
    throw new Error('正式首关 AI 参数与作者记录不一致');
  if (stage.style !== 'rookie' || stage.aim > 0.15)
    throw new Error('正式首关未启用低命中率的教学新手 AI');
  const player = SA.V.fromAscii('序章起始车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
  const result = SA.Battle.simulate({ p: player, e: stage.vehicle, pAim: 0.8, eAim: stage.aim,
    pStyle: 'wander', eStyle: stage.style, terrain: stage.terrain || 'flat', seed: 17 });
  if (!Number.isFinite(result.t) || !(result.events?.e?.fire > 0) || !Number.isFinite(result.eDealt))
    throw new Error('正式首关 AI 未正常开火或战斗数值无效');
}

function play(seed, moving) {
  // 战斗闭包在加载时捕获随机源；每局重新加载，使同一编号的对局可复现。
  Math.random = seeded(seed);
  let SA;
  try { ({ SA } = loadGame()); } finally { Math.random = originalRandom; }
  const enemy = stageFor(SA, 0, 0);
  // 教学对手的 AI 参数以正式作者关卡记录为准，不在检查脚本里另造一套数值。
  const author = SA.StageCars.get(0, 0);
  if (enemy.style !== author.style || enemy.aim !== author.aim || enemy.pilot !== author.pilot)
    throw new Error('序章首关没有沿用正式作者关卡的 AI 参数');
  const player = SA.V.fromAscii('序章起始车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
  SA.S.reset();
  SA.S.d.vehicle = player;
  SA.go = () => {};
  const B = SA.Battle.startState({ mode: 'friendly', enemyVehicle: enemy.vehicle, enemyName: enemy.name,
    terrain: enemy.terrain || 'flat', aim: enemy.aim, style: enemy.style, boss: enemy.boss });
  const control = seeded(seed + 99001);
  const bias = [(control() - 0.5) * 30, (control() - 0.5) * 24];
  let aim = [0, 0], nextAim = 0, frames = 0, lastX = B.e.x, lastDir = 0, stopped = 0, forward = 0, backward = 0;
  let longestPause = 0, pause = 0, held = 0;
  while (!B.done && B.t < SA.K.BATTLE_TIME + 10 && frames < 30000) {
    const seconds = frames / 60;
    if (seconds >= nextAim) {
      const points = [];
      SA.V.each(B.e.v, (cell, r, c) => {
        if (cell.hp <= 0) return;
        const point = SA.Battle.debug.cellCenter('e', r, c);
        if (point && Number.isFinite(point[0]) && Number.isFinite(point[1])) points.push(point);
      });
      if (points.length) aim = [points.reduce((n, p) => n + p[0], 0) / points.length + bias[0],
        points.reduce((n, p) => n + p[1], 0) / points.length + bias[1]];
      nextAim = seconds + 0.5 + control() * 0.3;
    }
    const phase = seconds % 9;
    B.keys = { left: moving && phase >= 6 && phase < 6.7,
      right: moving && phase >= 2 && phase < 2.7, fire: seconds % 12 < 11 };
    B.aim = aim;
    SA.Battle.debug.step(1 / 60);
    if (B.e.fireHeld) { held++; longestPause = Math.max(longestPause, pause); pause = 0; }
    else pause++;
    const dx = B.e.x - lastX;
    if (dx < -0.1) forward++;
    if (dx > 0.1) backward++;
    if (B.e.dir && lastDir && B.e.dir !== lastDir) stopped++;
    if (B.e.dir) lastDir = B.e.dir;
    lastX = B.e.x;
    frames++;
  }
  longestPause = Math.max(longestPause, pause);
  return { seed, moving, winner: B.e.dead && !B.p.dead ? 'player' : B.p.dead && !B.e.dead ? 'enemy' : 'draw',
    reason: B.p.reason || '', seconds: B.t, enemyDamage: B.e.dealt, enemyShots: B.e.events.fire,
    heldSeconds: held / 60, pauseSeconds: longestPause / 60, forwardFrames: forward,
    backwardFrames: backward, directionChanges: stopped };
}

for (const moving of [false, true]) {
  const rows = Array.from({ length: 20 }, (_, index) => play(index + 1, moving));
  const wins = rows.filter(row => row.winner === 'player').length;
  const sample = rows.find(row => row.enemyShots > 0 && row.pauseSeconds >= 1.5 &&
    row.forwardFrames > 0 && row.backwardFrames > 0 && row.directionChanges > 0);
  console.log(`${moving ? '短移' : '站定'}：玩家 ${wins}/20 胜；敌方均伤 ${(rows.reduce((sum, row) => sum + row.enemyDamage, 0) / 20).toFixed(1)}；失利种子 ${rows.filter(row => row.winner !== 'player').map(row => `${row.seed}(${row.reason || row.winner})`).join('、') || '无'}`);
  if (wins < 19) throw new Error('小提米仍可能频繁战胜朴素新手代理');
  if (!sample) throw new Error('没有观察到实际开火、停火和车辆双向移动');
}
