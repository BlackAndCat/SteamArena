"""在临时配置副本里验证新关登记、空位编号、逐关预算和失败回滚。"""
import copy
import json
import pathlib
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import serve


def check():
    root = pathlib.Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as directory:
        content_file = pathlib.Path(directory, 'content.json')
        cars_file = pathlib.Path(directory, 'stage-cars.json')
        rules_file = pathlib.Path(directory, 'evolve-stage-rules.json')
        content_file.write_bytes((root / 'config/content.json').read_bytes())
        cars_file.write_bytes((root / 'config/stage-cars.json').read_bytes())
        rules_file.write_bytes((root / 'tools/evolve-stage-rules.json').read_bytes())
        old_rules = json.loads(rules_file.read_text(encoding='utf-8'))
        files = (content_file, cars_file, rules_file)
        snapshot = lambda: tuple(path.read_bytes() for path in files)
        old = json.loads(cars_file.read_text(encoding='utf-8'))
        handler = object.__new__(serve.NoCache)
        record = {'id': '1:5', 'source': 'manual', 'name': '新关', 'cells': [[0, 0, 0, 'cockpit', 1, 0]],
                  'rewardMoney': True, 'victoryRepairFree': False}
        with patch.object(serve, 'CONTENT_FILE', str(content_file)), patch.object(serve, 'STAGE_CARS_FILE', str(cars_file)), \
                patch.object(serve, 'STAGE_RULES_FILE', str(rules_file)):
            handler._create_stage_car({'record': copy.deepcopy(record)})
            content = json.loads(content_file.read_text(encoding='utf-8'))
            cars = json.loads(cars_file.read_text(encoding='utf-8'))
            assert [s.get('unfinished', False) for s in content['CAMPAIGN'][1]['stages'][3:6]] == [True, True, False]
            assert content['CAMPAIGN'][1]['stages'][5] == {'stageRef': '1:5'}
            assert cars['records']['1:5'] == record and cars['targets'].count('1:5') == 1
            assert all(cars['records'][key] == value for key, value in old['records'].items())
            # 逐关预算：1:2（£830）到 1:5 隔着两个空位，按 3 步 ×1.2 取整到 £5；表仍是一行一关
            rules = json.loads(rules_file.read_text(encoding='utf-8'))
            assert rules[:-1] == old_rules
            assert rules[-1] == {'chapter': 1, 'stage': 5, 'name': '新关', 'budget': 1435, 'status': 'draft', 'addMods': []}
            assert rules_file.read_text(encoding='utf-8').count('\n') == len(rules) + 2
            before = snapshot()
            try:
                handler._create_stage_car({'record': copy.deepcopy(record)})
                raise AssertionError('重复编号未被拒绝')
            except ValueError:
                assert snapshot() == before
            try:
                handler._create_stage_car({'record': {**record, 'id': '1:7'}})
                raise AssertionError('超出计划未被拒绝')
            except ValueError:
                assert snapshot() == before
            write = serve._write_json

            def fail_second(path, data):
                if path == str(cars_file):
                    raise OSError('模拟第二份文件写入失败')
                write(path, data)

            with patch.object(serve, '_write_json', fail_second):
                try:
                    handler._create_stage_car({'record': {**record, 'id': '1:4'}})
                    raise AssertionError('第二份文件失败未被报告')
                except OSError:
                    assert snapshot() == before
            # 第三份（逐关预算）写失败时，前两份也要恢复
            with patch.object(serve, '_write_rules', lambda path, rows: (_ for _ in ()).throw(OSError('模拟预算表写入失败'))):
                try:
                    handler._create_stage_car({'record': {**record, 'id': '1:4'}})
                    raise AssertionError('预算表失败未被报告')
                except OSError:
                    assert snapshot() == before
    print('新关登记、任意空位、逐关预算、原记录保护及写入失败回滚：通过')


if __name__ == '__main__':
    check()
