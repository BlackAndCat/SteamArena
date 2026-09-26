# 蒸汽竞技场 · 美术风格速查与生成提示词 v1

> 2026-09-26 · Opus。这是 `docs/art-direction.md`（完整规范）的**一页浓缩版**，加上可以直接复制的生成提示词。以后新画任何东西（模块、底盘、特效、场景、UI、概念图），先对照这一页；细节和来龙去脉看 `art-direction.md`。
> 实物参考页：`tools/style-guide.html`（开发者面板 → 视觉样机馆 → 美术风格参考），里面的精灵、调色板和 UI 都直接读游戏代码，永远和游戏一致；提示词也从本文件读取。
> 本文件和代码冲突时，以 `js/palette.js`、`js/sprites.js` 的现状为准，并回头修正本文件。

---

## 0. 一句话风格

**维多利亚蒸汽朋克 × 一战铆接铁甲的侧视像素画：冷灰蓝的铁做底，黄铜点缀，炉火是唯一的光；棕褐雾化的圆形竞技场压在后面，Q 版小炭球坐在舷窗里开车。**

关键词：铆接、冷铁、黄铜箍、闷燃的煤、青色水位、一战坦克、侧视剖面、硬像素、左上光、低饱和棕褐背景、萌炭球驾驶员。

---

## 1. 设计语言：五条支柱

1. **统一和辨识分开管。** 统一靠材质配方、光源、描边、像素尺度、细节密度；辨识靠剪影和少量语义色。身上 75–85% 是中性铁色，功能信号只占 15–25%，而且那种颜色全画面只代表这一件事。
2. **读图顺序：剪影 → 功能色 → 细节。** 纯黑填充能认出类别，去色后能分层；铆钉、刻痕、磨损只负责质感，**不承担辨识**。
3. **形状就是功能。**
   - 伸出格子外的 = 会伤人的（只有武器和撞击件可以出格）。
   - 空洞剖面 + 里面有人 = 驾驶舱（打掉就输，要一眼找到）。
   - 大面积青色 = 水箱；会发光 = 锅炉；锈钢色 = 撞击件。
   - 最暗的永远是底盘，压在最下面给整车打底。
4. **整车感。** 模块嵌在统一的铆接车体框架里（每个 48px 模块四周留 3px 框架），相邻模块之间打一排铆钉，**只描整车外轮廓**，内部不留缝。模块被毁后舱位烧空，框架还在。
5. **明度三层。** 背景压在中低明度且降饱和；载具用全明度；发光物（炉火、炮口闪光、准星）独占最高明度。去色后三层依然分得开。

---

## 2. 像素硬规则

| 项 | 规则 |
|---|---|
| 尺度 | 模块原生 **48×48**（= 2×2 个 24px 子格）；全游戏只有一种像素大小，1×1 小件也按 24px 画，不缩放 |
| 光源 | 统一左上 45°：上沿、左沿 1px 亮面，下沿、右沿 1px 暗面 |
| 色阶配方 | 每块面按 `[描边, 暗面, 固有色, 亮面]` 四阶画（代码里的 `box(x, y, w, h, ramp)`） |
| 描边 | 1px，取所在材质的**最暗阶**（selout），不用纯黑；模块内部拼接处不描边（侧炮例外，它带一圈暗描边表示在另一层） |
| 抗锯齿 | 不做；不和背景做过渡色；不用柔和渐变（场景里的渐变用 Bayer 有序抖动） |
| 细节密度 | 每 4×4 px 最多 1 个细节；**铆钉只打在边缘**（2×2 亮点 + 右下 1px 暗影） |
| 旋转 | 零件动作预画多帧，不运行时旋转。例外：炮管仰角、整车随坡倾斜（最近邻采样） |
| 帧率 | 手绘节奏 8–12 fps；UI 补间可以更平滑 |
| 调色板 | 锁定 `js/palette.js`，精灵只能用里面的颜色 |
| 画法 | 程序化 Canvas：`R` 矩形、`box` 四阶方块、`disc` 圆、`line` 像素线、`rivet` 铆钉、`arch` 拱门；不导入位图 |

---

## 3. 调色板（`SA.PAL`）

| 组 | 色值（暗 → 亮） | 意思 / 用在哪 |
|---|---|---|
| 冷铁 `iron` | `#1b2130` `#2e3647` `#4a5468` `#6f7a8e` `#a3adbd` | 主体材质：装甲、外壳、车体框架（占画面大头） |
| 暗铁 `dark` | `#0b0e15` `#161a24` `#232937` `#343c4e` | 底盘、腿、履带；永远最暗 |
| 皮革 / 木 `leather` | `#3b2418` `#6b4128` `#9a6a3f` | 驾驶舱内饰、把手、飞行帽、木货箱 |
| 黄铜 `brass` | `#4e3510` `#9a6b1d` `#d9a441` `#f5d77a` | 维多利亚装饰：炮箍、舷窗框、管线、卡箍；UI 里的交互 / 选中 |
| 炉火 `fire` | `#5c1a0e` `#b8391b` `#ef7a21` `#ffd166` | 能源 / 热量，**唯一允许发光的颜色**：煤缝、炮口闪光、过热 |
| 青水 `water` | `#0f3b44` `#1f7a86` `#46c2c9` `#a8f0ee` | 冷却 / 水：水位、冷却管 |
| 压力表绿 `gauge` | `#1f4a2a` `#3f8f48` `#6fcf6a` `#c2f5a0` | 动力 / 承载：压力表、底盘类别色、可放置提示 |
| 舷窗玻璃 `glass` | `#1d3a4c` `#4f8fa8` `#a9dfee` `#effbff` | 控制：舷窗、护目镜片、玻璃高光 |
| 锈钢 `rust` | `#34170f` `#6e3322` `#a4553a` `#d08a60` | 只给撞击件：铲斗、撞角、撞锤 |
| 蒸汽 `steam` | `#6d6a64` `#a8a39a` `#e4e0d6` | 烟、蒸汽、次要文字 |
| 背景 `bg` | `#1a1614` → `#6f6154`（7 阶） | 场景：低饱和棕褐，只用中低明度 |
| 洋红 `magenta` | `#ff2bd6` | **UI 专用**（侧挂层锁定、警示角标），场景美术禁止出现 |
| 白 / 黑 | `#f4f7ee` / `#07080c` | 眼白、火花、准星芯 / 瞳孔、裂纹、准星边 |

炭球驾驶员的毛色在调色板外单独定义（`sprites.js`）：驾驶员蓝灰 `#141824 #2f3850 #6a7a9c`，副驾驶暖棕紫 `#1c1318 #4a3040 #8a6078`。

---

## 4. 材质配方

| 材质 | 画法 |
|---|---|
| 铁板 | 四阶方块 + 边缘铆钉；中间一道横接缝（上暗下亮 1px 两行），零星 3–5px 的划痕短线 |
| 黄铜箍 / 环 | 2px 宽，左 1px 用最亮阶；舷窗是黑圈 → 黄铜环 → 玻璃，左上角 3 颗亮点 |
| 管 / 炮管 | 1px 暗描边 → 固有色 → 上沿 1px 亮 → 下沿 1px 暗；炮口开黑孔 |
| 玻璃 / 水 | 玻璃底 `glass[0]`，水面 `water[2]` 顶上 1px `water[3]`，一两颗气泡 |
| 锅炉煤 | 铁栅栏后黑煤为主，**只有块间裂缝发红**，不画火舌 |
| 锈钢 | 只给撞击件，其余同铁板画法 |
| 地形 | 受光边 → 亮层 → 有序抖动 → 深层，外轮廓 `bg[1]`；木货箱用 `leather`，铁包角 |

**材料装饰层（6 阶，只作用在金属像素上，黄铜 / 炉火 / 水 / 玻璃 / 皮革保持原色）：**
黄铜（原画）→ 熟铁（锻打斑点）→ 钢（冷色高光边）→ 镀镍（镜面斜条纹）→ 乌兹钢（紫色流水花纹）→ 以太合金（青色发光纹路，T6 唯一允许的非炉火光）。

**外观阶段：** 钢开始，火炮和底盘变形；史诗以上，主力件全部变形。换造型时**炮口位置、负重轮、腿长不变**；24px 的小件只靠换色。

---

## 5. 各类模块的剪影母题

| 类别 | 母题 | 必须有 |
|---|---|---|
| 装甲 | 满格方块，边缘平直 | 四角 / 边缘铆钉、中间接缝 |
| 直射火炮 | 水平长管伸出格外半格 | 黄铜箍、炮口制退器；三阶段：素管 → 套筒 + 双箍 + 喇叭口 → 刻槽 + 复进筒 + 三孔制退器 |
| 高抛火炮 | 粗短炮管朝天约 55° | 黄铜耳轴、黑炮口 |
| 机枪 | 三根短管，只伸出 1/4 格 | 弹鼓 |
| 侧炮 | 炮管 + 铆接悬臂支架，挂在主体外 | 1px 暗外描边、在主体上投 1px 硬影 |
| 锅炉 | 方炉体 + 大炉窗 + 烟囱 | 铁栅栏后闷燃的煤（唯一发光体） |
| 水箱 | 方块 + 大玻璃窗 | 实时下降的青色水位、波纹气泡 |
| 驾驶舱 | 黄铜拱门剖面，舱内空洞可见 | Q 版**小炭球驾驶员**：毛茸茸圆身、大白眼、小短手；史诗起戴皮飞行帽 + 黄铜护目镜 |
| 履带 | 一战铆接履带（A7V 竖肋侧框 + Mark IV 上翘前端 + 雷诺 FT 辐条诱导轮） | 尾部链轮、成对负重轮；被毁整条掉链 |
| 四足 | 蜘蛛：机身压低，腿往前后张 | **膝盖高过机身顶板**；暗铁甲壳 + 一道黄铜饰线 |
| 双足 | 倒三角：宽躯干 → 收腰的胯 → 一对长腿 | 胯里黄铜陀螺仪、腰挂切角 + 黄铜卡箍、躯干切肩收腰 |
| 撞击件 | 锈钢色，装在车头最前 | 弧形推土板 / 锥形尖刺 / 气缸 + 活塞锤头 |

---

## 6. 场景、特效、UI

**竞技场背景：** 天空三条棕褐色带，带与带之间一行棋盘抖动；右侧一轮雾里的淡日；远景是厂房和烟囱剪影、亮一阶的窗；中景是一圈看台（人群小色块、彩旗三角、围栏立柱），画在圆筒上，越往两边越压缩；地面是平铺的土色和刻痕。全部只用 `bg` 色阶。

**特效：** 火花用白 + 最亮黄铜；甲片碎片用铁色 + 当前材料色；炮口闪光是 3px `fire[3]` + 2px `fire[2]`；烟和蒸汽用 `steam`。中文飘字画成小铭牌（实色底 + 白字 + 黑描边）。

**准星：** 装好 = 黄铜齿轮（蓄满闪绿）；装填中 = 沙漏；弹道是白芯黑边点线；"会先打中这块"是四个橙色角框加黑边；瞄准高亮 = 整格白闪 + 白描边。

**UI（`css/style.css`）：**
- 底色 `bg0 #14110f`，面板是暗铁 `dark2` + 2px `dark0` 边 + 内斜面（左上亮、右下暗）；**不做圆角，不做模糊阴影**，投影是 3px 硬偏移。
- 按钮是铁灰 `iron2`；主按钮 / 选中 = 抛光黄铜板 + 深棕字 `#2a1a05`；危险 = 炉火红。
- 导航是铆钉钢板（四角铆钉用径向渐变画），当前页换成黄铜板。
- 标题粗黑体（900）、加宽字距、2px 硬偏移字影；数字用等宽数字。
- 洋红只用于警示角标和侧挂锁定。

---

## 7. 做 / 不做

| 做 | 不做 |
|---|---|
| 冷灰蓝的铁占大面积，黄铜只做点缀 | 整套暖棕 / 全身黄铜（会重蹈 Steamlands「全是一个颜色」的覆辙） |
| 靠剪影和比例区分同类型号 | 靠角标、图标、文字标签补辨识（v0.3 已取消铭牌） |
| 1px 材质最暗阶描边 | 纯黑粗描边、抗锯齿、柔和渐变、模糊光晕 |
| 左上光、边缘铆钉、低细节密度 | 满身噪点、铆钉铺满、每个像素都有细节 |
| 炉火是唯一发光（T6 以太纹路是例外） | 霓虹色、到处发光、洋红出现在场景里 |
| 可爱的小炭球驾驶员 | 写实人物、性别特征、血腥 |
| 一战 / 维多利亚工业造型 | 科幻流线、激光、现代军事、日式机甲的尖角装甲 |
| 侧视正交剖面 | 等轴、透视、3D 渲染感 |

---

## 8. 验收清单（每个新画的东西都过一遍）

- [ ] 剪影测试：纯黑填充，能说出类别
- [ ] 灰度测试：去色后背景 / 载具 / 发光物三层分得开
- [ ] 1× 实机大小：放进 6 层叠放的车里，5 秒内认得出
- [ ] 只用 `SA.PAL` 里的颜色；语义色占比 ≤ 25%
- [ ] 光源、描边、铆钉位置符合 §2
- [ ] 换材料（6 阶）后仍好看，黄铜 / 炉火 / 水没被染色
- [ ] 武器：各阶段炮口位置不变（`piv` / `blen`）
- [ ] 在 `tools/style-guide.html` 和 `tools/spritesheet.html` 里看过

---

## 9. 提示词

下面每段 `### P…` 下的代码块会被参考页读取并加上「复制」按钮。改提示词只改这里。

### P1 · 代码代理：画一个新模块的像素精灵

给 Claude Code / Codex 等写代码的代理用。把尖括号里的内容换掉。

```text
你要给「蒸汽竞技场」画一个新模块的像素精灵，代码写在 js/sprites.js 的 DRAW 表里（DRAW.<模块id>(x, y, q)），外观字段写在 js/module-art.js。开工前先读 docs/art-style.md 和 docs/art-direction.md §2、§9。

模块：<名称>，类别 <火力 / 能源 / 冷却 / 结构 / 控制 / 底盘 / 撞击>，占 <w×h> 个 24px 子格（整格 = 48×48 原生像素）。
功能和造型要点：<它干什么、剪影母题、必须有的特征>。
动态状态：<q 里要读的字段，例如 heat / water / recoil / feed；没有就写"无">。

风格要求（硬性）：
- 维多利亚蒸汽朋克 + 一战铆接铁甲，侧视正交剖面。
- 只用 SA.PAL 里的颜色；冷铁 iron 占 75–85%，语义色只用本类别那一种，占 ≤25%；洋红禁用。
- 用现有帮手函数：R、box(x,y,w,h,[描边,暗面,固有色,亮面])、disc、line、rivet、arch；不导入位图，不做抗锯齿，不用渐变。
- 光源左上 45°：上 / 左沿 1px 亮，下 / 右沿 1px 暗；描边 1px 取材质最暗阶，不用纯黑。
- 模块主体从 (x+3, y+3) 开始，四周留 3px 给车体框架；只有武器和撞击件可以伸出格子。
- 铆钉只打在边缘，每 4×4 px 最多一个细节；细节不承担辨识，剪影必须自己就能认出类别。
- 只有炉火色可以发光；需要多个外观阶段时，炮口 / 接地点位置在各阶段之间保持不变。
- 材料装饰层会自动给金属换色：金属部分用 iron / dark / rust，不能被换色的部分用 brass / fire / water / glass / leather。

完成后：node --check js/sprites.js；在 tools/style-guide.html 打开「剪影」「灰度」两个开关看一遍，再看 tools/spritesheet.html 的材料矩阵；更新 js/build-vis.js。
```

### P2 · 图像模型：模块 / 零件概念图（英文）

用于 Midjourney / SDXL / ComfyUI 等做**概念发散**；成品仍要按 §2 在代码里重画，锁定调色板。

```text
2D side-view pixel art game sprite of a single <MODULE: e.g. riveted boiler with a coal grate window and a chimney>, Victorian steampunk machinery crossed with WWI riveted ironclad tanks, flat orthographic cutaway view, native 48x48 pixel grid, crisp hard pixels, no anti-aliasing, strictly limited palette: cool blue-grey wrought iron (#1b2130, #2e3647, #4a5468, #6f7a8e, #a3adbd) covers most of the surface, near-black blue steel (#0b0e15, #232937) for undercarriage, small polished brass accents (#9a6b1d, #d9a441, #f5d77a) only on hoops, rims and trim, <ONE SEMANTIC COLOR: furnace orange glow only in coal cracks #ef7a21 #ffd166 | teal water level #46c2c9 | porthole glass #a9dfee | rusted steel #a4553a>, single light source from the top-left at 45 degrees, 1px highlight on top and left edges, 1px shadow on bottom and right edges, 1px selective outline using the darkest shade of each material (not pure black), rivets only along plate edges, low detail density, bold readable silhouette, plain dark sepia background #231e1b, game asset sheet style
```

### P3 · 图像模型：通用负面提示词（英文）

```text
anti-aliasing, soft gradients, blur, bloom, glow on metal, 3d render, isometric, perspective, photorealistic, painterly, brush strokes, all-brown sepia metal, gold everywhere, shiny chrome, neon colors, magenta, pink, purple glow, sci-fi, lasers, anime mecha, sharp futuristic armor, modern military, high-frequency noise, rivets everywhere, mixed pixel sizes, rotated pixels, jpeg artifacts, text, letters, logo, watermark, blurry drop shadow, rounded ui corners
```

### P4 · 图像模型：整车 / 竞技场场景（英文）

```text
2D side-view pixel art scene from a Victorian steampunk vehicle-building arena game, a boxy riveted war machine assembled from square modules on a grid (brass-rimmed porthole cockpit with a tiny fuzzy soot-ball pilot, glowing coal boiler, teal water tank, long cannon barrel sticking out of the hull, WWI-style riveted track chassis with spoked wheels), the machine uses cool blue-grey iron with small brass trim and full value range, background is a circular industrial arena in desaturated sepia browns kept in low-to-mid values: banded hazy sky with ordered dithering, pale sun disk, silhouettes of factories and smokestacks, curved grandstands with a pixel crowd and bunting flags, packed dirt floor, only the furnace glow and muzzle flash reach the brightest values, crisp hard pixels, no anti-aliasing, one pixel size across the whole image, light from the top-left
```

### P5 · 图像模型：炭球驾驶员（英文）

```text
tiny chibi soot sprite character in pixel art, a fuzzy round ball of soot with spiky fur tips, body color blue-grey (#2f3850) with darker tips (#141824) and a lighter rim highlight on the upper left (#6a7a9c), two big round white eyes with black pupils and a single white catchlight, two stubby little arms ending in round fists, optional brown leather aviator cap and brass goggles with pale glass lenses, sitting inside a round brass porthole window, cute and harmless, genderless, crisp hard pixels, no anti-aliasing, side-view game sprite, about 12 pixels across
```

### P6 · 图像模型 / 代码代理：界面组件（英文）

```text
pixel-style Victorian industrial game UI, dark iron panels (#232937) with a 2px near-black border and a hard 2px inner bevel (lighter top-left, darker bottom-right), riveted steel navigation plates with a rivet in each corner, the active or primary state is a polished brass plate (#f5d77a to #d9a441) with dark brown text (#2a1a05), secondary buttons are flat blue-grey iron (#4a5468), danger buttons are furnace red (#b8391b), bold heavy Chinese sans-serif headings with wide letter spacing and a hard 2px offset text shadow, tabular numbers, sepia-black page background (#14110f), square corners only, hard 3px offset drop shadows, no blur, no glassmorphism, no rounded corners, magenta (#ff2bd6) used only for small warning badges
```

### P7 · 新模块美术简报模板

先填这张表再动手（或者把它交给代理）。

```text
【新模块美术简报】
模块 id / 名称：
类别（决定唯一允许的语义色）：
占格（子格 w×h，原生像素）：
所在层：主体 / 侧挂 / 底盘 / 撞击
剪影母题（纯黑填充时靠什么认出来）：
和同类的区别（比例、长短、数量，而不是图标）：
允许伸出格子吗（只有武器 / 撞击件）：
动态状态（热量、水位、后坐、供弹、步态……）：
外观阶段（一形 / 两形 T1–4、T5–6 / 三形 T1–2、T3–4、T5–6）：
不能动的锚点（炮口 piv / blen、接地点、挂点）：
参考：现有哪个模块的画法最接近：
```
