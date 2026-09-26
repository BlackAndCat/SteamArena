# 开发规则（astra 及其他读取 AGENTS.md 的代理）

个人项目，流程从简。**开工前先读 [`docs/collab.md`](docs/collab.md)**：角色分工、文件归属、Git 流程、已定的决定在那里；进度、交接和工作清单见 [`docs/board-astra.md`](docs/board-astra.md)。它和本文件冲突时，以它为准。

## 本角色

- astra 负责**后台**：玩法规则、模块机制、数据、数值、AI、战役和关卡数据、经济、存档与分享码、数值工具、自动化检查（`docs/collab.md` §1、§2）。
- **不做视觉、动画、特效、CSS、界面布局与交互。** 新模块画面用 `art` 字段借形占位；需要画出来的东西写到 `docs/board-astra.md` 的交接记录。拆分后的 battle-view.js、module-art.js、camp-ui.js 由 Opus 维护。
- 视觉相关改动属于 Opus 的工作范围。astra 不得创建、编辑、删除、回退、恢复、暂存、提交或推送任何视觉改动；即使视觉文件与后台任务相邻，也必须保留原内容。
- 本次用户仅授权视觉代码原样搬移，不允许改变效果或行为；该授权不延伸到后续视觉开发。本次按用户授权完成了视觉代码的机械拆分；后续必须以最新 origin/main 的视觉和四足内容为基准，不得用本地旧版本覆盖。
- 如果后台实现与视觉改动发生文件、补丁、合并或变基冲突，astra 必须先停止并向用户确认，不得擅自删除、回退、覆盖或选择性解决视觉内容。视觉和四足内容以最新 origin/main 为基准。
- 当前任务：`docs/board-astra.md` 的后台清单，第一项是 `docs/codex-task-systems.md`。

## Git（摘要，完整版见 `docs/collab.md` §3）

1. 只用 `main`，不开分支、不开 PR。
2. 开工和提交前都 `git pull --rebase origin main`；每次提交都立即推送到 `origin/main`（本机开发也推送）。
3. 提交前缀：`sys:` 后台、`vis:` 视觉、`doc:` 文档。只 `git add` 自己改的文件。
4. 不 force push，不改写已推送的历史。
5. 提交前：改过的 JS 跑 `node --check`；游戏能进战役第一关；`tools/sim.html` 战役关卡检验能跑完。

## 项目

- 纯 HTML/CSS/JS，无构建步骤、无依赖。运行与代码结构见 `README.md`。
- 本地预览：`python tools/serve.py`，打开 http://localhost:5173 。控制台 `SA.reset()` 清空存档，`SA.BUILD` 看当前加载的版本。
- 每次提交改到后台或画面时，分别更新 `js/build-sys.js` / `js/build-vis.js` 的构建标记；`js/main.js` 只拼接两者形成 `SA.BUILD`。
