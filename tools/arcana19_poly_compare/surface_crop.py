"""Expose lossless crops and coordinates at worst polygon fragment error."""
import base64,io,json,pathlib,sys
import numpy as np
from PIL import Image
out=pathlib.Path(sys.argv[1])
for case in ('thin','rotated'):
    source=np.fromfile(out/f'{case}.original.rgba8',dtype=np.uint8).reshape(270,480,4)[::-1,:,:3]
    native=np.clip(np.rint(np.fromfile(out/f'{case}.native.rgb32f',dtype='<f4').reshape(270,480,3)*255),0,255).astype(np.uint8)
    diff=np.abs(source.astype(np.int16)-native.astype(np.int16)).max(axis=2)
    y,x=np.unravel_index(diff.argmax(),diff.shape)
    x0=max(0,min(464,int(x)-8));y0=max(0,min(254,int(y)-8))
    print('::notice title=D19_POLY_CROP_INFO::'+json.dumps({'case':case,'max_xy':[int(x),int(y)],'max_error_255':int(diff[y,x]),'source_rgb':source[y,x].tolist(),'native_rgb':native[y,x].tolist(),'rect':[x0,y0,16,16]}))
    for name,arr in [('source',source),('native',native)]:
        image=Image.fromarray(arr[y0:y0+16,x0:x0+16],'RGB'); buf=io.BytesIO();image.save(buf,format='PNG',optimize=True)
        print(f'::notice title=D19_POLY_CROP_{case}_{name}::{base64.b64encode(buf.getvalue()).decode()}')
