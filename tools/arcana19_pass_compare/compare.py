"""Spatial float D19 browser scene vs native additive g-layer. Light support
is a measurement only, not authored alpha or brightness keying. The original
source GPU and CPU native have different rasterizations and precision."""
import json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); w,h=480,270; results=[]
for tick in (72,192,312,489,510):
    a=np.fromfile(p/f'original_{tick}.scene.rgba32f',dtype='<f4').reshape(h,w,4)[::-1,:,:3]
    b=np.fromfile(p/f'native_{tick}.scene.rgb32f',dtype='<f4').reshape(h,w,3)
    if not np.isfinite(a).all() or not np.isfinite(b).all():raise SystemExit(f'non-finite source buffer at {tick}')
    ma=np.any(a!=0,axis=2);mb=np.any(b!=0,axis=2);u=np.count_nonzero(ma|mb);inter=np.count_nonzero(ma&mb)
    diff=np.abs(a-b); scale=lambda x: np.clip(np.rint(np.maximum(x,0)/(1+np.maximum(x,0))*255),0,255).astype('uint8')
    Image.fromarray(scale(a),'RGB').save(p/f'{tick}_original_diagnostic.png');Image.fromarray(scale(b),'RGB').save(p/f'{tick}_native_diagnostic.png')
    Image.fromarray(np.clip(diff.max(axis=2)*64,0,255).astype('uint8'),'L').save(p/f'{tick}_hdr_error.png')
    mask=np.zeros((h,w,3),dtype=np.uint8);mask[:,:,0]=np.where(mb&~ma,255,0);mask[:,:,1]=np.where(ma&mb,255,0);mask[:,:,2]=np.where(ma&~mb,255,0);Image.fromarray(mask).save(p/f'{tick}_light_support.png')
    regions=[]
    for y in range(6):
        for x in range(8):
            r=diff[y*h//6:(y+1)*h//6,x*w//8:(x+1)*w//8];regions.append({'x':x,'y':y,'mae':float(r.mean()),'max':float(r.max())})
    row={'tick':tick,'light_support_iou':float(inter/u) if u else None,'support_union':int(u),'hdr_mae':float(diff.mean()),'hdr_max':float(diff.max()),'original_max':float(a.max()),'native_max':float(b.max()),'regions':regions,
      'scope':'source D WebGL g scene vs native CPU g on neutral base; no real world, bloom/post comparison or approval'}
    results.append(row);print('D19_HDR_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(results,indent=2))
