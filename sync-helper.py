# -*- coding: utf-8 -*-
"""전산회계 1급 오답 훈련센터 · PC 동기화 도우미

PC에서 오답 훈련센터 화면의 「동기화」 버튼을 누르면 이 프로그램이 대신 git 작업을 처리한다.

- 문제·프로그램 저장소(이 폴더): 변경 사항 커밋 → GitHub 최신 내려받기 → GitHub에 올리기
- 학습기록 저장소(또 틀렸다!/GitHub학습기록 폴더에 자동 복제): 학습상태 JSON과 오늘 학습기록 Markdown 저장·올리기

토큰은 필요 없다. PC에 이미 저장된 GitHub 로그인(Git Credential Manager)을 그대로 사용한다.
127.0.0.1(내 PC 안)에서만 요청을 받으므로 외부에서는 접근할 수 없다.
"""
import hashlib
import json
import os
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HELPER_NAME = 'tax-accounting-sync-helper'
HELPER_VERSION = 1
PORT = int(os.environ.get('TAX_SYNC_PORT', '8790'))

BASE_DIR = Path(os.environ.get('TAX_SYNC_PROGRAM_DIR') or Path(__file__).resolve().parent)
PROGRAM_DIR = BASE_DIR
PROGRAM_REMOTE = os.environ.get('TAX_SYNC_PROGRAM_REMOTE') or 'https://github.com/Park-hyojoon/tax-accounting-wrong-answer-center.git'
LEARNING_DIR = Path(os.environ.get('TAX_SYNC_LEARNING_DIR') or (BASE_DIR / '또 틀렸다!' / 'GitHub학습기록'))
LEARNING_REMOTE = os.environ.get('TAX_SYNC_LEARNING_REMOTE') or 'https://github.com/Park-hyojoon/tax-accounting-learning-sync.git'
BRANCH = 'main'
LEARNING_STATE_PATH = 'sync/learning-state.json'
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
        git(LEARNING_DIR, 'reset', '--hard', f'origin/{BRANCH}')
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
        git(LEARNING_DIR, 'reset', '--hard', f'origin/{BRANCH}')
        raise
    return True


def write_learning_state(state, base):
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
        git(LEARNING_DIR, 'reset', '--hard', f'origin/{BRANCH}')
    write_learning_files({relative: content}, f'학습기록 저장: {relative}')
    return {'path': relative, 'localPath': str(LEARNING_DIR / relative)}


class Handler(BaseHTTPRequestHandler):
    server_version = f'{HELPER_NAME}/{HELPER_VERSION}'

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
        if self.path.split('?')[0] == '/api/status':
            self._send(200, {
                'ok': True, 'helper': HELPER_NAME, 'version': HELPER_VERSION,
                'programDir': str(PROGRAM_DIR), 'learningDir': str(LEARNING_DIR),
            })
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
