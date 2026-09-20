import fs from 'node:fs';
import path from 'node:path';
const cfg=JSON.parse(fs.readFileSync(new URL('../../config/research/paris-v1.json',import.meta.url),'utf8'));
const root=process.env.KOERSPLEIN_RESEARCH_DIR||'var/research';
const runId=process.env.KOERSPLEIN_RESEARCH_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-');
const dir=path.join(root,cfg.research_version,runId); fs.mkdirSync(dir,{recursive:true});
const manifest={run_id:runId,research_version:cfg.research_version,market:cfg.market,status:'PLANNED',created_at:new Date().toISOString(),pipeline:cfg.pipeline.map((name,i)=>({order:i+1,name,status:'PENDING'})),gate:{status:'BLOCKED',reason:'Implementation adapters for validated Paris point-in-time inputs are not yet connected. Do not fabricate research results.'},required_outputs:cfg.outputs};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
if(process.argv.includes('--execute')) { console.error('BLOCKED: Paris research execution requires connected, validated point-in-time research adapters.'); process.exitCode=2; }
