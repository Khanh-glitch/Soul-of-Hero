## Actual C-frame ribbon vs C ribbon directed into A additive field.
## Isolated source primitive only; not full-fusion or gameplay parity.
extends SceneTree

func _initialize() -> void:
    # The candidate assigns the six successful C channels to distinct moving
    # A connectors. Unit-only synthetic descriptors; no fake world actors.
    var candidates: Array[Dictionary] = []
    for i in range(215):
        candidates.append({"seed": float(i * 97), "rank": CMath.hash1(i * 97 * 131)})
    var chosen := AVoltCarouselFusion._selected_c_bridge_seeds(candidates)
    candidates.reverse()
    var reordered := AVoltCarouselFusion._selected_c_bridge_seeds(candidates)
    if chosen.size() != 6 or chosen != reordered:
        push_error("C_BOLT_A_FAIL six-channel selection count or determinism")
        quit(1)
        return
    var short: Array[Dictionary] = candidates.slice(0, 3)
    if AVoltCarouselFusion._selected_c_bridge_seeds(short).size() != 3:
        push_error("C_BOLT_A_FAIL short channel selection")
        quit(1)
        return
    var af := AFramebuffer.new()
    af.track_world_fields = true
    var cf := CFrame.new()
    var raster := CBoltARaster.new()
    var core := Vector3(2.6, 2.8, 3.4)
    var halo := Vector3(0.7, 1.1, 3.0)
    var cases := [
        {"pts": [Vector2(10.25, 15.75), Vector2(100.2, 16.4), Vector2(103.0, 70.2)], "w": 1.6, "k": 0.73, "reveal": 1.0},
        {"pts": [Vector2(-4, 14), Vector2(35, 52), Vector2(15, 27), Vector2(1, 70)], "w": 1.0, "k": 1.25, "reveal": 1.0},
        {"pts": [Vector2(100, 100), Vector2(100, 100), Vector2(113, 102), Vector2(116, 89)], "w": 2.2, "k": 0.48, "reveal": 0.55},
        {"pts": [Vector2(200, 40), Vector2(210, 80)], "w": 0.2, "k": 0.9, "reveal": 1.0},
        {"pts": [Vector2(382, 210), Vector2(411, 220)], "w": 1.4, "k": 0.8, "reveal": 1.0},
    ]
    for value in cases:
        var c: Dictionary = value
        CKit.draw_bolt(cf, c.pts, c.k, core, halo, c.w, c.reveal)
        raster.draw(af, c.pts, c.k, core, halo, c.w, c.reveal)
    var changed := 0
    # C is 384x216; A is 416x234. Compare identical native coordinates on
    # the common domain, not linear indices with different row strides.
    for y in range(CFrame.H):
        for x in range(CFrame.W):
            var source := (y * CFrame.W + x) * 4
            var target_pixel := y * AFramebuffer.W + x
            var target := target_pixel * 3
            for channel in range(3):
                if cf.light[source + channel] != af.buf[target + channel]:
                    push_error("C_BOLT_A_FAIL x=%d y=%d channel=%d c=%s a=%s" % [x, y, channel, str(cf.light[source + channel]), str(af.buf[target + channel])])
                    quit(1)
                    return
            if cf.light[source] != 0.0 or cf.light[source + 1] != 0.0 or cf.light[source + 2] != 0.0:
                changed += 1
                if af.world_influence[target_pixel] != 1:
                    push_error("C_BOLT_A_FAIL missing authored influence")
                    quit(1)
                    return
    if changed == 0:
        push_error("C_BOLT_A_FAIL empty raster")
        quit(1)
        return
    print("C_BOLT_A_PASS identical C light and A additive fields, pixels=%d; source primitive only" % changed)
    quit(0)
