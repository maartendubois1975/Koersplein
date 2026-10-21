import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';

const client=new FactoryApiClient();
const official=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares;
// The public history manifest is readable even when Factory OIDC is rejected.
const manifestResponse=await fetch(client.baseUrl+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!manifestResponse.ok)throw Error('Public manifest HTTP '+manifestResponse.status);
const manifest=await manifestResponse.json();
let catalogRows=null,authError=null;
try{
  const catalog=await client.catalog();
  catalogRows=Array.isArray(catalog.instruments)?catalog.instruments:Array.isArray(catalog.data?.instruments)?catalog.data.instruments:null;
  if(!catalogRows)throw Error('Unexpected factory catalog structure');
}catch(error){
  authError=String(error.message||error).replace(/Bearer\\s+[^\\s]+/gi,'Bearer [redacted]').slice(0,300);
  console.warn('FACTORY_CATALOG_UNAVAILABLE: public-manifest-only diagnostic');
}
if(!manifest?.instruments||typeof manifest.instruments!=='object')throw Error('Unexpected manifest structure');
const catalogResolve=catalogRows?storageIdentityResolver(catalogRows):()=>null;
const manifestResolve=storageIdentityResolver(Object.entries(manifest.instruments).map(([isin,row])=>({...row,isin})));
const rows=[];
for(const share of official){
  const lookup={...share,mic:share.mic||'XPAR'};
  const manifestKey=manifestResolve(lookup);
  const manifestRow=manifestKey&&manifest.instruments[manifestKey];
  if(manifestRow?.lastDate&&Number(manifestRow.recordCount||manifestRow.records||0)>0)continue;
  const catalogKey=catalogResolve(lookup);
  const record={isin:share.isin,symbol:share.symbol,mic:lookup.mic,name:share.name,catalogKey:catalogKey||null,manifestKey:manifestKey||null,manifestRecords:Number(manifestRow?.recordCount||manifestRow?.records||0),manifestLastDate:manifestRow?.lastDate||null,partitions:null,partitionError:null,classification:null};
  if(!catalogRows){
    record.classification='FACTORY_AUTH_UNAVAILABLE';
  }else if(catalogKey){
    try{
      const response=await client.historyPartitions(catalogKey);
      record.partitions=response;
      // Do not equate a successful HTTP response with stored history.
      // Keep the raw response for audit and classify only recognized shapes.
      const partitionList=Array.isArray(response)?response:
        Array.isArray(response?.partitions)?response.partitions:
        Array.isArray(response?.data?.partitions)?response.data.partitions:null;
      if(partitionList===null){
        record.classification='PARTITION_RESPONSE_UNRECOGNIZED';
      }else if(partitionList.length===0){
        record.classification='NO_STORED_PARTITIONS';
      }else{
        record.partitionCount=partitionList.length;
        record.classification=manifestKey?'STORED_PARTITIONS_MANIFEST_NO_HISTORY':'STORED_PARTITIONS_MANIFEST_IDENTITY_MISSING';
      }
    }catch(error){
      record.partitionError=String(error.message||error).slice(0,350);
      record.classification='PARTITIONS_QUERY_FAILED';
    }
  }else record.classification='CATALOG_IDENTITY_MISSING';
  rows.push(record);
}
const counts=Object.fromEntries([...new Set(rows.map(r=>r.classification))].map(k=>[k,rows.filter(r=>r.classification===k).length]));
const output={generatedAt:new Date().toISOString(),mode:'READ_ONLY',officialParisCount:official.length,missingParisCount:rows.length,factoryCatalogAvailable:Boolean(catalogRows),factoryError:authError,counts,rows};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/paris-53-storage-diagnostic.json',JSON.stringify(output,null,2)+'\n');
console.log('PARIS_STORAGE_DIAGNOSTIC',JSON.stringify({officialParisCount:official.length,missingParisCount:rows.length,counts}));
if(rows.length!==53)console.warn('Paris missing count differs from the previous 53; live state may have changed');
if(!catalogRows)console.warn('FACTORY_AUTH_UNAVAILABLE: missing count is derived from public manifest only; do not present as confirmed storage audit');
