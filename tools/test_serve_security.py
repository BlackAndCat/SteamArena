"""本地写接口的 HTTP 回归：验证来源限制和正常保存路径。"""

import http.client
import importlib.util
import json
import sys
import tempfile
import threading
import types
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path


class FakeEvolution:
    """记录进化任务调用，避免测试启动实际进程。"""

    def __init__(self, root):
        self.calls = []

    def start(self, request):
        self.calls.append(('start', request))
        return {'ok': True}

    def stop(self):
        self.calls.append(('stop', None))
        return {'ok': True}


class WriteSecurityTests(unittest.TestCase):
    """通过真实回环 HTTP 服务覆盖四个写接口。"""

    @classmethod
    def setUpClass(cls):
        fake_module = types.ModuleType('evolve_service')
        fake_module.EvolutionService = FakeEvolution
        sys.modules['evolve_service'] = fake_module
        spec = importlib.util.spec_from_file_location('test_serve', Path(__file__).with_name('serve.py'))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    @classmethod
    def tearDownClass(cls):
        sys.modules.pop('evolve_service', None)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / 'text' / 'demo').mkdir(parents=True)
        (root / 'js').mkdir()
        self.text_file = root / 'text' / 'demo' / 'zh.json'
        self.stage_file = root / 'js' / 'stage-cars.js'
        self.text_file.write_text('原文本', encoding='utf-8')
        self.stage_file.write_text('原关卡', encoding='utf-8')
        self.module.ROOT = str(root)
        self.module.TEXT_ROOT = str(root / 'text')
        self.module.STAGE_CARS_FILE = str(self.stage_file)
        self.module.EVOLUTION = FakeEvolution(str(root))

        module = self.module

        class TestHandler(module.NoCache):
            """仅在测试中模拟非回环客户端地址。"""

            def do_POST(self):
                if self.headers.get('X-Test-Foreign-Client') == '1':
                    self.client_address = ('192.0.2.1', self.client_address[1])
                super().do_POST()

            def log_message(self, format, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), TestHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def post(self, endpoint, payload, headers=None):
        """显式设置 Host，避免 HTTP 客户端自动改写测试值。"""
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        body = json.dumps(payload).encode('utf-8')
        headers = dict(headers or {})
        host = headers.pop('Host', f'127.0.0.1:{self.server.server_port}')
        conn.putrequest('POST', endpoint, skip_host=True)
        conn.putheader('Host', host)
        conn.putheader('Content-Type', 'application/json')
        conn.putheader('Content-Length', str(len(body)))
        for name, value in headers.items():
            conn.putheader(name, value)
        conn.endheaders(body)
        response = conn.getresponse()
        status = response.status
        response.read()
        conn.close()
        return status

    def payloads(self):
        return {
            '/__text/save': {'game': 'demo', 'locale': 'zh', 'values': {'title': '新文本'}},
            '/__stage-cars/save': {'version': 1, 'campaignLayout': 2, 'records': {}},
            '/__evolve/run': {'candidate': 'demo'},
            '/__evolve/stop': {'reason': 'test'},
        }

    def test_rejects_foreign_host_origin_and_client_before_side_effects(self):
        """逐个入口拒绝伪 Host、跨源 Origin 和非回环客户端。"""
        port = self.server.server_port
        rejected_headers = [
            {'Host': f'attacker.example:{port}'},
            {'Origin': 'null'},
            {'Origin': f'http://127.0.0.1:{port + 1}'},
            {'Origin': f'https://127.0.0.1:{port}'},
            {'Origin': f'http://attacker.example:{port}'},
            {'X-Test-Foreign-Client': '1'},
        ]
        for endpoint, payload in self.payloads().items():
            for headers in rejected_headers:
                with self.subTest(endpoint=endpoint, headers=headers):
                    self.assertEqual(self.post(endpoint, payload, headers), 403)
                    self.assertEqual(self.text_file.read_text(encoding='utf-8'), '原文本')
                    self.assertEqual(self.stage_file.read_text(encoding='utf-8'), '原关卡')
                    self.assertEqual(self.module.EVOLUTION.calls, [])

    def test_same_origin_saves_text_and_stage_cars(self):
        """同源浏览器请求仍可实际保存文本和关卡车。"""
        origin = f'http://127.0.0.1:{self.server.server_port}'
        payloads = self.payloads()
        self.assertEqual(self.post('/__text/save', payloads['/__text/save'], {'Origin': origin}), 200)
        self.assertEqual(json.loads(self.text_file.read_text(encoding='utf-8'))['values']['title'], '新文本')
        self.assertEqual(self.post('/__stage-cars/save', payloads['/__stage-cars/save'], {'Origin': origin}), 200)
        self.assertIn('SA.STAGE_CARS =', self.stage_file.read_text(encoding='utf-8'))

    def test_local_cli_without_origin_can_control_evolution(self):
        """无 Origin 的本机脚本仍可启动、停止任务。"""
        self.assertEqual(self.post('/__evolve/run', {'candidate': 'demo'}), 202)
        self.assertEqual(self.post('/__evolve/stop', {'reason': 'test'}), 202)
        self.assertEqual([call[0] for call in self.module.EVOLUTION.calls], ['start', 'stop'])


if __name__ == '__main__':
    unittest.main()
