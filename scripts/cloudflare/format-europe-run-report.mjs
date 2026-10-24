import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Keep issue #205 readable. Full instrument-level evidence remains in artifacts.
export function renderEuropeReport(report,runUrl='',sourceProbe=null) {
  const lines=['### Europe daily run'];
  if(runUrl)lines.push(`Run: ${runUrl}`);
  if(!report)return [...lines,'**Summary unavailable.** Inspect workflow jobs and artifacts.'].join('\n');
  const t=report.totals||{};
  lines.push(`Status: **${report.status||'UNKNOWN'}**`);
  lines.push(`History: **${report.historyCompleteness||'NOT_VERIFIED'}**`);
  if(report.freshnessCutoff&&report.sessionConsistency?.complete){
    lines.push(`Completed trading-session cutoff (UTC): **${report.freshnessCutoff}**. Compare daily missing counts only against audits with the same cutoff; a newer trading day can turn yesterday's valid bars into stale bars without deleting stored history.`);
  }else if(report.sessionConsistency){
    lines.push('**SESSION DATE UNVERIFIED:** update/audit shards disagree on the completed-session cutoff or omit it; do not compare these totals with a previous run.');
    for(const issue of (report.sessionConsistency.anomalies||[]).slice(0,4))lines.push(`- Session anomaly: ${issue.kind||'all'} shard ${issue.shard??'?'} ${issue.issue}`);
  }
  lines.push(`All expected markets accounted for: **${report.marketCoverage?(report.marketCoverage.complete?'yes':'no'):'not independently checked'}**`);
  if(report.marketCoverage?.complete===false){
    const auditMissing=(report.marketCoverage.anomalies||[]).some(a=>a.kind==='audit'||a.issue==='DUPLICATE_PLAN_MARKET');
    lines.push(auditMissing?'**PARTIAL AUDIT: audited markets are missing or invalid; totals must not be compared with complete 31-market baselines.**':'**PARTIAL RUN: audit market coverage is complete, but update reports are missing or invalid; import totals are unknown and the run is not verified.**');
  }
  lines.push('','| Metric | Count |','|---|---:|');
  for(const [label,key] of [['Catalog','catalog'],['Current open/close','currentOpenClose'],['Official no-trade','verifiedNoTrades'],['Missing open/close','missingOpenClose'],['Failed imports','failedImports'],['Deferred missing','deferredMissing'],['Historical backfill failures','historicalBackfillFailures']])
    lines.push(`| ${label} | ${t[key]??'unknown'} |`);
  if(Number.isInteger(t.recentInvalidOhlcDays))lines.push(`| Incomplete OHLC dates in last 30 calendar days | ${t.recentInvalidOhlcDays} |`);
  if(Number.isInteger(t.recentInvalidOhlcInstruments))lines.push(`| Instruments with recent incomplete OHLC | ${t.recentInvalidOhlcInstruments} |`);
  if(report.historicalOhlcDebt?.readOnly){
    if(report.historicalOhlcDebt.complete===false)
      lines.push('Historical OHLC debt audit: **UNVERIFIED** (partial shards or inconsistent session cutoff; no European debt count may be inferred).');
    else {
      lines.push(`Historical incomplete OHLC dates queued for read-only source review: **${report.historicalOhlcDebt.datesInRecoveryQueue??'unknown'}** (not repaired).`);
      const debt=report.historicalOhlcDebt.byMarket||[];
      if(debt.length)lines.push('Largest historical OHLC debt: '+debt.slice(0,5).map(m=>`${m.mic} ${m.defectiveDates}`).join(', ')+'.');
    }
  }
  // A complete-looking stored candle may coexist with a contradictory
  // same-date row. This is storage provenance evidence, not a correction.
  const duplicateEvidence=report.storedOhlcDuplicateEvidence;
  if(duplicateEvidence?.readOnly){
    if(!duplicateEvidence.complete)lines.push('Stored duplicate-date OHLC conflict audit: **UNVERIFIED** (one or more audit shards lack consistent evidence).');
    else {
      lines.push(`Stored duplicate-date OHLC conflicts (read-only, separate from incomplete candles): **${duplicateEvidence.dates}**.`);
      if(duplicateEvidence.byMarket?.length)lines.push('Largest stored conflicts: '+duplicateEvidence.byMarket.slice(0,5).map(m=>`${m.mic} ${m.conflictingDates}`).join(', ')+'.');
      lines.push('Contradictory stored rows are not resolved by choosing a complete-looking duplicate; existing bars remain unchanged.');
    }
  }
  const anomalies=report.marketCoverage?.anomalies||[];
  if(anomalies.length)lines.push('',`**Market coverage anomalies:** ${anomalies.length}`, ...anomalies.slice(0,6).map(x=>`- ${x.kind||'plan'} shard ${x.shard??'?'}: ${x.issue} ${x.mic||''}`));
  const defects=Object.entries(report.invalidOhlcByDefect||{}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(defects.length){
    lines.push('','### Existing incomplete OHLC evidence','| Defect | Affected records |','|---|---:|');
    for(const [defect,count] of defects)lines.push(`| ${defect} | ${count} |`);
    lines.push('A candle can have multiple defects. Append-only storage preserves existing records; this is read-only repair evidence, not a claim that records were corrected.');
  }
  const missingReasons=Object.entries(report.missingByReason||{}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(missingReasons.length)lines.push('','### Why current prices are missing',...missingReasons.map(([reason,count])=>`- ${reason}: ${count}`));
  lines.push('','### Largest remaining gaps','| MIC | Missing | Import failures |','|---|---:|---:|');
  for(const m of (report.recoveryPriority||[]).slice(0,12))lines.push(`| ${m.mic} | ${m.missingOpenClose??'?'} | ${m.importFailures??'?'} |`);
  const reasons=(report.recoveryPriority||[]).filter(m=>m.missingReasons&&Object.keys(m.missingReasons).length).slice(0,8);
  if(reasons.length){
    lines.push('','### Current missing causes by exchange','| MIC | Stale last trade | Invalid OHLC | No stored history |','|---|---:|---:|---:|');
    for(const m of reasons)lines.push(`| ${m.mic} | ${m.missingReasons.STALE_LAST_TRADE||0} | ${m.missingReasons.INCOMPLETE_OR_INVALID_OHLC||0} | ${m.missingReasons.NO_HISTORY_PARTITIONS||0} |`);
    lines.push('These are cutoff-specific audit categories, not evidence that stored history was deleted.');
  }
  const blockers=(report.recoveryPriority||[]).slice(0,5).map(m=>{
    const x=report.sourceFailureByMarket?.[m.mic];
    if(!x?.failed)return null;
    const top=Object.entries(x.categories||{}).sort((a,b)=>b[1]-a[1]).slice(0,2);
    return `- ${m.mic}: ${top.map(([category,count])=>`${category} ${count}`).join(', ')}`;
  }).filter(Boolean);
  if(blockers.length)lines.push('','### Top import failure categories',...blockers);
  if(sourceProbe?.status==='COMPLETED'&&Number.isFinite(Date.parse(sourceProbe.generatedAt))&&
     Date.parse(sourceProbe.generatedAt)>=Date.parse(report.generatedAt)&&
     Date.parse(sourceProbe.generatedAt)-Date.parse(report.generatedAt)<20*60*1000){
    lines.push('','### Historical source check (read-only)',`Probed: ${sourceProbe.requested??0}; ${Object.entries(sourceProbe.counts||{}).map(([status,count])=>`${status} ${count}`).join(', ')}.`,
      'Complete source bars are correction candidates only. No stored OHLC has been overwritten.');
    const coverage=sourceProbe.probeCoverage;
    if(coverage?.readOnly&&Number.isSafeInteger(coverage.uniqueInstruments)&&coverage.probedDates===sourceProbe.requested){
      lines.push(`Distinct instruments sampled: **${coverage.uniqueInstruments}/${coverage.probedDates}** date probes; repeat-date probes on the same MIC/ISIN: ${coverage.repeatedInstrumentDates}.`);
      const london=coverage.byMarket?.XLON;
      if(london){
        const noRange=london.failuresByCategory?.NO_NEW_BARS_IN_RANGE||0;
        lines.push(`London source sample: ${london.uniqueInstruments} distinct ISIN across ${london.probes} dates; ${noRange} NO_NEW_BARS_IN_RANGE (not proof of delisting).`);
      }
    }
    const sourceQuality=sourceProbe.sourceBarDiagnostics;
    if(sourceQuality?.readOnly&&Number.isSafeInteger(sourceQuality.observations)&&Number.isSafeInteger(sourceQuality.invalidSourceBars)){
      lines.push(`Exact-date source OHLC diagnostics (read-only): ${sourceQuality.invalidSourceBars} invalid source bars in ${sourceQuality.observations} provider-result observations; ${sourceQuality.probesWithInvalidBars||0} instrument/date probes affected.`);
      if(Number.isSafeInteger(sourceQuality.distinctFeedObservations)&&Number.isSafeInteger(sourceQuality.feedLevelInvalidBarsLowerBound)&&sourceQuality.distinctFeedObservations<=sourceQuality.observations&&sourceQuality.feedLevelInvalidBarsLowerBound<=sourceQuality.invalidSourceBars){
        lines.push('Underlying-feed accounting: '+sourceQuality.distinctFeedObservations+' feed/date observations versus '+sourceQuality.observations+' provider attempts; at least '+sourceQuality.feedLevelInvalidBarsLowerBound+' invalid bars at feed/date level (conservative lower bound, not exact deduplication).');
        if(sourceQuality.correlatedProviderAttempts>0)lines.push('Correlated provider attempts: '+sourceQuality.correlatedProviderAttempts+'; Yahoo chart and Yahoo ISIN resolver are not independent source confirmations.');
      }
      if(Number.isSafeInteger(sourceQuality.conflictingSourceObservations)&&sourceQuality.conflictingSourceObservations>0){
        const londonConflicts=sourceQuality.byMarket?.XLON?.conflictingSourceObservations||0;
        lines.push(`Conflicting complete same-date source observations: ${sourceQuality.conflictingSourceObservations} (London ${londonConflicts}). These were rejected as repair candidates; no source bar was selected.`);
      }
      if(Number.isSafeInteger(sourceQuality.mixedSourceObservations)&&sourceQuality.mixedSourceObservations>0){
        const londonMixed=sourceQuality.byMarket?.XLON?.mixedSourceObservations||0;
        lines.push(`Mixed complete/invalid same-date source observations: ${sourceQuality.mixedSourceObservations} (London ${londonMixed}). Such provider attempts were rejected, not repaired.`);
      }
      if(Number.isSafeInteger(sourceQuality.missingExactDateObservations)&&Number.isSafeInteger(sourceQuality.distinctFeedNoExactDateObservations)&&Number.isSafeInteger(sourceQuality.discordantExactDateFeedObservations)&&
         sourceQuality.missingExactDateObservations>=sourceQuality.distinctFeedNoExactDateObservations&&sourceQuality.missingExactDateObservations<=sourceQuality.observations){
        const londonMissing=sourceQuality.byMarket?.XLON?.missingExactDateObservations||0;
        lines.push(`Exact-date source absence: ${sourceQuality.missingExactDateObservations} provider attempts (London ${londonMissing}), ${sourceQuality.distinctFeedNoExactDateObservations} feed/date absences confirmed across observed adapters, ${sourceQuality.discordantExactDateFeedObservations} correlated feed/date disagreements. Missing source bars do NOT prove no trading or delisting.`);
      }
      const londonQuality=sourceQuality.byMarket?.XLON;
      if(londonQuality){
        const causes=Object.entries(londonQuality.defects||{}).filter(([,count])=>Number.isSafeInteger(count)&&count>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
        lines.push(`London exact-date source quality: ${londonQuality.invalidSourceBars} invalid bars; ${causes.map(([key,count])=>key+' '+count).join(', ')||'no field-level defects observed'}.`);
        // A source observation is a provider attempt, not a distinct stored
        // candle. Provider attribution makes London source triage actionable.
        const providers=Object.entries(londonQuality.byProvider||{})
          .filter(([id,counts])=>/^[a-z0-9-]+$/.test(id)&&Number.isSafeInteger(counts?.invalidSourceBars)&&counts.invalidSourceBars>0)
          .sort((a,b)=>b[1].invalidSourceBars-a[1].invalidSourceBars).slice(0,5);
        if(providers.length)lines.push('London invalid source bars by approved provider attempt: '+providers.map(([id,counts])=>id+' '+counts.invalidSourceBars).join(', ')+'.');
        // Two Yahoo adapters ultimately query the same Yahoo chart feed.
        // Report source families separately; route counts are not independent
        // source corroboration and must never authorize a history correction.
        const families=Object.entries(londonQuality.bySourceFamily||{})
          .filter(([id,counts])=>/^[a-z0-9-]+$/.test(id)&&Number.isSafeInteger(counts?.invalidSourceBars)&&counts.invalidSourceBars>0)
          .sort((a,b)=>b[1].invalidSourceBars-a[1].invalidSourceBars).slice(0,5);
        if(families.length)lines.push('London invalid source bars by underlying feed: '+families.map(([id,counts])=>id+' '+counts.invalidSourceBars).join(', ')+'. Yahoo chart and Yahoo ISIN resolver are correlated routes, not independent price sources.');

      }
      lines.push('These are provider-source defects, not additional stored-history defects or verified replacement prices.');
    }
    const severity=sourceProbe.storedOhlcViolationSeverity;
    if(severity?.readOnly&&severity.complete&&severity.metric==='INTRINSIC_STORED_CANDLE_VIOLATION_NOT_SOURCE_COMPARISON'){
      const buckets=severity.counts||{};
      const severe=(buckets.FROM_100_TO_1000_BPS||0)+(buckets.AT_LEAST_1000_BPS||0);
      const london=(severity.byMarket||[]).find(x=>x.mic==='XLON');
      lines.push(`Stored-candle OHLC violations >=100 bps: **${severe}/${severity.examined}** across the last 30 days (not source-price differences).`);
      if(london)lines.push(`London stored-candle violations >=100 bps: **${london.atLeast100Bps}/${london.examined}**.`);
      lines.push('These are intrinsic stored-bar consistency defects, not verified replacement prices; no existing bars were modified.');
    }else if(severity?.readOnly){
      lines.push('Stored-candle severity evidence is partial or unverified; no completeness claim.');
    }

  }
  lines.push('','Full instrument-level failures, audit results and source evidence are in the **europe-run-summary** artifact.');
  return lines.join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2]||'research/output/europe-run-summary.json';
  let report=null;
  try{report=JSON.parse(await fs.readFile(path,'utf8'));}catch(e){console.error('EUROPE_SUMMARY_READ_FAILED '+e.message);}
  const url=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:'';
  let sourceProbe=null;
  try{sourceProbe=JSON.parse(await fs.readFile('research/output/europe-incomplete-ohlc-source-probe.json','utf8'));}catch{}
  console.log(renderEuropeReport(report,url,sourceProbe));
}
