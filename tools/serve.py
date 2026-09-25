# 本地预览服务器：和 `python -m http.server` 一样，但禁止浏览器缓存。
# 普通 http.server 不发缓存头，浏览器会凭经验缓存 JS，git pull 之后刷新页面可能还在跑旧代码。
# 用法（仓库根目录）：python tools/serve.py        端口默认 5173，可传参数改：python tools/serve.py 8000
import http.server
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_ROOT = os.path.join(ROOT, 'text')
SAFE_PART = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
MAX_BODY = 2 * 1024 * 1024


class NoCache(http.server.SimpleHTTPRequestHandler):
    """静态预览服务器，并为文本管理器提供受限的 JSON 读写接口。"""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text_file(self, game, locale):
        # 文件名只由两个安全片段组成，接口不会接受任意路径，避免路径穿越覆盖项目文件。
        if not SAFE_PART.fullmatch(game or '') or not SAFE_PART.fullmatch(locale or ''):
            return None
        folder = os.path.join(TEXT_ROOT, game)
        path = os.path.abspath(os.path.join(folder, f'{locale}.json'))
        if os.path.commonpath([TEXT_ROOT, path]) != os.path.abspath(TEXT_ROOT):
            return None
        return path

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/__text/load':
            query = parse_qs(parsed.query)
            path = self._text_file(query.get('game', [''])[0], query.get('locale', [''])[0])
            if not path:
                self._json(400, {'error': 'game 或 locale 不合法'})
                return
            if not os.path.isfile(path):
                self._json(404, {'error': '文本文件尚未创建'})
                return
            try:
                with open(path, 'r', encoding='utf-8') as stream:
                    self._json(200, json.load(stream))
            except (OSError, ValueError) as error:
                self._json(500, {'error': f'读取文本文件失败：{error}'})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/__text/save':
            self._json(404, {'error': '接口不存在'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(413, {'error': '请求体过大或为空'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            self._json(400, {'error': '请求不是有效 JSON'})
            return
        if not isinstance(payload, dict):
            self._json(400, {'error': 'JSON 顶层必须是对象'})
            return
        game = payload.get('game')
        locale = payload.get('locale')
        values = payload.get('values')
        path = self._text_file(game, locale)
        if not path:
            self._json(400, {'error': 'game 或 locale 不合法'})
            return
        if payload.get('version', 1) != 1 or not isinstance(values, dict) or len(values) > 10000:
            self._json(400, {'error': '文本数据格式不合法'})
            return
        for key, value in values.items():
            if not isinstance(key, str) or not key or len(key) > 240 or '..' in key or any(ord(ch) < 32 for ch in key):
                self._json(400, {'error': '存在不合法的文本 key'})
                return
            if not isinstance(value, str) or len(value) > 10000:
                self._json(400, {'error': '文本值必须是长度不超过 10000 的字符串'})
                return
        document = {
            'version': 1,
            'game': game,
            'locale': locale,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
            'values': values,
        }
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            # 同目录临时文件 + replace，避免浏览器刷新时读到半个 JSON。
            fd, temporary = tempfile.mkstemp(prefix='.text-', suffix='.json', dir=os.path.dirname(path))
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(document, stream, ensure_ascii=False, indent=2)
                stream.write('\n')
            os.replace(temporary, path)
        except OSError as error:
            try:
                if temporary:
                    os.unlink(temporary)
            except (OSError, UnboundLocalError):
                pass
            self._json(500, {'error': f'写入文本文件失败：{error}'})
            return
        self._json(200, {'ok': True, 'file': os.path.relpath(path, ROOT).replace(os.sep, '/'), 'revision': document['updatedAt']})


if __name__ == '__main__':
    os.chdir(ROOT)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'SteamArena: http://localhost:{port}  (no-cache)')
    http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
