/* 出征后台工具：只编辑内存草稿，显式保存才写正式配置；模拟使用真实规则和车辆副本。 */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const number = value => Number.isFinite(value) ? value.toFixed(2) : '—';
  const names = { coal: '煤炭', water: '冷却水', supply: '物资', refugee: '难民', relic: '遗迹装备',
    crate: '木箱', barricade: '路障', ruinDoor: '遗迹门' };
  const types = { prop: '道路物件', pickup: '计划拾取', encounter: '敌人遭遇', conditional: '条件物资', depot: '终点',
    'encounter-start': '遭遇开始', 'encounter-end': '遭遇结束', node: '经过节点', 'coal-low': '煤量偏低', 'coal-empty': '煤炭耗尽', 'route-end': '出征结束' };
  const causes = { combat: '战斗中损毁', overheat: '温度达到结束阈值', coal: '煤炭耗尽', budget: '模拟预算耗尽',
    depot: '抵达终点', recall: '主动返航', wrecked: '车辆损毁', stranded: '无法继续前进' };
  let draft, selected = 0, vehicles = [], previewJSON = null, busy = false;

  /** 监控主表使用玩家可读说明；原始字段只保留在编辑表与完整 JSON 预览。 */
  function planDetails(node) {
    const d = node.details || {};
    if (node.type === 'encounter') return `敌车 ${d.car}，出现 ${number(d.guard)}，边界 ${number(d.leash)}`;
    if (node.type === 'conditional') return `击败第 ${(d.encounterIndex ?? 0) + 1} 辆敌车后出现物资，领取待接入`;
    if (node.type === 'depot') return `抵达终点；计划加成 ${d.bonus ?? 0}，奖励结算待接入`;
    if (node.type === 'prop') return `宽 ${number(d.w)}，高 ${number(d.h)}，耐久 ${number(d.hp)}`;
    if (d.kind === 'coal') return `慢行拾取，补 ${number(d.amount * 100)}% 容量`;
    if (d.kind === 'water') return `停车补水，${d.amount === undefined ? '补满储水' : '补 ' + number(d.amount) + ' L'}`;
    if (d.kind === 'refugee') return `难民 ${d.n || 1} 人，领取待接入`;
    if (d.kind === 'supply') return `物资 ${d.n || 1} 份，领取待接入`;
    if (d.kind === 'relic') return `${d.module ? SA.MODULES[d.module]?.name || d.module : '装备尚未指定'}${d.gate === undefined ? '' : '，需突破坐标 ' + number(d.gate) + ' 的遗迹门'}，领取待接入`;
    return d.requires || '计划节点';
  }
  function eventDetails(event) {
    if (event.type === 'pickup') return `实际获得${names[event.kind] || event.kind} ${number(event.amount)} ${event.kind === 'coal' ? 'kg' : 'L'}`;
    if (event.encounterIndex !== undefined) return `第 ${event.encounterIndex + 1} 辆敌车${event.type === 'encounter-start' ? '开始交战' : '已清除'}`;
    if (event.type === 'node') return ['supply', 'refugee', 'relic'].includes(event.kind) ? '仅经过计划节点，领取待接入' : '已经过；是否拾取以实际拾取事件为准';
    if (event.type === 'route-end') return causes[event.cause] || event.cause || '本次出征结束';
    if (event.type === 'coal-low') return `剩余煤炭 ${number(event.amount)} kg`;
    return '—';
  }

  /** 文本均通过 textContent 插入，配置名称与错误信息不会被当成 HTML。 */
  function status(message, ok = false) {
    $('status').textContent = message;
    $('status').className = ok ? 'ok' : 'error';
  }
  function dirty() {
    previewJSON = null;
    $('save').disabled = true;
    $('planSummary').textContent = '草稿已变更，请重新预览；下方若有旧表格不代表当前草稿。';
    $('planNodes').replaceChildren();
    $('json').textContent = '';
  }
  function table(id, rows) {
    $(id).replaceChildren(...rows.map(values => {
      const tr = document.createElement('tr');
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');
        tr.append(td);
      }
      return tr;
    }));
  }
  function option(select, value, label) {
    const item = document.createElement('option');
    item.value = value; item.textContent = label; select.append(item);
  }
  /** 可选字段留空时删除，其他字段原样保留，避免重组配置丢失未知数据。 */
  function input(value, type, update, optional = false) {
    const el = document.createElement('input');
    el.type = type; el.value = value ?? '';
    if (type === 'number') el.step = 'any';
    el.addEventListener('input', () => {
      update(el.value === '' && optional ? undefined : type === 'number' ? (el.value === '' ? NaN : Number(el.value)) : el.value);
      dirty();
    });
    return el;
  }
  function assign(item, key, value) {
    if (value === undefined) delete item[key]; else item[key] = value;
  }
  /** 每行直接绑定草稿对象，切换路线不会丢失前一路线的未保存修改。 */
  function rows(kind, fields) {
    const items = draft.routes[selected][kind];
    $(kind).replaceChildren(...items.map((item, index) => {
      const tr = document.createElement('tr');
      for (const [key, type, optional] of fields) {
        const td = document.createElement('td');
        if (key === 'car') {
          const select = document.createElement('select');
          const records = SA.STAGE_CARS.records || {};
          for (const id of Object.keys(records)) option(select, id, `${id} · ${records[id].vehicleName || records[id].name}`);
          if (!records[item.car]) option(select, item.car || '', `${item.car || '未指定'}（记录缺失）`);
          select.value = item.car || '';
          select.addEventListener('change', () => { item.car = select.value; dirty(); });
          td.append(select);
        } else td.append(input(item[key], type, value => assign(item, key, value), optional));
        tr.append(td);
      }
      const td = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.textContent = '删除';
      button.addEventListener('click', () => { items.splice(index, 1); dirty(); renderRoute(); });
      td.append(button); tr.append(td); return tr;
    }));
  }
  function renderRoute() {
    const route = draft.routes[selected];
    for (const [id, value] of [['routeName', route.name], ['len', route.len], ['endX', route.end.x], ['bonus', route.end.bonus]]) $(id).value = value ?? '';
    rows('encounters', [['name', 'text'], ['at', 'number'], ['guard', 'number'], ['leash', 'number'], ['car', 'text']]);
    rows('pickups', [['kind', 'text'], ['x', 'number'], ['amount', 'number', true], ['n', 'number', true], ['module', 'text', true]]);
  }
  /** 直接读取已有存档，不调用会迁移或补写存档的 State.load。车辆构造失败明确保留提示。 */
  function loadVehicles() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('steam_arena_save_v2')); }
    catch { status('当前存档不可读取；仍可选择正式关卡记录车。'); }
    if (saved?.vehicle) {
      try { vehicles.push({ label: `当前存档车 · ${saved.vehicle.name || '未命名'}`, value: SA.V.migrate(copy(saved.vehicle)) }); }
      catch (error) { status('当前存档车无法解析：' + error.message); }
    }
    for (const [id, record] of Object.entries(SA.STAGE_CARS.records || {})) {
      try {
        const vehicle = SA.StageCars.vehicle(record, record.vehicleName || record.name);
        if (vehicle) vehicles.push({ label: `正式记录 ${id} · ${vehicle.name}`, value: vehicle });
      } catch (error) { console.warn('关卡记录车不可解析', id, error); }
    }
    vehicles.forEach((item, index) => option($('vehicle'), index, item.label));
    if (!vehicles.length) option($('vehicle'), '', '没有可测试车辆');
  }
  function ready() {
    for (const method of ['getConfig', 'validateConfig', 'configure', 'plan', 'simulate'])
      if (typeof SA.Route?.[method] !== 'function') throw new Error('出征编辑接口尚未就绪：' + method + '，请同步核心脚本后刷新。');
  }
  /** 校验失败不覆盖草稿；configure 只改变当前工具页的后续计划与模拟。 */
  function configure() {
    ready();
    const checked = SA.Route.validateConfig(draft);
    if (!checked.ok) throw new Error(checked.errors.join('\n'));
    const configured = SA.Route.configure(copy(draft));
    if (!configured.ok) throw new Error(configured.errors.join('\n'));
  }
  function vehicle() {
    const item = vehicles[Number($('vehicle').value)];
    if (!item) throw new Error('请选择实际测试车辆');
    return copy(item.value);
  }
  function preview() {
    configure();
    const plan = SA.Route.plan({ route: draft.routes[selected].id, vehicle: vehicle() });
    const t = plan.totals;
    $('planSummary').textContent = `车辆：${plan.vehicleName}\n预计移动速度：${number(plan.speed)} px/s；煤容量：${number(plan.coalMax)} kg；热量结束阈值：${plan.heatLimit} °C\n计划敌人数：${plan.totalEnemies}；不含战斗停车的预计时间：${number(plan.durationEstimate)} 秒\n计划煤补给：${number(t.coalCapacityFraction * 100)}% 容量；给定水量：${number(t.waterLitres)} L；补满水节点：${t.waterFillNodes}\n计划节点与奖励（未领取）：煤堆 ${t.coal || 0} 处、水源 ${t.water || 0} 处、物资 ${t.supply || 0} 份、难民 ${t.refugee || 0} 人、遗迹 ${t.relic || 0} 份；击败敌车后条件物资 ${t.conditionalSupply || 0} 处`;
    table('planNodes', [...plan.nodes].sort((a, b) => a.x - b.x).map(node => [number(node.x), number(node.eta), types[node.type] || node.type, names[node.label] || node.label, planDetails(node)]));
    previewJSON = JSON.stringify(draft, null, 2);
    $('json').textContent = previewJSON; $('save').disabled = false;
    status('草稿校验通过。可查看计划和 JSON，再保存正式配置。', true);
  }
  /** 每条资源曲线采用实际样本；零容量显示零，绝不伪造可用资源。 */
  function chart(samples) {
    const canvas = $('chart'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!samples.length) return;
    const maxTime = Math.max(1, ...samples.map(s => s.t));
    const series = [s => s.coalMax ? 100 * s.coal / s.coalMax : 0, s => s.waterMax ? 100 * s.water / s.waterMax : 0, s => s.temperature];
    const maxValue = Math.max(120, ...samples.map(s => Number.isFinite(s.temperature) ? s.temperature : 0));
    ctx.strokeStyle = '#bbb'; ctx.strokeRect(45, 10, 940, 180);
    ctx.fillStyle = '#666'; ctx.font = '12px sans-serif';
    ctx.fillText('0', 25, 190); ctx.fillText(String(Math.ceil(maxValue)), 5, 15); ctx.fillText(`${number(maxTime)} 秒`, 900, 210);
    series.forEach((get, index) => {
      ctx.beginPath(); ctx.strokeStyle = ['#222', '#1677bd', '#be2727'][index]; let started = false;
      for (const sample of samples) {
        const value = get(sample); if (!Number.isFinite(value)) continue;
        const x = 45 + sample.t / maxTime * 940, y = 190 - value / maxValue * 180;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }
  function renderSimulation(result) {
    const cleared = Array.isArray(result.cleared) ? result.cleared.length : result.cleared;
    const cause = result.result?.cause || result.cause || result.reason || result.result?.reason || '未提供';
    const resources = result.resources ?? result.result?.resources;
    const resourceText = resources ? `煤 ${number(resources.coal)} / ${number(resources.coalMax)} kg，消耗 ${number(resources.coalBurned)} kg，实收 ${number(resources.coalPicked)} kg；水 ${number(resources.water)} / ${number(resources.waterMax)} L，实收 ${number(resources.waterPicked)} L；温度 ${number(resources.temperature)} °C` : '未提供资源数据';
    $('simulationSummary').textContent = `实际结束原因：${cause}（${causes[cause] || '未知原因'}）\n模拟已结束：${result.completed ? '是' : '否'}；实际时间：${number(result.time)} 秒；路程：${number(result.dist)} px；清除敌人数：${cleared ?? '—'}\n实际资源：${resourceText}${result.monitorTruncated ? '\n监控记录达到上限，以下事件或样本有截断。' : ''}`;
    if (!Array.isArray(result.events) || !Array.isArray(result.samples)) throw new Error('模拟返回记录接口尚未就绪，未生成监控表；上方保留真实结束结果。');
    table('events', result.events.map(event => [number(event.t), number(event.x), event.type === 'pickup' ? '实际拾取' : types[event.type] || event.type,
      event.type === 'node' ? '经过' + (names[event.kind] || event.kind) : event.type === 'route-end' ? '出征结束' : event.label, eventDetails(event)]));
    table('samples', result.samples.map(s => [number(s.t), number(s.x), `${number(s.coal)} / ${number(s.coalMax)}`, `${number(s.water)} / ${number(s.waterMax)}`, number(s.temperature), s.enemiesStarted, s.enemiesCleared]));
    chart(result.samples);
  }
  /** 先绘制运行状态，再运行有上限的同步模拟；运行期间冻结控件以保证所测草稿一致。 */
  async function simulate() {
    const seed = Number($('seed').value), maxTime = Number($('budget').value);
    if (!Number.isSafeInteger(seed)) throw new Error('种子必须是安全整数');
    if (!Number.isFinite(maxTime) || maxTime < 1 || maxTime > 600) throw new Error('模拟预算必须为 1～600 秒');
    configure(); const selectedVehicle = vehicle(), route = draft.routes[selected].id;
    const controls = [...document.querySelectorAll('input,select,button')], previous = controls.map(el => el.disabled);
    busy = true; controls.forEach(el => { el.disabled = true; });
    status('真实模拟运行中，最多推进指定游戏内预算……', true);
    $('simulate').textContent = '正在模拟……';
    table('events', []); table('samples', []); chart([]);
    $('simulationSummary').textContent = '运行中……';
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      renderSimulation(SA.Route.simulate({ route, vehicle: selectedVehicle, seed, maxTime }));
      status('真实模拟已结束；未完成、死亡和预算耗尽结果均已保留。', true);
    } finally {
      busy = false; controls.forEach((el, i) => { el.disabled = previous[i]; }); $('simulate').textContent = '真实模拟草稿';
    }
  }
  async function save() {
    if (!previewJSON || JSON.stringify(draft, null, 2) !== previewJSON) throw new Error('请先预览当前草稿再保存');
    const controls = [...document.querySelectorAll('input,select,button')], previous = controls.map(el => el.disabled);
    busy = true; controls.forEach(el => { el.disabled = true; });
    try {
      const response = await fetch('/__config/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'routes', data: draft }) });
      let result;
      try { result = await response.json(); } catch { throw new Error('保存服务不可用，请从仓库根目录运行 python tools/serve.py；草稿保留。'); }
      if (!response.ok || result.ok !== true) throw new Error((result.error || `HTTP ${response.status}`) + '；草稿保留。请确认使用 python tools/serve.py。');
      status('已成功写入 config/routes.json。正式游戏重新加载后读取新配置。', true);
    } finally { busy = false; controls.forEach((el, i) => { el.disabled = previous[i]; }); $('save').disabled = !previewJSON; }
  }
  function run(action) {
    if (busy) return;
    Promise.resolve().then(action).catch(error => status(error.message));
  }
  try {
    ready(); draft = SA.Route.getConfig();
    draft.routes.forEach((route, index) => option($('route'), index, `${route.id} · ${route.name}`));
    loadVehicles();
    for (const key of ['capacityPerKw', 'kgPerKj', 'idleKw']) {
      $(key).value = draft.fuel[key];
      $(key).addEventListener('input', () => { draft.fuel[key] = $(key).value === '' ? NaN : Number($(key).value); dirty(); });
    }
    for (const [id, key, end, optional] of [['routeName', 'name'], ['len', 'len'], ['endX', 'x', true], ['bonus', 'bonus', true, true]])
      $(id).addEventListener('input', () => {
        const target = end ? draft.routes[selected].end : draft.routes[selected];
        assign(target, key, optional && $(id).value === '' ? undefined : id === 'routeName' ? $(id).value : $(id).value === '' ? NaN : Number($(id).value)); dirty();
      });
    $('route').addEventListener('change', () => { selected = Number($('route').value); dirty(); renderRoute(); });
    $('vehicle').addEventListener('change', dirty);
    $('addEncounter').addEventListener('click', () => {
      const route = draft.routes[selected], previous = route.encounters.at(-1);
      route.encounters.push({ name: '新遭遇', at: previous?.at ?? 0, guard: previous?.guard ?? 0, leash: previous?.leash ?? 0, car: Object.keys(SA.STAGE_CARS.records || {})[0] || '' }); dirty(); renderRoute();
    });
    $('addPickup').addEventListener('click', () => { draft.routes[selected].pickups.push({ kind: 'coal', x: 0, amount: 0.15 }); dirty(); renderRoute(); });
    $('preview').addEventListener('click', () => run(preview)); $('save').addEventListener('click', () => run(save)); $('simulate').addEventListener('click', () => run(simulate));
    renderRoute(); status('正式配置已加载。编辑后先预览；模拟和读取车辆均不写玩家存档。', true);
  } catch (error) { status(error.message); document.querySelectorAll('button').forEach(button => { button.disabled = true; }); }
})();
