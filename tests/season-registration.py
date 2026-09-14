"""Structural regression: batch registration, original MD, duplicates, atomic failure."""
import importlib.util,json,re,shutil,tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tool',R/'training-tool.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
def snapshot(root):
    return {str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file() and '또 틀렸다!' not in p.parts and '__pycache__' not in p.parts and p.name!='test-spec.json'}
def run():
    root=R/'또 틀렸다!'/ '검증'/ '새학습'
    root.mkdir(parents=True,exist_ok=True)
    # This dedicated fixture is refreshed from the active, empty season only.
    assert not t.problems_of('theory') and not t.problems_of('practical') and not t.problems_of('voucher')
    for p in R.iterdir():
        if p.is_file() and p.suffix in ('.html','.js','.json','.css','.py','.cmd','.ps1','.bat'):shutil.copy2(p,root/p.name)
    shutil.copytree(R/'data',root/'data',dirs_exist_ok=True)
    templates=json.loads(t.read('templates.json'));items=[];originals=[]
    for subject in t.SUBJECTS:
        p=templates[subject]['problem'];p=re.sub(r",?\s*variantOf\s*:\s*(?:'[^']*'|\d+)", '',p)
        p=re.sub(r"addedDate\s*:\s*'[^']*'","addedDate:'2026-09-14'",p)
        if not t.field(p,'title'):p=p[:-1]+",title:'계산 연습'}"
        originals.append({'id':'fixture-'+subject,'subject':subject,'questionNo':'1','originalText':'검증용 원문 '+subject+'\n|금액|내용|\n|---|---|\n|100|테스트|','originalAnswer':'검증용 답안','learnerReason':None,'type':t.field(p,'type'),'tags':[t.field(p,'type')]})
        items.append({'subject':subject,'intakeId':'fixture-'+subject,'problem':p})
    batch={'examRound':121,'reportedAt':'2026-09-14','originals':originals,'items':items}
    path=root/'test-spec.json';path.write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8')
    t.ROOT=root
    assert t.cmd_add(path)==0
    md=root/'기출 원본 오답'/'121회 기출 문제 이론 실무 오답 데이터.md'
    assert all(o['originalText'] in md.read_text(encoding='utf-8') for o in originals)
    before=snapshot(root)
    try:t.cmd_add(path);raise AssertionError('duplicate accepted')
    except SystemExit:pass
    assert before==snapshot(root),'duplicate changed files'
    batch['originals']=[dict(originals[0],id='fixture-bad',questionNo='2')]
    batch['items']=[dict(items[0],intakeId='fixture-bad',problem=items[0]['problem'].replace('answers:', 'missingAnswers:'))]
    path.write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8')
    try:result=t.cmd_add(path)
    except SystemExit:result=1
    assert result!=0
    assert before==snapshot(root),'failed validation changed files'
    print('PASS: 3 subjects, exact MD preservation, duplicate rejection, atomic rollback')
    print('Browser fixture:',root)
if __name__=='__main__':run()
