export function deriveMacroRegime(snapshot) {
  const get=n=>snapshot.find(x=>x.signalName===n)?.normalizedValue;
  const num=n=>{const v=Number(get(n));return Number.isFinite(v)?v:null};
  const inflation=num('core_cpi_yoy'), policy=num('policy_rate'), curve=num('yield_curve_10y2y'), growth=num('industrial_production_yoy'), stress=num('financial_stress');
  const known=[inflation,policy,curve,growth,stress].filter(v=>v!==null).length;
  return {signalName:'macro_regime',knownInputs:known,labels:{inflation:inflation==null?'UNKNOWN':inflation>3?'HIGH':'NORMAL',rates:policy==null?'UNKNOWN':policy>3?'HIGH':'LOWER',curve:curve==null?'UNKNOWN':curve<0?'INVERTED':'NORMAL',growth:growth==null?'UNKNOWN':growth<0?'CONTRACTING':'EXPANDING',stress:stress==null?'UNKNOWN':stress>1?'ELEVATED':'NORMAL'},parentEvidenceIds:snapshot.filter(x=>['core_cpi_yoy','policy_rate','yield_curve_10y2y','industrial_production_yoy','financial_stress'].includes(x.signalName)).map(x=>x.evidenceId)};
}
