class_name GoldFxDynamics
extends RefCounted

## Source exact simulation port: src/engine/world.ts Part, Chunk, LightFx, RingFx.
## No raster frames or spritesheets. Fixed-step caller clock remains authoritative.
const STEP := 1.0/60.0

static func part(source: Dictionary) -> Dictionary:
    var p: Dictionary = {"x":0.0,"y":0.0,"z":0.0,"vx":0.0,"vy":0.0,"vz":0.0,"grav":300.0,"drag":0.0,"life":0.6,"t":0.0,"bounce":0.3,"dead":false}
    p.merge(source,true)
    return p

static func step_part(p: Dictionary, dt: float = STEP) -> void:
    p["t"] = float(p["t"]) + dt
    if float(p["t"]) >= float(p["life"]):
        p["dead"] = true
        return
    var k: float = exp(-float(p["drag"]) * dt)
    p["vx"] = float(p["vx"]) * k
    p["vy"] = float(p["vy"]) * k
    p["x"] = float(p["x"]) + float(p["vx"]) * dt
    p["y"] = float(p["y"]) + float(p["vy"]) * dt
    p["vz"] = float(p["vz"]) - float(p["grav"]) * dt
    p["z"] = float(p["z"]) + float(p["vz"]) * dt
    if float(p["z"]) < 0.0:
        p["z"] = 0.0
        if float(p["grav"]) > 0.0:
            p["vz"] = -float(p["vz"]) * float(p["bounce"])
            p["vx"] = float(p["vx"]) * 0.7
            p["vy"] = float(p["vy"]) * 0.7
        else:
            p["vz"] = 0.0

static func chunk(source: Dictionary) -> Dictionary:
    var c: Dictionary = {"x":0.0,"y":0.0,"z":0.0,"vx":0.0,"vy":0.0,"vz":0.0,"rot":0.0,"spin":0.0,"life":2.5,"t":0.0,"grav":480.0,"fric":6.0,"bounce":0.35,"stick":false,"landed":false,"rest":false,"dead":false}
    c.merge(source,true)
    return c

static func step_chunk(c: Dictionary, dt: float = STEP) -> bool:
    c["t"] = float(c["t"]) + dt
    if float(c["t"]) >= float(c["life"]):
        c["dead"] = true
        return false
    if bool(c["rest"]):
        return false
    c["x"] = float(c["x"]) + float(c["vx"]) * dt
    c["y"] = float(c["y"]) + float(c["vy"]) * dt
    c["z"] = float(c["z"]) + float(c["vz"]) * dt
    c["vz"] = float(c["vz"]) - float(c["grav"]) * dt
    c["rot"] = float(c["rot"]) + float(c["spin"]) * dt
    var land := false
    if float(c["z"]) <= 0.0:
        c["z"] = 0.0
        if not bool(c["landed"]):
            c["landed"] = true
            land = true
        if absf(float(c["vz"])) > 60.0 and not bool(c["stick"]):
            c["vz"] = -float(c["vz"]) * float(c["bounce"])
            c["vx"] = float(c["vx"]) * 0.6
            c["vy"] = float(c["vy"]) * 0.6
            c["spin"] = float(c["spin"]) * 0.5
        else:
            c["vz"] = 0.0
            var k: float = exp(-float(c.get("fric",6.0)) * dt)
            c["vx"] = float(c["vx"]) * k
            c["vy"] = float(c["vy"]) * k
            c["spin"] = float(c["spin"]) * k
            if Vector2(float(c["vx"]),float(c["vy"])).length() < 4.0:
                c["rest"] = true
    return land

static func ring_payload(r: Dictionary) -> Dictionary:
    var p: float = float(r["t"]) / float(r["life"])
    return {"radius":lerpf(float(r["r0"]),float(r["r1"]),1.0-pow(1.0-p,3.0)),"width":float(r["wd"]),"strength":float(r["s"])*(1.0-p)}

static func light_weight(l: Dictionary) -> float:
    var p: float = float(l["t"]) / float(l["life"])
    var hold: float = float(l.get("hold",0.0))
    return (1.0 if p < hold else 1.0-(p-hold)/(1.0-hold)) if hold > 0.0 else (1.0-p)*(1.0-p)
