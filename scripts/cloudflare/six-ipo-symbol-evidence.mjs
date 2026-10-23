// SIX official IPO history is an evidence source for historical ticker identity,
// not proof that the IPO ticker remains the current trading symbol.
export function parseSixIpoPairs(html) {
  const text=String(html||'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/\s+/g,' ');
  const map=new Map();
  for(const m of text.matchAll(/\bISIN\s*:\s*([A-Z]{2}[A-Z0-9]{10})\s+Symbol\s*:\s*([A-Z][A-Z0-9.\-]{0,14})(?=\s|$)/gi)){
    const isin=m[1].toUpperCase(),symbol=m[2].toUpperCase();
    if(!map.has(isin))map.set(isin,new Set());
    map.get(isin).add(symbol);
  }
  return map;
}
