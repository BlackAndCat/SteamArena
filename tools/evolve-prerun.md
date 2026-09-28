# K8 全战役进化预演

参数：seed=20260927，章节=6，候选=136；population.size=24、generations=4、quickGames=6、archiveGames=40。
状态：complete（running / interrupted 表示尚未生成完整报告）。

## 运行数据

- worker：12；候选评估：1632；阶段：17；耗时：20.36 分钟；吞吐：1.34 候选/秒。
- 对局缓存：命中 285、未命中 263、命中率 52.0%，淘汰 0。
- 分段日志：`tools/evolve-progress/evolve-progress.jsonl`；实时检查点：`tools/evolve-progress/evolve-live.json`。

|章节|关卡|选车|地形|毒瘤|奇特|未达标|
|---:|---|---|---|---:|---:|---|
|1|破铜烂铁号|进化候选·1-1-21683|flat|0|2|—|
|1|锈钉子号|进化候选·1-1-58175·变异25907·变异51636·变异53052·变异81358|flat|0|2|—|
|2|铁皮罐头|进化候选·1-1-58175·变异25907·变异51636·变异53052·变异20092·变异83309·变异35776·变异98179·变异11420|crates|0|2|—|
|2|双管哨兵|进化候选·2-2-73332|flat|0|2|target,rewardLowerBound,rewardContrast|
|2|煤灰寡妇|进化候选·2-3-79481·变异59434·变异7416|crates|0|2|previousBoss|
|3|推土机|进化候选·3-1-44260·变异50640·变异21800·变异69269|mud|0|2|rewardLowerBound|
|3|独角兽|保底候选·3-2|flat|0|2|target,rewardLowerBound|
|3|码头齐射|进化候选·3-3-61889|mud|0|2|target,previousBoss|
|4|烟囱|进化候选·4-1-6498|yard|0|2|target,rewardLowerBound|
|4|齐射|进化候选·4-2-28119·变异75607|hills|0|2|target,rewardLowerBound|
|4|工厂缠斗王|进化候选·4-3-91620|hills|0|2|reward,target,previousBoss|
|5|矿车|进化候选·5-1-71891|mine|0|2|rewardLowerBound|
|5|夜枭|进化候选·5-2-89070|hills|0|2|rewardLowerBound,rewardContrast|
|5|铁甲圣堂|进化候选·5-3-45530|mine|0|2|target,terrain,bossGeneric,previousBoss|
|6|差分机|进化候选·6-1-17622·变异90618|crates|0|2|terrain|
|6|煤灰寡妇 · 复仇|进化候选·6-2-33076|yard|0|2|previousBoss|
|6|维多利亚女王号|进化候选·6-3-80716|flat|0|2|previousBoss|

## 统计

- 选关失败记录：14；毒瘤候选累计 0，奇特构筑累计 34。
- 未达标原因计数：target=7，rewardLowerBound=7，rewardContrast=2，previousBoss=6，reward=1，terrain=2，bossGeneric=1。
- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。