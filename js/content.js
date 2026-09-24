// 内容数据：赛事对手、订单、云车库预置载具
window.SA = window.SA || {};

SA.STARTER = ['........', '........', '........', '...KC...', '...OWA..', '...TTT..'];

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
    id: 'mine', who: '北方矿业公司', reward: 320, rep: 2,
    text: '矿道常常塌方，要结实的履带车。',
    req: [['履带底盘', s => s.byId.track || 0, 4], ['重装甲', s => s.byId.armor_heavy || 0, 2]],
  },
  {
    id: 'circus', who: '马戏团团长 巴纳比', reward: 240, rep: 2,
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
