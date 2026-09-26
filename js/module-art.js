/* 模块外观字段表。
 * 这里集中存放精灵借形、材料换色阶段、炮管几何、后坐力表现和底盘接地点。
 * 机制文件 modules.js 只保留数值与规则字段；加载后通过 SA.applyModuleArt 合并，
 * 以保证旧调用方继续读取 SA.MODULES[id] 的同一字段。
 */
window.SA = window.SA || {};
const SA = window.SA;
SA.MODULE_ART = {
  track: { vis: [1, 3, 5], susp: { pts: [13, 37] } },
  quad: { vis: [1, 3, 5], contactPts: { nearRear: 18, nearFront: 78, farRear: 20, farFront: 80 }, susp: { splay: 30, hips: [22, 30] } },
  biped: { vis: [1, 3, 5], susp: { pts: [26, 34] } },   // 真双足的近侧 / 远侧脚（legs.js bipedArt，模块内 x）
  cockpit: { vis: [1, 5] },
  helmet: { vis: [1, 5] },
  cockpit_pair: { art: 'helmet', placeholder: '双人' },
  cannon: { vis: [1, 3, 5], piv: [34, 27], blen: 40, barrel: 24, rcPx: 9, back: 0.05, ret: 2.2 },
  cannon_m: { vis: [1, 3, 5], piv: [18, 13], blen: 34, barrel: 18, rcPx: 6, back: 0.05, ret: 2.4 },
  cannon_s: { vis: [1, 3, 5], art: 'cannon_m', placeholder: '小炮', piv: [12, 13], blen: 24, barrel: 12, rcPx: 4, back: 0.03, ret: 2.8 },
  cannon_heavy: { vis: [4, 5], art: 'cannon', placeholder: '重炮', piv: [34, 30], blen: 48, barrel: 34, rcPx: 12, back: 0.08, ret: 1.8 },
  cannon_giant: { vis: [6], art: 'cannon', placeholder: '巨炮', piv: [58, 30], blen: 66, barrel: 48, rcPx: 16, back: 0.1, ret: 1.4 },
  mortar: { piv: [20, 30], blen: 27, barrel: 0, rcPx: 6, back: 0.06, ret: 2.5 },
  mg: { piv: [34, 29], blen: 26, barrel: 12, rcPx: 2, back: 0, ret: 14 },
  side_cannon: { vis: [1, 3, 5], piv: [18, 34], blen: 48, barrel: 18, rcPx: 7, back: 0.04, ret: 2.6 },
  pressure_tank: { art: 'boiler', placeholder: '蓄压' },
  pressure_chamber: { art: 'boiler', placeholder: '加压' },
  radiator: { art: 'water', placeholder: '散热' },
  condenser: { art: 'water', placeholder: '冷凝' },
  rocket_rack: { vis: [1, 5], art: 'cannon', placeholder: '火箭', piv: [24, 28], blen: 34, barrel: 22, rcPx: 7, back: 0.05, ret: 2.2 },
  harpoon: { vis: [1, 5], art: 'cannon_m', placeholder: '鱼叉', piv: [18, 13], blen: 34, barrel: 22, rcPx: 5, back: 0.04, ret: 2.8 },
  flamer: { vis: [1, 5], art: 'cannon_m', placeholder: '喷火', piv: [18, 13], blen: 30, barrel: 18, rcPx: 3, back: 0.02, ret: 5 },
  steamjet: { vis: [1, 5], art: 'cannon_m', placeholder: '蒸汽喷射', piv: [18, 13], blen: 30, barrel: 18, rcPx: 3, back: 0.02, ret: 5 },
  boss_core: { art: 'boiler', placeholder: '核心' },
  boss_lens: { art: 'helmet', placeholder: '棱镜' },
  boss_ram: { art: 'piston', placeholder: '撞头' },
  boiler: { vis: [1, 5] },
  bucket: { vis: [1, 5] },
  spike: { vis: [1, 5] },
  piston: { vis: [1, 5] },
  mortar_s: { art: 'mortar', placeholder: '小臼炮', piv: [12, 13], blen: 18, barrel: 0, rcPx: 4, back: 0.03, ret: 2.7 },
  mg2: { art: 'mg', placeholder: '双联机枪', piv: [34, 29], blen: 26, barrel: 12, rcPx: 2, back: 0, ret: 14 },
  periscope: { art: 'plate', placeholder: '观察镜' },
  autoloader: { art: 'plate', placeholder: '装弹机' },
  rangefinder: { art: 'plate', placeholder: '测距仪' },
  gyroscope: { art: 'plate', placeholder: '陀螺仪' },
};

SA.applyModuleArt = function applyModuleArt(art) {
  for (const [id, fields] of Object.entries(art || {})) {
    const module = SA.MODULES && SA.MODULES[id];
    if (!module) continue;
    const { susp, ...plain } = fields;
    Object.assign(module, plain);
    if (susp) Object.assign(module.susp || (module.susp = {}), susp);
  }
  return SA.MODULES;
};

// 视觉辅助函数仍由本文件提供；规则层只读取这些结果，不写入外观字段。
SA.suspPts = (id, ri = 0, rn = 1) => {
  const module = SA.MODULES[id], s = module.susp, fixed = module.contactPts;
  if (fixed) return [fixed.nearRear, fixed.nearFront, fixed.farRear, fixed.farFront];
  if (!s.splay) return s.pts;
  const d = ri < rn / 2 ? -1 : 1;
  return [s.hips[0] + d * s.splay, s.hips[1] - d * s.splay];
};

// 外观阶段：vis 列出换外形的材料等级（默认只有一个造型）。
SA.stageOf = (id, mt = 1) => (SA.MODULES[id].vis || [1]).filter(t => t <= mt).length || 1;

if (SA.MODULES) SA.applyModuleArt(SA.MODULE_ART);
