#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""오답 훈련센터 작업 도구 (Python 3만 사용, Node 불필요)

AI가 문제를 추가할 때 90KB짜리 HTML을 통째로 읽지 않도록 만든 도구다.
큰 파일 읽기 대신 아래 명령으로 필요한 조각만 얻고, 삽입은 도구가 처리한다.

  python training-tool.py info                 분야별 문제 수·다음 인덱스·스크립트 버전·원장 요약
  python training-tool.py sample practical      그 분야 마지막 문제 + 홈 META 행 (새 문제 작성 템플릿)
  python training-tool.py sample practical 2    마지막 2개를 보고 싶을 때
  python training-tool.py mistakes              직접 접수 원장 요약(유형별 건수) - 41KB 원장 대신 읽는다
  python training-tool.py mistakes foreign-exchange   그 유형의 원문 단서·학습자 설명
  python training-tool.py check                 문제·홈META·원장·버전 정합성 검사
  python training-tool.py add spec.json         문제와 원장 항목을 한 번에 삽입
  python training-tool.py bump mistake-intake-data.js   해당 스크립트를 불러오는 화면의 ?v=N 증가

subject 값: practical(일반전표) theory(이론) closing(결산) voucher(매입매출전표)
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HUB = '오답_훈련센터.html'
LEDGER = 'mistake-intake-data.js'
VERSION_FILE = 'program-version.json'

# 홈 META 행의 자리 배치는 오답_훈련센터.html의 META map 코드와 같아야 한다.
SUBJECTS = {
    'practical': dict(label='일반전표', file='일반전표_기본연습_24문제.html',
                      meta='practicalMeta', type_idx=0, title_idx=1, id_kind='index'),
    'theory': dict(label='이론', file='이론_오답응용_5문제.html',
                   meta='theoryMeta', type_idx=1, title_idx=2, id_kind='string'),
    'closing': dict(label='결산', file='결산정리사항_연습_7문제.html',
                    meta='closingMeta', type_idx=1, title_idx=2, id_kind='index'),
    'voucher': dict(label='매입매출전표', file='매입매출전표_오답연습_3문제.html',
                    meta='voucherMeta', type_idx=0, title_idx=1, id_kind='index'),
}
PAGES = [HUB] + [s['file'] for s in SUBJECTS.values()]
SHARED_SCRIPTS = ['github-learning-sync.js', 'training-ui.js', 'account-search.js',
                  LEDGER, 'mistake-memory.js']


# ── 파일 입출력 (줄바꿈 형식 보존) ──────────────────────────────────────────
def read(name):
    with open(ROOT / name, encoding='utf-8', newline='') as f:
        return f.read()


def write(name, text):
    with open(ROOT / name, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def nl_of(text):
    return '\r\n' if '\r\n' in text else '\n'


# ── JS 배열 자르기 ──────────────────────────────────────────────────────────
def match_close(text, open_index):
    """여는 괄호 위치를 받아 짝이 되는 닫는 괄호 위치를 돌려준다(문자열 안은 무시)."""
    depth = 0
    quote = None
    escaped = False
    for i in range(open_index, len(text)):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in '"\'`':
            quote = ch
        elif ch in '[{(':
            depth += 1
        elif ch in ']})':
            depth -= 1
            if depth == 0:
                return i
    return -1


def find_array(text, start_pattern, label):
    """start_pattern 은 여는 '[' 까지 매치해야 한다. (본문시작, 닫는괄호위치, 닫는괄호+1)"""
    head = re.search(start_pattern, text)
    if not head:
        raise SystemExit(f'[오류] {label}: 배열 시작을 찾지 못했습니다 ({start_pattern})')
    close = match_close(text, head.end() - 1)
    if close < 0:
        raise SystemExit(f'[오류] {label}: 배열을 닫는 "]" 를 찾지 못했습니다')
    return head.end(), close, close + 1


def split_items(body, open_ch):
    """문자열 안의 괄호를 무시하고 최상위 항목 범위를 돌려준다."""
    spans = []
    depth = 0
    start = None
    quote = None
    escaped = False
    for i, ch in enumerate(body):
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in '"\'`':
            quote = ch
            continue
        if ch in '[{(':
            if depth == 0 and ch == open_ch:
                start = i
            depth += 1
        elif ch in ']})':
            depth -= 1
            if depth == 0 and start is not None:
                spans.append((start, i + 1))
                start = None
    return spans


def field(text, key):
    m = re.search(r"(?<![A-Za-z0-9_])" + key + r"\s*:\s*'((?:[^'\\]|\\.)*)'", text)
    if m:
        return m.group(1)
    m = re.search(r"(?<![A-Za-z0-9_])" + key + r"\s*:\s*\"((?:[^\"\\]|\\.)*)\"", text)
    if m:
        return m.group(1)
    m = re.search(r"(?<![A-Za-z0-9_])" + key + r"\s*:\s*(\d+)", text)
    return m.group(1) if m else None


def top_keys(obj_text):
    """객체 리터럴의 최상위 키 이름들 (문자열·중첩 구조는 건너뛴다)."""
    keys = []
    depth = 0
    quote = None
    escaped = False
    buf = ''
    for ch in obj_text.strip()[1:-1]:
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in '"\'`':
            quote = ch
            continue
        if ch in '[{(':
            depth += 1
        elif ch in ']})':
            depth -= 1
        elif depth == 0:
            if ch == ',':
                buf = ''
            elif ch == ':':
                name = buf.strip()
                if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', name):
                    keys.append(name)
                buf = ''
            else:
                buf += ch
    return keys


def row_strings(row_text):
    """META 한 행 ['a','b',...] 의 문자열 값들"""
    return re.findall(r"'((?:[^'\\]|\\.)*)'", row_text)


def problems_of(subject, text=None):
    """배열 리터럴의 문제 + 뒤따르는 problems.push(...) 안의 문제를 등록 순서대로 모은다."""
    info = SUBJECTS[subject]
    text = read(info['file']) if text is None else text
    b, e, _ = find_array(text, r'(?:const|let)\s+problems\s*=\s*\[', info['label'])
    body = text[b:e]
    items = [body[s:t] for s, t in split_items(body, '{')]
    # 소스에 나온 순서대로 splice/push 를 그대로 재현해야 화면과 인덱스가 같아진다.
    for m in re.finditer(r'problems\.(push|splice)\s*\(', text):
        close = match_close(text, m.end() - 1)
        if close < 0:
            continue
        inner = text[m.end():close]
        if m.group(1) == 'push':
            items += [inner[s:t] for s, t in split_items(inner, '{')]
            continue
        args = re.match(r'\s*(\d+)\s*,\s*(\d+)\s*,', inner)
        if not args:
            continue
        at = int(args.group(1))
        rest = inner[args.end():]
        items[at:at] = [rest[s:t] for s, t in split_items(rest, '{')]
    return items


def last_push_end(text):
    """마지막 problems.push(...) 문장의 끝 위치(세미콜론 포함). 없으면 -1"""
    last = -1
    for m in re.finditer(r'problems\.push\s*\(', text):
        close = match_close(text, m.end() - 1)
        if close < 0:
            continue
        tail = close + 1
        if tail < len(text) and text[tail] == ';':
            tail += 1
        last = max(last, tail)
    return last


def meta_rows(subject, hub_text=None):
    info = SUBJECTS[subject]
    text = hub_text if hub_text is not None else read(HUB)
    b, e, _ = find_array(text, r'const\s+' + info['meta'] + r'\s*=\s*\[', info['meta'])
    body = text[b:e]
    return [body[s:t] for s, t in split_items(body, '[')]


def script_versions():
    found = {}
    for page in PAGES:
        text = read(page)
        for script in SHARED_SCRIPTS:
            m = re.search(re.escape(script) + r'\?v=(\d+)', text)
            if m:
                found.setdefault(script, {})[page] = m.group(1)
    return found


def ledger_entries():
    text = read(LEDGER)
    b, e, _ = find_array(text, r'\bentries\s*:\s*\[', '원장 entries')
    body = text[b:e]
    return [body[s:t] for s, t in split_items(body, '{')]


def direct_intake_indices(entries=None):
    """확인된 사용자 직접 제출 원장에 정확히 연결된 숫자형 문제 인덱스."""
    result = {'practical': set(), 'voucher': set()}
    for entry in entries if entries is not None else ledger_entries():
        if field(entry, 'source') != 'user-submitted' or field(entry, 'evidenceStatus') != 'confirmed' or field(entry, 'duplicateOf'):
            continue
        for source, raw_id in re.findall(r"source\s*:\s*'(practical|voucher)'\s*,\s*id\s*:\s*(\d+)", entry):
            result[source].add(int(raw_id))
    return result


def sync_direct_intake_sets():
    """분야 화면의 경량 직접제출 목록을 원장 practiceRefs와 맞춘다."""
    expected = direct_intake_indices()
    pattern = r'const\s+DIRECT_INTAKE_INDICES\s*=\s*new\s+Set\s*\(\s*\[[^\]]*\]\s*\)\s*;'
    for subject, indices in expected.items():
        filename = SUBJECTS[subject]['file']
        text = read(filename)
        replacement = 'const DIRECT_INTAKE_INDICES=new Set([' + ','.join(map(str, sorted(indices))) + ']);'
        text, count = re.subn(pattern, replacement, text, count=1)
        if count != 1:
            raise SystemExit(f'[오류] {filename}: DIRECT_INTAKE_INDICES 선언을 찾지 못했습니다')
        write(filename, text)


# ── 삽입 ────────────────────────────────────────────────────────────────────
def insert_into_array(text, start_pattern, snippet, label):
    """배열의 마지막 항목 뒤에 snippet 을 새 줄로 넣는다. 닫는 괄호 들여쓰기는 그대로 둔다."""
    nl = nl_of(text)
    _, close, _ = find_array(text, start_pattern, label)
    head, tail = text[:close], text[close:]
    stripped = head.rstrip()
    ws = head[len(stripped):] or nl
    item = snippet.strip()
    if not item.startswith((' ', '\t')):
        indent = re.search(r'[ \t]*$', ws)
        item = (indent.group(0) + '  ' if indent else '  ') + item
    if not stripped.endswith('['):
        if not stripped.endswith(','):
            stripped += ','
    return stripped + nl + item + ws + tail


def append_push(text, snippet, nl=None):
    """problems.push(...) 방식 파일에서 마지막 push 뒤에 새 push 를 넣는다."""
    nl = nl or nl_of(text)
    end = last_push_end(text)
    if end < 0:
        return None
    item = snippet.strip()
    return text[:end] + nl + f'problems.push({item});' + text[end:]


def bump_version(script, pages=None):
    """해당 스크립트를 실제로 불러오는 화면의 <script src="파일?v=N"> 을 함께 올린다."""
    pages = pages or PAGES
    numbers = []
    page_text = {}
    for page in pages:
        text = read(page)
        page_text[page] = text
        for m in re.finditer(re.escape(script) + r'\?v=(\d+)', text):
            numbers.append(int(m.group(1)))
    if not numbers:
        return None
    nxt = max(numbers) + 1
    for page, text in page_text.items():
        new = re.sub(re.escape(script) + r'\?v=\d+', f'{script}?v={nxt}', text)
        if new != text:
            write(page, new)
    return nxt


def bump_program_version(note=''):
    path = ROOT / VERSION_FILE
    data = json.loads(path.read_text(encoding='utf-8'))
    data['revision'] = int(data.get('revision', 0)) + 1
    data['updatedAt'] = datetime.now().astimezone().replace(microsecond=0).isoformat()
    if note:
        data['note'] = note
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data['revision']


# ── 명령: info ──────────────────────────────────────────────────────────────
def cmd_info():
    print('# 오답 훈련센터 현재 상태\n')
    total = 0
    hub_text = read(HUB)
    print('| 분야 | 문제 | 홈 META | 다음 추가 위치 |')
    print('|---|---:|---:|---|')
    for key, info in SUBJECTS.items():
        items = problems_of(key)
        rows = meta_rows(key, hub_text)
        total += len(items)
        nxt = f'인덱스 {len(items)}' if info['id_kind'] == 'index' else '새 문자열 id'
        print(f"| {info['label']}({key}) | {len(items)} | {len(rows)} | {nxt} |")
    print(f'\n핵심 문제 합계: {total}개\n')

    print('## 스크립트 버전과 로딩 화면 수')
    for script, pages in script_versions().items():
        vs = sorted(set(pages.values()))
        mark = '' if len(vs) == 1 else '  <- 화면마다 다름! bump 필요'
        print(f'- {script}: v={",".join(vs)} · {len(pages)}/{len(PAGES)}화면{mark}')

    entries = ledger_entries()
    text = read(LEDGER)
    rev = field(text, 'revision')
    confirmed = [e for e in entries if (field(e, 'evidenceStatus') or 'confirmed') == 'confirmed']
    print(f'\n## 직접 접수 원장\n- 파일: {LEDGER} (revision {rev})')
    print(f'- 전체 접수 {len(entries)}건 / 확인 {len(confirmed)}건')
    ver = json.loads((ROOT / VERSION_FILE).read_text(encoding='utf-8'))
    print(f"- program-version revision {ver.get('revision')} ({ver.get('updatedAt','')[:16]})")


# ── 명령: mistakes ──────────────────────────────────────────────────────────
def cmd_mistakes(topic_filter=None):
    """41KB 원장을 통째로 읽지 않고 유형별 요약만 본다."""
    text = read(LEDGER)
    b, e, _ = find_array(text, r'\btopics\s*:\s*\[', '원장 topics')
    labels = {}
    for s, t in split_items(text[b:e], '{'):
        chunk = text[b:e][s:t]
        labels[field(chunk, 'id')] = field(chunk, 'label')
    entries = ledger_entries()

    groups = {}
    for entry in entries:
        if (field(entry, 'evidenceStatus') or 'confirmed') != 'confirmed':
            continue
        groups.setdefault(field(entry, 'topicId') or '(미분류)', []).append(entry)

    if topic_filter:
        rows = groups.get(topic_filter)
        if not rows:
            raise SystemExit(f'그런 topicId 가 없습니다: {topic_filter}\n'
                             f'가능한 값: {", ".join(sorted(groups))}')
        print(f"# {topic_filter} · {labels.get(topic_filter, '')} ({len(rows)}건)\n")
        for entry in rows:
            print(f"## {field(entry, 'title')}")
            for key, name in (('reportedAt', '전달일'), ('registeredDate', '등록일'),
                              ('learnerReason', '학습자 설명'), ('originalCue', '원문 단서')):
                value = field(entry, key)
                if value:
                    print(f'- {name}: {value}')
            refs = re.findall(r"type\s*:\s*'([^']*)'", entry)
            if refs:
                print(f"- 연결 문제 유형: {', '.join(refs)}")
            print()
        return

    print(f'# 직접 접수 오답 원장 요약 (확인 {sum(len(v) for v in groups.values())}건 / '
          f'유형 {len(groups)}개)\n')
    print('| 건수 | topicId | 유형 | 학습자가 이유를 밝힌 건 |')
    print('|---:|---|---|---:|')
    for topic, rows in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        told = sum(1 for r in rows if field(r, 'learnerReason'))
        print(f"| {len(rows)} | {topic} | {labels.get(topic, '')} | {told} |")
    print('\n자세히 보려면: python training-tool.py mistakes <topicId>')
    print('새 오답을 넣기 전에 같은 topicId 의 과거 접수를 먼저 확인한다.')


# ── 명령: sample ────────────────────────────────────────────────────────────
def cmd_sample(subject, count=1):
    if subject not in SUBJECTS:
        raise SystemExit(f'[오류] subject 는 {", ".join(SUBJECTS)} 중 하나여야 합니다')
    info = SUBJECTS[subject]
    items = problems_of(subject)
    rows = meta_rows(subject)
    count = max(1, min(count, len(items)))
    print(f"# {info['label']} 마지막 {count}개 (새 문제 작성 템플릿)\n")
    print(f"현재 {len(items)}문제. 새 문제는 배열 맨 뒤에 추가하며 "
          f"{'다음 인덱스는 ' + str(len(items)) if info['id_kind'] == 'index' else '새 문자열 id 를 부여'}.\n")
    print('## 문제 객체')
    for item in items[-count:]:
        print(item.strip())
    print('\n## 홈 META 행 (오답_훈련센터.html · ' + info['meta'] + ')')
    for row in rows[-count:]:
        print(row.strip())
    print('\n## 추가 방법')
    print('spec.json 을 만들고  python training-tool.py add spec.json  을 실행하면')
    print('문제·홈 META·원장·버전을 한 번에 넣는다. 큰 HTML을 열 필요가 없다.')


# ── 명령: check ─────────────────────────────────────────────────────────────
def cmd_check():
    problems_fail = []
    warn = []
    hub_text = read(HUB)
    problem_cache = {}

    for key, info in SUBJECTS.items():
        items = problems_of(key)
        problem_cache[key] = items
        rows = meta_rows(key, hub_text)
        if len(items) != len(rows):
            problems_fail.append(
                f"{info['label']}: 문제 {len(items)}개 vs 홈 META {len(rows)}행 (개수 불일치)")
        ids = [field(x, 'id') for x in items]
        real = [i for i in ids if i]
        dup = {i for i in real if real.count(i) > 1}
        if dup:
            problems_fail.append(f"{info['label']}: 중복 id {sorted(dup)}")
        # type 문자열이 분야와 홈에서 같은지
        for idx in range(min(len(items), len(rows))):
            ptype = field(items[idx], 'type')
            strings = row_strings(rows[idx])
            mtype = strings[info['type_idx']] if len(strings) > info['type_idx'] else None
            if ptype and mtype and ptype != mtype:
                problems_fail.append(
                    f"{info['label']} {idx}번: type 불일치 (문제 '{ptype}' vs 홈 '{mtype}')")
        # 필수 필드 누락: 그 분야 모든 문제가 갖고 있는 키가 빠지면 화면이 깨진다.
        if len(items) > 3:
            key_sets = [set(top_keys(x)) for x in items]
            common = set.intersection(*key_sets[:-1]) if len(key_sets) > 1 else set()
            for idx, ks in enumerate(key_sets):
                if 'hint' in ks:
                    problems_fail.append(
                        f"{info['label']} {idx}번: 사용하지 않는 hint 필드는 넣지 않습니다")
                missing = sorted(common - ks)
                if missing:
                    problems_fail.append(
                        f"{info['label']} {idx}번: 필수 필드 누락 {missing} (다른 문제에는 모두 있음)")
        # variantOf 유효성
        for idx, item in enumerate(items):
            raw = re.search(r"variantOf\s*:\s*('([^']*)'|\d+)", item)
            if not raw:
                continue
            if info['id_kind'] == 'index':
                if raw.group(2) is not None:
                    problems_fail.append(f"{info['label']} {idx}번: variantOf 는 숫자 인덱스여야 합니다")
                elif int(raw.group(1)) >= len(items):
                    problems_fail.append(f"{info['label']} {idx}번: variantOf 인덱스 범위 초과")
            else:
                if raw.group(2) is None:
                    problems_fail.append(f"{info['label']} {idx}번: 이론 variantOf 는 원문제 id 문자열이어야 합니다")
                elif raw.group(2) not in real:
                    problems_fail.append(f"{info['label']} {idx}번: variantOf id '{raw.group(2)}' 없음")

    # 스크립트 버전이 다섯 화면에서 같은지
    versions = script_versions()
    for script, pages in versions.items():
        version_values = set(pages.values())
        if len(version_values) > 1:
            detail = ', '.join(f'{p}=v{v}' for p, v in pages.items())
            problems_fail.append(f'{script}: 화면마다 버전이 다름 ({detail})')

    # 원장 43KB + 분석기 11KB는 TOP 5가 있는 홈에서만 필요하다.
    # 분야 화면에 다시 넣으면 문제를 열 때마다 같은 데이터를 중복 로드한다.
    for script in (LEDGER, 'mistake-memory.js'):
        loaded = set(versions.get(script, {}))
        if loaded != {HUB}:
            problems_fail.append(
                f"{script}: 홈에서만 불러와야 합니다 (현재 {', '.join(sorted(loaded)) or '없음'})")

    # 원장
    entries = ledger_entries()
    ids = [field(e, 'id') for e in entries]
    real_ids = [i for i in ids if i]
    dup = {i for i in real_ids if real_ids.count(i) > 1}
    if dup:
        problems_fail.append(f'원장: 중복 사건 id {sorted(dup)}')
    all_types = {}
    for key in SUBJECTS:
        all_types[key] = {field(x, 'type') for x in problem_cache[key]}
    for entry in entries:
        eid = field(entry, 'id') or '?'
        for ref in re.findall(r"\{[^{}]*?type\s*:\s*'([^']*)'[^{}]*?\}", entry):
            if not any(ref in types for types in all_types.values()):
                warn.append(f"원장 {eid}: practiceRefs type '{ref}' 이 현재 문제에 없음(삭제되었을 수 있음)")

    # 일반전표·매입매출전표 기본 목록은 확인된 직접 제출 문제만 노출한다.
    expected_direct = direct_intake_indices(entries)
    for subject, expected in expected_direct.items():
        filename = SUBJECTS[subject]['file']
        m = re.search(r'const\s+DIRECT_INTAKE_INDICES\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]\s*\)\s*;', read(filename))
        if not m:
            problems_fail.append(f'{filename}: DIRECT_INTAKE_INDICES 선언 누락')
            continue
        actual = {int(x) for x in re.findall(r'\d+', m.group(1))}
        if actual != expected:
            problems_fail.append(f'{filename}: 사용자 직접 제출 문제 목록이 원장 practiceRefs와 다름')

    print('# 정합성 검사 결과\n')
    if problems_fail:
        print(f'## 실패 {len(problems_fail)}건')
        for line in problems_fail:
            print(f'- {line}')
    else:
        print('## 실패 없음')
    if warn:
        print(f'\n## 참고 {len(warn)}건')
        for line in warn[:10]:
            print(f'- {line}')
        if len(warn) > 10:
            print(f'- ... 외 {len(warn) - 10}건')
    print('\n(일상 문제 등록은 이 파이썬 검사만으로 끝내며 Node·브라우저 검사는 실행하지 않는다)')
    return 1 if problems_fail else 0


# ── 명령: add ───────────────────────────────────────────────────────────────
def cmd_add(spec_path):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    items = spec.get('items') or []
    mistakes = spec.get('mistakes') or []
    if not items and not mistakes:
        raise SystemExit('[오류] spec 에 items 또는 mistakes 가 없습니다')

    grouped = {}
    for item in items:
        subject = item['subject']
        if subject not in SUBJECTS:
            raise SystemExit(f"[오류] 알 수 없는 subject: {subject}")
        grouped.setdefault(subject, []).append(item)

    added = {}
    changed_subjects = {}
    hub = read(HUB)
    for subject, subject_items in grouped.items():
        info = SUBJECTS[subject]
        text = read(info['file'])
        for item in subject_items:
            # push 방식 파일은 맨 뒤 push, 나머지는 배열 끝에 붙여 인덱스를 보존한다.
            pushed = append_push(text, item['problem'])
            text = pushed if pushed else insert_into_array(
                text, r'(?:const|let)\s+problems\s*=\s*\[', item['problem'], info['label'])
            hub = insert_into_array(hub, r'const\s+' + info['meta'] + r'\s*=\s*\[',
                                    item['meta'], info['meta'])
        changed_subjects[info['file']] = text
        added[subject] = len(subject_items)

    for filename, text in changed_subjects.items():
        write(filename, text)
    if items:
        write(HUB, hub)

    ledger_rev = None
    if mistakes:
        text = read(LEDGER)
        for entry in mistakes:
            text = insert_into_array(text, r'\bentries\s*:\s*\[', entry, '원장 entries')
        m = re.search(r'(revision\s*:\s*)(\d+)', text)
        if m:
            ledger_rev = int(m.group(2)) + 1
            text = text[:m.start()] + f'{m.group(1)}{ledger_rev}' + text[m.end():]
        write(LEDGER, text)
        new_v = bump_version(LEDGER)
        print(f'- 원장 {len(mistakes)}건 추가, revision {ledger_rev}, {LEDGER}?v={new_v}')

    if items or mistakes:
        sync_direct_intake_sets()

    rev = bump_program_version(spec.get('note', ''))
    for subject, n in added.items():
        print(f"- {SUBJECTS[subject]['label']} 문제 {n}개 추가 (현재 {len(problems_of(subject))}개)")
    print(f'- program-version revision {rev}')
    print()
    return cmd_check()


# ── 진입점 ──────────────────────────────────────────────────────────────────
def main(argv):
    if not argv or argv[0] in ('-h', '--help', 'help'):
        print(__doc__)
        return 0
    cmd = argv[0]
    if cmd == 'info':
        cmd_info()
        return 0
    if cmd == 'sample':
        if len(argv) < 2:
            raise SystemExit('사용법: python training-tool.py sample <subject> [개수]')
        return cmd_sample(argv[1], int(argv[2]) if len(argv) > 2 else 1) or 0
    if cmd == 'mistakes':
        cmd_mistakes(argv[1] if len(argv) > 1 else None)
        return 0
    if cmd == 'check':
        return cmd_check()
    if cmd == 'add':
        if len(argv) < 2:
            raise SystemExit('사용법: python training-tool.py add spec.json')
        return cmd_add(argv[1])
    if cmd == 'bump':
        if len(argv) < 2:
            raise SystemExit('사용법: python training-tool.py bump <스크립트파일>')
        v = bump_version(argv[1])
        print(f'{argv[1]}?v={v} 로 해당 로딩 화면을 맞췄습니다' if v else '해당 스크립트 태그를 찾지 못했습니다')
        return 0
    raise SystemExit(f'알 수 없는 명령: {cmd}\n{__doc__}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
