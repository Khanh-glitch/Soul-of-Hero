## C20 block/shock neutral source fields; no world, particles or post.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-blocks-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var effect := CRealityRipperFusion.new()
    effect.setup()
    effect.audit_blocks_only = true
    for tick in [396, 420, 450, 480, 540, 558]:
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        for kind in ["ink", "light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
    print("C20_BLOCKS_CAPTURE_COMPLETE")
    quit()
