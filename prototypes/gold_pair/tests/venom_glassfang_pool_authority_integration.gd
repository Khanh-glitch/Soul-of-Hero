extends SceneTree
## Runtime contract regression, NOT Gold full-cast approval.
const RUNTIME=preload("res://prototypes/gold_pair/venom_glassfang_full_particle_runtime.gd")
const F:float=1.0/60.0
func _initialize()->void:
    var r=RUNTIME.new()
    r.begin(260.0,160.0,0.25,17,1765485952,0x20261027)
    var target={"id":17,"x":375.0,"y":190.0,"r":9.5,"dying":0.0,"hp":900}
    var total:int=0
    for tick in range(1,254):
        r.step_source_60hz([target])
        if r.world_frame!=tick:
            push_error("GLASSFANG_AUTHORITY: source clock drift")
            quit(1)
            return
        if int(target["hp"])!=900:
            push_error("GLASSFANG_AUTHORITY: visual port mutated gameplay HP")
            quit(1)
            return
        var candidates:int=0
        for cue in r.cues:
            if String(cue.get("kind",""))=="acid_hit_candidate":
                candidates+=1
        if candidates<total:
            push_error("GLASSFANG_AUTHORITY: cue ledger lost hits")
            quit(1)
            return
        total=candidates
        if total>3:
            push_error("GLASSFANG_AUTHORITY: finisher exceeded shared Hits cap")
            quit(1)
            return
    if r.motion.frame!=253 or r.emitters.world.frame!=253:
        push_error("GLASSFANG_AUTHORITY: cast and particles clocks diverged")
        quit(1)
        return
    print("GLASSFANG_AUTHORITY: PASS / 253 source ticks / shared cap / no VFX HP mutation")
    quit(0)
