// Strict Amsterdam Euronext OHLCV parser. Candidate data only.
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').trim();
export function parsePrice(value){
 let s=clean(value).replace(/[\s\u00a0\u202f]/g,'');
 if(!s||s==='-')return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0)s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(comma>=0)s=s.replace(',','.');
 
 if(!/^\d+(\.\d+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
export function parseRows(html){
 const rows=[...String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(tr=>[...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>clean(x[1])));
 const header=rows.findIndex(r=>r.some(x=>/^date$/i.test(x)));
 if(header<0)throw Error('MISSING_DATE_HEADER');
 const names=rows[header].map(x=>x.toLowerCase());
 const col=(...terms)=>names.findIndex(x=>terms.some(t=>x===t||x.includes(t)));
 const d=col('date'),o=col('open'),h=col('high'),l=col('low'),c=col('close'),v=col('number of shares','traded volume','volume','vol.');
 if([d,o,h,l,c,v].some(x=>x<0))throw Error('MISSING_REQUIRED_OHLCV_COLUMN');
 return rows.slice(header+1).map(r=>{
  const match=(r[d]||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!match)return null;
  const date=match[3]+'-'+match[2]+'-'+match[1];
  if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return null;
  return {date,open:parsePrice(r[o]),high:parsePrice(r[h]),low:parsePrice(r[l]),close:parsePrice(r[c]),volume:parsePrice(r[v])};
 }).filter(Boolean);
}
