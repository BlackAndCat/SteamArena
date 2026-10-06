// 「当前开发」页：双足进游戏 v9（2026-10-05，计划见 docs/biped-plan.md）。
// 这一页不复用：只放正在开发、等开发者确认的东西；确认后复制到 tools/archive/<名字>.*，在 labs.js 登记，再换下一项。
// 上一期（v5～v8：轻重腿、步态、腿部件、机甲头盔）归档在 tools/archive/biped-v8.*；头盔选定 D 指挥塔 · 斜装甲。
// 本期全部是游戏渲染（SA.SPR.renderVehicle），后台规则是 astra 2026-10-05 的第一版：
//   Ⓐ 六种骑士手臂（knight_*，2×3 侧挂）：近战臂按出手进度挥动，炮臂 / 腕枪臂跟着仰角转（炮口 = 模块数据里的 piv / blen）；
//   Ⓑ 整车：机甲头盔 + 弹簧蹬缸（小腿）+ 双缸增压器（胯）+ 骑士炮臂，走 → 跑 → 蹲 → 跳一轮；
//      战斗里整车的上下位移（蹲 24px、离地高度）由 battle-view 按 pivY 贴图，这里照同样的算法挪，地上画影子。
window.SA = window.SA || {};

SA.CUR = (() => {
  const P = SA.PAL, LL = SA.LEGLAB, S = 24, TAU = Math.PI * 2, PADX = SA.SPR.PADX, GROUND = SA.K.ROWS * S;
  const ARMS = [
    ['knight_shield', '骑士盾臂', '盾挡在胸前；走路时手臂跟着步子摆'],
    ['knight_fist', '骑士格斗臂', '贴身时一拳往前上捣出去（出手动画 = 战斗里 punch 从 1 衰减到 0）'],
    ['knight_hammer', '骑士锤臂', '蒸汽锤从举起砸到打下'],
    ['knight_sword', '骑士剑臂', '宽刃剑从上往前下劈'],
    ['knight_cannon', '骑士巨炮臂', '整条小臂就是一门炮，绕肘转着瞄准（-8°～30°）'],
    ['knight_gun', '骑士腕枪臂', '小臂指向瞄准方向，枪管从拳头前伸出（-8°～32°）'],
  ];
  const isGun = (id) => id === 'knight_cannon' || id === 'knight_gun';
  // 一台带手臂的双足：躯干 = 竖式锅炉 + 小水罐 + 甲片，顶上机甲头盔，手臂挂在胸口
  function armCar(id, mt) {
    const v = SA.V.create('骑士臂');
    v.body[8][6] = SA.newCell('biped', mt); v.body[6][6] = SA.newCell('boiler_s', mt); v.body[6][7] = SA.newCell('tank_s', mt);
    v.body[7][7] = SA.newCell('plate', mt); v.body[5][6] = SA.newCell('mech_helm', mt);
    v.side[5][7] = SA.newCell(id, mt);
    return v;
  }
  const CARS = {};
  const carOf = (key, make) => CARS[key] || (CARS[key] = make());
  function blitCar(cv, car, dx, dy) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = P.bg[4]; g.fillRect(0, cv.height - 10, cv.width, 10);
    g.drawImage(car, dx, dy);
  }
  // Ⓐ 手臂：近战约 1.4 秒出手一次；武器在仰角范围里来回扫；一直慢走
  const ARM_BOX = { W: 7 * S, H: 8 * S };
  function renderArm(cv, id, mt, st) {
    const v = carOf(id + mt, () => armCar(id, mt)), sp = st.mv ? 45 : 0, stride = LL.strideFor(sp), a = st.mv ? TAU * st.t * sp / (4 * stride) : 0;
    const o = { key: 'arm-' + id + mt, t: st.t, moving: sp > 0, speed: sp, phase: a };
    if (isGun(id)) o.elev = { '5,7,s': 11 + 19 * Math.sin(st.t * 1.3) };
    else o.punch = { '5,7': Math.max(0, 1 - ((st.t * 0.72) % 1) * 2.4) };
    const car = SA.SPR.renderVehicle(v, o);
    blitCar(cv, car, -(PADX + 4 * S) - 8, -(GROUND - ARM_BOX.H));
  }
  // Ⓑ 整车一轮：走 2 秒 → 跑 2 秒 → 蹲 1.6 秒 → 跳（0.15 秒蓄力 + 空中 0.8 秒，高 60px）→ 站 0.6 秒
  const FULL = [['biped', 8, 6, 'body'], ['boiler_s', 6, 6, 'body'], ['tank_s', 7, 7, 'body'], ['plate', 6, 7, 'body'], ['mech_helm', 5, 6, 'body'],
    ['leg_spring', 11, 6, 'side'], ['leg_booster', 8, 6, 'side'], ['knight_cannon', 5, 7, 'side']];
  function fullCar(mt) {
    const v = SA.V.create('骑士整车');
    for (const [id, r, c, layer] of FULL) v[layer][r][c] = SA.newCell(id, mt);
    return v;
  }
  const FULL_BOX = { W: 9 * S, H: 11 * S };   // 跳 60px 也装得下
  const PHASES = [['走', 2], ['跑', 2], ['蹲', 1.6], ['跳', 1.05], ['站', 0.6]], CYCLE = PHASES.reduce((a, [, d]) => a + d, 0);
  function poseAt(t) {
    let u = t % CYCLE;
    for (const [name, d] of PHASES) { if (u < d) return { name, sec: u }; u -= d; }
    return { name: '站', sec: 0 };
  }
  const FG = {};
  function renderFull(cv, mt, st) {
    const v = carOf('full' + mt, () => fullCar(mt)), p = poseAt(st.t), G = FG[mt] || (FG[mt] = { phase: 0, last: st.t });
    const dt = Math.max(0, Math.min(0.1, st.t - G.last)); G.last = st.t;
    const speed = !st.mv ? 0 : p.name === '走' ? 70 : p.name === '跑' ? 122 : 0;
    G.phase += TAU * speed * dt / (4 * LL.strideFor(speed || 1));
    let crouch = 0, air = false, tuck = 0, h = 0;
    if (p.name === '蹲') crouch = Math.min(1, p.sec / 0.25, (1.6 - p.sec) / 0.25);
    if (p.name === '跳') {
      if (p.sec < 0.15) crouch = p.sec / 0.15;
      else { const w = Math.min(1, (p.sec - 0.15) / 0.8); air = w < 1; h = 4 * 60 * w * (1 - w); tuck = Math.sin(Math.PI * w); }
    }
    const car = SA.SPR.renderVehicle(v, { key: 'full' + mt, t: st.t, moving: speed > 0, speed, phase: G.phase, crouch, air, tuck, elev: { '5,7,s': 6 } });
    const dx = -(PADX + 2 * S), dy = -(GROUND - FULL_BOX.H) - 10 + Math.round(24 * crouch - h);
    blitCar(cv, car, dx, dy);
    if (air) {   // 地影（同 battle-view 的 bipedAir）
      const g = cv.getContext('2d'), x = PADX + 7 * S + dx, w = Math.max(12, 26 - h * 0.14), a = Math.max(0.3, 0.55 - h * 0.004);
      g.fillStyle = `rgba(7,8,12,${a.toFixed(2)})`; g.beginPath(); g.ellipse(x, cv.height - 11, w, 3.5, 0, 0, TAU); g.fill();
    }
    return p.name;
  }
  return { ARMS, ARM_BOX, FULL_BOX, renderArm, renderFull };
})();
