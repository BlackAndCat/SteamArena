# astra 后台看板

## 当前状态

- js/battle.js 只负责规则、状态、物理、AI、无画面模拟和镜头状态；js/battle-view.js 消费事件并负责画面。
- js/modules.js 只保留机制与数值；js/module-art.js 承载模块外观字段。
- js/camp.js 保留战役进度和关卡规则；js/camp-ui.js 承载战役界面。存档、经济、摆放和出战校验分别由 state.js、vehicle.js 提供接口。
- js/build-sys.js 和 js/build-vis.js 分别记录后台与视觉基线，js/main.js 只拼接 SA.BUILD。

## 给 Opus 的接口

战斗画面通过 SA.Battle.emit(type, data) 接收以下事件：part、text、boom、ricochet、shatter、surrender。规则层提供事件数据和状态；画面层可以自行决定粒子、文字、镜头表现，但不要改变规则状态或随机流。

镜头的纯状态更新留在 battle.js，因为无画面模拟的炮弹出界判定也读取 B.cam；画面层直接复用该状态。

## 验证

- node tools/split-baseline.js --compare tools/split-baseline.json：272 局固定种子逐帧结果一致。
- node tools/evolve-check.js：战役、41 个模块、分享码、底盘夹具、AI 和战斗常量检查通过。
- 修改规则文件后，按 docs/collab.md §3.5 运行语法检查、战役第一关和 tools/sim.html 检查。
