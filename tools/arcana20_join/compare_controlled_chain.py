"""Verify same-scene render-order experiment; no fabricated world or pixels."""
import json,pathlib,subprocess,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(sys.argv[1]);t=json.loads((root/'timeline.json').read_text());frames=[f for f in t['frames'] if 'controlled_files' in f]
if len(frames)<10:raise SystemExit('insufficient controlled frames')
out=root/'controlled';out.mkdir(exist_ok=True);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);rows=[];encoded=[]
for i,f in enumerate(frames):
 before,above,restore=[np.asarray(Image.open(root/n).convert('RGB')) for n in f['controlled_files']]
 if before.shape!=(720,1280,3):raise SystemExit('unexpected native viewport')
 drift=np.any(before!=restore,axis=2);changed=np.any(before!=above,axis=2)
 row={'tick':f['controlled_tick'],'baseline_restore_different_pixels':int(drift.sum()),'render_order_different_pixels':int(changed.sum()),'max_baseline_restore_difference':int(np.abs(before.astype('int16')-restore.astype('int16')).max())}
 rows.append(row)
 # Full 1x native frames, never crop or stretch. Preview labels are outside.
 canvas=Image.new('RGB',(2560,750),(20,22,28));canvas.paste(Image.fromarray(before),(0,30));canvas.paste(Image.fromarray(above),(1280,30));d=ImageDraw.Draw(canvas)
 d.text((8,5),f'Baseline behind actors | tick {row["tick"]}',font=font,fill='white');d.text((1288,5),'EXPERIMENT above actors; same scene, no depth',font=font,fill='white')
 p=out/f'{i:05}.png';canvas.save(p);encoded.append(p)
if any(r['baseline_restore_different_pixels'] for r in rows):
 (out/'comparison.json').write_text(json.dumps(rows,indent=2));raise SystemExit('baseline and restored frame differ: same-scene comparison invalid')
concat=out/'frames.txt'
with concat.open('w') as f:
 for i,p in enumerate(encoded):
  f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
  if i+1<len(encoded):f.write(f'duration {max(.001,(rows[i+1]["tick"]-rows[i]["tick"])/60):.6f}\n')
 f.write(f"file '{encoded[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(out/'controlled-full-cast.mp4')],check=True)
# Original three images for every captured tick remain in the artifact.
for p in encoded:p.unlink()
concat.unlink();(out/'comparison.json').write_text(json.dumps({'scope':'Frozen real scene, identical texture/time/actors/camera; only pass z changes. Foreground experiment lacks obstacle/actor depth and is not an approved implementation.', 'frames':rows},indent=2)+'\n')
print('::notice title=R18_CONTROLLED_COMPARISON::'+json.dumps({'frames':len(rows),'baseline_restore_different_pixels':sum(r['baseline_restore_different_pixels'] for r in rows),'frames_changed_by_z':sum(r['render_order_different_pixels']>0 for r in rows),'max_pixels_changed_by_z':max(r['render_order_different_pixels'] for r in rows)}))
