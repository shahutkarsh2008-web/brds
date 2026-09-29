"""Rebuild UCEED 2024 from the user PDF and downloaded official final key."""
import pymupdf as fitz
from pathlib import Path
import re,json,hashlib
from PIL import Image,ImageDraw
paper=Path(r'C:\Users\user\Desktop\New folder\UCEED_2024_Question_Paper.pdf')
scratch=Path('tmp/uceed2024');scratch.mkdir(parents=True,exist_ok=True)
doc=fitz.open(paper)
nat=[7,24,8563,72,48,4,60,[615,645],[5,5.35],1500,75,[32.5,34.5],141,[12,13]]
msq=['AC','AB','BD','AB','BD','ABC','AD','A','ABC','AD','ABC','ABD','BC','AD','AC']
mcq='C D B B C C D C A B D A A A C B B D B C C B A D B A B B'.split()
questions=[];manifest=[]
for pn,page in enumerate(doc[:29]):
 lines=[]
 for b in page.get_text('dict')['blocks']:
  if b['type']!=0:continue
  for l in b['lines']:
   text=''.join(s['text'] for s in l['spans']).strip()
   if text and l['bbox'][1]<780:lines.append((l['bbox'][1],text,l['bbox']))
 lines.sort(key=lambda l:(round(l[0],1),l[2][0]))
 starts=[(i,int(m.group(1))) for i,l in enumerate(lines) if (m:=re.match(r'^Q\.\s*(\d+)\.?\s*',l[1]))]
 for j,(start,n) in enumerate(starts):
  stop=starts[j+1][0] if j+1<len(starts) else len(lines)
  region=lines[start:stop];boundary=lines[stop][0] if stop<len(lines) else 780
  texts=[l[1] for l in region if not l[1].startswith(('UCEED 2024','Page '))]
  texts[0]=re.sub(r'^Q\.\s*\d+\.?\s*','',texts[0])
  prompt=[];options=[];current=None
  for line in texts:
   m=re.match(r'^([ABCD])\.\s*(.*)',line)
   if m:
    current={'id':m[1].lower(),'text':m[2]};options.append(current)
   elif current:current['text']+=' '+line
   else:prompt.append(line)
  # The isolated C on Q49 is a diagram label, retained in the crop.
  if n==49:prompt=[s for s in prompt if s!='C']
  q={'id':f'q{n:02}','sectionId':'nat' if n<=14 else 'msq' if n<=29 else 'mcq','type':'NAT' if n<=14 else 'MSQ' if n<=29 else 'MCQ','prompt':' '.join(prompt).replace('','•')}
  images=[fitz.Rect(x['bbox']) for x in page.get_image_info() if x['bbox'][1]>=region[0][0] and x['bbox'][3]<=boundary and fitz.Rect(x['bbox']).get_area()>2000]
  if images:
   rect=fitz.Rect(images[0])
   for r in images[1:]:rect=rect|r
   rect=fitz.Rect(rect.x0-2,rect.y0-2,rect.x1+2,rect.y1+2)
   name=f'uceed-2024-q{n:02}.png'
   page.get_pixmap(matrix=fitz.Matrix(2.5,2.5),clip=rect,alpha=False).save(Path('public/media')/name)
   q.update(image='/media/'+name,imageAlt=f'Original UCEED 2024 question {n} diagram'+(' and labelled answer choices' if not options and n>14 else ''))
   manifest.append({'question':n,'page':pn+1,'rect':list(rect),'image':name})
  q['marks']={'correct':4 if n<=29 else 3,'incorrect':0 if n<=14 else -1 if n<=29 else -.71,'unanswered':0}
  if n<=14:
   a=nat[n-1];q['answer']={'min':a[0] if isinstance(a,list) else a,'max':a[1] if isinstance(a,list) else a}
   if n==14:q['answer']['values']=[12,13]
  else:
   q['options']=options or [{'id':c,'text':c.upper()+' — see labelled image'} for c in 'abcd']
   assert [o['id'] for o in q['options']]==list('abcd'),(n,options)
   q['answer']=list(msq[n-15].lower()) if n<=29 else mcq[n-30].lower()
   if n<=29:q['partialCredit']={'1':1,'2':2,'3':3}
  questions.append(q)
assert [q['id'] for q in questions]==[f'q{n:02}' for n in range(1,58)]
base=json.loads(Path('fixtures/uceed-2026.json').read_text(encoding='utf-8'))
base.update(id='uceed-2024',title='UCEED 2024',questions=questions,instructions=base['instructions'].replace('2026','2024'))
Path('fixtures/uceed-2024.json').write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(scratch/'manifest.json').write_text(json.dumps({'paperSha256':hashlib.sha256(paper.read_bytes()).hexdigest(),'keySha256':hashlib.sha256((scratch/'answer-key.pdf').read_bytes()).hexdigest(),'crops':manifest},indent=2),encoding='utf-8')
Path('docs/uceed-2024-part-b-practice.md').write_text('# UCEED 2024 — Part B offline practice\n\n60 minutes; 100 marks; manual drawing assessment, excluded from CBT scoring.\n\n'+'\n'.join(p.get_text(sort=True) for p in doc[29:]),encoding='utf-8')
for group in range((len(manifest)+7)//8):
 sheet=Image.new('RGB',(1100,1360),'#eeeeee');draw=ImageDraw.Draw(sheet)
 for k,m in enumerate(manifest[group*8:group*8+8]):
  im=Image.open(Path('public/media')/m['image']);im.thumbnail((530,305))
  x=(k%2)*550;y=(k//2)*340;draw.text((x+10,y+5),'Q'+str(m['question'])+' / p'+str(m['page']),fill='black');sheet.paste(im,(x+10,y+28))
 sheet.save(scratch/f'contact-{group+1}.jpg')
for pn in [20,24]:
 doc[pn].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).save(scratch/f'page-{pn+1}.png')
key=fitz.open(scratch/'answer-key.pdf');key[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(scratch/'key.png')
print(json.dumps({'questions':len(questions),'images':len(manifest),'textOnly':[q['id'] for q in questions if 'image' not in q]}))
