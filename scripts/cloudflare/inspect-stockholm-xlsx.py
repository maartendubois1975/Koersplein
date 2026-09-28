import urllib.request, zipfile, io, xml.etree.ElementTree as ET, re
URL="https://attachment.news.eu.nasdaq.com/a74e733c1eb075bd41d8eb662c49049b3"
data=urllib.request.urlopen(URL,timeout=30).read()
z=zipfile.ZipFile(io.BytesIO(data))
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
 root=ET.fromstring(z.read('xl/sharedStrings.xml'))
 for si in root.findall('m:si',ns): shared.append(''.join(t.text or '' for t in si.iter('{%s}t'%ns['m'])))
rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
relmap={x.attrib['Id']:x.attrib['Target'] for x in rels}
wb=ET.fromstring(z.read('xl/workbook.xml'))
def cv(c):
 t=c.attrib.get('t'); v=c.find('m:v',ns)
 if v is None:
  inline=c.find('m:is',ns)
  return ''.join(t.text or '' for t in inline.iter('{%s}t'%ns['m'])) if inline is not None else ''
 s=v.text or ''
 return shared[int(s)] if t=='s' and s.isdigit() else s
for sh in wb.find('m:sheets',ns):
 name=sh.attrib['name']; target=relmap[sh.attrib['{%s}id'%ns['r']]]; path='xl/'+target.lstrip('/')
 root=ET.fromstring(z.read(path)); print("SHEET",name)
 for row in root.findall('.//m:sheetData/m:row',ns)[:12]:
  print([cv(c) for c in row.findall('m:c',ns)])
