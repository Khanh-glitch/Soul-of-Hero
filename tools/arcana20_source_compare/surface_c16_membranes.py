"""Expose matching source/native membrane light crops for visual inspection.
Clipping is preview-only; quantitative field and authored write masks are separate.
"""
import base64, io, pathlib, sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]);tick=381
for who in ('original','native'):
    a=np.fromfile(p/f'{who}_{tick}.light32f',dtype='<f4').reshape(216,384,4)
    rgb=np.clip(np.rint(a[56:156,180:308,:3]*255),0,255).astype('uint8')
    im=Image.fromarray(rgb,'RGB');b=io.BytesIO();im.save(b,format='PNG',optimize=True)
    encoded=base64.b64encode(b.getvalue()).decode()
    for i in range(0,len(encoded),2800):
        print(f'::notice title=C16_MEMBRANE_CROP_{who}_{i//2800}::{encoded[i:i+2800]}')
    print(f'::notice title=C16_MEMBRANE_CROP_INFO::{who} tick={tick} rect=[180,56,128,100] chunks={(len(encoded)+2799)//2800} preview-only')
