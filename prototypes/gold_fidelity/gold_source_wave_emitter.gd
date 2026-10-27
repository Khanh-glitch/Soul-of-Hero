class_name GoldSourceWaveEmitter
extends RefCounted

## Port of EXACT S01 non-center wave call graph from skills1.ts + fxlib.ts.
## Runtime spawns live particles and shards; images are never baked as frames.
const MASK := 0xFFFFFFFF
const TILT := 0.78
var _state: int = 0x20261027
var objects: Array[Dictionary] = []
var crack_angle := 0.0

func _init(seed: int = 0x20261027) -> void:
    _state = seed & MASK

func random_state() -> int:
    return _state

func _rand_unit() -> float:
    _state = (_state * 1664525 + 1013904223) & MASK
    return float(_state) / 4294967296.0

func _rnd_range(a: float, b: float) -> float:
    return a + _rand_unit() * (b - a)

func _rnd(max_value: float) -> float:
    return _rand_unit() * max_value

func _emit(kind: String, attributes: Dictionary) -> void:
    objects.append({"kind":kind,"source":attributes})
    # JS new Blob() consumes Math.random() in its field initializer
    # even though Object.assign overrides the seed from source.
    if kind == "blob":
        _rand_unit()

func _flash(x: float, y: float) -> void:
    _emit("blob",{"x":x,"y":y,"w":15.0,"h":13.5,"shape":5,
        "pal":1,"k1":6,"life":0.16,"layer":6,"fadeStart":0.8,
        "ease":2,"seed":_rnd(10.0)})

func _shards(x: float,y: float,n: int, direction: float,lo: float,hi: float) -> void:
    for i in range(n):
        var a: float = direction + _rnd_range(-0.65,0.65)
        var v: float = _rnd_range(lo,hi)
        _emit("chunk",{"x":x,"y":y,"z":6,
            "vx":cos(a)*v,"vy":sin(a)*v*0.8,
            "vz":_rnd_range(60.0,200.0),"rot":a,
            "spin":_rnd_range(-9.0,9.0),"s":_rnd_range(2.0,4.5),
            "kind":"crimson" if _rand_unit()<0.25 else "shard",
            "life":_rnd_range(1.2,2.0),"bounce":0.3})

func _smoke(x: float,y: float,radius: float,count: int,palette: int,lifetime: float,spread: float) -> void:
    for i in range(count):
        var vx: float = _rnd_range(-12.0,12.0)
        var vy: float = _rnd_range(-6.0,6.0)
        _emit("blob",{"x":x+_rnd_range(-spread,spread),
            "y":y+_rnd_range(-spread,spread)*0.5,
            "z":_rnd(8.0),"w":radius*_rnd_range(0.5,0.8),
            "h":radius*_rnd_range(0.45,0.7),
            "w1":radius*_rnd_range(1.5,2.1),
            "h1":radius*_rnd_range(1.2,1.7),"shape":2,
            "pal":palette,"life":lifetime*_rnd_range(0.8,1.2),
            "layer":3,"alpha":0.92,"fadeStart":0.4,
            "seed":_rnd(20.0),
            "gold_upd_vx":vx,"gold_upd_vy":vy,"gold_upd_rise":12.0})

func _sparks(x: float,y: float) -> void:
    for i in range(5):
        var a: float = -PI/2.0 + _rnd_range(-1.5,1.5)
        var v: float = _rnd_range(80.0,260.0)
        _emit("part",{"x":x,"y":y,"z":6,
            "vx":cos(a)*v,"vy":sin(a)*v*0.8,
            "vz":_rnd_range(20.0,120.0),
            "grav":260,"drag":1.5,
            "life":_rnd_range(0.2,0.6),
            "streak":0.045,"size":1,
            "ramp":"crimson","layer":6,
            "bounce":0.4,"shrink":0.3})

func _ground_ring(x: float,y: float) -> void:
    _emit("ring",{"x":x,"y":y,"r0":4,"r1":26,
        "wd":8,"s":3.78,"life":0.315})
    _emit("blob",{"x":x,"y":y,"w":4,"h":4*TILT,
        "w1":26,"h1":26*TILT,"shape":1,
        "pal":1,"k1":0.2,"heat":1,"life":0.35,
        "layer":1,"fadeStart":0.35,"seed":_rnd(10.0)})

func spawn_standard_wave(source_position: Vector2,side: int) -> Array[Dictionary]:
    objects.clear()
    var x: float = source_position.x
    var y: float = source_position.y
    _flash(x,y)
    _shards(x,y,5,-PI/2.0,120.0,330.0)
    _shards(x,y+6.0,4,PI/2.0,100.0,260.0)
    _smoke(x,y+2.0,24.0,3,2,2.8,10.0)
    _smoke(x,y-10.0,16.0,2,3,2.0,8.0)
    _sparks(x,y)
    crack_angle = float(side)*0.5 + _rnd_range(-0.3,0.3) + PI/2.0
    # GroundBuffer handles crack and rubble with its own RNG, as in gold.
    _ground_ring(x,y+6.0)
    return objects
