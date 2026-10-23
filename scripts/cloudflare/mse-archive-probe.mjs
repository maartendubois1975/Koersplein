// One-off, approved-source, read-only archive investigation; never a price importer.
import fs from 'node:fs/promises';
import {probeMseArchive} from './mse-archive-evidence.mjs';
const target=process.env.MSE_ARCHIVE_TARGET_DATE||'2026-10-22';
let report;
try{report=await probeMseArchive(target);}
catch(error){report={targetDate:target,status:'UNAVAILABLE',error:String(error.message).slice(0,300),readOnly:true,priceWrites:0,ohlcAvailable:false};}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/mse-archive-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log('MSE_ARCHIVE_EVIDENCE',JSON.stringify({status:report.status,targetDate:target,pdfEntries:report.pdfEntries,inspected:report.inspected,equities:report.equities,error:report.error}));
