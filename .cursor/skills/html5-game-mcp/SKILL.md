---
name: html5-game-mcp
description: 在本工作空间开发或测试蒸汽竞技场及其他 HTML5 游戏时，凡需快速操作、状态读取、战役或 AI 模拟、回归验证、性能测试或批量动作，优先使用 tools/html5_game_mcp.py 连接本地 Chrome DevTools Protocol，减少逐帧等待；不适用于视觉设计或生产部署。
---

# HTML5 游戏高速测试

当任务涉及浏览器游戏的快速测试或自动操作时，先确认客户端是否已经注册本工作空间的 `html5-game-mcp` MCP。已注册就直接使用它暴露的工具；未注册时，按 [docs/html5-game-mcp.md](../../../docs/html5-game-mcp.md) 启动 `python tools/html5_game_mcp.py`，并按客户端的 MCP 配置方式加载它。

开工前仍需遵守 [docs/collab.md](../../../docs/collab.md) 的角色和文件归属。这个技能只决定测试和操作路径，不扩大代码修改范围；视觉、CSS、布局和交互文件仍交给 Opus。

## 推荐调用顺序

1. 调用 `start_server` 启动项目静态服务器（其他游戏已有服务器时跳过）。
2. 调用 `start_browser` 打开目标页面，测试阶段默认使用无头 Chrome。
3. 调用 `list_tabs` 找到目标页面并复用同一个 `tab_id`。
4. 测试结束后保留可复现的工具参数和关键返回状态。

## 工具选择

- 蒸汽竞技场战役、数值平衡和 AI 回归：优先 `steam_arena_simulate`，一次传入 `repeat` 批量运行，不要逐局点击页面。
- 页面注册了 `window.__HTML5_GAME_MCP__` 适配器：用 `game_step`、`game_action`、`game_state` 批量推进、执行动作和读取状态。
- 需要自定义检查或组合多个动作：用一次 `eval` 合并脚本，减少 CDP 往返。
- 只有必须模拟真实玩家输入时才用 `key` 或 `click`；读取或修改页面状态优先使用脚本和适配器。

其他 HTML5 游戏可在页面初始化以下约定，之后沿用通用工具：

```js
window.__HTML5_GAME_MCP__ = {
  step(seconds) { /* 用固定步长推进游戏 */ },
  state() { return { score: window.game.score, done: window.game.done }; },
  action(name, payload) { /* 执行动作并返回结果 */ }
};
```

不要把远程调试端口暴露到公网。全程使用中文沟通和注释；发现 MCP 不可用、页面适配器缺失或后台与视觉文件发生冲突时，先报告具体阻塞点，再选择安全的替代测试路径。
