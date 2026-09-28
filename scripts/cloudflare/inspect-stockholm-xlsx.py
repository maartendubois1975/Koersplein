import urllib.request, zipfile, io, xml.etree.ElementTree as ET, json, hashlib
URL="https://attachment.news.eu.nasdaq.com/a74e733c1eb075bd41d8eb662c49049b3"
data=urllib.request.urlopen(URL,timeout=30).read(); z=zipfile.ZipFile(io.BytesIO(data))
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'; R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
ns={'m':NS,'r':R}; shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
 root=ET.fromstring(z.read('xl/sharedStrings.xml'))
 for si in root.findall('m:si',ns): shared.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS)))
rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels')); relmap={x.attrib['Id']:x.attrib['Target'] for x in rels}
wb=ET.fromstring(z.read('xl/workbook.xml')); target=None
for sh in wb.find('m:sheets',ns):
 if sh.attrib['name']=='Instrument Trading Details': target=relmap[sh.attrib['{%s}id'%R]]
assert target
root=ET.fromstring(z.read('xl/'+target.lstrip('/')))
def cv(c):
 t=c.attrib.get('t'); v=c.find('m:v',ns)
 if v is None:
  inline=c.find('m:is',ns); return ''.join(t.text or '' for t in inline.iter('{%s}t'%NS)) if inline is not None else ''
 s=v.text or ''; return shared[int(s)] if t=='s' and s.isdigit() else s
rows=[[cv(c) for c in row.findall('m:c',ns)] for row in root.findall('.//m:sheetData/m:row',ns)]
hidx=next(i for i,r in enumerate(rows) if r and r[0]=='Instrument' and 'ISIN' in r)
h=rows[hidx]; ix={k:i for i,k in enumerate(h)}
shares=[]
for r in rows[hidx+1:]:
 r=r+['']*(len(h)-len(r))
 if r[ix['Instrument \nType']]!='Stock' or r[ix['Loca-\ntion']]!='STO' or r[ix['Delisted']].strip(): continue
 isin=r[ix['ISIN']].strip(); symbol=r[ix['Orderbook \nCode']].strip(); name=r[ix['Instrument']].strip(); segment=r[ix['Segment']].strip()
 if not isin or not symbol or segment not in ('Large Cap','Mid Cap','Small Cap'): continue
 shares.append({'company':name,'name':name,'symbol':symbol,'ticker':symbol,'isin':isin,'mic':'XSTO','segment':segment,'currency':'SEK','providerSymbol':symbol.replace(' ','-')+'.ST'})
# Official post-July removals.
removed={'SE0015483276':'Cint Group AB; last trading day 2026-08-07','SE0007100342':'Nilörngruppen AB; last trading day 2026-08-10','SE0017084361':'Viva Wine Group AB; last trading day 2026-09-22'}
shares=[x for x in shares if x['isin'] not in removed]
# Official post-July admission.
shares.append({'company':'Linjemontage i Grästorp Aktiebolag','name':'Linjemontage i Grästorp Aktiebolag','symbol':'LMGAB','ticker':'LMGAB','isin':'SE0030361606','mic':'XSTO','segment':'Mid Cap','currency':'SEK','providerSymbol':'LMGAB.ST'})
# Correct official identity for PPI if July workbook still carries pre-redomiciliation identity.
for x in shares:
 if x['isin'] in ('NO0013228586','SE0028799411') or x['symbol']=='PPI':
  x.update({'company':'PPI Public Property Invest AB (publ)','name':'PPI Public Property Invest AB (publ)','symbol':'PUBLI','ticker':'PUBLI','isin':'SE0028799411','mic':'XSTO','segment':'Large Cap','currency':'SEK','providerSymbol':'PUBLI.ST'})
# Provider exceptions validated against Yahoo Stockholm route.
overrides={'AZN':'AZN.ST','IPCO':'IPCO.ST','MER':'MER.ST','SVEAF':'SVEAF.ST','TOBII':'TOBII.ST'}
for x in shares:
 if x['symbol'] in overrides:x['providerSymbol']=overrides[x['symbol']]
# Deduplicate exact current ISINs after redomiciliation reconciliation.
by={x['isin']:x for x in shares}; shares=sorted(by.values(),key=lambda x:(x['symbol'],x['isin']))
fingerprint=hashlib.sha256(json.dumps([[x['isin'],x['mic'],x['symbol'],x['segment']] for x in shares],separators=(',',':')).encode()).hexdigest()
seed={'market':'XSTO','exchange':'Nasdaq Stockholm Main Market','asOf':'2026-09-28','source':'Official Nasdaq Nordic Equity Trading by Company and Instrument - July 2026 XLSX, Instrument Trading Details; reconciled with official Nasdaq Stockholm listing/delisting notices through 2026-09-28','sourceUrl':URL,'baseline':'July 2026 month-end Main Market equity instrument report','reconciliation':{'removed':removed,'added':[{'isin':'SE0030361606','symbol':'LMGAB','effective':'2026-09-25','segment':'Mid Cap'}],'identityCorrections':[{'fromIsin':'NO0013228586','toIsin':'SE0028799411','symbol':'PUBLI','reason':'PPI Swedish redomiciliation / official XSTO listing'}]},'fingerprint':fingerprint,'shares':shares}
open('data/stockholm-official-equity-seed.json','w').write(json.dumps(seed,ensure_ascii=False,indent=2)+'\n')
from collections import Counter
print(json.dumps({'baselineStockholmStocks':len([r for r in rows[hidx+1:] if len(r)>16 and r[ix['Instrument \nType']]=='Stock' and r[ix['Loca-\ntion']]=='STO' and not r[ix['Delisted']].strip()]),'current':len(shares),'segments':Counter(x['segment'] for x in shares),'fingerprint':fingerprint},default=dict))
