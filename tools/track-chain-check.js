/* 履带连续性回归：隔空的两段不能通过摆放或出战检查，车身桥接也不能替代履带连接。 */
'use strict';
const assert = require('assert');
const { loadGame } = require('./evolve');

function run() {
  const { SA } = loadGame(), row = SA.V.chassisRow('track');
  const vehicle = SA.V.fromCells('履带连接夹具', [
    [0, row, 4, 'track', 1, 0], [0, row - 2, 4, 'boiler', 1, 0],
    [0, row - 3, 4, 'helmet', 1, 0], [0, row - 2, 6, 'water', 1, 0],
  ]);
  assert(SA.V.canPut(vehicle, 'track', row, 6).fit, '相邻履带应允许首尾相接');
  assert(!SA.V.canPut(vehicle, 'track', row, 8).fit, '隔空履带被错误标记为合规');
  vehicle.body[row][8] = SA.newCell('track', 1);
  assert(SA.V.issues(vehicle).some(issue => issue.reason.includes('首尾相连')), '出战检查漏掉隔空履带');
  assert(!SA.V.stats(vehicle).canDeploy, '隔空履带仍能出战');
  // 上层跨过空缺且两段都连接到主体，也必须报告底盘本身断开。
  vehicle.body[row - 2][8] = SA.newCell('armor', 1);
  assert(SA.V.issues(vehicle).some(issue => issue.reason.includes('首尾相连')), '主体桥接绕过了履带连接规则');
  const decoded = SA.V.decode(SA.V.encode(vehicle));
  assert.strictEqual(SA.V.countIds(decoded).track, 1, '分享码导入不应保留无法合法摆放的隔空履带');
  vehicle.body[row][6] = SA.newCell('track', 1);
  assert(!SA.V.issues(vehicle).some(issue => issue.reason.includes('首尾相连')), '填补履带空缺后仍报断开');
  assert(SA.V.stats(vehicle).canDeploy, '连续履带车应可出战');
  SA.V.remove(vehicle, 'body', row, 6);
  assert(!SA.V.stats(vehicle).canDeploy, '拆除中段后未重新拦截');
  return { placementRejectsGap: true, deploymentRejectsGap: true, bodyBridgeRejected: true, importedGapRejected: true, continuousAccepted: true, removalRechecked: true };
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
