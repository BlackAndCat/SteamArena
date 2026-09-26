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
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const os = require('os');
const { Worker } = require('worker_threads');
const config = require('./evolve-config');
const storage = require('./evolve-storage');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'out');
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------- Node VM：只补游戏脚本启动所需的最小浏览器接口 ----------
function noop() {}

function context2d() {
  const base = { canvas: null, measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop: noop }) };
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

function createGameContext() {
  const document = {
    createTextNode: value => ({ textContent: String(value) }), createElement: element,
    querySelector: () => element(), querySelectorAll: () => [], body: element('body'), documentElement: element('html'),
  };
  const context = {
    addEventListener: noop, removeEventListener: noop, console, document, window: null, globalThis: null,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop }, requestAnimationFrame: noop, cancelAnimationFrame: noop,
    performance: { now: () => 0 }, Image: function Image() {}, navigator: {}, location: { href: 'http://localhost:5173/tools/evolve.html' },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, JSON, Date, Array, Object, Number, String, Boolean,
    RegExp, Error, parseInt, parseFloat, isFinite, Uint8Array, Float32Array, Int32Array, Math,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
  };
  context.Node = function Node() {};
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function loadGame() {
  const context = createGameContext();
  const files = ['js/palette.js', 'js/modules.js', 'js/module-art.js', 'js/dynamics.js', 'js/sprites.js', 'js/legs.js', 'js/vehicle.js',
    'js/content.js', 'js/state.js', 'js/ui.js', 'js/camp.js', 'js/camp-ui.js', 'js/terrain-art.js', 'js/battle-view.js', 'js/battle.js'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return { context, SA: context.SA };
}

// 对象键排序后再序列化，确保同一规则在不同 Node 版本中得到同一输入。
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function ruleFingerprint(SA) {
  const source = ['js/modules.js', 'js/vehicle.js', 'js/battle.js'].map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]);
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
  for (const id of unlock.mods || []) progress.mods.add(id);
  for (const feat of unlock.feat || []) progress.feat.add(feat);
  if (unlock.mat) progress.mat = Math.max(progress.mat, unlock.mat);
  if (unlock.grid) progress.grid = { cols: unlock.grid.cols, rows: unlock.grid.rows };
}

// 读取某一关开始前的解锁状态：本关自己的 unlock 属于打赢后获得，不能提前使用。
function progressAt(SA, chapter, stage) {
  const progress = { mods: new Set(SA.CAMP_START.mods || []), feat: new Set(SA.CAMP_START.feat || []), mat: SA.CAMP_START.mat, grid: { ...SA.CAMP_START.grid }, prizes: 0 };
  for (let ci = 0; ci <= chapter; ci++) {
    const ch = SA.CAMPAIGN[ci];
    const stop = ci === chapter ? stage : ch.stages.length;
    for (let si = 0; si < stop; si++) {
      progress.prizes += ch.stages[si].prize || 0;
      addUnlock(progress, ch.stages[si].unlock);
    }
    if (ci < chapter) {
      addUnlock(progress, ch.unlock);
    }
  }
  // 开局已有模块不计入现金支出；预算表示“初始库存价值 + 可用于新增/升级的现金”。
  // 这样生成器不会因为必需的底盘、锅炉、水箱和驾驶舱本身就超过 £300 而拒绝所有合法车。
  const starterValue = [...new Set(SA.CAMP_START.mods || [])].reduce((sum, id) => sum + cellValue(SA, id, SA.CAMP_START.mat), 0);
  progress.budget = Math.round((starterValue + config.budget.startingMoney + progress.prizes * config.budget.prizeKeepRate) * 100) / 100;
  return progress;
}

function stageSpec(SA, chapter, stage) {
  const ch = SA.CAMPAIGN[chapter], current = ch.stages[stage], progress = progressAt(SA, chapter, stage);
  const design = current.spec || {};
  // 只有真正的新解锁才算奖励件；开局库存或此前已获得的模块不能重复作为奖励，
  // 否则序章会把 plate 当作奖励并错误触发“奖励效果”门槛。
  const rawReward = design.reward || current.unlock?.mods?.[0] || (stage === ch.stages.length - 1 ? ch.unlock?.mods?.[0] : null);
  const reward = rawReward && !progress.mods.has(rawReward) ? rawReward : null;
  // Boss 专属件和本关解锁件必须进入候选约束，否则奖励车永远只能携带普通件。
  // 这些额外模块只在对应关卡可用，不改变玩家在上一关的实际库存。
  const stageExtras = (current.subs || []).map(row => row[2]).filter(id => SA.MODULES[id]);
  if (reward && SA.MODULES[reward]) stageExtras.push(reward);
  const available = [...new Set([...progress.mods, ...stageExtras])].filter(id => SA.MODULES[id] && !SA.MODULES[id].retired && (stageExtras.includes(id) || (SA.MODULES[id].minMt || 1) <= progress.mat));
  const budget = progress.budget * ((current.boss || reward) ? config.budget.bossMultiplier : 1);
  const hasEpic = stageExtras.some(id => SA.MODULES[id]?.special || id === 'cannon_giant');
  const epicBudget = hasEpic ? progress.budget * config.budget.epicMultiplier : budget;
  return {
    chapter, stage, name: current.name, terrain: design.terrain || current.terrain || 'flat', style: current.style || null,
    lesson: design.lesson || null, performanceMin: Number.isFinite(design.performanceMin) ? design.performanceMin : 0,
    uniqueLoot: (current.uniqueLoot || []).map(item => ({ ...item })),
    chapterHasBoss: ch.stages.some(row => !!row.boss),
    boss: !!current.boss, rewardModule: reward, grid: progress.grid, mat: progress.mat, budget: Math.max(budget, epicBudget), baseBudget: progress.budget,
    availableMods: available,
    target: { bossWinRate: design.targetStrength || (current.boss ? [0.6, 0.7] : [0.65, 0.8]) },
  };
}

// 每一关的规格是战役意图的单一数据入口；这里只验字段完整性，不把探索稿的数值门槛强行改写进搜索。
function campaignSpecCheck(SA) {
  const errors = [];
  SA.CAMPAIGN.forEach((chapter, chapterIndex) => chapter.stages.forEach((stage, stageIndex) => {
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
    const maxR = placementLayer === 'chassis' ? bounds.bottom : bounds.bottom - f.h;
    const r = placementLayer === 'chassis' ? bounds.bottom : bounds.r0 + rng.int(Math.max(1, maxR - bounds.r0 + 1));
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
  return Object.keys(counts(SA, v)).some(id => SA.MODULES[id]?.dmg);
}

function legalVehicle(SA, v, spec) {
  const stats = SA.V.stats(v);
  return mandatoryOk(SA, v) && stats.canDeploy && !stats.blocked?.length && stats.value <= spec.budget;
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

// 随机尝试全部失败时的保底车。保底车只保证必需件和一个武器，
// 这样某一档的预算 / 尺寸变化也不会让种群初始化陷入无限循环。
function minimalVehicle(SA, spec, forcedModule = null) {
  const v = SA.V.create(`保底候选·${spec.chapter + 1}-${spec.stage + 1}`);
  v.lim = { ...spec.grid };
  const bounds = regionBounds(SA, v), putFirst = (id, preferredRows = null) => {
    const f = SA.fp(id), layer = SA.V.layerOf(id), placementLayer = SA.MODULES[id].layer;
    const rows = preferredRows || (placementLayer === 'chassis' ? [bounds.bottom] : placementLayer === 'ram' ? Array.from({ length: bounds.bottom - bounds.r0 + 1 }, (_, i) => bounds.bottom - i) : Array.from({ length: bounds.bottom - f.h - bounds.r0 + 1 }, (_, i) => bounds.bottom - f.h - i));
    for (const r of rows)
      for (let c = bounds.c0; c <= bounds.c1 - f.w + 1; c++) {
        const check = SA.V.canPut(v, id, r, c);
        if (check.ok && check.fit) { v[layer][r][c] = SA.newCell(id, spec.mat); return true; }
      }
    return false;
  };
  // 覆盖检查或奖励车明确指定底盘时，保底构筑也必须真正使用它；否则整件四足/双足永远只会回退成履带。
  const chassis = forcedModule && SA.MODULES[forcedModule]?.layer === 'chassis' ? forcedModule :
    (spec.availableMods.includes('track') ? 'track' : (moduleIds(SA, spec, m => m.layer === 'chassis')[0] || 'track'));
  putFirst(chassis);
  // 巨炮和奖励撞击件需要先贴到底盘，再围绕它补齐驾驶舱、锅炉和水箱，
  // 否则大尺寸火力件会因没有支撑或撞击件没有挂点而永远生成失败。
  const forcedWeapon = forcedModule && SA.MODULES[forcedModule]?.dmg ? forcedModule : null;
  const forcedRam = forcedModule && SA.MODULES[forcedModule]?.layer === 'ram' ? forcedModule : null;
  if (forcedWeapon) putFirst(forcedWeapon);
  if (forcedRam) putFirst(forcedRam);
  const forcedUtility = forcedModule && !forcedWeapon && !forcedRam && SA.MODULES[forcedModule]?.layer !== 'chassis' ? putFirst(forcedModule) : false;
  // 巨炮占四行时，驾驶舱、锅炉和水箱必须从炮身上方开始找位置，
  // 放到炮口旁会被判作遮挡，形成“可部署但不能开火”的假候选。
  const highRows = forcedWeapon && SA.fp(forcedWeapon).w >= 4 ? Array.from({ length: bounds.bottom - bounds.r0 + 1 }, (_, i) => bounds.r0 + i) : null;
  putFirst(moduleIds(SA, spec, (m, id) => SA.isCockpit(id))[0] || 'helmet', highRows);
  putFirst(moduleIds(SA, spec, m => m.supply)[0] || 'boiler', highRows);
  putFirst(moduleIds(SA, spec, m => m.water || m.cool)[0] || 'water', highRows);
  const weapon = forcedWeapon || moduleIds(SA, spec, m => m.cat === 'firepower')[0];
  if (weapon && !forcedWeapon) putFirst(weapon);
  // 奖励件可能是冷却、控制或装甲件；保底车也要优先尝试放入，
  // 否则“必须包含奖励件”的章节选择会被保底路径悄悄破坏。
  if (forcedModule && !forcedWeapon && !forcedRam && SA.MODULES[forcedModule].layer !== 'chassis' && !forcedUtility) putFirst(forcedModule);
  return legalVehicle(SA, v, spec) ? v : null;
}

function randomVehicle(SA, spec, rng, forcedModule = null) {
  const v = SA.V.create(`进化候选·${spec.chapter + 1}-${spec.stage + 1}-${rng.int(100000)}`);
  v.lim = { ...spec.grid };
  const chassisIds = moduleIds(SA, spec, m => m.layer === 'chassis');
  const style = rng.pick(['rush', 'kite', 'turtle', 'wander']);
  const forcedChassis = forcedModule && SA.MODULES[forcedModule]?.layer === 'chassis' ? forcedModule : null;
  const chassis = forcedChassis || rng.pick(chassisIds) || 'track';
  const chassisCount = chassis === 'track' ? clamp(Math.floor(spec.grid.cols / 2), 1, 3) : 1;
  for (let i = 0; i < chassisCount; i++) tryPlace(SA, v, chassis, spec.mat, rng, 100, 'chassis');

  const body = [
    moduleIds(SA, spec, (m, id) => SA.isCockpit(id))[0] || 'helmet',
    moduleIds(SA, spec, m => m.supply)[0] || 'boiler',
    moduleIds(SA, spec, m => m.water || m.cool)[0] || 'water',
  ];
  for (const id of body) tryPlace(SA, v, id, spec.mat, rng);

  // 只有火力件才能占用武器槽。章节奖励经常是水箱、冷却或控制件，
  // 因此先正常放置武器，再把奖励件作为可选模块尝试放入。
  const forcedIsWeapon = !!(forcedModule && SA.MODULES[forcedModule]?.dmg);
  const weapon = forcedIsWeapon ? forcedModule : pickWeapon(SA, spec, rng, style);
  if (weapon) tryWeapon(SA, v, weapon, spec.mat, rng);
  if (forcedModule && !forcedIsWeapon && SA.MODULES[forcedModule].layer !== 'chassis') tryPlace(SA, v, forcedModule, spec.mat, rng, 160);
  if (rng.chance(0.55)) {
    const second = pickWeapon(SA, spec, rng, style);
    if (second && second !== weapon) tryWeapon(SA, v, second, spec.mat, rng);
  }
  const armorIds = moduleIds(SA, spec, m => m.cat === 'structure');
  const coolingIds = moduleIds(SA, spec, m => m.cat === 'cooling');
  const controls = moduleIds(SA, spec, m => m.cat === 'control' && !m.cockpit);
  const energy = moduleIds(SA, spec, m => m.cat === 'energy' && !m.supply);
  const optional = style === 'rush' ? [...armorIds, ...armorIds, ...energy] : [...armorIds, ...coolingIds, ...controls, ...energy];
  const targetCount = 3 + rng.int(6);
  for (let i = 0; i < targetCount; i++) {
    const id = rng.pick(optional);
    if (!id || cellValue(SA, id, spec.mat) + SA.V.stats(v).value > spec.budget) continue;
    tryPlace(SA, v, id, spec.mat, rng);
  }
  if (spec.availableMods.includes('side_cannon') && rng.chance(0.3)) tryPlace(SA, v, 'side_cannon', spec.mat, rng, 120, 'side');
  if (style === 'rush') {
    const ramIds = moduleIds(SA, spec, m => m.layer === 'ram');
    const ram = rng.pick(ramIds);
    if (ram) tryPlace(SA, v, ram, spec.mat, rng);
  }
  const stats = SA.V.stats(v);
  if (legalVehicle(SA, v, spec)) return v;
  return minimalVehicle(SA, spec, forcedModule);
}

function mandatoryOk(SA, v) {
  const c = counts(SA, v);
  return Object.keys(c).some(id => SA.MODULES[id]?.layer === 'chassis') &&
    Object.keys(c).some(id => SA.isCockpit(id)) && Object.keys(c).some(id => SA.MODULES[id]?.supply) &&
    Object.keys(c).some(id => SA.MODULES[id]?.water || SA.MODULES[id]?.cool) && hasWeapon(SA, v);
}

function optionalCells(SA, v) {
  const out = [];
  SA.V.each(v, (cell, r, c, layer) => {
    const m = SA.MODULES[cell.id];
    if (m.layer !== 'chassis' && !SA.isCockpit(cell.id) && !m.supply && !(m.water || m.cool) && !m.ram) out.push({ cell, r, c, layer });
  });
  return out;
}

function mutate(SA, source, spec, rng, trace = null) {
  const out = SA.V.clone(source);
  out.name = `${source.name}·变异${rng.int(100000)}`;
  const op = rng.int(5);
  if (trace) trace.push(op);
  const cells = optionalCells(SA, out);
  if (op === 0 || !cells.length) {
    const id = rng.pick(spec.availableMods.filter(x => !SA.MODULES[x].retired));
    if (id && cellValue(SA, id, spec.mat) + SA.V.stats(out).value <= spec.budget) tryPlace(SA, out, id, spec.mat, rng);
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
      if (check.ok && check.fit) out[target.layer][target.r][target.c] = SA.newCell(id, spec.mat);
    }
  } else {
    const target = rng.pick(cells);
    if (target) target.cell.lv = clamp((target.cell.lv || 0) + 1, 0, SA.K.UP_MAX);
  }
  const stats = SA.V.stats(out);
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

// 把多组对局的胜率换算为以 1000 为中心的 Elo 类强度，并保留二项分布置信区间。
// 这里不把 stats().rating 当强度；它只描述静态构造，最终分数来自实战。
function strengthFromRows(rows) {
  if (!rows.length) return { strength: 1000, strengthCi: 0 };
  const scores = rows.map(row => clamp(row.winRate, 0.001, 0.999));
  const logits = scores.map(p => Math.log(p / (1 - p)) * 400 / Math.LN10);
  const strength = clamp(1000 + logits.reduce((sum, value) => sum + value, 0) / logits.length, 300, 1700);
  // Wilson 区间避免全胜 / 全负样本被错误地报告成“零不确定性”。
  const z = 1.96;
  const ci = rows.map(row => {
    const n = Math.max(1, row.n), p = clamp(row.winRate, 0, 1), z2 = z * z;
    const den = 1 + z2 / n, mid = (p + z2 / (2 * n)) / den;
    const half = z * Math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n)) / den;
    const lo = clamp(mid - half, 0.001, 0.999), hi = clamp(mid + half, 0.001, 0.999);
    return (Math.log(hi / (1 - hi)) - Math.log(lo / (1 - lo))) * 400 / Math.LN10 / 2;
  });
  return { strength, strengthCi: ci.reduce((sum, value) => sum + value, 0) / ci.length };
}

function duel(SA, candidate, opponent, spec, seed, games) {
  let wins = 0, draws = 0, totalTime = 0, performance = 0, resultSample = null;
  for (let i = 0; i < games; i++) {
    const seedA = seed + i * 2;
    const a = SA.Battle.simulate({ p: candidate, e: opponent, pAim: 0.8, eAim: 0.8, pStyle: spec.style || 'wander', eStyle: 'wander', terrain: spec.terrain, seed: seedA });
    const b = invertResult(SA.Battle.simulate({ p: opponent, e: candidate, pAim: 0.8, eAim: 0.8, pStyle: 'wander', eStyle: spec.style || 'wander', terrain: spec.terrain, seed: seedA + 1 }));
    for (const r of [a, b]) { if (r.winner === 'p') wins++; else if (r.winner === 'draw') draws++; totalTime += r.t; performance += performanceScore(r, 'p', config.performance); resultSample = resultSample || { ...r, seed: r === a ? seedA : seedA + 1 }; }
  }
  const n = games * 2;
  return { wins, draws, n, winRate: (wins + draws * 0.5) / Math.max(1, n), time: totalTime / Math.max(1, n), performance: performance / Math.max(1, n), sample: resultSample };
}

function styleFor(SA, v) {
  const s = SA.V.stats(v);
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

function evaluateCandidate(SA, candidate, opponents, spec, seed, games) {
  const rows = opponents.map((opponent, i) => duel(SA, candidate, opponent, spec, seed + i * 1009, games));
  const strengthData = strengthFromRows(rows);
  const performance = rows.reduce((sum, row) => sum + row.performance, 0) / Math.max(1, rows.length);
  // 性格不是静态标签：用同一标尺车分别试跑四种行为，选表现分最高者。
  const styles = ['rush', 'kite', 'turtle', 'wander'];
  const styleTrials = styles.map((style, i) => {
    const probe = opponents[0] && duel(SA, candidate, opponents[0], { ...spec, style }, seed + 700001 + i * 1009, 1);
    return { style, performance: probe?.performance || 0, winRate: probe?.winRate || 0 };
  });
  const boundStyle = styleTrials.slice().sort((a, b) => (b.performance + b.winRate * 10) - (a.performance + a.winRate * 10))[0]?.style || styleFor(SA, candidate);
  let terrainStrength = strengthData.strength, terrainDelta = 0;
  if (spec.terrain && spec.terrain !== 'flat') {
    const flatRows = opponents.map((opponent, i) => duel(SA, candidate, opponent, { ...spec, terrain: 'flat' }, seed + 800001 + i * 1009, Math.max(1, Math.min(2, games))));
    terrainStrength = strengthFromRows(flatRows).strength;
    terrainDelta = strengthData.strength - terrainStrength;
  }
  const sample = rows.find(row => row.sample)?.sample || null;
  return { strength: strengthData.strength, strengthCi: strengthData.strengthCi, terrainStrength, terrainDelta, performance, rows, style: boundStyle, styleTrials, sample, chassis: chassisFor(SA, candidate), stats: SA.V.stats(candidate) };
}

function archive(candidates, spec) {
  const strengths = candidates.map(item => item.strength), performances = candidates.map(item => item.performance);
  const minMax = values => ({ min: Math.min(...values), max: Math.max(...values) });
  const norm = (value, range) => range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
  const sRange = minMax(strengths), pRange = minMax(performances);
  const featureKeys = ['speed', 'dps', 'hp', 'heatDps', 'water', 'cool', 'rams', 'tether'];
  const featureRange = Object.fromEntries(featureKeys.map(key => {
    const values = candidates.map(item => Number(item.stats[key]) || 0); return [key, minMax(values)];
  }));
  const center = Object.fromEntries(featureKeys.map(key => [key, candidates.reduce((sum, item) => sum + (Number(item.stats[key]) || 0), 0) / Math.max(1, candidates.length)]));
  for (const item of candidates) {
    item.composite = norm(item.strength, sRange) * 100 * (1 - config.archive.performanceWeight) + norm(item.performance, pRange) * 100 * config.archive.performanceWeight;
    item.featureDistance = Math.sqrt(featureKeys.reduce((sum, key) => {
      const range = featureRange[key], width = Math.max(1, range.max - range.min);
      return sum + Math.pow(((Number(item.stats[key]) || 0) - center[key]) / width, 2);
    }, 0));
  }
  const buckets = new Map();
  for (const item of candidates) {
    const key = `${item.style}|${item.chassis}|${spec.terrain}`;
    const list = buckets.get(key) || [];
    list.push(item); list.sort((a, b) => b.composite - a.composite);
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

function candidateRecord(SA, item, spec, fingerprint) {
  const moduleValues = {};
  for (const [id, count] of Object.entries(counts(SA, item.vehicle))) moduleValues[id] = count * cellValue(SA, id, spec.mat);
  return { name: item.vehicle.name, code: SA.V.encode(item.vehicle), cells: cellsOf(SA, item.vehicle), evaluationSeed: item.evaluationSeed ?? null, patch: exportPatch(SA, item.vehicle, spec, item.style), spec: { chapter: spec.chapter, stage: spec.stage, terrain: spec.terrain, rewardModule: spec.rewardModule, uniqueLoot: spec.uniqueLoot, budget: spec.budget, target: spec.target }, style: item.style, styleTrials: item.styleTrials, chassis: item.chassis, archiveClass: item.archiveClass || 'normal', strength: item.strength, strengthCi: item.strengthCi, terrainStrength: item.terrainStrength, terrainDelta: item.terrainDelta, performance: item.performance, featureDistance: item.featureDistance, typical: item.sample ? { winner: item.sample.winner, t: item.sample.t, reason: item.sample.reason, seed: item.sample.seed || null } : null, stats: { rating: item.stats.rating, value: item.stats.value, hp: item.stats.hp, dps: item.stats.dps, heatDps: item.stats.heatDps, water: item.stats.water, cool: item.stats.cool }, moduleValues, rules: fingerprint };
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
    const direct = SA.Battle.simulate({ p: candidate, e: opponent, pAim: 0.8, eAim: 0.8, pStyle: spec.style || 'wander', eStyle: 'wander', terrain: spec.terrain, seed: seed + i * 2 });
    const reverse = SA.Battle.simulate({ p: opponent, e: candidate, pAim: 0.8, eAim: 0.8, pStyle: 'wander', eStyle: spec.style || 'wander', terrain: spec.terrain, seed: seed + i * 2 + 1 });
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

// P5 选关证据：每一关只从本轮已评分候选中选车，并把硬条件和目标强度写入报告。
// 这些数值用于离线筛选，不会改动战役原有的名称、奖励或解锁字段。
function selectStageCandidate(SA, scored, spec, previousBoss, fingerprint, seed, usedStyles = new Set()) {
  const nonToxic = scored.filter(item => item.performance >= config.archive.toxicPerformanceBelow);
  const cleanPool = nonToxic.length ? nonToxic : scored;
  const reward = spec.rewardModule;
  const hasReward = item => !reward || !!counts(SA, item.vehicle)[reward];
  const genericPool = spec.boss ? cleanPool.filter(item => Math.abs(item.terrainDelta || 0) < config.archive.terrainDeltaMin) : cleanPool;
  const pool = spec.boss && genericPool.length ? genericPool : cleanPool;
  const validReward = pool.filter(hasReward);
  const candidates = validReward.length ? validReward : pool;
  const evidence = item => {
    const terrainPass = spec.terrain === 'flat' || (spec.boss ? Math.abs(item.terrainDelta || 0) < config.archive.terrainDeltaMin : (item.terrainDelta || 0) >= config.archive.terrainDeltaMin && item.performance >= config.archive.terrainPerformanceMin);
    const own = { rewardPresent: hasReward(item), performance: item.performance, strength: item.strength, style: item.style, terrainDelta: item.terrainDelta, terrainPass, bossGenericPass: !spec.boss || Math.abs(item.terrainDelta || 0) < config.archive.terrainDeltaMin };
    if (spec.boss) {
      // Boss 的平均胜率排除携带本关新奖励件的候选，避免把下一档装备当作本档标尺。
      const peers = scored.filter(peer => peer !== item && (!reward || !hasReward(peer))).slice(0, config.evaluation.anchorCount);
      const stablePeers = peers.length ? peers : scored.filter(peer => peer !== item).slice(0, config.evaluation.anchorCount);
      const rows = stablePeers.map((peer, i) => duel(SA, item.vehicle, peer.vehicle, spec, seed + i * 41, 1));
      const reverseRows = stablePeers.map((peer, i) => duel(SA, peer.vehicle, item.vehicle, spec, seed + 5001 + i * 41, 1));
      own.bossAverageWinRate = rows.length ? rows.reduce((sum, row) => sum + row.winRate, 0) / rows.length : 0.5;
      own.bossReverseWinRate = reverseRows.length ? reverseRows.reduce((sum, row) => sum + row.winRate, 0) / reverseRows.length : 0.5;
      own.target = spec.target.bossWinRate;
      own.targetPass = own.bossAverageWinRate >= 0.5 && own.bossReverseWinRate <= 0.5 && own.bossGenericPass;
      if (previousBoss) {
        own.previousBossWinRate = duel(SA, item.vehicle, previousBoss.vehicle, spec, seed + 997, 2).winRate;
        own.previousBossPass = own.previousBossWinRate < 0.3;
      } else { own.previousBossWinRate = null; own.previousBossPass = true; }
    } else if (previousBoss && spec.chapterHasBoss) {
      const bossRate = duel(SA, previousBoss.vehicle, item.vehicle, spec, seed + 997, 2).winRate;
      own.bossWinRate = bossRate;
      own.target = [0.6, 0.8];
      own.targetPass = bossRate >= 0.6 && bossRate <= 0.8;
      if (reward) {
        own.rewardWinRateAgainstPreviousBoss = duel(SA, item.vehicle, previousBoss.vehicle, spec, seed + 1997, 3).winRate;
        own.rewardLowerBoundPass = own.rewardWinRateAgainstPreviousBoss >= 0.6;
        own.previousBossWinRate = duel(SA, previousBoss.vehicle, item.vehicle, spec, seed + 2997, 3).winRate;
        own.rewardCrushGuardPass = own.previousBossWinRate >= 0.15;
        own.rewardUsage = usageAgainst(SA, item.vehicle, previousBoss.vehicle, spec, seed + 3997, 2, reward);
        own.rewardEffectPass = Object.values(own.rewardUsage.module || {}).some(value => value >= config.reward.effectMin);
        const control = replacementFor(SA, item.vehicle, reward, spec);
        own.rewardControl = control ? duel(SA, control, previousBoss.vehicle, spec, seed + 4997, 3).winRate : null;
        own.rewardContrastPass = own.rewardControl == null ? null : own.rewardWinRateAgainstPreviousBoss - own.rewardControl >= config.reward.controlDelta;
      }
    }
    return own;
  };
  const scoredEvidence = candidates.map(item => ({ item, evidence: evidence(item) }));
  const rank = x => {
    const e = x.evidence;
    const target = spec.boss ? 0.55 : 0.7;
    const rate = spec.boss ? (e.bossAverageWinRate ?? 0.5) : (e.bossWinRate ?? 0.7);
    const pass = (e.targetPass ? 1000 : 0) + (e.targetPass === false ? -800 : 0) + (e.terrainPass === false ? -900 : 0)
      + (usedStyles.has(e.style) ? -120 : 0) + (e.previousBossPass === false ? -1000 : 0)
      + (e.rewardLowerBoundPass === false ? -1000 : 0) + (e.rewardCrushGuardPass === false ? -1000 : 0)
      + (e.rewardEffectPass === false ? -700 : 0) + (e.rewardContrastPass === false ? -700 : 0);
    return pass - Math.abs(rate - target) * 100 + e.performance + e.strength / 100;
  };
  scoredEvidence.sort((a, b) => rank(b) - rank(a));
  const selected = scoredEvidence[0] || null;
  return { selected: selected?.item || null, evidence: selected?.evidence || null, candidateCount: candidates.length, fingerprint };
}

function generateChapter(SA, spec, previous, opponents, rng, fingerprint, quickGames) {
  const population = [];
  const wanted = Math.max(4, config.population.size);
  while (population.length < wanted) {
    // 奖励关至少半数初始种群强制携带奖励件，避免进化淘汰后报告只能挑一台“不带奖励”的普通车。
    const rewardSeed = spec.rewardModule && (population.length < Math.ceil(wanted * 0.5) || rng.chance(0.25));
    const forced = rewardSeed ? spec.rewardModule : null;
    const v = previous.length && rng.chance(1 - config.population.freshRate) ? mutate(SA, rng.pick(previous), spec, rng) : randomVehicle(SA, spec, rng, forced);
    if (v) population.push(v);
    else {
      // 某些奖励件（例如 2×2 重型装甲）在狭小地图上并非每个随机种子都能直接摆下。
      // 这里仍要求兜底车辆携带奖励件，只增加有限的确定性重试，避免偶然布局失败中断整章生成。
      let fallback = minimalVehicle(SA, spec, forced);
      if (!fallback && forced) {
        for (let retry = 0; retry < 24 && !fallback; retry++) {
          const retryRng = new RNG(rng.int(0x7fffffff) + retry + 1);
          fallback = randomVehicle(SA, spec, retryRng, forced);
        }
      }
      if (fallback) population.push(fallback);
      else throw new Error(`第 ${spec.chapter + 1} 章第 ${spec.stage + 1} 关没有可用的最小合法车辆`);
    }
  }
  let current = population;
  for (let generation = 0; generation < config.population.generations; generation++) {
    const scored = current.map((vehicle, index) => {
      const evalSeed = rng.int(0x7fffffff) + index;
      const result = evaluateCandidate(SA, vehicle, opponents, spec, evalSeed, quickGames);
      return { vehicle, evaluationSeed: evalSeed, ...result };
    }).sort((a, b) => (b.strength + b.performance) - (a.strength + a.performance));
    const keep = scored.slice(0, Math.max(2, Math.ceil(scored.length * config.population.survivors)));
    if (generation + 1 >= config.population.generations) return { scored, archive: archive(scored, spec) };
    current = [...keep.map(x => x.vehicle)];
    while (current.length < wanted) {
      const source = rng.pick(keep).vehicle;
      const child = mutate(SA, source, spec, rng);
      if (child) current.push(child); else current.push(randomVehicle(SA, spec, rng));
    }
  }
  return { scored: [], archive: { buckets: {}, toxic: [], odd: [] } };
}

function campaignOpponents(SA, chapter, stage) {
  const stages = SA.CAMPAIGN[chapter].stages;
  const chosen = [stages[stage], ...stages.filter((_, i) => i !== stage), SA.CAMPAIGN[Math.max(0, chapter - 1)]?.stages.at(-1)].filter(Boolean).slice(0, config.evaluation.anchorCount);
  return chosen.map(item => SA.V.fromAscii(item.name, item.rows, item.sides || [], item.mt || 1, item.elite || [], item.subs || []));
}

function run(options = {}) {
  const { SA } = loadGame();
  const fingerprint = ruleFingerprint(SA);
  const chapters = Math.min(options.chapters || SA.CAMPAIGN.length, SA.CAMPAIGN.length);
  const quickGames = options.games || config.evaluation.quickGames;
  const rng = new RNG(options.seed || 20260925);
  const all = [], chapterReports = [], selectionFailures = [];
  let previous = [];
  // 序章没有上一档 Boss，用开局车作为第一组标尺。
  let previousBoss = { vehicle: SA.V.fromAscii('序章开局车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []) };
  for (let chapter = 0; chapter < chapters; chapter++) {
    const pendingStages = [];
    const priorBoss = previousBoss;
    let chapterBoss = null;
    for (let stage = 0; stage < SA.CAMPAIGN[chapter].stages.length; stage++) {
      const spec = stageSpec(SA, chapter, stage);
      const opponents = campaignOpponents(SA, chapter, stage);
      const result = generateChapter(SA, spec, previous, opponents, rng, fingerprint, quickGames);
      const top = result.scored.slice(0, Math.min(8, result.scored.length));
      const records = top.map(item => candidateRecord(SA, item, spec, fingerprint));
      const archiveBucketCount = Object.keys(result.archive.buckets).length;
      pendingStages.push({ spec, scored: top, records, count: result.scored.length, archive: {
        buckets: archiveBucketCount,
        coveredRatio: archiveBucketCount / Math.max(1, result.scored.length),
        toxic: result.archive.toxic.length,
        odd: result.archive.odd.length,
        toxicCodes: result.archive.toxic.map(item => SA.V.encode(item.vehicle)),
        oddCodes: result.archive.odd.map(item => SA.V.encode(item.vehicle)),
        toxicCells: result.archive.toxic.map(item => cellsOf(SA, item.vehicle)),
        oddCells: result.archive.odd.map(item => cellsOf(SA, item.vehicle)),
      } });
      all.push(...records);
      previous = top.map(x => x.vehicle);
    }
    // 先按 Boss 的硬条件选出同章标尺，再让普通关引用这台车；
    // 不能直接取强度第一名，否则奖励、反向胜率和 Boss 目标没有参与选关。
    const bossEntry = pendingStages.find(entry => entry.spec.boss && entry.scored.length);
    if (bossEntry) {
      const bossSelection = selectStageCandidate(SA, bossEntry.scored, bossEntry.spec, priorBoss, fingerprint, (options.seed || 20260925) + chapter * 10000 + bossEntry.spec.stage * 101);
      chapterBoss = bossSelection.selected || bossEntry.scored[0];
    }
    previousBoss = chapterBoss || previousBoss;
    const usedStyles = new Set();
    const stages = pendingStages.map((entry, stage) => {
      const { spec, scored, records } = entry;
      // Boss 作为同章普通关标尺；上一章 Boss 用于 Boss 的门槛及奖励车防碾压检验。
      const referenceBoss = spec.boss ? priorBoss : (chapterBoss || priorBoss);
      const selection = selectStageCandidate(SA, scored, spec, referenceBoss, fingerprint, (options.seed || 20260925) + chapter * 10000 + stage * 101, spec.boss ? new Set() : usedStyles);
      const selectedIndex = Math.max(0, scored.indexOf(selection.selected));
      if (selection.evidence?.style) usedStyles.add(selection.evidence.style);
      const hardConditions = {
        reward: !spec.rewardModule || !!selection.evidence?.rewardPresent,
        nonToxic: !!selection.selected && selection.selected.performance >= config.archive.toxicPerformanceBelow,
        target: selection.evidence?.targetPass !== false,
        terrain: selection.evidence?.terrainPass !== false,
        bossGeneric: selection.evidence?.bossGenericPass !== false,
        previousBoss: selection.evidence?.previousBossPass !== false,
        rewardLowerBound: selection.evidence?.rewardLowerBoundPass !== false,
        rewardCrushGuard: selection.evidence?.rewardCrushGuardPass !== false,
        rewardEffect: selection.evidence?.rewardEffectPass !== false,
        rewardContrast: selection.evidence?.rewardContrastPass !== false,
      };
      const failed = Object.entries(hardConditions).filter(([, pass]) => !pass).map(([key]) => key);
      if (!selection.selected || failed.length) selectionFailures.push({ chapter, stage, name: spec.name, failed });
      return { spec, count: entry.count, selected: records[selectedIndex] || null, selection: { ...selection.evidence, candidateCount: selection.candidateCount, hardConditions, failed, selectedIndex }, top: records, archive: entry.archive };
    });
    chapterReports.push({ chapter, name: SA.CAMPAIGN[chapter].name, stages });
  }
  const moduleValues = Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, SA.CAMP_START.mat)]));
  if (options.strict && selectionFailures.length) throw new Error(`选关硬条件未全部满足：${JSON.stringify(selectionFailures)}`);
  return { generatedAt: new Date().toISOString(), seed: options.seed || 20260925, rules: fingerprint, moduleValues, config, chapters: chapterReports, selectionFailures, candidates: all };
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
      const item = SA.CAMPAIGN[chapter].stages[stage];
      const v = SA.V.fromAscii(item.name, item.rows, item.sides || [], item.mt || 1, item.elite || [], item.subs || []);
      const result = SA.Battle.simulate({ p: previousVehicle, e: v, terrain: item.terrain || 'flat', pStyle: 'wander', eStyle: item.style || 'wander', eBoss: !!item.boss, seed: chapter * 100 + stage });
      if (!Number.isFinite(result.t) || !Number.isFinite(result.pDealt) || !Number.isFinite(result.eDealt)) throw new Error(`战役第 ${chapter + 1} 章第 ${stage + 1} 关出现非有限模拟结果`);
      stages.push({ chapter, stage, t: result.t, winner: result.winner });
      previousVehicle = v;
    }
  }
  return { fingerprint: fp, vehicle: SA.V.stats(a), legalMutations, mutationOps: [...new Set(mutationOps)].sort((x, y) => x - y), share: { roundTrip: true, legacyMigrated: true }, result: duelA, campaign: { stages: stages.length, finite: true, specs: campaignSpecs } };
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
    SA.V.fromAscii('序章车', SA.CAMPAIGN[0].stages[0].rows, [], 1),
    SA.V.fromAscii('第一章 Boss', SA.CAMPAIGN[1].stages[2].rows, SA.CAMPAIGN[1].stages[2].sides || [], 1, SA.CAMPAIGN[1].stages[2].elite || [], SA.CAMPAIGN[1].stages[2].subs || []),
    SA.V.fromAscii('第三章 Boss', SA.CAMPAIGN[3].stages[2].rows, SA.CAMPAIGN[3].stages[2].sides || [], 3, SA.CAMPAIGN[3].stages[2].elite || [], SA.CAMPAIGN[3].stages[2].subs || []),
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
  const heatSpec = stageSpec(SA, 3, 0), heatModule = heatSpec.availableMods.includes('flamer') ? 'flamer' : 'steamjet';
  let heatVehicle = null;
  for (let i = 0; i < 80 && !heatVehicle; i++) heatVehicle = randomVehicle(SA, heatSpec, new RNG(18001 + i * 31), heatModule) || minimalVehicle(SA, heatSpec, heatModule);
  const heatRows = heatVehicle ? healthRows(SA, heatVehicle, normal, { terrain: 'flat', style: 'rush' }, 18000, games) : [];
  const earlyHeatWins = heatRows.filter(row => row.winner === 'p' && row.t < 25 && /烧干|锅炉/.test(row.reason || '')).length;
  const parameterSearch = [];
  const original = { BATTLE_TIME: SA.K.BATTLE_TIME, KNOCK_MAX: SA.K.KNOCK_MAX };
  try {
    for (const key of Object.keys(original)) for (const factor of [0.9, 1, 1.1]) {
      SA.K[key] = Math.max(1, Math.round(original[key] * factor));
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
  const baseline = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const { SA } = loadGame();
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

// P7 固定夹具：故意把战斗时限缩到 1/10，验证影响报告能识别规则指纹变化并标出候选偏移（缩到一半时多数对局 50 秒内就结束，结果不变，测不出来）。
function impactCheck() {
  const { SA } = loadGame();
  const spec = stageSpec(SA, 0, 0), vehicle = minimalVehicle(SA, spec);
  if (!vehicle) throw new Error('P7 夹具无法生成合法车辆');
  const seed = 62026, result = evaluateCandidate(SA, vehicle, campaignOpponents(SA, 0, 0), spec, seed, 2);
  const item = { vehicle, evaluationSeed: seed, ...result };
  const baseline = { rules: ruleFingerprint(SA), moduleValues: Object.fromEntries(Object.keys(SA.MODULES).map(id => [id, cellValue(SA, id, 1)])), candidates: [candidateRecord(SA, item, spec, ruleFingerprint(SA))] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-evolve-impact-')), file = path.join(dir, 'evolve-fixture.json');
  try {
    fs.writeFileSync(file, JSON.stringify(baseline), 'utf8');
    const report = impact(file, 2, { key: 'BATTLE_TIME', factor: 0.1 });   // 战斗只剩 10 秒：几乎所有对局都会超时，必然偏移
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
  if (mode === '--health') { console.log(JSON.stringify(healthCheck(Number(argv[1]) || 4), null, 2)); return; }
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

module.exports = { RNG, loadGame, ruleFingerprint, stageSpec, campaignSpecCheck, randomVehicle, minimalVehicle, mutate, performanceScore, strengthFromRows, evaluateCandidate, generateChapter, usageAgainst, replacementFor, selectStageCandidate, robustness, run, runParallel, parallelCheck, healthCheck, impact, impactCheck, check };
