class_name VenomGlassfangSourceEnvironment
extends RefCounted

## Exact source procedural FX for Gold Glassfang Hunt environment and impacts.
## src/game/fx.ts Splash.gnd, Flash.air/lit, Ring.gnd/lit,
## Embed.up; and src/game/pixel.ts Layer/Glow, with native Ultra k2.
## No bitmap sprite sheets, no fabricated VFX geometries.
## Actor and Pool are rendered by separate source-ported adapters.
const LAYER=preload("res://prototypes/gold_pair/venom_source_pixel_layer.gd")
const DECAL=preload("res://prototypes/gold_pair/venom_source_decal.gd")
const TAU=PI*2.0
const WHITE=0xFFFFFFFF
const P_K0=0xFF080904
var density:int=2
var scene_layer
var glow_layer

func _init(source_density:int=2)->void:
    density=source_density
    scene_layer=LAYER.new(density)
    glow_layer=LAYER.new(density)

static func _hash(v:float)->float:
    # Original JS hash(n) first uses ToInt32(n), truncating toward zero.
    return DECAL._hash(int(v))

static func _jsround(v:float)->int:
    return int(floor(v+0.5))

func clear()->void:
    scene_layer.bytes.fill(0)
    glow_layer.bytes.fill(0)
    scene_layer.a=255;scene_layer.dl=16;scene_layer.additive=false
    glow_layer.a=255;glow_layer.dl=16;glow_layer.additive=false

func render_source_event(e:Dictionary)->void:
    var kind:String=String(e["kind"])
    var age:float=float(e.get("age",0.0))
    var x:float=float(e["x"]); var y:float=float(e["y"])
    match kind:
        "splash":
            _splash(x,y,float(e["radius"]),int(e["c1"]),int(e["c2"]),age)
        "flash":
            _flash(x,y,float(e["radius"]),int(e["color"]),float(e["duration"]),float(e.get("z",0.0)),age)
        "ring":
            _ring(x,y,float(e["radius"]),float(e["duration"]),e["colors"],
                float(e.get("width",3.0)),age,float(e.get("r0",0.0)),float(e.get("ease",2.0)))
        "embed":
            _embed(x,y,float(e["size"]),int(e["lit"]),int(e["dark"]),int(e["edge"]),
                float(e["duration"]),age)
        _:
            push_error("Original Venom source FX not yet supported: "+kind)

func buffers()->Dictionary:
    return {"scene":scene_layer.bytes,"glow":glow_layer.bytes}

func _splash(x:float,y:float,rad:float,c1:int,c2:int,age:float)->void:
    if age>0.34:return
    var a:float=age/0.34
    var r:float=rad*(0.5+a*1.4)
    scene_layer.dl=_jsround(14.0*(1.0-a*0.8))
    for i in range(8):
        var an:float=(float(i)/8.0)*TAU+_hash(float(i)+x)*0.5
        var rr:float=r*(0.8+_hash(float(i*7)+y)*0.4)
        var px:float=x+cos(an)*rr
        var py:float=y+sin(an)*rr*0.8
        scene_layer.dot(px,py,c2 if a<0.5 else c1)
        if a<0.6:
            scene_layer.dot(x+cos(an)*rr*0.6,y+sin(an)*rr*0.5-(1.0-a)*3.0,c1)
    scene_layer.ring(x,y,r*0.8,0.8,c1)
    scene_layer.dl=16

func _flash(x:float,y:float,rad:float,col:int,duration:float,z:float,age:float)->void:
    if age>duration:return
    var a:float=age/duration
    var r:float=rad*(1.0-a*0.5)
    var py:float=y-z
    scene_layer.dl=_jsround(16.0*(1.0-a))
    scene_layer.disc(x,py,r*0.55,WHITE)
    scene_layer.dl=_jsround(12.0*(1.0-a))
    scene_layer.disc(x,py,r*0.8,col)
    scene_layer.dl=16
    glow_layer.glow(x,py,rad*2.2*(1.0-a*0.4),col,0.4*(1.0-a),5)

func _ring(x:float,y:float,r1:float,duration:float,colors:Array,
        width:float,age:float,r0:float,ease:float)->void:
    if age>duration:return
    var t:float=clampf(age/duration,0.0,1.0)
    var e:float=1.0-pow(1.0-t,ease)
    var cur:float=r0+(r1-r0)*e
    var w:float=maxf(1.0,width*(1.0-t*0.7))
    var c0:int=int(colors[0]);var c1:int=int(colors[1]);var c2:int=int(colors[2])
    scene_layer.dl=maxi(1,_jsround(16.0*(1.0-t*t)))
    scene_layer.ring(x,y,maxf(0.5,cur-1.0),w+1.0,c2)
    scene_layer.ring(x,y,cur,maxf(0.8,w-1.0),c1)
    scene_layer.ring(x,y,cur+1.0,0.8,c0)
    scene_layer.dl=16
    glow_layer.additive=true
    glow_layer.a=_jsround(90.0*(1.0-t))
    glow_layer.ring(x,y,cur,2.0,c1)
    glow_layer.additive=false
    glow_layer.a=255

func _embed(x:float,y:float,size:float,lit:int,dark:int,edge:int,
        life:float,age:float)->void:
    if age>life:return
    var fade:float=(life-age)/0.8 if life-age<0.8 else 1.0
    scene_layer.dl=_jsround(16.0*fade)
    var sz:float=maxf(2.0,size)
    var lean:float=(_hash(x*3.0+y)-0.5)*3.0
    var h:float=sz*1.4+1.0
    var left_face:Array[float]=[x-1.5,y,x+lean,y-h,x+1.5,y]
    var right_face:Array[float]=[x,y,x+lean,y-h,x+1.5,y]
    scene_layer.poly(left_face,lit)
    scene_layer.poly(right_face,dark)
    scene_layer.dot(x+lean,y-h,edge)
    scene_layer.line(x-1.0,y,x+lean*0.8,y-h*0.8,edge)
    scene_layer.dl=16

func source_sha(pass_name:String)->String:
    var bytes:PackedByteArray=scene_layer.bytes if pass_name=="scene" else glow_layer.bytes
    var h:=HashingContext.new()
    h.start(HashingContext.HASH_SHA256)
    h.update(bytes)
    return h.finish().hex_encode()
