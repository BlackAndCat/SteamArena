# K8 全战役进化预演

参数：seed=20260927，章节=6，候选=136；population.size=8、generations=1、quickGames=4、archiveGames=4。
状态：complete（running / interrupted 表示尚未生成完整报告）。

|章节|关卡|选车|地形|毒瘤|奇特|未达标|
|---:|---|---|---|---:|---:|---|
|1|破铜烂铁号|进化候选·1-1-58175|flat|0|1|—|
|1|锈钉子号|进化候选·1-2-47674|flat|0|1|—|
|2|铁皮罐头|保底候选·1-2·变异49457|crates|0|1|terrain|
|2|双管哨兵|进化候选·2-2-42815|flat|0|1|rewardLowerBound,rewardContrast|
|2|煤灰寡妇|进化候选·2-3-24597|crates|0|1|previousBoss|
|3|推土机|保底候选·3-1|mud|0|1|target,rewardLowerBound|
|3|独角兽|保底候选·3-2|flat|0|1|target|
|3|码头齐射|保底候选·3-3|mud|0|1|target,terrain,bossGeneric|
|4|烟囱|保底候选·4-1|yard|1|1|target,terrain,rewardLowerBound|
|4|齐射|进化候选·4-2-30046|hills|0|1|target,terrain,rewardLowerBound|
|4|工厂缠斗王|进化候选·4-3-42307|hills|0|1|target,terrain,bossGeneric,previousBoss|
|5|矿车|进化候选·5-1-34983|mine|0|1|target,terrain,rewardLowerBound|
|5|夜枭|进化候选·5-2-63087|hills|0|1|terrain,rewardLowerBound|
|5|铁甲圣堂|保底候选·5-3|mine|0|1|target,previousBoss|
|6|差分机|保底候选·5-3·变异76419|crates|0|1|target,terrain|
|6|煤灰寡妇 · 复仇|保底候选·6-2|yard|0|1|target|
|6|维多利亚女王号|保底候选·6-3|flat|0|1|previousBoss|

## 统计

- 选关失败记录：15；毒瘤候选累计 1，奇特构筑累计 17。
- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。