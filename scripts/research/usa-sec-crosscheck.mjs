// SEC crosscheck after official NYSE/Nasdaq research catalog generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {crosscheckSecIssuer,secUnavailableEvidence} from './usa-sec-crosscheck-core.mjs';
const url='https://www.sec.gov/files/company_tickers_exchange.json';
const response=await fetch(url,{headers:{'User-Agent':'Koersplein-USA-Research/1.0 (github.com/maartendubois1975/Koersplein)','Accept':'application/json'},signal:AbortSignal.timeout(20000)});

const observedAt=new Date().toISOString();
if(response.status===403){
  for(const mic of ['XNYS','XNAS']){
    const dir=path.join('research/output/usa',mic);
    const catalog=JSON.parse(await fs.readFile(path.join(dir,'universe.json'),'utf8'));
    const result={...secUnavailableEvidence(catalog,mic,403),observedAt};
    await fs.writeFile(path.join(dir,'sec-crosscheck.json'),JSON.stringify(result,null,2));
  }
  console.warn('::warning::SEC_OFFICIAL_HTTP_403 — issuer crosscheck unavailable; no securities approved. Independent catalog and canary research may continue.');
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
