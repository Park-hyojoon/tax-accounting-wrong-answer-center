# -*- coding: utf-8 -*-
"""출제위원 자동 출제의 도우미 쪽 규칙 검사: 형식 거르기, 독립 재풀이 비교, 최종 선택, 지침·스키마 구성.
Codex를 호출하지 않는다(사용량 0). 실행: python tests/examiner-auto.py
"""
import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('helper', ROOT / 'sync-helper.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

REVIEW = {k: '통과: 검토' for k in helper.REVIEW_KEYS}


def theory(**over):
    q = {'title': '두 거래의 판단', 'area': '회계원리', 'conceptIds': ['securities'], 'styles': ['함정형'], 'prompt': '다음 중 옳은 것은?',
         'table': None, 'choices': ['가', '나', '다', '라'], 'answer': 1, 'explanation': '해설', 'distractorReasons': ['a', 'b', 'c', 'd'],
         'intent': '의도', 'trap': '함정', 'novelty': '차이', 'calculationLoad': '없음', 'sourceRefs': ['r126-theory-7'], 'basis': '근거',
         'references': [], 'boundary': '범위', 'review': dict(REVIEW)}
    q.update(over)
    return q


def voucher_item(**over):
    item = {'kind': 'voucher', 'title': '제품 인도', 'prompt': '제품을 인도하고 전자세금계산서를 발급하였다.', 'exhibit': None,
            'voucher': {'date': '2026-10-15', 'type': '11.과세', 'supply': 2000000, 'vat': 200000, 'supplier': '㈜은솔', 'electronic': '여', 'journal': '혼합',
                        'cardCompany': None, 'zeroRateType': None, 'deductReason': None},
            'rows': [{'side': 'D', 'account': '보통예금', 'amount': 2200000, 'division': '', 'partner': ''},
                     {'side': 'C', 'account': '제품매출', 'amount': 2000000, 'division': '', 'partner': ''},
                     {'side': 'C', 'account': '부가세예수금', 'amount': 200000, 'division': '', 'partner': ''}],
            'explanation': '해설', 'styles': ['기출 변형'], 'conceptIds': ['pr-card'], 'intent': 'a', 'trap': 'b', 'novelty': 'c',
            'calculationLoad': '단순 가감', 'sourceRefs': [], 'basis': '근거', 'boundary': '범위', 'review': dict(REVIEW)}
    item.update(over)
    return item


class CandidateChecks(unittest.TestCase):
    def test_good_items_pass(self):
        self.assertIsNone(helper.validate_theory_item(theory()))
        self.assertIsNone(helper.validate_journal_item(voucher_item()))

    def test_theory_rejections(self):
        for bad in [theory(choices=['가', '가', '다', '라']), theory(sourceRefs=[], references=[]),
                    theory(sourceRefs=[], references=[{'title': 'x', 'url': 'https://example.invalid/a'}]),
                    theory(sourceRefs=[], references=[{'title': 'x', 'url': 'http://law.go.kr/a'}]),
                    theory(title=''), theory(prompt='가' * 2401),
                    theory(review={**REVIEW, 'copy': '주의: 복사', 'surprise': '주의: 약함'}),
                    theory(table={'caption': 'c', 'headers': ['a', 'b'], 'rows': [['1']]})]:
            self.assertIsNotNone(helper.validate_theory_item(bad))

    def test_journal_rejections(self):
        wrong_vat = voucher_item()
        wrong_vat['voucher']['vat'] = 150000
        zero_with_vat = voucher_item()
        zero_with_vat['voucher'].update(type='52.영세', vat=100)
        card_without_company = voucher_item()
        card_without_company['voucher'].update(type='57.카과', supply=1000000, vat=100000)
        unbalanced = voucher_item()
        unbalanced['rows'][0]['amount'] = 2100000
        leaked = voucher_item(title='11.과세 매출')
        no_voucher = voucher_item(voucher=None)
        for bad in [wrong_vat, zero_with_vat, card_without_company, unbalanced, leaked, no_voucher]:
            self.assertIsNotNone(helper.validate_journal_item(bad))

    def test_practical_needs_no_voucher(self):
        item = voucher_item(kind='practical', voucher=None)
        self.assertIsNone(helper.validate_journal_item(item))

    def test_check_candidate_splits_kept_and_rejected(self):
        kept_t, kept_j, rejected = helper.check_candidate({'theory': [theory(), theory(choices=['가', '가', '다', '라'])], 'journal': [voucher_item()]})
        self.assertEqual((len(kept_t), len(kept_j), len(rejected)), (1, 1, 1))


class BlindVerification(unittest.TestCase):
    def solved_for(self, item):
        return {'id': item['_bid'], 'ambiguous': False, 'note': '', 'voucher': copy.deepcopy(item.get('voucher')), 'rows': copy.deepcopy(item['rows'])}

    def test_matching_solution_passes_and_company_marker_is_normalized(self):
        item = voucher_item()
        item['_bid'] = 'j1'
        solved = self.solved_for(item)
        solved['voucher']['supplier'] = '(주)은솔'
        solved['rows'].reverse()
        self.assertEqual(helper.compare_journal(item, solved), [])

    def test_differences_are_named(self):
        item = voucher_item()
        item['_bid'] = 'j1'
        solved = self.solved_for(item)
        solved['voucher']['type'] = '51.과세'
        solved['rows'][0]['account'] = '현금'
        diff = helper.compare_journal(item, solved)
        self.assertIn('유형', diff)
        self.assertIn('분개 행', diff)

    def test_extras_are_compared_only_when_expected(self):
        item = voucher_item()
        item['voucher'].update(type='57.카과', supply=1000000, vat=100000, cardCompany='국민카드')
        item['_bid'] = 'j1'
        solved = self.solved_for(item)
        solved['voucher']['cardCompany'] = '삼성카드'
        self.assertIn('카드사', helper.compare_journal(item, solved))
        plain = voucher_item()
        plain['_bid'] = 'j2'
        other = self.solved_for(plain)
        other['voucher']['cardCompany'] = '삼성카드'
        self.assertEqual(helper.compare_journal(plain, other), [])

    def test_blind_verify_filters_mismatch_ambiguous_and_missing(self):
        t1, t2, t3, t4 = (theory(title=f'이론 {i}') for i in range(4))
        for i, q in enumerate([t1, t2, t3, t4], 1):
            q['_bid'] = f't{i}'
        j1 = voucher_item()
        j1['_bid'] = 'j1'
        solved = {'theory': [{'id': 't1', 'answer': 1, 'ambiguous': False, 'note': ''},
                             {'id': 't2', 'answer': 2, 'ambiguous': False, 'note': ''},
                             {'id': 't3', 'answer': 1, 'ambiguous': True, 'note': '복수 정답'}],
                  'journal': [self.solved_for(j1)]}
        passed_t, passed_j, rejected = helper.blind_verify([t1, t2, t3, t4], [j1], solved)
        self.assertEqual([q['_bid'] for q in passed_t], ['t1'])
        self.assertEqual(len(passed_j), 1)
        self.assertEqual(len(rejected), 3)

    def test_select_final_keeps_requested_counts_per_field(self):
        theory_items = [{'_bid': f't{i}'} for i in range(3)]
        journal_items = [{'kind': 'practical', '_bid': 'p1'}, {'kind': 'practical', '_bid': 'p2'}, {'kind': 'voucher', '_bid': 'v1'}]
        t, j = helper.select_final({'theory': 2, 'practical': 1, 'voucher': 1}, theory_items, journal_items)
        self.assertEqual([x['_bid'] for x in t], ['t0', 't1'])
        self.assertEqual([x['_bid'] for x in j], ['p1', 'v1'])


class PromptAndSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inputs = helper.examiner_inputs()

    def test_prompt_contains_brief_scope_and_existing_questions_but_no_private_text(self):
        analysis, practice, pilot, library, journal_library, brief = self.inputs
        prompt = helper.examiner_prompt({'theory': 2, 'practical': 2, 'voucher': 2}, ['출제위원 랜덤'], analysis, practice, pilot, library, journal_library, brief)
        self.assertIn('수준 기준', prompt)
        self.assertIn('공식 평가범위', prompt)
        self.assertIn('두 투자 거래의 회계처리', prompt)
        self.assertIn('예비', prompt)
        self.assertLess(len(prompt), 90000)
        self.assertNotIn('localStorage', prompt)
        self.assertNotIn('githubToken', prompt)
        self.assertNotIn('깃허브 토큰', prompt)

    def test_schema_is_strict_and_enumerates_known_ids(self):
        analysis, practice = self.inputs[0], self.inputs[1]
        schema = helper.examiner_schema(analysis, practice)

        def walk(node):
            if isinstance(node, dict):
                if node.get('type') == 'object':
                    self.assertFalse(node.get('additionalProperties'))
                    self.assertEqual(sorted(node['required']), sorted(node['properties']))
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        walk(schema)
        concept_enum = schema['properties']['theory']['items']['properties']['conceptIds']['items']['enum']
        self.assertIn('process-cost', concept_enum)
        self.assertIn('vat-bad-debt', concept_enum)
        self.assertEqual(len(set(helper.VOUCHER_TYPES)), 26)
        json.dumps(helper.blind_schema())


class StartGuards(unittest.TestCase):
    def test_count_limits(self):
        for bad in [{'counts': {'theory': 0, 'practical': 0, 'voucher': 0}}, {'counts': {'theory': 4, 'practical': 4, 'voucher': 4}},
                    {'counts': {'theory': 5, 'practical': 0, 'voucher': 0}}, {'counts': {'theory': 'x'}}]:
            with self.assertRaises(helper.ExaminerError):
                helper.start_examiner_job(bad)

    def test_origin_pattern(self):
        ok = ['null', 'http://127.0.0.1:8777', 'http://localhost', 'https://park-hyojoon.github.io']
        bad = ['https://evil.example', 'http://127.0.0.1.evil.com', 'http://localhost.evil.com:80']
        for origin in ok:
            self.assertTrue(helper.ALLOWED_ORIGIN.match(origin), origin)
        for origin in bad:
            self.assertFalse(helper.ALLOWED_ORIGIN.match(origin), origin)


if __name__ == '__main__':
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
