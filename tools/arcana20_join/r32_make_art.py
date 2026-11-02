#!/usr/bin/env python3
"""R32 offline illustration experiment, NOT runtime VFX. See README for provenance."""
from PIL import Image, ImageDraw
import random, math, os, json, gzip, argparse
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; O=ROOT/'prototypes/arcana_fusion20/r32_direction'; O.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--base',type=Path,required=True,help='directory containing N13-normal/frame-01.png and N13-dimmed/frame-01.png');args=parser.parse_args(); BASE=args.base; TMP=O/'source19'; W,H=640,360
random.seed(42013)
def poly(d, pts, color): d.polygon([(round(x),round(y)) for x,y in pts], fill=color)
def line(d,pts,color,w=1):d.line([(round(x),round(y)) for x,y in pts],fill=color,width=round(w),joint='curve')
def interpolate(a,b,t):return a+(b-a)*t
def ease(x): x=max(0,min(1,x));return x*x*(3-2*x)
def mask_actors(im):
    # Precise manual sprite silhouettes, not fake actors. Intentional paintover exclusion.
    m=Image.new('L',(W,H),255);d=ImageDraw.Draw(m)
    for p in [[(305,169),(310,159),(318,158),(324,164),(325,174),(323,180),(326,188),(321,197),(311,197),(310,190),(305,186),(303,177)],[(406,165),(409,160),(417,160),(422,165),(423,179),(419,185),(410,185),(405,180)],[(427,165),(431,160),(438,160),(443,165),(444,180),(439,185),(430,185),(425,179)],[(448,164),(451,160),(458,160),(464,165),(466,174),(469,177),(465,181),(459,185),(451,185),(447,179)]]:d.polygon(p,fill=0)
    a=im.getchannel('A');import PIL.ImageChops as IC;im.putalpha(IC.multiply(a,m));return im

def draw04(p):
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im); rng=random.Random(184)
    if p==0:
        line(d,[(326,199),(331,197),(335,198)],(71,57,50,215),1)
        d.point((329,195),fill=(201,180,143,220))
    # central cut grows behind the traveling blade, in visual-only soil.
    travel=ease((p-.12)/.46); close=1-ease((p-.72)/.28); n=travel*close
    if p>.05 and n>.005:
        end=324+80*travel
        pts=[(324,198),(335,195),(346,196),(356,191),(369,192),(379,188),(390,188),(end,185),(end,191),(390,194),(379,197),(369,197),(356,202),(346,201),(335,204),(324,201)]
        # clip scar to travel so it never appears ahead of blade
        scar=Image.new('RGBA',(W,H));sd=ImageDraw.Draw(scar);poly(sd,pts,(30,23,28,int(230*close)))
        clip=Image.new('L',(W,H));ImageDraw.Draw(clip).rectangle((320,178,end,210),fill=255)
        import PIL.ImageChops as IC; scar.putalpha(IC.multiply(scar.getchannel('A'),clip));im=Image.alpha_composite(im,scar);d=ImageDraw.Draw(im)
        # nonuniform banks, individual wedges with dark faces, no regular chip chain
        rocks=[(334,196,12,6),(346,193,11,9),(360,190,15,8),(375,187,11,11),(389,184,14,7),(402,182,8,5), (337,203,10,6),(350,203,13,8),(365,200,12,6),(379,197,14,10),(394,194,10,6)]
        for j,(x,y,w,h) in enumerate(rocks):
            if x>end-2:continue
            side=-1 if j<6 else 1; rise=(.35+.65*ease((p-.12)/.27))*close
            yy=y+side*2*rise; ht=h*rise
            # angular irregular displaced earth, face and top distinct
            pts=[(x-w*.48,yy),(x-w*.28,yy-side*ht*.7),(x+w*.13,yy-side*ht),(x+w*.52,yy-side*ht*.32),(x+w*.42,yy+side*1),(x+w*.1,yy+side*3),(x-w*.35,yy+side*2)]
            poly(d,pts,(48,40,38,int(235*close)))
            poly(d,pts[:4]+[(x+w*.3,yy-side*ht*.15),(x-w*.15,yy-side*ht*.28)],(113+j%3*8,92+j%4*5,76, int(235*close)))
            line(d,[pts[1],pts[2],pts[3]],(165,139,110,int(225*close)),1)
            line(d,[(x-w*.25,yy+side*.3),(x+w*.2,yy+side*.6)],(79,65,57,int(225*close)),1)
            for k in range(3):
                xx=x+rng.randint(-3,3); yv=yy-side*rng.randint(1,max(1,int(ht)))
                d.point((xx,yv),fill=(192,161,124,int(170*close)))
        # cracks extend from seam on each side
        for j in range(5):
            x=340+j*14
            if x<end:line(d,[(x,196-j*.16),(x+3,191-j*.2),(x+1,188-j*.2)],(45,35,34,int(190*close)),1)
        if .22<p<.78:
            for i in range(18):
                x=326+rng.random()*max(1,end-326); y=190+rng.uniform(-13,13); rr=rng.choice([1,1,2]);
                d.rectangle((x,y,x+rr,y+rr),fill=(188,161,121,int(130*close)))
    # a single traveling forged blade (no duplicate silhouettes)
    if .09<p<.8:
        x=327+75*travel; y=195-13*travel; fade=1-ease((p-.65)/.15)
        # tip, cutting face, bevel, tang and short grip in one connected silhouette
        def col(c):return (*c,int(255*fade))
        poly(d,[(x+13,y-3),(x-6,y-9),(x-22,y-5),(x-23,y),(x-6,y+3)],col((23,29,34)))
        poly(d,[(x+12,y-3),(x-6,y-8),(x-21,y-5),(x-6,y-3)],col((193,209,202)))
        poly(d,[(x+12,y-3),(x-6,y-3),(x-21,y-5),(x-21,y-1),(x-6,y+2)],col((96,119,126)))
        line(d,[(x-20,y-5),(x-6,y-8),(x+12,y-3)],col((231,236,213)),1)
        line(d,[(x-6,y-3),(x+9,y-3)],col((167,183,176)),1)
        line(d,[(x-23,y-6),(x-21,y+2)],col((169,149,108)),2)
        line(d,[(x-24,y-2),(x-30,y)],col((74,57,47)),3)
        d.rectangle((x-31,y-1,x-29,y+1),fill=col((196,170,111)))
    return mask_actors(im)

def taper(d,pts,width,col):
    # rooted branch is built segment by segment; each daughter shares a parent point.
    for i in range(len(pts)-1):
        a,b=pts[i],pts[i+1];w=max(1,round(width*(1-i/(len(pts)-.4))));line(d,[a,b],col,w)

def partial(pts,u):
    u=max(0,min(1,u))*(len(pts)-1);n=int(u);o=pts[:min(n+1,len(pts))]
    if n<len(pts)-1:o.append((interpolate(pts[n][0],pts[n+1][0],u-n),interpolate(pts[n][1],pts[n+1][1],u-n)))
    return o

def draw13(p):
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im);grow=ease((p-.08)/.32); retract=1-ease((p-.78)/.22); active=grow*retract; rng=random.Random(1313)
    if active<=0:
        if p==0:
            d.ellipse((337,201,346,204),fill=(75,59,43,190));d.point((342,200),fill=(163,143,93,220))
        return im
    # Original soil point and parent anatomy: every branch begins on an existing junction.
    origin=(342,203); trunk=[origin,(348,196),(358,193),(367,187),(378,186),(388,179)]
    # drawing the contact shadow and pushed-up earth
    d.ellipse((331,200,355,208),fill=(38,31,26,int(175*retract)))
    poly(d,[(333,203),(337,200),(343,199),(347,201),(355,203),(351,205),(341,205)],(94,72,48,int(240*retract)))
    main=partial(trunk,active)
    def branch(pts,width):
        taper(d,pts,width,(35,40,29,int(245*retract)));taper(d,[(x,y-1) for x,y in pts],max(1,width-2),(105,118,65,int(245*retract)));taper(d,[(x,y-2) for x,y in pts],max(1,width-5),(154,155,94,int(220*retract)))
    branch(main,10)
    branches=[(0.35,[(358,193),(356,185),(359,178),(364,174)],6),(.52,[(367,187),(368,195),(376,198),(382,196)],6),(.69,[(378,186),(380,177),(376,171),(371,169)],5),(.82,[(388,179),(394,177),(398,174)],4)]
    for onset,pts,w in branches:
        u=max(0,min(1,(active-onset)/(1-onset)))
        if u>0: branch(partial(pts,u),w)
    # A hooked daughter explicitly bends under load, then extends a thorn from its tip.
    if active>.73:
        flex=ease((p-.36)/.18)*(1-ease((p-.64)/.15))
        anchor=(388,179); elbow=(394,182+3*flex); tip=(400,179+3*flex)
        branch(partial([anchor,elbow,tip],min(1,(active-.73)/.22)),5)
        thrust=ease((p-.49)/.12)*(1-ease((p-.65)/.15))*retract
        if thrust>0:
            tx=tip[0]+13*thrust; ty=tip[1]-5*thrust
            poly(d,[(tip[0]-1,tip[1]-2),(tx,ty),(tip[0]+1,tip[1]+2)],(43,50,31,int(255*retract)))
            poly(d,[(tip[0],tip[1]-1),(tx,ty),(tip[0]+1,tip[1])],(206,202,130,int(255*retract)))
            line(d,[tip,(tx,ty)],(241,225,163,int(225*retract)),1)
    # bark marks are clipped to branch silhouette, never another structure
    bark=Image.new('RGBA',(W,H));bd=ImageDraw.Draw(bark)
    for i in range(22):
        x=rng.randrange(343,399);y=rng.randrange(170,205);line(bd,[(x,y),(x+2,y-1)],(207,183,119,int(120*retract)),1)
    import PIL.ImageChops as IC; bark.putalpha(IC.multiply(bark.getchannel('A'),im.getchannel('A')));im=Image.alpha_composite(im,bark)
    return mask_actors(im)

def dimage(t,base):
    # Source layers are raw additive RGB framebuffer outputs; NOT brightness-keyed PNGs.
    bg=np.array(base.convert('RGB'),dtype=np.float32); accum=np.zeros_like(bg)
    for role,gain in [('body',1.15),('core',.85)]:
        raw=np.frombuffer(gzip.decompress((TMP/f'd-{t}-{role}.rgba.gz').read_bytes()),dtype=np.uint8).reshape(270,480,4)[:,:,:3]
        # source logical scale 1:1 -> native physical pixel frame; center (244,132) mapped to (746,381)
        x0,y0=746-244,381-132
        yy0=max(0,y0);xx0=max(0,x0);yy1=min(720,y0+270);xx1=min(1280,x0+480)
        accum[yy0:yy1,xx0:xx1] += raw[yy0-y0:yy1-y0,xx0-x0:xx1-x0]*gain
    mask=mask_actors(Image.new('RGBA',(W,H),(255,255,255,255))).getchannel('A').resize((1280,720),Image.Resampling.NEAREST)
    # spatially bound effect to the world view (never UI); all 14 emitters remain in source batches.
    accum*=np.array(mask,dtype=np.float32)[:,:,None]/255
    return Image.fromarray(np.clip(bg+accum,0,255).astype('uint8'),'RGB')

lights=['normal','dimmed']; ticks=[1,120,240,360,456,489,516,546,570,588]; key04=[0,.2,.42,.6,.76,1];key13=[0,.25,.46,.60,.72,1]; keyd=[1,120,360,516,546,588]
for light in lights:
    base=Image.open(BASE/f'N13-{light}/frame-01.png').convert('RGB');assert base.size==(1280,720)
    for role,keys,fn in [('04',key04,draw04),('13',key13,draw13)]:
        folder=O/role/light;folder.mkdir(parents=True,exist_ok=True)
        for i,p in enumerate(keys):
            ov=fn(p).resize((1280,720),Image.Resampling.NEAREST);Image.alpha_composite(base.convert('RGBA'),ov).convert('RGB').save(folder/f'beat{i+1}.png',optimize=True)
        # additional animation-only frames are small transparent pixel layers shared between lights
        if light=='normal':
            ad=O/role/'anim';ad.mkdir(parents=True,exist_ok=True)
            for i in range(31):fn(i/30).save(ad/f'{i:02}.png',optimize=True)
    folder=O/'19'/light;folder.mkdir(parents=True,exist_ok=True)
    for t in ticks:dimage(t,base).save(folder/f'tick{t}.png',optimize=True)
    for i,t in enumerate(keyd):
        # symlink-free offline zip; only one copy per selected frame on disk
        pass
    base.save(O/f'base-{light}.png',optimize=True)
print('created',O)
