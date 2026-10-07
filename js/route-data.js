// 正式路线与燃煤参数同步读取 JSON；保留 SA.ROUTES 供既有路线图和界面读取。
window.SA = window.SA || {};
SA.ROUTES = Object.fromEntries(SA.Config.get('routes').routes.map(def => [def.id, JSON.parse(JSON.stringify(def))]));
