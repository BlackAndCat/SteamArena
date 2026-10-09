// 出征预热专用运行时：只加载正式规则，在独立全局执行原 prepare，不接触页面战斗或存档。
'use strict';
const noop = () => {};
self.window = self;
self.innerWidth = 1000;
self.innerHeight = 600;
self.requestAnimationFrame = noop;
self.cancelAnimationFrame = noop;
self.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
self.sessionStorage = { getItem: () => null, setItem: noop };
self.Image = function Image() {};
self.Node = function Node() {};

/** 与无画面 evolve 检查器同样的最小画布桩；视觉依赖只初始化，不执行绘制循环。 */
function element(tag = 'div') {
  const out = { style: {}, children: [], classList: { add: noop, remove: noop, toggle: noop },
    appendChild(value) { this.children.push(value); return value; }, append: noop,
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    remove: noop, width: 0, height: 0 };
  if (tag === 'canvas') out.getContext = () => new Proxy({ canvas: out,
    measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
  { get: (target, key) => key in target ? target[key] : noop });
  return out;
}
self.document = { createElement: element, createTextNode: text => ({ textContent: text }),
  addEventListener: noop, removeEventListener: noop, querySelector: () => element(), querySelectorAll: () => [],
  body: element(), documentElement: element() };
let initialized = false;
// 与主线程保持同一发行版本；开发环境没有版本查询串时沿用原路径。
const loadScripts = (...names) => importScripts(...names.map(name => name + (self.location?.search || '')));

/** 配置来自调用时的完整快照，绝不通过网络重新读取另一版本的数据。 */
self.onmessage = event => {
  try {
    const input = event.data;
    if (!initialized) {
      const actualModules = JSON.parse(JSON.stringify(input.configs.modules.MODULES));
      self.SA = { Config: { get: name => input.configs[name],
        text: (key, ...args) => input.configs.ui.messages[key].replace(/\{\{(\d+)\}\}/g, (_, i) => String(args[+i])) }, h: noop };
      loadScripts('palette.js', 'modules.js', 'module-art.js', 'dynamics.js', 'sprites.js', 'legs.js',
        'vehicle.js', 'content.js', 'stage-cars.js');
      // 模块外观脚本会合并字段；最后覆盖为主页面实际使用的完整模块值。
      for (const key of Object.keys(SA.MODULES)) delete SA.MODULES[key];
      Object.assign(SA.MODULES, actualModules);
      SA.RULES = input.configs.rules;
      SA.S = { d: null, starterVehicle: () => JSON.parse(JSON.stringify(input.starter)) };
      loadScripts('route-mobs.js', 'battle.js', 'route-data.js', 'route.js');
      initialized = true;
    }
    SA.S.d = { vehicle: input.options.vehicle, route: input.record };
    self.postMessage({ ok: true, plan: SA.Route.prepare(input.route, input.options) });
  } catch (error) {
    // 合法任务自身出错只结束本次预热；主线程冷路径仍会给出既有错误，不永久禁用其他路线。
    self.postMessage({ ok: false, error: error.message, restart: !initialized });
  }
};
