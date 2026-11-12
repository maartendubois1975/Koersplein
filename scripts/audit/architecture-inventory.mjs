import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(path.relative(root,p).replaceAll('\\','/'));}return out;}
const files=(await walk(root)).sort(),fileSet=new Set(files);
const pages=files.filter(p=>p.endsWith('.html'));
const activePages=pages.filter(p=>!p.startsWith('beheer/'));
const scripts=new Set(),missing=[],redirects=[],seen=new Map();
for(const page of activePages){
 const html=await fs.readFile(path.join(root,page),'utf8');
 const redirect=html.match(/location\.replace\(["']([^"']+)/);
 if(redirect){redirects.push({page,to:redirect[1]});continue;}
 for(const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"'?#]+)/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(page),m[1]));
  if(!fileSet.has(target))missing.push({page,target});
  else {scripts.add(target);seen.set(target,[...(seen.get(target)||[]),page]);}
 }
}
const queue=[...scripts],visited=new Set();
while(queue.length){const p=queue.pop();if(visited.has(p))continue;visited.add(p);
 const body=await fs.readFile(path.join(root,p),'utf8');
 for(const m of body.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*["'](\.[^"'?#]+)/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1]));
  if(!fileSet.has(target))missing.push({page:p,target});
  else if(!visited.has(target))queue.push(target);
 }
}
const allRootJs=files.filter(p=>!p.includes('/')&&/\.m?js$/.test(p));
const inactiveRootJs=allRootJs.filter(p=>!visited.has(p));
const workflowPaths=files.filter(p=>/^\.github\/workflows\/.*\.ya?ml$/.test(p));
const workflows=await Promise.all(workflowPaths.map(async p=>{const s=await fs.readFile(path.join(root,p),'utf8');return {path:p,scheduled:/^  schedule:/m.test(s),writes:/contents:\s*write/.test(s),targetsDevelopment:/amsterdam-reset-20261027/.test(s)};}));
const report={schemaVersion:1,files:files.length,pages:activePages.length,activeScripts:[...visited].sort(),inactiveRootJs,redirects,missing,workflows,notes:['Inactive root scripts are candidates only: CLI, tests, or dynamic loading can reference them.','GitHub scheduled workflows execute only from default branch.','Do not remove financial data or provenance evidence based on static reachability.']};
await fs.mkdir(path.join(root,'research/output'),{recursive:true});
await fs.writeFile(path.join(root,'research/output/architecture-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.files,pages:report.pages,activeScripts:report.activeScripts.length,inactiveRootJs,missing,workflows},null,2));
if(missing.length)process.exitCode=1;
