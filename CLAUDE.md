# 开发规则（Claude Code / Opus）

个人项目，流程从简。**开工前先读 [`docs/collab.md`](docs/collab.md)**：角色分工、文件归属、Git 流程、已定的决定、待定项、交接板和工作清单都在那里。它和本文件冲突时，以它为准。

## 本角色

- Opus 负责**视觉、动画、特效、UX、界面布局与交互**（`docs/collab.md` §1、§2）。
- 拆分后的 battle-view.js、module-art.js、camp-ui.js 以及 `js/sprites.js`、`js/legs.js` 属于 Opus；四足相关画面以最新 origin/main 为准。
- 不改数值、规则、AI、存档格式；需要这些时写到 `docs/collab.md` §7 交接板。
- 用户明确让 Opus 做后台任务时，照做，但仍按 `docs/collab.md` 的 Git 规则和提交前缀。

## Git（摘要，完整版见 `docs/collab.md` §3）

1. 只用 `main`，不开分支、不开 PR。
2. 开工和提交前都 `git pull --rebase origin main`；每次提交都立即推送到 `origin/main`（本机开发也推送）。
3. 提交前缀：`vis:` 视觉、`sys:` 后台、`doc:` 文档。只 `git add` 自己改的文件。
4. 不 force push，不改写已推送的历史。

## 项目

- 纯 HTML/CSS/JS，无构建步骤、无依赖。运行与代码结构见 `README.md`。
- 本地预览：`python tools/serve.py`（禁缓存；用 `python -m http.server 5173` 时浏览器可能缓存旧 JS，需 Ctrl+F5），打开 http://localhost:5173 。控制台 `SA.reset()` 清空存档，`SA.BUILD` 看当前加载的版本。
- 每次提交改到画面时，更新 `js/build-vis.js`；后台标记由 `js/build-sys.js` 维护，`js/main.js` 只拼接两者。

## HTML5 游戏自动化测试

- 遇到 HTML5 游戏的快速操作、状态读取、战役 / AI 模拟、回归验证或批量动作时，优先调用项目根目录 `.mcp.json` 注册的 `html5-game` MCP；它连接同一个 `tools/html5_game_mcp.py`，不要逐帧重复点击等待。
- 蒸汽竞技场优先使用 `steam_arena_simulate`；其他游戏使用页面的 `window.__HTML5_GAME_MCP__` 适配器配合 `game_step`、`game_action`、`game_state`。用 `/mcp` 或 `claude mcp list` 检查 Claude Code 的连接状态。
