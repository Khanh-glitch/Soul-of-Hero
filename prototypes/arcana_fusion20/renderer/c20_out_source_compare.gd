## Isolated C20 closing region and glint on neutral base, not live world.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-out-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var effect := CRealityRipperFusion.new()
    effect.setup()
    for tick in [570, 582, 591, 593, 594]:
        var frame := CFrame.new()
        frame.clear()
        effect._render_remainder(frame, float(tick) / 60.0)
        for kind in ["ink", "light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
    print("C20_OUT_CAPTURE_COMPLETE")
    quit()
