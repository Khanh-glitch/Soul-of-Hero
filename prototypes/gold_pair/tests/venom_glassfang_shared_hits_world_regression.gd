extends SceneTree

## INTEGRATION REGRESSION for Glassfang's three finisher Pools.
## Source-locked semantics: ONE Hits ledger, one shared World RNG, 60Hz,
## World.time-based cooldown, three maximum acid ticks per enemy.
## This is NOT a full original-TS World RNG or full-skill visual oracle.
const POOL=preload("res://prototypes/gold_pair/venom_source_pool_lifecycle.gd")
const RNG=preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const F:float=1.0/60.0
const FINISHER_LIFE:float=4.2
const FINISHER_RADIUS:float=6.5

func _fail(message:String)->void:
    push_error("GLASSFANG_SHARED_HITS: "+message)
    quit(1)

func _scenario(share_ledger:bool,clock_offset:float=2.433333333333333)->Dictionary:
    var rng=RNG.new(0x20261027)
    var shared:Dictionary={}
    var pools:Array=[]
    for i in range(3):
        var pool=POOL.new()
        # Three finisher pools share the SAME World RNG, never per-pool RNG.
        pool.begin(391.72,176.95,FINISHER_RADIUS,FINISHER_LIFE,
            rng,2.0,0.3,0.7,10,3,1)
        if share_ledger:
            pool.bind_shared_hits(shared)
        pools.append(pool)
    var target:Dictionary={"id":17,"x":391.72,"y":176.95,
        "r":6.0,"dying":0.0,"hp":900}
    var cue_rows:PackedStringArray=PackedStringArray()
    var bubble_rows:PackedStringArray=PackedStringArray()
    var per_tick:Dictionary={}
    for frame in range(1,254):
        var absolute_time:float=clock_offset+float(frame)*F
        # Sequential World.fx order is preserved; do not parallelize Pool.upd.
        for index in range(3):
            var pool=pools[index]
            pool.step_source_60hz([target],absolute_time)
            for event in pool.current_frame_events:
                if String(event["k"])=="damage":
                    var id:int=int(event["id"])
                    cue_rows.append("%d|%d|%d|%d" % [frame,index,id,int(event["amount"])])
                    per_tick[frame]=int(per_tick.get(frame,0))+1
                elif String(event["k"])=="bubble":
                    bubble_rows.append("%d|%d|%.6f|%.6f" % [
                        frame,index,float(event["x"]),float(event["y"])])
    var all_dead:bool=true
    for pool in pools:
        if not pool.dead or pool.frame!=253:
            all_dead=false
    return {
        "cues":cue_rows,"bubbles":bubble_rows,"rng":rng.state,
        "hits":shared.duplicate(true),"per_tick":per_tick,
        "dead":all_dead,"hp":target["hp"]
    }

func _initialize()->void:
    var shared:Dictionary=_scenario(true)
    var again:Dictionary=_scenario(true)
    var independent:Dictionary=_scenario(false)
    var shifted:Dictionary=_scenario(true,97.43333333333334)
    if not bool(shared["dead"]):
        _fail("source 4.2-second afterlife failed to expire at 253 ticks")
        return
    if int(shared["hp"])!=900:
        _fail("VFX cue generator mutated target health (double damage risk)")
        return
    if not shared["hits"].has(17) or int(shared["hits"][17]["n"])!=3:
        _fail("three finisher pools did not share original Hits maximum")
        return
    if shared["cues"].size()!=3 or independent["cues"].size()!=9:
        _fail("expected 3 shared vs 9 independent damage cues, got %d/%d" %
            [shared["cues"].size(),independent["cues"].size()])
        return
    for frame in shared["per_tick"]:
        if int(shared["per_tick"][frame])!=1:
            _fail("same-frame double damage cue at World tick "+str(frame))
            return
    if shared["bubbles"].size()<1:
        _fail("source World RNG produced no bubble cues")
        return
    if shared["cues"]!=again["cues"] or shared["bubbles"]!=again["bubbles"] or int(shared["rng"])!=int(again["rng"]):
        _fail("same-seed original sequential World RNG order is nondeterministic")
        return
    if shared["cues"]!=shifted["cues"] or shared["bubbles"]!=shifted["bubbles"] or int(shared["rng"])!=int(shifted["rng"]):
        _fail("absolute World.time shift incorrectly changed relative tick events")
        return
    # Reinitializing another Pool must not erase a previously accepted hit.
    var ledger:Dictionary={}
    var first=POOL.new()
    var next=POOL.new()
    var rng=RNG.new(1)
    first.begin(0.0,0.0,6.5,4.2,rng)
    first.bind_shared_hits(ledger)
    if not first._hit_allowed(17,10.0):
        _fail("initial source Hits.ok should accept first target")
        return
    next.begin(0.0,0.0,6.5,4.2,rng)
    next.bind_shared_hits(ledger)
    if not ledger.has(17) or next._hit_allowed(17,10.01):
        _fail("late finisher pool reset/bypassed shared source Hits ledger")
        return
    print("GLASSFANG_SHARED_HITS: PASS / 3 finisher pools / 253 ticks / 3 shared vs 9 independent cues / global RNG / absolute World.time / no health mutation")
    quit(0)
