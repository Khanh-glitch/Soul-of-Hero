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
    var probe := ARedesignSpells.C + normal * 25.0
    var x := floori(probe.x); var y := floori(probe.y)
    var material := frame.get_px(x, y)
    if count < 1000 or frame.world_coverage[y * AFramebuffer.W + x] < 0.99 or material.length() > 0.4:
        push_error("A04_BLADE_FAIL coverage=%d probe_coverage=%f dark_material=%s" % [count, frame.world_coverage[y * AFramebuffer.W + x], str(material)])
        quit(1)
        return
    # The tip and its exterior must be inside the authored source frame, so
    # the tapered end is genuinely covered rather than cut off at its edge.
    var tip: Vector2 = ARedesignSpells.C + direction * 100.0 + normal * 13.6
    var tip_in := tip - direction * 9.0
    var tip_out := tip + direction * 6.0
    var inside_index := floori(tip_in.y) * AFramebuffer.W + floori(tip_in.x)
    var outside_index := floori(tip_out.y) * AFramebuffer.W + floori(tip_out.x)
    if frame.world_coverage[inside_index] < 0.99 or frame.world_coverage[outside_index] > 0.01:
        push_error("A04_BLADE_FAIL tapered point is absent or outside-frame")
        quit(1)
        return
    # Test exact authored contact and acceleration, independent of the
    # raster test; not a replacement for viewing the animation.
    var ready: float = spell._blade_offset(3.04)
    var first: float = ready - spell._blade_offset(3.04 + 1.0 / 60.0)
    var second: float = spell._blade_offset(3.04 + 1.0 / 60.0) - spell._blade_offset(3.04 + 2.0 / 60.0)
    var contact: float = spell._blade_offset(3.4)
    if not (ready > 43.0 and second > first and absf(contact - 10.0) < 0.001 and spell._blade_offset(3.6) > contact):
        push_error("A04_BLADE_FAIL anticipation/acceleration/contact/recoil")
        quit(1)
        return
    # A cocked blade resolves onto the actual contact line. A static growing
    # bar could otherwise satisfy the translation check above.
    if absf(spell._blade_direction(3.18).angle_to(direction)) < 0.15 or absf(spell._blade_direction(3.4).angle_to(direction)) > 0.001:
        push_error("A04_BLADE_FAIL swing does not resolve to contact line")
        quit(1)
        return
    # The cocked tip is still inside the native framebuffer at maximum
    # draw-back: increased travel must not silently crop the physical blade.
    var cocked_dir: Vector2 = spell._blade_direction(3.18)
    var cocked_n := Vector2(-cocked_dir.y, cocked_dir.x)
    var cocked_tip: Vector2 = ARedesignSpells.C + cocked_dir * 100.0 + cocked_n * (ready + 3.6)
    if cocked_tip.x < 0.0 or cocked_tip.y < 0.0 or cocked_tip.x >= AFramebuffer.W or cocked_tip.y >= AFramebuffer.H:
        push_error("A04_BLADE_FAIL cocked tip leaves source framebuffer")
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
    # The blade is gone away from the line; the new shallow cut remains on
    # the actual contact line until the delayed rupture opens.
    if frame.world_coverage[y * AFramebuffer.W + x] > 0.01:
        push_error("A04_BLADE_FAIL physical blade persists after its authored fade")
        quit(1)
        return
    var line_x := floori(ARedesignSpells.C.x)
    var line_y := floori(ARedesignSpells.C.y)
    if frame.world_coverage[line_y * AFramebuffer.W + line_x] < 0.5:
        push_error("A04_BLADE_FAIL delayed rupture has no physical contact groove")
        quit(1)
        return
    frame.clear()
    spell.render(frame, 5.4)
    for i in range(1, 5):
        var point := ARedesignSpells.C + direction * (-92.0 + 184.0 * float(i) / 5.0)
        var connected := false
        for probe_y in range(floori(point.y) - 1, floori(point.y) + 2):
            for probe_x in range(floori(point.x) - 1, floori(point.x) + 2):
                if frame.world_coverage[probe_y * AFramebuffer.W + probe_x] > 0.5:
                    connected = true
        if not connected:
            push_error("A04_BLADE_FAIL unconnected ground cut at section %d" % i)
            quit(1)
            return
    print("A04_BLADE_PASS coverage=%d dark_material=%s; candidate only" % [count, str(material)])
    quit(0)
