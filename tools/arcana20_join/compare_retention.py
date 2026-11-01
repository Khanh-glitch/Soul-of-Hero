"""Matched observed counter deltas, not proof that allocations are leaks."""
import json
import pathlib
import sys
baseline = json.loads(pathlib.Path(sys.argv[1]).read_text())
fx = json.loads(pathlib.Path(sys.argv[2]).read_text())
assert baseline['no_fx'] and not fx['no_fx'] and baseline['skill'] == fx['skill']
a = {x['label']: x for x in baseline['samples']}; b = {x['label']:x for x in fx['samples']}
keys = ['nodes','objects','resources','static_bytes','texture_bytes','video_bytes']
result = {'skill':fx['skill'], 'scope':'difference of per-process deltas from each round baseline; engine cache variation included; not GPU hardware proof', 'rounds':{}}
for round_id in range(1,7):
    start=f'round{round_id}_baseline'; end=f'round{round_id}_after_4'
    result['rounds'][str(round_id)] = {k: (b[end][k]-b[start][k])-(a[end][k]-a[start][k]) for k in keys}
result['texture_instances'] = {'observed': len(fx.get('texture_lifetimes', [])), 'alive_after_cancel': sum(x['alive_after_cancel'] for x in fx.get('texture_lifetimes', [])), 'by_role': {role: {'observed': sum(x['role']==role for x in fx.get('texture_lifetimes', [])), 'alive_after_cancel': sum(x['alive_after_cancel'] for x in fx.get('texture_lifetimes', []) if x['role']==role)} for role in sorted({x['role'] for x in fx.get('texture_lifetimes', [])})}}
print('::notice title=AVFX_RETENTION_DIFFERENCE::'+json.dumps(result,separators=(',',':')))
pathlib.Path(sys.argv[3]).write_text(json.dumps({'comparison':result,'no_fx':baseline,'fx':fx}, indent=2)+'\n')
