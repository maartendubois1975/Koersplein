import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const OUT='research/output/machine2-feed';
await fs.mkdir(OUT,{recursive:true});
const retrievedAt=new Date().toISOString();
const urls=[
 'https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/netto-shortposities-actueel',
 'https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/netto-shortposities-historie'
];
const report={retrievedAt,sources:urls,records:0,failures:[],status:'SOURCE_DISCOVERY'};
// AFM biedt op beide registers CSV/XML exports. We bewaren de officiële register-URL als bron
// en laten alleen records toe wanneer ISIN, positiedatum, positiehouder en percentage aanwezig zijn.
// De daadwerkelijke export-URL wordt niet gegokt: discovery moet hem uit de AFM-pagina halen.
function record({isin,issuer,holder,position,positionDate,sourceUrl}){
 if(!isin||!positionDate||!holder||!Number.isFinite(Number(position))) throw new Error('Onvolledig AFM shortrecord');
 const observedAt=`${positionDate}T00:00:00Z`;
 const e={source:'AFM_NET_SHORT_REGISTER',sourceTier:'A',urlOrStableId:sourceUrl,observedAt,publishedAt:null,availableAt:null,entity:isin,family:'POSITIONING',signalName:'net_short_position_public',valueOrClaim:Number(position),metadata:{issuer,holder},revisionStatus:'ORIGINAL_REGISTER_EVENT',retrievedAt,status:'QUARANTINE_UNTIL_PUBLICATION_TIME_PROVEN'};
 e.contentHash=crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex');return e;
}
await fs.writeFile(`${OUT}/afm-short-report.json`,JSON.stringify(report,null,2));
await fs.writeFile(`${OUT}/afm-short-normalizer-contract.json`,JSON.stringify({required:['isin','issuer','holder','position','positionDate','sourceUrl'],rule:'Positiedatum is niet automatisch publicatietijd. Geen trainingsgebruik tot beschikbaarheidstijd bewezen is.'},null,2));
console.log(JSON.stringify(report,null,2));
export {record};
