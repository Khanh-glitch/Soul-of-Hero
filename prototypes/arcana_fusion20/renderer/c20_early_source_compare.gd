## C20 early glitch fields on a zero base; no live-world/visual approval.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-early-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var effect := CRealityRipperFusion.new()
    effect.setup()
    for tick in [20, 45, 64, 84]:
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        for kind in ["light", "disp"]:
            var file := FileAccess.open(OUT + "/native_%d.%s32f" % [tick, kind], FileAccess.WRITE)
            var data: PackedFloat32Array = frame.get(kind)
            file.store_buffer(data.to_byte_array())
            file.close()
    print("C20_EARLY_CAPTURE_COMPLETE")
    quit()
