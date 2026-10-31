"""Spatial source-component diagnostic. Alpha forced opaque in both inputs;
RGB comparisons are not a world-coverage/visual acceptance gate."""
import json, pathlib, struct, sys
from PIL import Image
root = pathlib.Path(sys.argv[1]); label=sys.argv[2] if len(sys.argv)>2 else 'A05'; w,h=416,234
results=[]
ticks=(90,180,270,324,378,450,479) if label=='A16' else (90,180,270)
for tick in ticks:
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
    orig_writes=(root/f'original_{tick}.writes.u8').read_bytes()
    native_writes=(root/f'native_{tick}.writes.u8').read_bytes()
    if len(orig_writes)!=w*h or len(native_writes)!=w*h: raise SystemExit('unexpected write trace')
    intersection=sum(bool(x and y) for x,y in zip(orig_writes,native_writes))
    union=sum(bool(x or y) for x,y in zip(orig_writes,native_writes))
    write_heat=Image.new('RGB',(w,h)); wh=write_heat.load()
    for pos,(x,y) in enumerate(zip(orig_writes,native_writes)):
        wh[pos%w,pos//w]=(255 if y and not x else 0,255 if x and y else 0,255 if x and not y else 0)
    write_heat.save(root/f'{tick}_write_iou.png')
    result={'tick':tick,'time':tick/60,'rgb_mae':total/(w*h*3),'rgb_max':maxerr,'hdr_mae':hdr_abs,
      'regions':[{'x':i%8,'y':i//8,'mae':r[0]/r[1], 'max':r[2]} for i,r in enumerate(regions)],
      'write_trace_iou': intersection/union if union else 1.0,
      'write_trace_union': union,
      'coverage_iou':'not measured: write traces are not alpha or authored coverage',
      'scope':f'{label} neutral-A component only, black source canvas, not live world'}
    results.append(result)
    print(f'{label}_SOURCE_COMPARE',json.dumps({k:v for k,v in result.items() if k!='regions'}),flush=True)
(root/'comparison.json').write_text(json.dumps(results,indent=2))
