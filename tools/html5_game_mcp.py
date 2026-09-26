
#!/usr/bin/env python3
"""通用 HTML5 游戏调试 MCP。

通过 Chrome DevTools Protocol 提供少量高频操作，依赖仅 Python 标准库。
服务器使用 stdio 交换 JSON-RPC 2.0 消息，便于 Codex/其他 MCP 客户端直接启动。
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request


_chrome = None
_server = None
_profile = None
_tabs = {}
_port = 9222


class CDP:
    """极简、同步的 CDP WebSocket 客户端。"""

    def __init__(self, url):
        p = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port), timeout=8)
        self.buf = b""
        self.seq = 0
        key = base64.b64encode(os.urandom(16)).decode()
        path = p.path or "/"
        self.sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {p.hostname}:{p.port}\r\n"
                           f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
                           f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        head = self._read_until(b"\r\n\r\n")
        if b" 101 " not in head:
            raise RuntimeError("Chrome WebSocket 握手失败")

    def _read_until(self, mark):
        while mark not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("Chrome 连接已关闭")
            self.buf += chunk
        pos = self.buf.index(mark) + len(mark)
        out, self.buf = self.buf[:pos], self.buf[pos:]
        return out

    def _frame(self, payload):
        n = len(payload)
        if n < 126:
            hdr = bytes([0x81, 0x80 | n])
        elif n < 65536:
            hdr = bytes([0x81, 0x80 | 126]) + struct.pack(">H", n)
        else:
            hdr = bytes([0x81, 0x80 | 127]) + struct.pack(">Q", n)
        mask = os.urandom(4)
        return hdr + mask + bytes(v ^ mask[i % 4] for i, v in enumerate(payload))

    def _recv(self):
        def read(size):
            """读取指定字节数；对端关闭时立即报错，避免死循环。"""
            while len(self.buf) < size:
                chunk = self.sock.recv(max(4096, size - len(self.buf)))
                if not chunk:
                    raise RuntimeError("Chrome WebSocket 已关闭")
                self.buf += chunk

        while True:
            read(2)
            a, b = self.buf[0], self.buf[1]
            self.buf = self.buf[2:]
            length = b & 127
            if length == 126:
                read(2)
                length, self.buf = struct.unpack(">H", self.buf[:2])[0], self.buf[2:]
            elif length == 127:
                read(8)
                length, self.buf = struct.unpack(">Q", self.buf[:8])[0], self.buf[8:]
            masked = b & 128
            if masked:
                read(4)
                mask, self.buf = self.buf[:4], self.buf[4:]
            read(length)
            data, self.buf = self.buf[:length], self.buf[length:]
            if masked: data = bytes(v ^ mask[i % 4] for i, v in enumerate(data))
            opcode = a & 15
            if opcode == 8: raise RuntimeError("Chrome WebSocket 已关闭")
            if opcode == 9: self.sock.sendall(self._frame(data))
            elif opcode == 1: return json.loads(data.decode())

    def call(self, method, params=None):
        self.seq += 1
        self.sock.sendall(self._frame(json.dumps({"id": self.seq, "method": method,
                                                   "params": params or {}}).encode()))
        while True:
            msg = self._recv()
            if msg.get("id") == self.seq:
                if "error" in msg: raise RuntimeError(msg["error"].get("message", "CDP 错误"))
                return msg.get("result", {})

    def close(self):
        try: self.sock.close()
        except OSError: pass


def tabs():
    with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % _port, timeout=3) as r:
        return json.load(r)


def tab_info(tab_id):
    for t in tabs():
        if t.get("id") == tab_id: return t
    raise ValueError("找不到标签页: " + str(tab_id))


def cdp(tab_id):
    if tab_id not in _tabs: _tabs[tab_id] = CDP(tab_info(tab_id)["webSocketDebuggerUrl"])
    return _tabs[tab_id]


def evaluate(tab_id, expression):
    r = cdp(tab_id).call("Runtime.evaluate", {"expression": expression, "returnByValue": True,
                                                "awaitPromise": True, "userGesture": True})
    if "exceptionDetails" in r:
        details = r["exceptionDetails"]
        description = details.get("exception", {}).get("description") or details.get("text") or "执行异常"
        raise RuntimeError(description)
    # CDP.call 已经剥掉了 JSON-RPC 外层的 result；Runtime.evaluate
    # 此时直接返回 {type, value, ...}。
    result = r.get("result", {})
    if result.get("subtype") == "error":
        raise RuntimeError(result.get("description", "页面返回错误"))
    return result.get("value")


def start_browser(url=None, headless=True, port=9222):
    global _chrome, _port, _profile
    _port = int(port)
    launched = False
    try: tabs()
    except Exception:
        exe = shutil.which("chrome") or shutil.which("google-chrome")
        if not exe:
            for p in (r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                      r"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"):
                if os.path.exists(p): exe = p; break
        if not exe: raise RuntimeError("找不到 Chrome，请安装 Chrome 或将其加入 PATH")
        # 独立配置目录避免 Chrome 单例把命令转交给用户正在使用的浏览器，
        # 从而丢失远程调试端口或污染用户的浏览记录。
        _profile = tempfile.mkdtemp(prefix="html5-mcp-")
        args = [exe, f"--remote-debugging-port={_port}", "--remote-allow-origins=*",
                f"--user-data-dir={_profile}",
                # 当前受限开发环境里的 Chrome renderer 需要此开关才能接受 CDP；
                # 该进程只用于本机测试，且远程调试端口不应暴露到公网。
                "--no-sandbox",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
                "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion",
                "--no-first-run", "--no-default-browser-check"]
        if headless: args += ["--headless=new", "--disable-gpu"]
        _chrome = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        launched = True
        for _ in range(30):
            try: tabs(); break
            except Exception: time.sleep(.1)
        else: raise RuntimeError("Chrome 启动超时")
    if url:
        if launched:
            # 命令行 URL 在部分 Chrome 版本只会写入目标元数据而不真正导航，
            # 因此启动空白页后显式发 Page.navigate。
            page = next((t for t in tabs() if t.get("type") == "page"), None)
            if not page:
                raise RuntimeError("Chrome 没有可用页面标签")
            cdp(page["id"]).call("Page.navigate", {"url": url})
        else:
            # 已有远程调试实例时，显式新建标签，避免改动用户当前页面。
            current = tabs()
            if not any(t.get("url") == url for t in current):
                endpoint = "http://127.0.0.1:%d/json/new?%s" % (_port, urllib.parse.quote(url, safe="/:?=&%"))
                try:
                    request = urllib.request.Request(endpoint, method="PUT")
                    with urllib.request.urlopen(request, timeout=3) as r:
                        json.load(r)
                except Exception:
                    # 旧版 Chrome 使用 GET，新版通常接受 PUT；两者都兼容。
                    with urllib.request.urlopen(endpoint, timeout=3) as r:
                        json.load(r)
        # 页面脚本通常在 DOM 完成后才可调用；把这段等待放进启动工具，
        # 调用方不必每次再做一次人为 sleep。
        for _ in range(50):
            try:
                page = next((t for t in tabs() if t.get("type") == "page" and t.get("url") == url), None)
                if page:
                    state = evaluate(page["id"], "({ready:document.readyState,href:location.href})")
                    # json/list 可能先报告目标 URL，而文档上下文仍是 about:blank，
                    # 必须同时确认 location.href，避免过早调用游戏全局对象。
                    if state and state.get("ready") == "complete" and state.get("href") == url:
                        break
            except Exception:
                pass
            time.sleep(0.1)
    return {"port": _port, "tabs": tabs()}


def dispatch(name, a):
    if name == "start_browser": return start_browser(a.get("url"), a.get("headless", True), a.get("port", 9222))
    if name == "list_tabs": return tabs()
    tid = a.get("tab_id")
    if name == "navigate": return cdp(tid).call("Page.navigate", {"url": a["url"]})
    if name == "eval": return evaluate(tid, a["expression"])
    if name == "key":
        typ = "keyDown" if a.get("down", True) else "keyUp"
        return cdp(tid).call("Input.dispatchKeyEvent", {"type": typ, "key": a["key"], "code": a.get("code", a["key"])})
    if name == "click":
        c = cdp(tid)
        for typ in ("mousePressed", "mouseReleased"): c.call("Input.dispatchMouseEvent", {"type": typ, "x": a["x"], "y": a["y"], "button": "left", "clickCount": 1})
        return {"ok": True}
    if name == "game_step":
        seconds = max(0, float(a.get("seconds", 0.1)))
        # 游戏若提供高速调试步进，则一次调用完成整段时间，避免逐帧往返。
        script = "(async()=>{if(window.__HTML5_GAME_MCP__&&typeof window.__HTML5_GAME_MCP__.step==='function')return await window.__HTML5_GAME_MCP__.step(%s);if(window.SA&&SA.Battle&&SA.Battle.debug&&typeof SA.Battle.debug.step==='function')return SA.Battle.debug.step(%s);await new Promise(r=>setTimeout(r,%s));return {waited:%s};})()" % (seconds, seconds, int(seconds * 1000), seconds)
        return evaluate(tid, script)
    if name == "game_action":
        action = json.dumps(a.get("action", ""), ensure_ascii=False)
        payload = json.dumps(a.get("payload"), ensure_ascii=False)
        script = "(async()=>{if(!window.__HTML5_GAME_MCP__||typeof window.__HTML5_GAME_MCP__.action!=='function')throw new Error('页面没有注册 window.__HTML5_GAME_MCP__.action');return await window.__HTML5_GAME_MCP__.action(%s,%s);})()" % (action, payload)
        return evaluate(tid, script)
    if name == "game_state":
        expression = a.get("expression", "window.__HTML5_GAME_MCP__&&typeof window.__HTML5_GAME_MCP__.state==='function' ? window.__HTML5_GAME_MCP__.state() : (window.gameState || null)")
        return evaluate(tid, expression)
    if name == "steam_arena_simulate":
        ci, si, repeat = int(a.get("campaign_index", 0)), int(a.get("stage_index", 0)), max(1, int(a.get("repeat", 1)))
        # 使用当前战役关卡作为敌方、STARTER 作为我方，结果保留原始字段。
        js = "(() => { const s=SA.CAMPAIGN[%d].stages[%d]; const e=SA.V.fromAscii(s.name,s.rows,s.sides||[],s.mt||1,s.elite||[],s.subs||[]); const p=SA.V.fromAscii('MCP',SA.STARTER.rows,SA.STARTER.sides||[],1,[],SA.STARTER.subs||[]); const out=[]; for(let i=0;i<%d;i++) out.push(SA.Battle.simulate({p,e,pAim:s.aim,eAim:s.aim,pStyle:s.style,eStyle:s.style,eBoss:s.boss,terrain:s.terrain||'flat'})); return out; })()" % (ci, si, repeat)
        return evaluate(tid, js)
    if name == "start_server":
        global _server
        if _server is None or _server.poll() is not None:
            _server = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), "serve.py")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(30):
                try:
                    with urllib.request.urlopen("http://127.0.0.1:5173/", timeout=0.2):
                        break
                except Exception:
                    time.sleep(0.1)
            else:
                raise RuntimeError("项目静态服务器启动超时")
        return {"started": True, "url": "http://127.0.0.1:5173/"}
    raise ValueError("未知工具: " + name)


TOOLS = [{"name": n, "description": d, "inputSchema": {"type": "object", "properties": p}}
         for n, d, p in [
             ("start_browser", "启动或连接高速测试用 Chrome", {"url": {"type": "string"}, "headless": {"type": "boolean"}, "port": {"type": "integer"}}),
             ("list_tabs", "列出 Chrome 标签页", {}), ("navigate", "导航标签页", {"tab_id": {"type": "string"}, "url": {"type": "string"}}),
             ("eval", "在页面执行 JavaScript", {"tab_id": {"type": "string"}, "expression": {"type": "string"}}),
             ("key", "发送键盘按下或抬起", {"tab_id": {"type": "string"}, "key": {"type": "string"}, "down": {"type": "boolean"}}),
             ("click", "点击页面坐标", {"tab_id": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}}),
             ("game_step", "等待指定秒数让游戏推进", {"tab_id": {"type": "string"}, "seconds": {"type": "number"}}),
             ("game_action", "调用页面注册的通用游戏动作适配器", {"tab_id": {"type": "string"}, "action": {"type": "string"}, "payload": {"type": ["object", "array", "string", "number", "boolean", "null"]}}),
             ("game_state", "读取页面游戏状态", {"tab_id": {"type": "string"}, "expression": {"type": "string"}}),
             ("steam_arena_simulate", "运行蒸汽竞技场战役关卡的无画面对战模拟", {"tab_id": {"type": "string"}, "campaign_index": {"type": "integer"}, "stage_index": {"type": "integer"}, "repeat": {"type": "integer"}}),
             ("start_server", "启动项目 tools/serve.py 本地静态服务器", {})]]


def main():
    _port = 9222
    for line in sys.stdin:
        req = None
        try:
            req = json.loads(line); method = req.get("method")
            if method == "initialize": result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "serverInfo": {"name": "html5-game-mcp", "version": "1.0"}}
            elif method == "tools/list": result = {"tools": TOOLS}
            elif method == "tools/call":
                p = req.get("params", {}); result = {"content": [{"type": "text", "text": json.dumps(dispatch(p["name"], p.get("arguments", {})), ensure_ascii=False)}]}
            elif method == "notifications/initialized": continue
            else: raise ValueError("未知 JSON-RPC 方法: " + str(method))
            print(json.dumps({"jsonrpc": "2.0", "id": req.get("id"), "result": result}, ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({"jsonrpc": "2.0", "id": req.get("id") if isinstance(req, dict) else None, "error": {"code": -32000, "message": str(e)}}, ensure_ascii=False), flush=True)


if __name__ == "__main__": main()
