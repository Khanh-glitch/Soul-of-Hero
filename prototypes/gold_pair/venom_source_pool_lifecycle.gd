class_name VenomSourcePoolLifecycle
extends RefCounted

## Port of ORIGINAL src/game/fx.ts Pool.upd(w, dt), including random bubble
## spawn, source World RNG call ordering, growth, cooldown and max hits.
## This is a CUE GENERATOR: emits bubbling and confirmed-contact candidates.
## Do not call enemy.take_damage() here. SOH CombatDamage remains sole authority.
const F:float=1.0/60.0
const TAU:float=PI*2.0
const SDF=preload("res://prototypes/gold_pair/venom_source_pool_sdf.gd")
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
var x:float=0.0
var y:float=0.0
var rad:float=0.0
var life:float=0.0
var age:float=0.0
var now:float=0.0
var nt:float=0.0
var frame:int=0
var dead:bool=false
var world_rng
var boil:float=0.0
var growth:float=0.3
var tick_every:float=0.7
var tick_amount:int=10
var tick_max:int=3
var tick_enabled:bool=true
var tick_kind:String="acid"
var source_skill_id:int=1
var hits:Dictionary={}
var events:Array[Dictionary]=[]
var current_frame_events:Array[Dictionary]=[]

func begin(source_x:float,source_y:float,radius:float,source_life:float,
        source_world_rng,boil_strength:float=2.0,source_grow:float=0.3,
        tick_interval:float=0.7,tick_damage:int=10,max_per_target:int=3,
        source_id:int=1,enable_damage:bool=true)->void:
    x=source_x
    y=source_y
    rad=radius
    life=source_life
    world_rng=source_world_rng
    boil=boil_strength
    growth=source_grow
    tick_every=tick_interval
    tick_amount=tick_damage
    tick_max=max_per_target
    tick_enabled=enable_damage
    source_skill_id=source_id
    age=0.0
    now=0.0
    nt=0.0
    frame=0
    dead=false
    # A new pool must never clear the ledger of an earlier pool in this cast.
    # Glassfang's three finisher pools bind the same Hits object after begin().
    hits={}
    events.clear()
    current_frame_events.clear()

func bind_shared_hits(shared_ledger:Dictionary)->void:
    # Godot Dictionaries share backing storage. All three source finisher
    # Pools must use the SAME ledger for the three-hit cap and cooldown.
    hits=shared_ledger

func _hit_allowed(id:int,source_time:float)->bool:
    if hits.has(id):
        var h:Dictionary=hits[id]
        if int(h["n"])>=tick_max or source_time-float(h["t"])<tick_every*0.8:
            return false
        h["t"]=source_time
        h["n"]=int(h["n"])+1
        hits[id]=h
        return true
    hits[id]={"t":source_time,"n":1}
    return true

func step_source_60hz(targets:Array,source_world_time:float=-1.0)->void:
    frame+=1
    # Original Hits.ok consults World.time, not age relative to this Pool.
    # Default preserves the original isolated Pool oracle's zero-based clock.
    now=source_world_time if source_world_time>=0.0 else now+F
    age+=F
    current_frame_events.clear()
    # Source Pool.upd checks dead before touching RNG/tick clocks.
    if age>life:
        dead=true
        return
    var gs:float=SDF._smooth(age/growth)
    if boil>0.0 and world_rng.next()<boil*F*60.0*0.1:
        var a:float=world_rng.range_between(0.0,TAU)
        var d:float=world_rng.range_between(0.0,rad*0.7*gs)
        var e:Dictionary={
            "f":frame,"k":"bubble",
            "x":x+cos(a)*d,"y":y+sin(a)*d*0.8,
            "vz":world_rng.range_between(5.0,12.0),
            "max":world_rng.range_between(0.4,0.9),
            "size":world_rng.range_between(1.5,3.2),
            # Original Pool emits these colors to Particles.add()
            "c1":0xFF529A27,"c2":0xFF30EAA6,"c3":0xFFA0FFEE
        }
        events.append(e)
        current_frame_events.append(e)
    nt-=F
    if tick_enabled and nt<=0.0 and gs>0.6:
        nt+=tick_every
        for target in targets:
            if float(target.get("dying",0.0))>0.0:continue
            var dx:float=float(target["x"])-x
            var dy:float=(float(target["y"])-y)*1.1
            var distance:float=sqrt(dx*dx+dy*dy)
            if distance<rad*0.85*gs+float(target["r"])*0.6 and _hit_allowed(int(target["id"]),now):
                var hit:Dictionary={
                    "f":frame,"k":"damage","id":int(target["id"]),
                    "amount":tick_amount,"kind":tick_kind,
                    "src":source_skill_id,
                    "at_x":float(target["x"]),"at_y":float(target["y"])
                }
                events.append(hit)
                current_frame_events.append(hit)
