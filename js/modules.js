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
  DISSIPATE: 3,       // 自然散热 /秒
  WATER_PER_HEAT: 0.25, // 每冷却 1 点热量消耗的水
  BATTLE_TIME: 100,
};

SA.MODULES = {
  track: {
    name: '履带底盘', cat: 'mobility', layer: 'chassis',
    price: 150, hp: 200, power: 0, cap: 5, speed: 48, mass: 3, q: 2,
    desc: '承载上限高、耐打，但开得慢。所有模块都要站在底盘列上。',
  },
  quad: {
    name: '四足底盘', cat: 'mobility', layer: 'chassis',
    price: 140, hp: 140, power: 0, cap: 4, acc: 0.06, speed: 62, mass: 2, q: 2,
    desc: '平稳的射击平台：弹道散布 -30%，速度中等。',
  },
  biped: {
    name: '双足底盘', cat: 'mobility', layer: 'chassis',
    price: 120, hp: 110, power: 0, cap: 3, evade: 0.12, speed: 78, mass: 1.5, q: 1,
    desc: '跑得最快，摇摆步态让敌方弹道散布更大。',
  },
  cockpit: {
    name: '驾驶舱', cat: 'control', layer: 'body',
    price: 120, hp: 200, power: 1, mass: 1, q: 1,
    desc: '至少需要 1 个。全部被毁即告负。高抛炮能从上方砸下来，记得加顶甲。',
  },
  armor: {
    name: '铁装甲', cat: 'structure', layer: 'body',
    price: 40, hp: 160, power: 1, mass: 1.5, q: 1,
    desc: '廉价的挡箭牌。直射炮弹会先打中弹道上的第一个模块。',
  },
  armor_heavy: {
    name: '重装甲', cat: 'structure', layer: 'body',
    price: 95, hp: 320, power: 2, mass: 3, q: 2,
    desc: '两倍厚度，两倍的动力负担。',
  },
  cannon: {
    name: '直射火炮', cat: 'firepower', layer: 'body',
    price: 170, hp: 100, power: 3, mass: 1.5, q: 2,
    dmg: 32, reload: 2.4, heat: 6, proj: 'shell', barrel: 24, v: 840, g: 1, spread: 2, arc: 'low',
    elev: [-8, 30], slew: 24, windup: 0.35, wild: 0.12, rest: 0,
    desc: '平射火炮，弹道低平。仰角只有 -8°~30°，太高太近的目标够不着；炮弹有散布，偶尔会打飞。同一行前方不能有己方模块。',
  },
  mortar: {
    name: '高抛火炮', cat: 'firepower', layer: 'body',
    price: 190, hp: 100, power: 3, mass: 1.5, q: 3,
    dmg: 38, reload: 3.4, heat: 7, proj: 'shell', barrel: 0, v: 780, g: 1, spread: 0, arc: 'high', indirect: true,
    elev: [32, 82], slew: 20, windup: 0.45, wild: 0, rest: 55,
    desc: '炮口朝天，弹道高抛，可以躲在装甲后面开火，砸敌人的顶部。指哪打哪，但炮弹飞得慢，移动中的目标会躲开。',
  },
  mg: {
    name: '机枪', cat: 'firepower', layer: 'body',
    price: 110, hp: 80, power: 2, mass: 1, q: 1,
    dmg: 5, reload: 0.4, heat: 1.2, proj: 'bullet', barrel: 12, v: 1230, g: 0.27, spread: 2.8, arc: 'low',
    elev: [-8, 32], slew: 50, windup: 0.15, wild: 0.1, rest: 0,
    desc: '高射速低伤害。前方同样不能有遮挡。',
  },
  side_cannon: {
    name: '侧炮', cat: 'firepower', layer: 'side',
    price: 150, hp: 80, power: 2, mass: 1, q: 2,
    dmg: 27, reload: 2.8, heat: 5, proj: 'shell', barrel: 18, v: 780, g: 1, spread: 6, arc: 'low',
    elev: [-6, 24], slew: 18, windup: 0.4, wild: 0.18, rest: 0,
    desc: '挂在侧挂层，可藏在装甲后方，射击不被己方遮挡；但炮身晃动，弹道散布很大。',
  },
  boiler: {
    name: '燃煤锅炉', cat: 'energy', layer: 'body',
    price: 130, hp: 120, power: 0, supply: 6, q: 1, heatRate: 1.5, explode: 40, mass: 2,
    desc: '提供 6 点动力；动力用得越满，产热越多。被击毁会爆炸波及相邻模块。',
  },
  water: {
    name: '水箱', cat: 'cooling', layer: 'body',
    price: 70, hp: 100, power: 0, water: 50, q: 1, cool: 4, mass: 1.5,
    desc: '每秒吸收 4 热量并消耗水。水烧干后热量会迅速堆积。',
  },
  bucket: {
    name: '铲斗', cat: 'ram', layer: 'ram', mount: ['track', 'quad', 'biped'],
    price: 110, hp: 260, power: 1, mass: 2, q: 2, ram: 22, knock: 1.8,
    desc: '装在底盘正前方。撞击伤害中等但极其结实，能把对手铲退很远。',
  },
  spike: {
    name: '撞角', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy'],
    price: 130, hp: 160, power: 1, mass: 1, q: 2, ram: 40, knock: 1,
    desc: '装在装甲正前方的尖角。伤害随撞击速度大幅提升，全速冲撞最痛。',
  },
  piston: {
    name: '蒸汽撞锤', cat: 'ram', layer: 'ram', mount: ['armor', 'armor_heavy'],
    price: 170, hp: 150, power: 2, mass: 1.5, q: 3, ram: 16, punch: 26, punchCd: 1.5, heat: 3,
    desc: '装在装甲正前方。贴身时每 1.5 秒用蒸汽活塞猛击一次，不依赖速度。',
  },
};

SA.MODULE_ORDER = ['track', 'quad', 'biped', 'cockpit', 'boiler', 'water',
  'armor', 'armor_heavy', 'cannon', 'mortar', 'mg', 'side_cannon', 'bucket', 'spike', 'piston'];

// 品质：编辑器排序与商店标签用
SA.QUALITY = { 1: { name: '普通', star: '★' }, 2: { name: '精良', star: '★★' }, 3: { name: '稀有', star: '★★★' } };

SA.isWeapon = (id) => !!SA.MODULES[id].dmg;
SA.isRam = (id) => SA.MODULES[id].layer === 'ram';
