import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../../config/research/paris-v1.json',import.meta.url),'utf8'));
const expected=['BUILD_BASE_RATES','BUILD_POINT_IN_TIME_FEATURES','RUN_BLIND_RESEARCH','SCORE_FORWARD_OUTCOMES','RUN_HINDSIGHT_DIAGNOSTICS','VALIDATE_RESEARCH','BUILD_HUMAN_CONCLUSION','BUILD_SITE_RESEARCH_OUTPUT','PROMOTE_RESEARCH_VERSION'];
if(cfg.market!=='PARIS') throw new Error('Phase A must be PARIS only');
if(JSON.stringify(cfg.pipeline)!==JSON.stringify(expected)) throw new Error('Pipeline order changed');
if(!cfg.point_in_time.forbid_future||!cfg.validation.unseen_holdout_required) throw new Error('Leakage/holdout guard missing');
if(!cfg.outputs.human_conclusion_required||!cfg.outputs.site_output_required) throw new Error('Required conclusion/site output missing');
console.log('Paris Research Factory contract: PASS');
