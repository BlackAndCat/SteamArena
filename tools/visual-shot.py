#!/usr/bin/env python3
"""视觉检查截图：用无头 Chrome 按清单批量截图（Opus 的视觉回归 / 移动端检查工具）。

用法：
  python tools/visual-shot.py spec.json            # 按清单截图
清单是 JSON 数组，每项：
  { "name": "garage-375", "url": "http://localhost:5173/", "w": 375, "h": 812, "dpr": 1, "mobile": true,
    "js": "页面加载后执行的脚本（可以 await），返回值会写进结果", "wait": 400,
    "out": "输出 PNG 路径", "full": false, "clip": "CSS 选择器（只截这个元素）" }
结果（每项的 js 返回值、页面宽度、是否横向滚动）打印成 JSON。
依赖：只用 Python 标准库；复用 tools/html5_game_mcp.py 的 CDP 客户端。Chrome 用独立端口和临时配置目录，不影响正在用的浏览器。
"""
import base64
import sys as _sys
_sys.dont_write_bytecode = True   # 不在 tools/ 里留下 __pycache__
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from html5_game_mcp import CDP  # noqa: E402

PORT = 9111   # 避开 Windows 保留端口段（9243–9342 等）和 html5-game MCP 的 9222


def chrome_exe():
    exe = shutil.which("chrome") or shutil.which("google-chrome")
    for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"):
        if not exe and os.path.exists(p):
            exe = p
    if not exe:
        raise SystemExit("找不到 Chrome")
    return exe


def targets():
    with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % PORT, timeout=3) as r:
        return json.load(r)


def launch():
    profile = tempfile.mkdtemp(prefix="visual-shot-")
    proc = subprocess.Popen([chrome_exe(), f"--remote-debugging-port={PORT}", "--remote-allow-origins=*", f"--user-data-dir={profile}",
                             "--no-sandbox", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
                             "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        try:
            page = next(t for t in targets() if t.get("type") == "page")
            c = CDP(page["webSocketDebuggerUrl"])
            c.sock.settimeout(900)   # 画廊这类页面一次要跑很久，默认 8 秒读超时不够
            return proc, c
        except Exception:
            time.sleep(0.1)
    raise SystemExit("Chrome 启动超时")


def evaluate(c, expr):
    r = c.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True, "userGesture": True})
    if "exceptionDetails" in r:
        d = r["exceptionDetails"]
        raise RuntimeError(d.get("exception", {}).get("description") or d.get("text") or "脚本异常")
    return r.get("result", {}).get("value")


def shoot(c, s):
    w, h = int(s.get("w", 1280)), int(s.get("h", 800))
    c.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": s.get("dpr", 1), "mobile": bool(s.get("mobile", w < 768))})
    if s.get("url"):
        c.call("Page.navigate", {"url": s["url"]})
        for _ in range(100):
            time.sleep(0.1)
            try:
                if evaluate(c, "document.readyState") == "complete":
                    break
            except Exception:
                pass
        time.sleep(0.3)
    out = {"name": s.get("name")}
    if s.get("js"):
        out["js"] = evaluate(c, "(async () => { " + s["js"] + " })()")
    time.sleep(s.get("wait", 300) / 1000)
    out["overflowX"] = evaluate(c, "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
    params = {"format": "png"}
    if s.get("clip"):
        box = evaluate(c, "(() => { const r = document.querySelector(%s).getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height]; })()" % json.dumps(s["clip"]))
        params["clip"] = {"x": box[0], "y": box[1], "width": max(1, box[2]), "height": max(1, box[3]), "scale": 1}
        params["captureBeyondViewport"] = True
    elif s.get("full"):
        size = evaluate(c, "[document.documentElement.scrollWidth, document.documentElement.scrollHeight]")
        params["clip"] = {"x": 0, "y": 0, "width": size[0], "height": size[1], "scale": 1}
        params["captureBeyondViewport"] = True
    if s.get("out"):
        data = base64.b64decode(c.call("Page.captureScreenshot", params)["data"])
        os.makedirs(os.path.dirname(os.path.abspath(s["out"])), exist_ok=True)
        with open(s["out"], "wb") as f:
            f.write(data)
        out["out"] = s["out"]
    return out


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    proc, c = launch()
    results = []
    try:
        c.call("Page.enable")
        c.call("Runtime.enable")
        for s in spec:
            try:
                results.append(shoot(c, s))
            except Exception as e:  # 单项失败不影响后面的截图
                results.append({"name": s.get("name"), "error": str(e)})
    finally:
        c.close()
        proc.terminate()
    print(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
