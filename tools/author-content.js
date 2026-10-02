// 作者包只读取当前页面来源的两类设计草稿；不同 file/HTTP 来源须各自导出后导入预检。
window.SAAuthorContent = (() => {
  const STAGE_KEY = 'steam_arena_stage_cars_local_v1';
  const TEXT_KEY = 'sa-text-steam-arena-zh-CN';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (error) { throw new Error(`${key} 不是有效 JSON：${error.message}`); }
  }

  function collect() {
    const stage = read(STAGE_KEY), text = read(TEXT_KEY);
    const records = stage && typeof stage.records === 'object' && !Array.isArray(stage.records) ? { ...stage.records } : {};
    // 旧战役布局的 0:1 是现在的 0:2；保留整条记录中的所有附加字段。
    if ((stage?.campaignLayout || 1) === 1 && Object.hasOwn(records, '0:1')) {
      records['0:2'] = records['0:1'] && { ...records['0:1'], id: '0:2' };
      delete records['0:1'];
    }
    const values = text && typeof text.values === 'object' && !Array.isArray(text.values) ? text.values : {};
    const removedElements = Array.isArray(text?.removedElements) ? text.removedElements : [];
    return {
      version: 1, kind: 'steam-arena-author-bundle',
      source: { url: location.href, exportedAt: new Date().toISOString() },
      stageCars: { version: 1, campaignLayout: 2, present: !!stage, records },
      text: { version: 1, game: 'steam-arena', locale: 'zh-CN', present: !!text, values, removedElements }
    };
  }

  function download() {
    const bundle = collect();
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `steam-arena-author-${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return bundle;
  }

  return { collect, download };
})();
