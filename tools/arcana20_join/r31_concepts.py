#!/usr/bin/env python3
"""Paint R31 proposals over a real frame. These are illustrations, NOT native effects.
Background is extracted lossily from tracked R30 native footage. Art is drawn at
half resolution and nearest-neighbor enlarged; source pixels themselves are not
invented, although paint obscures them. This script requires Pillow and ffmpeg.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import subprocess, math, random
R=Path(__file__).resolve().parents[2]
O=R/'prototypes/arcana_fusion20/visual_direction_lab/concepts'; O.mkdir(parents=True,exist_ok=True)
vid=R/'prototypes/arcana_fusion20/renderer/reviews/r30_first/video/N13-normal.mp4'
tmp=O/'_base.png'
try:
 import imageio_ffmpeg
 ff=imageio_ffmpeg.get_ffmpeg_exe()
except ImportError: ff='ffmpeg'
subprocess.run([ff,'-v','error','-y','-i',str(vid),'-frames:v','1',str(tmp)],check=True)
base=Image.open(tmp).convert('RGB'); tmp.unlink()
def layer():return Image.new('RGBA',(640,360))
def save(name,lay):
 im=base.copy().convert('RGBA'); im.alpha_composite(lay.resize((1280,720),Image.Resampling.NEAREST)); im.convert('RGB').save(O/(name+'.png'),optimize=True)
def poly(d,pts,color): d.polygon(pts,fill=color)
def line(d,pts,fill,width=1): d.line(pts,fill=fill,width=width,joint='curve')
# A diagonal iron cleaver, a continuous split and displaced world-material patches.
def blade(d,p,q,w=13):
 dx=q[0]-p[0];dy=q[1]-p[1];l=math.hypot(dx,dy); nx=-dy/l;ny=dx/l
 P=[(p[0]-nx*w,p[1]-ny*w),(q[0]-nx*w*.36,q[1]-ny*w*.36),q,(q[0]+nx*w*.65,q[1]+ny*w*.65),(p[0]+nx*w,p[1]+ny*w)]
 poly(d,P,(28,30,43,255));poly(d,[P[0],P[1],q,(p[0]-nx*2,p[1]-ny*2)],(123,134,144,255));line(d,[P[0],P[1],q],(234,220,183,255),2);line(d,[P[4],P[3]],(66,80,95,255),3)
 # Minimal sparks are a visual contact cue, not a combat receipt.
def fracture(lay, variant):
 # Actual SOH terrain color remains the top surface. Painted rock faces are
 # conceptual only; this is not a physical simulation or native capture.
 d=ImageDraw.Draw(lay)
 terrain=base.resize((640,360),Image.Resampling.NEAREST).convert('RGBA')
 if variant == 0:
  spine=[(340,216),(351,211),(362,212),(373,206),(384,208),(395,203),(406,204),(417,198),(428,200),(441,195),(453,196)]
  widths=[6,8,11,8,13,9,12,8,10,6,4]
 elif variant == 1:
  spine=[(340,216),(351,213),(361,210),(372,209),(382,207),(393,204),(403,201),(415,199),(427,197),(439,194),(451,193)]
  widths=[5,6,10,15,18,7,6,14,18,8,4]
 else:
  # Three connected arcs spreading from one contact point, not a straight cut.
  spine=[(340,216),(349,214),(358,213),(369,214),(379,215),(389,216),(398,219),(407,223),(416,227),(424,232),(432,238)]
  widths=[3,5,8,12,14,15,14,12,10,7,4]
 for side in (-1,1):
  near=[(x,y+side*2) for x,y in spine]
  edge=[(x,y+side*widths[i]) for i,(x,y) in enumerate(spine)]
  poly(d,near+edge[::-1],(35,30,29,255))
  top=[(x,y+side*(widths[i]+5+(i%3))) for i,(x,y) in enumerate(spine)]
  # contiguous exposed vertical faces beneath real-pixel terrain top
  poly(d,edge+top[::-1],(90,70,56,255));line(d,top,(177,147,109,255),1)
  for i in range(1,len(edge)-1,2):
   a=edge[i];b=top[i];line(d,[a,(b[0]-2,b[1]),b],(45,38,34,255),1)
  cap=[(x,y+side*(widths[i]+13+(i%2)*3)) for i,(x,y) in enumerate(spine)]
  mask=Image.new('L',(640,360));md=ImageDraw.Draw(mask);md.polygon(top+cap[::-1],fill=255)
  # Offset the captured soil/stone layer away from the fracture: conceptual
  # same-world displaced material, not manually recolored generic tiles.
  shifted=Image.new('RGBA',(640,360));shifted.paste(terrain,(0,side*6))
  lay.paste(shifted,(0,0),mask);d=ImageDraw.Draw(lay)
  line(d,top,(202,171,128,255),1);line(d,cap,(38,33,33,255),2)
 line(d,spine,(16,15,19,255),2)
 for i in [2,5,8]:
  p=spine[i];side= -1 if i%2==0 else 1
  line(d,[p,(p[0]+3,p[1]+side*8),(p[0]+9,p[1]+side*12)],(34,30,29,255),1)
for idx,name in enumerate(['04A-split-escarpment','04B-hinged-bedrock','04C-fan-fracture']):
 lay=layer();fracture(lay,idx);d=ImageDraw.Draw(lay)
 if idx==0: blade(d,(348,154),(421,207),15)
 elif idx==1: blade(d,(365,142),(423,208),18)
 else: blade(d,(341,165),(428,198),13)
 save(name,lay)
# Root proposals. Continuous anatomical drawing with taper on each segment.
def tapered(d,pts,widths):
 for i in range(len(pts)-1):
  line(d,[pts[i],pts[i+1]],(32,23,18,255),int(widths[i]+4))
  line(d,[pts[i],pts[i+1]],(88,53,28,255),int(widths[i]))
  line(d,[(pts[i][0],pts[i][1]-1),(pts[i+1][0],pts[i+1][1]-1)],(157,103,49,255),max(1,int(widths[i]*.25)))
def root_thorn(d,p,q):
 dx=q[0]-p[0];dy=q[1]-p[1];l=max(1,math.hypot(dx,dy));nx=-dy/l;ny=dx/l
 poly(d,[(p[0]+nx*4,p[1]+ny*4),(q[0],q[1]),(p[0]-nx*4,p[1]-ny*4)],(70,107,31,255));line(d,[p,q],(178,188,77,255),1)
configs=[
 ([(338,215),(355,210),(372,212),(390,202),(409,203),(427,198)], [[(367,211),(378,196),(390,190),(400,186)],[(382,207),(389,221),(403,227),(413,229)],[(401,203),(409,191),(420,186)]], ((414,202),(447,194))),
 ([(338,215),(351,218),(365,224),(375,222),(384,210),(381,200),(390,193),(407,194)], [[(365,224),(369,234),(379,237),(388,236)],[(381,208),(373,200),(369,191),(375,187)],[(392,193),(401,184),(412,183)]], ((407,194),(439,201))),
 ([(340,216),(352,214),(364,213),(377,210),(391,209),(405,205),(418,205)], [[(352,214),(347,201),(339,192),(330,190)],[(353,215),(349,230),(343,238),(334,240)],[(367,213),(375,199),(387,190),(399,190)],[(369,213),(377,227),(388,234),(400,234)],[(390,209),(403,218),(417,221)]], ((418,205),(445,199))) ]
for idx,name in enumerate(['13A-forked-taproot','13B-coiled-tendon','13C-surface-crown']):
 lay=layer();d=ImageDraw.Draw(lay); main,children,thorn=configs[idx];tapered(d,main,[13,12,11,10,9,7,6]);
 for i,branch in enumerate(children):tapered(d,branch,[7,5,3])
 # offshoots attach to parent; none substitute combat feedback
 for b in children:
  p=b[-2];side=-1 if p[1]<205 else 1
  tapered(d,[p,(p[0]+5,p[1]+side*5),(p[0]+9,p[1]+side*6)],[3,1])
 root_thorn(d,*thorn);save(name,lay)
# D19 three material-staging PAINTOVERS of actual matched A/B/no-FX.
# Never draw an invented star. Actual source values remain sampled from the
# captured screenshot; spatial masks are concept-only, not a render algorithm.
from PIL import ImageChops
D=R/'prototypes/arcana_fusion20/renderer/reviews/r30_followup/d19/normal'
a=Image.open(D/'489-bounded.png').convert('RGB')
b=Image.open(D/'489-art_directed.png').convert('RGB')
o=Image.open(D/'489-world-base.png').convert('RGB')
# Explicit spatial concept mattes; never used in the runtime renderer.
# All source shape comes from the captured A/B; no replacement STAR is drawn.
w,h=a.size
m=Image.new('L',(w,h)); d=ImageDraw.Draw(m);d.ellipse((205,125,435,310),fill=255)
Image.composite(a,o,m).save(O/'19A-core-lens.png')
m=Image.new('L',(w,h),255);d=ImageDraw.Draw(m);d.ellipse((245,160,385,275),fill=0)
Image.composite(b,a,m).save(O/'19B-orbit-led.png')
m=Image.new('L',(w,h));d=ImageDraw.Draw(m);d.polygon([(180,245),(480,245),(465,360),(180,330)],fill=255)
Image.composite(b,a,m).save(O/'19C-grounded-plane.png')
print('Wrote 9 procedural concepts to',O)
