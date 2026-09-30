// 主页面：铁匠铺院子（界面重建 v3，2026-09-30 用户通过；样机见 tools/ui-lab.html）。
// 背景是战斗场景「铁匠铺后院」2 倍；老汤姆打铁、亲戚坐木箱上吹牛 / 打盹、小提米拧扳手，轮流冒纸气泡；点人物说跟你眼下有关的话。
// 导航是右边的木路标（只插已经开放的）；点车 = 进车间；墙上钉的公报写着下一场，点它去出战。数据全读存档，规则一概不碰。
window.SA = window.SA || {};

SA.Home = (() => {
  const X = SA.PX, P = SA.PAL, W = 1280, H = 720, GROUND = 606;
  const h = (...a) => SA.h(...a);
  const d = () => SA.S.d;
  const ab = (x, y, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px` }, ...kids);
  let timer = null, ro = null, bgCache = null;

  // 场景底图：不画场景自带的小老汤姆和亲戚（院子里有大的，会聊天）
  function backdrop() {
    if (bgCache) return bgCache;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), opts = { noCast: true };
    try {
      SA.Scenes.back('forge', g, W, H, 0, 0, 3, opts);
      g.save(); SA.Scenes.floor('forge', g, { x: 0, y: 0, w: W, h: H }); g.restore();
      SA.Scenes.front('forge', g, W, H, 0, 0, 3);
    } catch (e) { g.fillStyle = P.bg[1]; g.fillRect(0, 0, W, H); }
    return (bgCache = c);
  }
  const coal = (name, o) => SA.Coal.draw(SA.Coal.byName[name] || SA.Coal.crew(name), Object.assign({ size: 'scene' }, o));

  function open() {
    X.init();
    SA.go('home');
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    const stage = h('div', { class: 'home-stage px-ui' }), root = h('div', { class: 'home' }, stage);
    screen.append(root);
    build(stage, root);
    // 1280×720 的院子按窗口等比缩放，居中
    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => {
      const s = Math.min(root.clientWidth / W, root.clientHeight / H);
      stage.style.transform = `translate(${Math.round((root.clientWidth - W * s) / 2)}px,${Math.round((root.clientHeight - H * s) / 2)}px) scale(${s})`;
    });
    ro.observe(root);
  }

  function build(stage, root) {
    const UI = X.ui, D = d(), has = SA.Camp.has, stats = SA.V.stats(D.vehicle), st = SA.Camp.current();
    // ---------- 车：2 倍（放不下就 1 倍），底边踩在地上；黄铜角框 = 能点 ----------
    const car = X.trim(SA.SPR.renderVehicle(D.vehicle, { key: 'home', t: 0, heat: 0.45, water: 0.8 }));
    const cs = car.width * 2 <= 380 && car.height * 2 <= 420 ? 2 : 1, cw = car.width * cs, chh = car.height * cs;
    const cx = Math.round(590 - cw / 2), cy = GROUND - chh;
    const probs = stats.problems;
    const carEl = h('div', { class: 'ab px-hot', style: `left:${cx - 10}px;top:${cy - 10}px;width:${cw + 20}px;height:${chh + 20}px;padding:10px`, title: has('garage') ? '进车间改装' : null, onclick: () => SA.nav('garage') },
      UI.img(car, cs), UI.brackets(cw + 20, chh + 20),
      probs.length ? h('div', { style: 'position:absolute;left:0;top:-20px', title: probs.join('\n') }, UI.stamp(`待修 · ${probs.length}`, 'background:#efe4c6')) : null);
    // ---------- 墙上钉的公报：下一场 ----------
    const news = (() => {
      const lines = st ? {
        kick: `今晚 · ${st.chapter.place || st.chapter.name}${st.boss ? ' · Boss' : ''}`,
        head: [`「${st.name}」`, h('br'), '迎战铁匠铺新人！'],
        body: (st.blurb || '').split(/[。！（(]/)[0].slice(0, 20),
        who: st.pilot,
      } : { kick: `第 ${D.season} 赛季`, head: ['伦敦蒸汽大奖赛', h('br'), `第 ${D.round + 1} 轮开打！`], body: '战役通关，锦标赛等着你', who: null };
      const face = lines.who ? UI.img(X.engrave(coal(lines.who, {}), [42, 26, 5], [184, 57, 27])) : null;
      return h('div', { class: 'px-hot', style: 'width:284px', title: '看赛程', onclick: () => SA.nav('arena') }, UI.sk('paperOld', [
        h('div', { class: 'px-h2 t' }, '蒸汽公报'),
        h('div', { style: `color:${X.PEN};font:bold 12px SimSun,serif;margin-top:4px` }, lines.kick),
        h('div', { style: 'font:bold 16px/1.35 SimSun,serif;margin:2px 0 6px' }, lines.head),
        h('div', { style: 'display:flex;gap:8px;align-items:flex-end' }, face ? UI.sk('paper', face, 'padding:0;flex:none') : null,
          h('span', { style: 'font-size:12px' }, lines.body ? lines.body.replace(/[。！？]?$/, '。') : '', h('br'), h('b', { style: `color:${X.PEN}` }, '→ 看赛程')))], 'padding:4px 8px', 'px-drop'));
    })();
    // ---------- 路标：只插已经开放的 ----------
    const SIGNS = [['出战', () => SA.nav('arena'), true, true], ['车间', () => SA.nav('garage'), has('garage')], ['蓝图柜', () => SA.nav('garage', 'bps'), has('blueprints')],
      ['银行', () => SA.UI.openBank(), has('bank')], ['街头赛', () => SA.nav('arena', 'street'), has('street')], ['锦标赛', () => SA.nav('arena', 'tour'), has('season')]].filter(s => s[2]);
    const PX = 1010, gap = SIGNS.length > 5 ? 72 : 84;
    const signs = SIGNS.map(([t, fn, , go], i) => { const dir = i % 2 && i < 4 ? -1 : 1,   // 下面两块都朝右，别挡住小提米
      w = 96 + [...t].length * 10 + (go ? 8 : 0);
      return ab(dir > 0 ? PX + 2 : PX - w * 2 + 18, 170 + i * gap, UI.sign(t, dir, w, { go, onclick: fn, seed: 3 + i * 7 })); });
    const lamp = (() => { const k = X.C(14, 18); X.box(k, 0, 2, 14, 16, X.RAMP.iron); k.r(5, 0, 4, 2, P.iron[0]); k.r(3, 5, 8, 10, P.fire[2]); k.r(4, 6, 6, 8, P.fire[3]); k.r(3, 9, 8, 1, P.iron[0]); k.r(6, 5, 1, 10, P.iron[0]); return k.c; })();
    const anvil = (() => { const k = X.C(34, 30); X.box(k, 10, 16, 14, 14, X.RAMP.wood); k.r(8, 13, 18, 4, P.dark[0]); k.r(9, 13, 16, 3, P.iron[2]); k.r(12, 9, 10, 5, P.dark[0]); k.r(13, 9, 8, 4, P.iron[1]); k.r(0, 4, 34, 6, P.dark[0]); k.r(1, 4, 32, 5, P.iron[2]); k.r(1, 4, 32, 1, P.iron[4]); k.r(27, 5, 6, 3, P.iron[3]); return k.c; })();
    // ---------- 人物 ----------
    const who = {};
    const actor = (key, x, y, frame, flip) => {
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; cv.className = 'px-img'; cv.style.cssText = 'width:112px;height:112px';
      const box = h('div', { class: 'ab px-hot', style: `left:${x}px;top:${y}px;${flip ? 'transform:scaleX(-1)' : ''}` }, cv);
      who[key] = { box, set(f) { const g = cv.getContext('2d'); g.clearRect(0, 0, 56, 56); g.drawImage(f, 0, 0); } }; who[key].set(frame);
      return box;
    };
    const TOM = '铁匠 老汤姆', REL = '远房亲戚', TIM = '学徒 小提米';
    const F_TOM = { up: coal(TOM, { pose: 'cheer', look: 1 }), hit: coal(TOM, { pose: 'point', look: 1 }), rest: coal(TOM, { pose: 'hold', look: 1 }), talk: coal(TOM, { pose: 'hold', look: -1, expr: 'happy' }), blink: coal(TOM, { pose: 'hold', look: 1, expr: 'blink' }) };
    const F_REL = { idle: coal(REL, { pose: 'idle', look: 1 }), blink: coal(REL, { pose: 'idle', look: 1, expr: 'blink' }), talk: coal(REL, { pose: 'salute', look: 1, expr: 'happy' }), sleep: coal(REL, { pose: 'idle', look: 1, expr: 'sleepy' }), jolt: coal(REL, { pose: 'cheer', look: 1, expr: 'surprise' }) };
    const F_TIM = { work: coal(TIM, { pose: 'point', look: 1 }), rest: coal(TIM, { pose: 'hold', look: 1 }), talk: coal(TIM, { pose: 'wave', look: -1, expr: 'happy' }), yelp: coal(TIM, { pose: 'cheer', look: -1, expr: 'surprise' }) };
    const timX = Math.max(770, cx + cw + 12);
    const bubbles = { rel: UI.bubble(34, 386, 30), tom: UI.bubble(196, 420, 80), tim: UI.bubble(timX - 120, 418, 150) };
    const sparks = [...Array(6)].map((_, i) => h('i', { class: 'px-spark', style: `background:${i % 2 ? P.fire[3] : P.fire[2]}` }));
    const zz = ab(124, 450, UI.num('z z Z', '#e4e0d6', P.dark[0])); zz.style.opacity = '0';
    const gearBtn = UI.btn(null, { title: '设置', icon: UI.img(X.gear(6, 8, X.RAMP.brass, 0.1)), onclick: () => SA.UI.settings() }); gearBtn.style.padding = '0 2px';
    const ingots = Object.entries(D.ingots || {}).filter(([, n]) => n > 0).map(([k, n]) => [k === 'aether' ? 'aether' : 'wootz', n]);
    stage.append(...[
      UI.img(backdrop(), 2, 'position:absolute;left:-330px;top:-690px'),
      ab(28, 96, news),
      ab(52, 562, UI.img(X.crate())), ab(356, 546, UI.img(anvil)),
      carEl,
      actor('rel', 40, 472, F_REL.idle), actor('tom', 250, 514, F_TOM.rest), actor('tim', timX, 514, F_TIM.work, true),
      sparks.map(s => ab(422, 552, s)), zz,
      bubbles.rel, bubbles.tom, bubbles.tim,
      ab(300, 14, h('div', { title: has('bank') ? '银行：借款 / 还款' : '资金', onclick: has('bank') ? () => SA.UI.openBank() : null }, UI.counter({ money: D.money, rep: D.rep, ingotList: ingots, onclick: has('bank') })),
        D.debt ? h('div', { style: 'margin:6px 0 0 8px' }, UI.tag([h('span', {}, '欠银行'), UI.num(SA.UI.money(D.debt), X.RED)])) : null),
      ab(1206, 14, gearBtn),
      ab(PX, 150, UI.img(X.post(290))), ab(PX - 4, 116, UI.img(lamp)),
      signs,
    ].flat(Infinity).filter(Boolean));
    // ---------- 闲谈：每句 3.2 秒轮换；点人物插一句跟你有关的 ----------
    const foeLine = st ? `「${st.name}」？别慌，车顶住了就行。` : '锦标赛可不比后巷，别给我丢人。';
    const LINES = [
      ['rel', '想当年在孟买，我们的蒸汽车能拖动一整个炮兵连！', 'talk'], ['tom', '你那台车？早锈成门把手了。', 'talk'], ['tim', '师傅！锅炉又在漏气！', 'yelp'], ['tom', '拿扳手拧紧，别拿脑袋顶着。', 'talk'],
      ['rel', '……', 'sleep'], ['rel', '谁？！谁在开炮？！', 'jolt'], ['tom', foeLine, 'talk'], ['tim', '我在锅炉上画了个笑脸！', 'talk'],
    ];
    const NAME = { rel: REL, tom: TOM, tim: TIM };
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const TIP = {
      tom: probs.length ? `车还有问题：<b>${esc(probs[0])}</b>。先去车间弄好。` : st ? `下一场是<b>「${esc(st.name)}」</b>，${esc(st.pilot)}开的。车况不错，去吧。` : '车况不错。锦标赛就等你了。',
      rel: '赛程就在墙上那张报纸里，打过的我给你划掉了！',
      tim: '要改装就点车！',
    };
    let i = 0, t0 = 0, cur = null, forced = null, tick = 0, mounted = false;
    const say = (key, html) => { for (const k in bubbles) bubbles[k].classList.remove('on'); bubbles[key].set(NAME[key], html); bubbles[key].classList.add('on'); };
    const burst = () => sparks.forEach((s, k) => { const a = -Math.PI * (0.15 + 0.7 * k / 5), r = 10 + (k % 3) * 8; let f = 0; s.style.opacity = '1';
      const iv = setInterval(() => { f++; const q = f / 4; s.style.transform = `translate(${Math.round(Math.cos(a) * r * q / 2) * 2}px,${Math.round((Math.sin(a) * r * q + q * q * 6) / 2) * 2}px)`; if (f >= 4) { s.style.opacity = '0'; clearInterval(iv); } }, 70); });
    const step = () => {
      if (root.isConnected) mounted = true; else if (mounted) { clearInterval(timer); timer = null; if (ro) ro.disconnect(); return; }
      tick++;
      if (!cur || tick - t0 > 32) { if (forced) { cur = forced; forced = null; } else { cur = LINES[i % LINES.length]; i++; } t0 = tick; say(cur[0], cur[1]); }
      const [spk, , act] = cur;
      if (spk === 'tom') who.tom.set(F_TOM.talk); else { const ph = tick % 8; who.tom.set(ph < 3 ? F_TOM.up : ph < 5 ? F_TOM.hit : (tick % 40 === 7 ? F_TOM.blink : F_TOM.rest)); if (ph === 3) burst(); }
      who.rel.set(spk === 'rel' ? F_REL[act] || F_REL.talk : (tick % 30 === 5 ? F_REL.blink : F_REL.idle));
      zz.style.opacity = spk === 'rel' && act === 'sleep' ? '1' : '0';
      who.rel.box.style.translate = spk === 'rel' && act === 'jolt' ? '0 -8px' : '0 0';
      who.tim.set(spk === 'tim' ? F_TIM[act] || F_TIM.talk : (tick % 6 < 3 ? F_TIM.work : F_TIM.rest));
      who.tim.box.style.translate = spk === 'tim' && act === 'yelp' ? '0 -6px' : '0 0';
    };
    for (const k of ['tom', 'rel', 'tim']) who[k].box.addEventListener('click', () => { forced = [k, TIP[k], 'talk']; cur = null; });
    if (timer) clearInterval(timer);
    timer = setInterval(step, 100);
    step();
  }

  return { open };
})();
