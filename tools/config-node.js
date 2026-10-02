// Node 检查器从正式 JSON 注入与浏览器同名的同步配置接口。
'use strict';
const fs = require('fs');
const path = require('path');

function install(context, root = path.resolve(__dirname, '..')) {
  const dir = path.join(root, 'config');
  const data = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!/^[a-z0-9-]+\.json$/.test(name)) continue;
    data.set(name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  }
  const renderedKeys = new Map();
  const valid = name => typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(name);
  const api = {
    get(name) {
      if (!valid(name)) throw new Error('非法配置名：' + name);
      if (!data.has(name)) data.set(name, JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')));
      return data.get(name);
    },
    replace(name, value) { if (!valid(name)) throw new Error('非法配置名：' + name); data.set(name, value); return value; },
    clear(name) { if (name) data.delete(name); else data.clear(); },
    // 与浏览器 Config.text 相同：缺键报错，只替换显式编号占位符。
    text(key, ...args) {
      const template = this.get('ui').messages[key];
      if (typeof template !== 'string') throw new Error('缺少界面文案：' + key);
      const rendered = template.replace(/\{\{(\d+)\}\}/g, (_, index) => String(args[+index]));
      const previous = renderedKeys.get(rendered);
      renderedKeys.set(rendered, previous === undefined || previous === key ? key : null);
      context.SA.Text?.registerUi?.(key, rendered, template, args);
      return rendered;
    },
    keyForText(rendered) { return renderedKeys.get(String(rendered)) || null; },
  };
  context.SA = context.SA || {};
  context.SA.Config = api;
  return api;
}

module.exports = { install };
