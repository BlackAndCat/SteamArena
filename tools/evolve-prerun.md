# K8 全战役进化预演

参数：seed=20260927，章节=6，候选=68；population.size=4、generations=1、quickGames=1、archiveGames=2。

|章节|关卡|选车|地形|毒瘤|奇特|未达标|
|---:|---|---|---|---:|---:|---|
|1|破铜烂铁号|进化候选·1-1-58175|flat|0|1|—|
|1|锈钉子号|进化候选·1-2-60816|flat|0|1|—|
|2|铁皮罐头|进化候选·1-1-58175·变异30449·变异37728|crates|0|1|target,terrain|
|2|双管哨兵|进化候选·2-2-11926|flat|0|1|target|
|2|煤灰寡妇|进化候选·2-3-75557|crates|0|1|target,terrain,bossGeneric|
|3|推土机|进化候选·3-1-75107|mud|0|1|terrain,rewardLowerBound|
|3|独角兽|保底候选·3-2|flat|0|1|target|
|3|码头齐射|保底候选·3-3|mud|0|1|—|
|4|烟囱|保底候选·4-1|yard|0|1|terrain,rewardLowerBound|
|4|齐射|保底候选·4-1·变异27680|hills|0|1|target,terrain,rewardLowerBound|
|4|工厂缠斗王|保底候选·4-3|hills|0|1|target,previousBoss|
|5|矿车|进化候选·5-1-54332|mine|0|1|target,rewardCrushGuard|
|5|夜枭|进化候选·5-2-8595|hills|0|1|target,rewardContrast|
|5|铁甲圣堂|保底候选·5-3|mine|0|1|previousBoss|
|6|差分机|保底候选·5-3·变异77944|crates|0|1|terrain|
|6|煤灰寡妇 · 复仇|保底候选·6-2|yard|0|1|—|
|6|维多利亚女王号|保底候选·6-3|flat|0|1|previousBoss|

## 统计

- 选关失败记录：13；毒瘤候选累计 0，奇特构筑累计 17。
- 这是预演，不应用到 js/content.js，也不使用 --generate 严格替换关卡车。