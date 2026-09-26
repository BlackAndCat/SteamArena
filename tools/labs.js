// 视觉样机登记表：视觉样机馆（tools/lab.html）按这里分类、排版本；每个样机页引入本文件后，
// 单独打开（不在样机馆的框架里）时右上角会出现一枚导航标签，点它回到样机馆。
// 新做的视觉样机：在 items 里加一行，并在页面 </body> 前加 <script src="labs.js"></script>。
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
    { id: 'spec', name: '美术规范', desc: '风格速查与全部模块的实物' },
    { id: 'module', name: '模块造型', desc: '单个模块的造型与材质探索' },
    { id: 'chassis', name: '底盘', desc: '四足、双足、子格套件的演进' },
    { id: 'world', name: '地形与物理画面', desc: '地形美术、坡上姿态和悬挂' },
  ],
  // 同一条演进线上的版本（从旧到新）
  LINES: [
    { name: '双足 / 四足底盘', items: ['biped-lab', 'biped-v2', 'mech-kit', 'chassis'] },
  ],
  ITEMS: [
    { id: 'style', group: 'spec', url: 'style-guide.html', name: '美术风格参考', ver: 'v1', date: '2026-09-26', status: 'live',
      desc: '调色板、风格锚点、剪影 / 灰度测试、材料六阶、场景明度、界面组件、生成提示词', docs: ['docs/art-style.md', 'docs/art-direction.md'] },
    { id: 'sprites', group: 'spec', url: 'spritesheet.html', name: '模块精灵表', ver: 'live', date: '2026-09-24', status: 'live',
      desc: '全部模块的像素图、外观阶段 × 材料矩阵、改装挂件、炮管后坐与供弹动态帧', docs: ['docs/module-plan.md'] },
    { id: 'cannon-s', group: 'module', url: 'cannon-s-lab.html', name: '小炮 · 造型与材质语法', ver: 'v2', date: '2026-09-27', status: 'explore',
      desc: '五个造型方向 × 六种材料的材质语法（材料换零件画法而不是换色）；v2 加了 C 卡隆短炮的三个外观阶段', docs: ['docs/board-opus.md'] },
    { id: 'candidates', group: 'module', url: 'module-candidates.html', name: '新模块造型候选', ver: 'v1', date: '2026-09-27', status: 'explore',
      desc: '20 个借形占位模块每个 2～3 个候选：T1 原画、1× / 剪影、仰角范围、六阶材料换色、放进车体；按早期 → 中期 → 后期排列', docs: ['docs/board-opus.md', 'docs/reports/2026-09-27-visual-overnight.md'] },
    { id: 'chassis', group: 'chassis', url: 'chassis-lab.html', name: '整件底盘 · 外观与步态', ver: 'v4', date: '2026-09-25', status: 'shipped',
      desc: '四足 4×2 整件（蜘蛛）+ 真双足 2×4（陀螺胯、一对长腿）；外观和步态已进游戏', docs: ['docs/true-biped.md §8'] },
    { id: 'mech-kit', group: 'chassis', url: 'mech-kit.html', name: '机甲套件 · 子格验证', ver: 'v3', date: '2026-09-25', status: 'archived',
      desc: '24px 子格零件 + 附加层（机械臂、盾、剑、锤）在双足 / 履带 / 蜘蛛上的验证；子格已进游戏，重炮 / 侧炮草图待用', docs: ['docs/true-biped.md §6 §7'] },
    { id: 'biped-v2', group: 'chassis', url: 'biped-v2.html', name: '真双足 · 视觉语言', ver: 'v2', date: '2026-09-24', status: 'archived',
      desc: '一对腿 + 陀螺仪平衡系统、蜘蛛四足；被整件底盘 v4（2×4 定稿）取代', docs: ['docs/true-biped.md §3'] },
    { id: 'biped-lab', group: 'chassis', url: 'biped-lab.html', name: '双足设计探索 · 六档腿型', ver: 'v1', date: '2026-09-24', status: 'archived',
      desc: '六档品质腿型 + 五个探索版；腿型已搬进 js/legs.js，逐格双足玩法已被真双足取代', docs: ['docs/module-plan.md §3'] },
    { id: 'terrain', group: 'world', url: 'terrain-lab.html', name: '地形美术', ver: 'v1', date: '2026-09-25', status: 'shipped',
      desc: '土坡、泥地、货箱各阶段、碎木，以及坡上的整车倾斜', docs: ['docs/art-direction.md §12'] },
    { id: 'suspension', group: 'world', url: 'suspension-lab.html', name: '悬挂与爬坡', ver: 'v1', date: '2026-09-25', status: 'shipped',
      desc: '履带 / 四足 / 双足过坡：刚体 vs 悬挂（轮组、脚各自伸缩贴地），带悬空统计', docs: ['docs/game-design.md §4.1'] },
  ],
};

// 单独打开的样机页：右上角挂一枚导航标签
(() => {
  const file = location.pathname.split('/').pop();
  if (file === 'lab.html' || window.top !== window) return;
  const it = SA.LABS.ITEMS.find(x => x.url === file);
  if (!it) return;
  const stt = SA.LABS.STATUS[it.status];
  const put = () => {
    const a = document.createElement('a');
    a.href = `lab.html#${it.id}`;
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
