class_name ArcanaSourceScarDrawLedger
extends RefCounted

## COMPLETE original crackScar() Pixi Graphics draw-call ledger:
## original src/engine/fx.ts crackScar() and original src/engine/draw.ts
## disc(), shadeRamp(), hiRamp(); src/engine/util.ts mix().
## Preserves polygon/rectangle geometry, draw order, colors and alpha.
## Does not claim GPU raster or final multi-pass post/shader parity.
const SCAR=preload("res://prototypes/gold_pair/arcana_source_crack_scar.gd")
const TAU=PI*2.0
var scar:ArcanaSourceCrackScar
var source_color:int=0xff5a1f

func _init()->void:
    scar=SCAR.new()

func configure(seed:int,x:float,y:float,n:int,length:float,life:float,color:int,ys:float=0.7)->void:
    source_color=color
    scar.configure(seed,x,y,n,length,life,ys)

static func _pack(r:float,g:float,b:float)->int:
    return ((clampi(int(r),0,255)<<16) |
        (clampi(int(g),0,255)<<8) | clampi(int(b),0,255))

static func _mix(a:int,b:int,t:float)->int:
    t=clampf(t,0.0,1.0)
    return _pack(
        float((a>>16)&255)+float(((b>>16)&255)-((a>>16)&255))*t,
        float((a>>8)&255)+float(((b>>8)&255)-((a>>8)&255))*t,
        float(a&255)+float((b&255)-(a&255))*t)

static func _shade_ramp(col:int,k:float)->int:
    k=clampf(k,0.0,1.0)
    var r:float=float((col>>16)&255)
    var g:float=float((col>>8)&255)
    var b:float=float(col&255)
    var warm:bool=r>b+20.0
    var shadow:Array[float]=[58.0,10.0,52.0] if warm else [18.0,22.0,68.0]
    var mid:Array[float]=[minf(255.0,r*0.9+30.0),g*0.42,minf(255.0,b*0.7+55.0)] if warm else [
        r*0.45,g*0.72,minf(255.0,b*0.95+35.0)]
    if k<0.5:
        var t:float=k*2.0
        return _pack(lerpf(shadow[0],mid[0],t),lerpf(shadow[1],mid[1],t),lerpf(shadow[2],mid[2],t))
    var t:float=(k-0.5)*2.0
    return _pack(lerpf(mid[0],r,t),lerpf(mid[1],g,t),lerpf(mid[2],b,t))

static func _hi_ramp(col:int,k:float)->int:
    k=clampf(k,0.0,1.0)
    var r:float=float((col>>16)&255)
    var g:float=float((col>>8)&255)
    var b:float=float(col&255)
    var warm:bool=r>=b
    var hi:Array[float]=[255.0,248.0,215.0] if warm else [225.0,250.0,255.0]
    return _pack(lerpf(r,hi[0],k),lerpf(g,hi[1],k),lerpf(b,hi[2],k))

static func _entry(layer:String,shape:String,points:PackedInt32Array,col:int,alpha:float)->String:
    return layer+"|"+shape+"|"+SCAR._csv(points)+"|"+str(col)+"|%.6f" % alpha

static func _disc(out:PackedStringArray,layer:String,x:float,y:float,r:float,col:int,
        alpha:float,ys:float)->void:
    if r<=0.0 or alpha<=0.01:return
    x=float(SCAR._rnd(x));y=float(SCAR._rnd(y))
    if r<=1.5:
        var s:int=2 if r>0.85 else 1
        out.append(_entry(layer,"R",PackedInt32Array([int(x)-(s>>1),int(y)-(s>>1),s,s]),col,alpha))
        return
    var n:int=clampi(SCAR._rnd(r*2.5),10,32)
    var p:PackedInt32Array=PackedInt32Array()
    for i in range(n):
        var angle:float=float(i)/float(n)*TAU
        p.append(SCAR._rnd(x+cos(angle)*r))
        p.append(SCAR._rnd(y+sin(angle)*r*ys))
    out.append(_entry(layer,"P",p,col,alpha))

func draw_trace(source_age:float,source_alpha:float=1.0)->PackedStringArray:
    var out:PackedStringArray=PackedStringArray()
    var x:float=scar.px;var y:float=scar.py
    var length:float=scar.radius;var ys:float=scar.squash
    var life:float=scar.duration
    var heat:float=clampf(1.0-source_age/(life*0.75),0.0,1.0)
    var pulse:float=0.75+0.25*sin(source_age*7.0+x*0.1)
    var deep:int=_shade_ramp(source_color,0.45)
    var mid:int=_shade_ramp(source_color,0.88)
    var hi:int=_hi_ramp(source_color,0.65)
    # Original central pit + two heat layers, from src/engine/draw.ts disc().
    _disc(out,"mark",x,y,minf(22.0,length*0.24),0x0b0916,0.65*source_alpha,ys)
    if heat>0.05:
        _disc(out,"glow",x,y,minf(14.0,length*0.16),deep,0.5*source_alpha*heat,ys)
        _disc(out,"glow",x,y,minf(7.0,length*0.08),hi,0.7*source_alpha*heat*pulse,ys)
    for branch in scar.branches:
        var pts:Array[Vector2i]=branch["pts"]
        var w0:float=float(branch["w0"])
        out.append(_entry("mark","P",SCAR._build_taper(pts,w0+2.0,1.0),0x0b0916,0.72*source_alpha))
        if heat>0.04:
            out.append(_entry("glow","P",SCAR._build_taper(pts,w0,0.85),
                _mix(deep,mid,heat),0.78*source_alpha*heat*pulse))
            if w0>3.0 and heat>0.25:
                var limit:int=maxi(2,pts.size()-1)
                var shortened:Array[Vector2i]=[]
                for i in range(limit):shortened.append(pts[i])
                out.append(_entry("glow","P",SCAR._build_taper(shortened,w0,0.38),hi,0.85*source_alpha*heat))
    for stone in scar.stones:
        out.append(_entry("mark","R",SCAR._rect(stone,false),0x0b0916,0.8*source_alpha))
        out.append(_entry("mark","R",SCAR._rect(stone,true),0x35334a,0.75*source_alpha))
    return out

func draw_sha256(source_age:float,source_alpha:float=1.0)->String:
    var lines:PackedStringArray=draw_trace(source_age,source_alpha)
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(("\n".join(lines)+"\n").to_utf8_buffer())
    return ctx.finish().hex_encode()
