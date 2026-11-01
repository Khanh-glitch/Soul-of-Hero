"""Measure full C raw source and live native chain in source/screen space.

Original C is a re-instantiated different graph, not fusion or world parity.
All nonzero raw samples are retained; bounds are diagnostics, not masking.
"""
import json,math,pathlib,sys
import numpy as np
root=pathlib.Path(sys.argv[1]); timeline=json.loads((root/'timeline.json').read_text());manifest=json.loads((root/'c09_full_reference_manifest.json').read_text()); frames=timeline['frames']; rows=[r for r in manifest['rows'] if 'skipped' not in r]
snapshots=[json.loads(p.read_text()) for p in root.glob('r17_[0-9][0-9][0-9].json')]
if not snapshots: raise SystemExit('missing scale snapshots')
scales={round(float(s['source_scale']),9) for s in snapshots}
if len(scales)!=1: raise SystemExit('source scale varies; cannot reuse snapshot scale')
scale=scales.pop()
def bounds(a):
    mask=np.any(a!=0,axis=2);ys,xs=np.nonzero(mask)
    if not xs.size:return None
    return [int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]
for desired in (87,183,247,327):
    r=min(rows,key=lambda v:abs(v['tick']-desired));idx=r['frame_index'];f=frames[idx]
    c=np.fromfile(root/f'r17_full_{idx:05d}.c.light32f','<f4').reshape(216,384,4)[:,:,:3]
    a=np.fromfile(root/f['r17_full_source_field'],'<f4').reshape(234,416,3)
    positions=[p for p in f['r17_actor_nodes'] if p is not None]
    actor=np.array(positions,dtype=float); spread=(actor.max(axis=0)-actor.min(axis=0)).tolist() if len(actor) else None
    # 416/384 == 234/216: only a uniform C->A similarity. A's recorded
    # physical source scale projects native local units into world/screen.
    cb=bounds(c);ab=bounds(a)
    def size(b,s):return None if b is None else [(b[2]-b[0]+1)*s,(b[3]-b[1]+1)*s]
    report={'tick':r['tick'],'frame':idx,'actor_count':len(positions),'actor_spread_a_local':spread,
      'native_source_bounds':ab,'native_local_axis_extent_world_units':size(ab,scale),
      'original_c_light_bounds':cb,'original_c_local_axis_extent_world_units':size(cb,scale*416/384),
      'native_rgb_sum':a.sum(axis=(0,1),dtype=np.float64).tolist(),
      'original_c_light_rgb_sum':c.sum(axis=(0,1),dtype=np.float64).tolist(),
      'scope':'exact nonzero raw support; original C has different graph/timing, empty base, reseeded particles and no post; no same-frame world HDR/contrast or acceptance'}
    print('::notice title=R17_CHAIN_EXTENT::'+json.dumps(report,separators=(',',':')))
