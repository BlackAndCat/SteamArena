// 视觉样机登记表：视觉样机馆（tools/lab.html）按这里分类、排版本；每个样机页引入本文件后，
// 单独打开（不在样机馆的框架里）时右上角会出现一枚导航标签，点它回到样机馆。
// 新做的视觉样机：在 items 里加一行，并在页面 </body> 前加 <script src="labs.js"></script>。
// 两个总览页（2026-09-28 用户定）：module-candidates.html = 全部进度；current.html = 当前开发（不复用：确认后本期内容复制到
// archive/<名字>.html 登记成历史存档，current 换成下一项）。
// status：live = 现行（直接读游戏代码，永远和游戏一致）；explore = 探索中（等用户定）；
//         shipped = 已进游戏（定稿样机，留作参考）；archived = 历史存档（已被后来的版本取代）
window.SA = window.SA || {};

SA.LABS = {
  STATUS: {
    live: { name: '现行', color: '#6fcf6a', desc: '直接读游戏代码，永远和游戏一致' },
    explore: { name: '探索中', color: '#ef7a21', desc: '方案还没定，等用户决定' },
    shipped: { name: '已进游戏', color: '#46c2c9', desc: '定稿样机，已经搬进游戏，留作参考' },
    archived: { name: '历史存档', color: '#a8a39a', desc: '已被后来的版本取代，保留记录' },
  },
  GROUPS: [
    { id: 'top', name: '总览', desc: '两页：模块造型全部进度（全部模块、定稿的样子）+ 当前开发（只放正在开发、等开发者确认的东西）' },
    { id: 'spec', name: '美术规范', desc: '风格速查与全部模块的实物' },
    { id: 'module', name: '模块造型', desc: '单个模块的造型与材质探索' },
    { id: 'chassis', name: '底盘', desc: '四足、双足、子格套件的演进' },
    { id: 'world', name: '地形与物理画面', desc: '地形美术、坡上姿态和悬挂' },
    { id: 'character', name: '人物', desc: '碳球人物：身体、眼睛、短手、表情、体色和饰品，以及旁白和车手阵容' },
  ],
  // 同一条演进线上的版本（从旧到新）
  LINES: [
    { name: '双足 / 四足底盘', items: ['biped-lab', 'biped-v2', 'mech-kit', 'chassis'] },
    { name: '火炮家族', items: ['cannon-s', 'cannon-hi', 'gun-family'] },
  ],
  ITEMS: [
    { id: 'candidates', group: 'top', url: 'module-candidates.html', name: '模块造型 · 全部进度', ver: 'v4', date: '2026-09-28', status: 'live',
      desc: '全部 46 个模块一个画廊，按计划表分档、一个模块一行：已完成的盖「已通过」印章看定稿；有候选的并排放候选（金框 = 已选，含竖式锅炉 A / B / C）；游戏里还没有 / 没候选的只占一窄行。默认只看 T1，可切六档；想法、1×、剪影、仰角收在「细节」里', docs: ['docs/art-plan.md', 'docs/board-opus.md'] },
    { id: 'current', group: 'top', url: 'current.html', name: '当前开发', ver: '双足 13 种 + 腰胯 v2', date: '2026-09-29', status: 'explore',
      desc: '只放正在开发、等开发者确认的东西（不复用）。本期：真双足画面探索 v2，13 种——主线 6（黄铜 工装 Mk.II / 熟铁 鹭步 / 钢 掷弹兵 / 镀镍 蒸汽圣骑 / 乌兹钢 钟表巨像 / 以太合金 熔心龙骑）+ 唯一变体 7（熟铁 高跷；钢 板簧跑刃、裙甲堡；镀镍 对开罩袍；乌兹钢 蒸汽人；以太合金 詹森连杆腿、缩放仪平行腿）；另有 7 种新腰胯供选。确认后接进游戏、归档到 archive/', docs: ['docs/art-plan.md', 'docs/board-opus.md'] },
    { id: 'style', group: 'spec', url: 'style-guide.html', name: '美术风格参考', ver: 'v1', date: '2026-09-26', status: 'live',
      desc: '调色板、风格锚点、剪影 / 灰度测试、材料六阶、场景明度、界面组件、生成提示词', docs: ['docs/art-style.md', 'docs/art-direction.md'] },
    { id: 'material', group: 'spec', url: 'material-lab.html', name: '材质语言 v2', ver: 'v14', date: '2026-09-27', status: 'shipped',
      desc: 'T1～T6 材料定稿并进游戏（黄铜 AAP-64 旧黄铜提饱和、熟铁、淡青钢花纹板、象牙白漆金描线、布伦瑞克绿漆、海军蓝漆象牙白描线）；保留调配台和黄铜对照', docs: ['docs/board-opus.md'] },
    { id: 'sprites', group: 'spec', url: 'spritesheet.html', name: '模块精灵表', ver: 'live', date: '2026-09-24', status: 'live',
      desc: '全部模块的像素图、外观阶段 × 材料矩阵、改装挂件、炮管后坐与供弹动态帧', docs: ['docs/module-plan.md'] },
    { id: 'cannon-s', group: 'module', url: 'cannon-s-lab.html', name: '小炮 · 造型与材质语法', ver: 'v2', date: '2026-09-27', status: 'archived',
      desc: '火炮家族的早期探索（已归档）：五个造型方向 × 六种材料的材质语法；C 卡隆短炮三阶段。定稿的小炮在「火炮家族 · 六档再设计」里', docs: ['docs/board-opus.md'] },
    { id: 'cannon-hi', group: 'module', url: 'cannon-lab.html', name: '直射火炮 · 高阶造型语言', ver: 'v3', date: '2026-09-27', status: 'shipped',
      desc: '方案 A v3：立面分区排布；散热口逐档变；T1～4 方正、T5～6 斜板；包角铁钢起；铆钉黄铜 → 镀镍起钢质淡青；珐琅铭牌 + 大压力表镀镍起；钢 / 镀镍炮口重做', docs: ['docs/visual-rules.md'] },
    { id: 'gun-family', group: 'module', url: 'gun-family-lab.html', name: '火炮家族 · 六档再设计', ver: 'v15', date: '2026-09-28', status: 'shipped',
      desc: '火炮家族全部定稿进游戏（2026-09-28 巨炮 v6 进游戏后归档）。按 docs/visual-rules.md 推到其他火炮：中炮（敞开炮架 → 方平顶炮廓 → 斜板炮廓，炮管加长）、小炮（卡隆短炮，1×1 只靠剪影：铸造瓶身 → 方套箱 → 斜肩套箱）已进游戏；侧炮（窄挂板 + 粗方柱 → 方箱挂板 + 双柱横撑 → 斜板挂板 + 实心腹板）也已进游戏；重炮 v5（历史重炮 + 预制齿轮组）已进游戏；臼炮（短粗、炮口更粗 + 两侧活动大齿轮）也已进游戏；齿轮 v6 对称纯色；巨炮 v6（4×4 攻城臼炮阵地：椭圆弧象牙白炮口箍、分格弹簧底座 + 回转支承、黄铜炮弹、钢板墙、齿轮、燃煤仓、脚手架 + 工程师帽操作员）也已进游戏。和直射火炮逐档对照，含仰角检查', docs: ['docs/visual-rules.md'] },
    { id: 'boiler-s', group: 'module', url: 'boiler-lab.html', name: '竖式锅炉 + 小水罐', ver: 'v3', date: '2026-09-28', status: 'shipped',
      desc: '已定稿进游戏：竖式锅炉 A3 立式 · 拱形大炉口（火 14 × 20）；小水罐 / 水罐 W1 大水窗罐 + 两道紫铜加强箍；各六档。页面保留 v1 A / B / C、v2 A2 / A3、W1 / W2 探索记录和「游戏」行对照；附铁装甲改 1×2', docs: ['docs/art-plan.md', 'docs/visual-rules.md'] },
    { id: 'track-tiers', group: 'module', url: 'archive/track-tiers.html', name: '履带底盘 · 六档探索', ver: 'v1', date: '2026-09-29', status: 'shipped',
      desc: '已进游戏（用户：全部采用）：T1 博伊德尔铰接脚板轮（无履带）/ T2 木板链带 / T3 霍尔特铁链节 / T4 Mark IV 减重孔钢框 / T5 桁架转向架 / T6 全包裙板；档位 = 材料，悬挂、跨格连接、掉链、加固裙板都接上', docs: ['docs/art-plan.md'] },
    { id: 'mg-mg2-v3', group: 'module', url: 'archive/mg-mg2-v3.html', name: '机炮 + 双联机枪 v3 · 转轴按物理', ver: 'v3', date: '2026-09-28', status: 'shipped',
      desc: '已进游戏：机炮 = 蒸汽离心炮，双联机枪 = 双嘴汽转球。轴心凸台 / 轴承臂 / 明暗固定，铆钉 / 接缝 / 炮管跟着俯仰；进游戏时按用户要求加了白汽和炮管 / 喷嘴后坐（鼓和球不滑）', docs: ['docs/art-plan.md'] },
    { id: 'mg-mg2-v2', group: 'module', url: 'archive/mg-mg2-v2.html', name: '机炮 + 双联机枪 v2 · 古早蒸汽朋克', ver: 'v2', date: '2026-09-28', status: 'archived',
      desc: '六个 1870 年以前的候选（没有供弹系统）。用户选 机炮 A 蒸汽离心炮 + 双联 C 双嘴汽转球，指出中间的固定螺栓不随枪身动 → v3 按物理重做转轴', docs: ['docs/art-plan.md'] },
    { id: 'mg-mg2-v1', group: 'module', url: 'archive/mg-mg2-v1.html', name: '机炮 + 双联机枪 v1', ver: 'v1', date: '2026-09-28', status: 'archived',
      desc: '用户否决：带弹鼓 / 弹斗 / 弹箱等供弹系统、太现代；改做最古早的蒸汽朋克设计（当前开发 v2）。机炮 A 砰砰炮炮塔 / B 弹鼓机炮 / C 蒸汽转管炮；双联 A 双联侧舷 / B 双联枪塔 / C 双球座装甲墙', docs: ['docs/art-plan.md'] },
    { id: 'mg-family-v2', group: 'module', url: 'archive/mg-family-v2.html', name: '机枪家族 v2 · 车载枪座', ver: 'v2', date: '2026-09-28', status: 'shipped',
      desc: '用户选 车载机枪 C 侧舷枪座（去掉供弹槽）+ 重机枪 B 蒸汽加特林，已进游戏。原「当前开发」页归档：车载 A 球形枪座 / B 小枪塔 / C 侧舷枪座；重机枪 A 装甲枪室 + 冷凝罐 / B 蒸汽加特林 / C 液压升降排枪', docs: ['docs/art-plan.md'] },
    { id: 'mg-family-v1', group: 'module', url: 'archive/mg-family-v1.html', name: '机枪家族 v1 · 步兵式', ver: 'v1', date: '2026-09-28', status: 'archived',
      desc: '已被「当前开发」机枪 v2 取代：用户指出机枪都是车载的，三脚架、立柱支架、握把这类步兵元素不合适。车载 A 刘易斯 / B 哈乞开斯 / C 小转管；重机枪 A 马克沁 / B 加特林 / C 诺登菲尔特', docs: ['docs/art-plan.md'] },
    { id: 'chassis', group: 'chassis', url: 'chassis-lab.html', name: '整件底盘 · 外观与步态', ver: 'v4', date: '2026-09-25', status: 'shipped',
      desc: '四足 4×2 整件（蜘蛛）+ 真双足 2×4（陀螺胯、一对长腿）；外观和步态已进游戏', docs: ['docs/true-biped.md §8'] },
    { id: 'mech-kit', group: 'chassis', url: 'mech-kit.html', name: '机甲套件 · 子格验证', ver: 'v3', date: '2026-09-25', status: 'archived',
      desc: '24px 子格零件 + 附加层（机械臂、盾、剑、锤）在双足 / 履带 / 蜘蛛上的验证；子格已进游戏，重炮 / 侧炮草图待用', docs: ['docs/true-biped.md §6 §7'] },
    { id: 'biped-v2', group: 'chassis', url: 'biped-v2.html', name: '真双足 · 视觉语言', ver: 'v2', date: '2026-09-24', status: 'archived',
      desc: '一对腿 + 陀螺仪平衡系统、蜘蛛四足；被整件底盘 v4（2×4 定稿）取代', docs: ['docs/true-biped.md §3'] },
    { id: 'biped-lab', group: 'chassis', url: 'biped-lab.html', name: '双足设计探索 · 六档腿型', ver: 'v1', date: '2026-09-24', status: 'archived',
      desc: '六档品质腿型 + 五个探索版；腿型已搬进 js/legs.js，逐格双足玩法已被真双足取代', docs: ['docs/module-plan.md §3'] },
    { id: 'coal', group: 'character', url: 'character-lab.html', name: '人物形象 · 碳球', ver: 'v3', date: '2026-09-29', status: 'shipped',
      desc: '圆碳球、小短手、没有腿、1～3 只简笔画眼睛（照原驾驶舱：圆角方块白眼 + 单色瞳孔，面积约 20%）、不画嘴；靠肤色（黑往体色过渡，浓度可调）+ 眼球颜色 + 假发（8 样式 × 8 发色）+ 饰品区分。身体 A / B / C、表情、18 人阵容（头像 · 小人 · 驾驶舱里）、试装台（逐项换装并导出设定）、剪影测试和规则草案。已进游戏：驾驶舱车手、开场剧情小人、对话头像（js/coal.js）', docs: ['docs/visual-rules.md §9'] },
    { id: 'terrain', group: 'world', url: 'terrain-lab.html', name: '地形美术', ver: 'v1', date: '2026-09-25', status: 'shipped',
      desc: '土坡、泥地、货箱各阶段、碎木，以及坡上的整车倾斜', docs: ['docs/art-direction.md §12'] },
    { id: 'suspension', group: 'world', url: 'suspension-lab.html', name: '悬挂与爬坡', ver: 'v1', date: '2026-09-25', status: 'shipped',
      desc: '履带 / 四足 / 双足过坡：刚体 vs 悬挂（轮组、脚各自伸缩贴地），带悬空统计', docs: ['docs/game-design.md §4.1'] },
  ],
};

// 单独打开的样机页：右上角挂一枚导航标签
(() => {
  const path = decodeURIComponent(location.pathname), file = path.split('/').pop();
  if (file === 'lab.html' || window.top !== window) return;
  const it = SA.LABS.ITEMS.find(x => path.endsWith('/' + x.url));   // url 可以带子目录（archive/…）
  if (!it) return;
  const stt = SA.LABS.STATUS[it.status];
  const put = () => {
    const a = document.createElement('a');
    a.href = `${'../'.repeat(it.url.split('/').length - 1)}lab.html#${it.id}`;
    a.title = '回到视觉样机馆';
    a.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;display:flex;align-items:center;gap:8px;padding:6px 10px;'
      + 'background:#161a24;border:2px solid #0b0e15;box-shadow:inset 2px 2px 0 #343c4e,3px 3px 0 rgba(7,8,12,.6);'
      + 'color:#e4e0d6;text-decoration:none;font:700 12px "Microsoft YaHei","PingFang SC",sans-serif;';
    const wide = innerWidth >= 900;
    a.innerHTML = `<span style="color:#d9a441">‹ 视觉样机馆</span>` + (wide ? `<span>${it.name}</span><span style="color:#a8a39a">${it.ver}</span>` : '')
      + `<span style="padding:1px 6px;background:${stt.color};color:#11100e">${stt.name}</span>`;
    document.body.append(a);
  };
  if (document.body) put(); else addEventListener('DOMContentLoaded', put);
})();
