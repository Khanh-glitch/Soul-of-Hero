// R11 test hygiene: tracked, accepted evidence artifacts are immutable during ordinary test runs.
// Any write whose path contains an `evidence/` segment is redirected to an OS temp scratch folder unless the
// operator explicitly regenerates evidence with SOH_WRITE_EVIDENCE=1. Non-evidence writes are unchanged.
import {writeFileSync as rawWrite, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';

export function writeFileSync(file: any, data: any, opts?: any): void {
  const s = String(file);
  let target = s;
  if (/(^|[\\/])evidence[\\/]/.test(s) && process.env.SOH_WRITE_EVIDENCE !== '1') {
    const rel = s.replace(/^.*?evidence[\\/]/, '');
    target = join(tmpdir(), 'soh-evidence-scratch', rel);
  }
  mkdirSync(dirname(resolve(target)), { recursive: true });
  rawWrite(target, data, opts);
}
