## C #05 selected late source buffers, same seed/tick on a zero base.
## Early A lead, actual world, post and visual approval are not covered.
extends SceneTree
const OUT := "res://artifacts/arcana20-c05-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    for tick in [372, 396, 420, 450, 480, 510]:
        var effect := CAbyssalBloomLate.new()
        effect.setup()
        for i in range(1, tick + 1): effect.update(1.0 / 60.0, float(i) / 60.0)
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        for kind in ["ink", "light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
    print("C05_LATE_SOURCE_CAPTURE_COMPLETE")
    quit()
