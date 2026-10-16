// Legacy command intentionally uses the guarded, batched synchronization path.
// Default is read-only; pass --apply explicitly after reviewing the dry run.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, [new URL('./sync-plan.mjs', import.meta.url).pathname, ...process.argv.slice(2)], { stdio:'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
