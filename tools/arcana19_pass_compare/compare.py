"""Spatial D19 RGBA8 source scene vs clipped native additive g-layer. Light support
is a measurement only, not authored alpha or brightness keying. The original
source GPU and CPU native have different rasterizations and precision."""
import json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); w,h=480,270; results=[]
for tick in (72,192,312,489,510):
    a=np.fromfile(p/f'original_{tick}.scene.rgba8',dtype='u1').reshape(h,w,4)[::-1,:,:3].astype(np.float32)/255.0
    for variant in ('native','ldr','ldr8'):
        raw_native=np.fromfile(p/f'{variant}_{tick}.scene.rgb32f',dtype='<f4').reshape(h,w,3)
        b=np.clip(raw_native,0,1)
        if not np.isfinite(a).all() or not np.isfinite(raw_native).all():raise SystemExit(f'non-finite source buffer at {tick}')
        ma=np.any(a!=0,axis=2);mb=np.any(b!=0,axis=2);u=np.count_nonzero(ma|mb);inter=np.count_nonzero(ma&mb)
        diff=np.abs(a-b); scale=lambda x: np.clip(np.rint(np.maximum(x,0)/(1+np.maximum(x,0))*255),0,255).astype('uint8')
        Image.fromarray(scale(a),'RGB').save(p/f'{tick}_original_diagnostic.png');Image.fromarray(scale(b),'RGB').save(p/f'{tick}_{variant}_diagnostic.png')
        Image.fromarray(np.clip(diff.max(axis=2)*64,0,255).astype('uint8'),'L').save(p/f'{tick}_{variant}_linear_error.png')
        mask=np.zeros((h,w,3),dtype=np.uint8);mask[:,:,0]=np.where(mb&~ma,255,0);mask[:,:,1]=np.where(ma&mb,255,0);mask[:,:,2]=np.where(ma&~mb,255,0);Image.fromarray(mask).save(p/f'{tick}_{variant}_light_support.png')
        regions=[]
        for y in range(6):
            for x in range(8):
                r=diff[y*h//6:(y+1)*h//6,x*w//8:(x+1)*w//8];regions.append({'x':x,'y':y,'mae':float(r.mean()),'max':float(r.max())})
        row={'tick':tick,'variant':variant,'light_support_iou':float(inter/u) if u else None,'support_union':int(u),'linear_rgb_mae':float(diff.mean()),'linear_rgb_max':float(diff.max()),'original_max':float(a.max()),'native_unclipped_max':float(raw_native.max()),'regions':regions,
          'scope':'source D RGBA8 WebGL g scene vs native CPU variants, neutral base; ldr8 rasterizes CPU call order rather than original grouped batch order; no world, bloom/post or approval'}
        results.append(row);print('D19_LINEAR_SCENE_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(results,indent=2))
