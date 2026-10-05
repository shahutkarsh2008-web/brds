import pdfplumber
p=r'F:\\desktop\\New folder\\UCEED_Spatial_Reasoning_Worksheet.pdf'
o=r'F:\\desktop\\New folder\\worksheet_extract.txt'
pdf=pdfplumber.open(p)
with open(o,'w',encoding='utf-8') as f:
 for i,pg in enumerate(pdf.pages): f.write('---PAGE %d---\\n%s\\n' % (i+1, pg.extract_text() or ''))
print(len(pdf.pages))
