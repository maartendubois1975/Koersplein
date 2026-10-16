import fs from 'node:fs/promises';
import {reconcile} from './reconcile-isin.mjs';

export function parseGpwCompanyLinks(html, sourceDate) {
  const rows = [], seen = new Set();
  // GPW company links embed the exchange's ISIN in /spolka?isin=...
  // and the visible ticker in parentheses, e.g. NAME (11B).
  const pattern = /<a\b[^>]*href=["'][^"']*\/spolka\?isin=([A-Z0-9]{12})[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const visible = match[2].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
    const ticker = /\(([A-Z0-9]{1,12})\)\s*$/.exec(visible)?.[1];
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    rows.push({symbol:ticker,isin:match[1].toUpperCase(),
      sourceUrl:'https://www.gpw.pl/spolki',sourceDate,sourceDocument:'GPW Main Market company listing'});
  }
  return rows;
}
export async function extractGpwEvidence(html, date) {
  const catalog=JSON.parse(await fs.readFile(new URL('../../data/euronext-warsaw.json',import.meta.url),'utf8'));
  return reconcile(catalog,parseGpwCompanyLinks(html,date));
}
if (process.argv[1]?.endsWith('/fetch-gpw-evidence.mjs')) {
  const date=new Date().toISOString().slice(0,10);
  const response=await fetch('https://www.gpw.pl/spolki?limit=1000&offset=0',{headers:{'User-Agent':'Koersplein research audit (public company identifiers)'}});
  if(!response.ok)throw new Error('GPW HTTP '+response.status);
  const html=await response.text();
  const report=await extractGpwEvidence(html,date);
  if(report.accepted.length===0)throw new Error('No verified GPW company links found; check page markup');
  console.log(JSON.stringify(report,null,2));
}
