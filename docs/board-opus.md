# Opus 视觉看板

## 当前基线

- js/battle-view.js、js/module-art.js、js/camp-ui.js 是视觉 / 界面层；本次拆分只搬移原有画面行为。
- 四足和双足视觉以最新 origin/main 为准。提交前先 pull，保留远端四足整件、首尾相连、接地点和倒车步态改动。
- 当前视觉构建标记在 js/build-vis.js：2026-09-26 quad-gait。

## 后续修改边界

- 战斗画面消费 SA.Battle.emit 的 part、text、boom、ricochet、shatter、surrender 事件。
- 规则、数值、AI、存档和分享码通过 SA.Camp、SA.S、SA.V 等接口取得；需要规则变更时写入 docs/collab.md §7。
- 可以直接修改 battle-view.js、module-art.js、camp-ui.js 以及 Opus 负责的精灵、腿和 CSS 文件；不要把视觉字段或四足远端基线合并回后台文件。
