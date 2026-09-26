/*
 * 拆分前后战斗行为基准。
 *
 * 该工具只调用游戏实际的 SA.V.fromAscii 与 SA.Battle.simulate，不复制战斗规则。
 * 每条记录保留 winner、t、reason 和 events，作为视觉/逻辑拆分后的逐局回归输入。
 *
 * 用法：
 *   node tools/split-baseline.js --write tools/out/split-baseline.json
 *   node tools/split-baseline.js --compare tools/out/split-baseline.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadGame } = require('./evolve');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = path.join(__dirname, 'out', 'split-baseline.json');
const SEEDS = [101, 202, 303, 404];

// 这四台官方车分别覆盖履带、铲斗、四足和双足构型；每关按种子轮换玩家车。
function vehicles(SA) {
  return (SA.OFFICIAL_BLUEPRINTS || []).map((blueprint) => ({
    name: blueprint.name,
    vehicle: SA.V.fromAscii(blueprint.name, blueprint.rows, blueprint.sides || [], blueprint.mt || 1,
      blueprint.elite || [], blueprint.subs || []),
    style: blueprint.style || 'wander',
  }));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function makeBaseline() {
  const SA = loadGame().SA;
  const players = vehicles(SA);
  if (players.length < 4) throw new Error(`官方蓝图不足 4 台，实际为 ${players.length} 台`);
  const rows = [];
  let stageIndex = 0;
  for (let chapter = 0; chapter < SA.CAMPAIGN.length; chapter++) {
    const campaign = SA.CAMPAIGN[chapter];
    for (let stage = 0; stage < campaign.stages.length; stage++, stageIndex++) {
      const entry = campaign.stages[stage];
      const enemy = SA.V.fromAscii(entry.name, entry.rows, entry.sides || [], entry.mt || 1,
        entry.elite || [], entry.subs || []);
      for (let playerType = 0; playerType < players.length; playerType++) {
        const player = players[playerType];
        for (let seedIndex = 0; seedIndex < SEEDS.length; seedIndex++) {
          const seed = SEEDS[seedIndex] + stageIndex * 10000 + playerType * 100 + seedIndex;
          const result = SA.Battle.simulate({
            p: player.vehicle,
            e: enemy,
            pAim: 0.8,
            eAim: Number.isFinite(entry.aim) ? entry.aim : 0.8,
            pStyle: player.style,
            eStyle: entry.style || 'wander',
            eBoss: !!entry.boss,
            terrain: entry.terrain || 'flat',
            seed,
          });
          rows.push({
            chapter,
            stage,
            stageName: entry.name,
            playerType,
            playerName: player.name,
            seed,
            winner: result.winner,
            t: result.t,
            reason: result.reason,
            events: result.events,
          });
        }
      }
    }
  }
  return stable({
    format: 1,
    seeds: SEEDS,
    campaigns: SA.CAMPAIGN.length,
    stages: stageIndex,
    players: players.map((entry) => entry.name),
    games: rows,
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main(argv) {
  const writeAt = argv.indexOf('--write');
  const compareAt = argv.indexOf('--compare');
  const writeFile = writeAt >= 0 ? path.resolve(argv[writeAt + 1] || DEFAULT_FILE) : null;
  const compareFile = compareAt >= 0 ? path.resolve(argv[compareAt + 1] || DEFAULT_FILE) : null;
  const current = makeBaseline();
  if (writeFile) {
    fs.mkdirSync(path.dirname(writeFile), { recursive: true });
    fs.writeFileSync(writeFile, `${JSON.stringify(current, null, 2)}\n`);
  }
  if (compareFile) {
    const expected = stable(readJson(compareFile));
    const actualText = JSON.stringify(current);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
      const first = [...actualText].findIndex((char, i) => char !== expectedText[i]);
      throw new Error(`固定种子结果不一致：首个差异位置 ${first}`);
    }
    console.log(`PASS: ${current.games.length} 局与 ${compareFile} 完全一致`);
  }
  if (!writeFile && !compareFile) console.log(JSON.stringify(current, null, 2));
  if (writeFile) console.log(`已写入 ${writeFile}：${current.games.length} 局`);
  return current;
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { makeBaseline, stable, SEEDS };
