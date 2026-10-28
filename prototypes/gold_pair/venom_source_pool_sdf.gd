class_name VenomSourcePoolSdf
extends RefCounted

## Exact source Venomwright src/game/fx.ts Pool blob seeds and
## src/game/pixel.ts Field.disc() *float32 distance field*, k=1 600x340.
## This preserves the ORIGINAL fluid geometry and overlaps, not simple circles.
## Shader/caustic shade(), pool ticks/boil and real map projection remain open.
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const DECAL=preload("res://prototypes/gold_pair/venom_source_decal.gd")
var W:int=600
var H:int=340
var source_density:int=1
const TAU:float=PI*2.0
var field:PackedFloat32Array
var blobs:Array[Dictionary]=[]
var seed:int=0
var x:float=0.0
var y:float=0.0
var radius:float=0.0
var life:float=0.0
var grow:float=0.3
var age:float=0.0
var x0:int=1000000000
var y0:int=1000000000
var x1:int=-1
var y1:int=-1

func _init(density:int=1)->void:
    source_density=density
    W=600*density
    H=340*density
    field=PackedFloat32Array()
    field.resize(W*H)

func configure(px:float,py:float,rad:float,source_life:float,
        num_blobs:int=5,growth:float=0.3,source_seed:int=-1)->void:
    x=px
    y=py
    radius=rad
    life=source_life
    grow=growth
    # Original Pool: Math.floor(hash(x*13+y)*1000), JS ToInt32
    seed=source_seed if source_seed>=0 else int(floor(DECAL._hash(int(px*13.0+py))*1000.0))
    blobs.clear()
    var r=RNG.new(seed+5)
    blobs.append({"dx":0.0,"dy":0.0,"r":rad*0.62})
    for i in range(num_blobs):
        var angle:float=r.range_between(0.0,TAU)
        var d:float=rad*r.range_between(0.25,0.62)
        blobs.append({"dx":cos(angle)*d,"dy":sin(angle)*d*0.9,
            "r":rad*r.range_between(0.28,0.5)})

static func _smooth(u:float)->float:
    u=clampf(u,0.0,1.0)
    return u*u*(3.0-2.0*u)

func _box(a:float,b:float,c:float,d:float)->bool:
    var aa:int=maxi(2,int(floor(a)))
    var bb:int=maxi(2,int(floor(b)))
    var cc:int=mini(W-3,int(ceil(c)))
    var dd:int=mini(H-3,int(ceil(d)))
    if aa>cc or bb>dd:return false
    x0=mini(x0,aa)
    y0=mini(y0,bb)
    x1=maxi(x1,cc)
    y1=maxi(y1,dd)
    return true

func _disc(cx:float,cy:float,r:float,goo:float)->void:
    var gcx:float=cx*float(source_density)
    var gcy:float=cy*float(source_density)
    var gr:float=r*float(source_density)
    if gr<=0.0:return
    if not _box(gcx-gr-1.0,gcy-gr-1.0,gcx+gr+1.0,gcy+gr+1.0):return
    var ax:int=maxi(2,int(floor(gcx-gr-1.0)))
    var bx:int=mini(W-3,int(ceil(gcx+gr+1.0)))
    var ay:int=maxi(2,int(floor(gcy-gr-1.0)))
    var by:int=mini(H-3,int(ceil(gcy+gr+1.0)))
    for iy in range(ay,by+1):
        for ix in range(ax,bx+1):
            var dx:float=float(ix)+0.5-gcx
            var dy:float=float(iy)+0.5-gcy
            var v:float=gr-sqrt(dx*dx+dy*dy)+0.5
            if v<=0.0:continue
            var idx:int=iy*W+ix
            var old:float=field[idx]
            if goo!=0.0 and old>0.0:
                field[idx]=maxf(old,v)+goo*minf(old,v)
            elif v>old:
                field[idx]=v # PackedFloat32Array stores source Float32 rounding

func seek_source_age(source_age:float,source_time:float)->void:
    age=source_age
    # Original Field.reset() zeroes only last active bounding rectangle.
    if x1>=0:
        for iy in range(y0,y1+1):
            for ix in range(x0,x1+1):
                field[iy*W+ix]=0.0
    x0=1000000000
    y0=1000000000
    x1=-1
    y1=-1
    var gs:float=_smooth(source_age/grow)
    for b in blobs:
        var bx:float=x+float(b["dx"])*gs
        var by:float=y+float(b["dy"])*gs
        var rad:float=float(b["r"])*gs*(1.0+sin(source_time*3.0+float(b["dx"]))*0.03)
        _disc(bx,by,rad,0.25)

func source_hash()->String:
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(field.to_byte_array())
    return ctx.finish().hex_encode()

func count_active()->int:
    var count:int=0
    if x1<0:return 0
    for iy in range(y0,y1+1):
        for ix in range(x0,x1+1):
            if field[iy*W+ix]>0.0:count+=1
    return count
