// 模块工作台字段白名单；点路径对应嵌套属性，外观字段与炮管角度不在此表。
window.SA = window.SA || {};
// MODULE_EDITOR_SCHEMA_START
SA.MODULE_EDITOR_SCHEMA = {
  "fields": {
    "name": {
      "label": "名称",
      "group": "基础",
      "type": "string",
      "maxLength": 200
    },
    "desc": {
      "label": "说明",
      "group": "基础",
      "type": "string",
      "maxLength": 10000
    },
    "cat": {
      "label": "类别",
      "group": "基础",
      "type": "string",
      "maxLength": 200,
      "enum": ["mobility", "control", "structure", "cooling", "firepower", "energy", "ram"]
    },
    "layer": {
      "label": "摆放层",
      "group": "基础",
      "type": "string",
      "maxLength": 200,
      "enum": ["chassis", "body", "side", "ram"]
    },
    "special": {
      "label": "特殊规则",
      "group": "基础",
      "type": "string",
      "maxLength": 200,
      "enum": ["pressure-buffer", "range-prism", "hydraulic-bite"]
    },
    "lowAlt": {
      "label": "低阶替代模块",
      "group": "基础",
      "type": "string",
      "maxLength": 200,
      "moduleId": true
    },
    "w": {
      "label": "宽度（子格）",
      "group": "基础",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 16
    },
    "h": {
      "label": "高度（子格）",
      "group": "基础",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 12
    },
    "price": {
      "label": "价格",
      "group": "基础",
      "type": "number",
      "min": 0
    },
    "hp": {
      "label": "耐久",
      "group": "基础",
      "type": "number",
      "min": 1
    },
    "kg": {
      "label": "重量（kg）",
      "group": "基础",
      "type": "number",
      "min": 0
    },
    "q": {
      "label": "品质",
      "group": "基础",
      "type": "number",
      "min": 0,
      "integer": true
    },
    "minMt": {
      "label": "最低材料阶",
      "group": "基础",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 6
    },
    "maxMt": {
      "label": "最高材料阶",
      "group": "基础",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 6
    },
    "repairRate": {
      "label": "修理费比例",
      "group": "基础",
      "type": "number",
      "min": 0.000001,
      "max": 1
    },
    "power": {
      "label": "工作功率（kW）",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "supply": {
      "label": "供给功率（kW）",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "load": {
      "label": "承载重量（kg）",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "speed": {
      "label": "速度",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "accel": {
      "label": "加速系数",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "brake": {
      "label": "制动系数",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "sway": {
      "label": "摇晃系数",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "spool": {
      "label": "起步系数",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "acc": {
      "label": "精准度",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "chassisLimit": {
      "label": "底盘限制",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "waistSlots": {
      "label": "腰部槽位",
      "group": "动力与行驶",
      "type": "number",
      "min": 0,
      "integer": true
    },
    "evade": {
      "label": "闪避",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "susp.up": {
      "label": "悬挂上收",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "susp.down": {
      "label": "悬挂下伸",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "susp.follow": {
      "label": "悬挂跟坡",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "balance.steady": {
      "label": "平衡稳定",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "balance.limit": {
      "label": "平衡上限",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "balance.topHeavy": {
      "label": "头重惩罚",
      "group": "动力与行驶",
      "type": "number",
      "min": 0
    },
    "balance.toleranceByMt": {
      "label": "各材料平衡容差",
      "group": "动力与行驶",
      "type": "array",
      "itemType": "number",
      "maxItems": 6,
      "minItems": 6,
      "itemMin": 0
    },
    "armor": {
      "label": "护甲",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "water": {
      "label": "储水（L）",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "cool": {
      "label": "冷却（kW）",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "dryCool": {
      "label": "干式冷却（kW）",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "waterSave": {
      "label": "耗水倍率",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "store": {
      "label": "蓄压容量（kJ）",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "heatRate": {
      "label": "产热（kW）",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "explode": {
      "label": "爆炸威力",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "heatMul": {
      "label": "热量倍率",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "aimShrink": {
      "label": "缩圈幅度",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "aimSpeed": {
      "label": "瞄准速度",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "reloadMul": {
      "label": "装填倍率",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "spreadMul": {
      "label": "散布倍率",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "swayMul": {
      "label": "摇晃倍率",
      "group": "生存与辅助",
      "type": "number",
      "min": 0
    },
    "cockpit": {
      "label": "驾驶舱",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "drivers": {
      "label": "驾驶员数量",
      "group": "生存与辅助",
      "type": "number",
      "min": 0,
      "integer": true
    },
    "chain": {
      "label": "链式底盘",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "whole": {
      "label": "整件底盘",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "legPair": {
      "label": "双足腿对",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "retired": {
      "label": "已退役",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "unique.mt": {
      "label": "唯一件材料阶",
      "group": "生存与辅助",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 6
    },
    "unique.once": {
      "label": "每存档仅一次",
      "group": "生存与辅助",
      "type": "boolean"
    },
    "unique.source": {
      "label": "唯一件来源",
      "group": "生存与辅助",
      "type": "string",
      "maxLength": 200,
      "enum": ["salvage"]
    },
    "dmg": {
      "label": "伤害",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "reload": {
      "label": "装填时间（秒）",
      "group": "武器与撞击",
      "type": "number",
      "min": 0.001
    },
    "heat": {
      "label": "射击产热（kJ）",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "proj": {
      "label": "弹种",
      "group": "武器与撞击",
      "type": "string",
      "maxLength": 200,
      "enum": ["shell", "bullet", "flame", "steam"]
    },
    "v": {
      "label": "弹速",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "g": {
      "label": "重力倍率",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "spread": {
      "label": "散布",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "arc": {
      "label": "弹道",
      "group": "武器与撞击",
      "type": "string",
      "maxLength": 200,
      "enum": ["low", "high"]
    },
    "slew": {
      "label": "转炮速度",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "windup": {
      "label": "预备时间",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "wild": {
      "label": "野射系数",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "aimT": {
      "label": "瞄准时间",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "penetration": {
      "label": "穿深",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "indirect": {
      "label": "间接射击",
      "group": "武器与撞击",
      "type": "boolean"
    },
    "ricochet": {
      "label": "额外跳弹率",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "salvo": {
      "label": "齐射数",
      "group": "武器与撞击",
      "type": "number",
      "min": 1,
      "integer": true,
      "max": 100
    },
    "salvoGap": {
      "label": "齐射间隔",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "splash.r": {
      "label": "溅射半径",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "splash.k": {
      "label": "溅射衰减",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "tether": {
      "label": "收绳速度",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "heatToEnemy": {
      "label": "敌方热量",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "heatPerSec": {
      "label": "每秒产热",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "dmgPerSec": {
      "label": "每秒伤害",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "range": {
      "label": "射程",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "cone": {
      "label": "喷射半角",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "knock": {
      "label": "击退",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "ram": {
      "label": "撞击伤害",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "punch": {
      "label": "冲击力",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "punchCd": {
      "label": "撞击冷却",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "kick": {
      "label": "开火反冲",
      "group": "武器与撞击",
      "type": "number",
      "min": 0,
      "objectAlternative": true
    },
    "kick.ram": {
      "label": "踢击撞伤",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "kick.knock": {
      "label": "踢击击退",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "kick.cooldown": {
      "label": "踢击冷却",
      "group": "武器与撞击",
      "type": "number",
      "min": 0
    },
    "mount": {
      "label": "允许挂载部件",
      "group": "武器与撞击",
      "type": "array",
      "itemType": "string",
      "maxItems": 5,
      "minItems": 0,
      "itemMaxLength": 100,
      "itemEnum": ["track", "quad", "biped", "armor", "armor_heavy"]
    }
  }
};
// MODULE_EDITOR_SCHEMA_END

// 与本机服务端共用字段约束，前端选择文件直存时也使用同一套校验。
SA.validateModuleOverrides = (id, overrides) => {
  const errors = [];
  if (!Object.prototype.hasOwnProperty.call(SA.MODULES || {}, id)) errors.push('模块 ID 不存在');
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) errors.push('覆盖属性必须是对象');
  const fields = SA.MODULE_EDITOR_SCHEMA.fields;
  const visit = (value, path) => {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) { errors.push('属性名不合法'); continue; }
      const current = path ? path + '.' + key : key;
      const rule = fields[current];
      const hasChildren = Object.keys(fields).some(name => name.startsWith(current + '.'));
      if (item && typeof item === 'object' && !Array.isArray(item) && hasChildren) {
        if (!Object.keys(item).length || (current === 'kick' && id !== 'biped')) {
          errors.push(current + ' 结构不合法');
          continue;
        }
        visit(item, current);
        continue;
      }
      if (!rule) { errors.push('不可编辑的属性：' + current); continue; }
      if (current === 'kick' && id === 'biped') { errors.push('双足踢击必须填写对象属性'); continue; }
      if (rule.type === 'number') {
        if (typeof item !== 'number' || !Number.isFinite(item) || item < rule.min || (rule.max !== undefined && item > rule.max) || (rule.integer && !Number.isInteger(item))) errors.push(current + ' 必须是有效范围内的数字');
      } else if (rule.type === 'string') {
        const controls = current === 'desc' ? /[\u0000-\u0008\u000b-\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/;
        if (typeof item !== 'string' || item.length > rule.maxLength || controls.test(item)
            || (rule.enum && !rule.enum.includes(item))
            || (rule.moduleId && !Object.prototype.hasOwnProperty.call(SA.MODULES, item))) errors.push(current + ' 文本不合法');
      } else if (rule.type === 'boolean') {
        if (typeof item !== 'boolean') errors.push(current + ' 必须是布尔值');
      } else if (rule.type === 'array') {
        if (!Array.isArray(item) || item.length < rule.minItems || item.length > rule.maxItems || item.some(entry => rule.itemType === 'number' ? typeof entry !== 'number' || !Number.isFinite(entry) || entry < rule.itemMin : typeof entry !== 'string' || entry.length > rule.itemMaxLength || (rule.itemEnum && !rule.itemEnum.includes(entry)))) errors.push(current + ' 数组不合法');
      }
    }
  };
  if (!errors.length) visit(overrides, '');
  const defaults = SA.MODULE_DEFAULTS?.[id];
  if (defaults && (overrides?.minMt ?? defaults.minMt ?? 1) > (overrides?.maxMt ?? defaults.maxMt ?? 6)) errors.push('最低材料阶不能超过最高材料阶');
  return { ok: errors.length === 0, errors };
};
