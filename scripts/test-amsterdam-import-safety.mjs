import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const importer=resolve('scripts/import-amsterdam.mjs');
const isin='NL9999999999',symbol='TEST';
const baseRow={isin,symbol,mic:'XAMS',date:'2026-10-30',open:10,high:12,low:9,close:11,volume:100,source:'Euronext public historical table',sourceUrl:'https://example.test',retrievedAt:'2026-10-31T10:00:00Z',sourceVerified:true,sessionClosedVerified:true};
async function fixture(rows){
 const dir=await mkdtemp(join(tmpdir(),'amsterdam-import-'));
 await mkdir(join(dir,'data/history'),{recursive:true});
 const instruments=Object.fromEntries(Array.from({length:80},(_,i)=>[i===0?isin:'NL'+String(i).padStart(10,'0'),{symbol:i===0?symbol:'T'+i}]));
 await writeFile(join(dir,'data/amsterdam-history-manifest.json'),JSON.stringify({instruments}));
 const history={instrument:{isin,symbol,mic:'XAMS'},bars:[],coverage:{lastDate:'2026-10-29',records:0},provider:{metadata:{}}};
 const path=join(dir,'data/history',isin+'.json');
 await writeFile(path,JSON.stringify(history));
 await writeFile(join(dir,'input.json'),JSON.stringify({market:'XAMS',rows}));
 return {dir,path,history};
}
async function check(name,rows,success,expected){
 await test(name,async()=>{
  const f=await fixture(rows);
  try{
   const run=spawnSync(process.execPath,[importer,'input.json','--apply','--partial'],{cwd:f.dir,encoding:'utf8'});
   assert.equal(run.status,success?0:1,run.stderr);
   const doc=JSON.parse(await readFile(f.path,'utf8'));
   assert.equal(doc.bars.length,expected);
  }finally{await rm(f.dir,{recursive:true,force:true});}
 });
}
await check('valid verified row imports',[baseRow],true,1);
await check('invalid OHLC blocks whole batch',[baseRow,{...baseRow,isin:'NL0000000002',symbol:'T2',low:20}],false,0);
await check('duplicate ISIN/date blocks batch',[baseRow,baseRow],false,0);
await check('unverified row blocks batch',[{...baseRow,sourceVerified:false}],false,0);
await test('existing conflicting bar blocks update',async()=>{
 const f=await fixture([baseRow]);
 try{
  const existing={...f.history,bars:[{date:baseRow.date,open:8,high:9,low:7,close:8,volume:100}],coverage:{lastDate:baseRow.date,records:1}};
  await writeFile(f.path,JSON.stringify(existing));
  const run=spawnSync(process.execPath,[importer,'input.json','--apply','--partial'],{cwd:f.dir,encoding:'utf8'});
  assert.equal(run.status,1);
  assert.deepEqual(JSON.parse(await readFile(f.path,'utf8')).bars,existing.bars);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
