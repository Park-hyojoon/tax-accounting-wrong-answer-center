# -*- coding: utf-8 -*-
"""출제위원 자동 출제 전체 흐름(출제 → 형식 검사 → 독립 재풀이 → 선택 → 등록)을 가짜 Codex로 끝까지 실행한다.
실제 Codex·ChatGPT 사용량을 쓰지 않고, 실제 library 파일도 건드리지 않는다(임시 폴더에 examiner-test를 복사해 사용).
실행: python tests/examiner-auto-e2e.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE = os.environ.get('NODE') or str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
PORT = 8791
BASE = f'http://127.0.0.1:{PORT}'


def empty_catalog(temp):
    # Test-only fixture: published real problems are not the initial test catalogue.
    for filename, variable in [('library.js', 'ExaminerLibrary'), ('journal-library.js', 'ExaminerJournalLibrary')]:
        (temp / 'examiner-test' / filename).write_text(f'window.{variable} = [];\n', encoding='utf-8')


def call(path, body=None, expect_ok=True):
    data = None if body is None else json.dumps(body, ensure_ascii=True).encode()
    request = urllib.request.Request(BASE + path, data=data, headers={'Content-Type': 'application/json'} if data else {})
    try:
        payload = json.loads(urllib.request.urlopen(request, timeout=30).read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        payload = json.loads(error.read().decode('utf-8'))
    if expect_ok and not payload.get('ok'):
        raise AssertionError(f'{path}: {payload}')
    return payload


def browser_stage():
    """실제 브라우저로 화면의 「지금 출제하기」 흐름을 확인한다(가짜 Codex, 임시 폴더, 포트 8791·8792)."""
    temp = Path(tempfile.mkdtemp(prefix='examiner-web-'))
    shutil.copytree(ROOT / 'examiner-test', temp / 'examiner-test', ignore=shutil.ignore_patterns('private', 'artifacts'))
    shutil.copytree(ROOT / 'design', temp / 'design')
    shutil.copytree(ROOT / 'entry', temp / 'entry')
    shutil.copy2(ROOT / 'account-search.js', temp / 'account-search.js')
    shutil.copy2(ROOT / 'training-ui.js', temp / 'training-ui.js')
    shutil.copy2(ROOT / 'tests' / 'fake-codex.py', temp / 'fake-codex.py')
    empty_catalog(temp)
    wrapper = temp / 'fake-codex.cmd'
    wrapper.write_text('@echo off\r\n"' + sys.executable + '" "' + str(temp / 'fake-codex.py') + '" %*\r\n', encoding='ascii')
    env = dict(os.environ, TAX_SYNC_PORT=str(PORT), TAX_SYNC_PROGRAM_DIR=str(temp), TAX_SYNC_LEARNING_DIR=str(temp / 'learning'),
               CODEX_CLI_PATH=str(wrapper), CODEX_HOME=str(temp / 'codex-home'), PYTHONIOENCODING='utf-8')
    helper = subprocess.Popen([sys.executable, str(ROOT / 'sync-helper.py')], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, '-m', 'http.server', '8792', '--bind', '127.0.0.1', '--directory', str(temp)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                if call('/api/status').get('examiner') and urllib.request.urlopen('http://127.0.0.1:8792/examiner-test/index.html', timeout=2).status == 200:
                    break
            except Exception:  # noqa: BLE001
                time.sleep(0.25)
        else:
            raise AssertionError('테스트 서버가 시작되지 않았습니다.')
        completed = subprocess.run([NODE, str(ROOT / 'tests' / 'examiner-auto-browser.cjs')], capture_output=True, text=True, encoding='utf-8')
        print(completed.stdout.strip() or completed.stderr.strip()[-1500:])
        if completed.returncode != 0:
            raise AssertionError('브라우저 흐름 검사가 실패했습니다.')
    finally:
        helper.kill()
        web.kill()
        shutil.rmtree(temp, ignore_errors=True)


def main():
    temp = Path(tempfile.mkdtemp(prefix='examiner-e2e-'))
    shutil.copytree(ROOT / 'examiner-test', temp / 'examiner-test', ignore=shutil.ignore_patterns('private', 'artifacts'))
    shutil.copytree(ROOT / 'entry', temp / 'entry')
    empty_catalog(temp)
    # cmd.exe가 한글 경로를 못 읽을 수 있어, 가짜 Codex를 ASCII 임시 경로로 복사해 쓴다.
    shutil.copy2(ROOT / 'tests' / 'fake-codex.py', temp / 'fake-codex.py')
    wrapper = temp / 'fake-codex.cmd'
    wrapper.write_text(f'@echo off\r\n"{sys.executable}" "{temp / "fake-codex.py"}" %*\r\n', encoding='ascii')
    env = dict(os.environ, TAX_SYNC_PORT=str(PORT), TAX_SYNC_PROGRAM_DIR=str(temp), TAX_SYNC_LEARNING_DIR=str(temp / 'learning'),
               CODEX_CLI_PATH=str(wrapper), CODEX_HOME=str(temp / 'codex-home'), PYTHONIOENCODING='utf-8')
    helper = subprocess.Popen([sys.executable, str(ROOT / 'sync-helper.py')], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                if call('/api/status').get('examiner'):
                    break
            except Exception:  # noqa: BLE001
                time.sleep(0.25)
        else:
            raise AssertionError('도우미가 시작되지 않았습니다.')
        status = call('/api/examiner/status')
        assert status['installed'] and status['loggedIn'], status
        # 범위를 벗어난 요청은 거절한다.
        for bad in [{'counts': {'theory': 0, 'practical': 0, 'voucher': 0}}, {'counts': {'theory': 4, 'practical': 4, 'voucher': 4}}]:
            assert not call('/api/examiner/generate', bad, expect_ok=False)['ok']
        # 허용되지 않은 출처는 거절한다.
        request = urllib.request.Request(BASE + '/api/examiner/generate', data=b'{"counts":{"theory":1}}', headers={'Content-Type': 'application/json', 'Origin': 'https://evil.example'})
        try:
            urllib.request.urlopen(request, timeout=10)
            raise AssertionError('외부 출처가 허용되었습니다.')
        except urllib.error.HTTPError as error:
            assert error.code == 403, error.code
        # 정상 흐름: 1/1/1 요청, 후보는 이론 2·일반전표 2·매입매출 2
        job = call('/api/examiner/generate', {'counts': {'theory': 1, 'practical': 1, 'voucher': 1}, 'styles': ['출제위원 랜덤']})['job']
        assert job['phase'] == 'running'
        assert not call('/api/examiner/generate', {'counts': {'theory': 1, 'practical': 0, 'voucher': 0}}, expect_ok=False)['ok'], '동시 출제가 막혀야 합니다.'
        deadline = time.time() + 60
        while time.time() < deadline:
            job = call('/api/examiner/job')['job']
            if job['phase'] != 'running':
                break
            time.sleep(0.5)
        assert job['phase'] == 'review', job
        candidate = job['candidate']
        assert candidate['finalCounts'] == {'theory': 1, 'journal': 2}, candidate['finalCounts']
        withheld = ' / '.join(candidate['withheld'])
        assert '선택지' in withheld and '세액' in withheld and '분개 행' in withheld, withheld
        assert '독립 재풀이 일치' in candidate['pack']['questions'][0]['review']['verdict']
        assert '[정상]' in candidate['journalBatch']['items'][0]['prompt']
        # 화면의 실제 검사기(engine.js, journal.js)로 결과를 다시 검사한다.
        node_check = temp / 'check.cjs'
        node_check.write_text(f"""
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join({json.dumps(str(temp / 'examiner-test'))});const E=require(path.join(dir,'engine.js')),J=require(path.join(dir,'journal.js'));
const ctx={{window:{{}}}};vm.createContext(ctx);for(const f of ['analysis.js','questions.js','library.js','journal-library.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);
const analysis=JSON.parse(JSON.stringify(ctx.window.ExaminerAnalysis)),lib=JSON.parse(JSON.stringify(ctx.window.ExaminerLibrary)),batches=JSON.parse(JSON.stringify(ctx.window.ExaminerJournalLibrary));
const packs=lib.map(p=>E.validatePack(p,analysis));let items=0;for(const b of batches){{J.validateBank(b.items);items+=b.items.length;}}
console.log(JSON.stringify({{packs:packs.length,theory:packs.reduce((a,p)=>a+p.questions.length,0),journalBatches:batches.length,journalItems:items}}));
""", encoding='utf-8')
        before = json.loads(subprocess.run([NODE, str(node_check)], capture_output=True, text=True, check=True).stdout)
        assert before == {'packs': 0, 'theory': 0, 'journalBatches': 0, 'journalItems': 0}, before
        result = call('/api/examiner/register', {'jobId': job['id']})
        assert result['added'] == {'theory': 1, 'journal': 2}, result
        after = json.loads(subprocess.run([NODE, str(node_check)], capture_output=True, text=True, check=True).stdout)
        assert after == {'packs': 1, 'theory': 1, 'journalBatches': 1, 'journalItems': 2}, after
        assert not call('/api/examiner/register', {'jobId': job['id']}, expect_ok=False)['ok'], '같은 결과를 두 번 추가할 수 없어야 합니다.'
        assert list((temp / 'examiner-test' / 'private' / 'ai-work' / 'backups').glob('*library.js')), '추가 전 백업이 남아야 합니다.'
        # 시범 파일은 바뀌지 않는다.
        for name in ['questions.js', 'journal-bank.js']:
            assert (temp / 'examiner-test' / name).read_bytes() == (ROOT / 'examiner-test' / name).read_bytes(), name
        print('PASS: 거절 규칙, 출제 → 형식 거르기 → 독립 재풀이 거르기 → 선택 → 화면 검사기 통과 → 등록 → 중복 방지 → 백업')
    finally:
        helper.kill()
        shutil.rmtree(temp, ignore_errors=True)


if __name__ == '__main__':
    main()
    if '--no-browser' not in sys.argv:
        browser_stage()
