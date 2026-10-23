// End-to-end read-only bulk pilot smoke test with mocked provider responses.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-bulk-'));
try{
 await fs.mkdir(path.join(dir,'data'),{recursive:true});
 await fs.mkdir(path.join(dir,'scripts/cloudflare'),{recursive:true});
 const official=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8'));
 await fs.writeFile(path.join(dir,'data/euronext-paris.json'),JSON.stringify(official));
 const first=official.shares.find(x=>['XPAR','ALXP','XMLI'].includes(x.mic));
 assert.ok(first?.isin);
 const source=`globalThis.fetch=async url=>{
 const u=new URL(url);
 const exchange=u.pathname.split('/').at(-1);
 const date=u.searchParams.get('date')||process.env.BULK_PILOT_DATE;
 const listing=[{Code:'TEST',Isin:process.env.TEST_ISIN}];
 const bars=[{code:'TEST',date,open:10,high:12,low:9,close:11,volume:100}];
 const result=u.pathname.includes('exchange-symbol-list')?listing:bars;
 if(process.env.TEST_FAIL_EXCHANGE===exchange)return {ok:false,status:503};
 return {ok:true,json:async()=>result};
};`;
 await fs.writeFile(path.join(dir,'mock-provider.mjs'),source);
 // The pilot imports a local relative module; use copies in isolated temp directory.
 for(const name of ['europe-exchange-bulk-pilot.mjs','exchange-bulk-reconcile.mjs'])
  await fs.copyFile(path.join(root,'scripts/cloudflare',name),path.join(dir,'scripts/cloudflare',name));
 const env={...process.env,EODHD_API_TOKEN:'test-only',BULK_PILOT_DATE:'2026-10-21',BULK_PILOT_EXCHANGES:'PA,XETRA,BR,SW',TEST_ISIN:first.isin};
 const execute=(extra={})=>spawnSync(process.execPath,['--import','./mock-provider.mjs','scripts/cloudflare/europe-exchange-bulk-pilot.mjs'],{cwd:dir,env:{...env,...extra},encoding:'utf8'});
 let r=execute();
 assert.equal(r.status,0,r.stderr);
 let report=JSON.parse(await fs.readFile(path.join(dir,'research/output/europe-exchange-bulk-pilot.json'),'utf8'));
 assert.equal(report.complete,true);
 assert.equal(report.reports.length,4);
 assert.ok(report.reports.every(x=>x.status==='READ_ONLY_OBSERVED'));
 assert.equal(report.reports.find(x=>x.exchange==='PA').matched,1);
 assert.equal(report.reports.find(x=>x.exchange==='SW').coverageComparable,false);
 r=execute({TEST_FAIL_EXCHANGE:'SW'});
 assert.equal(r.status,2,r.stderr);
 report=JSON.parse(await fs.readFile(path.join(dir,'research/output/europe-exchange-bulk-pilot.json'),'utf8'));
 assert.deepEqual(report.failedExchanges,['SW']);
 assert.equal(report.reports.filter(x=>x.status==='READ_ONLY_OBSERVED').length,3);
 console.log('EUROPE_BULK_PILOT_MOCK_TESTS_OK');
}finally{await fs.rm(dir,{recursive:true,force:true});}
