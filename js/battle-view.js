/* 竞技场画面层：只负责画布、镜头、HUD、输入和视觉事件呈现。规则状态由 battle.js 提供接口。 */
window.SA = window.SA || {};
SA.BattleView = SA.BattleView || {};
SA.BattleView.create = function createBattleView(api) {
  const h = SA.h, K = SA.K, T = K.BATTLE, M = SA.MODULES, P = SA.PAL, C = K.CELL, PADX = SA.SPR.PADX;
  const W = 1280, H = 720, GROUND = 648, VY = GROUND - K.ROWS * C;
  const VW = K.COLS * C + PADX * 2;
  const HALF = C / 2;
  const alive = api.alive, clamp = api.clamp, rnd = api.rnd, gauss = api.gauss;
  const camera = api.camera;
  const isP = api.isP, cellX = api.cellX, cellY = api.cellY, frontEdge = api.frontEdge;
  const groundAt = api.groundAt, crateAt = api.crateAt, modBox = api.modBox, modCenter = api.modCenter, cellAt = api.cellAt, modAt = api.modAt;
  const muzzle = api.muzzle, targetAt = api.targetAt, aimAngle = api.aimAngle, spreadDeg = api.spreadDeg, barrel = api.barrel, predict = api.predict;
  const tiltOf = api.tiltOf, pivY = api.pivY, toWorld = api.toWorld;
  const crippled = api.crippled, step = api.step;
  let B = null, cv, g, dg, wc, wrap, hud = {};
  let DPX = 1;
  const ZMIN = 0.62;
  const sync = () => { B = api.getState(); return B; };
  const part = (type, x, y, vx, vy, life, col) => emit('part', { type, x, y, vx, vy, life, col });
  const vr = (a, b) => a + Math.random() * (b - a);
  const vpart = (type, x, y, vx, vy, life, col) => B.parts.push({ type, x, y, vx, vy, life, max: life, col, spin: vr(8, 22) });
  const SHARDS = { plate: 7, armor: 10, armor_heavy: 14 };
  function ricochetFx(x, y, back) {
    if (B.headless) return;
    vpart('ping', x, y, 0, 0, 0.22);
    const a = vr(0.35, 0.95), sp = vr(430, 560);
    vpart('glance', x, y, back * Math.cos(a) * sp, -Math.sin(a) * sp, 0.3);
    for (let i = 0; i < 2; i++) { const b = vr(0.2, 1.3), v = vr(220, 360); vpart('glance', x, y, back * Math.cos(b) * v * (i ? 1 : -0.6), -Math.sin(b) * v, 0.16); }
    for (let i = 0; i < 9; i++) vpart('spark', x, y, back * vr(20, 190), vr(-220, -20), vr(0.12, 0.3), i % 3 ? P.white : P.brass[3]);
    B.texts.push({ str: '弹开', x: x + vr(-6, 6), y: y - 34, life: 1, max: 1, col: P.iron[4], plaque: P.glass[2] });
  }
  function shatterFx(x, y, cell) {
    if (B.headless || !SHARDS[cell.id]) return;
    const mat = SA.MATS[cell.mt || 1], cols = [P.iron[3], P.iron[4], cell.mt > 1 ? mat.chip : P.iron[2]];
    for (let i = 0; i < SHARDS[cell.id]; i++) vpart('shard', x + vr(-10, 10), y + vr(-10, 10), vr(-170, 170), vr(-280, -80), vr(1.1, 1.8), cols[i % 3]);
    vpart('ping', x, y, 0, 0, 0.18);
  }
  function emit(type, data = {}) {
    sync();
    if (!B || B.headless) return;
    if (type === 'part') B.parts.push({ ...data, max: data.life });
    else if (type === 'text') B.texts.push({ ...data, life: data.life == null ? 0.9 : data.life });
    else if (type === 'particles') for (const p of data.items || []) B.parts.push({ ...p, max: p.life });
    else if (type === 'texts') for (const t of data.items || []) B.texts.push({ ...t, life: t.life == null ? 0.9 : t.life });
    else if (type === 'ricochet') ricochetFx(data.x, data.y, data.back);
    else if (type === 'shatter') shatterFx(data.x, data.y, data.cell);
    else if (type === 'surrender') {
      const e = B.e, why = data.why;
      SA.UI.dialog(`「${e.name}」挂出了白旗`, [
        h('p', { style: 'margin-top:0' }, `对手${why}，已经没法再打，请求投降。`),
        h('p', {}, h('b', {}, '接受：'), '立即获胜，对手剩下的零件原样保留（缴获的选择更多），体面收场额外 ', h('b', {}, '声望 +1'), '。'),
        h('p', { class: 'muted' }, '拒绝：比赛继续，你可以把它拆得更彻底；这场不会再问第二次。'),
      ], [{ label: '接受投降', primary: true, onClick: () => api.acceptSurrender() }], '拒绝，继续打', () => api.refuseSurrender());
    }
  }
  // ---------- 背景：一座圆形竞技场 ----------
  // 场地左右无限延伸。天空固定；远处的厂房和一圈看台画在「圆筒」上：屏幕中间 1:1、越往两边越压缩，
  // 镜头跟着车移动时看台跟着转，看起来像车在绕着圆形竞技场跑。地面（和地形）在世界坐标里，跟车 1:1 移动
  const HZ = GROUND - 240, GS = HZ, GE = GROUND - 110;
  const TW = 1248;   // 可平铺纹理的周期：人群 6、旗 26、柱 48、地面刻痕 48 都能整除
  let BD = null;
  function buildBackdrop() {
    const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return [c, c.getContext('2d')]; };
    let seed = 7;
    const rr = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    // 天空（固定不动）
    const [sky, x] = mk(W, HZ);
    const band = (y0, y1, col) => { x.fillStyle = col; x.fillRect(0, y0, W, y1 - y0); };
    const b1 = Math.round(HZ * 0.3), b2 = Math.round(HZ * 0.62);
    band(0, b1, P.bg[3]); band(b1, b2, P.bg[4]); band(b2, HZ, P.bg[5]);
    for (const [y, col] of [[b1, P.bg[4]], [b2, P.bg[5]]])
      for (let i = 0; i < W; i += 2) { x.fillStyle = col; x.fillRect(i + 1, y - 4, 1, 1); x.fillRect(i, y - 2, 1, 1); x.fillRect(i + 1, y - 1, 1, 1); }
    x.fillStyle = P.bg[6];
    const sunY = Math.round(HZ * 0.42);
    for (let yy = -40; yy <= 40; yy++) { const w = Math.sqrt(1600 - yy * yy); x.fillRect(Math.round(W * 0.76 - w), sunY + yy, Math.round(w * 2), 1); }
    // 远处的厂房：一圈 TW 宽可平铺，画成两圈宽（采样跨过接缝时不用拆两段）
    const [line, y] = mk(TW * 2, HZ);
    for (let i = 0; i < 18; i++) {
      const bx0 = Math.round(rr() * TW), bw = Math.round(48 + rr() * 90), bh = Math.round(40 + rr() * 110), ch = 54 + Math.round(rr() * 40);
      for (const bx of [bx0 - TW, bx0, bx0 + TW, bx0 + 2 * TW]) {
        y.fillStyle = P.bg[3]; y.fillRect(bx, HZ - bh, bw, bh);
        y.fillRect(bx + Math.round(bw * 0.3), HZ - bh - ch, 12, 66);
        y.fillStyle = P.bg[4];
        for (let k = 0; k < Math.floor(bw / 18); k++) y.fillRect(bx + 8 + k * 18, HZ - bh + 14, 6, 9);
      }
    }
    // 看台：人群、彩旗、围栏（一圈 TW，复制成两圈）
    const S0 = GS - 5;
    const [stands, z] = mk(TW * 2, GE + 14 - S0);
    z.fillStyle = P.bg[2]; z.fillRect(0, GS - S0, TW, GE - GS);
    for (let yy = GS + 8; yy < GE - 8; yy += 13) {
      z.fillStyle = P.bg[1]; z.fillRect(0, yy + 9 - S0, TW, 3);
      for (let i = 0; i < TW; i += 6) {
        const v = rr();
        if (v < 0.7) { z.fillStyle = v < 0.25 ? P.bg[4] : v < 0.5 ? P.bg[3] : P.bg[5]; z.fillRect(i, yy + 2 - S0, 4, 6); z.fillRect(i + 1, yy - S0, 2, 2); }
      }
    }
    for (let i = 0; i < TW; i += 26) { z.fillStyle = (i / 26) % 2 ? P.bg[5] : P.bg[4]; z.fillRect(i, 0, 16, 4); z.fillRect(i + 3, 4, 10, 3); z.fillRect(i + 6, 7, 4, 3); }
    z.fillStyle = P.bg[1]; z.fillRect(0, GE - S0, TW, 14);
    for (let i = 0; i < TW; i += 48) { z.fillStyle = P.bg[0]; z.fillRect(i, GE - 6 - S0, 8, 20); }
    z.drawImage(stands, 0, 0, TW, stands.height, TW, 0, TW, stands.height);
    // 竞技场外（遭遇战）：没有看台和观众，换成工厂砖墙 + 煤气路灯 + 管道，墙头只有铁丝和烟囱影子
    const [wall, wz] = mk(TW * 2, GE + 14 - S0);
    const wTop = GS + 10 - S0, wBot = GE - S0;
    wz.fillStyle = P.bg[2]; wz.fillRect(0, wTop, TW, wBot - wTop);
    for (let yy = wTop; yy < wBot; yy += 6) {   // 砖缝：错缝砌
      wz.fillStyle = P.bg[1]; wz.fillRect(0, yy, TW, 1);
      for (let i = ((yy - wTop) / 6) % 2 ? 6 : 0; i < TW; i += 12) wz.fillRect(i, yy, 1, 6);
      for (let i = 0; i < TW; i += 12) if (rr() < 0.12) { wz.fillStyle = P.bg[3]; wz.fillRect(i + 2, yy + 2, 8, 3); wz.fillStyle = P.bg[1]; }
    }
    wz.fillStyle = P.bg[3]; wz.fillRect(0, wTop - 4, TW, 4); wz.fillStyle = P.bg[1]; wz.fillRect(0, wTop, TW, 1);   // 墙头压顶
    for (let i = 0; i < TW; i += 7) { wz.fillStyle = P.bg[1]; wz.fillRect(i, wTop - 9, 1, 5); }   // 铁丝桩
    wz.fillStyle = P.bg[1]; wz.fillRect(0, wTop - 8, TW, 1);
    for (let i = 0; i < TW; i += 150) {   // 两根横走的管道 + 法兰
      wz.fillStyle = P.bg[4]; wz.fillRect(i, wTop + 14, 110, 4); wz.fillStyle = P.bg[5]; wz.fillRect(i, wTop + 14, 110, 1);
      for (let k = 0; k < 110; k += 36) { wz.fillStyle = P.bg[3]; wz.fillRect(i + k, wTop + 12, 3, 8); }
    }
    for (let i = 40; i < TW; i += 120) {   // 煤气路灯：灯柱 + 暖黄灯罩（唯一的一点暖光）
      wz.fillStyle = P.bg[0]; wz.fillRect(i, wTop - 22, 3, wBot - wTop + 22); wz.fillRect(i - 5, wTop - 24, 13, 3);
      wz.fillStyle = P.fire[1]; wz.fillRect(i - 3, wTop - 21, 9, 6); wz.fillStyle = P.fire[3]; wz.fillRect(i - 1, wTop - 20, 5, 3);
    }
    for (let i = 90; i < TW; i += 260) { wz.fillStyle = P.bg[1]; wz.fillRect(i, wTop + 22, 44, wBot - wTop - 22); wz.fillStyle = P.bg[0];   // 关着的厂门
      for (let k = 4; k < 44; k += 8) wz.fillRect(i + k, wTop + 24, 1, wBot - wTop - 26); }
    wz.fillStyle = P.bg[1]; wz.fillRect(0, wBot, TW, 14);
    wz.drawImage(wall, 0, 0, TW, wall.height, TW, 0, TW, wall.height);
    // 地面：世界坐标里平铺（跟车 1:1 移动）
    const F0 = GE + 14;
    const [floor, f] = mk(TW, H - F0);
    f.fillStyle = P.bg[3]; f.fillRect(0, 0, TW, GROUND - F0);
    for (let i = 0; i < 900; i++) { f.fillStyle = rr() < 0.5 ? P.bg[2] : P.bg[4]; f.fillRect(Math.round(rr() * TW), Math.round(rr() * (GROUND - F0)), 4, 1); }
    f.fillStyle = P.bg[2]; f.fillRect(0, GROUND - F0, TW, H - GROUND);
    f.fillStyle = P.bg[4]; f.fillRect(0, GROUND - F0, TW, 1);
    for (let i = 0; i < TW; i += 48) { f.fillStyle = P.bg[1]; f.fillRect(i, GROUND - F0 + 18, 30, 4); }
    return { sky, line, stands, wall, floor, S0, F0 };
  }
  // 圆筒映射：屏幕列 sx → 纹理坐标 rot + asin(u·K0)·R（u = 离屏幕中心的比例）。中间一个屏幕像素 = 1/z 个纹理像素（和世界一样的缩放），两边压缩
  // 这里画在世界层里：1 个画布像素 = 1 个纹理像素（和车一样），最后和车一起整体放大，像素大小一致
  function drum(tex, wy0, rot, vw, oy) {
    const K0 = 0.82, R = (vw / 2) / K0, per = tex.width / 2, th = tex.height;
    const y = Math.round(wy0 - oy), STEP = 4;
    const tx = (sx) => rot + Math.asin(clamp((sx - vw / 2) / (vw / 2), -1, 1) * K0) * R;
    let t0 = tx(0);
    for (let sx = 0; sx < vw; sx += STEP) {
      const t1 = tx(sx + STEP), u = ((t0 % per) + per) % per;
      g.drawImage(tex, Math.floor(u), 0, Math.max(1, Math.round(t1 - t0)), th, sx, y, STEP, th);
      t0 = t1;
    }
  }
  // 背景：天空 → 远处厂房（转得慢）→ 看台（像绕着场地转）→ 两边压暗，显出圆筒感。
  // 画在世界层的「视口像素」里（左上角 = 取整后的镜头角 ox, oy），vw × vh 是镜头看到的世界像素
  function drawBackdrop(vw, vh, oy) {
    const cam = B.cam;
    g.fillStyle = P.bg[3]; g.fillRect(0, 0, vw, vh);
    const sw = Math.max(vw, W);   // 天空不跟镜头缩放：拉远时也铺满
    g.drawImage(BD.sky, 0, 0, W, HZ, Math.round(vw / 2 - sw / 2), -oy, sw, HZ);
    drum(BD.line, 0, cam.x * 0.12, vw, oy);
    drum(B.opts && B.opts.mode === 'side' ? BD.wall : BD.stands, BD.S0, cam.x * 0.45, vw, oy);   // 遭遇战在竞技场外：没有看台
    const bot = GE + 14 - oy;   // 从画面顶部一直压到看台底部，不留硬边
    const gr = g.createLinearGradient(0, 0, vw, 0);
    gr.addColorStop(0, 'rgba(7,8,12,0.6)'); gr.addColorStop(0.2, 'rgba(7,8,12,0)'); gr.addColorStop(0.8, 'rgba(7,8,12,0)'); gr.addColorStop(1, 'rgba(7,8,12,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, vw, bot);
  }
  // 世界坐标里的地面：按 TW 平铺，镜头走到哪铺到哪
  function drawFloor() {
    const cam = B.cam;
    for (let x = Math.floor((cam.x - 40) / TW) * TW; x < cam.x + cam.w + 40; x += TW) g.drawImage(BD.floor, x, BD.F0);
  }

  // ---------- 绘制 ----------
  // 地形：土坡填满到地面、泥地一层湿泥、货箱（木板 + 铁包角，越破裂纹越多）
  function drawTerrain() {
    const T = B.ter;
    if (!T) return;
    if (!T.art && ((T.def.hills || []).length || T.mud.length)) T.art = SA.TerrainArt.layer(T.ground, T.mud, W, H, GROUND);   // 土坡 + 泥地：静态像素层，只画一次
    if (T.art) g.drawImage(T.art, 0, 0);
    for (const c of T.crates) {
      if (c.dead) SA.TerrainArt.rubble(g, c.x0 - 6, c.x1 + 6, c.y1);
      else SA.TerrainArt.crate(g, c.x0, c.y0, Math.round(c.x1 - c.x0), Math.round(c.y1 - c.y0), c.hp / c.max, c.shake > 0 ? (Math.floor(B.t * 40) % 2 ? 1 : -1) : 0);
    }
  }

  // 把世界层放到屏幕上。镜头缩放 × 设备像素比几乎总不是整数，直接最近邻放大会让像素一列宽一列窄（看起来撕裂、发虚），
  // 两次放大（世界 → 1280×720 → CSS）更是雪上加霜。做法（sharp bilinear）：
  // 先按整数倍 n 最近邻放大（每个像素严格 n×n），剩下不到 2 倍的零头用双线性补齐 —— 像素大小一致，只有边缘 1 个设备像素的过渡。
  // 镜头的亚像素位移在这一步平滑处理，车和背景一起移动，不会一顿一顿
  let upC = null;
  function present(vw, vh, ox, oy, base) {
    const cam = B.cam, Z = cam.z * DPX, n = Math.max(1, Math.floor(Z + 0.001));
    dg.setTransform(1, 0, 0, 1, 0, 0);
    if (base) { dg.fillStyle = P.bg[3]; dg.fillRect(0, 0, cv.width, cv.height); }
    const dx = -(cam.x - ox) * Z, dy = -(cam.y - oy) * Z;
    if (n === 1 && Math.abs(Z - 1) < 0.001) {   // 正好 1:1
      dg.imageSmoothingEnabled = false;
      dg.drawImage(wc, 0, 0, vw, vh, Math.round(dx), Math.round(dy), vw, vh);
      return;
    }
    let src = wc;
    if (n > 1) {
      upC = upC || document.createElement('canvas');
      if (upC.width < vw * n || upC.height < vh * n) { upC.width = Math.max(upC.width, vw * n); upC.height = Math.max(upC.height, vh * n); }
      const u = upC.getContext('2d');
      u.imageSmoothingEnabled = false;
      u.clearRect(0, 0, vw * n, vh * n);
      u.drawImage(wc, 0, 0, vw, vh, 0, 0, vw * n, vh * n);
      src = upC;
    }
    dg.imageSmoothingEnabled = true;
    dg.imageSmoothingQuality = 'low';
    dg.drawImage(src, 0, 0, vw * n, vh * n, dx, dy, vw * Z, vh * Z);
  }

  function draw() {
    const t = B.t;
    g = wc.getContext('2d');
    // 世界画布只装镜头看得到的那一块：先平移到镜头左上角，背景之后在屏幕空间里画
    const cam = B.cam, ox = Math.floor(cam.x), oy = Math.floor(cam.y);
    const vw = Math.min(wc.width, Math.ceil(cam.w) + 2), vh = Math.min(wc.height, Math.ceil(cam.h) + 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;   // 车身倾斜旋转时用最近邻采样，保持像素块
    drawBackdrop(vw, vh, oy);
    g.save();
    g.translate(-ox, -oy);
    drawFloor();
    const shx = B.shake ? Math.round(rnd(-B.shake, B.shake)) : 0, shy = B.shake ? Math.round(rnd(-B.shake, B.shake)) : 0;
    g.save();
    g.translate(shx, shy);
    drawTerrain();
    g.restore();
    g.restore();
    // 第 1 层：背景 + 地面 + 地形（世界像素）
    present(vw, vh, ox, oy, true);

    // 第 2 层：车。车会跟着坡度连续倾斜，在世界像素里最近邻旋转会让像素行断成台阶、每帧还跳来跳去（撕裂 / 闪烁），
    // 所以车直接画在设备分辨率上：车身画布先整数倍最近邻放大，再带着旋转双线性画上去 —— 像素块大小一致，斜边平滑不抖
    const Z = cam.z * DPX;
    const aimT = B.aim && !B.e.dead ? targetAt(B.e, B.aim[0], B.aim[1]) : null;
    const opts = (s, key, extra) => ({ key, t, heat: s.heat / 100, water: s.water / Math.max(1, s.waterMax), dyn: s.anim, elev: s.elev, punch: s.punch, moving: s.moving, speed: Math.abs(s.vx), gnd: s.gnd, ...extra });
    const pc = SA.SPR.renderVehicle(B.p.v, opts(B.p, 'bp'));
    const ec = SA.SPR.renderVehicle(B.e.v, opts(B.e, 'be'));
    dg.setTransform(Z, 0, 0, Z, (shx - cam.x) * Z, (shy - cam.y) * Z);
    g = dg;
    drawVehicle(B.p, pc, null, Z); drawVehicle(B.e, ec, aimT, Z);

    // 第 3 层：炮弹、粒子、伤害数字（世界像素，透明底）
    g = wc.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, vw, vh);
    g.save();
    g.translate(shx - ox, shy - oy);
    // 准星停在模块上：显示它的改装军衔杠
    if (aimT) { const t0 = B.e.v[aimT.layer][aimT.r][aimT.c]; const b0 = modBox(B.e, aimT.r, aimT.c, t0.id); SA.SPR.chevrons(g, Math.round(b0.x0), b0.y0, t0.lv || 0, K.UP_MAX); }

    for (const sh of B.shots) {
      const tr = sh.trail || [];
      if (sh.big) {
        for (let i = 0; i < tr.length - 1; i++) { g.fillStyle = i < tr.length - 3 ? P.steam[0] : P.steam[1]; g.fillRect(Math.round(tr[i][0]) - 2, Math.round(tr[i][1]) - 2, 3, 3); }
        g.fillStyle = P.brass[0]; g.fillRect(Math.round(sh.x) - 4, Math.round(sh.y) - 4, 9, 9);
        g.fillStyle = P.brass[2]; g.fillRect(Math.round(sh.x) - 3, Math.round(sh.y) - 3, 7, 7);
        g.fillStyle = P.brass[3]; g.fillRect(Math.round(sh.x) - 3, Math.round(sh.y) - 3, 3, 2);
      } else {
        const p0 = tr[0] || [sh.x, sh.y];
        SA.SPR.useCtx(g); SA.SPR.line(Math.round(p0[0]), Math.round(p0[1]), Math.round(sh.x), Math.round(sh.y), 3, P.fire[3]);
      }
    }
    for (const p of B.parts) {
      const k = p.life / p.max;
      // 跳弹曳光：沿速度方向的一道短线，头白尾黄
      if (p.type === 'glance') {
        SA.SPR.useCtx(g);
        SA.SPR.line(Math.round(p.x - p.vx * 0.035), Math.round(p.y - p.vy * 0.035), Math.round(p.x), Math.round(p.y), 2, k > 0.5 ? P.white : P.brass[3]);
        continue;
      }
      // 星芒：十字先张开再收回
      if (p.type === 'ping') {
        const L = Math.round(3 + 9 * Math.sin(Math.PI * (1 - k))), x = Math.round(p.x), y = Math.round(p.y);
        g.fillStyle = P.white; g.fillRect(x - L, y - 1, L * 2 + 1, 3); g.fillRect(x - 1, y - L, 3, L * 2 + 1);
        g.fillStyle = P.glass[3]; g.fillRect(x - 2, y - 2, 5, 5);
        continue;
      }
      // 甲片碎片：翻滚的薄片（宽度随转动忽宽忽窄），落地后躺着淡出
      if (p.type === 'shard') {
        const down = p.y >= groundAt(p.x) - 1, fw = down ? 5 : 1 + Math.round(5 * Math.abs(Math.cos(p.spin * p.life))), fh = 2;
        g.globalAlpha = Math.min(1, k * 3);
        g.fillStyle = P.black; g.fillRect(Math.round(p.x - fw / 2), Math.round(p.y - fh / 2) + 1, fw, fh);
        g.fillStyle = p.col; g.fillRect(Math.round(p.x - fw / 2), Math.round(p.y - fh / 2), fw, fh);
        g.globalAlpha = 1;
        continue;
      }
      let col, s = 3;
      switch (p.type) {
        case 'fire': col = k > 0.66 ? P.fire[3] : k > 0.33 ? P.fire[2] : P.fire[1]; s = k > 0.5 ? 6 : 3; break;
        case 'flash': col = P.fire[3]; s = 6; break;
        case 'spark': col = p.col || P.brass[3]; break;
        case 'dust': col = P.bg[5]; s = 4; break;
        case 'debris': col = p.col; s = 4; break;
        case 'smoke': col = k > 0.5 ? P.dark[3] : P.iron[1]; s = 6 + Math.round((1 - k) * 9); g.globalAlpha = Math.min(1, k * 1.5) * 0.8; break;
        case 'steam': col = k > 0.5 ? P.steam[2] : P.steam[1]; s = 3 + Math.round((1 - k) * 12); g.globalAlpha = Math.min(1, k * 1.2) * 0.7; break;
      }
      g.fillStyle = col;
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      g.globalAlpha = 1;
    }
    for (const tx of B.texts) if (PIXEL_TEXT.test(tx.str)) SA.SPR.text(g, tx.str, tx.x, Math.round(tx.y), tx.col);
    g.restore();
    present(vw, vh, ox, oy, false);

    // 叠加层：直接画在设备分辨率上（文字、细条、准星、弹道扇区都是矢量，不再被放大成糊块）
    dg.setTransform(Z, 0, 0, Z, -cam.x * Z, -cam.y * Z);
    dg.imageSmoothingEnabled = false;
    g = dg;
    overhead(B.p); overhead(B.e);
    fxLabels();
    B.previewInfo = null;
    if (B.aim && !B.p.dead && !B.e.dead) drawPreview(aimT);
    if (B.aim) {
      const [mx, my] = B.aim;
      reticle(mx, my, aimT);
      reticleAlerts(mx, my);
    }
    g = wc.getContext('2d');
    dg.setTransform(DPX, 0, 0, DPX, 0, 0);   // 屏幕空间（W × H）
    // 过热：屏幕四周红光呼吸，余光就能看到
    if (!B.p.dead && B.p.heat > T.HEAT_ALERT) {
      const a = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(B.t * 8))) * Math.min(1, (B.p.heat - T.HEAT_ALERT) / 15 + 0.4);
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, 60, 0, 0, W, 60], [0, H, 0, H - 60, 0, H - 60, W, 60], [0, 0, 60, 0, 0, 0, 60, H], [W, 0, W - 60, 0, W - 60, 0, 60, H]]) {
        const gr = dg.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, `rgba(255,40,30,${a})`); gr.addColorStop(1, 'rgba(255,40,30,0)');
        dg.fillStyle = gr; dg.fillRect(rx, ry, rw, rh);
      }
    }
  }

  // 准星：装填中 = 来回摆动的沙漏（外面一圈稳定度环，按住蓄力时跟着收紧）；装好了 = 黄铜齿轮。
  // 按住蓄满自动开火后如果还按着，也照样先变沙漏，装好了再变回齿轮、接着蓄力。
  // 机枪这类快枪（装填 < 1 秒）不切沙漏：齿轮每打一发咔哒转一齿，领头的齿闪一下，内圈细弧显示装填
  // 准星半径跟实际缩圈幅度走：前期只能缩一点，加装瞄准镜后能缩得更紧
  // 准星半径 = 瞄准度（0→100% 从 24 收到 9）；实际散布缩多少由车的缩圈幅度决定，扇区会如实反映
  const reticleR = (focus) => Math.round(24 - 15 * focus);
  function reticle(x, y, aimT) {
    const p = B.p;
    const group = p.weapons.filter(w => w.cell.id === p.sel && !w.blocked);
    const fast = group.length && group[0].m.reload < 1;
    const rl = reloadFrac(p);
    // 正在装填（慢炮）：沙漏，不管按没按住
    if (rl != null && !fast) {
      // 稳定度环：装填时按住也在蓄力，环跟着收紧；蓄满变绿
      g.save(); g.globalAlpha = p.fireHeld ? 0.75 : 0.45; g.lineWidth = 2; g.strokeStyle = p.focus >= 1 ? '#6fcf6a' : P.brass[2];
      g.beginPath(); g.arc(x, y, reticleR(p.focus), 0, Math.PI * 2); g.stroke(); g.restore();
      g.fillStyle = P.black; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = P.white; g.fillRect(x - 1, y - 1, 3, 3);
      // 沙漏像钟摆一样挂在准星上方来回摆
      g.save(); g.translate(x, y - 34); g.rotate(Math.sin(B.t * 4.5) * 0.38);
      hourglass(-11, 0, rl);
      g.restore();
      return;
    }
    let ticks = 0, flash = 0;
    for (const w of group) { ticks += p.anim.feedOf(w.key); flash = Math.max(flash, p.anim.flashOf(w.key)); }
    gearReticle(x, y, p.focus, aimT, { fast, ticks, flash, rl });
    if (aimT && aimT.layer === 'side') {   // 瞄的是侧挂层的侧炮：标一下
      g.font = 'bold 13px sans-serif'; g.textAlign = 'left';
      g.fillStyle = P.black; g.fillText('侧炮', x + 29, y - 13); g.fillStyle = P.white; g.fillText('侧炮', x + 28, y - 14);
    }
  }

  // 黄铜齿轮准星：按住蓄力时齿轮收紧、转动；蓄满（稳定度 100%）闪绿光
  function gearReticle(x, y, focus, aimT, mg) {
    const full = focus >= 1;
    const r = reticleR(focus);
    const rot = focus * Math.PI / 2 + (mg.fast ? mg.ticks * Math.PI / 4 + (B.p.fireHeld ? B.t * 9 : 0) : B.t * (full ? 2 : 0.3));   // 快枪按住时齿轮飞转
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 12);
    const col = full ? (pulse > 0.5 ? '#9dff8a' : '#6fcf6a') : P.brass[2];
    const hi = full ? '#e8ffd9' : P.brass[3];
    g.save();
    if (full) {   // 绿色光晕
      g.globalAlpha = 0.25 + 0.35 * pulse; g.strokeStyle = '#6fcf6a'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, y, r + 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.lineWidth = 7; g.strokeStyle = P.black;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.strokeStyle = col;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1; g.strokeStyle = hi;
    g.beginPath(); g.arc(x, y, r - 1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    // 内圈细弧 = 装填进度（装好了就不画）
    if (mg.rl != null) {
      g.globalAlpha = 0.8; g.lineWidth = 2; g.strokeStyle = hi;
      g.beginPath(); g.arc(x, y, Math.max(3, r - 5), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mg.rl); g.stroke(); g.globalAlpha = 1;
    }
    // 8 个齿（快枪：领头的齿在开火瞬间闪白）
    g.translate(x, y); g.rotate(rot);
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.fillStyle = P.black; g.fillRect(-4, -r - 8, 8, 8);
      g.fillStyle = mg.fast && i === 7 && mg.flash > 0.3 ? '#ffffff' : col; g.fillRect(-2.5, -r - 6.5, 5, 5);
    }
    g.restore();
    // 中心：十字小点
    g.fillStyle = P.black; g.fillRect(x - 3, y - 3, 7, 7);
    g.fillStyle = full ? hi : P.white; g.fillRect(x - 1, y - 1, 3, 3);
  }

  // 当前武器组的装填进度（0 → 1）：齐射要等最慢的那门炮，所以取最小值；全部装好才返回 null
  function reloadFrac(s) {
    if (s.dead || !s.sel) return null;
    let worst = null;
    for (const w of s.weapons) {
      if (w.cell.id !== s.sel || w.blocked) continue;
      const left = Math.max(0, s.timers[w.key] || 0);
      const f = 1 - left / w.m.reload;
      if (worst == null || f < worst) worst = f;
    }
    return worst == null || worst >= 1 ? null : clamp(worst, 0, 1);
  }
  // 跟着准星走的小沙漏：上半沙子漏到下半 = 装填进度
  function hourglass(x, y, f) {
    const S = 2;   // 放大两倍，镜头拉远时也看得清
    const R = (a, b, w, hh, col) => { g.fillStyle = col; g.fillRect(x + a * S, y + b * S, w * S, hh * S); };
    R(-1, -1, 13, 19, P.black);                       // 描边
    R(0, 0, 11, 2, P.brass[2]); R(0, 15, 11, 2, P.brass[2]);   // 上下黄铜盖
    R(0, 2, 1, 13, P.brass[1]); R(10, 2, 1, 13, P.brass[1]);   // 立柱
    const glass = [[2, 7], [2, 7], [3, 5], [4, 3], [5, 1], [5, 1], [4, 3], [3, 5], [2, 7], [2, 7], [2, 7]];
    glass.forEach(([gx, gw], i) => R(gx, 3 + i, gw, 1, P.steam[0]));
    const top = Math.round((1 - f) * 4), bot = Math.round(f * 4);
    for (let i = 0; i < top; i++) { const [gx, gw] = glass[4 - i]; R(gx, 7 - i, gw, 1, P.brass[3]); }
    for (let i = 0; i < bot; i++) { const [gx, gw] = glass[10 - i]; R(gx, 13 - i, gw, 1, P.brass[3]); }
    if (f < 1 && Math.floor(B.t * 10) % 2) R(5, 8, 1, 5 - bot, P.brass[3]);   // 漏下来的细流
  }

  // 画一辆车：起步憋气的颠簸 + 开火反作用的前后晃动与抬头（动态模块里的车身弹簧）；敌方整体镜像
  // 一辆车当前的警报（按紧急程度排序）
  function alertsOf(s) {
    if (s.dead) return [];
    const out = [];
    if (s.heat > T.HEAT_ALERT) out.push(['过热！', '#d8261b']);
    if (s.waterMax && s.water <= 0) out.push(['没水了', '#1c7f99']);
    else if (s.waterMax && s.water / s.waterMax < T.WATER_LOW_RATIO) out.push(['水快没了', '#1c7f99']);
    if (s.supply <= 0) out.push(['失去动力', '#d8261b']);
    if (s.thrown) out.push(['履带掉链', '#d8261b']);
    if (!s.weapons.some(w => !w.blocked)) out.push(['没有能开火的武器', '#d8261b']);
    return out;
  }
  // 车顶的小仪表：耐久 / 热量 / 水 三条细条 + 警报字，跟着车走，视线不用离开战场
  function overhead(s) {
    let top = K.ROWS, lo = 1e9, hi = -1e9;
    SA.V.each(s.v, (cell, r, c) => { if (!alive(cell)) return; top = Math.min(top, r); const b = modBox(s, r, c, cell.id); lo = Math.min(lo, b.x0); hi = Math.max(hi, b.x1); });
    if (hi < lo) return;
    let a = 0, m = 0;
    SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); });
    const w = Math.min(150, hi - lo), x = Math.round((lo + hi) / 2 - w / 2), y = Math.round(VY + (s.yo || 0) + top * C - 30);
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    const bar = (yy, f, col, flash) => {
      g.fillStyle = 'rgba(7,8,12,0.8)'; g.fillRect(x - 1, yy - 1, w + 2, 6);
      g.fillStyle = flash && pulse > 0.5 ? '#ffffff' : col; g.fillRect(x, yy, Math.round(w * clamp(f, 0, 1)), 4);
    };
    bar(y, a / Math.max(1, m), '#e4e0d6');
    bar(y + 7, s.heat / K.HEAT_MAX, s.heat > T.HEAT_ALERT ? '#ff3b2f' : '#ef7a21', s.heat > T.HEAT_ALERT);
    bar(y + 14, s.waterMax ? s.water / s.waterMax : 0, '#46c2c9', s.waterMax && s.water / s.waterMax < T.WATER_LOW_RATIO);
    const al = alertsOf(s);
    if (al.length) chips(al, x + w / 2, y - 26, 16);
  }
  // 警报牌：实色底 + 白字 + 黑描边，一排居中，底色随脉冲闪（比细字醒目得多）
  function chips(al, cx, y, size) {
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const pad = 6, hgt = size + 8, gap = 6;
    const ws = al.map(([t]) => Math.ceil(g.measureText(t).width) + pad * 2);
    let x = Math.round(cx - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2);
    al.forEach(([t, col], i) => {
      g.fillStyle = P.black; g.fillRect(x - 2, y - 2, ws[i] + 4, hgt + 4);
      g.fillStyle = col; g.globalAlpha = 0.7 + 0.3 * pulse; g.fillRect(x, y, ws[i], hgt); g.globalAlpha = 1;
      if (pulse > 0.5) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, ws[i] - 2, hgt - 2); }
      g.fillStyle = P.black; g.fillText(t, x + ws[i] / 2 + 1, y + hgt / 2 + 2);
      g.fillStyle = '#ffffff'; g.fillText(t, x + ws[i] / 2, y + hgt / 2 + 1);
      x += ws[i] + gap;
    });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  // 飘字：像素字体只有数字和几个字母，其余（"弹开""投降"等中文）在叠加层用矢量字画成小铭牌
  const PIXEL_TEXT = /^[0-9MIS!-]*$/;
  function fxLabels() {
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const tx of B.texts) {
      if (PIXEL_TEXT.test(tx.str)) continue;
      const age = (tx.max || 0.9) - tx.life, pop = age < 0.08 ? 1.35 - age * 4.4 : 1;
      const w = Math.ceil(g.measureText(tx.str).width) + 10, h = 18;
      g.save();
      g.translate(Math.round(tx.x), Math.round(tx.y)); g.scale(pop, pop);
      g.globalAlpha = Math.min(1, tx.life * 3);
      g.fillStyle = 'rgba(7,8,12,0.85)'; g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
      g.strokeStyle = tx.plaque || tx.col; g.lineWidth = 1; g.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
      g.fillStyle = P.black; g.fillText(tx.str, 1, 2);
      g.fillStyle = tx.plaque ? P.white : tx.col; g.fillText(tx.str, 0, 1);
      g.restore();
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  // 准星下方：玩家自己最要紧的一两条警报（盯着准星也能看到）
  function reticleAlerts(x, y) {
    const al = alertsOf(B.p).slice(0, 2);
    if (al.length) chips(al, x, y + 34, 14);
  }

  // 瞄准高亮：整格白色闪烁 + 白描边，侧炮和普通模块一样，不分颜色
  const hlC = document.createElement('canvas');
  hlC.width = K.ART + 8; hlC.height = K.ART + 8;
  // lx, ly：模块在整车画布里的左上角；w, h：模块像素大小；dx, dy：画到哪（当前坐标系）
  function highlight(cvs, lx, ly, w, h, dx, dy) {
    const x = hlC.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, hlC.width, hlC.height);
    x.drawImage(cvs, lx - 4, ly - 4, w + 8, h + 8, 0, 0, w + 8, h + 8);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w + 8, h + 8);
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 10);
    g.globalAlpha = 0.3 + 0.45 * pulse; g.drawImage(hlC, 0, 0, w + 8, h + 8, dx - 4, dy - 4, w + 8, h + 8); g.globalAlpha = 1;
    g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`; g.strokeRect(dx - 1, dy - 1, w + 2, h + 2);
  }

  // 车身画布按整数倍 n 最近邻放大（每辆车一张缓存画布），再缩回 1/n 用双线性画：旋转也不会出现像素台阶
  const upV = new Map();
  function upscaled(key, src, n) {
    if (n <= 1) return src;
    let c = upV.get(key);
    if (!c) { c = document.createElement('canvas'); upV.set(key, c); }
    if (c.width !== src.width * n || c.height !== src.height * n) { c.width = src.width * n; c.height = src.height * n; }
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function blit(key, src, dx, dy, n) {
    if (n <= 1) { g.drawImage(src, dx, dy); return; }
    g.drawImage(upscaled(key, src, n), dx, dy, src.width, src.height);
  }

  function drawVehicle(s, cvs, hl, Z) {
    const w = s.anim.body.x;                        // 后坐：本地坐标里往后挪（负 = 被往后推）
    const py = K.ROWS * C;                          // 车身画布底边 = 车底
    const lp = isP(s) ? s.pivX - s.x : s.x + VW - s.pivX;   // 支点（车底中点）在车身画布里的 x
    const n = Math.max(1, Math.floor(Z + 0.001));
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
    g.translate(s.pivX, pivY(s) - s.rock * 2);      // 设备分辨率下不取整：爬坡时平滑移动
    g.rotate(tiltOf(s));                            // 跟着坡度倾斜（整车绕车底中点转）
    if (!isP(s)) g.scale(-1, 1);
    g.translate(w, 0);
    g.rotate(clamp(w * 0.012, -0.06, 0.06));        // 往后坐时车头微微抬起
    blit(isP(s) ? 'p' : 'e', cvs, -lp, -py, n);
    if (s.dead) blit('dead', tint(cvs), -lp, -py, n);
    if (hl) {
      const f = SA.fp(s.v[hl.layer][hl.r][hl.c].id), lx = PADX + hl.c * C, ly = hl.r * C;
      highlight(cvs, lx, ly, f.w * C, f.h * C, lx - lp, ly - py);   // 本地坐标：跟着车身晃动、倾斜、敌方镜像
    }
    g.restore();
  }

  // 命中率估算用的固定分位样本（与 gauss() 同分布），每帧结果稳定不闪
  const QS = (() => { const a = Array.from({ length: 3000 }, gauss).sort((x, y) => x - y); return Array.from({ length: 15 }, (_, i) => a[Math.floor((i + 0.5) / 15 * a.length)]); })();
  const sameCell = (a, b) => a && b && a.layer === b.layer && a.r === b.r && a.c === b.c;

  // 当前武器组的弹道预览：按炮管「当前」仰角画（炮管转动有延迟）。
  // 直射：中心点线 + 散布扇区 + 命中率；高抛：点线 + 落点 ×（指哪打哪）
  function drawPreview(aimT) {
    const side = aimT && aimT.layer === 'side';
    const info = { hit: null, reach: true, blocked: false };
    B.previewInfo = info;
    const p = B.p;
    const w = p.weapons.find(x => x.cell.id === p.sel && !x.blocked);
    if (!w) { info.blocked = p.weapons.some(x => x.cell.id === p.sel); return; }
    const want = aimAngle(p, w, B.aim[0], B.aim[1]), cur = barrel(p, w);
    info.reach = want.reach || w.m.g < 1;
    info.over = want.over;
    info.slewing = Math.abs(want.a - cur) > 1;
    info.windup = p.fireHeld && p.heldT < w.m.windup;
    const pr = predict(p, B.e, w, cur, side);
    const col = P.white;
    const big = w.m.proj === 'shell';
    SA.SPR.useCtx(g);
    const sp = spreadDeg(p, B.e, w);
    // 扇区宽度：散布变大立刻跟上（扇区永远盖住真实散布），变小时慢慢收（不随每一帧的颠簸抖）
    const now = B.t, dtv = Math.min(0.1, now - (B.fanT || now));
    B.fanT = now;
    B.fanSp = B.fanSp == null || B.fanW !== w.key || sp > B.fanSp ? sp : B.fanSp + (sp - B.fanSp) * Math.min(1, dtv * 4);
    B.fanW = w.key;
    if (sp > 0) {
      // 扇区：散布范围内均匀取 17 条弹道，各自飞到真正撞上的模块 / 货箱 / 地面为止（不做长度平滑，终点就是真实落点）；
      // 相邻两条弹道之间围成一条条带，所有条带放进同一条路径一次填满（nonzero 规则，重叠处不会叠深），没有缝也没有锯齿
      const N = 17, rays = [];
      for (let i = 0; i < N; i++) {
        const r0 = predict(p, B.e, w, cur, side, -B.fanSp + 2 * B.fanSp * i / (N - 1));
        rays.push([...r0.pts, r0.end]);
      }
      g.save(); g.globalAlpha = 0.16; g.fillStyle = col; g.beginPath();
      for (let i = 0; i < N - 1; i++) {
        const a = rays[i], b = rays[i + 1];
        g.moveTo(a[0][0], a[0][1]);
        for (let k = 1; k < a.length; k++) g.lineTo(a[k][0], a[k][1]);
        for (let k = b.length - 1; k >= 0; k--) g.lineTo(b[k][0], b[k][1]);
        g.closePath();
      }
      g.fill('nonzero'); g.restore();
      if (aimT) {
        let n = 0;
        for (const q of QS) if (sameCell(predict(p, B.e, w, cur, side, q * sp).hit, aimT)) n++;
        const base = n / QS.length;
        info.chance = Math.round(100 * base * (1 - (w.m.wild || 0) * 0.8));
      }
    }
    pr.pts.forEach(([x, y], i) => {
      if (i % (big ? 2 : 3)) return;
      g.fillStyle = P.black; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, big ? 5 : 4, big ? 5 : 4);
      g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), big ? 3 : 2, big ? 3 : 2);
    });
    if (sp <= 0) {
      const [ex, ey] = pr.end.map(Math.round);
      SA.SPR.line(ex - 6, ey - 6, ex + 6, ey + 6, 4, P.black); SA.SPR.line(ex + 6, ey - 6, ex - 6, ey + 6, 4, P.black);
      SA.SPR.line(ex - 5, ey - 5, ex + 5, ey + 5, 2, col); SA.SPR.line(ex + 5, ey - 5, ex - 5, ey + 5, 2, col);
    }
    if (pr.blocked) info.cover = pr.blocked;   // 弹道被货箱 / 土坡挡住
    if (pr.hit) {
      info.hit = pr.hit;
      if (!sameCell(pr.hit, aimT)) { const b = modBox(B.e, pr.hit.r, pr.hit.c, B.e.v[pr.hit.layer][pr.hit.r][pr.hit.c].id); cornerMark(Math.round(b.x0), Math.round(b.y0), b.x1 - b.x0, b.y1 - b.y0); }
    }
  }

  // 「弹道中心会先打到这个模块」：四个橙色角框（黑边），轻轻呼吸
  function cornerMark(x, y, w, h) {
    const n = Math.max(6, Math.round(Math.min(w, h) * 0.3)), a = 0.65 + 0.35 * Math.sin(B.t * 6);
    g.save();
    for (const [col, lw, off] of [[P.black, 5, 0], ['#ffb347', 3, 0]]) {
      g.globalAlpha = col === P.black ? 0.8 : a; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        g.moveTo(cx + dx * n, cy + off); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * n);
      }
      g.stroke();
    }
    g.restore();
  }

  const tintC = document.createElement('canvas');
  function tint(src) {
    tintC.width = src.width; tintC.height = src.height;
    const x = tintC.getContext('2d');
    x.clearRect(0, 0, src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(7,8,12,0.55)';
    x.fillRect(0, 0, src.width, src.height);
    x.globalCompositeOperation = 'source-over';
    return tintC;
  }

  // ---------- HUD ----------
  function sidePanel(cls) {
    const el = {};
    el.root = h('div', { class: `bt-side ${cls}` },
      el.nm = h('div', { class: 'nm' }),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '耐久'), h('div', { class: 'bar hp' }, el.hp = h('i'))),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '热量'), el.heatBar = h('div', { class: 'bar heat' }, el.heat = h('i'))),
      h('div', { class: 'bar-row' }, h('span', { class: 'name' }, '水'), h('div', { class: 'bar water' }, el.water = h('i'))),
      el.state = h('div', { class: 'state' }));
    return el;
  }
  function updPanel(el, s) {
    let a = 0, m = 0;
    SA.V.each(s.v, (cell) => { a += Math.max(0, cell.hp); m += SA.V.maxHp(cell); });
    el.nm.textContent = s.name;
    el.hp.style.width = `${(a / Math.max(1, m)) * 100}%`;
    el.heat.style.width = `${Math.min(100, s.heat)}%`;
    el.heatBar.classList.toggle('hot', s.heat > T.HEAT_ALERT);
    el.water.style.width = `${(s.water / Math.max(1, s.waterMax)) * 100}%`;
    const st = [];
    if (s.dead) st.push(s.reason);
    else {
      if (s.power < 1) st.push(`动力 ${Math.round(s.power * 100)}%`);
      if (s.heat > T.HEAT_ALERT) st.push('即将烧干！');
      else if (s.water <= 0) st.push('水已耗尽');
      if (s.hold) st.push('停火降温中');
      if (s.thrown) st.push('履带掉链，无法移动');
      if (s.spooling) st.push('锅炉加压中…');
      const cr = crippled(s);
      if (cr) st.push(cr);
      if (Math.abs(s.vx) > 2) st.push(`${SA.kmh(Math.abs(s.vx))}`);
      if (!s.isAI && s.fireHeld) st.push('开火中');
    }
    // 警报用醒目的闪烁标签，普通状态是灰字
    el.state.innerHTML = '';
    for (const [t] of alertsOf(s)) el.state.append(h('span', { class: 'alert' }, t));
    el.state.append(st.filter(x => !/即将烧干|水已耗尽|履带掉链|失去动力|没有能开火/.test(x)).join(' · '));
  }

  // 武器组槽位：只有 ≥2 组时才显示，数字键切换
  function renderSlots() {
    const p = B.p;
    const sig = p.groups.join(',') + '|' + p.sel + '|' + (p.coGroups || []).join(',');
    if (hud.slotSig === sig) return;
    hud.slotSig = sig;
    hud.slots.innerHTML = '';
    if (p.groups.length < 2) return;
    p.groups.forEach((id, i) => {
      const n = p.weapons.filter(w => w.cell.id === id).length;
      const co = (p.coGroups || []).includes(id);
      hud.slots.append(h('button', { class: `btn small slot ${p.sel === id ? 'on' : ''} ${co ? 'co' : ''}`, title: co ? '另一名驾驶员正在操作这组武器' : '', onclick: () => { p.sel = id; } },
        h('b', {}, `${i + 1}`), ` ${M[id].name} ×${n}`, co ? h('span', { class: 'co-tag' }, '驾驶员') : null));
    });
  }

  function infoText() {
    const p = B.p;
    if (!p.sel) return '没有可用的武器。可以用 A/D 冲撞对手。';
    const head = `<b>${M[p.sel].name}</b>`;
    if (!B.aim) return `${head} · 移动鼠标瞄准，<b>按住左键</b>稳住准星（蓄满闪绿光自动开火，提前松手立刻开火）；<b>A/D</b> 移动与冲撞${p.groups.length > 1 ? '；<b>数字键</b>切换武器' : ''}。`;
    const aimT = targetAt(B.e, B.aim[0], B.aim[1]);
    const pi = B.previewInfo;
    const parts = [head];
    if (pi && pi.blocked) parts.push('<b>这组武器全被己方模块挡住了</b>，换一组武器');
    if (aimT && aimT.layer === 'side') parts.push('瞄准 <span class="side">敌方侧炮（侧挂层）</span>：只打侧炮，不会被前面的装甲挡住');
    else if (aimT) parts.push(`瞄准 <b>敌方${M[B.e.v[aimT.layer][aimT.r][aimT.c].id].name}</b>`);
    else parts.push('准星没有对准敌方模块');
    const alt = p.groups.includes('mortar') && p.sel !== 'mortar' ? ' → 换高抛火炮试试' : '';
    if (pi && pi.over) parts.push(pi.over === 'high' ? `<b>超出射界</b>：目标太高/太近，炮管抬不到 ${M[p.sel].elev[1]}° 以上${alt}` : '<b>超出射界</b>：炮管压不了那么低');
    else if (pi && !pi.reach) parts.push('<b>超出射程，靠近一些</b>');
    else if (pi && pi.slewing) parts.push('炮管转动中…');
    if (aimT && pi && pi.hit && !sameCell(pi.hit, aimT)) parts.push(`弹道中心先打到 <b>「${M[B.e.v[pi.hit.layer][pi.hit.r][pi.hit.c].id].name}」</b>（橙色角框）${alt}`);
    if (aimT && pi && pi.cover && !pi.hit) parts.push(pi.cover === 'crate' ? '弹道被<b>货箱</b>挡住：打烂它、绕过去，或者换高抛' : `弹道打在<b>土坡</b>上：靠近一些${alt || '，或者换高抛'}`);
    if (aimT && pi && pi.chance != null) parts.push(`命中率约 <b>${pi.chance}%</b>（扇区 = 散布范围）`);
    else if (aimT && pi && M[p.sel].indirect) parts.push('高抛：指哪打哪（对方移动会躲开）');
    if (p.fireHeld) parts.push(p.focus >= 1 ? `<b style="color:#6fcf6a">准星稳住了！</b>散布 -${Math.round(p.aimShrink * 100)}%` : `瞄准 ${Math.round(p.focus * 100)}%（散布 -${Math.round(p.aimShrink * p.focus * 100)}%）${shakeOf(p) > 0.4 ? ' · 车身在晃，停稳更快' : ''}`);
    return parts.join(' · ');
  }

  // ---------- 流程 ----------
  const KEYMAP = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'fire' };
  function onKey(e) {
    if (!B || B.done || SA.current !== 'battle') return;
    const k = KEYMAP[e.code];
    if (k) { B.keys[k] = e.type === 'keydown'; e.preventDefault(); }
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && e.type === 'keydown' && B.p.groups.length > 1) {
      const id = B.p.groups[+m[2] - 1];
      if (id) B.p.sel = id;
    }
  }

  // 游戏速度：整场战斗的时间流速（移动、装填、热量、AI、动画全部按它缩放）
  const SPEED_KEY = 'steam_arena_speed_v1';
  function gameSpeed() { try { const v = parseFloat(localStorage.getItem(SPEED_KEY)); return v > 0 ? v : K.GAME_SPEED; } catch (e) { return K.GAME_SPEED; } }
  function speedSlider() {
    const out = h('b', {}, `${gameSpeed().toFixed(2)}×`);
    const range = h('input', { type: 'range', min: T.GAME_SPEED_MIN, max: T.GAME_SPEED_MAX, step: T.GAME_SPEED_STEP, value: gameSpeed(), 'aria-label': '游戏速度',
      oninput: () => { B.speed = +range.value; out.textContent = `${B.speed.toFixed(2)}×`; try { localStorage.setItem(SPEED_KEY, String(B.speed)); } catch (e) { /* ignore */ } },
      onchange: () => range.blur() });
    return h('label', { class: 'bt-speed', title: '游戏速度：拖动试试什么节奏合适' }, '速度', range, out);
  }

  function holdBtn(label, key) {
    const b = h('button', { class: 'btn' }, label);
    const set = (v) => (e) => { e.preventDefault(); if (B) B.keys[key] = v; };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, set(false));
    return b;
  }

  function tick(dt) {
    if (!B) return;
    for (const p of B.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'glance') p.vy += 300 * dt;
      if (p.type === 'debris' || p.type === 'spark' || p.type === 'dust' || p.type === 'shard') {
        p.vy += 660 * dt;
        const gy = groundAt(p.x);
        if (p.y > gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; }
      }
      if (p.type === 'smoke' || p.type === 'steam') p.vx *= 0.98;
    }
    B.parts = B.parts.filter(p => p.life > 0);
    for (const t of B.texts) { t.life -= dt; t.y -= 42 * dt; }
    B.texts = B.texts.filter(t => t.life > 0);
    B.shake = Math.max(0, B.shake - dt * 14);
  }

  function start(opts) {
    api.startState(opts);
    B = api.getState();
    BD = BD || buildBackdrop();

    const screen = document.querySelector('#screen');
    screen.innerHTML = '';
    cv = h('canvas', { class: 'px', width: W, height: H });
    dg = cv.getContext('2d');
    wc = document.createElement('canvas'); wc.width = Math.ceil(W / ZMIN) + 4; wc.height = Math.ceil(H / ZMIN) + 4;   // 镜头拉到最远时也装得下
    g = wc.getContext('2d');
    hud.p = sidePanel('player');
    hud.e = sidePanel('enemy');
    hud.timer = h('div', { class: 'bt-timer' });
    hud.info = h('div', { class: 'bt-info' });
    hud.slots = h('div', { class: 'bt-slots' });
    hud.slotSig = null;
    hud.vent = h('button', { class: 'btn', onclick: () => {
      if (api.vent()) hud.vent.disabled = true;
    } }, '紧急泄压（限一次）');
    wrap = h('div', { class: 'bt-canvas-wrap' }, cv);
    screen.append(h('div', { class: 'bt' },
      h('div', { class: 'bt-hud' }, hud.p.root, hud.timer, hud.e.root),
      wrap,
      h('div', { class: 'bt-bottom' },
        h('div', { class: 'bt-ctrl' }, holdBtn('◀ 后退', 'left'), holdBtn('前进 ▶', 'right'), holdBtn('开火', 'fire')),
        hud.slots, hud.info, speedSlider(), hud.vent,
        h('button', { class: 'btn', onclick: () => { if (!B.p.dead) SA.UI.dialog('撤出比赛', h('p', {}, '确定撤出？这会判负。'), [{ label: '撤退', primary: true, onClick: () => api.retreat() }], '继续比赛'); } }, '撤退'))));

    const toNative = (e) => {
      const rc = cv.getBoundingClientRect();
      return [(e.clientX - rc.left) / rc.width * W, (e.clientY - rc.top) / rc.height * H];
    };
    cv.addEventListener('pointermove', (e) => { B.aimScreen = toNative(e); });
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') B.aimScreen = null; B.keys.fire = false; });
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      B.aimScreen = toNative(e);
      if (e.button !== 0) return;
      B.keys.fire = true;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointerup', () => { B.keys.fire = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('resize', fit);
    fit();
    camera(1);
    let last = performance.now();
    const mine = B;   // 每场战斗一个循环：换了新的一场，旧循环自己退出
    const loop = (now) => {
      if (SA.current !== 'battle' || B !== mine || B.done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!B.frozen) step(dt * B.speed);   // frozen：调试 / 测试时暂停实时推进，只用 debug.step 手动推
      draw();
      hudTick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function hudTick(dt) {
    B.hudT -= dt;
    if (B.hudT > 0) return;
    B.hudT = 0.1;
    updPanel(hud.p, B.p); updPanel(hud.e, B.e);
    hud.timer.innerHTML = `${Math.max(0, Math.ceil(K.BATTLE_TIME - B.t))}<small>${B.opts.mode === 'side' ? '竞技场外 · ' : B.opts.replay ? '重打 · ' : ''}${B.ter.def.name}</small>`;
    hud.info.innerHTML = infoText();
    renderSlots();
  }

  function fit() {
    if (!wrap || !wrap.isConnected) return;
    const aw = wrap.clientWidth - 16;
    const ah = Math.max(240, window.innerHeight - 250);
    let s = Math.min(aw / W, ah / H);
    const cw = Math.round(W * s), ch = Math.round(H * s), dpr = window.devicePixelRatio || 1;
    cv.style.width = `${cw}px`;
    cv.style.height = `${ch}px`;
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    DPX = bw / W;
  }

  return {
    start,
    draw: () => { sync(); draw(); },
    hudTick: (dt) => { sync(); hudTick(dt); },
    camera: (dt) => { sync(); camera(dt); },
    tick: (dt) => { sync(); tick(dt); },
    fit,
    gameSpeed,
    aimWorld: (x, y) => { sync(); const cam = B.cam; B.aimScreen = [(x - cam.x) * cam.z, (y - cam.y) * cam.z]; camera(0); },
    emit,
    presentResult: (data) => SA.UI.afterBattle(data),
    teardown: () => { if (typeof window !== 'undefined') { window.removeEventListener('resize', fit); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); } },
  };
};
