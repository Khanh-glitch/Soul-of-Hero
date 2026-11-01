"""Expose one 1x detail crop of an actual indexed native frame, with bounds.

The full uncropped frame remains in the input artifact and paired video. The
crop targets the midpoint of the selected recorded source connector; actor and
camera positions are not matched across independent moving-world runs.
"""
import json, pathlib, subprocess, sys
p=pathlib.Path(sys.argv[1]); requested=int(sys.argv[2]); label=sys.argv[3]
reports=[json.loads(q.read_text()) for q in p.glob('r17_*.json')]
r=next(r for r in reports if r['requested_tick']==requested); q=r['chosen_bolt']
if not q.get('a') or not q.get('b'): raise SystemExit('recorded frame has no connector')
x=(q['a'][0]+q['b'][0])/2; y=(q['a'][1]+q['b'][1])/2
m=r['source_to_world']; c=r['canvas_transform']; wx=m[0]*x+m[2]*y+m[4]; wy=m[1]*x+m[3]*y+m[5]
cx=max(192,min(1088,round(2*(c[0]*wx+c[2]*wy+c[4])))); cy=max(108,min(612,round(2*(c[1]*wx+c[3]*wy+c[5]))))
timeline=json.loads((p/'timeline.json').read_text()); frame=p/timeline['frames'][r['frame_index']]['file']
print('R17_FRAME_REVIEW',label,'requested',requested,'recorded_tick',r['source_tick'],'frame',frame.name,'center',cx,cy,flush=True)
subprocess.run(['python3','prototypes/arcana_fusion20/renderer/native_review_surface.py',str(frame),label,str(cx),str(cy)],check=True)
