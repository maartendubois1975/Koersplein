import fs from 'node:fs/promises';import path from 'node:path';
const root='research/output/market-artifacts';
let folders=[];try{folders=await fs.readdir(root,{withFileTypes:true})}catch(e){if(e.code!=='ENOENT')throw e}
let copied=0;
for(const folder of folders){
 if(!folder.isDirectory()||!folder.name.startsWith('machine-arena-X'))continue;
 const mic=folder.name.slice('machine-arena-'.length);
 if(!/^[A-Z0-9]{4}$/.test(mic))continue;
 const source=path.join(root,folder.name,'pipeline-summary.json');
 try{const data=JSON.parse(await fs.readFile(source,'utf8'));if(data.market!==mic)throw Error('MARKET_IDENTITY_MISMATCH_'+mic);const dest=path.join('research/output',mic);await fs.mkdir(dest,{recursive:true});await fs.copyFile(source,path.join(dest,'pipeline-summary.json'));copied++}catch(e){if(e.code!=='ENOENT')throw e}
}
console.log('MARKET_PIPELINE_SUMMARIES_REASSEMBLED',copied);
