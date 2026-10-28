class_name VenomSourcePoolShade
extends RefCounted

## 1:1 original Venomwright src/game/pixel.ts Field.shade() + fx.ts
## Pool.gnd() + mats.ts MAT.acid at Gold quality k=1, original 600x340.
## Shade relies on exact Gold PackedFloat32Array distance-field and procedural
## nz1/nz2. Not yet full World FX, damage, source camera or Level2 projection.
const POOL=preload("res://prototypes/gold_pair/venom_source_pool_sdf.gd")
const NOISE=preload("res://prototypes/gold_pair/venom_source_noise.gd")
const LAYER=preload("res://prototypes/gold_pair/venom_source_pixel_layer.gd")
const OUTLINE:int=0xFF080904 # P.k0
const RIM:int=0xFF30EAA6 # P.c1
const RIM_LIT:int=0xFFA0FFEE # P.c3
const RAMP: Array[int]=[
    0xFF222E0A, # P.e0
    0xFF354D12, # P.e1
    0xFF476F1A, # P.e2
    0xFF529A27, # P.e3
    0xFF22B56F, # P.c0
    0xFF30EAA6  # P.c1
]
const HI:int=0xFFA0FFEE # P.c3
const SH:int=0xFF222E0A # P.e0
const VEIN:int=0xFF58FAD4 # P.c2
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
var pool
var noise
var _output
var _light

func _init()->void:
    pool=POOL.new()
    noise=NOISE.new()
    _output=LAYER.new()
    _light=LAYER.new()

func begin(x:float,y:float,radius:float,duration:float,
        blob_count:int,growth:float,seed:int=-1)->void:
    pool.configure(x,y,radius,duration,blob_count,growth,seed)

func source_frame(source_age:float,source_world_time:float,
        flow_x:float=7.0,flow_y:float=3.0)->PackedByteArray:
    pool.seek_source_age(source_age,source_world_time)
    _output.bytes.fill(0)
    _output.dl=16
    _output.a=255
    _output.additive=false
    _shade(source_world_time,source_age,flow_x,flow_y)
    return _output.bytes

func _shade(source_world_time:float,source_age:float,flow_x:float,flow_y:float)->void:
    if pool.x1<0:return
    var rem:float=pool.life-source_age
    var dl:int=maxi(2,int(floor(16.0*rem+0.5))) if rem<1.0 else 16
    _output.dl=dl
    var f:PackedFloat32Array=pool.field
    var W:int=600
    var fx:float=flow_x*source_world_time
    var fy:float=flow_y*source_world_time
    var sd:float=float(pool.seed)*13.0
    var dep:float=7.0
    var sc:float=0.17
    var amp:float=0.55
    for y in range(pool.y0,pool.y1+1):
        for x in range(pool.x0,pool.x1+1):
            var idx:int=y*W+x
            var v:float=f[idx]
            if v<=0.0:continue
            var color:int=0
            if v<1.0:
                color=OUTLINE
            else:
                var lit:float=-((f[idx+1]-f[idx-1])*(-0.7)+(f[idx+W]-f[idx-W])*(-0.7))*0.5
                if v<2.0:
                    color=RIM_LIT if lit>0.25 else RIM
                else:
                    var sx:float=float(x)*sc+sd
                    var sy:float=float(y)*sc
                    var wp:float=float(noise.value2(sx*1.9-fy*0.6,sy*1.9+fx*0.6)-128)*0.05
                    var n:float=float(noise.value1(sx+fx+wp*9.0,sy+fy+wp*9.0))/255.0
                    var dn:float=clampf((v-2.0)/dep,0.0,1.0)
                    var q:float=(1.0-dn)*(1.0-amp)+n*amp
                    var ramp_idx:int=int(floor(q*float(RAMP.size())+(float(BAYER[((y&3)<<2)|(x&3)])-7.5)*0.05))
                    ramp_idx=clampi(ramp_idx,0,RAMP.size()-1)
                    color=RAMP[ramp_idx]
                    if v<5.0:
                        if lit>0.3:
                            color=HI
                        elif lit< -0.3:
                            color=SH
                    var n2:int=noise.value2(sx*1.3+fx*1.5,sy*1.3+fy*1.5+5.0)
                    if abs(n2-128)<5 and v>3.0:
                        color=VEIN
            _output.raw_px(x,y,color)
    _output.dl=16

func full_rgba_sha(data:PackedByteArray)->String:
    return NOISE.sha(data)


## Original fx.ts Pool.lit(): stepped additive source glow is a separate
## rendering layer. It is NOT merged into ground SDF or cast as fake sprite.
func source_light_frame(source_age:float)->PackedByteArray:
    _light.bytes.fill(0)
    _light.a=255
    _light.dl=16
    _light.additive=false
    var gs:float=POOL._smooth(source_age/pool.grow)
    var rem:float=pool.life-source_age
    _light.glow(pool.x,pool.y,pool.radius*1.3*gs,RAMP[3],
        0.18*clampf(rem,0.0,1.0),3)
    return _light.bytes
