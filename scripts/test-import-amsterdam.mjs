import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'xams-import-test-'));
await mkdir(join(root,'data/history'),{recursive:true});
const instruments={};
for(let i=0;i<80;i++)instruments['ID'+String(i).padStart(3,'0')]={symbol:'S'+i};
await writeFile(join(root,'data/amsterdam-history-manifest.json'),JSON.stringify({instruments}));
const history=join(root,'data/history/ID000.json');
await writeFile(history,JSON.stringify({instrument:{isin:'ID000',mic:'XAMS',symbol:'S0'},bars:[{date:'2026-10-27',open:10,high:11,low:9,close:10,volume:100}],coverage:{records:1,volumeRecords:1,lastDate:'2026-10-27'},provider:{}}));
const input=join(root,'snapshot.json');
const row={isin:'ID000',symbol:'S0',mic:'XAMS',date:'2026-10-28',open:10,high:12,low:9,close:11,volume:100,source:'TEST_ONLY',sourceUrl:'https://example.org',retrievedAt:'2026-10-29T00:00:00Z',sourceVerified:true,sessionClosedVerified:true};
const script=new URL('./import-amsterdam.mjs',import.meta.url).pathname;
const run=(args=[])=>spawnSync(process.execPath,[script,input,...args],{cwd:root,encoding:'utf8'});
await writeFile(input,JSON.stringify({market:'XAMS',rows:[row]}));
assert.equal(run().status,0,'dry run');
assert.equal(JSON.parse(await readFile(history)).bars.length,1,'dry run must not write');
assert.equal(run(['--apply']).status,0,'apply');
assert.equal(JSON.parse(await readFile(history)).bars.length,2,'must add bar');
assert.equal(run(['--apply']).status,0,'repeat must be idempotent');
for(const patch of [{volume:0,date:'2026-10-29'},{sourceVerified:false,date:'2026-10-29'},{symbol:'WRONG',date:'2026-10-29'},{date:'2026-10-28',close:9}]){
 await writeFile(input,JSON.stringify({market:'XAMS',rows:[{...row,...patch}]}));
 assert.notEqual(run(['--apply']).status,0,'reject bad input');
}
// In partial mode an unverified row must not prevent a different approved row.
await writeFile(input,JSON.stringify({market:'XAMS',rows:[{...row,date:'2026-10-29',sourceVerified:false},{...row,date:'2026-10-30',close:11}]}));
assert.notEqual(run(['--apply']).status,0,'strict mode refuses mixed batch');
assert.equal(run(['--apply','--partial']).status,0,'partial mode imports approved row');
const afterPartial=JSON.parse(await readFile(history));
assert.equal(afterPartial.bars.length,3,'only one new approved bar');
assert.equal(afterPartial.bars.at(-1).date,'2026-10-30');
assert.equal(run(['--apply','--partial']).status,0,'partial mode remains idempotent');
assert.equal(JSON.parse(await readFile(history)).bars.length,3);
console.log('PASS import: dry-run, append, idempotence, zero-volume, unverified, identity, conflict');
