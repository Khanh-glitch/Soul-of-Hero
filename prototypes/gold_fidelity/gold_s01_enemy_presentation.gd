class_name GoldS01EnemyPresentation
extends RefCounted

## Direct numerical port of ORIGINAL src/engine/actors.ts Enemy.hit/update.
## Source SHA256 6422b09b706705b07a0b13bf695baf981363c1dafb2a283f85457de17e717e57.
## Presentation-only: does NOT change SOH combat damage, health, tile collisions or saves.
## Excludes burn-generated random Part because S01 never sets burn.
const STEP := 1.0 / 60.0
var id: int
var kind: String
var x: float
var y: float
var z := 0.0
var vx := 0.0
var vy := 0.0
var vz := 0.0
var flash := 0.0
var burn := 0.0
var burn_time := 0.0
var stun := 0.0
var squash := 0.0
var squash_target := 0.0
var lean := 0.0
var down := 0.0
var friction := 5.0
var t := 0.0
var shake := 0.0
var hc: float
var radius: float
var facing := "S"
var landing_cues: Array[Dictionary] = []

func _init(enemy_id: int, source_kind: String, start_x: float, start_y: float) -> void:
    id = enemy_id
    kind = source_kind
    x = start_x
    y = start_y
    hc = 13.0 if kind == "heavy" else 10.0
    radius = 11.0 if kind == "heavy" else 8.0

func center() -> Vector2:
    return Vector2(x,y-z-hc)

func hit(direction: float, power: float, opts: Dictionary = {}) -> void:
    var mass: float = 0.7 if kind == "heavy" else 1.0
    vx += cos(direction)*power*mass
    vy += sin(direction)*power*mass*0.8
    vz += float(opts.get("lift",0.0))
    stun = maxf(stun,float(opts.get("stun",0.4)))
    flash = float(opts.get("flash",1.0))
    burn_time = maxf(burn_time,float(opts.get("burn",0.0)))
    down = maxf(down,float(opts.get("down",0.0)))
    shake = maxf(shake,0.25)

func advance(dt: float = STEP, hero_y: float = 150.0) -> void:
    # Source Enemy.update(w,dt) ordering matters: position before gravity,
    # fall/bounce, conditional friction, clamp, lean, down, facing.
    t += dt
    flash = maxf(0.0,flash-dt*6.0)
    if burn_time > 0.0:
        # The ORIGINAL actor randomly emits flame particles here.
        # S01 is non-fire, so refuse to claim visual parity if this branch runs.
        push_error("GoldS01EnemyPresentation burn requires RNG particle adapter")
        burn_time -= dt
        burn = minf(1.0,burn+dt*5.0)
    else:
        burn = maxf(0.0,burn-dt*1.4)
    stun = maxf(0.0,stun-dt)
    shake = maxf(0.0,shake-dt)
    squash += (squash_target-squash)*minf(1.0,dt*14.0)
    x += vx*dt
    y += vy*dt
    z += vz*dt
    if z>0.0 or vz>0.0:
        vz -= 520.0*dt
    if z<=0.0:
        if vz< -110.0:
            landing_cues.append({"type":"land_dust_and_scorch","x":x,"y":y,"radius_dust":5.0,"radius_scorch":5.0})
            vz = -vz*0.22
        else:
            vz = 0.0
        z = 0.0
        var k: float = exp(-friction*dt)
        vx *= k
        vy *= k
    else:
        var k: float = exp(-0.4*dt)
        vx *= k
        vy *= k
    x = clampf(x,16.0,464.0)
    y = clampf(y,52.0,258.0)
    var target: float = -clampf(vx*0.012,-0.5,0.5) + (sin(t*40.0)*0.05 if stun>0.0 else 0.0)
    lean += (target-lean)*minf(1.0,dt*12.0)
    if down>0.0:
        down -= dt
    facing = "N" if hero_y<y-14.0 else "S"

func diagnostics() -> Dictionary:
    return {"id":id,"kind":kind,"x":x,"y":y,"z":z,"vx":vx,"vy":vy,"vz":vz,
        "flash":flash,"stun":stun,"down":down,"shake":shake,"lean":lean,
        "t":t,"facing":facing,"cx":center().x,"cy":center().y,
        "non_authoritative_visual_only":true}
