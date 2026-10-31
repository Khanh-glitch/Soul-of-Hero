"""C20 early source glitch light/displacement, neutral fields only."""
import json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]);w,h=384,216;rows=[]
for tick in (20,45,64,84):
    result={'tick':tick,'scope':'C20 early authored light/displacement only, zero base; not live world or full cast'};regions=[]
    for kind in ('light','disp'):
        a=np.fromfile(p/f'original_{tick}.{kind}32f',dtype='<f4').reshape(h,w,4)
        b=np.fromfile(p/f'native_{tick}.{kind}32f',dtype='<f4').reshape(h,w,4)
        delta=np.abs(a-b); result[kind+'_mae']=float(delta.mean());result[kind+'_max']=float(delta.max())
        Image.fromarray(np.clip(delta.max(axis=2)*255,0,255).astype('uint8')).save(p/f'{tick}_{kind}_heat.png')
        for y in range(6):
            for x in range(8):
                r=delta[y*h//6:(y+1)*h//6,x*w//8:(x+1)*w//8]
                regions.append({'field':kind,'x':x,'y':y,'mae':float(r.mean()),'max':float(r.max())})
    result['regions']=regions; rows.append(result)
    print('C20_EARLY_COMPARE',json.dumps({k:v for k,v in result.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(rows,indent=2))
