import fs from 'node:fs/promises';
const input='research/output/model-arena/amsterdam-brussels.json';
const report=JSON.parse(await fs.readFile(input,'utf8'));
const pct=n=>`${(100*(Number(n)||0)).toFixed(1)}%`;
const trials=report.trials||[];
const best=(report.bestBlind||[])[0]||null;
const directions={XAMS:'Amsterdam',XBRU:'Brussel'};
const ideas=(report.nextResearchIdeas||[]).slice(0,3);
const promoted=trials.filter(x=>x.complexityChallenger?.promote&&x.model!=='momentum').length;
const rejected=trials.filter(x=>x.model!=='momentum'&&!x.complexityChallenger?.promote).length;
const publicReport={
  generatedAt:report.generatedAt||new Date().toISOString(),
  status:'COMPLETED',
  scope:'Amsterdam ↔ Brussel',
  target:report.target||'+30%',
  trials:trials.length,
  promoted,
  rejected,
  best:best?{discovery:directions[best.discover]||best.discover,test:directions[best.test]||best.test,horizonMonths:best.horizonMonths,model:best.model,selected:best.blind?.selected||0,baseRate:pct(best.blind?.baseRate),hitRate:pct(best.blind?.hitRate),lift:pct(best.blind?.lift)}:null,
  nextResearchIdeas:ideas,
  rules:['Alleen informatie beschikbaar op datum T','Regel/drempel wordt vóór de andere markt bevroren','Complexer model moet de momentum-baseline buiten de leermarkt verbeteren'],
  note:'Historische onderzoeksuitkomsten zijn geen voorspelling of rendementsbelofte.'
};
await fs.mkdir('data/research-lab',{recursive:true});
await fs.writeFile('data/research-lab/latest.json',JSON.stringify(publicReport,null,2));
const archivePath='data/research-lab/archive.json';let archive=[];try{archive=JSON.parse(await fs.readFile(archivePath,'utf8'));if(!Array.isArray(archive))archive=[]}catch{}
archive.unshift(publicReport);archive=archive.slice(0,100);await fs.writeFile(archivePath,JSON.stringify(archive,null,2));
console.log(JSON.stringify(publicReport,null,2));