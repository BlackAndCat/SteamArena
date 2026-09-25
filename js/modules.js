// 模块注册表。layer: chassis(只能放最底行) | body(主体层) | side(侧挂层，只能挂在主体模块上) | ram(撞击，挂在底盘/装甲正前方)
// 通用机制字段：salvo=每轮发射数，salvoGap=轮内间隔；splash={r,k}=命中点溅射半径与衰减；
// tether=牵引收绳速度；range=持续喷射射程，cone=半角；heatPerSec/dmgPerSec=持续喷射速率；
// store=蓄压容量，dryCool=不耗水散热，waterSave=冷却耗水倍率；reloadMul/spreadMul=实体辅助效果。
// 底盘 susp：悬挂。pts 每格两个接地点（48px 格内的 x，近侧脚在前、远侧脚在后），up / down 上收 / 下伸行程（px），follow 车身跟坡的比例（其余交给悬挂）。
// 蜘蛛四足的脚往外张：splay = 脚离胯多远，hips = 近侧 / 远侧的胯；同一段四足的前半格往前张、后半格往后张（SA.suspPts 算）
window.SA = window.SA || {};

// 格子：子格 24px，全车 16 列 × 12 行（= 以前的 8 × 6 大格，每个大格分成 2×2 子格）。
// 模块记在左上角那一格（锚点），占 w×h 个子格：现有模块都是 2×2（画面 48px），新增 1×1、1×2 的小模块。
// 关卡 / 蓝图的 ASCII 仍按大格写，读进来时换算成子格（SA.V.fromAscii）
SA.K = {
  COLS: 16,
  ROWS: 12,           // 最高 6 层大格（含底盘的两行子格）
  CELL: 24,           // 子格原生像素
  ART: 48,            // 模块精灵的原生尺寸（2×2 子格）
  GRAVITY: 780,       // 炮弹重力 px/s²
  MOVE_HEAT: 2,       // 行驶额外产热 /秒
  MOVE_WATER: 0.3,    // 行驶直接耗水 /秒（蒸汽驱动）
  FIRE_WATER: 0.15,   // 开火耗水：每发 = 武器产热 × 该系数
  CHUFF_WATER: 0.2,   // 起步时锅炉每「库吃」一下耗水
  ACCEL: 48,          // 起步加速度 px/s²（按质量缩放；撞击需要助跑）
  BRAKE: 62,          // 制动减速度 px/s²：松开按键会滑行一大段才停下；反向要先停稳再重新起步
  SKID: 320,          // 被撞飞 / 被推着走时的打滑急停减速度 px/s²（场地没有墙，靠它让车停住）
  KNOCK_MAX: 70,      // 铲斗 / 撞角 / 撞锤一次击退的速度上限 px/s
  HEAT_MAX: 100,
  DISSIPATE: 1.2,     // 自然散热 /秒
  IDLE_HEAT: 0.8,     // 机器只要在运转就会产热 /秒（站着不动也会慢慢变热）
  COOL_FULL: 30,      // 热量到这个值时水箱全力冷却；越凉冷却越弱，所以热量会缓慢积累
  WATER_PER_HEAT: 0.25, // 每冷却 1 点热量消耗的水
  BATTLE_TIME: 100,
  GAME_SPEED: 0.75,   // 战斗节奏默认放慢到 0.75 倍（战斗界面底部有滑条可调，记在本机）
  // 重量：每个模块 = 基础重量 + 自身重量（kg）；底盘按承重（kg）限制总重
  WEIGHT_BASE: 250,   // 一个 2×2 模块的基础重量；小模块按面积折算
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
    name: '履带底盘', cat: 'mobility', layer: 'chassis', vis: [1, 3, 5],
    price: 150, hp: 200, power: 0, armor: 2, load: 3500, speed: 48, kg: 600, q: 2, accel: 1, brake: 1, sway: 1, spool: 1,
    susp: { pts: [13, 37], up: 4, down: 8, follow: 1 },
    desc: '承重大、耐打，但又重又慢。所有模块都要站在底盘列上。',
  },
  quad: {
    name: '四足底盘', cat: 'mobility', layer: 'chassis', vis: [1, 3, 5],
    price: 140, hp: 140, power: 0, armor: 1, load: 2400, acc: 0.06, speed: 62, kg: 400, q: 2, accel: 0.85, brake: 0.55, sway: 0.45, spool: 1.1,
    susp: { splay: 30, hips: [22, 30], up: 6, down: 12, follow: 0.85 },
    desc: '最平稳的射击平台：静止散布 -30%，边走边打也几乎不晃；但刹车最慢，停下来要滑很远。',
  },
  biped: {
    name: '双足底盘', cat: 'mobility', layer: 'chassis', vis: [1, 3, 5],
    price: 120, hp: 110, power: 0, load: 2400, evade: 0.12, speed: 78, kg: 250, q: 1, accel: 1.5, brake: 1.7, sway: 1.5, spool: 0.55,
    susp: { pts: [18, 32], up: 8, down: 3, follow: 0.85 },
    desc: '起步、刹车、跑得都最快，摇摆步态让敌人难以命中；但自己走起来晃得厉害，移动射击散布最大。',
  },
  // 驾驶舱：基础款是 1×1（id 仍叫 helmet，分享码按 id 序号编码不能改）；1×2、2×2 是「联合驾驶舱」换皮，舱里的驾驶员一律 1×1 大小。
  // drivers：驾驶员人数。全车活着的驾驶员比 1 多几个，就能多替你操作几组武器（原来副驾驶的功能）
  cockpit: {
    name: '联合驾驶舱', cat: 'control', layer: 'body', cockpit: true, drivers: 4, vis: [1, 5],
    price: 260, hp: 200, power: 1, kg: 150, q: 2,
    desc: '四个驾驶员挤在一个大舱里：除了你手操的那组武器，另外三组由他们各自瞄准开火（枪法不如你准）。全部驾驶舱被毁即告负。',
  },
  helmet: {
    name: '驾驶舱', cat: 'control', layer: 'body', w: 1, h: 1, cockpit: true, drivers: 1, vis: [1, 5],
    price: 70, hp: 90, power: 0.5, kg: 40, q: 1,
    desc: '至少需要 1 个，全部被毁即告负。只占一个小格：目标小，但很脆，记得用甲片护住。多装几个驾驶舱，每多一个驾驶员就能多替你操作一组武器。',
  },
  cockpit_pair: {
    name: '联合驾驶舱（双人）', cat: 'control', layer: 'body', w: 1, h: 2, cockpit: true, drivers: 2, art: 'helmet', placeholder: '双人',
    price: 145, hp: 125, power: 0.7, kg: 90, q: 1,
    desc: '1×2 的联合驾驶舱，容纳两名驾驶员，除手操武器外再自动操作一组；先于四人联合驾驶舱解锁。',
  },
  plate: {
    name: '甲片', cat: 'structure', layer: 'body', w: 1, h: 1,
    price: 12, hp: 45, power: 0, armor: 3, kg: 90, q: 1,
    desc: '四分之一块铁装甲，护甲同样是 3。用来补缝、垫在炮口下面、护住驾驶舱的一角。',
  },
  tank_s: {
    name: '小水罐', cat: 'cooling', layer: 'body', w: 1, h: 1,
    price: 20, hp: 28, power: 0, water: 12, cool: 1, kg: 75, q: 1,
    desc: '只占一个小格的水罐：水 12、每秒冷却 1。',
  },
  tank_tall: {
    name: '水罐', cat: 'cooling', layer: 'body', w: 1, h: 2,
    price: 38, hp: 52, power: 0, water: 25, cool: 2, kg: 150, q: 1,
    desc: '竖着的细水罐，占 1×2 小格：水 25、每秒冷却 2，塞进缝里正好。',
  },
  // 已取消：功能并入驾驶员人数。定义留着给旧存档 / 旧分享码解码，读进来一律换成联合驾驶舱（SA.RETIRED）
  copilot: {
    name: '副驾驶', cat: 'control', layer: 'body', retired: true,
    price: 140, hp: 150, power: 1, kg: 150, q: 2,
    desc: '已取消，并入联合驾驶舱。',
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
  // 火炮家族：小炮 1×1、中炮 2×1（横躺）、直射火炮 2×2、重炮 2×4、巨炮 4×4（见 docs/module-plan.md）。
  // minMt：最低材料，低于它的模块不存在（关卡里低材料的车改用 lowAlt）；vis：从哪几级材料开始换外形
  cannon: {
    name: '直射火炮', cat: 'firepower', layer: 'body', minMt: 2, lowAlt: 'cannon_m', vis: [1, 3, 5],
    price: 170, hp: 150, power: 3, kg: 350, q: 2,
    dmg: 32, reload: 2.4, heat: 6, proj: 'shell', barrel: 24, v: 840, g: 1, spread: 12, arc: 'low',
    elev: [-8, 30], slew: 24, windup: 0.35, wild: 0.12, rest: 0, aimT: 1.2,
    rcPx: 9, back: 0.05, ret: 2.2, kick: 70,   // 制退行程 px、打到底停顿、复进速度、对车身的反冲
    piv: [34, 27], blen: 40,                   // 耳轴（格内坐标）与耳轴到炮口的长度：炮管绕它转
    desc: '平射火炮，弹道低平。仰角只有 -8°~30°，太高太近的目标够不着；炮弹有散布，偶尔会打飞。同一行前方不能有己方模块。熟铁起才有。',
  },
  cannon_m: {
    name: '中炮', cat: 'firepower', layer: 'body', w: 2, h: 1, vis: [1, 3, 5],
    price: 110, hp: 100, power: 2, kg: 200, q: 1,
    dmg: 26, reload: 2.2, heat: 4.5, proj: 'shell', barrel: 18, v: 820, g: 1, spread: 13, arc: 'low',
    elev: [-8, 30], slew: 28, windup: 0.3, wild: 0.14, rest: 0, aimT: 1.1,
    rcPx: 6, back: 0.05, ret: 2.4, kick: 50,
    piv: [18, 13], blen: 34,
    desc: '横躺的 2×1 主力火炮，只占一行：前方同样不能有己方模块。比直射火炮轻、便宜，伤害低一些。',
  },
  // 新增火炮与能源模块：先用已有精灵借形，尺寸和数值接口已经按 24px 子格注册，
  // 这样战役和模拟可以先验证构筑，不必等待专用美术完成。
  cannon_s: {
    name: '小炮', cat: 'firepower', layer: 'body', w: 1, h: 1, art: 'cannon_m', placeholder: '小炮', vis: [1, 3, 5],
    price: 72, hp: 62, power: 1, kg: 80, q: 1,
    dmg: 17, reload: 1.8, heat: 3.2, proj: 'shell', barrel: 12, v: 800, g: 1, spread: 16, arc: 'low',
    elev: [-8, 30], slew: 34, windup: 0.25, wild: 0.16, rest: 0, aimT: 0.9,
    rcPx: 4, back: 0.03, ret: 2.8, kick: 26, piv: [12, 13], blen: 24,
    desc: '占一个小格的轻型火炮，便宜、耗能低，适合把早期的缝隙变成第二个射击位。',
  },
  cannon_heavy: {
    name: '重炮', cat: 'firepower', layer: 'body', w: 2, h: 4, minMt: 4, lowAlt: 'cannon', art: 'cannon', placeholder: '重炮', vis: [4, 5],
    price: 330, hp: 260, power: 6, kg: 900, q: 4,
    dmg: 58, reload: 4.6, heat: 11, proj: 'shell', barrel: 34, v: 900, g: 1, spread: 10, arc: 'low',
    elev: [-6, 34], slew: 16, windup: 0.55, wild: 0.08, rest: 0, aimT: 1.8,
    rcPx: 12, back: 0.08, ret: 1.8, kick: 110, piv: [34, 30], blen: 48,
    desc: '镀镍材料起才可制造的长身火炮。伤害高、耗能高，占四行，前方必须留出完整炮口通道。',
  },
  cannon_giant: {
    name: '巨炮', cat: 'firepower', layer: 'body', w: 4, h: 4, minMt: 6, lowAlt: 'cannon_heavy', art: 'cannon', placeholder: '巨炮', vis: [6],
    price: 760, hp: 420, power: 10, kg: 1800, q: 5,
    dmg: 104, reload: 6.8, heat: 18, proj: 'shell', barrel: 48, v: 960, g: 1, spread: 8, arc: 'low',
    elev: [-5, 36], slew: 11, windup: 0.8, wild: 0.04, rest: 0, aimT: 2.4,
    rcPx: 16, back: 0.1, ret: 1.4, kick: 180, piv: [58, 30], blen: 66,
    desc: '女王号缴获的终局火炮。它把改装台的大块空间换成一次决定性的重击，热量和动力压力都最高。',
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
  pressure_tank: {
    name: '蓄压罐', cat: 'energy', layer: 'body', w: 1, h: 2, art: 'boiler', placeholder: '蓄压',
    price: 96, hp: 72, power: 0, store: 20, explode: 20, kg: 190, q: 1,
    desc: '蓄压罐：动力富余时储存蒸汽，动力不足时每秒最多补 3 点，容量 20；存量过半被毁会爆炸。',
  },
  pressure_chamber: {
    name: '加压舱', cat: 'energy', layer: 'body', w: 1, h: 1, art: 'boiler', placeholder: '加压',
    price: 64, hp: 58, supply: 2, power: 0, heatRate: 1.1, kg: 95, q: 1,
    desc: '小格加压单元，提供 2 点动力，同时每秒增加 1.1 点产热；动力不足时优先考虑它。',
  },
  radiator: {
    name: '散热片', cat: 'cooling', layer: 'side', w: 1, h: 2, art: 'water', placeholder: '散热',
    price: 82, hp: 64, dryCool: 1.2, kg: 115, q: 1,
    desc: '镂空格栅式散热片，侧挂层开放后可挂在主体外侧；不储水，只提高持续散热。',
  },
  condenser: {
    name: '冷凝器', cat: 'cooling', layer: 'body', w: 1, h: 2, art: 'water', placeholder: '冷凝',
    price: 105, hp: 78, cool: 3, waterSave: 0.7, kg: 180, q: 1,
    desc: '冷凝器：降低全车冷却耗水（多个按乘积叠加，最低 0.4），本身不储水。',
  },
  rocket_rack: {
    name: '火箭架', cat: 'firepower', layer: 'body', art: 'cannon', placeholder: '火箭', vis: [1, 5],
    price: 230, hp: 150, power: 4, kg: 430, q: 3,
    dmg: 14, reload: 6, heat: 10, salvo: 4, salvoGap: 0.12, splash: { r: 24, k: 0.5 }, explode: 22, proj: 'shell', barrel: 22, v: 760, g: 0.65, spread: 20, arc: 'low',
    elev: [-8, 38], slew: 22, windup: 0.4, wild: 0.2, rest: 0, aimT: 1.3,
    rcPx: 7, back: 0.05, ret: 2.2, kick: 58, piv: [24, 28], blen: 34,
    desc: '四发齐射火箭架：每发 14 点伤害，命中点 24px 内溅射，装填 6 秒；装填中的火箭架被击毁会殉爆。',
  },
  harpoon: {
    name: '鱼叉', cat: 'firepower', layer: 'body', w: 2, h: 1, art: 'cannon_m', placeholder: '鱼叉', vis: [1, 5],
    price: 175, hp: 105, power: 2, kg: 210, q: 2,
    dmg: 10, reload: 2.6, heat: 4, proj: 'shell', barrel: 22, v: 720, g: 0.75, spread: 14, arc: 'low',
    elev: [-10, 28], slew: 28, windup: 0.3, wild: 0.1, rest: 0, aimT: 1.0,
    rcPx: 5, back: 0.04, ret: 2.8, kick: 42, piv: [18, 13], blen: 34, tether: 80,
    desc: '命中后以 80px/s 收绳牵引敌车，最多持续 4 秒；绳索断开前不能再次发射。',
  },
  flamer: {
    name: '喷火器', cat: 'firepower', layer: 'body', w: 2, h: 1, art: 'cannon_m', placeholder: '喷火', vis: [1, 5],
    price: 155, hp: 110, power: 2, kg: 240, q: 2,
    dmg: 4, reload: 0.1, heat: 3, heatToEnemy: 6, heatPerSec: 3, dmgPerSec: 4, range: 170, cone: 10, proj: 'flame', barrel: 18, v: 540, g: 0.1, spread: 10, arc: 'low',
    elev: [-12, 25], slew: 30, windup: 0.2, wild: 0.05, rest: 0, aimT: 0.7,
    rcPx: 3, back: 0.02, ret: 5, kick: 18, piv: [18, 13], blen: 30,
    desc: '射程 170px、±10° 锥形持续喷火：每秒给对手加热 6、对命中模块造成 4 点伤害，自身每秒产热 3。',
  },
  steamjet: {
    name: '蒸汽喷射器', cat: 'firepower', layer: 'body', w: 2, h: 1, art: 'cannon_m', placeholder: '蒸汽喷射', vis: [1, 5],
    price: 170, hp: 105, power: 2, kg: 230, q: 2,
    dmg: 3, reload: 0.1, heat: 1.5, heatToEnemy: 4, heatPerSec: 1.5, dmgPerSec: 3, range: 170, cone: 10, waterPerSec: 0.5, knock: 0.35, proj: 'steam', barrel: 18, v: 540, g: 0.1, spread: 10, arc: 'low',
    elev: [-12, 25], slew: 30, windup: 0.1, wild: 0.05, rest: 0, aimT: 0.1,
    rcPx: 3, back: 0.02, ret: 5, kick: 16, piv: [18, 13], blen: 30,
    desc: '喷出短距离蒸汽锥：射程 170px、±10°，每秒给对手加热 4 并小幅击退，模块伤害 3；自身每秒产热 1.5、耗水 0.5。',
  },
  // 三件 Boss 专属件：先以普通属性接入战斗，特殊被动由 special 字段保留给后续战斗迭代。
  boss_core: {
    name: '圣堂压力核心', cat: 'energy', layer: 'body', w: 1, h: 1, art: 'boiler', placeholder: '核心',
    price: 280, hp: 150, supply: 5, store: 8, water: 24, cool: 3, heatRate: 0, heatMul: 0.9, kg: 120, q: 2, special: 'pressure-buffer',
    desc: '铁甲圣堂的压力核心：提供稳定动力、8 点蓄压、24 点储水和 3 点冷却；蓄压按普通蓄压罐规则释放，锅炉产热 ×0.9。Boss 战利品。',
  },
  boss_lens: {
    name: '公爵测距棱镜', cat: 'control', layer: 'body', w: 1, h: 1, art: 'helmet', placeholder: '棱镜',
    price: 250, hp: 86, power: 0.5, kg: 55, q: 1, aimShrink: 0.12, aimSpeed: 0.18, special: 'range-prism',
    desc: '黄铜公爵的测距棱镜：让全车瞄准更快、更稳。Boss 战利品。',
  },
  boss_ram: {
    name: '寡妇液压撞头', cat: 'ram', layer: 'ram', w: 2, h: 1, art: 'piston', placeholder: '撞头', mount: ['track', 'quad', 'biped', 'armor', 'armor_heavy'],
    price: 245, hp: 220, armor: 3, kg: 480, q: 3, ram: 34, knock: 1.45, punch: 18, punchCd: 1.8, heat: 2, special: 'hydraulic-bite',
    desc: '煤灰寡妇改装的液压撞头：兼顾冲撞和短周期活塞打击。Boss 战利品。',
  },
  boiler: {
    name: '燃煤锅炉', cat: 'energy', layer: 'body', vis: [1, 5],
    price: 130, hp: 120, power: 0, supply: 6, q: 1, heatRate: 1.5, explode: 40, kg: 550,
    desc: '提供 6 点动力；动力用得越满，产热越多。被击毁会爆炸波及相邻模块。',
  },
  water: {
    name: '水箱', cat: 'cooling', layer: 'body',
    price: 70, hp: 100, power: 0, water: 50, q: 1, cool: 4, kg: 300,
    desc: '每秒吸收 4 热量并消耗水。水烧干后热量会迅速堆积。',
  },
  bucket: {
    name: '铲斗', cat: 'ram', layer: 'ram', vis: [1, 5], mount: ['track', 'quad', 'biped'],
    price: 110, hp: 260, power: 0, armor: 5, kg: 450, q: 2, ram: 22, knock: 1.8,
    desc: '装在底盘正前方。撞击伤害中等但极其结实，能把对手铲退很远。',
  },
  spike: {
    name: '撞角', cat: 'ram', layer: 'ram', vis: [1, 5], mount: ['armor', 'armor_heavy', 'track', 'quad', 'biped'],
    price: 130, hp: 160, power: 0, kg: 600, q: 2, ram: 40, knock: 1,
    desc: '装在装甲或底盘正前方的实心钢角，比铲斗重得多。装在底盘前能顶到对手的履带和腿；伤害随撞击速度和车重大幅提升，全速冲撞最痛。',
  },
  piston: {
    name: '蒸汽撞锤', cat: 'ram', layer: 'ram', vis: [1, 5], mount: ['armor', 'armor_heavy', 'track', 'quad', 'biped'],
    price: 170, hp: 150, power: 2, kg: 700, q: 3, ram: 16, punch: 26, punchCd: 1.5, heat: 3,
    desc: '装在装甲或底盘正前方。贴身时每 1.5 秒用蒸汽活塞猛击一次，不依赖速度。',
  },
  // 补齐计划中的换皮 / 小模块；专用精灵继续沿用 art 借形。
  mortar_s: {
    name: '小臼炮', cat: 'firepower', layer: 'body', w: 1, h: 1, art: 'mortar', placeholder: '小臼炮',
    price: 70, hp: 45, power: 1, kg: 110, q: 2, dmg: 16, reload: 2.6, heat: 3, proj: 'shell', barrel: 0, v: 720, g: 1, spread: 0, arc: 'high', indirect: true,
    elev: [32, 82], slew: 22, windup: 0.35, wild: 0, rest: 55, aimT: 1.1, rcPx: 4, back: 0.03, ret: 2.7, kick: 24, piv: [12, 13], blen: 18,
    desc: '占一个小格的间接火力；直射被挡时由 AI 自动切换。',
  },
  mg2: {
    name: '双联机枪', cat: 'firepower', layer: 'body', w: 2, h: 2, art: 'mg', placeholder: '双联机枪',
    price: 170, hp: 140, power: 3, kg: 220, q: 2, dmg: 5, reload: 0.25, heat: 1.1, proj: 'bullet', barrel: 12, v: 1230, g: 0.27, spread: 10, arc: 'low',
    elev: [-8, 32], slew: 50, windup: 0.1, wild: 0.1, rest: 0, aimT: 0.25, rcPx: 2, back: 0, ret: 14, kick: 5, piv: [34, 29], blen: 26,
    desc: '两挺机枪合并为一件模块，装填快、动力消耗高，按一组齐射。',
  },
  periscope: {
    name: '观察镜', cat: 'control', layer: 'body', w: 1, h: 1, art: 'plate', placeholder: '观察镜',
    price: 90, hp: 30, kg: 40, q: 1, aimSpeed: 0.25, aimShrink: 0.1,
    desc: '实体辅助件：全车瞄准速度 +0.25、蓄满缩圈 +0.1；被毁即失效。',
  },
  autoloader: {
    name: '装弹机', cat: 'control', layer: 'body', w: 1, h: 1, art: 'plate', placeholder: '装弹机',
    price: 110, hp: 30, kg: 60, q: 1, reloadMul: 0.85,
    desc: '实体辅助件：全车装填时间 ×0.85；被毁即失效。',
  },
  rangefinder: {
    name: '测距仪', cat: 'control', layer: 'body', w: 1, h: 1, art: 'plate', placeholder: '测距仪',
    price: 100, hp: 30, kg: 40, q: 1, spreadMul: 0.85,
    desc: '实体辅助件：直射武器散布 ×0.85；被毁即失效。',
  },
  gyroscope: {
    name: '陀螺仪', cat: 'control', layer: 'body', w: 1, h: 1, art: 'plate', placeholder: '陀螺仪',
    price: 90, hp: 30, kg: 60, q: 1, swayMul: 0.7,
    desc: '实体辅助件：全车车身晃动 ×0.7；被毁即失效。',
  },
};

SA.MODULE_ORDER = ['track', 'quad', 'biped', 'cockpit', 'boiler', 'water',
  'armor', 'armor_heavy', 'cannon', 'mortar', 'mg', 'side_cannon', 'bucket', 'spike', 'piston',
  'copilot', 'helmet', 'plate', 'tank_s', 'tank_tall', 'cannon_m',
  'cannon_s', 'cannon_heavy', 'cannon_giant', 'pressure_tank', 'pressure_chamber', 'cockpit_pair',
  'radiator', 'condenser', 'rocket_rack', 'harpoon', 'flamer',
  'boss_core', 'boss_lens', 'boss_ram', 'mortar_s', 'mg2', 'steamjet', 'periscope', 'autoloader', 'rangefinder', 'gyroscope'];   // 新模块只能追加在末尾：分享码按这里的序号编码


SA.isWeapon = (id) => !!SA.MODULES[id].dmg;
// 占格：w×h 个子格（默认 2×2）
SA.fp = (id) => { const m = SA.MODULES[id]; return { w: m.w || 2, h: m.h || 2 }; };
SA.isCockpit = (id) => !!SA.MODULES[id].cockpit;
SA.driversOf = (id) => SA.MODULES[id].drivers || 0;
// 底盘这一格两个接地点的 x（48px 格内，可以伸出格外）：ri / rn = 这格在同类底盘连续段里的序号和段长
SA.suspPts = (id, ri = 0, rn = 1) => {
  const s = SA.MODULES[id].susp;
  if (!s.splay) return s.pts;
  const d = ri < rn / 2 ? -1 : 1;
  return [s.hips[0] + d * s.splay, s.hips[1] - d * s.splay];
};
// 已取消的模块 → 替代品（旧存档、旧分享码、旧蓝图读进来时换掉）
SA.RETIRED = { copilot: 'cockpit' };
SA.liveId = (id) => SA.RETIRED[id] || id;
SA.minMt = (id) => SA.MODULES[id].minMt || 1;
// 外观阶段：vis 列出换外形的材料等级（默认只有一个造型）。例：[1, 3, 5] → 黄铜 / 熟铁 = 1，钢 / 镀镍 = 2，乌兹钢 / 以太 = 3
SA.stageOf = (id, mt = 1) => (SA.MODULES[id].vis || [1]).filter(t => t <= mt).length || 1;
// 模块重量（kg）：基础重量（按面积折算）+ 自身重量 + 改装加重
SA.weightOf = (cell) => { const f = SA.fp(cell.id); return SA.K.WEIGHT_BASE * f.w * f.h / 4 + (SA.MODULES[cell.id].kg || 0) + (cell.lv || 0) * SA.K.UP_KG; };
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
SA.newCell = (id, mt = 1) => {
  id = SA.liveId(id); mt = Math.max(mt, SA.minMt(id));
  return mt > 1 ? { id, mt, hp: SA.mod(id, mt).hp } : { id, hp: SA.MODULES[id].hp };
};
// 旧数据修正：已取消的模块换成替代品，材料不够最低要求的补到最低（耐久按比例保留）
SA.fixCell = (cell) => {
  if (!cell) return cell;
  const id = SA.liveId(cell.id), mt = Math.max(cell.mt || 1, SA.minMt(id));
  if (id === cell.id && mt === (cell.mt || 1)) return cell;
  const ratio = Math.max(0, Math.min(1, cell.hp / SA.mod(cell).hp));
  cell.id = id; if (mt > 1) cell.mt = mt;
  cell.hp = Math.round(SA.mod(cell).hp * ratio);
  if (cell.aux && !SA.isCockpit(id)) delete cell.aux;
  return cell;
};
// 库存键修正：同上
SA.fixKey = (k) => { const p = SA.parseKey(k), id = SA.liveId(p.id); return SA.invKey(id, Math.max(p.mt, SA.minMt(id))); };
// 买一个新模块：材料至少是它的最低材料，价格按那一级的总价值算
SA.buyMt = (id) => SA.minMt(id);
SA.buyPrice = (id) => SA.cellValue({ id, mt: SA.buyMt(id) });
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

// ---------- 实体辅助模块效果 ----------
// 观察镜、装弹机、陀螺仪和测距仪都是普通 1×1 模块；只统计仍有耐久的实体。
SA.auxEffect = (cells) => {
  const e = { aimSpeed: 0, aimShrink: 0, reload: 1, sway: 1, spread: 1 };
  for (const cell of cells) {
    if (!(cell.hp > 0)) continue;
    const m = SA.mod(cell);
    if (!m.reloadMul && !m.spreadMul && !m.swayMul) continue;
    e.reload *= m.reloadMul || 1;
    e.sway *= m.swayMul || 1;
    e.spread *= m.spreadMul || 1;
  }
  return e;
};
