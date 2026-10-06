// 「当前开发」页：双足强化 v6（2026-10-05，计划见 docs/biped-plan.md）。
// v6：用户说步幅太大、跑步很怪 → 走路 / 跑步在 js/legs.js 里重做（已进游戏），本页顶上 ⓪ 节看游戏整车和 15 种腿的走 / 跑；
//     晶枝腿归标准腿；跳跃件定 A；提速件改到胯部（下一轮）。以下是 v5 的说明。
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
    { id: 'std', name: '标准腿', sub: '主线六档 + 晶枝腿（用户 2026-10-05 定：晶枝腿归标准）', walk: 62,
      legs: [['mk2', 1, '工装 Mk.II'], ['heron', 2, '鹭步'], ['gren', 3, '掷弹兵'], ['knight', 4, '蒸汽圣骑'], ['clock', 5, '钟表巨像'], ['dragon', 6, '熔心龙骑'], ['crystal', 6, '晶枝腿']],
      read: '数值就是现在的双足；造型从细到粗按档位走。' },
    { id: 'light', name: '轻型腿', sub: '唯一腿 4 种：跑得快、跳得高、躲得开，扛不动重东西', walk: 70,
      legs: [['stilt', 2, '高跷'], ['blade', 3, '板簧跑刃'], ['panto', 4, '缩放仪平行腿'], ['bellows', 5, '风箱腿']],
      read: '细、长、弹：伸缩套筒、叠层板簧、平行杆、风箱——都是「能弹起来」的东西；脚小，起伏大。' },
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
    const v = cls.walk * (st.mv ? 1 : 0), dist = st.t * v, stride = LL.strideFor(v), run = LL.bipedRun(v);
    const a = st.mv ? TAU * dist / (4 * stride) : 0;
    const bd = LL.bipedBob({ mv: st.mv, a, stride, run });
    cls.legs.forEach(([leg, mt], i) => {
      const x = 24 + i * LANE, y = 18;
      SA.SPR.drawModule(g, 'biped', x, y, { moving: st.mv, gait: a + i * 0.9, stride, runK: run, bd, mt, look: VARIANT.has(leg) ? leg : undefined, t: st.t });
    });
    g.fillStyle = P.bg[4]; g.fillRect(0, 18 + 96, cv.width, 2);
    if (sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = P.black; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; g.fillStyle = P.bg[4]; g.fillRect(0, 18 + 96, cv.width, 2); }
  }

  // ---------- ⓪ 走路 / 跑步（2026-10-05 重做）----------
  // 一排腿（游戏精灵，带材料色）按同一个车速原地走 / 跑：步幅、跑步程度都用游戏的 strideFor / bipedRun
  const ALL_LEGS = () => CLASSES.flatMap(c => c.legs);
  function renderGaitLane(cv, v, st) {
    const g = cv.getContext('2d'), legs = ALL_LEGS();
    g.clearRect(0, 0, cv.width, cv.height);
    const sp = st.mv ? v : 0, stride = LL.strideFor(sp), run = LL.bipedRun(sp), a = st.mv ? TAU * st.t * sp / (4 * stride) : 0;
    const bd = LL.bipedBob({ mv: st.mv, a, stride: Math.round(stride / 2) * 2, run: Math.round(run * 4) / 4 });
    legs.forEach(([leg, mt], i) => {
      SA.SPR.drawModule(g, 'biped', 20 + i * 60, 18, { moving: st.mv, gait: a, stride, runK: Math.round(run * 4) / 4, bd, mt, look: VARIANT.has(leg) ? leg : undefined, t: st.t });
    });
    g.fillStyle = P.bg[4]; g.fillRect(0, 18 + 96, cv.width, 2);
  }
  const gaitLaneSize = () => ({ w: ALL_LEGS().length * 60 + 50, h: 128 });
  // 游戏整车：SA.SPR.renderVehicle（和战斗里同一条路），车速可调；跑起来躯干前倾也在这里
  const GV = { phase: 0, last: 0 };
  function renderGameCar(cv, v, st, speed) {
    const g = cv.getContext('2d'), sp = st.mv ? speed : 0;
    const dt = Math.max(0, Math.min(0.1, st.t - GV.last)); GV.last = st.t;
    GV.phase += TAU * sp * dt / (4 * LL.strideFor(sp || 1));
    const car = SA.SPR.renderVehicle(v, { moving: sp > 0, speed: sp, phase: GV.phase, key: 'cur-gait', t: st.t });
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = P.bg[4]; g.fillRect(0, GROUND - 40, cv.width, 12);
    g.drawImage(car, 0, 40, car.width, car.height - 40, (cv.width - car.width) / 2, 0, car.width, car.height - 40);   // 裁掉车顶上方 40px 空白
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
    const bd = p.air ? 0 : LL.bipedBob({ mv: p.mv, a: p.a, stride: p.stride, run: p.run });
    const cr = Math.round(LL.BIPED_CROUCH * (p.crouch || 0)), dy = cr - Math.round(p.air || 0), lean = p.lean || 0;
    const lo = { mv: p.mv, a: p.a, stride: p.stride, run: p.run, bd, legs: leg, t: p.t, phase: p.a * 4,
      crouch: p.crouch, air: !!p.air, tuck: p.tuck, legPart: p.legPart, hipPart: p.hipPart, out: p.out };
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
  const WALK = { light: 70, std: 62, heavy: 50 }, RUN = { light: 125, std: 112, heavy: 100 };
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
    if (pose === 'walk' || pose === 'run') {
      const v = (pose === 'walk' ? WALK : RUN)[cls], stride = LL.strideFor(v), run = LL.bipedRun(v);
      return { mv: true, a: TAU * t * v / (4 * stride), stride, run, lean: run > 0.5 ? 1 : 0, t };
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
    if (spec.hip) p.hipPart = HIPPARTS[spec.hip].draw;
    drawMech(pn, spec.mech ? mech(spec.mech) : null, spec.leg, p, X0, Y0);
    // 起跳：脚底 / 跳跃件喷汽；落地：尘土
    if (p.launch >= 0) {
      const at = p.out.nozzle || [HIPX + 2, GROUND - 4];
      puff(pn, at[0], Math.min(GROUND - 3, at[1] + 6 + p.launch * 10), p.launch, 7, STEAM, 1.3);
      if (!p.out.nozzle) puff(pn, HIPX + 10, GROUND - 3, p.launch, 5, STEAM, 1);
    }
    if (p.land >= 0) { puff(pn, HIPX - 14, GROUND - 2, p.land, 4, DUST, 1.1); puff(pn, HIPX + 16, GROUND - 2, p.land, 4, DUST, 1.1); }
    if (spec.pose === 'crouch' && p.crouch > 0.95) { const age = ((st.t + (spec.t0 || 0)) % 3.2 - 0.95) / 0.6; puff(pn, HIPX + 4, GROUND - 30, age, 4, STEAM, 0.8); }
    if (spec.pose === 'run' && p.out.hipExhaust && st.mv) { const age = ((st.t * 2.6) % 1); puff(pn, p.out.hipExhaust[0] - age * 4, p.out.hipExhaust[1] - age * 4, age, 3, STEAM, 0.8); }
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
      slot: '小腿', name: '跳跃件 · 弹簧蹬缸（用户选定 A，已定稿进 legs.js）', idea: '小腿后缘一根活塞缸，杆上套一圈黄铜粗弹簧；蓄力下蹲时弹簧被压紧，起跳时弹开。',
      draw: (pn, J, M, o) => LL.bipedParts.jumpSpring(pn, J, M, o),
    },
  };

  // ---------- ④ 胯部提速件（2026-10-05 用户定装在胯部，不占大腿位）：画在胯的近侧面，胯之后、近侧腿之前 ----------
  // hipPart(pn, cx, Y, o)：cx = 胯中心，Y = 模块顶（含起伏）；近侧胯关节在 (cx - 2, Y + 29)
  const HIPPARTS = {
    B: {
      name: '提速件 · 双缸增压器（用户选定 B，已定稿进 legs.js）', idea: '胯后下方一上一下两只横放的短汽缸，活塞杆跟着步子一伸一缩，一根排气管顺着胯后沿往上；跑起来排气管一口一口冒白汽。A 飞轮增速箱、C 离心调速球没选，代码在 git 历史里。',
      draw: (pn, cx, Y, o) => LL.bipedParts.hipBooster(pn, cx, Y, o),
    },
  };

  // ---------- ⑤ 机甲头盔（新模块 mech_helm，2×1；头盔只占中间一格，两侧是防御饰件）----------
  // 造型在游戏的 js/sprites.js（SA.SPR.MECH_HELMS），这里只是走游戏的渲染：drawModule / renderVehicle 指定方案 hs / helmStyle
  const HELMS = SA.SPR.MECH_HELMS;
  const HELM_MATS = [1, 3, 5];
  // 近景：每种方案一行，三种材料（黄铜 / 钢 / 乌兹钢）
  const HELM_CLOSE = { W: 40 + HELM_MATS.length * 64, H: 40 };
  function renderHelmClose(cv, id) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    HELM_MATS.forEach((mt, i) => SA.SPR.drawModule(g, 'mech_helm', 12 + i * 64, 10, { mt, hs: id }));
  }
  // 整车：头盔装在双足躯干顶上，正对胯（两侧不再另配肩甲，头盔自带）
  const HELM_CAR = [['biped', 8, 6], ['boiler_s', 6, 5], ['boiler', 6, 6], ['tank_tall', 6, 8], ['mech_helm', 5, 6]];
  const HC = {};
  function helmCar(mt) {
    if (HC[mt]) return HC[mt];
    const v = SA.V.create('头盔样车');
    for (const [id, r, c] of HELM_CAR) v.body[r][c] = SA.newCell(id, mt);
    return (HC[mt] = v);
  }
  const HELM_BOX = { W: 7 * S, H: GROUND + 12 - 80 };
  function renderHelm(cv, spec, st) {
    const g = cv.getContext('2d'), v = helmCar(spec.mt), sp = st.mv ? 55 : 0;
    const stride = LL.strideFor(sp), a = st.mv ? TAU * st.t * sp / (4 * stride) : 0;
    const car = SA.SPR.renderVehicle(v, { moving: sp > 0, speed: sp, phase: a, key: 'helm-' + spec.id + spec.mt, t: st.t, helmStyle: spec.id });
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = P.bg[4]; g.fillRect(0, GROUND - 80, cv.width, 12);
    g.drawImage(car, -(PADX + 4 * S), -80);
  }

  // 腿部件画布：腿 + 一圈示意躯干；跳跃件放「走 → 蓄力起跳」，提速件放「走 → 快跑」
  function renderPart(cv, spec, st) {
    const id = spec.part || 'speed', isJump = id.startsWith('jump'), t = st.t + (spec.t0 || 0), cyc = 4.2, u = t % cyc;
    const pose = isJump ? (u < 1.8 ? 'walk' : 'jump') : (u < 2.1 ? 'walk' : 'run');
    const t2 = isJump && pose === 'jump' ? (u - 1.8 + 0.55) : t;
    renderPose(cv, { ...spec, pose, t0: 0 }, { ...st, t: t2 });
  }

  return { CLASSES, MAT_NAME, LEGPARTS, HIPPARTS, HELMS, HELM_MATS, HELM_BOX, HELM_CLOSE, renderHelm, renderHelmClose, laneSize, renderLane, ALL_LEGS, gaitLaneSize, renderGaitLane, renderGameCar, renderPose, renderPart, POSE_BOX, PART_BOX, JUMP_H, WALK, RUN };
})();
