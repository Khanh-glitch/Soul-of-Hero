class_name VenomGlassfangSourceParticles
extends RefCounted

## Original Venomwright src/game/fx.ts Particles.shadows/draw/glows
## for all 11 original FX particle kinds used throughout 21 Venom skills.
## Every particle draws original procedural polygons each frame.
## Numeric positions/velocities must come from original World.step or a
## source-equivalent physics port. No pre-rendered frames or fake PNGs.
const LAYER=preload("res://prototypes/gold_pair/venom_source_pixel_layer.gd")
const BK=0xFF060402
const K0=0xFF080904
var scene_layer
var glow_layer
var k:int=2

func _init(density:int=2)->void:
    k=density
    scene_layer=LAYER.new(density)
    glow_layer=LAYER.new(density)

func clear()->void:
    scene_layer.bytes.fill(0)
    glow_layer.bytes.fill(0)
    scene_layer.dl=16;scene_layer.a=255;scene_layer.additive=false
    glow_layer.dl=16;glow_layer.a=255;glow_layer.additive=false

func render_source_particles(parts:Array)->void:
    clear()
    scene_layer.dl=6
    for p in parts:
        if not p is Dictionary:continue
        var pt:Dictionary=p
        if float(pt.get("z",0.0))>2.0 and String(pt["k"]) in ["drop","chip","shard"]:
            scene_layer.dot(float(pt["x"]),float(pt["y"]),BK)
    scene_layer.dl=16
    for p in parts:
        if p is Dictionary:
            _draw_particle(p)
    glow_layer.additive=true
    glow_layer.a=70
    for p in parts:
        if not p is Dictionary:continue
        var pt:Dictionary=p
        if float(pt.get("glow",0.0))>0.0:
            glow_layer.disc(float(pt["x"]),float(pt["y"])-float(pt["z"]),
                float(pt["glow"]),int(pt["c1"]))
    glow_layer.additive=false
    glow_layer.a=255

func _draw_particle(p:Dictionary)->void:
    var kind:String=String(p["k"])
    var x:float=float(p["x"])
    var y:float=float(p["y"])-float(p["z"])
    var age:float=float(p["age"])
    var life:float=float(p["max"])
    var a:float=age/life
    var sz:float=float(p["size"])
    var c1:int=int(p["c1"])
    var c2:int=int(p["c2"])
    var c3:int=int(p["c3"])
    match kind:
        "drop":
            if int(p.get("trail",0))!=0 and absf(float(p.get("vz",0.0)))>35.0:
                var trail_length:int=mini(4,int(floor(absf(float(p["vz"]))*0.02)))
                for i in range(1,trail_length+1):
                    scene_layer.dl=12-i*2
                    scene_layer.dot(x,y-(-float(i)*1.2 if float(p["vz"])<0.0 else float(i)*1.2),c3)
                scene_layer.dl=16
            if sz<=1.2:
                scene_layer.dot(x,y,c1)
            elif sz<=2.2:
                scene_layer.disc(x,y,sz*0.5,c1)
                scene_layer.dot(x,y-0.4,c2)
            elif sz<=3.2:
                scene_layer.disc(x,y,sz*0.5,c3)
                scene_layer.disc(x,y,sz*0.35,c1)
                scene_layer.dot(x-0.5,y-0.5,c2)
            else:
                scene_layer.disc(x,y,sz*0.55,c3)
                scene_layer.disc(x,y,sz*0.4,c1)
                scene_layer.dot(x-0.6,y-0.6,c2)
                scene_layer.dot(x+0.2,y-0.6,c2)
        "shard":
            scene_layer.shard(x,y,float(p["rot"]),sz,sz*0.42,c1,c2,c3)
        "chip":
            var chip_size:float=maxf(1.5,sz)
            var ca:float=cos(float(p["rot"]))
            var sa:float=sin(float(p["rot"]))
            var pts:Array[float]=[
                x-ca*chip_size-sa*chip_size*0.6,
                y-sa*chip_size+ca*chip_size*0.6,
                x+ca*chip_size-sa*chip_size*0.6,
                y+sa*chip_size+ca*chip_size*0.6,
                x+ca*chip_size+sa*chip_size*0.6,
                y+sa*chip_size-ca*chip_size*0.6,
                x-ca*chip_size+sa*chip_size*0.6,
                y-sa*chip_size-ca*chip_size*0.6
            ]
            scene_layer.poly(pts,c1)
            scene_layer.line(pts[0],pts[1],pts[2],pts[3],c3)
            scene_layer.dot(x,y,c2)
        "bubble":
            var wob:float=sin(age*6.0+float(p["seed"]))*0.8
            _bubble(x+wob,y,sz,c1,c2,c3)
        "spore":
            scene_layer.dot(x,y,c1)
            if sz>1.0:
                scene_layer.dot(x+0.8,y,c2)
                scene_layer.dot(x-0.8,y,c2)
                scene_layer.dot(x,y+0.8,c2)
                scene_layer.dot(x,y-0.8,c2)
        "steam":
            var radius:float=sz*(0.5+a*0.9)
            scene_layer.dl=maxi(1,LAYER.jsround(9.0*(1.0-a)))
            scene_layer.disc(x,y,radius,c1)
            scene_layer.dl=maxi(1,LAYER.jsround(7.0*(1.0-a)))
            scene_layer.disc(x-radius*0.3,y-radius*0.35,radius*0.55,c2)
            scene_layer.dl=16
        "dust":
            var radius:float=sz*(0.6+a*0.8)
            scene_layer.dl=maxi(1,LAYER.jsround(10.0*(1.0-a)))
            scene_layer.disc(x,y,radius,c1)
            scene_layer.dl=maxi(1,LAYER.jsround(6.0*(1.0-a)))
            scene_layer.disc(x-0.8,y-0.8,radius*0.6,c2)
            scene_layer.dl=16
        "petal":
            var pc:float=cos(float(p["rot"]))*sz
            var ps:float=sin(float(p["rot"]))*sz*0.6
            var polygon:Array[float]=[
                x-pc,y-ps,
                x,y-ps*0.5-1.0,
                x+pc,y+ps,
                x,y+ps*0.5+1.0
            ]
            scene_layer.poly(polygon,c1)
            scene_layer.dot(x,y,c2)
        "ember":
            scene_layer.dot(x,y,c1)
            scene_layer.dot(x,y+0.8,c2)
        "mote":
            scene_layer.dot(x,y,c1)
            if a<0.5:
                scene_layer.dot(x+0.8,y,c2)
        "spark":
            scene_layer.dot(x,y,c1)
            if a<0.7:
                scene_layer.dot(float(p["x"])-float(p.get("vx",0.0))*0.03,
                    float(p["y"])-float(p.get("vy",0.0))*0.03-float(p["z"])+float(p.get("vz",0.0))*0.03,
                    LAYER.color_mix(c1,K0,0.5) if c2!=0 else c1)
        _:
            push_error("Unsupported Venom Gold particle type "+kind)

func _bubble(x:float,y:float,r:float,tint:int,edge:int,hi:int)->void:
    if r<1.0:
        scene_layer.dot(x,y,hi)
        return
    var old_alpha:int=scene_layer.a
    var old_dl:int=scene_layer.dl
    scene_layer.dl=7
    scene_layer.disc(x,y,maxf(0.4,r-0.8),tint)
    scene_layer.dl=old_dl
    scene_layer.ring(x,y,r,0.8,edge)
    scene_layer.dot(x-r*0.45,y-r*0.5,hi)
    if r>2.2:
        scene_layer.dot(x-r*0.45+0.5,y-r*0.5,hi)
        scene_layer.dot(x+r*0.38,y+r*0.42,edge)
    scene_layer.a=old_alpha

func buffers()->Dictionary:
    return {"scene":scene_layer.bytes,"glow":glow_layer.bytes}

func hash(pass_name:String)->String:
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(scene_layer.bytes if pass_name=="scene" else glow_layer.bytes)
    return ctx.finish().hex_encode()
