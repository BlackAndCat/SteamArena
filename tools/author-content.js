// 作者包读取工作台当前生效的关卡车和当前来源的文字草稿；不同 file/HTTP 来源须各自导出。
window.SAAuthorContent = (() => {
  const STAGE_KEY = 'steam_arena_stage_cars_local_v1';
  const TEXT_KEY = 'sa-text-steam-arena-zh-CN';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (error) { throw new Error(`${key} 不是有效 JSON：${error.message}`); }
  }

  function collect(currentRecord = null) {
    const stage = read(STAGE_KEY), text = read(TEXT_KEY);
    const effective = window.SA?.STAGE_CARS?.records;
    const records = effective && typeof effective === 'object' && !Array.isArray(effective)
      ? { ...effective } : stage && typeof stage.records === 'object' && !Array.isArray(stage.records) ? { ...stage.records } : {};
    // 旧战役布局的 0:1 是现在的 0:2；保留整条记录中的所有附加字段。
    if (!effective && (stage?.campaignLayout || 1) === 1 && Object.hasOwn(records, '0:1')) {
      records['0:2'] = records['0:1'] && { ...records['0:1'], id: '0:2' };
      delete records['0:1'];
    }
    if (currentRecord) records[currentRecord.id] = currentRecord;
    // 只导出当前工作台明确知道的删除；未知的正式记录不能因缺席而被预检误删。
    const baseline = window.SA?.__STAGE_CARS_FILE_RECORDS;
    const deletedKeys = [...new Set([
      ...Object.keys(records).filter(key => records[key] === null),
      ...(effective && baseline ? Object.keys(baseline).filter(key => baseline[key] && !Object.hasOwn(records, key)) : [])
    ])];
    for (const key of deletedKeys) delete records[key];
    const values = text && typeof text.values === 'object' && !Array.isArray(text.values) ? text.values : {};
    const removedElements = Array.isArray(text?.removedElements) ? text.removedElements : [];
    return {
      version: 1, kind: 'steam-arena-author-bundle',
      source: { url: location.href, exportedAt: new Date().toISOString() },
      stageCars: { version: 1, campaignLayout: 2, present: !!stage || !!effective || !!currentRecord, records, deletedKeys },
      text: { version: 1, game: 'steam-arena', locale: 'zh-CN', present: !!text, values, removedElements }
    };
  }

  function download(currentRecord = null) {
    const bundle = collect(currentRecord);
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
