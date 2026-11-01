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
    var probe := ARedesignSpells.C + normal * 11.0
    var x := floori(probe.x); var y := floori(probe.y)
    var material := frame.get_px(x, y)
    if count < 1000 or frame.world_coverage[y * AFramebuffer.W + x] < 0.99 or material.length() > 0.4:
        push_error("A04_BLADE_FAIL coverage=%d probe_coverage=%f dark_material=%s" % [count, frame.world_coverage[y * AFramebuffer.W + x], str(material)])
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
