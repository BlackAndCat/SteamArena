/* 进化生成器的单局并行 worker：每个 worker 自己加载一份游戏规则，避免共享可变战斗状态。 */
'use strict';

const { parentPort } = require('worker_threads');
const evolve = require('./evolve');
const config = require('./evolve-config');

const { SA } = evolve.loadGame();

parentPort.on('message', task => {
  try {
    if (task.kind === 'evaluate') {
      config.performance = task.performance;
      const result = evolve.evaluateCandidate(SA, task.vehicle, task.opponents, task.spec, task.seed, task.games);
      parentPort.postMessage({ id: task.id, result });
      return;
    }
    const p = SA.V.decode(task.p), e = SA.V.decode(task.e);
    if (!p || !e) throw new Error('worker 无法解码候选车');
    const result = SA.Battle.simulate({ ...task.options, p, e });
    parentPort.postMessage({ id: task.id, result });
  } catch (error) {
    parentPort.postMessage({ id: task.id, error: error.message });
  }
});
