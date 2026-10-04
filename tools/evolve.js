/*
 * 关卡车进化生成器（Node 无界面入口）。
 *
 * 这个文件只负责后台搜索和报告，不直接替换 js/content.js 的关卡车。
 * 游戏脚本通过一个很小的 DOM / Canvas 桩在 Node VM 中加载，因此生成器调用的
 * 仍然是实际的 SA.V 校验、SA.V.stats 和 SA.Battle.simulate，而不是第二套规则。
 *
 * 用法：
 *   node tools/evolve.js --check       检查种子可复现、规则指纹和合法构筑
 *   node tools/evolve.js --sample      小规模试跑，结果写入 tools/out/
 *   node tools/evolve.js --sample 2 3  2 个章节、每档 3 个候选的快速试跑
 *   node tools/evolve.js --first-stage [种子]  只预演第一关，不替换战役或候选车库
 *   node tools/evolve.js --first-two-stages [种子]  按已确认预算预演前两关
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const os = require('os');
const { Worker } = require('worker_threads');
const config = require('./evolve-config');
const stageRules = require('./evolve-stage-rules.json');
const storage = require('./evolve-storage');
const { createEvaluationPool } = require('./evolve-pool');
const { install: installConfig } = require('./config-node');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'out');
// 指纹只纳入后台规则文件；视觉拆分文件不会让候选车报告失效。
const RULE_FILES = ['js/modules.js', 'js/vehicle.js', 'js/content.js', 'js/state.js', 'js/camp.js', 'js/battle.js', 'tools/campaign-map.js', 'tools/evolve-stage-rules.json', 'tools/evolve-config.js',
  ...fs.readdirSync(path.join(ROOT, 'config')).filter(name => name.endsWith('.json')).sort().map(name => `config/${name}`)];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------- Node VM：只补游戏脚本启动所需的最小浏览器接口 ----------
function noop() {}

function context2d() {
  // 新材质读取会取画布像素；测试环境只需提供等长的透明像素缓冲。
  const base = { canvas: null, measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      if (['globalAlpha', 'lineWidth', 'fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline', 'imageSmoothingEnabled'].includes(key)) return 1;
      return noop;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}

function element(tag = 'div') {
  const out = {
    tagName: tag.toUpperCase(), style: {}, className: '', classList: { add: noop, remove: noop, toggle: noop }, children: [],
    appendChild(value) { this.children.push(value); return value; }, append(...values) { this.children.push(...values); },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    remove: noop, focus: noop, blur: noop, click: noop, innerHTML: '', textContent: '', value: '', checked: false,
    disabled: false, width: 0, height: 0, isConnected: true,
    getContext: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  };
  if (tag === 'canvas') {
    out.getContext = () => { const ctx = context2d(); ctx.canvas = out; return ctx; };
    out.toDataURL = () => '';
  }
  return out;
}

function createGameContext(contextify = false) {
  const document = {
    addEventListener: noop, removeEventListener: noop,
    createTextNode: value => ({ textContent: String(value) }), createElement: element,
    querySelector: () => element(), querySelectorAll: () => [], body: element('body'), documentElement: element('html'),
  };
  // 使用普通全局对象，让战斗循环中的 Math / SA 访问可被 V8 优化。
  // 仍在独立 VM 内逐文件加载原规则；旧 Node 缺少该常量时沿用默认上下文。
  const context = vm.createContext(contextify ? {} : vm.constants?.DONT_CONTEXTIFY);
  Object.assign(context, {
    addEventListener: noop, removeEventListener: noop, console, document, window: null, globalThis: null,
    // 界面初始化会读取视口尺寸；无画面生成器只提供固定尺寸，不执行界面交互。
    innerWidth: 1000, innerHeight: 600,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop }, requestAnimationFrame: noop, cancelAnimationFrame: noop,
    performance: { now: () => 0 }, Image: function Image() {}, navigator: {}, location: { href: 'http://localhost:5173/tools/evolve.html' },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, JSON, Date, Array, Object, Number, String, Boolean,
    RegExp, Error, parseInt, parseFloat, isFinite, Uint8Array, Float32Array, Int32Array, Math,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
  });
  context.Node = function Node() {};
  context.window = context;
  context.globalThis = context;
  return context;
}

// contextify 只供运行环境差分检查恢复旧路径；正式预演和 worker 默认使用普通全局对象。
function loadGame({ contextify = false } = {}) {
  const context = createGameContext(contextify);
  installConfig(context, ROOT);
  // Node 诊断只需要规则层；不加载 battle-view，避免 debug.step 的无画面检查误触发精灵绘制。
  // 浏览器页面仍按 index / tools/sim.html 的脚本顺序加载 battle-view.js。
  const files = ['js/palette.js', 'js/modules.js', 'js/module-art.js', 'js/dynamics.js', 'js/sprites.js', 'js/legs.js', 'js/vehicle.js',
    'js/content.js', 'tools/campaign-map.js', 'js/build-sys.js', 'js/stage-cars.js', 'js/state.js', 'js/ui.js', 'js/camp.js', 'js/camp-ui.js', 'js/terrain-art.js', 'js/battle.js'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return { context, SA: context.SA };
}

// 取得一关实际会使用的车辆：手工记录优先，原始内容作为回退。
function stageFor(SA, chapter, stage) {
  if (SA.Camp?.stage) return SA.Camp.stage(chapter, stage);
  const base = SA.CAMPAIGN[chapter]?.stages?.[stage];
  if (!base || base.unfinished) return null;
  const merged = SA.StageCars ? SA.StageCars.merge(base, chapter, stage) : { ...base, source: 'original', locked: false };
  if (!merged.vehicle) merged.vehicle = SA.V.fromAscii(merged.name, merged.rows, merged.sides || [], merged.mt || 1, merged.elite || [], merged.subs || []);
  return merged;
}

function manualCandidateRecord(SA, stage, chapter, index, fingerprint) {
  const vehicle = stage.vehicle, stats = SA.V.stats(vehicle), rec = stage.stageCar || {};
  return {
    name: stage.name, code: SA.V.encode(vehicle), cells: SA.StageCars.cellsOf(vehicle),
    style: stage.style || 'wander',
    spec: { chapter, stage: index, terrain: stage.terrain || 'flat', rewardModule: stage.spec?.reward || null },
    source: 'manual', locked: stage.locked !== false, manualVersion: rec.updatedAt || rec.version || null,
    rules: fingerprint, strength: stats.rating, performance: null,
    stats: { rating: stats.rating, value: stats.value, hp: stats.hp, dps: stats.dps, heatDps: stats.heatDps, water: stats.water, cool: stats.cool },
  };
}

// 对象键排序后再序列化，确保同一规则在不同 Node 版本中得到同一输入。
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

// 锁定的手工构筑保留原样；缺奖励时只标记不合格，不把它当作合规入选车。
function lockedStageReport(entry, selectionFailures, SA, reference = null, seed = 0, duelCache = null) {
  const { spec, records } = entry;
  const required = spec.requiredModules || (spec.rewardModule ? [spec.rewardModule] : []);
  const reward = required.every(id => records[0].cells.some(cell => cell[3] === id));
  const vehicle = SA?.V.fromCells(records[0].name, records[0].cells);
  if (vehicle) vehicle.lim = { ...spec.grid };
  const conditions = vehicle ? constructionConditions(SA, vehicle, spec) : { construction: false, reward };
  const validation = reference?.vehicle && vehicle && Object.values(conditions).every(Boolean) ? duel(SA, vehicle, reference.vehicle,
    { ...spec, style: records[0].style, referenceStyle: reference.style || 'wander' }, seed + 100000000,
    config.evaluation.finalDuelGames, duelCache) : null;
  const target = !reference || !!validation && difficultyDistance(validation.winRate) === 0;
  const hardConditions = { ...conditions, reward, target };
  const failed = Object.entries(hardConditions).filter(([, pass]) => !pass).map(([key]) => key);
  if (failed.length) selectionFailures.push({ chapter: spec.chapter, stage: spec.stage, name: spec.name, failed });
  return { spec, count: 0, selected: failed.length ? null : records[0], source: 'manual', locked: true,
    selection: { locked: true, status: failed.length ? '手工锁定车不符合本关生成约束，保留原车待修改' : '手工锁定，未改动', candidateCount: 0,
      previousWinRate: validation?.winRate ?? null, previousGames: validation?.n ?? 0,
      previousWins: validation?.wins ?? 0, previousDraws: validation?.draws ?? 0,
      previousStyle: reference?.style || null, validationSeed: validation ? seed + 100000000 : null,
      hardConditions, failed },
    top: records, archive: entry.archive };
}

function ruleFingerprint(SA) {
  const source = RULE_FILES.map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]);
  const payload = stable({
    version: config.rulesVersion,
    gameVersion: SA.RULES_VERSION || null,
    constants: SA.K,
    modules: SA.MODULES,
    terrains: SA.TERRAINS,
    campaigns: SA.CAMPAIGN.map(ch => ({ name: ch.name, unlock: ch.unlock, stages: ch.stages.map(s => ({ name: s.name, terrain: s.terrain, spec: s.spec, uniqueLoot: s.uniqueLoot, unlock: s.unlock, boss: !!s.boss })) })),
    source,
  });
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

// ---------- 可复现随机数 ----------
class RNG {
  constructor(seed = 1) { this.state = (Number(seed) >>> 0) || 1; }
  next() { this.state = (this.state + 0x6D2B79F5) | 0; let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n) { return Math.floor(this.next() * Math.max(1, n)); }
  pick(list) { return list.length ? list[this.int(list.length)] : null; }
  chance(rate) { return this.next() < rate; }
}

function addUnlock(progress, unlock) {
  if (!unlock) return;
  for (const feat of unlock.feat || []) progress.feat.add(feat);
  if (unlock.mat) progress.mat = Math.max(progress.mat, unlock.mat);
  if (unlock.grid) progress.grid = { cols: unlock.grid.cols, rows: unlock.grid.rows };
}

// 读取某一关开始前的解锁状态：本关自己的 unlock 属于打赢后获得，不能提前使用。
function progressAt(SA, chapter, stage) {
  const progress = { feat: new Set(SA.CAMP_START.feat || []), mat: SA.CAMP_START.mat, grid: { ...SA.CAMP_START.grid } };
  for (let ci = 0; ci <= chapter; ci++) {
    const ch = SA.CAMPAIGN[ci];
    const stop = ci === chapter ? stage : ch.stages.length;
    for (let si = 0; si < stop; si++) {
      const actual = stageFor(SA, ci, si) || ch.stages[si];
      addUnlock(progress, actual.unlock);
    }
    if (ci < chapter) {
      addUnlock(progress, ch.unlock);
    }
  }
  return progress;
}

function stageSpec(SA, chapter, stage) {
  const ch = SA.CAMPAIGN[chapter], current = ch.stages[stage], progress = progressAt(SA, chapter, stage);
  const actual = stageFor(SA, chapter, stage) || current;
  const design = current.spec || {};
  // 构筑预算和模块池只读逐关表：addMods 自本关起累计，stageMods 仅本关。
  // 不再从原车的 subs 猜解锁，也不把库存目录、奖金或 Boss 倍率叠加进硬上限。
  const index = stageRules.findIndex(row => row.chapter === chapter && row.stage === stage);
  if (index < 0) throw new Error(`第 ${chapter + 1} 章第 ${stage + 1} 关缺少构筑规则`);
  const rule = stageRules[index], reward = design.reward || null;
  const planned = SA.CAMPAIGN_MAP?.chapters[chapter]?.stages[stage];
  const mat = planned?.enemyMaterial || progress.mat, grid = planned?.enemyGrid || progress.grid;
  const allowedMaterials = Array.from({ length: mat }, (_, i) => i + 1);
  const available = [...new Set([...stageRules.slice(0, index + 1).flatMap(row => row.addMods), ...(rule.stageMods || [])])];
  const requiredModules = [...new Set(planned?.rewardModules || design.requiredModules || (reward ? [reward] : []))];
  const allowedModules = available.filter(id => SA.MODULES[id] && allowedMaterials.some(mt => mt >= SA.minMt(id) && mt <= SA.maxMt(id)));
  return {
    chapter, stage, name: actual.name, terrain: design.terrain || actual.terrain || 'flat', style: actual.style || null, bounds: ch.bounds,
    lesson: design.lesson || null, performanceMin: Number.isFinite(design.performanceMin) ? design.performanceMin : 0,
    uniqueLoot: (actual.uniqueLoot || []).map(item => ({ ...item })),
    chapterHasBoss: ch.stages.some((row, index) => !!(stageFor(SA, chapter, index)?.boss || row.boss)),
    boss: !!actual.boss, rewardModule: reward || requiredModules[0] || null, requiredModules, grid, mat,
    allowedMaterials, allowedModules,
    budget: rule.budget, baseBudget: rule.budget, budgetStatus: rule.status,
    // 喷射武器只进入对应材料池；其他 Boss 奖励仍沿用原先允许提前展示的规则。
    availableMods: allowedModules,
    target: { bossWinRate: design.targetStrength || (actual.boss ? [0.6, 0.7] : [0.65, 0.8]) },
  };
}

// 路线图序号是预演范围的唯一坐标；未创建的计划关不写入正式战役数组。
function plannedRoute(SA) {
  const plan = SA.CAMPAIGN_MAP?.chapters || [];
  if (plan.length !== SA.CAMPAIGN.length || plan.some((ch, ci) => ch.stages.length !== SA.CAMPAIGN[ci].plannedStages))
    throw new Error('战役路线图与计划关数不一致');
  return plan.flatMap((ch, chapter) => ch.stages.map((entry, stage) => ({ chapter, stage, entry })));
}

function routeAfter(SA, origin, count) {
  const route = plannedRoute(SA);
  const index = route.findIndex(row => row.chapter === origin?.chapter && row.stage === origin?.stage);
  if (index < 0 || !Number.isSafeInteger(count) || count < 1 || index + count >= route.length)
    throw new Error(`后续关卡范围无效；该原点最多可选 ${Math.max(0, route.length - index - 1)} 关`);
  return route.slice(index + 1, index + count + 1);
}

// 已实施关沿用正式规格；计划关必须有逐关预算与结构化奖励、材料、网格配置。
function previewStageSpec(SA, chapter, stage) {
  const route = plannedRoute(SA), index = route.findIndex(row => row.chapter === chapter && row.stage === stage);
  if (index < 0) throw new Error('预演关卡不在路线图内');
  const entry = route[index].entry, ruleIndex = stageRules.findIndex(row => row.chapter === chapter && row.stage === stage);
  if (!Array.isArray(entry.rewardModules) && SA.CAMPAIGN[chapter]?.stages[stage] && !SA.CAMPAIGN[chapter].stages[stage].unfinished)
    return stageSpec(SA, chapter, stage);
  if (ruleIndex < 0 || !Array.isArray(entry.rewardModules) || !Number.isInteger(entry.enemyMaterial) || !entry.enemyGrid) {
    const error = new Error(`第 ${chapter + 1} 章第 ${stage + 1} 关缺少奖励、材料、网格或预算的结构化生成配置`);
    error.code = 'EVOLVE_STAGE_CONFIG_MISSING'; // 目录可单独标记未配置关，生成入口仍按原错误拒绝。
    throw error;
  }
  const rule = stageRules[ruleIndex];
  const unlocked = new Set([...(SA.CAMP_START?.mods || []), ...stageRules.slice(0, ruleIndex + 1).flatMap(row => row.addMods || [])]);
  route.slice(0, index + 1).forEach((row, i) => {
    if (i && row.stage === 0) for (const id of SA.CAMPAIGN_MAP.chapters[row.chapter - 1].unlockMods || []) unlocked.add(id);
    for (const id of row.entry.unlockMods || []) unlocked.add(id);
  });
  const ids = [...unlocked].filter(id => SA.MODULES[id] && !SA.MODULES[id].retired);
  const mat = entry.enemyMaterial;
  if (mat < 1 || mat > SA.MAT_MAX) throw new Error(`第 ${chapter + 1} 章第 ${stage + 1} 关材料上限无效`);
  for (const id of entry.rewardModules) if (!ids.includes(id) || SA.minMt(id) > mat)
    throw new Error(`第 ${chapter + 1} 章第 ${stage + 1} 关奖励模块 ${id} 未解锁或最低材料超过上限`);
  const allowedModules = ids.filter(id => Array.from({ length: mat }, (_, i) => i + 1).some(mt => mt >= SA.minMt(id) && mt <= SA.maxMt(id)));
  const actual = stageFor(SA, chapter, stage);
  const terrain = Object.entries(SA.TERRAINS).find(([, value]) => entry.terrain?.includes(value.name))?.[0];
  return { chapter, stage, name: actual?.name || entry.car, terrain: actual?.terrain || terrain || 'flat', style: actual?.style || null,
    bounds: SA.CAMPAIGN[chapter].bounds, boss: actual?.boss ?? /★/.test(entry.role || ''),
    chapterHasBoss: SA.CAMPAIGN_MAP.chapters[chapter].stages.some(row => /★/.test(row.role || '')),
    rewardModule: entry.rewardModules[0] || null, requiredModules: [...entry.rewardModules], uniqueLoot: actual?.uniqueLoot || [],
    mat, allowedMaterials: Array.from({ length: mat }, (_, i) => i + 1), grid: { ...entry.enemyGrid },
    allowedModules, availableMods: allowedModules, budget: rule.budget, baseBudget: rule.budget,
    budgetStatus: rule.status,
    target: { bossWinRate: /★/.test(entry.role || '') ? [0.6, 0.7] : [0.65, 0.8] } };
}

// 每一关的规格是战役意图的单一数据入口；这里只验字段完整性，不把探索稿的数值门槛强行改写进搜索。
function campaignSpecCheck(SA) {
  const errors = [];
  SA.CAMPAIGN.forEach((chapter, chapterIndex) => chapter.stages.forEach((stage, stageIndex) => {
    if (stage.unfinished) return;
    const spec = stage.spec;
    const label = `第 ${chapterIndex + 1} 章第 ${stageIndex + 1} 关 ${stage.name}`;
    if (!spec || typeof spec !== 'object') { errors.push(`${label} 缺少 spec`); return; }
    const terrain = spec.terrain || stage.terrain || 'flat';
    if (!SA.TERRAINS[terrain]) errors.push(`${label} 地形不存在：${terrain}`);
    if (!Array.isArray(spec.targetStrength) || spec.targetStrength.length !== 2 || spec.targetStrength.some(value => !Number.isFinite(value) || value < 0 || value > 1))
      errors.push(`${label} targetStrength 不是 0~1 区间`);
    if (!Number.isFinite(spec.performanceMin) || spec.performanceMin < 0 || spec.performanceMin > 100) errors.push(`${label} performanceMin 无效`);
    if (typeof spec.lesson !== 'string' || !spec.lesson.trim()) errors.push(`${label} 缺少 lesson`);
    if (spec.reward != null && !SA.MODULES[spec.reward]) errors.push(`${label} 奖励模块不存在：${spec.reward}`);
    for (const loot of stage.uniqueLoot || []) {
      if (!SA.MODULES[loot.id]) errors.push(`${label} 唯一件模块不存在：${loot.id}`);
      if (!Number.isInteger(loot.mt) || loot.mt < 1 || loot.mt > SA.MAT_MAX) errors.push(`${label} 唯一件材料无效：${loot.id}@${loot.mt}`);
      if (loot.once === false) errors.push(`${label} 唯一件必须默认一次领取：${loot.id}`);
    }
  }));
  if (errors.length) throw new Error(`战役规格检查失败：${errors.join('；')}`);
  return { chapters: SA.CAMPAIGN.length, stages: SA.CAMPAIGN.reduce((sum, chapter) => sum + chapter.stages.length, 0), complete: true };
}

function moduleIds(SA, spec, predicate) {
  return spec.availableMods.filter(id => SA.MODULES[id] && (!predicate || predicate(SA.MODULES[id], id)));
}

function cellValue(SA, id, mt) {
  return SA.cellValue({ id, mt });
}

function materialFor(SA, id, spec) {
  return (spec.allowedMaterials || [spec.mat]).find(mt => mt >= SA.minMt(id) && mt <= SA.maxMt(id)) || null;
}

function regionBounds(SA, v) {
  const region = SA.V.region(v);
  return { c0: region.c0, c1: region.c1, r0: region.r0, bottom: SA.V.CH };
}

// 只用 SA.V.canPut 的 fit=true 分支，避免生成器绕过连通、侧挂和撞击件规则。
function tryPlace(SA, v, id, mt, rng, tries = 120, layer = null) {
  const f = SA.fp(id), bounds = regionBounds(SA, v), moduleLayer = SA.MODULES[id]?.layer, placementLayer = layer || (moduleLayer === 'ram' ? 'ram' : SA.V.layerOf(id)), storageLayer = SA.V.layerOf(id);
  // 撞击件必须放在主体最前端；随机撒在车身中会通过 canPut，但会在出战检查时悬空。
  if (!layer && moduleLayer === 'ram') {
    for (let r = bounds.bottom; r >= bounds.r0; r--)
      for (let c = bounds.c0; c <= bounds.c1 - f.w + 1; c++) {
        const check = SA.V.canPut(v, id, r, c);
        if (check.ok && check.fit) { v[storageLayer][r][c] = SA.newCell(id, mt); return true; }
      }
    return false;
  }
  for (let i = 0; i < tries; i++) {
    const maxR = placementLayer === 'chassis' ? SA.V.chassisRow(id) : bounds.bottom - f.h;
    const r = placementLayer === 'chassis' ? SA.V.chassisRow(id) : bounds.r0 + rng.int(Math.max(1, maxR - bounds.r0 + 1));
    const maxC = bounds.c1 - f.w + 1;
    if (maxC < bounds.c0) return false;
    const c = bounds.c0 + rng.int(maxC - bounds.c0 + 1);
    const check = SA.V.canPut(v, id, r, c);
    if (!check.ok || !check.fit) continue;
    v[storageLayer][r][c] = SA.newCell(id, mt);
    return true;
  }
  return false;
}

// 直射武器优先贴车体前缘，避免生成“stats.canDeploy 但炮口被己方模块挡住”的假合法车。
function tryWeapon(SA, v, id, mt, rng) {
  const f = SA.fp(id), bounds = regionBounds(SA, v);
  if (SA.MODULES[id]?.indirect || SA.MODULES[id]?.layer !== 'body') return tryPlace(SA, v, id, mt, rng);
  const front = bounds.c1 - f.w + 1;
  for (let r = bounds.r0; r <= bounds.bottom - f.h; r++) {
    const check = SA.V.canPut(v, id, r, front);
    if (check.ok && check.fit) { v.body[r][front] = SA.newCell(id, mt); return true; }
  }
  return tryPlace(SA, v, id, mt, rng);
}

function counts(SA, v) {
  return SA.V.countIds(v);
}

function hasWeapon(SA, v) {
  return Object.keys(counts(SA, v)).some(id => isWeapon(SA.MODULES[id]));
}

// 近战撞击件也是武器；底盘自带踢击不能替代独立武器模块。
function isWeapon(m) { return !!(m?.dmg || m?.ram); }

// 所有候选入口及最终选关共用真实整车检查，防止旧缓存、升级和保底路径漏检。
function constructionConditions(SA, v, spec) {
  const stats = SA.V.stats(v, { deferHeat: true });
  const allowedModules = spec.allowedModules || spec.availableMods || [];
  const allowedMaterials = spec.allowedMaterials || [spec.mat];
  const test = SA.V.create('关卡网格检查'); test.lim = { ...spec.grid };
  const bounds = regionBounds(SA, test);
  let materials = true, grid = v.lim?.cols === spec.grid.cols && v.lim?.rows === spec.grid.rows;
  SA.V.each(v, (cell, r, c) => {
    if (!allowedMaterials.includes(cell.mt || 1) || (cell.mt || 1) < SA.minMt(cell.id) || (cell.mt || 1) > SA.maxMt(cell.id)) materials = false;
    const f = SA.fp(cell.id);
    if (r < bounds.r0 || r + f.h - 1 > bounds.bottom + 1 || c < bounds.c0 || c + f.w - 1 > bounds.c1) grid = false;
  });
  return {
    construction: mandatoryOk(SA, v) && stats.canDeploy && !stats.blocked?.length,
    grid,
    modulePool: Object.keys(counts(SA, v)).every(id => allowedModules.includes(id) && !SA.MODULES[id]?.retired),
    materials,
    budget: Number.isFinite(stats.value) && stats.value <= spec.budget,
    reward: rewardPresent(SA, v, spec),
  };
}

function legalVehicle(SA, v, spec) {
  return Object.values(constructionConditions(SA, v, spec)).every(Boolean);
}

// 关卡候选必须展示本关奖励；标尺和拆奖励对照仍可使用普通合法车。
function rewardPresent(SA, vehicle, spec) {
  const required = spec.requiredModules || (spec.rewardModule ? [spec.rewardModule] : []);
  const existing = counts(SA, vehicle);
  return required.every(id => !!existing[id]);
}

// 节约分单列，不伪装成胜率强度；模块按实体件计数，价格含材料和改装。
function efficiencyScore(stats, spec) {
  const money = 100 * clamp(1 - stats.value / spec.budget, 0, 1);
  return { money, total: money, value: stats.value, count: stats.count, budget: spec.budget };
}

// 固定尺度不随当前种群改变，避免同一台车因加入其他候选而改分。
// 节约原分上限为两项加分之和；强度沿用实战映射的 300～1700 区间。
function rankingScore(item) {
  const efficiency = clamp(item.efficiency?.total || 0, 0, 100);
  const strength = clamp((item.strength - 300) / 1400, 0, 1) * 100;
  const efficiencyContribution = efficiency * config.ranking.efficiencyWeight;
  const strengthContribution = strength * config.ranking.strengthWeight;
  return { efficiency, strength, efficiencyContribution, strengthContribution, total: efficiencyContribution + strengthContribution };
}

function fitness(item) { return rankingScore(item).total; }
function difficultyDistance(rate) {
  if (rate == null) return 0;
  return Math.max(config.difficulty.min - rate, 0, rate - config.difficulty.max);
}
function compareFitness(a, b) {
  return difficultyDistance(a.previousWinRate) - difficultyDistance(b.previousWinRate) ||
    fitness(b) - fitness(a) || b.performance - a.performance;
}

function pickWeapon(SA, spec, rng, style) {
  const ids = moduleIds(SA, spec, m => m.cat === 'firepower');
  const preferred = ids.filter(id => {
    const m = SA.MODULES[id];
    if (style === 'rush') return m.ram || m.heatToEnemy || m.tether;
    if (style === 'kite') return m.indirect || m.tether || m.salvo;
    if (style === 'turtle') return m.indirect || m.splash || m.dmg > 25;
    return true;
  });
  return rng.pick(preferred.length ? preferred : ids);
}

// 侧挂先尝试复用已有装甲；没有合适宿主时才补本关允许的最低价装甲。
function placeSideWithHost(SA, v, spec, id) {
  const mt = materialFor(SA, id, spec), sideSize = SA.fp(id), bounds = regionBounds(SA, v);
  if (mt == null || !spec.availableMods.includes(id)) return false;
  const putSide = () => {
    for (let r = bounds.bottom - sideSize.h; r >= bounds.r0; r--)
      for (let c = bounds.c0; c <= bounds.c1 - sideSize.w + 1; c++) {
        const check = SA.V.canPut(v, id, r, c);
        if (!check.ok || !check.fit) continue;
        v.side[r][c] = SA.newCell(id, mt);
        if (legalVehicle(SA, v, spec)) return true;
        v.side[r][c] = null;
      }
    return false;
  };
  if (putSide()) return true;
  const hosts = moduleIds(SA, spec, (m, hostId) => ['plate', 'armor', 'armor_heavy'].includes(hostId) &&
    SA.fp(hostId).w >= sideSize.w && SA.fp(hostId).h >= sideSize.h)
    .filter(hostId => materialFor(SA, hostId, spec) != null)
    .sort((a, b) => cellValue(SA, a, materialFor(SA, a, spec)) - cellValue(SA, b, materialFor(SA, b, spec)));
  for (const hostId of hosts) {
    const f = SA.fp(hostId), hostMt = materialFor(SA, hostId, spec);
    if (SA.V.stats(v, { deferHeat: true }).value + cellValue(SA, hostId, hostMt) + cellValue(SA, id, mt) > spec.budget) continue;
    for (let r = bounds.bottom - f.h; r >= bounds.r0; r--)
      for (let c = bounds.c0; c <= bounds.c1 - f.w + 1; c++) {
        const check = SA.V.canPut(v, hostId, r, c);
        if (!check.ok || !check.fit) continue;
        v.body[r][c] = SA.newCell(hostId, hostMt);
        if (!SA.V.blockedList(v).length && putSide()) return true;
        v.body[r][c] = null;
      }
  }
  return false;
}

// 随机尝试全部失败时的保底车。保底车只保证必需件和一个武器，
// 这样某一档的预算 / 尺寸变化也不会让种群初始化陷入无限循环。
function minimalVehicle(SA, spec, forcedModule = null) {
  const required = spec.requiredModules || (spec.rewardModule ? [spec.rewardModule] : []);
  if (required.length > 1) return requiredVehicle(SA, spec, new RNG(1009 + spec.chapter * 101 + spec.stage));
  if (!forcedModule) forcedModule = required[0] || null;
  if (forcedModule && !spec.availableMods.includes(forcedModule)) return null;
  if (forcedModule && required.length === 1 && forcedModule !== required[0] && SA.MODULES[forcedModule]?.layer === 'side') {
    const requiredBase = minimalVehicle(SA, spec);
    return requiredBase && placeSideWithHost(SA, requiredBase, spec, forcedModule) ? requiredBase : null;
  }
  const v = SA.V.create(`保底候选·${spec.chapter + 1}-${spec.stage + 1}`);
  v.lim = { ...spec.grid };
  const bounds = regionBounds(SA, v), putFirst = (id, preferredRows = null) => {
    const f = SA.fp(id), layer = SA.V.layerOf(id), placementLayer = SA.MODULES[id].layer;
    const rows = preferredRows || (placementLayer === 'chassis' ? [SA.V.chassisRow(id)] : placementLayer === 'ram' ? Array.from({ length: bounds.bottom - bounds.r0 + 1 }, (_, i) => bounds.bottom - i) : Array.from({ length: bounds.bottom - f.h - bounds.r0 + 1 }, (_, i) => bounds.bottom - f.h - i));
    for (const r of rows)
      for (let c = bounds.c0; c <= bounds.c1 - f.w + 1; c++) {
        const check = SA.V.canPut(v, id, r, c);
        if (check.ok && check.fit) {
          const mt = materialFor(SA, id, spec);
          if (mt == null) continue;
          v[layer][r][c] = SA.newCell(id, mt);
          // 保底布局也要预留直射通道；后装的驾驶舱 / 锅炉不能堵住已装武器。
          if (!SA.V.blockedList(v).length) return true;
          v[layer][r][c] = null;
        }
      }
    return false;
  };
  // 覆盖检查或奖励车明确指定底盘时，保底构筑也必须真正使用它；否则整件四足/双足永远只会回退成履带。
  const chassis = forcedModule && SA.MODULES[forcedModule]?.layer === 'chassis' ? forcedModule :
    (spec.availableMods.includes('track') ? 'track' : (moduleIds(SA, spec, m => m.layer === 'chassis')[0] || 'track'));
  putFirst(chassis);
  // 巨炮和奖励撞击件需要先贴到底盘，再围绕它补齐驾驶舱和锅炉，
  // 否则大尺寸火力件会因没有支撑或撞击件没有挂点而永远生成失败。
  // 侧炮需要完整主体作挂点，必须等锅炉等主体装好后再挂，不能当主体武器抢先摆放。
  const forcedSide = forcedModule && SA.MODULES[forcedModule]?.layer === 'side' ? forcedModule : null;
  const forcedWeapon = forcedModule && !forcedSide && SA.MODULES[forcedModule]?.dmg ? forcedModule : null;
  const forcedRam = forcedModule && SA.MODULES[forcedModule]?.layer === 'ram' ? forcedModule : null;
  if (forcedWeapon) putFirst(forcedWeapon);
  if (forcedRam) putFirst(forcedRam);
  const forcedUtility = forcedModule && !forcedWeapon && !forcedRam && !forcedSide && SA.MODULES[forcedModule]?.layer !== 'chassis' ? putFirst(forcedModule) : false;
  // 巨炮占四行时，驾驶舱和锅炉从炮身上方开始找位置，
  // 放到炮口旁会被判作遮挡，形成“可部署但不能开火”的假候选。
  const highRows = forcedWeapon && SA.fp(forcedWeapon).w >= 4 ? Array.from({ length: bounds.bottom - bounds.r0 + 1 }, (_, i) => bounds.r0 + i) : null;
  // 基础构筑只补底盘、驾驶舱、锅炉、武器；冷却和装甲不属于硬要求。
  // 明确要求展示某奖励件时可额外加入，但同功能必需件不重复购买。
  for (const predicate of [(m, id) => SA.isCockpit(id), m => m.supply]) {
    if (Object.keys(counts(SA, v)).some(id => predicate(SA.MODULES[id], id))) continue;
    // 侧挂宿主另由装甲承担，锅炉只需满足本关原有核心件规则。
    const id = moduleIds(SA, spec, predicate)[0];
    if (!id || !putFirst(id, highRows)) return null;
  }
  const weapon = moduleIds(SA, spec, m => m.dmg || m.ram)[0];
  if (forcedSide && !isWeapon(SA.MODULES[forcedSide]) && !hasWeapon(SA, v) && (!weapon || !putFirst(weapon))) return null;
  if (forcedSide && !placeSideWithHost(SA, v, spec, forcedSide)) return null;
  if (!hasWeapon(SA, v) && (!weapon || !putFirst(weapon))) return null;
  // 奖励件可能是冷却、控制或装甲件；保底车也要优先尝试放入，
  // 否则“必须包含奖励件”的章节选择会被保底路径悄悄破坏。
  if (forcedModule && !forcedWeapon && !forcedRam && !forcedSide && SA.MODULES[forcedModule].layer !== 'chassis' && !forcedUtility) putFirst(forcedModule);
  return legalVehicle(SA, v, spec) && (!forcedModule || counts(SA, v)[forcedModule]) ? v : null;
}

function randomVehicle(SA, spec, rng, forcedModule = null) {
  if (forcedModule && !spec.availableMods.includes(forcedModule)) return null;
  const v = SA.V.create(`进化候选·${spec.chapter + 1}-${spec.stage + 1}-${rng.int(100000)}`);
  v.lim = { ...spec.grid };
  const chassisIds = moduleIds(SA, spec, m => m.layer === 'chassis');
  const style = rng.pick(SA.Battle.aiStyles.filter(item => !item.training).map(item => item.id));
  const forcedChassis = forcedModule && SA.MODULES[forcedModule]?.layer === 'chassis' ? forcedModule : null;
  const chassis = forcedChassis || rng.pick(chassisIds) || 'track';
  // 窄预算先留足必需件的钱；额外履带也按整车价值支付，不能固定放两段。
  const minimum = minimalVehicle(SA, spec, forcedModule || chassis);
  const spare = minimum ? Math.max(0, spec.budget - SA.V.stats(minimum, { deferHeat: true }).value) : 0;
  const maxTracks = Math.min(3, Math.floor(spec.grid.cols / 2), 1 + Math.floor(spare / cellValue(SA, chassis, materialFor(SA, chassis, spec))));
  const chassisCount = chassis === 'track' ? 1 + rng.int(maxTracks) : 1;
  for (let i = 0; i < chassisCount; i++) tryPlace(SA, v, chassis, materialFor(SA, chassis, spec), rng, 100, 'chassis');

  const body = [
    moduleIds(SA, spec, (m, id) => SA.isCockpit(id))[0] || 'helmet',
    moduleIds(SA, spec, m => m.supply)[0] || 'boiler',
  ];
  for (const id of body) {
    const forced = forcedModule && SA.MODULES[forcedModule];
    const sameRole = forced && ((SA.isCockpit(id) && SA.isCockpit(forcedModule)) || (SA.MODULES[id].supply && forced.supply));
    const selected = sameRole ? forcedModule : id;
    tryPlace(SA, v, selected, materialFor(SA, selected, spec), rng);
  }

  // 撞击件可独立作战；非武器奖励只补一次，避免占用有限预算。
  const forcedIsWeapon = !!(forcedModule && isWeapon(SA.MODULES[forcedModule]));
  const weapon = forcedIsWeapon ? forcedModule : pickWeapon(SA, spec, rng, style);
  if (weapon && !counts(SA, v)[weapon]) tryWeapon(SA, v, weapon, materialFor(SA, weapon, spec), rng);
  if (forcedModule && !counts(SA, v)[forcedModule]) tryPlace(SA, v, forcedModule, materialFor(SA, forcedModule, spec), rng, 160);
  if (rng.chance(0.55)) {
    const second = pickWeapon(SA, spec, rng, style);
    if (second && second !== weapon) tryWeapon(SA, v, second, materialFor(SA, second, spec), rng);
  }
  const armorIds = moduleIds(SA, spec, m => m.cat === 'structure');
  const coolingIds = moduleIds(SA, spec, m => m.cat === 'cooling');
  const controls = moduleIds(SA, spec, m => m.cat === 'control' && !m.cockpit);
  const energy = moduleIds(SA, spec, m => m.cat === 'energy' && !m.supply);
  const optional = style === 'rush' ? [...armorIds, ...armorIds, ...energy] : [...armorIds, ...coolingIds, ...controls, ...energy];
  const targetCount = 3 + rng.int(6);
  for (let i = 0; i < targetCount; i++) {
    const id = rng.pick(optional);
    if (!id || cellValue(SA, id, materialFor(SA, id, spec)) + SA.V.stats(v, { deferHeat: true }).value > spec.budget) continue;
    tryPlace(SA, v, id, materialFor(SA, id, spec), rng);
  }
  if (spec.availableMods.includes('side_cannon') && rng.chance(0.3)) tryPlace(SA, v, 'side_cannon', materialFor(SA, 'side_cannon', spec), rng, 120, 'side');
  if (style === 'rush') {
    const ramIds = moduleIds(SA, spec, m => m.layer === 'ram');
    const ram = rng.pick(ramIds);
    if (ram) tryPlace(SA, v, ram, materialFor(SA, ram, spec), rng);
  }
  if (legalVehicle(SA, v, spec) && (!forcedModule || counts(SA, v)[forcedModule])) return v;
  return minimalVehicle(SA, spec, forcedModule);
}

// 多件奖励的构筑按不同首件重复尝试；底盘、驾驶舱等核心奖励可直接替代旧核心件。
function requiredVehicle(SA, spec, rng) {
  const required = spec.requiredModules || (spec.rewardModule ? [spec.rewardModule] : []);
  for (let attempt = 0; attempt < 128; attempt++) {
    const first = required.length ? required[attempt % required.length] : null;
    const partial = first ? { ...spec, requiredModules: [first] } : spec;
    const vehicle = randomVehicle(SA, partial, rng, first);
    if (!vehicle) continue;
    for (const id of required) {
      if (counts(SA, vehicle)[id]) continue;
      // 先在现有布局中补奖励；只有放不下时才移走同职责的旧件，避免无条件丢掉已解锁主炮。
      const replacing = [];
      SA.V.each(vehicle, (cell, r, c, layer) => {
        if (required.includes(cell.id)) return;
        if (SA.MODULES[id]?.layer === 'chassis' && SA.MODULES[cell.id]?.layer === 'chassis') replacing.push({ layer, r, c });
        else if (SA.isCockpit(id) && SA.isCockpit(cell.id)) replacing.push({ layer, r, c });
        else if (isWeapon(SA.MODULES[id]) && isWeapon(SA.MODULES[cell.id])) replacing.push({ layer, r, c });
      });
      const mt = materialFor(SA, id, spec);
      if (mt == null) break;
      const place = () => isWeapon(SA.MODULES[id]) ? tryWeapon(SA, vehicle, id, mt, rng) :
        tryPlace(SA, vehicle, id, mt, rng, 160);
      if (!place()) {
        for (const cell of replacing) {
          SA.V.remove(vehicle, cell.layer, cell.r, cell.c);
          if (place()) break;
        }
      }
    }
    if (legalVehicle(SA, vehicle, spec)) return vehicle;
  }
  return null;
}

// 跨关继承必须一次补齐全部新奖励，不能把缺件的中间态交给单步变异的合法性检查。
// 按最少裁剪的顺序探索父本可选件；先保留旧武器，再在确实无解时考虑替换它。
function adaptParentForStage(SA, parent, spec, rng) {
  const base = SA.V.clone(parent);
  base.name = `${parent.name}·跨关适配`;
  base.lim = { ...spec.grid };
  const required = spec.requiredModules || (spec.rewardModule ? [spec.rewardModule] : []);
  const invalid = [];
  SA.V.each(base, (cell, r, c, layer) => {
    if (!spec.availableMods.includes(cell.id) || !SA.MODULES[cell.id] || SA.MODULES[cell.id].retired) {
      invalid.push({ layer, r, c });
      return;
    }
    if (!(spec.allowedMaterials || [spec.mat]).includes(cell.mt) || cell.mt < SA.minMt(cell.id) || cell.mt > SA.maxMt(cell.id)) {
      const mt = materialFor(SA, cell.id, spec);
      if (mt == null) invalid.push({ layer, r, c });
      else cell.mt = mt;
    }
  });
  for (const cell of invalid) SA.V.remove(base, cell.layer, cell.r, cell.c);

  const removable = [];
  const quantities = counts(SA, base);
  let mainWeapon = null;
  SA.V.each(base, (cell, r, c) => {
    if (isWeapon(SA.MODULES[cell.id]) && (!mainWeapon || cellValue(SA, cell.id, cell.mt) > mainWeapon.value))
      mainWeapon = { r, c, value: cellValue(SA, cell.id, cell.mt) };
  });
  SA.V.each(base, (cell, r, c, layer) => {
    if (required.includes(cell.id)) return;
    const module = SA.MODULES[cell.id];
    const replacesCore = required.some(id => SA.MODULES[id]?.layer === 'chassis' && module.layer === 'chassis' ||
      SA.isCockpit(id) && SA.isCockpit(cell.id));
    if (replacesCore) return;
    if (module.layer === 'chassis' && quantities[cell.id] === 1 ||
      SA.isCockpit(cell.id) && quantities[cell.id] === 1 || module.supply && quantities[cell.id] === 1) return;
    removable.push({ layer, r, c, mainWeapon: !!mainWeapon && r === mainWeapon.r && c === mainWeapon.c && isWeapon(module) });
  });
  const core = [];
  SA.V.each(base, (cell, r, c, layer) => {
    if (required.includes(cell.id)) return;
    if (required.some(id => SA.MODULES[id]?.layer === 'chassis' && SA.MODULES[cell.id]?.layer === 'chassis' ||
      SA.isCockpit(id) && SA.isCockpit(cell.id))) core.push({ layer, r, c });
  });
  const attempt = removed => {
    for (let placement = 0; placement < 12; placement++) {
      const vehicle = SA.V.clone(base);
      for (const cell of [...core, ...removed]) SA.V.remove(vehicle, cell.layer, cell.r, cell.c);
      let placed = true;
      for (const id of required) {
        if (counts(SA, vehicle)[id]) continue;
        const mt = materialFor(SA, id, spec);
        if (mt == null || !(isWeapon(SA.MODULES[id]) ? tryWeapon(SA, vehicle, id, mt, rng) :
          tryPlace(SA, vehicle, id, mt, rng, 160))) { placed = false; break; }
      }
      if (placed && legalVehicle(SA, vehicle, spec)) return vehicle;
    }
    return null;
  };
  // 一般车辆可选件很少；最多裁剪三件，避免为了继承穷举拆空整车。
  for (const mainWeaponLoss of [false, true]) {
    for (let size = 0; size <= Math.min(3, removable.length); size++) {
      const choose = (start, selected) => {
        if (selected.length === size) return selected.some(cell => cell.mainWeapon) === mainWeaponLoss ? attempt(selected) : null;
        for (let i = start; i <= removable.length - (size - selected.length); i++) {
          const result = choose(i + 1, [...selected, removable[i]]);
          if (result) return result;
        }
        return null;
      };
      const result = choose(0, []);
      if (result) return result;
    }
  }
  return null;
}

function mandatoryOk(SA, v) {
  const c = counts(SA, v);
  return Object.keys(c).some(id => SA.MODULES[id]?.layer === 'chassis') &&
    Object.keys(c).some(id => SA.isCockpit(id)) && Object.keys(c).some(id => SA.MODULES[id]?.supply) &&
    hasWeapon(SA, v);
}

function optionalCells(SA, v) {
  const out = [];
  SA.V.each(v, (cell, r, c, layer) => {
    const m = SA.MODULES[cell.id];
    // 冷却、装甲和重复的必需件都允许删除；删掉最后一个必需件会被最终合法性校验拒绝。
    if (m.layer !== 'chassis') out.push({ cell, r, c, layer });
  });
  return out;
}

function mutate(SA, source, spec, rng, trace = null, structuralOnly = false) {
  const out = SA.V.clone(source);
  out.name = `${source.name}·变异${rng.int(100000)}`;
  const op = rng.int(structuralOnly ? 4 : 5);
  if (trace) trace.push(op);
  const cells = optionalCells(SA, out);
  if (op === 0 || !cells.length) {
    const id = rng.pick(spec.availableMods.filter(x => !SA.MODULES[x].retired));
    if (id && cellValue(SA, id, materialFor(SA, id, spec)) + SA.V.stats(out, { deferHeat: true }).value <= spec.budget) tryPlace(SA, out, id, materialFor(SA, id, spec), rng);
  } else if (op === 1) {
    const target = rng.pick(cells);
    if (target) SA.V.remove(out, target.layer, target.r, target.c);
  } else if (op === 2) {
    const target = rng.pick(cells), f = target && SA.fp(target.cell.id);
    if (target && f) {
      const bounds = regionBounds(SA, out);
      const r = bounds.r0 + rng.int(Math.max(1, bounds.bottom - f.h - bounds.r0 + 1));
      const c = bounds.c0 + rng.int(Math.max(1, bounds.c1 - f.w - bounds.c0 + 2));
      SA.V.move(out, target.layer, target.r, target.c, r, c);
    }
  } else if (op === 3) {
    const target = rng.pick(cells);
    const same = target && spec.availableMods.filter(id => SA.V.layerOf(id) === target.layer && SA.fp(id).w === SA.fp(target.cell.id).w && SA.fp(id).h === SA.fp(target.cell.id).h);
    if (target && same?.length) {
      SA.V.remove(out, target.layer, target.r, target.c);
      const id = rng.pick(same), check = SA.V.canPut(out, id, target.r, target.c);
      if (check.ok && check.fit) out[target.layer][target.r][target.c] = SA.newCell(id, materialFor(SA, id, spec));
    }
  } else {
    const target = rng.pick(cells);
    if (target) target.cell.lv = clamp((target.cell.lv || 0) + 1, 0, SA.K.UP_MAX);
  }
  return legalVehicle(SA, out, spec) ? out : null;
}

// ---------- 评分与对战 ----------
function invertResult(result) {
  const swap = value => value === 'p' ? 'e' : value === 'e' ? 'p' : 'draw';
  return { ...result, winner: swap(result.winner), pDealt: result.eDealt, eDealt: result.pDealt,
    events: { p: result.events?.e || {}, e: result.events?.p || {} }, effectStats: { p: result.effectStats?.e || {}, e: result.effectStats?.p || {} } };
}

function performanceScore(result, side, configWeights) {
  const e = result.events?.[side] || {}, m = result.metrics || {}, total = Math.max(0.1, result.t);
  // 弹开仍算命中事件，但没有造成有效伤害；表现分用有效命中率，避免厚甲前的跳弹把枪法评分抬高。
  const fire = Math.max(1, e.fire || 0), effectiveHit = Math.max(0, (e.hit || 0) - (e.ricochet || 0)), hitRate = effectiveHit / fire;
  const dealt = side === 'p' ? result.pDealt : result.eDealt;
  let score = configWeights.base;
  score += clamp(hitRate, 0, 1) * configWeights.hitRate;
  score += (e.hit ? clamp((e.chargedHit || 0) / e.hit, 0, 1) : 0) * configWeights.chargedHit;
  score += clamp((m.nearTime || 0) / total, 0, 1) * configWeights.closeCombat;
  score += clamp((e.ram || 0) + (e.knock || 0), 0, 8) / 8 * configWeights.collision;
  score += clamp((e.terrainBlock || 0) + (e.highHit || 0), 0, 8) / 8 * configWeights.terrain;
  score += clamp(e.destroyed || 0, 0, 8) / 8 * configWeights.dismantle;
  if (result.winner === side && /驾驶舱|投降/.test(result.reason || '')) score += configWeights.clean;
  score += (1 - clamp(Math.abs(result.t - 45) / 45, 0, 1)) * configWeights.tempo;
  if (result.winner === side && /烧干/.test(result.reason || '')) score += configWeights.enemyHeatDeath;
  if (result.winner !== side && /烧干/.test(result.reason || '')) score += configWeights.ownHeatDeath;
  if (result.winner === 'draw') score += configWeights.draw;
  if (result.timeout) score += configWeights.timeout;
  const farInefficient = (m.farTime || 0) / total * (dealt < 0.25 * (side === 'p' ? result.eDealt + 1 : result.pDealt + 1) ? 1 : 0);
  score -= farInefficient * Math.abs(configWeights.distantInefficient);
  score -= (m.noEngageTime || 0) / total * Math.abs(configWeights.noEngage);
  return clamp(score, 0, 100);
}

// 先汇总真实局数与胜分，再换算以 1000 为中心的 Elo 类强度及二项置信区间。
// 不能先对每个标尺取 logit 再平均：某一组全胜的极值会淹没其他组的败局。
// 这里不把 stats().rating 当强度；它只描述静态构造，最终分数来自实战。
function strengthFromRows(rows) {
  if (!rows.length) return { strength: 1000, strengthCi: 0 };
  const n = rows.reduce((sum, row) => sum + Math.max(1, row.n), 0);
  const p = rows.reduce((sum, row) => sum + clamp(row.winRate, 0, 1) * Math.max(1, row.n), 0) / n;
  const elo = rate => Math.log(clamp(rate, 0.001, 0.999) / (1 - clamp(rate, 0.001, 0.999))) * 400 / Math.LN10;
  const strength = clamp(1000 + elo(p), 300, 1700);
  // Wilson 区间避免全胜 / 全负样本被错误地报告成“零不确定性”。
  const z = 1.96;
  const z2 = z * z, den = 1 + z2 / n, mid = (p + z2 / (2 * n)) / den;
  const half = z * Math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n)) / den;
  return { strength, strengthCi: (elo(mid + half) - elo(mid - half)) / 2 };
}

// 单次进化运行内的确定性对局缓存。
//
// 评分和选关证据会重复请求同一组双向对局；缓存只保存 duel() 的聚合结果，
// 不跨 run() / 规则指纹复用，也不缓存 Battle.simulate 的完整状态，避免改变
// 随机种子语义或把大量事件对象留在内存里。车辆键必须包含材料和改装等级，
// 因为 SA.V.encode() 只表示布局。
function createDuelCache(SA, maxEntries = 50000) {
  const entries = new Map(), fingerprints = new WeakMap(), fingerprintIds = new Map();
  let nextVehicleId = 1;
  let hits = 0, misses = 0, evictions = 0;
  const vehicleKey = vehicle => {
    if (!vehicle || typeof vehicle !== 'object') return String(vehicle);
    let key = fingerprints.get(vehicle);
    if (!key) {
      const fingerprint = JSON.stringify(cellsOf(SA, vehicle));
      key = fingerprintIds.get(fingerprint);
      if (!key) { key = nextVehicleId++; fingerprintIds.set(fingerprint, key); }
      fingerprints.set(vehicle, key);
    }
    return key;
  };
  return {
    key(candidate, opponent, spec, seed, games) {
      return `${vehicleKey(candidate)}|${vehicleKey(opponent)}|${spec?.style || 'wander'}|${spec?.referenceStyle || 'wander'}|${spec?.terrain || 'flat'}|${spec?.bounds?.left ?? ''},${spec?.bounds?.right ?? ''}|${seed}|${games}`;
    },
    get(key) {
      if (!entries.has(key)) { misses++; return undefined; }
      hits++;
      const value = entries.get(key);
      // 维持简单的 LRU 顺序；结果本身只读，避免深拷贝战斗事件造成额外开销。
      entries.delete(key); entries.set(key, value);
      return value;
    },
    set(key, value) {
      if (entries.has(key)) entries.delete(key);
      entries.set(key, value);
      while (entries.size > Math.max(1, maxEntries)) { entries.delete(entries.keys().next().value); evictions++; }
    },
    summary() {
      const total = hits + misses;
      return { entries: entries.size, maxEntries, hits, misses, evictions, hitRate: hits / Math.max(1, total) };
    },
  };
}

function duelRows(SA, candidate, opponent, spec, seed, start, count) {
  // 每轮两局的顺序和随机种子与同步 duel 完全一致；分包只改变 worker 分工。
  const rows = [];
  for (let i = start; i < start + count; i++) {
    const seedA = seed + i * 2;
    const a = SA.Battle.simulate({ p: candidate, e: opponent, pAim: 0.8, eAim: 0.8, pStyle: spec.style || 'wander', eStyle: spec.referenceStyle || 'wander', terrain: spec.terrain, bounds: spec.bounds, seed: seedA });
    const b = invertResult(SA.Battle.simulate({ p: opponent, e: candidate, pAim: 0.8, eAim: 0.8, pStyle: spec.referenceStyle || 'wander', eStyle: spec.style || 'wander', terrain: spec.terrain, bounds: spec.bounds, seed: seedA + 1 }));
    rows.push({ result: a, seed: seedA }, { result: b, seed: seedA + 1 });
  }
  return rows;
}

function reduceDuelRows(rows, games) {
  if (rows.length !== games * 2) throw new Error('复测对局数量不符');
  let wins = 0, draws = 0, totalTime = 0, performance = 0, resultSample = null;
  for (const { result: r, seed } of rows) {
    if (r.winner === 'p') wins++; else if (r.winner === 'draw') draws++;
    totalTime += r.t; performance += performanceScore(r, 'p', config.performance);
    resultSample = resultSample || { ...r, seed };
  }
  const n = games * 2;
  return { wins, draws, n, winRate: (wins + draws * 0.5) / Math.max(1, n), time: totalTime / Math.max(1, n), performance: performance / Math.max(1, n), sample: resultSample };
}

function duel(SA, candidate, opponent, spec, seed, games, duelCache = null) {
  // games 是双向配对轮数；60 轮＝双方各 60 场，共 120 场，结果 n 记实际场数。
  // 关卡规格带入章节边界；通用对局的规格没有 bounds，仍按无限场地模拟。
  const cacheKey = duelCache?.key(candidate, opponent, spec, seed, games);
  if (cacheKey) {
    const cached = duelCache.get(cacheKey);
    if (cached) return cached;
  }
  const result = reduceDuelRows(duelRows(SA, candidate, opponent, spec, seed, 0, games), games);
  if (cacheKey) duelCache.set(cacheKey, result);
  return result;
}

function styleFor(SA, v) {
  const s = SA.V.stats(v, { deferHeat: true });
  if (s.rams && s.speed > 50) return 'rush';
  if (s.tether || s.salvoDps > s.dps * 1.15) return 'kite';
  if (s.dryCool + s.cool > 5 || s.dps < 25) return 'turtle';
  return 'wander';
}

function chassisFor(SA, v) {
  const ids = [];
  SA.V.each(v, cell => { if (SA.MODULES[cell.id]?.layer === 'chassis' && !ids.includes(cell.id)) ids.push(cell.id); });
  return ids[0] || 'track';
}

// 全层共用一个原点展开占格；镜像只用于比较，材料、等级、性格均不进入形态。
function shapeSignature(SA, vehicle) {
  const occupied = new Set(), modules = {};
  SA.V.each(vehicle, (cell, r, c, layer) => {
    modules[cell.id] = (modules[cell.id] || 0) + 1;
    const f = SA.fp(cell.id);
    for (let dr = 0; dr < f.h; dr++) for (let dc = 0; dc < f.w; dc++)
      occupied.add(`${layer}:${r + dr}:${c + dc}`);
  });
  const coords = [...occupied].map(key => { const [layer, r, c] = key.split(':'); return [layer, Number(r), Number(c)]; });
  const normalize = mirror => {
    const minR = Math.min(...coords.map(x => x[1])), minC = Math.min(...coords.map(x => mirror ? -x[2] : x[2]));
    return new Set(coords.map(([layer, r, c]) => `${layer}:${r - minR}:${(mirror ? -c : c) - minC}`));
  };
  const normal = normalize(false), mirrored = normalize(true);
  const chassis = [...new Set(Object.keys(modules).filter(id => SA.MODULES[id]?.layer === 'chassis'))].sort().join('+');
  const canonical = [[...normal].sort().join(','), [...mirrored].sort().join(',')].sort()[0];
  return { chassis, modules, footprint: [normal, mirrored], key: [chassis, canonical, JSON.stringify(Object.entries(modules).sort())].join('|') };
}

function shapeSimilarity(SA, a, b) {
  const x = a?.footprint ? a : shapeSignature(SA, a?.vehicle || a);
  const y = b?.footprint ? b : shapeSignature(SA, b?.vehicle || b);
  if (x.chassis !== y.chassis) return 0;
  const overlap = (p, q) => {
    const intersection = [...p].filter(key => q.has(key)).length;
    return intersection / Math.max(1, p.size + q.size - intersection);
  };
  const footprint = Math.max(...x.footprint.flatMap(p => y.footprint.map(q => overlap(p, q))));
  const ids = new Set([...Object.keys(x.modules), ...Object.keys(y.modules)]);
  let common = 0, total = 0;
  for (const id of ids) { common += Math.min(x.modules[id] || 0, y.modules[id] || 0); total += Math.max(x.modules[id] || 0, y.modules[id] || 0); }
  return 0.5 * footprint + 0.5 * common / Math.max(1, total);
}

function shapeClusters(SA, items) {
  const clusters = [];
  for (const item of items) {
    const shape = shapeSignature(SA, item.vehicle || item);
    let cluster = clusters.find(row => shapeSimilarity(SA, shape, row.shape) >= config.diversity.similarAt);
    if (!cluster) { cluster = { shape, items: [] }; clusters.push(cluster); }
    cluster.items.push(item);
  }
  return clusters;
}

function diversityMetrics(SA, items) {
  const clusters = shapeClusters(SA, items), n = items.length;
  return { clusterCount: clusters.length, population: n,
    largestClusterShare: Math.max(0, ...clusters.map(row => row.items.length)) / Math.max(1, n),
    duplicateRatio: (n - clusters.length) / Math.max(1, n) };
}

// 多样性连续恢复两代后才回退扰动，避免在阈值附近来回跳动。
function adaptiveSettings(metrics, prior = {}) {
  const low = metrics.clusterCount / Math.max(1, metrics.population) < config.diversity.minClusterRatio ||
    metrics.largestClusterShare > config.diversity.maxClusterShare;
  const normalStreak = low ? 0 : (prior.normalStreak || 0) + 1;
  const freshRate = low ? Math.min(config.population.maxFreshRate, (prior.freshRate ?? config.population.freshRate) + 0.1) :
    normalStreak >= 2 ? Math.max(config.population.freshRate, (prior.freshRate ?? config.population.freshRate) - 0.1) : (prior.freshRate ?? config.population.freshRate);
  const mutations = low ? Math.min(config.population.maxStructuralMutations, (prior.mutations || 1) + 1) :
    normalStreak >= 2 ? Math.max(1, (prior.mutations || 1) - 1) : (prior.mutations || 1);
  return { freshRate: Math.round(freshRate * 100) / 100, mutations, normalStreak,
    action: low ? '增加随机车与结构变异' : normalStreak >= 2 ? '逐步恢复基础搜索' : '保持搜索参数' };
}

function evaluateCandidate(SA, candidate, opponents, spec, seed, games, duelCache = null) {
  // 性格不是静态标签：用同一标尺车试跑全部正式行为，教学性格不参加生成。
  const styles = SA.Battle.aiStyles.filter(item => !item.training).map(item => item.id);
  const styleTrials = styles.map((style, i) => {
    const probe = opponents[0] && duel(SA, candidate, opponents[0], { ...spec, style }, seed + 700001 + i * 1009, 1, duelCache);
    return { style, performance: probe?.performance || 0, winRate: probe?.winRate || 0 };
  });
  const boundStyle = spec.fixedStyle ? spec.style : styleTrials.slice().sort((a, b) => (b.performance + b.winRate * 10) - (a.performance + a.winRate * 10))[0]?.style || styleFor(SA, candidate);
  const boundSpec = { ...spec, style: boundStyle };
  const rows = opponents.map((opponent, i) => duel(SA, candidate, opponent, boundSpec, seed + i * 1009, games, duelCache));
  const strengthData = strengthFromRows(rows);
  const performance = rows.reduce((sum, row) => sum + row.performance, 0) / Math.max(1, rows.length);
  const previous = spec.previousVehicle ? duel(SA, candidate, spec.previousVehicle,
    { ...boundSpec, referenceStyle: spec.previousStyle || 'wander' }, seed + 900001, games, duelCache) : null;
  let terrainStrength = strengthData.strength, terrainDelta = 0;
  if (spec.terrain && spec.terrain !== 'flat') {
    const flatRows = opponents.map((opponent, i) => duel(SA, candidate, opponent, { ...boundSpec, terrain: 'flat' }, seed + 800001 + i * 1009, Math.max(1, Math.min(2, games)), duelCache));
    terrainStrength = strengthFromRows(flatRows).strength;
    terrainDelta = strengthData.strength - terrainStrength;
  }
  const sampleIndex = rows.findIndex(row => row.sample);
  const sample = sampleIndex < 0 ? null : { ...rows[sampleIndex].sample,
    opponent: { name: opponents[sampleIndex].name, cells: cellsOf(SA, opponents[sampleIndex]) }, style: boundStyle };
  const stats = SA.V.stats(candidate);
  return { strength: strengthData.strength, strengthCi: strengthData.strengthCi, terrainStrength, terrainDelta, performance, rows,
    previousWinRate: previous?.winRate ?? null, previousGames: previous?.n ?? 0,
    style: boundStyle, evaluationStyle: boundStyle, styleTrials, sample, chassis: chassisFor(SA, candidate), stats, efficiency: efficiencyScore(stats, spec) };
}

function archive(candidates, spec) {
  const minMax = values => ({ min: Math.min(...values), max: Math.max(...values) });
  const featureKeys = ['speed', 'dps', 'hp', 'heatDps', 'water', 'cool', 'rams', 'tether'];
  const featureRange = Object.fromEntries(featureKeys.map(key => {
    const values = candidates.map(item => Number(item.stats[key]) || 0); return [key, minMax(values)];
  }));
  const center = Object.fromEntries(featureKeys.map(key => [key, candidates.reduce((sum, item) => sum + (Number(item.stats[key]) || 0), 0) / Math.max(1, candidates.length)]));
  for (const item of candidates) {
    item.composite = fitness(item);
    item.featureDistance = Math.sqrt(featureKeys.reduce((sum, key) => {
      const range = featureRange[key], width = Math.max(1, range.max - range.min);
      return sum + Math.pow(((Number(item.stats[key]) || 0) - center[key]) / width, 2);
    }, 0));
  }
  const buckets = new Map();
  for (const item of candidates) {
    const key = `${item.style}|${item.chassis}|${spec.terrain}`;
    const list = buckets.get(key) || [];
    list.push(item); list.sort(compareFitness);
    buckets.set(key, list.slice(0, config.archive.cellsPerBucket));
  }
  const all = candidates.slice().sort((a, b) => b.strength - a.strength);
  const toxicLimit = Math.max(1, Math.ceil(all.length * config.archive.toxicTopFraction));
  const toxic = all.slice(0, toxicLimit).filter(x => x.performance < config.archive.toxicPerformanceBelow);
  const median = candidates.slice().sort((a, b) => a.strength - b.strength)[Math.floor(candidates.length / 2)]?.strength || 0;
  const odd = candidates.filter(item => item.strength >= median).sort((a, b) => b.featureDistance - a.featureDistance).slice(0, Math.max(1, Math.ceil(candidates.length * config.archive.oddFraction)));
  for (const item of candidates) {
    item.archiveClass = toxic.includes(item) ? 'toxic' : odd.includes(item) ? 'odd' : 'normal';
  }
  return { buckets: Object.fromEntries(buckets), toxic, odd };
}

// 把候选车转为 content.js 可审阅的补丁；不带名称、剧情、解锁和奖励字段。
function exportPatch(SA, v, spec, boundStyle = null) {
  const ascii = { track: 'T', quad: 'Q', biped: 'B', cockpit: 'K', boiler: 'O', water: 'W', armor: 'A', armor_heavy: 'H', cannon: 'C', mortar: 'P', mg: 'M', side_cannon: 'S', bucket: 'U', spike: 'X', piston: 'Y', cannon_s: 'L', cannon_heavy: 'R', cannon_giant: 'V', rocket_rack: 'G', harpoon: 'J', flamer: 'F', pressure_tank: 'N', pressure_chamber: 'D', condenser: 'E', boss_core: 'I', boss_lens: 'Z', mortar_s: 'a', mg2: 'b', steamjet: 'c' };
  const rows = Array.from({ length: 6 }, () => Array(8).fill('.'));
  const subs = [], sides = [], elite = [];
  SA.V.each(v, (cell, r, c, layer) => {
    if (layer === 'side') { if (cell.id === 'side_cannon') sides.push([Math.floor(r / 2), Math.floor(c / 2)]); return; }
    const id = cell.id, f = SA.fp(id), ch = ascii[id];
    if (r % 2 === 0 && c % 2 === 0 && f.w >= 2 && f.h >= 2 && ch) rows[Math.floor(r / 2)][Math.floor(c / 2)] = ch;
    else if (ch && f.w >= 2 && f.h >= 2 && r % 2 === 0 && c % 2 === 0) rows[Math.floor(r / 2)][Math.floor(c / 2)] = ch;
    else subs.push([r, c, id]);
    if ((cell.mt || 1) !== spec.mat) elite.push([Math.floor(r / 2), Math.floor(c / 2), cell.mt || 1]);
  });
  return { rows: rows.map(row => row.join('')), subs, sides, mt: spec.mat, elite, style: boundStyle || styleFor(SA, v), terrain: spec.terrain };
}

// 完整模块清单 [层(0 主体 / 1 侧挂), 行, 列, id, 材料, 改装等级]：分享码只记布局、不记材料和改装，
// 报告页按种子复现和试驾都要用原样的车（tools/evolve-report.js）
function cellsOf(SA, v) {
  const out = [];
  SA.V.each(v, (cell, r, c, layer) => out.push([layer === 'side' ? 1 : 0, r, c, cell.id, cell.mt || 1, cell.lv || 0]));
  return out;
}

function exactCells(SA, vehicle, cells) {
  const normalized = rows => rows.map(row => JSON.stringify(row)).sort().join('|');
  return normalized(cellsOf(SA, vehicle)) === normalized(cells);
}

function candidateRecord(SA, item, spec, fingerprint) {
  const moduleValues = {};
  SA.V.each(item.vehicle, cell => { moduleValues[cell.id] = (moduleValues[cell.id] || 0) + SA.cellValue(cell); });
  const games = (item.rows || []).reduce((sum, row) => sum + row.n, 0);
  const wins = (item.rows || []).reduce((sum, row) => sum + row.wins, 0);
  const draws = (item.rows || []).reduce((sum, row) => sum + row.draws, 0);
  return { name: item.vehicle.name, code: SA.V.encode(item.vehicle), cells: cellsOf(SA, item.vehicle), evaluationSeed: item.evaluationSeed ?? null,
    patch: exportPatch(SA, item.vehicle, spec, item.style),
    spec: { chapter: spec.chapter, stage: spec.stage, terrain: spec.terrain, rewardModule: spec.rewardModule,
      requiredModules: spec.requiredModules, allowedModules: spec.allowedModules, allowedMaterials: spec.allowedMaterials,
      uniqueLoot: spec.uniqueLoot, budget: spec.budget, budgetStatus: spec.budgetStatus, availableMods: spec.availableMods, target: spec.target },
    style: item.style, styleTrials: item.styleTrials, chassis: item.chassis, archiveClass: item.archiveClass || 'normal',
    strength: item.strength, strengthCi: item.strengthCi, terrainStrength: item.terrainStrength, terrainDelta: item.terrainDelta,
    // 胜率与强度分使用同一批同档标尺对局；换边计入局数，平局计半胜。
    winRate: games ? (wins + draws * 0.5) / games : null, games, wins, draws,
    previousWinRate: item.previousWinRate ?? null, previousGames: item.previousGames || 0,
    opponentCount: item.rows?.length || 0, evaluationStyle: item.evaluationStyle,
    performance: item.performance, efficiency: item.efficiency, ranking: rankingScore(item), fitness: fitness(item), featureDistance: item.featureDistance,
    typical: item.sample ? { winner: item.sample.winner, t: item.sample.t, reason: item.sample.reason, seed: item.sample.seed ?? null, opponent: item.sample.opponent, style: item.sample.style } : null,
    stats: { rating: item.stats.rating, value: item.stats.value, count: item.stats.count, hp: item.stats.hp, dps: item.stats.dps, heatDps: item.stats.heatDps, water: item.stats.water, cool: item.stats.cool },
    moduleValues, rules: fingerprint };
}

// 奖励件生效门槛使用同一批种子做两种朝向，避免只记录“候选当玩家”造成偏差。
function usageAgainst(SA, candidate, opponent, spec, seed, games = 2, rewardId = null) {
  const total = { fire: 0, hit: 0, ricochet: 0, chargedHit: 0, ram: 0, knock: 0, terrainBlock: 0, highHit: 0, destroyed: 0 };
  const module = {};
  const add = events => { for (const key of Object.keys(total)) total[key] += Number(events?.[key]) || 0; };
  const addModule = stats => {
    if (!rewardId) return;
    const row = stats?.[rewardId];
    if (!row) return;
    for (const key of ['active', 'fire', 'hit', 'tether', 'energy', 'waterSaved', 'dryCool']) module[key] = (module[key] || 0) + (Number(row[key]) || 0);
  };
  for (let i = 0; i < games; i++) {
    const direct = SA.Battle.simulate({ p: candidate, e: opponent, pAim: 0.8, eAim: 0.8, pStyle: spec.style || 'wander', eStyle: 'wander', terrain: spec.terrain, bounds: spec.bounds, seed: seed + i * 2 });
    const reverse = SA.Battle.simulate({ p: opponent, e: candidate, pAim: 0.8, eAim: 0.8, pStyle: 'wander', eStyle: spec.style || 'wander', terrain: spec.terrain, bounds: spec.bounds, seed: seed + i * 2 + 1 });
    add(direct.events?.p); add(reverse.events?.e); addModule(direct.effectStats?.p); addModule(reverse.effectStats?.e);
  }
  return { ...total, module };
}

function replacementFor(SA, vehicle, targetId, spec) {
  let target = null;
  SA.V.each(vehicle, (cell, r, c, layer) => { if (!target && cell.id === targetId) target = { r, c, layer }; });
  if (!target || target.layer !== 'body') return null;
  const targetFp = SA.fp(targetId);
  const replacement = ['plate', 'armor', 'armor_heavy'].find(id => {
    if (id === targetId) return false;
    const f = SA.fp(id); return f.w === targetFp.w && f.h === targetFp.h;
  });
  if (!replacement) return null;
  const out = SA.V.clone(vehicle);
  const removed = SA.V.remove(out, target.layer, target.r, target.c);
  if (!removed?.ok) return null;
  const check = SA.V.canPut(out, replacement, target.r, target.c);
  if (!check.ok || !check.fit) return null;
  out.body[target.r][target.c] = SA.newCell(replacement, spec.mat);
  return legalVehicle(SA, out, spec) ? out : null;
}

// 每关选车只用本轮候选，以真正的前关入选车做目标胜率验收。
// Boss 旧门槛不再阻止选车；未达到相邻关难度时明确返回空选车。
function stageCandidates(SA, scored, spec) {
  return scored.filter(item => legalVehicle(SA, item.vehicle, spec)).sort(compareFitness).slice(0, 8);
}

function selectStageCandidate(SA, scored, spec, reference, fingerprint, seed, recent = [], duelCache = null, validationResults = null) {
  // 同步与异步共用同一候选顺序和最终证据；异步只预先计算相互独立的 120 局结果。
  const candidates = stageCandidates(SA, scored, spec);
  if (validationResults && validationResults.length !== candidates.length) throw new Error('复测结果与候选数量不一致');
  if (validationResults && reference?.vehicle && validationResults.some(row => !row || row.n !== config.evaluation.finalDuelGames * 2 || !Number.isFinite(row.winRate)))
    throw new Error('复测结果缺失或场次不完整');
  const history = Array.isArray(recent) ? recent : [];
  const verified = candidates.map((item, index) => {
    const conditions = constructionConditions(SA, item.vehicle, spec);
    const validationSeed = seed + 100000000 + index * 100003;
    const result = reference?.vehicle ? validationResults ? validationResults[index] : duel(SA, item.vehicle, reference.vehicle,
      { ...spec, style: item.style, referenceStyle: reference.style || 'wander' },
      validationSeed, config.evaluation.finalDuelGames, duelCache) : null;
    const targetPass = !result || difficultyDistance(result.winRate) === 0;
    const evidence = { ...conditions, rewardPresent: conditions.reward, style: item.style,
      performance: item.performance, strength: item.strength, previousWinRate: result?.winRate ?? null,
      previousGames: result?.n ?? 0, previousWins: result?.wins ?? 0, previousDraws: result?.draws ?? 0,
      previousName: reference?.vehicle?.name || null, previousStyle: reference?.style || null,
      validationSeed: result ? validationSeed : null, target: [config.difficulty.min, config.difficulty.max],
      targetPass, hardConditions: { ...conditions, target: targetPass } };
    evidence.failed = Object.entries(evidence.hardConditions).filter(([, pass]) => !pass).map(([key]) => key);
    const distinct = history.every(row => shapeSimilarity(SA, item.vehicle, row.vehicle || row) < config.diversity.similarAt);
    return { item, evidence, distinct };
  });
  const qualified = verified.filter(row => !row.evidence.failed.length);
  qualified.sort((a, b) => Number(b.distinct) - Number(a.distinct) || fitness(b.item) - fitness(a.item) || b.item.performance - a.item.performance);
  const chosen = qualified[0] || null;
  const diagnostic = verified.slice().sort((a, b) =>
    difficultyDistance(a.evidence.previousWinRate) - difficultyDistance(b.evidence.previousWinRate) ||
    compareFitness(a.item, b.item))[0];
  const diversity = diversityMetrics(SA, qualified.map(row => row.item));
  const warning = qualified.length && diversity.clusterCount < config.diversity.finalMinClusters ? '多样性不足' : null;
  return { selected: chosen?.item || null, evidence: chosen?.evidence || diagnostic?.evidence || null,
    candidateCount: candidates.length, verified: verified.map(row => ({ name: row.item.vehicle.name, ...row.evidence })),
    diversity, warning, fingerprint };
}

async function selectStageCandidateAsync(SA, scored, spec, reference, fingerprint, seed, recent, pool, duelCache = null, prepareHeat = null) {
  const candidates = stageCandidates(SA, scored, spec);
  const results = reference?.vehicle ? new Array(candidates.length) : null, pending = [];
  // 与同步 duel 使用同一个缓存键；命中不再派发，未命中按原候选索引回填。
  candidates.forEach((item, index) => {
    if (!reference?.vehicle) return;
    const duelSpec = { ...spec, style: item.style, referenceStyle: reference.style || 'wander' };
    const validationSeed = seed + 100000000 + index * 100003;
    const key = duelCache?.key(item.vehicle, reference.vehicle, duelSpec, validationSeed, config.evaluation.finalDuelGames);
    const cached = key ? duelCache.get(key) : null;
    if (cached) { results[index] = cached; return; }
    pending.push({ index, key, task: { kind: 'duel', candidate: item.vehicle, opponent: reference.vehicle,
      spec: duelSpec, seed: validationSeed, games: config.evaluation.finalDuelGames } });
  });
  if (pending.length) {
    await prepareHeat?.(pending.map(row => row.task));
    const computed = await pool.evaluate(pending.map(row => row.task));
    pending.forEach((row, index) => {
      results[row.index] = computed[index];
      if (row.key) duelCache.set(row.key, computed[index]);
    });
  }
  return selectStageCandidate(SA, scored, spec, reference, fingerprint, seed, recent, null, results);
}

// 同步与 worker 搜索共用人口补齐、分簇留种和动态调节，避免两条路径逐渐分叉。
function initialPopulation(SA, spec, previous, rng, seeds = []) {
  const wanted = Math.max(4, spec.populationSize || config.population.size, seeds.length);
  const population = [...seeds];
  if (population.some(vehicle => !legalVehicle(SA, vehicle, spec))) throw new Error('进化种子违反本关构筑、奖励或材料约束');
  const inherited = previous.map(vehicle => adaptParentForStage(SA, vehicle, spec, rng)).filter(Boolean);
  for (const vehicle of inherited) if (population.length < wanted) population.push(vehicle);
  while (population.length < wanted) {
    let vehicle = inherited.length && rng.chance(1 - config.population.freshRate) ? mutate(SA, rng.pick(inherited), spec, rng) : null;
    if (!vehicle) vehicle = requiredVehicle(SA, spec, rng);
    if (!vehicle) throw new Error(`第 ${spec.chapter + 1} 章第 ${spec.stage + 1} 关无法在 £${spec.budget} 与解锁限制下构筑全部奖励件`);
    population.push(vehicle);
  }
  return population;
}

function survivorPool(SA, scored, count) {
  const clusters = shapeClusters(SA, scored), selected = [];
  for (const cluster of clusters) if (selected.length < count) selected.push(cluster.items[0]);
  for (const cluster of clusters) if (selected.length < count && cluster.items[1]) selected.push(cluster.items[1]);
  return selected;
}

function nextPopulation(SA, spec, scored, seeds, rng, settings) {
  const wanted = scored.length, count = Math.max(2, Math.ceil(wanted * config.population.survivors));
  const keep = survivorPool(SA, scored, count), current = [], seen = new Set();
  const add = vehicle => {
    const key = JSON.stringify(cellsOf(SA, vehicle));
    if (current.length >= wanted || seen.has(key)) return false;
    current.push(vehicle); seen.add(key); return true;
  };
  for (const item of keep) add(item.vehicle);
  const seedRetention = seeds.map((vehicle, sourceIndex) => ({ sourceIndex, name: vehicle.name,
    retained: current.includes(vehicle),
    reason: current.includes(vehicle) ? '留种' : keep.some(item => item.vehicle === vehicle) ? '与已留种车辆完全重复' : '形态簇名额或排序未入选' }));
  const freshTarget = Math.ceil(wanted * settings.freshRate);
  let fresh = 0, attempts = 0, freshAttempts = 0;
  while (current.length < wanted && attempts++ < wanted * 128) {
    let vehicle = null, isFresh = false;
    if ((fresh < freshTarget && freshAttempts < wanted * 8) || !keep.length) {
      vehicle = requiredVehicle(SA, spec, rng); isFresh = true; freshAttempts++;
    }
    else {
      vehicle = SA.V.clone(rng.pick(keep).vehicle);
      for (let i = 0; i < settings.mutations; i++) {
        const changed = mutate(SA, vehicle, spec, rng, null, true);
        if (changed) vehicle = changed;
      }
    }
    if (vehicle && legalVehicle(SA, vehicle, spec) && add(vehicle) && isFresh) fresh++;
  }
  while (current.length < wanted) current.push(SA.V.clone(rng.pick(keep).vehicle));
  return { population: current, seedRetention };
}

function generationState(SA, scored, settings, generation) {
  const metrics = diversityMetrics(SA, scored), next = adaptiveSettings(metrics, settings);
  const difficultyQualified = scored.some(item => difficultyDistance(item.previousWinRate) === 0);
  return { generation, ...metrics, difficultyQualified, freshRate: next.freshRate,
    structuralMutations: next.mutations, action: next.action, settings: next };
}

function generateChapter(SA, spec, previous, opponents, rng, fingerprint, quickGames, duelCache = null, verify = null) {
  let current = initialPopulation(SA, spec, previous, rng), settings = {}, best = null;
  const generationMetrics = [];
  const limit = config.population.generations + config.population.maxExtraGenerations;
  for (let generation = 0; generation < limit; generation++) {
    const scored = current.map((vehicle, index) => {
      const evalSeed = rng.int(0x7fffffff) + index;
      const result = evaluateCandidate(SA, vehicle, opponents, spec, evalSeed, quickGames, duelCache);
      return { vehicle, evaluationSeed: evalSeed, ...result };
    }).sort(compareFitness);
    const state = generationState(SA, scored, settings, generation); generationMetrics.push(state); settings = state.settings;
    const verified = generation + 1 >= config.population.generations ? verify?.(scored) : null;
    state.validationGames = verified?.verified.reduce((sum, row) => sum + row.previousGames, 0) || 0;
    state.validationQualified = !!verified?.selected;
    if (verified?.selected && (!best || verified.diversity.clusterCount > best.selection.diversity.clusterCount)) best = { scored, selection: verified };
    const ready = verify ? verified?.selected && verified.diversity.clusterCount >= config.diversity.finalMinClusters :
      state.difficultyQualified && state.clusterCount >= config.diversity.finalMinClusters;
    if (generation + 1 >= limit || (generation + 1 >= config.population.generations && ready)) {
      const final = best || { scored, selection: verified };
      return { scored: final.scored, selection: final.selection, archive: archive(final.scored, spec), generationMetrics };
    }
    const next = nextPopulation(SA, spec, scored, [], rng, settings);
    state.seedRetention = next.seedRetention;
    current = next.population;
  }
  return { scored: [], archive: { buckets: {}, toxic: [], odd: [] }, generationMetrics };
}

// 异步进化：随机种子、车辆生成和最终排序仍在主线程按原顺序执行；
// 相互独立的候选评分与最终复测交给常驻 worker，不改变固定种子结果。
async function generateChapterAsync(SA, spec, previous, opponents, rng, quickGames, pool, onProgress, shouldStop, telemetry, seeds = [], verify = null, prepareHeat = null) {
  let current = initialPopulation(SA, spec, previous, rng, seeds), settings = {};
  const generationMetrics = [], limit = config.population.generations + config.population.maxExtraGenerations;
  let best = null;
  for (let generation = 0; generation < limit; generation++) {
    if (shouldStop?.()) return { interrupted: true };
    const tasks = current.map((vehicle, index) => ({ vehicle, opponents,
      spec: seeds.includes(vehicle) && vehicle.arenaStyle ? { ...spec, style: vehicle.arenaStyle, fixedStyle: true } : spec,
      seed: rng.int(0x7fffffff) + index, games: quickGames, performance: config.performance }));
    await prepareHeat?.(tasks);
    onProgress?.({ phase: 'generation-start', chapter: spec.chapter, stage: spec.stage, generation, completed: 0, total: tasks.length });
    let completed = 0;
    const scored = (await Promise.all(tasks.map((task, index) => pool.evaluate([task]).then(([result]) => {
      completed++; telemetry.completedCandidates++;
      onProgress?.({ phase: 'candidate', chapter: spec.chapter, stage: spec.stage, generation, completed, total: tasks.length, index });
      return { vehicle: task.vehicle, evaluationSeed: task.seed, ...result };
    })))).sort(compareFitness);
    const state = generationState(SA, scored, settings, generation); generationMetrics.push(state); settings = state.settings;
    const verified = generation + 1 >= config.population.generations ? await verify?.(scored) : null;
    state.validationGames = verified?.verified.reduce((sum, row) => sum + row.previousGames, 0) || 0;
    state.validationQualified = !!verified?.selected;
    if (verified?.selected && (!best || verified.diversity.clusterCount > best.selection.diversity.clusterCount)) best = { scored, selection: verified };
    onProgress?.({ phase: 'generation-end', chapter: spec.chapter, stage: spec.stage, generation, completed, total: tasks.length, generationMetrics: state });
    const ready = verify ? verified?.selected && verified.diversity.clusterCount >= config.diversity.finalMinClusters :
      state.difficultyQualified && state.clusterCount >= config.diversity.finalMinClusters;
    if (generation + 1 >= limit || (generation + 1 >= config.population.generations && ready)) {
      const final = best || { scored, selection: verified };
      return { scored: final.scored, selection: final.selection, archive: archive(final.scored, spec), generationMetrics };
    }
    const next = nextPopulation(SA, spec, scored, seeds, rng, settings);
    state.seedRetention = next.seedRetention;
    current = next.population;
  }
  return { scored: [], archive: { buckets: {}, toxic: [], odd: [] }, generationMetrics };
}

function campaignOpponents(SA, chapter, stage, previewSpec = null) {
  // 评分标尺也按本关预算和模块表构筑，不能继续拿旧的越级关卡车评估新手区段。
  const spec = previewSpec || stageSpec(SA, chapter, stage);
  return Array.from({ length: config.evaluation.anchorCount }, (_, i) => {
    const v = i < 2 ? minimalVehicle(SA, spec, i === 1 ? spec.rewardModule : null) :
      randomVehicle(SA, spec, new RNG(731001 + chapter * 1009 + stage * 101 + i)) || minimalVehicle(SA, spec);
    if (!v) throw new Error(`${SA.CAMPAIGN[chapter].name} · 第 ${stage + 1} 关「${spec.name}」无法生成${i === 1 && spec.rewardModule ? `含奖励件「${SA.MODULES[spec.rewardModule].name}」的` : ''}合法标尺车（预算 £${spec.budget}）`);
    v.name = `同档标尺·${chapter + 1}-${stage + 1}-${i + 1}`;
    return v;
  });
}

// 每关完成后立即验收和确定前关父本；报告保留未通过时的前八名诊断车。
function completedStage(SA, spec, result, reference, recent, fingerprint, seed, duelCache, origin = null, games = 6) {
  const top = result.scored.slice(0, 8), records = top.map(item => candidateRecord(SA, item, spec, fingerprint));
  const selection = result.selection || selectStageCandidate(SA, top, spec, reference, fingerprint, seed, recent, duelCache);
  const selectedIndex = top.indexOf(selection.selected);
  const bucketCount = Object.keys(result.archive.buckets).length;
  const archiveReport = { buckets: bucketCount, coveredRatio: bucketCount / Math.max(1, result.scored.length),
    toxic: result.archive.toxic.length, odd: result.archive.odd.length,
    toxicCodes: result.archive.toxic.map(item => SA.V.encode(item.vehicle)),
    oddCodes: result.archive.odd.map(item => SA.V.encode(item.vehicle)),
    toxicCells: result.archive.toxic.map(item => cellsOf(SA, item.vehicle)),
    oddCells: result.archive.odd.map(item => cellsOf(SA, item.vehicle)) };
  const againstOrigin = origin && selection.selected ? duel(SA, selection.selected.vehicle, origin.vehicle,
    { ...spec, style: selection.selected.style, referenceStyle: origin.style || 'wander' }, seed + 17001, games, duelCache) : null;
  return { spec, count: result.scored.length, selected: selectedIndex >= 0 ? records[selectedIndex] : null,
    originComparison: againstOrigin ? { name: origin.vehicle.name, winRate: againstOrigin.winRate,
      games: againstOrigin.n, wins: againstOrigin.wins, draws: againstOrigin.draws } : null,
    selection: { ...selection.evidence, candidateCount: selection.candidateCount, hardConditions: selection.evidence?.hardConditions || {},
      failed: selection.evidence?.failed || ['target'], selectedIndex, verified: selection.verified, warning: selection.warning },
    diversity: selection.diversity, generationMetrics: (result.generationMetrics || []).map(({ settings, ...row }) => row),
    top: records, archive: archiveReport };
}

// 后续十五关仍是审阅稿；机械覆盖检查可读规格，生成入口不能擅自整批重生成。
function requireReviewedRange(chapters) {
  const draft = stageRules.find(row => row.chapter < chapters && row.status === 'draft');
  if (draft) throw new Error(`第 ${draft.chapter + 1} 章起的预算与模块表仍待审阅，目前只允许生成序章前两关`);
}

// 补丁只允许在内存里应用到未锁定的原始关卡；锁定记录绝不触碰 stage-cars.js。
function applyStagePatch(SA, chapter, stage, patch = {}) {
  const actual = stageFor(SA, chapter, stage);
  if (!actual) return { applied: false, reason: '关卡不存在' };
  if (actual.source === 'manual' && actual.locked) return { applied: false, reason: '手工锁定，未改动', locked: true };
  const target = SA.CAMPAIGN[chapter].stages[stage];
  // 已解锁的手工记录仍由 stage-cars.js 管理；补丁更新记录本身，避免写入
  // content.js 后又被手工记录覆盖。没有手工记录时才改原始战役字段。
  if (actual.source === 'manual' && actual.stageCar && SA.StageCars?.makeRecord) {
    const base = { ...target, ...actual };
    const vehicle = patch.cells
      ? SA.V.fromCells(actual.name || target.name, patch.cells)
      : SA.V.fromAscii(actual.name || target.name, patch.rows || actual.rows, patch.sides || actual.sides || [], patch.mt || actual.mt || 1, patch.elite || actual.elite || [], patch.subs || actual.subs || []);
    const next = SA.StageCars.makeRecord(chapter, stage, base, vehicle, {
      ...actual.stageCar, ...patch, name: actual.name, pilot: actual.pilot, blurb: actual.blurb, weakness: actual.weakness,
      style: patch.style ?? actual.style, aim: patch.aim ?? actual.aim, terrain: patch.terrain ?? actual.terrain,
      boss: patch.boss ?? actual.boss, prize: actual.prize, unlock: actual.unlock, uniqueLoot: actual.uniqueLoot, locked: false,
    });
    SA.STAGE_CARS.records[`${chapter}:${stage}`] = next;
    if (SA.StageCars.data) SA.StageCars.data.records = SA.STAGE_CARS.records;
    if (SA.StageCars.applyToCampaign) SA.StageCars.applyToCampaign();
    return { applied: true, manual: true, record: next, stage: SA.CAMPAIGN[chapter].stages[stage] };
  }
  for (const key of ['rows', 'subs', 'sides', 'mt', 'elite', 'style', 'terrain', 'boss']) if (patch[key] !== undefined) target[key] = patch[key];
  return { applied: true, stage: target };
}

// 同步与并行生成共用原点拒绝提示；坐标按整张工作台子格从左上角 1 起算，便于逐件修正。
function requireOriginDeployable(SA, vehicle, grid, stats) {
  if (stats.canDeploy) return;
  // 原点按关卡范围校验；宽工作台未必标红，也不应引导关卡作者推进玩家战役。
  const problems = stats.problems.map(problem => problem.replace('（车间里红色闪烁）', ''));
  const lockedReason = SA.Config.text('vehicle_bd09be8e512a');
  const details = stats.issues.map(issue => {
    const cell = vehicle[issue.layer][issue.r][issue.c], name = SA.MODULES[cell.id].name;
    const reason = issue.reason === lockedReason ? '超出本关进化可用范围' : issue.reason;
    return `${issue.layer === 'side' ? '侧挂层' : '主体层'}·${name}·子格第 ${issue.c + 1} 列、第 ${issue.r + 1} 行：${reason}`;
  });
  throw new Error(`上一关不能出战：原点车「${vehicle.name}」；校验范围 ${grid.cols}列×${grid.rows}层。${problems.join('；')}` +
    (details.length ? `。模块问题（子格从工作台左上角 1 起算）：${details.join('；')}` : '') +
    '。测试副本需显式修正并记录');
}

function run(options = {}) {
  const { SA } = loadGame(), fingerprint = ruleFingerprint(SA);
  const scope = options.scope, route = scope?.type === 'route-after' ? routeAfter(SA, scope.origin, scope.count) : null;
  const chapters = options.firstStageOnly ? 1 : Math.min(options.chapters || SA.CAMPAIGN.length, SA.CAMPAIGN.length);
  if (!scope) requireReviewedRange(chapters);
  const rows = route || (scope ? plannedRoute(SA).filter(row => row.chapter === scope.chapter && (scope.stage == null || row.stage === scope.stage)) :
    plannedRoute(SA).filter(row => row.chapter < chapters && row.stage < (options.firstStageOnly ? 1 : options.firstTwoStages ? 2 : Infinity) &&
      SA.CAMPAIGN[row.chapter].stages[row.stage] && !SA.CAMPAIGN[row.chapter].stages[row.stage].unfinished));
  if (!rows.length) throw new Error('没有可生成的关卡');
  const seed = options.seed || 20260925, rng = new RNG(seed), quickGames = options.games || config.evaluation.quickGames;
  const duelCache = options.cache === false ? null : createDuelCache(SA), all = [], chapterReports = [], selectionFailures = [];
  const firstIndex = plannedRoute(SA).findIndex(row => row.chapter === rows[0].chapter && row.stage === rows[0].stage);
  const source = route ? scope.origin : firstIndex > 0 ? plannedRoute(SA)[firstIndex - 1] : null;
  let origin = null;
  if (source && source.stage >= 0) {
    const sourceSpec = previewStageSpec(SA, source.chapter, source.stage);
    const actual = stageFor(SA, source.chapter, source.stage);
    const vehicle = options.originVehicle ? SA.V.fromCells(options.originVehicle.name || '原点关卡车', options.originVehicle.cells) : actual?.vehicle;
    if (!vehicle) throw new Error('上一关缺少已入选车或原点测试车');
    if (options.originVehicle && !exactCells(SA, vehicle, options.originVehicle.cells))
      throw new Error('原点车辆包含无效模块或布局，不能静默丢弃');
    vehicle.lim = { ...sourceSpec.grid };
    requireOriginDeployable(SA, vehicle, sourceSpec.grid, SA.V.stats(vehicle));
    origin = { vehicle, style: options.originVehicle?.style || actual?.style || 'wander' };
  }
  let reference = origin, previous = origin ? [origin.vehicle] : [], recent = origin ? [origin] : [], status = 'complete';
  for (const row of rows) {
    const { chapter, stage } = row, actual = stageFor(SA, chapter, stage);
    const spec = scope ? previewStageSpec(SA, chapter, stage) : stageSpec(SA, chapter, stage);
    let chapterReport = chapterReports.find(item => item.chapter === chapter);
    if (!chapterReport) { chapterReport = { chapter, name: SA.CAMPAIGN[chapter].name, stages: [] }; chapterReports.push(chapterReport); }
    if (actual?.source === 'manual' && actual.locked && !scope) {
      const record = manualCandidateRecord(SA, actual, chapter, stage, fingerprint);
      const report = lockedStageReport({ spec, records: [record], archive: {} }, selectionFailures, SA, reference,
        seed + chapter * 10000 + stage * 101, duelCache);
      chapterReport.stages.push(report); all.push(record);
      if (!report.selected) { status = 'failed'; break; }
      reference = { vehicle: actual.vehicle, style: record.style }; previous = [actual.vehicle]; recent = [reference, ...recent].slice(0, 3);
      continue;
    }
    if (reference && !SA.V.stats(reference.vehicle).canDeploy) throw new Error('上一关入选车不能出战');
    const evaluationSpec = { ...spec, previousVehicle: reference?.vehicle || null, previousStyle: reference?.style || null };
    const opponents = campaignOpponents(SA, chapter, stage, spec);
    const selectionSeed = seed + chapter * 10000 + stage * 101;
    const verify = scored => selectStageCandidate(SA, scored, spec, reference, fingerprint, selectionSeed, recent, duelCache);
    const result = generateChapter(SA, evaluationSpec, previous, opponents, rng, fingerprint, quickGames, null, verify);
    const report = completedStage(SA, spec, result, reference, recent, fingerprint, selectionSeed, duelCache, origin, quickGames);
    chapterReport.stages.push(report); all.push(...report.top);
    if (!report.selected) {
      selectionFailures.push({ chapter, stage, name: spec.name, failed: report.selection.failed });
      status = 'failed'; break;
    }
    const selected = result.scored[report.selection.selectedIndex];
    reference = { vehicle: selected.vehicle, style: selected.style };
    previous = [reference.vehicle]; recent = [reference, ...recent].slice(0, 3);
  }
  if (options.strict && selectionFailures.length) throw new Error('选关硬条件未全部满足：' + JSON.stringify(selectionFailures));
  const moduleValues = Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, SA.CAMP_START.mat)]));
  return { campaignLayout: SA.CAMPAIGN_LAYOUT, status, generatedAt: new Date().toISOString(), seed, rules: fingerprint,
    moduleValues, config, cache: duelCache ? duelCache.summary() : { disabled: true }, chapters: chapterReports,
    selectionFailures, candidates: all, scope };
}

function checkpointChapter(chapter, pendingStages, SA) {
  return pendingStages ? { chapter, name: SA.CAMPAIGN[chapter]?.name, stages: pendingStages.map(entry => ({ spec: entry.spec, count: entry.count, top: entry.records, archive: entry.archive, selected: null, selection: null })) } : null;
}

// GPU 只为静态过热预测预热缓存；不确定的单项以同一辆车的精确 CPU stats 补算。
async function createThermalPreheater(SA, options, telemetry) {
  let runtime = null, failure = null;
  const known = new Map();
  const precision = options.gpuPrecision === 'certified' ? 'certified' : 'f32';
  const heat = telemetry.heat = { backend: 'cpu', precision: options.gpu === false ? null : precision,
    approximate: precision === 'f32' && options.gpu !== false, adapter: null, batchItems: 0,
    gpuPredictions: 0, certified: 0, cpuFallbacks: 0, avoidedCpuCalls: 0,
    gpuDispatchReadbackMs: 0, gpuRoundTripMs: 0, elapsedMs: 0, fallbackReasons: {} };
  const diagnostic = phase => options.onDiagnostics?.({ phase, elapsedMs: Date.now() - telemetry.startedAt,
    heat: { ...heat, fallbackReasons: { ...heat.fallbackReasons } } });
  diagnostic('heat-init-start');
  if (options.gpu !== false) {
    try {
      const { createGpuHeatRuntime } = require('./evolve-gpu-heat');
      runtime = await createGpuHeatRuntime({ signal: options.signal, precision });
      heat.gpuReady = !!runtime.available;
      heat.adapter = runtime.adapter || null;
      if (!runtime.available) { failure = runtime.reason || 'GPU 不可用'; runtime = null; }
    } catch (error) { failure = error?.message || String(error); }
  } else failure = 'GPU 已关闭';
  if (failure) heat.fallbackReasons[failure] = 1;
  diagnostic('heat-init-end');
  async function prepare(tasks) {
    diagnostic('heat-prepare-start');
    const started = Date.now(), missing = [], vehicles = [], seen = new Map(), taskKeys = new Map();
    for (const task of tasks) {
      const keys = [];
      for (const vehicle of [task.vehicle, task.candidate, task.opponent,
        ...(task.opponents || []), task.spec?.previousVehicle]) {
        if (!vehicle) continue;
        let key = seen.get(vehicle);
        if (!key) {
          let input;
          SA.V.stats(vehicle, { deferHeat: true, captureThermalInput: value => { input = value; } });
          key = JSON.stringify(Object.values(input).map(value => Number.isFinite(value) ? value : String(value))); seen.set(vehicle, key);
          if (!known.has(key)) {
            const cached = SA.V.thermalPrediction(input);
            known.set(key, cached);
            if (!cached) { missing.push(input); vehicles.push(vehicle); }
          }
        }
        keys.push(key);
      }
      taskKeys.set(task, keys);
    }
    if (missing.length) {
      heat.batchItems += missing.length;
      let steps = null;
      if (runtime) {
        try {
          const result = await runtime.predict(missing);
          steps = result.steps;
          heat.adapter = result.telemetry?.adapter || heat.adapter;
          // 页面墙钟从 writeBuffer 调用后计起，含提交、读回和输出复制，不是硬件 kernel 计时。
          heat.gpuDispatchReadbackMs += result.telemetry?.gpuDispatchReadbackMs || 0;
          heat.gpuRoundTripMs += result.telemetry?.roundTripMs || 0;
          if ((!Array.isArray(steps) && !ArrayBuffer.isView(steps)) || steps.length !== missing.length) throw new Error('GPU 返回条数不匹配');
        } catch (error) {
          const reason = error?.message || String(error);
          heat.fallbackReasons[reason] = (heat.fallbackReasons[reason] || 0) + missing.length;
          steps = null;
        }
      }
      for (let i = 0; i < missing.length; i++) {
        let step = steps?.[i];
        const gpuValid = Number.isInteger(step) && step >= 0 && step <= 600;
        if (!gpuValid) {
          const exact = SA.V.stats(vehicles[i]);
          step = SA.V.thermalPrediction(missing[i])?.steps ?? (Number.isFinite(exact.overheat) ? Math.round(exact.overheat * 2) : 0);
          heat.cpuFallbacks++;
          if (steps?.[i] === -1) heat.fallbackReasons.uncertain = (heat.fallbackReasons.uncertain || 0) + 1;
        } else {
          heat.gpuPredictions++; heat.avoidedCpuCalls++;
          if (precision === 'certified') heat.certified++;
        }
        const entry = { input: missing[i], steps: step, source: gpuValid ? 'gpu' : 'cpu' };
        known.set(JSON.stringify(Object.values(missing[i]).map(value => Number.isFinite(value) ? value : String(value))), entry);
        SA.V.installThermalPredictions([entry]);
      }
    }
    for (const task of tasks) task.thermalPredictions = [...new Set(taskKeys.get(task))].map(key => known.get(key)).filter(Boolean);
    heat.elapsedMs += Date.now() - started;
    diagnostic('heat-prepare-end');
  }
  return { prepare, close: () => runtime?.close?.() };
}

// 长跑入口：候选评分使用常驻 worker，阶段边界写入进度和检查点；同步 run() 保留给旧工具。
async function runAsync(options = {}) {
  const { SA } = loadGame(), fingerprint = ruleFingerprint(SA);
  const scope = options.scope, route = scope?.type === 'route-after' ? routeAfter(SA, scope.origin, scope.count) : null;
  const chapters = options.firstStageOnly ? 1 : Math.min(options.chapters || SA.CAMPAIGN.length, SA.CAMPAIGN.length);
  if (!scope) requireReviewedRange(chapters);
  const rows = route || (scope ? plannedRoute(SA).filter(row => row.chapter === scope.chapter && (scope.stage == null || row.stage === scope.stage)) :
    plannedRoute(SA).filter(row => row.chapter < chapters && row.stage < (options.firstStageOnly ? 1 : options.firstTwoStages ? 2 : Infinity) &&
      SA.CAMPAIGN[row.chapter].stages[row.stage] && !SA.CAMPAIGN[row.chapter].stages[row.stage].unfinished));
  if (!rows.length) throw new Error('没有可生成的关卡');
  const seed = options.seed || 20260925, rng = new RNG(seed), quickGames = options.games || config.evaluation.quickGames;
  const requestedWorkers = options.workers == null ? config.defaultWorkers :
    typeof options.workers === 'string' ? Number(options.workers) : options.workers;
  if (!Number.isInteger(requestedWorkers) || requestedWorkers < 1 || requestedWorkers > config.maxWorkers)
    throw new Error(`并行数必须是 1～${config.maxWorkers} 的整数`);
  const workerCount = requestedWorkers;
  const duelCache = createDuelCache(SA), all = [], chapterReports = [], selectionFailures = [], seedWarnings = [];
  const telemetry = { startedAt: Date.now(), workerCount, completedCandidates: 0, completedStages: 0,
    completedChapters: 0, completedSteps: 0, totalSteps: rows.length * (config.population.generations + config.population.maxExtraGenerations) *
      config.population.size + rows.length * 2 };
  const firstIndex = plannedRoute(SA).findIndex(row => row.chapter === rows[0].chapter && row.stage === rows[0].stage);
  const source = route ? scope.origin : firstIndex > 0 ? plannedRoute(SA)[firstIndex - 1] : null;
  let origin = null;
  if (source && source.stage >= 0) {
    const sourceSpec = previewStageSpec(SA, source.chapter, source.stage);
    const actual = stageFor(SA, source.chapter, source.stage);
    const vehicle = options.originVehicle ? SA.V.fromCells(options.originVehicle.name || '原点关卡车', options.originVehicle.cells) : actual?.vehicle;
    if (!vehicle) throw new Error('上一关缺少已入选车或原点测试车');
    if (options.originVehicle && !exactCells(SA, vehicle, options.originVehicle.cells))
      throw new Error('原点车辆包含无效模块或布局，不能静默丢弃');
    vehicle.lim = { ...sourceSpec.grid };
    requireOriginDeployable(SA, vehicle, sourceSpec.grid, SA.V.stats(vehicle, { deferHeat: true }));
    origin = { vehicle, style: options.originVehicle?.style || actual?.style || 'wander' };
  }
  const preheater = await createThermalPreheater(SA, options, telemetry);
  let pool;
  try { pool = createEvaluationPool(workerCount, { splitFinalDuels: options.splitFinalDuels }); }
  catch (error) { await preheater.close(); throw error; }
  let reference = origin, previous = origin ? [origin.vehicle] : [], recent = origin ? [origin] : [], status = 'complete';
  const progress = event => {
    if (['candidate', 'stage-end', 'selection-end'].includes(event.phase)) telemetry.completedSteps++;
    options.onProgress?.({ ...event, completedSteps: telemetry.completedSteps, totalSteps: telemetry.totalSteps,
      elapsedMs: Date.now() - telemetry.startedAt });
  };
  const checkpoint = () => options.onCheckpoint?.({ campaignLayout: SA.CAMPAIGN_LAYOUT, status,
    generatedAt: new Date().toISOString(), seed, rules: fingerprint, config, chapters: chapterReports,
    candidates: all, selectionFailures, cache: duelCache.summary(),
    telemetry: { ...telemetry, elapsedMs: Date.now() - telemetry.startedAt } });
  progress({ phase: 'start', total: rows.length });
  try {
    for (const row of rows) {
      if (options.shouldStop?.()) { status = 'interrupted'; break; }
      const { chapter, stage } = row, actual = stageFor(SA, chapter, stage);
      const spec = scope ? previewStageSpec(SA, chapter, stage) : stageSpec(SA, chapter, stage);
      let chapterReport = chapterReports.find(item => item.chapter === chapter);
      if (!chapterReport) { chapterReport = { chapter, name: SA.CAMPAIGN[chapter].name, stages: [] }; chapterReports.push(chapterReport); }
      progress({ phase: 'stage-start', chapter, stage, locked: !!(actual?.source === 'manual' && actual.locked && !scope) });
      if (actual?.source === 'manual' && actual.locked && !scope) {
        const record = manualCandidateRecord(SA, actual, chapter, stage, fingerprint);
        const report = lockedStageReport({ spec, records: [record], archive: {} }, selectionFailures, SA, reference,
          seed + chapter * 10000 + stage * 101, duelCache);
        chapterReport.stages.push(report); all.push(record);
        if (!report.selected) { status = 'failed'; break; }
        reference = { vehicle: actual.vehicle, style: record.style }; previous = [actual.vehicle]; recent = [reference, ...recent].slice(0, 3);
        telemetry.completedStages++; progress({ phase: 'stage-end', chapter, stage, locked: true }); checkpoint();
        continue;
      }
      if (reference && !SA.V.stats(reference.vehicle, { deferHeat: true }).canDeploy) throw new Error('上一关入选车不能出战');
      const seeds = [], seedKeys = new Set();
      for (const record of options.seeds || []) {
        if (record.spec?.chapter !== chapter || record.spec?.stage !== stage) continue;
        const vehicle = SA.V.fromCells(record.name || '擂台种子车', record.cells);
        vehicle.lim = { ...spec.grid };
        if (!exactCells(SA, vehicle, record.cells)) {
          seedWarnings.push({ chapter, stage, name: record.name, reason: '种子包含无效模块或布局，不能用于进化' });
          continue;
        }
        if (!legalVehicle(SA, vehicle, spec)) {
          seedWarnings.push({ chapter, stage, name: record.name, reason: '种子违反本关奖励、材料、模块、网格或预算约束' });
          continue;
        }
        if (record.style) vehicle.arenaStyle = record.style;
        const key = JSON.stringify(cellsOf(SA, vehicle));
        if (!seedKeys.has(key)) { seeds.push(vehicle); seedKeys.add(key); }
        else seedWarnings.push({ chapter, stage, name: record.name, reason: '构筑与已接收种子完全重复，保留来源记录但不重复占种群' });
      }
      const evaluationSpec = { ...spec, previousVehicle: reference?.vehicle || null, previousStyle: reference?.style || null };
      const opponents = campaignOpponents(SA, chapter, stage, spec);
      const selectionSeed = seed + chapter * 10000 + stage * 101;
      const verify = scored => selectStageCandidateAsync(SA, scored, spec, reference, fingerprint, selectionSeed, recent, pool, duelCache, preheater.prepare);
      const result = await generateChapterAsync(SA, evaluationSpec, previous, opponents, rng, quickGames,
        pool, progress, options.shouldStop, telemetry, seeds, verify, preheater.prepare);
      if (result.interrupted) { status = 'interrupted'; break; }
      progress({ phase: 'selection-start', chapter, stage });
      const report = completedStage(SA, spec, result, reference, recent, fingerprint,
        selectionSeed, duelCache, origin, quickGames);
      report.seedProvenance = seeds.map((vehicle, sourceIndex) => ({ sourceIndex, name: vehicle.name,
        cells: cellsOf(SA, vehicle), generations: result.generationMetrics.map(row => row.seedRetention?.[sourceIndex] || null) }));
      chapterReport.stages.push(report); all.push(...report.top);
      telemetry.completedStages++; progress({ phase: 'selection-end', chapter, stage });
      progress({ phase: 'stage-end', chapter, stage, candidates: result.scored.length }); checkpoint();
      if (!report.selected) {
        selectionFailures.push({ chapter, stage, name: spec.name, failed: report.selection.failed });
        status = 'failed'; break;
      }
      const selected = result.scored[report.selection.selectedIndex];
      reference = { vehicle: selected.vehicle, style: selected.style };
      previous = [selected.vehicle]; recent = [reference, ...recent].slice(0, 3);
    }
    const mainHeat = SA.V.thermalSummary(), workerHeat = pool.thermalSummary();
    telemetry.workerScheduling = pool.schedulingSummary();
    telemetry.heat.cpuForecastCalls = mainHeat.cpuForecastCalls + workerHeat.cpuForecastCalls;
    telemetry.heat.cacheHits = mainHeat.cacheHits + workerHeat.cacheHits;
    telemetry.heat.gpuCacheUsed = mainHeat.gpuCacheHits + workerHeat.gpuCacheHits;
    telemetry.heat.workerGpuCacheUsed = workerHeat.gpuCacheHits;
    telemetry.heat.cpuCacheUsed = mainHeat.cpuCacheHits + workerHeat.cpuCacheHits;
    telemetry.heat.approximateGpuCacheUsed = telemetry.heat.precision === 'f32' ? telemetry.heat.gpuCacheUsed : 0;
    telemetry.heat.certifiedGpuCacheUsed = telemetry.heat.precision === 'certified' ? telemetry.heat.gpuCacheUsed : 0;
    telemetry.heat.backend = telemetry.heat.gpuCacheUsed > 0 ?
      (telemetry.heat.precision === 'f32' ? 'gpu-f32-approx' : 'gpu-certified') : 'cpu';
    telemetry.completedChapters = chapterReports.length; telemetry.elapsedMs = Date.now() - telemetry.startedAt;
    if (options.strict && selectionFailures.length) throw new Error('选关硬条件未全部满足：' + JSON.stringify(selectionFailures));
    const moduleValues = Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, SA.CAMP_START.mat)]));
    progress({ phase: status, completed: telemetry.completedStages, total: rows.length }); checkpoint();
    return { campaignLayout: SA.CAMPAIGN_LAYOUT, status, generatedAt: new Date().toISOString(), seed, rules: fingerprint,
      moduleValues, config, cache: duelCache.summary(), chapters: chapterReports, selectionFailures, candidates: all,
      telemetry, scope, seedWarnings };
  } finally { await pool.close(); await preheater.close(); SA.V.clearThermalPredictions(); }
}

// 旧 Boss 强弱只作为离线报告诊断；此函数不接入生成、评分、留种或选关。
// 返回新报告对象，原始候选、训练与120场验收证据保持逐字段不变。
function enrichBossDiagnostics(report, options = {}) {
  const { SA } = loadGame(), enriched = structuredClone(report);
  const currentRules = ruleFingerprint(SA);
  enriched.bossDiagnosticsEnrichment = {
    version: 'boss-diagnostic-2026-10-03-v1', generatedSnapshotHash: options.snapshotHash || null,
    generationRules: report.rules || null, diagnosticRules: currentRules,
  };
  const source = enriched.scope?.type === 'route-after' ? enriched.scope.origin : null;
  const findBoss = chapter => {
    if (chapter < 0) return null;
    const index = SA.CAMPAIGN[chapter]?.stages.findIndex((row, stage) => !!(stageFor(SA, chapter, stage)?.boss || row.boss));
    return index >= 0 ? { chapter, stage: index } : null;
  };
  for (const chapter of enriched.chapters || []) for (const stage of chapter.stages || []) {
    const spec = stage.spec || {}, target = findBoss(spec.boss ? chapter.chapter - 1 : chapter.chapter);
    const unavailable = reason => { stage.legacyBossDiagnostic = { available: false, reason }; };
    if (!stage.selected) { unavailable('本关没有合格入选车'); continue; }
    if (!target) { unavailable('没有已存在的对应 Boss'); continue; }
    const sameOrigin = source?.chapter === target.chapter && source?.stage === target.stage;
    const supplied = sameOrigin ? options.originVehicle : (options.references || []).find(rec => rec.spec?.chapter === target.chapter && rec.spec?.stage === target.stage);
    const actual = stageFor(SA, target.chapter, target.stage);
    const boss = supplied?.cells ? SA.V.fromCells(supplied.name || '诊断 Boss', supplied.cells) : actual?.vehicle;
    if (!boss || supplied?.cells && !exactCells(SA, boss, supplied.cells) || !SA.V.stats(boss).canDeploy) {
      unavailable('Boss 不存在、构筑读取不完整或不能出战'); continue;
    }
    const selected = SA.V.fromCells(stage.selected.name, stage.selected.cells);
    if (!exactCells(SA, selected, stage.selected.cells) || !SA.V.stats(selected).canDeploy) {
      unavailable('入选车无法按报告原样重建或不能出战'); continue;
    }
    let result = sameOrigin && stage.originComparison?.games ? stage.originComparison : null;
    let sourceKind = result ? '已记录的原点对战' : '独立诊断对战';
    if (!result && report.rules !== currentRules) { unavailable('规则指纹已变化，不能用当前规则补测旧报告'); continue; }
    if (!result) result = duel(SA, selected, boss,
      { ...spec, style: stage.selected.style, referenceStyle: supplied?.style || actual?.style || 'wander' },
      (report.seed || 20260925) + 200000000 + chapter.chapter * 10000 + spec.stage * 101, config.evaluation.finalDuelGames);
    stage.legacyBossDiagnostic = { available: true, source: sourceKind, boss: { ...target, name: boss.name },
      candidateWinRate: result.winRate, bossWinRate: 1 - result.winRate,
      games: result.games || result.n, wins: result.wins, draws: result.draws,
      // 旧口径仅供对照；任何数值都不写回选车硬条件。
      oldTarget: spec.boss ? '上一章 Boss 胜本关 Boss <30%' : '本章 Boss 胜普通关 60%～80%',
      oldTargetPass: spec.boss ? 1 - result.winRate < 0.3 : 1 - result.winRate >= 0.6 && 1 - result.winRate <= 0.8 };
  }
  return enriched;
}

function check() {
  const { SA } = loadGame();
  const campaignSpecs = campaignSpecCheck(SA);
  const fp = ruleFingerprint(SA), spec = stageSpec(SA, 0, 0), rng = new RNG(42);
  const a = randomVehicle(SA, spec, rng), b = randomVehicle(SA, spec, new RNG(42));
  if (!a || !b || SA.V.encode(a) !== SA.V.encode(b)) throw new Error('固定种子没有生成相同车辆');
  if (!SA.V.stats(a).canDeploy) throw new Error('固定种子车辆未通过出战检查');
  const shareCode = SA.V.encode(a), shared = SA.V.decode(shareCode);
  if (!shared || SA.V.encode(shared) !== shareCode) throw new Error('分享码往返失败');
  const legacyBody = Array.from({ length: 6 }, () => Array(8).fill(null));
  legacyBody[5][3] = { id: 'track', mt: 1, hp: 200 };
  legacyBody[4][3] = { id: 'helmet', mt: 1, hp: 90 };
  const migrated = SA.V.migrate({ name: '旧存档夹具', body: legacyBody, side: [] });
  if (!migrated || migrated.body.length !== SA.K.ROWS || !migrated.body[10][6]) throw new Error('旧版大格存档迁移失败');
  const duelA = SA.Battle.simulate({ p: a, e: b, terrain: 'flat', pStyle: 'wander', eStyle: 'wander', seed: 1234 });
  const duelB = SA.Battle.simulate({ p: a, e: b, terrain: 'flat', pStyle: 'wander', eStyle: 'wander', seed: 1234 });
  if (JSON.stringify(duelA) !== JSON.stringify(duelB)) throw new Error('同一种子对局结果不一致');
  const weakStrength = strengthFromRows([{ winRate: 0.25, n: 40 }]).strength;
  const strongStrength = strengthFromRows([{ winRate: 0.75, n: 40 }]).strength;
  if (!(strongStrength > weakStrength)) throw new Error('强度分没有保持胜率排序');
  let legalMutations = 0;
  const mutationOps = [];
  for (let i = 0; i < 40; i++) {
    const mutated = mutate(SA, a, spec, new RNG(100 + i), mutationOps);
    if (mutated && SA.V.stats(mutated).canDeploy) legalMutations++;
  }
  if (new Set(mutationOps).size < 5) throw new Error(`变异操作覆盖不足：${JSON.stringify(mutationOps)}`);
  const stages = [];
  let previousVehicle = SA.V.fromAscii('起始车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      if (SA.CAMPAIGN[chapter].stages[stage]?.unfinished) continue;
      const item = stageFor(SA, chapter, stage);
      const v = item.vehicle;
      const result = SA.Battle.simulate({ p: previousVehicle, e: v, terrain: item.terrain || 'flat', bounds: SA.CAMPAIGN[chapter].bounds, pStyle: 'wander', eStyle: item.style || 'wander', eBoss: !!item.boss, seed: chapter * 100 + stage });
      if (!Number.isFinite(result.t) || !Number.isFinite(result.pDealt) || !Number.isFinite(result.eDealt)) throw new Error(`战役第 ${chapter + 1} 章第 ${stage + 1} 关出现非有限模拟结果`);
      stages.push({ chapter, stage, t: result.t, winner: result.winner });
      previousVehicle = v;
    }
  }
  return { fingerprint: fp, vehicle: SA.V.stats(a), legalMutations, mutationOps: [...new Set(mutationOps)].sort((x, y) => x - y), share: { roundTrip: true, legacyMigrated: true }, result: duelA, campaign: { stages: stages.length, finite: true, specs: campaignSpecs } };
}

// 缓存夹具：同一车辆、规格、种子和局数必须逐字节复用 duel 聚合结果，
// 同时确认改装字段进入键，避免布局相同的车辆错误共用结果。
function cacheCheck() {
  const { SA } = loadGame();
  const spec = stageSpec(SA, 0, 0);
  const first = minimalVehicle(SA, spec), second = SA.V.fromAscii('缓存夹具对手', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
  if (!first || !second) throw new Error('缓存夹具无法生成合法车辆');
  const cache = createDuelCache(SA, 8);
  const a = duel(SA, first, second, { terrain: 'flat', style: 'wander' }, 424242, 2, cache);
  const b = duel(SA, first, second, { terrain: 'flat', style: 'wander' }, 424242, 2, cache);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('对局缓存命中后结果发生变化');
  const summary = cache.summary();
  if (summary.hits !== 1 || summary.misses !== 1) throw new Error(`缓存命中计数错误：${JSON.stringify(summary)}`);
  const modified = SA.V.clone(first);
  let modifiedCell = null;
  SA.V.each(modified, cell => { if (!modifiedCell) modifiedCell = cell; });
  if (modifiedCell) modifiedCell.lv = (modifiedCell.lv || 0) + 1;
  duel(SA, modified, second, { terrain: 'flat', style: 'wander' }, 424242, 2, cache);
  if (cache.summary().misses !== 2) throw new Error('改装变化错误命中旧缓存');
  return cache.summary();
}

// 进化评估的并行入口。普通生成默认走同步路径，调试和大批量运行可以把单局
// 拆给多个 worker；每个 worker 都重新加载真实游戏脚本，不共享战斗中的 B 状态。
function runParallel(tasks, workerCount = 2) {
  if (!tasks.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const count = Math.max(1, Math.min(workerCount, tasks.length));
    const workers = Array.from({ length: count }, () => new Worker(path.join(__dirname, 'evolve-worker.js')));
    const results = Array(tasks.length);
    let next = 0, done = 0, failed = false;
    const close = () => workers.forEach(worker => worker.terminate());
    const dispatch = worker => {
      if (next >= tasks.length) return;
      const id = next++;
      worker.postMessage({ ...tasks[id], id });
    };
    workers.forEach(worker => {
      worker.on('message', message => {
        if (failed) return;
        if (message.error) { failed = true; close(); reject(new Error(message.error)); return; }
        results[message.id] = message.result;
        done++;
        if (done >= tasks.length) { close(); resolve(results); return; }
        dispatch(worker);
      });
      worker.on('error', error => { if (!failed) { failed = true; close(); reject(error); } });
      dispatch(worker);
    });
  });
}

async function parallelCheck() {
  const { SA } = loadGame(), spec = stageSpec(SA, 0, 0), a = randomVehicle(SA, spec, new RNG(7)), b = randomVehicle(SA, spec, new RNG(8));
  const tasks = [1, 2, 3, 4].map(seed => ({ p: SA.V.encode(a), e: SA.V.encode(b), options: { terrain: 'flat', pStyle: 'wander', eStyle: 'wander', seed } }));
  const results = await runParallel(tasks, 2);
  if (results.some(result => !result || !Number.isFinite(result.t))) throw new Error('并行模拟返回了无效结果');
  return { workers: 2, jobs: results.length, winners: results.map(result => result.winner), rules: ruleFingerprint(SA) };
}

function healthRows(SA, a, b, spec, seed, games) {
  const rows = [];
  for (let i = 0; i < games; i++) {
    const first = SA.Battle.simulate({ p: a, e: b, pAim: 0.8, eAim: 0.8, pStyle: spec.style || 'wander', eStyle: spec.eStyle || 'wander', terrain: spec.terrain || 'flat', seed: seed + i * 2 });
    const second = invertResult(SA.Battle.simulate({ p: b, e: a, pAim: 0.8, eAim: 0.8, pStyle: spec.eStyle || 'wander', eStyle: spec.style || 'wander', terrain: spec.terrain || 'flat', seed: seed + i * 2 + 1 }));
    rows.push(first, second);
  }
  return rows;
}

function outcomeSummary(SA, rows) {
  const summary = { games: rows.length, draw: 0, heat: 0, timeout: 0, avgTime: 0, performances: [] };
  for (const row of rows) {
    if (row.winner === 'draw') summary.draw++;
    if (/烧干|锅炉/.test(row.reason || '')) summary.heat++;
    if (row.timeout || row.reason === '超时' || (row.t >= SA.K.BATTLE_TIME && row.winner === 'draw')) summary.timeout++;
    summary.avgTime += row.t || 0;
    summary.performances.push(performanceScore(row, 'p', config.performance));
  }
  summary.avgTime /= Math.max(1, rows.length);
  summary.drawRate = summary.draw / Math.max(1, rows.length);
  summary.heatRate = summary.heat / Math.max(1, rows.length);
  summary.timeoutRate = summary.timeout / Math.max(1, rows.length);
  summary.performance = { min: summary.performances.length ? Math.min(...summary.performances) : 0, max: summary.performances.length ? Math.max(...summary.performances) : 0, average: summary.performances.reduce((a, b) => a + b, 0) / Math.max(1, summary.performances.length) };
  return summary;
}

// P2 的系统健康测试：只产生报告，不自动修改任何战斗常数。正式参数搜索和数值调整仍需用户批准。
function healthCheck(games = 4) {
  const { SA } = loadGame();
  const anchors = [
    // 关卡布局 4 只留序章和第一章前三关
    stageFor(SA, 0, 0).vehicle,
    stageFor(SA, 1, 0).vehicle,
    stageFor(SA, 1, 2).vehicle,
  ];
  const allRows = [];
  const pairs = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const rows = healthRows(SA, anchors[i], anchors[i + 1], { terrain: 'flat', style: 'wander' }, 9000 + i * 100, games);
    allRows.push(...rows);
    const summary = outcomeSummary(SA, rows);
    pairs.push({ a: anchors[i].name, b: anchors[i + 1].name, winRate: rows.filter(row => row.winner === 'p').length / Math.max(1, rows.length), drawRate: summary.drawRate, time: summary.avgTime, heatRate: summary.heatRate, timeoutRate: summary.timeoutRate, performance: summary.performance });
  }
  const normal = anchors[1], water = [];
  normal.lim = { cols: 8, rows: 6 };
  for (let count = 0; count <= 4; count++) {
    const v = SA.V.clone(normal);
    for (let i = 0; i < count; i++) tryPlace(SA, v, 'tank_s', 1, new RNG(700 + count * 10 + i));
    const row = duel(SA, v, anchors[2], { terrain: 'flat', style: 'wander' }, 12000 + count, Math.max(2, Math.floor(games / 2)));
    water.push({ tanks: count, winRate: row.winRate, time: row.time, rating: SA.V.stats(v).rating });
  }
  const turtle = SA.V.clone(normal); turtle.name = '龟缩水车';
  for (let i = 0; i < 4; i++) tryPlace(SA, turtle, 'tank_s', 1, new RNG(1400 + i));
  const kite = SA.V.clone(normal); kite.name = '风筝水车';
  for (let i = 0; i < 4; i++) tryPlace(SA, kite, 'tank_s', 1, new RNG(1500 + i));
  const drag = { turtle: duel(SA, turtle, anchors[2], { terrain: 'flat', style: 'turtle' }, 16000, games), kite: duel(SA, kite, anchors[2], { terrain: 'flat', style: 'kite' }, 17000, games) };
  // 关卡布局 4 以后没有关卡开放喷火器 / 蒸汽喷射器：在第一章第 3 关的模块池里临时加上蒸汽喷射器
  const lastSpec = stageSpec(SA, 1, 2), heatModule = 'steamjet', heatSpec = { ...lastSpec, availableMods: [...new Set([...lastSpec.availableMods, heatModule])] };
  let heatVehicle = null;
  for (let i = 0; i < 80 && !heatVehicle; i++) heatVehicle = randomVehicle(SA, heatSpec, new RNG(18001 + i * 31), heatModule) || minimalVehicle(SA, heatSpec, heatModule);
  const heatRows = heatVehicle ? healthRows(SA, heatVehicle, normal, { terrain: 'flat', style: 'rush' }, 18000, games) : [];
  const earlyHeatWins = heatRows.filter(row => row.winner === 'p' && row.t < 25 && /烧干|锅炉/.test(row.reason || '')).length;
  const parameterSearch = [];
  // P2 只在本地 VM 临时扰动热量、冷却、耗水和时长常数；每轮结束恢复原值，
  // 让报告能给出敏感度，但不会把任何推荐值写回游戏。
  const original = {
    IDLE_HEAT: SA.K.IDLE_HEAT, DISSIPATE: SA.K.DISSIPATE, WATER_PER_HEAT: SA.K.WATER_PER_HEAT,
    FIRE_WATER: SA.K.FIRE_WATER, COOL_FULL: SA.K.COOL_FULL, BATTLE_TIME: SA.K.BATTLE_TIME, KNOCK_MAX: SA.K.KNOCK_MAX,
  };
  try {
    for (const key of Object.keys(original)) for (const factor of [0.9, 1, 1.1]) {
      SA.K[key] = ['BATTLE_TIME', 'KNOCK_MAX'].includes(key)
        ? Math.max(1, Math.round(original[key] * factor))
        : Math.max(0.01, original[key] * factor);
      const rows = healthRows(SA, anchors[1], anchors[2], { terrain: 'flat', style: 'wander' }, 19000 + parameterSearch.length * 20, Math.max(1, Math.min(2, games)));
      const summary = outcomeSummary(SA, rows);
      const distance = Math.abs(summary.avgTime - 45) + summary.heatRate * 50 + summary.timeoutRate * 50 + summary.drawRate * 30;
      parameterSearch.push({ key, factor, summary, distance });
    }
  } finally { Object.assign(SA.K, original); }
  const summary = outcomeSummary(SA, allRows);
  return { rules: ruleFingerprint(SA), games, outcomes: summary, pairs, water, drag: { turtle: { winRate: drag.turtle.winRate, time: drag.turtle.time }, kite: { winRate: drag.kite.winRate, time: drag.kite.time } }, heat: { available: !!heatVehicle, earlyHeatWins, games: heatRows.length }, parameterSearch, note: '本报告只定位热死、超时、平局、水箱边际、拖延收益和升温护栏；参数搜索只给出敏感度，不自动提交数值修改。' };
}

// P7 稳健性检查：只在临时 SA.K 上施加 ±10% 扰动，结束后完整恢复原值。
// 这不是调参入口，而是确认候选不会只在单一战斗常数下成立。
function robustness(SA, vehicle, opponents, spec, seed, games = 1) {
  const keys = ['BATTLE_TIME', 'KNOCK_MAX', 'FOCUS_KICK', 'FOCUS_KICK_FAST'];
  const original = Object.fromEntries(keys.map(key => [key, SA.K[key]]));
  const rows = [];
  try {
    for (const key of keys) for (const factor of [0.9, 1, 1.1]) {
      Object.assign(SA.K, original);
      SA.K[key] = Math.max(0.01, original[key] * factor);
      const result = evaluateCandidate(SA, vehicle, opponents, spec, seed + keys.indexOf(key) * 1000 + Math.round(factor * 100), games);
      rows.push({ key, factor, value: SA.K[key], legal: !result.stats.blocked?.length && !!result.stats.canDeploy, strength: result.strength, performance: result.performance, terrainDelta: result.terrainDelta });
    }
  } finally {
    for (const key of keys) SA.K[key] = original[key];
  }
  return rows;
}

// 规则指纹变化后只重评估旧候选，不重新进化。输入是 --sample 生成的报告，
// 输出每台车的强度、表现、合法性和偏移，供任务 F 的自动检查消费。
function impact(file, games = 4, perturb = null) {
  const { SA } = loadGame();
  const baseline = SA.Camp.migrateEvolutionReport(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')));
  if (perturb && SA.K[perturb.key] != null) SA.K[perturb.key] = Math.max(1, Number(SA.K[perturb.key]) * Number(perturb.factor || 1));
  const currentRules = ruleFingerprint(SA), rows = [], threshold = { strength: 75, performance: 10 };
  for (const record of baseline.candidates || []) {
    const chapter = record.spec?.chapter, stage = record.spec?.stage;
    const spec = Number.isInteger(chapter) && Number.isInteger(stage) ? stageSpec(SA, chapter, stage) : null;
    let vehicle = null, legal = false, current = null, robust = null;
    try {
      // 有完整模块清单就用它（带材料和改装）；只有分享码的老记录才退回解码
      vehicle = Array.isArray(record.cells) ? SA.V.fromCells(record.name || '候选车', record.cells) : SA.V.decode(record.code);
      const stats = vehicle && SA.V.stats(vehicle);
      legal = !!(stats && stats.canDeploy);
      const stableSeed = record.evaluationSeed == null ? parseInt(crypto.createHash('sha256').update(String(record.code || record.name)).digest('hex').slice(0, 8), 16) : record.evaluationSeed;
      if (legal && spec) {
        const opponents = campaignOpponents(SA, chapter, stage);
        current = evaluateCandidate(SA, vehicle, opponents, spec, stableSeed, games);
        robust = robustness(SA, vehicle, opponents, spec, stableSeed + 500000, 1);
      }
    } catch (error) {
      rows.push({ name: record.name, chapter, stage, legal: false, error: String(error.message || error) });
      continue;
    }
    const delta = current ? { strength: current.strength - (record.strength || 1000), performance: current.performance - (record.performance || 0) } : null;
    rows.push({ name: record.name, chapter, stage, legal, comparable: record.evaluationSeed != null, before: { strength: record.strength, performance: record.performance }, after: current && { strength: current.strength, strengthCi: current.strengthCi, performance: current.performance, terrainDelta: current.terrainDelta }, robustness: robust, delta, flagged: !legal || !!(delta && (Math.abs(delta.strength) >= threshold.strength || Math.abs(delta.performance) >= threshold.performance)) });
  }
  const flagged = rows.filter(row => row.flagged);
  const moduleValues = Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, 1)]));
  const beforeValues = baseline.moduleValues || {};
  const moduleValueDelta = Object.fromEntries(Object.keys(moduleValues).map(id => [id, moduleValues[id] - Number(beforeValues[id] || moduleValues[id])]));
  return { baselineRules: baseline.rules, currentRules, changed: baseline.rules !== currentRules, perturb, threshold, candidates: rows, flagged: flagged.length, moduleValues: { before: beforeValues, after: moduleValues, delta: moduleValueDelta }, note: '本报告只重评估旧候选，不自动改动规则、关卡或数值。' };
}

// P7 固定夹具：把战斗时限缩到约一秒，验证指纹变化和候选偏移；短程基础车在十秒内已能分胜负。
function impactCheck() {
  const { SA } = loadGame();
  // 无水箱基础车可能在十秒内烧干；时限扰动夹具显式带水，保证实际触及时限差异。
  const spec = stageSpec(SA, 0, 0), vehicle = minimalVehicle(SA, spec, 'tank_s');
  if (!vehicle) throw new Error('P7 夹具无法生成合法车辆');
  const seed = 62026, result = evaluateCandidate(SA, vehicle, campaignOpponents(SA, 0, 0), spec, seed, 2);
  const item = { vehicle, evaluationSeed: seed, ...result };
  const baseline = { rules: ruleFingerprint(SA), moduleValues: Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, 1)])), candidates: [candidateRecord(SA, item, spec, ruleFingerprint(SA))] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-evolve-impact-')), file = path.join(dir, 'evolve-fixture.json');
  try {
    fs.writeFileSync(file, JSON.stringify(baseline), 'utf8');
    const report = impact(file, 2, { key: 'BATTLE_TIME', factor: 0.01 }); // 提前截断交火，确保差异超过影响报告阈值。
    if (!report.changed || !report.candidates.length || !report.candidates[0].robustness?.length) throw new Error('P7 影响报告没有识别规则变化或稳健性行');
    if (!report.candidates.some(row => row.flagged)) throw new Error('P7 影响报告没有标出受影响候选');
    return { changed: report.changed, flagged: report.flagged, perturb: report.perturb, rules: { before: report.baselineRules, after: report.currentRules } };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 临时目录清理失败不影响报告 */ }
  }
}

async function main(argv) {
  const mode = argv[0] || '--check';
  if (mode === '--check') { console.log(JSON.stringify(check(), null, 2)); return; }
  if (mode === '--parallel-check') { console.log(JSON.stringify(await parallelCheck(), null, 2)); return; }
  if (mode === '--impact-check') { console.log(JSON.stringify(impactCheck(), null, 2)); return; }
  if (mode === '--cache-check') { console.log(JSON.stringify(cacheCheck(), null, 2)); return; }
  if (mode === '--health') { console.log(JSON.stringify(healthCheck(Number(argv[1]) || 4), null, 2)); return; }
  if (mode === '--first-stage' || mode === '--first-two-stages') {
    // 保留既有的种群、代数、真实战斗评分和手工锁定规则；仅限制预演范围。
    // 输出到报告页读取的有界目录，不写战役数据、手工车或全战役候选车库。
    const report = await runAsync({ chapters: 1, firstStageOnly: mode === '--first-stage', firstTwoStages: mode === '--first-two-stages', seed: Number(argv[1]) || 20260929,
      onProgress: event => { if (event.phase !== 'candidate') console.log(JSON.stringify(event)); } });
    const saved = storage.writeReport(report, OUT_DIR);
    console.log(JSON.stringify({ file: saved.file, rules: report.rules, selectionFailures: report.selectionFailures, telemetry: report.telemetry }, null, 2));
    return;
  }
  if (mode === '--impact') {
    if (!argv[1]) throw new Error('--impact 需要一个旧报告 JSON 路径');
    const perturb = argv[3] === '--perturb' ? { key: argv[4], factor: Number(argv[5]) } : null;
    console.log(JSON.stringify(impact(argv[1], Number(argv[2]) || 4, perturb), null, 2)); return;
  }
  if (mode === '--export-candidates') {
    if (!argv[1]) throw new Error('--export-candidates 需要一个旧报告 JSON 路径');
    const report = JSON.parse(fs.readFileSync(path.resolve(argv[1]), 'utf8'));
    console.log(JSON.stringify(storage.writeCandidates(report, argv[2] || storage.DEFAULT_CANDIDATES), null, 2));
    return;
  }
  if (mode !== '--sample' && mode !== '--generate') throw new Error(`未知参数：${mode}`);
  const formal = mode === '--generate';
  const report = run({ chapters: Number(argv[1]) || (formal ? undefined : 1), games: Number(argv[2]) || (formal ? config.evaluation.archiveGames : 2), strict: formal });
  const saved = storage.writeReport(report, OUT_DIR);
  const candidates = storage.writeCandidates(report);
  console.log(JSON.stringify({ file: path.relative(ROOT, saved.file), rules: report.rules, candidates: report.candidates.length, chapters: report.chapters.length, selectionFailures: report.selectionFailures, candidateFile: path.relative(ROOT, candidates.file), reportBytes: saved.bytes }, null, 2));
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { RNG, loadGame, ruleFingerprint, stageFor, applyStagePatch, stageSpec, plannedRoute, routeAfter, previewStageSpec, campaignSpecCheck, lockedStageReport, randomVehicle, requiredVehicle, adaptParentForStage, minimalVehicle, mutate, legalVehicle, constructionConditions, efficiencyScore, rankingScore, fitness, difficultyDistance, shapeSignature, shapeSimilarity, shapeClusters, diversityMetrics, adaptiveSettings, archive, campaignOpponents, performanceScore, strengthFromRows, createDuelCache, duelRows, reduceDuelRows, duel, evaluateCandidate, generateChapter, generateChapterAsync, usageAgainst, replacementFor, selectStageCandidate, selectStageCandidateAsync, enrichBossDiagnostics, robustness, run, runAsync, runParallel, parallelCheck, healthCheck, impact, impactCheck, cacheCheck, check };
