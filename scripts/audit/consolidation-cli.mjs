import { planConsolidatedRun, WRITERS } from './consolidation-plan.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')&&x.includes('=')).map(x=>x.slice(2).split(/=(.*)/s).slice(0,2)));
const writer=args.writer,market=args.market||'XAMS';
if (!writer) {
  console.log(JSON.stringify({mode:'DRY_RUN_ONLY',writers:WRITERS,usage:'node scripts/audit/consolidation-cli.mjs --writer=cloudflare-universal --market=XAMS'},null,2));
} else {
  const plan=planConsolidatedRun({writer,market,environment:args.environment||'staging'});
  console.log(JSON.stringify(plan,null,2));
  if (args.execute || process.argv.includes('--execute')) throw new Error('Execution disabled: this CLI is a planning tool, not a second scheduler');
}
