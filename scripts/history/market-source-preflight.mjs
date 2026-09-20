import fs from 'node:fs/promises';
const mic=String(process.env.MARKET_MIC||'').toUpperCase();if(!mic)throw Error('MARKET_MIC ontbreekt');
const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const m=registry.markets?.[mic];if(!m)throw Error(`BRONONDERZOEK VERPLICHT: ${mic} heeft nog geen source-discovery dossier`);
if(m.status!=='APPROVED')throw Error(`BRONONDERZOEK NIET GOEDGEKEURD: ${mic} status=${m.status||'UNKNOWN'}`);
if(!m.catalogSource||!Array.isArray(m.historySources)||!m.historySources.length)throw Error(`BRONPLAN ONVOLLEDIG: ${mic}`);
if(!m.historySources.some(x=>x.role==='PRIMARY'))throw Error(`BRONPLAN ZONDER PRIMARY: ${mic}`);
if(!m.discovery?.testedDifficultSymbols||m.discovery.testedDifficultSymbols<10)throw Error(`BRONONDERZOEK TE DUN: test minimaal 10 moeilijke symbolen voor ${mic}`);
console.log(JSON.stringify({gate:'PASS',mic,catalogSource:m.catalogSource,historySources:m.historySources,discovery:m.discovery},null,2));
