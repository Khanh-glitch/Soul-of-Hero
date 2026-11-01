"""Original C raw passes vs full expanded live A source and real world.

C reference is original code re-instantiated per frame at live anchors, but
has a fixed 384x216 field, its own graph/timing, empty base and no browser
post. Outside C reference anchors are explicitly labeled, not hidden. World
is an unchanged gameplay frame; source-clock retimed without invented frames.
"""
import json,pathlib,subprocess,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((root/'timeline.json').read_text());m=json.loads((root/'c09_full_reference_manifest.json').read_text());rows=[r for r in m['rows'] if 'skipped' not in r]; font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
if len(rows)<10:raise SystemExit('too few real captured source frames')
def preview(a):
 a=np.maximum(a,0);return np.rint(a/(1+a)*255).astype('uint8')
def image(path,w,h,c):
 a=np.fromfile(path,'<f4').reshape(h,w,c);return Image.fromarray(preview(a[:,:,:3]),'RGB').resize((w*2,h*2),Image.Resampling.NEAREST)
def mono(a):
 a=np.rint(np.clip(a,0,1)*255).astype('uint8');return Image.fromarray(a,'L').convert('RGB').resize((a.shape[1]*2,a.shape[0]*2),Image.Resampling.NEAREST)
saved=[]
for row in rows:
 i=row['frame_index']; f=timeline['frames'][i]; w,h=f['r17_source_size']; stem=root/f'r17_full_{i:05d}'
 if (w,h)!=(624,352):raise SystemExit('unexpected expanded A raster size')
 c=image(str(stem)+'.c.light32f',384,216,4); ink=image(str(stem)+'.c.ink32f',384,216,4)
 ground=Image.fromarray(np.fromfile(str(stem)+'.c.ground8',np.uint8).reshape(216,384,4)[:,:,:3],'RGB').resize((768,432),Image.Resampling.NEAREST)
 shade=mono(np.fromfile(str(stem)+'.c.disp32f','<f4').reshape(216,384,4)[:,:,2]);native=image(root/f['r17_full_source_field'],w,h,3);coverage=mono(np.fromfile(root/f['r17_full_source_coverage'],'<f4').reshape(h,w))
 world=Image.open(root/f['file']).convert('RGB')
 if world.size!=(1280,720):raise SystemExit('unexpected world dimensions')
 canvas=Image.new('RGB',(3552,1508),(18,21,27));draw=ImageDraw.Draw(canvas)
 canvas.paste(c,(0,40));canvas.paste(native,(768,40));canvas.paste(world,(2016,40))
 canvas.paste(ink,(0,800));canvas.paste(ground,(768,800));canvas.paste(shade,(1536,800));canvas.paste(coverage,(2304,800))
 draw.text((8,8),f'Original C light 2x, ref anchors outside: {row["reference_nodes_outside"]}',font=font,fill='white')
 draw.text((776,8),'Native full 624x352 A+B+C field 2x',font=font,fill='white')
 draw.text((2024,8),f'Actual full world 1x | observed tick {row["tick"]}',font=font,fill='white')
 draw.text((8,770),'C ink RGB, alpha separately saved',font=font,fill='white');draw.text((776,770),'C ground on empty base',font=font,fill='white');draw.text((1544,770),'C shade',font=font,fill='white');draw.text((2312,770),'Native source coverage',font=font,fill='white')
 draw.text((8,1482),'C reference has different graph, timing, fixed viewport and no post. Not Gold or world HDR.',font=font,fill='white')
 p=out/f'frame_{i:05}.png';canvas.save(p);saved.append(p)
concat=out/'frames.txt'
with concat.open('w') as f:
 for j,(p,r) in enumerate(zip(saved,rows)):
  f.write(f"file '{p.resolve()}'\noption framerate 1000\n")
  if j+1<len(rows):f.write(f'duration {max(.001,(rows[j+1]["tick"]-r["tick"])/60):.6f}\n')
 f.write(f"file '{saved[-1].resolve()}'\noption framerate 1000\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-fps_mode','vfr','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',str(out/'c09-wide-source-and-world.mp4')],check=True)
for p in saved:p.unlink()
concat.unlink();(out/'scope.json').write_text(json.dumps({'frames':len(rows),'reference_frames_with_outside_anchors':sum(r['reference_nodes_outside']>0 for r in rows),'scope':m['scope']+' Source C fixed 384x216, full native A 624x352; reference may clip its own actors (labeled). No world HDR, original C post or Gold fusion.'},indent=2)+'\n')
print('::notice title=R17_WIDE_FULL_REFERENCE::'+json.dumps({'frames':len(rows),'ref_frames_with_outside_anchors':sum(r['reference_nodes_outside']>0 for r in rows)}))
