# 本地预览服务器：和 `python -m http.server` 一样，但禁止浏览器缓存。
# 普通 http.server 不发缓存头，浏览器会凭经验缓存 JS，git pull 之后刷新页面可能还在跑旧代码。
# 用法（仓库根目录）：python tools/serve.py        端口默认 5173，可传参数改：python tools/serve.py 8000
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'SteamArena: http://localhost:{port}  (no-cache)')
    http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
