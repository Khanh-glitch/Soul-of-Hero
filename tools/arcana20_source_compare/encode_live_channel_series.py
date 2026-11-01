"""C reference, native replay and real full world at recorded display ticks.

The two 2x source panels are only one selected connector, on black, without
post/bloom. Linear light is displayed with the same disclosed x/(1+x) preview
curve; raw comparisons are separate. The world is an unmodified 1x capture.
No missing frames or intermediate actors are synthesized. This is not an
original full-spell Gold composite, nor a same-frame no-FX world contrast test.
"""
import json,pathlib,subprocess,sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
root=pathlib.Path(sys.argv[1]); series=pathlib.Path(sys.argv[2]); out=pathlib.Path(sys.argv[3]); out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((root/'timeline.json').read_text()); records=json.loads((series/'series.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
def preview(file,w,h,stride):
    v=np.fromfile(file,'<f4').reshape(h,w,stride)[:,:,:3]; v=np.maximum(v,0); v=v/(1+v)
    im=Image.fromarray(np.round(v*255).astype('uint8'),'RGB')
    canvas=Image.new('RGB',(416,234),'black');canvas.paste(im,(0,0))
    return canvas.resize((832,468),Image.Resampling.NEAREST)
frames=[]
for n,r in enumerate(records):
    stem=series/f'r17_{r["frame_index"]:04}'
    c=preview(str(stem)+'.c-original.rgba32f',384,216,4)
    native=preview(str(stem)+'.native.rgb32f',416,234,3)
    fusion=preview(str(stem)+'.current-connector.rgb32f',416,234,3)
    world=Image.open(root/timeline['frames'][r['frame_index']]['file']).convert('RGB')
    if world.size!=(1280,720): raise SystemExit('unexpected native scene size')
    im=Image.new('RGB',(2496,1268),(18,21,27)); im.paste(c,(0,44)); im.paste(native,(832,44)); im.paste(fusion,(1664,44)); im.paste(world,(608,548))
    d=ImageDraw.Draw(im)
    d.text((10,8),'C original channel: original colors, k=1, 2x',font=font,fill='white')
    d.text((842,8),'Native adapted channel: same colors, k=1, 2x',font=font,fill='white')
    d.text((1674,8),'Native chosen connector: actual palette/k, 2x',font=font,fill='white')
    d.text((610,516),f'Actual full-world capture 1x | recorded source tick {r["source_tick"]} | selected connector only above; software frames skipped',font=font,fill='white')
    p=out/f'frame_{n:04}.png';im.save(p);frames.append(p)
concat=out/'frames.txt'
with concat.open('w') as f:
    for i,p in enumerate(frames):
        f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
        if i+1<len(frames): f.write(f'duration {max(.001,(records[i+1]["source_tick"]-records[i]["source_tick"])/60):.6f}\n')
    f.write(f"file '{frames[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(out/'c-channel-native-world-source-clock.mp4')],check=True)
for p in frames:p.unlink()
concat.unlink()
(out/'scope.json').write_text(json.dumps({'records':len(records),'first_tick':records[0]['source_tick'],'last_tick':records[-1]['source_tick'],'scope':'Actual real-route world frames; one selected connector per recorded frame; C original full five-branch channel and native adapted replay at same captured endpoints/tick; common x/(1+x) source-preview curve, no original post/bloom; real world 1x; time retimed from recorded source ticks with no interpolated frames. Not full-spell Gold comparison, linear/HDR world contrast or 60Hz gameplay.'},indent=2)+'\n')
print('::notice title=R17_CHANNEL_SERIES::'+json.dumps({'frames':len(records),'first_tick':records[0]['source_tick'],'last_tick':records[-1]['source_tick']}))
