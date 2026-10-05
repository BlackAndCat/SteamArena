// 完整车间回归：只使用手工夹具和规则校验，不产车、不运行进化或对局。
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evolve = require('./evolve');
const Workbench = require('./workbench-session');

function run() {
  const { SA, context } = evolve.loadGame();
  const plain = value => JSON.parse(JSON.stringify(value));
  const full = { cols: 8, rows: 6 };
  const checkGrid = value => assert.deepEqual(plain(value), full);
  const configFile = path.join(__dirname, '../config/stage-cars.json'), before = fs.readFileSync(configFile);

  // 新档、重开、旧档的小车间和旧车辆 lim 都在规则加载时归一，不依赖打开编辑器。
  SA.S.load();
  checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim);
  const saved = plain(SA.S.d);
  saved.camp.grid = { cols: 4, rows: 3 }; saved.vehicle.lim = { cols: 5, rows: 3 };
  context.localStorage.getItem = () => JSON.stringify(saved);
  SA.S.load();
  checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim); checkGrid(SA.Camp.grid());
  const modules = plain(SA.S.d.camp.mods), material = SA.S.d.camp.mat;
  SA.Camp.applyUnlock({ grid: { cols: 5, rows: 4 } }, true);
  checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim);
  assert.deepEqual(plain(SA.S.d.camp.mods), modules); assert.equal(SA.S.d.camp.mat, material);
  SA.S.d.vehicle.lim = { cols: 4, rows: 3 };
  SA.Camp.syncLim(); checkGrid(SA.S.d.vehicle.lim);
  SA.S.reset(); checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim);

  // 全部实际关与计划关使用同一完整网格，旧地图字段不能重新缩小有效规格。
  let stages = 0, planned = 0, unconfigured = 0;
  SA.CAMPAIGN.forEach((chapter, ci) => chapter.stages.forEach((stage, si) => {
    if (stage.unfinished) return;
    checkGrid(evolve.stageSpec(SA, ci, si).grid);
    checkGrid(SA.Camp.stage(ci, si).vehicle.lim); stages++;
  }));
  SA.CAMPAIGN_MAP.chapters.forEach((chapter, ci) => chapter.stages.forEach((stage, si) => {
    try { checkGrid(evolve.previewStageSpec(SA, ci, si).grid); planned++; }
    catch (error) {
      // 未来关卡缺奖励或材料仍拒绝生成，不以开放网格为由补造其他配置。
      if (error.code !== 'EVOLVE_STAGE_CONFIG_MISSING') throw error;
      unconfigured++;
    }
  }));

  // 整体移到旧限位之外仍保留原四件模块与连接，作为满格边缘的合法夹具。
  const cells = SA.StageCars.cellsOf(SA.S.starterVehicle()).map(cell => [cell[0], cell[1], cell[2] - 7, ...cell.slice(3)]);
  const edge = SA.V.fromCells('AI生成·满格回归夹具', cells);
  checkGrid(edge.lim); assert(SA.V.stats(edge).canDeploy);
  const spec = { grid: full, allowedModules: cells.map(cell => cell[3]), allowedMaterials: [1], mat: 1,
    requiredModules: [], budget: SA.V.stats(edge).value };
  assert(evolve.legalVehicle(SA, edge, spec));
  const conditions = evolve.constructionConditions(SA, edge, spec);
  assert(Object.values(conditions).every(Boolean));
  assert(!evolve.constructionConditions(SA, edge, { ...spec, budget: spec.budget - 1 }).budget);
  assert(!evolve.constructionConditions(SA, edge, { ...spec, allowedModules: ['track'] }).modulePool);
  assert(!evolve.constructionConditions(SA, edge, { ...spec, allowedMaterials: [2] }).materials);
  assert(!evolve.constructionConditions(SA, edge, { ...spec, requiredModules: ['harpoon'] }).reward);
  assert(!SA.V.placeCheck(edge, 'boiler', 8, SA.K.COLS - 1).ok, '跨右边界仍拒绝');
  assert(!SA.V.placeCheck(edge, 'boiler', SA.K.ROWS - 1, 4).ok, '跨底边界仍拒绝');
  const overflow = SA.V.clone(edge); overflow.body[8][15] = SA.newCell('boiler');
  assert(!evolve.constructionConditions(SA, overflow, spec).grid);
  const broken = SA.V.fromCells('无动力夹具', cells.filter(cell => cell[3] !== 'boiler_s'));
  assert(!evolve.constructionConditions(SA, broken, spec).construction);

  // 底层显式限位仍可供工具负例使用，实际加载与工作台输入则解除旧限位。
  const legacy = SA.V.clone(edge); legacy.lim = { cols: 4, rows: 3 };
  assert(!SA.V.stats(legacy).canDeploy);
  checkGrid(SA.V.migrate(legacy).lim);
  assert(SA.V.stats(legacy).canDeploy);
  checkGrid(Workbench.parseVehicle(JSON.stringify({ name: edge.name, cells, lim: { cols: 5, rows: 3 } }), '', SA).lim);
  // 使用已发布的序章首关，避免回归依赖用户尚未提交的新关卡记录。
  SA.Camp.dev.loadStageCar(0, 0); checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim);
  SA.UI.topbar = () => {}; // 无画面规则回归不初始化界面像素资源。
  SA.Camp.dev.exitDesign(); checkGrid(SA.S.d.camp.grid); checkGrid(SA.S.d.vehicle.lim);
  assert(before.equals(fs.readFileSync(configFile)), '不能改写用户手工关卡数据');
  assert.equal(SA.K.COLS, 16); assert.equal(SA.K.ROWS, 12);
  return { grid: full, subgrid: [16, 12], stages, planned, unconfigured, oldSave: true,
    legacyReward: true, edgeLegal: true, physicalOverflowRejected: true, otherRulesPreserved: true };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
