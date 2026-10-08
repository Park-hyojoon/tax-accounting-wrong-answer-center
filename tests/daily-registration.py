"""Daily registration stages every versioned page, without adding mistake events."""
import importlib.util, json, shutil, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
module_spec = importlib.util.spec_from_file_location('daily_registration', ROOT / 'training-tool.py')
tool = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(tool)

def run():
    with tempfile.TemporaryDirectory(prefix='daily-registration-', dir=ROOT / '또 틀렸다!') as folder:
        target = Path(folder)
        names = set(tool.BUMP_PAGES + tool.SHARED_SCRIPTS + [tool.VERSION_FILE, 'season-catalog.js'])
        names.update('data/' + subject + '.js' for subject in tool.SUBJECTS)
        for name in names:
            dest = target / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, dest)
        tool.ROOT = target
        before_ledger = tool.read(tool.LEDGER)
        before_count = len(tool.problems_of('theory'))
        before_review = tool.read('review.html')
        ident = 'fixture-daily-registration'
        batch = {
            'examRound': 117, 'reportedAt': '2026-10-08', 'registrationKind': 'daily-practice',
            'originals': [{'id': ident, 'subject': 'theory', 'questionNo': '이론-검증',
                           'originalText': '검증 원문', 'originalAnswer': '①', 'type': '등록 검증'}],
            'items': [{'subject': 'theory', 'intakeId': ident,
                       'problem': "{id:'fixture-daily-registration',addedDate:'2026-10-08',registrationKind:'daily-practice',type:'등록 검증',title:'검증',prompt:'질문',choices:['가','나','다','라'],answer:0,explanation:'설명',key:'기준'}"}]
        }
        spec_path = target / 'fixture.json'
        spec_path.write_text(json.dumps(batch, ensure_ascii=False), encoding='utf-8')
        assert tool.cmd_add(spec_path) == 0
        assert len(tool.problems_of('theory')) == before_count + 1
        assert tool.read(tool.LEDGER) == before_ledger
        assert tool.read('review.html') != before_review
        assert (target / '기출 원본 오답/117회 기출 문제 이론 실무 오답 데이터.md').exists()
        assert json.loads(tool.read('intake-index.json'))[-1]['registrationKind'] == 'daily-practice'
    tool.ROOT = ROOT
    print('PASS: isolated daily registration, complete version staging, review refresh, original archive, no mistake event')

if __name__ == '__main__':
    run()
