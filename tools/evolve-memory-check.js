// 进化页记忆回归：执行页面真实恢复逻辑；不启动战斗、GPU 或生成任务。
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, 'evolve-report.js'), 'utf8');
const memoryCode = source.slice(source.indexOf('  // 页面记忆仅保存选择'), source.indexOf('  // ---------- 规则指纹'));
const scopeCode = source.slice(source.indexOf('  function scopeInfo()'), source.indexOf('  // 剩余时间'));
const initCode = source.slice(source.indexOf('  async function initGeneration()'), source.indexOf('  currentFingerprint().then'));
const listCode = source.slice(source.indexOf('  async function refreshList(keep)'), source.indexOf("  $('#src').onchange"));
const pollCode = source.slice(source.indexOf('  function duration(ms)'), source.indexOf("  $('#generate').onclick"));
const catalog = { chapters: [
  { chapter: 0, name: '序章', stages: [{ stage: 0, name: '零关', hasVehicle: true, maxAfter: 2, budget: 830, modules: [] }] },
  { chapter: 2, name: '第二章', stages: [{ stage: 3, name: '第四关', hasVehicle: true, maxAfter: 5, budget: 830, modules: [] }] },
], defaults: { population: 24, generations: 4, games: 6, workers: 4, seed: 20260929 } };
function field(tagName, value, min = '', max = '') {
  let current = String(value);
  return { tagName, min, max, options: [], parentElement: {},
    get value() { return current; }, set value(v) { current = String(v); },
    get selectedOptions() { return this.options.filter(o => o.value === current); },
    append(...opts) { this.options.push(...opts); if (!this.options.some(o => o.value === current)) current = this.options[0]?.value || ''; },
    replaceChildren(...opts) { this.options = []; current = ''; this.append(...opts); },
    set innerHTML(_) { this.options = []; current = ''; },
    checkValidity() { return current !== '' && Number.isFinite(+current) && (!min || +current >= +min) && (!this.max || +current <= +this.max); },
    addEventListener() {}, textContent: '', disabled: false };
}
async function boot(saved, hash = '') {
  const fields = {};
  for (const id of ['mode', 'chapter', 'stage', 'origin']) fields[`#run-${id}`] = field('SELECT', '');
  fields['#run-mode'].append({ value: 'single' }, { value: 'route-after' });
  for (const [id, value, min, max] of [
    ['after-count', 1, 1, ''], ['population', 24, 4, 96], ['generations', 4, 1, 20],
    ['games', 6, 1, 40], ['workers', 4, 1, 14], ['seed', 20260929, 1, 2147483647],
  ]) fields[`#run-${id}`] = field('INPUT', value, min, max);
  for (const id of ['scope-info', 'generate', 'generation-status', 'stop-generation']) fields[`#${id}`] = field('DIV', '');
  fields['#src'] = field('SELECT', '');
  let stored = saved, polls = 0;
  const loads = [];
  const context = vm.createContext({
    $: id => fields[id], location: { hash },
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    h: (_, attrs, textContent) => ({ ...attrs, value: String(attrs.value), textContent }),
    service: async endpoint => { assert.equal(endpoint, 'config', '恢复选择不能发起 run'); return catalog; },
    clearTimeout() {}, setTimeout() { return 1; },
    pollJob: async () => { polls++; }, chapterShort: ci => String(ci),
    listReports: async () => ['evolve-200.json', 'evolve-100.json'], hasCandidates: async () => false,
    load: async url => { loads.push(url); }, use() {}, banner() {}, HANDOFF_KEY: 'handoff',
  });
  vm.runInContext(`let runCatalog = null, handoff = null; const catalogChapter = chapter => runCatalog.chapters.find(row => row.chapter === chapter); ${memoryCode}\n${scopeCode}\n${initCode}\n${listCode}`, context);
  // 页签初始化先发生，不能把历史参数、网格重写成空值。
  vm.runInContext('rememberPage()', context);
  await vm.runInContext('initGeneration()', context);
  await vm.runInContext('refreshList()', context);
  return { fields, context, loads, polls, saved: () => JSON.parse(stored) };
}
(async () => {
  const base = await boot(null);
  assert.equal(base.fields['#run-population'].value, '24');
  assert.equal(base.fields['#run-stage'].value, 'all');
  assert.deepEqual(base.loads, ['out/evolve-200.json']);
  assert.equal(base.polls, 1);
  const history = { version: 1, source: 'out/evolve-100.json', chapter: '2', grid: '2,3', hash: '#selftest',
    run: { chapter: '2', stage: '3', mode: 'route-after', origin: '2,3', 'after-count': '4', population: '48', generations: '5', games: '12', workers: '14', seed: '20261004' } };
  const restored = await boot(JSON.stringify(history));
  for (const [id, value] of Object.entries(history.run)) assert.equal(restored.fields[`#run-${id}`].value, value);
  assert.equal(restored.context.location.hash, '#selftest');
  assert.equal(restored.saved().grid, '2,3');
  assert.deepEqual(restored.loads, ['out/evolve-100.json']);
  const explicit = await boot(JSON.stringify(history), '#picks');
  assert.equal(explicit.context.location.hash, '#picks');
  const zero = await boot(JSON.stringify({ version: 1, run: { chapter: 0, stage: 0, origin: '0,0' } }));
  assert.equal(zero.fields['#run-stage'].value, '0');
  assert.equal(zero.fields['#run-origin'].value, '0,0');
  const invalid = await boot(JSON.stringify({ version: 1, source: 'out/evolve-999.json', run: { chapter: '999', stage: '999', mode: 'invalid', origin: '9,9', workers: '15', population: '-1', games: '1.5', seed: '' } }));
  assert.equal(invalid.fields['#run-chapter'].value, '0');
  assert.equal(invalid.fields['#run-stage'].value, 'all');
  assert.equal(invalid.fields['#run-mode'].value, 'single');
  assert.equal(invalid.fields['#run-workers'].value, '4');
  assert.equal(invalid.fields['#run-games'].value, '6');
  assert.deepEqual(invalid.loads, ['out/evolve-200.json']);
  const oversized = await boot(JSON.stringify({ version: 1, run: { mode: 'route-after', origin: '0,0', 'after-count': '3' } }));
  assert.equal(oversized.fields['#run-after-count'].value, '1');
  for (const corrupted of ['{', '[]', JSON.stringify({ version: 99 })]) {
    const fallback = await boot(corrupted);
    assert.equal(fallback.fields['#run-workers'].value, '4');
  }
  // 报告变更后的有效筛选写回；服务器报告与独立的工作台交接不混用。
  vm.runInContext("st.rawReport = {}; st.source = 'out/evolve-100.json'; st.chapter = '0'; st.grid = '0,0'; rememberPage()", restored.context);
  assert.equal(restored.saved().chapter, '0');
  assert.equal(restored.saved().grid, '0,0');
  // 初始看到已完成任务不能盖过历史报告，新任务完成则仍展示新结果。
  vm.runInContext(`let pollTimer = null, finishedJob = null; ${pollCode}`, restored.context);
  let job = { id: 'old', status: 'complete', result: { file: 'out/evolve-200.json', stages: 1, candidates: 24 } };
  restored.context.service = async endpoint => { assert.equal(endpoint, 'job'); return job; };
  const loadsBefore = restored.loads.length;
  await vm.runInContext('pollJob(true)', restored.context);
  assert.equal(restored.loads.length, loadsBefore, '刷新不能覆盖手选的旧报告');
  await vm.runInContext('pollJob()', restored.context);
  assert.equal(restored.loads.length, loadsBefore, '同一完成任务不能重复覆盖');
  job = { ...job, id: 'new' };
  await vm.runInContext('pollJob()', restored.context);
  assert.equal(restored.loads.at(-1), 'out/evolve-200.json', '新任务完成仍应显示新报告');
  vm.runInContext('st.source = null; rememberPage()', restored.context);
  assert.equal(restored.saved().source, null, '本地导入不能伪装成可恢复的旧服务器报告');
  console.log('进化页记忆回归通过：历史与默认、动态关卡、零索引、越界与损坏存储、报告来源、锚点优先及无自动生成。');
})().catch(error => { console.error(error); process.exitCode = 1; });
