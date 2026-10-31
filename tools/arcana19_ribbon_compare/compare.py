"""Compare primitive-level D WebGL RGBA8 and clipped native RGB, not coverage
or world/creator acceptance. Include spatial region and error PNG evidence."""
import json, pathlib, sys
import numpy as np
from PIL import Image
out=pathlib.Path(sys.argv[1]); cases=json.loads(pathlib.Path('tools/arcana19_ribbon_compare/cases.json').read_text()); rows=[]
for c in cases:
 name=c['name'];a=np.fromfile(out/f'{name}.original.rgba8',dtype=np.uint8).reshape(270,480,4)[::-1,:,:3].astype(np.float32)/255
 for variant in ('native','triangle'):
  b=np.clip(np.fromfile(out/f'{name}.{variant}.rgb32f',dtype='<f4').reshape(270,480,3),0,1)
  if not np.isfinite(b).all():raise SystemExit('nonfinite native ribbon')
  am=np.any(a!=0,axis=2);bm=np.any(b!=0,axis=2);union=np.count_nonzero(am|bm);inter=np.count_nonzero(am&bm);diff=np.abs(a-b)
  Image.fromarray(np.rint(a*255).astype('uint8'),'RGB').save(out/f'{name}.original.png')
  Image.fromarray(np.rint(b*255).astype('uint8'),'RGB').save(out/f'{name}.{variant}.png')
  Image.fromarray(np.minimum(diff.max(axis=2)*255*4,255).astype('uint8'),'L').save(out/f'{name}.{variant}.error.png')
  masks=np.zeros((270,480,3),dtype='uint8');masks[:,:,0]=np.where(bm&~am,255,0);masks[:,:,1]=np.where(am&bm,255,0);masks[:,:,2]=np.where(am&~bm,255,0);Image.fromarray(masks).save(out/f'{name}.{variant}.support.png')
  regions=[{'x':x,'y':y,'mae':float(diff[y*45:(y+1)*45,x*60:(x+1)*60].mean()),'max':float(diff[y*45:(y+1)*45,x*60:(x+1)*60].max())} for y in range(6) for x in range(8)]
  row={'case':name,'variant':variant,'light_support_iou':float(inter/union) if union else None,'support_union':int(union),'rgb_mae':float(diff.mean()),'rgb_max':float(diff.max()),'regions':regions,'scope':'original isolated D WebGL RibbonBatch vs native CPU on neutral black; RGB support is not authored alpha, world, or approval'}
  rows.append(row);print('D19_RIBBON_COMPARE',json.dumps({k:v for k,v in row.items() if k!='regions'}),flush=True)
(out/'comparison.json').write_text(json.dumps(rows,indent=2))
