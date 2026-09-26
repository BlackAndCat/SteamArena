# 蒸汽竞技场 · 协作核心文档

> 2026-09-25 · v1。所有参与开发的 AI 代理和人**开工前必须读完这一份**。
> 入口：Claude Code / Opus 读 `CLAUDE.md`，astra（以及其他读 `AGENTS.md` 的代理）读 `AGENTS.md`，两者都指向这里。本文件和它们冲突时，以本文件为准。

## 0. 项目速览

- 维多利亚蒸汽朋克像素风的 H5 载具构筑对战游戏。纯 HTML / CSS / JS，无构建步骤、无依赖。
- 运行：仓库根目录执行 `python tools/serve.py`（禁缓存；用 `python -m http.server 5173` 时浏览器可能缓存旧 JS，需要 Ctrl+F5），打开 http://localhost:5173 。
- 调试：控制台 `SA.reset()` 清空存档；`SA.BUILD` 看当前加载的版本；侧边栏「开发者」按钮里有数值自测（`tools/sim.html`）、试驾场和各个样机页。
- 玩法、代码结构见 `README.md`。

## 1. 角色

| 角色 | 负责 | 不负责 |
|---|---|---|
| **用户** | 所有产品决策：玩法方向、要不要做、做到什么程度、平衡目标 | — |
| **Opus**（视觉） | 视觉、动画、特效、UX、界面布局与交互、美术规范 | 数值、规则、AI、存档格式 |
| **astra**（后台） | 玩法规则、模块机制、数据、数值、AI、战役和关卡数据、经济、存档与分享码、数值工具、自动化检查 | 精灵、造型、动画、特效、CSS、界面布局 |

**两个代理都不做产品决策。** 拿不准、需要取舍的，写进 `docs/board-astra.md` 的待定项，并在汇报里提出来，由用户决定。不要擅自删功能，也不要擅自改已经定下的决定（§5）。

**发现问题要记录并汇报。** 测试中发现的缺陷、漏洞、不合理的必胜打法，记下复现方法并告诉用户。明显的 bug 可以直接修；属于设计取舍的，写成提议等用户决定。关卡车进化生成器的具体权限见 `docs/evolve-plan.md` §13。

## 2. 文件与代码归属

原则：**谁负责，谁改。** 必须动对方区域时，只做最小改动，并在自己的看板记一笔。

### 2.1 按文件

| 归属 | 文件 |
|---|---|
| astra | `js/battle.js`、`js/build-sys.js`、`js/modules.js`（只含机制字段，见 §2.3）、`js/vehicle.js`、`js/camp.js`、`js/content.js`、`js/state.js`、`js/street.js`、`tools/sim.html`、`tools/sim.js`、今后新增的检查脚本、`docs/game-design.md`、`docs/codex-task-*.md` |
| Opus | `js/main.js`、`js/build-vis.js`、`js/editor.js`、`js/ui.js`、`js/arena.js`、`js/blueprints.js`、`js/module-art.js`、`js/battle-view.js`、`js/camp-ui.js`、`js/sprites.js`、`js/legs.js`、`js/dynamics.js`、`js/terrain-art.js`、`js/palette.js`、`css/style.css`、`index.html` 的结构、各样机页（`tools/*-lab.*`、`tools/mech-kit.*`、`tools/biped-v2.*`、`tools/spritesheet.html`、`tools/chassis-lab.html`）、`docs/art-direction.md`、`docs/true-biped.md` 的视觉章节 |
| astra | `js/text-manager.js`、`text/`、`tools/serve.py`、`README.md`、`docs/module-plan.md`、`docs/board-astra.md` |
| Opus | `docs/board-opus.md` |
| 用户批准 | 本文件的公共协作约定；改规则须用户同意 |

### 2.2 跨文件接口约定

- **`js/battle.js` / `js/battle-view.js`**
  - astra：`battle.js` 负责状态更新、物理、碰撞、弹道、伤害、热量、判负、投降、AI、无画面模拟（`simulate`），并通过 `SA.Battle.emit(type, data)` 发出视觉事件。
  - Opus：`battle-view.js` 负责绘制、镜头呈现、背景、粒子和特效外观、准星、HUD、面板、键鼠 / 触屏输入；事件类型包括 `part`、`text`、`boom`、`ricochet`、`shatter`、`surrender`。
  - 镜头的纯状态更新仍在 `battle.js`，因为炮弹出界判定依赖同一份 `B.cam`；画面层复用该状态，不改变算法。
- **`js/modules.js` / `js/module-art.js`**：数值 / 机制字段归 astra，外观字段表及加载合并归 Opus。
- **`js/camp.js` / `js/camp-ui.js`**：进度、解锁、缴获和关卡规则归 astra；弹窗、开发者面板和试驾场归 Opus。
- **`js/editor.js`、`js/ui.js`、`js/arena.js`、`js/blueprints.js`**
  - astra：规则接口已集中到 `state.js` / `vehicle.js`（存档、经济、蓝图库、出战列表、结算、摆放校验）。
  - Opus：保留 DOM 结构、样式、交互流程和提示呈现；这些文件只调用规则接口。
  - 新功能需要界面入口时，astra 提供规则接口，在 `docs/board-astra.md` 请 Opus 接入界面。
- **`js/main.js`**：归 Opus，负责启动入口并拼接构建标记；astra 只更新 `js/build-sys.js`，Opus 只更新 `js/build-vis.js`。
- **`README.md`、`docs/module-plan.md`**：由 astra 维护；Opus 的功能或美术更新请求写入自己的看板，由 astra 同步文档。

### 2.3 模块字段的归属（`js/modules.js` / `js/module-art.js`）

- **视觉字段**（只写在 `js/module-art.js`，逻辑只读不写）：`vis`、`art`、`placeholder`、`piv`、`blen`、`barrel`、`rcPx`、`back`、`ret`、`susp.pts` / `susp.splay` / `susp.hips`。Opus 可以改它们去对齐画面。其中 `piv` / `blen` 决定炮弹出膛位置，改的时候要告诉 astra。
- **其余字段**都归 astra：数值、机制、尺寸 `w` / `h`、解锁、`kick`（影响车身物理）、`susp.up` / `susp.down` / `susp.follow`。
- astra 加新字段时，在 `modules.js` 顶部的注释里写清含义；如果需要画出来，在相应看板说明要画什么、从哪个状态读。

## 3. Git 规则

### 3.1 基本规则

1. **只用 `main` 分支。** 不开新分支，不开 PR。
2. **协作期间每次提交都立即推送到 `origin/main`**，本机开发也一样（这一条替代原来 `CLAUDE.md` 里"本机提交不需要推送"）。两个代理靠 `origin/main` 同步，不推送就等于对方看不到。
3. **一个工作目录同一时间只让一个代理工作。** 云端会话本身就是独立的克隆；如果两个代理都在本机，要用两个文件夹，或者 `git worktree`。

### 3.2 每次工作的流程

```bash
# 开工
git status                   # 必须是干净的；有别人留下的改动，先问用户，不要丢弃
git pull --rebase origin main

# 开发 …… 小步提交，一次只做一件事

# 提交前
git pull --rebase origin main   # 再同步一次，解决冲突（见 3.3）
# 跑检查（见 3.5）
git add <只加你改的文件>        # 不要用 git add -A 把不相关的文件带进去
git commit -m "<前缀>: <做了什么>"
git push origin main
```

推送被拒（远端有新提交）时：再 `git pull --rebase origin main`，重跑检查，再推。

### 3.3 冲突

- **冲突在自己的区域**：自己解决。
- **冲突在对方的区域**：保留对方的版本；你的改动如果必须动那里，只重做最小的那部分，并在相应看板记一笔。
- **同一段逻辑两边都改了、而且谁的都不能丢**：停下来，不要提交。在相应看板写清冲突，然后问用户。

### 3.4 禁止事项

- 不 `push --force`，不 rebase 或 amend 已经推送的提交，不 `reset --hard` 掉别人的工作。
- 不推送到 `main` 以外的分支。
- 不做大面积的格式化、改缩进、改换行这类和任务无关的改动，尤其是对方区域的文件。
- 不删除、不改名对方负责的文件。
- **`SA.BUILD`**（`js/main.js`）：由 `js/build-sys.js` 的 `SA.BUILD_SYS` 与 `js/build-vis.js` 的 `SA.BUILD_VIS` 拼接；视觉标记以远端最新基线为准，冲突时保留较新的那个。

### 3.5 提交前的检查

- 改过的每个 JS 文件：`node --check <文件>`。
- 打开游戏，能进战役第一关、能开火。
- 改到规则、数值或 AI（astra）：`tools/sim.html` 的战役关卡检验能跑完，没有报错或 NaN。
- 改到画面（Opus）：`tools/spritesheet.html` 能正常显示；改到战斗画面的，打一场试驾场。
- astra 做好自动化检查脚本以后（见 `docs/board-astra.md` 的 F 项），以上改成跑那一条命令。

### 3.6 提交信息

- 前缀：`sys:` = 后台（astra），`vis:` = 视觉（Opus），`doc:` = 只改文档。
- 第一行说做了什么；需要时空一行，写原因和影响范围。
- 如果留下了交接事项，在正文写"见相应看板"。
- 附加的署名行按各自工具的要求写。

## 4. 文档地图

| 文档 | 内容 | 维护 |
|---|---|---|
| `docs/collab.md`（本文件） | 协作规则、稳定已定决定、看板入口 | 用户批准规则；代理按授权维护 |
| `docs/game-design.md` | 游戏节奏、战役、解锁、材料、敌人、地形、数值验收 | astra |
| `docs/module-plan.md` | 模块总表、外观分级、美术工作量和排期 | 两边（玩法列归 astra，美术列归 Opus） |
| `docs/true-biped.md` | 真双足规则与视觉语言 | 规则章节归 astra，视觉章节归 Opus |
| `docs/art-direction.md` | 美术统一与辨识度规范 | Opus |
| `docs/codex-task-systems.md` | astra 的模块机制任务书（已完成） | astra |
| `docs/campaign-direction.md` | 战役方向探索稿：章节主题、克制链、跳弹、反震、修理费、唯一件、支线、重打；后端 / 视觉分工 | 用户定方向，Claude 记录；astra、Opus 按其中 §9 / §10 实现 |
| `docs/evolve-plan.md` | 关卡车进化生成器的规则与开发计划、问题记录 | astra 执行；标"已定"的参数只有用户能改 |
| `docs/board-astra.md` / `docs/board-opus.md` | 后台 / 视觉进度、待定项和交接事项 | 各自维护，保留历史记录 |
| `README.md` | 玩法速览和代码结构 | 谁改了功能谁更新 |

## 5. 已定的决定（用户决定，代理不得擅自改）

| 日期 | 决定 |
|---|---|
| 2026-09-25 | **真双足进游戏**：不管双足底盘占几格宽，一台车始终只有**一对腿**；可以装撞击件和侧炮（侧挂层）；整车高度上限就是改装台的 6 层，不另设躯干上限。规则细节见 `docs/true-biped.md` §8 |
| 2026-09-25 | **驾驶舱辅助设备改成 1×1 实体模块**（打得掉），旧的辅助设备系统（`SA.AUX`、驾驶舱槽位）**删除**，旧存档里的设备迁移成库存里的实体 |
| 2026-09-25 | **新模块尺寸保持暂定，现在只做功能**；视觉等以后需要时再做，这之前一律用 `art` 借形占位 |
| 2026-09-25 | **云车库只做字符串分享**（分享码导入 / 导出），不做服务器存储；服务器存储以后根据发布平台再考虑 |
| 2026-09-25 | **音乐和音效搁置** |
| 2026-09-25 | **四足整件化进游戏**：四足改成 4×2 的整件、四条腿（外观见 `tools/chassis-lab.html`）；迁移进游戏后**删除旧的逐格四足、双足底盘逻辑**，只保留新的（四足整件 + 真双足），避免回归 |
| 2026-09-25 | **关卡车由进化生成器自动生成**，替换现有关卡车；优秀的车另存为候选车库供用户手工设计。规则和已定参数见 `docs/evolve-plan.md` §1 |
| 2026-09-25 | **超时判定**：造成的伤害（占对手总耐久的比例）占 60%，自己剩余耐久比例占 40%，高者胜 |
| 2026-09-25 | **Boss 就是参考车**：每档的 Boss 是通用型标杆（不是地形特化、毒瘤或奇特构筑），对本档种群平均胜率 ≥ 50%（携带下一档新模块的奖励车除外）；用本档配置的玩家打 Boss 胜率 ≤ 50% |
| 2026-09-25 | **奖励车**：带模块奖励的普通关对手，打上一档 Boss 胜率不低于 60%（低一档配置的玩家打它不高于 40%），上一档 Boss 打它的胜率不低于 15%（防碾压）；奖励模块必须证明确实有作用 |
| 2026-09-25 | **战斗规则冻结点**：大的战斗机制改动（真双足、反震、各底盘散布差异等）做完、用户宣布冻结之前，不做正式的关卡车生成 |
| 2026-09-25 | **记录不能塞满硬盘**：存储上限见 `docs/evolve-plan.md` §12 |
| 2026-09-26 | **战役方向探索稿**见 `docs/campaign-direction.md`：每章一个主题、克制链、第四章 Boss 后开放大部分装备、第五章主要放唯一件。**探索稿随时会改，实现要数据驱动** |
| 2026-09-26 | **修理费按部件设比例**：越复杂精密越贵（甲片便宜、水箱低、铲斗 1/8、蒸汽撞锤 1/5、驾驶舱和锅炉昂贵），替换统一的 1/20 |
| 2026-09-26 | **唯一件可以有多件**，任何模块都能被标成唯一件；双足唯一件散布在 T3～T5 的高级精英或 Boss 身上 |
| 2026-09-26 | **支线**：第二章起可以打竞技场外的遭遇战，没有观众和声望，奖励特殊件 / 唯一件 |
| 2026-09-26 | **友谊赛合并**：已击败的对手（主线和支线）可以重打，没有奖励也没有损失；不再有独立的友谊赛 |
| 2026-09-26 | **第四章主题按下不表**，等前几章做出来、测试充分再定 |
| 2026-09-26 | **四足整件可以多件首尾相连**（车体蜈蚣）：同一行里一件接一件，中间不能隔空（隔空的标红）；不能和别的底盘混用。修正此前「每车一个」的说法 |
| 2026-09-26 | **真双足底盘固定 1 大格宽 × 2 层**（= 2×4 子格，48×96，同 `tools/chassis-lab.html` 样机）：上一层是胯、下一层是腿区；不做可变宽度。旧存档里的多格双足只保留一格作胯，其余退回库存。数据和规则由 astra 改（见 `docs/board-astra.md`） |
| 更早 | 其余已定事项见 `docs/module-plan.md` §0 和 `docs/game-design.md` |

## 6. 看板入口

- [astra 后台看板](board-astra.md)：后台进度、待定项、astra 发起的交接请求，以及发给 astra 的用户任务。
- [Opus 视觉看板](board-opus.md)：视觉进度、Opus 发起的交接请求，以及发给 Opus 的用户任务。
- 两份看板各自维护；跨角色请求写在发起者的看板，对方读取处理。只追加记录，完成后更新状态与提交号，不删别人的记录。
