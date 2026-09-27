/* P2 系统健康诊断与贪心经济模拟（只读游戏规则，不修改战斗常数）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame, healthCheck } = require('./evolve');

/** K9 早期近战夹具：固定铲斗车与动力车，统计胜率、用时和结局原因。 */
function k9(SA, games = 20) {
  const bucketSpec = SA.CAMPAIGN[0].stages[1];
  const bucket = SA.V.fromAscii('K9铲斗', bucketSpec.rows, bucketSpec.sides || [], bucketSpec.mt || 1, bucketSpec.elite || [], bucketSpec.subs || []);
  const pairs = [
    ['序章练习车', SA.CAMPAIGN[0].stages[0]],
    ['序章动力车', SA.CAMPAIGN[0].stages[1]],
    ['第一章动力车', SA.CAMPAIGN[1].stages[0]],
  ];
  const results = pairs.map(([name, spec], pi) => {
    const foe = SA.V.fromAscii(name, spec.rows, spec.sides || [], spec.mt || 1, spec.elite || [], spec.subs || []), rows = [];
    for (let i = 0; i < games; i++) rows.push(SA.Battle.simulate({ p: bucket, e: foe, terrain: spec.terrain || 'flat', pStyle: 'rush', eStyle: spec.style || 'rush', seed: 81000 + pi * 1000 + i }));
    return { opponent: name, games, wins: rows.filter(r => r.winner === 'p').length, winRate: rows.filter(r => r.winner === 'p').length / games, avgSeconds: rows.reduce((s, r) => s + (r.t || 0), 0) / games, reasons: rows.reduce((m, r) => { m[r.reason || r.winner] = (m[r.reason || r.winner] || 0) + 1; return m; }, {}) };
  });
  return { games, bucketLegal: !SA.V.issues(bucket).length, pairs: results };
}

/**
 * 现金驱动的贪心经济模拟：每场结算实际战斗遥测的受损比例，
 * 并在现金足够时持续购买性价比最高的模块、材料或改装。
 * 街头赛使用同一战斗模拟，奖金按街头赛档位公式计入收入。
 */
/** 持续玩家车辆的现金经济模拟。每次购买都尝试合法安装到当前车辆。 */
function economy(SA, repairMode = 'current') {
  const rate = (id) => repairMode === 'original' ? 0.05 : SA.repairRate(id);
  let money = 300, fights = 0, bought = 0;
  const player = SA.V.fromAscii('持续玩家车', SA.STARTER.rows, SA.STARTER.sides || [], 1, [], SA.STARTER.subs || []);
  const chapters = [], purchases = [], blockedStages = [], unlocked = new Set(SA.CAMP_START.mods || []);
  const addUnlocks = xs => (xs || []).forEach(id => { if (SA.MODULES[id] && !SA.isUnique(id)) unlocked.add(id); });
  const install = (id, mt = 1) => {
    for (let r = 0; r < SA.K.ROWS; r++) for (let c = 0; c < SA.K.COLS; c++) { const chk = SA.V.canPlace(player, id, r, c); if (chk.ok) { SA.V.place(player, id, r, c, mt); return true; } }
    return false;
  };
  const benefit = id => { const m = SA.MODULES[id] || {}; return 1 + (m.dmg || 0) + (m.dmgPerSec || 0) * 2 + (m.supply || 0) * 2 + (m.cool || 0) * 2 + (m.water || 0) * .2 + (m.hp || 0) * .04 + (m.armor || 0) * 2; };
  const vehicleRepair = (state) => {
    let cost = 0, rows = state && Array.isArray(state.cells) ? state.cells : [];
    if (rows.length) for (const x of rows) { const lost = Math.max(0, (x.max || 0) - (x.hp || 0)); if (lost) cost += Math.ceil(lost / Math.max(1, x.max || 1) * SA.cellValue({ id: x.id, mt: x.mt || 1, lv: x.lv || 0 }) * rate(x.id)); }
    return cost;
  };
  const buy = (chapter) => {
    const opts = [];
    for (const id of unlocked) if (SA.buyPrice(id) > 0 && !SA.isUnique(id)) opts.push({ kind: 'module', id, cost: SA.buyPrice(id), ratio: benefit(id) / SA.buyPrice(id) });
    SA.V.each(player, cell => {
      if ((cell.lv || 0) < SA.K.UP_MAX) { const to = (cell.lv || 0) + 1, cost = SA.upCost(cell.id, to); opts.push({ kind: 'upgrade', id: cell.id, cell, to, cost, ratio: benefit(cell.id) * .25 / Math.max(1, cost) }); }
      const toMt = (cell.mt || 1) + 1;
      if (toMt <= SA.MAT_MAX && toMt <= (SA.CAMPAIGN[chapter - 1]?.unlock?.mat || cell.mt || 1)) { const cost = SA.matUpCost(cell.id, toMt); opts.push({ kind: 'material', id: cell.id, cell, to: toMt, cost, ratio: benefit(cell.id) * .35 / Math.max(1, cost) }); }
    });
    opts.sort((a, b) => b.ratio - a.ratio || a.cost - b.cost || a.id.localeCompare(b.id));
    for (const o of opts) if (o.cost <= money) {
      let ok = false;
      if (o.kind === 'module') ok = install(o.id, SA.minMt(o.id));
      else if (o.kind === 'upgrade') { o.cell.lv = o.to; SA.fixCell(o.cell); ok = true; }
      else { o.cell.mt = o.to; SA.fixCell(o.cell); ok = true; }
      if (!ok) continue;
      money -= o.cost; bought++; purchases.push({ fight: fights, chapter, kind: o.kind, id: o.id, cost: o.cost, money }); return true;
    }
    return false;
  };
  const play = (e, terrain, style, seed) => SA.Battle.simulate({ p: player, e, terrain, pStyle: style, eStyle: 'rush', seed });
  for (let ci = 0; ci < SA.CAMPAIGN.length; ci++) {
    const chapter = ci + 1, stages = SA.CAMPAIGN[ci].stages; let income = 0, repair = 0, buys = 0, streetIncome = 0, wins = 0, streetWins = 0;
    addUnlocks(SA.CAMPAIGN[ci].unlock?.mods);
    for (let si = 0; si < stages.length; si++) {
      const st = stages[si], e = SA.V.fromAscii(st.name, st.rows, st.sides || [], st.mt || 1, st.elite || [], st.subs || []); addUnlocks(st.unlock?.mods);
      fights++; const res = play(e, st.terrain || 'flat', st.style || 'rush', 910000 + fights); const won = res.winner === 'p';
      const cost = vehicleRepair(res.state?.p); repair += cost; money -= cost; if (won) { money += st.prize || 0; income += st.prize || 0; wins++; }
      while (money >= 0 && buy(chapter)) buys++;
      if (!won && money <= 0) blockedStages.push({ chapter, stage: si + 1, fight: fights, money, reason: '战役失败且无现金修理/购买' });
      // 每场战役后尝试一场街头赛；街头战斗同样结算实际战损，但不占战役场数。
      if (SA.Street && typeof SA.Street.offers === 'function') {
        try {
          if (SA.S && SA.S.d) { SA.S.d.vehicle = player; SA.S.d.camp.ch = ci; SA.S.d.camp.mods = [...unlocked]; SA.S.d.camp.feat = [...new Set([...(SA.S.d.camp.feat || []), 'street', 'shop'])]; SA.S.d.camp.mat = Math.max(SA.S.d.camp.mat || 1, st.mt || 1); }
          const offers = SA.Street.offers(true) || [], offer = offers[Math.min(2, ci)] || offers[0];
          if (offer) { const se = SA.Street.vehicleOf(offer); const sr = play(se, offer.terrain || 'flat', 'rush', 930000 + fights); const sc = vehicleRepair(sr.state?.p); money -= sc; if (sr.winner === 'p') { const prize = offer.prize || 0; money += prize; income += prize; streetIncome += prize; streetWins++; } }
        } catch (error) { blockedStages.push({ chapter, stage: si + 1, fight: fights, money: +money.toFixed(2), reason: '街头赛未能生成：' + error.message }); }
      }
    }
    chapters.push({ chapter, fights: stages.length, income, streetIncome, repair: +repair.toFixed(2), repairRate: income ? +(repair / income).toFixed(4) : 0, buys, moneyEnd: +money.toFixed(2), blocked: blockedStages.some(x => x.chapter === chapter), wins, streetWins });
  }
  const intervals = purchases.map((p, i) => i ? p.fight - purchases[i - 1].fight : p.fight);
  const modulePurchases = purchases.filter(p => p.kind === 'module');
  const moduleIntervals = modulePurchases.map((p, i) => i ? p.fight - modulePurchases[i - 1].fight : p.fight);
  return { repairMode, startingMoney: 300, endingMoney: +money.toFixed(2), totalBuys: bought, purchases, intervals, moduleIntervals, chapters, blockedStages, targetEvery2to3: moduleIntervals.length > 0 && moduleIntervals.every(x => x >= 2 && x <= 3) };
}/** 生成 JSON 与 Markdown 报告；输出失败时回退到 tools 根目录。 */
function main() {
  const game = loadGame(), { SA, context } = game;
  // Street 仅作为诊断依赖加载；正式游戏入口仍由 main.js 管理。
  try { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'street.js'), 'utf8'), context, { filename: 'js/street.js' }); SA.S.reset(); } catch (error) { console.error('街头赛诊断加载失败：' + error.message); }
  const health = healthCheck(Number(process.argv[2]) || 8);
  const thresholds = { heatRate: 0.30, timeoutRate: 0.10, drawRate: 0.05, avgSeconds: [30, 60] };
  const recommendation = health.parameterSearch.slice().sort((a, b) => a.distance - b.distance)[0] || null;
  const report = { generatedAt: new Date().toISOString(), rules: health.rules, thresholds, recommendation, health, k9: k9(SA), economy: { highRepair: economy(SA, 'current'), originalRepair: economy(SA, 'original') } };
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  let file = path.join(out, 'health-economy.json');
  try { fs.writeFileSync(file, JSON.stringify(report, null, 2)); } catch (err) { file = path.join(__dirname, 'health-economy.json'); fs.writeFileSync(file, JSON.stringify(report, null, 2)); report.writeFallback = err.code; }
  const md = ['# P2 系统健康与经济模拟', '', `规则指纹：${report.rules}`, '', '## K9 早期近战', '```json', JSON.stringify(report.k9, null, 2), '```', '', '## 健康诊断与参数敏感度', '```json', JSON.stringify(report.health, null, 2), '```', '', '## 贪心玩家经济', '```json', JSON.stringify(report.economy, null, 2), '```', '', '参数仅用于诊断，未修改游戏数值。'];
  try { fs.writeFileSync(path.join(out, 'health-economy.md'), md.join('\n')); } catch { fs.writeFileSync(path.join(__dirname, 'health-economy.md'), md.join('\n')); }
  console.log(JSON.stringify({ file, k9: report.k9, economy: report.economy, health: { outcomes: report.health.outcomes, parameterSearch: report.health.parameterSearch } }, null, 2));
}
if (require.main === module) main();
module.exports = { k9, economy };
