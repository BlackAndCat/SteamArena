// 战斗音效（所有战斗：竞技场、支线、出征；docs/feel-audio-plan.md §3）：开火按武器分声音、炮弹落地、爆炸、模块挨打、跳弹、撞击（按重量、速度、撞击件种类），
// 发动机（怠速轰鸣 + 行驶时的蒸汽喷吐，喷吐的快慢和音高跟着车速走）、履带（每过一节履带板低沉地咚一下，底下垫一条滚动循环）、腿式底盘的脚步。
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
  const PITCH = { mg_s: 1.15, mg2: 1.08, mg_heavy: 0.92, knight_gun: 1.05, cannon_s: 1.25, mortar_s: 1.15, harpoon: 1.2, rocket_rack: 1.35,
    side_cannon: 1.05, cannon_heavy: 0.82, cannon_giant: 0.68, mortar: 0.8, flamer: 0.55, steamjet: 1.1 };
  const GAP = { flamer: 0.2, steamjet: 0.2 };   // 连续喷射：至少隔这么久才再响一次
  const TRACK_STEP = 44, LEG_STEP = 46;           // 履带每走多少 px 咔哒一下；腿每走多少 px 落一脚

  function make(o) {
    const B = o.getB, st = { sndT: {}, dist: { p: 0, e: 0 }, last: 0, on: false, dog: 0, rico: -1e9, hitT: -1e9 };
    const isRoute = () => { const b = B(); return !!(b && b.opts && b.opts.mode === 'route'); };
    // 出征里按 F 切到「灰盒」时，战斗声也一起关掉（js/route-view.js 的打击感实验）
    const muted = () => !SA.Audio || (isRoute() && SA.RouteView && SA.RouteView.feel && SA.RouteView.feel() === 0);
    const pan = (x) => { const c = B() && B().cam; return c && x != null ? Math.max(0, Math.min(1, (x - c.x) / Math.max(1, c.w))) : 0.5; };
    function snd(name, x, vol = 1, gap = 0, pitch, lp, v) {
      if (muted()) return;
      if (gap) { const now = performance.now() / 1000; if (now - (st.sndT[name] || 0) < gap) return; st.sndT[name] = now; }
      SA.Audio.play(name, { x: pan(x), vol, pitch, lp, v });
    }
    if (SA.Audio) SA.Audio.load();

    // 视觉事件：只放声音，不拦截（battle-view 照常往下处理）
    function event(type, d) {
      switch (type) {
        case 'fire': {
          const name = FIRE[d.id] || (d.shell ? 'cannon.fire' : 'gun.shot');
          snd(name, d.x, d.p ? 1 : 0.7, GAP[d.id] || 0, PITCH[d.id]);
          if (name === 'cannon.small') snd('gun.shot', d.x, d.p ? 0.35 : 0.3, 0, 0.9);   // 小炮叠一层枪声的脆头，不闷
          if (d.id === 'harpoon') snd('chain', d.x, 0.7);
          break;
        }
        case 'impact': impact(d); break;
        case 'ram': ram(d); break;
        case 'particles': if (d.boom) snd(d.boom.n >= 24 ? 'boom.big' : 'boom', d.boom.x, 0.9); break;
        case 'ricochet': st.rico = performance.now(); snd('hit.ricochet', d.x, 0.55, 0.06); break;
        case 'shatter': snd('hit.plate', d.x, 0.7, 0.05); break;
        case 'text':
          // 炮弹 / 子弹的中弹声由 impact 放；剩下的伤害（撞击、溅射、啃咬）只配一下轻的闷响
          if (/^\d+$/.test(d.str) && performance.now() - st.hitT > 120) snd('hit.thud', d.x, Math.min(0.55, 0.2 + +d.str / 60), 0.06, 0.8);
          break;
      }
    }

    // 中弹：打在车上 = 闷响 + 很短的金属「嘣」（炮弹换成带炸裂感的重击）；同一刻的跳弹已经放了弹飞声，就不再「嘣」；
    // 落在地上的大炮弹 = 炮弹落地；打中木箱 = 木头碎
    function impact(d) {
      if (d.car) {
        st.hitT = performance.now();
        const rico = st.hitT - st.rico < 30, near = d.p ? 1 : 0.8;
        if (d.big) { snd('hit.shell', d.x, 0.9 * near, 0.05); snd('hit.thud', d.x, 0.6 * near, 0, 0.7); }
        else { snd('hit.thud', d.x, 0.45 * near, 0.03, 1.15); if (!rico) snd('hit.ping', d.x, 0.3 * near, 0.05, 1.05 + Math.random() * 0.3); }
      } else if (d.crate) snd('crush.wood', d.x, d.big ? 0.8 : 0.4, 0.05);
      else if (d.big && !d.mob) snd('cannon.hit', d.x, 0.7);
    }

    // 撞击（battle.js 只通知的 ram 事件）：响度按撞击能量走——两车约化质量 × 相对速度²，以两辆 6 吨的车 60 px/s 对撞为 1；
    // 音高按两车平均重量走，越重越低沉。底下一层碎裂闷响（重量），上面一层按撞上去的东西换：
    // 车身对车身 = 钢板相撞的「哐」；铲斗 = 大铁板拍上去的低「哐」+ 刮擦的铁响；撞角 = 金属被撕开的尖锐撕裂声 + 碎裂；
    // 寡妇液压撞头 = 沉重的夯击 + 泄压；蒸汽撞锤 = 铁板一击 + 喷汽；骑士剑 = 一声脆、锤 = 低沉一夯、拳 / 盾 = 闷拳 + 铁板。特别重的一撞再垫一层重击
    function ram(d) {
      const ma = d.ma || 6, mb = d.mb || 6, mu = ma * mb / (ma + mb), avg = (ma + mb) / 2;
      const e = d.punch ? 1 : (mu / 3) * Math.pow((d.speed || 0) / 60, 2), k = Math.max(0.12, Math.min(2.2, Math.sqrt(e)));
      const vol = Math.min(1, 0.28 + 0.42 * k), pitch = Math.max(0.68, Math.min(1.2, 1.18 - (avg - 4) * 0.035)) * (0.95 + Math.random() * 0.1), x = d.x;
      const kinds = d.kinds || [], has = (id) => kinds.includes(id), knight = kinds.some(id => /^knight/.test(id) || /arm/.test(id));
      if (d.soft) { snd('ram.thud', x, 0.16 + 0.1 * Math.min(1, k), 0.1, pitch * 0.85, 900); return; }   // 轻轻碰上：只有一下闷的
      snd('ram.thud', x, vol, 0.04, pitch * 0.9);
      if (has('spike')) { snd('hit.shell', x, vol * 0.75, 0, pitch * 1.05, 0, 2); snd('crush.machine', x, vol * 0.55, 0, pitch, 0, 0); }
      else if (has('bucket')) { snd('hit.plate', x, vol * 0.85, 0, pitch * 0.8); snd('hit.metal.heavy', x, vol * 0.35, 0, pitch * 0.85, 2600, 0); }
      else if (has('boss_ram')) { snd('hit.shell', x, vol * 0.8, 0, pitch * 0.85, 0, 1); snd('steam.hiss', x, 0.45, 0.3, 1.1); }
      else if (has('piston')) { snd('hit.plate', x, vol * 0.8, 0, pitch * 1.05); snd('steam.hiss', x, 0.4, 0.25, 1.25); }
      else if (has('knight_sword')) { snd('hit.thud', x, vol * 0.6, 0, pitch); snd('hit.ping', x, vol * 0.5, 0, pitch * 0.9); }   // 剑：砍在铁上的一声脆
      else if (has('knight_hammer')) { snd('hit.plate', x, vol * 0.9, 0, pitch * 0.75); }                                      // 锤：低沉的一夯
      else if (d.punch && knight) { snd('hit.thud', x, vol * 0.8, 0, pitch * 0.85); snd('hit.plate', x, vol * 0.5, 0, pitch * 1.1); }   // 拳、盾
      else snd('hit.plate', x, vol * 0.75, 0, pitch * 0.9);   // 车身对车身
      if (k > 1.1) snd('hit.shell', x, Math.min(0.7, 0.35 * (k - 1.1) + 0.2), 0, pitch * 0.8, 0, 1);   // 特别重的一撞：再垫一层低沉的重击
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
        // 敌车的履带 / 脚步只在离你近时响
        const far = !mine && b.p && Math.abs((s.pivX || 0) - (b.p.pivX || 0)) > 650;
        if (s.chassisId === 'track') {
          // 履带：每节履带板一下低沉的「咚」（身子）+ 很轻的金属边，间隔放稀并随机漏掉三成，听着不机械；车越快越轻地融进去（音量封顶）。
          // 底下还垫着一条低频滚动循环（见下面自己车的发动机那段）——只有金属咔哒过低通时只剩沙沙声，像风
          if (st.dist[key] >= TRACK_STEP) {
            st.dist[key] %= TRACK_STEP;
            if (!far && Math.random() > 0.3) { const k = (mine ? 1 : 0.5) * Math.min(1, 0.35 + v / 160); snd('track.thunk', x, 0.4 * k, 0, 0.78 + Math.random() * 0.12, 900); snd('track.clank', x, 0.12 * k, 0, 0.7 + Math.random() * 0.1, 1100); }
          }
        } else if (s.chassisId === 'quad' || s.chassisId === 'biped') {
          if (st.dist[key] >= LEG_STEP) { st.dist[key] %= LEG_STEP; if (!far) { const k = mine ? 1 : 0.5; snd('track.thunk', x, 0.5 * k, 0, 0.68, 700); snd('track.clank', x, 0.1 * k, 0, 0.55, 900); } }
        }
      }
      const p = b.p;
      if (p.dead || b.done || muted()) { stop(); return; }
      const v = Math.abs(p.vx || 0), k = Math.min(1.4, v / Math.max(40, p.speed || 90)), x = pan(p.pivX), gas = p.dir ? 1 : 0.5;
      // 怠速是背景里低低的一层（过 600 Hz 低通，车快了稍微亮一点）；行驶的蒸汽喷吐从停车时的 0 渐起，播放速度（= 喷吐节奏）跟车速，
      // 音量随车速的平方上去、封顶 0.8，松油门减半——听得见车在使劲，但不盖过枪炮
      SA.Audio.loop('engine.idle', 'bt-eng-idle', { vol: 0.65 + 0.2 * k, rate: 0.85 + 0.2 * k, x, lp: 420 + 280 * k });
      SA.Audio.loop('engine.run', 'bt-eng-run', { vol: Math.min(0.75, 0.9 * k * k) * gas, rate: 0.6 + 0.65 * k, x, lp: 500 + 500 * k });
      // 履带滚动：低频的哗啦隆隆声垫在底下，停车时没有，车越快越响、越密（过 300～550 Hz 低通，只留厚的部分）
      if (p.chassisId === 'track') SA.Audio.loop('track.roll', 'bt-trk-roll', { vol: Math.min(0.8, 1.1 * k), rate: 0.75 + 0.35 * k, x, lp: 300 + 250 * k });
      st.on = true;
      // 看门狗：战斗画面突然不跑了（切走页面、跳出战斗），半秒内把发动机声收掉
      if (!st.dog) st.dog = setInterval(() => { if (performance.now() - st.last > 500) stop(); }, 250);
    }
    function stop() {
      if (st.dog) { clearInterval(st.dog); st.dog = 0; }
      if (!st.on || !SA.Audio) return;
      st.on = false;
      SA.Audio.stop('bt-eng-idle'); SA.Audio.stop('bt-eng-run'); SA.Audio.stop('bt-trk-roll');
    }
    // 泄压按钮：一大股蒸汽
    const vent = () => snd('steam.hiss', B() && B().p ? B().p.pivX : null, 1, 0, 0.85);

    // 鱼叉（js/battle-view.js 的铁链动画调用）：咬上 = 铁链哗啦 + 金属一撞；绷断 = 低沉的链子声 + 短促的「嘣」；收链 = 轻一点的链子声
    function harpoon(kind, x) {
      if (kind === 'attach') { snd('chain', x, 0.9, 0, 0.8); snd('hit.plate', x, 0.45, 0, 1.15); }
      else if (kind === 'snap') { snd('chain', x, 0.85, 0, 0.6); snd('hit.ping', x, 0.6, 0, 0.75); }
      else snd('chain', x, 0.5, 0.15, 1.15);
    }

    return { event, tick, stop, vent, harpoon };
  }

  return { make };
})();
