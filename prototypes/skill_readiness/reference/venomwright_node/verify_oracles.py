#!/usr/bin/env python3
"""Replays the ORIGINAL Venomwright TypeScript (via reference.ts) against every
immutable GOLD93 oracle file and reports row-level hash agreement.

Usage: verify_oracles.py [oracle_dir] [out_json]
Requires prepare.sh to have built /tmp/gold93-venom-ref (or GOLD93_VENOM_REF_WORK).
This is hash-level synchronisation only; it is not a visual comparison.
"""
import json, os, subprocess, sys, time, glob

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
ORACLE_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'docs/vfx/skill_readiness/oracle')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'results', 'oracle_replay.json')
WORK = os.environ.get('GOLD93_VENOM_REF_WORK', '/tmp/gold93-venom-ref')
FIELDS = ('scene_sha256', 'glow_sha256', 'enemies', 'fx', 'parts')

results = []
for path in sorted(glob.glob(os.path.join(ORACLE_DIR, 'venomwright_0*.json'))):
    o = json.load(open(path))
    rows = o['rows']; sid = o['skill']; maxt = max(r['tick'] for r in rows); cast = o['protocol']['cast_tick']
    t0 = time.time()
    res = subprocess.run([os.path.join(WORK, 'node_modules/.bin/tsx'), 'reference.ts', 'hashes', str(sid), str(cast), str(maxt)],
                         cwd=WORK, capture_output=True, text=True, timeout=900)
    if res.returncode:
        results.append({'canonical_id': o['canonical_id'], 'error': res.stderr[-800:]}); continue
    ours = {r['tick']: r for r in json.loads(res.stdout)}
    bad = []
    for r in rows:
        m = ours.get(r['tick'])
        d = [k for k in FIELDS if m is None or m.get(k) != r.get(k)]
        if d: bad.append({'tick': r['tick'], 'fields': d})
    results.append({'canonical_id': o['canonical_id'], 'skill': sid, 'name': o['name'], 'rows': len(rows),
                    'max_tick': maxt, 'mismatched_rows': len(bad), 'first_mismatch': bad[0] if bad else None,
                    'replay_seconds': round(time.time() - t0, 2)})
    print(results[-1], flush=True)

summary = {'schema': 'gold93/venomwright-original-node-replay/v1', 'source': 'original TypeScript, Node 22 + tsx 4.19.2, display.ts stubbed (DOM/PixiJS presentation only)',
           'pass': all(r.get('mismatched_rows') == 0 for r in results) and len(results) == 21, 'results': results}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(summary, open(OUT, 'w'), indent=2)
print('PASS' if summary['pass'] else 'FAIL', len(results), 'oracles')
