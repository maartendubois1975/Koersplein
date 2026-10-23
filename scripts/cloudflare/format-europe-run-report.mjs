import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Keep issue #205 readable. Full instrument-level evidence remains in artifacts.
export function renderEuropeReport(report,runUrl='') {
  const lines=['### Europe daily run'];
  if(runUrl)lines.push(`Run: ${runUrl}`);
  if(!report)return [...lines,'**Summary unavailable.** Inspect workflow jobs and artifacts.'].join('\n');
  const t=report.totals||{};
  lines.push(`Status: **${report.status||'UNKNOWN'}**`);
  lines.push(`History: **${report.historyCompleteness||'NOT_VERIFIED'}**`);
  lines.push(`All expected markets accounted for: **${report.marketCoverage?(report.marketCoverage.complete?'yes':'no'):'not independently checked'}**`);
  lines.push('','| Metric | Count |','|---|---:|');
  for(const [label,key] of [['Catalog','catalog'],['Current open/close','currentOpenClose'],['Official no-trade','verifiedNoTrades'],['Missing open/close','missingOpenClose'],['Failed imports','failedImports'],['Deferred missing','deferredMissing'],['Historical backfill failures','historicalBackfillFailures']])
    lines.push(`| ${label} | ${t[key]??'unknown'} |`);
  const anomalies=report.marketCoverage?.anomalies||[];
  if(anomalies.length)lines.push('',`**Market coverage anomalies:** ${anomalies.length}`, ...anomalies.slice(0,6).map(x=>`- ${x.kind||'plan'} shard ${x.shard??'?'}: ${x.issue} ${x.mic||''}`));
  const defects=Object.entries(report.invalidOhlcByDefect||{}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(defects.length){
    lines.push('','### Existing incomplete OHLC evidence','| Defect | Affected records |','|---|---:|');
    for(const [defect,count] of defects)lines.push(`| ${defect} | ${count} |`);
    lines.push('A candle can have multiple defects. Append-only storage preserves existing records; this is read-only repair evidence, not a claim that records were corrected.');
  }
  lines.push('','### Largest remaining gaps','| MIC | Missing | Import failures |','|---|---:|---:|');
  for(const m of (report.recoveryPriority||[]).slice(0,12))lines.push(`| ${m.mic} | ${m.missingOpenClose??'?'} | ${m.importFailures??'?'} |`);
  lines.push('','Full instrument-level failures, audit results and source evidence are in the **europe-run-summary** artifact.');
  return lines.join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2]||'research/output/europe-run-summary.json';
  let report=null;
  try{report=JSON.parse(await fs.readFile(path,'utf8'));}catch(e){console.error('EUROPE_SUMMARY_READ_FAILED '+e.message);}
  const url=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:'';
  console.log(renderEuropeReport(report,url));
}
