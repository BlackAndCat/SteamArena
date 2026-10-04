// AI 行为验收与同车公平对照。
// 评级只反映下列四种固定合法构筑、四个旧风格和两个种子的样本，不作为正式战役车生成依据。
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const evolve = require(path.join(root, 'tools/evolve'));
// 行为夹具中的实弹轨迹固定种子，模拟对照另用 simulate(seed) 的独立随机源。
const originalRandom = Math.random;
let fixtureSeed = 71329;
Math.random = () => ((fixtureSeed = (fixtureSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
const { SA } = evolve.loadGame();
Math.random = originalRandom;
const IDS = ['rookie', 'clumsy', 'misjudge', 'hesitant', 'wander', 'turtle', 'rush', 'kite', 'sniper', 'assassin', 'evade', 'counter', 'burst', 'disruptor', 'veteran'];
const REFS = ['wander', 'rush', 'kite', 'turtle'];

function fixture(chapter, stage, weapon) {
  // 使用当前已存在的出战车；计划中的 T3 尚无正式车辆，不能伪称为 T3 样本。
  const source = evolve.stageFor(SA, chapter, stage)?.vehicle;
  assert(source, `${weapon} 缺少关卡车`);
  const vehicle = JSON.parse(JSON.stringify(source));
  const stats = SA.V.stats(vehicle);
  assert(stats.canDeploy && !stats.blocked?.length, `${weapon} 不可合法出战`);
  let found = false;
  SA.V.each(vehicle, cell => { if (cell.id === weapon) found = true; });
  assert(found, `${weapon} 夹具未装指定武器`);
  assert(stats.dps > 0 || stats.rams > 0, `${weapon} 无火力`);
  return vehicle;
}

// 直接走真实战斗状态更新；夹具只控制开局车辆和少数触发条件。
function state(style, player, enemy = player) {
  SA.S.d.vehicle = player;
  return SA.Battle.startState({ enemyVehicle: enemy, enemyName: '验收目标', style, terrain: 'flat' });
}
function tick(n = 1) { SA.Battle.debug.step(n / 60); return SA.Battle.debug.B; }
function targetId(side, target) { return target && side.v[target.layer]?.[target.r]?.[target.c]?.id; }
function firstCell(side, predicate) {
  let out = null;
  SA.V.each(side.v, (cell, r, c, layer) => { if (!out && cell.hp > 0 && predicate(cell, layer)) out = { cell, r, c, layer }; });
  return out;
}
function resetTarget(side) { side.target = null; side.retarget = 0; }

function behavior() {
  SA.S.load();
  SA.go = () => {};
  const direct = fixture(1, 3, 'cannon_m');
  const rapid = fixture(1, 1, 'mg_s');
  const priority = fixture(0, 0, 'mg_s');
  assert.deepEqual([...SA.Battle.aiStyles.map(x => x.id)].sort(), [...IDS].sort(), '风格接口');
  for (const id of ['rookie', 'clumsy', 'misjudge', 'hesitant'])
    assert.equal(SA.Battle.aiStyles.find(x => x.id === id)?.training, true, `${id} 应只用于教学或特殊场景`);
  for (const id of IDS) {
    assert.equal(SA.Battle.normalizeAiStyle(id), id);
    const B = state(id, direct);
    tick();
    assert(B.e.target && B.e.target.layer && targetId(B.p, B.e.target), `${id} 未选存活目标`);
    assert(Number.isFinite(B.e.dir) && typeof B.e.fireHeld === 'boolean', `${id} 未产生有效控制`);
  }
  for (const old of REFS) assert.equal(SA.Battle.normalizeAiStyle(old), old, `旧标识 ${old}`);
  assert.equal(SA.Battle.normalizeAiStyle('不存在的风格'), 'wander', '未知标识必须安全回退');
  state('不存在的风格', direct); tick();

  for (const [style, predicate] of [
    ['sniper', id => !!SA.MODULES[id].dmg],
    ['assassin', id => SA.isCockpit(id)],
    ['disruptor', id => !!SA.MODULES[id].supply],
  ]) {
    const B = state(style, priority);
    tick();
    assert(predicate(targetId(B.p, B.e.target)), `${style} 目标类别错误`);
    const old = B.p.v[B.e.target.layer][B.e.target.r][B.e.target.c];
    old.hp = 0;
    resetTarget(B.e); tick();
    assert(B.e.target && targetId(B.p, B.e.target) !== old.id || B.e.target && B.p.v[B.e.target.layer][B.e.target.r][B.e.target.c] !== old,
      `${style} 未切换已毁目标`);
  }

  // 侧挂目标的类别检查只改目标车夹具：用现有关卡车侧挂槽替换为侧炮，不参加合法构筑评级。
  {
    const sideVehicle = evolve.stageFor(SA, 1, 2).vehicle;
    let replaced = false;
    SA.V.each(sideVehicle, (cell, r, c, layer) => {
      if (layer === 'side' && !replaced) { sideVehicle.side[r][c] = SA.newCell('side_cannon', 1); replaced = true; }
    });
    assert(replaced, '缺少侧挂夹具');
    const B = state('sniper', sideVehicle);
    SA.V.each(B.p.v, (cell, r, c, layer) => { if (layer === 'body' && SA.MODULES[cell.id].dmg) cell.hp = 0; });
    tick();
    assert.equal(B.e.target?.layer, 'side', '侧挂炮应按存活武器分类');
  }

  // 已飞出且朝向本车的近弹才应触发规避；延迟弹不提供预知信息。
  {
    const B = state('evade', rapid);
    tick();
    const before = B.e.evadeUntil || 0;
    const x = B.e.x - 50, y = 500;
    const shot = { from: B.p, to: B.e, x, y, vx: 300, vy: 0, g: 0, delay: 1, done: false };
    B.shots.push(shot); tick();
    assert.equal(B.e.evadeUntil || 0, before, '规避不应读取尚未发射的延迟弹');
    shot.delay = 0; tick();
    assert(B.e.evadeReact > 0 || B.e.evadeUntil > B.t, '来弹后未开始有限延迟规避');
    B.shots.length = 0; tick(35);
    assert(B.e.evadeUntil > B.t, '看到来弹后动作未保持');
  }
  // 从真实火炮取出已发射弹道，复制到同位置的普通与规避车；寻找一条规避后实损下降的轨迹。
  {
    const launch = state('wander', direct);
    launch.p.isAI = true; launch.p.style = 'wander';
    launch.e.x += 220; launch.e.moveT = 100; launch.e.goalX = launch.e.x;
    const samples = [], seen = new Set();
    for (let i = 0; i < 1800 && !launch.done && samples.length < 3; i++) {
      tick();
      for (const sh of launch.shots) if (sh.from === launch.p && !seen.has(sh)) {
        seen.add(sh);
        samples.push({ shot: { ...sh }, px: launch.p.x, ex: launch.e.x, pv: launch.p.vx, ev: launch.e.vx });
      }
    }
    assert.equal(samples.length, 3, '未取得固定的第三发真实炮弹');
    const replay = (style, sample, shift) => {
      const B = state(style, direct);
      B.p.x = sample.px; B.p.vx = sample.pv; B.e.x = sample.ex + shift; B.e.vx = sample.ev;
      B.e.moveT = 100; B.e.goalX = B.e.x;
      B.shots.push({ ...sample.shot, from: B.p, to: B.e, trail: [] });
      let dodged = false;
      for (let i = 0; i < 100 && !B.done; i++) { tick(); dodged ||= B.e.evadeUntil > B.t; }
      return { damage: B.e.taken, dodged };
    };
    // 固定第三发与+164px的位置：普通车确实受击，规避车刹停/换向后损伤应下降。
    const plain = replay('wander', samples[2], 164), dodge = replay('evade', samples[2], 164);
    assert(plain.damage > 0, '固定轨迹的普通车未受击');
    assert(dodge.dodged && dodge.damage + 0.01 < plain.damage, `固定真实来弹规避无效：${plain.damage}→${dodge.damage}`);
  }

  // 对方装填时间即使改变也不等于观察到发射；真实发射时间戳才触发反击。
  {
    const B = state('counter', direct);
    tick();
    B.p.timers[B.p.weapons[0].key] = 4;
    B.e.x = B.p.x + 270;
    B.e.moveT = 3;
    tick();
    const before = B.e.dir;
    B.p.lastMainFireAt = B.t - 0.5;
    tick();
    assert.equal(B.e.dir, -1, '反击应响应已经发生的发射并进攻');
    assert(before !== B.e.dir || before !== -1, '装填状态不应提前触发同一进攻');
  }
  // 双驾驶员车的强炮由副驾驶发射：观察信号必须来自真实发射而非当前选中组或装填表。
  {
    const dual = JSON.parse(JSON.stringify(rapid));
    dual.body[8][9] = SA.newCell('cannon_s', 1);
    assert(SA.V.stats(dual).canDeploy && SA.V.stats(dual).drivers >= 2, '反击双武器夹具无效');
    const B = state('counter', dual);
    B.p.sel = 'mg_s'; B.p.timers = { ...B.p.timers };
    const highest = B.p.weapons.slice().sort((a, b) => (b.m.dmg || 0) / Math.max(0.4, b.m.reload || 1) - (a.m.dmg || 0) / Math.max(0.4, a.m.reload || 1))[0];
    assert.equal(highest.cell.id, 'cannon_s', '反击夹具最高威胁武器不再是副驾驶强炮');
    B.p.timers[B.p.weapons.find(w => w.cell.id === 'cannon_s').key] = 0;
    B.p.fireHeld = false; B.e.moveT = 100; B.e.goalX = B.e.x;
    tick();
    assert.equal(B.p.lastMainFireAt, undefined, '未发射不得产生主威胁观测');
    B.p.timers[B.p.weapons.find(w => w.cell.id === 'cannon_s').key] = 0.4;
    tick();
    assert.equal(B.p.lastMainFireAt, undefined, '仅改变剩余装填不得触发反击');
    let fired = false;
    for (let i = 0; i < 240 && !B.done; i++) {
      tick();
      if (B.p.lastMainFireAt != null) { fired = true; break; }
    }
    assert(fired && B.p.sel === 'mg_s', '未记录副驾驶强炮的真实发射');
    assert(B.p.lastMainReload > 0, '未记录已观察武器的装填周期');
    tick(20);
    assert.equal(B.e.dir, -1, '观察到副驾驶强炮发射后未利用空当推进');
  }

  {
    const B = state('burst', direct);
    tick();
    assert.equal(B.e.burst.phase, 'burst', '全部就绪后应进入爆发');
    B.e.burst.until = B.t - 1;
    tick();
    assert.equal(B.e.burst.phase, 'cool', '爆发后应冷却');
    assert.equal(B.e.fireHeld, false, '冷却时应停火');
    B.e.burst.until = B.t - 1;
    tick();
    assert.equal(B.e.burst.phase, 'ready', '冷却后应恢复准备');
  }
  {
    const B = state('burst', rapid);
    let cooled = false, before = 0, resumed = false;
    for (let i = 0; i < 1200 && !B.done; i++) {
      tick();
      if (B.e.burst?.phase === 'cool' && !cooled) { cooled = true; before = B.e.events.fire; }
      if (cooled && B.e.events.fire > before) { resumed = true; break; }
    }
    assert(cooled && resumed, '爆发冷却后未恢复真实发射');
  }
  {
    const B = state('disruptor', priority);
    tick();
    const boiler = firstCell(B.p, cell => !!SA.MODULES[cell.id].supply);
    assert(boiler, '动力猎手夹具缺少锅炉');
    assert.equal(B.p.v[B.e.target.layer][B.e.target.r][B.e.target.c], boiler.cell, '断供前没有锁定待毁锅炉');
    SA.Battle.debug.damage('p', boiler.r, boiler.c, boiler.layer, 100000);
    assert.equal(B.p.supply, 0, '锅炉损毁后动力未失去');
    resetTarget(B.e); tick();
    assert(B.e.target && B.p.v[B.e.target.layer][B.e.target.r][B.e.target.c].hp > 0 && !SA.MODULES[targetId(B.p, B.e.target)].supply, '动力已毁后仍盲打锅炉');
  }

  // 老将夹具分别覆盖领先、落后和临近超时，使用真实已造成伤害与耐久状态。
  {
    const B = state('veteran', direct);
    tick();
    B.e.x = B.p.x + 600; B.e.moveT = 3;
    B.e.dealt = B.p.startHp * 0.5; B.p.dealt = 0;
    tick(); const leading = B.e.dir;
    B.e.dealt = 0; B.p.dealt = B.e.startHp * 0.5;
    tick(); const trailing = B.e.dir;
    assert.notEqual(leading, trailing, '老将领先和落后的机动应不同');
    B.e.dealt = B.p.startHp * 0.5; B.p.dealt = 0;
    B.t = SA.K.BATTLE_TIME - 10;
    tick();
    assert.equal(B.e.dir, -1, '临近超时应主动推进');
  }
  for (const [id, field, phases] of [
    ['clumsy', 'clumsy', [true, false]],
    ['misjudge', 'misjudge', [0, 1, 2]],
    ['hesitant', 'hesitant', [true, false]],
  ]) {
    const B = state(id, rapid);
    const seen = new Set();
    const directions = new Map();
    for (let i = 0; i < 80 && !B.done; i++) {
      tick(6);
      const value = id === 'clumsy' ? B.e.clumsy?.firing : id === 'misjudge' ? B.e.misjudge?.phase : B.e.hesitant?.acting;
      if (value !== undefined) {
        seen.add(value);
        directions.set(value, B.e.dir);
        if (id === 'clumsy' && value === false) assert.equal(B.e.fireHeld, false, '武器生疏的停火阶段应松开扳机');
        if (id === 'hesitant' && value === false) {
          assert.equal(B.e.fireHeld, false, '迟疑阶段应停火');
          assert.equal(B.e.dir, 0, '迟疑阶段应停驶');
        }
      }
    }
    for (const phase of phases) assert(seen.has(phase), `${id} 缺少可观察的阶段 ${phase}`);
    if (id === 'misjudge') assert.notEqual(directions.get(0), directions.get(1), '距离失准应出现相反的贴近/后退选择');
  }
  // 故意较弱的驾驶员仍须参与战斗，且各自应表现出开火、距离或决策上的可观察缺点。
  for (const id of ['clumsy', 'misjudge', 'hesitant']) {
    const r = SA.Battle.simulate({ p: rapid, e: rapid, pStyle: id, eStyle: 'wander', terrain: 'flat', seed: 24013 });
    assert((r.events.p.fire || 0) > 0 && (r.events.e.fire || 0) > 0, `${id} 应实际开火`);
    assert(Number.isFinite(r.pDealt) && Number.isFinite(r.metrics.distanceSum), `${id} 应完成真实战斗`);
  }
  // 可选计数不得抽新随机数或改变胜负；同种子重复必须连事件和终态完全一致。
  for (const id of IDS) {
    const args = { p: rapid, e: rapid, pStyle: id, eStyle: 'wander', terrain: 'flat', seed: 4242 };
    const first = SA.Battle.simulate(args), second = SA.Battle.simulate(args);
    assert.deepEqual(first, second, `${id} 固定种子结果不确定`);
    const measured = SA.Battle.simulate({ ...args, aiStats: true });
    const { aiStats, ...plain } = measured;
    assert(aiStats?.p && aiStats?.e, `${id} 缺少可选 AI 统计`);
    assert.equal(JSON.stringify(plain), JSON.stringify(first), `${id} 可选 AI 统计改变战斗结果`);
  }
  console.log('行为验收通过：15 风格、兼容、存活目标、侧挂、规避、反击、爆发、老将');
}

function benchmark(quick) {
  // 序章铲斗车补一门合法小机枪，保留真实近战能力并避免纯近战镜像局全部平手。
  const mixed = fixture(0, 2, 'bucket');
  assert(SA.V.place(mixed, 'mg_s', 7, 8).ok && SA.V.stats(mixed).canDeploy && SA.V.stats(mixed).rams > 0 && SA.V.stats(mixed).dps > 0, '近战混合车不可合法出战');
  const builds = [
    ['T2 双速射', fixture(1, 1, 'mg_s')],
    ['T2 直射', fixture(1, 3, 'cannon_m')],
    ['T2 高抛', fixture(1, 0, 'mortar_s')],
    ['T1 近战混合', mixed],
  ];
  const seeds = quick ? [24013] : [24013, 91771];
  const active = quick ? builds.slice(0, 1) : builds;
  const engagement = Object.fromEntries(active.map(([name]) => [name, 0]));
  const report = [];
  for (const style of IDS) {
    const rows = [];
    for (const [name, car] of active) {
      const tally = { name, win: 0, draw: 0, loss: 0, time: 0, timeout: 0, noEngage: 0, fire: 0, hit: 0, games: 0 };
      for (const ref of REFS) for (const seed of seeds) for (const swapped of [false, true]) {
        const r = SA.Battle.simulate({ p: car, e: car, pStyle: swapped ? ref : style, eStyle: swapped ? style : ref,
          terrain: 'flat', seed: seed + REFS.indexOf(ref) * 1009 + active.findIndex(x => x[0] === name) * 101 });
        assert(['p', 'e', 'draw'].includes(r.winner) && Number.isFinite(r.t) && Number.isFinite(r.pDealt) && Number.isFinite(r.eDealt), `${style}/${name} 模拟无效`);
        if (r.pDealt + r.eDealt > 0 || (r.events?.p?.ram || 0) + (r.events?.e?.ram || 0) > 0) engagement[name]++;
        else tally.noEngage++;
        const outcome = swapped ? r.winner === 'p' ? 'loss' : r.winner === 'e' ? 'win' : 'draw' : r.winner === 'p' ? 'win' : r.winner === 'e' ? 'loss' : 'draw';
        tally[outcome]++; tally.games++; tally.time += r.t;
        tally.fire += r.events?.[swapped ? 'e' : 'p']?.fire || 0;
        tally.hit += r.events?.[swapped ? 'e' : 'p']?.hit || 0;
        if (r.timeout || /超时/.test(r.reason || '')) tally.timeout++;
      }
      tally.winRate = +(100 * (tally.win + tally.draw / 2) / tally.games).toFixed(1);
      tally.avgTime = +(tally.time / tally.games).toFixed(1);
      tally.timeoutRate = +(100 * tally.timeout / tally.games).toFixed(1);
      tally.noEngageRate = +(100 * tally.noEngage / tally.games).toFixed(1);
      tally.avgFire = +(tally.fire / tally.games).toFixed(1);
      tally.avgHit = +(tally.hit / tally.games).toFixed(1);
      delete tally.time;
      rows.push(tally);
    }
    const total = rows.reduce((a, b) => { for (const k of ['win', 'draw', 'loss', 'games', 'timeout', 'noEngage', 'fire', 'hit']) a[k] += b[k]; a.time += b.avgTime * b.games; return a; }, { win: 0, draw: 0, loss: 0, games: 0, timeout: 0, noEngage: 0, fire: 0, hit: 0, time: 0 });
    const winRate = 100 * (total.win + total.draw / 2) / total.games;
    report.push({ style, use: SA.Battle.aiStyles.find(x => x.id === style)?.training ? '教学/特殊' : '常规', win: total.win, draw: total.draw, loss: total.loss, games: total.games,
      winRate: +winRate.toFixed(1), avgTime: +(total.time / total.games).toFixed(1), timeoutRate: +(100 * total.timeout / total.games).toFixed(1),
      noEngage: total.noEngage, noEngageRate: +(100 * total.noEngage / total.games).toFixed(1),
      avgFire: +(total.fire / total.games).toFixed(1), avgHit: +(total.hit / total.games).toFixed(1),
      suggestedTier: winRate < 40 ? '初级' : winRate < 55 ? '中级' : '高级', builds: rows });
  }
  for (const [name, count] of Object.entries(engagement)) assert(count > 0, `${name} 全组没有交战，不能参与评级`);
  const sha256 = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
  const fixtureHashes = Object.fromEntries(active.map(([name, car]) => [name, createHash('sha256').update(JSON.stringify(car)).digest('hex')]));
  console.log(JSON.stringify({ mode: quick ? 'quick-耗时试跑' : 'benchmark-完整样本', seeds, references: REFS,
    fingerprints: { battle: sha256('js/battle.js'), modules: sha256('js/modules.js'), check: sha256('tools/ai-style-check.js'), fixtures: fixtureHashes }, engagement,
    games: report.reduce((n, x) => n + x.games, 0), report }, null, 2));
}

if (process.argv.includes('--benchmark') || process.argv.includes('--quick')) benchmark(process.argv.includes('--quick'));
else behavior();
