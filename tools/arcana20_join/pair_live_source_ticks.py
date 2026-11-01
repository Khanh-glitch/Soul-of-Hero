"""Pair actual full native gameplay frames by their last-observed source tick.

Output is a source-clock-retimed review, not wall-time gameplay video: frames
skipped by software rendering are not invented, and actor positions can differ
between the independent runs. The tick is last observed, not a presentation
fence. Original full captured frames, PTS and source fields are in each run.
"""
import json
import pathlib
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

before, after, output = map(pathlib.Path, sys.argv[1:4]); output.mkdir(parents=True, exist_ok=True)
b = json.loads((before/'timeline.json').read_text()); a = json.loads((after/'timeline.json').read_text())
assert b['skill'] == a['skill']
def by_tick(d):
    return {int(f['source_tick_last_observed']):f for f in d['frames']}
bs = by_tick(b); ass = by_tick(a); ticks = sorted(set(bs) & set(ass))
if len(ticks) < 12: raise SystemExit(f'too few shared last-observed ticks: {ticks}')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
paths=[]
for i,tick in enumerate(ticks):
    left=Image.open(before/bs[tick]['file']).convert('RGB'); right=Image.open(after/ass[tick]['file']).convert('RGB')
    if left.size!=(1280,720) or right.size!=left.size: raise SystemExit('unexpected native capture size')
    im=Image.new('RGB',(2560,780),(19,22,28)); im.paste(left,(0,60)); im.paste(right,(1280,60))
    d=ImageDraw.Draw(im); d.text((12,5),f'BEFORE  b33e2da  |  skill {b["skill"]}',font=font,fill='white')
    d.text((1292,5),'CANDIDATE  1039869',font=font,fill='white')
    d.text((12,32),f'Last-observed source tick {tick}; independently moving actors, source-clock retimed, skipped frames not filled',font=font,fill=(220,220,220))
    p=output/f'pair_{i:04d}.png'; im.save(p); paths.append(p)
    if tick in {min(ticks,key=lambda x:abs(x-target)) for target in (87,143,247,327,351)}:
        im.save(output/f'decisive_tick_{tick:03}.png')
concat=output/'pairs.txt'
with concat.open('w') as f:
    for i,p in enumerate(paths):
        f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
        if i+1<len(ticks): f.write(f'duration {max(.001,(ticks[i+1]-ticks[i])/60):.6f}\n')
    f.write(f"file '{paths[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(output/'before-after-source-clock.mp4')],check=True)
for p in paths: p.unlink()
concat.unlink()
(output/'comparison.json').write_text(json.dumps({'skill':b['skill'],'ticks':ticks,'pair_count':len(ticks),'before':'b33e2da349daa066ebf8867a0c2319b7ab49c7a0','candidate':'10398692bbf370eb0b2d4aa8ea8341ee85500f3e','scope':'Full unaltered 1280x720 world frames at 1x, paired by last-observed source tick and retimed to source clock; actor/camera positions differ; tick is not a presentation fence; no interpolation; not Gold parity or real-time FPS'},indent=2)+'\n')
print('::notice title=R17_MATCHED_COMPARISON::'+json.dumps({'skill':b['skill'],'count':len(ticks),'first':ticks[0],'last':ticks[-1]}))
