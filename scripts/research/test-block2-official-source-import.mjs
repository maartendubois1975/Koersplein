import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'block2-import-'));
try{
 const source=path.join(dir,'source.csv'),meta=path.join(dir,'meta.json'),output=path.join(dir,'out.json');
 const csv='symbol,isin,recordId\nAAPL,US0378331005,1\nMSFT,US5949181045,2\n';
 const digest=s=>createHash('sha256').update(s).digest('hex');
 const metadata={sourceUrl:'https://example.org/exchange.csv',asOf:'2026-10-15',coverage:'PARTIAL_MARKET',expectedSha256:digest(csv)};
 const run=()=>spawnSync(process.execPath,['scripts/research/block2-official-source-import.mjs',source,meta,output],{encoding:'utf8'});
 await fs.writeFile(source,csv);await fs.writeFile(meta,JSON.stringify(metadata));
 let result=run();assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(await fs.readFile(output,'utf8'));
 assert.equal(report.records.length,2);assert.equal(report.inputSha256,digest(csv));assert.equal(report.sourceAuthenticityVerified,false);
 await fs.writeFile(source,csv.replace('AAPL','AALP'));result=run();assert.notEqual(result.status,0,'Tampered source must be rejected');
 await fs.writeFile(source,csv);await fs.writeFile(meta,JSON.stringify({...metadata,coverage:'COMPLETE_MARKET'}));
 result=run();assert.notEqual(result.status,0,'Unverified full-market source must be rejected');
 await fs.writeFile(meta,JSON.stringify(metadata));
 const duplicate='symbol,isin,recordId\nAAPL,US0378331005,1\nAAPL,US0378331005,2\n';
 await fs.writeFile(source,duplicate);await fs.writeFile(meta,JSON.stringify({...metadata,expectedSha256:digest(duplicate)}));
 result=run();assert.notEqual(result.status,0,'Duplicate symbol must be rejected');
 console.log('PASS official CSV importer: integrity, provenance, partial-only and duplicate guards');
}finally{await fs.rm(dir,{recursive:true,force:true});}
