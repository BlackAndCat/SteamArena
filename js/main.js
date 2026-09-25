// 入口与页面切换：两个主页面 车间（garage）/ 出战（arena），外加战斗（battle）
window.SA = window.SA || {};

SA.current = null;
// 标记当前页面并刷新顶栏；页面自己负责渲染
SA.go = (name) => {
  SA.current = name;
  SA.Camp.syncLim();
  document.body.dataset.screen = name;
  SA.UI.topbar();
};
// 主导航：车间 / 出战。车间要打完第一场练习赛才开放；quiet：出战页先不弹章节开场（战后结算还要弹窗）
SA.nav = (name, arg, quiet) => {
  document.querySelector('#modal').hidden = true;
  if (name === 'garage' && !SA.Camp.has('garage')) name = 'arena';
  if (name === 'arena') SA.Arena.open(arg, quiet);
  else SA.Editor.open(arg);
};

window.addEventListener('DOMContentLoaded', () => {
  SA.S.load();
  SA.Camp.backfill();
  SA.nav(SA.Camp.has('garage') ? 'garage' : 'arena');
  document.querySelector('#modal').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'modal') SA.UI.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('#modal').hidden) SA.UI.closeModal();
  });
});

// 调试用：控制台输入 SA.reset() 重开存档
SA.reset = () => { SA.S.reset(); SA.nav('garage'); };
