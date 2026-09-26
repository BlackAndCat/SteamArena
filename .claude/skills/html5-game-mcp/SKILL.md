---
name: html5-game-mcp
description: 在本工作空间开发或测试蒸汽竞技场及其他 HTML5 游戏时，凡需快速操作、状态读取、战役或 AI 模拟、回归验证、性能测试或批量动作，优先使用项目级 html5-game MCP，减少逐帧等待；不适用于视觉设计或生产部署。
---

# HTML5 游戏高速测试

Claude Code 已通过项目根目录 `.mcp.json` 注册 `html5-game`。遇到 HTML5 游戏快速测试或自动操作任务时，优先调用这个 MCP；用 `/mcp` 或 `claude mcp list` 检查连接状态。它与 `tools/html5_game_mcp.py` 是同一个实现，不要另起一套浏览器桥接。

开工前仍需遵守根目录 `CLAUDE.md` 和 `docs/collab.md` 的角色与文件归属。这个技能只决定测试和操作路径，不扩大代码修改范围；视觉、CSS、布局和交互文件仍交给 Opus。

推荐顺序：`start_server` → `start_browser` → `list_tabs`，之后复用同一个 `tab_id`。蒸汽竞技场的战役、数值平衡和 AI 回归优先使用 `steam_arena_simulate` 批量运行；页面注册 `window.__HTML5_GAME_MCP__` 时，使用 `game_step`、`game_action`、`game_state`。只有必须模拟真实玩家输入时才使用 `key` 或 `click`；多个检查尽量合并到一次 `eval`，减少 CDP 往返。

其他 HTML5 游戏可在页面初始化：

```js
window.__HTML5_GAME_MCP__ = {
  step(seconds) { /* 用固定步长推进游戏 */ },
  state() { return { score: window.game.score, done: window.game.done }; },
  action(name, payload) { /* 执行动作并返回结果 */ }
};
```

不要把 Chrome 远程调试端口暴露到公网。全程使用中文沟通和注释；MCP 不可用或与视觉文件发生冲突时，先报告具体阻塞点。
