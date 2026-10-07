import fs from 'node:fs/promises';
const cfg=JSON.parse(await fs.readFile('data/sector-classification.json','utf8'));
const rows=Array.isArray(cfg.records)?cfg.records:[];const byIsin=new Map();
for(const r of rows){for(const k of cfg.requiredFields||[])if(!r[k])throw Error(`SECTOR_RECORD_MISSING_${k}_${r.isin||'UNKNOWN'}`);if(byIsin.has(r.isin))throw Error(`SECTOR_DUPLICATE_${r.isin}`);byIsin.set(r.isin,r)}
export function classificationFor(isin,predictionDate){
 const r=byIsin.get(isin);if(!r)return {sector:'UNKNOWN',industry:'UNKNOWN',eligibleForPeerModel:false,reason:'NO_SOURCE_BACKED_CLASSIFICATION'};
 const t=Date.parse(predictionDate),from=r.validFrom?Date.parse(r.validFrom):-Infinity,to=r.validTo?Date.parse(r.validTo):Infinity,retrieved=Date.parse(r.retrievedAt);
 if(!(t>=from&&t<to))return {sector:'UNKNOWN',industry:'UNKNOWN',eligibleForPeerModel:false,reason:'CLASSIFICATION_NOT_VALID_AT_T'};
 if(!r.validFrom && Number.isFinite(retrieved) && t<retrieved)return {sector:'UNKNOWN',industry:'UNKNOWN',eligibleForPeerModel:false,reason:'CURRENT_CLASSIFICATION_NOT_BACKPROJECTED'};
 return {...r,eligibleForPeerModel:true};
}
export function sectorCoverage(isins,predictionDate){let eligible=0;for(const x of isins)if(classificationFor(x,predictionDate).eligibleForPeerModel)eligible++;return {total:isins.length,eligible,unknown:isins.length-eligible,coverage:isins.length?eligible/isins.length:0}}
