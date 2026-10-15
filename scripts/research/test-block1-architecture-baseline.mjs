import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const paths = [
  '.github/workflows/complete-market-analysis.yml',
  '.github/workflows/daily-opportunity-ledger.yml',
  'scripts/research/complete-market-pipeline.mjs',
  'scripts/research/independent-market-judge.mjs',
  'scripts/research/model-arena.mjs',
  'scripts/research/europe-machine-arena-readiness.mjs'
];
const source = await Promise.all(paths.map(p => fs.readFile(p, 'utf8')));
const [complete, daily, pipeline, judge, models, readiness] = source;
const checks = {
  publicationOwnerSeparated: complete.includes('contents: read') && daily.includes('contents: write'),
  oosUnverified: pipeline.includes('outOfSampleValidated:false'),
  holdoutUnverified: pipeline.includes('holdoutValidated:false'),
  elevenMachinesUnverified: pipeline.includes('allElevenMachinesCompared:false'),
  independentJudgeDiagnosticOnly: judge.includes('NOT_VALIDATED'),
  modelArenaConfigurationOnly: models.includes('CONFIGURED'),
  structuralReadinessNotMisrepresented: readiness.includes('STRUCTURAL_CONTRACT_ONLY_NOT_DATA_READY') && !readiness.includes('READY_TO_EXECUTE_PHASE_1')
};
console.log(JSON.stringify({status:'READ_ONLY_ARCHITECTURE_BASELINE',checks},null,2));
assert.ok(Object.values(checks).every(Boolean),'Architecture changed: inspect before changing gates');
