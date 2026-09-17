import fs from 'node:fs/promises';
const OUT='research/output/machine2-feed'; await fs.mkdir(OUT,{recursive:true});
const series=[
 {name:'USD_EUR',key:'EXR/D.USD.EUR.SP00.A'},
 {name:'GBP_EUR',key:'EXR/D.GBP.EUR.SP00.A'}
];
const report={retrievedAt:new Date().toISOString(),series:[],failures:[]};
for(const s of series){
 const url=`https://data-api.ecb.europa.eu/service/data/${s.key}?format=csvdata&includeHistory=true`;
 try{const r=await fetch(url,{headers:{Accept:'text/csv'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const text=await r.text();await fs.writeFile(`${OUT}/ecb-${s.name.toLowerCase()}-vintage.csv`,text);report.series.push({signal:s.name,url,bytes:Buffer.byteLength(text),includeHistory:true,status:'RAW_VINTAGE_CAPTURED'});}catch(e){report.failures.push({signal:s.name,error:String(e)});}
}
await fs.writeFile(`${OUT}/ecb-vintage-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
