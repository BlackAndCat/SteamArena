/* P2 系统健康诊断与贪心经济模拟（只读游戏规则，不修改战斗常数）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadGame, healthCheck } = require('./evolve');

/** K9 早期近战夹具：固定铲斗车与动力车，统计胜率、用时和结局原因。 */
function k9(SA, games = 20) {
  const a = SA.CAMPAIGN[0].stages[1];
  const b = SA.CAMPAIGN[1].stages[0];
  const bucket = SA.V.fromAscii('K9铲斗', a.rows, a.sides || [], a.mt || 1, a.elite || [], a.subs || []);
  const power = SA.V.fromAscii('K9动力车', b.rows, b.sides || [], b.mt || 1, b.elite || [], b.subs || []);
  const rows = [];
  for (let i = 0; i < games; i++) rows.push(SA.Battle.simulate({ p: bucket, e: power, terrain: 'flat', pStyle: 'rush', eStyle: 'rush', seed: 81000 + i }));
  return { games, wins: rows.filter(r => r.winner === 'p').length, winRate: rows.filter(r => r.winner === 'p').length / games, avgSeconds: rows.reduce((s, r) => s + (r.t || 0), 0) / games, reasons: rows.reduce((m, r) => { m[r.reason || r.winner] = (m[r.reason || r.winner] || 0) + 1; return m; }, {}) };
}

/**
 * 按章节逐场结算奖金、30% 假定战损修理费，并按单位价格收益比购买模块 / 材料 / 改装。
 * 这是经济压力模型：不替换实际战斗结算，也不改变商店价格，只记录“有钱就买”的贪心路径。
 */
function economy(SA) {
  let money = 300, fights = 0, bought = 0;
  const chapters = [], purchases = [], assets = [];
  const unlocked = new Set(['track', 'boiler', 'water', 'tank_s', 'armor', 'armor_heavy', 'cockpit', 'mg', 'cannon']);
  const baseBenefit = (id) => {
    const m = SA.MODULES[id] || {};
    return (m.power || 0) * 2 + (m.dmg || 0) + (m.dmgPerSec || 0) * 2 + (m.heatToEnemy || 0) * 0.4
      + (m.cool || 0) * 2 + (m.water || 0) * 0.2 + (m.armor || 0) * 2 + (m.hp || 0) * 0.04 + (m.ram || 0) * 0.6 + 1;
  };
  const addUnlocks = (raw) => { for (const id of raw || []) if (SA.MODULES[id] && !SA.isUnique(id)) unlocked.add(id); };
  const tryPurchase = (chapter, reason) => {
    const options = [];
    for (const id of unlocked) {
      if (!assets.some(a => a.id === id)) {
        const cost = SA.buyPrice(id); if (cost > 0) options.push({ kind: 'module', id, cost, ratio: baseBenefit(id) / cost });
      }
    }
    for (const a of assets) {
      const currentMt = a.mt || 1, matMax = Math.min(SA.MAT_MAX, SA.CAMPAIGN[chapter - 1]?.unlock?.mat || currentMt);
      if (currentMt < matMax) { const toMt = currentMt + 1, cost = SA.matUpCost(a.id, toMt); options.push({ kind: 'material', id: a.id, asset: a, toMt, cost, ratio: baseBenefit(a.id) * 0.35 / Math.max(1, cost) }); }
      if ((a.lv || 0) < SA.K.UP_MAX) { const toLv = (a.lv || 0) + 1, cost = SA.upCost(a.id, toLv); options.push({ kind: 'upgrade', id: a.id, asset: a, toLv, cost, ratio: baseBenefit(a.id) * 0.25 / Math.max(1, cost) }); }
    }
    options.sort((a, b) => b.ratio - a.ratio || a.cost - b.cost || a.id.localeCompare(b.id));
    const pick = options.find(x => x.cost <= money);
    if (!pick) return false;
    money -= pick.cost; bought++;
    if (pick.kind === 'module') assets.push({ id: pick.id, mt: SA.minMt(pick.id), lv: 0 });
    else if (pick.kind === 'material') pick.asset.mt = pick.toMt;
    else pick.asset.lv = pick.toLv;
    purchases.push({ fight: fights, chapter, kind: pick.kind, id: pick.id, toMt: pick.toMt || null, toLv: pick.toLv || null, cost: pick.cost, reason, money });
    return true;
  };
  for (let c = 0; c < SA.CAMPAIGN.length; c++) {
    const chapter = c + 1, stages = SA.CAMPAIGN[c].stages; let spentRepair = 0, income = 0, buys = 0, upgrades = 0, blocked = false;
    addUnlocks(SA.CAMPAIGN[c].unlock?.mods);
    for (const st of stages) {
      fights++; addUnlocks(st.unlock?.mods); income += st.prize || 0; money += st.prize || 0;
      const v = SA.V.fromAscii(st.name, st.rows, st.sides || [], st.mt || 1, st.elite || [], st.subs || []);
      let stageRepair = 0;
      SA.V.each(v, (cell) => { const loss = 0.3; stageRepair += Math.ceil(loss * SA.cellValue(cell) * SA.repairRate(cell.id)); });
      spentRepair += stageRepair; money -= stageRepair; if (money < 0) { blocked = true; money = 0; }
      // 贪心：每两场在当前解锁池里买一次，模块、材料和改装按单位价格收益比竞争。
      if (fights % 2 === 0) { const before = bought; tryPurchase(chapter, '每两场购买'); if (bought > before) { buys++; if (purchases[purchases.length - 1].kind !== 'module') upgrades++; } }
    }
    chapters.push({ chapter, fights: stages.length, income, repair: spentRepair, repairRate: income ? spentRepair / income : 0, buys, upgrades, moneyEnd: money, blocked, newThingEvery: buys ? stages.length / buys : null, moneyUnspent: money > 0 && buys === 0 });
  }
  const intervals = purchases.map((p, i) => i ? p.fight - purchases[i - 1].fight : p.fight);
  const modulePurchases = purchases.filter(p => p.kind === 'module');
  const moduleIntervals = modulePurchases.map((p, i) => i ? p.fight - modulePurchases[i - 1].fight : p.fight);
  return { startingMoney: 300, endingMoney: money, totalBuys: bought, owned: assets, purchases, intervals, moduleIntervals, chapters,
    targetEvery2to3: intervals.length > 0 && intervals.every(x => x >= 2 && x <= 3), moduleTargetEvery2to3: moduleIntervals.length > 0 && moduleIntervals.every(x => x >= 2 && x <= 3) };
}

/** 生成 JSON 与 Markdown 报告；输出失败时回退到 tools 根目录。 */
function main() {
  const { SA } = loadGame();
  const health = healthCheck(Number(process.argv[2]) || 8);
  const thresholds = { heatRate: 0.30, timeoutRate: 0.10, drawRate: 0.05, avgSeconds: [30, 60] };
  const recommendation = health.parameterSearch.slice().sort((a, b) => a.distance - b.distance)[0] || null;
  const report = { generatedAt: new Date().toISOString(), rules: health.rules, thresholds, recommendation, health, k9: k9(SA), economy: economy(SA) };
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  let file = path.join(out, 'health-economy.json');
  try { fs.writeFileSync(file, JSON.stringify(report, null, 2)); } catch (err) { file = path.join(__dirname, 'health-economy.json'); fs.writeFileSync(file, JSON.stringify(report, null, 2)); report.writeFallback = err.code; }
  const md = ['# P2 系统健康与经济模拟', '', `规则指纹：${report.rules}`, '', '## K9 早期近战', '```json', JSON.stringify(report.k9, null, 2), '```', '', '## 健康诊断与参数敏感度', '```json', JSON.stringify(report.health, null, 2), '```', '', '## 贪心玩家经济', '```json', JSON.stringify(report.economy, null, 2), '```', '', '参数仅用于诊断，未修改游戏数值。'];
  try { fs.writeFileSync(path.join(out, 'health-economy.md'), md.join('\n')); } catch { fs.writeFileSync(path.join(__dirname, 'health-economy.md'), md.join('\n')); }
  console.log(JSON.stringify({ file, k9: report.k9, economy: report.economy, health: { outcomes: report.health.outcomes, parameterSearch: report.health.parameterSearch } }, null, 2));
}
if (require.main === module) main();
module.exports = { k9, economy };
