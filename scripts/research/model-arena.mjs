import fs from 'node:fs/promises';
const cfg=JSON.parse(await fs.readFile('data/research-director.json','utf8'));
const arena={generatedAt:new Date().toISOString(),status:'CONFIGURED',models:[
 {id:'baseline-momentum',family:'baseline',complexity:1,mandatory:true},
 {id:'regularized-linear',family:'linear',complexity:2,mandatory:true},
 {id:'tree-ensemble',family:'tree',complexity:3,mandatory:true},
 {id:'gradient-boosting',family:'boosting',complexity:4,mandatory:true},
 {id:'ensemble',family:'ensemble',complexity:5,mandatory:true}
],features:['momentum-1m','momentum-3m','momentum-6m','momentum-12m','acceleration','volatility','drawdown','distance-52w-high','recovery','consolidation','market-breadth','market-regime'],guards:{chronologicalWalkForward:true,pointInTimeOnly:true,predictionsFrozenBeforeScoring:true,allTrialsRecorded:true,falseDiscoveryTracking:true,complexityMustBeatBaseline:true,blindCrossMarketRequired:true},marketLadder:cfg.markets,promotionRule:'Complexer model gaat alleen door wanneer het op ongeziene data aantoonbaar extra informatie toevoegt boven de baseline.'};
await fs.mkdir('research/output/director',{recursive:true});
await fs.writeFile('research/output/director/model-arena.json',JSON.stringify(arena,null,2));
console.log(JSON.stringify(arena,null,2));