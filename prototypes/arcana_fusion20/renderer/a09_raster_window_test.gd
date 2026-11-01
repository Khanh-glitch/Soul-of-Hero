## Unit-only raster-window transform test; no synthetic gameplay actors.
extends SceneTree

func _initialize() -> void:
    var spell := AChainVerdictGraph.new()
    spell.setup()
    # Real capture tick 247 contained three actors beyond x=0. These are
    # source-local numeric inputs, not spawned actors or combat receipts.
    spell.nodes = [Vector2(118, 142), Vector2(-117, 232), Vector2(-81, 72), Vector2(-49, 103), Vector2(70, 120), null, null, null]
    var before: Array = spell.nodes.duplicate()
    var offset: Vector2 = spell.source_raster_offset()
    for value in before:
        if value == null: continue
        var p: Vector2 = value + offset
        if p.x < 0.0 or p.x >= AFramebuffer.W or p.y < 0.0 or p.y >= AFramebuffer.H:
            push_error("A09_WINDOW_FAIL a fitting anchor remains outside")
            quit(1)
            return
    var host := ASourcePlayer.new()
    host.configure(spell, 7.2)
    host._fb = AFramebuffer.new()
    host._origin = Vector2(900, 3400)
    host._rot = 0.37
    host._scale = 0.765615
    host._raster_offset = offset
    var frame := host.source_pass_frame()
    for value in before:
        if value == null: continue
        var p: Vector2 = value
        if host.local_to_world(p).distance_to(frame.source_to_world * (p + offset)) > 0.001:
            push_error("A09_WINDOW_FAIL actor world anchor changed")
            quit(1)
            return
    spell.raster_offset = offset
    var field := AFramebuffer.new()
    field.clear()
    spell.render(field, 2.5)
    if spell.nodes != before:
        push_error("A09_WINDOW_FAIL render changed simulation nodes")
        quit(1)
        return
    spell.nodes = [Vector2(-300, 0), Vector2(300, 0)]
    var wide: Vector2 = spell.source_raster_offset()
    if wide != Vector2(round(wide.x), round(wide.y)):
        push_error("A09_WINDOW_FAIL noninteger translation")
        quit(1)
        return
    # Wider than the fixed field: report the unresolved case, don't rescale.
    print("A09_WINDOW_PASS actor world positions unchanged; fixed field can still clip oversized spans, offset=", offset)
    host.free()
    quit(0)
