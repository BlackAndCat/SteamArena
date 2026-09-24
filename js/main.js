// 入口与屏幕切换
window.SA = window.SA || {};

SA.current = null;
SA.go = (name) => {
  SA.current = name;
  document.body.dataset.screen = name;
  if (name === 'workshop') SA.UI.workshop();
  SA.UI.topbar();
};

window.addEventListener('DOMContentLoaded', () => {
  SA.S.load();
  SA.go('workshop');
  // 工坊预览里的炉火闪烁
  const tick = (now) => {
    if (SA.current === 'workshop' && SA.UI.benchCanvas && SA.UI.benchCanvas._draw) SA.UI.benchCanvas._draw(now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.querySelector('#modal').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'modal') SA.UI.closeModal();
  });
});

// 调试用：控制台输入 SA.reset() 重开存档
SA.reset = () => { SA.S.reset(); SA.go('workshop'); };
