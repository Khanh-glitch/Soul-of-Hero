class_name VenomSourceParticleWorld
extends RefCounted

## Source-owned full physical lifecycle port of original
## Venomwright src/game/fx.ts Particles.add/update (no Fn callbacks yet).
## No canned paths: all positions, rotations, landings/bounces are evaluated
## at original 60Hz; spawned Splash/Embed/Spark cues are source-equivalent.
## Reusable by ALL 21 Gold skills. No actual damage is applied here.
const F:float=1.0/60.0
const GOLD_C1:int=0xFF30EAA6
const GOLD_C3:int=0xFFA0FFEE
const GOLD_E1:int=0xFF354D12
var list:Array[Dictionary]=[]
var n:int=0
var frame:int=0
var events:Array[Dictionary]=[]
var live_world_time:float=0.0

func reset()->void:
    list.clear()
    n=0
    frame=0
    events.clear()
    live_world_time=0.0

func add(o:Dictionary)->Dictionary:
    if list.size()>4200:return {}
    n+=1
    var p:Dictionary={
        "x":0.0,"y":0.0,"z":0.0,"vx":0.0,"vy":0.0,"vz":0.0,
        "age":0.0,"max":1.0,"size":1.0,"rot":0.0,"vr":0.0,
        "grav":0.0,"drag":0.0,"c1":GOLD_C1,"c2":GOLD_C3,"c3":GOLD_E1,
        "land":0,"seed":n,"glow":0.0,"bounce":0,"trail":0
    }
    p.merge(o,true)
    if not p.has("k"):
        push_error("Gold Particles.add requires original kind")
        return {}
    list.append(p)
    return p

func step_source_60hz()->void:
    _step(F)

func _step(dt:float)->void:
    frame+=1
    live_world_time+=dt
    for i in range(list.size()-1,-1,-1):
        var p:Dictionary=list[i]
        p["age"]=float(p["age"])+dt
        var dead:bool=float(p["age"])>=float(p["max"])
        if p.has("fn"):
            var callback:Variant=p["fn"]
            if callback is Callable:
                callback.call(p,dt)
            else:
                push_error("Nonported source custom Part.fn for "+str(p.get("k")))
        p["vz"]=float(p["vz"])-float(p["grav"])*dt
        var drag:float=float(p["drag"])
        if drag!=0.0:
            var m:float=maxf(0.0,1.0-drag*dt)
            p["vx"]=float(p["vx"])*m
            p["vy"]=float(p["vy"])*m
            if String(p["k"])!="drop":
                p["vz"]=float(p["vz"])*m
        p["x"]=float(p["x"])+float(p["vx"])*dt
        p["y"]=float(p["y"])+float(p["vy"])*dt
        p["z"]=float(p["z"])+float(p["vz"])*dt
        p["rot"]=float(p["rot"])+float(p["vr"])*dt
        if int(p["land"])!=0 and float(p["z"])<=0.0 and float(p["vz"])<0.0 and not dead:
            p["z"]=0.0
            if int(p["land"])==3 and int(p["bounce"])<2:
                p["vz"]=-float(p["vz"])*0.4
                p["vx"]=float(p["vx"])*0.55
                p["vy"]=float(p["vy"])*0.55
                p["bounce"]=int(p["bounce"])+1
                p["vr"]=float(p["vr"])*0.5
            else:
                dead=true
                match int(p["land"]):
                    1,4:
                        events.append({"kind":"splash","frame":frame,
                            "x":p["x"],"y":p["y"],
                            "radius":maxf(2.0,float(p["size"])*1.3),
                            "c1":p["c1"],"c2":p["c2"]})
                    2:
                        events.append({"kind":"embed","frame":frame,
                            "x":p["x"],"y":p["y"],
                            "size":p["size"],"lit":p["c1"],
                            "dark":p["c2"],"edge":p["c3"],
                            "duration":5+int(p["seed"])%4})
        if String(p["k"])=="bubble" and float(p["age"])>=float(p["max"]):
            # Original source appends these BEFORE the dying particle is
            # swapped with the new list tail; preserve exact array semantics.
            add({"k":"spark","x":p["x"],"y":p["y"],
                "z":float(p["z"])+1.0,"vx":12.0,"vy":-6.0,"vz":8.0,
                "max":0.2,"c1":p["c3"]})
            add({"k":"spark","x":p["x"],"y":p["y"],
                "z":float(p["z"])+1.0,"vx":-12.0,"vy":-5.0,"vz":8.0,
                "max":0.2,"c1":p["c3"]})
        if dead:
            list[i]=list[list.size()-1]
            list.pop_back()

func source_stats()->Dictionary:
    var kinds:Dictionary={}
    for p in list:
        var k:String=String(p["k"])
        kinds[k]=int(kinds.get(k,0))+1
    return {
        "frame":frame,
        "source_60hz_time":live_world_time,
        "current_parts":list.size(),
        "created_count":n,
        "landed_events":events.size(),
        "kinds":kinds
    }
