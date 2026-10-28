class_name VenomGlassfangMotion
extends RefCounted

## Source-audited 60 Hz gameplay-facing MOTION controller for Glassfang Hunt #01.
## Direct port of src/game/skills/s1.ts glassfang generator: spawn, first leap,
## four bite/recoil/orbit/leap phases, retarget on dying enemy and finisher.
## The source-dynamic Fang is rendered by VenomSourceFangCanvas.
## This class NEVER applies gameplay damage: bite_cues must be consumed ONCE by
## existing CombatDamage authority and used for contact VFX independently.
## Other source FX (vial, shards, trails, pool, corrode, camera) are STILL open.
const RNG = preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const FANG = preload("res://prototypes/gold_pair/venom_source_fang.gd")
const F: float = 1.0 / 60.0
const DONE: float = -999999.0
var rng: GoldMulberry32Rng
var fang: VenomSourceFang
var face: float
var player_x: float
var player_y: float
var initial_target_id: int
var target: Dictionary = {}
var enemies: Array = []
var frame: int = 0
var bite_cues: Array[Dictionary] = []
var phase: String = "new"
var wait: float = 0.0
var done: bool = false
var cycle: int = 0
var seq_i: int = 0
var seq_n: int = 0
var seq_x0: float = 0.0
var seq_y0: float = 0.0
var seq_z0: float = 0.0
var seq_x1: float = 0.0
var seq_y1: float = 0.0
var seq_ang: float = 0.0
var seq_arc: float = 0.0
var next_phase: String = ""
var orbit_t0: float = 0.0
var orbit_t1: float = 0.0
var orbit_r: float = 0.0
var recoil_ang: float = 0.0

func begin(px: float, py: float, cast_angle: float, target_id: int, original_cast_seed: int) -> void:
    player_x=px
    player_y=py
    face=cast_angle
    initial_target_id=target_id
    rng=RNG.new(original_cast_seed)
    fang=null
    target={}
    frame=0
    wait=0.0
    cycle=0
    bite_cues.clear()
    phase="init"
    done=false

func _find_id(id: int) -> Dictionary:
    for e in enemies:
        if bool(e.get("exists",true)) and int(e["id"])==id:
            return e
    return {}

func _nearest(px: float,py: float,r: float) -> Dictionary:
    var out: Dictionary={}
    var best:float=r
    for e in enemies:
        if not bool(e.get("exists",true)) or float(e.get("dying",0.0))>0.0:continue
        var dx:float=float(e["x"])-px
        var dy:float=float(e["y"])-py
        var d:float=sqrt(dx*dx+dy*dy)-float(e["r"])
        if d<best:
            best=d
            out=e
    return out

static func _alive(e: Dictionary) -> bool:
    # Original alive(e) = !!e && e.dying <= 0, not HP or runtime scene validity.
    return not e.is_empty() and float(e.get("dying",0.0))<=0.0

static func _lerp(a:float,b:float,k:float)->float:
    return a+(b-a)*k

static func _smooth(k:float)->float:
    k=clampf(k,0.0,1.0)
    return k*k*(3.0-2.0*k)

func _contact(e:Dictionary)->Vector2:
    var a:float=atan2(fang.y-float(e["y"]),fang.x-float(e["x"]))
    var d:float=float(e["r"])+3.0
    return Vector2(float(e["x"])+cos(a)*d,float(e["y"])+sin(a)*d)

func _enter_leap(dest:Vector2,secs:float,arc_height:float,next:String)->void:
    phase="leap"
    next_phase=next
    seq_i=0
    seq_n=maxi(1,int(floor(secs*60.0+0.5)))
    seq_x0=fang.x
    seq_y0=fang.y
    seq_z0=fang.z
    seq_x1=dest.x
    seq_y1=dest.y
    seq_arc=arc_height

func _emit_bite(pct:int,finisher:bool)->void:
    if target.is_empty():return
    var ang:float=atan2(float(target["y"])-fang.y,float(target["x"])-fang.x)
    var px:float=float(target["x"])-cos(ang)*float(target["r"])
    var py:float=float(target["y"])-sin(ang)*float(target["r"])
    bite_cues.append({
        "frame":frame,"enemy":int(target["id"]),"amount":pct,
        "kind":"bite","final":finisher,"contact_x":px,"contact_y":py,
        "knock":160 if finisher else 80,"stagger":0.3
    })

func _advance()->float:
    # Equivalent to one generator.next(): all non-yield phase transitions
    # execute immediately, preserving the source task's exact F / wait timing.
    for _guard in range(32):
        match phase:
            "init":
                phase="throw"
                return 0.05
            "throw":
                target=_find_id(initial_target_id)
                if target.is_empty():
                    target=_nearest(player_x,player_y,110.0)
                var hx:float=player_x+cos(face)*8.0
                var hy:float=player_y-7.0+sin(face)*5.0
                var tx:float=float(target["x"]) if not target.is_empty() else player_x
                var ty:float=float(target["y"]) if not target.is_empty() else player_y
                var spawn_ang:float=atan2(ty-hy,tx-hx)
                seq_x0=_lerp(hx,tx,0.55)
                seq_y0=_lerp(hy,ty,0.55)
                seq_ang=spawn_ang
                phase="spawn"
                return 0.08
            "spawn":
                fang=FANG.new(seq_x0,seq_y0,seq_ang)
                fang.z=8.0
                fang.open=1.0
                if not target.is_empty():
                    _enter_leap(_contact(target),0.10,10.0,"bite_loop")
                else:
                    phase="bite_loop"
                continue
            "leap":
                if seq_i<seq_n:
                    seq_i+=1
                    var k:float=float(seq_i)/float(seq_n)
                    fang.x=_lerp(seq_x0,seq_x1,k)
                    fang.y=_lerp(seq_y0,seq_y1,k)
                    fang.z=_lerp(seq_z0,0.0,k)+4.0*seq_arc*k*(1.0-k)
                    fang.heading=atan2(seq_y1-seq_y0,seq_x1-seq_x0)
                    fang.open=1.0 if k>0.55 else 0.4
                    return F
                fang.z=0.0
                phase=next_phase
                continue
            "bite_loop":
                if cycle>=4:
                    phase="finish"
                    continue
                if not _alive(target):
                    target=_nearest(fang.x,fang.y,150.0)
                    if not target.is_empty():
                        _enter_leap(_contact(target),0.16,12.0,"bite_loop")
                        continue
                if target.is_empty():
                    phase="finish"
                    continue
                fang.open=1.0
                _emit_bite(30,false)
                recoil_ang=atan2(float(target["y"])-fang.y,float(target["x"])-fang.x)
                seq_i=0
                seq_n=maxi(1,int(floor(0.12*60.0+0.5)))
                phase="recoil"
                continue
            "recoil":
                if seq_i<seq_n:
                    seq_i+=1
                    var k:float=float(seq_i)/float(seq_n)
                    fang.x-=cos(recoil_ang)*70.0*F*(1.0-k)
                    fang.y-=sin(recoil_ang)*70.0*F*(1.0-k)
                    fang.z=6.0*sin(k*PI)
                    fang.open=0.2
                    return F
                if not _alive(target):
                    cycle+=1
                    phase="bite_loop"
                    continue
                orbit_t0=atan2(fang.y-float(target["y"]),fang.x-float(target["x"]))
                orbit_t1=orbit_t0+float(rng.sign_value())*rng.range_between(1.8,2.4)
                orbit_r=float(target["r"])+13.0
                seq_i=0
                seq_n=maxi(1,int(floor(0.26*60.0+0.5)))
                phase="orbit"
                continue
            "orbit":
                if seq_i<seq_n:
                    seq_i+=1
                    var k:float=float(seq_i)/float(seq_n)
                    var theta:float=_lerp(orbit_t0,orbit_t1,_smooth(k))
                    var dx:float=fang.x-float(target["x"])
                    var dy:float=fang.y-float(target["y"])
                    var rad:float=_lerp(sqrt(dx*dx+dy*dy),orbit_r,0.3)
                    fang.x=float(target["x"])+cos(theta)*rad
                    fang.y=float(target["y"])+sin(theta)*rad
                    # The source consumes one RNG draw even though * 0
                    # leaves the heading mathematically unchanged.
                    fang.heading=theta+PI+rng.range_between(-0.1,0.1)*0.0
                    fang.open=0.3
                    fang.z=0.0
                    return F
                _enter_leap(_contact(target),0.17,13.0,"advance_cycle")
                continue
            "advance_cycle":
                cycle+=1
                phase="bite_loop"
                continue
            "finish":
                if _alive(target):
                    _emit_bite(55,true)
                # Original finale consumes 2 cast RNG draws for each of 3
                # independent Pool offsets (angle and radius); World FX RNG
                # is a separate stream and must not be merged.
                for j in range(3):
                    rng.range_between(0.0,PI*2.0)
                    rng.range_between(8.0,22.0)
                fang=null
                phase="end_wait"
                return 0.6
            "end_wait":
                done=true
                phase="done"
                return DONE
            "done":
                done=true
                return DONE
            _:
                push_error("Unknown original Glassfang source phase: "+phase)
                done=true
                return DONE
    push_error("Glassfang source generator loop exceeded 32 transitions")
    done=true
    return DONE

func step_60hz(targets:Array)->void:
    frame+=1
    enemies=targets
    if not done:
        wait-=F
        var iterations:int=0
        while wait< -0.000001 and iterations<60:
            iterations+=1
            var yielded:float=_advance()
            if yielded==DONE:break
            wait+=yielded if yielded!=0.0 else F
    # Source World.step() calls Fang.upd() *after* the generator ran.
    if fang!=null:
        fang.update_chain()
