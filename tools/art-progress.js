// 模块美术进度表（Opus 维护）：新模块造型候选页（tools/module-candidates.html）的「进度总览」和标签按这里画；
// 同一份内容的文字版是 docs/art-plan.md（给之后的代理看的计划表）——改一边就同步改另一边。
// status：done = 已进游戏（按 docs/visual-rules.md 的新规范）；wip = 基础造型已进游戏、还有分支没做完；
//         cand = 候选已出、等用户选；todo = 还没开始；legacy = 已有美术（新规范之前画的，待按新规范复核）；
//         plan = 计划中的新模块（游戏里还没有，等 astra 加数据和功能）
// pri：优先级序号（1 最先做）；已完成的没有 pri。ch：玩家第一次拿到它的章节（0 = 开局 / 序章；null = 未定）
// plan 模块在 SA.MODULES 里还没有，所以自带 name / size / cat；id 是暂定的，以 astra 落地的为准
// hist：探索历史（从旧到新）：[日期, 版本 / 内容, 样机页, 样机状态]
// lab：候选画在哪个样机脚本里（SA[lab].CANDS，候选页直接读来显示）；pick：用户已选的候选 key
window.SA = window.SA || {};

SA.ARTPLAN = {
  STATUS: {
    done: { name: '已进游戏', color: '#46c2c9' },
    wip: { name: '探索中', color: '#ef7a21' },
    cand: { name: '候选待选', color: '#d9a441' },
    plan: { name: '计划中（等后台）', color: '#b18be0' },
    todo: { name: '未开始', color: '#c9564b' },
    legacy: { name: '旧画待复核', color: '#a8a39a' },
  },
  CH: ['开局 / 序章', '第一章', '第二章', '第三章', '第四章', '第五章'],
  // 档位：pri 落在哪个区间就属于哪一档（页面和文档按它分组）
  TIERS: [
    { name: '第 1 档 · 底盘细分支', to: 2, desc: '每台车都有底盘，出镜最多：材质六档 + T3 / T5 形态分支' },
    { name: '第 2 档 · 前两章的文字占位', to: 8, desc: '玩家前两章就会看到的文字方块' },
    { name: '第 3 档 · 新增尺寸：机枪系列、锅炉、水箱', to: 13, desc: '数据和功能已接入，游戏里使用文字占位；专用造型按这里的顺序画' },
    { name: '第 4 档 · 第三章特殊武器', to: 16, desc: '还要配特效（绳索、火焰、白汽）' },
    { name: '第 5 档 · 第四章及以后', to: 22, desc: '中后期模块' },
    { name: '第 6 档 · 唯一件', to: 25, desc: '每个存档只拿到一次' },
    { name: '第 7 档 · 旧画按新规范复核', to: 99, desc: '已经能看，只是早于 docs/visual-rules.md，没和火炮家族统一；最不急' },
  ],
  MODS: {
    // ---------- 已完成：火炮家族（按 visual-rules 六档 / 分级重做）----------
    cannon: { status: 'done', ch: 1, note: '六档：方 → 方平顶 → 斜板炮廓，散热口逐档变，零件库',
      hist: [['2026-09-27', '高阶造型 v3', 'cannon-lab.html', 'shipped'], ['2026-09-27', '六档进游戏', 'gun-family-lab.html', 'shipped']] },
    cannon_m: { status: 'done', ch: 0, note: '敞开炮架 → 方平顶炮廓 → 斜板炮廓，炮管加长',
      hist: [['2026-09-27', '中炮六档', 'gun-family-lab.html', 'shipped']] },
    cannon_s: { status: 'done', ch: 0, note: '卡隆短炮，1×1 只靠剪影：铸造瓶身 → 方套箱 → 斜肩套箱',
      hist: [['2026-09-26', '五个方向 × 材质语法', 'cannon-s-lab.html', 'archived'], ['2026-09-27', '卡隆短炮 v2', 'cannon-s-lab.html', 'archived'], ['2026-09-27', '小炮六档进游戏', 'gun-family-lab.html', 'shipped']] },
    side_cannon: { status: 'done', ch: 1, note: '挂板 + 暗铁吊臂 + 长炮，只画骨架',
      hist: [['2026-09-27', '侧炮 v1', 'gun-family-lab.html', 'shipped']] },
    cannon_heavy: { status: 'done', ch: 4, note: '历史套箍重炮 + 预制齿轮组（镀镍起）',
      hist: [['2026-09-27', '夜间候选 v1', 'module-candidates.html#cannon_heavy', 'archived'], ['2026-09-27', '重炮 v1～v5', 'gun-family-lab.html', 'shipped']] },
    mortar: { status: 'done', ch: 2, note: '短粗炮管 + 两侧活动大齿轮 + 连杆',
      hist: [['2026-09-27', '臼炮 v1 + 齿轮 v6', 'gun-family-lab.html', 'shipped']] },
    cannon_giant: { status: 'done', ch: 5, note: '攻城臼炮阵地：象牙白炮口箍、弹簧底座、龙门吊、燃煤仓、操作员。高抛机制已接入，射界 55°～85°、静止 75°',
      hist: [['2026-09-27', '夜间候选 v1', 'module-candidates.html#cannon_giant', 'archived'], ['2026-09-27', '巨炮 v1～v5', 'gun-family-lab.html', 'archived'], ['2026-09-28', '巨炮 v6 进游戏', 'gun-family-lab.html', 'shipped']] },
    track: { status: 'done', ch: 0, note: '六档（2026-09-29 进游戏）：T1 博伊德尔铰接脚板轮（无履带）→ T2 木板链带 → T3 霍尔特铁链节 → T4 Mark IV 减重孔钢框 → T5 桁架转向架 → T6 全包裙板；档位 = 材料',
      hist: [['2026-09-26', '履带三阶段', 'spritesheet.html', 'live']] },

    // ---------- 第 1 档：底盘细分支 ----------
    quad: { status: 'done', ch: 1, note: '六档（2026-09-29 进游戏）：T1 工装 Mk.II → T2 桁架爬机 → T3 板簧拖车 → T4 曲柄步行机（温室 + 常春藤高膝）→ T5 汽锤步行机 → T6 哥特教堂（燕尾旗）；9 种唯一变体已注册、等获得方式；步幅随车速加大、机身按步态起伏',
      hist: [['2026-09-25', '机甲套件 v3', 'mech-kit.html', 'archived'], ['2026-09-25', '整件底盘 v4', 'chassis-lab.html', 'shipped'], ['2026-09-29', '四足六档 + 变体 v1～v9（定稿进游戏）', 'archive/quad-tiers.html', 'shipped']] },
    biped: { status: 'done', ch: 2, note: '六档（2026-09-29 进游戏）：工装 Mk.II → 鹭步 → 掷弹兵 → 蒸汽圣骑 → 钟表巨像 → 熔心龙骑，每档配一种腰胯；9 种唯一变体已注册、等获得方式',
      hist: [['2026-09-24', '六档腿型', 'biped-lab.html', 'archived'], ['2026-09-24', '真双足 v2', 'biped-v2.html', 'archived'], ['2026-09-25', '整件底盘 v4', 'chassis-lab.html', 'shipped'], ['2026-09-29', '双足六档 + 腰胯 v1～v5（定稿进游戏）', 'archive/biped-tiers.html', 'shipped']] },
    // ---------- 第 2 档：前两章就会看到的文字占位 ----------
    periscope: { status: 'done', ch: 1, note: '轭架望远镜（2026-09-29 进游戏）：转台 + U 形轭架 + 黄铜望远镜慢慢俯仰；各档只换颜色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#periscope', 'archived'], ['2026-09-29', '造型 7 种 → D 轭架望远镜', 'archive/periscope.html', 'shipped']] },
    autoloader: { status: 'done', ch: 1, note: '链式扬弹机（2026-09-29 进游戏）：竖框 + 两只链轮，三发黄铜炮弹往上送；各档只换颜色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#autoloader', 'explore'], ['2026-09-29', '造型 7 种（选 链式扬弹机）', 'archive/five-modules.html', 'shipped']] },
    mortar_s: { status: 'done', ch: 2, note: '炮塔臼炮（2026-09-29 进游戏）：半球装甲炮塔 + 粗短炮管 + 跟炮管转的防盾；各档只换颜色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#mortar_s', 'explore'], ['2026-09-29', '造型 7 种（选 炮塔臼炮）', 'archive/five-modules.html', 'shipped']] },
    cockpit_pair: { status: 'done', ch: 2, note: '双层驾驶台（2026-09-29 进游戏）：一扇高窗里上下两层，上层对传声管、下层扳操纵杆', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#cockpit_pair', 'explore'], ['2026-09-29', '造型 7 种（每个选一个）', 'current.html', 'explore'], ['2026-09-29', '驾驶舱家族重做（看得见舱内 + 操纵件）', 'archive/cockpits.html', 'shipped']] },
    pressure_chamber: { status: 'done', ch: 2, note: '风箱增压器（2026-09-29 进游戏）：皮风箱 + 储气包 + 压力表，不发光；用户定以后是 1×2（数据改动交接 astra，1×1 时画小版）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#pressure_chamber', 'explore'], ['2026-09-29', '造型 6 种（选 风箱增压器）', 'archive/five-modules.html', 'shipped']] },
    condenser: { status: 'done', ch: 2, note: '盘管冷凝柱（2026-09-29 进游戏）：实心铁柱 + 盘管 + 青色水珠 / 滴水；各档只换颜色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#condenser', 'explore'], ['2026-09-29', '造型 6 种（选 盘管冷凝柱）', 'archive/five-modules.html', 'shipped']] },
    // ---------- 第 3 档：新增尺寸（数据和文字占位已接入，专用造型待做）----------
    // 机枪系列：1×1 车载机枪 → 1×2 重机枪 → 2×2 机炮（现有 mg 改名），最大到 2×2 为止；先画两个新件，定下语言后回头重画机炮
    mg_s: { status: 'done', pick: 'C', ch: 0, name: '车载机枪', size: '1×1', cat: 'firepower',
      note: '侧舷枪座：贴车体法兰 + 鼓出的半圆枪座 + 竖枪缝，转动小圆防盾 + 两道散热圈；只靠剪影分档', hist: [['2026-09-28', 'v1 候选：A 刘易斯式 / B 哈乞开斯式 / C 小转管', 'archive/mg-family-v1.html', 'archived'], ['2026-09-28', 'v2 车载枪座：A 球形枪座 / B 小枪塔 / C 侧舷枪座', 'archive/mg-family-v2.html', 'shipped'], ['2026-09-28', '定稿 C 侧舷枪座（去掉供弹槽），进游戏', 'archive/mg-family-v2.html', 'shipped']] },
    mg_heavy: { status: 'done', pick: 'B', ch: 1, name: '重机枪', size: '1×2', cat: 'firepower',
      note: '蒸汽加特林：下半蒸汽机壳（三辐飞轮 + 活塞，开火时转）+ 传动轴 + 座圈，上面六管 + 高竖弹匣；六档 + 铆钉 / 散热口 / 包角铁 / 压力表', hist: [['2026-09-28', 'v1 候选：A 马克沁式 / B 加特林式 / C 诺登菲尔特排枪', 'archive/mg-family-v1.html', 'archived'], ['2026-09-28', 'v2 车载枪座：A 装甲枪室 + 冷凝罐 / B 蒸汽加特林 / C 液压升降排枪', 'archive/mg-family-v2.html', 'shipped'], ['2026-09-28', '定稿 B 蒸汽加特林，进游戏', 'archive/mg-family-v2.html', 'shipped']] },
    // 锅炉家族：1×2 竖版（最小）→ 2×2（现有）→ 3×3 大型；水箱 3×3 先计划占位
    boiler_s: { status: 'done', pick: 'A3', lab: 'BLLAB', ch: 0, name: '竖式锅炉', size: '1×2', cat: 'energy',
      note: '立式锅炉 + 拱形大炉口（火 14 × 20）+ 黄铜拱心石；六档 圆筒 → 方包壳 → 斜肩',
      hist: [['2026-09-28', 'v1 三个方向 × 六档 → 用户选 C 高烟囱', 'boiler-lab.html', 'explore'], ['2026-09-28', 'v2 改用 A 立式 + 大炉膛：A2 大方炉门 / A3 拱形炉口', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 A3 拱形炉口，进游戏', 'boiler-lab.html', 'shipped']] },
    boiler_l: { status: 'done', pri: 12, ch: 4, name: '大型锅炉', size: '3×3', cat: 'energy',
      note: '第四章通关开放。v4 进游戏：巨炮钢板墙 + 占约 60% 的巨大炉口火光 + 输送链 / 传动链 / 拉环的黑剪影 + 大煤块煤山 + 黄铜包边司炉站台；煤球司炉小工在材质层之后逐帧画（sprites.js 的 BIG / bigStoker）', hist: [['2026-09-29', '造型 6 种（内部构造）', 'archive/big-boiler-tank-v1.html', 'archived'], ['2026-09-29', 'v2（选定方向细化）', 'current.html', 'archived'], ['2026-09-29', 'v3 重新构图：司炉台 + 传动链 + 链条送煤', 'current.html', 'archived'], ['2026-09-29', 'v4 巨大炉口 + 火光剪影 + 煤山', 'current.html', 'archived'], ['2026-09-29', 'v4 + 司炉站台 + 铲煤动作重做，进游戏', 'archive/big-boiler-tank.html', 'shipped']] },
    water_l: { status: 'done', pri: 13, ch: 4, name: '大水箱', size: '3×3', cat: 'cooling',
      note: '第四章通关开放。v4 进游戏：分片钢板（压筋调暗）+ 角铁包角 + 几乎占满正面的大舷窗（水位跟剩水量）+ 给水泵', hist: [['2026-09-29', '造型 6 种（内部构造）', 'archive/big-boiler-tank-v1.html', 'archived'], ['2026-09-29', 'v2（选定方向细化）', 'current.html', 'archived'], ['2026-09-29', 'v3 只留正中舷窗（去浮球 / 刻度盘 / 浮球室）', 'current.html', 'archived'], ['2026-09-29', 'v4 舷窗放大 + 压筋调暗', 'current.html', 'archived'], ['2026-09-29', 'v4 进游戏', 'archive/big-boiler-tank.html', 'shipped']] },
    // ---------- 第 4 档：第三章的特殊武器（还要配特效）----------
    harpoon: { status: 'done', pri: 14, ch: 3, note: '2026-09-29 进游戏：链锚抓钩 + 身后三圈粗缆的绞缆盘，射出后绞盘放缆、缆绳 + 一段铁链绷直伸出去（battle-view 传 tetherCell）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#harpoon', 'archived'], ['2026-09-29', 'v2：6 种（捕鲸炮 / 板簧弩炮 / 绞盘 / 蒸汽鱼叉枪 / 链锚抓钩 / 绞缆盘滑轨）', 'current.html', 'archived'], ['2026-09-29', 'v3：选 E 链锚抓钩 + 背景绞缆盘', 'current.html', 'archived'], ['2026-09-29', 'v4：绞缆盘改成三圈粗缆（去掉糊成一团的细纹）', 'current.html', 'archived'], ['2026-09-29', '定稿进游戏', 'archive/special-weapons.html', 'shipped']] },
    flamer: { status: 'done', pri: 15, ch: 3, note: '2026-09-29 进游戏：翅片喷焰炮（只做 T4～T6 的外观）；喷火时实心火锥 + 白汽领子 + 火舌尖化成汽团，待机一簇引燃火苗（weaponFx，材质层之后）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#flamer', 'archived'], ['2026-09-29', 'v2：6 种，只做 T4～T6（双罐 / 喷火塔 / 龙首 / 立文斯 / 玻璃燃烧室 / 翅片喷焰炮）', 'current.html', 'archived'], ['2026-09-29', 'v3：选 F 翅片喷焰炮（去电极、火焰混白汽）', 'current.html', 'archived'], ['2026-09-29', '定稿进游戏', 'archive/special-weapons.html', 'shipped']] },
    steamjet: { status: 'done', pri: 16, ch: 3, note: '2026-09-29 进游戏：扇形喷汽阀（只做 T1～T3 的外观）；喷射时手轮转、扇形白汽，待机丝丝冒汽（weaponFx）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#steamjet', 'archived'], ['2026-09-29', 'v2：6 种，只做 T1～T3（扇形阀 / 汽笛 / 多孔喷头 / 消防泵 / 机车汽缸 / 吉法尔注射器）', 'current.html', 'archived'], ['2026-09-29', 'v3：选 A 扇形喷汽阀', 'current.html', 'archived'], ['2026-09-29', '定稿进游戏', 'archive/special-weapons.html', 'shipped']] },
    // ---------- 第 5 档：第四章及以后 ----------
    rocket_rack: { status: 'done', pri: 17, ch: 4, note: '2026-09-29 进游戏：六档六种（投矛臂 / 投掷轮 / 板簧连弩 / 气压抛射管 / 火箭助推炸弹 / 管束发射架），每个投射点一枚短炸弹，发射管最低抬 18°；齐射节奏由 sprites.js 的 rocketLive 按 feed 记', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#rocket_rack', 'archived'], ['2026-09-29', 'v2：6 种（管束 / 康格里夫 / 蜂巢箱 / 转轮弹巢 / 黑尔槽式 / 双臂挂架）', 'current.html', 'archived'], ['2026-09-29', 'v3：重做成投掷架 4 种（投掷轮 / 投矛臂 / 四联投石机 / 配重投石机）', 'current.html', 'archived'], ['2026-09-29', 'v4：六档进化线（T1 投矛臂 / T2 投掷轮 / T3 卷簧臂或板簧连弩 / T4 气压抛射管或蒸汽弹射轨 / T5 火箭助推炸弹或转轮弹巢 / T6 管束发射架）', 'current.html', 'archived'], ['2026-09-29', 'v5 选定六档（投矛臂 / 投掷轮 / 板簧连弩 / 气压抛射管 / 火箭助推炸弹 / 管束发射架）；连弩重画、开火顺序修正', 'current.html', 'archived'], ['2026-09-29', '定稿进游戏', 'archive/special-weapons.html', 'shipped']] },
    pressure_tank: { status: 'cand', pri: 18, ch: 4, note: '1×2 储能，存量看得见、没有青色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#pressure_tank', 'archived'], ['2026-09-29', 'v2：6 种（立式气瓶 / 双瓶组 / 储气球 + 液柱 / 杠杆安全阀储汽罐 / 伸缩储气柜 / 双球储罐）', 'current.html', 'explore']] },
    rangefinder: { status: 'cand', pri: 19, ch: 4, note: '1×1，合像测距仪长横管', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#rangefinder', 'archived'], ['2026-09-29', 'v2：6 种（合像测距仪 / 刻度表盘 / 双筒 / 双耳测距塔 / 经纬仪 / 六分仪）', 'current.html', 'explore']] },
    mg2: { status: 'done', pick: 'C', ch: 4, note: '双联机枪 · 双嘴汽转球：铆接黄铜球 + 两根伸缩喷嘴交替后坐喷白汽，火盆 + 铁叉 + 轴承臂', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#mg2', 'explore'], ['2026-09-28', 'v1 车载枪座：A 双联侧舷 / B 双联枪塔 / C 双球座装甲墙（否决：太现代）', 'archive/mg-mg2-v1.html', 'archived'], ['2026-09-28', 'v2 古早蒸汽朋克：A 双联风琴管 / B 双联青铜排枪 / C 双嘴汽转球', 'archive/mg-mg2-v2.html', 'archived'], ['2026-09-28', 'v3 选 C 双嘴汽转球，转轴按物理重做', 'archive/mg-mg2-v3.html', 'shipped'], ['2026-09-28', '进游戏：加白汽 + 喷嘴后坐', 'archive/mg-mg2-v3.html', 'shipped']] },
    radiator: { status: 'cand', pri: 21, ch: 4, note: '1×2 侧挂，真镂空格栅', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#radiator', 'archived'], ['2026-09-29', 'v2：6 种（横格栅 / 翅片管排 / 蜂窝芯 / 蛇形管排 / 百叶窗 / 鳍柱）', 'current.html', 'explore']] },
    gyroscope: { status: 'cand', pri: 22, ch: 4, note: '1×1，和双足胯里的陀螺仪同一语言', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#gyroscope', 'archived'], ['2026-09-29', 'v2：6 种（万向环 / 陀螺舱窗 / 飞轮笼 / 陀螺罗经 / 双转子对转 / 船用减摇陀螺）', 'current.html', 'explore']] },
    // ---------- 第 6 档：唯一件（每个存档只拿到一次）----------
    boss_core: { status: 'cand', pri: 23, ch: 4, note: '圣堂压力核心，哥特尖拱 + 玫瑰窗', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_core', 'explore']] },
    boss_ram: { status: 'cand', pri: 24, ch: 5, note: '寡妇液压撞头，红色沙漏标记', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_ram', 'explore']] },
    boss_lens: { status: 'cand', pri: 25, ch: 5, note: '公爵测距棱镜；战役里还没有掉落来源，最后做', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_lens', 'explore']] },
    // ---------- 第 7 档：已有美术，按新规范复核（最不急：已经能看，只是没和火炮家族统一）----------
    mg: { status: 'done', pick: 'A', ch: 0,
      note: '机炮 · 蒸汽离心炮（1861 温南斯）：小立式锅炉 + 铜管 + 轴心旋转接头 + 离心鼓，炮管在锥形防盾里后坐、开火冒白汽', hist: [['2026-09-28', 'v1：A 砰砰炮炮塔 / B 弹鼓机炮 / C 蒸汽转管炮（否决：带供弹、太现代）', 'archive/mg-mg2-v1.html', 'archived'], ['2026-09-28', 'v2 古早蒸汽朋克：A 蒸汽离心炮 / B 米特留兹青铜炮 / C 蒸汽活塞速射炮', 'archive/mg-mg2-v2.html', 'archived'], ['2026-09-28', 'v3 选 A 蒸汽离心炮，转轴按物理重做', 'archive/mg-mg2-v3.html', 'shipped'], ['2026-09-28', '进游戏：加白汽 + 炮管后坐', 'archive/mg-mg2-v3.html', 'shipped']] },
    boiler: { status: 'legacy', pri: 27, ch: 0, note: '两阶段已画；竖式 / 大型锅炉定稿后按锅炉家族统一复核', hist: [] },
    armor: { status: 'legacy', pri: 28, ch: 0, note: '2026-09-28 用户定：从 2×2 改成竖着的 1×2（中间横接缝 + 两列铆钉，并排两块 = 原来一块），已进游戏；六档造型仍待按新规范复核', hist: [['2026-09-28', '改成 1×2', 'boiler-lab.html', 'explore']] },
    armor_heavy: { status: 'legacy', pri: 29, ch: 1, note: '同铁装甲', hist: [] },
    helmet: { status: 'done', ch: 0, note: '方窗驾驶箱（2026-09-29 重做进游戏）：铆接方箱 + 宽窗，窗里是驾驶员，窗下露出方向盘上半圈', hist: [] },
    plate: { status: 'legacy', pri: 31, ch: 0, note: '24px 甲片', hist: [] },
    water: { status: 'legacy', pri: 32, ch: 0, note: '水箱 2×2；大水箱定稿后按水箱家族统一复核', hist: [] },
    tank_s: { status: 'done', ch: 0, note: '小水罐 1×1：W1 大水窗罐 + 两道暗紫铜加强箍（收在罐身里、圆柱明暗）；六档 圆角罐 → 方罐平顶 → 八角罐', hist: [['2026-09-28', 'v1 重画：W1 大水窗罐 / W2 玻璃水筒', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 W1 + 紫铜箍，进游戏', 'boiler-lab.html', 'shipped']] },
    tank_tall: { status: 'done', ch: 0, note: '水罐 1×2：W1 大水窗罐 + 两道暗紫铜加强箍（收在罐身里、圆柱明暗）；六档 圆角罐 → 方罐平顶 → 八角罐，顶部铆钉 / 包角铁 / 小压力表', hist: [['2026-09-28', 'v1 重画：W1 大水窗罐 / W2 玻璃水筒', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 W1 + 紫铜箍，进游戏', 'boiler-lab.html', 'shipped']] },
    bucket: { status: 'legacy', pri: 35, ch: 0, note: '铲斗两阶段已画', hist: [] },
    spike: { status: 'legacy', pri: 36, ch: 3, note: '撞角两阶段已画', hist: [] },
    piston: { status: 'legacy', pri: 37, ch: 3, note: '蒸汽撞锤两阶段已画', hist: [] },
    cockpit: { status: 'done', ch: 4, note: '机车驾驶室（2026-09-29 重做进游戏）：一个贯通的司机室，后排两人在栏杆平台上、右边小楼梯，前排扳调节杆 / 拉汽笛，中间大舵轮', hist: [] },
  },
};
