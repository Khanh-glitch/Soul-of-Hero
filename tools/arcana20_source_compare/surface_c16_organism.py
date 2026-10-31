"""Matched C16 ink crops, from source/native field captures, not world acceptance."""
import base64,io,pathlib,sys
from PIL import Image
p=pathlib.Path(sys.argv[1])
for who in ('original','native'):
    im=Image.open(p/f'{who}_381.png').crop((164,43,324,169))
    b=io.BytesIO(); im.save(b,format='PNG',optimize=True)
    encoded=base64.b64encode(b.getvalue()).decode()
    for i in range(0,len(encoded),2800):
        print(f'::notice title=C16_ORGANISM_CROP_{who}_{i//2800}::{encoded[i:i+2800]}')
    print(f'::notice title=C16_ORGANISM_CROP_INFO::{who} tick=381 rect=[164,43,160,126] chunks={(len(encoded)+2799)//2800}')
