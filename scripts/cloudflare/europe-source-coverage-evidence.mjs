// Read-only source registry evidence. Discovery coverage is not equivalent to
// direct Yahoo-chart OHLC coverage, nor proof of an independently verified
// ISIN -> ticker -> venue -> currency route. Never changes provider approval.
export function auditEuropeSourceCoverage(registry) {
  const markets=[];
  for(const [mic,entry] of Object.entries(registry?.markets||{})) {
    const discovery=entry.discovery||{};
    const yahoo=(entry.historySources||[]).find(s=>s.provider==='yahoo-chart' && /Full-catalog preflight:\s*\d+\/\d+/.test(s.note||''));
    if(!yahoo)continue;
    const match=yahoo.note.match(/Full-catalog preflight:\s*(\d+)\/(\d+)/);
    const covered=Number(match[1]),catalog=Number(match[2]);
    const ratio=discovery.coverageRatio;
    const claimed=Number.isFinite(ratio)&&ratio>=0&&ratio<=1 ? Math.round(ratio*catalog) : null;
    const ratioIsIntegral=claimed!==null&&Math.abs(claimed-ratio*catalog)<0.00001;
    const consistentDenominator=Number.isInteger(catalog)&&catalog>0&&covered<=catalog&&
      (discovery.testedFullCatalog===undefined||discovery.testedFullCatalog===catalog);
    const otherPrimary=(entry.historySources||[]).filter(s=>s.role==='PRIMARY'&&s.provider!=='yahoo-chart').map(s=>s.provider);
    const otherIndependent=(entry.historySources||[]).filter(s=>s.role==='INDEPENDENT_FALLBACK_VALIDATION'&&s.provider!=='yahoo-chart').map(s=>s.provider);
    const gap=consistentDenominator&&ratioIsIntegral ? Math.max(0,claimed-covered) : null;
    markets.push({
      mic,catalog,chartCovered:covered,chartUncovered:catalog-covered,
      chartCoverageRatio:covered/catalog,reportedDiscoveryCoverageRatio:ratio??null,
      discoveryImpliedCovered:ratioIsIntegral?claimed:null,
      coverageNotExplainedByDirectChart:gap,
      otherPrimaryProviders:otherPrimary,
      independentValidationProviders:otherIndependent,
      independentCrossCheckedSymbols:discovery.crossCheckedSymbols??null,
      blockedReason:entry.blockedReason||null,
      classification:!consistentDenominator||!ratioIsIntegral?'PREFLIGHT_METADATA_INCONSISTENT':
        gap>0&&otherPrimary.length?'OTHER_PRIMARY_SOURCE_ATTRIBUTION_REVIEW':
        gap>0?'DISCOVERY_VS_DIRECT_CHART_ATTRIBUTION_REQUIRED':'NO_NUMERIC_GAP',
      // A discovery ratio can reflect resolver results, official sources,
      // or historical snapshots. It never approves a new mapping.
      approvedForProduction:false
    });
  }
  markets.sort((a,b)=>(b.coverageNotExplainedByDirectChart??-1)-(a.coverageNotExplainedByDirectChart??-1)||a.mic.localeCompare(b.mic));
  return {mode:'READ_ONLY_SOURCE_COVERAGE_AUDIT',sourceApprovalChanges:0,productionMappingsCreated:0,
    marketsExamined:markets.length,attributionReviewMarkets:markets.filter(x=>x.classification==='DISCOVERY_VS_DIRECT_CHART_ATTRIBUTION_REQUIRED').length,
    metadataInconsistencies:markets.filter(x=>x.classification==='PREFLIGHT_METADATA_INCONSISTENT').length,
    note:'Discovery ratios are not independent OHLC/identity verification. Gaps require per-ISIN, per-MIC authorized-source evidence; never infer no-trade or fabricate OHLC.',markets};
}
