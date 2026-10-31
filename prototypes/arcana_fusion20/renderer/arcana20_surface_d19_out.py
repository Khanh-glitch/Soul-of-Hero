"""Lossless-colour, nearest-size crop of actual current-world D19 OUT.
Difference is for positioning only, never a rendering mask or approximation.
"""
import base64,io,json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]);label=sys.argv[2]
names={'start':'out_start_tick516','withdraw':'out_withdraw_tick540','converge':'out_converge_tick564','last':'out_last_tick587'}
baseline=np.asarray(Image.open(p/'phase_baseline.png').convert('RGB'))
start=np.asarray(Image.open(p/'phase_19_out_start_tick516.png').convert('RGB'))
img=np.asarray(Image.open(p/f'phase_19_{names[label]}.png').convert('RGB'))
ys,xs=np.where(np.any(start!=baseline,axis=2))
if not len(xs):raise ValueError('D19 start image has no world contribution')
h,w=img.shape[:2];cx=int((xs.min()+xs.max())/2);cy=int((ys.min()+ys.max())/2)
x0=max(0,min(w-240,cx-120));y0=max(0,min(h-168,cy-84))
crop=Image.fromarray(img[y0:y0+168,x0:x0+240],'RGB').resize((96,67),Image.Resampling.NEAREST)
b=io.BytesIO();crop.save(b,format='PNG',optimize=True);encoded=base64.b64encode(b.getvalue()).decode()
print(f'::notice title=D19_OUT_WORLD_INFO::{json.dumps({"label":label,"rect":[x0,y0,240,168],"scope":"actual frozen current overworld; downsampled preview; not Gold or creator approval"})}')
for i in range(0,len(encoded),2800): print(f'::notice title=D19_OUT_WORLD_{label}_{i//2800}::{encoded[i:i+2800]}')
