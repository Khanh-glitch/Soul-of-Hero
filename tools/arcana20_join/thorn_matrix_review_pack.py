"""Prepare unscaled screenshots of twelve actual real-world range diagnostics."""
import json, pathlib, sys
from PIL import Image, ImageDraw
root,out=map(pathlib.Path,sys.argv[1:3]); sha=sys.argv[3]
data=json.loads((root/'matrix.json').read_text())
assert len(data['cases']) == 12
out.mkdir(parents=True,exist_ok=True)
sheet=Image.new('RGB',(5120,2256),'black'); draw=ImageDraw.Draw(sheet)
for i,case in enumerate(data['cases']):
    assert len(case['shots'])==3
    # The original renderer's bloom starts at 5.85 sec (tick ~351).
    shot=case['shots'][1]
    image=Image.open(root/shot['file']).convert('RGB'); assert image.size==(1280,720)
    image.save(out/f'bloom_{i:02d}.jpg','JPEG',quality=70,optimize=True,subsampling=0)
    x,y=(i%4)*1280,(i//4)*752;sheet.paste(image,(x,y))
    text=(f"C15 {data['lighting']} distance {case['distance']} bearing {case['bearing']} "
          f"tick~{shot['tick_last_observed']} 1x; zoom 0.32 diagnostic")
    draw.text((x+4,y+725),text,fill='white')
sheet.save(out/f"thorn_matrix_{data['lighting']}.jpg",'JPEG',quality=40,optimize=True,progressive=True)
data['avfx_sha']=sha
(out/'matrix.json').write_text(json.dumps(data,indent=2)+'\n')
print('THORN_MATRIX_REVIEW cases=12, 1280x720 unscaled, actual source ticks; zoom=0.32')
