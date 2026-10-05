"""在临时配置副本里验证新关登记、空位编号、逐关预算和失败回滚。"""
import copy
import json
import pathlib
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import serve


def packet(record):
    """新版工作台写入时同时声明协议版本与目标关卡。"""
    return {'workbenchVersion': 1, 'target': {'kind': 'stage', 'id': record['id']}, 'record': copy.deepcopy(record)}


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
        original_stages = json.loads(content_file.read_text(encoding='utf-8'))['CAMPAIGN'][1]['stages']
        handler = object.__new__(serve.NoCache)
        record = {'id': '1:5', 'source': 'manual', 'name': '新关', 'cells': [[0, 0, 0, 'cockpit', 1, 0]],
                  'rewardMoney': True, 'victoryRepairFree': False, 'rewardItems': [['biped', 1]]}
        with patch.object(serve, 'CONTENT_FILE', str(content_file)), patch.object(serve, 'STAGE_CARS_FILE', str(cars_file)), \
                patch.object(serve, 'STAGE_RULES_FILE', str(rules_file)):
            initial = snapshot()
            for invalid in ({'record': copy.deepcopy(record)},
                            {**packet(record), 'target': {'kind': 'stage', 'id': '1:4'}}):
                try:
                    handler._create_stage_car(invalid)
                    raise AssertionError('旧协议或错误目标未被拒绝')
                except ValueError as error:
                    assert '旧版工作台已停用' in str(error) and snapshot() == initial
            result = handler._create_stage_car(packet(record))
            content = json.loads(content_file.read_text(encoding='utf-8'))
            cars = json.loads(cars_file.read_text(encoding='utf-8'))
            assert content['CAMPAIGN'][1]['stages'][:5] == original_stages[:5]
            assert content['CAMPAIGN'][1]['stages'][5] == {'stageRef': '1:5'}
            assert cars['records']['1:5'] == record and cars['targets'].count('1:5') == 1
            assert all(cars['records'][key] == value for key, value in old['records'].items())
            # 真实独角兽预演已有 £830 规则，新增奖励仅登记关卡，不覆盖预算或重写文件。
            rules = json.loads(rules_file.read_text(encoding='utf-8'))
            existing = next(row for row in old_rules if (row['chapter'], row['stage']) == (1, 5))
            assert existing['budget'] == 830 and existing['status'] == 'preview'
            assert existing['addMods'] == ['biped', 'pressure_chamber']
            assert result['rule'] == existing and rules == old_rules and rules_file.read_bytes() == initial[2]
            assert sum((row['chapter'], row['stage']) == (1, 5) for row in rules) == 1
            # 登记后的普通保存可以再修改奖励，预算文件仍按原始字节保留。
            changed = {**record, 'rewardItems': [['biped', 2], ['pressure_chamber', 1]]}
            handler._save_stage_cars(packet(changed))
            assert json.loads(cars_file.read_text(encoding='utf-8'))['records']['1:5']['rewardItems'] == changed['rewardItems']
            assert rules_file.read_bytes() == initial[2]
            before = snapshot()
            try:
                handler._create_stage_car(packet(record))
                raise AssertionError('重复编号未被拒绝')
            except ValueError:
                assert snapshot() == before
            # 已有车记录但尚未登记正式关时，也必须拒绝覆盖该车。
            protected = json.loads(cars_file.read_text(encoding='utf-8'))
            protected['records']['1:6'] = {**record, 'id': '1:6'}
            cars_file.write_text(json.dumps(protected, ensure_ascii=False), encoding='utf-8')
            protected_bytes = snapshot()
            try:
                handler._create_stage_car(packet({**record, 'id': '1:6'}))
                raise AssertionError('已有车记录未被拒绝')
            except ValueError as error:
                assert '已有记录' in str(error) and snapshot() == protected_bytes
            cars_file.write_bytes(before[1])
            try:
                handler._create_stage_car(packet({**record, 'id': '1:7'}))
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
                    handler._create_stage_car(packet({**record, 'id': '1:6'}))
                    raise AssertionError('第二份文件失败未被报告')
                except OSError:
                    assert snapshot() == before
            # 无预存预算的旧路径：用确定的前关 £700 验证下一关 ×1.2 为 £840。
            content_file.write_bytes(initial[0])
            cars_file.write_bytes(initial[1])
            missing_rules = [copy.deepcopy(row) for row in old_rules if (row['chapter'], row['stage']) not in ((1, 5), (1, 6))]
            previous = next(row for row in missing_rules if (row['chapter'], row['stage']) == (1, 4))
            previous['budget'] = 700
            serve._write_rules(str(rules_file), missing_rules)
            result = handler._create_stage_car(packet(record))
            rules = json.loads(rules_file.read_text(encoding='utf-8'))
            expected = {'chapter': 1, 'stage': 5, 'name': '新关', 'budget': 840, 'status': 'draft', 'addMods': []}
            assert result['rule'] == expected
            assert rules == sorted([*missing_rules, expected], key=lambda row: (row['chapter'], row['stage']))
            before = snapshot()
            # 缺预算时第二份文件失败和第三份预算写失败，均恢复完整事务字节。
            with patch.object(serve, '_write_json', fail_second):
                try:
                    handler._create_stage_car(packet({**record, 'id': '1:6'}))
                    raise AssertionError('缺预算时第二份文件失败未被报告')
                except OSError:
                    assert snapshot() == before
            with patch.object(serve, '_write_rules', lambda path, rows: (_ for _ in ()).throw(OSError('模拟预算表写入失败'))):
                try:
                    handler._create_stage_car(packet({**record, 'id': '1:6'}))
                    raise AssertionError('预算表失败未被报告')
                except OSError:
                    assert snapshot() == before
    print('已有 £830 规则原字节保护、奖励创建及再保存、缺预算生成、重复／越界保护与事务回滚：通过')


if __name__ == '__main__':
    check()
