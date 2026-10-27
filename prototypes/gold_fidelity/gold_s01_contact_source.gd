class_name GoldS01ContactSource
extends RefCounted

## Direct translation of ORIGINAL fxlib.ts contact()->flashAt/sparks/lightAt.
## Uses exactly the same LCG as source-oracle replay, including the extra
## Math.random() consumed by new Blob() constructor. Accepts actual moving
## Enemy.center() from GoldS01EnemyPresentation; NO damage authority.
const MASK := 0xFFFFFFFF
const COOL := Vector3(0.62,0.78,1.0)
var rng_state: int
var objects: Array[Dictionary] = []

func _init(initial_rng_state: int = 0x20261027) -> void:
    rng_state = initial_rng_state & MASK

func random() -> float:
    rng_state = (rng_state*1664525+1013904223)&MASK
    return float(rng_state)/4294967296.0

func rnd(a: float,b: float) -> float:
    return a+random()*(b-a)

func source_enemy_constructor_rng_draw() -> void:
    # Called only if oracle starts from RNG state *before* original new Enemy().
    random()

func generate(enemy_center: Vector2, half_height: float, kind: String,
              direction: float, big: bool, stop: float = -1.0) -> Dictionary:
    objects.clear()
    var radius: float = (20.0 if kind=="heavy" else 15.0)*(1.5 if big else 1.0)
    var spikes: int = 8+int(floor(random()*4.0))
    var seed: float = random()*10.0
    objects.append({"kind":"blob","source":{
        "x":enemy_center.x,"y":enemy_center.y,
        "w":radius,"h":radius*0.9,"shape":5,"pal":1,"k1":spikes,
        "life":0.2,"layer":6,"fadeStart":0.8,"ease":2,"seed":seed
    }})
    random() # new Blob() seed field consumed even when overridden by Object.assign
    var total: int = 14 if big else 6
    for i in range(total):
        var angle: float = direction+rnd(-0.75,0.75)
        var velocity: float = rnd(100.0,260.0)
        objects.append({"kind":"part","source":{
            "x":enemy_center.x,"y":enemy_center.y+half_height,"z":half_height,
            "vx":cos(angle)*velocity,"vy":sin(angle)*velocity*0.8,
            "vz":rnd(20.0,120.0),"grav":260.0,"drag":1.5,
            "life":rnd(0.2,0.6),"streak":0.045,"size":1.0,
            "ramp":"silver","layer":6,"bounce":0.4,"shrink":0.3
        }})
    # No extra RNG from Enemy.hit, World.hitstop/shake, LightFx constructor.
    objects.append({"kind":"light","source":{
        "x":enemy_center.x,"y":enemy_center.y,"z":8.0,"r":46.0,
        "i":0.8,"c":COOL,"life":0.25,"hold":0.0,"t":0.0
    }})
    return {"objects":objects.duplicate(true),"rng_state_after":rng_state,
        "source_contact_center":enemy_center,
        "source_visual_only":true,"requested_hitstop":stop if stop>=0.0 else 0.035,
        "requested_shake":4.0 if big else 2.0,
        "source_nonfire":true,
        "does_not_write_damage":true}
