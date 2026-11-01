## Fast runtime/field smoke for unapproved redesigns. Uses actual authored
## source instances; no synthetic world and no visual, parity or FPS claim.
extends SceneTree

func _initialize() -> void:
    var candidates := [
        {"id": 6, "spell": ARedesignSpells.RiptideCalligraphyR.new(), "times": [2.5, 5.0]},
        {"id": 12, "spell": ARedesignSpells.SkybreakerScriptR.new(), "times": [4.4, 6.8]},
        {"id": 13, "spell": ARedesignSpells2.RootwakeR.new(), "times": [3.0, 5.4]},
        {"id": 14, "spell": ARedesignSpells2.SporeNebulaR.new(), "times": [3.6, 5.4]},
        {"id": 18, "spell": ARedesignSpells2.ChronoshardR.new(), "times": [3.4, 6.2, 6.4]},
    ]
    for item in candidates:
        var spell: Variant = item.spell
        spell.setup()
        if int(item.id) == 13:
            # Uniformly transformed root trunks must still end at each
            # authored impact anchor after the growth-geometry redesign.
            for i in range(spell._roots.size()):
                var trunk: Dictionary = spell._roots[i][0]
                var points: Array = trunk.pts
                var endpoint: Vector2 = points[-1]
                if not endpoint.is_equal_approx(spell._tips[i]):
                    push_error("REDESIGN_SMOKE_FAIL #13 root contact anchor")
                    quit(1)
                    return
        if int(item.id) == 14:
            # Every meandering link still starts/ends at its real colony
            # anchors; the growth path and moving pulse use this same curve.
            for i in range(spell._links.size()):
                var a: Vector2 = spell._colonies[int(spell._links[i][0])]
                var b: Vector2 = spell._colonies[int(spell._links[i][1])]
                if not spell._hypha_point(a, b, i, 0.0).is_equal_approx(a) or not spell._hypha_point(a, b, i, 1.0).is_equal_approx(b):
                    push_error("REDESIGN_SMOKE_FAIL #14 hypha anchor")
                    quit(1)
                    return
        if int(item.id) == 18:
            # The enlarged source-inspired projectile head remains clipped to
            # its crystal face, including when the head crosses an edge.
            var clip := PackedVector2Array([Vector2(194, 94), Vector2(204, 94), Vector2(204, 106), Vector2(194, 106)])
            var clip_frame := AFramebuffer.new()
            clip_frame.track_audit_writes = true
            clip_frame.clear()
            spell._mini_star(clip_frame, Vector2(203, 100), 0.35, 0.42, clip, 1.0)
            var clipped_pixels := 0
            for y in range(AFramebuffer.H):
                for x in range(AFramebuffer.W):
                    if clip_frame.audit_writes[y * AFramebuffer.W + x] == 0: continue
                    clipped_pixels += 1
                    if not Geometry2D.is_point_in_polygon(Vector2(float(x) + 0.5, float(y) + 0.5), clip):
                        push_error("REDESIGN_SMOKE_FAIL #18 stored head escaped crystal")
                        quit(1)
                        return
            if clipped_pixels == 0:
                push_error("REDESIGN_SMOKE_FAIL #18 stored head invisible")
                quit(1)
                return
            # Verify capture order represents progressively later moments and
            # reverse release actually converges together; not art approval.
            var previous_tau := -1.0
            var previous_release := -1.0
            for i in range(5):
                var tau: float = float(ARedesignSpells2.ChronoshardR.STORED_TAU[i])
                var rel: float = spell._release(i, 5.9)
                if tau <= previous_tau or rel <= previous_release or not is_equal_approx(spell._release(i, 6.2), 1.0):
                    push_error("REDESIGN_SMOKE_FAIL #18 capture/release order")
                    quit(1)
                    return
                previous_tau = tau
                previous_release = rel
            var echo_kinds: Array = []
            for event in spell.authored_events():
                echo_kinds.append(event.kind)
            if not echo_kinds.has("reverse_echo_visual") or not echo_kinds.has("forward_echo_visual"):
                push_error("REDESIGN_SMOKE_FAIL #18 echo markers")
                quit(1)
                return
            if not is_equal_approx(spell._central_tau(3.1), spell._central_tau(5.0)) or not spell._central_tau(5.8) > spell._central_tau(5.0) or not is_equal_approx(spell._central_tau(6.2), 1.0):
                push_error("REDESIGN_SMOKE_FAIL #18 central freeze/resume")
                quit(1)
                return
        for value in item.times:
            var t: float = value
            var frame := AFramebuffer.new()
            frame.track_world_fields = true
            spell.update(1.0 / 60.0, t)
            spell.render(frame, t)
            var energy := 0.0
            for v in frame.buf: energy += absf(v)
            if not is_finite(energy) or energy <= 0.0:
                push_error("REDESIGN_SMOKE_FAIL id=%d t=%.3f energy=%s" % [int(item.id), t, str(energy)])
                quit(1)
                return
            print("REDESIGN_SMOKE id=%d t=%.3f sum=%.4f" % [int(item.id), t, energy])
    print("REDESIGN_SMOKE_PASS candidate source runtime only; no visual approval")
    quit(0)
