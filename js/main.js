// 入口与页面切换：两个主页面 车间（garage）/ 出战（arena），外加战斗（battle）
window.SA = window.SA || {};

SA.current = null;
// 标记当前页面并刷新顶栏；页面自己负责渲染
SA.go = (name) => {
  SA.current = name;
  document.body.dataset.screen = name;
  SA.UI.topbar();
};
// 主导航：车间 / 出战
SA.nav = (name, arg) => {
  document.querySelector('#modal').hidden = true;
  if (name === 'arena') SA.Arena.open(arg);
  else SA.Editor.open(arg);
};

window.addEventListener('DOMContentLoaded', () => {
  SA.S.load();
  SA.nav('garage');
  document.querySelector('#modal').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'modal') SA.UI.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('#modal').hidden) SA.UI.closeModal();
  });
});

// 调试用：控制台输入 SA.reset() 重开存档
SA.reset = () => { SA.S.reset(); SA.nav('garage'); };
