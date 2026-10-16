// Nasdaq XNAS official current snapshot; research only, no production publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseUSDirectory} from './usa-directory-parse.mjs';
import {buildNasdaqCatalog} from './usa-nasdaq-catalog.mjs';
const SOURCE='https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
const response=await fetch(SOURCE,{headers:{'User-Agent':'Koersplein-XNAS-research/1.0'}});
if(!response.ok)throw Error('NASDAQ_DIRECTORY_HTTP_'+response.status);
const {rows,sourceTimestamp,sha256}=parseUSDirectory(await response.text(),
 ['Symbol','Security Name','Market Category','Test Issue','Financial Status','Round Lot Size','ETF','NextShares']);
const generatedAt=new Date().toISOString();
const {securities,summary}=buildNasdaqCatalog(rows,{source:SOURCE,sourceTimestamp,sourceSha256:sha256,generatedAt});
const out='research/output/usa/XNAS';
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'universe.json'),JSON.stringify({
 generatedAt,source:SOURCE,sourceTimestamp,sourceSha256:sha256,
 exchange:'XNAS',snapshotOnly:true,securities},null,2));
await fs.writeFile(path.join(out,'coverage.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
