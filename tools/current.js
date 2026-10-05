// 「当前开发」页：双足强化 v5（2026-10-05，计划见 docs/biped-plan.md）。
// 这一页不复用：只放正在开发、等开发者确认的东西；确认后复制到 tools/archive/<名字>.*，在 labs.js 登记，再换下一项。
//
// 机甲套件 v4（tools/archive/mech-kit-v4.*）用户 2026-10-05 全部通过，本页在它上面接着做三件新东西：
//   ① 轻型腿 / 重型腿：主线六档 = 标准腿；9 种唯一腿分成轻型 5 种、重型 4 种（T3～T6 每档一轻一重，T2 只有轻型）；
//   ② 姿态：走 / 快跑 / 下蹲 / 跳跃（蓄力 → 起跳 → 空中收腿 → 落地）。游戏的 js/legs.js 已经支持这些参数：
//      bipedArt 的 crouch / air + tuck / duty + liftK，bipedBob 的 duty + hop（默认值下画面和原来逐像素一致）；
//   ③ 腿部件（侧挂层，只有双足能装）：跳跃件（小腿位）三种、提速件（大腿位）三种，用 bipedArt 的 legPart 挂到腿骨上。
// 躯干用 v4 的零件（SA.MECHKIT.PARTS），腿用游戏的 legs.js；本页只是样机，游戏画面没变。
window.SA = window.SA || {};

SA.CUR = (() => {
  const P = SA.PAL, LL = SA.LEGLAB, U = LL.U, { NEAR, FAR, bone } = U, K4 = SA.MECHKIT;
  const S = 24, PADX = SA.SPR.PADX, TAU = Math.PI * 2, GROUND = 288, HIP_ROW = 8;
  const STEAM = [P.steam[0], P.steam[1], P.steam[2], P.white], DUST = [P.bg[2], P.bg[4], P.bg[5], P.bg[6]];
  const ease = (u) => u * u * (3 - 2 * u), clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- ① 轻型 / 重型 ----------
  const CLASSES = [
    { id: 'std', name: '标准腿', sub: '主线六档（每种材料一种，现在游戏里的样子）', walk: 70,
      legs: [['mk2', 1, '工装 Mk.II'], ['heron', 2, '鹭步'], ['gren', 3, '掷弹兵'], ['knight', 4, '蒸汽圣骑'], ['clock', 5, '钟表巨像'], ['dragon', 6, '熔心龙骑']],
      read: '数值就是现在的双足；造型从细到粗按档位走。' },
    { id: 'light', name: '轻型腿', sub: '唯一腿 5 种：跑得快、跳得高、躲得开，扛不动重东西', walk: 95,
      legs: [['stilt', 2, '高跷'], ['blade', 3, '板簧跑刃'], ['panto', 4, '缩放仪平行腿'], ['bellows', 5, '风箱腿'], ['crystal', 6, '晶枝腿']],
      read: '细、长、弹：伸缩套筒、叠层板簧、平行杆、风箱、枯枝——都是「能弹起来」或者很轻的东西；脚小，起伏大。' },
    { id: 'heavy', name: '重型腿', sub: '唯一腿 4 种：承重高、蹲得稳、能扛大炮，跑不快、跳不高', walk: 50,
      legs: [['skirt', 3, '裙甲堡'], ['mail', 4, '锁甲骑士腿'], ['steamman', 5, '蒸汽人'], ['templar', 6, '圣堂骑士腿']],
      read: '粗、矮、实：钟形裙甲、锁甲、汽缸大腿、哥特板甲 + 罩袍；脚大，起伏小。' },
  ];
  const MAT_NAME = ['', '黄铜', '熟铁', '钢', '镀镍', '乌兹钢', '以太合金'];
  const VARIANT = new Set((SA.LEG_VARIANTS || []).filter(v => v.id === 'biped').map(v => v.look));

  // 一排腿（游戏精灵：带材料色），原地走；sil = 只画剪影
  const LANE = 76;
  function laneSize(cls) { return { w: cls.legs.length * LANE + 40, h: 128 }; }
  function renderLane(cv, cls, st, sil) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const v = cls.walk * (st.mv ? 1 : 0), dist = st.t * v, stride = LL.strideFor(v);
    const a = st.mv ? TAU * dist / (4 * stride) : 0;
    const bd = LL.bipedBob({ mv: st.mv, a, stride });
    cls.legs.forEach(([leg, mt], i) => {
      const x = 24 + i * LANE, y = 18;
      SA.SPR.drawModule(g, 'biped', x, y, { moving: st.mv, gait: a + i * 0.9, stride, bd, mt, look: VARIANT.has(leg) ? leg : undefined, t: st.t });
    });
    g.fillStyle = P.bg[4]; g.fillRect(0, 18 + 96, cv.width, 2);
    if (sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = P.black; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; g.fillStyle = P.bg[4]; g.fillRect(0, 18 + 96, cv.width, 2); }
  }

  // ---------- 躯干（v4 零件）+ 游戏腿 ----------
  const MAT = (far) => {
    const B = far ? FAR : NEAR, dim = (r) => (far ? [P.black, r[0], r[1], r[2]] : r);
    return { ...B, glass: dim([...P.glass]), water: dim([P.water[0], P.water[1], P.water[2], P.water[3]]) };
  };
  const M0 = MAT(false), MF = MAT(true);
  const mech = (name) => K4.MECHS.find(m => m.name.startsWith(name));
  // 车体框架：子格外轮廓，露在外面的角切 4px（同 v4）；lean = 快跑前倾，每往上一行多往前 lean px
  function hull(pn, cells, sty, lean) {
    const has = (c, r) => cells.has(c + ',' + r);
    for (const key of cells) {
      const [c, r] = key.split(',').map(Number), x = PADX + c * S + lean * (HIP_ROW - r), y = r * S, n = 4;
      const tl = !has(c - 1, r) && !has(c, r - 1) && !has(c - 1, r - 1), tr = !has(c + 1, r) && !has(c, r - 1) && !has(c + 1, r - 1);
      const br = !has(c + 1, r) && !has(c, r + 1) && !has(c + 1, r + 1), bl = !has(c - 1, r) && !has(c, r + 1) && !has(c - 1, r + 1);
      pn.poly([[x + (tl ? n : 0), y], [x + S - (tr ? n : 0), y], [x + S, y + (tr ? n : 0)], [x + S, y + S - (br ? n : 0)],
        [x + S - (br ? n : 0), y + S], [x + (bl ? n : 0), y + S], [x, y + S - (bl ? n : 0)], [x, y + (tl ? n : 0)]]);
    }
    pn.paint(K4.LOOK[sty].hull(M0));
  }
  // 一团蒸汽 / 尘土：age 0～1，往上飘、变大、变淡（只用调色板色，像素画）
  function puff(pn, x, y, age, n, ramp, spread = 1) {
    if (age < 0 || age > 1) return;
    for (let i = 0; i < n; i++) {
      const s = (i * 2.399) % TAU, rr = (2 + i % 3) * spread;
      const px = x + Math.cos(s) * rr * (1 + age * 3), py = y - age * (8 + i * 2) * spread + Math.sin(s) * rr * 0.6;
      pn.disc(px, py, (1.4 + age * 3.2) * (1 - age * 0.35) * spread).paint(age < 0.55 ? ramp : [ramp[0], ramp[0], ramp[1], ramp[2]], { outline: false });
    }
  }

  // 一台机甲：m = v4 整机，leg = legs.js 的腿型，p = 姿态参数
  // p: { mv, a, stride, duty, liftK, hop, lean, crouch, air（离地高度 px）, tuck, legPart, out }
  const HIPX = PADX + 7 * S + 12;   // v4 的胯对准第 7 列子格的中心
  function drawMech(pn, m, leg, p, X0, Y0) {
    const bd = p.air ? 0 : LL.bipedBob({ mv: p.mv, a: p.a, stride: p.stride, duty: p.duty, hop: p.hop });
    const cr = Math.round(LL.BIPED_CROUCH * (p.crouch || 0)), dy = cr - Math.round(p.air || 0), lean = p.lean || 0;
    const lo = { mv: p.mv, a: p.a, stride: p.stride, duty: p.duty, liftK: p.liftK, bd, legs: leg, t: p.t, phase: p.a * 4,
      crouch: p.crouch, air: !!p.air, tuck: p.tuck, legPart: p.legPart, out: p.out };
    const bx = HIPX - 24, by = HIP_ROW * S + dy;
    // 远侧腿 + 远侧空手臂（压暗）
    pn.at(1, -X0, -Y0);
    LL.bipedArt(pn, bx, by, lo, 'far');
    if (m) {
      pn.at(1, -X0 - 6, -Y0 + dy + bd - 3);
      for (const [id, c, r] of m.add) if (K4.PARTS[id].arm) K4.PARTS.arm_fist.draw(pn, PADX + c * S + lean * (HIP_ROW - r), r * S, m.sty, MF, { swing: 0, t: p.t, fl: 0 });
      // 车体
      pn.at(1, -X0, -Y0 + dy + bd);
      hull(pn, m.body, m.sty, lean);
      const o = { mv: p.mv, t: p.t, fl: Math.floor(p.t * 8) % 4, swing: p.mv && !p.air ? -Math.sin(p.a) : 0, blink: false };
      for (const [id, c, r] of m.parts) if (K4.PARTS[id].layer === 'body') K4.PARTS[id].draw(pn, PADX + c * S + lean * (HIP_ROW - r), r * S, m.sty, M0, o);
    }
    // 胯 + 近侧腿（腿部件挂在近侧腿上）
    pn.at(1, -X0, -Y0);
    LL.bipedArt(pn, bx, by, lo, 'near');
    // 附加层（手臂、重炮）画在最前面
    if (m) {
      pn.at(1, -X0, -Y0 + dy + bd);
      const o = { mv: p.mv, t: p.t, fl: Math.floor(p.t * 8) % 4, swing: p.mv && !p.air ? -Math.sin(p.a) : 0, recoil: 0 };
      for (const [id, c, r] of m.add) K4.PARTS[id].draw(pn, PADX + c * S + lean * (HIP_ROW - r), r * S, m.sty, M0, o);
    }
    pn.at(1, -X0, -Y0);
  }

  // ---------- 姿态时间线 ----------
  const WALK = { light: 95, std: 70, heavy: 50 }, RUN = { light: 135, std: 118, heavy: 96 };
  const JUMP_H = { light: 72, std: 48, heavy: 26 };   // 演示用：轻型跳 1.5 格、标准 1 格、重型半格多（规则按承重余量算，见计划 §5.2）
  // 跳跃一轮（秒）：站 0.7 → 蓄力下蹲 0.18 → 空中 → 落地缓冲 0.35 → 站
  function jumpState(t, H) {
    const T_AIR = 0.34 + Math.sqrt(H) * 0.075, cyc = 0.7 + 0.18 + T_AIR + 0.35 + 0.4, u = t % cyc;
    const s = { crouch: 0, air: 0, tuck: 0, launch: -1, land: -1 };
    if (u < 0.7) return s;
    if (u < 0.88) { s.crouch = 0.55 * ease((u - 0.7) / 0.18); return s; }
    if (u < 0.88 + T_AIR) {
      const w = (u - 0.88) / T_AIR;
      s.air = H * 4 * w * (1 - w); s.tuck = Math.sin(Math.PI * w) ** 0.8; s.launch = (u - 0.88) / 0.45;
      return s;
    }
    const w = (u - 0.88 - T_AIR) / 0.35;
    if (w < 1) s.crouch = 0.6 * (1 - ease(w)) * (H > 40 ? 1 : 0.7);
    s.land = (u - 0.88 - T_AIR) / 0.5;
    return s;
  }
  function crouchState(t) {
    const u = t % 3.2;
    if (u < 0.7) return 0;
    if (u < 0.95) return ease((u - 0.7) / 0.25);
    if (u < 2.6) return 1;
    if (u < 2.85) return 1 - ease((u - 2.6) / 0.25);
    return 0;
  }
  // 姿态 → drawMech 的参数
  function poseParams(pose, cls, t) {
    if (pose === 'walk') {
      const v = WALK[cls], stride = LL.strideFor(v);
      return { mv: true, a: TAU * t * v / (4 * stride), stride, t };
    }
    if (pose === 'run') {
      const v = RUN[cls], stride = Math.min(54, 24 + v * 0.2);
      return { mv: true, a: TAU * t * v / (4 * stride), stride, duty: 0.36, liftK: 1.5, hop: 4, lean: 1, t };
    }
    if (pose === 'crouch') return { mv: false, a: 0, stride: 16, crouch: crouchState(t), t };
    const j = jumpState(t, JUMP_H[cls]);
    return { mv: false, a: 0, stride: 16, crouch: j.crouch, air: j.air, tuck: j.tuck, t, launch: j.launch, land: j.land };
  }
  // 地面影子：离地越高越小越淡（画在车下面，2D 直接画）
  function shadow(g, X0, Y0, air) {
    const w = Math.round(30 - Math.min(18, air * 0.18)), a = Math.max(0.18, 0.5 - air * 0.004);
    g.fillStyle = `rgba(7,8,12,${a.toFixed(2)})`;
    const cx = HIPX - X0, cy = GROUND - Y0;
    for (let i = -w; i <= w; i++) { const h = Math.round(2.6 * Math.sqrt(Math.max(0, 1 - (i / w) ** 2))); if (h > 0) g.fillRect(cx + i, cy - h + 1, 1, h * 2 - 1); }
  }

  // ---------- 一张姿态画布 ----------
  const PENS = new Map();
  const penFor = (cv) => { let pn = PENS.get(cv); if (!pn || pn.w !== cv.width) { pn = LL.Pen(cv.width, cv.height); pn.w = cv.width; PENS.set(cv, pn); } return pn; };
  const POSE_BOX = { X0: PADX + 4 * S, Y0: 16, W: 8 * S, H: GROUND + 12 - 16 };
  const PART_BOX = { X0: HIPX - 60, Y0: 120, W: 120, H: GROUND + 12 - 120 };   // 腿部件：只看腿
  function renderPose(cv, spec, st) {
    const g = cv.getContext('2d'), pn = penFor(cv), { X0, Y0 } = spec.box || POSE_BOX;
    g.clearRect(0, 0, cv.width, cv.height);
    const p = poseParams(spec.pose, spec.cls, st.t + (spec.t0 || 0));
    if (!st.mv && (spec.pose === 'walk' || spec.pose === 'run')) p.mv = false;
    g.fillStyle = P.bg[4]; g.fillRect(0, GROUND - Y0, cv.width, 12); g.fillStyle = P.bg[5]; g.fillRect(0, GROUND - Y0, cv.width, 1);
    shadow(g, X0, Y0, p.air || 0);
    p.out = {};
    if (spec.part) p.legPart = LEGPARTS[spec.part].draw;
    drawMech(pn, spec.mech ? mech(spec.mech) : null, spec.leg, p, X0, Y0);
    // 起跳：脚底 / 跳跃件喷汽；落地：尘土
    if (p.launch >= 0) {
      const at = p.out.nozzle || [HIPX + 2, GROUND - 4];
      puff(pn, at[0], Math.min(GROUND - 3, at[1] + 6 + p.launch * 10), p.launch, 7, STEAM, 1.3);
      if (!p.out.nozzle) puff(pn, HIPX + 10, GROUND - 3, p.launch, 5, STEAM, 1);
    }
    if (p.land >= 0) { puff(pn, HIPX - 14, GROUND - 2, p.land, 4, DUST, 1.1); puff(pn, HIPX + 16, GROUND - 2, p.land, 4, DUST, 1.1); }
    if (spec.pose === 'crouch' && p.crouch > 0.95) { const age = ((st.t + (spec.t0 || 0)) % 3.2 - 0.95) / 0.6; puff(pn, HIPX + 4, GROUND - 30, age, 4, STEAM, 0.8); }
    if (spec.pose === 'run' && p.out.exhaust && st.mv) { const age = ((st.t * 2.2) % 1); puff(pn, p.out.exhaust[0] - age * 6, p.out.exhaust[1], age, 3, STEAM, 0.7); }
    pn.flush(g);
  }

  // ---------- ③ 腿部件（画在腿的放大坐标里：1 单位 ≈ 2 像素） ----------
  // J = { hip, knee, ankle, T: 大腿骨, S: 小腿骨 }；骨骼坐标 p(a, f)：a 沿骨骼，f > 0 朝车头。o.out 记下喷口在世界里的位置（给页面画蒸汽）
  const toWorld = (pn, J, pt) => [J.hip[0] + (pt[0] - J.hip[0]) * pn.s, J.hip[1] + (pt[1] - J.hip[1]) * pn.s];
  // 部件贴着骨骼中线画（f 只偏 ±1～2）：腿有粗有细，贴着中线才不会挂在半空。主体用黄铜，在铁色的腿上一眼看得出是「装上去的东西」
  function coil(pn, A, B, turns, amp, ramp) {
    const BB = bone(...A, ...B), n = turns * 2;
    for (let i = 0; i < n; i++) pn.cap(...BB.p(BB.len * i / n, i % 2 ? amp : -amp), ...BB.p(BB.len * (i + 1) / n, i % 2 ? -amp : amp), 0.55);
    pn.paint(ramp, { bevel: 'l' });
  }
  function band(pn, Bn, a, f0, f1, ramp, w = 0.6) { pn.poly(Bn.pts([[a - w, f0], [a + w, f0], [a + w, f1], [a - w, f1]])).paint(ramp); }
  const LEGPARTS = {
    // ---- 跳跃件（小腿位）----
    jumpA: {
      slot: '小腿', name: 'A 弹簧蹬缸', idea: '小腿后缘一根活塞缸，杆上套一圈黄铜粗弹簧；蓄力下蹲时弹簧被压紧，起跳时弹开。最好认的「弹」。',
      draw(pn, J, M, o) {
        const Sb = J.S, L = Sb.len, c = o.crouch || 0, mid = 0.38 + 0.2 * c, f = -1.8;
        const top = Sb.p(0.8, f), bot = Sb.p(L + 0.2, f), m = Sb.p(L * mid, f);
        pn.cap(...m, ...bot, 0.55).paint(M.steel, { bevel: 'l' });
        coil(pn, Sb.p(L * mid + 0.7, f), Sb.p(L - 0.5, f), 4, 1.7, M.brass);
        pn.cap(...top, ...m, 1.45).paint(M.dark);
        band(pn, Sb, L * mid - 0.4, f - 1.6, f + 1.6, M.brass);
        pn.disc(...top, 1).paint(M.brass); pn.disc(...bot, 1).paint(M.brass);
      },
    },
    jumpB: {
      slot: '小腿', name: 'B 蒸汽弹射缸', idea: '小腿前面绑一只黄铜汽缸，底下一只朝下的喇叭喷口：起跳时往地上猛喷一口白汽把车顶起来。',
      draw(pn, J, M, o) {
        const Sb = J.S, L = Sb.len, f = 0.8, a0 = 1.2, a1 = L - 2.6;
        pn.cap(...Sb.p(a0, f), ...Sb.p(a1, f), 1.85).paint(M.brass);
        for (const a of [a0 + 1.1, a1 - 0.9]) band(pn, Sb, a, f - 2, f + 2, M.dark, 0.5);
        pn.poly(Sb.pts([[a1 + 0.6, f - 1], [a1 + 0.6, f + 1], [L + 1, f + 2.1], [L + 1, f - 2.1]])).paint(M.dark);
        pn.disc(...Sb.p(a0 + 0.2, f), 0.9).paint(M.steel);
        o.out && (o.out.nozzle = toWorld(pn, J, Sb.p(L + 1.2, f)));
      },
    },
    jumpC: {
      slot: '小腿', name: 'C 板簧蹬刺', idea: '小腿后面两片叠起来的弓形钢板簧，往后鼓出腿外，末端一根伸到脚跟后面的铁刺；下蹲时板簧被压得更弯。',
      draw(pn, J, M, o) {
        const Sb = J.S, L = Sb.len, c = o.crouch || 0;
        for (let i = 1; i >= 0; i--) {
          const bow = 2.8 + i * 1.3 + c * 1.2, a0 = 1 + i * 1.5, a1 = L + 0.6, pts = [];
          for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push(Sb.p(a0 + (a1 - a0) * u, -1.4 - Math.sin(Math.PI * u) * bow)); }
          for (let k = 10; k >= 0; k--) { const u = k / 10; pts.push(Sb.p(a0 + (a1 - a0) * u, -1.4 - Math.sin(Math.PI * u) * bow + 1.1)); }
          pn.poly(pts).paint(i === 0 ? M.steel : M.iron);
        }
        pn.poly(Sb.pts([[L - 0.6, -0.6], [L + 1, -2.4], [L + 3.4, -4.4]])).paint(M.steel);
        band(pn, Sb, 1.4, -3.4, 0.6, M.brass, 0.7);
      },
    },
    // ---- 提速件（大腿位）----
    speedA: {
      slot: '大腿', name: 'A 助力活塞', idea: '大腿前缘一根跨过膝盖的黄铜活塞，像一条铁的股四头肌：缸体绑在大腿上，活塞杆接到小腿上端，膝盖一弯一伸它就跟着伸缩。',
      draw(pn, J, M, o) {
        const T = J.T, Sb = J.S, A = T.p(1.6, 2.4), Bp = T.p(T.len * 0.64, 2.8), C2 = Sb.p(2.4, 2.2);
        pn.cap(...Bp, ...C2, 0.6).paint(M.steel, { bevel: 'l' });
        pn.cap(...A, ...Bp, 1.5).paint(M.brass);
        band(pn, T, T.len * 0.36, 0.8, 4.6, M.dark, 0.45);
        pn.disc(...A, 1.1).paint(M.dark); pn.disc(...C2, 1.1).paint(M.dark);
      },
    },
    speedB: {
      slot: '大腿', name: 'B 飞轮增速箱', idea: '大腿外侧一只黄铜飞轮，跑起来越转越快；一根连杆从飞轮边接到小腿上，像火车的曲柄。最「蒸汽」的提速件。',
      draw(pn, J, M, o) {
        const T = J.T, Sb = J.S, c = T.p(T.len * 0.48, 0.3), r = 3.3, rot = (o.a || 0) * 2;
        const crank = [c[0] + Math.cos(rot) * (r - 1), c[1] + Math.sin(rot) * (r - 1)];
        pn.cap(...crank, ...Sb.p(2.8, 0.3), 0.55).paint(M.steel, { bevel: 'l' });
        pn.disc(...c, r).paint(M.brass);
        pn.disc(...c, r - 1).paint(M.dark, { outline: false });
        for (let k = 0; k < 3; k++) { const a = rot + k * TAU / 3; pn.cap(...c, c[0] + Math.cos(a) * (r - 1.1), c[1] + Math.sin(a) * (r - 1.1), 0.4); }
        pn.paint(M.brass, { outline: false });
        pn.disc(...crank, 0.75).paint(M.steel);
      },
    },
    speedC: {
      slot: '大腿', name: 'C 双汽缸增压', idea: '大腿外侧一上一下两只黄铜短汽缸，一根汽管从胯上接下来；跑起来缸尾一下一下排白汽。',
      draw(pn, J, M, o) {
        const T = J.T, L = T.len;
        pn.cap(...T.p(-0.5, -2.2), ...T.p(L * 0.34, -2.2), 0.55).paint(M.steel, { bevel: 'l' });   // 汽管
        for (const [a, f] of [[L * 0.36, -1], [L * 0.7, 1]]) {
          pn.cap(...T.p(a - 2, f), ...T.p(a + 2, f), 1.35).paint(M.brass);
          band(pn, T, a + 2.1, f - 1.3, f + 1.3, M.dark, 0.45);
        }
        o.out && (o.out.exhaust = toWorld(pn, J, T.p(L * 0.7 + 2.6, 1)));
      },
    },
  };

  // 腿部件画布：腿 + 一圈示意躯干；跳跃件放「走 → 蓄力起跳」，提速件放「走 → 快跑」
  function renderPart(cv, spec, st) {
    const id = spec.part, isJump = id.startsWith('jump'), t = st.t + (spec.t0 || 0), cyc = 4.2, u = t % cyc;
    const pose = isJump ? (u < 1.8 ? 'walk' : 'jump') : (u < 2.1 ? 'walk' : 'run');
    const t2 = isJump && pose === 'jump' ? (u - 1.8 + 0.55) : t;
    renderPose(cv, { ...spec, pose, t0: 0 }, { ...st, t: t2 });
  }

  return { CLASSES, MAT_NAME, LEGPARTS, laneSize, renderLane, renderPose, renderPart, POSE_BOX, PART_BOX, JUMP_H, WALK, RUN };
})();
