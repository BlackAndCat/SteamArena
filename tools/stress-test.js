/*
 * 随机无画面压力测试。
 *
 * 本脚本只调用游戏已有的 Node VM 入口、车辆校验和 Battle.simulate，不复制一套
 * 近似战斗规则。每局都使用固定种子，报告中的种子可以直接复现异常。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const evolve = require('./evolve');

class RNG {
  constructor(seed) { this.state = (Number(seed) >>> 0) || 1; }
  next() {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * Math.max(1, n)); }
  pick(items) { return items[this.int(items.length)]; }
  chance(rate) { return this.next() < rate; }
}

function assertFinite(value, label) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} 出现 NaN/Infinity`);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFinite(child, `${label}.${key}`);
  }
}

function collectModules(SA, vehicle, target) {
  SA.V.each(vehicle, cell => target.add(cell.id));
}

function vehicleForModule(SA, specs, id, rng) {
  const choices = specs.filter(spec => spec.availableMods.includes(id));
  for (const spec of choices) for (let attempt = 0; attempt < 32; attempt++) {
    const vehicle = evolve.randomVehicle(SA, spec, rng, id);
    if (!vehicle) continue;
    const stats = SA.V.stats(vehicle);
    if (stats.canDeploy && !stats.issues.length && stats.byId[id]) return { vehicle, spec };
  }
  return null;
}

function randomizeUpgrades(SA, vehicle, rng) {
  // 改装等级不改变摆放规则，但会改变耐久和价值；压力测试把 0～UP_MAX 都实际带入过局。
  SA.V.each(vehicle, cell => {
    if (rng.next() >= 0.35) return;
    const previousLv = cell.lv || 0, previousHp = cell.hp;
    cell.lv = rng.int(Number(SA.K.UP_MAX || 3) + 1);
    cell.hp = SA.V.maxHp(cell);
    // 升级增加重量；若这一格让原本合法的车超重，回滚这一格，避免把生成器
    // 的随机改装误报成游戏规则缺陷。
    if (!SA.V.stats(vehicle).canDeploy) { cell.lv = previousLv; cell.hp = previousHp; }
  });
}

function chassisFixtures(SA) {
  // 真双足由生成器在合法规格中生成，确认 2×4 子格与腿区规则。关卡布局 4 以后没有关卡开放双足，
  // 在第一章第 3 关的模块池里临时加上双足。
  const last = evolve.stageSpec(SA, 1, 2), bipedSpec = { ...last, availableMods: [...last.availableMods, 'biped'] };
  const biped = evolve.randomVehicle(SA, bipedSpec, new RNG(9026), 'biped');
  if (!biped || !SA.V.stats(biped).canDeploy) throw new Error('真双足夹具无法生成合法车');

  // 两件四足使用 Q.Q：每件 4×2 子格，首尾相连且没有空子格；其余模块放在上方。
  const quad = SA.V.fromAscii('四足蜈蚣夹具', [
    '........', '........', '..C.....', '..K.....', '..OW....', 'Q.Q.....',
  ]);
  const stats = SA.V.stats(quad);
  if (!stats.canDeploy || stats.byId.quad !== 2 || stats.issues.length) throw new Error(`四足相连夹具非法：${JSON.stringify(stats.issues)}`);
  return { biped, quad };
}

function legacyFixture(SA) {
  const body = Array.from({ length: 6 }, () => Array(8).fill(null));
  body[5][3] = { id: 'track', mt: 1, hp: 200 };
  body[4][3] = { id: 'helmet', mt: 1, hp: 90 };
  body[3][3] = { id: 'boiler', mt: 1, hp: 100 };
  const migrated = SA.V.migrate({ name: '压力测试旧存档', body, side: [] });
  if (!migrated || !migrated.body || migrated.body.length !== SA.K.ROWS) throw new Error('旧存档迁移失败');
  return migrated;
}

function writeReport(report) {
  // tools/out 由仓库 .gitignore 管理；在受限沙箱里不可写时回退到 tools 根目录，
  // 这样压力测试仍能完成，正式环境会优先得到 tools/out/stress-*.json。
  const outDir = path.join(__dirname, 'out');
  const name = `stress-${report.seed}-${report.requested}.json`;
  let file = path.join(outDir, name);
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  } catch (error) {
    file = path.join(__dirname, 'stress-report.json');
    fs.writeFileSync(file, JSON.stringify({ ...report, outputError: error.code || String(error) }, null, 2), 'utf8');
  }
  return file;
}

function main() {
  const requested = Math.max(1, Number(process.argv[2] || 10000));
  const seed = Number(process.argv[3] || 20260927);
  const { SA } = evolve.loadGame();
  const rng = new RNG(seed);
  const styles = ['wander', 'rush', 'kite', 'turtle'];
  const terrains = SA.TERRAIN_ORDER.slice();
  const specs = [];
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) specs.push(evolve.stageSpec(SA, chapter, stage));
  }
  const report = {
    version: 2, seed, requested, completed: 0, errors: [],
    counts: { timeout: 0, overLimit: 0, stuck: 0, bounds: 0, durability: 0, nonFinite: 0, outOfArena: 0, shareMismatch: 0, migration: 0, illegal: 0 },
    coverage: { modules: [], missingModules: [], terrains: [], styles: [], materials: [], upgrades: [], chassis: [], fixtures: {} },
    maxBattleSeconds: 0,
  };
  const actualModules = new Set(), actualTerrains = new Set(), actualStyles = new Set(), actualMaterials = new Set(), actualUpgrades = new Set(), actualChassis = new Set();

  // 先用专门夹具验证真双足和四足多件相连都能进入无画面对打。
  try {
    const fixtures = chassisFixtures(SA);
    for (const [name, vehicle] of Object.entries(fixtures)) {
      const opponent = evolve.randomVehicle(SA, evolve.stageSpec(SA, 1, 2), new RNG(seed + name.length));
      const result = SA.Battle.simulate({ p: vehicle, e: opponent, terrain: 'flat', pStyle: 'wander', eStyle: 'rush', seed: seed + 70000 + name.length });
      assertFinite(result, `夹具 ${name}`);
      report.coverage.fixtures[name] = { winner: result.winner, seconds: result.t, issues: SA.V.stats(vehicle).issues };
      collectModules(SA, vehicle, actualModules);
    }
  } catch (error) {
    report.errors.push({ seed: seed + 70000, category: 'chassis', message: error.message });
  }

  // 每个可部署模块至少强制尝试一次；之后再按随机规格大量生成构筑。
  // 关卡布局 4 删掉后面的关以后，不少模块暂时没有解锁档位：单独列出，不算缺失
  const tiered = new Set(specs.flatMap(spec => spec.availableMods));
  const deployableIds = Object.keys(SA.MODULES).filter(id => !SA.MODULES[id].retired && tiered.has(id));
  report.coverage.untiered = Object.keys(SA.MODULES).filter(id => !SA.MODULES[id].retired && !tiered.has(id)).sort();
  for (const id of deployableIds) {
    const forced = vehicleForModule(SA, specs, id, rng);
    if (!forced) report.coverage.missingModules.push(id);
    else {
      collectModules(SA, forced.vehicle, actualModules);
      actualMaterials.add(forced.spec.mat);
      actualChassis.add(Object.keys(SA.V.countIds(forced.vehicle)).find(x => SA.MODULES[x]?.layer === 'chassis') || '');
    }
  }

  for (let i = 0; i < requested; i++) {
    const gameSeed = seed + i;
    try {
      const spec = specs[rng.int(specs.length)];
      const a = evolve.randomVehicle(SA, spec, rng);
      const b = evolve.randomVehicle(SA, spec, rng);
      if (!a || !b) throw new Error('随机合法车生成失败');
      randomizeUpgrades(SA, a, rng); randomizeUpgrades(SA, b, rng);
      const sa = SA.V.stats(a), sb = SA.V.stats(b);
      if (!sa.canDeploy || !sb.canDeploy || sa.issues.length || sb.issues.length) {
        report.counts.illegal++;
        throw new Error(`随机车未通过出战检查：${JSON.stringify({ a: sa.issues, b: sb.issues })}`);
      }
      collectModules(SA, a, actualModules); collectModules(SA, b, actualModules);
      actualMaterials.add(spec.mat);
      for (const vehicle of [a, b]) SA.V.each(vehicle, cell => actualUpgrades.add(cell.lv || 0));
      for (const vehicle of [a, b]) {
        const chassis = Object.keys(SA.V.countIds(vehicle)).find(id => SA.MODULES[id]?.layer === 'chassis');
        if (chassis) actualChassis.add(chassis);
      }
      const terrain = rng.pick(terrains), pStyle = rng.pick(styles), eStyle = rng.pick(styles);
      actualTerrains.add(terrain); actualStyles.add(pStyle); actualStyles.add(eStyle);
      const result = SA.Battle.simulate({ p: a, e: b, terrain, pStyle, eStyle, seed: gameSeed });
      try { assertFinite(result, '战斗结果'); } catch (error) { report.counts.nonFinite++; throw error; }
      report.maxBattleSeconds = Math.max(report.maxBattleSeconds, result.t || 0);
      // result.timeout 是正常的 60/40 超时判定；只有超过战斗时限加结束动画缓冲才算卡死。
      if (result.timeout) report.counts.timeout++;
      if (result.t > Number(SA.K.BATTLE_TIME) + 10) report.counts.overLimit++;
      if (!result.winner || result.t <= 0) report.counts.stuck++;
      if (!Number.isFinite(result.pDealt) || !Number.isFinite(result.eDealt) || result.pDealt < 0 || result.eDealt < 0) report.counts.durability++;
      for (const side of ['p', 'e']) {
        const state = result.state && result.state[side];
        if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.hp) || state.hp < -1e-6 || state.hp > 1 + 1e-6) report.counts.outOfArena++;
      }
      for (const side of ['p', 'e']) {
        const event = result.events && result.events[side];
        if (event && (event.minWater < -1e-6 || event.maxHeat > SA.V.stats(side === 'p' ? a : b).heatMax + 1 || event.maxHeat < -1e-6)) report.counts.bounds++;
      }
      const code = SA.V.encode(a), decoded = SA.V.decode(code);
      if (!decoded || SA.V.encode(decoded) !== code) { report.counts.shareMismatch++; throw new Error('分享码往返不一致'); }
      legacyFixture(SA);
      report.completed++;
    } catch (error) {
      report.errors.push({ seed: gameSeed, message: error.message });
      if (report.errors.length >= 100) break;
    }
  }

  report.coverage.modules = [...actualModules].sort();
  report.coverage.missingModules = [...new Set(report.coverage.missingModules)].sort();
  report.coverage.terrains = [...actualTerrains].sort();
  report.coverage.styles = [...actualStyles].sort();
  report.coverage.materials = [...actualMaterials].sort((a, b) => a - b);
  report.coverage.upgrades = [...actualUpgrades].sort((a, b) => a - b);
  report.coverage.chassis = [...actualChassis].filter(Boolean).sort();
  const file = writeReport(report);
  console.log(JSON.stringify({ file, requested, completed: report.completed, errors: report.errors.length, counts: report.counts, coverage: report.coverage, maxBattleSeconds: report.maxBattleSeconds }, null, 2));
  if (report.errors.length || report.coverage.missingModules.length) process.exitCode = 1;
}

main();
