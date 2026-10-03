# K8 全战役进化预演

参数：seed=20260927，章节=2，候选=40；population.size=24、generations=4、quickGames=6、archiveGames=40。
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

## 统计

- 选关失败记录：2；毒瘤候选累计 0，奇特构筑累计 10。
- 未达标原因计数：target=1，rewardLowerBound=1，rewardContrast=1，previousBoss=1。
- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。