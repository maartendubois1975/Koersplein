import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const exists=async p=>{try{await fs.access(p);return true}catch{return false}};
const cfg=await read('data/research-director.json');
const candidates=[];
for(const market of ['amsterdam','brussels']){
  for(const suffix of ['machine1-summary.json','machine2-summary.json']){
    const p=`research/output/${market}-${suffix}`;
    if(await exists(p)) candidates.push({market,source:p,data:await read(p)});
  }
}
const ideas=[
 {id:'RD-001',hypothesis:'Versnelling van 3m momentum ten opzichte van 6m momentum verhoogt de kans op een latere sterke koersbeweging.',test:'Meet uitsluitend point-in-time momentumversnelling, vergelijk met gematchte controles en kruis Amsterdam naar Brussel.',reject:'Verwerp wanneer de blinde markt geen positieve lift boven de basisfrequentie toont.'},
 {id:'RD-002',hypothesis:'Een herstel na drawdown gevolgd door consolidatie bevat meer informatie dan momentum alleen.',test:'Vergelijk herstel+consolidatie met dezelfde momentum-baseline in chronologische walk-forward vensters.',reject:'Verwerp wanneer het complexe signaal de eenvoudige baseline out-of-sample niet verslaat.'},
 {id:'RD-003',hypothesis:'Kansen clusteren in marktregimes waarin de breedte van stijgende aandelen versnelt.',test:'Bepaal marktbreedte uitsluitend met informatie beschikbaar op T en test dezelfde drempels blind op de andere markt.',reject:'Verwerp wanneer het effect verdwijnt na regime- en multiple-testingcontrole.'}
];
const agenda={generatedAt:new Date().toISOString(),director:cfg.name,inputs:candidates.map(x=>({market:x.market,source:x.source})),state:candidates.length?'READY_TO_RESEARCH':'WAITING_FOR_INPUTS',principles:['point-in-time only','chronological walk-forward','frozen predictions','blind cross-market validation','baseline challenger','record all trials'],nextExperiments:ideas,nextBlindMarket:cfg.markets.blindExam};
await fs.mkdir('research/output/director',{recursive:true});
await fs.writeFile('research/output/director/research-agenda.json',JSON.stringify(agenda,null,2));
console.log(JSON.stringify(agenda,null,2));