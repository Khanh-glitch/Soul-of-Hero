## D19 software g-layer on a neutral source base. Does not include Gold
## floor, actors, original bloom/post, actual SOH world or owner approval.
extends SceneTree
const OUT := "res://artifacts/arcana19-pass-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var eng := DConstellationEngine.new()
    eng.setup()
    var ticks := [72, 192, 312, 489, 510]
    for tick in range(1, ticks[-1] + 1):
        eng.update(float(tick) / 60.0, 1.0 / 60.0)
        if tick in ticks:
            var file := FileAccess.open(OUT + "/native_%d.scene.rgb32f" % tick, FileAccess.WRITE)
            file.store_buffer(eng.fx.buf.to_byte_array())
            file.close()
            print("D19_NATIVE_SOURCE_PASS ", tick, " bloom_gain=", eng.fx.bloom_gain)
    print("D19_NATIVE_SOURCE_CAPTURE_COMPLETE")
    quit()
