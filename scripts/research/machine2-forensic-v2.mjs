export function classifyOutcome(actualReturn) {
  if (actualReturn >= 1) return 'EXTREME_WINNER';
  if (actualReturn <= -0.5) return 'EXTREME_LOSER';
  if (actualReturn >= 0.25) return 'WINNER';
  if (actualReturn <= -0.25) return 'LOSER';
  return 'NORMAL';
}

export function buildForensicCase({prediction,outcome,futureEvidence=[]}) {
  if (!prediction?.predictionId) throw new Error('Frozen prediction vereist');
  const horizon = prediction.outputs.find(x=>x.horizonMonths===outcome.horizonMonths);
  if (!horizon) throw new Error('Horizon ontbreekt');
  const actual = Number(outcome.totalReturn);
  if (!Number.isFinite(actual)) throw new Error('Outcome vereist');
  return {
    predictionId:prediction.predictionId,
    entityId:prediction.entityId,
    predictionTime:prediction.predictionTime,
    horizonMonths:outcome.horizonMonths,
    predictedExpectedReturn:horizon.expectedReturn,
    actualReturn:actual,
    surprise:actual-horizon.expectedReturn,
    outcomeClass:classifyOutcome(actual),
    knownAtPredictionEvidenceIds:prediction.evidenceIds,
    futureEvidenceIds:futureEvidence.map(x=>x.evidenceId),
    researchQuestions:['welke vooraf kenbare signalen werden gemist?','welke signalen werden overgewogen?','welke toekomstige gebeurtenissen verklaren de afwijking?','komt dit patroon elders en eerder voor?'],
    rule:'futureEvidence verklaart en genereert hypotheses maar herschrijft nooit prediction of knownAtPrediction evidence'
  };
}

export function selectForensicPriority(cases) {
  return [...cases].sort((a,b)=>Math.abs(b.surprise)-Math.abs(a.surprise));
}
