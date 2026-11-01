## Diagnostic-only A rotor source restoration; not gameplay or full fusion.
extends SceneTree

func _initialize() -> void:
    var out := OS.get_environment("A11_REFERENCE_OUT")
    if out.is_empty():
        push_error("A11_A_REFERENCE_FAIL output directory is required")
        quit(1)
        return
    var spell := AVoltCarouselMixedExperiment.new()
    spell.setup()
    spell.include_c_role = false
    var targets := [87, 183, 247, 327]
    for tick in range(1, targets[-1] + 1):
        var time := float(tick) / 60.0
        spell.update(1.0 / 60.0, time)
        if tick not in targets: continue
        var fb := AFramebuffer.new()
        fb.clear()
        spell.render(fb, time)
        var f := FileAccess.open(out.path_join("a11_restored_%d.rgb32f" % tick), FileAccess.WRITE)
        if f == null:
            push_error("A11_A_REFERENCE_FAIL could not write source field")
            quit(1)
            return
        f.store_buffer(fb.buf.to_byte_array())
        f.close()
    print("A11_A_REFERENCE_PASS diagnostic original-A path only; no world or Gold fusion")
    quit(0)
