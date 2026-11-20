import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishTestHistory } from './publish-test-history.mjs';
import { loadCompanyCatalog } from './company-register.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'test-history-publication-'));
try {
  const catalog=await loadCompanyCatalog('XDUB');
  const share=catalog.shares.find(item=>item.symbol==='SENUS');
  const document=JSON.parse(await fs.readFile('data/history/XACD:'+share.isin+'.json','utf8'));
  const local=path.join(root,'history');
  await fs.mkdir(local);
  const file=path.join(local,'XACD:'+share.isin+'.json');
  await fs.writeFile(file,JSON.stringify(document));
  const markets=[{...catalog,shares:[share]}];
  const fetchImpl=async()=>({ok:true,json:async()=>({instruments:{},generatedAt:'2026-11-20'})});
  const options={markets,historyDir:local,outputDir:path.join(root,'published'),fetchImpl,now:new Date('2026-11-20T12:00:00Z')};
  assert.deepEqual(await publishTestHistory(options),{XDUB:1});
  const published=JSON.parse(await fs.readFile(path.join(options.outputDir,path.basename(file)),'utf8'));
  assert.deepEqual(published.bars,document.bars);
  const wrong={...document,instrument:{...document.instrument,mic:'XMSM'}};
  await fs.writeFile(file,JSON.stringify(wrong));
  await assert.rejects(()=>publishTestHistory(options),/identiteit/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(options.outputDir,path.basename(file)),'utf8')).bars,document.bars);
  console.log('Canonical history publication without legacy manifest and atomic rejection of wrong MIC PASS');
} finally {await fs.rm(root,{recursive:true,force:true});}
