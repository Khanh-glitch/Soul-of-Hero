"""Report authored line call divergence independently of raster/color errors."""
import json, pathlib, sys
out=pathlib.Path(sys.argv[1])
for tick in (72,192,312,489,510,528,558,582):
    a=json.loads((out/f'tick{tick}.original.calls.json').read_text())
    b=json.loads((out/f'tick{tick}.native.calls.json').read_text())
    diffs=[]
    for i,(x,y) in enumerate(zip(a,b)):
        xa,ya=x['pts'],y['pts']
        if len(xa)!=len(ya):
            diffs.append({'call':i,'original_points':len(xa)//2,'native_points':len(ya)//2})
        else:
            err=max((abs(v-w) for v,w in zip(xa,ya)), default=0)
            if err>0.01:
                diffs.append({'call':i,'max_coordinate_delta':round(err,4),'original_head':xa[:2],'native_head':ya[:2]})
    print('D19_CAST_LINE_CALLS',json.dumps({'tick':tick,'original_count':len(a),'native_count':len(b),'divergent_pairs':len(diffs),'first_divergences':diffs[:2]},separators=(',',':')),flush=True)
