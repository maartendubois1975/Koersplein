import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function sealForecast({market,isin,modelVersion,predictionDate,horizonMonths,forecast,createdAt,sourceSnapshotHash,previousHash=null}){
 if(!/^[A-Z0-9]{4}$/.test(market||'')||!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin||''))throw Error('FORECAST_IDENTITY_INVALID');
 if(!modelVersion||!/^\d{4}-\d{2}-\d{2}$/.test(predictionDate||'')||![3,6,12,24].includes(horizonMonths)||!Number.isFinite(forecast))throw Error('FORECAST_FIELDS_INVALID');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(createdAt||'')||Date.parse(createdAt)>Date.now()+60000||createdAt.slice(0,10)>predictionDate)throw Error('FORECAST_TIMESTAMP_INVALID');
 if(!/^[a-f0-9]{64}$/.test(sourceSnapshotHash||'')||(previousHash!==null&&!/^[a-f0-9]{64}$/.test(previousHash)))throw Error('FORECAST_SOURCE_INVALID');
 const record={market,isin,modelVersion,predictionDate,horizonMonths,forecast,createdAt,sourceSnapshotHash,previousHash};
 return {...record,evidenceHash:hash(record)};
}
export function verifyForecastChain(records){
 let previousHash=null;
 for(const row of records){
  if(row.previousHash!==previousHash)return {valid:false,reason:'CHAIN_BROKEN'};
  const {evidenceHash,...payload}=row;
  if(hash(payload)!==evidenceHash)return {valid:false,reason:'RECORD_CHANGED'};
  previousHash=evidenceHash;
 }
 return {valid:true,lastHash:previousHash,count:records.length};
}
