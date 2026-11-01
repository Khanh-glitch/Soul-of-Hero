## Shared A source raster extents: default behavior versus larger field.
## No world composition, presentation, bloom-edge or combat claim.
extends SceneTree

func _initialize() -> void:
    var base := AFramebuffer.new()
    var wide := AFramebuffer.new(624, 352)
    base.track_world_fields = true
    wide.track_world_fields = true
    for fb in [base, wide]:
        fb.clear()
        ADraw.streak(fb, 30.25, 50.75, 200.75, 120.25, 2.0, 1.2, Vector3(1.0, 0.3, 0.1), 0.8)
        ADraw.poly_fill_solid(fb, [Vector2(205, 150), Vector2(270, 150), Vector2(240, 190)], Vector3(0.1, 0.2, 0.4), true, 0.9)
        CChainChannel.new().draw(fb, Vector2(42, 80), Vector2(232, 120), 2.5, 791.0, 0.9, Vector3(2.6, 2.8, 3.4), Vector3(0.7, 1.1, 3.0), 1.6, 0.32, 5)
    var differing := 0
    for y in range(AFramebuffer.H):
        for x in range(AFramebuffer.W):
            var a := y * base.width + x
            var b := y * wide.width + x
            if base.world_coverage[a] != wide.world_coverage[b] or base.world_influence[a] != wide.world_influence[b]:
                differing += 1
            for c in range(3):
                if base.buf[a * 3 + c] != wide.buf[b * 3 + c]: differing += 1
    if differing != 0:
        push_error("A_VARIABLE_FIELD_FAIL shared area differs: %d" % differing)
        quit(1)
        return
    wide.add_px(500, 250, 1.0, 0.5, 0.25)
    if wide.buf[(250 * wide.width + 500) * 3] != 1.0 or wide.world_influence[250 * wide.width + 500] != 1:
        push_error("A_VARIABLE_FIELD_FAIL extended coordinate not rendered")
        quit(1)
        return
    CChainChannel.new().draw(wide, Vector2(450, 260), Vector2(560, 280), 2.5, 79.0, 0.9, Vector3(2.6, 2.8, 3.4), Vector3(0.7, 1.1, 3.0), 1.6, 0.32, 5)
    var found := false
    for y in range(255, 290):
        for x in range(430, 580):
            if (x != 500 or y != 250) and wide.world_influence[y * wide.width + x] != 0:
                found = true
    if not found:
        push_error("A_VARIABLE_FIELD_FAIL extended C channel was clipped")
        quit(1)
        return
    print("A_VARIABLE_FIELD_PASS shared raw RGB/coverage/influence bit exact; no bloom or world parity")
    quit(0)
