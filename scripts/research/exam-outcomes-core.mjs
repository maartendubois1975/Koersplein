const DAY=86400000;export const HORIZONS=[3,6,12,24],THRESHOLDS=[.10,.20,.30];
export function horizonEndDate(date,months){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isInteger(months)||months<1)throw Error('INVALID_HORIZON');
 const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('INVALID_REFERENCE_DATE');
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);
}
export function thresholdOutcomes(bars,index){const base=Number(bars[index]?.close);if(!Number.isFinite(base)||base<=0)throw Error('OUTCOME_BASE_INVALID');const start=bars[index].date,out={};for(const h of HORIZONS){const end=horizonEndDate(start,h),future=bars.slice(index+1).filter(b=>b.date<=end);let maxUpside=null,maxDrawdown=null,peak=base,dd=0;const hits={};for(const t of THRESHOLDS)hits[String(Math.round(t*100))]=null;for(const b of future){const close=Number(b.close),high=Number.isFinite(Number(b.high))?Number(b.high):close;if(!Number.isFinite(close))continue;const up=high/base-1;maxUpside=maxUpside==null?up:Math.max(maxUpside,up);peak=Math.max(peak,high);dd=Math.min(dd,close/peak-1);for(const t of THRESHOLDS)if(hits[String(Math.round(t*100))]==null&&up>=t)hits[String(Math.round(t*100))]={hit:true,date:b.date,days:Math.round((Date.parse(b.date)-Date.parse(start))/DAY),priceBasis:Number.isFinite(Number(b.high))?'HIGH':'CLOSE_FALLBACK'};}for(const t of THRESHOLDS)if(hits[String(Math.round(t*100))]==null)hits[String(Math.round(t*100))]={hit:false,date:null,days:null,priceBasis:null};out[h+'m']={horizonMonths:h,endDate:end,observations:future.length,censored:!future.length||bars.at(-1).date<end,maxUpside,maxDrawdown:dd,thresholds:hits};}return out;}

export function evaluateOpportunity(prediction,bars,{asOf}={}){
 const endDate=horizonEndDate(prediction.referenceDate,prediction.horizonMonths||3),base=prediction.referenceClose;
 if(!Number.isFinite(base)||base<=0)throw Error('INVALID_REFERENCE_CLOSE');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf||'')||!Number.isFinite(Date.parse(asOf+'T00:00:00Z'))||new Date(asOf+'T00:00:00Z').toISOString().slice(0,10)!==asOf||asOf<prediction.referenceDate)throw Error('INVALID_EVALUATION_REFERENCE');
 const observed=bars.filter(b=>b.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date));
 const reference=observed.find(b=>b.date===prediction.referenceDate);
 if(!reference||reference.close!==base)throw Error('FROZEN_REFERENCE_PRICE_MISMATCH');
 const after=observed.filter(b=>b.date>prediction.referenceDate&&b.date<=endDate);
 const latest=after.at(-1)||reference,closed=observed.at(-1)?.date>=endDate;
 let peak=base,maxDrawdown=0;for(const b of after){peak=Math.max(peak,b.close);maxDrawdown=Math.min(maxDrawdown,b.close/peak-1);}
 const result={evaluationVersion:'bounded-calendar-v1',endDate,status:closed?'CLOSED':'OPEN',latestDate:latest.date,latestClose:latest.close,currentReturn:latest.close/base-1,maxReturn:Math.max(0,...after.map(b=>b.close/base-1)),maxDrawdown,observedThrough:observed.at(-1)?.date};
 for(const level of [10,20,30]){const hit=after.find(b=>b.close>=base*(1+level/100));result['hit'+level]=!!hit;result['hit'+level+'Date']=hit?.date||null;}
 result.result30=closed?result.hit30:null;return result;
}
