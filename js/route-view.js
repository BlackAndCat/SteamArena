// 出征的画面补充（玩法见 docs/expedition-fun.md）：起伏地面、背景竖直视差、小机械和它们的子弹、
// 撞碎时的打击感（顿帧、镜头冲一下、散架碎件、金属片飞上车、+金属飘字）、「上次到这」的旗子、出征的音效。
// 规则在 js/battle.js、js/route-mobs.js；这里只读 B 画东西、听视觉事件放声音。js/battle-view.js 在出征时 make() 一份，挂在几个钩子上。
window.SA = window.SA || {};

SA.RouteView = (() => {
  const P = SA.PAL;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const vr = (a, b) => a + Math.random() * (b - a);
  // 撞碎时的分量：顿帧、镜头冲撞都按它放大
  const WEIGHT = { soldier: 0.3, crawler: 0.5, barrel: 0.8, sentry: 1 };
  const TILE_H = 840;   // 起伏地面的分块高度：镜头最低能看到 GROUND + 110 左右，留够
  // 打击感档位（开发者实验用，docs/expedition-fun.md §6）：0 灰盒（不顿帧、不冲镜头、没有碎件、没有声音）/ 1 正常 / 2 夸张（全部加倍）。
  // 夸张版突然好玩了 → 缺的是反馈；夸张版还是无聊 → 是设计问题；灰盒版里做选择依然有意思 → 设计是对的。战斗中按 F 切换
  const FEEL_KEY = 'sa-route-feel', FEEL_NAMES = ['灰盒', '正常', '夸张'];
  let feel = 1;
  try { const v = localStorage.getItem(FEEL_KEY); if (v === '0' || v === '2') feel = +v; } catch (e) { /* 读不到就用正常档 */ }
  const FK = () => [0, 1, 2.2][feel];
  let current = null;   // 当前这一场的钩子（F 键只对它生效）
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || SA.RELEASE || !current || SA.current !== 'battle' || e.target.closest?.('input, textarea, select')) return;
    feel = (feel + 1) % 3;
    try { localStorage.setItem(FEEL_KEY, String(feel)); } catch (err) { /* 只在本次生效 */ }
    current.say(`打击感：${FEEL_NAMES[feel]}（F 切换）`);
  });

  const SPRITES = new Map();   // 拾取时飞上车的小图（难民、物资箱、遗迹件）
  // 受击闪白：把机械那一帧涂成白色剪影（缓存）
  const whiteCache = new Map();
  function white(a, key) {
    if (!whiteCache.has(key)) {
      const c = document.createElement('canvas'); c.width = a.c.width; c.height = a.c.height;
      const k = c.getContext('2d'); k.drawImage(a.c, 0, 0); k.globalCompositeOperation = 'source-atop'; k.fillStyle = '#fff6e0'; k.fillRect(0, 0, c.width, c.height);
      whiteCache.set(key, { c, ax: a.ax, ay: a.ay });
    }
    return whiteCache.get(key);
  }

  /**
   * o：{ getB, groundAt, frontEdge, GROUND, W, H } —— battle-view 的接口。返回一组钩子（全部只在出征时调用）
   */
  function make(o) {
    const A = SA.RouteArt, groundAt = o.groundAt, GROUND = o.GROUND;
    const st = { stop: 0, kick: 0, pieces: [], bits: [], flags: [], flyers: [], sndT: {}, best: 0, bestShown: false, smokeT: 0, departed: false };
    const B = () => o.getB();
    const def = () => { const b = B(); return (b && b.opts && b.opts.routeData) || null; };
    const profile = () => { const b = B(); return !!(b && b.ter && b.ter.natural); };
    try { st.best = SA.Route && SA.Route.best ? SA.Route.best(def() && def().id) : 0; } catch (e) { st.best = 0; }
    if (SA.Audio) SA.Audio.load();
    if (feel !== 1 && !SA.RELEASE) setTimeout(() => say(`打击感：${FEEL_NAMES[feel]}（F 切换）`), 400);
    function say(str) { const b = B(); if (!b || !b.p) return; const f = o.frontEdge(b.p); b.texts.push({ str, x: f - 60, y: groundAt(f) - 150, col: '#efe6cf', plaque: P.brass[2], life: 2.2, max: 2.2 }); }

    // ---------- 声音 ----------
    const pan = (x) => { const c = B().cam; return clamp((x - c.x) / Math.max(1, c.w), 0, 1); };
    function snd(name, x, vol = 1, gap = 0, pitch) {
      if (!SA.Audio || !feel) return;
      if (feel === 2) vol = Math.min(1.6, vol * 1.4);
      if (gap) { const now = performance.now() / 1000; if (now - (st.sndT[name] || 0) < gap) return; st.sndT[name] = now; }
      SA.Audio.play(name, { x: x == null ? 0.5 : pan(x), vol, pitch });
    }

    // ---------- 出发的院子（2026-10-09 用户：出发时要有从院子出发的感觉）----------
    // 主页的铁匠铺院子（js/home-scene.js 的房子层 + 院子地面，640×360 原生像素，和车同一尺度）摆在路线起点：车一开局就停在铁匠铺门口，
    // 老汤姆、皮普、远房亲戚站在门口送行；院墙尽头一对院门柱，近的那根画在车前面——车从它后面开出去，就是「出了院门」。
    // 配色用院子的雨夜色板（暗红砖、门里炉火亮着），和废土的黄昏天光搭得上
    const YARD = { wk: 'rain', x0: -212, feet: 299, gate: 444 }, HS = SA.HomeScene;
    const yardImg = HS && HS.layer ? HS.layer(YARD.wk, { ground: true, build: true }) : null;
    const yardY = () => Math.round(groundAt(90) - YARD.feet);   // 院子的站位线对准车出发处的路面
    const CAST = [['home_d095d42ab435', -186, 'salute'], ['home_8a44e806c998', -120, 'wave'], ['home_21b8ff00a6c9', -58, 'cheer']];
    const castImg = (key, pose) => sprite(`cast|${key}|${pose}`, () => { const n = SA.Config.text(key); return SA.Coal.draw(SA.Coal.byName[n] || SA.Coal.crew(n), { size: 'scene', pose, look: 1, expr: pose === 'hold' ? 'normal' : 'happy' }); });
    function drawYard(g, cam) {
      if (!yardImg || cam.x > YARD.gate + 80 || cam.x + cam.w < YARD.x0) return;
      const y0 = yardY(), t = performance.now() / 1000, b = B();
      g.drawImage(yardImg, 0, 0, yardImg.width, YARD.feet + 3, YARD.x0, y0, yardImg.width, YARD.feet + 3);   // 只画到站位线，往下是路面
      // 门里的炉火：一明一暗
      const fl = 0.5 + 0.3 * Math.sin(t * 9) + 0.2 * Math.sin(t * 23.7);
      g.globalAlpha = 0.35 + 0.25 * fl; g.fillStyle = '#ff9a3c'; g.fillRect(YARD.x0 + 166, y0 + 229, 24, 12);
      g.globalAlpha = 0.12 + 0.1 * fl; g.fillRect(YARD.x0 + 150, y0 + 214, 56, 36); g.globalAlpha = 1;
      // 送行的人：车还在附近就挥手、欢呼，开远了放下手
      const near = b && b.p ? o.frontEdge(b.p) < 700 : true;
      for (const [key, x, pose] of CAST) {
        const ps = near ? (Math.floor(t * 2.6 + x) % 2 ? pose : 'cheer') : 'hold', c = castImg(key, ps);
        g.drawImage(c, Math.round(x - c.width / 2), Math.round(groundAt(x) - 48));
      }
      gatePost(g, YARD.gate - 12, false);
    }
    // 院门柱：砖柱 + 石帽；远的那根顶上挂一盏煤气灯
    function gatePost(g, x, nearOne) {
      const gy = Math.round(groundAt(x)), h = nearOne ? 74 : 92, w = nearOne ? 12 : 14, B2 = A.PAL.BRICK, S2 = A.PAL.STONE;
      g.fillStyle = B2[nearOne ? 1 : 2]; g.fillRect(x, gy - h, w, h + 6);
      g.fillStyle = B2[0]; for (let yy = gy - h + 3; yy < gy; yy += 4) g.fillRect(x, yy, w, 1);
      g.fillStyle = S2[nearOne ? 2 : 3]; g.fillRect(x - 2, gy - h - 5, w + 4, 5); g.fillStyle = S2[4]; g.fillRect(x - 2, gy - h - 5, w + 4, 1);
      if (!nearOne) {
        g.fillStyle = P.iron[1]; g.fillRect(x + w / 2 - 1, gy - h - 16, 2, 11);
        const fl = 0.75 + 0.25 * Math.sin(performance.now() / 130);
        g.fillStyle = P.iron[0]; g.fillRect(x + w / 2 - 4, gy - h - 26, 8, 10);
        g.fillStyle = `rgba(255,190,110,${fl})`; g.fillRect(x + w / 2 - 3, gy - h - 25, 6, 8);
        g.globalAlpha = 0.12 * fl; g.fillStyle = '#ffcf8a'; g.fillRect(x + w / 2 - 22, gy - h - 40, 44, 36); g.globalAlpha = 1;
      }
    }
    // 路边的废墟（js/route-ruins.js）：按路线定种子摆好；院子、地标、遭遇路障、桥、路堑、终点附近不放；难民身后放一间有人住的破屋
    const ruins = (() => {
      const d = def(), T = B() && B().ter;
      if (!d || !SA.RouteRuins) return [];
      const keep = [[-800, YARD.gate + 140]], end = d.end && (d.end.x != null ? d.end.x : d.end);
      for (const dr of A.dress(d)) if (dr.back) keep.push([dr.x - 190, dr.x + 190]);
      for (const p of d.props || []) if (p.kind !== 'crate') keep.push([p.x - 80, p.x + 80]);
      const clear = (d.encounters || []).map(e => [e.guard - 140, e.leash + 60]);   // 遭遇的战场：近处留空，打起来看得清
      for (const f of d.features || []) keep.push([f.x0 - 40, f.x1 + 40]);
      for (const k of d.pickups || []) if (k.kind === 'water') keep.push([k.x - 60, k.x + 60]);
      if (end != null) keep.push([end - 220, (d.len || end) + 2000]);
      const refugees = (d.pickups || []).filter(k => k.kind === 'refugee').map(k => k.x);
      return SA.RouteRuins.layout(d, { keep, clear, refugees, slope: (x) => (groundAt(x + 30) - groundAt(x - 30)) / 60 });
    })();
    // 路后面一层（地面之前画）：院子、废墟
    function drawBack(g) {
      const b = B(), cam = b.cam;
      drawYard(g, cam);
      if (SA.RouteRuins) SA.RouteRuins.draw(g, ruins, groundAt, (x, w) => x + w > cam.x - 8 && x - w < cam.x + cam.w + 8);
    }
    // 院子的动效：烟囱冒烟；开局那一下：泄压的蒸汽 +「出发！」
    function yardTick(dt) {
      const b = B();
      if (!b || !b.p) return;
      if (!st.departed) {
        st.departed = true;
        const f = o.frontEdge(b.p);
        b.texts.push({ str: SA.Config.text('route_depart'), x: f - 60, y: groundAt(f) - 170, col: '#efe6cf', plaque: P.brass[2], life: 1.8, max: 1.8 });
        snd('steam.hiss', f, 0.7, 0, 0.9);
      }
      st.smokeT -= dt;
      if (st.smokeT <= 0 && b.cam.x < YARD.gate + 200) {
        st.smokeT = 0.35;
        const y0 = yardY();
        part('smoke', YARD.x0 + 312 + vr(-6, 6), y0 + 12, vr(-8, 14), vr(-40, -24), vr(1.6, 2.4));
      }
    }

    // ---------- 打击感 ----------
    const stop = (s) => { if (feel) st.stop = Math.min(0.11 * FK(), Math.max(st.stop, s * FK())); };
    const kick = (px) => { if (feel) st.kick = Math.max(st.kick, px * FK()); };
    function part(type, x, y, vx, vy, life, col) { if (!feel) return; for (let i = 0; i < (feel === 2 ? 2 : 1); i++) B().parts.push({ type, x: x + (i ? vr(-6, 6) : 0), y, vx: vx * (i ? vr(0.8, 1.3) : 1), vy: vy * (i ? vr(0.8, 1.3) : 1), life, max: life, col, spin: vr(8, 22) }); }
    function crush(d) {
      const b = B(), w = WEIGHT[d.kind] || 0.5, ram = d.by === 'ram', fast = clamp(Math.abs(d.vx || 0) / 90, 0.4, 1.6);
      if (ram) { stop(0.025 + 0.05 * w); kick(5 + 9 * w * fast); }
      else if (d.kind === 'sentry') stop(0.03);
      // 散架：每种机械掉自己的碎件（翻滚着往车前方飞），加尘土、火星
      const list = feel ? (A.DEBRIS[d.kind] || ['plate']).concat(feel === 2 ? A.DEBRIS[d.kind] || [] : []) : [], fwd = ram ? Math.max(40, d.vx || 0) : 0;
      if (feel === 2) B().shake = Math.max(B().shake, 4 + 5 * w);
      for (const [i, t] of list.entries()) st.pieces.push({ t, x: d.x + vr(-5, 5), y: d.y - vr(2, 10), vx: fwd * vr(0.6, 1.4) + vr(-60, 90) + i * 6, vy: vr(-260, -110), rot: Math.floor(vr(0, 4)), spin: vr(6, 16), life: vr(2.2, 3), max: 3 });
      for (let i = 0; i < 8; i++) part('dust', d.x + vr(-12, 12), d.y + vr(0, 8), vr(-60, 80), vr(-70, -10), vr(0.4, 0.8));
      if (d.kind !== 'barrel') for (let i = 0; i < 7; i++) part('spark', d.x, d.y - 4, vr(-40, 200) * (ram ? 1 : 0.6), vr(-200, -40), vr(0.15, 0.35), i % 3 ? P.brass[3] : P.white);
      // 金属片：沿弧线一块块飞进车里，最后一块到了飘「+N 金属」
      const n = feel ? d.metal || 0 : 0;
      for (let i = 0; i < n; i++) st.bits.push({ x: d.x, y: d.y - 6, t: 0, dur: 0.5 + i * 0.07 + vr(0, 0.08), h: vr(50, 110), delay: 0.06 * i, last: i === n - 1 ? n : 0 });
      if (d.kind === 'barrel') return;   // 炸药桶的声音在爆炸里
      // 散架 = 碎裂声 + 一层薄铁皮哗啦（小兵更轻更脆）
      const small = d.kind === 'soldier';
      snd('crush.machine', d.x, small ? 0.6 : 0.9, 0, small ? 1.2 : 1);
      snd('crush.plate', d.x, small ? 0.3 : 0.45, 0, small ? 1.15 : 0.95);
      if (ram) snd('ram.thud', d.x, 0.35 + 0.5 * w);
      if (d.kind === 'sentry') snd('hit.metal.heavy', d.x, 0.8);
    }
    function blastFx(d) {
      stop(0.06); kick(6);
      st.flags.push({ ring: true, x: d.x, y: d.y, r: d.r, life: 0.3, max: 0.3 });
      for (let i = 0; i < 10; i++) part('debris', d.x + vr(-8, 8), d.y, vr(-200, 200), vr(-280, -80), vr(0.6, 1.1), i % 2 ? P.rust[2] : P.iron[1]);
    }

    // ---------- 开过去就捡：难民一家跳上车（欢呼的碳球小人），物资箱、遗迹件沿弧线飞进车里 ----------
    const sprite = (key, make) => { if (!SPRITES.has(key)) SPRITES.set(key, make()); return SPRITES.get(key); };
    const person = (seed) => sprite(`p${seed}`, () => SA.Coal.draw(SA.Coal.crew(`难民${seed}`), { size: 'sprite', pose: 'cheer', expr: 'happy', look: 1 }));
    const crate = () => sprite('crate', () => { const q = A.pen(12, 12); A.crateAt(q, 6, 10); return q.c; });
    const relic = () => sprite('relic', () => { const q = A.pen(14, 14); A.relicAt(q, 7, 12); return q.c; });
    function pickupFx(d) {
      if (!feel) return;
      const y = d.y != null ? d.y : groundAt(d.x);
      if (d.kind === 'refugee') {
        const seed = Math.round(d.x / 97);
        [[-24, 0], [-4, 1], [14, 2]].forEach(([dx, k], i) => st.flyers.push({ img: person(seed + k), x: d.x + dx, y: y - 14, t: 0, dur: 0.55 + i * 0.08, h: 70 + i * 16, delay: 0.07 * i, w: 40 }));
        snd('ui.confirm', d.x, 0.55); snd('chain', d.x, 0.35);
      } else if (d.kind === 'supply' || d.kind === 'spoils') {
        for (let i = 0; i < (d.encounter != null ? 3 : 2); i++) st.flyers.push({ img: crate(), x: d.x + vr(-10, 10), y: y - 8, t: 0, dur: 0.45 + i * 0.07, h: vr(50, 80), delay: 0.06 * i, w: 12 });
        snd('crush.wood', d.x, 0.3, 0, 1.25); snd('scrap.pickup', d.x, 0.5);
      } else if (d.kind === 'relic') {
        st.flyers.push({ img: relic(), x: d.x, y: y - 10, t: 0, dur: 0.7, h: 110, delay: 0, w: 14, glow: true });
        snd('ui.confirm', d.x, 0.7); stop(0.05);
      }
    }

    // ---------- 视觉事件：返回 true = 已处理完（battle-view 不再管），false = 只加了声音，照常往下走 ----------
    function event(type, d) {
      const b = B();
      switch (type) {
        case 'mob-break': crush(d); return true;
        case 'mob-blast': blastFx(d); return true;
        case 'mob-hit': for (let i = 0; i < 4; i++) part('spark', d.x, d.y, vr(-120, 120), vr(-160, -20), vr(0.12, 0.25)); snd('hit.metal.light', d.x, 0.5, 0.05); return true;
        case 'mob-fire':
          if (d.kind === 'sentry') { for (let i = 0; i < 6; i++) part('flash', d.x - vr(0, 8), d.y + vr(-2, 2), -vr(30, 110), vr(-40, 10), vr(0.06, 0.14)); part('smoke', d.x - 6, d.y, -20, -24, 0.8); snd('cannon.small', d.x, 0.6, 0, 1.3); snd('gun.shot', d.x, 0.3, 0, 0.95); }   // 步哨炮车：小炮 + 枪声的脆头
          else { part('flash', d.x - 2, d.y, -60, 0, 0.06); snd('gun.shot', d.x, 0.22, 0.04, 1.3); }
          return true;
        case 'mob-chew': for (let i = 0; i < 5; i++) part('spark', d.x, d.y, vr(-80, 40), vr(-140, -30), vr(0.1, 0.25), P.brass[3]); snd('hit.metal.light', d.x, 0.35, 0.12, 1.2); return true;
        case 'mob-grind': for (let i = 0; i < 6; i++) part('spark', d.x, d.y, vr(-150, 30), vr(-160, -20), vr(0.12, 0.3)); kick(2); snd('hit.plate', d.x, 0.45, 0.15); return true;
        case 'mob-shot-hit': for (let i = 0; i < 4; i++) part('spark', d.x, d.y, vr(-100, 100), vr(-140, -20), vr(0.1, 0.2)); if (d.kind === 'sentry') { part('smoke', d.x, d.y, 0, -30, 0.7); snd('cannon.hit', d.x, 0.55); } return true;
        case 'mob-shot-ground': for (let i = 0; i < (d.kind === 'sentry' ? 8 : 2); i++) part('dust', d.x, d.y - 2, vr(-60, 60), vr(-90, -20), vr(0.3, 0.6)); if (d.kind === 'sentry') snd('cannon.hit', d.x, 0.35); return true;
        case 'fire': case 'impact': return true;   // 开火、落地的声音在 js/battle-audio.js（所有战斗共用）
        case 'prop':
          if (d.state === 'break') { if (d.kind === 'crate') { snd('crush.wood', d.x, 1); snd('crush.splinter', d.x, 0.6); stop(0.03); kick(4); } else if (d.kind === 'barricade') { snd('hit.plate', d.x); snd('crush.wood', d.x, 0.8); stop(0.05); kick(7); } else snd('crush.rock', d.x); }
          else snd(d.kind === 'crate' ? 'crush.wood' : 'hit.plate', d.x, 0.35, 0.14, d.kind === 'crate' ? 1.2 : undefined);
          return false;
        case 'pickup': if (d.kind === 'coal' || d.kind === 'water') snd(d.kind === 'water' ? 'steam.hiss' : 'crush.rock', d.x, 0.6); else pickupFx(d); return false;
        case 'encounter': snd('chain', null, 0.6); return false;
        default: return false;
      }
    }

    // ---------- 每帧 ----------
    // 顿帧：返回 true 表示这一帧世界停住（画面照画）
    function hold(dt) { if (st.stop > 0) { st.stop -= dt; return true; } return false; }
    function tick(dt) {
      const b = B();
      yardTick(dt);
      st.kick *= Math.pow(0.004, dt);
      for (const p of st.pieces) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt;
        const gy = groundAt(p.x) - 2;
        if (p.y > gy) { p.y = gy; p.vy *= -0.32; p.vx *= 0.55; p.spin *= 0.5; }
      }
      st.pieces = st.pieces.filter(p => p.life > 0);
      for (const f of st.flags) f.life -= dt;
      st.flags = st.flags.filter(f => f.life > 0);
      for (const q of st.bits) {
        if (q.delay > 0) { q.delay -= dt; continue; }
        q.t += dt;
        if (q.t >= q.dur && !q.done) {
          q.done = true;
          if (q.last) { const [cx, cy] = carSpot(); b.texts.push({ str: `+${q.last} ${SA.Config.text('route_metal')}`, x: cx, y: cy - 30, col: P.iron[4], plaque: P.brass[2], life: 1, max: 1 }); }
          snd('scrap.pickup', q.x, 0.6, 0.05);
        }
      }
      st.bits = st.bits.filter(q => !q.done);
      for (const f of st.flyers) { if (f.delay > 0) f.delay -= dt; else f.t += dt; }
      st.flyers = st.flyers.filter(f => f.t < f.dur);
    }
    // 金属飞进车里的哪儿：车身中段偏上（有货箱就是货箱的位置）
    function carSpot() { const b = B(), f = o.frontEdge(b.p); return [f - 96, groundAt(f - 96) - 76]; }
    const kickX = () => -Math.round(st.kick);

    // ---------- 画 ----------
    // 起伏地面：按 1280 宽分块整块画出来（路面煤渣带、红泥表土、岩层、驼背桥 + 运河、桥前路堤、路堑挡土墙）
    // 两头各多画一屏（地面接着端点的高度平铺），开局车尾、终点以后都不露空
    function terrainTiles(T) {
      const feats = (T.def && T.def.features) || [], nat = T.natural, len = T.len, PAD = 1280;
      const ground = new Float32Array(len + 1 + PAD * 2);
      for (let i = 0; i < ground.length; i++) ground[i] = T.ground[clamp(i - PAD, 0, len)];
      const natY = (x) => GROUND - nat[clamp(Math.round(x - PAD), 0, len)];
      const pick = (k) => feats.filter(f => f.kind === k);
      const tiles = SA.TerrainArt.profileTiles(ground, ground.length - 1, TILE_H, {
        lazy: true,   // 首帧只生成镜头可见地块，其余保持元数据，经过时再缓存像素。
        bridge: pick('bridge').map(f => ({ x0: f.x0 + PAD, x1: f.x1 + PAD, water: Math.round(natY((f.x0 + f.x1) / 2 + PAD) + 10) })),
        fill: pick('fill').map(f => ({ x0: f.x0 + PAD, x1: f.x1 + PAD, natural: natY })),
        cut: pick('cut').map(f => ({ x0: f.x0 + PAD, x1: f.x1 + PAD, depth: f.depth })),
        rubble: pick('rubble').map(f => ({ x0: f.x0 + PAD, x1: f.x1 + PAD, natural: natY })),
        span: pick('span').map(f => ({ x0: f.x0 + PAD, x1: f.x1 + PAD, natural: natY })),
      });
      for (const t of tiles) t.x -= PAD;
      return tiles;
    }
    // 背景的竖直视差：远景只跟镜头上下走两成（平地时和原来一样）
    function backOy(cam) { const base = GROUND + 60 - cam.h; return Math.round(base + (cam.y - base) * 0.2); }
    // 近景剪影的底边：车下地面往下 60（和平地战斗一样），跟着起伏走
    function nearArgs(cam) { const b = B(), f = o.frontEdge(b.p) - 90; return { vh: Math.round(groundAt(f) - cam.y + 60), opt: { groundAt, refX: f } }; }

    // 世界层（地面之后、车之前）：小机械、「上次到这」的旗子
    function drawWorld(g) {
      const b = B(), cam = b.cam, seen = (x, w) => x + w > cam.x - 8 && x - w < cam.x + cam.w + 8;
      if (st.best > 0 && seen(st.best, 40)) flagPost(g, st.best, groundAt(st.best));
      for (const m of b.mobs || []) {
        if (m.state === 'dead' || !seen(m.x, 40)) continue;
        const ps = SA.RouteMobs.pose(m), fr = ((ps.frame % A.MOBS[m.kind].frames) + A.MOBS[m.kind].frames) % A.MOBS[m.kind].frames;
        let a = A.mob(m.kind, fr);
        if (!a) continue;
        if (ps.flash) a = white(a, `${m.kind}:${fr}`);
        const y = groundAt(m.x) + (m.kind === 'soldier' && fr % 2 ? -1 : 0);
        g.drawImage(a.c, Math.round(m.x - a.ax), Math.round(y - a.ay));
        if (m.kind === 'soldier' && ps.aim) { g.fillStyle = P.iron[1]; g.fillRect(Math.round(m.x - 12), Math.round(y - 15), 7, 2); }   // 举枪
      }
    }
    // 「上次到这」：一根木杆挂一面红三角旗
    function flagPost(g, x, y) {
      x = Math.round(x); y = Math.round(y);
      g.fillStyle = P.dark[0]; g.fillRect(x - 1, y - 46, 3, 46);
      g.fillStyle = P.leather[2]; g.fillRect(x, y - 46, 1, 46);
      const wave = Math.round(Math.sin(performance.now() / 260) * 1.5);
      g.fillStyle = P.rust[1]; for (let i = 0; i < 9; i++) g.fillRect(x + 2, y - 45 + i, 14 - Math.abs(i - 4) * 3 + (i === 4 ? wave : 0), 1);
      g.fillStyle = P.rust[3]; g.fillRect(x + 2, y - 45, 5, 1);
      g.fillStyle = P.dark[0]; g.fillRect(x - 3, y - 2, 7, 2);
    }
    // 特效层（和炮弹、粒子一起）：机械的子弹 / 小炮弹、散架碎件、飞上车的金属片、炸药桶的冲击圈
    function drawFx(g) {
      const b = B();
      for (const s of b.mobShots || []) {
        if (s.kind === 'sentry') { g.fillStyle = P.dark[0]; g.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 3, 6, 6); g.fillStyle = P.iron[2]; g.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, 4, 4); g.fillStyle = P.iron[4]; g.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, 2, 1); }
        else { const k = 0.012; SA.SPR.useCtx(g); SA.SPR.line(Math.round(s.x - s.vx * k), Math.round(s.y - s.vy * k), Math.round(s.x), Math.round(s.y), 2, P.brass[3]); }
      }
      for (const p of st.pieces) {
        g.globalAlpha = Math.min(1, p.life * 2);
        const a = A.piece(p.t, p.rot + Math.floor((p.max - p.life) * p.spin));
        g.drawImage(a.c, Math.round(p.x - a.ax), Math.round(p.y - a.ay));
      }
      g.globalAlpha = 1;
      const [tx, ty] = carSpot();
      for (const q of st.bits) {
        if (q.delay > 0) continue;
        const k = clamp(q.t / q.dur, 0, 1), e = k * k * (3 - 2 * k), x = q.x + (tx - q.x) * e, y = q.y + (ty - q.y) * e - Math.sin(k * Math.PI) * q.h;
        const a = A.piece('scrap', Math.floor(k * 8));
        g.drawImage(a.c, Math.round(x - a.ax), Math.round(y - a.ay));
      }
      for (const f of st.flyers) {
        if (f.delay > 0) continue;
        const k = clamp(f.t / f.dur, 0, 1), e = k * k * (3 - 2 * k), x = f.x + (tx - f.x) * e, y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * f.h;
        const s = f.w > 20 ? 1 - 0.45 * k : 1;   // 小人越飞越小（落进车里）
        if (f.glow) { g.globalAlpha = 0.35; g.fillStyle = A.PAL.GLOW[2]; g.fillRect(Math.round(x - 10), Math.round(y - 10), 20, 20); g.globalAlpha = 1; }
        g.drawImage(f.img, Math.round(x - f.img.width * s / 2), Math.round(y - f.img.height * s / 2), Math.round(f.img.width * s), Math.round(f.img.height * s));
      }
      if (b.cam.x < YARD.gate + 60) gatePost(g, YARD.gate + 8, true);
      for (const f of st.flags) {
        if (!f.ring) continue;
        const k = 1 - f.life / f.max, r = Math.round(8 + f.r * k);
        g.globalAlpha = 0.6 * (1 - k); g.strokeStyle = P.fire[3]; g.lineWidth = 3;
        g.beginPath(); g.arc(Math.round(f.x), Math.round(f.y), r, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      }
    }
    // 叠加层（矢量字）：旗子上的「上次到这」小牌
    function drawLabels(g) {
      const b = B(), cam = b.cam;
      if (!(st.best > 0) || st.best < cam.x - 60 || st.best > cam.x + cam.w + 60) return;
      const x = Math.round(st.best), y = Math.round(groundAt(st.best) - 58), str = SA.Config.text('route_best_flag');
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = Math.ceil(g.measureText(str).width) + 10;
      g.fillStyle = 'rgba(7,8,12,0.8)'; g.fillRect(x - w / 2, y - 9, w, 18);
      g.strokeStyle = P.rust[2]; g.lineWidth = 1; g.strokeRect(x - w / 2 + 0.5, y - 8.5, w - 1, 17);
      g.fillStyle = '#efe6cf'; g.fillText(str, x, y + 1);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }

    current = { say };
    return { event, hold, tick, kickX, terrainTiles, backOy, nearArgs, drawBack, drawWorld, drawFx, drawLabels, profile, best: () => st.best };
  }

  // 驾驶台的金属计数：一小堆铁片 + 像素数字（原生像素，界面上放大 2 倍）
  function metalBadge(n) {
    const nc = SA.PX.num(String(n), '#d8d4c8', { shadow: '#0b0e15' }), c = document.createElement('canvas');
    c.width = 13 + nc.width; c.height = 10;
    const k = c.getContext('2d'), A = SA.RouteArt;
    k.drawImage(A.piece('plate', 0).c, 0, 3); k.drawImage(A.piece('scrap', 0).c, 5, 4); k.drawImage(A.piece('gear', 0).c, 3, 0);
    k.drawImage(nc, 13, 2);
    return c;
  }

  return { make, metalBadge, feel: () => feel };
})();
