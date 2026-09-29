"""进度计时回归：模拟时钟与进程事件，验证估时周期、刷新、结束和停止；不启动真实生成。"""
import io
import json
import unittest
from unittest.mock import Mock, patch
from evolve_service import EvolutionService


class ProgressCheck(unittest.TestCase):
    def setUp(self):
        self.service = EvolutionService('.')
        self.process = Mock()
        self.process.poll.return_value = 0
        self.process.wait.return_value = 0
        with patch.object(self.service, '_command', return_value=['node']), patch('evolve_service.subprocess.Popen', return_value=self.process), patch('evolve_service.threading.Thread'), patch('evolve_service.time.monotonic', return_value=100):
            self.service.start({'scope': {'chapter': 0}})

    def snapshot(self, now):
        with patch('evolve_service.time.monotonic', return_value=now):
            return self.service.snapshot()

    def test_periodic_estimate_and_refresh(self):
        self.assertIsNone(self.snapshot(102)['remainingMs'])
        self.service.job['progress'] = {'completedSteps': 4, 'totalSteps': 20}
        self.assertIsNone(self.snapshot(102)['remainingMs'])
        self.assertEqual(self.snapshot(104)['remainingMs'], 16000)
        self.service.job['progress']['completedSteps'] = 8
        self.assertEqual(self.snapshot(108)['remainingMs'], 16000, '五秒内不反复跳动估计')
        self.assertEqual(self.snapshot(109)['remainingMs'], 13500)
        self.assertEqual(self.snapshot(109)['remainingMs'], 13500, '刷新页面不重新计时')
        self.assertEqual(self.snapshot(114)['remainingMs'], 21000, '无新完成步骤时也应反映耗时增长')

    def test_cancel_freezes_elapsed(self):
        self.service.job['progress'] = {'completedSteps': 4, 'totalSteps': 20}
        self.snapshot(105)
        with patch('evolve_service.time.monotonic', return_value=107):
            self.service.stop()
        result = self.snapshot(120)
        self.assertEqual(result['status'], 'cancelled')
        self.assertEqual(result['elapsedMs'], 7000)
        self.assertIsNone(result['remainingMs'])
        self.assertEqual(result['progress']['completedSteps'], 4)

    def test_complete_and_failure(self):
        for event, status in [({'type': 'complete', 'result': {'completedSteps': 20, 'totalSteps': 20}}, 'complete'), ({'type': 'error', 'error': '检查用失败'}, 'failed')]:
            self.service.job['status'] = 'running'
            # 用可关闭的流模拟进程输出，覆盖实际消息消费与结束计时。
            self.process.stdout = io.StringIO(json.dumps(event) + '\n')
            with patch('evolve_service.time.monotonic', return_value=112):
                self.service._consume(self.process, '{}')
            result = self.snapshot(130)
            self.assertEqual(result['status'], status)
            self.assertEqual(result['elapsedMs'], 12000)
            self.assertEqual(result['remainingMs'], 0 if status == 'complete' else None)


if __name__ == '__main__':
    unittest.main()
