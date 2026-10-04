// 工作台的纯规则会话：一台当前车辆只属于一个明确的关卡或候选 ID。
// 不读写 DOM 和存储；车间负责显示，宿主负责按目标保存草稿。
(function (host) {
  'use strict';
  function create() {
    let target = null, vehicle = null;
    function select(next, car) {
      if (!next || !['stage', 'candidate'].includes(next.kind) || typeof next.id !== 'string' || !next.id || !car)
        throw new Error('工作台目标或车辆无效');
      target = { ...next };
      vehicle = car;
      return current();
    }
    function current() { return target ? { ...target } : null; }
    function matches(next) { return !!(target && next && target.kind === next.kind && target.id === next.id); }
    function requireTarget(next) {
      if (!matches(next)) throw new Error('工作台当前目标已改变，请重新打开后保存');
      return vehicle;
    }
    function replace(car) {
      if (!target || !car) throw new Error('工作台尚未打开有效目标');
      vehicle = car;
      return car;
    }
    return { select, current, matches, requireTarget, replace, vehicle: () => vehicle };
  }

  // 先完整解析并检查车辆，再交给会话替换；任何失败都不触碰旧车。
  function parseVehicle(text, name, SA) {
    const source = String(text || '').trim();
    if (!source) throw new Error('导入内容是空的');
    let vehicle;
    if (source.startsWith('SA1.') || source.startsWith('SA2.')) vehicle = SA.V.decode(source);
    else {
      const parsed = JSON.parse(source), cells = Array.isArray(parsed) ? parsed : parsed?.cells;
      if (!Array.isArray(cells) || !cells.length) throw new Error('需要分享码或非空 cells 模块清单');
      const anchors = new Set();
      for (const cell of cells) {
        if (!Array.isArray(cell) || cell.length < 4 || cell.length > 7) throw new Error('模块清单包含无效项目');
        const [layer, row, col, id, material = 1, level = 0] = cell;
        const live = typeof id === 'string' && SA.liveId(id);
        if (![0, 1].includes(layer) || !Number.isInteger(row) || !Number.isInteger(col)
          || row < 0 || row >= SA.K.ROWS || col < 0 || col >= SA.K.COLS
          || !SA.MODULES[live] || (SA.V.layerOf(live) === 'side') !== !!layer
          || !Number.isInteger(material) || material < 1 || !Number.isInteger(level) || level < 0)
          throw new Error('模块清单包含无效项目');
        const key = `${layer}:${row}:${col}`;
        if (anchors.has(key)) throw new Error('模块清单包含重复位置');
        anchors.add(key);
      }
      vehicle = SA.V.fromCells(name || '导入车辆', cells);
      let count = 0;
      SA.V.each(vehicle, () => { count++; });
      if (count !== cells.length) throw new Error('模块清单有部件在装配时丢失，原车未更换');
    }
    if (!vehicle) throw new Error('分享码无效，原车未更换');
    if (name) vehicle.name = name;
    return vehicle;
  }
  const api = { create, parseVehicle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (host) (host.SA ||= {}).WorkbenchSession = api;
})(typeof window !== 'undefined' ? window : null);
