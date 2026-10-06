// 音效素材处理（docs/feel-audio-plan.md §3.1）：把 tools/out/audio-src/ 里下载好的 CC0 原始素材
// 解码 → 混成单声道 → 切掉首尾静音 → 截到最长时长、收尾淡出 → 重采样到 22.05 kHz → 响度统一（RMS -18 dBFS，峰值不过 -1 dBFS）→ 16 位 WAV。
// 页面 tools/audio-prep.html 可以逐个试听原始 / 处理后的声音；node tools/audio-export.mjs 无头跑一遍、把结果写进 audio/。
// 原始素材不进仓库（tools/out/ 不提交），来源和下载地址见 audio/LICENSES.md。
window.SA = window.SA || {};

SA.AudioPrep = (() => {
  const SRC = new URL('out/audio-src/', document.currentScript ? document.currentScript.src : location.href).href;
  const KI = 'kenney_impact-sounds/Audio/', KS = 'kenney_sci-fi-sounds/Audio/', KR = 'kenney_rpg-audio/Audio/', KU = 'kenney_ui-audio/Audio/', KF = 'kenney_interface-sounds/Audio/', BG = '25-CC0-bang-sfx/';
  const seq = (pre, from, n, pad = 3, ext = '.ogg') => Array.from({ length: n }, (_, i) => `${pre}${String(from + i).padStart(pad, '0')}${ext}`);
  // 名字（和 js/audio.js 的 BANK 一一对应）→ 原始文件（按变体顺序）
  const MAP = {
    'crush.wood': [...seq(KI + 'impactWood_heavy_', 0, 3), KI + 'impactPlank_medium_000.ogg'],
    'crush.machine': seq(KI + 'impactTin_medium_', 0, 4),
    'crush.rock': seq(KI + 'impactMining_', 0, 3),
    'hit.plate': seq(KI + 'impactPlate_heavy_', 0, 4),
    'hit.metal.light': seq(KI + 'impactMetal_light_', 0, 4),
    'hit.metal.medium': seq(KI + 'impactMetal_medium_', 0, 4),
    'hit.metal.heavy': seq(KI + 'impactMetal_heavy_', 0, 4),
    'ram.thud': seq(KI + 'impactPunch_heavy_', 0, 4),
    'scrap.pickup': [KR + 'handleCoins.ogg', KR + 'handleCoins2.ogg'],
    'boom': seq(KS + 'explosionCrunch_', 0, 3),
    'boom.big': seq(KS + 'lowFrequency_explosion_', 0, 2),
    'cannon.fire': ['cannon_fire_0.ogg', ...seq(BG + 'cannon_', 1, 3, 2)],
    'cannon.hit': ['cannon_hit_1.ogg', 'cannon_hit_cannon_1.ogg', 'cannon_hit_ship_short.ogg'],
    'gun.shot': [...seq(BG + 'shot_', 1, 3, 2), BG + 'bang_01.ogg'],
    'steam.hiss': [1, 2, 3].map(i => `steam_hisses/steam hisses - Marker #${i}.wav`),
    'chain': [KR + 'metalLatch.ogg', KR + 'metalClick.ogg'],
    'ui.click': [1, 2, 3].map(i => `${KU}click${i}.ogg`),
    'ui.switch': [2, 3, 7].map(i => `${KU}switch${i}.ogg`),
    'ui.confirm': [KF + 'confirmation_001.ogg'],
    'ui.error': [KF + 'error_001.ogg'],
  };
  // 最长时长（秒）：炮声、爆炸留尾音，其余短促
  const MAXLEN = { 'cannon.fire': 2.2, 'cannon.hit': 2.0, 'boom': 1.8, 'boom.big': 2.6, 'steam.hiss': 1.4 };
  const RATE = 22050, PEAK = 0.89, THR = 0.004, TARGET = -18;   // 峰值上限 -1 dBFS；目标响度 RMS -18 dBFS；静音门限约 -48 dBFS
  const url = (p) => SRC + p.split('/').map(encodeURIComponent).join('/');

  async function decode(path) {
    const ab = await (await fetch(url(path))).arrayBuffer();
    return new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab);
  }
  // 处理一条：返回 { buf（AudioBuffer，22.05 kHz 单声道）, peak, rms, dur, srcDur }
  async function prep(name, path) {
    const src = await decode(path), sr = src.sampleRate, n = src.length, ch = src.numberOfChannels;
    const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = src.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
    let a = 0, b = n - 1;
    while (a < n && Math.abs(mono[a]) < THR) a++;
    while (b > a && Math.abs(mono[b]) < THR) b--;
    a = Math.max(0, a - Math.round(sr * 0.004));
    const maxN = Math.round(sr * (MAXLEN[name] || 1.6)), capped = b - a + 1 > maxN;
    const len = Math.max(1, Math.min(b - a + 1 + Math.round(sr * 0.01), maxN, n - a));
    const cut = new Float32Array(len); cut.set(mono.subarray(a, a + len));
    const fin = Math.min(len, Math.round(sr * 0.002)), fout = Math.min(len, Math.round(sr * (capped ? 0.25 : 0.03)));
    for (let i = 0; i < fin; i++) cut[i] *= i / fin;
    for (let i = 0; i < fout; i++) cut[len - 1 - i] *= i / fout;
    // 重采样：交给 OfflineAudioContext（带抗混叠）
    const outLen = Math.max(1, Math.round(len * RATE / sr)), off = new OfflineAudioContext(1, outLen, RATE);
    const tmp = off.createBuffer(1, len, sr); tmp.copyToChannel(cut, 0);
    const s = off.createBufferSource(); s.buffer = tmp; s.connect(off.destination); s.start();
    const res = await off.startRendering(), d = res.getChannelData(0);
    // 响度：先把峰值推到 -1 dBFS，比目标响度（RMS -18 dBFS）还响的再压下来，同一名字的几个变体就差不多一样响
    let pk = 0, e0 = 0; for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); e0 += d[i] * d[i]; }
    const rms0 = Math.sqrt(e0 / d.length) || 1e-9, kPeak = pk > 0 ? PEAK / pk : 1, kRms = Math.pow(10, TARGET / 20) / rms0;
    const k = Math.min(kPeak, kRms); let e = 0, pk2 = 0;
    for (let i = 0; i < d.length; i++) { d[i] *= k; e += d[i] * d[i]; pk2 = Math.max(pk2, Math.abs(d[i])); }
    return { buf: res, peak: pk2, rms: 20 * Math.log10(Math.sqrt(e / d.length) || 1e-9), dur: d.length / RATE, srcDur: n / sr };
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
        report.push({ name, i, src: list[i], dur: +r.dur.toFixed(3), srcDur: +r.srcDur.toFixed(3), rms: +r.rms.toFixed(1), kb: Math.round(w.byteLength / 1024) });
      }
    }
    return { files, report };
  }
  return { MAP, MAXLEN, SRC, url, decode, prep, wav, exportAll };
})();
