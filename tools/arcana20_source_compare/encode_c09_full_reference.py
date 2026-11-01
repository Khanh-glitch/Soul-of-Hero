"""Side-by-side source-pass diagnostics and actual world, not a Gold composite.

C's unmodified #09 is re-instantiated at each recorded real actor position;
its C-authored graph/timing differ from fusion A. Its frame has an empty base,
so source ground, ink, light and shade are shown separately. Reconstructed C
particles are not continuous live-world actors. World panel is an unmodified
captured frame; source clocks are last observed and may lag presentation.
"""
import json, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
timeline = json.loads((root/'timeline.json').read_text()); manifest = json.loads((root/'c09_full_reference_manifest.json').read_text())
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
def preview(arr):
    # Explicit HDR diagnostic curve, not C/A original post or transparency key.
    x = np.maximum(arr, 0); return np.rint(x / (1+x) * 255).astype('uint8')
def image(data, w, h, channels=4):
    a = np.fromfile(data, '<f4').reshape(h, w, channels)
    return Image.fromarray(preview(a[:,:,:3]), 'RGB').resize((w*2,h*2), Image.Resampling.NEAREST)
def mono(a):
    b = np.rint(np.clip(a,0,1)*255).astype('uint8')
    return Image.fromarray(b,'L').convert('RGB').resize((b.shape[1]*2,b.shape[0]*2),Image.Resampling.NEAREST)
rows = [r for r in manifest['rows'] if 'skipped' not in r]; saved = []
if len(rows) < 10: raise SystemExit('too few frames with real source anchors')
for row in rows:
    i=row['frame_index']; frame=timeline['frames'][i]; stem=root/f'r17_full_{i:05d}'
    light=image(str(stem)+'.c.light32f',384,216)
    ink=image(str(stem)+'.c.ink32f',384,216)
    ground=Image.fromarray(np.fromfile(str(stem)+'.c.ground8',np.uint8).reshape(216,384,4)[:,:,:3], 'RGB').resize((768,432),Image.Resampling.NEAREST)
    shade=mono(np.fromfile(str(stem)+'.c.disp32f','<f4').reshape(216,384,4)[:,:,2])
    native=image(root/frame['r17_full_source_field'],416,234,3)
    coverage=mono(np.fromfile(root/frame['r17_full_source_coverage'],'<f4').reshape(234,416))
    world=Image.open(root/frame['file']).convert('RGB')
    if world.size != (1280,720): raise SystemExit('unexpected full viewport')
    outframe=Image.new('RGB',(3136,1096),(18,21,27)); draw=ImageDraw.Draw(outframe)
    outframe.paste(light,(0,40)); outframe.paste(native,(768,40)); outframe.paste(world,(1664,40))
    outframe.paste(ink,(0,600)); outframe.paste(ground,(768,600)); outframe.paste(shade,(1536,600)); outframe.paste(coverage,(2304,600))
    draw.text((8,8),'Original C #09 light: reconstructed live anchors, 2x',font=font,fill='white')
    draw.text((776,8),'Native A+B+C full source field, 2x',font=font,fill='white')
    draw.text((1672,8),f'Actual world 1x | last-observed tick {row["tick"]}',font=font,fill='white')
    draw.text((8,570),'C ink RGB (raw alpha saved), 2x',font=font,fill='white')
    draw.text((776,570),'C ground on empty base, 2x',font=font,fill='white')
    draw.text((1544,570),'C shade; displacement saved, 2x',font=font,fill='white')
    draw.text((2312,570),'Native coverage, 2x',font=font,fill='white')
    draw.text((8,1072),'C is an independently re-instantiated reference with different graph/timing and no C post; world is actual. No Gold parity.',font=font,fill='white')
    path=out/f'frame_{i:05d}.png'; outframe.save(path); saved.append(path)
concat=out/'frames.txt'
with concat.open('w') as f:
    for j,(p,row) in enumerate(zip(saved,rows)):
        f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
        if j+1<len(rows): f.write(f'duration {max(.001,(rows[j+1]["tick"]-row["tick"])/60):.6f}\n')
    f.write(f"file '{saved[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(out/'c09-full-source-passes-native-world.mp4')],check=True)
for p in saved: p.unlink()
concat.unlink()
(out/'scope.json').write_text(json.dumps({'recorded_frames':len(rows),'first_tick':rows[0]['tick'],'last_tick':rows[-1]['tick'],'scope':manifest['scope']+' A HDR uses x/(1+x), native coverage shown separately, world unmodified 1x. Source panels 2x; source-clock retimed, no interpolated frames. Not C post, complete Gold fusion, same-frame world HDR, or device FPS.'},indent=2)+'\n')
print('::notice title=R17_FULL_REFERENCE_SERIES::'+json.dumps({'frames':len(rows),'first_tick':rows[0]['tick'],'last_tick':rows[-1]['tick']}))
