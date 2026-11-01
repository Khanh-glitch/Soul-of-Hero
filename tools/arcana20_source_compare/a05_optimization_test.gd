## Exact native #05 opening equivalence and bounded same-process CPU timing.
## Baseline is copied from the prior commit by the existing comparison job.
## Source raster only; not hardware FPS or complete fusion/world validation.
extends SceneTree

func _initialize() -> void:
    var old_script := load("res://prototypes/arcana_fusion20/renderer/a05_baseline_temp.gd") as Script
    if old_script == null:
        push_error("A05_OPT_FAIL missing historical source")
        quit(1)
        return
    var old: Variant = old_script.new()
    var current := AAbyssalBloomLead.new()
    old.setup()
    current.setup()
    for tick in [90, 180, 270, 318, 390, 480]:
        var before := AFramebuffer.new()
        var after := AFramebuffer.new()
        before.track_world_fields = true
        after.track_world_fields = true
        before.track_audit_writes = true
        after.track_audit_writes = true
        before.clear()
        after.clear()
        var time := float(tick) / 60.0
        var start := Time.get_ticks_usec()
        old.render(before, time)
        var old_us := Time.get_ticks_usec() - start
        start = Time.get_ticks_usec()
        current.render(after, time)
        var new_us := Time.get_ticks_usec() - start
        if before.buf != after.buf or before.world_coverage != after.world_coverage or before.world_influence != after.world_influence or before.world_multiplier != after.world_multiplier or before.world_warp != after.world_warp or before.audit_writes != after.audit_writes or before.flash != after.flash:
            push_error("A05_OPT_FAIL native field mismatch at tick %d" % tick)
            quit(1)
            return
        print("A05_OPT_TICK tick=",tick," old_us=",old_us," new_us=",new_us," raw_world_fields_bit_exact=true")
    print("A05_OPT_PASS six captured phases including OUT; source only")
    quit(0)
