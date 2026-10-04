// 后台「战役地图」的设计稿骨架：主线 34 关 + 支线 13 关，内容照 docs/campaign-plan.md v1.1
// （§0 章表、§6 主线、§7 支线、§9.2 关卡键对照）。改设计稿时两边一起改。
//
// now：这一关在游戏里现在的「章,关」键。关卡布局 4（2026-10-02）起游戏的章节和每章计划关数（plannedStages）就是这里的 34 关，
//      游戏里只做了序章三关和第一章前三关，其余关卡删除、等重做；地图按编号对，对上了就显示游戏里的真关名、真车、真奖励，点了能进工作台；
//      还没做进游戏的关，地图上显示设计稿的文字（虚线）。now 只留给还没按编号对齐的旧布局用。
// role：设计稿里的角色原文；★ = 擂主（一幕的单项考试），★★ = 区冠军 / 决赛，爽关 = 擂主之后的喘息。
// loot：奖励里唯一腿型的身份（SA.LEG_VARIANTS 的 key），地图用它画出那条腿、并标出它现在挂在哪份数据上。
// open（支线）：after = 主线某关之后；clear = 第几章通关以后；prev = 上一集之后。
// unlockMods 是地图预览用的明确解锁计划；已实现关卡优先读取游戏中的真实解锁。
window.SA = window.SA || {};
SA.CAMPAIGN_MAP = {
  version: '1.1',
  doc: 'docs/campaign-plan.md',
  main: { name: '女王寿辰', sub: '主线' },
  chapters: [
    {
      code: '序章', name: '铁匠铺后院', theme: '学会开车', days: '距寿辰 120 天',
      stages: [
        { code: '0-1', unlockMods: ['tank_s'], car: '破铜烂铁号', pilot: '学徒 皮普', role: '教学', pressure: 1, terrain: '平地 · 新手', test: '开车、瞄准，驾驶舱被毁就输', reward: '◆车间、小水罐', now: '0,0' },
        { code: '0-2', unlockMods: ['plate'], car: '补丁号', pilot: '铆工 小艾达', role: '普通', pressure: 2, terrain: '平地 · 龟缩', test: '甲片挡住的地方打不动 → 找它没挡住的缝', reward: '甲片', now: '0,1' },
        { code: '0-3', unlockMods: ['bucket'], car: '锈钉子号', pilot: '铁匠 老汤姆', role: '★ 结业考', pressure: 4, terrain: '平地', test: '机炮扫要害、铲斗推人 → 装甲护住要害，用铲斗贴身', reward: '◆铲斗', now: '0,2' },
      ],
      clear: '◆商店；水罐、小炮、车载机枪、竖式锅炉；改装台 5×3', unlockMods: ['tank_tall','cannon_s','mg_s','boiler_s'],
    },
    {
      code: '第一章', name: '伦敦东区', theme: '推与挡 → 抛射', days: '距寿辰 100 天',
      stages: [
        { code: '1-1', unlockMods: [], car: '铁皮罐头', pilot: '锅炉工 胖哈利', role: '开篇', pressure: 3, terrain: '货箱 · 龟缩', test: '车头糊满铁皮，机炮只冒火星 → 中炮先凿穿铁皮', reward: '◆街头赛、银行', now: '1,0' },
        { code: '1-2', unlockMods: ['periscope','autoloader'], car: '双管哨兵', pilot: '扒手 机灵杰克', role: '练习', pressure: 4, terrain: '平地 · 风筝', test: '两门机炮专扫没护甲的件 → 锅炉、驾驶舱藏进装甲，拉近打', reward: '观察镜、装弹机', now: '1,1' },
        { code: '1-3', unlockMods: ['side_cannon','armor_heavy'], car: '煤灰寡妇', pilot: '玛莎·布莱克', role: '★ 擂主', pressure: 6, terrain: '货箱', test: '重甲车头 + 高处的火炮和侧炮 + 铲斗，专克纯近战 → 把炮架高先打她顶上的炮；货箱挡平射等她推过来；机炮扫她露在外面的锅炉', reward: '◆侧挂层 + 侧炮、重装甲', now: '1,2' },
        { code: '1-4', unlockMods: ['cannon'], rewardModules: ['cannon'], enemyMaterial: 2, enemyGrid: { cols: 5, rows: 3 }, car: '大铁壶', pilot: '铸工 莫莉', role: '爽关 · 幕二开篇', pressure: 2, terrain: '平地 · 龟缩', test: '第一辆熟铁车：正面硬，顶上空着；直射炮压不低，贴到脸上就打不着你 → 侧炮打顶，或者贴脸', reward: '◆熟铁、直射火炮、改装台 5×4' },
        { code: '1-5', unlockMods: ['mortar_s','condenser'], rewardModules: ['mortar_s','condenser'], enemyMaterial: 2, enemyGrid: { cols: 5, rows: 4 }, car: '推土机', pilot: '码头工 大块头比尔', role: '练习', pressure: 4, terrain: '泥地 · 冲锋', test: '宽履带铲斗冲锋，车尾挂小臼炮 → 泥地拖住它，躲在货箱后面高抛', reward: '◆小臼炮、冷凝器' },
        { code: '1-6', unlockMods: ['biped','pressure_chamber'], rewardModules: ['biped','pressure_chamber'], enemyMaterial: 2, enemyGrid: { cols: 5, rows: 4 }, car: '独角兽', pilot: '邮差 老乔', role: '练习', pressure: 5, terrain: '平地 · 冲锋', test: '双足摇摆难打中，撞角全速冲 → 等它冲到脸上再打，它的甲很薄', reward: '◆双足、加压舱' },
        { code: '1-7', unlockMods: ['cockpit_pair','mortar'], rewardModules: ['cockpit_pair','mortar'], enemyMaterial: 3, enemyGrid: { cols: 5, rows: 4 }, car: '码头齐射', pilot: '钟表匠 老维克', role: '★★ 区冠军', pressure: 7, terrain: '泥地 · 龟缩', test: '重甲前排 + 后排两门臼炮 + 双人舱 → 小臼炮越顶对轰；双足冲进臼炮的近处盲区贴身；侧炮藏在重装甲后面磨', reward: '◆双人联合驾驶舱、高抛火炮' },
      ],
      clear: '◆四足、重机枪；钢；改装台 6×4；东区火漆印', unlockMods: ['quad','mg_heavy'],
    },
    {
      code: '第二章', name: '兰开夏纺织厂', theme: '缠斗', days: '距寿辰 75 天',
      stages: [
        { code: '2-1', unlockMods: ['spike'], car: '烟囱', pilot: '扫烟囱的汤米', role: '开篇', pressure: 4, terrain: '工厂后院 · 龟缩', test: '两层重甲堵在墙后，贴身会被蒸汽推开 → 撞角把墙顶开', reward: '◆蓝图库、撞角' },
        { code: '2-2', unlockMods: ['steamjet','radiator'], car: '走锭机', pilot: '纺织女工 贝丝', role: '练习', pressure: 5, terrain: '平地 · 游走', test: '双足快车贴脸喷蒸汽，热量涨得比掉血快 → 散热片、冷凝器管住热，打一下就走', reward: '◆蒸汽喷射器、散热片；唯一：板簧跑刃', loot: 'biped:blade' },
        { code: '2-3', unlockMods: ['harpoon'], car: '绞盘', pilot: '运河绞车工 哈罗德', role: '★ 擂主', pressure: 6, terrain: '土坡 · 风筝', test: '四足在坡后拉开距离，鱼叉把你拽进蒸汽锥 → 先打掉鱼叉；待在 760px 外用直射或高抛；车头装撞角，被拉过去正好撞', reward: '◆鱼叉、喷火器图纸' },
        { code: '2-4', unlockMods: [], car: '棉花包', pilot: '运棉车夫 奈德', role: '爽关', pressure: 3, terrain: '货箱', test: '慢吞吞的运棉车，只会远远扫机炮 → 鱼叉拉过来就撞', reward: '唯一：步行履带', loot: 'quad:pedrail' },
        { code: '2-5', unlockMods: [], car: '钢砧', pilot: '锻工 格斯', role: '进阶', pressure: 6, terrain: '平地 · 冲锋', test: '钢甲车头 + 撞角，硬顶会把自己的撞击件撞碎（反震）→ 先拆它的撞头，或者加厚自己的撞面', reward: '◆改装（炮盾 / 加厚撞面 / 附加装甲）' },
        { code: '2-6', unlockMods: ['piston','boss_lens'], car: '黄铜公爵', pilot: '沃德豪斯公爵', role: '★★ 区冠军', pressure: 8, terrain: '土坡', test: '侧炮 + 鱼叉 + 蒸汽撞锤 + 喷射器连成一套 → 先拆鱼叉；加厚撞面 + 散热片硬顶；四足 + 直射火炮在坡上对射，先拆侧炮', reward: '蒸汽撞锤；唯一：公爵测距棱镜' },
      ],
      clear: '镀镍（喷火器开卖）；改装台 6×5；工业联赛火漆印', unlockMods: ['flamer'],
    },
    {
      code: '第三章', name: '约克郡煤矿', theme: '厚甲与重炮', days: '距寿辰 50 天',
      stages: [
        { code: '3-1', unlockMods: ['cannon_heavy'], car: '矿车', pilot: '矿工头 霍布斯', role: '开篇', pressure: 4, terrain: '矿坑 · 冲锋', test: '钢甲 + 蒸汽撞锤，顶牛会被反震磨掉撞击件 → 重炮凿甲，别在泥坑里硬冲', reward: '重炮' },
        { code: '3-2', unlockMods: ['rangefinder'], car: '夜枭', pilot: '猎场看守 格雷', role: '练习', pressure: 5, terrain: '土坡 · 风筝', test: '坡后两门侧炮放冷枪，四足稳得像石头 → 测距仪稳住直射，或者翻坡贴近', reward: '测距仪' },
        { code: '3-3', unlockMods: ['rocket_rack'], car: '火柴', pilot: '爆破手 麦克', role: '★ 擂主', pressure: 7, terrain: '矿坑 · 龟缩', test: '矿渣堆后面的抛射架往你头上扔炸药 → 高抛越顶对轰；打它装填中的抛射架让它殉爆；顶着落弹冲过泥坑贴身', reward: '◆抛射架' },
        { code: '3-4', unlockMods: ['boiler_l','water_l'], car: '运煤列车', pilot: '司炉 老布朗', role: '爽关', pressure: 3, terrain: '平地', test: '三节四足首尾相连的「蜈蚣」，又长又慢 → 重炮一节一节拆', reward: '大型锅炉、大水箱' },
        { code: '3-5', unlockMods: ['pressure_tank'], car: '圣堂侍从', pilot: '见习骑士 埃德蒙', role: '进阶', pressure: 6, terrain: '土坡', test: '小号圣堂：前甲厚、顶上薄、蓄压爆发 → 高抛和抛射砸顶', reward: '◆蓄压罐；唯一：锁甲骑士腿', loot: 'biped:mail' },
        { code: '3-6', unlockMods: ['boss_core'], car: '铁甲圣堂', pilot: '圣殿骑士团', role: '★★ 区冠军', pressure: 8, terrain: '矿坑', test: '五层重甲 + 乌兹钢高抛 + 撞锤 + 压力核心 → 重炮 + 测距仪正面凿甲；抛射架砸顶上的炮；先拆撞锤再贴身，躲开反震', reward: '唯一：圣堂压力核心；乌兹钢锭 ×1' },
      ],
      clear: '◆乌兹钢；改装台 7×5；北方火漆印', unlockMods: [],
    },
    {
      code: '第四章', name: '伍尔维奇皇家兵工厂', theme: '专精与换装', days: '距寿辰 25 天',
      stages: [
        { code: '4-1', unlockMods: ['cockpit'], car: '一号样车「四人炮组」', pilot: '试车员 巴特', role: '开篇', pressure: 5, terrain: '平地', test: '四组火力各打各的 → 先端掉驾驶舱或炮组', reward: '四人联合驾驶舱' },
        { code: '4-2', unlockMods: [], car: '二号样车「铁龟」', pilot: '试车员 道格', role: '练习', pressure: 5, terrain: '货箱 · 龟缩', test: '全身厚甲，只会缩着 → 换一套攻坚蓝图', reward: '◆下注' },
        { code: '4-3', unlockMods: ['mg2'], car: '三号样车「野兔」', pilot: '试车员 菲尼亚斯', role: '★ 擂主', pressure: 7, terrain: '平地 · 风筝', test: '极快的双足，边跑边放鱼叉 → 抛射架溅射；四人舱多组火力一起追；被拉过去时用撞锤或喷火', reward: '双联机枪；改装台 7×6' },
        { code: '4-4', unlockMods: ['gyroscope'], car: '零号样车', pilot: '老技工 柯林斯', role: '爽关 + 剧情', pressure: 3, terrain: '平地', test: '三十年前的旧样车，慢、脆、锅炉巨大 → 随便打，打完听故事', reward: '陀螺仪；剧情：老汤姆的过去' },
        { code: '4-5', unlockMods: [], car: '四号样车「攻城臼炮」', pilot: '炮术官 霍克', role: '进阶', pressure: 6, terrain: '土坡', test: '巨型臼炮装填慢、脚下是盲区（女王号巨炮的预演）→ 数着装填冲进盲区', reward: '乌兹钢锭 ×1' },
        { code: '4-6', unlockMods: [], car: '差分机', pilot: '皇家工程师 惠特克', role: '★★ 区冠军', pressure: 8, terrain: '货箱', test: '打孔卡算弹道的火力网（机炮、双联机枪、火炮、四人舱）→ 高抛越过货箱；厚甲斜着顶住，重炮一发一发凿；高速贴脸，它转炮跟不上', reward: '乌兹钢锭 ×1' },
      ],
      clear: '改装台 8×6（满格）；◆以太合金工艺（要以太结晶）；伍尔维奇火漆印——请柬集齐', unlockMods: [],
    },
    {
      code: '第五章', name: '水晶宫 · 寿辰大奖赛', theme: '综合考试', days: '寿辰周',
      stages: [
        { code: '5-1', unlockMods: [], car: '草原蒸汽人', pilot: '新大陆来客「野牛」比利', role: '预选赛', pressure: 5, terrain: '平地 · 游走', test: '快 + 机炮 + 套索鱼叉（第一章 + 第二章）→ 被拉近时它自己也停着，正好打', reward: '唯一：蒸汽人', loot: 'biped:steamman' },
        { code: '5-2', unlockMods: [], car: '黑龙', pilot: '威尔士矿谷冠军 格温', role: '十六强', pressure: 6, terrain: '矿坑', test: '喷火 + 厚甲 + 抛射（第二章 + 第三章）→ 泥坑里拖住它，别给它贴身喷', reward: '唯一：黑龙', loot: 'quad:dragon' },
        { code: '5-3', unlockMods: [], car: '双足舞者', pilot: '伊莎贝拉·雷恩', role: '★ 八强', pressure: 7, terrain: '平地', test: '打不中的双足 + 撞角 + 双联机枪（第一章 + 第四章）→ 双联机枪、抛射架覆盖；四足 + 陀螺仪稳住；它冲锋的路线是直的，等它来', reward: '乌兹钢锭 ×1' },
        { code: '5-4', unlockMods: ['boss_ram'], car: '煤灰寡妇·复仇', pilot: '玛莎·布莱克', role: '★ 半决赛', pressure: 8, terrain: '工厂后院', test: '第一章的题换成乌兹钢：火炮 + 高抛 + 液压撞头 → 重炮拆她的乌兹钢炮；高抛砸顶；撞锤 + 加厚撞面硬拼她的撞头', reward: '唯一：寡妇液压撞头' },
        { code: '5-5', unlockMods: [], car: '寿辰前夜', pilot: '哈灵顿的管家 杰弗斯', role: '爽关 + 剧情', pressure: 4, terrain: '铁匠铺后院 · 夜', test: '管家开着茶点车溜进院子，想往你的锅炉里倒糖：甲薄、水少 → 拖久了它自己烧干', reward: '老汤姆连夜全修（免一次修理费）；唯一：风箱腿；决赛情报', loot: 'biped:bellows' },
        { code: '5-6', unlockMods: ['cannon_giant'], car: '维多利亚女王号', pilot: '卫冕冠军 哈灵顿爵士', role: '★★ 决赛', pressure: 10, terrain: '平地', test: '两阶段：六层堡垒 + 巨炮（脚下是盲区，4-5 教过）→ 上层掉落后它变快（5-3 的提示）→ 打主锅炉（5-5 的情报）', reward: '唯一：巨炮；以太结晶 ×1' },
      ],
      clear: '◆终局「伦敦蒸汽大奖赛」；结局', unlockMods: [],
    },
  ],
  sides: [
    {
      // 2026-10-04 用户改名「玛莎的复仇」：第一关是 2-1 第一次开打时的拦路（游戏数据 SIDE_LINES，open.ambush），第二关打完 2-3 后开放（暂定）；
      // 原宿敌·一（旧账）、宿敌·二（三百封信）搁置，见 docs/campaign-plan.md §7.1
      id: 'rival', name: '玛莎的复仇', sub: '玛莎来找茬',
      episodes: [
        { code: '玛莎·一', name: '拦路', open: { clear: 1, ambush: '2-1' }, car: '煤灰寡妇（熟铁 + 钢甲）', pilot: '玛莎', terrain: '伦敦郊区 · 平地', test: '（用户定）', reward: '缴获一件（首胜）' },
        { code: '玛莎·二', name: '（未定）', open: { after: '2-3' }, car: '（未定）', pilot: '玛莎', terrain: '（未定）', test: '（未定）', reward: '（未定）' },
        { code: '宿敌·三', name: '亡夫的掷弹兵', open: { after: '2-3' }, car: '老伯特的掷弹兵', pilot: '玛莎', terrain: '泥地', test: '臼炮连环抛射 → 冲进近处盲区', reward: '唯一：掷弹兵（四足 T3）', loot: 'quad:gren' },
        { code: '宿敌·四', name: '白手套', open: { clear: 3 }, car: '轻骑兵（半人马）', pilot: '霍雷肖·斯迈思上校', terrain: '马球场（平地）', test: '半人马全速冲锋 + 撞角 + 侧炮，重演当年那场冲锋', reward: '唯一：半人马（四足 T5）', loot: 'quad:centaur' },
        { code: '宿敌·五', name: '半个庄园', open: { clear: 4 }, car: '老煤车', pilot: '玛莎', terrain: '煤场（货箱当煤堆）', test: '支线终章：铲斗推人 + 臼炮扔煤块 + 重甲车头', reward: '乌兹钢锭 ×1', final: true },
      ],
    },
    {
      id: 'garden', name: '失落花园', sub: '温室系列的来源',
      episodes: [
        { code: '花园·一', name: '墙头的眼睛', open: { clear: 1 }, car: '门房机（高跷）', pilot: '自动机械（没人开）', terrain: '货箱（当树篱）', test: '踩着高跷从墙头往下打 → 先打断它的腿', reward: '唯一：高跷（双足 T2）', loot: 'biped:stilt' },
        { code: '花园·二', name: '移动温室', open: { clear: 2 }, car: '修枝机（曲柄步行机，温室车体）', pilot: '自动机械（没人开）', terrain: '土坡', test: '高膝跨过土坡，剪刀够得着你的顶 → 在坡下打它的腿', reward: '◆温室档开放（四足：曲柄步行机；双足：蒸汽圣骑）' },
        { code: '花园·三', name: '虫屋', open: { after: '3-3' }, car: '捕虫机（螳臂步行机）', pilot: '自动机械（没人开）', terrain: '泥地（温室湿地）', test: '螳臂夹住就不放 → 别贴身，远处拆', reward: '唯一：螳臂步行机（四足 T4）', loot: 'quad:mantis' },
        { code: '花园·四', name: '绘图室', open: { clear: 3 }, car: '植物绘图机（缩放仪平行腿）', pilot: '自动机械（没人开）', terrain: '平地', test: '画得准就打得准，远距离几乎不失手 → 用掩体，贴近', reward: '唯一：缩放仪平行腿（双足 T4）', loot: 'biped:panto' },
        { code: '花园·五', name: '玻璃圣堂', open: { after: '4-3' }, car: '守堂的蒸汽圣骑（温室车体 + 风筝盾）', pilot: '自动机械（没人开）', terrain: '货箱', test: '风筝盾挡平射 → 高抛越过盾牌', reward: '唯一：蒸汽圣骑（四足 T4）', loot: 'quad:knight' },
        { code: '花园·六', name: '晶枝', open: { clear: 4 }, car: '园丁长（晶枝腿）', pilot: '园丁长', terrain: '平地', test: '支线终章；决赛前的最后一块拼图', reward: '唯一：晶枝腿（双足 T6）；以太结晶 ×1', loot: 'biped:crystal', final: true },
      ],
    },
    {
      id: 'deep', name: '深海来客', sub: '很短，奖励一个底盘',
      episodes: [
        { code: '深海·一', name: '雾中脚印', open: { clear: 3 }, car: '深海步行钟', pilot: '潜水员 老雅各布', terrain: '泥地（落潮的河滩）', test: '壳硬、腿稳，打不过就退回河里 → 打它露在外面的锅炉', reward: '乌兹钢锭 ×1（沉船里捞的东印度公司货）' },
        { code: '深海·二', name: '潜水钟', open: { prev: true }, car: '深海步行钟（全力以赴）', pilot: '潜水员 老雅各布', terrain: '货箱（沉没码头的残骸）', test: '支线小 Boss', reward: '唯一：锚链铁甲 / 鹦鹉螺车体（四足 T5）', loot: 'quad:anchor', final: true },
      ],
    },
  ],
};
