"""Full original A #11 vs actual A+C source field and real world frames.

Original A uses its full unmodified spell code at each captured source tick,
with a zero background/trail. The selected fusion is A+C, so original A is a
role reference, not Gold fusion. HDR source panels share x/(1+x), no original
trail, world floor/composition or post. The world frame is never synthesized.
"""
import json, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((root/'timeline.json').read_text()); font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
rows=[]
for index,frame in enumerate(timeline['frames']):
    if 'r17_source_tick' in frame and 'r17_full_source_field' in frame: rows.append((index,frame))
if len(rows)<10: raise SystemExit('too few actually recorded source frames')
def hdr(path):
    a=np.maximum(np.fromfile(path,'<f4').reshape(234,416,3),0); a=np.rint(a/(1+a)*255).astype('uint8')
    return Image.fromarray(a,'RGB').resize((832,468),Image.Resampling.NEAREST)
def cover(path):
    a=np.fromfile(path,'<f4').reshape(234,416); a=np.rint(np.clip(a,0,1)*255).astype('uint8')
    return Image.fromarray(a,'L').convert('RGB').resize((832,468),Image.Resampling.NEAREST)
saved=[]
for index,frame in rows:
    tick=frame['r17_source_tick']; original=hdr(root/f'a11_original_{tick}.rgb32f')
    native=hdr(root/frame['r17_full_source_field']); coverage=cover(root/frame['r17_full_source_coverage'])
    world=Image.open(root/frame['file']).convert('RGB')
    if world.size!=(1280,720): raise SystemExit('unexpected native world size')
    outframe=Image.new('RGB',(2496,1268),(18,21,27)); draw=ImageDraw.Draw(outframe)
    outframe.paste(original,(0,44)); outframe.paste(native,(832,44)); outframe.paste(coverage,(1664,44)); outframe.paste(world,(608,548))
    draw.text((8,8),'Full original A #11 source HDR, 2x',font=font,fill='white')
    draw.text((840,8),'Full native A+C source HDR, 2x',font=font,fill='white')
    draw.text((1672,8),'Native source coverage, 2x',font=font,fill='white')
    draw.text((610,516),f'Actual full world 1x | last-observed tick {tick} | original A alone is NOT Gold fusion',font=font,fill='white')
    p=out/f'frame_{index:05}.png'; outframe.save(p); saved.append(p)
concat=out/'frames.txt'
with concat.open('w') as f:
    for j,(p,(_,frame)) in enumerate(zip(saved,rows)):
        f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
        if j+1<len(rows): f.write(f'duration {max(.001,(rows[j+1][1]["r17_source_tick"]-frame["r17_source_tick"])/60):.6f}\n')
    f.write(f"file '{saved[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(out/'a11-full-source-native-world.mp4')],check=True)
for p in saved:p.unlink()
concat.unlink()
(out/'scope.json').write_text(json.dumps({'recorded_frames':len(rows),'first_tick':rows[0][1]['r17_source_tick'],'last_tick':rows[-1][1]['r17_source_tick'],'scope':'Full unmodified A spell raw source vs captured native A+C source and coverage; common x/(1+x) HDR preview, source 2x, real world 1x. Original A alone is not full Gold A+C fusion. Original reference uses zero base/trail and excludes original lab/post; captured world is not changed. Source clock retimed; no interpolated world frames. Tick can lag presentation; not target FPS or same-frame world HDR.'},indent=2)+'\n')
print('::notice title=R17_A11_FULL_REFERENCE_SERIES::'+json.dumps({'frames':len(rows),'first_tick':rows[0][1]['r17_source_tick'],'last_tick':rows[-1][1]['r17_source_tick']}))
