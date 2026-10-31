## Same-run old/new field equality and timings; no visual acceptance.
extends SceneTree
func _initialize() -> void:
    var old := CWorldseedOrganismReference.new()
    var candidate := CWorldseedOrganism.new()
    for tick in [150,180,210,240,270,300,330,360,381,402,426,450,456,480,510,540,558,570]:
        var a := CFrame.new()
        var b := CFrame.new()
        a.track_world_fragments = true
        b.track_world_fragments = true
        a.clear()
        b.clear()
        var s := Time.get_ticks_usec()
        old.render(a,float(tick)/60.0)
        var old_us := Time.get_ticks_usec()-s
        s = Time.get_ticks_usec()
        candidate.render(b,float(tick)/60.0)
        var new_us := Time.get_ticks_usec()-s
        if a.ink != b.ink or a.light != b.light or a.disp != b.disp or a.world_influence != b.world_influence:
            printerr("C16_OPT_MISMATCH tick=",tick)
            quit(1)
            return
        print("C16_OPT_EXACT tick=",tick," old_us=",old_us," new_us=",new_us)
    print("C16_OPT_COMPLETE")
    quit()
