class_name GoldHairlineGround
extends RefCounted

## Literal port of source ground.ts groove/crack/rubble pixel writes.
## This edits an RGBA buffer, not TileMap collision or a drawn imitation.
const W := 480
const H := 270
var pixels: PackedByteArray = PackedByteArray()
var _rng: int = 7

func _init() -> void:
    pixels.resize(W * H * 4)

func fill(r: int,g: int,b: int,a: int = 255) -> void:
    for k in range(W*H):
        var p := k*4
        pixels[p]=r
        pixels[p+1]=g
        pixels[p+2]=b
        pixels[p+3]=a

func load_ground(image: Image) -> void:
    assert(image.get_width()==W and image.get_height()==H)
    var copy: Image = image.duplicate()
    copy.convert(Image.FORMAT_RGBA8)
    pixels=copy.get_data()

func as_image() -> Image:
    return Image.create_from_data(W,H,false,Image.FORMAT_RGBA8,pixels)

func _rand() -> float:
    _rng=(_rng*1664525+1013904223)&0xFFFFFFFF
    return float(_rng)/4294967296.0

static func _u8(v: float) -> int:
    if v<=0.0:return 0
    if v>=255.0:return 255
    var x:=floori(v)
    var f:=v-x
    return x+1 if f>0.5 or (f==0.5 and (x&1)==1) else x

func _put(fx: float,fy: float,r: float,g: float,b: float,a: float) -> void:
    var x:=int(fx)
    var y:=int(fy)
    if x<0 or y<0 or x>=W or y>=H:return
    var off: int=(y*W+x)*4
    var inv:=1.0-a
    pixels[off]=_u8(float(pixels[off])*inv+r*a)
    pixels[off+1]=_u8(float(pixels[off+1])*inv+g*a)
    pixels[off+2]=_u8(float(pixels[off+2])*inv+b*a)

func _line(x0: float,y0: float,angle: float,length: float,branch: int) -> void:
    var x:=x0
    var y:=y0
    var a:=angle
    for step in range(ceili(length)):
        a+=(_rand()-0.5)*0.7
        x+=cos(a)
        y+=sin(a)*0.8
        _put(x,y,8.0,8.0,14.0,0.95)
        _put(x,y+1.0,20.8,20.8,34.4,0.3)
        if branch>0 and _rand()<0.06:
            var turn:=1.0 if _rand()<0.5 else -1.0
            _line(x,y,a+turn*(0.7+_rand()*0.6),length*0.35,branch-1)

func crack(x: float,y: float,angle: float,length: float,branch: int=1) -> void:
    _line(x,y,angle,length,branch)

func rubble(x: int,y: int,rad: int,strength: float=1.0) -> void:
    for j in range(-rad,rad+1):
        for i in range(-rad,rad+1):
            var dd:=sqrt(float(i*i)+float(j*j)*1.44)/float(rad)
            if dd>1.0 or _rand()<dd*0.85:continue
            _put(x+i,y+j*0.78,120.0+_rand()*60.0,114.0+_rand()*50.0,108.0+_rand()*40.0,0.35*strength*(1.0-dd))
    for n in range(ceili(rad*1.5)):
        var a:=_rand()*6.28
        var d:=_rand()*rad
        _put(x+cos(a)*d,y+sin(a)*d*0.78,200.0,196.0,190.0,0.8)

func groove(points: Array,glow: bool=false,width: int=1) -> void:
    for i in range(0,points.size()-3,2):
        var dx:=float(points[i+2])-float(points[i])
        var dy:=float(points[i+3])-float(points[i+1])
        var n:=maxi(1,ceili(sqrt(dx*dx+dy*dy)))
        for s in range(n+1):
            var x:=float(points[i])+dx*s/float(n)
            var y:=float(points[i+1])+dy*s/float(n)
            for k in range(width):_put(x,y+k,6.0,6.0,10.0,0.9)
            _put(x,y-1.0,90.0,96.0,112.0,0.35)
            if glow and (s+i)%2==0:_put(x,y,255.0,90.0,30.0,0.8)

static func bezier(x0: float,y0: float,cx: float,cy: float,x1: float,y1: float,n: int=20) -> Array:
    var out: Array=[]
    for i in range(n+1):
        var t:=float(i)/float(n)
        var u:=1.0-t
        out.append(u*u*x0+2.0*u*t*cx+t*t*x1)
        out.append(u*u*y0+2.0*u*t*cy+t*t*y1)
    return out

func source_first_groove() -> void:
    groove(bezier(96.0,154.0,230.0,156.0,376.0,154.0))

func source_second_groove() -> void:
    groove(bezier(100.0,153.0,230.0,155.0,376.0,153.0),false,2)

func sha256() -> String:
    var h:=HashingContext.new()
    h.start(HashingContext.HASH_SHA256)
    h.update(pixels)
    return h.finish().hex_encode()
