"""Four unscaled source-field snapshots from actual captured frame indices.

Diagnostic x/(1+x) view of original C light or original A HDR versus complete
native A fusion HDR. Reference roles are NOT complete Gold fusion or post.
"""
import base64, io, json, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
root=pathlib.Path(sys.argv[1]); skill=int(sys.argv[2]); timeline=json.loads((root/'timeline.json').read_text()); frames=timeline['frames']; font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
if skill==9:
    m=json.loads((root/'c09_full_reference_manifest.json').read_text())
    refs={r['frame_index']:r for r in m['rows'] if 'skipped' not in r}
else: refs={i:f for i,f in enumerate(frames) if 'r17_full_source_field' in f}
def image(path,w,h,n):
    arr=np.maximum(np.fromfile(path,'<f4').reshape(h,w,n)[:,:,:3],0); arr=np.rint(arr/(1+arr)*255).astype('uint8')
    return Image.fromarray(arr,'RGB').resize((416,234),Image.Resampling.NEAREST)
for target in (int(sys.argv[3]),):
    i=min(refs,key=lambda i:abs(frames[i]['r17_source_tick']-target)); f=frames[i]; t=f['r17_source_tick']
    if skill==9: original=image(root/f'r17_full_{i:05d}.c.light32f',384,216,4); label='Original C light (separate pass, no post)'
    else: original=image(root/f'a11_original_{t}.rgb32f',416,234,3); label='Original A full rotor source (no post)'
    native=image(root/f['r17_full_source_field'],416,234,3)
    out=Image.new('RGB',(832,258),(17,20,25)); out.paste(original,(0,24));out.paste(native,(416,24));d=ImageDraw.Draw(out)
    d.text((3,3),f'{label}, tick {t}',font=font,fill='white');d.text((419,3),'Native full A fusion HDR; NOT Gold',font=font,fill='white')
    b=io.BytesIO();out.save(b,'JPEG',quality=48,optimize=True);s=base64.b64encode(b.getvalue()).decode('ascii')
    for part in range(0,len(s),3500): print(f'::notice title=R17_SOURCE_{skill}_{target}_tick{t}_{part//3500}::{s[part:part+3500]}')
