"""进化任务的本机进程管理：同一服务器只运行一个任务，刷新网页可重新读取进度。"""
import json
import os
import shutil
import subprocess
import threading
import time


class EvolutionService:
    def __init__(self, root):
        self.root = root
        self.lock = threading.Lock()
        self.process = None
        self.job = {'status': 'idle'}

    def _command(self):
        node = shutil.which('node')
        if not node:
            raise ValueError('没有找到 Node.js，请安装后重启预览服务')
        return [node, os.path.join(self.root, 'tools', 'evolve-service.js')]

    def _options(self):
        # Windows 后台计算不打开命令窗口；不经 shell 拼接用户提供的参数。
        return {'cwd': self.root, 'encoding': 'utf-8', 'creationflags': subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0}

    def catalog(self):
        try:
            result = subprocess.run(self._command() + ['--catalog'], capture_output=True, timeout=30, **self._options())
        except subprocess.TimeoutExpired as error:
            raise ValueError('读取生成配置超时，请重试') from error
        if result.returncode:
            raise ValueError(result.stderr.strip() or '读取生成配置失败')
        return json.loads(result.stdout)

    def snapshot(self):
        with self.lock:
            return dict(self.job)

    def start(self, request):
        if not isinstance(request, dict):
            raise ValueError('请求必须是 JSON 对象')
        payload = json.dumps(request, ensure_ascii=False)
        with self.lock:
            if self.process is not None:
                return None
            process = subprocess.Popen(self._command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, **self._options())
            self.process = process
            self.job = {'status': 'running', 'id': str(time.time_ns()), 'request': {k: request.get(k) for k in ['scope', 'seed', 'population', 'generations', 'games', 'workers']}}
            threading.Thread(target=self._consume, args=(process, payload), daemon=True).start()
            return dict(self.job)

    def _consume(self, process, payload):
        try:
            process.stdin.write(payload)
            process.stdin.close()
            for line in process.stdout:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                with self.lock:
                    if self.job['status'] != 'running':
                        continue
                    if event.get('type') == 'complete':
                        self.job.update(status='complete', result=event['result'])
                    elif event.get('type') == 'error':
                        self.job.update(status='failed', error=event['error'])
                    else:
                        self.job['progress'] = event
            code = process.wait()
            with self.lock:
                if self.job['status'] == 'running':
                    self.job.update(status='failed', error=f'生成进程提前退出（{code}），旧报告已保留')
        except (OSError, ValueError) as error:
            with self.lock:
                if self.job['status'] == 'running':
                    self.job.update(status='failed', error=str(error))
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait()
            if process.stdout:
                process.stdout.close()
            with self.lock:
                self.process = None

    def stop(self):
        with self.lock:
            if self.process is not None:
                self.job['status'] = 'cancelled'
                self.process.terminate()
            return dict(self.job)
