import fs from 'node:fs';import path from 'node:path';
const ECB='https://data-api.ecb.europa.eu/service/data';
const series=[
 {id:'ecb-usd-eur',family:'fx',flow:'EXR',key:'D.USD.EUR.SP00.A',score:'delta'},
 {id:'ecb-fr-long-rate',family:'rates',flow:'IRS',key:'M.FR.L.L40.CI.0000.EUR.N.Z',score:'delta'}
];
const csv=(s)=>{const lines=s.trim().split(/\r?\n/),h=lines[0].split(',');return lines.slice(1).map(l=>{const a=l.split(',');return Object.fromEntries(h.map((k,i)=>[k,a[i]]))})};
export async function fetchEcbPointInTime(){const events=[];for(const s of series){const u=`${ECB}/${s.flow}/${s.key}?format=csvdata&detail=full&includeHistory=true`;const r=await fetch(u);if(!r.ok)throw new Error(`ECB ${s.id} HTTP ${r.status}`);const rows=csv(await r.text());let prev=null;for(const x of rows){const period=x.TIME_PERIOD||x['TIME PERIOD'];const value=Number(x.OBS_VALUE||x['OBS VALUE']);if(!period||!Number.isFinite(value))continue;const available=(x['LAST UPDATE']||x.LAST_UPDATE||x['OBS_STATUS_DATE']||'').replace(' ','T');const available_at=available?(available.endsWith('Z')?available:available+'Z'):null;if(!available_at)continue;const signed=prev===null?0:Math.sign(value-prev);events.push({id:`${s.id}:${period}:${available_at}`,event_at:period,available_at,source:'ECB Data Portal',source_url:u,family:s.family,market:'PARIS',signed_score:signed,payload:{value,series:s.key}});prev=value;}}return events;}
export async function writeParisMacro(file='data/research/paris-events-v1.json'){const events=await fetchEcbPointInTime();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({schema_version:1,market:'PARIS',generated_at:new Date().toISOString(),sources:['ECB Data Portal includeHistory=true'],events},null,2));return {file,events:events.length};}
if(import.meta.url===`file://${process.argv[1]}`)console.log(await writeParisMacro());
