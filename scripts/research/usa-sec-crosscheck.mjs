// SEC crosscheck after official NYSE/Nasdaq research catalog generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {crosscheckSecIssuer,secUnavailableEvidence,hasDeclaredSecContact} from './usa-sec-crosscheck-core.mjs';
const url='https://www.sec.gov/files/company_tickers_exchange.json';
const userAgent=process.env.SEC_USER_AGENT?.trim();
const observedAt=new Date().toISOString();
async function writeBlockedEvidence(reason){
  for(const mic of ['XNYS','XNAS']){
    const dir=path.join('research/output/usa',mic);
    const catalog=JSON.parse(await fs.readFile(path.join(dir,'universe.json'),'utf8'));
    const result={...secUnavailableEvidence(catalog,mic,reason),observedAt};
    await fs.writeFile(path.join(dir,'sec-crosscheck.json'),JSON.stringify(result,null,2));
  }
}
if(!hasDeclaredSecContact(userAgent)){
  await writeBlockedEvidence('CONTACT_NOT_CONFIGURED');
  console.warn('::warning::SEC_CONTACT_NOT_CONFIGURED — no request sent; configure an actual operator contact in the SEC_USER_AGENT secret. All identity gates remain closed.');
}else{
  const response=await fetch(url,{headers:{'User-Agent':userAgent,'Accept':'application/json'},signal:AbortSignal.timeout(20000)});
  if(response.status===403){
    await writeBlockedEvidence(403);
    console.warn('::warning::SEC_OFFICIAL_HTTP_403 — issuer crosscheck unavailable; no securities approved.');
  }else{
    if(!response.ok)throw Error('SEC_OFFICIAL_FEED_HTTP_'+response.status);
    const raw=await response.text();
    const sec=JSON.parse(raw);
    const sourceSha256=createHash('sha256').update(raw).digest('hex');
    for(const mic of ['XNYS','XNAS']){
      const dir=path.join('research/output/usa',mic);
      const catalog=JSON.parse(await fs.readFile(path.join(dir,'universe.json'),'utf8'));
      const result=crosscheckSecIssuer(catalog,sec,mic,{observedAt,sourceSha256,catalogSourceSha256:catalog.sourceSha256});
      await fs.writeFile(path.join(dir,'sec-crosscheck.json'),JSON.stringify(result,null,2));
      console.log(JSON.stringify({mic,sourceSha256,statusCounts:result.statusCounts,verifiedCommonStocks:0}));
    }
  }
}
