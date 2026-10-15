import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'athex-rds-'));
try{
 const input=path.join(dir,'InstrumentSeries-20261015-G-v1.csv'),meta=path.join(dir,'meta.json'),output=path.join(dir,'out.json');
 const make=(symbol,isin,type='CS',right='N')=>{const x=Array(27).fill('');x[0]=symbol;x[7]='5';x[8]=type;x[11]=right;x[18]=isin;x[25]='Y';x[26]='A';return x.join(';')+';'};
 const csv=[make('AAPL','US0378331005'),make('MSFT','US5949181045'),make('RIGHT','US0378331005','CS','R'),make('BOND','US0378331005','PS')].join('\n')+'\n';
 const sha=s=>createHash('sha256').update(s).digest('hex');
 const run=()=>spawnSync(process.execPath,['scripts/research/block2-athex-rds-import.mjs',input,meta,output],{encoding:'utf8'});
 await fs.writeFile(input,csv);await fs.writeFile(meta,JSON.stringify({sourceUrl:'https://portal.athexgroup.gr/rds',asOf:'2026-10-15',expectedSha256:sha(csv),fieldPositions:{symbol:1,isin:19,instrumentType:9,rightsFlag:12},sourceRetrievedAt:'2026-10-15T10:00:00Z',retrievalMethod:'FIXTURE_TEST',retrievedBy:'CI',fieldMappingVerified:true,fieldMappingSourceUrl:'https://portal.athexgroup.gr/documents/d/guest/athex-rds-files-specification-v1-2-5-1'}));
 let r=run();assert.equal(r.status,0,r.stderr);const data=JSON.parse(await fs.readFile(output,'utf8'));
 assert.equal(data.records.length,2);assert.equal(data.rejected.length,2);assert.equal(data.sourceAuthenticityVerified,false);
 await fs.writeFile(input,csv+'\n');r=run();assert.notEqual(r.status,0);
 console.log('PASS ATHEX RDS adapter fixture');
}finally{await fs.rm(dir,{recursive:true,force:true})}
