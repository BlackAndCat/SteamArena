# 通用 HTML5 游戏 MCP

`tools/html5_game_mcp.py` 是零依赖的 stdio JSON-RPC 服务。它直接连接 Chrome DevTools Protocol，适合快速操作蒸汽竞技场，也能复用于其他 HTML5 游戏。服务会关闭后台计时器降频和窗口遮挡降频；`game_step` 优先调用页面提供的 `window.__HTML5_GAME_MCP__.step(seconds)` 或 `SA.Battle.debug.step(seconds)`，否则退回页面内定时器等待。

启动 MCP：

```powershell
python tools/html5_game_mcp.py
```

在支持 MCP 配置文件的客户端中，可用下面的配置注册它（把路径换成实际仓库路径）：

```json
{
  "mcpServers": {
    "html5-game": {
      "type": "stdio",
      "command": "python",
      "args": ["tools/html5_game_mcp.py"],
      "timeout": 600000
    }
  }
}
```

本仓库已经提供 Claude Code 的项目级配置：根目录 `.mcp.json`。进入仓库后可用 `claude mcp list` 检查连接，在交互会话里用 `/mcp` 审批或启用 `html5-game`；`.claude/skills/html5-game-mcp/SKILL.md` 会告诉 Claude Code 何时优先调用它。其他 MCP 客户端可复用上面的同一份 stdio 配置。

常用流程是调用 `start_server`（启动本项目 `tools/serve.py`），再调用 `start_browser`（可传 `url`、`headless`、`port`），从 `list_tabs` 取得 `tab_id`。之后使用 `navigate`、`eval`、`key`、`click`、`game_step` 和 `game_state`。`eval` 支持 Promise，并在单次 CDP 往返中等待结果，适合批量脚本。

其他 HTML5 游戏可以在页面初始化一个很小的适配器，把多步操作合并到一次调用：

```js
window.__HTML5_GAME_MCP__ = {
  step(seconds) { /* 用游戏自己的固定步长推进 */ },
  state() { return { score: window.game.score, done: window.game.done }; },
  action(name, payload) { /* 根据 name 执行动作并返回结果 */ }
};
```

随后用 `game_step`、`game_state`、`game_action` 调用；没有适配器时，`game_step` 会自动使用蒸汽竞技场的 `SA.Battle.debug.step`，再退回普通定时器等待。

蒸汽竞技场可以直接调用 `steam_arena_simulate`：传入 `tab_id`，以及可选的 `campaign_index`、`stage_index`、`repeat`。它在页面上下文用 `SA.V.fromAscii` 构造 STARTER 与战役对手，并重复调用 `SA.Battle.simulate`，返回原始结果数组。例如：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"steam_arena_simulate","arguments":{"tab_id":"页面ID","campaign_index":0,"stage_index":0,"repeat":20}}}
```

也可以用 `eval` 读取调试快照：

```js
SA.Battle.debug && SA.Battle.debug.B
```

这是面向自动化测试的最小实现：只支持 CDP 页面 WebSocket 的文本帧，不提供多浏览器配置、扩展调试或复杂网络拦截；Chrome 必须已安装且允许本机远程调试端口。MCP 进程和浏览器都在本机运行，远程调试端口不要暴露到公网。
