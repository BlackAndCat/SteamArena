# 开发规则

个人项目，流程从简。

## Git

1. **直接在 `main` 上开发**：不要为每个任务新建分支，也不要开 PR。
2. **开发完成后保存**：改完、自测通过后直接在 `main` 上提交（commit）。
   - 在本机开发：提交到本地仓库即可，不需要推送。
   - 在云端会话开发（无法直接写到本机）：提交后推送到 `origin/main`，本机执行 `git pull` 同步。

## 项目

- 纯 HTML/CSS/JS，无构建步骤、无依赖。运行与代码结构见 `README.md`。
- 本地预览：`python tools/serve.py`（禁缓存；用 `python -m http.server 5173` 时浏览器可能缓存旧 JS，需 Ctrl+F5），打开 http://localhost:5173 。控制台 `SA.reset()` 清空存档，`SA.BUILD` 看当前加载的版本。
- 每次提交改到画面/玩法时，顺手把 `js/main.js` 里的 `SA.BUILD` 更新成当天日期 + 简短标签。
