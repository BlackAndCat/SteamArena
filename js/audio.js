// 音效引擎（docs/feel-audio-plan.md §3；2026-10-06 用户定：只做音效、音乐继续搁置、用 CC0 录音素材）。
// 声音文件在 audio/（22.05 kHz 单声道 16 位 WAV，所有浏览器都能放），来源和授权见 audio/LICENSES.md；
// 处理（切静音、统一峰值、重采样）在 tools/current.html 的试听台里做。
// 用法：SA.Audio.play('crush.wood', { x: 0～1 屏幕横向位置, vol, pitch })；第一次点击 / 按键之后才会出声（浏览器规定）。
// 音量设置存在单独的 localStorage 键 sa-audio，不碰存档。
window.SA = window.SA || {};

SA.Audio = (() => {
  // 名字 → 变体数 n（文件 audio/<名字里的点换成横线>-<序号>.wav）、基础音量、音高随机幅度、同时最多几个
  const BANK = {
    'crush.wood': { n: 4, vol: 0.8, pitch: 0.06, limit: 4 },     // 撞碎木箱
    'crush.machine': { n: 4, vol: 0.75, pitch: 0.08, limit: 5 },  // 小机械散架
    'crush.rock': { n: 3, vol: 0.8, pitch: 0.05, limit: 3 },      // 砖石、煤渣、遗迹门
    'hit.plate': { n: 4, vol: 0.85, pitch: 0.05, limit: 4 },      // 铁皮、路障、装甲挨重击
    'hit.metal.light': { n: 4, vol: 0.55, pitch: 0.1, limit: 6 }, // 机枪打铁、小碎件
    'hit.metal.medium': { n: 4, vol: 0.7, pitch: 0.08, limit: 5 },
    'hit.metal.heavy': { n: 4, vol: 0.85, pitch: 0.05, limit: 4 },
    'ram.thud': { n: 4, vol: 0.9, pitch: 0.05, limit: 3 },        // 车头撞上东西的闷响
    'scrap.pickup': { n: 2, vol: 0.5, pitch: 0.12, limit: 3 },    // 金属碎片飞上车
    'boom': { n: 4, vol: 0.9, pitch: 0.06, limit: 3 },            // 爆炸（滚桶、模块殉爆）
    'boom.big': { n: 2, vol: 1, pitch: 0.04, limit: 2 },          // 大爆炸（锅炉、巨炮）
    'cannon.fire': { n: 4, vol: 0.9, pitch: 0.05, limit: 3 },     // 中、大口径炮（第二批：混好的游戏炮声）
    'cannon.small': { n: 2, vol: 0.8, pitch: 0.06, limit: 3 },   // 小炮、小臼炮、鱼叉、步哨炮车
    'cannon.hit': { n: 3, vol: 0.8, pitch: 0.05, limit: 3 },      // 炮弹落地
    'gun.shot': { n: 4, vol: 0.5, pitch: 0.06, limit: 5 },        // 机枪单发（从连发里切出来的）
    'gun.heavy': { n: 3, vol: 0.6, pitch: 0.05, limit: 4 },       // 重机枪单发
    'engine.idle': { n: 1, vol: 0.2, pitch: 0, limit: 2 },        // 发动机怠速（循环）：退到背景里，压低、过低通
    'engine.run': { n: 1, vol: 0.3, pitch: 0, limit: 2 },         // 蒸汽机行驶喷吐（循环，速度跟车速）
    'track.clank': { n: 3, vol: 0.3, pitch: 0.12, limit: 6 },    // 履带：每过一节履带板响一下
    'hit.thud': { n: 4, vol: 0.7, pitch: 0.08, limit: 5 },        // 中弹的闷响层
    'hit.ping': { n: 2, vol: 0.45, pitch: 0.15, limit: 4 },       // 中弹的金属「嘣」层（很短）
    'hit.shell': { n: 3, vol: 0.85, pitch: 0.06, limit: 3 },      // 炮弹打在车上
    'hit.ricochet': { n: 3, vol: 1, pitch: 0.1, limit: 3 },     // 跳弹
    'steam.hiss': { n: 3, vol: 0.6, pitch: 0.08, limit: 2 },
    'chain': { n: 2, vol: 0.6, pitch: 0.08, limit: 2 },
    'ui.click': { n: 3, vol: 0.5, pitch: 0.04, limit: 2, bus: 'ui' },
    'ui.switch': { n: 3, vol: 0.5, pitch: 0.04, limit: 2, bus: 'ui' },
    'ui.confirm': { n: 1, vol: 0.55, pitch: 0, limit: 1, bus: 'ui' },
    'ui.error': { n: 1, vol: 0.5, pitch: 0, limit: 1, bus: 'ui' },
  };
  const file = (name, i) => `${name.replace(/\./g, '-')}-${i}.wav`;
  const base = (() => { try { return new URL('../audio/', document.currentScript.src).href; } catch (e) { return 'audio/'; } })();
  const KEY = 'sa-audio';
  const set = { master: 1, sfx: 0.7, ui: 0.6, mute: false };
  try { Object.assign(set, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 隐私模式读不到也没关系 */ }
  let ctx = null, out = null, buses = null;
  const buffers = new Map(), loading = new Map(), live = new Map(), lastVar = new Map(), recent = new Map(), loops = new Map();

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();   // 总线限幅：很多声音叠在一起也不爆
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
    buses = { sfx: ctx.createGain(), ui: ctx.createGain() };
    for (const b of Object.values(buses)) b.connect(out);
    apply();
    return ctx;
  }
  function apply() {
    if (!ctx) return;
    out.gain.value = set.mute ? 0 : set.master;
    buses.sfx.gain.value = set.sfx; buses.ui.gain.value = set.ui;
  }
  function settings(patch) {
    if (patch) { Object.assign(set, patch); try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) { /* 存不了就只在本次生效 */ } apply(); }
    return { ...set };
  }
  // 浏览器要求用户先点一下或按一下键才能出声：挂一次就够
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true, passive: true });

  function fetchBuf(name, i) {
    const key = `${name}#${i}`;
    if (buffers.has(key)) return Promise.resolve(buffers.get(key));
    if (loading.has(key)) return loading.get(key);
    const c = ensure();
    if (!c) return Promise.resolve(null);
    const p = fetch(base + file(name, i)).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then(ab => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
      .then(buf => { buffers.set(key, buf); return buf; })
      .catch(() => null).finally(() => loading.delete(key));
    loading.set(key, p);
    return p;
  }
  // 预载：名字列表（不传 = 全部）。没加载完时 play 会先发起加载、这一声跳过
  function load(names = Object.keys(BANK)) {
    return Promise.all(names.flatMap(n => BANK[n] ? Array.from({ length: BANK[n].n }, (_, i) => fetchBuf(n, i)) : []));
  }

  // o：x（0～1，屏幕上的横向位置 → 左右声道）、vol（0～1 额外音量）、pitch（音高倍率）、v（指定变体）
  function play(name, o = {}) {
    const b = BANK[name];
    if (!b || set.mute) return null;
    const c = ensure();
    if (!c || c.state !== 'running') return null;
    const now = c.currentTime;
    // 30ms 内同名的声音并成一个更响的，不一下下叠
    const r = recent.get(name);
    if (r && now - r.t < 0.03) { r.g.gain.value = Math.min(r.g.gain.value * 1.25, r.max); return null; }
    const n = live.get(name) || 0;
    if (n >= (b.limit || 4)) return null;
    let v = o.v != null ? o.v : Math.floor(Math.random() * b.n);
    if (o.v == null && b.n > 1 && v === lastVar.get(name)) v = (v + 1) % b.n;   // 不连着放同一个变体
    lastVar.set(name, v);
    const buf = buffers.get(`${name}#${v}`);
    if (!buf) { fetchBuf(name, v); return null; }
    const src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.pitch || 1) * (1 + (Math.random() * 2 - 1) * (b.pitch || 0));
    const g = c.createGain(); const vol = b.vol * (o.vol == null ? 1 : o.vol); g.gain.value = vol;
    let node = src;
    // o.lp：低通（Hz），滤掉刺耳的高频（履带、脚步用）
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.5; node.connect(f); node = f; }
    node.connect(g); node = g;
    if (o.x != null && c.createStereoPanner) { const pan = c.createStereoPanner(); pan.pan.value = Math.max(-0.8, Math.min(0.8, (o.x - 0.5) * 1.6)); node.connect(pan); node = pan; }
    node.connect(buses[b.bus || 'sfx']);
    live.set(name, n + 1);
    src.onended = () => live.set(name, Math.max(0, (live.get(name) || 1) - 1));
    src.start();
    recent.set(name, { t: now, g, max: Math.min(1.6, vol * 1.8) });
    return src;
  }
  // 持续声（发动机、蒸汽嘶）：同一个 key 只放一条，循环到 stop；o.rate = 播放速度（同时变调），o.x = 左右位置
  function loop(name, key, o = {}) {
    if (loops.has(key)) { setLoop(key, o); return; }
    const b = BANK[name], c = ensure();
    if (!b || !c || c.state !== 'running' || set.mute) return;
    const buf = buffers.get(`${name}#0`);
    if (!buf) { fetchBuf(name, 0); return; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = o.rate || 1;
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(b.vol * (o.vol == null ? 1 : o.vol), c.currentTime + 0.25);
    // 低通（o.lp，Hz）：去掉刺耳的高频，听着更暖
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 20000; lp.Q.value = 0.5;
    let node = g; src.connect(lp); lp.connect(g);
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = o.x != null ? Math.max(-0.8, Math.min(0.8, (o.x - 0.5) * 1.6)) : 0; g.connect(pan); node = pan; }
    node.connect(buses[b.bus || 'sfx']); src.start();
    loops.set(key, { src, g, pan, lp, base: b.vol });
  }
  // 实时调一条循环：音量、播放速度、左右位置都平滑过渡（不咔哒）
  function setLoop(key, o = {}) {
    const L = loops.get(key);
    if (!L || !ctx) return;
    const t = ctx.currentTime;
    if (o.vol != null) L.g.gain.setTargetAtTime(L.base * o.vol, t, 0.06);
    if (o.rate != null) L.src.playbackRate.setTargetAtTime(Math.max(0.3, Math.min(3, o.rate)), t, 0.08);
    if (o.x != null && L.pan) L.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, (o.x - 0.5) * 1.6)), t, 0.08);
    if (o.lp != null && L.lp) L.lp.frequency.setTargetAtTime(o.lp, t, 0.1);
  }
  function stop(key) {
    const L = loops.get(key);
    if (!L || !ctx) return;
    L.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12); L.src.stop(ctx.currentTime + 0.14);
    loops.delete(key);
  }
  const stopAll = () => { for (const k of [...loops.keys()]) stop(k); };
  return { BANK, file, base, play, loop, setLoop, stop, stopAll, load, settings, unlock, ctx: () => ctx };
})();
