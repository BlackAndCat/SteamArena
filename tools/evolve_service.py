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
        self.started_at = self.finished_at = self.estimate_at = None
        self.remaining_ms = None

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
        """按服务器时间更新已用时，每五秒用累计完成速度重估剩余时间；刷新页面不会重置。"""
        with self.lock:
            result = dict(self.job)
            if self.started_at is None:
                return result
            now = time.monotonic()
            elapsed = max(0, round(((self.finished_at if self.finished_at is not None else now) - self.started_at) * 1000))
            progress = self.job.get('progress', {})
            completed, total = progress.get('completedSteps', 0), progress.get('totalSteps', 0)
            running = self.job['status'] == 'running'
            # 先积累至少三秒和一个完成步骤，避免启动耗时或零样本产生无穷大估计。
            if running and completed > 0 and total > 0 and elapsed >= 3000:
                if self.estimate_at is None or now - self.estimate_at >= 5:
                    self.remaining_ms = round(elapsed / completed * max(0, total - completed))
                    self.estimate_at = now
            result['elapsedMs'] = elapsed
            result['remainingMs'] = self.remaining_ms if running else (0 if self.job['status'] == 'complete' else None)
            return result

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
            self.started_at = time.monotonic()
            self.finished_at = self.estimate_at = self.remaining_ms = None
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
                        self.finished_at = time.monotonic()
                    elif event.get('type') == 'error':
                        self.job.update(status='failed', error=event['error'])
                        self.finished_at = time.monotonic()
                    else:
                        self.job['progress'] = event
            code = process.wait()
            with self.lock:
                if self.job['status'] == 'running':
                    self.job.update(status='failed', error=f'生成进程提前退出（{code}），旧报告已保留')
                    self.finished_at = time.monotonic()
        except (OSError, ValueError) as error:
            with self.lock:
                if self.job['status'] == 'running':
                    self.job.update(status='failed', error=str(error))
                    self.finished_at = time.monotonic()
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
                self.finished_at = time.monotonic()
                self.process.terminate()
            return dict(self.job)
