"""Selected C20 source polygon/passage HDR comparison. Nonzero support is
only a measurement of additive light, never an alpha/coverage mask."""
import json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); w,h=384,216; rows=[]
for tick in (270,324,378):
    a=np.fromfile(p/f'original_{tick}.light32f',dtype='<f4').reshape(h,w,4)
    b=np.fromfile(p/f'native_{tick}.light32f',dtype='<f4').reshape(h,w,4)
    am=np.any(a[:,:,:3]!=0,axis=2); bm=np.any(b[:,:,:3]!=0,axis=2)
    union=np.count_nonzero(am|bm); inter=np.count_nonzero(am&bm)
    diff=np.abs(a-b)
    mask=np.zeros((h,w,3),dtype=np.uint8); mask[:,:,0]=np.where(bm&~am,255,0); mask[:,:,1]=np.where(am&bm,255,0); mask[:,:,2]=np.where(am&~bm,255,0)
    Image.fromarray(mask).save(p/f'{tick}_light_support.png')
    Image.fromarray(np.clip(diff.max(axis=2)*255,0,255).astype('uint8')).save(p/f'{tick}_light_heat.png')
    regions=[]
    for ry in range(6):
        for rx in range(8):
            r=diff[ry*h//6:(ry+1)*h//6,rx*w//8:(rx+1)*w//8]
            regions.append({'x':rx,'y':ry,'mae':float(r.mean()),'max':float(r.max())})
    row={'tick':tick,'light_support_iou':float(inter/union) if union else None,'support_union':int(union),
      'light_mae':float(diff.mean()),'light_max':float(diff.max()),'regions':regions,
      'scope':'C20 original polygon/passage operations only; contour mask generated but contour ink/light cleared; no bolts, blocks, particles or world'}
    rows.append(row); print('C20_POLYGON_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(rows,indent=2))
