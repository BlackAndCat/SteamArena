"""路线保存业务回归：全部正式路径替换为临时目录，不写用户配置。"""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


class RouteConfigSaveTests(unittest.TestCase):
    """直接检查通用保存分支的原子写与拒绝语义；HTTP 安全限制由既有测试覆盖。"""

    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('route_save_serve', Path(__file__).with_name('serve.py'))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.module.CONFIG_ROOT = str(self.root)
        self.module.STAGE_CARS_FILE = str(self.root / 'stage-cars.json')
        self.module.MODULES_FILE = str(self.root / 'modules.json')
        (self.root / 'stage-cars.json').write_text(json.dumps({'records': {'0:0': {'cells': [[0, 0, 0, 'cockpit', 1]]}}}), encoding='utf-8')
        (self.root / 'modules.json').write_text(json.dumps({'MODULES': {'water': {}}}), encoding='utf-8')
        self.config = {'version': 1, 'fuel': {'capacityPerKw': 0.4, 'kgPerKj': 0.0015, 'idleKw': 1}, 'routes': [{
            'id': 'r1', 'name': '测试', 'len': 1000, 'hills': [], 'mud': [[10, 20]],
            'props': [{'kind': 'ruinDoor', 'x': 700, 'w': 20, 'h': 30, 'hp': 40}],
            'pickups': [{'kind': 'coal', 'x': 100, 'amount': 0.15}, {'kind': 'relic', 'x': 710, 'gate': 700, 'module': 'water'}],
            'encounters': [{'name': '测试车', 'at': 300, 'guard': 400, 'leash': 500, 'car': '0:0'}],
            'end': {'x': 900, 'bonus': 3}, 'unknown': {'keep': True}}]}
        self.path = self.root / 'routes.json'
        self.path.write_text(json.dumps(self.config), encoding='utf-8')
        self.original = self.path.read_bytes()
        self.handler = self.module.NoCache.__new__(self.module.NoCache)

    def save(self, value, name='routes'):
        return self.handler._save_config({'name': name, 'data': value})

    def reject(self, mutate):
        value = copy.deepcopy(self.config)
        mutate(value)
        with self.assertRaises(ValueError): self.save(value)
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(list(self.root.glob('.publish-*')), [])

    def test_valid_atomic_save_preserves_unknown(self):
        self.config['fuel']['idleKw'] = 2
        self.config['routes'][0]['encounters'][0]['charge'] = True
        result = self.save(self.config)
        self.assertEqual(result['file'], 'config/routes.json')
        self.assertEqual(json.loads(self.path.read_text(encoding='utf-8')), self.config)
        self.assertEqual(list(self.root.glob('.publish-*')), [])

    def test_bad_fuel_and_nonfinite(self):
        for value in [0, -1, True, float('nan'), float('inf')]:
            with self.subTest(value=value): self.reject(lambda data: data['fuel'].update(idleKw=value))
        self.reject(lambda data: data['routes'][0]['unknown'].update(value=float('nan')))

    def test_ids_coordinates_and_order(self):
        self.reject(lambda data: data.update(routes=[]))
        self.reject(lambda data: data['routes'][0].update(len=True))
        self.reject(lambda data: data['routes'].append(copy.deepcopy(data['routes'][0])))
        self.reject(lambda data: data['routes'][0]['end'].update(x=1001))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(guard=200))
        self.reject(lambda data: data['routes'][0]['encounters'].append(copy.deepcopy(data['routes'][0]['encounters'][0])))
        self.reject(lambda data: data['routes'][0].update(mud=[[20, 10]]))

    def test_missing_references_and_invalid_pickups(self):
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(car='9:9'))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(vehicle={}))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(vehicle=None))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(style='missing'))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(charge=1))
        self.reject(lambda data: data['routes'][0]['encounters'][0].update(charge='true'))
        self.reject(lambda data: data['routes'][0]['pickups'][0].update(amount=1.1))
        self.reject(lambda data: data['routes'][0]['pickups'][1].update(module='missing'))
        self.reject(lambda data: data['routes'][0]['pickups'][0].update(module='water'))
        self.reject(lambda data: data['routes'][0]['pickups'][1].update(gate=701))

    def test_other_config_semantics_unchanged(self):
        path = self.root / 'other.json'; path.write_text('{}', encoding='utf-8')
        self.save({'free': '原通用配置'}, 'other')
        self.assertEqual(json.loads(path.read_text(encoding='utf-8')), {'free': '原通用配置'})


if __name__ == '__main__':
    unittest.main()
