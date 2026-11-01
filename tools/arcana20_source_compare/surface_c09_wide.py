"""Surface complete, unresized #09 raw fields at a captured source tick.

JPEG annotations are only an approximate quicklook; the workflow artifact
retains the original float fields and the 2x video. Reference C has a fixed
viewport and different graph/timing/no source post. This is not Gold parity.
"""
import base64,io,json,pathlib,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(sys.argv[1]);requested=int(sys.argv[2]);t=json.loads((root/'timeline.json').read_text());m=json.loads((root/'c09_full_reference_manifest.json').read_text());rows=[r for r in m['rows'] if 'skipped' not in r];r=min(rows,key=lambda r:abs(r['tick']-requested));i=r['frame_index'];f=t['frames'][i];w,h=f['r17_source_size']
if (w,h)!=(624,352):raise SystemExit('not expanded source')
def image(path,width,height,channels):
 a=np.maximum(np.fromfile(path,'<f4').reshape(height,width,channels)[:,:,:3],0);return Image.fromarray(np.rint(a/(1+a)*255).astype('uint8'),'RGB')
c=image(root/f'r17_full_{i:05d}.c.light32f',384,216,4);a=image(root/f['r17_full_source_field'],w,h,3);out=Image.new('RGB',(1008,390),(18,21,27));out.paste(c,(0,38));out.paste(a,(384,38));d=ImageDraw.Draw(out);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
d.text((4,3),f'C raw light; tick {r["tick"]}; outside anchors {r["reference_nodes_outside"]}',font=font,fill='white');d.text((388,3),'Full native A+B+C source; no world/post',font=font,fill='white');d.text((4,20),'Original C has different graph, timing, fixed viewport; NOT Gold parity',font=font,fill='white')
for quality in (55,40,25,15,8):
 b=io.BytesIO();out.save(b,'JPEG',quality=quality,optimize=True);s=base64.b64encode(b.getvalue()).decode('ascii')
 if len(s)<=34000:break
if len(s)>34000:raise SystemExit('quicklook exceeds 10-annotation limit; raw fields retained')
print(f'C09_SOURCE_QUICKLOOK requested={requested} tick={r["tick"]} JPEG quality={quality} outside={r["reference_nodes_outside"]}')
for part in range(0,len(s),3500):print(f'::notice title=R17_WIDE_{requested}_tick{r["tick"]}_{part//3500}::{s[part:part+3500]}')
