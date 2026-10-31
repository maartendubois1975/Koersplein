// Read-only Euronext response parser; never approves publication.
export const parsePrice = value => {
 const raw=String(value??'').trim().replace(/\s/g,'');
 if(!raw||raw==='-')return null;
 const normalized=raw.includes(',')&&!raw.includes('.')?raw.replace(',','.'):raw;
 const n=Number(normalized);
 return Number.isFinite(n)&&n>0?n:null;
};
export function parseRows(html){
 const trs=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
 const cells=tr=>[...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
 const rows=trs.map(cells),idx=rows.findIndex(r=>r.some(v=>/^date$/i.test(v)));
 if(idx<0)throw Error('No price table');
 const names=rows[idx].map(v=>v.toLowerCase());
 const find=s=>names.findIndex(v=>v.includes(s));
 const d=find('date'),o=find('open'),c=find('close'),v=find('volume');
 if([d,o,c,v].some(n=>n<0))throw Error('Missing required columns');
 return rows.slice(idx+1).map(r=>({date:r[d],open:parsePrice(r[o]),close:parsePrice(r[c]),volume:parsePrice(r[v])}));
}
