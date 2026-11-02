#!/usr/bin/env python3
"""Deterministic standalone offline R32 ZIP plus checksums; no native build."""
import argparse, hashlib, zipfile
from pathlib import Path
repo=Path(__file__).resolve().parents[2]; src=repo/'prototypes/arcana_fusion20/r32_direction'
p=argparse.ArgumentParser();p.add_argument('output',type=Path);a=p.parse_args(); files=sorted(x for x in src.rglob('*') if x.is_file());
assert files and (src/'index.html').exists(); a.output.parent.mkdir(parents=True,exist_ok=True)
def zh(z,name,data):
 i=zipfile.ZipInfo(name,(2020,1,1,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,data)
with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 lines=[]
 for f in files:
  name=f.relative_to(src).as_posix();data=f.read_bytes();zh(z,name,data);lines.append(f'{hashlib.sha256(data).hexdigest()}  {name}')
 zh(z,'SHA256SUMS',('\n'.join(lines)+'\n').encode())
print(a.output, 'files',len(files)+1,'bytes',a.output.stat().st_size,'sha256',hashlib.sha256(a.output.read_bytes()).hexdigest())
