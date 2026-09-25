// 模块注册表。layer: chassis(只能放最底行) | body(主体层) | side(侧挂层，只能挂在主体模块上) | ram(撞击，挂在底盘/装甲正前方)
window.SA = window.SA || {};

SA.K = {
  COLS: 8,
  ROWS: 6,            // 最高 6 层（含底盘行）
  CELL: 48,           // 原生像素
  GRAVITY: 780,       // 炮弹重力 px/s²
  MOVE_HEAT: 2,       // 行驶额外产热 /秒
  MOVE_WATER: 0.3,    // 行驶直接耗水 /秒（蒸汽驱动）
  FIRE_WATER: 0.15,   // 开火耗水：每发 = 武器产热 × 该系数
  CHUFF_WATER: 0.2,   // 起步时锅炉每「库吃」一下耗水
  ACCEL: 48,          // 起步加速度 px/s²（按质量缩放；撞击需要助跑）
  BRAKE: 62,          // 制动减速度 px/s²：松开按键会滑行一大段才停下；反向要先停稳再重新起步
  HEAT_MAX: 100,
  DISSIPATE: 1.2,     // 自然散热 /秒
  IDLE_HEAT: 0.8,     // 机器只要在运转就会产热 /秒（站着不动也会慢慢变热）
  COOL_FULL: 30,      // 热量到这个值时水箱全力冷却；越凉冷却越弱，所以热量会缓慢积累
  WATER_PER_HEAT: 0.25, // 每冷却 1 点热量消耗的水
  BATTLE_TIME: 100,
  GAME_SPEED: 0.75,   // 战斗节奏默认放慢到 0.75 倍（战斗界面底部有滑条可调，记在本机）
  // 重量：每个模块 = 基础重量 + 自身重量（kg）；底盘按承重（kg）限制总重
  WEIGHT_BASE: 250,
  DRIVE_PER_T: 0.3,   // 每吨车重需要的行驶动力：动力需求 = 设备耗能 + 车重 × 该系数
  RAM_SELF: 0.3,      // 撞击时自己的撞击面承受的反作用伤害（占造成伤害的比例）
  // 模块改装（炮盾 / 附加装甲）：纯属性升级，最多 3 级
  UP_MAX: 3,
  UP_KG: 120,         // 每级增加的重量 kg
  UP_COST: 0.25,      // 第 n 级价格 = 模块原价 × 该系数 × n
  KMH: 0.1125,        // 速度换算：1 px/s ≈ 0.1125 km/h（一格 48px ≈ 1.5 m）
  SPEED_BOOST: 1.25,  // 锅炉富余时最多超速到底盘基础速度的 125%
  FOCUS_KICK: 0.35,   // 开火后瞄准稳定度保留的比例（后坐力）
  FOCUS_KICK_FAST: 0.88,   // 快枪（机枪）每发只震掉一点：持续扫射也能慢慢稳住
  // 瞄准（按住蓄力缩圈）：稳定度 0~100%；满时散布缩小 AIM_SHRINK，蓄满速度 × AIM_SPEED
  // 这是前期的基础值：以后加装瞄准镜等部件（模块字段 aimShrink / aimSpeed）可以缩得更多、更快
  AIM_SHRINK: 0.3,    // 基础缩圈幅度：最多把散布缩小 30%
  AIM_SHRINK_MAX: 0.75,
  AIM_SPEED: 0.5,     // 基础瞄准速度：直射火炮约 2.4 秒蓄满
  FAST_RELOAD: 1,     // 装填短于这个秒数的武器（机枪）按住就连发
};

SA.MODULES = {
  track: {
    name: '履带底盘', cat: 'mobility', layer: 'chassis',
    price: 150, hp: 200, power: 0, armor: 2, load: 3500, speed: 48, kg: 600, q: 2, accel: 1, brake: 1, sway: 1, spool: 1,
    desc: '承重大、耐打，但又重又慢。所有模块都要站在底盘列上。',
  },
  quad: {
    name: '四足底盘', cat: 'mobility', layer: 'chassis',
    price: 140, hp: 140, power: 0, armor: 1, load: 2400, acc: 0.06, speed: 62, kg: 400, q: 2, accel: 0.85, brake: 0.55, sway: 0.45, spool: 1.1,
    desc: '最平稳的射击平台：静止散布 -30%，边走边打也几乎不晃；但刹车最慢，停下来要滑很远。',
  },
  biped: {
    name: '双足底盘', cat: 'mobility', layer: 'chassis',
    price: 120, hp: 110, power: 0, load: 2400, evade: 0.12, speed: 78, kg: 250, q: 1, accel: 1.5, brake: 1.7, sway: 1.5, spool: 0.55,
    desc: '起步、刹车、跑得都最快，摇摆步态让敌人难以命中；但自己走起来晃得厉害，移动射击散布最大。',
  },
  cockpit: {
    name: '驾驶舱', cat: 'control', layer: 'body',
    price: 120, hp: 200, power: 1, kg: 150, q: 1,
    desc: '至少需要 1 个。全部被毁即告负。高抛炮能从上方砸下来，记得加顶甲。',
  },
  copilot: {
    name: '副驾驶', cat: 'control', layer: 'body',
    price: 140, hp: 150, power: 1, kg: 150, q: 2,
    desc: '替你操作一组你当前没在用的武器：你切换武器组，他就接手剩下的。多一个副驾驶就多管一组。枪法不如你准。',
  },
  armor: {
    name: '铁装甲', cat: 'structure', layer: 'body',
    price: 40, hp: 160, power: 0, armor: 3, kg: 350, q: 1,
    desc: '廉价的挡箭牌，不耗动力但有分量。护甲 3：每发炮弹先减掉 3 点伤害，机枪打上去只冒火星。直射炮弹会先打中弹道上的第一个模块。',
  },
  armor_heavy: {
    name: '重装甲', cat: 'structure', layer: 'body',
    price: 95, hp: 320, power: 0, armor: 6, kg: 750, q: 2,
    desc: '两倍厚度，护甲 6，机枪基本打不动；也重了一倍多：吃掉底盘承重，拖慢车速。',
  },
  cannon: {
    name: '直射火炮', cat: 'firepower', layer: 'body',
    price: 170, hp: 150, power: 3, kg: 350, q: 2,
    dmg: 32, reload: 2.4, heat: 6, proj: 'shell', barrel: 24, v: 840, g: 1, spread: 12, arc: 'low',
    elev: [-8, 30], slew: 24, windup: 0.35, wild: 0.12, rest: 0, aimT: 1.2,
    rcPx: 9, back: 0.05, ret: 2.2, kick: 70,   // 制退行程 px、打到底停顿、复进速度、对车身的反冲
    piv: [34, 27], blen: 40,                   // 耳轴（格内坐标）与耳轴到炮口的长度：炮管绕它转
    desc: '平射火炮，弹道低平。仰角只有 -8°~30°，太高太近的目标够不着；炮弹有散布，偶尔会打飞。同一行前方不能有己方模块。',
  },
  mortar: {
    name: '高抛火炮', cat: 'firepower', layer: 'body',
    price: 190, hp: 150, power: 3, kg: 450, q: 3,
    dmg: 38, reload: 3.4, heat: 7, proj: 'shell', barrel: 0, v: 780, g: 1, spread: 0, arc: 'high', indirect: true,
    elev: [32, 82], slew: 20, windup: 0.45, wild: 0, rest: 55, aimT: 1.4,
    rcPx: 6, back: 0.06, ret: 2.5, kick: 40, piv: [20, 30], blen: 27,
    desc: '炮口朝天，弹道高抛，可以躲在装甲后面开火，砸敌人的顶部。指哪打哪，但炮弹飞得慢，移动中的目标会躲开。',
  },
  mg: {
    name: '机枪', cat: 'firepower', layer: 'body',
    price: 110, hp: 130, power: 2, kg: 150, q: 1,
    dmg: 5, reload: 0.4, heat: 1.2, proj: 'bullet', barrel: 12, v: 1230, g: 0.27, spread: 10, arc: 'low',
    elev: [-8, 32], slew: 50, windup: 0.15, wild: 0.1, rest: 0, aimT: 0.4,
    rcPx: 2, back: 0, ret: 14, kick: 5, piv: [34, 29], blen: 26,
    desc: '高射速低伤害，专打没有护甲的锅炉、水箱、驾驶舱；打装甲只冒火星。前方同样不能有遮挡。',
  },
  side_cannon: {
    name: '侧炮', cat: 'firepower', layer: 'side',
    price: 150, hp: 120, power: 2, kg: 200, q: 2,
    dmg: 27, reload: 2.8, heat: 5, proj: 'shell', barrel: 18, v: 780, g: 1, spread: 15, arc: 'low',
    elev: [-6, 24], slew: 18, windup: 0.4, wild: 0.18, rest: 0, aimT: 1,
    rcPx: 7, back: 0.04, ret: 2.6, kick: 55, piv: [18, 34], blen: 48,
    desc: '挂在侧挂层，可藏在装甲后方，射击不被己方遮挡；但炮身晃动，弹道散布很大。',
  },
  boiler: {
    name: '燃煤锅炉', cat: 'energy', layer: 'body',
    price: 130, hp: 120, power: 0, supply: 6, q: 1, heatRate: 1.5, explode: 40, kg: 550,
    desc: '提供 6 点动力；动力用得越满，产热越多。被击毁会爆炸波及相邻模块。',
  },
  water: {
    name: '水箱', cat: 'cooling', layer: 'body',
    price: 70, hp: 100, power: 0, water: 50, q: 1, cool: 4, kg: 300,
    desc: '每秒吸收 4 热量并消耗水。水烧干后热量会迅速堆积。',
  },
  bucket: {
    name: '铲斗', cat: 'ram', layer: 'ram', mount: ['track', 'quad', 'biped'],
    price: 110, hp: 260, power: 0, armor: 5, kg: 450, q: 2, ram: 22, knock: 1.8,
    desc: '装在底盘正前方。撞击伤害中等但极其结实，能把对手铲退很远。',
  },
  spike: {
    name: '撞角', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy', 'track', 'quad', 'biped'],
    price: 130, hp: 160, power: 0, kg: 600, q: 2, ram: 40, knock: 1,
    desc: '装在装甲或底盘正前方的实心钢角，比铲斗重得多。装在底盘前能顶到对手的履带和腿；伤害随撞击速度和车重大幅提升，全速冲撞最痛。',
  },
  piston: {
    name: '蒸汽撞锤', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy', 'track', 'quad', 'biped'],
    price: 170, hp: 150, power: 2, kg: 700, q: 3, ram: 16, punch: 26, punchCd: 1.5, heat: 3,
    desc: '装在装甲或底盘正前方。贴身时每 1.5 秒用蒸汽活塞猛击一次，不依赖速度。',
  },
};

SA.MODULE_ORDER = ['track', 'quad', 'biped', 'cockpit', 'boiler', 'water',
  'armor', 'armor_heavy', 'cannon', 'mortar', 'mg', 'side_cannon', 'bucket', 'spike', 'piston',
  'copilot'];   // 新模块只能追加在末尾：分享码按这里的序号编码


SA.isWeapon = (id) => !!SA.MODULES[id].dmg;
// 模块重量（kg）：基础重量 + 自身重量 + 改装加重
SA.weightOf = (cell) => SA.K.WEIGHT_BASE + (SA.MODULES[cell.id].kg || 0) + (cell.lv || 0) * SA.K.UP_KG;
const fmtT = (kg) => `${(kg / 1000).toFixed(kg < 10000 ? 2 : 1)} t`;
SA.tons = fmtT;
SA.kmh = (pxs) => `${(pxs * SA.K.KMH).toFixed(1)} km/h`;
// 撞击伤害倍率：跟车重成正比（6 t 为 ×1），0.5 ~ 3 倍
SA.ramMul = (kg) => Math.max(0.5, Math.min(3, kg / 6000));
// 改装：武器加炮盾，底盘加裙板，撞击件加厚撞面，其余加附加装甲
SA.upName = (id) => (SA.isWeapon(id) ? '炮盾' : SA.MODULES[id].layer === 'chassis' ? '加固裙板' : SA.MODULES[id].layer === 'ram' ? '加厚撞面' : '附加装甲');
SA.upHp = (id) => (SA.isWeapon(id) ? 0.3 : 0.25);   // 每级耐久 +%
SA.upCost = (id, lv) => Math.round(SA.MODULES[id].price * SA.K.UP_COST * lv);
// 水箱这一刻能带走多少热量 /秒：越热冷却越猛（最低 15%）
SA.coolRate = (cool, heat) => cool * Math.max(0.15, Math.min(1, heat / SA.K.COOL_FULL));
SA.isRam = (id) => SA.MODULES[id].layer === 'ram';

// ---------- 材料：模块品质 = 材料 ----------
// 1~4 用钱在车间升级（随战役解锁）；5 史诗、6 传奇还要消耗特定的锭 / 结晶，只能靠委托、缴获和 Boss 掉落获得
// mul：耐久、伤害、动力、水、冷却、撞击、活塞、承重、护甲一起放大；产热和重量不变，所以好材料更「省」
// cost：从上一级升到这一级的费用 = 模块原价 × cost；tint / a / lite / dark：换色（'color' 混合保留原图明暗，再提亮 / 压暗）
SA.MATS = [null,
  { key: 'brass', name: '黄铜', mul: 1.00, cost: 0, chip: '#d9a441' },
  { key: 'iron', name: '熟铁', mul: 1.20, cost: 0.6, chip: '#8d8f96', tint: '#6a6c72', a: 0.9, dark: 0.3 },
  { key: 'steel', name: '钢', mul: 1.45, cost: 1.0, chip: '#7f9fc4', tint: '#5f86b8', a: 0.75 },
  { key: 'nickel', name: '镀镍', mul: 1.75, cost: 1.6, chip: '#e2e6ec', tint: '#cfd6de', a: 0.9, lite: 0.22 },
  { key: 'wootz', name: '乌兹钢', mul: 2.10, cost: 2.2, chip: '#b07ae6', tint: '#8f55d6', a: 0.8, ingot: 'wootz', rank: '史诗' },
  { key: 'aether', name: '以太合金', mul: 2.50, cost: 3.0, chip: '#4fe3d2', tint: '#2fd6c4', a: 0.85, lite: 0.12, ingot: 'aether', rank: '传奇' },
];
SA.MAT_MAX = SA.MATS.length - 1;
// 史诗 / 传奇材料：升级时每次消耗 1 块
SA.INGOTS = {
  wootz: { name: '乌兹钢锭', desc: '印度坩埚钢，花纹像流水。把镀镍模块升到史诗级「乌兹钢」要用 1 块。' },
  aether: { name: '以太结晶', desc: '女王号锅炉里取出的发光结晶。把乌兹钢模块升到传奇级「以太合金」要用 1 块。' },
};
const MAT_SCALED = ['hp', 'dmg', 'supply', 'water', 'cool', 'ram', 'punch', 'load', 'armor'];
const modCache = new Map();
// 某一格模块按材料放大后的定义：SA.mod(cell) 或 SA.mod(id, mt)
SA.mod = (x, mt) => {
  const id = typeof x === 'object' ? x.id : x;
  mt = Math.max(1, Math.min(SA.MAT_MAX, (typeof x === 'object' ? x.mt : mt) || 1));
  const key = `${id}@${mt}`;
  let m = modCache.get(key);
  if (!m) {
    const base = SA.MODULES[id], mul = SA.MATS[mt].mul;
    m = { ...base, mt };
    for (const k of MAT_SCALED) if (base[k]) m[k] = k === 'hp' || k === 'load' ? Math.round(base[k] * mul) : Math.round(base[k] * mul * 10) / 10;
    modCache.set(key, m);
  }
  return m;
};
SA.newCell = (id, mt = 1) => (mt > 1 ? { id, mt, hp: SA.mod(id, mt).hp } : { id, hp: SA.MODULES[id].hp });
SA.matOf = (cell) => SA.MATS[(cell && cell.mt) || 1];
SA.matUpCost = (id, toMt) => Math.round(SA.MODULES[id].price * SA.MATS[toMt].cost);
// 模块总价值：原价 + 材料升级 + 改装件（修理、回收、卖出都按它算）
SA.cellValue = (cell) => {
  let v = SA.MODULES[cell.id].price;
  for (let t = 2; t <= (cell.mt || 1); t++) v += SA.matUpCost(cell.id, t);
  for (let k = 1; k <= (cell.lv || 0); k++) v += SA.upCost(cell.id, k);
  return v;
};
// 护甲：每发炮弹先减掉固定伤害（最少保留 25%）
SA.armorCut = (m, dmg) => (m.armor ? Math.max(dmg * 0.25, dmg - m.armor) : dmg);
// 库存键：黄铜直接用 id，其余是 id@材料
SA.invKey = (id, mt = 1) => (mt > 1 ? `${id}@${mt}` : id);
SA.parseKey = (k) => { const [id, t] = String(k).split('@'); return { id, mt: +t || 1 }; };
