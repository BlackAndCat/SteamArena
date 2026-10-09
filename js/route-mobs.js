// 出征的小机械（docs/expedition-plan.md §12，玩法见 docs/expedition-fun.md）：路上成群的轻量单位，不是整车。
// 冲过去撞碎（车头相对速度够快才碎；慢了会被咬住、被顶住）、开炮打碎、打中炸药桶连锁炸开；碎了掉金属（不占货位，自动飞上车）。
// 这里只管规则：位置、血量、攻击、撞碎判定，由 js/battle.js 每帧调用（只在 B.mobs 存在时，也就是路线数据里有 mobs）。
// 画法：造型在 js/route-art.js（SA.RouteArt.mob），摆放、特效、声音在 js/battle-view.js。随机数一律走战斗的随机源（无画面模拟可复现）。
window.SA = window.SA || {};

SA.RouteMobs = (() => {
  // w / h：碰撞盒（px，底边贴地）；hp；crush：车头相对速度（px/s）到这么快一撞就碎（有撞击件按 RAM_K 倍算）；metal：碎了掉几块金属；
  // slow：撞碎它车速丢掉多少；speed：走 / 爬的速度；wake：车头离它多远时醒过来；其余是各自的攻击
  const KINDS = {
    // 发条步兵：一队排着往前走，离车头 stop 以内停下来举枪齐射（很弱）。一碰就碎，冲过去一排全撞倒
    soldier: { w: 12, h: 24, hp: 5, crush: 10, metal: 1, slow: 0.02, speed: 16, wake: 780, stop: 170,
      fire: { every: 3.2, aim: 0.55, v: 430, g: 90, dmg: 1, range: 560, spread: 14 } },
    // 拾荒爬车：朝车爬过来，贴上车头就用钳子啃最前面的模块；冲得够快一撞就碎，慢了被它咬住（倒一下车再冲）
    crawler: { w: 22, h: 16, hp: 12, crush: 52, metal: 2, slow: 0.08, speed: 30, wake: 640, chew: 2.5 },
    // 滚桶炸弹：等车开近了从坡上放下来，顺坡越滚越快；碰到车就炸。远远一炮打掉最好，打中了会把旁边的机械一起炸掉
    barrel: { w: 16, h: 16, hp: 6, crush: 0, metal: 1, slow: 0, wake: 700, blast: { r: 70, dmg: 14 } },   // dmg：一共多少，按距离分给范围里的模块
    // 步哨炮车：原地不动，隔一会儿高抛一发小炮弹；比较结实，慢了会被它顶住（车头抵着慢慢碾），冲得快或者有撞角能一下撞翻
    sentry: { w: 30, h: 28, hp: 40, crush: 92, metal: 4, slow: 0.3, wake: 800, block: true,
      fire: { every: 3.4, aim: 0.8, v: 360, g: 520, dmg: 6, range: 720, spread: 18 } },
  };
  const RAM_K = 1.7;          // 车头有撞击件（撞角、铲斗……）时，撞碎判定的相对速度按这个倍数算
  const GRIND = 5;            // 被炮车顶住时每吨车重每秒碾掉它多少耐久（有撞击件 ×3）
  const ROLL_G = 360, ROLL_FRICTION = 26, ROLL_MAX = 230;   // 滚桶：坡度加速度、平地摩擦、最高速度（px/s）
  const PASSED = 40;          // 机械在车头后面超过这么远就算被越过去了（双足跳过去），不再碰撞

  let X = null;   // battle.js 提供的引擎接口（见 battle.js 的 mobCtx）
  const live = (B) => (B.mobs || []).filter(m => m.state !== 'dead');
  const gy = (m) => X.groundAt(m.x);

  /** 按路线数据摆好机械：{ kind, x, n?, gap?, release? }；release = 车头到这里时滚桶才放下来 */
  function init(B, def, ctx) {
    X = ctx;
    B.mobs = []; B.mobShots = [];
    B.route.mobGroups = [];
    B.route.metal = 0; B.route.broken = 0;
    for (const g of def.mobs || []) {
      if (def.difficulty && !def.difficulty.teaching) { B.route.mobGroups.push({ ...g }); continue; }
      spawnGroup(B, g);
      if (def.difficulty) B.route.director.spawned += Math.max(1, g.n || 1);
    }
  }
  /** 同类组保持作者的原位置与画面接口；导演只决定是否启用和买得起的数量。 */
  function spawnGroup(B, g) {
      const K = KINDS[g.kind];
      if (!K) return;
      for (let i = 0; i < Math.max(1, g.n || 1); i++)
        B.mobs.push({ id: B.mobs.length, kind: g.kind, x: g.x + i * (g.gap || K.w + 12), vx: 0, hp: K.hp, max: K.hp, state: 'sleep',
          t: X.random() * 3, cd: K.fire ? K.fire.every * (0.25 + 0.75 * X.random()) : 0, aim: 0, acc: 0, release: g.release != null ? g.release : null, flash: 0, roll: 0, fired: 0 });
  }

  /** 炮弹命中测试（只给玩家的炮弹和弹道预览用）：返回机械下标，没打中返回 -1 */
  function hitTest(B, x, y) {
    if (!B.mobs || !X) return -1;
    for (let i = 0; i < B.mobs.length; i++) {
      const m = B.mobs[i];
      if (m.state === 'dead') continue;
      const K = KINDS[m.kind], g = gy(m);
      if (Math.abs(x - m.x) <= K.w / 2 + 2 && y >= g - K.h - 2 && y <= g + 3) return i;
    }
    return -1;
  }

  function kill(B, m, by) {
    if (m.state === 'dead') return;
    const K = KINDS[m.kind];
    m.state = 'dead'; m.hp = 0;
    B.route.metal += K.metal; B.route.broken++;
    X.emit('mob-break', { id: m.id, kind: m.kind, x: m.x, y: gy(m) - K.h / 2, by, metal: K.metal, vx: X.playerVx() });
    if (K.blast) explode(B, m);
  }
  /** 炸药桶炸开：伤到范围里的车模块和别的机械（可以连锁） */
  function explode(B, m) {
    const K = KINDS[m.kind], x = m.x, y = gy(m) - K.h / 2;
    X.emit('mob-blast', { x, y, r: K.blast.r });
    X.emit('boom', { x, y, n: 16 });
    X.hurtArea(x, y, K.blast.r, K.blast.dmg);
    blast(B, x, y, K.blast.r, K.blast.dmg * 2, 'blast');
  }
  function hurt(B, i, dmg, by) {
    const m = B.mobs[i];
    if (!m || m.state === 'dead' || !(dmg > 0)) return;
    m.hp -= dmg; m.flash = 0.12;
    if (m.state === 'sleep') m.state = m.kind === 'barrel' ? 'roll' : 'walk';
    if (m.hp <= 0) kill(B, m, by);
    else X.emit('mob-hit', { id: m.id, kind: m.kind, x: m.x, y: gy(m) - KINDS[m.kind].h / 2 });
  }
  /** 范围伤害（落地的炮弹溅射、炸药桶）：只伤机械，按距离衰减；skip = 已经直接打中的那个 */
  function blast(B, x, y, r, dmg, by, skip = -1) {
    if (!B.mobs || !(r > 0) || !(dmg > 0)) return;
    for (let i = 0; i < B.mobs.length; i++) {
      const m = B.mobs[i];
      if (i === skip || m.state === 'dead') continue;
      const K = KINDS[m.kind], d = Math.hypot(m.x - x, gy(m) - K.h / 2 - y) - K.w / 2;
      if (d <= r) hurt(B, i, dmg * Math.max(0.35, 1 - Math.max(0, d) / r), by);
    }
  }

  // 开枪 / 开炮：直射（小重力）按飞行时间解出初速；高抛按 3/4 的水平速度飞一条弧线。目标是车头那几块模块之一
  function shoot(B, m) {
    const K = KINDS[m.kind], F = K.fire, x0 = m.x - K.w / 2, y0 = gy(m) - K.h + 6;
    const [tx0, ty0] = X.target();
    const tx = tx0 + X.rnd(-F.spread, F.spread), ty = ty0 + X.rnd(-F.spread, F.spread), dx = tx - x0;
    const t = Math.max(0.15, Math.abs(dx) / (F.g > 200 ? F.v * 0.75 : F.v));
    B.mobShots.push({ kind: m.kind, x: x0, y: y0, vx: dx / t, vy: (ty - y0) / t - 0.5 * F.g * t, g: F.g, dmg: F.dmg, life: 4 });
    m.fired = 0.2;
    X.emit('mob-fire', { id: m.id, kind: m.kind, x: x0, y: y0 });
  }

  function step(B, dt) {
    if (!B.mobs || !X) return;
    const p = B.p, front = X.frontEdge(p);
    // 在组进入前方 800px 时一次决定刷或跳过；非蓄势阶段保留空档，不追补已经越过的组。
    for (const group of B.route.mobGroups || []) {
      if (group.decided || group.x - front > 800) continue;
      group.decided = true;
      const d = B.route.director, price = group.price || { soldier: 1, crawler: 2, sentry: 5, barrel: 3 }[group.kind];
      if (d.phase !== 'build' || B.e || group.x < front) continue;
      const n = Math.min(group.n || 1, Math.floor((d.budget - d.spent) / price));
      if (n > 0) { spawnGroup(B, { ...group, n }); d.spent += n * price; d.spawned += n; }
    }
    for (const m of B.mobs) {
      if (m.state === 'dead') continue;
      const K = KINDS[m.kind];
      m.t += dt; m.flash = Math.max(0, m.flash - dt); m.fired = Math.max(0, m.fired - dt);
      const lf = X.lowFront(p, K.h), gap = m.x - K.w / 2 - lf;   // > 0：还在车头前面
      if (m.state === 'sleep') {
        const wake = m.release != null ? front >= m.release : gap < K.wake;
        if (!wake) continue;
        m.state = m.kind === 'barrel' ? 'roll' : 'walk';
      }
      if (p.dead) { m.vx = 0; continue; }
      const passed = m.x + K.w / 2 < lf - PASSED;
      // ---- 行为 ----
      if (m.kind === 'soldier') {
        m.vx = passed || gap > K.stop ? -K.speed : 0;
        if (!passed) aimAndFire(B, m, K, gap, dt);
        if (m.aim > 0) m.vx = 0;
      } else if (m.kind === 'crawler') {
        if (m.state === 'chew') {
          if (gap > 3) m.state = 'walk';   // 车倒开了：松口，接着追
          else {
            m.x = lf + K.w / 2; m.vx = p.vx;
            m.acc += K.chew * dt;
            if (m.acc >= 1) { m.acc -= 1; X.hurtNear(lf - 6, gy(m) - 10, 1); X.emit('mob-chew', { id: m.id, x: lf, y: gy(m) - 8 }); }
          }
        }
        if (m.state === 'walk') m.vx = -K.speed;
      } else if (m.kind === 'barrel') {
        // 往低处滚：右边低就往右加速；平地上摩擦慢慢停下
        const g = (X.groundAt(m.x + 6) - X.groundAt(m.x - 6)) / 12;
        m.vx += ROLL_G * g * dt;
        m.vx -= Math.sign(m.vx) * Math.min(Math.abs(m.vx), ROLL_FRICTION * dt);
        m.vx = Math.max(-ROLL_MAX, Math.min(ROLL_MAX, m.vx));
        m.roll += m.vx * dt;
      } else if (m.kind === 'sentry') {
        m.vx = 0;
        if (!passed) aimAndFire(B, m, K, gap, dt);
      }
      m.x += m.vx * dt;
      // ---- 和车头碰上 ----
      const touch = m.x - K.w / 2 <= lf && !passed;
      if (!touch) continue;
      if (m.kind === 'barrel') { kill(B, m, 'ram'); continue; }
      const impact = (p.vx - m.vx) * (p.rams ? RAM_K : 1);
      if (m.state !== 'chew' && impact >= K.crush) {
        kill(B, m, 'ram');
        p.vx *= 1 - K.slow;
        if (m.kind === 'sentry' && !p.rams) X.hurtNear(lf - 4, gy(m) - 14, 3);   // 没有撞角硬撞炮车，车头也会磕坏一点
        continue;
      }
      if (m.kind === 'crawler' && m.state !== 'chew') { m.state = 'chew'; m.x = lf + K.w / 2; m.acc = 0.6; continue; }
      if (m.kind === 'soldier') { m.x = lf + K.w / 2; continue; }   // 太慢了没撞倒：被车头推着走
      if (K.block) {
        // 炮车顶住车头：车停在它前面，车越重碾得越快
        X.block(p, m.x - K.w / 2);
        const before = m.hp;
        hurt(B, m.id, p.mass * GRIND * (p.rams ? 3 : 1) * dt, 'grind');
        if (m.state !== 'dead' && Math.floor(before / 6) !== Math.floor(m.hp / 6)) X.emit('mob-grind', { id: m.id, x: m.x - K.w / 2, y: gy(m) - K.h / 2 });
      }
    }
    // ---- 机械打出来的子弹 / 小炮弹 ----
    for (const s of B.mobShots) {
      const n = Math.max(1, Math.ceil(dt * 120));
      for (let i = 0; i < n && !s.done; i++) {
        const h = dt / n;
        s.x += s.vx * h; s.y += s.vy * h + s.g * h * h / 2; s.vy += s.g * h; s.life -= h;
        const imp = X.playerAt(s.x, s.y);
        if (imp) { s.done = true; X.hurt(imp, s.dmg); X.emit('mob-shot-hit', { kind: s.kind, x: s.x, y: s.y }); }
        else if (s.y >= X.groundAt(s.x)) { s.done = true; X.emit('mob-shot-ground', { kind: s.kind, x: s.x, y: X.groundAt(s.x) }); }
        else if (s.life <= 0) s.done = true;
      }
    }
    B.mobShots = B.mobShots.filter(s => !s.done);
  }
  // 停下、举枪（aim 秒）、开火；车头在射程外不打
  function aimAndFire(B, m, K, gap, dt) {
    const F = K.fire;
    if (!F) return;
    if (m.aim > 0) { m.aim -= dt; if (m.aim <= 0) { shoot(B, m); m.cd = F.every * X.rnd(0.8, 1.2); } return; }
    m.cd -= dt;
    if (m.cd <= 0 && gap < F.range && gap > -8) m.aim = F.aim;
  }

  /** 副驾驶瞄哪：车头前方 650px 以内最近的一只醒着的机械（中心点），没有返回 null */
  function aimPoint(B, front) {
    let best = null, bd = 650;
    for (const m of B.mobs || []) {
      if (m.state === 'dead' || m.state === 'sleep') continue;
      const d = m.x - front;
      if (d > -10 && d < bd) { bd = d; best = m; }
    }
    return best ? [best.x, gy(best) - KINDS[best.kind].h / 2] : null;
  }

  /** 画面层读：每只机械现在该用哪一帧、是不是在开火 / 受击闪白 */
  function pose(m) {
    const K = KINDS[m.kind];
    if (m.kind === 'barrel') return { frame: Math.floor(-m.roll / 4), flash: m.flash > 0 };
    if (m.kind === 'sentry') return { frame: m.fired > 0 ? 1 : m.aim > 0 ? 2 : 0, flash: m.flash > 0 };
    const moving = Math.abs(m.vx) > 1 && m.state !== 'chew';
    return { frame: m.state === 'chew' ? Math.floor(m.t * 8) : moving ? Math.floor(m.t * (m.kind === 'soldier' ? 6 : 5)) : 0, flash: m.flash > 0, aim: m.aim > 0, h: K.h };
  }

  return { KINDS, init, step, hitTest, hurt, blast, kill, pose, live, aimPoint };
})();
