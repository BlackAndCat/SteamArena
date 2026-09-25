// 内容数据：赛事对手、订单、云车库预置载具
window.SA = window.SA || {};

// 开局的车：大格 ASCII + 子格小模块 [r, c, id]（子格坐标）。1×1 驾驶舱顶上垫一块甲片，前面是横躺的 2×1 中炮
SA.STARTER = {
  rows: ['........', '........', '........', '........', '...OWA..', '...TTT..'],
  subs: [[7, 7, 'helmet'], [6, 7, 'plate'], [7, 8, 'cannon_m']],
};

SA.OPPONENTS = [
  {
    name: '锈钉子号', pilot: '铁匠 老汤姆', prize: 150, aim: 0.65,
    blurb: '拿铁匠铺的边角料拼出来的，但老汤姆的机枪从不卡壳。',
    rows: ['........', '........', '........', '...KM...', '...OWA..', '...TTT..'], sides: [],
  },
  {
    name: '煤灰寡妇', pilot: '玛莎·布莱克', prize: 220, aim: 0.78,
    blurb: '四足稳定平台，火炮很准；车头的铲斗能把你推出场外。',
    rows: ['........', '........', '...K....', '...OC...', '..WOAA..', '..QQQQU.'], sides: [],
  },
  {
    name: '黄铜公爵', pilot: '沃德豪斯公爵', prize: 300, aim: 0.9,
    blurb: '第一台在侧挂层架侧炮的参赛车，藏在装甲后面放冷枪。',
    rows: ['........', '........', '....K...', '...OAM..', '..WOAAC.', '..TTTTT.'], sides: [[3, 4]],
  },
  {
    name: '双足舞者', pilot: '伊莎贝拉·雷恩', prize: 400, aim: 0.9,
    blurb: '摇摇晃晃的双足底盘极难命中，还会顶着撞角全速冲过来。',
    rows: ['........', '....C...', '...KM...', '..OWAAX.', '..WOAM..', '..BBBB..'], sides: [],
  },
  {
    name: '铁甲圣堂', pilot: '圣殿骑士团', prize: 550, aim: 0.95,
    blurb: '重装甲堆到了第五层，顶上架着高抛火炮，车头还有蒸汽撞锤。',
    rows: ['........', '....KP..', '..WOHHY.', '..WOHHC.', '.WOOHAM.', '.TTTTTT.'], sides: [[3, 4], [2, 4]],
  },
  {
    name: '维多利亚女王号', pilot: '卫冕冠军 哈灵顿爵士', prize: 800, aim: 1.0,
    blurb: '六层高的移动堡垒：五座锅炉、三门侧炮、顶层高抛炮，履带前还焊着铲斗。',
    rows: ['.....K..', '....OHP.', '..WOHHM.', '.WWOHKC.', 'WWOOHAM.', 'TTTTTTTU'], sides: [[2, 4], [3, 4], [4, 4]],
  },
];

// ---------- 地形 ----------
// 坐标是竞技场世界像素（宽 1280，地面 y = 648）。开局两车车头大约在 x = 440 和 x = 840，地形都摆在中间这一段。
// hills：土坡（余弦鼓包，x 中心、w 宽、h 高）—— 挡低平的直射炮弹，上坡慢、下坡快，车跟着地面抬高
// mud：泥地区间 [x0, x1] —— 按底盘减速（履带 0.8、四足 0.65、双足 0.45）
// crates：木货箱（x 中心、w 宽、h 高、hp）—— 能挡一两发炮弹；车一顶上去就碾碎（车越重越快），碾的时候被拖慢，碎木堆也减速
SA.TERRAINS = {
  flat: { name: '平地', desc: '平整的煤渣地，没有遮挡，拼的是火力和装甲。' },
  crates: { name: '货箱', crates: [{ x: 600, w: 48, h: 72, hp: 60 }, { x: 690, w: 48, h: 48, hp: 40 }],
    desc: '场地中间堆着几只木货箱：能替你挡一两发炮弹；车顶上去一碾就碎，只是会被拖慢一下，碎木堆也让车慢一点。' },
  mud: { name: '泥地', mud: [[430, 850]],
    desc: '中间一大片烂泥：履带速度 ×0.8、四足 ×0.65、双足 ×0.45。冲撞车在泥里跑不起来。' },
  hills: { name: '土坡', hills: [{ x: 640, w: 320, h: 44 }],
    desc: '中间隆起一道土坡：低平的直射炮弹会打在坡上；爬坡变慢、下坡变快，翻过去的车会被抬高。' },
  yard: { name: '工厂后院', hills: [{ x: 510, w: 200, h: 26 }, { x: 790, w: 200, h: 26 }], crates: [{ x: 650, w: 48, h: 96, hp: 80 }],
    desc: '两道小坡夹着一摞高货箱：挡掉几发低平的炮弹，碾过去要多花一点时间。' },
  mine: { name: '矿坑', hills: [{ x: 640, w: 360, h: 56 }], mud: [[330, 470], [810, 950]],
    desc: '中间一座矿渣堆，两边是泥坑：出发就陷在泥里，翻过渣堆才能贴身。' },
};
SA.TERRAIN_ORDER = ['flat', 'crates', 'mud', 'hills', 'yard', 'mine'];

// ---------- 战役：从后巷一路打进水晶宫 ----------
// 每一章 = 一组「考题」对手 + 通关解锁（新模块 / 材料 / 功能 / 更大的改装台）。每一关 = 一道构筑考题：
// blurb 写明它的问题和弱点，玩家赛前侦察后去车间调整。mt：整车材料；elite：个别格子的材料（Boss 的史诗件，可以缴获）。
// style：AI 性格 —— rush 冲锋（有撞击件就一直冲）、kite 拉开距离放风筝、turtle 守在原地、不写 = 在交战距离内游走。
// terrain：场地（SA.TERRAINS 的键），不写 = 平地。
// unlock：{ feat: [功能], mods: [模块], mat: 最高可升级的材料, grid: { cols, rows } 改装台大小, ingots: { 锭: 数量 } }
// subs：用子格坐标放置 1×1 / 1×2 / Boss 大件，坐标仍是 24px 最小格；无专用美术的模块由通用占位显示。
// 开局已有：履带 / 驾驶舱 / 锅炉 / 水箱 / 铁装甲 / 直射火炮 / 机枪，黄铜材料，4×3 改装台
SA.CAMP_START = { feat: [], mods: ['track', 'helmet', 'plate', 'boiler', 'water', 'armor', 'cannon_m', 'mg'], mat: 1, grid: { cols: 4, rows: 3 } };
SA.FEATURES = {
  garage: '车间', shop: '商店', street: '街头赛', bank: '银行贷款', side: '侧挂层', upgrade: '改装（炮盾 / 附加装甲）',
  orders: '民间委托', bet: '下注', blueprints: '蓝图库', friendly: '友谊赛 · 云车库', season: '终局 · 伦敦蒸汽大奖赛',
};
SA.CAMPAIGN = [
  {
    name: '序章 · 铁匠铺后院', place: '铁匠铺后院',
    blurb: '老汤姆答应教你开蒸汽战车。先在后院的煤渣地上试试手：A/D 开车，按住左键瞄准开火。',
    stages: [
      {
        name: '破铜烂铁号', pilot: '学徒 小皮普', prize: 60, aim: 0.35, style: 'turtle',
        blurb: '铁匠铺学徒拿废料拼的练习车，只有一挺机枪，枪法也很烂。放心开火。',
        rows: ['........', '........', '........', '...K....', '...OM...', '...TT...'],
        unlock: { feat: ['garage'], note: '车间开放：库存里有一挺机枪和两块铁装甲，试着换上去。' },
      },
      {
        name: '锈钉子号', pilot: '铁匠 老汤姆', prize: 120, aim: 0.6,
        blurb: '老汤姆的机枪从不卡壳，专扫你没有装甲的锅炉和驾驶舱。用装甲把它们挡在后面。',
        rows: ['........', '........', '........', '...KM...', '...OWA..', '...TTT..'],
      },
    ],
    unlock: { feat: ['shop'], mods: ['plate', 'tank_s', 'tank_tall', 'cannon_s'], grid: { cols: 5, rows: 3 },
      note: '商店开张：没库存的模块直接放上车就是购买。每个大格可以拆成 2×2 小格：甲片、小水罐、水罐这些小模块用来补缝。' },
  },
  {
    name: '第一章 · 后巷', place: '白教堂后巷',
    blurb: '后巷里的地下赛车圈。在这里站稳脚跟，才会有人给你递锦标赛的请柬。',
    stages: [
      {
        name: '铁皮罐头', pilot: '锅炉工 胖哈利', prize: 130, terrain: 'crates', aim: 0.55, style: 'turtle',
        blurb: '车头糊满了铁皮，机枪打上去只冒火星（装甲每发减伤）。用直射火炮把铁皮凿穿，再打它的火炮。',
        rows: ['........', '........', '...K....', '..OWL...', '..OWAA..', '..TTTT..'],
        unlock: { feat: ['street', 'bank'], note: '街头赛和银行开放：先用短赛补足改装预算，再决定把钱投到武器还是冷却。' },
      },
      {
        name: '双管哨兵', pilot: '扒手 机灵杰克', prize: 150, aim: 0.65, style: 'kite',
        blurb: '上下两挺机枪一起扫，跑得还快，专挑没护甲的模块。把锅炉、驾驶舱藏到装甲后面，拉近了打。',
        rows: ['........', '........', '...M....', '..KAM...', '..OWA...', '..TTT...'], subs: [[4, 10, 'periscope'], [4, 12, 'autoloader']],
        unlock: { mods: ['periscope', 'autoloader'], note: '观察镜和装弹机开放：装到车上即可改善瞄准和装填，被击毁后效果消失。' },
      },
      {
        name: '煤灰寡妇', pilot: '玛莎·布莱克', prize: 220, terrain: 'crates', aim: 0.75, boss: true,
        blurb: '【宿敌】玛莎的四足炮台又稳又准，火炮是熟铁打的；车头的铲斗会把你铲出去。她说后巷只容得下一个人。',
        rows: ['........', '........', '...KZ...', '...OL...', '..WOAA..', '..QQQQU.'], elite: [[3, 4, 2]],
      },
    ],
    unlock: { mods: ['armor_heavy', 'quad', 'cannon'], mat: 2, grid: { cols: 5, rows: 4 },
      note: '熟铁材料开放：选中车上的模块就能升级材料，所有属性 ×1.2。观察镜和装弹机是可击毁的实体模块。街头赛可以刷钱，银行可以贷款。' },
  },
  {
    name: '第二章 · 码头区', place: '泰晤士河码头',
    blurb: '码头工人爱玩撞车。这里的车都焊着铲斗和撞角，谁先被顶翻谁输。',
    stages: [
      {
        name: '推土机', pilot: '码头工 大块头比尔', prize: 180, terrain: 'mud', aim: 0.6, style: 'rush', mt: 2,
        blurb: '宽履带加车头铲斗，一门心思往前推。车头挂重装甲顶住它，或者趁它冲过来的路上多打几炮。',
        rows: ['........', '........', '........', '...KM...', '..WOAA..', '..TTTTU.'], subs: [[4, 10, 'mortar_s']],
        unlock: { feat: ['blueprints'], mods: ['condenser'], note: '冷凝器和蓝图库开放：保存一套冷却蓝图，开始把热量当成构筑预算管理。' },
      },
      {
        name: '独角兽', pilot: '邮差 老乔', prize: 200, aim: 0.65, style: 'rush', mt: 2,
        blurb: '双足轻骑，装甲前焊着撞角全速冲锋，身子晃得很难打中。等它冲到脸上再开火，它的装甲很薄。',
        rows: ['........', '........', '........', '...KM...', '...OAX..', '...BBB..'],
        unlock: { mods: ['pressure_chamber'], note: '加压舱开放：每个小格换来一点动力，但会把热量压力推高。' },
      },
      {
        name: '双足舞者', pilot: '伊莎贝拉·雷恩', prize: 300, terrain: 'mud', aim: 0.85, style: 'rush', boss: true, mt: 2,
        blurb: '码头的女王。摇摇晃晃的双足底盘极难命中，撞角是钢打的；你的车头最好够厚。',
        rows: ['........', '....C...', '...KM...', '..OWAAX.', '..WOAM..', '..BBBB..'], elite: [[3, 6, 3]],
      },
    ],
    unlock: { mods: ['bucket', 'spike', 'biped', 'mortar_s'], mat: 3, grid: { cols: 6, rows: 4 },
      note: '钢材料开放（×1.45）。撞击件和双足到手：现在轮到你去撞别人了。' },
  },
  {
    name: '第三章 · 工厂区', place: '兰开夏纺织厂',
    blurb: '烟囱林立的工厂区。这里的车都躲在厚墙后面放炮，站着对射你永远打不过它们。',
    stages: [
      {
        name: '烟囱', pilot: '扫烟囱的汤米', prize: 260, terrain: 'yard', aim: 0.7, style: 'turtle', mt: 2,
        blurb: '车头两层重装甲，高抛炮从墙后面往你头上砸。直射打不穿？开着撞角冲上去，把墙顶开。',
        rows: ['........', '........', '...P....', '..KOH...', '..WOHH..', '..TTTT..'], subs: [[4, 10, 'flamer'], [4, 12, 'steamjet']],
        unlock: { mods: ['flamer', 'steamjet'], note: '喷火器和蒸汽喷射器开放：贴身后持续升温，蒸汽喷射还能把对手推开。' },
      },
      {
        name: '齐射', pilot: '钟表匠 老维克', prize: 300, terrain: 'hills', aim: 0.75, style: 'kite', mt: 3,
        blurb: '四足炮台，直射加高抛一起打，还会往后退拉开距离。用双足追上去，别给它从容瞄准的时间。',
        rows: ['........', '........', '..P.....', '..KAC...', '..OWAA..', '..QQQQ..'], subs: [[0, 14, 'condenser'], [0, 12, 'radiator'], [4, 10, 'rangefinder'], [4, 12, 'gyroscope']],
        unlock: { mods: ['cockpit_pair', 'gyroscope', 'rangefinder'], note: '双人联合驾驶舱、陀螺仪和测距仪开放：多一组自动火力，同时降低移动射击的代价。' },
      },
      {
        name: '黄铜公爵', pilot: '沃德豪斯公爵', prize: 400, terrain: 'hills', aim: 0.85, boss: true, mt: 3,
        blurb: '公爵在侧挂层架了镀镍侧炮，藏在装甲后面放冷枪。侧炮不怕装甲挡，却也只有它自己那点耐久——瞄准洋红色的侧炮。',
        rows: ['........', '........', '....K...', '...OAZ..', '..WOAAC.', '..TTTTT.'], sides: [[3, 4]], elite: [[3, 4, 4, 'side']], subs: [[4, 14, 'boss_lens']],
      },
    ],
    unlock: { feat: ['side', 'upgrade'], mods: ['mortar', 'side_cannon', 'piston', 'radiator'], mat: 4, grid: { cols: 6, rows: 5 },
      note: '镀镍材料开放（×1.75）。高抛火炮、侧炮、蒸汽撞锤到手；侧挂层和改装（炮盾 / 附加装甲）开放。' },
  },
  {
    name: '第四章 · 北方矿区', place: '约克郡煤矿',
    blurb: '矿业公司的铁疙瘩又厚又重。要么从头顶砸，要么撞穿它。',
    stages: [
      {
        name: '矿车', pilot: '矿工头 霍布斯', prize: 380, terrain: 'mine', aim: 0.75, style: 'rush', mt: 3,
        blurb: '重装甲履带车，车头装着蒸汽撞锤，贴上来就一下一下猛砸。别跟它顶牛，高抛炮越过装甲砸它的锅炉。',
        rows: ['........', '........', '....K...', '..WOHHY.', '..WOOAC.', '..TTTTT.'], subs: [[6, 14, 'harpoon']],
        unlock: { mods: ['harpoon'], note: '鱼叉开放：下一场就是风筝车，先用牵引炮把距离问题变成命中问题。' },
      },
      {
        name: '夜枭', pilot: '猎场看守 格雷', prize: 420, terrain: 'hills', aim: 0.85, style: 'kite', mt: 3,
        blurb: '两门侧炮躲在装甲后面，四足平台稳得像块石头，一直往后退。冲上去撞它，或者先敲掉侧炮。',
        rows: ['........', '........', '...K....', '..OAM...', '..WOAC..', '..QQQQU.'], sides: [[3, 3], [4, 3]], subs: [[0, 14, 'harpoon']],
        unlock: { mods: ['rocket_rack'], note: '火箭架开放：散布换来中距离压制，逼风筝车离开安全距离。' },
      },
      {
        name: '铁甲圣堂', pilot: '圣殿骑士团', prize: 550, terrain: 'mine', aim: 0.88, boss: true, mt: 4,
        blurb: '重装甲堆到第五层，顶上是一门乌兹钢高抛炮，车头还有蒸汽撞锤。赢了能缴获那门史诗火炮。',
        rows: ['........', '....KP..', '..WOHHY.', '..WOHIC.', '.WOOHAM.', '.TTTTTT.'], sides: [[3, 4], [2, 4]], elite: [[1, 5, 5]], subs: [[0, 14, 'rocket_rack'], [8, 14, 'boss_core']],
        drop: { wootz: 1 },
      },
    ],
    unlock: { feat: ['orders', 'bet', 'blueprints', 'friendly'], mods: ['cockpit', 'pressure_tank', 'cannon_heavy'], grid: { cols: 7, rows: 5 },
      note: '联合驾驶舱到手：四个驾驶员挤在一个舱里，替你操作另外三组武器。委托、下注、蓝图库、友谊赛开放：有些委托会付乌兹钢锭。' },
  },
  {
    name: '第五章 · 水晶宫', place: '海德公园 · 水晶宫',
    blurb: '帝国蒸汽大奖赛。全英国最好的战车都在这里，卫冕冠军的女王号在决赛等你。',
    stages: [
      {
        name: '差分机', pilot: '皇家工程师 惠特克', prize: 500, terrain: 'crates', aim: 0.9, mt: 4,
        blurb: '三挺机枪加一门火炮，火力网密不透风，但全是镀镍的轻家伙。重装甲顶上去，机枪就只能冒火星。',
        rows: ['........', '........', '....M...', '...KAM..', '..WOOAM.', '..BBBBB.'], subs: [[2, 10, 'mg2']],
        unlock: { mods: ['mg2'], note: '双联机枪开放：一件模块提供高射速火力网。' },
      },
      {
        name: '煤灰寡妇 · 复仇', pilot: '玛莎·布莱克', prize: 600, terrain: 'yard', aim: 0.9, boss: true, mt: 4,
        blurb: '【宿敌】玛莎把她的四足换成了乌兹钢火炮，顶上加了高抛炮。这次她是认真的。',
        rows: ['........', '........', '...PK...', '..WOAC..', '..WOAAC.', '..QQQQU.'], elite: [[4, 6, 5], [3, 5, 5]],
        subs: [[6, 14, 'boss_ram']],
      },
      {
        name: '维多利亚女王号', pilot: '卫冕冠军 哈灵顿爵士', prize: 1000, aim: 0.98, boss: true, mt: 3,
        blurb: '六层高的移动堡垒：多座锅炉、一门侧炮、顶层高抛炮和巨炮，驾驶舱是乌兹钢。打赢它，你就是帝国冠军。',
        rows: ['.....K..', '....OHP.', '..WOHHM.', '.WWOHKC.', 'WWOOHAM.', 'TTTTTTTU'], sides: [[3, 4]],
        subs: [[0, 0, 'cannon_giant'], [0, 14, 'pressure_tank']],
        elite: [[0, 5, 6], [1, 6, 5], [3, 6, 5]], drop: { aether: 1 },
      },
    ],
    unlock: { feat: ['season'], mods: ['cannon_giant'], mat: 6, grid: { cols: 8, rows: 6 }, ingots: { wootz: 1 },
      note: '你是帝国冠军了！改装台扩到 8×6。终局「伦敦蒸汽大奖赛」开放：每个赛季对手更强，夺冠奖励以太结晶。' },
  },
];

// 民间订单：满足条件即可授权图纸拿钱，载具保留
SA.ORDERS = [
  {
    id: 'farmer', who: '农场主 哈格里夫斯', reward: 180, rep: 0,
    text: '泥地里犁田要四条腿，还得带足水，免得半路烧干。',
    req: [['四足底盘', s => s.byId.quad || 0, 2], ['水箱', s => s.byId.water || 0, 2]],
  },
  {
    id: 'post', who: '皇家邮政局', reward: 150, rep: 0,
    text: '送信用的双足机，要轻：总动力消耗不超过 6。',
    req: [['双足底盘', s => s.byId.biped || 0, 2], ['动力消耗 ≤ 6', s => (s.demand <= 6 ? 1 : 0), 1]],
  },
  {
    id: 'mill', who: '纺织厂主 布伦特伍德', reward: 260, rep: 1,
    text: '工厂需要一台强劲的蒸汽原动机，动力供给要足。',
    req: [['动力供给', s => s.supply, 18]],
  },
  {
    id: 'fire', who: '伦敦消防队', reward: 220, rep: 1,
    text: '救火车要扛得住热：3 只水箱，全力运转 90 秒不烧干。',
    req: [['水箱', s => s.byId.water || 0, 3], ['烧干时间 ≥ 90 秒', s => (s.overheat >= 90 ? 1 : 0), 1]],
  },
  {
    id: 'mine', who: '北方矿业公司', reward: 320, rep: 2, ingots: { wootz: 1 },
    text: '矿道常常塌方，要结实的履带车。',
    req: [['履带底盘', s => s.byId.track || 0, 4], ['重装甲', s => s.byId.armor_heavy || 0, 2]],
  },
  {
    id: 'circus', who: '马戏团团长 巴纳比', reward: 240, rep: 2, ingots: { wootz: 1 },
    text: '要一台看着就吓人的大家伙：叠满六层！',
    req: [['载具高度', s => s.height, 6]],
  },
];

// 云车库预置（模拟其他玩家上传）
SA.CLOUD_PRESETS = [
  { author: '齿轮先生', name: '咆哮的茶壶', rows: ['........', '........', '...K....', '..OAM...', '..WOAC..', '..QQQQU.'], sides: [[3, 3]] },
  { author: 'Ada_Loveplate', name: '差分机', rows: ['........', '........', '....M...', '...KAM..', '..WOOAM.', '..BBBBB.'], sides: [] },
  { author: '伦敦雾', name: '夜行者', rows: ['........', '........', '..OK....', '..WAA...', '..OOHH..', '..TTTT..'], sides: [[3, 3], [3, 4], [4, 4], [4, 5]] },
];

// 官方蓝图：基础构型，不能删除
SA.OFFICIAL_BLUEPRINTS = [
  { name: '履带 · 基础炮车', desc: '起步用的稳妥构型：一门直射火炮，装甲护住锅炉。', rows: ['........', '........', '........', '...KC...', '...OWA..', '...TTT..'] },
  { name: '履带 · 铲斗推土机', desc: '宽履带加车头铲斗，机枪压制，靠冲撞把对手推出去。', rows: ['........', '........', '........', '...KM...', '..WOAA..', '..TTTTU.'] },
  { name: '四足 · 稳定炮台', desc: '四足平台散布小，直射炮平推，顶上高抛炮砸顶。', rows: ['........', '........', '...P....', '..WKC...', '..OOA...', '..QQQ...'] },
  { name: '双足 · 轻骑兵', desc: '跑得快、难命中，装甲前焊着撞角，适合贴脸冲锋。', rows: ['........', '........', '........', '...KM...', '...OAX..', '...BBB..'] },
];

// 街头赛：不算锦标赛，对手是随手拼出来的小角色；每档有评分上限
SA.STREET_TIERS = [
  { name: '后巷赛', cap: 200 },
  { name: '集市赛', cap: 300 },
  { name: '码头赛', cap: 450 },
];
SA.STREET_PILOTS = [
  ['报童 小杰克', '号外号外'], ['扫烟囱的汤米', '烟囱刷'], ['卖花女 莉莉', '紫罗兰'], ['码头工 大块头比尔', '缆桩'],
  ['钟表匠学徒 奥利', '发条'], ['面包师 胖墩', '烤炉'], ['邮差 老乔', '急件'], ['擦鞋匠 小山姆', '鞋油罐'],
  ['磨刀匠 老维克', '砂轮'], ['送奶工 玛吉', '奶桶'], ['车夫 霍布斯', '老马'], ['修伞匠 皮普', '黑伞'],
];
