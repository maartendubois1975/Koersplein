// Read-only research artifact; no catalog, provider, or price-store writes.
import fs from 'node:fs/promises';
import {auditEuropeSourceCoverage} from './europe-source-coverage-evidence.mjs';
const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const evidence={generatedAt:new Date().toISOString(),...auditEuropeSourceCoverage(registry)};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-source-coverage-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log('EUROPE_SOURCE_COVERAGE_EVIDENCE',JSON.stringify({
 marketsExamined:evidence.marketsExamined,attributionReviewMarkets:evidence.attributionReviewMarkets,
 priority:evidence.markets.filter(x=>['XSWX','XLON','XCYS','XBUL'].includes(x.mic)).map(x=>({mic:x.mic,chartCovered:x.chartCovered,catalog:x.catalog,coverageNotExplainedByDirectChart:x.coverageNotExplainedByDirectChart,classification:x.classification}))
}));
