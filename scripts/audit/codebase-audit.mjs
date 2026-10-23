import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=process.cwd(),issues=[],stats={js:0,json:0,workflows:0};
async function walk(d){let out=[];for(const e of await fs.readdir(d,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(d,e.name);out.push(...(e.isDirectory()?await walk(p):[p]))}return out}
const files=await walk(root);
for(const f of files){const rel=path.relative(root,f).replaceAll('\\','/');if(/\.(mjs|js)$/.test(rel)){stats.js++;const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)issues.push({severity:'ERROR',type:'JS_SYNTAX',file:rel,detail:(r.stderr||r.stdout).trim().slice(0,500)})}if(rel.endsWith('.json')){stats.json++;try{JSON.parse(await fs.readFile(f,'utf8'))}catch(e){issues.push({severity:'ERROR',type:'JSON_PARSE',file:rel,detail:e.message})}}if(rel.startsWith('.github/workflows/')&&/\.ya?ml$/.test(rel)){stats.workflows++;const c=await fs.readFile(f,'utf8');if(c.includes('\\n        run:'))issues.push({severity:'ERROR',type:'WORKFLOW_LITERAL_ESCAPE',file:rel,detail:'letterlijke \\n vóór run'});if(/schedule:\s*\n/.test(c))issues.push({severity:'INFO',type:'SCHEDULED_WORKFLOW',file:rel});}}
const workflowNames=new Map();for(const f of files.filter(x=>path.relative(root,x).replaceAll('\\','/').startsWith('.github/workflows/')&&/\.ya?ml$/.test(x))){const rel=path.relative(root,f).replaceAll('\\','/'),body=await fs.readFile(f,'utf8'),name=(body.match(/^name:\s*(.+)$/m)||[])[1]?.trim();if(name)workflowNames.set(name,rel);}
for(const f of files.filter(x=>path.relative(root,x).replaceAll('\\','/').startsWith('.github/workflows/')&&/\.ya?ml$/.test(x))){const rel=path.relative(root,f).replaceAll('\\','/'),body=await fs.readFile(f,'utf8');for(const block of body.matchAll(/workflow_run:\s*\n\s+workflows:\s*\[([^\]]+)\]/g)){for(const raw of block[1].split(',')){const target=raw.trim().replace(/^['"]|['"]$/g,'');if(target&&!workflowNames.has(target))issues.push({severity:'ERROR',type:'STALE_WORKFLOW_RUN_TARGET',file:rel,detail:target});}}}
try{const p=JSON.parse(await fs.readFile(path.join(root,'data/world-fill-plan.json'),'utf8'));for(const m of p.markets||[]){if(m.state==='BLOCKED'&&!m.blockedReason)issues.push({severity:'ERROR',type:'BLOCKED_WITHOUT_REASON',file:'data/world-fill-plan.json',detail:m.mic});}}catch{}
try{const p=JSON.parse(await fs.readFile(path.join(root,'data/world-fill-plan.json'),'utf8')),r=JSON.parse(await fs.readFile(path.join(root,'data/market-source-registry.json'),'utf8'));for(const m of p.markets||[]){const s=r.markets?.[m.mic];if(m.state==='COMPLETE'&&s?.catalogFingerprint){try{const cat=JSON.parse(await fs.readFile(path.join(root,`data/euronext-${m.code}.json`),'utf8'));if(cat.fingerprint&&cat.fingerprint!==s.catalogFingerprint)issues.push({severity:'ERROR',type:'COMPLETE_FINGERPRINT_DRIFT',file:'data/world-fill-plan.json',detail:m.mic});}catch{}}if(s?.status==='APPROVED'&&Number(s.discovery?.sourceCountTested||0)<2&&['XMIL','XOSL'].includes(m.mic))issues.push({severity:'WARN',type:'SOURCE_DIVERSITY_LEGACY_EVIDENCE',file:'data/market-source-registry.json',detail:m.mic});}}catch(e){issues.push({severity:'ERROR',type:'CANONICAL_STATE_AUDIT_FAILED',file:'data/world-fill-plan.json',detail:e.message});}
// Canonical active workflow allowlist. Retired one-off probes and importers must not return.
const requiredWorkflows=new Set(['codebase-audit.yml','daily-open-close.yml','europe-run-recovery.yml','daily-opportunity-ledger.yml','universal-source-first.yml','complete-market-analysis.yml','machine-arena-europe.yml','live-europe-coverage.yml','offline-europe-coverage.yml','isin-source-recovery.yml']);
// Explicitly reviewed optional research, diagnostics and test workflows.
// Optional workflows can be retired without breaking the core architecture.
const approvedOptionalWorkflows=new Set(['europe-bulk-coverage-pilot.yml','europe-bulk-engine-tests.yml','europe-openfigi-reference.yml','europe-routing-regression.yml','paris-official-inventory-snapshot.yml','paris-storage-diagnostic.yml','paris-targeted-history-recovery.yml']);
const allowedWorkflows=new Set([...requiredWorkflows,...approvedOptionalWorkflows]);
for(const f of files.filter(x=>path.relative(root,x).replaceAll('\\','/').startsWith('.github/workflows/')&&/\.ya?ml$/.test(x))){
  const rel=path.relative(root,f).replaceAll('\\','/'),name=path.basename(rel);
  if(!allowedWorkflows.has(name)) issues.push({severity:'ERROR',type:'UNAPPROVED_WORKFLOW_PRESENT',file:rel});
  if(name==='paris-targeted-history-recovery.yml'){
    const body=await fs.readFile(f,'utf8');
    if(/^  (?:push|schedule):/m.test(body)||!/^  workflow_dispatch:/m.test(body))issues.push({severity:'ERROR',type:'PARIS_RECOVERY_MUST_BE_MANUAL_ONLY',file:rel});
  }
}
// Reject accidental removal of any production, recovery, research or audit workflow.
for(const name of requiredWorkflows){
 if(!files.some(f=>path.relative(root,f).replaceAll('\\\\','/')==='.github/workflows/'+name))
  issues.push({severity:'ERROR',type:'REQUIRED_WORKFLOW_MISSING',file:'.github/workflows/'+name});
}
// Guard the canonical 31-market Machine Arena selection.
const arenaWorkflow=await fs.readFile(path.join(root,'.github/workflows/machine-arena-europe.yml'),'utf8');
if(!arenaWorkflow.includes('fromJSON(needs.market-matrix.outputs.markets)')||!arenaWorkflow.includes('data/world-fill-plan.json'))issues.push({severity:'ERROR',type:'ARENA_MARKET_MATRIX_DRIFT',file:'.github/workflows/machine-arena-europe.yml'});
// Prevent removed archive and retired workflow triggers from being reintroduced.
const retiredAuditTriggerPaths=['scripts/archive/**','data/atlas-archive/**','.github/workflows/paris-*.yml','.github/workflows/world-fill-controller.yml','.github/workflows/market-handoff-controller.yml'];
for(const f of files.filter(x=>path.relative(root,x).replaceAll('\\\\','/').startsWith('.github/workflows/')&&/\\.ya?ml$/.test(x))){
 const rel=path.relative(root,f).replaceAll('\\\\','/'),body=await fs.readFile(f,'utf8');
 for(const retired of retiredAuditTriggerPaths){
  if(body.split('\\n').some(line=>line.trim().replace(/^[-\\s'\\\"]+|['\\\"]+$/g,'')===retired))issues.push({severity:'ERROR',type:'RETIRED_WORKFLOW_TRIGGER',file:rel,detail:retired});
 }
}
const obsoleteTriggers=files.filter(x=>{const rel=path.relative(root,x).replaceAll('\\','/');return rel.startsWith('.research-triggers/')||/\.trigger$/.test(rel)||rel==='.source-first-trigger'});
for(const f of obsoleteTriggers) issues.push({severity:'ERROR',type:'OBSOLETE_RUN_TRIGGER_PRESENT',file:path.relative(root,f).replaceAll('\\','/')});
// Block reintroduction of removed legacy Atlas runtime, while retaining the cold-data manifest.
const retiredRuntimePrefixes=['scripts/archive/','data/atlas-archive/'];
const retiredRuntimeFiles=['.github/workflows/world-fill-controller.yml','.github/workflows/market-handoff-controller.yml'];
for(const file of files){
 const rel=path.relative(root,file).split(path.sep).join('/');
 if(retiredRuntimePrefixes.some(prefix=>rel.startsWith(prefix))||retiredRuntimeFiles.includes(rel))
  issues.push({severity:'ERROR',type:'RETIRED_RUNTIME_FILE_REINTRODUCED',file:rel});
}
const protectedFrontend=['index.html','app.js','market.js','share.html','share.js'];
for(const rel of protectedFrontend){if(!files.some(x=>path.relative(root,x).replaceAll('\\','/')===rel))issues.push({severity:'ERROR',type:'FRONTEND_CONTRACT_FILE_MISSING',file:rel});}

try{
 const plan=JSON.parse(await fs.readFile(path.join(root,'data/world-fill-plan.json'),'utf8'));
 const markets=JSON.parse(await fs.readFile(path.join(root,'data/markets.json'),'utf8')).venues?.find(v=>v.id==='euronext')?.markets||[];
 const app=await fs.readFile(path.join(root,'app.js'),'utf8'),share=await fs.readFile(path.join(root,'share.js'),'utf8');
 for(const m of plan.markets.filter(x=>x.state==='COMPLETE')){
  const ui=markets.find(x=>x.mic===m.mic);
  if(!ui||ui.status!=='available'||!ui.sharesData)issues.push({severity:'ERROR',type:'COMPLETE_MARKET_NOT_ON_HOMEPAGE',file:'data/markets.json',detail:m.mic});
  const catalogRel='data/euronext-'+m.code+'.json',legacyPages={amsterdam:'amsterdam.html',brussels:'brussel.html',paris:'parijs.html',milan:'milaan.html',oslo:'oslo.html',lisbon:'lissabon.html',zurich:'zurich.html',stockholm:'stockholm.html'},page=ui&&legacyPages[ui.id];
  if(!files.some(x=>path.relative(root,x).replaceAll('\\','/')===catalogRel))issues.push({severity:'WARN',type:'COMPLETE_MARKET_CATALOG_REPAIR_PENDING',file:catalogRel,detail:m.mic});
  if(page&&!files.some(x=>path.relative(root,x).replaceAll('\\','/')===page))issues.push({severity:'ERROR',type:'COMPLETE_MARKET_PAGE_MISSING',file:page,detail:m.mic});
  const hasUniversal=files.some(x=>path.relative(root,x).replaceAll('\\','/')==='market.html')&&files.some(x=>path.relative(root,x).replaceAll('\\','/')==='generic-market.js');
  if(ui&&!page&&!hasUniversal)issues.push({severity:'ERROR',type:'UNIVERSAL_MARKET_PAGE_MISSING',file:'market.html',detail:m.mic});
  if(ui&&!app.includes('marketHref'))issues.push({severity:'ERROR',type:'COMPLETE_MARKET_HOMEPAGE_ROUTE_MISSING',file:'app.js',detail:m.mic});
  if(ui&&!share.includes("'data/'+market.sharesData"))issues.push({severity:'ERROR',type:'UNIVERSAL_SHARE_ROUTE_MISSING',file:'share.js',detail:m.mic});
 }
}catch(e){issues.push({severity:'ERROR',type:'FRONTEND_COMPLETE_MARKET_GATE_FAILED',file:'data/markets.json',detail:e.message});}

const retiredAtlasFiles=['scripts/archive/atlas-export.sql','scripts/archive/atlas-normalize.mjs','scripts/archive/atlas-research-evaluate.mjs','scripts/archive/atlas-validate.mjs','data/atlas-archive/README.md','data/atlas-archive/schema.json'];
const currentPaths=new Set(files.map(f=>path.relative(root,f).split(path.sep).join('/')));
for(const retired of retiredAtlasFiles){
 if(currentPaths.has(retired))issues.push({severity:'ERROR',type:'RETIRED_ATLAS_FILE_REINTRODUCED',file:retired});
}
for(const f of files.filter(x=>/\.(mjs|js|json|ya?ml|html|toml)$/.test(x))){
 const rel=path.relative(root,f).split(path.sep).join('/');
 if(rel==='scripts/audit/codebase-audit.mjs'||rel.startsWith('research/output/'))continue;
 const body=await fs.readFile(f,'utf8');
 for(const retired of retiredAtlasFiles){
  if(body.includes(retired))issues.push({severity:'ERROR',type:'RETIRED_ATLAS_REFERENCE',file:rel,detail:retired});
 }
}


const sourceFiles=files.filter(f=>/\.(?:mjs|js|html)$/.test(f));
for(const f of sourceFiles){
 const rel=path.relative(root,f).split(path.sep).join('/');
 const body=await fs.readFile(f,'utf8');
 const targets=[];
 if(/\.(?:mjs|js)$/.test(rel)){
  for(const match of body.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*|\brequire\s*\()\s*['"]([^'"]+)['"]/g))targets.push(match[1]);
 }else{
  for(const match of body.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))targets.push(match[1]);
 }
 for(const target of targets){
  if(!target.startsWith('./')&&!target.startsWith('../')&&!target.startsWith('/'))continue;
  const clean=target.split(/[?#]/)[0];
  if(!clean||clean==='/')continue;
  const resolved=clean.startsWith('/')?path.resolve(root,'.'+clean):path.resolve(path.dirname(f),clean);
  const normalized=path.relative(root,resolved).split(path.sep).join('/');
  if(normalized.startsWith('../')||path.isAbsolute(normalized))continue;
  if(!currentPaths.has(normalized)&&!currentPaths.has(normalized+'/index.js')&&!currentPaths.has(normalized+'/index.mjs'))
   issues.push({severity:'ERROR',type:'BROKEN_LOCAL_DEPENDENCY',file:rel,detail:target});
 }
}

// Check local Node entrypoints invoked by npm scripts and workflow steps.
const packageJson=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
for(const [name,command] of Object.entries(packageJson.scripts||{})){
 for(const match of command.matchAll(/(?:^|[;&|]\s*|\s)node\s+(?!--)([^\s;&|]+)/g)){
  const target=match[1].replace(/^['"]|['"]$/g,'');
  if(target.startsWith('-')||target.includes('$')||target.includes('*'))continue;
  if(!currentPaths.has(target))issues.push({severity:'ERROR',type:'MISSING_PACKAGE_ENTRYPOINT',file:'package.json',detail:name+': '+target});
 }
}
for(const f of files.filter(x=>path.relative(root,x).split(path.sep).join('/').startsWith('.github/workflows/')&&/\.ya?ml$/.test(x))){
 const rel=path.relative(root,f).split(path.sep).join('/');
 const body=await fs.readFile(f,'utf8');
 for(const match of body.matchAll(/(?:^|\s)node\s+(?!--)(scripts\/[^\s;&|"'#]+)/gm)){
  const target=match[1];
  if(target.includes('$')||target.includes('*'))continue;
  if(!currentPaths.has(target))issues.push({severity:'ERROR',type:'MISSING_WORKFLOW_ENTRYPOINT',file:rel,detail:target});
 }
}

// Fail on byte-identical executable source copies; do not delete historical research data.
const executableSources=files.filter(f=>/\\.(?:mjs|js)$/.test(f));
const exactSourceCopies=new Map();
for(const file of executableSources){
 const rel=path.relative(root,file).split(path.sep).join('/');
 const body=await fs.readFile(file,'utf8');
 if(!body.trim())continue;
 const previous=exactSourceCopies.get(body);
 if(previous)issues.push({severity:'ERROR',type:'DUPLICATE_EXECUTABLE_SOURCE',file:rel,detail:'Identical source also exists at '+previous});
 else exactSourceCopies.set(body,rel);
}
// Conservative inventory: identify potentially unreferenced scripts without deleting dynamic entrypoints.
const sourceEntries=files.filter(f=>path.relative(root,f).split(path.sep).join('/').startsWith('scripts/')&&/\\.(?:mjs|js)$/.test(f));
const referenceFiles=files.filter(f=>/\\.(?:mjs|js|json|ya?ml|html|md)$/.test(f)&&!path.relative(root,f).split(path.sep).join('/').startsWith('research/output/'));
const referenceBodies=await Promise.all(referenceFiles.map(async f=>({path:path.relative(root,f).split(path.sep).join('/'),body:await fs.readFile(f,'utf8')})));
const unreferencedScriptCandidates=[];
for(const f of sourceEntries){
 const rel=path.relative(root,f).split(path.sep).join('/');
 if(['server.mjs','cli.mjs','index.mjs'].includes(path.basename(rel))||path.basename(rel).startsWith('test')||path.basename(rel).includes('.test.'))continue;
 const filename=path.basename(rel),withoutExtension=rel.replace(/\\.(?:mjs|js)$/,'');
 const referenced=referenceBodies.some(entry=>entry.path!==rel&&(entry.body.includes(rel)||entry.body.includes(withoutExtension)||entry.body.includes(filename)));
 if(!referenced)unreferencedScriptCandidates.push(rel);
}
await fs.mkdir('research/output/audit',{recursive:true});
await fs.writeFile('research/output/audit/dependency-inventory.json',JSON.stringify({generatedAt:new Date().toISOString(),scannedScripts:sourceEntries.length,candidates:unreferencedScriptCandidates,warning:'Candidates are NOT confirmed unused; dynamic imports, external callers and scheduled invocations require manual review.'},null,2));
const report={generatedAt:new Date().toISOString(),stats,errors:issues.filter(x=>x.severity==='ERROR').length,warnings:issues.filter(x=>x.severity==='WARN').length,info:issues.filter(x=>x.severity==='INFO').length,issues};
await fs.mkdir('research/output/audit',{recursive:true});await fs.writeFile('research/output/audit/codebase-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors)process.exitCode=2;
