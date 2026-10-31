## Source-field regression, not live-world visual/combat acceptance.
extends SceneTree

var failures: Array[String] = []
var received: Dictionary = {}

func check(ok: bool, name: String) -> void:
    if not ok:
        failures.append(name)
        print("::error::SOURCE_PASS_FAIL ", name)

func _init() -> void:
    call_deferred("_run")

func _run() -> void:
    var c := CFrame.new()
    c.track_world_fragments = true
    c.G(2, 2, 0.0, 0.0, 0.0, 0.5)
    c.I(3, 2, 0.0, 0.0, 0.0, 0.5)
    c.L(4, 2, -0.5, 0.1, 0.0)
    c.D(5, 2, 3.0, -2.0)
    c.S(5, 2, 0.4)
    c.C(5, 2, 2.0)
    c.blit_world_fragment(10, 20, 2, 2, 30, 40)
    c.I(30, 40, 0.8, 0.0, 0.0, 0.25)
    check(is_equal_approx(c.ground_coverage[2 * CFrame.W + 2], 0.5), "C black ground coverage")
    check(is_equal_approx(c.ink[(2 * CFrame.W + 3) * 4 + 3], 0.5), "C black ink coverage")
    check(c.light[(2 * CFrame.W + 4) * 4] < 0.0, "C negative HDR light retained")
    var di := (2 * CFrame.W + 5) * 4
    check(c.disp[di] == 3.0 and c.disp[di + 1] == -2.0 and is_equal_approx(c.disp[di + 2], 0.4) and c.disp[di + 3] == 2.0, "C displacement shade chroma")
    var fi := (40 * CFrame.W + 30) * 4
    check(c.world_fragment[fi] == 10.0 and c.world_fragment[fi + 1] == 20.0 and is_equal_approx(c.world_fragment[fi + 2], 0.75), "C live fragment coordinates and subsequent ink")
    check(is_equal_approx(c.ink[fi + 3], 0.25), "C overdraw on live fragment")
    c.clear()
    check(c.world_fragment[fi + 2] == 0.0 and c.ground_coverage[2 * CFrame.W + 2] == 0.0, "C world fields clear")

    var b := BRenderer.new()
    b.track_world_coverage = true
    b.begin()
    b.plot(10, 10, 0.0, 0.0, 0.0, BRenderer.SET, 1.0)
    b.plot(11, 10, 0.4, 0.3, 0.2, BRenderer.ADD, 1.0)
    b.decal(12, 10, Vector3.ZERO, 0.5)
    check(b.ink_coverage[10 * BRenderer.W + 10] == 1.0, "B black SET coverage")
    check(b.ink_coverage[10 * BRenderer.W + 11] == 0.0, "B additive emission does not erase scene")
    check(is_equal_approx(b.decal_coverage[10 * BRenderer.W + 12], 0.5), "B black decal coverage")
    b.warp(11, 10, 11, 10, func(_x: int, _y: int) -> Array: return [10, 10])
    check(b.ink_coverage[10 * BRenderer.W + 11] == 1.0, "B warp transports explicit coverage")
    var wi := (10 * BRenderer.W + 11) * 2
    check(b.world_warp[wi] == -1.0 and b.world_warp[wi + 1] == 0.0, "B warp maps actual world sampling")
    b.begin()
    check(b.ink_coverage[10 * BRenderer.W + 11] == 0.0 and b.world_warp[wi] == 0.0, "B world fields clear")

    var host := Arcana20Renderer.new()
    host.world_pass_mode = true
    root.add_child(host)
    host.source_pass_ready.connect(func(id: StringName, frame: Arcana20SourcePassFrame) -> void:
        received[id] = frame)
    var caster := Vector2(201, 301)
    var target := Vector2(351, 281)
    for num in [2, 10, 17]:
        var id := Arcana20SourceCatalog.canonical_id(num)
        check(host.cast_skill(id, caster, target), "cast world producer %d" % num)
        var node: Node = host._casts[id]
        node.set_process(false)
        var sprite: Sprite2D
        if node is CSourcePlayer:
            var cp := node as CSourcePlayer
            cp.render_enabled = false
            for tick in range(180):
                cp.advance(1.0 / 60.0, false)
            cp.render_enabled = true
            cp._render_frame()
            sprite = cp._sprite
        else:
            var bp := node as BSourcePlayer
            bp.advance(3.0)
            bp._render_frame()
            sprite = bp._sprite
        var frame: Arcana20SourcePassFrame = received.get(id)
        check(frame != null, "source fields forwarded %d" % num)
        if frame != null:
            var original_caster := Vector2(104, 132) if num == 2 else Vector2(112, 126)
            check((frame.source_to_world * original_caster).distance_to(caster) < 0.001, "world caster transform %d" % num)
            var world_point: Vector2 = frame.source_to_world * Vector2(192, 108)
            var camera_before := Transform2D(0.0, Vector2.ZERO)
            var camera_after := Transform2D(0.0, Vector2(-40, -20))
            check((camera_after * world_point - camera_before * world_point).distance_to(Vector2(-40, -20)) < 0.001, "camera transform math %d" % num)
            check(not sprite.visible, "legacy quad suppressed %d" % num)
        host.cancel_skill(id)
        received.erase(id)
    host.free()
    print("ARCANA20_SOURCE_PASS_RESULT ", "PASS" if failures.is_empty() else "FAIL", " ", JSON.stringify(failures))
    quit(0 if failures.is_empty() else 1)
