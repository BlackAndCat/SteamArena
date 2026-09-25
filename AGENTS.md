# 开发规则（astra 及其他读取 AGENTS.md 的代理）

个人项目，流程从简。**开工前先读 [`docs/collab.md`](docs/collab.md)**：角色分工、文件归属、Git 流程、已定的决定、待定项、交接板和工作清单都在那里。它和本文件冲突时，以它为准。

## 本角色

- astra 负责**后台**：玩法规则、模块机制、数据、数值、AI、战役和关卡数据、经济、存档与分享码、数值工具、自动化检查（`docs/collab.md` §1、§2）。
- **不做视觉、动画、特效、CSS、界面布局与交互。** 新模块画面用 `art` 字段借形占位；需要画出来的东西写到 `docs/collab.md` §7 交接板。
- 当前任务：`docs/collab.md` §8 的 astra 清单，第一项是 `docs/codex-task-systems.md`。

## Git（摘要，完整版见 `docs/collab.md` §3）

1. 只用 `main`，不开分支、不开 PR。
2. 开工和提交前都 `git pull --rebase origin main`；每次提交都立即推送到 `origin/main`（本机开发也推送）。
3. 提交前缀：`sys:` 后台、`vis:` 视觉、`doc:` 文档。只 `git add` 自己改的文件。
4. 不 force push，不改写已推送的历史。
5. 提交前：改过的 JS 跑 `node --check`；游戏能进战役第一关；`tools/sim.html` 战役关卡检验能跑完。

## 项目

- 纯 HTML/CSS/JS，无构建步骤、无依赖。运行与代码结构见 `README.md`。
- 本地预览：`python tools/serve.py`，打开 http://localhost:5173 。控制台 `SA.reset()` 清空存档，`SA.BUILD` 看当前加载的版本。
- 每次提交改到画面/玩法时，顺手把 `js/main.js` 里的 `SA.BUILD` 更新成当天日期 + 简短标签。
