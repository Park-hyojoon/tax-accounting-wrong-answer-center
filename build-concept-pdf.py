"""Build the public reading PDF from the same content used by the website."""
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'concept-notes-data.js').read_text(encoding='utf-8').split('=', 1)[1].strip().removesuffix(';'))
OUT = ROOT / 'output' / 'pdf' / 'vat-concepts.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Nanum', 'C:/Windows/Fonts/NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('NanumBold', 'C:/Windows/Fonts/NanumGothicBold.ttf'))
INK = colors.HexColor('#243247')
PURPLE = colors.HexColor('#6755a2')
BODY = ParagraphStyle('body', fontName='Nanum', fontSize=9.5, leading=14.5, textColor=INK, wordWrap='CJK', spaceAfter=6)
TITLE = ParagraphStyle('title', parent=BODY, fontName='NanumBold', fontSize=19, leading=27, spaceAfter=18)
HEADING = ParagraphStyle('heading', parent=BODY, fontName='NanumBold', fontSize=14, leading=21, spaceAfter=10, keepWithNext=True)
SMALL = ParagraphStyle('small', parent=BODY, fontSize=8, leading=12, textColor=colors.HexColor('#657285'))
CELL = ParagraphStyle('cell', parent=BODY, spaceAfter=0)
CELLHEAD = ParagraphStyle('cellhead', parent=CELL, fontName='NanumBold')
KEY = ParagraphStyle('key', parent=BODY, fontName='NanumBold', textColor=PURPLE, backColor=colors.HexColor('#f3f0fa'), borderPadding=8, spaceBefore=4, spaceAfter=12)
WIDTH = A4[0] - 88

def p(text, style=BODY):
    return Paragraph(escape(text), style)

def footer(canvas, doc):
    canvas.setStrokeColor(colors.HexColor('#dde3ec'))
    canvas.line(44, 40, A4[0]-44, 40)
    canvas.setFont('Nanum', 8)
    canvas.setFillColor(colors.HexColor('#657285'))
    canvas.drawString(44, 27, '전산회계 1급 | 부가가치세 개념 정리 | '+DATA['updated'])
    canvas.drawRightString(A4[0]-44, 27, str(doc.page))

story = [p('전산회계 1급 · 개념 정리', SMALL), Spacer(1, 14), p(DATA['title'], TITLE), p(DATA['scope']), p('법령 확인: '+DATA['updated'], SMALL), Spacer(1, 13), p(DATA['intro'], KEY), p('짧게 읽고, 가리고, 내 말로 답하기', HEADING)]
for line in DATA['studyPlan']:
    story.append(p(line))
story.extend([Spacer(1, 17), p('차례', HEADING)])
for section in DATA['sections']:
    story.append(p(section['title']))
story.extend([Spacer(1, 17), p('사용 안내', HEADING), p('각 단원의 확인 질문은 답과 이유까지 말해보세요. 정답은 단원 뒤에 함께 실었습니다. 온라인 개념 정리 화면에서는 정답을 접어두고 직접 메모를 작성할 수 있습니다.'), p('이 교재는 현행법의 기본 원칙을 정리했습니다. 실제 시험에서는 해당 회차의 적용 세법과 문제 조건을 따릅니다. 과거 기출의 기준금액을 그대로 외우지 마세요.'), p('온라인 메모는 해당 브라우저에 저장됩니다. 다른 기기로 옮길 때는 메모 백업을 사용하세요. 기본 PDF에는 개인 메모가 포함되지 않습니다.', SMALL)])
for section in DATA['sections']:
    story.extend([PageBreak(), p(section['focus'], SMALL), p(section['title'], HEADING), p(section['key'], KEY)])
    story.extend(p(x) for x in section['paragraphs'])
    rows = [[p(x, CELLHEAD) for x in section['headers']]] + [[p(x, CELL) for x in row] for row in section['rows']]
    ratios = [0.38, 0.62] if len(section['headers']) == 2 else [0.40, 0.30, 0.30]
    table = Table(rows, colWidths=[WIDTH*x for x in ratios], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf0f5')),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#d9dfe8')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.extend([table, Spacer(1, 12)])
    story.extend(p('- '+x) for x in section.get('details', []))
    story.extend([p('선택지에서 조심할 말: '+section['trap']), Spacer(1, 5), p('표를 가리고 먼저 답하기', HEADING)])
    for i, q in enumerate(section['quiz'], 1):
        story.extend([p(f'{i}. {q["q"]}'), p('정답 · '+q['a'], SMALL)])
    story.append(p('직접 쓰기: '+section['notePrompt'], SMALL))
    for source_id in section['sources']:
        source=DATA['sources'][source_id]
        story.append(Paragraph('근거: <link href="'+escape(source['url'], {'"':'&quot;'})+'">'+escape(source['title'])+'</link>', SMALL))

doc=SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=44, leftMargin=44, topMargin=44, bottomMargin=54, title=DATA['title'], author='오답 훈련센터')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
