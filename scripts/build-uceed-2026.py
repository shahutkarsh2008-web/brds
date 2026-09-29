"""Build UCEED 2026 Part A from user-supplied PDFs; no student assignments."""
import pymupdf as fitz
from pathlib import Path
import re,json,hashlib
from PIL import Image,ImageOps,ImageDraw
paper=Path(r'J:\downloads\UCEED_2026_Question_Paper.pdf')
key=Path(r'J:\downloads\UCEED2026_Answer_Key.pdf')
doc=fitz.open(paper)
out=Path('public/media');out.mkdir(exist_ok=True,parents=True)
scratch=Path('tmp/uceed');scratch.mkdir(exist_ok=True,parents=True)
nat=[14,2,6,16,62,4,31,8,13,745,5,16.8,34,[470,480]]
msq=['ABC','BC','ABD','BC','AC','AD','ABCD','ABC','BCD','BD','AC','ABC','ABC','AD','BC']
mcq=list('ABCBDACBBDCCCDBCBCCCBBAD BDBA'.replace(' ',''))
assert len(mcq)==28,len(mcq)
questions=[];manifest=[]
for pn,page in enumerate(doc):
 lines=[]
 for b in page.get_text('dict')['blocks']:
  if b['type']!=0:continue
  for l in b['lines']:
   text=''.join(s['text'] for s in l['spans']).strip()
   if text and l['bbox'][1]<780:lines.append((l['bbox'][1],text,l['bbox']))
 lines.sort(key=lambda l:(round(l[0],1),l[2][0]))
 starts=[(i,int(m.group(1))) for i,l in enumerate(lines) if (m:=re.match(r'^Q\.\s*(\d+)\.?\s*',l[1]))]
 for j,(start,n) in enumerate(starts):
  if n>57:continue
  stop=starts[j+1][0] if j+1<len(starts) else len(lines)
  region=lines[start:stop];boundary=lines[stop][0] if stop<len(lines) else 780
  if n==57:region=[l for l in region if l[0]<235];boundary=235
  texts=[l[1] for l in region if not l[1].startswith(('UCEED 2026','Page '))]
  texts[0]=re.sub(r'^Q\.\s*\d+\.?\s*','',texts[0])
  prompt=[];options=[];current=None
  for line in texts:
   m=re.match(r'^([ABCD])\.\s*(.*)',line)
   if m:
    current={'id':m[1].lower(),'text':m[2]};options.append(current)
   elif current:current['text']+=' '+line
   else:prompt.append(line)
  prompt='\n'.join(prompt) if n==31 else ' '.join(prompt)
  if n==18:prompt=prompt.replace('pixelated appearance','pixelated appearance')
  q={'id':f'q{n:02}','sectionId':'nat' if n<=14 else 'msq' if n<=29 else 'mcq','type':'NAT' if n<=14 else 'MSQ' if n<=29 else 'MCQ','prompt':prompt}
  images=[fitz.Rect(x['bbox']) for x in page.get_image_info() if x['bbox'][1]>=region[0][0] and x['bbox'][3]<=boundary and fitz.Rect(x['bbox']).get_area()>2000]
  if images:
   rect=images[0]
   for r in images[1:]:rect=rect|r
   if n==16:
    rect.y1=332
    options=[{'id':c,'text':t} for c,t in zip('abcd',['1 cut-out of Q, 1 cut-out of R, 2 cut-outs of S, 2 cut-outs of T','2 cut-outs of Q, 1 cut-out of R, 2 cut-outs of S, 2 cut-outs of T','2 cut-outs of Q, 2 cut-outs of R, 4 cut-outs of S, 1 cut-out of T','2 cut-outs of Q, 2 cut-outs of R, 2 cut-outs of S, 2 cut-outs of T'])]
   rect=fitz.Rect(rect.x0-2,rect.y0-2,rect.x1+2,rect.y1+2)
   name=f'uceed-2026-q{n:02}.png'
   page.get_pixmap(matrix=fitz.Matrix(2.5,2.5),clip=rect,alpha=False).save(out/name)
   q.update(image='/media/'+name,imageAlt=f'Original UCEED 2026 question {n} diagram'+(' and labelled answer choices' if not options and n>14 else ''))
   manifest.append({'question':n,'page':pn+1,'rect':list(rect),'image':name})
  q['marks']={'correct':4 if n<=29 else 3,'incorrect':0 if n<=14 else -1 if n<=29 else -.71,'unanswered':0}
  if n<=14:
   a=nat[n-1];q['answer']={'min':a[0] if isinstance(a,list) else a,'max':a[1] if isinstance(a,list) else a}
  else:
   q['options']=options or [{'id':c,'text':c.upper()+' — see labelled image'} for c in 'abcd']
   assert [o['id'] for o in q['options']]==list('abcd'),(n,options)
   for o in q['options']:
    if n==18:o['text']=re.sub(r'(\d+)o\b',r'\1°',o['text'])
   q['answer']=list(msq[n-15].lower()) if n<=29 else mcq[n-30].lower()
   if n<=29:q['partialCredit']={'1':1,'2':2,'3':3}
   if n==18:q['answerAlternatives']=[list('bcd')]
  questions.append(q)
assert [q['id'] for q in questions]==[f'q{n:02}' for n in range(1,58)]
exam={'id':'uceed-2026','title':'UCEED 2026','durationSeconds':7200,'totalQuestions':57,'maxMarks':200,
'instructions':'Demo imported from the supplied UCEED 2026 paper and final answer key. Part A only: 57 questions, 200 marks, 120 minutes. All three sections share the two-hour timer; section navigation is unrestricted. NAT Q1–14: +4 correct, 0 otherwise. MSQ Q15–29: +4 for all correct choices; +1/+2/+3 for choosing only 1/2/3 correct options as a proper subset of an accepted key; -1 in other answered cases; 0 blank. MCQ Q30–57: +3 correct, -0.71 incorrect, 0 blank. Q18 accepts B+C or B+C+D; Q14 accepts 470–480 inclusive. Part B Q58–59 are drawing tasks for separate offline practice (60 minutes, 100 marks); they are not auto-graded or included in this CBT score. No students are assigned by this import.',
'sections':[{'id':'nat','title':'Section 1 · NAT (56 marks)'},{'id':'msq','title':'Section 2 · MSQ (60 marks)'},{'id':'mcq','title':'Section 3 · MCQ (84 marks)'}],'questions':questions}
# Do not put answer-key hints in student-facing instructions.
exam['instructions']=exam['instructions'].replace(' Q18 accepts B+C or B+C+D; Q14 accepts 470–480 inclusive.','')
Path('fixtures/uceed-2026.json').write_text(json.dumps(exam,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(scratch/'manifest.json').write_text(json.dumps({'paperSha256':hashlib.sha256(paper.read_bytes()).hexdigest(),'keySha256':hashlib.sha256(key.read_bytes()).hexdigest(),'crops':manifest},indent=2),encoding='utf-8')
partb=doc[30].get_text(sort=True)+ '\n'+doc[31].get_text(sort=True)
partb=partb[partb.index('Q. 58'):]
partb=re.sub(r'UCEED 2026\s+Page \d+ of 32','',partb)
Path('docs/uceed-2026-part-b-practice.md').write_text('# UCEED 2026 — Part B offline practice\n\n60 minutes · 100 marks. Drawing answers require manual assessment and are not part of the 200-mark CBT demo.\n\n'+partb,encoding='utf-8')
for group in range((len(manifest)+7)//8):
 sheet=Image.new('RGB',(1100,4*340),'#eeeeee');draw=ImageDraw.Draw(sheet)
 for k,m in enumerate(manifest[group*8:group*8+8]):
  im=Image.open(out/m['image']);im.thumbnail((530,305))
  x=(k%2)*550;y=(k//2)*340;draw.text((x+10,y+5),'Question '+str(m['question'])+' / page '+str(m['page']),fill='black')
  sheet.paste(im,(x+10,y+28))
 sheet.save(scratch/f'contact-{group+1}.jpg')
keydoc=fitz.open(key);keydoc[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(scratch/'answer-key.png')
print(json.dumps({'questions':len(questions),'images':len(manifest),'textOnly':[q['id'] for q in questions if 'image' not in q],'mcq':mcq}))
