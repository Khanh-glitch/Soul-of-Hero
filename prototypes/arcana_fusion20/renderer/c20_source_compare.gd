## C selected rift-contour source buffers against a zero base. A warp is
## intentionally excluded from this C ink/light comparison.
extends SceneTree
const OUT := "res://artifacts/arcana20-c20-source"
func _initialize() -> void:
    DirAccess.make_dir_recursive_absolute(OUT)
    var effect := CRealityRipperFusion.new()
    effect.setup()
    for tick in [270, 324, 396, 450, 540]:
        var frame := CFrame.new()
        frame.clear()
        effect.render(frame, float(tick) / 60.0)
        var ink := FileAccess.open(OUT + "/native_%d.ink32f" % tick, FileAccess.WRITE)
        ink.store_buffer(frame.ink.to_byte_array())
        ink.close()
        var light := FileAccess.open(OUT + "/native_%d.light32f" % tick, FileAccess.WRITE)
        light.store_buffer(frame.light.to_byte_array())
        light.close()
    print("C20_SELECTED_CONTOUR_CAPTURE_COMPLETE")
    quit()
