"""模块工作台保存接口的隔离测试，不写真实模块表。"""
import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve


class ModuleEditorSaveTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='module-editor-test-')
        self.path = os.path.join(self.folder.name, 'modules.js')
        with open(serve.MODULES_FILE, 'rb') as source, open(self.path, 'wb') as target:
            target.write(source.read())
        self.original_path = serve.MODULES_FILE
        serve.MODULES_FILE = self.path
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), serve.NoCache)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        serve.MODULES_FILE = self.original_path
        self.folder.cleanup()

    def request(self, payload, origin=True):
        port = self.server.server_port
        host = f'127.0.0.1:{port}'
        headers = {'Host': host, 'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = f'http://{host}'
        connection = http.client.HTTPConnection('127.0.0.1', port)
        connection.request('POST', '/__modules/save', json.dumps(payload).encode(), headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def read(self):
        with open(self.path, 'r', encoding='utf-8') as stream:
            return stream.read()

    def test_sequential_save_preserves_other_module_and_original_source(self):
        original = self.read()
        self.assertEqual(200, self.request({'id': 'track', 'overrides': {'name': '测试履带', 'hp': 220, 'susp': {'up': 6}}})[0])
        self.assertEqual(200, self.request({'id': 'boiler', 'overrides': {'desc': '测试锅炉'}})[0])
        records, before, after = serve._module_json_block(self.read(), '// MODULE_EDITOR_OVERRIDES_START',
                                                            '// MODULE_EDITOR_OVERRIDES_END', 'SA.MODULE_OVERRIDES')
        self.assertEqual('测试履带', records['track']['name'])
        self.assertEqual({'desc': '测试锅炉'}, records['boiler'])
        _, original_before, original_after = serve._module_json_block(original, '// MODULE_EDITOR_OVERRIDES_START',
                                                                       '// MODULE_EDITOR_OVERRIDES_END', 'SA.MODULE_OVERRIDES')
        self.assertEqual((original_before, original_after), (before, after))
        self.assertEqual(200, self.request({'id': 'track', 'overrides': {}})[0])
        records, _, _ = serve._module_json_block(self.read(), '// MODULE_EDITOR_OVERRIDES_START',
                                                  '// MODULE_EDITOR_OVERRIDES_END', 'SA.MODULE_OVERRIDES')
        self.assertNotIn('track', records)
        self.assertIn('boiler', records)

    def test_text_and_field_constraints(self):
        original = self.read()
        self.assertEqual(200, self.request({'id': 'track', 'overrides': {'name': '模块1', 'desc': 'HP 200\n比例 1/2'}})[0])
        saved = self.read()
        self.assertNotEqual(original, saved)
        invalid = [
            {'h': 13}, {'hp': 0}, {'reload': 0}, {'repairRate': 0}, {'maxMt': 0},
            {'balance': {'toleranceByMt': [0.5]}}, {'mount': ['unknown']},
            {'cat': 'invalid'}, {'lowAlt': 'not_a_module'}, {'name': 'a\nline'},
            {'minMt': 5, 'maxMt': 4}, {'kick': {'ram': 2}},
        ]
        for overrides in invalid:
            with self.subTest(overrides=overrides):
                self.assertEqual(400, self.request({'id': 'track', 'overrides': overrides})[0])
                self.assertEqual(saved, self.read())
        self.assertEqual(400, self.request({'id': 'biped', 'overrides': {'kick': 12}})[0])
        self.assertEqual(saved, self.read())

    def test_invalid_input_leaves_file_untouched(self):
        original = self.read()
        bad = [
            {'id': 'not_a_module', 'overrides': {'hp': 10}},
            {'id': 'track', 'overrides': {'unknown': 1}},
            {'id': 'track', 'overrides': {'vis': 'other'}},
            {'id': 'track', 'overrides': {'hp': float('nan')}},
            {'id': 'track', 'overrides': {'hp': float('inf')}},
            {'id': 'track', 'overrides': {'w': 0}},
            {'id': 'track', 'overrides': {'hp': '200'}},
            {'id': 'track', 'overrides': {'__proto__': {'hp': 1}}},
            {'id': 'track', 'overrides': {'susp': {'pts': [1, 2]}}},
        ]
        for payload in bad:
            with self.subTest(payload=payload):
                self.assertEqual(400, self.request(payload)[0])
                self.assertEqual(original, self.read())
        self.assertEqual(403, self._foreign_origin_status())
        self.assertEqual(original, self.read())

    def _foreign_origin_status(self):
        port = self.server.server_port
        connection = http.client.HTTPConnection('127.0.0.1', port)
        connection.request('POST', '/__modules/save', b'{}', {'Host': f'127.0.0.1:{port}', 'Origin': 'http://evil.invalid'})
        response = connection.getresponse()
        status = response.status
        response.read()
        connection.close()
        return status


if __name__ == '__main__':
    unittest.main()
