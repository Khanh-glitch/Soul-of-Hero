## Structural test of an unapproved redesign candidate, not creator approval.
extends SceneTree
func _initialize() -> void:
    var spell := ARedesignSpells.AshenGuillotineR.new()
    spell.setup()
    var frame := AFramebuffer.new()
    frame.track_world_fields = true
    spell.render(frame, 3.4)
    var count := 0
    for coverage in frame.world_coverage:
        if coverage > 0.99: count += 1
    var direction := Vector2(0.83, 0.55).normalized()
    var normal := Vector2(-direction.y, direction.x)
    var probe := ARedesignSpells.C + normal * 35.0
    var x := floori(probe.x); var y := floori(probe.y)
    var material := frame.get_px(x, y)
    if count < 1000 or frame.world_coverage[y * AFramebuffer.W + x] < 0.99 or material.length() > 0.4:
        push_error("A04_BLADE_FAIL coverage=%d probe_coverage=%f dark_material=%s" % [count, frame.world_coverage[y * AFramebuffer.W + x], str(material)])
        quit(1)
        return
    # Test exact authored contact and acceleration, independent of the
    # raster test; not a replacement for viewing the animation.
    var ready: float = spell._blade_offset(3.35)
    var first: float = ready - spell._blade_offset(3.35 + 1.0 / 60.0)
    var second: float = spell._blade_offset(3.35 + 1.0 / 60.0) - spell._blade_offset(3.35 + 2.0 / 60.0)
    var contact: float = spell._blade_offset(3.4)
    if not (ready > 30.0 and second > first and absf(contact - 10.0) < 0.001 and spell._blade_offset(3.6) > contact):
        push_error("A04_BLADE_FAIL anticipation/acceleration/contact/recoil")
        quit(1)
        return
    for bs in spell._cracks:
        var root: Vector2 = bs[0].pts[0]
        if absf((root - ARedesignSpells.C).dot(normal)) > 0.001:
            push_error("A04_BLADE_FAIL branch root is disconnected from cut")
            quit(1)
            return
    var events: Array = spell.authored_events()
    var impacts := 0
    for event in events:
        if event.kind == "rupture_impact":
            if absf((event.pos_local - ARedesignSpells.C).dot(normal)) > 0.001 or absf(float(event.t) - (4.6 + impacts * 0.08)) > 0.001:
                push_error("A04_BLADE_FAIL rupture cue outside the opening sequence")
                quit(1)
                return
            impacts += 1
    if impacts != 5:
        push_error("A04_BLADE_FAIL missing rupture contacts")
        quit(1)
        return
    frame.clear()
    spell.render(frame, 4.45)
    if frame.world_coverage.count(1.0) != 0:
        push_error("A04_BLADE_FAIL physical blade persists after its authored fade")
        quit(1)
        return
    print("A04_BLADE_PASS coverage=%d dark_material=%s; candidate only" % [count, str(material)])
    quit(0)
