"""Surface paired crops of actual joined-world C16/A16 screenshots.
The difference is used only to locate a crop, never to key rendering or alpha.
"""
import base64,io,json,pathlib,sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]);names=('fusion_16_a_without_c_living_membranes','fusion_16_living_membranes_with_a')
a,b=[np.asarray(Image.open(p/f'{n}.png').convert('RGB')) for n in names]
mask=np.any(a!=b,axis=2);ys,xs=np.where(mask)
if not len(xs):raise ValueError('no changed world pixel in C16 crop')
cx=int((xs.min()+xs.max())/2);cy=int((ys.min()+ys.max())/2);h,w=a.shape[:2]
x0=max(0,min(w-160,cx-80));y0=max(0,min(h-112,cy-56))
print('::notice title=C16_WORLD_CROP_INFO::'+json.dumps({'rect':[x0,y0,160,112],'changed_pixels':int(mask.sum()),'scope':'actual frozen current overworld; tick120, diagnostic only, not Gold or owner approval'}))
for label,img in zip(('a_without_c','a_plus_c'),(a,b)):
 im=Image.fromarray(img[y0:y0+112,x0:x0+160],'RGB').resize((96,67),Image.Resampling.NEAREST)
 buf=io.BytesIO();im.save(buf,format='PNG',optimize=True);encoded=base64.b64encode(buf.getvalue()).decode()
 for i in range(0,len(encoded),2800):print(f'::notice title=C16_WORLD_CROP_{label}_{i//2800}::{encoded[i:i+2800]}')
