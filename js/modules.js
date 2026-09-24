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
  FOCUS_MIN: 0.3,     // 瞄准稳定度满时，散布缩到原来的 30%
};

SA.MODULES = {
  track: {
    name: '履带底盘', cat: 'mobility', layer: 'chassis',
    price: 150, hp: 200, power: 0, load: 3500, speed: 48, kg: 600, q: 2, accel: 1, brake: 1, sway: 1, spool: 1,
    desc: '承重大、耐打，但又重又慢。所有模块都要站在底盘列上。',
  },
  quad: {
    name: '四足底盘', cat: 'mobility', layer: 'chassis',
    price: 140, hp: 140, power: 0, load: 2400, acc: 0.06, speed: 62, kg: 400, q: 2, accel: 0.85, brake: 0.55, sway: 0.45, spool: 1.1,
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
    price: 40, hp: 160, power: 0, kg: 350, q: 1,
    desc: '廉价的挡箭牌，不耗动力但有分量。直射炮弹会先打中弹道上的第一个模块。',
  },
  armor_heavy: {
    name: '重装甲', cat: 'structure', layer: 'body',
    price: 95, hp: 320, power: 0, kg: 750, q: 2,
    desc: '两倍厚度，也重了一倍多：吃掉底盘承重，拖慢车速。',
  },
  cannon: {
    name: '直射火炮', cat: 'firepower', layer: 'body',
    price: 170, hp: 150, power: 3, kg: 350, q: 2,
    dmg: 32, reload: 2.4, heat: 6, proj: 'shell', barrel: 24, v: 840, g: 1, spread: 2, arc: 'low',
    elev: [-8, 30], slew: 24, windup: 0.35, wild: 0.12, rest: 0, aimT: 1.2,
    rcPx: 9, back: 0.05, ret: 2.2, kick: 70,   // 制退行程 px、打到底停顿、复进速度、对车身的反冲
    desc: '平射火炮，弹道低平。仰角只有 -8°~30°，太高太近的目标够不着；炮弹有散布，偶尔会打飞。同一行前方不能有己方模块。',
  },
  mortar: {
    name: '高抛火炮', cat: 'firepower', layer: 'body',
    price: 190, hp: 150, power: 3, kg: 450, q: 3,
    dmg: 38, reload: 3.4, heat: 7, proj: 'shell', barrel: 0, v: 780, g: 1, spread: 0, arc: 'high', indirect: true,
    elev: [32, 82], slew: 20, windup: 0.45, wild: 0, rest: 55, aimT: 1.4,
    rcPx: 6, back: 0.06, ret: 2.5, kick: 40,
    desc: '炮口朝天，弹道高抛，可以躲在装甲后面开火，砸敌人的顶部。指哪打哪，但炮弹飞得慢，移动中的目标会躲开。',
  },
  mg: {
    name: '机枪', cat: 'firepower', layer: 'body',
    price: 110, hp: 130, power: 2, kg: 150, q: 1,
    dmg: 5, reload: 0.4, heat: 1.2, proj: 'bullet', barrel: 12, v: 1230, g: 0.27, spread: 2.8, arc: 'low',
    elev: [-8, 32], slew: 50, windup: 0.15, wild: 0.1, rest: 0, aimT: 0.4,
    rcPx: 2, back: 0, ret: 14, kick: 5,
    desc: '高射速低伤害。前方同样不能有遮挡。',
  },
  side_cannon: {
    name: '侧炮', cat: 'firepower', layer: 'side',
    price: 150, hp: 120, power: 2, kg: 200, q: 2,
    dmg: 27, reload: 2.8, heat: 5, proj: 'shell', barrel: 18, v: 780, g: 1, spread: 6, arc: 'low',
    elev: [-6, 24], slew: 18, windup: 0.4, wild: 0.18, rest: 0, aimT: 1,
    rcPx: 7, back: 0.04, ret: 2.6, kick: 55,
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
    price: 110, hp: 260, power: 0, kg: 450, q: 2, ram: 22, knock: 1.8,
    desc: '装在底盘正前方。撞击伤害中等但极其结实，能把对手铲退很远。',
  },
  spike: {
    name: '撞角', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy'],
    price: 130, hp: 160, power: 0, kg: 600, q: 2, ram: 40, knock: 1,
    desc: '装在装甲正前方的实心钢角，比铲斗重得多。伤害随撞击速度和车重大幅提升，全速冲撞最痛。',
  },
  piston: {
    name: '蒸汽撞锤', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy'],
    price: 170, hp: 150, power: 2, kg: 700, q: 3, ram: 16, punch: 26, punchCd: 1.5, heat: 3,
    desc: '装在装甲正前方。贴身时每 1.5 秒用蒸汽活塞猛击一次，不依赖速度。',
  },
};

SA.MODULE_ORDER = ['track', 'quad', 'biped', 'cockpit', 'boiler', 'water',
  'armor', 'armor_heavy', 'cannon', 'mortar', 'mg', 'side_cannon', 'bucket', 'spike', 'piston',
  'copilot'];   // 新模块只能追加在末尾：分享码按这里的序号编码

// 品质：编辑器排序与商店标签用
SA.QUALITY = { 1: { name: '普通', star: '★' }, 2: { name: '精良', star: '★★' }, 3: { name: '稀有', star: '★★★' } };

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
