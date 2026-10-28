class_name VenomSourceParticleEmitters
extends RefCounted

## Exact procedural burst emitters from original user Gold
## src/game/fx.ts drops/shards/chips/steam/dust.
## Uses source World RNG and source Particles.add() so all 21 spells share
## original random-call order and physically simulated live particles.
const RND=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const WORLD=preload("res://prototypes/gold_pair/venom_source_particles_world.gd")
const TAU:float=PI*2.0
const P_I3:int=4283196014
const P_I2:int=4285435806
var rng
var world

func _init(source_seed:int=1,source_world=null)->void:
    rng=RND.new(source_seed)
    world=source_world if source_world!=null else WORLD.new()

func _rand(a:float,b:float)->float:
    return rng.range_between(a,b)

func drops(x:float,y:float,n:int,sp:float,c1:int,c2:int,c3:int,opts:Dictionary={})->void:
    var range_sz:Array=opts.get("size",[1.2,3.0])
    for i in range(n):
        var a:float=float(opts["ang"])+(rng.next()-0.5)*float(opts.get("spread",TAU)) if opts.has("ang") else rng.next()*TAU
        var s:float=sp*(0.35+rng.next()*0.65)
        world.add({"k":"drop","x":x,"y":y,"z":float(opts.get("z",2.0)),
            "vx":cos(a)*s,"vy":sin(a)*s*0.85,
            "vz":float(opts.get("up",60.0))*(0.4+rng.next()*0.9),
            "grav":230.0,
            "size":_rand(float(range_sz[0]),float(range_sz[1])),
            "c1":c1,"c2":c2,"c3":c3,
            "land":int(opts.get("land",1)),"max":float(opts.get("max",2.0)),
            "glow":float(opts.get("glow",0.0)),"trail":1})

func shards(x:float,y:float,n:int,sp:float,c1:int,c2:int,c3:int,opts:Dictionary={})->void:
    var range_sz:Array=opts.get("size",[3.0,6.0])
    for i in range(n):
        var a:float=float(opts["ang"])+(rng.next()-0.5)*float(opts.get("spread",TAU)) if opts.has("ang") else rng.next()*TAU
        var s:float=sp*(0.3+rng.next()*0.7)
        world.add({"k":"shard","x":x,"y":y,"z":float(opts.get("z",3.0)),
            "vx":cos(a)*s,"vy":sin(a)*s*0.85,
            "vz":float(opts.get("up",70.0))*(0.4+rng.next()),
            "grav":240.0,
            "size":_rand(float(range_sz[0]),float(range_sz[1])),
            "rot":_rand(0.0,TAU),"vr":_rand(-12.0,12.0),
            "c1":c1,"c2":c2,"c3":c3,
            "land":int(opts.get("land",2)),"max":3.0})

func chips(x:float,y:float,n:int,sp:float,c1:int,c2:int,c3:int,opts:Dictionary={})->void:
    var range_sz:Array=opts.get("size",[1.8,3.8])
    for i in range(n):
        var a:float=float(opts["ang"])+(rng.next()-0.5)*float(opts.get("spread",TAU)) if opts.has("ang") else rng.next()*TAU
        var s:float=sp*(0.3+rng.next()*0.7)
        world.add({"k":"chip","x":x,"y":y,"z":float(opts.get("z",3.0)),
            "vx":cos(a)*s,"vy":sin(a)*s*0.85,
            "vz":float(opts.get("up",80.0))*(0.4+rng.next()),
            "grav":260.0,
            "size":_rand(float(range_sz[0]),float(range_sz[1])),
            "rot":_rand(0.0,3.0),"vr":_rand(-14.0,14.0),
            "c1":c1,"c2":c2,"c3":c3,"land":3,"max":3.5})

func steam(x:float,y:float,n:int,sp:float,c1:int,c2:int,
        size:float=4.0,opts:Dictionary={})->void:
    for i in range(n):
        var a:float=rng.next()*TAU
        var s:float=sp*rng.next()
        world.add({"k":"steam","x":x,"y":y,"z":float(opts.get("z",2.0)),
            "vx":cos(a)*s,"vy":sin(a)*s*0.7,
            "vz":float(opts.get("vz",14.0))*(0.5+rng.next()),
            "size":size*(0.7+rng.next()*0.6),
            "max":float(opts.get("max",0.9))*(0.7+rng.next()*0.6),
            "c1":c1,"c2":c2,"drag":1.5})

func dust(x:float,y:float,n:int,sp:float,size:float=4.0)->void:
    steam(x,y,n,sp,P_I3,P_I2,size,{"vz":4.0,"max":0.6})

func snapshot_hash()->String:
    var rows:PackedStringArray=[]
    for p in world.list:
        var vals:Array[String]=[
            str(int(p["seed"])),String(p["k"])
        ]
        for key in ["x","y","z","vx","vy","vz","grav","size","rot","vr","max","drag","glow"]:
            vals.append("%.6f" % float(p[key]))
        for key in ["land","bounce","trail","c1","c2","c3"]:
            vals.append(str(int(p[key])))
        rows.append("|".join(vals))
    var data:String="\n".join(rows)+"\n"
    var ctx:=HashingContext.new()
    ctx.start(HashingContext.HASH_SHA256)
    ctx.update(data.to_utf8_buffer())
    return ctx.finish().hex_encode()
