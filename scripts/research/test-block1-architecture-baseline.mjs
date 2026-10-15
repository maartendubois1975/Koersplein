import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const paths = [
  '.github/workflows/complete-market-analysis.yml',
  '.github/workflows/daily-opportunity-ledger.yml',
  'scripts/research/complete-market-pipeline.mjs',
  'scripts/research/independent-market-judge.mjs',
  'scripts/research/model-arena.mjs'
];
const source = await Promise.all(paths.map(p => fs.readFile(p, 'utf8')));
const [complete, daily, pipeline, judge, models] = source;
const checks = {
  publicationOwnerSeparated: complete.includes('contents: read') && daily.includes('contents: write'),
  oosUnverified: pipeline.includes('outOfSampleValidated:false'),
  holdoutUnverified: pipeline.includes('holdoutValidated:false'),
  elevenMachinesUnverified: pipeline.includes('allElevenMachinesCompared:false'),
  independentJudgeDiagnosticOnly: judge.includes('NOT_VALIDATED'),
  modelArenaConfigurationOnly: models.includes('CONFIGURED')
};
console.log(JSON.stringify({status:'READ_ONLY_ARCHITECTURE_BASELINE',checks},null,2));
assert.ok(Object.values(checks).every(Boolean),'Architecture changed: inspect before changing gates');
