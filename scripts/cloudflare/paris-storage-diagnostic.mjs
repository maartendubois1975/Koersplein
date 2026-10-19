import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';

const client=new FactoryApiClient();
const official=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares;
const [catalog,manifest]=await Promise.all([client.catalog(),client.historyManifest()]);
const catalogRows=Array.isArray(catalog.instruments)?catalog.instruments:Array.isArray(catalog.data?.instruments)?catalog.data.instruments:null;
if(!catalogRows)throw Error('Unexpected factory catalog structure; refusing to guess');
if(!manifest?.instruments||typeof manifest.instruments!=='object')throw Error('Unexpected manifest structure');
const catalogResolve=storageIdentityResolver(catalogRows);
const manifestResolve=storageIdentityResolver(Object.entries(manifest.instruments).map(([isin,row])=>({...row,isin})));
const rows=[];
for(const share of official){
  const lookup={...share,mic:share.mic||'XPAR'};
  const manifestKey=manifestResolve(lookup);
  const manifestRow=manifestKey&&manifest.instruments[manifestKey];
  if(manifestRow?.lastDate&&Number(manifestRow.recordCount||manifestRow.records||0)>0)continue;
  const catalogKey=catalogResolve(lookup);
  const record={isin:share.isin,symbol:share.symbol,mic:lookup.mic,name:share.name,catalogKey:catalogKey||null,manifestKey:manifestKey||null,manifestRecords:Number(manifestRow?.recordCount||manifestRow?.records||0),manifestLastDate:manifestRow?.lastDate||null,partitions:null,partitionError:null,classification:null};
  if(catalogKey){
    try{
      const response=await client.historyPartitions(catalogKey);
      record.partitions=response;
      record.classification=manifestKey?'CATALOG_PRESENT_MANIFEST_NO_HISTORY':'CATALOG_PRESENT_MANIFEST_IDENTITY_MISSING';
    }catch(error){
      record.partitionError=String(error.message||error).slice(0,350);
      record.classification='PARTITIONS_QUERY_FAILED';
    }
  }else record.classification='CATALOG_IDENTITY_MISSING';
  rows.push(record);
}
const counts=Object.fromEntries([...new Set(rows.map(r=>r.classification))].map(k=>[k,rows.filter(r=>r.classification===k).length]));
const output={generatedAt:new Date().toISOString(),mode:'READ_ONLY',officialParisCount:official.length,missingParisCount:rows.length,counts,rows};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/paris-53-storage-diagnostic.json',JSON.stringify(output,null,2)+'\n');
console.log('PARIS_STORAGE_DIAGNOSTIC',JSON.stringify({officialParisCount:official.length,missingParisCount:rows.length,counts}));
if(rows.length!==53)console.warn('Paris missing count differs from the previous 53; live state may have changed');
