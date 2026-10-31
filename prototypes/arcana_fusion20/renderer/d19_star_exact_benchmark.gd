## Same-host prior source versus hoisted star hash phases. Both use identical
## RGBA8 transfer; exact arrays and authored operation coverage are mandatory.
extends SceneTree
const Reference = preload("res://prototypes/arcana_fusion20/renderer/d19_star_reference_fx.gd")
func _initialize() -> void:
    var old := Reference.new()
    var now := DFx.new()
    old.track_world_fields = true
    now.track_world_fields = true
    old.rgba8_fragment_transfer = true
    now.rgba8_fragment_transfer = true
    old.rgba8_scene_blend = true
    now.rgba8_scene_blend = true
    var cases := [
        {"size":4.0,"rot":0.0,"seed":82.303,"flags":0.0},
        {"size":28.0,"rot":0.43,"seed":82.303,"flags":0.0},
        {"size":48.0,"rot":1.73,"seed":44.713,"flags":0.0},
        {"size":35.0,"rot":0.92,"seed":1.7,"flags":4.0},
        {"size":20.0,"rot":0.67,"seed":2.3,"flags":2.0}]
    var old_times: Array[float] = []
    var new_times: Array[float] = []
    for c in cases:
        old.t = 4.25
        now.t = 4.25
        for rep in range(6):
            old.clear()
            now.clear()
            var opts := {"rot":c.rot,"seed":c.seed,"flags":c.flags,"glow":1.2,"edge":0.6,"sx":c.size,"sy":float(c.size) * 0.7}
            var color := Color(0.65,0.35,0.9,0.7)
            var order := [old,now] if rep % 2 == 0 else [now,old]
            for fx in order:
                var t0 := Time.get_ticks_usec()
                fx.sp(240.0,130.0,float(c.size),color,4,opts)
                var elapsed := float(Time.get_ticks_usec() - t0)
                if fx == old: old_times.append(elapsed)
                else: new_times.append(elapsed)
            if old.buf != now.buf or old.world_influence != now.world_influence:
                push_error("D19 star phase hoist changed source field or coverage")
                quit(1)
                return
        print("D19_STAR_EXACT ",JSON.stringify({"size":c.size,"seed":c.seed,"flags":c.flags,"samples":6,"equal":true}))
    old_times.sort()
    new_times.sort()
    print("D19_STAR_BENCH ",JSON.stringify({"mixed_case_old_median_us":old_times[int((old_times.size()-1)/2)],"mixed_case_new_median_us":new_times[int((new_times.size()-1)/2)],"scope":"same-host alternating single-sprite CPU, five mixed cases; not world or device budget"}))
    print("D19_STAR_EXACT_COMPLETE")
    quit()
