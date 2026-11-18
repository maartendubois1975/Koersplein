// Evidence-scoped historical diagnostics. This module never repairs prices.
export function assessPeriod(bars, {maxGapDays=30,jumpRatio=1.5}={}) {
  const issues=[], seen=new Set(), valid=[];
  const ordered=[...bars].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  for(const bar of ordered){
    if(!validDate(bar?.date)){issues.push({date:bar?.date??null,kind:'INVALID_DATE'});continue}
    if(seen.has(bar.date)){issues.push({date:bar.date,kind:'DUPLICATE_DATE'});continue}
    seen.add(bar.date);
    const open=Number(bar.open),close=Number(bar.close);
    if(bar.open==null||bar.close==null||!Number.isFinite(open)||!Number.isFinite(close)||open<=0||close<=0){
      issues.push({date:bar.date,kind:'INVALID_OPEN_CLOSE'});continue
    }
    const high=bar.high==null?null:Number(bar.high),low=bar.low==null?null:Number(bar.low);
    if(high==null||low==null){issues.push({date:bar.date,kind:'MISSING_HIGH_LOW'})}
    else if(!Number.isFinite(high)||!Number.isFinite(low)||low<=0||high<Math.max(open,close)||low>Math.min(open,close)){
      issues.push({date:bar.date,kind:'INVALID_OHLC'});continue
    }
    const prev=valid.at(-1);
    if(prev){
      const days=(Date.parse(bar.date)-Date.parse(prev.date))/86400000;
      if(days>maxGapDays)issues.push({date:bar.date,previousDate:prev.date,kind:'LONG_GAP',days});
      const ratio=close/prev.close;
      if(ratio>jumpRatio||ratio<1/jumpRatio)issues.push({date:bar.date,previousDate:prev.date,kind:'UNVERIFIED_PRICE_JUMP',ratio});
    }
    valid.push({date:bar.date,close});
  }
  const affected=new Set(issues.map(x=>x.date).filter(Boolean));
  return {records:bars.length,firstDate:valid[0]?.date??null,lastDate:valid.at(-1)?.date??null,issues,
    cleanObservationDates:valid.filter(x=>!affected.has(x.date)).map(x=>x.date),
    adjustmentStatus:'UNVERIFIED',totalReturnStatus:'UNVERIFIED',
    researchReturnStatus:'BLOCKED_PENDING_INDEPENDENT_CORPORATE_ACTION_AND_POINT_IN_TIME_UNIVERSE_EVIDENCE'};
}

export function latestCloseChange(bars, quality=assessPeriod(bars)) {
  if (!Array.isArray(bars) || bars.length<2) return {percent:null,reason:'INSUFFICIENT_HISTORY'};
  const ordered=[...bars].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const last=ordered.at(-1),prev=ordered.at(-2);
  if (!Number.isFinite(Number(last.close)) || !Number.isFinite(Number(prev.close)) ||
      last.close==null || prev.close==null || Number(last.close)<=0 || Number(prev.close)<=0)
    return {percent:null,reason:'INVALID_CLOSE'};
  const blockingKinds=new Set(['LONG_GAP','UNVERIFIED_PRICE_JUMP','INVALID_OHLC','INVALID_OPEN_CLOSE','MISSING_HIGH_LOW','DUPLICATE_DATE']);
  const issue=quality.issues.find(item=>item.date===last.date&&blockingKinds.has(item.kind));
  if (issue) return {percent:null,reason:issue.kind};
  return {percent:(Number(last.close)/Number(prev.close)-1)*100,reason:null};
}
