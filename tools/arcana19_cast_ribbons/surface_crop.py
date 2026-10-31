"""Surface small lossless crops around maximum GPU discrepancy via check annotations."""
import base64, io, json, pathlib, sys
import numpy as np
from PIL import Image
out=pathlib.Path(sys.argv[1]); tick=489
original=np.fromfile(out/f'tick{tick}.original.rgba8',dtype=np.uint8).reshape(270,480,4)[::-1,:,:3]
gpu=np.fromfile(out/f'tick{tick}.gpu.rgba8',dtype=np.uint8).reshape(270,480,4)[:,:,:3]
native=np.clip(np.fromfile(out/f'tick{tick}.native.rgb32f',dtype='<f4').reshape(270,480,3)*255,0,255).astype('uint8')
diff=np.abs(original.astype('int16')-gpu.astype('int16')).max(axis=2)
y,x=np.unravel_index(diff.argmax(),diff.shape)
x0=max(0,min(448,int(x)-16));y0=max(0,min(238,int(y)-16))
print('::notice title=D19_CROP_INFO::'+json.dumps({'tick':tick,'max_xy':[int(x),int(y)],'max_error_255':int(diff[y,x]),'rect':[x0,y0,32,32]}))
for name,arr in [('original',original),('gpu',gpu),('native',native)]:
    image=Image.fromarray(arr[y0:y0+32,x0:x0+32],'RGB'); buf=io.BytesIO();image.save(buf,format='PNG',optimize=True)
    encoded=base64.b64encode(buf.getvalue()).decode()
    if len(encoded)>3500: raise ValueError('crop too large for one annotation')
    print(f'::notice title=D19_CROP_{name.upper()}::{encoded}')
