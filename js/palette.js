// 项目锁定调色板：中性材质占大面积，语义色一色一义（见 docs/art-direction.md §3）
window.SA = window.SA || {};

SA.PAL = {
  // 中性：冷铁（装甲/结构/外壳），0 最暗 → 4 最亮
  iron: ['#1b2130', '#2e3647', '#4a5468', '#6f7a8e', '#a3adbd'],
  // 中性：暗铁（底盘、腿、履带），永远最暗
  dark: ['#0b0e15', '#161a24', '#232937', '#343c4e'],
  // 中性：皮革/木
  leather: ['#3b2418', '#6b4128', '#9a6a3f'],
  // 黄铜：维多利亚装饰材质（驾驶舱框、管线、铆钉），武器的 UI 色
  brass: ['#4e3510', '#9a6b1d', '#d9a441', '#f5d77a'],
  // 语义：能源/热量 = 炉火（唯一允许发光）
  fire: ['#5c1a0e', '#b8391b', '#ef7a21', '#ffd166'],
  // 语义：冷却/水 = 青
  water: ['#0f3b44', '#1f7a86', '#46c2c9', '#a8f0ee'],
  // 语义：动力/承载 = 压力表绿
  gauge: ['#1f4a2a', '#3f8f48', '#6fcf6a', '#c2f5a0'],
  // 语义：控制 = 舷窗玻璃
  glass: ['#1d3a4c', '#4f8fa8', '#a9dfee', '#effbff'],
  // 锈钢：撞击武器（铲斗/撞角/撞锤）
  rust: ['#34170f', '#6e3322', '#a4553a', '#d08a60'],
  // 蒸汽/烟（中性特效）
  steam: ['#6d6a64', '#a8a39a', '#e4e0d6'],
  // 背景：低饱和棕褐，压在中低明度
  bg: ['#1a1614', '#231e1b', '#2e2723', '#3b322c', '#4a3f37', '#5c4f45', '#6f6154'],
  // UI 专用：洋红 = 侧挂层锁定；场景美术禁止使用
  magenta: '#ff2bd6',
  white: '#f4f7ee',
  black: '#07080c',
};

// 语义分类：UI 卡片/蓝图用的类别色；场景里模块靠自身造型辨认
SA.CAT = {
  firepower: { name: '火力', plate: SA.PAL.brass[2], ink: SA.PAL.brass[0], ui: SA.PAL.brass[2] },
  energy:    { name: '能源', plate: SA.PAL.fire[2],  ink: SA.PAL.fire[0],  ui: SA.PAL.fire[2] },
  cooling:   { name: '冷却', plate: SA.PAL.water[2], ink: SA.PAL.water[0], ui: SA.PAL.water[2] },
  structure: { name: '结构', plate: SA.PAL.iron[4],  ink: SA.PAL.iron[0],  ui: SA.PAL.iron[4] },
  control:   { name: '控制', plate: SA.PAL.glass[2], ink: SA.PAL.glass[0], ui: SA.PAL.glass[2] },
  mobility:  { name: '底盘', plate: SA.PAL.gauge[2], ink: SA.PAL.dark[0],  ui: SA.PAL.gauge[2] },
  ram:       { name: '撞击', plate: SA.PAL.rust[2],  ink: SA.PAL.rust[0],  ui: SA.PAL.rust[2] },
};
