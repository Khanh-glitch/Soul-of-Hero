"""Compare authored C ink coverage, premultiplied RGB and signed HDR light.
These are selected contour operations, not the complete spell or world."""
import json, pathlib, sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); w,h=384,216; rows=[]
for tick in (270,324,396,450,540):
    fields={}
    for who in ('original','native'):
        for kind in ('ink','light'):
            path=p/f'{who}_{tick}.{kind}32f'
            v=np.fromfile(path,dtype='<f4')
            if v.size!=w*h*4: raise SystemExit(f'bad buffer {path}')
            fields[who,kind]=v.reshape(h,w,4)
    a=fields['original','ink']; b=fields['native','ink']
    am=a[:,:,3]>0; bm=b[:,:,3]>0
    union=np.count_nonzero(am|bm); inter=np.count_nonzero(am&bm)
    diff=np.abs(a-b); ld=np.abs(fields['original','light']-fields['native','light'])
    for who,arr in (('original',a),('native',b)):
        Image.fromarray(np.clip(np.rint(arr*255),0,255).astype('uint8'),'RGBA').save(p/f'{who}_{tick}.png')
    heat=np.clip(np.max(diff,axis=2)*255,0,255).astype('uint8')
    Image.fromarray(heat,'L').save(p/f'{tick}_ink_heat.png')
    regions=[]
    for ry in range(6):
        for rx in range(8):
            r=diff[ry*h//6:(ry+1)*h//6,rx*w//8:(rx+1)*w//8]
            regions.append({'x':rx,'y':ry,'ink_mae':float(r.mean()),'ink_max':float(r.max())})
    row={'tick':tick,'authored_ink_coverage_iou':float(inter/union) if union else None,'coverage_union':int(union),
      'ink_mae':float(diff.mean()),'ink_max':float(diff.max()),'light_mae':float(ld.mean()),'light_max':float(ld.max()),'regions':regions,
      'scope':'C selected first contour field on zero base, A warp and other C geometry excluded'}
    rows.append(row); print('C20_CONTOUR_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(rows,indent=2))
