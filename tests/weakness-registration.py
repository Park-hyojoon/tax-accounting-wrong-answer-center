"""실제 등록 경로에서 2→3회 경계, 재오답, 새 버전 갱신을 격리 검증한다."""
import importlib.util,json,shutil,tempfile,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('registration',ROOT/'training-tool.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)

def run():
    parent=ROOT/'또 틀렸다!';parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='weakness-test-',dir=parent) as folder:
        root=Path(folder)
        for p in ROOT.iterdir():
            if p.is_file() and p.suffix in ('.html','.js','.json','.css','.py'):shutil.copy2(p,root/p.name)
        shutil.copytree(ROOT/'data',root/'data');t.ROOT=root
        def add(number,parent_id=None):
            ident=f'fixture-weak-{number}';ptype=f'직접 제출 검증 유형 {number}'
            original=dict(id=ident,subject='theory',questionNo='미제공',originalText=f'검증용 원문 {number}',originalAnswer='①',learnerReason=None,type=ptype,topicId='fixture-common-topic',tags=['검증'],recurrenceOf=parent_id)
            problem="{id:'"+ident+"',type:'"+ptype+"',title:'검증',addedDate:'2026-09-24',prompt:'검증 질문',choices:['가','나','다','라'],answer:0,explanation:'검증 해설',key:'검증'}"
            batch=dict(reportedAt='2026-09-24',originals=[original],items=[dict(subject='theory',intakeId=ident,problem=problem)])
            path=root/'fixture.json';path.write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8');assert t.cmd_add(path)==0
            return json.loads((root/'weakness-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
        def fixture_groups(data):return [g for g in data['groups'] if any(str(r['id']).startswith('fixture-weak-') for r in g['refs'])]
        first=add(1);assert not fixture_groups(first)
        second=add(2,'fixture-weak-1');assert not fixture_groups(second)
        version_before=t.read(t.HUB)
        third=add(3,'fixture-weak-2');groups=fixture_groups(third)
        assert {g['kind'] for g in groups}=={'type','same'}
        assert all(g['count']==3 and len(g['refs'])==3 for g in groups)
        assert third['total']==first['total']+2
        assert re.search(r'weakness-data.js\?v=(\d+)',version_before).group(1)!=re.search(r'weakness-data.js\?v=(\d+)',t.read(t.HUB)).group(1)
        assert (root/'기출 원본 오답'/'회차 미지정 오답 데이터.md').exists()
        # 公開 집계에는 원문과 접수 식별자를 내보내지 않는다.
        output=t.read('weakness-data.js');assert 'originalCue' not in output and '검증용 원문' not in output
    t.ROOT=ROOT
    print('PASS: real add pipeline, 2 excluded / 3 included, canonical topic across titles, recurrence chain, refreshed cache version, original evidence preserved')

if __name__=='__main__':run()
