// 主页面：铁匠铺院子（界面重建 v3，2026-09-30 用户通过；样机见 tools/ui-lab.html）。
// 背景是 js/home-scene.js 画的铁匠铺院子（晴 / 雨 / 夜 / 雾四种天气，屋脊上的风向标点一下换；本次打开游戏内记住）。
// 车站在正中前景当主角；老汤姆打铁、亲戚坐木箱上吹牛 / 打盹、小提米拧扳手，轮流冒纸气泡；点人物说跟你眼下有关的话。
// 导航是右边的木路标：出战（街头赛、锦标赛都在出战页里）、车间、银行（开放了才插）；点车 = 进车间；墙上钉的公报写着下一场，点它去出战。数据全读存档，规则一概不碰。
window.SA = window.SA || {};

SA.Home = (() => {
  const X = SA.PX, P = SA.PAL, W = 1280, H = 720, GROUND = 606;
  const h = (...a) => SA.h(...a);
  const d = () => SA.S.d;
  const ab = (x, y, ...kids) => h('div', { class: 'ab', style: `left:${x}px;top:${y}px` }, ...kids);
  let timer = null, ro = null;

  // 场景：专门给主页面画的铁匠铺院子（js/home-scene.js），底图静态 + 一层动效（炉火、窗光、烟）
  const backdrop = (wk) => SA.HomeScene.base(wk);
  const rawCoal = (name, o) => SA.Coal.draw(SA.Coal.byName[name] || SA.Coal.crew(name), Object.assign({ size: 'scene' }, o));
  const weather = (wk) => SA.HomeScene.weather(wk);

  function open(wk) {
    X.init();
    SA.go('home');
    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    const stage = h('div', { class: 'home-stage px-ui' }), root = h('div', { class: 'home' }, stage);
    screen.append(root);
    build(stage, root, weather(wk));
    // 1280×720 的院子按窗口等比缩放，居中
    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => {
      const s = Math.min(root.clientWidth / W, root.clientHeight / H);
      stage.style.transform = `translate(${Math.round((root.clientWidth - W * s) / 2)}px,${Math.round((root.clientHeight - H * s) / 2)}px) scale(${s})`;
    });
    ro.observe(root);
  }

  function build(stage, root, WX) {
    const UI = X.ui, D = d(), has = SA.Camp.has, stats = SA.V.stats(D.vehicle), st = SA.Camp.current(), HS = SA.HomeScene;
    // 站位线：人物、道具、路标的脚都落在这里（原生 HS.FEET 放大 2 倍）；车站得更靠前
    const FEET = HS.FEET * 2, CAR_BOTTOM = 672, SUNX = HS.theme(WX).cast === 'sun' ? 6 : 0;
    const sh = (x, y, w) => ab(x + SUNX, y, UI.img(HS.shadow(w, 6, WX), 2));   // x = 影子左边（CSS），w = 原生宽
    // ---------- 车：院子的主角，站在画面正中的前景；2 倍（太大才 1 倍）----------
    // 描一圈暗边把剪影和背景分开，朝光的边加轮廓光；影子跟着天气走；铜角框慢慢呼吸
    const full = () => SA.SPR.renderVehicle(D.vehicle, { key: 'home', t: performance.now() / 1000, heat: 0.45, water: 0.8 });
    const box = (() => { const src = full(), dd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data;
      let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (dd[(y * src.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; })();
    const cs = box.w * 2 <= 560 && box.h * 2 <= 440 ? 2 : 1, pad = HS.HERO_PAD * cs, cw = box.w * cs + pad * 2, chh = box.h * cs + pad * 2;
    const cx = Math.round(640 - cw / 2), cy = CAR_BOTTOM + pad - chh;   // 画布四周多 pad；车图本身的底边踩在 CAR_BOTTOM
    const carCv = document.createElement('canvas'); carCv.width = box.w + HS.HERO_PAD * 2; carCv.height = box.h + HS.HERO_PAD * 2; carCv.className = 'px-img'; carCv.style.cssText = `width:${cw}px;height:${chh}px`;
    const crop = () => { const k = document.createElement('canvas'); k.width = box.w; k.height = box.h; k.getContext('2d').drawImage(full(), box.x, box.y, box.w, box.h, 0, 0, box.w, box.h); return k; };
    const paintCar = () => { const g = carCv.getContext('2d'); g.clearRect(0, 0, carCv.width, carCv.height); g.drawImage(HS.hero(crop(), WX), 0, 0); };
    paintCar();
    const probs = stats.problems;
    const br = UI.brackets(cw + 24, chh + 24); br.classList.add('home-br');
    const carEl = h('div', { class: 'ab home-car', style: `left:${cx - 12}px;top:${cy - 12}px;width:${cw + 24}px;height:${chh + 24}px;padding:12px`, title: '进车间改装', onclick: () => SA.nav('garage') },
      carCv, br,
      h('div', { class: 'home-hint' }, UI.tag(h('span', {}, '进车间改装 →'))),
      probs.length ? h('div', { style: 'position:absolute;left:0;top:-22px', title: probs.join('\n') }, UI.stamp(`待修 · ${probs.length}`, 'background:#efe4c6')) : null);
    const cshadow = HS.carShadow(crop(), WX);
    const carShadow = ab(cx + pad + cshadow.ox * cs, cy + pad + cshadow.oy * cs, UI.img(cshadow.c, cs));
    const carPlate = h('div', { class: 'ab', style: `left:0;width:1280px;top:${CAR_BOTTOM + 10}px;display:flex;justify-content:center;pointer-events:none` },
      UI.plate([D.vehicle.name, ' · 评分 ', UI.num(stats.rating)], 'font-size:15px'));
    // ---------- 墙上钉的公报：下一场 ----------
    const news = (() => {
      const lines = st ? {
        kick: `今晚 · ${st.chapter.place || st.chapter.name}${st.boss ? ' · Boss' : ''}`,
        head: [`「${st.name}」`, h('br'), '迎战铁匠铺新人！'],
        body: (st.blurb || '').split(/[。！（(]/)[0].slice(0, 20),
        who: st.pilot,
      } : { kick: `第 ${D.season} 赛季`, head: ['伦敦蒸汽大奖赛', h('br'), `第 ${D.round + 1} 轮开打！`], body: '战役通关，锦标赛等着你', who: null };
      const face = lines.who ? UI.img(X.engrave(rawCoal(lines.who, {}), [42, 26, 5], [184, 57, 27])) : null;
      return h('div', { class: 'px-hot', style: 'width:260px', title: '看赛程', onclick: () => SA.nav('arena') }, UI.sk('paperOld', [
        h('div', { class: 'px-h2 t' }, '蒸汽公报'),
        h('div', { style: `color:${X.PEN};font:bold 12px SimSun,serif;margin-top:4px` }, lines.kick),
        h('div', { style: 'font:bold 16px/1.35 SimSun,serif;margin:2px 0 6px' }, lines.head),
        h('div', { style: 'display:flex;gap:8px;align-items:flex-end' }, face ? UI.sk('paper', face, 'padding:0;flex:none') : null,
          h('span', { style: 'font-size:12px' }, lines.body ? lines.body.replace(/[。！？]?$/, '。') : '', h('br'), h('b', { style: `color:${X.PEN}` }, '→ 看赛程')))], 'padding:4px 8px', 'px-drop'));
    })();
    // ---------- 路标：只留出战（街头赛、锦标赛都在出战页里）、车间（朝左指着铺子）、银行 ----------
    const SIGNS = [['出战', () => SA.nav('arena'), true, true, 1], ['车间', () => SA.nav('garage'), has('garage'), false, -1], ['银行', () => SA.UI.openBank(), has('bank'), false, 1]].filter(s => s[2]);
    const PX = 1010, POST_TOP = 256, POST_FOOT = 664;
    const signs = SIGNS.map(([t, fn, , go, dir], i) => { const w = 96 + [...t].length * 10 + (go ? 8 : 0);
      return ab(dir > 0 ? PX + 2 : PX - w * 2 + 18, POST_TOP + 20 + i * 96, UI.sign(t, dir, w, { go, onclick: fn, seed: 3 + i * 7 })); });
    const lamp = (() => { const k = X.C(14, 18); X.box(k, 0, 2, 14, 16, X.RAMP.iron); k.r(5, 0, 4, 2, P.iron[0]); k.r(3, 5, 8, 10, P.fire[2]); k.r(4, 6, 6, 8, P.fire[3]); k.r(3, 9, 8, 1, P.iron[0]); k.r(6, 5, 1, 10, P.iron[0]); return k.c; })();
    const anvil = (() => { const k = X.C(34, 30); X.box(k, 10, 16, 14, 14, X.RAMP.wood); k.r(8, 13, 18, 4, P.dark[0]); k.r(9, 13, 16, 3, P.iron[2]); k.r(12, 9, 10, 5, P.dark[0]); k.r(13, 9, 8, 4, P.iron[1]); k.r(0, 4, 34, 6, P.dark[0]); k.r(1, 4, 32, 5, P.iron[2]); k.r(1, 4, 32, 1, P.iron[4]); k.r(27, 5, 6, 3, P.iron[3]); return k.c; })();
    // ---------- 屋脊上的风向标：点一下换天气 ----------
    const vane = (() => {
      const k = X.C(18, 32), dk = P.dark[0];
      k.r(8, 8, 2, 24, dk); k.r(8, 8, 1, 24, P.iron[3]);
      k.r(2, 12, 13, 1, dk); k.r(14, 11, 1, 3, dk); k.r(15, 12, 2, 1, dk); k.r(1, 10, 1, 2, dk); k.r(1, 13, 1, 2, dk); k.r(3, 10, 1, 5, dk);
      k.r(4, 20, 10, 1, P.iron[2]); k.r(3, 19, 2, 3, dk); k.r(13, 19, 2, 3, dk);
      k.r(5, 0, 8, 8, dk); k.r(6, 1, 6, 6, X.RAMP.brass[1]); k.r(6, 1, 6, 1, X.RAMP.brass[3]);
      if (WX === 'sun') { k.r(7, 2, 4, 4, '#ffd166'); k.r(8, 2, 2, 1, '#fff3c0'); }
      else if (WX === 'rain') { k.r(8, 2, 2, 1, '#9cc3ea'); k.r(7, 3, 4, 2, '#5d9ad6'); k.r(8, 5, 2, 1, '#5d9ad6'); }
      else if (WX === 'night') { k.r(7, 2, 3, 4, '#f2ecd2'); k.r(9, 2, 2, 3, X.RAMP.brass[1]); }
      else { k.r(7, 2, 4, 1, '#e4e5e6'); k.r(7, 4, 4, 1, '#c3c5c7'); k.r(7, 6, 4, 1, '#e4e5e6'); }
      return k.c;
    })();
    const ORDER = HS.ORDER, nextWx = ORDER[(ORDER.indexOf(WX) + 1) % ORDER.length];
    const vaneEl = h('div', { class: 'ab px-hot home-vane', style: `left:${HS.L.vane[0] * 2 - 18}px;top:${HS.L.vane[1] * 2 - 64}px`, title: `天气：${HS.NAME[WX]}（点一下换成${HS.NAME[nextWx]}）`, onclick: () => open(nextWx) }, UI.img(vane, 2));
    // ---------- 人物（脚落在站位线上）----------
    const fxCv = document.createElement('canvas'); fxCv.width = HS.W; fxCv.height = HS.H; fxCv.className = 'px-img'; fxCv.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;pointer-events:none';
    const fxG = fxCv.getContext('2d'), t0fx = performance.now();
    const who = {};
    const coal = (name, o) => HS.lift(rawCoal(name, o), WX);
    const feetRow = (cv) => { const dd = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let y = cv.height - 1; y >= 0; y--) for (let x = 0; x < cv.width; x++) if (dd[(y * cv.width + x) * 4 + 3] > 8) return y + 1; return cv.height; };
    const actor = (key, x, feet, frame, flip) => {
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; cv.className = 'px-img'; cv.style.cssText = 'width:112px;height:112px';
      const el = h('div', { class: 'ab px-hot', style: `left:${x}px;top:${feet - feetRow(frame) * 2}px;${flip ? 'transform:scaleX(-1)' : ''}` }, cv);
      who[key] = { box: el, set(f) { const g = cv.getContext('2d'); g.clearRect(0, 0, 56, 56); g.drawImage(f, 0, 0); } }; who[key].set(frame);
      return el;
    };
    const TOM = '铁匠 老汤姆', REL = '远房亲戚', TIM = '学徒 小提米';
    const F_TOM = { up: coal(TOM, { pose: 'cheer', look: 1 }), hit: coal(TOM, { pose: 'point', look: 1 }), rest: coal(TOM, { pose: 'hold', look: 1 }), talk: coal(TOM, { pose: 'hold', look: -1, expr: 'happy' }), blink: coal(TOM, { pose: 'hold', look: 1, expr: 'blink' }) };
    const F_REL = { idle: coal(REL, { pose: 'idle', look: 1 }), blink: coal(REL, { pose: 'idle', look: 1, expr: 'blink' }), talk: coal(REL, { pose: 'salute', look: 1, expr: 'happy' }), sleep: coal(REL, { pose: 'idle', look: 1, expr: 'sleepy' }), jolt: coal(REL, { pose: 'cheer', look: 1, expr: 'surprise' }) };
    // 雨天 / 夜里人回屋（home-scene.js 的 indoor）：老汤姆在门里打铁，一个人在门口台阶上、雨棚底下，一个人在窗后只剩剪影；晴天、雾天都在院子里
    const IN = HS.indoor(WX) || {}, at = (k) => IN[k] || 'yard', SP = HS.SPOT;
    const lant = at('tim') === 'step' ? { item: 'lantern' } : {};   // 夜里小提米提着马灯守在门口
    const F_TIM = { work: coal(TIM, { pose: 'point', look: 1, ...lant }), rest: coal(TIM, { pose: 'hold', look: 1, ...lant }), talk: coal(TIM, { pose: 'wave', look: -1, expr: 'happy', ...lant }), yelp: coal(TIM, { pose: 'cheer', look: -1, expr: 'surprise', ...lant }) };
    // 屋里的人画在 inCv 上（在雨丝后面），这里只放一块透明的点击区；门口台阶上的人照常是院子里那种小人
    const inCv = document.createElement('canvas'); inCv.width = HS.W; inCv.height = HS.H; inCv.className = 'px-img'; inCv.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;pointer-events:none';
    const inG = inCv.getContext('2d');
    const place = (key, frame, yx, yfeet, flip) => {
      const w = at(key);
      if (w === 'yard') return actor(key, yx, yfeet, frame, flip);
      if (w === 'step') return actor(key, SP.step.x * 2 - 56, SP.step.feet * 2, frame, false);
      const [x0, y0, bw, bh] = w === 'forge' ? [SP.forge.x * 2 - 40, SP.forge.feet * 2 - 80, 80, 80]
        : [HS.L.window[0] * 2, HS.L.window[1] * 2, (HS.L.window[2] - HS.L.window[0]) * 2, (HS.L.window[3] - HS.L.window[1]) * 2];
      const el = h('div', { class: 'ab px-hot', style: `left:${x0}px;top:${y0}px;width:${bw}px;height:${bh}px` });
      who[key] = { box: el, frame, inside: w, set(f) { this.frame = f; } };
      return el;
    };
    // 左边：亲戚坐在木箱上（木箱落地，亲戚坐进箱面 3 像素），水桶（画在底图里），老汤姆 + 铁砧挡在门左边；右边：小提米在车右边
    const CRATE_X = 26, crateTop = FEET - 44, TOM_X = 150, ANVIL_X = 246, timX = Math.min(860, Math.max(720, cx + cw + 8));
    stage.append(...[
      UI.img(backdrop(WX), 2, 'position:absolute;left:0;top:0'), inCv, fxCv,
      ab(18, 186, news), vaneEl,
      sh(CRATE_X - 4, FEET - 6, 44), at('tom') === 'yard' ? sh(TOM_X + 20, FEET - 6, 38) : null, sh(ANVIL_X - 2, FEET - 6, 36), at('tim') === 'yard' ? sh(timX + 14, FEET - 6, 38) : null, sh(PX - 16, POST_FOOT - 6, 26),
      Object.values(IN).includes('step') ? sh(SP.step.x * 2 - 38, SP.step.feet * 2 - 6, 38) : null,
      ab(CRATE_X, crateTop, UI.img(X.crate())), ab(ANVIL_X, FEET - 60, UI.img(anvil)),
      place('rel', F_REL.idle, CRATE_X - 6, crateTop + 6), place('tom', F_TOM.rest, TOM_X, FEET), place('tim', F_TIM.work, timX, FEET, true),
      ab(PX, POST_TOP, UI.img(X.post((POST_FOOT - POST_TOP) / 2))), ab(PX - 4, POST_TOP - 34, UI.img(lamp)),
      signs,
      carShadow, carEl, carPlate,
    ].flat(Infinity).filter(Boolean));
    const sparks = [...Array(6)].map((_, i) => h('i', { class: 'px-spark', style: `background:${i % 2 ? P.fire[3] : P.fire[2]}` }));
    const zz = at('rel') === 'window' ? ab(HS.L.window[2] * 2 + 6, HS.L.window[1] * 2 - 18, UI.num('z z Z', '#e4e0d6', P.dark[0])) : ab(96, crateTop - 70, UI.num('z z Z', '#e4e0d6', P.dark[0])); zz.style.opacity = '0';
    const relTop = parseInt(who.rel.box.style.top), tomTop = parseInt(who.tom.box.style.top), timTop = parseInt(who.tim.box.style.top);
    // 气泡跟着人走：院子里用原来的位置；屋里 / 台阶上的按那块点击区摆
    const bubbleAt = (key, yard) => { const w = at(key); if (w === 'yard') return yard(); const b = who[key].box, x0 = parseInt(b.style.left), y0 = parseInt(b.style.top);
      return w === 'window' ? UI.bubble(x0 - 20, y0 - 80, 40) : UI.bubble(x0 + 10, y0 - (w === 'forge' ? 60 : 84), 30); };
    const bubbles = { rel: bubbleAt('rel', () => UI.bubble(30, relTop - 84, 30)), tom: bubbleAt('tom', () => UI.bubble(TOM_X + 30, tomTop - 60, 30)), tim: bubbleAt('tim', () => UI.bubble(timX - 120, timTop - 84, 150)) };
    const gearBtn = UI.btn(null, { title: '设置', icon: UI.img(X.gear(6, 8, X.RAMP.brass, 0.1)), onclick: () => SA.UI.settings() }); gearBtn.style.padding = '0 2px';
    const ingots = Object.entries(D.ingots || {}).filter(([, n]) => n > 0).map(([k, n]) => [k === 'aether' ? 'aether' : 'wootz', n]);
    stage.append(...[
      sparks.map(s => (at('tom') === 'forge' ? ab(SP.anvil[0] * 2 + 16, SP.anvil[1] * 2 - 10, s) : ab(ANVIL_X + 24, FEET - 58, s))), zz,
      bubbles.rel, bubbles.tom, bubbles.tim,
      ab(300, 14, h('div', { title: has('bank') ? '银行：借款 / 还款' : '资金', onclick: has('bank') ? () => SA.UI.openBank() : null }, UI.counter({ money: D.money, rep: D.rep, ingotList: ingots, onclick: has('bank') })),
        D.debt ? h('div', { style: 'margin:6px 0 0 8px' }, UI.tag([h('span', {}, '欠银行'), UI.num(SA.UI.money(D.debt), X.RED)])) : null),
      ab(1206, 14, gearBtn),
    ].flat(Infinity).filter(Boolean));
    // ---------- 闲谈：每句 3.2 秒轮换；点人物插一句跟你有关的 ----------
    const foeLine = st ? `「${st.name}」？别慌，车顶住了就行。` : '锦标赛可不比后巷，别给我丢人。';
    const LINES = [
      ['rel', '想当年在孟买，我们的蒸汽车能拖动一整个炮兵连！', 'talk'], ['tom', '你那台车？早锈成门把手了。', 'talk'], ['tim', '师傅！锅炉又在漏气！', 'yelp'], ['tom', '拿扳手拧紧，别拿脑袋顶着。', 'talk'],
      ['rel', '……', 'sleep'], ['rel', '谁？！谁在开炮？！', 'jolt'], ['tom', foeLine, 'talk'], ['tim', '我在锅炉上画了个笑脸！', 'talk'],
    ];
    // 雨天 / 夜里多几句应景的，穿插进去
    const EXTRA = {
      rain: [['rel', '下雨天我这老寒腿就知道——要打仗了！', 'talk'], ['tim', '师傅，雨什么时候停呀？', 'talk'], ['tom', '雨天淬火，连水都不用挑。', 'talk']],
      night: [['tim', '我来守夜！……就是院子有点黑。', 'talk'], ['tom', '夜里看火色最准。', 'talk'], ['rel', '……呼……', 'sleep']],
    }[WX] || [];
    EXTRA.forEach((l, k) => LINES.splice(1 + k * 3, 0, l));
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
      SA.HomeScene.fx(fxG, (performance.now() - t0fx) / 1000, WX);
      if (tick % 2 === 0) paintCar();
      if (!cur || tick - t0 > 32) { if (forced) { cur = forced; forced = null; } else { cur = LINES[i % LINES.length]; i++; } t0 = tick; say(cur[0], cur[1]); }
      const [spk, , act] = cur;
      if (spk === 'tom') who.tom.set(F_TOM.talk); else { const ph = tick % 8; who.tom.set(ph < 3 ? F_TOM.up : ph < 5 ? F_TOM.hit : (tick % 40 === 7 ? F_TOM.blink : F_TOM.rest)); if (ph === 3) burst(); }
      const dozing = at('rel') === 'window';   // 夜里亲戚在窗后打盹，没轮到他说话就一直点头
      who.rel.set(spk === 'rel' ? F_REL[act] || F_REL.talk : dozing ? F_REL.sleep : (tick % 30 === 5 ? F_REL.blink : F_REL.idle));
      zz.style.opacity = (spk === 'rel' && act === 'sleep') || (dozing && spk !== 'rel') ? '1' : '0';
      who.rel.box.style.translate = spk === 'rel' && act === 'jolt' ? '0 -8px' : '0 0';
      who.tim.set(spk === 'tim' ? F_TIM[act] || F_TIM.talk : (tick % 6 < 3 ? F_TIM.work : F_TIM.rest));
      who.tim.box.style.translate = spk === 'tim' && act === 'yelp' ? '0 -6px' : '0 0';
      if (Object.keys(IN).length) {   // 屋里的人：老汤姆在门里逆光打铁，窗后剪影（小提米来回踱步 / 亲戚打盹点头）
        inG.clearRect(0, 0, HS.W, HS.H);
        const f = { windowPace: at('tim') === 'window' };
        for (const k of ['tom', 'rel', 'tim']) if (who[k].inside) f[who[k].inside] = who[k].frame;
        HS.inside(inG, WX, f, (performance.now() - t0fx) / 1000);
      }
    };
    for (const k of ['tom', 'rel', 'tim']) who[k].box.addEventListener('click', () => { forced = [k, TIP[k], 'talk']; cur = null; });
    if (timer) clearInterval(timer);
    timer = setInterval(step, 100);
    step();
  }

  return { open };
})();
