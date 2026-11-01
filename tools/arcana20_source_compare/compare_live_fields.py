"""Compare captured pre-world A fields at shared recorded ticks, no color keys.

Moving #09 actor positions are independently simulated and differ across runs;
its raw field differences therefore do not isolate a treatment effect. #11's
rotor source is driven by its source clock, not target AI. Neither comparison
is a full source or same-frame linear/HDR world parity claim.
"""
import json, pathlib, sys
import numpy as np
b,a,out=map(pathlib.Path,sys.argv[1:4]); out.mkdir(parents=True,exist_ok=True)
def records(p): return {int(x.stem[4:]):x for x in p.glob('r17_*.json')}
bm,am=records(b),records(a); reports=[]
for tick in sorted(bm.keys() & am.keys()):
    bj,aj=bm[tick],am[tick]; br=json.loads(bj.read_text()); ar=json.loads(aj.read_text())
    x=np.fromfile(bj.with_suffix('.rgb32f'),'<f4').reshape(234,416,3)
    y=np.fromfile(aj.with_suffix('.rgb32f'),'<f4').reshape(234,416,3)
    bc=np.fromfile(bj.with_suffix('.coverage32f'),'<f4'); ac=np.fromfile(aj.with_suffix('.coverage32f'),'<f4')
    bi=np.fromfile(bj.with_suffix('.influence8'),'u1')!=0; ai=np.fromfile(aj.with_suffix('.influence8'),'u1')!=0
    union=int(np.count_nonzero(bi|ai)); intersect=int(np.count_nonzero(bi&ai)); d=np.abs(x.astype('float64')-y.astype('float64'))
    r={'tick':tick,'skill':br['skill'],'before_scale':br['source_scale'],'candidate_scale':ar['source_scale'],
       'before_coverage_range':[float(bc.min()),float(bc.max())], 'candidate_coverage_range':[float(ac.min()),float(ac.max())],
       'before_rgb_max':x.max(axis=(0,1)).tolist(),'candidate_rgb_max':y.max(axis=(0,1)).tolist(),
       'before_rgb_sum':x.astype('float64').sum(axis=(0,1)).tolist(), 'candidate_rgb_sum':y.astype('float64').sum(axis=(0,1)).tolist(),
       'before_influence_pixels':int(bi.sum()),'candidate_influence_pixels':int(ai.sum()),'influence_iou':intersect/union if union else None,
       'rgb_mae_full_frame':float(d.mean()),'rgb_max_abs_diff':float(d.max()),
       'before_chosen_bolt':br['chosen_bolt'],'candidate_chosen_bolt':ar['chosen_bolt'],
       'before_player':br['player'],'candidate_player':ar['player'],
       'scope':'native source fields at identical recorded ticks; actor placements may differ; not a matched world contrast measurement'}
    reports.append(r)
    print('::notice title=R17_FIELD_BEFORE_AFTER::'+json.dumps(r,separators=(',',':')))
if not reports: raise SystemExit('no common exact recorded source ticks')
(out/'full-field-before-after.json').write_text(json.dumps(reports,indent=2)+'\n')
