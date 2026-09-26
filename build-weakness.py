"""직접 제출 원장은 로컬에서만 읽고 공개 화면에는 익명 집계·문제 참조만 내보낸다."""
import json
import re
import hashlib
from pathlib import Path
import importlib.util

# 분류 근거는 직접 제출에 연결된 유형/태그만 사용한다. 숫자나 회사명 유사도로 합치지 않는다.
TYPE_RULES = [
    ('매입세액 공제·불공제', r'매입세액|불공제'),
    ('영세율·면세 구분', r'영세율|면세 비교'),
    ('세금계산서 발급', r'세금계산서 발급|발급의무'),
    ('선입선출법 완성품환산량', r'선입선출법.*(환산량|가공)|FIFO'),
    ('제조간접원가 배부', r'제조간접.*배부|예정배부|과다배부|과소배부'),
    ('재고 소유권·수량', r'재고.*(소유권|수량)|수탁품|미착상품'),
    ('재고 저가법', r'저가법|재고자산평가손실'),
    ('유상증자·주식발행', r'유상증자|주식발행|주식할인발행'),
    ('외화 결산환산', r'외화.*(환산|결산)|외화환산'),
    ('기간경과 이자', r'기간경과.*이자|미수이자'),
    ('선급비용 기간배분', r'선급비용|보험료 기간배분'),
    ('신용카드 제품매출', r'신용카드.*제품매출'),
    ('제품매출의 어음·외상 회수', r'제품매출.*(어음|외상)|전자세금계산서 제품매출'),
]
CONCEPT_RULES = [
    ('부가가치세', r'부가|과세|면세|영세|세금계산서|현금영수증|카과|건별|현면'),
    ('재고자산', r'재고|원재료|매출원가|감모|저가법|수탁품|미착'),
    ('원가회계', r'원가회계|종합원가|제조간접|환산량|배부|원가행태|직접노무|총제조'),
    ('자본·주식', r'자본|유상증자|주식발행|주식할인|자기주식|배당'),
    ('외화 거래', r'외화|외환|환율'),
    ('결산 기간배분', r'기간경과|선급비용|미수수익|미지급비용|월할'),
    ('유형·무형자산', r'유형자산|무형자산|감가상각|특허권|개발비|자본적지출'),
    ('금융자산·채권', r'매도가능|단기매매|외상매출금|받을어음|대여금|대손'),
]

def build(root):
    spec=importlib.util.spec_from_file_location('training_registration',root/'training-tool.py')
    t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t);t.ROOT=root
    catalog=json.loads(t.read('season-catalog.js').split('=',1)[1].strip().rstrip(';'))
    lookup={(p['subject'],str(p['id'])):p for p in catalog}
    events=[]
    for raw in t.ledger_entries():
        if t.field(raw,'source')!='user-submitted' or t.field(raw,'evidenceStatus')!='confirmed' or t.field(raw,'duplicateOf'):continue
        refs=[]
        for subject,ident in re.findall(r"source\s*:\s*'(theory|practical|voucher)'\s*,\s*id\s*:\s*('[^']+'|\d+)",raw):
            p=lookup.get((subject,ident.strip("'")))
            if p:refs.append(p)
        if refs:events.append(dict(id=t.field(raw,'id'),parent=t.field(raw,'recurrenceOf'),topic=t.field(raw,'topicId'),date=t.field(raw,'reportedAt'),refs=refs))
    byid={e['id']:e for e in events};groups={}
    for e in events:
        root_id=e['id'];seen=set()
        while root_id in byid and byid[root_id]['parent'] and root_id not in seen:
            seen.add(root_id);root_id=byid[root_id]['parent']
        text=' '.join(p['type']+' '+' '.join(p.get('tags',[])) for p in e['refs'])
        label=e['refs'][0]['type']
        similar=next((name for name,pattern in TYPE_RULES if re.search(pattern,text)),None)
        # 표제가 달라도 같은 정규 유형 ID로 접수된 문제는 함께 센다.
        keys=[('same',root_id,label),('type',similar or e['topic'] or label,similar or label)]
        keys += [('concept',name,name) for name,pattern in CONCEPT_RULES if re.search(pattern,text)]
        for kind,key,label in keys:
            g=groups.setdefault((kind,key),dict(kind=kind,label=label,events=set(),refs={},last='',resubmitted=False))
            g['events'].add(e['id']);g['last']=max(g['last'],e['date'] or '')
            if kind=='same' and e['parent']:g['resubmitted']=True
            for p in e['refs']:g['refs'][(p['subject'],str(p['id']))]=dict(subject=p['subject'],id=p['id'],title=p['title'])
    output=[]
    for (kind,key),g in groups.items():
        if len(g['events'])<3 and not (kind=='same' and g['resubmitted']):continue
        output.append(dict(id=kind+'-'+hashlib.sha256(key.encode()).hexdigest()[:12],kind=kind,label=g['label'],count=len(g['events']),last=g['last'],resubmitted=g['resubmitted'],refs=list(g['refs'].values())))
    output.sort(key=lambda g:(-g['count'],g['label']))
    data=dict(threshold=3,total=len(events),groups=output)
    (root/'weakness-data.js').write_text('window.TrainingWeaknessData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'반복 약점 집계: 직접 제출 {len(events)}건, 재제출 또는 3회 이상 묶음 {len(output)}개')
    return data

if __name__=='__main__':build(Path(__file__).resolve().parent)
