"""Surface paired crops of actual joined-world C16/A16 screenshots.
The difference is used only to locate a crop, never to key rendering or alpha.
"""
import base64,io,json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); organism=len(sys.argv)>2 and sys.argv[2]=='organism'
names=('fusion_16_trial_without_organism','fusion_16_trial_with_organism') if organism else ('fusion_16_a_without_c_living_membranes','fusion_16_living_membranes_with_a')
prefix='C16_ORGANISM_WORLD_CROP' if organism else 'C16_WORLD_CROP'
labels=('without_organism','with_organism') if organism else ('a_without_c','a_plus_c')
wanted_w,wanted_h=(240,168) if organism else (160,112)
a,b=[np.asarray(Image.open(p/f'{n}.png').convert('RGB')) for n in names]
mask=np.any(a!=b,axis=2);ys,xs=np.where(mask)
if not len(xs):raise ValueError('no changed world pixel in C16 crop')
cx=int((xs.min()+xs.max())/2);cy=int((ys.min()+ys.max())/2);h,w=a.shape[:2]
x0=max(0,min(w-wanted_w,cx-wanted_w//2));y0=max(0,min(h-wanted_h,cy-wanted_h//2))
print(f'::notice title={prefix}_INFO::'+json.dumps({'rect':[x0,y0,wanted_w,wanted_h],'changed_pixels':int(mask.sum()),'scope':f'actual frozen current overworld; tick {330 if organism else 120}, diagnostic only, not Gold or owner approval'}))
for label,img in zip(labels,(a,b)):
 im=Image.fromarray(img[y0:y0+wanted_h,x0:x0+wanted_w],'RGB').resize((96,67),Image.Resampling.NEAREST)
 buf=io.BytesIO();im.save(buf,format='PNG',optimize=True);encoded=base64.b64encode(buf.getvalue()).decode()
 for i in range(0,len(encoded),2800):print(f'::notice title={prefix}_{label}_{i//2800}::{encoded[i:i+2800]}')
