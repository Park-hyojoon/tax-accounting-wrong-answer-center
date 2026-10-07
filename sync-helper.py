# -*- coding: utf-8 -*-
"""전산회계 1급 오답 훈련센터 · PC 동기화 도우미

PC에서 오답 훈련센터 화면의 「동기화」 버튼을 누르면 이 프로그램이 대신 git 작업을 처리한다.

- 문제·프로그램 저장소(이 폴더): 변경 사항 커밋 → GitHub 최신 내려받기 → GitHub에 올리기
- 학습기록 저장소(또 틀렸다!/GitHub학습기록 폴더에 자동 복제): 학습상태 JSON과 오늘 학습기록 Markdown 저장·올리기

토큰은 필요 없다. PC에 이미 저장된 GitHub 로그인(Git Credential Manager)을 그대로 사용한다.
127.0.0.1(내 PC 안)에서만 요청을 받으므로 외부에서는 접근할 수 없다.

출제위원 테스트의 「지금 출제하기」도 처리한다(2026-10-05 사용자 요청).
- 설치된 Codex CLI와 로그인된 ChatGPT 계정을 쓴다. 유료 API 키를 쓰지 않는다.
- examiner-test/brief.md(출제위원 지침)와 압축된 기출 분석만 보내고, 결과는 정해진 JSON 형식으로 받는다.
- 화면에서 형식 검사·자동 점검을 통과한 묶음만 library.js·journal-library.js 끝에 덧붙인다. 기존 문제는 바꾸지 않는다.
"""
import hashlib
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HELPER_NAME = 'tax-accounting-sync-helper'
HELPER_VERSION = 3
SEASON = 'exam-20260914'
PORT = int(os.environ.get('TAX_SYNC_PORT', '8790'))

BASE_DIR = Path(os.environ.get('TAX_SYNC_PROGRAM_DIR') or Path(__file__).resolve().parent)
PROGRAM_DIR = BASE_DIR
PROGRAM_REMOTE = os.environ.get('TAX_SYNC_PROGRAM_REMOTE') or 'https://github.com/Park-hyojoon/tax-accounting-wrong-answer-center.git'
LEARNING_DIR = Path(os.environ.get('TAX_SYNC_LEARNING_DIR') or (BASE_DIR / '또 틀렸다!' / 'GitHub학습기록'))
LEARNING_REMOTE = os.environ.get('TAX_SYNC_LEARNING_REMOTE') or 'https://github.com/Park-hyojoon/tax-accounting-learning-sync.git'
BRANCH = 'main'
LEARNING_STATE_PATH = f'sync/{SEASON}/learning-state.json'
LOG_PATH = LEARNING_DIR.parent / '동기화도우미.log'
DEFAULT_USER_NAME = 'Park Hyojoon'
DEFAULT_USER_EMAIL = 'phjoon7709@gmail.com'
GIT_TIMEOUT = 90

LOCK = threading.Lock()


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}\n"
    try:
        if LOG_PATH.exists() and LOG_PATH.stat().st_size > 512 * 1024:
            LOG_PATH.write_text('', encoding='utf-8')
        with LOG_PATH.open('a', encoding='utf-8') as handle:
            handle.write(line)
    except OSError:
        pass


class GitError(Exception):
    pass


class SyncConflict(Exception):
    pass


def git(cwd, *args, check=True, timeout=GIT_TIMEOUT):
    env = dict(os.environ)
    env['GIT_TERMINAL_PROMPT'] = '0'
    env['GCM_INTERACTIVE'] = 'never'
    env['LC_ALL'] = 'C.UTF-8'
    command = [
        'git',
        '-c', 'safe.directory=*',
        '-c', 'core.quotepath=false',
        '-c', f'user.name={git_identity("user.name", DEFAULT_USER_NAME)}',
        '-c', f'user.email={git_identity("user.email", DEFAULT_USER_EMAIL)}',
        *args,
    ]
    try:
        completed = subprocess.run(
            command, cwd=str(cwd), env=env, capture_output=True, timeout=timeout,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except FileNotFoundError:
        raise GitError('git 프로그램을 찾지 못했습니다. Git이 설치되어 있는지 확인해 주세요.')
    except subprocess.TimeoutExpired:
        raise GitError(f'git {args[0]} 작업이 {timeout}초 안에 끝나지 않았습니다. 인터넷 연결을 확인해 주세요.')
    stdout = completed.stdout.decode('utf-8', 'replace')
    stderr = completed.stderr.decode('utf-8', 'replace')
    if check and completed.returncode != 0:
        raise GitError((stderr or stdout).strip() or f'git {args[0]} 실패')
    return completed.returncode, stdout, stderr


_identity_cache = {}


def git_identity(key, fallback):
    if key not in _identity_cache:
        try:
            completed = subprocess.run(['git', 'config', '--get', key], capture_output=True, timeout=10,
                                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            value = completed.stdout.decode('utf-8', 'replace').strip()
        except Exception:
            value = ''
        _identity_cache[key] = value or fallback
    return _identity_cache[key]


def now_label():
    return datetime.now().strftime('%Y-%m-%d %H:%M')


def status_files(cwd):
    _, out, _ = git(cwd, 'status', '--porcelain', '--untracked-files=all')
    files = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        name = line[3:].strip()
        if ' -> ' in name:
            name = name.split(' -> ', 1)[1]
        files.append(name.strip('"'))
    return files


def head_sha(cwd):
    code, out, _ = git(cwd, 'rev-parse', '--verify', 'HEAD', check=False)
    return out.strip() if code == 0 else ''


def diff_names(cwd, old, new):
    if not old or not new or old == new:
        return []
    _, out, _ = git(cwd, 'diff', '--name-only', old, new)
    return [name for name in out.splitlines() if name.strip()]


def is_ancestor(cwd, maybe_ancestor, of):
    code, _, _ = git(cwd, 'merge-base', '--is-ancestor', maybe_ancestor, of, check=False)
    return code == 0


def abort_in_progress(cwd):
    git(cwd, 'merge', '--abort', check=False)
    git(cwd, 'rebase', '--abort', check=False)


def commit_all(cwd, message):
    """변경 파일이 있으면 모두 커밋한다. 커밋한 파일 목록을 돌려준다."""
    files = status_files(cwd)
    if not files:
        return []
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '--quiet', '-m', message)
    return files


def pull_remote(cwd):
    """origin/main을 받아와 현재 브랜치에 합친다. 내려받은 파일 목록을 돌려준다."""
    before = head_sha(cwd)
    git(cwd, 'fetch', '--quiet', 'origin', BRANCH)
    _, remote, _ = git(cwd, 'rev-parse', f'origin/{BRANCH}')
    remote = remote.strip()
    if not before:
        git(cwd, 'reset', '--hard', remote)
        return diff_names(cwd, before, remote)
    if is_ancestor(cwd, remote, before):
        return []
    code, _, err = git(cwd, 'merge', '--no-edit', '--quiet', '-m', 'GitHub 최신 내용과 합침', remote, check=False)
    if code != 0:
        abort_in_progress(cwd)
        raise SyncConflict('PC와 GitHub가 같은 파일의 같은 부분을 서로 다르게 고쳤습니다. 자동으로 합치지 않고 양쪽을 그대로 두었습니다. ' + err.strip()[:300])
    return diff_names(cwd, before, head_sha(cwd))


def push_remote(cwd):
    _, remote, _ = git(cwd, 'rev-parse', f'origin/{BRANCH}')
    if head_sha(cwd) == remote.strip():
        return False
    for attempt in range(2):
        code, _, err = git(cwd, 'push', '--quiet', 'origin', f'HEAD:{BRANCH}', check=False)
        if code == 0:
            return True
        if attempt == 0 and ('rejected' in err or 'fetch first' in err or 'non-fast-forward' in err):
            pull_remote(cwd)
            continue
        raise GitError('GitHub에 올리지 못했습니다. ' + err.strip()[:300])
    return True


def ensure_program_repo():
    if not (PROGRAM_DIR / '.git').exists():
        raise GitError(f'{PROGRAM_DIR} 폴더가 git 저장소가 아닙니다.')


def sync_program():
    ensure_program_repo()
    result = {'committed': [], 'pulled': [], 'pushed': False, 'conflict': False, 'message': ''}
    result['committed'] = commit_all(PROGRAM_DIR, f'PC 동기화: {now_label()}')
    try:
        result['pulled'] = pull_remote(PROGRAM_DIR)
    except SyncConflict as error:
        result['conflict'] = True
        result['message'] = str(error)
        return result
    result['pushed'] = push_remote(PROGRAM_DIR)
    parts = []
    if result['committed']:
        parts.append(f"PC의 변경 {len(result['committed'])}개 파일을 GitHub에 올렸습니다.")
    elif result['pushed']:
        parts.append('PC에 미리 커밋된 변경을 GitHub에 올렸습니다.')
    if result['pulled']:
        parts.append(f"GitHub의 최신 {len(result['pulled'])}개 파일을 PC에 받았습니다.")
    result['message'] = ' '.join(parts) or 'PC와 GitHub의 문제·프로그램이 이미 같습니다.'
    return result


def ensure_learning_repo():
    if (LEARNING_DIR / '.git').exists():
        return
    LEARNING_DIR.parent.mkdir(parents=True, exist_ok=True)
    code, _, err = git(LEARNING_DIR.parent, 'clone', '--quiet', LEARNING_REMOTE, str(LEARNING_DIR), check=False, timeout=180)
    if code != 0:
        raise GitError('학습기록 저장소를 PC에 복제하지 못했습니다. ' + err.strip()[:300])


def file_hash(path):
    if not path.exists():
        return ''
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_learning_state():
    ensure_learning_repo()
    try:
        pull_remote(LEARNING_DIR)
    except SyncConflict:
        raise
    path = LEARNING_DIR / LEARNING_STATE_PATH
    state = None
    if path.exists():
        try:
            state = json.loads(path.read_text(encoding='utf-8'))
        except ValueError:
            state = None
    return {'state': state, 'base': file_hash(path)}


def write_learning_files(files, message):
    """files: {상대경로: 내용}. 저장 후 커밋·올리기. 충돌 시 SyncConflict."""
    ensure_learning_repo()
    for relative in files:
        clean = relative.replace('\\', '/').strip('/')
        if not (clean.startswith('records/') or clean.startswith('sync/')) or '..' in clean.split('/'):
            raise GitError(f'허용되지 않은 경로입니다: {relative}')
    for relative, content in files.items():
        target = LEARNING_DIR / relative.replace('\\', '/').strip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8', newline='\n')
    if not status_files(LEARNING_DIR):
        return False
    git(LEARNING_DIR, 'add', '-A')
    git(LEARNING_DIR, 'commit', '--quiet', '-m', message)
    try:
        push_remote(LEARNING_DIR)
    except SyncConflict:
        raise
    return True


def write_learning_state(state, base):
    if not isinstance(state, dict) or state.get('season') != SEASON:
        raise GitError('다른 학습 시즌의 기록입니다. 페이지를 새로고침해 주세요.')
    path = LEARNING_DIR / LEARNING_STATE_PATH
    if file_hash(path) != (base or ''):
        raise SyncConflict('학습기록을 읽은 뒤 다른 기기가 먼저 저장했습니다. 다시 읽어서 합칩니다.')
    device = ''
    if isinstance(state, dict):
        device = str((state.get('device') or {}).get('name') or '')
    text = json.dumps(state, ensure_ascii=False, indent=2) + '\n'
    write_learning_files({LEARNING_STATE_PATH: text}, f'학습상태 동기화: {now_label()} {device}'.strip())
    return {'base': file_hash(path)}


def write_record(relative, content):
    ensure_learning_repo()
    try:
        pull_remote(LEARNING_DIR)
    except SyncConflict:
        raise
    write_learning_files({relative: content}, f'학습기록 저장: {relative}')
    return {'path': relative, 'localPath': str(LEARNING_DIR / relative)}


# ---------------------------------------------------------------------------
# 출제위원 테스트: Codex 자동 출제
# ---------------------------------------------------------------------------
EXAMINER_DIR = PROGRAM_DIR / 'examiner-test'
EXAMINER_WORK = EXAMINER_DIR / 'private' / 'ai-work'   # .gitignore: examiner-test/private/
EXAMINER_TIMEOUT = int(os.environ.get('TAX_EXAMINER_TIMEOUT', '1500'))
EXAMINER_STYLES = ['정석 출제', '기출 변형', '장기 미출제 후보', '교재 주변부', '예외규정', '함정형']
REVIEW_KEYS = ['copy', 'textbook', 'sentence', 'choices', 'peripheral', 'absence', 'exception', 'surprise', 'forced']
VOUCHER_TYPES = ['11.과세', '12.영세', '13.면세', '14.건별', '15.간이', '16.수출', '17.카과', '18.카면', '19.카영', '20.면건',
                 '21.전자', '22.현과', '23.현면', '24.현영', '51.과세', '52.영세', '53.면세', '54.불공', '55.수입', '56.금전',
                 '57.카과', '58.카면', '59.카영', '60.면건', '61.현과', '62.현면']
JOURNAL_KINDS = ['현금', '외상', '혼합', '카드']
CARD_COMPANIES = ['국민카드', '삼성카드', '신한카드', '우리카드', '하나카드', '비씨카드', '롯데카드', '현대카드']
ZERO_RATE_REASONS = ['①직접수출(대행수출 포함)', '②중계무역 수출', '③내국신용장·구매확인서에 의한 공급']
DEDUCT_REASONS = ['①필요적 기재사항 누락 등', '②사업과 직접 관련 없는 지출', '③비영업용 소형승용자동차 구입·유지 및 임차',
                  '④기업업무추진비 및 이와 유사한 비용 관련', '⑤면세사업 등 관련', '⑥토지의 자본적 지출 관련',
                  '⑦사업자등록 전 매입세액', '⑧금·구리 스크랩 거래계좌 미사용 관련 매입세액']
CALC_LOADS = ['없음', '날짜 비교', '단순 가감', '한 단계 계산', '두 단계 계산']
ALLOWED_ORIGIN = re.compile(r'^(null|http://(127\.0\.0\.1|localhost)(:\d+)?|https://park-hyojoon\.github\.io)$')
EXAMINER_STATE = {'job': None, 'login': None}
EXAMINER_STATE_LOCK = threading.Lock()


class ExaminerError(Exception):
    pass


def find_codex():
    explicit = os.environ.get('CODEX_CLI_PATH')
    if explicit and Path(explicit).exists():
        return explicit
    base = Path(os.environ.get('LOCALAPPDATA') or (Path.home() / 'AppData' / 'Local')) / 'OpenAI' / 'Codex' / 'bin'
    installed = []
    try:
        for folder in base.iterdir():
            exe = folder / 'codex.exe'
            if exe.exists():
                installed.append((exe.stat().st_mtime, str(exe)))
    except OSError:
        pass
    if installed:
        return sorted(installed, reverse=True)[0][1]
    return shutil.which('codex') or ''


def run_codex(args, timeout=30, stdin_text=None):
    codex = find_codex()
    if not codex:
        raise ExaminerError('Codex가 설치되어 있지 않습니다. Codex 앱 또는 CLI를 설치한 뒤 다시 시도해 주세요.')
    completed = subprocess.run([codex, *args], input=(stdin_text or '').encode('utf-8'), capture_output=True, timeout=timeout,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return completed.returncode, completed.stdout.decode('utf-8', 'replace'), completed.stderr.decode('utf-8', 'replace')


def codex_status():
    codex = find_codex()
    if not codex:
        return {'installed': False, 'loggedIn': False}
    try:
        code, out, err = run_codex(['login', 'status'], timeout=20)
        logged = code == 0 and bool(re.search(r'logged in', out + err, re.I))
    except Exception:  # noqa: BLE001
        logged = False
    return {'installed': True, 'loggedIn': logged}


def codex_login():
    """ChatGPT 로그인 창을 연다. 로그인은 사용자가 브라우저에서 직접 한다."""
    codex = find_codex()
    if not codex:
        raise ExaminerError('Codex가 설치되어 있지 않습니다.')
    with EXAMINER_STATE_LOCK:
        running = EXAMINER_STATE.get('login')
        if running and running.poll() is None:
            return
        EXAMINER_STATE['login'] = subprocess.Popen([codex, 'login'], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                                   stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))


def user_codex_model():
    """사용자의 Codex 설정(~/.codex/config.toml)에 지정된 모델 이름. 없으면 Codex 기본값을 쓴다."""
    home = Path(os.environ.get('CODEX_HOME') or (Path.home() / '.codex'))
    try:
        for line in (home / 'config.toml').read_text(encoding='utf-8').splitlines():
            if line.strip().startswith('['):
                break
            match = re.match(r'\s*model\s*=\s*"([^"]+)"', line)
            if match:
                return match.group(1)
    except OSError:
        pass
    return ''


def read_js_value(path, name):
    """window.NAME = <JSON>; 형태의 데이터 파일에서 JSON 값을 읽는다."""
    text = Path(path).read_text(encoding='utf-8')
    marker = f'window.{name}'
    start = text.index(marker)
    body = text[text.index('=', start) + 1:].strip()
    if body.endswith(';'):
        body = body[:-1].strip()
    return json.loads(body)


def read_journal_bank_titles():
    """시범 전표(journal-bank.js, JS 객체 문법)는 제목·분야·유형만 읽어 중복 회피 목록에 쓴다."""
    text = (EXAMINER_DIR / 'journal-bank.js').read_text(encoding='utf-8')
    items = []
    for block in re.findall(r"\{\s*id:'[^']+',kind:'(practical|voucher)',title:'([^']+)'", text):
        items.append({'kind': block[0], 'title': block[1]})
    for index, voucher_type in enumerate(re.findall(r"type:'(\d\d\.[^']+)'", text)):
        voucher_items = [i for i in items if i['kind'] == 'voucher']
        if index < len(voucher_items):
            voucher_items[index]['voucherType'] = voucher_type
    return items


def examiner_inputs():
    analysis = read_js_value(EXAMINER_DIR / 'analysis.js', 'ExaminerAnalysis')
    practice = read_js_value(EXAMINER_DIR / 'practice-analysis.js', 'ExaminerPracticeAnalysis')
    pilot = read_js_value(EXAMINER_DIR / 'questions.js', 'ExaminerPilot')
    library = read_js_value(EXAMINER_DIR / 'library.js', 'ExaminerLibrary')
    journal_library = read_js_value(EXAMINER_DIR / 'journal-library.js', 'ExaminerJournalLibrary')
    brief = (EXAMINER_DIR / 'brief.md').read_text(encoding='utf-8')
    return analysis, practice, pilot, library, journal_library, brief


def existing_questions(pilot, library, journal_library):
    rows = []
    for pack in [pilot, *library]:
        for q in pack.get('questions', []):
            rows.append(f"이론 · {q.get('area')} · {q.get('title')} · 개념 {'+'.join(q.get('conceptIds', []))} · {', '.join(q.get('styles', []))}")
    journal = read_journal_bank_titles()
    for batch in journal_library:
        for item in batch.get('items', []):
            journal.append({'kind': item.get('kind'), 'title': item.get('title'), 'voucherType': (item.get('voucher') or {}).get('type'),
                            'conceptIds': item.get('conceptIds', [])})
    for item in journal:
        label = '일반전표' if item.get('kind') == 'practical' else '매입매출'
        extra = item.get('voucherType') or ''
        concepts = '+'.join(item.get('conceptIds') or [])
        rows.append(f"{label} · {item.get('title')}" + (f' · {extra}' if extra else '') + (f' · 개념 {concepts}' if concepts else ''))
    return rows


def compact_theory(analysis, used):
    concepts = []
    for c in analysis['concepts']:
        f = c.get('frequency', {})
        older = f.get('older') or {}
        concepts.append({'id': c['id'], 'area': c['area'], 'label': c['label'], 'point': c['point'], 'trap': c['trap'],
                         'recentRounds': f.get('rounds', []), 'recentQuestions': f.get('questions', 0),
                         'olderRounds': older.get('rounds', []), 'absence': f.get('longAbsence', ''),
                         'alreadyTested': used.get(c['id'], 0)})
    def row(r):
        return f"{r['id']}|{'+'.join(r['conceptIds'])}|{r['textPattern']}|{r['choicePattern']}|{r['answerSummary'][:50]}"
    return {'recentRounds': analysis['rounds'], 'olderRounds': analysis.get('olderRounds', []), 'coverage': analysis.get('coverage'),
            'officialScope': (analysis.get('scope') or {}).get('official'), 'concepts': concepts,
            'records': [row(r) for r in analysis['records']], 'olderRecords': [row(r) for r in analysis.get('olderRecords', [])],
            'patterns': analysis.get('patterns')}


def compact_practice(practice, used_types):
    return {'rounds': practice['rounds'], 'coverage': practice['coverage'], 'scope': practice.get('scope'),
            'voucherTypes': [{'code': t['code'], 'count': t['count'], 'rounds': t['rounds'], 'alreadyTested': used_types.get(t['code'], 0)}
                             for t in practice['voucherTypes']],
            'concepts': [{'id': c['id'], 'label': c['label'], 'count': c['count'], 'rounds': c['rounds']} for c in practice['concepts']],
            'topAccounts': practice.get('topAccounts', []),
            'records': [f"{r['id']}|{r['part']}|{r['title']}|{r['voucherType'] or '-'}|{'/'.join(r['accounts'])}" for r in practice['records']]}


def nullable(schema):
    return {'anyOf': [{'type': 'null'}, schema]}


def strict_object(properties):
    return {'type': 'object', 'additionalProperties': False, 'required': list(properties), 'properties': properties}


def examiner_schema(analysis, practice):
    text = {'type': 'string'}
    table = strict_object({'caption': text, 'headers': {'type': 'array', 'items': text},
                           'rows': {'type': 'array', 'items': {'type': 'array', 'items': text}}})
    review = strict_object({key: text for key in REVIEW_KEYS})
    concept_ids = [c['id'] for c in analysis['concepts']]
    record_ids = [r['id'] for r in analysis['records']] + [r['id'] for r in analysis.get('olderRecords', [])]
    practice_concepts = [c['id'] for c in practice['concepts']] + ['pr-new-concept']
    practice_records = [r['id'] for r in practice['records']]
    styles = {'type': 'array', 'minItems': 1, 'maxItems': 3, 'items': {'type': 'string', 'enum': EXAMINER_STYLES}}
    theory_item = strict_object({
        'title': text, 'area': {'type': 'string', 'enum': ['회계원리', '원가회계', '부가가치세']},
        'conceptIds': {'type': 'array', 'minItems': 1, 'maxItems': 3, 'items': {'type': 'string', 'enum': concept_ids}},
        'styles': styles, 'prompt': text, 'table': nullable(table),
        'choices': {'type': 'array', 'minItems': 4, 'maxItems': 4, 'items': text},
        'answer': {'type': 'integer', 'enum': [0, 1, 2, 3]}, 'explanation': text,
        'distractorReasons': {'type': 'array', 'minItems': 4, 'maxItems': 4, 'items': text},
        'intent': text, 'trap': text, 'novelty': text, 'calculationLoad': {'type': 'string', 'enum': CALC_LOADS},
        'sourceRefs': {'type': 'array', 'items': {'type': 'string', 'enum': record_ids}}, 'basis': text,
        'references': {'type': 'array', 'items': strict_object({'title': text, 'url': text})},
        'boundary': text, 'review': review})
    voucher = strict_object({
        'date': text, 'type': {'type': 'string', 'enum': VOUCHER_TYPES}, 'supply': {'type': 'integer'}, 'vat': {'type': 'integer'},
        'supplier': text, 'electronic': {'type': 'string', 'enum': ['여', '부']}, 'journal': {'type': 'string', 'enum': JOURNAL_KINDS},
        'cardCompany': nullable({'type': 'string', 'enum': CARD_COMPANIES}),
        'zeroRateType': nullable({'type': 'string', 'enum': ZERO_RATE_REASONS}),
        'deductReason': nullable({'type': 'string', 'enum': DEDUCT_REASONS})})
    entry_row = strict_object({'side': {'type': 'string', 'enum': ['D', 'C']}, 'account': text, 'amount': {'type': 'integer'},
                               'division': {'type': 'string', 'enum': ['', '판', '제']}, 'partner': text})
    journal_item = strict_object({
        'kind': {'type': 'string', 'enum': ['practical', 'voucher']}, 'title': text, 'prompt': text, 'exhibit': nullable(table),
        'voucher': nullable(voucher), 'rows': {'type': 'array', 'minItems': 2, 'maxItems': 6, 'items': entry_row},
        'explanation': text, 'styles': styles,
        'conceptIds': {'type': 'array', 'minItems': 1, 'maxItems': 3, 'items': {'type': 'string', 'enum': practice_concepts}},
        'intent': text, 'trap': text, 'novelty': text, 'calculationLoad': {'type': 'string', 'enum': CALC_LOADS},
        'sourceRefs': {'type': 'array', 'items': {'type': 'string', 'enum': practice_records}}, 'basis': text, 'boundary': text,
        'review': review})
    return strict_object({'selectionNote': text, 'withheld': {'type': 'array', 'items': text},
                          'theory': {'type': 'array', 'items': theory_item}, 'journal': {'type': 'array', 'items': journal_item}})


def examiner_prompt(counts, styles, analysis, practice, pilot, library, journal_library, brief):
    used_concepts, used_types = {}, {}
    for pack in [pilot, *library]:
        for q in pack.get('questions', []):
            for c in q.get('conceptIds', []):
                used_concepts[c] = used_concepts.get(c, 0) + 1
    for batch in journal_library:
        for item in batch.get('items', []):
            code = (item.get('voucher') or {}).get('type')
            if code:
                used_types[code] = used_types.get(code, 0) + 1
    for item in read_journal_bank_titles():
        if item.get('voucherType'):
            used_types[item['voucherType']] = used_types.get(item['voucherType'], 0) + 1
    style_text = '출제위원 랜덤(지침 4장의 세트 구성을 따른다)' if not styles or '출제위원 랜덤' in styles else '·'.join(styles)
    existing = existing_questions(pilot, library, journal_library)
    today = datetime.now().strftime('%Y-%m-%d')
    return '\n'.join([
        '당신은 한국세무사회 전산회계 1급 시험의 출제위원이다. 아래 출제위원 지침을 그대로 따른다.',
        '파일을 읽거나 명령을 실행할 필요가 없다. 필요한 자료는 모두 이 요청 안에 있다. 법령·기준의 현행 여부를 확인할 때만 웹 검색을 쓸 수 있다.',
        '', '<출제위원 지침>', brief.strip(), '</출제위원 지침>', '',
        '## 이번 요청',
        f'- 오늘 날짜: {today}. 법령은 이 날짜의 현행 조문 기준으로 확인한다.',
        f"- 최종 문항 수: 이론 {counts['theory']}문항, 일반전표 {counts['practical']}문항, 매입매출 {counts['voucher']}문항.",
        f"  검수에서 탈락하는 문항을 대신할 예비를 분야마다 1개씩 더 낸다. theory 배열에 {counts['theory'] + (1 if counts['theory'] else 0)}개, journal 배열에 kind=\"practical\" {counts['practical'] + (1 if counts['practical'] else 0)}개와 kind=\"voucher\" {counts['voucher'] + (1 if counts['voucher'] else 0)}개를 넣는다. 예비도 같은 품질 기준을 충족해야 한다.",
        f'- 출제 스타일: {style_text}',
        '- 문항 ID는 쓰지 않는다. 도우미가 붙인다.',
        '- 일반전표(kind="practical")는 voucher를 null로 둔다. 매입매출(kind="voucher")은 voucher를 채운다. 보조 항목(cardCompany·zeroRateType·deductReason)은 해당 유형일 때만 값, 아니면 null.',
        '- table·exhibit는 자료가 필요할 때만 쓰고, 아니면 null.',
        '- 이론 sourceRefs가 비어 있으면 references에 실제로 확인한 HTTPS 근거를 1개 이상 넣는다. 확인하지 못한 주소를 만들지 않는다.',
        '- 실무 문항의 conceptIds는 실무 분석의 개념 ID를 쓰고, 목록에 없는 범위 내 개념이면 pr-new-concept를 쓰고 basis에 설명한다.',
        '- selectionNote: 두 배로 구상한 후보 중 무엇을 왜 걸렀는지 2~4문장. withheld: 근거 부족 등으로 내지 않은 후보와 사유(없으면 빈 배열).',
        '', '## 이미 출제한 문제 — 같은 개념의 같은 판단 지점을 반복하지 않는다',
        *[f'- {row}' for row in existing],
        '', '## 이론 기출 분석 요약(JSON). records 형식: ID|개념|문장 유형|오답 유형|정답 요약',
        json.dumps(compact_theory(analysis, used_concepts), ensure_ascii=False, separators=(',', ':')),
        '', '## 실무 기출 분석 요약(JSON). records 형식: ID|구분|유형 이름|매입매출 유형코드|정답 분개 계정',
        json.dumps(compact_practice(practice, used_types), ensure_ascii=False, separators=(',', ':')),
        '', '## 출력', '지정된 JSON 스키마에 맞는 JSON 하나만 출력한다.'])


def short_id():
    return datetime.now().strftime('%Y%m%d%H%M') + '-' + secrets.token_hex(2)


LIMITS_THEORY = {'title': 140, 'prompt': 2400, 'explanation': 2400, 'intent': 800, 'trap': 800, 'novelty': 800, 'basis': 1200, 'boundary': 800}
HTTPS_URL = re.compile(r'^https://[^\s@]+$')
TEN_PERCENT_TYPES = {'11.과세', '51.과세', '54.불공', '14.건별', '17.카과', '22.현과', '57.카과', '61.현과'}
ZERO_VAT_PATTERN = re.compile(r'영세|면세|수출|면건|카면|카영|현면|현영')
CARD_TYPE_CODES = {'17.카과', '18.카면', '19.카영', '57.카과', '58.카면', '59.카영'}
ZERO_RATE_TYPE_CODES = {'12.영세', '16.수출', '19.카영', '24.현영', '52.영세', '59.카영'}
TYPE_CODE_LEAK = re.compile(r'\b\d{2}\.(과세|영세|면세|건별|간이|수출|카과|카면|카영|면건|전자|현과|현면|현영|불공|수입|금전)')


def norm_text(value):
    """journal.js의 norm()과 같은 규칙: NFKC, ㈜/(주) 통일, 공백·구분 기호 제거, 소문자."""
    import unicodedata
    text = unicodedata.normalize('NFKC', str(value if value is not None else ''))
    text = text.replace('㈜', '주').replace('(주)', '주')
    return re.sub(r'[\s·._-]', '', text).lower()


def caution_count(review):
    return sum(1 for value in (review or {}).values() if str(value).strip().startswith('주의'))


def validate_theory_item(q):
    """이론 문항을 화면(engine.js validatePack)보다 먼저 거른다. 문제가 있으면 사유 문자열을 돌려준다."""
    for key, limit in LIMITS_THEORY.items():
        value = q.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            return f'{key} 항목이 비었거나 {limit}자를 넘습니다.'
    if len(q['choices']) != 4 or len({c.strip() for c in q['choices']}) != 4 or any(not c.strip() or len(c) > 900 for c in q['choices']):
        return '서로 다른 선택지 4개가 필요합니다.'
    if len(q['distractorReasons']) != 4 or any(not r.strip() or len(r) > 900 for r in q['distractorReasons']):
        return '선택지별 해설 4개가 필요합니다.'
    if not q['sourceRefs'] and not q['references']:
        return '표본 밖 개념인데 근거 링크가 없습니다.'
    for ref in q['references']:
        url = ref['url']
        if not HTTPS_URL.match(url) or '.invalid' in url or len(url) > 1400 or not ref['title'].strip():
            return '근거 링크가 HTTPS 주소가 아니거나 형식이 잘못되었습니다.'
    if len(q['references']) > 5 or len(q['sourceRefs']) > 12:
        return '근거 개수가 너무 많습니다.'
    if q.get('table'):
        tb = q['table']
        if not tb['headers'] or len(tb['headers']) > 8 or not tb['rows'] or len(tb['rows']) > 16 or any(len(r) != len(tb['headers']) for r in tb['rows']):
            return '자료표의 행과 열이 맞지 않습니다.'
    if caution_count(q.get('review')) >= 2:
        return 'AI 자기 검토에서 주의 항목이 2개 이상입니다.'
    return None


def validate_journal_item(item):
    """전표 문항을 화면(journal.js validateBank)보다 먼저 거른다."""
    rows = item['rows']
    debit = sum(r['amount'] for r in rows if r['side'] == 'D')
    credit = sum(r['amount'] for r in rows if r['side'] == 'C')
    if debit <= 0 or debit != credit:
        return '차변과 대변 합계가 다릅니다.'
    if any(r['amount'] <= 0 or not r['account'].strip() for r in rows):
        return '금액이 0 이하이거나 계정이 빈 행이 있습니다.'
    for key, limit in {'title': 140, 'prompt': 2400, 'explanation': 2400}.items():
        if not item[key].strip() or len(item[key]) > limit:
            return f'{key} 항목이 비었거나 길이를 넘습니다.'
    if item.get('exhibit'):
        ex = item['exhibit']
        if not ex['headers'] or any(len(r) != len(ex['headers']) for r in ex['rows']):
            return '자료표의 행과 열이 맞지 않습니다.'
    if item['kind'] == 'practical':
        return None if caution_count(item.get('review')) < 2 else 'AI 자기 검토에서 주의 항목이 2개 이상입니다.'
    v = item.get('voucher')
    if not v:
        return '매입매출 문항에 전표 내용이 없습니다.'
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', v['date']) or v['supply'] < 0 or v['vat'] < 0:
        return '전표 날짜 형식(YYYY-MM-DD)이나 금액이 잘못되었습니다.'
    if v['type'] in TEN_PERCENT_TYPES and abs(round(v['supply'] * 0.1) - v['vat']) > 1:
        return '세액이 공급가액의 10%와 맞지 않습니다.'
    if ZERO_VAT_PATTERN.search(v['type']) and v['vat'] != 0:
        return '영세율·면세 유형인데 세액이 0원이 아닙니다.'
    if v['type'] in CARD_TYPE_CODES and not v.get('cardCompany'):
        return '카드 유형인데 카드사 정답이 없습니다.'
    if v['type'] in ZERO_RATE_TYPE_CODES and not v.get('zeroRateType'):
        return '영세율 유형인데 영세율 구분 정답이 없습니다.'
    if v['type'] == '54.불공' and not v.get('deductReason'):
        return '불공제 유형인데 불공제 사유 정답이 없습니다.'
    if TYPE_CODE_LEAK.search(item['prompt'] + ' ' + item['title']):
        return '제목이나 지문에 유형코드가 드러나 있습니다.'
    if caution_count(item.get('review')) >= 2:
        return 'AI 자기 검토에서 주의 항목이 2개 이상입니다.'
    return None


def check_candidate(result):
    """형식 검사로 문항을 거른다. (남은 이론, 남은 전표, 탈락 사유 목록)을 돌려준다."""
    rejected = []
    kept_theory, kept_journal = [], []
    for index, q in enumerate(result.get('theory') or [], 1):
        reason = validate_theory_item(q)
        if reason:
            rejected.append(f"이론 후보 {index}「{q.get('title', '')[:30]}」: {reason}")
        else:
            kept_theory.append(q)
    for index, item in enumerate(result.get('journal') or [], 1):
        reason = validate_journal_item(item)
        label = '일반전표' if item.get('kind') == 'practical' else '매입매출'
        if reason:
            rejected.append(f"{label} 후보 {index}「{item.get('title', '')[:30]}」: {reason}")
        else:
            kept_journal.append(item)
    return kept_theory, kept_journal, rejected


def compare_journal(expected, solved):
    """독립 재풀이 결과를 journal.js check()와 같은 기준으로 비교한다. 다른 항목 목록을 돌려준다(없으면 일치)."""
    problems = []
    if expected['kind'] == 'voucher':
        ev, sv = expected.get('voucher') or {}, solved.get('voucher') or {}
        labels = {'date': '날짜', 'type': '유형', 'supply': '공급가액', 'vat': '세액', 'supplier': '공급처', 'electronic': '전자 여부', 'journal': '분개 유형',
                  'cardCompany': '카드사', 'zeroRateType': '영세율 구분', 'deductReason': '불공제 사유'}
        for key, label in labels.items():
            if key in ('cardCompany', 'zeroRateType', 'deductReason') and not ev.get(key):
                continue
            if key in ('supply', 'vat'):
                if ev.get(key) != sv.get(key):
                    problems.append(label)
            elif norm_text(ev.get(key)) != norm_text(sv.get(key)):
                problems.append(label)

    def key(row):
        return (row['side'], norm_text(row['account']), row['amount'], norm_text(row.get('division')), norm_text(row.get('partner')))
    if sorted(key(r) for r in expected['rows']) != sorted(key(r) for r in solved.get('rows', [])):
        problems.append('분개 행')
    return problems


def blind_prompt(theory, journal):
    lines = ['당신은 전산회계 1급 시험을 준비한 수험생이다. 아래 문항을 처음 보는 문제로 풀어라. 정답이나 해설은 주어지지 않는다.',
             '- 이론: 정답 번호(0~3)를 고른다. 정답이 하나로 정해지지 않거나, 복수 선택지가 옳거나, 조건이 모호하면 ambiguous를 true로 하고 이유를 note에 쓴다.',
             '- 일반전표(practical): 일반전표 분개를 rows에 쓴다. voucher는 null.',
             '- 매입매출(voucher): 매입매출전표 내용(voucher)과 분개(rows)를 쓴다. 날짜는 YYYY-MM-DD, 전자는 여/부, 분개 유형은 현금·외상·혼합·카드.',
             '- 계정과목은 KcLep 표준 계정명을 쓴다. 금액은 정수(쉼표 없음). division은 판관비면 "판", 제조면 "제", 아니면 "". partner는 채권·채무 거래처가 필요할 때만, 아니면 "".',
             '- 문항에 쓰이지 않은 조건을 상상하지 않는다. 지문만으로 답이 정해지지 않으면 ambiguous를 true로 한다.',
             '- 파일을 읽거나 명령을 실행하지 않는다. 지정된 JSON 하나만 출력한다.', '']
    for q in theory:
        lines.append(f"### 이론 {q['_bid']}")
        lines.append(f"분야: {q['area']}")
        lines.append(q['prompt'])
        if q.get('table'):
            tb = q['table']
            lines.append(f"[{tb['caption']}]")
            lines.append(' | '.join(tb['headers']))
            lines.extend(' | '.join(r) for r in tb['rows'])
        lines.extend(f'{i}: {c}' for i, c in enumerate(q['choices']))
        lines.append('')
    for item in journal:
        lines.append(f"### {'일반전표' if item['kind'] == 'practical' else '매입매출'} {item['_bid']}")
        lines.append(item['prompt'])
        if item.get('exhibit'):
            ex = item['exhibit']
            lines.append(f"[{ex['caption']}]")
            lines.append(' | '.join(ex['headers']))
            lines.extend(' | '.join(r) for r in ex['rows'])
        lines.append('')
    return '\n'.join(lines)


def blind_schema():
    text = {'type': 'string'}
    entry_row = strict_object({'side': {'type': 'string', 'enum': ['D', 'C']}, 'account': text, 'amount': {'type': 'integer'},
                               'division': {'type': 'string', 'enum': ['', '판', '제']}, 'partner': text})
    voucher = strict_object({'date': text, 'type': {'type': 'string', 'enum': VOUCHER_TYPES}, 'supply': {'type': 'integer'}, 'vat': {'type': 'integer'},
                             'supplier': text, 'electronic': {'type': 'string', 'enum': ['여', '부']}, 'journal': {'type': 'string', 'enum': JOURNAL_KINDS},
                             'cardCompany': nullable({'type': 'string', 'enum': CARD_COMPANIES}),
                             'zeroRateType': nullable({'type': 'string', 'enum': ZERO_RATE_REASONS}),
                             'deductReason': nullable({'type': 'string', 'enum': DEDUCT_REASONS})})
    return strict_object({
        'theory': {'type': 'array', 'items': strict_object({'id': text, 'answer': {'type': 'integer', 'enum': [0, 1, 2, 3]}, 'ambiguous': {'type': 'boolean'}, 'note': text})},
        'journal': {'type': 'array', 'items': strict_object({'id': text, 'ambiguous': {'type': 'boolean'}, 'note': text, 'voucher': nullable(voucher),
                                                             'rows': {'type': 'array', 'items': entry_row}})}})


def blind_verify(theory, journal, solved):
    """독립 재풀이 결과와 정답을 비교한다. (통과 이론, 통과 전표, 탈락 사유 목록)을 돌려준다."""
    by_theory = {s['id']: s for s in solved.get('theory', [])}
    by_journal = {s['id']: s for s in solved.get('journal', [])}
    passed_theory, passed_journal, rejected = [], [], []
    for q in theory:
        s = by_theory.get(q['_bid'])
        name = q['title'][:30]
        if not s:
            rejected.append(f'이론 후보「{name}」: 독립 재풀이 결과가 없습니다.')
        elif s['ambiguous']:
            rejected.append(f"이론 후보「{name}」: 재풀이에서 정답이 하나로 정해지지 않는다고 보았습니다. {s['note'][:120]}")
        elif s['answer'] != q['answer']:
            rejected.append(f"이론 후보「{name}」: 재풀이 정답(번호 {s['answer'] + 1})이 출제 정답(번호 {q['answer'] + 1})과 달랐습니다.")
        else:
            passed_theory.append(q)
    for item in journal:
        s = by_journal.get(item['_bid'])
        label = '일반전표' if item['kind'] == 'practical' else '매입매출'
        name = item['title'][:30]
        if not s:
            rejected.append(f'{label} 후보「{name}」: 독립 재풀이 결과가 없습니다.')
        elif s['ambiguous']:
            rejected.append(f"{label} 후보「{name}」: 재풀이에서 답이 하나로 정해지지 않는다고 보았습니다. {s['note'][:120]}")
        else:
            diff = compare_journal(item, s)
            if diff:
                rejected.append(f"{label} 후보「{name}」: 재풀이와 달랐던 항목: {', '.join(diff)}")
            else:
                passed_journal.append(item)
    return passed_theory, passed_journal, rejected


def select_final(counts, theory, journal):
    """분야별로 요청 수만큼 앞에서부터 남기고, 남는 후보는 예비로 버린다."""
    chosen_practical = [j for j in journal if j['kind'] == 'practical'][:counts['practical']]
    chosen_voucher = [j for j in journal if j['kind'] == 'voucher'][:counts['voucher']]
    return theory[:counts['theory']], chosen_practical + chosen_voucher


def shape_candidate(theory, journal, counts, styles, model, selection_note, withheld):
    """검수를 통과한 문항에 ID를 붙이고 화면·데이터 파일 형식으로 바꾼다."""
    base = 'ai-' + short_id()
    created = datetime.now().isoformat(timespec='seconds')
    label_date = datetime.now().strftime('%m월 %d일 %H:%M')
    by = f"동기화 도우미 → Codex({model or '기본 모델'}) 출제 + 독립 재풀이 일치 · 출제위원 지침 v2 · 화면 형식 검사 통과 후 추가 · 사람 검토 전"
    verdict = 'AI 1차 검토 + 독립 재풀이 일치 · 사람의 검토나 실제 시험 적합성 인증은 아님'
    questions = []
    for index, q in enumerate(theory, 1):
        item = {k: v for k, v in q.items() if v is not None and k != '_bid'}
        item['id'] = f'{base}-t{index}'
        item['review'] = {**item.get('review', {}), 'verdict': verdict}
        questions.append(item)
    pack = None
    if questions:
        pack = {'schemaVersion': 1, 'season': SEASON, 'id': base, 'label': f'자동 출제 {label_date} · 이론 {len(questions)}문항',
                'generatedBy': by, 'createdAt': created, 'requestedStyles': styles,
                'selectionNote': selection_note, 'withheld': withheld, 'questions': questions}
    items = []
    for index, q in enumerate(journal, 1):
        item = {k: v for k, v in q.items() if v is not None and k != '_bid'}
        item['id'] = f'{base}-j{index}'
        item['review'] = {**item.get('review', {}), 'verdict': verdict}
        if item.get('voucher'):
            item['voucher'] = {k: v for k, v in item['voucher'].items() if v is not None}
        items.append(item)
    batch = None
    if items:
        batch = {'id': base + '-journal', 'label': f'자동 출제 {label_date}', 'createdAt': created, 'generatedBy': by,
                 'selectionNote': selection_note, 'items': items}
    return {'id': base, 'pack': pack, 'journalBatch': batch, 'selectionNote': selection_note, 'withheld': withheld, 'counts': counts,
            'finalCounts': {'theory': len(questions), 'journal': len(items)}}


def examiner_job_view(job):
    if not job:
        return None
    view = {k: job.get(k) for k in ('id', 'phase', 'message', 'events', 'startedAt', 'finishedAt', 'counts', 'styles', 'registered')}
    if job.get('phase') == 'review':
        view['candidate'] = job.get('candidate')
    return view


def examiner_step(job, message):
    job['message'] = message
    job['events'] = (job.get('events') or [])[-14:] + [{'at': datetime.now().isoformat(timespec='seconds'), 'message': message}]


def codex_json(job, name, prompt, schema, effort='high'):
    """Codex를 비대화형으로 실행해 JSON 결과를 읽는다. 매번 새 대화(--ephemeral)이므로 두 번째 호출은 첫 번째의 정답을 모른다."""
    codex = find_codex()
    if not codex:
        raise ExaminerError('Codex가 설치되어 있지 않습니다.')
    schema_path = EXAMINER_WORK / f"{name}-schema-{job['id']}.json"
    result_path = EXAMINER_WORK / f"{name}-result-{job['id']}.json"
    (EXAMINER_WORK / f"{name}-prompt-{job['id']}.md").write_text(prompt, encoding='utf-8')
    schema_path.write_text(json.dumps(schema, ensure_ascii=False), encoding='utf-8')
    if result_path.exists():
        result_path.unlink()
    model = user_codex_model()
    for web in ('live', 'disabled'):
        args = [codex, 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only',
                '-c', 'features.shell_tool=false', '-c', 'features.apps=false', '-c', 'features.plugins=false',
                '-c', 'features.browser_use=false', '-c', 'features.computer_use=false', '-c', 'features.in_app_browser=false',
                '-c', f'web_search="{web}"', '-c', 'project_doc_max_bytes=0', '-c', f'model_reasoning_effort="{effort}"',
                *(['-m', model] if model else []),
                '--color', 'never', '--cd', str(EXAMINER_WORK), '--output-schema', str(schema_path),
                '--output-last-message', str(result_path), '-']
        process = subprocess.Popen(args, cwd=str(EXAMINER_WORK), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        job['process'] = process
        try:
            _, err = process.communicate(prompt.encode('utf-8'), timeout=EXAMINER_TIMEOUT)
        except subprocess.TimeoutExpired:
            process.kill()
            raise ExaminerError('출제 시간이 너무 오래 걸려 중단했습니다. 문항 수를 줄여 다시 시도해 주세요.')
        finally:
            job['process'] = None
        if job.get('cancelled'):
            raise ExaminerError('출제를 중단했습니다.')
        err_text = err.decode('utf-8', 'replace')
        (EXAMINER_WORK / f"{name}-stderr-{job['id']}.log").write_text(err_text[-20000:], encoding='utf-8')
        if process.returncode == 0:
            try:
                return json.loads(result_path.read_text(encoding='utf-8')), model
            except (OSError, ValueError):
                raise ExaminerError('Codex 결과를 읽지 못했습니다. 다시 시도해 주세요.')
        if web == 'live' and re.search(r'web_search|web search', err_text, re.I):
            examiner_step(job, '웹 검색 없이 다시 시도합니다.')
            continue
        if re.search(r'401|unauthori[sz]ed|not logged|please log ?in', err_text, re.I):
            raise ExaminerError('Codex 로그인이 필요합니다. 「AI 연결」을 눌러 ChatGPT 계정으로 로그인한 뒤 다시 시도해 주세요.')
        if re.search(r'hit your usage limit|usage limit|rate limit|quota', err_text[-3000:], re.I):
            again = re.search(r'try again at ([0-9: APMapm]+)', err_text[-3000:], re.I)
            raise ExaminerError('ChatGPT 계정의 Codex 사용 한도에 도달했습니다.' + (f' {again.group(1).strip()}에 다시 시도할 수 있습니다.' if again else ' 잠시 후 다시 시도해 주세요.'))
        raise ExaminerError('Codex 실행을 완료하지 못했습니다. ' + err_text.strip()[-300:])
    raise ExaminerError('Codex 실행을 완료하지 못했습니다.')


def run_examiner_job(job):
    try:
        EXAMINER_WORK.mkdir(parents=True, exist_ok=True)
        counts = job['counts']
        examiner_step(job, '출제 지침과 압축된 기출 분석을 모으고 있습니다.')
        analysis, practice, pilot, library, journal_library, brief = examiner_inputs()
        prompt = examiner_prompt(counts, job['styles'], analysis, practice, pilot, library, journal_library, brief)
        examiner_step(job, f'1/3 Codex가 후보를 구상하고 9개 기준으로 걸러 출제하고 있습니다. 보통 3~10분 걸립니다. (자료 {len(prompt):,}자)')
        result, model = codex_json(job, 'make', prompt, examiner_schema(analysis, practice))
        examiner_step(job, '2/3 형식·세액·차대변·근거 링크를 검사하고 있습니다.')
        theory, journal, rejected = check_candidate(result)
        for index, q in enumerate(theory, 1):
            q['_bid'] = f't{index}'
        for index, item in enumerate(journal, 1):
            item['_bid'] = f'j{index}'
        if theory or journal:
            examiner_step(job, f'3/3 다른 Codex 대화가 정답을 모른 채 {len(theory) + len(journal)}문항을 독립적으로 풀어 보고 있습니다.')
            solved, _ = codex_json(job, 'verify', blind_prompt(theory, journal), blind_schema(), effort='medium')
            theory, journal, mismatched = blind_verify(theory, journal, solved)
            rejected += mismatched
        final_theory, final_journal = select_final(counts, theory, journal)
        if not final_theory and not final_journal:
            raise ExaminerError('검수를 통과한 문항이 없습니다. 걸러진 이유: ' + ' / '.join(rejected[:4]))
        withheld = [*(result.get('withheld') or []), *rejected]
        job['candidate'] = shape_candidate(final_theory, final_journal, counts, job['styles'], model, result.get('selectionNote', ''), withheld)
        (EXAMINER_WORK / f"candidate-{job['id']}.json").write_text(json.dumps(job['candidate'], ensure_ascii=False, indent=2), encoding='utf-8')
        job['phase'] = 'review'
        wanted = counts['theory'] + counts['practical'] + counts['voucher']
        got = len(final_theory) + len(final_journal)
        examiner_step(job, f'{got}/{wanted}문항이 검수를 통과했습니다. 화면에서 최종 검사를 하고 있습니다.')
    except ExaminerError as error:
        job['phase'] = 'error'
        examiner_step(job, str(error))
        log(f'examiner error: {error}')
    except Exception as error:  # noqa: BLE001
        job['phase'] = 'error'
        examiner_step(job, f'출제 도중 오류가 났습니다: {error}')
        log(f'examiner unexpected: {error!r}')
    finally:
        job['finishedAt'] = datetime.now().isoformat(timespec='seconds')


def start_examiner_job(body):
    counts = {}
    for key in ('theory', 'practical', 'voucher'):
        try:
            counts[key] = int(body.get('counts', {}).get(key, 0))
        except (TypeError, ValueError):
            raise ExaminerError('문항 수를 확인해 주세요.')
        if not 0 <= counts[key] <= 4:
            raise ExaminerError('분야별 문항 수는 0~4개입니다.')
    total = sum(counts.values())
    if not 1 <= total <= 8:
        raise ExaminerError('한 번에 1~8문항까지 출제합니다. (권장 5~8문항)')
    styles = [s for s in body.get('styles', []) if s in EXAMINER_STYLES or s == '출제위원 랜덤'][:7] or ['출제위원 랜덤']
    with EXAMINER_STATE_LOCK:
        current = EXAMINER_STATE.get('job')
        if current and current.get('phase') == 'running':
            raise ExaminerError('이미 출제가 진행 중입니다. 끝난 뒤 다시 시도해 주세요.')
        job = {'id': short_id(), 'phase': 'running', 'message': '', 'events': [], 'counts': counts, 'styles': styles,
               'startedAt': datetime.now().isoformat(timespec='seconds'), 'finishedAt': None, 'registered': False}
        EXAMINER_STATE['job'] = job
    threading.Thread(target=run_examiner_job, args=(job,), daemon=True).start()
    return examiner_job_view(job)


def cancel_examiner_job():
    job = EXAMINER_STATE.get('job')
    if job and job.get('phase') == 'running':
        job['cancelled'] = True
        process = job.get('process')
        if process and process.poll() is None:
            process.kill()
    return examiner_job_view(job)


def write_js_array(path, name, header_lines, items):
    body = ',\n'.join(json.dumps(item, ensure_ascii=False, separators=(',', ':')) for item in items)
    text = '\n'.join(header_lines) + f'\nwindow.{name} = [\n' + body + ('\n' if body else '') + '];\n'
    temp = Path(str(path) + '.tmp')
    temp.write_text(text, encoding='utf-8', newline='\n')
    os.replace(temp, path)


def register_examiner_candidate(job_id):
    job = EXAMINER_STATE.get('job')
    if not job or job.get('id') != job_id or job.get('phase') != 'review' or not job.get('candidate'):
        raise ExaminerError('추가할 출제 결과가 없습니다. 다시 출제해 주세요.')
    candidate = job['candidate']
    backup = EXAMINER_WORK / 'backups'
    backup.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    added = {'theory': 0, 'journal': 0}
    if candidate.get('pack'):
        path = EXAMINER_DIR / 'library.js'
        shutil.copy2(path, backup / f'{stamp}-library.js')
        packs = read_js_value(path, 'ExaminerLibrary')
        if any(p.get('id') == candidate['pack']['id'] for p in packs):
            raise ExaminerError('이미 추가된 묶음입니다.')
        packs.append(candidate['pack'])
        write_js_array(path, 'ExaminerLibrary', ['// AI가 출제·검토한 새 묶음을 여기에 추가한다. 기존 ID와 내용은 보존한다.',
                                                 '// 문제를 풀 때 묶음의 사본도 학습 기록에 저장하여 이전 풀이를 유지한다.',
                                                 '// 자동 출제는 sync-helper.py가 화면 검사 통과 후 끝에 덧붙인다.'], packs)
        added['theory'] = len(candidate['pack']['questions'])
    if candidate.get('journalBatch'):
        path = EXAMINER_DIR / 'journal-library.js'
        shutil.copy2(path, backup / f'{stamp}-journal-library.js')
        batches = read_js_value(path, 'ExaminerJournalLibrary')
        if any(b.get('id') == candidate['journalBatch']['id'] for b in batches):
            raise ExaminerError('이미 추가된 전표 묶음입니다.')
        batches.append(candidate['journalBatch'])
        write_js_array(path, 'ExaminerJournalLibrary', ['// 자동 출제(동기화 도우미 → Codex) 또는 AI 채팅이 추가한 전표 문제 묶음. 시범 문제(journal-bank.js)는 바꾸지 않는다.',
                                                        '// 형식: [{"id":"ai-batch-…","label":"…","createdAt":"…","items":[전표 문제…]}]. 기존 묶음의 ID·내용은 바꾸지 않는다.'], batches)
        added['journal'] = len(candidate['journalBatch']['items'])
    job['registered'] = True
    job['phase'] = 'registered'
    examiner_step(job, f"이론 {added['theory']}문항, 전표 {added['journal']}문항을 추가했습니다.")
    log(f"examiner registered {candidate['id']}: {added}")
    return {'added': added, 'packId': (candidate.get('pack') or {}).get('id'), 'batchId': (candidate.get('journalBatch') or {}).get('id')}


def discard_examiner_candidate(job_id, reason=''):
    job = EXAMINER_STATE.get('job')
    if job and job.get('id') == job_id and job.get('phase') == 'review':
        job['phase'] = 'discarded'
        examiner_step(job, '출제 결과를 추가하지 않았습니다. ' + str(reason)[:300])
    return examiner_job_view(job)


class Handler(BaseHTTPRequestHandler):
    server_version = f'{HELPER_NAME}/{HELPER_VERSION}'

    def _examiner_origin_ok(self):
        origin = self.headers.get('Origin')
        return origin is None or bool(ALLOWED_ORIGIN.match(origin))

    def log_message(self, fmt, *args):
        pass

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        route = self.path.split('?')[0]
        if route == '/api/status':
            self._send(200, {
                'ok': True, 'helper': HELPER_NAME, 'version': HELPER_VERSION, 'season': SEASON,
                'programDir': str(PROGRAM_DIR), 'learningDir': str(LEARNING_DIR), 'examiner': True,
            })
            return
        if route.startswith('/api/examiner/'):
            if not self._examiner_origin_ok():
                self._send(403, {'ok': False, 'message': '허용되지 않은 화면의 요청입니다.'})
                return
            if route == '/api/examiner/status':
                self._send(200, {'ok': True, **codex_status(), 'model': user_codex_model(),
                                 'job': examiner_job_view(EXAMINER_STATE.get('job'))})
                return
            if route == '/api/examiner/job':
                self._send(200, {'ok': True, 'job': examiner_job_view(EXAMINER_STATE.get('job'))})
                return
        self._send(404, {'ok': False, 'message': '알 수 없는 요청입니다.'})

    def _read_json(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode('utf-8'))
        except ValueError:
            raise GitError('요청 내용을 읽지 못했습니다.')

    def do_POST(self):
        route = self.path.split('?')[0]
        if route.startswith('/api/examiner/'):
            self._examiner_post(route)
            return
        try:
            body = self._read_json()
            with LOCK:
                if route == '/api/sync/program':
                    result = sync_program()
                    log(f"program: {result['message']}")
                    self._send(200, {'ok': True, **result})
                elif route == '/api/learning/read':
                    self._send(200, {'ok': True, **read_learning_state()})
                elif route == '/api/learning/write':
                    result = write_learning_state(body.get('state'), body.get('base'))
                    log('learning-state saved')
                    self._send(200, {'ok': True, **result})
                elif route == '/api/record':
                    result = write_record(str(body.get('path') or ''), str(body.get('content') or ''))
                    log(f"record saved: {result['path']}")
                    self._send(200, {'ok': True, **result})
                else:
                    self._send(404, {'ok': False, 'message': '알 수 없는 요청입니다.'})
        except SyncConflict as error:
            log(f'conflict {route}: {error}')
            self._send(409, {'ok': False, 'conflict': True, 'message': str(error)})
        except GitError as error:
            log(f'error {route}: {error}')
            self._send(500, {'ok': False, 'message': str(error)})
        except Exception as error:  # noqa: BLE001
            log(f'unexpected {route}: {error!r}')
            self._send(500, {'ok': False, 'message': f'도우미 내부 오류: {error}'})

    def _examiner_post(self, route):
        if not self._examiner_origin_ok():
            self._send(403, {'ok': False, 'message': '허용되지 않은 화면의 요청입니다.'})
            return
        if 'application/json' not in (self.headers.get('Content-Type') or ''):
            self._send(415, {'ok': False, 'message': 'JSON 요청만 받습니다.'})
            return
        try:
            body = self._read_json()
            if route == '/api/examiner/generate':
                self._send(200, {'ok': True, 'job': start_examiner_job(body)})
            elif route == '/api/examiner/cancel':
                self._send(200, {'ok': True, 'job': cancel_examiner_job()})
            elif route == '/api/examiner/login':
                codex_login()
                self._send(200, {'ok': True})
            elif route == '/api/examiner/register':
                # 저장 중에 「동기화」가 커밋하지 않도록 git 작업과 같은 잠금을 쓴다.
                with LOCK:
                    result = register_examiner_candidate(str(body.get('jobId') or ''))
                self._send(200, {'ok': True, **result})
            elif route == '/api/examiner/discard':
                self._send(200, {'ok': True, 'job': discard_examiner_candidate(str(body.get('jobId') or ''), body.get('reason') or '')})
            else:
                self._send(404, {'ok': False, 'message': '알 수 없는 요청입니다.'})
        except (ExaminerError, GitError) as error:
            log(f'examiner {route}: {error}')
            self._send(400, {'ok': False, 'message': str(error)})
        except Exception as error:  # noqa: BLE001
            log(f'examiner unexpected {route}: {error!r}')
            self._send(500, {'ok': False, 'message': f'도우미 내부 오류: {error}'})


def port_in_use():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        return probe.connect_ex(('127.0.0.1', PORT)) == 0


def main():
    if port_in_use():
        return 0
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    server.daemon_threads = True
    log(f'helper started on 127.0.0.1:{PORT} (program={PROGRAM_DIR}, learning={LEARNING_DIR})')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        log('helper stopped')
    return 0


if __name__ == '__main__':
    sys.exit(main())
