// 音效素材处理（docs/feel-audio-plan.md §3.1）：把 tools/out/audio-src/ 里下载好的 CC0 原始素材
// 解码 → 混成单声道 → 切掉首尾静音 → 截到最长时长、收尾淡出 → 重采样到 22.05 kHz → 响度统一（RMS -18 dBFS，峰值不过 -1 dBFS）→ 16 位 WAV。
// 页面 tools/audio-prep.html 可以逐个试听原始 / 处理后的声音；node tools/audio-export.mjs 无头跑一遍、把结果写进 audio/。
// 原始素材不进仓库（tools/out/ 不提交），来源和下载地址见 audio/LICENSES.md。
window.SA = window.SA || {};

SA.AudioPrep = (() => {
  const SRC = new URL('out/audio-src/', document.currentScript ? document.currentScript.src : location.href).href;
  const KI = 'kenney_impact-sounds/Audio/', KS = 'kenney_sci-fi-sounds/Audio/', KR = 'kenney_rpg-audio/Audio/', KU = 'kenney_ui-audio/Audio/', KF = 'kenney_interface-sounds/Audio/', BG = '25-CC0-bang-sfx/';
  const seq = (pre, from, n, pad = 3, ext = '.ogg') => Array.from({ length: n }, (_, i) => `${pre}${String(from + i).padStart(pad, '0')}${ext}`);
  // 第二批（2026-10-09 用户批准）：做游戏用的音效。Mixkit（免费商用、不用署名）+ Freesound CC0，放在 game2/
  const MK = (id) => `game2/mixkit-${id}.mp3`, FS = (id) => `game2/freesound-${id}.mp3`;
  // 条目可以是文件名，也可以是 { f: 文件, at: 从第几秒起, len: 切多长（秒）, loop: true = 做成无缝循环 }
  const cut = (f, at, len) => ({ f, at, len });
  // 名字（和 js/audio.js 的 BANK 一一对应）→ 原始文件（按变体顺序）
  const MAP = {
    'crush.wood': [...seq(KI + 'impactWood_heavy_', 0, 3), KI + 'impactPlank_medium_000.ogg'],
    'crush.machine': seq(KI + 'impactTin_medium_', 0, 4),
    'crush.rock': seq(KI + 'impactMining_', 0, 3),
    'hit.plate': seq(KI + 'impactPlate_heavy_', 0, 4),
    'hit.metal.light': seq(KI + 'impactMetal_light_', 0, 4),
    'hit.metal.medium': seq(KI + 'impactMetal_medium_', 0, 4),
    'hit.metal.heavy': [MK(2980), MK(833), cut(MK(783), 0, 1.2), KI + 'impactMetal_heavy_000.ogg'],
    // 中弹（2026-10-09 第三批）：一发打在车上 = 闷响层 + 很短的金属「嘣」层（只留最脆的头，切掉会嗡嗡响的尾音）；炮弹另有带炸裂感的重击
    'hit.thud': [cut(MK(2655), 0.01, 0.35), cut(MK(2150), 0.1, 0.32), cut(MK(2299), 0.05, 0.35), cut(MK(2143), 0.02, 0.22)],
    'hit.ping': [cut(MK(2765), 0.03, 0.16), cut(MK(2795), 0.06, 0.2)],
    'hit.shell': [cut(MK(1687), 0, 1.1), cut(MK(3046), 1.45, 1.0), cut(MK(2795), 0.06, 0.5)],
    'hit.ricochet': [cut(FS(30932), 0, 0.6), cut(FS(30932), 0.95, 0.6), cut(FS(30932), 1.58, 0.75)],
    'ram.thud': seq(KI + 'impactPunch_heavy_', 0, 4),
    'scrap.pickup': [KR + 'handleCoins.ogg', KR + 'handleCoins2.ogg'],
    // 爆炸、炮声、枪声（第二批，游戏音效）
    'boom': [MK(2809), MK(2800), MK(1694), MK(1687)],
    'boom.big': [MK(2777), MK(2782)],
    'cannon.fire': [FS(127845), FS(162455), MK(1700), MK(2773)],               // 中、大口径炮
    'cannon.small': [MK(1662), FS(165390), MK(2186)],                           // 小炮、小臼炮、鱼叉、步哨炮车
    'cannon.hit': [MK(2758), MK(2801), MK(2186)],                               // 炮弹落地
    // 机枪：从连发录音里切单发（带完整尾音的那几发）；重机枪单独一组
    'gun.shot': [cut(FS(165394), 0.035, 0.17), cut(FS(165394), 0.385, 0.17), cut(FS(380349), 1.6, 0.2), cut(FS(380349), 2.165, 0.2)],
    'gun.heavy': [cut(FS(396324), 0.115, 0.22), cut(FS(396324), 0.235, 0.22), cut(FS(396324), 0.355, 0.24)],
    // 发动机：怠速（坦克发动机最平稳的 4 秒）+ 行驶（老火车出站里平稳的 10 下蒸汽喷吐，1.9 秒，播放速度跟车速走）
    'engine.idle': [{ f: MK(2753), at: 0.6, len: 4, loop: true }],
    'engine.run': [{ f: MK(1628), at: 37.55, len: 1.9, loop: true }],
    // 履带：每过一节履带板响一下金属咔哒（齿轮锁、换挡的金属声切短）
    'track.clank': [cut(MK(2858), 0.06, 0.13), cut(MK(2858), 0.2, 0.18), cut(MK(2857), 0.07, 0.18), cut(MK(2757), 0.1, 0.22)],
    'steam.hiss': [1, 2, 3].map(i => `steam_hisses/steam hisses - Marker #${i}.wav`),
    'chain': [KR + 'metalLatch.ogg', KR + 'metalClick.ogg'],
    'ui.click': [1, 2, 3].map(i => `${KU}click${i}.ogg`),
    'ui.switch': [2, 3, 7].map(i => `${KU}switch${i}.ogg`),
    'ui.confirm': [KF + 'confirmation_001.ogg'],
    'ui.error': [KF + 'error_001.ogg'],
  };
  // 最长时长（秒）：炮声、爆炸留尾音，其余短促
  const MAXLEN = { 'cannon.fire': 2.4, 'cannon.small': 1.2, 'cannon.hit': 2.0, 'boom': 2.0, 'boom.big': 3.0, 'steam.hiss': 1.4, 'hit.metal.heavy': 1.2 };
  const RATE = 22050, PEAK = 0.89, THR = 0.004, TARGET = -18;   // 峰值上限 -1 dBFS；目标响度 RMS -18 dBFS；静音门限约 -48 dBFS
  const url = (p) => SRC + p.split('/').map(encodeURIComponent).join('/');

  async function decode(path) {
    const ab = await (await fetch(url(path))).arrayBuffer();
    return new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab);
  }
  // 处理一条：返回 { buf（AudioBuffer，22.05 kHz 单声道）, peak, rms, dur, srcDur }
  async function prep(name, item) {
    const it = typeof item === 'string' ? { f: item } : item;
    const src = await decode(it.f), sr = src.sampleRate, ch = src.numberOfChannels;
    // 切片：只取 [at, at + len)
    const s0 = Math.round((it.at || 0) * sr), s1 = it.len ? Math.min(src.length, s0 + Math.round(it.len * sr)) : src.length, n = s1 - s0;
    const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = src.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[s0 + i] / ch; }
    if (it.loop) return finish(loopify(mono, sr), sr, src.duration);
    let a = 0, b = n - 1;
    while (a < n && Math.abs(mono[a]) < THR) a++;
    while (b > a && Math.abs(mono[b]) < THR) b--;
    a = Math.max(0, a - Math.round(sr * 0.004));
    const maxN = Math.round(sr * (MAXLEN[name] || 1.6)), capped = b - a + 1 > maxN;
    const len = Math.max(1, Math.min(b - a + 1 + Math.round(sr * 0.01), maxN, n - a));
    const seg = new Float32Array(len); seg.set(mono.subarray(a, a + len));
    // 切片的结尾一定是硬切的（下一发要来了），收尾淡出放长一点
    const fin = Math.min(len, Math.round(sr * 0.002)), fout = Math.min(len, Math.round(sr * (capped ? 0.25 : it.len ? 0.06 : 0.03)));
    for (let i = 0; i < fin; i++) seg[i] *= i / fin;
    for (let i = 0; i < fout; i++) seg[len - 1 - i] *= i / fout;
    return finish(seg, sr, src.duration);
  }
  // 无缝循环：尾部 60ms 和开头交叉淡化，再把尾部这段去掉——首尾接上时没有咔哒声
  function loopify(x, sr) {
    const X = Math.min(Math.round(sr * 0.06), Math.floor(x.length / 4)), n = x.length - X, out = new Float32Array(n);
    out.set(x.subarray(0, n));
    for (let i = 0; i < X; i++) { const k = i / X; out[i] = x[i] * k + x[n + i] * (1 - k); }
    return out;
  }
  async function finish(seg, sr, srcDur) {
    const len = seg.length;
    // 重采样：交给 OfflineAudioContext（带抗混叠）
    const outLen = Math.max(1, Math.round(len * RATE / sr)), off = new OfflineAudioContext(1, outLen, RATE);
    const tmp = off.createBuffer(1, len, sr); tmp.copyToChannel(seg, 0);
    const s = off.createBufferSource(); s.buffer = tmp; s.connect(off.destination); s.start();
    const res = await off.startRendering(), d = res.getChannelData(0);
    // 响度：先把峰值推到 -1 dBFS，比目标响度（RMS -18 dBFS）还响的再压下来，同一名字的几个变体就差不多一样响
    let pk = 0, e0 = 0; for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); e0 += d[i] * d[i]; }
    const rms0 = Math.sqrt(e0 / d.length) || 1e-9, kPeak = pk > 0 ? PEAK / pk : 1, kRms = Math.pow(10, TARGET / 20) / rms0;
    const k = Math.min(kPeak, kRms); let e = 0, pk2 = 0;
    for (let i = 0; i < d.length; i++) { d[i] *= k; e += d[i] * d[i]; pk2 = Math.max(pk2, Math.abs(d[i])); }
    return { buf: res, peak: pk2, rms: 20 * Math.log10(Math.sqrt(e / d.length) || 1e-9), dur: d.length / RATE, srcDur };
  }
  // 16 位单声道 WAV
  function wav(buf) {
    const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
    return ab;
  }
  const b64 = (ab) => { const u = new Uint8Array(ab); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  // 全部处理：{ 文件名: base64 WAV }，外加一份测量表
  async function exportAll() {
    const files = {}, report = [];
    for (const [name, list] of Object.entries(MAP)) {
      for (let i = 0; i < list.length; i++) {
        const r = await prep(name, list[i]), f = SA.Audio.file(name, i), w = wav(r.buf);
        files[f] = b64(w);
        report.push({ name, i, src: typeof list[i] === 'string' ? list[i] : `${list[i].f}@${list[i].at || 0}+${list[i].len || ''}${list[i].loop ? ' loop' : ''}`, dur: +r.dur.toFixed(3), srcDur: +r.srcDur.toFixed(3), rms: +r.rms.toFixed(1), kb: Math.round(w.byteLength / 1024) });
      }
    }
    return { files, report };
  }
  return { MAP, MAXLEN, SRC, url, decode, prep, wav, exportAll };
})();
