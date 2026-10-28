class_name VenomSourcePixelLayer
extends RefCounted

## Original Venomwright pixel.ts Layer CPU draw at k=1, RGBA little endian.
const W=600
const H=340
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
var bytes:PackedByteArray
var a:int=255
var dl:int=16
var additive:bool=false

func _init()->void:
    bytes=PackedByteArray()
    bytes.resize(W*H*4)

static func jsround(x:float)->int:
    return int(floor(x+0.5))

func raw_px(x:int,y:int,col:int)->void:
    if x<0 or y<0 or x>=W or y>=H: return
    if dl<16 and BAYER[((y&3)<<2)|(x&3)]>=dl: return
    var i:int=(y*W+x)*4
    var rr:int=col&255
    var gg:int=(col>>8)&255
    var bb:int=(col>>16)&255
    if additive:
        bytes[i]=mini(255,int(bytes[i])+((rr*a)>>8))
        bytes[i+1]=mini(255,int(bytes[i+1])+((gg*a)>>8))
        bytes[i+2]=mini(255,int(bytes[i+2])+((bb*a)>>8))
        bytes[i+3]=255
    elif a==255:
        bytes[i]=rr
        bytes[i+1]=gg
        bytes[i+2]=bb
        bytes[i+3]=(col>>24)&255
    else:
        var ia:int=255-a
        bytes[i]=int((rr*a+int(bytes[i])*ia)/255.0)
        bytes[i+1]=int((gg*a+int(bytes[i+1])*ia)/255.0)
        bytes[i+2]=int((bb*a+int(bytes[i+2])*ia)/255.0)
        bytes[i+3]=255

func raw_hline(x0:int,x1:int,y:int,col:int)->void:
    if y<0 or y>=H or x0>x1: return
    x0=maxi(0,x0); x1=mini(W-1,x1)
    for x in range(x0,x1+1): raw_px(x,y,col)

func px(x:float,y:float,col:int)->void:
    raw_px(jsround(x),jsround(y),col)

func dot(x:float,y:float,col:int)->void:
    px(x,y,col)

func disc(cx:float,cy:float,r:float,col:int)->void:
    var gx:int=jsround(cx)
    var gy:int=jsround(cy)
    var rad:float=r+0.35
    var ri:int=int(ceil(r))
    for dy in range(-ri,ri+1):
        var w:int=int(floor(sqrt(maxf(0.0,rad*rad-float(dy*dy)))))
        raw_hline(gx-w,gx+w,gy+dy,col)

func ellipse(cx:float,cy:float,rx:float,ry:float,col:int)->void:
    var gx:int=jsround(cx)
    var gy:int=jsround(cy)
    var rY:float=ry+0.35
    for dy in range(-int(ceil(ry)),int(ceil(ry))+1):
        var q:float=1.0-float(dy*dy)/(rY*rY)
        if q<0.0: continue
        var w:int=int(floor((rx+0.35)*sqrt(q)))
        raw_hline(gx-w,gx+w,gy+dy,col)

func line(x0:float,y0:float,x1:float,y1:float,col:int)->void:
    var gx0:int=jsround(x0); var gy0:int=jsround(y0)
    var gx1:int=jsround(x1); var gy1:int=jsround(y1)
    var dx:int=absi(gx1-gx0); var dy:int=-absi(gy1-gy0)
    var sx:int=1 if gx0<gx1 else -1
    var sy:int=1 if gy0<gy1 else -1
    var err:int=dx+dy
    var n:int=0
    while true:
        raw_px(gx0,gy0,col)
        if gx0==gx1 and gy0==gy1: break
        var e2:int=2*err
        if e2>=dy: err+=dy; gx0+=sx
        if e2<=dx: err+=dx; gy0+=sy
        n+=1
        if n>2400: break

func poly(p:Array[float],col:int)->void:
    var mn:float=1e9; var mx:float=-1e9
    var n:int=int(p.size()/2)
    for i in range(n):
        mn=minf(mn,p[i*2+1]); mx=maxf(mx,p[i*2+1])
    for y in range(int(ceil(mn-0.5)),int(floor(mx-0.5))+1):
        var ys:float=float(y)+0.5
        var xs:Array[float]=[]
        for i in range(n):
            var j:int=(i+1)%n
            var ay:float=p[i*2+1]; var by:float=p[j*2+1]
            if (ay<=ys and ys<by) or (by<=ys and ys<ay):
                xs.append(p[i*2]+((ys-ay)/(by-ay))*(p[j*2]-p[i*2]))
        xs.sort()
        for k in range(0,xs.size()-1,2):
            raw_hline(int(ceil(xs[k]-0.5)),int(ceil(xs[k+1]-0.5))-1,y,col)

func tri(ax:float,ay:float,bx:float,by:float,cx:float,cy:float,col:int)->void:
    poly([ax,ay,bx,by,cx,cy],col)

static func color_mix(c1:int,c2:int,k:float)->int:
    if k<=0.0:return c1
    if k>=1.0:return c2
    var rgb:Array[int]=[]
    for shift in [0,8,16]:
        var a1:int=(c1>>shift)&255; var a2:int=(c2>>shift)&255
        rgb.append(int(float(a1)+float(a2-a1)*k)&255)
    return 0xFF000000|(rgb[2]<<16)|(rgb[1]<<8)|rgb[0]

func shard(x:float,y:float,ang:float,length:float,wid:float,lit:int,dark:int,edge:int)->void:
    if length<1.5:
        px(x,y,lit);return
    var ca:float=cos(ang); var sa:float=sin(ang)
    var tx:float=x+ca*length; var ty:float=y+sa*length
    var bx:float=x-ca*length*0.4; var by:float=y-sa*length*0.4
    var mx:float=x+ca*length*0.1; var my:float=y+sa*length*0.1
    var lx:float=mx-sa*wid; var ly:float=my+ca*wid
    var rx:float=mx+sa*wid; var ry:float=my-ca*wid
    tri(tx,ty,lx,ly,bx,by,lit)
    tri(tx,ty,rx,ry,bx,by,dark)
    line(tx,ty,lx,ly,edge)
    line(tx,ty,bx,by,color_mix(edge,lit,0.5))

func worm_body(segs:Array[Dictionary],palette:Dictionary)->void:
    var lo:float=0.28
    for i in range(segs.size()-1,-1,-1):
        var s:Dictionary=segs[i]
        disc(float(s.x),float(s.y),float(s.r)+1.0,int(palette.o))
    for i in range(segs.size()-1,-1,-1):
        var s:Dictionary=segs[i]
        disc(float(s.x),float(s.y),float(s.r),int(palette.d))
    for i in range(segs.size()-1,-1,-1):
        var s:Dictionary=segs[i]; var r:float=float(s.r)
        disc(float(s.x)-r*lo*0.6,float(s.y)-r*lo,r*0.78,int(palette.b))
    for i in range(segs.size()-1,-1,-1):
        var s:Dictionary=segs[i]; var r:float=float(s.r)
        if r>1.2: disc(float(s.x)-r*lo,float(s.y)-r*lo*1.5,r*0.44,int(palette.l))
    for i in range(0,segs.size(),2):
        var s:Dictionary=segs[i]; var r:float=float(s.r)
        if r>1.8: dot(float(s.x)-r*0.45,float(s.y)-r*0.55,int(palette.s))

func glow(cx:float,cy:float,r:float,col:int,k:float,bands:int)->void:
    additive=true
    var n:int=maxi(2,mini(bands,int(ceil(r/2.5))))
    a=jsround(255.0*k/float(n))
    for i in range(n): disc(cx,cy,r*(1.0-float(i)/float(n)),col)
    additive=false; a=255
