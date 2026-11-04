import {readFile,writeFile} from 'node:fs/promises';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('Expected source and destination');
const input=JSON.parse(await readFile(source,'utf8'));
if(input.market!=='XAMS'||!Array.isArray(input.candidates))throw Error('Invalid candidate report');
const rows=input.candidates.map(row=>({...row,sourceVerified:false,sessionClosedVerified:false}));
const review={market:'XAMS',date:input.date,rows,reviewRequired:true};
await writeFile(destination,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({date:input.date,candidates:rows.length,approved:0,reviewRequired:true}));
