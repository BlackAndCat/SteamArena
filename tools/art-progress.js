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
    track: { status: 'done', ch: 0, note: '三个阶段：竖肋侧框 → 减重孔 → 桁架斜撑',
      hist: [['2026-09-26', '履带三阶段', 'spritesheet.html', 'live']] },

    // ---------- 第 1 档：底盘细分支 ----------
    quad: { status: 'wip', pri: 1, ch: 1, note: '基础造型已进游戏（4×2 整件蜘蛛 + 距离步态、多件首尾相连）；还没做：材质六档细分、T3 / T5 形态分支（候选「高脚蛛」用膝高区分）',
      hist: [['2026-09-25', '机甲套件 v3', 'mech-kit.html', 'archived'], ['2026-09-25', '整件底盘 v4', 'chassis-lab.html', 'shipped']] },
    biped: { status: 'wip', pri: 2, ch: 2, note: '基础造型已进游戏（真双足 2×4：陀螺胯 + 一对长腿）；还没做：材质六档细分、T3 / T5 形态分支（从六档腿型里挑）',
      hist: [['2026-09-24', '六档腿型', 'biped-lab.html', 'archived'], ['2026-09-24', '真双足 v2', 'biped-v2.html', 'archived'], ['2026-09-25', '整件底盘 v4', 'chassis-lab.html', 'shipped']] },
    // ---------- 第 2 档：前两章就会看到的文字占位 ----------
    periscope: { status: 'cand', pri: 3, ch: 1, note: '1×1，控制类，镜头收在格子里；第一章敌车和支线奖励都有', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#periscope', 'explore']] },
    autoloader: { status: 'cand', pri: 4, ch: 1, note: '1×1，看得到炮弹和机械', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#autoloader', 'explore']] },
    mortar_s: { status: 'cand', pri: 5, ch: 2, note: '1×1 小臼炮，和已定稿的臼炮同一套语言（可直接缩臼炮）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#mortar_s', 'explore']] },
    cockpit_pair: { status: 'cand', pri: 6, ch: 2, note: '1×2 双人舱，第二章 Boss 奖励；驾驶员保持 1×1 大小', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#cockpit_pair', 'explore']] },
    pressure_chamber: { status: 'cand', pri: 7, ch: 2, note: '1×1，压力表 + 安全阀，不发光（不是锅炉：锅炉最小 1×2）', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#pressure_chamber', 'explore']] },
    condenser: { status: 'cand', pri: 8, ch: 2, note: '1×2 实心冷却件，不能像水箱也不能像散热片', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#condenser', 'explore']] },
    // ---------- 第 3 档：新增尺寸（数据和文字占位已接入，专用造型待做）----------
    // 机枪系列：1×1 车载机枪 → 1×2 重机枪 → 2×2 机炮（现有 mg 改名），最大到 2×2 为止；先画两个新件，定下语言后回头重画机炮
    mg_s: { status: 'todo', pri: 9, ch: 0, name: '车载机枪', size: '1×1', cat: 'firepower',
      note: '序章通关开放，游戏里使用文字占位。画法：一根短枪管 + 小弹箱，1×1 只靠剪影分档（参照小炮做法）', hist: [] },
    mg_heavy: { status: 'todo', pri: 10, ch: 1, name: '重机枪', size: '1×2', cat: 'firepower',
      note: '第一章通关开放，游戏里使用文字占位。水冷枪管套 + 弹链；和 2×2 机炮、双联机枪的剪影分开', hist: [] },
    // 锅炉家族：1×2 竖版（最小）→ 2×2（现有）→ 3×3 大型；水箱 3×3 先计划占位
    boiler_s: { status: 'done', pick: 'A3', lab: 'BLLAB', ch: 0, name: '竖式锅炉', size: '1×2', cat: 'energy',
      note: '立式锅炉 + 拱形大炉口（火 14 × 20）+ 黄铜拱心石；六档 圆筒 → 方包壳 → 斜肩',
      hist: [['2026-09-28', 'v1 三个方向 × 六档 → 用户选 C 高烟囱', 'boiler-lab.html', 'explore'], ['2026-09-28', 'v2 改用 A 立式 + 大炉膛：A2 大方炉门 / A3 拱形炉口', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 A3 拱形炉口，进游戏', 'boiler-lab.html', 'shipped']] },
    boiler_l: { status: 'todo', pri: 12, ch: 4, name: '大型锅炉', size: '3×3', cat: 'energy',
      note: '第四章通关开放，游戏里使用文字占位。3×3 大空间，按 visual-rules 大空间原则（一个主体、大平面安静）；双烟囱 / 大炉门', hist: [] },
    water_l: { status: 'todo', pri: 13, ch: 4, name: '大水箱', size: '3×3', cat: 'cooling',
      note: '第四章通关开放，游戏里使用文字占位；按用户决定，专用造型最后做', hist: [] },
    // ---------- 第 4 档：第三章的特殊武器（还要配特效）----------
    harpoon: { status: 'cand', pri: 14, ch: 3, note: '2×1，叉头 + 绳索；另需收绳特效', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#harpoon', 'explore']] },
    flamer: { status: 'cand', pri: 15, ch: 3, note: '2×1，燃料罐 + 喷口火苗；另需火焰特效', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#flamer', 'explore']] },
    steamjet: { status: 'cand', pri: 16, ch: 3, note: '2×1，和喷火器同一模块两种换皮：阀门 + 白汽', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#steamjet', 'explore']] },
    // ---------- 第 5 档：第四章及以后 ----------
    rocket_rack: { status: 'cand', pri: 17, ch: 4, note: '2×2，数得出 4 发；另需尾焰', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#rocket_rack', 'explore']] },
    pressure_tank: { status: 'cand', pri: 18, ch: 4, note: '1×2 储能，存量看得见、没有青色', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#pressure_tank', 'explore']] },
    rangefinder: { status: 'cand', pri: 19, ch: 4, note: '1×1，合像测距仪长横管', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#rangefinder', 'explore']] },
    mg2: { status: 'cand', pri: 20, ch: 4, note: '2×2，两门并在一起、两条弹链。和机炮同为 2×2，用户定：保留（2026-09-28），剪影要和机炮分开', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#mg2', 'explore']] },
    radiator: { status: 'cand', pri: 21, ch: 4, note: '1×2 侧挂，真镂空格栅', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#radiator', 'explore']] },
    gyroscope: { status: 'cand', pri: 22, ch: 4, note: '1×1，和双足胯里的陀螺仪同一语言', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#gyroscope', 'explore']] },
    // ---------- 第 6 档：唯一件（每个存档只拿到一次）----------
    boss_core: { status: 'cand', pri: 23, ch: 4, note: '圣堂压力核心，哥特尖拱 + 玫瑰窗', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_core', 'explore']] },
    boss_ram: { status: 'cand', pri: 24, ch: 5, note: '寡妇液压撞头，红色沙漏标记', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_ram', 'explore']] },
    boss_lens: { status: 'cand', pri: 25, ch: 5, note: '公爵测距棱镜；战役里还没有掉落来源，最后做', hist: [['2026-09-27', '候选 v1', 'module-candidates.html#boss_lens', 'explore']] },
    // ---------- 第 7 档：已有美术，按新规范复核（最不急：已经能看，只是没和火炮家族统一）----------
    mg: { status: 'legacy', pri: 26, ch: 0,
      note: '已改名「机炮」（id 不变）；已标记：画面材质需要后期修改——等车载机枪、重机枪定下机枪系列的语言后，按同一语言和六档材质重画', hist: [] },
    boiler: { status: 'legacy', pri: 27, ch: 0, note: '两阶段已画；竖式 / 大型锅炉定稿后按锅炉家族统一复核', hist: [] },
    armor: { status: 'legacy', pri: 28, ch: 0, note: '2026-09-28 用户定：从 2×2 改成竖着的 1×2（中间横接缝 + 两列铆钉，并排两块 = 原来一块），已进游戏；六档造型仍待按新规范复核', hist: [['2026-09-28', '改成 1×2', 'boiler-lab.html', 'explore']] },
    armor_heavy: { status: 'legacy', pri: 29, ch: 1, note: '同铁装甲', hist: [] },
    helmet: { status: 'legacy', pri: 30, ch: 0, note: '驾驶舱 1×1，T5 换装已画', hist: [] },
    plate: { status: 'legacy', pri: 31, ch: 0, note: '24px 甲片', hist: [] },
    water: { status: 'legacy', pri: 32, ch: 0, note: '水箱 2×2；大水箱定稿后按水箱家族统一复核', hist: [] },
    tank_s: { status: 'done', ch: 0, note: '小水罐 1×1：W1 大水窗罐 + 两道紫铜加强箍；六档 圆角罐 → 方罐平顶 → 八角罐', hist: [['2026-09-28', 'v1 重画：W1 大水窗罐 / W2 玻璃水筒', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 W1 + 紫铜箍，进游戏', 'boiler-lab.html', 'shipped']] },
    tank_tall: { status: 'done', ch: 0, note: '水罐 1×2：W1 大水窗罐 + 两道紫铜加强箍；六档 圆角罐 → 方罐平顶 → 八角罐，顶部铆钉 / 包角铁 / 小压力表', hist: [['2026-09-28', 'v1 重画：W1 大水窗罐 / W2 玻璃水筒', 'boiler-lab.html', 'explore'], ['2026-09-28', '定稿 W1 + 紫铜箍，进游戏', 'boiler-lab.html', 'shipped']] },
    bucket: { status: 'legacy', pri: 35, ch: 0, note: '铲斗两阶段已画', hist: [] },
    spike: { status: 'legacy', pri: 36, ch: 3, note: '撞角两阶段已画', hist: [] },
    piston: { status: 'legacy', pri: 37, ch: 3, note: '蒸汽撞锤两阶段已画', hist: [] },
    cockpit: { status: 'legacy', pri: 38, ch: 4, note: '四人联合驾驶舱', hist: [] },
  },
};
