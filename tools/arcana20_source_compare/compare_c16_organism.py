"""Spatial C16 selected living membrane source fields: authored ink coverage, signed HDR and
world displacement/shade. Original and native use zero base and same seed."""
import json, pathlib, sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); w,h=384,216; rows=[]
for tick in (180,240,300,381,456,510,558):
    fields={}
    for who in ('original','native'):
        for kind in ('ink','light','disp'):
            v=np.fromfile(p/f'{who}_{tick}.{kind}32f',dtype='<f4')
            if v.size!=w*h*4: raise SystemExit(f'bad buffer {who} {kind} {tick}')
            fields[who,kind]=v.reshape(h,w,4)
    a,b=fields['original','ink'],fields['native','ink']
    am=np.fromfile(p/f'original_{tick}.coverage.u8',dtype='u1').reshape(h,w)!=0
    bm=np.fromfile(p/f'native_{tick}.coverage.u8',dtype='u1').reshape(h,w)!=0
    union=np.count_nonzero(am|bm); inter=np.count_nonzero(am&bm)
    metrics={}; regions=[]
    for kind in ('ink','light','disp'):
        diff=np.abs(fields['original',kind]-fields['native',kind])
        metrics[kind+'_mae']=float(diff.mean()); metrics[kind+'_max']=float(diff.max())
        heat=np.clip(np.max(diff,axis=2)*255,0,255).astype('uint8')
        Image.fromarray(heat,'L').save(p/f'{tick}_{kind}_heat.png')
        for ry in range(6):
            for rx in range(8):
                r=diff[ry*h//6:(ry+1)*h//6,rx*w//8:(rx+1)*w//8]
                regions.append({'field':kind,'x':rx,'y':ry,'mae':float(r.mean()),'max':float(r.max())})
    for who,arr in (('original',a),('native',b)):
        Image.fromarray(np.clip(np.rint(arr*255),0,255).astype('uint8'),'RGBA').save(p/f'{who}_{tick}.png')
    mask=np.zeros((h,w,3),dtype=np.uint8)
    mask[:,:,0]=np.where(bm & ~am,255,0); mask[:,:,1]=np.where(am & bm,255,0); mask[:,:,2]=np.where(am & ~bm,255,0)
    Image.fromarray(mask,'RGB').save(p/f'{tick}_coverage_iou.png')
    row={'tick':tick,'authored_write_coverage_iou':float(inter/union) if union else None,'coverage_union':int(union),
         **metrics,'regions':regions,'scope':'C16 original layered leaves and cellular/inner petals only, on zero base, seed119785; no other growth, post or world'}
    rows.append(row); print('C16_ORGANISM_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(p/'comparison.json').write_text(json.dumps(rows,indent=2))

# Strict source-field regression, not world or visual approval. A small fixed
# absolute error allows float32 round-off; coverage must be exact.
for row in rows:
    if row['authored_write_coverage_iou'] != 1.0 or any(row[k+'_max'] > 1e-6 for k in ('ink','light','disp')):
        raise SystemExit(f"source field regression at tick {row['tick']}")
