# -*- coding: utf-8 -*-
"""tests/examiner-auto-e2e.py 전용 가짜 Codex. 실제 Codex나 ChatGPT 사용량을 쓰지 않는다.
실행 인자(--output-schema, --output-last-message)를 읽고, 출제 단계에는 준비된 후보를, 재풀이 단계에는 후보를 풀어 쓴 답을 돌려준다.
후보 1: 정상. 후보 2: 형식 오류(도우미가 걸러야 함). 후보 3: 정답 불일치(독립 재풀이가 걸러야 함).
"""
import copy
import glob
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
args = sys.argv[1:]
if args[:2] == ['login', 'status']:
    print('Logged in using ChatGPT')
    sys.exit(0)


def option(name):
    return args[args.index(name) + 1]


schema = json.load(open(option('--output-schema'), encoding='utf-8'))
out = option('--output-last-message')
prompt = sys.stdin.buffer.read().decode('utf-8')
work = os.path.dirname(out)
review = {k: '통과: 검토' for k in ['copy', 'textbook', 'sentence', 'choices', 'peripheral', 'absence', 'exception', 'surprise', 'forced']}

THEORY = {'title': '두 거래의 판단', 'area': '회계원리', 'conceptIds': ['securities'], 'styles': ['함정형'], 'prompt': '다음 중 옳은 것은? [정상]', 'table': None,
          'choices': ['첫째 설명', '둘째 설명', '셋째 설명', '넷째 설명'], 'answer': 1, 'explanation': '해설', 'distractorReasons': ['a', 'b', 'c', 'd'],
          'intent': '의도', 'trap': '함정', 'novelty': '차이', 'calculationLoad': '없음', 'sourceRefs': ['r126-theory-7'], 'basis': '근거', 'references': [],
          'boundary': '범위', 'review': review}


def voucher(prompt_text, vat=200000):
    return {'kind': 'voucher', 'title': '제품 인도 ' + prompt_text[-6:], 'prompt': prompt_text, 'exhibit': None,
            'voucher': {'date': '2026-10-15', 'type': '11.과세', 'supply': 2000000, 'vat': vat, 'supplier': '㈜은솔', 'electronic': '여', 'journal': '혼합',
                        'cardCompany': None, 'zeroRateType': None, 'deductReason': None},
            'rows': [{'side': 'D', 'account': '보통예금', 'amount': 2000000 + vat, 'division': '', 'partner': ''},
                     {'side': 'C', 'account': '제품매출', 'amount': 2000000, 'division': '', 'partner': ''},
                     {'side': 'C', 'account': '부가세예수금', 'amount': vat, 'division': '', 'partner': ''}],
            'explanation': '해설', 'styles': ['기출 변형'], 'conceptIds': ['pr-card'], 'intent': 'a', 'trap': 'b', 'novelty': 'c',
            'calculationLoad': '단순 가감', 'sourceRefs': [], 'basis': '근거', 'boundary': '범위', 'review': review}


def practical(prompt_text):
    return {'kind': 'practical', 'title': '외상대금 회수 ' + prompt_text[-6:], 'prompt': prompt_text, 'exhibit': None, 'voucher': None,
            'rows': [{'side': 'D', 'account': '보통예금', 'amount': 500000, 'division': '', 'partner': ''},
                     {'side': 'C', 'account': '외상매출금', 'amount': 500000, 'division': '', 'partner': '㈜푸른상회'}],
            'explanation': '해설', 'styles': ['기출 변형'], 'conceptIds': ['pr-notes'], 'intent': 'a', 'trap': 'b', 'novelty': 'c',
            'calculationLoad': '없음', 'sourceRefs': [], 'basis': '근거', 'boundary': '범위', 'review': review}


if 'selectionNote' in schema['properties']:
    bad_theory = copy.deepcopy(THEORY)
    bad_theory.update(title='선택지가 겹치는 문항', choices=['같다', '같다', '다르다', '또 다르다'], prompt='다음 중 옳은 것은? [형식오류]')
    result = {'selectionNote': '후보 6개 중 형식·정답 문제가 있는 후보를 걸렀다.', 'withheld': [],
              'theory': [copy.deepcopy(THEORY), bad_theory],
              'journal': [practical('외상대금 500,000원을 보통예금으로 회수하였다. [MISMATCH]'), practical('외상대금 500,000원을 보통예금으로 회수하였다. [정상]'),
                          voucher('제품을 인도하고 전자세금계산서를 발급하였다. [세액오류]', vat=150000), voucher('제품을 인도하고 전자세금계산서를 발급하였다. [정상]')]}
    json.dump(result, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(result, open(os.path.join(work, 'fake-last-make.json'), 'w', encoding='utf-8'), ensure_ascii=False)
else:
    made = json.load(open(os.path.join(work, 'fake-last-make.json'), encoding='utf-8'))
    solved = {'theory': [], 'journal': []}
    blocks = prompt.split('### ')[1:]
    for block in blocks:
        lines = block.strip().splitlines()
        head = lines[0].split()
        kind, bid = head[0], head[-1]
        if kind == '이론':
            ans = THEORY['answer']
            solved['theory'].append({'id': bid, 'answer': ans, 'ambiguous': False, 'note': ''})
        else:
            text = next(line for line in lines[1:] if line.strip())
            item = next(i for i in made['journal'] if i['prompt'] == text)
            rows = copy.deepcopy(item['rows'])
            if '[MISMATCH]' in item['prompt']:
                rows[0]['account'] = '현금'
            solved['journal'].append({'id': bid, 'ambiguous': False, 'note': '', 'voucher': copy.deepcopy(item.get('voucher')), 'rows': rows})
    json.dump(solved, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
