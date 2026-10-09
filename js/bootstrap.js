// 首页加载引导：配置并行请求、脚本预下载；配置就绪后仍按原经典脚本顺序执行。
(async function () {
  // file 页面由 config.js 迁往本机 HTTP 服务，当前页面不再继续初始化。
  if (!window.SA?.Config) return;
  const entries = [...document.querySelectorAll('script[type="application/x-sa-script"][src]')];
  try {
    // 配置是后续执行的前置条件，先发起请求，避免脚本预下载抢占初始连接。
    const configuration = SA.Config.preload(['rules', 'ui', 'text', 'modules', 'content', 'stage-cars', 'routes']);
    // 使用浏览器原生脚本缓存，不执行预下载内容，也不复制或打包配置数据。
    for (const entry of entries) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = entry.src;
      document.head.append(link);
    }
    await configuration;
    if (document.title === '') document.title = SA.Config.text('page_title');
    // 每个脚本执行结束后才接续下一个；保留全局经典脚本作用域和既有依赖顺序。
    for (const entry of entries) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = false;
        script.src = entry.src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('脚本加载失败：' + entry.getAttribute('src')));
        document.head.append(script);
      });
    }
  } catch (error) {
    SA.Config.fail(error.message);
  }
})();
