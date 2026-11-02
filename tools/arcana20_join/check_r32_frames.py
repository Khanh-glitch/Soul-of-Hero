#!/usr/bin/env python3
from PIL import Image,ImageChops
from pathlib import Path
import hashlib
O=Path(__file__).resolve().parents[2]/'prototypes/arcana_fusion20/r32_direction'; keys={'04':[f'beat{i}.png' for i in range(1,7)],'13':[f'beat{i}.png' for i in range(1,7)],'19':[f'tick{i}.png' for i in [1,120,360,516,546,588]]}
for r in keys:
 for l in ['normal','dimmed']:
  hashes=[];base=Image.open(O/f'base-{l}.png').convert('RGB');changes=[]
  for f in keys[r]:
   im=Image.open(O/r/l/f).convert('RGB'); assert im.size==(1280,720);hashes.append(hashlib.sha256(im.tobytes()).hexdigest());diff=ImageChops.difference(im,base); assert diff.crop((0,0,1280,105)).getbbox() is None;assert diff.crop((0,675,1280,720)).getbbox() is None;changes.append(diff.getbbox())
  assert len(set(hashes))==6,(r,l,changes);print(r,l,'distinct 6; diff bbox:',changes)
