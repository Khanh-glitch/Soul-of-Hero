## D19 software g-layer on a neutral source base. Does not include Gold
## floor, actors, original bloom/post, actual SOH world or owner approval.
extends SceneTree
const OUT := "res://artifacts/arcana19-pass-source"

# Diagnostic-only acceleration: the additive buffer is cleared every tick.
# Simulation and RNG calls still run. Persistent warp is outside this test.
class SnapshotFx extends DFx:
    var capture := true
    func sp(x: float, y: float, size: float, col: Color, shape: int = DISC, o: Dictionary = {}) -> void:
        if capture: super.sp(x, y, size, col, shape, o)
    func line(pts: Array, width: Variant, col: Variant, o: Dictionary = {}) -> void:
        if capture: super.line(pts, width, col, o)
    func poly(pts8: Array, col: Color, o: Dictionary = {}) -> void:
        if capture: super.poly(pts8, col, o)

func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    # Check skipped intermediate raster against eager rendering first.
    var eager := DConstellationEngine.new()
    eager.setup()
    var test := DConstellationEngine.new()
    test.setup()
    test.fx = SnapshotFx.new()
    for tick in range(1, 21):
        (test.fx as SnapshotFx).capture = tick == 20
        var dt := 0.0001 if tick == 1 else 1.0 / 60.0
        eager.update(float(tick) / 60.0, dt)
        test.update(float(tick) / 60.0, dt)
    if eager.fx.buf != test.fx.buf or eager._nodes != test._nodes or eager._edges != test._edges or eager._pulses != test._pulses or eager.fx._pool != test.fx._pool:
        push_error("D19 snapshot acceleration diverged from eager state or pixels")
        quit(1)
        return
    print("D19 snapshot acceleration matches eager simulation and pixels at tick 20")
    var eng := DConstellationEngine.new()
    eng.setup()
    eng.fx = SnapshotFx.new()
    var ticks := [72, 192, 312, 489, 510]
    for tick in range(1, ticks[-1] + 1):
        (eng.fx as SnapshotFx).capture = tick in ticks
        eng.update(float(tick) / 60.0, 0.0001 if tick == 1 else 1.0 / 60.0)
        if tick in ticks:
            var file := FileAccess.open(OUT + "/native_%d.scene.rgb32f" % tick, FileAccess.WRITE)
            file.store_buffer(eng.fx.buf.to_byte_array())
            file.close()
            print("D19_NATIVE_SOURCE_PASS ", tick, " bloom_gain=", eng.fx.bloom_gain)
    print("D19_NATIVE_SOURCE_CAPTURE_COMPLETE")
    quit()
