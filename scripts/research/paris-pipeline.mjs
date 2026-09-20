import fs from 'node:fs';
import path from 'node:path';
import { ParisResearchInput } from './paris-input.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('../../config/research/paris-v1.json',import.meta.url),'utf8'));
const root=process.env.KOERSPLEIN_RESEARCH_DIR||'var/research';
const runId=process.env.KOERSPLEIN_RESEARCH_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-');
const dir=path.join(root,cfg.research_version,runId); fs.mkdirSync(dir,{recursive:true});
const manifest={run_id:runId,research_version:cfg.research_version,market:cfg.market,status:'PLANNED',created_at:new Date().toISOString(),pipeline:cfg.pipeline.map((name,i)=>({order:i+1,name,status:'PENDING'})),gate:{status:'BLOCKED',reason:'Implementation adapters for validated Paris point-in-time inputs are not yet connected. Do not fabricate research results.'},required_outputs:cfg.outputs};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
if(process.argv.includes('--execute')) {
  const isins=(process.env.KOERSPLEIN_PARIS_RESEARCH_ISINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!isins.length){ console.error('BLOCKED: KOERSPLEIN_PARIS_RESEARCH_ISINS ontbreekt. Geen impliciet universum toegestaan.'); process.exitCode=2; }
  else {
    const input=new ParisResearchInput(); const cutoff=process.env.KOERSPLEIN_RESEARCH_CUTOFF||null; const snapshots=[];
    try {
      for(const isin of isins) snapshots.push(await input.history(isin,{cutoff}));
      manifest.input={source:'Cloudflare Factory /api/history/:isin',mic:'XPAR',cutoff,instruments:snapshots.map(s=>({isin:s.instrument.isin,firstDate:s.firstDate,lastDate:s.lastDate,records:s.records}))};
      manifest.status='INPUT_VALIDATED'; manifest.gate={status:'PASS',reason:'Paris XPAR history loaded through cutoff-enforcing adapter. Research analytics stages remain pending.'};
      manifest.pipeline[0].status='READY';
      fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
      console.log(JSON.stringify(manifest,null,2));
    } catch(error) {
      manifest.status='BLOCKED'; manifest.gate={status:'FAIL',reason:error.message}; fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)); console.error(error.message); process.exitCode=2;
    }
  }
}
