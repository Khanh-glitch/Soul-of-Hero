"""Spatial source-component diagnostic. Alpha forced opaque in both inputs;
RGB comparisons are not a world-coverage/visual acceptance gate."""
import json, pathlib, struct, sys
from PIL import Image
root = pathlib.Path(sys.argv[1]); w,h=416,234
results=[]
for tick in (90,180,270):
    a=(root/f'original_{tick}.rgba8').read_bytes()
    b=(root/f'native_{tick}.rgba8').read_bytes()
    if len(a)!=w*h*4 or len(b)!=len(a): raise SystemExit('unexpected frame bytes')
    im_a=Image.frombytes('RGBA',(w,h),a); im_b=Image.frombytes('RGBA',(w,h),b)
    im_a.save(root/f'original_{tick}.png'); im_b.save(root/f'native_{tick}.png')
    heat=Image.new('RGB',(w,h)); hp=heat.load(); total=0; maxerr=0
    regions=[[0,0,0] for _ in range(48)]
    for p in range(w*h):
        dif=[abs(a[4*p+c]-b[4*p+c]) for c in range(3)]
        e=max(dif); maxerr=max(e,maxerr); total+=sum(dif)
        x=p%w; y=p//w; idx=min(7,x*8//w)+8*min(5,y*6//h)
        regions[idx][0]+=sum(dif); regions[idx][1]+=3; regions[idx][2]=max(regions[idx][2],e)
        hp[x,y]=(e,0,0)
    heat.save(root/f'{tick}_heat.png')
    raw_a=(root/f'original_{tick}.rgb32f').read_bytes(); raw_b=(root/f'native_{tick}.rgb32f').read_bytes()
    floats_a=struct.unpack('<%df'%(w*h*3),raw_a); floats_b=struct.unpack('<%df'%(w*h*3),raw_b)
    hdr_abs=sum(abs(x-y) for x,y in zip(floats_a,floats_b))/len(floats_a)
    result={'tick':tick,'time':tick/60,'rgb_mae':total/(w*h*3),'rgb_max':maxerr,'hdr_mae':hdr_abs,
      'regions':[{'x':i%8,'y':i//8,'mae':r[0]/r[1], 'max':r[2]} for i,r in enumerate(regions)],
      'coverage_iou':'not measured: explicit source operation coverage not matched',
      'scope':'A05 pre-burst component only, black source canvas, not live world'}
    results.append(result)
    print('A05_SOURCE_COMPARE',json.dumps({k:v for k,v in result.items() if k!='regions'}),flush=True)
(root/'comparison.json').write_text(json.dumps(results,indent=2))
