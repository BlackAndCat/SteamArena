"""发行归档接口的隔离回归：只在临时目录写正式数据副本。"""
import hashlib
import http.server
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('serve_publish_test', TOOLS / 'serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class PublishPreflightTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.stage = self.root / 'js/stage-cars.js'
        self.text = self.root / 'text/steam-arena/zh-CN.json'
        self.modules = self.root / 'js/modules.js'
        for destination, original in ((self.stage, ROOT / 'js/stage-cars.js'),
                                      (self.text, ROOT / 'text/steam-arena/zh-CN.json'),
                                      (self.modules, ROOT / 'js/modules.js')):
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, destination)
        files = {'js/stage-cars.js': str(self.stage), 'text/steam-arena/zh-CN.json': str(self.text),
                 'js/modules.js': str(self.modules)}
        self.patchers = [patch.object(serve, 'ROOT', str(self.root)),
                         patch.object(serve, 'STAGE_CARS_FILE', str(self.stage)),
                         patch.object(serve, 'TEXT_ROOT', str(self.text.parent.parent)),
                         patch.object(serve, 'MODULES_FILE', str(self.modules)),
                         patch.object(serve, 'PUBLISH_FILES', files),
                         patch.object(serve, 'PUBLISH_RECEIPT', str(self.root / 'tools/out/publish-preflight.json'))]
        for item in self.patchers:
            item.start()
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), serve.NoCache)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        for item in reversed(self.patchers):
            item.stop()
        self.temp.cleanup()

    def request(self, path, body=None):
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
        request = Request(self.base + path, data=data, headers={'Content-Type': 'application/json'})
        try:
            with urlopen(request) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            with error:
                return error.code, json.load(error)

    def payload(self):
        return {'version': 1, 'sources': [{'kind': 'author-bundle', 'url': 'file:///stage-editor.html',
                                          'exportedAt': '2026-10-02T00:00:00Z'}],
                'stageRecords': {}, 'textValues': {}, 'removedElements': {}}

    def test_selected_merge_and_receipt(self):
        status, before = self.request('/__publish/state')
        self.assertEqual(status, 200)
        first = dict(before['stageCars']['records']['0:0'], name='破铜烂铁号', vehicleName='钉子号')
        body = self.payload()
        body['stageRecords']['0:0'] = first
        body['textValues']['story:test'] = '测试台词'
        body['removedElements']['/test/path'] = True
        status, result = self.request('/__publish/archive', body)
        self.assertEqual(status, 200, result)
        status, after = self.request('/__publish/state')
        self.assertEqual(status, 200)
        self.assertEqual(after['stageCars']['records']['0:0']['name'], '破铜烂铁号')
        self.assertEqual(after['stageCars']['records']['0:0']['vehicleName'], '钉子号')
        self.assertEqual(after['stageCars']['records']['0:1'], before['stageCars']['records']['0:1'])
        self.assertEqual(after['text']['values']['story:test'], '测试台词')
        self.assertIn('/test/path', after['text']['removedElements'])
        receipt = json.loads(Path(serve.PUBLISH_RECEIPT).read_text(encoding='utf-8'))
        for name, path in serve.PUBLISH_FILES.items():
            self.assertEqual(receipt['files'][name], hashlib.sha256(Path(path).read_bytes()).hexdigest())

    def test_invalid_input_does_not_change_files(self):
        old = {name: Path(path).read_bytes() for name, path in serve.PUBLISH_FILES.items()}
        body = self.payload()
        body['stageRecords']['99:99'] = {}
        status, _ = self.request('/__publish/archive', body)
        self.assertEqual(status, 400)
        self.assertEqual(old, {name: Path(path).read_bytes() for name, path in serve.PUBLISH_FILES.items()})
        self.assertFalse(Path(serve.PUBLISH_RECEIPT).exists())

    def test_formal_files_only_can_issue_receipt(self):
        old = {name: Path(path).read_bytes() for name, path in serve.PUBLISH_FILES.items()}
        body = self.payload()
        body['sources'] = [{'kind': 'formal-files', 'url': '正式文件核对',
                            'exportedAt': '2026-10-02T00:00:00Z'}]
        status, result = self.request('/__publish/archive', body)
        self.assertEqual(status, 200, result)
        self.assertEqual(old, {name: Path(path).read_bytes() for name, path in serve.PUBLISH_FILES.items()})
        self.assertTrue(Path(serve.PUBLISH_RECEIPT).exists())

    def test_null_origin_cannot_write(self):
        body = self.payload()
        request = Request(self.base + '/__publish/archive',
                          data=json.dumps(body).encode('utf-8'),
                          headers={'Content-Type': 'application/json', 'Origin': 'null'})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request)
        self.assertEqual(caught.exception.code, 403)
        caught.exception.close()
        self.assertFalse(Path(serve.PUBLISH_RECEIPT).exists())

    def test_failed_second_write_restores_first_and_has_no_receipt(self):
        old_stage = self.stage.read_bytes()
        body = self.payload()
        body['stageRecords']['0:0'] = dict(serve._stage_data()['records']['0:0'], name='新关名')
        body['textValues']['story:test'] = '测试'
        original_write = serve._atomic_bytes

        def fail_text(path, content):
            if path == str(self.text):
                raise OSError('模拟文本落盘失败')
            return original_write(path, content)

        with patch.object(serve, '_atomic_bytes', side_effect=fail_text):
            status, _ = self.request('/__publish/archive', body)
        self.assertEqual(status, 500)
        self.assertEqual(self.stage.read_bytes(), old_stage)
        self.assertFalse(Path(serve.PUBLISH_RECEIPT).exists())


if __name__ == '__main__':
    unittest.main()
