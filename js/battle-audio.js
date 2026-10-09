// 战斗音效（所有战斗：竞技场、支线、出征；docs/feel-audio-plan.md §3）：开火按武器分声音、炮弹落地、爆炸、模块挨打、跳弹，
// 发动机（怠速轰鸣 + 行驶时的蒸汽喷吐，喷吐的快慢和音高跟着车速走）、履带（每过一节履带板咔哒一下）、腿式底盘的脚步。
// 声音素材和播放引擎在 js/audio.js（SA.Audio）；出征特有的声音（小机械、拾取、撞碎）在 js/route-view.js。
// js/battle-view.js 每场 make() 一份，挂在视觉事件、tick 和 teardown 上；只读战斗状态，不改规则。
window.SA = window.SA || {};

SA.BattleAudio = (() => {
  // 武器 → 开火声；没列出来的按弹种：炮弹 = 中炮，子弹 = 机枪
  const FIRE = {
    mg: 'gun.shot', mg2: 'gun.shot', mg_s: 'gun.shot', knight_gun: 'gun.shot', mg_heavy: 'gun.heavy',
    cannon_s: 'cannon.small', mortar_s: 'cannon.small', harpoon: 'cannon.small', rocket_rack: 'cannon.small',
    cannon_m: 'cannon.fire', cannon: 'cannon.fire', side_cannon: 'cannon.fire', knight_cannon: 'cannon.fire',
    cannon_heavy: 'cannon.fire', cannon_giant: 'cannon.fire', mortar: 'cannon.fire',
    flamer: 'steam.hiss', steamjet: 'steam.hiss',
  };
  // 音高：越大的炮越低沉，小机枪清脆一点
  const PITCH = { mg_s: 1.15, mg2: 1.08, mg_heavy: 0.92, knight_gun: 1.05, cannon_s: 1.05, mortar_s: 0.9, harpoon: 1.2, rocket_rack: 1.35,
    side_cannon: 1.05, cannon_heavy: 0.82, cannon_giant: 0.68, mortar: 0.8, flamer: 0.55, steamjet: 1.1 };
  const GAP = { flamer: 0.2, steamjet: 0.2 };   // 连续喷射：至少隔这么久才再响一次
  const TRACK_STEP = 30, LEG_STEP = 46;           // 履带每走多少 px 咔哒一下；腿每走多少 px 落一脚

  function make(o) {
    const B = o.getB, st = { sndT: {}, dist: { p: 0, e: 0 }, last: 0, on: false, dog: 0 };
    const isRoute = () => { const b = B(); return !!(b && b.opts && b.opts.mode === 'route'); };
    // 出征里按 F 切到「灰盒」时，战斗声也一起关掉（js/route-view.js 的打击感实验）
    const muted = () => !SA.Audio || (isRoute() && SA.RouteView && SA.RouteView.feel && SA.RouteView.feel() === 0);
    const pan = (x) => { const c = B() && B().cam; return c && x != null ? Math.max(0, Math.min(1, (x - c.x) / Math.max(1, c.w))) : 0.5; };
    function snd(name, x, vol = 1, gap = 0, pitch) {
      if (muted()) return;
      if (gap) { const now = performance.now() / 1000; if (now - (st.sndT[name] || 0) < gap) return; st.sndT[name] = now; }
      SA.Audio.play(name, { x: pan(x), vol, pitch });
    }
    if (SA.Audio) SA.Audio.load();

    // 视觉事件：只放声音，不拦截（battle-view 照常往下处理）
    function event(type, d) {
      switch (type) {
        case 'fire': {
          const name = FIRE[d.id] || (d.shell ? 'cannon.fire' : 'gun.shot');
          snd(name, d.x, d.p ? 1 : 0.7, GAP[d.id] || 0, PITCH[d.id]);
          if (d.id === 'harpoon') snd('chain', d.x, 0.7);
          break;
        }
        case 'impact': if (d.big && !d.mob) snd('cannon.hit', d.x, 0.7); break;
        case 'particles': if (d.boom) snd(d.boom.n >= 24 ? 'boom.big' : 'boom', d.boom.x, 0.9); break;
        case 'ricochet': snd('hit.metal.light', d.x, 0.6, 0.04, 1.3); break;
        case 'shatter': snd('hit.plate', d.x, 0.7, 0.05); break;
        case 'text':
          if (/^\d+$/.test(d.str)) { const v = +d.str; snd(v < 10 ? 'hit.metal.light' : v < 25 ? 'hit.metal.medium' : 'hit.metal.heavy', d.x, v < 10 ? 0.4 : 0.75, 0.03); }
          break;
      }
    }

    // 每帧：履带咔哒、腿的脚步按走过的距离触发；自己车的发动机两条循环按车速调音量和快慢
    function tick(dt) {
      const b = B();
      if (!b || !b.p || !SA.Audio) return;
      st.last = performance.now();
      for (const [key, s] of [['p', b.p], ['e', b.e]]) {
        if (!s || s.dead) continue;
        const v = Math.abs(s.vx || 0), mine = key === 'p', x = s.pivX;
        st.dist[key] += v * dt;
        if (s.chassisId === 'track') {
          if (st.dist[key] >= TRACK_STEP) { st.dist[key] %= TRACK_STEP; snd('track.clank', x, (mine ? 0.55 : 0.35) * Math.min(1, 0.3 + v / 110), 0, 0.9 + Math.min(0.3, v / 400)); }
        } else if (s.chassisId === 'quad' || s.chassisId === 'biped') {
          if (st.dist[key] >= LEG_STEP) { st.dist[key] %= LEG_STEP; snd('track.clank', x, mine ? 0.45 : 0.3, 0, 0.62); }
        }
      }
      const p = b.p;
      if (p.dead || b.done || muted()) { stop(); return; }
      const v = Math.abs(p.vx || 0), k = Math.min(1.4, v / Math.max(40, p.speed || 90)), x = pan(p.pivX);
      // 怠速一直在（车越快越响、越高）；行驶的蒸汽喷吐从停车时的 0 渐起，播放速度（= 喷吐节奏）跟车速
      SA.Audio.loop('engine.idle', 'bt-eng-idle', { vol: 0.55 + 0.3 * k, rate: 0.85 + 0.25 * k, x });
      SA.Audio.loop('engine.run', 'bt-eng-run', { vol: Math.min(1, k * 1.15), rate: 0.6 + 0.7 * k, x });
      st.on = true;
      // 看门狗：战斗画面突然不跑了（切走页面、跳出战斗），半秒内把发动机声收掉
      if (!st.dog) st.dog = setInterval(() => { if (performance.now() - st.last > 500) stop(); }, 250);
    }
    function stop() {
      if (st.dog) { clearInterval(st.dog); st.dog = 0; }
      if (!st.on || !SA.Audio) return;
      st.on = false;
      SA.Audio.stop('bt-eng-idle'); SA.Audio.stop('bt-eng-run');
    }
    // 泄压按钮：一大股蒸汽
    const vent = () => snd('steam.hiss', B() && B().p ? B().p.pivX : null, 1, 0, 0.85);

    return { event, tick, stop, vent };
  }

  return { make };
})();
