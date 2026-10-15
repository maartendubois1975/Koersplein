import { writeFile } from 'node:fs/promises';

const url = 'https://live.euronext.com/en/product_directory/data/stocks-brussels/download?mics=XBRU%2CALXB%2CMLXB%2CTNLB%2CENXB';
const response = await fetch(url, { headers: { 'user-agent': 'Koersplein/1.0', accept: 'text/csv,text/plain,*/*' } });
if (!response.ok) throw new Error(`Euronext Brussel download mislukt: HTTP ${response.status}`);
const text = (await response.text()).replace(/^\uFEFF/, '');
const lines = text.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) throw new Error('Euronext Brussel download bevat geen aandelen');
const delimiter = [';', ',', '\t'].sort((a,b) => (lines[0].split(b).length - lines[0].split(a).length))[0];
const parse = (line) => { const out=[]; let cur='', q=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(c===delimiter && !q){out.push(cur.trim());cur='';} else cur+=c; } out.push(cur.trim()); return out; };
const headers = parse(lines[0]).map(v => v.toLowerCase().replace(/[^a-z0-9]+/g,''));
const pick = (row, aliases) => { for (const alias of aliases) { const i=headers.indexOf(alias); if(i>=0 && row[i]) return row[i]; } return ''; };
const shares=[];
const rejected=[];
for (const line of lines.slice(1)) {
  const row=parse(line);
  const name=pick(row,['name','naam','instrumentname','instrument']);
  const isin=pick(row,['isin','isincode']);
  const symbol=pick(row,['symbol','symbool','ticker','mnemo']);
  const market=pick(row,['market','markt','markets']);
  // Keep explicit security-type evidence only when the official download actually
  // supplies a type column. Never infer ordinary shares from the URL or name.
  const rawType=pick(row,['instrumenttype','securitytype','producttype','typeofinstrument','typeinstrument']);
  const normalizedType=rawType.trim().toUpperCase();
  const instrumentType=/^(ORDINARY SHARES?|COMMON (STOCK|SHARES?)|EQUITY SHARES?)$/.test(normalizedType)?'ORDINARY_SHARE':
    /^(PREFERENCE SHARES?|PREFERRED (STOCK|SHARES?))$/.test(normalizedType)?'PREFERRED_SHARE':
    /^(ETF|EXCHANGE TRADED FUND)$/.test(normalizedType)?'ETF':
    /^(ADR|AMERICAN DEPOSITARY RECEIPT)$/.test(normalizedType)?'ADR':null;
  if (!/Brussels|Brussel/i.test(market || 'Brussels')) continue;
  if (!name || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin) || !symbol) {
    rejected.push({name:name||null,symbol:symbol||null,isin:isin||null,reason:'MISSING_OR_MALFORMED_IDENTITY'});
    continue;
  }
  if (!shares.some(x=>x.isin===isin)) shares.push({ name, symbol, isin, market: market || 'Euronext Brussels',
    ...(instrumentType?{instrumentType,instrumentTypeSource:url,instrumentTypeRaw:rawType}:{}) });
}
if (rejected.length) throw new Error(`Brussels official catalog contains ${rejected.length} unresolved identities; first examples: ${JSON.stringify(rejected.slice(0,5))}`);
if (shares.length < 40) throw new Error(`Te weinig Brusselse aandelen herkend: ${shares.length}`);
shares.sort((a,b)=>a.name.localeCompare(b.name,'en'));
await writeFile(new URL('../../data/euronext-brussels.json', import.meta.url), JSON.stringify({ exchange:'Euronext Brussels', mic:'XBRU', retrievedAt:new Date().toISOString(), source:url, shares }, null, 2)+'\n');
console.log(JSON.stringify({ market:'XBRU', shares:shares.length, source:url }, null, 2));
